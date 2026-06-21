import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

async function ixcPost(url, auth, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${auth}`,
      'ixcsoft': 'listar',
    },
    body: JSON.stringify({ oper: '=', page: '1', rp: '20', sortorder: 'asc', ...body }),
  });
  if (!res.ok) return { total: 0, registros: [] };
  return res.json().catch(() => ({ total: 0, registros: [] }));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });

    const { telefone, documento, id } = await req.json();

    const IXC_HOST = Deno.env.get('IXC_HOST');
    const IXC_AUTH = Deno.env.get('IXC_AUTH_BASIC');

    if (!IXC_HOST || !IXC_AUTH) {
      return Response.json({ encontrado: false, erro: 'IXC não configurado' });
    }

    const base = IXC_HOST.replace(/\/$/, '');
    const clienteUrl = `${base}/webservice/v1/cliente`;

    let cliente = null;

    if (id) {
      const r = await ixcPost(clienteUrl, IXC_AUTH, { qtype: 'cliente.id', query: String(id), sortname: 'cliente.id' });
      cliente = r.registros?.[0] || null;
    } else if (documento) {
      const cpf = documento.replace(/\D/g, '');
      const r = await ixcPost(clienteUrl, IXC_AUTH, { qtype: 'cliente.cnpj_cpf', query: cpf, sortname: 'cliente.id' });
      cliente = r.registros?.[0] || null;
    } else if (telefone) {
      const tel = telefone.replace(/\D/g, '');
      const variantes = [tel, tel.replace(/^55/, '')];
      const campos = ['cliente.telefone_celular', 'cliente.fone', 'cliente.telefone_comercial'];
      outer: for (const campo of campos) {
        for (const v of variantes) {
          const r = await ixcPost(clienteUrl, IXC_AUTH, { qtype: campo, query: v, sortname: 'cliente.id' });
          if (r.registros?.length > 0) { cliente = r.registros[0]; break outer; }
        }
      }
    }

    if (!cliente) return Response.json({ encontrado: false });

    // Contratos
    const contratosR = await ixcPost(`${base}/webservice/v1/cliente_contrato`, IXC_AUTH, {
      qtype: 'cliente_contrato.id_cliente', query: String(cliente.id), sortname: 'cliente_contrato.id',
    });
    const contratos = (contratosR.registros || []).map(c => ({
      id: c.id,
      plano: c.descricao || c.id_produto || '',
      status_internet: c.status_internet === 'A' ? 'Online' : 'Bloqueado',
      status_contrato: c.status,
    }));

    // Faturas em aberto
    const faturasR = await ixcPost(`${base}/webservice/v1/fn_areceber`, IXC_AUTH, {
      qtype: 'fn_areceber.id_cliente', query: String(cliente.id), sortname: 'fn_areceber.data_vencimento',
    });
    const faturas = (faturasR.registros || [])
      .filter(f => f.status === 'A')
      .map(f => ({ id: f.id, vencimento: f.data_vencimento, valor: parseFloat(f.valor || 0) }));

    return Response.json({
      encontrado: true,
      cliente: {
        id: cliente.id,
        nome: cliente.razao || cliente.nome_fantasia || '',
        cpf_cnpj: cliente.cnpj_cpf || '',
        cidade: cliente.cidade || '',
        email: cliente.email || '',
        ativo: cliente.ativo === 'S',
        telefone: cliente.telefone_celular || cliente.fone || '',
      },
      contratos,
      faturas,
    });
  } catch (error) {
    return Response.json({ encontrado: false, erro: error.message }, { status: 500 });
  }
});