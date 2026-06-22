import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });

    const { conversa_id, texto } = await req.json();
    if (!conversa_id || !texto) return Response.json({ error: 'conversa_id e texto são obrigatórios' }, { status: 400 });

    const db = base44.asServiceRole;
    const conversa = await db.entities.Conversa.get(conversa_id);
    if (!conversa) return Response.json({ error: 'Conversa não encontrada' }, { status: 404 });

    const telefone = conversa.contato_telefone;
    const EVOLUTION_URL = Deno.env.get('EVOLUTION_URL');
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');
    const EVOLUTION_INSTANCE_TOKEN = Deno.env.get('EVOLUTION_INSTANCE_TOKEN');
    let EVOLUTION_INSTANCE_ID = Deno.env.get('EVOLUTION_INSTANCE_ID') || '';
    if (!EVOLUTION_INSTANCE_ID) {
      const statuses = await db.entities.EvolutionStatus.list();
      EVOLUTION_INSTANCE_ID = statuses[0]?.instance_id || '';
    }

    let waId = null;
    let statusMsg = 'enviado';

    if (EVOLUTION_URL && EVOLUTION_API_KEY && EVOLUTION_INSTANCE_ID) {
      const resp = await fetch(`${EVOLUTION_URL}/send/text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_INSTANCE_TOKEN || EVOLUTION_API_KEY,
          'instanceId': EVOLUTION_INSTANCE_ID,
        },
        body: JSON.stringify({ number: telefone, text: texto }),
      });

      if (resp.ok) {
        const ret = await resp.json().catch(() => ({}));
        waId = ret?.data?.Info?.ID || ret?.Info?.ID || ret?.messageId || null;
        statusMsg = 'enviado';
      } else {
        statusMsg = 'erro';
      }
    } else {
      statusMsg = 'erro';
    }

    // Salva mensagem no banco
    const msg = await db.entities.Mensagem.create({
      conversa_id,
      direcao: 'out',
      autor: user.full_name || user.email,
      tipo: 'texto',
      conteudo: texto,
      wa_id: waId,
      status: statusMsg,
    });

    // Atualiza conversa
    await db.entities.Conversa.update(conversa_id, {
      ultima_msg: texto,
      ultima_em: new Date().toISOString(),
    });

    return Response.json({ success: true, mensagem: msg, status: statusMsg });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
