import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppTheme } from '@/hooks/useAppTheme';
import { FixQuality, FIX_QUALITY_LABEL, FIX_QUALITY_COLOR } from '@/constants/nmea';

interface StatusBadgeProps {
  quality: FixQuality;
  satellitesInUse?: number;
}

export function StatusBadge({ quality, satellitesInUse }: StatusBadgeProps) {
  const { colors } = useAppTheme();
  
  const label = FIX_QUALITY_LABEL[quality] ?? 'Unknown';
  const color = FIX_QUALITY_COLOR[quality] ?? colors.iconSecondary;

  return (
    <View style={[styles.badge, { backgroundColor: color + '22', borderColor: color }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.label, { color }]}>
        {label}
        {satellitesInUse !== undefined && satellitesInUse > 0
          ? `  ·  ${satellitesInUse} sat${satellitesInUse === 1 ? '' : 's'}`
          : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 24,
    borderCurve: 'continuous',
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 12,
    fontFamily: 'Lexend_800ExtraBold',
    letterSpacing: 0.5,
  },
});
