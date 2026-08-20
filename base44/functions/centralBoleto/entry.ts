// base44/functions/centralBoleto/entry.ts
// Central do Assinante — gera boleto/PIX de uma fatura específica.
// MARCAR COMO PÚBLICA (validação por CPF/CNPJ).
//
// Entrada: { cpf_cnpj, fatura_id, tipo: "boleto" | "pix" }
// Saída: { url_boleto?, pix_copia_cola?, linha_digitavel? } ou { erro }

import { ixcList, ixcAction, onlyDigits } from "../../shared/ixcClient.ts";

const json = (obj: any, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({});

  let body: any = {};
  try { body = await req.json(); } catch { return json({ erro: "Payload inválido" }, 400); }

  const doc = onlyDigits(body?.cpf_cnpj || "");
  const faturaId = String(body?.fatura_id || "");
  const tipo = body?.tipo || "boleto";

  if (!doc || !faturaId) return json({ erro: "CPF/CNPJ e ID da fatura são obrigatórios." }, 400);

  try {
    // Valida se a fatura pertence ao cliente
    const cliRes = await ixcList("cliente", {
      qtype: "cliente.cnpj_cpf", query: doc, oper: "=", rp: 1,
    });

    const cli = cliRes.registros[0];
    if (!cli) return json({ erro: "Cliente não encontrado." });

    const fatRes = await ixcList("fn_areceber", {
      qtype: "fn_areceber.id", query: faturaId, oper: "=", rp: 1,
      grid_param: JSON.stringify([{ TB: "fn_areceber.id_cliente", OP: "=", P: cli.id }]),
    });

    const fatura = fatRes.registros[0];
    if (!fatura) return json({ erro: "Fatura não encontrada para este cliente." });

    const resultado: any = {
      vencimento: fatura.data_vencimento || "",
      valor: fatura.valor || 0,
      linha_digitavel: fatura.linha_digitavel || fatura.linha_digitavel_boleto || "",
    };

    if (tipo === "pix") {
      try {
        const pix = await ixcAction("fn_areceber/get_pix", { id: faturaId });
        const copia = pix?.pix?.qrCode || pix?.qrCode || pix?.pix_copia_cola || pix?.emv;
        if (copia) resultado.pix_copia_cola = copia;
        if (pix?.pix?.qrcode) resultado.pix_qrcode_base64 = pix.pix.qrcode;
      } catch (e) { resultado.erro_pix = "Não foi possível gerar o PIX."; }
    } else {
      try {
        const bol = await ixcAction("fn_areceber/get_boleto", {
          boletos: faturaId, juro: "N", multa: "N", atualiza_boleto: "N", tipo_boleto: "arquivo", base64: "S",
        });
        if (bol?.url) resultado.url_boleto = bol.url;
        else if (bol?.base64) {
          const b64 = String(bol.base64).replace(/^data:.*base64,/, "");
          if (b64.length > 100) resultado.url_boleto = `data:application/pdf;base64,${b64}`;
        }
      } catch (e) { resultado.erro_boleto = "Não foi possível gerar o boleto."; }
    }

    return json(resultado);
  } catch (e: any) {
    return json({ erro: "Erro ao processar solicitação. Tente novamente." }, 500);
  }
});