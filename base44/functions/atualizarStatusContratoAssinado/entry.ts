import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { pedido_id, contrato_id } = await req.json();

    if (!pedido_id) {
      return Response.json({ error: 'pedido_id obrigatório' }, { status: 400 });
    }

    // Atualiza status do pedido para "assinado"
    const pedido = await base44.asServiceRole.entities.Pedido.update(pedido_id, {
      status: 'assinado',
      data_contrato: new Date().toISOString(),
    });

    // Busca lead para atualizar etapa
    if (pedido.lead_id) {
      await base44.asServiceRole.entities.Lead.update(pedido.lead_id, {
        etapa_funil: 'contrato',
      });
    }

    // Busca vendedor para notificar
    const vendedor = pedido.vendedor_id ? await base44.asServiceRole.entities.User.get(pedido.vendedor_id) : null;
    const vendedorEmail = vendedor?.email || '';

    if (vendedorEmail) {
      try {
        await base44.integrations.Core.SendEmail({
          to: vendedorEmail,
          from_name: 'CRM ISP - ZapSign',
          subject: `✅ Contrato Assinado: ${pedido.lead_nome}`,
          body: `Olá ${pedido.vendedor_nome},\n\n🎉 O contrato de ${pedido.lead_nome} foi assinado com sucesso no ZapSign!\n\nPróximos passos:\n1. Revisar dados de viabilidade técnica\n2. Ativar cliente no IXC\n3. Registrar instalação\n\nAcesse o CRM para prosseguir.`,
        });
      } catch (emailError) {
        console.error('Erro ao enviar email:', emailError);
      }
    }

    return Response.json({
      success: true,
      pedido_status: pedido.status,
      notificacao_enviada: !!vendedorEmail,
    });
  } catch (error) {
    console.error('Erro ao atualizar status:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});