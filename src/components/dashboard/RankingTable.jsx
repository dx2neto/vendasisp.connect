import { useMemo } from "react";
import { Trophy } from "lucide-react";

export default function RankingTable({ pedidos = [] }) {
  const ranking = useMemo(() => {
    const map = {};
    pedidos.forEach(p => {
      if (!p.vendedor_nome) return;
      if (!map[p.vendedor_nome]) map[p.vendedor_nome] = { nome: p.vendedor_nome, total: 0, ativados: 0, valor: 0 };
      map[p.vendedor_nome].total++;
      if (p.status === "ativado") {
        map[p.vendedor_nome].ativados++;
        map[p.vendedor_nome].valor += p.valor || 0;
      }
    });
    return Object.values(map).sort((a, b) => b.ativados - a.ativados).slice(0, 10);
  }, [pedidos]);

  if (ranking.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Nenhum vendedor encontrado</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-3 px-4 font-medium text-muted-foreground">#</th>
            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Vendedor</th>
            <th className="text-right py-3 px-4 font-medium text-muted-foreground">Pedidos</th>
            <th className="text-right py-3 px-4 font-medium text-muted-foreground">Ativados</th>
            <th className="text-right py-3 px-4 font-medium text-muted-foreground">Valor</th>
          </tr>
        </thead>
        <tbody>
          {ranking.map((r, i) => (
            <tr key={r.nome} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
              <td className="py-3 px-4">
                {i < 3 ? <Trophy className={`w-4 h-4 ${i === 0 ? "text-yellow-500" : i === 1 ? "text-gray-400" : "text-amber-700"}`} /> : <span className="text-muted-foreground">{i + 1}</span>}
              </td>
              <td className="py-3 px-4 font-medium">{r.nome}</td>
              <td className="py-3 px-4 text-right">{r.total}</td>
              <td className="py-3 px-4 text-right">
                <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full text-xs font-semibold">{r.ativados}</span>
              </td>
              <td className="py-3 px-4 text-right font-medium">R$ {r.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}