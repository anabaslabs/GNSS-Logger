import { useEffect, useState } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
import { Colors } from '@/constants/Colors';

export function useAppTheme() {
  const [scheme, setScheme] = useState<ColorSchemeName>(Appearance.getColorScheme() ?? 'dark');

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setScheme(colorScheme);
    });
    return () => subscription.remove();
  }, []);

  const activeScheme = scheme ?? 'dark';
  return {
    isDark: activeScheme === 'dark',
    colors: Colors[activeScheme],
  };
}
