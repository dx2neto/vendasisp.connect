import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { enviarWhatsApp } from "../../shared/evolutionClient.ts";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // ── Verificação de origem: secret compartilhado ──────────────────────
    const zapToken = Deno.env.get('ZAPSIGN_TOKEN') || '';
    const providedSecret = req.headers.get('x-webhook-secret') || new URL(req.url).searchParams.get('secret') || '';
    if (zapToken && providedSecret !== zapToken) {
      console.warn('Webhook ZapSign rejeitado: secret inválido');
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    console.log('ZapSign webhook recebido:', JSON.stringify(body).slice(0, 300));

    const docToken = body?.document?.token || body?.token || '';
    if (!docToken) return Response.json({ ok: false, msg: 'token do documento ausente' });

    const eventAction = body?.event_action || body?.action || body?.event || body?.type || '';
    const isAssinado = !eventAction || eventAction === 'sign_doc' || eventAction === 'doc_signed';
    const isRecusado = eventAction === 'doc_refused';

    if (!isAssinado && !isRecusado) return Response.json({ ok: true, msg: `Evento ignorado: ${eventAction}` });

    let contratos = await base44.asServiceRole.entities.Contrato.filter({ id_zapsign: docToken });
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

    await base44.asServiceRole.entities.IntegrationLog.create({
      pedido_id: contrato?.pedido_id || pedidoIdByExternal || '',
      service: 'zapsign', step: `webhook_${eventAction || 'signed'}`,
      request: body, response: { found: !!contrato, external_id: pedidoIdByExternal }, ok: true,
    }).catch((e: Error) => console.warn('Erro ao salvar IntegrationLog:', e.message));

    if (isRecusado) {
      if (contrato) await base44.asServiceRole.entities.Contrato.update(contrato.id, { status: 'recusado', data_assinatura: agora });
      const pidRecusa = contrato?.pedido_id || pedidoIdByExternal;
      if (pidRecusa) await base44.asServiceRole.entities.Pedido.update(pidRecusa, { status: 'recusado' }).catch(() => null);
      return Response.json({ ok: true, msg: 'Documento recusado processado' });
    }

    const signer0 = (body?.signers || body?.document?.signers || [])[0] || {};
    const ipAssinante = signer0.ip || signer0.signer_ip || body?.ip || '';
    const navAssinante = signer0.user_agent || signer0.device || body?.user_agent || '';

    if (contrato) {
      await base44.asServiceRole.entities.Contrato.update(contrato.id, {
        status: 'assinado', data_assinatura: agora, url_pdf: urlPdf,
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
        const statusNaoFinalizado = !['assinado', 'ativado', 'recusado'].includes(pedido.status);
        if (statusNaoFinalizado) {
          await base44.asServiceRole.entities.Pedido.update(pidAssinatura, {
            status: 'assinado', data_contrato: agora,
            link_assinatura: urlPdf || pedido.link_assinatura, signed_file_url: urlPdf || '',
          });
          console.log(`Pedido ${pidAssinatura} avançado para "assinado"`);
        }

        if (pedido.lead_id) {
          await base44.asServiceRole.entities.Lead.update(pedido.lead_id, { etapa_funil: 'contrato' }).catch((e: Error) => console.warn('Erro ao atualizar lead:', e.message));
        }

        const vendedor = pedido.vendedor_id ? await base44.asServiceRole.entities.User.get(pedido.vendedor_id).catch(() => null) : null;
        const vendedorEmail = vendedor?.email || '';
        const podeNotificar = vendedorEmail && !jaAssinado && !pedido.email_assinatura_enviado;
        if (podeNotificar) {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: vendedorEmail, from_name: 'CRM — ZapSign',
            subject: `✅ Contrato assinado: ${pedido.lead_nome}`,
            body: `Olá ${pedido.vendedor_nome || 'Vendedor'},\n\n🎉 O cliente ${pedido.lead_nome} assinou o contrato no ZapSign!\n\nO status do pedido foi atualizado automaticamente para "Assinado".\n\nPróximos passos:\n1. Verificar viabilidade técnica (se ainda pendente)\n2. Ativar cliente no IXC\n3. Registrar OS de instalação\n\nAcesse o CRM para prosseguir.\n\n---\nEsta é uma mensagem automática. Não responda este e-mail.`,
          });
          await base44.asServiceRole.entities.Pedido.update(pidAssinatura, { email_assinatura_enviado: true }).catch(() => null);
          notificacaoEnviada = true;
          console.log(`E-mail de notificação enviado para ${vendedorEmail}`);
        }
      }
    }

    if (!jaAssinado) {
      try {
        const configs = await base44.asServiceRole.entities.ConfigRegras.list();
        const cfg = configs[0] || {};
        const gerentePhone = (cfg.gerente_whatsapp || '').replace(/\D/g, '');
        if (gerentePhone) {
          const nomeCliente = pedido?.lead_nome || contrato?.cliente_nome || 'Cliente';
          const planoNome = pedido?.plano_nome || '';
          const valor = pedido?.valor != null ? `R$ ${Number(pedido.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '';
          const vendedorNome = pedido?.vendedor_nome || '';
          const msg = `✅ *CONTRATO ASSINADO*\n\n👤 Cliente: *${nomeCliente}*\n📦 Plano: ${planoNome}\n💰 Valor: ${valor}\n👨‍💼 Vendedor: ${vendedorNome}\n\nO contrato foi assinado e o pedido foi atualizado para "Assinado".\nVerifique os próximos passos no CRM.`;
          const waResult = await enviarWhatsApp(base44, gerentePhone, msg);
          if (waResult.ok) console.log(`Alerta WhatsApp enviado ao gerente: ${gerentePhone}`);
          else console.warn(`Falha ao enviar WhatsApp ao gerente: ${waResult.error}`);
        } else {
          console.warn('gerente_whatsapp não configurado em ConfigRegras, alerta não enviado.');
        }
      } catch (waErr) {
        console.warn('Erro ao enviar alerta WhatsApp ao gerente:', (waErr as Error).message);
      }
    }

    return Response.json({ ok: true, contrato_id: contrato?.id || null, pedido_id: pidAssinatura || null, notificacao_enviada: notificacaoEnviada });
  } catch (error) {
    console.error('Erro no webhook ZapSign:', (error as Error).message);
    return Response.json({ ok: false, error: (error as Error).message });
  }
});