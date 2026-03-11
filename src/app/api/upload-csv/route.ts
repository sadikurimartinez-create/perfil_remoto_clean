import { NextResponse } from "next/server";
import { parse } from "csv-parse/sync";
import { getPool } from "@/lib/db";

type CsvRow = {
  INCIDENTE: string;
  FECHA: string;
  HORA: string;
  RANGO?: string;
  NOM_ASEN?: string;
  LAT: string;
  LONG: string;
};

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Debe enviar un archivo CSV en el campo 'file'." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const csvText = Buffer.from(arrayBuffer).toString("utf8");

    const records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as CsvRow[];

    const client = await getPool().connect();
    try {
      await client.query("BEGIN");

      for (const row of records) {
        const lat = parseFloat(row.LAT);
        const lng = parseFloat(row.LONG);
        if (Number.isNaN(lat) || Number.isNaN(lng)) continue;

        // Normalizar hora: aceptar valores como "7" o "07" y convertirlos a "07:00:00"
        let hora = row.HORA.trim();
        if (/^\d{1,2}$/.test(hora)) {
          const hh = hora.padStart(2, "0");
          hora = `${hh}:00:00`;
        }

        await client.query(
          `
          INSERT INTO incidencia_estadistica (
            incidente,
            fecha,
            hora,
            rango_horario,
            nom_asen,
            fuente_archivo,
            geometria
          )
          VALUES (
            $1,
            $2::date,
            $3::time,
            $4,
            $5,
            $6,
            ST_SetSRID(ST_MakePoint($7, $8), 4326)::geography
          )
        `,
          [
            row.INCIDENTE,
            row.FECHA,
            hora,
            row.RANGO ?? null,
            row.NOM_ASEN ?? null,
            file.name,
            lng,
            lat,
          ]
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("[upload-csv] Error en transacción:", error);
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? `Error al guardar los registros en la base de datos: ${error.message}`
              : "Error al guardar los registros en la base de datos.",
        },
        { status: 500 }
      );
    } finally {
      client.release();
    }

    return NextResponse.json(
      { ok: true, registros: records.length },
      { status: 200 }
    );
  } catch (error) {
    console.error("[upload-csv] Error general:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Error al procesar el CSV: ${error.message}`
            : "Error al procesar el CSV.",
      },
      { status: 500 }
    );
  }
}

