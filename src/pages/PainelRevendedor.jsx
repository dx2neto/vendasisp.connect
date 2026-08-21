import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { usePermissions } from "@/lib/usePermissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DollarSign, ShoppingCart, TrendingUp, Plus, CheckCircle,
  Clock, BarChart3, Briefcase, Users, UserCheck, Gift, Activity
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import NovaVendaRevendedorModal from "@/components/revendedor/NovaVendaRevendedorModal";
import HierarquiaComissoes from "@/components/revendedor/HierarquiaComissoes";

const fmt = (v) => `R$ ${(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const STATUS_CFG = {
  novo:               { label: "Novo",               cor: "bg-blue-50 text-blue-600 border-blue-200" },
  analise_credito:    { label: "Análise Crédito",     cor: "bg-yellow-50 text-yellow-600 border-yellow-200" },
  viabilidade:        { label: "Viabilidade",         cor: "bg-orange-50 text-orange-600 border-orange-200" },
  contrato_pendente:  { label: "Contrato Pend.",      cor: "bg-purple-50 text-purple-600 border-purple-200" },
  assinado:           { label: "Assinado",            cor: "bg-teal-50 text-teal-600 border-teal-200" },
  ativado:            { label: "Ativado",             cor: "bg-emerald-50 text-emerald-600 border-emerald-200" },
  recusado:           { label: "Recusado",            cor: "bg-red-50 text-red-500 border-red-200" },
};

function KpiCard({ title, value, sub, icon: Icon, color }) {
  return (
    <Card className="rounded-2xl border border-border">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", color)}>
            <Icon className="w-5 h-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PainelRevendedor() {
  const { user, is, filtrarPedidos, filtrarComissoes } = usePermissions();
  const [modalAberto, setModalAberto] = useState(false);
  const queryClient = useQueryClient();

  const { data: pedidosTodos = [] } = useQuery({
    queryKey: ["pedidos"],
    queryFn: () => base44.entities.Pedido.list("-created_date", 500),
  });

  const { data: comissoesTodas = [] } = useQuery({
    queryKey: ["comissoes"],
    queryFn: () => base44.entities.Comissao.list("-created_date", 500),
  });

  const { data: indicacoesTodas = [] } = useQuery({
    queryKey: ["indicacoes-revendedor", user?.id],
    queryFn: () => base44.entities.Indicacao.list("-created_date", 200),
  });

  // Assinaturas em tempo real
  useEffect(() => {
    if (!user?.id) return;
    const unsubs = [
      base44.entities.Pedido.subscribe(() => queryClient.invalidateQueries({ queryKey: ["pedidos"] })),
      base44.entities.Comissao.subscribe(() => queryClient.invalidateQueries({ queryKey: ["comissoes"] })),
      base44.entities.Indicacao.subscribe(() => queryClient.invalidateQueries({ queryKey: ["indicacoes-revendedor", user.id] })),
    ];
    return () => unsubs.forEach(u => u && u());
  }, [user?.id, queryClient]);

  // Filtra apenas os do revendedor logado
  const meusPedidos = filtrarPedidos(pedidosTodos);
  const minhasComissoes = filtrarComissoes(comissoesTodas);

  // Indicações feitas por este revendedor (por nome ou telefone)
  const minhasIndicacoes = indicacoesTodas.filter(i =>
    i.indicador_nome === user?.full_name || i.indicador_telefone === user?.telefone
  );

  // KPIs
  const totalPedidos = meusPedidos.length;
  const ativados = meusPedidos.filter(p => p.status === "ativado").length;
  const pendentes = meusPedidos.filter(p => !["ativado", "recusado"].includes(p.status)).length;
  const comissaoPendente = minhasComissoes.filter(c => c.status === "a_receber").reduce((s, c) => s + (c.valor || 0), 0);
  const comissaoPaga = minhasComissoes.filter(c => c.status === "pago").reduce((s, c) => s + (c.valor || 0), 0);
  const receitaGerada = meusPedidos.filter(p => p.status === "ativado").reduce((s, p) => s + (p.valor || 0), 0);

  const conversao = totalPedidos > 0 ? Math.round((ativados / totalPedidos) * 100) : 0;

  // KPIs de indicações
  const indicacoesPendentes = minhasIndicacoes.filter(i => ["pendente", "em_contato"].includes(i.status)).length;
  const indicacoesConvertidas = minhasIndicacoes.filter(i => i.status === "convertido").length;
  const recompensasPendentes = minhasIndicacoes.filter(i => i.status === "convertido" && !i.recompensa_paga).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center">
              <Briefcase className="w-4 h-4 text-amber-600" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Meu Painel de Revendedor</h1>
          </div>
          <p className="text-muted-foreground text-sm ml-10">
            Olá, <strong>{user?.full_name}</strong> — acompanhe suas vendas e comissões
          </p>
        </div>
        <Button onClick={() => setModalAberto(true)} className="gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white">
          <Plus className="w-4 h-4" /> Lançar Nova Venda
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Meus Pedidos" value={totalPedidos} sub="total lançado" icon={ShoppingCart} color="bg-blue-500" />
        <KpiCard title="Ativados" value={ativados} sub={`${conversao}% de conversão`} icon={CheckCircle} color="bg-emerald-500" />
        <KpiCard title="Comissão a Receber" value={fmt(comissaoPendente)} sub="pendente de pagamento" icon={Clock} color="bg-amber-500" />
        <KpiCard title="Total Recebido" value={fmt(comissaoPaga)} sub="comissões pagas" icon={TrendingUp} color="bg-purple-500" />
      </div>

      {/* Indicador tempo real */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span>Dados em tempo real</span>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pedidos" className="space-y-4">
        <TabsList className="rounded-xl">
          <TabsTrigger value="pedidos" className="rounded-lg gap-1.5">
            <ShoppingCart className="w-3.5 h-3.5" /> Meus Pedidos
          </TabsTrigger>
          <TabsTrigger value="comissoes" className="rounded-lg gap-1.5">
            <DollarSign className="w-3.5 h-3.5" /> Minhas Comissões
          </TabsTrigger>
          <TabsTrigger value="hierarquia" className="rounded-lg gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" /> Hierarquia
          </TabsTrigger>
          <TabsTrigger value="indicacoes" className="rounded-lg gap-1.5">
            <Users className="w-3.5 h-3.5" /> Clientes Indicados
          </TabsTrigger>
        </TabsList>

        {/* Pedidos */}
        <TabsContent value="pedidos" className="mt-4">
          <Card className="rounded-2xl border border-border overflow-hidden">
            <CardHeader className="border-b border-border/60 py-3 px-5">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <span>Meus Pedidos ({meusPedidos.length})</span>
                <div className="flex gap-2 text-xs text-muted-foreground font-normal">
                  <span className="text-emerald-600 font-semibold">{ativados} ativados</span>
                  <span>•</span>
                  <span className="text-amber-600 font-semibold">{pendentes} em andamento</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {meusPedidos.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground">
                  <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  <p>Nenhum pedido lançado ainda.</p>
                  <Button onClick={() => setModalAberto(true)} className="mt-4 gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white" size="sm">
                    <Plus className="w-4 h-4" /> Lançar primeira venda
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {meusPedidos.map(p => {
                    const cfg = STATUS_CFG[p.status] || { label: p.status, cor: "bg-muted text-muted-foreground" };
                    return (
                      <div key={p.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/20 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{p.lead_nome}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {p.plano_nome || "—"} • {p.created_date ? format(new Date(p.created_date), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                          <Badge variant="outline" className={cn("text-xs", cfg.cor)}>{cfg.label}</Badge>
                          <span className="text-sm font-bold text-primary">{fmt(p.valor)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Comissões */}
        <TabsContent value="comissoes" className="mt-4">
          <Card className="rounded-2xl border border-border overflow-hidden">
            <CardHeader className="border-b border-border/60 py-3 px-5">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <span>Minhas Comissões ({minhasComissoes.length})</span>
                <div className="flex gap-4 text-xs font-normal">
                  <span className="text-amber-600 font-semibold">Pendente: {fmt(comissaoPendente)}</span>
                  <span className="text-emerald-600 font-semibold">Pago: {fmt(comissaoPaga)}</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {minhasComissoes.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground">
                  <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  <p>Nenhuma comissão registrada ainda.</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {minhasComissoes.map(c => (
                    <div key={c.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/20 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{c.lead_nome || "—"}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {c.plano_nome || "—"} • {c.created_date ? format(new Date(c.created_date), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                        <Badge variant="outline" className={cn("text-xs", c.status === "pago" ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-amber-50 text-amber-600 border-amber-200")}>
                          {c.status === "pago" ? "Pago" : "A receber"}
                        </Badge>
                        <span className="text-sm font-bold text-primary">{fmt(c.valor)}</span>
                        {c.percentual && <span className="text-xs text-muted-foreground">({c.percentual}%)</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Hierarquia */}
         <TabsContent value="hierarquia" className="mt-4">
           <HierarquiaComissoes
             pedidos={meusPedidos}
             comissoes={minhasComissoes}
             revendedorNome={user?.full_name}
             receitaGerada={receitaGerada}
           />
         </TabsContent>

         {/* Clientes Indicados */}
         <TabsContent value="indicacoes" className="mt-4 space-y-4">
           {/* KPIs de indicações */}
           <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
             <Card className="rounded-xl border border-border">
               <CardContent className="p-4">
                 <div className="flex items-center gap-2 text-muted-foreground mb-1">
                   <Users className="w-3.5 h-3.5" /><span className="text-xs">Total Indicações</span>
                 </div>
                 <p className="text-xl font-bold">{minhasIndicacoes.length}</p>
               </CardContent>
             </Card>
             <Card className="rounded-xl border border-border">
               <CardContent className="p-4">
                 <div className="flex items-center gap-2 text-muted-foreground mb-1">
                   <Clock className="w-3.5 h-3.5" /><span className="text-xs">Pendentes</span>
                 </div>
                 <p className="text-xl font-bold text-amber-600">{indicacoesPendentes}</p>
               </CardContent>
             </Card>
             <Card className="rounded-xl border border-border">
               <CardContent className="p-4">
                 <div className="flex items-center gap-2 text-muted-foreground mb-1">
                   <UserCheck className="w-3.5 h-3.5" /><span className="text-xs">Convertidas</span>
                 </div>
                 <p className="text-xl font-bold text-emerald-600">{indicacoesConvertidas}</p>
               </CardContent>
             </Card>
             <Card className="rounded-xl border border-border">
               <CardContent className="p-4">
                 <div className="flex items-center gap-2 text-muted-foreground mb-1">
                   <Gift className="w-3.5 h-3.5" /><span className="text-xs">Recompensas Pend.</span>
                 </div>
                 <p className="text-xl font-bold text-purple-600">{recompensasPendentes}</p>
               </CardContent>
             </Card>
           </div>

           {/* Lista de indicações */}
           <Card className="rounded-2xl border border-border overflow-hidden">
             <CardHeader className="border-b border-border/60 py-3 px-5">
               <CardTitle className="text-sm font-semibold flex items-center justify-between">
                 <span>Clientes Indicados ({minhasIndicacoes.length})</span>
                 <Activity className="w-3.5 h-3.5 text-emerald-500" />
               </CardTitle>
             </CardHeader>
             <CardContent className="p-0">
               {minhasIndicacoes.length === 0 ? (
                 <div className="py-16 text-center text-muted-foreground">
                   <Users className="w-10 h-10 mx-auto mb-3 opacity-20" />
                   <p>Nenhuma indicação registrada ainda.</p>
                 </div>
               ) : (
                 <div className="divide-y divide-border/50">
                   {minhasIndicacoes.map(i => {
                     const statusCfg = {
                       pendente:    { label: "Pendente", cor: "bg-amber-50 text-amber-600 border-amber-200" },
                       em_contato:  { label: "Em Contato", cor: "bg-blue-50 text-blue-600 border-blue-200" },
                       convertido:  { label: "Convertido", cor: "bg-emerald-50 text-emerald-600 border-emerald-200" },
                       expirado:    { label: "Expirado", cor: "bg-muted text-muted-foreground" },
                       cancelado:   { label: "Cancelado", cor: "bg-red-50 text-red-500 border-red-200" },
                     };
                     const cfg = statusCfg[i.status] || statusCfg.pendente;
                     return (
                       <div key={i.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/20 transition-colors">
                         <div className="flex-1 min-w-0">
                           <p className="font-medium text-sm truncate">{i.indicado_nome}</p>
                           <p className="text-xs text-muted-foreground mt-0.5">
                             {i.indicado_telefone || i.indicado_email || "—"}
                             {i.codigo_indicacao && <span className="ml-2 font-mono">#{i.codigo_indicacao}</span>}
                           </p>
                         </div>
                         <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                           {i.recompensa_tipo && (
                             <Badge variant="outline" className="text-xs bg-purple-50 text-purple-600 border-purple-200">
                               <Gift className="w-3 h-3 mr-1" />
                               {i.recompensa_tipo === "mes_gratis" ? "Mês grátis" : i.recompensa_tipo === "desconto" ? `${i.recompensa_valor || ""}` : i.recompensa_tipo}
                             </Badge>
                           )}
                           <Badge variant="outline" className={cn("text-xs", cfg.cor)}>{cfg.label}</Badge>
                         </div>
                       </div>
                     );
                   })}
                 </div>
               )}
             </CardContent>
           </Card>
         </TabsContent>
         </Tabs>

      <NovaVendaRevendedorModal
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        revendedorId={user?.id}
        revendedorNome={user?.full_name}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["pedidos"] })}
      />
    </div>
  );
}