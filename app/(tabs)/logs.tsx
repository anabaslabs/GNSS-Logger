import React from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { IconFolderOff } from '@tabler/icons-react-native';
import { useLogStore } from '@/store/log-store';
import { useAppTheme } from '@/hooks/useAppTheme';
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
      <View style={styles.cardHeader}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.sessionDate, { color: colors.text }]}>{formatDate(session.startTime)}</Text>
          <View style={styles.metaRow}>
            <View style={[styles.metaBadge, { backgroundColor: colors.borderLight }]}>
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>{session.fixCount} fixes</Text>
            </View>
            <View style={[styles.metaBadge, { backgroundColor: colors.borderLight }]}>
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>{formatDuration(session.startTime, session.endTime)}</Text>
            </View>
            {active && (
              <View style={[styles.metaBadge, { backgroundColor: colors.dangerSurface }]}>
                <Text style={[styles.activeText, { color: colors.danger }]}>● REC</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <View style={styles.actionRow}>
        <Pressable style={[styles.actionBtn, { backgroundColor: colors.borderLight }]} onPress={onExportNmea} accessibilityLabel="Export NMEA">
          <Text style={[styles.actionText, { color: colors.textSecondary }]}>Export .nmea</Text>
        </Pressable>
        <Pressable style={[styles.actionBtn, { backgroundColor: colors.borderLight }]} onPress={onExportCsv} accessibilityLabel="Export CSV">
          <Text style={[styles.actionText, { color: colors.textSecondary }]}>Export .csv</Text>
        </Pressable>
        <Pressable
          style={[styles.actionBtn, { backgroundColor: colors.dangerSurface }]}
          onPress={onDelete}
          accessibilityLabel="Delete session"
        >
          <Text style={[styles.actionText, { color: colors.danger }]}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function LogsScreen() {
  const { colors } = useAppTheme();
  const { sessions, exportNmea, exportCsv, deleteSession, clearAll } = useLogStore();

  function handleClearAll() {
    Alert.alert(
      'Clear All Logs',
      'This will permanently delete all recorded sessions and their files. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete All', style: 'destructive', onPress: () => clearAll() },
      ],
    );
  }

  function handleDelete(id: string) {
    Alert.alert('Delete Session', 'Delete this recording session?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteSession(id) },
    ]);
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="never"
      style={[styles.scroll, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.container}
    >
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
            Go to Dashboard and tap "Start Recording Session" to log NMEA data.
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  title: { fontSize: 18, fontFamily: 'Lexend_800ExtraBold' },
  clearAll: { fontSize: 14, fontFamily: 'Lexend_700Bold' },
  card: {
    borderRadius: 24,
    borderCurve: 'continuous',
    borderWidth: 1,
    padding: 20,
    gap: 16,
  } as any,
  cardActive: { borderColor: '#EF444455' },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  sessionDate: { fontSize: 16, fontFamily: 'Lexend_700Bold' },
  metaRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 8 },
  metaBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  metaText: {
    fontSize: 12,
    fontFamily: 'Lexend_600SemiBold',
    fontVariant: ['tabular-nums'],
  },
  activeText: { fontSize: 12, fontFamily: 'Lexend_800ExtraBold', fontVariant: ['tabular-nums'] },
  actionRow: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionText: {
    fontSize: 13,
    fontFamily: 'Lexend_700Bold',
  },
  emptyState: {
    alignItems: 'center',
    gap: 16,
    paddingVertical: 64,
  },
  emptyTitle: { fontSize: 20, fontFamily: 'Lexend_700Bold' },
  emptyDesc: {
    fontSize: 14,
    fontFamily: 'Lexend_400Regular',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  infoBox: {
    borderRadius: 24,
    borderCurve: 'continuous',
    borderWidth: 1,
    padding: 20,
    gap: 8,
  } as any,
  infoTitle: { fontSize: 13, fontFamily: 'Lexend_800ExtraBold', letterSpacing: 1, textTransform: 'uppercase' },
  infoText: { fontSize: 13, lineHeight: 20, fontFamily: 'Lexend_400Regular' },
  infoHighlight: { color: '#38BDF8', fontFamily: 'Lexend_700Bold' },
});
