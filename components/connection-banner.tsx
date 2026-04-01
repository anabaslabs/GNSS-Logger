import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { IconBluetooth, IconBluetoothConnected, IconBluetoothOff, IconAlertTriangle } from '@tabler/icons-react-native';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useBleStore } from '@/store/ble-store';
import { isBleAvailable } from '@/lib/ble-manager';
import { PressableScale } from './pressable-scale';

const STATUS_COLOR: Record<string, string> = {
  scanning: '#0EA5E9', // blue
  connecting: '#F59E0B', // amber
  connected: '#10B981', // emerald
  error: '#EF4444', // red
};

function getStatusIcon(status: string, color: string) {
  switch (status) {
    case 'connected': return <IconBluetoothConnected color={color} size={24} />;
    case 'error': return <IconAlertTriangle color={color} size={24} />;
    case 'idle': return <IconBluetoothOff color={color} size={24} />;
    default: return <IconBluetooth color={color} size={24} />;
  }
}

const STATUS_LABEL: Record<string, string> = {
  idle: 'Not Connected',
  scanning: 'Scanning…',
  connecting: 'Connecting…',
  connected: 'Connected',
  disconnecting: 'Disconnecting…',
  error: 'Error',
};

export function ConnectionBanner() {
  const { status, connectedDeviceName, lastError } = useBleStore();
  const router = useRouter();
  const { colors } = useAppTheme();
  
  const color = STATUS_COLOR[status] ?? colors.iconSecondary;
  const label = STATUS_LABEL[status] ?? status;

  if (!isBleAvailable) {
    return (
      <PressableScale
        style={[styles.banner, { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border }]} 
        onPress={() => router.push('/ble-scan')}
      >
        <View style={[styles.iconBox, { backgroundColor: colors.borderLight }]}>
          <IconBluetoothOff color={colors.textSecondary} size={24} />
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.text, { color: colors.text }]}>Custom build needed for BLE</Text>
          <Text style={[styles.tapHint, { color: colors.textSecondary }]}>Tap for info</Text>
        </View>
      </PressableScale>
    );
  }

  const isConnected = status === 'connected';

  return (
    <PressableScale
      style={[styles.banner, { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border }]} 
      onPress={() => router.push('/ble-scan')}
    >
      <View style={[styles.iconBox, { backgroundColor: color + '22' }]}>
        {getStatusIcon(status, color)}
      </View>
      <View style={styles.textContainer}>
        <Text style={[styles.text, { color: colors.text }]} numberOfLines={1}>
          {isConnected && connectedDeviceName
            ? `${connectedDeviceName}`
            : lastError && status === 'error'
            ? `Error: ${lastError}`
            : label}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <View style={[styles.tinyDot, { backgroundColor: color }]} />
          <Text style={[styles.tapHint, { color: isConnected ? colors.textSecondary : color }]}>
            {isConnected ? 'Connected & Live' : 'Tap to scan devices'}
          </Text>
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 24, // One UI heavy rounding
    borderCurve: 'continuous',
    gap: 16,
  } as any, // type assertion for iOS borderCurve
  iconBox: {
    backgroundColor: '#000000',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#333333',
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  text: {
    fontSize: 16,
    fontFamily: 'Lexend_700Bold',
  },
  tapHint: {
    fontSize: 12,
    fontFamily: 'Lexend_600SemiBold',
  },
  tinyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
