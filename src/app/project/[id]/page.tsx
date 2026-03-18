"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useProject } from "@/context/ProjectContext";
import { CaptureAndAddPhoto } from "@/components/CaptureAndAddPhoto";
import { PhotoAlbum } from "@/components/PhotoAlbum";
import { db } from "@/lib/localDb";
import { exportToWord } from "@/lib/exportToWord";
import { useAuth } from "@/context/AuthContext";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";

type CloudAnalysis = {
  id: string;
  projectId: string;
  content: string;
  createdAt: number;
  createdBy?: string;
  /** URLs públicas de las fotografías asociadas a este análisis. */
  attachedPhotos?: string[];
};

export default function ProjectWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const projectId = typeof params.id === "string" ? params.id : null;
  const { project, loadProject, removePhotoFromAlbum, album } = useProject();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const { user, loading: loadingAuth } = useAuth();

  const [analyses, setAnalyses] = useState<CloudAnalysis[]>([]);
  const [previewAnalysis, setPreviewAnalysis] = useState<CloudAnalysis | null>(null);

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
  }, [projectId, loadProject, user, loadingAuth, router]);

  // Suscripción en tiempo real a los análisis guardados en Firestore
  useEffect(() => {
    if (!projectId) return;
    const db = getDb();
    const q = query(
      collection(db, "analyses"),
      where("projectId", "==", projectId)
    );
    const unsub = onSnapshot(q, (snap) => {
      const list: CloudAnalysis[] = snap.docs
        .map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            projectId: data.projectId as string,
            content: (data.content as string) ?? "",
            createdAt: (data.createdAt as number) ?? 0,
            createdBy: data.createdBy as string | undefined,
            attachedPhotos: (data.attachedPhotos as CloudAnalysis["attachedPhotos"]) ?? [],
          };
        })
        .sort((a, b) => b.createdAt - a.createdAt);
      setAnalyses(list);
    });
    return () => unsub();
  }, [projectId]);

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

  const handleSaveAnalysisToCloud = async (
    content: string,
    attachedPhotos?: CloudAnalysis["attachedPhotos"]
  ) => {
    if (!projectId || !user) return;
    const db = getDb();
    await addDoc(collection(db, "analyses"), {
      projectId,
      content,
      createdAt: Date.now(),
      createdBy: user.username,
      attachedPhotos: attachedPhotos ?? [],
    });
    // Actualizar contador de fotos del proyecto en Firestore
    try {
      const projectRef = doc(db, "projects", projectId);
      await updateDoc(projectRef, {
        photoCount: album.length,
      });
    } catch (e) {
      console.error(
        "[ProjectWorkspacePage] No se pudo actualizar photoCount del proyecto:",
        e
      );
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
      <header className="contents">
        <div className="flex flex-wrap items-center justify-between gap-3 lg:col-span-12">
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
            <p className="text-xs text-slate-400 mt-0.5 font-mono tracking-tight text-blue-300/90">
              ID expediente: {project.id}
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors"
          >
            Guardar y Salir a Inicio
          </button>
        </div>
      </header>

      <div className="lg:col-span-7 space-y-6 overflow-y-auto pb-20 lg:pb-0">
        <CaptureAndAddPhoto />
        <PhotoAlbum
          onDeletePhoto={handleDeletePhoto}
          projectId={project.id}
          onSaveAnalysisToCloud={handleSaveAnalysisToCloud}
          splitLayout
        />
      </div>

      <div
        id="c4-right-column"
        className="lg:col-span-5 space-y-6 lg:sticky lg:top-6 h-fit"
      />

      <div className="lg:col-span-12">
      {analyses && analyses.length > 0 && (
        <section className="bg-slate-900/60 backdrop-blur-md border border-slate-700/50 shadow-2xl rounded-xl p-4 md:p-6 space-y-3 mt-2">
          <h3 className="text-sm font-semibold text-slate-100">
            Análisis guardados en este expediente
          </h3>
          <ul className="space-y-2">
            {analyses.map((a) => (
              <li
                key={a.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border border-slate-700/50 bg-slate-900/60 backdrop-blur-md px-3 py-2"
              >
                <div className="text-xs text-slate-300">
                  <p className="font-medium">
                    Análisis criminológico ambiental del{" "}
                    <span className="font-mono tracking-tight text-blue-300">
                      {new Date(a.createdAt).toLocaleString("es-MX", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Ordenado y guardado por:{" "}
                    <span className="font-semibold text-slate-200 font-mono tracking-tight text-blue-300/90">
                      {a.createdBy || "Usuario no identificado"}
                    </span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={async () =>
                      await exportToWord(
                        a.content,
                        project.nombre || "Expediente_sin_nombre",
                        (a.attachedPhotos || [])
                      )
                    }
                    className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors"
                  >
                    Exportar a Word
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewAnalysis(a)}
                    className="inline-flex items-center gap-1 rounded-md bg-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-100 shadow-sm hover:bg-slate-600 transition-colors"
                  >
                    Vista previa
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const db = getDb();
                      await deleteDoc(doc(db, "analyses", a.id));
                    }}
                    className="inline-flex items-center gap-1 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-red-500 transition-colors"
                  >
                    Borrar
                  </button>
                </div>
                {a.attachedPhotos && a.attachedPhotos.length > 0 && (
                  <div className="mt-3 w-full">
                    <h4 className="text-slate-400 text-sm font-bold mt-1 mb-2 border-b border-slate-700 pb-1">
                      Anexo Fotográfico
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {a.attachedPhotos.map((url, idx) => (
                        <div
                          key={idx}
                          className="relative rounded-lg overflow-hidden border border-slate-700 aspect-video bg-black"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt={`Foto ${idx + 1} del expediente`}
                            className="object-cover w-full h-full"
                          />
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className="text-white/30 font-black text-2xl tracking-widest -rotate-45 select-none text-center leading-tight drop-shadow">
                              SSP AGS
                              <br />
                              CEIPOL
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      </div>

      <a
        href="#c4-right-column"
        className="fixed bottom-6 right-6 w-14 h-14 bg-emerald-600 rounded-full shadow-lg shadow-emerald-900/50 flex items-center justify-center z-50 text-white hover:bg-emerald-500 transition-transform active:scale-95 lg:hidden"
        aria-label="Ir a mapa y análisis"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      </a>
      {previewAnalysis && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 md:p-8 max-h-[90vh] overflow-y-auto relative">
            <button
              type="button"
              onClick={() => setPreviewAnalysis(null)}
              className="absolute top-3 right-3 inline-flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 h-8 w-8 text-sm"
              aria-label="Cerrar vista previa"
            >
              ✕
            </button>
            <h3 className="text-lg font-bold text-slate-100 mb-4">
              Vista previa del dictamen
            </h3>
            <div className="prose prose-invert prose-sm max-w-none text-slate-100 whitespace-pre-wrap">
              {previewAnalysis.content}
            </div>
            {previewAnalysis.attachedPhotos && previewAnalysis.attachedPhotos.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-semibold text-slate-200 mb-2">
                  Anexo fotográfico
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {previewAnalysis.attachedPhotos.map((url, idx) => (
                    <div
                      key={idx}
                      className="relative rounded-lg overflow-hidden border border-slate-700 aspect-video bg-black"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`Foto ${idx + 1} del expediente`}
                        className="object-cover w-full h-full"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}