import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { cn } from "@/lib/utils";
import { Trophy, TrendingUp, Star, Zap, Crown, Medal, Award } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const MEDALHAS = [
  { bg: "from-amber-400 to-yellow-500", shadow: "shadow-amber-200", text: "text-amber-700", border: "border-amber-300", icon: Crown, label: "1º", ring: "ring-4 ring-amber-300" },
  { bg: "from-slate-300 to-gray-400", shadow: "shadow-slate-200", text: "text-slate-600", border: "border-slate-300", icon: Medal, label: "2º", ring: "ring-4 ring-slate-200" },
  { bg: "from-orange-300 to-amber-600", shadow: "shadow-orange-200", text: "text-orange-700", border: "border-orange-300", icon: Award, label: "3º", ring: "ring-4 ring-orange-200" },
];

const BADGES = [
  { min: 20, label: "🔥 Em Chamas", color: "bg-red-100 text-red-600" },
  { min: 10, label: "⚡ Voando", color: "bg-amber-100 text-amber-600" },
  { min: 5, label: "🚀 Subindo", color: "bg-blue-100 text-blue-600" },
  { min: 1, label: "🌱 Crescendo", color: "bg-emerald-100 text-emerald-600" },
];

function getBadge(ativados) {
  for (const b of BADGES) if (ativados >= b.min) return b;
  return null;
}

