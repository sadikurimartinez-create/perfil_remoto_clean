"use client";

import { useState, FormEvent } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type UserRow } from "@/lib/localDb";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

export default function AdminPage() {
  const { user } = useAuth();
  const users = useLiveQuery(async () => db.users.toArray(), []);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"ADMIN" | "USER">("USER");

  if (!user || user.role !== "ADMIN") {
    return (
      <div className="card p-6 text-center space-y-3">
        <p className="text-sm text-red-400 font-semibold">
          Acceso restringido. Solo el ADMIN puede gestionar usuarios.
        </p>
        <Link
          href="/"
          className="inline-block text-xs text-sky-400 hover:text-sky-300"
        >
          Volver al inicio
        </Link>
      </div>
    );
  }

  const handleAddUser = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim() || !name.trim()) return;
    const row: Omit<UserRow, "id"> = {
      username: username.trim(),
      passwordHash: password,
      role,
      name: name.trim(),
    };
    await db.users.add(row);
    setUsername("");
    setPassword("");
    setName("");
    setRole("USER");
  };

  const handleDeleteUser = async (id?: number) => {
    if (!id) return;
    if (!confirm("¿Eliminar este usuario?")) return;
    await db.users.delete(id);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100">
            Administración de usuarios
          </h2>
          <p className="text-xs text-slate-400">
            Solo disponible para el rol ADMIN.
          </p>
        </div>
        <Link
          href="/"
          className="text-xs text-sky-400 hover:text-sky-300 underline underline-offset-2"
        >
          Volver a Mis Expedientes
        </Link>
      </div>

      <form
        onSubmit={handleAddUser}
        className="card p-4 space-y-3 border border-slate-800"
      >
        <h3 className="text-sm font-semibold text-slate-100">
          Crear nuevo usuario
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] text-slate-300 mb-1">
              Usuario
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-300 mb-1">
              Contraseña
            </label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-300 mb-1">
              Nombre
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-300 mb-1">
              Rol
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "ADMIN" | "USER")}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
            >
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </div>
        </div>
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
        >
          Guardar usuario
        </button>
      </form>

      <div className="card p-4 border border-slate-800">
        <h3 className="text-sm font-semibold text-slate-100 mb-2">
          Usuarios registrados
        </h3>
        <ul className="space-y-1 text-xs text-slate-200">
          {(users ?? []).map((u) => (
            <li
              key={u.id}
              className="flex items-center justify-between rounded border border-slate-800 bg-slate-900/60 px-3 py-1.5"
            >
              <div>
                <p className="font-medium">
                  {u.username}{" "}
                  <span className="ml-1 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                    {u.role}
                  </span>
                </p>
                <p className="text-[11px] text-slate-400">{u.name}</p>
              </div>
              <button
                type="button"
                onClick={() => handleDeleteUser(u.id)}
                className="text-[11px] text-red-400 hover:text-red-300"
              >
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

