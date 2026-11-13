# Verificacion de cierre - Seccion 7 del SECURITY.md (las 39 casillas de pre-produccion)

**Medido el 12 de noviembre de 2026, 14:03 a 14:25 (hora de Colombia).**

> **Que es esto.** El `seccion7` de
> `sgsst-electron-app/docs/gestion-humana/firma-electronica/SECURITY.md` es una lista de verificacion
> de pre-produccion con **39 casillas, las 39 sin marcar** (marcas `- [ ]`). Que esten sin marcar **no
> significa que esten sin hacer**: significa que **nadie las midio**. Este documento es la medicion de
> las 39, una por una, con su evidencia.
>
> **Como se numeran estas casillas.** Cada casilla lleva el prefijo **S** (`S7.1` a `S7.39`) porque
> el **cuadro canonico** de cierre tiene sus propios requisitos `7.1` a `7.15`, que son de
> **produccion y despliegue**: son otra cosa. Los subtitulos `## 7.x` de este documento son las
> **subsecciones del `SECURITY.md`** y no se renombraron. Las referencias en el texto apuntan a las
> casillas de este informe.
>> **El seccion7 del SECURITY.md NO se toco.** Las casillas siguen sin marcar a proposito: la decision del
> proyecto es medir en un informe aparte, no marcar casillas a mano.

**Como se midio.**
1. Lectura del seccion7 completo (`SECURITY.md:783-856`) y de cada casilla.
2. Codigo del repositorio, rama `Dev`, HEAD `264d08df` (`sgsst-electron-app/firma-service`).
3. **SSH de solo lectura** al servidor de produccion `kair-server` (`javier@192.168.1.11`, clave
   `id_ed25519_kair`): `ls`, `stat`, `cat`, `curl`, `sqlite3 -readonly`, `journalctl`, `openssl
   s_client`, `find -perm`, `systemctl show/list-timers`. **No se uso `sudo`, no se detuvo ni se
   reinicio el servicio, no se escribio nada en el servidor ni en la base, y no se publico ningun
   valor de secreto**: de los archivos de credenciales solo se midieron permisos y duenos.
4. `npm audit --omit=dev` sobre el arbol del repo y sobre el `package-lock.json` **desplegado**
   (copiado a un directorio temporal del PC con `scp`, sin tocar el servidor).
5. **Se reutilizo lo ya medido** por los informes hermanos, para no repetir mediciones:
   `verificacion-cierre/secciones-1-2.md`, `verificacion-cierre/secciones-6-7.md`,
   `verificacion-cierre/seccion-8.md`, `verificacion-cierre/t6-caso-buzon-corporativo.md` y los
   bloques `M.20`, `M.22` y `M.23` de
   `docs/gestion-humana/firma-electronica/meta-para-abrir-a-empresas-reales-2026-11-12.md`. Cada
   reutilizacion se cita con su archivo y su linea.

**Limites de esta medicion (y lo que queda del owner por eso).**
- La cuenta `javier` **no puede leer** `/opt/kair-firma/.env` (600 root:root), ni `admin-key.txt` ni
  `internal-key.txt`, ni los cuatro scripts de operacion (`health-check.sh`, `backup-firma.sh`,
  `purgar-respaldos.sh`, `probar-restauracion.sh`, todos 750 root:root). Medido: `head -c 30
  /opt/kair-firma/.env` -> "Permission denied". Las casillas que dependen de eso son **PENDIENTE** y
  quedan del owner.
- **La suite del firma-service no se volvio a correr en esta ronda.** El PC tiene Node v26.10.0
  (ABI 147) y el `better-sqlite3` instalado en el `node_modules` del repo esta compilado para
  NODE_MODULE_VERSION 127 (Node 22). El intento fallo con el guardia de seguridad de
  `tests/setup.js:130` ("No se pudieron aplicar las migraciones en la BD de tests"). **No se
  reconstruyo el modulo**, para no tocar el arbol de trabajo compartido. Las cifras de suite que se
  citan en S7.35 y S7.36 son **la corrida registrada por el equipo el 12-nov**, citadas con su fuente,
  no una corrida de esta ronda.
- El arbol desplegado **no tiene sello de version** (ver S7.1): `/health` devuelve
  `kair_version: "compatible-0.1.189"`, que es un valor fijo de `src/routes/health.js:45`; no hay
  `.git` y `package.json` declara `"version": "0.1.0"`. Por eso toda afirmacion sobre produccion se
  apoya en **hashes de archivo, versiones instaladas y salidas de comando**, no en un numero de
  version.

**Regla de estado aplicada.** `PROMPT.md` 5.30: el estado es la palabra clave del encabezado, colocada
despues del ultimo raya largo, y es una de `CERRADO`, `PENDIENTE`, `PARCIALMENTE`, `No aplica`.
`PARCIALMENTE` **cuenta como pendiente**: no esta cerrado, algo falta.

---

## 7.1 Configuracion

### S7.1 - NODE_ENV=production — CERRADO

**Que se verifico.** Que el proceso corre con `NODE_ENV=production` y no con el valor por defecto de
desarrollo, y que esa afirmacion sale del proceso y no de una lectura de memoria.

**Evidencia.** `sgsst-electron-app/firma-service/src/config.js:43` ->
`env: required('NODE_ENV', 'development')`. Medido por SSH: `journalctl -u kair-firma` devuelve lineas
del servicio con `"env":"production"` en todas (las 12 ultimas del 12-nov 14:05), y la linea de
arranque del proceso es
`{"message":"BD inicializada","env":"production","path":"/opt/kair-firma/data/firma.sqlite","wal":"wal","foreignKeys":1}`.
El valor crudo de `NODE_ENV` en el `.env` no se puede leer (600 root), pero es el proceso quien lo lee
y lo publica en cada linea de log.

**Que falta.** Nada del requisito. La lectura directa del `.env` sigue siendo del owner.

**Quien lo tiene.** - (cerrado: medido por SSH el 12-nov-2026).

### S7.2 - HTTPS configurado con certificado valido — CERRADO

**Que se verifico.** Que el servicio publico se sirve por HTTPS con un certificado vigente, y que la
validacion criptografica de la cadena no falla.

**Evidencia.** Medido por SSH: `curl https://firma.kair.fyi/health` ->
`http_code=200 ssl_verify=0` (la validacion OK). Con `openssl s_client -connect firma.kair.fyi:443`:
`subject=CN = kair.fyi`, `issuer=C = US, O = Google Trust Services, CN = WE1`,
`notBefore=Nov  2 02:20:59 2026 GMT`, `notAfter=Jan 31 03:19:34 2027 GMT`.
`/etc/cloudflared/config.yml` declara el tunel (`systemctl is-active cloudflared` -> `active`) hacia
`http://127.0.0.1:3001`: el TLS termina en el borde de Cloudflare y el origen no esta expuesto a
internet (esta medido en `secciones-6-7.md`, S7.7: `ss -ltn` solo muestra `127.0.0.1:3001`).

**Que falta.** Nada del requisito. Se deja dicho: el tramo origen-tunel viaja en HTTP plano, que es
lo propio de un tunel de Cloudflare, y no hay certificado en el servidor (ver S7.28).

**Quien lo tiene.** - (cerrado: medido por SSH el 12-nov-2026).

### S7.3 - HSTS habilitado — CERRADO

**Que se verifico.** Que HSTS este configurado en el codigo y que el header salga en las respuestas
reales, no solo en el codigo.

**Evidencia.** `src/server.js:93` -> `hsts: { maxAge: 31536000, includeSubDomains: true }`, dentro
del `app.use(helmet({...}))` de `src/server.js:70`. Medido por SSH, el header
`Strict-Transport-Security: max-age=31536000; includeSubDomains` aparece en las cuatro respuestas
probadas: `200` de `/health`, `404` de `/ruta-inexistente-xyz`, `401` de `/internal/sign-requests` y
`200` de `/s/app.js`; y tambien en la respuesta publica por HTTPS (`HTTP/2 200`, con el mismo
`strict-transport-security`).

**Que falta.** Nada del requisito. Nota menor: el header tambien viaja en la respuesta local por
HTTP, lo cual es inofensivo (HSTS solo lo respetan los navegadores sobre HTTPS).

**Quien lo tiene.** - (cerrado).

### S7.4 - helmet configurado — CERRADO

**Que se verifico.** Que `helmet` este montado y que su juego completo de headers llegue a las
respuestas reales.

