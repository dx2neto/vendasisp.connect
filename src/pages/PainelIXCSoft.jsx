import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, XCircle, AlertCircle, Clock, Database, FileText, Users, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function PainelIXCSoft() {
  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ["pedidos-ixc"],
    queryFn: () => base44.entities.Pedido.list("-updated_date", 500),
  });

  const { data: syncQueue = [] } = useQuery({
    queryKey: ["sync-queue"],
    queryFn: () => base44.entities.SyncQueue.list("-created_date", 100),
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["integration-logs-ixc"],
    queryFn: () => base44.entities.IntegrationLog.filter({ service: "ixc" }),
  });

  const { data: planos = [] } = useQuery({
    queryKey: ["planos-ixc"],
    queryFn: () => base44.entities.Plano.list(),
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ["usuarios-ixc"],
    queryFn: () => base44.entities.User.list(),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const sincronizados = pedidos.filter(p => p.sincronizado_ixc).length;
  const comErro = pedidos.filter(p => p.integration_status === "error").length;
  const pendentes = pedidos.filter(p => !p.sincronizado_ixc && p.status === "assinado").length;
  const planosVinculados = planos.filter(p => p.id_modelo_ixc).length;
  const planosSemVinculo = planos.length - planosVinculados;
  const vendedoresCRM = usuarios.filter(u => u.role === "vendedor" || u.role === "gerente");
  const vendedoresVinculados = vendedoresCRM.filter(u => u.id_vendedor_ixc).length;
  const vendedoresSemVinculo = vendedoresCRM.length - vendedoresVinculados;

  const queueAguardando = syncQueue.filter(q => q.status === "aguardando" || q.status === "aguardando_correcao").length;
  const queueProcessando = syncQueue.filter(q => q.status === "processando").length;
  const queueConcluido = syncQueue.filter(q => q.status === "concluido").length;
  const queueErro = syncQueue.filter(q => q.status === "erro").length;

  const ultimosLogs = logs.slice(0, 15);
  const falhasPorEndpoint = logs.filter(l => !l.ok).reduce((acc, l) => {
    const ep = l.step || "desconhecido";
    acc[ep] = (acc[ep] || 0) + 1;
    return acc;
  }, {});

  const stats = [
    { label: "Pedidos Sincronizados", value: sincronizados, icon: CheckCircle, color: "text-emerald-600 bg-emerald-50" },
    { label: "Pendentes de Ativação", value: pendentes, icon: Clock, color: "text-amber-600 bg-amber-50" },
    { label: "Com Erro de Integração", value: comErro, icon: XCircle, color: "text-red-600 bg-red-50" },
    { label: "Fila Aguardando", value: queueAguardando, icon: AlertCircle, color: "text-orange-600 bg-orange-50" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Painel IXCSoft</h1>
        <p className="text-muted-foreground mt-0.5 text-sm">Monitoramento da sincronização com IXCSoft</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <Card key={s.label} className="rounded-2xl border border-border p-4">
            <div className="flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", s.color)}>
                <s.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <p className="text-xl font-bold">{s.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Planos e Vendedores */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="rounded-2xl border border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="w-4 h-4" /> Planos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Vinculados ao IXC</span>
              <Badge className="bg-emerald-50 text-emerald-600 border border-emerald-200">{planosVinculados}</Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Sem vínculo</span>
              <Badge className="bg-amber-50 text-amber-600 border border-amber-200">{planosSemVinculo}</Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total</span>
              <span className="font-medium">{planos.length}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" /> Vendedores
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Vinculados ao IXC</span>
              <Badge className="bg-emerald-50 text-emerald-600 border border-emerald-200">{vendedoresVinculados}</Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Sem vínculo</span>
              <Badge className="bg-amber-50 text-amber-600 border border-amber-200">{vendedoresSemVinculo}</Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total</span>
              <span className="font-medium">{vendedoresCRM.length}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fila de Sincronização */}
      <Card className="rounded-2xl border border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Fila de Sincronização
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3">
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-600">{queueAguardando}</p>
              <p className="text-xs text-muted-foreground">Aguardando</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{queueProcessando}</p>
              <p className="text-xs text-muted-foreground">Processando</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-emerald-600">{queueConcluido}</p>
              <p className="text-xs text-muted-foreground">Concluído</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{queueErro}</p>
              <p className="text-xs text-muted-foreground">Com Erro</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Falhas por endpoint */}
      {Object.keys(falhasPorEndpoint).length > 0 && (
        <Card className="rounded-2xl border border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500" /> Falhas por Endpoint
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(falhasPorEndpoint).map(([ep, count]) => (
                <div key={ep} className="flex justify-between text-sm">
                  <span className="font-mono text-xs">{ep}</span>
                  <Badge variant="destructive" className="text-xs">{count} falha(s)</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Últimos logs */}
      <Card className="rounded-2xl border border-border">
        <CardHeader className="pb-3 border-b border-border/50">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4" /> Últimas Integrações
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {ultimosLogs.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">Nenhuma atividade registrada</div>
          ) : (
            <div className="space-y-3">
              {ultimosLogs.map(log => (
                <div key={log.id} className="flex items-center gap-3 pb-3 border-b border-border/30 last:border-0 last:pb-0">
                  <div className={cn("w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0",
                    log.ok ? "bg-emerald-50" : "bg-red-50"
                  )}>
                    {log.ok ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : <XCircle className="w-3.5 h-3.5 text-red-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{log.step}</p>
                    <p className="text-xs text-muted-foreground truncate">Pedido: {log.pedido_id}</p>
                  </div>
                  {log.created_date && (
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {format(new Date(log.created_date), "dd/MM HH:mm", { locale: ptBR })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}