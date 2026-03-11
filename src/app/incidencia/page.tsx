"use client";

import { useState } from "react";

export default function IncidenciaUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setStatus(null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    setError(null);

    if (!file) {
      setError("Seleccione un archivo CSV de incidencia.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setIsUploading(true);
      const res = await fetch("/api/upload-csv", {
        method: "POST",
        body: formData,
      });

      const json = (await res.json()) as { ok?: boolean; registros?: number; error?: string };

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Error al subir el archivo.");
      }

      setStatus(
        `Archivo procesado correctamente. Registros leídos: ${json.registros ?? "desconocido"}.`
      );
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error al subir el CSV de incidencia."
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-xl md:text-2xl font-bold tracking-tight text-slate-100">
          Carga de Incidencia Delictiva (CSV)
        </h2>
        <p className="text-sm text-slate-400 max-w-2xl">
          Utilice este formulario para subir archivos CSV históricos de incidencia.
          Cada archivo debe contener las columnas: INCIDENTE, FECHA, HORA, RANGO,
          NOM_ASEN, LAT y LONG.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="card p-5 space-y-4 max-w-xl"
      >
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-200">
            Archivo CSV de incidencia
          </label>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="block w-full text-sm text-slate-100
                       file:mr-3 file:rounded-md file:border-0 file:bg-sky-500 file:px-3 file:py-1.5
                       file:text-xs file:font-medium file:text-slate-950
                       hover:file:bg-sky-400
                       bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5"
          />
          <p className="text-xs text-slate-500">
            Ejemplo: "Autopartes &amp; Cristalazo.csv". Máximo recomendable: unos cientos
            de miles de filas por archivo.
          </p>
        </div>

        <button
          type="submit"
          disabled={isUploading || !file}
          className="btn-primary"
        >
          {isUploading ? "Subiendo y procesando..." : "Subir CSV"}
        </button>

        {status && (
          <p className="text-sm text-emerald-300 bg-emerald-950/40 border border-emerald-700 rounded-lg px-3 py-2">
            {status}
          </p>
        )}

        {error && (
          <p className="text-sm text-red-300 bg-red-950/40 border border-red-700 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
      </form>

      <section className="text-xs text-slate-500 max-w-xl space-y-1">
        <p>
          Los registros válidos se insertarán en la tabla{" "}
          <code className="text-slate-300">incidencia_estadistica</code> de la base
          de datos PostGIS, utilizando la latitud y longitud para crear la
          geometría geográfica.
        </p>
        <p>
          Asegúrese de que la variable{" "}
          <code className="text-slate-300">DATABASE_URL</code> esté configurada en
          el archivo <code className="text-slate-300">.env.local</code> para que la
          conexión a PostgreSQL funcione correctamente.
        </p>
      </section>
    </div>
  );
}

