# Despliegue del servidor de firmas — `kair-server` + Cloudflare Tunnel

> **Estado: EN PRODUCCION desde el 2026-10-15.** `https://firma.kair.fyi` responde desde el
> servidor `kair-server`. El servicio ya **no depende de ningun portatil**: sobrevive reinicios
> y funciona aunque todas las maquinas de trabajo esten apagadas.
>
> Este documento reemplaza la guia anterior de "migrar a un portatil dedicado". Esa ruta ya no
> aplica: el servidor es Ubuntu, no Windows, y el dominio es propio, no un quick tunnel.

---

## 1. Arquitectura real

```
Celular del firmante (internet)
        |  HTTPS (certificado de Cloudflare)
        v
  Cloudflare (firma.kair.fyi)
        |  tunnel con nombre: kair-firma
        v
  cloudflared  (en kair-server)
        |  http 127.0.0.1:3001
        v
  firma-service (Node 20 + SQLite, usuario kairfirma sin privilegios)
        |
        v
  /opt/kair-firma/data + /opt/kair-firma/storage/pdfs
```

No hay Caddy, ni puertos 80/443 abiertos, ni IP publica en el servicio. El servidor esta **detras
de NAT** (interfaz Wi-Fi `wlp2s0`, IP de red `192.168.1.11/24`); el tunnel es lo unico que sale
hacia internet, y por eso HTTPS funciona sin abrir nada.

### Inventario del servidor

| | |
|---|---|
| Sistema | Ubuntu Server 24.04.5 LTS, x86_64, systemd 255 |
| CPU / RAM / disco | 2 vCPU, 3.5 GiB, 93 GB libres |
| Node / npm | v20.20.2 / 10.8.2 |
| cloudflared | 2026.10.1 (paquete de Cloudflare) |
| Usuario de servicio | `kairfirma` (uid 995) |
| Túnel | `kair-firma`, UUID `f4559956-21f0-4562-a31b-86e3fa7a6544` |

---

## 2. Rutas en el servidor

```
/opt/kair-firma/.env              configuracion real (permisos 600)
/opt/kair-firma/app               codigo (src, web, deploy, scripts, package*.json)
/opt/kair-firma/data/             firma.sqlite + WAL
/opt/kair-firma/storage/pdfs/     evidencia: originales, firmados, constancias
/opt/kair-firma/backups/          copias de la BD
/opt/kair-firma/internal-key.txt  INTERNAL_API_KEY
/opt/kair-firma/admin-key.txt     ADMIN_API_KEY

/etc/cloudflared/token            token del conector (permisos 600)
/etc/cloudflared/config.yml       ingress del tunnel  <-- NO OLVIDAR
/etc/systemd/system/kair-firma.service
/etc/systemd/system/cloudflared.service
```

---

## 3. El `.env` de produccion

Vive **solo en el servidor**. Nunca entra a git ni a ningun portatil.

```ini
PUBLIC_URL=https://firma.kair.fyi
PUBLIC_URL_FIRMA=https://firma.kair.fyi
HOST=127.0.0.1                 # agregado en pack 901; no abrir a la red
PORT=3001
INTERNAL_API_KEY=<64 hex>      # nuevo, generado para produccion
ADMIN_API_KEY=<64 hex>         # nuevo, distinto del internal
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<cuenta gmail que envia>
SMTP_PASS=<app password de 16 caracteres, SIN ESPACIOS>
SMTP_FROM_NAME=K+AIR
SMTP_FROM_EMAIL=<mismo que SMTP_USER>
FIRMA_CANAL_PROTECCION_DATOS=privacidad.kair@gmail.com
```

**El canal de proteccion de datos tiene que ser UNO solo.** `src/config.js` lo lee de
`FIRMA_CANAL_PROTECCION_DATOS` y el manifiesto `legal-readiness.json` lo declara en
`encargado.canal_proteccion_datos`. Si los dos no dicen lo mismo, el readiness marca
el item `canal_datos` como FALLA, y el texto legal le estaria prometiendo al Titular
un buzon distinto del que el sistema usa de verdad. Cambiarlo en el `.env` **exige
reiniciar el servicio**: la configuracion se lee al arrancar, no en caliente.

Generar llaves nuevas:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 4. El tunnel

### `config.yml` — la pieza que mas confunde

```yaml
ingress:
  - hostname: firma.kair.fyi
    service: http://127.0.0.1:3001
  - service: http_status:404
```

Sin este archivo el tunnel **conecta y no entrega nada**. El sintoma es desconcertante: el panel
muestra "Buen estado", una replica activa, `systemctl` dice `active`, y `curl` a la URL publica
devuelve cuerpo vacio. Es porque un tunnel **locally-managed** guarda sus rutas en el config local
del servidor, no en Cloudflare. La entrada `service: http_status:404` es obligatoria: cloudflared
exige un catch-all al final.

### Token

El token es base64 de `{"a": <account tag>, "t": <uuid del tunnel>, "s": <secret>}`.

**Un token valido mide 180 bytes si el secret es de 32 bytes, y 249 si el secret es de 72.** En
todos los casos, **su largo en base64 es siempre multiplo de 4**. Si el archivo da un numero que no
es multiplo de 4, esta truncado:

```bash
sudo wc -c /etc/cloudflared/token          # esperado: multiplo de 4 (+1 si hay salto final)
sudo head -c 8 /etc/cloudflared/token; echo   # esperado: eyJhIjoi
sudo awk '{ print NR": "length($0)" caracteres" }' /etc/cloudflared/token
```

Escribirlo sin nano y sin `read`:

```bash
sudo nano /etc/cloudflared/token    # pegar, luego Ctrl+X, y, Enter
sudo chmod 600 /etc/cloudflared/token
```

> **No pegues bloques de varias lineas de una.** El `read -rs` de bash se come la linea siguiente del
> bloque como si fuera la entrada del usuario, y el archivo termina conteniendo un comando de bash.

### Rotar el secret

El boton *Rotar token* del panel **si** genera un secret nuevo, pero hay que **recargar con
`Ctrl+Shift+R`** y a veces salir y volver a entrar al tunnel: la UI keeps showing el comando viejo en
el DOM cacheado. Y ojo con el aviso del panel: rotar **invalida el token de todas las replicas**, asi
que hay que reescribir `/etc/cloudflared/token` y reiniciar `cloudflared` en cada una.

