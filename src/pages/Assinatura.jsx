import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Wifi, ChevronDown, ChevronUp, Globe, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ─── Utilitários ─────────────────────────────────────────────────────────────
const fmtBRL = (v) => `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

async function buscarCep(cep) {
  const raw = cep.replace(/\D/g, "");
  if (raw.length !== 8) return null;
  const r = await fetch(`https://viacep.com.br/ws/${raw}/json/`);
  const data = await r.json();
  return data.erro ? null : data;
}

// ─── Etapa 0: Onde você está? ─────────────────────────────────────────────────
function EtapaEndereco({ onNext, vendedorId }) {
  const [form, setForm] = useState({
    tipo_acesso: "Residencial",
    nome: "", email: "", telefone: "",
    cep: "", endereco: "", numero: "", bairro: "", cidade: "", uf: "",
    aceito: false,
  });
  const [buscandoCep, setBuscandoCep] = useState(false);

  const handleCep = async (cep) => {
    setForm(f => ({ ...f, cep }));
    if (cep.replace(/\D/g, "").length === 8) {
      setBuscandoCep(true);
      const dados = await buscarCep(cep);
      if (dados) {
        setForm(f => ({
          ...f,
          endereco: dados.logradouro,
          bairro: dados.bairro,
          cidade: dados.localidade,
          uf: dados.uf,
        }));
      }
      setBuscandoCep(false);
    }
  };

  const handleContinuar = () => {
    if (!form.nome || !form.email || !form.telefone || !form.cep) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    if (!form.aceito) {
      toast.error("Aceite os termos para continuar");
      return;
    }
    onNext(form);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-lg p-8 space-y-5">
        <div className="text-center mb-2">
          <h1 className="text-2xl font-bold text-gray-800">ONDE VOCÊ ESTÁ?</h1>
          <p className="text-sm text-gray-500 mt-1">Digite seu CEP para verificar a disponibilidade dos nossos serviços</p>
        </div>

        <div>
          <label className="text-sm font-semibold text-primary">Tipo de Acesso</label>
          <select
            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            value={form.tipo_acesso}
            onChange={e => setForm(f => ({ ...f, tipo_acesso: e.target.value }))}
          >
            <option>Residencial</option>
            <option>Empresarial</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-semibold text-primary">Nome completo *</label>
          <Input className="mt-1" placeholder="Seu nome completo" value={form.nome}
            onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-semibold text-primary">Email *</label>
            <Input className="mt-1" type="email" placeholder="seu@email.com" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label className="text-sm font-semibold text-primary">Telefone Celular *</label>
            <Input className="mt-1" placeholder="(64) 99999-9999" value={form.telefone}
              onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-semibold text-primary">CEP de instalação *</label>
            <Input className="mt-1" placeholder="75360-000" value={form.cep}
              onChange={e => handleCep(e.target.value)} />
            {buscandoCep && <span className="text-xs text-muted-foreground">Buscando...</span>}
          </div>
          <div>
            <label className="text-sm font-semibold text-primary">Nº da Residência</label>
            <Input className="mt-1" placeholder="12" value={form.numero}
              onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} />
          </div>
        </div>

        {form.endereco && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-semibold text-primary">Endereço</label>
              <Input className="mt-1" value={form.endereco}
                onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-semibold text-primary">Bairro</label>
              <Input className="mt-1" value={form.bairro}
                onChange={e => setForm(f => ({ ...f, bairro: e.target.value }))} />
            </div>
          </div>
        )}

        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <input type="checkbox" className="mt-0.5" checked={form.aceito}
            onChange={e => setForm(f => ({ ...f, aceito: e.target.checked }))} />
          <span className="text-gray-600">Autorizo a utilização das minhas informações para contato posterior.</span>
        </label>

        <Button className="w-full rounded-xl h-11 text-base font-semibold" onClick={handleContinuar}>
          CONTINUAR
        </Button>
        <button className="w-full text-sm text-gray-400 hover:text-gray-600" onClick={() => setForm({ tipo_acesso: "Residencial", nome: "", email: "", telefone: "", cep: "", endereco: "", numero: "", bairro: "", cidade: "", uf: "", aceito: false })}>
          Limpar
        </button>
      </div>
    </div>
  );
}

