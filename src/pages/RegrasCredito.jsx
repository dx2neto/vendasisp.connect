import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { Plus, Pencil, Trash2, ShieldCheck, GripVertical } from "lucide-react";

const ACOES = {
  aprovar: { label: "Aprovar", cor: "bg-emerald-50 text-emerald-600 border-emerald-200" },
  alertar: { label: "Aprovar c/ Alerta", cor: "bg-blue-50 text-blue-600 border-blue-200" },
  analise_manual: { label: "Análise Manual", cor: "bg-amber-50 text-amber-600 border-amber-200" },
  bloquear: { label: "Bloquear", cor: "bg-red-50 text-red-600 border-red-200" },
};

const OPERADORES = ["==", "!=", ">", "<", ">=", "<=", "contains"];

function RegraForm({ regra, onSave, saving }) {
  const [form, setForm] = useState({
    nome: regra?.nome || "",
    descricao: regra?.descricao || "",
    tipo_pessoa: regra?.tipo_pessoa || "ambas",
    score_minimo: regra?.score_minimo ?? null,
    probabilidade_maxima: regra?.probabilidade_maxima ?? null,
    bloquear_se_restricao: regra?.bloquear_se_restricao ?? true,
    acao: regra?.acao || "analise_manual",
    prioridade: regra?.prioridade ?? 10,
    ativo: regra?.ativo ?? true,
    condicoes: regra?.condicoes || [],
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const addCondicao = () => set("condicoes", [...form.condicoes, { campo: "", operador: "==", valor: "" }]);
  const updCondicao = (i, k, v) => set("condicoes", form.condicoes.map((c, idx) => idx === i ? { ...c, [k]: v } : c));
  const delCondicao = (i) => set("condicoes", form.condicoes.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome da Regra *</label>
          <Input value={form.nome} onChange={e => set("nome", e.target.value)} placeholder="Ex: Score baixo com restrição" />
        </div>
        <div className="col-span-2">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Descrição</label>
          <Textarea value={form.descricao} onChange={e => set("descricao", e.target.value)} rows={2} placeholder="Descreva quando esta regra deve ser aplicada..." />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo de Pessoa</label>
          <Select value={form.tipo_pessoa} onValueChange={v => set("tipo_pessoa", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ambas">Ambas</SelectItem>
              <SelectItem value="F">Pessoa Física</SelectItem>
              <SelectItem value="J">Pessoa Jurídica</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Ação *</label>
          <Select value={form.acao} onValueChange={v => set("acao", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="aprovar">Aprovar</SelectItem>
              <SelectItem value="alertar">Aprovar c/ Alerta</SelectItem>
              <SelectItem value="analise_manual">Análise Manual</SelectItem>
              <SelectItem value="bloquear">Bloquear</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Score Mínimo</label>
          <Input type="number" value={form.score_minimo ?? ""} onChange={e => set("score_minimo", e.target.value ? Number(e.target.value) : null)} placeholder="Ex: 500" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Probabilidade Máx. (%)</label>
          <Input type="number" value={form.probabilidade_maxima ?? ""} onChange={e => set("probabilidade_maxima", e.target.value ? Number(e.target.value) : null)} placeholder="Ex: 30" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Prioridade (menor = primeiro)</label>
          <Input type="number" value={form.prioridade} onChange={e => set("prioridade", Number(e.target.value))} />
        </div>
        <div className="flex items-center gap-3 pt-6">
          <Switch checked={form.bloquear_se_restricao} onCheckedChange={v => set("bloquear_se_restricao", v)} />
          <label className="text-sm">Bloquear se houver restrição</label>
        </div>
        <div className="flex items-center gap-3">
          <Switch checked={form.ativo} onCheckedChange={v => set("ativo", v)} />
          <label className="text-sm">Regra ativa</label>
        </div>
      </div>

      {/* Condições adicionais */}
      <div className="pt-3 border-t">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">Condições Adicionais (campos da API)</label>
          <Button size="sm" variant="outline" onClick={addCondicao}><Plus className="w-3 h-3 mr-1" /> Add</Button>
        </div>
        {form.condicoes.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Nenhuma condição adicional. A regra será avaliada apenas por score/probabilidade/restrição.</p>
        ) : (
          <div className="space-y-2">
            {form.condicoes.map((c, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input className="flex-1" value={c.campo} onChange={e => updCondicao(i, "campo", e.target.value)} placeholder="Campo (ex: score.pontuacao)" />
                <Select value={c.operador} onValueChange={v => updCondicao(i, "operador", v)}>
                  <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OPERADORES.map(op => <SelectItem key={op} value={op}>{op}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input className="flex-1" value={c.valor} onChange={e => updCondicao(i, "valor", e.target.value)} placeholder="Valor esperado" />
                <Button size="icon" variant="ghost" onClick={() => delCondicao(i)}><Trash2 className="w-4 h-4 text-red-400" /></Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <DialogFooter className="pt-3 border-t">
        <Button className="w-full" onClick={() => onSave(form)} disabled={saving || !form.nome}>
          Salvar Regra
        </Button>
      </DialogFooter>
    </div>
  );
}

export default function RegrasCredito() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRegra, setEditingRegra] = useState(null);

  const { data: regras = [], isLoading } = useQuery({
    queryKey: ["regras-credito"],
    queryFn: () => base44.entities.RegraCredito.list("prioridade", 100),
  });

  const mutation = useMutation({
    mutationFn: ({ id, data }) => {
      if (id) return base44.entities.RegraCredito.update(id, data);
      return base44.entities.RegraCredito.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["regras-credito"] });
      toast({ title: "Regra salva!", description: "A regra de crédito foi persistida com sucesso." });
      setDialogOpen(false);
      setEditingRegra(null);
    },
    onError: () => toast({ title: "Erro", description: "Não foi possível salvar a regra.", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.RegraCredito.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["regras-credito"] });
      toast({ title: "Regra excluída" });
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Regras de Crédito</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">Configure as condições automáticas de aprovação e reprovação</p>
        </div>
        <Button onClick={() => { setEditingRegra(null); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Nova Regra
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-10 text-center">
              <div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" />
            </div>
          ) : regras.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <ShieldCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhuma regra configurada. O motor usará o fallback do ConfigRegras.</p>
              <Button size="sm" className="mt-3" onClick={() => { setEditingRegra(null); setDialogOpen(true); }}>
                Criar primeira regra
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {regras.map((r) => {
                const acao = ACOES[r.acao] || ACOES.analise_manual;
                return (
                  <div key={r.id} className="flex items-start justify-between px-5 py-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <GripVertical className="w-3 h-3 text-muted-foreground/40" />
                        <span className="font-medium text-sm">{r.nome}</span>
                        {!r.ativo && <Badge variant="secondary" className="text-xs">Inativa</Badge>}
                        <span className="text-xs text-muted-foreground">Prioridade {r.prioridade}</span>
                      </div>
                      {r.descricao && <p className="text-xs text-muted-foreground ml-5">{r.descricao}</p>}
                      <div className="flex flex-wrap gap-1.5 ml-5 mt-2">
                        {r.tipo_pessoa && r.tipo_pessoa !== "ambas" && (
                          <Badge variant="outline" className="text-xs">{r.tipo_pessoa === "F" ? "PF" : "PJ"}</Badge>
                        )}
                        {r.score_minimo != null && (
                          <Badge variant="outline" className="text-xs">Score ≥ {r.score_minimo}</Badge>
                        )}
                        {r.probabilidade_maxima != null && (
                          <Badge variant="outline" className="text-xs">Prob ≤ {r.probabilidade_maxima}%</Badge>
                        )}
                        {r.bloquear_se_restricao && (
                          <Badge variant="outline" className="text-xs text-red-500">Bloq. se restrição</Badge>
                        )}
                        {r.condicoes?.length > 0 && (
                          <Badge variant="outline" className="text-xs">{r.condicoes.length} condição(ões)</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      <Badge variant="outline" className={cn("text-xs", acao.cor)}>{acao.label}</Badge>
                      <Button size="icon" variant="ghost" onClick={() => { setEditingRegra(r); setDialogOpen(true); }}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(r.id)}>
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingRegra ? "Editar Regra" : "Nova Regra de Crédito"}</DialogTitle>
          </DialogHeader>
          <RegraForm
            regra={editingRegra}
            onSave={(data) => mutation.mutate({ id: editingRegra?.id, data })}
            saving={mutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}