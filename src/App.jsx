import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClientInstance } from "@/lib/query-client";
import { BrowserRouter as Router, Route, Routes, Navigate } from "react-router-dom";
import PageNotFound from "./lib/PageNotFound";
import { AuthProvider, useAuth } from "@/lib/AuthContext";
import UserNotRegisteredError from "@/components/UserNotRegisteredError";
import ProtectedRoute from "@/components/ProtectedRoute";

import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";

import AppLayout from "@/components/layout/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Esteira from "@/pages/Esteira";
import Leads from "@/pages/Leads";
import Pedidos from "@/pages/Pedidos";
import Planos from "@/pages/Planos";
import Credito from "@/pages/Credito";
import Comissoes from "@/pages/Comissoes";
import Contratos from "@/pages/Contratos";
import Revendedor from "@/pages/Revendedor";
import Configuracoes from "@/pages/Configuracoes";
import Integracoes from "@/pages/Integracoes";
import VendedorDashboard from "@/pages/VendedorDashboard";
import Analytics from "@/pages/Analytics";
import MetasVendas from "@/pages/MetasVendas";
import DesempenhoMensal from "@/pages/DesempenhoMensal";
import Loja from "@/pages/Loja";

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === "user_not_registered") return <UserNotRegisteredError />;
    if (authError.type === "auth_required") { navigateToLogin(); return null; }
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/loja" element={<Loja />} />

      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/esteira" element={<Esteira />} />
          <Route path="/leads" element={<Leads />} />
          <Route path="/pedidos" element={<Pedidos />} />
          <Route path="/planos" element={<Planos />} />
          <Route path="/credito" element={<Credito />} />
          <Route path="/comissoes" element={<Comissoes />} />
          <Route path="/contratos" element={<Contratos />} />
          <Route path="/revendedor" element={<Revendedor />} />
          <Route path="/integracoes" element={<Integracoes />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
          <Route path="/vendedor" element={<VendedorDashboard />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/metas" element={<MetasVendas />} />
          <Route path="/desempenho" element={<DesempenhoMensal />} />
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