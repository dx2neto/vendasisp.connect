import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { jsPDF } from 'npm:jspdf@4.0.0';

// Gera o PDF de ANÁLISE de um pedido (crédito + dados + porquê aprovou/reprovou).
// Restrito a admin e gerente. Entrada: { pedido_id }.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });
    if (!['admin', 'gerente'].includes(user.role)) {
      return Response.json({ error: 'Acesso restrito a gerentes e administradores' }, { status: 403 });
    }

    const { pedido_id } = await req.json();
    if (!pedido_id) return Response.json({ error: 'pedido_id obrigatório' }, { status: 400 });

    const db = base44.asServiceRole;
    const pedido = await db.entities.Pedido.get(pedido_id);
    if (!pedido) return Response.json({ error: 'Pedido não encontrado' }, { status: 404 });

    const lead = pedido.lead_id ? await db.entities.Lead.get(pedido.lead_id).catch(() => null) : null;
    const plano = pedido.plano_id ? await db.entities.Plano.get(pedido.plano_id).catch(() => null) : null;
    const contrato = pedido.contrato_id ? await db.entities.Contrato.get(pedido.contrato_id).catch(() => null) : null;

    // Análise de crédito mais recente do pedido
    const analises = await db.entities.AnaliseCredito.filter({ pedido_id }, '-created_date', 1).catch(() => []);
    const analise = analises[0] || null;

    // Regras de aprovação
    const cfg = (await db.entities.ConfigRegras.list().catch(() => []))[0] || {};
    const scoreMin = cfg.score_minimo_credito ?? 400;
    const probMax = cfg.probabilidade_maxima ?? 30;

    // Resultado + motivo (o "porquê")
    const score = analise?.score ?? null;
    const probInad = analise?.probabilidade_inadimplencia ?? null;
    const resultado = (analise?.resultado || pedido.status_credito || '').toLowerCase();

    const scoreOk = score != null ? score >= scoreMin : null;
    const probOk = probInad != null ? probInad <= probMax : null;

    let veredito = 'Aguardando análise';
    if (resultado === 'aprovado') veredito = 'Aprovado';
    else if (resultado === 'reprovado' || resultado === 'recusado') veredito = 'Reprovado';
    else if (resultado === 'erro') veredito = 'Erro na consulta';
    else if (scoreOk != null && probOk != null) veredito = (scoreOk && probOk) ? 'Aprovado' : 'Reprovado';

    const motivos = [];
    if (score != null) motivos.push(`Score ${score} (mínimo ${scoreMin}) → ${scoreOk ? 'OK' : 'ABAIXO'}`);
    if (probInad != null) motivos.push(`Inadimplência ${Number(probInad).toFixed(2)}% (máx. ${probMax}%) → ${probOk ? 'OK' : 'ACIMA'}`);
    if (analise?.classificacao_abc) motivos.push(`Classificação ABC: ${analise.classificacao_abc}`);
    if (!analise) motivos.push('Sem registro de análise de crédito para este pedido.');

    const fmtDoc = (v) => {
      const d = String(v || '').replace(/\D/g, '');
      if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
      if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
      return v || '—';
    };

    const now = new Date();
    const dataFormatada = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const numeroPedido = `#${String(pedido.id).slice(0, 8).toUpperCase()}`;

    // ─── PDF ───
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = 210, margin = 14;
    let y = 0;

    // Cabeçalho
    doc.setFillColor(30, 88, 158);
    doc.rect(0, 0, W, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text('RELATÓRIO DE ANÁLISE', margin, 11);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.text('CONNECT TELECOM LTDA — CNPJ: 09.318.485/0001-30', margin, 17);
    doc.text('Documento interno — uso restrito (gerência)', margin, 22);
    doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text(`Pedido: ${numeroPedido}`, W - margin, 11, { align: 'right' });
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.text(dataFormatada, W - margin, 17, { align: 'right' });
    y = 34;

    // Banner do veredito
    const verde = veredito === 'Aprovado';
    const vermelho = veredito === 'Reprovado';
    doc.setFillColor(verde ? 34 : vermelho ? 220 : 234, verde ? 197 : vermelho ? 38 : 179, verde ? 94 : vermelho ? 38 : 8);
    doc.roundedRect(margin, y, W - margin * 2, 10, 2, 2, 'F');
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
    doc.text(`● ${veredito}`.toUpperCase(), margin + 4, y + 7);
    y += 16;

    const secao = (t) => {
      doc.setFillColor(245, 247, 250);
      doc.roundedRect(margin, y, W - margin * 2, 8, 1, 1, 'F');
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 88, 158);
      doc.text(t.toUpperCase(), margin + 3, y + 5.5);
      y += 11;
    };
    const linha = (l, v, l2, v2) => {
      doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 100, 100);
      doc.text(l + ':', margin + 2, y);
      doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 30);
      doc.text(String(v ?? '—'), margin + 42, y);
      if (l2) {
        doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 100, 100);
        doc.text(l2 + ':', W / 2 + 2, y);
        doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 30);
        doc.text(String(v2 ?? '—'), W / 2 + 42, y);
      }
      y += 6.5;
    };
    const sep = () => { doc.setDrawColor(220, 220, 220); doc.line(margin, y, W - margin, y); y += 5; };

    // Dados da assinatura
    secao('Dados da Assinatura');
    linha('Tipo de acesso', pedido.tipo_acesso || 'Residencial', 'Fidelidade', pedido.fidelidade || '12 meses');
    linha('Origem comercial', pedido.canal_origem || lead?.canal_origem || '—', 'Revendedor', pedido.revendedor_nome || '—');
    linha('Vendedor', pedido.vendedor_nome || '—', 'Horário', pedido.data_contrato ? new Date(pedido.data_contrato).toLocaleString('pt-BR') : dataFormatada);
    sep();

    // Cliente
    secao('Dados do Cliente');
    linha('Nome', lead?.nome || pedido.lead_nome || '—');
    linha('CPF/CNPJ', fmtDoc(lead?.cnpj_cpf || pedido.lead_cpf), 'RG', lead?.rg || '—');
    linha('Celular', lead?.telefone || '—', 'E-mail', lead?.email || '—');
    sep();

    // Endereço
    secao('Endereço');
    linha('Logradouro', lead?.rua || '—', 'Número', lead?.numero || '—');
    linha('Bairro', lead?.bairro || '—', 'CEP', lead?.cep || '—');
    linha('Cidade', lead?.cidade_nome || '—', 'UF', lead?.uf || '—');
    sep();

    // Pedido / pagamento
    secao('Pedido e Pagamento');
    linha('Plano', plano?.nome || pedido.plano_nome || '—', 'Valor', pedido.valor != null ? `R$ ${Number(pedido.valor).toFixed(2)}/mês` : '—');
    linha('Vencimento', `dia ${pedido.vencimento_dia || pedido.vencimento || '—'}`, 'Status pedido', pedido.status || '—');
    sep();

    // ANÁLISE FINANCEIRA — o porquê
    secao('Análise Financeira (Crédito)');
    const verde2 = veredito === 'Aprovado';
    doc.setFillColor(verde2 ? 34 : 220, verde2 ? 197 : 38, verde2 ? 94 : 38);
    doc.roundedRect(margin, y, W - margin * 2, 8, 1.5, 1.5, 'F');
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
    doc.text(`● ${veredito}`, margin + 4, y + 5.5);
    y += 13;
    linha('Score', score ?? '—', 'Inadimplência', probInad != null ? `${Number(probInad).toFixed(2)}%` : '—');
    linha('Critério score', `mínimo ${scoreMin}`, 'Critério inadimpl.', `máx. ${probMax}%`);

    // Motivos (porquê)
    doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 88, 158);
    doc.text('Motivo da decisão:', margin + 2, y); y += 5.5;
    doc.setFont('helvetica', 'normal'); doc.setTextColor(50, 50, 50);
    for (const m of motivos) {
      const linhas = doc.splitTextToSize(`• ${m}`, W - margin * 2 - 4);
      doc.text(linhas, margin + 4, y); y += linhas.length * 5;
    }
    if (analise?.texto_risco) {
      y += 1;
      doc.setFont('helvetica', 'italic'); doc.setTextColor(90, 90, 90);
      const msg = doc.splitTextToSize(`Mensagem do sistema: ${analise.texto_risco}`, W - margin * 2 - 4);
      doc.text(msg, margin + 4, y); y += msg.length * 5;
    }
    y += 2; sep();

    // Pendências internas
    secao('Pendências Internas');
    linha('Resultado', pedido.status === 'recusado' ? 'Reprovado' : 'Aprovado');
    sep();

    // Segurança (se disponível)
    if (contrato?.ip_assinante || pedido.ip_assinatura) {
      secao('Informações de Segurança');
      linha('IP do assinante', contrato?.ip_assinante || pedido.ip_assinatura || '—');
      if (contrato?.navegador_assinante) {
        doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(90, 90, 90);
        const nav = doc.splitTextToSize(`Navegador: ${contrato.navegador_assinante}`, W - margin * 2 - 4);
        doc.text(nav, margin + 2, y); y += nav.length * 4.5;
      }
      sep();
    }

    // Rodapé
    doc.setFillColor(245, 247, 250);
    doc.rect(0, 285, W, 12, 'F');
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(130, 130, 130);
    doc.text(`Relatório gerado por ${user.full_name || user.email || 'gerência'} em ${dataFormatada}`, W / 2, 291, { align: 'center' });
    doc.text('CONNECT TELECOM LTDA — uso interno e confidencial', W / 2, 295, { align: 'center' });

    const pdfBytes = doc.output('arraybuffer');
    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=analise_${String(lead?.nome || pedido.lead_nome || 'cliente').replace(/\s+/g, '_')}_${numeroPedido.replace('#', '')}.pdf`,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
