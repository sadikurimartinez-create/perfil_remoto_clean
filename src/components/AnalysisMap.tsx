"use client";

import { useMemo } from "react";
import { GoogleMap, HeatmapLayer, Marker, useJsApiLoader } from "@react-google-maps/api";
import type { AlbumPhoto, AnalysisResult } from "@/context/ProjectContext";

type AnalysisMapProps = {
  album: AlbumPhoto[];
  analysisResult: AnalysisResult | null;
};

const containerStyle = {
  width: "100%",
  height: "320px",
};

export function AnalysisMap({ album, analysisResult }: AnalysisMapProps) {
  const center = useMemo(() => {
    if (album.length === 0) return { lat: 21.88, lng: -102.29 };
    const lat = album.reduce((a, p) => a + p.lat, 0) / album.length;
    const lng = album.reduce((a, p) => a + p.lng, 0) / album.length;
    return { lat, lng };
  }, [album]);

  const { isLoaded, loadError } = useJsApiLoader({
    id: "analysis-map",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
    libraries: ["visualization"],
  });

  const perPhotoMap = useMemo(() => {
    const map = new Map<string, { visionLabels?: string[] }>();
    analysisResult?.perPhotoFindings?.forEach((f) => {
      map.set(f.photoId, { visionLabels: f.visionLabels });
    });
    return map;
  }, [analysisResult?.perPhotoFindings]);

  const heatmapCrimeData = useMemo(() => {
    if (
      !isLoaded ||
      !analysisResult?.historicalCrimes?.length ||
      typeof window === "undefined" ||
      !(window as any).google
    ) {
      return [];
    }
    const g = (window as any).google as typeof google;
    return analysisResult.historicalCrimes.map((c) => ({
      location: new g.maps.LatLng(c.lat, c.lng),
      weight: 1,
    }));
  }, [analysisResult?.historicalCrimes, isLoaded]);

  if (loadError) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4 text-sm text-red-400">
        Error al cargar Google Maps. Verifique la clave y las APIs habilitadas.
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4 text-sm text-slate-400">
        Cargando mapa de Google…
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-700 overflow-hidden bg-slate-900/50">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={15}
        options={{
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        }}
      >
        {album.map((p) => (
          <Marker
            key={p.id}
            position={{ lat: p.lat, lng: p.lng }}
            title={`${p.tipo} - ${p.comentario ?? ""}`}
          />
        ))}

        {heatmapCrimeData.length > 0 && (
          <HeatmapLayer
            data={heatmapCrimeData}
            options={{
              radius: 25,
              dissipating: true,
            }}
          />
        )}
      </GoogleMap>

      <div className="p-3 border-t border-slate-700 space-y-2">
        <p className="text-xs text-slate-400">
          {album.length} punto(s) del levantamiento y{" "}
          {analysisResult?.historicalCrimes?.length ?? 0} incidentes históricos
          en la capa de calor.
        </p>
        <ul className="text-xs text-slate-500 space-y-1">
          {album.map((p) => {
            const finding = perPhotoMap.get(p.id);
            return (
              <li key={p.id}>
                <span className="font-mono">
                  {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                </span>
                {" · "}
                {p.tipo}
                {finding?.visionLabels?.length
                  ? ` · Vision: ${finding.visionLabels.slice(0, 3).join(", ")}`
                  : ""}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
