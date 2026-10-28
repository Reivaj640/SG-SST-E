# Despliegue a producción — K+AIR Firma Electrónica (guía histórica, NO vigente)

> 🔴 **Esta guía NO describe el despliegue actual.** Habla de una VM de Oracle Cloud con Caddy y un
> dominio `sslip.io`. **Ninguna de las tres cosas se usó**: el servidor es `kair-server` (Ubuntu
> Server 24.04.5 en la red local, detrás de NAT), el proxy es un túnel nombrado de Cloudflare y el
> dominio es propio (`kair.fyi`). El despliegue real quedó documentado en
> [`docs/MIGRACION-SERVIDOR-FIRMA.md`](../../docs/MIGRACION-SERVIDOR-FIRMA.md), que es el documento
> que hay que seguir.
>
> Se conserva porque sigue siendo útil para un escenario distinto: el día que se quiera una **IP
> publica propia sin depender de Cloudflare**, los pasos de abajo (crear la VM, instalar Node,
> usuario sin privilegios, systemd, backups) son válidos. Solo cambian el proxy y el dominio.

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

## Paso 9 — Backups CIFRADOS (cron diario a las 22:00), restauracion, purga y vigilancia

```bash
sudo cp .../deploy/backup-firma.sh /opt/kair-firma/backup-firma.sh
sudo cp .../deploy/probar-restauracion.sh /opt/kair-firma/probar-restauracion.sh
sudo cp .../deploy/purgar-respaldos.sh /opt/kair-firma/purgar-respaldos.sh
sudo cp .../deploy/health-check.sh /opt/kair-firma/health-check.sh
sudo chmod +x /opt/kair-firma/backup-firma.sh /opt/kair-firma/probar-restauracion.sh /opt/kair-firma/purgar-respaldos.sh /opt/kair-firma/health-check.sh
sudo mkdir -p /opt/kair-firma/logs
echo "0 22 * * * root /opt/kair-firma/backup-firma.sh >> /opt/kair-firma/backups/backup.log 2>&1" | sudo tee /etc/cron.d/kair-firma-backup
echo "*/5 * * * * root /opt/kair-firma/health-check.sh >> /opt/kair-firma/logs/health-check.log 2>&1" | sudo tee /etc/cron.d/kair-firma-health
echo "0 4 1 * * root /opt/kair-firma/probar-restauracion.sh >> /opt/kair-firma/backups/restauracion.log 2>&1" | sudo tee /etc/cron.d/kair-firma-restauracion
echo "0 3 * * * root /opt/kair-firma/purgar-respaldos.sh >> /opt/kair-firma/backups/purga.log 2>&1" | sudo tee /etc/cron.d/kair-firma-purga
```

El cron usa la hora local del servidor. **El servidor debe estar en
America/Bogota**: con `Etc/UTC` el respaldo de las 22:00 cae a las 17:00 de
Colombia, los plazos en dias habiles se cuentan con el dia UTC y la constancia
PDF imprime la hora de UTC. Corrigelo con `sudo timedatectl set-timezone
America/Bogota` y verifica con `timedatectl` que diga `America/Bogota
(UTC-05:00)`.

### 9.1 La frase (el secreto de los respaldos)

Los respaldos se guardan **cifrados**. El secreto es UN archivo, en el
servidor, y el owner guarda una copia de ese mismo secreto **fuera** del
servidor:

```bash
# 1. La frase se crea UNA vez, a proposito. Ningun script la crea ni la regenera.
sudo install -m 600 -o root -g root /dev/null /opt/kair-firma/backup.passphrase
sudo sh -c 'openssl rand -base64 48 > /opt/kair-firma/backup.passphrase'

# 2. Verificar que quedo bien:
sudo ls -l /opt/kair-firma/backup.passphrase     # 600, root, root
```

🔴 **El owner DEBE guardar una copia de esa frase fuera del servidor** (una
gestión de contraseñas, un sobre sellado, lo que sea). Si el servidor se pierde
y no hay copia, **los respaldos son ilegibles**: no hay recuperación posible.
La copia off-site (rclone) lleva los archivos **cifrados** y **nunca** la frase
— si la frase sube a la nube, quien tenga la nube puede descifrar los
respaldos y la copia off-site deja de ser una salvaguarda.

Si el archivo de frase no existe, no se puede leer o está vacío,
`backup-firma.sh` **aborta**: nunca se escribe un respaldo en claro "por si
acaso".

### 9.2 Qué cifrado se usa

Los tres scripts detectan la herramienta en este orden y usan la primera que
exista:

| Herramienta | Cómo cifra | Nota |
|---|---|---|
| `gpg` | simétrico, `--cipher-algo AES256`, `--batch --passphrase-file` | **Autenticado** (MDC). El recomendado: `sudo apt install gnupg` |
| `openssl` | `enc -aes-256-cbc -pbkdf2 -pass file:` | Última instancia: cifra pero **no autentica**; el log avisa |
| ninguna | — | El script **aborta** (fail closed) |

