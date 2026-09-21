#!/usr/bin/env bash
# upload-remaining-assets.sh — Crea el release v0.1.196 (si no existe) y sube .exe + latest.yml
# Uso: bash upload-remaining-assets.sh
set -e

# 1. Verificar GH_TOKEN
if [ -z "$GH_TOKEN" ]; then
  echo "[ERROR] GH_TOKEN no esta seteado. Exporta tu token primero:"
  echo "  export GH_TOKEN=ghp_TU_TOKEN_AQUI"
  exit 1
fi

REPO="Reivaj640/SG-SST-E"
TAG="v0.1.196"
VERSION="0.1.196"
API="https://api.github.com"

echo "=== 0. Verificando que el tag $TAG existe y obtener SHA ==="
TAG_INFO=$(curl -sL "$API/repos/$REPO/git/refs/tags/$TAG" \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "Accept: application/vnd.github+json")
TAG_SHA=$(echo "$TAG_INFO" | grep -oE '"sha": "[a-f0-9]+"' | head -1 | sed 's/"sha": "//;s/"$//')

if [ -z "$TAG_SHA" ]; then
  echo "[ERROR] No encontre el tag $TAG. Response:"
  echo "$TAG_INFO"
  exit 1
fi
echo "  Tag SHA: $TAG_SHA"

echo ""
echo "=== 1. Verificando si ya existe el release ==="
EXISTING_RELEASE=$(curl -sL "$API/repos/$REPO/releases/tags/$TAG" \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "Accept: application/vnd.github+json")

if echo "$EXISTING_RELEASE" | grep -q '"id":'; then
  echo "  Release YA EXISTE. Usando el existente."
  RELEASE_ID=$(echo "$EXISTING_RELEASE" | grep -oE '"id": [0-9]+' | head -1 | grep -oE '[0-9]+')
  UPLOAD_URL_TEMPLATE=$(echo "$EXISTING_RELEASE" | grep -oE '"upload_url": "[^"]+"' | head -1 | sed 's/"upload_url": "//;s/"$//;s/{?name,label}//')
