import { FixQuality } from "@/constants/nmea";
import type {
  NmeaDop,
  NmeaFix,
  NmeaParsedSentence,
  NmeaSatellite,
  NmeaVelocity,
} from "@/types/gnss";
import { create } from "zustand";

const RAW_BUFFER_MAX = 200;
const SAT_STALE_TIMEOUT_MS = 3000;

interface GnssState {
  fix: NmeaFix;
  satellites: NmeaSatellite[];
  velocity: NmeaVelocity;
  dop: NmeaDop | null;
  antenna: { status: string; power: boolean } | null;
  rawBuffer: string[];
  sessionBuffer: string[];
  isLogging: boolean;
}

interface GnssActions {
  applyGga: (data: Partial<NmeaFix>) => void;
  applyRmc: (data: Partial<NmeaFix & NmeaVelocity>) => void;
  applyVtg: (data: NmeaVelocity) => void;
  applyGsa: (data: NmeaDop) => void;
  applyGsv: (data: {
    talkerId: string;
    satellites: NmeaSatellite[];
    msgNum: number;
    numMsg: number;
  }) => void;
  appendRaw: (line: string) => void;
  applyBatch: (sentences: NmeaParsedSentence[], rawLines: string[]) => void;
  setLogging: (active: boolean) => void;
  clearSession: () => void;
  clearLiveData: () => void;
  reset: () => void;
}

const defaultFix: NmeaFix = {
  utcTime: "",
  utcDate: "",
  latitude: null,
  longitude: null,
  quality: FixQuality.NoFix,
  satellitesInUse: 0,
  hdop: null,
  pdop: null,
  vdop: null,
  altitudeMsl: null,
  geoidalSeparation: null,
  fixMode: null,
  talkerId: null,
  updatedAt: 0,
};

const defaultVelocity: NmeaVelocity = {
  speedKmh: null,
  courseTrue: null,
  mode: "N",
};

