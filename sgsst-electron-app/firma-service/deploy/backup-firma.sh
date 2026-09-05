#!/usr/bin/env bash
# =============================================================================
# K+AIR Firma Electrónica — Backup diario de la BD (SQLite) y PDFs
# =============================================================================
# Instalar (cron del sistema, todos los días 03:17):
#   sudo cp backup-firma.sh /opt/kair-firma/backup-firma.sh
#   sudo chmod +x /opt/kair-firma/backup-firma.sh
#   echo "17 3 * * * root /opt/kair-firma/backup-firma.sh" | sudo tee /etc/cron.d/kair-firma-backup
#
# Qué hace:
#   1. Backup ONLINE de firma.sqlite con sqlite3 .backup (seguro con WAL, sin
#      detener el servicio — NUNCA copiar el archivo a pelo con el servicio
#      corriendo, puedes llevar la copia a medio escribir).
#   2. Comprime los PDFs de storage/ (originales, firmados, constancias).
#   3. Retención local: 14 días.
#   4. (Opcional) Subida a Google Drive/Dropbox via rclone si está configurado.
# =============================================================================
set -euo pipefail

BASE=/opt/kair-firma
DB=$BASE/data/firma.sqlite
BACKUPS=$BASE/backups
STAMP=$(date +%Y%m%d-%H%M%S)

mkdir -p "$BACKUPS"

# 1. Backup consistente de la BD (método oficial de SQLite con WAL)
sqlite3 "$DB" ".backup '$BACKUPS/firma-$STAMP.sqlite'"

# 2. Historial de PDFs (los PDF firmados y constancias son evidencia legal)
tar -C "$BASE" -czf "$BACKUPS/storage-$STAMP.tar.gz" storage

# 3. Retención: borra copias con más de 14 días
find "$BACKUPS" -name 'firma-*.sqlite' -mtime +14 -delete
find "$BACKUPS" -name 'storage-*.tar.gz' -mtime +14 -delete

echo "[$(date -Is)] Backup OK: firma-$STAMP.sqlite + storage-$STAMP.tar.gz"

# 4. (OPCIONAL) Subida a la nube. Configurar una sola vez:
#      rclone config   (crea un remote llamado 'gdrive' con tu cuenta)
#    y descomenta la línea siguiente:
# rclone copy "$BACKUPS" gdrive:kair-firma-backups --max-age 24h
