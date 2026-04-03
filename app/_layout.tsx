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
import type { BleDevice, NmeaParsedSentence } from "@/types/gnss";
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

  const applyBatch = useGnssStore((s) => s.applyBatch);
  const clearLiveData = useGnssStore((s) => s.clearLiveData);

  const setConnected = useBleStore((s) => s.setConnected);
  const setDisconnected = useBleStore((s) => s.setDisconnected);
  const addScannedDevice = useBleStore((s) => s.addScannedDevice);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    const nmeaBuffer: string[] = [];

    onNmeaLine((line) => {
      nmeaBuffer.push(line);
    });

    const interval = setInterval(() => {
      if (nmeaBuffer.length === 0) return;

      const lines = [...nmeaBuffer];
      nmeaBuffer.length = 0;

      const parsedSentences = lines
        .map((l) => parseNmea(l))
        .filter((p): p is NmeaParsedSentence => p !== null);

      applyBatch(parsedSentences, lines);
    }, 100);

    onConnectionChange((deviceId, connected) => {
      if (connected) {
        setConnected(deviceId, null);
      } else {
        setDisconnected();
        clearLiveData();
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
      clearInterval(interval);
      destroyBle();
    };
  }, [
    addScannedDevice,
    applyBatch,
    clearLiveData,
    setConnected,
    setDisconnected,
  ]);

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
                  headerShown: false,
                  presentation: "transparentModal",
                  animation: "fade",
                }}
              />
            </Stack>
          </View>
        </ThemeProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
