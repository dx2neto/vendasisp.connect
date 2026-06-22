import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Buscar configurações de comissão
    const configs = await base44.asServiceRole.entities.ConfigRegras.list();
    const config = configs[0] || {};
    const comissao_padrao = config.comissao_percentual_padrao || 5;
    const comissao_revendedor = config.comissao_revendedor_percentual || 8;

    // Buscar todos os pedidos ativados com contratos assinados
    const pedidos = await base44.asServiceRole.entities.Pedido.list("-created_date", 500);
    const contratos = await base44.asServiceRole.entities.Contrato.list("-updated_date", 500);
    const comissoes_existentes = await base44.asServiceRole.entities.Comissao.list("-created_date", 500);

    const result = {
      criadas: [],
      atualizadas: [],
      total: 0,
      valor_total: 0
    };

    // Processar pedidos ativados
    for (const pedido of pedidos) {
      if (pedido.status !== 'ativado') continue;

      // Verificar se contrato foi assinado
      const contrato = contratos.find(c => c.pedido_id === pedido.id);
      if (!contrato || contrato.status !== 'assinado') continue;

      // Dedup independente por (pedido, tipo) — idempotente e consistente com ativarIXC
      const jaTem = (tipo, quemId) => comissoes_existentes.some(
        c => c.pedido_id === pedido.id && c.tipo === tipo &&
             (quemId ? String(c.vendedor_id) === String(quemId) : true)
      );

      // Comissão do vendedor — sempre % padrão de vendedor
      if ((pedido.vendedor_id || pedido.vendedor_nome) && !jaTem('vendedor', pedido.vendedor_id)) {
        const valor_comissao = (pedido.valor || 0) * (comissao_padrao / 100);
        if (valor_comissao > 0) {
          try {
            await base44.asServiceRole.entities.Comissao.create({
              vendedor_id: pedido.vendedor_id || '',
              vendedor_nome: pedido.vendedor_nome || '',
              pedido_id: pedido.id,
              lead_nome: pedido.lead_nome,
              plano_nome: pedido.plano_nome,
              valor: valor_comissao,
              percentual: comissao_padrao,
              status: 'a_receber',
              tipo: 'vendedor',
            });
            result.criadas.push({ pedido_id: pedido.id, valor: valor_comissao, tipo: 'vendedor' });
            result.valor_total += valor_comissao;
          } catch (e) { console.log('Erro ao criar comissão vendedor:', e.message); }
        }
      }

      // Comissão do revendedor — % de revendedor, deduplicada à parte
      if ((pedido.revendedor_id || pedido.revendedor_nome) && !jaTem('revendedor', pedido.revendedor_id)) {
        const valor_rev = (pedido.valor || 0) * (comissao_revendedor / 100);
        if (valor_rev > 0) {
          try {
            await base44.asServiceRole.entities.Comissao.create({
              vendedor_id: pedido.revendedor_id || '',
              vendedor_nome: pedido.revendedor_nome || '',
              pedido_id: pedido.id,
              lead_nome: pedido.lead_nome,
              plano_nome: pedido.plano_nome,
              valor: valor_rev,
              percentual: comissao_revendedor,
              status: 'a_receber',
              tipo: 'revendedor',
            });
            result.criadas.push({ pedido_id: pedido.id, valor: valor_rev, tipo: 'revendedor' });
            result.valor_total += valor_rev;
          } catch (e) { console.log('Erro ao criar comissão revendedor:', e.message); }
        }
      }
    }

    result.total = result.criadas.length;

    return Response.json({
      ok: true,
      mensagem: `${result.total} comissões calculadas e criadas`,
      ...result
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});