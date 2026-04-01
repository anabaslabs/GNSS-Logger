/**
 * BLE Manager singleton
 * Wraps react-native-ble-manager to provide scan, connect,
 * subscribe to NUS notifications, and automatic string reassembly.
 *
 * Safe for non-native environments (Expo Go, web): all operations
 * become no-ops if the native module is unavailable. BLE only
 * works in a custom dev build (`npx expo run:android`).
 */
import { NativeEventEmitter, NativeModules, Platform, PermissionsAndroid } from 'react-native';
import type { Peripheral } from 'react-native-ble-manager';
import {
  NUS_SERVICE_UUID,
  NUS_TX_CHAR_UUID,
  NUS_RX_CHAR_UUID,
  BLE_SCAN_DURATION,
  BLE_MTU_SIZE,
  BLE_BUFFER_MAX,
} from '@/constants/ble';

// ---------------------------------------------------------------------------
// Lazy-load — react-native-ble-manager throws in constructor if native module
// is missing (e.g. running in Expo Go without a custom build)
// ---------------------------------------------------------------------------
let BleManager: typeof import('react-native-ble-manager').default | null = null;
let bleEmitter: NativeEventEmitter | null = null;

try {
  const mod = require('react-native-ble-manager');
  BleManager = mod.default ?? mod;
  const BleManagerModule = NativeModules.BleManager;
  if (BleManagerModule) {
    bleEmitter = new NativeEventEmitter(BleManagerModule);
  }
} catch (e) {
  /* Native module not available – running in limited mode (Expo Go / web). */
}

const IS_NATIVE_AVAILABLE = BleManager !== null;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type NmeaLineCallback = (line: string) => void;
export type DeviceFoundCallback = (peripheral: Peripheral) => void;
export type ConnectionCallback = (deviceId: string, connected: boolean) => void;

// ---------------------------------------------------------------------------
// Singleton state
// ---------------------------------------------------------------------------
let initialized = false;
let nmeaCallback: NmeaLineCallback | null = null;
let connectionCallback: ConnectionCallback | null = null;
let deviceFoundCallback: DeviceFoundCallback | null = null;

/** Partial NMEA line reassembly buffer per device */
const reassemblyBuffers: Record<string, string> = {};

// Event subscriptions
const subscriptions: ReturnType<NativeEventEmitter['addListener']>[] = [];

// ---------------------------------------------------------------------------
// Permission helpers
// ---------------------------------------------------------------------------
async function requestAndroidPermissions(): Promise<boolean> {
  if (process.env.EXPO_OS !== 'android') return true;

  const apiLevel = parseInt(String(Platform.Version), 10);

  if (apiLevel >= 31) {
    const scan = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      { title: 'Bluetooth Scan', message: 'Required to scan for BLE devices.', buttonPositive: 'OK' },
    );
    const connect = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      { title: 'Bluetooth Connect', message: 'Required to connect to BLE devices.', buttonPositive: 'OK' },
    );
    const location = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      { title: 'Location', message: 'Required for BLE scanning on Android.', buttonPositive: 'OK' },
    );
    return (
      scan === PermissionsAndroid.RESULTS.GRANTED &&
      connect === PermissionsAndroid.RESULTS.GRANTED &&
      location === PermissionsAndroid.RESULTS.GRANTED
    );
  } else {
    const location = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      { title: 'Location', message: 'Required for BLE scanning.', buttonPositive: 'OK' },
    );
    return location === PermissionsAndroid.RESULTS.GRANTED;
  }
}

