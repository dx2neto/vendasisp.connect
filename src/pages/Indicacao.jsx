import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Gift, Share2, User, Phone, Mail, ArrowRight, Copy, MessageCircle } from "lucide-react";
import { toast, Toaster } from "sonner";

function gerarCodigo(nome) {
  const parte = nome.trim().split(" ")[0].toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5);
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${parte}${num}`;
}

export default function Indicacao() {
  const urlParams = new URLSearchParams(window.location.search);
  const codigoParam = urlParams.get("ref");

  const [fase, setFase] = useState("form"); // form | sucesso
  const [form, setForm] = useState({
    indicador_nome: "", indicador_telefone: "", indicador_email: "",
    indicado_nome: "", indicado_telefone: "", indicado_email: "",
  });
  const [codigoGerado, setCodigoGerado] = useState("");
  const queryClient = useQueryClient();

  const { data: configs = [] } = useQuery({
    queryKey: ["config-referral"],
    queryFn: () => base44.entities.ConfigReferral.list(),
  });

  const cfg = configs[0] || {
    titulo: "Indique e Ganhe!",
    descricao: "Indique um amigo, ele assina e você ganha uma recompensa exclusiva!",
    recompensa_tipo: "desconto",
    recompensa_valor: "10%",
    recompensa_descricao: "10% de desconto na próxima fatura",
  };

  const criarMutation = useMutation({
    mutationFn: async () => {
      if (!form.indicador_nome || !form.indicador_telefone || !form.indicado_nome || !form.indicado_telefone) {
        throw new Error("Preencha todos os campos obrigatórios");
      }

      const codigo = codigoParam || gerarCodigo(form.indicador_nome);

      // Criar lead para o indicado
      const lead = await base44.entities.Lead.create({
        nome: form.indicado_nome,
        telefone: form.indicado_telefone,
        email: form.indicado_email,
        canal_origem: "site",
        etapa_funil: "novo",
        data_entrada: new Date().toISOString(),
        observacao: `Indicado por ${form.indicador_nome} (${form.indicador_telefone}) — Código: ${codigo}`,
        historico_notas: [{
          data: new Date().toISOString(),
          autor: "Sistema",
          nota: `Lead captado via Programa de Indicação. Indicador: ${form.indicador_nome} (${form.indicador_telefone})`,
          tipo: "observacao",
        }],
      });

      // Criar registro de indicação
      await base44.entities.Indicacao.create({
        ...form,
        codigo_indicacao: codigo,
        status: "pendente",
        recompensa_tipo: cfg.recompensa_tipo || "desconto",
        recompensa_valor: cfg.recompensa_valor || "10%",
        lead_id: lead.id,
      });

      return codigo;
    },
    onSuccess: (codigo) => {
      setCodigoGerado(codigo);
      setFase("sucesso");
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const linkCompartilhar = `${window.location.origin}/indicacao?ref=${codigoGerado}`;
  const msgWhatsApp = cfg.whatsapp_mensagem
    ? encodeURIComponent(cfg.whatsapp_mensagem.replace("{link}", linkCompartilhar).replace("{nome}", form.indicado_nome))
    : encodeURIComponent(`Olá! Me tornei cliente da internet e estou te indicando. Assine pelo link e garanta sua conexão: ${linkCompartilhar}`);

  const TIPO_EMOJI = { desconto: "💰", credito: "💳", brinde: "🎁", mes_gratis: "📅" };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 flex flex-col">
      <Toaster position="top-center" />

      {/* Header */}
      <div className="text-center pt-12 pb-6 px-4">
        <div className="inline-flex items-center gap-2 bg-white/15 border border-white/20 rounded-full px-4 py-1.5 text-white text-sm font-semibold mb-4">
          <Gift className="w-4 h-4" /> Programa de Indicação
        </div>
        <h1 className="text-4xl sm:text-5xl font-black text-white mb-3 drop-shadow">
          {cfg.titulo}
        </h1>
        <p className="text-emerald-200 text-lg max-w-md mx-auto">
          {cfg.descricao}
        </p>
      </div>

      {/* Recompensa destaque */}
      <div className="flex justify-center px-4 mb-8">
        <div className="bg-yellow-400/20 border border-yellow-400/40 rounded-2xl px-8 py-4 text-center">
          <p className="text-yellow-300 text-xs font-bold uppercase tracking-widest mb-1">Sua recompensa</p>
          <p className="text-white font-black text-3xl">
            {TIPO_EMOJI[cfg.recompensa_tipo]} {cfg.recompensa_valor}
          </p>
          <p className="text-yellow-200 text-sm mt-1">{cfg.recompensa_descricao || cfg.recompensa_valor}</p>
          <p className="text-yellow-300/70 text-xs mt-1">após a venda ser confirmada</p>
        </div>
      </div>

      <div className="flex-1 flex justify-center px-4 pb-12">
        <div className="w-full max-w-xl">

          {/* FASE: Formulário */}
          {fase === "form" && (
            <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6">
              <div>
                <h2 className="text-xl font-black text-foreground">Preencha os dados</h2>
                <p className="text-muted-foreground text-sm mt-1">Seus dados + dados do amigo que vai assinar</p>
              </div>

              {/* Dados do indicador */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Seus dados</p>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input required placeholder="Seu nome completo *" value={form.indicador_nome} onChange={set("indicador_nome")} className="pl-10 rounded-xl" />
                </div>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input required placeholder="Seu WhatsApp / Telefone *" value={form.indicador_telefone} onChange={set("indicador_telefone")} className="pl-10 rounded-xl" />
                </div>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input type="email" placeholder="Seu e-mail (opcional)" value={form.indicador_email} onChange={set("indicador_email")} className="pl-10 rounded-xl" />
                </div>
              </div>

              <div className="border-t border-border" />

              {/* Dados do indicado */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Dados do amigo indicado</p>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input required placeholder="Nome do amigo *" value={form.indicado_nome} onChange={set("indicado_nome")} className="pl-10 rounded-xl" />
                </div>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input required placeholder="WhatsApp do amigo *" value={form.indicado_telefone} onChange={set("indicado_telefone")} className="pl-10 rounded-xl" />
                </div>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input type="email" placeholder="E-mail do amigo (opcional)" value={form.indicado_email} onChange={set("indicado_email")} className="pl-10 rounded-xl" />
                </div>
              </div>

              <Button
                onClick={() => criarMutation.mutate()}
                disabled={criarMutation.isPending}
                className="w-full h-12 rounded-xl text-base font-bold gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90"
              >
                {criarMutation.isPending ? "Enviando..." : <><Gift className="w-5 h-5" /> Enviar Indicação <ArrowRight className="w-4 h-4" /></>}
              </Button>
            </div>
          )}

          {/* FASE: Sucesso */}
          {fase === "sucesso" && (
            <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-9 h-9 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-foreground">Indicação enviada!</h2>
                <p className="text-muted-foreground text-sm mt-2">
                  Assim que <strong>{form.indicado_nome}</strong> assinar, você recebe <strong>{cfg.recompensa_valor}</strong> automaticamente!
                </p>
              </div>

              {/* Código */}
              <div className="bg-muted rounded-2xl p-4">
                <p className="text-xs text-muted-foreground font-semibold mb-2">SEU CÓDIGO DE INDICAÇÃO</p>
                <div className="flex items-center gap-2 justify-center">
                  <p className="text-2xl font-mono font-black text-primary tracking-widest">{codigoGerado}</p>
                  <button onClick={() => { navigator.clipboard.writeText(codigoGerado); toast.success("Código copiado!"); }} className="p-1.5 rounded-lg hover:bg-background transition-colors">
                    <Copy className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
              </div>

              {/* Compartilhar */}
              <div className="space-y-3">
                <p className="text-sm font-semibold text-foreground">Compartilhe e indique mais amigos!</p>
                <div className="flex gap-2">
                  <div className="flex-1 bg-muted rounded-xl px-3 py-2 text-xs font-mono text-muted-foreground truncate">
                    {linkCompartilhar}
                  </div>
                  <Button
                    variant="outline" size="icon"
                    className="rounded-xl shrink-0"
                    onClick={() => { navigator.clipboard.writeText(linkCompartilhar); toast.success("Link copiado!"); }}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <Button asChild className="w-full rounded-xl h-11 gap-2 bg-green-600 hover:bg-green-700 font-bold">
                  <a href={`https://wa.me/?text=${msgWhatsApp}`} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="w-5 h-5" /> Compartilhar no WhatsApp
                  </a>
                </Button>
              </div>

              <Button
                variant="ghost" size="sm"
                className="text-muted-foreground"
                onClick={() => { setFase("form"); setForm({ indicador_nome: "", indicador_telefone: "", indicador_email: "", indicado_nome: "", indicado_telefone: "", indicado_email: "" }); }}
              >
                Indicar outro amigo
              </Button>
            </div>
          )}

          {/* Como funciona */}
          {fase === "form" && (
            <div className="mt-6 grid grid-cols-3 gap-3 text-center">
              {[
                { n: "1", label: "Você indica", sub: "Preenche os dados do amigo" },
                { n: "2", label: "Amigo assina", sub: "Nossa equipe entra em contato" },
                { n: "3", label: "Você ganha", sub: cfg.recompensa_valor || "sua recompensa" },
              ].map(s => (
                <div key={s.n} className="bg-white/10 border border-white/20 rounded-2xl p-3">
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-2 text-white font-black">{s.n}</div>
                  <p className="text-white font-bold text-xs">{s.label}</p>
                  <p className="text-emerald-300 text-xs mt-0.5">{s.sub}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}