export default function RankingGamificado({ pedidos = [], metas = [] }) {
  // Monta ranking
  const rankMap = {};
  pedidos.forEach(p => {
    if (!p.vendedor_nome) return;
    if (!rankMap[p.vendedor_nome]) rankMap[p.vendedor_nome] = { nome: p.vendedor_nome, ativados: 0, valor: 0, total: 0 };
    rankMap[p.vendedor_nome].total++;
    if (p.status === "ativado") {
      rankMap[p.vendedor_nome].ativados++;
      rankMap[p.vendedor_nome].valor += p.valor || 0;
    }
  });

  const ranking = Object.values(rankMap).sort((a, b) => b.ativados - a.ativados).slice(0, 8);
  const maxAtivados = ranking[0]?.ativados || 1;

  // Mês atual para metas
  const mesAtual = new Date().toISOString().slice(0, 7);

  const getMetaVendedor = (nome) => {
    const m = metas.find(m => m.vendedor_nome === nome && m.mes === mesAtual);
    return m?.meta_valor || null;
  };

  if (ranking.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Trophy className="w-12 h-12 mx-auto mb-3 opacity-20" />
        <p className="text-sm">Nenhum dado de vendedor ainda</p>
      </div>
    );
  }

  // Pódio top 3
  const podio = ranking.slice(0, 3);
  const demais = ranking.slice(3);

  return (
    <div className="space-y-6">
      {/* Pódio top 3 */}
      <div className="flex items-end justify-center gap-3 pt-4 pb-2">
        {/* 2º lugar */}
        {podio[1] && (
          <div className="flex flex-col items-center gap-2 flex-1 max-w-[130px]">
            <div className={cn("w-14 h-14 rounded-full bg-gradient-to-br flex items-center justify-center text-white font-black text-lg shadow-lg", MEDALHAS[1].bg, MEDALHAS[1].ring)}>
              {podio[1].nome.charAt(0).toUpperCase()}
            </div>
            <div className="text-center">
              <p className="text-xs font-bold text-foreground truncate w-24 text-center">{podio[1].nome.split(' ')[0]}</p>
              <p className="text-lg font-black text-slate-600">{podio[1].ativados}</p>
              <p className="text-[10px] text-muted-foreground">ativações</p>
            </div>
            <div className="w-full bg-gradient-to-t from-slate-300 to-gray-200 rounded-t-xl h-16 flex items-center justify-center">
              <Medal className="w-5 h-5 text-slate-500" />
            </div>
          </div>
        )}

        {/* 1º lugar */}
        {podio[0] && (
          <div className="flex flex-col items-center gap-2 flex-1 max-w-[150px] -mt-4">
            <div className="relative">
              <div className={cn("w-16 h-16 rounded-full bg-gradient-to-br flex items-center justify-center text-white font-black text-xl shadow-xl", MEDALHAS[0].bg, MEDALHAS[0].ring)}>
                {podio[0].nome.charAt(0).toUpperCase()}
              </div>
              <Crown className="w-5 h-5 text-amber-500 absolute -top-2 -right-1 fill-amber-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-foreground truncate w-28 text-center">{podio[0].nome.split(' ')[0]}</p>
              <p className="text-2xl font-black text-amber-600">{podio[0].ativados}</p>
              <p className="text-[10px] text-muted-foreground">ativações</p>
            </div>
            <div className="w-full bg-gradient-to-t from-amber-400 to-yellow-300 rounded-t-xl h-24 flex items-center justify-center">
              <Crown className="w-6 h-6 text-amber-700 fill-amber-600" />
            </div>
          </div>
        )}

        {/* 3º lugar */}
        {podio[2] && (
          <div className="flex flex-col items-center gap-2 flex-1 max-w-[130px]">
            <div className={cn("w-13 h-13 w-12 h-12 rounded-full bg-gradient-to-br flex items-center justify-center text-white font-black text-base shadow-lg", MEDALHAS[2].bg, MEDALHAS[2].ring)}>
              {podio[2].nome.charAt(0).toUpperCase()}
            </div>
            <div className="text-center">
              <p className="text-xs font-bold text-foreground truncate w-24 text-center">{podio[2].nome.split(' ')[0]}</p>
              <p className="text-lg font-black text-orange-600">{podio[2].ativados}</p>
              <p className="text-[10px] text-muted-foreground">ativações</p>
            </div>
            <div className="w-full bg-gradient-to-t from-orange-400 to-amber-300 rounded-t-xl h-10 flex items-center justify-center">
              <Award className="w-4 h-4 text-orange-700" />
            </div>
          </div>
        )}
      </div>

      {/* Lista completa com progresso de meta */}
      <div className="space-y-2.5">
        {ranking.map((v, i) => {
          const meta = getMetaVendedor(v.nome);
          const pct = meta ? Math.min(100, Math.round((v.ativados / (meta / (pedidos.find(p => p.vendedor_nome === v.nome)?.valor || 80) || 1)) * 100)) : Math.round((v.ativados / maxAtivados) * 100);
          const badge = getBadge(v.ativados);
          const barColor = i === 0 ? "bg-gradient-to-r from-amber-400 to-yellow-500" :
                           i === 1 ? "bg-gradient-to-r from-slate-300 to-gray-400" :
                           i === 2 ? "bg-gradient-to-r from-orange-400 to-amber-500" :
                           "bg-gradient-to-r from-primary to-primary/70";

          return (
            <div key={v.nome} className={cn(
              "flex items-center gap-3 p-3 rounded-xl border transition-all hover:shadow-sm",
              i === 0 ? "bg-amber-50 border-amber-200" :
              i === 1 ? "bg-slate-50 border-slate-200" :
              i === 2 ? "bg-orange-50 border-orange-200" :
              "bg-muted/30 border-border"
            )}>
              {/* Posição */}
              <div className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0",
                i === 0 ? "bg-gradient-to-br from-amber-400 to-yellow-500 text-white shadow" :
                i === 1 ? "bg-gradient-to-br from-slate-300 to-gray-400 text-white shadow" :
                i === 2 ? "bg-gradient-to-br from-orange-400 to-amber-500 text-white shadow" :
                "bg-muted text-muted-foreground"
              )}>{i + 1}</div>

              {/* Nome + barra */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-semibold truncate">{v.nome}</p>
                  {badge && <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0", badge.color)}>{badge.label}</span>}
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className={cn("h-full rounded-full transition-all duration-700", barColor)} style={{ width: `${pct}%` }} />
                </div>
                {meta && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Meta: R$ {meta.toLocaleString('pt-BR')} — {Math.round((v.valor / meta) * 100)}% atingida
                  </p>
                )}
              </div>

              {/* Contadores */}
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-black">{v.ativados}</p>
                <p className="text-[10px] text-muted-foreground">ativ.</p>
              </div>
            </div>
          );
        })}
      </div>

      {demais.length === 0 && ranking.length < 3 && (
        <p className="text-xs text-center text-muted-foreground pt-2">Continue vendendo para aparecer no ranking! 🚀</p>
      )}
    </div>
  );
}