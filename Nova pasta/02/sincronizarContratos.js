// functions/sincronizarContratos.js
// Atualiza o status dos contratos consultando o ZapSign (polling).
// Consumido por Contratos.jsx. Frontend espera res.data.sincronizados

import { createClientFromRequest } from "npm:@base44/sdk";
import { zapsignConfigOk, zapsignGetDoc } from "./zapsignClient.js";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  if (!zapsignConfigOk()) return json({ error: "Secret ZAPSIGN_TOKEN ausente" }, 400);

  try {
    const contratos = await base44.asServiceRole.entities.Contrato.list("-created_date", 500);
    const pendentes = contratos.filter(
      (c) => c.zapsign_token && c.status !== "assinado" && c.status !== "arquivado"
    );

    let sincronizados = 0;
    for (const c of pendentes) {
      try {
        const doc = await zapsignGetDoc(c.zapsign_token);
        const st = doc?.status; // pending | signed | refused
        if (st === "signed" && c.status !== "assinado") {
          await base44.asServiceRole.entities.Contrato.update(c.id, {
            status: "assinado",
            data_assinatura: new Date().toISOString(),
          });
          if (c.pedido_id) {
            await base44.asServiceRole.entities.Pedido.update(c.pedido_id, { status: "assinado" }).catch(() => {});
          }
          sincronizados++;
        }
      } catch (_) { /* ignora doc isolado com erro */ }
    }
    return json({ sincronizados, verificados: pendentes.length });
  } catch (e) {
    return json({ error: e.message || "Erro ao sincronizar contratos" }, 500);
  }
});
