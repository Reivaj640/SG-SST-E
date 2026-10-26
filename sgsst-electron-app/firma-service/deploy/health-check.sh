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
#   3. Deja constancia de cada revision. El log es la evidencia de que la
#      vigilancia existia y de que el servicio estaba arriba.
#
# Nota: el reinicio es una medida de recuperacion, no un sustituto del
# diagnostico. Cada reinicio queda registrado con su causa.
# =============================================================================
set -uo pipefail

BASE=${KAIR_BASE:-/opt/kair-firma}
LOGDIR=$BASE/logs
LOG=$LOGDIR/health-check.log
ESTADO=$LOGDIR/health-check.estado
PUERTO=${KAIR_PUERTO:-3001}
URL_LOCAL=${KAIR_URL_LOCAL:-http://127.0.0.1:$PUERTO/health}
URL_PUBLICA=${KAIR_URL_PUBLICA:-https://firma.kair.fyi/health}
COOLDOWN_MIN=${KAIR_HEALTH_COOLDOWN_MIN:-10}

mkdir -p "$LOGDIR"

# --- El servicio local -------------------------------------------------------
if curl -fsS --max-time 10 "$URL_LOCAL" > /dev/null 2>&1; then
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
  else
    echo "[$(date -Is)] CAIDO local ($URL_LOCAL). Reiniciando el servicio..."
    if systemctl restart kair-firma > /dev/null 2>&1; then
      date +%s > "$ESTADO"
      sleep 5
      if curl -fsS --max-time 10 "$URL_LOCAL" > /dev/null 2>&1; then
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
if curl -fsS --max-time 15 "$URL_PUBLICA" > /dev/null 2>&1; then
  echo "[$(date -Is)] OK publico ($URL_PUBLICA)"
else
  echo "[$(date -Is)] CAIDO publico ($URL_PUBLICA). Si el local responde, el problema es del tunel de Cloudflare o del dominio."
fi

exit 0
