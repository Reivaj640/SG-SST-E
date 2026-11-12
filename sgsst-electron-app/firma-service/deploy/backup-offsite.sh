#!/bin/bash
#
# backup-offsite.sh
#
# COPIA DEL RESPALDO FUERA DEL SERVIDOR (off-site).
#
# POR QUE EXISTE ESTE SCRIPT Y POR QUE ES OTRO
# ---------------------------------------------
# `backup-firma.sh` (el que corre a diario a las 22:00) hace el respaldo
# bien: lo cifra con GPG simetrico AES256, verifica la integridad de la base
# antes de cifrar, comprueba el hash del resultado y respeta el hold legal al
# podar. Ese script NO se toca.
#
# Lo que no resuelve es el RIESGO DE PERDER EL SERVIDOR: hoy los respaldos
# viven en `/opt/kair-firma/backups`, **en el mismo disco que la base**. Si
# la maquina se muere, se pierden los dos. Una copia cifrada en el mismo
# servidor no es un respaldo: es una segunda copia.
#
# Este script hace esa segunda parte y SOLO esa: se lleva los `.enc` ya
# cifrados a otro sitio. No cifra (ya estan cifrados), no crea respaldos, no
# borra nada local, y no puede dejar el respaldo local sin su copia.
#
# REGLAS QUE NO SE ROMPEN
# -----------------------
# 1. **NUNCA borra la copia local.** Este script solo copia y, en el destino,
#    poda copias viejas. El respaldo local es responsabilidad de
#    `backup-firma.sh`.
# 2. **No se considera exitoso hasta que el hash del destino coincide** con
#    el local. Un `scp` que "salio bien" no es prueba de que el archivo llego
#    entero; el hash si.
# 3. **Si no hay destino configurado, no es un error**: sale con codigo 0 y
#    lo deja escrito en el log. La decision del destino es del owner.
# 4. **La poda del destino solo ocurre DESPUES de una copia verificada**, y
#    nunca borra mas copias de las que la retencion local permite.
# 5. No se escribe nada en claro: solo viajan los `.enc`.
#
# CONFIGURACION
# -------------
# Todo sale de `/opt/kair-firma/backup-offsite.conf` (root, modo 600), que se
# crea asi:
#
#   sudo install -m 600 -o root -g root /dev/null /opt/kair-firma/backup-offsite.conf
#   sudo sh -c 'cat > /opt/kair-firma/backup-offsite.conf <<EOF
#   METODO=rsync
#   REMOTO=usuario@otro-servidor:/ruta/de/destino
#   # ... o, con rclone:
#   # METODO=rclone
#   # REMOTO=b2-kair:kair-firma-backups
#   RETENCION_DIAS=30
#   EOF'
#
# EL FORMATO DE `REMOTO` CON RCLONE ES `<NOMBRE-DEL-REMOTO>:<RUTA>`. El nombre
# es el del remoto en el `rclone.conf` (por ejemplo `b2-kair`), NO la palabra
# `rclone`: si se pone `rclone:mi-bucket/kair`, rclone busca un remoto que se
# llame "rclone", no lo encuentra y la copia falla con el codigo 1.
#
# METODO:
#   rsync   -- requiere `rsync` en las dos maquinas y llave SSH sin passphrase
#             (o `ssh-agent`).
#   scp     -- la ultima instancia: no verifica nada por si mismo, por eso
#             este script verifica el hash DESPUES.
#   rclone  -- requiere `rclone` con un remoto ya configurado (S3, GCS,
#             otro S3-compatible). Para un bucket en la nube es la mejor
#             opcion: el destino no depende de otra maquina.
#             El hash del destino se calcula descargando el objeto y
#             hasheandolo con SHA-256 (`rclone cat | sha256sum`). El hash
#             nativo del remoto (MD5 en S3) NO puede coincidir con el
#             SHA-256 local, y `rclone hash` no es un comando de rclone.
#   ninguno -- no se copia nada (estado por defecto).
#
# INTERFAZ
# --------
#   sudo bash backup-offsite.sh            Copia (si hay destino configurado).
#   sudo bash backup-offsite.sh --estado   Dice que haria, sin hacer nada.
#   sudo bash backup-offsite.sh --verificar
#                                          Compara los hashes local y remoto
#                                          de la ultima copia, sin copiar.
#
# CORRE COMO ROOT: los respaldos son `600 root:root` y la configuracion es
# `600 root`. Un ensayo sin permisos lo dice, no falla en silencio.
#
# Es un script de shell: el EOL es LF.

