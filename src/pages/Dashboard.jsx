import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Users, ShoppingCart, DollarSign, CheckCircle, TrendingUp, AlertTriangle, Zap, CreditCard, FileText, BarChart3 } from "lucide-react";
import FunnelChart from "@/components/dashboard/FunnelChart";
import SalesChart from "@/components/dashboard/SalesChart";
import RankingTable from "@/components/dashboard/RankingTable";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function KpiCard({ title, value, sub, icon: Icon, accent, trend, trendUp }) {
  return (
    <div className={cn(
      "relative rounded-2xl bg-card border border-border p-5 overflow-hidden group hover:shadow-lg hover:shadow-black/5 transition-all duration-300",
    )}>
      <div className="flex items-start justify-between mb-4">
        <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center", accent || "bg-primary/10")}>
          <Icon className={cn("w-5 h-5", accent ? "text-white" : "text-primary")} />
        </div>
        {trend && (
          <span className={cn("text-xs font-semibold px-2 py-1 rounded-full", trendUp ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500")}>
            {trendUp ? "↑" : "↓"} {trend}
          </span>
        )}
      </div>
      <p className="text-3xl font-bold tracking-tight">{value}</p>
      <p className="text-sm text-muted-foreground mt-1">{title}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5 opacity-70">{sub}</p>}
      <div className="absolute -bottom-5 -right-5 w-20 h-20 rounded-full bg-primary/4 group-hover:scale-150 transition-transform duration-500" />
    </div>
  );
}

function EtapaBar({ label, count, total, color }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums">{count} <span className="text-muted-foreground font-normal text-xs">({pct}%)</span></span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-700", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: leads = [] } = useQuery({ queryKey: ["leads"], queryFn: () => base44.entities.Lead.list("-created_date", 200) });
  const { data: pedidos = [] } = useQuery({ queryKey: ["pedidos"], queryFn: () => base44.entities.Pedido.list("-created_date", 200) });
  const { data: comissoes = [] } = useQuery({ queryKey: ["comissoes"], queryFn: () => base44.entities.Comissao.list("-created_date", 100) });
  const { data: analises = [] } = useQuery({ queryKey: ["analises"], queryFn: () => base44.entities.AnaliseCredito.list("-created_date", 100) });

  const totalLeads = leads.length;
  const totalPedidos = pedidos.length;
  const ativados = pedidos.filter(p => p.status === "ativado").length;
  const recusados = pedidos.filter(p => p.status === "recusado").length;
  const emContrato = pedidos.filter(p => ["contrato_pendente", "assinado"].includes(p.status)).length;
  const valorTotal = pedidos.filter(p => p.status === "ativado").reduce((s, p) => s + (p.valor || 0), 0);
  const comissoesPendentes = comissoes.filter(c => c.status === "a_receber").reduce((s, c) => s + (c.valor || 0), 0);
  const aprovados = analises.filter(a => a.resultado === "aprovado").length;
  const taxaAprovacao = analises.length > 0 ? Math.round((aprovados / analises.length) * 100) : 0;
  const txConversao = totalPedidos > 0 ? Math.round((ativados / totalPedidos) * 100) : 0;

  // Ranking vendedores
  const rankMap = {};
  pedidos.forEach(p => {
    if (!p.vendedor_nome) return;
    if (!rankMap[p.vendedor_nome]) rankMap[p.vendedor_nome] = { nome: p.vendedor_nome, ativados: 0, valor: 0 };
    if (p.status === "ativado") { rankMap[p.vendedor_nome].ativados++; rankMap[p.vendedor_nome].valor += p.valor || 0; }
  });
  const ranking = Object.values(rankMap).sort((a, b) => b.ativados - a.ativados).slice(0, 5);

  return (
    <div className="space-y-7">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">Visão geral da esteira em tempo real</p>
        </div>
        <Badge variant="outline" className="gap-1.5 text-xs py-1 px-3 rounded-full border-primary/30 text-primary bg-primary/5">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse inline-block" />
          Ao vivo
        </Badge>
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Total de Leads" value={totalLeads} icon={Users} trend="+12% este mês" trendUp />
        <KpiCard title="Pedidos" value={totalPedidos} icon={ShoppingCart} sub={`${emContrato} em contrato`} />
        <KpiCard title="Ativações" value={ativados} icon={CheckCircle} trend={`${txConversao}% conversão`} trendUp={txConversao >= 30} />
        <KpiCard title="Receita Ativada" value={`R$ ${valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} icon={DollarSign} sub={`R$ ${comissoesPendentes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} em comissões`} />
      </div>

      {/* Linha 2: Funil de etapas + Crédito */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Funil de etapas */}
        <div className="lg:col-span-2 rounded-2xl bg-card border border-border p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Funil da Esteira</h3>
            <span className="text-xs text-muted-foreground">{totalPedidos} pedidos totais</span>
          </div>
          <div className="space-y-3">
            <EtapaBar label="Novos Leads" count={pedidos.filter(p => p.status === "novo").length} total={totalPedidos} color="bg-blue-500" />
            <EtapaBar label="Análise de Crédito" count={pedidos.filter(p => p.status === "analise_credito").length} total={totalPedidos} color="bg-amber-500" />
            <EtapaBar label="Viabilidade" count={pedidos.filter(p => p.status === "viabilidade").length} total={totalPedidos} color="bg-purple-500" />
            <EtapaBar label="Contrato / Assinado" count={emContrato} total={totalPedidos} color="bg-cyan-500" />
            <EtapaBar label="Ativados" count={ativados} total={totalPedidos} color="bg-emerald-500" />
            <EtapaBar label="Recusados" count={recusados} total={totalPedidos} color="bg-red-400" />
          </div>
        </div>

        {/* Análise de crédito */}
        <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Crédito</h3>
            <CreditCard className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="text-center py-3">
            <p className="text-5xl font-bold text-primary">{taxaAprovacao}%</p>
            <p className="text-sm text-muted-foreground mt-1">taxa de aprovação</p>
          </div>
          <div className="space-y-2.5 text-sm">
            {[
              { label: "Aprovados", val: aprovados, cls: "text-emerald-600 bg-emerald-50" },
              { label: "Recusados", val: analises.filter(a => a.resultado === "reprovado").length, cls: "text-red-500 bg-red-50" },
              { label: "Manuais", val: analises.filter(a => a.resultado === "manual").length, cls: "text-amber-600 bg-amber-50" },
              { label: "Erros", val: analises.filter(a => a.resultado === "erro").length, cls: "text-muted-foreground bg-muted" },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between">
                <span className="text-muted-foreground">{row.label}</span>
                <Badge variant="outline" className={cn("text-xs", row.cls)}>{row.val}</Badge>
              </div>
            ))}
          </div>
          <div className="pt-2 border-t border-border text-xs text-muted-foreground text-center">
            {analises.length} consultas realizadas
          </div>
        </div>
      </div>

      {/* Linha 3: Vendas + Ranking */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-2xl bg-card border border-border p-6">
          <h3 className="font-semibold mb-4">Ativações por Mês</h3>
          <SalesChart pedidos={pedidos} />
        </div>

        {/* Ranking de Vendedores estilo Datacake */}
        <div className="rounded-2xl bg-card border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Ranking de Vendedores</h3>
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
          </div>
          {ranking.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sem dados de vendedores</p>
          ) : (
            <div className="space-y-3">
              {ranking.map((v, i) => (
                <div key={v.nome} className="flex items-center gap-3">
                  <div className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
                    i === 0 ? "bg-amber-100 text-amber-600" :
                    i === 1 ? "bg-slate-100 text-slate-500" :
                    i === 2 ? "bg-orange-100 text-orange-500" : "bg-muted text-muted-foreground"
                  )}>{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{v.nome}</p>
                    <div className="h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${ranking[0]?.ativados > 0 ? Math.round((v.ativados / ranking[0].ativados) * 100) : 0}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold">{v.ativados}</p>
                    <p className="text-[10px] text-muted-foreground">ativações</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}