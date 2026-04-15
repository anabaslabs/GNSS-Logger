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
  applyGsv: (talkerId: string, satellites: NmeaSatellite[]) => void;
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
      const updatedSats = s.satellites.map((sat) =>
        sat.talkerId === data.talkerId || data.talkerId === "GN"
          ? { ...sat, usedInFix: usedSet.has(sat.prn) }
          : sat,
      );
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

  applyGsv: (talkerId, newSats) => {
    set((s) => {
      const otherSats = s.satellites.filter((sat) => sat.talkerId !== talkerId);
      return { satellites: [...otherSats, ...newSats] };
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
            nextSats = nextSats.map((sat) =>
              sat.talkerId === parsed.data.talkerId ||
              parsed.data.talkerId === "GN"
                ? { ...sat, usedInFix: usedSet.has(sat.prn) }
                : sat,
            );
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
            const talkerId = parsed.data.talkerId;
            const newSats = parsed.data.satellites;
            const otherSats = nextSats.filter(
              (sat) => sat.talkerId !== talkerId,
            );
            nextSats = [...otherSats, ...newSats];
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