---

## 5. Operacion diaria

```bash
sudo systemctl status kair-firma
sudo systemctl status cloudflared
sudo journalctl -u kair-firma -f
sudo journalctl -u cloudflared -f
curl -sS https://firma.kair.fyi/health
```

Reiniciar el servicio de firmas despues de tocar el `.env`:

```bash
sudo systemctl restart kair-firma
```

### Probar SMTP sin gastar una firma

`GET /health` **no prueba el correo**. En `src/routes/health.js` el check marca `ok` solo si la
variable existe; no abre conexion ni autentica. Para probar de verdad:

```bash
set +H    # desactiva history expansion: si no, un "!" en el script rompe la linea

sudo node -e "
const fs=require('fs');const env={};
fs.readFileSync('/opt/kair-firma/.env','utf8').split(/\r?\n/).forEach(l=>{const i=l.indexOf('=');if(i>0 && l.trim().charAt(0) !== '#') env[l.slice(0,i).trim()]=l.slice(i+1).trim();});
console.log('host='+env.SMTP_HOST+' user='+env.SMTP_USER+' passLen='+(env.SMTP_PASS||'').length);
const n=require('nodemailer');
n.createTransport({host:env.SMTP_HOST,port:Number(env.SMTP_PORT)||587,secure:String(env.SMTP_SECURE)==='true',auth:{user:env.SMTP_USER,pass:env.SMTP_PASS}}).verify().then(function(){console.log('SMTP OK');}).catch(function(e){console.log('SMTP FAIL: '+e.message);process.exit(1);});
"
```

`passLen` debe dar 16. Los App Password de Google vienen en grupos de cuatro separados por
espacios; **el servicio espera los 16 caracteres corridos**.

---

## 5.1 Desplegar una versión nueva (el ORDEN importa)

> El 2026-10-21 el servicio llevaba horas desplegando el código equivocado sin que
> nadie lo notara: el alta daba 201, el correo salía, el Acuerdo estaba bien... y
> **ningún enlace resolvía** (404 `TOKEN_NOT_FOUND`). El proceso que servía no
> era el del código copiado.

El orden que no se negocia:

```bash
# 1. Parar el servicio (que no atienda con el codigo viejo)
sudo systemctl stop kair-firma

# 2. Copiar el codigo nuevo. OJO: el tar lleva app/ y legal/ en la raiz,
#    y se extrae en /opt/kair-firma (NO en /opt/kair-firma/app):
#    - app/   -> /opt/kair-firma/app    (el service)
#    - legal/ -> /opt/kair-firma/legal  (lo que el readiness lee: REPO_ROOT/legal)
sudo tar -xzf /tmp/kair-deploy.tar.gz -C /opt/kair-firma
sudo chown -R kairfirma:kairfirma /opt/kair-firma/app /opt/kair-firma/legal

# 3. VERIFICAR el hash de lo que quedo en disco (no del repo, no del tar)
sha256sum /opt/kair-firma/app/src/crypto/token.js
sha256sum /opt/kair-firma/app/src/services/signRequest.js

# 4. LAS MIGRACIONES, con el servicio parado y ANTES de arrancar.
#    OJO: con el .env cargado. El .env real esta en /opt/kair-firma/.env y
#    src/config.js lo busca con dotenv en /opt/kair-firma/app/.env, que NO
#    existe: sin las variables, DB_PATH cae al default ./data/firma.sqlite,
#    resuelve a /opt/kair-firma/app/data/firma.sqlite (un directorio que no
#    esta) y SQLite revienta al abrir la base DENTRO del require. El error
#    sale con el stack terminando en Module._compile y no dice nada de la base.
#    (Pasa el 26-oct-2026 con el despliegue del 📦954.)
sudo -u kairfirma bash -c 'set -a; . /opt/kair-firma/.env; set +a; cd /opt/kair-firma/app && node src/db/migrate.js' 2>&1 | tail -20

# 5. Arrancar: el proceso nuevo carga lo que esta en disco
sudo systemctl start kair-firma
sleep 3
systemctl is-active kair-firma

# 6. VERIFICAR que el proceso que corre es el nuevo
sudo systemctl show -p MainPID -p ActiveEnterTimestamp kair-firma
curl -sS https://firma.kair.fyi/health
```

El paso 4 esta aparte a proposito. `src/server.js` llama a `migrate()` al arrancar:
si una migracion falla, el proceso sale con codigo 1 y el servicio **no vuelve**
(el systemd lo reintenta en bucle). Corriendolas a mano con el servicio parado, el
error se ve **antes** de que el servicio lo encuentre solo.

> **La ventana de caida se mide en segundos, no en minutos.** El 24-oct-2026 el servicio
> quedo **caido** (502 de Cloudflare) por un tiempo largo: el despliegue se hizo en pasos
> sueltos y se **pauso a la espera de una validacion** entre "parar" y "arrancar". La
> regla: **todo el ciclo parar → extraer → verificar → migrar → arrancar se pega de corrido,
> sin pausa y sin esperar a nadie.** Si hay que validar algo, se valida **antes** de parar
> (el hash del tar se compara con el servicio todavia arriba) o **despues** de arrancar.
> Un despliegue no se deja a medio camino: si el servicio esta parado, se levanta, aunque
> sea con el codigo viejo.
>
> **Un comando a la vez: no se pega un bloque.** La terminal de Cockpit (`xterm.js`) ejecuta
> lo pegado linea por linea y con bloques largos la entrada se enreda: el 24-oct-2026 un
> `journalctl` pegado en la terminal hizo que bash intentara ejecutar `oct 24 19:01:48 ...`
> (40 veces "command not found") y el bloque de despliegue quedo a medias, con el servicio
> parado. Los comandos van **de uno en uno**, con su salida leida antes del siguiente, y
> **la salida se copia al chat, no a la terminal**.

El paso 6 es el que falto. `uptime_seconds` tiene que ser **chico** (unos
segundos): si el proceso lleva horas arriba, no es el que se acaba de instalar,
por mas que los hashes del disco esten bien.

### Empaquetar en Windows: el separador de rutas del zip (trampa del 2026-10-22)

