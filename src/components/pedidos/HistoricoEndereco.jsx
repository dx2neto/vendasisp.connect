import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin, AlertTriangle, Users, CheckCircle2 } from "lucide-react";

export default function HistoricoEndereco({ cep, numero, rua }) {
  const [ativado, setAtivado] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["historicoEndereco", cep, numero],
    queryFn: async () => {
      const res = await base44.functions.invoke("historicoClienteEndereco", { cpf_cnpj: "", logradouro: rua, numero });
      return res.data?.resultados?.[0] || res.data;
    },
    enabled: ativado && (!!cep || !!rua),
  });

  if (!cep) return null;

  if (!ativado) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2 rounded-xl text-amber-600 border-amber-200 hover:bg-amber-50"
        onClick={() => setAtivado(true)}
      >
        <MapPin className="w-3.5 h-3.5" /> Ver histórico de clientes neste endereço
      </Button>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Consultando histórico no IXC...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-500 py-2">
        Erro ao consultar histórico: {error.message}
      </div>
    );
  }

  if (!data?.success || data.total_clientes_encontrados === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
        <CheckCircle2 className="w-4 h-4" /> Nenhum cliente anterior encontrado neste endereço.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Alerta de risco */}
      {data.tem_risco && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3">
          <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-red-700 text-sm">⚠ Endereço com histórico de risco</p>
            <p className="text-xs text-red-600 mt-0.5">
              Há clientes anteriores neste endereço com dívidas ou inativos. Verifique o histórico antes de aprovar.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 text-sm font-medium">
        <Users className="w-4 h-4 text-muted-foreground" />
        {data.total_clientes_encontrados} cliente(s) anterior(es) neste endereço
      </div>

      {/* Lista de clientes */}
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {data.historicos.map((h) => (
          <div
            key={h.id_cliente}
            className={`rounded-xl border p-3 text-sm ${
              h.tem_divida ? "border-red-200 bg-red-50/50" : "border-border bg-muted/30"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="font-medium">{h.nome || `Cliente IXC #${h.id_cliente}`}</p>
              <div className="flex gap-1.5">
                <Badge
                  variant="outline"
                  className={`text-xs ${h.ativo ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-red-50 text-red-600 border-red-200"}`}
                >
                  {h.ativo ? "Ativo" : "Inativo"}
                </Badge>
                {h.tem_divida && (
                  <Badge variant="outline" className="text-xs bg-red-50 text-red-600 border-red-200">
                    <AlertTriangle className="w-3 h-3 mr-1" /> Dívida
                  </Badge>
                )}
              </div>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Endereço:</span>
                <span className="font-medium text-right">{h.endereco}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Contratos:</span>
                <span className="font-medium">{h.total_contratos}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Faturas em aberto:</span>
                <span className={`font-medium ${h.faturas_em_aberto > 0 ? "text-red-600" : "text-foreground"}`}>
                  {h.faturas_em_aberto}
                </span>
              </div>
              <div className="flex justify-between border-t border-border/50 pt-1.5">
                <span className="text-muted-foreground font-semibold">Valor em aberto:</span>
                <span className={`font-bold ${h.total_em_aberto > 0 ? "text-red-600" : "text-foreground"}`}>
                  R$ {h.total_em_aberto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}