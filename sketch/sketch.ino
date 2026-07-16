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

#include <tensorflow/lite/micro/micro_mutable_op_resolver.h>
#include <tensorflow/lite/micro/micro_interpreter.h>
#include <tensorflow/lite/schema/schema_generated.h>
#include "nlos_model.h"

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
#define CHARACTERISTIC_TX "6E400003-B5A3-F393-E0A9-E50E24DCCA9E"  // ESP32 -> Phone
#define CHARACTERISTIC_RX "6E400002-B5A3-F393-E0A9-E50E24DCCA9E"  // Phone -> ESP32

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
uint8_t calculateChecksum(const char *sentence) {
  uint8_t checksum = 0;
  if (sentence[0] == '$')
    sentence++;
  while (*sentence && *sentence != '*') {
    checksum ^= *sentence++;
  }
  return checksum;
}

// ============================================================================
// TFLite Micro Objects & Memory
// ============================================================================
namespace {
const tflite::Model *model = nullptr;
tflite::MicroInterpreter *interpreter = nullptr;
TfLiteTensor *input = nullptr;
TfLiteTensor *output = nullptr;
constexpr int kTensorArenaSize = 12 * 1024;  // 12 KB arena
alignas(16) uint8_t tensor_arena[kTensorArenaSize];
tflite::MicroMutableOpResolver<3> resolver;
}

// ============================================================================
// Epoch & NMEA Parsing State
// ============================================================================
struct EpochState {
  char timestamp[16];
  double lat;
  double lon;
  int gps_sats;
  int gal_sats;
  int navic_sats;
  int num_sats_used;
  float hdop;
  float pdop;
  float vdop;
};

EpochState currentEpoch = { "", 0.0, 0.0, 0, 0, 0, 0, 0.0f, 0.0f, 0.0f };
EpochState lastFinishedEpoch = { "", 0.0, 0.0, 0, 0, 0, 0, 0.0f, 0.0f, 0.0f };
bool hasNewEpochData = false;

// Coordinate Wander circular buffer
#define WANDER_WINDOW 30
double lat_buffer[WANDER_WINDOW];
double lon_buffer[WANDER_WINDOW];
int buffer_count = 0;
int buffer_index = 0;

void addCoordinate(double lat, double lon) {
  lat_buffer[buffer_index] = lat;
  lon_buffer[buffer_index] = lon;
  buffer_index = (buffer_index + 1) % WANDER_WINDOW;
  if (buffer_count < WANDER_WINDOW) {
    buffer_count++;
  }
}

float computeCoordinateWander() {
  if (buffer_count < 5) {
    return 0.0f;  // min_periods = 5
  }

  double sum_lat = 0.0, sum_lon = 0.0;
  for (int i = 0; i < buffer_count; i++) {
    sum_lat += lat_buffer[i];
    sum_lon += lon_buffer[i];
  }
  double mean_lat = sum_lat / buffer_count;
  double mean_lon = sum_lon / buffer_count;

  double lat_rad = mean_lat * PI / 180.0;
  double m_lat = 111133.0 - 560.0 * cos(2.0 * lat_rad);
  double m_lon = 111413.0 * cos(lat_rad);

  double sq_sum_lat = 0.0, sq_sum_lon = 0.0;
  for (int i = 0; i < buffer_count; i++) {
    double diff_lat = lat_buffer[i] - mean_lat;
    double diff_lon = lon_buffer[i] - mean_lon;
    sq_sum_lat += diff_lat * diff_lat;
    sq_sum_lon += diff_lon * diff_lon;
  }

  double std_lat = sqrt(sq_sum_lat / (buffer_count - 1)) * m_lat;
  double std_lon = sqrt(sq_sum_lon / (buffer_count - 1)) * m_lon;

  return (float)sqrt(std_lat * std_lat + std_lon * std_lon);
}

// Helper to extract a field from comma-separated sentence (ignores leading '$')
bool getField(const char *sentence, int fieldIndex, char *output_buf, int maxLen) {
  int curField = 0;
  int i = 0;
  if (sentence[0] == '$') i = 1;

  while (sentence[i] && sentence[i] != '*') {
    if (curField == fieldIndex) {
      int len = 0;
      while (sentence[i] && sentence[i] != ',' && sentence[i] != '*' && len < maxLen - 1) {
        output_buf[len++] = sentence[i++];
      }
      output_buf[len] = '\0';
      return true;
    }
    if (sentence[i] == ',') {
      curField++;
    }
    i++;
  }
  output_buf[0] = '\0';
  return false;
}

