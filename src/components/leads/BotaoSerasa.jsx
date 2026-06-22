import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Loader2, AlertTriangle, Download, FileSearch } from "lucide-react";

export default function BotaoSerasa({ lead }) {
  const [resultado, setResultado] = useState(null);
  const [open, setOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke("gerarRelatorioSerasa", {
        lead_id: lead.id,
      });
      return res.data;
    },
    onSuccess: (data) => {
      setResultado(data);
      setOpen(true);
    },
  });

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="gap-2 rounded-xl text-purple-600 border-purple-200 hover:bg-purple-50"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? (
          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Consultando...</>
        ) : (
          <><FileSearch className="w-3.5 h-3.5" /> Relatório Serasa</>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Relatório de Crédito — {lead.nome}
            </DialogTitle>
          </DialogHeader>

          {resultado && (
            <div className="space-y-4">
              {/* Alerta de risco */}
              {resultado.risco_alto && (
                <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
                  <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-red-700 text-sm">⚠ Risco Elevado Detectado</p>
                    <p className="text-xs text-red-600 mt-1">
                      Score abaixo do mínimo ou probabilidade de inadimplência acima do tolerado.
                      Recomenda-se análise manual antes da aprovação.
                    </p>
                  </div>
                </div>
              )}

              {/* Resultado */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Resultado</p>
                  <Badge
                    className={`mt-1 ${resultado.resultado === "aprovado" ? "bg-emerald-50 text-emerald-600 border-emerald-200" : resultado.resultado === "reprovado" ? "bg-red-50 text-red-600 border-red-200" : "bg-amber-50 text-amber-600 border-amber-200"}`}
                    variant="outline"
                  >
                    {resultado.resultado?.toUpperCase()}
                  </Badge>
                </div>
                <div className="rounded-xl border border-border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Score</p>
                  <p className="font-bold text-lg">{resultado.score ?? "—"}</p>
                </div>
                <div className="rounded-xl border border-border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Prob. Inadimplência</p>
                  <p className="font-bold text-lg">{resultado.probabilidade_inadimplencia != null ? `${resultado.probabilidade_inadimplencia}%` : "—"}</p>
                </div>
                <div className="rounded-xl border border-border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Classificação</p>
                  <p className="font-bold text-lg">{resultado.analise?.classificacao_abc || "—"}</p>
                </div>
              </div>

              {/* Botão de download */}
              {resultado.relatorio_url && (
                <a href={resultado.relatorio_url} target="_blank" rel="noopener noreferrer">
                  <Button className="w-full gap-2 rounded-xl">
                    <Download className="w-4 h-4" /> Baixar Relatório PDF
                  </Button>
                </a>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}