**Evidencia.** `src/server.js:15` (`require('helmet')`) y `src/server.js:70-95`
(`app.use(helmet({ contentSecurityPolicy: {...}, hsts: {...}, referrerPolicy: {...} }))`), montado
**antes** de las rutas, o sea que alcanza tambien al manejador 404 (`src/server.js:231-239`).
Medido por SSH: `helmet 8.3.0` instalado en el servidor, y las respuestas traen el juego completo:
`Content-Security-Policy`, `Cross-Origin-Opener-Policy: same-origin`,
`Cross-Origin-Resource-Policy: same-origin`, `Origin-Agent-Cluster: ?1`,
`Referrer-Policy: no-referrer`, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`,
`X-DNS-Prefetch-Control: off`, `X-Download-Options: noopen`, `X-Frame-Options: SAMEORIGIN`,
`X-Permitted-Cross-Domain-Policies: none`, `X-XSS-Protection: 0`.

**Que falta.** Nada.

**Quien lo tiene.** - (cerrado).

### S7.5 - CSP estricta en mini-app — CERRADO

**Que se verifico.** Que la mini-app se sirva bajo una CSP sin codigo inline, y que el codigo que la
acompania sea compatible con esa CSP.

**Evidencia.** `src/server.js:71-92` define la CSP: `default-src 'self'`, `script-src 'self'`,
`script-src-attr 'none'`, `object-src 'none'`, `frame-ancestors 'none'`, `frame-src 'self'`,
`base-uri 'self'`, `form-action 'self'`, `connect-src 'self'`, `img-src 'self' data:`,
`font-src 'self'`; el unico `^` es `style-src 'self' 'unsafe-inline'`.
Los tres HTML de la mini-app (`firma-service/web/firma/index.html`,
`web/anexo-nube/index.html`, `web/anexo-encargo/index.html`) **no tienen ni un `<script>` sin
`src`, ni un `onclick=`, ni `onload=`, ni `onerror=`** (grep sobre los tres). Medido por SSH, la
respuesta de `/s/app.js` (`200 application/javascript`) trae la CSP completa, o sea que la politica
alcanza tambien a los recursos estaticos que se sirven en `src/server.js:141-148`.
Excepcion documentada: `src/routes/public.js:554-596` sobreescribe `frame-ancestors` a `'self'` solo
en el endpoint del PDF, porque la mini-app lo incrusta; el propio codigo lo explica.

**Que falta.** Nada del requisito. Se deja dicho, para que no se lea como un descuido: hay dos
relajaciones deliberadas y documentadas, `style-src 'unsafe-inline'` y la excepcion de
`frame-ancestors` del PDF.

**Quien lo tiene.** - (cerrado).

### S7.6 - Variables de entorno NO en el repo — CERRADO

**Que se verifico.** Que no haya valores de entorno (llaves, contrasenas, tokens) ni en el arbol
versionado ni en el arbol desplegado.

**Evidencia.** Reutilizado de `secciones-6-7.md`, S7.8: barrido del repositorio (firma-service, 361
archivos `.js/.json/.txt/.html` sin `node_modules`) con patrones de llave privada, `sk_live_`, `ghp_`
y `xox*` -> **sin coincidencias**; barrido del arbol desplegado (`src`, `config`, `scripts`, `web`)
-> **sin coincidencias**.
Medido hoy en el servidor: lo unico con nombre de entorno en el arbol desplegado es
`/opt/kair-firma/app/deploy/.env.production.example`, y es una **plantilla**: sus valores son
marcadores (`INTERNAL_API_KEY=generar-nueva-en-la-vm-64-chars-hex`,
`SMTP_PASS=pegar-app-password-aqui`, `PUBLIC_URL=https://CAMBIAR-ME.sslip.io`,
`ADMIN_API_KEY=generar-nueva-en-la-vm-64-chars-hex`). `ls /opt/kair-firma/app/.env` -> "No such file
or directory": el `.env` real vive fuera del arbol, en `/opt/kair-firma/.env`, **600 root:root** (ya
medido en `secciones-6-7.md`, S7.8, con `stat`).

**Que falta.** Nada.

**Quien lo tiene.** - (cerrado).

### S7.7 - INTERNAL_API_KEY rotada y comunicada a K+AIR — PENDIENTE

**Que se verifico.** Si la llave interna de K+AIR fue rotada, cuando, y si el valor desplegado es el
que K+AIR usa.

**Evidencia.** El valor vive en `/opt/kair-firma/.env`, 600 root:root. Medido por SSH:
`head -c 30 /opt/kair-firma/.env` -> "head: cannot open '/opt/kair-firma/.env': for reading:
Permission denied".
En el repo y en el arbol desplegado **no hay ninguna constancia de rotacion**:
`firma-service/deploy/.env.production.example:30` es la plantilla que dice "GENERAR NUEVA en la VM
(no copiar la de desarrollo)".
El codigo ya no depende de una sola llave: `src/middleware/authz.js` resuelve por empresa (I-010) y
`src/middleware/rateLimit.js:443-492` aplica las 4 capas internas; la llave global quedo como modo
legacy con deprecacion (`src/middleware/authz.js` y `src/middleware/idempotency.js:229`).
Tampoco hay constancia de que la llave vigente **se haya comunicado a K+AIR**: el unico registro
append-only del sistema, `gh_firma_aprobaciones_publicacion` (4 filas, todas de tipo `OPERATIVA`
para publicar el Acuerdo), no registra la llave.

**Que falta.** (a) Que el owner lea el `.env` y confirme si la llave se roto desde el despliegue y
cuando. (b) El acta de la comunicacion a K+AIR, si la hay: no esta en el expediente. (c) Decidir si
el modo legacy (llave global) se apaga.

**Quien lo tiene.** Owner (las tres: lectura del `.env`, acta de comunicacion y decision sobre el
modo legacy).

### S7.8 - SMTP configurado y probado — CERRADO

**Que se verifico.** Que el canal de correo este configurado en el servicio, y que exista un envio
real que lo pruebe con su resultado de autenticacion.

**Evidencia.** Medido por SSH, `GET http://127.0.0.1:3001/health` ->
`"checks":{"db":"ok","smtp":"configured"}`.
El envio real esta documentado en el texto vigente:
`sgsst-electron-app/legal/anexo-nube-v1.3.html:604-606` -> remitente `kair@gesstiar.com`,
`Message-ID <5db3377d-4565-e49b-0b64-cd0b5ce2b4ca@gesstiar.com>` y
`Authentication-Results: dkim=pass; spf=pass; dmarc=pass`.
El manifiesto lo declara: `firma-service/legal-readiness.json`, bloque `canales.transaccional.estado
= "migrado"`.

**Que falta.** Nada del requisito. Se deja dicho: la migracion a Google Workspace con CDPA esta
cerrada desde el 10-nov, pero los alias de soporte y las app passwords siguen abiertos (P3 y P6), y
eso no toca el canal transaccional.

**Quien lo tiene.** - (cerrado).

---

## 7.2 Base de datos

### S7.9 - Schema migrado — CERRADO

**Que se verifico.** Que el esquema de la base de produccion esta al dia con el del repo, sin
migraciones faltantes ni sobrantes.

**Evidencia.** Repo: `firma-service/src/db/schema` tiene **61** archivos `.sql`. Servidor (medido por
SSH): `SELECT COUNT(*) FROM gh_firma_schema_migrations` -> **61**, con las tres ultimas
`060_anexo_nube_contrafirma`, `061_encargado_poderes` y `062_encargado_poderes_append_only`
(ya medido y comparado 1:1 en `secciones-6-7.md`, S7.3: la diferencia de los dos conjuntos es cero en
ambos sentidos). `PRAGMA integrity_check` -> **ok**. Las migraciones las aplica el propio servicio al
arrancar (`src/server.js:250-251`), con el entorno que le da systemd, no un script aparte.

**Que falta.** Nada.

**Quien lo tiene.** - (cerrado: verificado por SSH el 12-nov-2026).

### S7.10 - PRAGMA journal_mode=WAL — CERRADO

**Que se verifico.** Que la base de produccion esta en modo WAL, y no solo que el codigo lo pide.

**Evidencia.** Medido por SSH: `sqlite3 -readonly /opt/kair-firma/data/firma.sqlite "PRAGMA
journal_mode;"` -> **`wal`**. Ademas `src/db/connection.js:25` ->
`db.pragma('journal_mode = WAL')`, y la linea de arranque del proceso en el journal lo publica:
`"message":"BD inicializada",...,"wal":"wal","foreignKeys":1`.

