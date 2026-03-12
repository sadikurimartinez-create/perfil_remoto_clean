"use client";

import { useMemo } from "react";
import { Circle, GoogleMap, HeatmapLayer, Marker, useJsApiLoader } from "@react-google-maps/api";
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
          mapTypeId: "hybrid",
        }}
      >
        <Circle
          center={center}
          radius={500}
          options={{
            strokeColor: "#ef4444",
            strokeOpacity: 0.9,
            strokeWeight: 2,
            fillColor: "#ef4444",
            fillOpacity: 0.1,
          }}
        />

        {/* Marcadores de cada fotografía seleccionada (evidencia) */}
        {album.map((p) => (
          <Marker
            key={p.id}
            position={{ lat: p.lat, lng: p.lng }}
            title={`${p.tipo} - ${p.comentario ?? ""}`}
          />
        ))}

        {album.length > 0 && (
          <Marker
            position={center}
            title="Centro del levantamiento fotográfico"
            icon={{
              path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
              scale: 8,
              fillColor: "#f97316",
              fillOpacity: 1,
              strokeColor: "#1f2937",
              strokeWeight: 2,
            }}
          />
        )}

        {analysisResult?.historicalCrimes?.map((c, idx) => (
          <Marker
            key={`crime-${idx}`}
            position={{ lat: c.lat, lng: c.lng }}
            title={c.tipoDelito}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 4,
              fillColor: "#991b1b",
              fillOpacity: 1,
              strokeColor: "#fecaca",
              strokeWeight: 1,
            }}
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
          {album.length} punto(s) de evidencia fotográfica y{" "}
          {analysisResult?.historicalCrimes?.length ?? 0} incidentes
          históricos representados en el mapa.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-3 w-3 rounded-full bg-red-500" />
            <span className="text-slate-400">
              <span className="font-semibold text-slate-200">Evidencia:</span>{" "}
              Ubicación de las fotografías tomadas.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-3 w-3 rounded-full bg-sky-400" />
            <span className="text-slate-400">
              <span className="font-semibold text-slate-200">Atractores:</span>{" "}
              Escuelas, comercios y otros puntos de interés (POIs).
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-3 w-3 rounded-full bg-red-900" />
            <span className="text-slate-400">
              <span className="font-semibold text-slate-200">Incidencia:</span>{" "}
              Delitos históricos en la zona analizada.
            </span>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Representación geoespacial del polígono de estudio en un radio de 500
          metros a partir de los indicios fotográficos, ilustrando la
          convergencia entre atractores delictivos e incidencia histórica.
        </p>
      </div>
    </div>
  );
}
