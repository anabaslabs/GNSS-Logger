import { FixQuality } from "@/constants/nmea";

/** Parsed GNSS fix from GGA + RMC sentences */
export interface NmeaFix {
  /** UTC time as HHmmss.ss string */
  utcTime: string;
  /** UTC date as DDMMYY string (from RMC) */
  utcDate: string;
  /** Latitude in decimal degrees, positive = North */
  latitude: number | null;
  /** Longitude in decimal degrees, positive = East */
  longitude: number | null;
  /** Fix quality indicator */
  quality: FixQuality;
  /** Number of satellites in use */
  satellitesInUse: number;
  /** Horizontal dilution of precision */
  hdop: number | null;
  /** Altitude above mean sea level (m) */
  altitudeMsl: number | null;
  /** Talker ID of the sentence that provided the fix */
  talkerId: string | null;
  /** Timestamp of last update */
  updatedAt: number;
}

/** Per-satellite info from GSV sentences */
export interface NmeaSatellite {
  /** Satellite PRN / ID number */
  prn: number;
  /** Elevation in degrees (0–90) */
  elevation: number;
  /** Azimuth in degrees (0–359) */
  azimuth: number;
  /** Signal/Noise Ratio in C/N₀ (dB-Hz), null if not tracking */
  snr: number | null;
  /** Talker/constellation ID */
  talkerId: string;
  /** Whether this satellite is in fix (from GSA) */
  usedInFix: boolean;
}

/** Velocity data from VTG and RMC sentences */
export interface NmeaVelocity {
  /** Speed over ground in km/h */
  speedKmh: number | null;
  /** Course over ground, true north (degrees) */
  courseTrue: number | null;
  /** Mode indicator (A=Autonomous, D=Differential, E=Estimated, N=None) */
  mode: string;
}

/** GSA-derived DOP and fix mode */
export interface NmeaDop {
  /** 1=No fix, 2=2D, 3=3D */
  fixMode: 1 | 2 | 3;
  /** PRNs of satellites used in fix */
  satellitesUsed: number[];
  /** Position DOP */
  pdop: number | null;
  /** Horizontal DOP */
  hdop: number | null;
  /** Vertical DOP */
  vdop: number | null;
  /** Talker ID (constellation) */
  talkerId: string;
}

/** Full parsed NMEA result from a single sentence */
export type NmeaParsedSentence =
  | { type: "GGA"; data: Partial<NmeaFix> }
  | { type: "RMC"; data: Partial<NmeaFix & NmeaVelocity> }
  | { type: "VTG"; data: NmeaVelocity }
  | { type: "GSA"; data: NmeaDop }
  | { type: "GSV"; data: { talkerId: string; satellites: NmeaSatellite[] } }
  | { type: "GLL"; data: Partial<NmeaFix> }
  | { type: "ACK"; data: { cmdId: string; result: number | null }; raw: string }
  | {
      type: "PAIR66";
      data: {
        gps: boolean;
        glonass: boolean;
        galileo: boolean;
        beidou: boolean;
        qzss: boolean;
        navic: boolean;
        beidou_b1c: boolean;
      };
      raw: string;
    }
  | { type: "VER"; raw: string }
  | { type: "UNKNOWN"; raw: string };

/** BLE device scan result */
export interface BleDevice {
  id: string;
  name: string | null;
  rssi: number;
  advertising?: Record<string, unknown>;
}

/** GNSS log session */
export interface LogSession {
  id: string;
  startTime: number;
  endTime: number | null;
  fixCount: number;
  filePath: string;
  filePathCsv: string;
}
