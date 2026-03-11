export type RouteEscapeAnalysis = {
  tieneConexionAViasRapidas: boolean;
  tieneCallesSinPavimentarOCaminoRural: boolean;
  proximidadACaracteristicasTopograficas: {
    barrancaOCauce: boolean;
    pendientePronunciada: boolean;
  };
  resumen: string;
  rawDirections?: unknown;
  rawElevation?: unknown;
};

const DIRECTIONS_BASE_URL =
  "https://maps.googleapis.com/maps/api/directions/json";
const ELEVATION_BASE_URL =
  "https://maps.googleapis.com/maps/api/elevation/json";

function getMapsApiKey(): string | null {
  return process.env.GOOGLE_MAPS_API_KEY ?? null;
}

function inferUnpavedOrRural(summary: string): boolean {
  const s = summary.toLowerCase();
  return (
    s.includes("unpaved") ||
    s.includes("gravel") ||
    s.includes("dirt road") ||
    s.includes("camino de tierra") ||
    s.includes("terracería")
  );
}

function inferFastRoad(summary: string): boolean {
  const s = summary.toLowerCase();
  return (
    s.includes("highway") ||
    s.includes("freeway") ||
    s.includes("autopista") ||
    s.includes("vía rápida")
  );
}

export async function analyzeEscapeRoutes(
  lat: number,
  lng: number
): Promise<RouteEscapeAnalysis | null> {
  const apiKey = getMapsApiKey();
  if (!apiKey) {
    console.warn(
      "[googleRoutes] Falta GOOGLE_MAPS_API_KEY en variables de entorno."
    );
    return null;
  }

  // Para un análisis inicial, generamos una ruta corta hacia un punto
  // a ~1km al norte, simplemente para obtener la red vial próxima.
  const targetLat = lat + 0.009; // ~1km en latitud
  const targetLng = lng;

  const directionsUrl = new URL(DIRECTIONS_BASE_URL);
  directionsUrl.searchParams.set("origin", `${lat},${lng}`);
  directionsUrl.searchParams.set("destination", `${targetLat},${targetLng}`);
  directionsUrl.searchParams.set("key", apiKey);

  const elevationUrl = new URL(ELEVATION_BASE_URL);
  elevationUrl.searchParams.set("locations", `${lat},${lng}|${targetLat},${targetLng}`);
  elevationUrl.searchParams.set("key", apiKey);

  const [directionsRes, elevationRes] = await Promise.all([
    fetch(directionsUrl.toString()),
    fetch(elevationUrl.toString())
  ]);

  if (!directionsRes.ok) {
    console.error(
      "[googleRoutes] Error en Directions API",
      directionsRes.status,
      await directionsRes.text()
    );
  }
  if (!elevationRes.ok) {
    console.error(
      "[googleRoutes] Error en Elevation API",
      elevationRes.status,
      await elevationRes.text()
    );
  }

  const directionsJson = directionsRes.ok ? await directionsRes.json() : null;
  const elevationJson = elevationRes.ok ? await elevationRes.json() : null;

  const route = directionsJson?.routes?.[0];
  const summary: string =
    route?.summary ??
    (route?.legs?.[0]?.steps ?? [])
      .map((s: any) => s.html_instructions)
      .join(" ") ??
    "";

  const tieneCallesSinPavimentarOCaminoRural = inferUnpavedOrRural(summary);
  const tieneConexionAViasRapidas = inferFastRoad(summary);

  let barrancaOCauce = false;
  let pendientePronunciada = false;

  const results: any[] = elevationJson?.results ?? [];
  if (results.length >= 2) {
    const e1 = Number(results[0].elevation);
    const e2 = Number(results[1].elevation);
    const diff = Math.abs(e2 - e1);
    pendientePronunciada = diff > 15; // diferencia de >15m en ~1km
  }

  // Sin datos directos de "barranca", usamos la combinación pendiente + calles no pavimentadas como proxy.
  barrancaOCauce = pendientePronunciada && tieneCallesSinPavimentarOCaminoRural;

  const resumenPartes: string[] = [];
  if (tieneConexionAViasRapidas) {
    resumenPartes.push(
      "El punto se conecta rápidamente con vías rápidas o carreteras principales."
    );
  }
  if (tieneCallesSinPavimentarOCaminoRural) {
    resumenPartes.push(
      "Se detecta presencia de caminos sin pavimentar o rutas rurales cercanas."
    );
  }
  if (barrancaOCauce) {
    resumenPartes.push(
      "La combinación de pendiente y caminos rurales sugiere posibles cauces o barrancas utilizados como rutas de escape."
    );
  }

  const resumen =
    resumenPartes.join(" ") ||
    "No se detectaron patrones claros de rutas de escape a partir de los datos disponibles.";

  return {
    tieneConexionAViasRapidas,
    tieneCallesSinPavimentarOCaminoRural,
    proximidadACaracteristicasTopograficas: {
      barrancaOCauce,
      pendientePronunciada
    },
    resumen,
    rawDirections: directionsJson,
    rawElevation: elevationJson
  };
}

