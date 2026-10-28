#!/usr/bin/env bash
# =============================================================================
# K+AIR Firma Electrónica — Purga de respaldos a NIVEL DE REGISTRO (numeral 8.7)
# =============================================================================
# QUE HACE Y POR QUE EXISTE
# -------------------------
# El numeral 8.6 del Acuerdo de uso manda suprimir el dato cuando se vence el
# plazo. El 8.7 dice que esa supresion ALCANZA A LOS RESPALDOS dentro del plazo
# alli previsto.
#
# Borrar el archivo de respaldo a los 30 dias NO cumple esa promesa: el dato
# suprimido hoy sigue presente en el respaldo de ayer y en el de hace 29 dias.
# Este script aplica la supresion A NIVEL DE REGISTRO sobre cada copia que
# sigue existiendo: borra la FILA (y sus filas hijas) dentro de cada copia de
# la base de datos, y saca el PDF del tarball de storage. El archivo de
# respaldo NO se borra: se re-cifra y se reemplaza de forma ATOMICA (se escribe
# al lado y se renombra con mv).
#
# DE DONDE SALE LA LISTA DE LO SUPRIMIDO
# ---------------------------------------
# El servicio (que corre como `kairfirma`, sin privilegios de root) escribe una
# SOLICITUD DE PURGA en la tabla `gh_firma_purgas_pendientes` (migracion 046),
# DENTRO de la misma transaccion en que suprime la fila de la firma. Asi la
# solicitud no se puede perder: o se borra la fila y queda la solicitud, o no
# se borra nada. Un archivo JSON en un directorio seria mas simple, pero el
# servicio y el archivo estan en sistemas distintos: una caida entre el
# COMMIT y la escritura del archivo dejaria el dato suprimido en los
# respaldos para siempre, en silencio. Ese es exactamente el bug que este
# script viene a cerrar, asi que no se repite a otro nivel.
#
# Este script (root) lee las solicitudes, las aplica a todas las copias y
# marca cada una como aplicada. Es idempotente: antes de tocar nada comprueba
# si el dato sigue ahi.
#
# EL HOLD (deber legal de conservacion)
# --------------------------------------
# Si la fila tiene hold_legal = 1, NO se suprime: el deber legal de
# conservacion impide la supresion y, por lo tanto, la presencia del dato en
# los respaldos es OBLIGATORIA, no una violacion. El script lo comprueba en
# CADA copia antes de tocar nada y deja constancia en el log.
#
# NADA SE BORRA EN SILENCIO
# -------------------------
# Si una copia no se puede descifrar o no abre, el script la REPORTA y NO la
# borra. Un respaldo ilegible se reporta; no se descarta. La peticion queda
# pendiente y se reintenta en la proxima corrida.
#
# USO
# ---
#   sudo /opt/kair-firma/purgar-respaldos.sh
#
# Cron sugerido (todos los dias a las 03:00, antes del respaldo de las 22:00):
#   echo "0 3 * * * root /opt/kair-firma/purgar-respaldos.sh >> /opt/kair-firma/backups/purga.log 2>&1" | sudo tee /etc/cron.d/kair-firma-purga
#
# NOTA: este script repite el bloque de cifrado de `backup-firma.sh` a proposito
# (cada script de despliegue se instala y se ejecuta por separado).
# =============================================================================
set -euo pipefail
umask 077

BASE=${KAIR_BASE:-/opt/kair-firma}
DB=$BASE/data/firma.sqlite
BACKUPS=$BASE/backups
FRASE=${KAIR_BACKUP_PASSPHRASE_FILE:-$BASE/backup.passphrase}
ACTOR=${KAIR_PURGA_ACTOR:-purgar-respaldos}
USUARIO_SERVICIO=${KAIR_SERVICIO_USUARIO:-kairfirma}

log() { echo "[$(date -Is)] $*"; }

