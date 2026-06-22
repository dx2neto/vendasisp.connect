import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { jsPDF } from 'npm:jspdf@4.2.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { pedido_id } = await req.json();

    if (!pedido_id) {
      return Response.json({ error: 'pedido_id é obrigatório' }, { status: 400 });
    }

    // Busca dados do pedido
    const pedidos = await base44.asServiceRole.entities.Pedido.filter({ id: pedido_id });
    if (!pedidos || pedidos.length === 0) {
      return Response.json({ error: 'Pedido não encontrado' }, { status: 404 });
    }
    const pedido = pedidos[0];

    // Busca dados do lead
    let lead = null;
    if (pedido.lead_id) {
      const leads = await base44.asServiceRole.entities.Lead.filter({ id: pedido.lead_id });
      lead = leads?.[0];
    }

    // Busca dados do plano
    let plano = null;
    if (pedido.plano_id) {
      const planos = await base44.asServiceRole.entities.Plano.filter({ id: pedido.plano_id });
      plano = planos?.[0];
    }

    // Busca análise de crédito
    let analise = null;
    if (pedido.id) {
      const analises = await base44.asServiceRole.entities.AnaliseCredito.filter({ pedido_id: pedido.id });
      analise = analises?.[0];
    }

    // Cria PDF
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPos = 15;

    const addSection = (title, data) => {
      if (yPos > pageHeight - 30) {
        doc.addPage();
        yPos = 15;
      }
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text(title, 15, yPos);
      yPos += 7;
      
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      Object.entries(data).forEach(([key, value]) => {
        if (value) {
          doc.text(`${key}: ${value}`, 15, yPos);
          yPos += 5;
        }
      });
      yPos += 3;
    };

    // Header
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text(`Pedido: #${pedido.id || 'N/A'}`, 15, yPos);
    yPos += 8;
    doc.setFontSize(11);
    doc.text(`CNPJ: ${lead?.cnpj_cpf || 'N/A'}`, 15, yPos);
    yPos += 8;

    // Status
    const statusColor = pedido.status === 'ativado' ? [34, 197, 94] : 
                        pedido.status === 'recusado' ? [239, 68, 68] : [251, 146, 60];
    doc.setFillColor(...statusColor);
    doc.rect(15, yPos - 4, pageWidth - 30, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined, 'bold');
    doc.text(pedido.status?.toUpperCase() || 'NOVO', 15, yPos + 1);
    doc.setTextColor(0, 0, 0);
    yPos += 12;

    // Dados Assinatura
    addSection('Dados Assinatura', {
      'Assinatura de': lead?.tipo_pessoa === 'F' ? 'Cliente NOVO' : 'Empresa',
      'Tipo de acesso': lead?.canal_origem || '—',
      'Fidelidade': '12 meses',
      'Provedor Atual': '—',
      'Origem Comercial': lead?.canal_origem || '—',
      'Revendedor': pedido.revendedor_nome || '—',
      'Horário da assinatura': pedido.created_date ? new Date(pedido.created_date).toLocaleString('pt-BR') : '—',
      'Integração ERP': 'IXC'
    });

    // Dados do Cliente
    addSection('Dados do cliente', {
      'Nome Completo': lead?.nome || '—',
      'RG': lead?.rg || '—',
      'CPF': lead?.cnpj_cpf || '—',
      'Celular': lead?.telefone || '—',
      'E-mail': lead?.email || '—'
    });

    // Endereço
    addSection('Endereço', {
      'Logradouro': lead?.rua || '—',
      'Número': lead?.numero || '—',
      'Bairro': lead?.bairro || '—',
      'Cidade': lead?.cidade_nome || '—',
      'Estado': lead?.uf || '—',
      'CEP': lead?.cep || '—',
      'Complemento': lead?.complemento || '—'
    });

    // Pedido
    addSection('Pedido', {
      'Plano escolhido': plano?.nome || '—',
      'Velocidade': plano?.velocidade_mbps ? `${plano.velocidade_mbps} MBPS` : '—',
      'Preço Base': plano?.preco_mensal ? `R$ ${plano.preco_mensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—',
      'Total': pedido.valor ? `R$ ${pedido.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'
    });

    // Pagamento
    addSection('Pagamento', {
      'Vencimento': '15',
      'Tipo de pagamento': 'Boleto por E-Mail',
      'Email': lead?.email || '—'
    });

    // Análise Financeira
    if (analise) {
      addSection('Análise Financeira', {
        'Resultado': analise.resultado?.toUpperCase() || '—',
        'Score': analise.score || '—',
        'Chance de Inadimplência': analise.probabilidade_inadimplencia ? `${analise.probabilidade_inadimplencia}%` : '—',
        'Classificação': analise.classificacao_abc || '—'
      });
    }

    // Análise de Pendências
    addSection('Análise de Pendências Internas', {
      'Status': 'Aprovado'
    });

    // Informações de segurança
    addSection('Informações de segurança', {
      'Data/Hora': new Date().toLocaleString('pt-BR'),
      'Usuário': user.full_name || user.email
    });

    // Salva PDF
    const pdfBytes = doc.output('arraybuffer');
    const uploadRes = await base44.integrations.Core.UploadFile({ file: pdfBytes });

    // Atualiza o Lead com URL do relatório
    if (lead?.id && uploadRes.file_url) {
      await base44.asServiceRole.entities.Lead.update(lead.id, {
        relatorio_serasa_url: uploadRes.file_url
      });
    }

    return Response.json({
      success: true,
      relatorio_url: uploadRes.file_url,
      pedido_id: pedido.id
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});