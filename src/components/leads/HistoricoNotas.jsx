import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, MessageSquare, Phone, CheckCircle2, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const TIPO_ICONS = {
  contato: <Phone className="w-4 h-4" />,
  negociacao: <MessageSquare className="w-4 h-4" />,
  observacao: <AlertCircle className="w-4 h-4" />,
  status: <CheckCircle2 className="w-4 h-4" />,
};

const TIPO_COLORS = {
  contato: "bg-blue-50 text-blue-700 border-blue-200",
  negociacao: "bg-purple-50 text-purple-700 border-purple-200",
  observacao: "bg-amber-50 text-amber-700 border-amber-200",
  status: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export default function HistoricoNotas({ notas = [], onAdicionarNota }) {
  const [novaNota, setNovaNota] = useState("");
  const [tipo, setTipo] = useState("observacao");
  const [isAdding, setIsAdding] = useState(false);

  const handleAdicionarNota = () => {
    if (!novaNota.trim()) return;

    onAdicionarNota({
      data: new Date().toISOString(),
      autor: "Usuário",
      nota: novaNota,
      tipo,
    });

    setNovaNota("");
    setTipo("observacao");
    setIsAdding(false);
  };

  const notasOrdenadas = [...(notas || [])].sort(
    (a, b) => new Date(b.data) - new Date(a.data)
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        {!isAdding ? (
          <Button
            onClick={() => setIsAdding(true)}
            variant="outline"
            size="sm"
            className="gap-2 rounded-lg w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            Adicionar Nota
          </Button>
        ) : (
          <div className="space-y-3 w-full">
            <div className="flex gap-2 flex-col sm:flex-row">
              <Input
                placeholder="Escreva uma nota..."
                value={novaNota}
                onChange={(e) => setNovaNota(e.target.value)}
                className="rounded-lg flex-1"
              />
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
              >
                <option value="observacao">Observação</option>
                <option value="contato">Contato</option>
                <option value="negociacao">Negociação</option>
                <option value="status">Status</option>
              </select>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAdicionarNota} size="sm" className="rounded-lg">
                Salvar
              </Button>
              <Button
                onClick={() => { setNovaNota(""); setIsAdding(false); }}
                variant="ghost"
                size="sm"
                className="rounded-lg"
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {notasOrdenadas.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">
            Nenhuma nota registrada. Comece adicionando uma!
          </p>
        ) : (
          notasOrdenadas.map((nota, idx) => (
            <Card key={idx} className={`rounded-lg border p-3 sm:p-4 ${TIPO_COLORS[nota.tipo] || TIPO_COLORS.observacao}`}>
              <div className="flex gap-3">
                <div className="flex-shrink-0 mt-1">
                  {TIPO_ICONS[nota.tipo]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <Badge variant="outline" className="text-xs rounded-md capitalize">
                        {nota.tipo}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {nota.autor} • {format(new Date(nota.data), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm mt-2 whitespace-pre-wrap break-words">{nota.nota}</p>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}