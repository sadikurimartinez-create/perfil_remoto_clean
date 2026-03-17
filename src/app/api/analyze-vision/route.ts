import { NextResponse } from "next/server";
import { analyzeBrokenWindowsWithVision } from "@/lib/googleVision";

type VisionRequestBody = {
  imageBase64?: string;
  imageUrl?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as VisionRequestBody;
    const { imageBase64, imageUrl } = body;

    if (!imageBase64 && !imageUrl) {
      return NextResponse.json(
        { error: "Se requiere imageBase64 o imageUrl para analizar la imagen." },
        { status: 400 }
      );
    }

    const visionResult = await analyzeBrokenWindowsWithVision({
      imageBase64,
      imageGcsUri: imageUrl,
    });

    if (!visionResult) {
      return NextResponse.json(
        { faces: { count: 0, headwear: false }, extractedText: "" },
        { status: 200 }
      );
    }

    // Reutilizamos textoDetectado y etiquetas, pero construimos una vista táctica
    const extractedText =
      visionResult.textoDetectado?.join(" ").replace(/\s+/g, " ").trim() ?? "";

    // Para FaceDetection confiamos en que Vision API ya haya sido configurada en googleVision
    // Si en el futuro se añaden las anotaciones de rostro al resultado crudo, aquí se mapearían.
    const facesInfo = (() => {
      const raw = (visionResult.rawResponse as any)?.responses?.[0];
      const faceAnnotations: any[] = raw?.faceAnnotations ?? [];
      const count = faceAnnotations.length;
      const hasHeadwear = faceAnnotations.some(
        (f) =>
          (f.headwearLikelihood === "VERY_LIKELY" ||
            f.headwearLikelihood === "LIKELY" ||
            f.headwearLikelihood === "POSSIBLE")
      );
      return { count, headwear: hasHeadwear };
    })();

    return NextResponse.json(
      {
        faces: facesInfo,
        extractedText,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[api/analyze-vision] Error inesperado:", error);
    return NextResponse.json(
      { error: "Error interno al analizar imagen con Vision API." },
      { status: 500 }
    );
  }
}

