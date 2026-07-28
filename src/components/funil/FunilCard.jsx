import { cn } from "@/lib/utils";

export default function FunilCard({ etapa, count, valor, total, prevCount, cor, corBg, icon: Icon }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const convRate = prevCount > 0 ? Math.round((count / prevCount) * 100) : null;
  const largura = total > 0 ? Math.max(6, (count / total) * 100) : 0;

  return (
    <div className="flex items-center gap-3">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", corBg)}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium truncate">{etapa}</span>
          <div className="flex items-center gap-2">
            {convRate !== null && (
              <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                {convRate}% conversão
              </span>
            )}
            <span className="text-base font-bold tabular-nums">{count}</span>
            <span className="text-xs text-muted-foreground">({pct}%)</span>
          </div>
        </div>
        <div className="h-2.5 rounded-full bg-muted overflow-hidden">
          <div className={cn("h-full rounded-full transition-all duration-700", cor)} style={{ width: `${largura}%` }} />
        </div>
        {valor > 0 && (
          <p className="text-xs text-muted-foreground mt-1 tabular-nums">
            R$ {valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        )}
      </div>
    </div>
  );
}