import { PressableScale } from "@/components/pressable-scale";
import { SatelliteBar } from "@/components/satellite-bar";
import {
  CONSTELLATION_COLOR,
  CONSTELLATION_LABEL,
  TALKER_ID,
} from "@/constants/nmea";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useGnssStore } from "@/store/gnss-store";
import { IconSatellite } from "@tabler/icons-react-native";
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
      contentInsetAdjustmentBehavior="automatic"
      style={[styles.scroll, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.container}
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
                { borderColor: colors.borderLight },
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
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View
          style={[styles.listHeader, { borderBottomColor: colors.borderLight }]}
        >
          <View style={{ width: 40, alignItems: "center" }}>
            <Text style={[styles.headerCell, { color: colors.textTertiary }]}>
              SYS
            </Text>
          </View>

          <View style={{ width: 26, alignItems: "center" }}>
            <Text style={[styles.headerCell, { color: colors.textTertiary }]}>
              PRN
            </Text>
          </View>

          <View style={{ width: 36, alignItems: "center" }}>
            <Text style={[styles.headerCell, { color: colors.textTertiary }]}>
              EL
            </Text>
          </View>

          <View style={{ width: 90, alignItems: "center" }}>
            <Text style={[styles.headerCell, { color: colors.textTertiary }]}>
              SNR
            </Text>
          </View>

          <View style={{ width: 50, alignItems: "center" }}>
            <Text style={[styles.headerCell, { color: colors.textTertiary }]}>
              dB-Hz
            </Text>
          </View>
        </View>
        {visible.length === 0 ? (
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              paddingVertical: 8,
            }}
          >
            <View style={{ width: 40, alignItems: "center" }}>
              <Text style={[styles.bigDash, { color: colors.textTertiary }]}>
                -
              </Text>
            </View>
            <View style={{ width: 26, alignItems: "center" }}>
              <Text style={[styles.bigDash, { color: colors.textTertiary }]}>
                -
              </Text>
            </View>
            <View style={{ width: 36, alignItems: "center" }}>
              <Text style={[styles.bigDash, { color: colors.textTertiary }]}>
                -
              </Text>
            </View>
            <View style={{ width: 90, alignItems: "center" }}>
              <Text style={[styles.bigDash, { color: colors.textTertiary }]}>
                -
              </Text>
            </View>
            <View style={{ width: 50, alignItems: "center" }}>
              <Text style={[styles.bigDash, { color: colors.textTertiary }]}>
                -
              </Text>
            </View>
          </View>
        ) : (
          visible.map((sat) => (
            <SatelliteBar key={`${sat.talkerId}-${sat.prn}`} satellite={sat} />
          ))
        )}
      </View>

      {satellites.some((s) => s.talkerId === TALKER_ID.NAVIC) && (
        <View
          style={[
            styles.navicBox,
            {
              backgroundColor: CONSTELLATION_COLOR.GI + "1A",
              borderColor: CONSTELLATION_COLOR.GI + "40",
            },
          ]}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <IconSatellite color={CONSTELLATION_COLOR.GI} size={20} />
            <Text style={styles.navicTitle}>IRNSS / NavIC (L5)</Text>
          </View>

          {satellites
            .filter((s) => s.talkerId === TALKER_ID.NAVIC)
            .sort((a, b) => (b.snr ?? 0) - (a.snr ?? 0))
            .map((sat) => (
              <View key={sat.prn} style={styles.navicSatRow}>
                <Text style={[styles.navicPrn, { color: colors.text }]}>
                  PRN {sat.prn}
                </Text>
                <View style={styles.navicValueGroup}>
                  <Text style={styles.navicSnr}>
                    {sat.snr !== null ? `${sat.snr} dB-Hz` : "No signal"}
                  </Text>
                  <View style={styles.navicCheckContainer}>
                    {sat.usedInFix && (
                      <View
                        style={[
                          styles.navicDot,
                          { backgroundColor: CONSTELLATION_COLOR.GI },
                        ]}
                      />
                    )}
                  </View>
                </View>
              </View>
            ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  container: { padding: 16, paddingBottom: 40, gap: 8 },
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
    borderWidth: 1.5,
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
    borderWidth: 1.5,
    padding: 16,
    paddingHorizontal: 10,
    gap: 4,
  } as any,
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 10,
    borderBottomWidth: 1.5,
    marginBottom: 8,
  },
  headerCell: {
    fontSize: 10,
    fontFamily: "Lexend_800ExtraBold",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  noSats: {
    fontSize: 14,
    fontFamily: "Lexend_400Regular",
    textAlign: "center",
    paddingVertical: 24,
  },
  bigDash: {
    fontSize: 26,
    fontFamily: "Lexend_600SemiBold",
    fontVariant: ["tabular-nums"],
    letterSpacing: -1,
  },
  navicBox: {
    borderRadius: 32,
    borderCurve: "continuous",
    borderWidth: 1.5,
    padding: 20,
    gap: 12,
    marginTop: 12,
  } as any,
  navicTitle: {
    color: CONSTELLATION_COLOR.GI,
    fontSize: 16,
    fontFamily: "Lexend_800ExtraBold",
    letterSpacing: 0.5,
  },
  navicSatRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  navicPrn: {
    fontSize: 14,
    fontFamily: "Lexend_600SemiBold",
    fontVariant: ["tabular-nums"],
  },
  navicValueGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  navicCheckContainer: {
    width: 24,
    alignItems: "flex-end",
  },
  navicDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  navicSnr: {
    color: CONSTELLATION_COLOR.GI,
    fontSize: 13,
    fontFamily: "Lexend_700Bold",
    fontVariant: ["tabular-nums"],
  },
});
