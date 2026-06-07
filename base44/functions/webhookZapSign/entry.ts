import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Webhook chamado pelo ZapSign quando um documento é assinado
// Registre em: ZapSign > Configurações > Webhooks > URL desta função
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json();

    // ZapSign envia event_action: "sign_doc" quando assinado
    const eventAction = body?.event_action || body?.action || '';
    const docToken = body?.document?.token || body?.token || '';

    if (!docToken) {
      return Response.json({ error: 'token do documento ausente' }, { status: 400 });
    }

    // Busca o contrato pelo id_zapsign
    const contratos = await base44.asServiceRole.entities.Contrato.filter({ id_zapsign: docToken });
    if (!contratos || contratos.length === 0) {
      return Response.json({ ok: true, msg: 'Contrato não encontrado, ignorado' });
    }

    const contrato = contratos[0];

    // Atualiza contrato
    await base44.asServiceRole.entities.Contrato.update(contrato.id, {
      status: 'assinado',
      data_assinatura: new Date().toISOString(),
      url_pdf: body?.document?.signed_file || body?.signed_file || contrato.url_pdf || '',
    });

    // Avança o pedido para "assinado"
    if (contrato.pedido_id) {
      const pedido = await base44.asServiceRole.entities.Pedido.get(contrato.pedido_id);
      if (pedido && pedido.status === 'contrato_pendente') {
        await base44.asServiceRole.entities.Pedido.update(contrato.pedido_id, {
          status: 'assinado',
        });
      }
    }

    return Response.json({ ok: true, contrato_id: contrato.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});