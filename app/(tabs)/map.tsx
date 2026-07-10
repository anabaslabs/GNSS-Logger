import LeafletMap from "@/components/leaflet-map";
import { PressableScale } from "@/components/pressable-scale";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useGnssStore } from "@/store/gnss-store";
import {
  IconCurrentLocation,
  IconStack,
  IconCompass,
  IconMapNorth,
} from "@tabler/icons-react-native";
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

const DEFAULT_LATITUDE = 0;
const DEFAULT_LONGITUDE = 0;

export default function MapScreen() {
  const { colors } = useAppTheme();
  const { fix, velocity, isLogging } = useGnssStore();

  const heading = velocity.courseTrue;
  const hasFix = fix.latitude !== null && fix.longitude !== null;

  const [mapType, setMapType] = useState<"standard" | "satellite">("standard");
  const [trail, setTrail] = useState<{ latitude: number; longitude: number }[]>(
    [],
  );
  const [recenterCount, setRecenterCount] = useState(0);
  const [followHeading, setFollowHeading] = useState(false);

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
            <View
              style={{
                width: 22,
                height: 22,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {followHeading && heading !== null ? (
                <IconCompass size={22} color={colors.text} />
              ) : (
                <IconMapNorth size={22} color="#FF3B30" />
              )}
            </View>
          </PressableScale>
        </View>

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
  floatingControls: {
    position: "absolute",
    bottom: 12,
    right: 12,
    gap: 8,
  },
  topRightControls: {
    position: "absolute",
    top: 12,
    right: 12,
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
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  } as any,
});
