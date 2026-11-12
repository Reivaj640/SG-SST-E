#!/usr/bin/env bash
# =============================================================================
# K+AIR Firma Electrónica — Vigilancia del servicio (detección de caídas)
# =============================================================================
# Para qué sirve esto:
#   Un RTO de 4 horas NO es verdad si nadie se entera de que el servicio se
#   cayó: el RTO cuenta desde que la caída se DETECTA. Sin esta vigilancia,
#   el Anexo de Nube estaría prometiendo un tiempo de recuperación que nadie
#   está midiendo. Esta es la mitad servidor de esa promesa; la otra mitad
#   es la alerta externa (monitor de uptime de Cloudflare, panel del owner).
#
# Instalar (cron cada 5 minutos):
#   sudo cp health-check.sh /opt/kair-firma/health-check.sh
#   sudo chmod +x /opt/kair-firma/health-check.sh
#   echo "*/5 * * * * root /opt/kair-firma/health-check.sh >> /opt/kair-firma/logs/health-check.log 2>&1" \
#     | sudo tee /etc/cron.d/kair-firma-health
#
# Qué hace:
#   1. Consulta el salud del servicio en LOCAL (127.0.0.1). Si no responde,
#      reinicia el servicio (con una espera de 10 minutos entre reinicios,
#      para no entrar en un bucle).
#   2. Consulta el salud PUBLICO (https://firma.kair.fyi/health). Si el local
#      responde y el publico no, el problema es del tunel o del dominio: se
#      avisa por log, pero NO se reinicia nada.
#   3. AVISA POR CORREO cuando el publico cae (y el local responde) o cuando
#      caen los dos. Ver "LA ALERTA POR CORREO" mas abajo.
#   4. Deja constancia de cada revision. El log es la evidencia de que la
#      vigilancia existia y de que el servicio estaba arriba.
#
# Nota: el reinicio es una medida de recuperacion, no un sustituto del
# diagnostico. Cada reinicio queda registrado con su causa.
#
# -----------------------------------------------------------------------------
# LA ALERTA POR CORREO
# -----------------------------------------------------------------------------
# Por que existe:
#   El 12-nov-2026 el tunel de Cloudflare se caio 5 minutos (a las 12:50:11 el
#   monitor escribio "CAIDO publico" y a las 12:55:02 "OK publico"). Se
#   recupero solo. El problema NO fue la caida: fue que NADIE fue avisado. El
#   monitor detectaba y escribia en el log, pero el log solo lo lee quien
#   mire. Con esta funcion, la caida llega al buzon del owner.
#
# Configuracion (todo por VARIABLES DE ENTORNO):
#   ALERTA_CORREO=1|0        Activa o desactiva el aviso. Por defecto 1.
#   ALERTA_PARA=destino      Destinatario del aviso (obligatorio para que
#                            se mande). Puede llevar varios separados por
#                            coma.
#   ALERTA_SMTP_HOST=host    Servidor SMTP. Obligatorio para enviar.
#   ALERTA_SMTP_PUERTO=587   Puerto SMTP. Por defecto 587.
#   ALERTA_SMTP_USUARIO=u   Usuario del SMTP. Obligatorio para enviar.
#   ALERTA_SMTP_CLAVE=p     Clave del SMTP. Obligatoria para enviar.
#   ALERTA_SMTP_REMITENTE    Remitente. Por defecto alertas@kair.fyi.
#   ALERTA_SMTP_SSL=1|0      1 (por defecto) usa STARTTLS en el puerto 587.
#
# Donde se ponen (en el cron, para que el root las lea y no cualquiera):
#   sudo sh -c 'cat > /etc/cron.d/kair-firma-health <<EOF
#   ALERTA_PARA=adminkair@gmail.com
#   ALERTA_SMTP_HOST=smtp.gmail.com
#   ALERTA_SMTP_USUARIO=alertas@kair.fyi
#   ALERTA_SMTP_CLAVE=clave-de-aplicacion
#   */5 * * * * root /opt/kair-firma/health-check.sh >> /opt/kair-firma/logs/health-check.log 2>&1
#   EOF'
#   sudo chmod 600 /etc/cron.d/kair-firma-health
#
# REGLAS DE LA ALERTA (no se rompen):
#   1. Sin destinatario NO se avisa y NO se falla: el script sigue haciendo
#      exactamente lo que hacia antes (escribir en el log). La instalacion
#      actual no se rompe por anadir esto.
#   2. `ALERTA_CORREO=0` desactiva el aviso por completo.
#   3. El aviso sale solo cuando el ESTADO CAMBIA: si la caida dura, no se
#      manda un correo cada 5 minutos. El estado anterior se guarda en
#      logs/health-check.alerta.estado.
#   4. El aviso NO lleva secretos: ni la clave del SMTP, ni tokens, ni llaves
#      de API. Solo el QUE paso, el CUANDO y el DONDE.
#   5. Si el correo no se puede enviar, el script NO falla: lo dice en el
#      log y sigue. Un monitor que se cae por no poder avisar es peor que
#      un monitor que avisa tarde.
# =============================================================================
set -uo pipefail

