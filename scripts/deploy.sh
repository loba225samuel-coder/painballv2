#!/usr/bin/env bash
# Mettre le jeu en ligne SANS passer par Git, en une commande.
#
#   NETLIFY_AUTH_TOKEN=xxx ./scripts/deploy.sh              -> crée un nouveau site
#   NETLIFY_AUTH_TOKEN=xxx NETLIFY_SITE_ID=yyy ./scripts/deploy.sh   -> met à jour un site existant
#
# Le token : app.netlify.com → User settings → Personal access tokens.
# Rien n'est envoyé ailleurs que vers l'API Netlify.

set -euo pipefail
cd "$(dirname "$0")/.."

if [ -z "${NETLIFY_AUTH_TOKEN:-}" ]; then
  echo "✗ Il manque NETLIFY_AUTH_TOKEN."
  echo "  Create it at https://app.netlify.com/user/applications#personal-access-tokens"
  echo "  puis : NETLIFY_AUTH_TOKEN=xxx ./scripts/deploy.sh"
  exit 1
fi

echo "▸ build…"
[ -d node_modules ] || npm install --no-audit --no-fund
npm run build >/dev/null

echo "▸ préparation de l'archive…"
zip -qr /tmp/pb2d-dist.zip dist -x '*.DS_Store'
SIZE=$(du -h /tmp/pb2d-dist.zip | cut -f1)
echo "  dist/ → $SIZE"

API="https://api.netlify.com/api/v1"
AUTH="Authorization: Bearer $NETLIFY_AUTH_TOKEN"

if [ -n "${NETLIFY_SITE_ID:-}" ]; then
  echo "▸ mise à jour du site ${NETLIFY_SITE_ID}…"
  RESP=$(curl -sS -X POST "$API/sites/$NETLIFY_SITE_ID/deploys" \
    -H "$AUTH" -H "Content-Type: application/zip" --data-binary @/tmp/pb2d-dist.zip)
else
  echo "▸ création d'un nouveau site…"
  RESP=$(curl -sS -X POST "$API/sites" \
    -H "$AUTH" -H "Content-Type: application/zip" --data-binary @/tmp/pb2d-dist.zip)
fi

URL=$(printf '%s' "$RESP" | sed -n 's/.*"ssl_url":"\([^"]*\)".*/\1/p')
[ -n "$URL" ] || URL=$(printf '%s' "$RESP" | sed -n 's/.*"url":"\([^"]*\)".*/\1/p')
SITE=$(printf '%s' "$RESP" | sed -n 's/.*"site_id":"\([^"]*\)".*/\1/p')
NAME=$(printf '%s' "$RESP" | sed -n 's/.*"name":"\([^"]*\)".*/\1/p')

if [ -z "$URL" ]; then
  echo "✗ Réponse inattendue de Netlify :"
  printf '%s\n' "$RESP"
  exit 1
fi

rm -f /tmp/pb2d-dist.zip
echo
echo "✓ En ligne : $URL"
[ -n "$NAME" ] && echo "  Nom du site : $NAME"
if [ -n "$SITE" ]; then
  echo "  Pour les prochains déploiements :"
  echo "    NETLIFY_SITE_ID=$SITE NETLIFY_AUTH_TOKEN=xxx ./scripts/deploy.sh"
fi
echo "  → Renseigne un domaine dans Netlify → Domain settings."