# -----------------------------------------------------------------------------
# 0. El secreto y la herramienta de cifrado. Sin frase, no se toca nada.
# -----------------------------------------------------------------------------
if [ ! -f "$FRASE" ] || [ ! -r "$FRASE" ] || [ ! -s "$FRASE" ]; then
  log "PURGA ABORTADA: no hay un archivo de frase legible en $FRASE."
  exit 1
fi

HERRAMIENTA=""
if command -v gpg >/dev/null 2>&1; then
  HERRAMIENTA=gpg
elif command -v openssl >/dev/null 2>&1; then
  HERRAMIENTA=openssl
  log "AVISO: se usa openssl; su cifrado no es autenticado."
else
  log "PURGA ABORTADA: no hay ninguna herramienta de cifrado disponible."
  exit 1
fi

GPG_EXTRA=""
if [ "$HERRAMIENTA" = "gpg" ]; then
  GPG_VERSION=$(gpg --version 2>/dev/null | head -1 | awk '{print $NF}')
  case "$GPG_VERSION" in
    2.*|3.*) GPG_EXTRA="--pinentry-mode loopback" ;;
  esac
fi

WORK=$(mktemp -d /tmp/kair-purga-XXXXXX)
chmod 700 "$WORK"
export GNUPGHOME="$WORK/gnupg"
mkdir -p "$GNUPGHOME"
chmod 700 "$GNUPGHOME"
TMP_ENC=""
trap 'rm -rf "$WORK"; if [ -n "$TMP_ENC" ]; then rm -f "$TMP_ENC"; fi' EXIT

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

# -----------------------------------------------------------------------------
# Ayudantes de SQL sobre la copia (que puede ser de una version anterior del
# esquema: no todas las tablas ni todas las columnas existen en todas).
# -----------------------------------------------------------------------------
tiene_tabla() {  # tiene_tabla <db> <tabla>
  [ "$(sqlite3 "$1" "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='$2';" 2>/dev/null || echo 0)" != "0" ]
}

tiene_columna() {  # tiene_columna <db> <tabla> <columna>
  sqlite3 "$1" "PRAGMA table_info($2);" 2>/dev/null | cut -d'|' -f2 | grep -qx "$3"
}

sql_quote() {  # escapa un texto para SQL (duplica las comillas simples)
  printf "'%s'" "$(printf '%s' "${1-}" | sed "s/'/''/g")"
}

rutas_de_json() {  # imprime una ruta por linea
  printf '%s' "${1-}" | tr -d '[]"' | tr ',' '\n' | sed 's/^[[:space:]]*//; s/[[:space:]]*$//' | grep -v '^$' || true
}

# -----------------------------------------------------------------------------
# 1. La cola de solicitudes. Sin la tabla (migracion 046) no hay nada que
#    purgar, y hay que decirlo claro: la supresion no alcanzaria a los
#    respaldos.
# -----------------------------------------------------------------------------
if [ ! -f "$DB" ]; then
  log "PURGA ABORTADA: no existe la base de datos $DB."
  exit 1
fi
if ! tiene_tabla "$DB" gh_firma_purgas_pendientes; then
  log "PURGA ABORTADA: la tabla gh_firma_purgas_pendientes no existe en $DB."
  log "PURGA ABORTADA: aplica la migracion 046 (src/db/schema/046_purgas_respaldo.sql) en el servidor."
  exit 1
fi

SEP=$'\x1f'
PENDIENTES=$(sqlite3 -noheader -separator "$SEP" "$DB" \
  "SELECT id, firma_id, COALESCE(id_empresa,''), COALESCE(id_solicitud,''), COALESCE(archivos,''), COALESCE(actor,''), COALESCE(motivo,'') FROM gh_firma_purgas_pendientes ORDER BY id;")

REQS=()
declare -A ESTADO_REQ
declare -A VISTOS
while IFS= read -r linea; do
  if [ -n "$linea" ]; then
    REQS+=("$linea")
    IFS="$SEP" read -r pid _ _ _ _ _ _ <<< "$linea"
    case "$pid" in
      ''|*[!0-9]*) : ;;
      *) ESTADO_REQ["$pid"]="ok"; VISTOS["$pid"]=0 ;;
    esac
  fi
