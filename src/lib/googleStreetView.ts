export type StreetViewComparison = {
  streetViewImageUrl: string | null;
};

const STREET_VIEW_BASE_URL =
  "https://maps.googleapis.com/maps/api/streetview";

export function buildStreetViewUrl(
  lat: number,
  lng: number,
  options?: { size?: string; fov?: number; pitch?: number; heading?: number }
): string | null {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.warn(
      "[googleStreetView] Falta GOOGLE_MAPS_API_KEY en variables de entorno."
    );
    return null;
  }

  const size = options?.size ?? "640x640";

  const url = new URL(STREET_VIEW_BASE_URL);
  url.searchParams.set("size", size);
  url.searchParams.set("location", `${lat},${lng}`);
  url.searchParams.set("key", apiKey);

  if (typeof options?.fov === "number") {
    url.searchParams.set("fov", String(options.fov));
  }
  if (typeof options?.pitch === "number") {
    url.searchParams.set("pitch", String(options.pitch));
  }
  if (typeof options?.heading === "number") {
    url.searchParams.set("heading", String(options.heading));
  }

  return url.toString();
}

export function getStreetViewComparison(
  lat: number,
  lng: number
): StreetViewComparison {
  const streetViewImageUrl = buildStreetViewUrl(lat, lng);
  return { streetViewImageUrl };
}

