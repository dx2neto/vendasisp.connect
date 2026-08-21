import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, DollarSign, Users, Award, ArrowRight, ChevronDown, ChevronRight, User, Building2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const fmt = (v) => `R$ ${(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const NIVEIS = [
  { tipo: "revendedor", label: "Revendedor", cor: "amber", bg: "bg-amber-50 border-amber-200", text: "text-amber-700", iconBg: "bg-amber-500", icon: User },
  { tipo: "vendedor",   label: "Vendedor",   cor: "blue",   bg: "bg-blue-50 border-blue-200",   text: "text-blue-700",   iconBg: "bg-blue-500",   icon: Users },
  { tipo: "gerente",    label: "Gerente",    cor: "purple", bg: "bg-purple-50 border-purple-200", text: "text-purple-700", iconBg: "bg-purple-500", icon: Building2 },
];

export default function HierarquiaComissoes({ pedidos = [], comissoes = [], revendedorNome, receitaGerada, configRegras = {} }) {
  const [expandedSale, setExpandedSale] = useState(null);

  const percRevendedor = configRegras.comissao_revendedor_percentual ?? 8;
  const percVendedor = configRegras.comissao_percentual_padrao ?? 5;
  const percGerente = configRegras.comissao_gerente_percentual ?? 3;

  // Pedidos ativados — base do cálculo de comissão
  const pedidosAtivados = useMemo(
    () => pedidos.filter(p => p.status === "ativado"),
    [pedidos]
  );

  // Para cada pedido ativado, calcula a comissão de cada nível
  const vendasComComissao = useMemo(() => {
    return pedidosAtivados.map(p => {
      const valor = p.valor || 0;
      const calc = {
        revendedor: valor * (percRevendedor / 100),
        vendedor:   valor * (percVendedor / 100),
        gerente:    valor * (percGerente / 100),
      };
      // Comissões já registradas para este pedido
      const comissaoPedido = comissoes.filter(c => c.pedido_id === p.id);
      return {
        pedido: p,
        valor,
        calculado: calc,
        totalComissao: calc.revendedor + calc.vendedor + calc.gerente,
        registrado: comissaoPedido,
        pago: comissaoPedido.filter(c => c.status === "pago").reduce((s, c) => s + (c.valor || 0), 0),
        pendente: comissaoPedido.filter(c => c.status === "a_receber").reduce((s, c) => s + (c.valor || 0), 0),
      };
    });
  }, [pedidosAtivados, comissoes, percRevendedor, percVendedor, percGerente]);

  // Totais por nível (calculado)
  const totaisPorNivel = useMemo(() => {
    const totais = { revendedor: 0, vendedor: 0, gerente: 0 };
    vendasComComissao.forEach(v => {
      totais.revendedor += v.calculado.revendedor;
      totais.vendedor += v.calculado.vendedor;
      totais.gerente += v.calculado.gerente;
    });
    return totais;
  }, [vendasComComissao]);

  // Vendedores únicos vinculados (das comissões registradas)
  const vendedoresVinculados = useMemo(() => {
    const map = {};
    comissoes.forEach(c => {
      if (c.tipo !== "vendedor") return;
      if (!map[c.vendedor_nome]) map[c.vendedor_nome] = { nome: c.vendedor_nome, comissao: 0, vendas: 0, pago: 0 };
      map[c.vendedor_nome].comissao += c.valor || 0;
      map[c.vendedor_nome].vendas++;
      if (c.status === "pago") map[c.vendedor_nome].pago += c.valor || 0;
    });
    return Object.values(map);
  }, [comissoes]);

  const totalCalculado = totaisPorNivel.revendedor + totaisPorNivel.vendedor + totaisPorNivel.gerente;
  const totalReceita = vendasComComissao.reduce((s, v) => s + v.valor, 0);

  return (
    <div className="space-y-5">
      {/* Hierarquia visual em árvore */}
      <Card className="rounded-2xl border border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Estrutura Hierárquica de Comissionamento</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Árvore de níveis com percentuais */}
          <div className="flex flex-col items-center gap-3">
            {/* Nível Gerente (topo) */}
            <div className={cn("flex items-center gap-3 rounded-xl border px-5 py-3 w-full max-w-md", "bg-purple-50 border-purple-200")}>
              <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0", "bg-purple-500")}>
                <Building2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className={cn("font-bold", "text-purple-700")}>Gerente</p>
                <p className="text-xs text-muted-foreground">Override sobre todas as vendas do time</p>
              </div>
              <div className="text-right">
                <p className={cn("text-lg font-bold", "text-purple-700")}>{percGerente}%</p>
                <p className="text-xs text-muted-foreground">{fmt(totaisPorNivel.gerente)}</p>
              </div>
            </div>

            {/* Conector */}
            <div className="w-px h-6 bg-border" />

            {/* Nível Vendedor (meio) */}
            <div className={cn("flex items-center gap-3 rounded-xl border px-5 py-3 w-full max-w-md", "bg-blue-50 border-blue-200")}>
              <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0", "bg-blue-500")}>
                <Users className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className={cn("font-bold", "text-blue-700")}>Vendedor</p>
                <p className="text-xs text-muted-foreground">Responsável pela ativação da venda</p>
              </div>
              <div className="text-right">
                <p className={cn("text-lg font-bold", "text-blue-700")}>{percVendedor}%</p>
                <p className="text-xs text-muted-foreground">{fmt(totaisPorNivel.vendedor)}</p>
              </div>
            </div>

            {/* Conector */}
            <div className="w-px h-6 bg-border" />

            {/* Nível Revendedor (base) */}
            <div className={cn("flex items-center gap-3 rounded-xl border px-5 py-3 w-full max-w-md", "bg-amber-50 border-amber-200")}>
              <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0", "bg-amber-500")}>
                <User className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className={cn("font-bold", "text-amber-700")}>Revendedor (Você)</p>
                <p className="text-xs text-muted-foreground">Comissão por cada venda ativada</p>
              </div>
              <div className="text-right">
                <p className={cn("text-lg font-bold", "text-amber-700")}>{percRevendedor}%</p>
                <p className="text-xs text-muted-foreground">{fmt(totaisPorNivel.revendedor)}</p>
              </div>
            </div>
          </div>

          {/* Resumo total */}
          <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-muted/30 px-5 py-3">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-medium">Total de comissões calculadas (todos os níveis)</span>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-primary">{fmt(totalCalculado)}</p>
              <p className="text-xs text-muted-foreground">sobre {fmt(totalReceita)} em receita</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumo por nível */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {NIVEIS.map(n => {
          const valor = totaisPorNivel[n.tipo] || 0;
          const pct = n.tipo === "revendedor" ? percRevendedor : n.tipo === "vendedor" ? percVendedor : percGerente;
          return (
            <Card key={n.tipo} className={cn("rounded-2xl border", n.bg)}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", n.iconBg)}>
                    <n.icon className="w-4 h-4 text-white" />
                  </div>
                  <Badge variant="outline" className={cn("text-xs", n.bg, n.text)}>{pct}%</Badge>
                </div>
                <p className={cn("text-2xl font-bold", n.text)}>{fmt(valor)}</p>
                <p className={cn("text-xs mt-0.5", n.text)}>{n.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Detalhamento por venda */}
      <Card className="rounded-2xl border border-border overflow-hidden">
        <CardHeader className="border-b border-border/60 py-3 px-5">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            <span>Detalhamento por Venda Ativada ({vendasComComissao.length})</span>
            <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">
              {fmt(totalCalculado)} total
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {vendasComComissao.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p>Nenhuma venda ativada ainda. Lance vendas para ver o comissionamento.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {vendasComComissao.map((v) => {
                const isOpen = expandedSale === v.pedido.id;
                return (
                  <div key={v.pedido.id}>
                    <button
                      onClick={() => setExpandedSale(isOpen ? null : v.pedido.id)}
                      className="flex items-center justify-between w-full px-5 py-3.5 hover:bg-muted/20 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{v.pedido.lead_nome}</p>
                          <p className="text-xs text-muted-foreground">
                            {v.pedido.plano_nome || "—"} • {v.pedido.created_date ? format(new Date(v.pedido.created_date), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right">
                          <p className="text-sm font-bold text-primary">{fmt(v.totalComissao)}</p>
                          <p className="text-xs text-muted-foreground">sobre {fmt(v.valor)}</p>
                        </div>
                      </div>
                    </button>

                    {/* Detalhe expandido — breakdown por nível */}
                    {isOpen && (
                      <div className="px-5 pb-4 pt-1 bg-muted/10">
                        <div className="grid grid-cols-3 gap-3">
                          {NIVEIS.map(n => {
                            const valor = v.calculado[n.tipo];
                            const pct = n.tipo === "revendedor" ? percRevendedor : n.tipo === "vendedor" ? percVendedor : percGerente;
                            const registrado = v.registrado.filter(c => c.tipo === n.tipo);
                            return (
                              <div key={n.tipo} className={cn("rounded-xl border p-3", n.bg)}>
                                <div className="flex items-center gap-1.5 mb-1">
                                  <n.icon className={cn("w-3 h-3", n.text)} />
                                  <span className={cn("text-xs font-medium", n.text)}>{n.label}</span>
                                  <Badge variant="outline" className={cn("text-[10px] ml-auto", n.bg, n.text)}>{pct}%</Badge>
                                </div>
                                <p className={cn("text-lg font-bold", n.text)}>{fmt(valor)}</p>
                                {registrado.length > 0 && (
                                  <p className="text-[10px] text-muted-foreground mt-1">
                                    {registrado[0].vendedor_nome || "—"} • {registrado[0].status === "pago" ? "Pago" : "Pendente"}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Status de pagamento */}
                        {v.registrado.length > 0 && (
                          <div className="flex items-center gap-4 mt-3 text-xs">
                            <span className="text-amber-600 font-medium">Pendente: {fmt(v.pendente)}</span>
                            <span className="text-emerald-600 font-medium">Pago: {fmt(v.pago)}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Vendedores vinculados */}
      {vendedoresVinculados.length > 0 && (
        <Card className="rounded-2xl border border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" />
              Vendedores Vinculados ({vendedoresVinculados.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/50">
              {vendedoresVinculados.map((v, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">
                      {v.nome?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{v.nome}</p>
                      <p className="text-xs text-muted-foreground">{v.vendas} venda(s) • Pago: {fmt(v.pago)}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 text-xs">
                    {fmt(v.comissao)}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}