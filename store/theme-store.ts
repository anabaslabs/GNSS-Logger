import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeState {
  themeMode: ThemeMode;
}

interface ThemeActions {
  setThemeMode: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState & ThemeActions>()(
  persist(
    (set) => ({
      themeMode: 'system',
      setThemeMode: (themeMode) => set({ themeMode }),
    }),
    {
      name: 'theme-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
