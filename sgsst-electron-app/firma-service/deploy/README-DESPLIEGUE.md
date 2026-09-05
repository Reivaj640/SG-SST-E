# Despliegue a producción — K+AIR Firma Electrónica (Fase 1, $0)

> Guía paso a paso para poner el servicio de firmas en internet de forma
> permanente **sin pagar nada**: VM gratis de Oracle Cloud, dominio gratis
> (sslip.io al instante, o eu.org) y HTTPS automático con Caddy/Let's Encrypt.
>
> **Tiempo estimado**: 1–1.5 horas la primera vez.

---

## Arquitectura final

```
Celular del firmante (internet)
        │  HTTPS
        ▼
   Caddy (443)  ← certificado Let's Encrypt automático
        │  solo 127.0.0.1:3001
        ▼
   firma-service (Node 20 + SQLite, usuario sin privilegios)
        │
        ▼
   /opt/kair-firma/data + storage + backups diarios
```

- El puerto 3001 **nunca** se abre a internet (ufw lo bloquea).
- `TRUST_PROXY=loopback` → la trazabilidad registra la **IP real del firmante**
  (corrige el "::1" que veías en desarrollo).
- La app K+AIR de escritorio se conecta a la VM igual que hoy, solo cambia la URL.

---

## Paso 0 — Crear la cuenta de Oracle Cloud (solo UNA vez, gratis para siempre)

1. Ir a https://www.oracle.com/cloud/free/ → **Start for free**.
2. Datos del formulario: país Colombia, un correo tuyo, y **tarjeta de
   crédito/débito para verificación** (Oracle no cobra el tier Always Free;
   la tarjeta es anti-fraude. Si no tienes, avísame y vemos alternativa).
3. Elegir la **región home** más cercana (Bogotá sao.. o Sao Paulo si está).
4. Confirmar correo y terminar. Esta cuenta no cuesta nada mientras uses
   recursos "Always Free".

## Paso 1 — Crear la VM ( gratuita para siempre )

1. En el panel Oracle: **Create a VM instance**.
2. Nombre: `kair-firma-prod`
3. Imagen: **Ubuntu 22.04** (o 24.04)
4. Shape: **VM.Standard.E2.1.Micro** (Always Free, 1 GB RAM, suficiente para
   1–30 firmas/día) — en algunas regiones puedes pedir la **Ampere A1
   (hasta 4 CPU / 24 GB)**, también Always Free; si está disponible, tómala.
5. Networking: crear VCN nueva con **IP pública IPv4 asignada**. Anota la IP.
6. SSH key: deja que Oracle genere el par y **descarga la llave privada** (.key).
7. Create → espera ~1 min a que quede en estado **Running**.

## Paso 2 — Dominio gratis sin comprar (elige UNO)

### Opción A (inmediata): sslip.io — sin registro, sin aprobación
Con la IP pública de la VM `W.X.Y.Z` tu dominio es:

```
firma.W-X-Y-Z.sslip.io     (ej: firma.152-67-33-10.sslip.io)
```

Eso es todo. sslip.io resuelve ese hostname a tu IP automáticamente.
**Cero configuración**. Funciona con HTTPS de Let's Encrypt.

### Opción B (más bonita, tarda días): eu.org
1. Solicita en https://nic.eu.org el subdominio que prefieras (ej. `kair-firma.eu.org`).
2. Apunta un registro A a la IP de la VM.
3. Aprobación manual (días/semanas). Mientras tanto puedes operar con sslip.io
   y cambiar después (cambiar dominio requiere re-enviar invitaciones).

## Paso 3 — Conectarte a la VM por SSH (desde tu PC Windows)

```powershell
ssh -i C:\ruta\a\tu\llave.key ubuntu@W.X.Y.Z
```

## Paso 4 — Preparación base de la VM (script incluido)

```bash
# Dentro de la VM
nano setup-vm.sh    # pega el contenido de deploy/setup-vm.sh
chmod +x setup-vm.sh
./setup-vm.sh
```

Instala Node 20, Caddy, sqlite3; crea usuario y carpetas; configura firewall.

## Paso 5 — Subir el código del servicio

Desde tu PC (PowerShell), empaqueta **solo lo necesario** (sin node_modules,
sin data de desarrollo, sin carpetas storage-* de pruebas):

