import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Wifi, Users, Monitor, Gamepad2, Video, Music, ChevronRight, ChevronLeft,
  CheckCircle, Star, Zap, Share2, RotateCcw
} from "lucide-react";

const STEPS = [
  {
    id: "pessoas",
    titulo: "Quantas pessoas usam a internet?",
    subtitulo: "Conte todos que moram na casa",
    tipo: "opcao",
    opcoes: [
      { label: "1 pessoa", value: 1, emoji: "🧑" },
      { label: "2 pessoas", value: 2, emoji: "👫" },
      { label: "3-4 pessoas", value: 3.5, emoji: "👨‍👩‍👧" },
      { label: "5 ou mais", value: 6, emoji: "👨‍👩‍👧‍👦" },
    ],
  },
  {
    id: "dispositivos",
    titulo: "Quantos dispositivos ao mesmo tempo?",
    subtitulo: "Celulares, TVs, notebooks, tablets...",
    tipo: "opcao",
    opcoes: [
      { label: "1-2 dispositivos", value: 2, emoji: "📱" },
      { label: "3-4 dispositivos", value: 4, emoji: "📱💻" },
      { label: "5-7 dispositivos", value: 6, emoji: "📱💻📺" },
      { label: "8 ou mais", value: 9, emoji: "🏠📡" },
    ],
  },
  {
    id: "uso",
    titulo: "Como você usa a internet?",
    subtitulo: "Selecione todas as atividades",
    tipo: "multiplo",
    opcoes: [
      { label: "Redes sociais", value: "social", peso: 1, emoji: "📲" },
      { label: "Streaming HD (Netflix, YouTube)", value: "streaming", peso: 3, emoji: "🎬" },
      { label: "Streaming 4K", value: "streaming4k", peso: 5, emoji: "📺" },
      { label: "Home office / Videoconferência", value: "homeoffice", peso: 4, emoji: "💼" },
      { label: "Games online", value: "games", peso: 4, emoji: "🎮" },
      { label: "Download de arquivos grandes", value: "downloads", peso: 3, emoji: "⬇️" },
      { label: "Câmeras de segurança", value: "cameras", peso: 2, emoji: "📷" },
    ],
  },
  {
    id: "prioridade",
    titulo: "O que é mais importante pra você?",
    subtitulo: "Escolha um",
    tipo: "opcao",
    opcoes: [
      { label: "Menor preço", value: "preco", emoji: "💰" },
      { label: "Melhor custo-benefício", value: "custo_beneficio", emoji: "⚖️" },
      { label: "Máxima velocidade", value: "velocidade", emoji: "🚀" },
    ],
  },
];

function calcularVelocidadeIdeal(respostas) {
  const { pessoas = 1, dispositivos = 2, uso = [], prioridade = "custo_beneficio" } = respostas;
  const basePessoas = pessoas * 5;
  const baseDisp = dispositivos * 3;
  const pesoUso = uso.reduce((acc, u) => {
    const op = STEPS[2].opcoes.find(o => o.value === u);
    return acc + (op?.peso || 0);
  }, 0);
  let mbps = basePessoas + baseDisp + pesoUso * 3;
  if (prioridade === "preco") mbps = Math.max(mbps * 0.7, 20);
  if (prioridade === "velocidade") mbps = mbps * 1.5;
  return Math.ceil(mbps / 10) * 10; // arredonda p/ dezena
}

function recomendar(planos, mbpsIdeal, prioridade) {
  const ativos = planos.filter(p => p.ativo !== false);
  if (!ativos.length) return [];
  const sorted = [...ativos].sort((a, b) => a.velocidade_mbps - b.velocidade_mbps);
  // plano ideal: primeiro que >= mbpsIdeal
  const ideal = sorted.find(p => p.velocidade_mbps >= mbpsIdeal) || sorted[sorted.length - 1];
  const idxIdeal = sorted.indexOf(ideal);
  // econômico: um abaixo do ideal
  const economico = idxIdeal > 0 ? sorted[idxIdeal - 1] : null;
  // premium: um acima do ideal
  const premium = idxIdeal < sorted.length - 1 ? sorted[idxIdeal + 1] : null;

  const resultado = [];
  if (economico && prioridade !== "velocidade") resultado.push({ ...economico, tag: "Econômico", destaque: false });
  resultado.push({ ...ideal, tag: prioridade === "velocidade" ? "Mais Rápido" : "Recomendado", destaque: true });
  if (premium) resultado.push({ ...premium, tag: "Premium", destaque: false });
  return resultado;
}

