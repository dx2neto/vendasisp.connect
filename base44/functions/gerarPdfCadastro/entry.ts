import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { jsPDF } from 'npm:jspdf@4.0.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { lead_id, pedido_id } = body;

    // Busca lead e pedido
    let lead = null;
    let pedido = null;

    if (lead_id) {
      const leads = await base44.entities.Lead.filter({ id: lead_id });
      lead = leads[0] || null;
    }
    if (pedido_id) {
      const pedidos = await base44.entities.Pedido.filter({ id: pedido_id });
      pedido = pedidos[0] || null;
    }

    if (!lead && !pedido) {
      return Response.json({ error: 'Lead ou Pedido não encontrado' }, { status: 404 });
    }

    // Monta dados unificados
    const now = new Date();
    const dataFormatada = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const numeroPedido = pedido?.id ? `#${pedido.id.slice(0, 8).toUpperCase()}` : `#${(lead?.id || '').slice(0, 8).toUpperCase()}`;

    const nome = lead?.nome || pedido?.lead_nome || '—';
    const cpf = lead?.cnpj_cpf || pedido?.lead_cpf || '—';
    const rg = lead?.rg || '—';
    const telefone = lead?.telefone || '—';
    const email = lead?.email || '—';
    const rua = lead?.rua || '—';
    const numero = lead?.numero || '—';
    const bairro = lead?.bairro || '—';
    const cidade = lead?.cidade_nome || '—';
    const uf = lead?.uf || '—';
    const cep = lead?.cep || '—';
    const complemento = lead?.complemento || '—';
    const canal = lead?.canal_origem || pedido?.canal_origem || '—';
    const plano = pedido?.plano_nome || lead?.plano_interesse || '—';
    const valor = pedido?.valor ? `R$ ${pedido.valor.toFixed(2)}/mês` : '—';
    const vendedor = pedido?.vendedor_nome || lead?.vendedor_nome || '—';
    const revendedor = pedido?.revendedor_nome || lead?.revendedor_id || '—';
    const status = pedido?.status || lead?.etapa_funil || '—';
    const observacao = lead?.observacao || pedido?.observacao || '—';

    const CANAL_LABELS = {
      porta_a_porta: 'Porta a Porta',
      call_center: 'Call Center',
      revenda: 'Revendedor',
      site: 'Site / Internet',
    };

    const STATUS_LABELS = {
      novo: 'Novo',
      analise_credito: 'Análise de Crédito',
      viabilidade: 'Viabilidade',
      contrato: 'Contrato',
      contrato_pendente: 'Contrato Pendente',
      assinado: 'Assinado',
      ativado: 'Ativado',
      recusado: 'Recusado',
    };

    // ─── Geração do PDF ───
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = 210;
    const margin = 14;
    let y = 0;

    // ── Cabeçalho ──
    doc.setFillColor(30, 88, 158); // azul Connect
    doc.rect(0, 0, W, 28, 'F');

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('CONNECT TELECOM LTDA', margin, 11);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('CNPJ: 09.318.485/0001-30', margin, 17);
    doc.text('Av. Francisco Abdon Marques, nº 256, Setor Suleste - Cachoeira Dourada/GO', margin, 22);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(`Pedido: ${numeroPedido}`, W - margin, 11, { align: 'right' });
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(dataFormatada, W - margin, 17, { align: 'right' });

    y = 34;

    // ── Banner status ──
    const statusOk = ['ativado', 'assinado', 'novo'].includes(status);
    doc.setFillColor(statusOk ? 34 : 234, statusOk ? 197 : 179, statusOk ? 94 : 8);
    doc.roundedRect(margin, y, W - margin * 2, 10, 2, 2, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(`● ${STATUS_LABELS[status] || status}`.toUpperCase(), margin + 4, y + 7);
    y += 16;

    // ── Função para seção ──
    const secao = (titulo) => {
      doc.setFillColor(245, 247, 250);
      doc.roundedRect(margin, y, W - margin * 2, 8, 1, 1, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 88, 158);
      doc.text(titulo.toUpperCase(), margin + 3, y + 5.5);
      y += 11;
    };

    const linha = (label, valor, col2Label, col2Valor) => {
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(label + ':', margin + 2, y);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 30, 30);
      doc.text(String(valor || '—'), margin + 40, y);

      if (col2Label) {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(col2Label + ':', W / 2 + 2, y);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 30, 30);
        doc.text(String(col2Valor || '—'), W / 2 + 40, y);
      }
      y += 6.5;
    };

    const separador = () => {
      doc.setDrawColor(220, 220, 220);
      doc.line(margin, y, W - margin, y);
      y += 5;
    };

    // ── Dados da Assinatura ──
    secao('Dados da Assinatura');
    linha('Origem Comercial', CANAL_LABELS[canal] || canal, 'Revendedor', revendedor);
    linha('Vendedor Responsável', vendedor, 'Horário', dataFormatada);
    separador();

    // ── Dados do Cliente ──
    secao('Dados do Cliente');
    linha('Nome Completo', nome);
    linha('CPF / CNPJ', cpf, 'RG / IE', rg);
    linha('Celular', telefone, 'E-mail', email);
    if (observacao !== '—') linha('Observação', observacao);
    separador();

    // ── Endereço ──
    secao('Endereço');
    linha('Logradouro', rua, 'Número', numero);
    linha('Bairro', bairro, 'CEP', cep);
    linha('Cidade', cidade, 'Estado', uf);
    if (complemento !== '—') linha('Complemento', complemento);
    separador();

    // ── Pedido ──
    secao('Pedido / Plano');
    // Tabela de plano
    doc.setFillColor(30, 88, 158);
    doc.rect(margin, y, W - margin * 2, 7, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('Plano Escolhido', margin + 3, y + 5);
    doc.text('Qtd', margin + 90, y + 5);
    doc.text('Preço Base', margin + 110, y + 5);
    doc.text('Subtotal', margin + 145, y + 5);
    y += 9;

    doc.setFillColor(250, 250, 250);
    doc.rect(margin, y, W - margin * 2, 7, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 30, 30);
    doc.text(plano, margin + 3, y + 5);
    doc.text('1', margin + 90, y + 5);
    doc.text(valor, margin + 110, y + 5);
    doc.text(valor, margin + 145, y + 5);
    y += 9;

    doc.setFillColor(30, 88, 158);
    doc.rect(margin + W - margin * 2 - 55, y, 55, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(`TOTAL: ${valor}`, margin + W - margin * 2 - 52, y + 5);
    y += 14;

    // ── Pagamento ──
    if (pedido) {
      separador();
      secao('Pagamento');
      linha('Tipo de Pagamento', 'Boleto por E-Mail', 'Vencimento', '15');
      linha('E-mail cobrança', email);
      y += 3;
    }

    // ── Análise Cadastral ──
    separador();
    secao('Análise Cadastral');
    const credito = status === 'ativado' ? 'Aprovado' : status === 'recusado' ? 'Reprovado' : 'Aguardando análise';
    doc.setFillColor(credito === 'Aprovado' ? 34 : credito === 'Reprovado' ? 220 : 250, credito === 'Aprovado' ? 197 : credito === 'Reprovado' ? 38 : 204, credito === 'Aprovado' ? 94 : credito === 'Reprovado' ? 38 : 6);
    doc.roundedRect(margin, y, W - margin * 2, 8, 1.5, 1.5, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(`● ${credito}`, margin + 4, y + 5.5);
    y += 14;

    // ── Aceite dos Termos ──
    separador();
    secao('Aceite dos Termos');
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text('Li, entendi e aceito os Termos do Contrato de Prestação de Serviços de Comunicação Multimídia.', margin + 2, y);
    y += 8;

    // ── Rodapé ──
    doc.setFillColor(245, 247, 250);
    doc.rect(0, 285, W, 12, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(130, 130, 130);
    doc.text('CONNECT TELECOM LTDA — CNPJ: 09.318.485/0001-30 — www.cnnct.net.br', W / 2, 291, { align: 'center' });
    doc.text(`Documento gerado em ${dataFormatada}`, W / 2, 295, { align: 'center' });

    const pdfBytes = doc.output('arraybuffer');

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=cadastro_${nome.replace(/\s+/g, '_')}_${numeroPedido}.pdf`,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});