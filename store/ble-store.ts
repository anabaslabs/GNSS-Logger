import { BLE_SCAN_DURATION } from "@/constants/ble";
import { startScan, stopScan } from "@/lib/ble-manager";
import type { BleDevice } from "@/types/gnss";
import { create } from "zustand";

export type BleStatus =
  | "idle"
  | "scanning"
  | "connecting"
  | "connected"
  | "disconnecting"
  | "error";

interface BleState {
  status: BleStatus;
  connectedDeviceId: string | null;
  connectedDeviceName: string | null;
  scannedDevices: BleDevice[];
  rssi: number | null;
  lastError: string | null;
  autoReconnect: boolean;
  scanTimer: number;
}

interface BleActions {
  setStatus: (status: BleStatus) => void;
  setConnected: (id: string, name: string | null) => void;
  setDisconnected: () => void;
  addScannedDevice: (device: BleDevice) => void;
  clearScannedDevices: () => void;
  setRssi: (rssi: number) => void;
  setError: (err: string | null) => void;
  setAutoReconnect: (v: boolean) => void;
  setScanTimer: (v: number) => void;
  startScanWithTimer: () => Promise<void>;
  stopScanAndReset: () => Promise<void>;
}

let scanInterval: ReturnType<typeof setInterval> | null = null;

export const useBleStore = create<BleState & BleActions>((set) => ({
  status: "idle",
  connectedDeviceId: null,
  connectedDeviceName: null,
  scannedDevices: [],
  rssi: null,
  lastError: null,
  autoReconnect: true,
  scanTimer: 0,

  setStatus: (status) => set({ status }),

  setConnected: (id, name) =>
    set({
      status: "connected",
      connectedDeviceId: id,
      connectedDeviceName: name,
      lastError: null,
    }),

  setDisconnected: () =>
    set({
      status: "idle",
      connectedDeviceId: null,
      connectedDeviceName: null,
      rssi: null,
    }),

  addScannedDevice: (device) =>
    set((s) => {
      const exists = s.scannedDevices.findIndex((d) => d.id === device.id);
      if (exists >= 0) {
        const updated = [...s.scannedDevices];
        updated[exists] = device;
        return { scannedDevices: updated };
      }
      return { scannedDevices: [...s.scannedDevices, device] };
    }),

  clearScannedDevices: () => set({ scannedDevices: [] }),

  setRssi: (rssi) => set({ rssi }),

  setError: (lastError) => set({ lastError, status: "error" }),

  setAutoReconnect: (autoReconnect) => set({ autoReconnect }),
  setScanTimer: (scanTimer) => set({ scanTimer }),

  startScanWithTimer: async () => {
    const { status, setScanTimer, setStatus, clearScannedDevices, setError } =
      useBleStore.getState();
    if (status === "scanning") return;

    clearScannedDevices();
    setStatus("scanning");
    setScanTimer(BLE_SCAN_DURATION);

    const ok = await startScan();
    if (!ok) {
      setError("Bluetooth unavailable or permission denied");
      setStatus("idle");
      return;
    }

    if (scanInterval) clearInterval(scanInterval);
    scanInterval = setInterval(() => {
      const current = useBleStore.getState().scanTimer;
      if (current <= 1) {
        if (scanInterval) clearInterval(scanInterval);
        scanInterval = null;
        stopScan().catch(() => {});
        setStatus("idle");
        setScanTimer(0);
      } else {
        setScanTimer(current - 1);
      }
    }, 1000);
  },

  stopScanAndReset: async () => {
    if (scanInterval) {
      clearInterval(scanInterval);
      scanInterval = null;
    }
    await stopScan();
    useBleStore.getState().setStatus("idle");
    useBleStore.getState().setScanTimer(0);
  },
}));
