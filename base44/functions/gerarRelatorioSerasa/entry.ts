import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { lead_id, cpf_cnpj } = await req.json();
    if (!lead_id && !cpf_cnpj) {
      return Response.json({ error: 'lead_id ou cpf_cnpj obrigatório' }, { status: 400 });
    }

    const chave = Deno.env.get('VALIDO_CHAVE_ACESSO');
    if (!chave) return Response.json({ error: 'VALIDO_CHAVE_ACESSO não configurada' }, { status: 500 });

    // Busca lead se necessário
    let lead = null;
    let doc = cpf_cnpj || '';
    if (lead_id) {
      lead = await base44.asServiceRole.entities.Lead.get(lead_id);
      if (!lead) return Response.json({ error: 'Lead não encontrado' }, { status: 404 });
      doc = lead.cnpj_cpf || doc;
    }
    if (!doc) return Response.json({ error: 'CPF/CNPJ não encontrado' }, { status: 400 });

    // Consulta API Valido Cadastro
    const resp = await fetch('https://api.validocadastro.com.br/json/service.aspx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        CodigoProduto: '630',
        Versao: '20180521',
        ChaveAcesso: chave,
        Info: { Solicitante: '' },
        Parametros: {
          TipoPessoa: doc.length === 14 ? 'J' : 'F',
          CPFCNPJ: doc.replace(/\D/g, ''),
        },
        WebHook: { UrlCallBack: '' },
      }),
    });

    const respText = await resp.text();
    let data;
    try {
      data = JSON.parse(respText);
    } catch {
      return Response.json({
        error: 'Resposta inválida da API Valido (não-JSON)',
        status: resp.status,
        preview: respText.slice(0, 300),
      }, { status: 502 });
    }

    if (!resp.ok) {
      return Response.json({ error: 'Erro na API Valido', detalhe: data }, { status: 502 });
    }

    // Extrai campos da resposta Valido Cadastro
    const score = data?.Resultado?.score ?? data?.score ?? null;
    const classAbc = data?.Resultado?.classificacaoAbc ?? data?.classificacaoAbc ?? null;
    const classNro = data?.Resultado?.classificacao ?? data?.classificacao ?? null;
    const probInad = data?.Resultado?.probabilidadeInadimplencia ?? data?.probabilidadeInadimplencia ?? null;
    const textoRisco = data?.Resultado?.textoRisco ?? data?.textoRisco ?? null;
    const chaveConsulta = data?.Resultado?.chaveConsulta ?? data?.chaveConsulta ?? null;
    const dadosCliente = data?.Resultado?.dados ?? data?.dados ?? {};

    // Regras de aprovação
    const configs = await base44.asServiceRole.entities.ConfigRegras.list();
    const cfg = configs[0] || {};
    const scoreMinimo = cfg.score_minimo_credito ?? 400;
    const probMaxima = cfg.probabilidade_maxima ?? 30;

    let resultado = 'manual';
    let riscoAlto = false;
    if (score !== null && probInad !== null) {
      if (score >= scoreMinimo && probInad <= probMaxima) {
        resultado = 'aprovado';
      } else {
        resultado = 'reprovado';
        riscoAlto = true;
      }
    }

    // Gera PDF do relatório
    const { jsPDF } = await import('npm:jspdf@2.5.1');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const nomeCliente = lead?.nome || dadosCliente?.nome || 'Cliente';
    const docFormatado = doc.length === 11
      ? doc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
      : doc.length === 14
      ? doc.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
      : doc;

    // Cabeçalho
    pdf.setFillColor(14, 165, 233);
    pdf.rect(0, 0, 210, 35, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.text('RELATÓRIO DE CRÉDITO', 105, 18, { align: 'center' });
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Consulta Serasa / Valido Cadastro (TOP+)', 105, 27, { align: 'center' });

    // Data
    pdf.setTextColor(100, 100, 100);
    pdf.setFontSize(9);
    pdf.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 20, 45);

    // Dados do cliente
    pdf.setTextColor(40, 40, 40);
    pdf.setFontSize(13);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Dados do Cliente', 20, 58);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    let y = 68;
    const linhasDados = [
      ['Nome:', nomeCliente],
      ['CPF/CNPJ:', docFormatado],
      ['Telefone:', lead?.telefone || dadosCliente?.telefone || dadosCliente?.celular || '—'],
      ['Email:', lead?.email || dadosCliente?.email || '—'],
      ['Endereço:', [lead?.rua || dadosCliente?.logradouro, lead?.numero || dadosCliente?.numero, lead?.bairro || dadosCliente?.bairro].filter(Boolean).join(', ') || '—'],
      ['Cidade:', [lead?.cidade_nome || dadosCliente?.municipio, lead?.uf || dadosCliente?.uf].filter(Boolean).join(' - ') || '—'],
    ];
    for (const [label, valor] of linhasDados) {
      pdf.setFont('helvetica', 'bold');
      pdf.text(label, 20, y);
      pdf.setFont('helvetica', 'normal');
      pdf.text(String(valor), 50, y);
      y += 7;
    }

    // Resultado da análise
    y += 8;
    pdf.setFontSize(13);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Resultado da Análise', 20, y);
    y += 10;

    pdf.setFontSize(10);
    const corResultado = resultado === 'aprovado' ? [16, 185, 129] : resultado === 'reprovado' ? [239, 68, 68] : [245, 158, 11];
    pdf.setFillColor(...corResultado);
    pdf.rect(20, y - 5, 170, 10, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`RESULTADO: ${resultado.toUpperCase()}`, 105, y + 1.5, { align: 'center' });
    y += 15;

    pdf.setTextColor(40, 40, 40);
    pdf.setFont('helvetica', 'normal');
    const linhasAnalise = [
      ['Score:', score !== null ? String(score) : '—'],
      ['Classificação ABC:', classAbc || '—'],
      ['Classificação Numérica:', classNro || '—'],
      ['Probabilidade de Inadimplência:', probInad !== null ? `${probInad}%` : '—'],
      ['Texto de Risco:', textoRisco || '—'],
      ['Chave de Consulta:', chaveConsulta || '—'],
    ];
    for (const [label, valor] of linhasAnalise) {
      pdf.setFont('helvetica', 'bold');
      pdf.text(label, 20, y);
      pdf.setFont('helvetica', 'normal');
      const linhas = pdf.splitTextToSize(String(valor), 120);
      pdf.text(linhas, 80, y);
      y += 7 * linhas.length;
    }

    // Alerta de risco
    if (riscoAlto) {
      y += 6;
      pdf.setFillColor(254, 226, 226);
      pdf.rect(20, y - 5, 170, 14, 'F');
      pdf.setTextColor(185, 28, 28);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.text('⚠ ALERTA DE RISCO ELEVADO', 105, y + 1, { align: 'center' });
      pdf.setFontSize(8);
      pdf.text('Cliente com score abaixo do mínimo ou probabilidade de inadimplência acima do tolerado.', 105, y + 6, { align: 'center' });
    }

    // Rodapé
    pdf.setTextColor(150, 150, 150);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Documento gerado automaticamente pelo CRM — Connect Telecom', 105, 285, { align: 'center' });

    // Converte para blob e faz upload
    const pdfBase64 = pdf.output('datauristring').split(',')[1];
    const pdfBlob = Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0));
    const pdfFile = new Blob([pdfBlob], { type: 'application/pdf' });

    const uploadResult = await base44.asServiceRole.integrations.Core.UploadFile({
      file: pdfFile,
    });

    const relatorioUrl = uploadResult?.file_url || '';

    // Salva URL no lead
    if (lead) {
      await base44.asServiceRole.entities.Lead.update(lead.id, {
        relatorio_serasa_url: relatorioUrl,
      });
    }

    // Persiste análise
    const analise = await base44.asServiceRole.entities.AnaliseCredito.create({
      pedido_id: '',
      lead_nome: nomeCliente,
      cpf_cnpj: doc,
      score,
      classificacao_abc: classAbc,
      classificacao_nro: classNro,
      probabilidade_inadimplencia: probInad,
      texto_risco: textoRisco,
      chave_consulta: chaveConsulta,
      resultado,
    });

    return Response.json({
      success: true,
      relatorio_url: relatorioUrl,
      analise,
      resultado,
      score,
      probabilidade_inadimplencia: probInad,
      risco_alto: riscoAlto,
    });
  } catch (error) {
    console.error('Erro em gerarRelatorioSerasa:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});