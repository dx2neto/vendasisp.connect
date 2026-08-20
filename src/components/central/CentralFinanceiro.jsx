import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Copy, Download, FileText, RefreshCw } from "lucide-react";

export default function CentralFinanceiro({ cliente, contratoId }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState({});

  const faturas = (cliente?.faturas || []).filter((f) =>
    !contratoId || String(f.id_contrato || f.id_cliente_contrato || "") === String(contratoId)
  );

  const handleGerar = async (fatura, tipo) => {
    setLoading((s) => ({ ...s, [`${fatura.id}-${tipo}`]: true }));
    try {
      const res = await base44.functions.invoke("centralBoleto", {
        cpf_cnpj: cliente.cliente.cpf_cnpj || "",
        fatura_id: fatura.id,
        tipo,
      });
      if (res.erro) { toast({ title: "Erro", description: res.erro, variant: "destructive" }); return; }
      if (tipo === "pix" && res.pix_copia_cola) {
        await navigator.clipboard.writeText(res.pix_copia_cola);
        toast({ title: "PIX copiado!", description: "Cole no app do seu banco para pagar." });
      } else if (res.url_boleto) {
        window.open(res.url_boleto, "_blank");
      } else if (res.linha_digitavel) {
        await navigator.clipboard.writeText(res.linha_digitavel);
        toast({ title: "Linha copiada!", description: "Linha digitável copiada para a área de transferência." });
      }
    } catch (e) {
      toast({ title: "Erro", description: "Não foi possível gerar o documento.", variant: "destructive" });
    } finally {
      setLoading((s) => ({ ...s, [`${fatura.id}-${tipo}`]: false }));
    }
  };

  const copiarLinha = async (linha) => {
    if (!linha) return;
    await navigator.clipboard.writeText(linha);
    toast({ title: "Copiado!", description: "Linha digitável copiada." });
  };

  if (faturas.length === 0) {
    return (
      <Card><CardContent className="py-12 text-center text-muted-foreground">
        Nenhuma fatura encontrada para este contrato.
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-heading font-bold px-1">Faturas</h2>
      {faturas.map((f) => {
        const isAberta = f.status === "Aberta";
        const isVencida = isAberta && new Date(f.vencimento.split("/").reverse().join("-")) < new Date();
        return (
          <Card key={f.id} className={isVencida ? "border-destructive/30" : ""}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-sm">Fatura #{f.id}</p>
                  <p className="text-xs text-muted-foreground">{f.descricao}</p>
                </div>
                <Badge variant={isVencida ? "destructive" : isAberta ? "secondary" : "outline"}>
                  {isVencida ? "Vencida" : f.status}
                </Badge>
              </div>
              <div className="flex items-center justify-between mb-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Vencimento: </span>
                  <strong>{f.vencimento}</strong>
                </div>
                <div className="text-lg font-bold">{f.valor}</div>
              </div>
              {isAberta && (
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="default" onClick={() => handleGerar(f, "boleto")}
                    disabled={loading[`${f.id}-boleto`]}>
                    {loading[`${f.id}-boleto`] ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                    Boleto
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleGerar(f, "pix")}
                    disabled={loading[`${f.id}-pix`]}>
                    {loading[`${f.id}-pix`] ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                    PIX
                  </Button>
                  {f.linha_digitavel && (
                    <Button size="sm" variant="ghost" onClick={() => copiarLinha(f.linha_digitavel)}>
                      <Copy className="w-3.5 h-3.5" /> Linha
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}