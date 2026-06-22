import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShoppingCart, Check } from "lucide-react";
import { Toaster, toast } from "sonner";

export default function Loja() {
  const [carrinho, setCarrinho] = useState([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [formData, setFormData] = useState({ nome: "", email: "", telefone: "", cep: "" });

  const { data: planos = [] } = useQuery({
    queryKey: ["planos"],
    queryFn: () => base44.entities.Plano.filter({ ativo: true }, "-created_date", 50),
  });

  const criarPedidoMutation = useMutation({
    mutationFn: async () => {
      if (!carrinho.length) return;
      if (!formData.nome || !formData.email) {
        toast.error("Preencha nome e email");
        return;
      }

      const planoSelecionado = planos.find(p => p.id === carrinho[0].plano_id);
      if (!planoSelecionado) return;

      // Criar lead
      const lead = await base44.entities.Lead.create({
        nome: formData.nome,
        cnpj_cpf: formData.cep,
        tipo_pessoa: "F",
        email: formData.email,
        telefone: formData.telefone,
        cep: formData.cep,
        canal_origem: "site",
        etapa_funil: "novo",
      });

      // Criar pedido
      const pedido = await base44.entities.Pedido.create({
        lead_id: lead.id,
        lead_nome: formData.nome,
        plano_id: planoSelecionado.id,
        plano_nome: planoSelecionado.nome,
        valor: planoSelecionado.preco_mensal,
        status: "novo",
        canal_origem: "site",
      });

      return pedido;
    },
    onSuccess: (pedido) => {
      if (pedido) {
        toast.success("Pedido criado! Logo entraremos em contato.");
        setCarrinho([]);
        setFormData({ nome: "", email: "", telefone: "", cep: "" });
        setShowCheckout(false);
      }
    },
    onError: (error) => {
      toast.error("Erro ao criar pedido: " + error.message);
    },
  });

  const adicionarCarrinho = (plano) => {
    if (!carrinho.find(c => c.plano_id === plano.id)) {
      setCarrinho([...carrinho, { plano_id: plano.id, plano_nome: plano.nome, preco: plano.preco_mensal }]);
      toast.success(`${plano.nome} adicionado ao carrinho`);
    }
  };

  const removerCarrinho = (planoId) => {
    setCarrinho(carrinho.filter(c => c.plano_id !== planoId));
  };

  const totalCarrinho = carrinho.reduce((s, c) => s + c.preco, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <Toaster position="top-right" />

      {/* Hero */}
      <div className="relative px-4 py-16 md:py-24 text-center">
        <h1 className="text-4xl md:text-5xl font-bold max-w-2xl mx-auto">Internet de Altíssima Velocidade</h1>
        <p className="text-lg text-muted-foreground mt-4 max-w-xl mx-auto">Conexão estável e rápida para sua casa ou empresa</p>
      </div>

      <div className="max-w-7xl mx-auto px-4 pb-16 space-y-12">
        {/* Planos */}
        <div>
          <h2 className="text-2xl font-bold mb-8 text-center">Nossos Planos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {planos.map(plano => (
              <Card key={plano.id} className="rounded-2xl border border-border overflow-hidden hover:shadow-lg transition-all hover:scale-105 flex flex-col">
                <CardHeader className="bg-gradient-to-r from-primary/5 to-accent/5">
                  <CardTitle className="text-xl">{plano.nome}</CardTitle>
                </CardHeader>
                <CardContent className="p-6 flex-1 flex flex-col">
                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-primary">{plano.velocidade_mbps}</span>
                      <span className="text-muted-foreground">Mbps</span>
                    </div>
                  </div>

                  <div className="space-y-3 mb-6 flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>Download ultra rápido</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>Conexão estável 24/7</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>Suporte técnico incluso</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>Sem taxa de instalação</span>
                    </div>
                  </div>

                  <div className="space-y-3 border-t border-border pt-6">
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-3xl font-bold text-primary">R$ {plano.preco_mensal.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</span>
                      <span className="text-muted-foreground text-sm">/mês</span>
                    </div>
                    <Button
                      onClick={() => adicionarCarrinho(plano)}
                      className="w-full rounded-xl gap-2"
                      disabled={carrinho.some(c => c.plano_id === plano.id)}
                    >
                      <ShoppingCart className="w-4 h-4" />
                      {carrinho.some(c => c.plano_id === plano.id) ? "No Carrinho" : "Adicionar"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Carrinho */}
        {carrinho.length > 0 && (
          <div className="sticky bottom-4 left-0 right-0 md:relative md:bottom-auto">
            <Card className="rounded-2xl border border-primary shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">{carrinho.length} plano(s) selecionado(s)</p>
                    <p className="text-2xl font-bold text-primary">R$ {totalCarrinho.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/mês</p>
                  </div>
                  <Button onClick={() => setShowCheckout(true)} size="lg" className="rounded-xl gap-2">
                    <ShoppingCart className="w-5 h-5" />
                    Finalizar Compra
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 rounded-2xl">
          <Card className="w-full max-w-lg rounded-2xl border border-border">
            <CardHeader className="border-b border-border">
              <CardTitle>Finalizar Pedido</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Nome Completo</label>
                <Input
                  placeholder="Seu nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  className="rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Email</label>
                <Input
                  type="email"
                  placeholder="seu@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Telefone</label>
                <Input
                  placeholder="(11) 98765-4321"
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                  className="rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">CEP</label>
                <Input
                  placeholder="12345-678"
                  value={formData.cep}
                  onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
                  className="rounded-lg"
                />
              </div>

              <div className="bg-muted/50 rounded-xl p-4 space-y-2">
                <p className="text-sm font-semibold">Resumo:</p>
                {carrinho.map(c => (
                  <div key={c.plano_id} className="flex justify-between text-sm">
                    <span>{c.plano_nome}</span>
                    <span className="font-semibold">R$ {c.preco.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</span>
                  </div>
                ))}
                <div className="border-t border-border pt-2 flex justify-between font-bold">
                  <span>Total:</span>
                  <span className="text-primary">R$ {totalCarrinho.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowCheckout(false)}
                  className="flex-1 rounded-lg"
                >
                  Voltar
                </Button>
                <Button
                  onClick={() => criarPedidoMutation.mutate()}
                  disabled={criarPedidoMutation.isPending}
                  className="flex-1 rounded-lg"
                >
                  {criarPedidoMutation.isPending ? "Processando..." : "Confirmar Pedido"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}