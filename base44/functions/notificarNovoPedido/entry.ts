import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { pedido_id } = await req.json();

    if (!pedido_id) {
      return Response.json({ error: 'pedido_id obrigatório' }, { status: 400 });
    }

    const pedido = await base44.asServiceRole.entities.Pedido.get(pedido_id);
    if (!pedido) {
      return Response.json({ error: 'Pedido não encontrado' }, { status: 404 });
    }

    // Busca vendedor
    const vendedor = pedido.vendedor_id ? await base44.asServiceRole.entities.User.get(pedido.vendedor_id) : null;
    const vendedorEmail = vendedor?.email || '';

    if (!vendedorEmail) {
      return Response.json({ success: true, message: 'Sem email do vendedor' });
    }

    // Envia email de notificação
    const emailResult = await base44.integrations.Core.SendEmail({
      to: vendedorEmail,
      from_name: 'CRM ISP - Automação',
      subject: `🎉 Novo Pedido: ${pedido.lead_nome}`,
      body: `Olá ${pedido.vendedor_nome},\n\n✅ Um novo pedido foi gerado automaticamente após aprovação de crédito!\n\n📋 Detalhes:\n- Cliente: ${pedido.lead_nome}\n- CPF: ${pedido.lead_cpf || '—'}\n- Status: ${pedido.status}\n\nPróximos passos:\n1. Confirmar dados do cliente\n2. Gerar contrato (ZapSign)\n3. Coletar assinatura\n4. Ativar no IXC\n\nAccesse o CRM para mais detalhes e tomar ação imediata.`,
    });

    return Response.json({
      success: true,
      email_enviado: true,
      vendedor_email: vendedorEmail,
    });
  } catch (error) {
    console.error('Erro ao notificar novo pedido:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});