import { ConfirmModal } from '@/components/confirm-modal';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useBleStore } from '@/store/ble-store';
import { useGnssStore } from '@/store/gnss-store';
import { useLogStore } from '@/store/log-store';
import * as IntentLauncher from 'expo-intent-launcher';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { disconnectDevice } from '@/lib/ble-manager';
import { NUS_RX_CHAR_UUID, NUS_SERVICE_UUID, NUS_TX_CHAR_UUID } from '@/constants/ble';

function SettingRow({
  label,
  description,
  right,
}: {
  label: string;
  description?: string;
  right: React.ReactNode;
}) {
  const { colors, isDark } = useAppTheme();
  return (
    <View style={[styles.row, { borderTopColor: colors.borderLight }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
        {description && <Text style={[styles.rowDesc, { color: colors.textSecondary }]}>{description}</Text>}
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
  } = useBleStore();
  const { reset } = useGnssStore();
  const { exportDirectoryUri, setExportDirectory, resetExportDirectory } = useLogStore();

  const [confirmConfig, setConfirmConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    confirmText?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
    onCancel?: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const isConnected = status === 'connected';

  async function handleDisconnect() {
    if (!connectedDeviceId) return;
    setConfirmConfig({
      visible: true,
      title: 'Disconnect',
      message: `Disconnect from ${connectedDeviceName ?? connectedDeviceId}?`,
      confirmText: 'Disconnect',
      isDestructive: true,
      onConfirm: async () => {
        setConfirmConfig((prev) => ({ ...prev, visible: false }));
        await disconnectDevice(connectedDeviceId);
        reset();
      },
    });
  }

  return (
    <View key={isDark ? 'dark' : 'light'} style={[styles.container, { backgroundColor: colors.background }]}>
      <ConfirmModal
        visible={confirmConfig.visible}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmText={confirmConfig.confirmText}
        isDestructive={confirmConfig.isDestructive}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig((prev) => ({ ...prev, visible: false }))}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={styles.scroll}
        contentContainerStyle={styles.scrollContainer}
      >
      {/* BLE Connection */}
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionHeader, { color: colors.textTertiary }]}>Bluetooth</Text>

        <SettingRow
          label="Device"
          description={
            isConnected
              ? connectedDeviceName ?? connectedDeviceId ?? 'Connected'
              : lastError ?? 'Not connected'
          }
          right={
            <Pressable
              style={[
                styles.actionButton,
                { backgroundColor: colors.borderLight, borderColor: colors.borderLight },
                isConnected && { backgroundColor: colors.dangerSurface, borderColor: colors.dangerBorder }
              ]}
              onPress={isConnected ? handleDisconnect : () => router.push('/ble-scan')}
              accessibilityRole="button"
            >
              <Text style={[styles.actionButtonText, { color: colors.textSecondary }, isConnected && { color: colors.danger }]}>
                {isConnected ? 'Disconnect' : 'Scan & Connect'}
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
              trackColor={{ false: colors.borderLight, true: colors.statusActive }}
              thumbColor={isDark ? '#FFFFFF' : colors.iconSecondary}
            />
          }
        />
      </View>

      {/* Device UUIDs */}
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionHeader, { color: colors.textTertiary }]}>BLE Profile (Nordic UART Service)</Text>

        <View style={[styles.uuidBlock, { borderTopColor: colors.borderLight }]}>
          <Text style={[styles.uuidLabel, { color: colors.textSecondary }]}>Service UUID</Text>
          <Text style={[styles.uuidValue, { color: colors.statusActive }]} selectable>{NUS_SERVICE_UUID}</Text>
        </View>
        <View style={[styles.uuidBlock, { borderTopColor: colors.borderLight }]}>
          <Text style={[styles.uuidLabel, { color: colors.textSecondary }]}>TX Characteristic (ESP32 → Phone)</Text>
          <Text style={[styles.uuidValue, { color: colors.statusActive }]} selectable>{NUS_TX_CHAR_UUID}</Text>
        </View>
        <View style={[styles.uuidBlock, { borderTopColor: colors.borderLight }]}>
          <Text style={[styles.uuidLabel, { color: colors.textSecondary }]}>RX Characteristic (Phone → ESP32)</Text>
          <Text style={[styles.uuidValue, { color: colors.statusActive }]} selectable>{NUS_RX_CHAR_UUID}</Text>
        </View>
      </View>

      {/* Data */}
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionHeader, { color: colors.textTertiary }]}>GNSS Data</Text>
        <SettingRow
          label="Clear Live Data"
          description="Reset all parsed GNSS state (position, satellites, velocity)"
          right={
            <Pressable
              style={[styles.actionButton, { backgroundColor: colors.borderLight, borderColor: colors.borderLight }]}
              onPress={() => {
                setConfirmConfig({
                  visible: true,
                  title: 'Clear Data',
                  message: 'Reset all live GNSS data?',
                  confirmText: 'Clear',
                  isDestructive: true,
                  onConfirm: () => {
                    setConfirmConfig((prev) => ({ ...prev, visible: false }));
                    reset();
                  },
                });
              }}
              accessibilityRole="button"
            >
              <Text style={[styles.actionButtonText, { color: colors.textSecondary }]}>Clear</Text>
            </Pressable>
          }
        />
      </View>

      {/* Exports */}
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionHeader, { color: colors.textTertiary }]}>Exports</Text>
        <SettingRow
          label="Target Folder"
          description={exportDirectoryUri ? 'Folder permission granted' : 'No default folder set'}
          right={
            <Pressable
              style={[styles.actionButton, { backgroundColor: colors.borderLight, borderColor: colors.borderLight }]}
              onPress={async () => {
                const ok = await setExportDirectory();
                if (ok) {
                  setConfirmConfig({
                    visible: true,
                    title: 'Success',
                    message: 'Export directory updated.',
                    onConfirm: () => setConfirmConfig((prev) => ({ ...prev, visible: false })),
                  });
                }
              }}
              accessibilityRole="button"
            >
              <Text style={[styles.actionButtonText, { color: colors.textSecondary }]}>
                {exportDirectoryUri ? 'Change' : 'Set Folder'}
              </Text>
            </Pressable>
          }
        />
        {exportDirectoryUri && (
          <>
            <SettingRow
              label="Open Folder"
              description="View your logs in the external file manager"
              right={
                <Pressable
                  style={[styles.actionButton, { backgroundColor: colors.borderLight, borderColor: colors.borderLight }]}
                  onPress={async () => {
                    try {
                      if (Platform.OS === 'android' && exportDirectoryUri) {
                        // Transform tree URI to document URI for specific folder targeting
                        const documentUri = exportDirectoryUri.replace('/tree/', '/document/');
                        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
                          data: documentUri,
                          type: 'vnd.android.document/directory',
                        });
                      } else if (exportDirectoryUri) {
                        await Linking.openURL(exportDirectoryUri);
                      }
                    } catch (e) {
                      console.error('Failed to open folder:', e);
                    }
                  }}
                  accessibilityRole="button"
                >
                  <Text style={[styles.actionButtonText, { color: colors.textSecondary }]}>Open</Text>
                </Pressable>
              }
            />
            <SettingRow
              label="Reset Permission"
            description="Clear the saved folder and ask again on next export"
            right={
              <Pressable
                style={[styles.actionButton, { backgroundColor: colors.borderLight, borderColor: colors.borderLight }]}
                onPress={() => {
                  setConfirmConfig({
                    visible: true,
                    title: 'Reset Permission',
                    message: 'Clear the saved folder? You will be asked to select it again on your next export.',
                    confirmText: 'Reset',
                    isDestructive: true,
                    onConfirm: () => {
                      setConfirmConfig((prev) => ({ ...prev, visible: false }));
                      resetExportDirectory();
                    },
                  });
                }}
                accessibilityRole="button"
              >
                <Text style={[styles.actionButtonText, { color: colors.textSecondary }]}>Reset</Text>
              </Pressable>
            }
          />
          </>
        )}
      </View>

      {/* About */}
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionHeader, { color: colors.textTertiary }]}>About</Text>
        <View style={styles.aboutBlock}>
          <Text style={[styles.aboutTitle, { color: colors.text }]}>GNSS Logger</Text>
          <Text style={[styles.aboutDesc, { color: colors.textSecondary }]}>
            Final Year B.Tech Project:{'\n'}Edge-Optimized NavIC L5 Band Receiver Integration Streams NMEA 0183 from Quectel L89HA via ESP32 BLE (Nordic UART Service){'\n\n'}Supported Constellations:{'\n'}GPS (L1), NavIC/IRNSS (L5), GLONASS, Galileo, BeiDou, QZSS
          </Text>
        </View>
      </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContainer: { padding: 16, paddingBottom: 110, gap: 16 },
  section: {
    borderRadius: 24,
    borderCurve: 'continuous',
    borderWidth: 1,
    padding: 20,
    gap: 0,
  } as any,
  sectionHeader: {
    fontSize: 12,
    fontFamily: 'Lexend_800ExtraBold',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    gap: 16,
  },
  rowLabel: { fontSize: 16, fontFamily: 'Lexend_600SemiBold' },
  rowDesc: { fontSize: 13, marginTop: 4, lineHeight: 18, fontFamily: 'Lexend_400Regular' },
  actionButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  actionButtonText: { fontSize: 14, fontFamily: 'Lexend_700Bold' },
  uuidBlock: {
    paddingVertical: 12,
    borderTopWidth: 1,
    gap: 4,
  },
  uuidLabel: { fontSize: 12, fontFamily: 'Lexend_700Bold' },
  uuidValue: {
    fontSize: 12,
    fontFamily: 'monospace',
    fontVariant: ['tabular-nums'],
  },
  aboutBlock: { paddingTop: 10, gap: 8 },
  aboutTitle: { fontSize: 18, fontFamily: 'Lexend_800ExtraBold' },
  aboutDesc: { fontSize: 14, lineHeight: 22, fontFamily: 'Lexend_400Regular' },
});
