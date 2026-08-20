import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";

import { HARBORS, type Level } from "@/lib/harbors";

export type HarborStatus = Record<string, Level>;

type Props = {
  lat: number;
  lon: number;
  placeName: string;
  level: Level;
  likelihood: string;
  showAll: boolean;
  harborStatus: HarborStatus;
};

const COLORS: Record<Level, string> = {
  safe: "#4FB89C",
  caution: "#F2B84B",
  unsafe: "#E85D4A",
};

export default function CoastMap({
  lat,
  lon,
  placeName,
  level,
  likelihood,
  showAll,
  harborStatus,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    const map = L.map(el, { center: [lat, lon], zoom: 8, scrollWheelZoom: false });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const invalidate = () => map.invalidateSize();
    const raf = requestAnimationFrame(invalidate);
    const timer = window.setTimeout(invalidate, 300);
    const ro = new ResizeObserver(invalidate);
    ro.observe(el);
    window.addEventListener("resize", invalidate);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      window.removeEventListener("resize", invalidate);
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    const marker = (
      mLat: number,
      mLon: number,
      color: string,
      label: string,
      radius = 12,
    ) => {
      L.circleMarker([mLat, mLon], {
        radius,
        color,
        weight: 2,
        fillColor: color,
        fillOpacity: 0.45,
      })
        .bindPopup(label)
        .addTo(layer);
    };

    if (showAll) {
      for (const h of HARBORS) {
        const s = harborStatus[h.id] ?? "caution";
        marker(h.lat, h.lon, COLORS[s], `<b>${h.name}</b><br/>${s.toUpperCase()}`, 10);
      }
      map.fitBounds(
        L.latLngBounds(HARBORS.map((h) => [h.lat, h.lon] as [number, number])).pad(0.25),
      );
    } else {
      marker(
        lat,
        lon,
        COLORS[level],
        `<b>${placeName}</b><br/>${level.toUpperCase()}<br/>Fish likelihood: ${likelihood}`,
      );
      map.setView([lat, lon], 9);
    }
    map.invalidateSize();
  }, [lat, lon, level, placeName, likelihood, showAll, harborStatus]);

  return <div ref={containerRef} className="map-shell" role="application" aria-label="Coastal map" />;
}
