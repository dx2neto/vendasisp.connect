import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { Headphones, Send } from "lucide-react";

export default function CentralSuporte({ cliente, contrato }) {
  const { toast } = useToast();
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!assunto || !mensagem) {
      toast({ title: "Preencha os campos", description: "Assunto e descrição são obrigatórios.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      // Cria um registro de contato no CRM
      await base44.entities.Contato.create({
        nome: cliente.cliente.nome,
        telefone: cliente.cliente.whatsapp || cliente.cliente.telefone || "",
      });
      // Cria conversa de suporte
      await base44.entities.Conversa.create({
        contato_nome: cliente.cliente.nome,
        contato_telefone: cliente.cliente.whatsapp || cliente.cliente.telefone || "",
        status: "aguardando",
        ultima_msg: `${assunto}: ${mensagem.slice(0, 80)}`,
        ultima_em: new Date().toISOString(),
      });
      toast({ title: "Solicitação enviada!", description: "Nossa equipe entrará em contato em breve." });
      setAssunto(""); setMensagem("");
    } catch (e) {
      toast({ title: "Erro", description: "Não foi possível enviar a solicitação.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <h2 className="text-lg font-heading font-bold flex items-center gap-2">
            <Headphones className="w-5 h-5 text-primary" /> Suporte
          </h2>
          <p className="text-sm text-muted-foreground">
            Contrato #{contrato?.numero || "—"} • {contrato?.plano || ""}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Assunto</label>
            <Input value={assunto} onChange={(e) => setAssunto(e.target.value)}
              placeholder="Ex: Internet lenta, sem sinal, etc." />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Descrição</label>
            <Textarea value={mensagem} onChange={(e) => setMensagem(e.target.value)}
              placeholder="Descreva o problema..." rows={4} />
          </div>
          <Button onClick={handleSubmit} disabled={loading} className="w-full">
            {loading ? "Enviando..." : <>Enviar Solicitação <Send className="w-4 h-4 ml-1" /></>}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}