import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Users, Shield, UserCheck, Briefcase, Plus, Pencil, Search, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/lib/usePermissions";

const ROLES = [
  { value: "admin",      label: "Admin",      desc: "Acesso total",                   cor: "bg-red-100 text-red-700 border-red-200",     icon: Shield },
  { value: "gerente",    label: "Gerente",     desc: "Vê o próprio time",              cor: "bg-purple-100 text-purple-700 border-purple-200", icon: UserCheck },
  { value: "vendedor",   label: "Vendedor",    desc: "Vê apenas seus pedidos",         cor: "bg-blue-100 text-blue-700 border-blue-200",   icon: Users },
  { value: "revendedor", label: "Revendedor",  desc: "Vê apenas clientes dele",        cor: "bg-amber-100 text-amber-700 border-amber-200", icon: Briefcase },
];

const roleCor = (role) => ROLES.find(r => r.value === role)?.cor || "bg-muted text-muted-foreground";
const roleLabel = (role) => ROLES.find(r => r.value === role)?.label || role;

function UserModal({ user: editUser, gerentes, onClose }) {
  const queryClient = useQueryClient();
  const isNew = !editUser;
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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["usuarios"] }); onClose(); },
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const gerenteSelecionado = gerentes.find(g => g.id === form.gerente_id);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-4 h-4 text-primary" />
            Editar permissões — {editUser?.full_name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5 mt-2">
          {/* Papel */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Papel / Nível de Acesso</label>
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
                      <p className={cn("text-sm font-semibold", selected ? "text-primary" : "text-foreground")}>{r.label}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{r.desc}</p>
                    </div>
                    {selected && <Check className="w-3.5 h-3.5 text-primary ml-auto flex-shrink-0 mt-0.5" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Equipe (gerente/vendedor) */}
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

          {/* Gerente responsável (só para vendedores) */}
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
              {gerenteSelecionado && (
                <p className="text-xs text-muted-foreground">Vinculado a {gerenteSelecionado.full_name}</p>
              )}
            </div>
          )}

          {/* Código de parceiro (revendedor) */}
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

          {/* Ativo */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-border">
            <div>
              <p className="text-sm font-medium">Usuário Ativo</p>
              <p className="text-xs text-muted-foreground">Usuários inativos não conseguem acessar o sistema</p>
            </div>
            <button
              onClick={() => set("ativo", !form.ativo)}
              className={cn(
                "w-10 h-6 rounded-full transition-all relative",
                form.ativo ? "bg-emerald-500" : "bg-muted"
              )}
            >
              <span className={cn("absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all", form.ativo ? "left-5" : "left-1")} />
            </button>
          </div>

          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose}>Cancelar</Button>
            <Button
              className="flex-1 rounded-xl"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate(form)}
            >
              {mutation.isPending ? "Salvando..." : "Salvar Permissões"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function GestaoUsuarios() {
  const { is } = usePermissions();
  const [editando, setEditando] = useState(null);
  const [busca, setBusca] = useState("");
  const [filtroRole, setFiltroRole] = useState("todos");

  const { data: usuarios = [] } = useQuery({
    queryKey: ["usuarios"],
    queryFn: () => base44.entities.User.list("-created_date", 200),
  });

  if (!is.admin) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Acesso restrito a administradores.
      </div>
    );
  }

  const gerentes = usuarios.filter(u => u.role === "gerente");

  const filtrados = usuarios.filter(u => {
    const buscaOk = !busca || u.full_name?.toLowerCase().includes(busca.toLowerCase()) || u.email?.toLowerCase().includes(busca.toLowerCase());
    const roleOk = filtroRole === "todos" || u.role === filtroRole;
    return buscaOk && roleOk;
  });

  const contagem = ROLES.reduce((acc, r) => {
    acc[r.value] = usuarios.filter(u => u.role === r.value).length;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Gestão de Usuários</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Configure papéis e permissões de cada membro da equipe</p>
      </div>

      {/* Cards de papel */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {ROLES.map(r => {
          const Icon = r.icon;
          return (
            <button
              key={r.value}
              onClick={() => setFiltroRole(filtroRole === r.value ? "todos" : r.value)}
              className={cn(
                "rounded-2xl border p-4 text-left hover:shadow-md transition-all",
                filtroRole === r.value ? "border-primary bg-primary/5 ring-1 ring-primary" : "bg-card border-border"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <Icon className="w-5 h-5 text-muted-foreground" />
                <span className="text-2xl font-bold">{contagem[r.value] || 0}</span>
              </div>
              <p className="font-semibold text-sm">{r.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{r.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Hierarquia visual */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-semibold text-sm mb-4">Hierarquia de Acesso</h3>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 text-xs">
          {[
            { label: "Admin", cor: "bg-red-500", desc: "Acesso total" },
            { label: "Gerente", cor: "bg-purple-500", desc: "Vê o time" },
            { label: "Vendedor", cor: "bg-blue-500", desc: "Vê o próprio" },
            { label: "Revendedor", cor: "bg-amber-500", desc: "Vê seus clientes" },
          ].map((h, i) => (
            <div key={h.label} className="flex items-center gap-2">
              {i > 0 && <div className="hidden sm:block w-8 h-px bg-border" />}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/30">
                <div className={cn("w-2 h-2 rounded-full", h.cor)} />
                <span className="font-semibold">{h.label}</span>
                <span className="text-muted-foreground">{h.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lista de usuários */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou e-mail..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="pl-9 rounded-xl"
            />
          </div>
          {filtroRole !== "todos" && (
            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setFiltroRole("todos")}>
              Limpar filtro
            </Button>
          )}
        </div>

        <div className="divide-y divide-border/50">
          {filtrados.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">Nenhum usuário encontrado</div>
          ) : filtrados.map(u => {
            const RoleIcon = ROLES.find(r => r.value === u.role)?.icon || Users;
            return (
              <div key={u.id} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
                  {(u.full_name || u.email || "?").charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm">{u.full_name || "—"}</p>
                    {u.ativo === false && (
                      <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">Inativo</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  {u.gerente_nome && <p className="text-[10px] text-muted-foreground mt-0.5">Gerente: {u.gerente_nome}</p>}
                  {u.equipe && <p className="text-[10px] text-muted-foreground">Equipe: {u.equipe}</p>}
                  {u.parceiro_codigo && <p className="text-[10px] text-muted-foreground font-mono">Cód: {u.parceiro_codigo}</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant="outline" className={cn("text-xs gap-1", roleCor(u.role))}>
                    <RoleIcon className="w-2.5 h-2.5" />
                    {roleLabel(u.role)}
                  </Badge>
                  <Button size="sm" variant="ghost" className="rounded-lg h-7 w-7 p-0" onClick={() => setEditando(u)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {editando && (
        <UserModal
          user={editando}
          gerentes={gerentes}
          onClose={() => setEditando(null)}
        />
      )}
    </div>
  );
}