import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { pedido_id, template_pdf_url } = await req.json();
    if (!pedido_id) return Response.json({ error: 'pedido_id obrigatório' }, { status: 400 });

    const zapToken = Deno.env.get('ZAPSIGN_TOKEN');
    if (!zapToken) return Response.json({ error: 'ZAPSIGN_TOKEN não configurado' }, { status: 500 });

    // Busca o pedido
    const pedido = await base44.asServiceRole.entities.Pedido.get(pedido_id);
    if (!pedido) return Response.json({ error: 'Pedido não encontrado' }, { status: 404 });

    // Busca o lead para obter dados de contato
    let lead = null;
    if (pedido.lead_id) {
      lead = await base44.asServiceRole.entities.Lead.get(pedido.lead_id);
    }

    const signerName = pedido.lead_nome || 'Cliente';
    const signerEmail = lead?.email || '';
    const signerPhone = lead?.telefone || '';

    // Cria documento no ZapSign
    const zapBody = {
      name: `Contrato - ${signerName}`,
      url_pdf: template_pdf_url || '',
      signers: [
        {
          name: signerName,
          email: signerEmail,
          phone_country: '55',
          phone_number: signerPhone.replace(/\D/g, ''),
          auth_mode: 'assinaturaTela',
          send_automatic_email: !!signerEmail,
          send_automatic_whatsapp: !!signerPhone,
        },
      ],
      lang: 'pt-br',
      disable_signer_emails: false,
    };

    const zapResp = await fetch('https://api.zapsign.com.br/api/v1/docs/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${zapToken}`,
      },
      body: JSON.stringify(zapBody),
    });

    const zapData = await zapResp.json();

    if (!zapResp.ok) {
      return Response.json({ error: 'Erro ZapSign', detalhe: zapData }, { status: 502 });
    }

    const linkAssinatura = zapData?.signers?.[0]?.sign_url || zapData?.url || '';
    const idZapsign = zapData?.token || zapData?.open_id || '';

    // Persiste contrato
    const contrato = await base44.asServiceRole.entities.Contrato.create({
      pedido_id,
      status: 'enviado',
      link_assinatura: linkAssinatura,
      id_zapsign: idZapsign,
      cliente_nome: signerName,
      cliente_email: signerEmail,
      cliente_telefone: signerPhone,
    });

    // Atualiza pedido
    await base44.asServiceRole.entities.Pedido.update(pedido_id, {
      status: 'contrato_pendente',
      link_assinatura: linkAssinatura,
      data_contrato: new Date().toISOString(),
    });

    return Response.json({ contrato, link_assinatura: linkAssinatura, id_zapsign: idZapsign });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});