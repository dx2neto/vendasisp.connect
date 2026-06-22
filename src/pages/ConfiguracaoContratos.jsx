import { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { FileText, RefreshCw, Eye, Save, Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";

// Configuração de Contratos:
//  1) Sincroniza os modelos de contrato do IXC (sincronizarIXC -> sync_modelos)
//  2) Vincula cada Plano aos modelos que serão assinados (salvo em Plano.template_ids)
//  3) Pré-visualiza um modelo
export default function ConfiguracaoContratos() {
  const [planos, setPlanos] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [salvandoId, setSalvandoId] = useState(null);
  const [selecao, setSelecao] = useState({});

  async function carregar() {
    setCarregando(true);
    try {
      const [ps, ts] = await Promise.all([
        base44.entities.Plano.list(),
        base44.entities.TemplateContrato.list(),
      ]);
      setPlanos(ps || []);
      setTemplates(ts || []);
      const sel = {};
      (ps || []).forEach((p) => {
        sel[p.id] = new Set(Array.isArray(p.template_ids) ? p.template_ids : []);
      });
      setSelecao(sel);
    } catch (e) {
      toast.error("Falha ao carregar dados: " + (e?.message || e));
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  async function sincronizarModelos() {
    setSincronizando(true);
    try {
      const res = await base44.functions.invoke("sincronizarIXC", { tipo: "sync_modelos" });
      const d = res?.data || res || {};
      const criados = d.modelos_criados?.length || 0;
      const atualizados = d.modelos_atualizados?.length || 0;
      const encontrados = d.modelos_ixc_encontrados ?? (criados + atualizados);
      toast.success(`Modelos: ${encontrados} no IXC — ${criados} novo(s), ${atualizados} atualizado(s).`);
      await carregar();
    } catch (e) {
      toast.error("Erro ao sincronizar modelos: " + (e?.message || e));
    } finally {
      setSincronizando(false);
    }
  }

  function alternar(planoId, templateId) {
    setSelecao((prev) => {
      const atual = new Set(prev[planoId] || []);
      atual.has(templateId) ? atual.delete(templateId) : atual.add(templateId);
      return { ...prev, [planoId]: atual };
    });
  }

  async function salvarVinculo(plano) {
    setSalvandoId(plano.id);
    try {
      const ids = Array.from(selecao[plano.id] || []);
      await base44.entities.Plano.update(plano.id, { template_ids: ids });
      toast.success(`Plano "${plano.nome}" vinculado a ${ids.length} modelo(s).`);
      setPlanos((prev) => prev.map((p) => (p.id === plano.id ? { ...p, template_ids: ids } : p)));
    } catch (e) {
      toast.error("Erro ao salvar vínculo: " + (e?.message || e));
    } finally {
      setSalvandoId(null);
    }
  }

  const templatesAtivos = useMemo(
    () => templates.filter((t) => t.ativo !== false),
    [templates]
  );

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-sky-50 text-sky-600">
          <FileText className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configuração de Contratos</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Sincronize os modelos do IXC e vincule cada plano aos contratos que serão assinados.
          </p>
        </div>
      </div>

      {/* 1) Modelos do IXC */}
      <Card className="rounded-xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg">Modelos de contrato (IXC)</CardTitle>
          <Button onClick={sincronizarModelos} disabled={sincronizando} size="sm" className="gap-2 rounded-xl">
            <RefreshCw className={`w-4 h-4 ${sincronizando ? "animate-spin" : ""}`} />
            {sincronizando ? "Sincronizando..." : "Sincronizar modelos do IXC"}
          </Button>
        </CardHeader>
        <CardContent>
          {templatesAtivos.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhum modelo ainda. Clique em <strong>Sincronizar modelos do IXC</strong> para importar.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {templatesAtivos.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-xl border px-3 py-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{t.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.tipo_modelo ? `${t.tipo_modelo} · ` : ""}
                      {t.id_modelo_ixc ? `IXC #${t.id_modelo_ixc}` : "manual"}
                    </p>
                  </div>
                  <PreviewModelo template={t} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2) Vínculo plano -> modelos */}
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Link2 className="w-5 h-5 text-muted-foreground" />
            Vincular planos aos contratos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {carregando ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : planos.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhum plano cadastrado.</p>
          ) : (
            planos.map((plano) => {
              const sel = selecao[plano.id] || new Set();
              const original = new Set(Array.isArray(plano.template_ids) ? plano.template_ids : []);
              const mudou = sel.size !== original.size || Array.from(sel).some((id) => !original.has(id));
              return (
                <div key={plano.id} className="rounded-xl border p-3">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div>
                      <p className="font-semibold">{plano.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {plano.velocidade_mbps ? `${plano.velocidade_mbps} Mbps` : ""}
                        {plano.preco_mensal ? ` · R$ ${Number(plano.preco_mensal).toFixed(2)}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{sel.size} modelo(s)</Badge>
                      <Button
                        size="sm"
                        variant={mudou ? "default" : "outline"}
                        disabled={!mudou || salvandoId === plano.id}
                        onClick={() => salvarVinculo(plano)}
                        className="gap-1 rounded-xl"
                      >
                        {salvandoId === plano.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        Salvar
                      </Button>
                    </div>
                  </div>

                  {templatesAtivos.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sincronize os modelos primeiro.</p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {templatesAtivos.map((t) => (
                        <label
                          key={t.id}
                          className="flex items-center gap-2 rounded-lg border px-2 py-1.5 cursor-pointer hover:bg-muted/50"
                        >
                          <Checkbox checked={sel.has(t.id)} onCheckedChange={() => alternar(plano.id, t.id)} />
                          <span className="text-sm truncate">{t.nome}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        Vários modelos (adesão, permanência, comodato...) são unidos num único PDF e enviados juntos
        para assinatura no ZapSign, na ordem em que aparecem aqui.
      </p>
    </div>
  );
}

function PreviewModelo({ template }) {
  const texto = (template?.conteudo || "")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h[1-6]|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&ccedil;/gi, "ç")
    .replace(/&atilde;/gi, "ã")
    .replace(/&ccedil;|&aacute;|&eacute;|&iacute;|&oacute;|&uacute;|&ecirc;|&ocirc;|&atilde;|&otilde;|&agrave;/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm"><Eye className="w-4 h-4" /></Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
        <DialogHeader><DialogTitle>{template.nome}</DialogTitle></DialogHeader>
        <pre className="whitespace-pre-wrap text-xs text-foreground/80 font-sans">
          {texto || "(modelo sem conteúdo — sincronize novamente)"}
        </pre>
      </DialogContent>
    </Dialog>
  );
}
