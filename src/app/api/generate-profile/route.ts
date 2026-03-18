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
import { getNearbyCrimes } from "@/lib/crimeData";
import { mergeAndDeduplicatePOIs, type PointOfInterest } from "@/lib/poiDedup";
import { GEMINI_API_KEY as GEMINI_KEY, GEMINI_MODEL } from "@/lib/geminiEnv";

export const runtime = "nodejs";

type PhotoInput = {
  id: string;
  lat: number | null;
  lng: number | null;
  tipo: string;
  comentario: string;
  imageBase64?: string;
};

/** Evita "Cannot read properties of null (reading toFixed)" cuando lat/lng vienen sin GPS (ej. galería). */
function formatCoord(n: number | null | undefined): string {
  if (n == null || typeof n !== "number" || Number.isNaN(n)) return "N/A";
  return n.toFixed(5);
}

/** Tipos de delito que se consideran de mayor peso para el semáforo de riesgo */
const DELITOS_PESO_ALTO = [
  "homicidio",
  "secuestro",
  "violencia",
  "lesiones",
  "robo",
  "asalto",
  "agresión",
  "amenaza",
  "narco",
  "arma",
  "extorsión",
  "feminicidio",
];

function normalizeTipo(tipo: string): string {
  return tipo.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").trim();
}

/**
 * Calcula el nivel de riesgo (semáforo) con reglas afinadas:
 * - Incidencia estadística (DB) y archivos CSV
 * - Peso por tipo de delito (graves suman más)
 * - Comercios irregulares y densidad de POIs como atractores de riesgo
 */
function computeRiskLevel(params: {
  totalIncidenciaDB: number;
  totalIncidenciaCSV: number;
  porDelito: Array<{ tipo: string; cantidad: number }>;
  numIrregulares: number;
  numPois: number;
  radioMetros: number;
}): "bajo" | "medio" | "alto" {
  const {
    totalIncidenciaDB,
    totalIncidenciaCSV,
    porDelito,
    numIrregulares,
    numPois,
    radioMetros,
  } = params;

  let puntos = 0;

  const totalIncidencia = totalIncidenciaDB + totalIncidenciaCSV;

  if (totalIncidencia === 0) {
    puntos = 0;
  } else {
    const porMilMetros = radioMetros <= 0 ? 0 : totalIncidencia / (radioMetros / 1000);
    if (porMilMetros >= 15) puntos += 3;
    else if (porMilMetros >= 6) puntos += 2;
    else if (porMilMetros >= 1) puntos += 1;
  }

  const hayDelitosGraves = porDelito.some((d) =>
    DELITOS_PESO_ALTO.some((kw) => normalizeTipo(d.tipo).includes(kw))
  );
  const cantidadDelitosGraves = porDelito
    .filter((d) =>
      DELITOS_PESO_ALTO.some((kw) => normalizeTipo(d.tipo).includes(kw))
    )
    .reduce((acc, d) => acc + d.cantidad, 0);
  if (cantidadDelitosGraves >= 5) puntos += 2;
  else if (cantidadDelitosGraves >= 1 || hayDelitosGraves) puntos += 1;

  if (numIrregulares >= 5) puntos += 2;
  else if (numIrregulares >= 1) puntos += 1;

  if (numPois >= 15) puntos += 2;
  else if (numPois >= 8) puntos += 1;

  const puntuacion = Math.round(puntos);

  if (puntuacion <= 1) return "bajo";
  if (puntuacion <= 3) return "medio";
  return "alto";
}

