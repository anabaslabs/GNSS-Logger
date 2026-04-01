import React, { useMemo, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable, TouchableOpacity } from 'react-native';
import { PressableScale } from '@/components/pressable-scale';
import { useGnssStore } from '@/store/gnss-store';
import { SatelliteBar } from '@/components/satellite-bar';
import { CONSTELLATION_COLOR, CONSTELLATION_LABEL, TALKER_ID } from '@/constants/nmea';
import { IconSatellite, IconClock, IconFileText, IconMapPin, IconTerminal2, IconTrash, IconHistory } from '@tabler/icons-react-native';
import { useAppTheme } from '@/hooks/useAppTheme';
type FilterId = 'ALL' | string;

export default function SatellitesScreen() {
  const { colors } = useAppTheme();
  const { satellites } = useGnssStore();
  const [filter, setFilter] = useState<FilterId>('ALL');

  // Unique talker IDs present in currently tracked satellites
  const talkerIds = useMemo(() => {
    const seen = new Set<string>();
    for (const s of satellites) seen.add(s.talkerId);
    return Array.from(seen).sort();
  }, [satellites]);

  const visible = useMemo(() => {
    const list = filter === 'ALL'
      ? satellites
      : satellites.filter((s) => s.talkerId === filter);
    return [...list].sort((a, b) => (b.snr ?? 0) - (a.snr ?? 0));
  }, [satellites, filter]);

  const totalVisible = satellites.length;
  const totalUsed = satellites.filter((s) => s.usedInFix).length;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={[styles.scroll, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.container}
    >
      {/* Summary */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.summaryNum, { color: colors.text }]}>{totalVisible}</Text>
          <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>In View</Text>
        </View>
        <View style={[styles.summaryChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.summaryNum, { color: '#10B981' }]}>{totalUsed}</Text>
          <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>Used in Fix</Text>
        </View>
        {/* NavIC specific callout */}
        <View style={[styles.summaryChip, { backgroundColor: CONSTELLATION_COLOR.GI + '1A', borderColor: CONSTELLATION_COLOR.GI + '40' }]}>
          <Text style={[styles.summaryNum, { color: CONSTELLATION_COLOR.GI }]}>
            {satellites.filter((s) => s.talkerId === TALKER_ID.NAVIC).length}
          </Text>
          <Text style={[styles.summaryLabel, { color: CONSTELLATION_COLOR.GI }]}>NavIC</Text>
        </View>
      </View>

      {/* Constellation filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {['ALL', ...talkerIds].map((id) => {
          const active = filter === id;
          const color = id === 'ALL' ? '#38BDF8' : (CONSTELLATION_COLOR[id] ?? colors.iconSecondary);
          return (
            <PressableScale
              key={id}
              style={[
                styles.filterPill,
                { borderColor: colors.borderLight },
                active && { backgroundColor: color + '22', borderColor: color },
              ]}
              onPress={() => setFilter(id)}
            >
              <Text style={[styles.filterText, { color: colors.textTertiary }, active && { color }]}>
                {id === 'ALL' ? 'All' : (CONSTELLATION_LABEL[id] ?? id)}
              </Text>
            </PressableScale>
          );
        })}
      </ScrollView>

      {/* Satellite list */}
      <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {/* Header row */}
        <View style={[styles.listHeader, { borderBottomColor: colors.borderLight }]}>
          <Text style={[styles.headerCell, { color: colors.textTertiary, width: 42 }]}>SYS</Text>
          <Text style={[styles.headerCell, { color: colors.textTertiary, width: 60 }]}>PRN</Text>
          <Text style={[styles.headerCell, { color: colors.textTertiary, width: 36 }]}>EL</Text>
          <Text style={[styles.headerCell, { color: colors.textTertiary, flex: 1 }]}>SNR</Text>
          <Text style={[styles.headerCell, { color: colors.textTertiary, width: 44, textAlign: 'right' }]}>dB-Hz</Text>
        </View>
        {visible.length === 0 ? (
          <Text style={[styles.noSats, { color: colors.textTertiary }]}>No satellites tracked - connect to ESP32 and go outdoors</Text>
        ) : (
          visible.map((sat) => (
            <SatelliteBar key={`${sat.talkerId}-${sat.prn}`} satellite={sat} />
          ))
        )}
      </View>

      {/* NavIC highlight box */}
      {satellites.some((s) => s.talkerId === TALKER_ID.NAVIC) && (
        <View style={[styles.navicBox, { backgroundColor: CONSTELLATION_COLOR.GI + '1A', borderColor: CONSTELLATION_COLOR.GI + '40' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <IconSatellite color={CONSTELLATION_COLOR.GI} size={20} />
            <Text style={styles.navicTitle}>NavIC / IRNSS (L5)</Text>
          </View>
          <Text style={[styles.navicDesc, { color: colors.textSecondary }]}>
            NavIC satellites (GI talker) are being received on the L5 band via the Quectel L89HA
            receiver. These are Indian Regional Navigation Satellite System signals operated by ISRO.
          </Text>
          {satellites
            .filter((s) => s.talkerId === TALKER_ID.NAVIC)
            .sort((a, b) => (b.snr ?? 0) - (a.snr ?? 0))
            .map((sat) => (
              <View key={sat.prn} style={styles.navicSatRow}>
                <Text style={[styles.navicPrn, { color: colors.text }]}>PRN {sat.prn}</Text>
                <Text style={styles.navicSnr}>
                  {sat.snr !== null ? `${sat.snr} dB-Hz` : 'No signal'}
                  {sat.usedInFix ? ' ✓' : ''}
                </Text>
              </View>
            ))}
        </View>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  container: { padding: 16, paddingBottom: 40, gap: 16 },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryChip: {
    flex: 1,
    borderRadius: 24,
    borderCurve: 'continuous',
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    gap: 4,
  } as any,
  summaryNum: {
    fontSize: 28,
    fontFamily: 'Lexend_600SemiBold',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },
  summaryLabel: {
    fontSize: 11,
    fontFamily: 'Lexend_700Bold',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  filterRow: { gap: 8, paddingVertical: 4 },
  filterPill: {
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  filterText: { fontSize: 13, fontFamily: 'Lexend_700Bold' },
  listCard: {
    borderRadius: 24,
    borderCurve: 'continuous',
    borderWidth: 1,
    padding: 16,
    gap: 4,
  } as any,
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    marginBottom: 8,
    gap: 8,
  },
  headerCell: {
    fontSize: 10,
    fontFamily: 'Lexend_800ExtraBold',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  noSats: {
    fontSize: 14,
    fontFamily: 'Lexend_400Regular',
    textAlign: 'center',
    paddingVertical: 24,
  },
  navicBox: {
    borderRadius: 24,
    borderCurve: 'continuous',
    borderWidth: 1,
    padding: 20,
    gap: 12,
  } as any,
  navicTitle: {
    color: CONSTELLATION_COLOR.GI,
    fontSize: 16,
    fontFamily: 'Lexend_800ExtraBold',
    letterSpacing: 0.5,
  },
  navicDesc: { fontSize: 13, lineHeight: 20, fontFamily: 'Lexend_500Medium' },
  navicSatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  navicPrn: { fontSize: 14, fontFamily: 'Lexend_600SemiBold', fontVariant: ['tabular-nums'] },
  navicSnr: { color: CONSTELLATION_COLOR.GI, fontSize: 13, fontFamily: 'Lexend_700Bold', fontVariant: ['tabular-nums'] },
});
