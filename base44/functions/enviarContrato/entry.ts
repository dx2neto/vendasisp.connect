// base44/functions/enviarContrato/entry.ts
// Gera o contrato em PDF, envia ao ZapSign para assinatura e grava no CRM.
// Entrada: { pedido_id, conteudo_contrato?, template_id? }

import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";
import { zapsignConfigOk, textoParaPdfBase64, zapsignCriarDoc } from "../../shared/zapsignClient.ts";
import { renderizarContrato, montarVariaveisIXC, onlyDigits } from "../../shared/templateIXC.ts";

const json = (obj: any, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

const SEP = "\n\n______________________________________________________________\n\n";

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  if (!zapsignConfigOk()) return json({ error: "Secret ZAPSIGN_TOKEN ausente" }, 400);

  let body: any = {};
  try { body = await req.json(); } catch { /* */ }
  const { pedido_id, conteudo_contrato, template_id } = body || {};
  if (!pedido_id) return json({ error: "pedido_id obrigatório" }, 400);

  try {
    const pedido = (await base44.asServiceRole.entities.Pedido.filter({ id: pedido_id }))[0];
    if (!pedido) return json({ error: "Pedido não encontrado" }, 404);

    const lead = pedido.lead_id
      ? (await base44.asServiceRole.entities.Lead.filter({ id: pedido.lead_id }))[0]
      : null;
    const plano = pedido.plano_id
      ? (await base44.asServiceRole.entities.Plano.filter({ id: pedido.plano_id }))[0]
      : null;
    const config = (await base44.asServiceRole.entities.ConfigRegras.list())[0] || {};

    const nomeCliente = pedido.lead_nome || lead?.nome || "Cliente";
    const email = lead?.email || "";
    const telefone = onlyDigits(lead?.telefone || "");
    if (!email && !telefone) return json({ error: "Lead sem e-mail e sem telefone para envio." }, 400);

    // Variáveis preenchidas com os dados reais
    const vars = montarVariaveisIXC({ lead: lead || {}, pedido, plano: plano || {}, config });

    // --- Descobre quais modelos usar ---
    let templateIds: string[] = [];
    if (template_id) {
      templateIds = [template_id];
    } else if (plano && Array.isArray(plano.template_ids) && plano.template_ids.length) {
      templateIds = plano.template_ids;
    } else if (plano && (plano as any).template_contrato_id) {
      templateIds = [(plano as any).template_contrato_id];
    }

    let conteudo = "";
    const modelosUsados: string[] = [];
    if (templateIds.length) {
      const partes: string[] = [];
      for (const tid of templateIds) {
        const tpl = (await base44.asServiceRole.entities.TemplateContrato.filter({ id: tid }))[0];
        if (tpl?.conteudo) {
          partes.push(renderizarContrato(tpl.conteudo, { vars }));
          modelosUsados.push(tpl.nome || tid);
        }
      }
      conteudo = partes.join(SEP);
    }

    // Fallback: conteúdo enviado pelo frontend
    if (!conteudo && conteudo_contrato && conteudo_contrato.trim()) {
      conteudo = renderizarContrato(conteudo_contrato, { vars });
    }

    // Fallback final: texto padrão
    if (!conteudo) {
      conteudo = `CONTRATO DE PRESTAÇÃO DE SERVIÇO\n\n`
        + `Cliente: ${nomeCliente}\nCPF/CNPJ: ${vars.cliente_cnpj_cpf || "-"}\n`
        + `Plano: ${vars.plano_nome || "-"}\nValor: ${vars.valor}/mês\n`
        + `Data: ${vars.data_contrato}`;
    }

    // 1) PDF
    const base64_pdf = await textoParaPdfBase64(`Contrato — ${nomeCliente}`, conteudo);

    // 2) Signatário
    const signer: any = {
      name: nomeCliente,
      auth_mode: "assinaturaTela",
      send_automatic_email: Boolean(email),
      send_automatic_whatsapp: Boolean(telefone),
    };
    if (email) signer.email = email;
    if (telefone) { signer.phone_country = "55"; signer.phone_number = telefone.replace(/^55/, ""); }

    // 3) Cria documento no ZapSign
    const doc = await zapsignCriarDoc({
      nome: `Contrato - ${nomeCliente}`,
      base64_pdf,
      external_id: pedido.id,
      signers: [signer],
    });

    const signUrl = doc?.signers?.[0]?.sign_url || "";
    const docToken = doc?.token || "";

    // 4) Grava Contrato no CRM
    const contrato = await base44.asServiceRole.entities.Contrato.create({
      pedido_id: pedido.id,
      cliente_nome: nomeCliente,
      status: "enviado",
      link_assinatura: signUrl,
      zapsign_token: docToken,
      template_id: templateIds[0] || template_id || null,
      conteudo,
    }).catch(() => null);

    // 5) Atualiza Pedido
    await base44.asServiceRole.entities.Pedido.update(pedido.id, {
      status: "contrato_pendente",
      link_assinatura: signUrl,
      zapsign_doc_token: docToken,
    });

    return json({
      ok: true,
      zapsign_token: docToken,
      link_assinatura: signUrl,
      contrato_id: contrato?.id || null,
      modelos_usados: modelosUsados,
    });
  } catch (e: any) {
    return json({ error: e.message || "Erro ao enviar contrato" }, 500);
  }
});