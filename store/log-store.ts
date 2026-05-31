import type { LogSession } from "@/types/gnss";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as Notifications from "expo-notifications";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useConfigStore } from "./config-store";
import { useGnssStore } from "./gnss-store";

interface LogState {
  sessions: LogSession[];
  activeSessionId: string | null;
  exportDirectoryUri: string | null;
  autoStopAt: number | null;
  activeNotificationId: string | null;
}

interface LogActions {
  startSession: (nmeaLines: string[], durationSecs?: number) => Promise<string | null>;
  endSession: (
    sessionId: string,
    nmeaLines: string[],
    fixCount: number,
  ) => Promise<void>;
  stopLogging: () => Promise<void>;
  cancelLogging: () => Promise<void>;
  exportNmea: (sessionId: string) => Promise<{
    success: boolean;
    message: string;
    needsPermission?: boolean;
  }>;
  exportCsv: (sessionId: string) => Promise<{
    success: boolean;
    message: string;
    needsPermission?: boolean;
  }>;
  deleteSession: (sessionId: string) => Promise<void>;
  exportBulk: (format: "all" | "nmea" | "csv") => Promise<{
    success: boolean;
    message: string;
    needsPermission?: boolean;
    count: number;
  }>;
  clearAll: () => Promise<void>;
  setExportDirectory: () => Promise<boolean>;
  resetExportDirectory: () => void;
}

let activeNotificationTimer: NodeJS.Timeout | null = null;

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

const LOGS_DIR = `${FileSystem.documentDirectory}gnss-logs/`;

async function ensureLogsDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(LOGS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(LOGS_DIR, { intermediates: true });
  }
}

function filterSentences(lines: string[]): string[] {
  const config = useConfigStore.getState().deviceConfig;
  const { constellations, showCombinedTalker } = config;

  return lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("$")) return true;

    const talker = trimmed.slice(1, 3);

    if (talker === "GN") return showCombinedTalker;
    if (talker === "GP") return constellations.gps;
    if (talker === "GL") return constellations.glonass;
    if (talker === "GA") return constellations.galileo;
    if (talker === "GB" || talker === "BD") return constellations.beidou;
    if (talker === "GQ") return constellations.qzss;
    if (talker === "GI") return constellations.navic;

    return true;
  });
}

function nmeaToCsv(lines: string[]): string {
  const header =
    "timestamp,raw_sentence,type,talker,lat,lon,alt,speed_kmh,sats,hdop,quality";
  const rows = lines.map((line) => {
    const now = new Date().toISOString();
    const parts = line.split(",");
    const sentenceId = parts[0]?.slice(1) ?? "";
    const talker = sentenceId.slice(0, 2);
    const type = sentenceId.slice(2);
    if (type === "GGA" && parts.length >= 15) {
      const lat = parts[2] ?? "";
      const latDir = parts[3] ?? "";
      const lon = parts[4] ?? "";
      const lonDir = parts[5] ?? "";
      const quality = parts[6] ?? "";
      const sats = parts[7] ?? "";
      const hdop = parts[8] ?? "";
      const alt = parts[9] ?? "";
      return `${now},${JSON.stringify(line)},${type},${talker},${lat}${latDir},${lon}${lonDir},${alt},,${sats},${hdop},${quality}`;
    }
    if (type === "VTG" && parts.length >= 9) {
      const speed = parts[7] ?? "";
      return `${now},${JSON.stringify(line)},${type},${talker},,,,${speed},,,`;
    }
    return `${now},${JSON.stringify(line)},${type},${talker},,,,,,`;
  });
  return [header, ...rows].join("\n");
}

async function requestNotificationPermission(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    return finalStatus === "granted";
  } catch (e) {
    console.error("[Notifications] Permission request failed:", e);
    return false;
  }
}

