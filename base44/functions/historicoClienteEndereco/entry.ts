import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Consulta o histórico do cliente e do ENDEREÇO em cada IXC (cidade):
//   - o CPF já foi cliente? (em quais cidades / status)
//   - já houve internet no mesmo endereço?
//   - quem era o cliente anterior no mesmo endereço?
//
// Multi-instância: define o secret IXC_INSTANCES como JSON, ex.:
//   [{"id":1,"cidade":"Cachoeira Dourada - GO","host":"https://h1","auth":"BASE64"},
//    {"id":3,"cidade":"Inaciolandia - GO","host":"https://h3","auth":"BASE64"}]
// Sem esse secret, usa o IXC único (IXC_HOST/IXC_AUTH_BASIC).
//
// Entrada: { pedido_id } OU { cpf_cnpj, logradouro, numero, bairro, cidade }
// Restrito a admin/gerente.

const onlyDigits = (v) => String(v || '').replace(/\D/g, '');

function getInstancias() {
  const raw = Deno.env.get('IXC_INSTANCES');
  if (raw) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length) {
        return arr.map((i, idx) => ({
          id: i.id ?? idx,
          cidade: i.cidade || i.nome || `IXC #${i.id ?? idx}`,
          host: String(i.host || '').replace(/\/$/, ''),
          auth: i.auth || i.token_basic || '',
        })).filter((i) => i.host && i.auth);
      }
    } catch (_) { /* cai no fallback */ }
  }
  const host = (Deno.env.get('IXC_HOST') || '').replace(/\/$/, '');
  const auth = Deno.env.get('IXC_AUTH_BASIC') || '';
  return host && auth ? [{ id: 0, cidade: 'IXC (padrão)', host, auth }] : [];
}

async function ixcListar(inst, endpoint, body) {
  const r = await fetch(`${inst.host}/webservice/v1/${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Basic ${inst.auth}`, 'Content-Type': 'application/json', ixcsoft: 'listar' },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  const registros = Array.isArray(data?.registros) ? data.registros : Array.isArray(data) ? data : [];
  return { ok: r.ok, registros };
}

export async function consultarHistorico({ cpf, logradouro, numero }) {
  const instancias = getInstancias();
  const resultados = [];

  for (const inst of instancias) {
    const item = {
      id: inst.id, cidade: inst.cidade,
      ja_foi_cliente: false, meu_status: null, meu_id: null,
      internet_no_endereco: false, cliente_anterior: null, ocupantes: [], erro: null,
    };
    try {
      // 1) O CPF já foi cliente nesta cidade?
      if (cpf) {
        const rc = await ixcListar(inst, 'cliente', {
          qtype: 'cliente.cnpj_cpf', query: cpf, oper: '=',
          page: '1', rp: '5', sortname: 'cliente.id', sortorder: 'desc',
        });
        const meu = rc.registros[0];
        if (meu) {
          item.ja_foi_cliente = true;
          item.meu_status = meu.ativo || meu.status || '';
          item.meu_id = String(meu.id || '');
        }
      }
      // 2) Quem já esteve / teve internet neste endereço?
      if (logradouro) {
        const ra = await ixcListar(inst, 'cliente', {
          qtype: 'cliente.endereco', query: logradouro, oper: 'L',
          page: '1', rp: '50', sortname: 'cliente.id', sortorder: 'desc',
        });
        const noEndereco = ra.registros.filter((c) => {
          const numOk = numero ? onlyDigits(c.numero) === onlyDigits(numero) : true;
          const outro = onlyDigits(c.cnpj_cpf) !== onlyDigits(cpf);
          return numOk && outro;
        });
        if (noEndereco.length) {
          item.internet_no_endereco = true;
          item.ocupantes = noEndereco.slice(0, 5).map((c) => ({
            nome: c.razao || c.fantasia || c.nome || '—',
            cnpj_cpf: c.cnpj_cpf || '',
            status: c.ativo || c.status || '',
            id: String(c.id || ''),
          }));
          item.cliente_anterior = item.ocupantes[0];
        }
      }
    } catch (e) {
      item.erro = e.message;
    }
    resultados.push(item);
  }

  return {
    instancias_consultadas: instancias.length,
    foi_cliente_em: resultados.filter((r) => r.ja_foi_cliente).map((r) => r.cidade),
    internet_no_endereco_em: resultados.filter((r) => r.internet_no_endereco).map((r) => r.cidade),
    resultados,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });
    if (!['admin', 'gerente'].includes(user.role)) {
      return Response.json({ error: 'Acesso restrito a gerentes e administradores' }, { status: 403 });
    }

    const body = await req.json();
    let { cpf_cnpj, logradouro, numero, pedido_id } = body || {};

    // Resolve dados a partir do pedido/lead se vier pedido_id
    if (pedido_id && (!cpf_cnpj || !logradouro)) {
      const db = base44.asServiceRole;
      const pedido = await db.entities.Pedido.get(pedido_id).catch(() => null);
      const lead = pedido?.lead_id ? await db.entities.Lead.get(pedido.lead_id).catch(() => null) : null;
      cpf_cnpj = cpf_cnpj || lead?.cnpj_cpf || pedido?.lead_cpf || '';
      logradouro = logradouro || lead?.rua || '';
      numero = numero || lead?.numero || '';
    }

    if (!cpf_cnpj && !logradouro) {
      return Response.json({ error: 'Informe cpf_cnpj e/ou logradouro (ou um pedido_id válido)' }, { status: 400 });
    }

    const out = await consultarHistorico({ cpf: onlyDigits(cpf_cnpj), logradouro, numero });

    // Formata resposta para o frontend
    const resultado = out.resultados[0] || {};
    const historicos = resultado.ocupantes?.map(ocp => ({
     id_cliente: ocp.id,
     nome: ocp.nome,
     endereco: logradouro,
     ativo: ocp.status === 'S' || ocp.status === 'Ativo',
     tem_divida: false, // Seria necessário consultar faturas
     total_contratos: 0,
     faturas_em_aberto: 0,
     total_em_aberto: 0,
    })) || [];

    return Response.json({
     data: {
       success: true,
       total_clientes_encontrados: historicos.length,
       tem_risco: historicos.some(h => h.tem_divida || !h.ativo),
       historicos,
     }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});