done <<< "$PENDIENTES"

if [ "${#REQS[@]}" -eq 0 ]; then
  log "PURGA: no hay solicitudes de purga pendientes. Nada que hacer."
  exit 0
fi
log "PURGA: ${#REQS[@]} solicitud(es) de purga por aplicar sobre las copias existentes."

# -----------------------------------------------------------------------------
# 2. La supresion sobre una COPIA de la base de datos.
#    Devuelve: 0 aplicada, 1 nada que hacer, 2 conservada por hold,
#    3 plazo no vencido, 4 error.
# -----------------------------------------------------------------------------
aplicar_en_copia_db() {  # aplicar_en_copia_db <copia> <firma_id> <id_solicitud>
  local dbc="$1" fid="$2" sol="$3"
  local existe hold vencido sql

  if ! tiene_tabla "$dbc" gh_firmas_electronicas; then
    return 1
  fi
  existe=$(sqlite3 "$dbc" "SELECT COUNT(*) FROM gh_firmas_electronicas WHERE id=$fid;")
  if [ "$existe" != "1" ]; then
    return 1
  fi

  # EL HOLD: con deber legal de conservacion no se suprime, y la presencia
  # del dato en esta copia es obligatoria.
  if tiene_columna "$dbc" gh_firmas_electronicas hold_legal; then
    hold=$(sqlite3 "$dbc" "SELECT COALESCE(hold_legal,0) FROM gh_firmas_electronicas WHERE id=$fid;")
    if [ "$hold" = "1" ]; then
      return 2
    fi
  fi

  # El plazo: la supresion solo procede con el plazo vencido.
  if tiene_columna "$dbc" gh_firmas_electronicas fecha_conservacion; then
    vencido=$(sqlite3 "$dbc" "SELECT CASE WHEN fecha_conservacion IS NULL THEN 'no' WHEN datetime(fecha_conservacion) <= datetime('now') THEN 'si' ELSE 'no' END FROM gh_firmas_electronicas WHERE id=$fid;")
    if [ "$vencido" != "si" ]; then
      return 3
    fi
  fi

  # La misma supresion que aplica el servicio, dentro del mismo gobierno:
  # ventana abierta, fila en el lote y plazo vencido. Los triggers de la
  # migracion 020 (append-only) exigen exactamente eso, asi que se abre la
  # ventana en la COPIA antes de borrar.
  sql="PRAGMA foreign_keys=ON;"
  if tiene_tabla "$dbc" gh_firma_purga_control; then
    sql="$sql
INSERT OR IGNORE INTO gh_firma_purga_control (id, ventana_activa, abierta_at, abierta_hasta, abierta_por, motivo)
 VALUES (1, 1, datetime('now'), datetime('now','+2 hours'), $(sql_quote "$ACTOR"), 'purga de respaldos (8.7)');
UPDATE gh_firma_purga_control
   SET ventana_activa = 1, abierta_at = datetime('now'), abierta_hasta = datetime('now','+2 hours'),
       abierta_por = $(sql_quote "$ACTOR"), motivo = 'purga de respaldos (8.7)', cerrada_at = NULL
 WHERE id = 1;"
  fi
  if tiene_tabla "$dbc" gh_firma_purga_lote; then
    sql="$sql
INSERT OR IGNORE INTO gh_firma_purga_lote (firma_id, anadida_por, motivo) VALUES ($fid, $(sql_quote "$ACTOR"), 'purga de respaldos (8.7)');"
  fi
  sql="$sql
BEGIN;"
  if tiene_tabla "$dbc" gh_firma_eventos; then
    sql="$sql
DELETE FROM gh_firma_eventos WHERE firma_id = $fid;"
  fi
  if tiene_tabla "$dbc" gh_firma_sesiones; then
    sql="$sql
DELETE FROM gh_firma_sesiones WHERE firma_id = $fid;"
  fi
  if tiene_tabla "$dbc" gh_firma_purga_lote; then
    sql="$sql
DELETE FROM gh_firma_purga_lote WHERE firma_id = $fid;"
  fi
  if [ -n "$sol" ]; then
    sql="$sql
DELETE FROM gh_firmas_electronicas WHERE parent_id_solicitud = $(sql_quote "$sol");"
  fi
  sql="$sql
DELETE FROM gh_firmas_electronicas WHERE id = $fid;
COMMIT;"

  if ! printf '%s\n' "$sql" | sqlite3 -bail "$dbc" >/dev/null 2>"$WORK/err.txt"; then
    log "  ERROR: no se pudo aplicar la supresion en la copia: $(tr '\n' ' ' < "$WORK/err.txt")"
    return 4
  fi
  return 0
}

