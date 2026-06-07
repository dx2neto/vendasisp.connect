import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { pedido_id, cpf_cnpj, lead_nome } = await req.json();
    if (!cpf_cnpj) return Response.json({ error: 'cpf_cnpj obrigatório' }, { status: 400 });

    const chave = Deno.env.get('VALIDO_CHAVE_ACESSO');
    if (!chave) return Response.json({ error: 'VALIDO_CHAVE_ACESSO não configurada' }, { status: 500 });

    // Chamada à API Valido Cadastro (TOP+)
    const url = `https://api.validocadastro.com.br/v1/consulta/topMais`;
    const payload = { chaveAcesso: chave, cpfCnpj: cpf_cnpj.replace(/\D/g, '') };

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await resp.json();

    if (!resp.ok) {
      // Salva o erro na entidade
      if (pedido_id) {
        await base44.asServiceRole.entities.AnaliseCredito.create({
          pedido_id,
          lead_nome: lead_nome || '',
          cpf_cnpj,
          resultado: 'erro',
          observacao: JSON.stringify(data),
        });
        await base44.asServiceRole.entities.Pedido.update(pedido_id, { status: 'analise_credito' });
      }
      return Response.json({ error: 'Erro na API Valido', detalhe: data }, { status: 502 });
    }

    // Extrai campos da resposta
    const score = data?.score?.pontuacao ?? data?.pontuacao ?? null;
    const classAbc = data?.score?.classificacaoAbc ?? data?.classificacaoAbc ?? null;
    const classNro = data?.score?.classificacao ?? data?.classificacao ?? null;
    const probInad = data?.probabilidadeInadimplencia ?? data?.score?.probabilidadeInadimplencia ?? null;
    const textoRisco = data?.textoRisco ?? data?.score?.textoRisco ?? null;
    const chaveConsulta = data?.chaveConsulta ?? data?.protocolo ?? null;

    // Lê as regras de aprovação
    const configs = await base44.asServiceRole.entities.ConfigRegras.list();
    const config = configs[0] || {};
    const scoreMinimo = config.score_minimo_credito ?? 400;
    const probMaxima = config.probabilidade_maxima ?? 30;

    let resultado = 'manual';
    if (score !== null && probInad !== null) {
      if (score >= scoreMinimo && probInad <= probMaxima) resultado = 'aprovado';
      else if (score < scoreMinimo || probInad > probMaxima) resultado = 'reprovado';
    }

    // Persiste análise
    const analise = await base44.asServiceRole.entities.AnaliseCredito.create({
      pedido_id: pedido_id || '',
      lead_nome: lead_nome || '',
      cpf_cnpj,
      score,
      classificacao_abc: classAbc,
      classificacao_nro: classNro,
      probabilidade_inadimplencia: probInad,
      texto_risco: textoRisco,
      chave_consulta: chaveConsulta,
      resultado,
    });

    // Avança pedido
    if (pedido_id) {
      const novoStatus = resultado === 'aprovado' ? 'viabilidade'
        : resultado === 'reprovado' ? 'recusado'
        : 'analise_credito';
      await base44.asServiceRole.entities.Pedido.update(pedido_id, {
        status: novoStatus,
        data_credito: new Date().toISOString(),
      });
    }

    return Response.json({ analise, resultado, score, probabilidade_inadimplencia: probInad });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});