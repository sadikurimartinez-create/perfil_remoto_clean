"use client";

import { useState } from "react";
import { useProject } from "@/context/ProjectContext";
import { AnalysisMap } from "./AnalysisMap";

/** Redimensiona y comprime la imagen para que el payload quede bajo el límite de Vercel (~4.5 MB). */
async function resizeImageToBase64(file: File, maxSize = 640, quality = 0.5): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      let dw = w;
      let dh = h;
      if (w > maxSize || h > maxSize) {
        if (w >= h) {
          dw = maxSize;
          dh = Math.round((h * maxSize) / w);
        } else {
          dh = maxSize;
          dw = Math.round((w * maxSize) / h);
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = dw;
      canvas.height = dh;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("No se pudo crear canvas"));
        return;
      }
      ctx.drawImage(img, 0, 0, dw, dh);
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      const i = dataUrl.indexOf(",");
      resolve(i >= 0 ? dataUrl.slice(i + 1) : dataUrl);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Error al cargar la imagen"));
    };
    img.src = url;
  });
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("No se pudo leer el archivo"));
        return;
      }
      const i = result.indexOf(",");
      resolve(i >= 0 ? result.slice(i + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function PhotoAlbum() {
  const {
    album,
    selectedIds,
    analysisResult,
    togglePhotoSelection,
    selectAllPhotos,
    clearSelection,
    setAnalysisResult
  } = useProject();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerarAnalisis = async () => {
    if (selectedIds.length === 0) {
      setError("Seleccione al menos una fotografía.");
      return;
    }
    setError(null);
    setIsAnalyzing(true);
    try {
      const selected = album.filter((p) => selectedIds.includes(p.id));
      const photosPayload = await Promise.all(
        selected.map(async (p) => {
          let imageBase64: string | null = null;
          if (p.file) {
            try {
              imageBase64 = await resizeImageToBase64(p.file, 640, 0.5);
            } catch {
              const sizeMb = p.file.size / (1024 * 1024);
              if (sizeMb <= 2) imageBase64 = await readFileAsBase64(p.file);
            }
          }
          return {
            id: p.id,
            lat: p.lat,
            lng: p.lng,
            tipo: p.tipo,
            comentario: p.comentario,
            imageBase64: imageBase64 ?? undefined
          };
        })
      );

      const res = await fetch("/api/analyze-selection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photos: photosPayload })
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || "Error al generar el análisis");
      }
      const data = await res.json();
      setAnalysisResult(data);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Error al analizar la selección.");
      setAnalysisResult(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (album.length === 0) {
    return (
      <section className="card p-6 text-center text-slate-400 text-sm">
        El álbum está vacío. Agregue fotografías desde el bloque de captura.
      </section>
    );
  }

  return (
    <section className="card p-4 md:p-6 space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-slate-100">Álbum fotográfico</h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={selectAllPhotos}
            className="text-xs px-2 py-1 rounded border border-slate-600 text-slate-300 hover:bg-slate-800"
          >
            Seleccionar todas
          </button>
          <button
            type="button"
            onClick={clearSelection}
            className="text-xs px-2 py-1 rounded border border-slate-600 text-slate-300 hover:bg-slate-800"
          >
            Limpiar selección
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {album.map((p) => (
          <div
            key={p.id}
            className={`rounded-lg border overflow-hidden bg-slate-900/80 ${
              selectedIds.includes(p.id) ? "border-sky-500 ring-1 ring-sky-500/50" : "border-slate-700"
            }`}
          >
            <label className="flex flex-col cursor-pointer">
              <div className="flex items-start gap-1 p-1">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(p.id)}
                  onChange={() => togglePhotoSelection(p.id)}
                  className="mt-1 rounded border-slate-600"
                />
                <div className="flex-1 min-w-0">
                  <div className="aspect-square relative rounded overflow-hidden bg-black">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.previewUrl}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  </div>
                  <p className="text-[10px] font-medium text-slate-300 truncate mt-0.5">{p.tipo}</p>
                  <p className="text-[10px] text-slate-500 truncate">{p.comentario || "—"}</p>
                  <p className="text-[9px] text-slate-600 font-mono">{p.lat.toFixed(4)}, {p.lng.toFixed(4)}</p>
                </div>
              </div>
            </label>
          </div>
        ))}
      </div>

      <div className="pt-2 border-t border-slate-800">
        <button
          type="button"
          onClick={handleGenerarAnalisis}
          disabled={isAnalyzing || selectedIds.length === 0}
          className="btn-primary w-full"
        >
          {isAnalyzing ? "Generando análisis…" : "Generar Análisis de Selección"}
        </button>
        {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
      </div>

      {analysisResult && (
        <div className="space-y-4 pt-4 border-t-2 border-sky-500/50 bg-slate-900/50 rounded-xl p-4">
          <h4 className="text-base font-bold text-sky-200">
            Perfil criminológico generado
          </h4>
          <p className="text-xs text-slate-400">
            Resumen del análisis de la selección (Vision, Places, DENUE).
          </p>
          {analysisResult.unifiedProfile && (
            <div className="text-sm text-slate-300 whitespace-pre-wrap bg-slate-900/80 rounded-lg p-3 border border-slate-700">
              {analysisResult.unifiedProfile}
            </div>
          )}
          <AnalysisMap
            album={album.filter((p) => selectedIds.includes(p.id))}
            analysisResult={analysisResult}
          />
        </div>
      )}
    </section>
  );
}
