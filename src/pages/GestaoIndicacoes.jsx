import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExternalLink, Users, CheckCircle2, Clock, Gift, Copy, Settings, Search } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_CONFIG = {
  pendente: { label: "Pendente", className: "bg-amber-50 text-amber-700 border-amber-200" },
  em_contato: { label: "Em Contato", className: "bg-blue-50 text-blue-700 border-blue-200" },
  convertido: { label: "Convertido ✓", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  expirado: { label: "Expirado", className: "bg-muted text-muted-foreground" },
  cancelado: { label: "Cancelado", className: "bg-red-50 text-red-700 border-red-200" },
};

const RECOMPENSA_TIPOS = { desconto: "Desconto", credito: "Crédito", brinde: "Brinde", mes_gratis: "Mês Grátis" };

const DEFAULT_CFG = {
  titulo: "Indique e Ganhe!",
  descricao: "Indique um amigo, ele assina e você ganha!",
  recompensa_tipo: "desconto",
  recompensa_valor: "10%",
  recompensa_descricao: "10% de desconto na próxima fatura",
  prazo_validade_dias: 30,
  whatsapp_mensagem: "",
  ativo: true,
};

export default function GestaoIndicacoes() {
  const [search, setSearch] = useState("");
  const [showConfig, setShowConfig] = useState(false);
  const [cfgForm, setCfgForm] = useState(null);
  const queryClient = useQueryClient();

  const { data: indicacoes = [] } = useQuery({
    queryKey: ["indicacoes"],
    queryFn: () => base44.entities.Indicacao.list("-created_date"),
  });

  const { data: configs = [] } = useQuery({
    queryKey: ["config-referral"],
    queryFn: () => base44.entities.ConfigReferral.list(),
  });

  const cfg = configs[0] || DEFAULT_CFG;

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, recompensa_paga, data_conversao }) =>
      base44.entities.Indicacao.update(id, { status, ...(recompensa_paga !== undefined ? { recompensa_paga } : {}), ...(data_conversao ? { data_conversao } : {}) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["indicacoes"] }); toast.success("Status atualizado!"); },
  });

  const saveCfgMutation = useMutation({
    mutationFn: (data) => configs[0]
      ? base44.entities.ConfigReferral.update(configs[0].id, data)
      : base44.entities.ConfigReferral.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["config-referral"] }); setShowConfig(false); toast.success("Configurações salvas!"); },
  });

  const filtered = indicacoes.filter(i =>
    !search ||
    i.indicador_nome?.toLowerCase().includes(search.toLowerCase()) ||
    i.indicado_nome?.toLowerCase().includes(search.toLowerCase()) ||
    i.codigo_indicacao?.toLowerCase().includes(search.toLowerCase())
  );

  // Métricas
  const total = indicacoes.length;
  const convertidos = indicacoes.filter(i => i.status === "convertidos").length;
  const pendentes = indicacoes.filter(i => i.status === "pendente").length;
  const recompensas_pagas = indicacoes.filter(i => i.recompensa_paga).length;

  const linkPublico = `${window.location.origin}/indicacao`;

  const abrirConfig = () => {
    setCfgForm({ ...DEFAULT_CFG, ...cfg });
    setShowConfig(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Indique e Ganhe</h1>
          <p className="text-muted-foreground mt-1 text-sm">Gerencie o programa de indicação e recompensas</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" className="gap-2 rounded-xl" onClick={() => window.open(linkPublico, "_blank")}>
            <ExternalLink className="w-4 h-4" /> Ver Página
          </Button>
          <Button variant="outline" className="gap-2 rounded-xl" onClick={abrirConfig}>
            <Settings className="w-4 h-4" /> Configurar
          </Button>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total de Indicações", value: total, icon: Users, color: "text-primary" },
          { label: "Convertidas", value: indicacoes.filter(i => i.status === "convertido").length, icon: CheckCircle2, color: "text-emerald-600" },
          { label: "Pendentes", value: indicacoes.filter(i => i.status === "pendente").length, icon: Clock, color: "text-amber-600" },
          { label: "Recompensas Pagas", value: recompensas_pagas, icon: Gift, color: "text-purple-600" },
        ].map(m => (
          <Card key={m.label} className="rounded-2xl">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl bg-muted flex items-center justify-center ${m.color}`}>
                <m.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-black">{m.value}</p>
                <p className="text-xs text-muted-foreground">{m.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Link público */}
      <Card className="rounded-2xl border-emerald-200 bg-emerald-50/50">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-emerald-700 mb-1">Link da Página de Indicação</p>
            <p className="font-mono text-sm text-emerald-800 break-all">{linkPublico}</p>
            <p className="text-xs text-muted-foreground mt-1">Compartilhe com seus clientes para eles indicarem amigos</p>
          </div>
          <Button variant="outline" size="sm" className="rounded-lg gap-2 border-emerald-300 shrink-0" onClick={() => { navigator.clipboard.writeText(linkPublico); toast.success("Link copiado!"); }}>
            <Copy className="w-4 h-4" /> Copiar
          </Button>
        </CardContent>
      </Card>

      {/* Lista */}
      <Tabs defaultValue="todas">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <TabsList className="rounded-xl">
            <TabsTrigger value="todas" className="rounded-lg">Todas</TabsTrigger>
            <TabsTrigger value="pendente" className="rounded-lg">Pendentes</TabsTrigger>
            <TabsTrigger value="convertido" className="rounded-lg">Convertidas</TabsTrigger>
          </TabsList>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 rounded-xl w-64" />
          </div>
        </div>

        {["todas", "pendente", "convertido"].map(tab => (
          <TabsContent key={tab} value={tab} className="mt-4">
            <Card className="rounded-2xl">
              <CardContent className="p-0">
                {(tab === "todas" ? filtered : filtered.filter(i => i.status === tab)).length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p>Nenhuma indicação encontrada</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/40">
                          <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Indicador</th>
                          <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Indicado</th>
                          <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Código</th>
                          <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Data</th>
                          <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Status</th>
                          <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Recompensa</th>
                          <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(tab === "todas" ? filtered : filtered.filter(i => i.status === tab)).map(ind => (
                          <tr key={ind.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                            <td className="py-3 px-4">
                              <p className="font-medium">{ind.indicador_nome}</p>
                              <p className="text-xs text-muted-foreground">{ind.indicador_telefone}</p>
                            </td>
                            <td className="py-3 px-4">
                              <p className="font-medium">{ind.indicado_nome}</p>
                              <p className="text-xs text-muted-foreground">{ind.indicado_telefone}</p>
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-mono text-xs bg-muted px-2 py-1 rounded">{ind.codigo_indicacao}</span>
                            </td>
                            <td className="py-3 px-4 text-xs text-muted-foreground">
                              {ind.created_date ? format(new Date(ind.created_date), "dd/MM/yy", { locale: ptBR }) : "—"}
                            </td>
                            <td className="py-3 px-4">
                              <Badge variant="outline" className={`text-xs ${STATUS_CONFIG[ind.status]?.className}`}>
                                {STATUS_CONFIG[ind.status]?.label}
                              </Badge>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-muted-foreground">{ind.recompensa_valor || cfg.recompensa_valor}</span>
                                {ind.recompensa_paga ? (
                                  <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">Paga ✓</Badge>
                                ) : null}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex gap-1 flex-wrap">
                                {ind.status === "pendente" && (
                                  <Button
                                    variant="outline" size="sm" className="h-7 text-xs rounded-lg"
                                    onClick={() => updateStatusMutation.mutate({ id: ind.id, status: "em_contato" })}
                                  >Em Contato</Button>
                                )}
                                {(ind.status === "pendente" || ind.status === "em_contato") && (
                                  <Button
                                    size="sm" className="h-7 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700"
                                    onClick={() => updateStatusMutation.mutate({ id: ind.id, status: "convertido", data_conversao: new Date().toISOString() })}
                                  >Converter ✓</Button>
                                )}
                                {ind.status === "convertido" && !ind.recompensa_paga && (
                                  <Button
                                    variant="outline" size="sm" className="h-7 text-xs rounded-lg border-purple-300 text-purple-700"
                                    onClick={() => updateStatusMutation.mutate({ id: ind.id, status: "convertido", recompensa_paga: true })}
                                  >Pagar Recompensa</Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Dialog Configurações */}
      <Dialog open={showConfig} onOpenChange={setShowConfig}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Configurar Programa de Indicação</DialogTitle>
          </DialogHeader>
          {cfgForm && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Título da página</label>
                <Input value={cfgForm.titulo} onChange={e => setCfgForm(f => ({ ...f, titulo: e.target.value }))} className="mt-1 rounded-lg" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Descrição</label>
                <Input value={cfgForm.descricao} onChange={e => setCfgForm(f => ({ ...f, descricao: e.target.value }))} className="mt-1 rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Tipo de recompensa</label>
                  <select className="w-full border border-border rounded-lg px-3 py-2 text-sm mt-1 bg-background" value={cfgForm.recompensa_tipo} onChange={e => setCfgForm(f => ({ ...f, recompensa_tipo: e.target.value }))}>
                    {Object.entries(RECOMPENSA_TIPOS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Valor (ex: 10%, R$50)</label>
                  <Input value={cfgForm.recompensa_valor} onChange={e => setCfgForm(f => ({ ...f, recompensa_valor: e.target.value }))} className="mt-1 rounded-lg" placeholder="10%" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Descrição da recompensa (visível ao cliente)</label>
                <Input value={cfgForm.recompensa_descricao} onChange={e => setCfgForm(f => ({ ...f, recompensa_descricao: e.target.value }))} className="mt-1 rounded-lg" placeholder="10% de desconto na próxima fatura" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Mensagem padrão WhatsApp</label>
                <textarea
                  value={cfgForm.whatsapp_mensagem}
                  onChange={e => setCfgForm(f => ({ ...f, whatsapp_mensagem: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm mt-1 min-h-[80px] bg-background resize-none"
                  placeholder="Use {link} para o link e {nome} para o nome do indicado. Deixe vazio para mensagem padrão."
                />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="ativo-ref" checked={cfgForm.ativo} onChange={e => setCfgForm(f => ({ ...f, ativo: e.target.checked }))} className="rounded" />
                <label htmlFor="ativo-ref" className="text-sm">Programa ativo</label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setShowConfig(false)} className="rounded-lg">Cancelar</Button>
                <Button onClick={() => saveCfgMutation.mutate(cfgForm)} disabled={saveCfgMutation.isPending} className="rounded-lg">
                  {saveCfgMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}