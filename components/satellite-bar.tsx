import {
  CONSTELLATION_COLOR,
  CONSTELLATION_LABEL,
  getBandLabel,
} from "@/constants/nmea";
import { useAppTheme } from "@/hooks/useAppTheme";
import type { NmeaSatellite } from "@/types/gnss";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface SatelliteBarProps {
  satellite: NmeaSatellite;
}

const getSnrColor = (snr: number | null, isDark: boolean) => {
  if (snr === null) return "#8E8E93";
  if (snr < 25) return isDark ? "#EF4444" : "#DC2626";
  if (snr < 35) return isDark ? "#F59E0B" : "#D97706";
  if (snr < 45) return isDark ? "#10B981" : "#059669";
  return isDark ? "#3B82F6" : "#2563EB";
};

export const SatelliteBar = React.memo(({ satellite }: SatelliteBarProps) => {
  const { colors, isDark } = useAppTheme();

  const { prn, snr, talkerId, usedInFix, elevation, signalId, azimuth } =
    satellite;
  const constellationColor =
    CONSTELLATION_COLOR[talkerId] ?? colors.iconSecondary;
  const label = CONSTELLATION_LABEL[talkerId] ?? talkerId;
  const barColor = getSnrColor(snr, isDark);
  const band = getBandLabel(talkerId, signalId);

  return (
    <View style={styles.row}>
      <View style={{ width: 64, alignItems: "center" }}>
        <View
          style={[
            styles.badge,
            {
              backgroundColor: constellationColor + "15",
              borderColor: constellationColor + "44",
            },
          ]}
        >
          <Text style={[styles.badgeText, { color: constellationColor }]}>
            {label}
          </Text>
        </View>
      </View>

      <View style={{ width: 44, alignItems: "center" }}>
        {band ? (
          <View
            style={[styles.bandBadge, { backgroundColor: colors.borderLight }]}
          >
            <Text style={[styles.bandLabel, { color: colors.textSecondary }]}>
              {band}
            </Text>
          </View>
        ) : (
          <Text style={{ color: colors.textTertiary }}>-</Text>
        )}
      </View>

      <View style={{ width: 32, alignItems: "center", marginLeft: 10 }}>
        <Text
          style={[styles.prn, { color: colors.textSecondary }]}
          numberOfLines={1}
        >
          {prn}
        </Text>
      </View>

      <View style={{ width: 40, alignItems: "center" }}>
        <Text style={[styles.elev, { color: colors.textTertiary }]}>
          {elevation !== null ? `${elevation}°` : "-"}
        </Text>
      </View>

      <View style={{ width: 40, alignItems: "center" }}>
        <Text style={[styles.elev, { color: colors.textTertiary }]}>
          {azimuth !== null ? `${azimuth}°` : "-"}
        </Text>
      </View>

      <View style={{ width: 75, alignItems: "center" }}>
        <View style={styles.snrContainer}>
          <Text
            style={[
              styles.snrText,
              {
                color: snr === null ? colors.textTertiary : barColor,
              },
            ]}
          >
            {snr !== null ? snr : "-"}
          </Text>
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
    paddingVertical: 8,
  },
  badge: {
    borderRadius: 8,
    borderCurve: "continuous",
    borderWidth: 0.8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    width: 60,
    alignItems: "center",
  },
  badgeText: {
    fontSize: 9,
    fontFamily: "Lexend_700Bold",
    letterSpacing: 0.2,
    textTransform: "uppercase",
  },
  bandBadge: {
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
  },
  bandLabel: {
    fontSize: 9,
    fontFamily: "Lexend_800ExtraBold",
  },
  prn: {
    fontSize: 13,
    fontFamily: "Lexend_600SemiBold",
    fontVariant: ["tabular-nums"],
  },
  elev: {
    fontSize: 13,
    fontFamily: "Lexend_500Medium",
    fontVariant: ["tabular-nums"],
  },
  snrContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },
  snrText: {
    fontSize: 13,
    fontFamily: "Lexend_600SemiBold",
    fontVariant: ["tabular-nums"],
    textAlign: "right",
  },
  fixDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