set -uo pipefail

# ---------------------------------------------------------------------------
# CONFIGURACION
# ---------------------------------------------------------------------------
APP="/opt/kair-firma"
BACKUPS="$APP/backups"
CONF="$APP/backup-offsite.conf"
LOG="$BACKUPS/offsite.log"
LOG_EJECUCION=1
LOG_FALLO_AVISADO=0

log() {
  if [ "$LOG_EJECUCION" = "1" ]; then
    mkdir -p "$BACKUPS" 2>/dev/null
    if ! { echo "[$(date -Is)] $*" >> "$LOG"; } 2>/dev/null; then
      # Sin permiso en el log (este script corre como root en produccion; un
      # ensayo sin permisos no puede escribir). Se avisa UNA vez.
      if [ "$LOG_FALLO_AVISADO" = "0" ]; then
        echo "AVISO: no se puede escribir en $LOG (permisos). El log va solo por pantalla." >&2
        LOG_FALLO_AVISADO=1
      fi
    fi
  fi
  echo "$*"
}

leer_conf() {
  if [ ! -r "$CONF" ]; then
    log "OFFSITE SIN CONFIGURAR: no existe o no se puede leer $CONF."
    log "  Para activarlo: cree $CONF (root, 600) con METODO, REMOTO y RETENCION_DIAS."
    return 1
  fi
  # Solo se leen variables conocidas y se ignoran las demas.
  METODO=""
  REMOTO=""
  RETENCION_DIAS="30"
  while IFS='=' read -r clave valor; do
    case "$clave" in
      METODO) METODO="$(echo "$valor" | tr -d '"' | tr -d "'" | tr -d '[:space:]')" ;;
      REMOTO) REMOTO="$(echo "$valor" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')" ;;
      RETENCION_DIAS) RETENCION_DIAS="$(echo "$valor" | tr -d '"' | tr -d "'" | tr -d '[:space:]')" ;;
    esac
  done < "$CONF"
  if [ -z "$METODO" ] || [ "$METODO" = "ninguno" ]; then
    log "OFFSITE SIN CONFIGURAR: METODO vacio o 'ninguno' en $CONF."
    return 1
  fi
  if [ -z "$REMOTO" ]; then
    log "OFFSITE SIN CONFIGURAR: REMOTO vacio en $CONF."
    return 1
  fi
  case "$METODO" in
    rsync|scp|rclone) ;;
    *)
      log "OFFSITE NO CONFIGURADO: METODO '$METODO' no es uno de rsync, scp, rclone."
      return 1
      ;;
  esac
  return 0
}

# ---------------------------------------------------------------------------
# LOS ARCHIVOS A COPIAR: los dos mas recientes, ya cifrados.
#
# EL selector ES POR FECHA, NO POR NOMBRE. Un `ls | sort | tail -1` elige mal:
# `firma-pre-despliegue-20261026-180335.sqlite.enc` ordena DESPUES de
# `firma-20261111-220001.sqlite.enc` (la "p" de "pre" va despues del "2"), y
# un selector por nombre se llevaria un respaldo de octubre pensando que es el
# de hoy. Se elige por fecha de modificacion y con el patron de nombre exacto
# que usa `backup-firma.sh`.
# ---------------------------------------------------------------------------
archivos_a_copiar() {
  local f
  f="$(ls -t "$BACKUPS"/firma-2???????-??????.sqlite.enc 2>/dev/null | head -1)"
  [ -n "$f" ] && echo "$f"
  f="$(ls -t "$BACKUPS"/storage-2???????-??????.tar.gz.enc 2>/dev/null | head -1)"
  [ -n "$f" ] && echo "$f"
}

