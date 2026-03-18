"use client";

import { useEffect, useRef, useState } from "react";
import exifr from "exifr";
import imageCompression from "browser-image-compression";
import { useProject } from "@/context/ProjectContext";
import { TIPOS_IMAGEN } from "@/context/ProjectContext";
import { db } from "@/lib/localDb";

const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.8,
  maxWidthOrHeight: 1280,
  useWebWorker: true,
  initialQuality: 0.7,
  alwaysKeepResolution: true,
} as const;

function getFallbackLocation(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve) => {
    if (typeof navigator?.geolocation?.getCurrentPosition !== "function") {
      resolve({ lat: 0, lng: 0 });
      return;
    }
    const timeout = setTimeout(() => resolve({ lat: 0, lng: 0 }), 5000);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timeout);
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      () => {
        clearTimeout(timeout);
        resolve({ lat: 0, lng: 0 });
      },
      { enableHighAccuracy: false, timeout: 4000, maximumAge: 60000 }
    );
  });
}

export function CaptureAndAddPhoto() {
  const { addPhotoToAlbum, project } = useProject();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [tipo, setTipo] = useState<string>(TIPOS_IMAGEN[0]);
  const [comentario, setComentario] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [isFetchingGPS, setIsFetchingGPS] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setError(null);
    setGps(null);
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setIsReading(true);
    setIsFetchingGPS(true);

    let compressed: File = selected;
    try {
      compressed = await imageCompression(selected, COMPRESSION_OPTIONS);
    } catch (err) {
      console.error(err);
      // Fallback: usar la imagen original si la compresión falla
      setError("No se pudo comprimir la imagen. Se usará la foto original.");
    }

    setFile(compressed);
    setPreviewUrl(URL.createObjectURL(compressed));

    try {
      const exifGps = await exifr.gps(compressed).catch(() => null);
      let lat: number | null = null;
      let lng: number | null = null;
      if (exifGps && typeof exifGps.latitude === "number" && typeof exifGps.longitude === "number") {
        lat = exifGps.latitude;
        lng = exifGps.longitude;
      } else {
        const fullExif = await exifr.parse(compressed, { gps: true }).catch(() => null) as Record<string, unknown> | null;
        if (fullExif?.latitude != null && fullExif?.longitude != null) {
          lat = fullExif.latitude as number;
          lng = fullExif.longitude as number;
        }
      }
      if (lat != null && lng != null) {
        setGps({ lat, lng });
        setError(null);
      } else {
        const fallback = await getFallbackLocation();
        setGps(fallback);
        setError(
          fallback.lat === 0 && fallback.lng === 0
            ? "No hay coordenadas en la imagen. Se agregará con ubicación (0, 0). Puede activar GPS/cámara para la próxima."
            : null
        );
      }
    } catch (err) {
      console.error(err);
      const fallback = await getFallbackLocation();
      setGps(fallback);
      setError("No se pudieron leer coordenadas. Se usará ubicación por defecto.");
    } finally {
      setIsReading(false);
      setIsFetchingGPS(false);
    }
  };

  const handleAgregarAlAlbum = async () => {
    if (!previewUrl || !gps || !project || !file) return;

    const photoId = crypto.randomUUID();
    const projectId = project.id;

    try {
      await db.transaction("rw", db.projects, db.photos, async () => {
        const existing = await db.projects.get(projectId);
        if (!existing) {
          await db.projects.add({
            id: projectId,
            name: project.nombre,
            createdAt: Date.now(),
          });
        }
        await db.photos.add({
          id: photoId,
          projectId,
          imageBlob: file,
          tag: tipo,
          comments: comentario.trim(),
          lat: gps.lat,
          lng: gps.lng,
          timestamp: Date.now(),
        });
      });
    } catch (e) {
      console.error("[CaptureAndAddPhoto] Error guardando en IndexedDB:", e);
      setError("No se pudo guardar en el dispositivo (poca memoria o espacio). Libere espacio e intente de nuevo.");
      return;
    }

    addPhotoToAlbum(
      {
        previewUrl,
        lat: gps.lat,
        lng: gps.lng,
        tipo,
        comentario: comentario.trim(),
        file,
      },
      photoId
    );

    setFile(null);
    setPreviewUrl(null);
    setGps(null);
    setComentario("");
    setTipo(TIPOS_IMAGEN[0]);
    setError(null);
  };

  const handleGalleryUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(e.target.files ?? []);
    if (!project || files.length === 0) return;

    setError(null);
    setIsFetchingGPS(true);

    for (const selected of files) {
      let compressed: File = selected;
      try {
        compressed = await imageCompression(selected, COMPRESSION_OPTIONS);
      } catch (err) {
        console.error("[CaptureAndAddPhoto] Error comprimiendo:", err);
        // Fallback: mantener la imagen original para no bloquear la subida
        setError("No se pudo comprimir una imagen. Se usará la foto original.");
      }

      let lat: number | null = null;
      let lng: number | null = null;
      try {
        const exifGps = await exifr.gps(compressed).catch(() => null);
        if (
          exifGps &&
          typeof exifGps.latitude === "number" &&
          typeof exifGps.longitude === "number"
        ) {
          lat = exifGps.latitude;
          lng = exifGps.longitude;
        } else {
          const fullExif = (await exifr
            .parse(compressed, { gps: true })
            .catch(() => null)) as Record<string, unknown> | null;
          if (fullExif?.latitude != null && fullExif?.longitude != null) {
            lat = fullExif.latitude as number;
            lng = fullExif.longitude as number;
          }
        }
      } catch {
        // ignorar error EXIF; lat/lng siguen null
      }

      if (lat == null || lng == null) {
        const fallback = await getFallbackLocation();
        lat = fallback.lat;
        lng = fallback.lng;
      }

      const photoId = crypto.randomUUID();
      const projectId = project.id;
      const preview = URL.createObjectURL(compressed);

      try {
        await db.transaction("rw", db.projects, db.photos, async () => {
          const existing = await db.projects.get(projectId);
          if (!existing) {
            await db.projects.add({
              id: projectId,
              name: project.nombre,
              createdAt: Date.now(),
            });
          }
          await db.photos.add({
            id: photoId,
            projectId,
            imageBlob: compressed,
            tag: tipo,
            comments: comentario.trim(),
            lat,
            lng,
            timestamp: Date.now(),
          });
        });
      } catch (err) {
        console.error("[CaptureAndAddPhoto] Error guardando en IndexedDB:", err);
        if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
        setError("No se pudo guardar en el dispositivo (poca memoria o espacio). Libere espacio e intente con menos fotos.");
        e.target.value = "";
        return;
      }

      addPhotoToAlbum(
        {
          previewUrl: preview,
          lat,
          lng,
          tipo,
          comentario: comentario.trim(),
          file: compressed,
        },
        photoId
      );
    }

    setIsFetchingGPS(false);
    e.target.value = "";
  };

  return (
    <section className="card p-4 md:p-6 space-y-4">
      <header className="space-y-1">
        <h3 className="text-lg font-semibold text-slate-100">
          Captura / Subida de fotografía
        </h3>
        <p className="text-sm text-slate-400">
          Tome una foto con la cámara o suba desde la galería. Si la imagen no tiene ubicación, se usará su posición actual o (0, 0).
        </p>
      </header>

      {!project && (
        <p className="text-sm text-amber-400">
          Cree o abra un proyecto para poder agregar fotos.
        </p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleGalleryUpload}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <button
          type="button"
          disabled={!project}
          onClick={() => project && fileInputRef.current?.click()}
          className="w-full rounded-lg border border-slate-600 bg-slate-900 text-slate-100 px-3 py-2 text-sm hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Tomar foto (Cámara)
        </button>
        <button
          type="button"
          disabled={!project}
          onClick={() => project && galleryInputRef.current?.click()}
          className="w-full rounded-lg border border-slate-600 bg-slate-900 text-slate-100 px-3 py-2 text-sm hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Subir desde galería
        </button>
      </div>

      {isReading && (
        <p className="text-sm text-sky-400">Leyendo metadatos EXIF…</p>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {previewUrl && gps && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="rounded-lg overflow-hidden border border-slate-800 bg-black flex-shrink-0 w-28 h-28">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Vista previa" className="w-full h-full object-cover" />
            </div>
            <div className="text-xs text-slate-400 flex-1 min-w-0">
              <p className="font-mono">Lat {gps.lat.toFixed(5)}</p>
              <p className="font-mono">Lng {gps.lng.toFixed(5)}</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Tipo de imagen</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 text-slate-100 px-3 py-2 text-sm"
            >
              {TIPOS_IMAGEN.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Comentario o anotación</label>
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Anotación específica sobre esta fotografía…"
              rows={2}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 text-slate-100 px-3 py-2 text-sm resize-none"
            />
          </div>

          <button
            type="button"
            onClick={() => void handleAgregarAlAlbum()}
            disabled={isFetchingGPS}
            className={`btn-primary w-full ${
              isFetchingGPS
                ? "bg-gray-600 opacity-50 cursor-not-allowed animate-pulse"
                : ""
            }`}
          >
            {isFetchingGPS
              ? "Obteniendo coordenadas GPS..."
              : "Agregar al álbum"}
          </button>
        </div>
      )}
    </section>
  );
}
