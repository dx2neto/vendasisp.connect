import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Converte o HTML do modelo (inclusive os modelos do IXC, cheios de entidades
// como &ccedil; &atilde; &ordm;) em texto limpo para o PDF.
function decodeEntidades(s) {
  const M = {
    nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", ordm: 'º', ordf: 'ª',
    aacute: 'á', acirc: 'â', atilde: 'ã', agrave: 'à', auml: 'ä',
    eacute: 'é', ecirc: 'ê', egrave: 'è', euml: 'ë',
    iacute: 'í', icirc: 'î', iuml: 'ï',
    oacute: 'ó', ocirc: 'ô', otilde: 'õ', ograve: 'ò', ouml: 'ö',
    uacute: 'ú', ucirc: 'û', uuml: 'ü', ugrave: 'ù',
    ccedil: 'ç', ntilde: 'ñ',
    Aacute: 'Á', Acirc: 'Â', Atilde: 'Ã', Agrave: 'À',
    Eacute: 'É', Ecirc: 'Ê', Iacute: 'Í', Oacute: 'Ó', Ocirc: 'Ô', Otilde: 'Õ',
    Uacute: 'Ú', Ccedil: 'Ç',
    copy: '©', reg: '®', deg: '°', hellip: '...', mdash: '-', ndash: '-',
    laquo: '«', raquo: '»', sect: '§', middot: '·', bull: '-',
  };
  return String(s || '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&([a-zA-Z]+);/g, (m, name) => (M[name] != null ? M[name] : m));
}

async function htmlParaPdfBase64(html) {
  let s = String(html || '').replace(/\r\n?/g, '\n');
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '')
       .replace(/<script[\s\S]*?<\/script>/gi, '')
       .replace(/<img[^>]*>/gi, '');
  // quebras a partir de blocos
  s = s.replace(/<\s*br\s*\/?>/gi, '\n')
       .replace(/<\/\s*(p|div|h[1-6]|li|tr|table|thead|tbody)\s*>/gi, '\n')
       .replace(/<\s*(p|div|h[1-6]|li|tr)[^>]*>/gi, '\n');
  // separadores de célula
  s = s.replace(/<\/\s*(td|th)\s*>/gi, ' | ');
  // remove o resto das tags
  s = s.replace(/<[^>]+>/g, '');
  // entidades
  s = decodeEntidades(s);
  // normaliza espaços/linhas
  s = s.replace(/[ \t]+\|\s*$/gm, '')
       .replace(/[ \t]{2,}/g, ' ')
       .replace(/[ \t]+\n/g, '\n')
       .replace(/\n[ \t]+/g, '\n')
       .replace(/\n{3,}/g, '\n\n')
       .replace(/^\s+|\s+$/g, '');
  return s;
}

// Gera PDF simples usando jsPDF via npm
async function gerarPdfBase64(conteudo) {
  const { jsPDF } = await import('npm:jspdf@2.5.1');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const textoLimpo = await htmlParaPdfBase64(conteudo);
  const linhas = doc.splitTextToSize(textoLimpo, 170);

  let y = 20;
  const lineHeight = 6;
  const pageHeight = 280;

  for (const linha of linhas) {
    if (y + lineHeight > pageHeight) {
      doc.addPage();
      y = 20;
    }
    doc.setFontSize(10);
    doc.text(linha, 20, y);
    y += lineHeight;
  }

  // Retorna base64 sem o prefixo data:
  return doc.output('datauristring').split(',')[1];
}

// --- Variáveis #...# do IXC preenchidas com os dados reais do CRM ---
const _dig = (v) => (v ? String(v).replace(/\D/g, '') : '');
function _fmtDoc(v) { const d = _dig(v); if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4'); if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5'); return v || ''; }
function _fmtCep(v) { const d = _dig(v); return d.length === 8 ? d.replace(/(\d{5})(\d{3})/, '$1-$2') : (v || ''); }
function _fmtFone(v) { const d = _dig(v).replace(/^55/, ''); if (d.length === 11) return d.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3'); if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3'); return v || ''; }
function _dataExtenso(d = new Date()) { const M = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']; const D = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']; return `${D[d.getDay()]}, ${d.getDate()} de ${M[d.getMonth()]} de ${d.getFullYear()}`; }

