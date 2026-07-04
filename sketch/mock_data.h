#ifndef MOCK_DATA_H
#define MOCK_DATA_H

#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEServer.h>

// Forward declarations from main sketch
extern bool deviceConnected;
extern BLECharacteristic *pTxCharacteristic;
extern uint8_t calculateChecksum(const char *sentence);
extern void sendNMEA(const char *sentence);

// ============================================================================
// Mock GNSS Data State
// ============================================================================

// Base coordinates (example: San Francisco)
static float mockLat = 37.7749;
static float mockLon = -122.4194;
static float mockAlt = 15.5;
static float mockSpeed = 0.0;
static float mockCourse = 45.0;
static int mockSatsUsed = 12;
static int mockFixQuality = 1; // 1 = GPS fix
static bool mockHasFix = true;
static int mockUpdateCount = 0;

// Satellite info for GSV (simulated constellation)
struct SatInfo
{
  int prn;
  int elevation;
  int azimuth;
  int snr;
  const char *talkerId;
};

static SatInfo mockSatellites[] = {
    {3, 45, 120, 42, "GP"},
    {6, 67, 230, 38, "GP"},
    {9, 23, 45, 35, "GP"},
    {12, 78, 310, 44, "GP"},
    {17, 34, 180, 40, "GP"},
    {19, 56, 90, 41, "GP"},
    {65, 40, 150, 36, "GL"},
    {66, 55, 270, 39, "GL"},
    {67, 30, 60, 33, "GL"},
    {1, 50, 200, 40, "GA"},
    {2, 62, 320, 43, "GA"},
    {3, 28, 100, 37, "GA"},
    {11, 48, 140, 38, "GB"},
    {14, 35, 250, 35, "GB"},
    {1, 60, 180, 41, "GI"},
    {2, 42, 220, 39, "GI"},
    {193, 70, 100, 45, "GQ"},
    {194, 55, 140, 42, "GQ"},
};
static const int NUM_SATELLITES = sizeof(mockSatellites) / sizeof(mockSatellites[0]);
static unsigned long lastMockUpdate = 0;

// ============================================================================
// NMEA Helper Functions (Mock specific)
// ============================================================================

static void decimalToNMEA(float decimal, char *buffer, int isLon)
{
  float absVal = abs(decimal);
  int degrees = (int)absVal;
  float minutes = (absVal - degrees) * 60.0;
  if (isLon)
  {
    snprintf(buffer, 16, "%03d%07.4f", degrees, minutes);
  }
  else
  {
    snprintf(buffer, 16, "%02d%07.4f", degrees, minutes);
  }
}

// ============================================================================
// Mock NMEA Sentence Generators
// ============================================================================

static void generateGGA()
{
  char sentence[128];
  unsigned long ms = millis();
  int hours = (ms / 3600000) % 24;
  int mins = (ms / 60000) % 60;
  int secs = (ms / 1000) % 60;
  if (mockHasFix)
  {
    char latStr[16], lonStr[16];
    decimalToNMEA(mockLat, latStr, 0);
    decimalToNMEA(mockLon, lonStr, 1);
    snprintf(sentence, sizeof(sentence),
             "$GNGGA,%02d%02d%02d.00,%s,%c,%s,%c,%d,%02d,0.9,%.1f,M,0.0,M,,",
             hours, mins, secs, latStr, mockLat >= 0 ? 'N' : 'S',
             lonStr, mockLon >= 0 ? 'E' : 'W', mockFixQuality, mockSatsUsed, mockAlt);
  }
  else
  {
    snprintf(sentence, sizeof(sentence),
             "$GNGGA,%02d%02d%02d.00,,,,,0,00,99.9,,,,,,",
             hours, mins, secs);
  }
  sendNMEA(sentence);
}

static void generateRMC()
{
  char sentence[128];
  unsigned long ms = millis();
  int hours = (ms / 3600000) % 24;
  int mins = (ms / 60000) % 60;
  int secs = (ms / 1000) % 60;
  if (mockHasFix)
  {
    char latStr[16], lonStr[16];
    decimalToNMEA(mockLat, latStr, 0);
    decimalToNMEA(mockLon, lonStr, 1);
    snprintf(sentence, sizeof(sentence),
             "$GNRMC,%02d%02d%02d.00,A,%s,%c,%s,%c,%.1f,%.1f,020426,,,A",
             hours, mins, secs, latStr, mockLat >= 0 ? 'N' : 'S',
             lonStr, mockLon >= 0 ? 'E' : 'W', mockSpeed, mockCourse);
  }
  else
  {
    snprintf(sentence, sizeof(sentence),
             "$GNRMC,%02d%02d%02d.00,V,,,,,%.1f,%.1f,020426,,,N",
             hours, mins, secs, mockSpeed, mockCourse);
  }
  sendNMEA(sentence);
}

static void generateVTG()
{
  char sentence[128];
  float speedKmh = mockSpeed * 1.852;
  if (mockHasFix)
  {
    snprintf(sentence, sizeof(sentence), "$GNVTG,%.1f,T,,M,%.1f,N,%.1f,K,A", mockCourse, mockSpeed, speedKmh);
  }
  else
  {
    snprintf(sentence, sizeof(sentence), "$GNVTG,,T,,M,,N,,K,N");
  }
  sendNMEA(sentence);
}

