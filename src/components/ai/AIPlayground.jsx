import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, Sparkles, User, Bot, Trash2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { aiChat } from "@/lib/aiClient";

const PROVIDER_ICONS = {
  openai: "🤖",
  anthropic: "🧠",
  groq: "⚡",
  together: "🦙",
  ollama: "🏠",
  gemini: "✨",
};

export default function AIPlayground({ providers }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState("gemini");
  const [model, setModel] = useState("automatic");
  const [systemPrompt, setSystemPrompt] = useState("Você é um assistente útil do sistema CRM.");
  const scrollRef = useRef(null);

  const configuredProviders = providers.filter(p => p.configured);

  useEffect(() => {
    if (configuredProviders.length > 0 && !configuredProviders.find(p => p.slug === provider)) {
      setProvider(configuredProviders[0].slug);
      setModel(configuredProviders[0].models[0]?.id || "");
    }
  }, [providers]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const currentProvider = providers.find(p => p.slug === provider);
  const availableModels = currentProvider?.models || [];

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg = { role: "user", content: input.trim() };
    const allMessages = systemPrompt
      ? [{ role: "system", content: systemPrompt }, ...messages, userMsg]
      : [...messages, userMsg];

    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const result = await aiChat({
        provider,
        model,
        messages: allMessages,
        temperature: 0.7,
        max_tokens: 2000,
      });

      if (result.ok) {
        setMessages(prev => [...prev, { role: "assistant", content: result.content, model: result.model, provider: result.provider }]);
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: `❌ Erro: ${result.error}`, error: true }]);
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: "assistant", content: `❌ Erro: ${e.message}`, error: true }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setInput("");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-280px)] min-h-[400px]">
      {/* Barra de configuração */}
      <div className="flex flex-wrap items-center gap-2 mb-3 pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground">Provedor:</label>
          <select
            value={provider}
            onChange={e => {
              setProvider(e.target.value);
              const p = providers.find(p => p.slug === e.target.value);
              setModel(p?.models[0]?.id || "");
            }}
            className="text-xs rounded-lg border border-input bg-transparent px-2 py-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {providers.map(p => (
              <option key={p.slug} value={p.slug} disabled={!p.configured}>
                {PROVIDER_ICONS[p.slug]} {p.name} {!p.configured && "(não configurado)"}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground">Modelo:</label>
          <select
            value={model}
            onChange={e => setModel(e.target.value)}
            className="text-xs rounded-lg border border-input bg-transparent px-2 py-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {availableModels.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        <Button variant="ghost" size="sm" onClick={clearChat} className="ml-auto gap-1.5 text-xs">
          <Trash2 className="w-3 h-3" /> Limpar
        </Button>
      </div>

      {/* System prompt */}
      <div className="mb-3">
        <details className="group">
          <summary className="text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> System Prompt
          </summary>
          <Textarea
            value={systemPrompt}
            onChange={e => setSystemPrompt(e.target.value)}
            rows={2}
            className="mt-2 text-xs"
            placeholder="Defina o comportamento da IA..."
          />
        </details>
      </div>

      {/* Área de mensagens */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 pr-1">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
              <Sparkles className="w-7 h-7 text-primary" />
            </div>
            <p className="text-sm font-medium">Playground de IA</p>
            <p className="text-xs mt-1 max-w-xs">Selecione um provedor, escreva uma mensagem e converse com a IA</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-primary" />
              </div>
            )}
            <div className={cn(
              "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm",
              msg.role === "user"
                ? "bg-primary text-primary-foreground"
                : msg.error
                ? "bg-red-50 text-red-700 border border-red-200"
                : "bg-muted"
            )}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.role === "assistant" && !msg.error && msg.provider && (
                <div className="mt-1.5 pt-1.5 border-t border-border/30">
                  <Badge variant="outline" className="text-[10px] gap-1 py-0">
                    {PROVIDER_ICONS[msg.provider?.toLowerCase()] || "🤖"} {msg.provider} • {msg.model}
                  </Badge>
                </div>
              )}
            </div>
            {msg.role === "user" && (
              <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-secondary-foreground" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
            </div>
            <div className="bg-muted rounded-2xl px-4 py-2.5 text-sm text-muted-foreground">
              Processando...
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="mt-3 flex gap-2 items-end">
        <Textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Escreva sua mensagem... (Enter para enviar, Shift+Enter para nova linha)"
          className="resize-none min-h-[44px] max-h-32"
          disabled={loading}
        />
        <Button onClick={handleSend} disabled={loading || !input.trim()} className="gap-2 rounded-xl h-11 px-4">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>

      {/* Hint de roteamento automático */}
      <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Zap className="w-3 h-3" />
        Use o endpoint <code className="font-mono">aiRoute()</code> para rotear automaticamente para o melhor provedor disponível
      </div>
    </div>
  );
}