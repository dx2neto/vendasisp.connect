import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DollarSign, ShoppingCart, Users, TrendingUp, Award, Copy, CheckCircle,
  Plus, Zap, BarChart3, ChevronRight
} from "lucide-react";
import { Badge as BadgeUI } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

const fmt = (v) => `R$ ${(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

function KpiCard({ title, value, sub, icon: Icon, cor }) {
  return (
    <div className="rounded-2xl bg-card border border-border p-5 hover:shadow-md transition-all">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-3", cor || "bg-primary/10")}>
        <Icon className={cn("w-5 h-5", cor ? "text-white" : "text-primary")} />
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm text-muted-foreground mt-0.5">{title}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5 opacity-70">{sub}</p>}
    </div>
  );
}

function LancamentoRevendaModal({ open, onClose }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    lead_nome: "", lead_cpf: "", plano_nome: "", valor: "",
    revendedor_nome: "", revendedor_id: "", observacao: ""
  });

  const { data: planos = [] } = useQuery({
    queryKey: ["planos"],
    queryFn: () => base44.entities.Plano.list("-created_date", 50),
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: () => base44.entities.Pedido.create({
      lead_nome: form.lead_nome,
      lead_cpf: form.lead_cpf,
      plano_nome: form.plano_nome,
      valor: parseFloat(form.valor) || 0,
      revendedor_nome: form.revendedor_nome,
      revendedor_id: form.revendedor_id,
      canal_origem: "revenda",
      status: "novo",
      observacao: form.observacao,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      setForm({ lead_nome: "", lead_cpf: "", plano_nome: "", valor: "", revendedor_nome: "", revendedor_id: "", observacao: "" });
      onClose();
    },
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Plus className="w-5 h-5 text-primary" />
            Lançar Venda por Revendedor
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Revendedor *</label>
              <Input placeholder="Nome do revendedor" value={form.revendedor_nome} onChange={e => set("revendedor_nome", e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-1.5 col-span-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nome do Cliente *</label>
              <Input placeholder="Nome completo" value={form.lead_nome} onChange={e => set("lead_nome", e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-1.5 col-span-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">CPF / CNPJ</label>
              <Input placeholder="000.000.000-00" value={form.lead_cpf} onChange={e => set("lead_cpf", e.target.value)} className="rounded-xl" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Plano</label>
            {planos.length > 0 ? (
              <select
                className="w-full h-9 rounded-xl border border-input bg-transparent px-3 text-sm"
                value={form.plano_nome}
                onChange={e => {
                  const p = planos.find(p => p.nome === e.target.value);
                  set("plano_nome", e.target.value);
                  if (p) set("valor", String(p.preco_mensal || ""));
                }}
              >
                <option value="">Selecione um plano...</option>
                {planos.map(p => (
                  <option key={p.id} value={p.nome}>{p.nome} — R$ {(p.preco_mensal || 0).toFixed(2)}</option>
                ))}
              </select>
            ) : (
              <Input placeholder="Ex: Fibra 300MB" value={form.plano_nome} onChange={e => set("plano_nome", e.target.value)} className="rounded-xl" />
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Valor Mensal (R$)</label>
            <Input type="number" placeholder="0,00" value={form.valor} onChange={e => set("valor", e.target.value)} className="rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Observação</label>
            <Input placeholder="Opcional..." value={form.observacao} onChange={e => set("observacao", e.target.value)} className="rounded-xl" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose}>Cancelar</Button>
            <Button
              className="flex-1 rounded-xl gap-2"
              disabled={!form.lead_nome || !form.revendedor_nome || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? <><Zap className="w-4 h-4 animate-pulse" />Salvando...</> : <><Plus className="w-4 h-4" />Lançar Venda</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Revendedor() {
  const [copied, setCopied] = useState(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [selecionado, setSelecionado] = useState(null);

  const { data: pedidos = [] } = useQuery({ queryKey: ["pedidos"], queryFn: () => base44.entities.Pedido.list("-created_date", 500) });
  const { data: comissoes = [] } = useQuery({ queryKey: ["comissoes"], queryFn: () => base44.entities.Comissao.list("-created_date", 500) });

  // Agrupa por revendedor
  const revendedoresMap = {};
  pedidos.forEach(p => {
    if (!p.revendedor_nome) return;
    if (!revendedoresMap[p.revendedor_nome]) revendedoresMap[p.revendedor_nome] = {
      id: p.revendedor_id, nome: p.revendedor_nome, pedidos: [], ativados: 0, valor: 0, comissao: 0, comissao_pendente: 0
    };
    revendedoresMap[p.revendedor_nome].pedidos.push(p);
    if (p.status === "ativado") {
      revendedoresMap[p.revendedor_nome].ativados++;
      revendedoresMap[p.revendedor_nome].valor += p.valor || 0;
    }
  });
  comissoes.forEach(c => {
    if (c.tipo !== "revendedor") return;
    const r = revendedoresMap[c.vendedor_nome];
    if (!r) return;
    r.comissao += c.valor || 0;
    if (c.status === "a_receber") r.comissao_pendente += c.valor || 0;
  });

  const lista = Object.values(revendedoresMap).sort((a, b) => b.ativados - a.ativados);
  const maxAtivados = lista[0]?.ativados || 1;

  const totalAtivos = lista.length;
  const totalVendas = lista.reduce((s, r) => s + r.ativados, 0);
  const totalValor = lista.reduce((s, r) => s + r.valor, 0);
  const totalComissaoPendente = lista.reduce((s, r) => s + r.comissao_pendente, 0);

  const graficoTop = lista.slice(0, 7).map(r => ({ nome: r.nome.split(" ")[0], ativados: r.ativados, valor: r.valor }));

  const copyLink = (nome) => {
    navigator.clipboard.writeText(`${window.location.origin}?revendedor=${encodeURIComponent(nome)}`);
    setCopied(nome);
    setTimeout(() => setCopied(null), 2000);
  };

  const revendedorSel = selecionado ? revendedoresMap[selecionado] : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Central de Revenda</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">Performance e lançamento de vendas dos parceiros</p>
        </div>
        <Button onClick={() => setModalAberto(true)} className="gap-2 rounded-xl">
          <Plus className="w-4 h-4" />Lançar Venda
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Revendedores Ativos" value={totalAtivos} icon={Users} cor="bg-blue-500" />
        <KpiCard title="Contratos Ativados" value={totalVendas} sub="por revendedores" icon={CheckCircle} cor="bg-emerald-500" />
        <KpiCard title="Receita Gerada" value={`R$ ${(totalValor / 1000).toFixed(1)}k`} sub="total ativado" icon={TrendingUp} cor="bg-purple-500" />
        <KpiCard title="Comissões a Pagar" value={`R$ ${(totalComissaoPendente / 1000).toFixed(1)}k`} sub="pendentes" icon={DollarSign} cor="bg-amber-500" />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="ranking" className="space-y-4">
        <TabsList className="rounded-xl">
          <TabsTrigger value="ranking" className="rounded-lg gap-1.5">
            <Award className="w-3.5 h-3.5" />Ranking
          </TabsTrigger>
          <TabsTrigger value="grafico" className="rounded-lg gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" />Gráfico
          </TabsTrigger>
          <TabsTrigger value="pedidos" className="rounded-lg gap-1.5">
            <ShoppingCart className="w-3.5 h-3.5" />Pedidos por Revendedor
          </TabsTrigger>
        </TabsList>

        {/* Ranking */}
        <TabsContent value="ranking" className="mt-4">
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase">#</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase">Revendedor</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase">Pedidos</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase">Ativados</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase">Conv.</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase">Receita</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase">Comissão</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase">Pendente</th>
                    <th className="py-3 px-4" />
                  </tr>
                </thead>
                <tbody>
                  {lista.length === 0 ? (
                    <tr><td colSpan={9} className="py-12 text-center text-muted-foreground">Nenhum revendedor com pedidos</td></tr>
                  ) : lista.map((r, i) => {
                    const conv = r.pedidos.length > 0 ? Math.round((r.ativados / r.pedidos.length) * 100) : 0;
                    return (
                      <tr
                        key={r.nome}
                        className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => setSelecionado(selecionado === r.nome ? null : r.nome)}
                      >
                        <td className="py-3 px-4">
                          <div className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                            i === 0 ? "bg-amber-100 text-amber-600" : i === 1 ? "bg-slate-100 text-slate-500" : i === 2 ? "bg-orange-100 text-orange-500" : "bg-muted text-muted-foreground"
                          )}>{i + 1}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                              {r.nome.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{r.nome}</p>
                              <div className="h-1 w-20 bg-muted rounded-full mt-1 overflow-hidden">
                                <div className="h-full bg-primary rounded-full" style={{ width: `${Math.round((r.ativados / maxAtivados) * 100)}%` }} />
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right text-sm text-muted-foreground">{r.pedidos.length}</td>
                        <td className="py-3 px-4 text-right">
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 text-xs">{r.ativados}</Badge>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className={cn("text-xs font-semibold", conv >= 50 ? "text-emerald-600" : conv >= 25 ? "text-amber-500" : "text-muted-foreground")}>{conv}%</span>
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-sm">{fmt(r.valor)}</td>
                        <td className="py-3 px-4 text-right font-bold text-primary text-sm">{fmt(r.comissao)}</td>
                        <td className="py-3 px-4 text-right">
                          <Badge variant="outline" className={cn("text-xs", r.comissao_pendente > 0 ? "bg-amber-50 text-amber-600 border-amber-200" : "bg-muted text-muted-foreground")}>
                            {fmt(r.comissao_pendente)}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <button onClick={e => { e.stopPropagation(); copyLink(r.nome); }} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                            {copied === r.nome ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="lg:hidden divide-y divide-border/50">
              {lista.map((r, i) => {
                const conv = r.pedidos.length > 0 ? Math.round((r.ativados / r.pedidos.length) * 100) : 0;
                return (
                  <div key={r.nome} className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold",
                          i === 0 ? "bg-amber-100 text-amber-600" : i === 1 ? "bg-slate-100 text-slate-500" : "bg-muted text-muted-foreground"
                        )}>{i + 1}</div>
                        <p className="font-semibold text-sm">{r.nome}</p>
                      </div>
                      <button onClick={() => copyLink(r.nome)} className="p-1 rounded hover:bg-muted">
                        {copied === r.nome ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div><p className="text-muted-foreground">Pedidos</p><p className="font-semibold">{r.pedidos.length}</p></div>
                      <div><p className="text-muted-foreground">Ativados</p><p className="font-semibold text-emerald-600">{r.ativados}</p></div>
                      <div><p className="text-muted-foreground">Conv.</p><p className={cn("font-semibold", conv >= 50 ? "text-emerald-600" : "text-amber-500")}>{conv}%</p></div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs border-t border-border pt-2">
                      <div><p className="text-muted-foreground">Receita</p><p className="font-semibold">{fmt(r.valor)}</p></div>
                      <div><p className="text-muted-foreground">Comissão pend.</p><p className="font-semibold text-amber-600">{fmt(r.comissao_pendente)}</p></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {/* Gráfico */}
        <TabsContent value="grafico" className="mt-4">
          <div className="rounded-2xl border border-border bg-card p-6">
            <h3 className="font-semibold mb-5">Top 7 Revendedores — Ativações</h3>
            {graficoTop.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">Sem dados</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={graficoTop} layout="vertical" barSize={18}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="nome" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={70} />
                  <Tooltip contentStyle={{ borderRadius: 10, fontSize: 12 }} formatter={v => [v, "Ativações"]} />
                  <Bar dataKey="ativados" name="Ativados" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </TabsContent>

        {/* Pedidos por revendedor */}
        <TabsContent value="pedidos" className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            {lista.map(r => (
              <button
                key={r.nome}
                onClick={() => setSelecionado(selecionado === r.nome ? null : r.nome)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-sm border transition-all font-medium",
                  selecionado === r.nome ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted"
                )}
              >
                {r.nome.split(" ")[0]} <span className="opacity-60">({r.ativados})</span>
              </button>
            ))}
          </div>

          {revendedorSel && (
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="px-5 py-3 border-b border-border bg-muted/20 flex items-center justify-between">
                <p className="font-semibold text-sm">{revendedorSel.nome} — {revendedorSel.pedidos.length} pedido(s)</p>
                <span className="text-xs text-muted-foreground">{fmt(revendedorSel.valor)} em receita ativada</span>
              </div>
              <div className="divide-y divide-border/50">
                {revendedorSel.pedidos.map(p => (
                  <div key={p.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/20">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{p.lead_nome}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{p.plano_nome || "—"} • {p.created_date ? format(new Date(p.created_date), "dd/MM/yy") : ""}</p>
                    </div>
                    <div className="flex items-center gap-3 ml-3">
                      <Badge variant="outline" className={cn("text-xs", {
                        ativado: "bg-emerald-50 text-emerald-600 border-emerald-200",
                        novo: "bg-blue-50 text-blue-600 border-blue-200",
                        recusado: "bg-red-50 text-red-500 border-red-200",
                      }[p.status] || "bg-muted text-muted-foreground")}>
                        {p.status?.replace(/_/g, " ")}
                      </Badge>
                      <span className="text-sm font-bold text-primary">{fmt(p.valor)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!selecionado && (
            <div className="rounded-2xl border border-dashed border-border bg-muted/20 py-10 text-center text-muted-foreground text-sm">
              Selecione um revendedor acima para ver os pedidos
            </div>
          )}
        </TabsContent>
      </Tabs>

      <LancamentoRevendaModal open={modalAberto} onClose={() => setModalAberto(false)} />
    </div>
  );
}