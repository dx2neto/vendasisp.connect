import { useAuth } from "@/lib/AuthContext";

/**
 * Papéis hierárquicos:
 *   admin     → vê tudo, gerencia tudo
 *   gerente   → vê o próprio time (pedidos/leads dos seus vendedores)
 *   vendedor  → vê apenas os próprios pedidos/leads
 *   revendedor → vê apenas pedidos onde revendedor_id === seu ID
 */

export function usePermissions() {
  const { user } = useAuth();
  const role = user?.role || "vendedor";

  const is = {
    admin:      role === "admin",
    gerente:    role === "gerente",
    vendedor:   role === "vendedor",
    revendedor: role === "revendedor",
  };

  // O que cada papel pode acessar no menu
  const canAccess = {
    dashboard:    true,
    esteira:      is.admin || is.gerente || is.vendedor,
    leads:        is.admin || is.gerente || is.vendedor,
    pedidos:      is.admin || is.gerente || is.vendedor || is.revendedor,
    credito:      is.admin || is.gerente || is.vendedor,
    planos:       is.admin || is.gerente,
    analytics:    is.admin || is.gerente,
    financeiro:   is.admin,
    comissoes:    is.admin || is.gerente || is.vendedor || is.revendedor,
    contratos:    is.admin || is.gerente || is.vendedor,
    revendedor:   is.admin || is.gerente,
    roletaConfig: is.admin,
    integracoes:  is.admin,
    configuracoes: is.admin,
    metas:        is.admin || is.gerente || is.vendedor,
    desempenho:   is.admin || is.gerente || is.vendedor,
    templates:    is.admin || is.gerente,
    vendedorPanel: is.vendedor || is.gerente || is.admin,
  };

  /**
   * Filtra uma lista de pedidos de acordo com o papel do usuário
   * Precisa do objeto user completo (id, full_name, role, gerente_id)
   */
  function filtrarPedidos(pedidos = []) {
    if (!user) return [];
    if (is.admin) return pedidos;
    if (is.gerente) {
      // Gerente vê pedidos dos vendedores do seu time
      return pedidos.filter(p =>
        p.vendedor_id === user.id ||
        p.gerente_id === user.id ||
        p.gerente_nome === user.full_name
      );
    }
    if (is.vendedor) {
      return pedidos.filter(p => p.vendedor_id === user.id || p.vendedor_nome === user.full_name);
    }
    if (is.revendedor) {
      return pedidos.filter(p => p.revendedor_id === user.id || p.revendedor_nome === user.full_name);
    }
    return [];
  }

  function filtrarLeads(leads = []) {
    if (!user) return [];
    if (is.admin) return leads;
    if (is.gerente) {
      return leads.filter(l =>
        l.vendedor_id === user.id ||
        l.vendedor_nome === user.full_name
      );
    }
    if (is.vendedor) {
      return leads.filter(l => l.vendedor_id === user.id || l.vendedor_nome === user.full_name);
    }
    if (is.revendedor) {
      return leads.filter(l => l.revendedor_id === user.id);
    }
    return [];
  }

  function filtrarComissoes(comissoes = []) {
    if (!user) return [];
    if (is.admin) return comissoes;
    if (is.gerente) {
      return comissoes.filter(c =>
        c.vendedor_id === user.id ||
        c.vendedor_nome === user.full_name ||
        c.tipo === "gerente"
      );
    }
    if (is.vendedor) {
      return comissoes.filter(c => c.vendedor_id === user.id || c.vendedor_nome === user.full_name);
    }
    if (is.revendedor) {
      return comissoes.filter(c =>
        (c.vendedor_id === user.id || c.vendedor_nome === user.full_name) && c.tipo === "revendedor"
      );
    }
    return [];
  }

  return {
    user,
    role,
    is,
    canAccess,
    filtrarPedidos,
    filtrarLeads,
    filtrarComissoes,
  };
}