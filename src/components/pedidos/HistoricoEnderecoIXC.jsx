import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { History, Loader2, MapPin, UserCheck, AlertCircle, CheckCircle2 } from "lucide-react";

const statusLabel = (s) => (s === "S" ? "Ativo" : s === "N" ? "Inativo" : s || "—");

// Painel que consulta o histórico do CPF e do endereço em cada IXC (cidade).
// Requer pedido_id. Restrito na função a admin/gerente.
export default function HistoricoEnderecoIXC({ pedidoId }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [erro, setErro] = useState(null);

  const consultar = async () => {
    setOpen(true);
    setLoading(true);
    setErro(null);
    setData(null);
    try {
      const res = await base44.functions.invoke("historicoClienteEndereco", { pedido_id: pedidoId });
      const d = res?.data || res || {};
      if (d.error) throw new Error(d.error);
      setData(d);
    } catch (e) {
      setErro(e?.message || "Falha ao consultar histórico");
    } finally {
      setLoading(false);
    }
  };

  const foiCliente = data?.foi_cliente_em || [];
  const internet = data?.internet_no_endereco_em || [];
  const resultados = data?.resultados || [];
  const anterior = resultados.find((r) => r.cliente_anterior)?.cliente_anterior;

  return (
    <>
      <Button
        size="sm" variant="outline"
        className="w-full gap-2 rounded-xl border-indigo-200 text-indigo-700 hover:bg-indigo-50"
        onClick={consultar}
      >
        <History className="w-3.5 h-3.5" />
        Histórico (cliente / endereço)
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-600" /> Histórico no IXC
            </DialogTitle>
            <DialogDescription>
              Consulta por cidade: se o cliente já existiu e se já houve internet neste endereço.
            </DialogDescription>
          </DialogHeader>

          {loading && (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mr-2" /> Consultando cada cidade...
            </div>
          )}

          {erro && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {erro}
            </div>
          )}

          {!loading && !erro && data && (
            <div className="space-y-4">
              {/* Resumo */}
              <div className="grid grid-cols-1 gap-2">
                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <UserCheck className="w-4 h-4 text-indigo-600" /> Já foi cliente?
                  </div>
                  {foiCliente.length ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {foiCliente.map((c) => <Badge key={c} variant="secondary">{c}</Badge>)}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-1">Não localizado em nenhuma cidade.</p>
                  )}
                </div>

                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <MapPin className="w-4 h-4 text-indigo-600" /> Internet no endereço?
                  </div>
                  {internet.length ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {internet.map((c) => <Badge key={c} variant="secondary">{c}</Badge>)}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-1">Nenhum registro no endereço.</p>
                  )}
                  {anterior && (
                    <p className="text-sm mt-2">
                      <span className="text-muted-foreground">Cliente anterior:</span>{" "}
                      <span className="font-medium">{anterior.nome}</span>
                      {anterior.cnpj_cpf ? ` · ${anterior.cnpj_cpf}` : ""}
                      {" "}<Badge variant="outline" className="ml-1">{statusLabel(anterior.status)}</Badge>
                    </p>
                  )}
                </div>
              </div>

              {/* Detalhe por cidade */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase">
                  Consulta por cidade ({data.instancias_consultadas || resultados.length})
                </p>
                <div className="space-y-1">
                  {resultados.map((r) => {
                    const achou = r.ja_foi_cliente || r.internet_no_endereco;
                    return (
                      <div key={`${r.id}-${r.cidade}`} className="flex items-center justify-between rounded-md border px-2 py-1.5 text-sm">
                        <span className="truncate">{r.cidade}</span>
                        <span className="flex items-center gap-1 shrink-0">
                          {achou ? (
                            <>
                              {r.ja_foi_cliente && <Badge variant="secondary" className="text-xs">cliente</Badge>}
                              {r.internet_no_endereco && <Badge variant="secondary" className="text-xs">endereço</Badge>}
                            </>
                          ) : (
                            <span className="text-muted-foreground flex items-center gap-1 text-xs">
                              <CheckCircle2 className="w-3.5 h-3.5" /> sem histórico
                            </span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                  {resultados.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Nenhuma instância IXC configurada. Defina o secret <code>IXC_INSTANCES</code> para consulta multi-cidade.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
