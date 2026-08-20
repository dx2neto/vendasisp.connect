# RUNBOOK — BaseSales Pro (ISP)

## Visão Geral

Sistema completo de orquestração de vendas para provedores de internet (ISP), com:
- CRM e esteira comercial
- Integração IXCSoft (ERP)
- Assinatura digital (ZapSign)
- Comunicação WhatsApp (Evolution API)
- Consulta cadastral/crédito (Valido Cadastro)
- Central do Assinante (self-service)
- Segurança, auditoria e LGPD

---

## Arquitetura

### Frontend
- React + Vite + Tailwind CSS + shadcn/ui
- Roteamento: React Router (lazy loading + Suspense)
- Estado: React Query (cache 30s stale, 5min gcTime)
- Auth: AuthProvider + ProtectedRoute com RBAC

### Backend
- Funções em `base44/functions/` (Deno + TypeScript)
- Shared modules em `base44/shared/`
- Entidades em `base44/entities/` (JSON Schema + RLS)
- Automações: scheduled, entity triggers, connector webhooks

### Papéis (RBAC)
- **admin**: acesso total
- **gerente**: visão do time comercial
- **vendedor**: suas vendas e leads
- **revendedor**: pedidos onde é revendedor
- **cliente**: apenas seus dados (Central do Assinante)

---

## Integrações

### IXCSoft
- **Secrets**: `IXC_API_URL`, `IXC_ADMIN_TOKEN`
- **Client**: `base44/shared/ixcClient.ts`
- **Operações**: CRUD clientes, contratos, faturas, OS, planos, atendimentos
- **Retry**: 3 tentativas, backoff 1s/2s/4s
- **Logs**: IntegrationLog (sanitizado)
- **Webhook**: `webhookIXC/entry.ts` (token: `IXC_WEBHOOK_TOKEN`)

### ZapSign
- **Secrets**: `ZAPSIGN_TOKEN`, `ZAPSIGN_BASE`
- **Client**: `base44/shared/zapsignClient.ts`
- **Fluxo**: Venda aprovada → gerar PDF → criar doc ZapSign → enviar link → webhook → baixar PDF → anexar ao IXC
- **Webhook**: `webhookZapSign/entry.ts`

### Evolution API (WhatsApp)
- **Secrets**: `EVOLUTION_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE_ID`
- **Client**: `base44/shared/evolutionClient.ts`
- **Uso**: Notificações de contrato, boleto, PIX, agendamento, pós-venda, NPS
- **Webhook**: `webhookWhatsapp/entry.ts`

### Valido Cadastro (Crédito)
- **Secrets**: `VALIDO_URL`, `VALIDO_CHAVE_ACESSO`, `VALIDO_CODIGO_PRODUTO`, `VALIDO_VERSAO`
- **Função**: `consultarCredito/entry.ts`
- **Motor de decisão**: `RegraCredito` entity (APROVAR/ALERTAR/MANUAL/BLOQUEAR)

---

## Fluxo End-to-End (Venda)

```
1. Nova Venda (Lead/Pedido)
2. Validar CPF/CNPJ (security.ts: validateDocument)
3. Consultar IXC (ixcBuscarCliente)
   ├── Cliente existe? → Carregar contratos, débitos, histórico
   └── Cliente novo? → Prosseguir
4. Consultar Cadastro/Crédito (consultarCredito)
   ├── APROVADO → Prosseguir
   ├── ALERTAR → Análise manual
   └── REPROVADO → Cancelar
5. Análise de Cobertura (Viabilidade)
6. Selecionar Plano + Adicionais
7. Criar/Atualizar Cliente no IXC (ixcCriarCliente/ixcAtualizarCliente)
8. Criar Contrato no IXC (ixcCriarContrato)
9. Gerar Documento (templateIXC.ts + zapsignClient.ts)
10. Enviar via ZapSign → Obter link
11. Enviar link via WhatsApp (evolutionClient.ts)
12. Cliente assina → Webhook ZapSign (webhookZapSign/entry.ts)
13. Baixar PDF assinado → Armazenar
14. Anexar ao IXC
15. Criar OS no IXC (ixcCriarOS)
16. Agendar Instalação (ChecklistInstalacao)
17. Checklist Técnico (campos obrigatórios)
18. Ativar Contrato (ixcAtualizarContrato → status: A)
19. Iniciar Faturamento
20. Pós-venda: D+1 funcionamento, D+3 experiência, D+7 NPS
```

---

## Central do Assinante

### Acesso
- **Rota**: `/central` (pública, validação por CPF/CNPJ)
- **Login**: CPF ou CNPJ → consulta IXC → dados do cliente

### Funcionalidades
- **Dashboard**: Plano, status, próxima fatura, botões de ação
- **Seletor de Contratos**: Suporte a múltiplos contratos por cliente
- **Financeiro**: Faturas, boleto, PIX, linha digitável
- **OS**: Ordens de serviço por contrato
- **Suporte**: Abertura de chamados

### Isolamento de Contrato
- Ao selecionar um contrato, apenas faturas e OS daquele contrato são exibidos
- Troca de contrato disponível a qualquer momento

---

## Segurança

