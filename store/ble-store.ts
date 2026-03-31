import { create } from 'zustand';
import type { BleDevice } from '@/types/gnss';

export type BleStatus =
  | 'idle'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'error';

interface BleState {
  status: BleStatus;
  connectedDeviceId: string | null;
  connectedDeviceName: string | null;
  scannedDevices: BleDevice[];
  rssi: number | null;
  lastError: string | null;
  autoReconnect: boolean;
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
}

export const useBleStore = create<BleState & BleActions>((set) => ({
  status: 'idle',
  connectedDeviceId: null,
  connectedDeviceName: null,
  scannedDevices: [],
  rssi: null,
  lastError: null,
  autoReconnect: true,

  setStatus: (status) => set({ status }),

  setConnected: (id, name) =>
    set({ status: 'connected', connectedDeviceId: id, connectedDeviceName: name, lastError: null }),

  setDisconnected: () =>
    set({ status: 'idle', connectedDeviceId: null, connectedDeviceName: null, rssi: null }),

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

  setError: (lastError) => set({ lastError, status: 'error' }),

  setAutoReconnect: (autoReconnect) => set({ autoReconnect }),
}));
