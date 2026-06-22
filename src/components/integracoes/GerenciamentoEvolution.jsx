import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, QrCode, RefreshCw, Power, PowerOff, Smartphone, Wifi, WifiOff, Copy, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function GerenciamentoEvolution() {
  const qc = useQueryClient();
  const [instanceName, setInstanceName] = useState("netveloce-atendimento");
  const [phone, setPhone] = useState("");
  const [qrLoading, setQrLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Busca status local (EvolutionStatus entity)
  const { data: statusList = [] } = useQuery({
    queryKey: ["evolutionStatus"],
    queryFn: () => base44.entities.EvolutionStatus.list("-updated_date", 1),
    refetchInterval: 3000,
  });
  const status = statusList[0] || {};

  // Busca status da instância no Evolution
  const { data: testResult, refetch: refetchTest, isFetching: testing } = useQuery({
    queryKey: ["testEvolution"],
    queryFn: async () => {
      const res = await base44.functions.invoke("testarEvolution", {});
      return res.data;
    },
    refetchInterval: 15000,
  });

  // URL do webhook
  const webhookUrl = `${window.location.origin.replace("app.", "api.")}/functions/webhookWhatsapp`;

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("URL copiada!");
  };

  const handleCriar = async () => {
    setCreating(true);
    try {
      const res = await base44.functions.invoke("gerenciarEvolution", { acao: "criar", instanceName });
      if (res.data?.ok) {
        toast.success(`Instância criada! ID: ${res.data.instanceId}`);
      } else {
        toast.error(res.data?.error || "Erro ao criar instância");
      }
    } catch (e) {
      toast.error("Erro: " + e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleConectar = async () => {
    setConnecting(true);
    try {
      const res = await base44.functions.invoke("gerenciarEvolution", {
        acao: "conectar",
        webhookUrl,
        phone: phone || undefined,
      });
      if (res.data?.ok) {
        if (res.data.qrcode) {
          toast.success("QR Code gerado! Escaneie com o WhatsApp.");
        } else {
          toast.info("Conectando... Aguarde o QR Code via webhook.");
        }
      } else {
        toast.error(res.data?.error || "Erro ao conectar");
      }
    } catch (e) {
      toast.error("Erro: " + e.message);
    } finally {
      setConnecting(false);
    }
  };

  const handleDesconectar = async () => {
    setDisconnecting(true);
    try {
      const res = await base44.functions.invoke("gerenciarEvolution", { acao: "desconectar" });
      if (res.data?.ok) {
        toast.success("Instância desconectada");
        qc.invalidateQueries({ queryKey: ["evolutionStatus"] });
      } else {
        toast.error(res.data?.error || "Erro ao desconectar");
      }
    } catch (e) {
      toast.error("Erro: " + e.message);
    } finally {
      setDisconnecting(false);
    }
  };

  const isConnected = status.status_conexao === "conectado";
  const isAwaitingQr = status.status_conexao === "aguardando_qr";

  return (
    <div className="space-y-5">
      {/* Status Card */}
      <Card className="rounded-2xl border border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center text-white",
                isConnected ? "bg-emerald-500" : isAwaitingQr ? "bg-amber-500" : "bg-slate-400"
              )}>
                {isConnected ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
              </div>
              <div>
                <CardTitle className="text-lg">Evolution Go — WhatsApp</CardTitle>
                <CardDescription className="text-xs">Servidor de atendimento via WhatsApp</CardDescription>
              </div>
            </div>
            <Badge className={cn(
              "text-xs font-semibold gap-1.5 py-1 px-3 rounded-full border",
              isConnected ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
              isAwaitingQr ? "bg-amber-50 text-amber-600 border-amber-200" :
              "bg-slate-50 text-slate-500 border-slate-200"
            )}>
              <span className={cn("w-1.5 h-1.5 rounded-full",
                isConnected ? "bg-emerald-500" : isAwaitingQr ? "bg-amber-500 animate-pulse" : "bg-slate-400"
              )} />
              {isConnected ? "Conectado" : isAwaitingQr ? "Aguardando QR" : "Desconectado"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Info do servidor */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-muted/40 rounded-lg px-3 py-2">
              <p className="text-xs text-muted-foreground">Servidor</p>
              <p className="font-medium truncate">{testResult?.url || "—"}</p>
            </div>
            <div className="bg-muted/40 rounded-lg px-3 py-2">
              <p className="text-xs text-muted-foreground">Instance ID</p>
              <p className="font-medium truncate">{testResult?.instance_id || status.instance_id || "—"}</p>
            </div>
            {isConnected && status.phone_connected && (
              <div className="bg-emerald-50 rounded-lg px-3 py-2 col-span-2">
                <p className="text-xs text-emerald-600 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5" /> Número conectado
                </p>
                <p className="font-medium text-emerald-700">{status.phone_connected}</p>
              </div>
            )}
          </div>

          {/* QR Code Display */}
          {status.qr_code && !isConnected && (
            <div className="flex flex-col items-center gap-3 p-4 bg-white rounded-xl border-2 border-amber-200">
              <p className="text-sm font-medium text-amber-700">Escaneie o QR Code no WhatsApp</p>
              <div className="p-3 bg-white rounded-xl border">
                <img src={status.qr_code} alt="QR Code" className="w-56 h-56" />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Abra o WhatsApp → Configurações → Dispositivos conectados → Conectar dispositivo
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {!isConnected ? (
              <Button onClick={handleConectar} disabled={connecting} className="gap-2 rounded-xl">
                {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
                {isAwaitingQr ? "Gerar novo QR" : "Conectar WhatsApp"}
              </Button>
            ) : (
              <Button onClick={handleDesconectar} disabled={disconnecting} variant="destructive" className="gap-2 rounded-xl">
                {disconnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <PowerOff className="w-4 h-4" />}
                Desconectar
              </Button>
            )}
            <Button onClick={() => refetchTest()} variant="outline" className="gap-2 rounded-xl">
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Atualizar
            </Button>
          </div>

          {/* Phone for pairing code (optional) */}
          {!isConnected && (
            <div className="flex gap-2">
              <Input
                placeholder="Telefone para pairing code (opcional): 5511999999999"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="flex-1"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Webhook URL Card */}
      <Card className="rounded-2xl border border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <QrCode className="w-5 h-5 text-primary" />
            URL do Webhook
          </CardTitle>
          <CardDescription className="text-xs">
            Configure esta URL no Evolution Go para receber mensagens em tempo real
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input value={webhookUrl} readOnly className="font-mono text-xs bg-muted/30" />
            <Button variant="outline" size="sm" onClick={handleCopyWebhook} className="gap-1.5">
              {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              Copiar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Create Instance Card */}
      <Card className="rounded-2xl border border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Criar Nova Instância</CardTitle>
          <CardDescription className="text-xs">
            Crie uma nova instância no Evolution Go (use apenas se não tiver uma ainda)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Nome da instância"
              value={instanceName}
              onChange={e => setInstanceName(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleCriar} disabled={creating || !instanceName.trim()} variant="outline" className="gap-2">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
              Criar
            </Button>
          </div>
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            Após criar, copie o <strong>instanceId</strong> retornado e configure no secret <code>EVOLUTION_INSTANCE_ID</code> nas configurações do app.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}