"use dom";

import React, { useEffect, useRef } from "react";

interface LeafletMapProps {
  latitude: number;
  longitude: number;
  trail: { latitude: number; longitude: number }[];
  mapType: "standard" | "satellite";
  recenterCount: number;
  tintColor: string;
  backgroundColor: string;
  dom?: import("expo/dom").DOMProps;
}

export default function LeafletMap({
  latitude,
  longitude,
  trail,
  mapType,
  recenterCount,
  tintColor,
  backgroundColor,
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

      const customIcon = L.divIcon({
        className: "custom-gps-marker",
        html: `
          <div style="
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background-color: ${backgroundColor};
            border: 3px solid ${tintColor};
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <div style="
              width: 10px;
              height: 10px;
              border-radius: 50%;
              background-color: ${tintColor};
            "></div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
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

    map.setView([latitude, longitude]);

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

  return (
    <div
      id="map-container"
      style={{
        width: "100vw",
        height: "100vh",
        margin: 0,
        padding: 0,
        backgroundColor: backgroundColor,
      }}
    />
  );
}
