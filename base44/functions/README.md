# Integrações IXCsoft + ZapSign — Guia de instalação

Funções de backend (Deno) para o app Base44. Cada arquivo `.js` em `functions/` é uma
function que o frontend já chama via `base44.functions.invoke("nome", payload)`.
Os arquivos `ixcClient.js` e `zapsignClient.js` são módulos compartilhados (não são endpoints).

## 1. Secrets (Configurações do app > Secrets)

| Secret           | Exemplo                                   | Usado por                |
|------------------|-------------------------------------------|--------------------------|
| `IXC_HOST`       | `https://meuprovedor.ixc.com.br`          | todas as funções IXC     |
| `IXC_TOKEN`      | `28:0a1b2c...` (formato `id:hash`)         | todas as funções IXC     |
| `IXC_AUTH_BASIC` | token já codificado em Base64 (opcional)   | alternativa ao IXC_TOKEN |
| `ZAPSIGN_TOKEN`  | token da API ZapSign                       | contratos                |
| `ZAPSIGN_BASE`   | (opcional) `https://sandbox.api.zapsign…` | usar sandbox em testes   |
| `VALIDO_CHAVE_ACESSO` | chave de produção Valido Cadastro     | análise de crédito       |
| `VALIDO_URL`     | (opcional) endpoint `json/service.aspx`    | análise de crédito       |
| `VALIDO_CODIGO_PRODUTO` | (opcional) código do produto         | análise de crédito       |
| `VALIDO_VERSAO`  | (opcional) versão do produto               | análise de crédito       |
| `EVOLUTION_URL`  | URL raiz do Evolution Go                   | WhatsApp                 |
| `EVOLUTION_API_KEY` | chave global do Evolution Go            | WhatsApp                 |
| `EVOLUTION_INSTANCE_ID` | (opcional) UUID da instância          | WhatsApp                 |
| `EVOLUTION_WEBHOOK_URL` | (opcional) URL pública do webhook     | WhatsApp                 |

O token do IXC é gerado no painel IXC e **já vem no formato `id:hash`** — o client faz o base64.
Se o painel fornecer o valor já em Base64, salve-o em `IXC_AUTH_BASIC` e não em `IXC_TOKEN`.
`IXC_HOST` aceita tanto a raiz do domínio quanto a URL completa terminada em `/webservice/v1/`.

## 2. Funções públicas (sem login)

Marque como **públicas** no Base44 (são acessadas fora da área logada):

- `boletoFacil`     → página `/boleto`
- `assinarOnline`   → página `/assine`
- `webhookZapsign`  → chamada pelo servidor do ZapSign

As demais exigem usuário autenticado (admin/gerente/vendedor).

## 3. Webhook do ZapSign (assinatura em tempo real)

1. Pegue a URL pública da function `webhookZapsign` (Base44 mostra a URL do endpoint).
2. No ZapSign: **Configurações > Webhooks** → adicione a URL, evento **doc_signed**.
3. Quando o cliente assina, o Pedido vira `assinado` automaticamente e o botão
   **"Ativar Cliente no IXC"** aparece na esteira. Sem webhook, use o botão
   **"Sincronizar"** em `/contratos` (função `sincronizarContratos`, polling).

## 4. Campos de entidade usados

O código grava estes campos — confirme que existem nas entidades do app:

- **Pedido**: `sincronizado_ixc`, `id_cliente_ixc`, `id_contrato_ixc`, `id_os_ixc`,
  `link_assinatura`, `zapsign_token`, `contrato_id`, `data_ativacao`
- **Contrato**: `pedido_id`, `cliente_nome`, `status`, `link_assinatura`,
  `zapsign_token`, `template_id`, `conteudo`, `data_assinatura`
- **TemplateContrato**: `id_modelo_ixc`
- **Plano**: `id_modelo_ixc`, `id_produto_ixc`
- **ConfigRegras**: `id_filial_ixc`, `id_vendedor_ixc_padrao`, `id_assunto_os_ixc`,
  `id_setor_os_ixc`, `contribuinte_pf`, `status_contrato_inicial`
  - opcionais p/ contrato: `id_tipo_contrato_ixc`, `id_carteira_cobranca_ixc`,
    `status_internet_inicial` (A/D), `fidelidade_meses`, `dia_vencimento_padrao`

## 5. Pontos que variam por instância IXC (revisar)

O schema do IXC muda entre provedores. Confira principalmente:

- `cliente_contrato`: campos `id_modelo`, `status`, `status_internet`.
- `radgrupo` / `vd_produto`: nomes das tabelas de velocidade e produto em `sincronizarIXC`
  (caso sua instância use outras, ajuste `getPlanosERadius`).
- `su_oss_chamado`: `id_assunto`, `id_setor`, `tipo`, `status`.
- `get_pix` / `get_boleto`: alguns provedores usam endpoints/campos diferentes para 2ª via.

Cada função devolve o `detalhe`/`avisos` do IXC quando algo não confirma, pra facilitar o ajuste.

## 6. Ordem de teste sugerida

1. `testarIXC` (Configurações > IXC > Testar Conexão) e `testarZapSign` (Contratos).
2. `sincronizarIXC` (Configurações > Sincronizar) — puxa filiais/vendedores/OS/planos.
3. Vincule filial, vendedor, assunto/setor de OS e mapeie os planos ao IXC.
4. Em um pedido: **Enviar Contrato (ZapSign)** → assinar → **Ativar Cliente no IXC**.

---

## 7. Modelos de contrato do IXC (variáveis `#...#`)

Os modelos copiados do IXC usam variáveis no formato **`#variavel#`** e o corpo é HTML.
O módulo `templateIXC.js` cuida disso:

- **`montarVariaveisIXC(ctx)`** — monta o mapa de variáveis a partir do `lead`/`pedido`/`plano`/`config`.
- **`renderizarContrato(modelo, ctx)`** — preenche as variáveis e converte o HTML em texto limpo para o PDF.
- Aceita `#variavel#` (IXC), `{{variavel}}` e `{variavel}`, sem diferenciar maiúsc./minúsc.

Variáveis suportadas (mapeadas para os campos do CRM):

`#cliente_razao#`, `#cliente_fantasia#`, `#cliente_CNPJ_CPF#`, `#cliente_RG_IE#`,
`#cliente_inscricao_municipal#`, `#cliente_endereco#`, `#cliente_numero#`,
`#cliente_complemento#`, `#cliente_cep#`, `#cliente_bairro#`, `#cliente_cidade#`,
`#cliente_uf#`, `#cliente_celular#`, `#cliente_fone#`, `#cliente_fone_comercial#`,
`#cliente_email#`, `#cliente_nome_representante_1#`, `#cliente_cpf_representante_1#`,
`#cliente_identidade_representante_1#`, `#contrato_endereco#`, `#contrato_endereco_numero#`,
`#contrato_complemento#`, `#contrato_cep#`, `#contrato_bairro#`, `#contrato_cidade#`,
`#contrato_uf#`, `#contrato_data_ativacao_renovacao_extenso#`, `#tipo_de_conexao#`.

> `#contrato_grade_comodato_sem_val#` (grade de equipamentos do comodato) fica em branco no
> momento da venda — é preenchida na instalação, no IXC. Variável desconhecida vira string vazia.

Cópias dos modelos reais ficam em **`modelos_ixc/`** (referência/seed).

## 8. Vincular planos a contratos + módulo do painel

- **`pages/ConfiguracaoContratos.jsx`** — tela do painel para: (a) **Sincronizar modelos do IXC**
  (chama `sincronizarIXC` com `tipo:"sync_modelos"`) e (b) **vincular cada Plano** aos modelos
  que devem ser assinados (adesão, permanência, comodato...).
- A vinculação é salva em **`Plano.template_ids`** (lista de IDs de `TemplateContrato`).
- No envio (`enviarContrato` / `assinarOnline`), a ordem de resolução do modelo é:
  `template_id` explícito → `plano.template_ids[]` → `plano.template_contrato_id` → texto padrão.
  Vários modelos são unidos num único PDF e enviados juntos ao ZapSign.

### Campos de entidade adicionais (além da seção 4)

- **Plano**: `template_ids` (lista de IDs), opcional `template_contrato_id`, `tipo_conexao`.
- **TemplateContrato**: `tipo_modelo` (adesão/permanência/comodato, vindo do IXC quando existir).

### Como adicionar a página no Base44

1. Crie a página `ConfiguracaoContratos` e cole o conteúdo de `pages/ConfiguracaoContratos.jsx`.
2. Adicione um item no menu/layout apontando para ela (ex.: Configurações → Contratos).
3. Garanta o campo `template_ids` (lista) na entidade `Plano`.
