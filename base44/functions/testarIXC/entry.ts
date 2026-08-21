// base44/functions/testarIXC/entry.ts
// Testa a conexão com o IXC Soft listando 1 registro (cidade).

import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";
import { ixcConfigOk, getIxcConfig, ixcList } from "../../shared/ixcClient.ts";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    if (!ixcConfigOk()) {
      return Response.json({ ok: false, error: "IXC não configurado. Verifique os secrets IXC_HOST e IXC_AUTH_BASIC." });
    }

    const { apiUrl } = getIxcConfig();
    try {
      const r = await ixcList("cidade", { rp: 1 }, { logStep: "testar_ixc" });
      return Response.json({
        ok: true,
        url: apiUrl,
        registros: r.total,
      });
    } catch (e: any) {
      return Response.json({ ok: false, error: e.message });
    }
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});