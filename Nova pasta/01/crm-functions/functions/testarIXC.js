// functions/testarIXC.js
// Testa conectividade/credenciais do IXC. Consumido por Configuracoes.jsx e Integracoes.jsx
// Frontend espera: res.data.ok (bool) e res.data.error / res.data.msg

import { ixcList, ixcConfigOk } from "./ixcClient.js";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });

Deno.serve(async (_req) => {
  if (!ixcConfigOk()) {
    return json({ ok: false, error: "Secrets IXC_HOST e/ou IXC_TOKEN ausentes" });
  }
  try {
    // Consulta leve: lista 1 filial. Se autenticar, está conectado.
    const r = await ixcList("filial", { rp: 1 });
    return json({
      ok: true,
      msg: "Conectado com sucesso",
      filiais_encontradas: r.total,
    });
  } catch (e) {
    return json({ ok: false, error: e.message || "Falha ao conectar no IXC" });
  }
});
