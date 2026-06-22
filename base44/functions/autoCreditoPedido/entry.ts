import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json();
    // Suporte a chamada direta (pedido_id) ou via automação (event.entity_id)
    const pedido_id = body.pedido_id || body.event?.entity_id;
    if (!pedido_id) return Response.json({ error: 'pedido_id obrigatório' }, { status: 400 });

    const chave = Deno.env.get('VALIDO_CHAVE_ACESSO');
    if (!chave) return Response.json({ error: 'Consulta de crédito indisponível: configure o secret VALIDO_CHAVE_ACESSO.', missing_secret: 'VALIDO_CHAVE_ACESSO' }, { status: 400 });

    // Busca pedido e lead para obter CPF/CNPJ
    const pedido = await base44.asServiceRole.entities.Pedido.get(pedido_id);
    if (!pedido) return Response.json({ error: 'Pedido não encontrado' }, { status: 404 });

    // Obtém CPF do pedido ou do lead vinculado
    let cpf_cnpj = pedido.lead_cpf || '';
    if (!cpf_cnpj && pedido.lead_id) {
      const lead = await base44.asServiceRole.entities.Lead.get(pedido.lead_id);
      cpf_cnpj = lead?.cnpj_cpf || '';
    }

    if (!cpf_cnpj) {
      // Sem CPF: marca como análise manual e encerra
      await base44.asServiceRole.entities.Pedido.update(pedido_id, { status: 'analise_credito' });
      return Response.json({ skipped: true, reason: 'CPF/CNPJ não encontrado no pedido' });
    }

    const documento = cpf_cnpj.replace(/\D/g, '');
    const validoUrl = Deno.env.get('VALIDO_URL') || 'https://api.validocadastro.com.br/json/service.aspx';
    const resp = await fetch(validoUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        CodigoProduto: Deno.env.get('VALIDO_CODIGO_PRODUTO') || '630',
        Versao: Deno.env.get('VALIDO_VERSAO') || '20180521',
        ChaveAcesso: chave,
        Info: { Solicitante: pedido.lead_nome || '' },
        Parametros: { TipoPessoa: documento.length === 11 ? 'F' : 'J', CPFCNPJ: documento },
        WebHook: { UrlCallBack: '' },
      }),
    });

    const rawData = await resp.json();
    const data = rawData?.Retorno || rawData?.retorno || rawData?.Data || rawData?.data || rawData;

    if (!resp.ok) {
      await base44.asServiceRole.entities.AnaliseCredito.create({
        pedido_id,
        lead_nome: pedido.lead_nome || '',
        cpf_cnpj,
        resultado: 'erro',
        observacao: JSON.stringify(data),
      });
      await base44.asServiceRole.entities.Pedido.update(pedido_id, { status: 'analise_credito' });
      return Response.json({ error: 'Erro na API Valido', detalhe: data }, { status: 502 });
    }

    // Extrai campos da resposta
    const score        = data?.score?.pontuacao              ?? data?.pontuacao              ?? null;
    const classAbc     = data?.score?.classificacaoAbc       ?? data?.classificacaoAbc       ?? null;
    const classNro     = data?.score?.classificacao          ?? data?.classificacao          ?? null;
    const probInad     = data?.probabilidadeInadimplencia    ?? data?.score?.probabilidadeInadimplencia ?? null;
    const textoRisco   = data?.textoRisco                    ?? data?.score?.textoRisco       ?? null;
    const chaveConsulta = data?.chaveConsulta                ?? data?.protocolo               ?? null;

    // Regras de aprovação
    const configs = await base44.asServiceRole.entities.ConfigRegras.list();
    const cfg = configs[0] || {};
    const scoreMinimo = cfg.score_minimo_credito ?? 400;
    const probMaxima  = cfg.probabilidade_maxima ?? 30;

    let resultado = 'manual';
    if (score !== null && probInad !== null) {
      if (score >= scoreMinimo && probInad <= probMaxima) resultado = 'aprovado';
      else resultado = 'reprovado';
    }

    // Persiste análise com classificação ABC
    const analise = await base44.asServiceRole.entities.AnaliseCredito.create({
      pedido_id,
      lead_nome: pedido.lead_nome || '',
      cpf_cnpj,
      score,
      classificacao_abc: classAbc,
      classificacao_nro: classNro,
      probabilidade_inadimplencia: probInad,
      texto_risco: textoRisco,
      chave_consulta: chaveConsulta,
      resultado,
    });

    // Avança status do pedido
    const novoStatus = resultado === 'aprovado' ? 'viabilidade'
      : resultado === 'reprovado' ? 'recusado'
      : 'analise_credito';

    await base44.asServiceRole.entities.Pedido.update(pedido_id, {
      status: novoStatus,
      data_credito: new Date().toISOString(),
    });

    return Response.json({ success: true, resultado, score, classificacao_abc: classAbc, analise });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
