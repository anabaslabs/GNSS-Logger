import React, { useEffect } from 'react';
import { Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Lexend_300Light,
  Lexend_400Regular,
  Lexend_500Medium,
  Lexend_600SemiBold,
  Lexend_700Bold,
  Lexend_800ExtraBold,
} from '@expo-google-fonts/lexend';
import {
  initializeBle,
  onNmeaLine,
  onConnectionChange,
  onDeviceFound,
  destroyBle,
} from '@/lib/ble-manager';
import { parseNmea } from '@/lib/nmea-parser';
import { useGnssStore } from '@/store/gnss-store';
import { useBleStore } from '@/store/ble-store';
import { useAppTheme } from '@/hooks/useAppTheme';
import type { BleDevice } from '@/types/gnss';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

// Override global Text font-family fallback
interface TextWithDefaultProps extends React.FC {
  defaultProps?: any;
}
const TextComp = Text as unknown as TextWithDefaultProps;
if (!TextComp.defaultProps) TextComp.defaultProps = {};
TextComp.defaultProps.style = [
  { fontFamily: 'Lexend_400Regular' },
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

  const { applyGga, applyRmc, applyVtg, applyGsa, applyGsv, appendRaw } = useGnssStore();
  const { setConnected, setDisconnected, addScannedDevice } = useBleStore();

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    // Register NMEA line handler
    onNmeaLine((line) => {
      appendRaw(line);
      const parsed = parseNmea(line);
      if (!parsed) return;
      switch (parsed.type) {
        case 'GGA': applyGga(parsed.data); break;
        case 'RMC': applyRmc(parsed.data); break;
        case 'VTG': applyVtg(parsed.data); break;
        case 'GSA': applyGsa(parsed.data); break;
        case 'GSV': applyGsv(parsed.data.talkerId, parsed.data.satellites); break;
        default: break;
      }
    });

    // Register connection handler
    onConnectionChange((deviceId, connected) => {
      if (connected) {
        setConnected(deviceId, null);
      } else {
        setDisconnected();
      }
    });

    // Register device scan handler
    onDeviceFound((peripheral) => {
      const device: BleDevice = {
        id: peripheral.id,
        name: peripheral.name ?? null,
        rssi: peripheral.rssi ?? -99,
      };
      addScannedDevice(device);
    });

    // Initialize BLE
    initializeBle().catch(console.error);

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
          <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
            <Stack
              screenOptions={{
                headerShown: false,
                headerStyle: { backgroundColor: colors.background },
                headerTintColor: colors.text,
                headerTitleStyle: { fontFamily: 'Lexend_700Bold' },
                contentStyle: { backgroundColor: colors.background },
                animation: 'ios_from_right',
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="ble-scan"
                options={{
                  title: 'Connect to Device',
                  presentation: 'modal',
                  headerStyle: { backgroundColor: colors.surface },
                  headerTitleStyle: { fontFamily: 'Lexend_700Bold' },
                }}
              />
            </Stack>
          </SafeAreaView>
        </ThemeProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
