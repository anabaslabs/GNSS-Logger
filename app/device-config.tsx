import { ConfirmModal } from "@/components/confirm-modal";
import { PressableScale } from "@/components/pressable-scale";
import { CONSTELLATION_COLOR } from "@/constants/nmea";
import { useAppTheme } from "@/hooks/useAppTheme";
import { onNmeaLine, sendCommand } from "@/lib/ble-manager";
import { generateNmeaCommand, parseNmea } from "@/lib/nmea-parser";
import { useBleStore } from "@/store/ble-store";
import { useConfigStore } from "@/store/config-store";
import { IconRefresh } from "@tabler/icons-react-native";
import { Stack } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

interface ConfigSectionProps {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}

function ConfigSection({ title, children, action }: ConfigSectionProps) {
  const { colors } = useAppTheme();
  return (
    <View
      style={[
        styles.section,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionHeader, { color: colors.textTertiary }]}>
          {title}
        </Text>
        {action}
      </View>
      <View
        style={[styles.separator, { backgroundColor: colors.borderLight }]}
      />
      {children}
    </View>
  );
}

interface SettingRowProps {
  label: string;
  description?: string;
  right?: React.ReactNode;
}

function SettingRow({ label, description, right }: SettingRowProps) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.settingRow, { borderTopColor: colors.borderLight }]}>
      <View style={styles.settingTextContainer}>
        <Text style={[styles.settingLabel, { color: colors.text }]}>
          {label}
        </Text>
        {description && (
          <Text
            style={[styles.settingDescription, { color: colors.textSecondary }]}
          >
            {description}
          </Text>
        )}
      </View>
      {right}
    </View>
  );
}

