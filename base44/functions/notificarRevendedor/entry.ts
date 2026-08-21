import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { enviarWhatsApp } from "../../shared/evolutionClient.ts";

const fmt = (v) => `R$ ${(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { event, data, old_data } = body;

    if (!event || !data) {
      return Response.json({ success: true, message: "Sem dados do evento" });
    }

    const { type, entity_name, entity_id } = event;
    let phone = "";
    let message = "";

    // === Comissão criada (revendedor) ===
    if (entity_name === "Comissao" && type === "create" && data.tipo === "revendedor") {
      // Busca o telefone do revendedor no User
      if (data.vendedor_id) {
        try {
          const user = await base44.asServiceRole.entities.User.get(data.vendedor_id);
          phone = user?.telefone || "";
        } catch (_) {}
      }

      message =
        `🎉 *Nova Comissão Gerada!*\n\n` +
        `💰 Valor: *${fmt(data.valor)}*\n` +
        `📊 Percentual: ${data.percentual || 0}%\n` +
        `👤 Cliente: ${data.lead_nome || "—"}\n` +
        `📦 Plano: ${data.plano_nome || "—"}\n` +
        `📌 Status: A receber\n\n` +
        `Acompanhe seus ganhos no painel do revendedor.`;
    }

    // === Indicação aprovada (convertida) ===
    else if (entity_name === "Indicacao" && type === "update" &&
             old_data?.status !== "convertido" && data.status === "convertido") {
      phone = data.indicador_telefone || "";

      const recompensa = data.recompensa_tipo === "mes_gratis" ? "Mês grátis" :
                         data.recompensa_tipo === "desconto" ? `Desconto ${data.recompensa_valor || ""}` :
                         data.recompensa_tipo === "credito" ? `Crédito ${data.recompensa_valor || ""}` :
                         data.recompensa_tipo === "brinde" ? `Brinde: ${data.recompensa_valor || ""}` :
                         data.recompensa_tipo || "—";

      message =
        `✅ *Indicação Aprovada!*\n\n` +
        `👤 Indicado: ${data.indicado_nome || "—"}\n` +
        `🎁 Recompensa: ${recompensa}\n` +
        `🔢 Código: #${data.codigo_indicacao || "—"}\n\n` +
        `Sua indicação foi convertida com sucesso! ` +
        `A recompensa será processada em breve.`;
    }

    if (!phone || !message) {
      return Response.json({ success: true, message: "Sem telefone ou mensagem — notificação ignorada", entity_name, type });
    }

    const result = await enviarWhatsApp(base44, phone, message, true);

    // Registra log da notificação
    try {
      await base44.asServiceRole.entities.IntegrationLog.create({
        pedido_id: data.pedido_id || "",
        service: "evolution",
        step: `notificar_revendedor.${entity_name}.${type}`,
        request: { phone, entity_name, entity_id },
        response: result,
        ok: result.ok,
      });
    } catch (_) {}

    return Response.json({
      success: result.ok,
      phone,
      entity_name,
      type,
      error: result.error || null,
    });
  } catch (error) {
    console.error("Erro em notificarRevendedor:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});