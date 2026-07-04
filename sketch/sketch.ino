/**
 * ESP32 GNSS Logger BLE Bridge
 *
 * Reads NMEA data from Quectel L89HA (currently mock data) and sends it to the
 * GNSS Logger app via BLE using Nordic UART Service (NUS).
 *
 * Hardware:
 * - ESP32 (any variant with BLE)
 * - Quectel L89HA connected via UART1 (GPIO5 RX, GPIO4 TX)
 *
 * BLE Service: Nordic UART Service (NUS)
 * - Service UUID: 6E400001-B5A3-F393-E0A9-E50E24DCCA9E
 * - TX Characteristic: 6E400003-B5A3-F393-E0A9-E50E24DCCA9E (ESP32 -> Phone)
 * - RX Characteristic: 6E400002-B5A3-F393-E0A9-E50E24DCCA9E (Phone -> ESP32)
 */

#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// ============================================================================
// Configuration
// ============================================================================

#define DEVICE_NAME "GNSS Logger"

// Set to true to use mock data, false to read from L89HA via UART
#define USE_MOCK_DATA false

// L89HA UART pins (Hybrid safe configuration)
#define L89HA_RX_PIN 16
#define L89HA_TX_PIN 4
#define L89HA_BAUD 115200

// Nordic UART Service UUIDs (matches app's constants/ble.ts)
#define SERVICE_UUID "6E400001-B5A3-F393-E0A9-E50E24DCCA9E"
#define CHARACTERISTIC_TX "6E400003-B5A3-F393-E0A9-E50E24DCCA9E" // ESP32 -> Phone
#define CHARACTERISTIC_RX "6E400002-B5A3-F393-E0A9-E50E24DCCA9E" // Phone -> ESP32

// BLE MTU (matches app's BLE_MTU_SIZE)
#define BLE_MTU 512

// Mock data update interval (ms)
#define MOCK_UPDATE_INTERVAL 1000

// ============================================================================
// BLE Objects
// ============================================================================

BLEServer *pServer = nullptr;
BLECharacteristic *pTxCharacteristic = nullptr;
bool deviceConnected = false;
bool oldDeviceConnected = false;

// ============================================================================
// NMEA Helper Functions
// ============================================================================

/**
 * Calculate NMEA checksum (XOR of all bytes between $ and *)
 */
uint8_t calculateChecksum(const char *sentence)
{
  uint8_t checksum = 0;
  if (sentence[0] == '$')
    sentence++;
  while (*sentence && *sentence != '*')
  {
    checksum ^= *sentence++;
  }
  return checksum;
}

#include "mock_data.h"

// ============================================================================
// L89HA UART Objects & Functions (Forward Declarations)
// ============================================================================
#if !USE_MOCK_DATA
HardwareSerial L89HA(2); // Switch back to UART2
#endif

// Forward declaration of setupL89HA
void setupL89HA();

// ============================================================================
// BLE Callbacks
// ============================================================================

class ServerCallbacks : public BLEServerCallbacks
{
  void onConnect(BLEServer *pServer) override
  {
    deviceConnected = true;
    Serial.println("[BLE] Device connected");
  }

  void onDisconnect(BLEServer *pServer) override
  {
    deviceConnected = false;
    Serial.println("[BLE] Device disconnected");
  }
};

class RxCallbacks : public BLECharacteristicCallbacks
{
  void onWrite(BLECharacteristic *pCharacteristic) override
  {
    String rxValue = pCharacteristic->getValue();
    static String bleBuffer = ""; // Persistent buffer for reassembly

    if (rxValue.length() > 0)
    {
      bleBuffer += rxValue;

      // Process if we have a full NMEA-style command (ends with \n or \r)
      if (bleBuffer.indexOf('\n') != -1 || bleBuffer.indexOf('\r') != -1)
      {
        bleBuffer.trim();
        if (bleBuffer.length() > 0)
        {
          Serial.print("[BLE] Received: ");
          Serial.println(bleBuffer.c_str());

          // Special handling for manual baud sync requests from app
#if !USE_MOCK_DATA
          if (bleBuffer.startsWith("SET_BAUD_115200"))
          {
            Serial.println("[BLE] Force sync to 115200 requested");
            setupL89HA();
          }
          else if (bleBuffer.startsWith("SET_BAUD_9600"))
          {
            Serial.println("[BLE] Force revert to 9600 requested");
            L89HA.begin(115200, SERIAL_8N1, L89HA_RX_PIN, L89HA_TX_PIN);
            L89HA.println("$PAIR864,0,0,9600*1E");
            delay(200);
            L89HA.begin(9600, SERIAL_8N1, L89HA_RX_PIN, L89HA_TX_PIN);
            Serial.println("[L89HA] Reverted to 9600");
          }
          else
          {
            L89HA.println(bleBuffer.c_str());
            Serial.print("[BLE->L89HA] Forwarded: ");
            Serial.println(bleBuffer.c_str());
          }
#else
          Serial.println("[BLE] Mock mode: Command ignored.");
#endif
        }
        bleBuffer = ""; // Clear for next command
      }
    }
  }
};

