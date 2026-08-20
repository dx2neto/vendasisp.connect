// base44/functions/centralAssinante/entry.ts
// Central do Assinante — consulta dados do cliente no IXC com suporte a múltiplos contratos.
// MARCAR COMO PÚBLICA (acessível pela Central do Assinante com validação por CPF/CNPJ + OTP).
//
// Entrada: { cpf_cnpj, contrato_id? }
//   cpf_cnpj   -> CPF ou CNPJ do cliente (somente dígitos)
//   contrato_id -> ID do contrato no IXC (opcional, para filtrar dados)
//
// Saída:
//   { cliente: {...}, contratos: [...], faturas: [...], os: [...] }
//   ou { erro: "..." }

import { secrets } from "base44:runtime";
import { ixcList, ixcAction, onlyDigits, ixcListarFaturas, ixcListarOS } from "../../shared/ixcClient.ts";

const json = (obj: any, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });

const fmtData = (d: string) => {
  const m = String(d || "").match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (d || "");
};

const fmtBRL = (v: any) => {
  const n = Number(v || 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({});

  let body: any = {};
  try { body = await req.json(); } catch { /* GET sem body */ }

  const doc = onlyDigits(body?.cpf_cnpj || "");
  if (!doc || doc.length < 11) return json({ erro: "CPF ou CNPJ inválido." }, 400);

  const contratoId = body?.contrato_id ? String(body.contrato_id) : null;

  try {
    // 1. Buscar cliente no IXC
    const cliRes = await ixcList("cliente", {
      qtype: "cliente.cnpj_cpf", query: doc, oper: "=", rp: 1,
    }, { logStep: "central_buscar_cliente" });

    const cli = cliRes.registros[0];
    if (!cli) return json({ erro: "Cliente não encontrado." });

    const idCliente = cli.id;

    // 2. Buscar TODOS os contratos do cliente (suporte a múltiplos)
    const contratosRes = await ixcList("cliente_contrato", {
      qtype: "cliente_contrato.id_cliente", query: idCliente, oper: "=", rp: 50,
      sortname: "cliente_contrato.id", sortorder: "desc",
    }, { logStep: "central_listar_contratos" });

    let contratos = (contratosRes.registros || []).map((c: any) => ({
      id: c.id,
      numero: c.id,
      plano: c.contrato || "Internet",
      status: c.status || "",
      status_internet: c.status_internet || "",
      data_ativacao: fmtData(c.data_ativacao),
      data_vencimento: c.dia_fixo_vencimento || "",
      valor_mensal: fmtBRL(c.valor_mensal || c.valor),
      fidelidade: c.fidelidade || "0",
      endereco: c.endereco || "",
      numero: c.numero || "",
      bairro: c.bairro || "",
      cidade: c.cidade || "",
    }));

    // Se contrato_id especificado, filtra os dados para esse contrato
    const contratoFiltro = contratoId
      ? contratos.find((c: any) => String(c.id) === contratoId)
      : null;

    // 3. Faturas (filtradas por contrato se especificado)
    let faturasRaw = await ixcListarFaturas(idCliente, { logStep: "central_listar_faturas" });
    if (contratoId) {
      faturasRaw = faturasRaw.filter((f: any) => String(f.id_contrato || f.id_cliente_contrato || "") === contratoId);
    }

    const faturas = (faturasRaw || []).slice(0, 50).map((f: any) => ({
      id: f.id,
      descricao: f.descricao || "Fatura",
      vencimento: fmtData(f.data_vencimento),
      valor: fmtBRL(f.valor),
      status: f.status === "A" ? "Aberta" : f.status === "B" ? "Baixada" : f.status === "C" ? "Cancelada" : f.status || "",
      linha_digitavel: f.linha_digitavel || f.linha_digitavel_boleto || "",
    }));

    // 4. Ordens de Serviço
    let osRaw = await ixcListarOS(idCliente, { logStep: "central_listar_os" });
    const os = (osRaw || []).slice(0, 20).map((o: any) => ({
      id: o.id,
      assunto: o.assunto || "",
      status: o.status === "A" ? "Aberta" : o.status === "F" ? "Fechada" : o.status || "",
      data_abertura: fmtData(o.data_abertura),
      mensagem: (o.mensagem || "").slice(0, 100),
    }));

    // 5. Resumo do cliente
    const cliente = {
      id: cli.id,
      nome: cli.razao || cli.fantasia || "Cliente",
      tipo_pessoa: onlyDigits(cli.cnpj_cpf).length > 11 ? "J" : "F",
      email: cli.email || "",
      telefone: cli.fone || "",
      whatsapp: cli.whatsapp || cli.telefone_celular || "",
      ativo: cli.ativo === "S",
    };

    // Se apenas 1 contrato, seleciona automaticamente
    const contratoSelecionado = contratoFiltro || (contratos.length === 1 ? contratos[0] : null);

    return json({
      cliente,
      contratos,
      contrato_selecionado: contratoSelecionado,
      faturas,
      os,
      total_contratos: contratos.length,
    });
  } catch (e: any) {
    console.error("Erro Central do Assinante:", e.message);
    return json({ erro: "Não foi possível consultar seus dados no momento. Tente novamente." }, 500);
  }
});