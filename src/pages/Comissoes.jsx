import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, CheckCircle, Zap, TrendingUp, Loader2, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function StatCard({ title, value, sub, icon: Icon, accent }) {
  return (
    <Card className="rounded-2xl border border-border p-5 hover:shadow-md transition-all">
      <div className="flex items-center justify-between mb-3">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white", accent || "bg-primary/10")}>
          <Icon className={cn("w-5 h-5", accent ? "text-white" : "text-primary")} />
        </div>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm text-muted-foreground mt-0.5">{title}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5 opacity-70">{sub}</p>}
    </Card>
  );
}

export default function Comissoes() {
  const queryClient = useQueryClient();
  const [filtroTipo, setFiltroTipo] = useState("todos");

  const { data: comissoes = [], isLoading } = useQuery({
    queryKey: ["comissoes"],
    queryFn: () => base44.entities.Comissao.list("-created_date", 500),
  });

  const { data: pedidos = [] } = useQuery({
    queryKey: ["pedidos"],
    queryFn: () => base44.entities.Pedido.list("-created_date", 500),
  });

  const { data: contratos = [] } = useQuery({
    queryKey: ["contratos"],
    queryFn: () => base44.entities.Contrato.list("-updated_date", 500),
  });

  const calcularMutation = useMutation({
    mutationFn: () => base44.functions.invoke("calcularComissoes", {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["comissoes"] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id }) => base44.entities.Comissao.update(id, { status: "pago" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["comissoes"] }),
  });

  const totalPendente = comissoes.filter(c => c.status === "a_receber").reduce((s, c) => s + (c.valor || 0), 0);
  const totalPago = comissoes.filter(c => c.status === "pago").reduce((s, c) => s + (c.valor || 0), 0);
  const total = totalPendente + totalPago;

  const comissoesFiltradas = filtroTipo === "todos" 
    ? comissoes 
    : comissoes.filter(c => c.tipo === filtroTipo);

  // Ranking de vendedores por comissão
  const rankingVendedores = {};
  comissoes.forEach(c => {
    if (!rankingVendedores[c.vendedor_nome]) {
      rankingVendedores[c.vendedor_nome] = { nome: c.vendedor_nome, total: 0, pendente: 0, pago: 0, tipo: c.tipo };
    }
    rankingVendedores[c.vendedor_nome].total += c.valor || 0;
    if (c.status === "pago") rankingVendedores[c.vendedor_nome].pago += c.valor || 0;
    else rankingVendedores[c.vendedor_nome].pendente += c.valor || 0;
  });

  const ranking = Object.values(rankingVendedores).sort((a, b) => b.total - a.total).slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Comissões</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">Gestão automática de comissionamento</p>
        </div>
        <Button
          onClick={() => calcularMutation.mutate()}
          disabled={calcularMutation.isPending}
          className="gap-2 rounded-xl"
        >
          {calcularMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Calculando...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              Calcular Comissões
            </>
          )}
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="A Receber" value={`R$ ${totalPendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} icon={DollarSign} />
        <StatCard title="Já Pago" value={`R$ ${totalPago.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} icon={CheckCircle} accent="bg-emerald-500" />
        <StatCard title="Total" value={`R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} icon={TrendingUp} accent="bg-primary" />
        <StatCard title="Registros" value={comissoes.length} sub="comissões criadas" icon={BarChart3} />
      </div>

      {calcularMutation.data && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-700">
          <p className="font-medium">✓ {calcularMutation.data.data?.mensagem}</p>
          {calcularMutation.data.data?.valor_total > 0 && (
            <p className="mt-1 text-emerald-600">R$ {calcularMutation.data.data.valor_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} gerados</p>
          )}
        </div>
      )}

      <Tabs defaultValue="comissoes" className="space-y-4">
        <TabsList className="rounded-xl">
          <TabsTrigger value="comissoes" className="rounded-lg">Comissões</TabsTrigger>
          <TabsTrigger value="ranking" className="rounded-lg gap-1.5"><BarChart3 className="w-3.5 h-3.5" />Ranking</TabsTrigger>
        </TabsList>

        {/* Comissões Tab */}
        <TabsContent value="comissoes" className="space-y-4 mt-4">
          {/* Filtros */}
          <div className="flex gap-2 flex-wrap">
            {["todos", "vendedor", "revendedor"].map(tipo => (
              <button
                key={tipo}
                onClick={() => setFiltroTipo(tipo)}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-medium transition-all",
                  filtroTipo === tipo
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {tipo === "todos" ? "Todas" : tipo === "vendedor" ? "Vendedores" : "Revendedores"}
              </button>
            ))}
          </div>

          {/* Tabela */}
          <Card className="rounded-2xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Vendedor</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Cliente</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Plano</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Percentual</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Valor</th>
                    <th className="text-center py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Tipo</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                    <th className="py-3 px-4" />
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr><td colSpan={8} className="py-12 text-center text-muted-foreground">Carregando...</td></tr>
                  ) : comissoesFiltradas.length === 0 ? (
                    <tr><td colSpan={8} className="py-12 text-center text-muted-foreground">Nenhuma comissão</td></tr>
                  ) : comissoesFiltradas.map(c => (
                    <tr key={c.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-medium">{c.vendedor_nome || "—"}</td>
                      <td className="py-3 px-4 text-muted-foreground text-xs">{c.lead_nome || "—"}</td>
                      <td className="py-3 px-4 text-muted-foreground text-xs">{c.plano_nome || "—"}</td>
                      <td className="py-3 px-4 text-right font-medium text-sm">{c.percentual}%</td>
                      <td className="py-3 px-4 text-right font-bold text-primary">R$ {(c.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant="outline" className={cn("text-xs", c.tipo === "vendedor" ? "bg-blue-50 text-blue-600 border-blue-200" : "bg-purple-50 text-purple-600 border-purple-200")}>
                          {c.tipo === "vendedor" ? "Vend." : "Rev."}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className={c.status === "pago" ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-amber-50 text-amber-600 border-amber-200"}>
                          {c.status === "pago" ? "Pago" : "A Receber"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        {c.status === "a_receber" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs rounded-lg h-8"
                            onClick={() => updateMutation.mutate({ id: c.id })}
                            disabled={updateMutation.isPending}
                          >
                            Marcar Pago
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* Ranking Tab */}
        <TabsContent value="ranking" className="mt-4">
          <Card className="rounded-2xl border border-border p-6">
            <div className="space-y-4">
              {ranking.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Sem comissões registradas</p>
              ) : ranking.map((v, i) => (
                <div key={v.nome} className="flex items-center gap-4 pb-4 border-b border-border/50 last:border-0">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 text-white",
                    i === 0 ? "bg-amber-500" : i === 1 ? "bg-slate-400" : i === 2 ? "bg-orange-400" : "bg-muted"
                  )}>{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{v.nome}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {v.tipo === "revendedor" ? "Revendedor" : "Vendedor"} • {v.pendente > 0 ? `R$ ${v.pendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} pendente` : "Tudo pago"}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-bold text-primary">R$ {v.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                    <p className="text-xs text-muted-foreground">total</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}