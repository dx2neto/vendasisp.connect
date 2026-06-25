import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Pega valor aninhado por caminho dot: "Score.Valor" → data.Score.Valor
function getPath(obj, path) {
  if (!path) return undefined;
  return String(path).split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

// Verifica se há restrição/negativo ativo nos blocos típicos do produto 630 (Serasa)
function temRestricaoAtiva(data) {
  const blocos = ['Restricoes', 'restricoes', 'Pendencias', 'pendencias', 'Protestos', 'protestos', 'Negativacoes', 'negativacoes'];
  for (const b of blocos) {
    const bloco = data?.[b];
    if (!bloco) continue;
    if (Array.isArray(bloco) && bloco.length > 0) return true;
    if (typeof bloco === 'object') {
      const qtd = bloco.Total ?? bloco.Quantidade ?? bloco.QtdTotal ?? bloco.total;
      if (qtd != null && Number(qtd) > 0) return true;
    }
  }
  return false;
}

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

    // Idempotência: não reconsulta se já tem credit_status (salvo force=true = "Reconsultar")
    if (pedido.credit_status && !body.force) {
      return Response.json({
        skipped: true,
        reason: 'Crédito já consultado',
        resultado: pedido.credit_status,
        score: pedido.credit_score,
      });
    }

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
    const tipoPessoa = documento.length === 11 ? 'F' : 'J';
    const validoUrl = Deno.env.get('VALIDO_URL') || 'https://api.validocadastro.com.br/json/service.aspx';

    const requestPayload = {
      CodigoProduto: Deno.env.get('VALIDO_CODIGO_PRODUTO') || '630',
      Versao: Deno.env.get('VALIDO_VERSAO') || '20180521',
      ChaveAcesso: chave,
      Info: { Solicitante: pedido.lead_nome || pedido_id },
      Parametros: { TipoPessoa: tipoPessoa, CPFCNPJ: documento },
      WebHook: { UrlCallBack: '' },
    };

    let resp, rawData, data;
    try {
      resp = await fetch(validoUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      });
      rawData = await resp.json();
      data = rawData?.Retorno || rawData?.retorno || rawData?.Data || rawData?.data || rawData;
    } catch (fetchError) {
      // Erro de rede/timeout → credit_status = erro, permite reprocessar
      await base44.asServiceRole.entities.Pedido.update(pedido_id, {
        status: 'analise_credito',
        credit_status: 'erro',
        credit_response: { error: fetchError.message },
        credit_checked_at: new Date().toISOString(),
      });
      await base44.asServiceRole.entities.IntegrationLog.create({
        pedido_id, service: 'credito', step: 'consultar',
        request: requestPayload, response: { error: fetchError.message }, ok: false,
      });
      return Response.json({ error: 'Erro ao consultar Valido', detalhe: fetchError.message, resultado: 'erro' }, { status: 502 });
    }

    if (!resp.ok) {
      await base44.asServiceRole.entities.Pedido.update(pedido_id, {
        status: 'analise_credito',
        credit_status: 'erro',
        credit_response: data,
        credit_checked_at: new Date().toISOString(),
      });
      await base44.asServiceRole.entities.IntegrationLog.create({
        pedido_id, service: 'credito', step: 'consultar',
        request: requestPayload, response: data, ok: false,
      });
      await base44.asServiceRole.entities.AnaliseCredito.create({
        pedido_id, lead_nome: pedido.lead_nome || '', cpf_cnpj,
        resultado: 'erro', observacao: JSON.stringify(data),
      });
      return Response.json({ error: 'Erro na API Valido', detalhe: data, resultado: 'erro' }, { status: 502 });
    }

    // Config de decisão (motor | score)
    const configs = await base44.asServiceRole.entities.ConfigRegras.list();
    const cfg = configs[0] || {};
    const mode = cfg.credit_decision_mode || 'score';
    const scoreMinimo = cfg.credit_approve_score ?? cfg.score_minimo_credito ?? 400;
    const blockOnRestriction = cfg.credit_block_on_restriction ?? true;
    const scorePath = cfg.credit_score_path || '';
    const decisionPath = cfg.credit_decision_path || '';

    // Extrai score (por path configurado ou fallback)
    const score = scorePath
      ? getPath(data, scorePath)
      : (data?.score?.pontuacao ?? data?.pontuacao ?? data?.Score?.Valor ?? null);

    const classAbc = data?.score?.classificacaoAbc ?? data?.classificacaoAbc ?? null;
    const classNro = data?.score?.classificacao ?? data?.classificacao ?? null;
    const probInad = data?.probabilidadeInadimplencia ?? data?.score?.probabilidadeInadimplencia ?? null;
    const textoRisco = data?.textoRisco ?? data?.score?.textoRisco ?? null;
    const chaveConsulta = data?.chaveConsulta ?? data?.protocolo ?? null;

    const temRestricao = temRestricaoAtiva(data);

    // Decisão
    let resultado = 'manual';
    if (mode === 'motor' && decisionPath) {
      const decisao = String(getPath(data, decisionPath) ?? '').toLowerCase();
      if (decisao.includes('aprov') || decisao === 'a' || decisao === 'true') resultado = 'aprovado';
      else if (decisao.includes('reprov') || decisao === 'r' || decisao === 'false') resultado = 'reprovado';
    } else {
      // modo score
      if (score !== null) {
        if (blockOnRestriction && temRestricao) resultado = 'reprovado';
        else if (score >= scoreMinimo) resultado = 'aprovado';
        else resultado = 'reprovado';
      }
    }

    const agora = new Date().toISOString();

    // Persiste análise (auditoria)
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

    // Atualiza Pedido com campos de crédito + status
    const novoStatus = resultado === 'aprovado' ? 'viabilidade'
      : resultado === 'reprovado' ? 'recusado'
      : 'analise_credito';

    const creditStatusValue = resultado === 'aprovado' ? 'aprovado'
      : resultado === 'reprovado' ? 'reprovado'
      : null; // manual = pendente, não seta credit_status

    await base44.asServiceRole.entities.Pedido.update(pedido_id, {
      status: novoStatus,
      credit_status: creditStatusValue,
      credit_score: score,
      credit_response: rawData,
      credit_checked_at: agora,
      data_credito: agora,
    });

    // Log de integração
    await base44.asServiceRole.entities.IntegrationLog.create({
      pedido_id, service: 'credito', step: 'consultar',
      request: requestPayload, response: rawData, ok: true,
    });

    return Response.json({
      success: true,
      resultado,
      score,
      classificacao_abc: classAbc,
      tem_restricao: temRestricao,
      analise,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});