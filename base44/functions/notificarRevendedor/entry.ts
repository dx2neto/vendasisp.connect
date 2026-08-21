import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const fmt = (v: number) => `R$ ${(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const RECOMPENSA_LABEL: Record<string, string> = {
  desconto: "Desconto",
  credito: "Crédito",
  brinde: "Brinde",
  mes_gratis: "Mês Grátis",
};

async function enviarWhatsApp(base44: any, phone: string, text: string): Promise<{ ok: boolean; error?: string }> {
  const phoneDigits = (phone || "").replace(/\D/g, "");
  if (!phoneDigits) return { ok: false, error: "Telefone vazio" };

  const EVOLUTION_URL = (Deno.env.get("EVOLUTION_URL") || "").replace(/\/+$/, "");
  const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
  const EVOLUTION_INSTANCE_TOKEN = Deno.env.get("EVOLUTION_INSTANCE_TOKEN");

  let instanceName = "";
  try {
    const configs = await base44.asServiceRole.entities.ConfigRegras.list();
    instanceName = configs[0]?.evo_instance || "";
  } catch (_) { /* ignore */ }

  if (!instanceName) {
    try {
      const statuses = await base44.asServiceRole.entities.EvolutionStatus.list();
      instanceName = statuses[0]?.instance_name || "";
    } catch (_) { /* ignore */ }
  }

  if (!EVOLUTION_URL || (!EVOLUTION_INSTANCE_TOKEN && !EVOLUTION_API_KEY) || !instanceName) {
    console.warn("Evolution Go não configurado — WhatsApp não enviado");
    return { ok: false, error: "Evolution Go não configurado" };
  }

  try {
    const resp = await fetch(`${EVOLUTION_URL}/message/sendText/${instanceName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: EVOLUTION_INSTANCE_TOKEN || EVOLUTION_API_KEY,
      },
      body: JSON.stringify({ number: phoneDigits, text, linkPreview: false }),
    });

    if (resp.ok) {
      console.log(`WhatsApp enviado para ${phoneDigits}`);
      return { ok: true };
    }
    const err = await resp.text().catch(() => "");
    console.warn(`Falha ao enviar WhatsApp para ${phoneDigits}: ${err}`);
    return { ok: false, error: err };
  } catch (e) {
    console.warn("Erro ao enviar WhatsApp:", (e as Error).message);
    return { ok: false, error: (e as Error).message };
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { event, data, old_data } = body;

    if (!event || !data) {
      return Response.json({ error: "Payload inválido — event e data são obrigatórios" }, { status: 400 });
    }

    const db = base44.asServiceRole;
    let phone = "";
    let message = "";

    // ─── Comissão criada (apenas tipo revendedor) ───
    if (event.entity_name === "Comissao" && event.type === "create") {
      if (data.tipo !== "revendedor") {
        return Response.json({ success: true, message: "Não é comissão de revendedor — pulando" });
      }

      // Busca telefone do revendedor no User
      if (data.vendedor_id) {
        try {
          const user = await db.entities.User.get(data.vendedor_id);
          phone = user?.telefone || "";
        } catch (_) { /* ignore */ }
      }

      message =
        `🎉 *Nova Comissão Gerada!*\n\n` +
        `💰 Valor: ${fmt(data.valor)}\n` +
        `📊 Percentual: ${data.percentual || 0}%\n` +
        `👤 Cliente: ${data.lead_nome || "—"}\n` +
        `📦 Plano: ${data.plano_nome || "—"}\n` +
        `⏳ Status: ${data.status === "pago" ? "Pago" : "A receber"}\n\n` +
        `Acesse seu painel de revendedor para mais detalhes.`;
    }

    // ─── Indicação aprovada (status mudou para convertido) ───
    if (event.entity_name === "Indicacao" && event.type === "update") {
      const oldStatus = old_data?.status;
      const newStatus = data.status;

      // Só notifica na transição para "convertido"
      if (oldStatus === "convertido" || newStatus !== "convertido") {
        return Response.json({ success: true, message: "Status não relevante para notificação" });
      }

      phone = data.indicador_telefone || "";

      message =
        `✅ *Indicação Aprovada!*\n\n` +
        `👤 Indicado: ${data.indicado_nome || "—"}\n` +
        `📞 Telefone: ${data.indicado_telefone || "—"}\n`;

      if (data.recompensa_tipo) {
        message += `🎁 Recompensa: ${RECOMPENSA_LABEL[data.recompensa_tipo] || data.recompensa_tipo}`;
        if (data.recompensa_valor) message += ` (${data.recompensa_valor})`;
        message += "\n";
      }

      message += `\nParabéns! Sua indicação foi convertida com sucesso. 🎊`;
    }

    // Evento não relevante
    if (!phone) {
      return Response.json({ success: true, message: "Sem telefone para notificar" });
    }

    if (!message) {
      return Response.json({ success: true, message: "Evento não relevante para notificação" });
    }

    const result = await enviarWhatsApp(base44, phone, message);

    return Response.json({
      success: true,
      event: event.type,
      entity: event.entity_name,
      phone,
      sent: result.ok,
      error: result.error || null,
    });
  } catch (error) {
    console.error("Erro ao notificar revendedor:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});