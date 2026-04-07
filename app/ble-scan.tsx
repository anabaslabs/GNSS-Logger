import { ConfirmModal } from "@/components/confirm-modal";
import { PressableScale } from "@/components/pressable-scale";
import { useAppTheme } from "@/hooks/useAppTheme";
import {
  checkBluetoothState,
  connectAndSubscribe,
  disconnectDevice,
  isBleAvailable,
} from "@/lib/ble-manager";
import { useBleStore } from "@/store/ble-store";
import type { BleDevice } from "@/types/gnss";
import {
  IconBluetoothOff,
  IconMapPinOff,
  IconSearch,
} from "@tabler/icons-react-native";
import * as IntentLauncher from "expo-intent-launcher";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Reanimated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

function RssiBars({
  rssi,
  trackColor,
  activeColor,
}: {
  rssi: number;
  trackColor: string;
  activeColor?: string;
}) {
  const { colors } = useAppTheme();
  const level = rssi >= -60 ? 4 : rssi >= -70 ? 3 : rssi >= -80 ? 2 : 1;
  const barColor = activeColor || colors.statusActive;

  return (
    <View style={styles.rssiContainer}>
      {[1, 2, 3, 4].map((bar) => (
        <View
          key={bar}
          style={{
            width: 5,
            height: 3 + bar * 3,
            borderRadius: 2.5,
            backgroundColor: bar <= level ? barColor : trackColor,
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
  connected,
}: {
  device: BleDevice;
  onPress: () => void;
  connecting: boolean;
  connected: boolean;
}) {
  const { colors } = useAppTheme();
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (connecting) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(0.3, { duration: 200 }),
          withTiming(1, { duration: 200 }),
        ),
        -1,
        true,
      );
    } else {
      pulse.value = withTiming(1);
    }
  }, [connecting, pulse]);

  const animatedStyle = useAnimatedStyle(() => {
    const color = connecting || connected ? colors.statusActive : colors.border;
    const borderColor = interpolateColor(
      pulse.value,
      [0.3, 1],
      [color + "22", color + "66"],
    );

    return {
      borderColor,
    };
  }, [connecting, connected, colors]);

  const backgroundColor = connected
    ? colors.statusSurface
    : connecting
      ? colors.border + "11"
      : colors.surface;

  return (
    <PressableScale onPress={onPress} style={{ width: "100%" }}>
      <Reanimated.View
        style={[
          styles.deviceRow,
          animatedStyle,
          {
            backgroundColor,
            borderWidth: 1,
            borderStyle: connecting ? "dashed" : "solid",
          },
        ]}
      >
        <View style={styles.deviceInfo}>
          <Text
            style={[styles.deviceName, { color: colors.text }]}
            numberOfLines={1}
          >
            {device.name || "Unknown"}
          </Text>
          <Text
            style={[styles.deviceId, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {device.id}
          </Text>
        </View>
        <View style={styles.rssiWrapper}>
          <RssiBars
            rssi={device.rssi}
            trackColor={colors.border}
            activeColor={connected ? colors.statusActive : undefined}
          />
          <Text style={[styles.rssiText, { color: colors.textTertiary }]}>
            {device.rssi} dBm
          </Text>
        </View>
      </Reanimated.View>
    </PressableScale>
  );
}

function BleUnavailableScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  return (
    <View style={styles.overlay}>
      <Pressable
        style={StyleSheet.absoluteFill}
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
    isScanning,
    scannedDevices,
    setStatus,
    setConnected,
    scanTimer,
    startScanWithTimer,
    stopScanAndReset,
    connectedDeviceId,
    connectedDeviceName,
    rssi,
    setDisconnected,
  } = useBleStore();

  const [connectingId, setConnectingId] = useState<string | null>(null);

  const [modalConfig, setModalConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
  }>({
    visible: false,
    title: "",
    message: "",
  });

  const [bluetoothState, setBluetoothState] = useState<string>("unknown");
  const [locationEnabled, setLocationEnabled] = useState<boolean>(true);
  const [initialScanAttempted, setInitialScanAttempted] = useState(false);

  useEffect(() => {
    if (process.env.EXPO_OS !== "android") return;

    const checkLocation = async () => {
      try {
        const enabled = await Location.hasServicesEnabledAsync();
        if (enabled !== locationEnabled) {
          setLocationEnabled(enabled);
        }
      } catch (e) {
        console.error("Failed to check location services:", e);
      }
    };

    checkLocation();
    const interval = setInterval(checkLocation, 2000);
    return () => clearInterval(interval);
  }, [locationEnabled]);

  useEffect(() => {
    checkBluetoothState().then(setBluetoothState);
  }, []);

  useEffect(() => {
    if (bluetoothState !== "off" && bluetoothState !== "turning_on") return;
    const interval = setInterval(async () => {
      const state = await checkBluetoothState();
      if (
        state !== bluetoothState &&
        (bluetoothState !== "turning_on" || state === "on")
      ) {
        setBluetoothState(state);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [bluetoothState]);

  const handleStartScan = React.useCallback(async () => {
    if (bluetoothState === "off" || !locationEnabled) return;
    await startScanWithTimer();
  }, [bluetoothState, locationEnabled, startScanWithTimer]);

  async function handleToggleConnect(device: BleDevice) {
    if (connectingId) return;

    if (connectedDeviceId === device.id) {
      try {
        await disconnectDevice(device.id);
        setDisconnected();
      } catch (err) {
        console.error("Disconnect error:", err);
      }
      return;
    }

    await stopScanAndReset();
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
    if (
      !isBleAvailable ||
      bluetoothState !== "on" ||
      !locationEnabled ||
      initialScanAttempted
    )
      return;
    if (status === "idle") {
      setInitialScanAttempted(true);
      handleStartScan();
    }
  }, [
    bluetoothState,
    locationEnabled,
    status,
    handleStartScan,
    initialScanAttempted,
  ]);

  const displayDevices = React.useMemo(() => {
    const list = [...scannedDevices];
    if (connectedDeviceId && !list.find((d) => d.id === connectedDeviceId)) {
      list.push({
        id: connectedDeviceId,
        name: connectedDeviceName,
        rssi: rssi ?? -100,
      });
    }
    return list.sort((a, b) => {
      if (a.id === connectedDeviceId) return -1;
      if (b.id === connectedDeviceId) return 1;
      return b.rssi - a.rssi;
    });
  }, [scannedDevices, connectedDeviceId, connectedDeviceName, rssi]);

  const scanning = isScanning;

  if (!isBleAvailable) {
    return <BleUnavailableScreen />;
  }

  return (
    <View style={styles.overlay}>
      <Pressable
        style={StyleSheet.absoluteFill}
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
              {bluetoothState === "off"
                ? "Bluetooth is turned off"
                : !locationEnabled
                  ? "Location Services are disabled"
                  : bluetoothState === "turning_on"
                    ? "Bluetooth is turning on..."
                    : scanning
                      ? `Searching... (${scanTimer}s remaining)`
                      : `Scanning stopped · ${scannedDevices.length} found`}
            </Text>
          </View>

          {bluetoothState === "off" ||
            bluetoothState === "turning_on" ||
            !locationEnabled ? (
            <View style={styles.empty}>
              {bluetoothState === "turning_on" ? (
                <ActivityIndicator
                  size="large"
                  color={colors.statusActive}
                  style={{ marginBottom: 16 }}
                />
              ) : !locationEnabled ? (
                <IconMapPinOff color={colors.textTertiary} size={48} />
              ) : (
                <IconBluetoothOff color={colors.textTertiary} size={48} />
              )}

              <Text style={[styles.emptyText, { color: colors.text }]}>
                {bluetoothState === "turning_on"
                  ? "Enabling Bluetooth..."
                  : !locationEnabled
                    ? "Location Disabled"
                    : "Bluetooth is Disabled"}
              </Text>

              <Text
                style={[
                  styles.hintText,
                  { color: colors.textSecondary, marginBottom: 16 },
                ]}
              >
                {bluetoothState === "turning_on"
                  ? "Please wait while Bluetooth is being enabled."
                  : !locationEnabled
                    ? "Location Services are required to scan for BLE devices on Android."
                    : "Please enable Bluetooth to scan for nearby GNSS devices."}
              </Text>

              {process.env.EXPO_OS === "android" && (
                <PressableScale
                  style={[
                    styles.closeBtn,
                    { backgroundColor: colors.statusSurface },
                  ]}
                  onPress={async () => {
                    if (!locationEnabled) {
                      await IntentLauncher.startActivityAsync(
                        IntentLauncher.ActivityAction.LOCATION_SOURCE_SETTINGS,
                      );
                    } else if (bluetoothState === "off") {
                      await IntentLauncher.startActivityAsync(
                        "android.settings.BLUETOOTH_SETTINGS",
                      );
                    }
                  }}
                >
                  <Text
                    style={[
                      styles.closeBtnText,
                      { color: colors.statusActive },
                    ]}
                  >
                    {!locationEnabled
                      ? "Turn On Location"
                      : "Turn On Bluetooth"}
                  </Text>
                </PressableScale>
              )}
            </View>
          ) : (
            <>
              <View style={styles.content}>
                <FlatList
                  data={displayDevices}
                  keyExtractor={(d) => d.id}
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item }) => (
                    <DeviceRow
                      device={item}
                      onPress={() => handleToggleConnect(item)}
                      connecting={connectingId === item.id}
                      connected={connectedDeviceId === item.id}
                    />
                  )}
                  getItemLayout={(_, index) => ({
                    length: 72 + 12,
                    offset: (72 + 12) * index,
                    index,
                  })}
                  removeClippedSubviews={true}
                  initialNumToRender={10}
                  maxToRenderPerBatch={10}
                  windowSize={5}
                  scrollEventThrottle={16}
                  ListEmptyComponent={
                    <View style={styles.empty}>
                      {scanning ? (
                        <View style={{ height: 120 }} />
                      ) : (
                        <View
                          style={{
                            height: 120,
                            justifyContent: "center",
                            alignItems: "center",
                            gap: 16,
                          }}
                        >
                          <IconSearch color={colors.textTertiary} size={48} />
                          <Text
                            style={[styles.emptyText, { color: colors.text }]}
                          >
                            No Devices Found
                          </Text>
                        </View>
                      )}
                    </View>
                  }
                  ListFooterComponent={
                    scanning && displayDevices.length > 0 ? (
                      <View style={styles.listFooter}>
                        <ActivityIndicator
                          size="small"
                          color={colors.statusActive}
                        />
                      </View>
                    ) : null
                  }
                  contentContainerStyle={styles.listContainer}
                  style={{ flex: 1 }}
                />
                {scanning && !connectingId && displayDevices.length === 0 && (
                  <View style={styles.spinnerOverlay} pointerEvents="none">
                    <ActivityIndicator
                      size="large"
                      color={colors.statusActive}
                    />
                  </View>
                )}
              </View>

              <View style={styles.modalFooter}>
                <PressableScale
                  hitSlop={12}
                  onPress={() => router.back()}
                  style={styles.footerBtn}
                >
                  <Text
                    style={[
                      styles.footerBtnText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Cancel
                  </Text>
                </PressableScale>


                <PressableScale
                  hitSlop={12}
                  onPress={
                    scanning
                      ? async () => {
                        setInitialScanAttempted(true);
                        await stopScanAndReset();
                      }
                      : () => {
                        handleStartScan();
                      }
                  }
                  style={[
                    styles.footerBtn,
                    {
                      backgroundColor: scanning
                        ? colors.dangerSurface
                        : colors.statusSurface,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.footerBtnText,
                      { color: scanning ? colors.danger : colors.statusActive },
                    ]}
                  >
                    {scanning ? "Stop" : "Scan"}
                  </Text>
                </PressableScale>

              </View>
            </>
          )}
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
    height: 420,
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
    flex: 1,
    paddingHorizontal: 0,
  },
  listContainer: {
    padding: 24,
    paddingTop: 12,
    gap: 12,
  },
  listFooter: {
    paddingVertical: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  spinnerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },

  hintText: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Lexend_400Regular",
    textAlign: "center",
    paddingHorizontal: 32,
  },
  deviceRow: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    height: 72,
  },
  deviceInfo: {
    flex: 1,
    gap: 4,
  },
  deviceName: {
    fontSize: 16,
    fontFamily: "Lexend_800ExtraBold",
    letterSpacing: -0.2,
  },
  deviceId: {
    fontSize: 11,
    fontFamily: "monospace",
    lineHeight: 14,
    opacity: 0.7,
  },
  rssiWrapper: {
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 4,
    minWidth: 60,
  },
  rssiContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
    height: 20,
    marginBottom: 2,
  },
  rssiText: {
    fontSize: 10,
    fontFamily: "Lexend_600SemiBold",
    fontVariant: ["tabular-nums"],
    opacity: 0.8,
  },
  rowSpinner: {
    marginLeft: 8,
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
    height: 48,
    minWidth: 100,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
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
    height: 48,
    minWidth: 100,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  closeBtnText: {
    fontSize: 14,
    fontFamily: "Lexend_700Bold",
  },
});
