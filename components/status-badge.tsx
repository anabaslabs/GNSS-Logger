import {
  CONSTELLATION_LABEL,
  FIX_QUALITY_COLOR,
  FIX_QUALITY_LABEL,
  FixQuality,
} from "@/constants/nmea";
import { useAppTheme } from "@/hooks/useAppTheme";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface StatusBadgeProps {
  quality: FixQuality;
  talkerId?: string | null;
}

export function StatusBadge({ quality, talkerId }: StatusBadgeProps) {
  const { colors } = useAppTheme();

  let label = FIX_QUALITY_LABEL[quality] ?? "Unknown";

  if (quality === FixQuality.GpsFix && talkerId) {
    label = CONSTELLATION_LABEL[talkerId] ?? label;
  }

  const color = FIX_QUALITY_COLOR[quality] ?? colors.iconSecondary;

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: color + "22", borderColor: color },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.label, { color }]}>
        {quality === FixQuality.NoFix ? label : `Fix: ${label}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 24,
    borderCurve: "continuous",
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: "flex-start",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 12,
    fontFamily: "Lexend_800ExtraBold",
    letterSpacing: 0.5,
  },
});
