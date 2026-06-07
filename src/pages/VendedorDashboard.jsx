import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, DollarSign, Target, ShoppingCart, ArrowUpRight, ArrowDownLeft, Plus, Eye, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function MetricCard({ icon: Icon, label, value, sub, color }) {
  return (
    <Card className="rounded-2xl border border-border">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className={cn("text-2xl font-bold mt-2", color || "text-foreground")}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={cn("p-2.5 rounded-xl text-white", color?.includes("text-") ? "bg-primary/10" : "bg-primary/10")}>
            <Icon className="w-5 h-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function VendedorDashboard() {
  const [vendedorData, setVendedorData] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setVendedorData);
  }, []);

  const { data: pedidos = [] } = useQuery({
    queryKey: ["pedidos", vendedorData?.id],
    queryFn: () => base44.entities.Pedido.list("-created_date", 500),
    enabled: !!vendedorData,
  });

  const { data: comissoes = [] } = useQuery({
    queryKey: ["comissoes", vendedorData?.id],
    queryFn: () => base44.entities.Comissao.list("-created_date", 500),
    enabled: !!vendedorData,
  });

  const { data: metas = [] } = useQuery({
    queryKey: ["metas"],
    queryFn: () => base44.entities.Meta?.list("-created_date", 100).catch(() => []),
  });

  if (!vendedorData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // Filtrar dados do vendedor logado
  const pedidosVendedor = pedidos.filter(p => p.vendedor_id === vendedorData.id);
  const comissoesVendedor = comissoes.filter(c => c.vendedor_id === vendedorData.id && c.tipo === "vendedor");

  // Cálculos
  const totalComissoes = comissoesVendedor.reduce((s, c) => s + (c.valor || 0), 0);
  const comissoesPagas = comissoesVendedor.filter(c => c.status === "pago").reduce((s, c) => s + (c.valor || 0), 0);
  const comissoesPendentes = totalComissoes - comissoesPagas;

  const totalVendido = pedidosVendedor.reduce((s, p) => s + (p.valor || 0), 0);
  const pedidosAtivos = pedidosVendedor.filter(p => p.status === "ativado").length;
  const pedidosPendentes = pedidosVendedor.filter(p => ["novo", "analise_credito", "viabilidade", "contrato_pendente"].includes(p.status)).length;

  // Meta mensal (10% do total de vendas como alvo)
  const metaMensal = Math.max(totalVendido * 0.1, 5000);
  const progressoMeta = Math.min((totalComissoes / (metaMensal * 0.5)) * 100, 100);

  // Dados para gráficos
  const statusDistribuicao = {
    ativados: pedidosAtivos,
    pendentes: pedidosPendentes,
    recusados: pedidosVendedor.filter(p => p.status === "recusado").length,
  };

  const vendedorByCiclo = pedidosVendedor.reduce((acc, p) => {
    const mes = format(new Date(p.created_date), "MMM", { locale: ptBR });
    const existing = acc.find(a => a.mes === mes);
    if (existing) existing.vendas += p.valor || 0;
    else acc.push({ mes, vendas: p.valor || 0 });
    return acc;
  }, []).slice(-6);

  const statusColors = {
    ativados: "bg-emerald-500",
    pendentes: "bg-amber-500",
    recusados: "bg-red-500",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative rounded-2xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">Bem-vindo, {vendedorData.full_name}!</h1>
            <p className="text-muted-foreground mt-1">Seu painel de vendas e comissões</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground mb-1">Membro desde</p>
            <p className="text-sm font-semibold">{format(new Date(vendedorData.created_date), "MMM yyyy", { locale: ptBR })}</p>
          </div>
        </div>
      </div>

      {/* KPIs Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={DollarSign}
          label="Comissão Acumulada"
          value={`R$ ${totalComissoes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          sub={`${comissoesPendentes > 0 ? `R$ ${comissoesPendentes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} pendente` : "Tudo pago"}`}
        />
        <MetricCard
          icon={ShoppingCart}
          label="Total Vendido"
          value={`R$ ${totalVendido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          sub={`${pedidosVendedor.length} pedidos`}
        />
        <MetricCard
          icon={TrendingUp}
          label="Pedidos Ativos"
          value={pedidosAtivos}
          sub={`${Math.round((pedidosAtivos / pedidosVendedor.length) * 100) || 0}% de conclusão`}
        />
        <MetricCard
          icon={Target}
          label="Meta Mensal"
          value={`${Math.round(progressoMeta)}%`}
          sub={`R$ ${(metaMensal * 0.5).toLocaleString("pt-BR", { minimumFractionDigits: 0 })} objetivo`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico de Vendas */}
        <Card className="lg:col-span-2 rounded-2xl border border-border">
          <CardHeader>
            <CardTitle className="text-lg">Vendas por Período</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={vendedorByCiclo}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" style={{ fontSize: "12px" }} />
                <YAxis stroke="hsl(var(--muted-foreground))" style={{ fontSize: "12px" }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                  formatter={(value) => `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`}
                />
                <Line type="monotone" dataKey="vendas" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))" }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Status dos Pedidos */}
        <Card className="rounded-2xl border border-border">
          <CardHeader>
            <CardTitle className="text-lg">Status dos Pedidos</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: "Ativos", value: statusDistribuicao.ativados, color: "#10b981" },
                    { name: "Pendentes", value: statusDistribuicao.pendentes, color: "#f59e0b" },
                    { name: "Recusados", value: statusDistribuicao.recusados, color: "#ef4444" },
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {[{ color: "#10b981" }, { color: "#f59e0b" }, { color: "#ef4444" }].map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 mt-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Ativos</span>
                <span className="font-semibold">{statusDistribuicao.ativados}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-500" /> Pendentes</span>
                <span className="font-semibold">{statusDistribuicao.pendentes}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500" /> Recusados</span>
                <span className="font-semibold">{statusDistribuicao.recusados}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Atalhos Rápidos */}
      <div>
        <h2 className="text-lg font-bold mb-4">Atalhos Rápidos</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Button className="h-24 rounded-2xl flex flex-col items-center justify-center gap-2" variant="outline">
            <Plus className="w-5 h-5" />
            <span className="text-xs font-medium">Novo Pedido</span>
          </Button>
          <Button className="h-24 rounded-2xl flex flex-col items-center justify-center gap-2" variant="outline">
            <Eye className="w-5 h-5" />
            <span className="text-xs font-medium">Meus Pedidos</span>
          </Button>
          <Button className="h-24 rounded-2xl flex flex-col items-center justify-center gap-2" variant="outline">
            <FileText className="w-5 h-5" />
            <span className="text-xs font-medium">Relatório</span>
          </Button>
          <Button className="h-24 rounded-2xl flex flex-col items-center justify-center gap-2" variant="outline">
            <DollarSign className="w-5 h-5" />
            <span className="text-xs font-medium">Comissões</span>
          </Button>
        </div>
      </div>

      {/* Últimos Pedidos */}
      <Card className="rounded-2xl border border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Últimos Pedidos</CardTitle>
          <Button variant="outline" size="sm" className="rounded-lg">Ver Todos</Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {pedidosVendedor.slice(0, 5).map(p => (
              <div key={p.id} className="flex items-center justify-between p-4 rounded-xl border border-border/50 hover:bg-muted/30 transition-colors">
                <div>
                  <p className="font-medium text-sm">{p.lead_nome}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{p.plano_nome}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className={cn(
                    "text-xs rounded-lg",
                    p.status === "ativado" && "bg-emerald-50 text-emerald-600 border-emerald-200",
                    ["novo", "analise_credito", "viabilidade", "contrato_pendente"].includes(p.status) && "bg-amber-50 text-amber-600 border-amber-200",
                    p.status === "recusado" && "bg-red-50 text-red-600 border-red-200"
                  )}>
                    {p.status === "ativado" ? "Ativo" : p.status === "novo" ? "Novo" : p.status.replace(/_/g, " ")}
                  </Badge>
                  <span className="font-semibold text-sm text-primary">R$ {(p.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}