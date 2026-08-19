// base44/functions/ixcSync/entry.ts
// Sincronização bidirecional IXC ↔ CRM.
// Cobertura: Clientes, Contratos, Planos, Produtos, Financeiro, Boletos, PIX,
// Faturas, Ordens de Serviço, Técnicos, Atendimentos, Status, Suspensão,
// Liberação, Consumo.
//
// Uso (SDK frontend):
//   base44.functions.invoke("ixcSync", { acao: "importar_clientes" })
//   base44.functions.invoke("ixcSync", { acao: "exportar_pedido", pedido_id: "..." })
//   base44.functions.invoke("ixcSync", { acao: "faturas", id_cliente: "..." })
//   base44.functions.invoke("ixcSync", { acao: "suspender", id_contrato: "..." })

import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import {
  ixcConfigOk,
  ixcListAll,
  ixcList,
  ixcGet,
  ixcInsert,
  ixcUpdate,
  ixcAction,
  ixcListarFaturas,
  ixcGerarBoleto,
  ixcGerarPix,
  ixcGerarBoletoPix,
  ixcBaixarFatura,
  ixcCancelarFatura,
  ixcListarOS,
  ixcCriarOS,
  ixcAtualizarOS,
  ixcAtribuirTecnico,
  ixcListarTecnicos,
  ixcSuspenderContrato,
  ixcLiberarContrato,
  ixcBloquearCliente,
  ixcDesbloquearCliente,
  ixcListarLogins,
  ixcConsumoLogin,
  ixcAlterarSenhaLogin,
  ixcDesconectarLogin,
  ixcListarPlanos,
  ixcListarProdutos,
  ixcListarFiliais,
  ixcListarVendedores,
  ixcListarAssuntosOS,
  ixcListarSetoresOS,
  ixcListarModelosContrato,
  ixcListarAtendimentos,
  ixcBuscarCliente,
  ixcCriarCliente,
  ixcCriarContrato,
  ixcBuscarCidade,
  onlyDigits,
} from "../../shared/ixcClient.ts";

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Não autorizado" }, { status: 401 });

    let body: any = {};
    try { body = await req.json(); } catch { /* sem body */ }
    const { acao } = body;

    if (!ixcConfigOk()) {
      return Response.json({ error: "IXC não configurado. Verifique IXC_API_URL e IXC_ADMIN_TOKEN." }, { status: 503 });
    }

    const opts = { pedidoId: body.pedido_id || "", base44 };

    switch (acao) {
      // ===================== IMPORTAÇÃO (IXC → CRM) =====================

      case "importar_clientes": {
        const r = await ixcListAll("cliente", {
          qtype: "cliente.ativo", query: "S", oper: "=", rp: 200,
          sortname: "cliente.id", sortorder: "desc",
        }, opts);
        const existentes = await base44.asServiceRole.entities.Lead.list("-created_date", 5000);
        const docsExistentes = new Set(existentes.map((l: any) => onlyDigits(l.cnpj_cpf)).filter(Boolean));

        let importados = 0, jaExistem = 0;
        for (const c of r.registros) {
          const doc = onlyDigits(c.cnpj_cpf);
          if (doc && docsExistentes.has(doc)) { jaExistem++; continue; }
          await base44.asServiceRole.entities.Lead.create({
            nome: c.razao || c.fantasia || "Cliente IXC",
            cnpj_cpf: c.cnpj_cpf || "",
            tipo_pessoa: c.tipo_pessoa || "F",
            telefone: c.telefone_celular || c.fone || "",
            email: c.email || "",
            cep: c.cep || "",
            rua: c.endereco || "",
            numero: c.numero || "",
            bairro: c.bairro || "",
            cidade_nome: c.cidade || "",
            id_cidade_ixc: c.id_cidade || "",
            uf: c.uf || "",
            canal_origem: "site",
            etapa_funil: "ativado",
            id_cliente_ixc: c.id,
            observacao: `Importado do IXC (cliente #${c.id})`,
          });
          importados++;
          if (doc) docsExistentes.add(doc);
        }
        return Response.json({ importados, ja_existem: jaExistem, total_ixc: r.total });
      }

      case "importar_modelos": {
        const modelos = await ixcListarModelosContrato(opts);
        const existentes = await base44.asServiceRole.entities.TemplateContrato.list("-created_date", 500);
        const porIxc = new Map(existentes.filter((t: any) => t.id_modelo_ixc).map((t: any) => [String(t.id_modelo_ixc), t]));

        const criados: any[] = [], atualizados: any[] = [];
        for (const m of modelos) {
          const nome = m.titulo || m.descricao || m.nome || `Modelo IXC #${m.id}`;
          const conteudo = m.contrato || m.modelo || m.texto || m.conteudo || m.html || "";
          const tipo_modelo = m.tipo || m.tipo_modelo || "";
          const existente = porIxc.get(String(m.id));
          if (existente) {
            await base44.asServiceRole.entities.TemplateContrato.update(existente.id, { nome, conteudo, tipo_modelo });
            atualizados.push({ nome, id_ixc: m.id });
          } else {
            await base44.asServiceRole.entities.TemplateContrato.create({
              nome, conteudo, tipo_modelo, ativo: true, id_modelo_ixc: m.id,
              descricao: `Importado do IXC (modelo #${m.id})`,
            });
            criados.push({ nome, id_ixc: m.id });
          }
        }
        return Response.json({ criados, atualizados, total_encontrados: modelos.length });
      }

      case "importar_planos": {
        const [planosIxc, produtosIxc] = await Promise.all([
          ixcListarPlanos(opts),
          ixcListarProdutos(opts),
        ]);
        const existentes = await base44.asServiceRole.entities.Plano.list("-created_date", 500);
        const porIxc = new Map(existentes.filter((p: any) => p.id_produto_ixc).map((p: any) => [String(p.id_produto_ixc), p]));

        const sincronizados: any[] = [];
        for (const p of produtosIxc) {
          const nome = p.descricao || p.produto || p.nome || "—";
          const existente = porIxc.get(String(p.id));
          const dados: any = {
            nome,
            id_produto_ixc: String(p.id),
            descricao: p.descricao || "",
            ativo: true,
          };
          if (existente) {
            await base44.asServiceRole.entities.Plano.update(existente.id, dados);
          } else {
            await base44.asServiceRole.entities.Plano.create({
              ...dados,
              velocidade_mbps: 0,
              preco_mensal: Number(p.valor_venda || p.preco || 0),
            });
          }
          sincronizados.push({ id_ixc: p.id, nome });
        }
        return Response.json({ sincronizados, total_planos_ixc: planosIxc.length, total_produtos: produtosIxc.length });
      }

      // ===================== EXPORTAÇÃO (CRM → IXC) =====================

      case "exportar_pedido": {
        const pedidoId = body.pedido_id;
        if (!pedidoId) return Response.json({ error: "pedido_id obrigatório" }, { status: 400 });

        const pedidos = await base44.asServiceRole.entities.Pedido.filter({ id: pedidoId });
        const pedido = pedidos[0];
        if (!pedido) return Response.json({ error: "Pedido não encontrado" }, { status: 404 });

        if (pedido.sincronizado_ixc && !body.forcar) {
          return Response.json({
            ja_sincronizado: true,
            id_cliente_ixc: pedido.id_cliente_ixc,
            id_contrato_ixc: pedido.id_contrato_ixc,
            id_os_ixc: pedido.id_os_ixc,
          });
        }

        const lead = pedido.lead_id
          ? (await base44.asServiceRole.entities.Lead.filter({ id: pedido.lead_id }))[0]
          : null;
        const cfg = (await base44.asServiceRole.entities.ConfigRegras.list())[0] || {};
        const plano = pedido.plano_id
          ? (await base44.asServiceRole.entities.Plano.filter({ id: pedido.plano_id }))[0]
          : null;

        const doc = onlyDigits(pedido.lead_cpf || lead?.cnpj_cpf);
        const nome = pedido.lead_nome || lead?.nome || "Cliente";

        // 1) Cliente
        let idCliente = pedido.id_cliente_ixc;
        if (!idCliente && doc) {
          const ex = await ixcBuscarCliente(doc, opts);
          idCliente = ex?.id || null;
        }
        if (!idCliente) {
          const idCidade = lead?.id_cidade_ixc || (await ixcBuscarCidade(lead?.cidade_nome, lead?.uf, opts));
          const novoCliente = await ixcCriarCliente({
            nome,
            cnpj_cpf: doc,
            tipo_pessoa: lead?.tipo_pessoa || (doc.length > 11 ? "J" : "F"),
            rg: lead?.rg || "ISENTO",
            contribuinte: cfg.contribuinte_pf || "2",
            telefone: lead?.telefone || pedido.customer_phone || "",
            email: lead?.email || pedido.customer_email || "",
            rua: lead?.rua || pedido.install_address?.endereco || "",
            numero: lead?.numero || pedido.install_address?.numero || "",
            complemento: lead?.complemento || pedido.install_address?.complemento || "",
            bairro: lead?.bairro || pedido.install_address?.bairro || "",
            cep: lead?.cep || pedido.install_address?.cep || "",
            id_cidade: idCidade || "",
            filial_id: cfg.id_filial_ixc || "1",
          }, opts);
          idCliente = novoCliente?.id || novoCliente?.registro?.id;
        }

        // 2) Contrato
        const novoContrato = await ixcCriarContrato({
          id_cliente: idCliente,
          id_modelo: plano?.id_modelo_ixc || "",
          id_tipo_contrato: cfg.id_tipo_contrato_ixc || "",
          id_vendedor: cfg.id_vendedor_ixc_padrao || "1",
          id_filial: cfg.id_filial_ixc || "1",
          id_carteira_cobranca: cfg.id_carteira_cobranca_ixc || "",
          nome_plano: plano?.nome || pedido.plano_nome || "Internet",
          status: cfg.status_contrato_inicial || "P",
          status_internet: cfg.status_internet_inicial || "A",
          dia_vencimento: pedido.due_day || cfg.dia_vencimento_padrao || "10",
          fidelidade: cfg.fidelidade_meses || "0",
          obs: `Pedido CRM ${pedido.id}`,
        }, opts);
        const idContrato = novoContrato?.id || novoContrato?.registro?.id;

        // 3) OS de instalação
        const novaOs = await ixcCriarOS({
          id_cliente: idCliente,
          id_assunto: cfg.id_assunto_os_ixc || "1",
          id_setor: cfg.id_setor_os_ixc || "1",
          id_filial: cfg.id_filial_ixc || "1",
          endereco: lead?.rua || pedido.install_address?.endereco || "",
          numero: lead?.numero || pedido.install_address?.numero || "",
          bairro: lead?.bairro || pedido.install_address?.bairro || "",
          mensagem: `Instalação ${plano?.nome || pedido.plano_nome || ""} — Pedido CRM ${pedido.id}`,
        }, opts);
        const idOs = novaOs?.id || novaOs?.registro?.id;

        // 4) Grava no Pedido
        await base44.asServiceRole.entities.Pedido.update(pedido.id, {
          sincronizado_ixc: true,
          id_cliente_ixc: idCliente,
          id_contrato_ixc: idContrato,
          id_os_ixc: idOs,
          status: "ativado",
          data_ativacao: new Date().toISOString(),
        });

        if (lead) {
          await base44.asServiceRole.entities.Lead.update(lead.id, { etapa_funil: "ativado", id_cliente_ixc: idCliente }).catch(() => {});
        }

        return Response.json({
          ok: true,
          id_cliente_ixc: idCliente,
          id_contrato_ixc: idContrato,
          id_os_ixc: idOs,
        });
      }

      // ===================== CONSULTAS =====================

      case "filiais":
        return Response.json({ filiais: await ixcListarFiliais(opts) });

      case "vendedores":
        return Response.json({ vendedores: await ixcListarVendedores(opts) });

      case "assuntos_os":
        return Response.json({ assuntos_os: await ixcListarAssuntosOS(opts) });

      case "setores_os":
        return Response.json({ setores_os: await ixcListarSetoresOS(opts) });

      case "planos":
        return Response.json({ planos: await ixcListarPlanos(opts) });

      case "produtos":
        return Response.json({ produtos: await ixcListarProdutos(opts) });

      case "modelos":
        return Response.json({ modelos: await ixcListarModelosContrato(opts) });

      case "tecnicos":
        return Response.json({ tecnicos: await ixcListarTecnicos(opts) });

      case "dossie": {
        const idCliente = body.id_cliente || body.id_cliente_ixc;
        if (!idCliente) return Response.json({ error: "id_cliente obrigatório" }, { status: 400 });
        const [faturas, osList, logins] = await Promise.all([
          ixcListarFaturas(idCliente, opts),
          ixcListarOS(idCliente, opts),
          ixcListarLogins(idCliente, opts),
        ]);
        return Response.json({ faturas, ordens_servico: osList, logins });
      }

      case "faturas": {
        const idCliente = body.id_cliente || body.id_cliente_ixc;
        if (!idCliente) return Response.json({ error: "id_cliente obrigatório" }, { status: 400 });
        return Response.json({ faturas: await ixcListarFaturas(idCliente, opts) });
      }

      case "boleto": {
        if (!body.id_fatura) return Response.json({ error: "id_fatura obrigatório" }, { status: 400 });
        return Response.json({ boleto: await ixcGerarBoleto(body.id_fatura, opts) });
      }

      case "pix": {
        if (!body.id_fatura) return Response.json({ error: "id_fatura obrigatório" }, { status: 400 });
        return Response.json({ pix: await ixcGerarPix(body.id_fatura, opts) });
      }

      case "boleto_pix": {
        if (!body.id_fatura) return Response.json({ error: "id_fatura obrigatório" }, { status: 400 });
        return Response.json({ resultado: await ixcGerarBoletoPix(body.id_fatura, opts) });
      }

      case "baixar_fatura": {
        if (!body.id_fatura) return Response.json({ error: "id_fatura obrigatório" }, { status: 400 });
        return Response.json({ resultado: await ixcBaixarFatura(body.id_fatura, body.valor || 0, opts) });
      }

      case "cancelar_fatura": {
        if (!body.id_fatura) return Response.json({ error: "id_fatura obrigatório" }, { status: 400 });
        return Response.json({ resultado: await ixcCancelarFatura(body.id_fatura, opts) });
      }

      case "os": {
        const idCliente = body.id_cliente || body.id_cliente_ixc;
        if (!idCliente) return Response.json({ error: "id_cliente obrigatório" }, { status: 400 });
        return Response.json({ ordens: await ixcListarOS(idCliente, opts) });
      }

      case "criar_os": {
        if (!body.id_cliente) return Response.json({ error: "id_cliente obrigatório" }, { status: 400 });
        const os = await ixcCriarOS(body, opts);
        return Response.json({ os });
      }

      case "atualizar_os": {
        if (!body.id_os || !body.dados) return Response.json({ error: "id_os e dados obrigatórios" }, { status: 400 });
        const r = await ixcAtualizarOS(body.id_os, body.dados, opts);
        return Response.json({ resultado: r });
      }

      case "atribuir_tecnico": {
        if (!body.id_os || !body.id_tecnico) return Response.json({ error: "id_os e id_tecnico obrigatórios" }, { status: 400 });
        const r = await ixcAtribuirTecnico(body.id_os, body.id_tecnico, opts);
        return Response.json({ resultado: r });
      }

      case "atendimentos": {
        const idCliente = body.id_cliente || body.id_cliente_ixc;
        if (!idCliente) return Response.json({ error: "id_cliente obrigatório" }, { status: 400 });
        return Response.json({ atendimentos: await ixcListarAtendimentos(idCliente, opts) });
      }

      // ===================== STATUS / SUSPENSÃO / LIBERAÇÃO =====================

      case "suspender": {
        if (!body.id_contrato) return Response.json({ error: "id_contrato obrigatório" }, { status: 400 });
        const r = await ixcSuspenderContrato(body.id_contrato, body.motivo || "Suspenso pelo CRM", opts);
        return Response.json({ resultado: r });
      }

      case "liberar": {
        if (!body.id_contrato) return Response.json({ error: "id_contrato obrigatório" }, { status: 400 });
        const r = await ixcLiberarContrato(body.id_contrato, opts);
        return Response.json({ resultado: r });
      }

      case "bloquear_cliente": {
        if (!body.id_cliente) return Response.json({ error: "id_cliente obrigatório" }, { status: 400 });
        const r = await ixcBloquearCliente(body.id_cliente, body.motivo || "Bloqueado pelo CRM", opts);
        return Response.json({ resultado: r });
      }

      case "desbloquear_cliente": {
        if (!body.id_cliente) return Response.json({ error: "id_cliente obrigatório" }, { status: 400 });
        const r = await ixcDesbloquearCliente(body.id_cliente, opts);
        return Response.json({ resultado: r });
      }

      // ===================== CONSUMO / LOGINS =====================

      case "logins": {
        const idCliente = body.id_cliente || body.id_cliente_ixc;
        if (!idCliente) return Response.json({ error: "id_cliente obrigatório" }, { status: 400 });
        return Response.json({ logins: await ixcListarLogins(idCliente, opts) });
      }

      case "consumo": {
        if (!body.id_login) return Response.json({ error: "id_login obrigatório" }, { status: 400 });
        const r = await ixcConsumoLogin(body.id_login, body.periodo || "current_month", opts);
        return Response.json({ consumo: r });
      }

      case "alterar_senha": {
        if (!body.id_login || !body.senha) return Response.json({ error: "id_login e senha obrigatórios" }, { status: 400 });
        const r = await ixcAlterarSenhaLogin(body.id_login, body.senha, opts);
        return Response.json({ resultado: r });
      }

      case "desconectar_login": {
        if (!body.id_login) return Response.json({ error: "id_login obrigatório" }, { status: 400 });
        const r = await ixcDesconectarLogin(body.id_login, opts);
        return Response.json({ resultado: r });
      }

      // ===================== SINCRONIZAÇÃO COMPLETA =====================

      case "sincronizar_tudo": {
        const [filiais, vendedores, assuntos_os, setores_os, planos, produtos, modelos] = await Promise.all([
          ixcListarFiliais(opts),
          ixcListarVendedores(opts),
          ixcListarAssuntosOS(opts),
          ixcListarSetoresOS(opts),
          ixcListarPlanos(opts),
          ixcListarProdutos(opts),
          ixcListarModelosContrato(opts),
        ]);
        return Response.json({
          filiais, vendedores, assuntos_os, setores_os, planos, produtos, modelos,
        });
      }

      default:
        return Response.json({ error: `Ação desconhecida: ${acao}` }, { status: 400 });
    }
  } catch (error) {
    return Response.json({ error: error.message || "Erro na sincronização IXC" }, { status: 500 });
  }
}