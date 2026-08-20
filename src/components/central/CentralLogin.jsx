import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useDebounce } from "@/hooks/usePerformance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, ChevronRight, Wifi, FileText, CreditCard, Wrench, Headphones } from "lucide-react";

export default function CentralLogin({ onLogin }) {
  const [documento, setDocumento] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const debouncedDoc = useDebounce(documento, 500);

  const formatarDoc = (val) => {
    const d = val.replace(/\D/g, "");
    if (d.length <= 11) {
      return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4").replace(/(\.\d{3}\.\d{3})(\d{1,3})/, "$1-$2");
    }
    return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  };

  const handleLogin = async () => {
    const doc = documento.replace(/\D/g, "");
    if (doc.length < 11) { setErro("Informe um CPF ou CNPJ válido."); return; }
    setLoading(true); setErro("");
    try {
      const res = await base44.functions.invoke("centralAssinante", { cpf_cnpj: doc });
      if (res.erro) { setErro(res.erro); setLoading(false); return; }
      onLogin(doc, res);
    } catch (e) {
      setErro("Erro ao conectar. Tente novamente.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center space-y-2 pb-6">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-2">
            <Shield className="w-7 h-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-heading">Central do Assinante</CardTitle>
          <p className="text-sm text-muted-foreground">Acesse suas faturas, contratos e suporte</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">CPF ou CNPJ</label>
            <Input
              value={formatarDoc(documento)}
              onChange={(e) => setDocumento(e.target.value.replace(/\D/g, "").slice(0, 14))}
              placeholder="000.000.000-00"
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              className="h-12 text-lg"
            />
          </div>
          {erro && <p className="text-sm text-destructive">{erro}</p>}
          <Button onClick={handleLogin} disabled={loading || !documento} className="w-full h-12 text-base" size="lg">
            {loading ? "Conectando..." : "Acessar"}
            {!loading && <ChevronRight className="w-5 h-5" />}
          </Button>
          <div className="grid grid-cols-4 gap-2 pt-4">
            {[
              { icon: Wifi, label: "Faturas" },
              { icon: CreditCard, label: "PIX" },
              { icon: FileText, label: "Contratos" },
              { icon: Wrench, label: "Suporte" },
            ].map((f, i) => (
              <div key={i} className="flex flex-col items-center gap-1 text-center">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <f.icon className="w-5 h-5 text-muted-foreground" />
                </div>
                <span className="text-[10px] text-muted-foreground">{f.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}