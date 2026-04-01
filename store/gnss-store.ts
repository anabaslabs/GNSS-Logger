import { FixQuality } from "@/constants/nmea";
import type {
  NmeaDop,
  NmeaFix,
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
  setLogging: (active: boolean) => void;
  clearSession: () => void;
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
  altitudeMsl: null,
  geoidSeparation: null,
  dgpsAge: null,
  updatedAt: 0,
};

const defaultVelocity: NmeaVelocity = {
  speedKmh: null,
  speedKnots: null,
  courseTrue: null,
  courseMagnetic: null,
  mode: "N",
};

export const useGnssStore = create<GnssState & GnssActions>((set, get) => ({
  fix: { ...defaultFix },
  satellites: [],
  velocity: { ...defaultVelocity },
  dop: null,
  rawBuffer: [],
  sessionBuffer: [],
  isLogging: false,

  applyGga: (data) => {
    set((s) => ({ fix: { ...s.fix, ...data } }));
  },

  applyRmc: (data) => {
    const {
      speedKmh,
      speedKnots,
      courseTrue,
      courseMagnetic,
      mode,
      ...fixData
    } = data as Partial<NmeaFix & NmeaVelocity>;
    set((s) => ({
      fix: { ...s.fix, ...fixData },
      velocity: {
        ...s.velocity,
        ...(speedKnots !== undefined && { speedKnots }),
        ...(speedKmh !== undefined && { speedKmh }),
        ...(courseTrue !== undefined && { courseTrue }),
        ...(courseMagnetic !== undefined && { courseMagnetic }),
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
      return { dop: data, satellites: updatedSats };
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

  setLogging: (active) => {
    set({ isLogging: active });
  },

  clearSession: () => {
    set({ sessionBuffer: [] });
  },

  reset: () => {
    set({
      fix: { ...defaultFix },
      satellites: [],
      velocity: { ...defaultVelocity },
      dop: null,
      rawBuffer: [],
      sessionBuffer: [],
      isLogging: false,
    });
  },
}));
