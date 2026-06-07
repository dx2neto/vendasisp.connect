import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Gift, Trophy, Phone, User, Mail, Loader2, CheckCircle2, RotateCcw } from "lucide-react";

// ─── Wheel Canvas ────────────────────────────────────────────────────────────
function SpinWheel({ prizes, spinning, rotation }) {
  const canvasRef = useRef(null);
  const segments = prizes.length;

  useEffect(() => {
    if (!canvasRef.current || segments === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const size = canvas.width;
    const center = size / 2;
    const radius = center - 8;
    const arc = (2 * Math.PI) / segments;

    ctx.clearRect(0, 0, size, size);

    prizes.forEach((prize, i) => {
      const startAngle = i * arc;
      const endAngle = startAngle + arc;

      // Segment
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = prize.cor || (i % 2 === 0 ? "#0ea5e9" : "#0284c7");
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label
      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(startAngle + arc / 2);
      ctx.textAlign = "right";
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${size < 320 ? 10 : 12}px Inter, sans-serif`;

      const maxLen = 14;
      const label = `${prize.emoji || "🎁"} ${prize.nome}`.substring(0, maxLen);
      ctx.fillText(label, radius - 10, 5);
      ctx.restore();
    });

    // Center circle
    ctx.beginPath();
    ctx.arc(center, center, 24, 0, 2 * Math.PI);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Center icon
    ctx.font = "18px serif";
    ctx.textAlign = "center";
    ctx.fillText("🎯", center, center + 6);
  }, [prizes, segments]);

  return (
    <div className="relative flex items-center justify-center">
      {/* Pointer */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-10">
        <div className="w-0 h-0 border-l-[10px] border-r-[10px] border-t-[22px] border-l-transparent border-r-transparent border-t-red-500 drop-shadow-md" />
      </div>

      <div
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: spinning ? "transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)" : "none",
        }}
      >
        <canvas
          ref={canvasRef}
          width={320}
          height={320}
          className="rounded-full shadow-2xl"
        />
      </div>
    </div>
  );
}

// ─── Lead Form ───────────────────────────────────────────────────────────────
function LeadForm({ onSubmit, loading }) {
  const [form, setForm] = useState({ nome: "", telefone: "", email: "" });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}
      className="space-y-3 w-full max-w-sm"
    >
      <div className="relative">
        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input required placeholder="Seu nome completo" value={form.nome} onChange={set("nome")} className="pl-10 rounded-xl" />
      </div>
      <div className="relative">
        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input required placeholder="WhatsApp / Telefone" value={form.telefone} onChange={set("telefone")} className="pl-10 rounded-xl" />
      </div>
      <div className="relative">
        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input type="email" placeholder="E-mail (opcional)" value={form.email} onChange={set("email")} className="pl-10 rounded-xl" />
      </div>
      <Button type="submit" disabled={loading} className="w-full rounded-xl h-12 text-base font-bold gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90">
        {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <><Gift className="w-5 h-5" /> Girar a Roleta!</>}
      </Button>
    </form>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Roleta() {
  const [phase, setPhase] = useState("form"); // form | spinning | result
  const [leadData, setLeadData] = useState(null);
  const [winner, setWinner] = useState(null);
  const [rotation, setRotation] = useState(0);
  const queryClient = useQueryClient();

  const { data: rawPrizes = [] } = useQuery({
    queryKey: ["premios-roleta"],
    queryFn: () => base44.entities.PremioRoleta.filter({ ativo: true }),
  });

  // Garantir ao menos 6 segmentos (repetindo)
  const prizes = (() => {
    if (rawPrizes.length === 0) return [];
    const base = rawPrizes.filter(p => p.ativo);
    if (base.length === 0) return [];
    let arr = [...base];
    while (arr.length < 6) arr = [...arr, ...base];
    return arr.slice(0, Math.max(6, base.length));
  })();

  const createLead = useMutation({
    mutationFn: (data) => base44.entities.Lead.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leads"] }),
  });

  const spinWheel = (leadInfo) => {
    if (prizes.length === 0) return;

    // Sortear prêmio por probabilidade
    const weights = prizes.map((p) => p.probabilidade || 10);
    const total = weights.reduce((a, b) => a + b, 0);
    let rand = Math.random() * total;
    let winIdx = 0;
    for (let i = 0; i < weights.length; i++) {
      rand -= weights[i];
      if (rand <= 0) { winIdx = i; break; }
    }

    const arc = 360 / prizes.length;
    const targetAngle = 360 - (winIdx * arc + arc / 2);
    const spins = 5 * 360 + targetAngle;
    setRotation((prev) => prev + spins);
    setPhase("spinning");

    // Criar lead
    createLead.mutate({
      nome: leadInfo.nome,
      telefone: leadInfo.telefone,
      email: leadInfo.email,
      canal_origem: "site",
      etapa_funil: "novo",
      data_entrada: new Date().toISOString(),
      observacao: `Captado via Roleta de Prêmios — Prêmio: ${prizes[winIdx]?.nome}`,
    });

    setTimeout(() => {
      setWinner(prizes[winIdx]);
      setPhase("result");
    }, 4200);
  };

  const handleFormSubmit = (data) => {
    setLeadData(data);
    spinWheel(data);
  };

  const handleReset = () => {
    setPhase("form");
    setLeadData(null);
    setWinner(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-primary/20 to-slate-900 flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 bg-primary/20 border border-primary/30 rounded-full px-4 py-1.5 mb-3">
          <Trophy className="w-4 h-4 text-primary" />
          <span className="text-primary text-sm font-semibold">Gire e Ganhe!</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-white mb-2">
          Sua Chance de Ganhar
        </h1>
        <p className="text-slate-400 text-sm max-w-xs mx-auto">
          Preencha seus dados, gire a roleta e descubra seu prêmio exclusivo!
        </p>
      </div>

      <div className="flex flex-col lg:flex-row items-center gap-8 w-full max-w-4xl">
        {/* Wheel */}
        <div className="flex-shrink-0">
          {prizes.length > 0 ? (
            <SpinWheel prizes={prizes} spinning={phase === "spinning"} rotation={rotation} />
          ) : (
            <div className="w-80 h-80 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center">
              <p className="text-muted-foreground text-sm">Carregando prêmios...</p>
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className="flex flex-col items-center gap-4 w-full max-w-sm">
          {phase === "form" && (
            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6 w-full space-y-4">
              <div>
                <h2 className="text-white font-bold text-lg">Cadastre-se para jogar</h2>
                <p className="text-slate-400 text-xs mt-1">É gratuito. Sem spam.</p>
              </div>
              <LeadForm onSubmit={handleFormSubmit} loading={phase === "spinning"} />
            </div>
          )}

          {phase === "spinning" && (
            <div className="text-center space-y-3">
              <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
              <p className="text-white font-bold text-xl">Girando...</p>
              <p className="text-slate-400 text-sm">Boa sorte, {leadData?.nome?.split(" ")[0]}! 🍀</p>
            </div>
          )}

          {phase === "result" && winner && (
            <div className="bg-white/5 backdrop-blur border border-yellow-400/30 rounded-2xl p-6 w-full text-center space-y-4">
              <div className="text-6xl">{winner.emoji || "🎁"}</div>
              <div>
                <div className="inline-flex items-center gap-2 bg-yellow-400/20 border border-yellow-400/40 rounded-full px-3 py-1 mb-2">
                  <Trophy className="w-4 h-4 text-yellow-400" />
                  <span className="text-yellow-400 text-xs font-bold">PARABÉNS!</span>
                </div>
                <h2 className="text-white font-black text-2xl">{winner.nome}</h2>
                {winner.descricao && <p className="text-slate-300 text-sm mt-1">{winner.descricao}</p>}
                {winner.valor && (
                  <div className="mt-2 inline-block bg-primary/20 border border-primary/30 rounded-lg px-4 py-1.5">
                    <span className="text-primary font-bold text-lg">{winner.valor}</span>
                  </div>
                )}
                {winner.codigo_cupom && (
                  <div className="mt-3 bg-white/10 border border-dashed border-white/30 rounded-xl p-3">
                    <p className="text-xs text-slate-400 mb-1">Seu cupom</p>
                    <p className="text-white font-mono font-bold text-xl tracking-widest">{winner.codigo_cupom}</p>
                  </div>
                )}
              </div>
              <p className="text-slate-400 text-xs">Em breve nossa equipe entrará em contato, {leadData?.nome?.split(" ")[0]}! 📞</p>
              <div className="flex gap-2 justify-center">
                <Button onClick={handleReset} variant="outline" size="sm" className="gap-2 rounded-xl border-white/20 text-white hover:bg-white/10">
                  <RotateCcw className="w-4 h-4" /> Indicar um amigo
                </Button>
                <Button
                  size="sm"
                  className="rounded-xl gap-2 bg-green-600 hover:bg-green-700"
                  onClick={() => window.open(`https://wa.me/55${leadData?.telefone?.replace(/\D/g, "")}`, "_blank")}
                >
                  <CheckCircle2 className="w-4 h-4" /> Resgatar
                </Button>
              </div>
            </div>
          )}

          {/* Prize list preview */}
          {phase === "form" && prizes.length > 0 && (
            <div className="w-full">
              <p className="text-slate-500 text-xs text-center mb-2">Prêmios disponíveis</p>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {[...new Map(prizes.map(p => [p.id || p.nome, p])).values()].map((p, i) => (
                  <span key={i} className="text-xs bg-white/5 border border-white/10 rounded-full px-2.5 py-1 text-white/70">
                    {p.emoji} {p.nome}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}