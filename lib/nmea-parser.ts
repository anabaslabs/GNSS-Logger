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
  // fields[0] = sentence id, fields[1..] = data
  if (fields.length < 15) return null;
  return {
    utcTime: fields[1] ?? "",
    latitude: dmToDeg(fields[2], fields[3]),
    longitude: dmToDeg(fields[4], fields[5]),
    quality: (parseInt_(fields[6]) ?? 0) as FixQuality,
    satellitesInUse: parseInt_(fields[7]) ?? 0,
    hdop: parseFloat_(fields[8]),
    altitudeMsl: parseFloat_(fields[9]),
    geoidSeparation: parseFloat_(fields[11]),
    dgpsAge: parseFloat_(fields[13]),
    updatedAt: Date.now(),
  };
}

function parseRMC(fields: string[]): Partial<NmeaFix & NmeaVelocity> | null {
  if (fields.length < 10) return null;
  const status = fields[2];
  if (status !== "A") {
    return {
      updatedAt: Date.now(),
      speedKnots: parseFloat_(fields[7]),
      courseTrue: parseFloat_(fields[8]),
    };
  }
  return {
    utcTime: fields[1] ?? "",
    utcDate: fields[9] ?? "",
    latitude: dmToDeg(fields[3], fields[4]),
    longitude: dmToDeg(fields[5], fields[6]),
    speedKnots: parseFloat_(fields[7]),
    courseTrue: parseFloat_(fields[8]),
    updatedAt: Date.now(),
  };
}

function parseVTG(fields: string[]): NmeaVelocity | null {
  if (fields.length < 9) return null;
  return {
    courseTrue: parseFloat_(fields[1]),
    courseMagnetic: parseFloat_(fields[3]),
    speedKnots: parseFloat_(fields[5]),
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

  for (let i = 4; i + 2 < fields.length; i += 4) {
    const prn = parseInt_(fields[i]);
    if (prn === null || prn === 0) continue;
    satellites.push({
      prn,
      elevation: parseInt_(fields[i + 1]) ?? 0,
      azimuth: parseInt_(fields[i + 2]) ?? 0,
      snr: parseInt_(fields[i + 3]),
      talkerId,
      usedInFix: false,
    });
  }
  return { talkerId, satellites };
}

function parseGLL(fields: string[]): Partial<NmeaFix> | null {
  if (fields.length < 6) return null;
  const status = fields[6];
  if (status && status !== "A") return null;
  return {
    latitude: dmToDeg(fields[1], fields[2]),
    longitude: dmToDeg(fields[3], fields[4]),
    utcTime: fields[5] ?? "",
    updatedAt: Date.now(),
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
      const data = parseRMC(fields);
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
      const data = parseGLL(fields);
      return data ? { type: "GLL", data } : null;
    }
    default:
      return { type: "UNKNOWN", raw: sentence };
  }
}

export function parseNmeaBuffer(buffer: string): NmeaParsedSentence[] {
  return buffer
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("$"))
    .map((line) => parseNmea(line))
    .filter((r): r is NmeaParsedSentence => r !== null);
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

export function formatNmeaTime(utcTime: string | undefined): string {
  if (!utcTime || utcTime.length < 6) return "-";
  return `${utcTime.slice(0, 2)}:${utcTime.slice(2, 4)}:${utcTime.slice(4, 6)} UTC`;
}