/**
 * Send NMEA sentence with checksum via BLE (Real hardware only)
 */
void sendNMEA(const char *sentence)
{
  if (!deviceConnected)
    return;

  char buffer[256];
  uint8_t checksum = calculateChecksum(sentence);
  snprintf(buffer, sizeof(buffer), "%s*%02X\r\n", sentence, checksum);

  pTxCharacteristic->setValue((uint8_t *)buffer, strlen(buffer));
  pTxCharacteristic->notify();

  Serial.print("[NMEA] ");
  Serial.print(buffer);
}

// ============================================================================
// L89HA UART Functions (for real hardware)
// ============================================================================

#if !USE_MOCK_DATA
String nmeaBuffer = "";

void setupL89HA()
{
  uint32_t bauds[] = {115200, 9600};
  bool detected = false;

  for (uint32_t b : bauds)
  {
    Serial.printf("[L89HA] Testing baud %d...\n", b);
    L89HA.begin(b, SERIAL_8N1, L89HA_RX_PIN, L89HA_TX_PIN);

    // Listen for NMEA start character ($) with longer timeout
    unsigned long start = millis();
    while (millis() - start < 2500)
    { // Increased to 2.5s
      if (L89HA.available() && L89HA.read() == '$')
      {
        detected = true;
        break;
      }
      delay(5);
    }

    if (detected)
    {
      Serial.printf("[L89HA] Detected module at %d baud\n", b);
      if (b != L89HA_BAUD)
      {
        Serial.printf("[L89HA] Syncing to %d baud...\n", L89HA_BAUD);

        // Flush any pending data before sending sync command
        while (L89HA.available())
          L89HA.read();

        // PAIR864 command to set baud rate
        char baudCmd[64];
        snprintf(baudCmd, sizeof(baudCmd), "$PAIR864,0,0,%d", L89HA_BAUD);
        uint8_t cs = calculateChecksum(baudCmd);

        // Send multiple times for reliability
        for (int i = 0; i < 3; i++)
        {
          L89HA.printf("%s*%02X\r\n", baudCmd, cs);
          delay(50);
        }

        delay(1000); // Wait 1s for hardware reconfiguration
        L89HA.begin(L89HA_BAUD, SERIAL_8N1, L89HA_RX_PIN, L89HA_TX_PIN);
      }
      break;
    }
    L89HA.end();
  }

  if (!detected)
  {
    Serial.printf("[L89HA] Module not responding. Defaulting to %d for commands.\n", L89HA_BAUD);
    L89HA.begin(L89HA_BAUD, SERIAL_8N1, L89HA_RX_PIN, L89HA_TX_PIN);
  }
  else
  {
    Serial.printf("[L89HA] READY at %d\n", L89HA_BAUD);
  }
}

void readAndForwardL89HA()
{
  while (L89HA.available())
  {
    char c = L89HA.read();

    // 1. Raw Bridge: Echo everything to Serial Monitor immediately
    Serial.write(c);

    // 2. BLE logic: Buffer full sentences for transmission
    if (c == '\n')
    {
      // Complete sentence received
      nmeaBuffer.trim();
      if (nmeaBuffer.startsWith("$") && deviceConnected)
      {
        // Forward to BLE
        String toSend = nmeaBuffer + "\r\n";
        pTxCharacteristic->setValue((uint8_t *)toSend.c_str(), toSend.length());
        pTxCharacteristic->notify();
      }
      nmeaBuffer = "";
    }
    else if (c != '\r')
    {
      nmeaBuffer += c;
      // Prevent buffer overflow
      if (nmeaBuffer.length() > 256)
      {
        nmeaBuffer = "";
      }
    }
  }
}
#endif

