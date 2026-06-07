import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Edit2, Plus, Loader2, Target } from "lucide-react";
import { toast } from "sonner";

export default function MetasVendas() {
  const [editingId, setEditingId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ vendedor_nome: "", mes: new Date().toISOString().slice(0, 7), meta_valor: "" });
  const queryClient = useQueryClient();

  const { data: metas = [] } = useQuery({
    queryKey: ["metas"],
    queryFn: () => base44.entities.MetaVendedor?.list?.("-created_date", 200) || Promise.resolve([]),
    enabled: !!base44.entities.MetaVendedor,
  });

  const { data: pedidos = [] } = useQuery({
    queryKey: ["pedidos"],
    queryFn: () => base44.entities.Pedido.list("-created_date", 500),
  });

  const salvarMutation = useMutation({
    mutationFn: async (data) => {
      if (editingId) {
        return base44.entities.MetaVendedor.update(editingId, data);
      }
      return base44.entities.MetaVendedor.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metas"] });
      setShowModal(false);
      setEditingId(null);
      setFormData({ vendedor_nome: "", mes: new Date().toISOString().slice(0, 7), meta_valor: "" });
      toast.success("Meta salva com sucesso!");
    },
    onError: () => toast.error("Erro ao salvar meta"),
  });

  const handleEdit = (meta) => {
    setEditingId(meta.id);
    setFormData(meta);
    setShowModal(true);
  };

  const handleSave = () => {
    if (!formData.vendedor_nome || !formData.meta_valor) {
      toast.error("Preencha todos os campos");
      return;
    }
    salvarMutation.mutate(formData);
  };

  // Calcula progresso por vendedor/mês
  const progressoData = metas.map(meta => {
    const realizado = pedidos
      .filter(p => p.vendedor_nome === meta.vendedor_nome && 
                   p.created_date?.slice(0, 7) === meta.mes &&
                   ["assinado", "ativado"].includes(p.status))
      .reduce((s, p) => s + (p.valor || 0), 0);
    
    return {
      id: meta.id,
      vendedor: meta.vendedor_nome,
      mes: meta.mes,
      meta: parseFloat(meta.meta_valor),
      realizado,
      percentual: Math.round((realizado / parseFloat(meta.meta_valor)) * 100),
    };
  });

  const chartData = metas.map(m => {
    const realizado = pedidos
      .filter(p => p.vendedor_nome === m.vendedor_nome && 
                   p.created_date?.slice(0, 7) === m.mes &&
                   ["assinado", "ativado"].includes(p.status))
      .reduce((s, p) => s + (p.valor || 0), 0);
    
    return {
      vendedor: m.vendedor_nome,
      meta: parseFloat(m.meta_valor),
      realizado,
    };
  });

  return (
    <div className="space-y-4 sm:space-y-6 pb-20 sm:pb-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Metas de Vendas</h1>
          <p className="text-muted-foreground mt-1 text-xs sm:text-sm">Defina e acompanhe metas mensais por vendedor</p>
        </div>
        <Button onClick={() => { setEditingId(null); setFormData({ vendedor_nome: "", mes: new Date().toISOString().slice(0, 7), meta_valor: "" }); setShowModal(true); }} className="gap-2 rounded-lg">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nova Meta</span>
        </Button>
      </div>

      {/* Gráfico */}
      {chartData.length > 0 && (
        <Card className="rounded-xl sm:rounded-2xl">
          <CardHeader className="pb-3 sm:pb-6">
            <CardTitle className="text-base sm:text-lg">Comparativo Meta vs Realizado</CardTitle>
          </CardHeader>
          <CardContent className="h-64 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="vendedor" stroke="hsl(var(--muted-foreground))" style={{ fontSize: "12px" }} />
                <YAxis stroke="hsl(var(--muted-foreground))" style={{ fontSize: "12px" }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                  formatter={(value) => `R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`}
                />
                <Legend />
                <Bar dataKey="meta" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                <Bar dataKey="realizado" fill="hsl(var(--accent))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Lista de Metas */}
      <div className="space-y-2 sm:space-y-3">
        {progressoData.length === 0 ? (
          <Card className="rounded-xl">
            <CardContent className="p-6 text-center text-muted-foreground">Nenhuma meta configurada</CardContent>
          </Card>
        ) : (
          progressoData.map(prog => (
            <Card key={prog.id} className="rounded-xl">
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm sm:text-base">{prog.vendedor}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">{prog.mes}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-xs font-medium">R$ {prog.realizado.toLocaleString("pt-BR", { minimumFractionDigits: 0 })} / R$ {prog.meta.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</span>
                      <span className={`text-xs font-semibold ${prog.percentual >= 100 ? "text-emerald-600" : prog.percentual >= 75 ? "text-amber-600" : "text-red-600"}`}>
                        {prog.percentual}%
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${prog.percentual >= 100 ? "bg-emerald-500" : prog.percentual >= 75 ? "bg-amber-500" : "bg-red-500"}`}
                        style={{ width: `${Math.min(prog.percentual, 100)}%` }}
                      />
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="rounded-lg flex-shrink-0" onClick={() => handleEdit(metas.find(m => m.id === prog.id))}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Meta" : "Nova Meta"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs sm:text-sm">Vendedor</Label>
              <Input
                placeholder="Nome do vendedor"
                value={formData.vendedor_nome}
                onChange={(e) => setFormData({ ...formData, vendedor_nome: e.target.value })}
                className="mt-1.5 rounded-lg"
              />
            </div>
            <div>
              <Label className="text-xs sm:text-sm">Mês</Label>
              <Input
                type="month"
                value={formData.mes}
                onChange={(e) => setFormData({ ...formData, mes: e.target.value })}
                className="mt-1.5 rounded-lg"
              />
            </div>
            <div>
              <Label className="text-xs sm:text-sm">Meta (R$)</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={formData.meta_valor}
                onChange={(e) => setFormData({ ...formData, meta_valor: e.target.value })}
                className="mt-1.5 rounded-lg"
              />
            </div>
            <Button onClick={handleSave} disabled={salvarMutation.isPending} className="w-full rounded-lg">
              {salvarMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</> : "Salvar Meta"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}