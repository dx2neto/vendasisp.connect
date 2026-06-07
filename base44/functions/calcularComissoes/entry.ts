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

      // Verificar se comissão já existe
      const comissao_existente = comissoes_existentes.find(
        c => c.pedido_id === pedido.id && c.vendedor_id === pedido.vendedor_id
      );

      if (comissao_existente) {
        // Se já existe, pula
        continue;
      }

      // Calcular comissão
      const percentual = pedido.revendedor_id ? comissao_revendedor : comissao_padrao;
      const valor_comissao = (pedido.valor || 0) * (percentual / 100);

      if (valor_comissao <= 0) continue;

      // Criar comissão de vendedor
      const comissao_vendedor = {
        vendedor_id: pedido.vendedor_id,
        vendedor_nome: pedido.vendedor_nome,
        pedido_id: pedido.id,
        lead_nome: pedido.lead_nome,
        plano_nome: pedido.plano_nome,
        valor: valor_comissao,
        percentual: percentual,
        status: 'a_receber',
        tipo: 'vendedor',
      };

      try {
        const created = await base44.asServiceRole.entities.Comissao.create(comissao_vendedor);
        result.criadas.push({ pedido_id: pedido.id, valor: valor_comissao, tipo: 'vendedor' });
        result.valor_total += valor_comissao;
      } catch (e) {
        console.log('Erro ao criar comissão:', e.message);
      }

      // Se tem revendedor, criar comissão de revendedor também
      if (pedido.revendedor_id) {
        const percentual_rev = comissao_revendedor;
        const valor_rev = (pedido.valor || 0) * (percentual_rev / 100);

        if (valor_rev > 0) {
          const comissao_revendedor_obj = {
            vendedor_id: pedido.revendedor_id,
            vendedor_nome: pedido.revendedor_nome,
            pedido_id: pedido.id,
            lead_nome: pedido.lead_nome,
            plano_nome: pedido.plano_nome,
            valor: valor_rev,
            percentual: percentual_rev,
            status: 'a_receber',
            tipo: 'revendedor',
          };

          try {
            const created = await base44.asServiceRole.entities.Comissao.create(comissao_revendedor_obj);
            result.criadas.push({ pedido_id: pedido.id, valor: valor_rev, tipo: 'revendedor' });
            result.valor_total += valor_rev;
          } catch (e) {
            console.log('Erro ao criar comissão revendedor:', e.message);
          }
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