"use client";

import { useState } from "react";
import exifr from "exifr";

type GpsData = {
  latitude: number;
  longitude: number;
};

export function ImageUpload() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [gps, setGps] = useState<GpsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isReading, setIsReading] = useState(false);

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setGps(null);
    setIsReading(true);

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    try {
      // Intento 1: usar helper directo de exifr para GPS
      const exifGps = await exifr.gps(file).catch(() => null);

      let latitude: number | null = null;
      let longitude: number | null = null;

      if (exifGps && typeof exifGps.latitude === "number" && typeof exifGps.longitude === "number") {
        latitude = exifGps.latitude;
        longitude = exifGps.longitude;
      } else {
        // Intento 2: parseo completo de EXIF y búsqueda manual de campos GPS
        const fullExif = await exifr.parse(file, { gps: true }).catch(() => null);

        if (fullExif) {
          if (typeof (fullExif as any).latitude === "number" && typeof (fullExif as any).longitude === "number") {
            latitude = (fullExif as any).latitude;
            longitude = (fullExif as any).longitude;
          } else if (Array.isArray((fullExif as any).GPSLatitude) && Array.isArray((fullExif as any).GPSLongitude)) {
            const toDecimal = (values: number[], ref?: string) => {
              const [deg, min, sec] = values;
              let dec = deg + min / 60 + sec / 3600;
              if (ref === "S" || ref === "W") dec = -dec;
              return dec;
            };
            latitude = toDecimal(
              (fullExif as any).GPSLatitude,
              (fullExif as any).GPSLatitudeRef
            );
            longitude = toDecimal(
              (fullExif as any).GPSLongitude,
              (fullExif as any).GPSLongitudeRef
            );
          }

          // Para depuración avanzada si hace falta
          console.log("EXIF completo leído por exifr:", fullExif);
        }
      }

      if (latitude === null || longitude === null) {
        setError(
          "No se encontraron coordenadas GPS en los metadatos EXIF de la imagen. Asegúrate de que la foto tenga la geolocalización activada."
        );
        return;
      }

      const gpsData: GpsData = {
        latitude,
        longitude,
      };

      setGps(gpsData);
    } catch (err) {
      console.error(err);
      setError(
        "Ocurrió un error al leer los metadatos EXIF de la imagen. Intenta con otra fotografía."
      );
    } finally {
      setIsReading(false);
    }
  };

  return (
    <section className="card p-4 md:p-6 space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl md:text-2xl font-semibold">
          Captura / Subida de Evidencia Fotográfica
        </h1>
        <p className="text-sm text-slate-400">
          Sube una fotografía tomada in situ. El sistema intentará extraer las
          coordenadas GPS desde los metadatos EXIF para preparar el análisis
          geoespacial.
        </p>
      </header>

      <label className="input-file">
        <div className="flex flex-col items-center gap-2 text-sm text-slate-300">
          <span className="font-medium">Toca o haz clic para seleccionar una imagen</span>
          <span className="text-xs text-slate-500">
            Formatos recomendados: JPG, JPEG, HEIC. Idealmente directamente desde el dispositivo móvil.
          </span>
        </div>
        <input
          type="file"
          accept="image/*"
          // En móviles, esto sugiere usar directamente la cámara trasera
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />
      </label>

      {isReading && (
        <p className="text-sm text-sky-400">
          Leyendo metadatos EXIF y extrayendo coordenadas GPS…
        </p>
      )}

      {error && (
        <p className="text-sm text-red-400">
          {error}
        </p>
      )}

      {previewUrl && (
        <div className="grid gap-3 md:grid-cols-[minmax(0,2fr),minmax(0,3fr)] items-start">
          <div className="space-y-2">
            <p className="text-xs text-slate-400 uppercase tracking-wide">
              Vista previa de la evidencia
            </p>
            <div className="overflow-hidden rounded-lg border border-slate-800 bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Vista previa de la evidencia"
                className="h-64 w-full object-contain bg-black"
              />
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs text-slate-400 uppercase tracking-wide">
              Coordenadas extraídas
            </p>
            {gps ? (
              <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/80 p-3 text-sm">
                <p>
                  <span className="text-slate-400">Latitud:</span>{" "}
                  <span className="font-mono">
                    {gps.latitude.toFixed(6)}
                  </span>
                </p>
                <p>
                  <span className="text-slate-400">Longitud:</span>{" "}
                  <span className="font-mono">
                    {gps.longitude.toFixed(6)}
                  </span>
                </p>
                <p className="text-xs text-slate-500">
                  Estos datos se utilizarán para centrar el mapa y llamar a las
                  APIs de Google Maps, Google Places e INEGI en etapas
                  posteriores del flujo.
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-400">
                Aún no se han encontrado coordenadas GPS para esta imagen.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