# -----------------------------------------------------------------------------
# 3. La supresion sobre el TARBALL de storage: el PDF sale del tar.
#    Trabaja sobre el directorio YA extraido: asi, cuando hay varias
#    solicitudes pendientes, los PDF de todas se quitan del MISMO tar (si se
#    re-extrajera en cada llamada, solo se quitaria el ultimo).
#    Devuelve: 0 aplicada, 1 nada que hacer, 4 error.
# -----------------------------------------------------------------------------
RUTAS=()
quitar_pdfs_del_tarball() {  # quitar_pdfs_del_tarball <dir extraido>
  local dir="$1"
  local cambiados=0 r base encontrado

  for r in "${RUTAS[@]}"; do
    if [ -z "$r" ]; then
      continue
    fi
    if [ -f "$dir/$r" ]; then
      rm -f "$dir/$r"
      cambiados=$((cambiados + 1))
    else
      base=$(basename "$r")
      encontrado=$(find "$dir" -type f -name "$base" 2>/dev/null | head -1 || true)
      if [ -n "$encontrado" ]; then
        rm -f "$encontrado"
        cambiados=$((cambiados + 1))
      else
        log "  AVISO: el PDF $r no esta en este tarball (ya no estaba)."
      fi
    fi
  done

  if [ "$cambiados" -eq 0 ]; then
    return 1
  fi
  return 0
}

# -----------------------------------------------------------------------------
# 4. El recorrido: cada copia se descifra UNA vez y se le aplican todas las
#    solicitudes. Si algo cambio, se re-cifra y se reemplaza con mv (atomico).
# -----------------------------------------------------------------------------
COPIAS_PROCESADAS=0
COPIAS_TOCADAS=0
SUPIMIDAS=0
FALLOS=0
APLICADAS=0
PENDIENTES_DE_PURGA=0

