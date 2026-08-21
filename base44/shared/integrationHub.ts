// base44/shared/integrationHub.ts
// Helper centralizado para o Integration Hub.
// Verifica se a integração está habilitada, executa a chamada HTTP e registra log.
//
// Uso em backend functions:
//   import { callIntegration, getIntegration, logCall } from "../../shared/integrationHub.ts";
//   const result = await callIntegration("zapsign", "createDocumentUpload", base44, async (integration) => {
//     const resp = await fetch(`${integration.base_url}/docs/`, { ... });
//     return { response_status: resp.status, response_payload: await resp.json() };
//   });

import { secrets } from "base44:runtime";

// Mapa: slug → nome(s) de secret(s) necessários
const SECRETS_MAP: Record<string, string | string[]> = {
  zapsign: "ZAPSIGN_API_TOKEN",
  clicksign: "CLICKSIGN_ACCESS_TOKEN",
  omie: ["OMIE_APP_KEY", "OMIE_APP_SECRET"],
  ixcsoft: "IXCSOFT_TOKEN",
  "evolution-api": ["EVOLUTION_API_GLOBAL_KEY", "EVOLUTION_API_INSTANCE_KEY"],
  openai: "OPENAI_API_KEY",
  claude: "ANTHROPIC_API_KEY",
  pagcard: "PAGCARD_API_KEY",
};

/** Busca a configuração da integração pelo slug no catálogo */
export async function getIntegration(slug: string, base44: any) {
  const results = await base44.asServiceRole.entities.Integration.filter({ slug });
  return results[0] || null;
}

/** Retorna o valor do secret (ou array de valores) para uma integração */
export function getSecret(slug: string): string | string[] | null {
  const key = SECRETS_MAP[slug];
  if (!key) return null;
  if (Array.isArray(key)) {
    return key.map((k) => secrets.get(k)).filter(Boolean);
  }
  return secrets.get(key);
}

/** Verifica se o secret da integração está configurado */
export function hasSecret(slug: string): boolean {
  const val = getSecret(slug);
  if (Array.isArray(val)) return val.length > 0;
  return Boolean(val);
}

/** Registra uma chamada no IntegrationLog (sempre — sucesso ou erro) */
export async function logCall(
  slug: string,
  action: string,
  base44: any,
  data: {
    method?: string;
    request_payload?: any;
    response_status?: number;
    response_payload?: any;
    error_message?: string;
    duration_ms?: number;
    ok?: boolean;
  }
) {
  try {
    await base44.asServiceRole.entities.IntegrationLog.create({
      pedido_id: "",
      service: slug,
      step: action,
      integration_slug: slug,
      action,
      method: data.method || "",
      request: data.request_payload || {},
      request_payload: data.request_payload || {},
      response: data.response_payload || {},
      response_payload: data.response_payload || {},
      response_status: data.response_status,
      ok: data.ok !== false,
      error_message: data.error_message || "",
      duration_ms: data.duration_ms || 0,
    });
  } catch (_) {
    // logging não deve quebrar o fluxo
  }
}

/**
 * Orquestra uma chamada de integração:
 * 1. Verifica se a integração está habilitada
 * 2. Executa a função passada (que faz o fetch real)
 * 3. Registra o resultado no IntegrationLog
 * 4. Retorna o resultado ou erro
 */
export async function callIntegration(
  slug: string,
  action: string,
  base44: any,
  fetchFn: (integration: any) => Promise<{
    method?: string;
    request_payload?: any;
    response_status: number;
    response_payload: any;
    ok?: boolean;
  }>
): Promise<any> {
  const integration = await getIntegration(slug, base44);
  if (!integration || !integration.enabled) {
    return { error: "integração desabilitada", status: 409 };
  }

  const start = Date.now();
  try {
    const result = await fetchFn(integration);
    const duration = Date.now() - start;
    await logCall(slug, action, base44, { ...result, duration_ms: duration, ok: true });
    return result;
  } catch (e: any) {
    const duration = Date.now() - start;
    await logCall(slug, action, base44, {
      error_message: e.message,
      duration_ms: duration,
      ok: false,
    });
    throw e;
  }
}