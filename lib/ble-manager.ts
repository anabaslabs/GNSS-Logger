import {
  BLE_BUFFER_MAX,
  BLE_MTU_SIZE,
  BLE_SCAN_DURATION,
  NUS_RX_CHAR_UUID,
  NUS_SERVICE_UUID,
  NUS_TX_CHAR_UUID,
} from "@/constants/ble";
import { PermissionsAndroid, Platform } from "react-native";
import {
  BleErrorCode,
  BleManager,
  Device,
  State,
  Subscription,
} from "react-native-ble-plx";

function base64Decode(base64: string): string {
  try {
    if (typeof atob === "function") {
      return atob(base64);
    }

    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let result = "";
    let i = 0;
    base64 = base64.replace(/[^A-Za-z0-9+/]/g, "");
    while (i < base64.length) {
      const a = chars.indexOf(base64.charAt(i++));
      const b = chars.indexOf(base64.charAt(i++));
      const c = chars.indexOf(base64.charAt(i++));
      const d = chars.indexOf(base64.charAt(i++));
      result += String.fromCharCode((a << 2) | (b >> 4));
      if (c !== 64) result += String.fromCharCode(((b & 15) << 4) | (c >> 2));
      if (d !== 64) result += String.fromCharCode(((c & 3) << 6) | d);
    }
    return result;
  } catch {
    return "";
  }
}

function base64Encode(str: string): string {
  try {
    if (typeof btoa === "function") {
      return btoa(str);
    }
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let result = "";
    let i = 0;
    while (i < str.length) {
      const a = str.charCodeAt(i++);
      const b = str.charCodeAt(i++);
      const c = str.charCodeAt(i++);
      result += chars.charAt(a >> 2);
      result += chars.charAt(((a & 3) << 4) | (b >> 4));
      result += isNaN(b) ? "=" : chars.charAt(((b & 15) << 2) | (c >> 6));
      result += isNaN(c) ? "=" : chars.charAt(c & 63);
    }
    return result;
  } catch {
    return "";
  }
}

let bleManager: BleManager | null = null;

try {
  bleManager = new BleManager();
} catch (e) {
  console.error("[BLE] Failed to create BleManager:", e);
}

const IS_NATIVE_AVAILABLE = bleManager !== null;

export interface Peripheral {
  id: string;
  name: string | null;
  rssi: number | null;
}

export type NmeaLineCallback = (line: string) => void;
export type DeviceFoundCallback = (peripheral: Peripheral) => void;
export type ConnectionCallback = (deviceId: string, connected: boolean) => void;

let initialized = false;
let nmeaCallback: NmeaLineCallback | null = null;
let connectionCallback: ConnectionCallback | null = null;
let deviceFoundCallback: DeviceFoundCallback | null = null;

const reassemblyBuffers: Record<string, string> = {};
const subscriptions: Subscription[] = [];
let connectedDevice: Device | null = null;
let monitorSubscription: Subscription | null = null;

async function requestAndroidPermissions(): Promise<boolean> {
  if (process.env.EXPO_OS !== "android") return true;

  const apiLevel = parseInt(String(Platform.Version), 10);

  if (apiLevel >= 31) {
    const scan = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      {
        title: "Bluetooth Scan",
        message: "Required to scan for BLE devices.",
        buttonPositive: "OK",
      },
    );
    const connect = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      {
        title: "Bluetooth Connect",
        message: "Required to connect to BLE devices.",
        buttonPositive: "OK",
      },
    );
    const location = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: "Location",
        message: "Required for BLE scanning on Android.",
        buttonPositive: "OK",
      },
    );
    return (
      scan === PermissionsAndroid.RESULTS.GRANTED &&
      connect === PermissionsAndroid.RESULTS.GRANTED &&
      location === PermissionsAndroid.RESULTS.GRANTED
    );
  } else {
    const location = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: "Location",
        message: "Required for BLE scanning.",
        buttonPositive: "OK",
      },
    );
    return location === PermissionsAndroid.RESULTS.GRANTED;
  }
}

function processNmeaChunk(deviceId: string, chunk: string): void {
  if (!reassemblyBuffers[deviceId]) reassemblyBuffers[deviceId] = "";

  reassemblyBuffers[deviceId] += chunk;

  if (reassemblyBuffers[deviceId].length > BLE_BUFFER_MAX) {
    const idx = reassemblyBuffers[deviceId].lastIndexOf("$");
    reassemblyBuffers[deviceId] =
      idx >= 0 ? reassemblyBuffers[deviceId].slice(idx) : "";
  }

  const lines = reassemblyBuffers[deviceId].split("\n");
  reassemblyBuffers[deviceId] = lines.pop() ?? "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("$") && nmeaCallback) {
      nmeaCallback(trimmed);
    }
  }
}

export async function initializeBle(): Promise<void> {
  if (!IS_NATIVE_AVAILABLE || !bleManager || initialized) {
    return;
  }

  const stateSubscription = bleManager.onStateChange((state) => {}, true);
  subscriptions.push(stateSubscription);

  initialized = true;
}

export function destroyBle(): void {
  subscriptions.forEach((s) => s.remove());
  subscriptions.length = 0;
  if (monitorSubscription) {
    monitorSubscription.remove();
    monitorSubscription = null;
  }
  initialized = false;
  connectedDevice = null;
}

