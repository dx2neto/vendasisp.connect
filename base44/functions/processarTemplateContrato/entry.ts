import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { template_id, variaveis } = await req.json();

    if (!template_id || !variaveis) {
      return Response.json({ error: 'template_id e variaveis obrigatórios' }, { status: 400 });
    }

    // Busca o template
    const template = await base44.asServiceRole.entities.TemplateContrato.get(template_id);
    if (!template) {
      return Response.json({ error: 'Template não encontrado' }, { status: 404 });
    }

    // Processa o conteúdo substituindo variáveis.
    // Suporta {{chave}} (legado), #chave# (modelos do IXC) e {chave}. Sem distinção de maiúsc./minúsc.
    let conteudoProcessado = template.conteudo || '';

    const mapa = {};
    Object.entries(variaveis).forEach(([k, v]) => { mapa[String(k).toLowerCase()] = String(v ?? ''); });
    const valor = (k) => (mapa[String(k).toLowerCase()] != null ? mapa[String(k).toLowerCase()] : '');

    conteudoProcessado = conteudoProcessado
      .replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => valor(k))
      .replace(/#([a-zA-Z0-9_]+)#/g, (_, k) => valor(k))
      .replace(/\{\s*([a-zA-Z0-9_]+)\s*\}/g, (_, k) => valor(k));

    // Verifica variáveis não substituídas (qualquer um dos formatos)
    const variaveisNaoSubstituidas = (
      conteudoProcessado.match(/\{\{(\w+)\}\}|#(\w+)#/g) || []
    ).map((v) => v.replace(/[{}#]/g, ''));

    return Response.json({
      success: true,
      conteudo_processado: conteudoProcessado,
      variaveis_nao_substituidas: variaveisNaoSubstituidas,
      template_original: template.nome,
    });
  } catch (error) {
    console.error('Erro ao processar template:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});