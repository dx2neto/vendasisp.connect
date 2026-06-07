import { Eye } from "lucide-react";

const DADOS_EXEMPLO = {
  cliente_nome: "João da Silva",
  cliente_cpf: "123.456.789-00",
  cliente_email: "joao@email.com",
  cliente_telefone: "(11) 99999-9999",
  cliente_rg: "12.345.678-9",
  cliente_endereco: "Rua das Flores",
  cliente_numero: "123",
  cliente_complemento: "Apto 4",
  cliente_bairro: "Centro",
  cliente_cidade: "São Paulo",
  cliente_uf: "SP",
  cliente_cep: "01310-100",
  plano_nome: "Fibra 200MB",
  valor: "99,90",
  data_contrato: new Date().toLocaleDateString("pt-BR"),
  data_ativacao: new Date(Date.now() + 7 * 86400000).toLocaleDateString("pt-BR"),
  vendedor_nome: "Maria Vendedora",
};

function preencherVariaveis(conteudo, dados) {
  if (!conteudo) return "";
  let resultado = conteudo;
  Object.entries(dados).forEach(([chave, valor]) => {
    resultado = resultado.replace(new RegExp(`\\{\\{${chave}\\}\\}`, "g"), valor);
  });
  return resultado;
}

function destacarVariaveis(conteudo) {
  return conteudo.replace(/\{\{(\w+)\}\}/g, (match, chave) => (
    `<mark style="background:#dbeafe;color:#1e40af;border-radius:3px;padding:0 2px;font-family:monospace;font-size:0.85em">${match}</mark>`
  ));
}

export default function TemplatePreview({ conteudo, dadosReais }) {
  const dados = dadosReais || DADOS_EXEMPLO;
  const preenchido = preencherVariaveis(conteudo, dados);
  const isExemplo = !dadosReais;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Preview</span>
        </div>
        {isExemplo && (
          <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
            Dados de exemplo
          </span>
        )}
      </div>
      <div className="border border-border rounded-lg bg-white dark:bg-card p-4 h-72 overflow-y-auto font-mono text-sm whitespace-pre-wrap leading-relaxed">
        {preenchido || <span className="text-muted-foreground italic">O contrato aparecerá aqui...</span>}
      </div>
    </div>
  );
}

export { preencherVariaveis };