import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Wifi, Users, Monitor, Gamepad2, Video, Music2,
  CheckCircle2, ChevronRight, ChevronLeft, Zap, Star, Phone
} from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = ["pessoas", "dispositivos", "uso", "resultado"];

const USO_OPCOES = [
  { id: "basico", label: "Básico", desc: "Redes sociais, WhatsApp e e-mail", icon: Music2, mbps: 20 },
  { id: "streaming", label: "Streaming", desc: "Netflix, YouTube e videochamadas", icon: Video, mbps: 50 },
  { id: "games", label: "Games", desc: "Jogos online e downloads pesados", icon: Gamepad2, mbps: 100 },
  { id: "homeoffice", label: "Home Office", desc: "Trabalho remoto, reuniões e cloud", icon: Monitor, mbps: 80 },
];

function calcularVelocidade(pessoas, dispositivos, usos) {
  const basePorPessoa = pessoas * 10;
  const basePorDispositivo = dispositivos * 5;
  const maxUso = usos.reduce((acc, u) => {
    const op = USO_OPCOES.find(o => o.id === u);
    return Math.max(acc, op ? op.mbps : 0);
  }, 0);
  const extra = usos.length > 1 ? (usos.length - 1) * 20 : 0;
  return basePorPessoa + basePorDispositivo + maxUso + extra;
}

function StepIndicator({ current }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all",
            i < STEPS.indexOf(STEPS[current]) ? "bg-primary text-white" :
            i === STEPS.indexOf(STEPS[current]) ? "bg-primary text-white ring-4 ring-primary/20" :
            "bg-muted text-muted-foreground"
          )}>
            {i < STEPS.indexOf(STEPS[current]) ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
          </div>
          {i < STEPS.length - 1 && (
            <div className={cn(
              "w-8 h-0.5 rounded",
              i < STEPS.indexOf(STEPS[current]) ? "bg-primary" : "bg-muted"
            )} />
          )}
        </div>
      ))}
    </div>
  );
}

function CounterInput({ value, onChange, min = 1, max = 20 }) {
  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-10 h-10 rounded-full border-2 border-border flex items-center justify-center text-lg font-bold hover:border-primary hover:text-primary transition-colors disabled:opacity-30"
        disabled={value <= min}
      >−</button>
      <span className="text-4xl font-bold w-12 text-center">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        className="w-10 h-10 rounded-full border-2 border-border flex items-center justify-center text-lg font-bold hover:border-primary hover:text-primary transition-colors disabled:opacity-30"
        disabled={value >= max}
      >+</button>
    </div>
  );
}

