import { CONSTELLATION_COLOR, CONSTELLATION_LABEL } from "@/constants/nmea";
import { useAppTheme } from "@/hooks/useAppTheme";
import type { NmeaSatellite } from "@/types/gnss";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface SatelliteBarProps {
  satellite: NmeaSatellite;
}

const SNR_MAX = 50;

export function SatelliteBar({ satellite }: SatelliteBarProps) {
  const { colors } = useAppTheme();

  const { prn, snr, talkerId, usedInFix, elevation } = satellite;
  const color = CONSTELLATION_COLOR[talkerId] ?? colors.iconSecondary;
  const label = CONSTELLATION_LABEL[talkerId] ?? talkerId;
  const snrValue = snr ?? 0;
  const barFill = Math.min(snrValue / SNR_MAX, 1);

  return (
    <View style={styles.row}>
      <View
        style={[
          styles.badge,
          { backgroundColor: color + "33", borderColor: color },
        ]}
      >
        <Text style={[styles.badgeText, { color }]}>{label.slice(0, 3)}</Text>
      </View>

      <Text
        style={[styles.prn, { color: colors.textTertiary }]}
        numberOfLines={1}
      >
        PRN {prn}
      </Text>

      <Text style={[styles.elev, { color: colors.textSecondary }]}>
        {elevation}°
      </Text>

      <View style={[styles.barTrack, { backgroundColor: colors.borderLight }]}>
        <View
          style={[
            styles.barFill,
            {
              width: `${barFill * 100}%`,
              backgroundColor: usedInFix ? color : color + "66",
            },
          ]}
        />
      </View>

      <Text
        style={[
          styles.snrText,
          { color: snr === null ? colors.textTertiary : colors.text },
        ]}
      >
        {snr !== null ? `${snr} dB` : "-"}
      </Text>

      {usedInFix && (
        <View style={[styles.fixDot, { backgroundColor: color }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 5,
  },
  badge: {
    borderRadius: 12,
    borderCurve: "continuous",
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 3,
    minWidth: 40,
    alignItems: "center",
  },
  badgeText: {
    fontSize: 10,
    fontFamily: "Lexend_800ExtraBold",
    letterSpacing: 0.5,
  },
  prn: {
    fontSize: 12,
    width: 60,
    fontFamily: "Lexend_600SemiBold",
    fontVariant: ["tabular-nums"],
  },
  elev: {
    fontSize: 11,
    width: 32,
    textAlign: "right",
    fontFamily: "Lexend_400Regular",
    fontVariant: ["tabular-nums"],
  },
  barTrack: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 5,
  },
  snrText: {
    fontSize: 11,
    width: 48,
    textAlign: "right",
    fontFamily: "Lexend_700Bold",
    fontVariant: ["tabular-nums"],
  },
  fixDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
