import { NextResponse } from "next/server";
import { analyzeBrokenWindowsWithVision } from "@/lib/googleVision";
import { searchPlacesAround } from "@/lib/googlePlaces";
import { searchDenueAround } from "@/lib/denueInegi";
import {
  buildConflictPoints,
  buildIrregularBusinesses
} from "@/lib/environmentProfile";
import { getPool } from "@/lib/db";

type PhotoPayload = {
  id: string;
  lat: number | null;
  lng: number | null;
  tipo: string;
  comentario: string;
  imageBase64?: string;
};

type RequestBody = {
  photos: PhotoPayload[];
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;
    const { photos } = body;

    if (!Array.isArray(photos) || photos.length === 0) {
      return NextResponse.json(
        { error: "Se requiere un array 'photos' con al menos un elemento." },
        { status: 400 }
      );
    }

    const photosWithCoords = photos.filter(
      (p) =>
        p.lat != null &&
        p.lng != null &&
        !Number.isNaN(p.lat) &&
        !Number.isNaN(p.lng)
    );
    if (photosWithCoords.length === 0) {
      return NextResponse.json(
        { error: "Ninguna foto tiene coordenadas GPS válidas para el análisis." },
        { status: 400 }
      );
    }

    const radiusMeters = 500;
    const centerLat =
      photosWithCoords.reduce((a, p) => a + (p.lat as number), 0) /
      photosWithCoords.length;
    const centerLng =
      photosWithCoords.reduce((a, p) => a + (p.lng as number), 0) /
      photosWithCoords.length;

    const visionPromises = photos.map(async (p) => {
      if (!p.imageBase64)
        return { photoId: p.id, visionLabels: [] as string[], raw: null };
      const result = await analyzeBrokenWindowsWithVision({
        imageBase64: p.imageBase64
      }).catch((err) => {
        console.error(
          "[api/analyze-selection] Vision error detallado para foto",
          p.id,
          err
        );
        return null;
      });
      const labels = result?.etiquetasRelevantes ?? [];
      return {
        photoId: p.id,
        visionLabels: labels,
        raw: result
      };
    });

    const [placesResult, denueResult] = await Promise.all([
      searchPlacesAround(centerLat, centerLng, radiusMeters).catch(() => null),
      searchDenueAround(centerLat, centerLng, radiusMeters).catch(() => null)
    ]);

    // Incidencia histórica en el radio alrededor del clúster de fotos
    let delitosCercanos: any[] = [];
    try {
      const { rows } = await getPool().query(
        `
        SELECT
          incidente,
          rango_horario,
          ST_Y(geometria::geometry) AS lat,
          ST_X(geometria::geometry) AS lng
        FROM incidencia_estadistica
        WHERE ST_DWithin(
          geometria,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          $3
        )
      `,
        [centerLng, centerLat, radiusMeters]
      );
      delitosCercanos = rows;
    } catch (err) {
      console.error(
        "[api/analyze-selection] Error en consulta histórica (se continúa sin capa de incidencia):",
        err
      );
      delitosCercanos = [];
    }

    const resumenPorDelito = new Map<string, number>();
    const resumenPorRango = new Map<string, number>();

    for (const row of delitosCercanos) {
      const tipo = row.incidente as string;
      const rango = (row.rango_horario as string) ?? "Sin rango definido";
      resumenPorDelito.set(tipo, (resumenPorDelito.get(tipo) ?? 0) + 1);
      resumenPorRango.set(rango, (resumenPorRango.get(rango) ?? 0) + 1);
    }

    const totalDelitos = delitosCercanos.length;

    const resumenTextoDelitos =
      totalDelitos === 0
        ? "En el radio analizado no se registran incidentes históricos en la base de incidencia_estadistica."
        : `En un radio de ${radiusMeters} m alrededor de las evidencias se registran ${totalDelitos} incidentes históricos: ` +
          Array.from(resumenPorDelito.entries())
            .map(([tipo, n]) => `${n} × ${tipo}`)
            .join(", ") +
          ". Los rangos horarios predominantes son: " +
          Array.from(resumenPorRango.entries())
            .map(([rango, n]) => `${n} × ${rango}`)
            .join(", ") +
          ".";

    const perPhotoFindings = await Promise.all(visionPromises);

    const comerciosIrregulares = buildIrregularBusinesses(placesResult, denueResult);
    const atractoresDelito = buildConflictPoints(placesResult, 100);

    const comentariosTexto = photos
      .map((p) => `[${p.tipo}] ${p.comentario || "(sin comentario)"}`)
      .join("\n");
    const visionResumen = perPhotoFindings
      .map((f) => f.visionLabels?.join(", ") ?? "—")
      .join(" | ");
    const irregularesResumen =
      comerciosIrregulares.posiblesIrregulares.length > 0
        ? `Comercios posibles irregulares: ${comerciosIrregulares.posiblesIrregulares.map((i) => i.lugarGoogle.nombre).join("; ")}.`
        : "";
    const conflictosResumen =
      atractoresDelito.puntosConflictoEscuelaAlcohol.length > 0
        ? atractoresDelito.resumen
        : "";

    const unifiedProfile = [
      "Perfil criminológico ambiental (selección):",
      "",
      "Comentarios del investigador:",
      comentariosTexto,
      "",
      "Indicadores Vision (Ventanas Rotas):",
      visionResumen || "Sin datos de visión.",
      "",
      irregularesResumen,
      conflictosResumen,
      "",
      "Estadística histórica de incidencia en el área:",
      resumenTextoDelitos
    ]
      .filter(Boolean)
      .join("\n");

    const heatmapData = photos.map((p) => ({
      lat: p.lat,
      lng: p.lng,
      weight: 1
    }));

    const historicalCrimes = delitosCercanos.map((row: any) => ({
      lat: Number(row.lat),
      lng: Number(row.lng),
      tipoDelito: row.incidente as string,
      rangoHorario: (row.rango_horario as string) ?? null
    }));

    return NextResponse.json(
      {
        perPhotoFindings,
        unifiedProfile,
        heatmapData,
        historicalCrimes,
        raw: {
          atractoresDelito,
          comerciosIrregulares
        }
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[api/analyze-selection] Error:", error);
    return NextResponse.json(
      { error: "Error interno al analizar la selección." },
      { status: 500 }
    );
  }
}