BASE=${KAIR_BASE:-/opt/kair-firma}
LOGDIR=$BASE/logs
LOG=$LOGDIR/health-check.log
ESTADO=$LOGDIR/health-check.estado
ESTADO_ALERTA=$LOGDIR/health-check.alerta.estado
PUERTO=${KAIR_PUERTO:-3001}
URL_LOCAL=${KAIR_URL_LOCAL:-http://127.0.0.1:$PUERTO/health}
URL_PUBLICA=${KAIR_URL_PUBLICA:-https://firma.kair.fyi/health}
COOLDOWN_MIN=${KAIR_HEALTH_COOLDOWN_MIN:-10}

# --- La alerta por correo ---------------------------------------------------
ALERTA_CORREO=${ALERTA_CORREO:-1}
ALERTA_PARA=${ALERTA_PARA:-}
ALERTA_SMTP_HOST=${ALERTA_SMTP_HOST:-}
ALERTA_SMTP_PUERTO=${ALERTA_SMTP_PUERTO:-587}
ALERTA_SMTP_USUARIO=${ALERTA_SMTP_USUARIO:-}
ALERTA_SMTP_CLAVE=${ALERTA_SMTP_CLAVE:-}
ALERTA_SMTP_REMITENTE=${ALERTA_SMTP_REMITENTE:-alertas@kair.fyi}
ALERTA_SMTP_SSL=${ALERTA_SMTP_SSL:-1}

mkdir -p "$LOGDIR"

# --- El estado del servicio local -------------------------------------------
LOCAL_OK=0
if curl -fsS --max-time 10 "$URL_LOCAL" > /dev/null 2>&1; then
  LOCAL_OK=1
  echo "[$(date -Is)] OK local ($URL_LOCAL)"
  rm -f "$ESTADO"
else
  YA_REINICIO=0
  if [ -f "$ESTADO" ]; then
    ULTIMO=$(cat "$ESTADO" 2>/dev/null || echo 0)
    MINOS=$(( ( $(date +%s) - ULTIMO ) / 60 ))
    if [ "$MINOS" -lt "$COOLDOWN_MIN" ]; then
      YA_REINICIO=1
    fi
  fi

  if [ "$YA_REINICIO" -eq 1 ]; then
    echo "[$(date -Is)] CAIDO local ($URL_LOCAL). Ya se reinicio hace menos de $COOLDOWN_MIN min: no se reinicia de nuevo."
    # El estado final del local no se sabe por el reinicio: se consulta.
    if curl -fsS --max-time 10 "$URL_LOCAL" > /dev/null 2>&1; then
      LOCAL_OK=1
    fi
  else
    echo "[$(date -Is)] CAIDO local ($URL_LOCAL). Reiniciando el servicio..."
    if systemctl restart kair-firma > /dev/null 2>&1; then
      date +%s > "$ESTADO"
      sleep 5
      if curl -fsS --max-time 10 "$URL_LOCAL" > /dev/null 2>&1; then
        LOCAL_OK=1
        echo "[$(date -Is)] RECUPERADO: el servicio respondio despues del reinicio."
      else
        echo "[$(date -Is)] SIGUE CAIDO despues del reinicio. Requiere atencion humana (PQRS: adminkair@gmail.com)."
      fi
    else
      echo "[$(date -Is)] NO SE PUDO REINICIAR el servicio (systemctl restart fallo)."
    fi
  fi
fi

# --- El servicio publico (tunel + dominio) -----------------------------------
PUBLICO_OK=0
if curl -fsS --max-time 15 "$URL_PUBLICA" > /dev/null 2>&1; then
  PUBLICO_OK=1
  echo "[$(date -Is)] OK publico ($URL_PUBLICA)"
else
  echo "[$(date -Is)] CAIDO publico ($URL_PUBLICA). Si el local responde, el problema es del tunel de Cloudflare o del dominio."
fi

# --- La alerta por correo ----------------------------------------------------
# Se avisa de DOS situaciones, y solo de esas:
#   - el publico cae y el local responde (el problema es del tunel o del
#     dominio);
#   - caen los dos (el servicio no esta y tampoco el tunel).
# La combinacion "el local no responde y el publico si" no se avisa: el
# reinicio del servicio ya quedo registrado en el log y es una situacion que
# no se ha medido en produccion.
#
# Cada una se manda UNA vez: mientras la caida dure, el estado anterior se
# recuerda y no se repite el correo.
avisar_por_correo() {
  CONDICION="$1"
  ASUNTO="$2"
  CUERPO="$3"

  if [ "$ALERTA_CORREO" != "1" ]; then
    return 0
  fi

  if [ -z "$ALERTA_PARA" ]; then
    echo "[$(date -Is)] ALERTA: no se avisa por correo: no hay destinatario (ALERTA_PARA) configurado."
    return 0
  fi

  if ! command -v curl > /dev/null 2>&1; then
    echo "[$(date -Is)] ALERTA: no se avisa por correo: no hay curl en esta maquina."
    return 0
  fi

  if [ -z "$ALERTA_SMTP_HOST" ] || [ -z "$ALERTA_SMTP_USUARIO" ] || [ -z "$ALERTA_SMTP_CLAVE" ]; then
    echo "[$(date -Is)] ALERTA: no se avisa por correo: falta la configuracion del SMTP (ALERTA_SMTP_HOST / ALERTA_SMTP_USUARIO / ALERTA_SMTP_CLAVE)."
    return 0
  fi

  # Solo se avisa al CAMBIAR el estado: si la caida dura, no se manda un
  # correo cada 5 minutos.
  ANTERIOR=""
  if [ -f "$ESTADO_ALERTA" ]; then
    ANTERIOR=$(cat "$ESTADO_ALERTA" 2>/dev/null || echo "")
  fi
  if [ "$ANTERIOR" = "$CONDICION" ]; then
    return 0
  fi
  echo "$CONDICION" > "$ESTADO_ALERTA" 2>/dev/null || true

  # El mensaje se arma en un archivo temporal (600) y se borra al terminar.
  # NO lleva secretos: ni la clave del SMTP, ni tokens, ni llaves de API.
  MENSAJE=$(mktemp) || return 0
  NETRC=$(mktemp) || { rm -f "$MENSAJE"; return 0; }
  chmod 600 "$NETRC" 2>/dev/null || true

  {
    echo "From: $ALERTA_SMTP_REMITENTE"
    echo "To: $ALERTA_PARA"
    echo "Subject: $ASUNTO"
    echo "Date: $(date -R)"
    echo ""
    echo "K+AIR Firma Electronica: alerta del monitor de salud del servidor."
    echo ""
    echo "Que paso:"
    echo "  $CUERPO"
    echo ""
    echo "Donde:"
    echo "  servidor   : $(hostname)"
    echo "  servicio   : $URL_LOCAL"
    echo "  publico    : $URL_PUBLICA"
    echo ""
    echo "Cuando:"
    echo "  $(date -Is)"
    echo ""
    echo "Que hacer:"
    echo "  1. Si el local responde, el problema es del tunel de Cloudflare o del"
    echo "     dominio: no se reinicia el servicio (se reinicia solo si el local"
    echo "     tampoco responde)."
    echo "  2. Revisar el log del monitor: /opt/kair-firma/logs/health-check.log"
    echo "  3. Si sigue caido, reiniciar el tunel o el servicio."
    echo ""
    echo "Este correo lo manda el monitor (health-check.sh). No lleva ninguna"
    echo "credencial: solo el estado del servicio."
  } > "$MENSAJE"

  # La clave del SMTP va en un netrc temporal de modo 600, no en la linea de
  # comandos: asi no aparece en la lista de procesos.
  printf 'machine %s login %s password %s\n' \
    "$ALERTA_SMTP_HOST" "$ALERTA_SMTP_USUARIO" "$ALERTA_SMTP_CLAVE" > "$NETRC"

  # Un `--mail-rcpt` por destinatario: el mensaje sale UNA vez, con todos los
  # destinatarios. Los que no se pueden separar por coma (por ejemplo una
  # lista con espacios raros) se ignoran con un aviso en el log.
  ERROR=0
  DESTINATARIOS=$(echo "$ALERTA_PARA" | tr ',' ' ')
  for DESTINO in $DESTINATARIOS; do
    case "$DESTINO" in
      "") continue ;;
    esac
    if [ "$ALERTA_SMTP_SSL" = "1" ]; then
      curl -sS --ssl --netrc-file "$NETRC" \
        --url "smtp://$ALERTA_SMTP_HOST:$ALERTA_SMTP_PUERTO" \
        --mail-from "$ALERTA_SMTP_REMITENTE" \
        --mail-rcpt "$DESTINO" \
        --upload-file "$MENSAJE" \
        --quit-after 30 > /dev/null 2>&1 || ERROR=$?
    else
      curl -sS --netrc-file "$NETRC" \
        --url "smtp://$ALERTA_SMTP_HOST:$ALERTA_SMTP_PUERTO" \
        --mail-from "$ALERTA_SMTP_REMITENTE" \
        --mail-rcpt "$DESTINO" \
        --upload-file "$MENSAJE" \
        --quit-after 30 > /dev/null 2>&1 || ERROR=$?
    fi
  done

  rm -f "$MENSAJE" "$NETRC"

  if [ "$ERROR" != "0" ]; then
    echo "[$(date -Is)] ALERTA: no se pudo enviar el correo (curl $ERROR). La caida queda solo en el log."
    return 0
  fi

  echo "[$(date -Is)] ALERTA: aviso enviado por correo a $ALERTA_PARA."
}

if [ "$PUBLICO_OK" = "0" ]; then
  if [ "$LOCAL_OK" = "1" ]; then
    avisar_por_correo \
      "publico" \
      "[K+AIR] ALERTA: el servicio de firma NO responde por el publico (el local responde)" \
      "El servicio publico no responde y el servicio local SI responde: el problema es del tunel de Cloudflare o del dominio."
  else
    avisar_por_correo \
      "ambos" \
      "[K+AIR] ALERTA: el servicio de firma NO responde ni en local ni en el publico" \
      "El servicio local no responde (se intento reiniciar) y el servicio publico tampoco: el servicio esta caido."
  fi
else
  # El publico volvio: se olvida el estado de la alerta, para que una
  # proxima caida vuelva a avisar.
  rm -f "$ESTADO_ALERTA" 2>/dev/null || true
fi

exit 0
