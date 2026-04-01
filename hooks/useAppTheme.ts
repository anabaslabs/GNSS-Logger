import { Colors } from "@/constants/Colors";
import { useThemeStore } from "@/store/theme-store";
import { useEffect, useState } from "react";
import { Appearance, ColorSchemeName } from "react-native";

export function useAppTheme() {
  const { themeMode } = useThemeStore();
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(
    Appearance.getColorScheme(),
  );

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme);
    });
    return () => subscription.remove();
  }, []);

  const activeScheme: "light" | "dark" =
    themeMode === "system" ? (systemScheme ?? "dark") : themeMode;

  return {
    isDark: activeScheme === "dark",
    colors: Colors[activeScheme],
    themeMode,
  };
}
