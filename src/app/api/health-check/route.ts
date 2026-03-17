import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_MODEL } from "@/lib/geminiEnv";
import { searchPlacesAround } from "@/lib/googlePlaces";
import { searchDenueAround } from "@/lib/denueInegi";
import { getPool } from "@/lib/db";

type ServiceStatus = {
  id: string;
  name: string;
  status: "ok" | "error";
  latencyMs: number | null;
  errorMessage?: string;
};

export async function GET() {
  const services: ServiceStatus[] = [];

  // Coordenadas arbitrarias en Aguascalientes
  const testLat = 21.8818;
  const testLng = -102.2950;

  // Google Places (usa GOOGLE_MAPS_API_KEY vía searchPlacesAround)
  {
    const started = Date.now();
    try {
      await searchPlacesAround(testLat, testLng, 10);
      services.push({
        id: "places",
        name: "Google Places API",
        status: "ok",
        latencyMs: Date.now() - started,
      });
    } catch (error) {
      services.push({
        id: "places",
        name: "Google Places API",
        status: "error",
        latencyMs: Date.now() - started,
        errorMessage:
          error instanceof Error ? error.message : "Error desconocido en Places",
      });
    }
  }

  // Google Geocoding
  {
    const started = Date.now();
    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key) {
      services.push({
        id: "geocoding",
        name: "Google Geocoding API",
        status: "error",
        latencyMs: null,
        errorMessage: "Falta GOOGLE_MAPS_API_KEY en variables de entorno.",
      });
    } else {
      try {
        const url = new URL(
          "https://maps.googleapis.com/maps/api/geocode/json"
        );
        url.searchParams.set("latlng", `${testLat},${testLng}`);
        url.searchParams.set("key", key);
        const res = await fetch(url.toString());
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        services.push({
          id: "geocoding",
          name: "Google Geocoding API",
          status: "ok",
          latencyMs: Date.now() - started,
        });
      } catch (error) {
        services.push({
          id: "geocoding",
          name: "Google Geocoding API",
          status: "error",
          latencyMs: Date.now() - started,
          errorMessage:
            error instanceof Error
              ? error.message
              : "Error desconocido en Geocoding",
        });
      }
    }
  }

  // Google Cloud Vision (ping simple)
  {
    const started = Date.now();
    const key = process.env.GOOGLE_CLOUD_VISION_API_KEY;
    if (!key) {
      services.push({
        id: "vision",
        name: "Google Cloud Vision API",
        status: "error",
        latencyMs: null,
        errorMessage: "Falta GOOGLE_CLOUD_VISION_API_KEY en variables de entorno.",
      });
    } else {
      try {
        const url =
          "https://vision.googleapis.com/v1/images:annotate?key=" + key;
        // Imagen mínima en base64 (1x1 PNG transparente)
        const tinyImage =
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9YgBpssAAAAASUVORK5CYII=";
        const body = {
          requests: [
            {
              image: { content: tinyImage },
              features: [{ type: "LABEL_DETECTION", maxResults: 1 }],
            },
          ],
        };
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const text = await res.text();
          console.error(
            "[health-check] Vision API error detallado:",
            res.status,
            text
          );
          throw new Error(`HTTP ${res.status}`);
        }
        services.push({
          id: "vision",
          name: "Google Cloud Vision API",
          status: "ok",
          latencyMs: Date.now() - started,
        });
      } catch (error) {
        services.push({
          id: "vision",
          name: "Google Cloud Vision API",
          status: "error",
          latencyMs: Date.now() - started,
          errorMessage:
            error instanceof Error
              ? error.message
              : "Error desconocido en Vision",
        });
      }
    }
  }

  // Gemini API
  {
    const started = Date.now();
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      services.push({
        id: "gemini",
        name: "Gemini API",
        status: "error",
        latencyMs: null,
        errorMessage: "Falta GEMINI_API_KEY en variables de entorno.",
      });
    } else {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
        const result = await model.generateContent("ping");
        await result.response;
        services.push({
          id: "gemini",
          name: "Gemini API",
          status: "ok",
          latencyMs: Date.now() - started,
        });
      } catch (error) {
        console.error("[health-check] Gemini error detallado:", error);
        services.push({
          id: "gemini",
          name: "Gemini API",
          status: "error",
          latencyMs: Date.now() - started,
          errorMessage:
            error instanceof Error
              ? error.message
              : "Error desconocido en Gemini",
        });
      }
    }
  }

  // INEGI DENUE
  {
    const started = Date.now();
    const token = process.env.INEGI_DENUE_TOKEN;
    if (!token) {
      services.push({
        id: "denue",
        name: "INEGI DENUE API",
        status: "error",
        latencyMs: null,
        errorMessage: "Falta INEGI_DENUE_TOKEN en variables de entorno.",
      });
    } else {
      try {
        await searchDenueAround(testLat, testLng, 10);
        services.push({
          id: "denue",
          name: "INEGI DENUE API",
          status: "ok",
          latencyMs: Date.now() - started,
        });
      } catch (error) {
        services.push({
          id: "denue",
          name: "INEGI DENUE API",
          status: "error",
          latencyMs: Date.now() - started,
          errorMessage:
            error instanceof Error
              ? error.message
              : "Error desconocido en DENUE",
        });
      }
    }
  }

  // PostgreSQL / PostGIS
  {
    const started = Date.now();
    try {
      await getPool().query("SELECT ST_AsText(ST_MakePoint(0, 0))");
      services.push({
        id: "postgres",
        name: "PostgreSQL / PostGIS",
        status: "ok",
        latencyMs: Date.now() - started,
      });
    } catch (error) {
      services.push({
        id: "postgres",
        name: "PostgreSQL / PostGIS",
        status: "error",
        latencyMs: Date.now() - started,
        errorMessage:
          error instanceof Error
            ? error.message
            : "Error desconocido en PostgreSQL/PostGIS",
      });
    }
  }

  return NextResponse.json(
    {
      timestamp: new Date().toISOString(),
      services,
    },
    { status: 200 }
  );
}