`Compress-Archive` de PowerShell 5.1 escribe las rutas **con `\`**
(`src\server.js`). En Linux ese `\` **no es un separador: es parte del
nombre del archivo**. La extracción "funciona" sin un solo error y deja
archivos planos llamados `src\server.js`: el código nuevo nunca aparece donde
el servicio lo busca. Pasó en el despliegue del 2026-10-22 — el servicio se
reinició, la migración dijo "No hay migraciones pendientes, total: 31" y el
archivo que se acababa de "instalar" `ls` lo daba como inexistente.

Dos formas de evitarlo:

**1. Empaquetar desde el COMMIT con `git archive`** (la que se usa hoy):

El paquete tiene que salir del **commit**, no del working tree: lo que corre en
produccion tiene que ser lo mismo que esta en el repo, con la misma huella.

```powershell
# EN EL PC, desde la RAIZ DEL REPO (no desde firma-service/):
$repo = 'C:\Proyectos Programación\SG-SST-E'
$svc  = 'sgsst-electron-app/firma-service'
$stage = "$env:TEMP\kair-deploy-stage"
New-Item -ItemType Directory -Force -Path "$env:TEMP\kair-deploy" | Out-Null
New-Item -ItemType Directory -Force -Path "$stage\app" | Out-Null

# 1. El service, desde el commit
cd $repo
git archive --format=tar.gz --output="$env:TEMP\kair-deploy\svc.tar.gz" HEAD `
  "$svc/src" "$svc/web" "$svc/scripts" "$svc/package.json" "$svc/package-lock.json" "$svc/legal-readiness.json"
tar -xzf "$env:TEMP\kair-deploy\svc.tar.gz" -C "$stage\app" --strip-components=2

# 2. Los documentos legales que el readiness lee
#    (solo los del servicio en la nube: el Anexo de Nube y el Anexo de Encargo)
git archive --format=tar.gz --output="$env:TEMP\kair-deploy\legal.tar.gz" HEAD `
  'sgsst-electron-app/legal/anexo-nube-v1.0.html' 'sgsst-electron-app/legal/anexo-encargo.html'
tar -xzf "$env:TEMP\kair-deploy\legal.tar.gz" -C $stage --strip-components=1

