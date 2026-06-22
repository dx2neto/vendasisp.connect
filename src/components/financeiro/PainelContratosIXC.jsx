import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileSignature, Zap, CheckCircle2, Clock, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from "recharts";

const fmt = (v) => `R$ ${(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const STATUS_CFG = {
  contrato_pendente: { label: "Contrato Pendente", cor: "#3b82f6" },
  assinado:         { label: "Assinado (Pendente IXC)", cor: "#f59e0b" },
  ativado:           { label: "Ativado no IXC", cor: "#10b981" },
  recusado:         { label: "Recusado", cor: "#ef4444" },
};

export default function PainelContratosIXC({ pedidos, onAtivar }) {
  const pedidosContrato = pedidos.filter(p =>
    ["contrato_pendente", "assinado", "ativado", "recusado"].includes(p.status)
  );

  const dadosGrafico = Object.entries(STATUS_CFG).map(([key, cfg]) => {
    const lista = pedidosContrato.filter(p => p.status === key);
    return {
      status: cfg.label,
      key,
      qtd: lista.length,
      valor: lista.reduce((s, p) => s + (p.valor || 0), 0),
      cor: cfg.cor,
    };
  });

  const pendentesIXC = pedidosContrato.filter(p => p.status === "assinado");
  const ativados = pedidosContrato.filter(p => p.status === "ativado");

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileSignature className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Contratos & Ativação IXC</h3>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200">
            <Clock className="w-3 h-3 mr-1" /> {pendentesIXC.length} pendentes
          </Badge>
          <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200">
            <CheckCircle2 className="w-3 h-3 mr-1" /> {ativados.length} ativados
          </Badge>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm font-medium mb-4">Distribuição de Contratos por Status</p>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={dadosGrafico} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="status" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="rounded-xl border border-border bg-popover p-3 shadow-lg text-xs space-y-1">
                    <p className="font-semibold">{d.status}</p>
                    <p className="text-muted-foreground">{d.qtd} contrato{d.qtd !== 1 ? "s" : ""}</p>
                    <p className="text-primary font-bold">{fmt(d.valor)}</p>
                  </div>
                );
              }}
            />
            <Bar dataKey="qtd" name="Contratos" radius={[6, 6, 0, 0]}>
              {dadosGrafico.map((d, i) => (
                <Cell key={i} fill={d.cor} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50/40 overflow-hidden">
        <div className="px-5 py-3 border-b border-amber-200 bg-amber-100/50 flex items-center justify-between">
          <p className="text-sm font-semibold text-amber-800 flex items-center gap-2">
            <Zap className="w-4 h-4" /> Pendentes de Ativação no IXC
          </p>
          <p className="text-sm font-bold text-amber-700">
            {fmt(pendentesIXC.reduce((s, p) => s + (p.valor || 0), 0))} em receita pendente
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-amber-200/60">
                <th className="text-left py-2.5 px-4 font-medium text-amber-700 text-xs uppercase">Cliente</th>
                <th className="text-left py-2.5 px-4 font-medium text-amber-700 text-xs uppercase">Plano</th>
                <th className="text-left py-2.5 px-4 font-medium text-amber-700 text-xs uppercase">Vendedor</th>
                <th className="text-right py-2.5 px-4 font-medium text-amber-700 text-xs uppercase">Valor</th>
                <th className="text-right py-2.5 px-4 font-medium text-amber-700 text-xs uppercase">Assinado em</th>
                <th className="text-center py-2.5 px-4 font-medium text-amber-700 text-xs uppercase">Ação</th>
              </tr>
            </thead>
            <tbody>
              {pendentesIXC.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    <CheckCircle2 className="w-6 h-6 mx-auto mb-1 text-emerald-500" />
                    Nenhum contrato pendente de ativação
                  </td>
                </tr>
              ) : pendentesIXC.map(p => (
                <tr key={p.id} className="border-b border-amber-200/40 hover:bg-amber-100/30 transition-colors">
                  <td className="py-3 px-4 font-medium">{p.lead_nome || "—"}</td>
                  <td className="py-3 px-4 text-muted-foreground text-xs">{p.plano_nome || "—"}</td>
                  <td className="py-3 px-4 text-muted-foreground text-xs">{p.vendedor_nome || "—"}</td>
                  <td className="py-3 px-4 text-right font-bold text-primary">{fmt(p.valor)}</td>
                  <td className="py-3 px-4 text-right text-xs text-muted-foreground">
                    {p.data_contrato ? format(new Date(p.data_contrato), "dd/MM/yy", { locale: ptBR }) : "—"}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Button
                      size="sm"
                      className="text-xs rounded-lg h-7 gap-1"
                      onClick={() => onAtivar?.(p)}
                    >
                      <ArrowRight className="w-3 h-3" /> Ativar no IXC
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}