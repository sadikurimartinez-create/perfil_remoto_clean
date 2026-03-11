"use client";

import { useState } from "react";
import exifr from "exifr";
import { useProject } from "@/context/ProjectContext";
import { TIPOS_IMAGEN } from "@/context/ProjectContext";
import { db } from "@/lib/localDb";

export function CaptureAndAddPhoto() {
  const { addPhotoToAlbum, project } = useProject();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [tipo, setTipo] = useState<string>(TIPOS_IMAGEN[0]);
  const [comentario, setComentario] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isReading, setIsReading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setError(null);
    setGps(null);
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
    setIsReading(true);

    try {
      const exifGps = await exifr.gps(selected).catch(() => null);
      let lat: number | null = null;
      let lng: number | null = null;
      if (exifGps && typeof exifGps.latitude === "number" && typeof exifGps.longitude === "number") {
        lat = exifGps.latitude;
        lng = exifGps.longitude;
      } else {
        const fullExif = await exifr.parse(selected, { gps: true }).catch(() => null) as Record<string, unknown> | null;
        if (fullExif?.latitude != null && fullExif?.longitude != null) {
          lat = fullExif.latitude as number;
          lng = fullExif.longitude as number;
        }
      }
      if (lat != null && lng != null) setGps({ lat, lng });
      else setError("No se encontraron coordenadas GPS en la imagen. Tome la foto con GPS activado.");
    } catch (err) {
      console.error(err);
      setError("Error al leer metadatos EXIF.");
    } finally {
      setIsReading(false);
    }
  };

  const handleAgregarAlAlbum = async () => {
    if (!previewUrl || !gps || !project) return;

    // Estado en memoria (para el flujo actual)
    addPhotoToAlbum({
      previewUrl,
      lat: gps.lat,
      lng: gps.lng,
      tipo,
      comentario: comentario.trim(),
      file: file ?? undefined,
    });

    // Persistencia offline en IndexedDB (Dexie)
    try {
      const projectId = project.id;
      await db.transaction("rw", db.projects, db.photos, async () => {
        const existing = await db.projects.get(projectId);
        if (!existing) {
          await db.projects.add({
            id: projectId,
            name: project.nombre,
            createdAt: Date.now(),
          });
        }

        if (file) {
          await db.photos.add({
            id: crypto.randomUUID(),
            projectId,
            imageBlob: file,
            tag: tipo,
            comments: comentario.trim(),
            lat: gps.lat,
            lng: gps.lng,
            timestamp: Date.now(),
          });
        }
      });
    } catch (e) {
      console.error(
        "[CaptureAndAddPhoto] Error guardando en IndexedDB:",
        e
      );
    }

    setFile(null);
    setPreviewUrl(null);
    setGps(null);
    setComentario("");
    setTipo(TIPOS_IMAGEN[0]);
    setError(null);
  };

  return (
    <section className="card p-4 md:p-6 space-y-4">
      <header className="space-y-1">
        <h3 className="text-lg font-semibold text-slate-100">
          Captura / Subida de fotografía
        </h3>
        <p className="text-sm text-slate-400">
          Tome o seleccione una imagen. Indique tipo y comentario y agréguela al álbum.
        </p>
      </header>

      <label className="input-file">
        <div className="flex flex-col items-center gap-2 text-sm text-slate-300">
          <span className="font-medium">Toca o haz clic para capturar o seleccionar imagen</span>
          <span className="text-xs text-slate-500">JPG, JPEG, HEIC. Con GPS activado.</span>
        </div>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />
      </label>

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
            className="btn-primary w-full"
          >
            Agregar al álbum
          </button>
        </div>
      )}
    </section>
  );
}
