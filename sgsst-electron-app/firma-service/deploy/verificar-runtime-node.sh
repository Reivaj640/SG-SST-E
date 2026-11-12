#!/usr/bin/env bash
# =============================================================================
# K+AIR Firma Electronica - verificar-runtime-node.sh
# Comprueba que el runtime de Node y el modulo nativo better-sqlite3 sean
# COHERENTES entre si, y que el servicio este arriba y sano.
#
# Que mide (TODO SOLO LECTURA):
#   1. Que binario de node usa el servicio (ExecStart de systemd).
#   2. Version y ABI (process.versions.modules) de ese node, y del node que
#      esta primero en el PATH.
#   3. Version declarada del modulo y huella SHA-256 del binario nativo.
#   4. CARGA el modulo con el node del servicio y ejecuta un SELECT 1 real
#      sobre una base EN MEMORIA: no abre ni escribe la base de produccion.
#   5. Repite la carga con el node del PATH, si es un binario distinto.
#   6. /health: codigo HTTP 200 y checks.db == "ok".
#   7. Estado de systemd: active, MainPID, NRestarts, arranque.
#
# Que NO hace: no escribe nada, no borra nada, no reinicia nada, no necesita
# sudo, no abre la base de produccion en escritura, no lee el .env ni las
# llaves.
#
# Codigo de salida:
#   0 = todo coherente
#   1 = INCOHERENCIA entre el runtime y el modulo nativo, o el servicio no
#       esta sano. Es el codigo que hace fallar la ventana de mantenimiento.
#   2 = el entorno no se pudo medir (falta node, falta curl, etc.)
#
# Uso:
#   bash verificar-runtime-node.sh
#   KAIR_VERSION_ESPERADA=22 KAIR_ABI_ESPERADO=127 bash verificar-runtime-node.sh
# =============================================================================
set -uo pipefail

BASE=${KAIR_BASE:-/opt/kair-firma}
APP=${KAIR_APP:-$BASE/app}
SERVICIO=${KAIR_SERVICIO:-kair-firma}
PUERTO=${KAIR_PUERTO:-3001}
URL_HEALTH=${KAIR_URL_HEALTH:-http://127.0.0.1:$PUERTO/health}
MODULO_REL=${KAIR_MODULO:-node_modules/better-sqlite3}
DB_PATH=${KAIR_DB_PATH:-$BASE/data/firma.sqlite}
VERSION_ESPERADA=${KAIR_VERSION_ESPERADA:-}
ABI_ESPERADO=${KAIR_ABI_ESPERADO:-}

FALLAS=0
AVISOS=0

info() { echo "[info] $*"; }
ok()   { echo "[ OK ] $*"; }
aviso(){ echo "[aviso] $*"; AVISOS=$((AVISOS + 1)); }
fallo(){ echo "[FALLA] $*"; FALLAS=$((FALLAS + 1)); }

echo "==================================================================="
echo " K+AIR - verificacion del runtime de Node y del modulo nativo"
echo " fecha: $(date -Is 2>/dev/null || echo '(sin date)')"
echo "==================================================================="
echo

# --- 1. Que node usa el servicio ---------------------------------------------
NODE_SERVICIO=""
if command -v systemctl > /dev/null 2>&1; then
  RAW_EXEC=$(systemctl show "$SERVICIO" -p ExecStart --value 2>/dev/null || true)
  NODE_SERVICIO=$(printf '%s' "$RAW_EXEC" | sed -n 's/.*path=\([^ ;}]*\).*/\1/p')
fi
if [ -z "$NODE_SERVICIO" ] || [ ! -x "$NODE_SERVICIO" ]; then
  NODE_SERVICIO=$(command -v node 2>/dev/null || true)
  if [ -n "$NODE_SERVICIO" ]; then
    aviso "no se pudo leer el ExecStart de '$SERVICIO': se usa el node del PATH"
  fi
fi

if [ -z "$NODE_SERVICIO" ] || [ ! -x "$NODE_SERVICIO" ]; then
  echo
  fallo "no hay ningun binario de node ejecutable en este equipo"
  echo
  echo "RESULTADO: 2 (entorno no medible)"
  exit 2
fi

NODE_PATH=$(command -v node 2>/dev/null || true)

echo "--- 1. runtime ---"
info "servicio        : $SERVICIO"
info "node del servicio: $NODE_SERVICIO"
info "node del PATH    : ${NODE_PATH:-'(no hay node en el PATH)'}"
echo

VERSION_SERV=$("$NODE_SERVICIO" -v 2>/dev/null || echo "(desconocida)")
ABI_SERV=$("$NODE_SERVICIO" -p "process.versions.modules" 2>/dev/null || echo "(desconocido)")
info "node del servicio -> $VERSION_SERV (ABI $ABI_SERV)"

if [ -n "$NODE_PATH" ] && [ -x "$NODE_PATH" ]; then
  VERSION_PATH=$("$NODE_PATH" -v 2>/dev/null || echo "(desconocida)")
  ABI_PATH=$("$NODE_PATH" -p "process.versions.modules" 2>/dev/null || echo "(desconocido)")
  info "node del PATH     -> $VERSION_PATH (ABI $ABI_PATH)"
  if [ "$NODE_PATH" != "$NODE_SERVICIO" ]; then
    aviso "el node del PATH no es el mismo archivo que el del servicio"
  fi
else
  VERSION_PATH="(no hay node en el PATH)"
  ABI_PATH="(desconocido)"
fi
echo

if [ -n "$VERSION_ESPERADA" ]; then
  case "$VERSION_SERV" in
    v"$VERSION_ESPERADA".*|v"$VERSION_ESPERADA") ok "version del runtime = la esperada ($VERSION_ESPERADA)";;
    *) fallo "version del runtime $VERSION_SERV; se esperaba v$VERSION_ESPERADA";;
  esac
