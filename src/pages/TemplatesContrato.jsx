import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Edit2, Trash2, Eye, Copy, ArrowLeft, Check, RefreshCw, Link2 } from "lucide-react";
import { toast } from "sonner";
import TemplateEditor from "@/components/templates/TemplateEditor";
import TemplatePreview from "@/components/templates/TemplatePreview";

function ListaTemplates({ templates, onNovo, onEditar, onDuplicar, onDeletar, onPreview, onSincronizarIXC, isSincronizando }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Templates de Contrato</h1>
          <p className="text-muted-foreground mt-1">Crie modelos com variáveis preenchidas automaticamente</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={onSincronizarIXC}
            disabled={isSincronizando}
            className="gap-2 rounded-xl"
            title="Importa modelos de contrato cadastrados no IXC"
          >
            <RefreshCw className={`w-4 h-4 ${isSincronizando ? 'animate-spin' : ''}`} />
            {isSincronizando ? 'Sincronizando...' : 'Sincronizar IXC'}
          </Button>
          <Button onClick={onNovo} className="gap-2 rounded-xl">
            <Plus className="w-4 h-4" /> Novo Template
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {templates.length === 0 ? (
          <Card className="rounded-xl border-dashed">
            <CardContent className="py-16 text-center text-muted-foreground">
              <p className="font-medium mb-2">Nenhum template criado</p>
              <p className="text-sm">Clique em "Novo Template" para começar</p>
            </CardContent>
          </Card>
        ) : (
          templates.map(template => (
            <Card key={template.id} className="rounded-xl hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-base">{template.nome}</CardTitle>
                      <Badge variant={template.ativo ? "default" : "secondary"} className="text-xs rounded-md">
                        {template.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                      {template.id_modelo_ixc && (
                        <Badge variant="outline" className="text-xs rounded-md border-blue-200 text-blue-600 bg-blue-50 gap-1">
                          <Link2 className="w-3 h-3" /> IXC #{template.id_modelo_ixc}
                        </Badge>
                      )}
                    </div>
                    {template.descricao && (
                      <p className="text-sm text-muted-foreground mt-1">{template.descricao}</p>
                    )}
                    {template.variaveis_obrigatorias?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {template.variaveis_obrigatorias.map((v, i) => (
                          <Badge key={i} variant="secondary" className="text-xs rounded-md font-mono">
                            {`{{${v}}}`}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" className="gap-1.5 rounded-lg h-8" onClick={() => onPreview(template)}>
                      <Eye className="w-3.5 h-3.5" /><span className="hidden sm:inline">Preview</span>
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5 rounded-lg h-8" onClick={() => onDuplicar(template)}>
                      <Copy className="w-3.5 h-3.5" /><span className="hidden sm:inline">Duplicar</span>
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5 rounded-lg h-8" onClick={() => onEditar(template)}>
                      <Edit2 className="w-3.5 h-3.5" /><span className="hidden sm:inline">Editar</span>
                    </Button>
                    <Button
                      variant="destructive" size="sm" className="rounded-lg h-8"
                      onClick={() => { if (confirm("Deletar este template?")) onDeletar(template.id); }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function EditorTemplate({ template, onSalvar, onCancelar, isPending }) {
  const isNovo = !template?.id;
  const [formData, setFormData] = useState({
    nome: template?.nome || "",
    descricao: template?.descricao || "",
    conteudo: template?.conteudo || "",
    ativo: template?.ativo !== undefined ? template.ativo : true,
  });

  const handleSubmit = () => {
    if (!formData.nome.trim() || !formData.conteudo.trim()) {
      alert("Nome e conteúdo são obrigatórios");
      return;
    }
    const variaveis = [...new Set(
      (formData.conteudo.match(/\{\{(\w+)\}\}/g) || []).map(v => v.replace(/\{\{|\}\}/g, ""))
    )];
    onSalvar({ ...formData, variaveis_obrigatorias: variaveis });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onCancelar} className="gap-2 rounded-lg">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>
        <div>
          <h1 className="text-xl font-bold">{isNovo ? "Novo Template" : "Editar Template"}</h1>
          <p className="text-sm text-muted-foreground">Clique nas variáveis para inserir no cursor</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Nome do Template *</label>
          <Input
            value={formData.nome}
            onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
            placeholder="Ex: Contrato Internet Residencial"
            className="mt-1 rounded-lg"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Descrição</label>
          <Input
            value={formData.descricao}
            onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
            placeholder="Descrição opcional"
            className="mt-1 rounded-lg"
          />
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="space-y-3">
          <label className="text-sm font-medium">Variáveis disponíveis</label>
          <TemplateEditor
            value={formData.conteudo}
            onChange={(v) => setFormData({ ...formData, conteudo: v })}
          />
        </div>

        <div className="space-y-3">
          <label className="text-sm font-medium">Preview (dados de exemplo)</label>
          <TemplatePreview conteudo={formData.conteudo} />
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-border">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={formData.ativo}
            onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
            className="rounded border-border"
          />
          Template ativo
        </label>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onCancelar} className="rounded-lg">Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isPending} className="rounded-lg gap-2">
            <Check className="w-4 h-4" />
            {isPending ? "Salvando..." : "Salvar Template"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function TemplatesContrato() {
  const [view, setView] = useState("lista");
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const queryClient = useQueryClient();

  const { data: templates = [] } = useQuery({
    queryKey: ["templates-contrato"],
    queryFn: () => base44.entities.TemplateContrato.list("-created_date", 100),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.TemplateContrato.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["templates-contrato"] }); setView("lista"); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.TemplateContrato.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["templates-contrato"] }); setView("lista"); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.TemplateContrato.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["templates-contrato"] }),
  });

  const sincronizarIXCMutation = useMutation({
    mutationFn: () => base44.functions.invoke("sincronizarIXC", { tipo: "sync_modelos" }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["templates-contrato"] });
      const d = res.data;
      const criados = d?.modelos_criados?.length || 0;
      const atualizados = d?.modelos_atualizados?.length || 0;
      const total = d?.modelos_ixc_encontrados || 0;
      if (total === 0) {
        toast.info("Nenhum modelo de contrato encontrado no IXC. Verifique se a tabela contrato_modelo está preenchida.");
      } else {
        toast.success(`IXC sincronizado! ${criados} criados, ${atualizados} atualizados (${total} encontrados).`);
      }
    },
    onError: (err) => toast.error(`Erro ao sincronizar: ${err.message}`),
  });

  const handleSalvar = (formData) => {
    if (editingTemplate?.id) {
      updateMutation.mutate({ id: editingTemplate.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEditar = (t) => { setEditingTemplate(t); setView("editor"); };
  const handleNovo = () => { setEditingTemplate(null); setView("editor"); };
  const handleDuplicar = (t) => {
    setEditingTemplate({ ...t, id: undefined, nome: `${t.nome} (cópia)` });
    setView("editor");
  };

  if (view === "editor") {
    return (
      <EditorTemplate
        template={editingTemplate}
        onSalvar={handleSalvar}
        onCancelar={() => setView("lista")}
        isPending={createMutation.isPending || updateMutation.isPending}
      />
    );
  }

  if (view === "preview" && previewTemplate) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setView("lista")} className="gap-2 rounded-lg">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Button>
          <h1 className="text-xl font-bold">{previewTemplate.nome}</h1>
        </div>
        <TemplatePreview conteudo={previewTemplate.conteudo} />
      </div>
    );
  }

  return (
    <ListaTemplates
      templates={templates}
      onNovo={handleNovo}
      onEditar={handleEditar}
      onDuplicar={handleDuplicar}
      onDeletar={deleteMutation.mutate}
      onPreview={(t) => { setPreviewTemplate(t); setView("preview"); }}
      onSincronizarIXC={() => sincronizarIXCMutation.mutate()}
      isSincronizando={sincronizarIXCMutation.isPending}
    />
  );
}