function montarVarsIXC(lead, pedido, plano) {
  lead = lead || {}; pedido = pedido || {}; plano = plano || {};
  const doc = lead.cnpj_cpf || pedido.lead_cpf || '';
  const cidade = lead.cidade_nome || lead.cidade || '';
  const uf = lead.uf || '';
  const tel = lead.telefone || '';
  const valor = pedido.valor != null ? pedido.valor : (plano.preco_mensal || 0);
  const brl = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  return {
    cliente_razao: lead.nome || pedido.lead_nome || '',
    cliente_fantasia: lead.fantasia || '',
    cliente_cnpj_cpf: _fmtDoc(doc),
    cliente_rg_ie: lead.rg || lead.ie || '',
    cliente_inscricao_municipal: lead.inscricao_municipal || '',
    cliente_endereco: lead.rua || lead.endereco || '',
    cliente_numero: lead.numero || '',
    cliente_complemento: lead.complemento || '',
    cliente_cep: _fmtCep(lead.cep),
    cliente_bairro: lead.bairro || '',
    cliente_cidade: cidade,
    cliente_uf: uf,
    cliente_celular: _fmtFone(tel),
    cliente_fone: _fmtFone(lead.telefone_fixo || tel),
    cliente_fone_comercial: _fmtFone(lead.telefone_comercial || ''),
    cliente_email: lead.email || '',
    cliente_nome_representante_1: lead.representante_nome || '',
    cliente_cpf_representante_1: _fmtDoc(lead.representante_cpf || ''),
    cliente_identidade_representante_1: lead.representante_rg || '',
    contrato_endereco: lead.rua || lead.endereco || '',
    contrato_endereco_numero: lead.numero || '',
    contrato_complemento: lead.complemento || '',
    contrato_cep: _fmtCep(lead.cep),
    contrato_bairro: lead.bairro || '',
    contrato_cidade: cidade,
    contrato_uf: uf,
    contrato_data_ativacao_renovacao_extenso: _dataExtenso(),
    contrato_grade_comodato_sem_val: '',
    tipo_de_conexao: plano.tipo_conexao || 'Fibra',
    plano_nome: plano.nome || pedido.plano_nome || '',
    plano_velocidade: plano.velocidade_mbps ? `${plano.velocidade_mbps} Mbps` : '',
    valor: brl(valor), plano_valor: brl(valor), valor_mensal: brl(valor),
    fidelidade: pedido.fidelidade || '12 meses',
    vencimento_dia: pedido.vencimento_dia || pedido.vencimento || '',
    vendedor_nome: pedido.vendedor_nome || '',
    data_contrato: new Date().toLocaleDateString('pt-BR'),
    data_hoje: new Date().toLocaleDateString('pt-BR'),
    data_extenso: _dataExtenso(),
    cidade_contrato: cidade,
  };
}

