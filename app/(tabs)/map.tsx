import LeafletMap from "@/components/leaflet-map";
import { PressableScale } from "@/components/pressable-scale";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useGnssStore } from "@/store/gnss-store";
import {
  IconCompass,
  IconCurrentLocation,
  IconInfoCircle,
  IconMapNorth,
  IconStack,
} from "@tabler/icons-react-native";
import React, { useEffect, useState } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const DEFAULT_LATITUDE = 0;
const DEFAULT_LONGITUDE = 0;

export default function MapScreen() {
  const { colors } = useAppTheme();
  const { fix, velocity, isLogging, losFix } = useGnssStore();

  const heading = velocity.courseTrue;
  const hasFix = fix.latitude !== null && fix.longitude !== null;

  const [mapType, setMapType] = useState<"standard" | "satellite">("standard");
  const [trail, setTrail] = useState<{ latitude: number; longitude: number }[]>(
    [],
  );
  const [recenterCount, setRecenterCount] = useState(0);
  const [followHeading, setFollowHeading] = useState(false);
  const [showLegend, setShowLegend] = useState(false);

  const mapRotation = followHeading && heading !== null ? heading : 0;

  useEffect(() => {
    if (
      isLogging &&
      hasFix &&
      fix.latitude !== null &&
      fix.longitude !== null
    ) {
      const newPoint = { latitude: fix.latitude, longitude: fix.longitude };
      setTrail((prev) => {
        if (prev.length > 0) {
          const last = prev[prev.length - 1];
          if (
            Math.abs(last.latitude - newPoint.latitude) < 0.000001 &&
            Math.abs(last.longitude - newPoint.longitude) < 0.000001
          ) {
            return prev;
          }
        }
        return [...prev, newPoint];
      });
    } else if (!isLogging) {
      setTrail([]);
    }
  }, [isLogging, hasFix, fix.latitude, fix.longitude]);

  const handleRecenter = () => {
    setRecenterCount((prev) => prev + 1);
  };

  const handleToggleMapType = () => {
    setMapType((prev) => (prev === "standard" ? "satellite" : "standard"));
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.mapContainer}>
        <LeafletMap
          latitude={fix.latitude ?? DEFAULT_LATITUDE}
          longitude={fix.longitude ?? DEFAULT_LONGITUDE}
          losLatitude={losFix?.latitude ?? null}
          losLongitude={losFix?.longitude ?? null}
          trail={trail}
          mapType={mapType}
          recenterCount={recenterCount}
          tintColor={colors.tint}
          backgroundColor={colors.background}
          heading={heading}
          mapRotation={mapRotation}
          dom={{
            scrollEnabled: false,
            contentInsetAdjustmentBehavior: "never",
            style: styles.map,
          }}
        />

        {/* Top Left Controls: Legend / Info */}
        <View style={styles.topLeftControls}>
          <PressableScale
            onPress={() => setShowLegend(true)}
            style={[
              styles.floatingBtn,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <IconInfoCircle size={22} color={colors.text} />
          </PressableScale>
        </View>

        {/* Top Right Controls: Heading / Compass */}
        <View style={styles.topRightControls}>
          <PressableScale
            onPress={() => {
              if (heading !== null) {
                setFollowHeading((prev) => !prev);
              }
            }}
            style={[
              styles.floatingBtn,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                opacity: heading === null ? 0.5 : 1,
              },
            ]}
          >
            {followHeading && heading !== null ? (
              <IconCompass size={22} color={colors.text} />
            ) : (
              <IconMapNorth size={22} color="#FF3B30" />
            )}
          </PressableScale>
        </View>

        {/* Bottom Right Controls: Recenter & Layer Stack */}
        <View style={styles.floatingControls}>
          <PressableScale
            onPress={handleRecenter}
            style={[
              styles.floatingBtn,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <IconCurrentLocation size={22} color={colors.text} />
          </PressableScale>

          <PressableScale
            onPress={handleToggleMapType}
            style={[
              styles.floatingBtn,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <IconStack size={22} color={colors.text} />
          </PressableScale>
        </View>

        {/* Legend Modal Popup matching ConfirmModal styling */}
        <Modal
          visible={showLegend}
          transparent
          animationType="none"
          onRequestClose={() => setShowLegend(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowLegend(false)}
          >
            <TouchableOpacity
              activeOpacity={1}
              style={[
                styles.modalBox,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Map Markers Legend
              </Text>

              <View style={styles.legendContent}>
                <View style={styles.legendRow}>
                  <View
                    style={[styles.colorDot, { backgroundColor: "#FF3B30" }]}
                  />
                  <Text
                    style={[
                      styles.legendDescription,
                      { color: colors.textSecondary, flex: 1 },
                    ]}
                  >
                    Raw GNSS Fix position.
                  </Text>
                </View>

                <View style={styles.legendRow}>
                  <View
                    style={[styles.colorDot, { backgroundColor: "#34C759" }]}
                  />
                  <Text
                    style={[
                      styles.legendDescription,
                      { color: colors.textSecondary, flex: 1 },
                    ]}
                  >
                    Line-of-Sight (LOS) filtered position free from multipath.
                  </Text>
                </View>
              </View>

              <View style={styles.buttonRow}>
                <PressableScale
                  hitSlop={12}
                  onPress={() => setShowLegend(false)}
                  style={[
                    styles.doneButton,
                    {
                      backgroundColor: colors.statusSurface,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: colors.statusActive,
                      fontSize: 15,
                      fontFamily: "YsabeauInfant_700Bold",
                    }}
                  >
                    Done
                  </Text>
                </PressableScale>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapContainer: {
    flex: 1,
    position: "relative",
    overflow: "hidden",
  } as any,
  map: {
    width: "100%",
    height: "100%",
  },
  topLeftControls: {
    position: "absolute",
    top: 12,
    left: 12,
  },
  topRightControls: {
    position: "absolute",
    top: 12,
    right: 12,
  },
  floatingControls: {
    position: "absolute",
    bottom: 12,
    right: 12,
    gap: 8,
  },

  floatingBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderCurve: "continuous",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  } as any,

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 28,
  },
  modalBox: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 24,
    borderCurve: "continuous",
    borderWidth: 1,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontFamily: "YsabeauInfant_800ExtraBold",
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  legendContent: {
    gap: 14,
    marginBottom: 24,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
  },
  legendDescription: {
    fontSize: 15,
    fontFamily: "YsabeauInfant_400Regular",
    lineHeight: 22,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  doneButton: {
    height: 44,
    minWidth: 90,
    borderRadius: 14,
    borderCurve: "continuous",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
});
