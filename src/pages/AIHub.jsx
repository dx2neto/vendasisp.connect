import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, RefreshCw, CheckCircle, XCircle, Sparkles, Bot, Cpu, Zap, Brain, Globe, Server, Code } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { base44 } from "@/api/base44Client";
import { aiProviders, aiTest } from "@/lib/aiClient";
import AIPlayground from "@/components/ai/AIPlayground";

const PROVIDER_ICONS = {
  openai: Bot,
  anthropic: Brain,
  groq: Zap,
  together: Cpu,
  ollama: Server,
  gemini: Sparkles,
};

const PROVIDER_DESCRIPTIONS = {
  openai: "GPT-4o, GPT-4 Turbo, GPT-3.5",
  anthropic: "Claude 3 Opus, Sonnet, Haiku",
  groq: "Llama 3.3, Mixtral (ultra-rápido)",
  together: "Llama 3, CodeLlama e mais",
  ollama: "IA local (Llama, Mistral, Phi3)",
  gemini: "Built-in (sem configuração)",
};

function ProviderCard({ provider, onTest, testing, testResult }) {
  const Icon = PROVIDER_ICONS[provider.slug] || Bot;
  const ok = testResult?.ok === true;
  const error = testResult?.ok === false;

  return (
    <Card className="rounded-2xl border border-border overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center text-white",
              provider.configured ? "bg-primary" : "bg-muted-foreground/30"
            )}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base">{provider.name}</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{PROVIDER_DESCRIPTIONS[provider.slug]}</p>
            </div>
          </div>
          <Badge className={cn(
            "text-xs font-semibold gap-1.5 py-1 px-3 rounded-full",
            provider.configured
              ? "bg-emerald-50 text-emerald-600 border-emerald-200 border"
              : "bg-muted text-muted-foreground border-border border"
          )}>
            {provider.configured ? (
              <><CheckCircle className="w-3 h-3" /> Configurado</>
            ) : (
              <><XCircle className="w-3 h-3" /> Sem chave</>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Models */}
        <div className="flex flex-wrap gap-1.5">
          {provider.models.map(m => (
            <Badge key={m.id} variant="outline" className="text-[10px] font-mono">
              {m.name}
            </Badge>
          ))}
        </div>

        {/* Secret info */}
        {provider.secret_key && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Code className="w-3 h-3" />
            <code className="font-mono">{provider.secret_key}</code>
          </div>
        )}

        {/* Test result */}
        {ok && (
          <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
            <CheckCircle className="w-3 h-3" /> Conexão OK — {testResult.model || testResult.message}
          </div>
        )}
        {error && (
          <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2">
            <XCircle className="w-3 h-3 flex-shrink-0 mt-0.5" /> {testResult.error}
          </div>
        )}

        <Button
          onClick={() => onTest(provider.slug)}
          disabled={testing || !provider.configured}
          variant={ok ? "outline" : "default"}
          className="w-full gap-2 rounded-xl"
          size="sm"
        >
          {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Testar conexão
        </Button>
      </CardContent>
    </Card>
  );
}

