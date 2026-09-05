# Migración del servidor de firmas al portátil 24/7

> Cuando el portátil viejo quede dedicado como servidor de firma, se migra
> desde este PC siguiendo los pasos. El objetivo: **cero pérdida de firmas ya
> hechas** (la BD y los PDF de evidencia viajan) y el dominio público sigue
> igual, solo cambia la máquina que atiende.

## Pre-requisitos en el portátil nuevo

1. Windows o Ubuntu. (Esta guía cubre Windows; para Ubuntu reutiliza
   `firma-service/deploy/setup-vm.sh`.)
2. Instalar:
   - **Node.js 20 LTS**: https://nodejs.org (versión LTS, no Current).
   - **cloudflared**: `winget install Cloudflare.cloudflared`
3. Conectarlo a corriente y a internet estables. En Configuración de energía:
   que NUNCA se suspenda (ni al cerrar la tapa).

## Copia de datos (evidencia legal — hacer con cuidado)

En el PC actual (origen), con el servicio **DETENIDO**:

```powershell
# 1. Detener firma-service y el túnel
Get-ScheduledTask KairFirmaTunnel | Stop-ScheduledTask -ErrorAction SilentlyContinue
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force

# 2. Backup consistente de la BD (usa sqlite3 .backup: seguro con WAL)
sqlite3 "firma-service\data\firma.sqlite" ".backup 'C:\temp\firma-migracion.sqlite'"

# 3. Empaquetado mínimo (código + BD + PDFs de evidencia)
Compress-Archive -Path `
  firma-service\src, firma-service\web, firma-service\package.json, `
  firma-service\package-lock.json, firma-service\scripts, firma-service\storage `
  -DestinationPath C:\temp\firma-service-migracion.zip -Force
# Además: firma-service\.env  →  copiar a C:\temp\firma-dotenv-migracion.txt
# (es el único archivo con secretos; llévalo por USB, no dejes copias en red)
```

## Preparación del portátil destino

```powershell
# 1. Crear estructura y descomprimir
mkdir C:\kair-firma
Expand-Archive C:\...\firma-service-migracion.zip C:\kair-firma -Force
cd C:\kair-firma

# 2. Dependencias (mejor-sqlite3 compila nativo: tarda ~1 min)
npm ci --omit=dev

# 3. Restaurar BD y .env
mkdir data
copy C:\...\firma-migracion.sqlite data\firma.sqlite
copy C:\...\firma-dotenv-migracion.txt .env

# 4. Smoke test local
node src/server.js
# en otra consola: curl http://localhost:3001/health  → {"status":"ok"...}
```

## Túnel y arranque automático

```powershell
# 5. Copiar scripts y registrar la tarea
copy <repo-origen>\scripts\firma-tunnel C:\kair-firma\scripts-tunnel -Recurse
cd C:\kair-firma\scripts-tunnel
# Ajustar las rutas internas al nuevo repo (start-firma-tunnel.ps1 usa
# $RepoRoot relativo; si el portátil tiene la misma estructura de repo no
# hay que tocar nada):
.\registrar-tarea.ps1
.\start-firma-tunnel.ps1
```

## Verificación final

1. `Get-Content estado.txt` muestra la URL del túnel del portátil.
2. Desde tu celular (datos móviles, no tu Wi-Fi):
   `https://<url-tunnel>/health` → `ok`.
3. En K+AIR (app de escritorio), Configuración → Firma: la URL del servicio
   sigue siendo `http://localhost:3001` SÓLO si K+AIR corre en el MISMO equipo
   que firma-service. Si K+AIR corre en tu PC principal y el servicio en el
   portátil, cambia la URL de servicio a la del túnel (`https://...trycloudflare.com`)
   **o** a `http://<IP-LAN-del-portátil>:3001` si están en la misma red.
4. Haz una solicitud de firma nueva y verifícala de punta a punta.
5. **Solo entonces** apaga/desconecta definitivamente el origen.

## Notas operativas

- Enlaces ya enviados: mueren si cambia la URL del túnel (Ruta B). Cuando
  compres el dominio propio (Ruta A) y montes el túnel nombrado, la URL deja
  de cambiar y esta nota desaparece.
- Si firma-service muestra "BD initialized" con ruta de datos del PC viejo,
  revisa `DB_PATH` en el `.env` del portátil.
- `TRUST_PROXY` se queda en `loopback` (cloudflared expone al servicio a
  través de su conexión local; es la opción segura) — las IPs reales llegan
  vía headers X-Forwarded-For/CF-Connecting-IP que cloudflared inyecta.