export const useGnssStore = create<GnssState & GnssActions>((set, get) => ({
  fix: { ...defaultFix },
  satellites: [],
  velocity: { ...defaultVelocity },
  dop: null,
  antenna: null,
  rawBuffer: [],
  sessionBuffer: [],
  isLogging: false,

  applyGga: (data) => {
    set((s) => ({ fix: { ...s.fix, ...data } }));
  },

  applyRmc: (data) => {
    const { speedKmh, courseTrue, mode, ...fixData } = data as Partial<
      NmeaFix & NmeaVelocity
    >;
    set((s) => ({
      fix: { ...s.fix, ...fixData },
      velocity: {
        ...s.velocity,
        ...(speedKmh !== undefined && { speedKmh }),
        ...(courseTrue !== undefined && { courseTrue }),
        ...(mode !== undefined && { mode }),
      },
    }));
  },

  applyVtg: (data) => {
    set((s) => ({ velocity: { ...s.velocity, ...data } }));
  },

  applyGsa: (data) => {
    set((s) => {
      const usedSet = new Set(data.satellitesUsed);
      const updatedSats = s.satellites.map((sat) => {
        let isMatch = sat.talkerId === data.talkerId;

        if (!isMatch && data.talkerId === "GN" && data.systemId != null) {
          const sysMap: Record<number, string> = {
            1: "GP",
            2: "GL",
            3: "GA",
            4: "GB",
            5: "GQ",
            6: "GI",
          };
          isMatch = sat.talkerId === sysMap[data.systemId];
        }

        return isMatch ? { ...sat, usedInFix: usedSet.has(sat.prn) } : sat;
      });

      return {
        dop: data,
        satellites: updatedSats,
        fix: {
          ...s.fix,
          pdop: data.pdop,
          vdop: data.vdop,
          fixMode: data.fixMode,
          hdop: data.hdop ?? s.fix.hdop,
        },
      };
    });
  },

  applyGsv: (data) => {
    set((s) => {
      const now = Date.now();
      const { talkerId, satellites: newSats } = data;

      const satMap = new Map<string, NmeaSatellite>();
      s.satellites.forEach((sat) => {
        const key = `${sat.talkerId}-${sat.prn}-${sat.signalId ?? 0}`;
        satMap.set(key, sat);
      });

      newSats.forEach((newSat) => {
        const key = `${newSat.talkerId}-${newSat.prn}-${newSat.signalId ?? 0}`;
        const existing = satMap.get(key);

        satMap.set(key, {
          ...newSat,
          usedInFix: existing?.usedInFix ?? false,
          lastSeen: now,
        });
      });

      const filteredSats = Array.from(satMap.values()).filter(
        (sat) => now - sat.lastSeen < SAT_STALE_TIMEOUT_MS,
      );

      return { satellites: filteredSats };
    });
  },

  appendRaw: (line) => {
    set((s) => {
      const raw = [line, ...s.rawBuffer].slice(0, RAW_BUFFER_MAX);
      const session = s.isLogging
        ? [...s.sessionBuffer, line]
        : s.sessionBuffer;
      return { rawBuffer: raw, sessionBuffer: session };
    });
  },

  applyBatch: (sentences, rawLines) => {
    set((s) => {
      let nextFix = { ...s.fix };
      let nextVelocity = { ...s.velocity };
      let nextSats = [...s.satellites];
      let nextDop = s.dop;

      for (const parsed of sentences) {
        switch (parsed.type) {
          case "GGA":
            nextFix = { ...nextFix, ...parsed.data };
            break;
          case "RMC": {
            const { speedKmh, courseTrue, mode, ...fixData } = parsed.data;
            nextFix = { ...nextFix, ...fixData };
            nextVelocity = {
              ...nextVelocity,
              ...(speedKmh !== undefined && { speedKmh }),
              ...(courseTrue !== undefined && { courseTrue }),
              ...(mode !== undefined && { mode }),
            };
            break;
          }
          case "VTG":
            nextVelocity = { ...nextVelocity, ...parsed.data };
            break;
          case "GSA": {
            const usedSet = new Set(parsed.data.satellitesUsed);
            nextSats = nextSats.map((sat) => {
              let isMatch = sat.talkerId === parsed.data.talkerId;
              if (
                !isMatch &&
                parsed.data.talkerId === "GN" &&
                parsed.data.systemId != null
              ) {
                const sysMap: Record<number, string> = {
                  1: "GP",
                  2: "GL",
                  3: "GA",
                  4: "GB",
                  5: "GQ",
                  6: "GI",
                };
                isMatch = sat.talkerId === sysMap[parsed.data.systemId];
              }

              return isMatch
                ? { ...sat, usedInFix: usedSet.has(sat.prn) }
                : sat;
            });
            nextDop = parsed.data;
            nextFix = {
              ...nextFix,
              pdop: parsed.data.pdop,
              vdop: parsed.data.vdop,
              fixMode: parsed.data.fixMode,
              hdop: parsed.data.hdop ?? nextFix.hdop,
            };
            break;
          }
          case "GSV": {
            const { talkerId, satellites: newSats } = parsed.data;
            const now = Date.now();

            const satMap = new Map<string, NmeaSatellite>();
            nextSats.forEach((sat) => {
              const key = `${sat.talkerId}-${sat.prn}-${sat.signalId ?? 0}`;
              satMap.set(key, sat);
            });

            newSats.forEach((ns) => {
              const key = `${ns.talkerId}-${ns.prn}-${ns.signalId ?? 0}`;
              const existing = satMap.get(key);
              satMap.set(key, {
                ...ns,
                usedInFix: existing?.usedInFix ?? false,
                lastSeen: now,
              });
            });

            nextSats = Array.from(satMap.values()).filter(
              (sat) => now - sat.lastSeen < SAT_STALE_TIMEOUT_MS,
            );
            break;
          }
          case "GLL":
            nextFix = { ...nextFix, ...parsed.data };
            break;
          case "ANT":
            set({ antenna: parsed.data });
            break;
        }
      }

      const raw = [...rawLines, ...s.rawBuffer].slice(0, RAW_BUFFER_MAX);
      const session = s.isLogging
        ? [...s.sessionBuffer, ...rawLines]
        : s.sessionBuffer;

      return {
        fix: nextFix,
        velocity: nextVelocity,
        satellites: nextSats,
        dop: nextDop,
        rawBuffer: raw,
        sessionBuffer: session,
      };
    });
  },

  setLogging: (active) => {
    set({ isLogging: active });
  },

  clearSession: () => {
    set({ sessionBuffer: [] });
  },

  clearLiveData: () => {
    set({
      fix: { ...defaultFix },
      satellites: [],
      velocity: { ...defaultVelocity },
      dop: null,
      antenna: null,
    });
  },

  reset: () => {
    set({
      fix: { ...defaultFix },
      satellites: [],
      velocity: { ...defaultVelocity },
      dop: null,
      antenna: null,
      rawBuffer: [],
      sessionBuffer: [],
      isLogging: false,
    });
  },
}));
