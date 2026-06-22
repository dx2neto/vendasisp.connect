// functions/webhookZapsign.js
// Recebe os eventos do ZapSign em TEMPO REAL. Marque esta function como PÚBLICA no Base44
// e cadastre a URL dela em ZapSign > Configurações > Webhooks (evento "doc_signed").
//
// Payload típico do ZapSign:
//   { event_type:"doc_signed", token:"<doc_token>", external_id:"<pedido_id>", status:"signed", ... }

import { createClientFromRequest } from "npm:@base44/sdk";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({});
  const base44 = createClientFromRequest(req);

  let body = {};
  try { body = await req.json(); } catch { return json({ ok: false, error: "payload inválido" }, 400); }

  const docToken = body?.token || body?.doc_token;
  const externalId = body?.external_id;
  const evento = body?.event_type || body?.status;
  const assinado = /signed/i.test(String(evento)) || body?.status === "signed";

  try {
    // Localiza o contrato pelo token do documento (ou pelo external_id = pedido)
    let contrato = null;
    if (docToken) {
      contrato = (await base44.asServiceRole.entities.Contrato.filter({ zapsign_token: docToken }))[0];
    }
    if (!contrato && externalId) {
      contrato = (await base44.asServiceRole.entities.Contrato.filter({ pedido_id: externalId }))[0];
    }

    if (assinado) {
      if (contrato) {
        await base44.asServiceRole.entities.Contrato.update(contrato.id, {
          status: "assinado",
          data_assinatura: new Date().toISOString(),
        });
      }
      const pedidoId = contrato?.pedido_id || externalId;
      if (pedidoId) {
        // assinado -> habilita o botão "Ativar Cliente no IXC" no CRM
        await base44.asServiceRole.entities.Pedido.update(pedidoId, { status: "assinado" }).catch(() => {});
      }
    }

    return json({ ok: true, tratado: assinado });
  } catch (e) {
    // Sempre 200 pra o ZapSign não ficar reenviando indefinidamente
    return json({ ok: false, error: e.message }, 200);
  }
});
