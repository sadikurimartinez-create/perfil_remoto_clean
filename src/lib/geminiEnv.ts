/**
 * Lee la clave de Gemini una sola vez al cargar el módulo.
 * En Vercel a veces process.env no está disponible dentro de funciones; al leer aquí puede funcionar.
 */
const g = typeof process !== "undefined" ? process.env : ({} as NodeJS.ProcessEnv);
const a = (g.NEXT_PUBLIC_GEMINI_API_KEY ?? "") as string;
const b = (g.GEMINI_API_KEY ?? "") as string;
export const GEMINI_API_KEY =
  (typeof a === "string" && a.trim() ? a.trim() : null) ||
  (typeof b === "string" && b.trim() ? b.trim() : null) ||
  "";
