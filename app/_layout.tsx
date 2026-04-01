import { useAppTheme } from "@/hooks/useAppTheme";
import {
  destroyBle,
  initializeBle,
  onConnectionChange,
  onDeviceFound,
  onNmeaLine,
} from "@/lib/ble-manager";
import { parseNmea } from "@/lib/nmea-parser";
import { useBleStore } from "@/store/ble-store";
import { useGnssStore } from "@/store/gnss-store";
import type { BleDevice } from "@/types/gnss";
import {
  Lexend_300Light,
  Lexend_400Regular,
  Lexend_500Medium,
  Lexend_600SemiBold,
  Lexend_700Bold,
  Lexend_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/lexend";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

SplashScreen.preventAutoHideAsync();

interface TextWithDefaultProps extends React.FC {
  defaultProps?: any;
}
const TextComp = Text as unknown as TextWithDefaultProps;
if (!TextComp.defaultProps) TextComp.defaultProps = {};
TextComp.defaultProps.style = [
  { fontFamily: "Lexend_400Regular" },
  TextComp.defaultProps.style,
];

export default function RootLayout() {
  const { colors, isDark } = useAppTheme();

  const [fontsLoaded, fontError] = useFonts({
    Lexend_300Light,
    Lexend_400Regular,
    Lexend_500Medium,
    Lexend_600SemiBold,
    Lexend_700Bold,
    Lexend_800ExtraBold,
  });

  const { applyGga, applyRmc, applyVtg, applyGsa, applyGsv, appendRaw } =
    useGnssStore();
  const { setConnected, setDisconnected, addScannedDevice } = useBleStore();

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    onNmeaLine((line) => {
      appendRaw(line);
      const parsed = parseNmea(line);
      if (!parsed) return;
      switch (parsed.type) {
        case "GGA":
          applyGga(parsed.data);
          break;
        case "RMC":
          applyRmc(parsed.data);
          break;
        case "VTG":
          applyVtg(parsed.data);
          break;
        case "GSA":
          applyGsa(parsed.data);
          break;
        case "GSV":
          applyGsv(parsed.data.talkerId, parsed.data.satellites);
          break;
        default:
          break;
      }
    });

    onConnectionChange((deviceId, connected) => {
      if (connected) {
        setConnected(deviceId, null);
      } else {
        setDisconnected();
      }
    });

    onDeviceFound((peripheral) => {
      const device: BleDevice = {
        id: peripheral.id,
        name: peripheral.name ?? null,
        rssi: peripheral.rssi ?? -99,
      };
      addScannedDevice(device);
    });

    initializeBle().catch(() => {});

    return () => {
      destroyBle();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="auto" />
        <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
          <View style={{ flex: 1, backgroundColor: colors.background }}>
            <Stack
              screenOptions={{
                headerShown: false,
                headerStyle: { backgroundColor: colors.background },
                headerTintColor: colors.text,
                headerTitleStyle: { fontFamily: "Lexend_700Bold" },
                contentStyle: { backgroundColor: colors.background },
                animation: "ios_from_right",
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="ble-scan"
                options={{
                  title: "Connect to Device",
                  presentation: "modal",
                  headerStyle: { backgroundColor: colors.surface },
                  headerTitleStyle: { fontFamily: "Lexend_700Bold" },
                }}
              />
            </Stack>
          </View>
        </ThemeProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