# ---------------------------------------------------------------------------
# COPIAR UN ARCHIVO Y VERIFICAR SU HASH EN EL DESTINO.
# ---------------------------------------------------------------------------
copiar_y_verificar() {
  local origen="$1"
  local nombre
  nombre="$(basename "$origen")"
  local hash_local
  hash_local="$(sha256sum "$origen" | awk '{print $1}')"

  case "$METODO" in
    rsync)
      rsync -a --partial "$origen" "$REMOTO/$nombre" >/dev/null 2>&1
      ;;
    scp)
      scp -q "$origen" "$REMOTO/$nombre" >/dev/null 2>&1
      ;;
    rclone)
      rclone copyto "$origen" "$REMOTO/$nombre" >/dev/null 2>&1
      ;;
  esac
  local codigo=$?
  if [ "$codigo" != "0" ]; then
    log "  COPIA FALLIDA: $nombre no se pudo copiar a $REMOTO (codigo $codigo)."
    return 1
  fi

  # El hash en el destino. Para rclone se usa `rclone hash`; para los otros
  # metodos, sha256sum sobre el archivo remoto.
  local hash_destino=""
  case "$METODO" in
    rclone)
      # `rclone hash` NO sirve para comparar contra el SHA-256 local: en S3 el
      # hash que entrega el remoto es el MD5 (ETag) y con subida por partes no
      # hay hash, asi que jamas coincidiria con el SHA-256. Ademas `rclone hash`
      # no es un comando de rclone (los comandos son `hashsum`, `md5sum` y
      # `sha1sum`). Por eso el hash del destino se calcula DESCARGANDO el
      # objeto y hasheandolo con SHA-256: la comparacion queda SHA-256 contra
      # SHA-256, que es la garantia que este script promete.
      hash_destino="$(rclone cat "$REMOTO/$nombre" 2>/dev/null | sha256sum | awk '{print $1}')" || hash_destino=""
      ;;
    *)
      hash_destino="$(ssh "${REMOTO%%:*}" "sha256sum '$REMOTO/${nombre##*/}'" 2>/dev/null | awk '{print $1}')"
      ;;
  esac

  if [ -z "$hash_destino" ]; then
    log "  NO SE PUDO VERIFICAR $nombre: el hash del destino salio vacio."
    log "  La copia NO se da por buena. La copia local NO se toca."
    return 1
  fi
  if [ "$hash_destino" != "$hash_local" ]; then
    log "  HASH DISTINTO en $nombre."
    log "    local    $hash_local"
    log "    destino $hash_destino"
    log "  La copia NO se da por buena. La copia local NO se toca."
    return 1
  fi
  log "  OK $nombre ($(stat -c %s "$origen") B, sha256 $hash_local) copiado y verificado."
  return 0
}

# ---------------------------------------------------------------------------
# PODA DEL DESTINO: solo DESPUES de una copia verificada, y nunca mas de lo
# que la retencion local permite.
# ---------------------------------------------------------------------------
podar_destino() {
  case "$METODO" in
    rclone)
      rclone delete --min-age "${RETENCION_DIAS}d" "$REMOTO" >/dev/null 2>&1
      ;;
    *)
      ssh "${REMOTO%%:*}" \
        "find '$REMOTO' -maxdepth 1 -name 'firma-*.sqlite.enc' -mtime +${RETENCION_DIAS} -delete; find '$REMOTO' -maxdepth 1 -name 'storage-*.tar.gz.enc' -mtime +${RETENCION_DIAS} -delete" \
        >/dev/null 2>&1
      ;;
  esac
  log "  Poda del destino: copias con mas de ${RETENCION_DIAS} dias (lo que la retencion local permite)."
}

