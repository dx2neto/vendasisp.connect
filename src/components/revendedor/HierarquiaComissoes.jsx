import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, DollarSign, Users, Award, ArrowRight } from "lucide-react";

const fmt = (v) => `R$ ${(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export default function HierarquiaComissoes({ pedidos = [], comissoes = [], revendedorNome, receitaGerada }) {
  const ativados = pedidos.filter(p => p.status === "ativado").length;
  const minhasComissoes = comissoes.filter(c =>
    (c.vendedor_nome === revendedorNome || c.tipo === "revendedor") && c.tipo === "revendedor"
  );
  const totalComissao = minhasComissoes.reduce((s, c) => s + (c.valor || 0), 0);
  const percMedio = ativados > 0 && receitaGerada > 0 ? ((totalComissao / receitaGerada) * 100).toFixed(1) : 0;

  // Calcula comissões dos vendedores vinculados (tipo vendedor nesses pedidos)
  const vendedoresMap = {};
  comissoes.forEach(c => {
    if (c.tipo !== "vendedor") return;
    const pedidoDoRevendedor = pedidos.find(p => p.id === c.pedido_id);
    if (!pedidoDoRevendedor) return;
    if (!vendedoresMap[c.vendedor_nome]) vendedoresMap[c.vendedor_nome] = { nome: c.vendedor_nome, comissao: 0, vendas: 0 };
    vendedoresMap[c.vendedor_nome].comissao += c.valor || 0;
    vendedoresMap[c.vendedor_nome].vendas++;
  });
  const vendedoresList = Object.values(vendedoresMap);

  // Calcula gerente (tipo gerente nesses pedidos)
  const gerentesMap = {};
  comissoes.forEach(c => {
    if (c.tipo !== "gerente") return;
    const pedidoDoRevendedor = pedidos.find(p => p.id === c.pedido_id);
    if (!pedidoDoRevendedor) return;
    if (!gerentesMap[c.vendedor_nome]) gerentesMap[c.vendedor_nome] = { nome: c.vendedor_nome, comissao: 0 };
    gerentesMap[c.vendedor_nome].comissao += c.valor || 0;
  });
  const gerentesList = Object.values(gerentesMap);

  return (
    <div className="space-y-5">
      {/* Explicação visual da hierarquia */}
      <Card className="rounded-2xl border border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Como funciona o comissionamento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-center gap-2 text-sm">
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex-1 text-center">
              <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">R</div>
              <div>
                <p className="font-bold text-amber-700">Revendedor</p>
                <p className="text-xs text-amber-600">Você — comissão por cada venda ativada</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex-1 text-center">
              <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">V</div>
              <div>
                <p className="font-bold text-blue-700">Vendedor</p>
                <p className="text-xs text-blue-600">Vendedor responsável pela ativação</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 flex-1 text-center">
              <div className="w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">G</div>
              <div>
                <p className="font-bold text-purple-700">Gerente</p>
                <p className="text-xs text-purple-600">Gerente do time — override de comissão</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Meu resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="rounded-2xl border border-amber-200 bg-amber-50">
          <CardContent className="p-5">
            <DollarSign className="w-6 h-6 text-amber-500 mb-2" />
            <p className="text-2xl font-bold text-amber-700">{fmt(totalComissao)}</p>
            <p className="text-xs text-amber-600 mt-0.5">Minhas comissões ({minhasComissoes.length})</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border border-emerald-200 bg-emerald-50">
          <CardContent className="p-5">
            <TrendingUp className="w-6 h-6 text-emerald-500 mb-2" />
            <p className="text-2xl font-bold text-emerald-700">{fmt(receitaGerada)}</p>
            <p className="text-xs text-emerald-600 mt-0.5">Receita gerada ({ativados} ativados)</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border border-blue-200 bg-blue-50">
          <CardContent className="p-5">
            <Award className="w-6 h-6 text-blue-500 mb-2" />
            <p className="text-2xl font-bold text-blue-700">{percMedio}%</p>
            <p className="text-xs text-blue-600 mt-0.5">% médio de comissão sobre receita</p>
          </CardContent>
        </Card>
      </div>

      {/* Vendedores vinculados */}
      {vendedoresList.length > 0 && (
        <Card className="rounded-2xl border border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" />
              Vendedores que trabalharam nas suas vendas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/50">
              {vendedoresList.map((v, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">
                      {v.nome?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{v.nome}</p>
                      <p className="text-xs text-muted-foreground">{v.vendas} venda(s)</p>
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

      {/* Gerentes */}
      {gerentesList.length > 0 && (
        <Card className="rounded-2xl border border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Award className="w-4 h-4 text-purple-500" />
              Gerentes com override nas suas vendas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/50">
              {gerentesList.map((g, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-xs font-bold text-purple-600">
                      {g.nome?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <p className="text-sm font-medium">{g.nome}</p>
                  </div>
                  <Badge variant="outline" className="bg-purple-50 text-purple-600 border-purple-200 text-xs">
                    {fmt(g.comissao)}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {ativados === 0 && (
        <div className="rounded-2xl border border-dashed border-border py-12 text-center text-muted-foreground text-sm">
          <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p>Nenhuma venda ativada ainda. Lance vendas para ver a hierarquia de comissionamento.</p>
        </div>
      )}
    </div>
  );
}