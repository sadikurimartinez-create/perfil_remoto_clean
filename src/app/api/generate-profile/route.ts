import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { analyzeBrokenWindowsWithVision } from "@/lib/googleVision";
import { searchPlacesAround } from "@/lib/googlePlaces";
import { searchDenueAround } from "@/lib/denueInegi";
import { buildIrregularBusinesses } from "@/lib/environmentProfile";
import { getStreetViewComparison } from "@/lib/googleStreetView";
import { getPool } from "@/lib/db";
import { buildStrategiesSummaryForTags } from "@/lib/tagStrategies";

type PhotoInput = {
  id: string;
  lat: number;
  lng: number;
  tipo: string;
  comentario: string;
  imageBase64?: string;
};

type GenerateProfileBody = {
  photos: PhotoInput[];
};

type GeocodingResult = {
  formattedAddress: string | null;
  colonia: string | null;
};

type HistoricalSummary = {
  total: number;
  porDelito: Array<{ tipo: string; cantidad: number }>;
  porRango: Array<{ rango: string; cantidad: number }>;
};

async function readBibliographyContext(): Promise<string> {
  try {
    const baseDir = path.join(process.cwd(), "Bibliografía");
    const entries = await fs.readdir(baseDir, { withFileTypes: true });

    const textos: string[] = [];

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (ext !== ".md" && ext !== ".txt") continue;

      const filePath = path.join(baseDir, entry.name);
      const content = await fs.readFile(filePath, "utf8");
      textos.push(`---\nFuente: ${entry.name}\n${content}`);
    }

    return textos.join("\n\n");
  } catch (err) {
    console.warn(
      "[generate-profile] No se pudo leer la carpeta Bibliografía (se continuará sin contexto teórico adicional):",
      err
    );
    return "";
  }
}

function getGeminiModel(bibliographyContext: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Falta la variable de entorno GEMINI_API_KEY.");
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction:
      "Eres un Criminólogo experto en Ecología Ambiental adscrito al Centro de Estudios y Política Criminal. " +
      "Tu tarea es redactar un 'Perfil Criminológico Ambiental' basado en 4 teorías: Actividades Rutinarias, Patrón Delictivo, Elección Racional y Ventanas Rotas. " +
      "Tu lenguaje debe ser técnico, policial y objetivo.\n\n" +
      "Basa tu redacción, terminología y análisis ESTRICTAMENTE en la siguiente bibliografía y manuales de aplicación institucional. " +
      "No inventes teorías que no estén en estos documentos.\n\n" +
      (bibliographyContext || "[No se proporcionó bibliografía adicional.]"),
  });
}

async function reverseGeocode(
  lat: number,
  lng: number
): Promise<GeocodingResult> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    console.warn("[generate-profile] Falta GOOGLE_MAPS_API_KEY para Geocoding.");
    return { formattedAddress: null, colonia: null };
  }

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("latlng", `${lat},${lng}`);
  url.searchParams.set("key", key);

  try {
    const res = await fetch(url.toString());
    if (!res.ok) {
      console.warn("[generate-profile] Geocoding status:", res.status);
      return { formattedAddress: null, colonia: null };
    }
    const json = (await res.json()) as any;
    const result = json.results?.[0];
    if (!result) return { formattedAddress: null, colonia: null };

    const formattedAddress = result.formatted_address ?? null;
    let colonia: string | null = null;
    const components: any[] = result.address_components ?? [];
    for (const c of components) {
      const types: string[] = c.types ?? [];
      if (types.includes("sublocality_level_1")) {
        colonia = c.long_name;
        break;
      }
      if (types.includes("neighborhood") && !colonia) {
        colonia = c.long_name;
      }
    }

    return { formattedAddress, colonia };
  } catch (err) {
    console.error("[generate-profile] Error en Geocoding:", err);
    return { formattedAddress: null, colonia: null };
  }
}

