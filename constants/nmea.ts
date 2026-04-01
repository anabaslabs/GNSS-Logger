/** NMEA Talker IDs */
export const TALKER_ID = {
  GPS: "GP",
  GLONASS: "GL",
  GALILEO: "GA",
  BEIDOU: "GB",
  NAVIC: "GI",
  QZSS: "GQ",
  MULTI: "GN",
} as const;

export type TalkerId = (typeof TALKER_ID)[keyof typeof TALKER_ID];

/** Human-readable constellation labels */
export const CONSTELLATION_LABEL: Record<string, string> = {
  GP: "GPS",
  GL: "GLONASS",
  GA: "Galileo",
  GB: "BeiDou",
  GI: "NavIC",
  GQ: "QZSS",
  GN: "Multi",
};

/** Constellation colours for UI */
export const CONSTELLATION_COLOR: Record<string, string> = {
  GP: "#3B82F6",
  GL: "#8B5CF6",
  GA: "#10B981",
  GB: "#F59E0B",
  GI: "#F97316",
  GQ: "#EC4899",
  GN: "#6B7280",
};

/** NMEA Fix Quality (GGA quality indicator) */
export enum FixQuality {
  NoFix = 0,
  GpsFix = 1,
  DgpsFix = 2,
  PpsFix = 3,
  RtkFix = 4,
  FloatRtk = 5,
  Estimated = 6,
  Manual = 7,
  Simulation = 8,
}

export const FIX_QUALITY_LABEL: Record<FixQuality, string> = {
  [FixQuality.NoFix]: "No Fix",
  [FixQuality.GpsFix]: "GPS",
  [FixQuality.DgpsFix]: "DGPS",
  [FixQuality.PpsFix]: "PPS",
  [FixQuality.RtkFix]: "RTK",
  [FixQuality.FloatRtk]: "Float RTK",
  [FixQuality.Estimated]: "Estimated",
  [FixQuality.Manual]: "Manual",
  [FixQuality.Simulation]: "Simulation",
};

export const FIX_QUALITY_COLOR: Record<FixQuality, string> = {
  [FixQuality.NoFix]: "#EF4444",
  [FixQuality.GpsFix]: "#22C55E",
  [FixQuality.DgpsFix]: "#3B82F6",
  [FixQuality.PpsFix]: "#8B5CF6",
  [FixQuality.RtkFix]: "#F59E0B",
  [FixQuality.FloatRtk]: "#F97316",
  [FixQuality.Estimated]: "#6B7280",
  [FixQuality.Manual]: "#6B7280",
  [FixQuality.Simulation]: "#6B7280",
};
