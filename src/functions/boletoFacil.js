// functions/boletoFacil.js
// Página PÚBLICA de 2ª via (BoletoFacil.jsx). Marque esta function como PÚBLICA no Base44.
// Entrada: { cpf_cnpj }
// Saída esperada:
//   { nome, vencimento, valor, pix_copia_cola?, url_boleto?, linha_digitavel? }
//   ou { erro: "..." }

import { ixcList, ixcAction, onlyDigits } from "./ixcClient.js";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });

const fmtData = (d) => {
  const m = String(d || "").match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (d || "");
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({});
  let body = {};
  try { body = await req.json(); } catch { /* */ }

  const doc = onlyDigits(body?.cpf_cnpj);
  if (!doc || doc.length < 11) return json({ erro: "Informe um CPF ou CNPJ válido." });

  try {
    const cliRes = await ixcList("cliente", { qtype: "cliente.cnpj_cpf", query: doc, oper: "=", rp: 1 });
    const cli = cliRes.registros[0];
    if (!cli) return json({ erro: "Cliente não encontrado." });

    // Fatura em aberto mais próxima do vencimento
    const fatRes = await ixcList("fn_areceber", {
      qtype: "fn_areceber.id_cliente", query: cli.id, oper: "=", rp: 5,
      sortname: "fn_areceber.data_vencimento", sortorder: "asc",
      grid_param: JSON.stringify([{ TB: "fn_areceber.status", OP: "=", P: "A" }]),
    });
    const fatura = fatRes.registros[0];

    if (!fatura) {
      return json({ nome: cli.razao || cli.fantasia || "Cliente" }); // sem fatura em aberto
    }

    const resultado = {
      nome: cli.razao || cli.fantasia || "Cliente",
      vencimento: fmtData(fatura.data_vencimento),
      valor: fatura.valor,
      linha_digitavel: fatura.linha_digitavel || fatura.linha_digitavel_boleto || "",
    };

    // Tenta gerar o PIX copia-e-cola
    try {
      const pix = await ixcAction("get_pix", { id_areceber: fatura.id });
      const copia = pix?.pix?.qrCode || pix?.qrCode || pix?.pix_copia_cola || pix?.emv;
      if (copia) resultado.pix_copia_cola = copia;
    } catch (_) { /* opcional */ }

    // Tenta gerar URL/base64 do boleto
    try {
      const bol = await ixcAction("get_boleto", {
        boletos: String(fatura.id),
        juro: "N", multa: "N", atualiza_boleto: "N", tipo_boleto: "arquivo",
        base64: "S",
      });
      if (bol?.url) resultado.url_boleto = bol.url;
      else if (bol?.base64 || bol?._raw) {
        const b64 = bol.base64 || bol._raw;
        if (typeof b64 === "string" && b64.length > 100) {
          resultado.url_boleto = `data:application/pdf;base64,${b64.replace(/^data:.*base64,/, "")}`;
        }
      }
    } catch (_) { /* opcional */ }

    return json(resultado);
  } catch (e) {
    return json({ erro: "Não foi possível consultar agora. Tente novamente." });
  }
});