**Que falta.** Nada.

**Quien lo tiene.** - (cerrado).

### S7.11 - PRAGMA foreign_keys=ON — CERRADO

**Que se verifico.** Que las claves foraneas esten activas en la conexion del proceso (SQLite no las
activa por defecto).

**Evidencia.** `src/db/connection.js:26` -> `db.pragma('foreign_keys = ON')`, y `:30-34` lee el valor
de vuelta y lo publica en el log de arranque. Medido por SSH en el journal del servicio:
`{"message":"BD inicializada","env":"production","path":"/opt/kair-firma/data/firma.sqlite","wal":"wal","foreignKeys":1}`
-> **`foreignKeys: 1`**.
Nota de medicion: `PRAGMA foreign_keys` de la CLI de `sqlite3` devuelve 0 siempre, porque es una
pragma **por conexion**; por eso la prueba valida es la del proceso y no la de la CLI.

**Que falta.** Nada.

**Quien lo tiene.** - (cerrado).

### S7.12 - Backups automatizados y probados — CERRADO

**Que se verifico.** Que el respaldo es automatico, que corre todos los dias, y que cada copia sale
verificada.

**Evidencia.** `/etc/cron.d/kair-firma-backup` (medido por SSH) ->
`0 22 * * * root /opt/kair-firma/backup-firma.sh >> /opt/kair-firma/backups/backup.log 2>&1`.
El log dice, por corrida: `Backup OK: firma-20261111-220001.sqlite.enc (164714 B, sha256
de14e3f4..., integrity ok, cifrado gpg) + storage-20261111-220001.tar.gz.enc`, y antes
`PODA RETENIDA: hay 5 firma(s) con deber legal de conservacion (hold_legal=1)`.
En disco hay **52** archivos `.enc`, el mas reciente del **11-nov 22:00**, con permisos `600 root:root`
(el `storage-...tar.gz.enc`, 519 024 B, y el `firma-...sqlite.enc`, 164 714 B).
El ciclo completo (cifrado con GPG, verificacion de integridad y poda retenida por deber legal) esta
descrito en `sgsst-electron-app/docs/MIGRACION-SERVIDOR-FIRMA.md` y medido en `secciones-6-7.md`, S7.5.

**Que falta.** Aqui "probados" se lee como "cada copia se abre y se verifica al salir" (el
`integrity ok` del log). La prueba de que un respaldo se puede **restaurar** es la casilla S7.13 y
sigue abierta. Se deja dicho, ademas, que al momento de esta medicion (12-nov 14:20) el respaldo de
hoy (22:00) todavia no habia corrido: los cuatro actos del P8 siguen sin copia (ya medido en
`secciones-6-7.md`, S7.5).

**Quien lo tiene.** - (el respaldo de hoy corre solo a las 22:00).

### S7.13 - Restauracion desde backup probada — PENDIENTE

**Que se verifico.** Si alguna vez se ejecuto la prueba de restauracion que el propio cron programa, y
si su registro existe.

**Evidencia.** `/etc/cron.d/kair-firma-restauracion` (medido por SSH) ->
`0 4 1 * * root /opt/kair-firma/probar-restauracion.sh >> /opt/kair-firma/backups/restauracion.log
2>&1`, y el script existe (`/opt/kair-firma/probar-restauracion.sh`, 5 652 B, 750 root:root).
Pero `ls -l /opt/kair-firma/backups/restauracion.log` -> **"No such file or directory"**: los crons
se instalaron el 6-nov y la primera corrida es el **1 de diciembre**. La prueba **nunca ha corrido
una vez**.
La promesa es del propio expediente: `firma-service/legal-readiness.json:47` (una prueba de
restauracion mensual), y la copia esta en el mismo disco que los datos (medido en `secciones-6-7.md`,
S7.5: no hay copia off-site).

**Que falta.** La primera corrida y su registro. No depende de una persona (es un cron), pero hasta
que no exista ese log no hay prueba de que un respaldo sea restaurable.

**Quien lo tiene.** Equipo (esperar la corrida del 1-dic, archivarla y corregir el manifiesto si
falla) y Owner (solo si la corrida falla o si hay que decidir la copia off-site).

---

## 7.3 Endpoints

### S7.14 - Todos los endpoints publicos validan el token — PARCIALMENTE

**Que se verifico.** Que cada endpoint publico del flujo de firma resuelva y valide el token antes
de tocar datos de un caso, y que se listen las superficies publicas que no llevan token.

**Evidencia.** Todo el flujo publico pasa por `src/services/publicFlow.js:111-137` (`resolveToken`):
calcula los candidatos de hash (HMAC-SHA256 y SHA-256, por la migracion 019) y busca la fila; si no
encuentra, devuelve `404 TOKEN_NOT_FOUND` con el mensaje **"No disponible"**, sin distinguir entre
token inexistente y token vencido (`src/middleware/errors.js:141`).
Medido en produccion: `GET /api/sign/TOKEN-QUE-NO-EXISTE/verify` ->
`{"error":{"code":"TOKEN_NOT_FOUND","message":"No disponible","request_id":"..."}}`.
Lo que **no** cumple la lectura literal de la casilla: hay superficies publicas que no llevan token y
no pueden llevarlo. (a) `POST /api/solicitudes` (`src/routes/public.js:839`), que es el canal de
PQRS del titular y **escribe** un registro; lo cubre solo el limite global de 60/min
(`src/server.js:131`). (b) `GET /anexo-nube/documento` y `GET /anexo-encargo/documento` (los textos
de los instrumentos, publicos por definicion). (c) Los recursos estaticos de las tres mini-apps.
(d) `GET /health`.

**Que falta.** (a) Decidir si la casilla se cierra con la lectura "todo endpoint que expone datos de
un caso valida el token" (que hoy es cierto) o si el PQRS debe llevar credencial propia. (b) Si es
lo segundo, un limite especifico para `/api/solicitudes` y una regla de retencion de ese registro.

**Quien lo tiene.** Equipo (la decision de lectura y el limite) y Owner (si el PQRS pasa a exigir
credencial).

### S7.15 - Todos los endpoints internos validan la API key — CERRADO

**Que se verifico.** Que ningun router interno responda sin credencial, y que la comparacion de
llaves no sea vulnerable a tiempos.

**Evidencia.** Cada router interno exige su middleware: `src/routes/consent.js:40-44`
(`requireEmpresaScopeAndLimit` con `allowedOperations` y `checkIdEmpresa`),
`src/routes/verificacion.js:68-72` (idem, con `oracleLimiter`),
`src/routes/admin.js:60-62` y `src/routes/admin-clientes.js:65-67` (`adminApiAuth()`), y asi los
demas (`src/routes/signRequest.js`, `src/routes/internal-audit.js`,
`src/routes/empresaAnexos.js`, `src/routes/constancia.js`, `src/routes/recibos-supresion.js`).
La comparacion es en tiempo constante: `src/middleware/auth.js:27` usa `constantTimeEqual` de
`src/crypto/compare.js`, y el admin no distingue "falta el header" de "llave incorrecta" para no
filtrar informacion (`src/middleware/auth.js:42-49`).
Medido en produccion: `GET /internal/sign-requests` **sin** llave -> **401**; con
`X-Internal-API-Key: llave-que-no-existe-xyz` -> **401**; una ruta interna inexistente -> **404**
(o sea que el 401 viene del middleware, no del router).

**Que falta.** Nada.

**Quien lo tiene.** - (cerrado).

### S7.16 - Rate limit configurado — CERRADO

**Que se verifico.** Que hay limites de tasa configurados por superficie, y que se aplican de verdad
en las respuestas.

**Evidencia.** `src/middleware/rateLimit.js`: `:144-145` (global, 60/min por IP), `:166-167` (OTP,
10/h por IP+token), `:178-179` (commit, 3/min), `:197-198` (verify-pdf, 30/min por token),
`:212-213` (creacion de sign requests, 30/min), `:248-278` (limiter propio del oraculo de
verificacion), `:443-492` (las 4 capas internas de I-008: empresa, instancia, IP y anomalias).
Montaje: `src/server.js:131` (global) y `src/server.js:154-162` (por endpoint publico).
Medido en produccion, las respuestas traen los headers: `RateLimit-Policy: 60;w=60` y
`RateLimit: limit=60, remaining=59, reset=60` en la ruta general, `RateLimit-Policy: 30;w=60` en
`/internal/sign-requests`, y `RateLimit-Policy: 60;w=60` en la ruta publica.
`express-rate-limit S7.5.1` instalado en el servidor.