for RESPALDO in "$BACKUPS"/firma-*.sqlite.enc "$BACKUPS"/storage-*.tar.gz.enc; do
  if [ ! -f "$RESPALDO" ]; then
    continue
  fi
  COPIAS_PROCESADAS=$((COPIAS_PROCESADAS + 1))
  NOMBRE=$(basename "$RESPALDO")
  ES_BD=0
  case "$NOMBRE" in
    firma-*.sqlite.enc) ES_BD=1 ;;
  esac

  TRABAJO=$WORK/copia
  rm -rf "$TRABAJO"
  mkdir -p "$TRABAJO"

  if ! desencriptar "$RESPALDO" "$TRABAJO/descifrado"; then
    # No se puede descifrar: se REPORTA y NO se borra el archivo.
    log "PURGA: $NOMBRE no se pudo descifrar; se conserva el archivo y las peticiones quedan pendientes."
    FALLOS=$((FALLOS + 1))
    for REQ in "${REQS[@]}"; do
      IFS="$SEP" read -r pid _ _ _ _ _ _ <<< "$REQ"
      case "$pid" in
        ''|*[!0-9]*) : ;;
        *) ESTADO_REQ["$pid"]="pendiente" ;;
      esac
    done
    continue
  fi

  # El tarball se abre UNA vez por copia: todas las solicitudes se quitan del
  # mismo directorio y el tar se rehace una sola vez, al final.
  if [ "$ES_BD" -eq 0 ]; then
    rm -rf "$TRABAJO/extract"
    mkdir -p "$TRABAJO/extract"
    if ! tar -xzf "$TRABAJO/descifrado" -C "$TRABAJO/extract" 2>"$WORK/err.txt"; then
      log "PURGA: $NOMBRE no se pudo abrir; se conserva el archivo y las peticiones quedan pendientes."
      FALLOS=$((FALLOS + 1))
      for REQ in "${REQS[@]}"; do
        IFS="$SEP" read -r pid _ _ _ _ _ _ <<< "$REQ"
        case "$pid" in
          ''|*[!0-9]*) : ;;
          *) ESTADO_REQ["$pid"]="pendiente" ;;
        esac
      done
      continue
    fi
  fi

  CAMBIO=0
  for REQ in "${REQS[@]}"; do
    IFS="$SEP" read -r id_purga firma_id id_empresa id_solicitud archivos actor motivo <<< "$REQ"
    case "$id_purga" in
      ''|*[!0-9]*) continue ;;
    esac
    # Esta peticion ya se miró contra esta copia.
    VISTOS["$id_purga"]=$(( ${VISTOS[$id_purga]:-0} + 1 ))

    RESULTADO=0
    if [ "$ES_BD" -eq 1 ]; then
      aplicar_en_copia_db "$TRABAJO/descifrado" "$firma_id" "$id_solicitud" || RESULTADO=$?
    else
      RUTAS=()
      while IFS= read -r r; do
        if [ -n "$r" ]; then
          RUTAS+=("$r")
        fi
      done <<< "$(rutas_de_json "$archivos")"
      quitar_pdfs_del_tarball "$TRABAJO/extract" || RESULTADO=$?
    fi
    case "$RESULTADO" in
      0)
        CAMBIO=1
        SUPIMIDAS=$((SUPIMIDAS + 1))
        log "PURGA: $NOMBRE: suprimida la firma $firma_id (empresa ${id_empresa:-n/d}, solicitud ${id_solicitud:-n/d})."
        ;;
      1)
        : # ya estaba suprimida en esta copia: nada que hacer
        ;;
      2)
        PENDIENTES_DE_PURGA=$((PENDIENTES_DE_PURGA + 1))
        ESTADO_REQ["$id_purga"]="pendiente"
        log "PURGA: $NOMBRE: la firma $firma_id tiene hold vigente; se conserva (es obligatorio)."
        ;;
      3)
        PENDIENTES_DE_PURGA=$((PENDIENTES_DE_PURGA + 1))
        ESTADO_REQ["$id_purga"]="pendiente"
        log "PURGA: $NOMBRE: la firma $firma_id no tiene el plazo vencido; se conserva."
        ;;
      *)
        FALLOS=$((FALLOS + 1))
        PENDIENTES_DE_PURGA=$((PENDIENTES_DE_PURGA + 1))
        ESTADO_REQ["$id_purga"]="pendiente"
        log "PURGA: $NOMBRE: no se pudo aplicar la supresion de la firma $firma_id."
        ;;
    esac
  done

  if [ "$CAMBIO" -eq 0 ]; then
    continue
  fi

  # El tarball se rehace UNA vez, con TODOS los PDF que se sacaron.
  if [ "$ES_BD" -eq 0 ]; then
    if [ ! -d "$TRABAJO/extract/storage" ]; then
      log "  AVISO: el tarball re-hecho no tiene el directorio storage; se conserva el original."
      continue
    fi
    if ! tar -C "$TRABAJO/extract" -czf "$TRABAJO/nuevo.tar.gz" storage 2>"$WORK/err.txt"; then
      log "  ERROR: no se pudo rehacer el tarball: $(tr '\n' ' ' < "$WORK/err.txt")"
      FALLOS=$((FALLOS + 1))
      continue
    fi
  fi

  # Re-cifrar y reemplazar de forma ATOMICA: se escribe al lado (mismo
  # sistema de archivos) y se renombra con mv. El respaldo viejo nunca queda
  # a medio escribir.
  TMP_ENC="$BACKUPS/.purga-temporal-$NOMBRE"
  if [ "$ES_BD" -eq 1 ]; then
    encriptar "$TRABAJO/descifrado" "$TMP_ENC" || { FALLOS=$((FALLOS + 1)); continue; }
  else
    encriptar "$TRABAJO/nuevo.tar.gz" "$TMP_ENC" || { FALLOS=$((FALLOS + 1)); continue; }
  fi
  mv -f "$TMP_ENC" "$RESPALDO"
  TMP_ENC=""

  COPIAS_TOCADAS=$((COPIAS_TOCADAS + 1))
  HASH=$(sha256sum "$RESPALDO" | cut -d' ' -f1)
  TAMANO=$(stat -c %s "$RESPALDO")
  log "PURGA: $NOMBRE re-cifrado y reemplazado: sha256 $HASH ($TAMANO B)."
