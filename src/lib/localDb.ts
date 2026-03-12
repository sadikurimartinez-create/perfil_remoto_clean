import Dexie, { Table } from "dexie";

export type ProjectRow = {
  id: string;
  name: string;
  createdAt: number;
  createdBy?: string;
  lockedBy?: string | null;
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
  createdBy?: string;
};

export type UserRow = {
  id?: number;
  username: string;
  passwordHash: string;
  role: "ADMIN" | "USER";
  name: string;
};

class LocalPerfiladorDB extends Dexie {
  projects!: Table<ProjectRow, string>;
  photos!: Table<PhotoRow, string>;
  analyses!: Table<AnalysisRow, number>;
  users!: Table<UserRow, number>;

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
    this.version(3).stores({
      projects: "id, name, createdAt, createdBy, lockedBy",
      photos: "id, projectId, timestamp",
      analyses: "++id, projectId, createdAt, createdBy",
      users: "++id, username, role",
    });
  }
}

export const db = new LocalPerfiladorDB();