double parseDecimalDegrees(const char *valStr, const char *dirStr) {
  if (strlen(valStr) == 0) return 0.0;
  double raw = atof(valStr);
  int deg = (int)(raw / 100.0);
  double min = raw - (deg * 100.0);
  double decimal = deg + (min / 60.0);
  if (dirStr && (dirStr[0] == 'S' || dirStr[0] == 'W')) {
    decimal = -decimal;
  }
  return decimal;
}

void parseNMEALine(const char *sentence) {
  char msg[16];
  if (!getField(sentence, 0, msg, sizeof(msg))) return;

  if (strcmp(msg, "GNGGA") == 0 || strcmp(msg, "GPGGA") == 0) {
    char t[16];
    getField(sentence, 1, t, sizeof(t));

    if (strlen(t) > 0 && strcmp(t, currentEpoch.timestamp) != 0) {
      // Flush previous epoch if it was populated
      if (strlen(currentEpoch.timestamp) > 0 && currentEpoch.lat != 0.0) {
        lastFinishedEpoch = currentEpoch;
        hasNewEpochData = true;
      }
      // Reset for new epoch
      memset(&currentEpoch, 0, sizeof(currentEpoch));
      strncpy(currentEpoch.timestamp, t, sizeof(currentEpoch.timestamp) - 1);
    }

    char latVal[16], latDir[4];
    char lonVal[16], lonDir[4];
    char numSatsVal[8];
    char hdopVal[12];

    getField(sentence, 2, latVal, sizeof(latVal));
    getField(sentence, 3, latDir, sizeof(latDir));
    getField(sentence, 4, lonVal, sizeof(lonVal));
    getField(sentence, 5, lonDir, sizeof(lonDir));
    getField(sentence, 7, numSatsVal, sizeof(numSatsVal));
    getField(sentence, 8, hdopVal, sizeof(hdopVal));

    currentEpoch.lat = parseDecimalDegrees(latVal, latDir);
    currentEpoch.lon = parseDecimalDegrees(lonVal, lonDir);
    currentEpoch.num_sats_used = atoi(numSatsVal);
    currentEpoch.hdop = (strlen(hdopVal) > 0) ? atof(hdopVal) : 0.0f;
  } else if ((strcmp(msg, "GNGSA") == 0 || strcmp(msg, "GPGSA") == 0) && strlen(currentEpoch.timestamp) > 0) {
    int numCommas = 0;
    for (int i = 0; sentence[i] && sentence[i] != '*'; i++) {
      if (sentence[i] == ',') numCommas++;
    }

    char sysIdVal[8] = "";
    getField(sentence, numCommas, sysIdVal, sizeof(sysIdVal));
    int sys_id = atoi(sysIdVal);

    int sats = 0;
    for (int slot = 3; slot <= 14; slot++) {
      char prn[8];
      getField(sentence, slot, prn, sizeof(prn));
      if (strlen(prn) > 0) {
        sats++;
      }
    }

    if (sys_id == 1) {
      currentEpoch.gps_sats = sats;
    } else if (sys_id == 3) {
      currentEpoch.gal_sats = sats;
    } else if (sys_id == 6) {
      currentEpoch.navic_sats = sats;
    }

    char pdopVal[12], hdopVal[12], vdopVal[12];
    if (getField(sentence, 15, pdopVal, sizeof(pdopVal)) && strlen(pdopVal) > 0) {
      currentEpoch.pdop = atof(pdopVal);
    }
    if (getField(sentence, 16, hdopVal, sizeof(hdopVal)) && strlen(hdopVal) > 0) {
      currentEpoch.hdop = atof(hdopVal);
    }
    if (getField(sentence, 17, vdopVal, sizeof(vdopVal)) && strlen(vdopVal) > 0) {
      currentEpoch.vdop = atof(vdopVal);
    }
  }
}

#include "mock_data.h"

