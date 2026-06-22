import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Loader2, QrCode, RefreshCw, Power, PowerOff, Smartphone, Wifi, WifiOff,
  Copy, CheckCircle2, Server, KeyRound, AlertCircle, Plug
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ════════════════════════════════════════════════════════════════════════
// EVOLUTION GO — Gestão de conexão do serviço externo
//
// Este componente fala o dialeto do EVOLUTION GO (não o Evolution API clássico):
//   • POST /instance/create  { instanceName, integration: "WHATSAPP-BAILEYS" }
//   • POST /instance/connect { webhookUrl, subscribe: [...], immediate: true, phone? }
//   • Headers: apikey (GLOBAL_API_KEY) + instanceId (UUID)
//   • Eventos de webhook em PascalCase: Message, Connected, QRCode, Disconnected...
//   • QR Code chega via webhook (campo qrcode em base64), não na resposta do connect
//
// ────────────────────────────────────────────────────────────────────────
// CONTRATO QUE O BACKEND PRECISA CUMPRIR (base44.functions.invoke):
//
//   "gerenciarEvolution" recebe { acao, ...params } e repassa pro Evolution Go:
//     acao: "criar"       -> POST /instance/create
//                            body: { instanceName, integration }
//                            retorna: { ok, instanceId, token, status }
//     acao: "conectar"    -> POST /instance/connect
//                            body: { webhookUrl, subscribe, immediate, phone? }
//                            retorna: { ok, qrcode?, status }
//     acao: "desconectar" -> POST /instance/logout  (ou /instance/disconnect)
//                            retorna: { ok }
//     acao: "status"      -> GET  /instance/connectionState (opcional)
//
//   O backend lê os secrets EVOLUTION_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE_ID
//   e injeta os headers apikey + instanceId. O front NUNCA toca na api_key.
//
//   "testarEvolution" -> GET {base_url}/  e devolve { ok, url, instance_id, version }
//
//   O webhook do Evolution Go bate em "webhookWhatsapp", que ao receber
//   event === "QRCode" grava o base64 em EvolutionStatus.qr_code e
//   event === "Connected" grava status_conexao="conectado" + phone_connected.
// ════════════════════════════════════════════════════════════════════════

// Eventos do Evolution Go que fazem sentido assinar para uma central de atendimento.
const EVENTOS_DISPONIVEIS = [
  { key: "Message",      label: "Mensagens recebidas",   desc: "Cada mensagem que chega no número", padrao: true },
  { key: "Connected",    label: "Conexão estabelecida",  desc: "Número conectou com sucesso",       padrao: true },
  { key: "Disconnected", label: "Desconexão",            desc: "Número caiu ou foi desconectado",   padrao: true },
  { key: "QRCode",       label: "QR Code",               desc: "Novo QR gerado para parear",        padrao: true },
  { key: "ReadReceipt",  label: "Confirmações de leitura", desc: "Status entregue / lido",          padrao: false },
  { key: "Presence",     label: "Presença",              desc: "Digitando, online, etc.",           padrao: false },
];

function StatusDot({ on, pulse }) {
  return (
    <span className={cn(
      "w-1.5 h-1.5 rounded-full inline-block",
      on ? "bg-emerald-500" : "bg-slate-400",
      pulse && "animate-pulse"
    )} />
  );
}

