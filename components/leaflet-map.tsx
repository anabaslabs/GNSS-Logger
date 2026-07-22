"use dom";

import { IconMapPinFilled } from "@tabler/icons-react-native";
import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

interface LeafletMapProps {
  latitude: number;
  longitude: number;
  losLatitude: number | null;
  losLongitude: number | null;
  trail: { latitude: number; longitude: number }[];
  mapType: "standard" | "satellite";
  recenterCount: number;
  tintColor: string;
  backgroundColor: string;
  dom?: import("expo/dom").DOMProps;
  heading: number | null;
  mapRotation: number;
}

export default function LeafletMap({
  latitude,
  longitude,
  losLatitude,
  losLongitude,
  trail,
  mapType,
  recenterCount,
  tintColor,
  backgroundColor,
  mapRotation,
}: LeafletMapProps) {
  const [map, setMap] = useState<any>(null);
  const markerRef = useRef<any>(null);
  const losMarkerRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const osmLayerRef = useRef<any>(null);
  const satelliteLayerRef = useRef<any>(null);

  const redContainerRef = useRef<HTMLDivElement | null>(null);
  const greenContainerRef = useRef<HTMLDivElement | null>(null);

  // Initialize Map script and stylesheet
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => {
      const L = (window as any).L;
      if (!L) return;

      const mapInstance = L.map("map-container", {
        zoomControl: false,
        attributionControl: false,
      }).setView([latitude, longitude], 15);

      const osmLayer = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          maxZoom: 19,
        },
      );
      osmLayerRef.current = osmLayer;

      const satelliteLayer = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          maxZoom: 18,
        },
      );
      satelliteLayerRef.current = satelliteLayer;

      if (mapType === "satellite") {
        satelliteLayer.addTo(mapInstance);
      } else {
        osmLayer.addTo(mapInstance);
      }

      const polyline = L.polyline(
        trail.map((p) => [p.latitude, p.longitude]),
        { color: tintColor, weight: 4 },
      ).addTo(mapInstance);
      polylineRef.current = polyline;

      setMap(mapInstance);
    };
    document.body.appendChild(script);

    return () => {
      link.remove();
      script.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup map instance on unmount
  useEffect(() => {
    return () => {
      if (map) {
        map.remove();
      }
    };
  }, [map]);

  // Handle mapType toggle
  useEffect(() => {
    if (!map || !osmLayerRef.current || !satelliteLayerRef.current) return;

    if (mapType === "satellite") {
      if (map.hasLayer(osmLayerRef.current)) {
        map.removeLayer(osmLayerRef.current);
      }
      satelliteLayerRef.current.addTo(map);
    } else {
      if (map.hasLayer(satelliteLayerRef.current)) {
        map.removeLayer(satelliteLayerRef.current);
      }
      osmLayerRef.current.addTo(map);
    }
  }, [map, mapType]);

  const hasCenteredRef = useRef<boolean>(false);

  // Handle recentering
  useEffect(() => {
    if (!map) return;

    const isNonZero = latitude !== 0 || longitude !== 0;
    if (recenterCount > 0 || (!hasCenteredRef.current && isNonZero)) {
      if (isNonZero) {
        hasCenteredRef.current = true;
      }
      const maxZoom = mapType === "satellite" ? 18 : 19;
      map.setView([latitude, longitude], maxZoom);

      if (markerRef.current) {
        markerRef.current.setLatLng([latitude, longitude]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, recenterCount, latitude, longitude]);

  // Manage Red Marker
  useEffect(() => {
    if (!map) return;

    const L = (window as any).L;
    if (!L) return;

    if (markerRef.current) {
      markerRef.current.setLatLng([latitude, longitude]);
    } else {
      const container = document.createElement("div");
      container.style.width = "32px";
      container.style.height = "32px";
      container.style.display = "flex";
      container.style.alignItems = "center";
      container.style.justifyContent = "center";
      container.style.filter = "drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.3))";
      container.style.transform = `rotate(${mapRotation}deg)`;
      container.style.transformOrigin = "16px 29px";
      container.style.transition = "transform 0.3s ease-out";
      redContainerRef.current = container;

      const root = createRoot(container);
      root.render(<IconMapPinFilled size={32} color="#FF3B30" />);

      const customIcon = L.divIcon({
        className: "custom-gps-marker",
        html: container,
        iconSize: [32, 32],
        iconAnchor: [16, 29], // Pointy tip of Tabler IconMapPinFilled
      });

      const marker = L.marker([latitude, longitude], {
        icon: customIcon,
        zIndexOffset: 1000,
      }).addTo(map);
      markerRef.current = marker;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, latitude, longitude]);

  // Manage Green Marker
  useEffect(() => {
    if (!map) return;

    const L = (window as any).L;
    if (!L) return;

    if (losLatitude !== null && losLongitude !== null) {
      if (losMarkerRef.current) {
        losMarkerRef.current.setLatLng([losLatitude, losLongitude]);
      } else {
        const losContainer = document.createElement("div");
        losContainer.style.width = "32px";
        losContainer.style.height = "32px";
        losContainer.style.display = "flex";
        losContainer.style.alignItems = "center";
        losContainer.style.justifyContent = "center";
        losContainer.style.filter =
          "drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.3))";
        losContainer.style.transform = `rotate(${mapRotation}deg)`;
        losContainer.style.transformOrigin = "16px 29px";
        losContainer.style.transition = "transform 0.3s ease-out";
        greenContainerRef.current = losContainer;

        const losRoot = createRoot(losContainer);
        losRoot.render(<IconMapPinFilled size={32} color="#34C759" />);

        const losCustomIcon = L.divIcon({
          className: "custom-gps-marker custom-los-marker",
          html: losContainer,
          iconSize: [32, 32],
          iconAnchor: [16, 29], // Pointy tip of Tabler IconMapPinFilled
        });

        const losMarker = L.marker([losLatitude, losLongitude], {
          icon: losCustomIcon,
          zIndexOffset: 500,
        }).addTo(map);
        losMarkerRef.current = losMarker;
      }
    } else {
      if (losMarkerRef.current) {
        map.removeLayer(losMarkerRef.current);
        losMarkerRef.current = null;
      }
      greenContainerRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, losLatitude, losLongitude]);

  // Handle Rotation updates
  useEffect(() => {
    if (redContainerRef.current) {
      redContainerRef.current.style.transform = `rotate(${mapRotation}deg)`;
      redContainerRef.current.style.transformOrigin = "16px 29px";
    }
    if (greenContainerRef.current) {
      greenContainerRef.current.style.transform = `rotate(${mapRotation}deg)`;
      greenContainerRef.current.style.transformOrigin = "16px 29px";
    }
  }, [mapRotation]);

  // Handle polyline updates
  useEffect(() => {
    if (!polylineRef.current) return;
    polylineRef.current.setLatLngs(trail.map((p) => [p.latitude, p.longitude]));
  }, [trail]);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        position: "relative",
        overflow: "hidden",
        backgroundColor: backgroundColor,
      }}
    >
      <div
        id="map-container"
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: "150vmax",
          height: "150vmax",
          marginLeft: "-75vmax",
          marginTop: "-75vmax",
          transform: `rotate(${-mapRotation}deg)`,
          transformOrigin: "center center",
          transition: "transform 0.3s ease-out",
        }}
      />
    </div>
  );
}
