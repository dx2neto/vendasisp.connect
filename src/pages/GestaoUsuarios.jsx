import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import {
  Users, Shield, UserCheck, Briefcase, Pencil, Search, Check,
  X, Eye, UserPlus, Lock, BarChart3, AlertTriangle, CheckCircle, Ban, RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/lib/usePermissions";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import ConvidarUsuarioModal from "@/components/usuarios/ConvidarUsuarioModal";
import EditarUsuarioModal from "@/components/usuarios/EditarUsuarioModal";
import PermissoesDetalhe from "@/components/usuarios/PermissoesDetalhe";

export const ROLES = [
  {
    value: "admin",
    label: "Admin",
    desc: "Acesso total ao sistema",
    cor: "bg-red-100 text-red-700 border-red-200",
    dotCor: "bg-red-500",
    icon: Shield,
    permissoes: ["Dashboard", "Esteira", "Leads", "Pedidos", "Crédito", "Planos", "Analytics", "Financeiro", "Comissões", "Contratos", "Revendedor", "Usuários", "Integrações", "Configurações", "Roleta"]
  },
  {
    value: "gerente",
    label: "Gerente",
    desc: "Vê e gerencia o próprio time",
    cor: "bg-purple-100 text-purple-700 border-purple-200",
    dotCor: "bg-purple-500",
    icon: UserCheck,
    permissoes: ["Dashboard", "Esteira", "Leads", "Pedidos", "Crédito", "Planos", "Analytics", "Comissões", "Contratos", "Revendedor (leitura)", "Metas", "Desempenho", "Templates"]
  },
  {
    value: "vendedor",
    label: "Vendedor",
    desc: "Vê apenas seus próprios pedidos",
    cor: "bg-blue-100 text-blue-700 border-blue-200",
    dotCor: "bg-blue-500",
    icon: Users,
    permissoes: ["Dashboard", "Esteira (própria)", "Leads (próprios)", "Pedidos (próprios)", "Comissões (próprias)", "Contratos (próprios)", "Metas", "Desempenho", "Meu Painel"]
  },
  {
    value: "revendedor",
    label: "Revendedor",
    desc: "Vê apenas seus clientes e comissões",
    cor: "bg-amber-100 text-amber-700 border-amber-200",
    dotCor: "bg-amber-500",
    icon: Briefcase,
    permissoes: ["Dashboard (resumido)", "Pedidos (próprios)", "Comissões (próprias)", "Painel Revendedor", "2ª Via / Boleto"]
  },
];

export const roleCor = (role) => ROLES.find(r => r.value === role)?.cor || "bg-muted text-muted-foreground";
export const roleLabel = (role) => ROLES.find(r => r.value === role)?.label || role;

function StatCard({ title, value, sub, icon: Icon, color }) {
  return (
    <div className={cn("rounded-2xl border p-4 bg-card flex items-start gap-3", "border-border")}>
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", color)}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm text-muted-foreground">{title}</p>
        {sub && <p className="text-xs text-muted-foreground/70 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function GestaoUsuarios() {
  const { is } = usePermissions();
  const queryClient = useQueryClient();
  const [editando, setEditando] = useState(null);
  const [verPermissoes, setVerPermissoes] = useState(null);
  const [convidando, setConvidando] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtroRole, setFiltroRole] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");

  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ["usuarios"],
    queryFn: () => base44.entities.User.list("-created_date", 200),
  });

  const toggleAtivoMutation = useMutation({
    mutationFn: ({ id, ativo }) => base44.entities.User.update(id, { ativo }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["usuarios"] }),
  });

  if (!is.admin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
        <Lock className="w-10 h-10 opacity-30" />
        <p className="text-sm">Acesso restrito a administradores.</p>
      </div>
    );
  }

  const gerentes = usuarios.filter(u => u.role === "gerente");

  const filtrados = usuarios.filter(u => {
    const buscaOk = !busca ||
      u.full_name?.toLowerCase().includes(busca.toLowerCase()) ||
      u.email?.toLowerCase().includes(busca.toLowerCase()) ||
      u.parceiro_codigo?.toLowerCase().includes(busca.toLowerCase());
    const roleOk = filtroRole === "todos" || u.role === filtroRole;
    const statusOk = filtroStatus === "todos" ||
      (filtroStatus === "ativo" && u.ativo !== false) ||
      (filtroStatus === "inativo" && u.ativo === false);
    return buscaOk && roleOk && statusOk;
  });

  const contagem = ROLES.reduce((acc, r) => {
    acc[r.value] = usuarios.filter(u => u.role === r.value).length;
    return acc;
  }, {});

  const totalAtivos = usuarios.filter(u => u.ativo !== false).length;
  const totalInativos = usuarios.filter(u => u.ativo === false).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestão de Usuários</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Gerencie acessos, papéis e permissões de toda a equipe
          </p>
        </div>
        <Button onClick={() => setConvidando(true)} className="gap-2 rounded-xl">
          <UserPlus className="w-4 h-4" /> Convidar Usuário
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Total de Usuários" value={usuarios.length} sub={`${totalAtivos} ativos`} icon={Users} color="bg-blue-500" />
        <StatCard title="Admins" value={contagem.admin || 0} icon={Shield} color="bg-red-500" />
        <StatCard title="Vendedores" value={(contagem.vendedor || 0) + (contagem.gerente || 0)} sub="+ gerentes" icon={UserCheck} color="bg-purple-500" />
        <StatCard title="Revendedores" value={contagem.revendedor || 0} icon={Briefcase} color="bg-amber-500" />
      </div>

      <Tabs defaultValue="usuarios" className="space-y-4">
        <TabsList className="rounded-xl">
          <TabsTrigger value="usuarios" className="rounded-lg gap-1.5">
            <Users className="w-3.5 h-3.5" /> Usuários
          </TabsTrigger>
          <TabsTrigger value="papeis" className="rounded-lg gap-1.5">
            <Shield className="w-3.5 h-3.5" /> Papéis & Permissões
          </TabsTrigger>
          <TabsTrigger value="hierarquia" className="rounded-lg gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" /> Hierarquia
          </TabsTrigger>
        </TabsList>

        {/* ─── Aba Usuários ─── */}
        <TabsContent value="usuarios" className="space-y-4">
          {/* Filtros rápidos por role */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFiltroRole("todos")}
              className={cn("px-3 py-1.5 rounded-xl text-xs font-medium border transition-all",
                filtroRole === "todos" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted"
              )}
            >Todos ({usuarios.length})</button>
            {ROLES.map(r => (
              <button
                key={r.value}
                onClick={() => setFiltroRole(filtroRole === r.value ? "todos" : r.value)}
                className={cn("px-3 py-1.5 rounded-xl text-xs font-medium border transition-all flex items-center gap-1.5",
                  filtroRole === r.value ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted"
                )}
              >
                <div className={cn("w-1.5 h-1.5 rounded-full", r.dotCor)} />
                {r.label} ({contagem[r.value] || 0})
              </button>
            ))}
            <button
              onClick={() => setFiltroStatus(filtroStatus === "inativo" ? "todos" : "inativo")}
              className={cn("px-3 py-1.5 rounded-xl text-xs font-medium border transition-all flex items-center gap-1.5",
                filtroStatus === "inativo" ? "bg-destructive text-destructive-foreground border-destructive" : "bg-card border-border hover:bg-muted"
              )}
            >
              <Ban className="w-3 h-3" /> Inativos ({totalInativos})
            </button>
          </div>

          {/* Tabela */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, e-mail ou código..."
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  className="pl-9 rounded-xl"
                />
              </div>
              {(busca || filtroRole !== "todos" || filtroStatus !== "todos") && (
                <Button variant="outline" size="sm" className="rounded-xl gap-1" onClick={() => { setBusca(""); setFiltroRole("todos"); setFiltroStatus("todos"); }}>
                  <X className="w-3.5 h-3.5" /> Limpar
                </Button>
              )}
            </div>

            {isLoading ? (
              <div className="py-12 flex items-center justify-center gap-2 text-muted-foreground text-sm">
                <RefreshCw className="w-4 h-4 animate-spin" /> Carregando...
              </div>
            ) : filtrados.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                Nenhum usuário encontrado
              </div>
            ) : (
              <>
                {/* Desktop */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left py-3 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Usuário</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">E-mail</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Papel</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Equipe / Vínculo</th>
                        <th className="text-center py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cadastro</th>
                        <th className="py-3 px-4" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {filtrados.map(u => {
                        const RoleData = ROLES.find(r => r.value === u.role);
                        const RoleIcon = RoleData?.icon || Users;
                        const ativo = u.ativo !== false;
                        return (
                          <tr key={u.id} className="hover:bg-muted/20 transition-colors group">
                            <td className="py-3.5 px-5">
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0",
                                  ativo ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                                )}>
                                  {(u.full_name || u.email || "?").charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-semibold text-sm leading-tight">{u.full_name || "—"}</p>
                                  {u.parceiro_codigo && (
                                    <p className="text-[10px] font-mono text-amber-600 mt-0.5">#{u.parceiro_codigo}</p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="text-sm text-muted-foreground truncate max-w-[180px] block">{u.email}</span>
                            </td>
                            <td className="py-3.5 px-4">
                              <Badge variant="outline" className={cn("text-xs gap-1.5 cursor-pointer hover:opacity-80", RoleData?.cor)}
                                onClick={() => setVerPermissoes(u)}>
                                <RoleIcon className="w-3 h-3" />
                                {RoleData?.label || u.role}
                                <Eye className="w-2.5 h-2.5 opacity-60" />
                              </Badge>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="text-xs text-muted-foreground space-y-0.5">
                                {u.gerente_nome && <p>👤 {u.gerente_nome}</p>}
                                {u.equipe && <p>🏷️ {u.equipe}</p>}
                                {!u.gerente_nome && !u.equipe && <span className="opacity-40">—</span>}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <button
                                onClick={() => toggleAtivoMutation.mutate({ id: u.id, ativo: !ativo })}
                                title={ativo ? "Clique para desativar" : "Clique para ativar"}
                                className="inline-flex items-center gap-1.5 text-xs font-medium transition-colors hover:opacity-80"
                              >
                                {ativo
                                  ? <><CheckCircle className="w-3.5 h-3.5 text-emerald-500" /><span className="text-emerald-600">Ativo</span></>
                                  : <><Ban className="w-3.5 h-3.5 text-red-400" /><span className="text-red-500">Inativo</span></>
                                }
                              </button>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="text-xs text-muted-foreground">
                                {u.created_date ? format(new Date(u.created_date), "dd/MM/yy", { locale: ptBR }) : "—"}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-lg"
                                  title="Ver permissões" onClick={() => setVerPermissoes(u)}>
                                  <Eye className="w-3.5 h-3.5" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-lg"
                                  title="Editar" onClick={() => setEditando(u)}>
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile */}
                <div className="md:hidden divide-y divide-border/50">
                  {filtrados.map(u => {
                    const RoleData = ROLES.find(r => r.value === u.role);
                    const RoleIcon = RoleData?.icon || Users;
                    const ativo = u.ativo !== false;
                    return (
                      <div key={u.id} className="p-4 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className={cn("w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0",
                              ativo ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                              {(u.full_name || "?").charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-sm">{u.full_name || "—"}</p>
                              <p className="text-xs text-muted-foreground">{u.email}</p>
                            </div>
                          </div>
                          <Badge variant="outline" className={cn("text-xs gap-1", RoleData?.cor)}>
                            <RoleIcon className="w-2.5 h-2.5" />
                            {RoleData?.label}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => toggleAtivoMutation.mutate({ id: u.id, ativo: !ativo })}
                            className={cn("text-xs font-medium flex items-center gap-1.5", ativo ? "text-emerald-600" : "text-red-500")}
                          >
                            {ativo ? <><CheckCircle className="w-3.5 h-3.5" /> Ativo</> : <><Ban className="w-3.5 h-3.5" /> Inativo</>}
                          </button>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-lg" onClick={() => setVerPermissoes(u)}>
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-lg" onClick={() => setEditando(u)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <div className="px-5 py-2.5 border-t border-border/60 bg-muted/20 text-xs text-muted-foreground">
              {filtrados.length} de {usuarios.length} usuário(s)
            </div>
          </div>
        </TabsContent>

        {/* ─── Aba Papéis & Permissões ─── */}
        <TabsContent value="papeis" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ROLES.map(r => {
              const Icon = r.icon;
              const membros = usuarios.filter(u => u.role === r.value);
              return (
                <div key={r.value} className="rounded-2xl border border-border bg-card p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", r.dotCor)}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-bold text-base">{r.label}</p>
                        <p className="text-xs text-muted-foreground">{r.desc}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className={cn("text-sm font-bold", r.cor)}>
                      {membros.length}
                    </Badge>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Acesso a módulos:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {r.permissoes.map(p => (
                        <span key={p} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Check className="w-2.5 h-2.5 text-emerald-500" /> {p}
                        </span>
                      ))}
                    </div>
                  </div>

                  {membros.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Membros:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {membros.slice(0, 8).map(m => (
                          <button
                            key={m.id}
                            onClick={() => setEditando(m)}
                            className="flex items-center gap-1.5 text-xs bg-muted hover:bg-muted/80 px-2 py-1 rounded-lg transition-colors"
                          >
                            <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-bold text-primary">
                              {(m.full_name || "?").charAt(0)}
                            </div>
                            {m.full_name?.split(" ")[0] || m.email}
                          </button>
                        ))}
                        {membros.length > 8 && (
                          <span className="text-xs text-muted-foreground px-2 py-1">+{membros.length - 8}</span>
                        )}
                      </div>
                    </div>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full rounded-xl text-xs gap-1.5"
                    onClick={() => { setFiltroRole(r.value); }}
                  >
                    <Users className="w-3.5 h-3.5" /> Ver todos os {r.label}s
                  </Button>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* ─── Aba Hierarquia ─── */}
        <TabsContent value="hierarquia" className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-6">
            <h3 className="font-semibold mb-5">Hierarquia de Acesso ao Sistema</h3>
            <div className="space-y-3">
              {ROLES.map((r, i) => {
                const Icon = r.icon;
                const membros = usuarios.filter(u => u.role === r.value);
                return (
                  <div key={r.value} className="flex items-start gap-4">
                    <div className="flex flex-col items-center">
                      <div className={cn("w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0", r.dotCor)}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      {i < ROLES.length - 1 && <div className="w-px h-8 bg-border mt-1" />}
                    </div>
                    <div className="flex-1 pt-1.5">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <p className="font-bold text-sm">{r.label}</p>
                          <p className="text-xs text-muted-foreground">{r.desc}</p>
                        </div>
                        <Badge variant="outline" className={cn("text-xs", r.cor)}>
                          {membros.length} membro{membros.length !== 1 ? "s" : ""}
                        </Badge>
                      </div>
                      {membros.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {membros.map(m => (
                            <button
                              key={m.id}
                              onClick={() => setEditando(m)}
                              title="Clique para editar"
                              className={cn(
                                "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all hover:shadow-sm",
                                m.ativo === false ? "bg-muted/50 text-muted-foreground border-border opacity-60" : "bg-card border-border hover:bg-muted"
                              )}
                            >
                              <div className={cn("w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0", r.dotCor)}>
                                {(m.full_name || "?").charAt(0)}
                              </div>
                              <span>{m.full_name?.split(" ")[0] || m.email}</span>
                              {m.ativo === false && <Ban className="w-2.5 h-2.5 text-red-400" />}
                              {m.equipe && <span className="opacity-50">· {m.equipe}</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Usuários sem papel definido */}
          {(() => {
            const semPapel = usuarios.filter(u => !ROLES.find(r => r.value === u.role));
            if (semPapel.length === 0) return null;
            return (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <p className="text-sm font-semibold text-amber-700">Usuários sem papel definido ({semPapel.length})</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {semPapel.map(u => (
                    <button key={u.id} onClick={() => setEditando(u)}
                      className="text-xs bg-white border border-amber-200 text-amber-700 px-2.5 py-1 rounded-lg hover:bg-amber-100 transition-colors">
                      {u.full_name || u.email}
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}
        </TabsContent>
      </Tabs>

      {/* Modais */}
      {convidando && (
        <ConvidarUsuarioModal onClose={() => setConvidando(false)} />
      )}
      {editando && (
        <EditarUsuarioModal
          user={editando}
          gerentes={gerentes}
          onClose={() => setEditando(null)}
        />
      )}
      {verPermissoes && (
        <PermissoesDetalhe
          user={verPermissoes}
          onClose={() => setVerPermissoes(null)}
          onEdit={() => { setEditando(verPermissoes); setVerPermissoes(null); }}
        />
      )}
    </div>
  );
}