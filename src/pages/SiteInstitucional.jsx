import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Wifi, Zap, Shield, Headphones, Star, Phone, Mail, MapPin,
  ChevronRight, CheckCircle2, ArrowRight, Gift
} from "lucide-react";
import { Link } from "react-router-dom";

const DEFAULT_DIFERENCIAIS = [
  { emoji: "⚡", titulo: "Ultra Velocidade", descricao: "Fibra óptica até 1 Gbps sem gargalos" },
  { emoji: "🛡️", titulo: "Sem Fidelidade", descricao: "Cancele quando quiser, sem multas" },
  { emoji: "🎯", titulo: "IP Fixo disponível", descricao: "Para quem precisa de acesso remoto" },
  { emoji: "🕐", titulo: "Suporte 24h", descricao: "Atendimento humano a qualquer hora" },
];

const DEFAULT_DEPOIMENTOS = [
  { nome: "Carlos S.", texto: "Melhor internet que já tive. Instalaram em 2 dias e funciona perfeitamente.", nota: 5 },
  { nome: "Ana P.", texto: "Streaming e home office sem travamentos. Superou minhas expectativas!", nota: 5 },
  { nome: "Roberto M.", texto: "Atendimento excelente. Recomendo pra todo mundo da região.", nota: 5 },
];

function Stars({ n = 5 }) {
  return <div className="flex gap-0.5">{Array.from({ length: n }).map((_, i) => <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />)}</div>;
}

