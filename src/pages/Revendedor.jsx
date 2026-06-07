import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { DollarSign, ShoppingCart, Users, TrendingUp } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import { Badge } from "@/components/ui/badge";

export default function Revendedor() {
  const { data: pedidos = [] } = useQuery({
    queryKey: ["pedidos"],
    queryFn: () => base44.entities.Pedido.list("-created_date", 200),
  });

  const { data: comissoes = [] } = useQuery({
    queryKey: ["comissoes"],
    queryFn: () => base44.entities.Comissao.list("-created_date", 200),
  });

  // Agrupa por revendedor
  const revendedores = {};
  pedidos.forEach(p => {
    if (!p.revendedor_nome) return;
    if (!revendedores[p.revendedor_nome]) revendedores[p.revendedor_nome] = { nome: p.revendedor_nome, pedidos: 0, ativados: 0, valor: 0, comissao: 0 };
    revendedores[p.revendedor_nome].pedidos++;
    if (p.status === "ativado") {
      revendedores[p.revendedor_nome].ativados++;
      revendedores[p.revendedor_nome].valor += p.valor || 0;
    }
  });
  comissoes.forEach(c => {
    if (c.tipo !== "revendedor") return;
    if (revendedores[c.vendedor_nome]) revendedores[c.vendedor_nome].comissao += c.valor || 0;
  });

  const lista = Object.values(revendedores).sort((a, b) => b.ativados - a.ativados);
  const totalVendas = lista.reduce((s, r) => s + r.ativados, 0);
  const totalValor = lista.reduce((s, r) => s + r.valor, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Painel de Revendedores</h1>
        <p className="text-muted-foreground mt-1">Hierarquia e comissionamento</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Revendedores Ativos" value={lista.length} icon={Users} />
        <StatCard title="Vendas via Revenda" value={totalVendas} icon={ShoppingCart} />
        <StatCard title="Valor Total" value={`R$ ${totalValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} icon={DollarSign} />
      </div>

      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Revendedor</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Pedidos</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Ativados</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Valor</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Comissão</th>
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 ? (
                <tr><td colSpan={5} className="py-12 text-center text-muted-foreground">Nenhum revendedor encontrado</td></tr>
              ) : lista.map(r => (
                <tr key={r.nome} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-4 font-medium">{r.nome}</td>
                  <td className="py-3 px-4 text-right">{r.pedidos}</td>
                  <td className="py-3 px-4 text-right">
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-600 text-xs">{r.ativados}</Badge>
                  </td>
                  <td className="py-3 px-4 text-right font-medium">R$ {r.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                  <td className="py-3 px-4 text-right text-primary font-medium">R$ {r.comissao.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}