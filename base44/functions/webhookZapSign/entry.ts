import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Webhook chamado pelo ZapSign quando um documento muda de status.
// Registre em: ZapSign > Configurações > Webhooks > URL desta função.
// Sempre responde HTTP 200 para o ZapSign não reenviar indefinidamente.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json();
    console.log('ZapSign webhook recebido:', JSON.stringify(body).slice(0, 300));

    const docToken = body?.document?.token || body?.token || '';

    if (!docToken) {
      return Response.json({ ok: false, msg: 'token do documento ausente' });
    }

    // Identifica o evento (doc_signed, doc_refused, doc_created, doc_deleted, email_bounce)
    const eventAction = body?.event_action || body?.action || body?.event || body?.type || '';
    const isAssinado = !eventAction || eventAction === 'sign_doc' || eventAction === 'doc_signed';
    const isRecusado = eventAction === 'doc_refused';

    if (!isAssinado && !isRecusado) {
      return Response.json({ ok: true, msg: `Evento ignorado: ${eventAction}` });
    }

    // Busca o contrato pelo token ZapSign
    let contratos = await base44.asServiceRole.entities.Contrato.filter({ id_zapsign: docToken });

    // Fallback: identifica a venda por external_id (pedido_id)
    let pedidoIdByExternal = '';
    if ((!contratos || contratos.length === 0) && (body?.external_id || body?.document?.external_id)) {
      pedidoIdByExternal = String(body.external_id || body.document.external_id);
    }

    if ((!contratos || contratos.length === 0) && !pedidoIdByExternal) {
      return Response.json({ ok: true, msg: 'Contrato não encontrado, ignorado' });
    }

    const contrato = contratos[0] || null;
    const jaAssinado = contrato?.status === 'assinado';
    const agora = new Date().toISOString();
    const urlPdf = body?.document?.signed_file || body?.signed_file || contrato?.url_pdf || '';

    // Log do webhook
    await base44.asServiceRole.entities.IntegrationLog.create({
      pedido_id: contrato?.pedido_id || pedidoIdByExternal || '',
      service: 'zapsign', step: `webhook_${eventAction || 'signed'}`,
      request: body, response: { found: !!contrato, external_id: pedidoIdByExternal }, ok: true,
    }).catch(e => console.warn('Erro ao salvar IntegrationLog:', e.message));

    // ── Documento RECUSADO ──────────────────────────────────────────────────
    if (isRecusado) {
      if (contrato) {
        await base44.asServiceRole.entities.Contrato.update(contrato.id, { status: 'recusado', data_assinatura: agora });
      }
      const pidRecusa = contrato?.pedido_id || pedidoIdByExternal;
      if (pidRecusa) {
        await base44.asServiceRole.entities.Pedido.update(pidRecusa, { status: 'recusado' }).catch(() => null);
      }
      return Response.json({ ok: true, msg: 'Documento recusado processado' });
    }

    // ── Documento ASSINADO ──────────────────────────────────────────────────
    const signer0 = (body?.signers || body?.document?.signers || [])[0] || {};
    const ipAssinante = signer0.ip || signer0.signer_ip || body?.ip || '';
    const navAssinante = signer0.user_agent || signer0.device || body?.user_agent || '';

    // 1. Atualiza o contrato → assinado
    if (contrato) {
      await base44.asServiceRole.entities.Contrato.update(contrato.id, {
        status: 'assinado',
        data_assinatura: agora,
        url_pdf: urlPdf,
        ...(ipAssinante ? { ip_assinante: ipAssinante } : {}),
        ...(navAssinante ? { navegador_assinante: navAssinante } : {}),
      });
    }

    let pedido = null;
    let notificacaoEnviada = false;
    const pidAssinatura = contrato?.pedido_id || pedidoIdByExternal;

    if (pidAssinatura) {
      pedido = await base44.asServiceRole.entities.Pedido.get(pidAssinatura);

      if (pedido) {
        // 2. Avança o pedido para "assinado"
        const statusNaoFinalizado = !['assinado', 'ativado', 'recusado'].includes(pedido.status);
        if (statusNaoFinalizado) {
          await base44.asServiceRole.entities.Pedido.update(pidAssinatura, {
            status: 'assinado',
            data_contrato: agora,
            link_assinatura: urlPdf || pedido.link_assinatura,
            signed_file_url: urlPdf || '',
          });
          console.log(`Pedido ${pidAssinatura} avançado para "assinado"`);
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

        const podeNotificar = vendedorEmail && !jaAssinado && !pedido.email_assinatura_enviado;
        if (podeNotificar) {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: vendedorEmail,
            from_name: 'CRM — ZapSign',
            subject: `✅ Contrato assinado: ${pedido.lead_nome}`,
            body: `Olá ${pedido.vendedor_nome || 'Vendedor'},\n\n🎉 O cliente ${pedido.lead_nome} assinou o contrato no ZapSign!\n\nO status do pedido foi atualizado automaticamente para "Assinado".\n\nPróximos passos:\n1. Verificar viabilidade técnica (se ainda pendente)\n2. Ativar cliente no IXC\n3. Registrar OS de instalação\n\nAcesse o CRM para prosseguir.\n\n---\nEsta é uma mensagem automática. Não responda este e-mail.`,
          });
          await base44.asServiceRole.entities.Pedido.update(pidAssinatura, { email_assinatura_enviado: true }).catch(() => null);
          notificacaoEnviada = true;
          console.log(`E-mail de notificação enviado para ${vendedorEmail}`);
        } else if (!vendedorEmail) {
          console.warn('Vendedor sem e-mail cadastrado, notificação não enviada.');
        }
      }
    }

    return Response.json({
      ok: true,
      contrato_id: contrato?.id || null,
      pedido_id: pidAssinatura || null,
      notificacao_enviada: notificacaoEnviada,
    });
  } catch (error) {
    console.error('Erro no webhook ZapSign:', error.message);
    // Sempre responde 200 para o ZapSign não reenviar indefinidamente
    return Response.json({ ok: false, error: error.message });
  }
});