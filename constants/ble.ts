/** Nordic UART Service (NUS) — standard BLE UART profile used by most ESP32 firmware */
export const NUS_SERVICE_UUID = "6E400001-B5A3-F393-E0A9-E50E24DCCA9E";
/** TX Characteristic: ESP32 → Phone (Notify) */
export const NUS_TX_CHAR_UUID = "6E400003-B5A3-F393-E0A9-E50E24DCCA9E";
/** RX Characteristic: Phone → ESP32 (Write) */
export const NUS_RX_CHAR_UUID = "6E400002-B5A3-F393-E0A9-E50E24DCCA9E";

/** BLE scan duration in seconds */
export const BLE_SCAN_DURATION = 10;

/** MTU size to negotiate — larger MTU means fewer fragmented packets per NMEA line */
export const BLE_MTU_SIZE = 512;

/** Max reassembly buffer size (chars) — safety limit */
export const BLE_BUFFER_MAX = 4096;