export function onNmeaLine(cb: NmeaLineCallback): void {
  nmeaCallback = cb;
}

export function onConnectionChange(cb: ConnectionCallback): void {
  connectionCallback = cb;
}

export function onDeviceFound(cb: DeviceFoundCallback): void {
  deviceFoundCallback = cb;
}

export async function startScan(): Promise<boolean> {
  if (!IS_NATIVE_AVAILABLE || !bleManager) {
    console.error("[BLE] BLE not available");
    return false;
  }

  const granted = await requestAndroidPermissions();
  if (!granted) {
    console.error("[BLE] Permissions denied");
    return false;
  }

  const state = await bleManager.state();
  if (state !== State.PoweredOn) {
    console.error("[BLE] Bluetooth is not powered on, state:", state);
    return false;
  }

  const seenDevices = new Set<string>();

  bleManager.startDeviceScan(
    null,
    { allowDuplicates: false },
    (error, device) => {
      if (error) {
        console.error("[BLE] Scan error:", error.message);
        return;
      }

      if (device && !seenDevices.has(device.id)) {
        seenDevices.add(device.id);

        const peripheral: Peripheral = {
          id: device.id,
          name: device.name,
          rssi: device.rssi,
        };
        deviceFoundCallback?.(peripheral);
      }
    },
  );

  setTimeout(() => {
    stopScan();
  }, BLE_SCAN_DURATION * 1000);

  return true;
}

export async function stopScan(): Promise<void> {
  if (!IS_NATIVE_AVAILABLE || !bleManager) return;
  try {
    bleManager.stopDeviceScan();
  } catch (e) {
    console.error("[BLE] Error stopping scan:", e);
  }
}

export async function connectAndSubscribe(deviceId: string): Promise<void> {
  if (!IS_NATIVE_AVAILABLE || !bleManager)
    throw new Error(
      "BLE native module not available. Use a custom dev build (expo run:android).",
    );

  const device = await bleManager.connectToDevice(deviceId, {
    requestMTU: BLE_MTU_SIZE,
  });

  await device.discoverAllServicesAndCharacteristics();

  connectedDevice = device;

  device.onDisconnected((error, disconnectedDevice) => {
    if (disconnectedDevice) {
      connectionCallback?.(disconnectedDevice.id, false);
      delete reassemblyBuffers[disconnectedDevice.id];
    }
    connectedDevice = null;
    if (monitorSubscription) {
      monitorSubscription.remove();
      monitorSubscription = null;
    }
  });

  monitorSubscription = device.monitorCharacteristicForService(
    NUS_SERVICE_UUID,
    NUS_TX_CHAR_UUID,
    (error, characteristic) => {
      if (error) {
        if (
          error.errorCode === BleErrorCode.OperationCancelled ||
          error.errorCode === BleErrorCode.DeviceDisconnected
        ) {
          return;
        }
        console.error("[BLE] Notification error:", error.message);
        return;
      }

      if (characteristic?.value) {
        const decoded = base64Decode(characteristic.value);
        processNmeaChunk(deviceId, decoded);
      }
    },
  );

  connectionCallback?.(deviceId, true);
}

export async function sendCommand(
  deviceId: string,
  command: string,
): Promise<void> {
  if (!IS_NATIVE_AVAILABLE || !connectedDevice) return;

  const encoded = base64Encode(command);
  await connectedDevice.writeCharacteristicWithResponseForService(
    NUS_SERVICE_UUID,
    NUS_RX_CHAR_UUID,
    encoded,
  );
}

export async function disconnectDevice(deviceId: string): Promise<void> {
  if (!IS_NATIVE_AVAILABLE || !bleManager) return;

  if (monitorSubscription) {
    monitorSubscription.remove();
    monitorSubscription = null;
  }

  try {
    await bleManager.cancelDeviceConnection(deviceId);
  } catch (e) {
    console.error("[BLE] Error disconnecting:", e);
  }

  delete reassemblyBuffers[deviceId];
  connectedDevice = null;
  connectionCallback?.(deviceId, false);
}

export async function getConnectedDevices(): Promise<Peripheral[]> {
  if (!IS_NATIVE_AVAILABLE || !bleManager) return [];
  try {
    const devices = await bleManager.connectedDevices([NUS_SERVICE_UUID]);
    return devices.map((d) => ({
      id: d.id,
      name: d.name,
      rssi: d.rssi,
    }));
  } catch {
    return [];
  }
}

export async function checkBluetoothState(): Promise<string> {
  if (!IS_NATIVE_AVAILABLE || !bleManager) return "off";
  try {
    const state = await bleManager.state();
    return state === State.PoweredOn ? "on" : "off";
  } catch {
    return "off";
  }
}

export async function enableBluetoothAndroid(): Promise<void> {
  if (Platform.OS !== "android" || !IS_NATIVE_AVAILABLE || !bleManager) return;
  try {
    await bleManager.enable();
  } catch (e) {
    console.error("[BLE] Could not enable Bluetooth:", e);
  }
}

export const bleEmitter = null;

export { IS_NATIVE_AVAILABLE as isBleAvailable };
