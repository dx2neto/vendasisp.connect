import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import { Download } from "lucide-react";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function DesempenhoMensal() {
  const [mesSelecionado, setMesSelecionado] = useState(new Date().toISOString().slice(0, 7));

  const { data: pedidos = [] } = useQuery({
    queryKey: ["pedidos"],
    queryFn: () => base44.entities.Pedido.list("-created_date", 500),
  });

  const { data: comissoes = [] } = useQuery({
    queryKey: ["comissoes"],
    queryFn: () => base44.entities.Comissao.list("-created_date", 500),
  });

  const { data: planos = [] } = useQuery({
    queryKey: ["planos"],
    queryFn: () => base44.entities.Plano.list("-created_date", 100),
  });

  // Filtra pedidos do mês selecionado (ativados/assinados)
  const pedidosMes = pedidos.filter(p => 
    p.created_date?.slice(0, 7) === mesSelecionado &&
    ["assinado", "ativado"].includes(p.status)
  );

  // Filtra comissões do mês selecionado
  const comissoesMes = comissoes.filter(c => 
    c.created_date?.slice(0, 7) === mesSelecionado
  );

  // Vendas por plano
  const vendasPorPlano = {};
  pedidosMes.forEach(p => {
    const plano = p.plano_nome || "Sem Plano";
    if (!vendasPorPlano[plano]) {
      vendasPorPlano[plano] = { count: 0, valor: 0 };
    }
    vendasPorPlano[plano].count += 1;
    vendasPorPlano[plano].valor += p.valor || 0;
  });

  const chartPlanos = Object.entries(vendasPorPlano).map(([plano, dados]) => ({
    plano,
    vendas: dados.count,
    valor: dados.valor,
  }));

  // Comissões por vendedor
  const comissoesPorVendedor = {};
  comissoesMes.forEach(c => {
    if (!comissoesPorVendedor[c.vendedor_nome]) {
      comissoesPorVendedor[c.vendedor_nome] = { valor: 0, pedidos: 0, vendas: 0 };
    }
    comissoesPorVendedor[c.vendedor_nome].valor += c.valor || 0;
    comissoesPorVendedor[c.vendedor_nome].pedidos += 1;
  });

  // Soma vendas por vendedor
  pedidosMes.forEach(p => {
    if (p.vendedor_nome && comissoesPorVendedor[p.vendedor_nome]) {
      comissoesPorVendedor[p.vendedor_nome].vendas += p.valor || 0;
    }
  });

  const chartComissoes = Object.entries(comissoesPorVendedor)
    .map(([vendedor, dados]) => ({
      vendedor,
      comissao: dados.valor,
      vendas: dados.vendas,
    }))
    .sort((a, b) => b.comissao - a.comissao);

  // KPIs
  const totalVendas = pedidosMes.reduce((s, p) => s + (p.valor || 0), 0);
  const totalComissoes = comissoesMes.reduce((s, c) => s + (c.valor || 0), 0);
  const quantidadePedidos = pedidosMes.length;
  const ticketMedio = quantidadePedidos > 0 ? totalVendas / quantidadePedidos : 0;

  // Últimos 6 meses (tendência)
  const ultimosMeses = [];
  for (let i = 5; i >= 0; i--) {
    ultimosMeses.push(format(subMonths(new Date(), i), "yyyy-MM"));
  }

  const tendenciaData = ultimosMeses.map(mes => {
    const pedidosMesX = pedidos.filter(p => 
      p.created_date?.slice(0, 7) === mes &&
      ["assinado", "ativado"].includes(p.status)
    );
    return {
      mes: format(new Date(mes + "-01"), "MMM", { locale: ptBR }),
      valor: pedidosMesX.reduce((s, p) => s + (p.valor || 0), 0),
    };
  });

  const exportarPDF = () => {
    const conteudo = `
RELATÓRIO DE DESEMPENHO MENSAL
Período: ${format(new Date(mesSelecionado + "-01"), "MMMM/yyyy", { locale: ptBR })}

KPIs PRINCIPAIS:
- Total de Vendas: R$ ${totalVendas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
- Total de Comissões: R$ ${totalComissoes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
- Quantidade de Pedidos: ${quantidadePedidos}
- Ticket Médio: R$ ${ticketMedio.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}

VENDAS POR PLANO:
${Object.entries(vendasPorPlano).map(([plano, d]) => 
  `- ${plano}: ${d.count} vendas | R$ ${d.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
).join('\n')}

COMISSÕES POR VENDEDOR:
${Object.entries(comissoesPorVendedor).map(([vendedor, d]) => 
  `- ${vendedor}: ${d.pedidos} pedidos | R$ ${d.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} comissão | R$ ${d.vendas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} vendas`
).join('\n')}
    `;
    
    const blob = new Blob([conteudo], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `desempenho-${mesSelecionado}.txt`;
    a.click();
  };

  return (
    <div className="space-y-4 sm:space-y-6 pb-20 sm:pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Desempenho Mensal</h1>
          <p className="text-muted-foreground mt-1 text-xs sm:text-sm">Análise de vendas e comissões</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <input
            type="month"
            value={mesSelecionado}
            onChange={(e) => setMesSelecionado(e.target.value)}
            className="rounded-lg border border-border px-3 py-2 text-sm bg-card"
          />
          <Button onClick={exportarPDF} variant="outline" size="sm" className="gap-2 rounded-lg">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Exportar</span>
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
        <Card className="rounded-xl">
          <CardContent className="p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-muted-foreground">Total Vendas</p>
            <p className="text-lg sm:text-2xl font-bold mt-1 text-primary">R$ {(totalVendas / 1000).toFixed(1)}k</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-muted-foreground">Comissões</p>
            <p className="text-lg sm:text-2xl font-bold mt-1 text-emerald-600">R$ {(totalComissoes / 1000).toFixed(1)}k</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-muted-foreground">Pedidos</p>
            <p className="text-lg sm:text-2xl font-bold mt-1">{quantidadePedidos}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-muted-foreground">Ticket Médio</p>
            <p className="text-lg sm:text-2xl font-bold mt-1">R$ {(ticketMedio / 1000).toFixed(1)}k</p>
          </CardContent>
        </Card>
      </div>

      {/* Tendência 6 meses */}
      <Card className="rounded-xl sm:rounded-2xl">
        <CardHeader className="pb-3 sm:pb-6">
          <CardTitle className="text-base sm:text-lg">Tendência de Vendas (6 meses)</CardTitle>
        </CardHeader>
        <CardContent className="h-64 sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={tendenciaData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" style={{ fontSize: "12px" }} />
              <YAxis stroke="hsl(var(--muted-foreground))" style={{ fontSize: "12px" }} />
              <Tooltip 
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                formatter={(value) => `R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`}
              />
              <Line type="monotone" dataKey="valor" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))" }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Vendas por Plano */}
      {chartPlanos.length > 0 && (
        <Card className="rounded-xl sm:rounded-2xl">
          <CardHeader className="pb-3 sm:pb-6">
            <CardTitle className="text-base sm:text-lg">Vendas por Plano</CardTitle>
          </CardHeader>
          <CardContent className="h-64 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartPlanos}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="plano" stroke="hsl(var(--muted-foreground))" style={{ fontSize: "10px" }} />
                <YAxis stroke="hsl(var(--muted-foreground))" style={{ fontSize: "10px" }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                  formatter={(value) => `R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`}
                />
                <Legend />
                <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Comissões por Vendedor */}
      {chartComissoes.length > 0 && (
        <Card className="rounded-xl sm:rounded-2xl">
          <CardHeader className="pb-3 sm:pb-6">
            <CardTitle className="text-base sm:text-lg">Comissões Acumuladas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase">Vendedor</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase">Vendas</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase">Comissão</th>
                  </tr>
                </thead>
                <tbody>
                  {chartComissoes.map(c => (
                    <tr key={c.vendedor} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="py-3 px-4 font-medium">{c.vendedor}</td>
                      <td className="py-3 px-4 text-right">R$ {c.vendas.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</td>
                      <td className="py-3 px-4 text-right font-semibold text-emerald-600">R$ {c.comissao.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="sm:hidden space-y-2">
              {chartComissoes.map(c => (
                <div key={c.vendedor} className="bg-muted/30 rounded-lg p-3 text-sm">
                  <p className="font-semibold truncate">{c.vendedor}</p>
                  <div className="grid grid-cols-2 gap-3 mt-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Vendas</p>
                      <p className="font-semibold">R$ {(c.vendas / 1000).toFixed(1)}k</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Comissão</p>
                      <p className="font-semibold text-emerald-600">R$ {(c.comissao / 1000).toFixed(1)}k</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}