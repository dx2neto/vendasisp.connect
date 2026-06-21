import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { User, CheckCircle2, Zap, Sparkles, Flame, Clock, Filter, X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { differenceInHours, differenceInDays } from "date-fns";
import PedidoAcoes from "@/components/pedidos/PedidoAcoes";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const STATUS_COLORS = {
  novo: "bg-blue-50 text-blue-600 border-blue-200",
  analise_credito: "bg-amber-50 text-amber-600 border-amber-200",
  viabilidade: "bg-purple-50 text-purple-600 border-purple-200",
  contrato_pendente: "bg-cyan-50 text-cyan-600 border-cyan-200",
  assinado: "bg-teal-50 text-teal-600 border-teal-200",
  ativado: "bg-emerald-50 text-emerald-600 border-emerald-200",
  recusado: "bg-red-50 text-red-500 border-red-200",
};
const STATUS_LABELS = {
  novo: "Novo", analise_credito: "Crédito", viabilidade: "Viabilidade",
  contrato_pendente: "Contrato", assinado: "Assinado", ativado: "Ativado", recusado: "Recusado",
};

const COLUMNS = [
  { id: "novo",             label: "Novo Lead",   color: "bg-blue-500",    dot: "bg-blue-500" },
  { id: "analise_credito",  label: "Crédito",     color: "bg-amber-500",   dot: "bg-amber-500" },
  { id: "viabilidade",      label: "Viabilidade", color: "bg-purple-500",  dot: "bg-purple-500" },
  { id: "contrato_pendente",label: "Contrato",    color: "bg-cyan-500",    dot: "bg-cyan-500" },
  { id: "ativado",          label: "Ativado",     color: "bg-emerald-500", dot: "bg-emerald-500" },
];

export default function Esteira() {
  const queryClient = useQueryClient();
  const [selectedPedido, setSelectedPedido] = useState(null);
  const [pedidosNovos, setPedidosNovos] = useState(new Set());
  const [filtroPrioridade, setFiltroPrioridade] = useState(null); // "quente" | "morno" | "frio"
  const [filtroEspera, setFiltroEspera] = useState(null); // "hoje" | "2dias" | "semana" | "mais"

  const { data: pedidos = [] } = useQuery({
    queryKey: ["pedidos"],
    queryFn: () => base44.entities.Pedido.list("-created_date", 200),
  });

  // Subscreve a atualizações em tempo real de pedidos
  useEffect(() => {
    const unsubscribe = base44.entities.Pedido.subscribe((event) => {
      if (event.type === "create") {
        setPedidosNovos(prev => new Set([...prev, event.id]));
        toast.success(`Novo pedido criado: ${event.data.lead_nome}`);
        queryClient.invalidateQueries({ queryKey: ["pedidos"] });
        
        // Remove indicador após 10 segundos
        setTimeout(() => {
          setPedidosNovos(prev => {
            const novo = new Set(prev);
            novo.delete(event.id);
            return novo;
          });
        }, 10000);
      }
    });
    return unsubscribe;
  }, [queryClient]);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Pedido.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pedidos"] }),
  });

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const newStatus = result.destination.droppableId;
    const pedidoId = result.draggableId;
    const pedido = pedidos.find(p => p.id === pedidoId);
    if (!pedido || pedido.status === newStatus) return;
    const dateField = {
      analise_credito: "data_credito", viabilidade: "data_viabilidade",
      contrato_pendente: "data_contrato", ativado: "data_ativacao",
    };
    const updateData = { status: newStatus };
    if (dateField[newStatus]) updateData[dateField[newStatus]] = new Date().toISOString();
    updateMutation.mutate({ id: pedidoId, data: updateData });
  };

  const totalAtivado = pedidos.filter(p => p.status === "ativado").reduce((s, p) => s + (p.valor || 0), 0);

  const exportarPlanilha = () => {
    const cabecalho = [
      "Cliente", "CPF/CNPJ", "Plano", "Valor (R$)", "Status",
      "Vendedor", "Revendedor", "Canal Origem", "Sincronizado IXC",
      "Data Criação", "Data Crédito", "Data Viabilidade", "Data Contrato", "Data Ativação",
      "ID Cliente IXC", "ID Contrato IXC", "ID OS IXC", "Observação"
    ];

    const fmt = (v) => (v ? `"${String(v).replace(/"/g, '""')}"` : '""');
    const fmtData = (d) => d ? format(new Date(d), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "";

    const linhas = pedidos.map(p => [
      fmt(p.lead_nome),
      fmt(p.lead_cpf),
      fmt(p.plano_nome),
      (p.valor || 0).toFixed(2).replace(".", ","),
      fmt(STATUS_LABELS[p.status] || p.status),
      fmt(p.vendedor_nome),
      fmt(p.revendedor_nome),
      fmt(p.canal_origem),
      p.sincronizado_ixc ? "Sim" : "Não",
      fmt(fmtData(p.created_date)),
      fmt(fmtData(p.data_credito)),
      fmt(fmtData(p.data_viabilidade)),
      fmt(fmtData(p.data_contrato)),
      fmt(fmtData(p.data_ativacao)),
      fmt(p.id_cliente_ixc),
      fmt(p.id_contrato_ixc),
      fmt(p.id_os_ixc),
      fmt(p.observacao),
    ].join(";"));

    const bom = "\uFEFF"; // BOM para Excel reconhecer UTF-8
    const csv = bom + [cabecalho.join(";"), ...linhas].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `esteira_vendas_${format(new Date(), "yyyy-MM-dd", { locale: ptBR })}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`${pedidos.length} pedidos exportados com sucesso!`);
  };

  // Classificação de prioridade baseada no valor
  const getPrioridade = (pedido) => {
    if ((pedido.valor || 0) >= 200) return "quente";
    if ((pedido.valor || 0) >= 100) return "morno";
    return "frio";
  };

  // Tempo de espera em horas
  const getHorasEspera = (pedido) => {
    if (!pedido.created_date) return 0;
    return differenceInHours(new Date(), new Date(pedido.created_date));
  };

  const getFiltroEsperaMatch = (pedido) => {
    const horas = getHorasEspera(pedido);
    if (filtroEspera === "hoje") return horas <= 24;
    if (filtroEspera === "2dias") return horas > 24 && horas <= 48;
    if (filtroEspera === "semana") return horas > 48 && horas <= 168;
    if (filtroEspera === "mais") return horas > 168;
    return true;
  };

  const filtrarPedidos = (lista) => lista.filter(p => {
    const okPrioridade = !filtroPrioridade || getPrioridade(p) === filtroPrioridade;
    const okEspera = getFiltroEsperaMatch(p);
    return okPrioridade && okEspera;
  });

  const PRIORIDADES = [
    { id: "quente", label: "Quente", icon: Flame, cor: "text-red-500 border-red-300 bg-red-50 hover:bg-red-100" },
    { id: "morno", label: "Morno", icon: Flame, cor: "text-amber-500 border-amber-300 bg-amber-50 hover:bg-amber-100" },
    { id: "frio", label: "Frio", icon: Flame, cor: "text-blue-400 border-blue-200 bg-blue-50 hover:bg-blue-100" },
  ];

  const ESPERAS = [
    { id: "hoje", label: "Hoje", cor: "text-emerald-600 border-emerald-300 bg-emerald-50 hover:bg-emerald-100" },
    { id: "2dias", label: "+24h", cor: "text-amber-500 border-amber-300 bg-amber-50 hover:bg-amber-100" },
    { id: "semana", label: "+2 dias", cor: "text-orange-500 border-orange-300 bg-orange-50 hover:bg-orange-100" },
    { id: "mais", label: "+1 semana", cor: "text-red-500 border-red-300 bg-red-50 hover:bg-red-100" },
  ];

  const temFiltroAtivo = filtroPrioridade || filtroEspera;

  return (
    <div className="space-y-5 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Esteira de Vendas</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">Arraste os cards para avançar as etapas</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-border bg-card px-4 py-2 text-sm">
            <span className="text-muted-foreground mr-1.5">Receita:</span>
            <span className="font-bold text-primary">R$ {totalAtivado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
          </div>
          <Badge variant="outline" className="gap-1.5 py-1 px-3 rounded-full border-emerald-300 text-emerald-600 bg-emerald-50">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
            {pedidos.filter(p => !["ativado", "recusado"].includes(p.status)).length} ativos
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={exportarPlanilha}
            className="gap-1.5 rounded-xl h-9"
            title="Exportar dados para planilha Excel/CSV"
          >
            <Download className="w-4 h-4" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 flex-shrink-0 bg-muted/30 border border-border rounded-xl px-4 py-3">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground font-medium mr-1">
          <Filter className="w-3.5 h-3.5" />
          Filtros:
        </div>

        {/* Prioridade */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Prioridade:</span>
          {PRIORIDADES.map(p => (
            <button
              key={p.id}
              onClick={() => setFiltroPrioridade(filtroPrioridade === p.id ? null : p.id)}
              className={cn(
                "text-xs font-medium px-2.5 py-1 rounded-full border transition-all flex items-center gap-1",
                filtroPrioridade === p.id ? p.cor + " ring-2 ring-offset-1 ring-current/30" : "border-border bg-background text-muted-foreground hover:bg-muted"
              )}
            >
              <p.icon className="w-3 h-3" />
              {p.label}
            </button>
          ))}
        </div>

        <div className="w-px h-4 bg-border" />

        {/* Tempo de espera */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />Espera:</span>
          {ESPERAS.map(e => (
            <button
              key={e.id}
              onClick={() => setFiltroEspera(filtroEspera === e.id ? null : e.id)}
              className={cn(
                "text-xs font-medium px-2.5 py-1 rounded-full border transition-all",
                filtroEspera === e.id ? e.cor + " ring-2 ring-offset-1 ring-current/30" : "border-border bg-background text-muted-foreground hover:bg-muted"
              )}
            >
              {e.label}
            </button>
          ))}
        </div>

        {temFiltroAtivo && (
          <button
            onClick={() => { setFiltroPrioridade(null); setFiltroEspera(null); }}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            <X className="w-3 h-3" />
            Limpar filtros
          </button>
        )}
      </div>

      {/* Board */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4 flex-1">
          {COLUMNS.map(col => {
            const colPedidos = filtrarPedidos(pedidos.filter(p =>
              p.status === col.id || (col.id === "contrato_pendente" && p.status === "assinado")
            ));
            const totalValor = colPedidos.reduce((s, p) => s + (p.valor || 0), 0);

            return (
              <Droppable key={col.id} droppableId={col.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      "flex-shrink-0 w-[270px] rounded-2xl border border-border flex flex-col transition-colors duration-200",
                      snapshot.isDraggingOver ? "bg-primary/5 border-primary/30" : "bg-muted/30"
                    )}
                  >
                    {/* Column Header */}
                    <div className="p-3 border-b border-border/60">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", col.dot)} />
                          <span className="font-semibold text-sm">{col.label}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium bg-background border border-border rounded-full w-6 h-6 flex items-center justify-center text-muted-foreground">
                            {colPedidos.length}
                          </span>
                        </div>
                      </div>
                      {totalValor > 0 && (
                        <p className="text-[11px] text-muted-foreground mt-1.5 pl-4">
                          R$ {totalValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                      )}
                    </div>

                    {/* Cards */}
                    <div className="flex-1 p-2 space-y-2 overflow-y-auto min-h-[400px]">
                      {colPedidos.map((pedido, index) => (
                        <Draggable key={pedido.id} draggableId={pedido.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              onClick={() => !snapshot.isDragging && setSelectedPedido(pedido)}
                              className={cn(
                                "rounded-xl bg-card border border-border p-3 shadow-sm cursor-pointer transition-all group",
                                "hover:border-primary/40 hover:shadow-md hover:shadow-primary/5",
                                snapshot.isDragging && "shadow-xl shadow-primary/15 rotate-1 scale-[1.02] border-primary/30"
                              )}
                            >
                              {/* Nome + Badge Novo */}
                              <div className="flex items-start justify-between gap-2 mb-1.5">
                                <p className="font-semibold text-sm leading-tight">{pedido.lead_nome}</p>
                                {pedidosNovos.has(pedido.id) && (
                                  <Badge className="text-[10px] py-0.5 px-1.5 bg-emerald-50 text-emerald-600 border-emerald-200 gap-1 flex-shrink-0 animate-pulse" variant="outline">
                                    <Sparkles className="w-2.5 h-2.5" />Novo
                                  </Badge>
                                )}
                              </div>

                              {/* Plano */}
                              {pedido.plano_nome && (
                                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                                  <Zap className="w-3 h-3 text-primary/60" />
                                  {pedido.plano_nome}
                                </p>
                              )}

                              {/* Vendedor + Valor */}
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <div className="flex items-center gap-1 min-w-0">
                                  <User className="w-3 h-3 flex-shrink-0" />
                                  <span className="truncate">{pedido.vendedor_nome || "—"}</span>
                                </div>
                                {pedido.valor > 0 && (
                                  <div className="flex items-center gap-1 font-semibold text-foreground flex-shrink-0 ml-2">
                                    <span>R$ {pedido.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                                  </div>
                                )}
                              </div>

                              {/* Data + Badges */}
                              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                                {pedido.created_date && (() => {
                                  const horas = getHorasEspera(pedido);
                                  const dias = Math.floor(horas / 24);
                                  const label = horas < 24 ? "Hoje" : dias < 7 ? `${dias}d` : `${Math.floor(dias/7)}sem`;
                                  const urgente = horas > 168;
                                  return (
                                    <span className={cn(
                                      "text-[10px] px-1.5 py-0.5 rounded-md flex items-center gap-0.5",
                                      urgente ? "bg-red-50 text-red-500 font-semibold" : "text-muted-foreground bg-muted"
                                    )}>
                                      <Clock className="w-2.5 h-2.5" />{label}
                                    </span>
                                  );
                                })()}
                                {(() => {
                                  const p = getPrioridade(pedido);
                                  if (p === "quente") return <Badge className="text-[10px] py-0 px-1.5 bg-red-50 text-red-500 border-red-200 h-4 gap-0.5" variant="outline"><Flame className="w-2.5 h-2.5" />Quente</Badge>;
                                  if (p === "morno") return <Badge className="text-[10px] py-0 px-1.5 bg-amber-50 text-amber-500 border-amber-200 h-4 gap-0.5" variant="outline"><Flame className="w-2.5 h-2.5" />Morno</Badge>;
                                  return null;
                                })()}
                                {pedido.canal_origem === "api_credito" && (
                                  <Badge className="text-[10px] py-0 px-1.5 bg-blue-50 text-blue-600 border-blue-200 h-4" variant="outline">
                                    Crédito
                                  </Badge>
                                )}
                                {pedido.sincronizado_ixc && (
                                  <Badge className="text-[10px] py-0 px-1.5 bg-emerald-50 text-emerald-600 border-emerald-200 h-4" variant="outline">
                                    <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />IXC
                                  </Badge>
                                )}
                                {pedido.status === "assinado" && (
                                  <Badge className="text-[10px] py-0 px-1.5 bg-teal-50 text-teal-600 border-teal-200 h-4" variant="outline">
                                    Assinado
                                  </Badge>
                                )}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            );
          })}
        </div>
      </DragDropContext>

      {/* Sheet lateral */}
      <Sheet open={!!selectedPedido} onOpenChange={() => setSelectedPedido(null)}>
        <SheetContent className="w-[420px] overflow-y-auto">
          <SheetHeader className="pb-4 border-b border-border">
            <SheetTitle className="text-lg">{selectedPedido?.lead_nome}</SheetTitle>
            {selectedPedido && (
              <Badge variant="outline" className={cn("w-fit text-xs", STATUS_COLORS[selectedPedido.status] || "")}>
                {STATUS_LABELS[selectedPedido.status] || selectedPedido.status}
              </Badge>
            )}
          </SheetHeader>
          {selectedPedido && (
            <div className="mt-5 space-y-5">
              <div className="rounded-xl bg-muted/40 border border-border p-4 space-y-2.5 text-sm">
                {[
                  ["Plano", selectedPedido.plano_nome || "—"],
                  ["Valor", `R$ ${(selectedPedido.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`],
                  ["Vendedor", selectedPedido.vendedor_nome || "—"],
                  ["Canal", selectedPedido.canal_origem || "—"],
                  selectedPedido.id_cliente_ixc && ["ID Cliente IXC", `#${selectedPedido.id_cliente_ixc}`],
                  selectedPedido.id_contrato_ixc && ["ID Contrato IXC", `#${selectedPedido.id_contrato_ixc}`],
                  selectedPedido.id_os_ixc && ["OS IXC", `#${selectedPedido.id_os_ixc}`],
                ].filter(Boolean).map(([label, val]) => (
                  <div key={label} className="flex justify-between gap-4">
                    <span className="text-muted-foreground flex-shrink-0">{label}</span>
                    <span className="font-medium text-right truncate">{val}</span>
                  </div>
                ))}
              </div>
              {selectedPedido.observacao && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700">
                  {selectedPedido.observacao}
                </div>
              )}
              <div>
                <p className="text-sm font-semibold mb-3">Ações de Integração</p>
                <PedidoAcoes pedido={selectedPedido} />
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}