import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Perfil Criminológico Ambiental",
  description:
    "Plataforma para análisis criminológico ambiental a partir de evidencia fotográfica georreferenciada.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100">
        <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-4 py-6 md:py-10">
          {children}
        </main>
      </body>
    </html>
  );
}
