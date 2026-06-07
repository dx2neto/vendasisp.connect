import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { User, DollarSign, Calendar, CheckCircle2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import PedidoAcoes from "@/components/pedidos/PedidoAcoes";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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

  const { data: pedidos = [] } = useQuery({
    queryKey: ["pedidos"],
    queryFn: () => base44.entities.Pedido.list("-created_date", 200),
  });

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
        </div>
      </div>

      {/* Board */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4 flex-1">
          {COLUMNS.map(col => {
            const colPedidos = pedidos.filter(p =>
              p.status === col.id || (col.id === "contrato_pendente" && p.status === "assinado")
            );
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
                              {/* Nome */}
                              <p className="font-semibold text-sm leading-tight mb-1.5">{pedido.lead_nome}</p>

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
                                {pedido.created_date && (
                                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">
                                    {format(new Date(pedido.created_date), "dd/MM", { locale: ptBR })}
                                  </span>
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