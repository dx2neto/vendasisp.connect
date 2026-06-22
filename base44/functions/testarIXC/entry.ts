import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const host = (Deno.env.get('IXC_HOST') || '')
      .replace(/\/+$/, '')
      .replace(/\/webservice\/v1$/i, '');
    const token = Deno.env.get('IXC_TOKEN') || '';
    const legacyAuth = (Deno.env.get('IXC_AUTH_BASIC') || '').replace(/^Basic\s+/i, '');
    const auth = legacyAuth || (token ? btoa(token) : '');

    if (!host || !auth) {
      return Response.json({ ok: false, error: 'IXC_HOST e IXC_TOKEN não configurados' });
    }

    // get_tok is not available in every IXC release; a one-row list validates
    // host and credentials against the API used by the real synchronization.
    const url = `${host}/webservice/v1/cliente`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
        ixcsoft: 'listar',
      },
      body: JSON.stringify({
        qtype: 'cliente.id', query: '', oper: '>', page: '1', rp: '1',
        sortname: 'cliente.id', sortorder: 'asc',
      }),
    });

    const text = await resp.text();
    let data = null;
    try { data = JSON.parse(text); } catch { data = text; }

    if (resp.ok) {
      return Response.json({ ok: true, status: resp.status, msg: 'Conexão com IXC bem-sucedida', data });
    } else {
      const detail = typeof data === 'string' ? data : data?.message || data?.error || JSON.stringify(data);
      return Response.json({ ok: false, status: resp.status, error: `IXC respondeu HTTP ${resp.status}: ${detail}`, data });
    }
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});
