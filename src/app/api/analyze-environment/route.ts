import { NextResponse } from "next/server";
import { analyzeBrokenWindowsWithVision } from "@/lib/googleVision";
import { searchPlacesAround } from "@/lib/googlePlaces";
import { searchDenueAround } from "@/lib/denueInegi";
import { analyzeEscapeRoutes } from "@/lib/googleRoutes";
import { getStreetViewComparison } from "@/lib/googleStreetView";
import {
  buildConflictPoints,
  buildIrregularBusinesses,
  type EnvironmentProfile
} from "@/lib/environmentProfile";

type AnalyzeEnvironmentRequest = {
  lat: number;
  lng: number;
  /**
   * Radio de análisis en metros (por defecto 250m).
   */
  radiusMeters?: number;
  /**
   * Imagen en base64 (sin prefijo data:) para enviar a Vision.
   * Opcional: si se omite, el análisis de visión no se ejecutará.
   */
  imageBase64?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as AnalyzeEnvironmentRequest;
    const { lat, lng, radiusMeters = 250, imageBase64 } = body;

    if (
      typeof lat !== "number" ||
      Number.isNaN(lat) ||
      typeof lng !== "number" ||
      Number.isNaN(lng)
    ) {
      return NextResponse.json(
        { error: "Parámetros lat y lng numéricos son obligatorios." },
        { status: 400 }
      );
    }

    // Llamadas concurrentes a las APIs externas
    const [
      visionResult,
      placesResult,
      denueResult,
      routesResult
    ] = await Promise.all([
      imageBase64
        ? analyzeBrokenWindowsWithVision({ imageBase64 }).catch((e) => {
            console.error("[api/analyze-environment] Vision error:", e);
            return null;
          })
        : Promise.resolve(null),
      searchPlacesAround(lat, lng, radiusMeters).catch((e) => {
        console.error("[api/analyze-environment] Places error:", e);
        return null;
      }),
      searchDenueAround(lat, lng, radiusMeters).catch((e) => {
        console.error("[api/analyze-environment] DENUE error:", e);
        return null;
      }),
      analyzeEscapeRoutes(lat, lng).catch((e) => {
        console.error("[api/analyze-environment] Routes error:", e);
        return null;
      })
    ]);

    const streetViewComparison = getStreetViewComparison(lat, lng);

    const deterioroFisico: EnvironmentProfile["deterioroFisico"] = {
      vision: visionResult ?? undefined,
      comparacionStreetView: streetViewComparison
    };

    const comerciosIrregulares = buildIrregularBusinesses(
      placesResult,
      denueResult
    );

    const atractoresDelito = buildConflictPoints(placesResult, 100); // 100m como referencia normativa inicial

    const analisisRutas = routesResult;

    const resultado: EnvironmentProfile = {
      deterioroFisico,
      comerciosIrregulares,
      atractoresDelito,
      analisisRutas
    };

    return NextResponse.json(resultado, { status: 200 });
  } catch (error) {
    console.error("[api/analyze-environment] Error inesperado:", error);
    return NextResponse.json(
      { error: "Error interno al analizar el entorno." },
      { status: 500 }
    );
  }
}