// ============================================================================
// Setup & Loop
// ============================================================================

void setup()
{
  Serial.begin(115200);
  Serial.println("\n========================================");
  Serial.println("ESP32 GNSS Logger BLE Bridge");
  Serial.println("========================================");

  // Initialize BLE
  BLEDevice::init(DEVICE_NAME);
  BLEDevice::setMTU(BLE_MTU);

  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new ServerCallbacks());

  // Create Nordic UART Service
  BLEService *pService = pServer->createService(SERVICE_UUID);

  // TX Characteristic (ESP32 -> Phone, notify)
  pTxCharacteristic = pService->createCharacteristic(
      CHARACTERISTIC_TX,
      BLECharacteristic::PROPERTY_NOTIFY);
  pTxCharacteristic->addDescriptor(new BLE2902());

  // RX Characteristic (Phone -> ESP32, write)
  BLECharacteristic *pRxCharacteristic = pService->createCharacteristic(
      CHARACTERISTIC_RX,
      BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR);
  pRxCharacteristic->setCallbacks(new RxCallbacks());

  pService->start();

  // Start advertising with explicit configuration
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();

  // Add service UUID to advertisement data
  pAdvertising->addServiceUUID(SERVICE_UUID);

  // Enable scan response to include more data
  pAdvertising->setScanResponse(true);

  // Add service to scan response as well (for better compatibility)
  pAdvertising->addServiceUUID(BLEUUID(SERVICE_UUID));

  // Connection interval preferences for better mobile compatibility
  pAdvertising->setMinPreferred(0x06); // 7.5ms
  pAdvertising->setMaxPreferred(0x12); // 22.5ms

  // Ensure device is connectable and discoverable
  pAdvertising->setAdvertisementType(ADV_TYPE_IND);

  BLEDevice::startAdvertising();

  Serial.print("[BLE] Advertising as: ");
  Serial.println(DEVICE_NAME);
  Serial.println("[BLE] Service UUID: " SERVICE_UUID);
  Serial.println("[BLE] Advertisement type: Connectable & Discoverable");

#if USE_MOCK_DATA
  Serial.println("[MODE] Using MOCK GNSS data");
  randomSeed(analogRead(0));
#else
  Serial.println("[MODE] Reading from L89HA UART");
  setupL89HA();
#endif

  Serial.println("========================================\n");
}

void loop()
{
  // Handle connection state changes
  if (!deviceConnected && oldDeviceConnected)
  {
    delay(500);
    pServer->startAdvertising();
    Serial.println("[BLE] Restarted advertising");
    oldDeviceConnected = deviceConnected;
  }

  if (deviceConnected && !oldDeviceConnected)
  {
    oldDeviceConnected = deviceConnected;
  }

#if USE_MOCK_DATA
  // Send mock NMEA data at regular intervals
  if (deviceConnected && (millis() - lastMockUpdate >= MOCK_UPDATE_INTERVAL))
  {
    lastMockUpdate = millis();
    sendMockNMEABurst();
  }
#else
  // Bidirectional Bridge:
  // 1. Serial Monitor (PC) -> L89HA
  static String pcBuffer = "";
  while (Serial.available())
  {
    char c = Serial.read();
    if (c == '\r' || c == '\n')
    {
      pcBuffer.trim();
      if (pcBuffer.length() > 0)
      {
        if (pcBuffer.startsWith("$"))
        {
          if (pcBuffer.indexOf('*') == -1)
          {
            uint8_t checksum = calculateChecksum(pcBuffer.c_str());
            char csHex[5];
            snprintf(csHex, sizeof(csHex), "*%02X", checksum);
            pcBuffer += csHex;
          }
        }

        // Use the same direct write method as the BLE callback
        L89HA.print(pcBuffer);
        L89HA.print("\r\n");
        L89HA.flush(); // Force wait for bytes to be sent

        Serial.print("\n>>> SENT: ");
        Serial.println(pcBuffer);
        pcBuffer = "";
      }
    }
    else
    {
      pcBuffer += c;
    }
  }

  // 2. L89HA -> Serial Monitor / BLE
  readAndForwardL89HA();
#endif

  delay(1); // Reduced delay for better bridge responsiveness
}
