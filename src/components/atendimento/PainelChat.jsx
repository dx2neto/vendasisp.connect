import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Send, UserCheck, ArrowRightLeft, CheckCheck, Check, PhoneCall } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";

const STATUS_ICONS = {
  enviando: <span className="text-slate-400">⏳</span>,
  enviado: <Check className="w-3 h-3 text-slate-400" />,
  entregue: <CheckCheck className="w-3 h-3 text-slate-400" />,
  lido: <CheckCheck className="w-3 h-3 text-blue-400" />,
  erro: <span className="text-red-400">!</span>,
};

const STATUS_CONV = {
  aguardando: "bg-amber-100 text-amber-700",
  em_atendimento: "bg-blue-100 text-blue-700",
  resolvida: "bg-emerald-100 text-emerald-700",
};

export default function PainelChat({ conversa, currentUser, setores, onConversaUpdate }) {
  const [texto, setTexto] = useState("");
  const [showTransferir, setShowTransferir] = useState(false);
  const [setorTransf, setSetorTransf] = useState("");
  const endRef = useRef(null);
  const qc = useQueryClient();

  const { data: mensagens = [] } = useQuery({
    queryKey: ["mensagens", conversa?.id],
    queryFn: () => base44.entities.Mensagem.filter({ conversa_id: conversa.id }, "created_date", 200),
    enabled: !!conversa?.id,
    refetchInterval: 3000,
  });

  const { data: respostas = [] } = useQuery({
    queryKey: ["respostas-rapidas"],
    queryFn: () => base44.entities.RespostaRapida.list(),
  });

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [mensagens.length]);

  // Zera não lidas ao abrir
  useEffect(() => {
    if (conversa?.id && conversa.nao_lidas > 0) {
      base44.entities.Conversa.update(conversa.id, { nao_lidas: 0 })
        .then(() => qc.invalidateQueries({ queryKey: ["conversas"] }));
    }
  }, [conversa?.id]);

  const enviarMutation = useMutation({
    mutationFn: (t) => base44.functions.invoke("enviarMensagemWA", { conversa_id: conversa.id, texto: t }),
    onSuccess: () => { setTexto(""); qc.invalidateQueries({ queryKey: ["mensagens", conversa.id] }); qc.invalidateQueries({ queryKey: ["conversas"] }); },
    onError: (e) => toast.error("Erro ao enviar: " + e.message),
  });

  const atualizarConversa = async (dados) => {
    await base44.entities.Conversa.update(conversa.id, dados);
    qc.invalidateQueries({ queryKey: ["conversas"] });
    onConversaUpdate?.({ ...conversa, ...dados });
  };

  const assumir = () => atualizarConversa({ atendente_id: currentUser?.id, atendente_nome: currentUser?.full_name, status: "em_atendimento" });
  const finalizar = () => atualizarConversa({ status: "resolvida" });
  const transferir = () => {
    const setor = setores.find(s => s.id === setorTransf);
    if (!setor) return;
    atualizarConversa({ setor_id: setor.id, setor_nome: setor.nome, setor_cor: setor.cor, atendente_id: null, atendente_nome: null, status: "aguardando" });
    setShowTransferir(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEnviar(); }
  };
  const handleEnviar = () => { if (texto.trim()) enviarMutation.mutate(texto.trim()); };

  if (!conversa) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <div className="text-center text-slate-400">
          <PhoneCall className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Selecione uma conversa para começar</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between gap-3 flex-shrink-0">
        <div className="min-w-0">
          <p className="font-bold truncate">{conversa.contato_nome || conversa.contato_telefone}</p>
          <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
            <span>{conversa.contato_telefone}</span>
            <span className={cn("px-1.5 py-0.5 rounded-full text-[10px] font-semibold", STATUS_CONV[conversa.status])}>
              {conversa.status?.replace("_", " ")}
            </span>
            {conversa.atendente_nome && <span>👤 {conversa.atendente_nome}</span>}
          </div>
        </div>
        <div className="flex gap-1.5 flex-shrink-0 flex-wrap">
          {conversa.status !== "em_atendimento" && (
            <Button size="sm" onClick={assumir} className="bg-emerald-600 hover:bg-emerald-700 text-xs h-8 gap-1">
              <UserCheck className="w-3.5 h-3.5" /> Assumir
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setShowTransferir(!showTransferir)} className="text-xs h-8 gap-1 border-slate-600 text-slate-200 hover:bg-slate-700">
            <ArrowRightLeft className="w-3.5 h-3.5" /> Transferir
          </Button>
          {conversa.status !== "resolvida" && (
            <Button size="sm" variant="outline" onClick={finalizar} className="text-xs h-8 border-slate-600 text-slate-200 hover:bg-slate-700">
              Finalizar
            </Button>
          )}
        </div>
      </div>

      {/* Transferir dropdown */}
      {showTransferir && (
        <div className="bg-slate-100 border-b px-4 py-2 flex items-center gap-2">
          <select className="text-sm border rounded px-2 py-1 flex-1"
            value={setorTransf} onChange={e => setSetorTransf(e.target.value)}>
            <option value="">Selecione o setor</option>
            {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
          <Button size="sm" onClick={transferir} className="bg-blue-600 hover:bg-blue-700 text-xs">Transferir</Button>
          <Button size="sm" variant="ghost" onClick={() => setShowTransferir(false)} className="text-xs">Cancelar</Button>
        </div>
      )}

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2"
        style={{ backgroundImage: "radial-gradient(circle, #e2e8f0 1px, transparent 1px)", backgroundSize: "20px 20px", backgroundColor: "#f8fafc" }}>
        {mensagens.map(msg => {
          const isOut = msg.direcao === "out";
          return (
            <div key={msg.id} className={cn("flex", isOut ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[75%] rounded-2xl px-3 py-2 shadow-sm",
                isOut ? "bg-emerald-100 rounded-br-sm" : "bg-white rounded-bl-sm border border-slate-100"
              )}>
                {msg.autor && <p className="text-[10px] font-semibold text-emerald-700 mb-0.5">{msg.autor}</p>}
                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.conteudo}</p>
                <div className="flex items-center justify-end gap-1 mt-0.5">
                  <span className="text-[10px] text-slate-400">
                    {msg.created_date ? format(new Date(msg.created_date), "HH:mm") : ""}
                  </span>
                  {isOut && STATUS_ICONS[msg.status]}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Respostas rápidas */}
      {respostas.length > 0 && (
        <div className="px-3 py-1.5 border-t bg-white flex gap-1.5 overflow-x-auto flex-shrink-0">
          {respostas.map(r => (
            <button key={r.id} onClick={() => setTexto(r.texto)}
              className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap hover:bg-emerald-100 transition-colors flex-shrink-0">
              {r.atalho}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t bg-white flex gap-2 flex-shrink-0">
        <textarea
          className="flex-1 resize-none border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 min-h-[42px] max-h-32"
          placeholder="Digite uma mensagem... (Enter envia, Shift+Enter quebra linha)"
          value={texto}
          onChange={e => setTexto(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
        />
        <Button onClick={handleEnviar} disabled={!texto.trim() || enviarMutation.isPending}
          className="bg-emerald-600 hover:bg-emerald-700 rounded-xl h-10 w-10 p-0 flex-shrink-0">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}