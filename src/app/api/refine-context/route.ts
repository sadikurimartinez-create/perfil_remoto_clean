import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

type RefineBody = {
  context: string;
  photos?: { lat: number; lng: number }[];
};

export async function POST(req: Request) {
  try {
    const { context, photos } = (await req.json()) as RefineBody;

    if (!context || !context.trim()) {
      return NextResponse.json(
        { error: "Falta el contexto del analista." },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Falta la variable GEMINI_API_KEY en el servidor." },
        { status: 500 }
      );
    }

    const coordsText =
      photos && photos.length > 0
        ? photos
            .map(
              (p, i) =>
                `Foto ${i + 1}: lat ${p.lat.toFixed(6)}, lng ${p.lng.toFixed(
                  6
                )}`
            )
            .join("\n")
        : "No se proporcionaron coordenadas de fotos.";

    const prompt = `
El analista escribió este contexto:

"${context}"

Coordenadas aproximadas de las fotos:
${coordsText}

Revisa el contexto y las coordenadas. Da 2 o 3 sugerencias breves y concretas
sobre elementos visibles o esperables en las imágenes (iluminación, vandalismo,
rutas de escape, accesibilidad, presencia de cámaras, flujo peatonal/vehicular, etc.)
que el analista debería agregar a su contexto para mejorar el perfil criminológico.

Responde en español, en forma de viñetas cortas, sin repetir el contexto original.
`.trim();

    const genAI = new GoogleGenerativeAI(apiKey);
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

