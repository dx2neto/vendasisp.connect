import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { jsPDF } from 'npm:jspdf@4.0.0';

const onlyDigits = (v) => String(v || '').replace(/\D/g, '');

function getInstancias() {
  const raw = Deno.env.get('IXC_INSTANCES');
  if (raw) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length) {
        return arr.map((i, idx) => ({
          id: i.id ?? idx,
          cidade: i.cidade || i.nome || `IXC #${i.id ?? idx}`,
          host: String(i.host || '').replace(/\/$/, ''),
          auth: i.auth || i.token_basic || '',
        })).filter((i) => i.host && i.auth);
      }
    } catch (_) { /* fallback */ }
  }
  const host = (Deno.env.get('IXC_HOST') || '').replace(/\/$/, '');
  const auth = Deno.env.get('IXC_AUTH_BASIC') || '';
  return host && auth ? [{ id: 0, cidade: 'IXC (padrão)', host, auth }] : [];
}

async function ixcListar(inst, endpoint, body) {
  try {
    const r = await fetch(`${inst.host}/webservice/v1/${endpoint}`, {
      method: 'POST',
      headers: { Authorization: `Basic ${inst.auth}`, 'Content-Type': 'application/json', ixcsoft: 'listar' },
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    const registros = Array.isArray(data?.registros) ? data.registros : Array.isArray(data) ? data : [];
    return { ok: r.ok, registros };
  } catch (_) { return { ok: false, registros: [] }; }
}

async function consultarHistorico(cpf, logradouro, numero) {
  const instancias = getInstancias();
  const resultados = [];
  for (const inst of instancias) {
    const item = { id: inst.id, cidade: inst.cidade, ja_foi_cliente: false, meu_status: '', internet_no_endereco: false, cliente_anterior: null };
    if (cpf) {
      const rc = await ixcListar(inst, 'cliente', { qtype: 'cliente.cnpj_cpf', query: cpf, oper: '=', page: '1', rp: '5', sortname: 'cliente.id', sortorder: 'desc' });
      const meu = rc.registros[0];
      if (meu) { item.ja_foi_cliente = true; item.meu_status = meu.ativo || meu.status || ''; }
    }
    if (logradouro) {
      const ra = await ixcListar(inst, 'cliente', { qtype: 'cliente.endereco', query: logradouro, oper: 'L', page: '1', rp: '50', sortname: 'cliente.id', sortorder: 'desc' });
      const noEnd = ra.registros.filter((c) => (numero ? onlyDigits(c.numero) === onlyDigits(numero) : true) && onlyDigits(c.cnpj_cpf) !== onlyDigits(cpf));
      if (noEnd.length) {
        item.internet_no_endereco = true;
        const a = noEnd[0];
        item.cliente_anterior = { nome: a.razao || a.fantasia || a.nome || '—', cnpj_cpf: a.cnpj_cpf || '', status: a.ativo || '' };
      }
    }
    resultados.push(item);
  }
  return resultados;
}

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

    // Histórico por cidade (multi-IXC): já foi cliente? internet/cliente anterior no endereço?
    const historico = await consultarHistorico(
      onlyDigits(lead?.cnpj_cpf || pedido.lead_cpf),
      lead?.rua || '',
      lead?.numero || '',
    ).catch(() => []);

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
    const ensure = (h) => { if (y + h > 280) { doc.addPage(); y = 16; } };

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

    // ── Histórico do cliente / endereço (multi-IXC) ──
    ensure(20);
    secao('Histórico do Cliente e do Endereço');
    const foiClienteEm = historico.filter((h) => h.ja_foi_cliente).map((h) => h.cidade);
    const internetEm = historico.filter((h) => h.internet_no_endereco);
    linha('Já foi cliente?', foiClienteEm.length ? `SIM — ${foiClienteEm.join(', ')}` : 'Não localizado');
    linha('Internet no endereço?', internetEm.length ? `SIM — ${internetEm.map((h) => h.cidade).join(', ')}` : 'Não localizado');
    const anterior = internetEm.find((h) => h.cliente_anterior)?.cliente_anterior;
    if (anterior) {
      linha('Cliente anterior', anterior.nome, 'Doc.', anterior.cnpj_cpf || '—');
      linha('Situação do anterior', (anterior.status === 'S' ? 'Ativo' : anterior.status === 'N' ? 'Inativo' : anterior.status || '—'));
    }
    sep();

    // ── Consulta por ERP (cidades) ──
    ensure(14);
    secao('Consulta por ERP (cidades)');
    if (!historico.length) {
      doc.setFontSize(8.5); doc.setFont('helvetica', 'italic'); doc.setTextColor(120, 120, 120);
      doc.text('Nenhuma instância IXC configurada (defina o secret IXC_INSTANCES para consulta multi-cidade).', margin + 2, y);
      y += 7;
    } else {
      doc.setFontSize(8); doc.setFont('helvetica', 'normal');
      for (const h of historico) {
        ensure(7);
        const flags = [];
        if (h.ja_foi_cliente) flags.push('já foi cliente');
        if (h.internet_no_endereco) flags.push('internet no endereço');
        const txt = flags.length ? flags.join(' · ') : 'sem histórico';
        doc.setTextColor(90, 90, 90);
        doc.text(`ERP (${h.id}) ${h.cidade}:`, margin + 2, y);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(h.ja_foi_cliente || h.internet_no_endereco ? 200 : 60, h.ja_foi_cliente || h.internet_no_endereco ? 120 : 120, 30);
        doc.text(txt, margin + 70, y);
        doc.setFont('helvetica', 'normal');
        y += 5;
      }
      y += 2;
    }
    sep();

    // ── Aceite dos Termos ──
    ensure(16);
    secao('Aceite dos Termos');
    doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 60, 60);
    doc.text('Li, entendi e aceito os Termos do Contrato de Prestação de Serviços de Comunicação Multimídia.', margin + 2, y);
    y += 8;

    // Segurança (se disponível)
    if (contrato?.ip_assinante || pedido.ip_assinatura) {
      ensure(20);
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
