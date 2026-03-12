import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";

export type NearbyCrime = {
  lat: number;
  lng: number;
  tipo: string;
  fuente: string;
};

function toNumber(value: unknown): number | null {
  const n = typeof value === "string" ? parseFloat(value) : Number(value);
  return Number.isFinite(n) ? n : null;
}

function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function getNearbyCrimes(
  lat: number,
  lng: number,
  radiusMeters: number
): Promise<NearbyCrime[]> {
  const baseDir = path.join(process.cwd(), "incidencia_delictiva");

  let entries: fs.Dirent[];
  try {
    entries = await fs.readdir(baseDir, { withFileTypes: true });
  } catch {
    // Carpeta inexistente o inaccesible: no interrumpir el análisis.
    return [];
  }

  const allCrimes: NearbyCrime[] = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.toLowerCase().endsWith(".csv")) continue;

    const filePath = path.join(baseDir, entry.name);
    let content: string;
    try {
      content = await fs.readFile(filePath, "utf8");
    } catch {
      continue;
    }

    let rows: any[];
    try {
      rows = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as any[];
    } catch {
      continue;
    }

    const baseTipo = path.basename(entry.name).replace(/\.csv$/i, "");

    for (const row of rows) {
      const latVal =
        row.LAT ?? row.lat ?? row.latitude ?? row.Lat ?? row.Latitude;
      const lngVal =
        row.LONG ?? row.long ?? row.longitude ?? row.Long ?? row.Longitude;
      const latNum = toNumber(latVal);
      const lngNum = toNumber(lngVal);
      if (latNum == null || lngNum == null) continue;

      const tipoRaw = row.INCIDENTE ?? row.incidente ?? baseTipo;
      const tipo = String(tipoRaw || baseTipo);

      allCrimes.push({
        lat: latNum,
        lng: lngNum,
        tipo,
        fuente: entry.name,
      });
    }
  }

  if (allCrimes.length === 0) return [];

  return allCrimes.filter(
    (c) => haversineMeters(lat, lng, c.lat, c.lng) <= radiusMeters
  );
}