# ---------------------------------------------------------------------------
# VERIFICAR (sin copiar): compara los hashes de la ultima copia.
# ---------------------------------------------------------------------------
modo_verificar() {
  if ! leer_conf; then
    return 0
  fi
  local problemas=0
  while IFS= read -r origen; do
    [ -z "$origen" ] && continue
    local nombre hash_local hash_destino
    nombre="$(basename "$origen")"
    hash_local="$(sha256sum "$origen" | awk '{print $1}')"
    case "$METODO" in
      rclone)
        # Mismo criterio que en `copiar_y_verificar`: el hash del destino se
        # calcula descargando el objeto y hasheandolo con SHA-256, porque el
        # hash nativo del remoto (MD5 en S3) nunca coincidiria con el local.
        hash_destino="$(rclone cat "$REMOTO/$nombre" 2>/dev/null | sha256sum | awk '{print $1}')" || hash_destino=""
        ;;
      *)
        hash_destino="$(ssh "${REMOTO%%:*}" "sha256sum '$REMOTO/${nombre##*/}'" 2>/dev/null | awk '{print $1}')"
        ;;
    esac
    if [ -z "$hash_destino" ]; then
      log "  $nombre: no se pudo leer el hash del destino."
      problemas=$((problemas + 1))
    elif [ "$hash_destino" != "$hash_local" ]; then
      log "  $nombre: HASH DISTINTO."
      problemas=$((problemas + 1))
    else
      log "  $nombre: coincide (sha256 $hash_local)."
    fi
  done < <(archivos_a_copiar)
  if [ "$problemas" = "0" ]; then
    log "VERIFICACION OFFSITE: todo coincide."
    return 0
  fi
  log "VERIFICACION OFFSITE: $problemas problema(s)."
  return 1
}

# ---------------------------------------------------------------------------
# MODO ESTADO: dice que haria, sin hacer nada.
# ---------------------------------------------------------------------------
modo_estado() {
  log "Estado off-site:"
  log "  configuracion : $CONF"
  if [ -r "$CONF" ]; then
    log "  metodo        : $(grep -E '^METODO=' "$CONF" | head -1)"
    log "  remoto        : $(grep -E '^REMOTO=' "$CONF" | head -1)"
    log "  retencion     : $(grep -E '^RETENCION_DIAS=' "$CONF" | head -1) dias"
  else
    log "  (sin configuracion: $CONF no existe o no se puede leer)"
  fi
  log "  origen        : $BACKUPS"
  log "  a copiar      :"
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    if [ ! -r "$f" ]; then
      log "    $(basename "$f")  (no se puede leer sin permisos: este script corre como root)"
      continue
    fi
    log "    $(basename "$f")  $(sha256sum "$f" | awk '{print $1}')"
  done < <(archivos_a_copiar)
  return 0
}

# ---------------------------------------------------------------------------
# COPIA
# ---------------------------------------------------------------------------
modo_copia() {
  if ! leer_conf; then
    return 0
  fi
  log "COPIA OFFSITE: metodo $METODO hacia $REMOTO (retencion ${RETENCION_DIAS} dias)."
  local copiados=0
  local fallidos=0
  while IFS= read -r origen; do
    [ -z "$origen" ] && continue
    if [ ! -r "$origen" ]; then
      log "  NO SE PUEDE LEER $origen: este script corre como root."
      fallidos=$((fallidos + 1))
      continue
    fi
    if copiar_y_verificar "$origen"; then
      copiados=$((copiados + 1))
    else
      fallidos=$((fallidos + 1))
    fi
  done < <(archivos_a_copiar)

  if [ "$copiados" = "0" ]; then
    log "COPIA OFFSITE: no se copio NADA. La copia local NO se toca."
    return 1
  fi
  if [ "$fallidos" != "0" ]; then
    log "COPIA OFFSITE: $copiados copiados, $fallidos con problemas. NO se poda el destino."
    return 1
  fi
  podar_destino
  log "COPIA OFFSITE: $copiados archivo(s) copiados y verificados."
  return 0
}

# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------
case "${1:-}" in
  --estado) modo_estado; exit $? ;;
  --verificar) modo_verificar; exit $? ;;
  "") modo_copia; exit $? ;;
  *)
    log "Uso: sudo bash backup-offsite.sh [--estado|--verificar]"
    exit 2
    ;;
esac
