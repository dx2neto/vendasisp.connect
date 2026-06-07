import { useQuery, useMutation } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, ExternalLink, RefreshCw, Zap } from "lucide-react";
import { toast } from "sonner";
import StatCard from "@/components/dashboard/StatCard";

const STATUS_LABELS = { gerado: "Gerado", enviado: "Enviado", assinado: "Assinado", arquivado: "Arquivado" };
const STATUS_COLORS = { gerado: "bg-blue-50 text-blue-600", enviado: "bg-amber-50 text-amber-600", assinado: "bg-emerald-50 text-emerald-600", arquivado: "bg-gray-50 text-gray-500" };

export default function Contratos() {
  const { data: contratos = [], isLoading, refetch } = useQuery({
    queryKey: ["contratos"],
    queryFn: () => base44.entities.Contrato.list("-created_date", 200),
  });

  const assinados = contratos.filter(c => c.status === "assinado").length;

  const testeMutation = useMutation({
    mutationFn: () => base44.functions.invoke("testarZapSign", {}),
    onSuccess: (res) => {
      toast.success(res.data.message);
    },
    onError: (error) => {
      toast.error("Erro ao testar ZapSign: " + error.message);
    },
  });

  const sincMutation = useMutation({
    mutationFn: () => base44.functions.invoke("sincronizarContratos", {}),
    onSuccess: (res) => {
      refetch();
      toast.success(`${res.data.sincronizados} contratos sincronizados`);
    },
    onError: (error) => {
      toast.error("Erro ao sincronizar: " + error.message);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contratos</h1>
          <p className="text-muted-foreground mt-1">Assinatura digital via ZapSign</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => testeMutation.mutate()}
            disabled={testeMutation.isPending}
            className="gap-2"
          >
            <Zap className="w-4 h-4" />
            {testeMutation.isPending ? "Testando..." : "Testar Conexão"}
          </Button>
          <Button 
            variant="outline"
            size="sm"
            onClick={() => sincMutation.mutate()}
            disabled={sincMutation.isPending}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${sincMutation.isPending ? "animate-spin" : ""}`} />
            {sincMutation.isPending ? "Sincronizando..." : "Sincronizar"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total" value={contratos.length} icon={FileText} />
        <StatCard title="Assinados" value={assinados} icon={FileText} />
        <StatCard title="Pendentes" value={contratos.length - assinados} icon={FileText} />
      </div>

      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Cliente</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Assinatura</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Data</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Link</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="py-12 text-center text-muted-foreground">Carregando...</td></tr>
              ) : contratos.length === 0 ? (
                <tr><td colSpan={5} className="py-12 text-center text-muted-foreground">Nenhum contrato</td></tr>
              ) : contratos.map(c => (
                <tr key={c.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-4 font-medium">{c.cliente_nome || "—"}</td>
                  <td className="py-3 px-4">
                    <Badge variant="outline" className={`text-xs ${STATUS_COLORS[c.status] || ""}`}>
                      {STATUS_LABELS[c.status] || c.status}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-xs text-muted-foreground">
                    {c.data_assinatura ? new Date(c.data_assinatura).toLocaleDateString("pt-BR") : "Pendente"}
                  </td>
                  <td className="py-3 px-4 text-xs text-muted-foreground">
                    {c.created_date ? new Date(c.created_date).toLocaleDateString("pt-BR") : "—"}
                  </td>
                  <td className="py-3 px-4">
                    {c.link_assinatura && (
                      <a href={c.link_assinatura} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="ghost" className="gap-1 text-xs">
                          <ExternalLink className="w-3 h-3" /> Abrir
                        </Button>
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}