#!/usr/bin/env bash
# Déploie dist/ sur Netlify en une commande, sans Git ni CLI.
#
#   1re fois  :  NETLIFY_AUTH_TOKEN=xxx ./scripts/deploy.sh
#               (crée le site et affiche son SITE_ID)
#   Ensuite   :  NETLIFY_AUTH_TOKEN=xxx NETLIFY_SITE_ID=yyy ./scripts/deploy.sh
#
# Token : app.netlify.com → User settings → Personal access tokens.
# Rien n'est envoyé ailleurs que vers l'API Netlify.

set -euo pipefail
cd "$(dirname "$0")/.."

if [ -z "${NETLIFY_AUTH_TOKEN:-}" ]; then
  echo "✗ NETLIFY_AUTH_TOKEN manquant."
  echo "  1. Ouvre https://app.netlify.com/user/applications#personal-access-tokens"
  echo "  2. Crée un token, puis relance :"
  echo "     NETLIFY_AUTH_TOKEN=xxx ./scripts/deploy.sh"
  exit 1
fi

echo "▸ build…"
[ -d node_modules ] || npm install --no-audit --no-fund
npm run build

echo "▸ archive…"
command -v zip >/dev/null 1 || { echo "✗ 'zip' introuvable"; exit 1; }
# répertoire temporaire : zip ne peut pas écrire dans un fichier vide créé par mktemp
TMPD=$(mktemp -d /tmp/pb2d-XXXXXX)
trap 'rm -rf "$TMPD"' EXIT
ZIP="$TMPD/pb2d.zip"
# racine de l'archive = contenu de dist/ (index.html au sommet)
( cd dist && zip -qr "$ZIP" . -x '*.DS_Store' )
echo "  $(du -h "$ZIP" | cut -f1) — $(unzip -l "$ZIP" | grep -E 'files$' | xargs)"

API="https://api.netlify.com/api/v1"
AUTH="Authorization: Bearer $NETLIFY_AUTH_TOKEN"

if [ -n "${NETLIFY_SITE_ID:-}" ]; then
  echo "▸ déploiement sur le site ${NETLIFY_SITE_ID}…"
  RESP=$(curl -sS --fail-with-body -X POST "$API/sites/$NETLIFY_SITE_ID/deploys" \
    -H "$AUTH" -H "Content-Type: application/zip" --data-binary "@$ZIP") \
    || { echo "✗ échec du déploiement"; printf '%s\n' "$RESP"; rm -f "$ZIP"; exit 1; }
else
  echo "▸ création d'un nouveau site…"
  RESP=$(curl -sS --fail-with-body -X POST "$API/sites" \
    -H "$AUTH" -H "Content-Type: application/zip" --data-binary "@$ZIP") \
    || { echo "✗ échec de création"; printf '%s\n' "$RESP"; rm -f "$ZIP"; exit 1; }
fi
rm -f "$ZIP"

URL=$(printf '%s' "$RESP" | sed -n 's/.*"ssl_url":"\([^"]*\)".*/\1/p')
[ -n "$URL" ] || URL=$(printf '%s' "$RESP" | sed -n 's/.*"url":"\([^"]*\)".*/\1/p')
STATE=$(printf '%s' "$RESP" | sed -n 's/.*"state":"\([^"]*\)".*/\1/p')
NAME=$(printf '%s' "$RESP" | sed -n 's/.*"name":"\([^"]*\)".*/\1/p')
ID=$(printf '%s' "$RESP" | sed -n 's/.*"site_id":"\([^"]*\)".*/\1/p')
DEPLOY_ID=$(printf '%s' "$RESP" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')

if [ -z "$URL" ]; then
  echo "✗ Réponse inattendue :"
  printf '%s\n' "$RESP"
  exit 1
fi

echo
echo "✓ En ligne  : $URL"
[ -n "$NAME" ] && echo "  Site      : $NAME"
[ -n "$ID" ] && echo "  SITE_ID   : $ID"
[ -n "$DEPLOY_ID" ] && echo "  Deploy    : $DEPLOY_ID ($STATE)"
echo
echo "Pour les prochains déploiements :"
echo "  NETLIFY_AUTH_TOKEN=… NETLIFY_SITE_ID=${ID:-<SITE_ID>} ./scripts/deploy.sh"
echo
echo "Variables à ajouter dans Site configuration → Environment variables :"
echo "  VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / VITE_MULTIPLAYER_URL"
