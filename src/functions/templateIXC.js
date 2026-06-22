// functions/templateIXC.js
// Módulo compartilhado para preencher os MODELOS DE CONTRATO do IXC.
//
// Os modelos do IXC usam variáveis no formato #variavel# (ex.: #cliente_razao#,
// #cliente_CNPJ_CPF#, #contrato_data_ativacao_renovacao_extenso#) e o corpo é HTML.
// Este módulo:
//   1) monta o mapa de variáveis a partir dos dados do CRM (lead/pedido/plano/config),
//   2) substitui as variáveis #...# (e também {{...}} / {...} por compatibilidade),
//   3) converte o HTML do modelo em texto legível para virar PDF no ZapSign.
//
// Usado por enviarContrato.js e assinarOnline.js.

// -------- formatadores -------------------------------------------------------
export const onlyDigits = (v) => (v ? String(v).replace(/\D/g, "") : "");

export const fmtDoc = (v) => {
  const d = onlyDigits(v);
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return v || "";
};

export const fmtCep = (v) => {
  const d = onlyDigits(v);
  return d.length === 8 ? d.replace(/(\d{5})(\d{3})/, "$1-$2") : (v || "");
};

export const fmtFone = (v) => {
  const d = onlyDigits(v).replace(/^55/, "");
  if (d.length === 11) return d.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  return v || "";
};

