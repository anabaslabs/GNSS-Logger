import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet, Alert, Modal, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { IconFolderOff, IconPlayerRecordFilled, IconSquareRoundedFilled, IconClock, IconMapPin } from '@tabler/icons-react-native';
import { WheelPicker } from '@/components/wheel-picker';
import { useLogStore } from '@/store/log-store';
import { useGnssStore } from '@/store/gnss-store';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ConfirmModal } from '@/components/confirm-modal';
import type { LogSession } from '@/types/gnss';

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
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function SessionCard({ session, onExportNmea, onExportCsv, onDelete }: {
  session: LogSession;
  onExportNmea: () => void;
  onExportCsv: () => void;
  onDelete: () => void;
}) {
  const { colors } = useAppTheme();
  const active = session.endTime === null;
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, active && styles.cardActive]}>
      {/* Title + meta inline */}
      <View style={styles.cardTop}>
        <Text style={[styles.sessionDate, { color: colors.text }]} numberOfLines={1}>{formatDate(session.startTime)}</Text>
        <View style={styles.metaRow}>
          <View style={styles.metaBadge}>
            <IconMapPin size={14} color="#10B981" />
            <Text style={[styles.metaText, { color: '#10B981' }]}>{session.fixCount} Fix</Text>
          </View>
          <View style={styles.metaBadge}>
            <IconClock size={14} color="#3B82F6" />
            <Text style={[styles.metaText, { color: '#3B82F6' }]}>{formatDuration(session.startTime, session.endTime)}</Text>
          </View>
          {active && (
            <View style={styles.metaBadge}>
              <IconPlayerRecordFilled size={14} color="#EF4444" />
              <Text style={[styles.activeText, { color: '#EF4444' }]}>REC</Text>
            </View>
          )}
        </View>
      </View>
      {/* Action row */}
      <View style={styles.actionRow}>
        <Pressable hitSlop={12} onPress={onExportNmea} accessibilityLabel="Export NMEA">
          <Text style={[styles.actionText, { color: colors.textSecondary }]}>.nmea</Text>
        </Pressable>
        <Text style={{ color: colors.borderLight, fontSize: 12 }}>|</Text>
        <Pressable hitSlop={12} onPress={onExportCsv} accessibilityLabel="Export CSV">
          <Text style={[styles.actionText, { color: colors.textSecondary }]}>.csv</Text>
        </Pressable>
        <Text style={{ color: colors.borderLight, fontSize: 12 }}>|</Text>
        <Pressable hitSlop={12} onPress={onDelete} accessibilityLabel="Delete session">
          <Text style={[styles.actionText, { color: colors.danger }]}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

const DURATION_OPTIONS = [
  { label: '5 min', seconds: 300 },
  { label: '10 min', seconds: 600 },
  { label: '30 min', seconds: 1800 },
];

