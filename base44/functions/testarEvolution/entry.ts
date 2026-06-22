import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });

    const EVOLUTION_URL = (Deno.env.get('EVOLUTION_URL') || '').replace(/\/$/, '');
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');
    const EVOLUTION_INSTANCE_ID = Deno.env.get('EVOLUTION_INSTANCE_ID');

    if (!EVOLUTION_URL || !EVOLUTION_API_KEY) {
      return Response.json({ ok: false, error: 'EVOLUTION_URL e EVOLUTION_API_KEY não configurados' });
    }

    // Testa conexão listando instâncias (GET /instance/fetchInstances)
    let resp;
    let data = {};
    try {
      resp = await fetch(`${EVOLUTION_URL}/instance/fetchInstances`, {
        method: 'GET',
        headers: { 'apikey': EVOLUTION_API_KEY },
      });
      data = await resp.json().catch(() => ({}));
    } catch (e) {
      return Response.json({ ok: false, error: `Não foi possível conectar ao servidor: ${e.message}` });
    }

    // 401/403 = servidor online mas chave inválida; 404 = servidor online mas endpoint diferente
    if (resp.status === 401 || resp.status === 403) {
      return Response.json({ ok: false, error: `Servidor online mas API Key rejeitada (${resp.status})` });
    }

    // Qualquer resposta (mesmo 404) indica que o servidor está acessível
    const serverOnline = resp.status < 500;

    // Se tiver instance_id, tenta buscar status da instância
    let instanceInfo = null;
    if (EVOLUTION_INSTANCE_ID) {
      try {
        const instResp = await fetch(`${EVOLUTION_URL}/instance/fetchInstances`, {
          method: 'GET',
          headers: {
            'apikey': EVOLUTION_API_KEY,
            'instanceId': EVOLUTION_INSTANCE_ID,
          },
        });
        if (instResp.ok) {
          instanceInfo = await instResp.json().catch(() => null);
        }
      } catch (e) {
        // ignora erro de instância
      }
    }

    return Response.json({
      ok: serverOnline,
      servidor: serverOnline ? 'online' : 'offline',
      url: EVOLUTION_URL,
      instance_id: EVOLUTION_INSTANCE_ID || null,
      instance: instanceInfo,
      http_status: resp.status,
    });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});