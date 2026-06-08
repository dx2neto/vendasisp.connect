import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePermissions } from "@/lib/usePermissions";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Phone, Mail, FileText } from "lucide-react";
import LeadForm from "@/components/leads/LeadForm";
import HistoricoNotas from "@/components/leads/HistoricoNotas";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ETAPA_COLORS = {
  novo: "bg-blue-50 text-blue-600 border-blue-200",
  analise_credito: "bg-amber-50 text-amber-600 border-amber-200",
  viabilidade: "bg-purple-50 text-purple-600 border-purple-200",
  contrato: "bg-cyan-50 text-cyan-600 border-cyan-200",
  ativado: "bg-emerald-50 text-emerald-600 border-emerald-200",
  recusado: "bg-red-50 text-red-500 border-red-200",
};

const ETAPA_LABELS = {
  novo: "Novo",
  analise_credito: "Crédito",
  viabilidade: "Viabilidade",
  contrato: "Contrato",
  ativado: "Ativado",
  recusado: "Recusado",
};

const CANAL_LABELS = {
  porta_a_porta: "PAP",
  call_center: "Call Center",
  revenda: "Revenda",
  site: "Site",
};

export default function Leads() {
  const [showForm, setShowForm] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [editingLead, setEditingLead] = useState(null);
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const { filtrarLeads } = usePermissions();

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: () => base44.entities.Lead.list("-created_date", 200),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Lead.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setShowForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Lead.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setShowForm(false);
      setEditingLead(null);
    },
  });

  const leadsFiltradosPorPapel = filtrarLeads(leads);
  const filtered = leadsFiltradosPorPapel.filter(l =>
    !search ||
    l.nome?.toLowerCase().includes(search.toLowerCase()) ||
    l.cnpj_cpf?.includes(search) ||
    l.telefone?.includes(search)
  );

  const handleSubmit = (data) => {
    if (editingLead) {
      updateMutation.mutate({ id: editingLead.id, data });
    } else {
      createMutation.mutate({ ...data, data_entrada: new Date().toISOString(), etapa_funil: "novo" });
    }
  };

  const handleAdicionarNota = (novaNota, novaEtapa) => {
    if (!selectedLead) return;

    const notasAtualizadas = [...(selectedLead.historico_notas || []), novaNota];
    const update = { historico_notas: notasAtualizadas };
    if (novaEtapa) update.etapa_funil = novaEtapa;

    updateMutation.mutate({ id: selectedLead.id, data: update });
    setSelectedLead({ ...selectedLead, historico_notas: notasAtualizadas, ...(novaEtapa ? { etapa_funil: novaEtapa } : {}) });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
          <p className="text-muted-foreground mt-1">{leads.length} leads cadastrados</p>
        </div>
        <Button onClick={() => { setEditingLead(null); setShowForm(true); }} className="gap-2 rounded-xl">
          <Plus className="w-4 h-4" /> Novo Lead
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, CPF ou telefone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10 rounded-xl"
        />
      </div>

      <div className="rounded-2xl bg-card border border-border overflow-hidden">
         <div className="overflow-x-auto">
           <table className="w-full text-sm">
             <thead>
               <tr className="border-b border-border bg-muted/50">
                 <th className="text-left py-3 px-4 font-medium text-muted-foreground">Nome</th>
                 <th className="text-left py-3 px-4 font-medium text-muted-foreground">CPF/CNPJ</th>
                 <th className="text-left py-3 px-4 font-medium text-muted-foreground">Contato</th>
                 <th className="text-left py-3 px-4 font-medium text-muted-foreground">Canal</th>
                 <th className="text-left py-3 px-4 font-medium text-muted-foreground">Etapa</th>
                 <th className="text-left py-3 px-4 font-medium text-muted-foreground">Cidade</th>
                 <th className="text-left py-3 px-4 font-medium text-muted-foreground">Ações</th>
               </tr>
             </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">Nenhum lead encontrado</td></tr>
              ) : filtered.map(lead => (
                <tr
                    key={lead.id}
                    className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                  >
                  <td className="py-3 px-4 font-medium">{lead.nome}</td>
                  <td className="py-3 px-4 text-muted-foreground font-mono text-xs">{lead.cnpj_cpf}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {lead.telefone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{lead.telefone}</span>}
                      {lead.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{lead.email}</span>}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-xs text-muted-foreground">{CANAL_LABELS[lead.canal_origem] || lead.canal_origem}</span>
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant="outline" className={`text-xs ${ETAPA_COLORS[lead.etapa_funil] || ""}`}>
                      {ETAPA_LABELS[lead.etapa_funil] || lead.etapa_funil}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground text-xs">{lead.cidade_nome}</td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-2 rounded-lg h-8"
                        onClick={() => setSelectedLead(lead)}
                      >
                        <FileText className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-lg h-8"
                        onClick={() => { setEditingLead(lead); setShowForm(true); }}
                      >
                        Editar
                      </Button>
                    </div>
                  </td>
                  </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
         <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
           <DialogHeader>
             <DialogTitle>{editingLead ? "Editar Lead" : "Novo Lead"}</DialogTitle>
           </DialogHeader>
           <LeadForm
             lead={editingLead}
             onSubmit={handleSubmit}
             isLoading={createMutation.isPending || updateMutation.isPending}
           />
         </DialogContent>
       </Dialog>

       <Dialog open={!!selectedLead} onOpenChange={(open) => !open && setSelectedLead(null)}>
         <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
           <DialogHeader>
             <DialogTitle>Detalhes do Lead - {selectedLead?.nome}</DialogTitle>
           </DialogHeader>
           {selectedLead && (
             <Tabs defaultValue="notas" className="w-full">
               <TabsList className="grid w-full grid-cols-2 rounded-lg">
                 <TabsTrigger value="notas" className="rounded-md">Histórico de Notas</TabsTrigger>
                 <TabsTrigger value="info" className="rounded-md">Informações</TabsTrigger>
               </TabsList>
               <TabsContent value="notas" className="space-y-4">
                 <HistoricoNotas
                   notas={selectedLead.historico_notas}
                   onAdicionarNota={handleAdicionarNota}
                   leadEtapaAtual={selectedLead.etapa_funil}
                 />
               </TabsContent>
               <TabsContent value="info" className="space-y-4">
                 <div className="grid grid-cols-2 gap-4 text-sm">
                   <div>
                     <p className="text-muted-foreground text-xs">Nome</p>
                     <p className="font-medium">{selectedLead.nome}</p>
                   </div>
                   <div>
                     <p className="text-muted-foreground text-xs">CPF/CNPJ</p>
                     <p className="font-medium font-mono">{selectedLead.cnpj_cpf}</p>
                   </div>
                   <div>
                     <p className="text-muted-foreground text-xs">Telefone</p>
                     <p className="font-medium">{selectedLead.telefone || "—"}</p>
                   </div>
                   <div>
                     <p className="text-muted-foreground text-xs">Email</p>
                     <p className="font-medium text-xs break-all">{selectedLead.email || "—"}</p>
                   </div>
                   <div>
                     <p className="text-muted-foreground text-xs">Etapa</p>
                     <Badge variant="outline" className={`text-xs ${ETAPA_COLORS[selectedLead.etapa_funil]}`}>
                       {ETAPA_LABELS[selectedLead.etapa_funil]}
                     </Badge>
                   </div>
                   <div>
                     <p className="text-muted-foreground text-xs">Canal</p>
                     <p className="font-medium text-xs">{CANAL_LABELS[selectedLead.canal_origem]}</p>
                   </div>
                   <div className="col-span-2">
                     <p className="text-muted-foreground text-xs">Observação</p>
                     <p className="text-sm">{selectedLead.observacao || "—"}</p>
                   </div>
                 </div>
               </TabsContent>
             </Tabs>
           )}
         </DialogContent>
       </Dialog>
      </div>
      );
      }