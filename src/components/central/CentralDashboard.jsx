import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import {
  Wifi, MapPin, Calendar, DollarSign, AlertCircle, CreditCard, FileText,
  Wrench, Headphones, RefreshCw, ArrowRightLeft
} from "lucide-react";

export default function CentralDashboard({ cliente, contrato, onFinanceiro, onContratos, onOS, onSuporte, onTrocarContrato }) {
  const { toast } = useToast();
  const [loadingPag, setLoadingPag] = useState(false);
  const faturaAberta = cliente?.faturas?.find((f) => f.status === "Aberta") || null;

  const handlePagar = async (tipo) => {
    if (!faturaAberta) return;
    setLoadingPag(true);
    try {
      const res = await base44.functions.invoke("centralBoleto", {
        cpf_cnpj: cliente.cliente.cpf_cnpj,
        fatura_id: faturaAberta.id,
        tipo,
      });
      if (res.erro) { toast({ title: "Erro", description: res.erro, variant: "destructive" }); return; }
      if (tipo === "pix" && res.pix_copia_cola) {
        await navigator.clipboard.writeText(res.pix_copia_cola);
        toast({ title: "PIX copiado!", description: "Cole no app do seu banco para pagar." });
      } else if (res.url_boleto) {
        window.open(res.url_boleto, "_blank");
      }
    } catch (e) {
      toast({ title: "Erro", description: "Não foi possível processar o pagamento.", variant: "destructive" });
    } finally {
      setLoadingPag(false);
    }
  };

  const botoes = [
    { label: "Pagar Fatura", icon: CreditCard, onClick: () => handlePagar("boleto"), primary: true },
    { label: "Gerar PIX", icon: CreditCard, onClick: () => handlePagar("pix") },
    { label: "Segunda Via", icon: FileText, onClick: () => handlePagar("boleto") },
    { label: "Meus Contratos", icon: ArrowRightLeft, onClick: onContratos },
    { label: "Ordens de Serviço", icon: Wrench, onClick: onOS },
    { label: "Suporte", icon: Headphones, onClick: onSuporte },
  ];

  return (
    <div className="space-y-4">
      {/* Header com dados do cliente */}
      <Card className="bg-gradient-to-br from-primary to-accent text-primary-foreground">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-primary-foreground/70 text-sm">Bem-vindo(a)</p>
              <h2 className="text-xl font-heading font-bold">{cliente.cliente.nome}</h2>
            </div>
            <Button variant="secondary" size="sm" onClick={onTrocarContrato} className="text-xs">
              <ArrowRightLeft className="w-3.5 h-3.5 mr-1" /> Trocar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Contrato atual */}
      {contrato && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Wifi className="w-4 h-4 text-primary" /> Contrato #{contrato.numero}
              </CardTitle>
              <Badge variant={contrato.status_internet === "A" ? "default" : "secondary"}>
                {contrato.status_internet === "A" ? "Ativo" : "Inativo"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Wifi className="w-3.5 h-3.5" /> Plano: <strong className="text-foreground">{contrato.plano}</strong>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="w-3.5 h-3.5" /> {contrato.endereco}, {contrato.numero} - {contrato.bairro}
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <DollarSign className="w-3.5 h-3.5" /> Valor: <strong className="text-foreground">{contrato.valor_mensal}/mês</strong>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="w-3.5 h-3.5" /> Vencimento: dia <strong className="text-foreground">{contrato.data_vencimento}</strong>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alerta de fatura em aberto */}
      {faturaAberta && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Fatura em aberto</p>
              <p className="text-xs text-muted-foreground">Vence em {faturaAberta.vencimento} • {faturaAberta.valor}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Botões de ação */}
      <div className="grid grid-cols-2 gap-3">
        {botoes.map((btn, i) => (
          <Button
            key={i}
            variant={btn.primary ? "default" : "outline"}
            onClick={btn.onClick}
            disabled={loadingPag && (btn.label.includes("Pagar") || btn.label.includes("PIX") || btn.label.includes("Via"))}
            className="h-20 flex-col gap-1.5"
          >
            {loadingPag && (btn.label.includes("Pagar") || btn.label.includes("PIX") || btn.label.includes("Via")) ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <btn.icon className="w-5 h-5" />
            )}
            <span className="text-xs">{btn.label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}