import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { ShieldAlert } from "lucide-react";

/**
 * RoleGuard — protege rotas por papel (RBAC).
 * Uso: <Route element={<RoleGuard roles={["admin"]} />}>
 */
export default function RoleGuard({ roles = [], children }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;

  if (roles.length > 0 && !roles.includes(user.role || "user")) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-xl font-heading font-bold text-foreground mb-2">
            Acesso Negado
          </h2>
          <p className="text-sm text-muted-foreground">
            Você não tem permissão para acessar esta página.
            Seu papel atual (<strong>{user.role}</strong>) não está autorizado.
          </p>
        </div>
      </div>
    );
  }

  return children;
}