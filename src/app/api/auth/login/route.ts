import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { username, password } = (await req.json()) as {
      username?: string;
      password?: string;
    };

    if (!username || !password) {
      return NextResponse.json(
        { error: "Usuario y contraseña son obligatorios." },
        { status: 400 }
      );
    }

    const pool = getPool();
    const { rows } = await pool.query(
      `
      SELECT id, username, password_hash, role, name
      FROM users
      WHERE username = $1
      LIMIT 1
    `,
      [username]
    );

    const user = rows[0];
    if (!user || user.password_hash !== password) {
      return NextResponse.json(
        { error: "Usuario o contraseña incorrectos." },
        { status: 401 }
      );
    }

    return NextResponse.json({
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name,
    });
  } catch (err) {
    console.error("[api/auth/login] Error en login:", err);
    return NextResponse.json(
      { error: "No se pudo iniciar sesión." },
      { status: 500 }
    );
  }
}

