// base44/functions/testarZapSign/entry.ts
// Testa a configuração do ZapSign verificando se o token está presente.

import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";
import { zapsignConfigOk } from "../../shared/zapsignClient.ts";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    if (!zapsignConfigOk()) {
      return Response.json({ ok: false, error: "ZapSign não configurado. Verifique o secret ZAPSIGN_TOKEN." });
    }

    return Response.json({ ok: true, message: "Token ZapSign configurado." });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});