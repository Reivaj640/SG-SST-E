# Despliegue del servidor de firmas — `kair-server` + Cloudflare Tunnel

> **Estado: EN PRODUCCION desde el 2026-10-15.** `https://firma.kair.fyi` responde desde el
> servidor `kair-server`. El servicio ya **no depende de ningun portatil**: sobrevive reinicios
> y funciona aunque todas las maquinas de trabajo esten apagadas.
>
> Este documento reemplaza la guia anterior de "migrar a un portatil dedicado". Esa ruta ya no
> aplica: el servidor es Ubuntu, no Windows, y el dominio es propio, no un quick tunnel.

---

## 0. Lo que hay que aplicar desde el 11-nov-2026 (lo que habilita P8)

> **Este bloque es lo que hace falta para que la contrafirma exista en el servidor.** Sin las
> migraciones 060/061/062, las rutas de contrafirma devuelven **404** y la compuerta
> `contrafirma_nube` no puede quedar `ok`. Sin `FIRMA_ADMIN_ACTOR`, la contrafirma se rechaza con
> **409 `FACULTAD_NO_ACREDITADA`**. Son tres cosas, y las tres son de este documento.

| # | Qué | Por qué | Dónde se aplica |
|---|---|---|---|
| 1 | **Migraciones `060`, `061` y `062`** | La 060 crea la segunda mitad del Anexo de Nube (la contrafirma); la 061, el registro de poderes del Encargado; la 062, el rastro append-only de ese registro | Paso 4 de §5.1 + verificación del §0.1 |
| 2 | **`FIRMA_ADMIN_ACTOR=Javier Robles Fontalvo`** en `/opt/kair-firma/.env` | El contrafirma declara **quien** firma por Gesstiar y esa nombre se coteja con la facultad acreditada. Es el representante legal, así que **no hay que registrar ningún poder**. Sin la variable, el valor por defecto de la app (`K+AIR <usuario>@<equipo>`) no es el nombre de una persona y el acto se rechaza | §3 |
| 3 | **Node 22 y `better-sqlite3` recompilado (ABI 127)** | `better-sqlite3` 11.10.0 **no compila** contra la V8 de Node 26 (`v8::Object::GetPrototype` ya no existe) y **no hay prebuild para Node 24**. El único runtime viable es Node 22 | §8.1 |

> ⚠️ **Lo que NO se verificó desde esta máquina (11-nov-2026):** el estado real del servidor
> (qué versión de Node corre, cuántas migraciones tiene aplicadas, si el `.env` ya trae la
> variable). Lo de arriba es lo que **debe** quedar, no lo que **quedó**. El §8 de este documento
> tiene la lista de pendientes.

### 0.1 Cómo se comprueba que las tres migraciones quedaron aplicadas

```bash
# Con el servicio PARADO (o en la ventana de mantenimiento), en el servidor:

# 060: la segunda mitad del Anexo de Nube
sudo -u kairfirma sqlite3 /opt/kair-firma/data/firma.sqlite \
  "SELECT contrafirmado_at, contrafirma_actor, contrafirma_evidencia FROM gh_firma_anexo_nube_suscripciones LIMIT 1;"

# 060: la fecha de ejecucion del instrumento, en la ficha de la empresa
sudo -u kairfirma sqlite3 /opt/kair-firma/data/firma.sqlite \
  "SELECT anexo_nube_ejecutado_at FROM gh_firma_empresas LIMIT 1;"

# 061 y 062: el registro de poderes y su rastro append-only
sudo -u kairfirma sqlite3 /opt/kair-firma/data/firma.sqlite \
  "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('gh_firma_encargado_poderes','gh_firma_encargado_poderes_eventos');"
```

Las tres consultas tienen que **responder**, no fallar: `no such table` significa que la
migración no está aplicada. Y el servicio, arriba, tiene que contestar la ruta de contrafirma
**con 401/403 y no con 404**:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' -X POST \
  https://firma.kair.fyi/internal/admin/empresas/1/anexo-nube/contrafirmar/codigo
# 404 = el servidor corre el codigo viejo: falta el despliegue de las migraciones
# 401/403 = la ruta EXISTE: lo que falta es la llave (bien, el gate ya se puede medir)
```

### 0.2 El orden que no se negocia

El paso 4 de §5.1 corre las migraciones **con el servicio parado y antes de arrancar**. El
servicio llama a `migrate()` al arrancar, así que si una migración falla el proceso sale con
código 1 y el systemd lo reintenta en bucle: la caída se ve en el `journalctl`, no en el alta.

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
FIRMA_ADMIN_ACTOR=Javier Robles Fontalvo
```

**`FIRMA_ADMIN_ACTOR` es el nombre de QUIEN contrafirma por Gesstiar.** Es el representante legal
de Gesstiar S.A.S. (NIT 900987987-4), así que **no hay que registrar ningún poder** a su
nombre: el servicio lo reconoce como representante legal y lo acepta sin acreditación adicional.
Sin esta variable, el valor por defecto (`K+AIR <usuario>@<equipo>`, compuesto en tiempo de
ejecución con el usuario y el nombre del equipo) **no es el nombre de una persona** y la
contrafirma se rechaza con **409 `FACULTAD_NO_ACREDITADA`**.

> **El `.env` de la app de escritorio NO lleva esta variable, a propósito.** Ese `.env` viaja
> **dentro del instalador**: poner ahí un nombre de persona atribuiría los actos administrativos
> de **toda** copia instalada a esa persona. La variable se declara en el entorno del **service**
> (aquí) o como variable del sistema en la máquina del operador. El detalle está en
> `docs/gestion-humana/firma-electronica/acreditacion-facultad-contrafirmante.md` §4.2.

**El canal de proteccion de datos tiene que ser UNO solo.** `src/config.js` lo lee de
`FIRMA_CANAL_PROTECCION_DATOS` y el manifiesto `legal-readiness.json` lo declara en
`encargado.canal_proteccion_datos`. Si los dos no dicen lo mismo, el readiness marca
el item `canal_datos` como FALLA, y el texto legal le estaria prometiendo al Titular
un buzon distinto del que el sistema usa de verdad. Cambiarlo en el `.env` **exige
reiniciar el servicio**: la configuracion se lee al arrancar, no en caliente.

### La variable inerte `FIRMA_EXIGIR_MEDIO_PERSONAL_OTP` (acto del owner)

**Lo que es.** La variable se lee una sola vez, en `src/config.js`
(`exigirMedioPersonalOtp`), y **su valor no lo usa ninguna decision**: el rechazo del
codigo OTP hacia un buzon que la Empresa pueda leer es **INCONDICIONAL** desde la v1.2
del Acuerdo (27-oct-2026) y esta en `src/services/publicFlow.js`, funcion
`_controlarMedioCorporativo`: responde `400 MEDIO_OTP_CORPORATIVO` y deja el evento
`OTP_MEDIO_CORPORATIVO` en `gh_firma_eventos` (append-only). **No es un interruptor y
no debe citarse como control en ningun documento.**

**Lo que se recomienda (dictamen legal del 12-nov-2026, L7): QUITARLA del `.env`.**
El argumento para conservarla («para no romper despliegues que ya la tengan
definida») es vacio: **una variable que no se lee no puede romper un despliegue**. El
historico queda en el comentario del codigo, que es donde pertenece. Y al revés: el
`.env` del servidor es `600 root` y el usuario `javier` no lo lee, asi que **esto no lo
puede hacer el agente**: es un **acto del owner**.

**El comando literal** (para quien tenga el `sudo`):

```bash
# 1. Respaldo primero (el .env es 600 root; el respaldo queda 600 root).
sudo cp -p /opt/kair-firma/.env /opt/kair-firma/.env.bak-2026-11-12

# 2. Ver la linea antes de quitarla (debe salir UNA).
sudo grep -n '^FIRMA_EXIGIR_MEDIO_PERSONAL_OTP' /opt/kair-firma/.env

# 3. Quitar SOLO esa linea: el patron esta anclado al principio de linea.
sudo sed -i '/^FIRMA_EXIGIR_MEDIO_PERSONAL_OTP=/d' /opt/kair-firma/.env

# 4. Verificar: el grep no debe devolver nada, y el archivo sigue 600 root.
sudo grep -c '^FIRMA_EXIGIR_MEDIO_PERSONAL_OTP' /opt/kair-firma/.env
sudo ls -l /opt/kair-firma/.env
sudo head -n 3 /opt/kair-firma/.env   # el resto del .env sigue bien

# 5. El servicio no cambia de comportamiento (la variable era inerte), pero
#    si se quiere el proceso con la configuracion tal como quedo en disco:
sudo systemctl restart kair-firma
sudo systemctl status kair-firma
```

