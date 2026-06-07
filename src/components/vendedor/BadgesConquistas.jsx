import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Star, Zap, TrendingUp, Target, Award, Crown, Flame, Shield, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, startOfMonth, startOfWeek, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";

const BADGE_DEFINITIONS = [
  {
    id: "primeiro_pedido",
    icon: Star,
    label: "Primeira Venda",
    descricao: "Realizou seu primeiro pedido",
    cor: "text-yellow-500",
    fundo: "bg-yellow-50 border-yellow-200",
    fundoLocked: "bg-muted border-border",
    check: ({ pedidos }) => pedidos.length >= 1,
  },
  {
    id: "cinco_vendas",
    icon: Zap,
    label: "Cinco Estrelas",
    descricao: "5 pedidos realizados",
    cor: "text-blue-500",
    fundo: "bg-blue-50 border-blue-200",
    fundoLocked: "bg-muted border-border",
    check: ({ pedidos }) => pedidos.length >= 5,
  },
  {
    id: "dez_vendas",
    icon: TrendingUp,
    label: "Acelerador",
    descricao: "10 pedidos realizados",
    cor: "text-purple-500",
    fundo: "bg-purple-50 border-purple-200",
    fundoLocked: "bg-muted border-border",
    check: ({ pedidos }) => pedidos.length >= 10,
  },
  {
    id: "meta_mensal",
    icon: Target,
    label: "Campeão do Mês",
    descricao: "Atingiu 100% da meta mensal",
    cor: "text-emerald-500",
    fundo: "bg-emerald-50 border-emerald-200",
    fundoLocked: "bg-muted border-border",
    check: ({ pedidos, metas, vendedorNome }) => {
      const mesAtual = format(new Date(), "yyyy-MM");
      const meta = metas.find(m => m.vendedor_nome === vendedorNome && m.mes === mesAtual);
      if (!meta) return false;
      const realizado = pedidos
        .filter(p => p.created_date?.slice(0, 7) === mesAtual && ["assinado", "ativado"].includes(p.status))
        .reduce((s, p) => s + (p.valor || 0), 0);
      return realizado >= parseFloat(meta.meta_valor);
    },
  },
  {
    id: "recorde_mes",
    icon: Crown,
    label: "Recorde do Mês",
    descricao: "Mês com mais de 5 ativações",
    cor: "text-orange-500",
    fundo: "bg-orange-50 border-orange-200",
    fundoLocked: "bg-muted border-border",
    check: ({ pedidos }) => {
      const mesAtual = format(new Date(), "yyyy-MM");
      const ativados = pedidos.filter(
        p => p.created_date?.slice(0, 7) === mesAtual && p.status === "ativado"
      );
      return ativados.length >= 5;
    },
  },
  {
    id: "semana_produtiva",
    icon: Flame,
    label: "Semana em Chamas",
    descricao: "3 ou mais pedidos em uma semana",
    cor: "text-red-500",
    fundo: "bg-red-50 border-red-200",
    fundoLocked: "bg-muted border-border",
    check: ({ pedidos }) => {
      const inicioSemana = startOfWeek(new Date(), { weekStartsOn: 1 });
      const pedidosSemana = pedidos.filter(
        p => isAfter(new Date(p.created_date), inicioSemana)
      );
      return pedidosSemana.length >= 3;
    },
  },
  {
    id: "sem_recusado",
    icon: Shield,
    label: "Qualidade Total",
    descricao: "10 pedidos sem nenhum recusado",
    cor: "text-teal-500",
    fundo: "bg-teal-50 border-teal-200",
    fundoLocked: "bg-muted border-border",
    check: ({ pedidos }) => {
      if (pedidos.length < 10) return false;
      return !pedidos.some(p => p.status === "recusado");
    },
  },
  {
    id: "top_vendedor",
    icon: Award,
    label: "Top Vendedor",
    descricao: "Mais de R$ 10.000 em vendas no mês",
    cor: "text-indigo-500",
    fundo: "bg-indigo-50 border-indigo-200",
    fundoLocked: "bg-muted border-border",
    check: ({ pedidos }) => {
      const mesAtual = format(new Date(), "yyyy-MM");
      const totalMes = pedidos
        .filter(p => p.created_date?.slice(0, 7) === mesAtual && ["assinado", "ativado"].includes(p.status))
        .reduce((s, p) => s + (p.valor || 0), 0);
      return totalMes >= 10000;
    },
  },
  {
    id: "lenda",
    icon: Rocket,
    label: "Lenda das Vendas",
    descricao: "50 pedidos realizados no total",
    cor: "text-pink-500",
    fundo: "bg-pink-50 border-pink-200",
    fundoLocked: "bg-muted border-border",
    check: ({ pedidos }) => pedidos.length >= 50,
  },
];

function BadgeCard({ badge, conquistado }) {
  const Icon = badge.icon;
  return (
    <div
      className={cn(
        "relative flex flex-col items-center gap-2 p-3 rounded-xl border text-center transition-all",
        conquistado ? badge.fundo : "bg-muted/30 border-border opacity-50 grayscale"
      )}
      title={badge.descricao}
    >
      {conquistado && (
        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
          <Trophy className="w-2.5 h-2.5 text-white" />
        </span>
      )}
      <div className={cn("p-2.5 rounded-xl", conquistado ? "bg-white shadow-sm" : "bg-muted")}>
        <Icon className={cn("w-5 h-5", conquistado ? badge.cor : "text-muted-foreground")} />
      </div>
      <div>
        <p className={cn("text-xs font-semibold leading-tight", conquistado ? "text-foreground" : "text-muted-foreground")}>
          {badge.label}
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{badge.descricao}</p>
      </div>
    </div>
  );
}

export default function BadgesConquistas({ pedidos = [], metas = [], vendedorNome = "" }) {
  const badges = useMemo(() => {
    return BADGE_DEFINITIONS.map(badge => ({
      ...badge,
      conquistado: badge.check({ pedidos, metas, vendedorNome }),
    }));
  }, [pedidos, metas, vendedorNome]);

  const total = badges.filter(b => b.conquistado).length;

  return (
    <Card className="rounded-2xl border border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            Conquistas
          </CardTitle>
          <span className="text-sm font-semibold text-muted-foreground">
            {total}/{badges.length}
          </span>
        </div>
        <div className="w-full bg-muted rounded-full h-1.5 mt-2">
          <div
            className="h-1.5 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 transition-all"
            style={{ width: `${(total / badges.length) * 100}%` }}
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {badges.map(badge => (
            <BadgeCard key={badge.id} badge={badge} conquistado={badge.conquistado} />
          ))}
        </div>
        {total === 0 && (
          <p className="text-xs text-center text-muted-foreground mt-4">
            Comece a vender para desbloquear suas primeiras conquistas!
          </p>
        )}
      </CardContent>
    </Card>
  );
}