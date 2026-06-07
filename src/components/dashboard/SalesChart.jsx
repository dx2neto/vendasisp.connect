import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useMemo } from "react";

export default function SalesChart({ pedidos = [] }) {
  const data = useMemo(() => {
    const months = {};
    pedidos.forEach(p => {
      if (!p.created_date) return;
      const d = new Date(p.created_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("pt-BR", { month: "short" });
      if (!months[key]) months[key] = { name: label, vendas: 0, valor: 0 };
      months[key].vendas++;
      months[key].valor += p.valor || 0;
    });
    return Object.values(months).slice(-6);
  }, [pedidos]);

  if (data.length === 0) {
    return <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">Sem dados de vendas</div>;
  }

  return (
    <div className="h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <defs>
            <linearGradient id="colorVendas" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(199,89%,48%)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(199,89%,48%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: "hsl(215,14%,46%)" }} />
          <YAxis hide />
          <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(214,20%,90%)" }} />
          <Area type="monotone" dataKey="vendas" stroke="hsl(199,89%,48%)" fill="url(#colorVendas)" strokeWidth={2.5} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}