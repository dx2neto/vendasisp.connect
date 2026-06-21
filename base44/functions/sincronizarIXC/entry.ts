import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const IXC_HOST = () => Deno.env.get('IXC_HOST') || '';
const IXC_AUTH = () => Deno.env.get('IXC_AUTH_BASIC') || '';

async function ixcRequest(endpoint, body = null) {
  const url = `${IXC_HOST()}/webservice/v1/${endpoint}`;
  const opts = {
    method: 'POST',
    headers: {
      Authorization: `Basic ${IXC_AUTH()}`,
      'Content-Type': 'application/json',
      ixcsoft: 'listar',
    },
    body: JSON.stringify(body || { qtype: 'id', query: '', oper: '>', page: '1', rp: '1000', sortname: 'id', sortorder: 'asc' }),
  };
  const resp = await fetch(url, opts);
  const data = await resp.json();
  return { ok: resp.ok, data };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!IXC_HOST() || !IXC_AUTH()) return Response.json({ error: 'IXC não configurado' }, { status: 500 });

    const { tipo } = await req.json();
    const resultados = {};

    // ── Filiais ─────────────────────────────────────────────────────────
    if (!tipo || tipo === 'filiais') {
      const r = await ixcRequest('filiais');
      resultados.filiais = r.ok ? (r.data?.registros || r.data || []) : [];
    }

    // ── Vendedores ───────────────────────────────────────────────────────
    if (!tipo || tipo === 'vendedores') {
      const r = await ixcRequest('vendedor');
      resultados.vendedores = r.ok ? (r.data?.registros || r.data || []) : [];
    }

    // ── Planos (radaccess) ───────────────────────────────────────────────
    if (!tipo || tipo === 'planos') {
      const r = await ixcRequest('radaccess');
      resultados.planos_ixc = r.ok ? (r.data?.registros || r.data || []) : [];
    }

    // ── Produtos (modelos de contrato) ───────────────────────────────────
    if (!tipo || tipo === 'produtos') {
      const r = await ixcRequest('produto');
      resultados.produtos_ixc = r.ok ? (r.data?.registros || r.data || []) : [];
    }

    // ── Assuntos OS ──────────────────────────────────────────────────────
    if (!tipo || tipo === 'assuntos') {
      const r = await ixcRequest('su_assunto_chamado');
      resultados.assuntos_os = r.ok ? (r.data?.registros || r.data || []) : [];
    }

    // ── Setores OS ───────────────────────────────────────────────────────
    if (!tipo || tipo === 'setores') {
      const r = await ixcRequest('setor');
      resultados.setores_os = r.ok ? (r.data?.registros || r.data || []) : [];
    }

    // ── Sincronizar planos do CRM com IDs do IXC (se solicitado) ─────────
    if (tipo === 'sync_planos' && resultados.planos_ixc) {
      const planosCRM = await base44.asServiceRole.entities.Plano.list();
      const updates = [];
      for (const p of planosCRM) {
        const match = resultados.planos_ixc.find(ix =>
          ix.login?.toLowerCase() === p.nome.toLowerCase() ||
          String(ix.id) === String(p.id_modelo_ixc)
        );
        if (match && !p.id_modelo_ixc) {
          await base44.asServiceRole.entities.Plano.update(p.id, { id_modelo_ixc: String(match.id) });
          updates.push({ plano: p.nome, id_modelo_ixc: match.id });
        }
      }
      resultados.planos_atualizados = updates;
    }

    // ── Sincronizar clientes IXC → Leads CRM ─────────────────────────────
    if (tipo === 'sync_leads') {
      const rClientes = await ixcRequest('cliente', {
        qtype: 'ativo', query: 'S', oper: '=', page: '1', rp: '200',
        sortname: 'id', sortorder: 'desc',
      });
      const raw = rClientes.data;
      const clientes = Array.isArray(raw) ? raw
        : Array.isArray(raw?.registros) ? raw.registros
        : Array.isArray(raw?.data) ? raw.data : [];

      console.log(`Encontrados ${clientes.length} clientes no IXC`);

      let importados = 0;
      let existentes = 0;

      for (const c of clientes.slice(0, 100)) { // Limita a 100 por vez
        if (!c.id) continue;
        // Verifica se já existe lead com esse id_cliente_ixc
        const jaExiste = await base44.asServiceRole.entities.Lead.filter({ id_cliente_ixc: String(c.id) });
        if (jaExiste.length > 0) { existentes++; continue; }

        const lead = {
          nome: c.razao || c.nome_fantasia || c.nome || `Cliente IXC #${c.id}`,
          cnpj_cpf: c.cnpj_cpf || c.cpf || '',
          tipo_pessoa: c.tipo_pessoa || 'F',
          rg: c.rg || '',
          telefone: c.fone_celular || c.fone || '',
          email: c.email || '',
          cep: c.cep || '',
          rua: c.endereco || '',
          numero: c.numero || '',
          complemento: c.complemento || '',
          bairro: c.bairro || '',
          cidade_nome: c.cidade || '',
          uf: c.uf || '',
          canal_origem: 'site',
          etapa_funil: 'ativado',
          id_cliente_ixc: String(c.id),
          observacao: `Importado do IXC em ${new Date().toLocaleDateString('pt-BR')}`,
        };
        await base44.asServiceRole.entities.Lead.create(lead);
        importados++;
      }

      resultados.leads_importados = importados;
      resultados.leads_existentes = existentes;
      resultados.total_ixc = clientes.length;
    }

    // ── Sincronizar modelos de contrato do IXC → TemplateContrato ─────────
    if (tipo === 'sync_modelos') {
      // Busca modelos de contrato no IXC via endpoint correto
      const rModelos = await ixcRequest('cliente_contrato_modelo', {
        qtype: 'id', query: '', oper: '>', page: '1', rp: '500',
        sortname: 'id', sortorder: 'asc',
      });

      const rawModelos = rModelos.data;
      const modelosIXC = Array.isArray(rawModelos)
        ? rawModelos
        : Array.isArray(rawModelos?.registros) ? rawModelos.registros
        : Array.isArray(rawModelos?.data) ? rawModelos.data
        : [];

      console.log(`Encontrados ${modelosIXC.length} modelos de contrato no IXC`);
      resultados.endpoint_utilizado = 'cliente_contrato_modelo';
      resultados.modelos_ixc_encontrados = modelosIXC.length;

      const templatesCRM = await base44.asServiceRole.entities.TemplateContrato.list();
      const criados = [];
      const atualizados = [];

      for (const modelo of modelosIXC) {
        if (!modelo.id || !modelo.nome) continue;

        // Converte o conteúdo HTML/texto do IXC para variáveis padrão CRM
        // O IXC usa {campo} — convertemos para {{campo}}
        const conteudoRaw = modelo.conteudo || modelo.texto || modelo.descricao || `Contrato: ${modelo.nome}`;

        // Remove tags HTML e normaliza
        const conteudoTexto = conteudoRaw
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/p>/gi, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .trim();

        // Converte variáveis: {campo} → {{campo}}
        const conteudo = conteudoTexto
          .replace(/\{([a-zA-Z_0-9]+)\}/g, '{{$1}}')
          .replace(/\[([a-zA-Z_\s]+)\]/g, (m, v) => `{{${v.trim().toLowerCase().replace(/\s+/g, '_')}}}`)
          .slice(0, 8000); // Limita a 8KB — conteúdos maiores devem ser editados no CRM após importação

        // Extrai variáveis
        const variaveis = [...new Set(
          (conteudo.match(/\{\{(\w+)\}\}/g) || []).map(v => v.replace(/\{\{|\}\}/g, ''))
        )];

        // Verifica se já existe template vinculado a este modelo IXC
        const existente = templatesCRM.find(t => String(t.id_modelo_ixc) === String(modelo.id));

        if (existente) {
          // Atualiza conteúdo se existir
          await base44.asServiceRole.entities.TemplateContrato.update(existente.id, {
            conteudo,
            variaveis_obrigatorias: variaveis,
            id_modelo_ixc: String(modelo.id),
          });
          atualizados.push({ nome: existente.nome, id_ixc: modelo.id });
        } else {
          // Cria novo template importado do IXC
          await base44.asServiceRole.entities.TemplateContrato.create({
            nome: modelo.nome,
            descricao: `Importado do IXC — ID #${modelo.id}`,
            conteudo,
            variaveis_obrigatorias: variaveis,
            ativo: true,
            id_modelo_ixc: String(modelo.id),
          });
          criados.push({ nome: modelo.nome, id_ixc: modelo.id });
        }
      }

      resultados.modelos_criados = criados;
      resultados.modelos_atualizados = atualizados;
    }

    return Response.json({ success: true, ...resultados });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});