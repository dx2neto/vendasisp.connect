import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { pedido_id } = await req.json();

    if (!pedido_id) {
      return Response.json({ error: 'pedido_id obrigatório' }, { status: 400 });
    }

    // Busca pedido
    const pedido = await base44.asServiceRole.entities.Pedido.get(pedido_id);
    if (!pedido) {
      return Response.json({ error: 'Pedido não encontrado' }, { status: 404 });
    }

    // Se contrato não foi assinado ainda
    if (pedido.status !== 'assinado' && pedido.link_assinatura) {
      // Busca lead para contato
      const lead = pedido.lead_id ? await base44.asServiceRole.entities.Lead.get(pedido.lead_id) : null;
      
      if (lead?.email) {
        // Envia email de cobrança
        const emailResult = await base44.integrations.Core.SendEmail({
          to: lead.email,
          from_name: 'CRM ISP - Equipe de Vendas',
          subject: `📝 Atenção: Contrato pendente de assinatura`,
          body: `Olá ${lead.nome},\n\nObservamos que o contrato ainda não foi assinado.\n\n📌 Link para assinar: ${pedido.link_assinatura}\n\nPor favor, clique no link acima e assine seu contrato em poucos cliques (rápido e seguro).\n\nQualquer dúvida, entre em contato conosco.\n\nAtt,\nEquipe de Vendas`,
        });

        return Response.json({
          success: true,
          email_enviado: emailResult?.status === 200,
          cliente_email: lead.email,
        });
      }
    }

    return Response.json({ success: true, message: 'Contrato já assinado ou sem dados de contato' });
  } catch (error) {
    console.error('Erro em cobrança:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});