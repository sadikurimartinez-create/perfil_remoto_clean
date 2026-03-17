"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Circle, GoogleMap, HeatmapLayer, Marker, Polygon, DrawingManager, useJsApiLoader } from "@react-google-maps/api";
import type { AlbumPhoto, AnalysisResult } from "@/context/ProjectContext";

type AnalysisMapProps = {
  album: AlbumPhoto[];
  analysisResult: AnalysisResult | null;
  /** Radio de la zona de análisis en metros (círculo en el mapa). Por defecto 500. */
  analysisRadius?: number;
  /** Polígono de análisis dibujado manualmente por el analista. */
  analysisPolygon?: google.maps.LatLngLiteral[];
  setAnalysisPolygon?: (coords: google.maps.LatLngLiteral[]) => void;
  /** POIs manuales fijados por el analista en el mapa preliminar. */
  manualPois?: { lat: number; lng: number; label?: string }[];
  setManualPois?: (value: { lat: number; lng: number; label?: string }[]) => void;
  /** Controla si el mapa está en modo preliminar (se muestran herramientas de dibujo y toolbar). */
  isPreliminary?: boolean;
};

const containerStyle: React.CSSProperties = {
  width: "100%",
  minHeight: "280px",
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

export function AnalysisMap({
  album,
  analysisResult,
  analysisRadius = 500,
  analysisPolygon,
  setAnalysisPolygon,
  manualPois,
  setManualPois,
  isPreliminary = false,
}: AnalysisMapProps) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [drawingManager, setDrawingManager] = useState<google.maps.drawing.DrawingManager | null>(null);
  const [isPlacingManualPoi, setIsPlacingManualPoi] = useState(false);

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

  const apiKey = typeof process !== "undefined" ? (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "") : "";
  const { isLoaded, loadError } = useJsApiLoader({
    id: "analysis-map",
    googleMapsApiKey: apiKey,
    libraries: ["visualization", "drawing"],
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
    const valid = analysisResult.historicalCrimes.filter((c) => hasValidCoords(c));
    if (valid.length === 0) return [];

    const cellSize = 0.0001;
    const grid = new Map<string, { lat: number; lng: number; count: number }>();
    for (const c of valid) {
      const lat = c.lat as number;
      const lng = c.lng as number;
      const key = `${Math.round(lat / cellSize) * cellSize},${Math.round(lng / cellSize) * cellSize}`;
      const existing = grid.get(key);
      if (existing) existing.count += 1;
      else grid.set(key, { lat, lng, count: 1 });
    }
    return Array.from(grid.values()).map(({ lat, lng, count }) => ({
      location: new g.maps.LatLng(lat, lng),
      weight: Math.min(count * 1.5, 10),
    }));
  }, [analysisResult?.historicalCrimes, isLoaded]);

  if (!apiKey || apiKey.trim() === "") {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4 text-sm text-amber-400">
        <p className="font-semibold">Mapa no disponible</p>
        <p className="mt-1">Falta la clave de Google Maps (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY). En móvil, asegúrese de que la app se sirve con la variable configurada.</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4 text-sm text-red-400 space-y-2">
        <p className="font-semibold">Error al cargar el mapa</p>
        <p>Verifique en Google Cloud: Maps JavaScript API y biblioteca Visualization habilitadas, clave sin restricciones que bloqueen este dominio o dispositivo (en Android use la misma URL que en escritorio o añada restricciones por sitio).</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4 text-sm text-slate-400 min-h-[200px] flex items-center justify-center">
        Cargando mapa de Google…
      </div>
    );
  }

  const getPoiIcon = (category?: string | null): { emoji: string; bg: string } => {
    switch (category) {
      case "escuela":
        return { emoji: "🏫", bg: "#0ea5e9" };
      case "expendioAlcohol":
        return { emoji: "🍺", bg: "#eab308" };
      case "chatarreraOTaller":
        return { emoji: "🛠️", bg: "#f97316" };
      case "otro":
      default:
        return { emoji: "📍", bg: "#22c55e" };
    }
  };

  return (
    <div className="relative rounded-lg border border-slate-700 overflow-hidden bg-slate-900/50">
      {isPreliminary && (
        <div className="absolute top-3 left-3 z-20 flex items-center gap-2 rounded-lg bg-slate-900/80 backdrop-blur-md border border-slate-700 px-3 py-1.5 text-xs text-slate-200 shadow-lg">
          <span className="font-semibold tracking-tight text-emerald-300">
            Mapa preliminar
          </span>
          {setManualPois && (
            <button
              type="button"
              onClick={() => setIsPlacingManualPoi((prev) => !prev)}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 border text-[11px] ${
                isPlacingManualPoi
                  ? "border-amber-400 bg-amber-500/20 text-amber-200"
                  : "border-slate-600 bg-slate-800/70 text-slate-200"
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              Fijar POI manual
            </button>
          )}
        </div>
      )}
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={15}
        onLoad={onMapLoad}
        onClick={(e) => {
          if (!isPreliminary || !setManualPois || !isPlacingManualPoi) return;
          const latLng = e.latLng;
          if (!latLng) return;
          const pt = { lat: latLng.lat(), lng: latLng.lng() };
          const label = window.prompt(
            "Clasificación del punto (ej. Casa de Seguridad, Baldío, Taller):"
          );
          setManualPois([
            ...(manualPois ?? []),
            { ...pt, label: label || undefined },
          ]);
        }}
        options={{
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          mapTypeId: "hybrid",
        }}
      >
        {!isPreliminary && (
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
        )}

        {/* Pines rojos: una foto seleccionada = un pin destacado (evidencia fotográfica) */}
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

        {/* Delitos: puntos carmesí con cruz táctica */}
        {crimesWithCoords.map((c, idx) => (
          <Marker
            key={`crime-${idx}`}
            position={{ lat: c.lat as number, lng: c.lng as number }}
            title={c.tipoDelito}
            label={{
              text: "❌",
              color: "#fee2e2",
              fontSize: "10px",
              fontWeight: "700",
            }}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 6,
              fillColor: "#7f1d1d",
              fillOpacity: 1,
              strokeColor: "#fecaca",
              strokeWeight: 1,
            }}
          />
        ))}

        {/* POIs / atractores: íconos inteligentes por categoría */}
        {poisWithCoords.map((p, idx) => {
          const { emoji, bg } = getPoiIcon(p.category as string | undefined);
          return (
            <Marker
              key={`poi-${idx}`}
              position={{ lat: p.lat, lng: p.lng }}
              title={p.name}
              label={{
                text: emoji,
                fontSize: "12px",
              }}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: 6,
                fillColor: bg,
                fillOpacity: 1,
                strokeColor: "#020617",
                strokeWeight: 1,
              }}
            />
          );
        })}

        {/* Polígono de análisis dibujado por el analista */}
        {isPreliminary && analysisPolygon && analysisPolygon.length > 2 && (
          <Polygon
            paths={analysisPolygon}
            options={{
              strokeColor: "#ef4444",
              strokeOpacity: 1,
              strokeWeight: 2,
              fillColor: "#991b1b",
              fillOpacity: 0.25,
            }}
          />
        )}

        {/* POIs manuales fijados por el analista */}
        {manualPois?.map((p, idx) => (
          <Marker
            key={`manual-poi-${idx}`}
            position={{ lat: p.lat, lng: p.lng }}
            title={p.label || "POI manual"}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 7,
              fillColor: "#f59e0b",
              fillOpacity: 1,
              strokeColor: "#1f2937",
              strokeWeight: 2,
            }}
          />
        ))}

        {heatmapCrimeData.length > 0 && (
          <HeatmapLayer
            data={heatmapCrimeData}
            options={{
              radius: 40,
              dissipating: true,
              opacity: 0.7,
              gradient: [
                "rgba(0,255,0,0)",
                "rgba(0,255,0,0.4)",
                "rgba(255,255,0,0.6)",
                "rgba(255,165,0,0.8)",
                "rgba(255,0,0,1)",
              ],
            }}
          />
        )}
        {isPreliminary && setAnalysisPolygon && (
          <DrawingManager
            onLoad={(dm: google.maps.drawing.DrawingManager) => {
              setDrawingManager(dm);
              // Sólo permitir polígonos
              dm.setDrawingMode(google.maps.drawing.OverlayType.POLYGON);
            }}
            onPolygonComplete={(poly: google.maps.Polygon) => {
              const path = poly.getPath();
              const coords: google.maps.LatLngLiteral[] = [];
              for (let i = 0; i < path.getLength(); i++) {
                const pt = path.getAt(i);
                coords.push({ lat: pt.lat(), lng: pt.lng() });
              }
              setAnalysisPolygon(coords);
              poly.setMap(null);
              if (drawingManager) {
                drawingManager.setDrawingMode(null);
              }
            }}
            options={{
              drawingControl: false,
              polygonOptions: {
                strokeColor: "#ef4444",
                strokeOpacity: 1,
                strokeWeight: 2,
                fillColor: "#991b1b",
                fillOpacity: 0.25,
              },
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
              Delitos históricos (puntos y heatmap de concentración).
            </span>
          </div>
        </div>
        {heatmapCrimeData.length > 0 && (
          <p className="text-xs text-slate-500 flex items-center gap-2">
            <span className="font-medium text-slate-400">Heatmap:</span>
            Verde (baja) → Amarillo → Naranja → Rojo (alta concentración de incidencia).
          </p>
        )}
        <p className="text-sm text-slate-300 mt-1 text-justify leading-relaxed">
          Análisis geoespacial pericial: el presente mapa ilustra un radio de proximidad de{" "}
          <span className="font-semibold">
            {analysisRadius >= 1000 ? `${(analysisRadius / 1000).toFixed(1)} km` : `${analysisRadius} metros`}
          </span>{" "}
          en torno a las coordenadas de los indicios fotográficos
          considerados en el expediente. Se han georreferenciado{" "}
          <span className="font-semibold">{poisWithCoords.length}</span>{" "}
          atractores de riesgo o puntos de interés (comercios, servicios, espacios públicos) y{" "}
          <span className="font-semibold">
            {analysisResult?.historicalCrimes?.length ?? 0}
          </span>{" "}
          eventos de incidencia delictiva histórica. La convergencia espacial de estos elementos permite visualizar
          patrones de oportunidad criminal, rutas de vulnerabilidad y zonas críticas para la focalización de
          estrategias de disuasión y prevención situacional.
        </p>
      </div>
    </div>
  );
}