async function getHistoricalSummary(
  centerLat: number,
  centerLng: number,
  radiusMeters: number
): Promise<{ resumen: HistoricalSummary; detalles: any[] }> {
  try {
    const { rows } = await getPool().query(
      `
      SELECT
        incidente,
        rango_horario,
        fecha,
        hora
      FROM incidencia_estadistica
      WHERE ST_DWithin(
        geometria,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
        $3
      )
    `,
      [centerLng, centerLat, radiusMeters]
    );

    const porDelitoMap = new Map<string, number>();
    const porRangoMap = new Map<string, number>();

    for (const row of rows) {
      const tipo = row.incidente as string;
      const rango = (row.rango_horario as string) ?? "Sin rango definido";

      porDelitoMap.set(tipo, (porDelitoMap.get(tipo) ?? 0) + 1);
      porRangoMap.set(rango, (porRangoMap.get(rango) ?? 0) + 1);
    }

    const resumen: HistoricalSummary = {
      total: rows.length,
      porDelito: Array.from(porDelitoMap.entries()).map(([tipo, cantidad]) => ({
        tipo,
        cantidad,
      })),
      porRango: Array.from(porRangoMap.entries()).map(
        ([rango, cantidad]) => ({
          rango,
          cantidad,
        })
      ),
    };

    return { resumen, detalles: rows };
  } catch (err) {
    console.error("[generate-profile] Error en consulta histórica:", err);
    const vacio: HistoricalSummary = { total: 0, porDelito: [], porRango: [] };
    return { resumen: vacio, detalles: [] };
  }
}

