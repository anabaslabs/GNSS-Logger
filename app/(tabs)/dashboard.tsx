import { ConnectionBanner } from "@/components/connection-banner";
import {
  CONSTELLATION_COLOR,
  CONSTELLATION_LABEL,
  FIX_QUALITY_LABEL,
} from "@/constants/nmea";
import { useAppTheme } from "@/hooks/useAppTheme";
import { formatCoord, getIstValue, getUtcValue } from "@/lib/nmea-parser";
import { useBleStore } from "@/store/ble-store";
import { useGnssStore } from "@/store/gnss-store";
import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

export default function DashboardScreen() {
  const { colors, isDark } = useAppTheme();
  const { fix, velocity, satellites, antenna } = useGnssStore();
  const { status: bleStatus } = useBleStore();
  const isConnected = bleStatus === "connected";
  const hasTime = fix.utcTime !== "";
  const hasFix = fix.fixMode !== null && fix.fixMode > 1;

  const fixStatus = useMemo(() => {
    if (fix.fixMode === 3) return "3D";
    if (fix.fixMode === 2) return "2D";
    if (hasTime) return "PENDING";
    return "-";
  }, [fix.fixMode, hasTime]);

  const fixColor = useMemo(() => {
    if (fix.fixMode === 3) return colors.success;
    if (fix.fixMode === 2) return colors.warning;
    if (hasTime) return colors.warning;
    return colors.textTertiary;
  }, [fix.fixMode, hasTime, colors]);

  const constellationData = useMemo(() => {
    const counts: Record<string, number> = {};
    const visibleIds = new Set<string>();

    for (const sat of satellites) {
      visibleIds.add(sat.talkerId);
      if (sat.usedInFix) {
        counts[sat.talkerId] = (counts[sat.talkerId] ?? 0) + 1;
      }
    }

    return Array.from(visibleIds)
      .map((id) => ({
        id,
        label: CONSTELLATION_LABEL[id] ?? id,
        count: counts[id] ?? 0,
      }))
      .sort((a, b) => b.label.localeCompare(a.label));
  }, [satellites]);

  const speedKmh = velocity.speedKmh ?? 0;
  const heading = velocity.courseTrue;

  return (
    <ScrollView
      key={isDark ? "dark" : "light"}
      contentInsetAdjustmentBehavior="automatic"
      scrollEventThrottle={16}
      style={[styles.scroll, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.container, { paddingBottom: 40 }]}
    >
      <ConnectionBanner />

      <View
        style={[
          styles.section,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={styles.statusGrid}>
          <View style={styles.gridItem}>
            <Text style={[styles.gridLabel, { color: colors.textTertiary }]}>
              ANTENNA POWER
            </Text>
            <Text
              style={[
                styles.gridValue,
                {
                  color:
                    isConnected && antenna?.power
                      ? colors.success
                      : colors.textTertiary,
                },
              ]}
            >
              {isConnected ? (antenna?.power ? "ON" : "OFF") : "-"}
            </Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={[styles.gridLabel, { color: colors.textTertiary }]}>
              ANTENNA STATUS
            </Text>
            <Text
              style={[
                styles.gridValue,
                {
                  color:
                    isConnected && antenna?.status === "Normal"
                      ? colors.success
                      : isConnected && antenna
                        ? colors.error
                        : colors.textTertiary,
                },
              ]}
            >
              {isConnected && antenna ? antenna.status.toUpperCase() : "-"}
            </Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={[styles.gridLabel, { color: colors.textTertiary }]}>
              FIX MODE
            </Text>
            <Text
              style={[
                styles.gridValue,
                { color: isConnected ? fixColor : colors.textTertiary },
              ]}
            >
              {isConnected ? fixStatus : "-"}
            </Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={[styles.gridLabel, { color: colors.textTertiary }]}>
              FIX QUALITY
            </Text>
            <Text
              style={[
                styles.gridValue,
                { color: isConnected ? colors.text : colors.textTertiary },
              ]}
            >
              {isConnected ? FIX_QUALITY_LABEL[fix.quality] || "-" : "-"}
            </Text>
          </View>
        </View>

        <View style={styles.coordRow}>
          <View style={styles.coordItem}>
            <Text style={[styles.coordLabel, { color: colors.textTertiary }]}>
              LATITUDE
            </Text>
            <Text
              style={[
                styles.coordValue,
                { color: isConnected ? colors.text : colors.textTertiary },
              ]}
              selectable
            >
              {isConnected ? formatCoord(fix.latitude, "lat") : "-"}
            </Text>
          </View>
          <View style={styles.coordItem}>
            <Text style={[styles.coordLabel, { color: colors.textTertiary }]}>
              LONGITUDE
            </Text>
            <Text
              style={[
                styles.coordValue,
                { color: isConnected ? colors.text : colors.textTertiary },
              ]}
              selectable
            >
              {isConnected ? formatCoord(fix.longitude, "lon") : "-"}
            </Text>
          </View>
        </View>
        <View style={styles.timeRow}>
          <Text style={[styles.timeText, { color: colors.textSecondary }]}>
            IST: {isConnected ? getIstValue(fix.utcTime) : "--:--:--"}
          </Text>
          <Text style={[styles.timeText, { color: colors.textSecondary }]}>
            UTC: {isConnected ? getUtcValue(fix.utcTime) : "--:--:--"}
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.section,
          {
            backgroundColor: colors.surface,
            borderColor: "#38BDF822",
            paddingBottom: 24,
          },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: "#38BDF8" }]}>
          Movement
        </Text>
        <View style={styles.metricRow}>
          <View style={styles.metricItem}>
            <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>
              SPEED
            </Text>
            <View style={styles.metricValueContainer}>
              <Text style={[styles.metricValue, { color: colors.text }]}>
                {hasFix ? speedKmh.toFixed(1) : "-"}
              </Text>
              <Text
                style={[styles.metricUnit, { color: colors.textSecondary }]}
              >
                km/h
              </Text>
            </View>
          </View>
          <View style={styles.metricItem}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text
                style={[styles.metricLabel, { color: colors.textTertiary }]}
              >
                HEADING
              </Text>
              {heading !== null && (
                <View
                  style={[styles.statusBadge, { backgroundColor: "#38BDF815" }]}
                >
                  <Text style={[styles.statusText, { color: "#38BDF8" }]}>
                    {compassPoint(heading)}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.metricValueContainer}>
              <Text style={[styles.metricValue, { color: colors.text }]}>
                {heading !== null ? heading.toFixed(1) : "-"}
              </Text>
              <Text
                style={[styles.metricUnit, { color: colors.textSecondary }]}
              >
                °
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View
        style={[
          styles.section,
          {
            backgroundColor: colors.surface,
            borderColor: "#6366F133",
            paddingBottom: 24,
          },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: "#6366F1" }]}>
          Altitude Metrics
        </Text>
        <View style={styles.metricRow}>
          <View style={styles.metricItem}>
            <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>
              MSL ALTITUDE
            </Text>
            <View style={styles.metricValueContainer}>
              <Text style={[styles.metricValue, { color: colors.text }]}>
                {fix.altitudeMsl !== null ? fix.altitudeMsl.toFixed(1) : "-"}
              </Text>
              <Text
                style={[styles.metricUnit, { color: colors.textSecondary }]}
              >
                m
              </Text>
            </View>
          </View>
          <View style={styles.metricItem}>
            <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>
              GEOIDAL SEPARATION
            </Text>
            <View style={styles.metricValueContainer}>
              <Text style={[styles.metricValue, { color: colors.text }]}>
                {fix.geoidalSeparation !== null
                  ? fix.geoidalSeparation.toFixed(1)
                  : "-"}
              </Text>
              <Text
                style={[styles.metricUnit, { color: colors.textSecondary }]}
              >
                m
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View
        style={[
          styles.section,
          {
            backgroundColor: colors.surface,
            borderColor: "#10B98133",
            paddingBottom: 24,
          },
        ]}
      >
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: "#10B981" }]}>
            Dilution of Precision
          </Text>
          {fix.pdop !== null && (
            <View
              style={[styles.statusBadge, { backgroundColor: "#10B98115" }]}
            >
              <Text style={[styles.statusText, { color: "#10B981" }]}>
                {hdopQuality(fix.pdop)}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.metricRow}>
          <View style={[styles.metricItem, { flex: 1 }]}>
            <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>
              PDOP
            </Text>
            <Text style={[styles.metricValue, { color: colors.text }]}>
              {fix.pdop !== null ? fix.pdop.toFixed(2) : "-"}
            </Text>
          </View>
          <View style={[styles.metricItem, { flex: 1 }]}>
            <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>
              HDOP
            </Text>
            <Text style={[styles.metricValue, { color: colors.text }]}>
              {fix.hdop !== null ? fix.hdop.toFixed(2) : "-"}
            </Text>
          </View>
          <View style={[styles.metricItem, { flex: 1 }]}>
            <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>
              VDOP
            </Text>
            <Text style={[styles.metricValue, { color: colors.text }]}>
              {fix.vdop !== null ? fix.vdop.toFixed(2) : "-"}
            </Text>
          </View>
        </View>
      </View>

      <View
        style={[
          styles.section,
          {
            backgroundColor: colors.surface,
            borderColor: "#F43F5E22",
          },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: "#F43F5E" }]}>
          Constellations In Fix
        </Text>

        <View style={styles.constellationRow}>
          {Array.from({ length: 6 }).map((_, index) => {
            const item = constellationData[index];
            const isPlaceholder = !item;
            const id = !isPlaceholder ? item.id : "";
            const label = !isPlaceholder ? item.label : "-";
            const count = !isPlaceholder ? item.count : 0;
            const color = !isPlaceholder
              ? (CONSTELLATION_COLOR[id] ?? colors.textTertiary)
              : colors.textTertiary;

            return (
              <View
                key={isPlaceholder ? `placeholder-${index}` : id}
                style={[
                  styles.constBadge,
                  {
                    backgroundColor: isPlaceholder
                      ? colors.textTertiary + "10"
                      : color + "15",
                    borderColor: isPlaceholder
                      ? colors.border + "33"
                      : color + "33",
                    opacity: !isPlaceholder && count > 0 ? 1 : 0.4,
                  },
                ]}
              >
                <View style={[styles.constDot, { backgroundColor: color }]} />
                <Text
                  style={[
                    styles.constLabel,
                    { color: color, marginTop: -4 },
                    isPlaceholder && {
                      fontSize: 20,
                      marginTop: -4,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
                <View style={{ flex: 1 }} />
                <Text style={[styles.constCount, { color: colors.text }]}>
                  {isConnected ? count : "-"}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

function hdopQuality(hdop: number): string {
  if (hdop <= 1) return "Ideal";
  if (hdop <= 2) return "Excellent";
  if (hdop <= 5) return "Good";
  if (hdop <= 10) return "Moderate";
  if (hdop <= 20) return "Fair";
  return "Poor";
}

function compassPoint(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8] ?? "N";
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  container: { padding: 16, paddingBottom: 40, gap: 16 },
  section: {
    borderRadius: 32,
    borderCurve: "continuous",
    borderWidth: 1,
    padding: 20,
    gap: 16,
  } as any,
  statusGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 8,
  },
  gridItem: {
    width: "47%",
    gap: 2,
  },
  gridLabel: {
    fontSize: 10,
    fontFamily: "Lexend_700Bold",
    letterSpacing: 0.5,
  },
  gridValue: {
    fontSize: 16,
    fontFamily: "Lexend_600SemiBold",
    textTransform: "uppercase",
  },
  coordRow: {
    gap: 12,
  },
  coordItem: {
    flex: 1,
  },
  coordLabel: {
    fontSize: 10,
    fontFamily: "Lexend_700Bold",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  coordValue: {
    fontSize: 24,
    fontFamily: "Lexend_600SemiBold",
    fontVariant: ["tabular-nums"],
    letterSpacing: -1,
    marginTop: 2,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  timeText: {
    fontSize: 14,
    fontFamily: "Lexend_500Medium",
    fontVariant: ["tabular-nums"],
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 0,
  },
  statusText: {
    fontSize: 10,
    fontFamily: "Lexend_800ExtraBold",
    letterSpacing: 0.5,
  },
  cardRow: { flexDirection: "row", gap: 16 },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Lexend_800ExtraBold",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  metricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 20,
  },
  metricItem: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 10,
    fontFamily: "Lexend_700Bold",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  metricValueContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  metricValue: {
    fontSize: 24,
    fontFamily: "Lexend_600SemiBold",
    fontVariant: ["tabular-nums"],
  },
  metricUnit: {
    fontSize: 12,
    fontFamily: "Lexend_600SemiBold",
  },
  constellationRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 10,
    columnGap: 8,
  },
  constBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 16,
    borderCurve: "continuous",
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    width: "48.5%",
    flexGrow: 1,
    maxWidth: "49%",
  },
  constDot: { width: 7, height: 7, borderRadius: 3.5 },
  constLabel: { fontSize: 13, fontFamily: "Lexend_700Bold", flexShrink: 1 },
  constCount: {
    fontSize: 16,
    fontFamily: "Lexend_800ExtraBold",
    fontVariant: ["tabular-nums"],
  },
  noData: { fontSize: 14, fontFamily: "Lexend_500Medium" },
});
