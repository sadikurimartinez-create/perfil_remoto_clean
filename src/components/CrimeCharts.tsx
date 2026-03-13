"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

type CrimeRecord = {
  lat: number;
  lng: number;
  tipoDelito: string;
  rangoHorario: string | null;
};

const COLORS_BAR = ["#ef4444", "#dc2626", "#b91c1c", "#991b1b", "#7f1d1d"];
const COLORS_PIE = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#6366f1", "#a855f7"];

export function CrimeCharts({ crimes }: { crimes: CrimeRecord[] }) {
  const byTipo = Object.entries(
    crimes.reduce<Record<string, number>>((acc, c) => {
      const t = c.tipoDelito || "Sin tipo";
      acc[t] = (acc[t] ?? 0) + 1;
      return acc;
    }, {})
  )
    .map(([name, cantidad]) => ({ name, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 10);

  const byRango = Object.entries(
    crimes.reduce<Record<string, number>>((acc, c) => {
      const r = c.rangoHorario || "Sin rango";
      acc[r] = (acc[r] ?? 0) + 1;
      return acc;
    }, {})
  )
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  if (crimes.length === 0) {
    return (
      <p className="text-sm text-slate-500 py-4">
        No hay datos de incidencia para graficar. Ejecute un análisis de selección con fotos con coordenadas.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <h4 className="text-sm font-semibold text-slate-200">
        Gráficas periciales · Incidencia en la zona
      </h4>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
          <p className="text-xs text-slate-400 mb-2">Por tipo de delito</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byTipo} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
              <XAxis
                dataKey="name"
                tick={{ fill: "#cbd5e1", fontSize: 10 }}
                tickLine={{ stroke: "#475569" }}
                axisLine={{ stroke: "#475569" }}
                angle={-35}
                textAnchor="end"
                height={56}
              />
              <YAxis
                tick={{ fill: "#cbd5e1", fontSize: 10 }}
                tickLine={{ stroke: "#475569" }}
                axisLine={{ stroke: "#475569" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "1px solid #475569",
                  borderRadius: "6px",
                  color: "#cbd5e1",
                }}
                labelStyle={{ color: "#cbd5e1" }}
              />
              <Bar dataKey="cantidad" fill="#ef4444" radius={[4, 4, 0, 0]} name="Cantidad" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
          <p className="text-xs text-slate-400 mb-2">Por rango horario</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={byRango}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={72}
                label={({ name, percent }) =>
                  `${name} ${(percent * 100).toFixed(0)}%`
                }
              >
                {byRango.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS_PIE[index % COLORS_PIE.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "1px solid #475569",
                  borderRadius: "6px",
                  color: "#cbd5e1",
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 10 }}
                formatter={(value) => <span className="text-slate-300">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
