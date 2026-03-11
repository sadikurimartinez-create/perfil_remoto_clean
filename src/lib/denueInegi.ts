export type DenueUnit = {
  id: string;
  nombre: string;
  razonSocial?: string;
  actividad?: string;
  lat: number;
  lng: number;
  fuente: "DENUE_INEGI";
};

export type DenueSearchResult = {
  unidades: DenueUnit[];
};

const DENUE_BASE_URL =
  "https://www.inegi.org.mx/app/api/denue/v1/consulta";

function getDenueToken(): string | null {
  return process.env.INEGI_DENUE_TOKEN ?? null;
}

/**
 * Consulta simplificada a DENUE por radio alrededor de un punto.
 *
 * IMPORTANTE: La API de DENUE tiene varios métodos (Buscar, BuscarEntidad, etc.).
 * Aquí usamos "Buscar" con texto genérico para obtener unidades económicas cercanas.
 * Revisa la documentación oficial para ajustar texto/distancia según tus necesidades.
 */
export async function searchDenueAround(
  lat: number,
  lng: number,
  radiusMeters: number,
  textoBusqueda: string = ""
): Promise<DenueSearchResult | null> {
  const token = getDenueToken();
  if (!token) {
    console.warn(
      "[denueInegi] Falta INEGI_DENUE_TOKEN en variables de entorno."
    );
    return null;
  }

  const distancia = Math.round(radiusMeters);
  const texto = textoBusqueda || "a"; // texto muy general para traer múltiples resultados

  const url = `${DENUE_BASE_URL}/Buscar/${encodeURIComponent(
    texto
  )}/${lat},${lng}/${distancia}/${token}`;

  const response = await fetch(url);
  if (!response.ok) {
    console.error(
      "[denueInegi] Error al consultar DENUE",
      response.status,
      await response.text()
    );
    return null;
  }

  const data = (await response.json()) as any[];

  const unidades: DenueUnit[] = (data ?? []).map((u: any) => ({
    id: String(u.id),
    nombre: String(u.nombre),
    razonSocial: u.raz_social ? String(u.raz_social) : undefined,
    actividad: u.clase_actividad ? String(u.clase_actividad) : undefined,
    lat: Number(u.latitud),
    lng: Number(u.longitud),
    fuente: "DENUE_INEGI"
  }));

  return { unidades };
}

