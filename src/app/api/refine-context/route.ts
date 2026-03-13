import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_API_KEY as GEMINI_KEY } from "@/lib/geminiEnv";
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
    if (!apiKey) {
      return NextResponse.json(
        { error: "Falta la clave de Gemini. En Vercel añade NEXT_PUBLIC_GEMINI_API_KEY para Production y haz Redeploy." },
        { status: 500 }
      );
    }

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

    const genAI = new GoogleGenerativeAI(apiKey.trim());
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    return NextResponse.json({ suggestions: text });
  } catch (err) {
    console.error("[api/refine-context] Error:", err);
    return NextResponse.json(
      { error: "No se pudo refinar el contexto." },
      { status: 500 }
    );
  }
}