export default function Planometro() {
  const [step, setStep] = useState(0);
  const [respostas, setRespostas] = useState({});
  const [concluido, setConcluido] = useState(false);

  const { data: planos = [] } = useQuery({
    queryKey: ["planos"],
    queryFn: () => base44.entities.Plano.list(),
  });

  const stepAtual = STEPS[step];

  const handleOpcao = (value) => {
    const novas = { ...respostas, [stepAtual.id]: value };
    setRespostas(novas);
    if (step < STEPS.length - 1) {
      setTimeout(() => setStep(s => s + 1), 280);
    } else {
      setConcluido(true);
    }
  };

  const toggleMultiplo = (value) => {
    const atual = respostas[stepAtual.id] || [];
    const novo = atual.includes(value) ? atual.filter(v => v !== value) : [...atual, value];
    setRespostas({ ...respostas, [stepAtual.id]: novo });
  };

  const avancar = () => {
    if (step < STEPS.length - 1) setStep(s => s + 1);
    else setConcluido(true);
  };

  const reiniciar = () => {
    setStep(0);
    setRespostas({});
    setConcluido(false);
  };

  const mbpsIdeal = calcularVelocidadeIdeal(respostas);
  const recomendacoes = recomendar(planos, mbpsIdeal, respostas.prioridade);

  const compartilhar = () => {
    const rec = recomendacoes.find(r => r.destaque);
    if (!rec) return;
    const texto = `🚀 Fiz o Planômetro e o plano ideal pra minha casa é: ${rec.nome} (${rec.velocidade_mbps} Mbps) por R$ ${Number(rec.preco_mensal).toFixed(2)}/mês! Faça o seu:`;
    if (navigator.share) {
      navigator.share({ title: "Planômetro", text: texto, url: window.location.href });
    } else {
      navigator.clipboard.writeText(texto + " " + window.location.href);
    }
  };

  if (concluido) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-950 via-sky-900 to-slate-900 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-primary mx-auto mb-4 flex items-center justify-center shadow-lg shadow-primary/40">
              <Zap className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-white text-2xl font-bold">Resultado do Planômetro</h2>
            <p className="text-sky-300 mt-1">
              Para o seu perfil, a velocidade ideal é <span className="text-white font-bold">{mbpsIdeal} Mbps</span>
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {recomendacoes.map((plano) => (
              <div
                key={plano.id}
                className={`rounded-2xl p-6 border transition-all ${
                  plano.destaque
                    ? "bg-primary border-primary/60 shadow-xl shadow-primary/30 scale-105"
                    : "bg-white/10 border-white/20"
                }`}
              >
                {plano.destaque && (
                  <div className="flex items-center gap-1 mb-3">
                    <Star className="w-3.5 h-3.5 text-yellow-300 fill-yellow-300" />
                    <span className="text-yellow-300 text-xs font-bold uppercase tracking-wide">Recomendado</span>
                  </div>
                )}
                {!plano.destaque && (
                  <p className="text-sky-300 text-xs font-semibold uppercase tracking-wide mb-3">{plano.tag}</p>
                )}
                <h3 className="text-white font-bold text-lg">{plano.nome}</h3>
                <p className="text-4xl font-bold text-white mt-1">
                  {plano.velocidade_mbps}
                  <span className="text-base font-normal text-sky-200 ml-1">Mbps</span>
                </p>
                <p className={`text-2xl font-bold mt-3 ${plano.destaque ? "text-white" : "text-sky-200"}`}>
                  R$ {Number(plano.preco_mensal).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  <span className="text-sm font-normal text-sky-300">/mês</span>
                </p>
                {plano.descricao && <p className="text-sky-200 text-xs mt-2">{plano.descricao}</p>}
                <a href="/assine" className="block mt-4">
                  <Button className={`w-full rounded-xl text-sm font-semibold ${plano.destaque ? "bg-white text-primary hover:bg-sky-50" : "bg-white/20 hover:bg-white/30 text-white"}`}>
                    Assinar agora
                  </Button>
                </a>
              </div>
            ))}
          </div>

          {recomendacoes.length === 0 && (
            <div className="text-center text-sky-200 bg-white/10 rounded-2xl p-8 border border-white/20">
              <Wifi className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p>Nenhum plano cadastrado ainda. Configure seus planos no painel.</p>
            </div>
          )}

          <div className="flex justify-center gap-3 mt-8">
            <Button onClick={reiniciar} variant="ghost" className="text-sky-300 hover:text-white hover:bg-white/10 rounded-xl">
              <RotateCcw className="w-4 h-4" /> Refazer
            </Button>
            <Button onClick={compartilhar} className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl">
              <Share2 className="w-4 h-4" /> Compartilhar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-950 via-sky-900 to-slate-900 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary mx-auto mb-3 flex items-center justify-center shadow-lg shadow-primary/40">
            <Wifi className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-white text-2xl font-bold">Planômetro</h1>
          <p className="text-sky-300 text-sm mt-1">Descubra o plano ideal para o seu perfil</p>
        </div>

        {/* Progress */}
        <div className="flex gap-1.5 mb-8">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${i <= step ? "bg-primary" : "bg-white/20"}`} />
          ))}
        </div>

        {/* Card */}
        <div className="bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 p-8 shadow-2xl">
          <p className="text-sky-300 text-xs uppercase tracking-wider font-semibold mb-1">Passo {step + 1} de {STEPS.length}</p>
          <h2 className="text-white text-xl font-bold mb-1">{stepAtual.titulo}</h2>
          <p className="text-sky-300 text-sm mb-6">{stepAtual.subtitulo}</p>

          {stepAtual.tipo === "opcao" && (
            <div className="grid grid-cols-2 gap-3">
              {stepAtual.opcoes.map((op) => {
                const sel = respostas[stepAtual.id] === op.value;
                return (
                  <button
                    key={op.value}
                    onClick={() => handleOpcao(op.value)}
                    className={`p-4 rounded-2xl border text-left transition-all duration-200 hover:scale-105 active:scale-95 ${
                      sel
                        ? "bg-primary border-primary text-white shadow-lg shadow-primary/30"
                        : "bg-white/10 border-white/20 text-white hover:bg-white/20"
                    }`}
                  >
                    <span className="text-2xl block mb-1">{op.emoji}</span>
                    <span className="text-sm font-medium">{op.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {stepAtual.tipo === "multiplo" && (
            <div className="space-y-2">
              {stepAtual.opcoes.map((op) => {
                const sel = (respostas[stepAtual.id] || []).includes(op.value);
                return (
                  <button
                    key={op.value}
                    onClick={() => toggleMultiplo(op.value)}
                    className={`w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
                      sel
                        ? "bg-primary/80 border-primary text-white"
                        : "bg-white/10 border-white/20 text-white hover:bg-white/20"
                    }`}
                  >
                    <span className="text-xl">{op.emoji}</span>
                    <span className="text-sm font-medium flex-1">{op.label}</span>
                    {sel && <CheckCircle className="w-4 h-4 text-white" />}
                  </button>
                );
              })}
              <Button
                onClick={avancar}
                className="w-full mt-4 rounded-xl h-11 bg-primary hover:bg-primary/90"
                disabled={!(respostas[stepAtual.id]?.length > 0)}
              >
                Continuar <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Nav */}
        <div className="flex justify-between mt-6">
          <button
            onClick={() => setStep(s => Math.max(0, s - 1))}
            className="text-sky-300 hover:text-white text-sm flex items-center gap-1 transition-colors"
            disabled={step === 0}
          >
            <ChevronLeft className="w-4 h-4" /> Voltar
          </button>
          <span className="text-sky-400 text-xs">{step + 1}/{STEPS.length}</span>
        </div>
      </div>
    </div>
  );
}