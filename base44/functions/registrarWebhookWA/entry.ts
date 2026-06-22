import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const { webhook_url } = await req.json();
    if (!webhook_url) return Response.json({ error: 'webhook_url obrigatório' }, { status: 400 });

    const EVOLUTION_URL = (Deno.env.get('EVOLUTION_URL') || '').replace(/\/$/, '');
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');
    const EVOLUTION_INSTANCE_ID = Deno.env.get('EVOLUTION_INSTANCE_ID') || '';

    if (!EVOLUTION_URL || !EVOLUTION_API_KEY) {
      return Response.json({ error: 'EVOLUTION_URL e EVOLUTION_API_KEY não configurados' }, { status: 400 });
    }

    const headers = {
      'Content-Type': 'application/json',
      'apikey': EVOLUTION_API_KEY,
      ...(EVOLUTION_INSTANCE_ID ? { instanceId: EVOLUTION_INSTANCE_ID } : {}),
    };
    const inst = encodeURIComponent(EVOLUTION_INSTANCE_ID);

    // Tentativas em ordem — usa a primeira que responder OK. Cobre Evolution v2 e variações.
    const tentativas = [
      {
        nome: 'webhook/set (v2)',
        url: `${EVOLUTION_URL}/webhook/set/${inst}`,
        body: {
          webhook: {
            enabled: true,
            url: webhook_url,
            webhookByEvents: false,
            events: ['MESSAGES_UPSERT', 'SEND_MESSAGE', 'CONNECTION_UPDATE', 'QRCODE_UPDATED'],
          },
        },
      },
      {
        nome: 'webhook/set (flat)',
        url: `${EVOLUTION_URL}/webhook/set/${inst}`,
        body: {
          url: webhook_url,
          webhook_by_events: false,
          events: ['MESSAGES_UPSERT', 'SEND_MESSAGE', 'CONNECTION_UPDATE', 'QRCODE_UPDATED'],
        },
      },
      {
        nome: 'instance/connect (legado)',
        url: `${EVOLUTION_URL}/instance/connect`,
        body: {
          webhookUrl: webhook_url,
          subscribe: ['MESSAGE', 'SEND_MESSAGE', 'CONNECTION', 'READ_RECEIPT', 'QRCODE'],
          immediate: true,
        },
      },
    ];

    const log = [];
    for (const t of tentativas) {
      try {
        const resp = await fetch(t.url, { method: 'POST', headers, body: JSON.stringify(t.body) });
        const ret = await resp.json().catch(() => ({}));
        log.push({ via: t.nome, status: resp.status, ok: resp.ok });
        if (resp.ok) {
          return Response.json({ success: true, via: t.nome, status: resp.status, resultado: ret, tentativas: log });
        }
      } catch (e) {
        log.push({ via: t.nome, erro: e.message });
      }
    }

    return Response.json({
      success: false,
      error: 'Nenhum endpoint de webhook aceito pela Evolution. Verifique a versão/instância.',
      tentativas: log,
    }, { status: 502 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
