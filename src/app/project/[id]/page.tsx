"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useProject } from "@/context/ProjectContext";
import { CaptureAndAddPhoto } from "@/components/CaptureAndAddPhoto";
import { PhotoAlbum } from "@/components/PhotoAlbum";
import { db } from "@/lib/localDb";

export default function ProjectWorkspacePage() {
  const params = useParams();
  const projectId = typeof params.id === "string" ? params.id : null;
  const { project, loadProject, removePhotoFromAlbum, album } = useProject();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    (async () => {
      try {
        const row = await db.projects.get(projectId);
        if (cancelled) return;
        if (!row) {
          setNotFound(true);
          return;
        }
        await loadProject(projectId);
      } catch (e) {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, loadProject]);

  const handleDeletePhoto = async (id: string) => {
    if (!confirm("¿Eliminar esta fotografía del expediente?")) return;
    const photo = album.find((p) => p.id === id);
    if (photo?.previewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(photo.previewUrl);
    }
    await db.photos.delete(id);
    removePhotoFromAlbum(id);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px] text-slate-400">
        Cargando expediente…
      </div>
    );
  }

  if (notFound || !projectId) {
    return (
      <div className="card p-6 text-center">
        <p className="text-slate-400">Expediente no encontrado.</p>
        <Link
          href="/"
          className="inline-block mt-4 text-sky-400 hover:text-sky-300 text-sm font-medium"
        >
          Volver a Mis Expedientes
        </Link>
      </div>
    );
  }

  if (!project) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/"
            className="text-xs text-slate-500 hover:text-slate-400 mb-1 inline-block"
          >
            ← Volver a Mis Expedientes
          </Link>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-slate-100">
            {project.nombre}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Espacio de trabajo · Agregue o elimine fotos y genere el análisis.
          </p>
        </div>
      </div>

      <CaptureAndAddPhoto />
      <PhotoAlbum onDeletePhoto={handleDeletePhoto} />
    </div>
  );
}
