import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, MapPin, CheckCircle2, Circle, Wifi } from "lucide-react";

export default function ContractSelector({ contratos, onSelect, onClose }) {
  if (!contratos || contratos.length === 0) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Nenhum contrato encontrado.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto pt-8">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-heading font-bold">Selecione um Contrato</h1>
          <p className="text-sm text-muted-foreground mt-1">Você possui {contratos.length} contrato(s) ativo(s)</p>
        </div>
        <div className="space-y-3">
          {contratos.map((c) => {
            const ativo = c.status_internet === "A";
            return (
              <Card
                key={c.id}
                className="cursor-pointer hover:border-primary hover:shadow-md transition-all"
                onClick={() => onSelect(c)}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${ativo ? "bg-primary/10" : "bg-muted"}`}>
                    {ativo ? <CheckCircle2 className="w-6 h-6 text-primary" /> : <Circle className="w-6 h-6 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">Contrato #{c.numero}</span>
                      <Badge variant={ativo ? "default" : "secondary"}>{ativo ? "Ativo" : c.status || "Inativo"}</Badge>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-0.5">
                      <Wifi className="w-3.5 h-3.5" /> {c.plano}
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="w-3.5 h-3.5" /> {c.endereco}, {c.numero} - {c.bairro}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                </CardContent>
              </Card>
            );
          })}
        </div>
        {onClose && (
          <Button variant="ghost" onClick={onClose} className="w-full mt-4">
            Voltar
          </Button>
        )}
      </div>
    </div>
  );
}