```powershell
# En sgsst-electron-app/
$src = "firma-service"
$dst = "$env:TEMP\kair-firma-prod.zip"
Compress-Archive -Path `
  $src\src, $src\web, $src\package.json, $src\package-lock.json `
  -DestinationPath $dst -Force
scp -i C:\ruta\a\tu\llave.key $dst ubuntu@W.X.Y.Z:/tmp/
```

En la VM:

```bash
sudo mkdir -p /opt/kair-firma/app
cd /opt/kair-firma/app
sudo apt-get install -y unzip   # si hace falta
sudo unzip /tmp/kair-firma-prod.zip
sudo chown -R kairfirma:kairfirma /opt/kair-firma
```

## Paso 6 — Configurar producción (.env)

```bash
sudo nano /opt/kair-firma/.env
```

Pega el contenido de `deploy/.env.production.example` y completa:

- `PUBLIC_URL=https://firma.W-X-Y-Z.sslip.io` (tu dominio real)
- `PUBLIC_URL_FIRMA=` igual al anterior
- `INTERNAL_API_KEY`: genera una NUEVA (no la de desarrollo):
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- `ADMIN_API_KEY`: otra NUEVA distinta (guárdala en tu gestor de contraseñas;
  la necesitas para crear clientes por empresa).
- `SMTP_PASS`: el App Password de Gmail que ya usas en desarrollo.

## Paso 7 — Dependencias + servicio + HTTPS

```bash
# Dependencias (solo producción, compila better-sqlite3)
cd /opt/kair-firma/app
sudo -u kairfirma npm ci --omit=dev

# Base de datos productiva NUEVA (vacía; las migraciones corren al arrancar)
# No se copia la BD de desarrollo: producción arranca limpia.

# Servicio
sudo cp /opt/kair-firma/app/deploy 2>/dev/null  # (si subiste todo el repo, ajusta)
# Copia los archivos del kit (están en el zip si incluiste la carpeta deploy/;
# si no, créalos con nano pegando el contenido):
sudo cp .../deploy/kair-firma.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now kair-firma
sudo systemctl status kair-firma   # debe decir active (running)

# HTTPS (Caddy)
sudo cp .../deploy/Caddyfile /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile   # reemplaza CAMBIAR-ME.sslip.io por tu dominio
sudo systemctl reload caddy
```

## Paso 8 — Verificación (desde internet, no desde la VM)

1. Salud del servicio: abre en tu navegador `https://tu-dominio/sslip.io/health`
   → debe responder JSON `{ "status": "ok" ... }`.
2. Abre `https://tu-dominio/health` desde tu **celular** (datos, no Wi-Fi).
3. Prueba end-to-end: en K+AIR, actualiza la URL del servicio de firma a la
   nueva URL pública (Configuración → Firma Electrónica), crea el cliente
   per-empresa con la `ADMIN_API_KEY` nueva, y envía una invitación de prueba
   a un correo tuyo. Ábrela desde el celular, firma, descarga la constancia:
   la trazabilidad ahora debe mostrar **la IP pública real de tu celular**.

## Paso 9 — Backups (cron diario)

```bash
sudo cp .../deploy/backup-firma.sh /opt/kair-firma/backup-firma.sh
sudo chmod +x /opt/kair-firma/backup-firma.sh
echo "17 3 * * * root /opt/kair-firma/backup-firma.sh" | sudo tee /etc/cron.d/kair-firma-backup
```

Verifica: `sudo /opt/kair-firma/backup-firma.sh` y mira `/opt/kair-firma/backups/`.

(Opcional) rclone `gdrive` para copiar off-site — instrucciones en el propio script.

---

## Operación día a día (lo mínimo para que no se rompa nada)

| Tarea | Comando |
|---|---|
| Ver logs en vivo | `sudo journalctl -u kair-firma -f` |
| Reiniciar servicio | `sudo systemctl restart kair-firma` |
| Estado | `sudo systemctl status kair-firma` |
| Renovar (no requiere) | Caddy renueva SSL sólo; systemd reinicia solo |
| Saber espacio | `df -h` (Todo es texto/PDF, pesa MB) |

## Reglas doradas de producción

1. **El .env de producción NUNCA entra a git** ni a tu PC; vive solo en la VM.
2. **No copies la BD de desarrollo a producción.** Las firmas de prueba
   (Test E2E...) no deben mezclarse con evidencia legal real.
3. Cambiar de dominio después = enviar invitaciones nuevas (los enlaces
   enviados quedan "horneados" con el dominio viejo).
4. Si la VM muere: levantas otra, restauras el último backup y sigues —
   por eso el cron diario.
