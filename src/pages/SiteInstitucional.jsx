import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import {
  Wifi, Zap, Star, Phone, Mail, MapPin, Download, Film, Gamepad2,
  Music, Signal, ArrowRight, CheckCircle2, Gift, Menu, X, Users
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const BENEFICIOS = [
  { icon: Download, label: "Downloads", sub: "+ rápidos" },
  { icon: Film, label: "Filmes com", sub: "+ resolução" },
  { icon: Gamepad2, label: "Jogue +", sub: "sem travar" },
  { icon: Music, label: "Ouça +", sub: "músicas" },
  { icon: Signal, label: "+ Conexões", sub: "simultâneas" },
];

const DEFAULT_PLANOS_RESIDENCIAL = [
  { nome: "100 MEGA", velocidade_mbps: 100, preco_mensal: 79.90, upload: 50 },
  { nome: "300 MEGA", velocidade_mbps: 300, preco_mensal: 99.90, upload: 150, popular: true },
  { nome: "500 MEGA", velocidade_mbps: 500, preco_mensal: 119.90, upload: 250 },
  { nome: "1 GIGA", velocidade_mbps: 1000, preco_mensal: 199.90, upload: 500 },
];

const DEFAULT_PLANOS_EMPRESARIAL = [
  { nome: "100 MEGA", velocidade_mbps: 100, preco_mensal: 79.90, upload: 50 },
  { nome: "300 MEGA", velocidade_mbps: 300, preco_mensal: 99.90, upload: 150, popular: true },
  { nome: "500 MEGA", velocidade_mbps: 500, preco_mensal: 119.90, upload: 250 },
  { nome: "1 GIGA", velocidade_mbps: 1000, preco_mensal: 199.90, upload: 500 },
];

const DEFAULT_DEPOIMENTOS = [
  { nome: "Carlos S.", texto: "Melhor internet que já tive. Instalaram em 2 dias e funciona perfeitamente.", nota: 5 },
  { nome: "Ana P.", texto: "Streaming e home office sem travamentos. Superou minhas expectativas!", nota: 5 },
  { nome: "Roberto M.", texto: "Atendimento excelente. Recomendo pra todo mundo da região.", nota: 5 },
];

function Stars({ n = 5 }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: n }).map((_, i) => (
        <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
      ))}
    </div>
  );
}

function PlanoCard({ plano, waLink, empresarial }) {
  const isPopular = plano.popular;
  return (
    <div className={cn(
      "relative rounded-3xl border-2 p-6 flex flex-col bg-white transition-all hover:shadow-2xl hover:-translate-y-1",
      isPopular ? "border-orange-500 shadow-xl scale-105 z-10" : "border-gray-200"
    )}>
      {isPopular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-orange-500 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-md">
          ⭐ MAIS POPULAR
        </div>
      )}
      <h3 className="text-2xl font-black text-blue-900 mb-1">{plano.nome}</h3>
      <ul className="space-y-1.5 text-sm text-gray-600 mb-5">
        <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-orange-500 flex-shrink-0" />Download {plano.velocidade_mbps >= 1000 ? `${plano.velocidade_mbps / 1000} Gbps` : `${plano.velocidade_mbps} Mbps`}</li>
        <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-orange-500 flex-shrink-0" />Upload {plano.upload} Mbps</li>
        <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-orange-500 flex-shrink-0" />Instalação Grátis</li>
        <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-orange-500 flex-shrink-0" />Wi-fi incluso</li>
        {empresarial && <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-orange-500 flex-shrink-0" />Suporte exclusivo</li>}
      </ul>
      <div className="mb-5">
        <p className="text-xs text-gray-400 uppercase font-semibold mb-0.5">Por apenas:</p>
        <div className="flex items-end gap-1">
          <span className="text-4xl font-black text-blue-900">R$ {plano.preco_mensal?.toFixed(2).replace(".", ",")}</span>
        </div>
        <p className="text-sm text-gray-400 font-medium uppercase mt-0.5">MENSAIS</p>
      </div>
      <div className="flex flex-col gap-2 mt-auto">
        <Button
          asChild
          className={cn(
            "w-full rounded-2xl h-12 font-bold text-base gap-2",
            isPopular
              ? "bg-orange-500 hover:bg-orange-600 text-white"
              : "bg-blue-700 hover:bg-blue-800 text-white"
          )}
        >
          <Link to="/assine">🚀 Assinar online</Link>
        </Button>
        <a href={waLink} target="_blank" rel="noopener noreferrer"
          className="w-full text-center text-xs text-gray-500 hover:text-green-600 font-semibold py-1.5 rounded-xl border border-gray-200 hover:border-green-300 transition-all">
          💬 Falar no WhatsApp
        </a>
      </div>
    </div>
  );
}

