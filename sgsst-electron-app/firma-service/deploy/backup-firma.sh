#!/usr/bin/env bash
# =============================================================================
# K+AIR Firma Electrónica — Respaldo diario CIFRADO de la BD (SQLite) y PDFs
# =============================================================================
# Instalar (cron del sistema, todos los días 22:00, hora del servidor):
#   sudo cp backup-firma.sh /opt/kair-firma/backup-firma.sh
#   sudo chmod +x /opt/kair-firma/backup-firma.sh
#   echo "0 22 * * * root /opt/kair-firma/backup-firma.sh >> /opt/kair-firma/backups/backup.log 2>&1" | sudo tee /etc/cron.d/kair-firma-backup
#
# OJO: el cron usa la hora local del servidor. Verifica con `timedatectl` que
# esa hora sea la de Colombia (America/Bogota, UTC-5), o el respaldo va a caer
# a una hora distinta de la que dice el Anexo de Nube.
#
# EL SECRETO (la "frase")
# -----------------------
#   El secreto de los respaldos es /opt/kair-firma/backup.passphrase (600,
#   root:root). ESTE SCRIPT NO LO CREA NI LO REGENERA: lo crea el operador, a
#   proposito, una sola vez:
#
#     sudo install -m 600 -o root -g root /dev/null /opt/kair-firma/backup.passphrase
#     sudo sh -c 'openssl rand -base64 48 > /opt/kair-firma/backup.passphrase'
#
#   Si el archivo no existe, no se puede leer o esta vacio, el script ABORTA:
#   nunca se escribe un respaldo en claro "por si acaso".
#
#   EL OWNER DEBE GUARDAR UNA COPIA DE ESA FRASE FUERA DEL SERVIDOR. Si el
#   servidor se pierde y no hay copia, los respaldos son ILEGIBLES: no hay
#   recuperacion posible. La copia off-site (rclone) lleva los archivos
#   CIFRADOS y NUNCA la frase.
#
# QUE CIFRADO SE USA
# -------------------
#   Se detectan en este orden y se usa el primero que exista:
#     1. gpg      -- simetrico, AES256, --batch --passphrase-file. Autenticado
#                    (MDC). Es el recomendado para el servidor (apt install gnupg).
#     2. openssl  -- enc -aes-256-cbc -pbkdf2 -pass file:. Ultima instancia:
#                    cifra, pero NO autentica, asi que el log avisa.
#     3. ninguno -- el script ABORTA (fail closed).
#
#   POR QUE NO `age`: `age -p/--passphrase` lee la frase SIEMPRE del terminal
#   (verificado en la documentacion de age 1.3.2: no existe --passphrase-file),
#   de modo que no sirve desde un cron sin TTY. El modo asimetrico de age
#   (age-keygen) si es no interactivo, pero usa un par de llaves, no una
#   frase: no es el modelo de "una frase" que este respaldo asume.
#
# RETENCION DE COPIAS, NO DE REGISTROS
# ------------------------------------
#   Los 30 dias de este script son la RETENCION DE COPIAS de respaldo. NO son
#   el plazo de conservacion de los registros: ese plazo vive en
#   `gh_firmas_electronicas.fecha_conservacion` y el deber legal de
#   conservacion (hold) vive en `gh_firmas_electronicas.hold_legal`.
#   Un dato suprimido (numeral 8.6) se suprime a NIVEL DE REGISTRO en todas las
#   copias que siguen existiendo: eso lo hace `purgar-respaldos.sh`, no este
#   script. Y mientras exista un hold vigente este script NO borra ninguna
#   copia: la presencia del dato en los respaldos es OBLIGATORIA, no una
#   violacion.
#
# QUE HACE
# --------
#   1. Backup ONLINE de firma.sqlite con sqlite3 .backup (seguro con WAL, sin
#      detener el servicio — NUNCA copiar el archivo a pelo con el servicio
#      corriendo, puedes llevar la copia a medio escribir). La copia en claro
#      NUNCA vive en $BACKUPS: vive en un temporal privado y se borra al
#      terminar (trap), pase lo que pase.
#   2. Verifica la integridad de la copia (PRAGMA integrity_check). Una copia
#      que no abre no es un respaldo: es un archivo.
#   3. Cifra la copia y comprueba que se puede volver a descifrar. En
#      $BACKUPS solo hay archivos .enc.
#   4. Comprime y cifra los PDFs de storage/ (originales, firmados,
#      constancias).
#   5. Poda por edad, RESPETANDO el hold (si hay hold vigente, no se borra
#      ninguna copia).
#   6. Deja constancia en el log: fecha, archivo, tamaño, hash e integridad.
# =============================================================================
set -euo pipefail
umask 077

