import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Zap } from "lucide-react";

export default function NovaVendaRevendedorModal({ open, onClose, revendedorId, revendedorNome, onSuccess }) {
  const [form, setForm] = useState({
    lead_nome: "", lead_cpf: "", plano_nome: "", plano_id: "",
    valor: "", telefone: "", email: "", observacao: ""
  });

  const { data: planos = [] } = useQuery({
    queryKey: ["planos"],
    queryFn: () => base44.entities.Plano.filter({ ativo: true }),
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: () => {
      const pedidoData = {
        lead_nome: form.lead_nome,
        lead_cpf: form.lead_cpf,
        plano_nome: form.plano_nome,
        plano_id: form.plano_id,
        valor: parseFloat(form.valor) || 0,
        revendedor_id: revendedorId,
        revendedor_nome: revendedorNome,
        canal_origem: "revenda",
        status: "novo",
        observacao: form.observacao,
      };
      return base44.entities.Pedido.create(pedidoData);
    },
    onSuccess: () => {
      setForm({ lead_nome: "", lead_cpf: "", plano_nome: "", plano_id: "", valor: "", telefone: "", email: "", observacao: "" });
      onSuccess?.();
      onClose();
    },
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Plus className="w-5 h-5 text-amber-500" />
            Lançar Nova Venda
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Revendedor */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-sm">
            <span className="text-amber-600 font-semibold">Revendedor: </span>
            <span className="text-amber-700">{revendedorNome}</span>
          </div>

          {/* Cliente */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nome do Cliente *</label>
              <Input
                placeholder="Nome completo"
                value={form.lead_nome}
                onChange={e => set("lead_nome", e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">CPF / CNPJ</label>
                <Input
                  placeholder="000.000.000-00"
                  value={form.lead_cpf}
                  onChange={e => set("lead_cpf", e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Telefone</label>
                <Input
                  placeholder="(64) 99999-9999"
                  value={form.telefone}
                  onChange={e => set("telefone", e.target.value)}
                  className="rounded-xl"
                />
              </div>
            </div>
          </div>

          {/* Plano */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Plano *</label>
            <select
              className="w-full h-9 rounded-xl border border-input bg-transparent px-3 text-sm"
              value={form.plano_id}
              onChange={e => {
                const p = planos.find(p => p.id === e.target.value);
                set("plano_id", e.target.value);
                if (p) {
                  set("plano_nome", p.nome);
                  set("valor", String(p.preco_mensal || ""));
                }
              }}
            >
              <option value="">Selecione um plano...</option>
              {planos.map(p => (
                <option key={p.id} value={p.id}>
                  {p.nome} — R$ {(p.preco_mensal || 0).toFixed(2)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Valor Mensal (R$)</label>
            <Input
              type="number"
              placeholder="0,00"
              value={form.valor}
              onChange={e => set("valor", e.target.value)}
              className="rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Observação</label>
            <Input
              placeholder="Opcional..."
              value={form.observacao}
              onChange={e => set("observacao", e.target.value)}
              className="rounded-xl"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              className="flex-1 rounded-xl gap-2 bg-amber-500 hover:bg-amber-600 text-white"
              disabled={!form.lead_nome || !form.plano_nome || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending
                ? <><Zap className="w-4 h-4 animate-pulse" />Salvando...</>
                : <><Plus className="w-4 h-4" />Lançar Venda</>
              }
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}