export default function SiteInstitucional() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [abaPlanos, setAbaPlanos] = useState("residencial");

  const { data: configs = [] } = useQuery({
    queryKey: ["site-config"],
    queryFn: () => base44.entities.SiteConfig.list(),
  });

  const { data: planosDB = [] } = useQuery({
    queryKey: ["planos-ativos"],
    queryFn: () => base44.entities.Plano.filter({ ativo: true }),
  });

  const { data: depoimentosDB = [] } = useQuery({
    queryKey: ["indicacoes-depoimentos"],
    queryFn: () => base44.entities.Indicacao.list("-created_date", 10),
  });

  const cfg = configs[0] || {};
  const nome = cfg.nome_empresa || "Connect Telecom";
  const whatsapp = cfg.whatsapp || "556434347600";
  const waLink = `https://api.whatsapp.com/send/?phone=${whatsapp.replace(/\D/g, "")}`;

  const planosOrdenados = [...planosDB].sort((a, b) => a.preco_mensal - b.preco_mensal);
  const planosMid = Math.floor(planosOrdenados.length / 2);
  const planosComPopular = planosOrdenados.map((p, i) => ({ ...p, popular: i === planosMid }));

  const planosExibidos = planosComPopular.length > 0 ? planosComPopular : DEFAULT_PLANOS_RESIDENCIAL;
  const depoimentos = cfg.depoimentos?.length ? cfg.depoimentos : DEFAULT_DEPOIMENTOS;

  const navLinks = [
    { label: "Quem somos", href: "#sobre" },
    { label: "Planos residenciais", href: "#planos" },
    { label: "Planos empresariais", href: "#planos" },
    { label: "Fale conosco", href: "#contato" },
  ];

  return (
    <div className="min-h-screen bg-white font-body">

      {/* ── NAVBAR ── */}
      <nav className="sticky top-0 z-50 bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {cfg.logo_url ? (
              <img src={cfg.logo_url} alt={nome} className="h-10 object-contain" />
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
                  <Wifi className="w-5 h-5 text-white" />
                </div>
                <div className="leading-tight">
                  <p className="font-black text-blue-700 text-lg leading-none">CONNECT</p>
                  <p className="text-[10px] font-bold text-gray-400 tracking-widest">TELECOM</p>
                </div>
              </div>
            )}
          </div>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-7 text-sm font-semibold text-gray-600">
            {navLinks.map(l => (
              <a key={l.label} href={l.href} className="hover:text-blue-600 transition-colors">{l.label}</a>
            ))}
            <a href="#embaixador" className="hover:text-blue-600 transition-colors">Embaixador</a>
          </div>

          <div className="hidden lg:flex items-center gap-3">
            <Button asChild className="rounded-full h-10 px-6 bg-orange-500 hover:bg-orange-600 text-white font-bold gap-2 shadow-md">
              <a href={waLink} target="_blank" rel="noopener noreferrer">
                <Phone className="w-4 h-4" /> Assine agora
              </a>
            </Button>
            <Button asChild variant="outline" className="rounded-full h-10 px-6 border-2 border-blue-700 text-blue-700 font-bold hover:bg-blue-50 gap-2">
              <Link to="/assine">
                <Users className="w-4 h-4" /> Área do cliente
              </Link>
            </Button>
          </div>

          {/* Mobile menu */}
          <button className="lg:hidden p-2" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {menuOpen && (
          <div className="lg:hidden bg-white border-t px-4 py-4 space-y-3">
            {navLinks.map(l => (
              <a key={l.label} href={l.href} className="block py-2 text-sm font-semibold text-gray-700 hover:text-blue-600" onClick={() => setMenuOpen(false)}>{l.label}</a>
            ))}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button asChild className="rounded-full bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm">
                <a href={waLink} target="_blank" rel="noopener noreferrer">📞 Assine agora</a>
              </Button>
              <Button asChild variant="outline" className="rounded-full border-2 border-blue-700 text-blue-700 font-bold text-sm">
                <Link to="/assine" onClick={() => setMenuOpen(false)}>🚀 Online</Link>
              </Button>
            </div>
          </div>
        )}
      </nav>

      {/* ── HERO ── */}
      <section className="relative bg-blue-700 overflow-hidden min-h-[420px] sm:min-h-[520px] flex items-center">
        {/* BG gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-800 via-blue-700 to-blue-600" />
        <div className="absolute right-0 top-0 h-full w-1/2 bg-gradient-to-l from-blue-500/30 to-transparent" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-16 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center w-full">
          <div className="text-white">
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black leading-tight mb-4">
              Internet 100%<br />
              <span className="text-orange-400">Fibra Óptica</span>
            </h1>
            <p className="text-xl sm:text-3xl font-bold text-white/90 mb-6 sm:mb-8">
              Pra você aproveitar<br />ao máximo!
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild size="lg" className="rounded-full h-14 px-10 text-lg font-bold bg-orange-500 hover:bg-orange-600 text-white shadow-xl gap-2">
                <a href={waLink} target="_blank" rel="noopener noreferrer">
                  <Phone className="w-5 h-5" /> Assine agora
                </a>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full h-14 px-10 text-lg font-bold border-2 border-white text-white hover:bg-white/10 gap-2">
                <a href="#planos">Ver planos <ArrowRight className="w-5 h-5" /></a>
              </Button>
            </div>
          </div>

          {/* Right side image placeholder with vibrant overlay */}
          <div className="hidden lg:flex justify-center relative">
            <div className="w-80 h-80 rounded-full bg-blue-500/30 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 blur-3xl" />
            <img
              src="https://images.unsplash.com/photo-1522529599102-193c0d76b5b6?w=600&auto=format&fit=crop&q=80"
              alt="Internet rápida"
              className="relative rounded-3xl w-full max-w-sm object-cover h-72 shadow-2xl"
            />
          </div>
        </div>
      </section>

      {/* ── BENEFÍCIOS CARDS ── */}
      <section className="bg-white py-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 -mt-8">
            {BENEFICIOS.map((b, i) => {
              const Icon = b.icon;
              return (
                <div key={i} className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5 flex flex-col items-center text-center hover:shadow-xl transition-all hover:-translate-y-1">
                  <div className="w-14 h-14 rounded-full bg-orange-50 flex items-center justify-center mb-3">
                    <Icon className="w-7 h-7 text-orange-500" />
                  </div>
                  <p className="text-sm font-bold text-gray-800 leading-snug">{b.label}</p>
                  <p className="text-sm text-gray-500 leading-snug">{b.sub}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── PLANOS ── */}
      <section id="planos" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <h2 className="text-4xl sm:text-5xl font-black text-blue-900 text-center mb-10">
            Conheça nossos planos
          </h2>

          {/* Tabs residencial/empresarial */}
          <div className="flex justify-center mb-10">
            <div className="inline-flex bg-white rounded-full border border-gray-200 shadow p-1 gap-1">
              <button
                onClick={() => setAbaPlanos("residencial")}
                className={cn(
                  "px-6 py-2.5 rounded-full text-sm font-bold transition-all",
                  abaPlanos === "residencial"
                    ? "bg-blue-700 text-white shadow"
                    : "text-gray-500 hover:text-blue-700"
                )}
              >
                Planos Residenciais
              </button>
              <button
                onClick={() => setAbaPlanos("empresarial")}
                className={cn(
                  "px-6 py-2.5 rounded-full text-sm font-bold transition-all",
                  abaPlanos === "empresarial"
                    ? "bg-blue-700 text-white shadow"
                    : "text-gray-500 hover:text-blue-700"
                )}
              >
                Planos Empresariais
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
            {planosExibidos.map((plano, i) => (
              <PlanoCard
                key={plano.id || i}
                plano={plano}
                waLink={waLink}
                empresarial={abaPlanos === "empresarial"}
              />
            ))}
          </div>
          {/* CTA rápido abaixo dos planos */}
          <div className="mt-10 text-center">
            <p className="text-gray-600 text-base mb-4">Prefere assinar 100% online, sem sair de casa?</p>
            <Link to="/assine">
              <Button size="lg" className="rounded-full h-14 px-12 text-lg font-bold bg-blue-700 hover:bg-blue-800 text-white gap-2 shadow-lg">
                Assinar agora online <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── ENTRETENIMENTO / CTA ── */}
      <section id="sobre" className="py-20 bg-blue-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <img
                src="https://images.unsplash.com/photo-1593784991095-a205069470b6?w=700&auto=format&fit=crop&q=80"
                alt="Entretenimento"
                className="rounded-3xl w-full object-cover h-72 shadow-2xl"
              />
            </div>
            <div className="text-white">
              <h2 className="text-3xl sm:text-4xl font-black leading-tight mb-4">
                Aqui a diversão e o entretenimento estão garantidos!
              </h2>
              <p className="text-white/80 text-lg leading-relaxed mb-8">
                Com a nossa internet você assiste seus filmes e séries com a melhor qualidade,
                joga seus games sem lag e ouve suas músicas sem interrupções!
              </p>
              <Button asChild size="lg" className="rounded-full h-14 px-10 text-lg font-bold bg-orange-500 hover:bg-orange-600 text-white shadow-xl gap-2">
                <a href={waLink} target="_blank" rel="noopener noreferrer">
                  Assine agora! <ArrowRight className="w-5 h-5" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── EMBAIXADOR ── */}
      <section id="embaixador" className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <div className="bg-gradient-to-br from-blue-700 to-blue-900 rounded-3xl p-10 text-white shadow-2xl">
            <div className="text-5xl mb-4">🎁</div>
            <h2 className="text-3xl sm:text-4xl font-black mb-3">Seja nosso Embaixador!</h2>
            <p className="text-white/80 text-lg mb-8 max-w-md mx-auto">
              Indique amigos e ganhe recompensas exclusivas. Quanto mais você indica, mais você ganha!
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="rounded-full h-14 px-10 text-lg font-bold bg-orange-500 hover:bg-orange-600 text-white gap-2">
                <Link to="/roleta"><Gift className="w-5 h-5" /> Quero meu prêmio!</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full h-14 px-10 text-lg font-bold border-2 border-white text-white hover:bg-white/10 gap-2">
                <a href={waLink} target="_blank" rel="noopener noreferrer">
                  <Phone className="w-5 h-5" /> Falar com consultor
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── DEPOIMENTOS ── */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <h2 className="text-3xl sm:text-4xl font-black text-blue-900 text-center mb-10">
            Quem já é cliente aprova ❤️
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {depoimentos.map((d, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all">
                <Stars n={d.nota || 5} />
                <p className="text-gray-700 text-sm leading-relaxed mt-3 mb-4">"{d.texto}"</p>
                <p className="text-gray-400 text-xs font-bold">{d.nome}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CONTATO ── */}
      <section id="contato" className="py-20 bg-blue-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-black mb-4">
                Pronto para ter internet de verdade?
              </h2>
              <p className="text-blue-300 text-lg mb-8">
                Entre em contato agora. Nossa equipe responde em minutos.
              </p>
              <div className="space-y-4">
                {(cfg.whatsapp || whatsapp) && (
                  <a href={waLink} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 text-blue-200 hover:text-white transition-colors">
                    <div className="w-12 h-12 rounded-2xl bg-green-600 flex items-center justify-center flex-shrink-0">
                      <Phone className="w-6 h-6" />
                    </div>
                    <span className="font-semibold">{cfg.whatsapp || "(64) 3434-7600"}</span>
                  </a>
                )}
                {cfg.email_contato && (
                  <a href={`mailto:${cfg.email_contato}`}
                    className="flex items-center gap-3 text-blue-200 hover:text-white transition-colors">
                    <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center flex-shrink-0">
                      <Mail className="w-6 h-6" />
                    </div>
                    <span className="font-semibold">{cfg.email_contato}</span>
                  </a>
                )}
                {cfg.cidade_atendimento && (
                  <div className="flex items-center gap-3 text-blue-300">
                    <div className="w-12 h-12 rounded-2xl bg-blue-700 flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-6 h-6" />
                    </div>
                    <span>{cfg.cidade_atendimento}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-3xl p-8 text-center">
              <Zap className="w-12 h-12 text-orange-400 mx-auto mb-4" />
              <h3 className="text-2xl font-black mb-2">Assine Agora</h3>
              <p className="text-blue-300 text-sm mb-6">Processo 100% online. Sem sair de casa.</p>
              <Button asChild size="lg" className="w-full rounded-2xl h-14 text-lg font-bold bg-orange-500 hover:bg-orange-600 gap-2">
                <Link to="/assine">Começar agora <ArrowRight className="w-5 h-5" /></Link>
              </Button>
              <p className="text-xs text-blue-400 mt-4">Sem fidelidade • Instalação rápida • Suporte 24h</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-blue-950 text-blue-400 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center">
              <Wifi className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white">{nome}</span>
          </div>
          <p>© {new Date().getFullYear()} {nome}. Todos os direitos reservados.</p>
          <div className="flex gap-4">
            <a href="#planos" className="hover:text-white transition-colors">Planos</a>
            <a href="#contato" className="hover:text-white transition-colors">Contato</a>
            <Link to="/assine" className="hover:text-white transition-colors">Assinar</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}