import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Download, FileText, TrendingUp, Users, ShoppingCart, DollarSign } from "lucide-react";
import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Analytics() {
  const [periodo, setPeriodo] = useState("6m");

  const { data: pedidos = [] } = useQuery({
    queryKey: ["pedidos"],
    queryFn: () => base44.entities.Pedido.list("-created_date", 500),
  });

  const { data: leads = [] } = useQuery({
    queryKey: ["leads"],
    queryFn: () => base44.entities.Lead.list("-created_date", 500),
  });

  const { data: comissoes = [] } = useQuery({
    queryKey: ["comissoes"],
    queryFn: () => base44.entities.Comissao.list("-created_date", 500),
  });

  // Filtrar por período
  const dias = periodo === "1m" ? 30 : periodo === "3m" ? 90 : 180;
  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - dias);

  const pedidosFiltrados = pedidos.filter(p => new Date(p.created_date) >= dataLimite);
  const leadsFiltrados = leads.filter(l => new Date(l.data_entrada) >= dataLimite);
  const comissoesFiltradas = comissoes.filter(c => new Date(c.created_date) >= dataLimite);

  // Cálculos
  const totalVendas = pedidosFiltrados.reduce((s, p) => s + (p.valor || 0), 0);
  const totalComissoes = comissoesFiltradas.reduce((s, c) => s + (c.valor || 0), 0);
  const taxaConversao = leadsFiltrados.length > 0 ? ((pedidosFiltrados.length / leadsFiltrados.length) * 100).toFixed(1) : 0;
  const ticketMedio = pedidosFiltrados.length > 0 ? (totalVendas / pedidosFiltrados.length).toFixed(2) : 0;

  // Gráfico de vendas por período
  const vendasPorData = {};
  pedidosFiltrados.forEach(p => {
    const data = format(new Date(p.created_date), "dd/MMM", { locale: ptBR });
    vendasPorData[data] = (vendasPorData[data] || 0) + (p.valor || 0);
  });
  const chartVendas = Object.entries(vendasPorData).map(([data, valor]) => ({ data, valor }));

  // Status distribuição
  const statusDist = {};
  pedidosFiltrados.forEach(p => {
    statusDist[p.status] = (statusDist[p.status] || 0) + 1;
  });

  // Top vendedores
  const topVendedores = {};
  pedidosFiltrados.forEach(p => {
    if (p.vendedor_nome) {
      if (!topVendedores[p.vendedor_nome]) {
        topVendedores[p.vendedor_nome] = { vendas: 0, pedidos: 0, comissoes: 0 };
      }
      topVendedores[p.vendedor_nome].vendas += p.valor || 0;
      topVendedores[p.vendedor_nome].pedidos += 1;
    }
  });

  comissoesFiltradas.forEach(c => {
    if (topVendedores[c.vendedor_nome]) {
      topVendedores[c.vendedor_nome].comissoes += c.valor || 0;
    }
  });

  const rankingVendedores = Object.entries(topVendedores)
    .map(([nome, dados]) => ({ nome, ...dados }))
    .sort((a, b) => b.vendas - a.vendas)
    .slice(0, 10);

  // Exportar PDF
  const exportarPDF = () => {
    const doc = new jsPDF();
    const titulo = `Relatório de Vendas - ${periodo === "1m" ? "1 mês" : periodo === "3m" ? "3 meses" : "6 meses"}`;
    
    doc.setFontSize(16);
    doc.text(titulo, 14, 15);
    doc.setFontSize(10);
    doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`, 14, 22);

    let yPos = 35;

    // KPIs
    doc.setFontSize(12);
    doc.text("KPIs Principais", 14, yPos);
    yPos += 8;

    const kpiData = [
      ["Total de Vendas", `R$ ${totalVendas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`],
      ["Total de Comissões", `R$ ${totalComissoes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`],
      ["Ticket Médio", `R$ ${Number(ticketMedio).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`],
      ["Taxa de Conversão", `${taxaConversao}%`],
      ["Pedidos", pedidosFiltrados.length.toString()],
      ["Leads", leadsFiltrados.length.toString()],
    ];

    doc.setFontSize(9);
    kpiData.forEach((row, i) => {
      doc.text(row[0], 14, yPos + (i * 6));
      doc.text(row[1], 120, yPos + (i * 6), { align: "right" });
    });

    yPos += (kpiData.length * 6) + 10;

    // Ranking de vendedores
    doc.setFontSize(12);
    doc.text("Top 10 Vendedores", 14, yPos);
    yPos += 8;

    doc.setFontSize(9);
    doc.text("Vendedor", 14, yPos);
    doc.text("Vendas", 80, yPos);
    doc.text("Pedidos", 120, yPos);
    doc.text("Comissões", 150, yPos);
    yPos += 6;

    rankingVendedores.forEach((v, i) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 15;
      }
      doc.text(v.nome, 14, yPos);
      doc.text(`R$ ${v.vendas.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`, 80, yPos);
      doc.text(v.pedidos.toString(), 120, yPos);
      doc.text(`R$ ${v.comissoes.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`, 150, yPos);
      yPos += 6;
    });

    doc.save(`relatorio-vendas-${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">Dashboard com performance e KPIs</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {["1m", "3m", "6m"].map(p => (
            <Button
              key={p}
              variant={periodo === p ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriodo(p)}
              className="rounded-lg"
            >
              {p === "1m" ? "1 mês" : p === "3m" ? "3 meses" : "6 meses"}
            </Button>
          ))}
          <Button onClick={exportarPDF} className="gap-2 rounded-lg" size="sm">
            <Download className="w-4 h-4" />
            PDF
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border border-border">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase">Total Vendido</p>
                <p className="text-2xl font-bold mt-2 text-primary">R$ {totalVendas.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</p>
              </div>
              <DollarSign className="w-5 h-5 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase">Comissões</p>
                <p className="text-2xl font-bold mt-2 text-emerald-600">R$ {totalComissoes.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</p>
              </div>
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase">Ticket Médio</p>
                <p className="text-2xl font-bold mt-2">R$ {Number(ticketMedio).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</p>
              </div>
              <ShoppingCart className="w-5 h-5 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase">Conversão</p>
                <p className="text-2xl font-bold mt-2">{taxaConversao}%</p>
              </div>
              <Users className="w-5 h-5 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 rounded-2xl border border-border">
          <CardHeader>
            <CardTitle className="text-lg">Vendas por Período</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartVendas}>
                <defs>
                  <linearGradient id="colorVendas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="data" stroke="hsl(var(--muted-foreground))" style={{ fontSize: "12px" }} />
                <YAxis stroke="hsl(var(--muted-foreground))" style={{ fontSize: "12px" }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                  formatter={(value) => `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`}
                />
                <Area type="monotone" dataKey="valor" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorVendas)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border">
          <CardHeader>
            <CardTitle className="text-lg">Status</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={Object.entries(statusDist).map(([status, count]) => ({ name: status, value: count }))}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {["#10b981", "#f59e0b", "#ef4444", "#3b82f6"].map((color, i) => (
                    <Cell key={`cell-${i}`} fill={color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Ranking Vendedores */}
      <Card className="rounded-2xl border border-border">
        <CardHeader>
          <CardTitle className="text-lg">Top 10 Vendedores</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase">Vendedor</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase">Vendas</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase">Pedidos</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase">Comissões</th>
                </tr>
              </thead>
              <tbody>
                {rankingVendedores.map((v, i) => (
                  <tr key={v.nome} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-medium">
                      <span className="inline-block w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mr-2">{i + 1}</span>
                      {v.nome}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-primary">R$ {v.vendas.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</td>
                    <td className="py-3 px-4 text-right">{v.pedidos}</td>
                    <td className="py-3 px-4 text-right font-semibold text-emerald-600">R$ {v.comissoes.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}