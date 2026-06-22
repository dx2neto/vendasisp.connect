import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, CheckCircle, AlertCircle, Search, Grid, List } from "lucide-react";

const RESULTADO_COLORS = {
  viavel: "bg-emerald-50 text-emerald-700 border-emerald-200",
  inviavel: "bg-red-50 text-red-700 border-red-200",
  parcial: "bg-amber-50 text-amber-700 border-amber-200",
};

const RESULTADO_ICONS = {
  viavel: <CheckCircle className="w-4 h-4" />,
  inviavel: <AlertCircle className="w-4 h-4" />,
  parcial: <AlertCircle className="w-4 h-4" />,
};

const RESULTADO_LABELS = {
  viavel: "Malha Pronta ✓",
  inviavel: "Sem Cobertura",
  parcial: "Cobertura Parcial",
};

export default function PainelViabilidade() {
  const [viewMode, setViewMode] = useState("grid");
  const [search, setSearch] = useState("");
  const [filterResultado, setFilterResultado] = useState("todos");

  const { data: viabilidades = [], isLoading } = useQuery({
    queryKey: ["viabilidades"],
    queryFn: () => base44.entities.Viabilidade.list("-created_date", 500),
  });

  const { data: pedidos = [] } = useQuery({
    queryKey: ["pedidos"],
    queryFn: () => base44.entities.Pedido.list("-created_date", 500),
  });

  const viabilidadesComPedido = viabilidades.map(v => ({
    ...v,
    pedido: pedidos.find(p => p.id === v.pedido_id),
  }));

  const filtered = viabilidadesComPedido.filter(v => {
    const matchSearch = !search || 
      v.endereco?.toLowerCase().includes(search.toLowerCase()) ||
      v.pedido?.lead_nome?.toLowerCase().includes(search.toLowerCase());
    const matchResultado = filterResultado === "todos" || v.resultado === filterResultado;
    return matchSearch && matchResultado;
  });

  const stats = {
    total: viabilidades.length,
    pronta: viabilidades.filter(v => v.resultado === "viavel").length,
    inviavel: viabilidades.filter(v => v.resultado === "inviavel").length,
    parcial: viabilidades.filter(v => v.resultado === "parcial").length,
  };

  return (
    <div className="space-y-4 pb-20 sm:pb-6">
      {/* Header com stats */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Viabilidade Técnica</h1>
        <p className="text-muted-foreground mt-1 text-sm">Endereços verificados para instalação</p>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-muted-foreground">Total</p>
          <p className="text-lg sm:text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="bg-card border border-emerald-200 bg-emerald-50/30 rounded-xl p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-emerald-700">Malha Pronta</p>
          <p className="text-lg sm:text-2xl font-bold text-emerald-700">{stats.pronta}</p>
        </div>
        <div className="bg-card border border-amber-200 bg-amber-50/30 rounded-xl p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-amber-700">Parcial</p>
          <p className="text-lg sm:text-2xl font-bold text-amber-700">{stats.parcial}</p>
        </div>
        <div className="bg-card border border-red-200 bg-red-50/30 rounded-xl p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-red-700">Sem Cobertura</p>
          <p className="text-lg sm:text-2xl font-bold text-red-700">{stats.inviavel}</p>
        </div>
      </div>

      {/* Filtros e controles */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Endereço ou cliente..." 
              value={search} 
              onChange={e => setSearch(e.target.value)}
              className="pl-10 rounded-xl text-sm"
            />
          </div>
          <Select value={filterResultado} onValueChange={setFilterResultado}>
            <SelectTrigger className="w-full sm:w-48 rounded-xl">
              <SelectValue placeholder="Filtrar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="viavel">Malha Pronta</SelectItem>
              <SelectItem value="parcial">Cobertura Parcial</SelectItem>
              <SelectItem value="inviavel">Sem Cobertura</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button
              variant={viewMode === "grid" ? "default" : "outline"}
              size="icon"
              onClick={() => setViewMode("grid")}
              className="rounded-xl"
            >
              <Grid className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              size="icon"
              onClick={() => setViewMode("list")}
              className="rounded-xl"
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Grid View */}
      {viewMode === "grid" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            <div className="col-span-full py-12 text-center text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="col-span-full py-12 text-center text-muted-foreground">Nenhum resultado</div>
          ) : (
            filtered.map(v => (
              <div
                key={v.id}
                className={`border rounded-xl p-4 space-y-3 ${RESULTADO_COLORS[v.resultado] || "bg-card border-border"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <MapPin className="w-4 h-4 mt-1 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold line-clamp-2">{v.endereco}</p>
                      {v.pedido?.lead_nome && (
                        <p className="text-xs opacity-80">{v.pedido.lead_nome}</p>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className={`text-xs flex-shrink-0 gap-1 ${RESULTADO_COLORS[v.resultado]}`}>
                    {RESULTADO_ICONS[v.resultado]}
                    {RESULTADO_LABELS[v.resultado]}
                  </Badge>
                </div>

                {v.tecnologia && (
                  <div className="text-xs space-y-1">
                    <p className="font-medium">Tecnologia: <span className="opacity-80">{v.tecnologia}</span></p>
                  </div>
                )}

                {v.observacao && (
                  <div className="text-xs bg-black/10 rounded-lg p-2 opacity-80">
                    {v.observacao}
                  </div>
                )}

                {v.resultado === "viavel" && (
                  <div className="bg-black/10 rounded-lg p-2 text-xs font-medium text-emerald-700">
                    ✓ Priorizar esta venda
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* List View */}
      {viewMode === "list" && (
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Endereço</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Cliente</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Tecnologia</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">Carregando...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">Nenhum resultado</td></tr>
                ) : (
                  filtered.map(v => (
                    <tr key={v.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4">
                        <p className="font-medium line-clamp-2">{v.endereco}</p>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-sm">
                        {v.pedido?.lead_nome || "—"}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-sm">
                        {v.tecnologia || "—"}
                      </td>
                      <td className="py-3 px-4">
                        <div className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md border text-xs font-medium ${RESULTADO_COLORS[v.resultado]}`}>
                          {RESULTADO_ICONS[v.resultado]}
                          {RESULTADO_LABELS[v.resultado]}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}