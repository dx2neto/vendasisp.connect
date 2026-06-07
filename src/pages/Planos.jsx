import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Wifi } from "lucide-react";

export default function Planos() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const queryClient = useQueryClient();

  const { data: planos = [] } = useQuery({
    queryKey: ["planos"],
    queryFn: () => base44.entities.Plano.list(),
  });

  const [form, setForm] = useState({ nome: "", velocidade_mbps: "", preco_mensal: "", descricao: "", id_modelo_ixc: "", id_produto_ixc: "", ativo: true });
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const saveMutation = useMutation({
    mutationFn: (data) => editing ? base44.entities.Plano.update(editing.id, data) : base44.entities.Plano.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planos"] });
      setShowForm(false);
      setEditing(null);
    },
  });

  const openEdit = (p) => {
    setEditing(p);
    setForm({
      nome: p.nome, velocidade_mbps: p.velocidade_mbps, preco_mensal: p.preco_mensal,
      descricao: p.descricao || "", id_modelo_ixc: p.id_modelo_ixc || "", id_produto_ixc: p.id_produto_ixc || "", ativo: p.ativo !== false
    });
    setShowForm(true);
  };

  const openNew = () => {
    setEditing(null);
    setForm({ nome: "", velocidade_mbps: "", preco_mensal: "", descricao: "", id_modelo_ixc: "", id_produto_ixc: "", ativo: true });
    setShowForm(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Planos</h1>
          <p className="text-muted-foreground mt-1">Gerencie os planos de internet</p>
        </div>
        <Button onClick={openNew} className="gap-2 rounded-xl"><Plus className="w-4 h-4" /> Novo Plano</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {planos.map(p => (
          <div key={p.id} className="rounded-2xl bg-card border border-border p-6 hover:shadow-lg hover:shadow-primary/5 transition-all group">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Wifi className="w-5 h-5 text-primary" />
              </div>
              <button onClick={() => openEdit(p)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                <Pencil className="w-4 h-4 text-muted-foreground hover:text-foreground" />
              </button>
            </div>
            <h3 className="font-semibold text-lg">{p.nome}</h3>
            <p className="text-3xl font-bold mt-1">
              {p.velocidade_mbps}<span className="text-base font-normal text-muted-foreground ml-1">Mbps</span>
            </p>
            <p className="text-primary font-semibold text-xl mt-3">
              R$ {Number(p.preco_mensal).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              <span className="text-sm font-normal text-muted-foreground">/mês</span>
            </p>
            {p.descricao && <p className="text-sm text-muted-foreground mt-2">{p.descricao}</p>}
            <div className="mt-4">
              <Badge variant="outline" className={p.ativo !== false ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}>
                {p.ativo !== false ? "Ativo" : "Inativo"}
              </Badge>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Editar Plano" : "Novo Plano"}</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); saveMutation.mutate({ ...form, velocidade_mbps: Number(form.velocidade_mbps), preco_mensal: Number(form.preco_mensal) }); }} className="space-y-4">
            <div className="space-y-1.5"><Label>Nome *</Label><Input value={form.nome} onChange={e => set("nome", e.target.value)} required className="rounded-xl" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Velocidade (Mbps) *</Label><Input type="number" value={form.velocidade_mbps} onChange={e => set("velocidade_mbps", e.target.value)} required className="rounded-xl" /></div>
              <div className="space-y-1.5"><Label>Preço Mensal (R$) *</Label><Input type="number" step="0.01" value={form.preco_mensal} onChange={e => set("preco_mensal", e.target.value)} required className="rounded-xl" /></div>
            </div>
            <div className="space-y-1.5"><Label>Descrição</Label><Textarea value={form.descricao} onChange={e => set("descricao", e.target.value)} className="rounded-xl" rows={2} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>ID Modelo IXC</Label><Input value={form.id_modelo_ixc} onChange={e => set("id_modelo_ixc", e.target.value)} className="rounded-xl" /></div>
              <div className="space-y-1.5"><Label>ID Produto IXC</Label><Input value={form.id_produto_ixc} onChange={e => set("id_produto_ixc", e.target.value)} className="rounded-xl" /></div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.ativo} onCheckedChange={v => set("ativo", v)} />
              <Label>Plano ativo</Label>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saveMutation.isPending} className="rounded-xl">{saveMutation.isPending ? "Salvando..." : "Salvar"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}