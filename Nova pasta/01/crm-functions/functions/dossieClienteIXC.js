// functions/dossieClienteIXC.js
// Monta o "dossiê" do cliente para o painel de atendimento. Consumido por PainelCliente.jsx
// Entrada: { telefone } ou { documento }
// Saída esperada:
//   { encontrado:true,
//     cliente:{ ativo, nome, cpf_cnpj, cidade, email },
//     contratos:[{ id, plano, status_internet }],
//     faturas:[{ id, vencimento, valor }] }
//   ou { encontrado:false }

import { ixcList, onlyDigits } from "./ixcClient.js";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

const fmtData = (d) => {
  if (!d) return "";
  // IXC devolve YYYY-MM-DD
  const m = String(d).match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(d);
};

async function acharCliente({ telefone, documento }) {
  // 1) por documento (mais confiável)
  if (documento) {
    const doc = onlyDigits(documento);
    if (doc) {
      const r = await ixcList("cliente", { qtype: "cliente.cnpj_cpf", query: doc, oper: "=", rp: 1 });
      if (r.registros[0]) return r.registros[0];
    }
    // pode ser um ID puro
    if (/^\d+$/.test(String(documento))) {
      const r = await ixcList("cliente", { qtype: "cliente.id", query: String(documento), oper: "=", rp: 1 });
      if (r.registros[0]) return r.registros[0];
    }
  }
  // 2) por telefone (tenta celular e fixo, com e sem DDI)
  if (telefone) {
    const tel = onlyDigits(telefone);
    const variantes = [tel, tel.replace(/^55/, "")].filter(Boolean);
    for (const campo of ["cliente.telefone_celular", "cliente.fone", "cliente.whatsapp"]) {
      for (const v of variantes) {
        if (v.length < 8) continue;
        const r = await ixcList("cliente", { qtype: campo, query: v, oper: "L", rp: 1 });
        if (r.registros[0]) return r.registros[0];
      }
    }
  }
  return null;
}

Deno.serve(async (req) => {
  let body = {};
  try { body = await req.json(); } catch { /* */ }

  try {
    const cli = await acharCliente(body);
    if (!cli) return json({ encontrado: false });

    // Contratos
    const ctrRes = await ixcList("cliente_contrato", {
      qtype: "cliente_contrato.id_cliente", query: cli.id, oper: "=", rp: 50,
    });
    const contratos = ctrRes.registros.map((c) => ({
      id: c.id,
      plano: c.contrato || c.descricao || `Contrato #${c.id}`,
      status_internet: c.status_internet === "A" ? "Online" : "Offline",
    }));

    // Faturas em aberto (status A = aberto)
    const fatRes = await ixcList("fn_areceber", {
      qtype: "fn_areceber.id_cliente", query: cli.id, oper: "=", rp: 50,
      sortname: "fn_areceber.data_vencimento", sortorder: "asc",
      grid_param: JSON.stringify([{ TB: "fn_areceber.status", OP: "=", P: "A" }]),
    });
    const faturas = fatRes.registros.map((f) => ({
      id: f.id,
      vencimento: fmtData(f.data_vencimento),
      valor: f.valor,
    }));

    return json({
      encontrado: true,
      cliente: {
        ativo: cli.ativo === "S",
        nome: cli.razao || cli.fantasia || "—",
        cpf_cnpj: cli.cnpj_cpf || "",
        cidade: cli.cidade || "",
        email: cli.email || "",
      },
      contratos,
      faturas,
    });
  } catch (e) {
    return json({ encontrado: false, error: e.message }, 500);
  }
});
