import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CreditCard, FileText, Zap, Loader2, CheckCircle, AlertTriangle, ExternalLink } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

const STATUS_FLOW = {
  novo: "analise_credito",
  analise_credito: "viabilidade",
  viabilidade: "contrato_pendente",
  contrato_pendente: "assinado",
  assinado: "ativado",
};

export default function PedidoAcoes({ pedido, lead }) {
  const queryClient = useQueryClient();
  const [showContrato, setShowContrato] = useState(false);
  const [templateUrl, setTemplateUrl] = useState("");
  const [result, setResult] = useState(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["pedidos"] });
    queryClient.invalidateQueries({ queryKey: ["analises"] });
    queryClient.invalidateQueries({ queryKey: ["comissoes"] });
    queryClient.invalidateQueries({ queryKey: ["contratos"] });
  };

  // Analisar Crédito
  const creditoMutation = useMutation({
    mutationFn: () =>
      base44.functions.invoke("consultarCredito", {
        pedido_id: pedido.id,
        cpf_cnpj: pedido.lead_cpf || lead?.cnpj_cpf || "",
        lead_nome: pedido.lead_nome,
      }),
    onSuccess: (res) => {
      const d = res.data;
      setResult({ type: "credito", data: d });
      invalidate();
      toast({ title: `Crédito: ${d.resultado}`, description: `Score: ${d.score ?? "—"} | Inadimplência: ${d.probabilidade_inadimplencia ?? "—"}%` });
    },
    onError: (err) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  // Enviar Contrato
  const contratoMutation = useMutation({
    mutationFn: () =>
      base44.functions.invoke("enviarContrato", {
        pedido_id: pedido.id,
        template_pdf_url: templateUrl,
      }),
    onSuccess: (res) => {
      const d = res.data;
      setResult({ type: "contrato", data: d });
      setShowContrato(false);
      invalidate();
      toast({ title: "Contrato enviado", description: "Link de assinatura gerado com sucesso." });
    },
    onError: (err) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  // Ativar no IXC
  const ativarMutation = useMutation({
    mutationFn: () =>
      base44.functions.invoke("ativarIXC", { pedido_id: pedido.id }),
    onSuccess: (res) => {
      const d = res.data;
      setResult({ type: "ativacao", data: d });
      invalidate();
      toast({ title: "Ativado no IXC!", description: `Cliente #${d.id_cliente_ixc} | OS #${d.id_os_ixc}` });
    },
    onError: (err) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const s = pedido.status;
  const isLoading = creditoMutation.isPending || contratoMutation.isPending || ativarMutation.isPending;

  return (
    <div className="space-y-3">
      {/* Ação de Crédito */}
      {(s === "novo" || s === "analise_credito") && (
        <Button
          size="sm"
          variant="outline"
          className="w-full gap-2 rounded-xl border-amber-200 text-amber-700 hover:bg-amber-50"
          onClick={() => creditoMutation.mutate()}
          disabled={isLoading}
        >
          {creditoMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />}
          Analisar Crédito (Valido)
        </Button>
      )}

      {/* Ação de Contrato */}
      {(s === "viabilidade" || s === "contrato_pendente") && (
        <>
          {pedido.link_assinatura ? (
            <a href={pedido.link_assinatura} target="_blank" rel="noopener noreferrer" className="block">
              <Button size="sm" variant="outline" className="w-full gap-2 rounded-xl border-cyan-200 text-cyan-700 hover:bg-cyan-50">
                <ExternalLink className="w-3.5 h-3.5" /> Ver Link de Assinatura
              </Button>
            </a>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="w-full gap-2 rounded-xl border-cyan-200 text-cyan-700 hover:bg-cyan-50"
              onClick={() => setShowContrato(true)}
              disabled={isLoading}
            >
              {contratoMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
              Enviar Contrato (ZapSign)
            </Button>
          )}
        </>
      )}

      {/* Ação de Ativação */}
      {s === "assinado" && !pedido.sincronizado_ixc && (
        <Button
          size="sm"
          className="w-full gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={() => ativarMutation.mutate()}
          disabled={isLoading}
        >
          {ativarMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
          Ativar Cliente no IXC
        </Button>
      )}

      {/* IDs IXC */}
      {pedido.sincronizado_ixc && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 space-y-1 text-xs">
          <div className="flex items-center gap-1.5 text-emerald-700 font-semibold mb-1">
            <CheckCircle className="w-3.5 h-3.5" /> Sincronizado IXC
          </div>
          {pedido.id_cliente_ixc && <p className="text-emerald-600">Cliente: #{pedido.id_cliente_ixc}</p>}
          {pedido.id_contrato_ixc && <p className="text-emerald-600">Contrato: #{pedido.id_contrato_ixc}</p>}
          {pedido.id_os_ixc && <p className="text-emerald-600">OS: #{pedido.id_os_ixc}</p>}
        </div>
      )}

      {/* Modal Contrato */}
      <Dialog open={showContrato} onOpenChange={setShowContrato}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar Contrato via ZapSign</DialogTitle>
            <DialogDescription>O link de assinatura será enviado para o cliente por e-mail e WhatsApp.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>URL do PDF do Contrato (opcional)</Label>
              <Input
                placeholder="https://storage.exemplo.com/contrato.pdf"
                value={templateUrl}
                onChange={e => setTemplateUrl(e.target.value)}
                className="rounded-xl"
              />
              <p className="text-xs text-muted-foreground">Deixe em branco para usar o template padrão da ZapSign.</p>
            </div>
            <Button
              onClick={() => contratoMutation.mutate()}
              disabled={contratoMutation.isPending}
              className="w-full rounded-xl"
            >
              {contratoMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</> : "Gerar e Enviar Contrato"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}