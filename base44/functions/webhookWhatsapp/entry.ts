import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  // Parse do payload
  let body = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ received: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { event, data, instanceId, instanceToken } = body;

  // Responde 200 imediatamente
  // Processamento pesado ocorre em background
  (async () => {
    try {
      const base44 = createClientFromRequest(req);
      const db = base44.asServiceRole;

      switch (event) {
        // === MESSAGE: Mensagem recebida ===
        case 'Message': {
          if (!data?.Info || !data?.Message) break;

          const info = data.Info;

          // Ignora mensagens enviadas pela própria instância
          if (info.IsFromMe === true) break;

          // Ignora grupos
          if (info.IsGroup === true) break;

          // Extrai informações
          const chatJid = info.Chat || '';
          const senderJid = info.Sender || '';
          const messageId = info.ID || '';
          const pushName = info.PushName || '';
          const type = info.Type || 'text';
          const mediaType = info.MediaType || null;
          const timestamp = info.Timestamp ? new Date(info.Timestamp * 1000).toISOString() : new Date().toISOString();

          if (!messageId || !chatJid) break;

          // Extrai o texto (para mensagens de texto)
          let text = '';
          if (type === 'text') {
            text = data.Message.conversation || '';
          }

          // Extrai mídia (base64 ou URL)
          let mediaUrl = '';
          if (type === 'media') {
            mediaUrl = data.Message.mediaUrl || (data.Message.base64 ? `data:${mediaType};base64,...` : '');
          }

          // Cria registro de mensagem
          await db.entities.WhatsAppMessage.create({
            messageId,
            chatJid,
            senderJid,
            pushName,
            type,
            text,
            mediaType: mediaType || null,
            mediaUrl,
            isFromMe: false,
            isGroup: false,
            timestamp,
            instanceId,
            rawPayload: { event, data, timestamp: new Date().toISOString() },
          });

          break;
        }

        // === QRCODE: Pareamento ===
        case 'QRCode': {
          if (!data?.qrcode) break;

          const instances = await db.entities.Instance.filter({ instanceId });
          const instance = instances[0];

          if (instance) {
            await db.entities.Instance.update(instance.id, {
              lastQrCode: data.qrcode,
            });
          } else {
            await db.entities.Instance.create({
              instanceId,
              status: 'waiting_qr',
              lastQrCode: data.qrcode,
            });
          }

          break;
        }

        // === CONNECTED: Conexão estabelecida ===
        case 'Connected': {
          const instances = await db.entities.Instance.filter({ instanceId });
          const instance = instances[0];
          const jid = data?.jid || '';
          const pushName = data?.pushName || '';

          if (instance) {
            await db.entities.Instance.update(instance.id, {
              status: 'connected',
              jid,
              pushName,
            });
          } else {
            await db.entities.Instance.create({
              instanceId,
              status: 'connected',
              jid,
              pushName,
            });
          }

          break;
        }

        // === PAIRSUCCESS: Pareamento concluído ===
        case 'PairSuccess': {
          const instances = await db.entities.Instance.filter({ instanceId });
          const instance = instances[0];

          if (instance) {
            await db.entities.Instance.update(instance.id, {
              status: 'pair_success',
            });
          }

          break;
        }

        // === LOGGEDOUT: Desconectado ===
        case 'LoggedOut': {
          const instances = await db.entities.Instance.filter({ instanceId });
          const instance = instances[0];

          if (instance) {
            await db.entities.Instance.update(instance.id, {
              status: 'disconnected',
            });
          }

          break;
        }

        // === RECEIPT: Confirmação de entrega/leitura ===
        case 'Receipt': {
          const state = body.state || data?.status || 'Delivered';
          const messageIds = data?.MessageIDs || data?.messageIds || [];

          const statusMap = {
            'Read': 'read',
            'ReadSelf': 'read',
            'Delivered': 'delivered',
            'PendingAck': 'pending',
          };

          const newStatus = statusMap[state] || 'delivered';

          // Atualiza mensagens com esse status
          for (const msgId of messageIds) {
            const msgs = await db.entities.WhatsAppMessage.filter({ messageId: msgId });
            for (const msg of msgs) {
              // Atualiza rawPayload com o novo status
              const updated = msg.rawPayload || {};
              updated.status = newStatus;
              await db.entities.WhatsAppMessage.update(msg.id, {
                rawPayload: updated,
              });
            }
          }

          break;
        }

        // Qualquer outro evento: apenas loga
        default: {
          console.log(`[Webhook] Evento desconhecido: ${event}`, { instanceId, data });
        }
      }
    } catch (error) {
      // Registra erro mas não afeta a resposta HTTP
      console.error(`[Webhook Error] ${error.message}`, { event, instanceId });
    }
  })();

  // Sempre retorna 200 para evitar reenvios do Evolution Go
  return Response.json({ received: true }, { status: 200 });
});