export default function Planometro() {
  const [step, setStep] = useState(0);
  const [pessoas, setPessoas] = useState(2);
  const [dispositivos, setDispositivos] = useState(3);
  const [usos, setUsos] = useState([]);
  const [showContact, setShowContact] = useState(false);
  const [contact, setContact] = useState({ nome: "", telefone: "" });
  const [enviado, setEnviado] = useState(false);

  const { data: planos = [] } = useQuery({
    queryKey: ["planos-publicos"],
    queryFn: () => base44.entities.Plano.filter({ ativo: true }),
  });

  const { data: siteConfig } = useQuery({
    queryKey: ["site-config"],
    queryFn: async () => {
      const list = await base44.entities.SiteConfig.list();
      return list[0] || null;
    },
  });

  const velocidadeNecessaria = calcularVelocidade(pessoas, dispositivos, usos);

  const planosOrdenados = [...planos].sort((a, b) => a.velocidade_mbps - b.velocidade_mbps);

  const planoRecomendado = planosOrdenados.find(p => p.velocidade_mbps >= velocidadeNecessaria)
    || planosOrdenados[planosOrdenados.length - 1];

  const toggleUso = (id) => {
    setUsos(prev => prev.includes(id) ? prev.filter(u => u !== id) : [...prev, id]);
  };

  const canNext = () => {
    if (step === 2) return usos.length > 0;
    return true;
  };

  const handleContato = async (e) => {
    e.preventDefault();
    await base44.entities.Lead.create({
      nome: contact.nome,
      telefone: contact.telefone,
      canal_origem: "site",
      etapa_funil: "novo",
      plano_interesse: planoRecomendado?.nome || "",
      observacao: `Planômetro: ${pessoas} pessoa(s), ${dispositivos} dispositivo(s), usos: ${usos.join(", ")}. Velocidade sugerida: ${velocidadeNecessaria} Mbps.`,
    });
    setEnviado(true);
  };

  const whatsapp = siteConfig?.whatsapp;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-sky-950 to-slate-900 flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 bg-primary/20 border border-primary/30 text-primary px-4 py-1.5 rounded-full text-sm font-medium mb-4">
          <Zap className="w-3.5 h-3.5" />
          Planômetro
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white">Qual plano é ideal pra você?</h1>
        <p className="text-slate-400 mt-2">Responda 3 perguntas e descubra em segundos</p>
      </div>

      <div className="w-full max-w-lg">
        <StepIndicator current={step} />

        <div className="bg-white/5 border border-white/10 backdrop-blur-sm rounded-3xl p-8">

          {/* Step 0: Pessoas */}
          {step === 0 && (
            <div className="text-center space-y-8">
              <div>
                <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-xl font-bold text-white">Quantas pessoas usam a internet?</h2>
                <p className="text-slate-400 text-sm mt-1">Moradores ou usuários simultâneos</p>
              </div>
              <CounterInput value={pessoas} onChange={setPessoas} min={1} max={15} />
              <p className="text-slate-400 text-sm">
                {pessoas === 1 ? "Uso individual" : pessoas <= 3 ? "Família pequena" : pessoas <= 6 ? "Família média" : "Grande família / escritório"}
              </p>
            </div>
          )}

          {/* Step 1: Dispositivos */}
          {step === 1 && (
            <div className="text-center space-y-8">
              <div>
                <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-4">
                  <Monitor className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-xl font-bold text-white">Quantos dispositivos conectados?</h2>
                <p className="text-slate-400 text-sm mt-1">Celulares, TVs, notebooks, tablets…</p>
              </div>
              <CounterInput value={dispositivos} onChange={setDispositivos} min={1} max={20} />
              <p className="text-slate-400 text-sm">
                {dispositivos <= 2 ? "Poucos aparelhos" : dispositivos <= 5 ? "Quantidade moderada" : dispositivos <= 10 ? "Muitos dispositivos" : "Alta demanda de rede"}
              </p>
            </div>
          )}

          {/* Step 2: Uso */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="text-center">
                <h2 className="text-xl font-bold text-white">Como você usa a internet?</h2>
                <p className="text-slate-400 text-sm mt-1">Selecione tudo que se aplica</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                {USO_OPCOES.map(op => {
                  const selected = usos.includes(op.id);
                  return (
                    <button
                      key={op.id}
                      type="button"
                      onClick={() => toggleUso(op.id)}
                      className={cn(
                        "flex items-start gap-3 p-4 rounded-2xl border-2 text-left transition-all",
                        selected
                          ? "border-primary bg-primary/10 text-white"
                          : "border-white/10 text-slate-300 hover:border-primary/40 hover:bg-white/5"
                      )}
                    >
                      <div className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0",
                        selected ? "bg-primary" : "bg-white/10"
                      )}>
                        <op.icon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{op.label}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{op.desc}</p>
                      </div>
                      {selected && <CheckCircle2 className="w-4 h-4 text-primary ml-auto flex-shrink-0 mt-0.5" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 3: Resultado */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-xs font-semibold mb-3">
                  <Star className="w-3 h-3" /> Recomendação personalizada
                </div>
                <h2 className="text-xl font-bold text-white">Você precisa de pelo menos</h2>
                <p className="text-5xl font-black text-primary mt-2">{velocidadeNecessaria} Mbps</p>
              </div>

              {planoRecomendado ? (
                <div className="rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 p-6">
                  <div className="flex items-center gap-2 mb-1">
                    <Wifi className="w-5 h-5 text-primary" />
                    <Badge className="bg-primary text-white text-xs">Plano Ideal</Badge>
                  </div>
                  <h3 className="text-2xl font-bold text-white mt-2">{planoRecomendado.nome}</h3>
                  <p className="text-4xl font-black text-primary mt-1">
                    {planoRecomendado.velocidade_mbps} <span className="text-lg font-normal text-slate-400">Mbps</span>
                  </p>
                  <p className="text-2xl font-bold text-white mt-3">
                    R$ {Number(planoRecomendado.preco_mensal).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    <span className="text-sm font-normal text-slate-400">/mês</span>
                  </p>
                  {planoRecomendado.descricao && (
                    <p className="text-sm text-slate-400 mt-2">{planoRecomendado.descricao}</p>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 p-6 text-center text-slate-400">
                  <p>Nenhum plano cadastrado ainda. Fale conosco!</p>
                </div>
              )}

              {/* Outros planos */}
              {planosOrdenados.length > 1 && (
                <div>
                  <p className="text-xs text-slate-500 uppercase font-semibold mb-2 tracking-wider">Outros planos disponíveis</p>
                  <div className="space-y-2">
                    {planosOrdenados.filter(p => p.id !== planoRecomendado?.id).map(p => (
                      <div key={p.id} className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3 border border-white/5">
                        <div className="flex items-center gap-2">
                          <Wifi className="w-4 h-4 text-slate-400" />
                          <span className="text-slate-300 text-sm font-medium">{p.nome} — {p.velocidade_mbps} Mbps</span>
                        </div>
                        <span className="text-slate-400 text-sm">R$ {Number(p.preco_mensal).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CTA */}
              {!enviado ? (
                !showContact ? (
                  <div className="flex flex-col gap-3 pt-2">
                    <Button onClick={() => setShowContact(true)} className="w-full rounded-xl h-12 text-base font-bold gap-2">
                      <Phone className="w-4 h-4" /> Quero contratar agora
                    </Button>
                    {whatsapp && (
                      <a
                        href={`https://wa.me/55${whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(`Olá! Fiz o Planômetro e o plano ideal pra mim é o *${planoRecomendado?.nome}* (${velocidadeNecessaria} Mbps). Quero saber mais!`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full h-12 rounded-xl border-2 border-white/10 text-white font-semibold text-sm hover:bg-white/5 transition-colors"
                      >
                        💬 Chamar no WhatsApp
                      </a>
                    )}
                  </div>
                ) : (
                  <form onSubmit={handleContato} className="space-y-3 pt-2">
                    <p className="text-sm text-slate-300 font-medium">Deixe seu contato e te ligamos:</p>
                    <input
                      required
                      placeholder="Seu nome completo"
                      value={contact.nome}
                      onChange={e => setContact(p => ({ ...p, nome: e.target.value }))}
                      className="w-full rounded-xl bg-white/10 border border-white/10 text-white placeholder-slate-500 px-4 py-3 text-sm focus:outline-none focus:border-primary"
                    />
                    <input
                      required
                      placeholder="Telefone com DDD"
                      value={contact.telefone}
                      onChange={e => setContact(p => ({ ...p, telefone: e.target.value }))}
                      className="w-full rounded-xl bg-white/10 border border-white/10 text-white placeholder-slate-500 px-4 py-3 text-sm focus:outline-none focus:border-primary"
                    />
                    <Button type="submit" className="w-full rounded-xl h-11 font-bold">
                      Enviar e aguardar contato
                    </Button>
                  </form>
                )
              ) : (
                <div className="text-center py-4">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                  <p className="text-white font-bold text-lg">Recebemos seu contato!</p>
                  <p className="text-slate-400 text-sm mt-1">Nossa equipe vai te ligar em breve para ativar o plano.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        {step < 3 && (
          <div className="flex justify-between mt-6">
            <Button
              variant="ghost"
              onClick={() => setStep(s => s - 1)}
              disabled={step === 0}
              className="text-slate-400 hover:text-white gap-2 rounded-xl"
            >
              <ChevronLeft className="w-4 h-4" /> Voltar
            </Button>
            <Button
              onClick={() => setStep(s => s + 1)}
              disabled={!canNext()}
              className="gap-2 rounded-xl px-8"
            >
              {step === 2 ? "Ver recomendação" : "Próximo"} <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {step === 3 && (
          <div className="flex justify-center mt-6">
            <button
              onClick={() => { setStep(0); setUsos([]); setShowContact(false); setEnviado(false); }}
              className="text-slate-500 hover:text-slate-300 text-sm underline transition-colors"
            >
              Refazer o teste
            </button>
          </div>
        )}
      </div>
    </div>
  );
}