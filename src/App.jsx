import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClientInstance } from "@/lib/query-client";
import { BrowserRouter as Router, Route, Routes, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import PageNotFound from "./lib/PageNotFound";
import { AuthProvider, useAuth } from "@/lib/AuthContext";
import UserNotRegisteredError from "@/components/UserNotRegisteredError";
import ProtectedRoute from "@/components/ProtectedRoute";

// Lazy loading de todas as páginas (code splitting)
const Login = lazy(() => import("@/pages/Login"));
const Register = lazy(() => import("@/pages/Register"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));

const AppLayout = lazy(() => import("@/components/layout/AppLayout"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Esteira = lazy(() => import("@/pages/Esteira"));
const Leads = lazy(() => import("@/pages/Leads"));
const Pedidos = lazy(() => import("@/pages/Pedidos"));
const Planos = lazy(() => import("@/pages/Planos"));
const Credito = lazy(() => import("@/pages/Credito"));
const Comissoes = lazy(() => import("@/pages/Comissoes"));
const Contratos = lazy(() => import("@/pages/Contratos"));
const Revendedor = lazy(() => import("@/pages/Revendedor"));
const Configuracoes = lazy(() => import("@/pages/Configuracoes"));
const Integracoes = lazy(() => import("@/pages/Integracoes"));
const VendedorDashboard = lazy(() => import("@/pages/VendedorDashboard"));
const Analytics = lazy(() => import("@/pages/Analytics"));
const MetasVendas = lazy(() => import("@/pages/MetasVendas"));
const DesempenhoMensal = lazy(() => import("@/pages/DesempenhoMensal"));
const TemplatesContrato = lazy(() => import("@/pages/TemplatesContrato.jsx"));
const ConfiguracaoContratos = lazy(() => import("@/pages/ConfiguracaoContratos.jsx"));
const Loja = lazy(() => import("@/pages/Loja"));
const Assinatura = lazy(() => import("@/pages/Assinatura"));
const Roleta = lazy(() => import("@/pages/Roleta"));
const ConfigRoleta = lazy(() => import("@/pages/ConfigRoleta"));
const SiteInstitucional = lazy(() => import("@/pages/SiteInstitucional"));
const BoletoFacil = lazy(() => import("@/pages/BoletoFacil"));
const GestaoUsuarios = lazy(() => import("@/pages/GestaoUsuarios"));
const FinanceiroDashboard = lazy(() => import("@/pages/FinanceiroDashboard"));
const Planometro = lazy(() => import("@/pages/Planometro"));
const PainelRevendedor = lazy(() => import("@/pages/PainelRevendedor"));
const Atendimento = lazy(() => import("@/pages/Atendimento"));
const ConfigAtendimento = lazy(() => import("@/pages/ConfigAtendimento"));
const Viabilidade = lazy(() => import("@/pages/Viabilidade"));
const PainelFunil = lazy(() => import("@/pages/PainelFunil"));
const Indicacao = lazy(() => import("@/pages/Indicacao"));
const GestaoIndicacoes = lazy(() => import("@/pages/GestaoIndicacoes"));
const StatusIntegracoes = lazy(() => import("@/pages/StatusIntegracoes"));
const PainelIXCSoft = lazy(() => import("@/pages/PainelIXCSoft"));
const VendedoresIXC = lazy(() => import("@/pages/VendedoresIXC"));
const Seguranca = lazy(() => import("@/pages/Seguranca"));
const Auditoria = lazy(() => import("@/pages/Auditoria"));
const LGPD = lazy(() => import("@/pages/LGPD"));

const PageLoader = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-background">
    <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
  </div>
);

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return <PageLoader />;
  }

  if (authError) {
    if (authError.type === "user_not_registered") return <UserNotRegisteredError />;
    if (authError.type === "auth_required") { navigateToLogin(); return null; }
  }

  return (
    <Routes>
      <Route path="/login" element={<Suspense fallback={<PageLoader />}><Login /></Suspense>} />
      <Route path="/register" element={<Suspense fallback={<PageLoader />}><Register /></Suspense>} />
      <Route path="/forgot-password" element={<Suspense fallback={<PageLoader />}><ForgotPassword /></Suspense>} />
      <Route path="/reset-password" element={<Suspense fallback={<PageLoader />}><ResetPassword /></Suspense>} />
      <Route path="/loja" element={<Suspense fallback={<PageLoader />}><Loja /></Suspense>} />
      <Route path="/assine" element={<Suspense fallback={<PageLoader />}><Assinatura /></Suspense>} />
      <Route path="/roleta" element={<Suspense fallback={<PageLoader />}><Roleta /></Suspense>} />
      <Route path="/site" element={<Suspense fallback={<PageLoader />}><SiteInstitucional /></Suspense>} />
      <Route path="/boleto" element={<Suspense fallback={<PageLoader />}><BoletoFacil /></Suspense>} />
      <Route path="/planometro" element={<Suspense fallback={<PageLoader />}><Planometro /></Suspense>} />
      <Route path="/indique" element={<Suspense fallback={<PageLoader />}><Indicacao /></Suspense>} />

      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<Suspense fallback={<PageLoader />}><AppLayout /></Suspense>}>
          <Route path="/" element={<Suspense fallback={<PageLoader />}><Dashboard /></Suspense>} />
          <Route path="/esteira" element={<Suspense fallback={<PageLoader />}><Esteira /></Suspense>} />
          <Route path="/leads" element={<Suspense fallback={<PageLoader />}><Leads /></Suspense>} />
          <Route path="/pedidos" element={<Suspense fallback={<PageLoader />}><Pedidos /></Suspense>} />
          <Route path="/planos" element={<Suspense fallback={<PageLoader />}><Planos /></Suspense>} />
          <Route path="/credito" element={<Suspense fallback={<PageLoader />}><Credito /></Suspense>} />
          <Route path="/comissoes" element={<Suspense fallback={<PageLoader />}><Comissoes /></Suspense>} />
          <Route path="/contratos" element={<Suspense fallback={<PageLoader />}><Contratos /></Suspense>} />
          <Route path="/revendedor" element={<Suspense fallback={<PageLoader />}><Revendedor /></Suspense>} />
          <Route path="/integracoes" element={<Suspense fallback={<PageLoader />}><Integracoes /></Suspense>} />
          <Route path="/configuracoes" element={<Suspense fallback={<PageLoader />}><Configuracoes /></Suspense>} />
          <Route path="/vendedor" element={<Suspense fallback={<PageLoader />}><VendedorDashboard /></Suspense>} />
          <Route path="/analytics" element={<Suspense fallback={<PageLoader />}><Analytics /></Suspense>} />
          <Route path="/metas" element={<Suspense fallback={<PageLoader />}><MetasVendas /></Suspense>} />
          <Route path="/desempenho" element={<Suspense fallback={<PageLoader />}><DesempenhoMensal /></Suspense>} />
          <Route path="/templates-contrato" element={<Suspense fallback={<PageLoader />}><TemplatesContrato /></Suspense>} />
          <Route path="/config-contratos" element={<Suspense fallback={<PageLoader />}><ConfiguracaoContratos /></Suspense>} />
          <Route path="/roleta-config" element={<Suspense fallback={<PageLoader />}><ConfigRoleta /></Suspense>} />
          <Route path="/financeiro" element={<Suspense fallback={<PageLoader />}><FinanceiroDashboard /></Suspense>} />
          <Route path="/usuarios" element={<Suspense fallback={<PageLoader />}><GestaoUsuarios /></Suspense>} />
          <Route path="/painel-revendedor" element={<Suspense fallback={<PageLoader />}><PainelRevendedor /></Suspense>} />
          <Route path="/atendimento" element={<Suspense fallback={<PageLoader />}><Atendimento /></Suspense>} />
          <Route path="/config-atendimento" element={<Suspense fallback={<PageLoader />}><ConfigAtendimento /></Suspense>} />
          <Route path="/viabilidade" element={<Suspense fallback={<PageLoader />}><Viabilidade /></Suspense>} />
          <Route path="/funil" element={<Suspense fallback={<PageLoader />}><PainelFunil /></Suspense>} />
          <Route path="/indicacoes" element={<Suspense fallback={<PageLoader />}><GestaoIndicacoes /></Suspense>} />
          <Route path="/status-integracoes" element={<Suspense fallback={<PageLoader />}><StatusIntegracoes /></Suspense>} />
          <Route path="/painel-ixc" element={<Suspense fallback={<PageLoader />}><PainelIXCSoft /></Suspense>} />
          <Route path="/vendedores-ixc" element={<Suspense fallback={<PageLoader />}><VendedoresIXC /></Suspense>} />
          <Route path="/seguranca" element={<Suspense fallback={<PageLoader />}><Seguranca /></Suspense>} />
          <Route path="/auditoria" element={<Suspense fallback={<PageLoader />}><Auditoria /></Suspense>} />
          <Route path="/lgpd" element={<Suspense fallback={<PageLoader />}><LGPD /></Suspense>} />
        </Route>
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;