import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CreditCard, FileText, Zap, Loader2, CheckCircle, ExternalLink, FileSearch } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { usePermissions } from "@/lib/usePermissions";
import HistoricoEnderecoIXC from "@/components/pedidos/HistoricoEnderecoIXC";
import TemplatePreview, { preencherVariaveis } from "@/components/templates/TemplatePreview";

const STATUS_FLOW = {
  novo: "analise_credito",
  analise_credito: "viabilidade",
  viabilidade: "contrato_pendente",
  contrato_pendente: "assinado",
  assinado: "ativado",
};

export default function PedidoAcoes({ pedido, lead }) {
  const queryClient = useQueryClient();
  const { is } = usePermissions();
  const [showContrato, setShowContrato] = useState(false);
  const [templateSelecionado, setTemplateSelecionado] = useState(null);
  const [result, setResult] = useState(null);
  const [baixandoRel, setBaixandoRel] = useState(false);

  // Relatório de análise (PDF) — apenas admin/gerente
  const baixarRelatorio = async () => {
    setBaixandoRel(true);
    try {
      const fnUrl = base44.functions.getUrl?.('relatorioAnalisePedido') || `/api/functions/relatorioAnalisePedido`;
      const token = base44.auth.getToken?.() || '';
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: 'include',
        body: JSON.stringify({ pedido_id: pedido.id }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Erro ao gerar relatório'); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `analise_${(pedido.lead_nome || 'cliente').replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      toast({ title: 'Erro ao gerar relatório', description: e.message, variant: 'destructive' });
    } finally {
      setBaixandoRel(false);
    }
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["pedidos"] });
    queryClient.invalidateQueries({ queryKey: ["analises"] });
    queryClient.invalidateQueries({ queryKey: ["comissoes"] });
    queryClient.invalidateQueries({ queryKey: ["contratos"] });
  };

  const { data: templates = [] } = useQuery({
    queryKey: ["templates-contrato"],
    queryFn: () => base44.entities.TemplateContrato.filter({ ativo: true }),
    enabled: showContrato,
  });

  // Dados reais do pedido/lead para preencher template
  const dadosContrato = {
    cliente_nome: pedido.lead_nome || "",
    cliente_cpf: pedido.lead_cpf || lead?.cnpj_cpf || "",
    cliente_email: lead?.email || "",
    cliente_telefone: lead?.telefone || "",
    cliente_rg: lead?.rg || "",
    cliente_endereco: lead?.rua || "",
    cliente_numero: lead?.numero || "",
    cliente_complemento: lead?.complemento || "",
    cliente_bairro: lead?.bairro || "",
    cliente_cidade: lead?.cidade_nome || "",
    cliente_uf: lead?.uf || "",
    cliente_cep: lead?.cep || "",
    plano_nome: pedido.plano_nome || "",
    valor: pedido.valor ? pedido.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "",
    data_contrato: new Date().toLocaleDateString("pt-BR"),
    data_ativacao: new Date(Date.now() + 7 * 86400000).toLocaleDateString("pt-BR"),
    vendedor_nome: pedido.vendedor_nome || "",
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
    mutationFn: () => {
      const conteudoProcessado = templateSelecionado
        ? preencherVariaveis(templateSelecionado.conteudo, dadosContrato)
        : "";
      return base44.functions.invoke("enviarContrato", {
        pedido_id: pedido.id,
        template_pdf_url: "",
        conteudo_contrato: conteudoProcessado,
        template_id: templateSelecionado?.id,
      });
    },
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
    mutationFn: () => base44.functions.invoke("ativarIXC", { pedido_id: pedido.id }),
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
      {/* Relatório de Análise (PDF) — somente gerente/admin */}
      {(is.admin || is.gerente) && (
        <Button
          size="sm" variant="outline"
          className="w-full gap-2 rounded-xl border-violet-200 text-violet-700 hover:bg-violet-50"
          onClick={baixarRelatorio}
          disabled={baixandoRel}
        >
          {baixandoRel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSearch className="w-3.5 h-3.5" />}
          Relatório de Análise (PDF)
        </Button>
      )}

      {/* Histórico do cliente/endereço no IXC — gerente/admin */}
      {(is.admin || is.gerente) && <HistoricoEnderecoIXC pedidoId={pedido.id} />}

      {/* Analisar Crédito */}
      {(s === "novo" || s === "analise_credito") && (
        <Button
          size="sm" variant="outline"
          className="w-full gap-2 rounded-xl border-amber-200 text-amber-700 hover:bg-amber-50"
          onClick={() => creditoMutation.mutate()}
          disabled={isLoading}
        >
          {creditoMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />}
          Analisar Crédito (Valido)
        </Button>
      )}

      {/* Enviar Contrato */}
      {(s === "viabilidade" || s === "contrato_pendente") && (
        pedido.link_assinatura ? (
          <a href={pedido.link_assinatura} target="_blank" rel="noopener noreferrer" className="block">
            <Button size="sm" variant="outline" className="w-full gap-2 rounded-xl border-cyan-200 text-cyan-700 hover:bg-cyan-50">
              <ExternalLink className="w-3.5 h-3.5" /> Ver Link de Assinatura
            </Button>
          </a>
        ) : (
          <Button
            size="sm" variant="outline"
            className="w-full gap-2 rounded-xl border-cyan-200 text-cyan-700 hover:bg-cyan-50"
            onClick={() => setShowContrato(true)}
            disabled={isLoading}
          >
            {contratoMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
            Enviar Contrato (ZapSign)
          </Button>
        )
      )}

      {/* Ativar IXC */}
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

      {/* Modal Contrato com Template */}
      <Dialog open={showContrato} onOpenChange={setShowContrato}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Enviar Contrato via ZapSign</DialogTitle>
            <DialogDescription>Selecione um template e visualize o contrato preenchido antes de enviar.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Seleção de Template */}
            <div>
              <label className="text-sm font-medium block mb-2">Selecionar Template</label>
              {templates.length === 0 ? (
                <p className="text-sm text-muted-foreground bg-muted rounded-lg p-3">
                  Nenhum template ativo. Crie templates em <strong>Templates de Contrato</strong>.
                </p>
              ) : (
                <div className="grid gap-2">
                  {templates.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTemplateSelecionado(t)}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        templateSelecionado?.id === t.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40 hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{t.nome}</span>
                        {templateSelecionado?.id === t.id && (
                          <CheckCircle className="w-4 h-4 text-primary" />
                        )}
                      </div>
                      {t.descricao && <p className="text-xs text-muted-foreground mt-0.5">{t.descricao}</p>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Preview do contrato preenchido */}
            {templateSelecionado && (
              <div>
                <label className="text-sm font-medium block mb-2">Preview com dados do cliente</label>
                <TemplatePreview conteudo={templateSelecionado.conteudo} dadosReais={dadosContrato} />
              </div>
            )}

            <Button
              onClick={() => contratoMutation.mutate()}
              disabled={contratoMutation.isPending || !templateSelecionado}
              className="w-full rounded-xl"
            >
              {contratoMutation.isPending
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</>
                : templateSelecionado
                  ? `Gerar e Enviar — ${templateSelecionado.nome}`
                  : "Selecione um template para continuar"
              }
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}