type GenerateProfileBody = {
  photos: PhotoInput[];
  analysisContext?: string;
  analysisRadius?: number;
  focusAreas?: string[];
  /** Inteligencia visual táctica opcional enviada desde el frontend (OCR y rostros). */
  visionDataTactica?: {
    texto: string;
    rostros: number;
  };
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
  const fromModule = (GEMINI_KEY && GEMINI_KEY.trim()) || "";
  const fromProcess =
    (typeof process.env.NEXT_PUBLIC_GEMINI_API_KEY === "string" && process.env.NEXT_PUBLIC_GEMINI_API_KEY.trim()) ||
    (typeof process.env.GEMINI_API_KEY === "string" && process.env.GEMINI_API_KEY.trim()) ||
    "";
  const apiKey = fromModule || fromProcess;
  if (!apiKey) {
    throw new Error(
      "Falta la API key de Gemini. Comprueba en tu navegador: https://TU-DOMINIO.vercel.app/api/env-check " +
        "y en Vercel: Settings → Environment Variables (Production) → NEXT_PUBLIC_GEMINI_API_KEY o GEMINI_API_KEY → Redeploy."
    );
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction:
      "Eres un Criminólogo experto en Ecología Ambiental adscrito al Centro de Estudios y Política Criminal (CEIPOL). " +
      "Redactas dictámenes técnicos denominados 'Perfil Criminológico Ambiental', con lenguaje policial, objetivo y sin juicios de valor no sustentados en datos. " +
      "Fundamentas el análisis en cuatro marcos: Actividades Rutinarias, Patrón Delictivo, Elección Racional y Teoría de Ventanas Rotas. " +
      "Basa terminología y argumentos ESTRICTAMENTE en la bibliografía y manuales institucionales proporcionados; no inventes teorías ni citas que no figuren en ellos.\n\n" +
      "Reglas de redacción: (1) Usa párrafos breves y encabezados claros. (2) Evita repeticiones; cada idea en un solo lugar. (3) Distingue hechos observados o datos (geocoding, incidencia, POIs) de interpretación criminológica. (4) Las recomendaciones deben ser accionables y vinculadas al análisis. (5) El apartado final INFORMACIÓN PREDICTIVA debe cuantificar o calificar el riesgo a 6 meses y justificarlo con los elementos del perfil.\n\n" +
      (bibliographyContext || "[No se proporcionó bibliografía adicional.]"),
  });
}