export const fmtBRL = (v) =>
  `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
const DIAS = [
  "Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira",
  "Quinta-feira", "Sexta-feira", "Sábado",
];

/** "Segunda-feira, 22 de junho de 2026" (formato igual ao do IXC). */
export function dataExtenso(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

// -------- HTML -> texto ------------------------------------------------------
const ENTIDADES = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", ordm: "º", ordf: "ª",
  aacute: "á", acirc: "â", atilde: "ã", agrave: "à", auml: "ä",
  eacute: "é", ecirc: "ê", egrave: "è", euml: "ë",
  iacute: "í", icirc: "î", iuml: "ï",
  oacute: "ó", ocirc: "ô", otilde: "õ", ograve: "ò", ouml: "ö",
  uacute: "ú", ucirc: "û", uuml: "ü", ugrave: "ù",
  ccedil: "ç", ntilde: "ñ",
  Aacute: "Á", Acirc: "Â", Atilde: "Ã", Agrave: "À",
  Eacute: "É", Ecirc: "Ê", Iacute: "Í", Oacute: "Ó", Ocirc: "Ô", Otilde: "Õ",
  Uacute: "Ú", Ccedil: "Ç",
  copy: "©", reg: "®", deg: "°", hellip: "...", mdash: "-", ndash: "-",
  laquo: "«", raquo: "»", sect: "§", middot: "·", bull: "-",
};

export function decodeEntities(s) {
  return String(s || "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&([a-zA-Z]+);/g, (m, name) => (ENTIDADES[name] != null ? ENTIDADES[name] : m));
}

/**
 * Converte o HTML do modelo IXC em texto legível, preservando quebras de linha
 * de blocos e separando células de tabela com " | ". pdf-lib não renderiza HTML,
 * então geramos texto limpo para o PDF.
 */
export function htmlParaTexto(html) {
  if (!html) return "";
  let s = String(html).replace(/\r\n?/g, "\n");   // normaliza quebras

  // remove blocos que não viram texto
  s = s.replace(/<style[\s\S]*?<\/style>/gi, "")
       .replace(/<script[\s\S]*?<\/script>/gi, "")
       .replace(/<img[^>]*>/gi, "");

  // quebras de linha a partir de tags de bloco
  s = s.replace(/<\s*br\s*\/?>/gi, "\n")
       .replace(/<\/\s*(p|div|h[1-6]|li|tr|table|thead|tbody)\s*>/gi, "\n")
       .replace(/<\s*(p|div|h[1-6]|li|tr)[^>]*>/gi, "\n");

  // separadores de célula
  s = s.replace(/<\/\s*(td|th)\s*>/gi, " | ");

  // remove tags restantes
  s = s.replace(/<[^>]+>/g, "");

  // entidades
  s = decodeEntities(s);

  // normaliza espaços/linhas
  s = s.replace(/[ \t]+\|\s*$/gm, "")          // " |" sobrando no fim da linha
       .replace(/[ \t]{2,}/g, " ")
       .replace(/[ \t]+\n/g, "\n")             // espaço antes da quebra
       .replace(/\n[ \t]+/g, "\n")             // espaço depois da quebra
       .replace(/\n{3,}/g, "\n\n")             // no máx. 1 linha em branco
       .replace(/^\s+|\s+$/g, "");

  return s;
}

// -------- mapa de variáveis --------------------------------------------------
/**
 * Monta o mapa de variáveis do IXC a partir dos dados do CRM.
 * Aceita um contexto flexível: { lead, pedido, plano, config, vendedorNome, total, extra }
 * Campos do endereço de instalação (contrato_*) caem para o endereço do cliente
 * quando não há um específico.
 */
export function montarVariaveisIXC(ctx = {}) {
  const { lead = {}, pedido = {}, plano = {}, config = {}, vendedorNome = "", total } = ctx;

  const doc = lead.cnpj_cpf || pedido.lead_cpf || "";
  const valor = total != null ? total : (pedido.valor ?? plano.preco_mensal ?? 0);
  const cidade = lead.cidade_nome || lead.cidade || "";
  const uf = lead.uf || "";
  const tel = lead.telefone || "";

  const v = {
    // ---- cliente ----
    cliente_razao: lead.nome || pedido.lead_nome || "",
    cliente_fantasia: lead.fantasia || "",
    cliente_cnpj_cpf: fmtDoc(doc),
    cliente_rg_ie: lead.rg || lead.ie || lead.ie_identidade || "",
    cliente_inscricao_municipal: lead.inscricao_municipal || "",
    cliente_inscricao_estadual: lead.inscricao_estadual || lead.ie || "",
    cliente_endereco: lead.rua || lead.endereco || "",
    cliente_numero: lead.numero || "",
    cliente_complemento: lead.complemento || "",
    cliente_cep: fmtCep(lead.cep),
    cliente_bairro: lead.bairro || "",
    cliente_cidade: cidade,
    cliente_uf: uf,
    cliente_celular: fmtFone(tel),
    cliente_fone: fmtFone(lead.telefone_fixo || tel),
    cliente_fone_comercial: fmtFone(lead.telefone_comercial || ""),
    cliente_email: lead.email || "",
    cliente_nome_representante_1: lead.representante_nome || "",
    cliente_cpf_representante_1: fmtDoc(lead.representante_cpf || ""),
    cliente_identidade_representante_1: lead.representante_rg || "",

    // ---- endereço de instalação (contrato) — usa o do cliente como padrão ----
    contrato_endereco: lead.end_instalacao_rua || lead.rua || lead.endereco || "",
    contrato_endereco_numero: lead.end_instalacao_numero || lead.numero || "",
    contrato_complemento: lead.end_instalacao_complemento || lead.complemento || "",
    contrato_cep: fmtCep(lead.end_instalacao_cep || lead.cep),
    contrato_bairro: lead.end_instalacao_bairro || lead.bairro || "",
    contrato_cidade: lead.end_instalacao_cidade || cidade,
    contrato_uf: lead.end_instalacao_uf || uf,
    contrato_data_ativacao_renovacao_extenso: dataExtenso(),
    // grade de comodato: preenchida na instalação; aqui fica em branco
    contrato_grade_comodato_sem_val: "",

    // ---- plano/serviço ----
    tipo_de_conexao: plano.tipo_conexao || "Fibra",
    plano_nome: plano.nome || pedido.plano_nome || "",
    plano_velocidade: plano.velocidade_mbps ? `${plano.velocidade_mbps} Mbps` : "",
    valor: fmtBRL(valor),
    plano_valor: fmtBRL(valor),
    valor_mensal: fmtBRL(valor),
    fidelidade: pedido.fidelidade || "12 meses",
    vencimento_dia: pedido.vencimento_dia || pedido.vencimento || "",

    // ---- gerais ----
    vendedor_nome: vendedorNome || pedido.vendedor_nome || "",
    data_contrato: new Date().toLocaleDateString("pt-BR"),
    data_hoje: new Date().toLocaleDateString("pt-BR"),
    data_extenso: dataExtenso(),
    cidade_contrato: cidade,
  };

  // mescla quaisquer variáveis extras passadas pelo chamador (sobrescreve)
  if (ctx.extra && typeof ctx.extra === "object") {
    for (const [k, val] of Object.entries(ctx.extra)) v[k.toLowerCase()] = val;
  }
  return v;
}

/**
 * Substitui as variáveis no conteúdo do modelo.
 * Suporta #variavel# (IXC), {{variavel}} e {variavel}. Case-insensitive.
 * Variável não encontrada vira string vazia (mantém o documento limpo).
 */
export function aplicarVariaveis(conteudo, vars) {
  if (!conteudo) return "";
  const get = (k) => {
    const key = String(k).toLowerCase();
    return vars[key] != null ? String(vars[key]) : "";
  };
  return String(conteudo)
    .replace(/#([a-zA-Z0-9_]+)#/g, (_, k) => get(k))
    .replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => get(k))
    .replace(/\{\s*([a-zA-Z0-9_]+)\s*\}/g, (_, k) => get(k));
}

/**
 * Pipeline completo: recebe o modelo (HTML ou texto) + contexto do CRM e
 * devolve o TEXTO final pronto para virar PDF.
 *   - detecta HTML e converte para texto
 *   - preenche as variáveis
 */
export function renderizarContrato(modelo, ctx = {}) {
  const vars = ctx.vars || montarVariaveisIXC(ctx);
  const ehHtml = /<\/?[a-z][\s\S]*>/i.test(modelo || "");
  // preenche antes de "destruir" o HTML, pra variáveis dentro de tags também caírem
  const preenchido = aplicarVariaveis(modelo || "", vars);
  return ehHtml ? htmlParaTexto(preenchido) : preenchido;
}
