"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/localDb";
import { useAuth } from "@/context/AuthContext";

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

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  const projectsWithCount = useLiveQuery(
    async (): Promise<ProjectWithCount[]> => {
      const projects = await db.projects
        .orderBy("createdAt")
        .reverse()
        .toArray();
      return Promise.all(
        projects.map(async (p) => ({
          ...p,
          photoCount: await db.photos.where("projectId").equals(p.id).count(),
        }))
      );
    },
    []
  );

  const handleNuevoProyecto = () => {
    setNombreInput("");
    setShowPrompt(true);
  };

  const handleConfirmarNombre = async () => {
    const nombre = nombreInput.trim();
    if (!nombre) return;
    const id = crypto.randomUUID();
    await db.projects.add({
      id,
      name: nombre,
      createdAt: Date.now(),
      createdBy: user!.username,
    });
    setShowPrompt(false);
    setNombreInput("");
    router.push(`/project/${id}`);
  };

  const handleDeleteProject = async (projectId: string) => {
    const isConfirmed = window.confirm(
      "¿Estás seguro de eliminar este expediente y TODA su evidencia? Esta acción no se puede deshacer."
    );
    if (!isConfirmed) return;

    try {
      await db.transaction("rw", db.projects, db.photos, db.analyses, async () => {
        await db.photos.where("projectId").equals(projectId).delete();
        await db.analyses.where("projectId").equals(projectId).delete();
        await db.projects.delete(projectId);
      });
    } catch (err) {
      console.error("[ProjectList] Error al eliminar expediente:", err);
    }
  };

  const list = projectsWithCount ?? [];

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
                const isLockedByOther =
                  p.lockedBy && p.lockedBy !== String(user.id);
                return (
                  <li
                    key={p.id}
                    className="card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border border-slate-800 hover:border-slate-700"
                  >
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
                        {p.photoCount} {p.photoCount === 1 ? "foto" : "fotos"}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Creado por:{" "}
                        <span className="font-medium text-slate-300">
                          {p.createdBy ?? "Desconocido"}
                        </span>
                      </p>
                      {isLockedByOther && (
                        <p className="text-[11px] text-red-400 mt-0.5">
                          🔒 En uso por otro analista
                        </p>
                      )}
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
                        disabled={!!isLockedByOther}
                        onClick={() => {
                          if (!isLockedByOther) router.push(`/project/${p.id}`);
                        }}
                        className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium ${
                          isLockedByOther
                            ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                            : "bg-sky-600 text-white hover:bg-sky-500"
                        }`}
                      >
                        Abrir Proyecto
                      </button>
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