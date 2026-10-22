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
```

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

# 2. Copiar el codigo nuevo al directorio de la app
sudo tar -xzf /tmp/kair-deploy.tar.gz -C /opt/kair-firma/app

# 3. VERIFICAR el hash de lo que quedo en disco (no del repo, no del tar)
sha256sum /opt/kair-firma/app/src/crypto/token.js
sha256sum /opt/kair-firma/app/src/services/signRequest.js

# 4. Arrancar: el proceso nuevo carga lo que esta en disco
sudo systemctl start kair-firma
sleep 3
systemctl is-active kair-firma

# 5. VERIFICAR que el proceso que corre es el nuevo
sudo systemctl show -p MainPID -p ActiveEnterTimestamp kair-firma
curl -sS https://firma.kair.fyi/health
```

El paso 5 es el que falto. `uptime_seconds` tiene que ser **chico** (unos
segundos): si el proceso lleva horas arriba, no es el que se acaba de instalar,
por mas que los hashes del disco esten bien.

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

## 7. Estado de la suite (2026-10-15)

```
tests 973 | pass 969 | fail 2 | skipped 2
```

Los dos fallos **no son bugs de codigo**:

1. **`pdfValidator.test.js` §6.2** — mide que el rechazo por timeout de parseo ocurra en menos de
   200 ms. Tarda 270-330 ms con 973 tests en serie sobre 2 vCPU. El objetivo del test es detectar un
   *hang* (que serian >5 s), y eso no ocurre. Sensibilidad a la carga, no a la correccion.
2. **`idempotency-isolation.test.js` caso 2** — el helper `postSign()` genera un PDF nuevo en cada
   llamada, y pdf-lib escribe `CreationDate`/`ModDate`, asi que los dos requests llevan SHA-256
   distintos. Como el fingerprint de idempotencia incluye el hash del PDF (decision G6), el
   servidor responde `409 IDEMPOTENCY_KEY_CONFLICT`, que es **lo correcto**. El test no puede
   construir el escenario de replay que dice probar. El arreglo es cachear el buffer del PDF.

---

## 8. Pendientes

- [ ] Registrar al menos una empresa en el backend desde un equipo cliente (el servidor esta listo
      pero nadie le esta hablando todavia).
- [ ] Correr los tests de extremo a extremo con datos reales: crear sign request, enviar la
      invitacion por correo, firmar desde el celular y descargar la constancia.
- [ ] Eliminar la tarea `KairFirmaTunnel` del portatil. **Esta muerta**: el script corre
      `cloudflared tunnel run kair-firma`, que lee `~/.cloudflared/config.yml`, y ese directorio ya
      no existe en ninguna maquina. El tunnel vive ahora en el servidor.
- [ ] Backup automatico diario de la BD. La carpeta `/opt/kair-firma/backups` existe y hay copias
      manuales, pero no hay cron.
- [ ] Arreglar el test de idempotency (ver seccion 7).
- [ ] Revisar las 6 vulnerabilidades que reporto `npm audit` al desplegar. No se corrio `npm audit
      fix` a proposito.
- [ ] Monitorizacion: nada avisa si el servidor se cae o si el tunnel se desconecta. El panel de
      Cloudflare muestra el estado, pero no hay alerta.

---

## 9. Guia anterior (Oracle + Caddy + sslip.io)

`firma-service/deploy/README-DESPLIEGUE.md` describe una VM de Oracle Cloud con Caddy y un
dominio `sslip.io`. **Esa guia no es la que se uso.** Se conserva como referencia para el caso de
que algun dia se quiera una IP publica propia y sin depender de Cloudflare. Para el despliegue
vigente, este documento.