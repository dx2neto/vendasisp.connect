import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Converte HTML simples em PDF base64 via html-pdf-node (fallback: usa jsPDF-like approach com texto puro)
async function htmlParaPdfBase64(html) {
  // Estratégia: usa a API de PDF do ZapSign com base64 de HTML convertido manualmente
  // Remove tags HTML e formata como texto puro para o PDF
  const textoLimpo = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
  return textoLimpo;
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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { pedido_id, template_pdf_url, conteudo_contrato, template_id } = await req.json();
    if (!pedido_id) return Response.json({ error: 'pedido_id obrigatório' }, { status: 400 });

    const zapToken = Deno.env.get('ZAPSIGN_TOKEN');
    if (!zapToken) return Response.json({ error: 'ZAPSIGN_TOKEN não configurado' }, { status: 500 });

    // Busca pedido e lead
    const pedido = await base44.asServiceRole.entities.Pedido.get(pedido_id);
    if (!pedido) return Response.json({ error: 'Pedido não encontrado' }, { status: 404 });

    let lead = null;
    if (pedido.lead_id) {
      lead = await base44.asServiceRole.entities.Lead.get(pedido.lead_id).catch(() => null);
    }

    const signerName = pedido.lead_nome || 'Cliente';
    const signerEmail = lead?.email || '';
    const signerPhone = (lead?.telefone || '').replace(/\D/g, '');

    // --- Monta o body do ZapSign ---
    let zapBody;

    if (conteudo_contrato && !template_pdf_url) {
      // Gera PDF a partir do conteúdo do template e envia como base64
      console.log('Gerando PDF a partir do conteúdo do template...');
      const pdfBase64 = await gerarPdfBase64(conteudo_contrato);

      zapBody = {
        name: `Contrato - ${signerName}`,
        base64_pdf: pdfBase64,
        signers: [
          {
            name: signerName,
            email: signerEmail || undefined,
            phone_country: '55',
            phone_number: signerPhone || undefined,
            auth_mode: 'assinaturaTela',
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
        signers: [
          {
            name: signerName,
            email: signerEmail || undefined,
            phone_country: '55',
            phone_number: signerPhone || undefined,
            auth_mode: 'assinaturaTela',
            send_automatic_email: !!signerEmail,
            send_automatic_whatsapp: !!signerPhone,
          },
        ],
        lang: 'pt-br',
        disable_signer_emails: false,
      };
    }

    console.log(`Enviando documento ZapSign para: ${signerName} (${signerEmail || signerPhone || 'sem contato'})`);

    const zapResp = await fetch('https://api.zapsign.com.br/api/v1/docs/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${zapToken}`,
      },
      body: JSON.stringify(zapBody),
    });

    const zapData = await zapResp.json();

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
      data_contrato: new Date().toISOString(),
    });

    // Envia link do contrato via WhatsApp pelo Evolution Go
    let whatsappEnviado = false;
    if (signerPhone && linkAssinatura) {
      const EVOLUTION_URL = Deno.env.get('EVOLUTION_URL');
      const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');
      const EVOLUTION_INSTANCE_ID = Deno.env.get('EVOLUTION_INSTANCE_ID');

      if (EVOLUTION_URL && EVOLUTION_API_KEY) {
        const mensagemWA = `Olá, ${signerName}! 👋\n\nSeu contrato está pronto para assinatura digital.\n\n✍️ *Assine agora clicando no link abaixo:*\n${linkAssinatura}\n\n_Este link é exclusivo para você. Qualquer dúvida, entre em contato conosco._`;

        const waResp = await fetch(`${EVOLUTION_URL}/send/text`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': EVOLUTION_API_KEY,
            'instanceId': EVOLUTION_INSTANCE_ID || '',
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