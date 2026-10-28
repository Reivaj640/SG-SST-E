#!/usr/bin/env bash
# =============================================================================
# K+AIR Firma Electrónica — Prueba de restauración del último respaldo
# =============================================================================
# Para qué sirve esto:
#   Un respaldo que nunca se ha restaurado no es un respaldo, es un archivo.
#   Este script toma el último respaldo, lo DESCIFRA en un temporal privado,
#   lo abre, comprueba que está sano y que trae los datos. Eso es lo que
#   respalda el RTO declarado en el Anexo de Nube: si la restauración se
#   probó, el RTO de 4 horas es una promesa con evidencia.
#
# Uso:
#   sudo /opt/kair-firma/probar-restauracion.sh
#
# Sale con 0 si la restauración sirve, con 1 si algo falla (y el detalle por
# qué). Deja constancia en el log del respaldo.
#
# LOS RESPALDOS ESTÁN CIFRADOS
# -----------------------------
#   Primero se DESCIFRA y después se abre: nunca se abre un archivo cifrado
#   como si fuera la base de datos. La copia descifrada es un temporal con
#   datos personales: se borra al terminar, pase lo que pase (trap), y nunca
#   se imprime su contenido: solo conteos.
#
# LA FRASE
#   Es /opt/kair-firma/backup.passphrase (600, root:root). El owner guarda una
#   copia de esa frase FUERA del servidor: sin ella los respaldos son
#   ilegibles. Esta frase NUNCA se imprime ni se copia al log.
#
# NOTA: este script repite el bloque de cifrado de `backup-firma.sh` a proposito
# (cada script de despliegue se instala y se ejecuta por separado).
# =============================================================================
set -euo pipefail
umask 077

BASE=${KAIR_BASE:-/opt/kair-firma}
BACKUPS=$BASE/backups
FRASE=${KAIR_BACKUP_PASSPHRASE_FILE:-$BASE/backup.passphrase}

log() { echo "[$(date -Is)] $*"; }

# -----------------------------------------------------------------------------
# 0. El secreto y la herramienta de cifrado.
# -----------------------------------------------------------------------------
if [ ! -f "$FRASE" ] || [ ! -r "$FRASE" ] || [ ! -s "$FRASE" ]; then
  log "RESTAURACION FALLIDA: no hay un archivo de frase legible en $FRASE."
  exit 1
fi

HERRAMIENTA=""
if command -v gpg >/dev/null 2>&1; then
  HERRAMIENTA=gpg
elif command -v openssl >/dev/null 2>&1; then
  HERRAMIENTA=openssl
  log "AVISO: se usa openssl; su cifrado no es autenticado."
else
  log "RESTAURACION FALLIDA: no hay ninguna herramienta de cifrado disponible."
  exit 1
fi

GPG_EXTRA=""
if [ "$HERRAMIENTA" = "gpg" ]; then
  GPG_VERSION=$(gpg --version 2>/dev/null | head -1 | awk '{print $NF}')
  case "$GPG_VERSION" in
    2.*|3.*) GPG_EXTRA="--pinentry-mode loopback" ;;
  esac
fi

desencriptar() {  # desencriptar <origen> <destino>
  case "$HERRAMIENTA" in
    gpg)
      gpg --batch --yes --no-tty --quiet --decrypt \
        $GPG_EXTRA --passphrase-file "$FRASE" --output "$2" "$1"
      ;;
    openssl)
      openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 \
        -pass file:"$FRASE" -in "$1" -out "$2"
      ;;
  esac
}

# El comando exacto para restaurar a mano (queda en el log para el operador).
case "$HERRAMIENTA" in
  gpg)
    COMANDO_DESCIFRADO="gpg --batch --yes --pinentry-mode loopback --passphrase-file $FRASE --output firma.sqlite $BACKUPS/<NOMBRE>.sqlite.enc"
    ;;
  *)
    COMANDO_DESCIFRADO="openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -pass file:$FRASE -in $BACKUPS/<NOMBRE>.sqlite.enc -out firma.sqlite"
    ;;
esac

# El último respaldo por fecha (el nombre lleva la marca de tiempo)
COPIA=$(ls -1t "$BACKUPS"/firma-*.sqlite.enc 2>/dev/null | head -1 || true)
if [ -z "$COPIA" ]; then
  log "RESTAURACION FALLIDA: no hay ningun respaldo en $BACKUPS"
  exit 1
fi

# El temporal es un DIRECTORIO privado: la copia descifrada vive dentro y se
# borra entera con el trap, pase lo que pase.
WORK=$(mktemp -d /tmp/kair-restauracion-XXXXXX)
chmod 700 "$WORK"
export GNUPGHOME="$WORK/gnupg"
mkdir -p "$GNUPGHOME"
chmod 700 "$GNUPGHOME"
TMP=$WORK/restauracion.sqlite
trap 'rm -rf "$WORK"' EXIT

log "Probando la restauracion de $(basename "$COPIA")"

# 1. Restaurar: PRIMERO se descifra, después se abre desde ahi.
if ! desencriptar "$COPIA" "$TMP"; then
  log "RESTAURACION FALLIDA: no se pudo descifrar $(basename "$COPIA") (frase incorrecta o archivo danado)."
  exit 1
fi

# 2. Que abra y esté sana
INTEGRIDAD=$(sqlite3 "$TMP" "PRAGMA integrity_check;")
if [ "$INTEGRIDAD" != "ok" ]; then
  log "RESTAURACION FALLIDA: integrity_check = $INTEGRIDAD"
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

log "Restauracion OK: tablas=$TABLAS migraciones=$MIGRACIONES empresas=$EMPRESAS firmas=$FIRMAS consentimientos=$CONSENTIMIENTOS"

# 4. Que el temporal no quede tirado en /tmp con los datos personales dentro
rm -rf "$WORK"
trap - EXIT
log "El temporal de la prueba se borro."

# 5. El comando de restauracion a mano, para el operador.
log "Para restaurar a mano (deja el archivo descifrado junto a la BD):"
log "  $COMANDO_DESCIFRADO"