**Por qué no `age`:** `age -p/--passphrase` lee la frase **siempre del
terminal** (en `age` 1.3.2 no existe `--passphrase-file`), así que no
sirve desde un cron sin TTY. El modo asimétrico de `age` (`age-keygen`) sí es
no interactivo, pero usa un par de llaves y no una frase: no es el modelo de
"una frase" que este respaldo asume.

### 9.3 Verificar

```bash
sudo /opt/kair-firma/backup-firma.sh          # respaldo manual (cifrado)
sudo /opt/kair-firma/probar-restauracion.sh   # prueba de restauracion
sudo /opt/kair-firma/purgar-respaldos.sh       # purga a nivel de registro
sudo /opt/kair-firma/health-check.sh          # vigilancia
```

En `$BACKUPS` solo hay archivos `.enc`: `firma-<marca>.sqlite.enc` y
`storage-<marca>.tar.gz.enc`. **Ninguna copia queda en claro.**

### 9.4 Restaurar a mano (el comando exacto)

La prueba de restauración (`probar-restauracion.sh`) descifra el último
respaldo en un temporal privado, comprueba su integridad y sus tablas, y borra
el temporal al terminar (`trap`): nunca deja datos personales tirados en
`/tmp`. Para restaurar a mano:

```bash
# con gpg (el recomendado):
sudo gpg --batch --yes --pinentry-mode loopback \
  --passphrase-file /opt/kair-firma/backup.passphrase \
  --output /tmp/firma-restaurada.sqlite \
  /opt/kair-firma/backups/firma-<marca>.sqlite.enc

# con openssl:
sudo openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 \
  -pass file:/opt/kair-firma/backup.passphrase \
  -in /opt/kair-firma/backups/firma-<marca>.sqlite.enc \
  -out /tmp/firma-restaurada.sqlite

# verificar antes de usarlo:
sqlite3 /tmp/firma-restaurada.sqlite "PRAGMA integrity_check;"
```

`probar-restauracion.sh` imprime en el log el comando exacto que corresponde a
la herramienta instalada.

El tercer cron (día 1 de cada mes a las 04:00 UTC = 23:00 de Colombia) corre
la prueba de restauracion: es lo que hace verdadera la frase del Anexo de
Nube "se verifica mensualmente que el respaldo se restaura correctamente".

### 9.5 La purga de los respaldos (lo que cumple el numeral 8.7)

El numeral 8.7 del Acuerdo promete que **la supresión alcanza a los
respaldos**. Borrar el archivo de respaldo a los 30 días NO lo cumple: el dato
suprimido hoy sigue en el respaldo de ayer.

`purgar-respaldos.sh` aplica la supresión **a nivel de registro** sobre cada
copia que sigue existiendo:

- descifra la copia a un temporal privado (con `trap`, se borra siempre);
- borra la fila de la firma y sus filas hijas **dentro de la copia** de la base
  de datos, y saca el PDF del tarball de `storage/`;
- **re-cifra y reemplaza el archivo de forma atómica** (escribe al lado y
  renombra con `mv`), dejando el hash del resultado en el log;
- si una copia no se puede descifrar o no abre, la **reporta y no la borra**: un
  respaldo ilegible se reporta, no se descarta en silencio.

Corre **todos los días a las 03:00** (antes del respaldo de las 22:00). La
lista de lo suprimido la deja el servicio en la tabla
`gh_firma_purgas_pendientes` (migración `046`), dentro de la misma transacción
en que borra la fila de la firma. **La migración 046 tiene que estar aplicada
en el servidor** (`npm run migrate`) antes de que este cron haga nada útil.

🔴 **El hold manda.** Si una firma tiene un deber legal de conservación
(`hold_legal = 1`), **no se suprime**: la presencia de ese dato en los
respaldos es **obligatoria**, no una violación. El script lo comprueba en cada
copia antes de tocar nada y lo deja escrito en el log.

### 9.6 Retención: de COPIAS, no de registros

La poda de 30 días del `backup-firma.sh` es la **retención de las COPIAS de
respaldo**. **No es** el plazo de conservación de los registros: ese plazo lo
declaró la Empresa y vive en `gh_firmas_electronicas.fecha_conservacion`, y el
deber legal de conservación (hold) vive en `gh_firmas_electronicas.hold_legal`.

Por eso la poda **no borra ninguna copia mientras exista un hold vigente**: es
la decisión conservadora (acumular copias antes que borrar una copia con un
dato que hay que conservar). Cuando el hold se levanta, la poda vuelve.

Un respaldo que nunca se ha restaurado no es un respaldo: por eso la prueba
de restauracion va en el mismo paso que el cron.

(Opcional) rclone `gdrive` para copiar off-site — instrucciones en el propio
script. La copia off-site lleva los archivos **cifrados** y **nunca** la frase.

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
