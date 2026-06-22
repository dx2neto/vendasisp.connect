import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Webhook chamado pelo ZapSign quando um documento é assinado.
// Registre em: ZapSign > Configurações > Webhooks > URL desta função.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json();
    console.log('ZapSign webhook recebido:', JSON.stringify(body).slice(0, 300));

    const docToken = body?.document?.token || body?.token || '';

    if (!docToken) {
      return Response.json({ error: 'token do documento ausente' }, { status: 400 });
    }

    // Apenas processa eventos de assinatura concluída
    const eventAction = body?.event_action || body?.action || '';
    const isAssinado = !eventAction || eventAction === 'sign_doc' || eventAction === 'doc_signed';
    if (!isAssinado) {
      return Response.json({ ok: true, msg: `Evento ignorado: ${eventAction}` });
    }

    // Busca o contrato pelo token ZapSign
    const contratos = await base44.asServiceRole.entities.Contrato.filter({ id_zapsign: docToken });
    if (!contratos || contratos.length === 0) {
      return Response.json({ ok: true, msg: 'Contrato não encontrado, ignorado' });
    }

    const contrato = contratos[0];
    const jaAssinado = contrato.status === 'assinado'; // re-entrega do webhook?
    const agora = new Date().toISOString();
    const urlPdf = body?.document?.signed_file || body?.signed_file || contrato.url_pdf || '';

    // 1. Atualiza o contrato → assinado
    await base44.asServiceRole.entities.Contrato.update(contrato.id, {
      status: 'assinado',
      data_assinatura: agora,
      url_pdf: urlPdf,
    });

    let pedido = null;
    let notificacaoEnviada = false;

    if (contrato.pedido_id) {
      pedido = await base44.asServiceRole.entities.Pedido.get(contrato.pedido_id);

      if (pedido) {
        // 2. Avança o pedido para "assinado" (aceita contrato_pendente ou qualquer status anterior)
        const statusNaoFinalizado = !['assinado', 'ativado', 'recusado'].includes(pedido.status);
        if (statusNaoFinalizado) {
          await base44.asServiceRole.entities.Pedido.update(contrato.pedido_id, {
            status: 'assinado',
            data_contrato: agora,
            link_assinatura: urlPdf || pedido.link_assinatura,
          });
          console.log(`Pedido ${contrato.pedido_id} avançado para "assinado"`);
        }

        // 3. Atualiza etapa do lead
        if (pedido.lead_id) {
          await base44.asServiceRole.entities.Lead.update(pedido.lead_id, {
            etapa_funil: 'contrato',
          }).catch(e => console.warn('Erro ao atualizar lead:', e.message));
        }

        // 4. Notifica o vendedor por e-mail
        const vendedor = pedido.vendedor_id
          ? await base44.asServiceRole.entities.User.get(pedido.vendedor_id).catch(() => null)
          : null;
        const vendedorEmail = vendedor?.email || '';

        // Evita e-mail duplicado: só notifica se ainda não foi assinado/notificado
        const podeNotificar = vendedorEmail && !jaAssinado && !pedido.email_assinatura_enviado;
        if (podeNotificar) {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: vendedorEmail,
            from_name: 'CRM — ZapSign',
            subject: `✅ Contrato assinado: ${pedido.lead_nome}`,
            body: `Olá ${pedido.vendedor_nome || 'Vendedor'},\n\n🎉 O cliente ${pedido.lead_nome} assinou o contrato no ZapSign!\n\nO status do pedido foi atualizado automaticamente para "Assinado".\n\nPróximos passos:\n1. Verificar viabilidade técnica (se ainda pendente)\n2. Ativar cliente no IXC\n3. Registrar OS de instalação\n\nAcesse o CRM para prosseguir.\n\n---\nEsta é uma mensagem automática. Não responda este e-mail.`,
          });
          await base44.asServiceRole.entities.Pedido.update(contrato.pedido_id, { email_assinatura_enviado: true }).catch(() => null);
          notificacaoEnviada = true;
          console.log(`E-mail de notificação enviado para ${vendedorEmail}`);
        } else if (!vendedorEmail) {
          console.warn('Vendedor sem e-mail cadastrado, notificação não enviada.');
        }
      }
    }

    return Response.json({
      ok: true,
      contrato_id: contrato.id,
      pedido_id: contrato.pedido_id || null,
      notificacao_enviada: notificacaoEnviada,
    });
  } catch (error) {
    console.error('Erro no webhook ZapSign:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});