# 3. El tar final, con la forma que el servidor espera
tar -czf "$env:TEMP\kair-deploy\kair-deploy.tar.gz" -C $stage app legal
Get-FileHash "$env:TEMP\kair-deploy\kair-deploy.tar.gz" -Algorithm SHA256
```

**Por qué el tar lleva `app/` y `legal/` y no solo el service.** `readinessLegal.js`
calcula `REPO_ROOT` como **un nivel arriba** del directorio del service
(`path.resolve(SERVICE_ROOT, '..')`) y de ahí lee los documentos: en el PC son
`sgsst-electron-app/legal/*.html` y en el servidor `/opt/kair-firma/legal/*.html`,
**hermanos** de `app/`, no hijos. Si el paquete no los lleva, el readiness lee un
archivo que no existe y reporta huecos que son puro artefacto del empaquetado: se
midió que decía "Faltan cláusulas: Remisión al Anexo de Nube; Sustitución del Anexo
anterior o cláusula de otrosí; Art. 2.2.4.6.13; Veinte (20) años; Servicio en
nube / firma-service" —cinco cláusulas que **no faltaban**. Por eso el comando de
extractción va en `/opt/kair-firma` y no en `/opt/kair-firma/app`.

`git archive` sigue resolviendo lo de siempre: entra **solo lo commiteado** —el
texto armado de la v1.1 esta en `.gitignore` hasta que lo apruebe el abogado, y
este metodo no lo sube— y el manifiesto `legal-readiness.json` viaja en la raiz de
la app, que es donde el readiness lo busca.

**Subirlo: el puente HTTP.** El `kair-server` no acepta SSH desde el portatil
(`Permission denied`): el transporte es un servidor HTTP en el PC y un `curl` en el
servidor.

```powershell
# EN EL PC (dejar corriendo en otra terminal)
python -m http.server 8765 --bind 0.0.0.0 --directory "$env:TEMP\kair-deploy"
```

```bash
# EN EL SERVIDOR
curl -sS -o /tmp/kair-deploy.tar.gz http://192.168.1.2:8765/kair-deploy.tar.gz
sha256sum /tmp/kair-deploy.tar.gz     # el MISMO hash que dio Get-FileHash (en minusculas)
```

Si los dos hashes no coinciden, **el paquete no viaja**: se vuelve a bajar.

**2. Extraer normalizando el separador** (si el zip ya se subió, o si el
servidor no tiene `unzip` — Ubuntu mínimo no lo trae):

```bash
sudo python3 - <<'PY'
import os, zipfile
dst = '/opt/kair-firma/app'
z = zipfile.ZipFile('/tmp/kair-deploy.zip')
for name in z.namelist():
    rel = name.replace('\\', '/')
    target = os.path.join(dst, rel)
    if rel.endswith('/'):
        os.makedirs(target, exist_ok=True); continue
    os.makedirs(os.path.dirname(target), exist_ok=True)
    with z.open(name) as f, open(target, 'wb') as out:
        out.write(f.read())
print('archivos escritos')
PY
sudo chown -R kairfirma:kairfirma /opt/kair-firma
```

**La verificación que lo habría atrapado en 10 segundos** — hacerla SIEMPRE
después de copiar y ANTES de arrancar:

```bash
ls -l /opt/kair-firma/app/src/server.js
ls -l /opt/kair-firma/app/src/db/schema/033_retencion_por_documento.sql
grep -c categoria_retencion /opt/kair-firma/app/src/schemas/index.js

# Y los documentos legales, que viven UN NIVEL ARRIBA de la app:
ls -l /opt/kair-firma/legal/anexo-nube-v1.0.html
ls -l /opt/kair-firma/legal/anexo-encargo.html
```

Si el archivo que se acaba de desplegar no aparece ahí, **el despliegue no
ocurrió**: reiniciar el servicio solo pone en marcha el código viejo otra vez.

### Lo que NO es prueba

| Lo que se comprobó | Por qué no sirve |
|---|---|
| El hash del archivo **en disco** | El proceso puede tener en memoria otro código (copia después del arranque, despliegue a medias) |
| El **mtime** de los archivos | `tar` conserva las fechas originales: un archivo copiado hoy puede marcar la fecha de hace semanas |
| `GET /health` | `kair_version` es un valor fijo en `src/routes/health.js`: no dice qué código corre |
| Que el alta dé **201** | El alta es de una fila, no del enlace que el firmante va a abrir |

### La prueba que sí sirve

La de humo, y en particular el paso **5c** (`scripts/smoke-produccion.js`):

```bash
sudo bash -c 'set -a; . /opt/kair-firma/.env; set +a; cd /opt/kair-firma/app && \
  node scripts/smoke-produccion.js --url=https://firma.kair.fyi \
  --interno-file=/opt/kair-firma/internal-key.txt --e2e --confirmar-e2e \
  --empresa=900829731 --trabajador=CC-PRUEBA-001 --numero-documento=PRUEBA-001 \
  --correo=adminkair@gmail.com'
```

El paso 5c **abre el enlace que el propio script acaba de crear** y exige que
resuelva. Sin esa comprobación, una corrida puede dar `RESULTADO: OK` con el
servicio entero roto: el correo salió y el firmante abre un 404.

Despues del despliegue, la fila que creo la prueba es rastro de prueba: se
retira con `scripts/limpiar-rastro-prueba.js --solo-firmas` (ver §5.2).

### Instalar UN archivo (scripts, sin tocar el resto)

```bash
# En el PC: servir el archivo por HTTP
# En el servidor:
curl -sS -o /tmp/smoke-produccion.js http://192.168.1.2:8765/smoke-produccion.js
sha256sum /tmp/smoke-produccion.js
sudo install -o kairfirma -g kairfirma -m 664 /tmp/smoke-produccion.js \
  /opt/kair-firma/app/scripts/smoke-produccion.js
sudo sha256sum /opt/kair-firma/app/scripts/smoke-produccion.js
```

El hash se comprueba **despues** de instalar, en el archivo final: "el comando
no dio error" no es prueba de que el archivo quedo donde debia.

### 5.1.1 El catálogo de retención por documento (migración 033)

> **2026-10-22.** La 033 agrega las cuatro columnas del catálogo de retención
> por tipo de documento. El plazo **no se le pregunta a nadie**: vive en el
> código, que aplica **80 años de custodia** desde la firma (cubre el mínimo de
> 20 años desde el cese de los cinco grupos del SG-SST, y el rango de 80 a 100
> años de la historia laboral), o el plazo de la tabla de la Empresa si declaró
> uno. El contrato electrónico queda con hold, sin término. Ver
> [API §6.13.6](gestion-humana/firma-electronica/API.md#6136-el-catálogo-de-retención-por-tipo-de-documento).

**¿Hay que aplicar la migración a mano? En el servidor, NO.** `src/server.js`
llama a `migrate()` en el arranque: al reiniciar el servicio, la 033 se aplica
sola. Para verla (que es la prueba), el paso es el mismo de siempre:

```bash
cd /opt/kair-firma/app
sudo -u kairfirma node src/db/migrate.js 2>&1 | tee /tmp/migrate.log
grep -c "Aplicando migración" /tmp/migrate.log     # 15 (019..033) en la primera vez
```

**Si el servicio corre LOCAL (desde el repo, `npm start`)**, no hay nada que
copiar: el código es el del repo y la migración se aplica al arrancar. Para
aplicarla sin arrancar:

```powershell
# En el repo (Windows): el .env define DB_PATH=./data/manual-8bc/firma.sqlite
cd sgsst-electron-app\firma-service
node src/db/migrate.js
node -e "const D=require('better-sqlite3');const db=new D(process.env.DB_PATH||'./data/manual-8bc/firma.sqlite',{readonly:true});console.log(db.prepare('PRAGMA table_info(gh_firmas_electronicas)').all().map(c=>c.name).filter(n=>n.includes('retencion')||n==='fecha_terminacion'))"
```

Lo que tiene que salir: `categoria_retencion`, `regla_retencion`,
`fecha_terminacion` y `plazo_retencion_aplicable`.

**La 033 es aditiva**: cuatro columnas y un índice. **No reescribe filas, no
hace backfill y no borra nada.** Las solicitudes anteriores quedan con las
cuatro columnas en `NULL` y siguen con el comportamiento de siempre (la tabla
de la Empresa con texto vivo).

**El orden importa**: el código nuevo escribe esas columnas. Si se arrancara
el servicio **sin** la 033, el alta de solicitudes fallaría por una columna
inexistente. Por eso: migraciones primero, servicio después.

**La prueba que sí sirve** (el script de humo ahora sabe verificar el
catálogo):

```bash
sudo bash -c 'set -a; . /opt/kair-firma/.env; set +a; cd /opt/kair-firma/app && \
  node scripts/smoke-produccion.js --url=https://firma.kair.fyi \
  --interno-file=/opt/kair-firma/internal-key.txt --e2e --confirmar-e2e \
  --empresa=900829731 --trabajador=CC-PRUEBA-001 --numero-documento=PRUEBA-001 \
  --correo=adminkair@gmail.com \
  --categoria-retencion=SST_CAPACITACION --fecha-terminacion=2026-01-15'
```

Sin `--categoria-retencion`, la solicitud de prueba va como legacy (tabla de la
Empresa). Con él, el script exige que la respuesta traiga la categoría **y** la
fecha de conservación ya calculada: es la prueba de que la 033 quedó aplicada
y de que la regla legal del documento está corriendo en el servidor.

> **Lo que la 033 cambia en la habilitación**: el **plazo de conservación ya
> no se le exige a la Empresa** (la custodia vive en el código). Siguen
> exigiéndose el **Anexo de Encargo firmado** y el **canal de atención**
> (`canal_pqrs`). Si la respuesta es `409 EMPRESA_NO_HABILITADA`, el detalle
> dice qué falta.

### 5.1.2 Las migraciones 037 a 041 (las etapas 1 a 5)

> **2026-10-23.** Estas **cinco** migraciones (037 a 041) **todavia no estan en el servidor**: el
> `kair-server` corre el codigo viejo (sin 034 a 041). Se aplican solas al
> arrancar el servicio (`src/server.js` llama a `migrate()`), pero el **orden**
> sigue siendo: migraciones primero, servicio despues.
>
> **2026-10-24. Corregido con el dato del servidor.** El arranque del 24-oct-2026 a las
> 19:01:48 UTC escribio `"No hay migraciones pendientes","total":40`: **las 40 migraciones
> estan aplicadas** en `kair-server` (el repositorio tiene 40 archivos `.sql`; el 015 no
> existe). Las que faltaban (028, 029, 035, 036 y 037 a 041) ya se aplicaron en los
> despliegues del 23 y del 24 de octubre. Lo que **si** falta, y no es una migracion, es el
> **Anexo de Nube**: la columna `anexo_nube_firmado_at` no la crea ninguna migracion (el
> codigo la lee de forma opcional y avisa `columna_anexo_nube: false`), porque todavia no
> existe el documento que la respaldaria.

Las migraciones **034 a 036** (custodia de 20 anos y la excepcion auditable de
habilitacion) estan documentadas en la **§5.5** mas abajo. Estas son las **nuevas**:

| Migracion | Que hace | Aditiva |
|---|---|---|
| 037 | La tabla del rastro auditable de la ficha de la Empresa | Si (tabla) |
| 038 | Los triggers append-only del rastro (se salta en test) | Si (triggers) |
| 039 | La copia permanente: `plazo_copia` y su indice | Si (columna + indice) |
| 040 | La lapida identifica la solicitud y el fundamento del plazo | Si (dos columnas) |
| 041 | El recibo de purgas identifica la solicitud y el fundamento del plazo | Si (dos columnas) |

**Ninguna reescribe filas, ninguna hace backfill y ninguna borra nada.** Lo que
ya esta escrito queda con las columnas nuevas en `NULL`, y el servicio lo dice
explicitamente en vez de inventar un valor.

**Como verlas aplicadas** (la prueba):

```bash
sudo journalctl -u kair-firma --since '-10 min' | grep -E '034_|035_|036_|037_|038_|039_|040_|041_'
```

O, sin depender del arranque:

```bash
cd /opt/kair-firma/app
sudo -u kairfirma node src/db/migrate.js 2>&1 | tee /tmp/migrate.log
grep "Aplicando migración" /tmp/migrate.log | tail -12
```

**Lo que hay que verificar despues de reiniciar**, y no antes:

```bash
# 1. El proceso nuevo (uptime_seconds chico)
curl -sS https://firma.kair.fyi/health

# 2. Las columnas nuevas de la lapida y del recibo
sudo -u kairfirma node -e "
const D=require('better-sqlite3');const db=new D('/opt/kair-firma/data/firma.sqlite',{readonly:true});
console.log('lapida:', db.prepare('PRAGMA table_info(gh_firma_purgadas)').all().map(c=>c.name).filter(n=>n.includes('solicitud')||n.includes('conservacion')));
console.log('recibo:', db.prepare('PRAGMA table_info(gh_firma_purga_registro)').all().map(c=>c.name).filter(n=>n.includes('solicitud')||n.includes('conservacion')));
"

# 3. La ruta nueva del recibo de supresion (no debe ser 404 de ruta)
sudo bash -c 'set -a; . /opt/kair-firma/.env; set +a; cd /opt/kair-firma/app && \
  curl -sS -o /dev/null -w '%{http_code}\\n' -H "X-Internal-API-Key: $(cat /opt/kair-firma/internal-key.txt)" \
  https://firma.kair.fyi/internal/empresas/900829731/recibos-supresion'
```

El paso 3 tiene que dar **200** (con `{"total":0,...}`) y **no** un 404 de
ruta: un 404 ahi significa que el router nuevo no esta montado.

#### La purga en dos capas (el arreglo del 2026-10-23)

> **El bug que se llevo por delante la supresion de datos.** El script
> `scripts/purga-ventana.js` corria la capa de auditoria, esa capa **cerraba la
> ventana de purga y vaciaba el lote**, y la capa de datos (la que borra el
> documento, la constancia y los archivos, y escribe la lapida) exigia ventana
> vigente: **nunca se ejecuto**. En el servidor hay 0 firmas, asi que no hay
> nada que purgar todavia, pero hay que corregirlo antes de la primera
> expiracion real.

Despues del despliegue, el guion de la purga es el que toca (no los servicios
sueltos):

```bash
# 1. SIMULAR primero: no borra nada y tiene que decir 0 firmas, 0 archivos
sudo bash -c 'set -a; . /opt/kair-firma/.env; set +a; cd /opt/kair-firma/app && \
  node scripts/purga-ventana.js --actor="Nombre" --motivo="Vencimiento del plazo declarado"'

# 2. Ejecutar, solo cuando la simulacion diga lo que se espera
sudo bash -c 'set -a; . /opt/kair-firma/.env; set +a; cd /opt/kair-firma/app && \
  node scripts/purga-ventana.js --actor="Nombre" --motivo="Vencimiento del plazo declarado" --ejecutar'
```

La simulacion ahora corre sobre las **mismas firmas** que el lote va a
contener. Antes decia "0 firmas, 0 archivos" y un segundo despues suprimia una
firma y tres archivos: si la simulacion dice 0 y la ejecucion dice 3, el
despliegue esta a medias.

**La salida que hay que leer:**

```
  filas suprimidas:       1
  archivos eliminados:    3
  bloqueadas por hold:    0
  la ventana quedó cerrada y el lote vacío
```

"filas suprimidas: 0" con "archivos eliminados: 0" y firmas elegibles
reportadas es el sintoma del bug viejo. Con el arreglo, las dos capas corren.

---

## 5.2 Retirar el rastro de prueba

```bash
# 1. Simular (no escribe nada)
sudo bash -c 'set -a; . /opt/kair-firma/.env; set +a; cd /opt/kair-firma/app && \
  node scripts/limpiar-rastro-prueba.js --actor="Nombre" --motivo="Rastro del e2e" \
  --hasta=2026-10-21 --solo-firmas'

# 2. Ejecutar
sudo bash -c 'set -a; . /opt/kair-firma/.env; set +a; cd /opt/kair-firma/app && \
  node scripts/limpiar-rastro-prueba.js --actor="Nombre" --motivo="Rastro del e2e" \
  --hasta=2026-10-21 --solo-firmas --ejecutar'
```

`--solo-firmas` borra las filas de prueba (firmas, eventos, sesiones, lotes,
tokens y archivos) y **NO toca ninguna version del Acuerdo**. El modo sin esa
bandera borra tambien la version, y se niega a hacerlo si esa version es el
texto legal sellado: por eso, cuando el legal ya esta publicado, la limpieza
va con `--solo-firmas`.

El recibo queda en `gh_firma_purga_log` y `gh_firma_purga_registro` (tablas
append-only), y la base se verifica con `integrity_check` al final.

### Cuando el hold bloquea la limpieza: `--forzar-hold`

El hold automático de una firma tiene **dos** orígenes, y conviene saber cuál de los dos se
disparó:

1. **La ficha de la Empresa**: si tiene `conservacion_por_deber_legal = 1` (migración 030), esa
   bandera le levanta el hold automático a toda firma de esa Empresa.
2. **La regla de retención**: si el documento se clasificó como `CONTRATO_TRABAJO` (que es lo que
   pasa cuando la solicitud llega con `tipo_identificacion: 'CONTRATO'` u `'OTROSI'`), la regla
   `CONTRATO_ELECTRONICO` le levanta el hold del **2.2.1.1.12**: el contrato electrónico se
   conserva **sin término**. Este es el hold más fuerte de todos.

En los dos casos el script se niega: "1 firma(s) tienen deber legal de conservación (hold)".

Para una fila de prueba que **nunca se firmó**, la salida es `--forzar-hold`:

```bash
# 1. Simular primero (no escribe nada): el plan dice qué fila y por qué
sudo bash -c 'set -a; . /opt/kair-firma/.env; set +a; cd /opt/kair-firma/app && \
  node scripts/limpiar-rastro-prueba.js --actor="Nombre" --motivo="Rastro del e2e" \
  --hasta=2026-10-24 --solo-firmas --forzar-hold'

# 2. Ejecutar (solo si la simulación dice "HOLD FORZADO" y nada más)
sudo bash -c 'set -a; . /opt/kair-firma/.env; set +a; cd /opt/kair-firma/app && \
  node scripts/limpiar-rastro-prueba.js --actor="Nombre" --motivo="Rastro del e2e" \
  --hasta=2026-10-24 --solo-firmas --forzar-hold --ejecutar'
```

**La válvula es angosta, a propósito.** Solo se fuerza una fila que cumple las
dos condiciones:

1. **Que nunca haya habido un acto**: no está en `SIGNED`, `DUAL_FIRMADO`,
   `REJECTED`, `REVOKED` ni `CANCELLED`, y no tiene documento firmado, hash de
   evidencia, constancia ni PDF firmado.
2. **Que el hold sea el automático**: el motivo es `deber_legal_*`, el actor es
   `sistema`, y no hay un hold vigente en `gh_firma_holds` declarado por una
   persona.

Si una sola fila del rango falla alguna de las dos, **no se borra nada** (código
4): o se limpia entero o no se limpia. Una firma que sí ocurrió conserva su hold
para siempre.

El forzamiento queda escrito en el recibo append-only, con quién lo hizo y por
qué (`HOLD FORZADO` en el motivo). El hold no se "libera" antes de borrar: la
fila desaparece dentro de la misma transacción que la borra, así que en ningún
momento queda una firma real sin su protección.

### El corte tiene que cubrir las firmas del dia anterior

El script **se niega a tocar nada** si hay firmas mas nuevas que el corte
(`--hasta`). Eso es lo que impide que una purga "de pruebas" se lleve por
delante una firma de verdad. Pero el corte se compara contra la fecha en
**UTC**: una firma creada el 21-oct a las 19:47 COT queda con fecha
`2026-10-22T00:47Z`, o sea **fuera** de `--hasta=2026-10-21`.

Por eso el corte del 2026-10-22 fue `--hasta=2026-10-22` (fin de hoy), no
`--hasta=2026-10-21`: las nueve filas de prueba del ensayo de los dias 21 y
22 estaban dentro.

---

## 5.3 El panel de firmas (ver sin escribir)

`scripts/panel-firmas.js` es un tablero de **solo lectura** del proceso de
firma. No escribe nada: abre la base con `better-sqlite3` en modo
`readonly: true` (si el motor no deja, cae a una conexion normal **avisando**),
y nunca imprime el `token_hash`, ni el pseudonimo completo del trabajador, ni
la `metadata` cruda de los eventos.

Tres vistas, navegables con las flechas y con `Esc` para volver:

| Vista | Que muestra |
|---|---|
| **Tablero general** | Todas las empresas con su resumen, y las firmas que NO estan en estado terminal (las que siguen vivas), con sus tokens y si alguien abrio el enlace |
| **Panel de empresa** | La ficha (Anexo, plazo, canal de PQRS, politica de datos) + el resumen de conteos + la tabla de firmas |
| **Detalle de firma** | Estado, tokens (VIVO / VENCIDO / REVOCADO), sesion, consentimiento y la **traza completa** de `gh_firma_eventos` |

```bash
# Instalar (un solo archivo)
curl -sS -o /tmp/panel-firmas.js http://192.168.1.2:8765/panel-firmas.js
sha256sum /tmp/panel-firmas.js
sudo install -o kairfirma -g kairfirma -m 664 /tmp/panel-firmas.js /opt/kair-firma/app/scripts/panel-firmas.js

# Correrlo (interactivo)
sudo bash -c 'set -a; . /opt/kair-firma/.env; set +a; cd /opt/kair-firma/app && node scripts/panel-firmas.js'

# O una sola vista, sin terminal (para pipelines y para pegar en un ticket)
sudo bash -c 'set -a; . /opt/kair-firma/.env; set +a; cd /opt/kair-firma/app && node scripts/panel-firmas.js --empresa=900829731'
sudo bash -c 'set -a; . /opt/kair-firma/.env; set +a; cd /opt/kair-firma/app && node scripts/panel-firmas.js --firma=6'
sudo bash -c 'set -a; . /opt/kair-firma/.env; set +a; cd /opt/kair-firma/app && node scripts/panel-firmas.js --json'
```

Solo necesita `DB_PATH` (del `.env`): **no pide ninguna llave**. El refresco
automático es cada 5 segundos (`--cada=N` lo cambia).

> **Trampa del teclado (2026-10-22).** `Esc` no funcionaba en la primera
> version: con `readline.emitKeypressEvents`, **una ESC sola no emite ningun
> `keypress`** (el parser espera a ver si lo que sigue es una secuencia ANSI).
> El script ahora decodifica los bytes por su cuenta. Ver la trampa #59 del
> `PROMPT.md` y la seccion del `BITACORA.md`.

---

## 5.4 Los PDF huerfanos (mover, nunca borrar)

`scripts/cleanup-orphan-pdfs.js` saca del arbol principal los PDF que **no
tienen firma en la base** (los `/opt/kair-firma/storage/pdfs/{originales,
firmados,constancias,papel}/`). **MUEVE, nunca borra**: cada archivo va a
`/opt/kair-firma/storage/pdf-archive/<fecha>/<mismo-arbol>/` y queda un
`manifest.json` con el SHA-256 de lo movido.

| Regla | Por que |
|---|---|
| El **dry-run no escribe nada** y se puede correr en produccion | Es la unica forma de *ver* que se moveria antes de moverlo. Un script que en produccion solo dice "no se puede" obliga a mover a ciegas |
| **Mover** exige `--yes` | Mover es escribir |
| La **lista de IDs** es la unica fuente de verdad | Un huerfano que no esta en la lista no se mueve |
| Si hay huerfanos **fuera** de la lista, el script los **nombra** | "Nada que mover" no puede significar "el storage esta limpio" |

```bash
# Instalar (un solo archivo)
curl -sS -o /tmp/cleanup-orphan-pdfs.js http://192.168.1.2:8765/cleanup-orphan-pdfs.js
sha256sum /tmp/cleanup-orphan-pdfs.js
sudo install -o kairfirma -g kairfirma -m 664 /tmp/cleanup-orphan-pdfs.js /opt/kair-firma/app/scripts/cleanup-orphan-pdfs.js

# Ver (no escribe nada)
sudo -u kairfirma bash -c 'set -a; . /opt/kair-firma/.env; set +a; cd /opt/kair-firma/app && node scripts/cleanup-orphan-pdfs.js --ids=SIGN-2026-020330'

# Mover
sudo -u kairfirma bash -c 'set -a; . /opt/kair-firma/.env; set +a; cd /opt/kair-firma/app && node scripts/cleanup-orphan-pdfs.js --ids=SIGN-2026-020330 --yes'

# Verificar
sudo -u kairfirma ls -lR /opt/kair-firma/storage/pdf-archive/
sudo -u kairfirma cat /opt/kair-firma/storage/pdf-archive/*/manifest.json
sudo -u kairfirma ls -l /opt/kair-firma/storage/pdfs/originales /opt/kair-firma/storage/pdfs/firmados /opt/kair-firma/storage/pdfs/constancias /opt/kair-firma/storage/pdfs/papel
```

Opciones: `--ids=A,B` (la lista), `--todos` (escanear todos los huerfanos) y
`--json` (que imprime solo JSON, parseable).

> **Correrlo como `kairfirma`, no como root (2026-10-22).** La base esta en WAL:
> si no se puede abrir en solo lectura, el "plan B" de abrirla en modo normal
> **escribe**, y como root deja los archivos `-wal`/`-shm` con dueno root en el
> directorio de datos: el servicio (que corre como `kairfirma`) deja de poder
> escribir en ellos. El script, como root, **se niega** y pide correrlo como el
> usuario del servicio. Ver la trampa #62 del `PROMPT.md`.

### 5.5 Las tres migraciones del 📦933 (custodia de 20, excepción auditable)

> **El despliegue del 23-oct-2026 incluye las 037 a 041 tambien.** La lista
> completa de lo que va al servidor y el orden de verificacion estan en la
> **§5.1.2**.

**Se aplican solas** al arrancar el servicio (`src/server.js` llama a `migrate()`), pero
conviene **mirar el log** para confirmar que entraron las tres y en este orden:

| Migración | Qué hace | Ojo |
|---|---|---|
| `034_retencion_custodia_20` | Traduce el id de regla guardado en la fila: `CUSTODIA_80_ANOS` → `CUSTODIA_20_ANOS` | **No** recalcula `fecha_conservacion`: la fecha ya comunicada no se recorta |
| `035_excepciones_habilitacion` | Crea las dos tablas de la excepción de habilitación (la excepción y su bitácora) | — |
| `036_excepciones_habilitacion_append_only` | Instala los dos triggers que hacen la bitácora **inalterable** | Lleva `@skip-when-env test`: en el **servidor sí se aplica** (el ambiente es producción) |

```bash
# 1. Que las tres entraron (en el log de arranque)
sudo journalctl -u kair-firma --since '-10 min' | grep -E '034_|035_|036_'