export default function AIHub() {
  const qc = useQueryClient();
  const [testing, setTesting] = useState({});
  const [testResults, setTestResults] = useState({});

  const { data: providers = [], isLoading } = useQuery({
    queryKey: ["ai-providers"],
    queryFn: aiProviders,
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["ai-logs"],
    queryFn: () => base44.entities.IntegrationLog.filter({ service: { $in: ["openai", "anthropic", "groq", "together", "ollama", "gemini"] } }),
  });

  const handleTest = async (slug) => {
    setTesting(prev => ({ ...prev, [slug]: true }));
    try {
      const result = await aiTest(slug);
      setTestResults(prev => ({ ...prev, [slug]: result }));
    } catch (e) {
      setTestResults(prev => ({ ...prev, [slug]: { ok: false, error: e.message } }));
    } finally {
      setTesting(prev => ({ ...prev, [slug]: false }));
    }
  };

  const configuredCount = providers.filter(p => p.configured).length;
  const aiLogs = logs.filter(l => ["openai", "anthropic", "groq", "together", "ollama", "gemini"].includes(l.service));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            Hub de IA
          </h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Gerencie provedores de IA e use o playground para interagir com os modelos
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 rounded-xl"
          onClick={() => qc.invalidateQueries({ queryKey: ["ai-providers"] })}
        >
          <RefreshCw className="w-3.5 h-3.5" /> Atualizar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="rounded-2xl border border-border p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Provedores</p>
              <p className="text-2xl font-bold mt-1">{providers.length}</p>
            </div>
            <Globe className="w-8 h-8 text-primary/20" />
          </div>
        </Card>
        <Card className="rounded-2xl border border-border p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Configurados</p>
              <p className="text-2xl font-bold mt-1 text-emerald-600">{configuredCount}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-emerald-500/20" />
          </div>
        </Card>
        <Card className="rounded-2xl border border-border p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Modelos</p>
              <p className="text-2xl font-bold mt-1">{providers.reduce((acc, p) => acc + p.models.length, 0)}</p>
            </div>
            <Cpu className="w-8 h-8 text-primary/20" />
          </div>
        </Card>
        <Card className="rounded-2xl border border-border p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Chamadas</p>
              <p className="text-2xl font-bold mt-1">{aiLogs.length}</p>
            </div>
            <Zap className="w-8 h-8 text-primary/20" />
          </div>
        </Card>
      </div>

      <Tabs defaultValue="playground" className="space-y-4">
        <TabsList className="rounded-xl">
          <TabsTrigger value="playground" className="rounded-lg gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Playground
          </TabsTrigger>
          <TabsTrigger value="providers" className="rounded-lg gap-1.5">
            <Server className="w-3.5 h-3.5" /> Provedores
          </TabsTrigger>
          <TabsTrigger value="logs" className="rounded-lg gap-1.5">
            <Code className="w-3.5 h-3.5" /> Logs
          </TabsTrigger>
        </TabsList>

        {/* Playground */}
        <TabsContent value="playground" className="mt-6">
          <Card className="rounded-2xl border border-border p-5">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <AIPlayground providers={providers} />
            )}
          </Card>
        </TabsContent>

        {/* Providers */}
        <TabsContent value="providers" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
            {providers.map(p => (
              <ProviderCard
                key={p.slug}
                provider={p}
                onTest={handleTest}
                testing={testing[p.slug]}
                testResult={testResults[p.slug]}
              />
            ))}
          </div>

          {/* Config Guide */}
          <Card className="rounded-2xl border border-border mt-6">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Code className="w-5 h-5 text-primary" />
                Como configurar
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="space-y-3">
                <div>
                  <p className="font-medium mb-1">🤖 OpenAI</p>
                  <p className="text-muted-foreground">Obtenha sua chave em <code className="font-mono text-xs">platform.openai.com/api-keys</code>. Secret: <code className="font-mono text-xs">OPENAI_API_KEY</code></p>
                </div>
                <div>
                  <p className="font-medium mb-1">🧠 Anthropic Claude</p>
                  <p className="text-muted-foreground">Obtenha em <code className="font-mono text-xs">console.anthropic.com</code>. Secret: <code className="font-mono text-xs">ANTHROPIC_API_KEY</code></p>
                </div>
                <div>
                  <p className="font-medium mb-1">⚡ Groq (Llama ultra-rápido)</p>
                  <p className="text-muted-foreground">Obtenha em <code className="font-mono text-xs">console.groq.com</code>. Secret: <code className="font-mono text-xs">GROQ_API_KEY</code></p>
                </div>
                <div>
                  <p className="font-medium mb-1">🦙 Together AI</p>
                  <p className="text-muted-foreground">Obtenha em <code className="font-mono text-xs">api.together.xyz</code>. Secret: <code className="font-mono text-xs">TOGETHER_API_KEY</code></p>
                </div>
                <div>
                  <p className="font-medium mb-1">🏠 Ollama (IA local)</p>
                  <p className="text-muted-foreground">Instale em <code className="font-mono text-xs">ollama.com</code> e configure a URL. Secret: <code className="font-mono text-xs">OLLAMA_URL</code> (ex: <code className="font-mono text-xs">http://localhost:11434</code>)</p>
                </div>
                <div>
                  <p className="font-medium mb-1">✨ Google Gemini (built-in)</p>
                  <p className="text-muted-foreground">Sem configuração — usa a integração nativa do Base44 (InvokeLLM).</p>
                </div>
              </div>
              <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                <p className="font-medium mb-1">💡 Roteamento automático</p>
                Use <code className="font-mono">aiRoute(&#123; messages &#125;)</code> para enviar a mensagem para o primeiro provedor disponível, na ordem: OpenAI → Claude → Groq → Together → Gemini → Ollama.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logs */}
        <TabsContent value="logs" className="mt-6">
          <Card className="rounded-2xl border border-border overflow-hidden">
            <CardHeader className="border-b border-border/60 py-3 px-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Code className="w-4 h-4 text-muted-foreground" />
                Chamadas Recentes ({aiLogs.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {aiLogs.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground">
                  <Code className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  <p>Nenhuma chamada registrada.</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {aiLogs.slice(0, 50).map(log => (
                    <div key={log.id} className="px-5 py-3 hover:bg-muted/20 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          {log.ok ? (
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-red-500" />
                          )}
                          <span className="text-sm font-medium capitalize">{log.service}</span>
                          <Badge variant="outline" className="text-xs">{log.action}</Badge>
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
      </Tabs>
    </div>
  );
}