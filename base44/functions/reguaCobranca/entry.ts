import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

async function ixcPost(url, auth, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${auth}`,
      'ixcsoft': 'listar',
    },
    body: JSON.stringify({ oper: '=', page: '1', rp: '1000', sortorder: 'asc', ...body }),
  });
  if (!res.ok) return { total: 0, registros: [] };
  return res.json().catch(() => ({ total: 0, registros: [] }));
}

// Régua de cobrança — tiers baseados em dias de atraso
// Faturas com mais de 90 dias de atraso são ignoradas (provável suspensão/cobrança judicial)
const DIAS_MAXIMO_REGUA = 90;
const TIERS = [
  {
    id: 'lembrete', min: 1, max: 2,
    msg: (nome, valor, venc, dias) =>
      `Olá ${nome}! 👋\n\nNotamos que sua fatura de R$ ${valor} com vencimento em ${venc} está ${dias} dia(s) em atraso.\n\nPara evitar interrupções no serviço, por favor regularize seu pagamento.\n\nDúvidas? Estamos à disposição! 📞`,
  },
  {
    id: 'urgente', min: 3, max: 7,
    msg: (nome, valor, venc, dias) =>
      `Olá ${nome}!\n\n⚠️ Lembrete urgente: sua fatura de R$ ${valor} (vencimento ${venc}) está com ${dias} dias de atraso.\n\nRegularize agora para manter seu serviço ativo sem interrupções.\n\nPrecisa de ajuda? Fale conosco! 📞`,
  },
  {
    id: 'critico', min: 8, max: 15,
    msg: (nome, valor, venc, dias) =>
      `Olá ${nome}!\n\n🚫 Sua fatura de R$ ${valor} (vencimento ${venc}) está com ${dias} dias de atraso.\n\nSeu serviço pode ser suspenso a qualquer momento. Por favor, regularize o pagamento o quanto antes para evitar o bloqueio.\n\nEntre em contato imediatamente! 📞`,
  },
  {
    id: 'suspensao', min: 16, max: DIAS_MAXIMO_REGUA,
    msg: (nome, valor, venc, dias) =>
      `Olá ${nome}!\n\n⛔ AVISO DE SUSPENSÃO IMINENTE\n\nSua fatura de R$ ${valor} (vencimento ${venc}) está com ${dias} dias de atraso.\n\nSeu serviço será SUSPENSO se o pagamento não for regularizado.\n\nEvite o bloqueio — regularize agora! 📞`,
  },
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Permite chamada por automação (service role) ou por admin
    try {
      const user = await base44.auth.me();
      if (user?.role !== 'admin') {
        return Response.json({ error: 'Acesso negado' }, { status: 403 });
      }
    } catch {
      // Chamada via automação (sem usuário autenticado) — usa service role
    }

    const db = base44.asServiceRole;

    const IXC_HOST = Deno.env.get('IXC_HOST')?.replace(/\/$/, '');
    const IXC_AUTH = Deno.env.get('IXC_AUTH_BASIC');
    const EVOLUTION_URL = Deno.env.get('EVOLUTION_URL');
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');
    const EVOLUTION_INSTANCE_ID = Deno.env.get('EVOLUTION_INSTANCE_ID');

    if (!IXC_HOST || !IXC_AUTH) {
      return Response.json({ error: 'IXC não configurado' }, { status: 500 });
    }
    if (!EVOLUTION_URL || !EVOLUTION_API_KEY) {
      return Response.json({ error: 'Evolution API não configurada' }, { status: 500 });
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    // 1. Buscar todas as faturas em aberto (status = 'A') no IXC
    const faturasR = await ixcPost(`${IXC_HOST}/webservice/v1/fn_areceber`, IXC_AUTH, {
      qtype: 'fn_areceber.status', query: 'A', sortname: 'fn_areceber.data_vencimento', sortorder: 'asc',
    });

    const faturas = (faturasR.registros || []).filter((f) => {
      if (!f.data_vencimento) return false;
      const rawDate = String(f.data_vencimento).split(' ')[0];
      const venc = new Date(rawDate.includes('/') ? rawDate.split('/').reverse().join('-') : rawDate);
      venc.setHours(0, 0, 0, 0);
      const dias = Math.round((hoje - venc) / (1000 * 60 * 60 * 24));
      return dias >= 1 && dias <= DIAS_MAXIMO_REGUA;
    });

    // 2. Buscar logs de cobrança já enviados para evitar duplicatas
    const logsExistentes = await db.entities.CobrancaLog.list('-created_date', 2000);
    const logKey = (faturaId, tier) => `${faturaId}_${tier}`;
    const logsSet = new Set(logsExistentes.map((l) => logKey(l.fatura_id, l.tier)));

    // 3. Cache de clientes para evitar queries repetidas
    const clienteCache = {};
    async function getCliente(id) {
      if (clienteCache[id]) return clienteCache[id];
      const r = await ixcPost(`${IXC_HOST}/webservice/v1/cliente`, IXC_AUTH, {
        qtype: 'cliente.id', query: String(id), sortname: 'cliente.id', rp: '1',
      });
      clienteCache[id] = r.registros?.[0] || null;
      return clienteCache[id];
    }

    const enviados = [];
    const pulados = [];
    const erros = [];

    for (const fatura of faturas) {
      const rawDate = String(fatura.data_vencimento).split(' ')[0];
      const vencDate = new Date(rawDate.includes('/') ? rawDate.split('/').reverse().join('-') : rawDate);
      vencDate.setHours(0, 0, 0, 0);
      const diasAtraso = Math.round((hoje - vencDate) / (1000 * 60 * 60 * 24));

      const tier = TIERS.find((t) => diasAtraso >= t.min && diasAtraso <= t.max);
      if (!tier) continue;

      if (logsSet.has(logKey(String(fatura.id), tier.id))) {
        pulados.push({ fatura: fatura.id, tier: tier.id, motivo: 'ja_enviado' });
        continue;
      }

      const cliente = await getCliente(fatura.id_cliente);
      if (!cliente) {
        pulados.push({ fatura: fatura.id, motivo: 'cliente_nao_encontrado' });
        continue;
      }

      const telefone = (cliente.telefone_celular || cliente.fone || '').replace(/\D/g, '');
      if (!telefone) {
        pulados.push({ fatura: fatura.id, motivo: 'sem_telefone' });
        continue;
      }

      const nome = (cliente.razao || cliente.nome_fantasia || cliente.nome || 'Cliente').split(' ')[0];
      const valor = parseFloat(fatura.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
      const vencStr = vencDate.toLocaleDateString('pt-BR');
      const mensagem = tier.msg(nome, valor, vencStr, diasAtraso);

      try {
        const resp = await fetch(`${EVOLUTION_URL}/send/text`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': EVOLUTION_API_KEY,
            'instanceId': EVOLUTION_INSTANCE_ID || '',
          },
          body: JSON.stringify({ number: telefone, text: mensagem }),
        });

        if (resp.ok) {
          await db.entities.CobrancaLog.create({
            fatura_id: String(fatura.id),
            cliente_id: String(cliente.id),
            cliente_nome: cliente.razao || cliente.nome_fantasia || '',
            telefone,
            valor: parseFloat(fatura.valor || 0),
            data_vencimento: rawDate.includes('/') ? rawDate.split('/').reverse().join('-') : rawDate,
            dias_atraso: diasAtraso,
            tier: tier.id,
            mensagem,
            status_envio: 'enviado',
          });
          logsSet.add(logKey(String(fatura.id), tier.id));
          enviados.push({ fatura: fatura.id, cliente: nome, tier: tier.id, dias: diasAtraso });
        } else {
          erros.push({ fatura: fatura.id, erro: 'falha_envio_whatsapp' });
        }
      } catch (e) {
        erros.push({ fatura: fatura.id, erro: e.message });
      }
    }

    return Response.json({
      success: true,
      total_faturas_vencidas: faturas.length,
      enviados: enviados.length,
      enviados,
      pulados: pulados.length,
      erros: erros.length,
      erros,
      executado_em: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Erro em reguaCobranca:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});