# 2. Que la 036 quedo instalada (los triggers tienen que estar)
sudo -u kairfirma bash -c "sqlite3 /opt/kair-firma/data/firma.sqlite \"SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE 'trg_excepciones%';\""

# 3. Que el id viejo de la retencion quedo traducido (tiene que salir vacio)
sudo -u kairfirma bash -c "sqlite3 /opt/kair-firma/data/firma.sqlite \"SELECT COUNT(*) FROM gh_firmas_electronicas WHERE regla_retencion='CUSTODIA_80_ANOS';\""

# 4. Que el servicio quedo arriba y con el codigo nuevo
curl -sS http://127.0.0.1:3001/health
```

> **La bandera `FIRMA_EXIGIR_HABILITACION_EMPRESA` se RETIRO (📦933).** Si el `.env` del
> servidor la tiene, ahora es **inerte**: el bloqueo de la habilitacion es incondicional y
> la unica salida es la excepcion auditable
> (`POST /internal/admin/excepciones-habilitacion`). No hace falta quitarla del `.env`,
> pero saberlo evita confundir "la variable no hace nada" con "el bloqueo no funciona".

---

## 6. Correr los tests en el servidor

En el portatil **no corren**: el `better-sqlite3` de alla esta compilado para Electron 37
(`NODE_MODULE_VERSION 136`) y el Node local es v26 (`147`). En el servidor hay Node 20 limpio.

Dos cosas que hay que tener presente:

```bash
cd /opt/kair-firma/app
sudo npm install --include=dev   # supertest es devDependency; sin esto fallan ~60 archivos
sudo npm test
```

`tests/` **no viaja en el despliegue de produccion**. Se copia aparte cuando se vaya a correr la
bateria:

```powershell
# En el PC donde esta el repo
cd "C:\Proyectos Programacion\SG-SST-E\sgsst-electron-app\firma-service"
scp -r .\tests javier@192.168.1.11:/tmp/
```

```bash
# En el servidor
sudo cp -r /tmp/tests /opt/kair-firma/app/tests
sudo chown -R kairfirma:kairfirma /opt/kair-firma/app/tests
```

`tests/setup.js` y `scripts/migrate-test.js` fuerzan `DB_PATH` a `data/test.sqlite` y lanzan un
error si resuelve a la BD de produccion. La barrera existe porque un guard anterior permitio correr
la suite contra `firma.sqlite` y se perdio `SIGN-2026-037663`.

---

## 7. Estado de la suite (2026-10-23)

```
tests 1639 | pass 1633 | fail 4 | skipped 2
```

Los **4 fallos** son de `tests/scripts/seed-dev-acuerdo.test.js`: la guarda
`TEXTO_LEGAL_CON_PLACEHOLDERS` de `src/services/agreement.js` rechaza las versiones
v2.0/v3.0/v4.0/v9.0 que siembra ese script. **No son de la migracion de las etapas 1 a 5** y
no se tocan desde ahi.

Los dos fallos de la medicion del 2026-10-15 (`pdfValidator.test.js` §6.2, por sensibilidad a la
carga, e `idempotency-isolation.test.js` caso 2, por el `CreationDate` que pdf-lib escribe en
cada PDF) **ya no estan**: los 1639 tests corren en 152 s en esta PC, con la suite completa.

La verificacion de las etapas 0 a 6 (2026-10-23): `node --check` 24/24, barrido de caracteres no
latinos limpio en 30 archivos, **5 de 5 mutaciones mordieron** y arranque en frio del service con el
router del recibo de supresion montado.

---

## 8. Pendientes

- [ ] Registrar al menos una empresa en el backend desde un equipo cliente (el servidor esta listo
      pero nadie le esta hablando todavia).
- [ ] Correr los tests de extremo a extremo con datos reales: crear sign request, enviar la
      invitacion por correo, firmar desde el celular y descargar la constancia.
- [ ] Eliminar la tarea `KairFirmaTunnel` del portatil. **Esta muerta**: el script corre
      `cloudflared tunnel run kair-firma`, que lee `~/.cloudflared/config.yml`, y ese directorio ya
      no existe en ninguna maquina. El tunnel vive ahora en el servidor.
- [ ] Backup automatico diario de la BD. **Los 3 scripts estan listos y probados en el PC**
      (`deploy/backup-firma.sh`, `deploy/probar-restauracion.sh`, `deploy/health-check.sh`),
      pero no hay cron instalado en el servidor. Los comandos exactos estan en
      `sgsst-electron-app/docs/gestion-humana/firma-electronica/plan-continuidad-2026-10-26.md`
      (seccion 5) y en `firma-service/deploy/README-DESPLIEGUE.md` (Paso 9). El respaldo
      diario queda programado para las **22:00 (hora de Colombia)**.
- [ ] Arreglar el test de idempotency (ver seccion 7).
- [ ] Revisar las 6 vulnerabilidades que reporto `npm audit` al desplegar. No se corrio `npm audit
      fix` a proposito.
- [ ] Monitorizacion: **la mitad del servidor ya esta** (`deploy/health-check.sh` en cron cada
      5 minutos: revisa el servicio local y el publico, reinicia si esta caido y deja log).
      Falta la **alerta externa**: el log no despierta a nadie. Hay que crear un monitor de
      uptime en el panel de Cloudflare (del owner). Sin eso, el RTO de 4 h declarado en el
      Anexo de Nube cuenta desde que el owner se entere, no desde que la caida ocurre.
- [ ] **La hora del servidor esta en `Etc/UTC`** (medido el 26-oct-2026). Esto rompe tres cosas a la vez:
      el cron de las 22:00 cae a las **17:00 de Colombia**, los plazos en dias habiles (2 dias habiles de PQRS y
      5 dias habiles de la copia permanente) se cuentan con el **dia UTC** (`src/services/solicitudes.js`,
      `_sumarDiasHabiles` usa `getDay()`), y la **constancia PDF** imprime la hora de UTC. El codigo dice que el
      dia debe ser local (`solicitudes.js:144`); lo que esta mal puesto es el servidor. Se corrige con
      `sudo timedatectl set-timezone America/Bogota` (reversible, no toca los datos: la base guarda ISO en UTC).
- [ ] Copia **off-site** de los respaldos (hoy viven en el mismo servidor que los datos).
      Es la brecha mas grande del plan de continuidad y la mas facil de cerrar: una linea de
      `rclone` mas una cuenta.

### 8.1. Deuda de seguridad aplazada (sugerencia, no restrictiva)

El owner decidio el **2026-10-25** aplazar la migracion a **Node 24**, el `npm audit fix` y
el cierre A/B/C del `SECURITY.md`. **No bloquea la primera firma ni el funcionamiento
actual.** El plan, los criterios de aceptacion, el rollback y los disparadores para
retomarlo estan en
[`docs/gestion-humana/firma-electronica/plan-seguridad-2026-10-25.md`](gestion-humana/firma-electronica/plan-seguridad-2026-10-25.md).

Estado al 2026-10-25: **Node 20.20.2** (EOL 2026-04-30), `npm audit --omit=dev` con **7
vulnerabilidades** (1 critica, 4 altas, 2 moderadas) y el **§7 del SECURITY.md con 0/39
casillas**. No se presenta como resuelto.

---

## 9. Guia anterior (Oracle + Caddy + sslip.io)

`firma-service/deploy/README-DESPLIEGUE.md` describe una VM de Oracle Cloud con Caddy y un
dominio `sslip.io`. **Esa guia no es la que se uso.** Se conserva como referencia para el caso de
que algun dia se quiera una IP publica propia y sin depender de Cloudflare. Para el despliegue
vigente, este documento.