export default function LogsScreen() {
  const { colors } = useAppTheme();
  const { isLogging, setLogging, sessionBuffer, clearSession } = useGnssStore();
  const { sessions, exportNmea, exportCsv, deleteSession, clearAll, startSession, endSession, activeSessionId } = useLogStore();

  // Live elapsed timer
  const [elapsedMs, setElapsedMs] = useState(0);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Timed recording
  const [showPicker, setShowPicker] = useState(false);
  const [timerHours, setTimerHours] = useState('00');
  const [timerMinutes, setTimerMinutes] = useState('05');
  const [timerSeconds, setTimerSeconds] = useState('00');
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Custom Alert State
  const [confirmConfig, setConfirmConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    confirmText?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Start/stop the elapsed timer
  useEffect(() => {
    if (isLogging && activeSessionId) {
      const session = sessions.find((s) => s.id === activeSessionId);
      if (session) {
        startTimeRef.current = session.startTime;
        const update = () => setElapsedMs(Date.now() - startTimeRef.current);
        update(); // initial sync
        timerRef.current = setInterval(update, 1000);
      }
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setElapsedMs(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isLogging, activeSessionId, sessions]);

  async function stopLogging() {
    // Clear any auto-stop timers
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }

    // Use fresh state directly to bypass stale closure
    const freshLogState = useLogStore.getState();
    const freshGnssState = useGnssStore.getState();
    const sid = freshLogState.activeSessionId;

    if (sid) {
      const lines = freshGnssState.sessionBuffer;
      const fixCount = lines.filter((l) => l.includes('GGA')).length;
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

  // No longer needed: alert modal was removed in favor of explicit inline buttons.

  function handleStartTimed() {
    const h = parseInt(timerHours, 10);
    const m = parseInt(timerMinutes, 10);
    const s = parseInt(timerSeconds, 10);
    const totalSecs = (h * 3600) + (m * 60) + s;
    if (totalSecs > 0) {
      setShowPicker(false);
      startLogging(totalSecs);
    } else {
      Alert.alert('Invalid Duration', 'Please set a timer greater than 0 seconds.');
    }
  }

  function handleClearAll() {
    setConfirmConfig({
      visible: true,
      title: 'Clear All Logs',
      message: 'This will permanently delete all recorded sessions and their files. Continue?',
      confirmText: 'Delete All',
      isDestructive: true,
      onConfirm: () => {
        setConfirmConfig((prev) => ({ ...prev, visible: false }));
        clearAll();
      },
    });
  }

  function handleDelete(id: string) {
    setConfirmConfig({
      visible: true,
      title: 'Delete Session',
      message: 'Delete this recording session?',
      confirmText: 'Delete',
      isDestructive: true,
      onConfirm: () => {
        setConfirmConfig((prev) => ({ ...prev, visible: false }));
        deleteSession(id);
      },
    });
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={[styles.scroll, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.container}
    >
      <ConfirmModal
        visible={confirmConfig.visible}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmText={confirmConfig.confirmText}
        isDestructive={confirmConfig.isDestructive}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig((prev) => ({ ...prev, visible: false }))}
      />
      {/* Timer Settings Modal */}
      <Modal visible={showPicker} transparent animationType="fade" onRequestClose={() => setShowPicker(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowPicker(false)}>
          <Pressable style={[styles.modal, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => {}}>
            <Text style={[styles.modalTitle, { color: colors.text, textAlign: 'left' }]}>Timer Settings</Text>
            
            <View style={{ marginTop: 24, marginBottom: 8, width: '100%' }}>
              <View style={{ flexDirection: 'row', width: '100%', justifyContent: 'center' }}>
                <View style={{ flex: 1 }}>
                  <WheelPicker
                    items={Array.from({ length: 24 }).map((_, i) => String(i))}
                    value={String(parseInt(timerHours, 10))}
                    onValueChange={(val) => setTimerHours(String(val).padStart(2, '0'))}
                    itemHeight={44}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <WheelPicker
                    items={Array.from({ length: 60 }).map((_, i) => String(i))}
                    value={String(parseInt(timerMinutes, 10))}
                    onValueChange={(val) => setTimerMinutes(String(val).padStart(2, '0'))}
                    itemHeight={44}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <WheelPicker
                    items={Array.from({ length: 60 }).map((_, i) => String(i))}
                    value={String(parseInt(timerSeconds, 10))}
                    onValueChange={(val) => setTimerSeconds(String(val).padStart(2, '0'))}
                    itemHeight={44}
                  />
                </View>
              </View>

              {/* Labels below */}
              <View style={{ flexDirection: 'row', width: '100%', marginTop: 12 }}>
                <Text style={{ flex: 1, textAlign: 'center', color: colors.textSecondary, fontSize: 13, fontFamily: 'Lexend_400Regular' }}>Hours</Text>
                <Text style={{ flex: 1, textAlign: 'center', color: colors.textSecondary, fontSize: 13, fontFamily: 'Lexend_400Regular' }}>Minutes</Text>
                <Text style={{ flex: 1, textAlign: 'center', color: colors.textSecondary, fontSize: 13, fontFamily: 'Lexend_400Regular' }}>Seconds</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
              <Pressable hitSlop={12} onPress={() => setShowPicker(false)} style={{ paddingVertical: 12 }}>
                <Text style={{ color: colors.statusActive, fontSize: 16, fontFamily: 'Lexend_500Medium' }}>Cancel</Text>
              </Pressable>
              <View style={{ flexDirection: 'row', gap: 24 }}>
                <Pressable hitSlop={12} onPress={() => { setTimerHours('00'); setTimerMinutes('05'); setTimerSeconds('00'); }} style={{ paddingVertical: 12 }}>
                  <Text style={{ color: colors.statusActive, fontSize: 16, fontFamily: 'Lexend_500Medium' }}>Reset</Text>
                </Pressable>
                <Pressable hitSlop={12} onPress={handleStartTimed} style={{ paddingVertical: 12, paddingRight: 8 }}>
                  <Text style={{ color: colors.statusActive, fontSize: 16, fontFamily: 'Lexend_500Medium' }}>Set</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </TouchableOpacity>
      </Modal>

      {/* Recording Control */}
      {isLogging ? (
        <Pressable
          style={[styles.logButton, { backgroundColor: colors.dangerSurface, borderColor: colors.dangerBorder }]}
          onPress={() => stopLogging()}
          accessibilityRole="button"
          accessibilityLabel="Stop logging"
        >
          <View style={styles.row}>
            <View style={styles.leftSide}>
              <IconSquareRoundedFilled color={colors.danger} size={24} />
              <View>
                <Text style={[styles.logLabel, { color: colors.danger }]}>Recording in progress</Text>
                <Text style={[styles.logHint, { color: colors.textTertiary }]}>{sessionBuffer.length} lines captured</Text>
              </View>
            </View>
            <Text style={[styles.timer, { color: colors.danger }]}>{formatElapsed(elapsedMs)}</Text>
          </View>
        </Pressable>
      ) : (
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Pressable
            style={[styles.logButton, { flex: 1, backgroundColor: colors.surface, borderColor: colors.borderLight }]}
            onPress={() => startLogging(0)}
            accessibilityRole="button"
          >
            <IconPlayerRecordFilled color={colors.statusActive} size={28} style={{ marginBottom: 12 }} />
            <Text style={[styles.logLabel, { color: colors.text }]}>Immediate</Text>
            <Text style={[styles.logHint, { color: colors.textTertiary }]}>No time limit</Text>
          </Pressable>
          <Pressable
            style={[styles.logButton, { flex: 1, backgroundColor: colors.surface, borderColor: colors.borderLight }]}
            onPress={() => setShowPicker(true)}
            accessibilityRole="button"
          >
            <IconClock color={colors.statusActive} size={28} style={{ marginBottom: 12 }} />
            <Text style={[styles.logLabel, { color: colors.text }]}>Timed Record</Text>
            <Text style={[styles.logHint, { color: colors.textTertiary }]}>Set exact duration</Text>
          </Pressable>
        </View>
      )}

      {/* Header row */}
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.text }]}>{sessions.length} Session{sessions.length !== 1 ? 's' : ''}</Text>
        {sessions.length > 0 && (
          <Pressable onPress={handleClearAll} accessibilityRole="button">
            <Text style={[styles.clearAll, { color: colors.danger }]}>Clear All</Text>
          </Pressable>
        )}
      </View>

      {sessions.length === 0 ? (
        <View style={styles.emptyState}>
          <IconFolderOff color={colors.textSecondary} size={64} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Sessions Yet</Text>
          <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
            Recorded logs will appear here.
          </Text>
        </View>
      ) : (
        sessions.map((session) => (
          <SessionCard
            key={session.id}
            session={session}
            onExportNmea={() => exportNmea(session.id)}
            onExportCsv={() => exportCsv(session.id)}
            onDelete={() => handleDelete(session.id)}
          />
        ))
      )}
      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  container: { padding: 16, paddingBottom: 110, gap: 16 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  modalMount: { width: '100%', alignItems: 'center' },
  modal: { width: '100%', borderRadius: 28, borderWidth: 1, padding: 24, gap: 12 },
  modalTitle: { fontSize: 20, fontFamily: 'Lexend_800ExtraBold' },
  modalSubtitle: { fontSize: 13, fontFamily: 'Lexend_400Regular', lineHeight: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  chip: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 10 },
  chipText: { fontSize: 14, fontFamily: 'Lexend_700Bold' },
  
  customContainer: { flexDirection: 'row', gap: 10, marginTop: 12 },
  inputBox: { flex: 1, borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, height: 48, justifyContent: 'center' },
  input: { fontSize: 15, fontFamily: 'Lexend_600SemiBold', height: '100%', padding: 0 },
  startBtn: { borderRadius: 14, paddingHorizontal: 20, height: 48, justifyContent: 'center', alignItems: 'center' },
  startBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Lexend_700Bold' },

  logButton: { borderRadius: 24, borderCurve: 'continuous', borderWidth: 1, padding: 20 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  leftSide: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  logLabel: { fontSize: 15, fontFamily: 'Lexend_700Bold' },
  logHint: { fontSize: 12, fontFamily: 'Lexend_400Regular', marginTop: 2 },
  timer: { fontSize: 22, fontFamily: 'Lexend_300Light', fontVariant: ['tabular-nums'], letterSpacing: -0.5 },

  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  title: { fontSize: 18, fontFamily: 'Lexend_800ExtraBold' },
  clearAll: { fontSize: 14, fontFamily: 'Lexend_700Bold' },
  card: { borderRadius: 20, borderCurve: 'continuous', borderWidth: 1, padding: 14, gap: 14 } as any,
  cardActive: { borderColor: '#EF444455' },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  sessionDate: { fontSize: 14, fontFamily: 'Lexend_700Bold' },
  metaRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  metaBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11, fontFamily: 'Lexend_700Bold', fontVariant: ['tabular-nums'] },
  activeText: { fontSize: 11, fontFamily: 'Lexend_800ExtraBold', fontVariant: ['tabular-nums'] },
  actionRow: { flexDirection: 'row', gap: 24, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  actionText: { fontSize: 13, fontFamily: 'Lexend_700Bold' },
  emptyState: { alignItems: 'center', gap: 16, paddingVertical: 64 },
  emptyTitle: { fontSize: 20, fontFamily: 'Lexend_700Bold' },
  emptyDesc: { fontSize: 14, fontFamily: 'Lexend_400Regular', textAlign: 'center', lineHeight: 22, maxWidth: 280 },
});
