import { cn } from "@/lib/utils";
import { Target, TrendingUp, Flame, CheckCircle2, Clock } from "lucide-react";

const NIVEIS = [
  { min: 100, label: "🏆 Meta Batida!", color: "text-emerald-600", bg: "bg-emerald-500" },
  { min: 75,  label: "🔥 Quase lá!",   color: "text-amber-600",   bg: "bg-amber-500" },
  { min: 50,  label: "⚡ Na metade",    color: "text-blue-600",    bg: "bg-blue-500" },
  { min: 25,  label: "🚀 Arrancando",   color: "text-purple-600",  bg: "bg-purple-500" },
  { min: 0,   label: "🌱 Iniciando",   color: "text-gray-500",    bg: "bg-gray-400" },
];

function getNivel(pct) {
  return NIVEIS.find(n => pct >= n.min) || NIVEIS[NIVEIS.length - 1];
}

export default function MetasProgress({ metas = [], pedidos = [] }) {
  const mesAtual = new Date().toISOString().slice(0, 7);
  const metasMes = metas.filter(m => m.mes === mesAtual);

  if (metasMes.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Target className="w-10 h-10 mx-auto mb-2 opacity-20" />
        <p className="text-sm">Nenhuma meta cadastrada para este mês</p>
        <p className="text-xs mt-1 opacity-70">Cadastre metas em "Metas de Vendas"</p>
      </div>
    );
  }

  // Calcular valor vendido por vendedor no mês
  const vendasMap = {};
  const hoje = new Date();
  const iniciMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

  pedidos.forEach(p => {
    if (!p.vendedor_nome || p.status !== "ativado") return;
    const dataP = new Date(p.created_date);
    if (dataP < iniciMes) return;
    if (!vendasMap[p.vendedor_nome]) vendasMap[p.vendedor_nome] = 0;
    vendasMap[p.vendedor_nome] += p.valor || 0;
  });

  return (
    <div className="space-y-4">
      {metasMes.map((meta, i) => {
        const vendido = vendasMap[meta.vendedor_nome] || 0;
        const pct = meta.meta_valor > 0 ? Math.min(100, Math.round((vendido / meta.meta_valor) * 100)) : 0;
        const nivel = getNivel(pct);
        const faltam = Math.max(0, meta.meta_valor - vendido);

        return (
          <div key={i} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-xs">
                  {meta.vendedor_nome.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold leading-none">{meta.vendedor_nome.split(' ')[0]}</p>
                  <span className={cn("text-[10px] font-semibold", nivel.color)}>{nivel.label}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-black">
                  R$ {vendido.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                  <span className="text-muted-foreground font-normal text-xs"> / R$ {meta.meta_valor.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</span>
                </p>
                <p className="text-[10px] text-muted-foreground">{pct}% atingido</p>
              </div>
            </div>

            {/* Barra de progresso gamificada */}
            <div className="relative h-4 bg-muted rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-1000 relative", nivel.bg)}
                style={{ width: `${pct}%` }}
              >
                {pct > 15 && (
                  <div className="absolute inset-0 bg-white/20 rounded-full animate-pulse" style={{ animationDuration: '2s' }} />
                )}
              </div>
              {/* Marcadores de 25%, 50%, 75% */}
              {[25, 50, 75].map(mark => (
                <div key={mark} className="absolute top-0 bottom-0 w-px bg-white/50" style={{ left: `${mark}%` }} />
              ))}
            </div>

            {faltam > 0 ? (
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" /> Faltam R$ {faltam.toLocaleString('pt-BR', { minimumFractionDigits: 0 })} para bater a meta
              </p>
            ) : (
              <p className="text-[10px] text-emerald-600 flex items-center gap-1 font-semibold">
                <CheckCircle2 className="w-3 h-3" /> Meta atingida! Parabéns! 🎉
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}