import Dexie, { Table } from "dexie";

/**
 * Base de datos local (IndexedDB vía Dexie) para Memoria y Gestión de Expedientes.
 * projects: id, name, createdAt
 * photos: id, projectId, imageBlob (Blob), tag, comments, lat, lng, timestamp
 */
export type ProjectRow = {
  id: string;
  name: string;
  createdAt: number;
};

export type PhotoRow = {
  id: string;
  projectId: string;
  imageBlob: Blob;
  tag: string;
  comments: string;
  lat: number;
  lng: number;
  timestamp: number;
};

export type AnalysisRow = {
  id?: number;
  projectId: string;
  content: string;
  createdAt: number;
};

class LocalPerfiladorDB extends Dexie {
  projects!: Table<ProjectRow, string>;
  photos!: Table<PhotoRow, string>;
  analyses!: Table<AnalysisRow, number>;

  constructor() {
    super("PerfiladorRemotoDB");
    this.version(1).stores({
      projects: "id, name, createdAt",
      photos: "id, projectId, timestamp",
    });
    this.version(2).stores({
      projects: "id, name, createdAt",
      photos: "id, projectId, timestamp",
      analyses: "++id, projectId, createdAt",
    });
  }
}

export const db = new LocalPerfiladorDB();

