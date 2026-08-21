// base44/functions/centralSuporte/entry.ts
// Central do Assinante — cria registro de suporte (Contato + Conversa).
// Requer session_token válido (obtido via OTP na centralAssinante).
//
// Entrada: { cpf_cnpj, nome, telefone, assunto, mensagem, contrato_id, token }
// Saída: { ok: true } ou { erro }

import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";
import { onlyDigits } from "../../shared/ixcClient.ts";
import { validateSessionToken, auditAccess } from "../../shared/otpAuth.ts";

const json = (obj: any, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({});

  let body: any = {};
  try { body = await req.json(); } catch { return json({ erro: "Payload inválido" }, 400); }

  const doc = onlyDigits(body?.cpf_cnpj || "");
  const token = body?.token || "";
  const nome = body?.nome || "";
  const telefone = body?.telefone || "";
  const assunto = body?.assunto || "";
  const mensagem = body?.mensagem || "";
  const contratoId = body?.contrato_id || "";

  if (!doc || !nome || !assunto || !mensagem) {
    return json({ erro: "Dados incompletos." }, 400);
  }
  if (!token) return json({ erro: "Sessão expirada. Faça login novamente." }, 401);

  // Validate session token
  const validation = await validateSessionToken(token, doc);
  if (!validation.valid) return json({ erro: validation.reason || "Sessão inválida." }, 401);

  try {
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole;

    // Check if contato already exists by telefone
    let contatoId: string | undefined;
    try {
      const existing = await db.entities.Contato.filter({ telefone }, undefined, 1);
      contatoId = existing[0]?.id;
    } catch (_) { /* table might be empty */ }

    if (!contatoId) {
      const contato = await db.entities.Contato.create({ nome, telefone });
      contatoId = contato.id;
    }

    // Create conversa
    const conversa = await db.entities.Conversa.create({
      contato_id: contatoId,
      contato_nome: nome,
      contato_telefone: telefone,
      status: "aguardando",
      nao_lidas: 0,
      ultima_msg: `${assunto}: ${mensagem.slice(0, 80)}`,
      ultima_em: new Date().toISOString(),
    });

    // Audit log
    await auditAccess(base44, "create", "Conversa", conversa.id, { assunto, contrato_id: contratoId, msg_length: mensagem.length });

    return json({ ok: true });
  } catch (e: any) {
    console.error("Erro centralSuporte:", e.message);
    return json({ erro: "Não foi possível enviar a solicitação. Tente novamente." }, 500);
  }
});