// ---------------------------------------------------------------------------
// NMEA reassembly — BLE packets may arrive fragmented mid-sentence
// ---------------------------------------------------------------------------
function processNmeaChunk(deviceId: string, chunk: string): void {
  if (!reassemblyBuffers[deviceId]) reassemblyBuffers[deviceId] = '';

  reassemblyBuffers[deviceId] += chunk;

  if (reassemblyBuffers[deviceId].length > BLE_BUFFER_MAX) {
    const idx = reassemblyBuffers[deviceId].lastIndexOf('$');
    reassemblyBuffers[deviceId] = idx >= 0
      ? reassemblyBuffers[deviceId].slice(idx)
      : '';
  }

  const lines = reassemblyBuffers[deviceId].split('\n');
  reassemblyBuffers[deviceId] = lines.pop() ?? '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('$') && nmeaCallback) {
      nmeaCallback(trimmed);
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Initialize BLE manager. Must be called once at app start. */
export async function initializeBle(): Promise<void> {
  if (!IS_NATIVE_AVAILABLE || !BleManager || initialized) return;
  await BleManager.start({ showAlert: false });
  initialized = true;

  if (!bleEmitter) return;

  subscriptions.push(
    bleEmitter.addListener('BleManagerDiscoverPeripheral', (peripheral: Peripheral) => {
      deviceFoundCallback?.(peripheral);
    }),
  );

  subscriptions.push(
    bleEmitter.addListener(
      'BleManagerDidUpdateValueForCharacteristic',
      (event: { peripheral: string; value: number[] }) => {
        const text = String.fromCharCode(...event.value);
        processNmeaChunk(event.peripheral, text);
      },
    ),
  );

  subscriptions.push(
    bleEmitter.addListener(
      'BleManagerDisconnectPeripheral',
      (event: { peripheral: string }) => {
        connectionCallback?.(event.peripheral, false);
        delete reassemblyBuffers[event.peripheral];
      },
    ),
  );
}

/** Clean up all BLE event listeners */
export function destroyBle(): void {
  subscriptions.forEach((s) => s.remove());
  subscriptions.length = 0;
  initialized = false;
}

/** Register callback for incoming complete NMEA lines */
export function onNmeaLine(cb: NmeaLineCallback): void {
  nmeaCallback = cb;
}

/** Register callback for connection state changes */
export function onConnectionChange(cb: ConnectionCallback): void {
  connectionCallback = cb;
}

/** Register callback for device discovery during scan */
export function onDeviceFound(cb: DeviceFoundCallback): void {
  deviceFoundCallback = cb;
}

/** Request permissions and start BLE scan */
export async function startScan(): Promise<boolean> {
  if (!IS_NATIVE_AVAILABLE || !BleManager) {
    return false;
  }
  const granted = await requestAndroidPermissions();
  if (!granted) return false;

  try {
    await BleManager.scan({
      serviceUUIDs: [NUS_SERVICE_UUID],
      seconds: BLE_SCAN_DURATION,
      allowDuplicates: true,
    });
    return true;
  } catch {
    try {
      await BleManager.scan({
        serviceUUIDs: [],
        seconds: BLE_SCAN_DURATION,
        allowDuplicates: true,
      });
      return true;
    } catch {
      return false;
    }
  }
}

/** Stop an ongoing BLE scan */
export async function stopScan(): Promise<void> {
  if (!IS_NATIVE_AVAILABLE || !BleManager) return;
  try { await BleManager.stopScan(); } catch { /* noop */ }
}

/** Connect to a peripheral and subscribe to NUS TX notifications */
export async function connectAndSubscribe(deviceId: string): Promise<void> {
  if (!IS_NATIVE_AVAILABLE || !BleManager) throw new Error('BLE native module not available. Use a custom dev build (expo run:android).');

  await BleManager.connect(deviceId);

  try {
    await BleManager.requestMTU(deviceId, BLE_MTU_SIZE);
  } catch { /* non-fatal */ }

  await BleManager.retrieveServices(deviceId);
  await BleManager.startNotification(deviceId, NUS_SERVICE_UUID, NUS_TX_CHAR_UUID);

  connectionCallback?.(deviceId, true);
}

/** Send a command string to the ESP32 via NUS RX characteristic */
export async function sendCommand(deviceId: string, command: string): Promise<void> {
  if (!IS_NATIVE_AVAILABLE || !BleManager) return;
  const bytes = Array.from(command).map((c) => c.charCodeAt(0));
  await BleManager.write(deviceId, NUS_SERVICE_UUID, NUS_RX_CHAR_UUID, bytes, bytes.length);
}

/** Disconnect from a peripheral */
export async function disconnectDevice(deviceId: string): Promise<void> {
  if (!IS_NATIVE_AVAILABLE || !BleManager) return;
  try { await BleManager.stopNotification(deviceId, NUS_SERVICE_UUID, NUS_TX_CHAR_UUID); } catch { /* noop */ }
  try { await BleManager.disconnect(deviceId); } catch { /* noop */ }
  delete reassemblyBuffers[deviceId];
  connectionCallback?.(deviceId, false);
}

/** Get list of currently connected peripherals */
export async function getConnectedDevices(): Promise<Peripheral[]> {
  if (!IS_NATIVE_AVAILABLE || !BleManager) return [];
  return BleManager.getConnectedPeripherals([]);
}

/** Whether BLE native module is compiled in (false in Expo Go) */
export { IS_NATIVE_AVAILABLE as isBleAvailable };
