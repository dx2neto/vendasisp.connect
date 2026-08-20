import React, { useState } from "react";
import { ShieldCheck, FileText, Eye, Trash2, Download, AlertTriangle, UserX } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { usePermissions } from "@/lib/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

const CONSENT_TYPES = {
  coleta_dados: { label: "Coleta de Dados", desc: "Permissão para coletar e armazenar dados pessoais" },
  marketing: { label: "Marketing", desc: "Receber comunicações promocionais" },
  terceiros: { label: "Compartilhamento", desc: "Compartilhar dados com parceiros (IXC, ZapSign)" },
  credit_check: { label: "Consulta de Crédito", desc: "Consultar órgãos de proteção ao crédito (Serasa)" },
  contrato: { label: "Contrato", desc: "Assinar contratos digitalmente" },
};

const RETENTION_DAYS = 1095; // 3 anos

export default function LGPD() {
  const { is } = usePermissions();
  const { toast } = useToast();
  const [searchDoc, setSearchDoc] = useState("");

  const { data: consents, isLoading } = useQuery({
    queryKey: ["lgpd-consents"],
    queryFn: () => base44.entities.LGPDConsentimento.list("-created_date", 200),
    enabled: is.admin,
  });

  if (!is.admin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <ShieldCheck className="w-12 h-12 text-destructive mx-auto mb-4" />
          <p className="text-muted-foreground">Acesso restrito a administradores.</p>
        </div>
      </div>
    );
  }

  const totalConsents = consents?.length || 0;
  const activeConsents = consents?.filter((c) => c.consent_given && !c.withdrawal_date).length || 0;
  const withdrawn = consents?.filter((c) => c.withdrawal_date).length || 0;
  const anonymized = consents?.filter((c) => c.anonymized).length || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-primary" />
          Conformidade LGPD
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gestão de consentimentos, anonimização e direitos do titular dos dados.
        </p>
      </div>

      {/* LGPD Info */}
      <Card className="border-l-4 border-l-primary">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-semibold">Lei Geral de Proteção de Dados (Lei 13.709/2018)</p>
              <p className="text-xs text-muted-foreground">
                Esta plataforma segue a LGPD. Todos os dados pessoais são coletados com consentimento explícito,
                armazenados de forma segura e podem ser anonimizados ou excluídos a pedido do titular.
                Prazo de retenção padrão: <strong>{RETENTION_DAYS} dias (3 anos)</strong>.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-foreground">{totalConsents}</p>
            <p className="text-xs text-muted-foreground">Total de Consentimentos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-green-600">{activeConsents}</p>
            <p className="text-xs text-muted-foreground">Ativos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{withdrawn}</p>
            <p className="text-xs text-muted-foreground">Revogados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{anonymized}</p>
            <p className="text-xs text-muted-foreground">Anonimizados</p>
          </CardContent>
        </Card>
      </div>

      {/* Consent types */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tipos de Consentimento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(CONSENT_TYPES).map(([key, val]) => {
              const count = consents?.filter((c) => c.consent_type === key && c.consent_given && !c.withdrawal_date).length || 0;
              return (
                <div key={key} className="p-3 rounded-lg border border-border">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold">{val.label}</p>
                    <Badge variant="secondary" className="text-xs">{count}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{val.desc}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Consent records */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registro de Consentimentos</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
          ) : !consents || consents.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhum consentimento registrado.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="py-2 px-3 font-semibold text-muted-foreground">Data</th>
                    <th className="py-2 px-3 font-semibold text-muted-foreground">Tipo</th>
                    <th className="py-2 px-3 font-semibold text-muted-foreground">Titular</th>
                    <th className="py-2 px-3 font-semibold text-muted-foreground">Status</th>
                    <th className="py-2 px-3 font-semibold text-muted-foreground">Anonimizado</th>
                    <th className="py-2 px-3 font-semibold text-muted-foreground">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {consents.slice(0, 50).map((c) => {
                    const type = CONSENT_TYPES[c.consent_type]?.label || c.consent_type;
                    return (
                      <tr key={c.id} className="border-b border-border hover:bg-muted/30">
                        <td className="py-2 px-3 text-xs text-muted-foreground whitespace-nowrap">
                          {c.consent_date ? new Date(c.consent_date).toLocaleString("pt-BR") : "—"}
                        </td>
                        <td className="py-2 px-3 text-xs">{type}</td>
                        <td className="py-2 px-3 text-xs">
                          {c.lead_nome || "—"}
                          {c.lead_documento && (
                            <span className="text-muted-foreground ml-1">({c.lead_documento})</span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          {c.withdrawal_date ? (
                            <Badge variant="destructive" className="text-xs">Revogado</Badge>
                          ) : c.consent_given ? (
                            <Badge className="bg-green-500/10 text-green-600 text-xs">Concedido</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">Negado</Badge>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          {c.anonymized ? (
                            <Badge className="bg-blue-500/10 text-blue-600 text-xs">Sim</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-xs text-muted-foreground font-mono">{c.ip_address || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rights of data subjects */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Direitos do Titular dos Dados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-start gap-3 p-3 rounded-lg border border-border">
              <Download className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold">Exportação de Dados</p>
                <p className="text-xs text-muted-foreground">
                  O titular pode solicitar a exportação de todos os seus dados em formato estruturado.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg border border-border">
              <UserX className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold">Direito ao Esquecimento</p>
                <p className="text-xs text-muted-foreground">
                  Anonimização ou exclusão de dados pessoais mediante solicitação do titular.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg border border-border">
              <Eye className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold">Direito de Acesso</p>
                <p className="text-xs text-muted-foreground">
                  O titular pode visualizar todos os dados que possuímos sobre ele.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg border border-border">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold">Retificação</p>
                <p className="text-xs text-muted-foreground">
                  O titular pode corrigir dados incompletos ou inexatos.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}