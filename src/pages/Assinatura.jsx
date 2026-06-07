import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Check, Wifi, Globe, CheckCircle, Upload, X, FileText,
  Eye, Loader2, PenLine
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const fmtBRL = (v) => `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

async function buscarCep(cep) {
  const raw = cep.replace(/\D/g, "");
  if (raw.length !== 8) return null;
  const r = await fetch(`https://viacep.com.br/ws/${raw}/json/`);
  const data = await r.json();
  return data.erro ? null : data;
}

// ─── StepBar ──────────────────────────────────────────────────────────────────
function StepBar({ etapa }) {
  const steps = ["Endereço", "Planos", "Dados", "Documentos", "Contrato"];
  return (
    <div className="flex items-center justify-center gap-2 text-xs font-semibold flex-wrap">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={cn("flex items-center gap-1", etapa === i ? "text-primary" : etapa > i ? "text-emerald-600" : "text-gray-400")}>
            <span className={cn("w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px]",
              etapa > i ? "bg-emerald-500" : etapa === i ? "bg-primary" : "bg-gray-300"
            )}>
              {etapa > i ? "✓" : i + 1}
            </span>
            <span className="hidden sm:inline">{s}</span>
          </div>
          {i < steps.length - 1 && <div className="h-px w-6 bg-gray-300" />}
        </div>
      ))}
    </div>
  );
}

// ─── PlanoBanner ──────────────────────────────────────────────────────────────
function PlanoBanner({ plano, onBack }) {
  return (
    <div className="bg-gray-700 text-white rounded-xl p-4 flex items-center justify-between">
      <div>
        <p className="font-bold">{plano.plano.nome}</p>
        {onBack && <button className="text-xs text-blue-300 underline" onClick={onBack}>Alterar plano</button>}
      </div>
      <div className="text-right">
        <p className="text-xs text-gray-300">TOTAL</p>
        <p className="font-bold text-lg">{fmtBRL(plano.total)}</p>
      </div>
    </div>
  );
}

