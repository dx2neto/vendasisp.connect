import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import ListaConversas from "@/components/atendimento/ListaConversas";
import PainelChat from "@/components/atendimento/PainelChat";
import PainelCliente from "@/components/atendimento/PainelCliente";
import { Button } from "@/components/ui/button";
import { PanelRight, PanelRightClose } from "lucide-react";

export default function Atendimento() {
  const [filtro, setFiltro] = useState("todas");
  const [conversaSelecionada, setConversaSelecionada] = useState(null);
  const [showPainelCliente, setShowPainelCliente] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const qc = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => null);
  }, []);

  const { data: conversas = [] } = useQuery({
    queryKey: ["conversas"],
    queryFn: () => base44.entities.Conversa.list("-ultima_em", 100),
    refetchInterval: 5000,
  });

  const { data: setores = [] } = useQuery({
    queryKey: ["setores"],
    queryFn: () => base44.entities.Setor.list(),
  });

  const handleSelecionar = (conv) => {
    setConversaSelecionada(conv);
    // Zera não lidas
    if (conv.nao_lidas > 0) {
      base44.entities.Conversa.update(conv.id, { nao_lidas: 0 })
        .then(() => qc.invalidateQueries({ queryKey: ["conversas"] }));
    }
  };

  const handleConversaUpdate = (updated) => {
    setConversaSelecionada(updated);
    qc.invalidateQueries({ queryKey: ["conversas"] });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      {/* Coluna esquerda — Conversas */}
      <div className="w-72 flex-shrink-0 border-r border-slate-700 flex flex-col">
        <ListaConversas
          conversas={conversas}
          filtro={filtro}
          setFiltro={setFiltro}
          selecionada={conversaSelecionada}
          onSelecionar={handleSelecionar}
        />
      </div>

      {/* Coluna central — Chat */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Barra superior com botão de toggle coluna direita */}
        <div className="absolute top-2 right-2 z-10">
          <Button size="icon" variant="ghost" className="h-8 w-8 bg-white/80 backdrop-blur"
            onClick={() => setShowPainelCliente(!showPainelCliente)}>
            {showPainelCliente ? <PanelRightClose className="w-4 h-4" /> : <PanelRight className="w-4 h-4" />}
          </Button>
        </div>
        <PainelChat
          conversa={conversaSelecionada}
          currentUser={currentUser}
          setores={setores}
          onConversaUpdate={handleConversaUpdate}
        />
      </div>

      {/* Coluna direita — Dados do cliente */}
      {showPainelCliente && (
        <div className="w-72 flex-shrink-0 border-l border-slate-200 flex flex-col">
          <div className="bg-slate-800 text-white px-4 py-3 text-sm font-bold flex-shrink-0">
            Dados do Cliente (IXC)
          </div>
          <div className="flex-1 overflow-hidden">
            <PainelCliente conversa={conversaSelecionada} />
          </div>
        </div>
      )}
    </div>
  );
}