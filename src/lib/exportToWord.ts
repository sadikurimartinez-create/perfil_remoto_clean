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

    // 3. Cargar la imagen de forma segura (sirve tanto para blob: como para objectUrl http descargada)
    const img = new Image();
    img.crossOrigin = "Anonymous";
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

export async function exportToWord(
  content: string,
  projectName: string,
  attachedPhotos?: string[]
) {
  const lines = content.split(/\r?\n/);

  const paragraphs = lines.map(
    (line) =>
      new Paragraph({
        children: [new TextRun(line)],
      })
  );

  const sections: any[] = [
    {
      children: paragraphs,
    },
  ];

  if (attachedPhotos && attachedPhotos.length > 0) {
    const imagesBuffers: ArrayBuffer[] = [];
    for (const url of attachedPhotos) {
      try {
        const stamped = await applyWatermarkForWord(url);
        imagesBuffers.push(stamped);
      } catch (err) {
        console.warn(
          "[exportToWord] No se pudo procesar una imagen para el anexo fotográfico:",
          url,
          err
        );
        // si una imagen falla, seguimos con las restantes
      }
    }

    if (imagesBuffers.length > 0) {
      const imageParagraphs = imagesBuffers.map(
        (buf) =>
          new Paragraph({
            children: [
              new ImageRun({
                // cast a any para satisfacer los tipos de docx (imagen raster estándar)
                ...( {
                  data: buf,
                  transformation: {
                    width: 500,
                    height: 350,
                  },
                } as any),
              }),
            ],
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

