import React from "react";
import { Shield, ShieldCheck, ShieldAlert, Activity, Database, Eye, Download, Trash2, Lock, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { usePermissions } from "@/lib/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const SECURITY_CHECKS = [
  { id: "jwt", label: "JWT / Autenticação", icon: Lock, status: "active", desc: "Plataforma gerencia tokens JWT e sessões automaticamente" },
  { id: "rbac", label: "RBAC (Papéis)", icon: Shield, status: "active", desc: "4 papéis: admin, gerente, vendedor, revendedor" },
  { id: "rls", label: "Row-Level Security", icon: ShieldCheck, status: "active", desc: "RLS ativo em entidades sensíveis" },
  { id: "xss", label: "Proteção XSS", icon: ShieldCheck, status: "active", desc: "Sanitização de inputs em backend functions" },
  { id: "sqli", label: "SQL Injection", icon: ShieldCheck, status: "active", desc: "SDK parametriza todas as queries" },
  { id: "rate_limit", label: "Rate Limiting", icon: Activity, status: "active", desc: "Rate limiting em endpoints públicos e API IXC" },
  { id: "csrf", label: "CSRF Protection", icon: ShieldCheck, status: "active", desc: "Tokens CSRF em endpoints públicos" },
  { id: "encryption", label: "Criptografia", icon: Lock, status: "active", desc: "AES-GCM para campos sensíveis" },
  { id: "lgpd", label: "LGPD", icon: ShieldCheck, status: "active", desc: "Consentimento e anonimização de dados" },
  { id: "audit", label: "Auditoria", icon: Eye, status: "active", desc: "Trilha de auditoria para todas as ações" },
  { id: "backup", label: "Backup", icon: Database, status: "active", desc: "Backup periódico de dados" },
  { id: "monitoring", label: "Monitoramento", icon: Activity, status: "active", desc: "Logs de erro e integrações" },
];

export default function Seguranca() {
  const { is } = usePermissions();

  const { data: errorLogs } = useQuery({
    queryKey: ["security-error-logs"],
    queryFn: () => base44.entities.ErrorLog.list("-created_date", 10),
    enabled: is.admin,
  });

  const { data: auditLogs } = useQuery({
    queryKey: ["security-audit-logs"],
    queryFn: () => base44.entities.AuditLog.list("-created_date", 10),
    enabled: is.admin,
  });

  if (!is.admin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <ShieldAlert className="w-12 h-12 text-destructive mx-auto mb-4" />
          <p className="text-muted-foreground">Acesso restrito a administradores.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
          <Shield className="w-6 h-6 text-primary" />
          Central de Segurança
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visão geral das proteções, auditoria e conformidade LGPD.
        </p>
      </div>

      {/* Security checks grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {SECURITY_CHECKS.map((check) => (
          <Card key={check.id} className="border-l-4 border-l-green-500">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <check.icon className="w-5 h-5 text-green-500" />
                  <CardTitle className="text-sm font-semibold">{check.label}</CardTitle>
                </div>
                <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-xs">
                  Ativo
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground">{check.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ações Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Button variant="outline" className="justify-start" onClick={() => window.location.href = "/auditoria"}>
              <Eye className="w-4 h-4 mr-2" />
              Ver Trilha de Auditoria
            </Button>
            <Button variant="outline" className="justify-start" onClick={() => window.location.href = "/lgpd"}>
              <ShieldCheck className="w-4 h-4 mr-2" />
              Conformidade LGPD
            </Button>
            <Button variant="outline" className="justify-start" onClick={() => window.location.href = "/status-integracoes"}>
              <Activity className="w-4 h-4 mr-2" />
              Monitorar Integrações
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent audit logs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Auditoria Recente</CardTitle>
        </CardHeader>
        <CardContent>
          {!auditLogs || auditLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma ação auditada recente.</p>
          ) : (
            <div className="space-y-2">
              {auditLogs.slice(0, 5).map((log) => (
                <div key={log.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 text-sm">
                  <Badge variant="outline" className="text-xs">{log.action}</Badge>
                  <span className="text-muted-foreground">{log.entity_type}</span>
                  <span className="text-xs text-muted-foreground/70">{log.user_name || "Sistema"}</span>
                  <span className="text-xs text-muted-foreground/50 ml-auto">
                    {new Date(log.created_date).toLocaleString("pt-BR")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent error logs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Erros Recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!errorLogs || errorLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhum erro registrado.</p>
          ) : (
            <div className="space-y-2">
              {errorLogs.slice(0, 5).map((log) => (
                <div key={log.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 text-sm">
                  <Badge variant={log.resolvido ? "secondary" : "destructive"} className="text-xs">
                    {log.resolvido ? "Resolvido" : "Aberto"}
                  </Badge>
                  <span className="text-muted-foreground truncate flex-1">{log.mensagem}</span>
                  <span className="text-xs text-muted-foreground/50">
                    {new Date(log.created_date).toLocaleString("pt-BR")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}