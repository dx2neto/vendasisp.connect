// base44/functions/centralAssinante/entry.ts
// Central do Assinante — two-step OTP authentication.
// Step 1: { cpf_cnpj, step: "request" } → sends OTP via WhatsApp, returns token
// Step 2: { cpf_cnpj, step: "verify", otp, token } → validates OTP, returns full data + session_token
// Backward compat: { cpf_cnpj, session_token } → validates session, returns data

import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";
import { ixcList, onlyDigits, ixcListarFaturas, ixcListarOS } from "../../shared/ixcClient.ts";
import {
  generateOTP, createOTPToken, validateOTPToken,
  createSessionToken, validateSessionToken,
  normalizePhoneBR, maskPhoneBR,
} from "../../shared/otpAuth.ts";
import { enviarWhatsApp } from "../../shared/evolutionClient.ts";

const json = (obj: any, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });

const fmtData = (d: string) => {
  const m = String(d || "").match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (d || "");
};

const fmtBRL = (v: any) => {
  const n = Number(v || 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

async function findClient(doc: string) {
  const cliRes = await ixcList("cliente", {
    qtype: "cliente.cnpj_cpf", query: doc, oper: "=", rp: 1,
  }, { logStep: "central_buscar_cliente" });
  return cliRes.registros[0] || null;
}

async function fetchClientData(cli: any, doc: string, contratoId: string | null) {
  const idCliente = cli.id;

  const contratosRes = await ixcList("cliente_contrato", {
    qtype: "cliente_contrato.id_cliente", query: idCliente, oper: "=", rp: 50,
    sortname: "cliente_contrato.id", sortorder: "desc",
  }, { logStep: "central_listar_contratos" });

  const contratos = (contratosRes.registros || []).map((c: any) => ({
    id: c.id,
    numero: c.id,
    plano: c.contrato || "Internet",
    status: c.status || "",
    status_internet: c.status_internet || "",
    data_ativacao: fmtData(c.data_ativacao),
    data_vencimento: c.dia_fixo_vencimento || "",
    valor_mensal: fmtBRL(c.valor_mensal || c.valor),
    fidelidade: c.fidelidade || "0",
    endereco: c.endereco || "",
    numero: c.numero || "",
    bairro: c.bairro || "",
    cidade: c.cidade || "",
  }));

  const contratoFiltro = contratoId
    ? contratos.find((c: any) => String(c.id) === contratoId)
    : null;

  let faturasRaw = await ixcListarFaturas(idCliente, { logStep: "central_listar_faturas" });
  if (contratoId) {
    faturasRaw = faturasRaw.filter((f: any) => String(f.id_contrato || f.id_cliente_contrato || "") === contratoId);
  }

  const faturas = (faturasRaw || []).slice(0, 50).map((f: any) => ({
    id: f.id,
    descricao: f.descricao || "Fatura",
    vencimento: fmtData(f.data_vencimento),
    valor: fmtBRL(f.valor),
    status: f.status === "A" ? "Aberta" : f.status === "B" ? "Baixada" : f.status === "C" ? "Cancelada" : f.status || "",
    linha_digitavel: f.linha_digitavel || f.linha_digitavel_boleto || "",
  }));

  let osRaw = await ixcListarOS(idCliente, { logStep: "central_listar_os" });
  const os = (osRaw || []).slice(0, 20).map((o: any) => ({
    id: o.id,
    assunto: o.assunto || "",
    status: o.status === "A" ? "Aberta" : o.status === "F" ? "Fechada" : o.status || "",
    data_abertura: fmtData(o.data_abertura),
    mensagem: (o.mensagem || "").slice(0, 100),
  }));

  const cliente = {
    id: cli.id,
    nome: cli.razao || cli.fantasia || "Cliente",
    tipo_pessoa: onlyDigits(cli.cnpj_cpf).length > 11 ? "J" : "F",
    cpf_cnpj: doc,
    email: cli.email || "",
    telefone: cli.fone || "",
    whatsapp: cli.whatsapp || cli.telefone_celular || "",
    ativo: cli.ativo === "S",
  };

  const contratoSelecionado = contratoFiltro || (contratos.length === 1 ? contratos[0] : null);

  return { cliente, contratos, contrato_selecionado: contratoSelecionado, faturas, os, total_contratos: contratos.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({});

  let body: any = {};
  try { body = await req.json(); } catch { return json({ erro: "Payload inválido" }, 400); }

  const doc = onlyDigits(body?.cpf_cnpj || "");
  if (!doc || doc.length < 11) return json({ erro: "CPF ou CNPJ inválido." }, 400);

  const step = body?.step || "";
  const base44 = createClientFromRequest(req);

  // === STEP 1: REQUEST OTP ===
  if (step === "request") {
    try {
      const cli = await findClient(doc);
      if (!cli) return json({ erro: "Cliente não encontrado." });

      const phoneRaw = cli.whatsapp || cli.telefone_celular || cli.fone || "";
      const phone = normalizePhoneBR(phoneRaw);
      if (!phone) {
        return json({ erro: "Não foi possível enviar o código de verificação. Entre em contato com o suporte." });
      }

      const otp = generateOTP();
      const token = await createOTPToken(doc, otp);

      const msg = `🔒 *Central do Assinante*\n\nSeu código de verificação é: *${otp}*\n\nUse este código para acessar sua central. Não compartilhe este código com terceiros.`;
      const waResult = await enviarWhatsApp(base44, phone, msg);

      if (!waResult.ok) {
        return json({ erro: "Não foi possível enviar o código de verificação. Tente novamente ou entre em contato com o suporte." });
      }

      return json({
        otp_sent: true,
        phone_masked: maskPhoneBR(phone),
        token,
      });
    } catch (e: any) {
      console.error("Erro Central OTP request:", e.message);
      return json({ erro: "Não foi possível processar sua solicitação. Tente novamente." }, 500);
    }
  }

  // === STEP 2: VERIFY OTP ===
  if (step === "verify") {
    const otp = String(body?.otp || "").replace(/\D/g, "");
    const token = body?.token || "";
    if (!otp || otp.length !== 6) return json({ erro: "Código de verificação inválido." }, 400);
    if (!token) return json({ erro: "Token de verificação ausente." }, 400);

    const validation = await validateOTPToken(token, doc, otp);
    if (!validation.valid) return json({ erro: validation.reason || "Verificação falhou." }, 401);

    try {
      const cli = await findClient(doc);
      if (!cli) return json({ erro: "Cliente não encontrado." });

      const contratoId = body?.contrato_id ? String(body.contrato_id) : null;
      const data = await fetchClientData(cli, doc, contratoId);
      const sessionToken = await createSessionToken(doc);

      return json({ ...data, session_token: sessionToken });
    } catch (e: any) {
      console.error("Erro Central do Assinante:", e.message);
      return json({ erro: "Não foi possível consultar seus dados no momento. Tente novamente." }, 500);
    }
  }

  // === BACKWARD COMPAT: session_token (already verified) ===
  if (body?.session_token) {
    const validation = await validateSessionToken(body.session_token, doc);
    if (!validation.valid) return json({ erro: validation.reason || "Sessão inválida." }, 401);

    try {
      const cli = await findClient(doc);
      if (!cli) return json({ erro: "Cliente não encontrado." });

      const contratoId = body?.contrato_id ? String(body.contrato_id) : null;
      const data = await fetchClientData(cli, doc, contratoId);
      return json({ ...data, session_token: body.session_token });
    } catch (e: any) {
      console.error("Erro Central do Assinante:", e.message);
      return json({ erro: "Não foi possível consultar seus dados no momento. Tente novamente." }, 500);
    }
  }

  return json({ erro: "Use step='request' para iniciar ou step='verify' com OTP para acessar." }, 400);
});