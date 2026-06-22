import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Loader2, QrCode, RefreshCw, Power, PowerOff, Smartphone, Wifi, WifiOff,
  Copy, CheckCircle2, Server, KeyRound, Plug, AlertTriangle, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Gestão de conexão do Evolution Go.
 *
 * Diferente do Evolution API clássico, o Evolution Go usa:
 *   - POST {base_url}/instance/create   body: { instanceName, integration: "WHATSAPP-BAILEYS" }
 *   - POST {base_url}/instance/connect  body: { webhookUrl, subscribe:["ALL"], immediate:true, phone? }
 *   - headers: apikey (GLOBAL_API_KEY), instanceId (UUID), Content-Type: application/json
 *   - eventos do webhook em PascalCase: "Message", "Connected", "QRCode", "Disconnected"...
 *
 * Este componente NÃO chama o Evolution Go direto do browser (a apikey não pode
 * vazar pro cliente). Ele conversa com a backend function `gerenciarEvolution`,
 * que deve repassar a ação ao servidor Evolution Go usando os secrets:
 *   EVOLUTION_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE_ID.
 *
 * Ações esperadas pela function (acao):
 *   "status"      -> consulta o estado da instância no servidor
 *   "criar"       -> cria instância { instanceName }
 *   "conectar"    -> connect { webhookUrl, phone? } e devolve { qrcode? }
 *   "desconectar" -> logout da instância
 *   "reiniciar"   -> restart da instância (opcional)
 */

const CONEXAO = {
  conectado:     { label: "Conectado",     dot: "bg-emerald-500",            chip: "bg-emerald-50 text-emerald-600 border-emerald-200", box: "bg-emerald-500" },
  aguardando_qr: { label: "Aguardando QR", dot: "bg-amber-500 animate-pulse", chip: "bg-amber-50 text-amber-600 border-amber-200",       box: "bg-amber-500" },
  conectando:    { label: "Conectando",    dot: "bg-blue-500 animate-pulse",  chip: "bg-blue-50 text-blue-600 border-blue-200",          box: "bg-blue-500" },
  desconectado:  { label: "Desconectado",  dot: "bg-slate-400",               chip: "bg-slate-50 text-slate-500 border-slate-200",       box: "bg-slate-400" },
};

function CampoCopiavel({ label, value, mono = true }) {
  const [copied, setCopied] = useState(false);
  const copiar = () => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copiado para a área de transferência");
  };
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-2">
        <Input value={value || ""} readOnly className={cn("bg-muted/30", mono && "font-mono text-xs")} />
        <Button variant="outline" size="sm" onClick={copiar} disabled={!value} className="gap-1.5 flex-shrink-0">
          {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          Copiar
        </Button>
      </div>
    </div>
  );
}

