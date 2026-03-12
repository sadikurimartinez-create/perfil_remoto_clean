import { Document, Packer, Paragraph, TextRun } from "docx";
import { saveAs } from "file-saver";

export async function exportToWord(content: string, projectName: string) {
  const lines = content.split(/\r?\n/);

  const paragraphs = lines.map(
    (line) =>
      new Paragraph({
        children: [new TextRun(line)],
      })
  );

  const doc = new Document({
    sections: [
      {
        children: paragraphs,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const safeName =
    projectName
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "_") || "SinNombre";

  saveAs(blob, `Dictamen_${safeName}.docx`);
}

