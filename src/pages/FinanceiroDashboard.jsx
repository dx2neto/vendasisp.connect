import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DollarSign, TrendingUp, Clock, CheckCircle2, Zap, BarChart3, ArrowUpRight, Wallet, Loader2, FileSignature
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, subMonths, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend
} from "recharts";
import PainelContratosIXC from "@/components/financeiro/PainelContratosIXC";

const fmt = (v) => `R$ ${(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

function KpiCard({ title, value, sub, icon: Icon, cor, destaque }) {
  return (
    <div className={cn(
      "rounded-2xl border p-5 flex flex-col gap-3 hover:shadow-md transition-all",
      destaque ? "bg-primary border-primary/30 text-primary-foreground" : "bg-card border-border"
    )}>
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", cor || "bg-primary/10")}>
        <Icon className={cn("w-5 h-5", destaque ? "text-white" : cor ? "text-white" : "text-primary")} />
      </div>
      <div>
        <p className={cn("text-2xl font-bold", destaque ? "text-white" : "")}>{value}</p>
        <p className={cn("text-sm mt-0.5", destaque ? "text-primary-foreground/70" : "text-muted-foreground")}>{title}</p>
        {sub && <p className={cn("text-xs mt-0.5 opacity-70", destaque ? "text-primary-foreground/60" : "text-muted-foreground")}>{sub}</p>}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const cfg = {
    ativado:          { label: "Ativado",     cls: "bg-emerald-50 text-emerald-600 border-emerald-200" },
    contrato_pendente:{ label: "Contrato",    cls: "bg-cyan-50 text-cyan-600 border-cyan-200" },
    assinado:         { label: "Assinado",    cls: "bg-teal-50 text-teal-600 border-teal-200" },
    viabilidade:      { label: "Viabilidade", cls: "bg-purple-50 text-purple-600 border-purple-200" },
    analise_credito:  { label: "Crédito",     cls: "bg-amber-50 text-amber-600 border-amber-200" },
    novo:             { label: "Novo",        cls: "bg-blue-50 text-blue-600 border-blue-200" },
    recusado:         { label: "Recusado",    cls: "bg-red-50 text-red-500 border-red-200" },
  }[status] || { label: status, cls: "" };
  return <Badge variant="outline" className={cn("text-xs", cfg.cls)}>{cfg.label}</Badge>;
}

export default function FinanceiroDashboard() {
  const queryClient = useQueryClient();
  const [mesSel, setMesSel] = useState(0); // 0 = mês atual

  const { data: pedidos = [] } = useQuery({ queryKey: ["pedidos"], queryFn: () => base44.entities.Pedido.list("-created_date", 500) });
  const { data: comissoes = [] } = useQuery({ queryKey: ["comissoes"], queryFn: () => base44.entities.Comissao.list("-created_date", 500) });

  const calcularMutation = useMutation({
    mutationFn: () => base44.functions.invoke("calcularComissoes", {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["comissoes"] }),
  });

  const pagarMutation = useMutation({
    mutationFn: (id) => base44.entities.Comissao.update(id, { status: "pago" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["comissoes"] }),
  });

  const ativarIXCMutation = useMutation({
    mutationFn: (pedido) => base44.functions.invoke("ativarIXC", { pedido_id: pedido.id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pedidos"] }),
  });

  // KPIs globais
  const receitaAtivada = pedidos.filter(p => p.status === "ativado").reduce((s, p) => s + (p.valor || 0), 0);
  const receitaPipeline = pedidos.filter(p => !["ativado","recusado"].includes(p.status)).reduce((s, p) => s + (p.valor || 0), 0);
  const comissoesPendentes = comissoes.filter(c => c.status === "a_receber").reduce((s, c) => s + (c.valor || 0), 0);
  const comissoesPagas = comissoes.filter(c => c.status === "pago").reduce((s, c) => s + (c.valor || 0), 0);
  const lucroLiquido = receitaAtivada - comissoesPagas;

  // Gráfico de receita mensal (últimos 6 meses)
  const meses = Array.from({ length: 6 }, (_, i) => {
    const ref = subMonths(new Date(), 5 - i);
    const inicio = startOfMonth(ref);
    const fim = endOfMonth(ref);
    const receitaMes = pedidos
      .filter(p => p.status === "ativado" && p.data_ativacao && isWithinInterval(new Date(p.data_ativacao), { start: inicio, end: fim }))
      .reduce((s, p) => s + (p.valor || 0), 0);
    const comissoesMes = comissoes
      .filter(c => c.created_date && isWithinInterval(new Date(c.created_date), { start: inicio, end: fim }))
      .reduce((s, c) => s + (c.valor || 0), 0);
    return {
      mes: format(ref, "MMM/yy", { locale: ptBR }),
      receita: receitaMes,
      comissoes: comissoesMes,
      liquido: receitaMes - comissoesMes,
    };
  });

  // Pedidos com valor pendente (em pipeline)
  const pedidosPipeline = pedidos
    .filter(p => !["ativado", "recusado"].includes(p.status) && (p.valor || 0) > 0)
    .sort((a, b) => (b.valor || 0) - (a.valor || 0));

  // Pedidos ativados recentes
  const ativadosRecentes = pedidos
    .filter(p => p.status === "ativado")
    .slice(0, 15);

  // Comissões pendentes agrupadas por vendedor
  const comissoesPendentesLista = comissoes.filter(c => c.status === "a_receber");
  const porVendedor = {};
  comissoesPendentesLista.forEach(c => {
    const k = c.vendedor_nome || "—";
    if (!porVendedor[k]) porVendedor[k] = { nome: k, total: 0, qtd: 0, ids: [] };
    porVendedor[k].total += c.valor || 0;
    porVendedor[k].qtd++;
    porVendedor[k].ids.push(c.id);
  });
  const vendedoresPendentes = Object.values(porVendedor).sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard Financeiro</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">Fluxo de caixa, receita e comissões consolidadas</p>
        </div>
        <Button
          onClick={() => calcularMutation.mutate()}
          disabled={calcularMutation.isPending}
          variant="outline"
          className="gap-2 rounded-xl"
        >
          {calcularMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          Recalcular Comissões
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          title="Receita Ativada"
          value={fmt(receitaAtivada)}
          sub={`${pedidos.filter(p => p.status === "ativado").length} contratos ativos`}
          icon={CheckCircle2}
          cor="bg-emerald-500"
        />
        <KpiCard
          title="Pipeline de Receita"
          value={fmt(receitaPipeline)}
          sub={`${pedidosPipeline.length} pedidos em andamento`}
          icon={TrendingUp}
          cor="bg-blue-500"
        />
        <KpiCard
          title="Comissões Pendentes"
          value={fmt(comissoesPendentes)}
          sub={`${comissoesPendentesLista.length} registros a pagar`}
          icon={Clock}
          cor="bg-amber-500"
        />
        <KpiCard
          title="Comissões Pagas"
          value={fmt(comissoesPagas)}
          sub="total histórico"
          icon={Wallet}
          cor="bg-purple-500"
        />
        <KpiCard
          title="Lucro Líquido"
          value={fmt(lucroLiquido)}
          sub="receita menos comissões pagas"
          icon={ArrowUpRight}
          destaque
        />
      </div>

      {/* Gráfico receita x comissões */}
      <div className="rounded-2xl bg-card border border-border p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold">Receita vs Comissões — últimos 6 meses</h3>
          <BarChart3 className="w-4 h-4 text-muted-foreground" />
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={meses} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="mes" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
            <Tooltip
              formatter={(v, n) => [fmt(v), n === "receita" ? "Receita" : n === "comissoes" ? "Comissões" : "Líquido"]}
              contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }}
            />
            <Legend iconType="circle" iconSize={8} />
            <Bar dataKey="receita" name="Receita" fill="hsl(var(--primary))" radius={[6,6,0,0]} />
            <Bar dataKey="comissoes" name="Comissões" fill="hsl(var(--chart-4))" radius={[6,6,0,0]} />
            <Bar dataKey="liquido" name="Líquido" fill="hsl(var(--accent))" radius={[6,6,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tabs: Pipeline | Pagamentos | Comissões */}
      <Tabs defaultValue="pipeline" className="space-y-4">
        <TabsList className="rounded-xl">
          <TabsTrigger value="pipeline" className="rounded-lg gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" />Pipeline de Receita
            {pedidosPipeline.length > 0 && (
              <span className="ml-1 bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{pedidosPipeline.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="ativados" className="rounded-lg gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />Receita Ativada
          </TabsTrigger>
          <TabsTrigger value="contratos" className="rounded-lg gap-1.5">
            <FileSignature className="w-3.5 h-3.5" />Contratos & IXC
            {pedidos.filter(p => p.status === "assinado").length > 0 && (
              <span className="ml-1 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {pedidos.filter(p => p.status === "assinado").length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="comissoes" className="rounded-lg gap-1.5">
            <DollarSign className="w-3.5 h-3.5" />Comissões Pendentes
            {comissoesPendentesLista.length > 0 && (
              <span className="ml-1 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{comissoesPendentesLista.length}</span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Pipeline de receita */}
        <TabsContent value="pipeline" className="mt-4">
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
              <p className="text-sm font-medium">Pedidos em andamento com valor potencial</p>
              <p className="text-sm font-bold text-primary">{fmt(receitaPipeline)} potencial</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase">Cliente</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase">Plano</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase">Vendedor</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase">Etapa</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase">Valor</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase">Criado em</th>
                  </tr>
                </thead>
                <tbody>
                  {pedidosPipeline.length === 0 ? (
                    <tr><td colSpan={6} className="py-10 text-center text-muted-foreground">Nenhum pedido em andamento</td></tr>
                  ) : pedidosPipeline.map(p => (
                    <tr key={p.id} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4 font-medium">{p.lead_nome || "—"}</td>
                      <td className="py-3 px-4 text-muted-foreground text-xs">{p.plano_nome || "—"}</td>
                      <td className="py-3 px-4 text-muted-foreground text-xs">{p.vendedor_nome || "—"}</td>
                      <td className="py-3 px-4"><StatusBadge status={p.status} /></td>
                      <td className="py-3 px-4 text-right font-bold text-primary">{fmt(p.valor)}</td>
                      <td className="py-3 px-4 text-right text-xs text-muted-foreground">
                        {p.created_date ? format(new Date(p.created_date), "dd/MM/yy", { locale: ptBR }) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Receita ativada */}
        <TabsContent value="ativados" className="mt-4">
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
              <p className="text-sm font-medium">Contratos ativados</p>
              <p className="text-sm font-bold text-emerald-600">{fmt(receitaAtivada)} em receita</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase">Cliente</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase">Plano</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase">Vendedor</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase">Valor</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase">Ativado em</th>
                  </tr>
                </thead>
                <tbody>
                  {ativadosRecentes.length === 0 ? (
                    <tr><td colSpan={5} className="py-10 text-center text-muted-foreground">Nenhuma ativação</td></tr>
                  ) : ativadosRecentes.map(p => (
                    <tr key={p.id} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4 font-medium">{p.lead_nome || "—"}</td>
                      <td className="py-3 px-4 text-muted-foreground text-xs">{p.plano_nome || "—"}</td>
                      <td className="py-3 px-4 text-muted-foreground text-xs">{p.vendedor_nome || "—"}</td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600">{fmt(p.valor)}</td>
                      <td className="py-3 px-4 text-right text-xs text-muted-foreground">
                        {p.data_ativacao ? format(new Date(p.data_ativacao), "dd/MM/yy", { locale: ptBR }) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Contratos & Ativação IXC */}
        <TabsContent value="contratos" className="mt-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <PainelContratosIXC
              pedidos={pedidos}
              onAtivar={(p) => ativarIXCMutation.mutate(p)}
            />
            {ativarIXCMutation.isPending && (
              <div className="flex items-center justify-center gap-2 mt-4 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Ativando no IXC...
              </div>
            )}
          </div>
        </TabsContent>

        {/* Comissões pendentes */}
        <TabsContent value="comissoes" className="mt-4 space-y-4">
          {/* Resumo por vendedor */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {vendedoresPendentes.map(v => (
              <div key={v.nome} className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-sm">{v.nome}</p>
                  <p className="text-xs text-amber-700 mt-0.5">{v.qtd} comissão{v.qtd !== 1 ? "ões" : ""} pendente{v.qtd !== 1 ? "s" : ""}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-amber-700">{fmt(v.total)}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs rounded-lg h-7 mt-1.5 border-amber-300 text-amber-700 hover:bg-amber-100"
                    onClick={() => v.ids.forEach(id => pagarMutation.mutate(id))}
                    disabled={pagarMutation.isPending}
                  >
                    Marcar tudo pago
                  </Button>
                </div>
              </div>
            ))}
            {vendedoresPendentes.length === 0 && (
              <div className="col-span-3 rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center text-emerald-700">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2" />
                <p className="font-medium">Todas as comissões estão pagas!</p>
              </div>
            )}
          </div>

          {/* Tabela detalhada */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase">Vendedor</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase">Cliente</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase">Plano</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase">%</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase">Valor</th>
                    <th className="text-center py-3 px-4 font-medium text-muted-foreground text-xs uppercase">Tipo</th>
                    <th className="py-3 px-4" />
                  </tr>
                </thead>
                <tbody>
                  {comissoesPendentesLista.length === 0 ? (
                    <tr><td colSpan={7} className="py-10 text-center text-muted-foreground">Sem comissões pendentes</td></tr>
                  ) : comissoesPendentesLista.map(c => (
                    <tr key={c.id} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4 font-medium">{c.vendedor_nome || "—"}</td>
                      <td className="py-3 px-4 text-muted-foreground text-xs">{c.lead_nome || "—"}</td>
                      <td className="py-3 px-4 text-muted-foreground text-xs">{c.plano_nome || "—"}</td>
                      <td className="py-3 px-4 text-right text-muted-foreground">{c.percentual}%</td>
                      <td className="py-3 px-4 text-right font-bold text-amber-600">{fmt(c.valor)}</td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant="outline" className={cn("text-xs", c.tipo === "vendedor" ? "bg-blue-50 text-blue-600 border-blue-200" : "bg-purple-50 text-purple-600 border-purple-200")}>
                          {c.tipo === "vendedor" ? "Vendedor" : "Revendedor"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs rounded-lg h-7"
                          onClick={() => pagarMutation.mutate(c.id)}
                          disabled={pagarMutation.isPending}
                        >
                          Marcar pago
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}