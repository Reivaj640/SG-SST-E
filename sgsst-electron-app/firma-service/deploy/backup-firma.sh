#!/usr/bin/env bash
# =============================================================================
# K+AIR Firma Electrónica — Backup diario de la BD (SQLite) y PDFs
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
# Qué hace:
#   1. Backup ONLINE de firma.sqlite con sqlite3 .backup (seguro con WAL, sin
#      detener el servicio — NUNCA copiar el archivo a pelo con el servicio
#      corriendo, puedes llevar la copia a medio escribir).
#   2. Verifica la integridad de la copia (PRAGMA integrity_check). Una copia
#      que no abre no es un respaldo: es un archivo.
#   3. Comprime los PDFs de storage/ (originales, firmados, constancias).
#   4. Retención local: 30 días. Es el mismo plazo que el Anexo de Nube
#      declara para la supresión, así que la poda lo hace cumplir.
#   5. Deja constancia en el log: fecha, archivo, tamaño, hash e integridad.
# =============================================================================
set -euo pipefail

BASE=${KAIR_BASE:-/opt/kair-firma}
DB=$BASE/data/firma.sqlite
BACKUPS=$BASE/backups
RETENCION_DIAS=${KAIR_RETENCION_DIAS:-30}
STAMP=$(date +%Y%m%d-%H%M%S)
COPIA=$BACKUPS/firma-$STAMP.sqlite
PDFS=$BACKUPS/storage-$STAMP.tar.gz

mkdir -p "$BACKUPS"

# 1. Backup consistente de la BD (método oficial de SQLite con WAL)
sqlite3 "$DB" ".backup '$COPIA'"

# 2. La copia tiene que abrir y estar sana: si no, el respaldo no sirve
INTEGRIDAD=$(sqlite3 "$COPIA" "PRAGMA integrity_check;")
if [ "$INTEGRIDAD" != "ok" ]; then
  echo "[$(date -Is)] BACKUP FALLIDO: la copia no pasa el integrity_check ($INTEGRIDAD)"
  exit 1
fi

# 3. Historial de PDFs (los PDF firmados y constancias son evidencia legal).
#    Si la carpeta no existe todavia no se aborta el respaldo: la BD ya esta
#    copiada y verificada, y perder ese dia entero seria peor.
if [ -d "$BASE/storage" ]; then
  tar -C "$BASE" -czf "$PDFS" storage
else
  echo "[$(date -Is)] AVISO: no existe $BASE/storage; se respalda solo la base de datos."
  PDFS=""
fi

# 4. Retención: borra copias con más de RETENCION_DIAS días
find "$BACKUPS" -name 'firma-*.sqlite' -mtime +$RETENCION_DIAS -delete
find "$BACKUPS" -name 'storage-*.tar.gz' -mtime +$RETENCION_DIAS -delete

# 5. La constancia: qué se respaldó, cuánto pesa y si está sana
TAMANO=$(stat -c %s "$COPIA")
HASH=$(sha256sum "$COPIA" | cut -d' ' -f1)
if [ -n "$PDFS" ]; then
  echo "[$(date -Is)] Backup OK: firma-$STAMP.sqlite ($TAMANO B, sha256 $HASH, integrity ok) + storage-$STAMP.tar.gz"
else
  echo "[$(date -Is)] Backup OK: firma-$STAMP.sqlite ($TAMANO B, sha256 $HASH, integrity ok) + sin PDFs (no existe storage/)"
fi

# 6. (OPCIONAL) Subida a la nube. Configurar una sola vez:
#      rclone config   (crea un remote llamado 'gdrive' con tu cuenta)
#    y descomenta la línea siguiente:
# rclone copy "$BACKUPS" gdrive:kair-firma-backups --max-age 24h
