import { NextResponse } from "next/server";

/**
 * Diagnóstico: indica qué variables de entorno ve el servidor (sin mostrar valores).
 * Útil para depurar en Vercel. Llamar a: tu-dominio.vercel.app/api/env-check
 */
export async function GET() {
  const env = typeof process !== "undefined" ? process.env : {};
  const hasGemini =
    !!env.GEMINI_API_KEY && String(env.GEMINI_API_KEY).trim().length > 0;
  const hasNextPublicGemini =
    !!env.NEXT_PUBLIC_GEMINI_API_KEY &&
    String(env.NEXT_PUBLIC_GEMINI_API_KEY).trim().length > 0;
  const hasMaps =
    !!env.GOOGLE_MAPS_API_KEY && String(env.GOOGLE_MAPS_API_KEY).trim().length > 0;
  const hasNextPublicMaps =
    !!env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY &&
    String(env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY).trim().length > 0;

  return NextResponse.json({
    ok: hasGemini || hasNextPublicGemini,
    message:
      hasGemini || hasNextPublicGemini
        ? "Clave de Gemini detectada; el perfil debería funcionar."
        : "No se detecta ninguna clave de Gemini. Revisa Vercel → Settings → Environment Variables (Production) y Redeploy.",
    env: {
      GEMINI_API_KEY: hasGemini ? "set" : "no set",
      NEXT_PUBLIC_GEMINI_API_KEY: hasNextPublicGemini ? "set" : "no set",
      GOOGLE_MAPS_API_KEY: hasMaps ? "set" : "no set",
      NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: hasNextPublicMaps ? "set" : "no set",
    },
  });
}
