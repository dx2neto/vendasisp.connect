import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  // Responde rápido
  const body = await req.json().catch(() => ({}));
  const base44 = createClientFromRequest(req);
  const db = base44.asServiceRole;

  // Processa em background
  (async () => {
    try {
      const event = body.event || body.Event || body.type || '';
      const data = body.data || body.Data || body.payload || {};

      if (event === 'Message' || event === 'messages.upsert') {
        // Suporte a formato Evolution API v2
        const msgs = data?.messages || (data ? [data] : []);
        for (const msg of msgs) {
          const info = msg.Info || msg.key || {};
          const isFromMe = info.IsFromMe || info.fromMe || msg.key?.fromMe;
          const isGroup = info.IsGroup || (info.remoteJid || '').includes('@g.us');
          if (isFromMe || isGroup) continue;

          const chatRaw = info.Chat || info.remoteJid || msg.key?.remoteJid || '';
          const telefone = chatRaw.replace(/@.*/, '').replace(/:.*/, '').replace(/\D/g, '');
          if (!telefone) continue;

          const pushName = info.PushName || msg.pushName || '';
          const waId = info.ID || msg.key?.id || '';

          // Tipo e conteúdo
          const message = msg.Message || msg.message || {};
          let tipo = 'texto';
          let conteudo = message.conversation || message.extendedTextMessage?.text || '';
          if (message.imageMessage) { tipo = 'imagem'; conteudo = message.imageMessage.caption || '[imagem]'; }
          else if (message.audioMessage) { tipo = 'audio'; conteudo = '[áudio]'; }
          else if (message.videoMessage) { tipo = 'video'; conteudo = message.videoMessage.caption || '[vídeo]'; }
          else if (message.documentMessage) { tipo = 'documento'; conteudo = message.documentMessage.fileName || '[documento]'; }
          else if (message.locationMessage) { tipo = 'localizacao'; conteudo = '[localização]'; }
          if (!conteudo) conteudo = '[mensagem]';

          // Busca ou cria contato
          let contatos = await db.entities.Contato.filter({ telefone });
          let contato = contatos[0];
          if (!contato) {
            contato = await db.entities.Contato.create({ telefone, nome: pushName || telefone, push_name: pushName });
          } else if (pushName && !contato.push_name) {
            await db.entities.Contato.update(contato.id, { push_name: pushName, nome: contato.nome || pushName });
          }

          // Busca ou cria conversa aberta
          const conversas = await db.entities.Conversa.filter({ contato_id: contato.id });
          let conversa = conversas.find(c => c.status === 'aguardando' || c.status === 'em_atendimento');
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

          // Salva mensagem
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
      }

      if (event === 'Receipt' || event === 'message.receipt.update') {
        const messageIds = data?.MessageIDs || data?.messageIds || [];
        const state = data?.state || data?.status || '';
        const novoStatus = state === 'Read' || state === 'READ' ? 'lido' : 'entregue';
        for (const waId of messageIds) {
          const msgs = await db.entities.Mensagem.filter({ wa_id: waId });
          for (const m of msgs) {
            await db.entities.Mensagem.update(m.id, { status: novoStatus });
          }
        }
      }

      // === Eventos de conexão Evolution Go ===
      if (event === 'QRCode' || event === 'qrcode') {
        const qr = data?.qrcode?.base64 || data?.qrcode || data?.base64 || data?.qr || '';
        if (qr) {
          const statusList = await db.entities.EvolutionStatus.list();
          const s = statusList[0];
          if (s) {
            await db.entities.EvolutionStatus.update(s.id, {
              qr_code: qr,
              status_conexao: 'aguardando_qr',
              ultimo_evento: 'QRCode',
            });
          }
        }
      }

      if (event === 'Connected' || event === 'PairSuccess') {
        const phone = data?.phone || data?.number || '';
        const statusList = await db.entities.EvolutionStatus.list();
        const s = statusList[0];
        if (s) {
          await db.entities.EvolutionStatus.update(s.id, {
            status_conexao: 'conectado',
            qr_code: '',
            phone_connected: phone,
            ultimo_evento: event,
          });
        }
      }

      if (event === 'LoggedOut' || event === 'Disconnected' || event === 'OfflineSyncCompleted') {
        const statusList = await db.entities.EvolutionStatus.list();
        const s = statusList[0];
        if (s) {
          await db.entities.EvolutionStatus.update(s.id, {
            status_conexao: event === 'OfflineSyncCompleted' ? s.status_conexao : 'desconectado',
            ultimo_evento: event,
          });
        }
      }
    } catch (e) {
      console.error('Webhook error:', e.message);
    }
  })();

  return Response.json({ ok: true });
});
