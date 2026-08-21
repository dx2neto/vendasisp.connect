import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import {
  CheckCircle2, Circle, Wifi, MapPin, Gauge, Cable,
  Router, Save, ShieldCheck, AlertTriangle, Loader2
} from "lucide-react";

const CAMPOS_OBRIGATORIOS = [
  "viabilidade_confirmada",
  "cto_identificada",
  "porta_disponivel",
  "sinal_adequado",
  "drop_viavel",
];

function CheckItem({ checked, onChange, label, icon: Icon, hint }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "flex items-start gap-3 w-full p-3 rounded-xl border transition-all text-left",
        checked ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
      )}
    >
      {checked ? (
        <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
      ) : (
        <Circle className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
      )}
      {Icon && <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />}
      <div className="flex-1 min-w-0">
        <span className={cn("text-sm font-medium block", checked && "text-primary")}>{label}</span>
        {hint && <span className="text-xs text-muted-foreground block mt-0.5">{hint}</span>}
      </div>
    </button>
  );
}

export default function ChecklistViabilidade({ pedido }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({});
  const [observacao, setObservacao] = useState("");

  // Busca checklist existente para este pedido
  const { data: checklists = [], isLoading } = useQuery({
    queryKey: ["checklist-pedido", pedido?.id],
    queryFn: () => base44.entities.ChecklistInstalacao.filter({ pedido_id: pedido.id }),
    enabled: !!pedido?.id,
  });

  const checklistExistente = checklists[0];

  useEffect(() => {
    if (checklistExistente?.itens) {
      setForm(checklistExistente.itens);
    } else {
      setForm({});
    }
    setObservacao(checklistExistente?.itens?.observacoes || "");
  }, [checklistExistente]);

  const setItem = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const preenchido = CAMPOS_OBRIGATORIOS.every(k => form[k]);

  const mutation = useMutation({
    mutationFn: ({ id, data }) => {
      if (id) return base44.entities.ChecklistInstalacao.update(id, data);
      return base44.entities.ChecklistInstalacao.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist-pedido", pedido.id] });
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      toast({ title: "Checklist salvo!", description: "As informações de viabilidade foram registradas." });
    },
    onError: () => toast({ title: "Erro", description: "Não foi possível salvar o checklist.", variant: "destructive" }),
  });

  const avancarMutation = useMutation({
    mutationFn: async () => {
      // Salva o checklist e avança o pedido para contrato_pendente
      const data = {
        pedido_id: pedido.id,
        itens: {
          ...form,
          observacoes: observacao,
          pode_concluir: preenchido,
        },
        status: "concluido",
        data_concluida: new Date().toISOString(),
        endereco_instalacao: pedido.install_address
          ? `${pedido.install_address.endereco || ""}, ${pedido.install_address.numero || ""} - ${pedido.install_address.bairro || ""}`
          : "",
        cidade: pedido.install_address?.cidade || "",
      };
      if (checklistExistente?.id) {
        await base44.entities.ChecklistInstalacao.update(checklistExistente.id, data);
      } else {
        await base44.entities.ChecklistInstalacao.create(data);
      }
      // Avança o pedido para contrato_pendente (assinatura)
      return base44.entities.Pedido.update(pedido.id, {
        status: "contrato_pendente",
        data_viabilidade: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist-pedido", pedido.id] });
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      toast({ title: "Viabilidade confirmada!", description: "Pedido avançado para assinatura do contrato." });
    },
    onError: () => toast({ title: "Erro", description: "Não foi possível avançar o pedido.", variant: "destructive" }),
  });

  const handleSave = () => {
    mutation.mutate({
      id: checklistExistente?.id || null,
      data: {
        pedido_id: pedido.id,
        itens: { ...form, observacoes: observacao, pode_concluir: preenchido },
        status: preenchido ? "concluido" : "em_andamento",
        endereco_instalacao: pedido.install_address
          ? `${pedido.install_address.endereco || ""}, ${pedido.install_address.numero || ""} - ${pedido.install_address.bairro || ""}`
          : "",
        cidade: pedido.install_address?.cidade || "",
      },
    });
  };

  const handleAvancar = () => {
    if (!preenchido) {
      toast({ title: "Pendências", description: "Preencha todos os campos obrigatórios.", variant: "destructive" });
      return;
    }
    avancarMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="py-8 text-center">
        <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Endereço */}
      {pedido.install_address && (
        <div className="rounded-xl bg-muted/50 border border-border p-3 flex items-start gap-2 text-sm">
          <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">{pedido.install_address.endereco}, {pedido.install_address.numero}</p>
            <p className="text-xs text-muted-foreground">
              {pedido.install_address.bairro} — {pedido.install_address.cidade}/{pedido.install_address.estado}
            </p>
          </div>
        </div>
      )}

      {/* Checklist de viabilidade de rede */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <CheckItem
          checked={!!form.viabilidade_confirmada}
          onChange={v => setItem("viabilidade_confirmada", v)}
          label="Viabilidade de rede confirmada"
          icon={ShieldCheck}
          hint="Verificou cobertura no endereço"
        />
        <CheckItem
          checked={!!form.cto_identificada}
          onChange={v => setItem("cto_identificada", v)}
          label="CTO identificada no mapa"
          icon={Wifi}
          hint="Poste/caixa de emenda com CTO"
        />
        <CheckItem
          checked={!!form.porta_disponivel}
          onChange={v => setItem("porta_disponivel", v)}
          label="Porta disponível na CTO"
          icon={Cable}
          hint="Há porta livre para conexão"
        />
        <CheckItem
          checked={!!form.sinal_adequado}
          onChange={v => setItem("sinal_adequado", v)}
          label="Sinal óptico adequado"
          icon={Gauge}
          hint="Sinal entre -8 e -28 dBm"
        />
        <CheckItem
          checked={!!form.drop_viavel}
          onChange={v => setItem("drop_viavel", v)}
          label="Instalação do drop viável"
          icon={Cable}
          hint="Caminho/metragem sem obstáculos"
        />
        <CheckItem
          checked={!!form.ont_disponivel}
          onChange={v => setItem("ont_disponivel", v)}
          label="ONT disponível em estoque"
          icon={Router}
          hint="Equipamento separado"
        />
      </div>

      {/* Campos técnicos */}
      <div className="grid grid-cols-2 gap-3 pt-2 border-t">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">CTO</label>
          <Input value={form.cto_numero || ""} onChange={e => setItem("cto_numero", e.target.value)} placeholder="Ex: CTO-012" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Porta CTO</label>
          <Input value={form.porta_cto || ""} onChange={e => setItem("porta_cto", e.target.value)} placeholder="Ex: 04" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Sinal (dBm)</label>
          <Input value={form.sinal_optico_dbm || ""} onChange={e => setItem("sinal_optico_dbm", e.target.value)} placeholder="Ex: -22.5" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Metragem Drop (m)</label>
          <Input type="number" value={form.metragem_drop || ""} onChange={e => setItem("metragem_drop", Number(e.target.value))} placeholder="Ex: 85" />
        </div>
      </div>

      {/* Observações */}
      <div className="pt-2 border-t">
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Observações técnicas</label>
        <textarea
          className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm resize-none"
          rows={2}
          value={observacao}
          onChange={e => setObservacao(e.target.value)}
          placeholder="Anotações sobre a viabilidade..."
        />
      </div>

      {/* Status de validação */}
      <div className={cn(
        "flex items-center gap-2 p-3 rounded-xl text-sm font-medium",
        preenchido ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
      )}>
        {preenchido ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
        {preenchido
          ? "Viabilidade confirmada! Pronto para avançar à assinatura."
          : "Preencha todos os campos obrigatórios para avançar."}
      </div>

      {/* Ações */}
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1 gap-2" onClick={handleSave} disabled={mutation.isPending}>
          <Save className="w-4 h-4" /> Salvar Parcial
        </Button>
        <Button
          className="flex-1 gap-2"
          onClick={handleAvancar}
          disabled={!preenchido || avancarMutation.isPending}
        >
          {avancarMutation.isPending ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Avançando...</>
          ) : (
            <><ShieldCheck className="w-4 h-4" /> Avançar p/ Assinatura</>
          )}
        </Button>
      </div>

      {checklistExistente && (
        <p className="text-xs text-muted-foreground text-center">
          Última atualização: {new Date(checklistExistente.updated_date || checklistExistente.created_date).toLocaleString("pt-BR")}
        </p>
      )}
    </div>
  );
}