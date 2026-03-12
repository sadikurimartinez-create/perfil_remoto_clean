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

async function ensureSeedUsers() {
  const count = await db.users.count();
  if (count > 0) return;

  const seedUsers: Omit<UserRow, "id">[] = [
    {
      username: "admin",
      passwordHash: "Admin2026!",
      role: "ADMIN",
      name: "Administrador General",
    },
    {
      username: "analista1",
      passwordHash: "Analista2026!",
      role: "USER",
      name: "Analista 1",
    },
  ];

  await db.users.bulkAdd(seedUsers);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await ensureSeedUsers();
        const stored = typeof window !== "undefined"
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
      const found = await db.users
        .where("username")
        .equals(username)
        .first();
      if (!found || found.passwordHash !== password) {
        throw new Error("Usuario o contraseña incorrectos");
      }
      const authUser: AuthUser = {
        id: found.id as number,
        username: found.username,
        role: found.role,
        name: found.name,
      };
      window.localStorage.setItem(
        "perfilador.currentUser",
        JSON.stringify(authUser)
      );
      setUser(authUser);
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

