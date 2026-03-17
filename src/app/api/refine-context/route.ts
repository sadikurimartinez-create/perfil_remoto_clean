import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_API_KEY as GEMINI_KEY, GEMINI_MODEL } from "@/lib/geminiEnv";
function getGeminiKey(): string {
  const fromModule = (GEMINI_KEY && GEMINI_KEY.trim()) || "";
  const fromProcess =
    (typeof process.env.NEXT_PUBLIC_GEMINI_API_KEY === "string" && process.env.NEXT_PUBLIC_GEMINI_API_KEY.trim()) ||
    (typeof process.env.GEMINI_API_KEY === "string" && process.env.GEMINI_API_KEY.trim()) ||
    "";
  return fromModule || fromProcess;
}

type RefineBody = {
  context: string;
  photos?: { lat: number | null; lng: number | null }[];
};

function formatCoord(n: number | null | undefined): string {
  if (n == null || typeof n !== "number" || Number.isNaN(n)) return "N/A";
  return n.toFixed(6);
}

export async function POST(req: Request) {
  try {
    const { context, photos } = (await req.json()) as RefineBody;

    const apiKey = getGeminiKey();
    const coordsText =
      photos && photos.length > 0
        ? photos
            .map(
              (p, i) =>
                `Foto ${i + 1}: lat ${formatCoord(p.lat)}, lng ${formatCoord(p.lng)}`
            )
            .join("\n")
        : "No se proporcionaron coordenadas de fotos.";

    const cleanedContext = (context ?? "").trim();

    const prompt = `
El analista escribió este contexto (puede estar vacío si aún no ha redactado nada):

"${cleanedContext || "(sin contexto inicial; generar sugerencias solo a partir de la geografía)"}"

Coordenadas aproximadas de las fotos:
${coordsText}

Revisa el contexto y las coordenadas. Da 2 o 3 sugerencias breves y concretas
sobre elementos visibles o esperables en las imágenes (iluminación, vandalismo,
rutas de escape, accesibilidad, presencia de cámaras, flujo peatonal/vehicular, etc.)
que el analista debería agregar a su contexto para mejorar el perfil criminológico.

Responde en español, en forma de viñetas cortas, sin repetir el contexto original.
`.trim();

    // Si no hay clave de Gemini, devolvemos sugerencias genéricas para no romper el flujo de la UI.
    if (!apiKey) {
      const fallback =
        "• Describa iluminación (natural/artificial), visibilidad y puntos ciegos.\n" +
        "• Señale rutas de acceso/escape, barreras físicas y posibles puntos de vigilancia.\n" +
        "• Mencione presencia o ausencia de cámaras, flujo peatonal/vehicular y signos de deterioro (grafiti, basura, vidrios rotos).";
      return NextResponse.json({ suggestions: fallback });
    }

    const genAI = new GoogleGenerativeAI(apiKey.trim());
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    return NextResponse.json({ suggestions: text });
  } catch (err) {
    console.error("[api/refine-context] Error:", err);
    // Degradación elegante: si Gemini falla, devolvemos sugerencias genéricas en vez de 500.
    const fallback =
      "• Añada observaciones sobre patrones de movimiento, horarios críticos y concentración de personas.\n" +
      "• Vincule las características físicas del entorno con oportunidades y riesgos para el delito.\n" +
      "• Incluya hipótesis sobre cómo el espacio favorece u obstaculiza la vigilancia natural y formal.";
    return NextResponse.json({ suggestions: fallback });
  }
}

