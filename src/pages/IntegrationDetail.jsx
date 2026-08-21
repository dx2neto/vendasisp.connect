import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Save, KeyRound, Activity, Webhook, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function IntegrationDetail() {
  const { slug } = useParams();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [extraConfigText, setExtraConfigText] = useState("{}");

  const { data: integration, isLoading } = useQuery({
    queryKey: ["integration-detail", slug],
    queryFn: () => base44.entities.Integration.filter({ slug }).then((r) => r[0]),
    enabled: !!slug,
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["integration-logs", slug],
    queryFn: () => base44.entities.IntegrationLog.list("-created_date", 50),
    enabled: !!slug,
  });

  const { data: webhooks = [] } = useQuery({
    queryKey: ["integration-webhooks", slug],
    queryFn: () => base44.entities.IntegrationWebhook.list("-created_date", 50),
    enabled: !!slug,
  });

  useEffect(() => {
    if (integration) {
      setForm({
        base_url: integration.base_url || "",
        environment: integration.environment || "production",
        enabled: integration.enabled,
      });
      setExtraConfigText(JSON.stringify(integration.extra_config || {}, null, 2));
    }
  }, [integration]);

  const handleSave = async () => {
    setSaving(true);
    try {
      let extra_config = {};
      try {
        extra_config = JSON.parse(extraConfigText);
      } catch {
        alert("JSON do extra_config inválido");
        setSaving(false);
        return;
      }
      await base44.entities.Integration.update(integration.id, {
        base_url: form.base_url,
        environment: form.environment,
        enabled: form.enabled,
        extra_config,
      });
      queryClient.invalidateQueries({ queryKey: ["integration-detail", slug] });
      queryClient.invalidateQueries({ queryKey: ["integration-hub"] });
    } catch (e) {
      alert("Erro ao salvar: " + e.message);
    }
    setSaving(false);
  };

  if (isLoading || !form) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const integrationLogs = logs.filter((l) => l.integration_slug === slug || l.service === slug);
  const integrationWebhooks = webhooks.filter((w) => w.integration_slug === slug);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" className="rounded-lg">
          <Link to="/integrations"><ArrowLeft className="w-4 h-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{integration.display_name}</h1>
          <p className="text-sm text-muted-foreground font-mono">{integration.slug}</p>
        </div>
      </div>

      <Tabs defaultValue="config" className="space-y-4">
        <TabsList className="rounded-xl">
          <TabsTrigger value="config" className="rounded-lg gap-1.5">Configuração</TabsTrigger>
          <TabsTrigger value="logs" className="rounded-lg gap-1.5">
            Logs ({integrationLogs.length})
          </TabsTrigger>
          {integration.has_webhook && (
            <TabsTrigger value="webhooks" className="rounded-lg gap-1.5">
              Webhooks ({integrationWebhooks.length})
            </TabsTrigger>
          )}
        </TabsList>

        {/* Configuração */}
        <TabsContent value="config" className="mt-4 space-y-4">
          <Card className="rounded-2xl border border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Configurações Gerais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-border p-4">
                <div>
                  <p className="text-sm font-medium">Integração ativa</p>
                  <p className="text-xs text-muted-foreground">Habilita ou desabilita todas as chamadas desta integração</p>
                </div>
                <Switch
                  checked={form.enabled}
                  onCheckedChange={(v) => setForm({ ...form, enabled: v })}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Ambiente</Label>
                <div className="flex gap-2">
                  {["production", "sandbox"].map((env) => (
                    <Button
                      key={env}
                      variant={form.environment === env ? "default" : "outline"}
                      size="sm"
                      onClick={() => setForm({ ...form, environment: env })}
                    >
                      {env === "production" ? "Produção" : "Sandbox"}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">URL Base da API</Label>
                <Input
                  value={form.base_url}
                  onChange={(e) => setForm({ ...form, base_url: e.target.value })}
                  placeholder="https://api.exemplo.com/v1"
                  className="rounded-lg"
                />
                <p className="text-xs text-muted-foreground">
                  Editável para apontar para sandbox/produção ou o host do cliente (necessário para IXCsoft, Evolution API e PagCard).
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Configurações Avançadas (JSON)</Label>
                <Textarea
                  value={extraConfigText}
                  onChange={(e) => setExtraConfigText(e.target.value)}
                  rows={6}
                  className="rounded-lg font-mono text-xs"
                  placeholder='{"anthropic_version": "2023-06-01"}'
                />
              </div>

              <Button onClick={handleSave} disabled={saving} className="gap-2 rounded-xl">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar Configuração
              </Button>
            </CardContent>
          </Card>

          {/* Secrets necessários */}
          {integration.secrets_required && integration.secrets_required.length > 0 && (
            <Card className="rounded-2xl border border-amber-200 bg-amber-50/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-amber-500" />
                  Credenciais Necessárias (Secrets)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">
                  As credenciais são gerenciadas via Secrets do Base44 e nunca ficam visíveis no frontend.
                  Configure-as pelo dashboard ou via terminal:
                </p>
                <div className="space-y-2">
                  {integration.secrets_required.map((secret) => (
                    <div key={secret} className="flex items-center justify-between rounded-lg border border-amber-200 bg-white px-3 py-2">
                      <code className="text-xs font-mono text-amber-700">{secret}</code>
                      <Badge variant="outline" className="text-xs bg-amber-50 text-amber-600 border-amber-200">
                        Configurar via dashboard
                      </Badge>
                    </div>
                  ))}
                </div>
                <div className="mt-3 rounded-lg bg-amber-100/60 border border-amber-200 p-3">
                  <code className="text-xs text-amber-800">
                    npx base44 secrets set {integration.secrets_required[0]}=&lt;valor&gt;
                  </code>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Logs */}
        <TabsContent value="logs" className="mt-4">
          <Card className="rounded-2xl border border-border overflow-hidden">
            <CardHeader className="border-b border-border/60 py-3 px-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="w-4 h-4 text-muted-foreground" />
                Últimas Chamadas ({integrationLogs.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {integrationLogs.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground">
                  <Activity className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  <p>Nenhuma chamada registrada.</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {integrationLogs.map((log) => (
                    <div key={log.id} className="px-5 py-3 hover:bg-muted/20 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          {log.ok ? (
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-red-500" />
                          )}
                          <span className="text-sm font-medium">{log.action || log.step}</span>
                          {log.method && (
                            <Badge variant="outline" className="text-xs font-mono">{log.method}</Badge>
                          )}
                          {log.response_status && (
                            <Badge variant="outline" className={`text-xs ${log.response_status < 400 ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-red-50 text-red-600 border-red-200"}`}>
                              {log.response_status}
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {log.created_date ? format(new Date(log.created_date), "dd/MM/yyyy HH:mm:ss", { locale: ptBR }) : "—"}
                        </span>
                      </div>
                      {log.error_message && (
                        <p className="text-xs text-red-500 ml-5">{log.error_message}</p>
                      )}
                      {log.duration_ms != null && (
                        <p className="text-xs text-muted-foreground ml-5">{log.duration_ms}ms</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Webhooks */}
        {integration.has_webhook && (
          <TabsContent value="webhooks" className="mt-4">
            <Card className="rounded-2xl border border-border overflow-hidden">
              <CardHeader className="border-b border-border/60 py-3 px-5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Webhook className="w-4 h-4 text-muted-foreground" />
                  Webhooks Recebidos ({integrationWebhooks.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {integrationWebhooks.length === 0 ? (
                  <div className="py-16 text-center text-muted-foreground">
                    <Webhook className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p>Nenhum webhook recebido.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {integrationWebhooks.map((wh) => (
                      <div key={wh.id} className="px-5 py-3 hover:bg-muted/20 transition-colors">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{wh.event_type || "—"}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={`text-xs ${wh.processed ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-amber-50 text-amber-600 border-amber-200"}`}>
                              {wh.processed ? "Processado" : "Pendente"}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {wh.created_date ? format(new Date(wh.created_date), "dd/MM/yyyy HH:mm:ss", { locale: ptBR }) : "—"}
                            </span>
                          </div>
                        </div>
                        {wh.payload && (
                          <pre className="text-xs text-muted-foreground bg-muted/30 rounded-md p-2 mt-1 overflow-x-auto max-h-24">
                            {JSON.stringify(wh.payload, null, 2).slice(0, 500)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}