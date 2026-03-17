import { Document, ImageRun, Packer, Paragraph, TextRun } from "docx";
import { saveAs } from "file-saver";

async function applyWatermarkForWord(imageUrl: string): Promise<ArrayBuffer> {
  let objectUrl: string | null = null;
  try {
    let imgSrc = imageUrl;

    // Si es una URL HTTP/HTTPS, descargar vía fetch para evitar CORS/taint
    if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
      const response = await fetch(imageUrl, { mode: "cors" });
      if (!response.ok) {
        throw new Error(`No se pudo descargar la imagen (${response.status})`);
      }
      const blob = await response.blob();
      objectUrl = URL.createObjectURL(blob);
      imgSrc = objectUrl;
    }

    const img = new Image();
    if (imgSrc.startsWith("http://") || imgSrc.startsWith("https://")) {
      img.crossOrigin = "Anonymous";
    }
    img.src = imgSrc;

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () =>
        reject(new Error("Error cargando la imagen para el Word"));
    });

    // 4. Lógica del canvas
    const canvas = document.createElement("canvas");
    canvas.width = img.width || img.naturalWidth;
    canvas.height = img.height || img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("No se pudo crear el contexto de canvas");
    }

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const fontSize = Math.floor(canvas.width / 15) || 48;
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(-Math.PI / 4);
    ctx.fillText("SSP AGS - CEIPOL", 0, 0);
    ctx.restore();

    // 5. Devolver ArrayBuffer para docx
    const stampedBuffer: ArrayBuffer = await new Promise((resolve, reject) => {
      canvas.toBlob(
        async (outBlob) => {
          if (!outBlob) {
            reject(new Error("No se pudo generar el blob de la imagen"));
            return;
          }
          const arrayBuffer = await outBlob.arrayBuffer();
          resolve(arrayBuffer);
        },
        "image/jpeg",
        0.85
      );
    });

    return stampedBuffer;
  } finally {
    // Liberar memoria del URL temporal si se creó
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  }
}

function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer {
  const base64 = dataUrl.indexOf(",") >= 0 ? dataUrl.split(",")[1] : dataUrl;
  if (!base64) throw new Error("Data URL inválida");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export async function exportToWord(
  content: string,
  projectName: string,
  attachedPhotos?: string[],
  riskLevel?: "bajo" | "medio" | "alto",
  mapImageDataUrl?: string
) {
  const lines = content.split(/\r?\n/);

  const paragraphs = lines.map(
    (line) =>
      new Paragraph({
        children: [new TextRun(line)],
      })
  );

  if (riskLevel) {
    const label =
      riskLevel === "bajo"
        ? "Nivel de riesgo: Bajo"
        : riskLevel === "medio"
          ? "Nivel de riesgo: Medio"
          : "Nivel de riesgo: Alto";
    paragraphs.unshift(
      new Paragraph({
        children: [
          new TextRun({
            text: label,
            bold: true,
            size: 28,
          }),
        ],
      }),
      new Paragraph({ children: [new TextRun("")] })
    );
  }

  const sections: any[] = [
    {
      children: paragraphs,
    },
  ];

  if (attachedPhotos && attachedPhotos.length > 0) {
    const imageRuns: ImageRun[] = [];
    const WORD_MAX_WIDTH = 500;
    for (const url of attachedPhotos) {
      try {
        const stampedBuffer = await applyWatermarkForWord(url);
        // Reconstruir un objeto Image para conocer el aspect ratio
        const img = new Image();
        img.src = url;
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () =>
            reject(
              new Error(
                "[exportToWord] No se pudo calcular dimensiones originales de la imagen"
              )
            );
        });
        const originalWidth = img.width || img.naturalWidth || WORD_MAX_WIDTH;
        const originalHeight = img.height || img.naturalHeight || WORD_MAX_WIDTH;
        const ratio = originalHeight / originalWidth || 1;
        const proportionalHeight = Math.floor(WORD_MAX_WIDTH * ratio);

        imageRuns.push(
          new ImageRun({
            ...({
              data: stampedBuffer,
              transformation: {
                width: WORD_MAX_WIDTH,
                height: proportionalHeight,
              },
            } as any),
          })
        );
      } catch (err) {
        console.warn(
          "[exportToWord] No se pudo procesar una imagen para el anexo fotográfico:",
          url,
          err
        );
        // si una imagen falla, seguimos con las restantes
      }
    }

    if (imageRuns.length > 0) {
      const imageParagraphs = imageRuns.map(
        (run) =>
          new Paragraph({
            children: [run],
          })
      );

      sections.push({
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: "ANEXO FOTOGRÁFICO",
                bold: true,
                size: 32,
              }),
            ],
          }),
          ...imageParagraphs,
        ],
      });
    }
  }

  if (mapImageDataUrl && mapImageDataUrl.startsWith("data:image")) {
    try {
      // Crear imagen temporal para respetar proporción del mapa
      const tmpImg = new Image();
      tmpImg.src = mapImageDataUrl;
      await new Promise<void>((resolve, reject) => {
        tmpImg.onload = () => resolve();
        tmpImg.onerror = () =>
          reject(
            new Error(
              "[exportToWord] No se pudieron leer dimensiones del mapa para Word"
            )
          );
      });
      const MAP_MAX_WIDTH = 600;
      const originalWidth = tmpImg.width || tmpImg.naturalWidth || MAP_MAX_WIDTH;
      const originalHeight =
        tmpImg.height || tmpImg.naturalHeight || MAP_MAX_WIDTH;
      const ratio = originalHeight / originalWidth || 1;
      const proportionalHeight = Math.floor(MAP_MAX_WIDTH * ratio);

      const mapBuffer = dataUrlToArrayBuffer(mapImageDataUrl);
      sections.push({
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: "MAPA DEL ANÁLISIS",
                bold: true,
                size: 32,
              }),
            ],
          }),
          new Paragraph({
            children: [
              new ImageRun({
                ...({
                  data: mapBuffer,
                  transformation: {
                    width: MAP_MAX_WIDTH,
                    height: proportionalHeight,
                  },
                } as any),
              }),
            ],
          }),
        ],
      });
    } catch (e) {
      console.warn("[exportToWord] No se pudo incluir el mapa:", e);
    }
  }

  const doc = new Document({
    sections,
  });

  const blob = await Packer.toBlob(doc);
  const safeName =
    projectName
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "_") || "SinNombre";

  saveAs(blob, `Dictamen_${safeName}.docx`);
}

