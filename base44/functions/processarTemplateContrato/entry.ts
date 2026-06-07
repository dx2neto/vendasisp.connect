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

    // Processa o conteúdo substituindo variáveis
    let conteudoProcessado = template.conteudo;
    
    Object.entries(variaveis).forEach(([chave, valor]) => {
      const regex = new RegExp(`\\{\\{${chave}\\}\\}`, 'g');
      conteudoProcessado = conteudoProcessado.replace(regex, String(valor || ''));
    });

    // Verifica variáveis não substituídas
    const variaveisNaoSubstituidas = (conteudoProcessado.match(/\{\{(\w+)\}\}/g) || []).map(v =>
      v.replace(/\{\{|\}\}/g, '')
    );

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