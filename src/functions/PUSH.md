# Subir as functions em dx2neto/vendasisp.connect

O repositório é privado, então o push precisa da SUA autenticação. Escolha um caminho.

## Opção 1 — script pronto (CLI)  ✅ recomendado
Na sua máquina, já logado no GitHub (via `gh auth login` ou credencial git salva):
```bash
# dentro da pasta crm-functions (descompactada do crm-functions.tar.gz)
./push.sh
```
Ele clona o repo, copia os arquivos para `functions/`, commita e dá push.

## Opção 2 — manual
```bash
git clone https://github.com/dx2neto/vendasisp.connect.git
cd vendasisp.connect
mkdir -p functions
# copie todos os .js + README.md desta entrega para ./functions/
git add functions
git commit -m "feat: integrações IXCsoft + ZapSign (Base44 functions)"
git push origin HEAD
```

## Opção 3 — pelo site (sem terminal)
1. Abra https://github.com/dx2neto/vendasisp.connect
2. **Add file → Upload files**
3. Arraste os `.js` e o `README.md` (de preferência crie/entre na pasta `functions/`)
4. **Commit changes**

## Opção 4 — preservar o histórico que gerei (2 commits)
Use o `crm-functions.bundle`:
```bash
git clone https://github.com/dx2neto/vendasisp.connect.git
cd vendasisp.connect
git fetch /caminho/crm-functions.bundle main:functions-import
git checkout functions-import   # confira; depois mova p/ functions/ e faça merge na sua branch
```

> Não cole tokens de acesso no chat. Se quiser que EU faça o push por você, seria
> necessário um conector do GitHub com permissão de escrita — hoje ele não está
> disponível na lista de conectores desta conta.
