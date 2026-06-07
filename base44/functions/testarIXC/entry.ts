import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const host = Deno.env.get('IXC_HOST');
    const auth = Deno.env.get('IXC_AUTH_BASIC');

    if (!host || !auth) {
      return Response.json({ ok: false, error: 'IXC_HOST ou IXC_AUTH_BASIC não configurados' });
    }

    const url = `${host}/webservice/v1/get_tok`;
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
        ixcsoft: 'listar',
      },
    });

    const text = await resp.text();
    let data = null;
    try { data = JSON.parse(text); } catch { data = text; }

    if (resp.ok) {
      return Response.json({ ok: true, status: resp.status, msg: 'Conexão com IXC bem-sucedida', data });
    } else {
      return Response.json({ ok: false, status: resp.status, msg: 'Falha na conexão com IXC', data });
    }
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});