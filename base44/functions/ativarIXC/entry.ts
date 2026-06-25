import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const IXC_HOST = () => (Deno.env.get('IXC_HOST') || '')
  .replace(/\/+$/, '')
  .replace(/\/webservice\/v1$/i, '');
const IXC_AUTH = () => {
  const legacy = (Deno.env.get('IXC_AUTH_BASIC') || '').replace(/^Basic\s+/i, '');
  const token = Deno.env.get('IXC_TOKEN') || '';
  return legacy || (token ? btoa(token) : '');
};

// operation: 'listar' (consultar) | 'incluir' (criar) | 'alterar' (editar)
async function ixcRequest(method, endpoint, body = null, operation = 'listar') {
  const url = `${IXC_HOST()}/webservice/v1/${endpoint}`;
  const opts = {
    method,
    headers: {
      Authorization: `Basic ${IXC_AUTH()}`,
      'Content-Type': 'application/json',
      ixcsoft: operation,
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const resp = await fetch(url, opts);
  const text = await resp.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { message: text || `HTTP ${resp.status}` }; }
  return { ok: resp.ok, status: resp.status, data };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { pedido_id } = await req.json();
    if (!pedido_id) return Response.json({ error: 'pedido_id obrigatório' }, { status: 400 });

    if (!IXC_HOST() || !IXC_AUTH()) {
      return Response.json({ error: 'IXC_HOST e IXC_TOKEN não configurados' }, { status: 500 });
    }

    const pedido = await base44.asServiceRole.entities.Pedido.get(pedido_id);
    if (!pedido) return Response.json({ error: 'Pedido não encontrado' }, { status: 404 });

    let lead = null;
    if (pedido.lead_id) lead = await base44.asServiceRole.entities.Lead.get(pedido.lead_id);

    let plano = null;
    if (pedido.plano_id) plano = await base44.asServiceRole.entities.Plano.get(pedido.plano_id);

    const configs = await base44.asServiceRole.entities.ConfigRegras.list();
    const cfg = configs[0] || {};

    // Helper: loga cada passo no IntegrationLog
    const logStep = async (step, request, response, ok) => {
      await base44.asServiceRole.entities.IntegrationLog.create({
        pedido_id, service: 'ixc', step, request, response, ok,
      }).catch(e => console.warn('Erro ao salvar IntegrationLog:', e.message));
    };

    // Endereço de instalação: prefere o objeto install_address do pedido, senão lead
    const addr = pedido.install_address || {};
    const getAddr = (field, leadField) => addr[field] || (lead ? lead[leadField] : '') || '';

    // ── 1. Cliente — verificar se já existe por CPF/CNPJ ──────────────────────
    const cpf = (pedido.lead_cpf || lead?.cnpj_cpf || '').replace(/\D/g, '');
    const tipoPessoa = lead?.tipo_pessoa || (cpf.length === 14 ? 'J' : 'F');

    let idClienteIxc = '';
    if (cpf) {
      const buscaBody = {
        qtype: 'cliente.cnpj_cpf', query: cpf, oper: '=',
        page: '1', rp: '1', sortname: 'cliente.id', sortorder: 'desc',
      };
      const busca = await ixcRequest('POST', 'cliente', buscaBody, 'listar');
      const achado = Array.isArray(busca.data?.registros) ? busca.data.registros[0] : null;
      if (achado?.id) idClienteIxc = String(achado.id);
      await logStep('buscar_cliente', buscaBody, busca.data, busca.ok);
    }

    const clientePayload = {
      razao: pedido.lead_nome,
      fantasia: pedido.lead_nome,
      cnpj_cpf: cpf,
      tipo_pessoa: tipoPessoa,
      contribuinte: cfg.contribuinte_pf || '2',
      rg_ie: pedido.rg || lead?.rg || '',
      email: pedido.customer_email || lead?.email || '',
      fone: (pedido.telefone_fixo || lead?.telefone || '').replace(/\D/g, ''),
      telefone_celular: (pedido.customer_phone || lead?.telefone || '').replace(/\D/g, ''),
      cep: getAddr('cep', 'cep'),
      endereco: getAddr('endereco', 'rua'),
      numero: getAddr('numero', 'numero'),
      complemento: getAddr('complemento', 'complemento'),
      bairro: getAddr('bairro', 'bairro'),
      id_cidade: lead?.id_cidade_ixc || '',
      uf: getAddr('estado', 'uf'),
      ativo: 'S',
      id_filial: cfg.id_filial_ixc || '1',
      vendedor: cfg.id_vendedor_ixc_padrao || '1',
    };

    if (!idClienteIxc) {
      const clienteResp = await ixcRequest('POST', 'cliente', clientePayload, 'incluir');
      await logStep('criar_cliente', clientePayload, clienteResp.data, clienteResp.ok);
      if (!clienteResp.ok) {
        await base44.asServiceRole.entities.Pedido.update(pedido_id, { integration_status: 'error' });
        return Response.json({ error: 'Erro ao criar cliente no IXC', detalhe: clienteResp.data }, { status: 502 });
      }
      idClienteIxc = String(clienteResp.data?.id || clienteResp.data?.referencia || '');
    }

    // ── 2. Contrato — endpoint cliente_contrato ──────────────────────────────
    const hojeIso = new Date().toISOString().slice(0, 10);
    const contratoPayload = {
      tipo: 'I',
      id_cliente: idClienteIxc,
      id_modelo: plano?.id_modelo_ixc || '',
      id_tipo_contrato: cfg.id_tipo_contrato_ixc || '',
      id_vendedor: cfg.id_vendedor_ixc_padrao || '1',
      id_filial: cfg.id_filial_ixc || '1',
      id_carteira_cobranca: cfg.id_carteira_cobranca_ixc || '',
      contrato: `CTR-${pedido_id.substring(0, 8).toUpperCase()}`,
      status: cfg.status_contrato_inicial || 'P',
      status_internet: cfg.status_internet_inicial || 'A',
      data: hojeIso,
      data_ativacao: hojeIso,
      dia_fixo_vencimento: String(pedido.due_day || cfg.dia_vencimento_padrao || '10'),
      fidelidade: String(pedido.loyalty ?? cfg.fidelidade_meses ?? '0'),
      taxa_instalacao: '0.00',
      bloqueio_automatico: 'S',
      aviso_atraso: 'S',
      renovacao_automatica: 'S',
      endereco_padrao_cliente: 'S',
      obs_contrato: `Ativação via CRM - Pedido ${pedido_id}`,
    };

    const contratoResp = await ixcRequest('POST', 'cliente_contrato', contratoPayload, 'incluir');
    await logStep('criar_contrato', contratoPayload, contratoResp.data, contratoResp.ok);
    if (!contratoResp.ok) {
      await base44.asServiceRole.entities.Pedido.update(pedido_id, {
        integration_status: 'error', id_cliente_ixc: idClienteIxc,
      });
      return Response.json({ error: 'Erro ao criar contrato no IXC', detalhe: contratoResp.data }, { status: 502 });
    }
    const idContratoIxc = String(contratoResp.data?.id || contratoResp.data?.referencia || '');

    // ── 3. Ordem de Serviço de instalação — endpoint su_oss_chamado ───────────
    const osPayload = {
      id_cliente: idClienteIxc,
      id_contrato: idContratoIxc,
      assunto: cfg.id_assunto_os_ixc || '1',
      setor: cfg.id_setor_os_ixc || '1',
      tipo_chamado: 'I',
      obs: `Instalação - venda ${pedido_id}. Endereço: ${getAddr('endereco', 'rua')}, ${getAddr('numero', 'numero')}, ${getAddr('bairro', 'bairro')}`,
      id_filial: cfg.id_filial_ixc || '1',
    };

    const osResp = await ixcRequest('POST', 'su_oss_chamado', osPayload, 'incluir');
    await logStep('criar_os', osPayload, osResp.data, osResp.ok);
    const idOsIxc = String(osResp.data?.id || osResp.data?.referencia || '');

    // ── 4. Acesso / Login (radius) — endpoint radusuarios (opcional) ──────────
    let idLoginIxc = '';
    try {
      const loginGerado = `user${idClienteIxc}`;
      const senhaGerada = Math.random().toString(36).slice(2, 10);
      const loginPayload = {
        id_cliente: idClienteIxc,
        id_contrato: idContratoIxc,
        login: loginGerado,
        senha: senhaGerada,
        ativo: 'S',
      };
      const loginResp = await ixcRequest('POST', 'radusuarios', loginPayload, 'incluir');
      await logStep('criar_login', loginPayload, loginResp.data, loginResp.ok);
      if (loginResp.ok) {
        idLoginIxc = String(loginResp.data?.id || loginResp.data?.referencia || '');
      }
    } catch (e) {
      console.warn('radusuarios opcional falhou:', e.message);
    }

    // ── 5. Atualiza pedido como ativado ───────────────────────────────────────
    const updateData = {
      status: 'ativado',
      sincronizado_ixc: true,
      integration_status: 'ok',
      id_cliente_ixc: idClienteIxc,
      id_contrato_ixc: idContratoIxc,
      id_os_ixc: idOsIxc,
      data_ativacao: new Date().toISOString(),
    };
    if (idLoginIxc) updateData.id_login_ixc = idLoginIxc;

    await base44.asServiceRole.entities.Pedido.update(pedido_id, updateData);

    if (pedido.lead_id) {
      await base44.asServiceRole.entities.Lead.update(pedido.lead_id, {
        etapa_funil: 'ativado',
        id_cliente_ixc: idClienteIxc,
      });
    }

    // ── 6. Gera comissões ────────────────────────────────────────────────────
    const valorPedido = pedido.valor || 0;
    const pctVendedor = cfg.comissao_percentual_padrao || 5;
    const pctRevendedor = cfg.comissao_revendedor_percentual || 8;

    if (pedido.vendedor_id || pedido.vendedor_nome) {
      await base44.asServiceRole.entities.Comissao.create({
        vendedor_id: pedido.vendedor_id || '',
        vendedor_nome: pedido.vendedor_nome || '',
        pedido_id, lead_nome: pedido.lead_nome, plano_nome: pedido.plano_nome,
        valor: parseFloat((valorPedido * pctVendedor / 100).toFixed(2)),
        percentual: pctVendedor, status: 'a_receber', tipo: 'vendedor',
      });
    }
    if (pedido.revendedor_id || pedido.revendedor_nome) {
      await base44.asServiceRole.entities.Comissao.create({
        vendedor_id: pedido.revendedor_id || '',
        vendedor_nome: pedido.revendedor_nome || '',
        pedido_id, lead_nome: pedido.lead_nome, plano_nome: pedido.plano_nome,
        valor: parseFloat((valorPedido * pctRevendedor / 100).toFixed(2)),
        percentual: pctRevendedor, status: 'a_receber', tipo: 'revendedor',
      });
    }

    return Response.json({
      success: true,
      id_cliente_ixc: idClienteIxc,
      id_contrato_ixc: idContratoIxc,
      id_os_ixc: idOsIxc,
      id_login_ixc: idLoginIxc,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});