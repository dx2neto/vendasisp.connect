import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Users, ShoppingCart, DollarSign, CheckCircle, CreditCard, Target, Trophy, Zap } from "lucide-react";
import SalesChart from "@/components/dashboard/SalesChart";
import RankingGamificado from "@/components/dashboard/RankingGamificado";
import MetasProgress from "@/components/dashboard/MetasProgress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

function KpiCard({ title, value, sub, icon: Icon, accent, trend, trendUp }) {
  return (
    <div className="relative rounded-2xl bg-card border border-border p-4 sm:p-5 overflow-hidden group hover:shadow-lg hover:shadow-black/5 transition-all duration-300">
      <div className="flex items-start justify-between mb-3">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", accent || "bg-primary/10")}>
          <Icon className={cn("w-5 h-5", accent ? "text-white" : "text-primary")} />
        </div>
        {trend && (
          <span className={cn("text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap", trendUp ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500")}>
            {trendUp ? "↑" : "↓"} {trend}
          </span>
        )}
      </div>
      <p className="text-2xl sm:text-3xl font-bold tracking-tight break-all">{value}</p>
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
        <span className="text-muted-foreground text-xs sm:text-sm">{label}</span>
        <span className="font-semibold tabular-nums text-xs sm:text-sm">{count} <span className="text-muted-foreground font-normal text-xs">({pct}%)</span></span>
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
  const { data: metas = [] } = useQuery({ queryKey: ["metas-vendas"], queryFn: () => base44.entities.MetaVendedor.list("-created_date", 50) });

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

  return (
    <div className="space-y-5 sm:space-y-7">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">Visão geral da esteira em tempo real</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="gap-1.5 text-xs py-1 px-3 rounded-full border-primary/30 text-primary bg-primary/5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse inline-block" />
            Ao vivo
          </Badge>
          <Link to="/site" className="text-xs text-muted-foreground hover:text-primary underline underline-offset-2 transition-colors">
            Ver site público →
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard title="Total de Leads" value={totalLeads} icon={Users} trend="+12% este mês" trendUp />
        <KpiCard title="Pedidos" value={totalPedidos} icon={ShoppingCart} sub={`${emContrato} em contrato`} />
        <KpiCard title="Ativações" value={ativados} icon={CheckCircle} trend={`${txConversao}% conversão`} trendUp={txConversao >= 30} />
        <KpiCard title="Receita Ativada" value={`R$ ${valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} icon={DollarSign} sub={`R$ ${comissoesPendentes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} em comissões`} />
      </div>

      {/* Linha 2: Funil + Crédito */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
        <div className="lg:col-span-2 rounded-2xl bg-card border border-border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Funil da Esteira</h3>
            <span className="text-xs text-muted-foreground">{totalPedidos} pedidos</span>
          </div>
          <div className="space-y-3">
            <EtapaBar label="Novos" count={pedidos.filter(p => p.status === "novo").length} total={totalPedidos} color="bg-blue-500" />
            <EtapaBar label="Análise de Crédito" count={pedidos.filter(p => p.status === "analise_credito").length} total={totalPedidos} color="bg-amber-500" />
            <EtapaBar label="Viabilidade" count={pedidos.filter(p => p.status === "viabilidade").length} total={totalPedidos} color="bg-purple-500" />
            <EtapaBar label="Contrato / Assinado" count={emContrato} total={totalPedidos} color="bg-cyan-500" />
            <EtapaBar label="Ativados" count={ativados} total={totalPedidos} color="bg-emerald-500" />
            <EtapaBar label="Recusados" count={recusados} total={totalPedidos} color="bg-red-400" />
          </div>
        </div>

        <div className="rounded-2xl bg-card border border-border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Crédito</h3>
            <CreditCard className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="text-center py-2">
            <p className="text-4xl sm:text-5xl font-bold text-primary">{taxaAprovacao}%</p>
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

      {/* Linha 3: Gráfico + Metas de vendas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        <div className="rounded-2xl bg-card border border-border p-5">
          <h3 className="font-semibold mb-4">Ativações por Mês</h3>
          <SalesChart pedidos={pedidos} />
        </div>

        <div className="rounded-2xl bg-card border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              <h3 className="font-semibold">Metas do Mês</h3>
            </div>
            <Link to="/metas" className="text-xs text-muted-foreground hover:text-primary transition-colors">
              Gerenciar →
            </Link>
          </div>
          <MetasProgress metas={metas} pedidos={pedidos} />
        </div>
      </div>

      {/* Linha 4: Ranking Gamificado em destaque */}
      <div className="rounded-2xl bg-gradient-to-br from-card to-muted/30 border border-border overflow-hidden">
        <div className="bg-gradient-to-r from-primary/10 via-amber-500/10 to-orange-500/10 px-5 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md">
              <Trophy className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base">🏆 Hall da Fama — Ranking de Vendedores</h3>
              <p className="text-xs text-muted-foreground">Motivação, competição saudável e resultados!</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="bg-amber-100 text-amber-700 border-amber-200 gap-1">
              <Zap className="w-3 h-3" /> {ativados} ativações totais
            </Badge>
            <Link to="/metas" className="text-xs text-muted-foreground hover:text-primary transition-colors">
              Ver metas →
            </Link>
          </div>
        </div>
        <div className="p-5">
          <RankingGamificado pedidos={pedidos} metas={metas} />
        </div>
      </div>
    </div>
  );
}