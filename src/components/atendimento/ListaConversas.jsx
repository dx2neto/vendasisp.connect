import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_STYLES = {
  aguardando: "bg-amber-100 text-amber-700",
  em_atendimento: "bg-blue-100 text-blue-700",
  resolvida: "bg-emerald-100 text-emerald-700",
};
const STATUS_LABELS = {
  aguardando: "Aguardando",
  em_atendimento: "Em atendimento",
  resolvida: "Resolvida",
};

function Iniciais({ nome }) {
  const parts = (nome || "?").trim().split(" ");
  const ini = parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : parts[0][0];
  return (
    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
      {ini.toUpperCase()}
    </div>
  );
}

export default function ListaConversas({ conversas, filtro, setFiltro, selecionada, onSelecionar }) {
  const FILTROS = [
    { key: "todas", label: "Todas" },
    { key: "aguardando", label: "Aguardando" },
    { key: "em_atendimento", label: "Em atendimento" },
    { key: "resolvida", label: "Resolvidas" },
  ];

  const contadores = {
    todas: conversas.length,
    aguardando: conversas.filter(c => c.status === "aguardando").length,
    em_atendimento: conversas.filter(c => c.status === "em_atendimento").length,
    resolvida: conversas.filter(c => c.status === "resolvida").length,
  };

  const filtradas = conversas
    .filter(c => filtro === "todas" || c.status === filtro)
    .sort((a, b) => {
      if (a.status === "aguardando" && b.status !== "aguardando") return -1;
      if (b.status === "aguardando" && a.status !== "aguardando") return 1;
      return new Date(b.ultima_em || 0) - new Date(a.ultima_em || 0);
    });

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white">
      <div className="p-4 border-b border-slate-700">
        <h2 className="font-bold text-lg">Atendimentos</h2>
      </div>

      {/* Filtros */}
      <div className="px-3 py-2 flex flex-wrap gap-1.5 border-b border-slate-700">
        {FILTROS.map(f => (
          <button key={f.key} onClick={() => setFiltro(f.key)}
            className={cn(
              "px-2.5 py-1 rounded-full text-xs font-semibold transition-all",
              filtro === f.key ? "bg-emerald-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            )}>
            {f.label} <span className="opacity-70">({contadores[f.key] || 0})</span>
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto">
        {filtradas.length === 0 ? (
          <div className="p-6 text-center text-slate-500 text-sm">Nenhuma conversa</div>
        ) : filtradas.map(conv => (
          <div key={conv.id}
            onClick={() => onSelecionar(conv)}
            className={cn(
              "flex items-start gap-3 px-4 py-3 cursor-pointer border-b border-slate-800 transition-colors",
              selecionada?.id === conv.id ? "bg-slate-700" : "hover:bg-slate-800"
            )}>
            <Iniciais nome={conv.contato_nome} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <p className="font-semibold text-sm truncate">{conv.contato_nome || conv.contato_telefone}</p>
                <span className="text-[10px] text-slate-400 flex-shrink-0 ml-2">
                  {conv.ultima_em ? formatDistanceToNow(new Date(conv.ultima_em), { locale: ptBR, addSuffix: false }) : ""}
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate">{conv.ultima_msg || "..."}</p>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-semibold", STATUS_STYLES[conv.status])}>
                  {STATUS_LABELS[conv.status]}
                </span>
                {conv.setor_nome && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold text-white"
                    style={{ backgroundColor: conv.setor_cor || "#16a34a" }}>
                    {conv.setor_nome}
                  </span>
                )}
              </div>
            </div>
            {conv.nao_lidas > 0 && (
              <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-1">
                {conv.nao_lidas}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}