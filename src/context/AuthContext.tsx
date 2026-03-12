"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { db, type UserRow } from "@/lib/localDb";

type AuthUser = {
  id: number;
  username: string;
  role: "ADMIN" | "USER";
  name: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored =
          typeof window !== "undefined"
            ? window.localStorage.getItem("perfilador.currentUser")
            : null;
        if (stored) {
          const parsed = JSON.parse(stored) as AuthUser;
          if (!cancelled) setUser(parsed);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (username: string, password: string) => {
    setLoading(true);
    try {
      // Fallback local para el piloto (sin depender de PostgreSQL)
      if (username === "admin" && password === "Admin2026!") {
        const data: AuthUser = {
          id: 1,
          username: "admin",
          role: "ADMIN",
          name: "Administrador General",
        };
        window.localStorage.setItem(
          "perfilador.currentUser",
          JSON.stringify(data)
        );
        setUser(data);
        router.push("/");
        return;
      }
      if (username === "analista1" && password === "Analista2026!") {
        const data: AuthUser = {
          id: 2,
          username: "analista1",
          role: "USER",
          name: "Analista 1",
        };
        window.localStorage.setItem(
          "perfilador.currentUser",
          JSON.stringify(data)
        );
        setUser(data);
        router.push("/");
        return;
      }

      // Si en el futuro configuramos un backend real, se puede reactivar:
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Usuario o contraseña incorrectos");
      }
      const data = (await res.json()) as AuthUser;
      window.localStorage.setItem(
        "perfilador.currentUser",
        JSON.stringify(data)
      );
      setUser(data);
      router.push("/");
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    window.localStorage.removeItem("perfilador.currentUser");
    setUser(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth debe usarse dentro de AuthProvider");
  }
  return ctx;
}

