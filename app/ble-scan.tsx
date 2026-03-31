import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { IconBluetoothOff, IconSearch } from '@tabler/icons-react-native';
import { useBleStore } from '@/store/ble-store';
import { useAppTheme } from '@/hooks/useAppTheme';
import { startScan, stopScan, connectAndSubscribe, isBleAvailable } from '@/lib/ble-manager';
import { BLE_SCAN_DURATION } from '@/constants/ble';
import type { BleDevice } from '@/types/gnss';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function RssiBars({ rssi, trackColor }: { rssi: number; trackColor: string }) {
  const level = rssi >= -60 ? 4 : rssi >= -70 ? 3 : rssi >= -80 ? 2 : 1;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 16 }}>
      {[1, 2, 3, 4].map((bar) => (
        <View
          key={bar}
          style={{
            width: 4,
            height: 4 + bar * 3,
            borderRadius: 2,
            backgroundColor: bar <= level ? '#38BDF8' : trackColor,
          }}
        />
      ))}
    </View>
  );
}

function DeviceRow({
  device,
  onPress,
  connecting,
}: {
  device: BleDevice;
  onPress: () => void;
  connecting: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.deviceRow,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && { backgroundColor: colors.border, opacity: 0.7 }
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Connect to ${device.name ?? device.id}`}
    >
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={[styles.deviceName, { color: colors.text }]} numberOfLines={1}>
          {device.name ?? 'Unknown Device'}
        </Text>
        <Text style={[styles.deviceId, { color: colors.textTertiary }]} selectable numberOfLines={1}>
          {device.id}
        </Text>
      </View>
      <RssiBars rssi={device.rssi} trackColor={colors.border} />
      <Text style={[styles.rssiText, { color: colors.textSecondary }]}>{device.rssi} dBm</Text>
      {connecting ? (
        <ActivityIndicator size="small" color={colors.statusActive} />
      ) : (
        <Text style={[styles.connectLabel, { color: colors.statusActive }]}>Connect</Text>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Unavailable screen for Expo Go
// ---------------------------------------------------------------------------
function BleUnavailableScreen() {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.unavailableBox}>
        <IconBluetoothOff color={colors.textTertiary} size={64} />
        <Text style={[styles.unavailableTitle, { color: colors.text }]}>Custom Build Required</Text>
        <Text style={[styles.unavailableDesc, { color: colors.textSecondary }]}>
          Bluetooth is a native API and is not available in Expo Go. You need a custom
          development build to use BLE.
        </Text>
        <View style={[styles.codeBlock, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
          <Text style={[styles.codeText, { color: colors.statusActive }]} selectable>
            npx expo run:android
          </Text>
        </View>
        <Text style={[styles.unavailableDesc, { color: colors.textSecondary }]}>
          Connect your Android phone via USB with debugging enabled, then run the
          command above in the project directory. The app will compile and install
          automatically.
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main exported screen
// ---------------------------------------------------------------------------
export default function BleScanModal() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { status, scannedDevices, clearScannedDevices, setStatus, setConnected, setError } =
    useBleStore();

  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(BLE_SCAN_DURATION);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Show instructions when running in Expo Go
  if (!isBleAvailable) {
    return <BleUnavailableScreen />;
  }

  // Pulse dot animation
  const pulse = useRef(new Animated.Value(1)).current;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (status === 'scanning') {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.4, duration: 700, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        ]),
      );
      anim.start();
      return () => anim.stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function handleStartScan() {
    clearScannedDevices();
    setStatus('scanning');
    setTimeLeft(BLE_SCAN_DURATION);

    const ok = await startScan();
    if (!ok) {
      setError('Bluetooth permission denied or hardware unavailable');
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setStatus('idle');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  async function handleConnect(device: BleDevice) {
    if (connectingId) return;
    await stopScan();
    clearInterval(timerRef.current!);
    setStatus('connecting');
    setConnectingId(device.id);

    try {
      await connectAndSubscribe(device.id);
      setConnected(device.id, device.name ?? device.id);
      router.back();
    } catch (err) {
      setConnectingId(null);
      Alert.alert('Connection Failed', String(err), [{ text: 'OK' }]);
      setStatus('idle');
    }
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    handleStartScan();
    return () => {
      stopScan().catch(() => {});
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scanning = status === 'scanning';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.statusRow}>
          <Animated.View
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: scanning ? colors.statusActive : colors.iconSecondary,
              transform: [{ scale: scanning ? pulse : 1 }],
            }}
          />
          <Text style={[styles.statusText, { color: colors.textSecondary }]}>
            {scanning ? `Scanning… ${timeLeft}s` : `Found ${scannedDevices.length} device(s)`}
          </Text>
        </View>
        <Pressable
          style={[
            styles.scanButton,
            { backgroundColor: colors.surface, borderColor: colors.borderLight },
            scanning && { backgroundColor: colors.statusActiveSurface, borderColor: colors.statusActive }
          ]}
          onPress={
            scanning
              ? async () => {
                  await stopScan();
                  setStatus('idle');
                }
              : handleStartScan
          }
          accessibilityRole="button"
        >
          <Text style={[styles.scanButtonText, { color: scanning ? colors.statusActive : colors.text }]}>{scanning ? 'Stop' : 'Re-scan'}</Text>
        </Pressable>
      </View>

      {/* ESP32 hint */}
      <View style={[styles.hintBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.hintText, { color: colors.textSecondary }]}>
          💡 Make sure the ESP32 is powered and advertising BLE (Nordic UART Service). If not
          visible, check the device name filter or ensure firmware is running.
        </Text>
      </View>

      {/* Device list */}
      <FlatList
        data={[...scannedDevices].sort((a, b) => b.rssi - a.rssi)}
        keyExtractor={(d) => d.id}
        renderItem={({ item }) => (
          <DeviceRow
            device={item}
            onPress={() => handleConnect(item)}
            connecting={connectingId === item.id}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            {scanning ? (
              <ActivityIndicator size="large" color={colors.statusActive} />
            ) : (
              <>
                <IconSearch color={colors.textTertiary} size={64} />
                <Text style={[styles.emptyText, { color: colors.text }]}>No devices found</Text>
                <Text style={[styles.emptySubtext, { color: colors.textTertiary }]}>
                  Tap Re-scan or check your ESP32 is powered and BLE is enabled on your phone.
                </Text>
              </>
            )}
          </View>
        }
        contentContainerStyle={styles.list}
        style={{ flex: 1 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  // Unavailable screen styles
  unavailableBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 20,
  },
  unavailableTitle: {
    fontSize: 22,
    fontFamily: 'Lexend_800ExtraBold',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  unavailableDesc: {
    fontSize: 14,
    fontFamily: 'Lexend_400Regular',
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 300,
  },
  codeBlock: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  codeText: {
    fontSize: 15,
    fontFamily: 'monospace',
  },
  // Scan screen styles
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusText: { fontSize: 14, fontFamily: 'Lexend_600SemiBold' },
  scanButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  scanButtonText: { fontSize: 13, fontFamily: 'Lexend_700Bold' },
  hintBox: {
    margin: 16,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
  },
  hintText: { fontSize: 13, lineHeight: 20, fontFamily: 'Lexend_400Regular' },
  list: { padding: 16, gap: 16, flexGrow: 1 },
  deviceRow: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deviceName: { fontSize: 16, fontFamily: 'Lexend_700Bold' },
  deviceId: { fontSize: 11, fontFamily: 'monospace' },
  rssiText: {
    fontSize: 12,
    fontFamily: 'Lexend_600SemiBold',
    fontVariant: ['tabular-nums'],
    minWidth: 52,
    textAlign: 'right',
  },
  connectLabel: { fontSize: 14, fontFamily: 'Lexend_700Bold' },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 16,
  },
  emptyText: { fontSize: 18, fontFamily: 'Lexend_800ExtraBold' },
  emptySubtext: {
    fontSize: 14,
    fontFamily: 'Lexend_400Regular',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
});
