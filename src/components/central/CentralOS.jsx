import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wrench, Calendar, MessageSquare } from "lucide-react";

export default function CentralOS({ cliente }) {
  const os = cliente?.os || [];

  if (os.length === 0) {
    return (
      <Card><CardContent className="py-12 text-center text-muted-foreground">
        <Wrench className="w-8 h-8 mx-auto mb-2 opacity-30" />
        Nenhuma ordem de serviço encontrada.
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-heading font-bold px-1">Ordens de Serviço</h2>
      {os.map((o) => (
        <Card key={o.id}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-semibold text-sm">OS #{o.id}</p>
                <p className="text-xs text-muted-foreground">{o.assunto}</p>
              </div>
              <Badge variant={o.status === "Aberta" ? "secondary" : "outline"}>{o.status}</Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {o.data_abertura}</span>
            </div>
            {o.mensagem && (
              <div className="mt-2 p-2 rounded-md bg-muted text-xs text-muted-foreground flex items-start gap-1.5">
                <MessageSquare className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>{o.mensagem}</span>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}