// base44/functions/motorCredito/entry.ts
// Motor de decisão de crédito baseado em regras configuráveis (RegraCredito).
// Aplica regras ativas ordenadas por prioridade sobre o resultado da consulta cadastral.
//
// Entrada: { pedido_id, credit_response, score, probabilidade, restricao, tipo_pessoa }
// Saída: {
//   decisao: "aprovar" | "alertar" | "analise_manual" | "bloquear",
//   regra_aplicada: string,
//   motivo: string,
//   score: number,
//   classificacao: "promotor" | "neutro" | "detrator",
//   detalhes: { score, probabilidade, tem_restricao, restricoes }
// }

import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const json = (obj: any, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });

// Pega valor aninhado por caminho dot: "Score.Valor" → data.Score.Valor
function getPath(obj: any, path: string): any {
  if (!path) return undefined;
  return String(path).split(".").reduce((acc: any, key: string) => (acc == null ? acc : acc[key]), obj);
}

// Verifica se há restrição/negativo ativo nos blocos típicos do produto 630 (Serasa/Valido)
function extrairRestricoes(data: any): any[] {
  const blocos = [
    "Restricoes", "restricoes", "Pendencias", "pendencias",
    "Protestos", "protestos", "Negativacoes", "negativacoes",
    "AcoesJudiciais", "acoesJudiciais", "DividaPublica", "dividaPublica",
    "ChequesSemFundo", "chequesSemFundo",
  ];
  const todas: any[] = [];
  for (const b of blocos) {
    const bloco = data?.[b];
    if (!bloco) continue;
    if (Array.isArray(bloco)) {
      todas.push(...bloco.map((item: any) => ({ tipo: b, ...item })));
    } else if (typeof bloco === "object") {
      const qtd = bloco.Total ?? bloco.Quantidade ?? bloco.QtdTotal ?? bloco.total;
      if (qtd != null && Number(qtd) > 0) {
        todas.push({ tipo: b, quantidade: Number(qtd) });
      }
    }
  }
  return todas;
}

function classificarScore(score: number): string {
  if (score >= 700) return "promotor";
  if (score >= 500) return "neutro";
  return "detrator";
}

