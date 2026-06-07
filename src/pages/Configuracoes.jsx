import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Settings, Shield, Plug, Save } from "lucide-react";

export default function Configuracoes() {
  const queryClient = useQueryClient();

  const { data: configs = [] } = useQuery({
    queryKey: ["config"],
    queryFn: () => base44.entities.ConfigRegras.list(),
  });

  const config = configs[0] || {};

  const [form, setForm] = useState({
    score_minimo_credito: 400,
    probabilidade_maxima: 30,
    comissao_percentual_padrao: 5,
    comissao_revendedor_percentual: 8,
    id_filial_ixc: "1",
    id_vendedor_ixc_padrao: "1",
    id_assunto_os_ixc: "1",
    id_setor_os_ixc: "1",
    contribuinte_pf: "2",
    status_contrato_inicial: "P",
  });

  useEffect(() => {
    if (config.id) {
      setForm({
        score_minimo_credito: config.score_minimo_credito ?? 400,
        probabilidade_maxima: config.probabilidade_maxima ?? 30,
        comissao_percentual_padrao: config.comissao_percentual_padrao ?? 5,
        comissao_revendedor_percentual: config.comissao_revendedor_percentual ?? 8,
        id_filial_ixc: config.id_filial_ixc || "1",
        id_vendedor_ixc_padrao: config.id_vendedor_ixc_padrao || "1",
        id_assunto_os_ixc: config.id_assunto_os_ixc || "1",
        id_setor_os_ixc: config.id_setor_os_ixc || "1",
        contribuinte_pf: config.contribuinte_pf || "2",
        status_contrato_inicial: config.status_contrato_inicial || "P",
      });
    }
  }, [config.id]);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const saveMutation = useMutation({
    mutationFn: (data) =>
      config.id
        ? base44.entities.ConfigRegras.update(config.id, data)
        : base44.entities.ConfigRegras.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["config"] }),
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground mt-1">Regras de negócio e integração</p>
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Shield className="w-5 h-5 text-primary" /> Regras de Crédito</CardTitle>
          <CardDescription>Defina os critérios de aprovação automática</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Score Mínimo (0-1000)</Label>
              <Input type="number" value={form.score_minimo_credito} onChange={e => set("score_minimo_credito", Number(e.target.value))} className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Inadimplência Máxima (%)</Label>
              <Input type="number" value={form.probabilidade_maxima} onChange={e => set("probabilidade_maxima", Number(e.target.value))} className="rounded-xl" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Settings className="w-5 h-5 text-primary" /> Comissionamento</CardTitle>
          <CardDescription>Percentuais padrão de comissão</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Comissão Vendedor (%)</Label>
              <Input type="number" step="0.5" value={form.comissao_percentual_padrao} onChange={e => set("comissao_percentual_padrao", Number(e.target.value))} className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Comissão Revendedor (%)</Label>
              <Input type="number" step="0.5" value={form.comissao_revendedor_percentual} onChange={e => set("comissao_revendedor_percentual", Number(e.target.value))} className="rounded-xl" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Plug className="w-5 h-5 text-primary" /> Integração IXC</CardTitle>
          <CardDescription>IDs da sua instância do IXC Provedor</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>ID Filial</Label>
              <Input value={form.id_filial_ixc} onChange={e => set("id_filial_ixc", e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>ID Vendedor Padrão</Label>
              <Input value={form.id_vendedor_ixc_padrao} onChange={e => set("id_vendedor_ixc_padrao", e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>ID Assunto OS (Instalação)</Label>
              <Input value={form.id_assunto_os_ixc} onChange={e => set("id_assunto_os_ixc", e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>ID Setor OS</Label>
              <Input value={form.id_setor_os_ixc} onChange={e => set("id_setor_os_ixc", e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Contribuinte PF</Label>
              <Input value={form.contribuinte_pf} onChange={e => set("contribuinte_pf", e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Status Contrato Inicial</Label>
              <Input value={form.status_contrato_inicial} onChange={e => set("status_contrato_inicial", e.target.value)} className="rounded-xl" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={() => saveMutation.mutate(form)}
          disabled={saveMutation.isPending}
          className="gap-2 rounded-xl px-6"
        >
          <Save className="w-4 h-4" />
          {saveMutation.isPending ? "Salvando..." : "Salvar Configurações"}
        </Button>
      </div>
    </div>
  );
}