import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const { webhook_url } = await req.json();
    if (!webhook_url) return Response.json({ error: 'webhook_url obrigatório' }, { status: 400 });

    const url = (Deno.env.get('EVOLUTION_URL') || '').replace(/\/+$/, '');
    const apiKey = Deno.env.get('EVOLUTION_INSTANCE_TOKEN') || Deno.env.get('EVOLUTION_API_KEY') || '';
    const instanceId = Deno.env.get('EVOLUTION_INSTANCE_ID') || '';
    if (!url || !apiKey) return Response.json({ error: 'Evolution Go não configurado' }, { status: 400 });

    const resp = await fetch(`${url}/instance/connect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: apiKey,
        ...(instanceId ? { instanceId } : {}),
      },
      body: JSON.stringify({
        webhookUrl: webhook_url,
        subscribe: ['MESSAGE', 'SEND_MESSAGE', 'READ_RECEIPT', 'CONNECTION', 'QRCODE'],
        immediate: true,
      }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return Response.json({ error: data?.error?.message || data?.error || data?.message || `HTTP ${resp.status}` }, { status: resp.status });
    }
    return Response.json({ success: true, resultado: data });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