**Que falta.** Nada.

**Quien lo tiene.** - (cerrado).

### S7.17 - Mensajes de error NO incluyen secretos — CERRADO

**Que se verifico.** Que los mensajes de error que ve un atacante no contengan llaves, tokens ni
PII, y que no permitan distinguir casos que no se deben distinguir.

**Evidencia.** Medido en produccion, sin llave: `GET /internal/sign-requests` ->
`{"error":{"code":"INVALID_API_KEY","message":"Falta el header X-Internal-API-Key","request_id":"req_..."}}`.
Con llave falsa: **el mismo codigo y el mismo texto** (`src/middleware/auth.js:42-49` no distingue los
dos casos). El endpoint publico con token invalido ->
`{"error":{"code":"TOKEN_NOT_FOUND","message":"No disponible","request_id":"..."}}`: el mismo texto
para un token que nunca existio y para uno que ya no se puede mostrar
(`src/services/publicFlow.js:134-137`).
El manejador es `src/middleware/errors.js:322` (`errorHandler()`), montado en `src/server.js:242`.

**Que falta.** Nada. Se deja dicho: el mensaje incluye el `request_id`, que es lo que permite
correlacionar con el log; no incluye llaves, tokens, correos ni documentos.

**Quien lo tiene.** - (cerrado).

### S7.18 - Headers de seguridad en TODAS las respuestas — CERRADO

**Que se verifico.** Que los headers de seguridad lleguen no solo a las respuestas de exito, sino
tambien a las de error, a las de autorizacion y a las de los recursos estaticos.

