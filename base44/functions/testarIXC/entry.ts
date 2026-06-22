import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const host = (Deno.env.get('IXC_HOST') || '').replace(/\/$/, '');
    const auth = Deno.env.get('IXC_AUTH_BASIC');

    if (!host || !auth) {
      return Response.json({ ok: false, error: 'IXC_HOST ou IXC_AUTH_BASIC não configurados' });
    }

    const headers = {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
      ixcsoft: 'listar',
    };

    // 1) Teste leve via get_tok (GET)
    try {
      const r = await fetch(`${host}/webservice/v1/get_tok`, { method: 'GET', headers });
      if (r.ok) {
        return Response.json({ ok: true, status: r.status, via: 'get_tok', msg: 'Conexão com IXC bem-sucedida' });
      }
    } catch (_) { /* tenta o fallback */ }

    // 2) Fallback: lista 1 registro de filial (nomes variam por instância)
    const body = JSON.stringify({ qtype: 'id', query: '', oper: '>', page: '1', rp: '1', sortname: 'id', sortorder: 'asc' });
    for (const ep of ['filial', 'filiais']) {
      try {
        const r = await fetch(`${host}/webservice/v1/${ep}`, { method: 'POST', headers, body });
        const data = await r.json().catch(() => null);
        if (r.ok && data) {
          const total = data?.total ?? (Array.isArray(data?.registros) ? data.registros.length : undefined);
          return Response.json({ ok: true, status: r.status, via: ep, total, msg: 'Conexão com IXC bem-sucedida' });
        }
      } catch (_) { /* tenta o próximo */ }
    }

    return Response.json({ ok: false, msg: 'Falha na conexão com IXC. Verifique IXC_HOST e IXC_AUTH_BASIC (token no formato id:hash em Base64).' });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});
