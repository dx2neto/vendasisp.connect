import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ROLES } from "@/pages/GestaoUsuarios";
import { Pencil, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export default function EditarUsuarioModal({ user: editUser, gerentes, onClose }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    role: editUser?.role || "vendedor",
    equipe: editUser?.equipe || "",
    gerente_id: editUser?.gerente_id || "",
    gerente_nome: editUser?.gerente_nome || "",
    parceiro_codigo: editUser?.parceiro_codigo || "",
    ativo: editUser?.ativo !== false,
  });

  const mutation = useMutation({
    mutationFn: (data) => base44.entities.User.update(editUser.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
      onClose();
    },
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const gerenteSel = gerentes.find(g => g.id === form.gerente_id);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-4 h-4 text-primary" />
            Editar Usuário
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Info do usuário */}
          <div className="flex items-center gap-3 bg-muted/40 rounded-xl p-3">
            <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-base font-bold text-primary flex-shrink-0">
              {(editUser?.full_name || "?").charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold">{editUser?.full_name || "—"}</p>
              <p className="text-xs text-muted-foreground">{editUser?.email}</p>
            </div>
          </div>

          {/* Papel */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Papel / Nível de Acesso
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ROLES.map(r => {
                const Icon = r.icon;
                const selected = form.role === r.value;
                return (
                  <button
                    key={r.value}
                    onClick={() => set("role", r.value)}
                    className={cn(
                      "flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all",
                      selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/50"
                    )}
                  >
                    <Icon className={cn("w-4 h-4 mt-0.5 flex-shrink-0", selected ? "text-primary" : "text-muted-foreground")} />
                    <div>
                      <p className={cn("text-sm font-semibold", selected ? "text-primary" : "")}>{r.label}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{r.desc}</p>
                    </div>
                    {selected && <Check className="w-3.5 h-3.5 text-primary ml-auto flex-shrink-0 mt-0.5" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Módulos específicos por papel */}
          {(form.role === "gerente" || form.role === "vendedor") && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Equipe</label>
              <Input
                placeholder="Ex: Equipe Norte, Time Alpha..."
                value={form.equipe}
                onChange={e => set("equipe", e.target.value)}
                className="rounded-xl"
              />
            </div>
          )}

          {form.role === "vendedor" && gerentes.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Gerente Responsável</label>
              <select
                className="w-full h-9 rounded-xl border border-input bg-transparent px-3 text-sm"
                value={form.gerente_id}
                onChange={e => {
                  const g = gerentes.find(g => g.id === e.target.value);
                  set("gerente_id", e.target.value);
                  set("gerente_nome", g?.full_name || "");
                }}
              >
                <option value="">Sem gerente vinculado</option>
                {gerentes.map(g => <option key={g.id} value={g.id}>{g.full_name}</option>)}
              </select>
              {gerenteSel && (
                <p className="text-xs text-muted-foreground">Vinculado a {gerenteSel.full_name}</p>
              )}
            </div>
          )}

          {form.role === "revendedor" && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Código do Parceiro</label>
              <Input
                placeholder="Ex: PARCEIRO001"
                value={form.parceiro_codigo}
                onChange={e => set("parceiro_codigo", e.target.value.toUpperCase())}
                className="rounded-xl font-mono"
              />
              <p className="text-xs text-muted-foreground">Identificador único para rastreio de vendas</p>
            </div>
          )}

          {/* Permissões do papel selecionado */}
          <div className="bg-muted/30 rounded-xl p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Módulos com acesso ({ROLES.find(r => r.value === form.role)?.label}):
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ROLES.find(r => r.value === form.role)?.permissoes.map(p => (
                <span key={p} className="text-xs bg-card border border-border text-foreground px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Check className="w-2.5 h-2.5 text-emerald-500" /> {p}
                </span>
              ))}
            </div>
          </div>

          {/* Status Ativo */}
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-border">
            <div>
              <p className="text-sm font-semibold">Status do Acesso</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {form.ativo ? "Usuário ativo — consegue acessar o sistema" : "Usuário inativo — acesso bloqueado"}
              </p>
            </div>
            <button
              onClick={() => set("ativo", !form.ativo)}
              className={cn(
                "w-11 h-6 rounded-full transition-all relative flex-shrink-0",
                form.ativo ? "bg-emerald-500" : "bg-muted"
              )}
            >
              <span className={cn(
                "absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all",
                form.ativo ? "left-[calc(100%-20px)]" : "left-1"
              )} />
            </button>
          </div>

          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              className="flex-1 rounded-xl gap-2"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate(form)}
            >
              {mutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}