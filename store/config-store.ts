import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface DeviceConfig {
  constellations: {
    gps: boolean;
    glonass: boolean;
    galileo: boolean;
    beidou: boolean;
    qzss: boolean;
    navic: boolean;
  };
  updateRateMs: number;
  showCombinedTalker: boolean;
  sbasEnabled: boolean;
  firmwareVersion: string | null;
}

interface ConfigState {
  deviceConfig: DeviceConfig;
}

interface ConfigActions {
  setConstellations: (constellations: DeviceConfig["constellations"]) => void;
  setUpdateRate: (rateMs: number) => void;
  setShowCombinedTalker: (show: boolean) => void;
  setSbasEnabled: (enabled: boolean) => void;
  setFirmwareVersion: (version: string | null) => void;
  clearDeviceData: () => void;
  resetConfig: () => void;
}

const defaultConfig: DeviceConfig = {
  constellations: {
    gps: true,
    glonass: false,
    galileo: true,
    beidou: false,
    qzss: true,
    navic: true,
  },
  updateRateMs: 1000,
  showCombinedTalker: true,
  sbasEnabled: true,
  firmwareVersion: null,
};

export const useConfigStore = create<ConfigState & ConfigActions>()(
  persist(
    (set) => ({
      deviceConfig: { ...defaultConfig },

      setConstellations: (constellations) =>
        set((state) => ({
          deviceConfig: {
            ...state.deviceConfig,
            constellations,
          },
        })),

      setUpdateRate: (rateMs) =>
        set((state) => ({
          deviceConfig: {
            ...state.deviceConfig,
            updateRateMs: rateMs,
          },
        })),

      setShowCombinedTalker: (show) =>
        set((state) => ({
          deviceConfig: {
            ...state.deviceConfig,
            showCombinedTalker: show,
          },
        })),

      setSbasEnabled: (enabled) =>
        set((state) => ({
          deviceConfig: {
            ...state.deviceConfig,
            sbasEnabled: enabled,
          },
        })),

      setFirmwareVersion: (version) =>
        set((state) => ({
          deviceConfig: {
            ...state.deviceConfig,
            firmwareVersion: version,
          },
        })),

      clearDeviceData: () =>
        set((state) => ({
          deviceConfig: {
            ...state.deviceConfig,
            constellations: {
              gps: false,
              glonass: false,
              galileo: false,
              beidou: false,
              qzss: false,
              navic: false,
            },
            firmwareVersion: null,
          },
        })),

      resetConfig: () => set({ deviceConfig: { ...defaultConfig } }),
    }),
    {
      name: "gnss-config-storage",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
