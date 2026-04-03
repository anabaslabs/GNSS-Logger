import { ConnectionBanner } from "@/components/connection-banner";
import { GnssCard } from "@/components/gnss-card";
import {
  CONSTELLATION_COLOR,
  CONSTELLATION_LABEL,
  FixQuality,
} from "@/constants/nmea";
import { useAppTheme } from "@/hooks/useAppTheme";
import { formatCoord, getIstValue, getUtcValue } from "@/lib/nmea-parser";
import { useGnssStore } from "@/store/gnss-store";
import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

export default function DashboardScreen() {
  const { colors, isDark } = useAppTheme();
  const { fix, velocity, satellites } = useGnssStore();
  const hasFix = fix.quality !== FixQuality.NoFix && fix.latitude !== null;

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
        <View style={styles.coordRow}>
          <View style={styles.coordItem}>
            <Text style={[styles.coordLabel, { color: colors.textTertiary }]}>
              LATITUDE
            </Text>
            <Text
              style={[styles.coordValue, { color: colors.text }]}
              selectable
            >
              {formatCoord(fix.latitude, "lat")}
            </Text>
          </View>
          <View style={styles.coordItem}>
            <Text style={[styles.coordLabel, { color: colors.textTertiary }]}>
              LONGITUDE
            </Text>
            <Text
              style={[styles.coordValue, { color: colors.text }]}
              selectable
            >
              {formatCoord(fix.longitude, "lon")}
            </Text>
          </View>
        </View>
        <View style={styles.timeRow}>
          <Text style={[styles.timeText, { color: colors.textSecondary }]}>
            IST: {getIstValue(fix.utcTime)}
          </Text>
          <Text style={[styles.timeText, { color: colors.textSecondary }]}>
            UTC: {getUtcValue(fix.utcTime)}
          </Text>
        </View>
      </View>

      <View style={styles.cardRow}>
        <GnssCard
          label="Altitude"
          value={fix.altitudeMsl !== null ? fix.altitudeMsl.toFixed(1) : "-"}
          unit="m"
          accent="#6366F1"
        />
        <GnssCard
          label="Speed"
          value={hasFix ? speedKmh.toFixed(1) : "-"}
          unit="km/h"
          accent="#F59E0B"
        />
      </View>

      <View style={styles.cardRow}>
        <GnssCard
          label="HDOP"
          value={fix.hdop !== null ? fix.hdop.toFixed(2) : "-"}
          accent="#10B981"
          secondary={fix.hdop !== null ? hdopQuality(fix.hdop) : undefined}
        />
        <GnssCard
          label="Heading"
          value={heading !== null ? `${heading.toFixed(1)}°` : "-"}
          accent="#38BDF8"
          secondary={heading !== null ? compassPoint(heading) : undefined}
        />
      </View>

      <View
        style={[
          styles.section,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>
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
                  {count}
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
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 16,
  } as any,
  coordRow: {
    gap: 12,
  },
  coordItem: {
    flex: 1,
  },
  coordLabel: {
    fontSize: 10,
    fontFamily: "Lexend_800ExtraBold",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  coordValue: {
    fontSize: 26,
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
  cardRow: { flexDirection: "row", gap: 16 },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Lexend_800ExtraBold",
    letterSpacing: 1,
    textTransform: "uppercase",
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
