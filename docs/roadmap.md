# GNSS-Logger: Future Roadmap

This document outlines potential features and architectural enhancements for the GNSS-Logger project based on its current core capabilities.

## 1. Mapping & Spatial Visualization

GNSS data is inherently spatial, and visualizing it in real-time adds significant value for field use.

- **Real-time Map View**: Integrate `react-native-maps` to show the current position and a "breadcrumb" trail of the active logging session.
- **Offline Map Support**: Allow users to download map tiles for offline use (crucial for remote fieldwork).
- **Static Map Snapshots**: Display a thumbnail map preview for each session in the `Logs` tab.

## 2. Advanced Data Management & Export

Standardize data exchange with external GIS and fitness ecosystems.

- **GPX / KML Support**: Add standard XML-based exports for Google Earth, Strava, and QGIS.
- **Batch Export**: Selection tool for multiple sessions to export as a single ZIP file.
- **Cloud Backup**: Automatic or manual sync to Google Drive, Dropbox, or a custom S3 bucket.

## 3. Real-time GNSS Analysis

Leverage the NMEA data stream for deeper diagnostic insights.

- **SNR Heatmap**: A rolling signal-to-noise ratio visualization to identify sky-view obstructions.
- **Accuracy CEP**: Display the 50%/95% Circular Error Probability based on HDOP/VDOP metrics.
- **Live NMEA Terminal**: A developer tool window to view the raw sentences coming from the ESP32.

## 4. Hardware Control (Bidirectional)

Move beyond a passive listener to an active controller for the ESP32/GNSS hardware.

- **Sampling Rate Configuration**: Change the hardware update frequency (e.g., 1Hz to 10Hz) via BLE commands.
- **Constellation Toggles**: Enable/disable specific GNSS systems (GPS, GLONASS, Galileo, BeiDou) from the app.
- **Sleep/Wake Commands**: Put the external hardware into low-power states remotely to conserve battery.

## 5. Automation & Backgrounding

- **Smart Triggering**: Auto-start logs based on speed threshold (e.g., > 10km/h) or geofence entry.
- **Background Logging**: Ensure data capture continues reliably when the app is in the background or the screen is off using Expo `TaskManager`.
- **Persistent Status**: A low-level system notification during active logs with a "Stop" action button.

## 6. UX & Documentation

- **Session Media**: Attach field photos or voice notes to a specific logging session.
- **Marked Points**: A "POI" button to manually highlight specific coordinates within a continuous log.
- **Custom Metadata**: Project/Client names and site description fields for logs.
