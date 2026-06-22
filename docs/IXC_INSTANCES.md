# IXC_INSTANCES — consulta multi-cidade

Usado por `historicoClienteEndereco` e `relatorioAnalisePedido` para consultar o
histórico do cliente e do endereço em **cada cidade (cada IXC)**.

## Como configurar

1. No Base44, em **Settings → Secrets**, crie o secret **`IXC_INSTANCES`**.
2. Cole o conteúdo de `IXC_INSTANCES.exemplo.json`, trocando em cada cidade:
   - **`host`** → a URL da central daquela cidade, **sem barra no final**
     (ex.: `https://central.cidade.com.br`).
   - **`auth`** → o token IXC daquela cidade no formato `id:hash`, convertido para **Base64**
     (o mesmo formato do `IXC_AUTH_BASIC`).
3. Mantenha como **uma única linha** se o campo de secret não aceitar quebras.

> Se o secret `IXC_INSTANCES` não existir, as funções usam o IXC único já configurado
> (`IXC_HOST` / `IXC_AUTH_BASIC`) como se fosse uma cidade só. Ou seja, já funciona hoje;
> fica completo quando você cadastrar as cidades.

## Como gerar o `auth` (Base64 do token)

O token IXC é `ID_DO_TOKEN:HASH_DO_TOKEN`. Converta para Base64:

- Terminal (Linux/Mac): `printf '%s' 'ID:HASH' | base64`
- Online: qualquer conversor "texto → Base64".

Cole o resultado no campo `auth` da cidade correspondente.

## Cidades (do relatório atual)

IDs conforme o seu ERP: 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13 (12 cidades).
O `id` e o `cidade` são só rótulos no relatório — o que importa para a consulta é `host` + `auth`.
