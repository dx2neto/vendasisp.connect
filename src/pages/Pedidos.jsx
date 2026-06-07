import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Plus, Search, ChevronRight } from "lucide-react";
import PedidoAcoes from "@/components/pedidos/PedidoAcoes";

const STATUS_LABELS = {
  novo: "Novo", analise_credito: "Crédito", viabilidade: "Viabilidade",
  contrato_pendente: "Contrato", assinado: "Assinado", ativado: "Ativado", recusado: "Recusado"
};
const STATUS_COLORS = {
  novo: "bg-blue-50 text-blue-600", analise_credito: "bg-amber-50 text-amber-600",
  viabilidade: "bg-purple-50 text-purple-600", contrato_pendente: "bg-cyan-50 text-cyan-600",
  assinado: "bg-teal-50 text-teal-600", ativado: "bg-emerald-50 text-emerald-600", recusado: "bg-red-50 text-red-500"
};

export default function Pedidos() {
  const [showForm, setShowForm] = useState(false);
  const [selectedPedido, setSelectedPedido] = useState(null);
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ["pedidos"],
    queryFn: () => base44.entities.Pedido.list("-created_date", 200),
  });
  const { data: leads = [] } = useQuery({
    queryKey: ["leads"],
    queryFn: () => base44.entities.Lead.list("-created_date", 500),
  });
  const { data: planos = [] } = useQuery({
    queryKey: ["planos"],
    queryFn: () => base44.entities.Plano.list(),
  });

  const [form, setForm] = useState({ lead_id: "", plano_id: "" });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Pedido.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["pedidos"] }); setShowForm(false); },
  });

  const handleCreate = () => {
    const lead = leads.find(l => l.id === form.lead_id);
    const plano = planos.find(p => p.id === form.plano_id);
    if (!lead) return;
    createMutation.mutate({
      lead_id: lead.id, lead_nome: lead.nome, lead_cpf: lead.cnpj_cpf,
      plano_id: plano?.id || "", plano_nome: plano?.nome || "",
      valor: plano?.preco_mensal || 0, canal_origem: lead.canal_origem, status: "novo",
    });
  };

  const filtered = pedidos.filter(p =>
    !search || p.lead_nome?.toLowerCase().includes(search.toLowerCase()) || p.lead_cpf?.includes(search)
  );

  // Lead do pedido selecionado
  const selectedLead = selectedPedido?.lead_id
    ? leads.find(l => l.id === selectedPedido.lead_id)
    : null;

  return (
    <div className="space-y-4 pb-20 sm:pb-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Pedidos</h1>
          <p className="text-muted-foreground mt-1 text-sm">{pedidos.length} pedidos</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2 rounded-xl w-full sm:w-auto">
          <Plus className="w-4 h-4" /> Novo
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Nome ou CPF..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 rounded-xl text-sm" />
      </div>

      {/* Mobile Cards */}
      <div className="block sm:hidden space-y-3">
        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground text-sm">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">Nenhum pedido</div>
        ) : filtered.map(p => (
          <div key={p.id} className="bg-card border border-border rounded-xl p-4 cursor-pointer" onClick={() => setSelectedPedido(p)}>
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="font-semibold text-sm">{p.lead_nome}</p>
                <p className="text-xs text-muted-foreground font-mono">{p.lead_cpf}</p>
              </div>
              <Badge variant="outline" className={`text-xs ${STATUS_COLORS[p.status] || ""}`}>
                {STATUS_LABELS[p.status] || p.status}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-muted-foreground">Plano</p>
                <p className="font-medium">{p.plano_nome || "—"}</p>
              </div>
              <div className="text-right">
                <p className="text-muted-foreground">Valor</p>
                <p className="font-semibold">{p.valor ? `R$ ${p.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}</p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
              {p.vendedor_nome && <p>{p.vendedor_nome}</p>}
              {p.sincronizado_ixc && <Badge className="mt-2 text-[10px] bg-emerald-50 text-emerald-600">Sincronizado</Badge>}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table */}
      <div className="hidden sm:block rounded-2xl bg-card border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Cliente</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Plano</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Valor</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Vendedor</th>
                <th className="text-center py-3 px-4 font-medium text-muted-foreground">IXC</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">Nenhum pedido</td></tr>
              ) : filtered.map(p => (
                <tr key={p.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setSelectedPedido(p)}>
                  <td className="py-3 px-4">
                    <p className="font-medium">{p.lead_nome}</p>
                    <p className="text-xs text-muted-foreground font-mono">{p.lead_cpf}</p>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">{p.plano_nome || "—"}</td>
                  <td className="py-3 px-4 text-right font-medium">
                    {p.valor ? `R$ ${p.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant="outline" className={`text-xs ${STATUS_COLORS[p.status] || ""}`}>
                      {STATUS_LABELS[p.status] || p.status}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground text-xs">{p.vendedor_nome || "—"}</td>
                  <td className="py-3 px-4 text-center">
                    {p.sincronizado_ixc ? (
                      <Badge className="text-[10px] bg-emerald-50 text-emerald-600" variant="outline">Sync</Badge>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sheet lateral com ações do pedido */}
      <Sheet open={!!selectedPedido} onOpenChange={() => setSelectedPedido(null)}>
        <SheetContent className="w-full sm:w-[420px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Pedido — {selectedPedido?.lead_nome}</SheetTitle>
          </SheetHeader>
          {selectedPedido && (
            <div className="mt-6 space-y-5">
              {/* Resumo */}
              <div className="rounded-xl bg-muted/50 border border-border p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">CPF/CNPJ</span><span className="font-mono">{selectedPedido.lead_cpf || "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Plano</span><span>{selectedPedido.plano_nome || "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Valor</span><span className="font-semibold">R$ {(selectedPedido.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Vendedor</span><span>{selectedPedido.vendedor_nome || "—"}</span></div>
                {selectedPedido.revendedor_nome && <div className="flex justify-between"><span className="text-muted-foreground">Revendedor</span><span>{selectedPedido.revendedor_nome}</span></div>}
                <div className="flex justify-between items-center"><span className="text-muted-foreground">Status</span>
                  <Badge variant="outline" className={`text-xs ${STATUS_COLORS[selectedPedido.status] || ""}`}>
                    {STATUS_LABELS[selectedPedido.status] || selectedPedido.status}
                  </Badge>
                </div>
              </div>

              {/* Ações integração */}
              <div>
                <p className="text-sm font-semibold mb-3">Ações de Integração</p>
                <PedidoAcoes
                  pedido={selectedPedido}
                  lead={selectedLead}
                />
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Modal novo pedido */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader><DialogTitle>Novo Pedido</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Lead *</Label>
              <Select value={form.lead_id} onValueChange={v => setForm(f => ({ ...f, lead_id: v }))}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione o lead" /></SelectTrigger>
                <SelectContent>
                  {leads.map(l => <SelectItem key={l.id} value={l.id}>{l.nome} — {l.cnpj_cpf}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Plano</Label>
              <Select value={form.plano_id} onValueChange={v => setForm(f => ({ ...f, plano_id: v }))}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione o plano" /></SelectTrigger>
                <SelectContent>
                  {planos.filter(p => p.ativo !== false).map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.nome} — {p.velocidade_mbps}Mbps — R${p.preco_mensal}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleCreate} disabled={!form.lead_id || createMutation.isPending} className="rounded-xl">
                {createMutation.isPending ? "Criando..." : "Criar Pedido"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}