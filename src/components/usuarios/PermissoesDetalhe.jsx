import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ROLES } from "@/pages/GestaoUsuarios";
import { Eye, Pencil, Check, X, Shield, Ban, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Mapa completo de módulos x papéis
const TODOS_MODULOS = [
  { nome: "Dashboard",         admin: true,  gerente: true,  vendedor: true,  revendedor: true  },
  { nome: "Esteira Kanban",    admin: true,  gerente: true,  vendedor: true,  revendedor: false },
  { nome: "Leads",             admin: true,  gerente: true,  vendedor: true,  revendedor: false },
  { nome: "Pedidos",           admin: true,  gerente: true,  vendedor: true,  revendedor: true  },
  { nome: "Análise de Crédito",admin: true,  gerente: true,  vendedor: true,  revendedor: false },
  { nome: "Planos",            admin: true,  gerente: true,  vendedor: false, revendedor: false },
  { nome: "Analytics",         admin: true,  gerente: true,  vendedor: false, revendedor: false },
  { nome: "Financeiro",        admin: true,  gerente: false, vendedor: false, revendedor: false },
  { nome: "Comissões",         admin: true,  gerente: true,  vendedor: true,  revendedor: true  },
  { nome: "Contratos",         admin: true,  gerente: true,  vendedor: true,  revendedor: false },
  { nome: "Central Revendedor",admin: true,  gerente: true,  vendedor: false, revendedor: false },
  { nome: "Painel Revendedor", admin: false, gerente: false, vendedor: false, revendedor: true  },
  { nome: "Meu Painel",        admin: false, gerente: false, vendedor: true,  revendedor: false },
  { nome: "Metas de Vendas",   admin: true,  gerente: true,  vendedor: true,  revendedor: false },
  { nome: "Desempenho Mensal", admin: true,  gerente: true,  vendedor: true,  revendedor: false },
  { nome: "Templates Contrato",admin: true,  gerente: true,  vendedor: false, revendedor: false },
  { nome: "Gestão de Usuários",admin: true,  gerente: false, vendedor: false, revendedor: false },
  { nome: "Integrações",       admin: true,  gerente: false, vendedor: false, revendedor: false },
  { nome: "Configurações",     admin: true,  gerente: false, vendedor: false, revendedor: false },
  { nome: "Roleta Prêmios",    admin: true,  gerente: false, vendedor: false, revendedor: false },
  { nome: "2ª Via / Boleto",   admin: true,  gerente: true,  vendedor: true,  revendedor: true  },
];

export default function PermissoesDetalhe({ user, onClose, onEdit }) {
  const roleData = ROLES.find(r => r.value === user?.role);
  const RoleIcon = roleData?.icon || Shield;
  const ativo = user?.ativo !== false;
  const permissoesUsuario = TODOS_MODULOS.filter(m => m[user?.role] === true);
  const semAcesso = TODOS_MODULOS.filter(m => m[user?.role] === false);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-primary" />
            Permissões de Acesso
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Perfil */}
          <div className="flex items-center gap-3 bg-muted/40 rounded-xl p-4">
            <div className={cn("w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0",
              ativo ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
              {(user?.full_name || "?").charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <p className="font-bold">{user?.full_name || "—"}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <Badge variant="outline" className={cn("text-xs gap-1", roleData?.cor)}>
                  <RoleIcon className="w-3 h-3" /> {roleData?.label || user?.role}
                </Badge>
                <Badge variant="outline" className={cn("text-xs gap-1",
                  ativo ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-red-50 text-red-500 border-red-200")}>
                  {ativo ? <><CheckCircle className="w-3 h-3" /> Ativo</> : <><Ban className="w-3 h-3" /> Inativo</>}
                </Badge>
                {user?.equipe && <Badge variant="outline" className="text-xs">🏷️ {user.equipe}</Badge>}
                {user?.parceiro_codigo && <Badge variant="outline" className="text-xs font-mono">#{user.parceiro_codigo}</Badge>}
              </div>
            </div>
          </div>

          {/* Vínculos */}
          {(user?.gerente_nome || user?.equipe) && (
            <div className="bg-muted/30 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Vínculos</p>
              {user?.gerente_nome && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Gerente responsável:</span>
                  <span className="font-semibold">{user.gerente_nome}</span>
                </div>
              )}
              {user?.equipe && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Equipe:</span>
                  <span className="font-semibold">{user.equipe}</span>
                </div>
              )}
            </div>
          )}

          {/* Módulos com acesso */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">
              ✅ Módulos com acesso ({permissoesUsuario.length})
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {permissoesUsuario.map(m => (
                <div key={m.nome} className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 text-xs">
                  <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                  <span className="text-emerald-700 font-medium">{m.nome}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Módulos sem acesso */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">
              🚫 Sem acesso ({semAcesso.length})
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {semAcesso.map(m => (
                <div key={m.nome} className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-2 text-xs opacity-60">
                  <X className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-muted-foreground">{m.nome}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Membro desde */}
          {user?.created_date && (
            <p className="text-xs text-muted-foreground text-center">
              Membro desde {format(new Date(user.created_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose}>Fechar</Button>
            <Button className="flex-1 rounded-xl gap-2" onClick={onEdit}>
              <Pencil className="w-4 h-4" /> Editar Permissões
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}