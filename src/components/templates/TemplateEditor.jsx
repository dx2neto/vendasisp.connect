import { useRef } from "react";

const VARIAVEIS = {
  "Cliente": [
    { chave: "cliente_nome", label: "Nome" },
    { chave: "cliente_cpf", label: "CPF/CNPJ" },
    { chave: "cliente_email", label: "E-mail" },
    { chave: "cliente_telefone", label: "Telefone" },
    { chave: "cliente_rg", label: "RG" },
    { chave: "cliente_endereco", label: "Endereço" },
    { chave: "cliente_numero", label: "Número" },
    { chave: "cliente_complemento", label: "Complemento" },
    { chave: "cliente_bairro", label: "Bairro" },
    { chave: "cliente_cidade", label: "Cidade" },
    { chave: "cliente_uf", label: "Estado" },
    { chave: "cliente_cep", label: "CEP" },
  ],
  "Contrato": [
    { chave: "plano_nome", label: "Plano" },
    { chave: "valor", label: "Valor Mensal" },
    { chave: "data_contrato", label: "Data do Contrato" },
    { chave: "data_ativacao", label: "Data de Ativação" },
    { chave: "vendedor_nome", label: "Vendedor" },
  ],
};

export default function TemplateEditor({ value, onChange }) {
  const textareaRef = useRef(null);

  const inserirVariavel = (chave) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const novoTexto = value.substring(0, start) + `{{${chave}}}` + value.substring(end);
    onChange(novoTexto);
    setTimeout(() => {
      const novaPosicao = start + chave.length + 4;
      textarea.focus();
      textarea.setSelectionRange(novaPosicao, novaPosicao);
    }, 10);
  };

  return (
    <div className="space-y-3">
      {Object.entries(VARIAVEIS).map(([grupo, vars]) => (
        <div key={grupo}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">{grupo}</p>
          <div className="flex flex-wrap gap-1.5">
            {vars.map(({ chave, label }) => (
              <button
                key={chave}
                type="button"
                onClick={() => inserirVariavel(chave)}
                className="text-xs px-2 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-colors font-mono"
                title={`{{${chave}}}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="border border-border rounded-lg overflow-hidden">
        <div className="bg-muted/50 px-3 py-1.5 border-b border-border">
          <span className="text-xs text-muted-foreground">Clique nas variáveis acima para inserir no cursor</span>
        </div>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`CONTRATO DE PRESTAÇÃO DE SERVIÇOS\n\nContratante: {{cliente_nome}}\nCPF/CNPJ: {{cliente_cpf}}\nEndereço: {{cliente_endereco}}, {{cliente_numero}}\nCidade: {{cliente_cidade}}/{{cliente_uf}}\n\nPlano: {{plano_nome}}\nValor: R$ {{valor}}/mês\nData: {{data_contrato}}\n\nAssina: {{cliente_nome}}`}
          className="w-full h-72 p-3 font-mono text-sm bg-card border-0 focus:outline-none resize-none"
        />
      </div>
    </div>
  );
}

export { VARIAVEIS };