import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import {
  DollarSign, CheckCircle2, Clock, TrendingUp, Trophy, AlertCircle,
  ChevronDown, ChevronUp, Percent, Filter
} from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";

const fmt = (v) => `R$ ${(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

// Qual status do pedido libera comissão
const STATUS_COMISSAO = {
  novo:              { label: "Novo",        fase: "pipeline",  cor: "bg-blue-50 text-blue-600 border-blue-200" },
  analise_credito:   { label: "Crédito",     fase: "pipeline",  cor: "bg-amber-50 text-amber-600 border-amber-200" },
  viabilidade:       { label: "Viabilidade", fase: "pipeline",  cor: "bg-purple-50 text-purple-600 border-purple-200" },
  contrato_pendente: { label: "Contrato",    fase: "pipeline",  cor: "bg-cyan-50 text-cyan-600 border-cyan-200" },
  assinado:          { label: "Assinado",    fase: "quase",     cor: "bg-teal-50 text-teal-600 border-teal-200" },
  ativado:           { label: "Ativado",     fase: "liberado",  cor: "bg-emerald-50 text-emerald-600 border-emerald-200" },
  recusado:          { label: "Recusado",    fase: "perdido",   cor: "bg-red-50 text-red-500 border-red-200" },
};

function SummaryCard({ icon: Icon, label, value, sub, colorClass, bgClass, borderClass }) {
  return (
    <div className={cn("rounded-2xl border p-5 flex flex-col gap-2", bgClass, borderClass)}>
      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", colorClass, "bg-white/60")}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className={cn("text-xl font-bold", colorClass)}>{value}</p>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {sub && <p className={cn("text-xs mt-0.5", colorClass, "opacity-70")}>{sub}</p>}
      </div>
    </div>
  );
}

function MetaRow({ meta, realizado }) {
  const pct = meta.meta_valor > 0 ? Math.min(Math.round((realizado / meta.meta_valor) * 100), 100) : 0;
  const atingida = pct >= 100;
  const quase = pct >= 60;

  return (
    <div className="py-3 px-4">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{meta.mes}</span>
          {atingida && <Trophy className="w-3.5 h-3.5 text-amber-500" />}
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-muted-foreground">{fmt(realizado)} / {fmt(meta.meta_valor)}</span>
          <span className={cn("font-bold", atingida ? "text-emerald-600" : quase ? "text-amber-600" : "text-muted-foreground")}>
            {pct}%
          </span>
        </div>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", atingida ? "bg-emerald-500" : quase ? "bg-amber-500" : "bg-primary")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function PainelComissoes({ comissoes = [], pedidos = [], metas = [], me }) {
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [expandido, setExpandido] = useState(null);

  // ── Totais por status de comissão ──────────────────────────────────────
  const totalAcumulado   = comissoes.reduce((s, c) => s + (c.valor || 0), 0);
  const totalPago        = comissoes.filter(c => c.status === "pago").reduce((s, c) => s + (c.valor || 0), 0);
  const totalPendente    = comissoes.filter(c => c.status === "a_receber").reduce((s, c) => s + (c.valor || 0), 0);
  const qtdPendente      = comissoes.filter(c => c.status === "a_receber").length;

  // ── Comissão potencial: pedidos em andamento × percentual padrão (5%) ──
  const percentualPadrao = 0.05;
  const comissaoPotencial = pedidos
    .filter(p => !["ativado", "recusado"].includes(p.status))
    .reduce((s, p) => s + (p.valor || 0) * percentualPadrao, 0);

  // ── Gráfico mensal de comissões (6 meses) ─────────────────────────────
  const graficoMensal = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const ref = subMonths(new Date(), 5 - i);
    const ini = startOfMonth(ref), fim = endOfMonth(ref);
    const pago = comissoes
      .filter(c => c.status === "pago" && c.created_date && isWithinInterval(new Date(c.created_date), { start: ini, end: fim }))
      .reduce((s, c) => s + (c.valor || 0), 0);
    const pendente = comissoes
      .filter(c => c.status === "a_receber" && c.created_date && isWithinInterval(new Date(c.created_date), { start: ini, end: fim }))
      .reduce((s, c) => s + (c.valor || 0), 0);
    return { mes: format(ref, "MMM", { locale: ptBR }), pago, pendente };
  }), [comissoes]);

  // ── Metas com realizado por mês ────────────────────────────────────────
  const metasComRealizado = useMemo(() => metas
    .sort((a, b) => b.mes.localeCompare(a.mes))
    .slice(0, 6)
    .map(meta => {
      const [ano, mes] = meta.mes.split("-").map(Number);
      const ini = startOfMonth(new Date(ano, mes - 1));
      const fim = endOfMonth(new Date(ano, mes - 1));
      const realizado = pedidos
        .filter(p => p.status === "ativado" && p.data_ativacao && isWithinInterval(new Date(p.data_ativacao), { start: ini, end: fim }))
        .reduce((s, p) => s + (p.valor || 0), 0);
      return { ...meta, realizado };
    }), [metas, pedidos]);

  // ── Lista filtrada de comissões ────────────────────────────────────────
  const listaFiltrada = filtroStatus === "todos"
    ? comissoes
    : comissoes.filter(c => c.status === filtroStatus);

  // ── Agrupamento por pedido (para comissão relacionada) ─────────────────
  const pedidosComComissao = useMemo(() => {
    const map = {};
    comissoes.forEach(c => { if (c.pedido_id) map[c.pedido_id] = c; });
    return map;
  }, [comissoes]);

  // ── Pedidos em andamento com comissão potencial ────────────────────────
  const pedidosAndamento = pedidos.filter(p => !["ativado", "recusado"].includes(p.status));

  return (
    <div className="space-y-6">

      {/* ── 4 cards de resumo ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={TrendingUp}
          label="Total Acumulado"
          value={fmt(totalAcumulado)}
          sub={`${comissoes.length} registros`}
          colorClass="text-primary"
          bgClass="bg-primary/5"
          borderClass="border-primary/20"
        />
        <SummaryCard
          icon={CheckCircle2}
          label="Já Recebido"
          value={fmt(totalPago)}
          sub={`${comissoes.filter(c => c.status === "pago").length} pagamentos`}
          colorClass="text-emerald-600"
          bgClass="bg-emerald-50"
          borderClass="border-emerald-200"
        />
        <SummaryCard
          icon={Clock}
          label="Pendente de Pagamento"
          value={fmt(totalPendente)}
          sub={`${qtdPendente} em aberto`}
          colorClass="text-amber-600"
          bgClass="bg-amber-50"
          borderClass="border-amber-200"
        />
        <SummaryCard
          icon={DollarSign}
          label="Comissão Potencial"
          value={fmt(comissaoPotencial)}
          sub={`${pedidosAndamento.length} pedidos em andamento`}
          colorClass="text-purple-600"
          bgClass="bg-purple-50"
          borderClass="border-purple-200"
        />
      </div>

      {/* ── Gráfico + Metas ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Gráfico mensal */}
        <div className="rounded-2xl border border-border bg-card p-6">
          <h3 className="font-semibold text-sm mb-4">Comissões por Mês</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={graficoMensal} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} width={48} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }}
                formatter={(v, n) => [fmt(v), n === "pago" ? "Recebido" : "Pendente"]}
              />
              <Bar dataKey="pago" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="pendente" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-emerald-500" />Recebido</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-amber-500" />Pendente</span>
          </div>
        </div>

        {/* Histórico de metas */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-sm">Histórico de Metas</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Baseado em ativações do mês</p>
          </div>
          {metasComRealizado.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm">
              <Trophy className="w-8 h-8 mx-auto mb-2 opacity-20" />
              Nenhuma meta cadastrada
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {metasComRealizado.map(m => (
                <MetaRow key={m.id || m.mes} meta={m} realizado={m.realizado} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Pedidos com comissão potencial ── */}
      {pedidosAndamento.length > 0 && (
        <div className="rounded-2xl border border-purple-200 bg-purple-50/50 overflow-hidden">
          <div className="px-5 py-3 border-b border-purple-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-purple-600" />
              <h3 className="font-semibold text-sm text-purple-700">Comissão Potencial — Pedidos em Andamento</h3>
            </div>
            <span className="text-xs font-bold text-purple-700 bg-purple-100 px-2.5 py-1 rounded-full">{fmt(comissaoPotencial)}</span>
          </div>
          <div className="divide-y divide-purple-100">
            {pedidosAndamento.slice(0, 8).map(p => {
              const comPotencial = (p.valor || 0) * percentualPadrao;
              const statusInfo = STATUS_COMISSAO[p.status];
              return (
                <div key={p.id} className="flex items-center justify-between px-5 py-3 hover:bg-purple-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{p.lead_nome}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{p.plano_nome || "—"}</p>
                  </div>
                  <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                    <Badge variant="outline" className={cn("text-xs", statusInfo?.cor)}>
                      {statusInfo?.label || p.status}
                    </Badge>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Potencial</p>
                      <p className="text-sm font-bold text-purple-700">{fmt(comPotencial)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Lista detalhada de comissões ── */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-semibold text-sm">Extrato de Comissões</h3>
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <select
              className="text-xs border border-border rounded-lg px-2.5 py-1.5 bg-transparent"
              value={filtroStatus}
              onChange={e => setFiltroStatus(e.target.value)}
            >
              <option value="todos">Todos ({comissoes.length})</option>
              <option value="a_receber">Pendentes ({comissoes.filter(c => c.status === "a_receber").length})</option>
              <option value="pago">Pagos ({comissoes.filter(c => c.status === "pago").length})</option>
            </select>
          </div>
        </div>

        {listaFiltrada.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">
            <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-20" />
            Nenhuma comissão neste filtro
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {listaFiltrada.map(c => {
              const isPago = c.status === "pago";
              const isOpen = expandido === c.id;
              return (
                <div key={c.id}>
                  <button
                    className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/20 transition-colors text-left"
                    onClick={() => setExpandido(isOpen ? null : c.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{c.lead_nome || "—"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {c.plano_nome || "—"}
                        {c.created_date && ` • ${format(new Date(c.created_date), "dd/MM/yyyy")}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                      <Badge
                        variant="outline"
                        className={cn("text-xs", isPago
                          ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                          : "bg-amber-50 text-amber-600 border-amber-200"
                        )}
                      >
                        {isPago ? "Pago" : "Pendente"}
                      </Badge>
                      <span className={cn("text-sm font-bold", isPago ? "text-emerald-600" : "text-amber-600")}>
                        {fmt(c.valor)}
                      </span>
                      {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                    </div>
                  </button>

                  {/* Detalhe expandido */}
                  {isOpen && (
                    <div className="px-5 pb-4 bg-muted/20 border-t border-border/50">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
                        <div className="rounded-xl bg-card border border-border p-3">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Percentual</p>
                          <div className="flex items-center gap-1">
                            <Percent className="w-3.5 h-3.5 text-primary" />
                            <p className="font-bold text-sm">{c.percentual || "—"}%</p>
                          </div>
                        </div>
                        <div className="rounded-xl bg-card border border-border p-3">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Tipo</p>
                          <p className="font-bold text-sm capitalize">{c.tipo || "vendedor"}</p>
                        </div>
                        <div className="rounded-xl bg-card border border-border p-3">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Status</p>
                          <Badge variant="outline" className={cn("text-xs", isPago
                            ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                            : "bg-amber-50 text-amber-600 border-amber-200"
                          )}>
                            {isPago ? "✓ Pago" : "⏳ A receber"}
                          </Badge>
                        </div>
                        <div className="rounded-xl bg-card border border-border p-3">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Valor</p>
                          <p className={cn("font-bold text-sm", isPago ? "text-emerald-600" : "text-amber-600")}>
                            {fmt(c.valor)}
                          </p>
                        </div>
                      </div>
                      {c.pedido_id && (
                        <p className="text-[10px] text-muted-foreground mt-2">Pedido ID: {c.pedido_id}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Rodapé com totais */}
        <div className="px-5 py-3 border-t border-border bg-muted/20 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">{listaFiltrada.length} registros</span>
          <div className="flex items-center gap-4">
            <span className="text-emerald-600 font-semibold">
              Recebido: {fmt(listaFiltrada.filter(c => c.status === "pago").reduce((s, c) => s + (c.valor || 0), 0))}
            </span>
            <span className="text-amber-600 font-semibold">
              Pendente: {fmt(listaFiltrada.filter(c => c.status === "a_receber").reduce((s, c) => s + (c.valor || 0), 0))}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}