fi
if [ -n "$ABI_ESPERADO" ]; then
  if [ "$ABI_SERV" = "$ABI_ESPERADO" ]; then
    ok "ABI del runtime = el esperado ($ABI_ESPERADO)"
  else
    fallo "ABI del runtime $ABI_SERV; se esperaba $ABI_ESPERADO"
  fi
fi
echo

# --- 2. El modulo nativo ------------------------------------------------------
echo "--- 2. modulo nativo ---"
MODULO="$APP/$MODULO_REL"
if [ ! -d "$MODULO" ]; then
  fallo "no existe el arbol del modulo en $MODULO"
else
  if [ -r "$MODULO/package.json" ]; then
    VER_MOD=$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$MODULO/package.json" | head -1)
    info "better-sqlite3 declarado: ${VER_MOD:-'(sin version)'}"
  fi
  NATIVO="$MODULO/build/Release/better_sqlite3.node"
  if [ ! -f "$NATIVO" ]; then
    fallo "no existe el binario nativo $NATIVO"
  else
    ok "binario nativo presente"
    info "ruta   : $NATIVO"
    info "bytes  : $(wc -c < "$NATIVO" | tr -d ' ')"
    info "sha256 : $(sha256sum "$NATIVO" 2>/dev/null | cut -d' ' -f1)"
    info "fecha  : $(date -r "$NATIVO" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || echo '(desconocida)')"
  fi
fi
echo

