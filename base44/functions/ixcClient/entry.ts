// functions/ixcClient/entry.ts
// Helper compartilhado para a API IXCsoft (webservice v1).
// Importe nas demais functions:  import { ixcList, ixcInsert, ixcUpdate, ixcAction, ixcBuscarCidade, ixcConfigOk, getIxcConfig } from "./ixcClient/entry.ts";
//
// SECRETS (Configurações do app > Secrets):
//   IXC_API_URL      -> URL base da API (ex: https://sistema.cnnct.net.br/webservice/v1/)
//   IXC_ADMIN_TOKEN  -> token Base64 no formato id:hash (já codificado, pronto para Basic auth)
//
// Compatibilidade reversa: se IXC_API_URL não estiver definido, usa IXC_HOST (legacy).

/** Retorna a URL base da API e o header de autenticação prontos para uso. */
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

function authHeader() {
  const { auth } = getIxcConfig();
  return `Basic ${auth}`;
}

function apiUrl() {
  const { apiUrl } = getIxcConfig();
  return apiUrl;
}

export const onlyDigits = (v) => (v ? String(v).replace(/\D/g, "") : "");

async function parse(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    // IXC às vezes devolve PDF/base64 ou string crua
    return { _raw: text, _status: res.status };
  }
}

/**
 * Lista registros de uma tabela do IXC.
 * @param {string} table  ex: "cliente", "filial", "cliente_contrato"
 * @param {object} p      { qtype, query, oper, page, rp, sortname, sortorder, grid_param }
 * @returns {Promise<{total:number, registros:any[]}>}
 */
export async function ixcList(table, p = {}) {
  if (!ixcConfigOk()) throw new Error("IXC_API_URL/IXC_ADMIN_TOKEN não configurados");
  const body = {
    qtype: p.qtype || `${table}.id`,
    query: p.query ?? "",
    oper: p.oper || "=",
    page: String(p.page || 1),
    rp: String(p.rp || 100),
    sortname: p.sortname || `${table}.id`,
    sortorder: p.sortorder || "asc",
  };
  if (p.grid_param) body.grid_param = p.grid_param; // filtros avançados (JSON string)

  const res = await fetch(`${apiUrl()}/${table}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(),
      ixcsoft: "listar",
    },
    body: JSON.stringify(body),
  });
  const data = await parse(res);
  if (!res.ok) {
    throw new Error(`IXC/${table} respondeu HTTP ${res.status}: ${data?.message || data?.error || 'falha na consulta'}`);
  }
  return {
    total: Number(data?.total || 0),
    registros: Array.isArray(data?.registros) ? data.registros : [],
    _raw: data,
  };
}

/** Insere um registro. Retorna { type:"success", id, message }. */
export async function ixcInsert(table, record) {
  if (!ixcConfigOk()) throw new Error("IXC_API_URL/IXC_ADMIN_TOKEN não configurados");
  const res = await fetch(`${apiUrl()}/${table}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader() },
    body: JSON.stringify(record),
  });
  const data = await parse(res);
  if (!res.ok) throw new Error(`IXC/${table} respondeu HTTP ${res.status}: ${data?.message || data?.error || 'falha ao inserir'}`);
  return data;
}

/** Atualiza um registro pelo id (PUT). */
export async function ixcUpdate(table, id, record) {
  if (!ixcConfigOk()) throw new Error("IXC_API_URL/IXC_ADMIN_TOKEN não configurados");
  const res = await fetch(`${apiUrl()}/${table}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: authHeader() },
    body: JSON.stringify({ id, ...record }),
  });
  const data = await parse(res);
  if (!res.ok) throw new Error(`IXC/${table} respondeu HTTP ${res.status}: ${data?.message || data?.error || 'falha ao atualizar'}`);
  return data;
}

/** Chama endpoints utilitários do IXC (get_boleto, get_pix, etc). */
export async function ixcAction(endpoint, payload) {
  if (!ixcConfigOk()) throw new Error("IXC_API_URL/IXC_ADMIN_TOKEN não configurados");
  const res = await fetch(`${apiUrl()}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader() },
    body: JSON.stringify(payload),
  });
  const data = await parse(res);
  if (!res.ok) throw new Error(`IXC/${endpoint} respondeu HTTP ${res.status}: ${data?.message || data?.error || 'falha na ação'}`);
  return data;
}

/**
 * Requisição genérica para a API IXC.
 * @param {string} method  HTTP method (POST, PUT, GET, DELETE)
 * @param {string} endpoint  ex: "cliente", "filial", "cliente_contrato/123"
 * @param {object|null} body  payload JSON
 * @param {string} operation  valor do header ixcsoft (listar, incluir, alterar)
 * @returns {Promise<{ok:boolean, status:number, data:any}>}
 */
export async function ixcRequest(method, endpoint, body = null, operation = "listar") {
  if (!ixcConfigOk()) throw new Error("IXC_API_URL/IXC_ADMIN_TOKEN não configurados");
  const url = `${apiUrl()}/${endpoint}`;
  const opts = {
    method,
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      ixcsoft: operation,
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const resp = await fetch(url, opts);
  const text = await resp.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { message: text || `HTTP ${resp.status}` }; }
  return { ok: resp.ok, status: resp.status, data };
}

/** Procura o id da cidade no IXC por nome (+UF opcional). */
export async function ixcBuscarCidade(nome, uf) {
  if (!nome) return null;
  const r = await ixcList("cidade", {
    qtype: "cidade.nome",
    query: nome,
    oper: "L", // LIKE
    rp: 10,
  });
  let reg = r.registros;
  if (uf) reg = reg.filter((c) => (c.uf || "").toUpperCase() === uf.toUpperCase()) || reg;
  return reg[0]?.id || null;
}