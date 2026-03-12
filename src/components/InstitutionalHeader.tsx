"use client";

import Image from "next/image";
import { useAuth } from "@/context/AuthContext";

export function InstitutionalHeader() {
  const { user, logout } = useAuth();

  return (
    <header className="w-full border-b border-slate-800 bg-slate-950/95">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex flex-shrink-0 items-center gap-2">
          <Image
            src="/logos/logo-ceipol.png"
            alt="Centro Estatal de Estudios y Política Criminal"
            width={56}
            height={56}
            className="h-12 w-12 object-contain sm:h-14 sm:w-14"
            unoptimized
          />
        </div>
        <div className="flex flex-1 flex-col items-center justify-center text-center min-w-0">
          <h1 className="text-lg font-bold tracking-tight text-slate-100 sm:text-xl">
            PERFILADOR REMOTO
          </h1>
          <p className="text-[10px] font-medium text-slate-300 sm:text-xs mt-0.5">
            Centro de Estudios y Política Criminal
          </p>
          <p className="text-[10px] text-slate-400 sm:text-xs">
            Secretaría de Seguridad Pública del Estado de Aguascalientes
          </p>
        </div>
        <div className="flex-shrink-0 flex items-center gap-3">
          {user && (
            <button
              type="button"
              onClick={() => void logout()}
              className="text-[11px] sm:text-xs font-medium text-slate-400 hover:text-red-400 transition-colors"
            >
              Cerrar sesión
            </button>
          )}
          <Image
            src="/logos/logo-ssp.png"
            alt="Secretaría de Seguridad Pública - Policía Estatal"
            width={56}
            height={56}
            className="h-12 w-12 object-contain sm:h-14 sm:w-14"
            unoptimized
          />
        </div>
      </div>
    </header>
  );
}
