import { useEffect, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import FunilCard from "@/components/funil/FunilCard";
import FunnelChart from "@/components/dashboard/FunnelChart";
import {
  UserPlus, CreditCard, MapPin, FileText, CheckCircle, Zap, XCircle,
  ShoppingCart, TrendingUp, DollarSign, Activity, RefreshCw
} from "lucide-react";

const STAGES = [
  { key: "novo", label: "Novo", cor: "bg-blue-500", corBg: "bg-blue-500", icon: UserPlus },
  { key: "analise_credito", label: "Análise de Crédito", cor: "bg-amber-500", corBg: "bg-amber-500", icon: CreditCard },
  { key: "viabilidade", label: "Viabilidade", cor: "bg-purple-500", corBg: "bg-purple-500", icon: MapPin },
  { key: "contrato_pendente", label: "Contrato Pendente", cor: "bg-cyan-500", corBg: "bg-cyan-500", icon: FileText },
  { key: "assinado", label: "Assinado", cor: "bg-indigo-500", corBg: "bg-indigo-500", icon: CheckCircle },
  { key: "ativado", label: "Ativado", cor: "bg-emerald-500", corBg: "bg-emerald-500", icon: Zap },
  { key: "recusado", label: "Recusado", cor: "bg-red-400", corBg: "bg-red-400", icon: XCircle },
];

function KpiCard({ title, value, sub, icon: Icon, accent }) {
  return (
    <div className="rounded-2xl bg-card border border-border p-4 sm:p-5">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-3", accent || "bg-primary/10")}>
        <Icon className={cn("w-5 h-5", accent ? "text-white" : "text-primary")} />
      </div>
      <p className="text-2xl sm:text-3xl font-bold tracking-tight tabular-nums">{value}</p>
      <p className="text-sm text-muted-foreground mt-1">{title}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5 opacity-70">{sub}</p>}
    </div>
  );
}

export default function PainelFunil() {
  const queryClient = useQueryClient();
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(new Date());

  const { data: pedidos = [] } = useQuery({
    queryKey: ["pedidos-funil"],
    queryFn: () => base44.entities.Pedido.list("-created_date", 500),
  });

  const { data: leads = [] } = useQuery({
    queryKey: ["leads-funil"],
    queryFn: () => base44.entities.Lead.list("-created_date", 500),
  });

  const atualizar = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["pedidos-funil"] });
    queryClient.invalidateQueries({ queryKey: ["leads-funil"] });
    setUltimaAtualizacao(new Date());
  }, [queryClient]);

  useEffect(() => {
    const unsubPedido = base44.entities.Pedido.subscribe(() => atualizar());
    const unsubLead = base44.entities.Lead.subscribe(() => atualizar());
    const interval = setInterval(atualizar, 30000);
    return () => { unsubPedido(); unsubLead(); clearInterval(interval); };
  }, [atualizar]);

  const totalPedidos = pedidos.length;
  const totalLeads = leads.length;
  const emAndamento = pedidos.filter(p => ["novo", "analise_credito", "viabilidade", "contrato_pendente"].includes(p.status)).length;
  const ativados = pedidos.filter(p => p.status === "ativado").length;
  const valorTotal = pedidos.reduce((s, p) => s + (p.valor || 0), 0);
  const valorAtivado = pedidos.filter(p => p.status === "ativado").reduce((s, p) => s + (p.valor || 0), 0);
  const txConversao = totalPedidos > 0 ? Math.round((ativados / totalPedidos) * 100) : 0;

  const stageData = STAGES.map(s => {
    const items = pedidos.filter(p => p.status === s.key);
    return { ...s, count: items.length, valor: items.reduce((sum, p) => sum + (p.valor || 0), 0) };
  });

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Funil de Vendas</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">Acompanhamento em tempo real da esteira de vendas</p>
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

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard title="Total de Pedidos" value={totalPedidos} sub={`${totalLeads} leads cadastrados`} icon={ShoppingCart} />
        <KpiCard title="Em Andamento" value={emAndamento} sub="aguardando processamento" icon={Activity} accent="bg-amber-500" />
        <KpiCard title="Ativados" value={ativados} sub={`${txConversao}% de conversão`} icon={TrendingUp} accent="bg-emerald-500" />
        <KpiCard title="Receita Total" value={`R$ ${valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} sub={`R$ ${valorAtivado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} ativados`} icon={DollarSign} accent="bg-primary" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
        <div className="lg:col-span-2 rounded-2xl bg-card border border-border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Funil de Conversão</h3>
            <span className="text-xs text-muted-foreground">{totalPedidos} pedidos</span>
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

        <div className="rounded-2xl bg-card border border-border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Distribuição</h3>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </div>
          <FunnelChart pedidos={pedidos} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 justify-center">
        <Link to="/esteira" className="text-xs text-muted-foreground hover:text-primary underline underline-offset-2 transition-colors">
          Ver esteira completa →
        </Link>
        <span className="text-muted-foreground/30">•</span>
        <Link to="/pedidos" className="text-xs text-muted-foreground hover:text-primary underline underline-offset-2 transition-colors">
          Gerenciar pedidos →
        </Link>
      </div>
    </div>
  );
}