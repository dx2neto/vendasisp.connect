import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export default function LeadForm({ lead, onSubmit, isLoading }) {
  const [form, setForm] = useState({
    nome: lead?.nome || "",
    cnpj_cpf: lead?.cnpj_cpf || "",
    tipo_pessoa: lead?.tipo_pessoa || "F",
    rg: lead?.rg || "",
    telefone: lead?.telefone || "",
    email: lead?.email || "",
    cep: lead?.cep || "",
    rua: lead?.rua || "",
    numero: lead?.numero || "",
    complemento: lead?.complemento || "",
    bairro: lead?.bairro || "",
    cidade_nome: lead?.cidade_nome || "",
    id_cidade_ixc: lead?.id_cidade_ixc || "",
    uf: lead?.uf || "",
    canal_origem: lead?.canal_origem || "site",
    plano_interesse: lead?.plano_interesse || "",
    observacao: lead?.observacao || "",
  });

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Nome *</Label>
          <Input value={form.nome} onChange={e => set("nome", e.target.value)} required className="rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label>CPF/CNPJ *</Label>
          <Input value={form.cnpj_cpf} onChange={e => set("cnpj_cpf", e.target.value)} required className="rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label>Tipo Pessoa</Label>
          <Select value={form.tipo_pessoa} onValueChange={v => set("tipo_pessoa", v)}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="F">Pessoa Física</SelectItem>
              <SelectItem value="J">Pessoa Jurídica</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>RG</Label>
          <Input value={form.rg} onChange={e => set("rg", e.target.value)} className="rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label>Telefone</Label>
          <Input value={form.telefone} onChange={e => set("telefone", e.target.value)} className="rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input type="email" value={form.email} onChange={e => set("email", e.target.value)} className="rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label>Canal de Origem</Label>
          <Select value={form.canal_origem} onValueChange={v => set("canal_origem", v)}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="site">Site</SelectItem>
              <SelectItem value="porta_a_porta">Porta a Porta</SelectItem>
              <SelectItem value="call_center">Call Center</SelectItem>
              <SelectItem value="revenda">Revenda</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>CEP</Label>
          <Input value={form.cep} onChange={e => set("cep", e.target.value)} className="rounded-xl" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-1.5">
          <Label>Rua</Label>
          <Input value={form.rua} onChange={e => set("rua", e.target.value)} className="rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label>Número</Label>
          <Input value={form.numero} onChange={e => set("numero", e.target.value)} className="rounded-xl" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label>Bairro</Label>
          <Input value={form.bairro} onChange={e => set("bairro", e.target.value)} className="rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label>Cidade</Label>
          <Input value={form.cidade_nome} onChange={e => set("cidade_nome", e.target.value)} className="rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label>UF</Label>
          <Input value={form.uf} onChange={e => set("uf", e.target.value)} maxLength={2} className="rounded-xl" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Observação</Label>
        <Textarea value={form.observacao} onChange={e => set("observacao", e.target.value)} className="rounded-xl" rows={3} />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="submit" disabled={isLoading} className="rounded-xl px-6">
          {isLoading ? "Salvando..." : lead ? "Atualizar" : "Cadastrar Lead"}
        </Button>
      </div>
    </form>
  );
}