import { useEffect } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { ShieldAlert } from 'lucide-react';

const DefaultFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

// Mapa de rotas → roles permitidas. undefined = qualquer autenticado.
const ROUTE_ROLES = {
  '/configuracoes': ['admin'],
  '/integracoes': ['admin'],
  '/financeiro': ['admin'],
  '/usuarios': ['admin'],
  '/roleta-config': ['admin'],
  '/config-atendimento': ['admin'],
  '/seguranca': ['admin'],
  '/auditoria': ['admin'],
  '/lgpd': ['admin'],
  '/vendedores-ixc': ['admin'],
  '/planos': ['admin', 'gerente'],
  '/analytics': ['admin', 'gerente'],
  '/revendedor': ['admin', 'gerente'],
  '/templates-contrato': ['admin', 'gerente'],
  '/config-contratos': ['admin', 'gerente'],
  '/indicacoes': ['admin', 'gerente'],
  '/status-integracoes': ['admin', 'gerente'],
  '/painel-ixc': ['admin', 'gerente'],
  '/funil': ['admin', 'gerente', 'vendedor'],
  '/meu-funil': ['vendedor', 'gerente', 'admin'],
  '/checklist-instalacao': ['admin', 'gerente', 'vendedor'],
  '/nps': ['admin', 'gerente'],
  '/regras-credito': ['admin'],
  '/esteira': ['admin', 'gerente', 'vendedor'],
  '/leads': ['admin', 'gerente', 'vendedor'],
  '/pedidos': ['admin', 'gerente', 'vendedor', 'revendedor'],
  '/credito': ['admin', 'gerente', 'vendedor'],
  '/comissoes': ['admin', 'gerente', 'vendedor', 'revendedor'],
  '/contratos': ['admin', 'gerente', 'vendedor'],
  '/metas': ['admin', 'gerente', 'vendedor'],
  '/desempenho': ['admin', 'gerente', 'vendedor'],
  '/atendimento': ['admin', 'gerente', 'vendedor'],
  '/viabilidade': ['admin', 'gerente', 'vendedor'],
};

export default function ProtectedRoute({ fallback = <DefaultFallback />, unauthenticatedElement }) {
  const { isAuthenticated, isLoadingAuth, authChecked, authError, checkUserAuth, user } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (!authChecked && !isLoadingAuth) {
      checkUserAuth();
    }
  }, [authChecked, isLoadingAuth, checkUserAuth]);

  if (isLoadingAuth || !authChecked) {
    return fallback;
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }
    return unauthenticatedElement;
  }

  if (!isAuthenticated) {
    return unauthenticatedElement;
  }

  // RBAC: valida role para a rota atual
  const allowedRoles = ROUTE_ROLES[location.pathname];
  if (allowedRoles && user && !allowedRoles.includes(user.role || 'user')) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-xl font-heading font-bold text-foreground mb-2">Acesso Negado</h2>
          <p className="text-sm text-muted-foreground">
            Você não tem permissão para acessar esta página. Seu perfil atual (<strong>{user.role}</strong>) não está autorizado.
          </p>
        </div>
      </div>
    );
  }

  return <Outlet />;
}