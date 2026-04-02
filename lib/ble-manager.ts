import {
  BLE_BUFFER_MAX,
  BLE_MTU_SIZE,
  BLE_SCAN_DURATION,
  NUS_RX_CHAR_UUID,
  NUS_SERVICE_UUID,
  NUS_TX_CHAR_UUID,
} from "@/constants/ble";
import {
  NativeEventEmitter,
  NativeModules,
  PermissionsAndroid,
  Platform,
} from "react-native";
import type { Peripheral } from "react-native-ble-manager";

let BleManager: typeof import("react-native-ble-manager").default | null = null;
let bleEmitter: NativeEventEmitter | null = null;

try {
  const mod = require("react-native-ble-manager");
  BleManager = mod.default ?? mod;
  const BleManagerModule = NativeModules.BleManager;
  if (BleManagerModule) {
    bleEmitter = new NativeEventEmitter(BleManagerModule);
  }
} catch (e) {}

export { bleEmitter };

const IS_NATIVE_AVAILABLE = BleManager !== null;

export type NmeaLineCallback = (line: string) => void;
export type DeviceFoundCallback = (peripheral: Peripheral) => void;
export type ConnectionCallback = (deviceId: string, connected: boolean) => void;

let initialized = false;
let nmeaCallback: NmeaLineCallback | null = null;
let connectionCallback: ConnectionCallback | null = null;
let deviceFoundCallback: DeviceFoundCallback | null = null;

const reassemblyBuffers: Record<string, string> = {};

const subscriptions: ReturnType<NativeEventEmitter["addListener"]>[] = [];

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
  if (!IS_NATIVE_AVAILABLE || !BleManager || initialized) return;
  await BleManager.start({ showAlert: false });
  initialized = true;

  if (!bleEmitter) return;

  subscriptions.push(
    bleEmitter.addListener(
      "BleManagerDiscoverPeripheral",
      (peripheral: Peripheral) => {
        deviceFoundCallback?.(peripheral);
      },
    ),
  );

  subscriptions.push(
    bleEmitter.addListener(
      "BleManagerDidUpdateValueForCharacteristic",
      (event: { peripheral: string; value: number[] }) => {
        const text = String.fromCharCode(...event.value);
        processNmeaChunk(event.peripheral, text);
      },
    ),
  );

  subscriptions.push(
    bleEmitter.addListener(
      "BleManagerDisconnectPeripheral",
      (event: { peripheral: string }) => {
        connectionCallback?.(event.peripheral, false);
        delete reassemblyBuffers[event.peripheral];
      },
    ),
  );
}

export function destroyBle(): void {
  subscriptions.forEach((s) => s.remove());
  subscriptions.length = 0;
  initialized = false;
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

export async function stopScan(): Promise<void> {
  if (!IS_NATIVE_AVAILABLE || !BleManager) return;
  try {
    await BleManager.stopScan();
  } catch {}
}

export async function connectAndSubscribe(deviceId: string): Promise<void> {
  if (!IS_NATIVE_AVAILABLE || !BleManager)
    throw new Error(
      "BLE native module not available. Use a custom dev build (expo run:android).",
    );

  await BleManager.connect(deviceId);

  try {
    await BleManager.requestMTU(deviceId, BLE_MTU_SIZE);
  } catch {}

  await BleManager.retrieveServices(deviceId);
  await BleManager.startNotification(
    deviceId,
    NUS_SERVICE_UUID,
    NUS_TX_CHAR_UUID,
  );

  connectionCallback?.(deviceId, true);
}

export async function sendCommand(
  deviceId: string,
  command: string,
): Promise<void> {
  if (!IS_NATIVE_AVAILABLE || !BleManager) return;
  const bytes = Array.from(command).map((c) => c.charCodeAt(0));
  await BleManager.write(
    deviceId,
    NUS_SERVICE_UUID,
    NUS_RX_CHAR_UUID,
    bytes,
    bytes.length,
  );
}

export async function disconnectDevice(deviceId: string): Promise<void> {
  if (!IS_NATIVE_AVAILABLE || !BleManager) return;
  try {
    await BleManager.stopNotification(
      deviceId,
      NUS_SERVICE_UUID,
      NUS_TX_CHAR_UUID,
    );
  } catch {}
  try {
    await BleManager.disconnect(deviceId);
  } catch {}
  delete reassemblyBuffers[deviceId];
  connectionCallback?.(deviceId, false);
}

export async function getConnectedDevices(): Promise<Peripheral[]> {
  if (!IS_NATIVE_AVAILABLE || !BleManager) return [];
  return BleManager.getConnectedPeripherals([]);
}

export async function checkBluetoothState(): Promise<string> {
  if (!IS_NATIVE_AVAILABLE || !BleManager) return "off";
  try {
    return await BleManager.checkState();
  } catch {
    return "off";
  }
}

export async function enableBluetoothAndroid(): Promise<void> {
  if (Platform.OS !== "android" || !IS_NATIVE_AVAILABLE || !BleManager) return;
  try {
    await BleManager.enableBluetooth();
  } catch {}
}

export { IS_NATIVE_AVAILABLE as isBleAvailable };
