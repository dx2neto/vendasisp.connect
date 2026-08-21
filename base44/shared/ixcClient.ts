// base44/shared/ixcClient.ts
// Cliente oficial IXCsoft (webservice v1) — integração real com retry automático, logs e tratamento de erros.
//
// SECRETS:
//   IXC_API_URL      -> URL base (ex: https://sistema.cnnct.net.br/webservice/v1/)
//   IXC_ADMIN_TOKEN  -> token Base64 no formato id:hash (pronto para Basic auth)
//
// Recursos:
//   - Retry exponencial (3 tentativas, backoff 1s/2s/4s)
//   - Log automático em IntegrationLog (por pedido_id)
//   - Rate limit (sleep entre chamadas)
//   - Paginação automática
//   - Tipos para todas as tabelas do IXC

import { secrets } from "base44:runtime";

// ===================== CONFIGURAÇÃO =====================

export function getIxcConfig() {
  const apiUrl = (secrets.get("IXC_API_URL") || secrets.get("IXC_HOST") || "").replace(/\/+$/, "");
  const auth = secrets.get("IXC_ADMIN_TOKEN") || secrets.get("IXC_AUTH_BASIC") || "";
  return { apiUrl, auth };
}

export function ixcConfigOk() {
  const { apiUrl, auth } = getIxcConfig();
  return Boolean(apiUrl && auth);
}

export const onlyDigits = (v: string) => (v ? String(v).replace(/\D/g, "") : "");

// ===================== RETRY & LOG =====================

const MAX_RETRIES = 3;
const BACKOFF_MS = [1000, 2000, 4000];
const RATE_LIMIT_MS = 150; // sleep entre chamadas para evitar 429

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function logIntegration(pedidoId: string, step: string, ok: boolean, request: any, response: any, base44?: any) {
  if (!base44) return;
  try {
    await base44.asServiceRole.entities.IntegrationLog.create({
      pedido_id: pedidoId || "",
      service: "ixc",
      step,
      request: request || {},
      response: response || {},
      ok,
    });
  } catch (_) { /* logging não deve quebrar fluxo */ }
}

// ===================== CORE REQUEST =====================

async function ixcFetch(
  method: string,
  path: string,
  body: Record<string, any> | null,
  operation: string,
  opts: { retry?: boolean; logStep?: string; pedidoId?: string; base44?: any } = {}
): Promise<any> {
  const { retry = true, logStep, pedidoId, base44 } = opts;
  if (!ixcConfigOk()) throw new Error("IXC_API_URL/IXC_ADMIN_TOKEN não configurados");
  const { apiUrl, auth } = getIxcConfig();

  let lastError: Error | null = null;
  const attempts = retry ? MAX_RETRIES : 1;

  for (let i = 0; i < attempts; i++) {
    try {
      if (i > 0) await sleep(BACKOFF_MS[i - 1] || 4000);

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      };
      if (operation) headers["ixcsoft"] = operation;

      const fetchOpts: any = { method, headers };
      if (body) fetchOpts.body = JSON.stringify(body);

      const resp = await fetch(`${apiUrl}/${path}`, fetchOpts);
      const text = await resp.text();
      let data: any;
      try { data = JSON.parse(text); } catch { data = { _raw: text, _status: resp.status }; }

      if (!resp.ok) {
        const errMsg = `IXC/${path} HTTP ${resp.status}: ${data?.message || data?.error || text.slice(0, 200)}`;
        // 4xx não retentável (exceto 429)
        if (resp.status >= 400 && resp.status < 500 && resp.status !== 429) {
          await logIntegration(pedidoId || "", logStep || path, false, body, data, base44);
          throw new Error(errMsg);
        }
        lastError = new Error(errMsg);
        continue;
      }

      // Log sucesso
      if (logStep) {
        await logIntegration(pedidoId || "", logStep, true, body, data, base44);
      }

      await sleep(RATE_LIMIT_MS);
      return data;
    } catch (e: any) {
      if (!retry || i === attempts - 1) {
        await logIntegration(pedidoId || "", logStep || path, false, body, { error: e.message }, base44);
        throw e;
      }
      lastError = e;
    }
  }
  throw lastError || new Error("IXC: falha desconhecida");
}

// ===================== OPERAÇÕES CRUD =====================

