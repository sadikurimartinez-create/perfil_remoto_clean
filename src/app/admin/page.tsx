"use client";

import { useState, FormEvent } from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

export default function AdminPage() {
  const { user } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);

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
    await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: username.trim(),
        password: password,
        name: name.trim(),
      }),
    });
    setUsername("");
    setPassword("");
    setName("");
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
          Alta de analistas (rol USER)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] text-slate-300 mb-1">
              Nombre completo
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
            <div className="relative w-full">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 pr-9 text-xs text-slate-100"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 hover:text-white"
              >
                {showPassword ? "Ocultar" : "Ver"}
              </button>
            </div>
          </div>
        </div>
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
        >
          Registrar Analista
        </button>
      </form>

    </div>
  );
}

