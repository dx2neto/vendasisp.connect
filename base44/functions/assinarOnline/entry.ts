import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Gera HTML básico do contrato para enviar ao ZapSign como base64
function gerarHtmlContrato(conteudo) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<style>
  body { font-family: Arial, sans-serif; font-size: 13px; line-height: 1.7; color: #222; max-width: 800px; margin: 0 auto; padding: 40px; }
  h1,h2,h3 { color: #1a1a2e; }
  p { margin: 0.5em 0; }
  .header { text-align:center; border-bottom:2px solid #0ea5e9; padding-bottom:20px; margin-bottom:30px; }
  .footer { border-top:1px solid #ccc; margin-top:40px; padding-top:20px; text-align:center; font-size:11px; color:#888; }
</style>
</head>
<body>
<div class="header"><h2>CONTRATO DE PRESTAÇÃO DE SERVIÇOS</h2></div>
<div style="white-space:pre-wrap">${conteudo}</div>
<div class="footer">Documento gerado digitalmente — Connect Telecom</div>
</body>
</html>`;
}

function preencherVariaveis(conteudo, vars) {
  const mapa = {};
  Object.entries(vars || {}).forEach(([k, v]) => { mapa[String(k).toLowerCase()] = v == null ? '' : String(v); });
  const get = (k) => (mapa[String(k).toLowerCase()] != null ? mapa[String(k).toLowerCase()] : '');
  return String(conteudo || '')
    .replace(/#([a-zA-Z0-9_]+)#/g, (_, k) => get(k))
    .replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => get(k))
    .replace(/\{\s*([a-zA-Z0-9_]+)\s*\}/g, (_, k) => get(k));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const {
      endereco, plano_info, dados, template_id,
      vendedor_id,
    } = await req.json();

    const zapToken = Deno.env.get('ZAPSIGN_TOKEN');

    // 1. Cria lead
    const lead = await base44.asServiceRole.entities.Lead.create({
      nome: endereco.nome,
      cnpj_cpf: dados.cpf || '',
      rg: dados.rg || '',
      tipo_pessoa: 'F',
      email: endereco.email,
      telefone: endereco.telefone,
      cep: endereco.cep,
      rua: dados.end_instalacao_rua || endereco.endereco,
      numero: dados.end_instalacao_numero || endereco.numero,
      bairro: dados.end_instalacao_bairro || endereco.bairro,
      cidade_nome: dados.end_instalacao_cidade || endereco.cidade,
      uf: endereco.uf || '',
      canal_origem: vendedor_id ? 'revenda' : 'site',
      etapa_funil: 'novo',
      observacao: dados.observacoes || '',
    });

    // 2. Cria pedido
    const pedido = await base44.asServiceRole.entities.Pedido.create({
      lead_id: lead.id,
      lead_nome: endereco.nome,
      lead_cpf: dados.cpf || '',
      plano_id: plano_info.plano.id,
      plano_nome: plano_info.plano.nome,
      valor: plano_info.total,
      vendedor_id: vendedor_id || '',
      status: 'novo',
      canal_origem: vendedor_id ? 'revenda' : 'site',
      observacao: `Fidelidade: ${dados.fidelidade} | Vencimento: dia ${dados.vencimento}`,
    });

    // 3. Se não tem ZapSign ou template, retorna só o pedido criado
    if (!zapToken || !template_id) {
      return Response.json({
        success: true,
        pedido_id: pedido.id,
        link_assinatura: null,
        message: 'Pedido criado. Entraremos em contato para assinatura.',
      });
    }

    // 4. Busca e preenche template
    const template = await base44.asServiceRole.entities.TemplateContrato.get(template_id);

    const now = new Date();
    const vars = {
      cliente_nome: endereco.nome,
      cliente_cpf: dados.cpf || '',
      cliente_rg: dados.rg || '',
      cliente_email: endereco.email,
      cliente_telefone: endereco.telefone,
      cliente_endereco: `${dados.end_instalacao_rua || endereco.endereco}, ${dados.end_instalacao_numero || endereco.numero}`,
      cliente_bairro: dados.end_instalacao_bairro || endereco.bairro,
      cliente_cidade: dados.end_instalacao_cidade || endereco.cidade,
      cliente_uf: endereco.uf || '',
      cliente_cep: dados.end_instalacao_cep || endereco.cep,
      plano_nome: plano_info.plano.nome,
      plano_valor: `R$ ${Number(plano_info.total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      plano_velocidade: `${plano_info.plano.velocidade_mbps} Mbps`,
      fidelidade: dados.fidelidade || '12 meses',
      vencimento_dia: dados.vencimento || '10',
      data_hoje: now.toLocaleDateString('pt-BR'),
      data_extenso: now.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }),
      cidade_contrato: dados.end_instalacao_cidade || endereco.cidade,
      // aliases p/ os modelos do IXC (#variavel#)
      cliente_razao: endereco.nome,
      cliente_cnpj_cpf: dados.cpf || '',
      cliente_rg_ie: dados.rg || '',
      cliente_celular: endereco.telefone || '',
      cliente_fone: endereco.telefone || '',
      cliente_numero: dados.end_instalacao_numero || endereco.numero || '',
      cliente_complemento: dados.end_instalacao_complemento || '',
      tipo_de_conexao: 'Fibra',
      contrato_endereco: dados.end_instalacao_rua || endereco.endereco || '',
      contrato_endereco_numero: dados.end_instalacao_numero || endereco.numero || '',
      contrato_bairro: dados.end_instalacao_bairro || endereco.bairro || '',
      contrato_cidade: dados.end_instalacao_cidade || endereco.cidade || '',
      contrato_uf: endereco.uf || '',
      contrato_cep: dados.end_instalacao_cep || endereco.cep || '',
      contrato_data_ativacao_renovacao_extenso: now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    };

    const conteudoPreenchido = preencherVariaveis(template.conteudo, vars);
    const htmlContrato = gerarHtmlContrato(conteudoPreenchido);

    // 5. Converte HTML para base64 e envia ao ZapSign
    const encoder = new TextEncoder();
    const htmlBytes = encoder.encode(htmlContrato);
    const base64Html = btoa(String.fromCharCode(...htmlBytes));

    const phone = (endereco.telefone || '').replace(/\D/g, '');

    const zapBody = {
      name: `Contrato - ${endereco.nome} - ${plano_info.plano.nome}`,
      base64_pdf: base64Html, // ZapSign aceita HTML como base64
      signers: [{
        name: endereco.nome,
        email: endereco.email,
        phone_country: '55',
        phone_number: phone,
        auth_mode: 'assinaturaTela',
        send_automatic_email: !!endereco.email,
        send_automatic_whatsapp: phone.length >= 10,
      }],
      lang: 'pt-br',
      disable_signer_emails: false,
    };

    const zapResp = await fetch('https://api.zapsign.com.br/api/v1/docs/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${zapToken}`,
      },
      body: JSON.stringify(zapBody),
    });

    const zapData = await zapResp.json();
    const linkAssinatura = zapData?.signers?.[0]?.sign_url || zapData?.url || '';
    const idZapsign = zapData?.token || zapData?.open_id || '';

    // 6. Salva contrato e atualiza pedido
    if (linkAssinatura) {
      await base44.asServiceRole.entities.Contrato.create({
        pedido_id: pedido.id,
        status: 'enviado',
        link_assinatura: linkAssinatura,
        id_zapsign: idZapsign,
        cliente_nome: endereco.nome,
        cliente_email: endereco.email,
        cliente_telefone: endereco.telefone,
      });

      await base44.asServiceRole.entities.Pedido.update(pedido.id, {
        status: 'contrato_pendente',
        link_assinatura: linkAssinatura,
        data_contrato: now.toISOString(),
      });
    }

    return Response.json({
      success: true,
      pedido_id: pedido.id,
      link_assinatura: linkAssinatura,
      zapsign_error: zapResp.ok ? null : zapData,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});