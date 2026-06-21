import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, ShoppingCart, Kanban, CreditCard, FileText,
  Settings, Briefcase, DollarSign, Package, LogOut, ChevronLeft, ChevronRight,
  Zap, Plug, BarChart3, Gift, Globe, Receipt, Gauge, Landmark, UserCog, MessageSquare
} from "lucide-react";
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/lib/usePermissions";

// roles: quais papéis podem ver o item. undefined = todos.
const menuItems = [
  { label: "Dashboard",     icon: LayoutDashboard, path: "/",              roles: ["admin","gerente","vendedor","revendedor"] },
  { label: "Meu Painel",    icon: UserCog,          path: "/vendedor",      roles: ["vendedor"] },
  { label: "Painel Revenda", icon: Briefcase,        path: "/painel-revendedor", roles: ["revendedor"] },
  { label: "Esteira",       icon: Kanban,            path: "/esteira",       roles: ["admin","gerente","vendedor"] },
  { label: "Leads",         icon: Users,             path: "/leads",         roles: ["admin","gerente","vendedor"] },
  { label: "Pedidos",       icon: ShoppingCart,      path: "/pedidos",       roles: ["admin","gerente","vendedor","revendedor"] },
  { label: "Crédito",       icon: CreditCard,        path: "/credito",       roles: ["admin","gerente","vendedor"] },
  { label: "Planos",        icon: Package,           path: "/planos",        roles: ["admin","gerente"] },
  { label: "Analytics",     icon: BarChart3,         path: "/analytics",     roles: ["admin","gerente"] },
  { label: "Financeiro",    icon: Landmark,          path: "/financeiro",    roles: ["admin"] },
  { label: "Comissões",     icon: DollarSign,        path: "/comissoes",     roles: ["admin","gerente","vendedor","revendedor"] },
  { label: "Contratos",     icon: FileText,          path: "/contratos",     roles: ["admin","gerente","vendedor"] },
  { label: "Revendedor",    icon: Briefcase,         path: "/revendedor",    roles: ["admin","gerente"] },
  { label: "Usuários",      icon: UserCog,           path: "/usuarios",      roles: ["admin"] },
  { label: "Roleta Prêmios",icon: Gift,              path: "/roleta-config", roles: ["admin"] },
  { label: "Site",          icon: Globe,             path: "/site",          external: true, roles: ["admin"] },
  { label: "2ª Via / Boleto",icon: Receipt,          path: "/boleto",        external: true, roles: ["admin","gerente","vendedor","revendedor"] },
  { label: "Planômetro",    icon: Gauge,             path: "/planometro",    external: true, roles: ["admin","gerente","vendedor"] },
  { label: "Atendimento",   icon: MessageSquare,     path: "/atendimento",   roles: ["admin","gerente","vendedor"] },
  { label: "Config. Atend.",icon: Settings,          path: "/config-atendimento", roles: ["admin"] },
  { label: "Integrações",   icon: Plug,              path: "/integracoes",   roles: ["admin"] },
  { label: "Configurações", icon: Settings,          path: "/configuracoes", roles: ["admin"] },
];

const ROLE_LABEL = {
  admin: "Admin",
  gerente: "Gerente",
  vendedor: "Vendedor",
  revendedor: "Revendedor",
};

const ROLE_COR = {
  admin:      "bg-red-500",
  gerente:    "bg-purple-500",
  vendedor:   "bg-blue-500",
  revendedor: "bg-amber-500",
};

export default function Sidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const { user, role } = usePermissions();

  const itemsVisiveis = menuItems.filter(item =>
    !item.roles || item.roles.includes(role)
  );

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen bg-sidebar flex flex-col z-50 transition-all duration-300 border-r border-sidebar-border",
        collapsed ? "w-[68px]" : "w-[240px]"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
          <Zap className="w-4 h-4 text-primary-foreground" />
        </div>
        {!collapsed && (
          <span className="font-heading font-bold text-sidebar-primary-foreground text-lg tracking-tight">
            Datacake
          </span>
        )}
      </div>

      {/* Badge do papel */}
      {!collapsed && user && (
        <div className="px-4 py-2 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className={cn("w-2 h-2 rounded-full flex-shrink-0", ROLE_COR[role] || "bg-muted")} />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-sidebar-foreground truncate">{user.full_name}</p>
              <p className="text-[10px] text-sidebar-foreground/50">{ROLE_LABEL[role] || role}</p>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
        {itemsVisiveis.map((item) => {
          const isActive = location.pathname === item.path ||
            (item.path !== "/" && location.pathname.startsWith(item.path));
          if (item.external) {
            return (
              <a
                key={item.path}
                href={item.path}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200"
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </a>
            );
          }
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md shadow-primary/20"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-sidebar-border space-y-1">
        <button
          onClick={() => base44.auth.logout()}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent w-full transition-colors"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full py-1.5 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
}