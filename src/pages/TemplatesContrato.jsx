import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Edit2, Trash2, Eye, Copy } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function TemplatesContrato() {
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [formData, setFormData] = useState({
    nome: "",
    descricao: "",
    conteudo: "",
    ativo: true,
  });
  const queryClient = useQueryClient();

  const { data: templates = [] } = useQuery({
    queryKey: ["templates-contrato"],
    queryFn: () => base44.entities.TemplateContrato.list("-created_date", 100),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.TemplateContrato.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates-contrato"] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.TemplateContrato.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates-contrato"] });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.TemplateContrato.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates-contrato"] });
    },
  });

  const resetForm = () => {
    setFormData({ nome: "", descricao: "", conteudo: "", ativo: true });
    setEditingTemplate(null);
    setShowForm(false);
  };

  const handleEdit = (template) => {
    setEditingTemplate(template);
    setFormData(template);
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (!formData.nome.trim() || !formData.conteudo.trim()) {
      alert("Nome e conteúdo são obrigatórios");
      return;
    }

    const variaveis = (formData.conteudo.match(/\{\{(\w+)\}\}/g) || []).map(v =>
      v.replace(/\{\{|\}\}/g, "")
    );

    const dataToSubmit = {
      ...formData,
      variaveis_obrigatorias: [...new Set(variaveis)],
    };

    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, data: dataToSubmit });
    } else {
      createMutation.mutate(dataToSubmit);
    }
  };

  const handleDuplicate = (template) => {
    setEditingTemplate(null);
    setFormData({
      nome: `${template.nome} (cópia)`,
      descricao: template.descricao,
      conteudo: template.conteudo,
      ativo: template.ativo,
    });
    setShowForm(true);
  };

  const extrairVariaveis = (texto) => {
    const variaveis = (texto.match(/\{\{(\w+)\}\}/g) || []).map(v =>
      v.replace(/\{\{|\}\}/g, "")
    );
    return [...new Set(variaveis)];
  };

  return (
    <div className="space-y-6 pb-20 sm:pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Templates de Contrato</h1>
          <p className="text-muted-foreground mt-1">Crie e gerencie modelos de contrato com variáveis</p>
        </div>
        <Button onClick={() => { setEditingTemplate(null); setFormData({ nome: "", descricao: "", conteudo: "", ativo: true }); setShowForm(true); }} className="gap-2 rounded-xl w-full sm:w-auto">
          <Plus className="w-4 h-4" />
          Novo Template
        </Button>
      </div>

      <div className="grid gap-4">
        {templates.length === 0 ? (
          <Card className="rounded-xl border-dashed">
            <CardContent className="py-12 text-center text-muted-foreground">
              Nenhum template criado. Comece adicionando um novo modelo!
            </CardContent>
          </Card>
        ) : (
          templates.map(template => (
            <Card key={template.id} className="rounded-xl hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base sm:text-lg">{template.nome}</CardTitle>
                      <Badge variant={template.ativo ? "default" : "secondary"} className="text-xs rounded-md">
                        {template.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{template.descricao}</p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 rounded-lg h-8"
                      onClick={() => setPreviewTemplate(template)}
                    >
                      <Eye className="w-4 h-4" />
                      <span className="hidden sm:inline">Preview</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 rounded-lg h-8"
                      onClick={() => handleDuplicate(template)}
                    >
                      <Copy className="w-4 h-4" />
                      <span className="hidden sm:inline">Duplicar</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 rounded-lg h-8"
                      onClick={() => handleEdit(template)}
                    >
                      <Edit2 className="w-4 h-4" />
                      <span className="hidden sm:inline">Editar</span>
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="gap-2 rounded-lg h-8"
                      onClick={() => {
                        if (confirm("Tem certeza que deseja deletar este template?")) {
                          deleteMutation.mutate(template.id);
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {template.variaveis_obrigatorias && template.variaveis_obrigatorias.length > 0 && (
                <CardContent className="pt-0">
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs text-muted-foreground">Variáveis:</span>
                    {template.variaveis_obrigatorias.map((v, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs rounded-md">
                        {`{{${v}}}`}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Editar Template" : "Novo Template de Contrato"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
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
                placeholder="Descrição do template"
                className="mt-1 rounded-lg"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Conteúdo do Contrato *</label>
                <span className="text-xs text-muted-foreground">
                  Use {`{{variavel}}`} para campos dinâmicos
                </span>
              </div>
              <textarea
                value={formData.conteudo}
                onChange={(e) => setFormData({ ...formData, conteudo: e.target.value })}
                placeholder="CONTRATO&#10;&#10;Contratante: {{cliente_nome}}&#10;CPF: {{cliente_cpf}}&#10;Plano: {{plano_nome}}&#10;Valor: R$ {{valor}}&#10;&#10;Termos e condições..."
                className="w-full h-64 p-3 rounded-lg border border-border bg-card font-mono text-sm"
              />
            </div>

            {extrairVariaveis(formData.conteudo).length > 0 && (
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg p-3">
                <p className="text-xs font-medium text-blue-900 dark:text-blue-300">Variáveis detectadas:</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {extrairVariaveis(formData.conteudo).map((v, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs rounded-md">
                      {`{{${v}}}`}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={formData.ativo}
                onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                className="rounded border-border"
              />
              <label className="text-sm">Template ativo</label>
            </div>

            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={resetForm} className="rounded-lg">
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="rounded-lg"
              >
                {createMutation.isPending || updateMutation.isPending ? "Salvando..." : "Salvar Template"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview - {previewTemplate?.nome}</DialogTitle>
          </DialogHeader>
          <div className="bg-card border border-border rounded-lg p-4 whitespace-pre-wrap font-mono text-sm max-h-96 overflow-y-auto">
            {previewTemplate?.conteudo}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}