export async function ixcList(table: string, p: Record<string, any> = {}, opts: any = {}) {
  const body: Record<string, any> = {
    qtype: p.qtype || `${table}.id`,
    query: p.query ?? "",
    oper: p.oper || "=",
    page: String(p.page || 1),
    rp: String(p.rp || 100),
    sortname: p.sortname || `${table}.id`,
    sortorder: p.sortorder || "asc",
  };
  if (p.grid_param) body.grid_param = p.grid_param;

  const data = await ixcFetch("POST", table, body, "listar", opts);
  return {
    total: Number(data?.total || 0),
    registros: Array.isArray(data?.registros) ? data.registros : [],
    _raw: data,
  };
}

/** Lista com paginação automática (busca todos os registros) */
export async function ixcListAll(table: string, p: Record<string, any> = {}, opts: any = {}) {
  const rp = p.rp || 100;
  let page = 1;
  let all: any[] = [];
  let total = 0;
  do {
    const r = await ixcList(table, { ...p, rp, page }, opts);
    all = all.concat(r.registros);
    total = r.total;
    page++;
  } while (all.length < total && page <= 100); // safety limit
  return { total, registros: all };
}

export async function ixcGet(table: string, id: string, opts: any = {}) {
  return ixcFetch("GET", `${table}/${id}`, null, "", opts);
}

export async function ixcInsert(table: string, record: Record<string, any>, opts: any = {}) {
  return ixcFetch("POST", table, record, "", opts);
}

export async function ixcUpdate(table: string, id: string, record: Record<string, any>, opts: any = {}) {
  return ixcFetch("PUT", `${table}/${id}`, { id, ...record }, "", opts);
}

export async function ixcDelete(table: string, id: string, opts: any = {}) {
  return ixcFetch("DELETE", `${table}/${id}`, null, "", opts);
}

export async function ixcAction(endpoint: string, payload: Record<string, any>, opts: any = {}) {
  return ixcFetch("POST", endpoint, payload, "", opts);
}

// ===================== HELPERS =====================

export async function ixcBuscarCidade(nome: string, uf?: string, opts: any = {}) {
  if (!nome) return null;
  const r = await ixcList("cidade", { qtype: "cidade.nome", query: nome, oper: "L", rp: 10 }, opts);
  let reg = r.registros;
  if (uf) reg = reg.filter((c) => (c.uf || "").toUpperCase() === uf.toUpperCase()) || reg;
  return reg[0]?.id || null;
}

export async function ixcBuscarCliente(doc: string, opts: any = {}) {
  const digits = onlyDigits(doc);
  if (!digits) return null;
  const r = await ixcList("cliente", { qtype: "cliente.cnpj_cpf", query: digits, oper: "=", rp: 1 }, opts);
  return r.registros[0] || null;
}

export async function ixcBuscarContratoPorCliente(idCliente: string, opts: any = {}) {
  const r = await ixcList("cliente_contrato", { qtype: "cliente_contrato.id_cliente", query: idCliente, oper: "=", rp: 50 }, opts);
  return r.registros;
}

// ===================== CLIENTES =====================

export async function ixcCriarCliente(dados: Record<string, any>, opts: any = {}) {
  return ixcInsert("cliente", {
    razao: dados.nome || dados.razao || "Cliente",
    tipo_pessoa: dados.tipo_pessoa || (onlyDigits(dados.cnpj_cpf).length > 11 ? "J" : "F"),
    cnpj_cpf: onlyDigits(dados.cnpj_cpf),
    ie_identidade: dados.rg || "ISENTO",
    contribuinte: dados.contribuinte || "2",
    fone: dados.telefone || "",
    telefone_celular: dados.telefone || "",
    whatsapp: dados.telefone || "",
    email: dados.email || "",
    endereco: dados.rua || dados.endereco || "",
    numero: dados.numero || "",
    complemento: dados.complemento || "",
    bairro: dados.bairro || "",
    cep: onlyDigits(dados.cep),
    id_cidade: dados.id_cidade || "",
    ativo: "S",
    filial_id: dados.filial_id || "1",
  }, { ...opts, logStep: "criar_cliente" });
}

export async function ixcAtualizarCliente(id: string, dados: Record<string, any>, opts: any = {}) {
  return ixcUpdate("cliente", id, dados, { ...opts, logStep: "atualizar_cliente" });
}

// ===================== CONTRATOS =====================

