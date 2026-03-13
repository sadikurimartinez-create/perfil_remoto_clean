"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

function hasValidCoords(p: { lat?: number | null; lng?: number | null }): boolean {
  return (
    p.lat != null &&
    p.lng != null &&
    !Number.isNaN(p.lat) &&
    !Number.isNaN(p.lng)
  );
}

export function AnalysisMap({ album, analysisResult }: AnalysisMapProps) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const photosWithCoords = useMemo(
    () => album.filter(hasValidCoords) as Array<{ id: string; lat: number; lng: number; tipo: string; comentario: string }>,
    [album]
  );

  const center = useMemo(() => {
    if (photosWithCoords.length === 0) return { lat: 21.88, lng: -102.29 };
    const lat = photosWithCoords.reduce((a, p) => a + p.lat, 0) / photosWithCoords.length;
    const lng = photosWithCoords.reduce((a, p) => a + p.lng, 0) / photosWithCoords.length;
    return { lat, lng };
  }, [photosWithCoords]);

  const crimesWithCoords = useMemo(
    () => (analysisResult?.historicalCrimes ?? []).filter((c) => hasValidCoords(c)),
    [analysisResult?.historicalCrimes]
  );

  const poisWithCoords = useMemo(
    () => (analysisResult?.pois ?? []).filter((p) => hasValidCoords(p)),
    [analysisResult?.pois]
  );

  const boundsPoints = useMemo(() => {
    const points: Array<{ lat: number; lng: number }> = [];
    photosWithCoords.forEach((p) => points.push({ lat: p.lat, lng: p.lng }));
    crimesWithCoords.forEach((c) => points.push({ lat: c.lat as number, lng: c.lng as number }));
    poisWithCoords.forEach((p) => points.push({ lat: p.lat, lng: p.lng }));
    return points;
  }, [photosWithCoords, crimesWithCoords, poisWithCoords]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    setMapReady(true);
  }, []);

  useEffect(() => {
    if (!mapRef.current || !mapReady || typeof window === "undefined" || !(window as any).google || boundsPoints.length === 0) return;
    const g = (window as any).google as typeof google;
    const bounds = new g.maps.LatLngBounds();
    boundsPoints.forEach((pt) => bounds.extend(new g.maps.LatLng(pt.lat, pt.lng)));
    mapRef.current.fitBounds(bounds, { top: 24, right: 24, bottom: 24, left: 24 });
  }, [mapReady, boundsPoints]);

  const { isLoaded, loadError } = useJsApiLoader({
    id: "analysis-map",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
    libraries: ["visualization"],
  });

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
    return analysisResult.historicalCrimes
      .filter((c) => hasValidCoords(c))
      .map((c) => ({
        location: new g.maps.LatLng(c.lat as number, c.lng as number),
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
        onLoad={onMapLoad}
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

        {/* Pines rojos: una foto seleccionada = un pin destacado */}
        {photosWithCoords.map((p) => (
          <Marker
            key={p.id}
            position={{ lat: p.lat, lng: p.lng }}
            title={`${p.tipo} - ${p.comentario ?? ""}`}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: "#dc2626",
              fillOpacity: 1,
              strokeColor: "#fef2f2",
              strokeWeight: 2,
            }}
          />
        ))}

        {photosWithCoords.length > 0 && (
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

        {/* Delitos: puntos carmesí */}
        {crimesWithCoords.map((c, idx) => (
          <Marker
            key={`crime-${idx}`}
            position={{ lat: c.lat as number, lng: c.lng as number }}
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

        {/* POIs / atractores: azul o amarillo */}
        {poisWithCoords.map((p, idx) => (
          <Marker
            key={`poi-${idx}`}
            position={{ lat: p.lat, lng: p.lng }}
            title={p.name}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 5,
              fillColor: p.category === "expendioAlcohol" ? "#eab308" : "#2563eb",
              fillOpacity: 1,
              strokeColor: "#cbd5e1",
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
          {photosWithCoords.length} foto(s) seleccionada(s),{" "}
          {analysisResult?.historicalCrimes?.length ?? 0} delitos y{" "}
          {poisWithCoords.length} atractores (POIs) en el mapa.
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
