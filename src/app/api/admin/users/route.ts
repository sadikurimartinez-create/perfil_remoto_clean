import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";

export async function GET() {
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `
      SELECT id, username, role, name, created_at
      FROM users
      ORDER BY created_at DESC
    `
    );
    return NextResponse.json(rows);
  } catch (err) {
    console.error("[api/admin/users] Error en GET:", err);
    return NextResponse.json(
      { error: "No se pudieron listar los usuarios." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { username, password, name } = (await req.json()) as {
      username?: string;
      password?: string;
      name?: string;
    };

    if (!username || !password || !name) {
      return NextResponse.json(
        { error: "Nombre, usuario y contraseña son obligatorios." },
        { status: 400 }
      );
    }

    const pool = getPool();
    await pool.query(
      `
      INSERT INTO users (username, password_hash, role, name)
      VALUES ($1, $2, 'USER', $3)
    `,
      [username, password, name]
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[api/admin/users] Error en POST:", err);
    if (err?.code === "23505") {
      // unique_violation
      return NextResponse.json(
        { error: "Ya existe un usuario con ese nombre." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "No se pudo registrar el usuario." },
      { status: 500 }
    );
  }
}

