import { CONSTELLATION_COLOR, CONSTELLATION_LABEL } from "@/constants/nmea";
import { useAppTheme } from "@/hooks/useAppTheme";
import type { NmeaSatellite } from "@/types/gnss";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface SatelliteBarProps {
  satellite: NmeaSatellite;
}

const SNR_MAX = 50;

export const SatelliteBar = React.memo(({ satellite }: SatelliteBarProps) => {
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

      <View style={{ width: 26, alignItems: "center" }}>
        <Text
          style={[styles.prn, { color: colors.textTertiary }]}
          numberOfLines={1}
        >
          {prn}
        </Text>
      </View>

      <View style={{ width: 36, alignItems: "center" }}>
        <Text style={[styles.elev, { color: colors.textSecondary }]}>
          {elevation}°
        </Text>
      </View>

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

      <View style={styles.statusBox}>
        <Text
          style={[
            styles.snrText,
            { color: snr === null ? colors.textTertiary : colors.text },
          ]}
        >
          {snr !== null ? `${snr} dB` : "-"}
        </Text>
        <View style={styles.dotContainer}>
          {usedInFix && (
            <View style={[styles.fixDot, { backgroundColor: color }]} />
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
    borderRadius: 12,
    borderCurve: "continuous",
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 3,
    width: 40,
    alignItems: "center",
  },
  badgeText: {
    fontSize: 10,
    fontFamily: "Lexend_800ExtraBold",
    letterSpacing: 0.5,
  },
  prn: {
    fontSize: 12,
    fontFamily: "Lexend_600SemiBold",
    fontVariant: ["tabular-nums"],
  },
  elevContainer: {
    width: 36,
    alignItems: "center",
  },
  elev: {
    fontSize: 11,
    fontFamily: "Lexend_400Regular",
    fontVariant: ["tabular-nums"],
  },
  barTrack: {
    width: 90,
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 5,
  },
  statusBox: {
    width: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  dotContainer: {
    width: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  snrText: {
    fontSize: 11,
    fontFamily: "Lexend_700Bold",
    fontVariant: ["tabular-nums"],
  },
  fixDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
