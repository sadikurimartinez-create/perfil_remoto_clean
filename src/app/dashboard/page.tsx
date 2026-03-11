export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-4 py-6">
      <div className="max-w-5xl mx-auto space-y-4">
        <header className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Dashboard Analítico Ambiental
          </h1>
          <p className="text-sm text-slate-400">
            Vista preliminar del Perfil Criminológico Ambiental generado. 
            Próximamente aquí se mostrarán mapas, alertas y análisis 
            detallados para el personal de inteligencia.
          </p>
        </header>

        <section className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-2">
          <p className="text-sm text-slate-200 font-semibold">
            Perfil generado correctamente
          </p>
          <p className="text-xs text-slate-400">
            El levantamiento in situ ha sido procesado. La información ya puede 
            ser consultada en el sistema interno (base de datos y módulos 
            analíticos). Esta pantalla es un placeholder de validación para 
            confirmar que el flujo de captura y envío funciona en campo.
          </p>
        </section>
      </div>
    </div>
  );
}