function avaliarCondicao(val: any, operador: string, esperado: string): boolean {
  if (val === undefined || val === null) return false;
  switch (operador) {
    case "==": return String(val) === esperado;
    case "!=": return String(val) !== esperado;
    case ">": return Number(val) > Number(esperado);
    case "<": return Number(val) < Number(esperado);
    case ">=": return Number(val) >= Number(esperado);
    case "<=": return Number(val) <= Number(esperado);
    case "contains": return String(val).toLowerCase().includes(esperado.toLowerCase());
    default: return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({});

  let body: any = {};
  try { body = await req.json(); } catch { return json({ erro: "Payload inválido" }, 400); }

  const {
    pedido_id,
    credit_response,
    score: scoreInput,
    probabilidade: probInput,
    restricao: restrInput,
    tipo_pessoa,
  } = body;

  if (scoreInput === undefined && !credit_response) {
    return json({ erro: "Score ou credit_response são obrigatórios" }, 400);
  }

  try {
    const base44 = createClientFromRequest(req);

    // Extrai dados da resposta da API
    const data = credit_response?.Retorno || credit_response?.retorno || credit_response?.Data || credit_response?.data || credit_response || {};
    const score = Number(scoreInput ?? getPath(data, "score.pontuacao") ?? getPath(data, "pontuacao") ?? getPath(data, "Score.Valor") ?? 0);
    const probabilidade = Number(probInput ?? getPath(data, "probabilidadeInadimplencia") ?? getPath(data, "score.probabilidadeInadimplencia") ?? 0);
    const restricoes = extrairRestricoes(data);
    const temRestricao = restrInput !== undefined ? Boolean(restrInput) : restricoes.length > 0;
    const tipoPessoa = tipo_pessoa || (credit_response?.cnpj ? "J" : "F");

    const detalhes = {
      score,
      probabilidade,
      tem_restricao: temRestricao,
      qtd_restricoes: restricoes.length,
      restricoes: restricoes.slice(0, 10),
      tipo_pessoa: tipoPessoa,
    };

    // Carrega regras ativas ordenadas por prioridade
    const regras = await base44.asServiceRole.entities.RegraCredito.filter(
      { ativo: true },
      "prioridade",
      50,
    );

    // Se não há regras configuradas, usa fallback do ConfigRegras
    if (!regras || regras.length === 0) {
      const config = await base44.asServiceRole.entities.ConfigRegras.list();
      const cfg = config[0] || {};
      const scoreMin = cfg.score_minimo_credito ?? cfg.credit_approve_score ?? 400;
      const probMax = cfg.probabilidade_maxima ?? 30;
      const blockOnRestriction = cfg.credit_block_on_restriction ?? true;

      let decisao = "aprovar";
      let motivo = `Score ${score} >= ${scoreMin} e probabilidade ${probabilidade}% <= ${probMax}%`;

      if (blockOnRestriction && temRestricao) {
        decisao = "bloquear";
        motivo = `Restrição ativa encontrada (${restricoes.length} ocorrência(s))`;
      } else if (score < scoreMin) {
        decisao = "bloquear";
        motivo = `Score ${score} abaixo do mínimo ${scoreMin}`;
      } else if (probabilidade > probMax) {
        decisao = "analise_manual";
        motivo = `Probabilidade de inadimplência ${probabilidade}% acima do limite ${probMax}%`;
      }

      return json({
        decisao,
        regra_aplicada: "ConfigRegras padrão (fallback)",
        motivo,
        score,
        classificacao: classificarScore(score),
        detalhes,
      });
    }

    // Aplica regras configuráveis por prioridade (menor = maior prioridade)
    for (const regra of regras) {
      // Filtro por tipo de pessoa
      if (regra.tipo_pessoa && regra.tipo_pessoa !== "ambas") {
        if (regra.tipo_pessoa !== tipoPessoa) continue;
      }

      // Filtro por score mínimo (se a regra define um, o score deve ser >=)
      if (regra.score_minimo != null && score < regra.score_minimo) continue;

      // Filtro por probabilidade máxima (se a regra define uma, a prob deve ser <=)
      if (regra.probabilidade_maxima != null && probabilidade > regra.probabilidade_maxima) continue;

      // Verifica bloqueio por restrição
      if (regra.bloquear_se_restricao && temRestricao) {
        return json({
          decisao: "bloquear",
          regra_aplicada: regra.nome,
          motivo: `Regra "${regra.nome}": restrição ativa encontrada (${restricoes.length} ocorrência(s))`,
          score,
          classificacao: classificarScore(score),
          detalhes,
        });
      }

      // Avalia condições adicionais (campo → operador → valor)
      let condicoesOk = true;
      if (Array.isArray(regra.condicoes) && regra.condicoes.length > 0) {
        for (const cond of regra.condicoes) {
          if (!cond.campo) continue;
          const val = getPath(data, cond.campo);
          if (!avaliarCondicao(val, cond.operador, cond.valor)) {
            condicoesOk = false;
            break;
          }
        }
      }

      // Se todas as condições passaram (ou não há condições), aplica a regra
      if (condicoesOk) {
        const acao = regra.acao || "analise_manual";
        const motivo = `Regra "${regra.nome}": score ${score}, prob ${probabilidade}%, restrições ${restricoes.length}`;

        // Persiste a decisão no pedido se pedido_id foi fornecido
        if (pedido_id) {
          try {
            const creditStatus = acao === "aprovar" ? "aprovado"
              : acao === "bloquear" ? "reprovado"
              : null;
            const novoStatus = acao === "aprovar" ? "viabilidade"
              : acao === "bloquear" ? "recusado"
              : "analise_credito";

            await base44.asServiceRole.entities.Pedido.update(pedido_id, {
              status: novoStatus,
              credit_status: creditStatus,
              credit_score: score,
              credit_checked_at: new Date().toISOString(),
            });

            await base44.asServiceRole.entities.AnaliseCredito.create({
              pedido_id,
              lead_nome: body.lead_nome || "",
              cpf_cnpj: body.cpf_cnpj || "",
              score,
              probabilidade_inadimplencia: probabilidade,
              texto_risco: temRestricao ? "Restrição ativa" : "Sem restrições",
              resultado: acao === "aprovar" ? "aprovado"
                : acao === "bloquear" ? "reprovado"
                : "manual",
              observacao: motivo,
            });
          } catch (e) {
            console.error("Erro ao persistir decisão:", e);
          }
        }

        return json({
          decisao: acao,
          regra_aplicada: regra.nome,
          motivo,
          score,
          classificacao: classificarScore(score),
          detalhes,
        });
      }
    }

    // Nenhuma regra matchou → análise manual
    const motivoManual = `Cliente não se enquadrou em nenhuma regra automática (score ${score}, prob ${probabilidade}%, ${restricoes.length} restrições)`;

    if (pedido_id) {
      try {
        await base44.asServiceRole.entities.Pedido.update(pedido_id, {
          status: "analise_credito",
          credit_score: score,
          credit_checked_at: new Date().toISOString(),
        });
      } catch (e) {
        console.error("Erro ao persistir decisão manual:", e);
      }
    }

    return json({
      decisao: "analise_manual",
      regra_aplicada: "Nenhuma regra matchou",
      motivo: motivoManual,
      score,
      classificacao: classificarScore(score),
      detalhes,
    });
  } catch (e: any) {
    console.error("Erro motor crédito:", e.message);
    return json({ erro: "Erro ao processar decisão de crédito", detalhe: e.message }, 500);
  }
});