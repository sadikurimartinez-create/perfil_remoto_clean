"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, where } from "firebase/firestore";
import { getDb } from "@/lib/firebase";

type AuthUser = {
  id: number | string;
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

      // Usuarios creados por el admin en Firestore
      const db = getDb();
      const q = query(
        collection(db, "users"),
        where("username", "==", username.trim())
      );
      const snap = await getDocs(q);
      const docSnap = snap.docs[0];
      if (docSnap) {
        const data = docSnap.data() as { passwordHash?: string; role?: string; name?: string };
        if (data.passwordHash === password) {
          const authUser: AuthUser = {
            id: docSnap.id,
            username: username.trim(),
            role: (data.role as "USER") || "USER",
            name: (data.name as string) || username.trim(),
          };
          window.localStorage.setItem(
            "perfilador.currentUser",
            JSON.stringify(authUser)
          );
          setUser(authUser);
          router.push("/");
          return;
        }
      }

      throw new Error("Usuario o contraseña incorrectos");
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

