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
    beidou_b1c: boolean;
  };
  updateRateMs: number;
  showCombinedTalker: boolean;
  sbasEnabled: boolean;
}

interface ConfigState {
  deviceConfig: DeviceConfig;
}

interface ConfigActions {
  setConstellation: (
    key: keyof DeviceConfig["constellations"],
    enabled: boolean,
  ) => void;
  setConstellations: (constellations: DeviceConfig["constellations"]) => void;
  setUpdateRate: (rateMs: number) => void;
  setShowCombinedTalker: (show: boolean) => void;
  setSbasEnabled: (enabled: boolean) => void;
  resetConfig: () => void;
}

const defaultConfig: DeviceConfig = {
  constellations: {
    gps: true,
    glonass: true,
    galileo: true,
    beidou: true,
    qzss: true,
    navic: true,
    beidou_b1c: false,
  },
  updateRateMs: 1000,
  showCombinedTalker: true,
  sbasEnabled: true,
};

export const useConfigStore = create<ConfigState & ConfigActions>()(
  persist(
    (set) => ({
      deviceConfig: { ...defaultConfig },

      setConstellation: (key, enabled) =>
        set((state) => ({
          deviceConfig: {
            ...state.deviceConfig,
            constellations: {
              ...state.deviceConfig.constellations,
              [key]: enabled,
            },
          },
        })),

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

      resetConfig: () => set({ deviceConfig: { ...defaultConfig } }),
    }),
    {
      name: "gnss-config-storage",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
