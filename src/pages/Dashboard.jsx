import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Users, ShoppingCart, DollarSign, CheckCircle, TrendingUp, AlertTriangle } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import FunnelChart from "@/components/dashboard/FunnelChart";
import SalesChart from "@/components/dashboard/SalesChart";
import RankingTable from "@/components/dashboard/RankingTable";

export default function Dashboard() {
  const { data: leads = [] } = useQuery({
    queryKey: ["leads"],
    queryFn: () => base44.entities.Lead.list("-created_date", 200),
  });

  const { data: pedidos = [] } = useQuery({
    queryKey: ["pedidos"],
    queryFn: () => base44.entities.Pedido.list("-created_date", 200),
  });

  const { data: comissoes = [] } = useQuery({
    queryKey: ["comissoes"],
    queryFn: () => base44.entities.Comissao.list("-created_date", 100),
  });

  const totalLeads = leads.length;
  const totalPedidos = pedidos.length;
  const ativados = pedidos.filter(p => p.status === "ativado").length;
  const recusados = pedidos.filter(p => p.status === "recusado").length;
  const valorTotal = pedidos.filter(p => p.status === "ativado").reduce((s, p) => s + (p.valor || 0), 0);
  const comissoesPendentes = comissoes.filter(c => c.status === "a_receber").reduce((s, c) => s + (c.valor || 0), 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Visão geral da esteira de vendas</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Leads" value={totalLeads} icon={Users} trend="+12% este mês" trendUp />
        <StatCard title="Pedidos" value={totalPedidos} icon={ShoppingCart} subtitle="Em andamento" />
        <StatCard title="Ativados" value={ativados} icon={CheckCircle} trend={`${recusados} recusados`} />
        <StatCard
          title="Receita Ativada"
          value={`R$ ${valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          icon={DollarSign}
          subtitle={`R$ ${comissoesPendentes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} em comissões`}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl bg-card border border-border p-6">
          <h3 className="text-lg font-semibold mb-4">Funil de Vendas</h3>
          <FunnelChart pedidos={pedidos} />
        </div>
        <div className="rounded-2xl bg-card border border-border p-6">
          <h3 className="text-lg font-semibold mb-4">Vendas por Mês</h3>
          <SalesChart pedidos={pedidos} />
        </div>
      </div>

      {/* Ranking */}
      <div className="rounded-2xl bg-card border border-border p-6">
        <h3 className="text-lg font-semibold mb-4">Ranking de Vendedores</h3>
        <RankingTable pedidos={pedidos} />
      </div>
    </div>
  );
}