import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Loader2, Link } from "lucide-react";
import { toast } from "sonner";

function SetoresTab() {
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState("#16a34a");

  const { data: setores = [] } = useQuery({ queryKey: ["setores"], queryFn: () => base44.entities.Setor.list() });

  const criar = useMutation({
    mutationFn: () => base44.entities.Setor.create({ nome, cor }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["setores"] }); setNome(""); toast.success("Setor criado!"); },
  });

  const deletar = useMutation({
    mutationFn: (id) => base44.entities.Setor.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["setores"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input placeholder="Nome do setor" value={nome} onChange={e => setNome(e.target.value)} className="flex-1" />
        <input type="color" value={cor} onChange={e => setCor(e.target.value)} className="w-10 h-9 rounded border cursor-pointer" />
        <Button onClick={() => criar.mutate()} disabled={!nome.trim() || criar.isPending} className="gap-1.5">
          <Plus className="w-4 h-4" /> Criar
        </Button>
      </div>
      <div className="space-y-2">
        {setores.map(s => (
          <div key={s.id} className="flex items-center justify-between p-3 bg-white rounded-xl border">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: s.cor }} />
              <span className="font-medium">{s.nome}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => deletar.mutate(s.id)} className="text-red-400 hover:text-red-600">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function RespostasTab() {
  const qc = useQueryClient();
  const [atalho, setAtalho] = useState("");
  const [texto, setTexto] = useState("");

  const { data: respostas = [] } = useQuery({ queryKey: ["respostas-rapidas"], queryFn: () => base44.entities.RespostaRapida.list() });

  const criar = useMutation({
    mutationFn: () => base44.entities.RespostaRapida.create({ atalho, texto }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["respostas-rapidas"] }); setAtalho(""); setTexto(""); toast.success("Resposta criada!"); },
  });

  const deletar = useMutation({
    mutationFn: (id) => base44.entities.RespostaRapida.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["respostas-rapidas"] }),
  });

  return (
    <div className="space-y-4">
      <div className="space-y-2 p-4 bg-white rounded-xl border">
        <Input placeholder="/atalho (ex: /ola)" value={atalho} onChange={e => setAtalho(e.target.value)} />
        <textarea className="w-full border rounded-lg px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-primary/30"
          placeholder="Texto da resposta rápida..." value={texto} onChange={e => setTexto(e.target.value)} />
        <Button onClick={() => criar.mutate()} disabled={!atalho.trim() || !texto.trim() || criar.isPending} className="gap-1.5">
          <Plus className="w-4 h-4" /> Adicionar
        </Button>
      </div>
      <div className="space-y-2">
        {respostas.map(r => (
          <div key={r.id} className="p-3 bg-white rounded-xl border">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-bold text-emerald-700">{r.atalho}</span>
              <Button variant="ghost" size="sm" onClick={() => deletar.mutate(r.id)} className="text-red-400 hover:text-red-600">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-sm text-slate-600">{r.texto}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function WebhookTab() {
  const [url, setUrl] = useState("");
  const [registrando, setRegistrando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const registrar = async () => {
    if (!url) return;
    setRegistrando(true);
    try {
      const res = await base44.functions.invoke("registrarWebhookWA", { webhook_url: url });
      setResultado(res.data);
      toast.success("Webhook registrado!");
    } catch (e) {
      toast.error("Erro: " + e.message);
    } finally {
      setRegistrando(false);
    }
  };

  // URL da função de webhook
  const webhookFnUrl = `${window.location.origin.replace('app.', 'api.')}/functions/webhookWhatsapp`;

  return (
    <div className="space-y-4">
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm space-y-2">
        <p className="font-semibold text-blue-800">URL do Webhook (copie e cole no Evolution Go):</p>
        <div className="flex gap-2">
          <Input value={webhookFnUrl} readOnly className="font-mono text-xs bg-white" />
          <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(webhookFnUrl); toast.success("Copiado!"); }}>
            Copiar
          </Button>
        </div>
      </div>

      <div className="p-4 bg-white rounded-xl border space-y-3">
        <p className="font-semibold text-sm">Registrar webhook automaticamente no Evolution Go:</p>
        <p className="text-xs text-slate-500">Cole a URL pública da função abaixo e clique em registrar.</p>
        <Input placeholder="URL pública do webhook..." value={url} onChange={e => setUrl(e.target.value)} />
        <Button onClick={registrar} disabled={!url || registrando} className="gap-1.5">
          {registrando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link className="w-4 h-4" />}
          Registrar no Evolution Go
        </Button>
        {resultado && (
          <pre className="text-xs bg-slate-50 p-2 rounded">{JSON.stringify(resultado, null, 2)}</pre>
        )}
      </div>

      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 space-y-1">
        <p className="font-bold">Secrets necessários:</p>
        <p>• <code>EVOLUTION_URL</code> — URL do Evolution Go</p>
        <p>• <code>EVOLUTION_API_KEY</code> — API Key global</p>
        <p>• <code>EVOLUTION_INSTANCE_ID</code> — UUID da instância</p>
      </div>
    </div>
  );
}

export default function ConfigAtendimento() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações de Atendimento</h1>
        <p className="text-muted-foreground mt-1 text-sm">Gerencie setores, respostas rápidas e integração WhatsApp</p>
      </div>

      <Tabs defaultValue="setores">
        <TabsList className="rounded-xl">
          <TabsTrigger value="setores">Setores</TabsTrigger>
          <TabsTrigger value="respostas">Respostas Rápidas</TabsTrigger>
          <TabsTrigger value="webhook">WhatsApp / Webhook</TabsTrigger>
        </TabsList>
        <div className="mt-4">
          <TabsContent value="setores"><SetoresTab /></TabsContent>
          <TabsContent value="respostas"><RespostasTab /></TabsContent>
          <TabsContent value="webhook"><WebhookTab /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}