function buildPromptForGemini(params: {
  photos: PhotoInput[];
  geocoding: GeocodingResult;
  visionPorFoto: Array<{
    photoId: string;
    etiquetas: string[];
    texto: string[];
  }>;
  irregularidadesTexto: string;
  incidencia: HistoricalSummary;
  streetViewUrl: string | null;
  strategySummary: string;
}): string {
  const {
    photos,
    geocoding,
    visionPorFoto,
    irregularidadesTexto,
    incidencia,
    streetViewUrl,
    strategySummary,
  } = params;

  const comentariosInvestigador = photos
    .map(
      (p) =>
        `- [${p.tipo}] Comentario: ${p.comentario || "(sin comentario)"} ` +
        `Coordenadas: (${p.lat.toFixed(5)}, ${p.lng.toFixed(5)})`
    )
    .join("\n");

  const visionResumen = visionPorFoto
    .map(
      (v) =>
        `Foto ${v.photoId}: Etiquetas Ventanas Rotas: ${
          v.etiquetas.join(", ") || "sin etiquetas relevantes"
        }. Texto detectado: ${
          v.texto.join(" | ") || "sin texto relevante"
        }`
    )
    .join("\n");

  const direccionTexto =
    geocoding.formattedAddress ||
    (geocoding.colonia
      ? `Colonia ${geocoding.colonia} (dirección aproximada no disponible)`
      : "Dirección no disponible (solo coordenadas GPS).");

  const incidenciaTexto =
    incidencia.total === 0
      ? "En un radio de 500 metros no se registran incidentes históricos en la base de incidencia."
      : `En un radio de 500 metros se registran ${incidencia.total} incidentes históricos. ` +
        `Por tipo: ${incidencia.porDelito
          .map((d) => `${d.cantidad} × ${d.tipo}`)
          .join(", ")}. ` +
        `Por rango horario: ${incidencia.porRango
          .map((r) => `${r.cantidad} × ${r.rango}`)
          .join(", ")}.`;

  const streetViewTexto = streetViewUrl
    ? `Imagen de referencia de Street View (histórica/visual): ${streetViewUrl}`
    : "No se cuenta con imagen de Street View para este punto.";

  const prompt = `
DATOS DEL INVESTIGADOR:
${comentariosInvestigador}

DIRECCIÓN (Geocoding):
${direccionTexto}

DETERIORO URBANO (Vision API - Ventanas Rotas):
${visionResumen}

CONTROLES Y ATRACTORES (Places + DENUE - Comercios irregulares y puntos de interés):
${irregularidadesTexto || "No se identificaron comercios irregulares ni atractores relevantes en la zona analizada."}

ESTRATEGIA ANALÍTICA SEGÚN TIPO DE PUNTO:
${strategySummary || "No se especificó etiqueta del catálogo; aplicar análisis general conforme a las cuatro teorías indicadas."}

INCIDENCIA ESTADÍSTICA (PostGIS / CSV):
${incidenciaTexto}

CONTEXTO VISUAL HISTÓRICO (Street View):
${streetViewTexto}

INSTRUCCIÓN FINAL:
Basa tu redacción, terminología y análisis ESTRICTAMENTE en la bibliografía y manuales institucionales proporcionados en el System Instruction. 
No inventes teorías que no estén explícitamente presentes en dichos documentos.
Analiza toda esta información bajo los marcos de Actividades Rutinarias, Patrón Delictivo, Elección Racional y Ventanas Rotas. 
Redacta un PERFIL CRIMINOLÓGICO AMBIENTAL en español, con lenguaje técnico, policial y objetivo.
Estructura el resultado en secciones claras (por ejemplo: Contexto Espacial, Deterioro Físico, Atractores y Guardianes, Rutinas y Oportunidades, Riesgos y Recomendaciones).
Al final, incluye obligatoriamente un apartado titulado "INFORMACIÓN PREDICTIVA" donde estimes la probabilidad de incremento delictivo a 6 meses si no se mejora la estética urbana y las condiciones ambientales, justificando tu análisis en términos criminológicos.
`.trim();

  return prompt;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as GenerateProfileBody;
    const { photos } = body;

    if (!Array.isArray(photos) || photos.length === 0) {
      return NextResponse.json(
        { error: "Se requiere un array 'photos' con al menos una fotografía." },
        { status: 400 }
      );
    }

    const centerLat =
      photos.reduce((acc, p) => acc + p.lat, 0) / photos.length;
    const centerLng =
      photos.reduce((acc, p) => acc + p.lng, 0) / photos.length;
    const radiusMeters = 500;

    const geocodingPromise = reverseGeocode(centerLat, centerLng);

    const placesPromise = searchPlacesAround(
      centerLat,
      centerLng,
      radiusMeters
    ).catch((e) => {
      console.error("[generate-profile] Places error:", e);
      return null;
    });

    const denuePromise = searchDenueAround(
      centerLat,
      centerLng,
      radiusMeters
    ).catch((e) => {
      console.error("[generate-profile] DENUE error:", e);
      return null;
    });

    const streetViewPromise = (async () => {
      try {
        const cmp = getStreetViewComparison(centerLat, centerLng);
        return cmp.streetViewImageUrl ?? null;
      } catch (e) {
        console.error("[generate-profile] Street View error:", e);
        return null;
      }
    })();

    const historialPromise = getHistoricalSummary(
      centerLat,
      centerLng,
      radiusMeters
    );

    const bibliographyPromise = readBibliographyContext();

    const [
      geocoding,
      placesResult,
      denueResult,
      streetViewUrl,
      { resumen: incidenciaResumen },
      bibliographyContext,
    ] = await Promise.all([
      geocodingPromise,
      placesPromise,
      denuePromise,
      streetViewPromise,
      historialPromise,
      bibliographyPromise,
    ]);

    let irregularidadesTexto = "";
    try {
      const irregs = buildIrregularBusinesses(placesResult, denueResult);
      if (irregs.posiblesIrregulares.length > 0) {
        irregularidadesTexto =
          "Se identifican los siguientes comercios potencialmente irregulares (Google Places sin correspondencia clara en DENUE):\n" +
          irregs.posiblesIrregulares
            .map(
              (c, idx) =>
                `${idx + 1}. ${c.lugarGoogle.nombre} – ${c.lugarGoogle.direccion}. Motivo: ${c.motivo}`
            )
            .join("\n");
      }
    } catch (e) {
      console.error(
        "[generate-profile] Error al construir irregularidades:",
        e
      );
      irregularidadesTexto = "";
    }

    const visionPorFoto = await Promise.all(
      photos.map(async (p) => {
        if (!p.imageBase64) {
          return { photoId: p.id, etiquetas: [] as string[], texto: [] };
        }
        try {
          const res = await analyzeBrokenWindowsWithVision({
            imageBase64: p.imageBase64,
          });
          const etiquetas = res?.etiquetasRelevantes ?? [];
          const texto = res?.textoDetectado ?? [];
          return {
            photoId: p.id,
            etiquetas,
            texto,
          };
        } catch (e) {
          console.error(
            "[generate-profile] Vision error para foto",
            p.id,
            e
          );
          return { photoId: p.id, etiquetas: [] as string[], texto: [] };
        }
      })
    );

    const strategySummary = buildStrategiesSummaryForTags(
      photos.map((p) => p.tipo)
    );

    const prompt = buildPromptForGemini({
      photos,
      geocoding,
      visionPorFoto,
      irregularidadesTexto,
      incidencia: incidenciaResumen,
      streetViewUrl,
      strategySummary,
    });

    const model = getGeminiModel(bibliographyContext);
    let markdown = "";
    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      markdown = response.text();
    } catch (err) {
      console.error(
        "[api/generate-profile] Error detallado al llamar a Gemini:",
        err
      );
      throw err;
    }

    return NextResponse.json(
      {
        markdown,
        meta: {
          center: { lat: centerLat, lng: centerLng },
          incidencia: incidenciaResumen,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[api/generate-profile] Error inesperado:", error);
    return NextResponse.json(
      { error: "Error interno al generar el perfil criminológico." },
      { status: 500 }
    );
  }
}

