// base44/functions/webhookIXC/entry.ts
// Webhook receiver para eventos do IXC Soft.
// O IXC envia webhooks para eventos como: criação/alteração de cliente,
// contrato, fatura, OS, baixa de pagamento, etc.
//
// Segurança: valida token compartilhado via header X-IXC-Webhook-Token
// (deve ser configurado como secret IXC_WEBHOOK_TOKEN no app).
//
// Endpoints IXC para configurar:
//   POST /api/functions/webhookIXC?token=<seu_token>
//
// Eventos suportados:
//   cliente.created, cliente.updated, cliente.deleted
//   contrato.created, contrato.updated, contrato.status_changed
//   fatura.created, fatura.paid, fatura.cancelled
//   os.created, os.updated, os.assigned, os.closed

import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { secrets } from "base44:runtime";
import { onlyDigits, ixcGet } from "../../shared/ixcClient.ts";

export default async function(req: Request): Promise<Response> {
  try {
    // Validação do token (shared secret)
    const expectedToken = secrets.get("IXC_WEBHOOK_TOKEN") || "";
    const url = new URL(req.url);
    const tokenParam = url.searchParams.get("token") || "";
    const tokenHeader = req.headers.get("X-IXC-Webhook-Token") || "";

    if (expectedToken && tokenParam !== expectedToken && tokenHeader !== expectedToken) {
      return Response.json({ error: "Token de webhook inválido" }, { status: 401 });
    }

    const base44 = createClientFromRequest(req);
    const payload: any = await req.json().catch(() => ({}));

    if (!payload || !payload.event) {
      return Response.json({ error: "Payload inválido — campo 'event' obrigatório" }, { status: 400 });
    }

    const { event, data } = payload;
    const entityType = String(event).split(".")[0];
    const eventType = String(event).split(".")[1];

    // Log do webhook
    await base44.asServiceRole.entities.IntegrationLog.create({
      pedido_id: "",
      service: "ixc",
      step: `webhook:${event}`,
      request: payload,
      response: { received: true },
      ok: true,
    }).catch(() => {});

    // Processa por tipo de evento
    switch (event) {
      // ----- CLIENTE -----
      case "cliente.created":
      case "cliente.updated": {
        if (!data?.id) break;
        const cliente = await ixcGet("cliente", data.id).catch(() => null);
        if (!cliente) break;
        const leads = await base44.asServiceRole.entities.Lead.filter({ id_cliente_ixc: String(data.id) });
        if (leads[0]) {
          await base44.asServiceRole.entities.Lead.update(leads[0].id, {
            nome: cliente.razao || leads[0].nome,
            cnpj_cpf: cliente.cnpj_cpf || leads[0].cnpj_cpf,
            telefone: cliente.telefone_celular || cliente.fone || leads[0].telefone,
            email: cliente.email || leads[0].email,
          });
        }
        break;
      }

      case "cliente.deleted": {
        if (!data?.id) break;
        const leads = await base44.asServiceRole.entities.Lead.filter({ id_cliente_ixc: String(data.id) });
        for (const lead of leads) {
          await base44.asServiceRole.entities.Lead.update(lead.id, {
            observacao: `Cliente removido do IXC em ${new Date().toISOString()}`,
          });
        }
        break;
      }

      // ----- CONTRATO -----
      case "contrato.status_changed":
      case "contrato.updated": {
        if (!data?.id) break;
        const contratos = await base44.asServiceRole.entities.Contrato.filter({ pedido_id: "" });
        // Atualiza pedidos vinculados
        const pedidos = await base44.asServiceRole.entities.Pedido.filter({ id_contrato_ixc: String(data.id) });
        if (data.status_internet === "C" && pedidos[0]) {
          // Contrato suspenso
          await base44.asServiceRole.entities.Pedido.update(pedidos[0].id, {
            observacao: `Contrato suspenso no IXC em ${new Date().toISOString()}`,
          });
        }
        break;
      }

      // ----- FATURA / PAGAMENTO -----
      case "fatura.paid": {
        if (!data?.id) break;
        // Registra baixa de fatura
        await base44.asServiceRole.entities.CobrancaLog.create({
          fatura_id: String(data.id),
          cliente_id: String(data.id_cliente || ""),
          cliente_nome: data.cliente_nome || "",
          telefone: data.telefone || "",
          valor: Number(data.valor || 0),
          data_vencimento: data.data_vencimento || "",
          dias_atraso: data.dias_atraso || 0,
          tier: "lembrete",
          mensagem: `Pagamento confirmado via webhook IXC`,
          status_envio: "enviado",
        }).catch(() => {});
        break;
      }

      // ----- OS -----
      case "os.created":
      case "os.updated":
      case "os.closed": {
        if (!data?.id) break;
        const pedidos = await base44.asServiceRole.entities.Pedido.filter({ id_os_ixc: String(data.id) });
        if (pedidos[0] && eventType === "closed") {
          await base44.asServiceRole.entities.Pedido.update(pedidos[0].id, {
            observacao: `OS fechada no IXC em ${new Date().toISOString()}`,
          });
        }
        break;
      }

      default:
        // Evento não tratado — apenas logado
        break;
    }

    return Response.json({ ok: true, event, processed: true });
  } catch (error) {
    return Response.json({ error: error.message || "Erro no webhook IXC" }, { status: 500 });
  }
}