**Si el owner decide conservarla**, la linea se reemplaza por este bloque (comentario
ASCII, del dictamen legal del 12-nov-2026, §4.5), para que el archivo no vuelva a
presentarla como un interruptor:

```ini
# FIRMA_EXIGIR_MEDIO_PERSONAL_OTP
# SIN EFECTO. NO ES UN INTERRUPTOR Y NO CAMBIA NINGUN COMPORTAMIENTO DEL
# SERVICIO. Se lee una sola vez en src/config.js y su valor no lo usa
# ninguna decision: el rechazo del codigo OTP hacia un buzon que la Empresa
# pueda leer es INCONDICIONAL desde la v1.2 del Acuerdo (27-oct-2026).
# El control real esta en src/services/publicFlow.js, funcion
# _controlarMedioCorporativo: responde 400 MEDIO_OTP_CORPORATIVO y deja el
# evento OTP_MEDIO_CORPORATIVO en gh_firma_eventos (append-only).
# Se conserva la variable solo por compatibilidad con despliegues que ya la
# tengan definida en su .env. Si esta linea aparece en un .env, su valor se
# ignora. No debe citarse como control en ningun documento.
FIRMA_EXIGIR_MEDIO_PERSONAL_OTP=false
```

> **Lo que NO se corrige con esto.** `src/db/schema/031_medio_otp.sql` sigue con el
> comentario de cabecera que dice que el rechazo «sigue APAGADO», y eso es
> **deliberado**: el archivo es una **migracion ya aplicada en produccion** y las
> migraciones no se reescriben (su contenido es la evidencia de lo que se ejecuto). La
> correccion vive en el codigo y en el expediente, no en la migracion.

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

# 2b. NORMALIZAR LOS PERMISOS. El tar se arma en WINDOWS (tar de bsdtar, que no
#     guarda permisos POSIX): al extraerlo como root, TODO llega en 777. Esto no
#     lo arregla el chown. Va pegado al chown, en el mismo ciclo.
#     Resultado: directorios 755 (raiz 750), archivos 644, duenno kairfirma.
sudo chmod -R u=rwX,go=rX /opt/kair-firma/app /opt/kair-firma/legal
sudo chmod 750 /opt/kair-firma/app /opt/kair-firma/legal

# 2c. La base de PRUEBA no debe quedar en el despliegue. Si un despliegue
#     anterior la dejo dentro de app/data/, se retira.
sudo rm -f /opt/kair-firma/app/data/test.sqlite

# 3. VERIFICAR el hash de lo que quedo en disco (no del repo, no del tar)
sha256sum /opt/kair-firma/app/src/crypto/token.js
sha256sum /opt/kair-firma/app/src/services/signRequest.js
# La tabla de conservacion: sin ella el servicio arranca con el RESPALDO
# congelado (tres categorias) en vez de las ocho de la tabla.
sha256sum /opt/kair-firma/app/config/tabla-conservacion.json
# El texto del Acuerdo que declara el manifiesto: sin este archivo el
# readiness lee un archivo inexistente y reporta huecos que son puro
# artefacto del empaquetado.
# La version la dice el manifiesto (legal-readiness.json -> acuerdo.archivo):
# hoy es la v1.6. Si el manifiesto cambia de version, cambia esta linea.
ls -l /opt/kair-firma/app/scripts/fixtures/acuerdo-v1.6.txt

# Y los PERMISOS, que el chown no corrige (ver 5.1.3):
# lo esperado: drwxr-x--- en app/, drwxr-xr-x en app/src/, -rw-r--r-- en los
# archivos, y app/data/ SIN test.sqlite.
ls -ld /opt/kair-firma/app /opt/kair-firma/app/src
ls -l /opt/kair-firma/app/src/server.js
ls -l /opt/kair-firma/app/data/

# 4. LAS MIGRACIONES, con el servicio parado y ANTES de arrancar.
#    OJO: con el .env cargado. El .env real esta en /opt/kair-firma/.env y
#    src/config.js lo busca con dotenv en /opt/kair-firma/app/.env, que NO
#    existe: sin las variables, DB_PATH cae al default ./data/firma.sqlite,
#    resuelve a /opt/kair-firma/app/data/firma.sqlite (un directorio que no
#    esta) y SQLite revienta al abrir la base DENTRO del require. El error
#    sale con el stack terminando en Module._compile y no dice nada de la base.
#    (Pasa el 26-oct-2026 con el despliegue del 📦954.)
sudo -u kairfirma bash -c 'set -a; . /opt/kair-firma/.env; set +a; cd /opt/kair-firma/app && node src/db/migrate.js' 2>&1 | tail -20

# 4b. VERIFICAR que las migraciones del 11-nov quedaron aplicadas.
#     Sin esto el servicio arranca, responde, y las rutas de contrafirma
#     devuelven 404: el codigo viejo se ve IGUAL de sano.
sudo -u kairfirma sqlite3 /opt/kair-firma/data/firma.sqlite \
  "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('gh_firma_encargado_poderes','gh_firma_encargado_poderes_eventos');"
sudo -u kairfirma sqlite3 /opt/kair-firma/data/firma.sqlite \
  "SELECT contrafirmado_at FROM gh_firma_anexo_nube_suscripciones LIMIT 1;"
sudo -u kairfirma sqlite3 /opt/kair-firma/data/firma.sqlite \
  "SELECT anexo_nube_ejecutado_at FROM gh_firma_empresas LIMIT 1;"
# Y que el actor esta declarado (sin esto, la contrafirma se rechaza con 409)
sudo -u kairfirma bash -c 'grep -c "^FIRMA_ADMIN_ACTOR=" /opt/kair-firma/.env'

# 5. Arrancar: el proceso nuevo carga lo que esta en disco
sudo systemctl start kair-firma
sleep 3
systemctl is-active kair-firma

# 6. VERIFICAR que el proceso que corre es el nuevo
sudo systemctl show -p MainPID -p ActiveEnterTimestamp kair-firma
curl -sS https://firma.kair.fyi/health

