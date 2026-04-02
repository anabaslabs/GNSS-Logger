import { ConfirmModal } from "@/components/confirm-modal";
import { PressableScale } from "@/components/pressable-scale";
import { WheelPicker } from "@/components/wheel-picker";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useGnssStore } from "@/store/gnss-store";
import { useLogStore } from "@/store/log-store";
import type { LogSession } from "@/types/gnss";
import {
  IconClock,
  IconFileText,
  IconFolderOff,
  IconPlayerRecordFilled,
  IconSquareRoundedFilled,
  IconTerminal2,
  IconTrash,
} from "@tabler/icons-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

function formatDuration(start: number, end: number | null): string {
  const ms = (end ?? Date.now()) - start;
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const SessionCard = React.memo(
  ({
    session,
    onExportNmea,
    onExportCsv,
    onDelete,
  }: {
    session: LogSession;
    onExportNmea: () => void;
    onExportCsv: () => void;
    onDelete: () => void;
  }) => {
    const { colors } = useAppTheme();
    const active = session.endTime === null;

    return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: active ? colors.dangerSurface : colors.surface,
            borderColor: active ? colors.dangerBorder : colors.border,
          },
          active && styles.cardActive,
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text
              style={[styles.sessionDate, { color: colors.text }]}
              numberOfLines={1}
            >
              {formatDate(session.startTime)}
            </Text>
          </View>

          <View style={styles.badgeRow}>
            <Text
              style={[styles.miniBadgeText, { color: colors.textSecondary }]}
            >
              {session.fixCount} Fixes
            </Text>
            <View style={[styles.dot, { backgroundColor: colors.border }]} />
            <Text
              style={[styles.miniBadgeText, { color: colors.textSecondary }]}
            >
              {formatDuration(session.startTime, session.endTime)}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.divider,
            { backgroundColor: colors.borderLight, height: 1.5 },
          ]}
        />

        <View style={styles.sessionFooter}>
          <View style={styles.actions}>
            <PressableScale
              style={[
                styles.actionBtn,
                { backgroundColor: colors.borderLight },
              ]}
              onPress={onExportNmea}
            >
              <IconTerminal2 size={18} color={colors.textSecondary} />
              <Text
                style={[styles.actionBtnText, { color: colors.textSecondary }]}
              >
                NMEA
              </Text>
            </PressableScale>

            <PressableScale
              style={[
                styles.actionBtn,
                { backgroundColor: colors.borderLight },
              ]}
              onPress={onExportCsv}
            >
              <IconFileText size={18} color={colors.textSecondary} />
              <Text
                style={[styles.actionBtnText, { color: colors.textSecondary }]}
              >
                CSV
              </Text>
            </PressableScale>

            <View style={{ flex: 1 }} />

            <PressableScale
              style={[
                styles.actionBtn,
                {
                  backgroundColor: colors.dangerSurface,
                  borderColor: colors.dangerBorder,
                  borderWidth: 0,
                },
              ]}
              onPress={onDelete}
            >
              <IconTrash size={18} color={colors.danger} />
              <Text style={[styles.actionBtnText, { color: colors.danger }]}>
                Delete
              </Text>
            </PressableScale>
          </View>
        </View>
      </View>
    );
  },
);

SessionCard.displayName = "SessionCard";

const ActiveRecordingBanner = ({
  startTime,
  onStop,
}: {
  startTime: number;
  onStop: () => void;
}) => {
  const { colors } = useAppTheme();
  const { sessionBuffer } = useGnssStore();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const itv = setInterval(() => setElapsed(Date.now() - startTime), 1000);
    setElapsed(Date.now() - startTime);
    return () => clearInterval(itv);
  }, [startTime]);

  return (
    <PressableScale
      style={[
        styles.logButton,
        {
          backgroundColor: colors.dangerSurface,
          borderColor: colors.dangerBorder,
          borderWidth: 1.5,
        },
      ]}
      onPress={onStop}
    >
      <View style={styles.row}>
        <View style={styles.leftSide}>
          <IconSquareRoundedFilled color={colors.danger} size={24} />
          <View>
            <Text style={[styles.logLabel, { color: colors.danger }]}>
              Recording...
            </Text>
            <Text style={[styles.logHint, { color: colors.textTertiary }]}>
              {sessionBuffer.length} lines captured
            </Text>
          </View>
        </View>
        <Text style={[styles.timer, { color: colors.danger }]}>
          {formatElapsed(elapsed)}
        </Text>
      </View>
    </PressableScale>
  );
};

