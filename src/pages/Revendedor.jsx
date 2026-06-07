import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { DollarSign, ShoppingCart, Users, TrendingUp, Award, ExternalLink, Copy, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useState } from "react";

function StatCard({ title, value, sub, icon: Icon, accent }) {
  return (
    <div className="rounded-xl sm:rounded-2xl bg-card border border-border p-3 sm:p-5 hover:shadow-md transition-all">
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <div className={cn("w-8 sm:w-10 h-8 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center", accent || "bg-primary/10")}>
          <Icon className={cn("w-4 sm:w-5 h-4 sm:h-5", accent ? "text-white" : "text-primary")} />
        </div>
      </div>
      <p className="text-lg sm:text-2xl font-bold truncate">{value}</p>
      <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 line-clamp-2">{title}</p>
      {sub && <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 opacity-70">{sub}</p>}
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
    <div className="space-y-4 sm:space-y-6 pb-20 sm:pb-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Central de Revenda</h1>
        <p className="text-muted-foreground mt-0.5 text-xs sm:text-sm">Performance dos parceiros</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <StatCard title="Ativos" value={totalAtivos} icon={Users} />
        <StatCard title="Vendas" value={totalVendas} icon={ShoppingCart} sub="ativadas" />
        <StatCard title="Valor" value={`R$ ${(totalValor / 1000).toFixed(0)}k`} icon={TrendingUp} />
        <StatCard title="Comissão" value={`R$ ${(totalComissao / 1000).toFixed(0)}k`} icon={DollarSign} sub="pagar" />
      </div>

      {/* Ranking visual */}
      {lista.length > 0 && (
        <div className="rounded-xl sm:rounded-2xl bg-card border border-border p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4 sm:mb-5">
            <Award className="w-4 sm:w-5 h-4 sm:h-5 text-amber-500" />
            <h3 className="font-semibold text-sm sm:text-base">Top 5 Revendedores</h3>
          </div>
          <div className="space-y-3 sm:space-y-4">
            {lista.slice(0, 5).map((r, i) => (
              <div key={r.nome} className="flex items-center gap-3 sm:gap-4">
                <div className={cn(
                  "w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold flex-shrink-0",
                  i === 0 ? "bg-amber-100 text-amber-600" :
                  i === 1 ? "bg-slate-100 text-slate-500" :
                  i === 2 ? "bg-orange-100 text-orange-500" : "bg-muted text-muted-foreground"
                )}>{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <p className="text-xs sm:text-sm font-semibold truncate">{r.nome}</p>
                    <span className="text-xs sm:text-sm font-bold text-primary flex-shrink-0">{r.ativados}</span>
                  </div>
                  <div className="h-1.5 sm:h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.round((r.ativados / maxAtivados) * 100)}%` }} />
                  </div>
                </div>
                <div className="text-right text-xs flex-shrink-0 hidden sm:block">
                  <p className="text-emerald-600 font-semibold">R$ {(r.comissao / 1000).toFixed(1)}k</p>
                  <p className="text-muted-foreground text-[10px]">comissão</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabela - Desktop / Cards - Mobile */}
      <div className="rounded-xl sm:rounded-2xl bg-card border border-border overflow-hidden">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-border">
          <h3 className="font-semibold text-xs sm:text-sm">Todos os Revendedores</h3>
        </div>

        {/* Desktop Table */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase">#</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase">Revendedor</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase">Pedidos</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase">Ativados</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase">Conv.</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase">Valor</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase">Comissão</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase">Pendente</th>
                <th className="py-3 px-4" />
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 ? (
                <tr><td colSpan={9} className="py-12 text-center text-muted-foreground text-sm">Nenhum revendedor</td></tr>
              ) : lista.map((r, i) => {
                const conversao = r.pedidos > 0 ? Math.round((r.ativados / r.pedidos) * 100) : 0;
                return (
                  <tr key={r.nome} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 text-muted-foreground text-xs">{i + 1}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                          {r.nome.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-sm">{r.nome}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right text-sm">{r.pedidos}</td>
                    <td className="py-3 px-4 text-right">
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 text-xs">{r.ativados}</Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={cn("text-xs font-medium", conversao >= 50 ? "text-emerald-600" : conversao >= 25 ? "text-amber-500" : "text-muted-foreground")}>
                        {conversao}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-sm">R$ {(r.valor / 1000).toFixed(1)}k</td>
                    <td className="py-3 px-4 text-right font-medium text-primary text-sm">R$ {(r.comissao / 1000).toFixed(1)}k</td>
                    <td className="py-3 px-4 text-right">
                      <Badge variant="outline" className={cn("text-xs", r.comissao_pendente > 0 ? "bg-amber-50 text-amber-600 border-amber-200" : "bg-muted text-muted-foreground")}>
                        R$ {(r.comissao_pendente / 1000).toFixed(1)}k
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <button onClick={() => copyLink(r.nome)} className="p-1.5 rounded-lg hover:bg-muted transition-colors" title="Copiar link">
                        {copied === r.nome ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="lg:hidden space-y-2 p-4 sm:p-6">
          {lista.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">Nenhum revendedor</div>
          ) : lista.map((r, i) => {
            const conversao = r.pedidos > 0 ? Math.round((r.ativados / r.pedidos) * 100) : 0;
            return (
              <div key={r.nome} className="bg-muted/30 rounded-lg p-3 space-y-2 text-xs">
                <div className="flex items-center gap-2 justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                    <p className="font-semibold truncate">{r.nome}</p>
                  </div>
                  <button onClick={() => copyLink(r.nome)} className="p-1 rounded hover:bg-muted transition-colors flex-shrink-0">
                    {copied === r.nome ? <CheckCircle className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-muted-foreground">Pedidos</p>
                    <p className="font-semibold">{r.pedidos}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Ativados</p>
                    <p className="font-semibold text-emerald-600">{r.ativados}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-muted-foreground">Conv.</p>
                    <p className={cn("font-semibold", conversao >= 50 ? "text-emerald-600" : conversao >= 25 ? "text-amber-500" : "text-muted-foreground")}>{conversao}%</p>
                  </div>
                </div>
                <div className="border-t border-border pt-2 grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-muted-foreground">Valor</p>
                    <p className="font-semibold">R$ {(r.valor / 1000).toFixed(1)}k</p>
                  </div>
                  <div className="text-right">
                    <p className="text-muted-foreground">Comissão</p>
                    <p className="font-semibold text-emerald-600">R$ {(r.comissao / 1000).toFixed(1)}k</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}