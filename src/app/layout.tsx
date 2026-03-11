import type { Metadata } from "next";
import "./globals.css";
import { InstitutionalHeader } from "@/components/InstitutionalHeader";
import { ProjectProvider } from "@/context/ProjectContext";

export const metadata: Metadata = {
  title: "Perfilador Remoto",
  description:
    "Plataforma del Centro de Estudios y Política Criminal (CEIPOL) - SSP Aguascalientes. Análisis criminológico ambiental a partir de evidencia fotográfica georreferenciada.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100">
        <InstitutionalHeader />
        <ProjectProvider>
          <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-4 py-6 md:py-10">
            {children}
          </main>
        </ProjectProvider>
      </body>
    </html>
  );
}

