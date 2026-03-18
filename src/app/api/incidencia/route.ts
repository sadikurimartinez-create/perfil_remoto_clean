import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";

export const runtime = "nodejs";

type IncidenciaRequestBody = {
  lat?: number;
  lng?: number;
};

function toFiniteNumber(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

// Haversine: distancia en metros entre dos coordenadas GPS
function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000; // radio Tierra (m)
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function pickExistingDir(...candidates: string[]) {
  for (const dir of candidates) {
    try {
      if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) return dir;
    } catch {
      // ignore
    }
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as IncidenciaRequestBody;
    const lat = toFiniteNumber(body.lat);
    const lng = toFiniteNumber(body.lng);

    if (lat == null || lng == null) {
      return NextResponse.json(
        { success: false, error: "Se requieren lat y lng válidos." },
        { status: 400 }
      );
    }

    const projectRoot = process.cwd();
    const incidenciaDir =
      pickExistingDir(
        path.join(projectRoot, "Incidencia criminal"),
        path.join(projectRoot, "Incidencia Delictiva")
      ) ?? "";

    const bibliografiaDir =
      pickExistingDir(
        path.join(projectRoot, "Bibliografía"),
        path.join(projectRoot, "Bibliografia")
      ) ?? "";

    // Procesamiento de incidencia: parsea todos los CSV y filtra por radio 1km
    let delitosCercanos: any[] = [];
    try {
      if (!incidenciaDir) throw new Error("Carpeta de incidencia no encontrada.");
      const files = fs.readdirSync(incidenciaDir, { withFileTypes: true });
      const csvFiles = files
        .filter((f) => f.isFile() && f.name.toLowerCase().endsWith(".csv"))
        .map((f) => path.join(incidenciaDir, f.name));

      for (const filePath of csvFiles) {
        const fileName = path.basename(filePath);
        const csvText = fs.readFileSync(filePath, "utf8");
        const parsed = Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
        });

        const rows = (parsed.data ?? []) as any[];
        for (const row of rows) {
          const latRow = toFiniteNumber(row.LAT ?? row.lat ?? row.Lat);
          const lngRow = toFiniteNumber(row.LONG ?? row.lng ?? row.lng1 ?? row.Long);
          if (latRow == null || lngRow == null) continue;

          const dist = haversineMeters(lat, lng, latRow, lngRow);
          if (dist <= 1000) {
            delitosCercanos.push({
              ...row,
              lat: latRow,
              lng: lngRow,
              distancia_m: dist,
              fuente: fileName,
            });
          }
        }
      }
    } catch (err) {
      console.error("[api/incidencia] Error procesando incidencia CSV:", err);
      delitosCercanos = [];
    }

    // Procesamiento de bibliografía: concatena todo el texto de archivos .md/.txt
    let contextoBibliografico = "";
    try {
      if (!bibliografiaDir) throw new Error("Carpeta de bibliografía no encontrada.");
      const entries = fs.readdirSync(bibliografiaDir, { withFileTypes: true });
      const textos: string[] = [];

      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const ext = path.extname(entry.name).toLowerCase();
        if (ext !== ".md" && ext !== ".txt") continue;
        const filePath = path.join(bibliografiaDir, entry.name);
        const content = fs.readFileSync(filePath, "utf8");
        textos.push(`---\nFuente: ${entry.name}\n${content}`);
      }

      contextoBibliografico = textos.join("\n\n");
    } catch (err) {
      console.warn(
        "[api/incidencia] No se pudo leer la carpeta Bibliografía:",
        err
      );
      contextoBibliografico = "";
    }

    return NextResponse.json({
      success: true,
      data: delitosCercanos,
      bibliografia: contextoBibliografico,
    });
  } catch (err) {
    console.error("[api/incidencia] Error inesperado:", err);
    return NextResponse.json(
      { success: false, error: "Error interno en /api/incidencia." },
      { status: 500 }
    );
  }
}

