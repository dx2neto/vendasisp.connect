import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, XCircle, Loader2, RefreshCw, AlertCircle, Zap, Database, Mail, Clock, Activity, Settings, RefreshCcw, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import IntegracaoForm from "@/components/integracoes/IntegracaoForm";
import SincronizacaoIXC from "@/components/integracoes/SincronizacaoIXC";
import GerenciamentoEvolution from "@/components/integracoes/GerenciamentoEvolution";

function IntegrationCard({ name, icon: Icon, status, lastSync, error, onTest, testing, description, onConfigure }) {
  return (
    <Card className="rounded-2xl border border-border overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center text-white", 
              status === "ok" ? "bg-emerald-500" : status === "testing" ? "bg-blue-500" : "bg-red-500")}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg">{name}</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            </div>
          </div>
          <Badge className={cn(
            "text-xs font-semibold gap-1.5 py-1 px-3 rounded-full",
            status === "ok" ? "bg-emerald-50 text-emerald-600 border-emerald-200 border" :
            status === "testing" ? "bg-blue-50 text-blue-600 border-blue-200 border" :
            "bg-red-50 text-red-500 border-red-200 border"
          )}>
            <span className={cn("w-1.5 h-1.5 rounded-full", 
              status === "ok" ? "bg-emerald-500" : status === "testing" ? "bg-blue-500 animate-pulse" : "bg-red-500")}></span>
            {status === "ok" ? "Conectado" : status === "testing" ? "Testando..." : "Desconectado"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {lastSync && (
          <div className="flex items-center justify-between text-sm bg-muted/40 rounded-lg px-3 py-2">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Última sincronização
            </span>
            <span className="font-medium">{lastSync}</span>
          </div>
        )}
        
        {error && (
          <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-xs">
            <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={onTest}
            disabled={testing}
            variant={status === "ok" ? "outline" : "default"}
            className="flex-1 gap-2 rounded-xl"
            size="sm"
          >
            {testing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Testando...
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5" />
                Testar
              </>
            )}
          </Button>
          <Button
            onClick={onConfigure}
            variant="outline"
            className="rounded-xl"
            size="sm"
          >
            <Settings className="w-3.5 h-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function LogItem({ timestamp, status, message, details }) {
  return (
    <div className="flex gap-3 pb-4 border-b border-border/50 last:border-0">
      <div className={cn("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
        status === "success" ? "bg-emerald-50" : "bg-red-50"
      )}>
        {status === "success" ? (
          <CheckCircle className="w-4 h-4 text-emerald-500" />
        ) : (
          <XCircle className="w-4 h-4 text-red-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">{message}</p>
          <span className="text-xs text-muted-foreground flex-shrink-0">{timestamp}</span>
        </div>
        {details && (
          <p className="text-xs text-muted-foreground mt-1">{details}</p>
        )}
      </div>
    </div>
  );
}

export default function Integracoes() {
  const queryClient = useQueryClient();
  const [testResults, setTestResults] = useState({});
  const [testing, setTesting] = useState({});
  const [formOpen, setFormOpen] = useState(null);
  const [formData, setFormData] = useState({});

  const { data: pedidos = [] } = useQuery({ queryKey: ["pedidos"], queryFn: () => base44.entities.Pedido.list("-updated_date", 50) });
  const { data: analises = [] } = useQuery({ queryKey: ["analises"], queryFn: () => base44.entities.AnaliseCredito.list("-created_date", 50) });
  const { data: contratos = [] } = useQuery({ queryKey: ["contratos"], queryFn: () => base44.entities.Contrato.list("-updated_date", 50) });
  const { data: config = {} } = useQuery({ queryKey: ["configIntegracao"], queryFn: () => base44.entities.ConfigRegras.list().then(r => r[0] || {}) });
  const { data: evolutionStatus = [] } = useQuery({ queryKey: ["evolutionStatus"], queryFn: () => base44.entities.EvolutionStatus.list("-updated_date", 1), refetchInterval: 5000 });
  const evoStatus = evolutionStatus[0] || {};

  const { mutate: saveIntegration, isPending: saving } = useMutation({
    mutationFn: (data) => base44.entities.ConfigRegras.update(config.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["configIntegracao"] });
      setFormOpen(null);
    }
  });

  const testIntegration = async (service) => {
    setTesting(prev => ({ ...prev, [service]: true }));
    try {
      const fnName = service === "evolution" ? "testarEvolution" : "testarIXC";
      const res = await base44.functions.invoke(fnName, {});
      setTestResults(prev => ({
        ...prev,
        [service]: { ok: res.data?.ok, error: res.data?.ok ? null : (res.data?.error || res.data?.msg) }
      }));
    } catch (e) {
      setTestResults(prev => ({
        ...prev,
        [service]: { ok: false, error: e.message }
      }));
    } finally {
      setTesting(prev => ({ ...prev, [service]: false }));
    }
  };

  const ixcSync = pedidos.filter(p => p.sincronizado_ixc).length;
  const ixcPending = pedidos.filter(p => !p.sincronizado_ixc && p.status !== "recusado").length;
  const creditChecks = analises.length;
  const contractsSigned = contratos.filter(c => c.status === "assinado").length;

  const integrations = [
    {
      id: "ixc",
      name: "IXC Soft",
      icon: Database,
      description: "ERP de provedor",
      status: testResults.ixc?.ok ? "ok" : testResults.ixc ? "error" : "unknown",
      lastSync: pedidos.find(p => p.sincronizado_ixc)?.updated_date 
        ? format(new Date(pedidos.find(p => p.sincronizado_ixc).updated_date), "dd/MM/yyyy HH:mm", { locale: ptBR })
        : "Nunca",
      error: testResults.ixc?.error,
      fields: [
        { key: "id_host_ixc", label: "Host", placeholder: "https://seu-ixc.com.br", type: "text" },
        { key: "id_usuario_ixc", label: "Usuário", placeholder: "usuario", type: "text" },
        { key: "id_senha_ixc", label: "Senha", placeholder: "••••••••", type: "password" },
        { key: "id_filial_ixc", label: "ID Filial", placeholder: "1", type: "text" },
      ]
    },
    {
      id: "zapsign",
      name: "ZapSign",
      icon: Mail,
      description: "Assinatura digital",
      status: contractsSigned > 0 ? "ok" : "unknown",
      lastSync: contratos.find(c => c.data_assinatura)?.data_assinatura
        ? format(new Date(contratos.find(c => c.data_assinatura).data_assinatura), "dd/MM/yyyy HH:mm", { locale: ptBR })
        : "Nunca",
      error: null,
      fields: [
        { key: "id_zapsign_token", label: "Token", placeholder: "Cole seu token ZapSign", type: "textarea", help: "Obtenha em https://app.zapsign.com.br" },
      ]
    },
    {
      id: "valido",
      name: "Valido Cadastro",
      icon: Zap,
      description: "Análise de crédito",
      status: creditChecks > 0 ? "ok" : "unknown",
      lastSync: analises[0]?.created_date
        ? format(new Date(analises[0].created_date), "dd/MM/yyyy HH:mm", { locale: ptBR })
        : "Nunca",
      error: null,
      fields: [
        { key: "id_valido_key", label: "Chave de Acesso", placeholder: "Sua chave Valido", type: "password" },
      ]
    },
    {
      id: "evolution",
      name: "Evolution Go",
      icon: MessageCircle,
      description: "WhatsApp / Atendimento",
      status: evoStatus.status_conexao === "conectado" ? "ok" : evoStatus.status_conexao === "aguardando_qr" ? "testing" : "unknown",
      lastSync: evoStatus.updated_date
        ? format(new Date(evoStatus.updated_date), "dd/MM/yyyy HH:mm", { locale: ptBR })
        : "Nunca",
      error: null,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Integrações</h1>
        <p className="text-muted-foreground mt-0.5 text-sm">Gerencie conexões com serviços externos</p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border border-border p-5 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pedidos Sincronizados</p>
              <p className="text-2xl font-bold mt-1">{ixcSync}</p>
            </div>
            <Database className="w-8 h-8 text-primary/20" />
          </div>
        </Card>
        <Card className="rounded-2xl border border-border p-5 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pendentes</p>
              <p className="text-2xl font-bold mt-1">{ixcPending}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-amber-500/20" />
          </div>
        </Card>
        <Card className="rounded-2xl border border-border p-5 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Análises de Crédito</p>
              <p className="text-2xl font-bold mt-1">{creditChecks}</p>
            </div>
            <Zap className="w-8 h-8 text-primary/20" />
          </div>
        </Card>
        <Card className="rounded-2xl border border-border p-5 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Contratos Assinados</p>
              <p className="text-2xl font-bold mt-1">{contractsSigned}</p>
            </div>
            <Mail className="w-8 h-8 text-primary/20" />
          </div>
        </Card>
      </div>

      <Tabs defaultValue="status" className="space-y-4">
        <TabsList className="rounded-xl">
          <TabsTrigger value="status" className="rounded-lg gap-1.5"><Activity className="w-3.5 h-3.5" />Status</TabsTrigger>
          <TabsTrigger value="evolution" className="rounded-lg gap-1.5"><MessageCircle className="w-3.5 h-3.5" />Evolution Go</TabsTrigger>
          <TabsTrigger value="sync" className="rounded-lg gap-1.5"><Database className="w-3.5 h-3.5" />Sincronização IXC</TabsTrigger>
          <TabsTrigger value="logs" className="rounded-lg gap-1.5"><Clock className="w-3.5 h-3.5" />Histórico</TabsTrigger>
        </TabsList>

        {/* Status Tab */}
        <TabsContent value="status" className="space-y-4 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {integrations.map(int => (
              <IntegrationCard
                key={int.id}
                name={int.name}
                icon={int.icon}
                description={int.description}
                status={testing[int.id] ? "testing" : int.status}
                lastSync={int.lastSync}
                error={int.error}
                onTest={() => testIntegration(int.id)}
                testing={testing[int.id]}
                onConfigure={() => {
                  setFormOpen(int.id);
                  setFormData({ ...config, name: int.name, fields: int.fields });
                }}
              />
            ))}
          </div>

          {/* Connection Guide */}
          <Card className="rounded-2xl border border-border mt-6">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                Configuração de Integrações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="space-y-3">
                <div>
                  <p className="font-medium mb-1">🔌 IXC Soft (ERP)</p>
                  <p className="text-muted-foreground">Configurar em <strong>Configurações → IXC</strong>. Adicione o Host, usuário e senha da sua instância IXC.</p>
                </div>
                <div>
                  <p className="font-medium mb-1">✉️ ZapSign (Contratos)</p>
                  <p className="text-muted-foreground">Token armazenado nos secrets. Contratos são enviados automaticamente ao avançar para "Contrato".</p>
                </div>
                <div>
                  <p className="font-medium mb-1">⚡ Valido Cadastro (Crédito)</p>
                  <p className="text-muted-foreground">Chave de acesso nos secrets. Consultado automaticamente ao criar pedidos.</p>
                </div>
                <div>
                  <p className="font-medium mb-1">💬 Evolution Go (WhatsApp)</p>
                  <p className="text-muted-foreground">Gerencie a conexão do WhatsApp na aba <strong>Evolution Go</strong>. Crie instância, gere QR Code e conecte o número.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Evolution Go Tab */}
        <TabsContent value="evolution" className="mt-6">
          <GerenciamentoEvolution />
        </TabsContent>

        {/* Sync Tab */}
        <TabsContent value="sync" className="mt-6">
          <SincronizacaoIXC />
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs" className="mt-6">
          <Card className="rounded-2xl border border-border">
            <CardHeader className="border-b border-border/60">
              <CardTitle className="text-base">Atividades Recentes</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-0">
                {/* IXC Logs */}
                {pedidos.filter(p => p.sincronizado_ixc).slice(0, 3).map(p => (
                  <LogItem
                    key={p.id}
                    timestamp={format(new Date(p.updated_date), "HH:mm", { locale: ptBR })}
                    status="success"
                    message={`Pedido sincronizado ao IXC`}
                    details={`${p.lead_nome} • ID Cliente: ${p.id_cliente_ixc || "—"}`}
                  />
                ))}

                {/* Crédito Logs */}
                {analises.slice(0, 3).map((a, i) => (
                  <LogItem
                    key={i}
                    timestamp={format(new Date(a.created_date), "HH:mm", { locale: ptBR })}
                    status={a.resultado === "aprovado" ? "success" : "error"}
                    message={`Análise de crédito ${a.resultado}`}
                    details={`${a.lead_nome} • Score: ${a.score}`}
                  />
                ))}

                {/* Contrato Logs */}
                {contratos.filter(c => c.status === "assinado").slice(0, 3).map(c => (
                  <LogItem
                    key={c.id}
                    timestamp={format(new Date(c.data_assinatura), "HH:mm", { locale: ptBR })}
                    status="success"
                    message={`Contrato assinado`}
                    details={`${c.cliente_nome} • ${format(new Date(c.data_assinatura), "dd/MM/yyyy", { locale: ptBR })}`}
                  />
                ))}

                {pedidos.length === 0 && analises.length === 0 && contratos.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    Nenhuma atividade ainda
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <IntegracaoForm
        isOpen={!!formOpen}
        onClose={() => setFormOpen(null)}
        integration={formData}
        loading={saving}
        onSave={(data) => saveIntegration(data)}
      />
    </div>
  );
}
