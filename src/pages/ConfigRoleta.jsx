import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Gift, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const TIPO_LABELS = {
  cupom: "Cupom",
  desconto: "Desconto",
  brinde: "Brinde Físico",
  frete_gratis: "Frete Grátis",
  sem_premio: "Sem Prêmio",
};

const DEFAULT_FORM = {
  nome: "", tipo: "desconto", descricao: "", valor: "",
  codigo_cupom: "", cor: "#0ea5e9", probabilidade: 10, ativo: true, emoji: "🎁",
};

function PrizeForm({ prize, onSubmit, onCancel, loading }) {
  const [form, setForm] = useState(prize || DEFAULT_FORM);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-xs font-semibold text-muted-foreground">Nome do Prêmio *</label>
          <Input required value={form.nome} onChange={e => set("nome", e.target.value)} placeholder="Ex: 10% de desconto" className="mt-1 rounded-lg" />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Emoji</label>
          <Input value={form.emoji} onChange={e => set("emoji", e.target.value)} placeholder="🎁" className="mt-1 rounded-lg" />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Tipo</label>
          <select className="w-full border border-border rounded-lg px-3 py-2 text-sm mt-1 bg-background" value={form.tipo} onChange={e => set("tipo", e.target.value)}>
            {Object.entries(TIPO_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Valor / Descrição breve</label>
          <Input value={form.valor} onChange={e => set("valor", e.target.value)} placeholder="Ex: 10% ou R$50" className="mt-1 rounded-lg" />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Código do cupom</label>
          <Input value={form.codigo_cupom} onChange={e => set("codigo_cupom", e.target.value)} placeholder="Ex: PROMO10" className="mt-1 rounded-lg font-mono" />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Probabilidade (peso)</label>
          <Input type="number" min="1" max="100" value={form.probabilidade} onChange={e => set("probabilidade", Number(e.target.value))} className="mt-1 rounded-lg" />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Cor do segmento</label>
          <div className="flex gap-2 mt-1">
            <input type="color" value={form.cor} onChange={e => set("cor", e.target.value)} className="h-9 w-14 rounded-lg border border-border cursor-pointer" />
            <Input value={form.cor} onChange={e => set("cor", e.target.value)} className="rounded-lg font-mono" />
          </div>
        </div>
        <div className="col-span-2">
          <label className="text-xs font-semibold text-muted-foreground">Descrição (aparece no resultado)</label>
          <Input value={form.descricao} onChange={e => set("descricao", e.target.value)} placeholder="Descrição adicional" className="mt-1 rounded-lg" />
        </div>
        <div className="col-span-2 flex items-center gap-2">
          <input type="checkbox" id="ativo" checked={form.ativo} onChange={e => set("ativo", e.target.checked)} className="rounded" />
          <label htmlFor="ativo" className="text-sm font-medium">Prêmio ativo</label>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" onClick={onCancel} className="rounded-lg">Cancelar</Button>
        <Button type="submit" disabled={loading} className="rounded-lg">Salvar Prêmio</Button>
      </div>
    </form>
  );
}

export default function ConfigRoleta() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const queryClient = useQueryClient();

  const { data: prizes = [] } = useQuery({
    queryKey: ["premios-roleta-all"],
    queryFn: () => base44.entities.PremioRoleta.list(),
  });

  const createMutation = useMutation({
    mutationFn: (d) => base44.entities.PremioRoleta.create(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["premios-roleta-all"] });
      queryClient.invalidateQueries({ queryKey: ["premios-roleta"] });
      setShowForm(false);
      toast.success("Prêmio criado!");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PremioRoleta.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["premios-roleta-all"] });
      queryClient.invalidateQueries({ queryKey: ["premios-roleta"] });
      setEditing(null);
      setShowForm(false);
      toast.success("Prêmio atualizado!");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PremioRoleta.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["premios-roleta-all"] });
      queryClient.invalidateQueries({ queryKey: ["premios-roleta"] });
      toast.success("Prêmio removido!");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, ativo }) => base44.entities.PremioRoleta.update(id, { ativo }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["premios-roleta-all"] });
      queryClient.invalidateQueries({ queryKey: ["premios-roleta"] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Roleta de Prêmios</h1>
          <p className="text-muted-foreground mt-1 text-sm">Configure os prêmios e compartilhe o link com seus clientes</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2 rounded-xl" onClick={() => window.open("/roleta", "_blank")}>
            <ExternalLink className="w-4 h-4" /> Ver Roleta
          </Button>
          <Button className="gap-2 rounded-xl" onClick={() => { setEditing(null); setShowForm(true); }}>
            <Plus className="w-4 h-4" /> Novo Prêmio
          </Button>
        </div>
      </div>

      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Gift className="w-4 h-4 text-primary" /> Prêmios Cadastrados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {prizes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Gift className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhum prêmio cadastrado</p>
              <p className="text-sm mt-1">Adicione prêmios para ativar a roleta</p>
            </div>
          ) : (
            <div className="space-y-2">
              {prizes.map(prize => (
                <div key={prize.id} className={`flex items-center gap-3 p-3 rounded-xl border ${prize.ativo ? "border-border bg-card" : "border-border/50 bg-muted/30 opacity-60"}`}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xl" style={{ backgroundColor: (prize.cor || "#0ea5e9") + "22" }}>
                    {prize.emoji || "🎁"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{prize.nome}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <Badge variant="outline" className="text-xs rounded-full">{TIPO_LABELS[prize.tipo]}</Badge>
                      {prize.valor && <span className="text-xs text-muted-foreground">{prize.valor}</span>}
                      {prize.codigo_cupom && <span className="text-xs font-mono text-primary">{prize.codigo_cupom}</span>}
                      <span className="text-xs text-muted-foreground">Peso: {prize.probabilidade}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost" size="icon"
                      className="h-8 w-8 rounded-lg"
                      onClick={() => toggleMutation.mutate({ id: prize.id, ativo: !prize.ativo })}
                      title={prize.ativo ? "Desativar" : "Ativar"}
                    >
                      <div className={`w-4 h-4 rounded-full border-2 ${prize.ativo ? "bg-emerald-500 border-emerald-500" : "border-muted-foreground"}`} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => { setEditing(prize); setShowForm(true); }}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive" onClick={() => deleteMutation.mutate(prize.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardContent className="p-4">
          <p className="text-sm font-semibold text-foreground mb-2">Link da Roleta</p>
          <div className="flex gap-2">
            <Input readOnly value={window.location.origin + "/roleta"} className="font-mono text-xs rounded-lg bg-muted" />
            <Button variant="outline" className="rounded-lg gap-2 shrink-0" onClick={() => { navigator.clipboard.writeText(window.location.origin + "/roleta"); toast.success("Link copiado!"); }}>
              Copiar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Compartilhe nas redes sociais, WhatsApp ou incorpore no seu site.</p>
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Prêmio" : "Novo Prêmio"}</DialogTitle>
          </DialogHeader>
          <PrizeForm
            prize={editing}
            loading={createMutation.isPending || updateMutation.isPending}
            onSubmit={(data) => editing ? updateMutation.mutate({ id: editing.id, data }) : createMutation.mutate(data)}
            onCancel={() => setShowForm(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}