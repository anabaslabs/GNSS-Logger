import { PressableScale } from "@/components/pressable-scale";
import { SatelliteBar } from "@/components/satellite-bar";
import { CONSTELLATION_COLOR, CONSTELLATION_LABEL } from "@/constants/nmea";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useGnssStore } from "@/store/gnss-store";
import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

type FilterId = "ALL" | string;

export default function SatellitesScreen() {
  const { colors, isDark } = useAppTheme();
  const { satellites } = useGnssStore();
  const [filter, setFilter] = useState<FilterId>("ALL");

  const talkerIds = useMemo(() => {
    const seen = new Set<string>();
    for (const s of satellites) seen.add(s.talkerId);
    return Array.from(seen).sort((a, b) => {
      const labelA = CONSTELLATION_LABEL[a] ?? a;
      const labelB = CONSTELLATION_LABEL[b] ?? b;
      return labelB.localeCompare(labelA);
    });
  }, [satellites]);

  const visible = useMemo(() => {
    const list =
      filter === "ALL"
        ? satellites
        : satellites.filter((s) => s.talkerId === filter);
    return [...list].sort((a, b) => (b.snr ?? 0) - (a.snr ?? 0));
  }, [satellites, filter]);

  const totalVisible = satellites.length;
  const totalUsed = satellites.filter((s) => s.usedInFix).length;

  return (
    <ScrollView
      key={isDark ? "dark" : "light"}
      style={[styles.scroll, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.summaryRow}>
        <View
          style={[
            styles.summaryChip,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.summaryNum, { color: colors.text }]}>
            {totalVisible}
          </Text>
          <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>
            In View
          </Text>
        </View>
        <View
          style={[
            styles.summaryChip,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.summaryNum, { color: "#10B981" }]}>
            {totalUsed}
          </Text>
          <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>
            In Fix
          </Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        style={{ marginTop: 6, marginBottom: 10 }}
      >
        {["ALL", ...talkerIds].map((id) => {
          const active = filter === id;
          const color =
            id === "ALL"
              ? "#38BDF8"
              : (CONSTELLATION_COLOR[id] ?? colors.iconSecondary);
          return (
            <PressableScale
              key={id}
              style={[
                styles.filterPill,
                active && { backgroundColor: color + "22", borderColor: color },
              ]}
              onPress={() => setFilter(id)}
            >
              <Text
                style={[
                  styles.filterText,
                  { color: colors.textTertiary },
                  active && { color },
                ]}
              >
                {id === "ALL" ? "All" : (CONSTELLATION_LABEL[id] ?? id)}
              </Text>
            </PressableScale>
          );
        })}
      </ScrollView>

      <View
        style={[
          styles.listCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.listHeader}>
          <View style={{ width: 64, alignItems: "center" }}>
            <Text style={[styles.headerCell, { color: colors.textSecondary }]}>
              SYS
            </Text>
          </View>
          <View style={{ width: 32, alignItems: "center" }}>
            <Text style={[styles.headerCell, { color: colors.textSecondary }]}>
              PRN
            </Text>
          </View>
          <View style={{ width: 40, alignItems: "center" }}>
            <Text style={[styles.headerCell, { color: colors.textSecondary }]}>
              EL
            </Text>
          </View>
          <View style={{ width: 75, alignItems: "center" }}>
            <Text style={[styles.headerCell, { color: colors.textSecondary }]}>
              SNR
            </Text>
          </View>
          <View style={{ width: 60, alignItems: "center" }}>
            <Text style={[styles.headerCell, { color: colors.textSecondary }]}>
              C/N₀
            </Text>
          </View>
        </View>

        <View
          style={{
            height: 1.5,
            backgroundColor: colors.borderLight,
            marginBottom: 8,
          }}
        />

        {visible.length > 0 ? (
          visible.map((item) => (
            <View key={`${item.talkerId}-${item.prn}`}>
              <SatelliteBar satellite={item} />
            </View>
          ))
        ) : (
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              paddingVertical: 24,
            }}
          >
            {[64, 32, 40, 75, 60].map((w, i) => (
              <View key={i} style={{ width: w, alignItems: "center" }}>
                <Text style={[styles.bigDash, { color: colors.textTertiary }]}>
                  -
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 16 }} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  container: { padding: 16, paddingBottom: 40 },
  summaryRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  summaryChip: {
    flex: 1,
    height: 80,
    borderRadius: 32,
    borderCurve: "continuous",
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
  } as any,
  summaryNum: {
    fontSize: 28,
    fontFamily: "Lexend_600SemiBold",
    fontVariant: ["tabular-nums"],
    letterSpacing: -1,
  },
  summaryLabel: {
    fontSize: 11,
    fontFamily: "Lexend_700Bold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  filterRow: { gap: 4, paddingVertical: 4 },
  filterPill: {
    height: 32,
    borderRadius: 16,
    borderWidth: 0,
    paddingHorizontal: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  filterText: { fontSize: 13, fontFamily: "Lexend_700Bold" },
  listCard: {
    borderRadius: 32,
    borderCurve: "continuous",
    borderWidth: 1,
    padding: 20,
  } as any,
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 10,
  },
  headerCell: {
    fontSize: 11,
    fontFamily: "Lexend_800ExtraBold",
    letterSpacing: 1,
  },
  bigDash: {
    fontSize: 26,
    fontFamily: "Lexend_600SemiBold",
    fontVariant: ["tabular-nums"],
    letterSpacing: -1,
  },
});
