import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Pencil, Trash2, Gift, ExternalLink, ToggleLeft, ToggleRight } from "lucide-react";
import { toast, Toaster } from "sonner";

const TIPO_LABELS = { cupom: "Cupom", desconto: "Desconto %", brinde: "Brinde Físico", nenhum: "Sem Prêmio" };
const TIPO_COLORS = { cupom: "bg-blue-50 text-blue-700", desconto: "bg-emerald-50 text-emerald-700", brinde: "bg-amber-50 text-amber-700", nenhum: "bg-muted text-muted-foreground" };

const FORM_VAZIO = { nome: "", tipo: "cupom", descricao: "", codigo_cupom: "", percentual_desconto: "", cor: "#0ea5e9", probabilidade: 20, ativo: true };

export default function ConfigRoleta() {
  const [form, setForm] = useState(FORM_VAZIO);
  const [editandoId, setEditandoId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data: premios = [], isLoading } = useQuery({
    queryKey: ["premios-roleta-admin"],
    queryFn: () => base44.entities.PremioRoleta.list("-created_date"),
  });

  const salvarMutation = useMutation({
    mutationFn: async (data) => {
      if (editandoId) return base44.entities.PremioRoleta.update(editandoId, data);
      return base44.entities.PremioRoleta.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["premios-roleta-admin"] });
      queryClient.invalidateQueries({ queryKey: ["premios-roleta"] });
      toast.success(editandoId ? "Prêmio atualizado!" : "Prêmio criado!");
      setForm(FORM_VAZIO);
      setEditandoId(null);
      setShowForm(false);
    },
  });

  const deletarMutation = useMutation({
    mutationFn: (id) => base44.entities.PremioRoleta.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["premios-roleta-admin"] });
      queryClient.invalidateQueries({ queryKey: ["premios-roleta"] });
      toast.success("Prêmio removido");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, ativo }) => base44.entities.PremioRoleta.update(id, { ativo }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["premios-roleta-admin"] }),
  });

  const iniciarEdicao = (p) => {
    setForm({ ...p });
    setEditandoId(p.id);
    setShowForm(true);
  };

  const cancelar = () => {
    setForm(FORM_VAZIO);
    setEditandoId(null);
    setShowForm(false);
  };

  const roletaUrl = `${window.location.origin}/roleta`;

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Roleta de Prêmios</h1>
          <p className="text-muted-foreground mt-1">Configure os prêmios e compartilhe o link com clientes</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" className="gap-2 rounded-xl" onClick={() => window.open(roletaUrl, "_blank")}>
            <ExternalLink className="w-4 h-4" /> Ver Roleta
          </Button>
          <Button className="gap-2 rounded-xl" onClick={() => { setShowForm(true); setEditandoId(null); setForm(FORM_VAZIO); }}>
            <Plus className="w-4 h-4" /> Novo Prêmio
          </Button>
        </div>
      </div>

      {/* Link de compartilhamento */}
      <Card className="rounded-2xl border-primary/30 bg-primary/5">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-muted-foreground mb-1">Link da Roleta</p>
            <p className="font-mono text-sm break-all text-primary">{roletaUrl}</p>
            <p className="text-xs text-muted-foreground mt-1">Adicione <strong>?v=ID_VENDEDOR</strong> para vincular comissão automaticamente</p>
          </div>
          <Button variant="outline" size="sm" className="rounded-lg gap-2 shrink-0" onClick={() => { navigator.clipboard.writeText(roletaUrl); toast.success("Link copiado!"); }}>
            Copiar
          </Button>
        </CardContent>
      </Card>

      {/* Formulário */}
      {showForm && (
        <Card className="rounded-2xl border-primary/30">
          <CardHeader>
            <CardTitle className="text-base">{editandoId ? "Editar Prêmio" : "Novo Prêmio"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Nome do prêmio *</label>
                <Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: 1 Mês Grátis" className="rounded-lg" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Tipo</label>
                <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                  {Object.entries(TIPO_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Descrição</label>
                <Input value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} placeholder="Detalhe do prêmio exibido ao cliente" className="rounded-lg" />
              </div>
              {form.tipo === "cupom" && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Código do cupom</label>
                  <Input value={form.codigo_cupom} onChange={e => setForm({ ...form, codigo_cupom: e.target.value })} placeholder="PROMO2025" className="rounded-lg font-mono" />
                </div>
              )}
              {form.tipo === "desconto" && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Percentual de desconto</label>
                  <Input type="number" value={form.percentual_desconto} onChange={e => setForm({ ...form, percentual_desconto: e.target.value })} placeholder="10" className="rounded-lg" />
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Cor do segmento</label>
                <div className="flex gap-2 items-center">
                  <input type="color" value={form.cor} onChange={e => setForm({ ...form, cor: e.target.value })} className="w-10 h-9 rounded-lg border border-border cursor-pointer p-0.5" />
                  <Input value={form.cor} onChange={e => setForm({ ...form, cor: e.target.value })} className="rounded-lg font-mono flex-1" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Probabilidade (peso)</label>
                <Input type="number" value={form.probabilidade} onChange={e => setForm({ ...form, probabilidade: Number(e.target.value) })} placeholder="20" className="rounded-lg" />
                <p className="text-xs text-muted-foreground mt-1">Maior peso = mais frequente</p>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={() => salvarMutation.mutate(form)} disabled={salvarMutation.isPending || !form.nome} className="rounded-lg gap-2">
                <Gift className="w-4 h-4" /> {salvarMutation.isPending ? "Salvando..." : "Salvar Prêmio"}
              </Button>
              <Button variant="ghost" onClick={cancelar} className="rounded-lg">Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de prêmios */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <p className="text-muted-foreground text-sm col-span-3">Carregando...</p>
        ) : premios.length === 0 ? (
          <div className="col-span-3 text-center py-12 text-muted-foreground">
            <Gift className="w-10 h-10 mx-auto opacity-30 mb-3" />
            <p>Nenhum prêmio cadastrado ainda.</p>
            <p className="text-xs mt-1">Crie prêmios para exibir na roleta.</p>
          </div>
        ) : premios.map(p => (
          <Card key={p.id} className={`rounded-2xl border transition-all ${p.ativo ? "border-border" : "border-dashed opacity-60"}`}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: p.cor || "#0ea5e9" }} />
                  <p className="font-semibold text-sm">{p.nome}</p>
                </div>
                <Badge variant="outline" className={`text-xs ${TIPO_COLORS[p.tipo]}`}>{TIPO_LABELS[p.tipo]}</Badge>
              </div>
              {p.descricao && <p className="text-xs text-muted-foreground">{p.descricao}</p>}
              {p.codigo_cupom && <p className="text-xs font-mono bg-muted px-2 py-1 rounded">{p.codigo_cupom}</p>}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Peso: {p.probabilidade || 20}</span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => toggleMutation.mutate({ id: p.id, ativo: !p.ativo })}>
                    {p.ativo ? <ToggleRight className="w-4 h-4 text-emerald-600" /> : <ToggleLeft className="w-4 h-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => iniciarEdicao(p)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-destructive hover:text-destructive" onClick={() => deletarMutation.mutate(p.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}