import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, RefreshCw, FileSignature, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function StatusIntegracoes() {
  const [status, setStatus] = useState("unknown"); // unknown | ok | error | testing
  const [error, setError] = useState(null);
  const [lastCheck, setLastCheck] = useState(null);

  async function testarZapSign() {
    setStatus("testing");
    setError(null);
    try {
      const res = await base44.functions.invoke("testarZapSign", {});
      const ok = res.data?.ok ?? res.ok;
      if (ok) {
        setStatus("ok");
        setLastCheck(new Date());
      } else {
        setStatus("error");
        setError(res.data?.error || res.data?.msg || "Falha na conexão com o ZapSign");
      }
    } catch (e) {
      setStatus("error");
      setError(e.message || "Erro ao testar conexão");
    }
  }

  useEffect(() => {
    testarZapSign();
  }, []);

  const connected = status === "ok";

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
          <FileSignature className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Status das Integrações</h1>
          <p className="text-sm text-gray-500">Verifique a conexão com o ZapSign</p>
        </div>
      </div>

      <Card className={cn(
        "rounded-2xl border-2 transition-colors",
        connected ? "border-emerald-200" : status === "error" ? "border-red-200" : "border-border"
      )}>
        <CardContent className="p-6 space-y-4">
          {/* Status principal */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-14 h-14 rounded-2xl flex items-center justify-center text-white transition-colors",
                connected ? "bg-emerald-500" :
                status === "testing" ? "bg-blue-500" :
                status === "error" ? "bg-red-500" : "bg-gray-400"
              )}>
                {status === "testing" ? (
                  <Loader2 className="w-7 h-7 animate-spin" />
                ) : connected ? (
                  <CheckCircle2 className="w-7 h-7" />
                ) : (
                  <XCircle className="w-7 h-7" />
                )}
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900">ZapSign</p>
                <p className="text-sm text-gray-500">Assinatura digital de contratos</p>
              </div>
            </div>
            <span className={cn(
              "px-4 py-1.5 rounded-full text-sm font-semibold",
              connected ? "bg-emerald-50 text-emerald-700" :
              status === "testing" ? "bg-blue-50 text-blue-700" :
              status === "error" ? "bg-red-50 text-red-700" : "bg-gray-100 text-gray-600"
            )}>
              {connected ? "Conectado" :
               status === "testing" ? "Testando..." :
               status === "error" ? "Desconectado" : "Verificando..."}
            </span>
          </div>

          {/* Detalhe do erro */}
          {error && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <span className="text-red-700">{error}</span>
            </div>
          )}

          {/* Última verificação */}
          {lastCheck && (
            <p className="text-xs text-gray-400 text-center">
              Última verificação: {lastCheck.toLocaleTimeString("pt-BR")}
            </p>
          )}

          {/* Botão de teste */}
          <Button
            onClick={testarZapSign}
            disabled={status === "testing"}
            variant={connected ? "outline" : "default"}
            className="w-full gap-2 rounded-xl"
          >
            {status === "testing" ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Testando conexão...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Testar conexão
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <p className="text-xs text-gray-400 text-center">
        O token do ZapSign é configurado nos secrets do sistema. Se a conexão falhar, verifique se o token está válido em app.zapsign.com.br.
      </p>
    </div>
  );
}