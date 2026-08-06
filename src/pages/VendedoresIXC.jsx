import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, RefreshCw, Link2, Unlink, Users, AlertCircle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

export default function VendedoresIXC() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [syncing, setSyncing] = useState(false);

  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ["usuarios"],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: vendedoresIXC = [], isLoading: loadingIXC } = useQuery({
    queryKey: ["vendedores-ixc"],
    queryFn: async () => {
      const res = await base44.functions.invoke("sincronizarIXC", { tipo: "vendedores" });
      return res.data?.vendedores || [];
    },
  });

  const { mutate: vincular, isPending: vinculando } = useMutation({
    mutationFn: ({ userId, vendedorIXC }) =>
      base44.entities.User.update(userId, {
        id_vendedor_ixc: String(vendedorIXC.id),
        nome_vendedor_ixc: vendedorIXC.nome,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
      toast({ title: "Vínculo criado", description: "Vendedor vinculado com sucesso." });
    },
  });

  const { mutate: desvincular, isPending: desvinculando } = useMutation({
    mutationFn: (userId) => base44.entities.User.update(userId, { id_vendedor_ixc: "", nome_vendedor_ixc: "" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
      toast({ title: "Vínculo removido" });
    },
  });

  const syncAll = async () => {
    setSyncing(true);
    try {
      const res = await base44.functions.invoke("sincronizarIXC", { tipo: "sync_vendedores" });
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
      queryClient.invalidateQueries({ queryKey: ["vendedores-ixc"] });
      toast({
        title: "Sincronização concluída",
        description: `${res.data?.vinculados || 0} vinculados, ${res.data?.sem_correspondencia || 0} sem correspondência.`,
      });
    } catch (e) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const vendedoresCRM = usuarios.filter(u => u.role === "vendedor" || u.role === "gerente");
  const vinculadosCount = vendedoresCRM.filter(u => u.id_vendedor_ixc).length;
  const pendentesCount = vendedoresCRM.length - vinculadosCount;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vendedores IXCSoft</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">Vincule vendedores do CRM com o IXCSoft</p>
        </div>
        <Button onClick={syncAll} disabled={syncing} className="gap-2 rounded-xl">
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Sincronizar
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="rounded-2xl border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total CRM</p>
              <p className="text-xl font-bold">{vendedoresCRM.length}</p>
            </div>
          </div>
        </Card>
        <Card className="rounded-2xl border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Vinculados</p>
              <p className="text-xl font-bold">{vinculadosCount}</p>
            </div>
          </div>
        </Card>
        <Card className="rounded-2xl border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pendentes</p>
              <p className="text-xl font-bold">{pendentesCount}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Usuário CRM</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Papel</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Vendedor IXC</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">ID IXC</th>
                <th className="text-center py-3 px-4 font-medium text-muted-foreground">Status</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">Carregando...</td></tr>
              ) : vendedoresCRM.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">Nenhum vendedor cadastrado</td></tr>
              ) : vendedoresCRM.map(u => (
                <tr key={u.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-3 px-4 font-medium">{u.full_name || u.email}</td>
                  <td className="py-3 px-4">
                    <Badge variant="outline" className="text-xs">{u.role}</Badge>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">{u.nome_vendedor_ixc || "—"}</td>
                  <td className="py-3 px-4 font-mono text-xs">{u.id_vendedor_ixc || "—"}</td>
                  <td className="py-3 px-4 text-center">
                    {u.id_vendedor_ixc ? (
                      <Badge className="text-xs bg-emerald-50 text-emerald-600 border border-emerald-200">Vinculado</Badge>
                    ) : (
                      <Badge className="text-xs bg-amber-50 text-amber-600 border border-amber-200">Pendente</Badge>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex justify-end gap-2">
                      {u.id_vendedor_ixc ? (
                        <Button
                          size="sm" variant="outline" className="rounded-lg gap-1.5 h-8"
                          disabled={desvinculando}
                          onClick={() => desvincular(u.id)}
                        >
                          <Unlink className="w-3.5 h-3.5" /> Desvincular
                        </Button>
                      ) : (
                        <select
                          className="text-xs rounded-lg border border-border px-2 py-1.5 bg-background"
                          defaultValue=""
                          onChange={(e) => {
                            const v = vendedoresIXC.find(vx => String(vx.id) === e.target.value);
                            if (v) vincular({ userId: u.id, vendedorIXC: v });
                          }}
                        >
                          <option value="" disabled>Vincular...</option>
                          {vendedoresIXC.filter(v => v.status === "A").map(v => (
                            <option key={v.id} value={v.id}>{v.nome} (#{v.id})</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}