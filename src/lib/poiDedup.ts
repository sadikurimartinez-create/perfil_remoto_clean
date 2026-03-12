export type PointOfInterest = {
  name: string;
  category: string;
  lat: number;
  lng: number;
  source: "DENUE" | "GOOGLE" | "MERGED";
};

function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371e3;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const GENERIC_WORDS = new Set([
  "tienda",
  "abarrotes",
  "de",
  "la",
  "el",
  "y",
  "mini",
  "maxi",
  "super",
]);

function normalizeName(raw: string): string {
  const lower = raw.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  const words = lower
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !GENERIC_WORDS.has(w));
  return words.join(" ");
}

function areSimilarByName(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return na === nb;
  return na.includes(nb) || nb.includes(na);
}

export function mergeAndDeduplicatePOIs(
  denueData: PointOfInterest[],
  googleData: PointOfInterest[]
): PointOfInterest[] {
  const combined = [...denueData, ...googleData];
  const unique: PointOfInterest[] = [];

  for (const poi of combined) {
    const existing = unique.find((u) => {
      const d = haversineMeters(u.lat, u.lng, poi.lat, poi.lng);
      if (d > 20) return false;
      return areSimilarByName(u.name, poi.name);
    });

    if (!existing) {
      unique.push(poi);
    } else {
      existing.source = "MERGED";
    }
  }

  return unique;
}

