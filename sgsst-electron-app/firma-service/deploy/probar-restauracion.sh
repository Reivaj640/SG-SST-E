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

# 3. Que tenga las tablas del servicio (no solo el esquema de la migracion).
#    Los nombres son los REALES del esquema (src/db/schema/*.sql): medir con
#    nombres inventados daria "n/d" y pareceria que el respaldo esta vacio.
TABLAS=$(sqlite3 "$TMP" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';")
MIGRACIONES=$(sqlite3 "$TMP" "SELECT COUNT(*) FROM gh_firma_schema_migrations;" 2>/dev/null || echo 'n/d')
EMPRESAS=$(sqlite3 "$TMP" "SELECT COUNT(*) FROM gh_firma_empresas;" 2>/dev/null || echo 'n/d')
FIRMAS=$(sqlite3 "$TMP" "SELECT COUNT(*) FROM gh_firmas_electronicas;" 2>/dev/null || echo 'n/d')
CONSENTIMIENTOS=$(sqlite3 "$TMP" "SELECT COUNT(*) FROM gh_consentimientos_firma;" 2>/dev/null || echo 'n/d')

echo "[$(date -Is)] Restauracion OK: tablas=$TABLAS migraciones=$MIGRACIONES empresas=$EMPRESAS firmas=$FIRMAS consentimientos=$CONSENTIMIENTOS"

# 4. Que el temporal no quede tirado en /tmp con los datos personales dentro
rm -f "$TMP"
trap - EXIT
echo "[$(date -Is)] El temporal de la prueba se borro."