export default function GerenciamentoEvolution() {
  const qc = useQueryClient();
  const [instanceName, setInstanceName] = useState("netveloce-atendimento");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(null); // "criar" | "conectar" | "desconectar" | "reiniciar"

  // Estado persistido localmente (entidade EvolutionStatus, atualizada pelo webhook)
  const { data: statusList = [] } = useQuery({
    queryKey: ["evolutionStatus"],
    queryFn: () => base44.entities.EvolutionStatus.list("-updated_date", 1),
    refetchInterval: 3000,
  });
  const status = statusList[0] || {};

  // Estado ao vivo no servidor Evolution Go (via function testarEvolution -> GET /)
  const { data: live, refetch: refetchLive, isFetching: testing } = useQuery({
    queryKey: ["evolutionLive"],
    queryFn: async () => {
      const res = await base44.functions.invoke("testarEvolution", {});
      return res.data;
    },
    refetchInterval: 15000,
  });

  const conexao = status.status_conexao || (live?.connected ? "conectado" : "desconectado");
  const cfg = CONEXAO[conexao] || CONEXAO.desconectado;
  const isConnected = conexao === "conectado";

  // URL da function de webhook que o Evolution Go vai chamar.
  // Em apps Base44 o domínio do app (app.*) e o de funções (api.*) divergem.
  const webhookUrl = useMemo(
    () => `${window.location.origin.replace("app.", "api.")}/functions/webhookWhatsapp`,
    []
  );

  const acao = async (nome, payload = {}) => {
    setBusy(nome);
    try {
      const res = await base44.functions.invoke("gerenciarEvolution", { acao: nome, ...payload });
      const data = res.data || {};
      if (data.ok === false) {
        toast.error(data.error || `Falha ao executar "${nome}"`);
        return data;
      }
      qc.invalidateQueries({ queryKey: ["evolutionStatus"] });
      return data;
    } catch (e) {
      toast.error(`Não foi possível concluir "${nome}": ${e.message}`);
      return { ok: false, error: e.message };
    } finally {
      setBusy(null);
    }
  };

  const criar = async () => {
    if (!instanceName.trim()) return;
    const d = await acao("criar", { instanceName: instanceName.trim() });
    if (d?.ok) toast.success(`Instância criada${d.instanceId ? ` — ID ${d.instanceId}` : ""}. Salve o instanceId nos secrets.`);
  };

  const conectar = async () => {
    const d = await acao("conectar", { webhookUrl, phone: phone.trim() || undefined });
    if (d?.ok) {
      if (d.qrcode || d.qr_code) toast.success("QR Code gerado. Escaneie no WhatsApp.");
      else toast.info("Conexão iniciada. O QR Code chega pelo webhook em instantes.");
    }
  };

  const desconectar = async () => {
    const d = await acao("desconectar");
    if (d?.ok) toast.success("WhatsApp desconectado");
  };

  const qrImg = status.qr_code || status.qrcode || live?.qrcode || null;

  return (
    <div className="space-y-5">
      {/* ── Cartão principal de status ── */}
      <Card className="rounded-2xl border border-border overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center text-white", cfg.box)}>
                {isConnected ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
              </div>
              <div>
                <CardTitle className="text-lg">Evolution Go — WhatsApp</CardTitle>
                <CardDescription className="text-xs">Conexão do número de atendimento</CardDescription>
              </div>
            </div>
            <Badge className={cn("text-xs font-semibold gap-1.5 py-1 px-3 rounded-full border", cfg.chip)}>
              <span className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
              {cfg.label}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Dados do servidor */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-muted/40 rounded-lg px-3 py-2 min-w-0">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Server className="w-3 h-3" /> Servidor</p>
              <p className="font-medium truncate">{live?.url || "—"}</p>
            </div>
            <div className="bg-muted/40 rounded-lg px-3 py-2 min-w-0">
              <p className="text-xs text-muted-foreground">Instance ID</p>
              <p className="font-medium truncate font-mono text-xs">{live?.instance_id || status.instance_id || "—"}</p>
            </div>
            {isConnected && status.phone_connected && (
              <div className="bg-emerald-50 rounded-lg px-3 py-2 col-span-2">
                <p className="text-xs text-emerald-600 flex items-center gap-1.5"><Smartphone className="w-3.5 h-3.5" /> Número conectado</p>
                <p className="font-medium text-emerald-700">{status.phone_connected}</p>
              </div>
            )}
          </div>

          {/* QR Code */}
          {qrImg && !isConnected && (
            <div className="flex flex-col items-center gap-3 p-4 bg-white rounded-xl border-2 border-amber-200">
              <p className="text-sm font-medium text-amber-700">Escaneie para conectar</p>
              <div className="p-3 bg-white rounded-xl border">
                <img
                  src={qrImg.startsWith("data:") ? qrImg : `data:image/png;base64,${qrImg}`}
                  alt="QR Code de conexão do WhatsApp"
                  className="w-56 h-56"
                />
              </div>
              <p className="text-xs text-muted-foreground text-center max-w-xs">
                No celular: WhatsApp → Configurações → Dispositivos conectados → Conectar dispositivo
              </p>
            </div>
          )}

          {/* Ações */}
          <div className="flex flex-wrap gap-2">
            {!isConnected ? (
              <Button onClick={conectar} disabled={busy === "conectar"} className="gap-2 rounded-xl">
                {busy === "conectar" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
                {conexao === "aguardando_qr" ? "Gerar novo QR" : "Conectar WhatsApp"}
              </Button>
            ) : (
              <Button onClick={desconectar} disabled={busy === "desconectar"} variant="destructive" className="gap-2 rounded-xl">
                {busy === "desconectar" ? <Loader2 className="w-4 h-4 animate-spin" /> : <PowerOff className="w-4 h-4" />}
                Desconectar
              </Button>
            )}
            <Button onClick={() => refetchLive()} variant="outline" className="gap-2 rounded-xl">
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Atualizar status
            </Button>
          </div>

          {/* Pairing code opcional */}
          {!isConnected && (
            <div className="space-y-1.5">
              <Label className="text-xs">Conectar por código (opcional)</Label>
              <Input
                placeholder="Número com DDI: 5564999999999"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
              />
              <p className="text-[11px] text-muted-foreground">
                Preencha para receber um código de pareamento em vez de QR. Deixe vazio para usar QR Code.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Webhook ── */}
      <Card className="rounded-2xl border border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><QrCode className="w-5 h-5 text-primary" /> Webhook de eventos</CardTitle>
          <CardDescription className="text-xs">
            O Evolution Go envia mensagens e atualizações de conexão para esta URL (eventos
            <code className="mx-1 px-1 rounded bg-muted text-[11px]">Message</code>,
            <code className="mx-1 px-1 rounded bg-muted text-[11px]">Connected</code>,
            <code className="mx-1 px-1 rounded bg-muted text-[11px]">QRCode</code>).
            Ela já é enviada automaticamente ao conectar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CampoCopiavel label="URL do webhook" value={webhookUrl} />
        </CardContent>
      </Card>

      {/* ── Criar instância ── */}
      <Card className="rounded-2xl border border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Plug className="w-5 h-5 text-primary" /> Criar instância</CardTitle>
          <CardDescription className="text-xs">Use só na primeira configuração, quando ainda não há instância no servidor.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Nome da instância</Label>
            <div className="flex gap-2">
              <Input value={instanceName} onChange={(e) => setInstanceName(e.target.value)} className="flex-1" placeholder="ex: meu-provedor-atendimento" />
              <Button onClick={criar} disabled={busy === "criar" || !instanceName.trim()} variant="outline" className="gap-2 flex-shrink-0">
                {busy === "criar" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
                Criar
              </Button>
            </div>
          </div>
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>
              Após criar, copie o <strong>instanceId</strong> retornado e salve no secret
              <code className="mx-1 px-1 rounded bg-amber-100">EVOLUTION_INSTANCE_ID</code>.
              Sem ele, conectar e enviar mensagens não funciona.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Secrets necessários ── */}
      <Card className="rounded-2xl border border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><KeyRound className="w-5 h-5 text-primary" /> Configuração do servidor</CardTitle>
          <CardDescription className="text-xs">Defina estes secrets no app. Eles ficam só no servidor — nunca no navegador.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {[
            ["EVOLUTION_URL", "URL base do Evolution Go (ex: http://seu-servidor:8080)"],
            ["EVOLUTION_API_KEY", "GLOBAL_API_KEY definida no .env do servidor"],
            ["EVOLUTION_INSTANCE_ID", "UUID da instância (vem ao criar)"],
          ].map(([k, desc]) => (
            <div key={k} className="flex items-start gap-2 bg-muted/40 rounded-lg px-3 py-2">
              <code className="text-xs font-semibold text-primary flex-shrink-0">{k}</code>
              <span className="text-xs text-muted-foreground">— {desc}</span>
            </div>
          ))}
          <a
            href="https://docs.evolutionfoundation.com.br/evolution-go/install/postman"
            target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline pt-1"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Documentação do Evolution Go
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
