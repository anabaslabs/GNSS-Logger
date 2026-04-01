import React, { useEffect, useRef } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';
import { useGnssStore } from '@/store/gnss-store';
import { ConnectionBanner } from '@/components/connection-banner';
import { GnssCard } from '@/components/gnss-card';
import { StatusBadge } from '@/components/status-badge';
import { useAppTheme } from '@/hooks/useAppTheme';
import { CONSTELLATION_COLOR, CONSTELLATION_LABEL, FixQuality } from '@/constants/nmea';
import { formatCoord, formatNmeaTime } from '@/lib/nmea-parser';

export default function DashboardScreen() {
  const { colors } = useAppTheme();
  const { fix, velocity, satellites } = useGnssStore();

  // Pulse animation when data is flowing
  const pulse = useRef(new Animated.Value(1)).current;
  const prevUpdatedAt = useRef(0);

  useEffect(() => {
    if (fix.updatedAt !== prevUpdatedAt.current && fix.updatedAt > 0) {
      prevUpdatedAt.current = fix.updatedAt;
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.15, duration: 120, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fix.updatedAt]);

  // Count satellites per constellation
  const constellationCounts: Record<string, number> = {};
  for (const sat of satellites) {
    if (sat.usedInFix) {
      constellationCounts[sat.talkerId] = (constellationCounts[sat.talkerId] ?? 0) + 1;
    }
  }

  const hasFix = fix.quality !== FixQuality.NoFix && fix.latitude !== null;
  const speedKmh = velocity.speedKmh ?? 0;
  const heading = velocity.courseTrue;



  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={[styles.scroll, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.container}
    >
      {/* BLE Connection Banner */}
      <ConnectionBanner />

      {/* Fix Status */}
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.fixHeader}>
          <StatusBadge quality={fix.quality} satellitesInUse={fix.satellitesInUse} />
          <Animated.View style={{ transform: [{ scale: pulse }] }}>
            <View style={[styles.liveIndicator, { backgroundColor: hasFix ? '#10B981' : colors.iconSecondary }]} />
          </Animated.View>
        </View>

        {/* Coordinates */}
        <View style={styles.coordRow}>
          <View style={styles.coordItem}>
            <Text style={[styles.coordLabel, { color: colors.textTertiary }]}>LATITUDE</Text>
            <Text style={[styles.coordValue, { color: colors.text }]} selectable>
              {formatCoord(fix.latitude, 'lat')}
            </Text>
          </View>
          <View style={styles.coordItem}>
            <Text style={[styles.coordLabel, { color: colors.textTertiary }]}>LONGITUDE</Text>
            <Text style={[styles.coordValue, { color: colors.text }]} selectable>
              {formatCoord(fix.longitude, 'lon')}
            </Text>
          </View>
        </View>
        <Text style={[styles.timeText, { color: colors.textSecondary }]}>{formatNmeaTime(fix.utcTime)}</Text>
      </View>

      {/* Metric Cards Row 1 */}
      <View style={styles.cardRow}>
        <GnssCard
          label="Altitude"
          value={fix.altitudeMsl !== null ? fix.altitudeMsl.toFixed(1) : '-'}
          unit="m"
          accent="#6366F1"
        />
        <GnssCard
          label="Speed"
          value={hasFix ? speedKmh.toFixed(1) : '-'}
          unit="km/h"
          accent="#F59E0B"
        />
      </View>

      {/* Metric Cards Row 2 */}
      <View style={styles.cardRow}>
        <GnssCard
          label="HDOP"
          value={fix.hdop !== null ? fix.hdop.toFixed(2) : '-'}
          accent="#10B981"
          secondary={fix.hdop !== null ? hdopQuality(fix.hdop) : undefined}
        />
        <GnssCard
          label="Heading"
          value={heading !== null ? `${heading.toFixed(1)}°` : '-'}
          accent="#38BDF8"
          secondary={heading !== null ? compassPoint(heading) : undefined}
        />
      </View>

      {/* Constellation breakdown */}
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>Constellations In Fix</Text>
        <View style={styles.constellationRow}>
          {Object.entries(constellationCounts).length === 0 ? (
            <Text style={[styles.noData, { color: colors.textTertiary }]}>No fix - waiting for satellites…</Text>
          ) : (
            Object.entries(constellationCounts).map(([id, count]) => (
              <View
                key={id}
                style={[
                  styles.constBadge,
                  { backgroundColor: (CONSTELLATION_COLOR[id] ?? '#6B7280') + '22' },
                ]}
              >
                <View
                  style={[
                    styles.constDot,
                    { backgroundColor: CONSTELLATION_COLOR[id] ?? '#6B7280' },
                  ]}
                />
                <Text style={[styles.constLabel, { color: CONSTELLATION_COLOR[id] ?? '#6B7280' }]}>
                  {CONSTELLATION_LABEL[id] ?? id}
                </Text>
                <Text style={styles.constCount}>{count}</Text>
              </View>
            ))
          )}
        </View>
      </View>



      {/* Bottom padding */}
      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

function hdopQuality(hdop: number): string {
  if (hdop <= 1) return 'Ideal';
  if (hdop <= 2) return 'Excellent';
  if (hdop <= 5) return 'Good';
  if (hdop <= 10) return 'Moderate';
  if (hdop <= 20) return 'Fair';
  return 'Poor';
}

function compassPoint(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8] ?? 'N';
}

const styles = StyleSheet.create({
  scroll: { flex: 1 }, 
  container: { padding: 16, paddingBottom: 110, gap: 16 }, // larger gap
  section: {
    borderRadius: 24, // larger radius
    borderCurve: 'continuous',
    borderWidth: 1,
    padding: 20,
    gap: 16,
  } as any,
  fixHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  liveIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  coordRow: {
    gap: 12,
    marginTop: 8,
  },
  coordItem: {
    flex: 1,
  },
  coordLabel: {
    fontSize: 10,
    fontFamily: 'Lexend_800ExtraBold',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  coordValue: {
    fontSize: 26,
    fontFamily: 'Lexend_300Light',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
    marginTop: 2,
  },
  timeText: {
    fontSize: 12,
    marginTop: 12,
    fontFamily: 'Lexend_500Medium',
    fontVariant: ['tabular-nums'],
  },
  cardRow: { flexDirection: 'row', gap: 16 },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Lexend_800ExtraBold',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  constellationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  constBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  constDot: { width: 8, height: 8, borderRadius: 4 },
  constLabel: { fontSize: 13, fontFamily: 'Lexend_700Bold' },
  constCount: {
    fontSize: 15,
    fontFamily: 'Lexend_800ExtraBold',
    fontVariant: ['tabular-nums'],
  },
  noData: { fontSize: 14, fontFamily: 'Lexend_500Medium' },

});