export const useLogStore = create<LogState & LogActions>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeSessionId: null,
      exportDirectoryUri: null,
      autoStopAt: null,
      activeNotificationId: null,

      startSession: async (nmeaLines, durationSecs) => {
        await ensureLogsDir();
        const id = `session_${Date.now()}`;
        const startTime = Date.now();
        const filePath = `${LOGS_DIR}${id}.nmea`;
        const filePathCsv = `${LOGS_DIR}${id}.csv`;

        const filteredLines = filterSentences(nmeaLines);

        await FileSystem.writeAsStringAsync(
          filePath,
          filteredLines.join("\n") + "\n",
        );
        await FileSystem.writeAsStringAsync(
          filePathCsv,
          nmeaToCsv(filteredLines),
        );

        const session: LogSession = {
          id,
          startTime,
          endTime: null,
          fixCount: 0,
          filePath,
          filePathCsv,
        };

        const autoStopAt = durationSecs && durationSecs > 0 ? startTime + durationSecs * 1000 : null;

        if (activeNotificationTimer) {
          clearInterval(activeNotificationTimer);
          activeNotificationTimer = null;
        }

        let notificationId: string | null = null;
        try {
          const hasPermission = await requestNotificationPermission();
          if (hasPermission) {
            notificationId = await Notifications.scheduleNotificationAsync({
              identifier: "active-session-notification",
              content: {
                title: "Recording...",
                body: "00:00:00",
                color: "#3B82F6",
                categoryIdentifier: "recordingControls",
                android: {
                  sticky: true,
                  ongoing: true,
                  color: "#3B82F6",
                  priority: "high",
                },
              },
              trigger: null,
            });

            activeNotificationTimer = setInterval(async () => {
              const elapsed = Date.now() - startTime;
              try {
                await Notifications.scheduleNotificationAsync({
                  identifier: "active-session-notification",
                  content: {
                    title: "Recording...",
                    body: formatTime(elapsed),
                    color: "#3B82F6",
                    categoryIdentifier: "recordingControls",
                    android: {
                      sticky: true,
                      ongoing: true,
                      color: "#3B82F6",
                      priority: "high",
                    },
                  },
                  trigger: null,
                });
              } catch (err) {
                console.error("[Notifications] Present failed:", err);
              }
            }, 1000);
          }
        } catch (err) {
          console.error("[Notifications] Present failed:", err);
        }

        set((s) => ({
          sessions: [session, ...s.sessions],
          activeSessionId: id,
          autoStopAt,
          activeNotificationId: notificationId,
        }));
        return id;
      },

      endSession: async (sessionId, nmeaLines, fixCount) => {
        const session = get().sessions.find((s) => s.id === sessionId);
        if (!session) return;

        const filteredLines = filterSentences(nmeaLines);

        await FileSystem.writeAsStringAsync(
          session.filePath,
          filteredLines.join("\n") + "\n",
        );
        await FileSystem.writeAsStringAsync(
          session.filePathCsv,
          nmeaToCsv(filteredLines),
        );

        if (activeNotificationTimer) {
          clearInterval(activeNotificationTimer);
          activeNotificationTimer = null;
        }

        const notifId = get().activeNotificationId;
        if (notifId) {
          try {
            await Notifications.dismissNotificationAsync(notifId);
          } catch (e) {
            console.error("[Notifications] Dismiss failed:", e);
          }
        }
        try {
          await Notifications.dismissNotificationAsync("active-session-notification");
        } catch {}

        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === sessionId
              ? { ...sess, endTime: Date.now(), fixCount }
              : sess,
          ),
          activeSessionId: null,
          autoStopAt: null,
          activeNotificationId: null,
        }));
      },

      stopLogging: async () => {
        const sid = get().activeSessionId;
        if (sid) {
          const freshGnssState = useGnssStore.getState();
          const lines = freshGnssState.sessionBuffer;
          const fixCount = lines.filter((l) => l.includes("GGA")).length;
          await get().endSession(sid, lines, fixCount);
        }

        if (activeNotificationTimer) {
          clearInterval(activeNotificationTimer);
          activeNotificationTimer = null;
        }

        const notifId = get().activeNotificationId;
        if (notifId) {
          try {
            await Notifications.dismissNotificationAsync(notifId);
          } catch (e) {
            console.error("[Notifications] Dismiss failed:", e);
          }
        }
        try {
          await Notifications.dismissNotificationAsync("active-session-notification");
        } catch {}

        useGnssStore.getState().clearSession();
        useGnssStore.getState().setLogging(false);
        set({ activeNotificationId: null });
      },

      cancelLogging: async () => {
        const sid = get().activeSessionId;
        if (sid) {
          // Delete temp files without saving
          const session = get().sessions.find((s) => s.id === sid);
          if (session) {
            try { await FileSystem.deleteAsync(session.filePath, { idempotent: true }); } catch {}
            try { await FileSystem.deleteAsync(session.filePathCsv, { idempotent: true }); } catch {}
          }
          set((s) => ({
            sessions: s.sessions.filter((sess) => sess.id !== sid),
            activeSessionId: null,
            autoStopAt: null,
          }));
        }

        if (activeNotificationTimer) {
          clearInterval(activeNotificationTimer);
          activeNotificationTimer = null;
        }

        const notifId = get().activeNotificationId;
        if (notifId) {
          try {
            await Notifications.dismissNotificationAsync(notifId);
          } catch (e) {
            console.error("[Notifications] Dismiss failed:", e);
          }
        }
        try {
          await Notifications.dismissNotificationAsync("active-session-notification");
        } catch {}

        useGnssStore.getState().clearSession();
        useGnssStore.getState().setLogging(false);
        set({ activeNotificationId: null });
      },

      exportNmea: async (sessionId) => {
        const session = get().sessions.find((s) => s.id === sessionId);
        if (!session) return { success: false, message: "Session not found." };
        try {
          let directoryUri = get().exportDirectoryUri;

          if (!directoryUri) {
            return {
              success: false,
              needsPermission: true,
              message:
                "Please select a folder once. After this, your logs will save there instantly with one tap.",
            };
          }

          const content = await FileSystem.readAsStringAsync(session.filePath);
          const uri = await FileSystem.StorageAccessFramework.createFileAsync(
            directoryUri,
            `gnss_log_${sessionId}.nmea`,
            "text/plain",
          );
          await FileSystem.writeAsStringAsync(uri, content, {
            encoding: FileSystem.EncodingType.UTF8,
          });
          return {
            success: true,
            message: "Saved NMEA log directly to the selected folder.",
          };
        } catch (e) {
          return {
            success: false,
            message:
              "Could not save the file. You may need to reset the folder permission in Settings.",
          };
        }
      },

      exportCsv: async (sessionId) => {
        const session = get().sessions.find((s) => s.id === sessionId);
        if (!session) return { success: false, message: "Session not found." };
        try {
          let directoryUri = get().exportDirectoryUri;

          if (!directoryUri) {
            return {
              success: false,
              needsPermission: true,
              message:
                "Please select a folder once. After this, your logs will save there instantly with one tap.",
            };
          }

          const content = await FileSystem.readAsStringAsync(
            session.filePathCsv,
          );
          const uri = await FileSystem.StorageAccessFramework.createFileAsync(
            directoryUri,
            `gnss_log_${sessionId}.csv`,
            "text/csv",
          );
          await FileSystem.writeAsStringAsync(uri, content, {
            encoding: FileSystem.EncodingType.UTF8,
          });
          return {
            success: true,
            message: "Saved CSV log directly to the selected folder.",
          };
        } catch (e) {
          return {
            success: false,
            message:
              "Could not save the file. You may need to reset the folder permission in Settings.",
          };
        }
      },

      deleteSession: async (sessionId) => {
        const session = get().sessions.find((s) => s.id === sessionId);
        if (!session) return;
        try {
          await FileSystem.deleteAsync(session.filePath, { idempotent: true });
        } catch {}
        try {
          await FileSystem.deleteAsync(session.filePathCsv, {
            idempotent: true,
          });
        } catch {}
        set((s) => ({
          sessions: s.sessions.filter((sess) => sess.id !== sessionId),
        }));
      },

      exportBulk: async (format) => {
        const { sessions, exportDirectoryUri } = get();
        if (sessions.length === 0)
          return {
            success: false,
            message: "No sessions to export.",
            count: 0,
          };
        if (!exportDirectoryUri) {
          return {
            success: false,
            needsPermission: true,
            message:
              "Please select a folder once. After this, your logs will save there instantly with one tap.",
            count: 0,
          };
        }

        let successCount = 0;
        try {
          for (const session of sessions) {
            if (format === "all" || format === "nmea") {
              const nmeaContent = await FileSystem.readAsStringAsync(
                session.filePath,
              );
              const nmeaUri =
                await FileSystem.StorageAccessFramework.createFileAsync(
                  exportDirectoryUri,
                  `gnss_log_${session.id}.nmea`,
                  "text/plain",
                );
              await FileSystem.writeAsStringAsync(nmeaUri, nmeaContent);
            }

            if (format === "all" || format === "csv") {
              const csvContent = await FileSystem.readAsStringAsync(
                session.filePathCsv,
              );
              const csvUri =
                await FileSystem.StorageAccessFramework.createFileAsync(
                  exportDirectoryUri,
                  `gnss_log_${session.id}.csv`,
                  "text/csv",
                );
              await FileSystem.writeAsStringAsync(csvUri, csvContent);
            }
            successCount++;
          }
          return {
            success: true,
            message: `Successfully exported ${successCount} sessions.`,
            count: successCount,
          };
        } catch (e) {
          return {
            success: false,
            message: "Bulk export failed. Folder permission may have expired.",
            count: successCount,
          };
        }
      },

      clearAll: async () => {
        const { sessions } = get();
        for (const session of sessions) {
          try {
            await FileSystem.deleteAsync(session.filePath, {
              idempotent: true,
            });
          } catch {}
          try {
            await FileSystem.deleteAsync(session.filePathCsv, {
              idempotent: true,
            });
          } catch {}
        }
        set({ sessions: [], activeSessionId: null });
      },

      setExportDirectory: async () => {
        try {
          const permissions =
            await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
          if (permissions.granted) {
            set({ exportDirectoryUri: permissions.directoryUri });
            return true;
          }
          return false;
        } catch (e) {
          return false;
        }
      },
      resetExportDirectory: () => set({ exportDirectoryUri: null }),
    }),
    {
      name: "log-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        sessions: state.sessions,
        exportDirectoryUri: state.exportDirectoryUri,
      }),
    },
  ),
);
