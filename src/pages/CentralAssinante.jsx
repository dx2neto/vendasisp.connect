import React, { useState, useEffect } from "react";
import CentralLogin from "@/components/central/CentralLogin";
import ContractSelector from "@/components/central/ContractSelector";
import CentralDashboard from "@/components/central/CentralDashboard";
import CentralFinanceiro from "@/components/central/CentralFinanceiro";
import CentralOS from "@/components/central/CentralOS";
import CentralSuporte from "@/components/central/CentralSuporte";
import { Button } from "@/components/ui/button";
import { LogOut, LayoutDashboard, CreditCard, Wrench, Headphones, FileText } from "lucide-react";

export default function CentralAssinante() {
  const [doc, setDoc] = useState("");
  const [dados, setDados] = useState(null);
  const [contratoSelecionado, setContratoSelecionado] = useState(null);
  const [aba, setAba] = useState("dashboard");

  useEffect(() => {
    if (dados?.contratos?.length === 1) {
      setContratoSelecionado(dados.contratos[0]);
    }
  }, [dados]);

  const handleLogin = (cpfCnpj, res) => {
    setDoc(cpfCnpj);
    setDados(res);
    if (res.contratos?.length === 1) {
      setContratoSelecionado(res.contratos[0]);
    }
  };

  const handleLogout = () => {
    setDoc(""); setDados(null); setContratoSelecionado(null); setAba("dashboard");
  };

  const handleTrocarContrato = () => {
    setContratoSelecionado(null);
    setAba("dashboard");
  };

  // Não logado
  if (!dados) {
    return <CentralLogin onLogin={handleLogin} />;
  }

  // Logado mas sem contrato selecionado (múltiplos contratos)
  if (!contratoSelecionado && dados.contratos?.length > 0) {
    return (
      <ContractSelector
        contratos={dados.contratos}
        onSelect={(c) => { setContratoSelecionado(c); setAba("dashboard"); }}
        onClose={handleLogout}
      />
    );
  }

  // Logado com contrato selecionado
  const abas = [
    { id: "dashboard", label: "Início", icon: LayoutDashboard },
    { id: "financeiro", label: "Financeiro", icon: CreditCard },
    { id: "os", label: "OS", icon: Wrench },
    { id: "suporte", label: "Suporte", icon: Headphones },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="sticky top-0 z-40 bg-card border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <FileText className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Contrato #{contratoSelecionado?.numero}</p>
            <p className="text-sm font-semibold leading-none">{dados.cliente.nome}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="w-4 h-4" /> Sair
        </Button>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto p-4 pb-20">
        {aba === "dashboard" && (
          <CentralDashboard
            cliente={dados}
            doc={doc}
            contrato={contratoSelecionado}
            onFinanceiro={() => setAba("financeiro")}
            onContratos={handleTrocarContrato}
            onOS={() => setAba("os")}
            onSuporte={() => setAba("suporte")}
            onTrocarContrato={handleTrocarContrato}
          />
        )}
        {aba === "financeiro" && (
          <CentralFinanceiro cliente={dados} doc={doc} contratoId={contratoSelecionado?.id} />
        )}
        {aba === "os" && <CentralOS cliente={dados} />}
        {aba === "suporte" && (
          <CentralSuporte cliente={dados} doc={doc} contrato={contratoSelecionado} />
        )}
      </div>

      {/* Bottom navigation (mobile-first) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t">
        <div className="max-w-2xl mx-auto grid grid-cols-4">
          {abas.map((a) => (
            <button
              key={a.id}
              onClick={() => setAba(a.id)}
              className={`flex flex-col items-center gap-1 py-2.5 transition-colors ${
                aba === a.id ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <a.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{a.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}