async function reverseGeocode(
  lat: number,
  lng: number
): Promise<GeocodingResult> {
  const key =
    process.env.GOOGLE_MAPS_API_KEY ??
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ??
    null;
  if (!key) {
    console.warn(
      "[generate-profile] Falta GOOGLE_MAPS_API_KEY o NEXT_PUBLIC_GOOGLE_MAPS_API_KEY para Geocoding."
    );
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
  incidenciaArchivosTexto: string;
  streetViewUrl: string | null;
  strategySummary: string;
  analysisContext?: string;
  analysisRadius: number;
  focusAreas: string[];
  poiImages: Array<{ name: string; category: string; streetViewUrl: string }>;
  visionDataTactica?: { texto: string; rostros: number };
}): string {
  const {
    photos,
    geocoding,
    visionPorFoto,
    irregularidadesTexto,
    incidencia,
    incidenciaArchivosTexto,
    streetViewUrl,
    strategySummary,
    analysisContext,
    analysisRadius,
    focusAreas,
    poiImages,
    visionDataTactica,
  } = params;

  const comentariosInvestigador = photos
    .map(
      (p) =>
        `- [${p.tipo}] Comentario: ${p.comentario || "(sin comentario)"} ` +
        `Coordenadas: (${formatCoord(p.lat)}, ${formatCoord(p.lng)})`
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

  const radioTexto =
    analysisRadius >= 1000
      ? `${(analysisRadius / 1000).toFixed(1)} km`
      : `${analysisRadius} m`;
  const incidenciaTexto =
    incidencia.total === 0
      ? `En un radio de ${radioTexto} no se registran incidentes históricos en la base de incidencia.`
      : `En un radio de ${radioTexto} se registran ${incidencia.total} incidentes históricos. ` +
        `Por tipo: ${incidencia.porDelito
          .map((d) => `${d.cantidad} × ${d.tipo}`)
          .join(", ")}. ` +
        `Por rango horario: ${incidencia.porRango
          .map((r) => `${r.cantidad} × ${r.rango}`)
          .join(", ")}.`;

  const streetViewTexto = streetViewUrl
    ? `Imagen de referencia de Street View (histórica/visual): ${streetViewUrl}`
    : "No se cuenta con imagen de Street View para este punto.";

  const focusAreasTexto =
    focusAreas && focusAreas.length > 0
      ? focusAreas.join(", ")
      : "no se marcaron objetivos prioritarios específicos; debes evaluar integralmente todos los elementos disponibles.";

  const poiImagesMarkdown =
    poiImages.length > 0
      ? poiImages
          .map(
            (p, idx) =>
              `![POI ${idx + 1} - ${p.name} (${p.category})](${p.streetViewUrl})`
          )
          .join("\n")
      : "[No se proporcionaron imágenes externas de POIs para este caso.]";

  const hipotesisTexto =
    analysisContext?.trim() ||
    "[El analista no proporcionó hipótesis ni contexto adicional.]";

  const clasificacionesTexto = photos
    .map(
      (p, idx) =>
        `Foto ${idx + 1}: ${p.tipo || "Sin clasificación humana registrada."}`
    )
    .join("\n");

  const visionTacticaTexto = visionDataTactica
    ? `Inteligencia Visual Automatizada: en las fotografías de la escena se ha detectado mediante OCR el siguiente texto (evalúa si corresponden a placas vehiculares o números económicos de taxis/patrullas): "${visionDataTactica.texto}". Además, se detectó la presencia de ${visionDataTactica.rostros} rostro(s). Cruza esta información con los Puntos de Interés (POIs) y la incidencia delictiva. Analiza si la presencia de estos vehículos o individuos coincide con tácticas de 'halconeo', transporte pirata o vigilancia en la zona.`
    : "Inteligencia Visual Automatizada: no se detectó texto relevante ni rostros significativos en las imágenes procesadas.";

  const prompt = `
## DATOS DEL INVESTIGADOR (fotos y comentarios)
${comentariosInvestigador}

## HIPÓTESIS O CONTEXTO DEL ANALISTA (incorporar en el análisis)
${hipotesisTexto}

## CLASIFICACIÓN HUMANA DE LA EVIDENCIA
${clasificacionesTexto}

## UBICACIÓN (Geocoding)
${direccionTexto}
Radio de análisis utilizado: ${analysisRadius} metros.

## DETERIORO URBANO (Vision API - Ventanas Rotas)
${visionResumen}

## CONTROLES Y ATRACTORES (Places + DENUE)
${irregularidadesTexto || "No se identificaron comercios irregulares ni atractores relevantes en la zona analizada."}

## ESTRATEGIA ANALÍTICA SEGÚN TIPO DE PUNTO
${strategySummary || "Aplicar análisis general conforme a las cuatro teorías indicadas."}

## INCIDENCIA ESTADÍSTICA (base PostGIS/CSV)
${incidenciaTexto}

## INCIDENCIA ADICIONAL (archivos CSV locales)
${incidenciaArchivosTexto || "No se encontraron delitos adicionales en archivos CSV dentro del radio."}

## CONTEXTO VISUAL (Street View)
${streetViewTexto}

## INTELIGENCIA VISUAL AUTOMATIZADA (OCR y Rostros)
${visionTacticaTexto}

## OBJETIVOS PRIORITARIOS MARCADOS POR EL ANALISTA
${focusAreasTexto}

## IMÁGENES DE POIs (Markdown)
Incrusta en el dictamen las imágenes donde sea relevante usando: ![Descripción](URL).
Listado:
${poiImagesMarkdown}

---
INSTRUCCIÓN FINAL:
Redacta un único PERFIL CRIMINOLÓGICO AMBIENTAL en español, técnico y objetivo. Estructura OBLIGATORIAMENTE en las siguientes secciones (con estos títulos en mayúsculas), en este orden:

1. OBJETIVO DEL DICTAMEN — Una oración que indique el propósito del perfil y la zona analizada.
2. CONTEXTO ESPACIAL — Descripción del área (dirección, colonia, entorno) y del radio de análisis.
3. DETERIORO FÍSICO Y SEÑALES DE VENTANAS ROTAS — Síntesis de lo detectado por Vision en las fotos; sin repetir listas crudas.
4. ATRACTORES, CONTROLES Y GUARDIANES — Comercios, POIs y su relación con rutinas y oportunidades delictivas; usa las imágenes de POIs donde aporten.
5. RUTINAS Y OPORTUNIDADES — Análisis desde Actividades Rutinarias y Elección Racional con los datos de incidencia y ubicación.
6. RIESGOS IDENTIFICADOS — Puntos concretos de riesgo derivados del análisis, sin repetir párrafos anteriores.
7. RECOMENDACIONES — Medidas accionables y vinculadas a los hallazgos.
8. INFORMACIÓN PREDICTIVA — Estimación de probabilidad de incremento delictivo a 6 meses si no se interviene (baja/media/alta o porcentual), con justificación criminológica breve.

No inventes datos ni teorías ajenas a la bibliografía. Evita redundancia entre secciones; cada idea una sola vez.
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

    const photosWithCoords = photos.filter(
      (p) =>
        p.lat != null &&
        p.lng != null &&
        !Number.isNaN(p.lat) &&
        !Number.isNaN(p.lng)
    );
    if (photosWithCoords.length === 0) {
      return NextResponse.json(
        {
          error:
            "Ninguna foto tiene coordenadas GPS. Añade fotos con ubicación (cámara con GPS o imágenes con EXIF) o usa al menos una foto con coordenadas para el análisis.",
        },
        { status: 400 }
      );
    }
    const centerLat =
      photosWithCoords.reduce((acc, p) => acc + (p.lat as number), 0) /
      photosWithCoords.length;
    const centerLng =
      photosWithCoords.reduce((acc, p) => acc + (p.lng as number), 0) /
      photosWithCoords.length;

    const radiusMeters =
      typeof body.analysisRadius === "number" && body.analysisRadius > 0
        ? body.analysisRadius
        : 500;

    const geocodingPromise = reverseGeocode(centerLat, centerLng);
    const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
      new Promise((resolve, reject) => {
        const id = setTimeout(
          () => reject(new Error(`Timeout ${ms}ms en DENUE`)),
          ms
        );
        p.then(
          (v) => {
            clearTimeout(id);
            resolve(v);
          },
          (e) => {
            clearTimeout(id);
            reject(e);
          }
        );
      });

    const placesPromise = searchPlacesAround(
      centerLat,
      centerLng,
      radiusMeters
    );

    const denueTimedPromise = withTimeout(
      searchDenueAround(centerLat, centerLng, radiusMeters),
      4000
    );

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
      placesAndDenueSettled,
      streetViewUrl,
      { resumen: incidenciaResumen },
      bibliographyContext,
    ] = await Promise.all([
      geocodingPromise,
      Promise.allSettled([denueTimedPromise, placesPromise]),
      streetViewPromise,
      historialPromise,
      bibliographyPromise,
    ]);

    const denueResult =
      placesAndDenueSettled[0].status === "fulfilled"
        ? placesAndDenueSettled[0].value
        : null;
    const placesResult =
      placesAndDenueSettled[1].status === "fulfilled"
        ? placesAndDenueSettled[1].value
        : null;

    let incidenciaArchivosTexto = "";
    let totalIncidenciaCSV = 0;
    try {
      const nearbyCrimes = await getNearbyCrimes(
        centerLat,
        centerLng,
        radiusMeters
      );
      totalIncidenciaCSV = nearbyCrimes.length;
      incidenciaArchivosTexto =
        nearbyCrimes.length === 0
          ? "No se encontraron delitos en los archivos CSV locales dentro del radio analizado."
          : nearbyCrimes
              .slice(0, 50)
              .map(
                (c, idx) =>
                  `${idx + 1}. ${c.tipo} en (${formatCoord(c.lat)}, ${formatCoord(c.lng)}) – archivo: ${c.fuente}`
              )
              .join("\n");
    } catch (e) {
      console.error("[generate-profile] Error al leer archivos de incidencia:", e);
      incidenciaArchivosTexto =
        "No fue posible leer los archivos CSV de incidencia local en este momento.";
    }

    let irregularidadesTexto = "";
    let poiImages: Array<{ name: string; category: string; streetViewUrl: string }> = [];
    let numIrregulares = 0;
    let numPois = 0;
    try {
      const irregs = buildIrregularBusinesses(placesResult, denueResult);
      numIrregulares = irregs.posiblesIrregulares.length;
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
      const denuePois: PointOfInterest[] =
        denueResult?.unidades.map((u) => ({
          name: u.nombre,
          category: u.actividad ?? "desconocido",
          lat: u.lat,
          lng: u.lng,
          source: "DENUE",
        })) ?? [];
      const placesPois: PointOfInterest[] = placesResult
        ? [
            ...placesResult.escuelas,
            ...placesResult.expendiosAlcohol,
            ...placesResult.chatarrerasOTalleres,
            ...placesResult.otros,
          ].map((p) => ({
            name: p.nombre,
            category: p.categoria,
            lat: p.lat,
            lng: p.lng,
            source: "GOOGLE" as const,
          }))
        : [];
      const mergedPois = mergeAndDeduplicatePOIs(denuePois, placesPois);
      numPois = mergedPois.length;
      if (mergedPois.length > 0) {
        const resumenPOI = mergedPois
          .slice(0, 50)
          .map(
            (p, idx) =>
              `${idx + 1}. ${p.name} (${p.category}) en (${formatCoord(p.lat)}, ${formatCoord(p.lng)}) – fuente: ${p.source}`
          )
          .join("\n");
        irregularidadesTexto +=
          (irregularidadesTexto ? "\n\n" : "") +
          "Puntos de interés fusionados (DENUE + Google Places):\n" +
          resumenPOI;

        const mapsKey =
          process.env.GOOGLE_MAPS_API_KEY ??
          process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ??
          null;
        if (mapsKey) {
          poiImages = mergedPois.slice(0, 12).map((p) => ({
            name: p.name,
            category: p.category,
            streetViewUrl: `https://maps.googleapis.com/maps/api/streetview?size=640x400&location=${p.lat},${p.lng}&key=${mapsKey}`,
          }));
        }
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
      incidenciaArchivosTexto,
      streetViewUrl,
      strategySummary,
      analysisContext: body.analysisContext,
      analysisRadius: radiusMeters,
      focusAreas: body.focusAreas ?? [],
      poiImages,
      visionDataTactica: (body as any).visionDataTactica ?? undefined,
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

    const riskLevel = computeRiskLevel({
      totalIncidenciaDB: incidenciaResumen.total,
      totalIncidenciaCSV,
      porDelito: incidenciaResumen.porDelito,
      numIrregulares,
      numPois,
      radioMetros: radiusMeters,
    });

    return NextResponse.json(
      {
        markdown,
        meta: {
          center: { lat: centerLat, lng: centerLng },
          incidencia: incidenciaResumen,
          riskLevel,
        },
      },
      { status: 200 }
    );
    } catch (error: any) {
      console.error("[api/generate-profile] Error inesperado:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Error interno al generar el perfil criminológico.";
      const status =
        typeof error?.status === "number" && error.status >= 400 && error.status < 600
          ? error.status
          : 500;
      return NextResponse.json({ error: message }, { status });
    }
}