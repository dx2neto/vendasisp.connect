import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Phone, MessageSquare, AlertCircle, CheckCircle2,
  ArrowRightCircle, Clock, User, ChevronDown, ChevronUp
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

const TIPOS = [
  { value: "contato", label: "Tentativa de Contato" },
  { value: "negociacao", label: "Negociação" },
  { value: "observacao", label: "Observação" },
  { value: "status", label: "Mudança de Status" },
];

const TIPO_CONFIG = {
  contato: {
    icon: Phone,
    dot: "bg-blue-500",
    badge: "bg-blue-50 text-blue-700 border-blue-200",
    line: "border-blue-200",
    label: "Tentativa de Contato",
  },
  negociacao: {
    icon: MessageSquare,
    dot: "bg-purple-500",
    badge: "bg-purple-50 text-purple-700 border-purple-200",
    line: "border-purple-200",
    label: "Negociação",
  },
  observacao: {
    icon: AlertCircle,
    dot: "bg-amber-500",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    line: "border-amber-200",
    label: "Observação",
  },
  status: {
    icon: ArrowRightCircle,
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    line: "border-emerald-200",
    label: "Mudança de Status",
  },
};

const ETAPA_LABELS = {
  novo: "Novo",
  analise_credito: "Análise de Crédito",
  viabilidade: "Viabilidade",
  contrato: "Contrato",
  ativado: "Ativado",
  recusado: "Recusado",
};

function TimelineItem({ nota, isLast }) {
  const [expanded, setExpanded] = useState(true);
  const cfg = TIPO_CONFIG[nota.tipo] || TIPO_CONFIG.observacao;
  const Icon = cfg.icon;

  return (
    <div className="flex gap-3">
      {/* Linha vertical + dot */}
      <div className="flex flex-col items-center">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.dot} shadow-sm`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        {!isLast && <div className="w-0.5 flex-1 bg-border mt-1 mb-1 min-h-[24px]" />}
      </div>

      {/* Conteúdo */}
      <div className="flex-1 pb-5">
        <div className="bg-card border border-border rounded-xl p-3 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={`text-xs rounded-full px-2 py-0.5 border ${cfg.badge}`}>
                {cfg.label}
              </Badge>
              {nota.tipo === "status" && nota.nota?.includes("→") && (
                <span className="text-xs font-medium text-muted-foreground">{nota.nota}</span>
              )}
            </div>
            <button
              onClick={() => setExpanded(e => !e)}
              className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {expanded && nota.tipo !== "status" && (
            <p className="text-sm mt-2 text-foreground whitespace-pre-wrap leading-relaxed">{nota.nota}</p>
          )}
          {expanded && nota.tipo === "status" && !nota.nota?.includes("→") && (
            <p className="text-sm mt-2 text-foreground whitespace-pre-wrap">{nota.nota}</p>
          )}

          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><User className="w-3 h-3" />{nota.autor || "Sistema"}</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {(() => {
                try { return format(new Date(nota.data), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }); }
                catch { return nota.data; }
              })()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HistoricoNotas({ notas = [], onAdicionarNota, leadEtapaAtual }) {
  const [novaNota, setNovaNota] = useState("");
  const [tipo, setTipo] = useState("observacao");
  const [novaEtapa, setNovaEtapa] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  // Pega nome do usuário atual
  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
    staleTime: 60000,
  });

  const notasOrdenadas = [...(notas || [])].sort(
    (a, b) => new Date(b.data) - new Date(a.data)
  );

  const handleSalvar = () => {
    if (tipo === "status") {
      if (!novaEtapa) return;
      const de = ETAPA_LABELS[leadEtapaAtual] || leadEtapaAtual || "?";
      const para = ETAPA_LABELS[novaEtapa] || novaEtapa;
      onAdicionarNota({
        data: new Date().toISOString(),
        autor: user?.full_name || "Equipe",
        nota: `${de} → ${para}${novaNota ? `\n${novaNota}` : ""}`,
        tipo: "status",
        etapa_anterior: leadEtapaAtual,
        etapa_nova: novaEtapa,
      }, novaEtapa);
    } else {
      if (!novaNota.trim()) return;
      onAdicionarNota({
        data: new Date().toISOString(),
        autor: user?.full_name || "Equipe",
        nota: novaNota.trim(),
        tipo,
      });
    }
    setNovaNota("");
    setTipo("observacao");
    setNovaEtapa("");
    setIsAdding(false);
  };

  return (
    <div className="space-y-4">
      {/* Botão / formulário de adicionar */}
      {!isAdding ? (
        <Button onClick={() => setIsAdding(true)} variant="outline" size="sm" className="gap-2 rounded-lg">
          <Plus className="w-4 h-4" /> Registrar Evento
        </Button>
      ) : (
        <div className="bg-muted/40 border border-border rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-foreground">Novo registro na linha do tempo</p>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TIPOS.map(t => (
              <button
                key={t.value}
                onClick={() => setTipo(t.value)}
                className={`text-xs rounded-lg px-2 py-1.5 border transition-all font-medium ${tipo === t.value
                  ? `${TIPO_CONFIG[t.value].badge} border-current`
                  : "bg-background border-border text-muted-foreground hover:border-primary/40"}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tipo === "status" && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Nova etapa do funil</label>
              <select
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={novaEtapa}
                onChange={e => setNovaEtapa(e.target.value)}
              >
                <option value="">Selecione a nova etapa</option>
                {Object.entries(ETAPA_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          )}

          <textarea
            className="w-full border border-border rounded-lg px-3 py-2 text-sm min-h-[80px] bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            placeholder={tipo === "status" ? "Motivo da mudança (opcional)..." : "Descreva o evento..."}
            value={novaNota}
            onChange={e => setNovaNota(e.target.value)}
          />

          <div className="flex gap-2">
            <Button onClick={handleSalvar} size="sm" className="rounded-lg gap-2">
              <CheckCircle2 className="w-3.5 h-3.5" /> Salvar
            </Button>
            <Button onClick={() => { setNovaNota(""); setIsAdding(false); setNovaEtapa(""); }} variant="ghost" size="sm" className="rounded-lg">
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Linha do tempo */}
      {notasOrdenadas.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm space-y-2">
          <Clock className="w-8 h-8 mx-auto opacity-30" />
          <p>Nenhum evento registrado ainda.</p>
          <p className="text-xs">Registre contatos, negociações e mudanças de status.</p>
        </div>
      ) : (
        <div className="mt-2">
          {notasOrdenadas.map((nota, idx) => (
            <TimelineItem key={idx} nota={nota} isLast={idx === notasOrdenadas.length - 1} />
          ))}
        </div>
      )}
    </div>
  );
}