// ─── Etapa 1: Escolha de Planos ────────────────────────────────────────────────
function EtapaPlanos({ endereco, planos, onNext, onBack }) {
  const [planoSelecionado, setPlanoSelecionado] = useState(null);

  const planoObj = planos.find(p => p.id === planoSelecionado);
  const total = planoObj ? planoObj.preco_mensal : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header info */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-sm text-gray-600">
          <div>
            <span className="font-semibold text-primary">Endereço da assinatura:</span>{" "}
            {endereco.endereco}, {endereco.numero} — {endereco.cidade}/{endereco.uf} {endereco.cep}
          </div>
          <div>
            <span className="font-semibold">Acesso:</span> {endereco.tipo_acesso} — Não vou te limitar
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col lg:flex-row gap-6">
        {/* Planos */}
        <div className="flex-1 space-y-6">
          {/* Internet */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="bg-primary/10 px-5 py-3 flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              <h2 className="font-bold text-primary uppercase tracking-wide">Planos de Internet</h2>
            </div>
            <div className="p-4">
              <p className="text-xs text-gray-500 mb-4">Escolha a velocidade da sua Banda Larga</p>
              {planoSelecionado ? (
                <div className="flex items-center justify-between bg-primary text-white rounded-xl px-5 py-4">
                  <div>
                    <p className="font-bold text-lg">{planoObj?.nome}</p>
                    <p className="text-sm opacity-80">{fmtBRL(planoObj?.preco_mensal)}/mês</p>
                  </div>
                  <Button variant="outline" size="sm" className="text-primary bg-white hover:bg-gray-100 rounded-lg" onClick={() => setPlanoSelecionado(null)}>
                    ALTERAR
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {planos.map((plano, i) => {
                    const cores = ["bg-orange-500", "bg-primary", "bg-orange-400", "bg-blue-600"];
                    const cor = cores[i % cores.length];
                    return (
                      <div key={plano.id} className={cn("rounded-xl text-white p-4 space-y-3", cor)}>
                        <div>
                          <p className="text-2xl font-extrabold">{plano.velocidade_mbps < 1000 ? `${plano.velocidade_mbps} MEGA` : `${plano.velocidade_mbps / 1000} GIGA`}</p>
                          <p className="text-sm font-semibold opacity-90">{fmtBRL(plano.preco_mensal)}/mês</p>
                        </div>
                        <div className="text-xs space-y-1 opacity-90">
                          <div className="flex items-center gap-1"><Check className="w-3 h-3" /> Instalação grátis</div>
                          <div className="flex items-center gap-1"><Check className="w-3 h-3" /> Wi-Fi Plus incluso</div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => setPlanoSelecionado(plano.id)}
                          className="w-full rounded-lg bg-white text-gray-800 hover:bg-gray-100 font-semibold text-xs"
                        >
                          ESCOLHER
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Resumo */}
        <div className="lg:w-72 space-y-3">
          <div className="bg-orange-500 text-white rounded-t-xl px-5 py-3 font-bold uppercase tracking-wide text-sm">
            RESUMO DO PEDIDO
          </div>
          <div className="bg-white rounded-b-xl border border-gray-200 p-4 space-y-4">
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-gray-600"><Globe className="w-4 h-4" /> Internet</span>
                <span className={planoSelecionado ? "font-semibold text-gray-800" : "text-primary text-xs"}>
                  {planoSelecionado ? fmtBRL(planoObj?.preco_mensal) : "ADICIONAR ITEM"}
                </span>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-3 flex items-center justify-between font-bold">
              <span>TOTAL:</span>
              <span className="text-primary text-lg">{fmtBRL(total)}</span>
            </div>

            <Button
              className="w-full rounded-xl h-11 font-bold"
              disabled={!planoSelecionado}
              onClick={() => onNext({ plano: planoObj, total })}
            >
              CONTINUAR ASSINATURA
            </Button>
            <button className="w-full text-xs text-gray-400 hover:text-gray-600" onClick={onBack}>
              Voltar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Etapa 2: Dados da Assinatura ─────────────────────────────────────────────
function EtapaDados({ endereco, plano, onNext, onBack }) {
  const [form, setForm] = useState({
    cpf: "", rg: "", data_nascimento: "", como_chegou: "",
    observacoes: "",
    end_instalacao_cep: endereco.cep,
    end_instalacao_rua: endereco.endereco,
    end_instalacao_numero: endereco.numero,
    end_instalacao_complemento: "",
    end_instalacao_bairro: endereco.bairro,
    cobranca_igual: true,
  });

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-center text-gray-800">FINALIZE SUA ASSINATURA ONLINE</h1>

        {/* Steps */}
        <div className="flex items-center justify-center gap-4 text-xs font-semibold">
          <div className="flex items-center gap-1 text-primary"><span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center">1</span> DADOS DA ASSINATURA</div>
          <div className="h-px w-8 bg-gray-300" />
          <div className="flex items-center gap-1 text-gray-400"><span className="w-5 h-5 rounded-full bg-gray-300 text-white flex items-center justify-center">2</span> PAGAMENTO</div>
          <div className="h-px w-8 bg-gray-300" />
          <div className="flex items-center gap-1 text-gray-400"><span className="w-5 h-5 rounded-full bg-gray-300 text-white flex items-center justify-center">3</span></div>
        </div>

        {/* Resumo do plano */}
        <div className="bg-gray-700 text-white rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="font-bold">{plano.plano.nome}</p>
            <button className="text-xs text-blue-300 underline" onClick={onBack}>Alterar plano</button>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-300">TOTAL</p>
            <p className="font-bold text-lg">{fmtBRL(plano.total)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Dados pessoais */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="font-bold text-primary uppercase text-sm tracking-wide">Dados da Assinatura</h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600">WhatsApp (opcional)</label>
                <Input className="mt-1 text-sm" placeholder="(64) 99999-9999" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Telefone fixo (opcional)</label>
                <Input className="mt-1 text-sm" placeholder="(64) 3000-0000" />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600">CPF *</label>
              <Input className="mt-1 text-sm" placeholder="000.000.000-00" value={form.cpf}
                onChange={e => setForm(f => ({ ...f, cpf: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">RG</label>
              <Input className="mt-1 text-sm" placeholder="00.000.000-X" value={form.rg}
                onChange={e => setForm(f => ({ ...f, rg: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Data de Nascimento</label>
              <Input className="mt-1 text-sm" type="date" value={form.data_nascimento}
                onChange={e => setForm(f => ({ ...f, data_nascimento: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Como você chegou até nós?</label>
              <select
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={form.como_chegou}
                onChange={e => setForm(f => ({ ...f, como_chegou: e.target.value }))}
              >
                <option value="">Selecione uma opção</option>
                <option>Indicação de amigo</option>
                <option>Redes sociais</option>
                <option>Vendedor porta a porta</option>
                <option>Google</option>
                <option>Outros</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Observações gerais</label>
              <textarea
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Ponto, sala, complemento das funcionar..."
                value={form.observacoes}
                onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
              />
            </div>
          </div>

          {/* Endereços */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <h2 className="font-bold text-primary uppercase text-sm tracking-wide">Endereço de Instalação</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600">CEP</label>
                  <Input className="mt-1 text-sm" value={form.end_instalacao_cep}
                    onChange={e => setForm(f => ({ ...f, end_instalacao_cep: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600">Cidade</label>
                  <Input className="mt-1 text-sm" value={endereco.cidade} readOnly />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Endereço</label>
                <Input className="mt-1 text-sm" value={form.end_instalacao_rua}
                  onChange={e => setForm(f => ({ ...f, end_instalacao_rua: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600">Número</label>
                  <Input className="mt-1 text-sm" value={form.end_instalacao_numero}
                    onChange={e => setForm(f => ({ ...f, end_instalacao_numero: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600">Bairro</label>
                  <Input className="mt-1 text-sm" value={form.end_instalacao_bairro}
                    onChange={e => setForm(f => ({ ...f, end_instalacao_bairro: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Complemento</label>
                <Input className="mt-1 text-sm" placeholder="Apto, bloco, casa, quadra, lote..."
                  value={form.end_instalacao_complemento}
                  onChange={e => setForm(f => ({ ...f, end_instalacao_complemento: e.target.value }))} />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-bold text-primary uppercase text-sm tracking-wide mb-3">Endereço de Cobrança</h2>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.cobranca_igual}
                  onChange={e => setForm(f => ({ ...f, cobranca_igual: e.target.checked }))} />
                Usar o mesmo endereço de instalação
              </label>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack} className="rounded-xl px-8">Voltar</Button>
          <Button className="flex-1 rounded-xl h-11 font-bold" onClick={() => onNext(form)}>
            Continuar
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Etapa 3: Pagamento e Assinatura ─────────────────────────────────────────
function EtapaPagamento({ endereco, plano, dados, onSubmit, isLoading, onBack }) {
  const [fidelidade, setFidelidade] = useState("12 meses");
  const [vencimento, setVencimento] = useState("10");
  const [termos, setTermos] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-center text-gray-800">FINALIZE SUA ASSINATURA ONLINE</h1>

        <div className="flex items-center justify-center gap-4 text-xs font-semibold">
          <div className="flex items-center gap-1 text-gray-400"><span className="w-5 h-5 rounded-full bg-gray-300 text-white flex items-center justify-center">✓</span> DADOS DA ASSINATURA</div>
          <div className="h-px w-8 bg-gray-300" />
          <div className="flex items-center gap-1 text-primary"><span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center">2</span> PAGAMENTO</div>
          <div className="h-px w-8 bg-gray-300" />
          <div className="flex items-center gap-1 text-gray-400"><span className="w-5 h-5 rounded-full bg-gray-300 text-white flex items-center justify-center">3</span></div>
        </div>

        <div className="bg-gray-700 text-white rounded-xl p-4 flex items-center justify-between">
          <p className="font-bold">{plano.plano.nome}</p>
          <div className="text-right">
            <p className="text-xs text-gray-300">TOTAL</p>
            <p className="font-bold text-lg">{fmtBRL(plano.total)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Fidelidade e vencimento */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <div>
                <h2 className="font-bold text-primary uppercase text-sm tracking-wide mb-2">Fidelidade</h2>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={fidelidade} onChange={e => setFidelidade(e.target.value)}
                >
                  <option>12 meses</option>
                  <option>24 meses</option>
                  <option>Sem fidelidade</option>
                </select>
              </div>

              <div>
                <h2 className="font-bold text-primary uppercase text-sm tracking-wide mb-2">Vencimento da Fatura</h2>
                <div className="space-y-1.5">
                  {["05", "10", "15", "20"].map(d => (
                    <label key={d} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" name="venc" value={d} checked={vencimento === d}
                        onChange={() => setVencimento(d)} />
                      Dia {d}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">Receber por E-Mail</p>
                <p className="text-xs text-gray-400">Enviaremos a fatura por e-mail no endereço {endereco.email}</p>
                <p className="text-xs text-yellow-600 mt-2">IMPORTANTE: Você também receberá boletos por via.</p>
              </div>
            </div>
          </div>

          {/* Confirmação de identidade e termos */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <h2 className="font-bold text-primary uppercase text-sm tracking-wide">Confirmação de Identidade</h2>
              <p className="text-xs text-gray-500">
                Para agilizarmos o processo de ativação, pedimos uma foto do RG, CPF ou CNH (frente e verso).
                Após a confirmação das informações, você receberá um sinal do link de assinatura digital.
              </p>
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                <p className="text-xs font-semibold text-primary mb-2">Documentos enviados:</p>
                <div className="space-y-1 text-xs text-gray-500">
                  <div className="flex items-center gap-1"><Check className="w-3 h-3 text-emerald-500" /> Documento de identificação (frente)</div>
                  <div className="flex items-center gap-1"><Check className="w-3 h-3 text-emerald-500" /> Documento de identidade (verso)</div>
                  <div className="flex items-center gap-1"><Check className="w-3 h-3 text-emerald-500" /> Comprovante de residência</div>
                  <div className="flex items-center gap-1"><Check className="w-3 h-3 text-emerald-500" /> Selfie com o RG/CNH</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <h2 className="font-bold text-primary uppercase text-sm tracking-wide">Termos de Uso</h2>
              <label className="flex items-start gap-2 text-xs cursor-pointer text-gray-600">
                <input type="checkbox" className="mt-0.5" checked={termos}
                  onChange={e => setTermos(e.target.checked)} />
                Li e aceito os termos da Condição de prestação de serviço. Declaro que as informações prestadas são verídicas.
              </label>
              <Button
                className="w-full rounded-xl font-bold"
                disabled={!termos || isLoading}
                onClick={() => onSubmit({ fidelidade, vencimento })}
              >
                {isLoading ? "Processando..." : "Assinar Digitalmente"}
              </Button>
              <p className="text-[10px] text-gray-400 text-center">Ao assinar, uma notificação para assinatura digital será enviada ao seu e-mail e WhatsApp em até 24 horas.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Etapa 4: Confirmação ─────────────────────────────────────────────────────
function EtapaConfirmacao({ plano, endereco, onNova }) {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-center text-gray-800">SOLICITAÇÃO DE ASSINATURA RECEBIDA</h1>

        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center space-y-4">
          <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-emerald-500" />
          </div>
          <h2 className="text-xl font-bold text-primary">OBRIGADO POR ESCOLHER A CONNECT TELECOM!</h2>

          <div className="bg-primary text-white rounded-xl p-4 text-left space-y-2">
            <p className="font-bold text-sm uppercase">Itens contratados</p>
            <div className="flex items-center justify-between">
              <span className="text-sm"><Wifi className="inline w-4 h-4 mr-1" /> {plano.plano.nome}</span>
              <span className="font-bold">{fmtBRL(plano.total)}/MÊS</span>
            </div>
            <div className="border-t border-white/30 pt-2 flex justify-between font-bold">
              <span>TOTAL</span>
              <span>{fmtBRL(plano.total)}/MENSALIDADE</span>
            </div>
          </div>

          <div className="text-left space-y-3">
            <h3 className="font-bold text-primary uppercase text-sm tracking-wide">Agendamento da Instalação</h3>
            <p className="text-sm text-gray-600">
              Nossa equipe de atendimento entrará em contato para agendar a sua instalação.
            </p>
            <p className="text-sm text-gray-600">
              Para mais informações sobre a instalação, fale com a Connect Telecom no nosso WhatsApp ou ligue.
              Qualquer dúvida, entre em contato: falar@connecttelecom.com.br
            </p>
            <p className="text-sm font-semibold text-gray-700">Equipe Connect Telecom</p>
          </div>

          <Button className="w-full rounded-xl font-bold" onClick={onNova}>
            NOVA ASSINATURA
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function Assinatura() {
  const [etapa, setEtapa] = useState(0);
  const [endereco, setEndereco] = useState(null);
  const [planoInfo, setPlanoInfo] = useState(null);
  const [dados, setDados] = useState(null);

  // Suporte a vendedor via ?v=ID
  const urlParams = new URLSearchParams(window.location.search);
  const vendedorId = urlParams.get("v") || null;

  const { data: planos = [] } = useQuery({
    queryKey: ["planos-ativos"],
    queryFn: () => base44.entities.Plano.filter({ ativo: true }, "velocidade_mbps", 50),
  });

  const criarMutation = useMutation({
    mutationFn: async ({ fidelidade, vencimento }) => {
      const lead = await base44.entities.Lead.create({
        nome: endereco.nome,
        cnpj_cpf: dados.cpf || "",
        rg: dados.rg || "",
        tipo_pessoa: "F",
        email: endereco.email,
        telefone: endereco.telefone,
        cep: endereco.cep,
        rua: dados.end_instalacao_rua || endereco.endereco,
        numero: dados.end_instalacao_numero || endereco.numero,
        bairro: dados.end_instalacao_bairro || endereco.bairro,
        cidade_nome: endereco.cidade,
        uf: endereco.uf,
        canal_origem: "site",
        etapa_funil: "novo",
        observacao: dados.observacoes || "",
      });

      await base44.entities.Pedido.create({
        lead_id: lead.id,
        lead_nome: endereco.nome,
        lead_cpf: dados.cpf || "",
        plano_id: planoInfo.plano.id,
        plano_nome: planoInfo.plano.nome,
        valor: planoInfo.total,
        vendedor_id: vendedorId || "",
        status: "novo",
        canal_origem: vendedorId ? "revenda" : "site",
        observacao: `Fidelidade: ${fidelidade} | Vencimento: dia ${vencimento}`,
      });
    },
    onSuccess: () => setEtapa(4),
    onError: (e) => toast.error("Erro ao processar: " + e.message),
  });

  const reset = () => {
    setEtapa(0);
    setEndereco(null);
    setPlanoInfo(null);
    setDados(null);
  };

  if (etapa === 0) return <EtapaEndereco vendedorId={vendedorId} onNext={(end) => { setEndereco(end); setEtapa(1); }} />;
  if (etapa === 1) return <EtapaPlanos endereco={endereco} planos={planos} onNext={(p) => { setPlanoInfo(p); setEtapa(2); }} onBack={() => setEtapa(0)} />;
  if (etapa === 2) return <EtapaDados endereco={endereco} plano={planoInfo} onNext={(d) => { setDados(d); setEtapa(3); }} onBack={() => setEtapa(1)} />;
  if (etapa === 3) return <EtapaPagamento endereco={endereco} plano={planoInfo} dados={dados} isLoading={criarMutation.isPending} onSubmit={(p) => criarMutation.mutate(p)} onBack={() => setEtapa(2)} />;
  if (etapa === 4) return <EtapaConfirmacao plano={planoInfo} endereco={endereco} onNova={reset} />;
}