"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/localDb";
import { getDb } from "@/lib/firebase";

export const TIPOS_IMAGEN = [
  "Terrenos baldíos / Caminos sobre terrenos en breña",
  "Viviendas deshabitadas y paracaidistas / Viviendas quemadas",
  "Escuelas / Templos de culto",
  "Bancos y/o cajeros automáticos / Casas de cambio",
  "Gasolineras / Oxxo / Farmacias 24 hrs. / Moteles",
  "Expendios de alcohol / Bares, antros y merenderos / Billares",
  "Terminales de transporte público",
  "Gimnasios",
  "Chatarreras / Casa de empeño / Compra y venta de celulares",
  "Locales de máquinas tragamonedas",
  "Negocios no registrados (Talleres, Barberías, Venta de ropa tipo cholo, Gestorías)",
  "Tianguis / Puestos ambulantes / Puestos de bebidas preparadas / Ventas de dulces / Negocios de suplementos",
  "Picaderos / Anexos y centros de rehabilitación",
  "Alojamiento de personas en situación de calle / Loncherías (cachimbas)",
  "Autobuses y transporte pesado en calles",
  "Otro; ventana para contextualizar"
] as const;

export type TipoImagen = (typeof TIPOS_IMAGEN)[number];

export type AlbumPhoto = {
  id: string;
  previewUrl: string;
  lat: number | null;
  lng: number | null;
  tipo: string;
  comentario: string;
  file?: File;
};

export type Project = {
  id: string;
  nombre: string;
};

export type PerPhotoFinding = {
  photoId: string;
  visionLabels?: string[];
  lugaresCercanos?: unknown[];
};

export type AnalysisResult = {
  perPhotoFindings?: PerPhotoFinding[];
  unifiedProfile?: string;
  heatmapData?: Array<{ lat: number; lng: number; weight?: number }>;
  historicalCrimes?: Array<{
    lat: number;
    lng: number;
    tipoDelito: string;
    rangoHorario: string | null;
  }>;
  pois?: Array<{ lat: number; lng: number; name: string; category?: string }>;
  raw?: unknown;
};

type ProjectContextValue = {
  project: Project | null;
  album: AlbumPhoto[];
  selectedIds: string[];
  analysisResult: AnalysisResult | null;
  createProject: (nombre: string) => void;
  closeProject: () => void;
  loadProject: (projectId: string) => Promise<void>;
  addPhotoToAlbum: (photo: Omit<AlbumPhoto, "id">, id?: string) => void;
  removePhotoFromAlbum: (id: string) => void;
  updatePhotoMeta: (id: string, meta: { tipo: string; comentario: string }) => void;
  togglePhotoSelection: (id: string) => void;
  selectAllPhotos: () => void;
  clearSelection: () => void;
  setAnalysisResult: (result: AnalysisResult | null) => void;
};

const ProjectContext = createContext<ProjectContextValue | null>(null);

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [project, setProject] = useState<Project | null>(null);
  const [album, setAlbum] = useState<AlbumPhoto[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [analysisResult, setAnalysisResultState] = useState<AnalysisResult | null>(null);

  const createProject = useCallback((nombre: string) => {
    setProject({ id: generateId(), nombre: nombre.trim() || "Sin nombre" });
    setAlbum([]);
    setSelectedIds([]);
    setAnalysisResultState(null);
  }, []);

  const closeProject = useCallback(() => {
    setProject(null);
    setAlbum([]);
    setSelectedIds([]);
    setAnalysisResultState(null);
  }, []);

  const loadProject = useCallback(async (projectId: string) => {
    let projectRow = await db.projects.get(projectId);
    if (!projectRow) {
      const firestore = getDb();
      const ref = doc(firestore, "projects", projectId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const data = snap.data() as { name?: string; createdAt?: number; createdBy?: string };
      const name = data.name ?? "Sin nombre";
      projectRow = { id: projectId, name, createdAt: data.createdAt ?? Date.now(), createdBy: data.createdBy };
      await db.projects.put({ ...projectRow, lockedBy: null });
    }
    const photoRows = await db.photos.where("projectId").equals(projectId).toArray();
    const albumPhotos: AlbumPhoto[] = photoRows
      .filter(
        (p) =>
          p.lat != null &&
          p.lng != null &&
          !Number.isNaN(p.lat) &&
          !Number.isNaN(p.lng)
      )
      .map((p) => ({
        id: p.id,
        previewUrl: URL.createObjectURL(p.imageBlob),
        lat: p.lat,
        lng: p.lng,
        tipo: p.tag,
        comentario: p.comments,
        file: new File([p.imageBlob], "photo.jpg", { type: p.imageBlob.type }),
      }));
    setProject({ id: projectRow.id, nombre: projectRow.name });
    setAlbum(albumPhotos);
    setSelectedIds([]);
    setAnalysisResultState(null);
  }, []);

  const addPhotoToAlbum = useCallback(
    (photo: Omit<AlbumPhoto, "id">, id?: string) => {
      if (
        photo.lat == null ||
        photo.lng == null ||
        Number.isNaN(photo.lat) ||
        Number.isNaN(photo.lng)
      ) {
        console.warn(
          "[ProjectContext] Intento de agregar foto sin coordenadas; se descarta."
        );
        return;
      }
      setAlbum((prev) => [...prev, { ...photo, id: id ?? generateId() }]);
    },
    []
  );

  const removePhotoFromAlbum = useCallback((id: string) => {
    setAlbum((prev) => prev.filter((p) => p.id !== id));
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  }, []);

  const updatePhotoMeta = useCallback((id: string, meta: { tipo: string; comentario: string }) => {
    setAlbum((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...meta } : p))
    );
  }, []);

  const togglePhotoSelection = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const selectAllPhotos = useCallback(() => {
    setAlbum((prev) => {
      setSelectedIds(prev.map((p) => p.id));
      return prev;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds([]), []);

  const setAnalysisResult = useCallback((result: AnalysisResult | null) => {
    setAnalysisResultState(result);
  }, []);

  const value = useMemo<ProjectContextValue>(
    () => ({
      project,
      album,
      selectedIds,
      analysisResult,
      createProject,
      closeProject,
      loadProject,
      addPhotoToAlbum,
      removePhotoFromAlbum,
      updatePhotoMeta,
      togglePhotoSelection,
      selectAllPhotos,
      clearSelection,
      setAnalysisResult
    }),
    [
      project,
      album,
      selectedIds,
      analysisResult,
      createProject,
      closeProject,
      loadProject,
      addPhotoToAlbum,
      removePhotoFromAlbum,
      updatePhotoMeta,
      togglePhotoSelection,
      selectAllPhotos,
      clearSelection,
      setAnalysisResult
    ]
  );

  return (
    <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
  );
}

export function useProject(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProject debe usarse dentro de ProjectProvider");
  return ctx;
}
