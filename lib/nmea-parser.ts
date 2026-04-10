import { FixQuality } from "@/constants/nmea";
import type {
  NmeaDop,
  NmeaFix,
  NmeaParsedSentence,
  NmeaSatellite,
  NmeaVelocity,
} from "@/types/gnss";

function validateChecksum(sentence: string): boolean {
  const starIdx = sentence.lastIndexOf("*");
  if (starIdx === -1) return false;
  const body = sentence.slice(1, starIdx);
  const expectedHex = sentence.slice(starIdx + 1, starIdx + 3);
  let computed = 0;
  for (let i = 0; i < body.length; i++) {
    computed ^= body.charCodeAt(i);
  }
  return computed === parseInt(expectedHex, 16);
}

function parseFloat_(s: string | undefined): number | null {
  if (!s || s.trim() === "") return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function parseInt_(s: string | undefined): number | null {
  if (!s || s.trim() === "") return null;
  const n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}

function dmToDeg(
  dm: string | undefined,
  dir: string | undefined,
): number | null {
  if (!dm || dm.trim() === "") return null;
  const dotIdx = dm.indexOf(".");
  const degLen = dotIdx >= 4 ? dotIdx - 2 : dm.length - 4;
  const deg = parseFloat(dm.slice(0, degLen));
  const min = parseFloat(dm.slice(degLen));
  if (isNaN(deg) || isNaN(min)) return null;
  const decimal = deg + min / 60;
  return dir === "S" || dir === "W" ? -decimal : decimal;
}

function parseGGA(fields: string[], talkerId: string): Partial<NmeaFix> | null {
  if (fields.length < 15) return null;
  return {
    utcTime: fields[1] ?? "",
    latitude: dmToDeg(fields[2], fields[3]),
    longitude: dmToDeg(fields[4], fields[5]),
    quality: (parseInt_(fields[6]) ?? 0) as FixQuality,
    satellitesInUse: parseInt_(fields[7]) ?? 0,
    hdop: parseFloat_(fields[8]),
    altitudeMsl: parseFloat_(fields[9]),
    talkerId,
    updatedAt: Date.now(),
  };
}
function parseRMC(
  fields: string[],
  talkerId: string,
): Partial<NmeaFix & NmeaVelocity> | null {
  if (fields.length < 10) return null;
  const status = fields[2];
  if (status !== "A") {
    const knots = parseFloat_(fields[7]);
    return {
      updatedAt: Date.now(),
      speedKmh: knots !== null ? knots * 1.852 : null,
      courseTrue: parseFloat_(fields[8]),
      talkerId,
    };
  }
  return {
    utcTime: fields[1] ?? "",
    utcDate: fields[9] ?? "",
    latitude: dmToDeg(fields[3], fields[4]),
    longitude: dmToDeg(fields[5], fields[6]),
    speedKmh: (() => {
      const knots = parseFloat_(fields[7]);
      return knots !== null ? knots * 1.852 : null;
    })(),
    courseTrue: parseFloat_(fields[8]),
    talkerId,
    updatedAt: Date.now(),
  };
}

function parseVTG(fields: string[]): NmeaVelocity | null {
  if (fields.length < 9) return null;
  return {
    courseTrue: parseFloat_(fields[1]),
    speedKmh: parseFloat_(fields[7]),
    mode: fields[9] ?? "N",
  };
}

function parseGSA(fields: string[], talkerId: string): NmeaDop | null {
  if (fields.length < 18) return null;
  const fixMode = parseInt_(fields[2]) as 1 | 2 | 3 | null;
  const satsUsed: number[] = [];
  for (let i = 3; i <= 14; i++) {
    const prn = parseInt_(fields[i]);
    if (prn !== null && prn > 0) satsUsed.push(prn);
  }
  return {
    fixMode: fixMode ?? 1,
    satellitesUsed: satsUsed,
    pdop: parseFloat_(fields[15]),
    hdop: parseFloat_(fields[16]),
    vdop: parseFloat_(fields[17]),
    talkerId,
  };
}

function parseGSV(
  fields: string[],
  talkerId: string,
): { talkerId: string; satellites: NmeaSatellite[] } | null {
  if (fields.length < 8) return null;

  const satellites: NmeaSatellite[] = [];
  const dataFieldsCount = fields.length - 4;
  let blockSize = 4;

  if (dataFieldsCount > 0) {
    if (dataFieldsCount % 5 === 0) blockSize = 5;
    else if (dataFieldsCount % 4 === 0) blockSize = 4;
    else if (dataFieldsCount > 4 && dataFieldsCount % 5 < dataFieldsCount % 4)
      blockSize = 5;
  }

  for (let i = 4; i + 3 < fields.length; i += blockSize) {
    const prn = parseInt_(fields[i]);
    if (prn === null || prn === 0) continue;
    satellites.push({
      prn,
      elevation: parseInt_(fields[i + 1]),
      azimuth: parseInt_(fields[i + 2]),
      snr: parseInt_(fields[i + 3]),
      talkerId,
      usedInFix: false,
    });
  }
  return { talkerId, satellites };
}

function parseGLL(fields: string[], talkerId: string): Partial<NmeaFix> | null {
  if (fields.length < 6) return null;
  const status = fields[6];
  if (status && status !== "A") return null;
  return {
    latitude: dmToDeg(fields[1], fields[2]),
    longitude: dmToDeg(fields[3], fields[4]),
    utcTime: fields[5] ?? "",
    talkerId,
    updatedAt: Date.now(),
  };
}

function parsePAIR066(fields: string[]): {
  gps: boolean;
  glonass: boolean;
  galileo: boolean;
  beidou: boolean;
  qzss: boolean;
  navic: boolean;
  beidou_b1c: boolean;
} | null {
  if (fields.length === 2) {
    const mask = parseInt(fields[1], 10);
    if (isNaN(mask)) return null;
    return {
      gps: !!(mask & 0x01),
      glonass: !!(mask & 0x02),
      galileo: !!(mask & 0x04),
      beidou: !!(mask & 0x08),
      qzss: !!(mask & 0x10),
      navic: !!(mask & 0x20),
      beidou_b1c: !!(mask & 0x40),
    };
  }

  if (fields.length < 7) return null;
  return {
    gps: fields[1] === "1",
    glonass: fields[2] === "1",
    galileo: fields[3] === "1",
    beidou: fields[4] === "1",
    qzss: fields[5] === "1",
    navic: fields[6] === "1",
    beidou_b1c: fields[7] === "1",
  };
}

export function parseNmea(raw: string): NmeaParsedSentence | null {
  const sentence = raw.trim();
  if (!sentence.startsWith("$")) return null;

  if (sentence.includes("*") && !validateChecksum(sentence)) return null;

  const starIdx = sentence.lastIndexOf("*");
  const body = starIdx !== -1 ? sentence.slice(1, starIdx) : sentence.slice(1);
  const fields = body.split(",");
  const sentenceId = fields[0];

  if (!sentenceId || sentenceId.length < 5) return null;

  const talkerId = sentenceId.slice(0, 2);
  const type = sentenceId.slice(2);

  switch (type) {
    case "GGA": {
      const data = parseGGA(fields, talkerId);
      return data ? { type: "GGA", data } : null;
    }
    case "RMC": {
      const data = parseRMC(fields, talkerId);
      return data ? { type: "RMC", data } : null;
    }
    case "VTG": {
      const data = parseVTG(fields);
      return data ? { type: "VTG", data } : null;
    }
    case "GSA": {
      const data = parseGSA(fields, talkerId);
      return data ? { type: "GSA", data } : null;
    }
    case "GSV": {
      const data = parseGSV(fields, talkerId);
      return data ? { type: "GSV", data } : null;
    }
    case "GLL": {
      const data = parseGLL(fields, talkerId);
      return data ? { type: "GLL", data } : null;
    }
    case "TMVERNO": {
      return { type: "VER", raw: sentence };
    }
    case "IR001": {
      const cmdId = fields[1];
      const result = parseInt_(fields[2]);
      return { type: "ACK", data: { cmdId, result }, raw: sentence };
    }
    case "IR066": {
      const data = parsePAIR066(fields);
      return data ? { type: "PAIR66", data, raw: sentence } : null;
    }
    default:
      return { type: "UNKNOWN", raw: sentence };
  }
}

export function formatCoord(value: number | null, axis: "lat" | "lon"): string {
  if (value === null) return "-";
  const dir =
    axis === "lat" ? (value >= 0 ? "N" : "S") : value >= 0 ? "E" : "W";
  const absVal = Math.abs(value);
  const degrees = Math.floor(absVal);
  const minutesFloat = (absVal - degrees) * 60;
  const minutes = Math.floor(minutesFloat);
  const seconds = (minutesFloat - minutes) * 60;
  return `${degrees}° ${String(minutes).padStart(2, "0")}' ${seconds.toFixed(2)}" ${dir}`;
}

export function getUtcValue(utcTime: string | undefined): string {
  if (!utcTime || utcTime.length < 6) return "-";
  return `${utcTime.slice(0, 2)}:${utcTime.slice(2, 4)}:${utcTime.slice(4, 6)}`;
}

export function getIstValue(utcTime: string | undefined): string {
  if (!utcTime || utcTime.length < 6) return "-";

  const hh = parseInt(utcTime.slice(0, 2), 10);
  const mm = parseInt(utcTime.slice(2, 4), 10);
  const ss = parseInt(utcTime.slice(4, 6), 10);

  let istH = hh + 5;
  let istM = mm + 30;
  const istS = ss;

  if (istM >= 60) {
    istM -= 60;
    istH += 1;
  }
  if (istH >= 24) {
    istH -= 24;
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(istH)}:${pad(istM)}:${pad(istS)}`;
}

export function generateNmeaCommand(payload: string): string {
  let checksum = 0;
  for (let i = 0; i < payload.length; i++) {
    checksum ^= payload.charCodeAt(i);
  }
  const checksumHex = checksum.toString(16).toUpperCase().padStart(2, "0");
  return `$${payload}*${checksumHex}\r\n`;
}
