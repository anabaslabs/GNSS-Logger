import { ConfirmModal } from "@/components/confirm-modal";
import { PressableScale } from "@/components/pressable-scale";
import { useAppTheme } from "@/hooks/useAppTheme";
import { sendCommand } from "@/lib/ble-manager";
import { generateNmeaCommand } from "@/lib/nmea-parser";
import { TALKER_ID, CONSTELLATION_COLOR } from "@/constants/nmea";
import { useBleStore } from "@/store/ble-store";
import { useConfigStore } from "@/store/config-store";
import { Stack } from "expo-router";
import React, { useState } from "react";
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
}

function ConfigSection({ title, children }: ConfigSectionProps) {
  const { colors } = useAppTheme();
  return (
    <View
      style={[
        styles.section,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.sectionHeader, { color: colors.textTertiary }]}>
        {title}
      </Text>
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
    setConstellation,
    setUpdateRate,
    setShowCombinedTalker,
    setSbasEnabled,
  } = useConfigStore();

  const [customCommand, setCustomCommand] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    confirmText?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }>({
    visible: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const isConnected = status === "connected";

  const handleSendCommand = async (payload: string, label: string) => {
    if (!isConnected || !connectedDeviceId) {
      Alert.alert("Error", "Device not connected");
      return;
    }

    const fullCommand = generateNmeaCommand(payload);
    setIsSending(true);
    try {
      await sendCommand(connectedDeviceId, fullCommand);
      // Small delay to show feedback
      setTimeout(() => setIsSending(false), 500);
    } catch (error) {
      setIsSending(false);
      Alert.alert(
        "Command Failed",
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  };

  const handleToggleConstellation = (
    key: keyof typeof deviceConfig.constellations,
    value: boolean,
  ) => {
    setConstellation(key, value);
    // Construct the PAIR066 command
    // Order: GPS, GLONASS, Galileo, BeiDou, QZSS, NavIC
    const c = { ...deviceConfig.constellations, [key]: value };
    const payload = `PAIR066,${c.gps ? 1 : 0},${c.glonass ? 1 : 0},${c.galileo ? 1 : 0},${c.beidou ? 1 : 0},${c.qzss ? 1 : 0},${c.navic ? 1 : 0}`;
    handleSendCommand(payload, `Update ${key.toUpperCase()}`);
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
    // Request version
    await handleSendCommand("PQTMVERNO", "Fetch Version");
    Alert.alert(
      "Version Requested",
      "Check the raw logs tab for the response starting with $PQTMVERNO.",
    );
  };

  const handleSaveToFlash = () => {
    handleSendCommand("PAIR513", "Save to Flash");
  };

  const handlePushConfig = async () => {
    if (!isConnected || !connectedDeviceId) {
      Alert.alert("Error", "Device not connected");
      return;
    }

    const { constellations, updateRateMs, sbasEnabled } = deviceConfig;

    // 1. Constellations command
    const cPayload = `PAIR066,${constellations.gps ? 1 : 0},${constellations.glonass ? 1 : 0},${constellations.galileo ? 1 : 0},${constellations.beidou ? 1 : 0},${constellations.qzss ? 1 : 0},${constellations.navic ? 1 : 0}`;

    // 2. Update rate command
    const rPayload = `PAIR050,${updateRateMs}`;

    // 3. SBAS command
    const sPayload = `PAIR410,${sbasEnabled ? 1 : 0}`;

    setIsSending(true);
    try {
      await sendCommand(connectedDeviceId, generateNmeaCommand(cPayload));
      // Short delay between commands
      await new Promise((resolve) => setTimeout(resolve, 200));
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
              onPress={() => handleSendCommand("PAIR002,0", "Power Reset")}
            >
              <Text
                style={[styles.resetButtonText, { color: colors.statusActive }]}
              >
                Power Reset
              </Text>
            </PressableScale>
          </View>

          <View style={styles.buttonRow}>
            <PressableScale
              style={[
                styles.resetButton,
                { backgroundColor: colors.statusSurface },
              ]}
              onPress={() => handleSendCommand("PAIR004", "Hot Start")}
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
              onPress={() => handleSendCommand("PAIR005", "Warm Start")}
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
                { backgroundColor: colors.dangerSurface },
              ]}
              onPress={() =>
                setConfirmConfig({
                  visible: true,
                  title: "Cold Start",
                  message: "This will reset ephemeris data. Proceed?",
                  confirmText: "Cold Start",
                  isDestructive: true,
                  onConfirm: () => {
                    handleSendCommand("PAIR006", "Cold Start");
                    setConfirmConfig((prev) => ({ ...prev, visible: false }));
                  },
                })
              }
            >
              <Text style={[styles.resetButtonText, { color: colors.danger }]}>
                Cold Start
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
                  title: "Full Cold Start",
                  message:
                    "Factory reset: clears all data and settings. Proceed?",
                  confirmText: "Factory Reset",
                  isDestructive: true,
                  onConfirm: () => {
                    handleSendCommand("PAIR007", "Full Cold Start");
                    setConfirmConfig((prev) => ({ ...prev, visible: false }));
                  },
                })
              }
            >
              <Text style={[styles.resetButtonText, { color: colors.danger }]}>
                Full Cold Start
              </Text>
            </PressableScale>
          </View>
        </ConfigSection>

        <ConfigSection title="Constellations">
          <View style={styles.constellationGrid}>
            {Object.entries(deviceConfig.constellations)
              .sort((a, b) => b[0].localeCompare(a[0]))
              .map(([key, value]) => {
                const talkerId = ({
                  gps: TALKER_ID.GPS,
                  glonass: TALKER_ID.GLONASS,
                  galileo: TALKER_ID.GALILEO,
                  beidou: TALKER_ID.BEIDOU,
                  qzss: TALKER_ID.QZSS,
                  navic: TALKER_ID.NAVIC,
                } as any)[key];

                const labelMap: Record<string, string> = {
                  gps: "GPS (US)",
                  glonass: "GLONASS (RU)",
                  galileo: "Galileo (EU)",
                  beidou: "BeiDou (CN)",
                  qzss: "QZSS (JP)",
                  navic: "NavIC (IN)",
                };

                const color =
                  CONSTELLATION_COLOR[talkerId] || colors.textTertiary;

                return (
                  <PressableScale
                    key={key}
                    onPress={() =>
                      handleToggleConstellation(key as any, !value)
                    }
                    style={[
                      styles.constGridItem,
                      {
                        backgroundColor: isDark ? color + "10" : color + "05",
                        borderColor: color + "20",
                      },
                      value && {
                        backgroundColor: color + "20",
                        borderColor: color,
                        borderWidth: 1,
                      },
                    ]}
                  >
                    <View style={styles.constRowTop}>
                      <Text
                        style={[
                          styles.constGridLabel,
                          { color: value ? color : colors.text },
                        ]}
                      >
                        {labelMap[key] || key.toUpperCase()}
                      </Text>
                    </View>
                  </PressableScale>
                );
              })}
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
          <Text
            style={[
              styles.hintText,
              { color: colors.textTertiary, marginTop: 12 },
            ]}
          >
            Higher rates (5Hz+) may require increasing the baud rate to avoid
            NMEA overflow.
          </Text>
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
                placeholder="e.g. PAIR003"
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
            Checksum will be automatically calculated and appended.
          </Text>
        </ConfigSection>

        <ConfigSection title="Module Info">
          <SettingRow
            label="Firmware Version"
            description="Request module ID and firmware build info"
            right={
              <PressableScale
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: colors.statusSurface,
                    borderColor: "transparent",
                  },
                ]}
                onPress={handleFetchVersion}
              >
                <Text
                  style={[
                    styles.actionButtonText,
                    { color: colors.statusActive },
                  ]}
                >
                  Query
                </Text>
              </PressableScale>
            }
          />
        </ConfigSection>

        <View style={styles.footer}>
          <PressableScale
            style={[
              styles.pushButton,
              {
                backgroundColor: isDark
                  ? colors.tint + "15"
                  : colors.statusSurface,
                borderColor: colors.tint + "33",
                marginBottom: 12,
              },
            ]}
            onPress={handlePushConfig}
          >
            <Text style={[styles.saveButtonText, { color: colors.tint }]}>
              Push Configuration to Device
            </Text>
          </PressableScale>

          <PressableScale
            style={[
              styles.saveButton,
              {
                backgroundColor: colors.statusSurface,
                borderColor: colors.statusActive + "33",
              },
            ]}
            onPress={handleSaveToFlash}
          >
            <Text
              style={[styles.saveButtonText, { color: colors.statusActive }]}
            >
              Save Settings to Flash
            </Text>
          </PressableScale>
          <Text
            style={[
              styles.hintText,
              {
                textAlign: "center",
                color: colors.textTertiary,
                marginTop: 12,
              },
            ]}
          >
            Settings saved to flash persist across module reboots.
          </Text>
        </View>
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
  list: {
    gap: 0,
  },
  constellationGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingTop: 8,
  },
  constGridItem: {
    width: "48.2%",
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  constRowTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  constRowBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  constGridLabel: {
    fontSize: 14,
    fontFamily: "Lexend_700Bold",
    letterSpacing: -0.5,
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
});