export default function GerenciamentoEvolution() {
  const qc = useQueryClient();

  // ── Configuração da instância ──────────────────────────────────────────
  const [instanceName, setInstanceName] = useState("netveloce-atendimento");
  const [phone, setPhone] = useState("");
  const [eventos, setEventos] = useState(
    () => EVENTOS_DISPONIVEIS.filter(e => e.padrao).map(e => e.key)
  );

  // ── Flags de ação ──────────────────────────────────────────────────────
  const [creating, setCreating] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedInstance, setCopiedInstance] = useState(false);

  // ── Status local (entidade EvolutionStatus, alimentada pelo webhook) ────
  const { data: statusList = [] } = useQuery({
    queryKey: ["evolutionStatus"],
    queryFn: () => base44.entities.EvolutionStatus.list("-updated_date", 1),
    refetchInterval: 3000,
  });
  const status = statusList[0] || {};

  // ── Status remoto (ping no servidor Evolution Go) ───────────────────────
  const { data: testResult, refetch: refetchTest, isFetching: testing } = useQuery({
    queryKey: ["testEvolution"],
    queryFn: async () => {
      const res = await base44.functions.invoke("testarEvolution", {});
      return res.data;
    },
    refetchInterval: 15000,
  });

  const isConnected  = status.status_conexao === "conectado";
  const isAwaitingQr = status.status_conexao === "aguardando_qr";
  const serverOnline = testResult?.ok === true;

  // ── URL pública do webhook (função que recebe os eventos do Evolution Go) ─
  const webhookUrl = `${window.location.origin.replace("app.", "api.")}/functions/webhookWhatsapp`;

  const copy = (text, which) => {
    navigator.clipboard.writeText(text);
    if (which === "webhook") { setCopiedWebhook(true); setTimeout(() => setCopiedWebhook(false), 2000); }
    if (which === "instance") { setCopiedInstance(true); setTimeout(() => setCopiedInstance(false), 2000); }
    toast.success("Copiado!");
  };

  const toggleEvento = (key) => {
    setEventos(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  // ── Criar instância no Evolution Go ─────────────────────────────────────
  const handleCriar = async () => {
    if (!instanceName.trim()) return;
    setCreating(true);
    try {
      const res = await base44.functions.invoke("gerenciarEvolution", {
        acao: "criar",
        instanceName: instanceName.trim(),
        integration: "WHATSAPP-BAILEYS",
      });
      if (res.data?.ok) {
        toast.success(`Instância criada — ID ${res.data.instanceId}`);
        qc.invalidateQueries({ queryKey: ["evolutionStatus"] });
      } else {
        toast.error(res.data?.error || "Não foi possível criar a instância");
      }
    } catch (e) {
      toast.error("Erro ao criar: " + e.message);
    } finally {
      setCreating(false);
    }
  };

  // ── Conectar (gera QR via webhook) ──────────────────────────────────────
  const handleConectar = async () => {
    setConnecting(true);
    try {
      const res = await base44.functions.invoke("gerenciarEvolution", {
        acao: "conectar",
        webhookUrl,
        subscribe: eventos,          // Evolution Go: lista de eventos PascalCase
        immediate: true,
        phone: phone.trim() || undefined,  // se informado, usa pairing code
      });
      if (res.data?.ok) {
        if (res.data.qrcode) {
          toast.success("QR Code gerado — escaneie no WhatsApp.");
        } else if (phone.trim()) {
          toast.success("Pairing code solicitado — confira o WhatsApp do número.");
        } else {
          toast.info("Conectando… o QR chega pelo webhook em instantes.");
        }
        qc.invalidateQueries({ queryKey: ["evolutionStatus"] });
      } else {
        toast.error(res.data?.error || "Não foi possível iniciar a conexão");
      }
    } catch (e) {
      toast.error("Erro ao conectar: " + e.message);
    } finally {
      setConnecting(false);
    }
  };

  // ── Desconectar ─────────────────────────────────────────────────────────
  const handleDesconectar = async () => {
    setDisconnecting(true);
    try {
      const res = await base44.functions.invoke("gerenciarEvolution", { acao: "desconectar" });
      if (res.data?.ok) {
        toast.success("Número desconectado");
        qc.invalidateQueries({ queryKey: ["evolutionStatus"] });
      } else {
        toast.error(res.data?.error || "Não foi possível desconectar");
      }
    } catch (e) {
      toast.error("Erro ao desconectar: " + e.message);
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* ── Banner: servidor Evolution Go ── */}
      <Card className="rounded-2xl border border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center text-white",
                serverOnline ? "bg-emerald-500" : "bg-slate-400"
              )}>
                <Server className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-base">Servidor Evolution Go</CardTitle>
                <CardDescription className="text-xs">
                  Serviço externo de WhatsApp — gerenciado por API
                </CardDescription>
              </div>
            </div>
            <Badge className={cn(
              "text-xs font-semibold gap-1.5 py-1 px-3 rounded-full border",
              serverOnline ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                           : "bg-slate-50 text-slate-500 border-slate-200"
            )}>
              <StatusDot on={serverOnline} pulse={testing} />
              {serverOnline ? "No ar" : testing ? "Verificando…" : "Sem resposta"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div className="bg-muted/40 rounded-lg px-3 py-2">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Server className="w-3 h-3" /> Endereço
              </p>
              <p className="font-medium truncate">{testResult?.url || "—"}</p>
            </div>
            <div className="bg-muted/40 rounded-lg px-3 py-2">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <KeyRound className="w-3 h-3" /> Instance ID
              </p>
              <p className="font-medium truncate font-mono text-xs">
                {testResult?.instance_id || status.instance_id || "—"}
              </p>
            </div>
            <div className="bg-muted/40 rounded-lg px-3 py-2">
              <p className="text-xs text-muted-foreground">Versão</p>
              <p className="font-medium truncate">{testResult?.version || "—"}</p>
            </div>
          </div>

          {!serverOnline && !testing && (
            <div className="mt-3 flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-800">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <div>
                Servidor não respondeu. Confira os secrets do app:{" "}
                <code className="font-mono">EVOLUTION_URL</code>,{" "}
                <code className="font-mono">EVOLUTION_API_KEY</code> e{" "}
                <code className="font-mono">EVOLUTION_INSTANCE_ID</code>.
              </div>
            </div>
          )}

          <div className="mt-3">
            <Button onClick={() => refetchTest()} variant="outline" size="sm" className="gap-2 rounded-xl">
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Verificar servidor
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Conexão do número ── */}
      <Card className="rounded-2xl border border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center text-white",
                isConnected ? "bg-emerald-500" : isAwaitingQr ? "bg-amber-500" : "bg-slate-400"
              )}>
                {isConnected ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
              </div>
              <div>
                <CardTitle className="text-base">Número de atendimento</CardTitle>
                <CardDescription className="text-xs">Pareie o WhatsApp que recebe as conversas</CardDescription>
              </div>
            </div>
            <Badge className={cn(
              "text-xs font-semibold gap-1.5 py-1 px-3 rounded-full border",
              isConnected ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
              isAwaitingQr ? "bg-amber-50 text-amber-600 border-amber-200" :
              "bg-slate-50 text-slate-500 border-slate-200"
            )}>
              <StatusDot on={isConnected} pulse={isAwaitingQr} />
              {isConnected ? "Conectado" : isAwaitingQr ? "Aguardando QR" : "Desconectado"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isConnected && status.phone_connected && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <div>
                <p className="text-xs text-emerald-600">Número conectado</p>
                <p className="font-medium text-emerald-700">{status.phone_connected}</p>
              </div>
            </div>
          )}

          {/* QR Code (chega pelo webhook) */}
          {status.qr_code && !isConnected && (
            <div className="flex flex-col items-center gap-3 p-4 bg-white rounded-xl border-2 border-amber-200">
              <p className="text-sm font-medium text-amber-700">Escaneie o QR Code no WhatsApp</p>
              <div className="p-3 bg-white rounded-xl border">
                <img src={status.qr_code} alt="QR Code de pareamento" className="w-56 h-56" />
              </div>
              <p className="text-xs text-muted-foreground text-center max-w-xs">
                WhatsApp → Configurações → Dispositivos conectados → Conectar dispositivo
              </p>
            </div>
          )}

          {/* Eventos a assinar (subscribe do /instance/connect) */}
          {!isConnected && (
            <div>
              <Label className="text-xs font-semibold mb-2 block">Eventos que o número vai enviar</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {EVENTOS_DISPONIVEIS.map(ev => {
                  const on = eventos.includes(ev.key);
                  return (
                    <button
                      key={ev.key}
                      type="button"
                      onClick={() => toggleEvento(ev.key)}
                      className={cn(
                        "text-left rounded-xl border px-3 py-2 transition-colors",
                        on ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className={cn("text-sm font-medium", on && "text-primary")}>{ev.label}</span>
                        {on && <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{ev.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pairing code opcional */}
          {!isConnected && (
            <div>
              <Label className="text-xs font-semibold mb-1.5 block">
                Telefone para pairing code <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <Input
                placeholder="5564999999999 — deixe vazio para usar QR Code"
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Com o número preenchido, o WhatsApp recebe um código de 8 dígitos em vez de QR.
              </p>
            </div>
          )}

          {/* Ações */}
          <div className="flex flex-wrap gap-2 pt-1">
            {!isConnected ? (
              <Button onClick={handleConectar} disabled={connecting || !serverOnline} className="gap-2 rounded-xl">
                {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
                {isAwaitingQr ? "Gerar novo QR" : "Conectar WhatsApp"}
              </Button>
            ) : (
              <Button onClick={handleDesconectar} disabled={disconnecting} variant="destructive" className="gap-2 rounded-xl">
                {disconnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <PowerOff className="w-4 h-4" />}
                Desconectar número
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── URL do webhook ── */}
      <Card className="rounded-2xl border border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <QrCode className="w-5 h-5 text-primary" /> Endereço do webhook
          </CardTitle>
          <CardDescription className="text-xs">
            O Evolution Go envia os eventos para esta URL. É preenchida automaticamente ao conectar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input value={webhookUrl} readOnly className="font-mono text-xs bg-muted/30" />
            <Button variant="outline" size="sm" onClick={() => copy(webhookUrl, "webhook")} className="gap-1.5 shrink-0">
              {copiedWebhook ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              Copiar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Criar nova instância ── */}
      <Card className="rounded-2xl border border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Plug className="w-5 h-5 text-primary" /> Criar nova instância
          </CardTitle>
          <CardDescription className="text-xs">
            Use só se ainda não tem uma instância no Evolution Go.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Nome da instância"
              value={instanceName}
              onChange={e => setInstanceName(e.target.value)}
            />
            <Button onClick={handleCriar} disabled={creating || !instanceName.trim() || !serverOnline} variant="outline" className="gap-2 shrink-0">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
              Criar
            </Button>
          </div>
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            Depois de criar, copie o <strong>instanceId</strong> retornado e salve no secret{" "}
            <code className="font-mono">EVOLUTION_INSTANCE_ID</code>. As próximas ações usam esse ID.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