function aplicarVars(txt, vars) {
  if (!txt) return '';
  const get = (k) => { const key = String(k).toLowerCase(); return vars[key] != null ? String(vars[key]) : ''; };
  return String(txt)
    .replace(/#([a-zA-Z0-9_]+)#/g, (_, k) => get(k))
    .replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => get(k))
    .replace(/\{\s*([a-zA-Z0-9_]+)\s*\}/g, (_, k) => get(k));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { pedido_id, template_pdf_url, conteudo_contrato, template_id } = await req.json();
    if (!pedido_id) return Response.json({ error: 'pedido_id obrigatório' }, { status: 400 });

    const zapToken = Deno.env.get('ZAPSIGN_TOKEN');
    if (!zapToken) return Response.json({ error: 'Envio de contrato indisponível: configure o secret ZAPSIGN_TOKEN.', missing_secret: 'ZAPSIGN_TOKEN' }, { status: 400 });

    // Busca pedido e lead
    const pedido = await base44.asServiceRole.entities.Pedido.get(pedido_id);
    if (!pedido) return Response.json({ error: 'Pedido não encontrado' }, { status: 404 });

    let lead = null;
    if (pedido.lead_id) {
      lead = await base44.asServiceRole.entities.Lead.get(pedido.lead_id).catch(() => null);
    }

    const signerName = pedido.lead_nome || 'Cliente';
    const signerEmail = pedido.customer_email || lead?.email || '';
    const signerPhone = (pedido.customer_phone || lead?.telefone || '').replace(/\D/g, '');

    // Config ZapSign (sandbox vs produção)
    const configs = await base44.asServiceRole.entities.ConfigRegras.list();
    const cfg = configs[0] || {};
    const zapBaseUrl = cfg.zapsign_sandbox
      ? 'https://sandbox.api.zapsign.com.br/api/v1'
      : (cfg.zapsign_url_api || 'https://api.zapsign.com.br/api/v1/').replace(/\/+$/, '');
    const authMode = signerPhone ? 'assinaturaTela-tokenWhatsApp' : 'assinaturaTela';

    // Plano + variáveis do IXC (#...#) preenchidas com os dados reais
    let plano = null;
    if (pedido.plano_id) {
      plano = await base44.asServiceRole.entities.Plano.get(pedido.plano_id).catch(() => null);
    }
    const varsIXC = montarVarsIXC(lead, pedido, plano);

    // Resolve o conteúdo: usa o que veio do front; se vazio, usa os modelos
    // vinculados ao plano (template_ids). Em ambos os casos, preenche as variáveis.
    let conteudoFinal = conteudo_contrato || '';
    if (!conteudoFinal && plano && Array.isArray(plano.template_ids) && plano.template_ids.length) {
      const partes = [];
      for (const tid of plano.template_ids) {
        const tpl = await base44.asServiceRole.entities.TemplateContrato.get(tid).catch(() => null);
        if (tpl?.conteudo) partes.push(tpl.conteudo);
      }
      conteudoFinal = partes.join('\n\n<hr/>\n\n');
    }
    if (conteudoFinal) conteudoFinal = aplicarVars(conteudoFinal, varsIXC);

    // --- Monta o body do ZapSign ---
    let zapBody;

    if (conteudoFinal && !template_pdf_url) {
      // Gera PDF a partir do conteúdo do template e envia como base64
      console.log('Gerando PDF a partir do conteúdo do template...');
      const pdfBase64 = await gerarPdfBase64(conteudoFinal);

      zapBody = {
        name: `Contrato - ${signerName}`,
        base64_pdf: pdfBase64,
        external_id: pedido_id,
        signers: [
          {
            name: signerName,
            email: signerEmail || undefined,
            phone_country: '55',
            phone_number: signerPhone || undefined,
            auth_mode: authMode,
            send_automatic_email: !!signerEmail,
            send_automatic_whatsapp: !!signerPhone,
          },
        ],
        lang: 'pt-br',
        disable_signer_emails: false,
      };
    } else {
      // Usa URL de PDF externo (fluxo legado)
      zapBody = {
        name: `Contrato - ${signerName}`,
        url_pdf: template_pdf_url || '',
        external_id: pedido_id,
        signers: [
          {
            name: signerName,
            email: signerEmail || undefined,
            phone_country: '55',
            phone_number: signerPhone || undefined,
            auth_mode: authMode,
            send_automatic_email: !!signerEmail,
            send_automatic_whatsapp: !!signerPhone,
          },
        ],
        lang: 'pt-br',
        disable_signer_emails: false,
      };
    }

    console.log(`Enviando documento ZapSign para: ${signerName} (${signerEmail || signerPhone || 'sem contato'})`);

    const zapResp = await fetch(`${zapBaseUrl}/docs/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${zapToken}`,
      },
      body: JSON.stringify(zapBody),
    });

    const zapData = await zapResp.json();

    // Log da integração
    await base44.asServiceRole.entities.IntegrationLog.create({
      pedido_id, service: 'zapsign', step: 'criar_documento',
      request: { ...zapBody, base64_pdf: zapBody.base64_pdf ? '[PDF base64]' : undefined },
      response: zapData, ok: zapResp.ok,
    }).catch(e => console.warn('Erro ao salvar IntegrationLog:', e.message));

    if (!zapResp.ok) {
      console.error('Erro ZapSign:', JSON.stringify(zapData));
      return Response.json({ error: 'Erro ZapSign', detalhe: zapData }, { status: 502 });
    }

    const linkAssinatura = zapData?.signers?.[0]?.sign_url || zapData?.url || '';
    const idZapsign = zapData?.token || zapData?.open_id || '';

    console.log(`Documento criado no ZapSign: ${idZapsign} | Link: ${linkAssinatura}`);

    // Persiste contrato no CRM
    const contrato = await base44.asServiceRole.entities.Contrato.create({
      pedido_id,
      status: 'enviado',
      link_assinatura: linkAssinatura,
      id_zapsign: idZapsign,
      cliente_nome: signerName,
      cliente_email: signerEmail,
      cliente_telefone: signerPhone,
    });

    // Avança status do pedido
    await base44.asServiceRole.entities.Pedido.update(pedido_id, {
      status: 'contrato_pendente',
      link_assinatura: linkAssinatura,
      zapsign_doc_token: idZapsign,
      data_contrato: new Date().toISOString(),
    });

    // Envia link do contrato via WhatsApp pelo Evolution Go
    let whatsappEnviado = false;
    if (signerPhone && linkAssinatura) {
      const EVOLUTION_URL = Deno.env.get('EVOLUTION_URL');
      const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');
      const EVOLUTION_INSTANCE_TOKEN = Deno.env.get('EVOLUTION_INSTANCE_TOKEN');
      let EVOLUTION_INSTANCE_ID = Deno.env.get('EVOLUTION_INSTANCE_ID') || '';
      if (!EVOLUTION_INSTANCE_ID) {
        const statuses = await base44.asServiceRole.entities.EvolutionStatus.list();
        EVOLUTION_INSTANCE_ID = statuses[0]?.instance_id || '';
      }

      if (EVOLUTION_URL && EVOLUTION_API_KEY && EVOLUTION_INSTANCE_ID) {
        const mensagemWA = `Olá, ${signerName}! 👋\n\nSeu contrato está pronto para assinatura digital.\n\n✍️ *Assine agora clicando no link abaixo:*\n${linkAssinatura}\n\n_Este link é exclusivo para você. Qualquer dúvida, entre em contato conosco._`;

        const waResp = await fetch(`${EVOLUTION_URL}/send/text`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': EVOLUTION_INSTANCE_TOKEN || EVOLUTION_API_KEY,
            'instanceId': EVOLUTION_INSTANCE_ID,
          },
          body: JSON.stringify({ number: signerPhone, text: mensagemWA }),
        });

        whatsappEnviado = waResp.ok;
        if (!waResp.ok) {
          const err = await waResp.text().catch(() => '');
          console.warn('Aviso: falha ao enviar WhatsApp:', err);
        } else {
          console.log(`WhatsApp enviado para ${signerPhone}`);
        }
      }
    }

    return Response.json({
      success: true,
      contrato,
      link_assinatura: linkAssinatura,
      id_zapsign: idZapsign,
      whatsapp_enviado: whatsappEnviado,
    });
  } catch (error) {
    console.error('Erro ao enviar contrato:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});