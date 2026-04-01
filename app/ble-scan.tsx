import { IconBluetoothOff, IconSearch } from "@tabler/icons-react-native";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
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
    <View style={styles.rssiContainer}>
      {[1, 2, 3, 4].map((bar) => (
        <View
          key={bar}
          style={{
            width: 4,
            height: 4 + bar * 3.5,
            borderRadius: 2,
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
          {device.name || "Unknown"}
        </Text>
        <Text style={[styles.deviceId, { color: colors.textSecondary }]}>
          {device.id}
        </Text>
      </View>
      <View style={styles.rssiWrapper}>
        <RssiBars rssi={device.rssi} trackColor={colors.border} />
        <Text style={[styles.rssiText, { color: colors.textTertiary }]}>
          {device.rssi} dBm
        </Text>
      </View>
      <View
        style={[styles.connectPill, { backgroundColor: colors.tint + "12" }]}
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
  const router = useRouter();
  return (
    <View style={styles.overlay}>
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={() => router.back()}
      />
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={styles.unavailableBox}>
          <IconBluetoothOff color={colors.danger} size={48} />
          <Text style={[styles.modalTitle, { color: colors.text }]}>
            Native BLE Required
          </Text>
          <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
            Bluetooth is not available in Expo Go. You need a custom development
            build to use BLE.
          </Text>
          <View
            style={[
              styles.codeBlock,
              {
                backgroundColor: colors.borderLight + "22",
                borderColor: colors.border,
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
          <PressableScale
            style={[styles.closeBtn, { backgroundColor: colors.borderLight }]}
            onPress={() => router.back()}
          >
            <Text style={[styles.closeBtnText, { color: colors.text }]}>
              Dismiss
            </Text>
          </PressableScale>
        </View>
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

  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (status === "scanning") {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1.5,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      );
      anim.start();
      return () => anim.stop();
    }
  }, [status, pulse]);

  async function handleStartScan() {
    clearScannedDevices();
    setStatus("scanning");
    setTimeLeft(BLE_SCAN_DURATION);

    const ok = await startScan();
    if (!ok) {
      setError("Bluetooth unavailable or permission denied");
      setModalConfig({
        visible: true,
        title: "Permission Required",
        message:
          "Please enable Bluetooth and Location permissions for this app in settings.",
      });
      setStatus("idle");
      return;
    }

    if (timerRef.current) clearInterval(timerRef.current);
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
    if (timerRef.current) clearInterval(timerRef.current);
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
        title: "Connection Error",
        message: String(err),
      });
      setStatus("idle");
    }
  }

  useEffect(() => {
    if (!isBleAvailable) return;
    handleStartScan();
    return () => {
      stopScan().catch(() => {});
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scanning = status === "scanning";

  if (!isBleAvailable) {
    return <BleUnavailableScreen />;
  }

  return (
    <View style={styles.overlay}>
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={() => {
          if (status !== "connecting") router.back();
        }}
      />
      <ConfirmModal
        visible={modalConfig.visible}
        title={modalConfig.title}
        message={modalConfig.message}
        onConfirm={() =>
          setModalConfig((prev) => ({ ...prev, visible: false }))
        }
      />

      <View style={styles.cardContainer}>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.statusBox}>
                <Text
                  style={[styles.modalTitle, { color: colors.text }]}
                  numberOfLines={1}
                >
                  Connect Device
                </Text>
              </View>
            </View>
            <Text
              style={[styles.modalSubtitle, { color: colors.textSecondary }]}
            >
              {scanning
                ? `Searching... (${timeLeft}s remaining)`
                : `Scanning stopped · ${scannedDevices.length} found`}
            </Text>
          </View>

          {/* Device List Area */}
          <View style={styles.content}>
            <FlatList
              data={[...scannedDevices].sort((a, b) => b.rssi - a.rssi)}
              keyExtractor={(d) => d.id}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <DeviceRow
                  device={item}
                  onPress={() => handleConnect(item)}
                  connecting={connectingId === item.id}
                />
              )}
              ListHeaderComponent={
                <View
                  style={[
                    styles.hintBox,
                    {
                      backgroundColor: colors.border + "08",
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[styles.hintText, { color: colors.textSecondary }]}
                  >
                    Ensure your ESP32 is powered and the BLE service is active.
                  </Text>
                </View>
              }
              ListEmptyComponent={
                <View style={styles.empty}>
                  {scanning ? (
                    <ActivityIndicator
                      size="large"
                      color={colors.statusActive}
                    />
                  ) : (
                    <>
                      <IconSearch color={colors.textTertiary} size={48} />
                      <Text style={[styles.emptyText, { color: colors.text }]}>
                        No Devices Found
                      </Text>
                    </>
                  )}
                </View>
              }
              contentContainerStyle={styles.listContainer}
              style={{ maxHeight: 400 }}
            />
          </View>

          {/* Footer Actions */}
          <View style={styles.modalFooter}>
            <Pressable
              hitSlop={12}
              onPress={() => router.back()}
              style={styles.footerBtn}
            >
              <Text
                style={[styles.footerBtnText, { color: colors.textSecondary }]}
              >
                Cancel
              </Text>
            </Pressable>

            <Pressable
              hitSlop={12}
              onPress={
                scanning
                  ? async () => {
                      await stopScan();
                      setStatus("idle");
                      if (timerRef.current) clearInterval(timerRef.current);
                    }
                  : handleStartScan
              }
              style={[
                styles.footerBtn,
                {
                  backgroundColor: scanning
                    ? colors.danger + "15"
                    : colors.statusActive,
                  paddingHorizontal: 24,
                },
              ]}
            >
              <Text
                style={[
                  styles.footerBtnText,
                  { color: scanning ? colors.danger : "#fff" },
                ]}
              >
                {scanning ? "Stop" : "Scan"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    padding: 20,
  },
  cardContainer: {
    width: "100%",
    alignItems: "center",
  },
  card: {
    width: "100%",
    borderRadius: 32,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
    overflow: "hidden",
  },
  header: {
    padding: 24,
    paddingBottom: 20,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  statusBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  modalTitle: {
    fontSize: 22,
    fontFamily: "Lexend_800ExtraBold",
    letterSpacing: -0.5,
  },
  modalSubtitle: {
    fontSize: 14,
    fontFamily: "Lexend_400Regular",
  },
  content: {
    paddingHorizontal: 0,
  },
  listContainer: {
    padding: 24,
    paddingTop: 12,
    gap: 12,
  },
  hintBox: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderStyle: "dashed",
    marginBottom: 8,
  },
  hintText: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Lexend_400Regular",
    textAlign: "center",
  },
  deviceRow: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  deviceInfo: {
    flex: 1,
    gap: 2,
  },
  deviceName: {
    fontSize: 15,
    fontFamily: "Lexend_700Bold",
  },
  deviceId: {
    fontSize: 10,
    fontFamily: "monospace",
    opacity: 0.6,
  },
  rssiWrapper: {
    alignItems: "center",
    gap: 4,
    marginRight: 4,
  },
  rssiContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
    height: 16,
  },
  rssiText: {
    fontSize: 9,
    fontFamily: "Lexend_600SemiBold",
    fontVariant: ["tabular-nums"],
  },
  connectPill: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 80,
    alignItems: "center",
  },
  connectLabel: {
    fontSize: 13,
    fontFamily: "Lexend_700Bold",
  },
  modalFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 24,
    paddingTop: 0,
    marginTop: 8,
  },
  footerBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  footerBtnText: { fontSize: 15, fontFamily: "Lexend_700Bold" },

  empty: {
    paddingVertical: 40,
    alignItems: "center",
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: "Lexend_700Bold",
    opacity: 0.8,
  },
  unavailableBox: {
    padding: 32,
    alignItems: "center",
    gap: 16,
  },
  codeBlock: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginVertical: 8,
  },
  codeText: {
    fontSize: 14,
    fontFamily: "monospace",
  },
  closeBtn: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 16,
  },
  closeBtnText: {
    fontSize: 14,
    fontFamily: "Lexend_700Bold",
  },
});
