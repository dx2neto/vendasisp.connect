// base44/shared/ixcClient.ts
// Helper compartilhado para a API IXCsoft (webservice v1).
//
// SECRETS (Configurações do app > Secrets):
//   IXC_API_URL      -> URL base da API (ex: https://sistema.cnnct.net.br/webservice/v1/)
//   IXC_ADMIN_TOKEN  -> token Base64 no formato id:hash (já codificado, pronto para Basic auth)
//
// Compatibilidade reversa: se IXC_API_URL não estiver definido, usa IXC_HOST (legacy).

/** Retorna a URL base da API e o token de autenticação prontos para uso. */
export function getIxcConfig() {
  // Novo padrão: IXC_API_URL + IXC_ADMIN_TOKEN
  let apiUrl = (Deno.env.get("IXC_API_URL") || "").replace(/\/+$/, "");

  // Fallback legacy: IXC_HOST (sem /webservice/v1 no final)
  if (!apiUrl) {
    const host = (Deno.env.get("IXC_HOST") || "").replace(/\/+$/, "").replace(/\/webservice\/v1$/i, "");
    if (host) apiUrl = `${host}/webservice/v1`;
  }

  // Token: novo (já base64) ou legacy (IXC_AUTH_BASIC / IXC_TOKEN)
  const adminToken = Deno.env.get("IXC_ADMIN_TOKEN") || "";
  const legacyAuth = (Deno.env.get("IXC_AUTH_BASIC") || "").replace(/^Basic\s+/i, "");
  const legacyToken = Deno.env.get("IXC_TOKEN") || "";
  const auth = adminToken || legacyAuth || (legacyToken ? btoa(legacyToken) : "");

  return { apiUrl, auth };
}

export function ixcConfigOk() {
  const { apiUrl, auth } = getIxcConfig();
  return Boolean(apiUrl && auth);
}

export const onlyDigits = (v: string) => (v ? String(v).replace(/\D/g, "") : "");

async function parse(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text, _status: res.status };
  }
}

export async function ixcList(table: string, p: Record<string, any> = {}) {
  if (!ixcConfigOk()) throw new Error("IXC_API_URL/IXC_ADMIN_TOKEN não configurados");
  const { apiUrl, auth } = getIxcConfig();
  const body = {
    qtype: p.qtype || `${table}.id`,
    query: p.query ?? "",
    oper: p.oper || "=",
    page: String(p.page || 1),
    rp: String(p.rp || 100),
    sortname: p.sortname || `${table}.id`,
    sortorder: p.sortorder || "asc",
  };
  if (p.grid_param) body.grid_param = p.grid_param;

  const res = await fetch(`${apiUrl}/${table}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
      ixcsoft: "listar",
    },
    body: JSON.stringify(body),
  });
  const data: any = await parse(res);
  if (!res.ok) {
    throw new Error(`IXC/${table} respondeu HTTP ${res.status}: ${data?.message || data?.error || 'falha na consulta'}`);
  }
  return {
    total: Number(data?.total || 0),
    registros: Array.isArray(data?.registros) ? data.registros : [],
    _raw: data,
  };
}

export async function ixcInsert(table: string, record: Record<string, any>) {
  if (!ixcConfigOk()) throw new Error("IXC_API_URL/IXC_ADMIN_TOKEN não configurados");
  const { apiUrl, auth } = getIxcConfig();
  const res = await fetch(`${apiUrl}/${table}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
    body: JSON.stringify(record),
  });
  const data: any = await parse(res);
  if (!res.ok) throw new Error(`IXC/${table} respondeu HTTP ${res.status}: ${data?.message || data?.error || 'falha ao inserir'}`);
  return data;
}

export async function ixcUpdate(table: string, id: string, record: Record<string, any>) {
  if (!ixcConfigOk()) throw new Error("IXC_API_URL/IXC_ADMIN_TOKEN não configurados");
  const { apiUrl, auth } = getIxcConfig();
  const res = await fetch(`${apiUrl}/${table}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
    body: JSON.stringify({ id, ...record }),
  });
  const data: any = await parse(res);
  if (!res.ok) throw new Error(`IXC/${table} respondeu HTTP ${res.status}: ${data?.message || data?.error || 'falha ao atualizar'}`);
  return data;
}

export async function ixcAction(endpoint: string, payload: Record<string, any>) {
  if (!ixcConfigOk()) throw new Error("IXC_API_URL/IXC_ADMIN_TOKEN não configurados");
  const { apiUrl, auth } = getIxcConfig();
  const res = await fetch(`${apiUrl}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
    body: JSON.stringify(payload),
  });
  const data: any = await parse(res);
  if (!res.ok) throw new Error(`IXC/${endpoint} respondeu HTTP ${res.status}: ${data?.message || data?.error || 'falha na ação'}`);
  return data;
}

export async function ixcRequest(method: string, endpoint: string, body: Record<string, any> | null = null, operation = "listar") {
  if (!ixcConfigOk()) throw new Error("IXC_API_URL/IXC_ADMIN_TOKEN não configurados");
  const { apiUrl, auth } = getIxcConfig();
  const url = `${apiUrl}/${endpoint}`;
  const opts: any = {
    method,
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
      ixcsoft: operation,
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const resp = await fetch(url, opts);
  const text = await resp.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { message: text || `HTTP ${resp.status}` }; }
  return { ok: resp.ok, status: resp.status, data };
}

export async function ixcBuscarCidade(nome: string, uf?: string) {
  if (!nome) return null;
  const r = await ixcList("cidade", {
    qtype: "cidade.nome",
    query: nome,
    oper: "L",
    rp: 10,
  });
  let reg = r.registros;
  if (uf) reg = reg.filter((c) => (c.uf || "").toUpperCase() === uf.toUpperCase()) || reg;
  return reg[0]?.id || null;
}