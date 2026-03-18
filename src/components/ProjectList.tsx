"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db as localDb } from "@/lib/localDb";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";

type ProjectWithCount = {
  id: string;
  name: string;
  createdAt: number;
  photoCount: number;
  createdBy?: string;
  lockedBy?: string | null;
};

export function ProjectList() {
  const router = useRouter();
  const [nombreInput, setNombreInput] = useState("");
  const [showPrompt, setShowPrompt] = useState(false);
  const { user, loading } = useAuth();
  const [projects, setProjects] = useState<ProjectWithCount[]>([]);
  const [allAnalyses, setAllAnalyses] = useState<
    { id: string; projectId: string; content: string; createdAt: number; createdBy?: string }[]
  >([]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (loading || !user) return;
    const db = getDb();
    const q = query(collection(db, "projects"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const list: ProjectWithCount[] = snap.docs
        .map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            name: data.name ?? "Sin nombre",
            createdAt: data.createdAt ?? 0,
            photoCount: data.photoCount ?? 0,
            createdBy: data.createdBy,
            lockedBy: data.lockedBy ?? null,
            // campo opcional en Firestore para borrado lógico
            deleted: data.deleted === true,
          } as ProjectWithCount & { deleted?: boolean };
        })
        .filter((p) => !p.deleted);
      setProjects(list);
    });
    return () => unsub();
  }, [loading, user]);

  useEffect(() => {
    if (loading || !user) return;
    const db = getDb();
    const q = query(collection(db, "analyses"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          projectId: data.projectId as string,
          content: (data.content as string) ?? "",
          createdAt: (data.createdAt as number) ?? 0,
          createdBy: data.createdBy as string | undefined,
          attachedPhotos: (data.attachedPhotos as string[] | undefined) ?? [],
        };
      });
      setAllAnalyses(list);
    });
    return () => unsub();
  }, [loading, user]);

  const handleNuevoProyecto = () => {
    setNombreInput("");
    setShowPrompt(true);
  };

  const handleConfirmarNombre = async () => {
    const nombre = nombreInput.trim();
    if (!nombre || !user) return;
    const firestore = getDb();
    const col = collection(firestore, "projects");
    const createdAt = Date.now();
    // Firestore generará el id, luego navegamos a ese proyecto
    const ref = await import("firebase/firestore").then(({ addDoc }) =>
      addDoc(col, {
        name: nombre,
        createdAt,
        createdBy: user.username,
        lockedBy: null,
        photoCount: 0,
      })
    );
    // Crear espejo local en Dexie para que el Workspace cargue proyecto y fotos
    await localDb.projects.add({
      id: ref.id,
      name: nombre,
      createdAt,
      createdBy: user.username,
      lockedBy: null,
    });
    setShowPrompt(false);
    setNombreInput("");
    router.push(`/project/${ref.id}`);
  };

  const handleDeleteProject = async (projectId: string) => {
    const firstConfirm = window.confirm(
      "Advertencia 1/2: Está a punto de ELIMINAR por completo este expediente y su evidencia asociada (fotos y análisis locales). ¿Desea continuar?"
    );
    if (!firstConfirm) return;

    const secondConfirm = window.confirm(
      "Confirmación final 2/2: Esta acción es irreversible. El expediente dejará de aparecer en la lista y se eliminarán sus datos locales. ¿CONFIRMA la eliminación definitiva?"
    );
    if (!secondConfirm) return;

    try {
      const firestore = getDb();

      // Eliminar documento del proyecto en Firestore
      const projectRef = doc(firestore, "projects", projectId);
      await deleteDoc(projectRef);

      // Eliminar análisis en Firestore vinculados a este proyecto (colección 'analyses')
      const analysesCol = collection(firestore, "analyses");
      const analysesSnap = await getDocs(
        query(analysesCol, where("projectId", "==", projectId))
      );
      const deletePromises: Promise<void>[] = [];
      analysesSnap.forEach((d) => {
        deletePromises.push(deleteDoc(d.ref));
      });
      if (deletePromises.length > 0) {
        await Promise.all(deletePromises);
      }

      // Eliminar espejo local en Dexie: proyecto, fotos y análisis asociados
      await localDb.transaction(
        "rw",
        localDb.projects,
        localDb.photos,
        localDb.analyses,
        async () => {
          await localDb.photos.where("projectId").equals(projectId).delete();
          await localDb.analyses.where("projectId").equals(projectId).delete();
          await localDb.projects.delete(projectId);
        }
      );
    } catch (err) {
      console.error(
        "[ProjectList] Error al eliminar expediente y su evidencia:",
        err
      );
      window.alert(
        "Ocurrió un error al eliminar el expediente. Revise la consola o intente de nuevo."
      );
    }
  };

  const list = projects ?? [];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px] text-slate-400">
        Verificando sesión…
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-xl md:text-2xl font-bold tracking-tight text-slate-100">
          Mis Expedientes
        </h2>
        <p className="text-sm text-slate-400 max-w-2xl">
          Proyectos guardados localmente. Abra uno para agregar o eliminar
          fotografías y generar el análisis.
        </p>
      </header>

      {!showPrompt ? (
        <>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleNuevoProyecto}
              className="btn-primary text-sm px-4 py-2"
            >
              Nuevo Proyecto
            </button>
          </div>

          {list.length === 0 ? (
            <div className="card p-8 text-center text-slate-400">
              <p className="text-sm">No hay expedientes guardados.</p>
              <p className="text-xs mt-1">Cree un proyecto para comenzar.</p>
              <button
                type="button"
                onClick={handleNuevoProyecto}
                className="mt-4 text-sky-400 hover:text-sky-300 text-sm font-medium"
              >
                Crear primer proyecto
              </button>
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {list.map((p) => {
                const analysesForProject = allAnalyses.filter(
                  (a) => a.projectId === p.id
                );
                const photosFromAnalyses = analysesForProject.reduce(
                  (acc, a: any) =>
                    acc +
                    (((a.attachedPhotos as string[] | undefined)?.length ??
                      0) as number),
                  0
                );
                const photoCountDisplay = Math.max(p.photoCount, photosFromAnalyses);
                return (
                  <li
                    key={p.id}
                    className="card p-4 flex flex-col gap-3 border border-slate-800 hover:border-slate-700"
                  >
                    <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-slate-100 truncate">
                        {p.name}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {new Date(p.createdAt).toLocaleDateString("es-MX", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {photoCountDisplay}{" "}
                        {photoCountDisplay === 1 ? "foto" : "fotos"}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Creado por:{" "}
                        <span className="font-medium text-slate-300">
                          {p.createdBy ?? "Desconocido"}
                        </span>
                      </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void handleDeleteProject(p.id)}
                          className="p-2 rounded text-xs text-red-400 hover:text-red-300 hover:bg-red-900/30 transition-colors"
                        >
                          Eliminar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            router.push(`/project/${p.id}`);
                          }}
                          className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium bg-sky-600 text-white hover:bg-sky-500"
                        >
                          Abrir Proyecto
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-800">
                      {analysesForProject.length === 0 ? (
                        <p className="text-sm text-slate-500 italic">
                          Sin análisis generados aún.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {analysesForProject.slice(0, 3).map((a) => (
                            <div
                              key={a.id}
                              className="bg-slate-900/50 p-3 rounded-md border border-slate-800 flex flex-col gap-2"
                            >
                              <p className="text-[11px] text-sky-400 font-semibold">
                                {new Date(a.createdAt).toLocaleString("es-MX", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}{" "}
                                · Generado por:{" "}
                                <span className="text-slate-100">
                                  {a.createdBy || "Usuario no identificado"}
                                </span>
                              </p>
                              <p className="text-xs text-slate-300 line-clamp-2">
                                {a.content.length > 120
                                  ? `${a.content.substring(0, 120)}…`
                                  : a.content}
                              </p>
                              <div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    router.push(`/project/${p.id}`);
                                  }}
                                  className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2 py-1 text-[11px] font-semibold text-slate-100 hover:bg-slate-700 transition-colors"
                                >
                                  Vista previa
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      ) : (
        <div className="card p-6 space-y-4 max-w-md">
          <label className="block">
            <span className="block text-sm font-medium text-slate-200 mb-1">
              Nombre del Proyecto
            </span>
            <input
              type="text"
              value={nombreInput}
              onChange={(e) => setNombreInput(e.target.value)}
              placeholder="Ej. Diagnóstico Polígono VNSA"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleConfirmarNombre()}
              disabled={!nombreInput.trim()}
              className="btn-primary flex-1"
            >
              Crear e ingresar
            </button>
            <button
              type="button"
              onClick={() => setShowPrompt(false)}
              className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 text-sm hover:bg-slate-800"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}