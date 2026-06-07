import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const COLORS = ["hsl(199,89%,48%)", "hsl(174,72%,40%)", "hsl(262,52%,55%)", "hsl(38,92%,50%)", "hsl(150,60%,40%)"];
const LABELS = {
  novo: "Novo Lead",
  analise_credito: "Crédito",
  viabilidade: "Viabilidade",
  contrato_pendente: "Contrato",
  ativado: "Ativado"
};

export default function FunnelChart({ pedidos = [] }) {
  const stages = ["novo", "analise_credito", "viabilidade", "contrato_pendente", "ativado"];
  const data = stages.map((s, i) => ({
    name: LABELS[s] || s,
    count: pedidos.filter(p => p.status === s || (s === "contrato_pendente" && p.status === "assinado")).length,
    color: COLORS[i]
  }));

  return (
    <div className="h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 20, right: 20 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 13, fill: "hsl(215,14%,46%)" }} />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: "1px solid hsl(214,20%,90%)", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
          />
          <Bar dataKey="count" radius={[0, 8, 8, 0]} barSize={32}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}