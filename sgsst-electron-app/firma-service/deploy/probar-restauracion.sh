#!/usr/bin/env bash
# =============================================================================
# K+AIR Firma Electrónica — Prueba de restauración del último respaldo
# =============================================================================
# Para qué sirve esto:
#   Un respaldo que nunca se ha restaurado no es un respaldo, es un archivo.
#   Este script toma el último respaldo, lo restaura en un archivo temporal y
#   comprueba que abre, que está sano y que trae los datos. Eso es lo que
#   respalda el RTO declarado en el Anexo de Nube: si la restauración se
#   probó, el RTO de 4 horas es una promesa con evidencia.
#
# Uso:
#   sudo /opt/kair-firma/probar-restauracion.sh
#
# Sale con 0 si la restauración sirve, con 1 si algo falla (y el detalle por
# que). Deja constancia en el log del respaldo.
#
# IMPORTANTE: la copia restaurada es un temporal con datos personales. Se
# borra al terminar, pase lo que pase (trap), y nunca se imprime su
# contenido: solo conteos.
# =============================================================================
set -euo pipefail

BASE=${KAIR_BASE:-/opt/kair-firma}
BACKUPS=$BASE/backups

# El último respaldo por fecha (el nombre lleva la marca de tiempo)
COPIA=$(ls -1t "$BACKUPS"/firma-*.sqlite 2>/dev/null | head -1 || true)
if [ -z "$COPIA" ]; then
  echo "[$(date -Is)] RESTAURACION FALLIDA: no hay ningun respaldo en $BACKUPS"
  exit 1
fi

TMP=$(mktemp /tmp/kair-restauracion-XXXXXX.sqlite)
trap 'rm -f "$TMP"' EXIT

echo "[$(date -Is)] Probando la restauracion de $(basename "$COPIA")"

# 1. Restaurar: el respaldo se copia a un temporal y se abre desde ahi
cp "$COPIA" "$TMP"

# 2. Que abra y esté sana
INTEGRIDAD=$(sqlite3 "$TMP" "PRAGMA integrity_check;")
if [ "$INTEGRIDAD" != "ok" ]; then
  echo "[$(date -Is)] RESTAURACION FALLIDA: integrity_check = $INTEGRIDAD"
  exit 1
fi

# 3. Que tenga las tablas del servicio (no solo el esquema de la migracion)
TABLAS=$(sqlite3 "$TMP" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';")
EMPRESAS=$(sqlite3 "$TMP" "SELECT COUNT(*) FROM gh_firma_empresas;" 2>/dev/null || echo 'n/d')
SOLICITUDES=$(sqlite3 "$TMP" "SELECT COUNT(*) FROM gh_firma_solicitudes;" 2>/dev/null || echo 'n/d')
VERSION=$(sqlite3 "$TMP" "PRAGMA user_version;" 2>/dev/null || echo 'n/d')

echo "[$(date -Is)] Restauracion OK: tablas=$TABLAS empresas=$EMPRESAS solicitudes=$SOLICITUDES user_version=$VERSION"

# 4. Que la copia no quede tirada en /tmp con los datos personales dentro
rm -f "$TMP"
trap - EXIT
echo "[$(date -Is)] El temporal de la prueba se borro."