# 6b. VERIFICAR que el SELLO de version-annuncia lo que se instalo.
#     `version_sello` es un campo ADITIVO del /health (`kair_version` no se toca).
#     Si el archivo `VERSION` no viaja en el tar, el campo dice que no hay sello:
#     eso es correcto, pero inutil, y por eso el paso 1b lo copia al stage.
cat /opt/kair-firma/app/VERSION
cd /opt/kair-firma/app && sudo -u kairfirma node scripts/generar-sello-version.js --comprobar
```

> **Si el despliegue cambia `package.json` o `package-lock.json`, hay que INSTALAR
> (el 📦1051).** El tar de despliegue lleva `src`, `web`, `scripts`, `config`,
> `package.json`, `package-lock.json` y `legal-readiness.json` — **no lleva `node_modules`** — y los
> pasos de arriba **no instalan nada**: el servidor sigue con el `node_modules` que hay. Un cambio
> de dependencias **no se aplica por sí solo**. El 12-nov-2026 el 📦1051 subió `express` de 4.22.2
> a **4.22.3** (para cerrar la vulnerabilidad moderada de `qs`) y `proxy-addr` a **2.0.8** (la
> crítica): sin instalar, el servidor **seguiría corriendo las versiones vulnerables con el código
> nuevo**, y el `npm audit` del servidor no lo delata.
>
> ```bash
> # Con el servicio PARADO (el paso 1), antes del paso 4 (las migraciones):
> cd /opt/kair-firma/app
> sudo -u kairfirma npm ci --omit=dev        # el lock manda; no tocar el arbol a mano
> sudo -u kairfirma npm ls express proxy-addr qs
> ```
>
> `npm ci` **borra** `node_modules` y lo reconstruye desde el lock: hace falta red en el servidor.
> Con Node 20 (ABI 115) el `better-sqlite3` 11.10.0 baja su prebuild y no hay que compilar; si el
> runtime fuera Node 22 (ABI 127), habría que `npm rebuild better-sqlite3` (ver §8.2). Ojo con
> `--omit=dev`: **borra** los devDependencies, que el §6 necesita para correr la batería.

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
  "$svc/src" "$svc/web" "$svc/scripts" "$svc/config" "$svc/package.json" "$svc/package-lock.json" "$svc/legal-readiness.json"
tar -xzf "$env:TEMP\kair-deploy\svc.tar.gz" -C "$stage\app" --strip-components=2

# 1b. EL SELLO DE VERSION (despues del archive, a proposito).
#     El sello dice que commit y que arbol estan instalandose. Se genera DESPUES
#     del `git archive` porque el archivo `VERSION` NO se commitea (si se
#     commiteara, anunciaria el commit anterior), y `git archive` solo saca lo
#     commiteado: por eso se copia al stage a mano.
#     El /health publica el sello en `version_sello` (campo aditivo: `kair_version`
#     no se toca). Sin este archivo, el campo dice explicitamente que no hay sello.
$commit = (git rev-parse HEAD).Trim()
node "$svc/scripts/generar-sello-version.js" --commit="$commit"
Copy-Item "$svc\VERSION" "$stage\app\VERSION" -Force
Get-Content "$stage\app\VERSION"

# 2. Los documentos legales que el readiness lee
#    (solo los del servicio en la nube: el Anexo de Nube VIGENTE y el Anexo de Encargo).
#    La version del Anexo de Nube NO se escribe a mano: la declara
#    src/services/anexoNubeModelo.js (VERSION_MODELO) y el manifiesto la confirma.
#    Hoy es la v1.3. Si se empaqueta la v1.0 o la v1.1, el readiness busca un
#    archivo que no esta y reporta huecos que son puro artefacto del empaquetado.
git archive --format=tar.gz --output="$env:TEMP\kair-deploy\legal.tar.gz" HEAD `
  'sgsst-electron-app/legal/anexo-nube-v1.3.html' 'sgsst-electron-app/legal/anexo-encargo.html'
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

`git archive` sigue resolviendo lo de siempre: entra **solo lo commiteado**. Eso tiene dos
consecuencias que hay que tener presentes, porque las dos fallan **en silencio**:

- **El texto del Acuerdo que declara el manifiesto tiene que estar versionado**, porque el
  readiness lo lee en el servidor (`legal-readiness.json` -> `acuerdo.archivo` ->
  `scripts/fixtures/acuerdo-v1.6.txt`). Si no estuviera commiteado, el paquete viajaria
  sin el y el readiness leeria un archivo inexistente: reportaria huecos que son puro
  artefacto del empaquetado.
- **`config/` tiene que estar versionado**, porque es ahi donde vive la tabla de
  conservacion. Sin ella, el servicio arranca con el RESPALDO congelado en el codigo
  (tres categorias) en vez de las ocho de la tabla, y lo hace sin avisar.

Lo que NO viaja es lo que no está commiteado, y eso incluye el texto de una versión
candidata que el abogado todavía no aprobó. El manifiesto `legal-readiness.json` viaja en
la raiz de la app, que es donde el readiness lo busca.

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

### 5.1.3 Los permisos del despliegue (trampa del 2026-10-31)

> **2026-10-31.** El pre-T4 de solo lectura encontro `/opt/kair-firma/app` **y todas
> sus subcarpetas en 777**, y una **base de prueba** (`app/data/test.sqlite`,
> 303 104 B) dentro del despliegue. El abogado lo marco como bloqueante: con
> permisos 777, cualquier usuario de la maquina puede escribir el codigo que
> corre el servicio, y eso no es "minimo privilegio".

**Por que llega en 777.** El tar se arma **en Windows** (el `tar -czf` de
PowerShell, que es bsdtar): bsdtar **no guarda permisos POSIX**, asi que todos
los archivos quedan con el modo 777 en el tar. Al extraerlo **como root**, el
`tar` los preserva tal cual: 777 en disco. El `chown` que hace el despliegue
**cambia el dueno, no los permisos** — por eso el arbol quedo con dueno
`kairfirma` y permisos 777 al mismo tiempo.

**El arreglo no rompe el despliegue.** La unidad systemd corre como
`User=kairfirma` (`deploy/kair-firma.service`): el servicio le el codigo al
proprietario, no necesita ser root. `ProtectSystem=full` y
`ReadWritePaths=/opt/kair-firma` ya limitan la escritura. Con 755 en los
directorios interiores y 644 en los archivos, el proceso sigue arrancando igual.

```bash
# Normalizar (lo que ya va en el paso 2b del despliegue)
sudo chmod -R u=rwX,go=rX /opt/kair-firma/app /opt/kair-firma/legal
sudo chmod 750 /opt/kair-firma/app /opt/kair-firma/legal

# Retirar la base de prueba (paso 2c)
sudo rm -f /opt/kair-firma/app/data/test.sqlite

# Verificar
ls -ld /opt/kair-firma/app /opt/kair-firma/app/src
ls -l /opt/kair-firma/app/src/server.js
ls -l /opt/kair-firma/app/data/
```

Que se espera: `drwxr-x---` en `app/`, `drwxr-xr-x` en `app/src/`,
`-rw-r--r--` en los archivos, y `app/data/` **sin** `test.sqlite`.

> **Lo que NO se corrige con esto.** Los secretos no viven en `app/`: el `.env`
> esta en `/opt/kair-firma/.env` (600) y la base de produccion en
> `/opt/kair-firma/data/firma.sqlite`, **fuera** del arbol del codigo. Por eso
> `go=rX` (lectura para otros) no expone ni el `.env` ni la base de produccion.

**El disco del servidor no esta cifrado** (raiz sobre LVM sin LUKS, swap en
`/swap.img` plano). Eso **no lo arreglan los permisos**: es una decision
pendiente del owner y del abogado (LUKS o control compensatorio documentado).
Queda registrado como tal, con fecha.

---

### 5.1.4 El resultado medido de la comprobacion del servidor (12-nov-2026)

