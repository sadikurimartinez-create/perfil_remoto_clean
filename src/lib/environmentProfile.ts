import type { VisionAnalysisResult } from "./googleVision";
import type { PlacesAnalysisResult } from "./googlePlaces";
import type { DenueSearchResult } from "./denueInegi";
import type { RouteEscapeAnalysis } from "./googleRoutes";
import type { StreetViewComparison } from "./googleStreetView";

export type DeterioroFisico = {
  vision?: VisionAnalysisResult | null;
  comparacionStreetView?: StreetViewComparison | null;
};

export type ComerciosIrregulares = {
  posiblesIrregulares: {
    lugarGoogle: {
      nombre: string;
      direccion: string;
    };
    motivo: string;
  }[];
  rawPlaces?: PlacesAnalysisResult | null;
  rawDenue?: DenueSearchResult | null;
};

export type AtractoresDelito = {
  puntosConflictoEscuelaAlcohol: {
    escuela: {
      nombre: string;
      direccion: string;
    };
    expendioAlcohol: {
      nombre: string;
      direccion: string;
    };
    distanciaMetros: number;
  }[];
  resumen: string;
};

export type AnalisisRutas = RouteEscapeAnalysis | null;

export type EnvironmentProfile = {
  deterioroFisico: DeterioroFisico;
  comerciosIrregulares: ComerciosIrregulares;
  atractoresDelito: AtractoresDelito;
  analisisRutas: AnalisisRutas;
};

export function buildConflictPoints(
  places: PlacesAnalysisResult | null,
  maxDistanceMeters: number
): AtractoresDelito {
  if (!places) {
    return {
      puntosConflictoEscuelaAlcohol: [],
      resumen:
        "No se encontraron datos suficientes de comercios/escuelas en el radio analizado."
    };
  }

  const conflictos: AtractoresDelito["puntosConflictoEscuelaAlcohol"] = [];

  for (const escuela of places.escuelas) {
    for (const alcohol of places.expendiosAlcohol) {
      const d = distanciaEnMetros(
        escuela.lat,
        escuela.lng,
        alcohol.lat,
        alcohol.lng
      );
      if (d <= maxDistanceMeters) {
        conflictos.push({
          escuela: {
            nombre: escuela.nombre,
            direccion: escuela.direccion
          },
          expendioAlcohol: {
            nombre: alcohol.nombre,
            direccion: alcohol.direccion
          },
          distanciaMetros: Math.round(d)
        });
      }
    }
  }

  let resumen: string;
  if (conflictos.length === 0) {
    resumen =
      "No se detectaron conflictos evidentes entre escuelas y expendios de alcohol en la proximidad analizada.";
  } else {
    resumen = `Se detectaron ${conflictos.length} posibles puntos de conflicto escuela–expendio de alcohol dentro de ${maxDistanceMeters} metros.`;
  }

  return {
    puntosConflictoEscuelaAlcohol: conflictos,
    resumen
  };
}

export function buildIrregularBusinesses(
  places: PlacesAnalysisResult | null,
  denue: DenueSearchResult | null
): ComerciosIrregulares {
  const posiblesIrregulares: ComerciosIrregulares["posiblesIrregulares"] = [];

  if (!places || !denue) {
    return {
      posiblesIrregulares,
      rawPlaces: places,
      rawDenue: denue
    };
  }

  const denueByName = new Map<string, any>();
  for (const u of denue.unidades) {
    denueByName.set(u.nombre.toLowerCase(), u);
  }

  for (const candidate of places.chatarrerasOTalleres) {
    const match =
      denueByName.get(candidate.nombre.toLowerCase()) ??
      Array.from(denueByName.values()).find((u) =>
        candidate.nombre.toLowerCase().includes(u.nombre.toLowerCase())
      );

    if (!match) {
      posiblesIrregulares.push({
        lugarGoogle: {
          nombre: candidate.nombre,
          direccion: candidate.direccion
        },
        motivo:
          "Detectada actividad tipo chatarrera/taller por Google Places, sin unidad económica correspondiente en DENUE en el radio analizado."
      });
    }
  }

  return {
    posiblesIrregulares,
    rawPlaces: places,
    rawDenue: denue
  };
}

function distanciaEnMetros(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

