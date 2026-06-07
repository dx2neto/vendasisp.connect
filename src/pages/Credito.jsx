import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CreditCard, TrendingUp, AlertTriangle, CheckCircle, Search, Loader2 } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import { useState } from "react";
import { toast } from "sonner";

const RESULTADO_COLORS = {
  aprovado: "bg-emerald-50 text-emerald-600",
  reprovado: "bg-red-50 text-red-500",
  manual: "bg-amber-50 text-amber-600",
  erro: "bg-gray-50 text-gray-500"
};

export default function Credito() {
  const [cpf, setCpf] = useState("");
  const queryClient = useQueryClient();

  const { data: analises = [], isLoading } = useQuery({
    queryKey: ["analises"],
    queryFn: () => base44.entities.AnaliseCredito.list("-created_date", 200),
  });

  const consultarMutation = useMutation({
    mutationFn: async (cpfValue) => {
      const res = await base44.functions.invoke("consultarCredito", { cpf: cpfValue });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["analises"] });
      setCpf("");
      toast.success("Crédito consultado e lead gerado!");
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao consultar crédito");
    }
  });

  const aprovados = analises.filter(a => a.resultado === "aprovado").length;
  const reprovados = analises.filter(a => a.resultado === "reprovado").length;
  const manuais = analises.filter(a => a.resultado === "manual").length;
  const scoreMedio = analises.filter(a => a.score).length > 0
    ? Math.round(analises.filter(a => a.score).reduce((s, a) => s + a.score, 0) / analises.filter(a => a.score).length)
    : 0;

  return (
    <div className="space-y-4 sm:space-y-6 pb-20 sm:pb-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Análise de Crédito</h1>
        <p className="text-muted-foreground mt-1 text-xs sm:text-sm">Consultas Serasa/Score via Valido Cadastro</p>
      </div>

      {/* Formulário de Consulta */}
      <div className="rounded-xl sm:rounded-2xl bg-card border border-border p-4 sm:p-6 space-y-4">
        <div>
          <label className="text-xs sm:text-sm font-semibold text-muted-foreground">CPF ou CNPJ</label>
          <div className="flex gap-2 mt-2">
            <Input
              placeholder="Digitar CPF/CNPJ..."
              value={cpf}
              onChange={(e) => setCpf(e.target.value.replace(/\D/g, ""))}
              onKeyPress={(e) => {
                if (e.key === "Enter" && cpf.length >= 11) {
                  consultarMutation.mutate(cpf);
                }
              }}
              maxLength="14"
              className="rounded-lg text-sm"
            />
            <Button
              onClick={() => consultarMutation.mutate(cpf)}
              disabled={cpf.length < 11 || consultarMutation.isPending}
              className="gap-2 rounded-lg"
            >
              {consultarMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">Consultar</span>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Puxa dados do cliente e gera lead automaticamente</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <StatCard title="Total de Consultas" value={analises.length} icon={CreditCard} />
        <StatCard title="Aprovados" value={aprovados} icon={CheckCircle} trend={`${analises.length > 0 ? Math.round(aprovados / analises.length * 100) : 0}%`} trendUp />
        <StatCard title="Reprovados" value={reprovados} icon={AlertTriangle} />
        <StatCard title="Score Médio" value={scoreMedio} icon={TrendingUp} subtitle="de 0 a 1000" />
      </div>

      <div className="rounded-xl sm:rounded-2xl bg-card border border-border overflow-hidden">
        <div className="hidden sm:block overflow-x-auto">
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

        {/* Mobile Cards */}
        <div className="sm:hidden space-y-2 p-4">
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground text-sm">Carregando...</div>
          ) : analises.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">Nenhuma análise realizada</div>
          ) : analises.map(a => (
            <div key={a.id} className="bg-muted/30 rounded-lg p-3 text-xs space-y-2">
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{a.lead_nome || "—"}</p>
                  <p className="text-muted-foreground font-mono">{a.cpf_cnpj}</p>
                </div>
                <Badge variant="outline" className={`text-xs flex-shrink-0 ${RESULTADO_COLORS[a.resultado] || ""}`}>
                  {a.resultado === "aprovado" ? "Aprovado" : a.resultado === "reprovado" ? "Reprovado" : a.resultado === "manual" ? "Manual" : a.resultado || "—"}
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Score</p>
                  <p className="font-semibold">{a.score || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Classe</p>
                  <p className="font-semibold">{a.classificacao_abc || "—"}</p>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground">Inadimpl.</p>
                  <p className="font-semibold">{a.probabilidade_inadimplencia != null ? `${a.probabilidade_inadimplencia}%` : "—"}</p>
                </div>
              </div>
              {a.created_date && (
                <p className="text-muted-foreground pt-1 border-t border-border">{new Date(a.created_date).toLocaleDateString("pt-BR")}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}