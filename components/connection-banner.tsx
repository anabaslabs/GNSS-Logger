import { useAppTheme } from "@/hooks/useAppTheme";
import { isBleAvailable } from "@/lib/ble-manager";
import { useBleStore } from "@/store/ble-store";
import {
  IconAlertTriangle,
  IconBluetooth,
  IconBluetoothConnected,
  IconBluetoothOff,
} from "@tabler/icons-react-native";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { PressableScale } from "./pressable-scale";

const STATUS_COLOR: Record<string, string> = {
  scanning: "#0EA5E9",
  connecting: "#F59E0B",
  connected: "#10B981",
  error: "#EF4444",
};

function getStatusIcon(status: string, color: string) {
  switch (status) {
    case "connected":
      return <IconBluetoothConnected color={color} size={24} />;
    case "error":
      return <IconAlertTriangle color={color} size={24} />;
    case "idle":
      return <IconBluetoothOff color={color} size={24} />;
    default:
      return <IconBluetooth color={color} size={24} />;
  }
}

const STATUS_LABEL: Record<string, string> = {
  idle: "Not Connected",
  scanning: "Scanning…",
  connecting: "Connecting…",
  connected: "Connected",
  disconnecting: "Disconnecting…",
  error: "Error",
};

export function ConnectionBanner() {
  const { status, isScanning, connectedDeviceName, lastError, scanTimer } =
    useBleStore();
  const router = useRouter();
  const { colors } = useAppTheme();

  const color = STATUS_COLOR[status] ?? colors.iconSecondary;
  const isConnected = status === "connected";

  const label =
    isConnected && connectedDeviceName
      ? connectedDeviceName
      : lastError && status === "error"
        ? `Error: ${lastError}`
        : (STATUS_LABEL[status] ?? status);

  const hint = isScanning
    ? `Scanning… (${scanTimer}s)`
    : isConnected
      ? "Connected & Live"
      : "Tap to scan devices";

  if (!isBleAvailable) {
    return (
      <PressableScale
        style={[
          styles.banner,
          {
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          },
        ]}
        onPress={() => router.push("/ble-scan")}
      >
        <View style={[styles.iconBox, { backgroundColor: colors.borderLight }]}>
          <IconBluetoothOff color={colors.textSecondary} size={24} />
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.text, { color: colors.text }]}>
            Custom build needed for BLE
          </Text>
          <Text style={[styles.tapHint, { color: colors.textSecondary }]}>
            Tap for info
          </Text>
        </View>
      </PressableScale>
    );
  }

  return (
    <PressableScale
      style={[
        styles.banner,
        {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        },
      ]}
      onPress={() => router.push("/ble-scan")}
    >
      <View style={[styles.iconBox, { backgroundColor: color + "22" }]}>
        {getStatusIcon(status, color)}
      </View>
      <View style={styles.textContainer}>
        <Text style={[styles.text, { color: colors.text }]} numberOfLines={1}>
          {label}
        </Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginTop: 4,
          }}
        >
          <Text
            style={[
              styles.tapHint,
              { color: isConnected ? colors.textSecondary : color },
            ]}
          >
            {hint}
          </Text>
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  banner: {
    height: 80,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    borderRadius: 32,
    borderCurve: "continuous",
    gap: 16,
  } as any,
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0,
  },
  textContainer: {
    flex: 1,
    justifyContent: "center",
  },
  text: {
    fontSize: 16,
    fontFamily: "Lexend_700Bold",
  },
  tapHint: {
    fontSize: 12,
    fontFamily: "Lexend_600SemiBold",
  },
});