static void generateGSA(const char *talkerId)
{
  char sentence[128];
  char prns[64] = "";
  int prnCount = 0;
  if (mockHasFix)
  {
    for (int i = 0; i < NUM_SATELLITES && prnCount < 12; i++)
    {
      if (strcmp(mockSatellites[i].talkerId, talkerId) == 0)
      {
        // Only include in the active fix solution if SNR is >= 38
        if (mockSatellites[i].snr >= 38)
        {
          char prn[8];
          snprintf(prn, sizeof(prn), "%02d,", mockSatellites[i].prn);
          strcat(prns, prn);
          prnCount++;
        }
      }
    }
  }
  for (int i = prnCount; i < 12; i++)
    strcat(prns, ",");
  if (mockHasFix)
  {
    snprintf(sentence, sizeof(sentence), "$%sGSA,A,3,%s1.5,0.9,1.2,1", talkerId, prns);
  }
  else
  {
    snprintf(sentence, sizeof(sentence), "$%sGSA,A,1,%s99.0,99.0,99.0,1", talkerId, prns);
  }
  sendNMEA(sentence);
}

static void generateGSV(const char *talkerId)
{
  int satCount = 0;
  int satIndices[12];
  for (int i = 0; i < NUM_SATELLITES && satCount < 12; i++)
  {
    if (strcmp(mockSatellites[i].talkerId, talkerId) == 0)
      satIndices[satCount++] = i;
  }
  if (satCount == 0)
    return;
  int numMessages = (satCount + 3) / 4;
  int satIdx = 0;
  for (int msg = 1; msg <= numMessages; msg++)
  {
    char sentence[128];
    char satData[80] = "";
    for (int s = 0; s < 4 && satIdx < satCount; s++, satIdx++)
    {
      SatInfo &sat = mockSatellites[satIndices[satIdx]];
      char satStr[24];
      snprintf(satStr, sizeof(satStr), ",%02d,%02d,%03d,%02d", sat.prn, sat.elevation, sat.azimuth, sat.snr);
      strcat(satData, satStr);
    }
    snprintf(sentence, sizeof(sentence), "$%sGSV,%d,%d,%02d%s", talkerId, numMessages, msg, satCount, satData);
    sendNMEA(sentence);
  }
}

static void generateGLL()
{
  char sentence[128];
  unsigned long ms = millis();
  int hours = (ms / 3600000) % 24;
  int mins = (ms / 60000) % 60;
  int secs = (ms / 1000) % 60;
  if (mockHasFix)
  {
    char latStr[16], lonStr[16];
    decimalToNMEA(mockLat, latStr, 0);
    decimalToNMEA(mockLon, lonStr, 1);
    snprintf(sentence, sizeof(sentence), "$GNGLL,%s,%c,%s,%c,%02d%02d%02d.00,A,A",
             latStr, mockLat >= 0 ? 'N' : 'S', lonStr, mockLon >= 0 ? 'E' : 'W', hours, mins, secs);
  }
  else
  {
    snprintf(sentence, sizeof(sentence), "$GNGLL,,,,,%02d%02d%02d.00,V,N",
             hours, mins, secs);
  }
  sendNMEA(sentence);
}

// ============================================================================
// Mock System Update Loop
// ============================================================================

void updateMockData()
{
  mockUpdateCount++;

  // Oscillate fix status: 20 seconds in-fix, 10 seconds out-of-fix
  mockHasFix = (mockUpdateCount % 30) < 20;
  mockFixQuality = mockHasFix ? 1 : 0;

  static bool lastFixState = true;
  if (mockHasFix != lastFixState)
  {
    lastFixState = mockHasFix;
    Serial.printf("[MOCK] Fix status changed to: %s\n", mockHasFix ? "FIXED (3D)" : "NO FIX");
  }

  mockLat += (random(-100, 100) / 1000000.0);
  mockLon += (random(-100, 100) / 1000000.0);
  mockAlt += (random(-10, 10) / 10.0);
  if (mockAlt < 0)
    mockAlt = 0;

  int satsUsedCount = 0;
  for (int i = 0; i < NUM_SATELLITES; i++)
  {
    mockSatellites[i].snr += random(-2, 3);
    if (mockSatellites[i].snr < 20)
      mockSatellites[i].snr = 20;
    if (mockSatellites[i].snr > 50)
      mockSatellites[i].snr = 50;

    // A satellite is used in the fix if its SNR is >= 38
    if (mockSatellites[i].snr >= 38)
    {
      satsUsedCount++;
    }
  }
  mockSatsUsed = mockHasFix ? satsUsedCount : 0;
}

void sendMockNMEABurst()
{
  updateMockData();
  generateGGA();
  delay(30);
  generateRMC();
  delay(30);
  generateVTG();
  delay(30);
  generateGLL();
  delay(30);
  generateGSA("GP");
  generateGSA("GL");
  generateGSA("GA");
  generateGSA("GB");
  generateGSA("GI");
  generateGSA("GQ");
  generateGSV("GP");
  generateGSV("GL");
  generateGSV("GA");
  generateGSV("GB");
  generateGSV("GI");
  generateGSV("GQ");
}

#endif // MOCK_DATA_H