else
  echo "  Release NO EXISTE. Creando uno nuevo..."

  CREATE_RESPONSE=$(curl -sL -X POST "$API/repos/$REPO/releases" \
    -H "Authorization: Bearer $GH_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    -H "Content-Type: application/json" \
    -d "{
      \"tag_name\": \"$TAG\",
      \"target_commitish\": \"$TAG_SHA\",
      \"name\": \"K+AIR v$VERSION\",
      \"body\": \"## K+AIR v$VERSION\\n\\nMejoras al sistema de actualizaciones + 5 modulos actualizados (v0.1.192 a v0.1.196). Ver CHANGELOG y release-notes.md para detalle completo.\\n\\n### Highlights\\n- Differential downloads re-habilitados (~20-50 MB en vez de 391 MB)\\n- Cierre limpio de SQLite antes de cualquier update (WAL checkpoint)\\n- Fallback robusto para quitAndInstall\\n- SIGTERM antes de SIGKILL en installer NSIS\",
      \"draft\": false,
      \"prerelease\": false
    }")

  RELEASE_ID=$(echo "$CREATE_RESPONSE" | grep -oE '"id": [0-9]+' | head -1 | grep -oE '[0-9]+')
  UPLOAD_URL_TEMPLATE=$(echo "$CREATE_RESPONSE" | grep -oE '"upload_url": "[^"]+"' | head -1 | sed 's/"upload_url": "//;s/"$//;s/{?name,label}//')

  if [ -z "$RELEASE_ID" ]; then
    echo "[ERROR] No pude crear el release. Response:"
    echo "$CREATE_RESPONSE"
    exit 1
  fi
  echo "  Release CREADO. ID: $RELEASE_ID"
fi

echo ""
echo "=== 2. Subiendo K-AIR-Setup-$VERSION.exe (379 MB) ==="
EXE_PATH="dist/K-AIR-Setup-$VERSION.exe"
if [ ! -f "$EXE_PATH" ]; then
  echo "[ERROR] No se encontro $EXE_PATH. Verifica que dist/ tiene el build."
  exit 1
fi
EXE_SIZE=$(stat -c%s "$EXE_PATH" 2>/dev/null || stat -f%z "$EXE_PATH" 2>/dev/null)
EXE_MB=$(echo "scale=1; $EXE_SIZE/1024/1024" | bc)
echo "  Path: $EXE_PATH"
echo "  Size: $EXE_MB MB"

# Eliminar el .exe si ya existe (para re-upload limpio)
echo "  Verificando si ya existe un .exe previo..."
ASSETS=$(curl -sL "$API/repos/$REPO/releases/$RELEASE_ID/assets" \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "Accept: application/vnd.github+json")
EXISTING_EXE_ID=$(echo "$ASSETS" | grep -oE '"id": [0-9]+, *"name": "K-AIR-Setup-'"$VERSION"'\.exe"' | head -1 | grep -oE '"id": [0-9]+' | grep -oE '[0-9]+')
if [ -n "$EXISTING_EXE_ID" ]; then
  echo "  Borrando .exe previo (id=$EXISTING_EXE_ID)..."
  curl -sL -X DELETE "$API/repos/$REPO/releases/assets/$EXISTING_EXE_ID" \
    -H "Authorization: Bearer $GH_TOKEN" \
    -H "Accept: application/vnd.github+json" -w "  HTTP %{http_code}\n"
fi

echo "  Subiendo .exe (esto puede tardar 2-5 minutos)..."
curl -sL -X POST \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -H "Content-Type: application/octet-stream" \
  --data-binary "@$EXE_PATH" \
  "${UPLOAD_URL_TEMPLATE}?name=K-AIR-Setup-${VERSION}.exe" \
  -o /tmp/upload-exe-response.json -w "  HTTP %{http_code} | Time: %{time_total}s\n"

if grep -q '"state": "uploaded"' /tmp/upload-exe-response.json; then
  echo "  [OK] .exe subido correctamente"
else
  echo "  [ERROR] Fallo el upload del .exe. Response:"
  cat /tmp/upload-exe-response.json
  exit 1
fi

echo ""
echo "=== 3. Subiendo latest.yml ==="
YML_PATH="dist/latest.yml"
if [ ! -f "$YML_PATH" ]; then
  echo "[ERROR] No se encontro $YML_PATH"
  exit 1
fi

# Borrar latest.yml previo si existe
EXISTING_YML_ID=$(echo "$ASSETS" | grep -oE '"id": [0-9]+, *"name": "latest.yml"' | head -1 | grep -oE '"id": [0-9]+' | grep -oE '[0-9]+')
if [ -n "$EXISTING_YML_ID" ]; then
  echo "  Borrando latest.yml previo (id=$EXISTING_YML_ID)..."
  curl -sL -X DELETE "$API/repos/$REPO/releases/assets/$EXISTING_YML_ID" \
    -H "Authorization: Bearer $GH_TOKEN" \
    -H "Accept: application/vnd.github+json" -w "  HTTP %{http_code}\n"
fi

curl -sL -X POST \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -H "Content-Type: text/yaml" \
  --data-binary "@$YML_PATH" \
  "${UPLOAD_URL_TEMPLATE}?name=latest.yml" \
  -o /tmp/upload-yml-response.json -w "  HTTP %{http_code}\n"

if grep -q '"state": "uploaded"' /tmp/upload-yml-response.json; then
  echo "  [OK] latest.yml subido correctamente"
else
  echo "  [ERROR] Fallo el upload de latest.yml. Response:"
  cat /tmp/upload-yml-response.json
  exit 1
fi

echo ""
echo "=== 4. Verificacion final ==="
echo "Assets del release $TAG:"
curl -sL "$API/repos/$REPO/releases/tags/$TAG" \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  | grep -oE '"name": "[^"]+\.(exe|yml|blockmap|zip|tar\.gz)"' | sort -u

echo ""
echo "=== RELEASE COMPLETADO ==="
echo "URL: https://github.com/$REPO/releases/tag/$TAG"
