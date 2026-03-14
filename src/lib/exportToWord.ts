import { Document, ImageRun, Packer, Paragraph, TextRun } from "docx";
import { saveAs } from "file-saver";

async function applyWatermarkForWord(imageUrl: string): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("No se pudo crear el contexto de canvas"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = "white";
      ctx.font = "bold 80px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((-45 * Math.PI) / 180);
      ctx.fillText("SSP AGS - CEIPOL", 0, 0);
      ctx.restore();

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("No se pudo generar el blob de la imagen"));
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            const res = reader.result;
            if (!(res instanceof ArrayBuffer)) {
              reject(new Error("No se pudo leer la imagen estampada"));
              return;
            }
            resolve(res);
          };
          reader.onerror = () => reject(reader.error);
          reader.readAsArrayBuffer(blob);
        },
        "image/jpeg",
        0.9
      );
    };
    img.onerror = () => {
      reject(new Error("No se pudo cargar la imagen para el sello de agua"));
    };
    img.src = imageUrl;
  });
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
      } catch {
        // si una falla, seguimos con las demás
      }
    }

    if (imagesBuffers.length > 0) {
      const imageParagraphs = imagesBuffers.map(
        (buf) =>
          new Paragraph({
            children: [
              new ImageRun({
                data: buf,
                transformation: {
                  width: 500,
                  height: 350,
                },
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

