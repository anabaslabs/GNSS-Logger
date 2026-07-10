"use dom";

import { IconMapPinFilled } from "@tabler/icons-react-native";
import React, { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";

interface LeafletMapProps {
  latitude: number;
  longitude: number;
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
  trail,
  mapType,
  recenterCount,
  tintColor,
  backgroundColor,
  heading,
  mapRotation,
}: LeafletMapProps) {
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const osmLayerRef = useRef<any>(null);
  const satelliteLayerRef = useRef<any>(null);

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);

    const style = document.createElement("style");
    style.innerHTML = `
      .custom-gps-marker svg path {
        stroke: #000000 !important;
        stroke-width: 1px !important;
        stroke-linejoin: round !important;
      }
    `;
    document.head.appendChild(style);

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => {
      const L = (window as any).L;
      if (!L) return;

      const map = L.map("map-container", {
        zoomControl: false,
        attributionControl: false,
      }).setView([latitude, longitude], 15);
      mapRef.current = map;

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
        satelliteLayer.addTo(map);
      } else {
        osmLayer.addTo(map);
      }

      const container = document.createElement("div");
      container.id = "gps-marker-inner";
      container.style.display = "flex";
      container.style.alignItems = "center";
      container.style.justifyContent = "center";
      container.style.filter = "drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.3))";
      container.style.transition = "transform 0.3s ease-out";

      const root = createRoot(container);
      root.render(<IconMapPinFilled size={32} color="#FF3B30" />);

      const customIcon = L.divIcon({
        className: "custom-gps-marker",
        html: container,
        iconSize: [32, 32],
        iconAnchor: [16, 30],
      });

      const marker = L.marker([latitude, longitude], {
        icon: customIcon,
      }).addTo(map);
      markerRef.current = marker;

      const polyline = L.polyline(
        trail.map((p) => [p.latitude, p.longitude]),
        { color: tintColor, weight: 4 },
      ).addTo(map);
      polylineRef.current = polyline;
    };
    document.body.appendChild(script);

    return () => {
      link.remove();
      script.remove();
      style.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
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
  }, [mapType]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const maxZoom = mapType === "satellite" ? 18 : 19;
    map.setView([latitude, longitude], maxZoom);

    if (markerRef.current) {
      markerRef.current.setLatLng([latitude, longitude]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterCount]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (markerRef.current) {
      markerRef.current.setLatLng([latitude, longitude]);
    }
  }, [latitude, longitude]);

  useEffect(() => {
    if (!polylineRef.current) return;
    polylineRef.current.setLatLngs(trail.map((p) => [p.latitude, p.longitude]));
  }, [trail]);

  useEffect(() => {
    const inner = document.getElementById("gps-marker-inner");
    if (inner) {
      inner.style.transform = `rotate(${mapRotation}deg)`;
    }
  }, [mapRotation]);

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