Lo de arriba es el **procedimiento**. Esta es la **primera vez que queda registrado su resultado**, que es
lo que pide el requisito `7.13` del cuadro canonico ("Registrar el resultado de la comprobacion del
servidor", que sealaba: "Es el acta del despliegue. El documento que la recoge es
`docs/MIGRACION-SERVIDOR-FIRMA.md`, seccion 5.1").

**Medicion.** 12-nov-2026, 19:52Z a 19:57Z, por SSH en modo de solo lectura contra `kair-server`
(`javier@192.168.1.11`). **Commit de referencia: `264d08df`** (identico a `origin/Dev`).

| Que se midio | Resultado |
|---|---|
| Servicio | `active` / `enabled`, `MainPID 281641`, `NRestarts 0`, arrancado 12-nov 09:30:23 -05 |
| Salud | `GET /health` -> `status: ok`, `db: ok`, `smtp: configured` |
| Migraciones | **61** aplicadas, la ultima `062_encargado_poderes_append_only` |
| Manifiesto | `191c08b837b41069de4e2d25d7158fd90a7c3ce5f93b22696d2d7050f8a4013f` — **era byte a byte igual** al del repositorio; desde el 12-nov-2026 (tarde) el repositorio lleva `d9b596993cec7958cadadcd9d9ed51c33878eb03c5b0c4aa1bc642a4bfc9097b`, que difiere en **dos notas**; **el despliegue lo alinea** |
| Texto del Acuerdo | `app/scripts/fixtures/acuerdo-v1.6.txt` -> `08e1eb8b…f13e` (coincide con el manifiesto) |
| Anexo de Nube v1.3 | `/opt/kair-firma/legal/anexo-nube-v1.3.html` -> `fdd10551…b585d` (coincide) |
| Anexo de Encargo | `/opt/kair-firma/legal/anexo-encargo.html` -> `6308b1f7…b8948` (coincide) |
| Permisos | **236 archivos y 18 directorios** escribibles por cualquiera (`-perm -0002`); `/opt/kair-firma/logs` es `755 root:root` |
| Logs | `health-check.log` con 411 704 B y 5 820 lineas desde el 26-oct, **sin rotacion** (no existe `/etc/logrotate.d/kair-firma`) |
| Red | El 3001 escucha **solo** en `127.0.0.1`; `cloudflared` `active` |
| Node del servidor | **v20.20.2** |
| Datos | 5 firmas, 55 eventos, 1 empresa, **0** eventos `OTP_MEDIO_CORPORATIVO`; el ultimo evento es del **6-nov** |
| Respaldos | El ultimo es del **11-nov 22:00** (`de14e3f4…de20a`, `integrity ok`); **no hay copia fuera del servidor**; los actos del P8 (12-nov) no estan en ningun respaldo |
| Preflight del Anexo de Nube | **`ok: true`, exit 0** (texto vigente con huella coincidente y 1 Empresa con el Anexo suscrito **y contrafirmado**) |

**Que codigo corre.** El despliegue es por **copia de archivos** y el servidor **no tiene `.git`**, asi que
`git log` no lo dice y el `/health` tampoco (devuelve `kair_version: "compatible-0.1.189"`, un valor fijo).
La respuesta se armo comparando el sha256 de cada archivo desplegable del repositorio con el de los
mismos archivos en el servidor: **247 archivos en comun, 6 diferentes, 0 sobrantes**.

Los 6 que difieren son `package.json`, `package-lock.json` (el **📦1051 no esta desplegado**),
`scripts/actualizar-manifiesto-1047.js`, `scripts/actualizar-manifiesto-v1.6.js`, `deploy/setup-vm.sh` y
`deploy/README-DESPLIEGUE.md`. **Todo `src/` que corre es byte a byte el de `264d08df`.**

La comparacion es reproducible y **sale con codigo 1 nombrando los archivos** mientras haya diferencias:

```bash
# En el servidor (solo lectura)
cd /opt/kair-firma/app
find . -type f -not -path './node_modules/*' -not -path './data/*' -not -path './storage/*' \
  -not -path './logs/*' -not -path './backups/*' -not -name '*.enc' -not -name '*.pdf' -not -name '*.log' \
  -print0 | xargs -0 sha256sum | sed 's#  \./#  #' | LC_ALL=C sort > /tmp/manifiesto-servidor.txt

# En el PC, con el repositorio al dia
node firma-service/scripts/comparar-despliegue.js \
  --repo <ruta>/sgsst-electron-app/firma-service \
  --servidor /tmp/manifiesto-servidor.txt
```

**Actas completas de esta medicion**, con la salida integra de cada comando:
`sgsst-electron-app/docs/gestion-humana/firma-electronica/verificacion-cierre/acta-comprobacion-servidor-2026-11-12.md`
(requisito 7.13) y `.../acta-despliegue-2026-11-12.md` (requisito 8.8).

**Lo que quedo abierto por esta comprobacion** (todo con dueño, ninguno es un misterio):

1. Desplegar el **📦1051** con el paso de instalacion (`npm ci --omit=dev`, servicio parado). Es lo que
   deja de correr `proxy-addr 2.0.7`. **Owner** (`sudo`).
2. **Permisos**: los 236 archivos en 777 se corrigen con el paso 2b de §5.1. **Owner** (`sudo`).
3. **La bandera `FIRMA_EXIGIR_ANEXO_NUBE`**: apagada. El preflight ya dio 0, asi que la condicion
   tecnica se cumple; falta encenderla y reiniciar. **Owner** (`sudo`).
4. **Rotacion de logs**: el `logrotate` esta escrito en el repositorio, falta instalarlo. **Owner**.
5. **Respaldo off-site**: el destino es una decision del owner; el script esta escrito y validado.
6. **Node 22** en el servidor: decision tomada el 11-nov, no ejecutada. **Owner**.

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

## 7. Estado de la suite

La medicion vigente es la del **2026-11-13** (corrida en solitario sobre el arbol de trabajo de esta
ronda, con el arbol de dependencias nuevo y los tests de la ronda de cierre):

```
tests 2693 | pass 2691 | fail 0 | skipped 2
```

Medido con **Node 22.23.4** (ABI 127) en el PC de trabajo, con `better-sqlite3` 11.10.0
recompilado para ese ABI: 325 s. Los 2 `skipped` son los que ya estaban asi el 11-nov.
**Actualizada el 13-nov-2026 (tarde, sexta parte):** la corrida dio **2 693 / 2 691 / 0 / 2**
(318 s, 180 archivos, `exit 0`). El **+2** sobre la corrida anterior son
las dos pruebas nuevas: la que exige que la **S-24 exista, sea `EMITIDA` y sea del bloque M.31**
(la firma del owner sobre el procedimiento del canal) y la que exige que el **CONTEXT publique la
cifra vigente en su linea viva** y no la de una ronda anterior.
**La anterior, del 13-nov-2026 (tarde, quinta parte):** la corrida dio **2 691 / 2 689 / 0 / 2**
(357 s, 180 archivos, `exit 0`). El **+1** sobre la corrida de la tarde es
la prueba nueva que exige que la **S-23 exista, sea `EMITIDA`, sea del bloque M.31 y declare la
huella real del procedimiento que se le envia** al abogado.
**La anterior, del 13-nov-2026 (tarde, cuarta parte):** la corrida dio **2 690 / 2 688 / 0 / 2**
(338 s, 180 archivos, `exit 0`). El **+1** sobre la corrida de la tarde es
la prueba nueva que exige que **las cinco decisiones del owner sobre el canal de
`fecha_terminacion` esten escritas** en el procedimiento y que la **S-22 este `CERRADA`** en la
tabla de solicitudes.
**La anterior, del 13-nov-2026 (tarde, segunda parte):** la corrida dio **2 689 / 2 687 / 0 / 2**
(325 s, 180 archivos, `exit 0`). Los **+5** sobre la corrida de la noche del 12-nov son las cuatro
pruebas nuevas del enlace entre cada bloque del mapa y su fila en la tabla de solicitudes
(`tabla-de-solicitudes-2026-11-13.md`) y la del guard que **falla si la cita errada del Decreto
1377** reaparece en cualquiera de los dos candidatos de la v1.4.
**La anterior, del 12-nov-2026 (noche):** la corrida dio **2 684 / 2 682 / 0 / 2** (299 s, 180
archivos, `exit 0`). Los **+14** sobre la corrida de la tarde de ese dia son las pruebas de la
compuerta de conservacion con las condiciones C1 a C4, las del marcador de pendiente, las
del generador de los candidatos de la v1.4 (que hasta ahora no tenia test) y el guard de
ASCII puro (que exige que los dos programas de la v1.4 no tengan ni un byte sobre 127,
ni BOM, ni CRLF).

La medicion anterior (12-nov-2026, antes del cambio de dependencias) fue
`tests 2606 | pass 2604 | fail 0 | skipped 2`, en 415 s; la de antes (11-nov-2026) fue
`tests 2574 | pass 2572 | fail 0 | skipped 2`, en 220 s. **La diferencia son 83 pruebas nuevas**
(2 693 - 2 606), todas en verde; el numero de la seccion 7 se queda
atrasado si no se actualiza, y una cifra vencida leida como vigente es un verde falso.

> La reproduccion desde **clon limpio** esta medida y registrada en
> `docs/gestion-humana/firma-electronica/verificacion-cierre/t1-corrida-desde-clon-limpio.md`.
> La corrida **sobre el estado commiteado** tambien se hizo el 12-nov-2026, con el commit
> `e4dd5f31`: el clon sale del commit, `npm ci` desde cero y `exit 0`, con el **mismo** resultado
> (`tests 2665 | pass 2663 | fail 0 | skipped 2`, 179 archivos de prueba, 323 s) y el **conjunto de
> los 2 665 nombres de prueba identico** al de la corrida de ese momento. El clon quedo **byte a byte**
> igual al arbol del owner (4 810 archivos, 0 diferentes). El 6.11 del cuadro canonico quedo
> **CERRADO** por esto. **Ojo con las dos cifras:** la del clon es la de `e4dd5f31`, que es
> **anterior** a las dos pruebas de regresion del manifiesto; el arbol de hoy da **2 693 / 2 691**.
> Compararlas como si fueran la misma corrida seria un error de lectura.

> **El EOL de este archivo esta fijado por su test.** Si lo abres en un editor que normalice a
> CRLF, el diff entero se mueve. Las ediciones se hacen a nivel de bytes.

### 7.1 La medicion del 11-nov-2026

```
tests 2574 | pass 2572 | fail 0 | skipped 2
```

Medido con **Node 22.23.4** (ABI 127) y `better-sqlite3` recompilado para ese ABI: 220 s.

Los **4 fallos** que se veian el 2026-10-23 (de `tests/scripts/seed-dev-acuerdo.test.js`, la
guarda `TEXTO_LEGAL_CON_PLACEHOLDERS` de `src/services/agreement.js` contra las versiones
v2.0/v3.0/v4.0/v9.0) **ya no estan**: hoy la suite completa corre en verde.

> **Ojo con correr la suite a mano.** `tests/` y el `data/test.sqlite` son **una sola cosa**: sin
> `--test-concurrency=1` los archivos compiten por la misma base y salen falsos rojos (15 falsos
> al correr tres archivos de `tests/routes/` a la vez). Con la concurrency en 1, los tres dan
> **45/45**.

Los dos fallos de la medicion del 2026-10-15 (`pdfValidator.test.js` §6.2, por sensibilidad a la
carga, e `idempotency-isolation.test.js` caso 2, por el `CreationDate` que pdf-lib escribe en
cada PDF) **ya no estan**: los 1639 tests corren en 152 s en esta PC, con la suite completa.

La verificacion de las etapas 0 a 6 (2026-10-23): `node --check` 24/24, barrido de caracteres no
latinos limpio en 30 archivos, **5 de 5 mutaciones mordieron** y arranque en frio del service con el
router del recibo de supresion montado.

---

## 8. Pendientes

- [x] Registrar al menos una empresa en el backend desde un equipo cliente. **Hecho:** ASEPLUS
      CARIBE S.A.S. esta registrada y hay dos instrumentos con actos — el Anexo de Nube v1.1
      suscrito el 2026-11-05 y el Anexo de Encargo 2026-11-06 suscrito (2026-11-07T19:30:14Z)
      y contrafirmado por K+AIR (2026-11-07T20:33:22Z). Lo que falta no es hablar con el
      servidor: es **P8** (suscribir el Anexo de Nube v1.3 y el Encargo 2026-11-11, y
      contrafirmar los dos). Ver §8.3.
- [ ] **P8 — los cuatro actos que cierran el instrumento bilateral.** Requiere el despliegue
      habilitante (§0) y despues, en este orden: (1) **publicar el Acuerdo v1.6** → **HECHO el
      11-nov-2026**: quedo publicada (`publicado: true` en el manifiesto), es la version activa en
      la base de produccion con su huella `08e1eb8b...52f13e`, y su autorizacion operativa quedo
      registrada (id 4, tipo OPERATIVA, 11-nov-2026); la **Constancia de version y autorizacion**
      se completo ese mismo dia con los datos del registro del owner (huella `aaf68b4e...d0b413`,
      9 794 B) y su seccion 5 y su seccion 6 siguen vacias por diseno: la autorizacion vive en el
      registro de aprobaciones del servicio, no en el documento;
      (2) suscripcion ASEPLUS del Anexo de Nube v1.3 (`fdd10551...2b585d`, 85 143 B),
      (3) contrafirma de K+AIR dentro del servicio, (4) re-suscripcion administrativa del Anexo
      de Encargo 2026-11-11 (`6308b1f7...75b8948`, 94 923 B), (5) contrafirma del Encargo. El
      paso a paso esta en
      [`docs/gestion-humana/firma-electronica/contrafirma-anexo-nube-v1-2.md`](gestion-humana/firma-electronica/contrafirma-anexo-nube-v1-2.md).
      Los textos v1.6 / v1.3 / 2026-11-11 son los vigentes desde el 11-nov-2026; el fundamento
      esta en
      [`docs/gestion-humana/firma-electronica/dictamen-legal-textos-2026-11-11.md`](gestion-humana/firma-electronica/dictamen-legal-textos-2026-11-11.md).
      **Errata del 11-nov-2026 (antes de los actos).** Los dos textos que P8 firma se corrigieron
      antes de ser susceptibles de suscripcion: el parrafo 12 del Anexo de Nube v1.3 decia «Esta
      version 1.2 remite» al Anexo de Encargo (donde decia «1.3»), y el Anexo de Encargo 2026-11-11
      remitia en cuatro puntos (menu, 1, 5 y 9) al Anexo de Nube v1.2, un texto superado que su
      propia seccion 5 incorpora por remision (articulo 44 de la Ley 527 de 1999). Son correcciones
      de cita: no cambian las partes, el objeto, las obligaciones ni el riesgo. **Las etiquetas NO
      cambian** (v1.3 y 2026-11-11); lo que cambia es la huella, y la anterior queda declarada en la
      nota del manifiesto y en el Historial. Las versiones ya suscritas (v1.1 y 2026-11-06) no se
      tocaron. Fundamento:
      [`docs/gestion-humana/firma-electronica/dictamen-legal-errata-textos-2026-11-11.md`](gestion-humana/firma-electronica/dictamen-legal-errata-textos-2026-11-11.md).
      **Despliegue de la errata en el servidor: HECHO el 11-nov-2026 a las 15:56** (hora de
      Colombia), con `sudo bash /tmp/kair-errata/instalar-errata.sh`. Los tres artefactos (los dos
      textos y el manifiesto) se instalan **JUNTOS**, porque la compuerta compara la huella que
      declara el manifiesto con la del archivo que el servidor lee: instalarlos por separado deja
      un estado rojo. El script verifica los SHA-256, respalda, instala, reinicia el servicio,
      vuelve a medir la compuerta y comprueba que los actos de P8 siguen pendientes; el respaldo
      quedo en `/opt/kair-firma/backup-errata-20261111-155647` (con las huellas viejas
      `45500569...3abf9f` y `c7c42a18...70bfd95`) y el log en `/tmp/kair-instalar-errata.log`.
      **Verificado por SSH, por fuera del script:** las tres huellas del servidor son
      `fdd10551...2b585d` (Anexo de Nube v1.3), `6308b1f7...75b8948` (Anexo de Encargo
      2026-11-11) y `cad606a9...df0d3a` (manifiesto, byte a byte igual al del repo); el servicio
      esta `active` con `NRestarts=0` y el health en `ok`; la compuerta queda en `publicado: ok`,
      `aprobacion_operativa_vigente: ok` y **0 bloqueantes pendientes**; y `firmado_nube`,
      `contrafirma_nube` y `estado_encargo` **siguen pendientes** (una errata no fabrica una firma).
      **La base no se toco:** 1 empresa, 3 consentimientos (2 `ACCEPTED` + 1 `OTP_PENDING`), la
      v1.6 activa con `08e1eb8b...f13e`, 4 aprobaciones de publicacion (una sola por version) y
      las dos suscripciones intactas (Nube v1.1 y Encargo 2026-11-06, ambas FIRMADAS). **A ASEPLUS
      se le dice en una linea, antes de pedir la firma, que el texto que va a firmar es el texto
      corregido.**
      **La re-suscripcion del Anexo de Encargo: la ruta EXISTE y esta desplegada (11-nov-2026).**
      El manifiesto y este documento ya prometian que «la re-suscripcion va por el canal
      administrativo, con su motivo», pero la ruta **no existia**: el servicio tenia
      `desmarcarAnexoSuscrito()` (probada, con motivo obligatorio y rastro campo por campo), y
      **ninguna ruta HTTP la llamaba** — solo habia `anexo-firmado/quitar`, que deshace el SEGUNDO
      acto. Sin la ruta nueva el Anexo de Encargo no se podia volver a suscribir: el 409
      `SUSCRIPCION_EXISTENTE` (`anexoEncargo.js:1099-1116`) solo se levanta si las **dos** fechas de
      la ficha (`anexo_encargo_suscrito_at` y `anexo_encargo_firmado_at`) quedan en NULL. Era una
      capacidad prometida y no existente. **La ruta nueva** es
      `POST /internal/admin/empresas/:id_empresa/anexo-suscrito/quitar` (`adminApiAuth`;
      `X-Admin-Motivo` **obligatorio**; actor opcional; no toca las filas de suscripcion ni la fecha
      de firma). **El orden importa:** primero `anexo-firmado/quitar` (fase 2) y despues
      `anexo-suscrito/quitar` (fase 1). La suscripcion anterior queda **FIRMADA** en el rastro: solo
      se deshace el puntero de la ficha. **Verificado por SSH:** hash en disco
      `ae0fff23...7aa2f0` (el del repo), servicio `active` con `NRestarts=0`, salud `ok`, y la ruta
      respondiendo **401** sin llave mientras una ruta inexistente responde **404** (o sea: existe).
      Pruebas: `tests/anexo-encargo-resuscripcion.test.js` (8 casos). API: `API.md` §6.13.2 («Los
      nueve endpoints»).
- [ ] **Correr los tests en el servidor** (§6). La suite completa nunca se ha corrido ahi: en el
      portatil no corren por el ABI. El comando exacto esta en §6.
- [ ] Correr los tests de extremo a extremo con datos reales: crear sign request, enviar la
      invitacion por correo, firmar desde el celular y descargar la constancia.
- [ ] Eliminar la tarea `KairFirmaTunnel` del portatil. **Esta muerta**: el script corre
      `cloudflared tunnel run kair-firma`, que lee `~/.cloudflared/config.yml`, y ese directorio ya
      no existe en ninguna maquina. El tunnel vive ahora en el servidor.
- [x] Backup automatico diario de la BD. **Hecho (verificado el 11-nov-2026 por SSH):** los cuatro
      crons estan instalados en `/etc/cron.d` (`kair-firma-backup`, `kair-firma-health`,
      `kair-firma-purga`, `kair-firma-restauracion`) y hay respaldos cifrados hasta
      `storage-20261110-220001.tar.gz.enc`. Los comandos exactos estan en
      `sgsst-electron-app/docs/gestion-humana/firma-electronica/plan-continuidad-2026-10-26.md`
      (seccion 5) y en `firma-service/deploy/README-DESPLIEGUE.md` (Paso 9). Los scripts que
      las ejecutan son `firma-service/deploy/backup-firma.sh` (WAL-safe: usa `sqlite3 .backup`,
      no un `cp` de la base), `firma-service/deploy/probar-restauracion.sh` y
      `firma-service/deploy/health-check.sh`. El respaldo
      diario queda programado para las **22:00 (hora de Colombia)** y la **prueba de restauracion
      mensual** para el dia 1 de cada mes, a las **04:00 hora local del servidor** (la equivalencia
      horaria esta corregida en el README), que es lo que hace verdadera la frase del Anexo de
      Nube "se verifica mensualmente que el respaldo se restaura correctamente".
- [ ] Arreglar el test de idempotency (ver seccion 7).
- [ ] Revisar las 6 vulnerabilidades que reporto `npm audit` al desplegar. No se corrio `npm audit
      fix` a proposito.
- [ ] Monitorizacion: **la mitad del servidor ya esta** (`deploy/health-check.sh` en cron cada
      5 minutos: revisa el servicio local y el publico, reinicia si esta caido y deja log).
      Falta la **alerta externa**: el log no despierta a nadie. Hay que crear un monitor de
      uptime en el panel de Cloudflare (del owner). Sin eso, el RTO de 4 h declarado en el
      Anexo de Nube cuenta desde que el owner se entere, no desde que la caida ocurre.
- [x] **La hora del servidor esta en `America/Bogota`** (verificado el 11-nov-2026 por SSH:
      `timedatectl` devuelve `-05:00`). **Se corrigió** con `sudo timedatectl set-timezone
      America/Bogota` (reversible, no toca los datos: la base guarda ISO en UTC). Los tres
      efectos que rompia (cron de las 22:00 en hora de Colombia, plazos en dias habiles contados
      con el dia local y hora en la constancia PDF) quedaron resueltos.
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

**Actualizado el 12-nov-2026.** El `npm audit fix` **sí se aplicó**, pero **no el completo**: se
aplicó solo la parte **sin ruptura de versión mayor**. `proxy-addr` (la **crítica**, IP spoofing por
subred IPv4-mapped IPv6) pasó de 2.0.7 a **2.0.8**; `qs` (moderada) a **6.16.2**, con `express`
subido de 4.22.2 a **4.22.3** (un parche dentro del rango `^4.21.0` que ya declaraba el
proyecto); y de paso `body-parser` a 1.20.9 y `multer` a 2.5.0. Quedan **2 altas** que **exigen
salto de versión mayor** y por eso NO se tocaron: `nodemailer` (6.10.1 → 10.5.0) y `zod`
(3.25.76 → 4.6.7), los dos con cambios de API que hay que revisar en el código, no un parche.
El piso de `express` quedó en `^4.22.3` para que una instalación nueva no vuelva a traer la
versión vulnerable.

> **Trampa del `npm audit fix` (12-nov-2026).** `npm audit fix --omit=dev` **poda los
> devDependencies**: dejó el árbol sin `supertest` y 133 archivos de prueba fallaron con «Cannot
> find module 'supertest'». El `package-lock.json` no había perdido la declaración: lo que
> faltaba era el árbol. Se restauró con un `npm install` completo. El §6 avisa del
> `--include=dev` por otra vía; esta es la inversa: **`--omit=dev` borra**, no deja de instalar.

### 8.2. Node 22: la decision del 11-nov-2026 (ya no es "sugerencia")

El owner decidio el **2026-11-11** que el servidor corra **Node 22 (ABI 127)**. No es una
preferencia de version: es la **unica** que funciona con este `better-sqlite3`.

| | |
|---|---|
| `better-sqlite3` | 11.10.0 |
| Node 22 (ABI 127) | **funciona** (compila y hay prebuild oficial) |
| Node 24 (ABI 137) | **no hay prebuild** y el paquete no trae campo `binary`: siempre compila, y el codigo de `better-sqlite3` 11.10.0 **no compila** contra la V8 de Node 26 (`v8::Object::GetPrototype` ya no existe) |
| Node 26 (ABI 147) | no compila, por lo mismo |

> La compilacion **si** funciona en la maquina: hay Visual Studio Build Tools 18. El problema no
> es el compilador, es la combinacion de versiones.

**Consecuencia para el despliegue:** si se sube el runtime, hay que **recompilar**
`better-sqlite3` en el servidor (el binario es especifico de un ABI). Con el runtime actual (Node
20, ABI 115) el modulo ya instalado funciona; si se cambia a Node 22, hay que recompilar **antes**
de arrancar el servicio, o el proceso muere al abrir la base.

```bash
# Con Node 22 en el PATH (el script de compilacion resuelve `node` del PATH):
cd /opt/kair-firma/app
sudo -u kairfirma npm rebuild better-sqlite3
```

El detalle completo (mediciones, release oficial verificado, comando exacto) esta en
[`docs/gestion-humana/firma-electronica/node-22-rebuild-better-sqlite3-2026-11-11.md`](gestion-humana/firma-electronica/node-22-rebuild-better-sqlite3-2026-11-11.md).

> **El npm audit y el cierre A/B/C del `SECURITY.md` siguen aplazados** (decision del 2026-10-25).
> Lo que cambio el 11-nov es **el runtime**, no el resto de la deuda.

### 8.3. P8: los cuatro actos, paso a paso (la referencia que faltaba)

P8 son **cuatro actos** sobre los textos **vigentes**: suscribir y contrafirmar el Anexo de Nube
v1.3 (`fdd10551...2b585d`) y el Anexo de Encargo 2026-11-11 (`6308b1f7...75b8948`). ASEPLUS
CARIBE S.A.S. (`900829731`) es la empresa de prueba del proceso.

**Lo que NO es un acto de K+AIR:** la suscripcion de cada instrumento la hace la **Empresa**, desde
el enlace de un solo uso, con el codigo que sale a su buzon. K+AIR abre la suscripcion, verifica
documentalmente a quien firmo y contrafirma. Por eso el runbook tiene dos fases y la primera se
detiene a la espera de una persona.

#### Las cuatro rutas del canal administrativo (el orden importa)

Las dos de cada instrumento se desarman **fase 2 primero, fase 1 despues**. Deshacer la fase 1 con
la fase 2 puesta no alcanza: el 409 `SUSCRIPCION_EXISTENTE` mira los dos campos.

| Orden | Ruta | Que deshace |
|---|---|---|
| 1 | `POST /internal/admin/empresas/:id_empresa/anexo-nube-ejecutado/quitar` | Nube fase 2: `anexo_nube_ejecutado_at` (la contrafirma) |
| 2 | `POST /internal/admin/empresas/:id_empresa/anexo-nube-suscrito/quitar` | Nube fase 1: `anexo_nube_firmado_at`, `_version`, `_hash`, `_evidencia` |
| 3 | `POST /internal/admin/empresas/:id_empresa/anexo-firmado/quitar` | Encargo fase 2: `anexo_encargo_firmado_at` |
| 4 | `POST /internal/admin/empresas/:id_empresa/anexo-suscrito/quitar` | Encargo fase 1: `anexo_encargo_suscrito_at`, `_version`, `_hash`, `_evidencia` |

Las cuatro exigen `X-Admin-Motivo` (y `X-Admin-Actor`), **no tocan ninguna fila** de las tablas de
suscripciones — la suscripcion anterior queda `FIRMADA`/`CONTRAFIRMADA`, con su huella, su evidencia
y su acta — y dejan el valor anterior en el rastro append-only. Lo que se deshace es el puntero de
la ficha, no el hecho.

> **La premarca NO es el camino.** `POST .../anexo-nube-firmado` registra en la ficha la version y la
> huella del texto vigente **antes** de que la Empresa suscriba: eso es un registro falso y un
> conteo falso en el gate. Se usa solo cuando la Empresa **ya** suscrito fuera del sistema.

#### Fase 1: preparar (la ejecuta el owner, en el servidor)

```bash
sudo bash /tmp/kair-p8/p8-aseplus.sh fase1
```

El script: comprueba que el servicio esta vivo, **muestra la linea de errata** y **no sigue hasta que
el owner confirme que la envio por correo** (al abrir la suscripcion sale sola la invitacion, y la
errata tiene que estar en la cabeza de la contraparte antes de pedirle la firma), deshace las cuatro
fases, abre las dos suscripciones y imprime los dos enlaces.

> **La linea de errata va antes.** Es la condicion que puso el dictamen del 11-nov-2026 para la
> errata en sitio (opcion A): la contraparte tiene que saber que el texto que va a firmar es el texto
> corregido (art. 3 de la Ley 527 de 1999, buena fe; art. 7 literal a, aprobacion inequivoca del
> contenido). El texto literal esta en
> [`docs/gestion-humana/firma-electronica/contrafirma-anexo-nube-v1-2.md`](gestion-humana/firma-electronica/contrafirma-anexo-nube-v1-2.md) §3.5.

#### Fase 2: los pasos de la Empresa y las contrafirmas

El owner abre los dos enlaces en el navegador (el codigo del Nube sale a `jrf2011@live.com`; el del
Encargo, al segundo canal, `reivaj640@gmail.com`), pide el codigo, lo escribe y acepta. En el del
Encargo tiene que aceptar tambien el tratamiento de datos y revisar los cinco datos del parrafo 11.

Despues:

```bash
sudo bash /tmp/kair-p8/p8-aseplus.sh fase2
```

El script verifica que las dos suscripciones **estan FIRMADA** y que son del texto vigente (por
huella, no por fecha), registra la verificacion documental de la representante legal (el
`verificar-representante`; el tipo es `RUT`, porque el certificado de camara no se reviso), pide los
**dos codigos de contrafirma** (salen al buzon de proteccion de datos de K+AIR, `privacidad.kair@gmail.com`,
que es fijo en la configuracion: un canal elegido por quien pide el acto no probaria nada),
contraforma los dos instrumentos, **regenera los dos manifiestos** y mide la compuerta.

**UN CODIGO A LA VEZ (correccion del 12-nov-2026).** La primera corrida pidio los **dos** codigos
a la vez y se mezclaron: los dos correos de contrafirma llegan al **mismo buzon** (`privacidad.kair@gmail.com`) y sus asuntos son casi identicos — «K+AIR - Tu codigo para
contrafirmar el Anexo de Nube» y «... del Anexo de Encargo». El codigo se tecleo con el del otro
instrumento y el servicio respondio 400 `CODIGO_INVALIDO`. **El script pide un codigo, lo usa, y
solo entonces pide el otro**, y lo distingue por el **cuerpo** del correo (que dice «K+AIR esta
contrafirmando el Anexo de Nube de una Empresa» o «... del Anexo de Encargo de una Empresa»), no
por el asunto. Un error de tecleo se reintenta con el **mismo** codigo (hasta 3 veces): teclear mal
un digito gasta un *intento* (hay 5) y no un *envio* (el limite de 5 envios **no se resetea** y si
es firme). La contrafirma se confirma **contra la base**, no contra el HTTP 200: un 200 con la base
sin fecha es un falso verde.

#### Lo que hay que mirar al terminar

| Que | Donde |
|---|---|
| Los tres items del gate | `firmado_nube`, `contrafirma_nube` y `estado_encargo` pasan a `ok` |
| La ficha de ASEPLUS | `anexo_nube_firmado_at`, `anexo_nube_ejecutado_at`, `anexo_encargo_suscrito_at` y `anexo_encargo_firmado_at` con fecha del dia |
| Las suscripciones | las dos nuevas `FIRMADA` y `CONTRAFIRMADA`; las dos viejas (v1.1 y 2026-11-06) **intactas** |
| El manifiesto | `--check` en 0 en los dos scripts (comparan **estado**, no bytes) |
| La habilitacion | `GET /internal/empresa/anexos` responde `habilitacion.ok = true` sin pendientes |

#### El resultado real (12-nov-2026): los cuatro actos quedaron ejecutados

El P8 **se ejecuto en produccion** el 12-nov-2026. Los cuatro actos, con su hora:

| Acto | Cuando | Que quedo |
|---|---|---|
| Suscripcion del Anexo de Nube v1.3 por la Empresa | 2026-11-12T15:38:27.990Z | Suscripcion id 2, huella `fdd10551...2b585d`; el codigo de verificacion salio al correo del firmante, nunca a un buzon que la Empresa pueda leer |
| Suscripcion del Anexo de Encargo 2026-11-11 por la Empresa | 2026-11-12T15:40:06.992Z | Suscripcion id 2, huella `6308b1f7...75b8948`, acta de suscripcion `c0ca4211...d21f6`; el codigo salio al **segundo canal** |
| Verificacion documental de la representante legal (RUT) | 2026-11-12T15:40:32.516Z | Por Javier Robles Fontalvo. **Precondicion** de la contrafirma del Encargo: sin ella el servicio responde 409 `REPRESENTANTE_NO_VERIFICADO` |
| Las dos contrafirmas de K+AIR | Nube 16:13:54.106Z · Encargo 16:14:31.105Z | Actas `050f223a...4a501` y `5dcb2149...4b062`; las dos con la facultad acreditada `REPRESENTANTE_LEGAL_ENCARGADO` |

**Medido despues, por SSH, con un script de solo lectura:** las cuatro fases de la ficha con fecha (`anexo_nube_firmado_at`, `anexo_nube_ejecutado_at`, `anexo_encargo_suscrito_at`, `anexo_encargo_firmado_at`); las dos suscripciones nuevas `FIRMADA` **y** contrafirmadas; **las dos viejas intactas** (la v1.1 del 5-nov y la del Encargo 2026-11-06, contrafirmada el 7-nov con su acta `b1ec9fa2...c235513`); el manifiesto en `191c08b8...f8a4013f` (canonico, ASCII puro, sin BOM, con `anexo_nube.firmado: true`, `anexo_nube.contrafirmado: true` y `anexo_encargo.estado: firmado`), y la compuerta `primera_firma` en **`listo: true`**, con 40 items `ok`, **0 bloqueantes** y los tres items del P8 en `ok`.

**El `aviso` que queda no bloquea:** el item `empresas_nube` dice «En este ambiente no se exige el Anexo de Nube» porque `FIRMA_EXIGIR_ANEXO_NUBE` sigue **apagada**. El codigo lo declara asi a proposito (`readinessLegal.js`: sin ese flag el item es `aviso` y su `bloquea` va vacio). **P8 fue un ensayo sobre una empresa de prueba, no la apertura a produccion.**

**El manifiesto del repo se sincronizo.** `legal-readiness.json` viaja en el paquete de despliegue (`git archive ... "$svc/legal-readiness.json"`, §0), asi que un repo con el manifiesto viejo **pisaria el estado real** en el proximo despliegue y devolveria el gate a `firmado: false`. Se regenero con los mismos scripts y se comprobo que es **determinista**: el archivo regenerado y el de produccion salen **byte a byte iguales** (`191c08b8...f8a4013f`).

**Dos holes del runbook que se encontraron antes de que costaran un acto.** (1) **El paso de regenerar los manifiestos no funcionaba**: `src/config.js` carga el `.env` con `path.join(__dirname, '..', '.env')`, o sea `/opt/kair-firma/app/.env`, que **no existe** (el archivo real esta en `/opt/kair-firma/.env`, el que declara el `EnvironmentFile` de la unidad systemd). Sin esas variables el script abortaba con `Variable de entorno requerida: INTERNAL_API_KEY` y **el manifiesto se quedaba en `firmado: false`**: los cuatro actos estaban hechos y el gate los seguia viendo pendientes. (2) **La ruta de error del script abortaba el runbook**: con `set -euo pipefail`, el `grep` del codigo de error sin coincidencia hacia fallar el pipe y tumbaba el script *justo cuando fallaba la contrafirma*, que es donde hace falta que siga. Le falto un `|| true`.

**Lo que NO debe pasar:** que la suscripcion nueva se escriba sobre la vieja, que un manifiesto
declare «firmado» sin que exista la suscripcion del texto vigente, o que la compuerta se cierre con
una fecha de suscripcion que nadie merece.

### 8.4. El respaldo fuera del servidor (off-site): la segunda copia

> **El problema, medido el 12-nov-2026.** Los respaldos son diarios a las 22:00, se cifran con GPG
> simetrico AES256 y verifican su propia integridad: eso esta bien. Pero viven en
> `/opt/kair-firma/backups`, **en el mismo disco que la base**. Si la maquina se muere, se pierden
> los dos. Una copia cifrada en el mismo servidor no es un respaldo: es una segunda copia.
> Aparte: **los cuatro actos del P8 (12-nov) todavia no estaban en ningun respaldo** — el ultimo era
> del 11-nov a las 22:00, y el del 12-nov a las 22:00 ya los incluye.

#### El script

`firma-service/deploy/backup-offsite.sh`. **No toca `backup-firma.sh`** (el que corre a diario y ya
> hace bien su trabajo): este es otro, y solo se lleva los `.enc` **ya cifrados** a otro sitio.

| | |
|---|---|
| **Nunca borra la copia local** | La poda local es de `backup-firma.sh` y respeta el hold legal |
| **No se da por buena la copia hasta que el hash del destino coincide** | Un `scp` que "salio bien" no prueba que el archivo llego entero; el hash si |
| **Sin destino configurado no es un error** | Sale con codigo 0 y lo deja escrito en el log: la decision del destino es del owner |
| **La poda del destino solo ocurre DESPUES de una copia verificada** | Y nunca borra mas copias de las que la retencion local permite |
| **Solo viajan `.enc`** | No se escribe nada en claro |

#### Instalacion (la corre el owner: `sudo` pide contrasena)

```bash
# 1. El script
sudo install -m 700 -o root -g root \
  /ruta/al/repo/sgsst-electron-app/firma-service/deploy/backup-offsite.sh \
  /opt/kair-firma/backup-offsite.sh

# 2. La configuracion (el destino es una decision del owner)
sudo install -m 600 -o root -g root /dev/null /opt/kair-firma/backup-offsite.conf
sudo sh -c 'cat > /opt/kair-firma/backup-offsite.conf <<EOF
METODO=rclone
REMOTO=rclone:mi-bucket/kair
RETENCION_DIAS=30
EOF'

# 3. Que haria, sin hacer nada
sudo bash /opt/kair-firma/backup-offsite.sh --estado

# 4. Copiar y verificar
sudo bash /opt/kair-firma/backup-offsite.sh

# 5. Comprobar que el destino tiene lo mismo
sudo bash /opt/kair-firma/backup-offsite.sh --verificar
```

`METODO` puede ser `rsync` (otra maquina), `scp` (otra maquina, ultima instancia) o `rclone` (un
> bucket en la nube: **el destino no depende de otra maquina**, que es la opcion mas fuerte). Sin
> `rsync`, `scp` ni `rclone` instalados, el metodo no se puede usar.

Para dejarlo diario, anadir al `crontab` de root (el de `backup-firma.sh` es de root y el usuario
> `javier` no lo ve):

```bash
sudo crontab -l > /tmp/cron-actual.txt 2>/dev/null || true
sudo sh -c 'cat /tmp/cron-actual.txt; echo "30 22 * * * /bin/bash /opt/kair-firma/backup-offsite.sh"' | sudo crontab -
```

#### Lo que falto y todavia falta

- **El destino es del owner**: hace falta decidir a donde va la copia (bucket, otra maquina, disco
>  externo) y poner las credenciales. Sin eso el script esta escrito y validado, pero **no copia**.
- **La restauracion desde la copia off-site no esta probada**: `probar-restauracion.sh` prueba el
>  camino local; falta probarlo con un archivo que venga del destino.

#### La trampa que el ensayo en el servidor encontre

> El selector de archivos **no puede ser por nombre**. Un `ls | sort | tail -1` elige
> `firma-pre-despliegue-20261026-180335.sqlite.enc` —la "p" de "pre" ordena **despues** del "2" de
> "2026"—, y se llevaria un respaldo de octubre **pensando que es el de hoy**. En el directorio hay
> 22 respaldos de la base y 16 del storage, y ademas archivos que no son respaldos diarios
> (`pre-despliegue`, `antes-limpieza-consentimiento`, `manual-pre-994`). El selector es por **fecha
> de modificacion** y con el **patron de nombre exacto** que usa `backup-firma.sh`
> (`firma-2???????-??????.sqlite.enc`). Sin este detalle, la copia off-site seria de un archivo
> equivocado, y el hash cuadraria igual porque compara el archivo equivocado consigo mismo.

---

## 9. Guia anterior (Oracle + Caddy + sslip.io)

`firma-service/deploy/README-DESPLIEGUE.md` describe una VM de Oracle Cloud con Caddy y un
dominio `sslip.io`. **Esa guia no es la que se uso.** Se conserva como referencia para el caso de
que algun dia se quiera una IP publica propia y sin depender de Cloudflare. Para el despliegue
vigente, este documento.

### 5.6. La excepcion de habilitacion (D-03): el orden correcto

La excepcion de habilitacion es la **unica** salida del bloqueo del D-03, y su bitacora es append-only: lo que
queda escrito no se puede editar. Por eso el orden no es un detalle:

1. **Abrir** la excepcion (`POST /internal/admin/excepciones-habilitacion`) con las seis condiciones:
   autorizacion escrita (quien, fecha y donde queda el documento), alcance de firmas, ruta en papel
   operativa HOY y plazo cierto (maximo 30 dias).
2. **Verificar el estado** antes de seguir:

   ```bash
   sudo -u kairfirma sqlite3 /opt/kair-firma/data/firma.sqlite "SELECT id_solicitud, estado, fecha_creacion, fecha_expiracion, fecha_firma FROM gh_firmas_electronicas WHERE id_solicitud='SIGN-XXXXXX';"
   ```

   `estado` en `PENDING` y `fecha_firma` vacia significan que **todavia no se firmo**.
3. **El paso humano**: el firmante abre el enlace en el celular y completa el commit, el consentimiento y la
   firma. Es el unico paso que ninguna maquina hace.
4. **Volver a verificar**: ahora `estado` cambio y `fecha_firma` tiene valor. Solo entonces:
5. **Cerrar** la excepcion (`POST /internal/admin/excepciones-habilitacion/:id/cerrar`), con un motivo que
   describa lo que **realmente** paso.

El cierre va en un lote aparte: un lote que abre y cierra el mismo instrumento deja el paso humano fuera y
produce un motivo falso que la bitacora conservara para siempre (trampa 91).
