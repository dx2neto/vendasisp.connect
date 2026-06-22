// functions/sincronizarIXC.js
// Busca/importa dados do IXC. Consumido por:
//   - SincronizarIXC.jsx        -> invoke("sincronizarIXC", {})            (tudo)
//   - SincronizacaoIXC.jsx      -> invoke("sincronizarIXC", {tipo:"..."})
//   - TemplatesContrato.jsx     -> invoke("sincronizarIXC", {tipo:"sync_modelos"})
//
// Formatos de resposta esperados pelo frontend:
//   filiais -> {filiais:[{id,razao}]}
//   vendedores -> {vendedores:[{id,nome}]}
//   assuntos -> {assuntos_os:[{id,descricao}]}
//   setores  -> {setores_os:[{id,setor}]}
//   planos   -> {planos_ixc:[{id,login|nome}], produtos_ixc:[{id,nome|descricao}]}
//   sync_leads   -> {leads_importados, leads_existentes}
//   sync_modelos -> {modelos_criados:[{nome,id_ixc}], modelos_atualizados:[...], modelos_ixc_encontrados}

import { createClientFromRequest } from "npm:@base44/sdk";
import { ixcList, onlyDigits } from "./ixcClient.js";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

// ---- coletores individuais (reutilizados na chamada "tudo") --------------
async function getFiliais() {
  const r = await ixcList("filial", { rp: 200 });
  return r.registros.map((f) => ({ id: f.id, razao: f.razao || f.fantasia || f.nome || "—" }));
}
async function getVendedores() {
  const r = await ixcList("vendedor", { rp: 500 });
  return r.registros.map((v) => ({ id: v.id, nome: v.vendedor || v.funcionario || v.nome || "—" }));
}
async function getAssuntos() {
  const r = await ixcList("su_oss_assunto", { rp: 500 });
  return r.registros.map((a) => ({ id: a.id, descricao: a.titulo || a.assunto || a.descricao || "—" }));
}
async function getSetores() {
  const r = await ixcList("su_oss_setor", { rp: 500 });
  return r.registros.map((s) => ({ id: s.id, setor: s.setor || s.nome || "—" }));
}
async function getPlanosERadius() {
  // "radaccess"/velocidade: radgrupo  |  produto vendável: vd_produto (varia por instância)
  let planos_ixc = [];
  let produtos_ixc = [];
  try {
    const rg = await ixcList("radgrupo", { rp: 500 });
    planos_ixc = rg.registros.map((p) => ({ id: p.id, login: p.nome || p.descricao || "—", nome: p.nome }));
  } catch (_) { /* tabela pode variar */ }
  try {
    const pr = await ixcList("vd_produto", { rp: 500 });
    produtos_ixc = pr.registros.map((p) => ({ id: p.id, nome: p.descricao || p.produto || p.nome || "—", descricao: p.descricao }));
  } catch (_) {
    try {
      const pr2 = await ixcList("produto", { rp: 500 });
      produtos_ixc = pr2.registros.map((p) => ({ id: p.id, nome: p.descricao || p.nome || "—" }));
    } catch (_) { /* ok */ }
  }
  return { planos_ixc, produtos_ixc };
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  let body = {};
  try { body = await req.json(); } catch { /* sem body = tudo */ }
  const tipo = body?.tipo || "tudo";

  try {
    switch (tipo) {
      case "filiais":   return json({ filiais: await getFiliais() });
      case "vendedores":return json({ vendedores: await getVendedores() });
      case "assuntos":  return json({ assuntos_os: await getAssuntos() });
      case "setores":   return json({ setores_os: await getSetores() });
      case "planos":    return json(await getPlanosERadius());

      case "tudo": {
        const [filiais, vendedores, assuntos_os, setores_os, pr] = await Promise.all([
          getFiliais(), getVendedores(), getAssuntos(), getSetores(), getPlanosERadius(),
        ]);
        return json({ filiais, vendedores, assuntos_os, setores_os, ...pr });
      }

      // ---- Importa clientes do IXC como Leads no CRM --------------------
      case "sync_leads": {
        const r = await ixcList("cliente", {
          qtype: "cliente.ativo", query: "S", oper: "=", rp: 500, sortname: "cliente.id", sortorder: "desc",
        });
        const existentes = await base44.asServiceRole.entities.Lead.list("-created_date", 5000);
        const docsExistentes = new Set(existentes.map((l) => onlyDigits(l.cnpj_cpf)).filter(Boolean));

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
            observacao: `Importado do IXC (cliente #${c.id})`,
          });
          importados++;
          if (doc) docsExistentes.add(doc);
        }
        return json({ leads_importados: importados, leads_existentes: jaExistem, total_ixc: r.total });
      }

      // ---- Importa modelos de contrato do IXC como Templates ------------
      case "sync_modelos": {
        const r = await ixcList("contrato_modelo", { rp: 200 });
        const encontrados = r.registros;
        const existentes = await base44.asServiceRole.entities.TemplateContrato.list("-created_date", 500);
        const porIxc = new Map(existentes.filter((t) => t.id_modelo_ixc).map((t) => [String(t.id_modelo_ixc), t]));

        const criados = [], atualizados = [];
        for (const m of encontrados) {
          const nome = m.titulo || m.descricao || m.nome || `Modelo IXC #${m.id}`;
          // o corpo do modelo no IXC costuma vir em "contrato"/"modelo"; mantém fallbacks
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
        return json({
          modelos_criados: criados,
          modelos_atualizados: atualizados,
          modelos_ixc_encontrados: encontrados.length,
        });
      }

      default:
        return json({ error: `tipo desconhecido: ${tipo}` }, 400);
    }
  } catch (e) {
    return json({ error: e.message || "Erro ao sincronizar com IXC" }, 500);
  }
});
