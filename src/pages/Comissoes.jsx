import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DollarSign, CheckCircle } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";

export default function Comissoes() {
  const queryClient = useQueryClient();

  const { data: comissoes = [], isLoading } = useQuery({
    queryKey: ["comissoes"],
    queryFn: () => base44.entities.Comissao.list("-created_date", 200),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id }) => base44.entities.Comissao.update(id, { status: "pago" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["comissoes"] }),
  });

  const totalPendente = comissoes.filter(c => c.status === "a_receber").reduce((s, c) => s + (c.valor || 0), 0);
  const totalPago = comissoes.filter(c => c.status === "pago").reduce((s, c) => s + (c.valor || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Comissões</h1>
        <p className="text-muted-foreground mt-1">Gestão de comissionamento</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="A Receber" value={`R$ ${totalPendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} icon={DollarSign} />
        <StatCard title="Já Pago" value={`R$ ${totalPago.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} icon={CheckCircle} />
        <StatCard title="Total" value={`R$ ${(totalPendente + totalPago).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} icon={DollarSign} />
      </div>

      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Vendedor</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Cliente</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Plano</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Valor</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">Carregando...</td></tr>
              ) : comissoes.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">Nenhuma comissão</td></tr>
              ) : comissoes.map(c => (
                <tr key={c.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-4 font-medium">{c.vendedor_nome || "—"}</td>
                  <td className="py-3 px-4 text-muted-foreground">{c.lead_nome || "—"}</td>
                  <td className="py-3 px-4 text-muted-foreground">{c.plano_nome || "—"}</td>
                  <td className="py-3 px-4 text-right font-medium">R$ {(c.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                  <td className="py-3 px-4">
                    <Badge variant="outline" className={c.status === "pago" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}>
                      {c.status === "pago" ? "Pago" : "A Receber"}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    {c.status === "a_receber" && (
                      <Button size="sm" variant="outline" className="text-xs rounded-lg" onClick={() => updateMutation.mutate({ id: c.id })}>
                        Marcar Pago
                      </Button>
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