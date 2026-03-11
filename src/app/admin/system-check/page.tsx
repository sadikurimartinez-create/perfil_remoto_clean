"use client";

import { useEffect, useState } from "react";

type ServiceStatus = {
  id: string;
  name: string;
  status: "ok" | "error";
  latencyMs: number | null;
  errorMessage?: string;
};

type HealthResponse = {
  timestamp: string;
  services: ServiceStatus[];
};

export default function SystemCheckPage() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runCheck = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/health-check", { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const json = (await res.json()) as HealthResponse;
      setData(json);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo ejecutar el diagnóstico."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void runCheck();
  }, []);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-100">
          Panel de Diagnóstico de APIs
        </h1>
        <p className="text-sm text-slate-400 max-w-2xl">
          Vista administrativa para verificar el estado en tiempo real de las
          APIs críticas de la plataforma de Perfilación Criminológica Ambiental.
        </p>
      </header>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={runCheck}
          disabled={loading}
          className="btn-primary"
        >
          {loading ? "Ejecutando diagnóstico..." : "Ejecutar Diagnóstico Completo"}
        </button>
        {data && (
          <p className="text-xs text-slate-500">
            Última ejecución:{" "}
            <span className="font-mono">
              {new Date(data.timestamp).toLocaleString()}
            </span>
          </p>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-300 bg-red-950/40 border border-red-700 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        {data?.services.map((svc) => {
          const isOk = svc.status === "ok";
          return (
            <article
              key={svc.id}
              className="card p-4 flex flex-col gap-2 border border-slate-800"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-100">
                  {svc.name}
                </h2>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                    isOk
                      ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/40"
                      : "bg-red-500/10 text-red-300 border border-red-500/40"
                  }`}
                >
                  {isOk ? "🟢 En línea" : "🔴 Falla"}
                </span>
              </div>
              <div className="text-xs text-slate-400 space-y-1">
                <p>
                  Latencia:{" "}
                  <span className="font-mono">
                    {svc.latencyMs != null ? `${svc.latencyMs} ms` : "N/D"}
                  </span>
                </p>
                {svc.errorMessage && (
                  <p className="text-red-300">
                    Error:{" "}
                    <span className="font-mono break-all">
                      {svc.errorMessage}
                    </span>
                  </p>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}