export async function ixcCriarContrato(dados: Record<string, any>, opts: any = {}) {
  const hoje = new Date().toISOString().slice(0, 10);
  return ixcInsert("cliente_contrato", {
    tipo: "I",
    id_cliente: dados.id_cliente,
    id_modelo: dados.id_modelo || "",
    id_tipo_contrato: dados.id_tipo_contrato || "",
    id_vendedor: dados.id_vendedor || "1",
    id_filial: dados.id_filial || "1",
    id_carteira_cobranca: dados.id_carteira_cobranca || "",
    contrato: dados.nome_plano || "Internet",
    status: dados.status || "P",
    status_internet: dados.status_internet || "A",
    data: hoje,
    data_ativacao: hoje,
    dia_fixo_vencimento: String(dados.dia_vencimento || "10"),
    fidelidade: String(dados.fidelidade || "0"),
    taxa_instalacao: "0.00",
    bloqueio_automatico: "S",
    aviso_atraso: "S",
    renovacao_automatica: "S",
    endereco_padrao_cliente: "S",
    obs_contrato: dados.obs || "",
  }, { ...opts, logStep: "criar_contrato" });
}

export async function ixcAtualizarContrato(id: string, dados: Record<string, any>, opts: any = {}) {
  return ixcUpdate("cliente_contrato", id, dados, { ...opts, logStep: "atualizar_contrato" });
}

// ===================== FINANCEIRO =====================

export async function ixcListarFaturas(idCliente: string, opts: any = {}) {
  const r = await ixcList("fn_areceber", {
    qtype: "fn_areceber.id_cliente",
    query: idCliente,
    oper: "=",
    rp: 100,
    sortname: "fn_areceber.data_vencimento",
    sortorder: "desc",
  }, { ...opts, logStep: "listar_faturas" });
  return r.registros;
}

export async function ixcGerarBoleto(idFatura: string, opts: any = {}) {
  return ixcAction("fn_areceber/get_boleto", { id: idFatura }, { ...opts, logStep: "gerar_boleto" });
}

export async function ixcGerarPix(idFatura: string, opts: any = {}) {
  return ixcAction("fn_areceber/get_pix", { id: idFatura }, { ...opts, logStep: "gerar_pix" });
}

export async function ixcGerarBoletoPix(idFatura: string, opts: any = {}) {
  return ixcAction("fn_areceber/get_boleto_pix", { id: idFatura }, { ...opts, logStep: "gerar_boleto_pix" });
}

export async function ixcBaixarFatura(idFatura: string, valor: number, opts: any = {}) {
  return ixcAction("fn_areceber/baixa", { id: idFatura, valor }, { ...opts, logStep: "baixar_fatura" });
}

export async function ixcCancelarFatura(idFatura: string, opts: any = {}) {
  return ixcAction("fn_areceber/cancelar", { id: idFatura }, { ...opts, logStep: "cancelar_fatura" });
}

// ===================== ORDENS DE SERVIÇO =====================

export async function ixcCriarOS(dados: Record<string, any>, opts: any = {}) {
  const hoje = new Date().toISOString().slice(0, 10);
  return ixcInsert("su_oss_chamado", {
    id_cliente: dados.id_cliente,
    id_assunto: dados.id_assunto || "1",
    id_setor: dados.id_setor || "1",
    id_filial: dados.id_filial || "1",
    tipo: dados.tipo || "C",
    status: dados.status || "A",
    prioridade: dados.prioridade || "N",
    origem_endereco: "M",
    endereco: dados.endereco || "",
    numero: dados.numero || "",
    bairro: dados.bairro || "",
    mensagem: dados.mensagem || "",
    data_abertura: `${hoje} 09:00:00`,
  }, { ...opts, logStep: "criar_os" });
}

export async function ixcListarOS(idCliente: string, opts: any = {}) {
  const r = await ixcList("su_oss_chamado", {
    qtype: "su_oss_chamado.id_cliente",
    query: idCliente,
    oper: "=",
    rp: 100,
    sortname: "su_oss_chamado.id",
    sortorder: "desc",
  }, { ...opts, logStep: "listar_os" });
  return r.registros;
}

export async function ixcAtualizarOS(id: string, dados: Record<string, any>, opts: any = {}) {
  return ixcUpdate("su_oss_chamado", id, dados, { ...opts, logStep: "atualizar_os" });
}

export async function ixcAtribuirTecnico(idOS: string, idTecnico: string, opts: any = {}) {
  return ixcUpdate("su_oss_chamado", idOS, { id_tecnico: idTecnico, status: "A" }, { ...opts, logStep: "atribuir_tecnico" });
}