export default function LogsScreen() {
  const { colors, isDark } = useAppTheme();
  const { isLogging, setLogging, clearSession } = useGnssStore();
  const {
    sessions,
    exportNmea,
    exportCsv,
    deleteSession,
    clearAll,
    startSession,
    activeSessionId,
    setExportDirectory,
    exportBulk,
  } = useLogStore();

  const [showPicker, setShowPicker] = useState(false);
  const [showBulkOptions, setShowBulkOptions] = useState(false);
  const [timerHours, setTimerHours] = useState("00");
  const [timerMinutes, setTimerMinutes] = useState("01");
  const [timerSeconds, setTimerSeconds] = useState("00");
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    title: "",
    message: "",
    onConfirm: () => {},
  });

  async function stopLogging() {
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
    const freshLogState = useLogStore.getState();
    const freshGnssState = useGnssStore.getState();
    const sid = freshLogState.activeSessionId;

    if (sid) {
      const lines = freshGnssState.sessionBuffer;
      const fixCount = lines.filter((l) => l.includes("GGA")).length;
      await freshLogState.endSession(sid, lines, fixCount);
    }
    clearSession();
    setLogging(false);
  }

  async function startLogging(sec: number) {
    setLogging(true);
    await startSession([]);
    if (sec > 0) {
      autoStopRef.current = setTimeout(() => {
        stopLogging();
      }, sec * 1000);
    }
  }

  function handleStartTimed() {
    const h = parseInt(timerHours, 10);
    const m = parseInt(timerMinutes, 10);
    const s = parseInt(timerSeconds, 10);
    const totalSecs = h * 3600 + m * 60 + s;
    if (totalSecs > 0) {
      setShowPicker(false);
      startLogging(totalSecs);
    } else {
      setConfirmConfig({
        visible: true,
        title: "Invalid Duration",
        message: "Please set a timer greater than 0 seconds.",
        onConfirm: () =>
          setConfirmConfig((prev) => ({ ...prev, visible: false })),
      });
    }
  }

  function handleClearAll() {
    setConfirmConfig({
      visible: true,
      title: "Clear All Logs",
      message:
        "This will permanently delete all recorded sessions and their files. Continue?",
      confirmText: "Clear",
      isDestructive: true,
      onConfirm: () => {
        setConfirmConfig((prev) => ({ ...prev, visible: false }));
        clearAll();
      },
      onCancel: () => setConfirmConfig((prev) => ({ ...prev, visible: false })),
    });
  }

  function handleDelete(id: string) {
    setConfirmConfig({
      visible: true,
      title: "Delete Session",
      message: "Delete this recording session?",
      confirmText: "Delete",
      isDestructive: true,
      onConfirm: () => {
        setConfirmConfig((prev) => ({ ...prev, visible: false }));
        deleteSession(id);
      },
      onCancel: () => setConfirmConfig((prev) => ({ ...prev, visible: false })),
    });
  }

  async function handleBulkExport(format: "all" | "nmea" | "csv") {
    setShowBulkOptions(false);
    const res = await exportBulk(format);
    setConfirmConfig({
      visible: true,
      title: res.success
        ? "Success"
        : res.needsPermission
          ? "Permission Required"
          : "Export Failed",
      message: res.message,
      confirmText: res.needsPermission ? "Select Folder" : "OK",
      onConfirm: async () => {
        setConfirmConfig((prev) => ({ ...prev, visible: false }));
        if (res.needsPermission) {
          await setExportDirectory();
          handleBulkExport(format);
        }
      },
      onCancel: res.needsPermission
        ? () => setConfirmConfig((prev) => ({ ...prev, visible: false }))
        : undefined,
    });
  }

  return (
    <View
      key={isDark ? "dark" : "light"}
      style={[styles.scroll, { backgroundColor: colors.background }]}
    >
      <ConfirmModal
        visible={confirmConfig.visible}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmText={confirmConfig.confirmText}
        isDestructive={confirmConfig.isDestructive}
        onConfirm={confirmConfig.onConfirm}
        onCancel={confirmConfig.onCancel}
      />

      <Modal
        visible={showPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPicker(false)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setShowPicker(false)}
        >
          <View style={styles.modalMount}>
            <Pressable
              style={[
                styles.modal,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              onPress={() => {}}
            >
              <View style={{ marginBottom: 20 }}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Timer Settings
                </Text>
                <Text
                  style={[
                    styles.modalSubtitle,
                    { color: colors.textSecondary },
                  ]}
                >
                  Set recording duration
                </Text>
              </View>

              <View style={styles.pickerSection}>
                <View style={styles.pickerRow}>
                  <View style={styles.pickerColumn}>
                    <WheelPicker
                      items={Array.from({ length: 24 }).map((_, i) =>
                        String(i).padStart(2, "0"),
                      )}
                      value={timerHours}
                      onValueChange={setTimerHours}
                    />
                    <Text
                      style={[
                        styles.pickerLabel,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Hours
                    </Text>
                  </View>
                  <View style={styles.pickerColumn}>
                    <WheelPicker
                      items={Array.from({ length: 60 }).map((_, i) =>
                        String(i).padStart(2, "0"),
                      )}
                      value={timerMinutes}
                      onValueChange={setTimerMinutes}
                    />
                    <Text
                      style={[
                        styles.pickerLabel,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Min
                    </Text>
                  </View>
                  <View style={styles.pickerColumn}>
                    <WheelPicker
                      items={Array.from({ length: 60 }).map((_, i) =>
                        String(i).padStart(2, "0"),
                      )}
                      value={timerSeconds}
                      onValueChange={setTimerSeconds}
                    />
                    <Text
                      style={[
                        styles.pickerLabel,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Sec
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.modalFooter}>
                <Pressable
                  hitSlop={12}
                  onPress={() => setShowPicker(false)}
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
                </Pressable>

                <View style={{ flexDirection: "row", gap: 12 }}>
                  <Pressable
                    hitSlop={12}
                    onPress={() => {
                      setTimerHours("00");
                      setTimerMinutes("01");
                      setTimerSeconds("00");
                    }}
                    style={[
                      styles.footerBtn,
                      { backgroundColor: colors.dangerSurface },
                    ]}
                  >
                    <Text
                      style={[styles.footerBtnText, { color: colors.danger }]}
                    >
                      Reset
                    </Text>
                  </Pressable>
                  <Pressable
                    hitSlop={12}
                    onPress={handleStartTimed}
                    style={[
                      styles.footerBtn,
                      {
                        backgroundColor: colors.statusSurface,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.footerBtnText,
                        { color: colors.statusActive },
                      ]}
                    >
                      Start
                    </Text>
                  </Pressable>
                </View>
              </View>
            </Pressable>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showBulkOptions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBulkOptions(false)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setShowBulkOptions(false)}
        >
          <View style={styles.modalMount}>
            <Pressable
              style={[
                styles.modal,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              onPress={() => {}}
            >
              <View style={{ marginBottom: 20 }}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Save All
                </Text>
                <Text
                  style={[
                    styles.modalSubtitle,
                    { color: colors.textSecondary },
                  ]}
                >
                  Choose export format for all sessions
                </Text>
              </View>

              <View style={{ gap: 12 }}>
                {[
                  { label: "All Formats", value: "all" as const },
                  { label: "NMEA Only", value: "nmea" as const },
                  { label: "CSV Only", value: "csv" as const },
                ].map((opt) => (
                  <PressableScale
                    key={opt.value}
                    style={[
                      styles.optionBtn,
                      { backgroundColor: colors.borderLight },
                    ]}
                    onPress={() => handleBulkExport(opt.value)}
                  >
                    <Text style={[styles.optionText, { color: colors.text }]}>
                      {opt.label}
                    </Text>
                  </PressableScale>
                ))}
              </View>

              <View style={[styles.modalFooter, { marginTop: 24 }]}>
                <Pressable
                  hitSlop={12}
                  onPress={() => setShowBulkOptions(false)}
                  style={[styles.footerBtn, { flex: 1 }]}
                >
                  <Text
                    style={[
                      styles.footerBtnText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Cancel
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </View>
        </TouchableOpacity>
      </Modal>

      <FlatList
        data={sessions}
        keyExtractor={(s) => s.id}
        contentContainerStyle={styles.container}
        ListHeaderComponent={
          <View style={{ gap: 24 }}>
            {isLogging && activeSessionId ? (
              <ActiveRecordingBanner
                startTime={
                  sessions.find((s) => s.id === activeSessionId)?.startTime ??
                  Date.now()
                }
                onStop={() => stopLogging()}
              />
            ) : (
              <View style={{ flexDirection: "row", gap: 12 }}>
                <PressableScale
                  style={[
                    styles.logButton,
                    {
                      flex: 1,
                      backgroundColor: colors.surface,
                      borderColor: colors.borderLight,
                    },
                  ]}
                  onPress={() => startLogging(0)}
                >
                  <View style={styles.leftSide}>
                    <IconPlayerRecordFilled color={colors.danger} size={24} />
                    <View>
                      <Text
                        style={[styles.logLabel, { color: colors.text }]}
                        numberOfLines={1}
                      >
                        Instant
                      </Text>
                      <Text
                        style={[styles.logHint, { color: colors.textTertiary }]}
                        numberOfLines={1}
                      >
                        No limit
                      </Text>
                    </View>
                  </View>
                </PressableScale>
                <PressableScale
                  style={[
                    styles.logButton,
                    {
                      flex: 1,
                      backgroundColor: colors.surface,
                      borderColor: colors.borderLight,
                    },
                  ]}
                  onPress={() => setShowPicker(true)}
                >
                  <View style={styles.leftSide}>
                    <IconClock color={colors.statusActive} size={24} />
                    <View>
                      <Text
                        style={[styles.logLabel, { color: colors.text }]}
                        numberOfLines={1}
                      >
                        Timed
                      </Text>
                      <Text
                        style={[styles.logHint, { color: colors.textTertiary }]}
                        numberOfLines={1}
                      >
                        Set duration
                      </Text>
                    </View>
                  </View>
                </PressableScale>
              </View>
            )}

            <View style={styles.headerRow}>
              <Text style={[styles.title, { color: colors.text }]}>
                {sessions.length} Session{sessions.length !== 1 ? "s" : ""}
              </Text>
              {sessions.length > 0 && (
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <PressableScale
                    onPress={() => setShowBulkOptions(true)}
                    style={[
                      styles.footerBtn,
                      {
                        backgroundColor: colors.statusSurface,
                        borderColor: "transparent",
                        borderWidth: 0,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.footerBtnText,
                        { color: colors.statusActive },
                      ]}
                    >
                      Save All
                    </Text>
                  </PressableScale>

                  <PressableScale
                    onPress={handleClearAll}
                    style={[
                      styles.footerBtn,
                      {
                        backgroundColor: colors.dangerSurface,
                        borderColor: "transparent",
                        borderWidth: 0,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.footerBtnText, { color: colors.danger }]}
                    >
                      Clear All
                    </Text>
                  </PressableScale>
                </View>
              )}
            </View>
          </View>
        }
        renderItem={({ item: session }) => (
          <SessionCard
            session={session}
            onExportNmea={async () => {
              const res = await exportNmea(session.id);
              setConfirmConfig({
                visible: true,
                title: res.success
                  ? "Success"
                  : res.needsPermission
                    ? "One-Tap Save"
                    : "Export Failed",
                message: res.message,
                confirmText: res.needsPermission ? "Select Folder" : "OK",
                onConfirm: async () => {
                  setConfirmConfig((prev) => ({ ...prev, visible: false }));
                  if (res.needsPermission) {
                    await setExportDirectory();
                    exportNmea(session.id);
                  }
                },
                onCancel: res.needsPermission
                  ? () =>
                      setConfirmConfig((prev) => ({ ...prev, visible: false }))
                  : undefined,
              });
            }}
            onExportCsv={async () => {
              const res = await exportCsv(session.id);
              setConfirmConfig({
                visible: true,
                title: res.success
                  ? "Success"
                  : res.needsPermission
                    ? "One-Tap Save"
                    : "Export Failed",
                message: res.message,
                confirmText: res.needsPermission ? "Select Folder" : "OK",
                onConfirm: async () => {
                  setConfirmConfig((prev) => ({ ...prev, visible: false }));
                  if (res.needsPermission) {
                    await setExportDirectory();
                    exportNmea(session.id);
                  }
                },
                onCancel: res.needsPermission
                  ? () =>
                      setConfirmConfig((prev) => ({ ...prev, visible: false }))
                  : undefined,
              });
            }}
            onDelete={() => handleDelete(session.id)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <IconFolderOff color={colors.textSecondary} size={64} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No Sessions Yet
            </Text>
            <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
              Recorded logs will appear here.
            </Text>
          </View>
        }
        ItemSeparatorComponent={null}
        ListFooterComponent={null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  container: { padding: 16, paddingBottom: 40, gap: 16 },

  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 24,
  },
  modalMount: { width: "100%", alignItems: "center" },
  modal: {
    width: "100%",
    borderRadius: 32,
    borderCurve: "continuous",
    borderWidth: 1.5,
    padding: 24,
    gap: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
    overflow: "hidden",
  },
  modalTitle: {
    fontSize: 24,
    fontFamily: "Lexend_800ExtraBold",
    letterSpacing: -0.5,
  },
  modalSubtitle: {
    fontSize: 14,
    fontFamily: "Lexend_400Regular",
    marginTop: 4,
  },

  pickerSection: { marginVertical: 12 },
  pickerRow: { flexDirection: "row", justifyContent: "center", gap: 8 },
  pickerColumn: { flex: 1, alignItems: "center", gap: 8 },
  pickerLabel: {
    fontSize: 12,
    fontFamily: "Lexend_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  modalFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 24,
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

  logButton: {
    height: 80,
    borderRadius: 32,
    borderCurve: "continuous",
    borderWidth: 1.5,
    paddingHorizontal: 20,
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  leftSide: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  logLabel: { fontSize: 15, fontFamily: "Lexend_700Bold" },
  logHint: { fontSize: 12, fontFamily: "Lexend_400Regular", marginTop: 2 },
  timer: {
    fontSize: 22,
    fontFamily: "Lexend_300Light",
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.5,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  title: { fontSize: 18, fontFamily: "Lexend_800ExtraBold" },
  clearAll: { fontSize: 14, fontFamily: "Lexend_700Bold" },

  card: {
    borderRadius: 32,
    borderCurve: "continuous",
    borderWidth: 1.5,
    padding: 18,
    gap: 16,
  } as any,
  cardActive: { borderWidth: 1.5 },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sessionDate: { fontSize: 16, fontFamily: "Lexend_800ExtraBold" },

  badgeRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  miniBadgeText: {
    fontSize: 12,
    fontFamily: "Lexend_500Medium",
    fontVariant: ["tabular-nums"],
    lineHeight: 16,
  },
  dot: { width: 3, height: 3, borderRadius: 1.5, marginHorizontal: 2 },

  optionBtn: {
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  optionText: { fontSize: 16, fontFamily: "Lexend_600SemiBold" },

  divider: { height: 1.5, width: "100%" },

  sessionFooter: { flexDirection: "row", alignItems: "center" },
  actions: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  actionBtn: {
    height: 48,
    minWidth: 80,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderWidth: 0,
    borderColor: "rgba(0,0,0,0.1)",
  },
  actionBtnText: { fontSize: 13, fontFamily: "Lexend_700Bold" },

  emptyState: { alignItems: "center", gap: 16, paddingVertical: 64 },
  emptyTitle: { fontSize: 20, fontFamily: "Lexend_700Bold" },
  emptyDesc: {
    fontSize: 14,
    fontFamily: "Lexend_400Regular",
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 280,
  },
});
