// functions/assinarOnline.js
// Fluxo público de assinatura online (página /assine -> Assinatura.jsx).
// Marque esta function como PÚBLICA no Base44.
//
// Entrada: { endereco, plano_info, dados, template_id, vendedor_id }
//   endereco   -> { tipo_acesso, nome, email, telefone, cep, endereco, numero, bairro, cidade, uf }
//   plano_info -> { plano: { id, nome, velocidade_mbps, preco_mensal }, total }
//   dados      -> { cpf, rg, data_nascimento, end_instalacao_*, fidelidade, vencimento, ... }
//
// Saída (lida pela Assinatura.jsx):
//   { link_assinatura } -> mostra o iframe de assinatura inline
//   {} ou { done:true } -> sem ZapSign/template: vai direto pra tela de confirmação

import { createClientFromRequest } from "npm:@base44/sdk";
import { zapsignConfigOk, textoParaPdfBase64, zapsignCriarDoc } from "./zapsignClient.js";
import { renderizarContrato, montarVariaveisIXC, onlyDigits, fmtBRL } from "./templateIXC.js";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });

const SEP = "\n\n______________________________________________________________\n\n";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({});
  const base44 = createClientFromRequest(req);

  let body = {};
  try { body = await req.json(); } catch { return json({ error: "payload inválido" }, 400); }

  const { endereco, plano_info, dados, template_id, vendedor_id } = body || {};
  if (!endereco?.nome || !plano_info?.plano) {
    return json({ error: "Dados incompletos para assinatura." }, 400);
  }

  try {
    const plano = plano_info.plano;
    const total = plano_info.total ?? plano.preco_mensal ?? 0;
    const telefone = onlyDigits(endereco.telefone);

    // Resolve o nome do vendedor (link de indicação ?v=ID), se houver
    let vendedorNome = "";
    if (vendedor_id) {
      const u = await base44.asServiceRole.entities.User.filter({ id: vendedor_id }).catch(() => []);
      vendedorNome = u?.[0]?.full_name || "";
    }

    // 1) Lead
    const lead = await base44.asServiceRole.entities.Lead.create({
      nome: endereco.nome,
      cnpj_cpf: dados?.cpf || "",
      tipo_pessoa: onlyDigits(dados?.cpf).length > 11 ? "J" : "F",
      rg: dados?.rg || "",
      email: endereco.email || "",
      telefone: endereco.telefone || "",
      cep: dados?.end_instalacao_cep || endereco.cep || "",
      rua: dados?.end_instalacao_rua || endereco.endereco || "",
      numero: dados?.end_instalacao_numero || endereco.numero || "",
      complemento: dados?.end_instalacao_complemento || "",
      bairro: dados?.end_instalacao_bairro || endereco.bairro || "",
      cidade_nome: dados?.end_instalacao_cidade || endereco.cidade || "",
      uf: endereco.uf || "",
      canal_origem: "site",
      etapa_funil: "novo",
      data_entrada: new Date().toISOString(),
      observacao: `Assinatura online — ${plano.nome} (${plano.velocidade_mbps} Mbps). `
        + `Fidelidade: ${dados?.fidelidade || "12 meses"}, vencimento dia ${dados?.vencimento || "10"}.`
        + (vendedorNome ? ` Vendedor: ${vendedorNome}.` : ""),
    });

    // 2) Pedido
    const pedido = await base44.asServiceRole.entities.Pedido.create({
      lead_id: lead.id,
      lead_nome: endereco.nome,
      lead_cpf: dados?.cpf || "",
      plano_id: plano.id || "",
      plano_nome: plano.nome,
      valor: Number(total) || 0,
      status: "novo",
      canal_origem: "site",
      vendedor_id: vendedor_id || null,
      vendedor_nome: vendedorNome || null,
      observacao: "Pedido gerado pela assinatura online",
    });

    // 3) Sem ZapSign configurado -> segue para confirmação (sem assinatura digital)
    if (!zapsignConfigOk()) {
      return json({ done: true, lead_id: lead.id, pedido_id: pedido.id });
    }

    // 4) Monta o conteúdo do contrato (modelo do IXC preenchido com os dados reais)
    const leadParaVars = {
      nome: endereco.nome,
      cnpj_cpf: dados?.cpf || "",
      rg: dados?.rg || "",
      email: endereco.email || "",
      telefone: endereco.telefone || "",
      cep: dados?.end_instalacao_cep || endereco.cep || "",
      rua: dados?.end_instalacao_rua || endereco.endereco || "",
      numero: dados?.end_instalacao_numero || endereco.numero || "",
      complemento: dados?.end_instalacao_complemento || "",
      bairro: dados?.end_instalacao_bairro || endereco.bairro || "",
      cidade_nome: dados?.end_instalacao_cidade || endereco.cidade || "",
      uf: endereco.uf || "",
    };
    const planoParaVars = {
      nome: plano.nome,
      velocidade_mbps: plano.velocidade_mbps,
      preco_mensal: total,
      tipo_conexao: plano.tipo_conexao || "Fibra",
    };
    const vars = montarVariaveisIXC({
      lead: leadParaVars,
      pedido: { fidelidade: dados?.fidelidade || "12 meses", vencimento_dia: dados?.vencimento || "10" },
      plano: planoParaVars,
      vendedorNome,
      total,
    });

    // Modelos: template_id explícito > modelos vinculados ao plano > texto padrão
    let templateIds = [];
    if (template_id) templateIds = [template_id];
    else if (Array.isArray(plano.template_ids) && plano.template_ids.length) templateIds = plano.template_ids;
    else if (plano.template_contrato_id) templateIds = [plano.template_contrato_id];

    let conteudo = "";
    if (templateIds.length) {
      const partes = [];
      for (const tid of templateIds) {
        const tpl = (await base44.asServiceRole.entities.TemplateContrato.filter({ id: tid }))[0];
        if (tpl?.conteudo) partes.push(renderizarContrato(tpl.conteudo, { vars }));
      }
      conteudo = partes.join(SEP);
    }
    if (!conteudo) {
      conteudo = `CONTRATO DE PRESTAÇÃO DE SERVIÇO DE INTERNET\n\n`
        + `Contratante: ${endereco.nome}\nCPF/CNPJ: ${vars.cliente_cnpj_cpf || "-"}\n`
        + `Endereço: ${vars.cliente_endereco}, ${vars.cliente_numero} - ${vars.cliente_bairro}, ${vars.cliente_cidade}/${vars.cliente_uf}\n\n`
        + `Plano: ${plano.nome} (${plano.velocidade_mbps} Mbps)\nValor: ${fmtBRL(total)}/mês\n`
        + `Fidelidade: ${vars.fidelidade}\nVencimento: dia ${vars.vencimento_dia}\n\n`
        + `${vars.cliente_cidade} - ${vars.cliente_uf}, ${vars.data_extenso}`;
    }

    // 5) PDF + envio ao ZapSign
    const base64_pdf = await textoParaPdfBase64(`Contrato — ${endereco.nome}`, conteudo);

    const signer = {
      name: endereco.nome,
      auth_mode: "assinaturaTela",
      send_automatic_email: Boolean(endereco.email),
      send_automatic_whatsapp: Boolean(telefone),
    };
    if (endereco.email) signer.email = endereco.email;
    if (telefone) { signer.phone_country = "55"; signer.phone_number = telefone.replace(/^55/, ""); }

    if (!endereco.email && !telefone) {
      // Sem canal de envio: cria contrato em rascunho e segue para confirmação
      return json({ done: true, lead_id: lead.id, pedido_id: pedido.id });
    }

    const doc = await zapsignCriarDoc({
      nome: `Contrato - ${endereco.nome}`,
      base64_pdf,
      external_id: pedido.id,
      signers: [signer],
    });

    const signUrl = doc?.signers?.[0]?.sign_url || "";
    const docToken = doc?.token || "";

    // 6) Grava Contrato + atualiza Pedido
    const contrato = await base44.asServiceRole.entities.Contrato.create({
      pedido_id: pedido.id,
      cliente_nome: endereco.nome,
      status: "enviado",
      link_assinatura: signUrl,
      zapsign_token: docToken,
      template_id: template_id || null,
      conteudo,
    }).catch(() => null);

    await base44.asServiceRole.entities.Pedido.update(pedido.id, {
      status: "contrato_pendente",
      link_assinatura: signUrl,
      zapsign_token: docToken,
      contrato_id: contrato?.id || null,
    });

    return json({ link_assinatura: signUrl, pedido_id: pedido.id, lead_id: lead.id });
  } catch (e) {
    return json({ error: e.message || "Erro ao processar assinatura" }, 500);
  }
});