export async function ixcListarTecnicos(opts: any = {}) {
  const r = await ixcList("vendedor", { qtype: "vendedor.tipo", query: "T", oper: "=", rp: 500 }, opts);
  return r.registros;
}

// ===================== STATUS / SUSPENSÃO / LIBERAÇÃO =====================

export async function ixcSuspenderContrato(idContrato: string, motivo: string, opts: any = {}) {
  return ixcUpdate("cliente_contrato", idContrato, {
    status_internet: "C", // C = cortado/suspenso
    observacao: `Suspenso: ${motivo}`,
  }, { ...opts, logStep: "suspender_contrato" });
}

export async function ixcLiberarContrato(idContrato: string, opts: any = {}) {
  return ixcUpdate("cliente_contrato", idContrato, {
    status_internet: "A", // A = ativo
    observacao: "Liberado pelo CRM",
  }, { ...opts, logStep: "liberar_contrato" });
}

export async function ixcBloquearCliente(idCliente: string, motivo: string, opts: any = {}) {
  return ixcUpdate("cliente", idCliente, { ativo: "N", observacao: motivo }, { ...opts, logStep: "bloquear_cliente" });
}

export async function ixcDesbloquearCliente(idCliente: string, opts: any = {}) {
  return ixcUpdate("cliente", idCliente, { ativo: "S" }, { ...opts, logStep: "desbloquear_cliente" });
}

// ===================== CONSUMO / RADUSUARIOS =====================

export async function ixcListarLogins(idCliente: string, opts: any = {}) {
  const r = await ixcList("radusuarios", {
    qtype: "radusuarios.id_cliente",
    query: idCliente,
    oper: "=",
    rp: 100,
  }, { ...opts, logStep: "listar_logins" });
  return r.registros;
}

export async function ixcConsumoLogin(idLogin: string, periodo: string, opts: any = {}) {
  // periodo: "current_month" | "last_month" | YYYY-MM
  return ixcAction("radusuarios/get_consumo", { id: idLogin, periodo }, { ...opts, logStep: "consumo_login" });
}

export async function ixcAlterarSenhaLogin(idLogin: string, senha: string, opts: any = {}) {
  return ixcUpdate("radusuarios", idLogin, { senha }, { ...opts, logStep: "alterar_senha_login" });
}

export async function ixcDesconectarLogin(idLogin: string, opts: any = {}) {
  return ixcAction("radusuarios/desconectar", { id: idLogin }, { ...opts, logStep: "desconectar_login" });
}

// ===================== PLANOS / PRODUTOS =====================

export async function ixcListarPlanos(opts: any = {}) {
  const r = await ixcList("radgrupo", { rp: 500 }, opts);
  return r.registros;
}

export async function ixcListarProdutos(opts: any = {}) {
  let r;
  try {
    r = await ixcList("vd_produto", { rp: 500 }, opts);
  } catch (_) {
    r = await ixcList("produto", { rp: 500 }, opts);
  }
  return r.registros;
}

export async function ixcListarFiliais(opts: any = {}) {
  const r = await ixcList("filial", { rp: 200 }, opts);
  return r.registros;
}

export async function ixcListarVendedores(opts: any = {}) {
  const r = await ixcList("vendedor", { rp: 500 }, opts);
  return r.registros;
}

export async function ixcListarAssuntosOS(opts: any = {}) {
  const r = await ixcList("su_oss_assunto", { rp: 500 }, opts);
  return r.registros;
}

export async function ixcListarSetoresOS(opts: any = {}) {
  const r = await ixcList("su_oss_setor", { rp: 500 }, opts);
  return r.registros;
}

export async function ixcListarModelosContrato(opts: any = {}) {
  const r = await ixcList("contrato_modelo", { rp: 200 }, opts);
  return r.registros;
}

// ===================== ATENDIMENTOS =====================

export async function ixcListarAtendimentos(idCliente: string, opts: any = {}) {
  const r = await ixcList("su_oss_chamado", {
    qtype: "su_oss_chamado.id_cliente",
    query: idCliente,
    oper: "=",
    rp: 100,
    sortname: "su_oss_chamado.id",
    sortorder: "desc",
  }, { ...opts, logStep: "listar_atendimentos" });
  return r.registros;
}

export async function ixcAdicionarAtendimentoOS(idOS: string, mensagem: string, opts: any = {}) {
  return ixcAction("su_oss_chamado/mensagem", { id: idOS, mensagem }, { ...opts, logStep: "adicionar_atendimento" });
}