// ─── Etapa 0: Endereço ────────────────────────────────────────────────────────
function EtapaEndereco({ onNext }) {
  const [form, setForm] = useState({
    tipo_acesso: "Residencial",
    nome: "", email: "", telefone: "",
    cep: "", endereco: "", numero: "", bairro: "", cidade: "", uf: "",
    aceito: false,
  });
  const [buscandoCep, setBuscandoCep] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleCep = async (cep) => {
    set("cep", cep);
    if (cep.replace(/\D/g, "").length === 8) {
      setBuscandoCep(true);
      const dados = await buscarCep(cep);
      if (dados) setForm(f => ({ ...f, endereco: dados.logradouro, bairro: dados.bairro, cidade: dados.localidade, uf: dados.uf }));
      setBuscandoCep(false);
    }
  };

  const continuar = () => {
    if (!form.nome || !form.email || !form.telefone || !form.cep || !form.cidade) {
      toast.error("Preencha todos os campos obrigatórios"); return;
    }
    if (!form.aceito) { toast.error("Aceite os termos para continuar"); return; }
    onNext(form);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-lg p-8 space-y-5">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800">ONDE VOCÊ ESTÁ?</h1>
          <p className="text-sm text-gray-500 mt-1">Preencha seus dados para verificar a disponibilidade</p>
        </div>

        <div>
          <label className="text-sm font-semibold text-primary">Tipo de Acesso</label>
          <select className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            value={form.tipo_acesso} onChange={e => set("tipo_acesso", e.target.value)}>
            <option>Residencial</option><option>Empresarial</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-semibold text-primary">Nome completo *</label>
          <Input className="mt-1" placeholder="Seu nome completo" value={form.nome} onChange={e => set("nome", e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-semibold text-primary">Email *</label>
            <Input className="mt-1" type="email" placeholder="seu@email.com" value={form.email} onChange={e => set("email", e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-semibold text-primary">Telefone *</label>
            <Input className="mt-1" placeholder="(64) 99999-9999" value={form.telefone} onChange={e => set("telefone", e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-semibold text-primary">CEP *</label>
            <Input className="mt-1" placeholder="75360-000" value={form.cep} onChange={e => handleCep(e.target.value)} />
            {buscandoCep && <span className="text-xs text-muted-foreground">Buscando...</span>}
          </div>
          <div>
            <label className="text-sm font-semibold text-primary">Número</label>
            <Input className="mt-1" placeholder="12" value={form.numero} onChange={e => set("numero", e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-semibold text-primary">Endereço</label>
            <Input className="mt-1" placeholder="Rua/Av" value={form.endereco} onChange={e => set("endereco", e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-semibold text-primary">Bairro</label>
            <Input className="mt-1" placeholder="Bairro" value={form.bairro} onChange={e => set("bairro", e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-semibold text-primary">Cidade *</label>
            <Input className="mt-1" placeholder="Sua cidade" value={form.cidade} onChange={e => set("cidade", e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-semibold text-primary">Estado (UF)</label>
            <Input className="mt-1" placeholder="GO" maxLength={2} value={form.uf} onChange={e => set("uf", e.target.value)} />
          </div>
        </div>

        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <input type="checkbox" className="mt-0.5" checked={form.aceito} onChange={e => set("aceito", e.target.checked)} />
          <span className="text-gray-600">Autorizo a utilização das minhas informações para contato posterior.</span>
        </label>

        <Button className="w-full rounded-xl h-11 text-base font-semibold" onClick={continuar}>CONTINUAR</Button>
        <button className="w-full text-sm text-gray-400 hover:text-gray-600"
          onClick={() => setForm({ tipo_acesso: "Residencial", nome: "", email: "", telefone: "", cep: "", endereco: "", numero: "", bairro: "", cidade: "", uf: "", aceito: false })}>
          Limpar
        </button>
      </div>
    </div>
  );
}

// ─── Etapa 1: Planos ──────────────────────────────────────────────────────────
function EtapaPlanos({ endereco, planos, onNext, onBack }) {
  const [planoSelecionado, setPlanoSelecionado] = useState(null);
  const planoObj = planos.find(p => p.id === planoSelecionado);
  const total = planoObj ? planoObj.preco_mensal : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-sm text-gray-600">
          <div><span className="font-semibold text-primary">Endereço:</span> {endereco.endereco}, {endereco.numero} — {endereco.cidade}/{endereco.uf}</div>
          <div><span className="font-semibold">Acesso:</span> {endereco.tipo_acesso}</div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col lg:flex-row gap-6">
        <div className="flex-1 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="bg-primary/10 px-5 py-3 flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              <h2 className="font-bold text-primary uppercase tracking-wide">Planos de Internet</h2>
            </div>
            <div className="p-4">
              {planoSelecionado ? (
                <div className="flex items-center justify-between bg-primary text-white rounded-xl px-5 py-4">
                  <div>
                    <p className="font-bold text-lg">{planoObj?.nome}</p>
                    <p className="text-sm opacity-80">{fmtBRL(planoObj?.preco_mensal)}/mês</p>
                  </div>
                  <Button variant="outline" size="sm" className="text-primary bg-white hover:bg-gray-100 rounded-lg" onClick={() => setPlanoSelecionado(null)}>ALTERAR</Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {planos.map((plano, i) => {
                    const cores = ["bg-orange-500", "bg-primary", "bg-orange-400", "bg-blue-600"];
                    return (
                      <div key={plano.id} className={cn("rounded-xl text-white p-4 space-y-3", cores[i % cores.length])}>
                        <div>
                          <p className="text-2xl font-extrabold">{plano.velocidade_mbps < 1000 ? `${plano.velocidade_mbps} MEGA` : `${plano.velocidade_mbps / 1000} GIGA`}</p>
                          <p className="text-sm font-semibold opacity-90">{fmtBRL(plano.preco_mensal)}/mês</p>
                        </div>
                        <div className="text-xs space-y-1 opacity-90">
                          <div className="flex items-center gap-1"><Check className="w-3 h-3" /> Instalação grátis</div>
                          <div className="flex items-center gap-1"><Check className="w-3 h-3" /> Wi-Fi Plus incluso</div>
                        </div>
                        <Button size="sm" onClick={() => setPlanoSelecionado(plano.id)}
                          className="w-full rounded-lg bg-white text-gray-800 hover:bg-gray-100 font-semibold text-xs">ESCOLHER</Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:w-72 space-y-0">
          <div className="bg-orange-500 text-white rounded-t-xl px-5 py-3 font-bold uppercase tracking-wide text-sm">RESUMO DO PEDIDO</div>
          <div className="bg-white rounded-b-xl border border-gray-200 p-4 space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1 text-gray-600"><Globe className="w-4 h-4" /> Internet</span>
              <span className={planoSelecionado ? "font-semibold text-gray-800" : "text-primary text-xs"}>
                {planoSelecionado ? fmtBRL(planoObj?.preco_mensal) : "ADICIONAR ITEM"}
              </span>
            </div>
            <div className="border-t border-gray-200 pt-3 flex items-center justify-between font-bold">
              <span>TOTAL:</span>
              <span className="text-primary text-lg">{fmtBRL(total)}</span>
            </div>
            <Button className="w-full rounded-xl h-11 font-bold" disabled={!planoSelecionado}
              onClick={() => onNext({ plano: planoObj, total })}>CONTINUAR ASSINATURA</Button>
            <button className="w-full text-xs text-gray-400 hover:text-gray-600" onClick={onBack}>Voltar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Etapa 2: Dados Pessoais ──────────────────────────────────────────────────
function EtapaDados({ endereco, plano, onNext, onBack }) {
  const [form, setForm] = useState({
    cpf: "", rg: "", data_nascimento: "", como_chegou: "", observacoes: "",
    end_instalacao_cep: endereco.cep, end_instalacao_rua: endereco.endereco,
    end_instalacao_numero: endereco.numero, end_instalacao_complemento: "",
    end_instalacao_bairro: endereco.bairro, end_instalacao_cidade: endereco.cidade,
    cobranca_igual: true,
    fidelidade: "12 meses", vencimento: "10",
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const continuar = () => {
    if (!form.cpf) { toast.error("Informe o CPF"); return; }
    onNext(form);
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-center text-gray-800">FINALIZE SUA ASSINATURA ONLINE</h1>
        <StepBar etapa={2} />
        <PlanoBanner plano={plano} onBack={onBack} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Dados pessoais */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="font-bold text-primary uppercase text-sm tracking-wide">Dados Pessoais</h2>
            <div>
              <label className="text-xs font-semibold text-gray-600">CPF *</label>
              <Input className="mt-1 text-sm" placeholder="000.000.000-00" value={form.cpf} onChange={e => set("cpf", e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">RG</label>
              <Input className="mt-1 text-sm" placeholder="00.000.000-X" value={form.rg} onChange={e => set("rg", e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Data de Nascimento</label>
              <Input className="mt-1 text-sm" type="date" value={form.data_nascimento} onChange={e => set("data_nascimento", e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Como chegou até nós?</label>
              <select className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={form.como_chegou} onChange={e => set("como_chegou", e.target.value)}>
                <option value="">Selecione</option>
                <option>Indicação de amigo</option>
                <option>Redes sociais</option>
                <option>Vendedor porta a porta</option>
                <option>Google</option>
                <option>Outros</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Observações</label>
              <textarea className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm min-h-[70px] focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Informações adicionais..." value={form.observacoes} onChange={e => set("observacoes", e.target.value)} />
            </div>

            <div className="border-t pt-4 space-y-3">
              <h3 className="font-bold text-primary uppercase text-xs tracking-wide">Fidelidade e Vencimento</h3>
              <div>
                <label className="text-xs font-semibold text-gray-600">Fidelidade</label>
                <select className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={form.fidelidade} onChange={e => set("fidelidade", e.target.value)}>
                  <option>12 meses</option><option>24 meses</option><option>Sem fidelidade</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-2 block">Vencimento da Fatura</label>
                <div className="grid grid-cols-4 gap-2">
                  {["05", "10", "15", "20"].map(d => (
                    <label key={d} className={cn("flex flex-col items-center gap-1 p-2 rounded-lg border cursor-pointer text-xs font-semibold transition-all",
                      form.vencimento === d ? "border-primary bg-primary/10 text-primary" : "border-gray-200 text-gray-500")}>
                      <input type="radio" name="venc" className="hidden" value={d} checked={form.vencimento === d} onChange={() => set("vencimento", d)} />
                      Dia {d}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Endereço */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <h2 className="font-bold text-primary uppercase text-sm tracking-wide">Endereço de Instalação</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600">CEP</label>
                  <Input className="mt-1 text-sm" value={form.end_instalacao_cep} onChange={e => set("end_instalacao_cep", e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600">Número</label>
                  <Input className="mt-1 text-sm" value={form.end_instalacao_numero} onChange={e => set("end_instalacao_numero", e.target.value)} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Endereço</label>
                <Input className="mt-1 text-sm" value={form.end_instalacao_rua} onChange={e => set("end_instalacao_rua", e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600">Bairro</label>
                  <Input className="mt-1 text-sm" value={form.end_instalacao_bairro} onChange={e => set("end_instalacao_bairro", e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600">Cidade</label>
                  <Input className="mt-1 text-sm" value={form.end_instalacao_cidade} onChange={e => set("end_instalacao_cidade", e.target.value)} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Complemento</label>
                <Input className="mt-1 text-sm" placeholder="Apto, bloco, casa..." value={form.end_instalacao_complemento} onChange={e => set("end_instalacao_complemento", e.target.value)} />
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h2 className="font-bold text-primary uppercase text-sm tracking-wide mb-2">Endereço de Cobrança</h2>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.cobranca_igual} onChange={e => set("cobranca_igual", e.target.checked)} />
                Usar mesmo endereço de instalação
              </label>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack} className="rounded-xl px-8">Voltar</Button>
          <Button className="flex-1 rounded-xl h-11 font-bold" onClick={continuar}>Continuar</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Etapa 3: Documentos ──────────────────────────────────────────────────────
function EtapaDocumentos({ endereco, plano, dados, onNext, onBack }) {
  const [docs, setDocs] = useState({
    rg_frente: null, rg_verso: null,
    comprovante_residencia: null, selfie: null,
  });
  const [uploading, setUploading] = useState({});

  const docLabels = {
    rg_frente: "RG / CNH (Frente) *",
    rg_verso: "RG / CNH (Verso) *",
    comprovante_residencia: "Comprovante de Residência *",
    selfie: "Selfie segurando o documento",
  };

  const handleFile = async (key, file) => {
    if (!file) return;
    setUploading(u => ({ ...u, [key]: true }));
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setDocs(d => ({ ...d, [key]: { name: file.name, url: file_url } }));
    setUploading(u => ({ ...u, [key]: false }));
    toast.success("Documento enviado!");
  };

  const continuar = () => {
    if (!docs.rg_frente || !docs.rg_verso || !docs.comprovante_residencia) {
      toast.error("Envie os documentos obrigatórios (*)"); return;
    }
    onNext(docs);
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-center text-gray-800">FINALIZE SUA ASSINATURA ONLINE</h1>
        <StepBar etapa={3} />
        <PlanoBanner plano={plano} />

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <div>
            <h2 className="font-bold text-primary uppercase text-sm tracking-wide">Confirmação de Identidade</h2>
            <p className="text-xs text-gray-500 mt-1">
              Para agilizarmos o processo, envie os documentos abaixo. Após validação, você receberá o link para assinatura digital.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(docLabels).map(([key, label]) => (
              <UploadCard
                key={key}
                label={label}
                doc={docs[key]}
                loading={uploading[key]}
                onFile={(f) => handleFile(key, f)}
                onRemove={() => setDocs(d => ({ ...d, [key]: null }))}
              />
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack} className="rounded-xl px-8">Voltar</Button>
          <Button className="flex-1 rounded-xl h-11 font-bold" onClick={continuar}>Continuar</Button>
        </div>
      </div>
    </div>
  );
}

function UploadCard({ label, doc, loading, onFile, onRemove }) {
  const ref = useRef();
  return (
    <div className={cn("border-2 border-dashed rounded-xl p-4 text-center space-y-2 transition-all",
      doc ? "border-emerald-400 bg-emerald-50" : "border-gray-300 hover:border-primary/50")}>
      <label className="text-xs font-semibold text-gray-700">{label}</label>
      {loading ? (
        <div className="flex items-center justify-center gap-2 text-xs text-primary py-3">
          <Loader2 className="w-4 h-4 animate-spin" /> Enviando...
        </div>
      ) : doc ? (
        <div className="flex items-center justify-between text-xs text-emerald-700 bg-emerald-100 rounded-lg px-2 py-1.5">
          <span className="flex items-center gap-1 truncate"><Check className="w-3 h-3 flex-shrink-0" />{doc.name}</span>
          <button onClick={onRemove} className="text-red-400 hover:text-red-600 flex-shrink-0 ml-1"><X className="w-3 h-3" /></button>
        </div>
      ) : (
        <button onClick={() => ref.current?.click()}
          className="flex flex-col items-center gap-1 w-full py-3 text-gray-400 hover:text-primary transition-colors">
          <Upload className="w-6 h-6" />
          <span className="text-xs">Clique para enviar</span>
          <span className="text-[10px]">JPG, PNG ou PDF</span>
        </button>
      )}
      <input ref={ref} type="file" accept="image/*,.pdf" className="hidden"
        onChange={e => onFile(e.target.files?.[0])} />
    </div>
  );
}

// ─── Etapa 4: Contrato e Assinatura ──────────────────────────────────────────
function EtapaContrato({ endereco, plano, dados, docs, onSubmit, isLoading, linkAssinatura, onBack }) {
  const [templateSelecionado, setTemplateSelecionado] = useState("");
  const [termos, setTermos] = useState(false);
  const [termoAdesao, setTermoAdesao] = useState(false);
  const [showContrato, setShowContrato] = useState(false);

  const { data: templates = [] } = useQuery({
    queryKey: ["templates-contrato"],
    queryFn: () => base44.entities.TemplateContrato.filter({ ativo: true }),
  });

  const template = templates.find(t => t.id === templateSelecionado);

  const preencherTemplate = (conteudo) => {
    if (!conteudo) return "";
    const now = new Date();
    const vars = {
      cliente_nome: endereco.nome, cliente_cpf: dados.cpf || "", cliente_rg: dados.rg || "",
      cliente_email: endereco.email, cliente_telefone: endereco.telefone,
      cliente_endereco: `${dados.end_instalacao_rua || endereco.endereco}, ${dados.end_instalacao_numero || endereco.numero}`,
      cliente_bairro: dados.end_instalacao_bairro || endereco.bairro,
      cliente_cidade: dados.end_instalacao_cidade || endereco.cidade,
      cliente_uf: endereco.uf || "", cliente_cep: dados.end_instalacao_cep || endereco.cep,
      plano_nome: plano.plano.nome, plano_valor: fmtBRL(plano.total),
      plano_velocidade: `${plano.plano.velocidade_mbps} Mbps`,
      fidelidade: dados.fidelidade || "12 meses", vencimento_dia: dados.vencimento || "10",
      data_hoje: now.toLocaleDateString("pt-BR"),
      data_extenso: now.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" }),
      cidade_contrato: dados.end_instalacao_cidade || endereco.cidade,
    };
    return conteudo.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] || `{{${k}}}`);
  };

  // Se já tem link de assinatura, mostra painel de assinatura inline
  if (linkAssinatura) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <h1 className="text-2xl font-bold text-center text-gray-800">FINALIZE SUA ASSINATURA ONLINE</h1>
          <StepBar etapa={4} />
          <PlanoBanner plano={plano} />

          <div className="bg-white rounded-xl border border-emerald-300 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                <PenLine className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="font-bold text-gray-800">Contrato pronto para assinar!</h2>
                <p className="text-xs text-gray-500">Link também enviado para {endereco.email} e WhatsApp</p>
              </div>
            </div>

            {/* Iframe de assinatura inline */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <iframe
                src={linkAssinatura}
                className="w-full"
                style={{ height: "520px" }}
                title="Assinatura Digital"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <a href={linkAssinatura} target="_blank" rel="noopener noreferrer" className="flex-1">
                <Button variant="outline" className="w-full rounded-xl gap-2">
                  <Eye className="w-4 h-4" /> Abrir em nova aba
                </Button>
              </a>
              <Button className="flex-1 rounded-xl gap-2" onClick={() => onSubmit({ done: true })}>
                <CheckCircle className="w-4 h-4" /> Já assinei — Concluir
              </Button>
            </div>

            <p className="text-xs text-gray-400 text-center">
              Você também pode assinar depois — o link foi enviado por e-mail e WhatsApp.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const canSubmit = termos && termoAdesao && !isLoading;

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-center text-gray-800">FINALIZE SUA ASSINATURA ONLINE</h1>
        <StepBar etapa={4} />
        <PlanoBanner plano={plano} />

        {/* Seleção de template */}
        {templates.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h2 className="font-bold text-primary uppercase text-sm tracking-wide">Modelo de Contrato</h2>
            <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              value={templateSelecionado} onChange={e => setTemplateSelecionado(e.target.value)}>
              <option value="">Selecione o modelo de contrato</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
            {template && (
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowContrato(!showContrato)}>
                <Eye className="w-4 h-4" />{showContrato ? "Ocultar contrato" : "Visualizar contrato preenchido"}
              </Button>
            )}
            {showContrato && template && (
              <div className="border border-gray-200 rounded-xl p-5 bg-gray-50 max-h-80 overflow-y-auto">
                <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                  {preencherTemplate(template.conteudo)}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Termo de adesão */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <h2 className="font-bold text-primary uppercase text-sm tracking-wide flex items-center gap-2">
            <FileText className="w-4 h-4" /> Termos de Adesão
          </h2>
          <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 max-h-48 overflow-y-auto text-xs text-gray-700 leading-relaxed space-y-2">
            <p><strong>TERMOS E CONDIÇÕES DE PRESTAÇÃO DE SERVIÇO DE INTERNET</strong></p>
            <p>Ao assinar este termo, o CONTRATANTE declara ter lido e concordado com as condições gerais de prestação de serviço de internet banda larga da <strong>Connect Telecom</strong>.</p>
            <p><strong>1. OBJETO:</strong> Prestação de serviço de acesso à internet em banda larga conforme o plano contratado.</p>
            <p><strong>2. PRAZO:</strong> Fidelidade de {dados?.fidelidade || "12 meses"} a contar da data de ativação.</p>
            <p><strong>3. PAGAMENTO:</strong> Mensalidade de {fmtBRL(plano?.total)} até o dia {dados?.vencimento || "10"} de cada mês.</p>
            <p><strong>4. INSTALAÇÃO:</strong> Agendada após confirmação do cadastro e viabilidade técnica.</p>
            <p><strong>5. CANCELAMENTO:</strong> Multa proporcional ao período de fidelidade restante.</p>
            <p><strong>6. SUPORTE:</strong> Disponível pelos canais oficiais no horário comercial.</p>
          </div>
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input type="checkbox" className="mt-0.5" checked={termoAdesao} onChange={e => setTermoAdesao(e.target.checked)} />
            <span className="text-gray-700 font-medium">Li e aceito os Termos e Condições de Prestação de Serviço</span>
          </label>
        </div>

        {/* Resumo + botão */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-bold text-primary uppercase text-sm tracking-wide flex items-center gap-2">
            <PenLine className="w-4 h-4" /> Assinatura Digital
          </h2>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800 space-y-1">
            <p className="font-semibold">Resumo:</p>
            <p>• Plano: <strong>{plano.plano.nome}</strong> — {fmtBRL(plano.total)}/mês</p>
            <p>• Fidelidade: <strong>{dados?.fidelidade || "12 meses"}</strong> | Vencimento: <strong>Dia {dados?.vencimento || "10"}</strong></p>
            <p>• Endereço: <strong>{dados?.end_instalacao_rua || endereco.endereco}, {dados?.end_instalacao_numero || endereco.numero} — {dados?.end_instalacao_cidade || endereco.cidade}</strong></p>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-800 space-y-1">
            <p className="font-semibold">📱 Como funciona:</p>
            <p>Ao clicar em <strong>"Assinar Agora"</strong>, seu contrato será gerado e você poderá assinar diretamente aqui na página. O link também será enviado para <strong>{endereco.email}</strong> e <strong>WhatsApp ({endereco.telefone})</strong>.</p>
          </div>

          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input type="checkbox" className="mt-0.5" checked={termos} onChange={e => setTermos(e.target.checked)} />
            <span className="text-gray-600">Confirmo que li e aceito todas as condições acima.</span>
          </label>

          <Button className="w-full rounded-xl h-12 font-bold text-base gap-2"
            disabled={!canSubmit} onClick={() => onSubmit({ templateId: templateSelecionado })}>
            {isLoading ? (<><Loader2 className="w-4 h-4 animate-spin" /> Gerando contrato...</>) : (<><PenLine className="w-4 h-4" /> Assinar Agora</>)}
          </Button>
        </div>

        <Button variant="outline" onClick={onBack} className="w-full rounded-xl">Voltar</Button>
      </div>
    </div>
  );
}

// ─── Etapa 5: Confirmação ─────────────────────────────────────────────────────
function EtapaConfirmacao({ plano, endereco, dados, onNova }) {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-center text-gray-800">SOLICITAÇÃO DE ASSINATURA RECEBIDA</h1>
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center space-y-5">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-9 h-9 text-emerald-500" />
          </div>
          <h2 className="text-xl font-bold text-primary">OBRIGADO POR ESCOLHER A CONNECT TELECOM!</h2>

          <div className="bg-primary text-white rounded-xl p-4 text-left space-y-2">
            <p className="font-bold text-sm uppercase">Itens contratados</p>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1"><Wifi className="w-4 h-4" /> {plano.plano.nome}</span>
              <span className="font-bold">{fmtBRL(plano.total)}/mês</span>
            </div>
            <div className="border-t border-white/30 pt-2 flex justify-between font-bold text-sm">
              <span>TOTAL</span><span>{fmtBRL(plano.total)}/MENSALIDADE</span>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-left text-sm text-yellow-800 space-y-1">
            <p className="font-semibold">📧 Próximos passos:</p>
            <p>1. Você receberá um <strong>link de assinatura digital</strong> no e-mail <strong>{endereco.email}</strong></p>
            <p>2. Nossa equipe entrará em contato para <strong>agendar a instalação</strong></p>
            <p>3. Após a instalação, seu serviço será <strong>ativado automaticamente</strong></p>
          </div>

          <div className="text-left text-sm text-gray-600 space-y-1">
            <p>Dúvidas? Entre em contato: <strong>falar@connecttelecom.com.br</strong></p>
            <p className="font-semibold text-gray-700">Equipe Connect Telecom</p>
          </div>

          <Button className="w-full rounded-xl font-bold" onClick={onNova}>NOVA ASSINATURA</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Principal ────────────────────────────────────────────────────────────────
export default function Assinatura() {
  const [etapa, setEtapa] = useState(0);
  const [endereco, setEndereco] = useState(null);
  const [planoInfo, setPlanoInfo] = useState(null);
  const [dados, setDados] = useState(null);
  const [docs, setDocs] = useState(null);
  const [linkAssinatura, setLinkAssinatura] = useState(null);

  const urlParams = new URLSearchParams(window.location.search);
  const vendedorId = urlParams.get("v") || null;

  const { data: planos = [] } = useQuery({
    queryKey: ["planos-ativos"],
    queryFn: () => base44.entities.Plano.filter({ ativo: true }, "velocidade_mbps", 50),
  });

  const criarMutation = useMutation({
    mutationFn: async ({ templateId, done }) => {
      // Se o usuário clicou "Já assinei", vai direto pra confirmação
      if (done) return { link_assinatura: linkAssinatura };

      const res = await base44.functions.invoke("assinarOnline", {
        endereco,
        plano_info: planoInfo,
        dados,
        template_id: templateId || null,
        vendedor_id: vendedorId || null,
      });
      return res.data;
    },
    onSuccess: (data) => {
      if (data?.done) { setEtapa(5); return; }
      if (data?.link_assinatura) {
        setLinkAssinatura(data.link_assinatura);
        // Mantém na etapa 4 para assinar inline, mas mostra o iframe
      } else {
        // Sem ZapSign configurado, vai direto pra confirmação
        setEtapa(5);
      }
    },
    onError: (e) => toast.error("Erro ao processar: " + e.message),
  });

  const reset = () => {
    setEtapa(0); setEndereco(null); setPlanoInfo(null);
    setDados(null); setDocs(null); setLinkAssinatura(null);
  };

  if (etapa === 0) return <EtapaEndereco onNext={e => { setEndereco(e); setEtapa(1); }} />;
  if (etapa === 1) return <EtapaPlanos endereco={endereco} planos={planos} onNext={p => { setPlanoInfo(p); setEtapa(2); }} onBack={() => setEtapa(0)} />;
  if (etapa === 2) return <EtapaDados endereco={endereco} plano={planoInfo} onNext={d => { setDados(d); setEtapa(3); }} onBack={() => setEtapa(1)} />;
  if (etapa === 3) return <EtapaDocumentos endereco={endereco} plano={planoInfo} dados={dados} onNext={d => { setDocs(d); setEtapa(4); }} onBack={() => setEtapa(2)} />;
  if (etapa === 4) return <EtapaContrato endereco={endereco} plano={planoInfo} dados={dados} docs={docs}
    isLoading={criarMutation.isPending} linkAssinatura={linkAssinatura}
    onSubmit={p => criarMutation.mutate(p)} onBack={() => setEtapa(3)} />;
  if (etapa === 5) return <EtapaConfirmacao plano={planoInfo} endereco={endereco} dados={dados} onNova={reset} />;
}