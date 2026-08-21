// src/lib/aiClient.js
// Helper frontend para chamadas ao Hub de IA.

import { base44 } from "@/api/base44Client";

export async function aiChat({ provider, model, messages, temperature, max_tokens }) {
  const res = await base44.functions.invoke("aiHub", {
    acao: "chat",
    provider,
    model,
    messages,
    temperature,
    max_tokens,
  });
  return res.data;
}

export async function aiRoute({ messages, temperature, max_tokens }) {
  const res = await base44.functions.invoke("aiHub", {
    acao: "route",
    messages,
    temperature,
    max_tokens,
  });
  return res.data;
}

export async function aiTest(provider) {
  const res = await base44.functions.invoke("aiHub", { acao: "test", provider });
  return res.data;
}

export async function aiModels(provider) {
  const res = await base44.functions.invoke("aiHub", { acao: "models", provider });
  return res.data;
}

export async function aiProviders() {
  const res = await base44.functions.invoke("aiHub", { acao: "providers" });
  return res.data?.providers || [];
}