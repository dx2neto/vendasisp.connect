// base44/functions/motorCredito/entry.ts
// Motor de decisão de crédito baseado em regras configuráveis.
// Aplica regras da entity RegraCredito sobre o resultado da consulta cadastral.
//
// Entrada: { pedido_id, credit_response, score, probabilidade, restricao }
// Saída: { decisao, regra_aplicada, motivo, score, classificacao }

import { secrets } from "base44:runtime";

const json = (obj: any, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({});

  let body: any = {};
  try { body = await req.json(); } catch { return json({ erro: "Payload inválido" }, 400); }

  const { pedido_id, credit_response, score, probabilidade, restricao } = body;

  if (score === undefined && !credit_response) {
    return json({ erro: "Score ou credit_response são obrigatórios" }, 400);
  }

  try {
    // Carrega regras ativas ordenadas por prioridade
    const base44 = (await import("npm:@base44/sdk")).createClientFromRequest(req);
    const regras = await base44.asServiceRole.entities.RegraCredito.filter({
      ativo: true,
    }, "prioridade", 50);

    if (!regras || regras.length === 0) {
      // Fallback: regras padrão do ConfigRegras
      const config = await base44.asServiceRole.entities.ConfigRegras.list();
      const cfg = config[0] || {};
      const scoreMin = cfg.score_minimo_credito || 400;
      const probMax = cfg.probabilidade_maxima || 30;

      const s = Number(score || 0);
      const p = Number(probabilidade || 0);
      const hasRestr = Boolean(restricao);

      let decisao = "aprovar";
      let motivo = `Score ${s} >= ${scoreMin}`;

      if (hasRestr && cfg.credit_block_on_restriction !== false) {
        decisao = "bloquear";
        motivo = "Restrição ativa encontrada";
      } else if (s < scoreMin) {
        decisao = "reprovado";
        motivo = `Score ${s} abaixo do mínimo ${scoreMin}`;
      } else if (p > probMax) {
        decisao = "analise_manual";
        motivo = `Probabilidade de inadimplência ${p}% acima do limite ${probMax}%`;
      }

      return json({
        decisao,
        regra_aplicada: "ConfigRegras padrão",
        motivo,
        score: s,
        classificacao: s >= 700 ? "promotor" : s >= 500 ? "neutro" : "detrator",
      });
    }

    // Aplica regras configuráveis
    const s = Number(score || 0);
    const p = Number(probabilidade || 0);
    const hasRestr = Boolean(restricao);

    for (const regra of regras) {
      // Verifica tipo de pessoa
      if (regra.tipo_pessoa && regra.tipo_pessoa !== "ambas") {
        // Assume PF se não especificado
        if (regra.tipo_pessoa === "J" && !credit_response?.cnpj) continue;
        if (regra.tipo_pessoa === "F" && credit_response?.cnpj) continue;
      }

      // Verifica score mínimo
      if (regra.score_minimo && s < regra.score_minimo) continue;

      // Verifica probabilidade máxima
      if (regra.probabilidade_maxima && p > regra.probabilidade_maxima) continue;

      // Verifica bloqueio por restrição
      if (regra.bloquear_se_restricao && hasRestr) {
        return json({
          decisao: "bloquear",
          regra_aplicada: regra.nome,
          motivo: "Restrição ativa encontrada",
          score: s,
          classificacao: s >= 700 ? "promotor" : s >= 500 ? "neutro" : "detrator",
        });
      }

      // Verifica condições adicionais
      let condicoesOk = true;
      if (Array.isArray(regra.condicoes)) {
        for (const cond of regra.condicoes) {
          const val = credit_response?.[cond.campo];
          if (val === undefined) { condicoesOk = false; break; }
          switch (cond.operador) {
            case "==": if (String(val) !== cond.valor) condicoesOk = false; break;
            case "!=": if (String(val) === cond.valor) condicoesOk = false; break;
            case ">": if (Number(val) <= Number(cond.valor)) condicoesOk = false; break;
            case "<": if (Number(val) >= Number(cond.valor)) condicoesOk = false; break;
            case ">=": if (Number(val) < Number(cond.valor)) condicoesOk = false; break;
            case "<=": if (Number(val) > Number(cond.valor)) condicoesOk = false; break;
            case "contains": if (!String(val).includes(cond.valor)) condicoesOk = false; break;
          }
          if (!condicoesOk) break;
        }
      }

      if (condicoesOk) {
        const acao = regra.acao || "analise_manual";
        return json({
          decisao: acao,
          regra_aplicada: regra.nome,
          motivo: `Regra "${regra.nome}": score ${s}, prob ${p}%`,
          score: s,
          classificacao: s >= 700 ? "promotor" : s >= 500 ? "neutro" : "detrator",
        });
      }
    }

    // Nenhuma regra matchou → análise manual
    return json({
      decisao: "analise_manual",
      regra_aplicada: "Nenhuma regra matchou",
      motivo: "Cliente não se enquadrou em nenhuma regra automática",
      score: s,
      classificacao: s >= 700 ? "promotor" : s >= 500 ? "neutro" : "detrator",
    });
  } catch (e: any) {
    console.error("Erro motor crédito:", e.message);
    return json({ erro: "Erro ao processar decisão de crédito" }, 500);
  }
});