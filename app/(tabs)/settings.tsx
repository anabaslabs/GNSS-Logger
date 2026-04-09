import { ConfirmModal } from "@/components/confirm-modal";
import { PressableScale } from "@/components/pressable-scale";
import {
  NUS_RX_CHAR_UUID,
  NUS_SERVICE_UUID,
  NUS_TX_CHAR_UUID,
} from "@/constants/ble";
import { useAppTheme } from "@/hooks/useAppTheme";
import { disconnectDevice } from "@/lib/ble-manager";
import { useBleStore } from "@/store/ble-store";
import { useGnssStore } from "@/store/gnss-store";
import { useLogStore } from "@/store/log-store";
import { useThemeStore } from "@/store/theme-store";
import {
  IconCopyright,
  IconDeviceMobile,
  IconExternalLink,
  IconFolderOpen,
  IconMoon,
  IconRotate,
  IconSettings,
  IconSun,
  IconTrashX,
} from "@tabler/icons-react-native";
import Constants from "expo-constants";
import * as IntentLauncher from "expo-intent-launcher";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

function SettingRow({
  label,
  description,
  right,
}: {
  label: string;
  description?: string;
  right: React.ReactNode;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.row, { borderTopColor: colors.borderLight }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
        {description && (
          <Text style={[styles.rowDesc, { color: colors.textSecondary }]}>
            {description}
          </Text>
        )}
      </View>
      {right}
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const {
    status,
    isScanning,
    connectedDeviceId,
    connectedDeviceName,
    autoReconnect,
    setAutoReconnect,
    lastError,
    scanTimer,
  } = useBleStore();
  const { clearLiveData } = useGnssStore();
  const { exportDirectoryUri, setExportDirectory, resetExportDirectory } =
    useLogStore();
  const { themeMode, setThemeMode } = useThemeStore();

  const [confirmConfig, setConfirmConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    confirmText?: string;
    isDestructive?: boolean;
    showCancel?: boolean;
    onConfirm: () => void;
  }>({
    visible: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const isConnected = status === "connected";

  async function handleDisconnect() {
    if (!connectedDeviceId) return;
    setConfirmConfig({
      visible: true,
      title: "Disconnect",
      message: `Disconnect from ${connectedDeviceName ?? connectedDeviceId}?`,
      confirmText: "Disconnect",
      isDestructive: true,
      onConfirm: async () => {
        setConfirmConfig((prev) => ({ ...prev, visible: false }));
        await disconnectDevice(connectedDeviceId);
      },
    });
  }

  return (
    <View
      key={isDark ? "dark" : "light"}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ConfirmModal
        visible={confirmConfig.visible}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmText={confirmConfig.confirmText}
        isDestructive={confirmConfig.isDestructive}
        onConfirm={confirmConfig.onConfirm}
        onCancel={
          confirmConfig.showCancel !== false
            ? () => setConfirmConfig((prev) => ({ ...prev, visible: false }))
            : undefined
        }
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        scrollEventThrottle={16}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContainer}
      >
        <View
          style={[
            styles.section,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.sectionHeader, { color: colors.textTertiary }]}>
            Appearance
          </Text>
          <View
            style={[styles.themePicker, { borderTopColor: colors.borderLight }]}
          >
            {(["system", "light", "dark"] as const).map((mode) => (
              <PressableScale
                key={mode}
                onPress={() => setThemeMode(mode)}
                style={[
                  styles.themeOption,
                  themeMode === mode && {
                    backgroundColor: isDark ? "#2C2C2E" : "#F2F2F7",
                    borderColor: colors.tint,
                  },
                ]}
              >
                {mode === "system" && (
                  <IconDeviceMobile
                    size={20}
                    color={
                      themeMode === mode ? colors.tint : colors.textSecondary
                    }
                  />
                )}
                {mode === "light" && (
                  <IconSun
                    size={20}
                    color={
                      themeMode === mode ? colors.tint : colors.textSecondary
                    }
                  />
                )}
                {mode === "dark" && (
                  <IconMoon
                    size={20}
                    color={
                      themeMode === mode ? colors.tint : colors.textSecondary
                    }
                  />
                )}
                <Text
                  style={[
                    styles.themeLabel,
                    {
                      color:
                        themeMode === mode ? colors.text : colors.textSecondary,
                    },
                  ]}
                >
                  {mode === "system"
                    ? "Device"
                    : mode.charAt(0).toUpperCase() + mode.slice(1)}
                </Text>
              </PressableScale>
            ))}
          </View>
        </View>
        <View
          style={[
            styles.section,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.sectionHeader, { color: colors.textTertiary }]}>
            Bluetooth
          </Text>

          <SettingRow
            label="Device"
            description={
              isConnected
                ? (connectedDeviceName ?? connectedDeviceId ?? "Connected")
                : (lastError ?? "Not connected")
            }
            right={
              <PressableScale
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: colors.statusSurface,
                    borderColor: "transparent",
                  },
                  isConnected && {
                    backgroundColor: colors.dangerSurface,
                    borderColor: "transparent",
                  },
                  isScanning &&
                    !isConnected && {
                      backgroundColor: colors.statusSurface,
                      borderColor: "transparent",
                    },
                ]}
                onPress={
                  isConnected
                    ? handleDisconnect
                    : () => router.push("/ble-scan")
                }
                accessibilityRole="button"
              >
                {status === "connecting" && (
                  <ActivityIndicator
                    size="small"
                    color={colors.tint}
                    style={{ marginRight: 4 }}
                  />
                )}
                <Text
                  style={[
                    styles.actionButtonText,
                    { color: colors.statusActive },
                    isConnected && { color: colors.danger },
                  ]}
                >
                  {isConnected
                    ? "Disconnect"
                    : isScanning
                      ? `Scanning (${scanTimer}s)`
                      : status === "connecting"
                        ? "Connecting…"
                        : "Scan & Connect"}
                </Text>
              </PressableScale>
            }
          />

          <SettingRow
            label="Auto-Reconnect"
            description="Automatically reconnect if the BLE connection drops"
            right={
              <Switch
                value={autoReconnect}
                onValueChange={setAutoReconnect}
                trackColor={{
                  false: colors.borderLight,
                  true: colors.statusActive,
                }}
                thumbColor={isDark ? "#FFFFFF" : colors.iconSecondary}
              />
            }
          />
        </View>

        <View
          style={[
            styles.section,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.sectionHeader, { color: colors.textTertiary }]}>
            Module Configuration
          </Text>
          <SettingRow
            label="Device Settings"
            description="Configure constellations, update rate, and system resets"
            right={
              <PressableScale
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: colors.statusSurface,
                    borderColor: "transparent",
                  },
                ]}
                onPress={() => router.push("/device-config")}
              >
                <IconSettings size={16} color={colors.statusActive} />
                <Text
                  style={[
                    styles.actionButtonText,
                    { color: colors.statusActive },
                  ]}
                >
                  Configure
                </Text>
              </PressableScale>
            }
          />
        </View>

        <View
          style={[
            styles.section,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.sectionHeader, { color: colors.textTertiary }]}>
            GNSS Data
          </Text>
          <SettingRow
            label="Clear Live Data"
            description="Reset all parsed GNSS state (position, satellites, velocity)"
            right={
              <PressableScale
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: colors.dangerSurface,
                    borderColor: "transparent",
                  },
                ]}
                onPress={() => {
                  setConfirmConfig({
                    visible: true,
                    title: "Clear Data",
                    message: "Reset all live GNSS data?",
                    confirmText: "Clear",
                    isDestructive: true,
                    onConfirm: () => {
                      setConfirmConfig((prev) => ({ ...prev, visible: false }));
                      clearLiveData();
                    },
                  });
                }}
              >
                <IconRotate size={16} color={colors.danger} />
                <Text
                  style={[styles.actionButtonText, { color: colors.danger }]}
                >
                  Clear
                </Text>
              </PressableScale>
            }
          />
        </View>

        <View
          style={[
            styles.section,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.sectionHeader, { color: colors.textTertiary }]}>
            Exports
          </Text>
          <SettingRow
            label="Target Folder"
            description={
              exportDirectoryUri
                ? "Folder permission granted"
                : "No default folder set"
            }
            right={
              <PressableScale
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: colors.statusSurface,
                    borderColor: "transparent",
                  },
                ]}
                onPress={async () => {
                  const ok = await setExportDirectory();
                  if (ok) {
                    setConfirmConfig({
                      visible: true,
                      title: "Success",
                      message: "Export directory updated.",
                      showCancel: false,
                      onConfirm: () =>
                        setConfirmConfig((prev) => ({
                          ...prev,
                          visible: false,
                        })),
                    });
                  }
                }}
              >
                <IconFolderOpen size={16} color={colors.statusActive} />
                <Text
                  style={[
                    styles.actionButtonText,
                    { color: colors.statusActive },
                  ]}
                >
                  {exportDirectoryUri ? "Change" : "Set"}
                </Text>
              </PressableScale>
            }
          />
          {exportDirectoryUri && (
            <>
              <SettingRow
                label="Open Folder"
                description="View your logs in the external file manager"
                right={
                  <PressableScale
                    style={[
                      styles.actionButton,
                      {
                        backgroundColor: colors.statusSurface,
                        borderColor: "transparent",
                      },
                    ]}
                    onPress={async () => {
                      try {
                        if (Platform.OS === "android" && exportDirectoryUri) {
                          const documentUri = exportDirectoryUri.replace(
                            "/tree/",
                            "/document/",
                          );
                          await IntentLauncher.startActivityAsync(
                            "android.intent.action.VIEW",
                            {
                              data: documentUri,
                              type: "vnd.android.document/directory",
                            },
                          );
                        } else if (exportDirectoryUri) {
                          await Linking.openURL(exportDirectoryUri);
                        }
                      } catch {}
                    }}
                  >
                    <IconExternalLink size={16} color={colors.statusActive} />
                    <Text
                      style={[
                        styles.actionButtonText,
                        { color: colors.statusActive },
                      ]}
                    >
                      Open
                    </Text>
                  </PressableScale>
                }
              />
              <SettingRow
                label="Reset Permission"
                description="Clear the saved folder and ask again on next export"
                right={
                  <PressableScale
                    style={[
                      styles.actionButton,
                      {
                        backgroundColor: colors.dangerSurface,
                        borderColor: "transparent",
                      },
                    ]}
                    onPress={() => {
                      setConfirmConfig({
                        visible: true,
                        title: "Reset Permission",
                        message:
                          "Clear the saved folder? You will be asked to select it again on your next export.",
                        confirmText: "Reset",
                        isDestructive: true,
                        onConfirm: () => {
                          setConfirmConfig((prev) => ({
                            ...prev,
                            visible: false,
                          }));
                          resetExportDirectory();
                        },
                      });
                    }}
                  >
                    <IconTrashX size={16} color={colors.danger} />
                    <Text
                      style={[
                        styles.actionButtonText,
                        { color: colors.danger },
                      ]}
                    >
                      Reset
                    </Text>
                  </PressableScale>
                }
              />
            </>
          )}
        </View>

        <View
          style={[
            styles.section,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.sectionHeader, { color: colors.textTertiary }]}>
            BLE Profile (Nordic UART Service)
          </Text>

          <View
            style={[styles.uuidBlock, { borderTopColor: colors.borderLight }]}
          >
            <Text style={[styles.uuidLabel, { color: colors.textSecondary }]}>
              Service UUID
            </Text>
            <Text
              style={[styles.uuidValue, { color: colors.statusActive }]}
              selectable
            >
              {NUS_SERVICE_UUID}
            </Text>
          </View>
          <View
            style={[styles.uuidBlock, { borderTopColor: colors.borderLight }]}
          >
            <Text style={[styles.uuidLabel, { color: colors.textSecondary }]}>
              TX Characteristic (ESP32 → Phone)
            </Text>
            <Text
              style={[styles.uuidValue, { color: colors.statusActive }]}
              selectable
            >
              {NUS_TX_CHAR_UUID}
            </Text>
          </View>
          <View
            style={[styles.uuidBlock, { borderTopColor: colors.borderLight }]}
          >
            <Text style={[styles.uuidLabel, { color: colors.textSecondary }]}>
              RX Characteristic (Phone → ESP32)
            </Text>
            <Text
              style={[styles.uuidValue, { color: colors.statusActive }]}
              selectable
            >
              {NUS_RX_CHAR_UUID}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.section,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.sectionHeader, { color: colors.textTertiary }]}>
            About
          </Text>
          <View style={styles.aboutBlock}>
            <View style={styles.aboutHeader}>
              <Text style={[styles.aboutTitle, { color: colors.text }]}>
                GNSS Logger
              </Text>
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: colors.statusSurface,
                    borderColor: colors.statusActive + "30",
                  },
                ]}
              >
                <Text
                  style={[styles.badgeText, { color: colors.statusActive }]}
                >
                  v{Constants.expoConfig?.version ?? "1.0.0"}
                </Text>
              </View>
            </View>
            <Text style={[styles.aboutDesc, { color: colors.textSecondary }]}>
              A professional-grade GNSS data logger and visualizer. Connects to
              external high-precision receivers via BLE (Bluetooth Low Energy)
              to capture, parse, and export multi-constellation NMEA and CSV
              data.
              {"\n\n"}
              Features include real-time satellite tracking, live dashboard
              metrics, and session logging for CSV/NMEA export.{"\n\n"}
              Supported Constellations:{"\n"}
              QZSS (Japan), IRNSS/NavIC (India), GPS (USA), GLONASS (Russia),
              Galileo (EU), BeiDou (China)
            </Text>

            <View
              style={[styles.footer, { borderTopColor: colors.borderLight }]}
            >
              <View style={styles.copyrightRow}>
                <IconCopyright size={14} color={colors.textSecondary} />
                <Text
                  style={[
                    styles.copyrightText,
                    { color: colors.textSecondary },
                  ]}
                >
                  2025-2026{" "}
                  <PressableScale
                    onPress={() => Linking.openURL("https://anabaslabs.com")}
                  >
                    <Text
                      style={{
                        color: colors.tint,
                        fontFamily: "Lexend_700Bold",
                      }}
                    >
                      Anabas Labs
                    </Text>
                  </PressableScale>
                  . All rights reserved.
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContainer: { padding: 16, paddingBottom: 40, gap: 16 },
  section: {
    borderRadius: 32,
    borderCurve: "continuous",
    borderWidth: 1,
    padding: 20,
    gap: 0,
  } as any,
  sectionHeader: {
    fontSize: 12,
    fontFamily: "Lexend_800ExtraBold",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: 1.5,
    gap: 16,
  },
  rowLabel: { fontSize: 16, fontFamily: "Lexend_600SemiBold" },
  rowDesc: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
    fontFamily: "Lexend_400Regular",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
    height: 48,
    minWidth: 100,
    paddingHorizontal: 16,
    borderWidth: 0,
    borderColor: "transparent",
  },
  actionButtonText: { fontSize: 14, fontFamily: "Lexend_700Bold" },
  uuidBlock: {
    paddingVertical: 12,
    borderTopWidth: 1.5,
    gap: 4,
  },
  uuidLabel: { fontSize: 12, fontFamily: "Lexend_700Bold" },
  uuidValue: {
    fontSize: 12,
    fontFamily: "monospace",
    fontVariant: ["tabular-nums"],
  },
  aboutBlock: { paddingTop: 10, gap: 8 },
  aboutHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  aboutTitle: { fontSize: 18, fontFamily: "Lexend_800ExtraBold" },
  aboutDesc: { fontSize: 14, lineHeight: 22, fontFamily: "Lexend_400Regular" },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: "Lexend_700Bold",
  },
  themePicker: {
    flexDirection: "row",
    gap: 12,
    borderTopWidth: 1.5,
    paddingTop: 16,
  },
  themeOption: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "transparent",
    gap: 8,
  },
  themeLabel: {
    fontSize: 12,
    fontFamily: "Lexend_700Bold",
  },
  footer: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1.5,
    alignItems: "center",
    gap: 8,
  },
  copyrightRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  copyrightText: {
    fontSize: 12,
    fontFamily: "Lexend_400Regular",
    textAlign: "center",
  },
});