# --- 3. Carga real y SELECT 1 (en memoria) -----------------------------------
echo "--- 3. carga real y SELECT 1 (base en memoria) ---"
export BSQLITE_PATH="$MODULO"
SALIDA_CARGA=$("$NODE_SERVICIO" -e '
const Database = require(process.env.BSQLITE_PATH);
const db = new Database(":memory:");
const fila = db.prepare("SELECT 1 AS uno").get();
db.close();
if (!fila || fila.uno !== 1) {
  console.error("SELECT 1 devolvio " + JSON.stringify(fila));
  process.exit(3);
}
console.log("SELECT 1 = " + fila.uno);
' 2>&1)
CODIGO_CARGA=$?

if [ "$CODIGO_CARGA" -eq 0 ]; then
  ok "el modulo carga con el node del servicio y responde SELECT 1"
  info "$(printf '%s' "$SALIDA_CARGA" | tr '\n' ' ')"
else
  fallo "el modulo NO carga con el node del servicio (codigo $CODIGO_CARGA)"
  printf '%s\n' "$SALIDA_CARGA" | sed 's/^/        /'
  if printf '%s' "$SALIDA_CARGA" | grep -q 'NODE_MODULE_VERSION'; then
    fallo "desajuste de ABI: el binario nativo fue compilado para otro Node"
  fi
fi
echo

# --- 4. El node del PATH ------------------------------------------------------
if [ -n "$NODE_PATH" ] && [ -x "$NODE_PATH" ] && [ "$NODE_PATH" != "$NODE_SERVICIO" ]; then
  echo "--- 4. el node del PATH contra el mismo modulo ---"
  SALIDA_PATH=$("$NODE_PATH" -e '
const Database = require(process.env.BSQLITE_PATH);
const db = new Database(":memory:");
const fila = db.prepare("SELECT 1 AS uno").get();
db.close();
if (!fila || fila.uno !== 1) { console.error("SELECT 1 devolvio " + JSON.stringify(fila)); process.exit(3); }
console.log("SELECT 1 = " + fila.uno);
' 2>&1)
  CODIGO_PATH=$?
  if [ "$CODIGO_PATH" -eq 0 ]; then
    ok "el node del PATH tambien carga el modulo"
  else
    fallo "el node del PATH NO carga el modulo (codigo $CODIGO_PATH): el runtime de la consola y el del servicio no son el mismo"
    printf '%s\n' "$SALIDA_PATH" | sed 's/^/        /'
  fi
  echo
fi

# --- 5. La base real, en solo lectura ----------------------------------------
echo "--- 5. la base real (solo lectura) ---"
if [ -f "$DB_PATH" ]; then
  export KAIR_DB_PATH="$DB_PATH"
  SALIDA_DB=$("$NODE_SERVICIO" -e '
const Database = require(process.env.BSQLITE_PATH);
const db = new Database(process.env.KAIR_DB_PATH, { readonly: true, fileMustExist: true });
const fila = db.prepare("SELECT 1 AS uno").get();
db.close();
if (!fila || fila.uno !== 1) { console.error("SELECT 1 devolvio " + JSON.stringify(fila)); process.exit(3); }
console.log("SELECT 1 sobre la base real = " + fila.uno);
' 2>&1)
  CODIGO_DB=$?
  if [ "$CODIGO_DB" -eq 0 ]; then
    ok "la base real abre en solo lectura y responde SELECT 1"
    info "$(printf '%s' "$SALIDA_DB" | tr '\n' ' ')"
  else
    aviso "no se pudo abrir la base real en solo lectura (codigo $CODIGO_DB)"
    printf '%s\n' "$SALIDA_DB" | head -3 | sed 's/^/        /'
  fi
else
  aviso "no se encontro la base en $DB_PATH (se omite esta comprobacion)"
fi
echo

# --- 6. /health ---------------------------------------------------------------
echo "--- 6. salud del servicio ---"
if ! command -v curl > /dev/null 2>&1; then
  fallo "no hay curl en este equipo: no se puede comprobar /health"
else
  HTTP=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "$URL_HEALTH" 2>/dev/null || echo 000)
  if [ "$HTTP" = "200" ]; then
    ok "/health respondio HTTP 200 ($URL_HEALTH)"
  else
    fallo "/health respondio HTTP $HTTP (se esperaba 200) en $URL_HEALTH"
  fi

  SALIDA_HEALTH=$(curl -sS --max-time 10 "$URL_HEALTH" 2>/dev/null | "$NODE_SERVICIO" -e '
let datos = "";
process.stdin.on("data", (c) => { datos += c; });
process.stdin.on("end", () => {
  if (!datos.trim()) { console.error("cuerpo vacio"); process.exit(4); }
  let j;
  try { j = JSON.parse(datos); } catch (e) { console.error("JSON invalido: " + e.message); process.exit(4); }
  const estado = j.status;
  const db = (j.checks && j.checks.db) ? j.checks.db : "(sin dato)";
  console.log("status=" + estado + " db=" + db + " uptime_seconds=" + j.uptime_seconds);
  if (estado !== "ok") { process.exit(2); }
  if (db !== "ok") { process.exit(3); }
});
' 2>&1)
  CODIGO_HEALTH=$?
  info "$(printf '%s' "$SALIDA_HEALTH" | tr '\n' ' ')"
  if [ "$CODIGO_HEALTH" -eq 0 ]; then
    ok "/health dice status=ok y db=ok"
  elif [ "$CODIGO_HEALTH" -eq 3 ]; then
    fallo "/health responde pero la comprobacion de la base NO da ok"
  elif [ "$CODIGO_HEALTH" -eq 2 ]; then
    fallo "/health responde pero el estado NO es ok"
  else
    fallo "/health no devolvio un cuerpo de salud legible"
  fi
fi
echo

# --- 7. systemd ---------------------------------------------------------------
echo "--- 7. estado de systemd ---"
if command -v systemctl > /dev/null 2>&1; then
  ACTIVO=$(systemctl is-active "$SERVICIO" 2>/dev/null || echo "(desconocido)")
  if [ "$ACTIVO" = "active" ]; then
    ok "$SERVICIO esta active"
  else
    fallo "$SERVICIO esta $ACTIVO (se esperaba active)"
  fi
  info "MainPID      : $(systemctl show "$SERVICIO" -p MainPID --value 2>/dev/null || echo '?')"
  info "NRestarts    : $(systemctl show "$SERVICIO" -p NRestarts --value 2>/dev/null || echo '?')"
  info "arranque     : $(systemctl show "$SERVICIO" -p ExecMainStartTimestamp --value 2>/dev/null || echo '?')"
  info "ExecStart    : $(systemctl show "$SERVICIO" -p ExecStart --value 2>/dev/null || echo '?')"
else
  aviso "no hay systemctl: se omite el estado del servicio"
fi
echo

# --- Resumen ------------------------------------------------------------------
echo "==================================================================="
echo " RESUMEN"
echo "   runtime (servicio) : $VERSION_SERV  ABI $ABI_SERV"
echo "   modulo             : better-sqlite3 ${VER_MOD:-'?'}"
echo "   salud              : HTTP $HTTP  |  $(printf '%s' "$SALIDA_HEALTH" | tr '\n' ' ')"
echo "   fallos             : $FALLAS"
echo "   avisos             : $AVISOS"
echo "==================================================================="

if [ "$FALLAS" -gt 0 ]; then
  echo
  echo "RESULTADO: INCOHERENTE (codigo 1). El runtime y el modulo nativo NO"
  echo "           son coherentes entre si, o el servicio no esta sano."
  exit 1
fi

echo
echo "RESULTADO: coherente (codigo 0)."
exit 0
