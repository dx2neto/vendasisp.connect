import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const { webhook_url } = await req.json();
    const EVOLUTION_URL = Deno.env.get('EVOLUTION_URL');
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');
    const EVOLUTION_INSTANCE_ID = Deno.env.get('EVOLUTION_INSTANCE_ID');

    if (!EVOLUTION_URL || !EVOLUTION_API_KEY) {
      return Response.json({ error: 'EVOLUTION_URL e EVOLUTION_API_KEY não configurados' }, { status: 400 });
    }

    const resp = await fetch(`${EVOLUTION_URL}/instance/connect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY,
        'instanceId': EVOLUTION_INSTANCE_ID || '',
      },
      body: JSON.stringify({
        webhookUrl: webhook_url,
        subscribe: ['MESSAGE', 'SEND_MESSAGE', 'CONNECTION', 'READ_RECEIPT', 'QRCODE'],
        immediate: true,
      }),
    });

    const ret = await resp.json().catch(() => ({}));
    return Response.json({ success: resp.ok, resultado: ret });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});