import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, User, FileText, AlertCircle, Search, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PainelCliente({ conversa }) {
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [busca, setBusca] = useState("");

  const consultarIXC = async (params) => {
    setLoading(true);
    setErro(null);
    try {
      const res = await base44.functions.invoke("dossieClienteIXC", params);
      const d = res.data;
      if (d.encontrado) setDados(d);
      else { setDados(null); setErro("Cliente não encontrado no IXC"); }
    } catch (e) {
      setErro("Não foi possível consultar o IXC");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (conversa?.contato_telefone) {
      setDados(null); setErro(null);
      consultarIXC({ telefone: conversa.contato_telefone });
    }
  }, [conversa?.id]);

  if (!conversa) return (
    <div className="p-4 text-center text-slate-400 text-sm mt-8">
      <User className="w-10 h-10 mx-auto mb-2 opacity-20" />
      Selecione uma conversa
    </div>
  );

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4 bg-slate-50">
      {/* Avatar e telefone */}
      <div className="text-center pt-2">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-xl mx-auto mb-2">
          {(conversa.contato_nome || "?").charAt(0).toUpperCase()}
        </div>
        <p className="font-bold text-slate-800">{conversa.contato_nome || conversa.contato_telefone}</p>
        <p className="text-xs text-slate-500">{conversa.contato_telefone}</p>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 text-sm text-slate-500 py-4">
          <Loader2 className="w-4 h-4 animate-spin" /> Consultando IXC...
        </div>
      )}

      {erro && !loading && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-3">
          <div className="flex items-center gap-2 text-amber-700 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> {erro}
          </div>
          <div className="flex gap-2">
            <Input placeholder="CPF, CNPJ ou ID..." value={busca} onChange={e => setBusca(e.target.value)}
              className="text-xs h-8" onKeyDown={e => e.key === "Enter" && consultarIXC({ documento: busca })} />
            <Button size="sm" onClick={() => consultarIXC({ documento: busca })} className="h-8 w-8 p-0 bg-emerald-600 hover:bg-emerald-700">
              <Search className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {dados && !loading && (
        <>
          {/* Cliente no IXC */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2.5">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> Cliente no IXC
            </h3>
            <div className="flex items-center gap-2">
              {dados.cliente.ativo
                ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                : <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
              <span className={cn("text-xs font-semibold", dados.cliente.ativo ? "text-emerald-600" : "text-red-500")}>
                {dados.cliente.ativo ? "Ativo" : "Inativo"}
              </span>
            </div>
            {[
              ["Nome", dados.cliente.nome],
              ["CPF/CNPJ", dados.cliente.cpf_cnpj],
              ["Cidade", dados.cliente.cidade],
              ["E-mail", dados.cliente.email],
            ].filter(([, v]) => v).map(([k, v]) => (
              <div key={k}>
                <p className="text-[10px] text-slate-400 font-semibold uppercase">{k}</p>
                <p className="text-xs text-slate-700 break-all">{v}</p>
              </div>
            ))}
          </div>

          {/* Contratos */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" /> Contratos ({dados.contratos.length})
            </h3>
            {dados.contratos.length === 0
              ? <p className="text-xs text-slate-400">Nenhum contrato</p>
              : dados.contratos.map(c => (
                <div key={c.id} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 last:border-0">
                  <span className="text-slate-600 truncate">{c.plano || `Contrato #${c.id}`}</span>
                  <span className={cn("px-2 py-0.5 rounded-full font-semibold text-[10px]",
                    c.status_internet === "Online" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600")}>
                    {c.status_internet}
                  </span>
                </div>
              ))}
          </div>

          {/* Faturas em aberto */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              💰 Faturas em Aberto ({dados.faturas.length})
            </h3>
            {dados.faturas.length === 0
              ? <p className="text-xs text-emerald-600 font-semibold">✅ Nenhuma fatura em aberto</p>
              : dados.faturas.map(f => (
                <div key={f.id} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 last:border-0">
                  <span className="text-slate-500">Venc. {f.vencimento}</span>
                  <span className="font-bold text-red-600">R$ {Number(f.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  );
}