// functions/ativarIXC.js
// Ativa o cliente no IXC a partir de um Pedido do CRM.
// Fluxo: cria/encontra cliente -> cria contrato -> cria OS de instalação -> grava IDs no Pedido.
// Consumido por PedidoAcoes.jsx. Frontend espera:
//   res.data.id_cliente_ixc, res.data.id_contrato_ixc, res.data.id_os_ixc
//
// OBS: nomes de campos do IXC variam por instância. Os mapeamentos abaixo cobrem o caso comum;
// ajuste conforme o seu schema (principalmente cliente_contrato e radusuarios).

import { createClientFromRequest } from "npm:@base44/sdk";
import { ixcList, ixcInsert, ixcBuscarCidade, onlyDigits } from "./ixcClient.js";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

const hoje = () => new Date().toISOString().slice(0, 10);
const sucesso = (r) => r && (r.type === "success" || r.tipo === "success") && (r.id || r.registro?.id);
const idDe = (r) => r?.id || r?.registro?.id;

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  let body = {};
  try { body = await req.json(); } catch { /* */ }
  const pedidoId = body?.pedido_id;
  if (!pedidoId) return json({ error: "pedido_id obrigatório" }, 400);

  try {
    const pedidos = await base44.asServiceRole.entities.Pedido.filter({ id: pedidoId });
    const pedido = pedidos[0];
    if (!pedido) return json({ error: "Pedido não encontrado" }, 404);
    if (pedido.sincronizado_ixc) {
      return json({
        ja_sincronizado: true,
        id_cliente_ixc: pedido.id_cliente_ixc,
        id_contrato_ixc: pedido.id_contrato_ixc,
        id_os_ixc: pedido.id_os_ixc,
      });
    }

    // Dados de apoio
    const lead = pedido.lead_id
      ? (await base44.asServiceRole.entities.Lead.filter({ id: pedido.lead_id }))[0]
      : null;
    const cfg = (await base44.asServiceRole.entities.ConfigRegras.list())[0] || {};
    const plano = pedido.plano_id
      ? (await base44.asServiceRole.entities.Plano.filter({ id: pedido.plano_id }))[0]
      : null;

    const doc = onlyDigits(pedido.lead_cpf || lead?.cnpj_cpf);
    const nome = pedido.lead_nome || lead?.nome || "Cliente";

    // 1) Cliente: reaproveita se já existir pelo documento
    let idCliente = null;
    if (doc) {
      const ex = await ixcList("cliente", { qtype: "cliente.cnpj_cpf", query: doc, oper: "=", rp: 1 });
      if (ex.registros[0]) idCliente = ex.registros[0].id;
    }

    if (!idCliente) {
      const idCidade = lead?.id_cidade_ixc || (await ixcBuscarCidade(lead?.cidade_nome, lead?.uf));
      const novoCliente = await ixcInsert("cliente", {
        razao: nome,
        tipo_pessoa: lead?.tipo_pessoa || (doc.length > 11 ? "J" : "F"),
        cnpj_cpf: doc,
        ie_identidade: lead?.rg || "ISENTO",
        contribuinte: cfg.contribuinte_pf || "2",
        fone: lead?.telefone || "",
        telefone_celular: lead?.telefone || "",
        whatsapp: lead?.telefone || "",
        email: lead?.email || "",
        endereco: lead?.rua || "",
        numero: lead?.numero || "",
        complemento: lead?.complemento || "",
        bairro: lead?.bairro || "",
        cep: onlyDigits(lead?.cep),
        id_cidade: idCidade || "",
        ativo: "S",
        filial_id: cfg.id_filial_ixc || "1",
      });
      if (!sucesso(novoCliente)) {
        return json({ error: "Falha ao criar cliente no IXC", detalhe: novoCliente }, 502);
      }
      idCliente = idDe(novoCliente);
    }

    // 2) Contrato  (campos conferidos com a collection cliente_contrato da instância)
    const venc = String(pedido.vencimento || cfg.dia_vencimento_padrao || "10");
    const novoContrato = await ixcInsert("cliente_contrato", {
      tipo: "I",
      id_cliente: idCliente,
      id_modelo: plano?.id_modelo_ixc || "",         // modelo de contrato/velocidade (= Plano.id_modelo_ixc)
      id_tipo_contrato: cfg.id_tipo_contrato_ixc || "",
      id_vendedor: cfg.id_vendedor_ixc_padrao || "1",
      id_filial: cfg.id_filial_ixc || "1",
      id_carteira_cobranca: cfg.id_carteira_cobranca_ixc || "",
      contrato: plano?.nome || pedido.plano_nome || "Internet",
      status: cfg.status_contrato_inicial || "P",    // P=pré-contrato, A=ativo
      status_internet: cfg.status_internet_inicial || "A", // A=ativo, D=desativado
      data: hoje(),
      data_ativacao: hoje(),
      data_assinatura: pedido.data_assinatura ? hoje() : "",
      dia_fixo_vencimento: venc,
      fidelidade: String(cfg.fidelidade_meses ?? "0"),
      taxa_instalacao: "0.00",
      bloqueio_automatico: "S",
      aviso_atraso: "S",
      renovacao_automatica: "S",
      endereco_padrao_cliente: "S",                  // reaproveita o endereço cadastrado do cliente
      obs_contrato: `Pedido CRM ${pedido.id}`,
    });
    const idContrato = sucesso(novoContrato) ? idDe(novoContrato) : null;

    // 3) OS de instalação
    const novaOs = await ixcInsert("su_oss_chamado", {
      id_cliente: idCliente,
      id_assunto: cfg.id_assunto_os_ixc || "1",
      id_setor: cfg.id_setor_os_ixc || "1",
      id_filial: cfg.id_filial_ixc || "1",
      tipo: "C",
      status: "A",
      prioridade: "N",
      origem_endereco: "M",
      endereco: lead?.rua || "",
      numero: lead?.numero || "",
      bairro: lead?.bairro || "",
      mensagem: `Instalação ${plano?.nome || pedido.plano_nome || ""} — Pedido CRM ${pedido.id}`,
      data_abertura: hoje() + " 09:00:00",
    });
    const idOs = sucesso(novaOs) ? idDe(novaOs) : null;

    // 4) Grava de volta no Pedido
    await base44.asServiceRole.entities.Pedido.update(pedido.id, {
      sincronizado_ixc: true,
      id_cliente_ixc: idCliente,
      id_contrato_ixc: idContrato,
      id_os_ixc: idOs,
      status: "ativado",
      data_ativacao: new Date().toISOString(),
    });

    // Atualiza etapa do lead, se houver
    if (lead) {
      await base44.asServiceRole.entities.Lead.update(lead.id, { etapa_funil: "ativado" }).catch(() => {});
    }

    return json({
      ok: true,
      id_cliente_ixc: idCliente,
      id_contrato_ixc: idContrato,
      id_os_ixc: idOs,
      avisos: [
        !idContrato ? "Contrato não confirmado pelo IXC — revise o mapeamento de cliente_contrato." : null,
        !idOs ? "OS não confirmada pelo IXC — revise id_assunto/id_setor." : null,
      ].filter(Boolean),
    });
  } catch (e) {
    return json({ error: e.message || "Erro ao ativar no IXC" }, 500);
  }
});
