import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  // Responde rápido
  const body = await req.json().catch(() => ({}));
  const base44 = createClientFromRequest(req);
  const db = base44.asServiceRole;

  // Processa em background
  (async () => {
    try {
      const event = body.event || body.type;
      const data = body.data || body;

      // === EVENTO: Mensagem recebida ===
      if (event === 'message' || event === 'messages.upsert') {
        const msg = data.message || data.messageData || data;
        if (!msg?.key?.remoteJid) return;

        const isFromMe = msg.key?.fromMe === true;
        const isGroup = msg.key?.remoteJid?.includes('@g.us');
        if (isFromMe || isGroup) return;

        // Extrai telefone
        const telefone = msg.key.remoteJid.replace(/@.*/, '').replace(/\D/g, '');
        if (!telefone) return;

        const pushName = msg.pushName || msg.verifiedName || '';
        const waId = msg.key?.id || '';

        // Extrai tipo e conteúdo
        let tipo = 'texto';
        let conteudo = '';
        const messageContent = msg.message || {};

        if (messageContent.conversation) conteudo = messageContent.conversation;
        else if (messageContent.extendedTextMessage?.text) conteudo = messageContent.extendedTextMessage.text;
        else if (messageContent.imageMessage) { tipo = 'imagem'; conteudo = messageContent.imageMessage.caption || '[imagem]'; }
        else if (messageContent.audioMessage) { tipo = 'audio'; conteudo = '[áudio]'; }
        else if (messageContent.videoMessage) { tipo = 'video'; conteudo = messageContent.videoMessage.caption || '[vídeo]'; }
        else if (messageContent.documentMessage) { tipo = 'documento'; conteudo = messageContent.documentMessage.fileName || '[documento]'; }
        else if (messageContent.locationMessage) { tipo = 'localizacao'; conteudo = '[localização]'; }

        if (!conteudo) conteudo = '[mensagem]';

        // Contato
        let contatos = await db.entities.Contato.filter({ telefone });
        let contato = contatos[0];
        if (!contato) {
          contato = await db.entities.Contato.create({ telefone, nome: pushName || telefone, push_name: pushName });
        } else if (pushName && !contato.push_name) {
          await db.entities.Contato.update(contato.id, { push_name: pushName, nome: contato.nome || pushName });
        }

        // Conversa
        const conversas = await db.entities.Conversa.filter({ contato_id: contato.id });
        let conversa = conversas.find(c => ['aguardando', 'em_atendimento'].includes(c.status));
        if (!conversa) {
          conversa = await db.entities.Conversa.create({
            contato_id: contato.id,
            contato_nome: contato.nome || pushName || telefone,
            contato_telefone: telefone,
            status: 'aguardando',
            nao_lidas: 0,
            ultima_msg: conteudo,
            ultima_em: new Date().toISOString(),
          });
        }

        // Mensagem
        await db.entities.Mensagem.create({
          conversa_id: conversa.id,
          direcao: 'in',
          tipo,
          conteudo,
          wa_id: waId,
          status: 'entregue',
        });

        // Atualiza conversa
        await db.entities.Conversa.update(conversa.id, {
          nao_lidas: (conversa.nao_lidas || 0) + 1,
          ultima_msg: conteudo,
          ultima_em: new Date().toISOString(),
        });
      }

      // === EVENTO: Status de mensagem ===
      if (event === 'message.update' || event === 'message.receipt.update') {
        const messageIds = data?.messages || data?.messageIds || [];
        const statusMap = { 'RECEIVED': 'entregue', 'READ': 'lido', 'PLAYED': 'lido' };
        const novoStatus = statusMap[data?.status] || data?.state || 'entregue';

        for (const waId of messageIds) {
          const msgs = await db.entities.Mensagem.filter({ wa_id: waId });
          for (const m of msgs) {
            await db.entities.Mensagem.update(m.id, { status: novoStatus });
          }
        }
      }

      // === EVENTO: QR Code ===
      if (event === 'qrcode') {
        const qr = data?.qrcode || data?.base64 || '';
        if (qr) {
          const statusList = await db.entities.EvolutionStatus.list();
          const s = statusList[0];
          if (s) {
            await db.entities.EvolutionStatus.update(s.id, {
              qr_code: qr,
              status_conexao: 'aguardando_qr',
              ultimo_evento: 'qrcode',
            });
          }
        }
      }

      // === EVENTO: Conexão ===
      if (event === 'connection') {
        const statusMap = { 'OPEN': 'conectado', 'CLOSE': 'desconectado', 'CONNECTING': 'aguardando_qr' };
        const novoStatus = statusMap[data?.status] || data?.status || 'desconectado';
        const phone = data?.phone || data?.number || '';

        const statusList = await db.entities.EvolutionStatus.list();
        const s = statusList[0];
        if (s) {
          await db.entities.EvolutionStatus.update(s.id, {
            status_conexao: novoStatus,
            qr_code: novoStatus === 'aguardando_qr' ? s.qr_code : '',
            phone_connected: novoStatus === 'conectado' ? phone : s.phone_connected,
            ultimo_evento: data?.status || event,
          });
        }
      }
    } catch (e) {
      console.error('Webhook error:', e.message);
    }
  })();

  return Response.json({ ok: true });
});