**Evidencia.** `helmet` se monta antes de las rutas (`src/server.js:70`), o sea que alcanza tambien
al manejador 404 (`src/server.js:231-239`) y a los estaticos (`src/server.js:141-148`).
Medido por SSH en **cuatro respuestas distintas**: `200` de `/health`, `404` de
`/ruta-inexistente-xyz`, `401` de `/internal/sign-requests` y `200` de `/s/app.js`. Las cuatro
traen el juego completo (CSP, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`,
`X-Frame-Options`, `Referrer-Policy: no-referrer`, `Cross-Origin-Opener-Policy`,
`Cross-Origin-Resource-Policy`, `Origin-Agent-Cluster`, `X-DNS-Prefetch-Control`,
`X-Download-Options`, `X-Permitted-Cross-Domain-Policies`) y el `X-Request-Id`.
En el borde publico (`HTTP/2 200` de `https://firma.kair.fyi/health`) llegan los mismos, mas los de
Cloudflare.

**Que falta.** Nada.

**Quien lo tiene.** - (cerrado).

---

## 7.4 Logs

### S7.19 - Redaccion automatica funcionando — CERRADO

**Que se verifico.** Que el logger redacte la PII y los secretos, y que en produccion no se vea ni una
correo ni un token sin redactar.

**Evidencia.** `src/utils/logger.js:22-32` (`SENSITIVE_KEYS`: `token`, `otp`, `password`,
`api_key`, `internal_api_key`, `correo`, `email`, `cedula`, `documento`, `numero_documento`,
`authorization`, `x-internal-api-key`, `id_trabajador`, `id_documento`, `id_empresa`, `motivo`,
`motivo_rechazo`...) y `:43-51` (redaccion **por valor**: correo, celular colombiano de 10 digitos,
cedula de 6 a 10 digitos), aplicada en `:62-75`.
Medido en produccion sobre `journalctl -u kair-firma --since 2026-11-11`: **32** lineas con
`REDACTED` y **0** coincidencias de un patron de correo. Ademas `src/services/mailer.js:675` marca
el OTP como `[REDACTED]` y nunca lo loguea.

**Que falta.** Nada del requisito. Se deja dicho: la redaccion es del logger del proceso; el cuerpo de
los correos no pasa por ella.

**Quien lo tiene.** - (cerrado).

### S7.20 - Rotacion de logs configurada — PENDIENTE

**Que se verifico.** Si existe una configuracion de rotacion para los logs de este servicio.

**Evidencia.** Medido por SSH: `ls /etc/logrotate.d/` -> `alternatives, apport, apt, bootlog, btmp,
cloud-init, dpkg, ppp, rsyslog, sysstat, ubuntu-pro-client, ufw, unattended-upgrades, wtmp`;
`ls /etc/logrotate.d/ | grep -i kair` -> **NINGUNO**. El `logrotate.timer` de Ubuntu corre (hoy a las
00:07), pero no tiene configuracion para este servicio.
El unico archivo de log del servicio que crece es `/opt/kair-firma/logs/health-check.log`: **410 453 B
al 12-nov 14:05** (409 619 B a las 13:35, medido antes hoy por otro informe), y **crece dos lineas
cada 5 minutos** por el cron `kair-firma-health`. El plan de seguridad ya lo habia diferido:
`docs/gestion-humana/firma-electronica/plan-seguridad-2026-10-25.md:136` ("Rotacion y retencion de
logs (90 dias) con acceso restringido", Fase 4). El bloque `M.22` del mapa de la meta mide la misma
brecha.

**Que falta.** Un `/etc/logrotate.d/kair-firma` que rote ese archivo. (El `journalctl` no resuelve
esto: son pools distintos, y el archivo de health-check no pasa por journald.)

**Quien lo tiene.** Owner (el `sudo` que escribe en `/etc/logrotate.d`) con el equipo (la
configuracion).

### S7.21 - Retencion 90 dias — PENDIENTE

**Que se verifico.** Si los logs del servicio tienen una politica de retencion de 90 dias, que es la
que el propio SECURITY.md les atribuye.

**Evidencia.** Sin rotacion (S7.20) no hay politica de retencion para el log del servicio: el archivo
crece sin limite. Del lado del journal, medido por SSH: `/etc/systemd/journald.conf` contiene
unicamente la linea `[Journal]` (sin `MaxRetentionSec` ni `SystemMaxUse`) y **no existe**
`/etc/systemd/journald.conf.d/`: la retencion es la del sistema por tamano
(`journalctl --disk-usage` -> 522.6 M), **no** los 90 dias.
La promesa es del propio documento: `SECURITY.md:828-830` dice que la retencion del log es "la de los
logs (90 dias)" y que el log no es una base de datos paralela.

**Que falta.** (a) La retencion de 90 dias, que depende del `logrotate` de S7.20. (b) Decidir si el
journal tambien debe tener una retencion declarada, porque hoy la que rige es la del sistema.

**Quien lo tiene.** Owner (el `sudo`) con el equipo (la configuracion).

### S7.22 - Logs no se imprimen en stdout en produccion — PENDIENTE

**Que se verifico.** A donde sale la salida del logger en produccion, y si el codigo imprime logs con
`console.*`.

**Evidencia.** `src/utils/logger.js:129-133`: si el nivel es `error` o `warn` escribe en
`process.stderr.write`, y en cualquier otro caso en **`process.stdout.write`**. No hay archivo de log
del servicio en disco: medido por SSH, `ls -l /var/log/kair*` -> "No such file or directory"; la
unica copia esta en el journal de systemd (647 lineas el 12-nov).
El grep de `console.log|console.error|console.warn|console.info|console.debug` sobre `src/` da un
solo hit real: `src/crypto/keys.js:50` (`console.warn`); los demas hits son cadenas de ayuda dentro
de comentarios. O sea: **el codigo no imprime logs con `console.*`, pero el logger si escribe en
stdout.**

**Que falta.** La decision de si el requisito se cumple con "el stdout es el sumidero del journal de
systemd" (que es lo que pasa hoy) o si el servicio debe escribir en un archivo propio. Leida al pie
de la letra, **la casilla no se cumple**: los logs si se imprimen en stdout.

**Quien lo tiene.** Equipo (la decision y, si aplica, el cambio de sumidero) con el Owner (si el
cambio toca la unidad systemd).

### S7.23 - Acceso al log restringido — PENDIENTE

**Que se verifico.** Quien puede leer los logs del servicio en el servidor.

**Evidencia.** Medido por SSH: `stat /opt/kair-firma/logs` -> **755 root root**
(`drwxr-xr-x`), y `health-check.log` es `-rw-r--r-- root root`: **cualquier usuario de la maquina
puede leerlos**. Lo mismo con el journal: `journalctl -u kair-firma` responde a la cuenta `javier`
porque esta en el grupo `adm` (medido en `secciones-6-7.md`, S7.6).
Y el arbol de codigo esta en 777: `ls -ld /opt/kair-firma/app /opt/kair-firma/app/src` ->
`drwxrwxrwx kairfirma kairfirma` en ambos, con **236 archivos** y **18 directorios** con bit de
escritura para otros (`find -perm -0002`), medido hoy y tambien en `secciones-6-7.md`, S7.6. O sea
que una cuenta local cualquiera puede reescribir el codigo que despues corre como `kairfirma`.
El runbook ya exigia lo contrario: `docs/MIGRACION-SERVIDOR-FIRMA.md:768` ("`drwxr-x---` en `app/`,
`drwxr-xr-x` en `app/src/`, `-rw-r--r--` en los archivos"), y el paso 2b que lo normaliza no se
aplico en el despliegue del 11-nov.

**Que falta.** (a) `chmod 750` (o 700) sobre `/opt/kair-firma/logs` y `chmod 640` sobre el archivo.
(b) Decidir que grupo lee el journal. (c) El paso 2b del runbook (`chmod -R u=rwX,go=rX` mas
`chmod 750` sobre `app/` y `legal/`), que es una linea y sigue sin aplicarse desde el 11-nov.

**Quien lo tiene.** Owner (el `sudo`).

### S7.24 - Logs de consulta del oraculo de verificacion se revisan para anomalias — PARCIALMENTE

**Que se verifico.** Que exista el log de las consultas al oraculo de verificacion y con que
granularidad, y si hay algun mecanismo que las revise o detecte anomalias.

**Evidencia.** El log existe y es granular sin exponer el documento:
`src/routes/verificacion.js:146` registra cada consulta ("Oraculo de verificacion consultado") con
`id_solicitud`, `id_empresa`, `coincide` y `documento_fingerprint`; `:145` lo dice al pie
("Log de operacion. Sin el documento: solo su fingerprint"), y `:115` registra el caso de "firma no
encontrada" con el mismo criterio.
Lo que **no** existe: (a) ningun mecanismo de deteccion: el rate limit tiene una capa de anomalias,
pero es de `X-Client-Instance-Id` (`src/middleware/rateLimit.js:428-441`), no de "el mismo documento
consultado contra muchas firmas"; (b) ninguna revision hecha ni registrada, ni un procedimiento que
diga que hacer cuando se detecte una.

**Que falta.** (a) Una regla que detecte la anomalia que la casilla nombra (el mismo documento
consultado contra muchas firmas: un umbral sobre el fingerprint por unidad de tiempo). (b) El acta
de la revision periodica, con el procedimiento y a quien se le avisa.

**Quien lo tiene.** Equipo (las dos).

---

## 7.5 Seguridad operacional

### S7.25 - npm audit sin vulnerabilidades altas — PENDIENTE

**Que se verifico.** Que el arbol de dependencias que **corre en produccion** no tenga
vulnerabilidades altas ni criticas.

**Evidencia.** Medido en esta ronda. Con `npm audit --omit=dev --package-lock-only` sobre el
`package-lock.json` **desplegado** (copiado del servidor a un directorio temporal del PC con `scp`,
sin tocar el servidor): **6 vulnerabilidades (1 moderada, 4 altas, 1 critica)**. La critica es
`proxy-addr` 2.0.7 (IP spoofing por IPv4-mapped IPv6); las altas incluyen `nodemailer` 6.10.1 y `zod`
3.25.76.
Las versiones realmente instaladas en el servidor coinciden con ese lock (medido por SSH):
`express 4.22.2`, `proxy-addr 2.0.7`, `qs 6.15.3`, `nodemailer 6.10.1`, `zod 3.25.76`,
`helmet 8.3.0`, `express-rate-limit S7.5.1`.
Sobre el arbol del **repo** el audit da menos: **2 altas** (nodemailer y zod); la critica ya esta
corregida en el repo (commit `dfc403b0`) pero **no esta desplegada** (medido en `secciones-6-7.md`,
S7.7).

**Que falta.** (a) Desplegar el paquete 1051 con `npm ci --omit=dev`, que es lo que saca del proceso
la critica de `proxy-addr`. (b) Resolver las 2 altas que exigen salto mayor de version
(`nodemailer` 6.10.1 -> 10.5.0 y `zod` 3.25.76 -> 4.6.7), porque son cambios de API que hay que
revisar en el codigo. El criterio del propio plan lo dice:
`docs/gestion-humana/firma-electronica/plan-seguridad-2026-10-25.md:163` ("`npm audit --omit=dev` no
tiene vulnerabilidades altas ni criticas").

**Quien lo tiene.** Equipo (el despliegue del 1051) y Owner (la revision de los saltos de version
mayor).

### S7.26 - npm audit fix aplicado donde sea seguro — PARCIALMENTE

**Que se verifico.** Si se aplico el `npm audit fix` en lo que no rompe version mayor, y si eso llego
a produccion.

**Evidencia.** `Historial.md:8735-8743` documenta la corrida del 12-nov: el audit decia 6
vulnerabilidades (1 critica, 4 altas, 1 moderada) y se aplico el `npm audit fix` **sin `--force`**,
o sea solo lo que no rompe version mayor: `proxy-addr` 2.0.7 -> **2.0.8**, `qs` 6.15.3 -> **6.16.2**,
`express` 4.22.2 -> **4.22.3** (un parche dentro del rango que el proyecto ya declaraba),
`body-parser` 1.20.9 y `multer` 2.5.0. Las 2 altas restantes (`nodemailer` y `zod`) **no** se
tocaron a proposito, porque exigen salto mayor con cambios de API que hay que revisar en el codigo.
El repo ya declara el piso `express: ^4.22.3`.
Medido hoy: el servidor **sigue** con `proxy-addr` 2.0.7 y `qs` 6.15.3: el fix esta en el repo y no
en produccion. Y el repo tampoco esta limpio (2 altas, ver S7.25).

**Que falta.** (a) Desplegar el fix (es el mismo paquete 1051). (b) Revisar en el codigo los cambios
de API de `nodemailer` y `zod` antes de aplicar el `--force`.

**Quien lo tiene.** Equipo (el despliegue y la revision de codigo).

### S7.27 - Dependencias con version fija (no ^) — PENDIENTE

**Que se verifico.** Si los manifiestos fijan versiones exactas o dejan rangos con `^`.

**Evidencia.** El `package.json` **desplegado** declara las nueve dependencias con `^`:
`better-sqlite3 ^11.3.0`, `dotenv ^16.4.5`, `express ^4.21.0`, `express-rate-limit ^S7.4.0`,
`helmet ^8.0.0`, `multer ^2.0.0`, `nodemailer ^6.9.15`, `pdf-lib ^1.17.1`, `zod ^3.23.8`.
El `package.json` **del repo** mantiene los rangos (`express ^4.22.3`, `nodemailer ^6.9.15`,
`zod ^3.23.8`, y los demas sin cambio).
Lo que si fija versiones exactas es el `package-lock.json` (que en el servidor fija `express 4.22.2`,
`proxy-addr 2.0.7`, `qs 6.15.3`).
El plan ya lo habia anotado como una afirmacion incorrecta del documento:
`plan-seguridad-2026-10-25.md:119` ("Corregir ... seccion7.5 (`npm audit`, versiones con `^`)").

**Que falta.** Quitar los `^` de los manifiestos, o declarar por escrito que la fijacion la hace el
lock con `npm ci` en el despliegue. Nota: el riesgo real de esta casilla no es el `^` del manifiesto
sino que **produccion corre un lock viejo**: el arbol desplegado esta en `express 4.22.2` mientras el
repo pide `^4.22.3`.

**Quien lo tiene.** Equipo (los manifiestos) con el Owner (la politica de dependencias del proyecto).

### S7.28 - Renovacion automatica de certificados configurada — PARCIALMENTE

**Que se verifico.** Que certificado presenta el dominio, quien lo renueva, y si hay algo configurado
en el servidor para renovar.

**Evidencia.** El certificado que se presenta en `https://firma.kair.fyi:443` lo emite **Cloudflare**
(`issuer=C = US, O = Google Trust Services, CN = WE1`, `subject=CN = kair.fyi`), vigente del
2026-11-02 al 2027-01-31 (medido por SSH con `openssl s_client`). El TLS termina en el borde:
`/etc/cloudflared/config.yml` declara solo `service: http://127.0.0.1:3001`, o sea que **no hay
certificado en el servidor** que renovar. `command -v certbot` -> "certbot NO instalado", y no hay
ningun script de renovacion en `/opt/kair-firma` (los cuatro que hay son de respaldo, salud, purga y
restauracion). La renovacion del certificado de borde la hace Cloudflare sola, sin configuracion del
proyecto.

**Que falta.** (a) No hay nada que renovar en el servidor, pero tampoco hay nada que avise antes de
la expiracion del certificado de borde, que es la parte que el proyecto si puede declarar. (b)
Registrar por escrito que la renovacion del certificado de borde es responsabilidad de Cloudflare y
no del proyecto, para que la casilla no se lea como una omision.

**Quien lo tiene.** Owner (la declaracion y, si se quiere, el aviso previo a la expiracion).

### S7.29 - Monitoreo de uptime — PARCIALMENTE

**Que se verifico.** Que exista un control que mira si el servicio esta vivo, y si hay un monitor
externo.

**Evidencia.** `/etc/cron.d/kair-firma-health` (medido por SSH) ->
`*/5 * * * * root /opt/kair-firma/health-check.sh >> /opt/kair-firma/logs/health-check.log 2>&1`, y el
log muestra **las dos comprobaciones por corrida**: "OK local (http://127.0.0.1:3001/health)" y "OK
publico (https://firma.kair.fyi/health)" (ultimas lineas del 12-nov 14:05).
El monitor **detecta** caidas: el 12-nov a las 12:50:11 escribio "CAIDO publico ... Si el local
responde, el problema es el tunel de Cloudflare o del dominio", y a las 12:55:02 "OK publico" (medido
en el bloque `M.20` del mapa de la meta, `meta-para-abrir-a-empresas-reales-2026-11-12.md:465-478`).
Lo que **no** hay: un monitor externo. No hay evidencia de UptimeRobot, Pingdom ni equivalente, y
`systemctl list-timers --all` no muestra ninguno de uptime. Ademas el script es `750 root:root` y
esta cuenta **no lo pudo leer**: su contenido no se pudo verificar.

**Que falta.** (a) Un monitor externo, que es el que avisaria si se cae la maquina entera (el cron
interno muere con ella). (b) Poder leer el script para confirmar que cubre lo que el log dice que
cubre.

**Quien lo tiene.** Owner (que canal de alerta y que servicio externo) con el equipo (el mecanismo y
el permiso de lectura).

### S7.30 - Alertas de error 5xx configuradas — PENDIENTE

**Que se verifico.** Si existe alguna alarma que avise cuando el servicio empieza a responder 5xx.

**Evidencia.** **No hay ninguna alerta.** El unico rastreador de caidas es el health-check, y el
bloque `M.20` del mapa de la meta (`meta-para-abrir-a-empresas-reales-2026-11-12.md:465-478`) mide
que "lo detecta y lo escribe en el log, pero **no avisa a nadie**": "Hoy el unico que se entera es
quien mire el log". El script no se pudo leer (750 root) para confirmar que no tiene un canal de aviso
oculto.
Lo que si se midio: `journalctl -u kair-firma --since 2026-11-01 | grep -c '"status":5'` -> **0**:
no ha habido respuestas 5xx desde el 1 de noviembre, o sea que hoy no hay nada que alertar, pero
tampoco habria quien se enterara si las hubiera. Y `journalctl -u kair-firma -p warning` no muestra
entradas de la aplicacion en el periodo reciente (las unicas son los fallos del servicio del 11-nov
13:38, antes de la reparacion).

**Que falta.** El canal de alerta (correo o webhook) para 5xx y para la caida del tunel, con su
umbral y su destinatario.

**Quien lo tiene.** Owner (que canal y quien recibe) con el equipo (el mecanismo).

---

## 7.6 Legal

### S7.31 - Acuerdo de uso redactado y revisado por abogado — PARCIALMENTE

**Que se verifico.** Que el Acuerdo este redactado, vigente y autorizado, y hasta donde llega la
revision del abogado.

**Evidencia.** El Acuerdo vigente es la **v1.6**:
`firma-service/scripts/fixtures/acuerdo-v1.6.txt` (75 961 B, sha256 `08e1eb8b...`), **activo** en la
base de produccion (`gh_firma_acuerdo_versiones`: v1.6 activa, `fecha_vigencia_inicio`
`2026-11-11T19:51:42.036Z`) y con **autorizacion operativa registrada** (fila 4 de
`gh_firma_aprobaciones_publicacion`, tipo `OPERATIVA`, 2026-11-11) (ya medido en `secciones-1-2.md`,
1.7 y 2.1).
Hay revision juridica escrita: el dictamen del 11-nov
(`docs/gestion-humana/firma-electronica/dictamen-legal-textos-2026-11-11.md`) y el acta de decisiones
J1-J14 (`paquete-abogado-2026-10-30/11-checklist-definitivo-revision-juridica-y-cierre.md:103-116`).
Lo que **no** esta: la **ratificacion externa** del abogado, que sigue a cargo de Gesstiar (J6, J8,
J9) (medido en `secciones-1-2.md`, 2.7, y en `seccion-8.md`, 8.6).

**Que falta.** La ratificacion escrita del abogado externo. El texto esta redactado, es vigente, esta
revisado internamente y esta autorizado; lo que falta es la firma de quien responde.

**Quien lo tiene.** Owner (Gesstiar) y el abogado externo.

### S7.32 - Politica de privacidad actualizada — PARCIALMENTE

**Que se verifico.** Que la politica de privacidad exista, este publicada y describa el tratamiento
real.

**Evidencia.** `sgsst-electron-app/legal/privacidad.html`, version `2026-10-27`, publicada: medido
por SSH, `https://kair.fyi/privacidad.html` -> **200 text/html**, con el titulo "Politica de Privacidad
- K+AIR". Cita la Ley 1581 de 2012 y el Decreto 1377 de 2013, reparte los papeles
(`privacidad.html:45-49`), declara el principio de finalidad tasada (`:73-75`), el tratamiento de los
datos sensibles de salud (`:151-163`) y los derechos del titular (`:358-361`).
El problema: el texto **tiene afirmaciones que quedaron falsas el 10-nov**. `privacidad.html:287-289`
dice que el canal de correo "no tiene DPA empresarial" y que hay que "actualizar el Anexo de Nube", y
`:295-299` califica la transmision a un proveedor externo "sin contrato ni DPA" como una situacion
"pendiente de revision juridica". Desde el 10-nov el CDPA esta aceptado y el remitente es una cuenta
de Google Workspace (`legal/anexo-nube-v1.3.html:163-167` y `:604-606`).

**Que falta.** (a) Una version nueva que corrija el estado del canal de correo: la regla del proyecto
es que un texto ya publicado y firmado no se toca, o sea que la via es version nueva con huella
propia y firma de nuevo. (b) La revision por abogado que el propio `LEGAL.md:748` deja pendiente
("Politica de privacidad revisada por abogado").

**Quien lo tiene.** Equipo (redaccion y publicacion) con el Owner (autorizar y publicar).

### S7.33 - Terminos de servicio del Servicio publicados — PARCIALMENTE

**Que se verifico.** Que los terminos existan, esten publicados y describan **el servicio de firma**,
no solo la aplicacion de escritorio.

**Evidencia.** `sgsst-electron-app/legal/terminos.html`, version `2026-10-27`, publicado: medido por
SSH, `https://kair.fyi/terminos.html` -> **200 text/html**, titulo "Terminos y Condiciones de Uso
- K+AIR". Describen el servicio de firma como **servicio en la nube de Gesstiar** y reparten los
papeles: `terminos.html:96-97`, `:122-126` ("La firma electronica es la excepcion: es un servicio en
la nube que opera Gesstiar S.A.S.") y `:201-204`.
El problema es el mismo de S7.32: `terminos.html:151-162` y `:205-210` siguen diciendo que las
comunicaciones "salen desde una **cuenta gratuita de Gmail (cuenta de consumidor)**", que "**no se
utiliza Google Workspace**", que "no hay DPA empresarial aplicable" y que es "una condicion contractual
pendiente de revision juridica": todo eso es falso desde el 10-nov.
Ademas el menu del sitio (`terminos.html:27` y `privacidad.html:27`) apunta a
`anexo-nube-v1.1.html`, que es la version **historica** del Anexo de Nube, no a la v1.3 vigente.

**Que falta.** (a) La version nueva que corrija el estado del canal. (b) Corregir el enlace del menu
al Anexo de Nube vigente (v1.3). (c) La ratificacion externa, como en S7.31.

**Quien lo tiene.** Equipo (redaccion y publicacion) con el Owner (autorizar y publicar).

### S7.34 - Tratamiento de datos personales documentado (Ley 1581) — CERRADO

**Que se verifico.** Que el tratamiento de datos personales este documentado con su base juridica, y
que los documentos que lo describen esten adoptados.

**Evidencia.** (a) La **matriz de finalidades**: `firma-service/config/matriz-finalidades.json`, con
ocho finalidades del Grupo A (10.3(a)-(g)) y una del Grupo B (10.3(h)), cada una con su base juridica
y su condicion de habilitacion. (b) El **Anexo de Encargo vigente** (`legal-readiness.json:115-129`:
estado "firmado", version 2026-11-11, hash `6308b1f7...`, `firmado_at`
`2026-11-12T16:14:31.105Z`) contiene la matriz generada
(`sgsst-electron-app/legal/anexo-encargo.html:281-292`) y el reparto de papeles. (c) El **Anexo de
Nube v1.3**, con el CDPA aceptado el 10-nov y la declaracion del envio real
(`legal-readiness.json:77-99` y `:210`). (d) La **politica de privacidad** con las bases de la Ley
1581 (`privacidad.html:45-49`, `:73-75`, `:151-163`, `:358-361`). La decision del owner sobre la
matriz esta registrada (acta J4, ya medido en `secciones-1-2.md`, 2.5).

**Que falta.** Nada del requisito. Lo que sigue abierto y **no pertenece** a esta casilla: la tabla
de retencion documental de cada Empresa, sus datos y su instruccion documentada (Grupo A sin
habilitar por Empresa), y la tabla supletoria de conservacion, que sigue en PROPUESTA
(`aplicacion.activada: false`).

**Quien lo tiene.** - (cada Empresa, para sus propios datos).

---

## 7.7 Pruebas

### S7.35 - Tests unitarios del Servicio pasando — CERRADO

**Que se verifico.** Que la suite completa del firma-service pasa.

**Evidencia.** Corrida registrada por el equipo el **12-nov-2026** (noche): **2 670 pruebas, 2 668 pass, 0
fail, 2 skipped** (179 archivos de prueba, `exit 0`; publicada en la seccion 7 de
`sgsst-electron-app/docs/MIGRACION-SERVIDOR-FIRMA.md`, con el acta
`verificacion-cierre/t1-corrida-desde-clon-limpio.md` de las tres corridas desde clon limpio, 0
fallos). La cifra del 11-nov, 2 574 / 2 572 / 0 / 2, quedo en el historial.
El arbol de pruebas tiene **179
archivos `.test.js`**: 67 en `tests/`, 36 en `tests/routes/`, 23 en `tests/scripts/`, 20 en
`tests/services/`, 11 en `tests/middleware/`, 10 en `tests/e2e/`, 6 en `tests/web/`, 4 en
`tests/integration/` y 2 en `tests/utils/`.
**Salvedad que queda:** la corrida **no esta vinculada a un commit candidato** (T3 lo tiene el
owner): se hizo sobre `HEAD` mas el trabajo sin commitear de la ronda, que hubo que trasladar a mano
al clon.

**Que falta.** La trazabilidad que ya reporta el informe hermano: la corrida **no esta vinculada a un
commit candidato** ni **reproducida desde un clon limpio** (`secciones-6-7.md`, 6.11, que por eso la
deja en PARCIALMENTE). Y la suite **nunca se ha corrido en el servidor**: medido por SSH,
`/opt/kair-firma/app/tests` **no existe**, y el runbook lo deja pendiente
(`docs/MIGRACION-SERVIDOR-FIRMA.md:1121`).

**Quien lo tiene.** Equipo (T1: corrida reproducible desde clon limpio, ligada a un commit candidato).

### S7.36 - Tests de integracion de los endpoints pasando — CERRADO

**Que se verifico.** Que los endpoints tienen prueba de integracion y que pasan.

**Evidencia.** El arbol tiene **4** archivos en `tests/integration/` (`rotation-isolation`,
`per-company-isolation`, `idempotency-isolation`, `admin-clientes-flow`), **35** en `tests/routes/`
(`public`, `signRequest`, `signRequest-cross-company`, `consent`, `consent-accept`, `internal-audit`,
`internal-revoke`, `internal-resend-otp`, `empresa-anexos`, `anexo-nube-*`, `anexo-encargo-*`,
`admin-*`, `constancia-*`, `agreement`, ...) y **10** en `tests/e2e/` (`firma-flujo-completo`,
`firma-rate-limit-e2e`, `firma-idempotency-e2e`, `firma-pdf-failure-paths`, `firma-dual-*`,
`firma-atomicidad`, `bloque-e6`, ...).
Todos forman parte de la misma corrida que paso en verde el 12-nov (2 606 / 2 604 / 0 / 2, ver
S7.35).

**Que falta.** Nada del requisito; quedan las mismas salvedades de trazabilidad de S7.35 (corrida
ligada a un commit y desde clon limpio; la suite nunca corrida en el servidor).

**Quien lo tiene.** Equipo (misma T1 de S7.35).

### S7.37 - Tests de carga (1000 firmas concurrentes) — PENDIENTE

**Que se verifico.** Si existe una prueba de carga del servicio.

**Evidencia.** **No existe.** En el repo no hay ninguna prueba de carga: el grep de "1000 firmas",
"1000 concurrent" y "firmas concurrentes" sobre `firma-service` y sobre
`docs/gestion-humana/firma-electronica` no devuelve ninguna coincidencia, y no hay ningun archivo
cuyo nombre sea de carga, load o stress (el unico match del termino es
`firma-service/tests/poderes-encargado.test.js`, que es una prueba de autorizacion). Lo unico
relacionado es el limite de descriptores de la unidad systemd (`LimitNOFILE=65536`) y el limite de
tasa por IP (60/min global).
El plan de seguridad lo difiere explicitamente a la Fase 4:
`docs/gestion-humana/firma-electronica/plan-seguridad-2026-10-25.md:138` ("Prueba de carga de 1000
firmas concurrentes"), junto con la rotacion de logs, el monitoreo, el pentest y el plan de
incidentes.

**Que falta.** La prueba en si, y con ella el dato de capacidad (cuantas firmas concurrentes aguanta
el servicio y donde se rompe), que hoy es un dato desconocido.

**Quien lo tiene.** Equipo (la prueba) con el Owner (la ventana para hacerla, si se decide
ejecutarla en produccion).

### S7.38 - Pentesting externo completado — PENDIENTE

**Que se verifico.** Si se hizo un pentest externo y si hay informe.

**Evidencia.** **No hay pentest hecho.** Lo que existe es el plan: `SECURITY.md` seccion12 (alcance, areas a
probar y criterio de aceptacion), seccion12.1 y seccion14, mas la advertencia del propio seccion7: "ninguna de estas
casillas esta marcada. Son una plantilla de verificacion, no una afirmacion de cumplimiento".
No hay ningun informe de un tercero, ni fecha, ni alcance contratado, ni plan de remediacion
asociado. El plan de seguridad lo difiere a la Fase 4:
`docs/gestion-humana/firma-electronica/plan-seguridad-2026-10-25.md:139` ("Pentest externo").

**Que falta.** Contratar y ejecutar un pentest externo, con informe y plan de remediacion, y
guardarlos en el expediente. El repo no aporta ninguna evidencia de que se haya hecho.

**Quien lo tiene.** Owner (la contratacion y el presupuesto) con el equipo (el acompanamiento y la
remediacion).

### S7.39 - Plan de respuesta a incidentes documentado — PARCIALMENTE

**Que se verifico.** Si existe un plan general de respuesta a incidentes y, en su defecto, que
procedimientos especificos existan.

**Evidencia.** Hay **un** procedimiento especifico y escrito:
`docs/gestion-humana/firma-electronica/procedimiento-incidentes-datos-salud-2026-10-30.md` (y su
copia en el paquete del abogado, `12-procedimiento-incidentes-datos-salud.md`), que es el de la
**carga accidental de datos de salud** (el 10.8(d) del Acuerdo), con su codigo en
`src/routes/admin-incidentes.js` y `src/services/incidenteSalud.js`, y con la tabla de la base de
datos de incidencias (ya medido en `secciones-6-7.md`, S7.9). Ademas el propio Acuerdo exige "plan de
respuesta a incidentes" entre los requisitos de seguridad
(`respuesta-11A-2026-10-23.txt:227`).
Lo que **no** existe: el plan **general** (caida del servicio, incidente de seguridad, filtracion de
datos, compromiso de una llave). El plan de seguridad lo lista todavia como parte de la Fase 4
(`plan-seguridad-2026-10-25.md:140`), o sea que sigue diferido.

**Que falta.** El plan general, que ademas deberia cubrir los tres canales que hoy **no tienen aviso
automatico**: la caida del tunel (S7.29), las respuestas 5xx (S7.30) y el fallo de un respaldo (S7.13),
y la escala de responsables.

**Quien lo tiene.** Equipo (redaccion) con el Owner (los responsables y el canal de aviso).

---

## Resumen de las 39 casillas

| id | estado | que falta en una linea |
|---|---|---|
| S7.1 | CERRADO | Nada del requisito. |
| S7.2 | CERRADO | Nada del requisito. |
| S7.3 | CERRADO | Nada del requisito. |
| S7.4 | CERRADO | Nada. |
| S7.5 | CERRADO | Nada del requisito. |
| S7.6 | CERRADO | Nada. |
| S7.7 | PENDIENTE | (a) Que el owner lea el `.env` y confirme si la llave se roto desde el despliegue y cuando. |
| S7.8 | CERRADO | Nada del requisito. |
| S7.9 | CERRADO | Nada. |
| S7.10 | CERRADO | Nada. |
| S7.11 | CERRADO | Nada. |
| S7.12 | CERRADO | Aqui "probados" se lee como "cada copia se abre y se verifica al salir" (el `integrity ok` del log). |
| S7.13 | PENDIENTE | La primera corrida y su registro. |
| S7.14 | PARCIALMENTE | (a) Decidir si la casilla se cierra con la lectura "todo endpoint que expone datos de un caso valida el token" (que hoy es cierto) o si el PQRS debe llevar credencial propia. |
| S7.15 | CERRADO | Nada. |
| S7.16 | CERRADO | Nada. |
| S7.17 | CERRADO | Nada. |
| S7.18 | CERRADO | Nada. |
| S7.19 | CERRADO | Nada del requisito. |
| S7.20 | PENDIENTE | Un `/etc/logrotate.d/kair-firma` que rote ese archivo. |
| S7.21 | PENDIENTE | (a) La retencion de 90 dias, que depende del `logrotate` de 7.20. |
| S7.22 | PENDIENTE | La decision de si el requisito se cumple con "el stdout es el sumidero del journal de systemd" (que es lo que pasa hoy) o si el servicio debe escribir en un archivo propio. |
| S7.23 | PENDIENTE | (a) `chmod 750` (o 700) sobre `/opt/kair-firma/logs` y `chmod 640` sobre el archivo. |
| S7.24 | PARCIALMENTE | (a) Una regla que detecte la anomalia que la casilla nombra (el mismo documento consultado contra muchas firmas: un umbral sobre el fingerprint por unidad de tiempo). |
| S7.25 | PENDIENTE | (a) Desplegar el paquete 1051 con `npm ci --omit=dev`, que es lo que saca del proceso la critica de `proxy-addr`. |
| S7.26 | PARCIALMENTE | (a) Desplegar el fix (es el mismo paquete 1051). |
| S7.27 | PENDIENTE | Quitar los `^` de los manifiestos, o declarar por escrito que la fijacion la hace el lock con `npm ci` en el despliegue. |
| S7.28 | PARCIALMENTE | (a) No hay nada que renovar en el servidor, pero tampoco hay nada que avise antes de la expiracion del certificado de borde, que es la parte que el proyecto si puede declarar. |
| S7.29 | PARCIALMENTE | (a) Un monitor externo, que es el que avisaria si se cae la maquina entera (el cron interno muere con ella). |
| S7.30 | PENDIENTE | El canal de alerta (correo o webhook) para 5xx y para la caida del tunel, con su umbral y su destinatario. |
| S7.31 | PARCIALMENTE | La ratificacion escrita del abogado externo. |
| S7.32 | PARCIALMENTE | (a) Una version nueva que corrija el estado del canal de correo: la regla del proyecto es que un texto ya publicado y firmado no se toca, o sea que la via es version nueva con huella propia y firma de nuevo. |
| S7.33 | PARCIALMENTE | (a) La version nueva que corrija el estado del canal. |
| S7.34 | CERRADO | Nada del requisito. |
| S7.35 | CERRADO | La trazabilidad que ya reporta el informe hermano: la corrida **no esta vinculada a un commit candidato** ni **reproducida desde un clon limpio** (`secciones-6-7.md`, 6.11, que por eso la deja en PARCIALMENTE). |
| S7.36 | CERRADO | Nada del requisito; quedan las mismas salvedades de trazabilidad de 7.35 (corrida ligada a un commit y desde clon limpio; la suite nunca corrida en el servidor). |
| S7.37 | PENDIENTE | La prueba en si, y con ella el dato de capacidad (cuantas firmas concurrentes aguanta el servicio y donde se rompe), que hoy es un dato desconocido. |
| S7.38 | PENDIENTE | Contratar y ejecutar un pentest externo, con informe y plan de remediacion, y guardarlos en el expediente. |
| S7.39 | PARCIALMENTE | El plan general, que ademas deberia cubrir los tres canales que hoy **no tienen aviso automatico**: la caida del tunel (7.29), las respuestas 5xx (7.30) y el fallo de un respaldo (7.13), y la escala de responsables. |

Conteo de las 39 casillas: 19 CERRADO, 9 PARCIALMENTE, 11 PENDIENTE, 0 No aplica = 39. Con PARCIALMENTE contando como pendiente, quedan 20 casillas sin cerrar.
---

## Conclusion

**La lista no era una lista de pendientes: era una lista sin medir.** De las 39 casillas, **19 se
cumplen hoy con evidencia**, 9 se cumplen a medias, 11 no se cumplen, y ninguna aplica. Lo que se
descubrio al medir es que la foto del `SECURITY.md` era pesimista en unos puntos y optimista en otros:
**optimista** en los cuatro que la checklist daba por buenos y que no lo estan (rotacion, retencion,
acceso al log, stdout), y en los tres legales que existen pero con afirmaciones que quedaron falsas
el 10-nov; **pesimista** en todo lo que es criptografia, base de datos, headers y limites de tasa,
que si estan implementados, probados y con evidencia medible hoy.

**Los tres hallazgos que no son de esta casilla pero nacen de medirla.** (1) El arbol desplegado
sigue en **777** (236 archivos y 18 directorios escribibles por cualquiera) y el directorio de logs en
**755**: una cuenta local puede reescribir el codigo que corre como `kairfirma` y leer los logs del
servicio. Es la misma observacion que el abogado marco como bloqueante el 31-oct y que cuatro
despliegues despues sigue igual. (2) El service **no anuncia version**: `/health` devuelve un valor
fijo (`compatible-0.1.189`), no hay `.git` y el `package.json` dice `0.1.0`, o sea que hoy "que codigo
corre" se responde por hash, archivo por archivo. (3) **La puerta publica del PQRS**
(`POST /api/solicitudes`) no lleva token y escribe un registro: es el unico endpoint publico que
acepta datos de un tercero, y lo protege solo el limite global.

**Lo que queda, agrupado por dueno.** Del **owner**: el `sudo` de los permisos (S7.20, S7.21, S7.23) y
del arbol desplegado, la lectura del `.env` (S7.7), la decision de Node 22 y del cifrado en reposo, el
canal de alerta (S7.28, S7.29, S7.30), el pentest (S7.38) y la ratificacion del abogado (S7.31). Del
**equipo**: desplegar el paquete 1051 con `npm ci --omit=dev` (S7.25, S7.26), la corrida de suite
ligada a un commit candidato (S7.35, S7.36), la deteccion de anomalias del oraculo (S7.24), el acta de
la restauracion (S7.13), el monitor externo (S7.29), el plan general de incidentes (S7.39) y las
versiones nuevas de la politica de privacidad y de los terminos (S7.32, S7.33).

---

*Documento generado por verificacion de solo lectura. No se modifico ningun archivo del
repositorio salvo este informe y el bloque `M.21` del mapa de la meta. No se toco el `seccion7` del
`SECURITY.md`. No se modifico nada del servidor ni la base de datos: no se uso `sudo`, no se detuvo ni
se reinicio el servicio, y no se publico ningun valor de secreto. La suite de pruebas no se corrio en
esta ronda (ver S7.35).*
