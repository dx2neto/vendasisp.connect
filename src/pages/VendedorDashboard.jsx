import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";
import {
  TrendingUp, DollarSign, Target, ShoppingCart, CheckCircle2, Clock,
  Plus, Trophy, Zap, Star, AlertCircle, ChevronRight, X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, startOfMonth, subMonths, isWithinInterval, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_MAP = {
  novo:              { label: "Novo",        cor: "bg-blue-50 text-blue-600 border-blue-200" },
  analise_credito:   { label: "Crédito",     cor: "bg-amber-50 text-amber-600 border-amber-200" },
  viabilidade:       { label: "Viabilidade", cor: "bg-purple-50 text-purple-600 border-purple-200" },
  contrato_pendente: { label: "Contrato",    cor: "bg-cyan-50 text-cyan-600 border-cyan-200" },
  assinado:          { label: "Assinado",    cor: "bg-teal-50 text-teal-600 border-teal-200" },
  ativado:           { label: "Ativado",     cor: "bg-emerald-50 text-emerald-600 border-emerald-200" },
  recusado:          { label: "Recusado",    cor: "bg-red-50 text-red-500 border-red-200" },
};

const fmt = (v) => `R$ ${(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

function KpiCard({ icon: Icon, label, value, sub, accent, destaque }) {
  return (
    <div className={cn(
      "rounded-2xl border p-5 flex flex-col gap-3 transition-all hover:shadow-md",
      destaque ? "bg-primary border-primary/20 text-primary-foreground" : "bg-card border-border"
    )}>
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", accent || (destaque ? "bg-white/20" : "bg-primary/10"))}>
        <Icon className={cn("w-5 h-5", destaque ? "text-white" : "text-primary")} />
      </div>
      <div>
        <p className={cn("text-2xl font-bold", destaque && "text-white")}>{value}</p>
        <p className={cn("text-sm mt-0.5", destaque ? "text-white/70" : "text-muted-foreground")}>{label}</p>
        {sub && <p className={cn("text-xs mt-0.5", destaque ? "text-white/50" : "text-muted-foreground opacity-70")}>{sub}</p>}
      </div>
    </div>
  );
}

function LancamentoVendaModal({ open, onClose, vendedorNome, onSuccess }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    lead_nome: "", lead_cpf: "", plano_nome: "", valor: "", observacao: ""
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
      vendedor_nome: vendedorNome,
      canal_origem: "call_center",
      status: "novo",
      observacao: form.observacao,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      setForm({ lead_nome: "", lead_cpf: "", plano_nome: "", valor: "", observacao: "" });
      onSuccess?.();
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
            Lançar Nova Venda
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nome do Cliente *</label>
            <Input placeholder="Nome completo" value={form.lead_nome} onChange={e => set("lead_nome", e.target.value)} className="rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">CPF / CNPJ</label>
            <Input placeholder="000.000.000-00" value={form.lead_cpf} onChange={e => set("lead_cpf", e.target.value)} className="rounded-xl" />
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
              disabled={!form.lead_nome || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? <><Zap className="w-4 h-4 animate-pulse" />Salvando...</> : <><Plus className="w-4 h-4" />Lançar Venda</>}
            </Button>
          </div>
          {mutation.isError && (
            <p className="text-xs text-red-500 text-center">Erro ao salvar. Tente novamente.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function VendedorDashboard() {
  const [me, setMe] = useState(null);
  const [modalAberto, setModalAberto] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => { base44.auth.me().then(setMe); }, []);

  const { data: pedidos = [] } = useQuery({
    queryKey: ["pedidos"],
    queryFn: () => base44.entities.Pedido.list("-created_date", 500),
    enabled: !!me,
  });
  const { data: comissoes = [] } = useQuery({
    queryKey: ["comissoes"],
    queryFn: () => base44.entities.Comissao.list("-created_date", 500),
    enabled: !!me,
  });
  const { data: metas = [] } = useQuery({
    queryKey: ["metas"],
    queryFn: () => base44.entities.MetaVendedor.list("-created_date", 50).catch(() => []),
    enabled: !!me,
  });

  if (!me) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  const meusPedidos = pedidos.filter(p => p.vendedor_id === me.id || p.vendedor_nome === me.full_name);
  const minhasComissoes = comissoes.filter(c => c.vendedor_id === me.id || c.vendedor_nome === me.full_name);

  // KPIs
  const totalVendido = meusPedidos.filter(p => p.status === "ativado").reduce((s, p) => s + (p.valor || 0), 0);
  const ativados = meusPedidos.filter(p => p.status === "ativado").length;
  const emAndamento = meusPedidos.filter(p => !["ativado","recusado"].includes(p.status)).length;
  const comissaoPendente = minhasComissoes.filter(c => c.status === "a_receber").reduce((s, c) => s + (c.valor || 0), 0);
  const comissaoPaga = minhasComissoes.filter(c => c.status === "pago").reduce((s, c) => s + (c.valor || 0), 0);
  const txConversao = meusPedidos.length > 0 ? Math.round((ativados / meusPedidos.length) * 100) : 0;

  // Meta do mês atual
  const mesAtual = format(new Date(), "yyyy-MM");
  const metaMes = metas.find(m => m.mes === mesAtual && (m.vendedor_nome === me.full_name));
  const receitaMesAtual = meusPedidos.filter(p => {
    if (p.status !== "ativado" || !p.data_ativacao) return false;
    const ref = new Date();
    return isWithinInterval(new Date(p.data_ativacao), { start: startOfMonth(ref), end: endOfMonth(ref) });
  }).reduce((s, p) => s + (p.valor || 0), 0);
  const progressoMeta = metaMes ? Math.min(Math.round((receitaMesAtual / metaMes.meta_valor) * 100), 100) : null;

  // Gráfico mensal (6 meses)
  const graficoMeses = Array.from({ length: 6 }, (_, i) => {
    const ref = subMonths(new Date(), 5 - i);
    const ini = startOfMonth(ref), fim = endOfMonth(ref);
    const receita = meusPedidos
      .filter(p => p.status === "ativado" && p.data_ativacao && isWithinInterval(new Date(p.data_ativacao), { start: ini, end: fim }))
      .reduce((s, p) => s + (p.valor || 0), 0);
    const pedidosMes = meusPedidos.filter(p => p.created_date && isWithinInterval(new Date(p.created_date), { start: ini, end: fim })).length;
    return { mes: format(ref, "MMM", { locale: ptBR }), receita, pedidos: pedidosMes };
  });

  const pieData = [
    { name: "Ativados", value: ativados, fill: "#10b981" },
    { name: "Em Andamento", value: emAndamento, fill: "#f59e0b" },
    { name: "Recusados", value: meusPedidos.filter(p => p.status === "recusado").length, fill: "#ef4444" },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-white p-6 flex items-center justify-between">
        <div>
          <p className="text-white/70 text-sm mb-1">Bem-vindo de volta 👋</p>
          <h1 className="text-2xl font-bold">{me.full_name}</h1>
          <p className="text-white/60 text-sm mt-0.5">{me.email}</p>
        </div>
        <Button
          onClick={() => setModalAberto(true)}
          className="bg-white text-primary hover:bg-white/90 gap-2 rounded-xl font-semibold shadow-lg"
        >
          <Plus className="w-4 h-4" />
          Lançar Venda
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard label="Receita Ativada" value={fmt(totalVendido)} sub={`${ativados} contratos`} icon={CheckCircle2} accent="bg-emerald-500" />
        <KpiCard label="Em Andamento" value={emAndamento} sub="pedidos ativos" icon={Clock} accent="bg-blue-500" />
        <KpiCard label="Taxa de Conversão" value={`${txConversao}%`} sub={`${meusPedidos.length} total`} icon={TrendingUp} accent="bg-purple-500" />
        <KpiCard label="Comissão a Receber" value={fmt(comissaoPendente)} sub={`${fmt(comissaoPaga)} já pago`} icon={DollarSign} accent="bg-amber-500" />
        <KpiCard label="Total de Pedidos" value={meusPedidos.length} sub="todos os períodos" icon={ShoppingCart} destaque />
      </div>

      {/* Meta do mês */}
      {progressoMeta !== null && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm">Meta do Mês — {format(new Date(), "MMMM/yyyy", { locale: ptBR })}</span>
            </div>
            <span className={cn("text-sm font-bold", progressoMeta >= 100 ? "text-emerald-600" : progressoMeta >= 60 ? "text-amber-600" : "text-muted-foreground")}>
              {progressoMeta}%
            </span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-700", progressoMeta >= 100 ? "bg-emerald-500" : progressoMeta >= 60 ? "bg-amber-500" : "bg-primary")}
              style={{ width: `${progressoMeta}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <span>{fmt(receitaMesAtual)} realizados</span>
            <span>Meta: {fmt(metaMes?.meta_valor)}</span>
          </div>
          {progressoMeta >= 100 && (
            <div className="mt-3 flex items-center gap-2 text-emerald-600 text-sm font-medium">
              <Trophy className="w-4 h-4" /> Meta atingida! Parabéns! 🎉
            </div>
          )}
        </div>
      )}

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-6">
          <h3 className="font-semibold mb-4">Receita por Mês</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={graficoMeses}>
              <defs>
                <linearGradient id="gradVendedor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }}
                formatter={(v, n) => [n === "receita" ? fmt(v) : v, n === "receita" ? "Receita" : "Pedidos"]}
              />
              <Area type="monotone" dataKey="receita" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#gradVendedor)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 flex flex-col">
          <h3 className="font-semibold mb-4">Status dos Pedidos</h3>
          {meusPedidos.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Sem pedidos</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={3} dataKey="value">
                    {pieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-3">
                {pieData.map(d => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.fill }} />
                      {d.name}
                    </span>
                    <span className="font-semibold">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Tabs: Meus Pedidos | Comissões */}
      <Tabs defaultValue="pedidos" className="space-y-4">
        <TabsList className="rounded-xl">
          <TabsTrigger value="pedidos" className="rounded-lg gap-1.5">
            <ShoppingCart className="w-3.5 h-3.5" />Meus Pedidos
            <span className="ml-1 bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{meusPedidos.length}</span>
          </TabsTrigger>
          <TabsTrigger value="comissoes" className="rounded-lg gap-1.5">
            <DollarSign className="w-3.5 h-3.5" />Comissões
            {comissaoPendente > 0 && <span className="ml-1 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">!</span>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pedidos" className="mt-4">
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/20">
              <p className="text-sm font-medium">Todos os meus pedidos</p>
              <Button size="sm" className="gap-1.5 rounded-xl text-xs h-8" onClick={() => setModalAberto(true)}>
                <Plus className="w-3.5 h-3.5" />Nova Venda
              </Button>
            </div>
            <div className="divide-y divide-border/50">
              {meusPedidos.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground text-sm">
                  <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  Nenhum pedido ainda. Lance sua primeira venda!
                </div>
              ) : meusPedidos.slice(0, 20).map(p => (
                <div key={p.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/20 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{p.lead_nome}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{p.plano_nome || "—"} • {p.created_date ? format(new Date(p.created_date), "dd/MM/yy") : ""}</p>
                  </div>
                  <div className="flex items-center gap-3 ml-3">
                    <Badge variant="outline" className={cn("text-xs", STATUS_MAP[p.status]?.cor)}>
                      {STATUS_MAP[p.status]?.label || p.status}
                    </Badge>
                    <span className="text-sm font-bold text-primary flex-shrink-0">{fmt(p.valor)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="comissoes" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs text-amber-600 font-medium uppercase tracking-wide">A Receber</p>
              <p className="text-2xl font-bold text-amber-700 mt-1">{fmt(comissaoPendente)}</p>
              <p className="text-xs text-amber-600 mt-0.5">{minhasComissoes.filter(c => c.status === "a_receber").length} registros pendentes</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs text-emerald-600 font-medium uppercase tracking-wide">Já Recebido</p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">{fmt(comissaoPaga)}</p>
              <p className="text-xs text-emerald-600 mt-0.5">{minhasComissoes.filter(c => c.status === "pago").length} pagamentos</p>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="divide-y divide-border/50">
              {minhasComissoes.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground text-sm">Nenhuma comissão registrada</div>
              ) : minhasComissoes.slice(0, 20).map(c => (
                <div key={c.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/20 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{c.lead_nome || "—"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{c.plano_nome || "—"} • {c.percentual}%</p>
                  </div>
                  <div className="flex items-center gap-3 ml-3">
                    <Badge variant="outline" className={cn("text-xs", c.status === "pago" ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-amber-50 text-amber-600 border-amber-200")}>
                      {c.status === "pago" ? "Pago" : "Pendente"}
                    </Badge>
                    <span className={cn("text-sm font-bold flex-shrink-0", c.status === "pago" ? "text-emerald-600" : "text-amber-600")}>{fmt(c.valor)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <LancamentoVendaModal
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        vendedorNome={me.full_name}
      />
    </div>
  );
}