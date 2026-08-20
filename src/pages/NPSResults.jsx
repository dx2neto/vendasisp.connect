import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, TrendingUp, TrendingDown, Minus, Users, Smile, Frown, Meh } from "lucide-react";
import { cn } from "@/lib/utils";

const CLASSIFICACAO_COR = {
  promotor: { label: "Promotor", cor: "bg-emerald-50 text-emerald-600 border-emerald-200", icon: Smile },
  neutro: { label: "Neutro", cor: "bg-amber-50 text-amber-600 border-amber-200", icon: Meh },
  detrator: { label: "Detrator", cor: "bg-red-50 text-red-600 border-red-200", icon: Frown },
};

function KpiCard({ icon: Icon, label, value, sub, accent }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-3", accent || "bg-primary/10")}>
        <Icon className={cn("w-5 h-5", accent ? "text-white" : "text-primary")} />
      </div>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5 opacity-70">{sub}</p>}
    </div>
  );
}

export default function NPSResults() {
  const { data: npsList = [], isLoading } = useQuery({
    queryKey: ["nps-results"],
    queryFn: () => base44.entities.NPS.list("-data_coleta", 200),
  });

  const respondidos = npsList.filter(n => n.nota > 0);
  const pendentes = npsList.filter(n => n.nota === 0);

  const promotores = respondidos.filter(n => n.classificacao === "promotor").length;
  const neutros = respondidos.filter(n => n.classificacao === "neutro").length;
  const detratores = respondidos.filter(n => n.classificacao === "detrator").length;
  const totalRespondidos = respondidos.length;

  const npsScore = totalRespondidos > 0
    ? Math.round(((promotores - detratores) / totalRespondidos) * 100)
    : 0;

  const notaMedia = totalRespondidos > 0
    ? (respondidos.reduce((s, n) => s + n.nota, 0) / totalRespondidos).toFixed(1)
    : "—";

  const npsColor = npsScore >= 50 ? "text-emerald-600" : npsScore >= 0 ? "text-amber-600" : "text-red-600";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">NPS — Satisfação do Cliente</h1>
        <p className="text-muted-foreground mt-0.5 text-sm">Resultados da pesquisa pós-venda</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-primary/10">
            <Star className="w-5 h-5 text-primary" />
          </div>
          <p className={cn("text-3xl font-bold tabular-nums", npsColor)}>{npsScore > 0 ? "+" : ""}{npsScore}</p>
          <p className="text-sm text-muted-foreground mt-0.5">NPS Score</p>
          <p className="text-xs text-muted-foreground mt-0.5 opacity-70">{totalRespondidos} respostas</p>
        </div>
        <KpiCard icon={Users} label="Nota Média" value={notaMedia} sub="de 0 a 10" accent="bg-primary" />
        <KpiCard icon={Smile} label="Promotores" value={promotores} sub={`${totalRespondidos > 0 ? Math.round((promotores / totalRespondidos) * 100) : 0}%`} accent="bg-emerald-500" />
        <KpiCard icon={Frown} label="Detratores" value={detratores} sub={`${totalRespondidos > 0 ? Math.round((detratores / totalRespondidos) * 100) : 0}%`} accent="bg-red-500" />
      </div>

      {/* Distribuição visual */}
      {totalRespondidos > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Distribuição de Notas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1 h-32 mb-3">
              {Array.from({ length: 11 }, (_, i) => {
                const count = respondidos.filter(n => n.nota === i).length;
                const altura = totalRespondidos > 0 ? (count / totalRespondidos) * 100 : 0;
                const cor = i <= 6 ? "bg-red-400" : i <= 8 ? "bg-amber-400" : "bg-emerald-500";
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                    <span className="text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity">{count}</span>
                    <div className="w-full flex-1 flex items-end">
                      <div className={cn("w-full rounded-t transition-all duration-500", cor)} style={{ height: `${Math.max(altura, 2)}%`, minHeight: count > 0 ? "8px" : "2px" }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{i}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-400" /> Detratores (0-6)</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Neutros (7-8)</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Promotores (9-10)</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Respostas recentes */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Respostas Recentes</CardTitle>
            {pendentes.length > 0 && <Badge variant="secondary">{pendentes.length} pendentes</Badge>}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-10 text-center">
              <div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" />
            </div>
          ) : respondidos.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Star className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhuma resposta recebida ainda.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50 max-h-96 overflow-y-auto">
              {respondidos.slice(0, 50).map((n) => {
                const cls = CLASSIFICACAO_COR[n.classificacao] || CLASSIFICACAO_COR.neutro;
                const Icon = cls.icon;
                return (
                  <div key={n.id} className="flex items-start justify-between px-5 py-3.5">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{n.cliente_nome || "Cliente"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {n.plano_nome || ""} • {n.vendedor_nome || ""}
                      </p>
                      {n.comentario && (
                        <p className="text-xs text-muted-foreground mt-1 italic">"{n.comentario}"</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                      <span className="text-lg font-bold tabular-nums">{n.nota}</span>
                      <Badge variant="outline" className={cn("text-xs", cls.cor)}>
                        <Icon className="w-3 h-3 mr-1" /> {cls.label}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}