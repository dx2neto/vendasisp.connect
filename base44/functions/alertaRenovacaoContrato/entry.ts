import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Permite chamada por automação (service role) ou por admin
    let isAutomation = false;
    try {
      const user = await base44.auth.me();
      if (user?.role !== 'admin') {
        return Response.json({ error: 'Acesso negado' }, { status: 403 });
      }
    } catch {
      // Chamada via automação (sem usuário autenticado) — usa service role
      isAutomation = true;
    }

    const db = base44.asServiceRole;

    // Busca todos os pedidos ativados com data de contrato preenchida
    const pedidos = await db.entities.Pedido.filter({ status: 'ativado' }, '-created_date', 500);

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const alertas = [];
    const erros = [];

    for (const pedido of pedidos) {
      // Calcula data de vencimento: data_contrato + fidelidade (padrão 12 meses)
      // Usa data_ativacao se disponível, senão data_contrato
      const dataBase = pedido.data_ativacao || pedido.data_contrato || pedido.created_date;
      if (!dataBase) continue;

      const dataInicio = new Date(dataBase);
      // Fidelidade padrão 12 meses
      const dataVencimento = new Date(dataInicio);
      dataVencimento.setMonth(dataVencimento.getMonth() + 12);
      dataVencimento.setHours(0, 0, 0, 0);

      const diasRestantes = Math.round((dataVencimento - hoje) / (1000 * 60 * 60 * 24));

      // Envia alerta se faltam exatamente 30 dias (ou entre 28-32 para tolerância)
      if (diasRestantes < 28 || diasRestantes > 32) continue;

      // Busca lead para obter dados de contato
      let lead = null;
      if (pedido.lead_id) {
        lead = await db.entities.Lead.get(pedido.lead_id).catch(() => null);
      }
      if (!lead && pedido.lead_nome) {
        const leads = await db.entities.Lead.filter({ nome: pedido.lead_nome }, '-created_date', 1);
        lead = leads[0] || null;
      }

      const clienteEmail = lead?.email;
      const clienteNome = pedido.lead_nome || lead?.nome || 'Cliente';
      const vendedorNome = pedido.vendedor_nome || '';
      const planoNome = pedido.plano_nome || 'seu plano';
      const dataVencStr = dataVencimento.toLocaleDateString('pt-BR');

      // 1. Email para o cliente
      if (clienteEmail && clienteEmail !== 'sememail@gmail.com') {
        try {
          await base44.integrations.Core.SendEmail({
            to: clienteEmail,
            from_name: 'Connect Telecom',
            subject: `🔄 Seu contrato vence em ${diasRestantes} dias — Renove agora!`,
            body: `Olá ${clienteNome},

Esperamos que esteja aproveitando nossa internet de qualidade! 🌐

Gostaríamos de avisar que seu contrato do plano **${planoNome}** vence em **${diasRestantes} dias** (${dataVencStr}).

Para garantir a continuidade do seu serviço sem interrupções, entre em contato com nossa equipe e renove seu contrato com as melhores condições!

📞 Nossa equipe está pronta para atendê-lo.

Atenciosamente,
Equipe Connect Telecom`,
          });
          alertas.push({ tipo: 'email_cliente', cliente: clienteNome, email: clienteEmail, dias: diasRestantes });
        } catch (e) {
          erros.push({ cliente: clienteNome, erro: e.message, tipo: 'email_cliente' });
        }
      }

      // 2. Email para o vendedor
      if (vendedorNome) {
        // Busca email do vendedor na entidade User
        const usuarios = await db.entities.User.list().catch(() => []);
        const vendedor = usuarios.find(u =>
          u.full_name?.toLowerCase().includes(vendedorNome.toLowerCase()) ||
          vendedorNome.toLowerCase().includes(u.full_name?.toLowerCase())
        );

        if (vendedor?.email) {
          try {
            await base44.integrations.Core.SendEmail({
              to: vendedor.email,
              from_name: 'Connect Telecom — Sistema',
              subject: `⚠️ Alerta de Renovação: ${clienteNome} vence em ${diasRestantes} dias`,
              body: `Olá ${vendedorNome},

Este é um alerta automático de renovação de contrato.

📋 **Detalhes:**
- Cliente: ${clienteNome}
- Plano: ${planoNome}
- Vencimento do contrato: ${dataVencStr}
- Dias restantes: ${diasRestantes} dias

⚡ Ação necessária: Entre em contato com o cliente para oferecer a renovação preventiva e garantir a continuidade do serviço.

Acesse o sistema para mais detalhes: https://app.base44.com

Att,
Sistema CRM Connect Telecom`,
            });
            alertas.push({ tipo: 'email_vendedor', vendedor: vendedorNome, cliente: clienteNome, dias: diasRestantes });
          } catch (e) {
            erros.push({ vendedor: vendedorNome, erro: e.message, tipo: 'email_vendedor' });
          }
        }
      }

      // 3. Adiciona nota automática no lead
      if (lead) {
        const notas = lead.historico_notas || [];
        const jaNotificado = notas.some(n =>
          n.nota?.includes('Alerta de renovação') && n.nota?.includes(dataVencStr)
        );
        if (!jaNotificado) {
          const novaNota = {
            data: new Date().toISOString(),
            autor: 'Sistema',
            nota: `⚠️ Alerta de renovação: contrato do plano ${planoNome} vence em ${diasRestantes} dias (${dataVencStr}). Notificações enviadas ao cliente e vendedor.`,
            tipo: 'status',
          };
          await db.entities.Lead.update(lead.id, {
            historico_notas: [...notas, novaNota],
          }).catch(() => null);
        }
      }
    }

    return Response.json({
      success: true,
      processados: pedidos.length,
      alertas_enviados: alertas.length,
      alertas,
      erros,
      executado_em: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Erro em alertaRenovacaoContrato:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});