import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, ChevronRight, Wifi, FileText, CreditCard, Wrench, KeyRound } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function CentralLogin({ onLogin }) {
  const [documento, setDocumento] = useState("");
  const [otp, setOtp] = useState("");
  const [token, setToken] = useState("");
  const [step, setStep] = useState("cpf");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [phoneMasked, setPhoneMasked] = useState("");

  const formatarDoc = (val) => {
    const d = val.replace(/\D/g, "");
    if (d.length <= 11) {
      return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4").replace(/(\.\d{3}\.\d{3})(\d{1,3})/, "$1-$2");
    }
    return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  };

  const handleRequestOtp = async () => {
    const doc = documento.replace(/\D/g, "");
    if (doc.length < 11) { setErro("Informe um CPF ou CNPJ válido."); return; }
    setLoading(true); setErro("");
    try {
      const res = await base44.functions.invoke("centralAssinante", { cpf_cnpj: doc, step: "request" });
      if (res.erro) { setErro(res.erro); return; }
      setToken(res.token);
      setPhoneMasked(res.phone_masked || "");
      setStep("otp");
    } catch (e) {
      setErro("Erro ao conectar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const doc = documento.replace(/\D/g, "");
    const otpClean = otp.replace(/\D/g, "");
    if (otpClean.length !== 6) { setErro("Informe o código de 6 dígitos."); return; }
    setLoading(true); setErro("");
    try {
      const res = await base44.functions.invoke("centralAssinante", { cpf_cnpj: doc, step: "verify", otp: otpClean, token });
      if (res.erro) { setErro(res.erro); return; }
      onLogin(doc, res);
    } catch (e) {
      setErro("Código inválido ou expirado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep("cpf"); setOtp(""); setToken(""); setErro(""); setPhoneMasked("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center space-y-2 pb-6">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-2">
            {step === "otp" ? <KeyRound className="w-7 h-7 text-primary-foreground" /> : <Shield className="w-7 h-7 text-primary-foreground" />}
          </div>
          <CardTitle className="text-2xl font-heading">Central do Assinante</CardTitle>
          <p className="text-sm text-muted-foreground">
            {step === "cpf" ? "Acesse suas faturas, contratos e suporte" : "Digite o código enviado no seu WhatsApp"}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === "cpf" ? (
            <>
              <div>
                <label className="text-sm font-medium mb-1.5 block">CPF ou CNPJ</label>
                <Input
                  value={formatarDoc(documento)}
                  onChange={(e) => setDocumento(e.target.value.replace(/\D/g, "").slice(0, 14))}
                  placeholder="000.000.000-00"
                  onKeyDown={(e) => e.key === "Enter" && handleRequestOtp()}
                  className="h-12 text-lg"
                />
              </div>
              {erro && <p className="text-sm text-destructive">{erro}</p>}
              <Button onClick={handleRequestOtp} disabled={loading || !documento} className="w-full h-12 text-base" size="lg">
                {loading ? "Enviando código..." : "Acessar"}
                {!loading && <ChevronRight className="w-5 h-5" />}
              </Button>
            </>
          ) : (
            <>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Código de verificação</label>
                <Input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
                  className="h-12 text-lg text-center tracking-widest"
                  inputMode="numeric"
                />
                {phoneMasked && (
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Código enviado para {phoneMasked}
                  </p>
                )}
              </div>
              {erro && <p className="text-sm text-destructive">{erro}</p>}
              <Button onClick={handleVerifyOtp} disabled={loading || otp.length !== 6} className="w-full h-12 text-base" size="lg">
                {loading ? "Verificando..." : "Verificar"}
                {!loading && <ChevronRight className="w-5 h-5" />}
              </Button>
              <Button variant="ghost" onClick={handleBack} className="w-full text-sm">
                Voltar
              </Button>
            </>
          )}
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