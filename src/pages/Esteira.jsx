import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Badge } from "@/components/ui/badge";
import { User, DollarSign, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

const COLUMNS = [
  { id: "novo", label: "Novo Lead", color: "bg-blue-500" },
  { id: "analise_credito", label: "Crédito", color: "bg-amber-500" },
  { id: "viabilidade", label: "Viabilidade", color: "bg-purple-500" },
  { id: "contrato_pendente", label: "Contrato", color: "bg-cyan-500" },
  { id: "ativado", label: "Ativado", color: "bg-emerald-500" },
];

export default function Esteira() {
  const queryClient = useQueryClient();

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
      analise_credito: "data_credito",
      viabilidade: "data_viabilidade",
      contrato_pendente: "data_contrato",
      ativado: "data_ativacao",
    };

    const updateData = { status: newStatus };
    if (dateField[newStatus]) updateData[dateField[newStatus]] = new Date().toISOString();

    updateMutation.mutate({ id: pedidoId, data: updateData });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Esteira de Vendas</h1>
        <p className="text-muted-foreground mt-1">Arraste os cards para mover entre etapas</p>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
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
                      "flex-shrink-0 w-[280px] rounded-2xl bg-muted/50 border border-border p-3 min-h-[500px] transition-colors",
                      snapshot.isDraggingOver && "bg-primary/5 border-primary/30"
                    )}
                  >
                    {/* Column Header */}
                    <div className="flex items-center justify-between mb-3 px-1">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2.5 h-2.5 rounded-full", col.color)} />
                        <span className="font-semibold text-sm">{col.label}</span>
                        <Badge variant="secondary" className="text-xs h-5 px-1.5">{colPedidos.length}</Badge>
                      </div>
                    </div>
                    {totalValor > 0 && (
                      <div className="text-xs text-muted-foreground mb-3 px-1">
                        R$ {totalValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </div>
                    )}

                    {/* Cards */}
                    <div className="space-y-2">
                      {colPedidos.map((pedido, index) => (
                        <Draggable key={pedido.id} draggableId={pedido.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={cn(
                                "rounded-xl bg-card border border-border p-3 shadow-sm transition-all",
                                snapshot.isDragging && "shadow-lg shadow-primary/10 rotate-1 scale-105"
                              )}
                            >
                              <p className="font-medium text-sm mb-2">{pedido.lead_nome}</p>
                              {pedido.plano_nome && (
                                <p className="text-xs text-muted-foreground mb-2">{pedido.plano_nome}</p>
                              )}
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  <span>{pedido.vendedor_nome || "—"}</span>
                                </div>
                                {pedido.valor > 0 && (
                                  <div className="flex items-center gap-1 font-medium text-foreground">
                                    <DollarSign className="w-3 h-3" />
                                    {pedido.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                  </div>
                                )}
                              </div>
                              {pedido.sincronizado_ixc && (
                                <Badge className="mt-2 text-[10px] bg-emerald-50 text-emerald-600 border-emerald-200" variant="outline">
                                  Sincronizado IXC
                                </Badge>
                              )}
                            </div>
                          )}
                        </Draggable>
                      ))}
                    </div>
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}