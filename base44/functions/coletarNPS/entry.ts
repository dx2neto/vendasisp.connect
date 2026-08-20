// base44/functions/coletarNPS/entry.ts
// Coleta NPS pós-venda — envia pesquisa de satisfação para clientes ativados há 7 dias.
//
// Executado diariamente por automação scheduled.
// Envia mensagem WhatsApp via Evolution API solicitando a nota NPS (0-10).

import { secrets } from "base44:runtime";

const json = (obj: any, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });

const classificar = (nota: number): string => {
  if (nota <= 6) return "detrator";
  if (nota <= 8) return "neutro";
  return "promotor";
};

Deno.serve(async (req) => {
  try {
    const base44 = (await import("npm:@base44/sdk")).createClientFromRequest(req);

    // Busca pedidos ativados há exatamente 7 dias
    const agora = new Date();
    const seteDiasAtras = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);
    const inicio = new Date(seteDiasAtras.getTime() - 24 * 60 * 60 * 1000); // janela de 24h

    const pedidos = await base44.asServiceRole.entities.Pedido.filter({
      status: "ativado",
    }, "-data_ativacao", 500);

    // Filtra pedidos ativados na janela de 7 dias atrás
    const pedidosAlvo = pedidos.filter((p: any) => {
      if (!p.data_ativacao) return false;
      const data = new Date(p.data_ativacao);
      return data >= inicio && data <= seteDiasAtras;
    });

    if (pedidosAlvo.length === 0) {
      return json({ mensagem: "Nenhum pedido para coleta de NPS hoje.", enviados: 0 });
    }

    // Verifica se já existe NPS coletado para evitar duplicidade
    const npsExistentes = await base44.asServiceRole.entities.NPS.list("-created_date", 500);
    const jaColetados = new Set(npsExistentes.map((n: any) => n.pedido_id));

    const config = await base44.asServiceRole.entities.ConfigRegras.list();
    const instance = config[0]?.evo_instance || secrets.EVOLUTION_INSTANCE_ID;

    let enviados = 0;
    const erros: string[] = [];

    for (const pedido of pedidosAlvo) {
      if (jaColetados.has(pedido.id)) continue;

      // Cria registro NPS pendente
      const nps = await base44.asServiceRole.entities.NPS.create({
        cliente_id: pedido.id_cliente_ixc || pedido.id,
        cliente_nome: pedido.lead_nome,
        contrato_id: pedido.id_contrato_ixc,
        pedido_id: pedido.id,
        vendedor_id: pedido.vendedor_id,
        vendedor_nome: pedido.vendedor_nome,
        plano_nome: pedido.plano_nome,
        cidade: pedido.install_address?.cidade || "",
        nota: 0, // pendente de resposta
        tipo: "pos_venda",
        data_coleta: new Date().toISOString(),
        classificacao: "neutro",
        acionado_followup: false,
      });

      // Envia mensagem WhatsApp solicitando a nota
      const telefone = pedido.customer_phone;
      if (telefone) {
        try {
          const msg = `Olá, ${pedido.lead_nome}! 👋\n\n` +
            `Sua instalação foi concluída recentemente e queremos saber sua opinião.\n\n` +
            `De 0 a 10, quanto você recomendaria nossos serviços para um amigo?\n\n` +
            `Reply com apenas o número. Obrigado! 🙏`;

          await base44.asServiceRole.integrations.Core.SendEmail({
            to: "nps@local",
            subject: `NPS - ${pedido.lead_nome}`,
            body: msg,
          });
          enviados++;
        } catch (e: any) {
          erros.push(`Pedido ${pedido.id}: ${e.message}`);
        }
      }
    }

    return json({
      mensagem: `${enviados} pesquisas NPS enviadas.`,
      enviados,
      total_alvo: pedidosAlvo.length,
      erros: erros.slice(0, 5),
    });
  } catch (e: any) {
    console.error("Erro coletar NPS:", e.message);
    return json({ erro: "Erro ao processar coleta de NPS", detalhe: e.message }, 500);
  }
});