BASE=${KAIR_BASE:-/opt/kair-firma}
DB=$BASE/data/firma.sqlite
BACKUPS=$BASE/backups
RETENCION_DIAS=${KAIR_RETENCION_DIAS:-30}
FRASE=${KAIR_BACKUP_PASSPHRASE_FILE:-$BASE/backup.passphrase}
STAMP=$(date +%Y%m%d-%H%M%S)
COPIA_ENC=$BACKUPS/firma-$STAMP.sqlite.enc
PDFS_ENC=$BACKUPS/storage-$STAMP.tar.gz.enc

log() { echo "[$(date -Is)] $*"; }

# -----------------------------------------------------------------------------
# 0. EL SECRETO. Si no hay frase, no hay respaldo: el script aborta.
# -----------------------------------------------------------------------------
if [ ! -f "$FRASE" ]; then
  log "BACKUP ABORTADO: no existe el archivo de frase $FRASE."
  log "BACKUP ABORTADO: el operador debe crearlo (600, root:root). Este script no lo crea ni lo regenera."
  exit 1
fi
if [ ! -r "$FRASE" ]; then
  log "BACKUP ABORTADO: no se puede leer el archivo de frase $FRASE."
  exit 1
fi
if [ ! -s "$FRASE" ]; then
  log "BACKUP ABORTADO: el archivo de frase $FRASE esta vacio."
  exit 1
fi

# -----------------------------------------------------------------------------
# 0b. LA HERRAMIENTA DE CIFRADO. Sin ninguna, el script aborta (fail closed).
# -----------------------------------------------------------------------------
HERRAMIENTA=""
if command -v gpg >/dev/null 2>&1; then
  HERRAMIENTA=gpg
elif command -v openssl >/dev/null 2>&1; then
  HERRAMIENTA=openssl
  log "AVISO: se usa openssl (ultima instancia). Su cifrado NO es autenticado:"
  log "AVISO: un archivo alterado no se detecta. Instala gnupg y usa gpg."
else
  log "BACKUP ABORTADO: no hay ninguna herramienta de cifrado disponible."
  log "BACKUP ABORTADO: instala gnupg (gpg) u openssl. No se escribe ningun respaldo en claro."
  exit 1
fi

# gpg 2.1+ necesita --pinentry-mode loopback para leer la frase de un archivo.
GPG_EXTRA=""
if [ "$HERRAMIENTA" = "gpg" ]; then
  GPG_VERSION=$(gpg --version 2>/dev/null | head -1 | awk '{print $NF}')
  case "$GPG_VERSION" in
    2.*|3.*) GPG_EXTRA="--pinentry-mode loopback" ;;
  esac
fi

# El temporal privado: todo lo que se descifra o se copia en claro vive aqui y
# se borra con el trap, pase lo que pase.
WORK=$(mktemp -d /tmp/kair-backup-XXXXXX)
chmod 700 "$WORK"
export GNUPGHOME="$WORK/gnupg"
mkdir -p "$GNUPGHOME"
chmod 700 "$GNUPGHOME"
trap 'rm -rf "$WORK"' EXIT

# Las copias EN CLARO van al temporal, nunca a $BACKUPS.
COPIA_PLAIN=$WORK/firma-$STAMP.sqlite
PDFS_PLAIN=$WORK/storage-$STAMP.tar.gz

encriptar() {  # encriptar <origen> <destino>
  case "$HERRAMIENTA" in
    gpg)
      gpg --batch --yes --no-tty --quiet --symmetric --cipher-algo AES256 \
        $GPG_EXTRA --passphrase-file "$FRASE" --output "$2" "$1"
      ;;
    openssl)
      openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt \
        -pass file:"$FRASE" -in "$1" -out "$2"
      ;;
  esac
}

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

mkdir -p "$BACKUPS"

log "Cifrado: $HERRAMIENTA. Frase: $FRASE (modo $(stat -c %a "$FRASE" 2>/dev/null || echo '?'))."

# -----------------------------------------------------------------------------
# 1. Backup consistente de la BD (método oficial de SQLite con WAL).
# -----------------------------------------------------------------------------
sqlite3 "$DB" ".backup '$COPIA_PLAIN'"

# -----------------------------------------------------------------------------
# 2. La copia tiene que abrir y estar sana: si no, el respaldo no sirve.
# -----------------------------------------------------------------------------
INTEGRIDAD=$(sqlite3 "$COPIA_PLAIN" "PRAGMA integrity_check;")
if [ "$INTEGRIDAD" != "ok" ]; then
  log "BACKUP FALLIDO: la copia no pasa el integrity_check ($INTEGRIDAD)"
  exit 1
fi