### RLS (Row-Level Security)
- **Pedido, Lead, Comissao, AnaliseCredito**: owner (`created_by_id`) + vendedor_id + admin
- **Contato, Conversa, Mensagem**: owner + admin
- **AuditLog, IntegrationLog, SyncQueue, LGPDConsentimento, ConfigRegras**: admin only
- **NPS, ChecklistInstalacao, RegraCredito**: owner + admin

### RBAC (ProtectedRoute)
- Rotas administrativas: admin only
- Rotas comerciais: admin + gerente
- Rotas de venda: admin + gerente + vendedor
- Rotas de revenda: admin + gerente + vendedor + revendedor

### LGPD
- Módulo `shared/security.ts`: mascaramento CPF/CNPJ/telefone/email
- Anonimização de registros (direito ao esquecimento)
- Validação de documentos (CPF/CNPJ)
- Rate limiting em endpoints públicos
- AuditLog para todas as ações sensíveis

---

## Observabilidade

### Correlation ID
- Cada pedido deve ter `correlation_id` para rastrear:
  Venda → IXC → Crédito → ZapSign → Evolution → Webhook → OS → Ativação

### Logs
- **IntegrationLog**: Todas as chamadas a APIs externas
- **AuditLog**: Todas as ações de usuário em entidades sensíveis
- **ErrorLog**: Erros de página, API e automação

---

## Idempotência

Implementada em operações críticas:
- Criação de cliente no IXC (dupla checagem por CPF/CNPJ)
- Criação de contrato (verifica `id_contrato_ixc` antes de criar)
- Webhooks (verificação de duplicidade por event ID)
- Ativação de contrato (verifica status antes de ativar)

---

## Filas e Retry

### SyncQueue
- Entity para processamento assíncrono de integrações
- Status: aguardando → processando → concluido/erro
- Retry: 3 tentativas com backoff exponencial
- Dead letter: `aguardando_correcao` após max_tentativas

---

## Automações Ativas

| Nome | Tipo | Função | Status |
|------|------|--------|--------|
| Régua de Cobrança Diária | scheduled | reguaCobranca | ✅ Ativa |
| Alerta de Renovação (30 dias) | scheduled | alertaRenovacaoContrato | ✅ Ativa |
| Notificar Vendedor - Novo Pedido | entity (Pedido.create) | notificarNovoPedido | ✅ Ativa |
| Alerta - Contrato Assinado | entity (Contrato.update) | atualizarStatusContratoAssinado | ✅ Ativa |
| Notificar Vendedor - Contrato Assinado | entity (Pedido.update) | notificarContratoAssinado | ✅ Ativa |
| Auto Consulta Crédito | entity (Pedido.create) | autoCreditoPedido | ✅ Ativa |
| Cobrança Automática - Contratos Pendentes | scheduled | cobrancaContrato | ⚠️ Inativa (falhas) |

### Arquivadas (funções inexistentes)
- Log Erro ao Atualizar Pedido (registrarErro)
- Sincronizar Sistema Background (sincronizarSistemaBG)
- Monitorar Erros Sistema (monitorarErros)
- Notificar Gerente - Contrato Assinado (notificarGerenteContratoAssinado)
- Envio Automático - Link de Assinatura via WhatsApp (enviarLinkAssinaturaWhatsApp)
- Envio Automático de Contrato ZapSign (enviarContrato)

---

## Troubleshooting

### IXC não conecta
1. Verificar `IXC_API_URL` e `IXC_ADMIN_TOKEN` nos secrets
2. Testar conexão: função `testarIXC`
3. Verificar logs em IntegrationLog (service: "ixc")
4. Validar SSL/DNS do servidor IXC

### Evolution Go (HTTP 526 SSL)
1. Verificar `EVOLUTION_URL` nos secrets
2. Verificar SSL do servidor cloud
3. Logs em IntegrationLog (service: "evolution")
4. A estrutura está pronta — funciona imediatamente após resolução do SSL

### ZapSign não envia
1. Verificar `ZAPSIGN_TOKEN` nos secrets
2. Verificar webhook configurado no painel ZapSign
3. Logs em IntegrationLog (service: "zapsign")

### Cliente não vê faturas na Central
1. Verificar se cliente existe no IXC (CPF/CNPJ correto)
2. Verificar se cliente tem faturas em aberto (status "A")
3. Verificar logs da função `centralAssinante`

---

## Pendências Conhecidas

1. **SDK Version Mismatch**: Frontend `@base44/sdk@0.8.43` vs backend `0.8.31`
2. **Evolution Go SSL**: HTTP 526 no servidor cloud
3. **`.js` Legacy**: 13 arquivos `.js` em `base44/functions/` duplicando lógica `.ts`
4. **`cobrancaContrato` automação**: Inativa com 5 falhas consecutivas
5. **ZapSign nomenclatura**: `zapsign_doc_token` (Pedido) vs `zapsign_token` (Contrato)
6. **Checklist técnico**: Entity criada mas sem UI de preenchimento
7. **NPS**: Entity criada mas sem automação de coleta
8. **Motor de crédito**: Entity `RegraCredito` criada mas sem backend que aplica as regras