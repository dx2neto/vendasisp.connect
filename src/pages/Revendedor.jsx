import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { DollarSign, ShoppingCart, Users, TrendingUp, Award, ExternalLink, Copy, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useState } from "react";

function StatCard({ title, value, sub, icon: Icon, accent }) {
  return (
    <div className="rounded-2xl bg-card border border-border p-5 hover:shadow-md transition-all">
      <div className="flex items-center justify-between mb-3">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", accent || "bg-primary/10")}>
          <Icon className={cn("w-5 h-5", accent ? "text-white" : "text-primary")} />
        </div>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm text-muted-foreground mt-0.5">{title}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5 opacity-70">{sub}</p>}
    </div>
  );
}

export default function Revendedor() {
  const [copied, setCopied] = useState(null);

  const { data: pedidos = [] } = useQuery({ queryKey: ["pedidos"], queryFn: () => base44.entities.Pedido.list("-created_date", 200) });
  const { data: comissoes = [] } = useQuery({ queryKey: ["comissoes"], queryFn: () => base44.entities.Comissao.list("-created_date", 200) });

  // Agrupa por revendedor
  const revendedores = {};
  pedidos.forEach(p => {
    if (!p.revendedor_nome) return;
    if (!revendedores[p.revendedor_nome]) revendedores[p.revendedor_nome] = {
      id: p.revendedor_id, nome: p.revendedor_nome, pedidos: 0, ativados: 0, valor: 0, comissao: 0, comissao_pendente: 0
    };
    revendedores[p.revendedor_nome].pedidos++;
    if (p.status === "ativado") {
      revendedores[p.revendedor_nome].ativados++;
      revendedores[p.revendedor_nome].valor += p.valor || 0;
    }
  });
  comissoes.forEach(c => {
    if (c.tipo !== "revendedor") return;
    const r = revendedores[c.vendedor_nome];
    if (!r) return;
    r.comissao += c.valor || 0;
    if (c.status === "a_receber") r.comissao_pendente += c.valor || 0;
  });

  const lista = Object.values(revendedores).sort((a, b) => b.ativados - a.ativados);
  const totalAtivos = lista.length;
  const totalVendas = lista.reduce((s, r) => s + r.ativados, 0);
  const totalValor = lista.reduce((s, r) => s + r.valor, 0);
  const totalComissao = lista.reduce((s, r) => s + r.comissao_pendente, 0);
  const maxAtivados = lista[0]?.ativados || 1;

  const copyLink = (nome) => {
    navigator.clipboard.writeText(`${window.location.origin}?revendedor=${encodeURIComponent(nome)}`);
    setCopied(nome);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Central de Revenda</h1>
        <p className="text-muted-foreground mt-0.5 text-sm">Hierarquia, comissionamento e performance dos parceiros</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Revendedores Ativos" value={totalAtivos} icon={Users} />
        <StatCard title="Vendas via Revenda" value={totalVendas} icon={ShoppingCart} sub="clientes ativados" />
        <StatCard title="Valor Gerado" value={`R$ ${totalValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} icon={TrendingUp} />
        <StatCard title="Comissões a Pagar" value={`R$ ${totalComissao.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} icon={DollarSign} sub="pendentes" />
      </div>

      {/* Ranking visual estilo Datacake */}
      {lista.length > 0 && (
        <div className="rounded-2xl bg-card border border-border p-6">
          <div className="flex items-center gap-2 mb-5">
            <Award className="w-5 h-5 text-amber-500" />
            <h3 className="font-semibold">Ranking de Revenda</h3>
          </div>
          <div className="space-y-4">
            {lista.slice(0, 5).map((r, i) => (
              <div key={r.nome} className="flex items-center gap-4">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0",
                  i === 0 ? "bg-amber-100 text-amber-600" :
                  i === 1 ? "bg-slate-100 text-slate-500" :
                  i === 2 ? "bg-orange-100 text-orange-500" : "bg-muted text-muted-foreground"
                )}>{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold truncate">{r.nome}</p>
                    <span className="text-sm font-bold text-primary ml-2 flex-shrink-0">{r.ativados} ativ.</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.round((r.ativados / maxAtivados) * 100)}%` }} />
                  </div>
                </div>
                <div className="text-right text-xs flex-shrink-0 hidden sm:block">
                  <p className="text-emerald-600 font-semibold">R$ {r.comissao.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                  <p className="text-muted-foreground">comissão</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabela detalhada */}
      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="font-semibold text-sm">Todos os Revendedores</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">#</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Revendedor</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Pedidos</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Ativados</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Conversão</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Valor</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Comissão</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Pendente</th>
                <th className="py-3 px-4" />
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 ? (
                <tr><td colSpan={9} className="py-12 text-center text-muted-foreground text-sm">Nenhum revendedor encontrado</td></tr>
              ) : lista.map((r, i) => {
                const conversao = r.pedidos > 0 ? Math.round((r.ativados / r.pedidos) * 100) : 0;
                return (
                  <tr key={r.nome} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 text-muted-foreground text-xs">{i + 1}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                          {r.nome.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium">{r.nome}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right text-muted-foreground">{r.pedidos}</td>
                    <td className="py-3 px-4 text-right">
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 text-xs">{r.ativados}</Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={cn("text-xs font-medium", conversao >= 50 ? "text-emerald-600" : conversao >= 25 ? "text-amber-500" : "text-muted-foreground")}>
                        {conversao}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-medium">R$ {r.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                    <td className="py-3 px-4 text-right font-medium text-primary">R$ {r.comissao.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                    <td className="py-3 px-4 text-right">
                      <Badge variant="outline" className={cn("text-xs", r.comissao_pendente > 0 ? "bg-amber-50 text-amber-600 border-amber-200" : "bg-muted text-muted-foreground")}>
                        R$ {r.comissao_pendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => copyLink(r.nome)}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                        title="Copiar link de vendas"
                      >
                        {copied === r.nome ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}