import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });

    const EVOLUTION_URL = (Deno.env.get('EVOLUTION_URL') || '').replace(/\/$/, '');
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');
    let EVOLUTION_INSTANCE_ID = Deno.env.get('EVOLUTION_INSTANCE_ID') || '';

    if (!EVOLUTION_URL || !EVOLUTION_API_KEY) {
      return Response.json({ ok: false, error: 'EVOLUTION_URL e EVOLUTION_API_KEY não configurados' });
    }

    if (!EVOLUTION_INSTANCE_ID) {
      const statuses = await base44.asServiceRole.entities.EvolutionStatus.list();
      EVOLUTION_INSTANCE_ID = statuses[0]?.instance_id || '';
    }

    // Evolution Go exposes the instance collection at GET /instance/all.
    let resp;
    let data = {};
    try {
      resp = await fetch(`${EVOLUTION_URL}/instance/all`, {
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
    const serverOnline = resp.ok;

    const instances = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
    const instanceInfo = EVOLUTION_INSTANCE_ID
      ? instances.find((item) => item.id === EVOLUTION_INSTANCE_ID || item.name === EVOLUTION_INSTANCE_ID) || null
      : null;

    return Response.json({
      ok: serverOnline,
      servidor: serverOnline ? 'online' : 'offline',
      url: EVOLUTION_URL,
      instance_id: EVOLUTION_INSTANCE_ID || null,
      instance: instanceInfo,
      instances_count: instances.length,
      http_status: resp.status,
      error: serverOnline ? undefined : (data?.message || data?.error || `Evolution respondeu HTTP ${resp.status}`),
    });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});