# -----------------------------------------------------------------------------
# 3. Cifrar. En $BACKUPS solo hay archivos .enc: nunca hay un respaldo en claro.
# -----------------------------------------------------------------------------
encriptar "$COPIA_PLAIN" "$COPIA_ENC"

# 3b. Comprobar que el cifrado se puede deshacer: un respaldo que no se puede
#     descifrar no es un respaldo.
VERIF=$WORK/verificacion.sqlite
if ! desencriptar "$COPIA_ENC" "$VERIF"; then
  log "BACKUP FALLIDO: el archivo cifrado no se pudo descifrar para verificarlo."
  exit 1
fi
INTEGRIDAD2=$(sqlite3 "$VERIF" "PRAGMA integrity_check;")
rm -f "$VERIF"
if [ "$INTEGRIDAD2" != "ok" ]; then
  log "BACKUP FALLIDO: el archivo cifrado no pasa el integrity_check al descifrarlo ($INTEGRIDAD2)"
  exit 1
fi

# -----------------------------------------------------------------------------
# 4. Historial de PDFs (los PDF firmados y constancias son evidencia legal).
#    Si la carpeta no existe todavia no se aborta el respaldo: la BD ya esta
#    copiada y verificada, y perder ese dia entero seria peor.
# -----------------------------------------------------------------------------
HAY_PDFS=0
if [ -d "$BASE/storage" ]; then
  tar -C "$BASE" -czf "$PDFS_PLAIN" storage
  encriptar "$PDFS_PLAIN" "$PDFS_ENC"
  HAY_PDFS=1
else
  log "AVISO: no existe $BASE/storage; se respalda solo la base de datos."
fi

# -----------------------------------------------------------------------------
# 5. RETENCION DE COPIAS (no de registros) y PODA que respeta el HOLD.
#
#    Un registro con hold vigente NO se puede suprimir: la ley manda
#    conservarlo. Por lo tanto su presencia en los respaldos es OBLIGATORIA y
#    borrar la copia que lo contiene seria una violacion. Con un hold vigente
#    la poda no borra NINGUNA copia: es la decision conservadora (acumular
#    copias antes que borrar una copia con un dato que hay que conservar).
# -----------------------------------------------------------------------------
HOLDS=0
if [ -f "$DB" ]; then
  HOLDS=$(sqlite3 "$DB" "SELECT COUNT(*) FROM gh_firmas_electronicas WHERE COALESCE(hold_legal,0)=1;" 2>/dev/null || echo '')
fi
case "$HOLDS" in
  ''|*[!0-9]*) HOLDS=-1 ;;
esac
if [ "$HOLDS" -lt 0 ]; then
  log "PODA RETENIDA: no se pudo leer el conteo de hold; no se borra ninguna copia."
elif [ "$HOLDS" -gt 0 ]; then
  log "PODA RETENIDA: hay $HOLDS firma(s) con deber legal de conservacion (hold_legal=1)."
  log "PODA RETENIDA: no se borra ninguna copia; esos datos se deben conservar."
else
  find "$BACKUPS" -name 'firma-*.sqlite.enc' -mtime +$RETENCION_DIAS -delete
  find "$BACKUPS" -name 'storage-*.tar.gz.enc' -mtime +$RETENCION_DIAS -delete
  log "PODA: copias de respaldo con mas de $RETENCION_DIAS dias borradas (retencion de COPIAS, no de registros)."
fi

# -----------------------------------------------------------------------------
# 6. La constancia: qué se respaldó, cuánto pesa y si está sana.
# -----------------------------------------------------------------------------
TAMANO=$(stat -c %s "$COPIA_ENC")
HASH=$(sha256sum "$COPIA_ENC" | cut -d' ' -f1)
if [ "$HAY_PDFS" -eq 1 ]; then
  log "Backup OK: firma-$STAMP.sqlite.enc ($TAMANO B, sha256 $HASH, integrity ok, cifrado $HERRAMIENTA) + storage-$STAMP.tar.gz.enc"
else
  log "Backup OK: firma-$STAMP.sqlite.enc ($TAMANO B, sha256 $HASH, integrity ok, cifrado $HERRAMIENTA) + sin PDFs (no existe storage/)"
fi

# -----------------------------------------------------------------------------
# 7. (OPCIONAL) Subida a la nube. La copia off-site lleva los archivos CIFRADOS
#    y NUNCA la frase (si la frase sube a la nube, la nube puede descifrar los
#    respaldos: la copia off-site deja de ser una salvaguarda).
#      rclone config   (crea un remote llamado 'gdrive' con tu cuenta)
#    y descomenta la línea siguiente:
# rclone copy "$BACKUPS" gdrive:kair-firma-backups --max-age 24h
# -----------------------------------------------------------------------------
