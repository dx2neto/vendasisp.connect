import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import {
  Wrench, CheckCircle2, Circle, MapPin, Calendar, Camera, Wifi,
  Gauge, Router, FileText, Save, Send
} from "lucide-react";

const STATUS_LABELS = {
  agendado: { label: "Agendado", cor: "bg-blue-50 text-blue-600 border-blue-200" },
  em_andamento: { label: "Em Andamento", cor: "bg-amber-50 text-amber-600 border-amber-200" },
  concluido: { label: "Concluído", cor: "bg-emerald-50 text-emerald-600 border-emerald-200" },
  cancelado: { label: "Cancelado", cor: "bg-red-50 text-red-600 border-red-200" },
};

function ChecklistItem({ checked, onChange, label, icon: Icon }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "flex items-center gap-3 w-full p-3 rounded-xl border transition-all text-left",
        checked ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
      )}
    >
      {checked ? (
        <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
      ) : (
        <Circle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
      )}
      {Icon && <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
      <span className={cn("text-sm font-medium", checked && "text-primary")}>{label}</span>
    </button>
  );
}

function ChecklistForm({ checklist, onSave, saving }) {
  const [form, setForm] = useState(checklist?.itens || {});
  const [meta, setMeta] = useState({
    tecnico_nome: checklist?.tecnico_nome || "",
    data_agendada: checklist?.data_agendada || "",
    endereco_instalacao: checklist?.endereco_instalacao || "",
    cidade: checklist?.cidade || "",
  });

  const setItem = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setM = (k, v) => setMeta(m => ({ ...m, [k]: v }));

  const camposObrigatorios = [
    "chegada_cliente", "confirmacao_endereco", "cto_identificada",
    "drop_instalado", "autenticacao_testada", "velocidade_testada", "aceite_cliente",
  ];
  const preenchido = camposObrigatorios.every(k => form[k]);
  const status = preenchido ? "concluido" : "em_andamento";

  const handleSave = () => {
    onSave({
      itens: { ...form, pode_concluir: preenchido },
      ...meta,
      status,
      data_concluida: preenchido ? new Date().toISOString() : null,
    });
  };

  return (
    <div className="space-y-5">
      {/* Dados do agendamento */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" /> Dados do Agendamento
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Técnico</label>
            <Input value={meta.tecnico_nome} onChange={e => setM("tecnico_nome", e.target.value)} placeholder="Nome do técnico" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Data Agendada</label>
            <Input type="datetime-local" value={meta.data_agendada ? meta.data_agendada.slice(0, 16) : ""} onChange={e => setM("data_agendada", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Endereço de Instalação</label>
            <Input value={meta.endereco_instalacao} onChange={e => setM("endereco_instalacao", e.target.value)} placeholder="Rua, número, bairro" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Cidade</label>
            <Input value={meta.cidade} onChange={e => setM("cidade", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Checklist de campo */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Wrench className="w-4 h-4 text-primary" /> Checklist Técnico
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Checagens binárias */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <ChecklistItem checked={!!form.chegada_cliente} onChange={v => setItem("chegada_cliente", v)} label="Chegada ao cliente" icon={MapPin} />
            <ChecklistItem checked={!!form.confirmacao_endereco} onChange={v => setItem("confirmacao_endereco", v)} label="Confirmação de endereço" icon={CheckCircle2} />
            <ChecklistItem checked={!!form.cto_identificada} onChange={v => setItem("cto_identificada", v)} label="CTO identificada" icon={Wifi} />
            <ChecklistItem checked={!!form.olt_identificada} onChange={v => setItem("olt_identificada", v)} label="OLT identificada" icon={Wifi} />
            <ChecklistItem checked={!!form.drop_instalado} onChange={v => setItem("drop_instalado", v)} label="Drop instalado" icon={Wrench} />
            <ChecklistItem checked={!!form.autenticacao_testada} onChange={v => setItem("autenticacao_testada", v)} label="Autenticação testada" icon={CheckCircle2} />
            <ChecklistItem checked={!!form.velocidade_testada} onChange={v => setItem("velocidade_testada", v)} label="Velocidade testada" icon={Gauge} />
            <ChecklistItem checked={!!form.aceite_cliente} onChange={v => setItem("aceite_cliente", v)} label="Aceite do cliente" icon={CheckCircle2} />
          </div>

          {/* Campos de texto/number */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Número da CTO</label>
              <Input value={form.cto_numero || ""} onChange={e => setItem("cto_numero", e.target.value)} placeholder="Ex: CTO-012" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Porta da CTO</label>
              <Input value={form.porta_cto || ""} onChange={e => setItem("porta_cto", e.target.value)} placeholder="Ex: 04" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Sinal Óptico (dBm)</label>
              <Input value={form.sinal_optico_dbm || ""} onChange={e => setItem("sinal_optico_dbm", e.target.value)} placeholder="Ex: -22.5" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Metragem do Drop (m)</label>
              <Input type="number" value={form.metragem_drop || ""} onChange={e => setItem("metragem_drop", Number(e.target.value))} placeholder="Ex: 85" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Serial da ONT</label>
              <Input value={form.ont_serial || ""} onChange={e => setItem("ont_serial", e.target.value)} placeholder="Ex: GPON12345678" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">MAC da ONT</label>
              <Input value={form.ont_mac || ""} onChange={e => setItem("ont_mac", e.target.value)} placeholder="00:00:00:00:00:00" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Modelo do Roteador</label>
              <Input value={form.roteador_modelo || ""} onChange={e => setItem("roteador_modelo", e.target.value)} placeholder="Ex: TP-Link AX1500" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">MAC do Roteador</label>
              <Input value={form.roteador_mac || ""} onChange={e => setItem("roteador_mac", e.target.value)} placeholder="00:00:00:00:00:00" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">SSID do Wi-Fi</label>
              <Input value={form.wifi_ssid || ""} onChange={e => setItem("wifi_ssid", e.target.value)} placeholder="Nome da rede" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Senha do Wi-Fi</label>
              <Input value={form.wifi_senha || ""} onChange={e => setItem("wifi_senha", e.target.value)} placeholder="Senha da rede" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Velocidade de Download (Mbps)</label>
              <Input type="number" value={form.velocidade_download_mbps || ""} onChange={e => setItem("velocidade_download_mbps", Number(e.target.value))} placeholder="Ex: 300" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Velocidade de Upload (Mbps)</label>
              <Input type="number" value={form.velocidade_upload_mbps || ""} onChange={e => setItem("velocidade_upload_mbps", Number(e.target.value))} placeholder="Ex: 150" />
            </div>
          </div>

          {/* Observações */}
          <div className="pt-2 border-t">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Observações</label>
            <Textarea value={form.observacoes || ""} onChange={e => setItem("observacoes", e.target.value)} rows={3} placeholder="Anotações técnicas adicionais..." />
          </div>

          {/* Status de validação */}
          <div className={cn(
            "flex items-center gap-2 p-3 rounded-xl text-sm font-medium",
            preenchido ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
          )}>
            {preenchido ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
            {preenchido ? "Checklist completo! Pronto para concluir a instalação." : "Preencha todos os campos obrigatórios para concluir."}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 gap-2" onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4" /> Salvar Parcial
            </Button>
            <Button className="flex-1 gap-2" onClick={handleSave} disabled={saving || !preenchido}>
              <Send className="w-4 h-4" /> {preenchido ? "Concluir Instalação" : "Pendências"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ChecklistInstalacaoPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState(null);

  const { data: checklists = [], isLoading } = useQuery({
    queryKey: ["checklists-instalacao"],
    queryFn: () => base44.entities.ChecklistInstalacao.list("-created_date", 100),
  });

  const { data: pedidos = [] } = useQuery({
    queryKey: ["pedidos-checklist"],
    queryFn: () => base44.entities.Pedido.list("-created_date", 100),
  });

  const mutation = useMutation({
    mutationFn: ({ id, data }) => {
      if (id) return base44.entities.ChecklistInstalacao.update(id, data);
      return base44.entities.ChecklistInstalacao.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklists-instalacao"] });
      toast({ title: "Checklist salvo!", description: "As informações foram registradas com sucesso." });
      setSelectedId(null);
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível salvar o checklist.", variant: "destructive" });
    },
  });

  const selected = checklists.find(c => c.id === selectedId);
  const pedidoDoChecklist = selected ? pedidos.find(p => p.id === selected.pedido_id) : null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Checklist de Instalação</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">Gerencie os checklists técnicos das instalações</p>
        </div>
        <Button onClick={() => setSelectedId("novo")}>
          <Wrench className="w-4 h-4 mr-1" /> Novo Checklist
        </Button>
      </div>

      {selectedId ? (
        <ChecklistForm
          checklist={selectedId === "novo" ? null : selected}
          onSave={(data) => mutation.mutate({ id: selectedId === "novo" ? null : selectedId, data })}
          saving={mutation.isPending}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="py-10 text-center">
                <div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" />
              </div>
            ) : checklists.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Wrench className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhum checklist criado ainda.</p>
                <Button size="sm" className="mt-3" onClick={() => setSelectedId("novo")}>
                  Criar primeiro checklist
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {checklists.map((c) => {
                  const pedido = pedidos.find(p => p.id === c.pedido_id);
                  const statusInfo = STATUS_LABELS[c.status] || STATUS_LABELS.agendado;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      className="flex items-center justify-between w-full px-5 py-3.5 hover:bg-muted/20 transition-colors text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">
                          {pedido?.lead_nome || c.endereco_instalacao || `Pedido ${c.pedido_id?.slice(0, 8)}`}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {c.tecnico_nome || "Sem técnico"} • {c.cidade || ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 ml-3">
                        <Badge variant="outline" className={cn("text-xs", statusInfo.cor)}>
                          {statusInfo.label}
                        </Badge>
                        {c.itens?.pode_concluir && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}