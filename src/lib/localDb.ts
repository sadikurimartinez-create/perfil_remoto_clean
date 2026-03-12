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

class LocalPerfiladorDB extends Dexie {
  projects!: Table<ProjectRow, string>;
  photos!: Table<PhotoRow, string>;

  constructor() {
    super("PerfiladorRemotoDB");
    this.version(1).stores({
      projects: "id, name, createdAt",
      photos: "id, projectId, timestamp",
    });
  }
}

export const db = new LocalPerfiladorDB();

