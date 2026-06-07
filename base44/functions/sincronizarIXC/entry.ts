import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const IXC_HOST = () => Deno.env.get('IXC_HOST') || '';
const IXC_AUTH = () => Deno.env.get('IXC_AUTH_BASIC') || '';

async function ixcRequest(endpoint, body = null) {
  const url = `${IXC_HOST()}/webservice/v1/${endpoint}`;
  const opts = {
    method: 'POST',
    headers: {
      Authorization: `Basic ${IXC_AUTH()}`,
      'Content-Type': 'application/json',
      ixcsoft: 'listar',
    },
    body: JSON.stringify(body || { qtype: 'id', query: '', oper: '>', page: '1', rp: '1000', sortname: 'id', sortorder: 'asc' }),
  };
  const resp = await fetch(url, opts);
  const data = await resp.json();
  return { ok: resp.ok, data };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!IXC_HOST() || !IXC_AUTH()) return Response.json({ error: 'IXC não configurado' }, { status: 500 });

    const { tipo } = await req.json();
    const resultados = {};

    // ── Filiais ─────────────────────────────────────────────────────────
    if (!tipo || tipo === 'filiais') {
      const r = await ixcRequest('filiais');
      resultados.filiais = r.ok ? (r.data?.registros || r.data || []) : [];
    }

    // ── Vendedores ───────────────────────────────────────────────────────
    if (!tipo || tipo === 'vendedores') {
      const r = await ixcRequest('vendedor');
      resultados.vendedores = r.ok ? (r.data?.registros || r.data || []) : [];
    }

    // ── Planos (radaccess) ───────────────────────────────────────────────
    if (!tipo || tipo === 'planos') {
      const r = await ixcRequest('radaccess');
      resultados.planos_ixc = r.ok ? (r.data?.registros || r.data || []) : [];
    }

    // ── Produtos (modelos de contrato) ───────────────────────────────────
    if (!tipo || tipo === 'produtos') {
      const r = await ixcRequest('produto');
      resultados.produtos_ixc = r.ok ? (r.data?.registros || r.data || []) : [];
    }

    // ── Assuntos OS ──────────────────────────────────────────────────────
    if (!tipo || tipo === 'assuntos') {
      const r = await ixcRequest('su_assunto_chamado');
      resultados.assuntos_os = r.ok ? (r.data?.registros || r.data || []) : [];
    }

    // ── Setores OS ───────────────────────────────────────────────────────
    if (!tipo || tipo === 'setores') {
      const r = await ixcRequest('setor');
      resultados.setores_os = r.ok ? (r.data?.registros || r.data || []) : [];
    }

    // ── Sincronizar planos do CRM com IDs do IXC (se solicitado) ─────────
    if (tipo === 'sync_planos' && resultados.planos_ixc) {
      const planosCRM = await base44.asServiceRole.entities.Plano.list();
      const updates = [];
      for (const p of planosCRM) {
        const match = resultados.planos_ixc.find(ix =>
          ix.login?.toLowerCase() === p.nome.toLowerCase() ||
          String(ix.id) === String(p.id_modelo_ixc)
        );
        if (match && !p.id_modelo_ixc) {
          await base44.asServiceRole.entities.Plano.update(p.id, { id_modelo_ixc: String(match.id) });
          updates.push({ plano: p.nome, id_modelo_ixc: match.id });
        }
      }
      resultados.planos_atualizados = updates;
    }

    return Response.json({ success: true, ...resultados });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});