// ============================================================================
// L89HA UART Objects & Functions (Forward Declarations)
// ============================================================================
#if !USE_MOCK_DATA
HardwareSerial L89HA(2);  // Switch back to UART2
#endif

// Forward declaration of setupL89HA
void setupL89HA();

// ============================================================================
// BLE Callbacks
// ============================================================================

class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *pServer) override {
    deviceConnected = true;
    Serial.println("[BLE] Device connected");
  }

  void onDisconnect(BLEServer *pServer) override {
    deviceConnected = false;
    Serial.println("[BLE] Device disconnected");
  }
};

class RxCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pCharacteristic) override {
    String rxValue = pCharacteristic->getValue();
    static String bleBuffer = "";  // Persistent buffer for reassembly

    if (rxValue.length() > 0) {
      bleBuffer += rxValue;

      // Process if we have a full NMEA-style command (ends with \n or \r)
      if (bleBuffer.indexOf('\n') != -1 || bleBuffer.indexOf('\r') != -1) {
        bleBuffer.trim();
        if (bleBuffer.length() > 0) {
          Serial.print("[BLE] Received: ");
          Serial.println(bleBuffer.c_str());

          // Special handling for manual baud sync requests from app
#if !USE_MOCK_DATA
          if (bleBuffer.startsWith("SET_BAUD_115200")) {
            Serial.println("[BLE] Force sync to 115200 requested");
            setupL89HA();
          } else if (bleBuffer.startsWith("SET_BAUD_9600")) {
            Serial.println("[BLE] Force revert to 9600 requested");
            L89HA.begin(115200, SERIAL_8N1, L89HA_RX_PIN, L89HA_TX_PIN);
            L89HA.println("$PAIR864,0,0,9600*1E");
            delay(200);
            L89HA.begin(9600, SERIAL_8N1, L89HA_RX_PIN, L89HA_TX_PIN);
            Serial.println("[L89HA] Reverted to 9600");
          } else {
            L89HA.println(bleBuffer.c_str());
            Serial.print("[BLE->L89HA] Forwarded: ");
            Serial.println(bleBuffer.c_str());
          }
#else
          Serial.println("[BLE] Mock mode: Command ignored.");
#endif
        }
        bleBuffer = "";  // Clear for next command
      }
    }
  }
};

/**
 * Send NMEA sentence with checksum via BLE (Real hardware only)
 */