export default function SiteInstitucional() {
  const { data: configs = [] } = useQuery({
    queryKey: ["site-config"],
    queryFn: () => base44.entities.SiteConfig.list(),
  });

  const { data: planos = [] } = useQuery({
    queryKey: ["planos-ativos"],
    queryFn: () => base44.entities.Plano.filter({ ativo: true }),
  });

  const cfg = configs[0] || {};
  const nome = cfg.nome_empresa || "NetVeloce";
  const slogan = cfg.slogan || "Internet de verdade, sem enrolação.";
  const desc = cfg.descricao_hero || "Fibra óptica de alta performance para a sua casa ou empresa. Instalação rápida, sem burocracia.";
  const diferenciais = cfg.diferenciais?.length ? cfg.diferenciais : DEFAULT_DIFERENCIAIS;
  const depoimentos = cfg.depoimentos?.length ? cfg.depoimentos : DEFAULT_DEPOIMENTOS;
  const whatsapp = cfg.whatsapp || "";
  const waLink = whatsapp ? `https://wa.me/55${whatsapp.replace(/\D/g, "")}?text=Olá! Quero contratar internet.` : "#";

  const planosOrdenados = [...planos].sort((a, b) => a.preco_mensal - b.preco_mensal);
  const planoPop = planosOrdenados[Math.floor(planosOrdenados.length / 2)] || planosOrdenados[0];

  return (
    <div className="min-h-screen bg-white font-body">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-border shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {cfg.logo_url ? (
              <img src={cfg.logo_url} alt={nome} className="h-8 object-contain" />
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <Wifi className="w-4 h-4 text-white" />
                </div>
                <span className="font-black text-xl text-foreground">{nome}</span>
              </div>
            )}
          </div>
          <div className="hidden sm:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <a href="#planos" className="hover:text-primary transition-colors">Planos</a>
            <a href="#diferenciais" className="hover:text-primary transition-colors">Por que nós</a>
            <a href="#depoimentos" className="hover:text-primary transition-colors">Clientes</a>
            <a href="#contato" className="hover:text-primary transition-colors">Contato</a>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="rounded-xl hidden sm:flex gap-2">
              <Link to="/roleta"><Gift className="w-4 h-4" /> Girar Roleta</Link>
            </Button>
            <Button asChild size="sm" className="rounded-xl gap-2 bg-primary hover:bg-primary/90">
              <a href={waLink} target="_blank" rel="noopener noreferrer">Assinar Agora</a>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative bg-gradient-to-br from-slate-900 via-primary/30 to-slate-900 text-white overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-primary/20 border border-primary/30 rounded-full px-4 py-1.5 mb-6">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-primary text-sm font-semibold">Fibra óptica de verdade</span>
            </div>
            <h1 className="text-4xl sm:text-6xl font-black leading-tight mb-6">
              {slogan}
            </h1>
            <p className="text-slate-300 text-lg sm:text-xl leading-relaxed mb-8 max-w-2xl">
              {desc}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild size="lg" className="rounded-2xl h-14 px-8 text-lg font-bold bg-primary hover:bg-primary/90 gap-2">
                <Link to="/assine">
                  Contratar Agora <ArrowRight className="w-5 h-5" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-2xl h-14 px-8 text-lg font-bold border-white/20 text-white hover:bg-white/10 gap-2">
                <a href="#planos">Ver Planos <ChevronRight className="w-5 h-5" /></a>
              </Button>
            </div>
            {/* Trust bar */}
            <div className="flex flex-wrap gap-6 mt-10 text-sm text-slate-400">
              {["✅ Sem Fidelidade", "⚡ Instalação em 48h", "🛡️ Suporte 24h"].map((t, i) => (
                <span key={i} className="font-medium">{t}</span>
              ))}
            </div>
          </div>
        </div>
        {/* Speed orb decoration */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none hidden lg:block" />
      </section>

      {/* Planos */}
      <section id="planos" className="py-20 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <Badge variant="outline" className="rounded-full px-4 py-1 mb-4 text-primary border-primary/30">Nossos Planos</Badge>
            <h2 className="text-3xl sm:text-4xl font-black text-foreground mb-3">Escolha o plano ideal</h2>
            <p className="text-muted-foreground max-w-md mx-auto">Sem taxas ocultas, sem letras miúdas. Preço limpo, entrega garantida.</p>
          </div>

          {planosOrdenados.length === 0 ? (
            <p className="text-center text-muted-foreground">Nenhum plano disponível no momento.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {planosOrdenados.map(plano => {
                const isPopular = plano.id === planoPop?.id;
                return (
                  <div
                    key={plano.id}
                    className={`relative rounded-2xl border-2 p-6 flex flex-col transition-all hover:shadow-xl ${
                      isPopular
                        ? "border-primary bg-primary/5 shadow-lg scale-[1.02]"
                        : "border-border bg-white hover:border-primary/40"
                    }`}
                  >
                    {isPopular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className="rounded-full px-4 py-1 bg-primary text-white shadow-md">⭐ Mais Popular</Badge>
                      </div>
                    )}
                    <div className="mb-4">
                      <h3 className="text-xl font-black text-foreground">{plano.nome}</h3>
                      <p className="text-muted-foreground text-sm mt-1">{plano.descricao || `Até ${plano.velocidade_mbps} Mbps`}</p>
                    </div>
                    <div className="mb-6">
                      <div className="flex items-end gap-1">
                        <span className="text-4xl font-black text-foreground">
                          R$ {plano.preco_mensal?.toFixed(2).replace(".", ",")}
                        </span>
                        <span className="text-muted-foreground text-sm mb-1">/mês</span>
                      </div>
                      <div className="mt-2 inline-flex items-center gap-1.5 bg-primary/10 rounded-full px-3 py-1">
                        <Zap className="w-3.5 h-3.5 text-primary" />
                        <span className="text-primary font-bold text-sm">{plano.velocidade_mbps} Mbps</span>
                      </div>
                    </div>
                    <ul className="space-y-2 mb-6 flex-1">
                      {["Fibra óptica pura", "Wi-Fi incluso", "Suporte 24h", "Sem fidelidade"].map(f => (
                        <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" /> {f}
                        </li>
                      ))}
                    </ul>
                    <Button asChild className={`w-full rounded-xl h-12 font-bold gap-2 ${isPopular ? "bg-primary hover:bg-primary/90" : ""}`} variant={isPopular ? "default" : "outline"}>
                      <Link to={`/assine?plano=${plano.id}`}>
                        Contratar este plano <ArrowRight className="w-4 h-4" />
                      </Link>
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Diferenciais */}
      <section id="diferenciais" className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <Badge variant="outline" className="rounded-full px-4 py-1 mb-4 text-primary border-primary/30">Por que escolher a {nome}?</Badge>
            <h2 className="text-3xl sm:text-4xl font-black text-foreground">O que nos faz diferentes</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {diferenciais.map((d, i) => (
              <div key={i} className="p-6 rounded-2xl border border-border hover:border-primary/30 hover:shadow-lg transition-all text-center">
                <div className="text-4xl mb-4">{d.emoji}</div>
                <h3 className="font-bold text-foreground mb-2">{d.titulo}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{d.descricao}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Roleta */}
      <section className="py-16 bg-gradient-to-r from-primary to-accent">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center text-white">
          <div className="text-5xl mb-4">🎡</div>
          <h2 className="text-3xl sm:text-4xl font-black mb-3">Gire nossa Roleta de Prêmios!</h2>
          <p className="text-white/80 text-lg mb-8 max-w-md mx-auto">Cadastre-se, gire e ganhe descontos exclusivos, brindes e muito mais. É grátis!</p>
          <Button asChild size="lg" className="rounded-2xl h-14 px-10 text-lg font-bold bg-white text-primary hover:bg-white/90 gap-2">
            <Link to="/roleta"><Gift className="w-5 h-5" /> Quero meu prêmio!</Link>
          </Button>
        </div>
      </section>

      {/* Depoimentos */}
      <section id="depoimentos" className="py-20 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <Badge variant="outline" className="rounded-full px-4 py-1 mb-4 text-primary border-primary/30">Depoimentos</Badge>
            <h2 className="text-3xl sm:text-4xl font-black text-foreground">Quem já é cliente aprova</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {depoimentos.map((d, i) => (
              <div key={i} className="bg-white rounded-2xl border border-border p-6 shadow-sm">
                <Stars n={d.nota || 5} />
                <p className="text-foreground text-sm leading-relaxed mt-3 mb-4">"{d.texto}"</p>
                <p className="text-muted-foreground text-xs font-semibold">{d.nome}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contato / Final CTA */}
      <section id="contato" className="py-20 bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-black mb-4">Pronto para ter internet de verdade?</h2>
              <p className="text-slate-400 text-lg mb-8">Entre em contato agora. Nossa equipe responde em minutos.</p>
              <div className="space-y-3">
                {cfg.whatsapp && (
                  <a href={waLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-slate-300 hover:text-white transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-green-600 flex items-center justify-center flex-shrink-0">
                      <Phone className="w-5 h-5" />
                    </div>
                    <span>{cfg.whatsapp}</span>
                  </a>
                )}
                {cfg.email_contato && (
                  <a href={`mailto:${cfg.email_contato}`} className="flex items-center gap-3 text-slate-300 hover:text-white transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
                      <Mail className="w-5 h-5" />
                    </div>
                    <span>{cfg.email_contato}</span>
                  </a>
                )}
                {cfg.cidade_atendimento && (
                  <div className="flex items-center gap-3 text-slate-400">
                    <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <span>{cfg.cidade_atendimento}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
              <h3 className="text-2xl font-black mb-2">Assine Agora</h3>
              <p className="text-slate-400 text-sm mb-6">Processo 100% online. Sem sair de casa.</p>
              <Button asChild size="lg" className="w-full rounded-xl h-14 text-lg font-bold bg-primary hover:bg-primary/90 gap-2">
                <Link to="/assine">Começar agora <ArrowRight className="w-5 h-5" /></Link>
              </Button>
              <p className="text-xs text-slate-500 mt-4">Sem fidelidade • Instalação rápida • Suporte 24h</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-500 py-6 text-center text-xs">
        <p>© {new Date().getFullYear()} {nome}. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}