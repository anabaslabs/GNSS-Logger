import { IconBluetoothOff, IconSearch } from "@tabler/icons-react-native";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ConfirmModal } from "@/components/confirm-modal";
import { PressableScale } from "@/components/pressable-scale";
import { BLE_SCAN_DURATION } from "@/constants/ble";
import { useAppTheme } from "@/hooks/useAppTheme";
import {
  connectAndSubscribe,
  isBleAvailable,
  startScan,
  stopScan,
} from "@/lib/ble-manager";
import { useBleStore } from "@/store/ble-store";
import type { BleDevice } from "@/types/gnss";

function RssiBars({ rssi, trackColor }: { rssi: number; trackColor: string }) {
  const { colors } = useAppTheme();
  const level = rssi >= -60 ? 4 : rssi >= -70 ? 3 : rssi >= -80 ? 2 : 1;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-end",
        gap: 2,
        height: 16,
      }}
    >
      {[1, 2, 3, 4].map((bar) => (
        <View
          key={bar}
          style={{
            width: 5,
            height: 4 + bar * 4,
            borderRadius: 3,
            backgroundColor: bar <= level ? colors.statusActive : trackColor,
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
    <PressableScale
      style={[
        styles.deviceRow,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
      onPress={onPress}
    >
      <View style={styles.deviceInfo}>
        <Text
          style={[styles.deviceName, { color: colors.text }]}
          numberOfLines={1}
        >
          {device.name || "Unnamed Device"}
        </Text>
        <Text style={[styles.deviceId, { color: colors.textSecondary }]}>
          {device.id}
        </Text>
      </View>
      <RssiBars rssi={device.rssi} trackColor={colors.border} />
      <Text style={[styles.rssiText, { color: colors.textSecondary }]}>
        {device.rssi} dBm
      </Text>
      <View
        style={[styles.connectPill, { backgroundColor: colors.tint + "15" }]}
      >
        {connecting ? (
          <ActivityIndicator size="small" color={colors.tint} />
        ) : (
          <Text style={[styles.connectLabel, { color: colors.tint }]}>
            Connect
          </Text>
        )}
      </View>
    </PressableScale>
  );
}

function BleUnavailableScreen() {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.unavailableBox}>
        <IconBluetoothOff color={colors.textTertiary} size={64} />
        <Text style={[styles.unavailableTitle, { color: colors.text }]}>
          Custom Build Required
        </Text>
        <Text style={[styles.unavailableDesc, { color: colors.textSecondary }]}>
          Bluetooth is a native API and is not available in Expo Go. You need a
          custom development build to use BLE.
        </Text>
        <View
          style={[
            styles.codeBlock,
            {
              backgroundColor: colors.surface,
              borderColor: colors.borderLight,
            },
          ]}
        >
          <Text
            style={[styles.codeText, { color: colors.statusActive }]}
            selectable
          >
            npx expo run:android
          </Text>
        </View>
        <Text style={[styles.unavailableDesc, { color: colors.textSecondary }]}>
          Connect your Android phone via USB with debugging enabled, then run
          the command above in the project directory. The app will compile and
          install automatically.
        </Text>
      </View>
    </View>
  );
}

export default function BleScanModal() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const {
    status,
    scannedDevices,
    clearScannedDevices,
    setStatus,
    setConnected,
    setError,
  } = useBleStore();

  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(BLE_SCAN_DURATION);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [modalConfig, setModalConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
  }>({
    visible: false,
    title: "",
    message: "",
  });

  if (!isBleAvailable) {
    return <BleUnavailableScreen />;
  }

  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (status === "scanning") {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1.4,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
        ]),
      );
      anim.start();
      return () => anim.stop();
    }
  }, [status]);

  async function handleStartScan() {
    clearScannedDevices();
    setStatus("scanning");
    setTimeLeft(BLE_SCAN_DURATION);

    const ok = await startScan();
    if (!ok) {
      setError("Bluetooth permission denied or hardware unavailable");
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setStatus("idle");
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
    setStatus("connecting");
    setConnectingId(device.id);

    try {
      await connectAndSubscribe(device.id);
      setConnected(device.id, device.name ?? device.id);
      router.back();
    } catch (err) {
      setConnectingId(null);
      setModalConfig({
        visible: true,
        title: "Connection Failed",
        message: String(err),
      });
      setStatus("idle");
    }
  }

  useEffect(() => {
    handleStartScan();
    return () => {
      stopScan().catch(() => {});
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const scanning = status === "scanning";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ConfirmModal
        visible={modalConfig.visible}
        title={modalConfig.title}
        message={modalConfig.message}
        onConfirm={() =>
          setModalConfig((prev) => ({ ...prev, visible: false }))
        }
      />
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.statusRow}>
          <Animated.View
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: scanning
                ? colors.statusActive
                : colors.iconSecondary,
              transform: [{ scale: scanning ? pulse : 1 }],
            }}
          />
          <Text style={[styles.statusText, { color: colors.textSecondary }]}>
            {scanning
              ? `Scanning… ${timeLeft}s`
              : `Found ${scannedDevices.length} device(s)`}
          </Text>
        </View>
        <PressableScale
          style={[
            styles.scanButton,
            { backgroundColor: colors.surface },
            scanning && { backgroundColor: colors.tint + "1A" },
          ]}
          onPress={
            scanning
              ? async () => {
                  await stopScan();
                  setStatus("idle");
                }
              : handleStartScan
          }
        >
          <Text
            style={[
              styles.scanButtonText,
              { color: scanning ? colors.tint : colors.text },
            ]}
          >
            {scanning ? "Stop" : "Re-scan"}
          </Text>
        </PressableScale>
      </View>

      <View
        style={[
          styles.hintBox,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.hintText, { color: colors.textSecondary }]}>
          Make sure the ESP32 is powered and advertising BLE (Nordic UART
          Service). If not visible, check the device name filter or ensure
          firmware is running.
        </Text>
      </View>

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
                <Text style={[styles.emptyText, { color: colors.text }]}>
                  No devices found
                </Text>
                <Text
                  style={[styles.emptySubtext, { color: colors.textTertiary }]}
                >
                  Tap Re-scan or check your ESP32 is powered and BLE is enabled
                  on your phone.
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
  unavailableBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 20,
  },
  unavailableTitle: {
    fontSize: 22,
    fontFamily: "Lexend_800ExtraBold",
    textAlign: "center",
    letterSpacing: -0.5,
  },
  unavailableDesc: {
    fontSize: 14,
    fontFamily: "Lexend_400Regular",
    lineHeight: 22,
    textAlign: "center",
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
    fontFamily: "monospace",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
  },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  statusText: { fontSize: 14, fontFamily: "Lexend_600SemiBold" },
  scanButton: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  scanButtonText: { fontSize: 13, fontFamily: "Lexend_700Bold" },
  connectPill: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 90,
  },
  hintBox: {
    margin: 16,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
  },
  hintText: { fontSize: 13, lineHeight: 20, fontFamily: "Lexend_400Regular" },
  list: { padding: 16, gap: 16, flexGrow: 1 },
  deviceRow: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  deviceInfo: { flex: 1, gap: 3 },
  deviceName: { fontSize: 16, fontFamily: "Lexend_700Bold" },
  deviceId: { fontSize: 11, fontFamily: "monospace" },
  rssiText: {
    fontSize: 12,
    fontFamily: "Lexend_600SemiBold",
    fontVariant: ["tabular-nums"],
    minWidth: 52,
    textAlign: "right",
  },
  connectLabel: { fontSize: 14, fontFamily: "Lexend_700Bold" },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 16,
  },
  emptyText: { fontSize: 18, fontFamily: "Lexend_800ExtraBold" },
  emptySubtext: {
    fontSize: 14,
    fontFamily: "Lexend_400Regular",
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 280,
  },
});