void sendNMEA(const char *sentence) {
  // Intercept and parse sent sentence
  parseNMEALine(sentence);

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

void setupL89HA() {
  uint32_t bauds[] = { 115200, 9600 };
  bool detected = false;

  for (uint32_t b : bauds) {
    Serial.printf("[L89HA] Testing baud %d...\n", b);
    L89HA.begin(b, SERIAL_8N1, L89HA_RX_PIN, L89HA_TX_PIN);

    // Listen for NMEA start character ($) with longer timeout
    unsigned long start = millis();
    while (millis() - start < 2500) {  // Increased to 2.5s
      if (L89HA.available() && L89HA.read() == '$') {
        detected = true;
        break;
      }
      delay(5);
    }

    if (detected) {
      Serial.printf("[L89HA] Detected module at %d baud\n", b);
      if (b != L89HA_BAUD) {
        Serial.printf("[L89HA] Syncing to %d baud...\n", L89HA_BAUD);

        // Flush any pending data before sending sync command
        while (L89HA.available())
          L89HA.read();

        // PAIR864 command to set baud rate
        char baudCmd[64];
        snprintf(baudCmd, sizeof(baudCmd), "$PAIR864,0,0,%d", L89HA_BAUD);
        uint8_t cs = calculateChecksum(baudCmd);

        // Send multiple times for reliability
        for (int i = 0; i < 3; i++) {
          L89HA.printf("%s*%02X\r\n", baudCmd, cs);
          delay(50);
        }

        delay(1000);  // Wait 1s for hardware reconfiguration
        L89HA.begin(L89HA_BAUD, SERIAL_8N1, L89HA_RX_PIN, L89HA_TX_PIN);
      }
      break;
    }
    L89HA.end();
  }

  if (!detected) {
    Serial.printf("[L89HA] Module not responding. Defaulting to %d for commands.\n", L89HA_BAUD);
    L89HA.begin(L89HA_BAUD, SERIAL_8N1, L89HA_RX_PIN, L89HA_TX_PIN);
  } else {
    Serial.printf("[L89HA] READY at %d\n", L89HA_BAUD);
  }
}

void readAndForwardL89HA() {
  while (L89HA.available()) {
    char c = L89HA.read();

    // 1. Raw Bridge: Echo everything to Serial Monitor immediately
    Serial.write(c);

    // 2. BLE logic: Buffer full sentences for transmission
    if (c == '\n') {
      // Complete sentence received
      nmeaBuffer.trim();
      if (nmeaBuffer.startsWith("$")) {
        parseNMEALine(nmeaBuffer.c_str());
        if (deviceConnected) {
          // Forward to BLE
          String toSend = nmeaBuffer + "\r\n";
          pTxCharacteristic->setValue((uint8_t *)toSend.c_str(), toSend.length());
          pTxCharacteristic->notify();
        }
      }
      nmeaBuffer = "";
    } else if (c != '\r') {
      nmeaBuffer += c;
      // Prevent buffer overflow
      if (nmeaBuffer.length() > 256) {
        nmeaBuffer = "";
      }
    }
  }
}
#endif

// ============================================================================
// TinyML Inference Execution
// ============================================================================
void runModelInference() {
  if (!hasNewEpochData)
    return;
  hasNewEpochData = false;

  // Add coordinates to wander buffer
  if (lastFinishedEpoch.lat != 0.0 && lastFinishedEpoch.lon != 0.0) {
    addCoordinate(lastFinishedEpoch.lat, lastFinishedEpoch.lon);
  }

  // Compute coordinate wander
  float wander = computeCoordinateWander();

  // Assemble raw features
  float raw_features[NLOS_MODEL_NUM_FEATURES] = {
    (float)lastFinishedEpoch.gps_sats,
    (float)lastFinishedEpoch.gal_sats,
    (float)lastFinishedEpoch.navic_sats,
    (float)lastFinishedEpoch.num_sats_used,
    (float)lastFinishedEpoch.hdop,
    (float)lastFinishedEpoch.pdop,
    (float)lastFinishedEpoch.vdop,
    wander
  };

  // Standardize features
  float scaled_features[NLOS_MODEL_NUM_FEATURES];
  for (int i = 0; i < NLOS_MODEL_NUM_FEATURES; ++i) {
    scaled_features[i] = (raw_features[i] - nlos_scaler_mean[i]) / nlos_scaler_std[i];
  }

  // Copy to input tensor
  if (input != nullptr) {
    for (int i = 0; i < NLOS_MODEL_NUM_FEATURES; ++i) {
      input->data.f[i] = scaled_features[i];
    }
  }

  // Invoke interpreter
  if (interpreter != nullptr) {
    TfLiteStatus invoke_status = interpreter->Invoke();
    if (invoke_status == kTfLiteOk && output != nullptr) {
      float prediction = output->data.f[0];
      bool is_nlos = (prediction >= 0.5f);

      Serial.printf("[TFLite] Prediction: %.4f | Result: %s\n", prediction, is_nlos ? "NLOS (1)" : "LOS (0)");
      Serial.printf("[TFLite] Features: GPS=%d, GAL=%d, NAV=%d, USED=%d, HDOP=%.2f, PDOP=%.2f, VDOP=%.2f, WANDER=%.2f\n",
                    lastFinishedEpoch.gps_sats, lastFinishedEpoch.gal_sats, lastFinishedEpoch.navic_sats,
                    lastFinishedEpoch.num_sats_used, lastFinishedEpoch.hdop, lastFinishedEpoch.pdop,
                    lastFinishedEpoch.vdop, wander);

      // Send output via BLE to phone (NUS TX)
      if (deviceConnected) {
        char bleBuffer[64];
        snprintf(bleBuffer, sizeof(bleBuffer), "PMPATH,%d,%.3f", is_nlos ? 1 : 0, prediction);

        // NMEA-style checksum calculation
        uint8_t cs = 0;
        for (int i = 0; bleBuffer[i]; i++) {
          cs ^= bleBuffer[i];
        }

        char finalBuffer[96];
        snprintf(finalBuffer, sizeof(finalBuffer), "$%s*%02X\r\n", bleBuffer, cs);

        pTxCharacteristic->setValue((uint8_t *)finalBuffer, strlen(finalBuffer));
        pTxCharacteristic->notify();
        Serial.printf("[BLE->Phone] Sent: %s", finalBuffer);
      }
    } else {
      Serial.println("[TFLite] Invoke failed or output tensor null!");
    }
  }
}

// ============================================================================
// Setup & Loop
// ============================================================================

void setup() {
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
  pAdvertising->setMinPreferred(0x06);  // 7.5ms
  pAdvertising->setMaxPreferred(0x12);  // 22.5ms

  // Ensure device is connectable and discoverable
  pAdvertising->setAdvertisementType(ADV_TYPE_IND);

  BLEDevice::startAdvertising();

  Serial.print("[BLE] Advertising as: ");
  Serial.println(DEVICE_NAME);
  Serial.println("[BLE] Service UUID: " SERVICE_UUID);
  Serial.println("[BLE] Advertisement type: Connectable & Discoverable");

  // ============================================================================
  // Initialize TFLite Micro Model
  // ============================================================================
  Serial.println("[TFLite] Loading model...");
  model = tflite::GetModel(nlos_model_tflite);
  if (model->version() != TFLITE_SCHEMA_VERSION) {
    Serial.printf("[TFLite] Model version mismatch! Expected %d, got %d\n",
                  TFLITE_SCHEMA_VERSION, model->version());
  } else {
    resolver.AddFullyConnected();
    resolver.AddRelu();
    resolver.AddLogistic();

    static tflite::MicroInterpreter static_interpreter(
      model, resolver, tensor_arena, kTensorArenaSize);
    interpreter = &static_interpreter;

    TfLiteStatus allocate_status = interpreter->AllocateTensors();
    if (allocate_status != kTfLiteOk) {
      Serial.println("[TFLite] Failed to allocate tensors!");
    } else {
      input = interpreter->input(0);
      output = interpreter->output(0);
      Serial.println("[TFLite] Model successfully loaded & initialized.");
    }
  }

#if USE_MOCK_DATA
  Serial.println("[MODE] Using MOCK GNSS data");
  randomSeed(analogRead(0));
#else
  Serial.println("[MODE] Reading from L89HA UART");
  setupL89HA();
#endif

  Serial.println("========================================\n");
}

void loop() {
  // Handle connection state changes
  if (!deviceConnected && oldDeviceConnected) {
    delay(500);
    pServer->startAdvertising();
    Serial.println("[BLE] Restarted advertising");
    oldDeviceConnected = deviceConnected;
  }

  if (deviceConnected && !oldDeviceConnected) {
    oldDeviceConnected = deviceConnected;
  }

#if USE_MOCK_DATA
  // Send mock NMEA data at regular intervals
  if (deviceConnected && (millis() - lastMockUpdate >= MOCK_UPDATE_INTERVAL)) {
    lastMockUpdate = millis();
    sendMockNMEABurst();
  }
#else
  // Bidirectional Bridge:
  // 1. Serial Monitor (PC) -> L89HA
  static String pcBuffer = "";
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\r' || c == '\n') {
      pcBuffer.trim();
      if (pcBuffer.length() > 0) {
        if (pcBuffer.startsWith("$")) {
          if (pcBuffer.indexOf('*') == -1) {
            uint8_t checksum = calculateChecksum(pcBuffer.c_str());
            char csHex[5];
            snprintf(csHex, sizeof(csHex), "*%02X", checksum);
            pcBuffer += csHex;
          }
        }

        // Use the same direct write method as the BLE callback
        L89HA.print(pcBuffer);
        L89HA.print("\r\n");
        L89HA.flush();  // Force wait for bytes to be sent

        Serial.print("\n>>> SENT: ");
        Serial.println(pcBuffer);
        pcBuffer = "";
      }
    } else {
      pcBuffer += c;
    }
  }

  // 2. L89HA -> Serial Monitor / BLE
  readAndForwardL89HA();
#endif

  // Run ML inference if a new epoch has been compiled
  runModelInference();

  delay(1);  // Reduced delay for better bridge responsiveness
}
