import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Loader2, Copy, QrCode, Phone, Server, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function GerenciamentoEvolutionGo() {
  const qc = useQueryClient();
  const [criandoInstancia, setCriandoInstancia] = useState(false);
  const [nomeInstancia, setNomeInstancia] = useState("");
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCode, setQrCode] = useState(null);
  const [conectando, setConectando] = useState(false);
  const [phoneParear, setPhoneParear] = useState("");

  const { data: evolutionStatus = [] } = useQuery({
    queryKey: ["evolutionStatus"],
    queryFn: () => base44.entities.EvolutionStatus.list("-updated_date", 10),
    refetchInterval: 5000,
  });

  const evoStatus = evolutionStatus[0] || {};

  // Criar instância
  const criarInstancia = async () => {
    if (!nomeInstancia.trim()) {
      toast.error("Nome da instância obrigatório");
      return;
    }

    setCriandoInstancia(true);
    try {
      const res = await base44.functions.invoke("gerenciarEvolution", {
        acao: "criar",
        instanceName: nomeInstancia,
      });

      if (!res.data?.ok) {
        toast.error(res.data?.error || "Erro ao criar instância");
        setCriandoInstancia(false);
        return;
      }

      toast.success(`Instância "${nomeInstancia}" criada! ID: ${res.data.instanceId}`);
      setNomeInstancia("");
      qc.invalidateQueries({ queryKey: ["evolutionStatus"] });

      // Mostrar modal com instruções
      setTimeout(() => {
        toast.info("Copie o ID da instância e configure no secret EVOLUTION_INSTANCE_ID");
      }, 500);
    } catch (e) {
      toast.error("Erro: " + e.message);
    } finally {
      setCriandoInstancia(false);
    }
  };

  // Conectar instância (gera QR Code)
  const conectarInstancia = async () => {
    setConectando(true);
    try {
      const res = await base44.functions.invoke("gerenciarEvolution", {
        acao: "conectar",
        phone: phoneParear || undefined,
      });

      if (!res.data?.ok) {
        toast.error(res.data?.error || "Erro ao conectar");
        setConectando(false);
        return;
      }

      if (res.data.qrcode) {
        setQrCode(res.data.qrcode);
        setShowQRModal(true);
        toast.success("QR Code gerado! Escaneie com o WhatsApp");
      } else if (res.data.pairingCode) {
        toast.success(`Código de pareamento: ${res.data.pairingCode}`);
        setShowQRModal(false);
      }

      qc.invalidateQueries({ queryKey: ["evolutionStatus"] });
    } catch (e) {
      toast.error("Erro: " + e.message);
    } finally {
      setConectando(false);
    }
  };

  // Desconectar
  const desconectar = async () => {
    if (!window.confirm("Desconectar o WhatsApp?")) return;

    try {
      const res = await base44.functions.invoke("gerenciarEvolution", {
        acao: "desconectar",
      });

      if (res.data?.ok) {
        toast.success("Desconectado com sucesso");
        qc.invalidateQueries({ queryKey: ["evolutionStatus"] });
      }
    } catch (e) {
      toast.error("Erro: " + e.message);
    }
  };

  // Deletar instância
  const deletarInstancia = async () => {
    if (!window.confirm("Tem certeza? Isso deletará a instância do Evolution Go e limpará todos os dados locais.")) return;

    try {
      const res = await base44.functions.invoke("gerenciarEvolution", {
        acao: "deletar",
      });

      if (res.data?.ok) {
        toast.success("Instância deletada com sucesso");
        qc.invalidateQueries({ queryKey: ["evolutionStatus"] });
      } else {
        toast.error(res.data?.error || "Erro ao deletar");
      }
    } catch (e) {
      toast.error("Erro: " + e.message);
    }
  };

  // Status badge
  const statusConfig = {
    conectado: { label: "Conectado", color: "bg-emerald-50 text-emerald-600 border-emerald-200" },
    desconectado: { label: "Desconectado", color: "bg-red-50 text-red-600 border-red-200" },
    aguardando_qr: { label: "Aguardando QR", color: "bg-blue-50 text-blue-600 border-blue-200" },
    erro: { label: "Erro", color: "bg-red-50 text-red-600 border-red-200" },
  };

  const cfg = statusConfig[evoStatus.status_conexao] || statusConfig.desconectado;

  return (
    <div className="space-y-5">
      {/* Status Card */}
      <Card className="rounded-2xl border border-border">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Server className="w-5 h-5 text-primary" />
                Status da Instância
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {evoStatus.instance_id ? `ID: ${evoStatus.instance_id}` : "Nenhuma instância configurada"}
              </p>
            </div>
            <Badge className={`text-xs border ${cfg.color}`}>
              {cfg.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-muted/30 rounded-xl">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Instância</p>
              <p className="font-mono text-sm font-medium break-all">
                {evoStatus.instance_name || "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">WhatsApp Conectado</p>
              <p className="font-mono text-sm font-medium">
                {evoStatus.phone_connected ? `+${evoStatus.phone_connected}` : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Último Evento</p>
              <p className="text-sm font-medium">{evoStatus.ultimo_evento || "—"}</p>
            </div>
          </div>

          {/* Ações */}
          <div className="flex flex-wrap gap-2 pt-2">
            {evoStatus.instance_id ? (
              <>
                {evoStatus.status_conexao === "conectado" ? (
                  <Button onClick={desconectar} variant="outline" className="gap-2 rounded-xl" size="sm">
                    <Phone className="w-4 h-4" />
                    Desconectar WhatsApp
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={conectarInstancia}
                      disabled={conectando}
                      className="gap-2 rounded-xl"
                      size="sm"
                    >
                      {conectando ? (
                        <><Loader2 className="w-4 h-4 animate-spin" />Conectando...</>
                      ) : (
                        <><QrCode className="w-4 h-4" />Gerar QR Code</>
                      )}
                    </Button>
                  </>
                )}
                <Button
                  onClick={deletarInstancia}
                  variant="destructive"
                  className="gap-2 rounded-xl"
                  size="sm"
                >
                  <Trash2 className="w-4 h-4" />
                  Deletar Instância
                </Button>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Crie uma instância para começar</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Criar Instância */}
      <Card className="rounded-2xl border border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="w-4 h-4 text-primary" />
            Criar Nova Instância
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Nome da instância (ex: atendimento-netveloce)"
              value={nomeInstancia}
              onChange={(e) => setNomeInstancia(e.target.value)}
              className="flex-1 rounded-xl"
            />
            <Button
              onClick={criarInstancia}
              disabled={criandoInstancia || !nomeInstancia.trim()}
              className="gap-2 rounded-xl"
            >
              {criandoInstancia ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Criando...</>
              ) : (
                <><Plus className="w-4 h-4" />Criar</>
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Após criar, você receberá um ID de instância. Configure-o no secret <code>EVOLUTION_INSTANCE_ID</code>.
          </p>
        </CardContent>
      </Card>

      {/* Instruções */}
      <Card className="rounded-2xl border border-amber-200 bg-amber-50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-amber-900">
            <AlertCircle className="w-4 h-4" />
            Como Configurar
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs text-amber-800">
          <ol className="space-y-2 list-decimal list-inside">
            <li>Clique em <strong>"Criar Nova Instância"</strong> acima</li>
            <li>Copie o <strong>ID da instância</strong> fornecido</li>
            <li>Vá em <strong>Configurações → Secrets</strong> e configure <code>EVOLUTION_INSTANCE_ID</code></li>
            <li>Volte aqui e clique em <strong>"Gerar QR Code"</strong></li>
            <li>Abra o <strong>WhatsApp no celular</strong> → Configurações → Dispositivos conectados → Conectar dispositivo</li>
            <li>Escaneie o QR Code exibido</li>
            <li>Aguarde a sincronização (20-30 segundos)</li>
          </ol>
        </CardContent>
      </Card>

      {/* Webhook Configuration */}
      <Card className="rounded-2xl border border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary" />
            Webhook Configurado
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            O webhook está automaticamente configurado na função <code>webhookWhatsapp</code>.
            Mensagens e eventos serão capturados automaticamente quando a instância estiver conectada.
          </p>
          <div className="p-3 bg-muted/30 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">URL do Webhook:</p>
            <p className="font-mono text-xs break-all">
              {`${window.location.origin.replace("app.", "api.")}/functions/webhookWhatsapp`}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* QR Code Modal */}
      <Dialog open={showQRModal} onOpenChange={setShowQRModal}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Escaneie o QR Code</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {qrCode ? (
              <div className="flex justify-center">
                <div className="bg-white p-4 rounded-xl">
                  <img
                    src={`data:image/png;base64,${qrCode.split(",")[1] || qrCode}`}
                    alt="QR Code"
                    className="w-56 h-56"
                  />
                </div>
              </div>
            ) : (
              <div className="h-56 bg-muted/30 rounded-lg flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            )}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800 space-y-1">
              <p className="font-semibold">Instruções:</p>
              <ol className="list-decimal list-inside space-y-0.5">
                <li>Abra o WhatsApp no celular</li>
                <li>Vá em Configurações → Dispositivos conectados</li>
                <li>Clique em "Conectar dispositivo"</li>
                <li>Escaneie este código QR</li>
              </ol>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Este código expira em alguns minutos
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}