import type { LogSession } from "@/types/gnss";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface LogState {
  sessions: LogSession[];
  activeSessionId: string | null;
  exportDirectoryUri: string | null;
}

interface LogActions {
  startSession: (nmeaLines: string[]) => Promise<string | null>;
  endSession: (
    sessionId: string,
    nmeaLines: string[],
    fixCount: number,
  ) => Promise<void>;
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

const LOGS_DIR = `${FileSystem.documentDirectory}gnss-logs/`;

async function ensureLogsDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(LOGS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(LOGS_DIR, { intermediates: true });
  }
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

export const useLogStore = create<LogState & LogActions>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeSessionId: null,
      exportDirectoryUri: null,

      startSession: async (nmeaLines) => {
        await ensureLogsDir();
        const id = `session_${Date.now()}`;
        const startTime = Date.now();
        const filePath = `${LOGS_DIR}${id}.nmea`;
        const filePathCsv = `${LOGS_DIR}${id}.csv`;

        await FileSystem.writeAsStringAsync(
          filePath,
          nmeaLines.join("\n") + "\n",
        );
        await FileSystem.writeAsStringAsync(filePathCsv, nmeaToCsv(nmeaLines));

        const session: LogSession = {
          id,
          startTime,
          endTime: null,
          fixCount: 0,
          filePath,
          filePathCsv,
        };

        set((s) => ({
          sessions: [session, ...s.sessions],
          activeSessionId: id,
        }));
        return id;
      },

      endSession: async (sessionId, nmeaLines, fixCount) => {
        const session = get().sessions.find((s) => s.id === sessionId);
        if (!session) return;

        await FileSystem.writeAsStringAsync(
          session.filePath,
          nmeaLines.join("\n") + "\n",
        );
        await FileSystem.writeAsStringAsync(
          session.filePathCsv,
          nmeaToCsv(nmeaLines),
        );

        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === sessionId
              ? { ...sess, endTime: Date.now(), fixCount }
              : sess,
          ),
          activeSessionId: null,
        }));
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
                'Please select a folder (like "Download") once. After this, your logs will save there instantly with one tap.',
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
                'Please select a folder (like "Download") once. After this, your logs will save there instantly with one tap.',
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
              'Please select a folder (like "Download") once. After this, your logs will save there instantly with one tap.',
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
