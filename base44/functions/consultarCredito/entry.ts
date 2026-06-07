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

    // Extrai dados do cliente para gerar lead
    const dadosCliente = data?.dados ?? {};
    const nome = dadosCliente?.nome ?? lead_nome ?? '';
    const telefone = dadosCliente?.telefone ?? dadosCliente?.celular ?? '';
    const email = dadosCliente?.email ?? '';
    const cep = dadosCliente?.cep ?? '';
    const rua = dadosCliente?.logradouro ?? '';
    const numero = dadosCliente?.numero ?? '';
    const complemento = dadosCliente?.complemento ?? '';
    const bairro = dadosCliente?.bairro ?? '';
    const cidade = dadosCliente?.municipio ?? '';
    const uf = dadosCliente?.uf ?? '';
    const tipoPessoa = cpf_cnpj.replace(/\D/g, '').length === 11 ? 'F' : 'J';

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
      lead_nome: nome || '',
      cpf_cnpj,
      score,
      classificacao_abc: classAbc,
      classificacao_nro: classNro,
      probabilidade_inadimplencia: probInad,
      texto_risco: textoRisco,
      chave_consulta: chaveConsulta,
      resultado,
    });

    // Cria/atualiza lead automaticamente com dados do cliente
    let leadCriado = null;
    if (nome) {
      try {
        // Verifica se já existe lead com esse CPF/CNPJ
        const leadsExistentes = await base44.asServiceRole.entities.Lead.filter({ cnpj_cpf: cpf_cnpj });
        
        if (leadsExistentes.length > 0) {
          // Atualiza lead existente
          leadCriado = await base44.asServiceRole.entities.Lead.update(leadsExistentes[0].id, {
            nome,
            telefone: telefone || leadsExistentes[0].telefone,
            email: email || leadsExistentes[0].email,
            cep: cep || leadsExistentes[0].cep,
            rua: rua || leadsExistentes[0].rua,
            numero: numero || leadsExistentes[0].numero,
            complemento: complemento || leadsExistentes[0].complemento,
            bairro: bairro || leadsExistentes[0].bairro,
            cidade_nome: cidade || leadsExistentes[0].cidade_nome,
            uf: uf || leadsExistentes[0].uf,
            tipo_pessoa: tipoPessoa,
            etapa_funil: 'analise_credito',
            data_entrada: leadsExistentes[0].data_entrada || new Date().toISOString(),
          });
        } else {
          // Cria novo lead
          leadCriado = await base44.asServiceRole.entities.Lead.create({
            nome,
            cnpj_cpf: cpf_cnpj,
            tipo_pessoa: tipoPessoa,
            telefone,
            email,
            cep,
            rua,
            numero,
            complemento,
            bairro,
            cidade_nome: cidade,
            uf,
            etapa_funil: 'analise_credito',
            data_entrada: new Date().toISOString(),
          });
        }
      } catch (leadError) {
        console.error('Erro ao criar/atualizar lead:', leadError);
      }
    }

    // Cria rascunho de pedido automaticamente se resultado for aprovado
    let pedidoCriado = null;
    if (resultado === 'aprovado' && leadCriado) {
      try {
        pedidoCriado = await base44.asServiceRole.entities.Pedido.create({
          lead_id: leadCriado.id,
          lead_nome: leadCriado.nome,
          lead_cpf: cpf_cnpj,
          status: 'novo',
          canal_origem: 'api_credito',
        });
      } catch (pedidoError) {
        console.error('Erro ao criar pedido:', pedidoError);
      }
    }

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

    // Notifica vendedor se pedido foi criado e crédito aprovado
    if (pedidoCriado && resultado === 'aprovado') {
      try {
        await base44.functions.invoke('notificarNovoPedido', { pedido_id: pedidoCriado.id });
      } catch (notifError) {
        console.error('Erro ao notificar vendedor:', notifError);
      }
    }

    return Response.json({ 
      analise, 
      resultado, 
      score, 
      probabilidade_inadimplencia: probInad,
      lead: leadCriado,
      pedido: pedidoCriado,
      cliente: { nome, telefone, email, cidade, uf }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});