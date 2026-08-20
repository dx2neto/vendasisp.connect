import { useEffect, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { usePermissions } from "@/lib/usePermissions";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import FunilCard from "@/components/funil/FunilCard";
import {
  UserPlus, CreditCard, MapPin, FileText, CheckCircle2, Zap, XCircle,
  ShoppingCart, TrendingUp, DollarSign, Activity, RefreshCw, Trophy, Target
} from "lucide-react";

const STAGES = [
  { key: "novo", label: "Novo", cor: "bg-blue-500", corBg: "bg-blue-500", icon: UserPlus },
  { key: "analise_credito", label: "Análise de Crédito", cor: "bg-amber-500", corBg: "bg-amber-500", icon: CreditCard },
  { key: "viabilidade", label: "Viabilidade", cor: "bg-purple-500", corBg: "bg-purple-500", icon: MapPin },
  { key: "contrato_pendente", label: "Contrato Pendente", cor: "bg-cyan-500", corBg: "bg-cyan-500", icon: FileText },
  { key: "assinado", label: "Assinado", cor: "bg-indigo-500", corBg: "bg-indigo-500", icon: CheckCircle2 },
  { key: "ativado", label: "Ativado", cor: "bg-emerald-500", corBg: "bg-emerald-500", icon: Zap },
  { key: "recusado", label: "Recusado", cor: "bg-red-400", corBg: "bg-red-400", icon: XCircle },
];

const fmt = (v) => `R$ ${(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

function KpiCard({ title, value, sub, icon: Icon, accent, destaque }) {
  return (
    <div className={cn(
      "rounded-2xl border p-4 sm:p-5 flex flex-col gap-2 transition-all hover:shadow-md",
      destaque ? "bg-primary border-primary/20 text-primary-foreground" : "bg-card border-border"
    )}>
      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", accent || (destaque ? "bg-white/20" : "bg-primary/10"))}>
        <Icon className={cn("w-4.5 h-4.5", destaque ? "text-white" : "text-primary")} />
      </div>
      <div>
        <p className={cn("text-xl sm:text-2xl font-bold tabular-nums", destaque && "text-white")}>{value}</p>
        <p className={cn("text-sm mt-0.5", destaque ? "text-white/70" : "text-muted-foreground")}>{title}</p>
        {sub && <p className={cn("text-xs mt-0.5", destaque ? "text-white/50" : "text-muted-foreground opacity-70")}>{sub}</p>}
      </div>
    </div>
  );
}

export default function FunilVendedor() {
  const queryClient = useQueryClient();
  const { user, filtrarPedidos } = usePermissions();
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(new Date());

  const { data: pedidos = [] } = useQuery({
    queryKey: ["pedidos-funil-vendedor"],
    queryFn: () => base44.entities.Pedido.list("-created_date", 500),
    enabled: !!user,
  });

  const { data: comissoes = [] } = useQuery({
    queryKey: ["comissoes-funil-vendedor"],
    queryFn: () => base44.entities.Comissao.list("-created_date", 500),
    enabled: !!user,
  });

  const { data: config = [] } = useQuery({
    queryKey: ["config-regras-funil"],
    queryFn: () => base44.entities.ConfigRegras.list().catch(() => []),
    enabled: !!user,
  });

  const atualizar = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["pedidos-funil-vendedor"] });
    queryClient.invalidateQueries({ queryKey: ["comissoes-funil-vendedor"] });
    setUltimaAtualizacao(new Date());
  }, [queryClient]);

  useEffect(() => {
    const unsubPedido = base44.entities.Pedido.subscribe(() => atualizar());
    const unsubComissao = base44.entities.Comissao.subscribe(() => atualizar());
    const interval = setInterval(atualizar, 30000);
    return () => { unsubPedido(); unsubComissao(); clearInterval(interval); };
  }, [atualizar]);

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const meusPedidos = filtrarPedidos(pedidos);
  const minhasComissoes = comissoes.filter(c => c.vendedor_id === user.id || c.vendedor_nome === user.full_name);
  const pctComissao = (config[0]?.comissao_percentual_padrao || 5) / 100;

  const totalPedidos = meusPedidos.length;
  const emAndamento = meusPedidos.filter(p => ["novo", "analise_credito", "viabilidade", "contrato_pendente"].includes(p.status)).length;
  const ativados = meusPedidos.filter(p => p.status === "ativado").length;
  const recusados = meusPedidos.filter(p => p.status === "recusado").length;
  const valorTotal = meusPedidos.reduce((s, p) => s + (p.valor || 0), 0);
  const valorAtivado = meusPedidos.filter(p => p.status === "ativado").reduce((s, p) => s + (p.valor || 0), 0);
  const txConversao = totalPedidos > 0 ? Math.round((ativados / totalPedidos) * 100) : 0;

  // Comissão prevista: pedidos em andamento (excluindo recusados) × percentual
  const pedidosAtivos = meusPedidos.filter(p => p.status !== "recusado");
  const comissaoPrevista = pedidosAtivos.reduce((s, p) => s + (p.valor || 0), 0) * pctComissao;
  const comissaoRealizada = minhasComissoes.filter(c => c.status === "pago").reduce((s, c) => s + (c.valor || 0), 0);
  const comissaoPendente = minhasComissoes.filter(c => c.status === "a_receber").reduce((s, c) => s + (c.valor || 0), 0);

  const stageData = STAGES.map(s => {
    const items = meusPedidos.filter(p => p.status === s.key);
    const valor = items.reduce((sum, p) => sum + (p.valor || 0), 0);
    const comissao = valor * pctComissao;
    return { ...s, count: items.length, valor, comissao };
  });

  const maxValue = Math.max(...stageData.map(s => s.count), 1);

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Meu Funil de Vendas</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">Acompanhamento em tempo real do seu funil e comissões previstas</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="gap-1.5 text-xs py-1 px-3 rounded-full border-primary/30 text-primary bg-primary/5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse inline-block" />
            Ao vivo
          </Badge>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <RefreshCw className="w-3 h-3" />
            {ultimaAtualizacao.toLocaleTimeString("pt-BR")}
          </span>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard title="Total de Pedidos" value={totalPedidos} sub={`${emAndamento} em andamento`} icon={ShoppingCart} />
        <KpiCard title="Ativados" value={ativados} sub={`${txConversao}% de conversão`} icon={TrendingUp} accent="bg-emerald-500" />
        <KpiCard
          title="Comissão Prevista"
          value={fmt(comissaoPrevista)}
          sub={`${pctComissao * 100}% sobre ${fmt(pedidosAtivos.reduce((s, p) => s + (p.valor || 0), 0))}`}
          icon={DollarSign}
          accent="bg-amber-500"
          destaque
        />
        <KpiCard
          title="Comissão a Receber"
          value={fmt(comissaoPendente)}
          sub={`${fmt(comissaoRealizada)} já pago`}
          icon={Trophy}
          accent="bg-primary"
        />
      </div>

      {/* Funil + Comissão por etapa */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
        {/* Funil de conversão */}
        <div className="lg:col-span-2 rounded-2xl bg-card border border-border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Funil de Conversão</h3>
            <span className="text-xs text-muted-foreground">{totalPedidos} pedidos • {recusados} recusados</span>
          </div>
          <div className="space-y-4">
            {stageData.map((s, i) => (
              <FunilCard
                key={s.key}
                etapa={s.label}
                count={s.count}
                valor={s.valor}
                total={totalPedidos}
                prevCount={i > 0 ? stageData[i - 1].count : 0}
                cor={s.cor}
                corBg={s.corBg}
                icon={s.icon}
              />
            ))}
          </div>
        </div>

        {/* Comissão prevista por etapa */}
        <div className="rounded-2xl bg-card border border-border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Comissão por Etapa</h3>
            <Target className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="space-y-3">
            {stageData.filter(s => s.key !== "recusado").map((s) => {
              const largura = maxValue > 0 ? Math.max(8, (s.count / maxValue) * 100) : 0;
              return (
                <div key={s.key} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className={cn("w-2.5 h-2.5 rounded-full", s.cor)} />
                      {s.label}
                    </span>
                    <span className="font-bold tabular-nums text-primary">{fmt(s.comissao)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all duration-700", s.cor)} style={{ width: `${largura}%` }} />
                  </div>
                  <p className="text-[11px] text-muted-foreground">{s.count} pedidos • {fmt(s.valor)} em vendas</p>
                </div>
              );
            })}
          </div>
          <div className="pt-3 border-t border-border space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5" /> Previsto total
              </span>
              <span className="font-bold text-primary">{fmt(comissaoPrevista)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" /> A receber
              </span>
              <span className="font-bold text-amber-600">{fmt(comissaoPendente)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Já pago
              </span>
              <span className="font-bold text-emerald-600">{fmt(comissaoRealizada)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bar chart de valor por etapa */}
      <div className="rounded-2xl bg-card border border-border p-5">
        <h3 className="font-semibold mb-4">Valor em Vendas por Etapa</h3>
        <div className="flex items-end gap-2 sm:gap-3 h-40">
          {stageData.map((s) => {
            const maxValor = Math.max(...stageData.map(x => x.valor), 1);
            const altura = maxValor > 0 ? Math.max(4, (s.valor / maxValor) * 100) : 0;
            return (
              <div key={s.key} className="flex-1 flex flex-col items-center gap-1.5 group">
                <span className="text-[10px] font-medium text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                  {fmt(s.valor)}
                </span>
                <div className="w-full flex-1 flex items-end">
                  <div
                    className={cn("w-full rounded-t-lg transition-all duration-700", s.cor)}
                    style={{ height: `${altura}%`, minHeight: s.valor > 0 ? "8px" : "2px" }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground text-center leading-tight">{s.label}</span>
                <span className="text-xs font-bold tabular-nums">{s.count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Links */}
      <div className="flex flex-wrap gap-2 justify-center">
        <Link to="/vendedor" className="text-xs text-muted-foreground hover:text-primary underline underline-offset-2 transition-colors">
          Meu painel →
        </Link>
        <span className="text-muted-foreground/30">•</span>
        <Link to="/esteira" className="text-xs text-muted-foreground hover:text-primary underline underline-offset-2 transition-colors">
          Ver esteira completa →
        </Link>
        <span className="text-muted-foreground/30">•</span>
        <Link to="/comissoes" className="text-xs text-muted-foreground hover:text-primary underline underline-offset-2 transition-colors">
          Detalhar comissões →
        </Link>
      </div>
    </div>
  );
}