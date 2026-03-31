import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { IconBluetooth, IconBluetoothConnected, IconBluetoothOff, IconAlertTriangle } from '@tabler/icons-react-native';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useBleStore } from '@/store/ble-store';
import { isBleAvailable } from '@/lib/ble-manager';

const STATUS_COLOR: Record<string, string> = {
  scanning: '#0284C7', // blue
  connecting: '#CA8A04', // yellow/amber
  connected: '#059669', // emerald
  error: '#991B1B', // red
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
      <Pressable
        style={[styles.banner, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]} 
        onPress={() => router.push('/ble-scan')}
        accessibilityRole="button"
        accessibilityLabel="BLE not available"
      >
        <View style={[styles.iconBox, { backgroundColor: colors.borderLight }]}>
          <IconBluetoothOff color={colors.textSecondary} size={24} />
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.text, { color: colors.text }]}>Custom build needed for BLE</Text>
          <Text style={[styles.tapHint, { color: colors.textSecondary }]}>Tap for info</Text>
        </View>
      </Pressable>
    );
  }

  const isConnected = status === 'connected';

  return (
    <Pressable
      style={[styles.banner, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]} // dynamic One UI card
      onPress={() => router.push('/ble-scan')}
      accessibilityRole="button"
      accessibilityLabel="BLE Connection Status"
    >
      <View style={[styles.iconBox, { backgroundColor: color + '33' }]}>
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
        {!isConnected && (
          <Text style={[styles.tapHint, { color: colors.textSecondary }]}>Tap to scan</Text>
        )}
      </View>
    </Pressable>
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
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 13,
    fontFamily: 'Lexend_500Medium',
    marginTop: 2,
  },
});
