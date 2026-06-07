import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { CreditCard, TrendingUp, AlertTriangle, CheckCircle, HelpCircle } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";

const RESULTADO_COLORS = {
  aprovado: "bg-emerald-50 text-emerald-600",
  reprovado: "bg-red-50 text-red-500",
  manual: "bg-amber-50 text-amber-600",
  erro: "bg-gray-50 text-gray-500"
};

export default function Credito() {
  const { data: analises = [], isLoading } = useQuery({
    queryKey: ["analises"],
    queryFn: () => base44.entities.AnaliseCredito.list("-created_date", 200),
  });

  const aprovados = analises.filter(a => a.resultado === "aprovado").length;
  const reprovados = analises.filter(a => a.resultado === "reprovado").length;
  const manuais = analises.filter(a => a.resultado === "manual").length;
  const scoreMedio = analises.filter(a => a.score).length > 0
    ? Math.round(analises.filter(a => a.score).reduce((s, a) => s + a.score, 0) / analises.filter(a => a.score).length)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Análise de Crédito</h1>
        <p className="text-muted-foreground mt-1">Consultas Serasa/Score via Valido Cadastro</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total de Consultas" value={analises.length} icon={CreditCard} />
        <StatCard title="Aprovados" value={aprovados} icon={CheckCircle} trend={`${analises.length > 0 ? Math.round(aprovados / analises.length * 100) : 0}%`} trendUp />
        <StatCard title="Reprovados" value={reprovados} icon={AlertTriangle} />
        <StatCard title="Score Médio" value={scoreMedio} icon={TrendingUp} subtitle="de 0 a 1000" />
      </div>

      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Cliente</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">CPF/CNPJ</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Score</th>
                <th className="text-center py-3 px-4 font-medium text-muted-foreground">Classe</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Inadimplência</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Resultado</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Data</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">Carregando...</td></tr>
              ) : analises.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">Nenhuma análise realizada</td></tr>
              ) : analises.map(a => (
                <tr key={a.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-4 font-medium">{a.lead_nome || "—"}</td>
                  <td className="py-3 px-4 text-muted-foreground font-mono text-xs">{a.cpf_cnpj}</td>
                  <td className="py-3 px-4 text-right">
                    <span className="font-bold text-lg">{a.score || "—"}</span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    {a.classificacao_abc ? (
                      <span className="inline-flex w-8 h-8 rounded-full bg-primary/10 text-primary font-bold items-center justify-center text-sm">
                        {a.classificacao_abc}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {a.probabilidade_inadimplencia != null ? `${a.probabilidade_inadimplencia}%` : "—"}
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant="outline" className={`text-xs ${RESULTADO_COLORS[a.resultado] || ""}`}>
                      {a.resultado === "aprovado" ? "Aprovado" : a.resultado === "reprovado" ? "Reprovado" : a.resultado === "manual" ? "Manual" : a.resultado || "—"}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-xs text-muted-foreground">
                    {a.created_date ? new Date(a.created_date).toLocaleDateString("pt-BR") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}