done

# -----------------------------------------------------------------------------
# 5. Marcar las solicitudes que quedaron cubiertas por todas las copias.
#    Si alguna copia fallo o quedo retenida por hold, la solicitud NO se
#    marca: se reintenta en la proxima corrida.
# -----------------------------------------------------------------------------
for REQ in "${REQS[@]}"; do
  IFS="$SEP" read -r id_purga firma_id id_empresa id_solicitud archivos actor motivo <<< "$REQ"
  case "$id_purga" in
    ''|*[!0-9]*) continue ;;
  esac
  # Una peticion solo se marca como aplicada si se MIRÓ contra al menos una
  # copia y en todas las copias el dato ya no estaba (o se pudo suprimir).
  # Sin copias que examinar (p. ej. que no hay ningun respaldo todavia) la
  # peticion NO se marca: se reintenta cuando haya copias.
  if [ "${VISTOS[$id_purga]:-0}" -eq 0 ]; then
    PENDIENTES_DE_PURGA=$((PENDIENTES_DE_PURGA + 1))
    log "PURGA: la solicitud $id_purga no se marco como aplicada: no hay copias que purgar."
    continue
  fi
  if [ "${ESTADO_REQ[$id_purga]:-pendiente}" != "ok" ]; then
    PENDIENTES_DE_PURGA=$((PENDIENTES_DE_PURGA + 1))
    continue
  fi
  if sqlite3 -bail -cmd ".timeout 5000" "$DB" \
    "UPDATE gh_firma_purgas_pendientes SET estado='aplicada', aplicada_at=datetime('now'), detalle='suprimida a nivel de registro en las copias existentes' WHERE id=$id_purga;" \
    >/dev/null 2>&1; then
    APLICADAS=$((APLICADAS + 1))
  else
    log "  AVISO: no se pudo marcar la solicitud $id_purga como aplicada."
  fi
done

# El servicio (kairfirma) es el dueno de la base: si el script dejo un -wal o
# -shm con otro dueno, el servicio no podria escribir. Se corrige.
if id -u "$USUARIO_SERVICIO" >/dev/null 2>&1; then
  for AUX in "$DB-wal" "$DB-shm"; do
    if [ -f "$AUX" ]; then
      chown "$USUARIO_SERVICIO" "$AUX" 2>/dev/null || true
    fi
  done
fi

log "PURGA: terminado. Copias procesadas: $COPIAS_PROCESADAS. Copias re-cifradas: $COPIAS_TOCADAS. Supresiones aplicadas: $SUPIMIDAS. Solicitudes marcadas como aplicadas: $APLICADAS. Fallos: $FALLOS. Solicitudes que siguen pendientes: $PENDIENTES_DE_PURGA."
