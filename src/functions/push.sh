#!/usr/bin/env bash
# Sobe as functions para dx2neto/vendasisp.connect, dentro da pasta functions/.
# Rode na SUA máquina (onde você já está autenticado no GitHub via gh ou git).
set -e
REPO="https://github.com/dx2neto/vendasisp.connect.git"
TMP="$(mktemp -d)"
echo "Clonando $REPO ..."
git clone "$REPO" "$TMP/repo"
mkdir -p "$TMP/repo/functions" "$TMP/repo/pages" "$TMP/repo/modelos_ixc"
# copia functions/, a página de configuração e os modelos do IXC
cp ./*.js "$TMP/repo/functions/"
cp ./README.md "$TMP/repo/functions/README.md"
[ -d ../pages ] && cp ../pages/*.jsx "$TMP/repo/pages/" 2>/dev/null || true
[ -d ../modelos_ixc ] && cp ../modelos_ixc/*.html "$TMP/repo/modelos_ixc/" 2>/dev/null || true
cd "$TMP/repo"
git add functions pages modelos_ixc
git commit -m "feat: IXCsoft + ZapSign, modelos IXC e módulo de configuração de contratos"
git push origin HEAD
echo "OK! Enviado: functions/, pages/ConfiguracaoContratos.jsx e modelos_ixc/"
