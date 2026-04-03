import { CONSTELLATION_COLOR, CONSTELLATION_LABEL } from "@/constants/nmea";
import { useAppTheme } from "@/hooks/useAppTheme";
import type { NmeaSatellite } from "@/types/gnss";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface SatelliteBarProps {
  satellite: NmeaSatellite;
}

const SNR_MAX = 50;

const getSnrColor = (snr: number | null, isDark: boolean) => {
  if (snr === null) return "#8E8E93";
  if (snr < 25) return isDark ? "#EF4444" : "#DC2626"; // Red
  if (snr < 35) return isDark ? "#F59E0B" : "#D97706"; // Yellow
  if (snr < 50) return isDark ? "#10B981" : "#059669"; // Green
  return isDark ? "#3B82F6" : "#2563EB"; // Blue
};

export const SatelliteBar = React.memo(({ satellite }: SatelliteBarProps) => {
  const { colors, isDark } = useAppTheme();

  const { prn, snr, talkerId, usedInFix, elevation } = satellite;
  const constellationColor =
    CONSTELLATION_COLOR[talkerId] ?? colors.iconSecondary;
  const label = CONSTELLATION_LABEL[talkerId] ?? talkerId;
  const snrValue = snr ?? 0;
  const barFill = Math.min(snrValue / SNR_MAX, 1);
  const barColor = getSnrColor(snr, isDark);

  return (
    <View style={styles.row}>
      <View style={{ width: 64, alignItems: "center" }}>
        <View
          style={[
            styles.badge,
            {
              backgroundColor: constellationColor + "33",
              borderColor: constellationColor,
            },
          ]}
        >
          <Text style={[styles.badgeText, { color: constellationColor }]}>
            {label}
          </Text>
        </View>
      </View>

      <View style={{ width: 32, alignItems: "center" }}>
        <Text
          style={[styles.prn, { color: colors.textSecondary }]}
          numberOfLines={1}
        >
          {prn}
        </Text>
      </View>

      <View style={{ width: 40, alignItems: "center" }}>
        <Text style={[styles.elev, { color: colors.textSecondary }]}>
          {elevation}°
        </Text>
      </View>

      <View style={{ width: 75, alignItems: "center" }}>
        <View
          style={[styles.barTrack, { backgroundColor: colors.borderLight }]}
        >
          <View
            style={[
              styles.barFill,
              {
                width: `${barFill * 100}%`,
                backgroundColor: usedInFix ? barColor : barColor + "66",
              },
            ]}
          />
        </View>
      </View>

      <View style={styles.statusBox}>
        <Text
          style={[
            styles.snrText,
            {
              color: snr === null ? colors.textTertiary : colors.textSecondary,
            },
          ]}
        >
          {snr !== null ? `${snr} dB` : "-"}
        </Text>
        <View style={styles.dotContainer}>
          {usedInFix && (
            <View
              style={[styles.fixDot, { backgroundColor: constellationColor }]}
            />
          )}
        </View>
      </View>
    </View>
  );
});

SatelliteBar.displayName = "SatelliteBar";

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 5,
  },
  badge: {
    borderRadius: 8,
    borderCurve: "continuous",
    borderWidth: 0.8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    width: 64,
    alignItems: "center",
  },
  badgeText: {
    fontSize: 9,
    fontFamily: "Lexend_600SemiBold",
    letterSpacing: 0.2,
    textTransform: "uppercase",
  },
  prn: {
    fontSize: 13,
    fontFamily: "Lexend_600SemiBold",
    fontVariant: ["tabular-nums"],
  },
  elev: {
    fontSize: 13,
    fontFamily: "Lexend_600SemiBold",
    fontVariant: ["tabular-nums"],
  },
  barTrack: {
    width: 75,
    height: 12,
    borderRadius: 6,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 6,
  },
  statusBox: {
    width: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  dotContainer: {
    position: "absolute",
    right: 0,
    width: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  snrText: {
    fontSize: 13,
    fontFamily: "Lexend_600SemiBold",
    fontVariant: ["tabular-nums"],
  },
  fixDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
});
