"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useProject } from "@/context/ProjectContext";
import { CaptureAndAddPhoto } from "@/components/CaptureAndAddPhoto";
import { PhotoAlbum } from "@/components/PhotoAlbum";
import { db, type AnalysisRow } from "@/lib/localDb";
import { exportToWord } from "@/lib/exportToWord";
import { useAuth } from "@/context/AuthContext";
import { doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase";

export default function ProjectWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const projectId = typeof params.id === "string" ? params.id : null;
  const { project, loadProject, removePhotoFromAlbum, album } = useProject();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [lockedByOther, setLockedByOther] = useState<string | null>(null);
  const { user, loading: loadingAuth } = useAuth();

  const [analyses, setAnalyses] = useState<AnalysisRow[]>([]);

  useEffect(() => {
    if (!projectId) return;
    if (!user && !loadingAuth) {
      router.replace("/login");
      return;
    }
    if (!user) return;

    let cancelled = false;
    (async () => {
      try {
        const firestore = getDb();
        const ref = doc(firestore, "projects", projectId);
        const snap = await getDoc(ref);
        if (cancelled) return;
        if (!snap.exists()) {
          setNotFound(true);
          return;
        }

        const data = snap.data() as any;
        if (
          data.lockedBy &&
          data.lockedBy !== String(user.id) &&
          user.role !== "ADMIN"
        ) {
          setLockedByOther(data.lockedBy);
          router.push("/");
          return;
        }

        await updateDoc(ref, { lockedBy: String(user.id) });
        await loadProject(projectId);

        // suscripción para expulsar si otro toma el lock
        const unsub = onSnapshot(ref, (s) => {
          const d = s.data() as any;
          if (
            d?.lockedBy &&
            d.lockedBy !== String(user.id) &&
            user.role !== "ADMIN"
          ) {
            setLockedByOther(d.lockedBy);
            router.push("/");
          }
        });
        if (!cancelled) {
          // guardar para limpiar al desmontar
          (window as any).__perfilador_unsub_lock = unsub;
        } else {
          unsub();
        }
      } catch (e) {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      const maybeUnsub = (window as any).__perfilador_unsub_lock;
      if (typeof maybeUnsub === "function") {
        maybeUnsub();
        (window as any).__perfilador_unsub_lock = undefined;
      }
    };
  }, [projectId, loadProject, user, loadingAuth, router]);

  const handleDeletePhoto = async (id: string) => {
    if (!confirm("¿Eliminar esta fotografía del expediente?")) return;
    const photo = album.find((p) => p.id === id);
    if (photo?.previewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(photo.previewUrl);
    }
    await db.photos.delete(id);
    removePhotoFromAlbum(id);
  };

  if (loading || loadingAuth) {
    return (
      <div className="flex items-center justify-center min-h-[200px] text-slate-400">
        Cargando expediente…
      </div>
    );
  }

  if (lockedByOther && !project) {
    return (
      <div className="card p-6 text-center space-y-3">
        <p className="text-sm text-red-400 font-semibold">
          Acceso denegado: este expediente está en uso por otro analista (ID:{" "}
          {lockedByOther}).
        </p>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="inline-flex items-center justify-center rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-600"
        >
          Volver al inicio
        </button>
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
        <button
          type="button"
          onClick={async () => {
            if (projectId) {
              const firestore = getDb();
              const ref = doc(firestore, "projects", projectId);
              await updateDoc(ref, { lockedBy: null });
            }
            router.push("/");
          }}
          className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors"
        >
          Guardar y Salir a Inicio
        </button>
      </div>

      <CaptureAndAddPhoto />
      <PhotoAlbum onDeletePhoto={handleDeletePhoto} projectId={project.id} />

      {analyses && analyses.length > 0 && (
        <section className="card p-4 md:p-6 space-y-3 mt-2">
          <h3 className="text-sm font-semibold text-slate-100">
            Análisis guardados en este expediente
          </h3>
          <ul className="space-y-2">
            {analyses.map((a) => (
              <li
                key={a.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2"
              >
                <div className="text-xs text-slate-300">
                  <p className="font-medium">
                    Dictamen del{" "}
                    {new Date(a.createdAt).toLocaleString("es-MX", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      exportToWord(
                        a.content,
                        project.nombre || "Expediente_sin_nombre"
                      )
                    }
                    className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors"
                  >
                    Exportar a Word
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await db.analyses.delete(a.id!);
                    }}
                    className="inline-flex items-center gap-1 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-red-500 transition-colors"
                  >
                    Borrar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}