export default function DeviceConfigScreen() {
  const { colors, isDark } = useAppTheme();
  const { connectedDeviceId, status } = useBleStore();
  const {
    deviceConfig,
    setConstellations,
    setUpdateRate,
    setShowCombinedTalker,
    setSbasEnabled,
    setFirmwareVersion,
  } = useConfigStore();

  const isConnected = status === "connected";
  const [customCommand, setCustomCommand] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    confirmText: string;
    onConfirm: () => void;
    isDestructive?: boolean;
  }>({
    visible: false,
    title: "",
    message: "",
    confirmText: "",
    onConfirm: () => {},
  });

  const lastAlertRef = useRef<{ msg: string; time: number } | null>(null);

  useEffect(() => {
    if (!isConnected) return;

    const unsub = onNmeaLine((line) => {
      const parsed = parseNmea(line);
      if (!parsed) return;

      if (parsed.type === "PAIR67") {
        setConstellations(parsed.data);
        return;
      }

      if (parsed.type === "PAIR050") {
        setUpdateRate(parsed.data);
        return;
      }

      if (parsed.type === "PAIR410") {
        setSbasEnabled(parsed.data);
        return;
      }

      if (parsed.type === "VER") {
        const { version, date, time } = parsed.data;
        if (version && date && time) {
          setFirmwareVersion(`${version} (${date} ${time})`);
        } else if (version) {
          setFirmwareVersion(version);
        }
        return;
      }

      if (parsed.type === "ACK") {
        const { cmdId, result } = parsed.data;
        const normalizedId = parseInt(cmdId, 10).toString();

        const statusMap: Record<
          number,
          { title: string; type: "success" | "error" | "info" }
        > = {
          0: { title: "Success", type: "success" },
          1: { title: "Failed", type: "error" },
          2: { title: "Unsupported", type: "error" },
          3: { title: "Operation Failed", type: "error" },
          4: { title: "Parameter Error", type: "error" },
        };

        const cmdMap: Record<string, string> = {
          "66": "Set Constellations",
          "67": "Query Constellations",
          "50": "Update Rate",
          "410": "SBAS Mode",
          "51": "Baud Rate",
          "513": "Flash Save",
          "2": "Power Reset",
          "4": "Hot Start",
          "5": "Warm Start",
          "6": "Cold Start",
          "7": "Full Cold Start",
          "511": "Factory Reset",
          "864": "Baud Change",
          "21": "Module Status",
        };

        const resetCmds = ["4", "5", "6", "7", "511"];

        if (resetCmds.includes(normalizedId) && result === 1) {
          return;
        }

        if (normalizedId === "21") {
          return;
        }

        const s = statusMap[result ?? -1] || {
          title: `Error (${result})`,
          type: "error",
        };
        const cmdLabel = cmdMap[normalizedId] || `Command ${cmdId}`;

        const alertTitle = `${s.title}: ${cmdLabel}`;
        const alertMsg =
          result === 0
            ? "The command was successfully applied by the module."
            : result === 4
              ? "The module rejected the command due to incorrect parameters or malformed string. Verify the command format."
              : `The module rejected the command. Error code: ${result}. Verify parameters or baud rate.`;

        const now = Date.now();
        if (
          lastAlertRef.current &&
          lastAlertRef.current.msg === alertTitle + alertMsg &&
          now - lastAlertRef.current.time < 1000
        ) {
          return;
        }
        lastAlertRef.current = { msg: alertTitle + alertMsg, time: now };

        Alert.alert(alertTitle, alertMsg, [{ text: "OK" }]);
      }
    });

    return () => unsub();
  }, [isConnected]);

  const handleSendCommand = async (payload: string, label: string) => {
    if (!isConnected || !connectedDeviceId) {
      Alert.alert("Error", "Device not connected");
      return;
    }

    const fullCommand = generateNmeaCommand(payload);
    setIsSending(true);
    try {
      await sendCommand(connectedDeviceId, fullCommand);
      setTimeout(() => setIsSending(false), 500);
    } catch (error) {
      setIsSending(false);
      Alert.alert(
        "Command Failed",
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  };

  const handleUpdateRate = (rateMs: number) => {
    setUpdateRate(rateMs);
    handleSendCommand(`PAIR050,${rateMs}`, `Set Rate ${1000 / rateMs}Hz`);
  };

  const handleToggleSbas = (enabled: boolean) => {
    setSbasEnabled(enabled);
    handleSendCommand(
      `PAIR410,${enabled ? 1 : 0}`,
      `SBAS ${enabled ? "ON" : "OFF"}`,
    );
  };

  const handleFetchVersion = async () => {
    await handleSendCommand("PQTMVERNO", "Fetch Version");
  };

  const handleQueryConstellations = async () => {
    await handleSendCommand("PAIR067", "Query Constellations");
  };

  const handleSaveToFlash = () => {
    handleSendCommand("PAIR513", "Save to Flash");
  };

  const handlePullConfig = async () => {
    if (!isConnected || !connectedDeviceId) {
      Alert.alert("Error", "Device not connected");
      return;
    }

    setIsSending(true);
    try {
      await sendCommand(connectedDeviceId, generateNmeaCommand("PAIR050"));
      await new Promise((resolve) => setTimeout(resolve, 200));

      await sendCommand(connectedDeviceId, generateNmeaCommand("PAIR410"));
      await new Promise((resolve) => setTimeout(resolve, 200));

      await sendCommand(connectedDeviceId, generateNmeaCommand("PAIR067"));
      await new Promise((resolve) => setTimeout(resolve, 200));

      await sendCommand(connectedDeviceId, generateNmeaCommand("PQTMVERNO"));

      setTimeout(() => {
        setIsSending(false);
      }, 1000);
    } catch (error) {
      setIsSending(false);
      Alert.alert(
        "Pull Failed",
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  };

  const handlePushConfig = async () => {
    if (!isConnected || !connectedDeviceId) {
      Alert.alert("Error", "Device not connected");
      return;
    }

    const { constellations, updateRateMs, sbasEnabled } = deviceConfig;

    const rPayload = `PAIR050,${updateRateMs}`;
    const sPayload = `PAIR410,${sbasEnabled ? 1 : 0}`;

    setIsSending(true);
    try {
      await sendCommand(connectedDeviceId, generateNmeaCommand(rPayload));
      await new Promise((resolve) => setTimeout(resolve, 200));
      await sendCommand(connectedDeviceId, generateNmeaCommand(sPayload));

      setTimeout(() => {
        setIsSending(false);
        Alert.alert("Success", "Configuration pushed to device successfully.");
      }, 500);
    } catch (error) {
      setIsSending(false);
      Alert.alert(
        "Push Failed",
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ConfirmModal
        visible={confirmConfig.visible}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmText={confirmConfig.confirmText}
        isDestructive={confirmConfig.isDestructive}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() =>
          setConfirmConfig((prev) => ({ ...prev, visible: false }))
        }
      />
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Device Configuration",
        }}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {!isConnected && (
          <View
            style={[
              styles.warningBanner,
              { backgroundColor: colors.dangerSurface },
            ]}
          >
            <Text style={[styles.warningText, { color: colors.danger }]}>
              Device disconnected. Commands cannot be sent.
            </Text>
          </View>
        )}

        <ConfigSection title="System Resets">
          <View style={styles.buttonRow}>
            <PressableScale
              style={[
                styles.resetButton,
                { backgroundColor: colors.statusSurface },
              ]}
              onPress={() =>
                setConfirmConfig({
                  visible: true,
                  title: "Hot Start",
                  message:
                    "Restarts using all available data (ephemeris, almanac, time, and position) for the fastest fix. Proceed?",
                  confirmText: "Hot Start",
                  onConfirm: () => {
                    handleSendCommand("PAIR004", "Hot Start");
                    setConfirmConfig((prev) => ({ ...prev, visible: false }));
                  },
                })
              }
            >
              <Text
                style={[styles.resetButtonText, { color: colors.statusActive }]}
              >
                Hot Start
              </Text>
            </PressableScale>
            <PressableScale
              style={[
                styles.resetButton,
                { backgroundColor: colors.statusSurface },
              ]}
              onPress={() =>
                setConfirmConfig({
                  visible: true,
                  title: "Warm Start",
                  message:
                    "Restarts without using ephemeris data, but retains almanac, time, and position. Proceed?",
                  confirmText: "Warm Start",
                  onConfirm: () => {
                    handleSendCommand("PAIR005", "Warm Start");
                    setConfirmConfig((prev) => ({ ...prev, visible: false }));
                  },
                })
              }
            >
              <Text
                style={[styles.resetButtonText, { color: colors.statusActive }]}
              >
                Warm Start
              </Text>
            </PressableScale>
          </View>

          <View style={styles.buttonRow}>
            <PressableScale
              style={[
                styles.resetButton,
                { backgroundColor: colors.warningSurface },
              ]}
              onPress={() =>
                setConfirmConfig({
                  visible: true,
                  title: "Cold Start",
                  message:
                    "Restarts without using position, almanac, or ephemeris data. Proceed?",
                  confirmText: "Cold Start",
                  isDestructive: true,
                  onConfirm: () => {
                    handleSendCommand("PAIR006", "Cold Start");
                    setConfirmConfig((prev) => ({ ...prev, visible: false }));
                  },
                })
              }
            >
              <Text style={[styles.resetButtonText, { color: colors.warning }]}>
                Cold Start
              </Text>
            </PressableScale>
            <PressableScale
              style={[
                styles.resetButton,
                { backgroundColor: colors.warningSurface },
              ]}
              onPress={() =>
                setConfirmConfig({
                  visible: true,
                  title: "Full Cold Start",
                  message:
                    "Clears all internal data including flash-based configurations and returns the module to its factory default state. Proceed?",
                  confirmText: "Factory Reset",
                  isDestructive: true,
                  onConfirm: () => {
                    handleSendCommand("PAIR007", "Full Cold Start");
                    setConfirmConfig((prev) => ({ ...prev, visible: false }));
                  },
                })
              }
            >
              <Text style={[styles.resetButtonText, { color: colors.warning }]}>
                Full Cold Start
              </Text>
            </PressableScale>
          </View>

          <View style={styles.buttonRow}>
            <PressableScale
              style={[
                styles.resetButton,
                { backgroundColor: colors.dangerSurface },
              ]}
              onPress={() =>
                setConfirmConfig({
                  visible: true,
                  title: "Power Reset",
                  message:
                    "Triggers a system power-on/reboot of the GNSS subsystem (DSP, RF, and Clock). Proceed?",
                  confirmText: "Power Reset",
                  isDestructive: true,
                  onConfirm: () => {
                    handleSendCommand("PAIR002", "Power Reset");
                    setConfirmConfig((prev) => ({ ...prev, visible: false }));
                  },
                })
              }
            >
              <Text style={[styles.resetButtonText, { color: colors.danger }]}>
                Power Reset
              </Text>
            </PressableScale>
            <PressableScale
              style={[
                styles.resetButton,
                { backgroundColor: colors.dangerSurface },
              ]}
              onPress={() =>
                setConfirmConfig({
                  visible: true,
                  title: "Factory Reset",
                  message:
                    "This will wipe ALL custom settings (Baud rate, Constellations, Update rate) and return the module to Quectel defaults. Proceed?",
                  confirmText: "Wipe & Reset",
                  isDestructive: true,
                  onConfirm: () => {
                    handleSendCommand("PAIR511", "Factory Reset");
                    setConfirmConfig((prev) => ({ ...prev, visible: false }));
                  },
                })
              }
            >
              <Text style={[styles.resetButtonText, { color: colors.danger }]}>
                Factory Reset
              </Text>
            </PressableScale>
          </View>
        </ConfigSection>

        <ConfigSection title="Update Rate">
          <View style={styles.rateRow}>
            {[1000, 500, 200, 100].map((rate) => (
              <PressableScale
                key={rate}
                style={[
                  styles.rateButton,
                  { borderColor: colors.border },
                  deviceConfig.updateRateMs === rate && {
                    backgroundColor: isDark
                      ? colors.tint + "15"
                      : colors.statusSurface,
                    borderColor: colors.tint,
                  },
                ]}
                onPress={() => handleUpdateRate(rate)}
              >
                <Text
                  style={[
                    styles.rateButtonText,
                    { color: colors.textSecondary },
                    deviceConfig.updateRateMs === rate && {
                      color: colors.tint,
                    },
                  ]}
                >
                  {1000 / rate}Hz
                </Text>
              </PressableScale>
            ))}
          </View>
        </ConfigSection>

        <ConfigSection title="Log Filtering">
          <SettingRow
            label="Log Combined Talker (GN)"
            description="If disabled, sentences starting with $GN (like GNGGA) will be removed from recorded logs."
            right={
              <Switch
                value={deviceConfig.showCombinedTalker}
                onValueChange={setShowCombinedTalker}
                trackColor={{
                  false: colors.borderLight,
                  true: colors.statusActive,
                }}
                thumbColor={isDark ? "#FFF" : "#F4F3F4"}
              />
            }
          />
          <View
            style={[styles.separator, { backgroundColor: colors.borderLight }]}
          />
          <SettingRow
            label="Enable SBAS"
            description="Satellite Based Augmentation Systems (WAAS, EGNOS, GAGAN)."
            right={
              <Switch
                value={deviceConfig.sbasEnabled}
                onValueChange={handleToggleSbas}
                trackColor={{
                  false: colors.borderLight,
                  true: colors.statusActive,
                }}
                thumbColor={isDark ? "#FFF" : "#F4F3F4"}
              />
            }
          />
        </ConfigSection>

        <ConfigSection title="Manual Command">
          <View style={styles.manualRow}>
            <View
              style={[
                styles.inputContainer,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                  flex: 1,
                },
              ]}
            >
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="e.g. $PAIR067"
                placeholderTextColor={colors.textTertiary}
                value={customCommand}
                onChangeText={setCustomCommand}
                autoCapitalize="characters"
                autoCorrect={false}
              />
            </View>
            <PressableScale
              style={[
                styles.actionButton,
                {
                  backgroundColor: colors.statusSurface,
                },
              ]}
              onPress={() => {
                if (!customCommand) return;
                handleSendCommand(customCommand, "Custom");
                setCustomCommand("");
              }}
            >
              <Text
                style={[
                  styles.actionButtonText,
                  { color: colors.statusActive },
                ]}
              >
                Send
              </Text>
            </PressableScale>
          </View>
          <Text
            style={[
              styles.hintText,
              { color: colors.textTertiary, marginTop: 12 },
            ]}
          >
            Accepts full NMEA strings or just the body. Checksum is calculated
            automatically if missing.
          </Text>
        </ConfigSection>

        <ConfigSection
          title="Active Systems"
          action={
            <PressableScale
              onPress={handleQueryConstellations}
              style={{
                padding: 0,
              }}
            >
              <IconRefresh color={colors.statusActive} size={22} />
            </PressableScale>
          }
        >
          <View style={styles.constellationRow}>
            {Object.entries(deviceConfig.constellations)
              .filter(([_, enabled]) => enabled)
              .map(([key]) => {
                const mapping: Record<string, { id: string; label: string }> = {
                  gps: { id: "GP", label: "GPS" },
                  glonass: { id: "GL", label: "GLONASS" },
                  galileo: { id: "GA", label: "Galileo" },
                  beidou: { id: "GB", label: "BeiDou" },
                  qzss: { id: "GQ", label: "QZSS" },
                  navic: { id: "GI", label: "NavIC" },
                };
                return { key, ...mapping[key] };
              })
              .map((item) => {
                const color =
                  CONSTELLATION_COLOR[item.id] || colors.textTertiary;
                return (
                  <View
                    key={item.key}
                    style={[
                      styles.constBadge,
                      {
                        backgroundColor: color + "15",
                        borderColor: color + "33",
                      },
                    ]}
                  >
                    <View
                      style={[styles.constDot, { backgroundColor: color }]}
                    />
                    <Text
                      style={[styles.constLabel, { color: color }]}
                      numberOfLines={1}
                    >
                      {item.label}
                    </Text>
                  </View>
                );
              })}
            {Object.values(deviceConfig.constellations).every((v) => !v) && (
              <Text
                style={[
                  styles.hintText,
                  { color: colors.textTertiary, paddingVertical: 8 },
                ]}
              >
                Not queried. Tap refresh to fetch.
              </Text>
            )}
          </View>
        </ConfigSection>

        <ConfigSection
          title="Firmware Version"
          action={
            <PressableScale
              onPress={handleFetchVersion}
              style={{
                padding: 0,
              }}
            >
              <IconRefresh color={colors.statusActive} size={22} />
            </PressableScale>
          }
        >
          <View style={styles.infoContent}>
            {deviceConfig.firmwareVersion ? (
              <Text style={[styles.infoText, { color: colors.text }]}>
                {deviceConfig.firmwareVersion}
              </Text>
            ) : (
              <Text style={[styles.hintText, { color: colors.textTertiary }]}>
                Not queried. Tap refresh to fetch.
              </Text>
            )}
          </View>
        </ConfigSection>

        <ConfigSection title="Config Sync">
          <View style={styles.buttonRow}>
            <PressableScale
              style={[
                styles.resetButton,
                {
                  backgroundColor: isDark
                    ? colors.tint + "15"
                    : colors.statusSurface,
                },
              ]}
              onPress={handlePullConfig}
            >
              <Text style={[styles.resetButtonText, { color: colors.tint }]}>
                Pull Config
              </Text>
            </PressableScale>

            <PressableScale
              style={[
                styles.resetButton,
                {
                  backgroundColor: isDark
                    ? colors.tint + "15"
                    : colors.statusSurface,
                },
              ]}
              onPress={handlePushConfig}
            >
              <Text style={[styles.resetButtonText, { color: colors.tint }]}>
                Push Config
              </Text>
            </PressableScale>
          </View>

          <PressableScale
            style={[
              styles.resetButton,
              {
                marginTop: 4,
                backgroundColor: colors.statusSurface,
              },
            ]}
            onPress={handleSaveToFlash}
          >
            <Text
              style={[styles.resetButtonText, { color: colors.statusActive }]}
            >
              Save Config to Flash
            </Text>
          </PressableScale>
        </ConfigSection>
      </ScrollView>

      {isSending && (
        <View style={styles.overlay}>
          <View
            style={[styles.loaderCard, { backgroundColor: colors.surface }]}
          >
            <ActivityIndicator size="large" color={colors.tint} />
            <Text style={[styles.loaderText, { color: colors.text }]}>
              Sending Command...
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16, gap: 16, paddingBottom: 60 },
  section: {
    padding: 20,
    borderRadius: 32,
    borderWidth: 1,
    borderCurve: "continuous" as any,
    gap: 0,
  },
  sectionHeader: {
    fontSize: 12,
    fontFamily: "Lexend_800ExtraBold",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 0,
    flex: 1,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  separator: {
    height: 1,
    width: "100%",
    marginTop: 12,
    marginBottom: 12,
  },
  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 16,
    borderCurve: "continuous" as any,
    gap: 10,
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    fontFamily: "Lexend_600SemiBold",
    flex: 1,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 8,
  },
  resetButton: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    borderCurve: "continuous" as any,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  resetButtonText: {
    fontSize: 14,
    fontFamily: "Lexend_700Bold",
    textAlign: "center",
  },
  rateRow: {
    flexDirection: "row",
    gap: 12,
  },
  rateButton: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    borderCurve: "continuous" as any,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  rateButtonText: {
    fontSize: 14,
    fontFamily: "Lexend_700Bold",
  },
  divider: {
    height: 1,
    width: "100%",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    paddingVertical: 12,
  },
  settingTextContainer: {
    flex: 1,
    gap: 2,
  },
  constellationRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 10,
    columnGap: 8,
    marginTop: 12,
  },
  constBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 16,
    borderCurve: "continuous" as any,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: "47%",
    flexGrow: 1,
  },
  constDot: { width: 7, height: 7, borderRadius: 3.5 },
  constLabel: {
    fontSize: 13,
    fontFamily: "Lexend_700Bold",
    flexShrink: 1,
    marginTop: -2,
  },
  refreshRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  settingLabel: {
    fontSize: 16,
    fontFamily: "Lexend_600SemiBold",
  },
  settingDescription: {
    fontSize: 13,
    fontFamily: "Lexend_400Regular",
    lineHeight: 18,
    marginTop: 2,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
    borderCurve: "continuous" as any,
    height: 48,
    minWidth: 100,
    paddingHorizontal: 16,
    borderWidth: 0,
    borderColor: "transparent",
  },
  actionButtonText: {
    fontSize: 14,
    fontFamily: "Lexend_700Bold",
  },
  hintText: {
    fontSize: 12,
    fontFamily: "Lexend_400Regular",
    lineHeight: 18,
  },
  manualRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    marginTop: 4,
  },
  inputContainer: {
    height: 48,
    borderRadius: 20,
    borderCurve: "continuous" as any,
    borderWidth: 1,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  input: {
    height: "100%",
    fontFamily: "monospace",
    fontSize: 15,
  },
  footer: {
    marginTop: 12,
  },
  saveButton: {
    height: 56,
    borderRadius: 20,
    borderCurve: "continuous" as any,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: "Lexend_700Bold",
  },
  pushButton: {
    height: 56,
    borderRadius: 20,
    borderCurve: "continuous" as any,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  loaderCard: {
    padding: 24,
    borderRadius: 24,
    alignItems: "center",
    gap: 12,
    minWidth: 160,
  },
  loaderText: {
    fontSize: 14,
    fontFamily: "Lexend_600SemiBold",
  },
  infoContent: {
    paddingVertical: 12,
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    fontFamily: "Lexend_400Regular",
  },
});
