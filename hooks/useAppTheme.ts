import { useEffect, useState } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useThemeStore } from '@/store/theme-store';

export function useAppTheme() {
  const { themeMode } = useThemeStore();
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(Appearance.getColorScheme());

  useEffect(() => {
    // Only track system changes if themeMode is set to 'system'
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme);
    });
    return () => subscription.remove();
  }, []);

  // Determine active theme
  const activeScheme: 'light' | 'dark' = 
    themeMode === 'system' 
      ? (systemScheme ?? 'dark') 
      : themeMode;

  return {
    isDark: activeScheme === 'dark',
    colors: Colors[activeScheme],
    themeMode, // expose for settings UI
  };
}
