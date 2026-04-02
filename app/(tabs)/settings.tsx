import { ConfirmModal } from "@/components/confirm-modal";
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
  IconSun,
  IconTrashX,
} from "@tabler/icons-react-native";
import * as IntentLauncher from "expo-intent-launcher";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
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
    connectedDeviceId,
    connectedDeviceName,
    autoReconnect,
    setAutoReconnect,
    lastError,
    scanTimer,
  } = useBleStore();
  const { reset } = useGnssStore();
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
        reset();
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
              <TouchableOpacity
                key={mode}
                activeOpacity={0.7}
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
              </TouchableOpacity>
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
              <Pressable
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: colors.borderLight,
                    borderColor: colors.borderLight,
                  },
                  isConnected && {
                    backgroundColor: colors.dangerSurface,
                    borderColor: colors.dangerBorder,
                  },
                  status === "scanning" && {
                    backgroundColor: colors.statusActive + "15",
                    borderColor: colors.statusActive,
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
                    { color: colors.textSecondary },
                    isConnected && { color: colors.danger },
                    status === "scanning" && { color: colors.statusActive },
                  ]}
                >
                  {isConnected
                    ? "Disconnect"
                    : status === "scanning"
                      ? `Scanning (${scanTimer}s)`
                      : status === "connecting"
                        ? "Connecting…"
                        : "Scan & Connect"}
                </Text>
              </Pressable>
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
            GNSS Data
          </Text>
          <SettingRow
            label="Clear Live Data"
            description="Reset all parsed GNSS state (position, satellites, velocity)"
            right={
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: colors.danger + "10",
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
                      reset();
                    },
                  });
                }}
                activeOpacity={0.7}
              >
                <IconRotate size={16} color={colors.danger} />
                <Text
                  style={[styles.actionButtonText, { color: colors.danger }]}
                >
                  Clear
                </Text>
              </TouchableOpacity>
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
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: colors.statusActive + "15",
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
                activeOpacity={0.7}
              >
                <IconFolderOpen size={16} color={colors.statusActive} />
                <Text
                  style={[
                    styles.actionButtonText,
                    { color: colors.statusActive },
                  ]}
                >
                  {exportDirectoryUri ? "Change" : "Set Folder"}
                </Text>
              </TouchableOpacity>
            }
          />
          {exportDirectoryUri && (
            <>
              <SettingRow
                label="Open Folder"
                description="View your logs in the external file manager"
                right={
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      {
                        backgroundColor: colors.statusActive + "15",
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
                    activeOpacity={0.7}
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
                  </TouchableOpacity>
                }
              />
              <SettingRow
                label="Reset Permission"
                description="Clear the saved folder and ask again on next export"
                right={
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      {
                        backgroundColor: colors.danger + "10",
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
                    activeOpacity={0.7}
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
                  </TouchableOpacity>
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
            <Text style={[styles.aboutTitle, { color: colors.text }]}>
              GNSS Logger
            </Text>
            <Text style={[styles.aboutDesc, { color: colors.textSecondary }]}>
              A professional-grade GNSS data logger and visualizer. Connects to
              external high-precision receivers via Bluetooth LE to capture,
              parse, and export multi-constellation NMEA data.{"\n\n"}
              Features include real-time satellite tracking, live dashboard
              metrics, and session logging for CSV/NMEA export.{"\n\n"}
              Supported Constellations:{"\n"}
              GPS (L1), NavIC/IRNSS (L5), GLONASS, Galileo, BeiDou, QZSS
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
                  2026-2027{" "}
                  <Text
                    style={{ color: colors.tint, fontFamily: "Lexend_700Bold" }}
                    onPress={() => Linking.openURL("https://anabaslabs.com")}
                  >
                    Anabas Labs
                  </Text>
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
    borderRadius: 24,
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
    borderTopWidth: 1,
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
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionButtonText: { fontSize: 14, fontFamily: "Lexend_700Bold" },
  uuidBlock: {
    paddingVertical: 12,
    borderTopWidth: 1,
    gap: 4,
  },
  uuidLabel: { fontSize: 12, fontFamily: "Lexend_700Bold" },
  uuidValue: {
    fontSize: 12,
    fontFamily: "monospace",
    fontVariant: ["tabular-nums"],
  },
  aboutBlock: { paddingTop: 10, gap: 8 },
  aboutTitle: { fontSize: 18, fontFamily: "Lexend_800ExtraBold" },
  aboutDesc: { fontSize: 14, lineHeight: 22, fontFamily: "Lexend_400Regular" },
  themePicker: {
    flexDirection: "row",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#2C2C2E",
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
    borderTopWidth: 1,
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
