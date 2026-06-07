import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    if (!data) {
      return Response.json({ error: 'Sem dados do contrato' }, { status: 400 });
    }

    // Busca pedido relacionado
    const pedido = data.pedido_id ? await base44.asServiceRole.entities.Pedido.get(data.pedido_id) : null;
    if (!pedido) {
      return Response.json({ error: 'Pedido não encontrado' }, { status: 404 });
    }

    // Busca usuário/vendedor
    const vendedor = pedido.vendedor_id ? await base44.asServiceRole.entities.User.get(pedido.vendedor_id) : null;
    const vendedorEmail = vendedor?.email || '';

    if (!vendedorEmail) {
      return Response.json({ success: true, message: 'Sem email do vendedor para notificar' });
    }

    // Envia email de notificação
    const emailResult = await base44.integrations.Core.SendEmail({
      to: vendedorEmail,
      from_name: 'CRM ISP',
      subject: `✅ Contrato assinado: ${pedido.lead_nome}`,
      body: `Olá ${pedido.vendedor_nome},\n\nO contrato do cliente ${pedido.lead_nome} foi assinado com sucesso na ZapSign!\n\nPróximos passos:\n- Revisar dados de viabilidade\n- Sincronizar com IXC\n- Ativar cliente\n\nAcesse o CRM para mais detalhes.`,
    });

    return Response.json({
      success: true,
      email_enviado: emailResult?.status === 200,
      vendedor_email: vendedorEmail,
    });
  } catch (error) {
    console.error('Erro ao notificar contrato:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});