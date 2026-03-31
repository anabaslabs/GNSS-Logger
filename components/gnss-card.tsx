import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppTheme } from '@/hooks/useAppTheme';

interface GnssCardProps {
  label: string;
  value: string | number;
  unit?: string;
  accent?: string;
  secondary?: string;
}

export function GnssCard({ label, value, unit, accent = '#38BDF8', secondary }: GnssCardProps) {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.card, { borderColor: accent + '33', backgroundColor: colors.surface }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Text style={[styles.label, { color: accent }]}>{label}</Text>
        {secondary && (
          <View style={[styles.secondaryBadge, { backgroundColor: accent + '22' }]}>
            <Text style={[styles.secondaryText, { color: accent }]}>{secondary}</Text>
          </View>
        )}
      </View>
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
        {unit && <Text style={[styles.unit, { color: colors.textSecondary }]}>{unit}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 24,
    borderCurve: 'continuous',
    borderWidth: 1,
    padding: 20,
    gap: 12,
  } as any,
  label: {
    fontSize: 12,
    fontFamily: 'Lexend_700Bold',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 4,
  },
  value: {
    fontSize: 32,
    fontFamily: 'Lexend_300Light',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  unit: {
    fontSize: 14,
    fontFamily: 'Lexend_600SemiBold',
    marginBottom: 4,
  },
  secondaryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  secondaryText: {
    fontSize: 10,
    fontFamily: 'Lexend_800ExtraBold',
    textTransform: 'uppercase',
  },
});
