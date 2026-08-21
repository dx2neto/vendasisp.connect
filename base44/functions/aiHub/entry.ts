// base44/functions/aiHub/entry.ts
// Hub de IA unificado — roteia chamadas para múltiplos provedores:
// OpenAI, Anthropic Claude, Groq (Llama), Together AI, Ollama (local) e Gemini (built-in).
//
// Uso (SDK frontend):
//   base44.functions.invoke("aiHub", { acao: "chat", provider: "openai", model: "gpt-4o", messages: [...] })
//   base44.functions.invoke("aiHub", { acao: "test", provider: "anthropic" })
//   base44.functions.invoke("aiHub", { acao: "models", provider: "groq" })
//   base44.functions.invoke("aiHub", { acao: "providers" })

import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

// ════════════════════════════════════════════════════════════════════════
// CONFIGURAÇÃO DOS PROVEDORES
// ════════════════════════════════════════════════════════════════════════

interface ProviderConfig {
  name: string;
  base_url: string;
  secret_key: string | null;
  type: "openai" | "anthropic" | "ollama" | "builtin";
  models: { id: string; name: string; context: number }[];
}

const PROVIDERS: Record<string, ProviderConfig> = {
  openai: {
    name: "OpenAI",
    base_url: "https://api.openai.com/v1",
    secret_key: "OPENAI_API_KEY",
    type: "openai",
    models: [
      { id: "gpt-4o", name: "GPT-4o", context: 128000 },
      { id: "gpt-4o-mini", name: "GPT-4o Mini", context: 128000 },
      { id: "gpt-4-turbo", name: "GPT-4 Turbo", context: 128000 },
      { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", context: 16385 },
    ],
  },
  anthropic: {
    name: "Anthropic Claude",
    base_url: "https://api.anthropic.com/v1",
    secret_key: "ANTHROPIC_API_KEY",
    type: "anthropic",
    models: [
      { id: "claude-3-opus-20240229", name: "Claude 3 Opus", context: 200000 },
      { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", context: 200000 },
      { id: "claude-3-haiku-20240307", name: "Claude 3 Haiku", context: 200000 },
    ],
  },
  groq: {
    name: "Groq (Llama)",
    base_url: "https://api.groq.com/openai/v1",
    secret_key: "GROQ_API_KEY",
    type: "openai",
    models: [
      { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", context: 128000 },
      { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B", context: 128000 },
      { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B", context: 32768 },
    ],
  },
  together: {
    name: "Together AI",
    base_url: "https://api.together.xyz/v1",
    secret_key: "TOGETHER_API_KEY",
    type: "openai",
    models: [
      { id: "meta-llama/Llama-3-70b-chat-hf", name: "Llama 3 70B", context: 8192 },
      { id: "meta-llama/Llama-3-8b-chat-hf", name: "Llama 3 8B", context: 8192 },
    ],
  },
  ollama: {
    name: "Ollama (Local)",
    base_url: "http://localhost:11434",
    secret_key: "OLLAMA_URL",
    type: "ollama",
    models: [
      { id: "llama3", name: "Llama 3 (Local)", context: 8192 },
      { id: "mistral", name: "Mistral (Local)", context: 8192 },
      { id: "phi3", name: "Phi 3 (Local)", context: 4096 },
    ],
  },
  gemini: {
    name: "Google Gemini",
    base_url: "",
    secret_key: null,
    type: "builtin",
    models: [
      { id: "automatic", name: "Automático", context: 0 },
      { id: "gemini_3_flash", name: "Gemini 3 Flash", context: 0 },
      { id: "gemini_3_1_pro", name: "Gemini 3.1 Pro", context: 0 },
    ],
  },
};

// ════════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════════

function getSecret(key: string | null): string {
  if (!key) return "";
  return Deno.env.get(key) || "";
}

function providerStatus(provider: string): { configured: boolean; has_secret: boolean } {
  const cfg = PROVIDERS[provider];
  if (!cfg) return { configured: false, has_secret: false };
  if (cfg.type === "builtin") return { configured: true, has_secret: true };
  const val = getSecret(cfg.secret_key);
  return { configured: Boolean(val), has_secret: Boolean(val) };
}

// ════════════════════════════════════════════════════════════════════════
// CHAT — OpenAI-compatible (OpenAI, Groq, Together)
// ════════════════════════════════════════════════════════════════════════

async function chatOpenAICompatible(
  base_url: string,
  api_key: string,
  model: string,
  messages: any[],
  options: any
): Promise<{ content: string; model: string; usage: any }> {
  const resp = await fetch(`${base_url}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${api_key}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 1000,
    }),
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data.error?.message || data.error || `HTTP ${resp.status}`);
  }
  return {
    content: data.choices[0].message.content,
    model: data.model,
    usage: data.usage,
  };
}

// ════════════════════════════════════════════════════════════════════════
// CHAT — Anthropic Claude
// ════════════════════════════════════════════════════════════════════════

async function chatAnthropic(
  api_key: string,
  model: string,
  messages: any[],
  options: any
): Promise<{ content: string; model: string; usage: any }> {
  // Claude usa system separado do messages
  const systemMsg = messages.find((m: any) => m.role === "system");
  const chatMessages = messages.filter((m: any) => m.role !== "system");

  const body: any = {
    model,
    messages: chatMessages,
    max_tokens: options.max_tokens ?? 1000,
    temperature: options.temperature ?? 0.7,
  };
  if (systemMsg) body.system = systemMsg.content;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": api_key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data.error?.message || data.error || `HTTP ${resp.status}`);
  }
  return {
    content: data.content[0]?.text || "",
    model: data.model,
    usage: data.usage,
  };
}

// ════════════════════════════════════════════════════════════════════════
// CHAT — Ollama (local)
// ════════════════════════════════════════════════════════════════════════

async function chatOllama(
  base_url: string,
  model: string,
  messages: any[],
  options: any
): Promise<{ content: string; model: string; usage: any }> {
  const resp = await fetch(`${base_url}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      options: {
        temperature: options.temperature ?? 0.7,
        num_predict: options.max_tokens ?? 1000,
      },
    }),
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data.error || `HTTP ${resp.status}`);
  }
  return {
    content: data.message?.content || "",
    model: data.model,
    usage: { total_duration: data.total_duration, eval_count: data.eval_count },
  };
}

// ════════════════════════════════════════════════════════════════════════
// CHAT — Built-in InvokeLLM (Gemini)
// ════════════════════════════════════════════════════════════════════════

async function chatBuiltin(
  base44: any,
  model: string,
  messages: any[],
  options: any
): Promise<{ content: string; model: string; usage: any }> {
  const prompt = messages.map((m: any) => `[${m.role}]: ${m.content}`).join("\n\n");
  const result: any = await base44.integrations.Core.InvokeLLM({
    prompt,
    model: model || "automatic",
  });
  const content = typeof result === "string" ? result : result.response || result.content || JSON.stringify(result);
  return { content, model: model || "automatic", usage: null };
}

// ════════════════════════════════════════════════════════════════════════
// LOG
// ════════════════════════════════════════════════════════════════════════

async function logAI(base44: any, provider: string, action: string, data: any) {
  try {
    await base44.asServiceRole.entities.IntegrationLog.create({
      service: provider as any,
      step: action,
      integration_slug: provider,
      action,
      method: "POST",
      request_payload: data.request_payload || {},
      request: data.request_payload || {},
      response_payload: data.response_payload || {},
      response: data.response_payload || {},
      response_status: data.response_status,
      ok: data.ok !== false,
      error_message: data.error_message || "",
      duration_ms: data.duration_ms || 0,
    });
  } catch (_) { /* ignore */ }
}

// ════════════════════════════════════════════════════════════════════════
// HANDLER PRINCIPAL
// ════════════════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  const start = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });

    let body: any = {};
    try { body = await req.json(); } catch { /* sem body */ }
    const { acao } = body;

    // ── Listar provedores ──
    if (acao === "providers") {
      const list = Object.entries(PROVIDERS).map(([slug, cfg]) => ({
        slug,
        name: cfg.name,
        type: cfg.type,
        models: cfg.models,
        ...providerStatus(slug),
      }));
      return Response.json({ providers: list });
    }

    // ── Listar modelos de um provedor ──
    if (acao === "models") {
      const { provider } = body;
      const cfg = PROVIDERS[provider];
      if (!cfg) return Response.json({ error: "Provedor não encontrado" }, { status: 400 });
      return Response.json({ provider, name: cfg.name, models: cfg.models, ...providerStatus(provider) });
    }

    // ── Testar conexão ──
    if (acao === "test") {
      const { provider } = body;
      const cfg = PROVIDERS[provider];
      if (!cfg) return Response.json({ ok: false, error: "Provedor não encontrado" });

      const status = providerStatus(provider);
      if (!status.configured) {
        return Response.json({ ok: false, error: `Secret ${cfg.secret_key} não configurado` });
      }

      // Para builtin, sempre OK
      if (cfg.type === "builtin") {
        return Response.json({ ok: true, provider: cfg.name, message: "Integração built-in ativa" });
      }

      // Para Ollama, testa listando modelos
      if (cfg.type === "ollama") {
        const url = getSecret(cfg.secret_key) || cfg.base_url;
        try {
          const resp = await fetch(`${url}/api/tags`);
          const data = await resp.json();
          return Response.json({ ok: resp.ok, provider: cfg.name, models: data.models || [], url });
        } catch (e: any) {
          return Response.json({ ok: false, error: `Ollama indisponível: ${e.message}` });
        }
      }

      // Para OpenAI-compatible e Anthropic, faz um chat mínimo
      try {
        const apiKey = getSecret(cfg.secret_key);
        const testMessages = [{ role: "user", content: "Hi" }];
        let result;
        if (cfg.type === "anthropic") {
          result = await chatAnthropic(apiKey, cfg.models[0].id, testMessages, { max_tokens: 5 });
        } else {
          result = await chatOpenAICompatible(cfg.base_url, apiKey, cfg.models[0].id, testMessages, { max_tokens: 5 });
        }
        return Response.json({ ok: true, provider: cfg.name, model: result.model, response: result.content.slice(0, 50) });
      } catch (e: any) {
        return Response.json({ ok: false, error: e.message });
      }
    }

    // ── Chat ──
    if (acao === "chat") {
      const { provider, model, messages, temperature, max_tokens } = body;
      const cfg = PROVIDERS[provider];
      if (!cfg) return Response.json({ error: "Provedor não encontrado" }, { status: 400 });
      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return Response.json({ error: "messages obrigatório" }, { status: 400 });
      }

      const status = providerStatus(provider);
      if (!status.configured) {
        return Response.json({ error: `${cfg.name} não configurado. Configure o secret ${cfg.secret_key}.` }, { status: 503 });
      }

      const options = { temperature, max_tokens };
      const selectedModel = model || cfg.models[0].id;

      try {
        let result;
        switch (cfg.type) {
          case "anthropic":
            result = await chatAnthropic(getSecret(cfg.secret_key), selectedModel, messages, options);
            break;
          case "ollama": {
            const url = getSecret(cfg.secret_key) || cfg.base_url;
            result = await chatOllama(url, selectedModel, messages, options);
            break;
          }
          case "builtin":
            result = await chatBuiltin(base44, selectedModel, messages, options);
            break;
          default:
            result = await chatOpenAICompatible(cfg.base_url, getSecret(cfg.secret_key), selectedModel, messages, options);
        }

        const duration = Date.now() - start;
        await logAI(base44, provider, "chat", {
          request_payload: { provider, model: selectedModel, message_count: messages.length },
          response_payload: { content_length: result.content.length, model: result.model },
          ok: true,
          duration_ms: duration,
        });

        return Response.json({
          ok: true,
          provider: cfg.name,
          model: result.model,
          content: result.content,
          usage: result.usage,
          duration_ms: duration,
        });
      } catch (e: any) {
        const duration = Date.now() - start;
        await logAI(base44, provider, "chat", {
          request_payload: { provider, model: selectedModel },
          error_message: e.message,
          ok: false,
          duration_ms: duration,
        });
        return Response.json({ ok: false, error: e.message }, { status: 500 });
      }
    }

    // ── Roteamento automático (escolhe o primeiro provedor disponível) ──
    if (acao === "route") {
      const { messages, temperature, max_tokens } = body;
      const preferred = ["openai", "anthropic", "groq", "together", "gemini", "ollama"];
      for (const p of preferred) {
        const status = providerStatus(p);
        if (status.configured) {
          const cfg = PROVIDERS[p];
          const selectedModel = cfg.models[0].id;
          try {
            let result;
            switch (cfg.type) {
              case "anthropic":
                result = await chatAnthropic(getSecret(cfg.secret_key), selectedModel, messages, { temperature, max_tokens });
                break;
              case "ollama": {
                const url = getSecret(cfg.secret_key) || cfg.base_url;
                result = await chatOllama(url, selectedModel, messages, { temperature, max_tokens });
                break;
              }
              case "builtin":
                result = await chatBuiltin(base44, selectedModel, messages, { temperature, max_tokens });
                break;
              default:
                result = await chatOpenAICompatible(cfg.base_url, getSecret(cfg.secret_key), selectedModel, messages, { temperature, max_tokens });
            }
            const duration = Date.now() - start;
            await logAI(base44, p, "route", {
              request_payload: { message_count: messages?.length },
              response_payload: { content_length: result.content.length },
              ok: true,
              duration_ms: duration,
            });
            return Response.json({
              ok: true,
              provider: cfg.name,
              provider_slug: p,
              model: result.model,
              content: result.content,
              usage: result.usage,
              duration_ms: duration,
            });
          } catch (e: any) {
            continue; // tenta próximo provedor
          }
        }
      }
      return Response.json({ error: "Nenhum provedor de IA configurado" }, { status: 503 });
    }

    return Response.json({ error: `Ação desconhecida: ${acao}` }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});