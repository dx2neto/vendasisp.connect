// functions/testarZapSign.js
// Testa o token do ZapSign. Consumido por Contratos.jsx. Frontend espera res.data.message

import { zapsignConfigOk } from "./zapsignClient.js";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (_req) => {
  if (!zapsignConfigOk()) return json({ ok: false, message: "Secret ZAPSIGN_TOKEN ausente" }, 400);
  try {
    const base = Deno.env.get("ZAPSIGN_BASE") || "https://api.zapsign.com.br/api/v1";
    const res = await fetch(`${base}/docs/?page=1`, {
      headers: { Authorization: `Bearer ${Deno.env.get("ZAPSIGN_TOKEN")}` },
    });
    if (res.ok) return json({ ok: true, message: "ZapSign conectado com sucesso!" });
    const err = await res.json().catch(() => ({}));
    return json({ ok: false, message: err?.detail || `Falha (HTTP ${res.status})` }, 200);
  } catch (e) {
    return json({ ok: false, message: e.message }, 200);
  }
});
