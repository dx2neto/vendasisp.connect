import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { Zap, Search, Copy, QrCode, FileText, CheckCircle, AlertCircle, Loader2, Phone, MessageCircle } from "lucide-react";

const formatCpfCnpj = (v) => {
  const d = v.replace(/\D/g, "");
  if (d.length <= 11) {
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
            .replace(/(\d{3})(\d{3})(\d{1,3})/, "$1.$2.$3")
            .replace(/(\d{3})(\d{1,3})/, "$1.$2");
  }
  return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")
          .replace(/(\d{2})(\d{3})(\d{3})(\d{1,4})/, "$1.$2.$3/$4")
          .replace(/(\d{2})(\d{3})(\d{1,3})/, "$1.$2.$3")
          .replace(/(\d{2})(\d{1,3})/, "$1.$2");
};

export default function BoletoFacil() {
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState("");
  const [copied, setCopied] = useState(false);

  const handleChange = (e) => {
    const v = e.target.value.replace(/\D/g, "").slice(0, 14);
    setCpfCnpj(formatCpfCnpj(v));
  };

  const buscar = async (e) => {
    e.preventDefault();
    const raw = cpfCnpj.replace(/\D/g, "");
    if (raw.length < 11) { setErro("Informe um CPF ou CNPJ válido."); return; }
    setErro("");
    setResultado(null);
    setLoading(true);
    const res = await base44.functions.invoke("boletoFacil", { cpf_cnpj: raw });
    setLoading(false);
    if (res.data?.erro) { setErro(res.data.erro); return; }
    setResultado(res.data);
  };

  const copiarPix = async () => {
    if (!resultado?.pix_copia_cola) return;
    await navigator.clipboard.writeText(resultado.pix_copia_cola);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-950 via-sky-900 to-slate-900 flex flex-col items-center justify-center px-4 py-12">
      {/* Logo / Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <span className="text-white font-bold text-2xl tracking-tight">2ª Via & Pagamento</span>
      </div>

      <div className="w-full max-w-md bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 p-8 shadow-2xl">
        <h1 className="text-white text-2xl font-bold text-center mb-1">Pague sua fatura</h1>
        <p className="text-sky-200 text-sm text-center mb-6">Informe seu CPF ou CNPJ para consultar sua fatura em aberto</p>

        <form onSubmit={buscar} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sky-100">CPF ou CNPJ</Label>
            <Input
              value={cpfCnpj}
              onChange={handleChange}
              placeholder="000.000.000-00"
              className="bg-white/15 border-white/30 text-white placeholder:text-sky-300 rounded-xl focus-visible:ring-sky-400 h-12 text-lg"
              inputMode="numeric"
            />
          </div>
          {erro && (
            <div className="flex items-center gap-2 text-red-300 text-sm">
              <AlertCircle className="w-4 h-4" /> {erro}
            </div>
          )}
          <Button type="submit" className="w-full h-12 rounded-xl text-base font-semibold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/30" disabled={loading}>
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Consultando...</> : <><Search className="w-4 h-4" /> Consultar fatura</>}
          </Button>
        </form>

        {/* Resultado */}
        {resultado && (
          <div className="mt-6 space-y-4">
            {/* Info cliente */}
            <div className="bg-white/10 rounded-2xl p-4 border border-white/20">
              <p className="text-sky-200 text-xs uppercase tracking-wider font-semibold mb-1">Cliente</p>
              <p className="text-white font-semibold">{resultado.nome}</p>
              {resultado.vencimento && (
                <p className="text-sky-200 text-sm mt-1">Vencimento: <span className="text-white font-medium">{resultado.vencimento}</span></p>
              )}
              {resultado.valor && (
                <p className="text-3xl font-bold text-white mt-2">
                  R$ {Number(resultado.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              )}
            </div>

            {/* Ações */}
            <div className="space-y-3">
              {/* PIX Copia e Cola */}
              {resultado.pix_copia_cola && (
                <div className="space-y-2">
                  <p className="text-sky-200 text-xs uppercase tracking-wider font-semibold flex items-center gap-1"><QrCode className="w-3.5 h-3.5" /> PIX Copia e Cola</p>
                  <div className="bg-black/30 rounded-xl p-3 font-mono text-xs text-sky-100 break-all border border-white/10">
                    {resultado.pix_copia_cola.slice(0, 80)}...
                  </div>
                  <Button onClick={copiarPix} className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white h-11">
                    {copied ? <><CheckCircle className="w-4 h-4" /> Copiado!</> : <><Copy className="w-4 h-4" /> Copiar código PIX</>}
                  </Button>
                </div>
              )}

              {/* Boleto */}
              {resultado.url_boleto && (
                <a href={resultado.url_boleto} target="_blank" rel="noopener noreferrer">
                  <Button className="w-full rounded-xl bg-sky-500 hover:bg-sky-600 text-white h-11">
                    <FileText className="w-4 h-4" /> Abrir / Imprimir Boleto
                  </Button>
                </a>
              )}

              {/* Linha digitável */}
              {resultado.linha_digitavel && (
                <div className="space-y-2">
                  <p className="text-sky-200 text-xs uppercase tracking-wider font-semibold">Linha Digitável</p>
                  <div className="bg-black/30 rounded-xl p-3 font-mono text-xs text-sky-100 break-all border border-white/10 select-all">
                    {resultado.linha_digitavel}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sem fatura encontrada */}
        {resultado && !resultado.valor && !resultado.pix_copia_cola && !resultado.url_boleto && (
          <div className="mt-6 text-center">
            <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-2" />
            <p className="text-emerald-300 font-semibold">Nenhuma fatura em aberto! ✅</p>
            <p className="text-sky-200 text-sm mt-1">Sua conta está em dia.</p>
          </div>
        )}
      </div>

      {/* Suporte */}
      <div className="mt-8 flex gap-4">
        <a
          href="https://wa.me/5500000000000"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sky-300 hover:text-white text-sm transition-colors"
        >
          <MessageCircle className="w-4 h-4" /> Suporte WhatsApp
        </a>
        <span className="text-white/20">|</span>
        <a href="tel:0800000000" className="flex items-center gap-2 text-sky-300 hover:text-white text-sm transition-colors">
          <Phone className="w-4 h-4" /> Ligar para suporte
        </a>
      </div>
    </div>
  );
}