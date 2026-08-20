import React, { useState } from "react";
import { Eye, Search, Filter, Download } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { usePermissions } from "@/lib/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const ACTION_LABELS = {
  create: { label: "Criar", color: "bg-green-500/10 text-green-600" },
  update: { label: "Atualizar", color: "bg-blue-500/10 text-blue-600" },
  delete: { label: "Excluir", color: "bg-red-500/10 text-red-600" },
  login: { label: "Login", color: "bg-purple-500/10 text-purple-600" },
  logout: { label: "Logout", color: "bg-gray-500/10 text-gray-600" },
  export: { label: "Exportar", color: "bg-amber-500/10 text-amber-600" },
  sensitive_view: { label: "Dados Sensíveis", color: "bg-orange-500/10 text-orange-600" },
};

export default function Auditoria() {
  const { is } = usePermissions();
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  const { data: auditLogs, isLoading } = useQuery({
    queryKey: ["audit-logs", search, actionFilter],
    queryFn: () => base44.entities.AuditLog.list("-created_date", 200),
    enabled: is.admin,
  });

  if (!is.admin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Eye className="w-12 h-12 text-destructive mx-auto mb-4" />
          <p className="text-muted-foreground">Acesso restrito a administradores.</p>
        </div>
      </div>
    );
  }

  const filtered = (auditLogs || []).filter((log) => {
    const matchSearch = !search ||
      (log.entity_type || "").toLowerCase().includes(search.toLowerCase()) ||
      (log.user_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (log.entity_id || "").includes(search);
    const matchAction = !actionFilter || log.action === actionFilter;
    return matchSearch && matchAction;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <Eye className="w-6 h-6 text-primary" />
            Trilha de Auditoria
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Registro de todas as ações realizadas no sistema.
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por entidade, usuário ou ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={actionFilter === "" ? "default" : "outline"}
                size="sm"
                onClick={() => setActionFilter("")}
              >
                Todos
              </Button>
              {Object.entries(ACTION_LABELS).map(([key, val]) => (
                <Button
                  key={key}
                  variant={actionFilter === key ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActionFilter(key)}
                >
                  {val.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-foreground">{filtered.length}</p>
            <p className="text-xs text-muted-foreground">Total de Registros</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-green-600">
              {filtered.filter((l) => l.action === "create").length}
            </p>
            <p className="text-xs text-muted-foreground">Criações</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-blue-600">
              {filtered.filter((l) => l.action === "update").length}
            </p>
            <p className="text-xs text-muted-foreground">Atualizações</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-red-600">
              {filtered.filter((l) => l.action === "delete").length}
            </p>
            <p className="text-xs text-muted-foreground">Exclusões</p>
          </CardContent>
        </Card>
      </div>

      {/* Audit table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registros de Auditoria</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhum registro encontrado.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="py-2 px-3 font-semibold text-muted-foreground">Data/Hora</th>
                    <th className="py-2 px-3 font-semibold text-muted-foreground">Ação</th>
                    <th className="py-2 px-3 font-semibold text-muted-foreground">Entidade</th>
                    <th className="py-2 px-3 font-semibold text-muted-foreground">Registro</th>
                    <th className="py-2 px-3 font-semibold text-muted-foreground">Usuário</th>
                    <th className="py-2 px-3 font-semibold text-muted-foreground">Papel</th>
                    <th className="py-2 px-3 font-semibold text-muted-foreground">IP</th>
                    <th className="py-2 px-3 font-semibold text-muted-foreground">Sensível</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((log) => {
                    const action = ACTION_LABELS[log.action] || { label: log.action, color: "bg-gray-500/10 text-gray-600" };
                    return (
                      <tr key={log.id} className="border-b border-border hover:bg-muted/30">
                        <td className="py-2 px-3 text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(log.created_date).toLocaleString("pt-BR")}
                        </td>
                        <td className="py-2 px-3">
                          <Badge className={`text-xs ${action.color}`}>{action.label}</Badge>
                        </td>
                        <td className="py-2 px-3 text-xs">{log.entity_type || "—"}</td>
                        <td className="py-2 px-3 text-xs text-muted-foreground font-mono">
                          {log.entity_id ? log.entity_id.slice(0, 8) + "…" : "—"}
                        </td>
                        <td className="py-2 px-3 text-xs">{log.user_name || "Sistema"}</td>
                        <td className="py-2 px-3 text-xs text-muted-foreground">{log.user_role || "—"}</td>
                        <td className="py-2 px-3 text-xs text-muted-foreground font-mono">{log.ip_address || "—"}</td>
                        <td className="py-2 px-3">
                          {log.sensitive ? (
                            <Badge variant="destructive" className="text-xs">Sim</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}