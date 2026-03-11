export type BrokenWindowsIndicators = {
  basuraOEscombro: boolean;
  malezaOCrecimientoExcesivo: boolean;
  inmueblesAbandonados: boolean;
  posiblesGrafitisOMarcaje: boolean;
  bajaIluminacionONoche: boolean;
  vehiculosAbandonados: boolean;
  estructurasImprovisadas: boolean;
};

export type VisionAnalysisResult = {
  indicadoresVentanasRotas: BrokenWindowsIndicators;
  etiquetasRelevantes: string[];
  textoDetectado: string[];
  rawResponse?: unknown;
};

type VisionRequestOptions = {
  imageBase64?: string;
  imageGcsUri?: string;
};

const BROKEN_WINDOWS_KEYWORDS = [
  "trash",
  "garbage",
  "rubble",
  "litter",
  "debris",
  "dumpster",
  "overgrown grass",
  "tall grass",
  "weeds",
  "abandoned building",
  "ruins",
  "derelict",
  "graffiti",
  "tagging",
  "vandalism",
  "dark",
  "night",
  "low light",
  "burned car",
  "abandoned car",
  "junkyard",
  "shack",
  "improvised structure",
  "tent",
  "makeshift"
];

function normalizeLabel(label: string): string {
  return label.toLowerCase();
}

function mapLabelsToIndicators(labels: string[]): BrokenWindowsIndicators {
  const norm = labels.map(normalizeLabel);

  const includesAny = (candidates: string[]) =>
    candidates.some((c) => norm.some((l) => l.includes(c)));

  return {
    basuraOEscombro: includesAny([
      "trash",
      "garbage",
      "rubbish",
      "litter",
      "debris",
      "rubble",
      "dumpster"
    ]),
    malezaOCrecimientoExcesivo: includesAny([
      "overgrown",
      "tall grass",
      "weeds",
      "bush",
      "shrub",
      "vegetation overgrowth"
    ]),
    inmueblesAbandonados: includesAny([
      "abandoned building",
      "ruins",
      "dilapidated",
      "run-down"
    ]),
    posiblesGrafitisOMarcaje: includesAny([
      "graffiti",
      "vandalism",
      "street art"
    ]),
    bajaIluminacionONoche: includesAny([
      "night",
      "darkness",
      "low light"
    ]),
    vehiculosAbandonados: includesAny([
      "abandoned car",
      "wrecked car",
      "burned car",
      "junkyard"
    ]),
    estructurasImprovisadas: includesAny([
      "shack",
      "tent",
      "improvised structure",
      "makeshift"
    ])
  };
}

export async function analyzeBrokenWindowsWithVision(
  options: VisionRequestOptions
): Promise<VisionAnalysisResult | null> {
  const apiKey =
    process.env.GOOGLE_CLOUD_VISION_API_KEY || process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    console.warn(
      "[googleVision] No se encontró GOOGLE_CLOUD_VISION_API_KEY ni GOOGLE_MAPS_API_KEY en variables de entorno."
    );
    return null;
  }

  const image: Record<string, unknown> = {};

  if (options.imageBase64) {
    image.content = options.imageBase64;
  } else if (options.imageGcsUri) {
    image.source = { imageUri: options.imageGcsUri };
  } else {
    throw new Error(
      "analyzeBrokenWindowsWithVision requiere imageBase64 o imageGcsUri"
    );
  }

  const url = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;

  const body = {
    requests: [
      {
        image,
        features: [
          {
            type: "LABEL_DETECTION",
            maxResults: 50
          },
          {
            type: "TEXT_DETECTION",
            maxResults: 10
          }
        ]
      }
    ]
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    console.error(
      "[googleVision] Error al llamar a Vision API",
      response.status,
      await response.text()
    );
    return null;
  }

  const data = (await response.json()) as any;
  const firstResponse = data.responses?.[0];

  const labelAnnotations: string[] =
    firstResponse?.labelAnnotations?.map((l: any) => l.description) ?? [];

  // Filtrar solo las etiquetas cercanas a nuestros indicadores de Ventanas Rotas
  const etiquetasRelevantes = labelAnnotations.filter((label) =>
    BROKEN_WINDOWS_KEYWORDS.some((kw) =>
      normalizeLabel(label).includes(kw.toLowerCase())
    )
  );

  const textoDetectado: string[] =
    firstResponse?.textAnnotations
      ?.slice(1)
      ?.map((t: any) => String(t.description))
      ?? [];

  const indicadoresVentanasRotas = mapLabelsToIndicators(labelAnnotations);

  return {
    indicadoresVentanasRotas,
    etiquetasRelevantes,
    textoDetectado,
    rawResponse: data
  };
}

