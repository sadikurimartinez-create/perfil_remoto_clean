"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useProject } from "@/context/ProjectContext";
import { CaptureAndAddPhoto } from "@/components/CaptureAndAddPhoto";
import { PhotoAlbum } from "@/components/PhotoAlbum";
import { exportToWord } from "@/lib/exportToWord";
import { useAuth } from "@/context/AuthContext";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";

type CloudAnalysis = {
  id: string;
  projectId: string;
  content: string;
  createdAt: number;
  createdBy?: string;
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

  const handleSaveAnalysisToCloud = async (content: string) => {
    if (!projectId || !user) return;
    const db = getDb();
    await addDoc(collection(db, "analyses"), {
      projectId,
      content,
      createdAt: Date.now(),
      createdBy: user.username,
    });
  };

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
          onClick={() => {
            router.push("/");
          }}
          className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors"
        >
          Guardar y Salir a Inicio
        </button>
      </div>

      <CaptureAndAddPhoto />
      <PhotoAlbum
        onDeletePhoto={handleDeletePhoto}
        projectId={project.id}
        onSaveAnalysisToCloud={handleSaveAnalysisToCloud}
      />

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
                      const db = getDb();
                      await deleteDoc(doc(db, "analyses", a.id));
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