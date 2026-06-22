// pages/ConfiguracaoContratos.jsx
// Módulo do painel para CONFIGURAR CONTRATOS:
//   1) Sincronizar os modelos de contrato do IXC (vira TemplateContrato).
//   2) Vincular cada Plano aos modelos que devem ser assinados (adesão,
//      permanência, comodato...). A vinculação é salva em Plano.template_ids[].
//   3) Pré-visualizar um modelo.
//
// Requisitos de schema:
//   - Plano: campo `template_ids` (lista de IDs de TemplateContrato).
//   - TemplateContrato: `nome`, `conteudo`, `id_modelo_ixc`, `tipo_modelo`, `ativo`.
//
// O envio do contrato (enviarContrato / assinarOnline) lê esses template_ids,
// preenche as variáveis #...# do IXC com os dados do lead/pedido/plano e manda
// pro ZapSign.

import React, { useEffect, useMemo, useState } from "react";
import { Plano, TemplateContrato } from "@/api/entities";
import { sincronizarIXC } from "@/api/functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  FileText, RefreshCw, Eye, CheckCircle2, AlertCircle, Save, Link2, Loader2,
} from "lucide-react";

export default function ConfiguracaoContratos() {
  const [planos, setPlanos] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [salvandoId, setSalvandoId] = useState(null);
  const [aviso, setAviso] = useState(null); // { tipo: "ok"|"erro", texto }
  const [selecao, setSelecao] = useState({}); // { [planoId]: Set(templateId) }

  async function carregar() {
    setCarregando(true);
    try {
      const [ps, ts] = await Promise.all([
        Plano.list("-created_date", 500),
        TemplateContrato.list("-created_date", 500),
      ]);
      setPlanos(ps || []);
      setTemplates(ts || []);
      const sel = {};
      (ps || []).forEach((p) => {
        sel[p.id] = new Set(Array.isArray(p.template_ids) ? p.template_ids : []);
      });
      setSelecao(sel);
    } catch (e) {
      setAviso({ tipo: "erro", texto: "Falha ao carregar dados: " + (e?.message || e) });
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  async function sincronizarModelos() {
    setSincronizando(true);
    setAviso(null);
    try {
      const res = await sincronizarIXC({ tipo: "sync_modelos" });
      const d = res?.data || res || {};
      const criados = d.modelos_criados?.length || 0;
      const atualizados = d.modelos_atualizados?.length || 0;
      const encontrados = d.modelos_ixc_encontrados ?? (criados + atualizados);
      setAviso({
        tipo: "ok",
        texto: `Modelos sincronizados: ${encontrados} no IXC — ${criados} novo(s), ${atualizados} atualizado(s).`,
      });
      await carregar();
    } catch (e) {
      setAviso({ tipo: "erro", texto: "Erro ao sincronizar modelos: " + (e?.message || e) });
    } finally {
      setSincronizando(false);
    }
  }

  function alternar(planoId, templateId) {
    setSelecao((prev) => {
      const atual = new Set(prev[planoId] || []);
      if (atual.has(templateId)) atual.delete(templateId);
      else atual.add(templateId);
      return { ...prev, [planoId]: atual };
    });
  }

  async function salvarVinculo(plano) {
    setSalvandoId(plano.id);
    setAviso(null);
    try {
      const ids = Array.from(selecao[plano.id] || []);
      await Plano.update(plano.id, { template_ids: ids });
      setAviso({ tipo: "ok", texto: `Plano "${plano.nome}" vinculado a ${ids.length} modelo(s).` });
      setPlanos((prev) => prev.map((p) => (p.id === plano.id ? { ...p, template_ids: ids } : p)));
    } catch (e) {
      setAviso({ tipo: "erro", texto: "Erro ao salvar vínculo: " + (e?.message || e) });
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
        <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
          <FileText className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configuração de Contratos</h1>
          <p className="text-sm text-gray-500">
            Sincronize os modelos do IXC e vincule cada plano aos contratos que serão assinados.
          </p>
        </div>
      </div>

      {aviso && (
        <div
          className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
            aviso.tipo === "ok"
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {aviso.tipo === "ok" ? (
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          )}
          <span>{aviso.texto}</span>
        </div>
      )}

      {/* 1) Modelos do IXC */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg">Modelos de contrato (IXC)</CardTitle>
          <Button onClick={sincronizarModelos} disabled={sincronizando} size="sm">
            {sincronizando ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Sincronizar modelos do IXC
          </Button>
        </CardHeader>
        <CardContent>
          {templatesAtivos.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">
              Nenhum modelo ainda. Clique em <strong>Sincronizar modelos do IXC</strong> para importar.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {templatesAtivos.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-lg border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{t.nome}</p>
                    <p className="text-xs text-gray-400">
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
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Link2 className="w-5 h-5 text-gray-400" />
            Vincular planos aos contratos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {carregando ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : planos.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">Nenhum plano cadastrado.</p>
          ) : (
            planos.map((plano) => {
              const sel = selecao[plano.id] || new Set();
              const original = new Set(Array.isArray(plano.template_ids) ? plano.template_ids : []);
              const mudou =
                sel.size !== original.size ||
                Array.from(sel).some((id) => !original.has(id));
              return (
                <div key={plano.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div>
                      <p className="font-semibold text-gray-900">{plano.nome}</p>
                      <p className="text-xs text-gray-400">
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
                      >
                        {salvandoId === plano.id ? (
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4 mr-1" />
                        )}
                        Salvar
                      </Button>
                    </div>
                  </div>

                  {templatesAtivos.length === 0 ? (
                    <p className="text-xs text-gray-400">Sincronize os modelos primeiro.</p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {templatesAtivos.map((t) => (
                        <label
                          key={t.id}
                          className="flex items-center gap-2 rounded-md border px-2 py-1.5 cursor-pointer hover:bg-gray-50"
                        >
                          <Checkbox
                            checked={sel.has(t.id)}
                            onCheckedChange={() => alternar(plano.id, t.id)}
                          />
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

      <p className="text-xs text-gray-400 text-center">
        Dica: a ordem dos modelos no contrato segue a ordem em que aparecem aqui. Vários modelos
        são unidos num único PDF e enviados juntos para assinatura no ZapSign.
      </p>
    </div>
  );
}

function PreviewModelo({ template }) {
  const conteudo = template?.conteudo || "";
  // remove tags pra um preview legível (sem renderizar HTML)
  const texto = conteudo
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h[1-6]|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&ccedil;/gi, "ç")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Eye className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{template.nome}</DialogTitle>
        </DialogHeader>
        <pre className="whitespace-pre-wrap text-xs text-gray-700 font-sans">
          {texto || "(modelo sem conteúdo — sincronize novamente)"}
        </pre>
      </DialogContent>
    </Dialog>
  );
}
