// functions/ixcClient.js
// Helper compartilhado para a API IXCsoft (webservice v1).
// Importe nas demais functions:  import { ixcList, ixcInsert, ixcUpdate, onlyDigits } from "./ixcClient.js";
//
// SECRETS necessários (Configurações do app > Secrets):
//   IXC_HOST   -> ex: https://meuprovedor.ixc.com.br   (SEM barra no final)
//   IXC_TOKEN  -> token gerado no IXC no formato  "28:hashlongo..."  (id:hash)

const IXC_HOST = (Deno.env.get("IXC_HOST") || "")
  .replace(/\/+$/, "")
  .replace(/\/webservice\/v1$/i, "");
const IXC_TOKEN = Deno.env.get("IXC_TOKEN") || "";
const IXC_AUTH_BASIC = (Deno.env.get("IXC_AUTH_BASIC") || "").replace(/^Basic\s+/i, "");

export function ixcConfigOk() {
  return Boolean(IXC_HOST && (IXC_TOKEN || IXC_AUTH_BASIC));
}

function authHeader() {
  // O token IXC já vem no formato id:hash — basta base64.
  return "Basic " + (IXC_AUTH_BASIC || btoa(IXC_TOKEN));
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
  if (!ixcConfigOk()) throw new Error("IXC_HOST/IXC_TOKEN não configurados");
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

  const res = await fetch(`${IXC_HOST}/webservice/v1/${table}`, {
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
  if (!ixcConfigOk()) throw new Error("IXC_HOST/IXC_TOKEN não configurados");
  const res = await fetch(`${IXC_HOST}/webservice/v1/${table}`, {
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
  if (!ixcConfigOk()) throw new Error("IXC_HOST/IXC_TOKEN não configurados");
  const res = await fetch(`${IXC_HOST}/webservice/v1/${table}/${id}`, {
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
  if (!ixcConfigOk()) throw new Error("IXC_HOST/IXC_TOKEN não configurados");
  const res = await fetch(`${IXC_HOST}/webservice/v1/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader() },
    body: JSON.stringify(payload),
  });
  const data = await parse(res);
  if (!res.ok) throw new Error(`IXC/${endpoint} respondeu HTTP ${res.status}: ${data?.message || data?.error || 'falha na ação'}`);
  return data;
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
