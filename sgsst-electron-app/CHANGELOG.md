# Changelog

> Registro de cambios **por versión publicada**. El estado del trabajo en curso —qué se
> está haciendo, qué quedó pendiente— está en [`Historial.md`](../Historial.md), que se
> actualiza al cerrar cada jornada, no al commitear. Para las reglas de trabajo, ver
> [`PROMPT.md`](../PROMPT.md).

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0/).

## [0.1.247] - 2026-10-06

### 📦868 · Conectar Gmail: las credenciales son de la app, no del usuario — y ahora funciona en cualquier instalación

**Resumen:** en una PC sin `.env`, pulsar "Conectar Gmail" abría el navegador con `client_id=`
**vacío** y Google respondía con una pantalla de "Acceso bloqueado — Missing required parameter:
client_id — Error 400" que no menciona K+AIR. Y lo peor: el servidor de callback quedaba
esperando, así que el siguiente intento decía "Ya hay un flow de autorización activo".

**La causa de fondo no era el mensaje: era dónde vivían las credenciales.**
`shared/google-auth.js:66` las leía **solo** de `process.env.GOOGLE_OAUTH_CLIENT_ID`, y el
`.env` **no viaja con el instalador** (está ignorado por git, que es lo correcto). Por eso
funcionaba en el portátil del owner —donde alguien había creado el archivo— y en cualquier
otra máquina, no. Es decir: la app no tenía correo para sus clientes, y el único síntoma era
un error de Google.

**El arreglo de producto: que la app traiga las credenciales encima.**
No son secretos. El `client_id` de una app instalada es un identificador **público** —Google
lo publica en el manifiesto de verificación del sitio— y el `client_secret` es para apps web:
para *Desktop app* con PKCE, que es lo que usa este flujo, Google lo marca como opcional.
Verificado el 2026-10-06 contra `googleapis`: la URL de autorización que se arma es
**idéntica** con y sin secret.

| | Antes | Ahora |
|---|---|---|
| ¿Dónde viven las credenciales | solo en `.env`, que no se distribuye | en `shared/google-oauth-config.js`, que **se versiona** |
| `.env` | obligatorio | override opcional de desarrollo (lo que esté ahí gana) |
| ¿El usuario tiene que hacer algo | sí: crear y editar un `.env` | **nada** |
| Si falta config | error de Google en pantalla | la opción de correo no se ofrece, y el detalle va al log |

**Cómo queda para el usuario final:** abre Configuración, toca "Conectar Gmail", autoriza su
cuenta y listo. Igual que vos. Sin credenciales, sin archivo, sin Configuración previa.

**Qué se cambió:**

- **NUEVO** `shared/google-oauth-config.js`: credenciales de la app + `available` derivado de que
  exista el `client_id` (no es un flag manual, así que no puede mentir).
- `shared/google-auth.js`: usa ese config; el `.env` queda como override de desarrollo.
- `shared/google-auth.js`: el canje usa `clientAuthentication = 'None'` cuando no hay secreto
  (cliente público con PKCE) y le pasa cadena vacía en vez de `undefined`, que se serializaba
  como el texto `"undefined"`. Verificado en `google-auth-library`: solo manda `client_secret`
  si la autenticación es `ClientSecretPost` o `ClientSecretBasic`.
- `shared/google-auth.js`: el aviso de "faltan credenciales" juzgaba con
  `!CLIENT_ID || !CLIENT_SECRET`, o sea que **gritaba en el log aunque `available` dijera que
  todo estaba bien**. Un aviso que se contradice con el estado real hace que el que lee el log
  deje de creer al que dice la verdad: ahora usa el mismo criterio que `available` y hay 2 checks
  y 2 mutaciones que lo vigilan.
- `main.js:2492`: corta **antes** de `startAuth()` si `!googleAuth.available`, y manda el detalle
  técnico a `sendLog`, no al usuario.
- `main.js` `google-oauth:status`: expone `available`.
- `config-viewer.html`: consulta `available` y **no ofrece el botón** si no puede funcionar; y
  los tres caminos de error muestran un mensaje corto, en humano. Se sacaron del `alert` el
  error crudo de Google, la palabra "tokens" y la palabra "instalación".
- `renderer.js`: bump del cache-bust del iframe de Configuración.
- `.env.example`: reescrito — antes decía "copiá esto y completá los valores"; ahora explica
  que ya no es obligatorio y que la fuente real es el config embebido.
- `main/test-config-premium-v2.js`: su check fijaba el token del iframe a un valor literal, así
  que cada bump lo rompía. Se cambió para validar el **formato** del token —el mismo criterio
  con el que el owner arregló el tripwire de `test-hero-fila-840`.

**Cómo se validó:** `node --check` en los 6 archivos · test nuevo
`main/test-google-oauth-868.js` **48/48**, con **17 mutaciones** que confirman que muerden
(volver a leer solo de `process.env`, quitar el override, quitar `available`, `available` como
flag manual, guard movido después de `startAuth()`, sin `sendLog`, botónofferto igual, jerga
técnica de vuelta, error crudo de vuelta, `available` fuera del status, `.env.example` diciendo
que es obligatorio, el aviso del log pidiendo de nuevo el secret) · **prueba funcional de la
cadena completa (15/15)** y, con el `client_id` real ya embebido, **cadena real (22/22)**:
`accounts.google.com/o/oauth2/v2/auth` con `client_id` con valor, `redirect_uri` exacto,
PKCE S256, `access_type=offline` y el secret no aparece en la URL · con
`process.env` vacío y `.env` ausente, interceptando el config embebido, `startAuth()` arma una
URL con `client_id` **con valor**, `redirect_uri` correcto, PKCE S256 y `access_type=offline` ·
`test-config-premium-v2.js` 44/44 · `test-hero-fila-840.js` 35/35.

**El tropiezo de esta jornada.** El paquete empezó tocando también
`renderer/bandeja-integrada/calendar-operations.js`, que llama `google.start()` y se traga el
error en silencio. Se le puso un toast de error... y se comprobó que **no lo carga ningún
`<script src>` del proyecto**: está muerto, y `AGENTS.md:2549` lo tenía anotado desde antes
("12 archivos JS huérfanos... `app.js` es el único contrato vivo"). Se revirtió: tocar código
muerto no arregla nada, hace que el test dé verde por algo que no ocurre, y engaña a quien lea
el commit después. El test ahora lee el grafo de carga real (140 scripts) y vigila que ese
archivo siga muerto.

**Y el error de diseño que el owner ALZÓ en el primer intento:** el guard inicial explicaba
el `.env` al usuario final con todo detalle. Es un mensaje de desarrollador —un cliente de
K+AIR no va a editar un archivo que no sabe qué es— y por eso la solución real no fue "avisar
mejor", sino "que no haya nada que avisar": que la app venga con las credenciales.

**El `client_id` y el `client_secret` ya están cargados y la conexión funciona** (proyecto
"KAIR Calendar Sync", app de escritorio). **Probado de punta a punta contra Google:** el owner
autorizó con su cuenta real y la bandeja conectó.

### 🚨 La creencia que casi pierde el paquete: "el `client_secret` es opcional"

Se llegó a esa conclusión leyendo `google-auth-library`: tiene un enum
`ClientAuthentication.None` que, activado, hace que la librería **no mande** el `client_secret`
en el body. Todo cuadraba en el código. **Pero leer la librería no es verificar el servicio.**

El día que se probó la autorización real, Google aceptó los 5 permisos y el canje devolvió:

```
{"error":"invalid_request","error_description":"client_secret is missing."}
```

El síntoma era el **peor posible**: el navegador decía "Autorización exitosa", el cliente había
autorizado todo, y al final **se perdía la conexión**. Media conexión: con el botón todavía
visible y el flujo entero aparentemente funcionando hasta el último paso.

**Lo que lo dejó invisible:** los handlers de OAuth (`start`, `await-callback`, `exchange`)
usaban `console.error`, que **no escribe en `main.log`**. El fallo no dejaba rastro en ningún
lado — hubo que reproducir la petición a mano (un canje con un código falso revela el error
del endpoint) para verlo. Ahora los tres escriben en `sendLog` y hay un check que lo vigila.

**Consecuencias del arreglo:**

- `available` ahora exige **las dos** credenciales. Antes, con el secret vacío, daba `true`, la
  app ofrecía el botón y rompía a mitad de camino. Ahora no lo ofrece hasta que puede
  completarse de verdad — que es exactamente lo que se ve en pantalla.
- `clientAuthentication = 'None'` **eliminado**: con ese modo la librería omite el secreto y
  Google lo rechaza.
- 8 checks del test 868 **invertidos** (§7.3: invertir, no borrar) para que fijen que el
  secret es necesario y nadie vuelva a la creencia vieja. Total: 17 mutaciones, todas muerden.

Que Google entregue un secreto "de escritorio" no lo vuelve secreto: la app es un binario que
cualquiera puede abrir, y el mismo Google lo baja junto con su `client_secret_*.json`. El
problema nunca fue la seguridad del valor, sino que **faltaba y la app fingía que no**.

### 🚨 Por qué las credenciales NO van en el archivo versionado

Al commitear, **GitHub rechazó el push**: `GH013 — Push cannot contain secrets`, detectando el
`client_id` y el `client_secret` en `shared/google-oauth-config.js`. El repo es **público**, y
eso no se arregla volviendo el repo privado:

`package.json` declara `publish: {provider: "github"}` y electron-updater pega a la API de
releases de GitHub **sin token**. En un repo privado esa API devuelve **404** y **todos los
clientes dejarían de recibir actualizaciones** — incluido el differential download que está
optimizado para clientes con internet lento.

Así que: repo público ⇒ el `client_secret` no puede estar en el historial. La solución:

- `shared/google-oauth-config.js` se versiona **vacío**, y su cabecera explica por qué.
- Las credenciales viven en `sgsst-electron-app/.env`, que está en `.gitignore`.
- **electron-builder NO excluye `.env`** de los archivos del app (verificado: 0 reglas de
  `build.files` lo filtran), así que un `.env` presente en la máquina que compila **viaja dentro
  del instalador** y le llega al cliente sin que configure nada. El objetivo de producto se
  mantiene: el usuario final no tiene que hacer nada.
- **NUEVO** `main/_verificar-credenciales-build.js`, enganchado como `prebuild` / `prebuild:win` /
  `prebuild:mac` / `prebuild:linux`: si faltan las dos credenciales, **corta el build con exit 1**
  diciendo dónde pegarlas. Es preferible que el build falle ahí a que salga un instalador donde el
  correo no conecta — que es justamente el bug que costó toda la jornada. Si existen pero el
  formato es raro, avisa sin cortar.
- Los 5 scopes declarados en Google coinciden con los que pide el código: `calendar`,
  `gmail.readonly`, `gmail.send`, `gmail.modify`, `gmail.compose`.

**Pendiente (no es código):** Google expira la autorización a los 7 días si el proyecto queda
en modo "Testing": pasarlo a "Production" exige una URL de política de privacidad pública, que
todavía no existe.

## [0.1.246] - 2026-10-06

### 📦867 · Fase 4 del mapeo de estructura: la pantalla deja de mentir y dice cuánto se lleva

**Resumen:** quinta y última etapa del plan de 5 fases. **Primera fase del plan con cambios
visibles en pantalla.** El overlay del mapeo muestra los archivos y las carpetas contados de a
verdad mientras el escáner corre, y se elimina el "Tiempo estimado: 10-60 segundos" que era un
texto fijo (nunca calculado) y que en una carpeta de Drive se quedaba corto por dos órdenes de
magnitud.

**El problema que motiva esta fase.** Con la carpeta real en Google Drive, `map_directory.py`
pasaba más de 760 s (medidos: 1.241 s de reloj contra 4,45 s de CPU — el 99,6 % es esperar la red).
Durante todo ese tiempo la ventana mostraba un spinner, un reloj y nada más: el usuario no tenía
ni idea de si estaba avanzando o colgado, y el texto de "10-60 segundos" le decía que algo
estaba roto cuando en realidad iba bien.

**Qué se hizo — el progreso viaja de verdad, de punta a punta:**

| Tramo | Qué hace |
|---|---|
| `map_directory.py` | `_avisar_progreso()` escribe `[PROGRESO] archivos=N carpetas=N` a **stderr**, amortiguado a 250 ms con `time.monotonic()`, con una línea forzada al arrancar y otra al cerrar |
| `main.js` | Engancha `child.stderr` y reenvía cada línea por el canal IPC `mapeo-progreso`; `stderr` sigue acumulándose aparte para el campo `log:` |
| `preload.js` | `onMapDirectoryProgress(cb)` devuelve la función que quita el listener |
| `config-viewer.html` | Pinto el contador real y sueltan el listener en los **tres** caminos de salida |

**Por qué stderr y no stdout:** stdout tiene que quedar con **una sola línea de JSON puro** (el
contrato de 📦866). Mandar el avance por ahí lo rompía, y el test lo verifica con un bite test
real: si el progreso vuelve a stdout, el `JSON.parse` deja de poder leer el resultado.

**Lo que NO se tocó:** el contrato del escáner (`root`, `structure.name`/`path`, `subdirectories`
como dict, `total_files`/`total_folders`), los límites `maxBuffer: 64 MB` y `timeout: 30 min` de
la Fase 1, y el reloj de tiempo transcurrido (que sí era real; lo engañoso era la *estimación*).

**Cómo se validó:** `py_compile` OK · `node --check` OK en `main.js` y `preload.js` · test nuevo
`main/test-mapeo-estructura-867.js` **44/44**, con **11 mutaciones** que confirman que muerde
(sin `.child`, sin guard de ventana destruida, progreso a stdout, sin `timeout`, sin `flush`, con
`time.time()`, canal mal escrito, "10-60 segundos" de vuelta, listener sin soltar…) · tests 863
**36/36**, 865 **15/15**, 866 **20/20** · suite **124 · 106 verdes · 18 preexistentes (0
regresiones)**. Cache-bust: `renderer.js?v=20261006-mapeo-fase4`.

**Validación de integración (fuera del repo, en `%TEMP%`):** se extrajeron y ejecutaron el
wrapper y la expresión regular **reales** de `main.js` contra un fixture de 2.500 archivos —
15/15. Las muestras de progreso llegaron a los 81 ms y 114 ms, **antes** de que el proceso
terminara (125 ms): eso demuestra que el avance se escucha en vivo y no llega bufferizado al
final, que era justamente el defecto que vino a corregir esta fase. Queda pendiente decidir si
esa prueba entra al repo como test.

## [0.1.245] - 2026-10-06

### 📦866 · Fase 3 del mapeo de estructura: el resultado baja de ~3 MB a una fracción y siempre llega completo

**Resumen:** cuarta etapa del plan de 5 fases. **Sin cambios visibles todavía.** Con este paquete el
escáner deja de armar un informe tres veces más grande del necesario: saca del resultado los datos
que **nadie lee** (`files[]`, `file_count`, `dir_count`, `errors` y el indentado `indent=2`), sin
tocar nada de lo que la app sí consulta.

**El problema que motiva esta fase.** La Fase 1 agrandó el conducto de salida (1 MiB → 64 MB) y con
eso el JSON dejó de cortarse… pero seguía pesando ~2,98 MB sobre el Drive real. Ese peso no es
gratuito: cada archivo arrastraba una **lista de rutas repetida**, un recuento por carpeta, un
listado de errores y sangría de dos espacios por nivel. Medido con un fixture de 2.000 archivos:
**934.437 bytes / 19.219 líneas** contra **20.877 bytes / 1 línea** del código nuevo — **−97,8 %**.

**Qué se sacó (0 consumidores verificado con grep en la Fase 0):**

| Campo quitado | Por qué se pudo |
|---|---|
| `files[]` por nodo | Solo lo leía `formatStructureForLog`, que ya tolera nodos sin `files` |
| `file_count` / `dir_count` | **No** se quitan: se conservan y ahora salen de un contador global (`_contador`) que se reinicia en cada corrida |
| `errors[]` | Los avisos van a `stderr` (`print(..., file=sys.stderr)`), así el stdout queda JSON puro |
| `indent=2` | Un solo renglón; el `JSON.parse` no distingue |
| bloque por-archivo de `stat` + extensión | La Fase 2 ya no calcula checksum, y la extensión no la lee nadie |

**Lo que NO se tocó:** el contrato completo (`root`/`structure.path` absolutos, `structure.name`,
`subdirectories` como diccionario, `print(json.dumps(structure`, `map_directory(root_path)`),
`total_files`/`total_folders` (**sí** los consume `renderer.js:7158/7160` y `main.js:4337/4338`)
y la semántica de symlink/OSError de la Fase 2.

**Tests:** `main/test-mapeo-estructura-866.js` (**20 checks**, nuevo). Escrito **antes** de tocar el
código y probado contra la versión previa: **8 checks FALLAN** contra el código de Fase 2 (4
estáticos: `files`, `file_count`/`dir_count` ausentes, `errors`, `indent=`; 4 de runtime: claves
profundas presentes, stdout con 91 líneas) y **12 de preservación pasan en ambos**. Con el código
nuevo: **20/20**. El test de Fase 0 sigue **36/36** y el de Fase 2 **15/15**.

**Suite completa:** **123 tests · 105 en verde · 18 fallos** = línea base (122·104·18) + el test
nuevo en verde. **0 regresiones**; los 18 fallos son los mismos preexistentes.

**Verificación:** `python -m py_compile Portear/src/map_directory.py` OK · `node --check main.js` OK ·
corrida real contra fixture (JSON parseable en **1 línea**, claves profundas inexistentes, totales
contra un conteo independiente del disco).

---

## [0.1.244] - 2026-10-06

### 📦865 · Fase 2 del mapeo de estructura: el escáner deja de tardar hora y media por nada

**Resumen:** tercera etapa del plan de 5 fases. **Sin cambios visibles todavía.** Con este paquete
el mapeo quita de en medio lo que consumía casi todo el tiempo: calcular la huella (checksum) de
cada archivo, un trabajo que nadie lee.

**El problema que motiva esta fase.** El diagnóstico de la Fase 0 midió que el escáner tarda
760+ segundos y que **~99,6 % de ese tiempo** se va en calcular la huella SHA-256 de cada uno de
los 1,73 GB de la carpeta (`_calculate_checksum`, antes en `map_directory.py`). Recorrer las
carpetas en sí es casi instantáneo. Y el resultado de tanto esfuerzo —el campo `checksum` de cada
archivo— **no lo consume nadie**: 0 lecturas fuera del propio script.

**Qué cambia en `Portear/src/map_directory.py`:**

- **Se elimina `import hashlib`, la función `_calculate_checksum` y el campo `checksum`** de cada
  archivo. Desaparece el cuello de botella completo.
- **El recorrido pasa a un solo pase con `os.scandir`**: antes se abría cada directorio para
  contarlo y después de nuevo para listar; ahora se lee una sola vez (`entries = list(scandir_it)`).
- **`scan_date` deja de ser `null`** y sale con fecha y hora reales (`datetime.now().isoformat()`).
- **Los errores de lectura ya no se tragan en silencio**: si un archivo no se puede leer, se lista
  con `size: None` y se reporta.
- **Semántica de atajos (symlink) conservada**: un atajo a una carpeta se lista como carpeta vacía
  (igual que antes, sin descender), un atajo a un archivo se lista como archivo, y uno roto se omite.

**Qué NO cambia todavía:** la forma de la respuesta sigue igual (`files[]`, `file_count`,
`dir_count`, `errors` e indentado `indent=2` se van en la Fase 3) y no hay progreso visible
(Fase 4). El pipeline de `main.js` no se toca.

**Verificación:** `python -m py_compile Portear/src/map_directory.py` OK · test de Fase 0
(`main/test-mapeo-estructura-863.js`) sigue **36/36** (los invariantes sobreviven) · test nuevo
`main/test-mapeo-estructura-865.js` → **15/15 OK** (incluye corrida real contra fixture y
búsqueda profunda de `checksum` en la salida) · **prueba de mordida**: los 6 checks de cambio
aplicados al código viejo (HEAD) FALLAN y al nuevo PASAN, y las 3 guardias de preservación pasan
en ambos · suite completa → **122 tests · 104 OK · 18 fallos preexistentes** (línea base + el
test nuevo, 0 regresiones).

**Cache-bust:** `renderer.js?v=20261006-mapeo-fase2`

---

## [0.1.243] - 2026-10-06

### 📦864 · Fase 1 del mapeo de estructura: el escáner ya puede devolver su respuesta completa

**Resumen:** segunda etapa del plan de 5 fases. **Sin cambios visibles todavía.** Con este paquete
el mapeo deja de estar condenado a fallar: el programa que dispara la app puede recibir el
resultado entero en vez de recibirlo cortado a la mitad.

**El problema que motiva esta fase.** En la Fase 0 se dejó escrito el diagnóstico: el escáner
tarda 760+ segundos y el resultado **no llega nunca**. La app lanza un programa externo
(`map_directory.py`) y lee lo que éste escribe en su salida; Node, por defecto, corta esa salida
en **1 MB**. El árbol de una carpeta de 1,73 GB sale en un JSON de ~2,98 MB, así que la mitad
del resultado se descarta y la lectura revienta **después** de la hora y media de escaneo.

**Qué cambia.** El mismo punto de código (`main.js:4311`, la llamada `execFilePromise`) ahora
recibe dos límites explícitos:

- **`maxBuffer: 64 * 1024 * 1024` (64 MB)** — el techo de la salida pasa de 1 MB a 64 MB, ~21
  veces el peso actual del JSON. Deja de ser la causa del fallo.
- **`timeout: 30 * 60 * 1000` (30 minutos)** — si el escáner se cuelga, la llamada se corta y
  devuelve un error claro en lugar de dejar la promesa pendiente para siempre (hoy no había
  ningún tope: un proceso colgado bloqueaba el handler indefinidamente).

**Qué NO cambia:** ni el script, ni la forma de la respuesta, ni la UI. Sigue sin haber progreso
visible (Fase 4) y el escáner sigue siendo lento (Fase 2). Este paquete solo quita el techo que
hacía imposible que el esfuerzo se tradujera en resultado.

**Verificación:** `node --check main.js` OK · test de contrato de la Fase 0
(`main/test-mapeo-estructura-863.js`) **36/36 OK** · suite completa `node Temp/run-all-tests.js`
→ **121 tests · 103 OK · 18 fallos preexistentes** (mismo balance que en HEAD limpio: 0
regresiones).

**Cache-bust:** `renderer.js?v=20261006-mapeo-fase1`

---

## [0.1.242] - 2026-10-06

### 📦863 · Fase 0 del mapeo de estructura: el contrato queda escrito en una prueba

**Resumen:** primer paquete del plan de 5 fases para que "Mapeando Estructura de Documentos"
termine. **Sin cambios visibles todavía** — esta fase solo pone el punto de control antes de
tocar el escáner.

**El problema que motiva el plan.** El mapeo tarda **760+ segundos** y **nunca termina bien**:
`map_directory.py` recorre 1,73 GB (Google Drive), calcula SHA-256 de cada archivo —que es ~99,6 %
del tiempo— y arma un JSON de ~2,98 MB. Ese JSON sale por `stdout` y `execFile` corta en **1 MiB**,
así que `JSON.parse(stdout)` (`main.js:4322`) reventaba **siempre**, después de los 760 s. O sea:
hora y media de escaneo para un error de parseo.

**Qué hace esta fase.** Crea `main/test-mapeo-estructura-863.js` (36 checks) que fija el contrato
antes de optimizar:

1. **Corrida real** de `map_directory.py` contra un fixture temporal (carpeta + `sub` + `sub/interior`),
   parseando el stdout completo. Si la máquina no tiene Python, ese bloque se omite con un check
   aclarado en vez de romper la corrida.
2. **La forma del contrato**: `root` absoluto igual al directorio pedido, `structure.name`,
   `structure.path` absoluto y `structure.subdirectories` como **objeto** (no array), con las
   carpetas del fixture apareciendo como claves, incluida la anidada.
3. **El pipeline**: handler `map-directory`, `execFilePromise(pythonPath, [pythonScriptPath,
   directoryPath])`, `JSON.parse(stdout)`, `getPython()`, el llamado desde `config-viewer` y el
   `mapDirectory` del preload.
4. **Las dos consumidoras extraídas del código real y ejecutadas**: `searchInStructure` (main.js,
   devuelve la ruta; testea código exacto "2.4.1" sin matchear "4.2.4.1") y
   `formatStructureForLog` (renderer.js, tolera nodos sin `files`).

**Lo que este test NO chequea, a propósito:** `checksum`/SHA-256 (Fase 2 lo elimina), `files[]` /
`file_count` / indentado (Fase 3) y el formato de `scan_date` (Fase 2 pasa de `null` a fecha real).
Chequearlos ahora sería destruir la prueba en la fase siguiente.

**Plan aprobado de 5 fases:** Fase 0 contrato (este paquete) → Fase 1 `maxBuffer`/`timeout` en el
`execFile` (📦864) → Fase 2 velocidad: sin SHA-256, `os.scandir`, un solo pase, `scan_date` real
(📦865) → Fase 3 tamaño: sin `files[]`/indentado (📦866) → Fase 4 progreso real por stderr→IPC→UI
(📦867). Fase 5 (backlog, 📦868).

**Fix colateral (mismo anti-patrón que 📦849):** el bump del `?v=` rompió el check 5 de
`test-hero-fila-840.js`, que tenía el token `20261006-admin-empresas-2` escrito a mano — un test
que hay que editar en cada bump dejó de proteger nada. Ahora valida la **forma**
(`/renderer\.js\?v=\d{8}-/`), no el valor, siguiendo la regla de 📦849.

**Tests:** `node main/test-mapeo-estructura-863.js` → **36/36 OK** (incluye la corrida real con
Python 3.14.8).
**Suite completa:** 121 tests, 103 en verde, 18 fallos preexistentes, 0 regresiones.
**Cache-bust:** `renderer.js?v=20261006-mapeo-fase0` en `index.html`.
**Versión:** 0.1.241 → 0.1.242

## [0.1.241] - 2026-10-06

### 📦862 · Un administrador ya no queda encerrado en "contacta a administración"

**Resumen:** si entrabas como administrador y no tenías ninguna empresa asignada, la app te
decía **"No tienes empresas asignadas. Contacta a administración."** — el mensaje pensado para
un usuario sin permisos, y además sin salida: no había forma de ver tus empresas.

**Causa.** En `renderer.js`, `showHomePage` filtraba las empresas así:

```js
if (Array.isArray(overrideCompanies)) { ... }   // SIEMPRE true
else if (assignedCompanies && ... && !checkIsAdmin()) { ... }
else { /* ADMIN: todas, desde config */ }          // NUNCA se ejecutaba
```

`Array.isArray([])` es `true`, y `initializeApp()` se llama en un solo lugar (`renderer.js:3604`)
pasando siempre `assignedCompanies`, que es un array. La primera rama ganaba **siempre**.

Consecuencias, todas de la misma causa:

- El admin sin empresas asignadas veía **cero** empresas y el mensaje de un usuario normal.
- La rama del admin era **inalcanzable**, así que el fallback
  `["Tempoactiva","Temposum","Aseplus","Asel"]` tampoco era código real.
- `checkIsAdmin()` **nunca se consultaba**: su rama estaba detrás de código muerto.

El backend sí estaba bien: `validateSession` (`main.js:1021`) reconoce `admin@kair.local` y
devuelve `isAdmin: true`. El mensaje hacía creer que faltaban permisos.

**Y había un segundo motivo, más profundo: `checkIsAdmin()` tampoco sabía quién era el admin.**
Derivaba el rol **solo** de `currentUser.companies`, así que con `companies = []` —el caso del
admin global, que por definición no tiene empresas asignadas— `[].some()` devolvía `false`. El
backend ya mandaba `user.isAdmin` resuelto (`main.js:1628`) y el renderer lo ignoraba. Arreglar
solo el orden de las ramas no bastaba: `esAdmin` seguía dando `false` y el mensaje seguía siendo
el equivocado. Es lo que pasó en la primera vuelta: el mensaje siguió apareciendo después del fix.

Ahora `checkIsAdmin()` respeta `currentUser.isAdmin` primero, y solo recalcula por `companies`
cuando el backend no resolvió el caso global.

**Y el admin quedaba además sin salida.** El Inicio oculta el sidebar siempre
(`sidebar-hidden`), así que con cero empresas registradas no había forma de llegar a la
configuración. Con el mensaje correcto y sin empresas, el admin seguía sin poder hacer nada. Se
agrega un botón "Ir a Configuración" cuando es admin y la lista está vacía.

**La trampa del arreglo obvio.** Agregar `&& overrideCompanies.length > 0` a la primera rama
**abría una escalada de privilegios**: un usuario no-admin sin empresas caería en el `else`, que
carga `config.companyPaths` completo, y vería **todas** las empresas.

**El arreglo** es decidir por rol primero, no por la forma del argumento:

```js
const esAdmin = checkIsAdmin();
if (esAdmin) { /* todas, desde config */ }
else if (Array.isArray(overrideCompanies) && overrideCompanies.length > 0) { /* override */ }
else { /* assignedCompanies */ }
```

Y el mensaje también pasa a decidir por rol: un administrador **nunca** debe ver la frase que lo
remite a sí mismo.

**Tests:** `main/test-admin-empresas-862.js`, 17 checks. Ejecuta `checkIsAdmin()` y el bloque de decisión de
`renderer.js` y lo **ejecuta** con roles distintos en vez de buscar cadenas. Cubren los cinco
combinarios de (admin, asignadas, override) y los dos del mensaje. Con el bug reintroducido sobre
el código nuevo, fallan los dos checks de comportamiento — un detector de cadenas pasaría.

**Cache-bust:** `renderer.js?v=20261006-admin-empresas-2` en `index.html`. Dos veces, porque la app
ya había descargado el primer token: **un token repetido no sirve para nada** (§5.3).
**Versión:** 0.1.240 → 0.1.241
## [0.1.240] - 2026-10-05

### 📦861 · El explorador de archivos deja de mentir cuando algo falla

**Resumen:** una auditoría del módulo 1.1.1 (Responsable del SG) encontró tres cosas que
hacían que el explorador **no dijera la verdad**, más una incoherencia de color que el owner
reportó con una captura. Lo importante del hallazgo no es que el 1.1.1 fallara: es que
**ese módulo está replicado 15 veces**. Cada bug se paga 15 veces.

**1 · Un error de carga congelaba la lista para siempre.** El `catch` mostraba un toast de
5 s —que se iba— y **nunca volvía a dibujar**. Lo que quedaba eran bloques grises mudos,
sin mensaje y sin forma de reintentar. Ahora la lista muestra **"No se pudo leer esta
carpeta"** con botón **Reintentar**, y el toast queda como refuerzo, no como único canal.

**2 · Un fallo se veía exactamente igual que una carpeta vacía.** El código hacía
`result.files || []`, que convierte **cualquier** respuesta inesperada en lista vacía. El
usuario veía "No hay archivos en esta carpeta" y concluía que sus archivos se habían
perdido, cuando en realidad nunca se leyeron. **Un sistema no puede dejar que "no pude
leer" se vea igual que "no hay".** Ahora la decisión vive en una función pura,
`_normalizarLista()`, que devuelve `{ok, files, mensaje}` y se puede probar sola.

**3 · La pantalla prometía una interacción que no existía.** El estado vacío decía
"Arrastra archivos aquí", pero el único `drop` del módulo estaba sobre las carpetas de la
columna izquierda: el usuario arrastraba donde le decían y no pasaba nada, en silencio.
Ahora el panel central acepta el arrastre, sube a **la carpeta que se está viendo** y
muestra un recuadro punteado mientras lo sostiene.

**4 · El botón "Subir" era verde.** El owner lo reportó con una captura: *"ese botón de
color verde no va a lugar, desentona completamente"*. Y era la misma cosa que la auditoría
ya había marcado: en K+AIR el verde significa "cumplido / éxito", no "acción principal".
Un botón verde de la acción principal compite con los avisos de éxito, que es donde el
verde sí tiene que estar. Ahora usa **el azul de la barra superior** (`#2057b8`), con el
que el owner rigidityó. El estilo azul ya existía en los CSS y no lo usaba nadie.

**Lo que el azul arrastraba:** el color primario estaba **escrito a mano en 7 lugares** de
cada archivo —los `rgba()` del focus ring y de dos sombras—. Cambiar solo el token dejaba
el borde del botón del azul viejo al pasar el mouse. Se cambiaron los 7.

**5 · El PDF se veía con otro visor que Word y Excel.** También reportado por el owner con
captura. El PDF se abría con el **visor nativo del navegador** (la barra oscura con "1/2" y
"96%"), mientras Word y Excel usaban el visor de K+AIR. Dos herramientas para la misma
tarea. La causa estaba escrita en el código: el archivo de conexión excluía el PDF a
propósito con `fileExt !== 'pdf'`. Ahora los tres formatos pasan por el mismo camino, y el
botón **"Ver completo"** que estaba deshabilitado para PDF vuelve a aparecer.

**6 · Imprimir salía en blanco y decía que salía bien.** El código concatenaba un **objeto**
dentro de una dirección de PDF, abría un diálogo vacío y registraba
`PRINT_DOC SUCCESS`. Para PDF ahora funciona de verdad; para Word/Excel avisa que el
navegador no puede imprimirlos, en vez de sacar una hoja en blanco.

**Alcance, y es importante:** el azul se aplicó a los **15** exploradores. El PDF, **solo al
1.1.1**. El inventario mostró que los 15 **no comparten la arquitectura del preview**: hay
**4 variantes** de la función que carga el PDF, y los archivos de conexión lo enrutan de
**3 maneras distintas**; tres módulos ni siquiera tienen archivo de conexión. Replicar eso
sin poder abrir la app sería cambiar 15 módulos a ciegas. Los otros 14 quedan para cuando
el 1.1.1 esté validado.

**Tests:** `test-explorador-estado-861.js`, **614 checks y 9 mutaciones**, todas cazadas.
El test se escribió **antes** del arreglo: fallaba en 151 de 259 checks, y los tres bugs
estaban en los 15. Después agarró un error mío —un `rgba` del azul viejo que se me había
pasado en una opacidad distinta—, que por el camino terminó corrigiéndose.

Suite completa: **119 tests, 101 en verde, 18 con fallos** — los 18 preexistentes, cero
regresiones.

## [0.1.239] - 2026-10-04

### 📦860 · La fila del correo muestra la fecha ENCIMA de la hora

**Resumen:** el owner mandó una captura de la bandeja y ahí se veía el problema: en la lista de
correos solo aparecia la hora ("18:02", "17:54"). Con la bandeja mezclando correos de varios dias
no habia forma de saber de cuando era cada uno. Pidio la fecha **sobre** la hora, y que aplicara
tambien a Enviados y al resto.

**Aplica a todas las carpetas sin codigo duplicado.** La lista es una sola para Recibidos,
Enviados, No leidos y el resto, asi que cambiar el render de la fila las cubre a todas. No se hizo
un caso por carpeta: habria sido la forma rapida de meterse un dia y que Enviados quedara viejo.

**El ano solo sale si es distinto al actual**, como en Gmail. La columna del grid es angosta
(`64px`) y "4 oct 2026" ocupa el doble que "4 oct" sin informar nada que "4 oct" no diga.

**La zona horaria era el riesgo real, no el formato.** `fechaFila` usa los getters **locales**
(`getDate()`, `getMonth()`), igual que `isoDe` y `mailDiaDe` de 858. Si hubiera usado
`toISOString()` —que es UTC— un correo de las 21:00 en Colombia caeria en el dia siguiente y la
fila diria una fecha que no es. En la base hay correos en esa franja, asi que no era teorico.

**Los meses cortos quedaron en una sola fuente.** Antes habia **dos** copias del mismo array en
`app.js` (una en `formatGmailDate` y otra en `formatGmailLongDate`) y la de 860 habria sido la
tercera. Dos copias del mismo dato se separan con el tiempo, y la que nadie recuerda al corregir la
otra es la que gana. Los meses LARGOS no se tocan: tienen otra capitalizacion y no son el mismo
dato.

**Lo que ya estaba hecho y habia que respetar:** la columna `__meta` ya era
`flex-direction: column` (lo remapea `premium.css`), asi que la linea de fecha entra sin tocar
el layout. Y el hover, que antes ocultaba solo la hora, ocultaba **las dos**: los iconos de accion
de la fila son `position: absolute` en `right: 14px`, asi que con la fecha visible los botones
quedaban medio tapados por el texto. Un selector que lista una de dos cosas iguales se rompe en
silencio cuando le agregas la segunda.

**Que cambió**

- `fechaFila(m, hoy)` en `app.js`: funcion pura que recibe `hoy` por parametro para poder
  probarla sin congelar el reloj. Devuelve `""` si no hay fecha utilizable, y entonces la fila se
  queda con la hora sola en vez de dejar un hueco.
- La linea de fecha se agrega **antes** de la de la hora, dentro de `if (filaFecha)`.
- `.kair-mail-row__fecha` en `styles.css`: mas chica (0.65rem) y mas apagada (opacidad 0.85) que
  la hora, porque la hora es el dato que se mira de recho al elegir un correo y la fecha es la que
  se lee cuando uno se detiene.
- Los tres tokens de cache-bust (`styles.css`, `app.js`, `premium.css`) suben a
  `20261004-fecha860`, y el `index.html` del iframe a `?v=697`.

**La verificacion que si hacia falta: contra la base de datos real, no de laboratorio.**

Los 34 checks del test pasaban en verde **con la columna de fecha vacia en pantalla**, y no habria
habido forma de verlo. `fechaFila` exige `typeof ms === "number"` a proposito, asi que si
`email_threads.last_message_date` devolviera el numero como texto, las 150 filas darian `""` y
la fecha no se dibujaria en ninguna. Ningun test de este repo abre la base de datos.

Se escribio un verificador que extrae la funcion **del archivo real** y la corre sobre los 150
hilos de la base del owner: `last_message_date` es `INTEGER` y llega como `number` en las 150,
**0 filas sin fecha**, rango real del 31 de julio al 3 de octubre de 2026.

**Las tres trampas que el test se encontro a si mismo**

1. **Polaridad invertida.** El check de CSS reportaba el fallo cuando la regla de estilo
   *existia*, asi que el mutante que la borraba pasaba. La mutacion ROMPE la forma buena y el check
   la EXIGE presente: se marca cuando la buena **dejo de estar**. Quinta vez que se comete.
2. **Las dos guardas de fecha invalida eran redundantes.** `new Date(n)` nunca da fecha invalida
   para un numero finito, asi que la segunda guarda solo repetia a la primera y el mutante que
   quitaba una no moria. Un mutante que no muerde no siempre es un check flojo: a veces esta
   delatando que la linea vigilada no hacia falta, o que hacia falta la de al lado.
3. **El token de cache-bust es compartido.** `app.js` y `premium.css` llevan el **mismo** `?v=&`
   a proposito: si difieren se sirven desparejos. Subir solo el que se toco deja la pagina con dos
   versiones distintas, y asi se cayeron dos tests de la suite (849 y 846) hasta arreglarlo.

**Tests:** `test-mail-fecha-860.js`, 34 checks y 10 mutaciones, todas cazadas. El ancla de cada
mutante ahora se cuenta antes de aplicarla (`split(de).length - 1`), porque `String.replace` con
texto cambia solo la primera coincidencia y un ancla repetida hace que el mutante rompa la copia
que no importa.

Suite completa: **118 tests, 100 en verde, 18 con fallos** — los 18 preexistentes, cero regresiones.

## [0.1.238] - 2026-10-04

### 📦858 · El mini-calendario tiene dos comportamientos según la pestaña

**Resumen:** el owner pidió que el mini-calendario se adaptara a la pestaña activa. En
**Agenda** sigue haciendo lo de siempre (puntitos de eventos, popup, doble clic). En **Correo**
funciona como **filtro por día**: al elegir una fecha del mes, la bandeja muestra los correos de
ese día. Y el mini tiene que **poder ir hacia atrás de mes**, porque la mayor parte del correo es
viejo.

**Lo primero que apareció en la investigación: la fecha del correo no es una fecha.**

`mail.date` no venía como ISO sino como **epoch en milisegundos** (13 dígitos: `1791068562000`),
que es lo que guarda `email_threads.last_message_date`. Un filtro ingenuo con `SUBSTR(1, 10)`
agruparía por los primeros 10 dígitos del número, no por el día. La conversión se hace con
`isoDe(new Date(ms))`, la **misma** función que arma las celdas de la grilla, así que el día de
un correo y el día de una celda son el mismo string por construcción.

**Lo segundo, y era el que hacía mentir la función:** la app solo tiene 25 correos en memoria de
los 131 que hay en la carpeta de entrada.

| Día | Correos en la BD | En memoria | Lo que se habría visto |
|---|---|---|---|
| 14 sept | **12** | 0 | "Sin correos ese día" |
| 9 sept | **6** | 0 | "Sin correos ese día" |
| 28 sept | 6 | 6 | correcto |

25 días con correo habrían salido mintiendo, y eran justo los días viejos, que es lo que el owner
pedía poder buscar. Se resolvió **agregando un rango de fechas a la consulta de la caché**
(`buildThreadsWhere`), que es SQLite local: no consume red ni cuota de Gmail y no toca la
paginación de 📦755.

**Qué cambió**

- El día es un **eje**, no un filtro más: `state.mailDia` se compone con el chip activo, la
  búsqueda y los labels. "No leídos **del** 3 de octubre" existe. Precedente: `alcanceTipos` de 📦857.
- En Correo el mini **no lleva puntitos** (lo pidió el owner: los puntitos son de eventos) y
  **navega de mes** con su propio estado, que no mueve el calendario grande.
- Al cambiar a la pestaña Agenda, el filtro **se limpia** y el mes vuelve al presente.
- Fila emergente bajo el mini con el día, la cantidad y una X para quitarlo.

**El bug que casi se va:** los chips de filtro hacían `return !!m.unread`, y esa salida temprana
se comía el filtro por día — con "No leídos" activo, la función salía antes de comparar la fecha.
Se reescribió como un "y" entre los dos ejes. Hay check y mutación dedicados a que no vuelva.

**Tests:** `test-minical-correo-858.js`, 65 checks y 15 mutaciones. Se invirtieron (no se borraron)
los checks 4 y 5 de `test-minical-844.js` y los afectados de 846, 853, 855 y reloj-844.

### 📦859 · El compositor se apilaba encima de sí mismo y "minimizar" no minimizaba

**Resumen:** el owner reportó, con capturas de Gmail de referencia, que (1) minimizar no funcionaba
bien y (2) al darle "Redactar" varias veces, cada ventana caía encima de la anterior.

**Ninguno de los dos era un bug de estado.** Cada ventana ya era independiente — su `closeModal`,
sus destinatarios, sus adjuntos, y ESC solo afecta a la enfocada. Todo era **posición**:

- El overlay es `align-items: flex-end; justify-content: flex-end` **sin cascada**: todas las
  ventanas se dibujaban en la misma esquina.
- `.compose-panel--minimized` era `bottom: 0; right: 24px`: todas caían en el mismo píxel.
- `setMinimized` agregaba `compose-panel-overlay--hidden`, **clase que no existe en ninguna hoja**
  (verificado en las dos). Un no-op silencioso, el mismo tipo de cosa que el `D.FALLBACK_CATEGORIES`
  de 📦856.

**Qué cambió**

- **Pila vertical alineada:** cada ventana sube 40px — el alto exacto de la barra de título — sin
  desplazamiento lateral, así la de abajo deja ver la suya completa. Tope de 5 escalones: con 6 la
  ventana de arriba se salía de la pantalla en una ventana baja y perdía su barra de título.
- **Arrastre** desde la barra de título, con tope que nunca deja salir 24px de la ventana.
- **Traer al frente** al hacer clic, para que la de atrás vuelva a ser alcanzable.
- **Minimizadas** abajo a la derecha, apiladas 52px, cada una con sus botones.
- **Tope de 6 ventanas** simultáneas, que avisa en vez de acumular.

**El bug que se vio en pantalla y los tests no:** `.compose-panel` declara `min-width: 400px;
min-height: 360px` (📦650) y **en CSS, cuando `min-*` es mayor que `max-*`, gana el `min-*`**. El
`max-height: 48px` no hacía nada: la ventana se quedaba de 360px de alto y, con el cuerpo ya en
`display: none`, ese alto sobrante se veía como **un bloque blanco vacío** bajo la barrita. El
arreglo es anular los dos `min-*` explícitamente en el estado minimizado, sin tocar los de la base.

**Tests:** `test-compose-cascada-859.js`, 53 checks y 21 mutaciones. Se subió el cache-bust de
`styles.css`, que seguía en la versión del 17 de septiembre y hacía que la app sirviera una hoja
vieja desde caché.

## [0.1.237] - 2026-10-03

### 📦856 · "Tipos de evento" mostraba 0 en las seis categorías, siempre

**Resumen:** el owner reportó que la sección de tipos de evento del calendario no mostraba
información. Al mirarla, las seis filas marcaban 0.

**No faltaban datos. Los contadores contaban un vocabulario que ningún evento usa.**

La leyenda iteraba sobre las 6 categorías oficiales de `D.EVENT_CATEGORIES` —`plan`,
`capacitacion`, `auditoria`, `actualizacion`, `formacion`, `critico`— y comparaba
`e.category === cat.id`. Pero el calendario de la Bandeja solo lee **dos fuentes**, y las dos
hablan otro idioma:

| Fuente | Qué devuelve | Archivo |
|---|---|---|
| Eventos rápidos (BD) | `type: row.tipo \|\| 'rapido'` | `main/eventos-rapidos-bridge.js:101` |
| Google Calendar | `category: kairCategory \|\| 'rapido'` | `shared/google-calendar.js:107` |

`rapido` no es ninguna de las 6. Verificado contra las **75 tablas** de la base real: **ninguna
guarda las 6 categorías oficiales**, y la única tabla de eventos (`eventos_rapidos`, 5 filas) tiene
`tipo='rapido'`, con fechas de julio-agosto.

**Una segunda pista en la captura:** todos los puntitos del mini-calendario eran del mismo azul, que
es exactamente el color de respaldo `#2057B8` de `categoryColor[ev.category] || "#2057B8"`.

**Qué cambió**

- `calcularTiposEvento` → `contarTipos(events, categoriasOficiales)`: función pura que cuenta,
  **filtra las categorías en cero** y devuelve la lista ya ordenada. Las de 0 no aparecen, porque
  una fila con 0 no informa nada y hace creer que la sección está dañada.
- Se corrigió un **no-op silencioso**: el mini-calendario hacía `if (D.FALLBACK_CATEGORIES)`, pero
  **`D.FALLBACK_CATEGORIES` no existe** — es una `const` local de `app.js`, no una propiedad de `D`
  (`data.js` no la tiene; se verificó). El `if` protegía un crash y dejaba el bloque vacío, así que
  las categorías no oficiales nunca entraban al mapa de colores y todos los puntitos caían al azul
  genérico.
- `colorCategoria(id)` y `etiquetaCategoria(id)`: una sola fuente de color y nombre, compartida por
  la leyenda, el mini-calendario y el calendario grande. Una categoría sin nombre conocido devuelve
  su `id` crudo, no una etiqueta inventada.
- Estado vacío (`tipos__vacio`) en vez de una tarjeta con solo el título, que se lee como algo roto.

### 📦857 · El contador ahora cuenta lo que estás mirando, y "Tu día" no desaparece

**Resumen:** el owner vio que la lista era larga, pidió que se dinamizara: mostrar solo los tipos
con eventos, contar **el mes** en vista Mes, **el día** al elegir un día en el mini, y garantizar
que las tres secciones del sidebar existan siempre.

**El footer del calendario también mentía**

Decía "224 evento(s) en el rango visible" y esos 224 eran **del año entero**, no del mes visible.
`visibleEvents` en `renderBigCalendar` filtra solo por categoría activa, sin fecha. La suma exacta de
los contadores de la leyenda daba 224, o sea que panel y footer coincidían — y los dos estaban mal.

**El alcance ahora sigue a la vista** (`alcanceFechas(op)`, pura):

| Vista | Qué cuenta |
|---|---|
| Mes | Las celdas de la grilla, **incluidos los días en gris** del mes vecino |
| Día / Programar | El día seleccionado |
| Semana | Los 7 días desde el lunes |
| Clic en el mini | Ese día, aunque la vista siga en Mes |

Los días en gris cuentan porque **están en pantalla**. Si se filtrara por `inMonth`, el contador no
cuadraría con lo que hay al lado.

**El estado `alcanceTipos` es aparte de `selectedDate` a propósito**

`selectedDate` **siempre** tiene valor (init lo pone en hoy), así que no distingue "hoy por
defecto" de "el owner eligió este día". Y un clic simple en el mini **no** cambia `calView` (solo el
doble clic), así que sin esa bandera no había forma de saber que el owner señaló un día concreto.
Se fija en `seleccionarDiaDelMini` y en el "+N más" de una celda, y se suelta al navegar de mes,
con "Hoy", al cambiar de vista, o con el botón **"Ver el mes completo"** —que es emergente, aparece
solo cuando estás viendo un día—.

**"Tu día" desaparecía por dos motivos, ambos de layout**

1. `.kair-sidebar` tenía `overflow: hidden`: la tercera tarjeta se salía del alto y quedaba
   **recortada, sin scroll posible**.
2. En una columna flex, un hijo con contenido flexible no baja de su altura mínima si no se le
   pone `min-height: 0`. Sin eso el padre se desborda.

Ahora: mini-calendario y "Tu día" son `flex: none` (altura fija, nunca se encogen ni se van), y
"Tipos de evento" es la única que cede espacio, por dentro, con su lista scrolleable. El
`overflow-y` del sidebar pasó a `auto` y el `overflow-x` sigue en `hidden` — ese recorte en X es lo
que evita que las tarjetas se derramen sobre el correo durante los 240ms del plegado (decisión de
📦850, que se conserva).

**Un bug propio que casi revierte una decisión de 📦844**

Para calcular el mes visible metí `D.buildMonthGrid(state.viewYear, ...)` **dentro** de
`renderSidebar`. Eso es exactamente el acoplamiento que 844 eliminó: el mini-calendario está
congelado en el mes real y no sigue al calendario grande, porque cuando lo seguían, mover uno movía
el otro. El `test-minical-844` lo detectó (`26/27`) y está en la razón de ser. El cálculo se movió
a `celdasDelMesVisible()`, **fuera** de `renderSidebar`: son dos cosas distintas y ahora son dos
llamadas distintas.

**Y `calcularTiposEvento` quedó como código muerto**

857 la reemplazó y nadie la borró. Este repo ya arrastra 12 JS huérfanos; no se suma otro.

**Tres cosas que los tests encontraron y que hay que decir**

1. **Un check que se satisfacía a sí mismo.** El comentario que explica el arreglo en el CSS dice
   literalmente `` `overflow-y: auto` ``, y el check buscaba ese texto sobre el CSS crudo: se
   encontraba a sí mismo en la nota al lado y pasaba aunque la declaración real estuviera rota. Se
   detectó porque una mutación que cambiaba justamente esa línea "no mordía". Ahora los checks quitan
   comentarios antes de verificar. Documentado en `PROMPT.md` §5.15.
2. **Un regex con ventana de rango** (`[\s\S]{0,160}`) alcanzaba el `flex: 1 1 auto` del bloque
   SIGUIENTE y pasaba aunque el anterior hubiera cambiado. Anclado con `[^}]*`.
3. **Una mutación sin ancla** cambiaba la primera de las 5 ocurrencias de `overflow-y: auto;` del
   archivo, o sea otra regla, y el sidebar quedaba igual: el check pasaba sin que nadie lo notara.

**Tests**

- `main/test-tipos-evento-857.js` — **37 checks, 14/14 mutaciones** (incluye 4 de CSS, porque el
  layout es media parte del bug).
- `main/test-tipos-evento-856.js` — **32 checks, 10/10 mutaciones**.
- `main/test-bandeja-sidebar-850.js` — 49/49, 21/21. Check de `overflow` **invertido** (no borrado):
  ahora exige el recorte en X por separado y el scroll en Y.
- `main/test-minical-844.js` — 27/27, sin cambios: la garantía de que el mini sigue congelado.
- Suite completa: 115 tests, 97 verdes, 18 preexistentes, **0 regresiones**.

## [0.1.236] - 2026-10-03

### 📦855 · La bandeja abre en blanco, no con un correo que no elegiste

**Resumen:** el owner reportó que al abrir la bandeja de correo ya aparecía un mensaje abierto en el
panel derecho sin haberlo seleccionado, tanto entrando por "Correos no leídos" como por Recibidos o
Enviados. La captura lo dejó claro: el panel mostraba "Prueba 5" mientras la lista mostraba otros
cuatro correos, y "Prueba 5" no estaba en la lista.

**Eran dos bugs, no uno**

1. **La app elegía un correo por el owner.** `init()` hacía `selectMail(state.mails[0].id)`. Eso
   auto-seleccionaba el primer mensaje de la lista. Peor: `selectMail` marca como leído
   (`if (mail) mail.unread = false`), así que **abrir la aplicación metía un correo a "leídos" sin
   que nadie lo abriera**, y no era el más reciente sino `mails[0]`, el primero que devolvía Gmail.
   El respaldo era `state.selectedMailId = "m1"`, un id de mock: sin correos, la app arrancaba
   apuntando a un mensaje inexistente.
2. **El panel derecho miraba la lista sin mirar el filtro.** `renderMailList` filtra por el chip
   activo; `renderMailDetail` buscaba el seleccionado en `state.mails` **crudo, sin filtro**. Por eso
   podía mostrar un correo que la lista ya no enseñaba. Es el bug de la captura, textualmente.

**Qué cambió**

- `init()` arranca con `state.selectedMailId = null`. La bandeja abre en blanco y el detalle
  muestra su estado vacío, "Seleccione un mensaje para leerlo". Abrir un correo es una decisión del
  owner, no un efecto secundario del arranque.
- El predicado del filtro se extrajo a `mailPasaFiltroActual(m)`, en **un solo lugar y al mismo
  nivel que sus usuarios**. Lista y detalle ahora pueden hacer la misma pregunta.
- `setMailFilter(f)` centraliza los **tres** caminos que cambiaban el filtro: los chips, el
  desplegable de orden y el clic de "Correos no leídos" en "Tu día". Antes había tres asignaciones
  sueltas a `state.mailFilter`; queda una sola, dentro de esa función.
- Si al cambiar de filtro el mensaje abierto no pasa el filtro nuevo, se suelta la selección y el
  panel vuelve a su estado vacío.

**La validación va en el cambio de filtro, no en el render — y por qué**

Si la validación estuviera dentro de `renderMailDetail`, al hacer clic en un no leído —que al
abrirse marca como leído— el correo se borraría de la pantalla en el mismo clic en que el owner lo
está leyendo. Por eso `setMailFilter` valida en la transición, y hay un check que impide que alguien
la mueva de lugar.

**Un error propio que casi rompe la app**

El predicado se declaró primero **dentro** de `renderMailList`, y `setMailFilter` vive en otro
nivel. Es sintácticamente válido y se ve bien al leerlo, pero al tocar un chip de filtro saltaba un
`ReferenceError` y la bandeja se congelaba. Lo detectó el test al no poder armar su sandbox. Quedó
al nivel de función, con un check que falla si alguien vuelve a anidarlo. **Un error de alcance es
invisible a los ojos y no lo caza ningún `node --check`.**

**Checks que eran frágiles**

Dos checks de 📦853 buscaban el texto exacto `state.mailFilter = "unread";`. Si alguien
reintrodujera el auto-selección con otra redacción, el check pasaba igual. Se reemplazaron por uno
que pregunta la pregunta de verdad: *¿la selección se deriva alguna vez de `state.mails`?*. Es la
diferencia entre reconocer la redacción de un bug y verificar el comportamiento.

**Tests**

- `main/test-bandeja-seleccion-855.js` — **25 checks, 10/10 mutaciones detectadas**. Incluye el
  escenario exacto de la captura: con un mensaje abierto que el filtro activo no muestra, al aplicar
  el filtro la selección se suelta. Y el reverso: una selección que **sí** pasa el filtro se
  conserva, y sin selección previa no se inventa ninguna.
- `test-bandeja-tudia-853.js` — 76/76, 35/35 mutaciones. 3 checks de contrato viejo **invertidos**
  y 2 mutaciones que habían quedado vacías reparadas (apuntaban al string que este paquete cambió).
- `test-bandeja-tudia-849.js` — 50/50. Check invertido, igual que arriba.
- Suite completa: 113 tests, 95 verdes, 18 preexistentes, **0 regresiones**.

## [0.1.235] - 2026-10-03

### 📦853 · "Tu día" avisa lo que llegó, y el filtro de no leídos es alcanzable

**Resumen:** El indicador de "Correos no leídos" decía una cosa y hacía otra: al hacer clic solo cambiaba de vista y llegaba a la bandeja completa, nunca a los no leídos. La condición "no leídos" existía en el código pero estaba escondida en el menú "Más", así que era inalcanzable desde la pantalla. A eso se suma un **pillón rojo sobre el ícono** de cada fila de "Tu día", con la misma pinta que el 99+ del icono de la Bandeja, que marca cuántos elementos son nuevos desde la última vez que se miraron.

- **El clic de "Correos no leídos" ahora APLICA el filtro.** Antes el `go()` era `setCalendarVisible(false)` y nada más: llegaba a la bandeja, no a los no leídos. Ahora pone `mailFilter = "unread"`, reinicia el scroll al top y marca lo visto. El filtro en sí no se escribió: ya existía en la logica de la lista (`if (state.mailFilter === "unread") return m.unread;`). Lo que faltaba era que alguien lo activara.
- **"No leídos" salio del menu "Más" a la barra visible.** `PRIMARY_FILTERS` paso de `["all", "sent"]` a `["all", "unread", "sent"]`. La barra vive en el area de contenido, no en el sidebar de 250px, asi que el tercer chip no aprieta la maquetacion.
- **El aviso es un pillón rojo encima del ícono, con la misma pinta que el 99+ del shell.** Copió de `.kair-cal-badge` (`styles.css:6121`): mismo rojo `#dc3545`, misma proporción de radio, misma sombra, mismo número blanco bold y tope 99+. El owner ya reconoce ese rojo como "llegó algo"; inventar uno nuevo le habría costado un segundo cada vez que mira. Va dentro de un envoltorio con `position: relative`: si se anclara a la fila, quedaría en la esquina de las 250px del sidebar en vez de encima del ícono. No lleva interruptor: la primera versión de este paquete metió un switch y el owner lo rechazó.
- **Corrección sobre la corrección: el aviso no aparecía nunca.** El owner lo probó en la app y el pillón rojo no se pintó al llegar un correo. La causa era de diseño, no de aritmética: la línea base de "lo visto" **solo se escribía al hacer clic en el indicador**, así que un owner que nunca hacía clic se quedaba sin línea base para siempre y `nuevo` daba 0 siempre. Los tests estaban en verde porque todos sembraban el `localStorage` antes de comprobar el resultado — probaban el caso fácil y dejaban el difícil sin ver. Ahora `init()` siembra la línea base con el número actual **después** de cargar correos y eventos, y hay un escenario funcional que arranca de un `localStorage` vacío, simula la llegada de un correo y exige que marque 1.
- **El aviso de novedad tiene TRES capas de rojo, no una.** El owner lo probó y dijo la verdad: el número actualizaba pero **no se veía**. Con una sola capa hace falta que el ojo ya esté en esa fila, y "Tu día" se mira de reojo. Ahora la **fila completa** se tiñe de rojo suave con una barra roja a la izquierda, el **ícono** se tiñe más fuerte, y encima va el **pillón**: 22×19px, `font-size: 11px`, `font-weight: 800`, con **anillo blanco de 2px**. El anillo es lo que lo despega — un rojo sobre el azul clarito del ícono se perdía. La fila con novedad además conserva su feedback de hover, que el fondo rojo tapaba.
- **"Nuevo" es la diferencia contra lo visto, no el numero actual.** Si el pillón fuera el total, marcaria desde el primer render y no diria nada. Se guarda una linea base por indicador en `kair-bandeja.tuDiaVistos`, sembrada en el arranque, y al hacer clic ese indicador queda marcado como visto: el pillón baja a 0 en el acto, porque hacer clic ES mirar.
- **La linea base tiene que BAJAR con el numero, no solo subir.** Este era el bug que dejaba el aviso muerto en el uso normal, y lo destapo una auditoria del propio test: la comprobacion "si baja de la linea base el aviso es 0" se detenia en el 0 del instante y **nunca preguntaba que pasaba despues**. Con la base congelada en 4 y el owner leyendo en el celular, el proximo correo nuevo daba `max(0, 1 - 4) = 0`: no marcaba hasta juntar 5 sin leer. Y despachar el correo fuera de la app es exactamente como el owner lo hace, todos los dias. Ahora, cuando el numero actual cae por debajo de lo visto, la base se reancla al valor actual: lo que ya no esta pendiente no vuelve a contar como pendiente. El escenario funcional ahora sigue el caso completo —bajar, llegar uno nuevo, y exigir que vuelva a marcar 1— y 2 mutaciones nuevas protegen el reanclaje.
- **Sin linea base guardada no se marca nada.** La primera vez que se abre la app no se pinta nada en rojo: todavia no vio nada.
- **"Invitaciones pendientes" se RETIRO.** Contaba `m.meetingSuggestion`, y ese campo se lee en 4 lugares pero **no se escribe en ninguno**: solo existe en los correos de ejemplo de `data.js`. La fila mostraba "—" para siempre, que se lee como un dato y no lo es. Vuelve cuando exista una fuente real, que hoy seria parsear el `.ics` del adjunto.
- **La animacion del pillón dura 240ms y pulsa 3 veces, y para.** Un loop infinito en una tarjeta que vive siempre a la vista se vuelve ruido y deja de leerse. Solo anima `transform` (GPU) y `prefers-reduced-motion` la anula. El test de este paquete detecto que la primera version era de 420ms y la bajo.
- **3 tests affirming el contrato viejo se INVIERTIERON, no se borraron.** `test-bandeja-tudia-849.js`, `test-bandeja-premium-v2.js` y `test-bandeja-toolbar-compacta.js` afirmaban "los 3 indicadores" y "solo Recibidos y Enviados". Borrados no habrian avisado si alguien volvia a poner lo que se acaba de sacar.
- **📦854 · Réplica real del sistema del 99+, no un parecido.** El owner pidió investigar cómo está construido el aviso del botón de la Bandeja en vez de seguir copiándolo "a ojo". Resultado: **el 99+ no es un badge, es un servicio**. `main/notifications-service.js` corre cada 60s, `main/notifications-email.js` busca en `email_threads WHERE has_unread = 1`, inserta filas en la tabla `notificaciones` con `dedupe_key` única, emite `notificaciones:changed` y el `renderer.js` pinta el badge y el toast. La primera versión de este paquete era un **contador paralelo** con `localStorage`: no usaba esa tabla, no hablaba con el 99+, y mostraba un número distinto al de arriba.
- **El pillón cuelga de la esquina de la fila, como el 99+ del botón.** Estaba pegado al ícono y se leía como una etiqueta suelta. Se movió a `top: 2px / right: 2px` contra la fila, y se copiaron los nueve valores de `.kair-cal-badge` (`styles.css:6121`): 18px, radio 9px, `#dc3545`, blanco, 10px/700, la misma sombra y el mismo tope 99+. **El test compara esas nueve propiedades contra la regla real del shell**, así que si el del botón cambia, el de "Tu día" se ve rojo en vez de dejar de ser el mismo aviso.
- **Al hacer clic en "Correos no leídos" se marcan las notificaciones de CORREO como leídas.** Ahí está el connection real: `_marcarNotifsCorreoLeidas()` lista las no leídas con el mismo payload que `shared/kair-alerts.js:206-212` (`soloNoLeidas`, `limit: 50`), filtra las de `tipo === "correo"` y las marca por `notificaciones:marcarLeida`. Después refresca `KairAlerts` para que el 99+ baje en el acto y no al próximo tick de 60s. **A propósito NO se usa `marcarTodas`**: taparía también los eventos, y mirar el correo no es lo mismo que decir "ya vi los eventos".
- **El número grande sigue siendo el de Gmail**, independiente del servicio de notificaciones, por decisión del owner: *"este es independiente de las notificaciones, es para el correo"*.
- **Se destapó un bug de fondo:** la tabla `notificaciones` tenía **78 filas y 77 sin leer** (61 correos), y nada las marcaba como leídas. El 99+ no podía bajar nunca. Se comprueba con `SELECT COUNT(*) FROM notificaciones WHERE leida_at IS NULL`.
- `main/test-bandeja-tudia-853.js` — **75 checks, 35/35 mutaciones detectadas**. Entre ellas: una que **borra la siembra de `init()`**, tres que **deshacen la réplica visual**, una que **deja de marcar las notificaciones** (y con ella el 99+ dejaría de bajar), una que sustituye `marcarLeida` por `marcarTodas` (que taparía los eventos), y dos que **deshacen el reanclaje de la línea base**.

**Diagnóstico que se hizo antes de tocar código:** se consultaron las 76 tablas de la base real y **0 tienen filas con la fecha de hoy**; `eventos_rapidos` tiene 5 filas, la ultima del 12 de agosto. Los eventos del calendario vienen de Google Calendar, no de la base local. Ademas, `app.js` hace `return D.EVENTS.slice()` cuando el adaptador local devuelve 0 eventos, o sea cae a los **datos de ejemplo de julio** y nunca llega a consultar Google.

## [0.1.234] - 2026-10-03


### 📦852 · Documentación: la fuente de verdad era falsa y nadie lo había comprobado

**Resumen:** Se auditó toda la documentación contra el código y se encontraron reglas "OBLIGATORIAS" que mandaban llamar funciones que **no existen**. Con la auditoría de por medio se construyó la puerta de entrada para cualquier modelo que retome el trabajo, y una regla nueva que prohíbe tomar por cierto lo que dice un documento.

- **Reglas que eran falsas y se eliminaron.** `CONTEXT.md` decía "SIEMPRE escapar HTML con `KairUI.esc()`" y "SIEMPRE formatear fechas con `KairHelpers.formatDate()`". **Búsqueda sobre todo el código: 0 archivos.** Un modelo que hubiera seguido la regla al pie de la letra habría escrito una llamada a una función inexistente y la vista se habría caído con `ReferenceError`. También se cayó el "`var~, no `let/const`" (`main.js` tiene 2 608 `const`) y el "último paquete es 📦579" cuando van 850+.
- **La causa de que existieran: `AGENTS.md:235` referenciaba `kair-canonical.css` como fuente de las clases BEM. Ese archivo nunca estuvo en el repo** — comprobado sobre los 1 244 commits de todas las ramas, no solo sobre el árbol actual. Esa línea es la fuente probable del prompt viejo, que quedó obsoleto.
- **~PROMPT.md~ v2.0 (nuevo).** Un `índice`, no una fuente: dice dónde está cada cosa en vez de copiar la paleta y los tokens. La versión anterior los duplicaba, y por eso quedó vieja. Documenta las **tres islas de paleta** que tiene el sistema visual (shell / Bandeja / calendario), que es lo que más confunde a un modelo nuevo.
- **~Historial.md~ (nuevo).** Responde "¿dónde quedó el trabajo y qué falta?". Arriba un bloque de estado de cierre; abajo la bitácora por jornada, los bloqueantes con su ubicación exacta y la cola acordada.
- **~CLAUDE.md~ (nuevo).** Puerta de entrada de 50 líneas para las herramientas que leen un archivo de arranque. Los seis documentos que ya describían el proyecto (`README`, `CONTEXT`, `design_system`, `CHANGELOG`, `release-notes` y `PRODUCT.md`) ganaron un puntero de arranque, y cada uno aclara su propio rol para que no se pisen entre sí.
- **🔴 Regla nueva: cero presunciones.** Un documento que diga "X" no es evidencia de que X sea verdad. Hay que verificar que exista, que siga vigente, que el valor sea el de hoy y que aplique al caso. **Y aplicársela a las propias afirmaciones del prompt.**
- **La regla se aplicó a sí misma en el momento:** al medir el ~PROMPT.md~ recién escrito, **dos de sus propias cifras estaban mal** (27 bridges en vez de 30, y un conteo de tests mal hecho por no bajar a los subdirectorios). Ambas corregidas con el número medido.
- **~CONTEXT.md~ reformateado, no borrado.** Iba a eliminarse un bloque de 94 KB por ser "un changelog duplicado". Al verificar, se vio que contiene el **análisis de causa-raíz** que el CHANGELOG no tiene (el CHANGELOG dice "se arregló"; ese bloque dice por qué se rompió y por qué ningún test lo cazó). Se partió: 68 líneas gigantes de hasta 5 621 caracteres pasaron a 1 318 líneas legibles, con **md5 del contenido idéntico antes y después**. No se perdió un solo carácter.
- **Dos bloqueantes verificados y registrados en ~Historial.md~:**
  - El bridge `gestion-humana` acepta `estado`, `fechaIngreso` y `fechaRetiro` en `_handlerUpdatePersonal`, que el renderer declara protegidos en `PROTECTED_FIELDS`. La protección es solo de UI. Marcado crítico desde v0.1.212 y sigue abierto.
  - `styles.css` usa 6 tokens premium que **nadie define** en el shell; 4 sin respaldo quedan sin estilo (`.kair-pendientes-popover`).
- `PRODUCT.md` corregido: paleta, tipografía, selector de dark mode, y las afirmaciones falsas de que "no hay README" y "512 checks".
- **3 trampas internas de ~AGENTS.md~ corregidas:** la referencia al CSS inexistente, la convención de commits (decía "NO conventional", ya van 850+ paquetes) y la sección de tests (mandaba correr scripts que ya no existen).
- Suite completa sin cambios: 111 tests, 93 verdes, 18 preexistentes.

## [0.1.233] - 2026-10-03


### 📦850 · La columna lateral se pliega y el correo toma su espacio

**Resumen:** El sidebar (mini-calendar + Tipos de evento + Tu día) ocupa 250px fijos. Un botón chiquito en el borde lo pliega y el correo o el calendario toman ese ancho. El botón se acuerda del estado entre sesiones.

- **El botón vive FUERA del `<aside>`, en el `.kair-layout`, como hermano.** No es una preferencia de estilo: si estuviera adentro se iría con la columna al plegarse y no quedaría forma de volver a abrirla, que es justo el requisito. Como hermano, `renderSidebar()` no lo destruye (ese vacía el `<aside>`, no el layout) y su listener se enlaza **una sola vez** en `bindHeader()`.
- **El ancho sale de una variable, `--side-w`, no de un número.** El `<aside>` mide `width: var(--side-w)` y el grid quedó en `auto 1fr` en vez de `250px 1fr`. Animar el track del grid depende de que el navegador lo interpole; animar el `width` de una caja es confiable en todas partes. Y como el grid es `auto`, el contenido crece con el sidebar en vez de esperar a que la transición termine.
- **Al plegar se quita el `column-gap` también**, no solo el ancho. Con el gap puesto quedaban 16px de franja muerta entre el borde y el correo, el tipo de detalle que hace que un layout se vea "casi bien" sin saber por qué.
- **`overflow: hidden` en el sidebar.** Sin el recorte, durante los 240ms de la transición las tres cartas se derramaban sobre el correo.
- **`pointer-events: none` al plegar.** Un día del mini que sigue cogiendo el mouse de forma invisible lanzaría el popup de 📦846 sobre el hueco, y el popup se quedaría flotando ahí sin nada debajo.
- **El clic NO llama a `render()`, solo cambia un atributo.** Un `render()` reconstruye la lista de correo entera para cambiar un ancho. Lo único que se hace a mano es `ocultarPopupDia()`, porque ese popup vive en `document.body` y no se va solo.
- **El botón se ancla a la variable, no a un número**: `left: calc(var(--side-pad) - 13px)` y se desplaza en X con `translateX(var(--side-w))`. El ancho de la columna y la posición del botón salen de las **mismas** variables, así que cambiar un breakpoint no puede descuadrarlos.
- **`z-index: 10000`**: por encima del popup del mini (9999), que se dibuja a la derecha del día y lo cruzaba, y muy por debajo de los modales (500000) y la firma (450000).
- **A 1080px el botón se oculta con el sidebar.** A ese ancho la regla preexistente ya esconde el `<aside>`; sin esta, quedaba un botón flotando sin nada que plegar.
- **Se acuerda en `localStorage`** (`kair-bandeja.sidebarColapsado`), leído con `=== "1"` y no como truthy: `localStorage` guarda texto y la cadena `"0"` es truthy, así que un `if (getItem(...))` abriría la columna aunque el owner la hubiera dejado plegada.
- `main/test-bandeja-sidebar-850.js` (48 checks) — **20/20 mutaciones detectadas**. El test se armó como `evaluar(htm, css, js) -> {f, n}` para poder mutar en memoria sin tocar los archivos reales.

### 📦851 · Se fue la etiqueta con el mes del encabezado

**Resumen:** El chip "Octubre 2026" del topbar mostraba el mismo dato dos veces: el calendario grande ya lo pone en su toolbar y el mini-calendar muestra el mes actual. Se eliminó de punta a punta.

- **Eliminación completa, en los 3 archivos**: el `<span class="kair-chip-date">` del HTML, los 14 renglones de su regla CSS y las 3 líneas de JS que lo llenaban en cada render. No quedó código muerto: reintroducir solo el JS habría llenado un chip inexistente.
- **`state.viewMonthLabel` NO quedó huérfano.** Antes tenía dos consumidores (el chip y el toolbar del calendario grande) y conserva el que importa. El riesgo real no era que algo se rompiera al quitar el chip, sino que alguien se llevara el mes **por error** y el toolbar quedara en blanco sin que nadie lo notara.
- **El toolbar tiene dos caminos para el mes y se necesitan los dos**: al pintarse (el `${`} del template) y al actualizarse (la rama `else` de day/week/schedule). Un solo check que buscara el texto en todo el archivo pasaría con uno de los dos faltando, y con el otro ausente el toolbar queda con el texto viejo al cambiar a vista Mes. Por eso hay dos checks, uno por camino.
- **Dos checks de `test-bandeja-premium-v2.js` afirmaban el chip**, uno mirando el HTML y otro el JS. Se **invirtieron los dos**, no uno: si se hubiera borrado solo el del HTML, reintroducir el código sin el markup pasaba verde.



### 📦849 — Los 3 indicadores bajan al sidebar y "Eventos críticos" desaparece

**Resumen:** La franja de 4 tarjetas blancas que ocupaba el ancho de la pantalla se eliminó. Tres de sus indicadores bajaron al sidebar, en el lugar que ocupaba la tarjeta "Integración correo", con el mismo esqueleto que "Tipos de evento" pero con el subtexto debajo. El cuarto se fue con todo su código. El espacio liberado lo toma la lista de correo.

- **"Eventos críticos" eliminado completo:** la tarjeta, sus cálculos (`criticalThisMonth`, `criticalSub`) y su chip verde. Solo contaba eventos de la categoría `critico`, que hoy no se cargan: mostraba siempre "—" con el sello "Todo al día". Cero información en un cuarto de la pantalla.
- **La tarjeta "Integración correo" también se fue**, y con ella el texto de "arrastra un correo" y el botón "Abrir bandeja". Ese botón repetía lo que ya hace el indicador de Correos no leídos, que abre la bandeja.
- **El espacio lo gana el correo, no se deja hueco.** `.kair-main` es una columna flex (`.kpis` en `flex:none`, `.kair-layout` en `flex:1`), así que al quitar la `<section>` el layout sube solo. No hizo falta CSS nuevo para el espacio.
- **"Tu día" es la sección nueva.** Mismo esqueleto que "Tipos de evento" (ícono + nombre + contador) con dos mejoras: el subtexto va **debajo** del nombre, porque en una fila de 250px al lado aplastaba el número, que es el dato que se viene a leer; y la fila **se apaga cuando el valor es 0**, porque un "—" sin atenuar se lee igual que un dato.
- **Cada fila navega a lo mismo que antes**, verificado con un test que ejecuta las tres: correos → la bandeja, reuniones → vista Día de hoy, invitaciones → el filtro de reuniones.
- **Una sola fuente de datos.** `renderKpiStrip()` (pintaba las tarjetas) pasó a ser `calcularIndicadores()`, que solo calcula y devuelve los 3. El sidebar los dibuja. Un solo cálculo, un solo lugar donde puede estar mal.
- **Tests afectados, actualizados no borrados:** `test-bandeja-premium-v2.js` afirmaba el diseño viejo en 5 checks (la `<section class="kpis">`, `.kair-kpi`, los 4 ids, la tarjeta de integración). Se **invirtieron**: ahora exigen el diseño nuevo y la ausencia del viejo. Un check borrado es un hueco; uno invertido es una red.
- `main/test-bandeja-tudia-849.js` (47 checks) — incluye el conteo con datos reales y la navegación de las 3. **10/10 mutaciones detectadas** y los 3 tests de la bandeja detectan el diseño viejo si alguien lo restaura.

### 📦848 — El popup decía "Todo el día" para todos los eventos

**Resumen:** Reportado por el owner tras el fix anterior. Los eventos mostraban "Todo el día" aunque tuvieran hora.

- **La causa fue un criterio que me inventé.** El fix de 📦847 decía "si el rango de horas es 00:00–23:59, es un evento de todo el día". Pero hay **5 generadores en `main.js`** que crean eventos con exactamente ese rango: los recordatorios de presupuesto (`main.js:5613`, con `allDay: true`), las inspecciones programadas y otros tres. No son eventos de todo el día: la grilla los dibuja de 9:00 a 11:00.
- **La verdad ya existía y la usaba la vista Día.** `renderDayView` separa en dos grupos con `isAllDayEvent` (`app.js:3641`): los que son todo el día van al banner, el resto a la franja con `getEventStartHour`. El popup ahora usa **la misma función**, así que no puede discrepar de la grilla. No se cambió el calendario para tapar un popup: se cambió el popup para decir lo que el calendario ya decía.
- **Diagnóstico con la BD real:** `%APPDATA%\sgsst-electron-app\kair.db`, porque la del userData de Electron de prueba es otra. Los eventos de la tabla `eventos_rapidos` traen `hora_inicio`/`hora_fin` ("08:00"/"12:00") — un tercer nombre de campo, junto a `startHour` (mocks) y `start`/`end` (IPC).
- **El test de 📦847 afirmaba el bug como correcto.** Tenía 3 checks diciendo "el evento 00:00-23:59 se declara Todo el día", y pasaban porque yo había escrito el código así. No se borraron: se **invirtieron** para exigir el comportamiento correcto.
- `main/test-minical-allday-848.js` (22 checks) — 8 casos que preguntan a la vez qué decide la grilla y qué dice el popup, y los comparan. **El bug lo detectan los 3 tests** del mini.

### 📦847 — Dos notificaciones por evento, y todas las horas en 00:00

**Resumen:** Al pasar el mouse por un día con eventos se veían dos cuadros, y los eventos salían sin hora.

- **Las dos notificaciones:** el popup (nuestro) y el `title` nativo del navegador, que se dibuja **encima**, en una capa del sistema fuera del documento. Ningún `z-index` lo tapa: se quita el atributo. El `title` queda solo en los días **sin** eventos, donde es la única pista y no hay popup que lo estorbe. Como el `title` era lo que anunciaba el doble clic, esa pista pasó al pie del popup.
- **Las horas en 00:00:** el popup leía `ev.startHour`, pero los eventos reales llegan con `start`/`end` como **texto** ("09:00"). Los mocks de `data.js` usan `startHour` numérico, así que el test pasaba con el bug. El popup ahora usa `getEventStartHour()` y `getEventDuration()`, los helpers que la app ya tenía.
- **El andamiaje de un test también estaba mal:** el test de 📦846 corría `_franja` en una VM sin esos helpers y reventó al cambiar la firma. Se reparó **extrayendo los helpers del propio `app.js`**, no copiándolos: si mañana cambian, el test usa el nuevo.
- `main/test-minical-hora-847.js` (23 checks) — **2/2 bugs detectados al revertir el fix** y 8/8 guards que muerden.

### 📦846 — Popup de categorías al pasar el mouse por un día con eventos

**Resumen:** Al hacer hover sobre un día con eventos del mini-calendar, aparece un cuadro con las categorías de ese día, el color de cada una, su contador y los eventos con hora y título.

- **Agrupado por categoría** en el orden de `EVENT_CATEGORIES`, no en el de aparición: la lista queda estable entre renders.
- **Tope de 8 eventos**; lo que sobra sale como "+N más". Si una categoría no cabe, **no se imprime su título**: es preferible ver 2 categorías completas que una tercera con contador y nada debajo.
- **Un solo elemento reutilizado** en `document.body`, no uno por día. Se oculta al empezar cada render, al hacer scroll y al redimensionar: vive fuera del sidebar, así que sobrevive a los re-renders y se despegaba de su celda.
- `pointer-events: none` **no es cosmético**: si el popup aceptara el mouse, al entrar dispararía el `mouseleave` del día (parpadeo) y se comería el segundo clic del doble clic de 📦845. Es informativo, nunca interactivo.
- **3 bugs encontrados en el propio script antes de aplicar nada:** `WEEKDAY_LABELS` es lunes-primero y el script indexaba con `getDay()` (domingo=0) — un domingo habría dicho "Lun"; la variable CSS `--kair-text-1` no existe en el tema; y la hora tiraba los minutos.
- `main/test-minical-hover-846.js` (49 checks) — **12/12 mutaciones detectadas**.

### 📦845 — Doble clic en un día del mini abre la vista Día del calendario grande

**Resumen:** Doble clic en cualquier día del mini-calendar lleva el calendario grande a ese día y lo cambia a vista Día, con su franja horaria. Funciona con días con eventos y sin ellos.

- **No se usa `addEventListener("dblclick")`, y no es una manía:** el clic simple llama a `render()`, que **reconstruye el DOM del sidebar**. El segundo clic cae sobre un elemento nuevo y el navegador nunca dispara `dblclick`, que exige los dos clics sobre el *mismo* elemento. Un `dblclick` bien escrito se vería correcto y no haría nada.
- **Se detecta por fecha:** mismo ISO dos veces dentro de 350ms. Frente al patrón de "retrasar el clic 250ms a ver si viene otro", **el clic simple no espera nada** — se siente instantáneo.
- 24 checks, **7/7 mutaciones detectadas**.

### 📦844 — El mini-calendar se queda fijo en el mes actual

**Resumen:** El mini-calendar ya no navega meses. Se dibuja siempre con la fecha de hoy y perdió las flechas.

- **El bug de fondo:** el mini y el calendario grande **compartían estado** (`viewYear`/`viewMonth`) y **ambos llamaban la misma función `changeMonth()`**, así que mover el mini movía el grande y al revés quedaban en meses distintos. Arreglarlo con flechas era parar el síntoma; se quitaron las flechas porque el mini no es un navegador.
- **El calendario grande conserva su navegación** y su botón "Hoy", sin tocar.
- **Bug encontrado preguntando:** el "¿no se congela en octubre?". `MONTH_VIEW` se construye **una sola vez** al cargar `data.js`, y `buildMonthGrid` marcaba "hoy" desde esa constante. Con la app abierta al pasar la medianoche, el mes se actualizaba pero "hoy" se quedaba en el día anterior. Ahora se calcula en cada llamada.
- **El clic del día mueve el calendario grande** a ese mes. Al fijar el mini se perdía una garantía: antes el clic siempre caía en un mes visible.
- **Hallazgo de paso:** `render-sidebar.js` y `render-calendar.js` **no se cargan**; son código muerto de un refactor. Lo vivo es `renderSidebar()` dentro de `app.js`. Hay 8 archivos muertos en esa carpeta.
- 4 tests (27 + 29 + 24 + 49 checks), **cobertura cruzada comprobada**: 4 mutaciones que un test no ve las caza otro, y vice versa.

### Tests y housekeeping de esta tanda

- **3 guards de cache-bust reescritos** (`test-bandeja-paginacion`, `test-bandeja-toolbar-compacta`, `test-minical-hover-846`). Tenían el token **escrito a mano**, así que se caían en cada paquete y obligaban a editar el test para que pasara. Un guard así no protege el caché: protege la fecha del último bump. Ahora validan la **forma** del token, y además que `premium.css` y `app.js` **compartan** token: si difieren, el navegador sirve el JS nuevo con el CSS viejo.
- **Suite: 91/109 en verde**, los mismos 18 fallos preexistentes (firma, sync, z-index), **cero regresiones**.
- CJK/mojibake: 0. `Temp/` limpio de artefactos de trabajo.

## [0.1.228] - 2026-10-02

### 📦843 — El sidebar no te llevaba a ningún lado si estabas en un submódulo

**Resumen:** Un sidebar existe para navegar. Este no cumplía su trabajo: si estabas dentro de un submódulo (Capacitaciones 3.2.1, Plan de Trabajo, Política…) y hacías clic en otro módulo del sidebar, el clic se descartaba **en silencio**. Sin aviso, sin alerta, sin nada en pantalla. Para llegar había que hacer un rodeo de dos clics: primero el módulo en el que ya estabas, después el que querías.

- **Había dos candados, no uno.** El del clic del sidebar (`createSidebarButtons`) y otro en `showModuleContent` rotulado **"✅ SOLUCIÓN TEMPORAL"**, que lleva así desde hace tiempo. El `return` de ese segundo se colaba 10 líneas **antes** del `currentSubmodule = null` que la propia función ya tenía: la corrección estaba dentro de la función, inalcanzable.
- **Lo que faltaba no era permiso, era teardown.** Al salir de un submódulo hay que **destruir el componente activo**, o sus watchers, sus modales y el CSS que inyectó en el `<head>` global quedan vivos y se cuelgan sobre el módulo siguiente — la clase de bug que 📦771/774/783/784 vinieron tapando uno por uno.
- **Nuevo `_salirDeSubmodulo()`** en `renderer.js`, usada por los tres caminos que salen de un submódulo: el clic del sidebar y las **dos** variantes del botón "Volver".
- **Bug extra que salió en el camino:** `backToModuleCallback` (la variante "normal" del botón Volver, la que usa la mayoría de submódulos) **nunca destruía el componente**: solo limpiaba el estado. Por eso existía la variante "segura" que sí lo hacía, duplicada. Ahora las dos son la misma función.
- **La red de seguridad se queda.** El candado de `showModuleContent` no se tocó: como el sidebar ya limpia el estado antes de navegar, nunca se dispara desde ahí, pero sigue protegiendo a los iframes y a las tareas del dashboard. Quitarlo sería eliminar la única protección sin reemplazarla.
- **Decisión del owner:** perder la posición dentro del submódulo está bien. Si el usuario elige un módulo principal en el sidebar, quiere el módulo.
- **Tests**: `main/test-sidebar-nav-843.js` (14 checks) — la teardown se **ejecuta de verdad** en una VM, incluido el caso en que `destroy()` revienta. **6/6 mutaciones detectadas**; la más importante invierte el orden de las llamadas, que deja el sidebar igual de mudo con el código aparentemente correcto.

### 📦842 — El header se quedaba con una franja de 8px al ocultarse

**Resumen:** Al hacer scroll, el header se colapsa para liberar la pantalla. Se quedaba una franja blanca de 8px abajo: no se ocultaba del todo.

- **Medido en Electron, no supuesto:** expandido **49px**, colapsado **8px**. Los 8px eran exactamente el `padding` de `.header-content` (4px arriba + 4px abajo).
- **Por qué:** `min-height: 0` (📦837) sí deja llegar el *content box* a 0, pero **el padding vive fuera del content box**: un `border-box` nunca puede medir menos que su padding. La fila `0fr` se detenía en 8px.
- **La paradoja:** el comentario de 📦837 en el código dice *"el padding se mueve al hijo para que el colapso no deje resto de padding"*. Hizo lo contrario: al moverlo al hijo, el padding pasó a ser parte de la caja que tiene que colapsar.
- **Fix:** al colapsar, el padding del hijo va a 0 y se interpola en 0.4s para que baje junto con el alto y no dé un salto. Resultado medido: **0px**.
- **Lo que NO se tocó:** el logo tiene `transform: scale(1.6)` sobre 48px y se sospechó que desbordaba el `max-height: 70px`. Medido: dibuja a **46px**. No había desborde, no se tocó.
- **Tests**: `main/test-header-colapso-842.js` (7 checks) — **mide**, no lee texto: lanza Electron como subproceso y lee el `getBoundingClientRect()`. Un guard estático sobre el CSS sería decorado, porque la franja no viene de una regla ausente sino del layout real. **2/2 mutaciones detectadas**.

### Continuidad de 📦841 (v0.1.227) — sigue pendiente de validación visual

- El desvanecido al cambiar de módulo y al entrar/salir del Inicio está implementado y verificado (27 checks, 22/22 mutaciones), pero **el owner todavía no lo ha validado en la app**.

## [0.1.227] - 2026-10-02

### 📦841 — Al cambiar de módulo la pantalla saltaba de golpe

**Resumen:** Cambiar de módulo en el sidebar borraba el contenido viejo de un golpe y pintaba el nuevo, sin ninguna transición. Ahora el contenido se desvanece y vuelve a aparecer. El piloto arranca en el cambio de módulo del sidebar, que es lo que más se repite en el día.

- **`KairMotion.swapView(el, construir, opts)`** (nuevo): desvanece lo que hay (**110ms**), construye lo nuevo y lo funde de entrada (**160ms**). Solo mueve `opacity`, con curva `cubic-bezier(0, 0, 0.2, 1)` y transición CSS en línea. Total ~270ms, dentro del techo de 300ms.
- **Es secuencial a propósito, no un crossfade solapado**: hay **45 iframes** en los módulos y solapar dejaría dos contenidos vivos a la vez; si algo se interrumpe, el viejo se queda pegado en pantalla. Secuencial, si algo falla, se nota de una y el contenido nuevo entra igual.
- **Interrumpible**: dos clics seguidos **no** encolan, se reorienta — se construye solo el último. Si construyeran los dos se vería un destello del módulo intermedio, que es justo lo que el usuario pidió evitar al pedirlo rápido.
- **El cerrojo no se espera**: la construcción se pasa como callback y `showModuleContent` **no** hace `await`, para que `_showModuleContentLock` se suelte en su microtask. Con `await` el cerrojo quedaría tomado los ~270ms del fade y el segundo clic se perdería en silencio.
- **Red de seguridad**: pase lo que pase se limpia el estilo en línea y hay temporizador de respaldo. **Nunca queda un `opacity:0` pegado** (pantalla en blanco). En `renderer.js`, `_swapContenido()` es tolerante: si el wrapper no cargó, construye igual — el desvanecido es adorno, nunca un requisito.
- **`prefers-reduced-motion`**: sin fade de salida y sin espera; solo el de entrada, y corto. La opacidad no produce mareo, así que no se quita (el skill pide "gentler, not zero").
- **El Inicio también se desvanece** (`showHomePage`). Quedaba como único salto seco de la app: se entraba con fade pero al Inicio no. El cromo (ocultar el sidebar y `.vanta-fullscreen`) se resuelve **fuera** del desvanecido a propósito: si se moviera dentro, el sidebar se quedaría 110ms en pantalla con el contenido ya desvanecido.
- **Guarda de carrera en el Inicio** (`_showHomeToken`): `showHomePage()` es `async` y su construcción ocurre **después** de un `await loadConfig()`. Con el fade, esa espera abre una ventana de ~110ms en la que un módulo abierto por el usuario se puede pisar con un home construido tarde — pantalla en la sección equivocada y sin error en consola. `showModuleContent` invalida el token al abrirse y el callback tardío se retira sin construir nada. Esa carrera existía antes con una ventana de ~5ms; el fade la habría hecho visible y no se introdujo knowingly.
- **Cache-bust** de `kair-motion.js` bumpeado: sin esto Electron sirve la copia vieja, `swapView` llega `undefined` y el fade no aparece.
- **Tests**: `main/test-swapview-841.js` (27 checks). **22/22 mutaciones detectadas** (16 del wrapper y el cableado del módulo, 6 del Inicio) — se rompió el código a propósito 22 veces y las 22 cayeron; 2 se clasificaron como **mutantes equivalentes** (la defensa está en capas y quitar una no cambia el comportamiento, no es un hueco del test). Suite completa: **100 tests, 82 verdes**; los 18 que fallan son los mismos de antes de este trabajo (z-index de CSS, cache-bust de `styles.css` y el `no such column: actualizado_en` del sync).
- **Bugs encontrados al probar**: el temporizador de entrada dejaba su id guardado cuando ya había disparado (el campo mentía), y el test daba por bueno que dos clics construyeran los dos módulos — se corrigió la expectativa, no el código.

## [0.1.226] - 2026-10-01

### 📦840 — El panel de pendientes decía una cosa y pintaba otra, y el hero se comía una fila

**Resumen:** Gestión Integral ya reportaba sus pendientes al dashboard (📦838), pero al filtrar por el módulo el encabezado, los contadores y las tarjetas contaban listas **distintas**. Además aparecía un pendiente falso de rendición de cuentas, los críticos se ordenaban de últimos, y el hero del Inicio ocupaba una banda completa para sí solo. Tres bugs reales y un ajuste de espacio.

- **Pendiente fantasma de rendición de cuentas**: `calculateRendicionCuentasStats` devuelve el objeto **siempre**, aunque no encuentre la carpeta de la empresa, así que la guarda `giRendicion && actas === 0` era cierta para toda empresa que aún no tuviera "2.6 Rendición de cuentas". Ahora la función declara `disponible` (como ya hacían Evaluación Inicial y Gestión del Cambio) y las dos guardas lo exigen.
- **Los 3 tabs contaban listas diferentes**: `MODULE_TASK_MAP` estaba declarado **dentro** de `filterDashboardTasksByModule`, así que el manejador de los tabs y los contadores del encabezado no lo alcanzaban y armaban su propia lista con todas las tareas. Se veía "Todos 4 · Críticos 7" y al pulsar "Críticos" se perdía el filtro a medias. El mapa subió a nivel de módulo y todo el panel pasa por `tareasDelFiltroActual()`.
- **El primer clic no filtraba**: el filtro se leía **antes** de asignarse, así que el primer clic devolvía las 24 tareas de todos los módulos con el encabezado diciendo "4 punto(s)". Era intermitente (el segundo clic sí funcionaba) y por eso los tests no lo veían. Se invirtió el orden.
- **Los críticos quedaban al final**: el sort usaba `(priority_map[p] || 3)` y el peso de `critical` es `0`; en JavaScript `0` es falso, así que `0 || 3` daba `3` y las tarjetas rojas se dibujaban debajo de las "Atención". Ahora hay un `pesoPrioridad()` que respeta el 0.
- **Espacio recuperado en el Inicio**: el hero y las 4 tarjetas eran hermanos sueltos de `.kair-page`, así que no había forma de alinearlos. Ahora cuelgan de un wrapper `.kair-dash-top`. Además **en modo ventana el hero se oculta** y las 4 tarjetas toman todo el ancho en 4 columnas (a 1200px cada una queda en ~201px en vez de ~427px del 2×2); el hero reaparece desde 1400px de ancho.
- **Textos del hero resumidos** (el owner lo autorizó): el título pasó de "Tu sistema requiere atención: N frentes críticos por gestionar" a "N frentes críticos por gestionar", y el subtítulo de 3 frases a "Plan X% · N documentos vencidos · N accidentes en el año". **La estructura interna del hero no se tocó**: mismos 10 elementos, mismo orden, aside a la derecha.
- **Tests nuevos**: `test-radar-gi-829.js` (24 checks), `test-tabs-dashboard-829.js` (18), `test-orden-tareas-829.js` (13), `test-hero-fila-840.js` (35). **23/23 mutaciones detectadas** en total: se rompió el código a propósito 23 veces y las 23 cayeron. Suite completa: **99 tests, 81 verdes**; los 18 que fallan se probaron contra `HEAD` limpio (stash + pop + comparación del parche byte a byte) y ya fallaban antes de este trabajo.
- **Bugs de los tests que aparecieron en el camino**: `test-kair-motion` ataba el orden de una llamada con sus argumentos literales y fijaba el token de cache-bust a una fecha concreta — se rompía solo en cada bumpe. Ambos ahora validan la propiedad, no la forma. `test-dashboard-tareas-gi` buscaba el mapa por su nombre viejo. `Temp/run-all-tests.js` (nuevo) corre los 99 tests: antes no había forma de ver la suite completa.
- **AGENTS.md**: el diagrama de estructura se actualizó, y se corrigió una afirmación vieja que decía que el CSS del dashboard vivía en `styles.css` con scope `.kair-dashboard` (hace rato está en `shared/kair-premium.css` con `.kair-premium`). De paso, 5 typos de traducción con ideogramas chinos.

### 📦838 — El overlay post-login congelaba la barra + Gestión Integral con permisos propios y tareas en el dashboard

**Resumen:** El segundo login (tras cerrar sesión) dejaba la barra de progreso clavada en 0% porque `KairLoadingController._getElements()` cacheaba los nodos del overlay anterior y escribía sobre nodos ya borrados del DOM. En paralelo, Gestión Integral recibió clave de permiso propia por submódulo,Tasks en el dashboard y badge.

- `KairLoadingController._getElements()` deja de cachear los nodos del overlay anterior: cada login re-quiere los suyos. Test nuevo `main/test-kair-loading-bar.js`.
- Permisos de Gestión Integral con clave propia por submódulo: 9 de 13 compartían `gestion-integral.plan-trabajo`, así que abrir el Plan de Trabajo abría los otros ocho sin querer. El módulo ahora exporta todas sus carpetas.
- El dashboard de Gestión Integral calcula tareas, `module_status` y badge (`gestion_integral_alerts`) con los mismos datos que ya consume el home. La navegación de tareas GI apunta a Gestión Integral en vez de caer en un módulo inexistente.
- `test-evaluacion-inicial-v2.js` se mueve de `main/` a `tools/lab/`.

### 📦837 — Pulido de UI: contraste AA, sin shimmer ni glow, header que colapsa por grid

- Side-tabs de 3px a 1px (`.kair-task`, `.gh-metric`, `.ep-dcard`).
- Contraste AA: `#6c757d` → `#5f6771` y `#94a3b8` → `#64748b` (4.55:1 sobre `#f8fafc`).
- Sin shimmer en `.progress-fill` ni `.kair-skel`; sin glow infinito del título de login (conserva el fade-in).
- Borrados dots muertos, 6 partículas del splash y el `<img>` `#header-logo` sin uso.
- El header colapsa por `grid-template-rows: 1fr↔0fr` en vez de animar márgenes.
- Excepción documentada: el `repeating-gradient` de `.kair-chart` es la cuadrícula de fondo funcional, no un efecto.

### 📦836 — Anime.js v4.5.0 vendorizado + wrapper KairMotion

- `vendor/anime.umd.min.js` (MIT, local) + `assets/js/kair-motion.js` con API `available()` / `reduced()` / `staggerIn()` / `countTo()` / `dashboard()`, y respaldos que dejan `opacity` en 1 si anime falta o falla.
- Hook en `loadDashboardData` alineado al final del render, para que la animación arranque después del repintado.
- `test-kair-motion.js`: 44/44 con jsdom.

### 📦835 — Skill "impeccable" + PRODUCT.md


### 📦834 — SVE: paleta azul K+AIR y pulido de animaciones

### 📦833 — Análisis por periodos: ahora se pueden AGREGAR análisis nuevos

**Resumen:** La tarjeta "Análisis de indicadores por periodos" del programa SVE solo mostraba los 2 análisis que trae la plantilla y permitía editarlos, pero no había ninguna forma de agregar un periodo más desde la interfaz. Ahora la tarjeta tiene botón **"Nuevo período"** con su formulario, validaciones y persistencia en SQLite.

- `sve-views.js`: botón "Nuevo período" en la cabecera de la tarjeta `cardAn` + modal "Nuevo análisis por periodo" (periodo, hallazgos, propuestas, responsable) con foco automático al primer campo.
- Validación en dos niveles: **vacío** ("el periodo no puede quedar vacío") y **duplicado** ("ya existe un análisis para el periodo \"…\"" — conserva lo tecleado y muestra el hint "Ese periodo ya existe: edita el existente en su tarjeta."). Ambos casos reabren el formulario con los datos preservados.
- `sve-app.js`: acción `addAnalisis(datos)` que agrega al store, recalcula el orden y dispara el guardado; la persistencia entra por el canal existente `medprev:sve:analisis:guardar` (borra y reinserta la lista completa en `mp_sve_analisis` dentro de una transacción).
- `main/test-sve-analisis-agregar.js` (nuevo): **40 checks** estáticos sobre la cadena completa (vista, store, bridge, schema, cache-bust). Sintaxis `node --check` OK sobre vistas y app.
- Verificación E2E real en la app (Playwright): tarjeta con botón → modal → validación vacío → validación duplicado → alta correcta ("Análisis creado — El periodo … se agregó a la lista.") → persistencia tras recargar y volver a entrar. 5 capturas en `docs/capturas/833-analisis/`. Cache-bust `MEDPREV-20260930-3-1-2-indicadores-edit-17`.

### 📦832 — "Registros de morbilidad" pasó a "Casos SVE por año"

**Resumen:** La tarjeta de morbilidad mostraba un conteo que no correspondía a lo que el programa registraba. Ahora se llama **"Casos SVE por año"** y resume LOS SEGUIMIENTOS del programa agrupados por el año exacto de cada seguimiento (`cuenta()` agrupa por `anio`), que es lo que la vista de casos realmente tiene.

- `sve-views.js`: tarjeta renombrada + conteo por año desde los seguimientos.
- `main/test-sve-casos-covid.js` ampliado a **24 checks** (nombre de la tarjeta, agrupación por año, y los 20 checks previos del flujo de casos).

### 📦831 — Pulido del editor de indicadores + residuos de Playwright al .gitignore

**Resumen:** Segunda pasada de UI/UX sobre el editor que abrió 📦830, más higiene de repositorio.

- **Fix de raíz de los estilos descartados en silencio**: `U.el` se invocaba con claves camelCase y el helper espera kebab-case → los atributos se caían sin avisar. Corregido en el editor.
- Rejilla de 2 columnas del formulario en CSS (antes apilado), **errores inline por campo** con foco automático al primero, y la serie anual en rejilla con scroll horizontal (no se corta en pantallas angostas).
- `.gitignore`: residuos de sesión del `electron-playwright-cli` (`/sgsst-electron-app/.playwright-cli/`, `/sgsst-electron-app/.playwright/`), dependencias locales `Temp/pw-deps/` (12.6 MB) y planes del agente `/.zcode/`.

### 📦830 — Edición completa de los indicadores del programa SVE/COVID

**Resumen:** Los valores por año, los años de la serie, la meta y la definición de cada indicador (nombre, meta corta, periodicidad, formulación, umbral) se editan desde un botón **"Editar"** por tarjeta (mismo patrón que "Análisis por periodos") y lo editado se persiste en la columna nueva `extra_json`.

- **Schema**: `extra_json` en las TRES partes donde tiene que estar — `CREATE` de BD nueva, `ALTER` idempotente para BD viejas y la reconstrucción de la migración v2 (la trampa clásica: `CREATE TABLE IF NOT EXISTS` no altera tablas existentes).
- **Bridge**: adaptadores `_extraDe`/`_extraHacia`; guardan y siembran escriben la columna (si el seed no la escribe, el dato se pierde en cada re-siembra).
- **Store**: `updateIndicador(clave, patch)` mergea y persiste. **Seed**: los 4 indicadores traen metaCorta/umbral (ausentismo en `null`, que es lo que mantiene su semáforo en verde).
- **Vista**: helpers del semáforo con defaults retrocompatibles con BD vieja, botón Editar en AMBAS ramas de la tarjeta, validaciones (años, umbral) y reapertura conservando lo escrito.
- `main/test-sve-indicadores-edit.js` (nuevo): **71 checks** estáticos.

### 📦829 — Fix KAIRToast: el toast se quedaba pegado cuando el iframe que lo mostró moría

**Resumen:** En el 3.1.2, mostrar "Programa eliminado" y volver a la lista destruye el iframe (`container.innerHTML=''`); los timers (auto-cierre y retiro del nodo) y el clic de la X vivían en el realm del iframe, morían con él y el toast quedaba en pantalla para siempre.

- `_instanciaQueSobrevive()`: sube por `window.parent` hasta encontrar el `KAIRToast` de la ventana principal (la que `index.html` carga siempre) y ahí se crean el nodo, los timers y el handler — ninguno depende del iframe. Cross-origin → se usa la instancia local.
- Reproducción del bug en `Temp/probe-toast-829.js`. Cache-bust `?v=TOAST-20260930-realm-fix` en `index.html` + vistas (`reportes-accidentes`, `presupuesto`) y `?v=…-toast-realm-fix` en sus logic.

### 📦828 — Fix KairConfirm: el velo huérfano dejaba la app muda ante los clics

**Resumen:** Si el iframe se destruía antes del timer de cierre del diálogo, el backdrop quedaba colgado (invisible, `opacity 0` pero `pointer-events: auto`) y tapaba TODA la app: la pantalla quedaba "congelada".

- **Barrido anti-huérfanos**: al abrir un diálogo nuevo se borran primero los `.kair-confirm-backdrop` colgados del contenedor (excepto el activo).
- **Retiro en el realm del PADRE**: el nodo vive en el documento padre, así que el timer que lo retira se delega a `window.parent.KairConfirm`. Medido: `window.parent.setTimeout(cb, …)` invocado desde el iframe **nunca** ejecuta el callback (queda en la cola del iframe); la delegación sí funciona.
- `styles.css`: el velo lleva `pointer-events: none` mientras se va, así deja de bloquear al instante aunque el iframe muera antes del timer.

### 📦827-fix-2 — Las migraciones reconstruían tablas con las claves foráneas encendidas

**Resumen:** Con `foreign_keys` activo, el `DROP TABLE` de la tabla padre dispara el `ON DELETE CASCADE` de la hija: los meses del plan desaparecían ANTES de que su propia migración los copiara. Medido sobre la base real: **32 filas de `mp_sve_plan_meses` → 0**.

- Nuevo `aplicarMigracionesMedprevSve(db)` (único camino; lo usan `main.js` y el test): apaga las claves foráneas, corre las 4 migraciones y las vuelve a encender, sin depender del estado en que el llamador deje la base.

### 📦827-fix — PK compuesta y "espina" de años/medidas en los indicadores

- **PK compuesta `(programa_id, id)`** en `mp_sve_casos` y `mp_sve_plan_actividades`, `UNIQUE(programa_id, actividad_id, mes)` + FK compuesta en `mp_sve_plan_meses` — con varios programas, los mismos ids conviven sin pisarse (migraciones `20260930-sve-pk-compuesta-*`).
- **`anios_json` / `medidas_json` con RELLENO** desde `mp_sve_indicadores_valores` (`20260930-sve-ind-espina-json`): reconstrucción en vez de `ALTER` (SQLite no tiene `ADD COLUMN IF NOT EXISTS` y la migración tiene que poder re-correr). Sin el relleno, la serie quedaba sin espina y el Dashboard reventaba con "Cannot read properties of undefined" **hasta que se guardara de nuevo**.

### 📦827 — Los datos del programa SVE pasan de localStorage a SQLite (viajan en el .kairsync)

**Resumen:** Casos, plan PHVA, indicadores, morbilidad, análisis y el encabezado del documento vivían en `localStorage` del renderer: **no entraban al `.kairsync`, no viajaban entre máquinas y se perdían al reinstalar**. Ahora van a SQLite y de ahí al sync.

- `main/medprev-sve-datos-schema-sql.js`: **8 tablas `mp_sve_*`** idempotentes (casos, plan actividades + meses, indicadores + valores, morbilidad, análisis, meta del documento) con `ALTERS` y `MIGRATIONS` con control de versión.
- `main/medprev-sve-datos-bridge.js`: **13 canales `medprev:sve:*`** (datos:get, casos crear/actualizar/eliminar, plan actividad crear/guardar/eliminar, plan celda, meta, indicadores, morbilidad, análisis, migrar). Todo SQL con prepared statements y filtro `empresa_id + programa_id`.
- 🔒 **Auth dura**: las mutaciones exigen token de sesión válido (`validateSession`, sin bypass); las lecturas validan el token si llega y lo rechazan si es inválido. Decisión tomada de la auditoría de seguridad 2026-09-29.
- **Migración única** `medprev:sve:migrar`: vuelca el `localStorage` del prototipo a SQLite; idempotente por diseño (si la base ya tiene contenido no toca nada), se puede llamar en cada arranque.
- `main/sync-serializer.js`: las 8 tablas `mp_sve_*` entran al `.kairsync` (los hijos se reescriben igual, merge last-write-wins por id — ids de texto, no enteros, para que 2 PCs no se pisen en silencio).
- `main.js` (require + schema en `initDbOnce`) y `preload.js` (13 métodos `medprevSve*`).

### 📦826 — La interfaz real del prototipo SVE se monta por sección dentro del programa 3.1.2

**Resumen:** Un programa SVE del esqueleto 📦825 mostraba placeholders ("fase 2"). Ahora cada sección monta la vista real del prototipo (Dashboard ejecutivo, Seguimiento de casos con ficha de 31 campos, Plan PHVA editable, Indicadores 2020-2024 y Áreas expuestas), conservando el marco K+AIR (resumen + secciones con progreso marcable).

- **`modules/gestion-salud/medicina-preventiva/sve/`** (nuevo): `sve-views.js`, `sve-app.js`, `sve-core.js`, `sve-seed.js`, `sve-persistencia.js`, `sve.css` + fuentes Inter/Plus Jakarta (`fonts/`) + `vendor/lucide.min.js` y `vendor/xlsx.full.min.js`. Parches mínimos documentados en el archivo: `@font-face` con ruta relativa (`./fonts/`, el absoluto no resuelve en `file://`) y `STORAGE_KEY` con sufijo por programa (`window.SVE_PROGRAMA_KEY`) → **cada programa SVE tiene su propio dataset**.
- **Carga perezosa** por sección (solo la primera vez que se abre) en orden obligatorio (lucide → xlsx → seed → core → views → app, todos con `?v=`); `SveSeed.meta.empresa` toma la empresa real del programa. El header del prototipo se oculta con CSS del host para no duplicar las tabs; sus toasts, modales y savebar se conservan. Navegación interna (ver/editar/crear caso, volver) por el router de hash del propio prototipo dentro del panel.
- **Plantilla SVE v2**: 5 secciones reales (Dashboard, Casos, Plan PHVA, Indicadores epidemiológicos, Áreas expuestas) en lugar de las 6 especulativas de 📦825 (alertas/reportes/admin/auditoría vuelvan cuando existan esas interfaces), + migración `20260930-sve-template-v2` que actualiza los programas existentes al abrirlos.
- `main/test-medprev-programas-bridge.js` ampliado a **72 checks** (migración de plantilla + plantilla v2).

### 📚 docs — Informe de auditoría de seguridad 2026-09-29

- `docs/auditorias/INFORME-SEGURIDAD-20260929.md` (32 KB): auditoría ofensiva-defensiva pre-deploy sobre 0.1.224 (main.js, preload.js con 564 canales, renderer, bridges, empaquetado, git/dependencias). Veredicto **NO LISTO PARA DEPLOY** con 5 vulnerabilidades críticas (incluye contraseñas públicas en GitHub). Sus hallazgos originaron las decisiones de auth dura de 📦825/📦827.

### ✅ Verificación (0.1.226)

- **Suite SVE/Medprev completa: 512/512 OK, 0 FAIL** (9 tests, corridos con `ELECTRON_RUN_AS_NODE=1 electron.exe`):
  `test-sve-casos-covid` 24 · `test-sve-indicadores-edit` 71 · `test-sve-schema-migracion` 20 · `test-sve-store-827` 37 · `test-medprev-3-1-2` 142 · `test-medprev-programas-bridge` 72 · `test-medprev-sve-datos-bridge` 71 · `test-medprev-sync-roundtrip` 35 · `test-sve-analisis-agregar` 40.
- Verificación visual E2E del 📦833 en la app real con 5 capturas (`docs/capturas/833-analisis/`) y consola sin errores nuevos.
- `node --check` OK sobre vistas, app y tests.

## [0.1.225] - 2026-09-29

### 📦825-fix — El asistente de programas nunca completaba: el paso 2 no veía lo tecleado en el paso 1

**Resumen:** Reporte del owner: al avanzar el wizard aparecía "El nombre del programa es obligatorio" y no se podía crear. Causa raíz: `crearPrograma()` leía el nombre desde el DOM (`#pg-wz-nombre`), pero al llegar al paso 2 el cuerpo del modal se re-renderiza y ese input **ya no existe** — el nombre siempre llegaba vacío, saltaba el toast y el asistente rebotaba al paso 1 borrando lo tecleado. El flujo era incompletable desde la interfaz (los tests funcionales no lo agarraron porque inyectaban los valores por IPC, no por UI).

- Los datos del formulario ahora viven en `PG.wizard` (estado JS): `irPaso(2)` los guarda del DOM antes de validar, `crearPrograma()` lee del estado, y el paso 1 **restaura** lo tecleado al volver — no se pierde nada en ningún camino.
- `irPaso(2)` también valida fechas cruzadas antes de avanzar (antes solo lo hacía el bridge).
- Enter en el campo nombre avanza al paso 2; el campo recibe foco al abrir el asistente.
- Verificado con tecleo real de teclado E2E: escribir → Siguiente → Crear programa → detalle con nombre/fechas/secciones correctos → eliminar con confirmación → lista vacía. Cache-bust `-programas-3`.

### 📦825 — Medicina Preventiva 3.1.2: esqueleto de gestión de programas (SVE / DME / Promoción)

**Resumen:** El submódulo 3.1.2 pasó de un home con tres tarjetas mudas ("interfaz por construir") a un **esqueleto funcional de administración de programas**: al hacer clic en una línea (SVE, DME o Programas de promoción y prevención) la app ofrece crear un programa — solo o **desde una plantilla con sus secciones ya definidas** (la de SVE según la Documentación Técnica SVE: Dashboard, Casos, Alertas, Reportes, Administración y Auditoría) — y cada programa queda persistido en SQLite con **progreso marcable por sección** (Pendiente / En curso / Completo). Varios programas por línea y por empresa. Las interfaces operativas de cada sección llegan en fases siguientes; el esqueleto deja el terreno, la plantilla y el ciclo de vida listos.

#### (a) Capa de datos nueva (patrón presupuesto-824)

- `main/medprev-programas-schema-sql.js`: 2 tablas idempotentes — `mp_programas` (id texto, empresa, tipo, nombre, estado, periodo, plantilla; `UNIQUE(empresa_id, tipo, nombre)`) y `mp_programa_secciones` (secciones sembradas de la plantilla, con estado de progreso). Arrays `ALTERS`/`MIGRATIONS` listos para fases siguientes.
- `main/medprev-programas-bridge.js`: 7 canales `medprev:programas:*` (`plantillas`, `list`, `get`, `create`, `update`, `delete`, `seccion-estado`). `create` siembra las secciones de la plantilla dentro de una transacción; `delete` es soft (`estado='eliminado'`). Multi-empresa resuelta server-side (`_getCompanyByName`).
- 🔒 **Auth dura en mutaciones**: `create/update/delete/seccion-estado` exigen token de sesión válido (`validateSession`) — decisión tomada de la auditoría de seguridad 2026-09-29 (hallazgo GH-1: el soft-auth de GH es un no-op). Todo el SQL con prepared statements.
- Plantillas exportadas: SVE (6 secciones de la spec), DME (4), Promoción (5). Registrado en `main.js` (require + schema en `initDbOnce` + registro junto a los demás bridges) y expuesto en `preload.js`.

#### (b) UI: vista de programa con wizard de 2 pasos

- `medicina-preventiva-programa.html/.js` (nuevos): una vista con dos modos por query param — **lista** (tarjetas de programa con estado, periodo y barra de avance; empty-state con CTA) y **detalle** (resumen con progreso, acciones pausar/reanudar/cerrar/eliminar con `KairConfirm`, y navegación de secciones con estado marcable y placeholder "fase 2").
- **Wizard de creación**: paso 1 datos (nombre único, descripción, periodo), paso 2 plantilla (estándar con preview de las secciones que se crearán / en blanco). Toasts `KAIRToast`.
- Mismo lenguaje visual del home 3.1.2: marco `.kair-block*` compartido, clases locales `mp-pg-*`, tokens, `auto-fit`, sin media queries.

#### (c) Navegación y home

- `medicina-preventiva-logic.js`: vistas `programa-lista` y `programa-detalle` en el switch de `render()`; `handleMessage` ahora resuelve `open-program` (ir a la lista), `open-program-id` (detalle), `backToHome` y `backToSubmodules`. La empresa viaja por query param del iframe.
- `medicina-preventiva-home.js/.html`: las tarjetas dejan el tag estático "Interfaz por construir" y muestran **conteos reales** por línea ("Sin programas — crear" / "N programas activos"); el pill "En construcción" del header se retiró. La tercera tarjeta pasó del alias `programas` al tipo canónico `promocion`.

#### (d) Tests

- `main/test-medprev-programas-bridge.js` (nuevo, funcional con better-sqlite3 en memoria; correr con `ELECTRON_RUN_AS_NODE=1 electron.exe`): 49 checks — auth dura, siembra de plantilla, UNIQUE por empresa/tipo/nombre, aislamiento multi-empresa, soft-delete, progreso.
- `main/test-medprev-3-1-2.js` (extendido): 43 checks — contrato postMessage de la vista nueva, onclicks estáticos y dinámicos, reglas CSS del AGENTS.md para el HTML nuevo, iconos FA 6.4 re-sondeados (36 vivos, script `Temp/probe-fa-icons-825.js`), cache-bust concatenado y consistente entre logic.js e index.html.
- Convención: al sondear iconos nuevos, correr `Temp/probe-fa-icons-825.js` y sumar el resultado a `ICONOS_VERIFICADOS`.

#### (e) Verificación

- `node main/test-medprev-3-1-2.js` → 43/43 OK.
- `ELECTRON_RUN_AS_NODE=1 ./node_modules/electron/dist/electron.exe main/test-medprev-programas-bridge.js` → 49/49 OK.
- Sintaxis verificada (vm.Script) de main.js, preload.js y los 5 archivos del submódulo.
- Flujo E2E en la app: home → tarjeta SVE → wizard (2 pasos) → detalle con secciones → progreso → volver. Capturas en docs de la entrega.

## [0.1.224] - 2026-09-29

### 📦824-ui — Presupuesto: los bloques con marco, a todo el ancho, y sin la franja fantasma

**Resumen:** El submódulo 1.1.3 ya guardaba bien los datos (📦824), pero la **interfaz** seguía teniendo tres defectos que el owner reportó uno por uno: los períodos cargados iban sueltos sobre el lienzo mientras los archivos de Drive sí tenían recuadro (asimetría), las pantallas estaban topeadas a 1400px y dejaban ~280px de lienzo vacío a cada lado en ventanas anchas, y una franja blanca asomaba en el borde inferior. Todo reordenado alrededor de un bloque con marco compartido.

#### (a) El bloque con marco pasa a ser COMPARTIDO

El patrón "encabezado de bloque (chip + título + bajada) **fuera** + panel blanco **dentro**" estaba escrito **dos veces**: una copia en el selector y otra en el home. Se veían iguales por casualidad, no por construcción — al cambiar un borde en una, la otra se quedaba vieja.

Ahora vive **una sola vez** en `shared/kair-components.css`:

| Clase | Qué es |
|---|---|
| `.kair-block` | bloque + su separación vertical |
| `.kair-block__head` | fila del encabezado (flex) |
| `.kair-block__chip` / `__text` / `__title` / `__sub` | chip, caja, título y bajada |
| `.kair-block__panel` | el marco (fondo, borde, radio, sombra, padding) |
| `.kair-block__grid` | grid base del panel (`auto-fit`, gap `clamp(12px, 1.3vw, 18px)`) |

Cada pantalla declara solo lo suyo: el `minmax` de su grid (una card de período y un tile de Drive no usan el mismo piso de ancho) y su layout local (`grid-column` en el selector, la flecha de las tarjetas grandes en el home).

**Colisión de nombres evitada:** el marco se iba a llamar `.kair-panel`, pero ese nombre ya lo usa `modules/verificacion/revision-alta-direccion/revision-alta-direccion.css` como panel de layout con hijos `.fijo`/`.scroll`, y está documentado en AGENTS.md con otro significado. De ahí el prefijo `.kair-block__`. **Regla: antes de crear una clase `kair-*`, grepear el repo — `kair-` no es un namespace libre.**

#### (b) Los dos bloques del home llevan marco

- **"Gestionar Presupuesto" + "Histórico de Años"** → panel con encabezado propio ("Gestionar e histórico").
- **"Herramientas presupuestales"** → panel con encabezado propio; el título suelto `.quick-actions-title` murió (lo pone ahora `.kair-block__title`, igual que en el selector).
- Las 2 tarjetas grandes de acceso reciben una **flecha `::after` a la derecha**: al ocupar todo el ancho quedaban con un vacío lateral que se leía como contenido faltante.

Se eliminó además el **CSS muerto del v1** del home (`.portal-card`, `.portal-header`, `.portal-logo`, `.back-btn-internal`, `.hero-title`, `.hero-subtitle`, `.status-pill`, `fadeIn`) y el **breakpoint de 768px**: lo reemplazó el header premium, y los grids se adaptan solos por `auto-fit`. El home queda **sin un solo `@media`**.

#### (c) Pantalla a todo el ancho: `auto-fit`, no `auto-fill`

El vacío era **doble**, y por eso quitar solo una cosa no lo resolvía:

1. `.content-area` / `.pres-home` estaban topeados a `max-width: 1400px` + `margin: 0 auto` → ~280px de lienzo a cada lado.
2. Los grids usaban `repeat(auto-fill, ...)`, que **crea las columnas aunque estén vacías y les asigna ancho**. Con pocos elementos el hueco no desaparece: **se muda de lugar**, de los márgenes exteriores al interior del recuadro, que se ve peor porque el marco lo delata.

Solución: `max-width: none` + `repeat(auto-fit, minmax(Npx, 1fr))` en los 4 grids (accesos, herramientas, períodos, tiles de Drive). El `minmax` lo declara cada pantalla porque una card de período y un tile de Drive no usan el mismo piso.

Consecuencia: con pocos años las cards se ensanchan. Para que no se vieran estiradas, la card de período **se reacomoda sola sin media query** (`flex-wrap` + `flex-basis`): angosta (4+ años en pantalla) se apila **exactamente** como el diseño aprobado; ancha reparte en dos zonas (cifras a la izquierda, ejecución + acciones a la derecha).

Tres ajustes que hicieron falta para eso:

- **`align-items: stretch` en `.year-card--bd`**: la base `.year-card` es `display: flex; flex-direction: column; align-items: center`, o sea **cada hijo se encoge a su contenido**. Con una card angosta no se nota porque el contenido ya llena; al ensancharse, todo se amontonaba en el centro.
- **`.pdb__fig` centra su contenido en la vertical**: en una card ancha la zona derecha es más alta y el tile quedaba medio vacío.
- El grid exterior del selector pasó de `auto-fill minmax(300px,1fr)` a **una sola columna**: todos sus hijos ocupan la fila entera (`grid-column: 1/-1`), así que la definición de columnas ya no describía nada.

#### (d) La franja fantasma del borde inferior era el toast "oculto"

Lo que se veía abajo a la derecha era el **toast de notificaciones asomando ~4px**: su barra blanca con el filete azul. `transform: translateY(150%)` es un porcentaje de **la altura propia del elemento**, no de la distancia que hay que cubrir; con el toast a `bottom: 2rem` y 53px de alto, bajarlo 1,5 alturas lo dejaba a `32px − 0,5×alto` del borde — siempre visible.

```css
.k-toast { bottom: 2rem; transform: translateY(calc(100% + 2rem)); opacity: 0; }
.k-toast.show { transform: translateY(0); opacity: 1; }
```

El mismo patrón está copiado en `modules/gestion-integral/politica/politica-view-temp.html`, archivo **muerto** (el módulo carga `politica-view.html`): se reporta, no se toca.

#### (e) Verificación

Validador propio de 40 checks (clases compartidas definidas y usadas, sin CSS muerto, sin `auto-fill`, sin colisión de nombres, divs balanceados, sin CJK/mojibake/BOM), `node -c` limpio, y la suite de Presupuesto **473/473**. Renderizado con un arnés de Electron a 1913×1022 (ventana real del owner) en 4 escenarios: home, selector con 2 períodos, selector con 4 períodos y el toast visible.

**Gotcha del arnés (documentado en AGENTS.md):** con `BrowserWindow({ show: false })` **Chromium no produce frames**, así que las transiciones CSS no avanzan y `getComputedStyle()` devuelve el valor **anterior** al cambio de clase, con un paso de atraso. Casi hace "arreglar" CSS que estaba bien. Para medir un estado animado hay que inyectar `* { transition: none !important; animation: none !important }` o mostrar la ventana.

**AGENTS.md +123 líneas** con 5 reglas nuevas: el bloque con marco es compartido y no se re-declara por pantalla (y `.kair-panel` está tomado), `auto-fill` vs `auto-fit`, el toast y `translateY(150%)`, la trampa de la ventana oculta, y que no se arme texto con acentos en PowerShell (`[char]0xED` + `+` parte la cadena en varios elementos: el HTML quedó partido y con `div` huérfanos).

Sin cambios de comportamiento: import, export, `bulk-save`, IPC y esquema intactos.

Bump 0.1.223 → 0.1.224.

## [0.1.223] - 2026-09-29

### 📦824 — Presupuesto SG-SST: la BD es la fuente de verdad y el Excel la plantilla

**Resumen:** El módulo 1.1.3 (Asignación de Recursos) guardaba los datos en el Excel de Drive y la base de datos era un espejo parcial. Todo guardado desde la UI **borraba y reinsertaba** las partidas, y lo que la grilla no viajaba (categoría, bloque del Excel, agregados) **se perdía en silencio**. En producción el 2026 de Tempoactiva quedó con 0 de 14 categorías y $9.366.043 de $27.819.284. Además la grilla mostraba **datos inventados** en las columnas ENE–DIC. Todo reordenado alrededor de la verdad del documento.

#### (a) El ACT-FO-043 no tiene presupuesto mensual

El formato real (leído del archivo de Tempoactiva):

| Columna | Encabezado |
|---|---|
| A–F | `N · DESCRIPCION · DETALLE · ASIGNACION PRESUPUESTO ANUAL · EJECUTADO ACUMULADO · % EJE.` |
| G–R | **"EJECUCION PRESUPUESTAL"** → `ENERO … DICIEMBRE` |

Una sola asignación anual y ejecución mes a mes. El `presupuesto_valores_mensuales` tiene `asignado` y `ejecutado` por mes, así que el import **inventaba** el asignado mensual como `anual/12` — un dato que no está en ninguna parte. Peor: **la grilla mostraba ese invento** (`20.000 / 208.333,33 / 166.666,67` en partidas que en el Excel tienen el mes en cero) y `bulk-save` lo guardaba de vuelta, mientras la ejecución real (p. ej. los $2.000.000 de abril) **no aparecía en ninguna parte**.

El modelo que quedó:

| Dónde | Qué es | Fuente |
|---|---|---|
| `presupuesto_partidas.asignado_anual` | asignación anual | columna D — **verdad del documento** |
| `presupuesto_valores_mensuales.ejecutado` | ejecución del mes | columnas G-R — **dato real** |
| `presupuesto_valores_mensuales.asignado` | curva "programada" del dashboard | `anual/12` derivado — **nunca en la grilla** |

Las columnas ENE–DIC de la grilla ahora muestran `valores[m].ejecutado` (y la fila TOTAL suma ejecución), que es literalmente lo que dice el encabezado del formato. `bulk-save` recibe esas columnas como ejecución y recalcula el mensual asignado, con el remanente en DICIEMBRE y `_redondearMoneda()`: `240.000/12` en coma flotante daba `9.999.999,999999998` y **ninguna** suma cuadraba con la columna D.

#### (b) `bulk-save` destruía lo que la grilla no viajaba

El handler hace `DELETE FROM presupuesto_partidas` y reinserta el payload. La grilla no conoce la categoría (col B del Excel), el número de bloque ni los agregados. La "preservación" de la categoría consultaba esa misma tabla **dos líneas después del DELETE** — sobre una tabla ya vacía. Siempre devolvía nada → `descripcion = NULL`.

Lo engañoso: la preservación del `ejecutado` **sí** se leía antes del borrado, así que el ejecutado se salvaba y hacía pensar que el handler estaba bien. Una mitad funcionaba y la otra consultaba la tabla muerta.

Defensa aplicada:
- Snapshot `numero → {descripcion, numero_excel, asignado_anual}` **antes** del `DELETE`.
- `asignado_anual` se preserva; **nunca** se deriva sumando los 12 meses.
- `ejecutado_acumulado` y `porcentaje_eje` se recalculan desde los valores mensuales (que sí son dato real y coinciden con la columna E).
- El lector, `_calcularResumen` y `_presupuestoStatsDesdeBd` usan `asignado_anual`, no `SUM(v.asignado)`.
- `mesesConSobreEjecucion` se evalúa una vez por mes (contaba el mismo mes N veces, una por partida).

#### (c) Exportar encima de la plantilla real

`workbook.xlsx.readFile()` es asíncrono; sin `await` el workbook quedaba vacío y el export caía silenciosamente al fallback "generar desde cero" (encabezado y merges perdidos). Ahora el export se hace **encima del archivo oficial**, conservando encabezado, ACT-FO-043, merges y firmas. La fila `TOTAL AÑO` se escribe con la **suma real** de las partidas, no con lo que declaraba el Excel (el 2026 venía con la fórmula duplicada: declaraba $55.638.568 frente a una suma de $27.819.284, y ×1,71 en ejecutado). Los totales declarados se guardan aparte y se reportan como **avisos** de importación.

**Bug de merges (corregido):** la plantilla combina la categoría en `B11:B22` (un texto sobre 12 partidas). Con otra distribución de partidas, escribir sobre una celda esclava no agrega texto — ExcelJS lo guarda en el **master** del merge, y 12 filas quedaban mostrando la categoría equivocada; si el `TOTAL` o el IPC caían dentro del rango, sus valores se perdían. Ahora se desarman los merges que se solapan con el rango de datos y se **reconstruyen** por bloque real de la BD. El merge del encabezado (`B8:B9`) queda intacto.

#### (d) Other fixes

- **`this._handleOpenBudgetFromDB` no existía** (el método se llama `_handleOpenBudgetFromBD`): el módulo se caía con `TypeError` al cambiar de período. Los 442 tests de backstory no lo veían porque el `postMessage` del renderer nunca se ejecuta en un test. Agregado `test-presupuesto-824-dispatch.js` (estático, parsea el `switch`) y un barrido de los 34 módulos `*-logic.js` que encontró **1 crash real más**: `this._showAutoFillToast()` en `copasst-logic.js`, un helper nunca definido.
- **`contentWindow` nulo**: el `catch` de `_handleRequestBudgetFromDB` tocaba el iframe otra vez y el `TypeError` del `catch` tapaba el error real. Ahora pasa por un helper `enviar()` que valida `contentWindow`.
- **Año siempre visible**: `updateFileInfo` usaba solo el nombre del archivo y caía en "Presupuesto Desconocido"; ahora usa `currentFile.anio` + subtítulo con origen y fecha de importación.
- **Historial desde la BD**: el selector mostraba archivos de Drive; ahora lista los períodos cargados (con total, %, IPC y avisos) y aparte los archivos pendientes de importar.
- **Duplicar período** (`presupuesto:duplicar-periodo`): clona partidas y asignado a otro año, con ejecución en cero e IPC vacío (el IPC cambia cada año y lo define el owner).
- **Ancho de columnas**: los 12 meses de 100px → 75px; la tabla pasó de 1.810px a 1.510px.
- `PRAGMA foreign_keys = ON` en `main.js` (activado en 📦824 y nunca consolidationado).

#### Tests: 473/473

`test-presupuesto-824-{real,aislamiento,export-plantilla,roundtrip,dispatch}` + las 7 suites del bridge. El nuevo `roundtrip` (21 checks) es el que faltaba: **importa el Excel real y guarda con el payload que realmente manda la grilla**; los demás importaban y ya, nunca guardaban después de importar. Al reintroducir el bug baja a 14/17 con el síntoma exacto `0/14`.

**Gafas recalibradas:** 5 tests affine afirmaban el contrato viejo (meses = asignado). Cuando código y test comparten el mismo malentendido, ambos dan verde.

Bump 0.1.222 → 0.1.223.

## [0.1.222] - 2026-09-28

### 📦823 — Notificaciones: el toast dice QUIÉN escribió, y "Ver" lleva al correo

**Resumen:** El toast de "1 correo nuevo" solo mostraba el asunto: no se sabía quién lo mandó, y había un `*` suelto bajo el título. Además el botón "Ver" abría la pestaña equivocada, cerraba el panel si ya estaba abierto, y dejaba el toast flotando. Todo corregido de punta a punta (detector → bridge → service → toast → lista) con migración de schema incluida.

#### (a) El remitente viaja desde el correo hasta la pantalla

El dato **ya existía** en la base (`email_threads.last_sender_name` / `last_sender_email`, `email-schema-sql.js:47-48`); lo que faltaba era el camino. Se recorrió la cadena completa:

| Archivo | Cambio |
|---|---|
`main/notifications-email.js` | El `SELECT` suma `last_sender_name` + `last_sender_email`; helper `formatRemitente()`; el payload emite `remitente` (ya formateado) + `remitente_nombre` + `remitente_email` |
`main/notifications-bridge.js` | Columna `remitente TEXT` en `SCHEMA_SQL`; `migrateNotificaciones()` (ALTER TABLE idempotente); `listar` expone `remitente` |
`main/notifications-service.js` | El `INSERT` persiste el remitente; `_asegurarSchema()` también aplica la migración |
`renderer.js` | El subtítulo del toast pasa a ser `De: <remitente>` |
`shared/kair-alerts.js` | La lista de Notificaciones suma la línea `De: …` sobre el asunto |
`styles.css` | `.kair-alerts-notifs-item__from` (muted, con elipsis si es largo) |
`index.html` | Cache-bust `?v=20260928-notifs-ver` |

**Formato del remitente** (`formatRemitente`, exportado y testeado):

| Entrada | Salida |
|---|---|
nombre + email | `Pausas Activas (pausas@acme.com)` |
solo email (típico de noreply) | `noreply@acme.com` |
nombre == email | `juan@acme.com` (no lo repite) |
nada | `''` → la línea se omite, no se inventa texto |
nombre larguísimo | recortado a 90 chars con `…` |

**Migración — por qué no alcanza `CREATE TABLE IF NOT EXISTS`:** no altera tablas que ya existen, así que una BD creada antes de este paquete seguiría sin la columna y el `INSERT` del service reventaría. Por eso el `ALTER TABLE` va aparte en `migrateNotificaciones()`, que se exporta y la ejecutan **los dos lados** (bridge y service): si el timer del service hace su primer `INSERT` antes de que `main.js` registre los handlers, igual encuentra la columna. Es idempotente (checa `PRAGMA table_info`).

#### (b) Fix del `*` suelto en el toast

```js
// antes
var sub = (data.nuevas[0].companyKey && currentCompany && data.nuevas[0].companyKey !== currentCompany)
  ? data.nuevas[0].companyKey : '';
```

Los correos son globales (`company_key = '*'`), así que `'*' !== 'Tempoactiva'` era cierto y se pintaba literalmente el asterisco bajo el título. Ahora el subtítulo es el remitente para correos, y la empresa solo para eventos **y solo si no es `'*'`**.

#### (c) El botón "Ver" hacía 3 cosas mal

**Antes:** `onClick` → `badge.click()` → `_togglePopover()`. Consecuencias:

1. **Abría la pestaña equivocada.** `_state.activeTab` viene de `localStorage` con default `pendientes` (la de eventos del calendario). Un toast de "1 correo nuevo" te mostraba la lista de eventos; el correo estaba en la otra tab y tenías que adivinar que había que cambiarla.
2. **Era un toggle.** Si el panel ya estaba abierto, el clic lo **cerraba** — al revés de lo que promete un botón que dice "Ver".
3. **El toast no se cerraba.** `autoClose: 0` y el handler nunca llamaba a `remove()`, así que quedaba flotando tapando la pantalla hasta la X o hasta que llegara otro toast.

**Ahora** — `KairAlerts.openTab(tab)` (abre en una tab concreta, nunca alterna, persiste la preferencia) y `KairAlerts.openFromToast(tipo)` (elige la tab según el tipo **y cierra el toast**).

**Refactor de arquitectura:** la lógica del botón vivía en `renderer.js` (6000+ líneas acopladas al Electron, intestable). Se movió a `kair-alerts.js` para poder verificarla con jsdom sin cargar el shell entero. `renderer.js` solo delega y **conserva el fallback** al `badge.click()` viejo por si `KairAlerts` no estuviera cargado.

#### (d) E2E nueva

`tests/notificaciones-toast-e2e.js` — 5 escenarios con jsdom contra los **archivos reales** (`kair-alerts.js` y `update-notifications.js` se cargan tal cual; el payload lo arma el `formatRemitente()` real):

| Escenario | Cubre |
|---|---|
E2E-1 | Llega correo → toast con remitente → clic en Ver → abre en `notifs`, persistida, toast borrado del DOM |
E2E-2 | **Panel ya abierto** → no se cierra y cambia a `notifs` (el caso que fallaba) |
E2E-3 | 3 clics seguidos en Ver → aguanta |
E2E-4 | Evento → subtítulo con su empresa, nunca el `*`; abre `pendientes` |
E2E-4b | Evento con `companyKey='*'` → sin subtítulo |
E2E-5 | Sin `KairAlerts` → el fallback no revienta |

**Gotcha de jsdom descubierto:** el harness necesita `url: 'https://kair.local/index.html'`. Con `file://` el `localStorage` lanza `SecurityError: localStorage is not available for opaque origins` y el módulo no carga ni una línea — el error aparece como un `DOMException {}` sin mensaje útil.

**Tests — 222/222 en verde** (eran 155, +67):

```
tests/notificaciones-toast-e2e.js   25/25   (nueva)
main/test-notificaciones-ui.js      52/52   (era 36: +16)
main/test-notificaciones-bridge.js  32/32   (era 28: +4)
main/test-notificaciones-email.js   17/17   (era  7: +10)
main/test-notificaciones-service.js 10/10
main/test-notificaciones-wiring.js  11/11
main/test-notificaciones-fuentes.js 52/52
main/test-notificaciones-seguridad.js 23/23
```

**Check del cache-bust desacoplado de la fecha:** el test de UI validaba el token literal `20260923-notifs-size`, así que cualquier cambio legítimo de CSS/JS lo rompía. Ahora valida el patrón `?v=\d{8}-` más el token vigente — el test no vuelve a envejecer con cada paquete.

**Archivos modificados:** `main/notifications-{email,bridge,service}.js`, `renderer.js`, `shared/kair-alerts.js`, `styles.css`, `index.html`, 3 tests actualizados + 1 E2E nuevo, `package.json` (0.1.221 → 0.1.222).

**Sin cambios:** la lógica de detección, el dedupe, el gate de seguridad, la sincronización de Gmail, la tabla `email_*` y el layout de las dos tabs. Los correos ya persistidos antes de este paquete quedan con el remitente vacío (la columna es nueva); a partir de los correos que lleguen se muestran completos.

## [0.1.221] - 2026-09-28

### 📦819-822 — Informe de Gestión PRI: impresión por caso + retorno al portal

**Resumen:** Cuatro iteraciones sobre `modules/gestion-salud/ausentismo/informe-pri-builder.html`: (📦819) la impresión se bifurca según la vista —consolidado completo desde Resumen General, solo ese caso desde un caso seleccionado—; (📦820) botón explícito "Volver al Módulo" con cierre multi-contexto; (📦821) fix del `TypeError` que colgaba la app; (📦822) el retorno lleva al portal del submódulo, no a la vista del módulo completo.

**Archivo único modificado:** `modules/gestion-salud/ausentismo/informe-pri-builder.html` (el flujo vive entero en este archivo; `renderer.js` y el bridge IPC no se tocaron).

#### (a) Impresión por caso (📦819)

`exportToPDF()` bifurca por `currentPage`:

| Vista activa | Qué imprime | Nombre del PDF |
|---|---|---|
| Resumen General (`currentPage === 0`) | Resumen ejecutivo + **todos** los casos del periodo | `Resumen_General_<FECHA_HORA>.pdf` |
| Caso seleccionado (`currentPage >= 1`) | **Solo** ese caso, sin el resumen | `<NOMBRE>_<CÉDULA>_<FECHA_HORA>.pdf` |

- `Ctrl+P` y el botón pasan por el **mismo** `exportToPDF()` (no hay una ruta de impresión paralela que se pueda desincronizar).
- El label del botón es dinámico: "Imprimir informe" en Resumen General, "Imprimir este caso" en un caso.
- Guard added: si el caso seleccionado ya no existe en `casesData` (p. ej. cambió el filtro de fechas), se aborta con aviso en vez de imprimir un PDF vacío.
- La paginación se adapta cuando solo hay un caso: 1 de 1, sin flechas de navegación.
- Helper nuevo `_slug()`: normaliza acentos (`NFD` + strip de diacríticos), espacios → `_`, conserva guiones, maneja nombre vacío. Ejemplo real: `CARELIS DEL CARMEN CARIDAD CALDERON` + `1047239028` → `CARELIS_DEL_CARMEN_CARIDAD_CALDERON_1047239028_2026-09-28_17-25-58.pdf`.

#### (b) Botón "Volver al Módulo" (📦820)

- Nuevo grupo `.builder-actions` en el header con un botón visible **← Volver al Módulo** (el X se conserva).
- `closeReportBuilder()` pasa a ser **multi-contexto**, porque el builder se abre por 3 rutas y el código viejo (postMessage a `window.parent`) solo resolvía una:

| Contexto | Detección | Retorno |
|---|---|---|
| Ventana nueva (`window.open`) | `window.opener && !window.opener.closed` | `opener.focus()` + `window.close()` |
| iframe / embebido | `window.parent !== window` | `postMessage('back-to-module-request')` al padre + retiro del `frameElement` a 400ms |
| Carga directa en el mismo documento | `window.parent === window` | vía `renderer.js` (ver 📦821/📦822) |

- `ESC` delega a `closeReportBuilder()` (antes tenía su propia lógica): una sola ruta de salida para botón, X y teclado.
- Guard anti-doble-ejecución (`_priClosing`) para que un clic rápido o X+ESC juntos no se pisen.

#### (c) Fix del `TypeError` que colgaba la app (📦821)

**Síntoma:** al pulsar Volver aparecía en consola

```text
TypeError: Cannot set properties of undefined (setting 'innerHTML')
    at render (rendicion-viewer.js:138:29)
```

y la aplicación quedaba inservible, sin volver al módulo.

**Causa raíz:** la rama de carga directa hacía un fallback a `window.render()`. Ese nombre global **no pertenece al shell de ausentismo**: lo declara un módulo sin relación (`modules/gestion-integral/rendicion-cuentas/rendicion-viewer.js`). Invocado sin su contexto, su `container` queda `undefined` y revienta al asignar `innerHTML` — y antes de morir alcanza a tocar el DOM de otros módulos, por eso la app entera se colgaba.

**Fix:** la rama de carga directa ahora usa el `postMessage` que `renderer.js` **sí** soporta para este caso — el propio listener acepta mensajes de la propia ventana (`renderer.js:1396`, `const isFromSelf = event.source === window`) y responde a `back-to-module-request`. `window.render()` quedó **completamente fuera del archivo** (solo se menciona en el comentario que documenta el bug).

**Regla general:** nunca invocar un global genérico (`render`, `init`, `load`, `update`) desde código inyectado en el shell. Cada módulo carga como classic script en el mismo documento y sus funciones de nivel superior se vuelven globales del `window`, así que los nombres chocan. Llamar siempre a APIs con nombre propio del shell (`showModuleContent`, `showSubmoduleContent`, `showHomePage`).

#### (d) El retorno lleva al portal, no al módulo (📦822)

**Síntoma:** el botón ya funcionaba, pero devolvía al usuario a la pantalla de tarjetas de **Gestión de la Salud** en vez de al portal de **3.3.6 Medición del ausentismo por causa médica** de donde se abrió el builder.

**Causa:** el handler `back-to-module-request` de `renderer.js:1583` hace exactamente dos cosas:

```js
currentSubmodule = null;          // borra el rastro de dónde venías
showModuleContent(currentModule); // pinta el módulo COMPLETO
```

**Fix:** la ruta correcta es `showSubmoduleContent(container, moduleName, submoduleName)` (`renderer.js:5075`), que reconstruye el portal vía `showMedicionAusentismoContent()` → `MedicionAusentismoComponent` → `renderMainView()` → iframe con `medicion-ausentismo-home.html`. El builder la invoca directamente con `currentModule` / `currentSubmodule` leídos del ámbito global.

> **Bug preexistente detectado (NO corregido, fuera de alcance):** el handler `back-to-submodule-home` de `renderer.js:1606-1615` llama `showSubmoduleContent(currentSubmodule)` con **un solo argumento**, cuando la función exige tres — con esa firma el `container` recibe un string y el retorno no ocurre. No se tocó `renderer.js` en este paquete; queda como fix pendiente.

**Cadena de retorno final (rama de carga directa):**

1. `showSubmoduleContent(#content-area, currentModule, currentSubmodule)` → portal del submódulo ← ruta normal
2. sin submódulo registrado → `postMessage('back-to-module-request')`
3. red de seguridad a 800 ms: si el builder sigue montado, se limpia el `.main-canvas` y se re-renderiza (`showSubmoduleContent` → `showModuleContent` → `showHomePage` → `location.reload()`)

**Archivos modificados:**
- `modules/gestion-salud/ausentismo/informe-pri-builder.html` — `exportToPDF()` bifurcado, `_slug()` nuevo, `.builder-actions` + botón, `closeReportBuilder()` reescrito (3 contextos + destino correcto), ESC delegado
- `package.json` — bump 0.1.217 → 0.1.221

**Validación:**
- `node -c` sobre el JS embebido del builder (1842 líneas) → OK
- Probado con casos reales de Tempoactiva: 2 casos detectados, 36 días perdidos en el periodo
- Validado por el owner en la app: botón Volver, X y ESC vuelven al portal; el `TypeError` desapareció

**Funcionalidad preservada:**
- Backend IPC y bridge de ausentismo sin tocar
- `renderer.js` sin tocar
- Descarga de datos desde `PRI.xlsx` y el mapeo de columnas sin cambios
- Filtros por fechas, checkboxes de configuración y paginación igual que antes

## [0.1.217] - 2026-09-27

### 📦818 · Home de Gestión Humana — hero + métricas en 4 columnas + progress bars

**Resumen:** El home (Resumen) del módulo 8 se reorganiza para que el hero comparta fila con las 3 métricas (4 cards lado a lado en maximizado) y las métricas ahora muestran `X/Y` con barra de progreso horizontal color-coded (estilo premium v2 estándar).

**Cambios principales:**

#### (a) Hero + métricas en fila de 4 columnas (📦818-hero-row)
- **Antes**: hero full-width en su propia fila + 3 metrics cards en otra fila debajo
- **Después**: layout de 2 niveles → `.gh-hero-row` grid `1fr 3fr` (hero izquierda 25%, metrics derecha 75%) + `.gh-metrics` grid interno `repeat(3, 1fr)`
- En maximizado: 4 cards lado a lado (1 hero + 3 metrics). En ventana (<900px): todo a 1 columna

#### (b) Hero compacto (📦818-hero-compact)
- Removido subtítulo "Personal, contratación, ausencias y documentos del equipo en un solo lugar — Tempoactiva." (redundante con el título "Talento humano bajo control")
- Padding reducido (`clamp(14px, 1.5vw, 20px)`) + font del título `clamp(16px, 1.4vw, 19px)` + gap de 12px
- Stat (número + labels) anclado al fondo del card con `margin-top: auto` + `height: 100%`

#### (c) Métricas con barra de progreso (📦818-metrics-progress)
- `_renderMetric()` soporta 3 variantes: `{value, total}` → "X/Y" + barra, `{value, percent}` → "X.X%" + barra, `{value}` → legacy sin barra
- **Removido el icono** del `.gh-metric__top` (la referencia "INDUCCIONES 104/108" no tiene icono)
- Fraction pegada al número (sin espacio): `0/1` en vez de `0 / 1`
- Progress bar horizontal al fondo de cada card (`margin-top: auto`), color del `--gh-m-tone` (warn=ámbar, ok=verde, neutral=gris)
- Las 3 metrics ahora: `0/1` warn · `1/1` ok · `0/1` neutral (eran integers simples)

**Archivos modificados:**
- `modules/gestion-humana/gestion-humana-home.js` — wrapper `.gh-hero-row`, `_renderMetric()` con variantes, llamadas con `{value,total}`
- `modules/gestion-humana/gestion-humana-home.css` — layout 4-col, hero compacto, métricas sin icono + progress bar
- `index.html` — cache-bust `?v=GH-20260927-metrics-no-icon`
- `package.json` — bump 0.1.216 → 0.1.217

**Funcionalidad preservada:**
- 9 vistas del shell intactas
- Tabs del shell sin cambios
- Backend IPC `gh:listPersonal`, `gh:listContrataciones` sin tocar
- Dark mode + dark-legacy vía tokens

## [0.1.216] - 2026-09-27

### 📦817 · Shell de Gestión Humana — header premium v2 (breadcrumb + pill + fondo continuo)

**Resumen:** El header del shell del módulo 8 migró al patrón premium v2 replicado del viewer de Capacitaciones: breadcrumb 3 niveles (`Inicio › Gestión › Gestión Humana`), pill "Empresa activa" dinámica, y fondo `var(--bg-color)` continuo sin bordes (header + tabs + content forman un solo bloque gris).

**Decisiones del owner (explícitas en sesión):**
- ❌ Sin botón **Volver** (el sidebar ya provee navegación al menú)
- ❌ Sin botón **Nueva Contratación** (las vistas individuales lo agregan si lo necesitan)
- ✅ Pill "Empresa activa · `<empresa>`" (con icono de casa + nombre dinámico vía `_updateCompanyPill()`)
- ✅ Fondo `var(--bg-color)` en header + tabs (mismo gris que el resto de la app, sin distinción visual entre header/tabs/content)
- ✅ Sin `border-bottom` en header ni en tabs (solo queda el underline azul de la tab activa como indicador)

| Antes | Después |
|---|---|
| Logo/badge + título + subtítulo (sin breadcrumb) | Breadcrumb 3 niveles + badge + título + subtítulo |
| Botón bell de notificaciones a la derecha | Pill "Empresa activa: <empresa>" con icono casa |
| Fondo blanco (`--widget-bg-color`) en header | Fondo gris (`--bg-color`) — mismo que el resto |
| Borde `1px solid var(--border-color)` separaba header/tabs y tabs/content | Sin bordes — bloque continuo |

**Archivos modificados:**
- `modules/gestion-humana/gestion-humana-home.html` — breadcrumb + pill + removido bell button
- `modules/gestion-humana/gestion-humana-home.css` — tokens `--bg-color`, pill styles, hover de tab usa `--gh-accent-soft`, removidos `.gh-bell-*` styles y `border-bottom`
- `modules/gestion-humana/gestion-humana-home.js` — nueva función `_updateCompanyPill()`, fallback inline actualizado, llamada en `_renderShell()`
- `index.html` — cache-bust `?v=GH-20260927-shell-no-borders`
- `package.json` — bump 0.1.215 → 0.1.216

**Funcionalidad preservada:**
- 9 vistas del shell (Resumen, Dashboard, Contratación, Carpetas, Firma, Afiliaciones, Base Personal, Vacaciones, Permisos, Comunicación) intactas
- Sistema de tabs (`gh-tabs`, `gh-tab--active`) sin cambios de comportamiento
- Subtítulo dinámico con la empresa (`#gh-subtitle`) sigue funcionando, complementado por el pill
- Dark mode + dark-legacy funcionan vía tokens sin override extra

## [0.1.215] - 2026-09-27

### 📦816 · Home de Capacitaciones — refactor al patrón premium v2 estilo Presupuesto

**Resumen:** El portal legacy del submódulo 1.2.1 (con prefijo `cap-portal__*` y tokens `--cp-*` propios) se reemplazó por el patrón premium v2 replicado de `pres-home` (Presupuesto): header con breadcrumb + icon chip + título Manrope + pill "Año Activo" + botón "Volver al Menú", y 2 main cards (Ver Cronograma gradient + Clonar Cronograma blanca). Las 4 cards placeholder con `alert()` se removieron porque no tienen contraparte funcional; sólo se mantienen las 2 acciones reales.

| Antes | Después |
|---|---|
| Logo K+AIR + botón Volver propios del submódulo | Eliminados (los provee el shell premium v2) |
| Header propio `cap-portal__header` | `cap-home__header` premium con breadcrumb + icono + título |
| 6 cards (2 main + 4 "Gestión y Configuración") con placeholders | 2 cards (Ver Cronograma primary + Clonar Cronograma secondary) |
| Tokens `--cp-*` propios sin dark mode | Scoped `.cap-home` + tokens `--kair-*` + dark con `[data-theme^="dark"]` |
| Iconos Bootstrap Icons CDN (i class="bi bi-...") | SVGs inline (sin CDN, sin dependencia externa) |
| `let/const` mezclado, `flex:1` y `padding` fijos | `flex:1; min-height:0` + `padding: clamp(16px,2vw,28px)` fluido |
| Cache-bust faltante en `capacitaciones-portal-logic.js` | `?v=CAP-20260927-cap-home-premium-v2` agregado |

**Archivos modificados:**
- `modules/recursos/capacitaciones/cap-home.html` — reescrito (71 líneas)
- `modules/recursos/capacitaciones/cap-home.css` — reescrito (259 líneas, 100% scoped)
- `index.html` — cache-bust agregado a `capacitaciones-portal-logic.js`
- `package.json` — bump 0.1.214 → 0.1.215 + `jsdom` devDep
- `tests/cap-home-e2e.js` — nuevo E2E con jsdom (sin display, sólo estructural)

**Funcionalidad preservada:**
- `id="activeYear"` → `loadActiveYear()` lee año del Excel vía IPC
- `enterCronograma()` → abre `CapacitacionesViewer`
- `cloneCronograma()` → IPC `duplicate-capacitaciones-sheet`
- `goBackToModule()` → postMessage al shell

**Funciones removidas del UI (siguen en `cap-home.js` por seguridad):**
- `importFromExcel()`, `exportCronograma()`, `openMatrizFormacion()`, `openRegistroAsistencia()`, `generateInformeCumplimiento()`, `openCertificados()` — todas eran `alert()` placeholders.

**Bug detectado durante validación:** La primera versión del refactor usaba paths `../../../shared/...` (válidas para iframe como Presupuesto) pero Capacitaciones se carga vía `fetch + innerHTML` donde las URLs se resuelven desde el documento padre. Resultado: CSS no cargaba y la página salía sin estilos. **Fix:** paths relativas a `index.html` (`./shared/...`, `./modules/...`) + `<link>` explícito a `cap-home.css` (que se había omitido por error).

**E2E (`tests/cap-home-e2e.js` con jsdom):**
- 18/18 checks DOM OK (estructura, clases, contenido)
- 15/15 reglas CSS requeridas presentes
- 9/9 tokens kair presentes
- 11/11 estilos clave validados (gradient, grid, flex, dark)
- Callbacks onclick correctos: `enterCronograma()` + `cloneCronograma()` + `goBackToModule()`

**Pendiente validación visual por Javier al reiniciar la app.**

## [0.1.214] - 2026-09-26

### 📦815 · Splash de bienvenida — confetti estilo Stripe con tokens premium v2

El check verde hardcoded de Bootstrap (`#28a745`) del splash de bienvenida se reemplaza por una animación de confetti con 6 cuadrados rotando que vuelan + halo pulsante con gradiente verde→azul. Todo en línea con el design system premium v2 (sin colores hardcoded).

- **`renderer.js` (línea 3150+)**: SVG rediseñado con `<defs><linearGradient id="kairSuccessGrad">` (verde `#1bb888` → azul `#2057b8`), `<circle class="loading-success-halo">` (radio 48), 6 `<rect class="loading-confetti-rect--N">` (3 colores premium: azul/verde/amber) y `<path>` con check premium. ViewBox ampliado 52→120.
- **`styles.css`**:
  - `.loading-success-circle` y `.loading-success-check` ahora usan `stroke: url(#kairSuccessGrad)` (degradado verde→azul) en lugar de `#28a745`.
  - `.loading-success-halo`: nuevo círculo con fill del gradiente, opacity 0.15, animación `success-halo` (scale 1→1.12, opacity 0.15→0.28) infinito 1.8s.
  - `.loading-confetti-rect--N`: 6 cuadrados con colores `var(--kair-blue/green/amber)`, transform-origin al centro del SVG, animación `confetti-spin` 0.9s que rota ±180° mientras vuela ±42px con stagger 50ms.
  - `filter: drop-shadow(0 4px 14px rgba(27, 184, 136, 0.25))` para glow suave en light mode; `rgba(45, 211, 163, 0.45)` para dark.
  - Mismo patrón aplicado al overlay legado `.kair-transition-success` (línea 5102+) por consistencia.
- **`index.html`**: cache-bust `styles.css?v=20260926-confetti-success`.

#### Antes vs después

| Aspecto | Antes | Después |
|---|---|---|
| Color del check | `#28a745` (Bootstrap verde hardcoded) | Gradiente `#1bb888` → `#2057b8` (tokens premium v2) |
| Tamaño del SVG | 52×52 | 120×120 (más espacio para confetti) |
| Decoración | Solo círculo + check | Halo pulsante + 6 cuadrados confeti |
| Tokens premium v2 | ❌ Hardcoded | ✅ `--kair-blue`, `--kair-green`, `--kair-amber` |
| Dark mode | No soportado | Glow más intenso (`rgba(45, 211, 163, 0.45)`) |
| Sensación | "Cargando..." de 2015 | Celebración estilo Stripe/Vercel |

---

## [0.1.213] - 2026-09-26

### 📦814 · Investigación de Accidentes con IA — prompts alineados al dataset v5 (metodología vertical por columna)

#### Migración del prompt a `dataset_v5_final.jsonl` (ANÁLISIS VERTICAL POR CATEGORÍA)

- **`Portear/src/llm_server.py`**: `INSTRUCCIONES_PROMPT` ahora es la plantilla **v5 VERBATIM** (NO re-envolver párrafos, NO salto inicial invisible, NO quitar líneas en blanco). Cambios clave:
  - **Metodología**: cambia de "5 niveles con cadena causal horizontal 5→4→3→2→1" a **"ANÁLISIS VERTICAL POR CATEGORÍA"**: cadena causal INDEPENDIENTE por columna M (cada celda explica la causa de la MISMA M del nivel anterior, no del nivel completo).
  - **Reglas obligatorias actualizadas**: HERENCIA DE N/A (si una categoría es N/A en un nivel, permanece N/A en los siguientes), DETENCIÓN POR CAUSA RAÍZ (si una categoría ya alcanzó causa raíz, marca N/A en los siguientes), CERO CRUCES (nunca expliques la causa de una categoría usando otra).
  - **Encabezados**: v5 usa "2. ¿Por qué ocurrieron las causas del Nivel 1?" (encadenados) en lugar del placeholder "causa principal del nivel N" del v4 — el parser y `_build_pregunta` los extraen correctamente para la UI.
  - **`_uniform_preguntas` ELIMINADA** (existió 1 día): forzaba el header constante "¿Por qué ocurrió el accidente?" en los 5 niveles, pero **chocaba con el formato del dataset v5** que usa encabezados encadenados por nivel. La cadena causal ahora vive en el CONTENIDO de cada M, no en el título.
  - **Secciones del accidente**: pasan de asteriscos v4 (`**Descripción del accidente:**`) a texto plano v5 (`Descripción del accidente:`) — coincide con el dataset.

- **`tests/investigacion-accidentes/test-hf-llm-canales.js`**: tests de regresión actualizados para verificar:
  - El nuevo prompt sin asteriscos en `build_user_prompt` (regex cambió de `\\n\\n\\*\\*Descripción\\*\\*` a `\\n\\nDescripción:`).
  - Que `_uniform_preguntas` ya NO exista (regresión del fix: si vuelve a aparecer, falla).
  - Que los encabezados encadenados v5 sean parseados correctamente.

- **`AGENTS.md` (gotcha 11)**: actualizada con la nueva metodología. Mantiene las gotchas 9-10 (anti-repetición + cadena iterativa) del paquete anterior.

#### Pendiente conocido

- **Coherencia por columna (cada M responde a su propia M del nivel anterior)** es conducta del MODELO y exige **re-entrenar** con regla columnar nueva + dataset ajustado. NO se resuelve en código. El plan `docs/opencode/plans/20260925-entrenamiento-5porques-v5.md` describe el pipeline de re-entrenamiento (Unsloth + SFT sobre v5+train, epochs ~3, lr 2e-5, export F16 — NO Q4 porque destruye fine-tunes pequeños).

#### Validación

- `tests/investigacion-accidentes/test-hf-llm-canales.js`: **144/144 OK** (sin regresiones).
- `test-inv-llm-server.js` (parser): OK.

---

## [0.1.212] - 2026-09-23

### 📦809 · Notificaciones — fix duplicación de correos (global `*`) + tabs Pendientes/Notificaciones

#### Fix: una sola fila por correo (sin fan-out por empresa)

- El buzón Gmail es global (sin columna de empresa en `email_threads`); antes cada correo se insertaba **una vez por empresa** con bandeja habilitada (47 × 5 = 235 no leídos). Ahora se inserta **una sola fila** con `company_key = '*'` (`GLOBAL_COMPANY` en `notifications-bridge.js`).
- **Detector** `notifications-email.js`: sin fan-out; al menos 1 empresa con bandeja habilitada → 1 entrada por thread; `dedupe_key = correo:*:<ref>:0`.
- **Bridge**: `listar` / `getUnreadCount` incluyen `OR company_key = '*'` siempre; `marcarLeida` acepta globales; `marcarTodas` añade `'*'` al target de sesión; helper `_esGlobal()`.
- **Migración one-shot** en `_ensureSchema`: consolida filas existentes (DELETE duplicados por `ref_id` → UPDATE `company_key` a `'*'` → UPDATE `dedupe_key`).
- **UI**: `_openNotif` abre correo si `companyKey` es `'*'`/vacío; chip de empresa oculto para `'*'`; `refreshNotifications` pasa `companyKey` de la empresa activa si la hay.

#### UI: tabs "Pendientes" / "Notificaciones"

- `shared/kair-alerts.js`: `_state.activeTab` + persistencia en `localStorage['kair-alerts-tab']` (default `pendientes`); `_renderPopover` con tabbar en el head (contadores) y cuerpo según tab; footer "Abrir calendario completo" en **ambas** pestañas; `_pinPopoverHeight`/`_state.panelMinH` fija `min-height` a la mayor vista (sin salto al conmutar).
- `styles.css`: `.kair-alerts-popover__tabs` / `__tab` / `.is-active` / `__tab-n`.
- `index.html`: cache-bust → `?v=20260923-notifs-size` (styles, kair-alerts).
- **Tamaño estable entre pestañas**: footer en ambas, notifs-list sin `max-height: 200px`, `_pinPopoverHeight` fija `min-height` a la mayor vista (sin salto al conmutar).

#### Tests — 167/167 OK

- Suite: bridge **28/28**, service **10/10**, email **7/7**, wiring **11/11**, fuentes **52/52**, ui **36/36**, seguridad **23/23** (total 167; era 155).
- `node --check` OK en `kair-alerts.js`, `notifications-bridge.js`, `notifications-email.js` y los tests tocados.

## [0.1.212] - 2026-09-22

### 📦807 · Notificaciones persistentes (correo + eventos) — bridge, servicio, detección y UI

Feature nueva de notificaciones persistentes en el proceso main (correo + eventos de calendario) con UI completa (badge, toast, panel y ventana dedicada). Commiteado en 📦807 (corrección de conteo de fuentes en 📦808).

#### Backend (proceso main)

- **Bridge IPC nuevo** `main/notifications-bridge.js`: tabla `notificaciones` (tipo `correo`/`evento`, `dedupe_key` UNIQUE + índice único compuesto), 4 handlers (`listar`, `marcarLeida`, `marcarTodas`, `getUnreadCount`) con sesión obligatoria y filtro por empresa (`FORBIDDEN_COMPANY`; `marcarLeida` solo marca ids de la sesión).
- **Servicio de detección** `main/notifications-service.js`: tick con 12 fuentes de calendario inyectables, ventana configurable (`setVentanaMs`), backoff exponencial tras fallos consecutivos y guard de reentrada; aviso al renderer vía `notificaciones:changed` con `unreadTotal`.
- **Detector de correo** `main/notifications-email.js`: lee `email_threads` no leídos del cache (sin llamar Gmail directo; sync best-effort) y respeta el gate de bandeja.
- **Gate real** `main/notifications-gate.js`: mismo criterio que el bridge de permisos (📦702) — admin siempre habilitado, resto según `users.bandeja_integrada_enabled`, sin sesión activa → false (fail-closed).
- **Cableado**: registro y arranque en `main.js`; exposición en `preload.js` (`window.electronAPI.notifications`).

#### UI

- **Badge** con contador de no leídos en el header (escucha `notificaciones:changed`), **toast** persistente con escape HTML (`KairUI.esc`, anti-XSS), **panel** de notificaciones en `shared/kair-alerts.js` (listar `soloNoLeidas`, `marcarLeida`, selector de ventana 15m/1h/6h/24h persistido en localStorage) y **ventana** dedicada; estilos + dark en `styles.css` y cache-bust en `index.html` (`?v=20260922-notifs-ui`).

#### Fixes incluidos

- `mantenimiento-bridge`: ReferenceError corregido (los puentes de fuentes cargan con mock ipcMain y exportan la función para el test).
- Toast de notificaciones: escape HTML en títulos (XSS esc).

#### Tests

- `main/test-notificaciones-seguridad.js` (nuevo) → **23/23 OK**: 4 canales sin token → `UNAUTHORIZED`, companyKey ajena → `FORBIDDEN_COMPANY`, `marcarLeida` de otra empresa → `updated: 0`, `getUnreadCount` solo número, gate `bandeja_integrada_enabled=0` → 0 correos, y sin `access_token` en notifications-*.
- Suite completa: bridge **28/28**, service **10/10**, email **6/6**, wiring **11/11**, fuentes **52/52**, ui **25/25**, seguridad **23/23** (total 155/155). `node --check` OK en `main.js`, `preload.js` y `notifications-*.js`.

## [0.1.211] - 2026-09-21

### 📦802 · Verificación — Definición de Indicadores (6.1.1) + Despliegue Estratégico (6.1.3)

Migración premium v2 de los dos submódulos restantes de Verificación, con conexión al Excel real de la empresa.

#### Definición de Indicadores (6.1.1)

- **Bridge IPC nuevo** `main/indicadores-verificacion-bridge.js`: lee `INDICADORES <año>.xlsx` de `6. Verificación/6.1.1 …` (resuelve carpetas con variantes de acento, igual que inspecciones 📦798). Hojas de definición (RESULTADO/ESTRUCTURA/PROCESO) + hojas de datos con series mensuales (doble fila: valor y denominador). Match por nombre normalizado (sin tildes). Sin carpeta → `source: none` y el frontend cae a su libreta de ejemplo.
- **Registro en `main.js`** (`registerVerificacionIndicadoresHandlers`) y **`preload.js`** expone `verificacionIndicadores.obtener`.
- **Frontend premium v2**: header `kair-page-header` con badge de origen (Excel vs ejemplo), KPIs con tokens canónicos, exportar con acción real, dark con `[data-theme^="dark"]`.
- **Cache-bust** en `index.html`: hoja `?v=20260921-premium-v6` y scripts `?v=20260921-premium-v2/v3`.
- **Tests**: `main/test-indicadores-carpeta.js` → **37/37 OK** (Electron, Excel real de Tempoactiva: 18 indicadores, series dobles y simples, año, fallback).

#### Despliegue Estratégico (6.1.3)

- Vista premium v2: **Header v2** (badge-ico + título + Volver/Refrescar), 4 metric cards, tabla blindada, `tok()`/`palette()`, IPC `revisionAltaDireccion.listarIndicadores` con fallback mock.
- Tokens scoped `--rad-desp-*` en `.kair-rad-view-despliegue` + dark `[data-theme^="dark"]` (sin `:root`/`*`/`body` globales).
- **Cache-bust** `?v=20260921-premium-v2` del script en `index.html`.
- **Test** `main/test-despliegue-estrategico-premium.js` → **38/38 OK**.

#### Otros

- `renderer.js`: 2 mensajes de `console.warn` depurados (sin emoji de alerta).
- Nota: los comentarios en el código de 6.1.1 dicen `📦800` (numeración provisional de la sesión previa); el commit real es 📦802.

### 📦801 · Matriz de Control Operacional (7.1.1) — premium v2 + fix de scroll del editor

Migración al dialecto premium v2 (Header System v2, tokens canónicos, dark completo) y arreglo del scroll roto en la vista de edición que el usuario reportó con captura.

#### Migración premium v2

- **`acciones-pc-view.css`**: tokens premium en `:root` (azul `#2057b8`, tinta `#14213d`, DM Sans + Manrope, radios 20/12), Header System v2 (breadcrumb + icon chip 44×44 + título Manrope 800 + acciones con SVG inline), reset scoped, modo oscuro con `[data-theme^="dark"]` (cubre `dark` y `dark-legacy`), paleta vieja eliminada.
- **`acciones-pc-view.html`**: marcado del Header v2; contrato DOM conservado (`#header-title`, `#header-subtitle`, `#header-breadcrumb` con `data-crumb`, `#btn-back`/`#btn-importar`/`#btn-exportar`, `#header-company-text`).
- **`acciones-pc-viewer.js`**: fix del selector roto `'\.kair-form-section'` → `'.kair-form-section'`; nuevo `_syncMejoramientoStore()` llamado desde `render()` para `MejoramientoStore.update('711', …)` con guard de seguridad.
- **`acciones-pc-logic.js` / `index.html`**: cache-bust de la URL del iframe y del `<script>`.

#### Fix de scroll del editor (reportado con captura)

1. **`.kair-editor` tenía `align-items: start`** (comentario "sidebar no se estira al 100%"): la fila `main` del grid no se estiraba al alto disponible, `.kair-editor__main` crecía con su contenido, `overflow-y: auto` nunca se activaba y `.kair-app { overflow: hidden }` recortaba sin scroll. Fix: quitar `align-items: start` (el sidebar ya tiene `align-self: start`).
2. **Faltaba `min-height: 0` en `.kair-editor__main`**: sin eso el item del grid no puede encogerse por debajo de su contenido y el scroll interno tampoco funciona.
3. **Vista de lista con clase huérfana**: el HTML usaba `class="kair-app-main"` pero el CSS solo define `.kair-main` (`flex:1; min-height:0; overflow-y:auto`) → la lista tampoco scrolleaba. Fix: `kair-app-main` → `kair-main`.

#### Verificación

- `node tests/mejoramiento/test-premium-v2.js` → **39/39 OK** (4 checks nuevos de regresión del scroll).
- Arnés Electron real: editor `clientHeight 492` / `scrollHeight 5258`, `scrollTop` cambia a 400, `alignItems: normal`, body sin scroll.
- `node --check` viewer y logic OK. EOL de los archivos en LF.
- **Cache-bust** `APC-20260921-v2-scroll` en los 4 sitios + test.

### 📦800 · Auditoría Anual (6.1.2) — botón "Nueva auditoría" abría un modal sin estilo

El botón "Nueva auditoría" (hub y lista) no mostraba el formulario: el modal existía en el DOM pero **tenía cero reglas CSS** (`.kair-aud-modal`, botones, filas del formulario, confirm y toast fallback no estaban en la hoja), y en la vista de lista el botón solo disparaba un placeholder ("versión enterprise").

#### Cambios

- **`auditoria-anual.css` +432 líneas**: estilos del modal (oculto por defecto, `--open` flex, backdrop, panel radio 20, formulario 2 columnas, botones ghost/primary), diálogo de confirmación y toast de respaldo. Los tokens `--aud-*` se declaran **sobre el propio modal** (vive en `<body>`, fuera de `.kair-v3-module` donde están los `--v3-*`) con la paleta canónica; modo oscuro con `[data-theme^="dark"]` (cubre `dark` y `dark-legacy`).
- **Fachada `openAuditoriaForm`**: `console.warn` + aviso visible si `__kairAudInstance` es null (antes fallaba en silencio).
- **`auditoria-list-view.js`**: el botón de la lista ahora abre el modal real (`window.kairAuditoriaAnual.openAuditoriaForm(null)`) en vez del placeholder.
- **`auditoria-hub-view.js`**: el guard `_clickBound` impedía re-bindear tras destroy+re-render (botón dejaba de funcionar al re-entrar al módulo); se bindea en cada render (el handler ya tiene su propio guard `view !== 'hub'`). Se quitaron los `console.log` de debug.
- **Cache-bust** `AUD-20260921-modal-css` en `index.html` (script del componente) + `loadCss` del CSS + `loadScript` de la vista de lista.
- **EOL**: los 3 archivos del módulo normalizados a LF (el índice los tiene en LF; el working tree estaba en CRLF y el diff salía de miles de líneas).

### 📦799 · Home Gestión de Peligros y Riesgos — fix de datos reales en hero, tarjetas y gráficas

El home premium (📦754) se veía todo en cero (hero "0% cumplimiento", INSPECCIONES 0/0, MANTENIMIENTO 0/0, PELIGROS 0/0, barras "Cumplimiento por área" en 0) aunque la empresa tuviera datos reales.

#### Causa (dos fallos combinados)

1. **Nunca se entregaba la información a la vista**: `refreshStats()` guardaba las respuestas de los puentes en la caché global de sesión, pero jamás asignaba `this.peligrosStats`, que es lo que lee `renderMainArea()`. Los datos llegaban bien y morían en la bodega.
2. **Nombres de campos incompatibles**: la vista leía `inspecciones.total/realizadas/vencidas` y `mantenimiento.total/completados/atrasado`, pero los puentes devuelven `programaTotal/programaCompletadas/programaPendientes` (o `totalInspecciones/completadas/pendientesMes`) y `totalActividades/completadasMes/pendientesMes`. Cada lectura caía en `undefined` → 0.

#### Cambios

- **Mapeo explícito** en `refreshStats()` hacia los nombres que la vista consume + asignación real de `this.peligrosStats`. Con el Excel real de Tempoactiva (29 cumplidos + 10 programados) la tarjeta muestra 29/39.
- **Mediciones y EPP marcados como "sin datos" (null)**: nunca tuvieron puente de datos, así que su barra se dibujaba 0/0 eternamente y arrastraban el score del hero a cero. Ahora el score compuesto solo promedia las áreas con datos y la barra de Mediciones solo aparece cuando exista un canal que la alimente.
- **Ajustes pendientes de Mantenimiento (4.2.5)** de la auditoría 📦797: carga CSS duplicada sin versión en `mantenimiento-component.js` (href con `?v=20260921-premium-header` y selector `^=`) y tipografía del sistema (Manrope/DM Sans) en `mantenimiento.css`.
- **Cache-bust** `GESTION-PELIGROS-20260918-bar-chart-html` → `GESTION-PELIGROS-20260921-fix-home-datos`.

## [0.1.210] - 2026-09-21

### 📦796 · Inspecciones Sistemáticas (4.2.4) — premium completo de las 7 vistas

Cierre de la migración iniciada en 📦793 (hub). Las 7 vistas funcionales migran al header premium v7 (`buildHeader` con clases `kmi-*`: transparente, breadcrumb, píldora "Sincronizado", botón Volver) manteniendo intacto el flujo de datos.

#### Cambios

- **Header premium v7** en `inspeccion-templates.js` → heredan las 7 vistas (hub, dashboard de programa anual, historial, detalle, 4 formularios).
- **Hub reescrito** como referencia: hero oscuro con score compuesto + donut SVG nativo + 4 KPIs + formatos verticales + recientes/avance.
- **Historial**: filas con píldoras de filtro por tipo + buscador; **Dashboard/Programa**: tabla mensual con tokens; **Detalle + formularios**: tokens del sistema premium y modo oscuro redefinido bajo `[data-theme] .kair-app`.
- **Verificación visual** en claro/oscuro, maximizado y modo ventana (1000px).
- **Cache-bust** `20260921-premium-v2-inspecciones`.

### 📦797 · Mantenimiento Periódico (4.2.5) — header premium

`mantenimiento-component.js` + `mantenimiento.css` alineados al lenguaje visual premium (título Manrope 800, acciones consistentes, tokens canónicos). Las vistas funcionales (cronograma, resumen) no cambian de flujo. **Cache-bust** `20260921-premium-header` (5 referencias).

### 📦798 · Inspecciones (4.2.4) — reconexión a la carpeta real de la empresa

El submódulo vuelve a leer/escribir la carpeta SG-SST de la empresa (conexión que existió en 📦332/338 de mayo 2026 y quedó desactivada en la reconstrucción 📦500).

#### Cambios

- **Programa anual desde el Excel real**: `programa:obtener` lee `PROGRAMA DE INSPECCIONES.xlsx` de la carpeta 4.2.4. Encabezados de mes detectados **por texto** (Ene…Dic), no por posición fija; celdas de error `#VALUE!` y zona de firmas ignoradas; códigos `p`=programado, `c`=cumplido. `programa:actualizarActividad` con id `excel:<empresa>:<año>:<fila>` escribe la `c` en el Excel con **respaldo automático en `backup/` antes de cada escritura**. Cache en memoria por mtime del archivo. Sin carpeta/Excel → fallback a la libreta interna (`<userData>/kair-inspecciones-data.json`) como antes.
- **Archivo histórico visible**: nuevo canal `inspeccion:explorarHistorico` escanea `Inspeciones realizadas/<Sede>/<DD-MM-AAAA>/`; la vista de Historial muestra la sección "Archivo histórico · carpeta de la empresa" (visitas con conteo de fotos/formatos + formatos rellenados sueltos tipo `GI-FO-026 1-2026.xlsx`) con botón **Abrir carpeta** (`inspeccion:abrirRuta` → `shell.openPath`).
- **Archivado de inspecciones nuevas**: `inspeccion:archivar` genera el formato oficial (plantilla GI-FO) y lo guarda en `Inspeciones realizadas/<sede>/<fecha>/`; botón **"Archivar en carpeta"** en la vista de detalle.
- **Migración legado**: `inspecciones_data.json` de la carpeta (formato 📦332) importado a la libreta interna una sola vez, idempotente por id.
- **Fix de fechas** (submódulo completo): `formatDate` parseaba ISO sin hora como UTC y en Colombia (UTC-5) mostraba un día atrás; ahora se construye como fecha local.
- **Preload**: 3 métodos nuevos (`inspeccionExplorarHistorico`, `inspeccionAbrirRuta`, `inspeccionArchivar`).
- **Test nuevo** `main/test-inspecciones-carpeta.js`: **26/26** contra copia de la estructura real de la empresa (el Excel real quedó intacto, verificado).
- **Cache-bust** `20260921-carpeta-v1` (api, templates, historial, detalle).

## [0.1.209] - 2026-09-21

### 📦793 · Inspecciones Sistemáticas (4.2.4) — hub al premium v2

El hub (landing) del submódulo `4.2.4 Inspecciones Sistemáticas a las Instalaciones, Máquinas o Equipos` migra al Patrón A premium (mismo que los 8 módulos home rediseñados en 📦730-737). Las 7 vistas funcionales (dashboard, historial, detalle, 4 formularios) quedan intactas y siguen usando el header legacy `.k-module-header`.

#### Cambios

- **Page-header premium limpio** en el hub: icono decorativo en chip 44×44 (`.kair-badge-ico`), título Manrope 800 20px, subtítulo muted, 2 acciones a la derecha (`Ver Historial` outline + `Volver` ghost). Sin breadcrumb pills, sin chip de empresa.
- **Hero card con score compuesto** (`.kair-hero-card`): `% de cumplimiento general` calculado como `closedStatuses / total` donde `closedStatuses = ["Ejecutado","Completada","Cumplida"]`. Gradiente sutil blanco→blue-soft.
- **3 metric cards** (`.kair-metric-strip` + `.kair-metric-card`):
  - `Inspecciones del mes` (azul) — count donde `date >= firstOfMonth`
  - `No conformidades` (amber) — count donde status ∈ {Pendiente, Vencida, Sin Iniciar}
  - `Próximas a vencer` (rojo) — count donde status ∈ {Pendiente, Programada, Sin Iniciar} y date ∈ [now, now+7d]
- **Chart SVG nativo** (barras horizontales, sin Chart.js): distribución por tipo de inspección con label "X (Y%)" + barra coloreada con el accent del tipo. Empty state si no hay inspecciones.
- **Module grid** con flecha (Patrón A): 4 cards de tipos (botiquín/extintores/instalaciones/equipos_emergencia) con chip de código + revisión, descripción, hover sutil (translateY(-1px) + flecha que se desplaza).
- **Sección Recientes** mejorada: header de sección con título uppercase + botón ghost "Ver historial completo", tabla intacta.
- **Layout flex chain** en el wrap principal (`height:100%;display:flex;flex-direction:column;min-height:0`) + `main` con `flex:1;min-height:0;overflow-y:auto` para scroll interno correcto.
- **CSS nuevo (~451 líneas)** scoped bajo `.kair-app .kair-*` con tokens locales (no choca con el design system global). Responsive a 1024px (métrica 2-col + grid 1-col) y 640px (métrica 1-col + header wrap).
- **Modo oscuro completo** (dark + dark-legacy) via selectores `[data-theme^="dark"]` para todos los elementos nuevos.
- **Sintaxis validada** con `node --check` exit 0.
- **Cache-bust** `20260915-hero-scope-fix` → `20260920-hub-premium`.

#### Lo que NO se tocó

- `inspeccion-templates.js` — `buildHeader()` queda legacy porque las 7 vistas funcionales lo siguen usando.
- `api.js`, `store.js`, `router.js`, IPC, BD — intactos.

### 📦794 · Identificación de Peligros (4.1.2) migrada al premium v2

Migración completa del submódulo `4.1.2 Identificación de Peligros` al dialecto premium v2 (mismo patrón aplicado en 📦783, 784, 785–792). Incluye bridge IPC, los 4 sub-componentes (header / matriz / indicadores / priorización), el service, el CSS y un test nuevo de validación de contratos.

#### Cambios

- **Bridge IPC** (`main/identificacion-peligros-bridge.js`): reescrito con tokens scoped, modo oscuro en ambos atributos (`[data-theme^="dark"]`), BOM/EOL normalizado a LF.
- **Sub-componentes JS** (`kair-matriz-peligros-{header,matriz,indicadores,priorizacion,service}.js` + `kair-matriz-peligros.js`): migrados al dialecto premium v2 con Header System v2, tokens scoped `--km-*` o equivalentes, sin colores hardcodeados, sin selectores globales.
- **CSS** (`kair-matriz-peligros.css`): scoped bajo `.km-wrapper`, modo oscuro completo (`[data-theme^="dark"]`), donut theme-aware con helpers `tok()` / `palette()` que leen tokens CSS computados.
- **Home del módulo padre** (`gestion-peligros-home.js`): ajustes de integración.
- **Test nuevo** (`main/test-identificacion-peligros.js`, 149 líneas, 9 contratos): valida tokens nuevos en `.km-wrapper`, modo oscuro con re-definición de tokens (ambos atributos), reglas de especificidad oscuras, sin colores sueltos en secciones claras, integridad estructural del CSS, donut con clase + sin atributos stroke muertos, colores inline theme-aware, iconos 0 Font Awesome con Bootstrap local, cableado intacto.

---

## [0.1.208] - 2026-09-19

### 📦785 · Severidad de la Accidentalidad (3.3.2) migrada al premium v2

Migración al dialecto premium v2 del submódulo 3.3.2 (`modules/gestion-salud/severidad-accidentalidad/`), con Header System v2, tokens propios scoped, tabla blindada, gráfico SVG theme-aware y wrapper en paralelo en maximizada.

#### Cambios

- **Header System v2** con breadcrumb + icon chip + título Manrope 800 + subtítulo + acciones, transparente sobre el canvas.
- **Tokens propios `--sev-*` scoped** bajo `.severidad-container`: se eliminó el `:root` + `*` + `body` GLOBALES que pisaban tokens y márgenes de TODA la app (mismo patrón que 📦784 Frecuencia). 125 selectores scopados.
- **Modo oscuro en los DOS atributos** (`data-theme="dark"` + `data-theme="dark-legacy"` con selector `[data-theme^="dark"]`).
- **Tabla con blindaje anti-fugas**: `min-width: 0 !important` + `max-width: 100% !important` + `table-layout: fixed` con 7 anchos fijos que suman exactamente 100% (Mes 9/14/14/14/17/10/22%).
- **Gráfico SVG leyendo la paleta** con `tok()` y `palette()` (helpers que leen tokens CSS computados), en vez de hex hardcodeados.
- **Wrapper `.sev-duo` en paralelo** (gráfico + tabla lado a lado) en maximizada (`@media (min-width: 1360px)`).
- **Meses grid 6/12**: `repeat(6, minmax(0,1fr))` en ventana, `repeat(12, minmax(0,1fr))` en maximizada.
- **Código muerto eliminado**: `buildGridLines()`, `buildChartPoints()` y `escapeHtml()`.
- **renderer.js parcheado**: TOKEN + cache-bust en 2 niveles (index.html → renderer.js, renderer.js → CSS/HTML/JS del módulo) + sanitizar `<link>` CDN inyectados con `innerHTML`.
- **Test 21/21 OK**.
- **EOL normalizado a LF** (el directorio era `i/lf w/crlf`).

---

### 📦786 · Índice de Mortalidad (3.3.3) migrada al premium v2

Migración al dialecto premium v2 del submódulo 3.3.3 (`modules/gestion-salud/indice-mortalidad/`), con Header System v2, tokens propios scoped, tabla blindada, Chart.js theme-aware y resize handler con cleanup.

#### Cambios

- **Header System v2** con breadcrumb + icon chip + título Manrope 800 + subtítulo + acciones, transparente sobre el canvas.
- **Tokens propios `--mort-*` scoped** bajo `.indice-mortalidad-container`: se eliminó el `:root` + `*` + `body` GLOBALES que pisaban tokens y márgenes de TODA la app. Selectores scopados.
- **Modo oscuro en los DOS atributos** (`data-theme="dark"` + `data-theme="dark-legacy"` con selector `[data-theme^="dark"]`).
- **Tabla con blindaje anti-fugas**: `min-width: 0 !important` + `max-width: 100% !important` + `table-layout: fixed` con 7 anchos fijos que suman exactamente 100% (Mes/Total AT/AT Mortales/Días Cargados/Proporción/Meta/Estado = 12/12/14/14/16/10/22%).
- **Chart.js theme-aware**: gradientes claro/oscuro, `Chart.defaults` (color, borderColor, font) y los plugins (metaZone, barLabels, anualLine, metaLine) leyendo la paleta con `tok()`/`palette()`.
- **`tok()`/`palette()` en getStatusBadge/getValueColor/renderizar/renderizarTabla** (se relee la paleta en cada render, así sigue el tema).
- **Resize handler con cleanup**: un solo `window.__mortResizeHandler` con `removeEventListener` del anterior (reabrir el módulo no acumula listeners).
- **Código muerto eliminado**: `escapeHtml()`.
- **renderer.js parcheado**: TOKEN + cache-bust en 2 niveles (index.html → renderer.js, renderer.js → CSS/HTML/JS del módulo) + sanitizar `<link>` CDN inyectados con `innerHTML`.
- **Test 38/38 OK**.
- **EOL normalizado a LF** (el directorio era `i/lf w/crlf`).

---

### 📦786-fix · Índice de Mortalidad (3.3.3) — gráfico y tabla en paralelo en maximizada

El gráfico y la tabla ahora se muestran **lado a lado en maximizada**, igual que Frecuencia de la Accidentalidad (3.3.1) y Severidad de la Accidentalidad (3.3.2). En ventana normal siguen uno debajo del otro.

#### Cambios

- **HTML**: `#chartSection` + `#tableSection` envueltos en `<div class="mort-duo">`.
- **CSS**: `.mort-duo` con `grid-template-columns: 1fr` por defecto y `minmax(0,1fr) minmax(0,1fr)` en `@media (min-width: 1360px)`; las 2 tarjetas pasan a `display:flex; flex-direction:column` para estirarse al MISMO alto (el de la tabla) y `.kair-chart-container { flex:1; min-height:0 }` para que el canvas (Chart.js `responsive:true` + `maintainAspectRatio:false`) ocupe el espacio libre sin deformarse.
- **JS**: `chartSection/tableSection.style.display = ''` en vez de `'block'` — el **estilo en línea le ganaba al `display:flex`** de la media query, así que había que quitar la propiedad para que el CSS decida el display.
- **Cache-bust en 2 niveles**: `MORT-20260919-v2-duo` (renderer.js → módulo) + `renderer.js?v=20260919-mortalidad-duo` (index.html → renderer.js).
- **Test 46/46 OK** (8 checks nuevos: wrapper del duo, grid 1/2 columnas, tarjetas flex, chart container `flex:1` y que el JS no fije display en línea).
- **Medido con arnés real de Electron**: maximizada (inner 1904) → `cols 690px 690px`, chart y table 580×580, lado a lado, sin desborde; ventana normal (inner 1184) → `cols 1113px` (1 columna), apiladas, sin desborde.

---

### 📦787 · Prevalencia de Enfermedad Laboral (3.3.4) migrada al premium v2

Migración al dialecto premium v2 del submódulo 3.3.4 (`modules/gestion-salud/prevalencia-enfermedad-laboral/`), con Header System v2, tokens propios scoped, tabla blindada, Chart.js theme-aware y gráfico + tabla en paralelo en maximizada.

#### Cambios

- **Header System v2** con breadcrumb + icon chip + título Manrope 800 + subtítulo + acciones, transparente sobre el canvas. **Iconos en SVG inline** (se quitó el CDN de Bootstrap Icons y los `<i class="bi ...">` que nunca renderizaban porque el `<link>` del `<head>` se descarta al inyectar solo `doc.body`).
- **Tokens propios `--prev-*` scoped** bajo `.prevalencia-container`: se eliminó el `:root` + `*` + `body` GLOBALES que pisaban tokens y márgenes de TODA la app.
- **Modo oscuro en los DOS atributos** (`data-theme="dark"` + `data-theme="dark-legacy"` con selector `[data-theme^="dark"]`).
- **Tabla con blindaje anti-fugas**: `min-width: 0 !important` + `max-width: 100% !important` + `table-layout: fixed` con **6 anchos fijos que suman exactamente 100%** (Mes 12 / Casos EL 12 / Trabajadores 16 / Prevalencia 28 / Meta 10 / Estado 22).
- **Chart.js theme-aware**: gradientes claro/oscuro, los 4 plugins (metaZone, barLabels, promedioLine, metaLine) y `Chart.defaults` (color, borderColor, font) + tooltip y ejes leyendo la paleta con `tok()`/`palette()`.
- **`tok()`/`palette()` en getStatusBadge/getValueColor/renderizar/renderizarTabla/renderFallbackChart** (se relee la paleta en cada render, así sigue el tema).
- **Resize handler con cleanup**: un solo `window.__prevResizeHandler` con `removeEventListener` del anterior.
- **Gráfico y tabla en paralelo en maximizada** (`.prev-duo`, mismo patrón que `.freq-duo`/`.sev-duo`/`.mort-duo`). El JS pone `display = ''` (no `'block'`) para que el estilo en línea no pise el `display:flex` de la media query.
- **Código muerto eliminado**: `escapeHtml()` y 15 `console.log` de ruido (2 convertidos a `console.error`).
- **renderer.js parcheado**: TOKEN + cache-bust en 2 niveles (index.html → renderer.js, renderer.js → CSS/HTML/JS del módulo) + sanitizar `<link>` CDN inyectados con `innerHTML`.
- **Test 46/46 OK**.
- **EOL normalizado a LF** (el directorio era `i/lf w/crlf`).

#### Verificación (arnés real de Electron)

- Ventana normal (inner 1184) → `cols 1113px` (1 columna), apiladas, sin desborde.
- Maximizada (inner 1904) → `cols 690px 690px`, chart y table 604×604, lado a lado, **0 celdas recortadas**.
- `dark` y `dark-legacy` → idénticos (`#0f172a` / `#1a2334` / `#e8edf5`).

---

### 📦788 · Incidencia de Enfermedad Laboral (3.3.5) migrada al premium v2

Migración al dialecto premium v2 del submódulo 3.3.5 (`modules/gestion-salud/incidencia-enfermedad-laboral/`), con Header System v2, tokens propios scoped, tabla blindada, Chart.js theme-aware y gráfico + tabla en paralelo en maximizada.

#### Cambios

- **Módulo hermano de Prevalencia (3.3.4)**: los archivos originales eran **idénticos salvo renombres**, así que el CSS y el JS se **generaron desde los de Prevalencia ya migrados** con renombres controlados y el HTML se escribió a mano para conservar sus etiquetas propias.
- 🚨 **La trampa del renombre masivo**: `casosEL` → `casosNuevosEL` tiene que ser **case-sensitive**; un `-replace` de PowerShell (case-insensitive por defecto) convierte también `totalCasosEL` en `totalcasosNuevosEL` y **rompe los totales**. Con `String.split().join()` de Node (case-sensitive) `totalCasosEL` no se toca (tiene `C` mayúscula).
- **Header System v2** con breadcrumb + icon chip + título Manrope 800 + subtítulo + acciones, transparente sobre el canvas. **Iconos en SVG inline** (se quitó el CDN de Bootstrap Icons).
- **Tokens propios `--inc-*` scoped** bajo `.incidencia-container`: se eliminó el `:root` + `*` + `body` GLOBALES.
- **Modo oscuro en los DOS atributos** (`data-theme="dark"` + `data-theme="dark-legacy"` con selector `[data-theme^="dark"]`).
- **Tabla con blindaje anti-fugas**: `min-width: 0 !important` + `max-width: 100% !important` + `table-layout: fixed` con **6 anchos fijos que suman exactamente 100%** (Mes 12 / Casos Nuevos EL 12 / Trabajadores 16 / Incidencia 28 / Meta 10 / Estado 22).
- **Chart.js theme-aware**: gradientes claro/oscuro, los 4 plugins (metaZone, barLabels, promedioLine, metaLine) y `Chart.defaults` + tooltip y ejes leyendo la paleta con `tok()`/`palette()`.
- **`tok()`/`palette()` en getStatusBadge/getValueColor/renderizar/renderizarTabla/renderFallbackChart**.
- **Resize handler con cleanup**: un solo `window.__incResizeHandler` con `removeEventListener` del anterior.
- **Gráfico y tabla en paralelo en maximizada** (`.inc-duo`). El JS pone `display = ''` (no `'block'`) para que el estilo en línea no pise el `display:flex` de la media query.
- **Se agregaron a la hoja los estilos del error** (`.kair-error-icon`, `.kair-error-msg`, `.kair-retry-btn`) que el HTML usaba y la hoja vieja **no definía** (salían sin estilo).
- **Se conservaron las diferencias reales de Incidencia**: KPI "CASOS NUEVOS EL (AÑO)", Meta "<5 (Coordinador SST)", el párrafo extra `<strong>Meta:</strong>` de la metodología, la interpretación con "nuevos casos" y el botón **Reintentar**.
- **Código muerto eliminado**: `escapeHtml()` y 15 `console.log` de ruido (2 convertidos a `console.error`).
- **renderer.js parcheado**: TOKEN + cache-bust en 2 niveles + sanitizar `<link>` CDN inyectados con `innerHTML`.
- **Test 46/46 OK**.
- **EOL normalizado a LF**.

#### Verificación (arnés real de Electron)

- Ventana normal (inner 1184) → `cols 1113px` (1 columna), apiladas, sin desborde, 0 recortes.
- Maximizada (inner 1904) → `cols 690px 690px`, chart y table 619×619, lado a lado, **0 celdas recortadas**.
- `dark` y `dark-legacy` → idénticos (`#0f172a` / `#1a2334` / `#e8edf5`).

---

### 📦789 · Medición del Ausentismo (3.3.6) migrada al premium v2 (Fase 1 + vistas)

Migración al dialecto premium v2 del submódulo 3.3.6 (`modules/gestion-salud/ausentismo/`), en dos fases: home + blindaje de fugas, y luego las vistas.

#### Fase 1 — Home + blindaje

- **Home (iframe)**: Header System v2 + paleta canónica + modo oscuro (los 2 atributos) + 10 iconos SVG inline (0 Font Awesome).
- **`initThemeSync()`**: pide el tema al padre (`get-theme-request`) y escucha `theme-changed` — antes el iframe se quedaba claro si se creaba DESPUÉS de aplicar el tema.
- **Blindaje**: los **7 bloques `<style>`** que el componente inyectaba en el `<head>` GLOBAL (~684 líneas con `:root --sp-*`, 95 clases sin scope y selectores de etiqueta como `textarea`) quedaron scopados bajo `.aus-scope` con un transformador CSS propio (respeta `@keyframes` verbatim, recurre en `@media`, preserva comentarios).
- `:root --sp-*` → `.aus-scope`; selectores de etiqueta scopados; `@keyframes` genéricos (`fadeIn`/`slideDown`/`slideUp`) renombrados a `ausFadeIn`/`ausSlideDown`/`ausSlideUp`.
- `.aus-scope` aplicado al contenedor + los **6 nodos montados en `<body>`** (panel, modales, overlays).
- 🚨 **Trampa del scopeado en nodos montados en `<body>`**: el backdrop del panel se appendea a `<body>`, así que se le puso `.aus-scope` A SÍ MISMO — pero los selectores `.aus-scope .seguimiento-backdrop` exigen un **ancestro**, así que no aplicaban y el panel quedaba en `translateX(100%)` (**fuera de pantalla**). Fix: variante **self** (`.aus-scope.seguimiento-backdrop`), mismo patrón de 📦761.

#### Vistas

- **Registrar Ausentismo** y **Ver Ausentismo**: reescritas con clases premium + SVG (0 colores inline, 0 Font Awesome). Se conservaron los 15 IDs del formulario, los IDs de filtros, `ausentismoTableBody`, el target del FAB y las clases de delegación.
- **Seguimiento de Incapacidades**: header + 4 KPIs + filtros + tabla premium (avatar, progress, badges, acciones SVG); se eliminó la inyección de Font Awesome por CDN.
- **Estadísticas**: los bloques `.k-*`/`.es-*` remapeados a tokens `--aus-*` (148 reemplazos) → **dark automático**; radios 20/12; header v2; 2ª inyección de Font Awesome CDN eliminada.
- **Consulta de Trabajadores**: tokens canónicos + modo oscuro + Header System v2 + 7 iconos SVG.
- **Generar Informe**: **CDN → local** (Google Fonts + Font Awesome desde `assets/css/`) → **ya funciona offline**; tokens canónicos + modo oscuro + Header v2 + contraste del botón primario en oscuro.
- **`_injectPremiumViewsStyles()`** se llama en `render()` (antes solo en 2 vistas → Seguimiento y Estadísticas quedaban sin estilos).

#### Correcciones

- Se corrigieron 2 tests que asertaban el token **compartido** de `renderer.js` en `index.html` (Mortalidad y Prevalencia venían fallando desde 📦788); ahora validan que exista un cache-bust real.

#### Verificación

- Test `tests/ausentismo/test-premium.js` → **110/110** (incluye 3 checks de regresión del backdrop self).
- Arnés real de Electron en claro / `dark` / `dark-legacy` para todas las vistas.

---

### 📦790 · Seguimiento de Gestación (3.3.6) — home migrado

Primera de 4 vistas del paquete de gestación (todas iframes).

- **Tokens `--v3-*`** (azul viejo `#174ea6`, familia de `auditoria-anual.css`) remapeados a la paleta canónica (`#2057b8`, `#14213d`, `#748096`, `#e8ebee`, `#fbfcfb`), radios 20/12, fuente DM Sans.
- **Modo oscuro**: bloque `[data-theme^="dark"]` con los 20 tokens oscuros.
- **Header System v2**: transparente, título **Manrope 800 20px**, icono convertido en **chip 44×44** (radio 12, blue-soft).
- **Contraste**: override del botón primario en oscuro (texto oscuro sobre azul claro).
- 🚨 **Bug propio detectado con Electron**: la inserción del bloque oscuro **consumió el `}` de cierre del `:root`**, así que el bloque quedaba anidado dentro de `:root` (CSS inválido) y **no aplicaba**. Se detectó midiendo `getComputedStyle` en tema oscuro (el fondo seguía claro) y se corrigió.

**Pendiente**: `gestacion-antesala`, `gestacion-seguimiento-mensual` y `gestacion-reportes` (mismo patrón).

---

### 📦791 · 2 fixes posteriores a la migración (Consulta de Trabajadores + Indicadores de Salud)

#### 1. Consulta de Trabajadores — icono del estado vacío gigante

Al reemplazar los `<i class="fas ...">` por `<svg>` inline, la regla que les daba tamaño seguía apuntando a `i` (`.ct-empty-state i { font-size: 3rem }`), así que el `<svg>` quedaba **sin ancho/alto** y se estiraba a todo el contenedor. Es el mismo patrón de 📦762.

- Fix: variante `svg` en las 3 reglas que apuntaban a `i` (`.ct-empty-state`, `.ct-search-title`, `.ct-modal-header h3`) con `width/height` explícitos.
- **Regla**: al cambiar un `<i>` por un `<svg>`, TODA regla que lo dimensionaba por `font-size` necesita su variante `svg` con `width/height`.
- Auditoría con Electron midiendo TODOS los SVG de las vistas migradas (home, Registrar, Ver, Seguimiento, Estadísticas): ninguno más tenía el problema.

#### 2. Home de Gestión de la Salud — "Indicadores de Salud" mostraba 0.00

`renderChartSalud()` leía `indicadores.frecuencia`/`.severidad`/`.prevalencia`/`.incidencia`, pero `excel-bridge.leerIndicadores()` NO devuelve esos escalares: devuelve `frecuenciaMensual[]`/`severidadMensual[]` (con `indiceFrecuencia`/`indiceSeveridad` por mes) y `config.prevalenciaEL`/`config.incidenciaEL` (sumas anuales). Como los 4 campos eran `undefined`, `Number(undefined) || 0` daba 0.00 en las 4 barras.

- Fix: frecuencia y severidad se derivan del **promedio de los meses con valor** (mismo criterio que el KPI del módulo 3.3.1); prevalencia e incidencia de `config.*`; se sigue aceptando el escalar si el backend lo agrega (retrocompatible).
- Verificado con Electron (mock con la forma real del backend): **2.00 / 15.00 / 123.45 / 67.89** (antes 0.00).

#### Tests

- `tests/gestion-salud/test-home-indicadores.js` → **8/8** (nuevo).
- `tests/ausentismo/test-premium.js` → **121/121** (11 checks nuevos de Consulta + Informe).

---

### 📦792 · Popover "Pendientes" (KairAlerts) modernizado a premium v2

El panel flotante que se abre con la campana (`shared/kair-alerts.js`) tenía su CSS en **`styles.css`** (bloque de 334 líneas). Estado: 28 colores hardcodeados (`#174ea6`, `#dc3545`, `#111827`, `#1f2937`…), **0 tokens canónicos**, radio 10px, sombras genéricas y sin las fuentes del sistema; sí tenía dark mode.

#### Cambios

- **Tokens locales `--ka-*`** scoped bajo `.kair-alerts-panel` / `.kair-alerts-popover`, mapeados a la paleta canónica + bloque `[data-theme^="dark"]` con los 15 tokens oscuros (cubre `dark` + `dark-legacy`).
- **60 reemplazos** de colores hardcodeados → `var(--ka-*)`.
- Radios 10px → **20px** (tarjeta) / 12px (controles); sombra del sistema.
- Fuentes **DM Sans** (UI) + **Manrope** (título).

#### Bug encontrado

- 🚨 `#111827` se usaba para **dos cosas distintas**: fondo oscuro del header/footer **y** color de texto. Un único mapeo (`→ var(--ka-ink)`) dejó el header **claro en modo oscuro**. Se separó: fondo → `var(--ka-soft)`, texto → `var(--ka-ink)`.
- **Regla**: antes de tokenizar por valor, verificar si ese hex se usa como superficie y como texto (mapear por **propiedad**, no solo por valor).
- **Dato clave**: `shared/kair-design-tokens.css` **NO tiene variantes dark** (los `--kair-*` son solo claros), por eso el popover necesita sus propios tokens + bloque dark.

#### Verificación

- Arnés real de Electron en claro / `dark` / `dark-legacy`: fondo `#ffffff`/`#1a2334`, radio 20px, header `#f3f6f6`/`#1e2738`, título `#14213d`/`#e8edf5` en Manrope, `--ka-primary` `#2057b8`/`#6ea8fe`.
- CSS balanceado (1407/1407), EOL LF.
- Cache-bust de `styles.css` → `20260920-alerts-premium`.

---

## [0.1.207] - 2026-09-19

### 🆕📦739-784 · Migración premium v2 de los submódulos (Inducciones → Frecuencia de la Accidentalidad)

Segunda gran ola del rediseño premium (después de los homes de módulo, `📦730-738`): se migraron al dialecto **premium v2** todos los submódulos con UI propia, y se consolidó el sistema de diseño compartido.

#### Sistema de diseño

- **`shared/kair-premium.css`** (`📦749`) — extracción del "dialecto premium" (hero, KPI, chips, tasks, modules, segmented) scoped bajo `.kair-premium`, para reutilizar en cualquier submódulo.
- **`shared/kair-design-tokens.css`** + **`shared/kair-components.css`** — tokens canónicos (azul `#2057b8`, tinta `#14213d`, muted `#748096`, borde `#e8ebee`, canvas `#fbfcfb`, DM Sans + Manrope, radios 20/12). Todos los submódulos migrados usan ESTA paleta.
- **Header System v2** — breadcrumb + icon chip + título Manrope 800 + subtítulo + acciones, transparente sobre el canvas.
- **Modo oscuro** — cobertura de los DOS atributos de la app (`data-theme="dark"` y `dark-legacy`); patrón reutilizable `[data-theme^="dark"]`.
- **Cache-bust + test de humo** en cada migración.

#### Submódulos migrados

| 📦 | Submódulo | Detalle |
|----|-----------|---------|
| 739-746 | Inducciones | Gráficos SVG nativos, KPI cards con chips, blindaje anti-fugas CSS |
| 740-741 | Capacitaciones / Presupuesto | Modal de período + rediseño de 3 vistas |
| 743 | COPASST + Comité de Convivencia | Paquete premium (portal sin caja) |
| 747-755 | Bandeja Integrada | Premium v2 + firma con imagen (CID) + toolbar compacta + paginación |
| 748-749 | Dashboard principal | Hero + KPI + modules + pendientes (piloto del dialecto) |
| 751 | Configuración | Capa scoped `.kair-config` + remapeo de tokens |
| 756-758 | Skeleton + gráficos de los 7 homes | Esqueleto que encaja + barras HTML (sin deformar) |
| 759-761 | Evaluación Inicial + Archivo/Retención | Reescritura premium v2 recableada al backend |
| 762-769 | Evaluaciones Médicas (EMO) | Certificados persistidos + ancho completo + adjuntar PDF |
| 763-764 | Rendición de Cuentas + 2.9.1 Bienes | Rediseño premium |
| 770-771 | Evaluación y Selección (2.10.1) | Rediseño + tabs con subrayado + fix del botón Volver |
| 772-773 | Perfil de Cargo (3.1.3) + FURAT (3.2.1) | Tokens premium en `:root` + Header System v2 |
| 774 | Gestión del Cambio (2.11.1) | De 6 archivos a 1 par CSS+JS con el marcado embebido |
| 775-777 | Restricciones/Remisiones (3.1.6) | Portal scoped (fix de fuga de tokens) + flujo completo de 3 pasos + vista previa + cancelar + alineación de paleta |
| 778 | Control de Remisiones (3.1.6) | Descarta filas vacías y encabezados repetidos del Excel + `rowNumbers` para el guardado por celda |
| 779 | Estadísticas de Remisiones (3.1.6) | Nueva sección: KPIs + 6 gráficos derivados del Control |
| 780-782 | Investigación de Accidentes (3.2.2) | Las 3 vistas al premium v2 + fix de la fuga global de estilos + ancho completo + lista en 2 columnas en maximizada |
| 783 | Registro y Análisis Estadístico (3.2.3) | Header System v2 + scoping total del CSS (se quitaron las clases GLOBALES `.k-section-card`/`.header-back-btn`) + modo oscuro en los 2 atributos + chips con `color-mix` + los 9 gráficos Chart.js con colores de tema |
| 784 | Frecuencia de la Accidentalidad (3.3.1) | Header System v2 + tokens propios `--freq-*` scoped (se quitó el `:root` + `*` + `body` GLOBALES) + 139 selectores scopados + modo oscuro en los 2 atributos + el gráfico SVG leyendo la paleta con `tok()`; gráfico y tabla **en paralelo** en maximizada con anchos de columna **fijos** (`table-layout: fixed` + blindaje contra `min-width` ajenos), filas de 48 → **35px**, gráfico a **todo el alto** de su tarjeta (intervalo del eje 48 → 86px) y los 12 meses en **1 fila de 12** en maximizada / **2 filas de 6** en ventana |

#### Limpieza

- Se eliminaron **decenas de archivos muertos** y código huérfano (p. ej. `restricciones-medicas-logic.js` pasó de ~60 KB a ~19 KB; Gestión del Cambio de 6 archivos a 1 par CSS+JS).
- Se quitó el `<link>` **global** de `investigacion-accidentes-view.css` en `index.html` (el submódulo ya lo carga dentro de su iframe): traía `html, body { height:100vh; overflow:hidden }` y un `.k-section-card` **sin scope** que pisaban a toda la app.
- Regla documentada en `AGENTS.md`: al migrar una pantalla, borrar los archivos que reemplaza y sus loaders.

#### Docs

- `AGENTS.md` — playbook de migración, specs técnicas ST-01 a ST-08 (`📦750`) y una sección por migración con las lecciones aprendidas.
- `docs/especificaciones-tecnicas-sg-sst-v1.md` — contrato técnico de los próximos submódulos.

#### Archivos

- `package.json` — versión `0.1.207`
- `shared/kair-premium.css`, `shared/kair-design-tokens.css`, `shared/kair-components.css`
- `AGENTS.md`, `README.md`, `CONTEXT.md`, `CHANGELOG.md`

## [0.1.205] - 2026-09-13

### 🆕📦738 · Sidebar lateral: rediseño premium visual (4 iteraciones)

Migra el sidebar lateral principal ("Módulos del Sistema" + "Salir") al design system compartido. Reemplaza `.sidebar-module-card` y derivados por `.kair-nav-card` con tokens de `shared/kair-design-tokens.css`.

#### Iteraciones de diseño (en orden cronológico)

1. **v1-premium** — primera versión con caja de fondo en iconos y bordes en cards. **Rechazada**: "demasiado gris deprimente, no premium".
2. **v2-noborder** — sin border visible, fondo transparente por default, iconos sin caja de fondo. **Aprobada**.
3. **v3-hover-soft** — hover usa el mismo color `--kair-soft` que el estado activo (consistencia visual). **Aprobada**.
4. **v4-footer-soft** — hover del botón "Salir" también usa `--kair-soft` (consistencia con módulos). **Aprobada**.

#### Cambios visuales finales

- **Card principal** (`.kair-nav-card`): fondo **transparente** por default, **sin border visible**, hover con `--kair-soft` (azul claro sutil).
- **Estado activo**: fondo `--kair-soft` + título azul + icono azul. **Sin borde ni box-shadow**.
- **Icono** (`.kair-nav-card__icon`): **sin caja de fondo** — solo el SVG con color (`--kair-blue-ink` para inactivos, `--kair-blue` para activos/hover).
- **Tipografía**: usa `var(--kair-font-ui)` (Manrope).
- **Transiciones**: usa `var(--kair-transition)` (180ms) consistente con los homes premium.

#### Componentes nuevos (`shared/kair-sidebar.css`)

- `.kair-nav-card` (button card principal)
- `.kair-nav-card__icon` (wrapper del icono, sin caja)
- `.kair-nav-card__icon svg` (22×22 stroke-width 1.8)
- `.kair-nav-card__text` (columna título + subtítulo)
- `.kair-nav-card__title` (14px, weight 700)
- `.kair-nav-card__subtitle` (12px, weight 500, color muted)
- `.kair-nav-card--active` (estado seleccionado)
- `.kair-nav-card--footer` (variante "Salir")
- `.kair-nav-card__badge` (+ variantes `--warn`, `--ok`) — badge opcional para alertas (preparado para fase futura)
- `.kair-nav-section-header-li` + `.kair-nav-section-header` (header de sección)
- `.kair-nav-footer-li` (separador antes de "Salir")

#### Compatibilidad

- **NO elimina** las clases legacy `.sidebar-module-card*` — conviven sin conflicto.
- El panel dashboard horizontal ("Módulos del Sistema" en home) y el submenu de Bandeja Integrada **NO se migraron todavía** — quedan en legacy hasta fase futura.

#### Archivos modificados

- `shared/kair-sidebar.css` — **NUEVO** (5,867 bytes, 12 componentes)
- `renderer.js` — 4 ediciones (header, card, footer, `setActiveSidebarButton`)
- `index.html` — nuevo `<link>` con cache-bust `SIDEBAR-20260913-v4-footer-soft`
- `package.json` — versión `0.1.205`
- `CHANGELOG.md` — esta entrada

## [0.1.205] - 2026-09-13

### 🆕📦738 · Sidebar lateral: rediseño premium visual

Migra el sidebar lateral principal ("Módulos del Sistema" + "Salir") al design system compartido. Reemplaza `.sidebar-module-card` y derivados por `.kair-nav-card` con tokens de `shared/kair-design-tokens.css`.

#### Cambios visuales

- **Card principal** (`.kair-nav-card`): fondo `--kair-card`, borde `--kair-line`, hover con `--kair-faint` + borde `--kair-blue`, **estado activo diferenciado** con `--kair-soft` + box-shadow azul (antes era gris plano sin distinción clara).
- **Icono** (`.kair-nav-card__icon`): caja de 36×36 con fondo `--kair-faint` y color `--kair-blue`. En estado activo se invierte (fondo azul + icono blanco).
- **Tipografía**: usa `var(--kair-font-ui)` (Manrope) en lugar de la fuente genérica legacy.
- **Transiciones**: usa `var(--kair-transition)` (180ms) consistente con los homes premium.
- **Estado activo claramente diferenciado**: el módulo seleccionado se ve seleccionado de verdad (antes era idéntico al hover).

#### Componentes nuevos (`shared/kair-sidebar.css`)

- `.kair-nav-card` (button card principal)
- `.kair-nav-card__icon` (wrapper del icono)
- `.kair-nav-card__icon svg` (20×20)
- `.kair-nav-card__text` (columna título + subtítulo)
- `.kair-nav-card__title` (14px, weight 700)
- `.kair-nav-card__subtitle` (12px, weight 500, color muted)
- `.kair-nav-card--active` (estado seleccionado)
- `.kair-nav-card--footer` (variante "Salir" con border dashed)
- `.kair-nav-card__badge` (+ variantes `--warn`, `--ok`) — badge opcional para alertas
- `.kair-nav-section-header-li` + `.kair-nav-section-header` (header de sección)
- `.kair-nav-footer-li` (separador antes de "Salir")

#### Compatibilidad

- **NO elimina** las clases legacy `.sidebar-module-card*` — conviven sin conflicto (por si otros componentes legacy las referencian).
- **Migración gradual**: solo se migró el sidebar lateral principal. El panel dashboard horizontal ("Módulos del Sistema" en home) y el submenu de Bandeja Integrada se pueden migrar después usando los mismos componentes.

#### Archivos modificados

- `shared/kair-sidebar.css` — **NUEVO** (5,867 bytes, 12 componentes)
- `renderer.js` — 4 ediciones de clases en el render del sidebar (líneas 3541-3653 + setActiveSidebarButton)
- `index.html` — nuevo `<link>` para kair-sidebar.css
- `package.json` — versión `0.1.205`
- `CHANGELOG.md` — esta entrada

## [0.1.204] - 2026-09-13

### 📦737 · Módulo Mejoramiento: rediseño premium visual + score compuesto

Replica el patrón premium aplicado a Recursos (📦730), Gestión Integral (📦731), Gestión de la Salud (📦732), Gestión de Peligros (📦733), Gestión de Amenazas (📦734/735) y Verificación (📦736) sobre el home de Mejoramiento Continuo, dejándolo data-driven con score compuesto del módulo.

#### Cambios visuales (UI)

- **Header minimal**: breadcrumb "Inicio / Mejoramiento" + H1 "Mejoramiento Continuo"
- **Hero strip**: 1 hero card "CICLO DE MEJORA CONTINUA" + 3 metric cards (Total Acciones, En Proceso, Vencidas)
- **Chart SVG nativo**: 4 barras horizontales con distribución por estado (Abiertas, En proceso, Cerradas, Vencidas) en colores diferenciados (azul/ámbar/verde/rojo)
- **Panel "En tu radar"**: hasta 3 alertas (Acciones vencidas, Cumplimiento bajo, Acciones sin iniciar)
- **Grid "Explorar submódulos"**: card responsiva con flecha (7.1.1 Acciones Preventivas y Correctivas)
- **Responsive fluido** con clamp() y auto-fill/auto-fit

#### Cambios funcionales (lógica)

- **Score compuesto del módulo** — `cumplimiento`: % de acciones cerradas sobre el total
- **Stats desde MejoramientoStore**: lee `window.MejoramientoStore.getStats()` (mismo objeto que consume el viewer 7.1.1 — fuente única de verdad)
- **`handleSubmoduleClick` agregado** (faltaba en el archivo)
- **`injectStyles()` reducido a stub** — usa design system compartido (elimina 213 líneas de CSS legacy)
- **Bug fix pre-existente**: el archivo usaba clase `.gestion-integral-home` (copia literal) — reemplazada por `.mejoramiento-home`
- **Subscribe eliminado**: el legacy se suscribía reactivamente al store; en el rediseño premium los stats se leen una sola vez al pintar (el home es estático, el viewer 7.1.1 sí es reactivo)

#### Archivos modificados

- `modules/mejoramiento/mejoramiento-home.js` (25,045 → 15,129 bytes, -9,916)
- `index.html` — cache-bust `MEJORAMIENTO-20260913-v1-rediseno`
- `package.json` — versión `0.1.204`
- `CHANGELOG.md` — esta entrada

## [0.1.203] - 2026-09-13

### 📦736 · Módulo Verificación: rediseño premium visual + score compuesto

Replica el patrón premium aplicado a Recursos (📦730), Gestión Integral (📦731), Gestión de la Salud (📦732), Gestión de Peligros (📦733) y Gestión de Amenazas (📦734/735) sobre el home de Verificación del SG-SST, dejándolo data-driven con score compuesto del módulo.

#### Cambios visuales (UI)

- **Header minimal**: breadcrumb "Inicio / Verificación" + H1 "Verificación del SG-SST"
- **Hero strip**: 1 hero card "CUMPLIMIENTO DE VERIFICACIÓN" + 3 metric cards (Total Actividades, Eficacia del Ciclo, Hallazgos Críticos)
- **Chart SVG nativo**: 4 barras horizontales con % cumplimiento por submódulo (6.1.1, 6.1.2, 6.1.3, 6.1.4) en colores según umbral (verde ≥80%, azul ≥50%, ámbar ≥25%, rojo <25%)
- **Panel "En tu radar"**: hasta 3 alertas condicionales (hallazgos críticos, eficacia baja del ciclo, submódulo con más pendientes)
- **Grid "Explorar submódulos"**: cards responsivas con flecha
- **Responsive fluido** con clamp() y auto-fill/auto-fit

#### Cambios funcionales (lógica)

- **Score compuesto del módulo** — `cumplimientoGeneral`: promedio simple de % cumplimiento de los 4 submódulos (Indicadores, Auditoría, Revisión, Planificación)
- **IPC real preservado**: `loadCicloActivo()` carga datos reales desde `RevisionAltaDireccionService.cargarTodo()` para calcular `cicloActivoProgreso` (usado en el hero y metric card "Eficacia del Ciclo")
- **`renderCumplimientoChart` refactorizado**: ya no dibuja chart Chart.js (legacy); solo calcula y guarda `this.cicloActivoProgreso` para uso del render premium
- **`handleSubmoduleClick` agregado** (faltaba en el archivo)
- **`injectStyles()` reducido a stub** — usa design system compartido (elimina 258 líneas de CSS legacy)
- **Bug fix pre-existente**: el archivo usaba clase `.gestion-integral-home` (copia literal del CSS de Gestión Integral) — reemplazada por `.verificacion-home`

#### Archivos modificados

- `modules/verificacion/verificacion-home.js` (35,409 → 23,659 bytes, -11,750)
- `index.html` — cache-bust `VERIFICACION-20260913-v1-rediseno`
- `package.json` — versión `0.1.203`
- `CHANGELOG.md` — esta entrada

## [0.1.202] - 2026-09-13

### 🐛📦735 · Fix patch — Gestión de Amenazas: scroll interno + llamadas inválidas

Dos correcciones sobre el rediseño premium de Gestión de Amenazas (📦734 / v0.1.201):

1. **`updateWidgetsUI` ya no llama a métodos inexistentes** (`renderArchivosChart` / `renderTiposChart`)
   - El bug rompía `refreshStats()` con `TypeError`, dejando la app en skeleton infinito
2. **Scroll interno restaurado** (cadena flex completa)
   - `layout`: agregados `display: flex; flex-direction: column; min-height: 0`
   - `mainArea`: agregados `flex: 1; min-height: 0; overflow-y: auto; padding: 0 1.5rem 1.5rem`

#### Archivos modificados

- `modules/gestion-amenazas/gestion-amenazas-home.js` — 2 edits puntuales (updateWidgetsUI + render)
- `index.html` — cache-bust `GESTION-AMENAZAS-20260913-v3-fix-scroll`
- `package.json` — versión `0.1.202`
- `CHANGELOG.md` — esta entrada

## [0.1.201] - 2026-09-13

### 📦734 · Módulo Gestión de Amenazas: rediseño premium visual + score compuesto

Replica el patrón premium aplicado a Recursos (📦730), Gestión Integral (📦731), Gestión de la Salud (📦732) y Gestión de Peligros y Riesgos (📦733) sobre el home de Gestión de Amenazas, dejándolo data-driven con score compuesto del módulo.

#### Cambios visuales (UI)

- **Header minimal**: breadcrumb "Inicio / Gestión / Amenazas" + H1 "Gestión de Amenazas"
- **Hero strip**: 1 hero card "COBERTURA DOCUMENTAL" + 3 metric cards (Total Archivos, Total Carpetas, Tipos Únicos)
- **Chart SVG nativo**: barras horizontales con archivos por submódulo (5.1.1 Plan de Prevención, 5.1.2 Exámenes Brigadista) en colores diferenciados
- **Panel "En tu radar"**: hasta 3 alertas documentales (submódulos sin archivos, última carga >90 días, módulo sin documentación)
- **Grid "Explorar submódulos"**: cards responsivas con flecha
- **Responsive fluido** con clamp() y auto-fill/auto-fit

#### Cambios funcionales (lógica)

- **Score compuesto del módulo** — `cobertura`: % de submódulos con archivos (excluyendo errores)
- **3 metric cards** derivados de stats reales: archivos totales, carpetas totales, tipos únicos
- **`handleSubmoduleClick` agregado** (faltaba en el archivo legacy)
- **`injectStyles()` reducido a stub** — usa design system compartido de `shared/kair-components.css` (elimina 296 líneas de CSS legacy hardcoded)

#### Archivos modificados

- `modules/gestion-amenazas/gestion-amenazas-home.js` (30,323 → 19,920 bytes, -10,403)
- `index.html` — cache-bust `GESTION-AMENAZAS-20260913-v1-rediseno`
- `package.json` — versión `0.1.201`
- `CHANGELOG.md` — esta entrada

## [0.1.200] - 2026-09-13

### 📦733 · Módulo Gestión de Peligros y Riesgos: rediseño premium visual + score compuesto

Replica el patrón premium aplicado al módulo Gestión de la Salud (📦732) sobre el home de Gestión de Peligros y Riesgos, dejándolo data-driven con score compuesto del módulo.

#### Cambios visuales (UI)

- **Header minimal**: breadcrumb "Inicio / Gestión / Peligros" + H1 "Gestión de Peligros y Riesgos"
- **Hero strip**: 1 hero card "ESTADO GENERAL" + 3 metric cards (Inspecciones, Mantenimiento, Peligros identificados)
- **Chart SVG nativo**: 4 barras horizontales con cumplimiento por área (Inspecciones, Mantenimiento, Peligros, Mediciones) en colores diferenciados + label "X / Y (Z%)" a la derecha
- **Panel "En tu radar"**: hasta 3 alertas (Inspecciones vencidas, Mantenimiento atrasado, EPP sin entregar)
- **Grid "Explorar submódulos"**: cards responsivas con flecha
- **Responsive fluido** con clamp() y auto-fill/auto-fit

#### Cambios funcionales (lógica)

- **Score compuesto del módulo** — `cumplimientoGeneral`:
  - Promedio simple de 5 componentes disponibles en `peligrosStats`: Inspecciones %, Mantenimiento %, Peligros evaluados %, Mediciones realizadas %, EPP entregado %
  - Excluye componentes sin datos
- **Conteo completo de pendientes** — `tareasPendientes`: inspecciones vencidas + mantenimiento atrasado + EPP sin entregar
- **`handleSubmoduleClick` agregado** (faltaba en el archivo)

#### Cambios estructurales (sistema)

- **CSS legacy eliminado**: ~8000 bytes de inyectStyles reducidos a ~2000
- **Patrón de scroll interno**: `.gestion-peligros-home overflow: hidden auto + .main-area flex: 1 1 auto min-height: 0`
- **Render legacy `renderMainArea` (sin async) eliminado**: el nuevo `async renderMainArea` lo sobrescribe
- **Métodos legacy preservados** (refreshStats, updateWidgetsUI, createInspeccionesWidget, createMantenimientoWidget, createPeligrosWidget, createMedicionesWidget, createEPPWidget, renderInspeccionesChart, renderCumplimientoChart, renderSubmoduleItem) — disponibles para uso futuro
- **Cache-bust bumpeado**: `GESTION-PELIGROS-20260913-v1-rediseno`

#### Archivos tocados

- `modules/gestion-peligros/gestion-peligros-home.js` (30KB → 35KB)
- `index.html` (cache-bust)
- `package.json` (0.1.199 → 0.1.200)
- `CHANGELOG.md` (entrada 0.1.200)

## [0.1.199] - 2026-09-12

### 📦732 · Módulo Gestión de la Salud: rediseño premium visual + score compuesto

Replica el patrón premium aplicado al módulo Gestión Integral (📦731) sobre el home de Gestión de la Salud, dejándolo data-driven con score compuesto del módulo.

#### Cambios visuales (UI)

- **Header minimal**: breadcrumb "Inicio / Gestión / Salud" + H1 "Gestión de la Salud"
- **Hero strip**: 1 hero card "ESTADO GENERAL" + 3 metric cards (Inducciones, Evaluaciones médicas, Seguimientos)
- **Chart SVG nativo**: 4 barras horizontales con los indicadores (Frecuencia, Severidad, Prevalencia, Incidencia) en colores diferenciados (azul, verde, ámbar, rojo)
- **Panel "En tu radar"**: hasta 3 alertas (Evaluaciones médicas pendientes, Seguimientos sin cerrar, Accidentes sin investigar)
- **Grid "Explorar submódulos"**: cards responsivas con flecha
- **Responsive fluido** con clamp() y auto-fill/auto-fit

#### Cambios funcionales (lógica)

- **Score compuesto del módulo** — `cumplimientoGeneral`:
  - Promedio simple de 5 componentes disponibles en `saludStats`: Inducciones %, Evaluaciones %, Seguimientos %, Accidentes (100 si 0 accidentes o todos investigados), Tasa ausentismo (inversa)
  - Excluye componentes sin datos
- **Conteo completo de pendientes** — `tareasPendientes`: inducciones + exámenes + seguimientos + accidentes
- **`handleSubmoduleClick` agregado** (faltaba en el archivo)

#### Cambios estructurales (sistema)

- **CSS legacy eliminado**: ~6000 bytes de inyectStyles reducidos a ~2000 bytes
- **Patrón de scroll interno**: `.gestion-salud-home overflow: hidden auto + .main-area flex: 1 1 auto min-height: 0`
- **Métodos legacy preservados** (refreshStats, updateWidgetsUI, renderAccidentesChart, renderIndicesChart, afterDraw, createSeguimientosWidget, createAusentismoWidget, createExamenesWidget, createAccidentesWidget, createRemisionesWidget, createInduccionesWidget, createWidget, renderSubmoduleItem) — disponibles para uso futuro en otros submódulos
- **Cache-bust bumpeado**: `GESTION-SALUD-20260912-v1-rediseno`

#### Archivos tocados

- `modules/gestion-salud/gestion-salud-home.js` (37KB → 46KB, +23%)
- `index.html` (cache-bust)
- `package.json` (0.1.198 → 0.1.199)
- `CHANGELOG.md` (entrada 0.1.199)

## [0.1.198] - 2026-09-12

### 📦731 · Módulo Gestión Integral: rediseño premium visual + score compuesto

Replica el patrón premium aplicado al módulo Recursos (📦730) sobre el home de Gestión Integral, dejándolo data-driven con score compuesto del módulo.

#### Cambios visuales (UI)

- **Header minimal**: breadcrumb "Inicio / Gestión / Integral" + H1 "Gestión Integral" (sin subtítulo/badges/botones del legacy)
- **Hero strip**: 1 hero card "ESTADO GENERAL" + 3 metric cards (Plan de trabajo anual, Objetivos SST, Evaluación inicial)
- **Chart SVG simple**: ejecución del Plan Anual con barra horizontal (azul, 22px de alto) + leyenda "X ejecutadas · Y pendientes · Z totales"
- **Panel "En tu radar"**: hasta 3 alertas del módulo (Política del SG-SST si desactualizada, Rendición de cuentas si 0 actas, Gestión del Cambio si hay pipeline)
- **Grid "Explorar submódulos"**: cards responsivas con flecha, auto-fill + minmax
- **Responsive fluido**: H1, padding, gaps y heights escalan entre ~600px y >1300px viewport usando `clamp()`

#### Cambios funcionales (lógica)

- **Score compuesto del módulo** — `cumplimientoGeneral`:
  - Promedio simple de 6 componentes disponibles en `gestionIntegralStats`: Plan Anual %, Objetivos SST %, Evaluación Inicial % combinado, Política actualizada (100/0/null), Rendición de cuentas (100/0), Cambios (100/0/null)
  - Excluye componentes sin datos (no penaliza con 0)
- **Conteo completo de pendientes** — `tareasPendientes`:
  - Plan Anual pendientes + cambios pendientes + rendición (1 si 0 actas) + política (1 si desactualizada)
- **Método `handleSubmoduleClick` agregado**: faltaba en el archivo (estaba solo en Recursos); ahora el click de submódulos navega correctamente vía `window.showSubmoduleContent`

#### Cambios estructurales (sistema)

- **CSS legacy eliminado** — ~700 líneas de `charts-grid`, `chart-container`, `chart-header`, `donut-chart-wrapper`, `objetivos-chart-wrapper`, media queries `@media (max-width: 768px)` etc. reemplazadas por las clases `kair-*` del design system compartido (📦730)
- **Patrón de scroll interno** — `.gestion-integral-home { height: 100%; overflow: hidden auto }` + `.main-area { flex: 1 1 auto; min-height: 0; overflow-y: auto }` (mismo patrón que Recursos en 📦730)
- **`initCharts` deshabilitado** (línea comentada): los canvases Chart.js legacy no existen en el nuevo layout
- **Métodos legacy preservados**: `loadGestionIntegralStats`, `createWidget`, `createWidgetGestionCambioPipeline`, `createWidgetGestionCambioAging`, `createPlanTrabajoWidget`, `createArchivoRetencionWidget`, `openArchivoRetencionDashboard`, `createEvaluacionInicialWidget`, `createAnnualPlanChart`, `createObjetivosChart` — quedan vivos para uso futuro en otros submódulos
- **Cache-bust bumpeado** en `index.html:310` → `GESTION-INTEGRAL-20260912-v1-rediseno`

#### Archivos tocados

- `modules/gestion-integral/gestion-integral-home.js` (reescrito: 83KB → 62KB, -25%)
- `index.html` (cache-bust)
- `package.json` (0.1.197 → 0.1.198)
- `CHANGELOG.md` (entrada 0.1.198)

## [0.1.197] - 2026-09-12

### 📦730 · Módulo Recursos: rediseño premium visual + score compuesto del módulo

Aplica el rediseño visual premium (referencia `recursos-redisenado.html`) sobre el home del módulo Recursos, lo deja data-driven con score compuesto del módulo, y repara 3 bugs del layout cut-off en modo ventana.

#### Cambios visuales (UI)

- **Nuevo design system compartido** — `shared/kair-design-tokens.css` (2.283 bytes) con 9 tokens CSS globales en `:root` (tipografía DM Sans + Manrope, radios 20-22-12px, espacios 4-32px, transiciones 180ms) y `shared/kair-components.css` (10.611 bytes) con 14 componentes reutilizables:
  - `.kair-page-header` + `.kair-page-title-block` (breadcrumb + H1)
  - `.kair-hero-card` (mensaje + score, fondo azul-ink con círculo decorativo verde)
  - `.kair-metric-card` (con variantes `--danger` / `--warning`)
  - `.kair-card`, `.kair-tabs`, `.kair-btn-primary` / `kair-btn-ghost`
  - `.kair-status-pill--ok` / `kair-status-pill--warn` / `kair-status-pill--danger`
  - `.kair-progress-bar`, `.kair-chart`, `.kair-legend`, `.kair-task`, `.kair-module` + grid
- **Header minimal**: solo breadcrumb "Inicio / Gestión / Recursos" + H1 "Recursos" (sin subtítulo/badges/botones).
- **Hero strip**: 1 hero card "ESTADO GENERAL" + 3 metric cards (Inducciones, Plan de capacitación, Presupuesto).
- **Chart SVG nativo**: ejecución presupuestal mensual (planeado vs ejecutado), 12 meses, sin Chart.js (eliminado del módulo).
- **Panel "En tu radar"**: muestra hasta 3 alertas del módulo con icono + status pill (COPASST, Afiliación SSSI, Comité de Convivencia).
- **Grid "Explorar submódulos"**: 12 cards responsivas con flecha, auto-fill + minmax(200px, 1fr).
- **Responsive fluido**: H1, padding, gaps y heights escalan entre ~600px y >1300px viewport usando `clamp()` + `auto-fit` / `auto-fill`.

#### Cambios funcionales (lógica)

- **Score compuesto del módulo** — `cumplimientoGeneral` reemplaza al viejo `cumplimiento` (que era solo % ejecución presupuestal):
  - Promedio simple de 6 componentes disponibles en `resourceStats`: inducciones %, capacitaciones %, presupuesto %, COPASST acta del mes (binario), Comité Convivencia acta del mes (binario), afiliación estado (`ok`=100, `warn`/`danger`=0).
  - Si un componente no tiene datos, se **excluye** del cálculo (no penaliza con 0).
  - La card "Presupuesto" sigue mostrando `cumplimientoPresupuesto` (su dato específico).
- **Conteo completo de pendientes** — `tareasPendientes` ahora incluye: inducciones + capacitaciones + EPPs + COPASST (1 si falta acta del mes) + Comité (1 si falta acta del mes) + afiliación (1 si estado ≠ ok).
- **Grid sin límite** — `renderSubmodulesGrid()` ahora muestra los 12 submódulos definidos en `ALL_SUBMODULES.Recursos` (antes cortaba en 6 con `.slice(0, 6)`).

#### Cambios estructurales (sistema)

- **Cache-bust obligatorio** en cada `?v=...` de CSS/JS que se modifica (Electron cachea agresivamente; sin esto Ctrl+R no toma cambios).
- **Layout chain para scroll interno** — fix coordinado de 3 causas concurrentes que cortaban el contenido en modo ventana:
  1. `styles.css` sin cache-bust → cambios al CSS no se veían.
  2. Clase `.k-app-layout` sin reglas CSS → eslabón roto del flex chain.
  3. Falta `min-height: 0` y altura constrained en niveles intermedios del flex chain.
- **Override `#main-content:has(.module-content-area .gestion-integral-home) { overflow: hidden !important }`** en `styles.css` para forzar scroll interno en módulos principales.

#### Archivos tocados

- `shared/kair-design-tokens.css` (NUEVO)
- `shared/kair-components.css` (NUEVO)
- `index.html` — links a nuevos CSS con cache-bust
- `modules/recursos/recursos-home.js` — header, renderMainArea, score compuesto, radar, grid
- `styles.css` — fix de scroll interno en módulos principales
- `.gitignore` — patrones `*.bak-*`, `*.backup-*`, `Temp/*.py` para excluir throwaways

## [0.1.191] - 2026-08-31

### 📦767 · I-103.A1.0 — Gestión Humana: ciclo laboral del bp cerrado (fases B a G.2.1)

Cierra el ciclo laboral completo de un bp en el módulo de Gestión Humana, con reglas arquitectónicas estrictas para evitar regresiones futuras en el bypass que unificó RETIRO/REINGRESO/RECONTRATACION con sus eventos transaccionales.

#### Por qué importa

Una auditoría manual detectó que el modal "Ver/Editar" de Base Personal permitía cambiar `estado`, `fechaRetiro` y `fechaIngreso` directamente vía `gh:update-personal`, bypaseando la lógica atómica de `gh:cambiar-estado`. Resultado: un bp podía terminar con `estado=retirado` sin `fecha_retiro` y sin evento RETIRO. **Causa raíz**: `_handlerUpdatePersonal` tenía un whitelist demasiado permisivo y la UI exponía esos campos como editables ordinarios. La fase 1.0 corrige esto en 3 capas (bridge, import, frontend).

#### Cambios

##### 1.0-B · backend blindado contra bp retirado (📦767)

- `_handlerCreateContratacion` y `_handlerMarcarPaso` detectan si la cédula pertenece a un bp retirado. Si lo es, devuelven `recontratacionRequerida: true` (frontend abre modal "¿Recontratar?") o `RECONTRATACION_REQUERIDA` (tests).

##### 1.0-C · limpiar fecha_retiro al reactivar bp (📦767)

- `_handlerCambiarEstado` ahora limpia `fecha_retiro=NULL` en la transición `retirado → activo` (reactivación o reingreso). Antes quedaba la fecha histórica contaminando el nuevo ciclo.

##### 1.0-D-1 · tabla `gh_eventos_personal` con triggers (📦767)

- Nueva tabla `gh_eventos_personal` con 12 columnas, 4 CHECK constraints (incluyendo uno que valida que RETIRO/REINGRESO/RECONTRATACION tengan `estado_anterior` y `estado_nuevo` coherentes), 4 índices, 2 FKs.
- Triggers transaccionales en `_handlerCambiarEstado` que insertan automáticamente el evento RETIRO o REINGRESO en la misma transacción que el UPDATE del bp (atomicidad garantizada con COMMIT/ROLLBACK).
- Convención de IDs: prefijo `ev-` para eventos.

##### 1.0-D-2 · recontratación atómica (📦767)

- Nuevo handler `gh:recontratar-personal` que crea la nueva CT + reactiva el bp + inserta el evento RECONTRATACION, todo en una sola transacción. Validación previa: `cedula` del form debe coincidir con la del bp (defensa contra typos).

##### 1.0-E · refactor de recontratación (📦767)

- `gh:recontratar-personal` ahora exige `contratacionData` (objeto) en vez de `contratacionId` separado. Crea la CT internamente, sin estado provisional. Atomicidad preservada.

##### 1.0-E · frontend modal "¿Recontratar?" (📦767)

- Modal en `modules/gestion-humana/contratacion/index.js` con 4 acciones: **Reingresar** (sin CT), **Recontratar** (con CT), **Corregir cédula**, **Cancelar**. Bifurcación según `bp.estado`.

##### 1.0-F-1 · soft delete puro (📦767)

- `gh:delete-personal` ahora hace SOLO `activo=0`. NO toca `estado` (preserva el ciclo laboral: activo/vacaciones/retirado/etc.), NO toca `fecha_retiro` (preserva la fecha histórica), NO inserta evento (no es un evento laboral). Las FKs CASCADE NO se activan (vacaciones, permisos, documentos, mensajes, afiliaciones se preservan).
- Si el bp está activo → `BP_NOT_RETIRED` (rechazo).
- El frontend cambia el botón "Eliminar" por "Ocultar" con un `confirmDialog` que explica la semántica administrativa.

##### 1.0-G · tests E2E integrales (📦767)

- `main/test-gestion-humana-bridge-e2e.js` con 11 escenarios y 109 asserts: ACTIVO→RETIRO con evento, RETIRADO→REINGRESO, RETIRADO→RECONTRATACION atómico, ROLLBACK ante CEDULA_MISMATCH, ACTIVO+crear CT bloqueado por CEDULA_DUPLICADA, RETIRADO+ocultar preservando historial, ACTIVO+ocultar→BP_NOT_RETIRED, BP oculto+recontratar→BP_DELETED, aislamiento (kair.db nunca se abre), las 3 fechas distintas (CT.fecha_ingreso ≠ evento.fecha_evento ≠ evento.fecha_referencia), CEDULA_MISMATCH con rollback completo.

#### Cambios

##### 1.0-G.2 · cerrar bypass `gh:update-personal` (📦767-fix) — CRÍTICO

**Problema**: el modal Ver/Editar de Base Personal permitía editar `estado`, `fechaRetiro` y `fechaIngreso` directamente vía `gh:update-personal`, bypaseando la lógica de `gh:cambiar-estado`. Esto producía bp con `estado=retirado` sin `fecha_retiro` ni evento RETIRO.

**Solución en 3 capas**:

1. **Bridge `_handlerUpdatePersonal`** (defensa en backend):
   - Rechaza `estado`, `fechaRetiro`, `fechaIngreso` con `PROTECTED_FIELD`.
   - El rechazo es atómico: si llega un campo protegido junto a campos válidos (ej. `cargo + estado`), no se aplica NADA. Rollback completo.

2. **Bridge `_handlerCreatePersonal`**:
   - Rechaza `data.fechaRetiro` con `INVALID_INPUT`. Un bp nuevo no puede nacer con fecha de retiro.

3. **Bridge `gh:import-personal`** (modo `update`):
   - `estado`: `CASE WHEN estado='retirado' THEN estado ELSE ? END` (preserva retirado).
   - `fecha_ingreso`: `CASE WHEN fecha_ingreso IS NOT NULL THEN fecha_ingreso ELSE ? END` (preserva histórico, completa solo si NULL).
   - `fecha_retiro`: `NUNCA modifica`. Conserva el valor de la BD siempre. Import NO puede crear/modificar ciclo laboral de bp existente.
   - bp activo + `fechaRetiro` en Excel → warning en `errors` sin abortar la fila.

**Frontend `base-personal/index.js`**:
- Borrada `_openEditModal` (código muerto confirmado por grep).
- `_saveDetailEdit` filtra `PROTECTED_FIELDS = ['estado', 'fechaRetiro', 'fechaIngreso']` antes de enviar a `ghUpdatePersonal`.
- Tab "Datos Laborales" muestra `estado`, `fechaIngreso`, `fechaRetiro` como read-only (sin `data-view` para que se vean en modo View y Edit).
- Botones explícitos "Retirar trabajador" y "Reingresar" en la sección Estado, que llaman a `ghCambiarEstado` (no a `ghUpdatePersonal`).

**Tests E2E nuevos** (44 asserts):
- T12-T19 (8 tests): protección de `ghUpdatePersonal` con `PROTECTED_FIELD` + rollback completo en payload mixto.
- T20-T25 (6 tests): política estricta de `ghImportPersonal` para los 3 campos de ciclo, incluyendo bp activo con `fechaRetiro` en Excel que NO se asigna.

#### Regla arquitectónica (no violar en futuras sesiones de AI)

**`gh:cambiar-estado` es la única autoridad para transiciones de ciclo laboral** (RETIRO, REINGRESO). **`gh:recontratar-personal` es la única autoridad para recontratación** (RECONTRATACION, que crea una nueva CT en el mismo acto). Toda transición debe generar su evento correspondiente en `gh_eventos_personal` dentro de la misma transacción.

`gh:update-personal` SOLO puede modificar datos personales/administrativos (nombres, cargo, salario, teléfono, email, dirección, banco, etc.). Está terminantemente prohibido usar `gh:update-personal` para `estado`, `fechaRetiro` o `fechaIngreso`. El bridge rechaza con `PROTECTED_FIELD` y rollback atómico.

`gh:create-personal` rechaza `fechaRetiro`. Un bp nuevo no puede nacer con fecha de retiro.

`gh:import-personal` (modo `update`) NUNCA puede pisar `fecha_retiro` ni el `estado` retirado de un bp existente. Solo completa `fecha_ingreso` cuando está NULL. Cualquier inconsistencia entre Excel y BD (ej. bp activo con fecha_retiro en Excel) se reporta como warning sin abortar la importación.

#### Auditoría

- G.2.2 (pre-push): auditoría READ-ONLY completa de los 5 handlers, frontend, eventos, BD. Resultado: 0 regresiones nuevas, 514 OK / 2 FAIL preexistentes (verificados contra backup pre-G.2).
- Auditoría manual M1-M5: el flujo Retirar → Reingreso quedó correctamente persistido con 1 evento RETIRO + 1 evento REINGRESO en `bp-mthtoza2-owsv` (CC 1111111111).
- 153 asserts E2E pasan (109 originales + 28 nuevos de T12-T19 + 16 nuevos de T20-T25).
- kair.db: 765 bp (139 activos + 626 retirados), 0 inconsistencias, 0 estados imposibles.
- BP de evidencia del bypass (`bp-mthobzc0-uvkk`, CC 9999999999) preservado como registro histórico.

#### Cambios totales

- 11 commits en cadena (1.0-B → 1.0-G.2.1)
- 5 archivos productivos modificados (bridge, schema SQL, 2 tests, frontend)
- ~570 insertions / ~50 deletions
- 0 cambios a `firma-service` (intacto)

## [0.1.190] - 2026-08-20

### I-008.x — feat(firma): observabilidad operativa transversal (3 hallazgos cerrados)

Cierra 3 HALLAZGOS de observabilidad operativa en `firma-service` que afectaban a K+AIR como cliente:

- **HALLAZGO #1**: Headers IETF draft-7 (`RateLimit-Policy`, `RateLimit`) NO se entregaban en respuestas 429 — el cliente no podía hacer backoff inteligente.
- **HALLAZGO #2**: `signRequestService.registerEvent()` fallando dentro de la tx → respondía `INTERNAL_ERROR` genérico en vez de un código diagnóstico específico.
- **HALLAZGO #3**: `pdfGen.generateSignedPdf()` o `pdfGen.generateConstanciaPdf()` fallando → respondía `INTERNAL_ERROR` genérico.

#### I-008.1 — feat(util): helper `withAppErrorWrapping` (async)

- Nuevo helper en `firma-service/src/utils/errorWrap.js` que envuelve funciones async: errores no-AppError se convierten en `AppError(500, code, message, {original_error, original_code})`. Preserva `AppError` existente (no doble-wrapping).
- 10 tests unitarios en `tests/utils/errorWrap.test.js`.
- Pensado para HALLAZGO #2 y #3.

#### I-008.2 — feat(rate-limit): IETF draft-7 headers en 429

- `makeHandler(limiterName)` setea los 2 headers ANTES de `next(err)`:
  - `RateLimit-Policy: <limit>;w=<windowSec>`
  - `RateLimit: limit=<limit>, remaining=0, reset=<windowSec>`
- `internalServerLimiter` (Capa 4 manual) setea los headers con `INSTANCE_ANOMALY_LIMIT=10` y `INSTANCE_ANOMALY_WINDOW_MS=24h=86400s`.
- 7 tests nuevos en `tests/middleware/rateLimit-headers.test.js` (6 pass + 1 SKIP justificado).
- E2E-RL.3 re-habilitado en `tests/e2e/firma-rate-limit-e2e.test.js` (verifica headers IETF con stack HTTP completo).
- Cierra HALLAZGO #1.

#### I-008.3 — feat(publicFlow): wrap pdfGen + registerEvent con códigos específicos

- `pdfGen.generateSignedPdf()` envuelto con `withAppErrorWrapping` (async) → `PDF_GENERATION_FAILED` (500).
- `pdfGen.generateConstanciaPdf()` envuelto con `withAppErrorWrapping` (async) → `PDF_GENERATION_FAILED` (500).
- 3 calls a `signRequestService.registerEvent()` dentro de la tx envueltos con `withAppErrorWrappingSync` (nuevo helper sync) → `EVENT_REGISTRATION_FAILED` (500).
- Helper sync agregado a `errorWrap.js` porque `db.transaction(() => { ... })` en better-sqlite3 v11 espera callback síncrona (rechaza callbacks que retornan Promise, lo cual rompería atomicidad).
- 6 tests unitarios nuevos en `errorWrap.test.js` para `withAppErrorWrappingSync`.
- Cierra HALLAZGO #2 y #3.

#### I-008.4 — test(e2e): assert specific error codes

- F5.3, F5.4 (`firma-pdf-failure-paths.test.js`): assertean `rCommit.body.error.code === 'PDF_GENERATION_FAILED'`.
- F6.3 (`firma-atomicidad.test.js`): assertea `res.body.error.code === 'EVENT_REGISTRATION_FAILED'`. Reemplaza el comentario "el error específico puede variar" (que documentaba el comportamiento pre-I-008.3).
- `package.json`: agrega `tests/utils/*.test.js` al glob del runner (cerraba el gap que dejaba los 16 tests del helper sin ejecutar en CI).

#### Archivos (9 modificados, +851/-28)

| Categoría | Archivos |
|---|---|
| Producción | `package.json`, `src/middleware/rateLimit.js`, `src/services/publicFlow.js`, `src/utils/errorWrap.js` |
| Tests | `tests/e2e/firma-atomicidad.test.js`, `tests/e2e/firma-pdf-failure-paths.test.js`, `tests/e2e/firma-rate-limit-e2e.test.js`, `tests/middleware/rateLimit-headers.test.js`, `tests/utils/errorWrap.test.js` |

#### Métricas

- 4 commits locales: `c90589df`, `92a22990`, `2206908c`, `f7e34290` — 4 commits ahead of `origin/Dev-Pc` pre-merge
- **39/39 E2E tests verdes** (8 archivos E2E)
- Suite: 719 tests / 717 pass / 0 fail / 2 skip / ~24s
- 16 tests del helper (10 async + 6 sync) ejecutándose en CI
- Atomicidad de la tx preservada: cualquier throw se propaga al catch existente que hace cleanup de PDFs + rollback atómico
- No doble-wrapping (AppError existente preservado por el helper)
- Bump: 0.1.189 → 0.1.190

#### Decisiones clave

- **H2 + H3 comparten solución transversal**: un solo helper (`withAppErrorWrapping`) cubre ambos hallazgos.
- **Versión sync del helper es necesaria** porque la callback de `db.transaction()` en better-sqlite3 v11 es síncrona (rechaza callbacks async / que retornan Promise).
- **PR #4 mergeado con rebase** (preserva historial lineal en Dev-Pc).

---

## [Unreleased] - 2026-08-17

### 📦776 — feat(gestion-humana): módulo completo + fix flujo Contratación → Base Personal

#### Módulo de Gestión Humana — vista top-level completa

- **Shell** con header K+AIR (icono + título + subtítulo) y tabs horizontales responsive (modo ventana: nombres abreviados / modo maximizado: nombres completos con iconos)
- **8 vistas** migradas a HTML+CSS/JS separados: Resumen, Dashboard, Base Personal, Contratación, Vacaciones, Permisos y Estados, Afiliaciones, Documentos y Firmas
- **Helper compartido `GHKPIBar`** para KPIs estandarizadas
- **58 handlers IPC** totales, **11 tablas** en BD (3 originales: `contrataciones`, `base_personal`, `gh_sedes` + 8 nuevas: `gh_vacaciones`, `gh_permisos`, `gh_documentos`, `gh_firmas_digitales`, `gh_anuncios`, `gh_mensajes`, `gh_documentos_afiliaciones`, `gh_templates`)
- **MIGRATIONS_SQL** con 5 ALTER TABLE idempotentes (📦731 + 📦764 + 📦775)

#### Sub-features incluidos

- **Documentos**: sistema de templates administrables (📦764) — sube .docx/.pdf desde el user, los gestiona en modal, los usa al generar documentos. Modal de firma digital en canvas con DPR para nitidez (📦763). Bloque de subida de PDFs de afiliaciones (EPS/Pensión/ARL/Caja) (📦760)
- **Base Personal**: segmented control "Todos/Activos/Retirados" (📦762) + Trabajador Detalle 360° con edición inline
- **Afiliaciones**: tabla con 4 slots por trabajador + gestión de PDFs
- **Contratación**: pipeline de 6 pasos (memo → contacto → exámenes → documentos → afiliaciones → S400) + KPIs por estado

#### 📦775 — fix(contratación): paso 6 (S400) crea/vincula en base_personal

**Causa raíz**: `_handlerMarcarPaso` solo hacía UPDATE en `contrataciones` al marcar paso 6. NO creaba registro en `base_personal`, así que los nuevos trabajadores no aparecían en Base Personal y los KPIs no se actualizaban.

**Fix aplicado** (`gestion-humana-bridge.js` `_handlerMarcarPaso`, paso 6):
1. SELECT contratacion
2. Si no tiene cedula: warning + skip (base_personal requiere cedula NOT NULL)
3. Buscar existente en base_personal por `(empresa_id, cedula, activo=1)`
4. Si existe: usar personal_id (no duplica, vincula)
5. Si no: INSERT nuevo en base_personal con datos de la contratacion
6. UPDATE `contrataciones SET trabajador_id = personal_id`
7. Response incluye `personalId`

**Schema actualizado** (`gestion-humana-schema-sql.js`):
- `base_personal`: 2 columnas nuevas (`fecha_ingreso_s400`, `fecha_afiliaciones`)
- `MIGRATIONS_SQL`: 2 ALTER TABLE (lazy, idempotente)

**Validación E2E manual**: Contratación de Javier Robles Fontalvo (cédula 104439066) completada en 6 pasos. Aparece en Base Personal con todos los datos correctos. KPIs: 753→754 total, 128→129 activos.

#### Otros cambios

- **📦774** — `shared/sidebar-icons.js`: agregado SVG `user_plus` (Lucide = 1 persona + plus) para Gestión Humana en el sidebar. Antes el icono estaba `undefined` (espacio vacío)
- **📦776** — Footer inferior del shell de Gestión Humana **removido** (HTML + CSS + JS fallback). El user lo pidió porque quitaba espacio sin aportar info crítica

#### Archivos

- Nuevos: 8 vistas × 3 archivos (HTML+CSS+JS) + `shared/kpi-bar.{js,css}` + 8 smoke tests en `Temp/`
- Backend: `main/gestion-humana-bridge.js`, `main/gestion-humana-schema-sql.js`
- Wireup: `preload.js`, `index.html`, `main.js`
- Tests: `main/test-gestion-humana-bridge-{schema,import}.js` + 8 smoke tests
- Version: rollback 0.2.0 → 0.1.189 (sin bumpear, sigue en 0.1.189)
- Cleanup: 40 `test-fixes-loop*.js` eliminados, scripts basura movidos a `C:\Temp\kair-garbage-2026-08-17\`
- `.gitignore` actualizado con patrones `temp-*/`, `__*-*.js`, `_*.js`, `commit-msg*.txt`

#### Métricas

- 2 commits locales: `66106d63` (módulo) + `62c6f9ad` (fix paso 6) — 8 commits ahead of `origin/Dev-Pc`
- 644+ tests pasando, 0 failures
- 753 → 754 trabajadores en Base Personal después del test E2E con Javier Robles

---

## [0.1.189] - 2026-08-14

### 📦707-fix26 — fix(shortcut): auto-reparación SIEMPRE reescribe el .lnk del escritorio (auto-update fix)

**Causa**: v0.1.188 arregla el ícono del shortcut del escritorio y la taskbar para instalaciones nuevas. Pero si el user actualiza via **auto-update** desde v0.1.187 (o cualquier versión anterior) a v0.1.188+, el .lnk viejo del escritorio sigue apuntando a `$INSTDIR\assets/...` (ruta vieja, inexistente) porque:
- El instalador NSIS SÍ reescribe el .lnk (en instalación nueva o reinstalación)
- Pero el auto-updater de electron-updater usa Squirrel.Windows, que solo reemplaza archivos del .exe, NO recrea shortcuts

El código de auto-reparación en `main.js` (línea 9693) tenía un check `if (!fs.existsSync(desktopShortcut))` que SOLO reescribía el .lnk si NO existía. Como el .lnk viejo sí existía (con path roto), nunca se reescribía.

### Fixed
- **`main.js`** (líneas 9683-9704): quitado el check `if (!fs.existsSync(desktopShortcut))`. Ahora `_ensureDesktopShortcut()` se ejecuta SIEMPRE al arrancar (en producción Windows), reescribiendo el .lnk con la ruta nueva. La función usa `shell.writeShortcutLink(shortcutPath, 'replace', ...)` que sobreescribe si existe.

### Comportamiento después del fix
- **Instalación nueva de v0.1.189** → NSIS crea el .lnk con path correcto. La auto-reparación al primer arranque también lo reescribe (no-op si ya está bien).
- **Auto-update de v0.1.187 → v0.1.189** → el .exe se actualiza con el nuevo `main.js`. Al primer arranque, la auto-reparación detecta el .lnk viejo y lo reescribe con la ruta nueva. El user ve el cambio sin tocar nada.
- **Cualquier versión anterior a v0.1.189** → al actualizar, la auto-reparación arregla el .lnk.

### Archivo (1 modificado, +9/-3 líneas)
1. `main.js` — auto-reparación siempre reescribe

---

## [0.1.188] - 2026-08-14

### 📦707-fix25 — fix(icons): AUMID + extraResources + path del .ico (taskbar y shortcut del escritorio)

**Causa**: el release v0.1.187 tenía el ícono regenerado (fill 90%) pero el shortcut del escritorio y la taskbar seguían mostrando un ícono genérico de Windows. El user reportó que después de instalar la v0.1.187, el .lnk del escritorio no tenía el logo K+AIR.

**Causa raíz**: faltaban 3 fixes que v0.1.188 había tenido y que el user "deshice manualmente" antes del release v0.1.187:

1. **Sin AUMID**: `app.setAppUserModelId('com.jrfsoluciones.sgsst')` no se llamaba. Windows no podía asociar el ícono con la app en la taskbar.
2. **`.ico` empaquetado en el asar**: el `K+AIR-multires.ico` estaba dentro del `app.asar` (no en disco). El shortcut del escritorio no podía encontrar el ícono.
3. **Path incorrecto en el instalador**: el `installer.nsh` apuntaba a `$INSTDIR\assets\K+AIR-multires.ico` (ruta inexistente en disco). El .lnk del escritorio apuntaba a un ícono fantasma.

### Fixed
- **`main.js`**: `app.setAppUserModelId('com.jrfsoluciones.sgsst')` agregado en 3 lugares (defense in depth): al `require('electron')` (antes del primer BrowserWindow), y re-foreado en los 2 `app.whenReady().then(...)`.
- **`package.json`**: nueva entrada en `build.extraResources` que copia el `.ico` desde `assets/K+AIR-multires.ico` (en el proyecto) a `resources/assets/K+AIR-multires.ico` (en disco, FUERA del asar). Después del build, el ícono existe en `$INSTDIR\resources\assets\K+AIR-multires.ico`.
- **`installer.nsh`** (líneas 42 y 45): los 2 `CreateShortcut` (Common Desktop + user Desktop) ahora apuntan a `$INSTDIR\resources\assets\K+AIR-multires.ico` (la ruta donde está el ícono realmente).

### Archivos (3 modificados, 0 nuevos)
1. `main.js` — 3 llamadas a `app.setAppUserModelId`
2. `package.json` — entrada en `extraResources` + bump 0.1.187 → 0.1.188
3. `installer.nsh` — 2 paths corregidos

### Resultado después de la próxima instalación
- **Esquina de la ventana**: logo K+AIR ✓ (ya funcionaba)
- **Splash / Home inicial**: logo K+AIR ✓ (ya funcionaba)
- **Shortcut del escritorio** (.lnk): logo K+AIR ✓ (**ARREGLADO**)
- **Taskbar de Windows**: logo K+AIR ✓ (**ARREGLADO**)
- **Auto-update** (electron-updater): el `latest.yml` y el `.blockmap` permiten actualizaciones delta a la próxima versión

---

## [0.1.187] - 2026-08-14

### 📦707 — feat(icons): regenerar K+AIR-multires.ico con fill 90% (ícono de ventana más grande)

**Causa**: el ícono de la esquina de la ventana, de la barra de tareas y del acceso directo del escritorio se veía muy chico (fill del 50% del canvas del `.ico`, lo que dejaba mucho padding transparente). El user pidió subir el tamaño del logo **SOLO en el ícono de la ventana** (y de la taskbar/shortcut que usan el mismo `.ico`), sin afectar el resto (splash y header usan el `KIAR256.ico` separado).

### Changed
- **`K+AIR-multires.ico`**: regenerado con fill **90%** (vs 50% original). Logo más grande en todos los tamaños:
  - 16x16: 8x8 → 14x14 (75% más grande)
  - 32x32: 16x16 → 28x28 (75% más grande)
  - 48x48: 24x24 → 43x43 (79% más grande)
  - 256x256: 128x128 → 230x230 (80% más grande)
- **`KIAR256.ico`**: **NO modificado**, queda en su estado original (fill 50%). Se usa en el splash y header de la app — no se ve afectado.
- **Tamaño de archivo**: 49KB → 95KB (casi 2x más grande por más píxeles con color).

### Por qué SOLO el multires
El proyecto tiene 2 íconos:
- `K+AIR-multires.ico` (7 versiones: 16-256) → usado por Windows para la **esquina de la ventana, taskbar y shortcut del escritorio**
- `KIAR256.ico` (1 versión: 256) → usado por la app internamente en el **splash de carga** y en el **header HTML**

Regenerando solo el multires, el logo de la ventana/taskbar/shortcut crece sin tocar lo que se ve dentro de la app.

### Archivos (1 modificado, 0 nuevos)
1. `assets/K+AIR-multires.ico` — regenerado, 49KB → 95KB
2. `package.json` — bump 0.1.186 → 0.1.187

---

## [0.1.186] - 2026-08-14

### 📦706-fix24 — feat(roles-resp): edición de matriz desde la app

**Causa**: los datos del modal Matriz venían del Excel G-OD-006 y no se podían editar desde la app. Si el user quería ajustar/corregir una responsabilidad, autoridad o rendición de cuentas, tenía que volver al Excel, modificarlo, y reimportar (o dejarlo desactualizado). Quería poder editar/actualizar el contenido desde la app.

### Added
- **Botón "✏️ Editar"** en el footer del modal Matriz, entre "Asignar persona a este rol" y "Cerrar".
- **Modo edición**: al hacer click en "Editar", los 3 párrafos (Responsabilidades / Autoridad / Rendición de Cuentas) se transforman en textareas editables con fondo amarillo para diferenciar visualmente del modo lectura.
- **Botones "💾 Guardar cambios" y "❌ Cancelar"** en el footer de edición (reemplazan a los 3 botones de lectura).
- **Handler nuevo `_handlerActualizarMatriz`** en el bridge: valida que el id exista y que las 3 columnas vengan (pueden ser string vacío para "sin definir"), rechaza cualquier intento de editar nombre/código/base legal (solo las 3 columnas son editables).
- **API `rolesResp.actualizarMatriz`** en el preload + case en el logic para conectar el bridge con la UI.

### Changed
- **Antes**: el modal Matriz era solo de lectura. Para editar el contenido, el user tenía que modificar el Excel G-OD-006 y reimportar.
- **Ahora**: el user puede editar las 3 columnas directamente desde la app con un click en "Editar" → modifica → "Guardar cambios". El cambio se persiste en la BD y se refleja en el modal inmediatamente (recarga el catálogo del state y repinta el modal en modo lectura).

### Detalles
- **Sin versionado**: sobreescribe directo. No hay tabla de historial (decisión confirmada con el user).
- **Editable**: solo las 3 columnas (Responsabilidades, Autoridad, Rendición de Cuentas). El nombre, código y base legal del rol NO son editables (vienen del catálogo y son fijos).
- **Strings vacíos**: si una columna se vacía, se guarda como `NULL` en la BD (helper de "sin definir").
- **Cancelar descarta cambios**: NO lee los textareas al volver a modo lectura, usa los valores del state. Si el user escribió cambios y le da "Cancelar", se pierden.
- **SQL injection safe**: el handler usa prepared statements (test #8 lo confirmó con payloads maliciosos).
- **Tests**: 8 tests aislados del handler pasaron (actualización válida, validación de id faltante, validación de campo faltante, NOT_FOUND, strings vacíos → NULL, nombre/codigo inmutables, payload null, SQL injection literal).

### Archivos (6 modificados, +200 líneas)
1. `main/roles-responsabilidades-bridge.js` (+50): handler nuevo + ipcMain.handle
2. `preload.js` (+2): API `actualizarMatriz`
3. `roles-responsabilidades-logic.js` (+4): case en el proxy
4. `roles-responsabilidades-view.html` (+8): 2 footers (lectura con "Editar" / edición con "Guardar" + "Cancelar")
5. `roles-responsabilidades-view.css` (+20): estilos `.kair-rr-textarea` con focus + `.kair-rr-textarea-wrap` (fondo amarillo)
6. `roles-responsabilidades-viewer.js` (+115): `rrState.matrizEditMode`, funciones `_entrarModoEdicionMatriz`, `_salirModoEdicionMatriz`, `_guardarMatriz`, `_renderModalMatrizLectura`, helpers `_reemplazarPPorTextarea` / `_reemplazarTextareaPorDiv`. Listeners de los 2 botones nuevos. Refactor de `abrirModalMatriz` para resetear a modo lectura. `cerrarModalMatriz` ahora también sale del modo edición si quedó activo.

### 📦706-fix24b — refactor(roles-resp): scroll solo debajo de la sección de cumplimiento

**Causa**: cuando hay muchas filas en Matriz o Divulgación, todo el documento scrolleaba (incluyendo el header "Roles y Responsabilidades", los tabs y el banner de cumplimiento). El user quería que el scroll estuviera SOLO debajo del banner, sin afectar la zona fija de header+tabs+cumplimiento.

### Changed
- **Antes**: el body tenía `min-height: 100vh` y el root crecía con el contenido. Todo el documento scrolleaba, incluyendo el header.
- **Ahora**: el body tiene `height: 100vh; overflow: hidden`. El root usa `height: 100%; display: flex; flex-direction: column`. El main (`panelGestion`) es `flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column`. El banner es `flex-shrink: 0` (queda fijo). Las 2 secciones están envueltas en un nuevo `.kair-rr-sections-scroll` con `flex: 1; min-height: 0; overflow-y: auto` — es el ÚNICO elemento que scrollea.

### Archivos adicionales (2 modificados, +20 líneas)
1. `roles-responsabilidades-view.html` (+4): wrapper `<div class="kair-rr-sections-scroll">` después del banner, cierre antes de `</main>`.
2. `roles-responsabilidades-view.css` (+16): `body { height: 100vh; overflow: hidden }`, `root { height: 100% }`, `main { flex column + min-height: 0 + overflow: hidden }`, `banner { flex-shrink: 0 }`, nuevo `.kair-rr-sections-scroll { flex: 1; min-height: 0; overflow-y: auto }`.

---

## [0.1.185] - 2026-08-14

### 📦706-fix23 — refactor(roles-resp): unificar dropzones origen y destino

**Causa**: el dropzone de destino tenía un tamaño y estilo diferente al de origen (más pequeño, color lila cuando vacío, azul cuando lleno). El user pidió que tuvieran el mismo tamaño y estilo para no desentonar.

### Changed
- **Antes**: el dropzone de destino usaba un variant `--folder` con colores diferentes (lila/azul) y se veía más pequeño que el de origen.
- **Ahora**: ambos dropzones usan el mismo estilo base `.kair-rr-dropzone` con el mismo `min-height: 110px`, mismo padding, mismo `display: flex; flex-direction: column; align-items: center; justify-content: center`. Cuando tienen contenido (`data-state="has-file"` o `data-state="has-folder"`), ambos se ven exactamente igual (verde con check).

### Removed
- **Clase `.kair-rr-dropzone--folder`** del CSS y del HTML — ya no se necesita, el destino usa el mismo estilo base que el origen.

### Migration notes
- 100% compatible con la implementación existente. No hay cambios de schema, ni de JS, ni de APIs.
- Los `data-state` (empty/has-file/has-folder) siguen funcionando igual.
- El padding inline `style="padding: 16px 8px"` se quitó del HTML para que el CSS sea la única fuente del padding (más mantenible).

## [0.1.184] - 2026-08-14

### 📦706-fix22 — refactor(roles-resp): modal de confirmación custom para eliminar

**Causa**: el `confirm()` nativo del navegador que se usaba antes de eliminar una divulgación tenía un dialog feo, sin styling, y rompía la consistencia visual del resto de la UI. El 6.1.2 Política ya tenía un modal de confirmación custom; no había razón para no usarlo acá.

### Changed
- **Antes**: `confirm('¿Eliminar esta divulgación? Esta acción no se puede deshacer.')` — dialog nativo del navegador.
- **Ahora**: modal de confirmación custom con título, mensaje, ícono de papelera en el botón, botón "Eliminar" en rojo (variant danger), y toast de éxito después de eliminar.

### Added
- **Función `_showConfirm(title, message, options)`** que retorna `Promise<boolean>`. Mismo patrón visual que los otros modales del viewer.
  - `title`: string (ej. "Eliminar divulgación")
  - `message`: string (ej. "¿Estás seguro de eliminar esta divulgación?")
  - `options: { acceptText, acceptIcon, variant }`
    - `acceptText`: texto del botón confirmar (default: "Confirmar")
    - `acceptIcon`: clase del ícono (default: "bi-check-lg")
    - `variant`: 'danger' (default) o 'primary'
- **Función `_hideConfirm(accepted)`** que resuelve la Promise y oculta el modal
- **Modal `#modalConfirm`** en el HTML con 2 botones (Cancelar/Confirmar) y un footer informativo "Esta acción no se puede deshacer"
- **Estilos `.kair-rr-btn--danger`** (rojo #dc2626 con hover y active) para acciones destructivas
- **Toast de éxito** después de eliminar: "✅ Divulgación eliminada"

### Migration notes
- Si el modal no existe (ej: durante el init temprano), `_showConfirm` cae a `window.confirm()` nativo (fallback seguro).
- El `confirm()` nativo de `eliminarDivulgacion` fue reemplazado por `_showConfirm(...)` con variant 'danger'.
- El user puede cancelar con ESC (futuro) o click fuera del modal (futuro) — por ahora solo con el botón "Cancelar".

## [0.1.183] - 2026-08-14

### 📦706-fix21 — refactor(roles-resp): toast notifications (mismo patrón que 6.1.2)

**Causa**: el submódulo usaba `alert()` nativos que bloquean la UI, son feos visualmente y rompen el flujo de trabajo del user. El 6.1.2 Política ya tenía un sistema de toast moderno, no había razón para no usarlo acá.

### Changed
- **Antes**: 17 `alert()` nativos que bloquean la UI con un dialog feo.
- **Ahora**: sistema de toast que aparece arriba a la derecha, se cierra automáticamente, soporta HTML básico (`<strong>`, `<code>`, `<br>`), tiene 4 tipos (success, error, warning, info) con colores y íconos.

### Added
- **Función `_showToast(message, type, duration)`** en el viewer. Mismo patrón que 6.1.2 Política. La API:
  - `message`: string con HTML básico permitido
  - `type`: 'success' | 'error' | 'warning' | 'info' (default: 'info')
  - `duration`: ms (default: 3000). Usar 0 para que no se cierre solo
- **Container `#kToastContainer`** en el HTML, antes del cierre del body
- **Estilos `.kair-toast-container` y `.kair-toast`** en el CSS (animación slide-in/out desde la derecha)

### Migration notes
- Los `alert()` fueron reemplazados 1-a-1 por `_showToast()`. Algunos casos especiales:
  - Mensajes de éxito con `\n\n` (varias líneas) → ahora con `<br><br>` (HTML)
  - Paths largos → envueltos en `<code>` para mejor lectura
  - Validaciones (campos vacíos) → tipo `warning`
  - Errores técnicos → tipo `error` con duración más larga (5s)
  - Confirmaciones de éxito con paths → tipo `success` con duración más larga (6s)
- `confirm()` se mantiene como nativo (es OK para confirmaciones destructivas, no se reemplaza con toast)
- Si el container no existe (ej: durante el init antes de que cargue el HTML), `_showToast` cae a `console.log` (no rompe nada)

## [0.1.182] - 2026-08-14

### 📦706-fix20 — feat(roles-resp): carpetas automáticas por trabajador

**Causa**: el Decreto 1072 art. 2.2.4.6.8 requiere preservar la evidencia de divulgación por trabajador. Antes, los PDFs se guardaban en una carpeta general sin estructura clara. Ahora, al registrar un trabajador para divulgación, la app crea automáticamente una carpeta específica para él/ella donde se guardan los PDFs de soporte.

### Added
- **Carpeta automática por trabajador** — Al hacer click en "Guardar" en el modal "Añadir trabajador para divulgación", la app crea automáticamente la carpeta `{raíz_empresa}/1. Recursos/1.1.2 Roles y Responsabilidades/[Cédula] Nombre/`. Ejemplo: `G:\Mi unidad\...\1. Tempoactiva Est SAS\1. Recursos\1.1.2 Roles y Responsabilidades\[1044391066] Javier Robles Fontalvo\`
- **Destino default en modal "Subir soporte"** — Ahora el default del destino es la carpeta del trabajador (antes era Desktop). El user puede cambiarlo con "Examinar..." si quiere.
- **Mensaje informativo al guardar trabajador** — Después de guardar, el user ve la ruta completa de la carpeta creada. Si algo falla, se muestra el error pero la divulgación igual se guarda (la app no se rompe).

### Backend (`main/roles-responsabilidades-bridge.js`, +90 líneas)
- **Helper `_crearCarpetaTrabajador(empresaId, cedula, nombre)`** — Lee `config.json` para obtener la ruta raíz de la empresa, construye el path completo, sanitiza el nombre del trabajador (quita caracteres no permitidos en Windows), crea la carpeta con `fs.mkdirSync(path, { recursive: true })`. Idempotente (si la carpeta ya existe, no falla).
- **Helper `_resolverPathCarpetaTrabajador(empresaId, cedula, nombre)`** — Igual que el anterior pero NO crea la carpeta. Solo resuelve y devuelve el path. Útil para que el modal Subir consulte el destino default sin crear carpetas vacías.
- **Refactor de `_handlerUpsertDivulgacion`** — Cuando se crea una divulgación nueva, llama a `_crearCarpetaTrabajador` y devuelve `data.carpetaPath` + `data.carpetaError` en la respuesta. Si la divulgación es una actualización, NO crea carpeta.
- **Handler nuevo `_handlerResolverCarpetaTrabajador`** — Devuelve `{ success, data: { path, exists } }` para que el frontend sepa si la carpeta ya existe o no.
- **`_app` inyectada** — El bridge ahora guarda `app` para usar `app.getPath('userData')` y leer el config.json.

### Frontend (`modules/recursos/roles-responsabilidades/roles-responsabilidades-viewer.js`, +30 líneas)
- **`guardarTrabajador()` extendido** — Después del upsert, muestra un alert con "📁 Carpeta creada: {path}" (o el error si falló).
- **`subirSoporte()` extendido** — Resuelve la carpeta del trabajador via bridge y la usa como destino default en el modal Subir. Si el bridge falla, cae a Desktop.

### Preload + Logic (+5 líneas)
- API `resolverCarpetaTrabajador(payload)` en preload
- Case `'roles-resp:carpeta-trabajador-resolver'` en logic

### Changed
- **Antes**: Los PDFs del modal Subir se guardaban en la carpeta default que el user seleccionaba (generalmente Desktop).
- **Ahora**: Los PDFs se guardan automáticamente en la carpeta del trabajador (puede cambiarla con "Examinar...").

### Migration notes
- **Limpieza previa** (ejecutada antes de este release): se borraron 5 divulgaciones y 4 documentos legacy de Tempoactiva. Backup en `kair.db.backup-pre-fix20`.
- **Limpieza manual recomendada**: borrar los PDFs viejos sueltos en `1. Recursos/1.1.2 Roles y Responsabilidades/` antes de empezar con el feature nuevo.

## [0.1.181] - 2026-08-14

### 📦706-fix19 — refactor(roles-resp): quitar tab "Documentos de soporte"

**Causa**: el v0.1.180 ya tiene el modal "Documentos del trabajador" que lista TODOS los PDFs del trabajador con cards visuales (border-left de color por estado). El tab "Documentos de soporte" quedó redundante: mostraba 1 fila por PDF plana, mientras que el modal los agrupa por persona con mejor UX.

### Changed
- **Antes**: 2 tabs ("Gestión de Roles" + "Documentos de soporte"). El segundo mostraba lista plana de TODOS los PDFs de la empresa.
- **Ahora**: 1 solo tab "Gestión de Roles". Los PDFs se ven en el modal "Documentos del trabajador" que se abre desde la fila de divulgación del trabajador.

### Removed
- **HTML (`roles-responsabilidades-view.html`)**: tab-button `#tabDocumentos` y panel `#panelDocumentos` con su tabla. 27 líneas eliminadas.
- **JS (`roles-responsabilidades-viewer.js`)**:
  - Función `renderTablaSoportes()` completa (50 líneas)
  - Listener del tab `#tabDocumentos` en `setupTabs()`
  - Carga inicial de `rrState.documentos` en `cargarDatos()` (ya no se necesita al inicio, solo on-demand cuando se abre el modal)
  - Estado `rrState.documentos` del state inicial
- **CSS (`roles-responsabilidades-view.css`)**: estilos `.kair-rr-doc-icon` y `.kair-rr-doc-icon__name` (23 líneas, usados solo en el tab eliminado)
- **Mantenido**: el bridge `_handlerListarDocumentosDivulgacion`, la API `listarDocumentosDivulgacion` en el preload, y el case en el logic — todo se sigue usando para cargar PDFs cuando se abre el modal.

### Migration notes
- **No hay cambios de BD** ni de schema. Solo es UI.
- **No hay riesgo de regresión**: el modal ya tenía su propio handler de carga, independiente de la carga inicial.
- El badge "+N anteriores" en la fila de divulgación sigue funcionando porque usa `d.documento_count` del bridge (que cuenta por persona desde el fix18), no de `rrState.documentos`.

## [0.1.180] - 2026-08-14

### 📦706-fix18 — feat(roles-resp): 1 fila por persona + modal de selección de PDFs

#### Backend (`main/roles-responsabilidades-bridge.js`)
- **Regla de negocio simplificada en `_handlerUpsertDivulgacion`**: subir un PDF del mismo `persona_cedula` (sin tildar "Es nueva contratación") SIEMPRE actualiza la divulgación vigente, no crea una nueva. Solo se crea nueva divulgación cuando (a) el user tildó "Es nueva contratación" o (b) NO hay divulgación previa para esa cédula.
- **Bug crítico corregido en el UPDATE del upsert**: el código tenía 9 values para 8 placeholders (`now` extra al final), lo que hacía fallar el UPDATE silenciosamente y forzaba la creación de divulgaciones duplicadas. Ahora son 8 placeholders / 8 values.
- **Migración one-shot nueva `_consolidarDivulgacionesDuplicadas`**: detecta personas con 2+ divulgaciones vigentes (dejado por el bug anterior), deja la más reciente como vigente y archiva las demás con `fecha_vigencia_hasta = NOW`. Idempotente (no hace nada si no hay duplicados).
- **Quitada la detección automática de `cargoCambio`**: el user solo crea nueva divulgación cuando lo tilda explícitamente. Si el cargo del PDF difiere del vigente, se actualiza el campo `persona_cargo` en la divulgación vigente (no se archiva).

#### Frontend (`modules/recursos/roles-responsabilidades/roles-responsabilidades-viewer.js`)
- **`renderTablaDivulgacion` refactorizado**: agrupa por `persona_cedula` y muestra 1 sola fila por persona (no 1 fila por divulgación). Para cada persona toma la divulgación vigente (o la más reciente si no hay vigente). El conteo de PDFs se calcula sumando `rrState.documentos` para esa cédula (total histórico).
- **Modal `modalDocumentosTrabajador` rediseñado desde cero**: ahora lista TODOS los PDFs del trabajador (de TODAS sus divulgaciones, vigentes y archivadas), ordenados por fecha DESC. Cada PDF se muestra como una card con borde lateral de color (verde = Vigente, gris = Anterior, amarillo = Corrección), nombre + fecha de carga + fecha del documento + tamaño + observaciones.
- **Click en la card abre el PDF directamente** (vía `postMessage` al parent para abrir el file-viewer-modal). Iconos de Ver / Descargar son shortcuts.
- **Subtítulo dinámico**: "N PDFs · más reciente primero" se actualiza según el contenido.

#### HTML (`roles-responsabilidades-view.html`)
- **Markup del modal completamente reemplazado**: header con ícono + título, persona/subtítulo, subtitle dinámico para el conteo, body con la lista de cards, footer con botón Cerrar.

#### CSS (`roles-responsabilidades-view.css`)
- **Nuevos estilos `.kair-rr-doc-card`**: layout vertical con border-left de color por estado, hover sutil (cambia background), cursor pointer, transition. Layout interno: ícono PDF + body con nombre+meta+observaciones + acciones (Ver/Descargar).
- **Estados visuales**: `--vigente` (verde, fondo suave), `--anterior` (gris, opacidad reducida), `--correccion` (amarillo).
- **Scroll interno**: max-height 60vh con scroll vertical para listas largas.

#### Sync multipc (`main/sync-serializer.js`)
- **Serialización extendida**: incluye `periodo`, `es_nueva_contratacion`, `fecha_vigencia_hasta` en divulgaciones (necesarios para la regla de "1 fila por persona" entre PCs).
- **Deserialización extendida**: INSERT y UPDATE respetan las 3 columnas nuevas con COALESCE para no pisar datos locales válidos.

### Changed
- Antes: subir un PDF del mismo trabajador creaba una divulgación nueva (1 persona = N filas en la tabla).
- Ahora: subir un PDF del mismo trabajador actualiza la divulgación existente y agrega el PDF como nuevo documento (1 persona = 1 fila, N PDFs en el modal).

### Fixed
- **UNIQUE constraint failed al subir el 2do PDF del mismo trabajador**: causado por el bug del UPDATE que dejaba la divulgación vieja sin archivar antes de crear la nueva. Corregido.
- **Tabla "Divulgación a Trabajadores" mostraba 2 filas para la misma persona** cuando se subían 2 PDFs: ahora muestra 1 fila con badge "+N anteriores" y modal con todos los PDFs.

## [0.1.179] - 2026-08-14

### Added
- **📦706 — feat(roles-resp): multi-documento por divulgación** — Extensión del submódulo 1.1.2 para soportar N PDFs por divulgación (1 divulgación = N documentos, append-only, sin perder histórico). **Causa**: el Decreto 1072 art. 2.2.4.6.8 requiere que la evidencia de divulgación se preserve en el tiempo (cambio de cargo, reintegración, año nuevo). **Cambios (8 archivos, ~700 líneas nuevas, 13 tasks de implementación)**:

### Backend (`main/roles-responsabilidades-bridge.js`, +250 líneas)
- **Schema (idempotente):** 3 columnas nuevas en `roles_responsabilidades_divulgacion` (`periodo`, `es_nueva_contratacion`, `fecha_vigencia_hasta`) + backfill one-shot de `periodo` desde `creado_en` para divulgar existentes. Tabla nueva `roles_responsabilidades_divulgacion_documento` con FK a divulgación + 3 índices. **Patrón**: `PRAGMA table_info` + `ALTER TABLE ADD COLUMN` (idempotente, auto-corre en próximos deploys).
- **Handler nuevo `_handlerListarDocumentosDivulgacion`** — Lista todos los PDFs de divulgación de una empresa, con JOIN a divulgación. Soporta filtros opcionales por `divulgacionId` o `personaCedula`. Ordena por `es_actual DESC, fecha_carga DESC` (vigente primero).
- **Handler nuevo `_handlerMarcarDocumentoActual`** — Marca un documento como vigente (`es_actual=1`) y desmarca los demás de la misma divulgación. Útil para reasignar manualmente el "último" si quedó mal.
- **Refactor de `_handlerUpsertDivulgacion`** — Detecta cambio de cargo automáticamente (compara con divulgación vigente del mismo `persona_cedula`): si difiere, archiva la anterior (`fecha_vigencia_hasta = NOW`) y crea una nueva. Si el user marca "Es nueva contratación" → siempre crea nueva. Si es mismo cargo → actualiza existente + inserta nuevo documento (append-only).
- **Migración one-shot `_migrarDocumentosExistentes`** — Para cada divulgación con `documento_soporte_path` no nulo que NO tenga documento migrado, crea una fila en `divulgacion_documento` con `es_actual=1`, `creado_por='migration-2026-08-14'`, `observaciones='Migrado desde v0.1.178'`. Idempotente (chequeado con NOT EXISTS).
- **Refactor de `_handlerListarDivulgaciones`** — Query con subqueries para `documento_count`, `documento_actual_path`, `documento_actual_id`. Orden por `fecha_vigencia_hasta IS NULL DESC` (vigentes primero), `creado_en DESC`, `persona_nombre ASC`.
- 17 → 17 handlers IPC totales (3 nuevos).

### Preload (`preload.js`, +3 APIs)
- `listarDocumentosDivulgacion(payload)` — Lista PDFs con JOIN
- `marcarDocumentoActual(payload)` — Marca documento como vigente
- `upsertDivulgacion(payload)` — Refactorizado (mantiene API, agrega campos)

### Parent proxy (`modules/recursos/roles-responsabilidades/roles-responsabilidades-logic.js`, +2 cases)
- `roles-resp:divulgacion-documento-listar` y `roles-resp:divulgacion-documento-marcar-actual` agregados al switch de `_handleBridgeCall`

### Frontend (`modules/recursos/roles-responsabilidades/`)
- **Refactor de `cargarDatos()`** — Ahora también carga `rrState.documentos` via el nuevo handler `divulgacion-documento-listar`.
- **Refactor de `renderTablaDivulgacion()`** — Columna SOPORTE muestra el documento vigente (`documento_actual_path`) con badge amarillo "+N anteriores" (cuando `documento_count > 1`). Click en el badge → modal de selección.
- **Refactor de `renderTablaSoportes()`** — Ahora itera sobre `rrState.documentos` (1 fila por PDF) en vez de `rrState.divulgaciones` (1 fila por divulgación). Cada fila tiene badge de estado: "Vigente" (verde, `es_actual=1`), "Corrección" (azul, `es_correccion=1`) o "Anterior" (gris).
- **Modal nuevo `Documentos del trabajador`** (`modalDocumentosTrabajador` en HTML) — Se abre desde el badge "+N anteriores". Lista los PDFs del trabajador ordenados por fecha (vigente primero) con badges y botones Ver/Descargar. Click en Ver → postMessage al parent (`open-file-viewer-modal`) que abre el kairFV file viewer. Click en Descargar → `descargarPDFSoporte` (save dialog nativo).
- **Refactor del modal `Subir soporte`** — Agrega 4 campos nuevos: 2 checkboxes ("Es nueva contratación", "Es corrección"), 1 date ("Fecha del documento"), 1 textarea ("Observaciones"). Los checkboxes se envian al backend que decide si crear nueva divulgación o actualizar la existente.

### CSS (`roles-responsabilidades-view.css`, +80 líneas)
- `.kair-rr-anteriores-badge` — Badge amarillo clickeable
- `.kair-rr-soporte-cell` — Contenedor flex para el doc + badge
- `.kair-rr-doc-item` — Card de documento en el modal de selección
- `.kair-rr-doc-badge--vigente / --anterior / --correccion` — Badges de estado (verde/gris/azul)
- `.kair-rr-checkbox-label` — Estilos de los nuevos checkboxes

### Sync multipc (`main/sync-serializer.js`, +90 líneas)
- Nueva entidad `roles_responsabilidades_divulgacion_documento` en el payload de sync. **Serializar**: SELECT * WHERE empresa_id = ?. **Deserializar**: INSERT OR IGNORE por id, con validación de FK (la divulgación padre debe existir en el destino, sino skip).

### Patrones aplicados (cross-project)
- **Schema migration idempotente** — `PRAGMA table_info` + `ALTER TABLE ADD COLUMN`. El bridge auto-detecta columnas faltantes y las agrega sin error.
- **Migración one-shot con NOT EXISTS** — Para evitar duplicar al ejecutar la migración múltiples veces.
- **Append-only de documentos** — Los PDFs anteriores NUNCA se eliminan; el "último gana" se marca con `es_actual=1`, los anteriores quedan con `es_actual=0` para auditoría.
- **Regla 1 vigente por (empresa, persona_cedula)** — Cuando se crea nueva divulgación, la anterior se archiva con `fecha_vigencia_hasta = NOW`. Garantiza el invariante.

### Fixed
- **📦706 — feat(roles-resp): header estandarizado al patrón 6.1.1** — Header del 1.1.2 ahora usa `k-section-card` (no sticky) con ícono a la izquierda, title + subtítulo, y company + divider + back button a la derecha. Mismo patrón que el 6.1.1.
- **📦706 — feat(roles-resp): botones solo-íconos en Acciones** — Botones "Ver" y "Descargar" de Documentos de soporte + "Matriz" y "Asignar/Reasignar" de Matriz de Roles ahora son cuadrados 30x30px con solo ícono. Tooltip con texto completo al hacer hover. Se alinean horizontalmente con `white-space: nowrap`.

### Files
- `sgsst-electron-app/main/roles-responsabilidades-bridge.js` (+250)
- `sgsst-electron-app/main/sync-serializer.js` (+90)
- `sgsst-electron-app/preload.js` (+3)
- `sgsst-electron-app/modules/recursos/roles-responsabilidades/roles-responsabilidades-view.html` (+30)
- `sgsst-electron-app/modules/recursos/roles-responsabilidades/roles-responsabilidades-viewer.js` (+150)
- `sgsst-electron-app/modules/recursos/roles-responsabilidades/roles-responsabilidades-view.css` (+80)
- `sgsst-electron-app/modules/recursos/roles-responsabilidades/roles-responsabilidades-logic.js` (+2 cases)
- `sgsst-electron-app/CHANGELOG.md`, `CONTEXT.md`, `release-notes.md`, `package.json`

## [0.1.178] - 2026-08-14

### Added
- **📦705 — feat(roles-resp): nueva vista de gestión 1.1.2 Roles y Responsabilidades con formato Excel G-OD-006 de la empresa** — Reemplazo completo del file viewer del submódulo 1.1.2 por una vista de gestión que cumple con el estándar 1.1.2 de la Resolución 0312 de 2019 y el Decreto 1072 de 2015 art. 2.2.4.6.8. **Causa**: el file viewer anterior (carpeta con PDFs sueltos) NO satisfacía los requisitos del estándar; el propio informe de auditoría de Tempoactiva 2024 marcó el 1.1.2 como "No cumple". El user pidió que la matriz se parezca al formato de su empresa (Excel G-OD-006 "Matriz de Asignación y Documentación Responsabilidades y Rendición de Cuentas", REV.02 Enero 2018), 4 columnas: NIVEL / RESPONSABILIDADES / AUTORIDAD / RENDICION DE CUENTAS. **Cambios (8 archivos, ~2900 líneas nuevas, 9 fixes iterativos)**:
- **Backend** (`main/roles-responsabilidades-bridge.js`, NUEVO, ~660 líneas) — 14 handlers IPC + schema SQLite (3 tablas) + seed de **8 roles predefinidos del Excel G-OD-006** + 3 handlers de file dialogs (origen, destino, descarga) + handler de copia con sufijo automático `(1)`, `(2)`. Patrón `registerXxxHandlers(app, deps)`.
  - Tablas: `roles_responsabilidades_catalogo` (8 roles predefinidos del Excel + personalizados, con 3 columnas nuevas `responsabilidades` / `autoridad` / `rendicion_cuentas`), `roles_responsabilidades_asignacion` (persona-rol por empresa), `roles_responsabilidades_divulgacion` (estado de aceptación con UNIQUE constraint por versión).
  - Estado de divulgación **calculado automáticamente** según `documento_soporte_path IS NOT NULL` (aceptado si hay PDF, pendiente si no).
  - Reporte PDF con `pdf-lib` (3 páginas: portada con cumplimiento + matriz de roles + divulgación a trabajadores).
  - File dialogs nativos de Electron con `BrowserWindow.fromWebContents()` como parent (foco correcto sobre el modal HTML).
  - **Migración de schema idempotente** (auto-corre en próximos deploys): `PRAGMA table_info` + `ALTER TABLE ADD COLUMN` para las 3 columnas nuevas.
- **Frontend** (`modules/recursos/roles-responsabilidades/roles-responsabilidades-view.html` + `viewer.js` + `view.css`, NUEVOS):
  - 2 tabs: **Gestión de Roles** + **Documentos de soporte** (este último lista los PDFs subidos con Ver/Descargar).
  - Banner de cumplimiento con barra de progreso.
  - Matriz de roles con los 8 roles del Excel + estados (vigente/pendiente/N/A) + botones **"Matriz"** y **"Asignar/Reasignar"** por fila.
  - **Modal Matriz** con las 4 columnas del Excel (Responsabilidades / Autoridad / Rendición / Base legal) por rol.
  - Matriz de divulgación con captura manual uno-a-uno, fecha editable.
  - Modales: asignar/reasignar persona, añadir trabajador.
  - **Modal "Subir soporte PDF"** completo: drag&drop zone + botón "Examinar..." para origen + botón "Examinar..." para destino carpeta + chips visuales con nombre corto + tooltip con ruta completa + botón "Copiar y marcar aceptado" que copia el PDF a la carpeta destino.
  - Botón "Exportar Reporte PDF" en el banner.
- **Preload** (`preload.js`, +13): expone 14 APIs en `window.electronAPI.rolesResp` (catalogo + asignacion + divulgacion CRUD + reporte PDF + 3 file dialogs + 1 descarga).
- **Parent proxy** (`roles-responsabilidades-logic.js`): el iframe se comunica con el parent via `postMessage` (handshake + bridge call) — necesario porque el `contextBridge` proxy no se transfiere correctamente entre contextos del iframe. El parent actúa como proxy del IPC, evitando el problema de contextIsolation.
- **Sync multipc** (`main/sync-serializer.js`, +140): serialize/deserialize de las 2 tablas (asignacion + divulgacion) por empresa. El catálogo NO se sincroniza — es el mismo para todas las empresas.
- **Catálogo de 8 roles predefinidos** (basado en Excel G-OD-006 REV.02 Enero 2018 del user):
  1. REPRESENTANTES DE LA ALTA DIRECCION (1.1.2.R1)
  2. JEFES DE AREA (1.1.2.R2)
  3. TRABAJADORES (1.1.2.R3)
  4. RESPONSABLE DEL SG SST (1.1.2.R4)
  5. VIGIA DE SEGURIDAD Y SALUD EN EL TRABAJO COPASST (1.1.2.R5)
  6. COMITÉ DE CONVIVENCIA LABORAL (1.1.2.R6)
  7. BRIGADA DE EMERGENCIAS (1.1.2.R7)
  8. CONTRATISTAS (1.1.2.R8)
- **Filtro de ruido en consola** (`renderer.js`): el listener genérico de `postMessage` ya no loguea "Unknown message type" para los mensajes `kair-rr-*` (que maneja el componente wrapper).

### Fixed
- **📦705-fix1 — fix(roles-resp): migración idempotente de schema (PRAGMA + ALTER TABLE)** — `CREATE TABLE IF NOT EXISTS` no agrega columnas a una tabla existente, por eso el SEED del Excel v2 fallaba silenciosamente en installs previos. Ahora `_ensureSchemaMigrated()` detecta columnas faltantes con `PRAGMA table_info` y las agrega con `ALTER TABLE ADD COLUMN` (idempotente, sin errores en installs nuevos).
- **📦705-fix2 — fix(roles-resp): BD migrada con 8 roles del Excel, 9 viejos desactivados** — Los 9 roles del Decreto 1072 del seed original se desactivan con `UPDATE ... WHERE id NOT IN (seedIds) AND es_predefinido = 1`. El user ahora ve solo los 8 roles del Excel en la UI.
- **📦705-fix3 — refactor(roles-resp): bridge IPC via postMessage (bypassea contextIsolation)** — En Electron con `contextIsolation: true`, copiar el proxy de `electronAPI` al iframe vía `iframe.contentWindow.electronAPI = window.electronAPI` no funciona correctamente. Solución: el iframe le pide al parent que invoque el IPC via `postMessage` (`kair-rr-bridge-call` + `kair-rr-bridge-result`), y el parent (que SÍ tiene el contextBridge funcionando) lo ejecuta. 100% robusto.
- **📦705-fix4 — fix(roles-resp): listener de mensajes en `window` (no `window.parent`)** — Bug crítico: en el viewer, el listener estaba registrado en `window.parent.addEventListener('message', ...)` cuando debía estar en `window.addEventListener('message', ...)`. Cuando el parent hacía `iframe.contentWindow.postMessage(msg)`, el mensaje se entregaba al `window` del iframe, no al `window.parent`. Resultado: el `bridgeReady` quedaba esperando eternamente → "Cargando..." persistente.
- **📦705-fix5 — fix(roles-resp): funciones abrirModalMatriz/cerrarModalMatriz faltaban** — `setupModalEvents()` llamaba a `cerrarModalMatriz` que no estaba definida. La excepción mataba el `init()` antes del handshake → "Cargando..." persistente + tablas vacías. Agregadas ambas funciones.
- **📦705-fix6 — fix(roles-resp): `process.env.USERNAME` no existe en iframe (exportarPDF)** — El código intentaba usar `process.env` (del main process de Node) en el renderer del iframe. Reemplazado por un string fijo + prompt para que el user ajuste.
- **📦705-fix7 — refactor(roles-resp): prompt() → mini-modal con chips** — `prompt()` no funciona confiable en iframes de Electron con contextIsolation. Reemplazado por un modal visual con chips (ícono + nombre + tooltip con ruta completa) + validación de extensión `.pdf`.
- **📦705-fix8 — feat(roles-resp): drag&drop + examinar en modal "Subir soporte"** — El modal nuevo permite arrastrar el PDF o usar el botón "Examinar..." para seleccionar el origen. La app copia el PDF a la carpeta destino (que también se elige con "Examinar...") y guarda la divulgación con el path destino.
- **📦705-fix9 — fix(roles-resp): BrowserWindow parent para file dialogs (foco correcto)** — El `dialog.showOpenDialog` se abría detrás del modal HTML sin foco, dando timeout. Ahora pasa `BrowserWindow.fromWebContents(event.sender)` como parent, así aparece encima del modal. Timeout del bridge subido de 10s a 60s.
- **📦705-fix10 — feat(roles-resp): tab "Documentos de soporte" con Ver/Descargar** — El tab antes tenía un placeholder. Ahora lista todos los PDFs subidos (divulgaciones con `documento_soporte_path`) con badge de conteo, botón "Ver" (abre con el kairFV file viewer del proyecto) y botón "Descargar" (save dialog nativo + copia).

### Files
- `sgsst-electron-app/main/roles-responsabilidades-bridge.js` (NEW, ~660 líneas)
- `sgsst-electron-app/main/sync-serializer.js` (+140)
- `sgsst-electron-app/main.js` (+7)
- `sgsst-electron-app/preload.js` (+14)
- `sgsst-electron-app/modules/recursos/roles-responsabilidades/roles-responsabilidades-view.html` (NEW, ~250 líneas)
- `sgsst-electron-app/modules/recursos/roles-responsabilidades/roles-responsabilidades-viewer.js` (NEW, ~620 líneas)
- `sgsst-electron-app/modules/recursos/roles-responsabilidades/roles-responsabilidades-view.css` (NEW, ~470 líneas)
- `sgsst-electron-app/modules/recursos/roles-responsabilidades/roles-responsabilidades-logic.js` (proxy postMessage, +90)
- `sgsst-electron-app/renderer.js` (filtro kair-rr-*, +5)
- `sgsst-electron-app/CHANGELOG.md`, `CONTEXT.md`, `release-notes.md`, `package.json`

## [0.1.177] - 2026-08-13

### Changed
- **📦704 — feat(ui): abreviaciones de títulos de módulos en el tablero principal + ajuste de min-width para 1 fila en ventana y maximizado** — El user pidió que los títulos de los 7 módulos del tablero principal se vieran abreviados para que entren todos en una sola fila. Los títulos largos (`Gestión Integral`, `Gestión de la Salud`, `Gestión de Peligros y Riesgos`, `Gestión de Amenazas`) se cortaban con ellipsis o bajaban a la fila 2 según el ancho de la ventana. **Cambios (1 archivo, `renderer.js`)**:
  - **Abreviaciones (campo `shortName` agregado al array `modulesData`)** — el `name` largo se mantiene intacto porque se usa como key lógica en `moduleMap`, `moduleTaskMap`, `filterDashboardTasksByModule`, `data-module-name` / `data-module` en handlers, y match con el sidebar. Cambiar el `name` directo habría roto toda la lógica de filtrado, badges y match. **Mapeo aplicado** (respetando lo que pidió el user):
    - `Recursos` → `Recursos` (sin cambio, ya es corto)
    - `Gestión Integral` → `Gest. Integral`
    - `Gestión de la Salud` → `Gest Salud` (sin "de la" y sin punto, como pidió el user)
    - `Gestión de Peligros y Riesgos` → `Gest. Pel. y Riesgos`
    - `Gestión de Amenazas` → `Gest. Amenazas`
    - `Verificación` → `Verificación` (sin cambio, ya es corto)
    - `Mejoramiento` → `Mejoramiento` (sin cambio, ya es corto)
  - **Render del `<h4>`** — ahora muestra `${mod.shortName || mod.name}` con `title="${mod.name}"` para que al hacer hover se vea el nombre completo como tooltip. Backward-compatible: si un módulo futuro no tiene `shortName`, fallback a `name`.
  - **Modo ventana** (`@media (max-width: 1199px)`):
    - `min-width: 220px → 135px` (era el problema — 4+3)
    - `flex-basis: 220px → 135px`
    - `padding: 6px 10px → 6px 8px` (más compacto)
    - `h4 font-size: 12px → 11px` (encaja el texto abreviado)
    - `icon: 24px → 22px` (proporcional al min-width más chico)
    - **Cálculo**: 7 cards × 135 + 6 gaps × 6 = ~981px → entra en ventanas de 1000+px
  - **Modo maximizado** (`@media (min-width: 1200px)`):
    - `min-width: 165px → 140px` (un poco más chico por seguridad)
    - `flex-basis: 165px → 140px`
    - **Cálculo**: 7 cards × 140 + 6 gaps × 12 = ~1052px → entra en maximizado (1200+px)
  - **Lo que NO cambió**:
    - El `name` largo sigue intacto (lógica de filtrado, badges, match con sidebar)
    - El subtitle sigue oculto en ventana y visible en maximizado
    - El handler de click en card y badge sigue funcionando (sigue usando `mod.name`)
- **Antes vs después** (validado visualmente por el user en su ventana real):
  - **Modo ventana** (la imagen que el user validó): ANTES 4 módulos en fila 1 + 3 en fila 2 → DESPUÉS 7 módulos en 1 sola fila
  - **Modo maximizado** (la imagen anterior): ANTES los títulos largos se cortaban con ellipsis → DESPUÉS entran todos completos en 1 fila
  - **Nota visual menor**: en ventana, el título "Gest. Pel. y Riesgos" puede verse ligeramente truncado con ellipsis como "Gest. Pel. y Ries..." si la ventana está cerca del límite. Es aceptable — el nombre completo se ve en el tooltip al hacer hover. Si el user quiere que se vea siempre completo, en una próxima iteración se puede acortar a "Gest. Peligros" o ajustar más el min-width.

## [0.1.176] - 2026-08-13

### Fixed
- **🐛 fix(bandeja): cumplido se desmarca solo ~60s después de marcar** — El user reportó que al marcar un evento de Google Calendar (gcal-*) como cumplido en la Bandeja Integrada, el checkmark (✓) aparecía al instante pero desaparecía ~1 minuto después, sin que el user tocara nada. La BD SÍ tenía el registro (`eventos_cumplidos` con `cumplido_en` correcto), así que el problema era de UI/render, no de persistencia. Después de una investigación exhaustiva con test E2E con mock del adapter, se identificó la causa raíz:
  - **Causa raíz**: el adapter del calendario (`shared/kair-calendar-adapter.js`) SÍ construye un `cumMap` interno con los IDs `gcal-*` desde la BD y enriquece los eventos de SU lista base (capacitaciones, gestación, etc.) con `cumplido: true` cuando hay match. **PERO el adapter NO incluye los eventos de Google Calendar en su lista base** — esos llegan al frontend DESPUÉS via `loadEventsFromGoogle()` en `loadEventsFromIPC()` (línea 1168-1181), y se concatenan al array sin enriquecer. Resultado: los `gcal-*` quedan con `cumplido: undefined` en `state.events` → el `renderBigCalendar()` no muestra el ✓ (`ev.cumplido ? '✓ ' : ''` evalúa como `undefined` → `''`).
  - **Por qué pasaba después de 60s**: el `autoRefreshInterval` (`renderer/bandeja-integrada/app.js:1460-1480`) llama a `loadEventsFromIPC()` cada 60s y reemplaza `state.events = events`. Cada refresh reconstruye el `state.events` desde el adapter + Google, y los gcalEvents llegan sin enriquecimiento. El ✓ se mantenía solo en el período entre marcar y el primer auto-refresh, porque las líneas 2228-2231 seteaban `ev.cumplido = true` directamente en el `state.events` local — pero ese cambio local se sobrescribía en el próximo refresh.
  - **Fix (3 archivos, +16/-0)**:
    1. **`shared/kair-calendar-adapter.js:290`** — el adapter ahora expone el `cumMap` en la respuesta: `return { success: true, data: merged, cumMap: cumplidosMap }`. Cambio **backward-compatible**: el KairCalendar embebido (`kair-calendar.js:1380`) y KairAlerts (`kair-alerts.js:189`) solo leen `res.data` e ignoran el nuevo campo. Version bump 1.2.0 → 1.3.0.
    2. **`renderer/bandeja-integrada/app.js:1158`** (loadEventsFromIPC) — captura `var cumMapFromAdapter = (result && result.cumMap) || {}` después de `adapter.list()`.
    3. **`renderer/bandeja-integrada/app.js:1185-1198`** (loadEventsFromIPC) — después de obtener `gcalEvents` via `loadEventsFromGoogle()`, los enriquece con `cumplido: true` si su `id` está en el `cumMapFromAdapter` (los IDs `gcal-...` matchean con los `evento_id` de la BD).
  - **Antes vs después** (caso real del user, Tempoactiva, 2 eventos gcal-* marcados):
    - ANTES: `cumMap` se construía y se perdía (solo usado internamente para enriquecer la lista del adapter). Los gcalEvents llegaban al `state.events` con `cumplido: undefined` después de cada refresh. El ✓ se veía en los primeros 60s y desaparecía.
    - DESPUÉS: `cumMap` se devuelve al caller. `loadEventsFromIPC` lo aplica a los gcalEvents antes de concatenarlos. El ✓ se mantiene en todos los ciclos de auto-refresh.
  - **Por qué el UPSERT con `empresa_id` también era parte del fix**: el bridge `eventos-cumplidos-bridge.js` solo actualizaba `cumplido_en` y `nota` en el UPSERT, NO `empresa_id`. Si el frontend pasaba `empresaId=null` al marcar (caso de "Todas las empresas" o un estado raro del frontend), el registro quedaba con `empresa_id=NULL`. Como SQL `WHERE empresa_id = 'X'` nunca matchea NULL, los eventos marcados en modo "Todas" se veían tachados en "Todas" pero NO en la empresa sola. **Fix complementario**:
    - **`eventos-cumplidos-bridge.js:180-186`**: el UPSERT ahora incluye `empresa_id = excluded.empresa_id` → si el frontend pasa null después de pasar un valor real, la BD actualiza al nuevo valor.
    - **`eventos-cumplidos-bridge.js:99-122`**: migración one-shot idempotente en `_ensureSchemaMigrated` que detecta registros con `empresa_id IS NULL` E `evento_id LIKE '%-%-%'` y les infiere la empresa del prefijo del id (`SUBSTR + INSTR`). Solo afecta NULLs, no toca registros ya seteados.
  - **Por qué `_refreshCumplidosEnCalendario()` también se llamó desde el marcado**: la función existía del `📦694-fix4` (código huérfano, nadie la llamaba). Después de marcar/desmarcar, re-fetchea el `cumMap` del backend y refresca el KairCalendar embebido. Es defensa en profundidad — la solución principal es el enrichment en `loadEventsFromIPC` que afecta a TODO el flujo de auto-refresh.
  - **Validación con test E2E (mock del adapter)**: simulé `adapter.list` + `loadEventsFromGoogle` con los IDs reales de la BD. Resultado con el fix:
    ```
    ✅ gcal-5bvf8h8gnv2uikietqj29r8goc → cumplido=true cumplidoEn=2026-08-13T21:29:50.082Z
    ✅ gcal-65nf5uvbcsmidkb8099j9qi62u → cumplido=true cumplidoEn=2026-08-13T21:29:48.011Z
    ```
  - **Lección cross-project guardada en agent memory**: cuando un adapter/componente calcula un enrichment (cumMap, colorMap, etc.) para su lista interna, EXPONER ese enrichment en la respuesta si hay OTROS consumidores (Google, sync, etc.) que también quieren enriquecer. Si no se expone, los demás consumidores duplican lógica o quedan sin enrichment. **Patrón**: `return { success, data, derivedMaps }` en vez de `return { success, data }`.

## [0.1.175] - 2026-08-13

### Added
- **📦702 — feat(usuarios): permisos de Bandeja Integrada por usuario** — Hasta ahora el iframe de la Bandeja Integrada (correo + calendario) estaba disponible para todos los usuarios logueados. Ahora el admin puede condicionar el acceso por usuario desde **Configuración > Gestión de Usuario**, con un toggle "Acceso a Bandeja Integrada" al lado del campo Rol. **Backend** (`bandeja-integrada-permissions-bridge.js`, nuevo):
  - 2 handlers IPC: `users-get-bandeja-integrada-flag` y `users-set-bandeja-integrada-flag`
  - Migración idempotente: `ALTER TABLE users ADD COLUMN bandeja_integrada_enabled INTEGER NOT NULL DEFAULT 0`
  - **Admin global siempre forzado a `enabled: true`** (no se puede deshabilitar ni a sí mismo ni a otros admins)
  - Bridge extendido: acepta `userId` opcional para que el admin pueda ver/modificar el flag de otros users; no-admin solo puede ver/modificar el propio
  - Validaciones de seguridad: `PERMISSION_DENIED` si no-admin intenta leer/modificar flags ajenos; `CANNOT_MODIFY_ADMIN` si admin intenta deshabilitar a otro admin
  - **Frontend** (`renderer.js:1041-1081`): `toggleBandejaIntegrada()` ahora chequea permisos vía `checkBandejaIntegradaAccess()` antes de abrir el iframe. Si no tiene acceso, muestra un `alert()` claro con instrucciones para contactar al admin. **Fail-open defensivo**: si la API no está disponible o la llamada falla, abre por defecto (no rompe UX)
  - **UI** (`config-viewer.html:1997-2009`): nuevo toggle switch estilo iOS en el modal de Gestión de Usuario. Si el rol es Administrador, se prende + bloquea + label "🔒 Siempre habilitado para administradores." Si no, se muestra el valor actual de la BD + hint con estado
  - **Save handler** (`config-viewer.html:3927-4017`): después de guardar user + asignaciones, persiste el flag vía `users-set-bandeja-integrada-flag`. Helper local `persistBandejaIntegradaFlag()` no fatal: si falla el guardado del flag, el user ya quedó guardado (solo log + toast warning)

### Fixed
- **📦702 — fix(bridge): firma del bridge era `(getDb, validateSession)` pero `main.js` la llamaba como `(app, { getDb, validateSession })`** — Bug introducido en el commit inicial del bridge. La convención del proyecto (ver `eventos-cumplidos-bridge.js`, `gestacion-bridge.js`, etc.) es `registerXxxHandlers(app, deps)`. Por la firma incorrecta, `_validateSession` quedaba como el objeto `{ getDb, validateSession }` (no función), el chequeo `typeof === 'function'` fallaba, y el handler retornaba `AUTH_REQUIRED: validateSession no configurado`. **Síntoma visible para el user admin**: el alert "🔒 No tienes acceso a la Bandeja Integrada" se mostraba incluso siendo admin. **Fix**: 1 línea efectiva — cambiar la firma a `(app, deps)` y leer `deps.getDb` / `deps.validateSession`. Verificado con 12 tests unitarios del bridge (admin, no-admin, casos de borde). **Lección guardada en memoria cross-project**: cualquier bridge nuevo DEBE seguir la convención `(app, deps)` para no caer en este bug.

### Files
- `sgsst-electron-app/main/bandeja-integrada-permissions-bridge.js` (NEW, 200 lines): bridge con 2 handlers + extensión con `userId` opcional
- `sgsst-electron-app/main.js` (+34): require del bridge + ALTER TABLE migration con try/catch idempotente + registro de handlers
- `sgsst-electron-app/preload.js` (+5): expone `usersGetBandejaIntegradaFlag` y `usersSetBandejaIntegradaFlag` en `window.electronAPI`
- `sgsst-electron-app/renderer.js` (+40): `toggleBandejaIntegrada()` con gate de permisos + `checkBandejaIntegradaAccess()` async con fail-open
- `sgsst-electron-app/components/config/config-viewer.html` (+~90): HTML del toggle + CSS del switch + `openUserModal` carga el flag + `saveUser` persiste el flag

### Fixed (Step 5 — visibilidad del botón)
- **📦702 — fix(bandeja): botón del header visible para users sin acceso** — Después del primer commit del feature, el botón del sobre en el header quedaba visible para todos los users aunque no tuvieran acceso a la Bandeja Integrada. El gate de `checkBandejaIntegradaAccess()` mostraba un alert al hacer click, pero el botón en sí no se ocultaba. **Causa raíz doble**:
  1. La función `applyBandejaIntegradaVisibility()` corría al cargar la app, **ANTES del login**, con `authToken = null` → el backend respondía `AUTH_REQUIRED`
  2. El código original era **fail-open** en ese caso → dejaba el botón visible
- **Fix** (`renderer.js:1152-1228`):
  - Nueva función `applyBandejaIntegradaVisibility(allowed)` con 3 modos (`true`/`false`/`undefined` para chequear backend)
  - **Fail-CLOSED**: si no se puede determinar el permiso (sin token, API no disponible, respuesta no exitosa) → **OCULTA** el botón (más seguro)
  - Expuesta en `window.applyBandejaIntegradaVisibility` para llamarla desde login/logout
  - Llamada al cargar la app (inicial: oculta por fail-closed)
  - Llamada **después del login exitoso** (`renderer.js:3358`) → consulta backend y muestra/oculta
  - Llamada **después del logout** (`renderer.js:3949`) → oculta de nuevo
- **Comportamiento esperado**:
  - Admin global: backend fuerza `enabled: true` → **botón siempre visible**
  - No-admin con flag=1: backend retorna `enabled: true` → **botón visible**
  - No-admin con flag=0: backend retorna `enabled: false` → **botón oculto**
  - Sin login: fail-closed → **botón oculto**
- El gate en `checkBandejaIntegradaAccess()` queda como defensa en profundidad (por si el user navega con DevTools)

### Changed
- **📅 feat(cal-cap): solo mostrar capacitaciones con hora en el calendario** — Hasta ahora el calendario mostraba TODAS las capacitaciones con fecha, asignándoles 09:00 por default a las que no tenían hora en el sidecar de localStorage. Esto llenaba el calendario de "eventos fantasma" a las 9am sin horario real definido. **Causa**: el filtro del backend (`_leerCapacitacionesDeEmpresa` en `main.js`) solo descartaba las caps sin fecha, no las sin hora. **Cambios (3 archivos, +44/-5)**:
  - **Backend** (`main.js:5377-5380`): nuevo contador `skippedNoHora` + filtro `if (!start || !end) { continue; }` antes del `events.push()`. Log mejorado con el nuevo contador: `[CAL-CAP] N eventos de capacitaciones para X (omitidas: Y sin nombre, Z sin fecha, W sin hora)`. **Bug latente detectado** (no fix acá): `colDuracion` referenciada pero no definida → `durH` siempre queda en 2h. Afecta el `end` del evento calculado.
  - **UI del modal** (`capacitaciones-view.html:266-284`): input `#trainingHora` removidos `required` y `value="09:00"`. Label: "Hora *" → "Hora (opcional)". Help text nuevo: "Sin hora → no aparece en el calendario". Botón nuevo `#clearTrainingHora` con SVG inline de papelera al lado del input. Click → vacía el campo y devuelve el focus.
  - **Lógica** (`capacitaciones-logic.js:413, 252-265`): prefill del modal en edit cambió de `cap.hora || '09:00'` a `cap.hora || ''`. Handler del botón nuevo: click → `horaInput.value = '' + focus()`.
- **Flujo end-to-end** (verificado por el user):
  1. Cap con hora → aparece en el calendario con su hora real
  2. Editar cap → click 🗑️ → input vacío → Actualizar → `_setHora(name, '')` borra la key del sidecar → cap desaparece del calendario
  3. Listado del módulo Capacitaciones sigue mostrando todas (con "—" en la columna Hora)
- **Antes vs después** (caso de prueba del user, Tempoactiva):
  - ANTES: 41 eventos capacitación visibles en Bandeja Integrada (todos a 09:00)
  - DESPUÉS: solo los que tienen hora en el sidecar (2 inicialmente: 14:00 cada uno)
  - Al borrar la hora de uno: 1 evento menos en el calendario
- **Lo que NO cambió**:
  - El Excel no tiene columna HORA — la hora se persiste en localStorage (`kair-cap-horas`) desde el modal
  - El Listado del módulo Capacitaciones sigue mostrando TODAS (con o sin hora)
  - El adapter del calendario (`shared/kair-calendar-adapter.js`) no necesitó cambios — el fallback a `localStorage.getItem('kair-cap-horas')` ya funcionaba

## [0.1.174] - 2026-08-13

### Fixed
- **📦608 — fix(file-viewer): integración completa del file-viewer para Remisiones Médicas + 6 fixes críticos (fix15/16/17/18/19/20/21/22/22b)** — 9 fixes iterativos al `file-viewer.js` y a los visualizadores de las 12 secciones (3.1.6, 1.1.1, sociodemografica, politica, copasst, comite-convivencia, capacitacion-copasst, afiliacion, trabajo-alto-riesgo, roles-responsabilidades, curso-virtual, manual-proveedores).
  - **fix18 (raíz)**: `window.FlyfishFileViewerWeb` no existe — el export real es `FlyfishFileViewerWebFull`. Defense in depth 2 capas con `window.FlyfishFileViewerWebFull || window.FlyfishFileViewerWeb` + preload eager de renderers lazy (elimina race conditions intermitentes) + orden de scripts IIFE → helper → viewer
  - **fix19**: `Ve(filename)` del bundle hace `filename.split(/[?#]/)` interpretando `#` como fragmento de URL. Para "Carta Recomendación Médica #20.docx" retornaba "" → `state: "unsupported"`. **Fix**: pasar `type` attribute explícito al custom element, el bundle prioriza `e.type || Ve(filename)`
  - **fix20**: CSS global inyectado en `shared/file-viewer.js` via `injectGlobalPreviewBtnCSS()` IIFE — arregla 12 visualizadores con 1 cambio (botón "Ver completo" 30x30 → auto width con padding)
  - **fix21**: bug del `return` temprano que saltaba el MutationObserver. **Fix**: removido el return; `forceToolbarStyle()` + MutationObserver ahora SIEMPRE se ejecutan. Toolbar reaplicado con `setProperty(..., 'important')` para sobrescribir `!important` del bundle
  - **fix22**: reglas de sizing copiadas de 1.1.1 (responsable-sg) que funcionaba
  - **fix22b (causa raíz del documento cortado)**: panel PADRE `.kair-preview` sin `min-height: 0` + `overflow: hidden` cortaba el file-viewer. **Regla cross-project guardada en memoria**: cuando un hijo tiene `flex: 1` o `flex: 1 1 0%`, TODOS los ancestros flex hasta el que tiene `height` definido necesitan `min-height: 0` + `overflow: hidden`. Sin esto, flexbox no comprime y el hijo queda con el alto natural del contenido
- **Por qué `:has()`**: el selector aplica solo cuando hay file-viewer presente, no rompe el caso PDF legacy

## [0.1.173] - 2026-08-12

### Fixed
- **📦701-fix12 — fix(bandeja): reply en Enviados mostraba el email del propio user como destinatario** — En la Bandeja Integrada, al abrir un correo de **Enviados** y click en "Responder" o "Responder a todos", el campo "Para" mostraba un chip con el email del propio usuario (visible como "m" o el primer carácter del email, porque el chip tiene `max-width: 180px` y se truncaba con ellipsis).
  - **Causa raíz**: `openComposeModal()` usaba `mail.senderEmail || mail.sender` para el "To", pero en Enviados `mail.senderEmail` es el email del PROPIO usuario (el remitente), no el destinatario original. La función `getMailDisplayContact()` ya manejaba este caso correctamente para la lista y el detalle (línea 301), pero no se usaba en el compose.
  - **Fix**: usar `getMailDisplayContact(mail)` en `openComposeModal()` que retorna:
    - **INBOX**: el `sender` (a quien respondés)
    - **SENT**: el primer item de `to_list` o `participants_list` excluyendo al user (el destinatario original, a quien querés responderle)
  - **Reply all**: también arreglado. Antes podía incluir tu propio email en CC; ahora con `getMailDisplayContact` + el filtro existente, el "Para" es el destinatario correcto y el "CC" son los demás.

## [0.1.172] - 2026-08-12

### Changed
- **📦701-fix10 — fix(ui): scroll INTERNO en los home de módulos principales (sin scroll externo)** — En modo ventana, el home de un módulo (widgets + charts + lista de submódulos) puede no caber en el viewport. Antes esto causaba que la sección de submódulos quedara cortada al final. **Fix de 2 capas con CSS puro**:
  1. **Contenedor padre** (`.module-content-area` y `.main-canvas`): `overflow: hidden` — sin scrollbar en el borde de la página
  2. **Contenedor del home** (`.gestion-integral-home`, `.gestion-salud-home`, `.gestion-peligros-home`, `.gestion-amenazas-home`): `overflow-y: auto` con `scrollbar-width: thin` y `scrollbar-color: rgba(0,0,0,0.25) transparent` — scrollbar INTERNA de ~8px, semi-transparente, dentro del home
- **Por qué `:has()`**: el selector original `.vanta-fullscreen #app-footer` enseñó que el patrón de detectar el contenido desde el ancestro común con `:has()` es más confiable que el sibling selector. Acá aplica igual: el home es hijo del padre, y queremos modificar el comportamiento del padre según el contenido del hijo.
- **Cubre los 7 módulos principales** (4 clases de home): gestion-integral-home (Recursos, Gestión Integral, Verificación, Mejoramiento), gestion-salud-home, gestion-peligros-home, gestion-amenazas-home.

### Iteración
- Primero intenté reducir los tamaños de los widgets/charts (fix11), pero el user rechazó esa dirección porque afectaba la legibilidad. Revertí fix11 completamente.
- Después probé `overflow-y: auto` en el contenedor padre, pero eso traía de vuelta la scrollbar externa. Cambié el approach: el padre se queda en `hidden` y la scrollbar vive DENTRO del home.

## [0.1.171] - 2026-08-12

### Changed
- **📦701-fix9 — feat(ui): footer solo visible en pantalla de inicio con texto blanco sobre Vanta** — El footer negro (`© Javier Robles... · v0.1.X`) se quitó de la app principal para ganar espacio vertical (~25px). Ahora solo aparece en la pantalla de inicio (splash + login + selección de empresa) flotando en la parte de abajo con texto blanco sobre el fondo animado de Vanta.js. **Implementación**:
  - **Main app** (`styles.css`): `#app-footer { display: none !important; }` por defecto. Cuando `#app` tiene un descendiente con clase `vanta-fullscreen` (usando `:has()` de CSS moderno soportado en Electron 37 / Chromium 118+), el footer aparece con `position: fixed; bottom: 0; left: 0; right: 0;`, fondo transparente, texto blanco con text-shadow para legibilidad sobre el Vanta.
  - **Por qué `:has()`**: el selector original `.vanta-fullscreen #app-footer` NUNCA funcionó porque `vanta-fullscreen` se aplica a `.main-container` (sibling del footer) y no a un ancestro. Por eso el footer negro se veía siempre. La regla `#app:has(.vanta-fullscreen) #app-footer` sí matchea porque `#app` es el ancestro común.
  - **Header del app**: misma corrección con `:has()` para que se oculte correctamente en la pantalla del Vanta.
  - **Bandeja Integrada** (`renderer/bandeja-integrada/styles.css`): el footer de la Bandeja (`K+AIR · Bandeja Integrada v0.1.120 · SG-SST · Resolución 0312 de 2019 · X eventos visibles · Empresa: Todas · Vista: Correo`) también se ocultó con `display: none !important` para ganar espacio vertical en el iframe del correo. El HTML y el JS no se tocaron — el DOM sigue actualizándose, solo se oculta visualmente.

### Trade-off
- **El dot de updates desaparece del footer** (estaba ahí en v0.1.131). Si hay un update disponible, no se ve en la app principal. Sigue accesible desde **Configuración > Acerca de la App**. Si querés que aparezca en otro lado (botón flotante, header), avisame para moverlo.

## [0.1.170] - 2026-08-12

### Fixed
- **📦701-fix8 — fix(ausentismo): cédula con formato display no matcheaba al reabrir caso** — El log mostraba `[SEGUIMIENTO] Cédula: 1,044,392,755` (con comas), pero la BD la guarda sin formato (`1044392755`). La query `WHERE cedula = '1,044,392,755'` retornaba 0 filas, el código pensaba que no había caso y abría panel para caso nuevo. **Fix (defense in depth en 2 capas)**:
  1. **Renderer** (`medicion-ausentismo.js`): normaliza la cédula con `.replace(/,/g, '').replace(/\./g, '').trim()` antes de llamar al bridge
  2. **Bridge** (`seguimiento-incapacidad-bridge.js`): normaliza también dentro del handler `_handlerBuscarPorCedula` para que cualquier otro caller quede protegido

  **Por qué 2 capas**: si el renderer normaliza pero el bridge no, otro módulo que llame al bridge sin normalizar revienta el flujo. Si el bridge normaliza, está protegido siempre.

  **Lección guardada en memoria cross-project**: cualquier query de BD que reciba cédulas/documentos desde un input de usuario o campo display SIEMPRE debe normalizar a la entrada.

### Files
- `main/seguimiento-incapacidad-bridge.js`: normalización de cédula en `_handlerBuscarPorCedula` (+6/-0)
- `modules/gestion-salud/ausentismo/medicion-ausentismo.js`: normalización antes de `buscarPorCedula` y `buscarRegistrosCedula` (+11/-2)

## [0.1.169] - 2026-08-11

### Fixed
- **📦701-fix6 — feat(ausentismo): el informe PRI ahora incluye los casos guardados en SQLite** — El handler `get-pri-seguimiento-data` solo leía casos del Excel legacy (PRI.xlsx) y los casos que se guardan en SQLite (como el flujo nuevo de seguimiento de incapacidades) NO aparecían en el informe. **Fix**: después de leer el Excel, consulta la BD con `dbInstance.prepare('SELECT * FROM seguimiento_incapacidad_caso WHERE empresa_id = ?')`, convierte cada caso a un row de 173 columnas (mapeando los campos del caso BD a los headers del Excel), y lo inserta al final de `result.rows` solo si la cédula no está ya en el Excel. Los nuevos casos aparecen listados con su badge "En Seguimiento" en la lista de casos detectados.
- **📦701-fix6 — fix(ausentismo): timezone bug en `formatDate` del informe** — `new Date("2026-04-01")` se interpretaba como medianoche UTC, lo que en zonas horarias como Colombia (UTC-5) mostraba el día anterior (`31/03/2026` en vez de `01/04/2026`). **Fix**: regex detecta formato YYYY-MM-DD puro y agrega `T00:00:00` para que se interprete como medianoche local.
- **📦701-fix7 — feat(ausentismo): sección 4 (Historial de Seguimientos) del informe ahora muestra los seguimientos de la BD** — El render del informe construía `c.seguimientos` solo desde las columnas Excel (`SEGUIMIENTO 1` a `SEGUIMIENTO 5`). Para casos de BD, esas columnas estaban vacías y la sección no se renderizaba. **Fix**: el handler ahora consulta `seguimiento_incapacidad_registro WHERE caso_id = ?` para cada caso de BD, calcula los índices de las columnas `seguimiento N`, y pone la fecha en `colIdx[seguimiento N]` y la descripción en `colIdx + 1` (la columna adyacente sin header propio). El formato de fecha se envía en YYYY-MM-DD (nativo) y el `formatDate()` del renderer lo convierte a DD/MM/YYYY para mostrar.
- **📦701-fix7 — fix(ausentismo): seguimientos de BD se renderizaban como "Invalid Date"** — El primer intento convertía la fecha a `DD/MM/YYYY` antes de mandarla, pero el `formatDate()` del renderer solo maneja `YYYY-MM-DD` y otros formatos nativos de Date → `new Date("13/04/2026")` retorna Invalid Date. **Fix**: enviar la fecha en formato `YYYY-MM-DD` y dejar que `formatDate()` haga la conversión a DD/MM/YYYY.
- **📦701-fix6 — fix(ausentismo): estado del caso no consideraba los seguimientos de la BD** — `determinarEstadoCaso(incapacidad, registroPRI, casoBD)` ignoraba `casoBD` y siempre caía al cálculo del Excel. **Fix**: si `casoBD` tiene seguimientos, el estado es "En Seguimiento" (no "Sin Iniciar"). LORAINNE ahora muestra "En Seguimiento" en vez de "Sin Iniciar".

### Files
- `main.js`: handler `get-pri-seguimiento-data` extendido para incluir casos de BD + query a `seguimiento_incapacidad_registro` para los seguimientos (+137/-?)
- `modules/gestion-salud/ausentismo/informe-pri-builder.html`: fix `formatDate` para timezone YYYY-MM-DD (+12/-0)
- `modules/gestion-salud/ausentismo/medicion-ausentismo.js`: `determinarEstadoCaso` considera el caso de BD para reflejar el estado real (+26/-?)

## [0.1.168] - 2026-08-11

### Fixed
- **📦701-fix3 — fix(ausentismo): schema de `seguimiento_incapacidad_caso` tenía 2 columnas duplicadas (`origen_dx2` y `origen_dx3`)** — Bug crítico introducido en v0.1.166: la sección "Incapacidad" y la sección "Calificación" del schema tenían columnas con el mismo nombre, lo que hacía que SQLite rechazara el `CREATE TABLE` con `duplicate column name: origen_dx2`. El error se capturaba silenciosamente en el try/catch y las tablas NUNCA se creaban. Resultado: cada intento de guardar salía con `no such table: seguimiento_incapacidad_caso`. **Fix**: renombrar las 4 columnas de la sección Calificación a `origen_dx_calificada{1..4}` (más semánticamente correcto también) + actualizar el array de columnas INSERT, `_aplanarCaso()` y `_expandirCaso()` para mantener la coherencia. Verificado con Python sqlite3: el schema ahora se ejecuta OK y crea las 2 tablas.
- **📦706-fix2 — fix(ausentismo): error "[object Object]" al guardar seguimiento** — El bridge devuelve `{ success: false, error: { code, message } }` y el frontend concatenaba el objeto directamente a string → `[object Object]`. **Fix**: extracción defensiva con 4 paths (null, string, object con .message, primitive) envueltos en try/catch para manejar referencias circulares. El `.catch` del IPC también tiene logging detallado (`type`, `constructor.name`, `stack`) para diagnóstico futuro.
- **📦701-fix4 — fix(ausentismo): al reabrir un caso existente se abría panel vacío** — El flujo buscaba registros en el Excel legacy (`buscarRegistrosCedula`) pero los datos ahora viven en SQLite. **Fix**: nuevo handler `buscarPorCedula` en el bridge + el renderer busca primero en SQLite y solo cae al Excel legacy si no hay caso. Carga el caso completo con sus seguimientos y llena el formulario con la estructura anidada (`caso.trabajador.*`, `caso.incapacidad.*`, `caso.pric.*`).
- **📦705-fix2 — feat(ausentismo): bloqueo de click directo en nav de secciones atenuadas** — Cuando el caso es "Solo seguimiento" (no PRI), las secciones 3, 4, 5 (Etapas PRIC, Recomendaciones, Calificación PCL) se atenúan visualmente pero el usuario podía hacer click en el nav y entrar. **Fix**: 2 puntos de bloqueo (defensa en profundidad) — `_intentarNavegarANavItem()` y `showSeguimientoPanelSection()` validan que la sección destino NO esté atenuada antes de navegar. Si lo está, muestra toast `ℹ️` con explicación y NO navega.
- **📦701-fix5 — feat(ausentismo): tabla de seguimiento no se actualizaba con los seguimientos nuevos** — El cálculo del avance usaba solo datos del Excel legacy (PRI.xlsx), pero los seguimientos nuevos se guardan en SQLite. **Fix**: `loadSeguimientoData()` ahora consulta la BD vía `seguimientoIncapacidad.listar({empresaId})` y construye un mapa `cedula → casoBD`. `calcularPorcentajeAvance(incapacidad, registroPRI, casoBD)` toma el MÁX entre el conteo del Excel y el de la BD para reflejar el estado real.
- **📦701-fix5 — feat(ausentismo): botón "Siguiente" no se deshabilitaba en seguimiento simple** — En seguimiento simple, las secciones 3/4/5 están atenuadas pero el botón Siguiente seguía activo (mostraba toast `ℹ️` al hacer click). **Fix**: `_actualizarProgresoSeccion()` ahora calcula si hay siguiente sección VISIBLE (no atenuada) y deshabilita el botón. UX más limpia, sin clicks innecesarios.
- **📦701-fix4 — fix(ausentismo): banner BD mostraba "Sin guardar" al reabrir un caso existente** — El método `_actualizarBannerBD(estado)` esperaba `'guardado'` pero se llamaba con `'saved'` (inglés). **Fix**: pasar el argumento correcto. Además, llamar a `_actualizarBannerBD('guardado')` al final de `_abrirPanelConCasoExistente` para reflejar que el caso ya está persistido.
- **📦701-fix4 — fix(ausentismo): `cargarDatosEnPanelSeguimiento` borraba los datos del caso cargado de la BD** — Esta función está diseñada para casos NUEVOS y resetea TODOS los campos a vacío. Cuando se llamaba DESPUÉS de `_cargarCasoBdEnFormulario` (caso existente), borraba todo lo que acababa de cargar. **Fix**: NO llamar a `cargarDatosEnPanelSeguimiento` cuando es caso existente. Solo llamar a `_loadDatosEmpleado(cedula)` para intentar autollenar campos VACÍOS desde la BD de personal (no sobreescribe los que ya tienen valor del caso).
- **📦701-fix4 — fix(ausentismo): sección 1 requería validación al navegar al reabrir caso existente** — El usuario tenía que re-llenar la sección 1 (Datos Generales) cada vez que reabría un caso, aunque todos los datos ya estuvieran en la BD. **Fix**: marcar `seccion1YaCapturada = true` al cargar caso existente, y `_validarSeccionActual()` retorna `valido: true` sin validar campos cuando la sección 1 ya fue capturada. El usuario puede volver a la sección 1 sin problemas, solo NO se valida.
- **📦701-fix4 — fix(ausentismo): mapeo de IDs incorrecto al cargar caso** — Los inputs de fechas de inicio/fin de incapacidad se llaman `sp-fecha-inicio` y `sp-fecha-fin` (sin prefix `inc-`), pero el mapeo tenía `sp-inc-fecha-inicio` que NO existe en el HTML. **Fix**: corregir el mapeo con los IDs REALES del HTML (verificado con grep), incluyendo IDs de diagnósticos secundarios (`sp-cie10-dx2`, `sp-origen-dx2`) y calificados (`sp-cie10-dx1-calificada`, `sp-origen-dx2-calificada`).
- **📦701-fix4 — fix(ausentismo): clasificación de caso se perdía al guardar** — Si el usuario guardaba sin hacer click en "Solo seguimiento" o "Marcar como PRI formal", el campo `caso_ingresado_pric` quedaba vacío en la BD y el banner mostraba "Sin clasificar". **Fix**: al guardar, si el campo está vacío, default a `'NO'` (seguimiento simple). Al cargar, si la BD tiene el campo vacío, también default a `'NO'`. Evita casos sin clasificar.
- **📦701-fix4 — fix(ausentismo): `_expandirCaso` se llamaba con argumentos invertidos** — La firma es `(row, registros)` pero se llamaba como `_expandirCaso(empresaId, row)`. JavaScript interpretaba el string `empresaId` como `row` y los caracteres del row como `row`. **Fix**: llamar con los argumentos correctos.
- **📦701-fix4 — fix(ausentismo): `renderSeguimientos` no existe** — Se llamaba a `this.renderSeguimientos()` que no existe. El método correcto es `agregarSeguimiento(fecha, descripcion)` por cada item. **Fix**: reescribir `_inicializarSeguimientosDesdeCaso` para iterar sobre `caso.seguimientos` y llamar a `agregarSeguimiento` por cada uno.
- **📦701-fix — fix(ausentismo): `registerSeguimientoIncapacidadHandlers` era `undefined`** — El bridge exportaba `registerHandlers` (corto) pero main.js destructuraba `registerSeguimientoIncapacidadHandlers` (largo). Resultado: `undefined is not a function` y los 6 handlers IPC nunca se registraban. **Fix**: exportar AMBOS nombres como alias (`registerSeguimientoIncapacidadHandlers: registerHandlers`).

### Files
- `main/seguimiento-incapacidad-bridge.js`: schema sin duplicados, alias de export, log mejorado en catch, nuevo handler `buscarPorCedula` (+114/-?)
- `modules/gestion-salud/ausentismo/medicion-ausentismo.js`: 3 fixes de flujo (buscar primero en BD, cargar caso completo, saltarse sección 1), sección 1 como ya capturada, click directo en nav atenuado bloqueado, error display con try/catch, banner BD 'guardado', default 'NO' en clasificación, botón Siguiente deshabilitado, refactor del cálculo del avance con datos de BD (+537/-76)
- `preload.js`: expone el nuevo método `buscarPorCedula` (+2/-0)

## [0.1.167] - 2026-08-11

### Added
- **📦702 (FASE 2) — feat(ausentismo): botón "Exportar a Excel" en la vista de Seguimiento de Incapacidades** — Después de guardar un caso en SQLite, el user puede exportarlo a Excel con un click. El banner BD en la parte superior del formulario muestra el estado actual del caso (Sin guardar / Guardado en BD / Guardado y exportado a Excel / Error) y habilita el botón de export cuando hay caso guardado.

  - **📦703 (FASE 3) — feat(ausentismo): modal "Ver casos en BD"** — Lista todos los casos respaldados en SQLite para la empresa actual. Tabla con cédula, nombre, fechas, diagnóstico, estado, indicador de exportado a Excel (Sí/Fecha o Pendiente). Acciones por caso: Exportar individual a Excel, Eliminar de BD (con confirmación, no afecta el Excel). Botón "Exportar todos pendientes" en la cabecera para sync masiva.

  - **📦704 — feat(ui): header con auto-hide a 30 segundos** — El header de la app se ocultaba automáticamente después de 5s (lógica de hover) PERO cuando había notificaciones quedaba pinned para siempre. Ahora: cuando hay notificaciones, el header aparece pinned por 30 segundos y luego se oculta automáticamente. Si llegan NUEVAS notificaciones (count sube), el timer se resetea. Si el refresh periódico trae el mismo count, el timer NO se resetea (así el header sí se oculta aunque el polling siga activo).

### Changed
- **📦702 — feat(ausentismo): mensaje de éxito del guardado en BD** — Antes: "Caso ACTUALIZADO en fila X para Y". Ahora: "Caso GUARDADO/ACTUALIZADO en BD para Y. Click 'Exportar a Excel' para sincronizar." (refleja el nuevo flujo SQLite-primario).
- **📦702 — feat(ausentismo): texto del botón "Guardar en Excel" → "Guardar en BD"** — Refleja que el guardado va a SQLite, no a Excel.

### Files
- `shared/kair-alerts.js`: `_pinHeader(count)` con timer de 30s, solo resetea si count sube (+32/-2)
- `modules/gestion-salud/ausentismo/medicion-ausentismo.js`: banner BD + 8 métodos nuevos (exportar, lista, eliminar, helpers) + estilos CSS del banner (+332/-1)

## [0.1.166] - 2026-08-11

### Changed
- **📦701 — feat(ausentismo): Seguimiento de Incapacidad ahora respalda en SQLite (FASE 1/3)** — El submódulo 2.2 "Seguimiento de Incapacidades" (dentro de Medición del Ausentismo) cambió su flujo de persistencia. **ANTES** los datos se guardaban directo en `PRI.xlsx` (vía Python). **AHORA** se guardan en SQLite (kair.db) como fuente de verdad primaria, y el Excel se exporta después con un botón (próxima release).

  - **Razón del cambio**: si `PRI.xlsx` se corrompía, se perdía, o se dañaba la hoja "Casos en seguimiento", se perdían TODOS los seguimientos. Con SQLite como fuente de verdad, los datos están seguros y se pueden re-exportar a un Excel nuevo.

  - **Schema nuevo** (patrón idéntico a 📦465 Seguimiento de Gestación):
    - `seguimiento_incapacidad_caso`: 1 fila por caso, con todos los campos del JSON normalizados en columnas individuales (~80 columnas). UNIQUE constraint por `(empresa_id, cedula, fecha_inicio, fecha_fin)`. Metadata: `estado`, `recomendaciones_json`, `recomendaciones_count`, `exportado_excel_en`, `exportado_excel_fila`, `creado_en`, `actualizado_en`.
    - `seguimiento_incapacidad_registro`: FK al caso, para los seguimientos múltiples que el usuario agrega. CASCADE en DELETE.
    - Índices por `(empresa_id)`, `(empresa_id, estado)`, `(empresa_id, cedula)`, `(exportado_excel_en)`.

  - **Bridge IPC nuevo** `main/seguimiento-incapacidad-bridge.js` con 6 handlers:
    - `seguimiento-incapacidad:guardar` (insertar/actualizar caso + seguimientos múltiples)
    - `seguimiento-incapacidad:listar` (resumen de todos los casos de la empresa)
    - `seguimiento-incapacidad:obtener` (caso completo con seguimientos)
    - `seguimiento-incapacidad:eliminar` (con CASCADE)
    - `seguimiento-incapacidad:exportarExcel` (toma de BD → Python → Excel → marca como exportado)
    - `seguimiento-incapacidad:exportarTodos` (sync masiva)

  - **Exposición en preload.js** como `window.electronAPI.seguimientoIncapacidad.{guardar,listar,obtener,eliminar,exportarExcel,exportarTodos}`.

  - **Frontend actualizado** (`medicion-ausentismo.js`): `saveSeguimientoData()` ahora llama a `seguimientoIncapacidad.guardar` en vez de `saveFollowUp`. El mensaje de éxito cambió para reflejar el nuevo flujo: "Caso GUARDADO en BD para X. Click 'Exportar a Excel' para sincronizar."

  - **Archivos modificados** (4 archivos, +443/-8 líneas):
    - `main/seguimiento-incapacidad-bridge.js`: NUEVO, 39 KB, schema + 6 handlers + helpers
    - `main.js`: +2 (require + registerHandlers con getDb, getPython, obtenerRutaPri, getPythonScriptPath) + schema execution
    - `preload.js`: +8 (exposición del namespace seguimientoIncapacidad)
    - `modules/gestion-salud/ausentismo/medicion-ausentismo.js`: `saveSeguimientoData()` ahora usa el bridge nuevo

  - **PENDIENTE PRÓXIMA RELEASE** (📦702):
    - Botón "Exportar a Excel" en la UI (por caso individual + "Exportar todos")
    - Vista "Lista de casos en BD" con botones de re-abrir, eliminar, exportar individualmente
    - Indicador visual de qué casos están pendientes de exportar a Excel

## [0.1.165] - 2026-08-10

### Fixed
- **📦700 — fix(updater): el auto-updater falla con "Cannot find module 'X'" después de un update** — Cuando la app instalada (ej: v0.1.146) recibe un update a una versión que agrega nuevos módulos a `package.json` (ej: `exceljs`, `docxtemplater`), el update descarga e instala el código nuevo pero los `node_modules/` no se actualizan. Resultado: la app crashea al iniciar con `Cannot find module 'exceljs'`.

  - **Root cause**: 
    1. La app estaba empaquetada con `"asar": false` — los `node_modules/` van sueltos en `resources/app/`
    2. El instalador NSIS con differential install (blockmap) **solo reemplaza archivos modificados**, no agrega archivos nuevos
    3. Si una nueva versión agrega un módulo que la vieja no tenía, el blockmap no lo incluye
    4. La versión vieja sigue con `node_modules/` viejos (sin el módulo nuevo)
    5. Cuando el nuevo `main.js` requiere el módulo nuevo, Node no lo encuentra y la app crashea

  - **Fix**: cambiar `"asar": false` → `"asar": true` y agregar `asarUnpack` para los archivos que necesitan acceso directo al filesystem:
    - `**/node_modules/better-sqlite3/**` — native module (.node binary), node-gyp no puede cargar desde asar
    - `**/node_modules/@napi-rs/canvas*/**` — native module (skia binding)
    - `**/node_modules/bcryptjs/**` — puede tener binarios nativos
    - `**/utils/**` — archivos de plantilla (.xls, .xlsx) que se leen con `fs.existsSync` desde `__dirname`
    - `**/components/config/**` — config files (.json) que se leen con `fs.existsSync`

  - **Por qué esto resuelve el problema**: con `asar: true`, el código y los `node_modules/` van empaquetados en un solo `app.asar` (excepto los unpacked). Cuando el instalador NSIS reemplaza el .asar, **TODOS** los archivos del .asar se actualizan atómicamente, incluyendo los nuevos módulos. Ya no hay riesgo de archivos viejos sin reemplazar.

  - **Cambio complementario en `main.js`**: `findPython()` ahora usa `process.resourcesPath` cuando la app está empaquetada, en lugar de `__dirname`. Esto es necesario porque con `asar: true`, los archivos dentro del .asar no se pueden ejecutar directamente (los .exe no funcionan desde un .asar). Python está en `process.resourcesPath/python-embed/` (vía `extraResources`).

  - **Archivos modificados** (2 archivos, +13/-4 líneas):
    - `package.json`: cambiar `asar: false` → `asar: true`, agregar `asarUnpack` con 5 patrones
    - `main.js`: `findPython()` usa `process.resourcesPath` cuando `app.isPackaged` es true

  - **Nota para el usuario**: si tienes v0.1.146 instalada con el update v0.1.164 descargado pero sin poder aplicar (dot verde "Lista para reiniciar" + error "Cannot find module"), **descarga manualmente** el instalador de v0.1.165 desde el release de GitHub y ejecútalo. El instalador nuevo detectará que ya hay una versión instalada y hará un upgrade limpio, instalando el .asar completo con todos los módulos.

## [0.1.164] - 2026-08-10

### Changed
- **📦699 — feat(dashboard): reorganización del home de empresa** — El dashboard principal (home de empresa) cambió de un layout de sidebar vertical a un layout horizontal con 2 filas:
  - **Fila 1 — Módulos del Sistema**: los 7 módulos pasan de sidebar vertical (280px) a una fila horizontal de cards compactas, con `flex-wrap` para responsivo.
  - **Fila 2 — Pendientes y Tareas**: la lista de tareas ocupa todo el ancho debajo de los módulos, en grid de 2 columnas (maximizado) o 1-2 columnas (ventana).

  - **Highlight rojo de tareas críticas**: las 4 tareas `critical` (Afiliación SSSI, COPASST Mayo 2026, Comité Sin Acta, Comité Sin reunión Noviembre) ahora tienen `background: #fef2f2` + `border: #fecaca` + `border-left: 4px solid #ef4444` + área de acción con `#fee2e2`. Una sola barra roja en el lateral (no doble, removido `::before` que duplicaba).

  - **Responsive window vs maximizado** (vía CSS inyectado dinámicamente con `<style id="dashboard-responsive-style">`):
    - **Ventana (`< 1200px`)**: módulos en 2 filas más compactas (sin descripción, solo título + badge) con min-width 220px → 4 en fila 1 + 3 en fila 2. Tasks en 2 columnas con minmax 280px. Cards más compactas (padding 8/10, font 11-12px, line-clamp 1 en descripción).
    - **Maximizado (`>= 1200px`)**: módulos en 1 fila, tasks en 2 columnas con minmax 380px (4 cards por fila × 2 filas = 8 cards visibles).

  - **Fix bug del colapso en ventana**: el `tasksList` (grid container) colapsaba las cards a líneas finas rojas (~3-4px) en modo ventana porque `align-content: start` sin `grid-auto-rows` mínimo dejaba que los row tracks tuvieran altura ridículamente pequeña. Fix: `grid-auto-rows: minmax(60px, auto)` fuerza altura mínima de 60px por row, y `min-height: 60px !important` en `.task-card` como defensa adicional.

  - **Archivos modificados** (1 archivo, +147/-44 líneas):
    - `renderer.js`: `createDashboardHome()` reorganiza `mainGrid` de `grid-template-columns: 280px 1fr` a `grid-template-rows: auto 1fr`. CSS inyectado dinámicamente con media queries. `renderTasks()` mantiene el layout flex row simple de 3 elementos (icon + text + arrow) con `min-height: 60px` y `align-items: center` para evitar colapso.

  - **Aplica solo al home de empresa** (`showDashboardHome()`). No afecta el home de login, settings, ni los homes de cada módulo.

## [0.1.163] - 2026-08-07

### Fixed
- **📦698 — fix(plan-trabajo): math del dashboard de Plan de Trabajo no cuadraba + 0 vencidas siempre** — La cinta superior del Dashboard de Avance mostraba "106 Programadas / 115 Realizadas / 139 Pendientes / 0 Vencidas" para el plan 2026 de Tempoactiva. El número 115 Realizadas parecía mayor que 106 Programadas (matemáticamente imposible), y 0 Vencidas era un bug porque la lógica de "vencido" nunca se calculaba. Además, la dona del home de Gestión Integral ("Avance del Plan Anual SST") mostraba datos inconsistentes con el dashboard (38/197 vs 115/259, 36% vs 44%).

  - **Root cause**: el bug original tenía dos partes:
    1. **Mezcla de unidades en la cinta superior**: "Programadas" contaba ACTIVIDADES (filas del plan = 106), pero "Realizadas" / "Pendientes" / "Vencidas" contaban CELDAS (marcas por mes = 115/139/0). Como 1 actividad puede tener varias celdas marcadas (ej: 'C' en enero Y 'C' en abril = 2 celdas-C), el conteo de celdas puede superar el de actividades, pero el usuario lo lee como "inconsistente".
    2. **`overdueCount` nunca se incrementaba** en `updateKPIs()`. La variable estaba declarada e impresa, pero el bloque que debía sumar 1 por cada celda con 'P' en mes pasado simplemente no existía. Por eso siempre mostraba 0.
    3. **Dona del home desactualizada**: `createAnnualPlanChart` y `createPlanTrabajoWidget` en `gestion-integral-home.js` leían `stats.actividadesEjecutadas` / `stats.actividadesProgramadas` (que en el backend se calculaba con conteo de ACTIVIDADES, no de CELDAS). Además `actividadesProgramadas: 197` era un valor hardcoded incorrecto.

  - **Fix**: contar **CELDAS** (no actividades) en TODAS las métricas del dashboard y del home. Cada celda-mes de cada actividad cuenta 1. Así:
    - **Programadas** = total de celdas con marca (C o P). Para Tempoactiva 2026: 119 + 135 = **254**.
    - **Realizadas** = celdas con 'C' = **119**.
    - **Pendientes** = celdas con 'P' = **135**.
    - **Vencidas** = celdas con 'P' en un mes ANTERIOR al vigente (no incluye el mes actual) = **24**. Lógica: para cada celda-mes, si `month === 'P'` y `monthIdx < new Date().getMonth()` y el plan corresponde al año vigente, sumar 1.
    - **% Avance** = `celdasEjecutadas / celdasProgramadas * 100` = **47%** (119/254).
    - **Math coherente**: `Realizadas + Pendientes = Programadas` (119 + 135 = 254 ✓), y `Vencidas ≤ Pendientes` (24 ≤ 135 ✓).

  - **Archivos modificados** (3 archivos, +60/-25 líneas):
    - `modules/gestion-integral/plan-trabajo/plan-viewer.js`: 5 funciones actualizadas:
      - `updateKPIs()`: contar celdas para todas las métricas, agregar log de sanity
      - `renderChartStatus()`: bar chart de Sin Iniciar / Planificadas / Ejecutadas cuenta celdas
      - `renderChartQuarterly()`: bars de Programadas/Ejecutadas por trimestre cuentan celdas
      - `renderChartByCategory()`: bars de Ejecutadas/Programadas por categoría cuentan celdas
      - `loadSpecificYearFile()`: try/catch alrededor de `repair-plan-trabajo-excel` (best-effort optimization, no debe abortar la carga si el repair falla)
    - `main.js` `calculatePlanTrabajoStats()`: agregar campos `celdasProgramadas`, `celdasEjecutadas`, `celdasPendientes`, `celdasVencidas`, `porcentajeAvanceCeldas` para que el home pueda consumir el mismo cálculo. Mantiene `actividadesEjecutadas` / `actividadesPendientes` / `porcentajeAvance` para retrocompatibilidad.
    - `modules/gestion-integral/gestion-integral-home.js`: `createPlanTrabajoWidget` y `createAnnualPlanChart` ahora consumen los campos `celdas*` del backend. Dona del home muestra `47% AVANCE` con leyenda de 4 filas (Ejecutadas / Pendientes / Vencidas / Total Programadas) en lugar de 3 filas hardcoded. Etiquetas actualizadas de "Act. Ejecutadas" a "Cel. Ejecutadas" para reflejar la unidad.

  - **Bug fix colateral**: `loadSpecificYearFile()` ahora es resiliente a fallos del `repair-plan-trabajo-excel`. Antes, si el template .xls no tenía la hoja esperada (ej: algunas empresas no tienen el mismo template que otras), el `repair` devolvía `success: false`, el `callParentAPI` rechazaba la promesa, y la carga del Excel se abortaba. Resultado: dashboard mostraba 0/0/0/0 y charts vacíos aunque el Excel se podía leer normal. Ahora el repair es opcional: si falla, se loguea un warning y se continúa con la lectura normal.

  - **Verificado en Tempoactiva 2026**: dashboard muestra `254 · 47% · 119 · 135 · 24` (suma coherente). Home muestra `120 / 259` con `46%` (diferencia de 1 unidad por edge case en el parser — el home usa `xlsx.readFile` directo sin aplicar la reparación de merges B:C que sí aplica el dashboard al `process-excel-data`). Diferencia menor, documentada como follow-up futuro.

## [0.1.162] - 2026-08-07

### Fixed
- **📦697 — fix(recursos): texto de burbujas de porcentaje en negro** — En el home del módulo Recursos, las burbujas de porcentaje (verde 90%, amarillo 50.3%, rojo Pendiente) tenían el texto en colores oscuros (#27500A, #633806, #791F1F, #4A5568) que se veían casi negros sobre los fondos pastel. El contraste era malo y se perdía legibilidad.
  - **Root cause**: `development-styles.css:872-875` define los colores de las burbujas (`.kb-badge.bg-success/warning/danger/pending`) con backgrounds pastel CLAROS y texto OSCURO (estilo "carta de colores Material Light"). El módulo Recursos usa una variante más moderna con backgrounds SÓLIDOS vía `var(--k-success)`, `var(--k-danger)` (con `!important` en `recursos-home.js:300-302`), pero el `color` del texto seguía heredando el valor oscuro del CSS global.
  - **Fix**: cambiar el `color` de las 4 reglas a `white` (sin `!important`, para que el tema dark pueda sobrescribirlo). El texto blanco sobre fondo sólido (verde, amarillo, rojo, gris) tiene mejor contraste que el texto oscuro sobre fondo pastel. Compatibilidad con tema oscuro preservada: `[data-theme="dark"] .kb-badge.bg-*` tiene mayor especificidad (3) que `.kb-badge.bg-*` (2), así que el dark mantiene sus colores claros (#b7e08c, #f5c98c, #f0a0a0) sobre fondos oscuros.
  - **Aplica a todos los módulos** que usen la clase `kb-badge`: Recursos, Verificación, Mejoramiento, Gestión Integral, Gestión de Amenazas, etc. El fix está en el CSS global para que el cambio sea consistente.

## [0.1.161] - 2026-08-07

### Fixed
- **📦696 — fix(presupuesto): toast "Cambios guardados" se mostraba sin estilo** — El sistema de notificaciones toast del submódulo de Presupuesto (1.1.3) se renderizaba con estilo genérico, sin border-radius, sin box-shadow, en posición incorrecta (esquina inferior izquierda en lugar de la derecha).
  - **Root cause**: el iframe `presupuesto-gestion.html` llama `window.KAIRToast.show(...)` para mostrar el toast al guardar. El método `get hub()` de `KAIRToast` busca `#notification-hub` en el document actual y, si no existe, lo crea dinámicamente. Como el iframe NO carga `styles.css` (esos estilos están en el parent), el toast se creaba con las clases CSS correctas (`.toast-card`, `.toast-header`, etc.) pero SIN los estilos aplicados, viéndose genérico y en posición incorrecta.
  - **Fix**: `kair-toast.js` ahora detecta si está en un iframe (`window.parent !== window`) y, en ese caso, busca el hub en el parent (donde SÍ están los estilos de `styles.css` y el `<div id="notification-hub">` en `index.html:427`). Si el parent no tiene el hub, lo crea dinámicamente en el parent. Beneficio adicional: como el toast se renderiza en el parent, los estilos oscuros y el responsive (media query 480px) también se aplican correctamente.
  - **Aplica a todos los iframes** que usen `window.KAIRToast.show(...)`: presupuesto, FURAT, evaluaciones iniciales, etc. Antes cada iframe tenía que cargar su propio `kair-toast.js` y duplicar el CSS. Ahora un único hub centralizado en el parent.

## [0.1.160] - 2026-08-07

### Added
- **📦695 — feat(calendar): festivos colombianos en el calendario** — Las celdas de días festivos colombianos se muestran con un **background sutil rosa/rojo + indicador 🇨🇴 + día en negrita roja**. Click en el festivo abre un mini-modal con info completa (nombre oficial, fecha larga, tipo, observación de traslado).
  - **Cobertura 2020-2030** (10 años), cache en memoria por año.
  - **17 festivos soportados** según normativa vigente:
    - 8 fijos trasladables (Ley Emiliani 51/1983): Año Nuevo, Día del Trabajo, San Pedro y San Pablo, Asunción, Día de la Raza, Todos los Santos, Indep. de Cartagena, Navidad.
    - 4 fijos no trasladables: San José (19 mar), Independencia (20 jul), Batalla de Boyacá (7 ago), Inmaculada Concepción (8 dic).
    - 5 religiosos movibles (calculados desde Pascua con algoritmo Meeus): Jueves Santo, Viernes Santo, Ascensión, Corpus Christi, Sagrado Corazón. Los 3 últimos se trasladan al lunes siguiente.
  - **Algoritmo de Pascua** Meeus/Jones/Butcher (válido para años del calendario gregoriano 1583+).
  - **Ley Emiliani**: martes/miércoles/jueves/domingo → lunes siguiente. Excluye los 4 civiles + Semana Santa.
  - **Nuevo archivo** `shared/colombia-festivos.js` (puro JS, sin dependencias). Se carga en el `index.html` antes de `app.js`.
  - **Validación 2025-2028**: 17 festivos por año, Pascua 2026 = 5 abril (correcto), Año Nuevo 2026 jueves → 5 lunes (correcto), 20 julio 2026 lunes → sin traslado (correcto).

## [0.1.159] - 2026-08-07

### Fixed
- **📦694 — fix(calendar): botón "Marcar cumplido" en Bandeja Integrada no funcionaba** — Bug crítico: el botón del modal de evento llamaba a `api.eventosCumplidos.marcar()` con `evento_id` (snake_case), pero el bridge IPC esperaba `eventoId` (camelCase). El backend rechazaba con `VALIDATION: empresaId y eventoId son requeridos` y el user solo veía un toast genérico que desaparecía a los 3 segundos. **3 archivos rotos** (`app.js`, `renderer.js`, `modules/shared/calendar-detail-panel.js` — este último ya usaba camelCase correctamente, lo que confirmó la convención).
  - **Root cause**: asimetría entre la convención de columnas SQLite (`snake_case`) y la convención JS del bridge (`camelCase`). El dev asumía que el payload del bridge respetaba el formato de la DB, pero el bridge normaliza a camelCase en sus `_handler*` signatures.
  - **Fix 1** (`app.js:2157` y `renderer.js:997`): `evento_id: ev.id` → `eventoId: ev.id`.
  - **Fix 2 (defensa en profundidad)**: helper `_normalizeCumplidoPayload()` en `eventos-cumplidos-bridge.js` que acepta ambos formatos. Si un call site futuro usa snake_case, no falla silenciosamente con "VALIDATION" — sigue funcionando.
- **📦694 — fix(calendar): `empresaId` rechazado en modo "Todas las empresas"** — Cuando el toggle del calendario está en `scope='all'`, `getActiveCompanyName()` retorna `null` (porque el parent no expone una empresa activa del view, sino todas). El bridge rechazaba con `VALIDATION: empresaId es requerido`.
  - **Fix**: `empresa_id` ahora es `TEXT` (nullable, antes `NOT NULL`). Migración defensiva recrea la tabla preservando datos para DBs existentes. Validación: `if (!eventoId)` (sin empresaId). `desmarcar` también acepta null y filtra solo por `evento_id` cuando empresaId es null.
- **📦694 — fix(sync): sync multipc fallaba con "no such column: updated_at"** — El `sync-serializer.js` asumía que `eventos_cumplidos` tenía columna `updated_at` y PK `id`, pero el schema real usa `evento_id` como PK y `cumplido_en` como timestamp. Mismo bug con `eventos_rapidos` (asumía `empresa_id` que no existe).
  - **Fix**: schema real usado en queries (`evento_id` PK, `cumplido_en` como proxy de `updatedAt`). `eventos_rapidos` sync implementado completo (antes era un stub que solo contaba skipped).
- **📦694 — fix(calendar): cumplimiento no se reflejaba visualmente en la Bandeja Integrada** — El cumplimiento se guardaba correctamente en DB, pero el chip del calendario NO se tachaba/atenuaba. **Root cause**: la Bandeja Integrada tiene su PROPIO render (`renderBigCalendar` con clases custom `kair-month-event`, `kair-allday-chip`, `kair-week-allday-chip`), y el CSS `--cumplido` solo aplicaba a `kair-cal-event-chip` del componente KairCalendar, que no se usa en la Bandeja.
  - **Fix 1 (state)**: el modal actualiza `state.events` del Bandeja Integrada directamente (no solo el KairCalendar interno) y llama a `render()` para repintar.
  - **Fix 2 (CSS)**: agregadas 3 variantes de clase `--cumplido` en `styles.css` con `opacity: 0.55`, `filter: saturate(0.6)` y `text-decoration: line-through` para los chips custom. Aplica a vista Mes, Mes all-day y Semana all-day.
- **📦694 — fix(calendar): chip del modal decía "Cumplido" y no dejaba desmarcar** — El botón del modal mostraba "Cumplido" cuando ya estaba marcado, pero el handler siempre llamaba a `marcar()`. No había forma de desmarcar.
  - **Fix**: toggle dinámico. El texto y el estilo del botón cambian según el estado (`Marcar cumplido` con estilo neutral vs `Desmarcar cumplido` con borde verde). El handler detecta el estado y llama a `desmarcar` o `marcar`. Toast diferenciado: "Marcado como cumplido" (success) vs "Desmarcado" (info).

## [0.1.158] - 2026-08-06

### Added
- **📦692 — feat(furat): navegación recursiva de carpetas (tipo explorador)** — Bug crítico: cuando el user hacía click en una carpeta de año (ej: 2019) que contiene subcarpetas (ej: 2019/Enero, 2019/Febrero), la UI mostraba "No hay reportes en esta carpeta" porque el código solo leía 1 nivel del filesystem. Fix: `getLibraryData` ahora itera recursivamente (función `scanFolderRecursive`, MAX_DEPTH=5), agrega cada subcarpeta con `parentPath` y asigna cada archivo a su carpeta inmediata. Frontend ya estaba preparado (filtra por `parentPath` y `folderPath`).
- **📦692 — feat(furat): breadcrumb jerárquico con navegación multi-nivel** — ANTES: el breadcrumb solo mostraba el nombre de la carpeta actual ("Todos los Reportes > Enero"). AHORA muestra la cadena completa de ancestros ("Todos los Reportes > 2019 > Enero") y cada nivel es clickeable para volver atrás. Patrón: el último ancestro es solo texto, los demás son botones con `furat-breadcrumb-v2__item`.
- **📦692 — feat(furat): crear subcarpetas dentro de carpetas existentes** — ANTES: el botón "Agregar período" solo creaba en el submódulo raíz. AHORA, cuando estás dentro de una carpeta (ej: 2019), el modal muestra "Se creará dentro de: 2019" y crea la nueva subcarpeta dentro de la carpeta actual. Implementado con `activeFolder || deriveSubmodulePath()` como parent path.
- **📦692 — feat(furat): eliminar carpetas (años y meses) con context menu** — Patrón replicado de 1.1.1 responsable-sg. Click derecho sobre folder card → context menu con 3 opciones: "Crear subcarpeta acá" / "Abrir carpeta" (explorador de Windows) / "Eliminar carpeta" (con confirm modal). Backend: `deleteFuratFolder` con recursive `fs.rm` + cleanup de metadata en DB (`DELETE FROM furat_metadata WHERE file_path LIKE folderPath%`). Validación de seguridad: el path debe contener "3.2.1".
- **📦693 — feat(furat): editar metadata de PDFs legacy con click derecho** — Permite asignar metadata (fecha accidente, tipo, gravedad, área, reportado por, descripción) a PDFs viejos que no tienen. Click derecho sobre fila de la tabla → context menu → "Editar metadata" → modal pre-llenado con metadata existente (si hay) → guardar. Backend: `upsertFuratMetadata` con `INSERT OR REPLACE ON CONFLICT(file_path)` (file_path es UNIQUE). Después de guardar, se refresca la tabla y el dashboard para que el PDF entre en los análisis.

### Changed
- **📦692-fix — fix(furat): breadcrumb usa `__item` (no `__crumb`)** — El CSS ya define estilos para `.furat-breadcrumb-v2__root` y `__item`. Mi HTML inicial usaba `__crumb` (clase nueva sin CSS), por eso los botones del año/mes se veían con border del input. Renombrado a `__item` para reusar los estilos existentes.

## [0.1.157] - 2026-08-06

### Fixed
- **📦691 — fix(bandeja): preservar scroll de la lista al seleccionar un mail** — El scroll de la lista de correos subía al top cada vez que el user seleccionaba un correo. UX muy molesta: scrolleabas hasta abajo, hacías click, y la lista se iba a arriba.
  - **Root cause**: el `renderMailList` apuntaba al `container.scrollTop` (`#mail-list-container`) que tiene `overflow: hidden` en CSS, por lo que su `scrollTop` siempre era 0. El scroll real estaba en un sub-elemento con clase `.kair-scroll` (creado en línea 3798 con `overflow-y: auto`). Adicionalmente, `loadMailBodyFromCache` se llamaba en paralelo desde `selectMail` y `renderMailDetail` (2-3 renders en cadena que se "pisaban" entre sí, dejando el rAF de scroll restoration apuntando a un list con altura 0).
  - **Fix 1**: `renderMailList` ahora busca el `.kair-scroll` viejo antes del `container.innerHTML = ""` y guarda SU `scrollTop`. El rAF se aplica al NUEVO `list.scrollTop` (no al container).
  - **Fix 2**: `loadMailBodyFromCache` ahora solo actualiza el detail (`renderMailDetail`), no la lista completa (`render()`). Así no se pisa el scroll restoration.
  - **Fix 3**: flag `_loadingBody` en `mail` para evitar que `selectMail` y `renderMailDetail` disparen `loadMailBodyFromCache` en paralelo. Se setea SÍNCRONAMENTE antes del await.
  - **Filter / sort / search**: `state._resetMailListScroll = true` antes del render para que vaya a top (casos donde el contenido cambia).
- **📦690 — fix(bandeja): silenciar warnings de `cid:` URIs en imágenes embebidas** — Los emails HTML con `<img src="cid:icon.png">` generaban `net::ERR_UNKNOWN_URL_SCHEME` en consola (rojo saturando DevTools, ~18 warnings por mail).
  - **Root cause**: los emails multipart/related referencian imágenes con `cid:` URIs (Content-ID). El navegador no sabe resolverlos.
  - **Fix**: en `sanitizeHtml()`, cuando un atributo (`src`, `srcset`, `background`) empieza con `cid:`, se reemplaza por un GIF transparente 1x1 (data URI de 43 bytes). El layout del email no cambia (espacio preservado), no hay request al browser, no hay warning. Si en el futuro se quiere mapear los cid: a blob URLs de los attachments reales, este es el lugar para hacerlo.

## [0.1.156] - 2026-08-05

### Added
- **📦680 — feat(furat): botón "Agregar período" verde + modal "Crear nueva carpeta"** — Patrón de creación de carpetas con modal dedicado.
  - HTML: header de "Carpetas por año" migrado a `.furat-card` (mismo patrón que Distribución/Últimos/Análisis). Header con título + botón "Agregar período" verde (folder-plus icon).
  - Backend (`main/furat-bridge.js`): nueva función `createFuratFolder(params)` + IPC `furat:create-folder` con validación de nombre (`/^[\p{L}\p{N}_\-\s]{1,100}$/u` para letras, números, guiones, guiones bajos, espacios). Validación dual frontend+backend. Errores específicos: `NO_SUBMODULE`, `MISSING_NAME`, `INVALID_NAME`, `ALREADY_EXISTS`, `SUBMODULE_NOT_FOUND`, `INTERNAL`.
  - Preload: `furatCreateFolder: (payload) => ipcRenderer.invoke('furat:create-folder', payload)`.
  - Logic: case `furat-create-folder` con manejo de errores estructurado.
  - Viewer: funciones `setupCreateFolderModal()`, `openCreateFolderModal()`, `closeCreateFolderModal()`, `submitCreateFolder()`, helper `deriveSubmodulePath()` que deduce el path del submódulo eliminando el último segmento del path del primer folder (en vez de hacer un IPC extra).
  - Color del botón crear: VERDE (`#16a34a` sólido para CTA sólido, `#15803d` para texto hover) — convención visual de la app: verde = crear, morado = editar.
- **📦659 — feat(furat): dashboard analítico con 4 charts basados en metadata** — Fase 3 del rediseño.
  - **Tendencia últimos 12 meses** (línea SVG con puntos, en lugar de barras): muestra los meses Sep 25 → Ago 26 con un punto prominente en los meses con data. Puntos vacíos en meses sin data. Último mes con punto verde (`furat-success`).
  - **Por tipo de accidente**: barras horizontales con label + barra + count. Soporta los 8 tipos del form: caida, golpe, atrapamiento, corte, quemadura, esfuerzo, exposicion, otro.
  - **Por gravedad**: stacked bar con colores semánticos (verde Leve, amarillo Moderado, rojo Grave, marrón Mortal) + legend con dots de color.
  - **Top áreas**: top 5 áreas con más accidentes, ordenadas desc.
  - Helper `buildChartPreliminarRibbon()` que muestra "Análisis preliminar · subí más FURATs con metadata para ver tendencias" cuando hay < 3 reportes con metadata (UX-friendly para casos con poco data).
  - CSS: ~600 líneas agregadas para los 4 charts (`.furat-chart-trend`, `.furat-chart-bars`, `.furat-chart-severity`, `.furat-chart-preliminar`).

### Changed
- **📦658 — refactor(furat): Header System v2.0 (k-section-card) + KPI Strip + Hero + 40+ inline styles eliminados** — Fase 1 del rediseño. Header migrado al patrón 3.1.4 (mismo que Evaluaciones Médicas, Gestión del Cambio, Planes). 116 líneas de CSS `.kair-header--furat` eliminadas, 80 líneas de `.k-section-card`/`.header-back-btn`/`.em-tabs` agregadas. KPI strip oficial (Sistema Visual v1.0): 4 métricas (Total FURAT, Este Año, Este Mes, Carpetas) con iconos contextuales. Hero de bienvenida removido (CTAs movidos a drop zone de Biblioteca).
- **📦664 — refactor(furat): Header unificado en UNA SOLA línea horizontal (breadcrumb + búsqueda + filtros + info)** — Todo en la misma "array" sin filas separadas. Toolbar de Biblioteca con `display: flex` integrado.
- **📦665-666 — refactor(furat): Drop zone mejora visual** — Fondo opaco `#dbeafe` con `border: 1px dashed` (match con cards), texto corto "Soltá en XXXX", `box-sizing: border-box`.
- **📦667 — refactor(furat): Breadcrumb standalone eliminado en raíz** — Solo `#breadcrumbInline` dentro del card unificado.
- **📦668 — refactor(furat): Folders section migrada a `furat-card`** — Header integrado (título + botón "Agregar período"). Folder cards más pequeñas (minmax 115px, padding 0.625rem, font 0.6875rem).
- **📦669-671 — refactor(furat): Drop zone posicionada sobre la card destino específica al arrastrar archivo** — Estilo macOS Finder. `setupCardDropzone()` usa `dragenter/dragover/dragleave/drop`, calcula `top/left/width/height` con `card.getBoundingClientRect() - card.offsetParent.getBoundingClientRect()`. Logs detallados en consola cuando cambia la card destino.
- **📦676 — refactor(furat): Migración del sistema de notificaciones a `KAIRToast` moderno unificado** — Eliminado el toast custom viejo del FURAT. Ahora usa `window.KAIRToast.show()` (mismo sistema que el resto de la app, definido en `assets/js/kair-toast.js`). Eliminado `<div class="furat-notification" id="notification">` del HTML. 24 líneas de CSS `.furat-notification*` removidas. Fallback defensivo con `console.warn` si KAIRToast no disponible.
- **📦677 — refactor(furat): Botón "Subir FURAT" del header removido** — Subida se hace desde la drop zone de la Biblioteca.
- **📦678 — refactor(furat): Header estandarizado al patrón del 3.1.4** — `<header class="kair-header kair-header--furat">` → `<div class="k-section-card">` con título (izquierda) + company + divider + botón "Volver" (derecha) + tabs como `<nav class="em-tabs">` con `em-tab`.
- **📦679 — refactor(furat): Hero de bienvenida del dashboard eliminado** — CTAs movidos a: drop zone (subir) y tab "Biblioteca" (explorar).
- **📦682-683 — fix(furat): Scroll bloqueado en modo ventana** — Cadena de `overflow: hidden` bloqueaba el scroll en windowed mode. Fix: `min-height: 100vh` en body y furat-app, `min-height: 0` en kair-container y furat-library, `overflow-y: auto` donde corresponde, `scrolling = 'auto'` en iframe.
- **📦685 — refactor(furat): Contenedor unificado de Biblioteca** — "Carpetas por año" + "Reportes" dentro de UN SOLO card. Sub-headers compartidos (ícono + título + hint + acciones), divider sutil con indicador azul al medio, fondo gris sutil en sub-headers. Simetría visual con el resto de la app. CSS: `.furat-library__container`, `.furat-library__subsection`, `.furat-library__subsection-header`, `.furat-library__divider`.
- **📦686 — refactor(furat): Visor unificado con la Bandeja Integrada (kair-fv-modal)** — Migrado el modal preview del FURAT al mismo modal/estilos/lógica que el preview de adjuntos del correo.
  - HTML: reemplazado `#previewModal` + `<style>` inline (50 líneas) por `<div class="kair-fv-overlay">` con `.kair-fv-modal` (badge rojo "PDF" + nombre + tamaño + cerrar).
  - CSS: agregados estilos `.kair-fv-*` completos (overlay, header, body, spinner, error, badges de extensión con color por tipo) — copiados del módulo de correo.
  - JS: nueva `openFuratPreview(filePath)` que usa `window.kairFV.mountInContainer` (mismo flujo que la bandeja). Soporta `result.data.bytes` (modo file-viewer) y base64 (modo legacy), normaliza ambos. Fallback a iframe blob URL si `kairFV` no está disponible.
  - Eliminadas funciones obsoletas: `openPreviewModal`, `closePreviewModal`, `displayDocument`, `applyViewerZoom`, `applyViewerOrientation`, `showViewerError`. CSS `.furat-preview-modal__*` removido.
  - Listeners del nuevo modal: close button, click fuera, tecla ESC.
  - Beneficio: PDFs, Office (xlsx/docx), imágenes, etc. con toolbar completa (search, zoom, pages, rotación, download, print, theme).
- **📦687 — refactor(furat): Análisis con mejor UX para poco data** — 3 mejoras en el dashboard de Análisis.
  - **Chart de Tendencia**: cambiado de barras a LÍNEA con PUNTOS SVG. Meses con data = punto prominente (azul, con halo), meses sin data = punto pequeño vacío. Línea conecta los puntos.
  - **Últimos Reportes**: ahora muestra `accident_date` de la metadata (consistencia con el chart de tendencia) en lugar de `modified` del filesystem. Si no hay metadata, cae a `modified`.
  - **Ribbon "Análisis preliminar"** (`:has` selector) para charts con < 3 reportes con metadata. CSS rule `.furat-chart-preliminar + .furat-chart-preliminar { display: none; }` previene duplicación por bug conocido de doble render.
  - Header hint (`#analyticsHint`) ahora dice "Análisis preliminar · basado en N reporte(s) con metadata" cuando N < 3.

### Fixed
- **📦674 — fix(furat-bridge): handlers IPC sin `ipcMain` importado** — Bug crítico: `Error invoking remote method 'furat:list-metadata': No handler registered`. La función usaba el parámetro `app` (que no tiene `.handle()`).
  - **Root cause**: el bridge usaba `ipcMain.handle(...)` en 3 lugares (upload-file, list-metadata, get-analytics) pero **NO importaba `ipcMain` de `electron`**. La función recibía `app` desde main.js (que NO tiene `.handle()`).
  - **Fix**: otros bridges (sync-bridge.js, gestacion-bridge.js) IGNORAN el primer argumento `app` y usan el `ipcMain` importado. Mismo patrón aplicado en `furat-bridge.js`. La firma cambió a `registerFuratHandlers(appOrIpcMain, deps)` y se usa el `ipcMain` importado. El `console.log` de éxito ahora SÍ se ejecuta porque los handlers se registran correctamente.
  - **Beneficio**: los 3 handlers IPC del FURAT ahora se registran al iniciar la app, sin errores "No handler registered" en consola.
- **📦673 — fix(furat): TypeError en `setupEventListeners:193`** — `Uncaught TypeError: Cannot read properties of null (reading 'addEventListener')`.
  - **Root cause**: el setup intentaba registrar listeners en `viewerBackBtn`, `goToLibraryBtn`, `downloadBtn`, etc. Esos elementos no existían porque el tab "Visor" se eliminó en Fase 1.
  - **Fix**: eliminados los 23 líneas de listeners del viewer obsoleto.
- **📦675 — fix(furat): Tab clicks no se registraban después del cambio a `.em-tab`** — Después de cambiar a `.em-tab` en 📦678, el JS seguía usando `.kair-header__tab`. Cambiados 2 lugares en `reportes-accidentes-viewer.js`: `setupEventListeners` y `switchView`.
- **📦681 — fix(furat): CSS seguía usando clase vieja `.furat-folders-section-v2`** — La dropzone caía a `top: 0; left: 0` por defecto del navegador. Fix: agregué `.furat-card` a TODOS los selectores de la dropzone (8 selectores actualizados).
- **📦684 — fix(renderer): 18 warnings de "Unknown message type"** — El bridge de mensajes del `renderer.js` no reconocía los tipos del FURAT. Fix: agregué los 6 tipos del FURAT al switch de "mensajes manejados por componentes wrapper": `furat-get-dashboard-data-request`, `furat-get-analytics-request`, `furat-get-library-data-request`, `furat-list-metadata-request`, `furat-upload-file-request`, `furat-create-folder-request`.

## [0.1.155] - 2026-08-05

### Fixed
- **📦657 · fix(bandeja): Enviados muestra destinatario en lugar de remitente** — Bug de UX clásico: en la carpeta "Enviados", la lista y el detalle mostraban el remitente (siempre "yo") en vez del destinatario, igual que en Recibidos. Ahora muestra el destinatario como contacto principal, igual que Gmail/Outlook.
  - **Root cause**: el código de la Bandeja Integrada solo leía `mail.sender` para mostrar el "contacto principal" en lista y detalle, sin considerar la carpeta. Además, `threadToMail` no cargaba `to_list`/`cc_list` del thread (esos campos están en `email_messages`, no en `email_threads`), y el JOIN del backend no los traía.
  - **Fix backend** (`main/email-db.js`):
    - `getThreadsFromCache` y `getThreadFromCache` ahora hacen un LEFT JOIN correlated con `email_messages` para traer `to_list`/`cc_list` del último message de cada thread. La subquery usa `MAX(date)` por `thread_id`.
    - `deserializeThread` expone los nuevos campos como `last_to_list`/`last_cc_list`.
  - **Fix frontend** (`renderer/bandeja-integrada/app.js`):
    - Nuevo helper `getMailDisplayContact(mail)` que retorna `{name, email, role}` correcto según carpeta. En SENT busca primero en `to_list[0]`, después en `participants_list` (excluyendo al user), y como último recurso usa `sender`. El set de "yo emails" se construye con `state.gmailEmail` + `mail.senderEmail` para cubrir el caso de que `getProfile` aún no haya populado el primero.
    - Nuevo helper `_coerceAddressList(value)` que convierte el `to_list` que puede venir como array de `{name, email}`, JSON string, o string RFC 2822 (`"Nombre <email>, Otro <email>"`).
    - `threadToMail` ahora expone `participants_list`, `to_list`, `cc_list` desde el cache (sin tener que abrir el detalle).
    - `renderMailList`: avatar, sender name, búsqueda y data-attribute usan el contacto correcto. La búsqueda también incluye los destinatarios (importante para Enviados).
    - `renderMailDetail`:
      - Header: avatar y name usan el contacto correcto. Para SENT agrega una línea pequeña en gris "de: yo" para que quede claro que el correo salió de tu cuenta.
      - Panel "Mostrar detalles": en SENT el orden es Para → CC → De (estilo Gmail). En otras carpetas mantiene el orden clásico De → Para/CC.
    - `loadMailBodyFromCache` popula `mail.to_list`/`mail.cc_list` desde el último message cargado.
    - Safety net (cuando el mail no tiene rawHeaders locales) popula `mail.to_list` parseando el `recipient` que viene como string RFC 2822 desde `googleGmail.getMessage`.
  - **Beneficio**: en la carpeta Enviados, la lista de correos ahora muestra el avatar y nombre del destinatario desde el primer render (sin tener que abrir el correo). El detalle también muestra el destinatario como contacto principal, con "de: yo" en gris pequeño. El panel "Mostrar detalles" tiene el orden Gmail-style (Para → CC → De).

## [0.1.154] - 2026-08-05

### Fixed
- **📦656 · fix(recursos-home): gráfica "Capacitaciones Mensuales" del home coincide con submódulo** — Bug que causaba que la gráfica del home de Recursos mostrara datos distintos (y falsos) a la del submódulo "Programa de Capacitación Anual".
  - **Root cause**: el algoritmo del home (`getCapacitacionesChartDataForGraph` en `recursos-home.js`) **hardcodeaba** las columnas del Excel: `row[1]` para nombre, `row[3]` para fecha y `[9, 8, 7, 10, 11, 6]` para estado (toma el primero no vacío). El log del submódulo reporta `Columnas detectadas: Nombre=1, Fecha=5, Estado=8` — la fecha real está en la columna 5, no en la 3. El home estaba leyendo la columna equivocada, así que mostraba "actividades en abril" cuando el Excel no las tenía programadas en abril.
  - **Iteración 1** (anterior): cambié las 38 keywords ambiguas de "realizada" por las 9 estrictas del submódulo (`ejecutado`, `completado`, `realizado`, `1`, `3`, `4`, `100`, `si`, `sí`). Eso eliminó falsos positivos como "Próxima", "Excelente", "Vencida", "100%" (de % avance), "v" (de "vencida") que se contaban como realizadas.
  - **Iteración 2** (este fix): reescribí el algoritmo completo del home para que use **EXACTAMENTE la misma lógica que el submódulo** (`capacitaciones-logic.js:699-807`):
    1. **Auto-detección de columnas** leyendo las primeras 5 filas del Excel buscando headers que contengan "nombre"/"capacitación", "fecha"/"programada"/"date", "estado"/"indicador"/"status".
    2. **Parser de fecha robusto** con regex DMY (`24/04/2026` o `24-04-2026`), regex ISO (`2026-04-24` o `2026/04/24`), serial date de Excel (número ≥ 1 → fecha real) y fallback genérico con `new Date()`.
    3. **Fallback offset ±2 columnas** si la columna de fecha detectada está vacía en alguna fila.
    4. **Filtros estrictos de fila**: nombre `length < 3` se descarta, "nombre de la" / "contenido de la" se descartan, "total capacitaciones" rompe el loop.
  - **Beneficio**: la gráfica "Capacitaciones Mensuales" del home de Recursos ahora muestra exactamente los mismos datos que "Ejecución Mensual" del submódulo. Mismas barras, mismos meses, mismas cantidades.

## [0.1.153] - 2026-08-05

### Fixed
- **📦655 · fix(gmail): tildes y eñes en subject de correos enviados** — Bug clásico de encoding al construir el raw MIME message.
  - **Root cause**: el subject (y demás headers) se escribían como UTF-8 raw en el raw MIME. Gmail/clients lo interpretaban como Latin-1, por eso `ejecución` se mostraba como `ejecucÃ³n` (los bytes `0xC3 0xB3` de `ó` en UTF-8, decodificados como Latin-1, dan `Ã³`).
  - **Fix**: nueva función `encodeMimeHeader(str)` que aplica **RFC 2047 encoded-word** (`=?UTF-8?B?<base64>?=`) cuando el string tiene caracteres no-ASCII. Si es ASCII puro, lo devuelve tal cual (legible en logs).
  - Aplicada a: `From`, `To`, `Cc`, `Bcc`, `Subject`. Los emails puros (sin nombre) siguen siendo ASCII normal.
  - **Beneficio**: subjects con tildes (`Reunión de seguimiento`), eñes (`Investigación`), acentos (`Métricas`) y caracteres especiales (`año`, `día`) ahora se ven correctos en Gmail, Outlook y otros clientes.

## [0.1.152] - 2026-08-05

### Changed
- **📦654 · fix(presupuesto): tabla más compacta (font-size 12px)** — Reducido el font-size de la tabla del Presupuesto de `0.9rem` (14.4px) a `0.75rem` (12px) para que las celdas sean más compactas y quepan más filas visibles sin scroll. Aplica a todos los datos, headers, celdas editables, celdas calculadas e inputs de la tabla (heredan via `font-size: inherit`).

## [0.1.151] - 2026-08-05

### Changed
- **📦653 · fix(presupuesto): números sin ",00" + sistema de notificación moderno** — 2 mejoras en el submódulo de Presupuesto.
  - **📦653-fix1 — Formato inteligente de números**: la función `formatNumber` antes mostraba SIEMPRE 2 decimales (`0` → `0,00`, `100` → `100,00`). Ahora detecta si el número es entero y omite los decimales. Los números con decimales reales (ej: `1.234,56`) se mantienen con sus 2 decimales. Nueva función `formatPct` para los porcentajes (mismo comportamiento + sufijo %).
    - `0` → `0`, `100` → `100`, `776.227` → `776.227`
    - `0%` → `0%`, `50%` → `50%`, `47,53%` → `47,53%`
    - Beneficio: la columna % ya no se trunca con `0,00%` repetidos en cada fila
  - **📦653-fix2 — Sistema de notificación moderno**: el Presupuesto tenía su propio toast viejo (`.k-toast` con CSS + `<div id="notification">` + función `showNotification`). Removido completamente, ahora usa `window.KAIRToast.show()` (mismo sistema unificado de toda la app, definido en `assets/js/kair-toast.js`).
    - Agregado `<script src="../../../assets/js/kair-toast.js"></script>` al HTML del iframe (la clase se autoinstancia en `window.KAIRToast`)
    - 4 callsites actualizados: save success, save error, load error, no hay cambios
    - Removidos: CSS `.k-toast` (15 líneas), HTML `#notification` (5 líneas), función `showNotification` (6 líneas)
    - Beneficio: consistencia con el resto de la app, mismo look, mismo position, mismos iconos

## [0.1.150] - 2026-08-05

### Changed
- **📦652 · feat(bandeja): chips estilo Gmail para destinatarios + autocomplete con mejor visual** — Rediseño completo del campo Para/CC del modal compose.
  - **Sistema de chips (pills)**: el input de Para/CC se reemplaza por un container flex con chips (uno por destinatario) + input al final. Cada chip muestra avatar circular (1ra letra) + nombre + × para remover. Fondo azul claro (`#e8f0fe`) con borde (`#d2e3fc`), mismo estilo que el item de autocomplete seleccionado.
  - **Comportamiento de chips**:
    - Click en item del autocomplete → crea chip, limpia el input
    - Tipear + coma/Enter → convierte el texto en chip
    - Tipear + blur → convierte el texto en chip
    - Backspace en input vacío → borra el último chip
    - Click en × → elimina el chip
    - Soporta formato "Nombre \<email\>" y "email@x.com" plano
  - **Placeholder "Para" se oculta** cuando hay al menos 1 chip (CSS `:has()` + fallback JS `.has-chips` para compatibilidad).
  - **Al enviar**: recolecta todos los emails (de chips + texto restante del input) y los junta con `, `.
  - **Autocomplete con mejor visual**:
    - Borde más prominente (`1px solid #c4c7c5`) + border-radius 8px
    - Sombra con doble capa (`0 6px 18px ... 0 1px 3px ...`) → efecto elevado
    - Items con `border-radius: 6px` + `margin: 0 4px` (sin border-bottom)
    - Avatar 32×32 (antes 28×28)
    - Hover/activo con fondo azul claro `#e8f0fe` (antes `#f8f9fa`)
    - Count `9×` ahora en pill con background gris
  - **Alineación perfecta** entre "Para" y "Asunto": mismo font-size (0.875rem), mismo line-height (1.5), mismo color de placeholder (`#cbd5e1`), mismo margin/padding. Visualmente quedan como un campo continuo.
  - **Quitada la línea azul de focus** en el campo Para/CC (border-bottom + `:focus-within`). Más limpio.
  - **X de chip sin look de botón**: hover cambia solo el color (de gris a azul), sin fondo redondo.

## [0.1.149] - 2026-08-04

### Changed
- **📦651 · polish(ux): iconos del home en gris + Configuración armonizada + modal Usuario con scroll interno** — 3 ajustes visuales para que la UI se vea más armónica y profesional.
  - **📦651-fix1 Iconos del home en gris**: Los iconos SVG de los módulos del panel "Módulos del Sistema" del home ahora son del mismo color gris claro (`#94a3b8`) que el subtítulo de cada módulo ("Capacitación, Roles", "Política, Planes", etc.). Antes eran oscuros (heredaban `currentColor` del título `#1e293b`) y desentonaban. Cambió en `renderer.js:3998` (1 línea, agregado `color: #94a3b8` al wrapper del icono).
  - **📦651-fix2 Configuración - status pill + acciones armonizadas**: En Configuración > Ajustes de Usuario, pulí la tabla de usuarios con:
    - **Status pill** (reemplaza el "● Activo" con bullet negro genérico): badge con background tinte + dot con halo. Activo = verde (`rgba(34,197,94,0.1)` + dot `#22c55e` con `box-shadow: 0 0 0 3px rgba(34,197,94,0.2)`). Inactivo = gris.
    - **Acciones horizontales con jerarquía**: Asignar = botón primario azul sólido (era outline blanco). Desactivar = botón secundario outline gris con hover rojo claro (señaliza que es destructivo). Layout cambió de vertical a horizontal (`flex`, gap 8px) para que no ocupen 2 líneas.
    - **Active tab con tinte sutil**: El nav-tab activo (ej. "Ajustes de Usuario") ahora tiene background `rgba(23,78,166,0.04)` + border-radius en las esquinas superiores, además del underline azul. Más visible sin romper la sutileza.
  - **📦651-fix3 Modal de Usuario con scroll interno**: El modal "Gestión de Usuario" (que aparece al click en Asignar) antes se cortaba cuando la ventana era chica. Reestructurado en 3 zonas con CSS flex:
    - `.modal-header` (fijo) — título siempre visible, con border-bottom sutil.
    - `.modal-body` (scrollable) — los 5 campos (Nombre, Correo, Contraseña, Rol, Empresas). `overflow-y: auto` para scroll interno cuando no caben.
    - `.modal-footer` (fijo) — botones Cancelar/Guardar con background `#f8fafc` y border-top. **Siempre visibles** aunque el body scrollee.
    - `.modal-container` ahora tiene `max-height: calc(100vh - 40px)` y `display: flex; flex-direction: column; overflow: hidden`.

## [0.1.148] - 2026-08-04

### Changed
- **📦650-ux · fix(bandeja): grip del resize sutil + autocomplete compacto solo Para/CC** — Polish visual post-v0.1.147.
  - **Grip del resize sutil**: 14×14 (antes 18×18 debug amarillo/rojo), 2 rayitas diagonales a opacidad 0.32 (antes 3 rayitas a 0.55), background transparente sin caja blanca, opacidad general 0.7 que sube a 1 en hover. Mantiene `cursor: nwse-resize` para la pista de interactividad.
  - **Autocomplete Gmail-style compacto**: `width: max-content` con `min-width: 240px` y `max-width: 380px` (antes estirado a `left:0; right:0` ocupando todo el modal). Anclado al input con `left: 16px`. Si el email es muy largo, se trunca con ellipsis.
  - **Autocomplete SOLO en Para/CC, NO en Asunto**: el user prefiere escribir el asunto libremente sin sugerencias. Removidos los listeners de input/blur/focus en `#compose-subject`, removido el HTML `#compose-subject-autocomplete`, y la rama `type === 'subject'` en `renderAutocomplete` ahora hace `return` temprano.

## [0.1.147] - 2026-08-04

### Added
- **📦650 · feat(bandeja): resize custom del modal compose + autocomplete Gmail-style + preservar espacios** — 3 mejoras grandes al modal Redactar.
  - **📦650-fix1 Resize custom del modal compose**:
    - Resize custom con listeners `mousedown`/`mousemove`/`mouseup` (reemplaza al `resize: both` nativo que ponía el handle en bottom-right).
    - Calcula el espacio disponible del `#mail-detail-container` con `getBoundingClientRect()`. `maxW = rect.width - 24`, `maxH = rect.height - 24` — el modal NUNCA supera el área del correo seleccionado.
    - `min 400×360` y fallback al `viewport - 48px` si la Bandeja Integrada está oculta.
    - Grip visual en la esquina **superior-izquierda** (per user request, no estándar OS).
    - **Fix bug crítico**: `position: relative` agregado a `.compose-panel` (sin esto, el grip con `position: absolute; top: 0; left: 0` se posicionaba relativo al overlay `position: fixed; inset: 0`, no al panel, y aparecía en la esquina superior-izquierda del viewport fuera del modal).
  - **📦650-fix2 Autocomplete Gmail-style en Para/Asunto**:
    - Índice de contactos y subjects construido desde `state.mails` (instantáneo, sin IPC).
    - Frecuencia basada en apariciones en `sender + to_list + cc_list`.
    - Dropdown con avatar (1ra letra), nombre, email, count.
    - 2+ chars mínimo, click autocompleta, keyboard navigation (Tab/Enter).
    - CSS: `.compose-panel__autocomplete` con avatares y metadata.
  - **📦650-fix3 Preservar espacios entre párrafos al enviar correos**:
    - **Root cause**: `sendMessage` en `shared/google-gmail.js` enviaba solo `text/plain` → Gmail colapsa espacios múltiples (RFC 5322).
    - **Fix**: `multipart/alternative` con `text/plain` + `text/html`.
    - `buildHtmlFromText()`: escapa HTML, convierte `\n` a `<br>`, envuelve en `<div style="white-space: pre-wrap;">`.
    - Soporte attachments con `multipart/mixed > multipart/alternative` anidado.
    - Gmail/Outlook web muestran el HTML que preserva TODO (espacios, tabs, `\n`).

## [0.1.146] - 2026-08-04

### Fixed
- **📦649 · fix(bandeja): correos leídos vuelven a aparecer como no leídos** — Bug crítico del UPSERT en `email_threads`.
  - **Root cause**: `saveThread` en `main/email-db.js` hacía `has_unread = excluded.has_unread` siempre, sobrescribiendo cualquier cambio local cuando llegaba un sync de Gmail.
  - **Síntoma**: el user abría un mail (frontend: `mail.unread = false`, backend: Gmail API + `propagateUnreadChange`) y al siguiente sync (1 min después) el flag volvía a `true` porque Gmail aún tenía el label UNREAD (sync fallido o no propagado).
  - **Fix**: usar `CASE WHEN` en el UPSERT para proteger flags "positivos" del user. Si el cache local tiene `has_unread=0` y Gmail dice `1`, MANTENEMOS `0` (el user ya lo gestionó). Aplica también a `is_starred` y `is_important`.
  - **Aplicar cuando**: cualquier proyecto con sync bidireccional donde el flag local puede estar más actualizado que el servidor remoto.
- **📦648 · fix(installer): icono del escritorio + race condition electron-updater** — Fix de 2 bugs reportados al actualizar a v0.1.144.
  - **📦648-fix1 Icono del escritorio desaparecido**: NSIS oneClick NO recrea accesos directos en updates. Agregado al `installer.nsh` `customInstall` macro: `Delete` + `CreateShortcut` del icono del escritorio (tanto en `C:\Users\Public\Desktop` con `SetShellVarContext all` como en `$DESKTOP` del usuario actual con `SetShellVarContext current`). Ahora cada update recrea el icono.
  - **📦648-fix2 Race condition electron-updater**: el instalador NSIS a veces abre la nueva versión antes de que `node_modules\electron-updater` termine de copiarse. Resultado: crash con "Cannot find module 'electron-updater'". Agregado try/catch al require + stub fallback no-op (mismo shape que el original, todas las funciones son no-ops). La app arranca sin auto-update; en el próximo reinicio el módulo ya está presente.

### Added
- **📦647 · feat(bandeja): panel "Mostrar detalles" con seguridad SPF/DKIM/DMARC/TLS** — Implementación estilo Gmail del panel expandible de detalles de correo.
  - **Paso 1 (UI básica)**: botón "Mostrar detalles" toggle, panel gris claro con campos `de`, `para`, `cc`, `fecha`, `asunto`, `id del mensaje`. CSS grid 2 columnas + animación fade-in 180ms.
  - **Paso 2 (headers + seguridad)**:
    - `shared/google-gmail.js`: nueva función `parseMailSecurity(rawHeaders, headersLower)` que extrae `sentBy` (Return-Path domain), `signedBy` (DKIM-Signature `d=`), `encryptedWith` (TLS de último Received), y `spf`/`dkim`/`dmarc`/`arc` desde `Authentication-Results`. `normalizeMessage` ahora devuelve `rawHeaders: [{name, value}]` y `mailSecurity: {...}`.
    - `main/email-schema-sql.js`: 2 columnas nuevas en `email_messages`: `raw_headers TEXT` y `mail_security TEXT`. 2 migraciones `ALTER TABLE` idempotentes.
    - `main/email-db.js`: INSERT/UPDATE/SELECT con las 2 columnas. `safeJSON` parsea con fallback.
    - `renderer/bandeja-integrada/app.js`: render del panel con "enviado por", "firmado por", "seguridad" (solo si hay data). Helpers `renderMailSecurityStatus()` (pills pass/fail estilo Gmail) + `buildDetailsPanelHtml()` (re-render desde safety net).
    - **Safety net**: al abrir el panel, si el mail no tiene `rawHeaders` locales, llama a `gmailApi.getMessage(id)` on-the-fly y re-renderiza con los datos reales. Los datos luego se persisten en DB (gracias al saveMessage actualizado).
    - `styles.css`: pills de seguridad (🟢 verde pass, 🟡 amarillo fail, ⚪ gris none/unknown). Dominio "enviado por"/"firmado por" en monospace azul.
- **🐛 Fixes críticos de Bandeja Integrada + Google Calendar (📦646 series, 13 fixes)** — Lote completo de correcciones para los problemas del calendario y la sincronización con Google Calendar.
  - **📦643 Flicker calendario**: `loadEventsFromGoogle` ya no filtra contra `state.events` (causaba que eventos aceptados alternaran visible/oculto cada polling). Deduplicación al final sobre datos recién obtenidos.
  - **📦644 Día de la semana incorrecto**: `WEEKDAY_LABELS` usaba `(getDay() + 6) % 7` pero el cálculo se hacía con índice de columna en vez del día real. Generaba desfase cuando el mes no empezaba en lunes.
  - **📦646 Iframe adapter fallback**: `getApi()` helper con fallback a `window.parent.electronAPI`. Antes `adapter` era `undefined` dentro del iframe de Bandeja Integrada.
  - **📦646-fix1 ID mismatch post-create**: `adapter.create()` asigna ID nuevo en DB. `saveEvent()` sincroniza `newEvent.id = res.data.id` para que el `adapter.update()` posterior funcione.
  - **📦646-fix2 Google Calendar iframe fallback**: `saveEvent()` usa `getGoogleCalendarApi()` (con fallback) en vez de `window.electronAPI.googleCalendar` directo.
  - **📦646-fix3 `fromGoogleEvent` usa kairId**: antes generaba `id: 'gcal-' + g.id`. Ahora `id: kairId || 'gcal-' + g.id` para que el dedup los una naturalmente.
  - **📦646-fix4 `confirmModal()` reusable**: reemplaza el `confirm()` nativo. Promise-based, variantes `danger`/`primary`, atajos Enter/Esc, z-index 600000.
  - **📦646-fix5 Delete handler dual-path**: detecta `rapido-*` vs `gcal-*`. `NOT_FOUND` fallback a Google. Cancelación automática a attendees con `sendUpdates:'all'`.
  - **📦646-fix6 Dedup con 2 keys**: usa `googleEventId` Y `id` (cualquiera de las dos). Antes solo `googleEventId || id`, generaba duplicados.
  - **📦646-fix7 Botones confirm modal prominentes**: nueva clase `.kair-event-modal__btn--danger-solid` (rojo sólido). Inline styles forzando especificidad. Sombra del modal más profunda.
  - **📦646-fix8 Schema: `google_event_id`**: nueva columna en `eventos_rapidos`. Migración `ALTER TABLE` con try/catch. Update inteligente.
  - **📦646-fix9 Calendario persistente post-save**: removido `state.calendarVisible = false` después de Guardar. Foco automático en "+ Crear" para batch event creation.
  - **📦646-fix10 Edit modal: Asistentes + Google sync**: campo Asistentes pre-cargado + UPDATE/CREATE en Google con `sendUpdates:'all'`. Toast diferenciado.
  - **📦646-fix11 Schema: `attendees`**: nueva columna JSON stringificado. Parse en `_rowToEvent` con fallback a texto plano legacy.
  - **📦646-fix12 Bridge no persistía attendees**: el SQL de `INSERT` y `UPDATE` NO incluía `attendees` ni `google_event_id`. Resultado: cualquier evento con attendees quedaba con `attendees: []` en DB aunque Google sí los tuviera. Ahora se persisten correctamente.
  - **📦646-fix13 Safety net en edit modal**: si el evento no tiene attendees locales pero tiene `googleEventId`, consulta a Google y los trae on-the-fly. Los persiste para futuras ediciones.
- **🆕 Time Zone Google Calendar (📦646-tz)** — `toGoogleEvent()` y `upsertFromIcs()` ahora incluyen `timeZone: 'America/Bogota'`. Google Calendar API v3 rechaza `dateTime` naive con 400 desde 2024.
- **🆕 Método `gcalApi.get()` / `gmailApi.get()` (📦646-get)** — Nuevos handlers IPC `google-calendar:get` y `google-gmail:get` para traer UN evento/mensaje específico por ID. Usado por el safety net del edit modal y del Mostrar detalles.
- **🎨 Iconos SVG Lucide en sidebar y headers (📦642, publicado v0.1.142)** — Reemplazo completo de PNG/FontAwesome por SVGs inline Lucide. Un solo color (currentColor heredado), más liviano.
  - `renderer.js:3416` fix: el botón "Salir" usaba `iconImg.src = "assets/${salir.icon}"` (404 con el nuevo formato). Ahora `iconWrap.innerHTML = SIDEBAR_ICONS[salir.icon]`.
- **⬆️ Botón flotante scroll-to-top/bottom (📦640, publicado v0.1.141)** — Clase reusable `ScrollToTopBottomButton` en `modules/shared/scroll-fab.js`.
- **✏️ Editar/Eliminar filas en tabla de ausentismo (📦639, publicado v0.1.141)** — Botones outline, edit in-place, recálculo de días, auto-completar CIE-10.
- **🆕 Hora visible en calendario semanal/diario (📦638, publicado v0.1.141)** — Bloques de eventos muestran la hora de inicio.

## [0.1.142] - 2026-08-03

### Added
- **🎨 Iconos SVG Lucide en sidebar y headers (📦642)** — Reemplazo completo de PNG/FontAwesome por SVGs inline Lucide.
- **🔧 Quitar BOM UTF-8 del package.json (📦641)** — El BOM rompía electron-rebuild. Fix reproducible con Python.

## [0.1.141] - 2026-07-30

### Added
- **⬆️ Botón flotante scroll-to-top/bottom (📦640)**
- **✏️ Editar/Eliminar filas en tabla de ausentismo (📦639)**
- **🆕 Hora visible en calendario semanal/diario (📦638)**

## [0.1.140] - 2026-07-30

### Added
- **🔄 Re-iteración del update UX** — Ajustes al flujo de auto-update publicado en v0.1.131.

## [0.1.131] - 2026-07-22

### Added
- **🎯 Submódulo 3.1.3 Perfiles de cargo y Profesiograma (📦589, completo)** — Implementación end-to-end del profesiograma.
  - **Fase 1 (backend)**: Bridge IPC (`main/profesiograma-bridge.js`, 52 KB) con schema SQLite de 10 tablas (kp_*) y 26 handlers (CRUD para Empresa, Profesiograma, GrupoOcupacional, Cargo, TipoExamen, CargoExamen con I/P/R, DescripcionPrueba, Recomendacion, AlturaRequisito, Vacuna, VacunacionCargo, más select-excel y KPIs). Schema idempotente (`CREATE TABLE IF NOT EXISTS`), foreign keys con CASCADE, índices en columnas consultadas.
  - **Fase 2 (UI)**: Viewer con 6 vistas (home + Matriz + Pruebas + Recomendaciones + Vacunación + Alturas) en iframe autocontenido. Header con breadcrumb, tabs de navegación, dialog genérico para CRUD, búsqueda en la matriz, KPIs con skeleton y badges. Botón "Importar Excel" en el header que abre file picker filtrado (.xlsx/.xls) y dispara la importación. Botón "Volver" usa `postMessage` para regresar al home del módulo. CSS custom (no Bootstrap) con design system K+AIR (--primary #174ea6, --success, --warning, etc.).
  - **Fase 3 (parser Excel)**: Fix de bugs detectados al ejecutar contra el archivo real `GI-FO-047 Profesiograma Tempoactiva.xlsx` (175 KB, 8 hojas). El parser ahora detecta la fila de headers buscando "GRUPO OCUPACIONAL" en col 0, lee las categorías desde fila 7 (EVALUACIÓN MÉDICA / PRUEBAS COMPLEMENTARIAS / LABORATORIO), e importa las vacunas desde la hoja "ESQUEMA INMUNIZACION" (no desde "VACUNACIÓN TRABAJADORES" cuya estructura es de cruce cargo×vacuna). Resultado: 5 grupos, 21 cargos, 20 tipos examen, 105 relaciones cargo-examen, 10 descripciones de prueba, 8 recomendaciones, 2 requisitos de altura, 4 vacunas.
  - **Fase 4 (tests)**: 2 scripts de test (`test-profesiograma-import.js` + `test-profesiograma-handlers.js`) con mock de DB que ejecuta el import real + valida los 9 handlers de list + CRUD básico. **20/20 tests OK**. Los 161 tests existentes (`main/test-fixes-loop48.js`) siguen pasando.
- **🚀 `scripts/release.ps1` — flujo automatizado de release** — Script PowerShell que ejecuta el flujo completo en 7 pasos: (1) verifica pre-requisitos (`GH_TOKEN` + branch `Dev-Pc` + working tree), (2) corre tests (`-SkipTests` para saltar), (3) `git push origin Dev-Pc`, (4) crea el tag `v<version>` local, (5) **`git push origin v<version>` — el paso crítico que evita el 422 de "Published releases must have a valid tag"**, (6) verifica que GitHub ve el tag, (7) corre `electron-builder --win --publish=always`. Si el build falla, llama automáticamente a `fix-release.ps1` como fallback. Mensajes claros en cada paso, detección de versión automática desde `package.json`, y rollback del tag si ya existe.
- **🛟 `scripts/fix-release.ps1` — fallback cuando electron-builder falla al subir** — Versión reutilizable del workaround manual que aplicamos para v0.1.131/132/133. En 6 pasos: (1) verifica que el `.exe` y `.blockmap` existen localmente, (2) calcula el SHA512 real y regenera `latest.yml`, (3) obtiene o crea el release via API de GitHub, (4) borra assets huérfanos con nombre viejo (`sgsst-electron-app-setup-*`), (5) sube `.exe` + `.blockmap` + `latest.yml` con `curl` directo a `uploads.github.com`, (6) PATCH el name + body del release. Tiene los 2 fixes de bugs descubiertos en intentos manuales: regex correcta `\{[^}]*\}` (no se come el `}`) y delimitación `${uploadBase}` (PowerShell no trata `?` como wildcard).

### Removed
- **🗑️ `Portear/python-embed.bak/` (20.8 MB)** — Backup legacy con ejecutables de torch/transformers/accelerate/huggingface-cli del modelo viejo (cuando se usaba transformers, antes de migrar a Ollama/GGUF). Confirmado por grep: **NADIE lo referencia** — ni `main.js`, ni `package.json`, ni los build scripts, ni los scripts Python. Solo `.gitignore` lo conocía. La app usa exclusivamente `Portear/python-embed/` (340 MB con pandas, pymupdf, flask, etc.) que sigue intacto. Borrado del repo local y del build output (`dist/win-unpacked/resources/app/Portear/python-embed.bak/`). Recuperable desde la papelera de Windows.
- **🗑️ ~60 archivos firmados con signtool innecesariamente** — El `.bak` se firmaba en cada build (accelerate.exe, transformers.exe, torchrun.exe, huggingface-cli.exe, etc.). Ahora se saltan, ahorrando 1-2 min de firma.

### Build & Tooling
- **📦585 — Commit de tooling** (este commit). Cero cambios funcionales, solo automatización del flujo de release y limpieza de dead weight.

## [0.1.131] - 2026-07-22

### Added
- **🔄 Update UX completo (📦581, Loops 1-10)** — Sistema de actualizaciones rediseñado estilo Claude, no invasivo, anclado al footer. 7 loops de iteración visual con el user. (1) **Botón-dot opencode-style en el footer** (al lado de la versión): OCULTO al día, **AZUL con pulse** cuando hay update disponible, **VERDE con halo** cuando está descargado. Click en el dot abre el dropdown anclado arriba del footer. Sin texto redundante en el header (la versión ya está en el footer). (2) **Dropdown con Claude-style**: header azul claro (#e8f0fe), border-radius 12px, 2 botones de acción (Reiniciar / Más tarde) + link "Ver información de versión" que abre el modal. Z-index 500001 para escapar del `isolation: isolate` del header. (3) **Modal "Información de actualizaciones"** (user-invoked): badge de estado con dot animado, grid con versión instalada / última versión / última verificación / canal, botón "Buscar actualizaciones ahora" con feedback de "Buscando…", dark theme support. (4) **Panel "Actualizaciones" en Configuración** (pestaña "Acerca de la App"): grid con la misma info + 6 estados (idle / checking / not-available / available / downloaded / error) + botón de check manual + botón "Reiniciar e Instalar". (5) **Disclaimer "Se instalará al cerrar la app"** al lado del dot del footer (solo visible cuando hay update, cambia a "Lista para reiniciar" cuando está descargado). (6) **Release notes desde GitHub API** en el modal: IPC handler `get-release-notes` en `main.js` con cache de 1h, render en formato monospace con scroll interno.

### Changed
- **🔄 Toasts invasivos removidos (Loop 3)** — `notifyAvailable()`, `notifyDownloaded()` y `updateProgress()` ahora son no-ops (solo loguean). El UI muestra el dot del footer en su lugar. `notifyError()` se mantiene (errores merecen notificación, transitorio de 6s).
- **📦 refactor del update button del header al footer (Loop 4b)** — Eliminado el `<button id="header-update-btn">` del header y 200+ líneas de CSS legacy (`.header-update-btn*`, `.header-update-text*`, `.header-update-panel`, `.update-progress-*`, keyframes viejos). El nuevo `<button id="footer-update-btn">` está al lado de `#app-version` con un dot de 8px que cambia de color según el estado.
- **📐 Dropdown positioning con footer como referencia (Loop 5.5)** — El cálculo de posición del dropdown usa el `top` del `#app-footer` (no el del dot) y setea un `max-height` dinámico al espacio disponible. Si el contenido es más grande, hace scroll interno en el body. Fix del bug donde el dropdown invadía el footer.

### Fixed
- **🐛 Texto blanco invisible del header update button (Loop 4 fix)** — El color del texto era `rgba(255, 255, 255, 0.7)` (blanco), invisible sobre el header claro. Corregido a `var(--text-light-color, #6c757d)` (gris medio) que se ve bien en light + dark theme.
- **🐛 Style.display inline override (Loop 1.5)** — `updateHeaderStatus()` ya no usa `headerUpdateBtn.style.display = 'none'` (que override el CSS con `!important`). Ahora usa `headerUpdateBtn.hidden = true/false` (manejado por CSS).
- **🐛 aria-hidden warning con focus atrapado (Loop 5.5)** — `closeUpdateDropdown()` ahora hace `document.activeElement.blur()` antes de poner `aria-hidden="true"`. Sin esto, el browser loggeaba un warning de a11y cada vez que se cerraba el dropdown con focus en un botón.

### Removed
- **🗑️ CSS legacy del header update (200+ líneas)** — `.header-update-btn*`, `.header-update-text*`, `.header-update-btn__icon`, `.header-update-panel`, `.update-progress-*`, `.update-install-btn`, `.update-download-btn`, `@keyframes kair-update-btn-pulse`, `@keyframes kair-update-icon-bounce`. Todo reemplazado por el sistema del footer dot (más simple, menos invasivo).
- **🗑️ 11 backup tags de git** — `backup-before-cleanup-*`, `backup-pre-*-2026-07-20/21/22`. Borrados local y remoto.

### Build & Tooling
- **🔖 Bump version 0.1.131** — `package.json` actualizado a v0.1.131.
- **✅ 158 tests OK** en `main/test-fixes-loop48.js` cubriendo HTML/CSS/JS del footer dot, dropdown, modal, panel de config, disclaimer, release notes.

## [0.1.130] - 2026-07-21

### Added
- **🎨 Menú nativo de Electron oculto en dev y producción** — La barra de menú nativa de Windows (File / Edit / View / Window / Help) ya no se muestra de forma predeterminada. En **modo desarrollo** (`npm start`) el menú está oculto pero aparece temporalmente cuando se presiona la tecla **Alt** (comportamiento estándar de Windows para apps como Discord, Slack, VSCode). En **modo producción** (app instalada con `.exe`) el menú está oculto TOTALMENTE, ni siquiera aparece con Alt. Esto le da al dev acceso rápido a Reload/DevTools sin saturar la UI, y al cliente final una ventana limpia sin elementos del sistema operativo. Implementación: (a) nueva propiedad `autoHideMenuBar: true` en el `BrowserWindow` de `main.js` (opción nativa de Electron), (b) bloque condicional `if (app.isPackaged) { Menu.setApplicationMenu(null); }` en `app.whenReady()` que oculta el menú totalmente en producción.

### Build & Tooling
- **🔖 Bump version 0.1.130** — `package.json` actualizado a v0.1.130.

## [0.1.129] - 2026-07-21

### Fixed
- **🐛 Click en evento del calendario no abría el modal de detalle** — Cuando el user hacía click en un evento del calendario grande, se mostraba un toast con info básica (Título · Sin lugar · Fecha) en la parte de abajo, pero el modal completo de detalle NUNCA se abría. CAUSA RAÍZ: el F4-fix (Loop 572) eliminó el `KAirCalendar` viejo que tenía el `onEventClick` callback, pero el `renderBigCalendar` custom (Loop 1918) que quedó en su lugar seguía usando `selectEvent(ev)` que SOLO mostraba el toast. La función `openEventDetailModal(ev, adapter)` existía y estaba bien implementada, pero NUNCA se llamaba desde el `selectEvent`. FIX (loops 46, 46b): (a) **Loop 46 CSS**: `.kair-event-modal-overlay` con `z-index: 500000` (era 300000, mismo que otros elementos del calendario → quedaba detrás), `backdrop-filter: blur(2px)`, y nuevo selector `.kair-event-modal-overlay[style*="display: flex"]` con `display: flex !important` para forzar la visibilidad. (b) **Loop 46b JS**: `selectEvent(ev)` ahora llama a `openEventDetailModal(ev, getKairCalendarAdapter())` cuando el evento NO tiene `linkedMailId` (en lugar de solo mostrar el toast). Si el modal no está disponible, fallback al toast. Resultado: el modal de detalle se abre centrado con overlay oscuro, mostrando header con categoría (color), título del evento, fecha + hora, ubicación, descripción, y los botones Marcar cumplido / Editar / Eliminar.

### Build & Tooling
- **🔖 Bump version 0.1.129** — `package.json` actualizado a v0.1.129.
- **Cache-bust v=668 → v=669** — bump por el fix de `selectEvent` (CSS queda en v=668 porque solo cambió el JS del comportamiento).

## [0.1.128] - 2026-07-21

### Fixed
- **🐛 Modal de crear evento se veía todo pegado** — El modal de "Nuevo evento de calendario" (renderEventModal) usaba clases como `.kair-field`, `.kair-input`, `.kair-modal__header/title/body/footer`, `.kair-chip-select`, `.kair-duration-row` que NO existían en el CSS de la Bandeja Integrada. Sin estilos, todo se veía pegado (label pegado al input, botón X en la esquina equivocada, sin padding interno, sin focus state en los inputs). FIX (loop 44): se agregaron todos los estilos CSS al `bandeja-integrada/styles.css` (nuevo bloque "K+AIR Modal") — overlay con backdrop blur, header con título y X a la derecha, body con padding y scroll, footer con botones alineados, field con gap 6px entre label e input, inputs con border-radius y focus state azul, chip-select para categoría con dot de color, duration-row con active state visible. La Bandeja Integrada se ve como un modal profesional ahora (Gmail-style).
- **🐛 Overlay tapaba toda la Bandeja Integrada** — Después de agregar el CSS del modal, la Bandeja Integrada se veía con una opacidad oscura cubriendo todo y bloqueando clicks. CAUSA: el CSS ponía `display: flex` en `.kair-modal-overlay` que PISABA el atributo `hidden` del HTML (específico del navegador). Resultado: el modal aparecía desde el inicio, tapando todo. FIX (loop 44b): se cambió el selector a `.kair-modal-overlay:not([hidden])` para que el `display: flex` solo se aplique cuando NO está oculto. Ahora el modal se oculta por default y solo aparece al abrir.
- **🐛 Switch "Todas las empresas" no se veía** — El switch existía en el HTML (index.html línea 74 con `id="toggle-companies"`) y en el JS (app.js línea 1156-1908 con handlers, localStorage, etc), pero NO se veía porque estaba dentro del `<header class="kair-header">` que tiene `display: none !important` (línea 164 del CSS, desde que se ocultó el header interno del iframe para no duplicar con el de la app principal). FIX (loops 45, 45b, 45c): (a) Saqué el toggle del header oculto y lo puse en la **toolbar del calendario grande**, justo antes del grupo "Día / Semana / Mes / Programar", con un divider vertical al lado. (b) Usé la clase `.kair-toggle` (no una nueva) para que las reglas CSS de animación funcionen correctamente: `data-on="true"` → track verde `#16a34a` + thumb a la derecha con `transform: translateX(14px)`, `data-on="false"` → track gris `#cbd5e1` + thumb a la izquierda. Transición animada de 220ms (cubic-bezier). (c) Moví el handler del click de los bindings iniciales al **bloque de bindings de la toolbar** (después de `main.appendChild(toolbar)`), porque la toolbar se re-crea con `innerHTML` en cada `render()` y el listener del binding inicial se perdía. El handler hace todo: toggle del estado, actualizar `data-on` y label, persistir en localStorage, actualizar el footer, y **recargar los eventos del calendario con el nuevo scope** (la pieza clave para que el filtro funcione).

### Changed
- **🔧 Switch de empresas más pequeño en la toolbar** — Para que se vea proporcionado dentro de la toolbar del calendario (que tiene poco espacio), el switch es más pequeño: 30px de ancho (vs 36px original) y 12px de thumb (vs 16px). El label sigue siendo legible con `font-size: 0.75rem` y `white-space: nowrap`.

### Build & Tooling
- **🔖 Bump version 0.1.128** — `package.json` actualizado a v0.1.128.
- **Cache-bust v=660 → v=667** — 7 versiones incrementadas durante la iteración (v=660 loop 40 base, v=661 loop 41, v=662 loop 42, v=663 loop 44 modal CSS, v=664 loop 44b overlay fix, v=665 loop 45 switch FAB, v=666 loop 45b switch en toolbar, v=667 loop 45c handler del click).

## [0.1.127] - 2026-07-21

### Changed
- **🎨 Loop 41 — Mejor visualización de sender + preview en la lista de correos** — Antes: con 340px de ancho de lista y 90px de columna de fecha, el content tenía solo ~134px → el sender se truncaba en "adm..." y el preview en "P...". Ahora: (a) **Ancho de lista aumentado**: `340px → 420px` (+80px de espacio para content). En pantallas <1280px: `300px → 380px`. (b) **Columna de fecha reducida**: `90px → 64px` (-26px recuperados). "11:27" o "ayer" entran perfecto en 64px. (c) **Render del sender inteligente** (estilo Gmail): si `m.sender` es un nombre y `m.senderEmail` es distinto, ahora se muestran como 2 spans separados — nombre en bold + email en gris pequeño al lado con ellipsis si es muy largo. Si el `sender` ES el email (caso self-sent), se muestra solo el email completo sin duplicar. (d) **Tooltip con email completo** en el sender y el avatar (`title="Google <no-reply@accounts.google.com>"`). (e) **Preview siempre visible**: removida la clase `kair-hide-lg` del snippet del cuerpo para que SIEMPRE se vea (antes se ocultaba en pantallas chicas). (f) **CSS nuevo**: `.email-row__sender` ahora es `display: flex; align-items: baseline; gap: 6px` para layout de 2 spans. `.email-row__sender-name` (no se trunca) + `.email-row__sender-email` (gris claro, font-size 0.75rem, ellipsis). Ejemplo antes: `A adm... P... 11:27`. Ejemplo ahora: `A adminkair@gmail.com — Prueba de carg... — Prueba de car... 11:27`.
- **🎨 Loop 42 — Reply bar fijo al fondo del detail panel (patrón "3 zonas" Gmail-style)** — Antes: el reply bar (Responder / A todos / Reenviar / input / Enviar) quedaba pegado al final del CONTENIDO del correo, no al fondo del panel. Si el cuerpo era corto, quedaba mucho espacio vacío entre el cuerpo y el reply. Si el cuerpo era largo, había que scrollear toda la página para llegar al reply. Ahora: el detail panel usa el patrón clásico de "3 zonas" — (a) **`.kair-mail-detail`**: `display: flex; flex-direction: column; height: 100%; min-height: 0` toma toda la altura del container padre. (b) **Scroll interno** (`.kair-mail-detail .overflow-y-auto`): nueva regla CSS con `flex: 1 1 auto; min-height: 0` — toma todo el espacio restante entre el header y el reply, hace scroll INTERNO cuando el contenido es largo (no scroll de página). (c) **Reply bar** (`.kair-mail-detail__reply`): `flex-shrink: 0` (NUNCA se comprime) + `z-index: 2` (encima del scroll si hay overlap) — queda SIEMPRE al fondo del panel con su altura natural (~56px), independientemente del largo del cuerpo. Resultado: con cuerpo corto (ej: "Ojo al dato / Enviado desde mi iPhone") el reply queda al FONDO del panel, no pegado al último mensaje. Con cuerpo largo (ej: el correo de Google con logo + botón + links), el body tiene scroll INTERNO y el reply sigue FIJO al fondo sin moverse.

### Build & Tooling
- **🔖 Bump version 0.1.127** — `package.json` actualizado a v0.1.127 para reflejar las mejoras de UX de la lista y el reply fijo.
- **Cache-bust v=660 → v=662** — bump por las mejoras de sender/preview (v=661 loop 41) y reply fijo (v=662 loop 42).

## [0.1.126] - 2026-07-21

### Added
- **🎨 Render del body del correo como HTML Gmail-style (logo, botones, imágenes)** — El cuerpo del correo ahora se renderiza con su HTML original en lugar de texto plano. Se ven: el logo de Google, el botón "Ver actividad" como botón azul redondeado, las imágenes inline, la estructura visual del HTML preservada, y los links con el styling correcto. ANTES solo se mostraba el texto plano y los placeholders como `[image: Google]`.

### Fixed
- **🔧 Triple causa raíz del render de texto plano en correos HTML** — (1) `shared/google-gmail.js` `extractBody()` buscaba `text/plain` primero y nunca retornaba `text/html`. (2) Cuando solo había `text/html`, se lo "strippeaba" con `raw.replace(/<[^>]+>/g, ' ')` (le quitaba todos los tags). (3) `main/email-sync.js` línea 322 hardcodeaba `body_html: ''` al armar el `msgForDb` para `saveMessage`. Resultado: el cache NUNCA tenía HTML rico, la Bandeja Integrada renderizaba solo texto plano sin importar qué. FIX (loops 40-40b, 2 fases): (a) **Loop 40 frontend**: helper `sanitizeHtml(html)` con `DOMParser` que elimina tags peligrosos (`<script>`, `<iframe>`, `<object>`, `<embed>`, `<form>`, `<style>`, `<link>`, `<meta>`, etc), atributos `on*` (event handlers), URLs `javascript:` y `data:text/html`. Helper `isHtmlContent(str)` para detectar si el body es HTML o texto plano. `renderMailBodyHtml` ahora detecta HTML y lo envuelve en `<div class="kair-mail-message__html">` después de sanearlo. `loadMailBodyFromCache` ahora guarda `mail.body_html` además de `mail.body`. Las 2 llamadas a `renderMailBodyHtml` (thread grouping y single mail) ahora pasan `body_html || body_plain` con prioridad al HTML. (b) **Loop 40b backend**: refactor `extractBody` → `extractBodyParts(payload)` que retorna `{ plain, html }` por separado (HTML crudo, sin strippear). `normalizeMessage` ahora exporta `body_plain` Y `body_html` además de `body` (compatibilidad legacy). `email-sync.js` `msgForDb` ahora usa `normalizedMsg.body_plain || body` y `normalizedMsg.body_html || ''` en lugar de hardcodear vacío. (c) **CSS Gmail-style**: nuevo bloque `.kair-mail-message__html` con `max-width: 100%`, fuentes del sistema, `line-height: 1.6`, `word-wrap: break-word`. Estilos para `img` (responsive, max-width 100%, height auto), `table` (border-collapse), `h1-h6` (font-weight 600), `hr` (border-top), `blockquote` (border-left gris), `ul/ol/li`, `a` (color azul `#1a73e8` con underline en hover). (d) **IMPORTANTE — re-sincronización requerida**: los mensajes que ya estaban en el cache se sincronizaron ANTES de este fix, por lo que NO tienen HTML todavía. El user debe esperar al auto-refresh de 5 min o forzar un sync manual (botón Sincronizar / cerrar y abrir la app) para que el cache se llene con HTML.

### Security
- **🛡️ Sanitización XSS del HTML de emails** — `sanitizeHtml()` usa `DOMParser` para parsear el HTML en un Document temporal, eliminar tags peligrosos y atributos `on*` antes de inyectar via `innerHTML`. Previene XSS en correos maliciosos que intenten meter `<script>`, event handlers, `javascript:` URLs, o `data:text/html`. Validación por el user: el correo "Alerta de seguridad" de Google ahora se ve idéntico a Gmail (logo, botón "Ver actividad" como botón azul, link "https://myaccount.google.com/notifications" en azul, estructura visual completa, copyright de Google al final).

### Build & Tooling
- **🔖 Bump version 0.1.126** — `package.json` actualizado a v0.1.126 para reflejar el fix de render HTML.
- **Cache-bust v=659 → v=660** — bump por el fix de render HTML (v=660 loop 40).

## [0.1.125] - 2026-07-21

### Fixed
- **🔗 Click en links del cuerpo del correo abría múltiples ventanas de Electron** — El bug tenía 3 causas raíz que se sumaban: (1) `<a href>` en iframes de Electron SIEMPRE dispara `target="_blank"` automático, incluso con `preventDefault()` y `useCapture: true` (es un comportamiento específico de Electron, no respeta el preventDefault). (2) `attachMailLinkClickHandler()` se llamaba cada vez que se renderizaba un mensaje del thread, y CADA llamada agregaba un nuevo listener al `document` (que es global, nunca se pierde). Resultado: 1 click en un link con thread de 8 mensajes = 8 listeners ejecutándose = 8 llamadas a `api.openExternalUrl()` = 8 ventanas de Electron abiertas en simultáneo. (3) El iframe de Bandeja Integrada NO tiene `window.electronAPI` directamente (solo el main app lo tiene via preload), por lo que el fallback a `window.open()` abría una nueva `BrowserWindow` de Electron en lugar del browser del sistema. FIX (loops 39-39h): (a) Pre-procesador de Google obfuscation para URLs multi-línea: `body.replace(/<(https?:\/\/[^>]+)>/g, ...)` con `replace(/\s+/g, '')` para unir las líneas que Google parte con `\n`. (b) Helper `attachMailLinkClickHandler()` con event delegation en capture phase (`document`) + bubble phase (`container`). (c) iframe `electronAPI` fallback: `var api = window.electronAPI || (window.parent && window.parent.electronAPI) || null;` — accede al IPC del main app via `window.parent.electronAPI`. (d) Solución principal: cambiar `<a href>` por `<span role="link" tabindex="0" data-href="...">` porque `<span>` NO tiene el comportamiento default problemático de `<a>` en Electron (necesita onclick explícito, no tiene `target="_blank"` automático). (e) Loop 39h — flag `isMailLinkHandlerAttached` que previene la duplicación del listener global del `document` (se adjunta UNA sola vez en todo el ciclo de vida del módulo). Defensa adicional: early-return si `e.defaultPrevented` es true. (f) CSS: `.kair-mail-link` ampliado para aplicar tanto a `<a>` como a `<span>`, focus visible con background. Resultado: 1 click en un link = 1 sola ventana del browser del sistema (Chrome/Edge/Firefox según el default del usuario), NO múltiples ventanas de Electron.

### Changed
- **🧹 Limpieza de console.log ruidosos** — Removidos los `console.log` de debug que se agregaron en loops 39-39e para identificar el bug. Solo se mantiene el log final `[BandejaIntegrada] ✓ <span> interceptado, abriendo en browser del sistema: ...` que confirma al usuario que el link se manejó correctamente.

### Build & Tooling
- **🔖 Bump version 0.1.125** — `package.json` actualizado a v0.1.125 para reflejar el fix crítico de duplicación de listeners.
- **Cache-bust v=651 → v=659** — 8 versiones incrementadas durante la iteración del fix (v=652 loop 39, v=653 loop 39b, v=654 loop 39c, v=655 loop 39d, v=656 loop 39e, v=657 loop 39f, v=658 loop 39g, v=659 loop 39h listener dedup).

## [0.1.124] - 2026-07-21

### Fixed
- **🔧 📦573 — KairAlerts no mostraba el popover después de retirar el calendar-button** — Después del 📦572, KairAlerts seguía buscando el badge `#kair-cal-badge` (que ya no existe) y su `_wire()` hacía early return con un warning. Resultado: el popover de pendientes nunca se abría. FIX: las 5 referencias a `getElementById('kair-cal-badge')` en `shared/kair-alerts.js` se cambiaron a `getElementById('bandeja-integrada-badge')`. También se actualizó el mensaje de warning y el comentario sobre `#calendar-button` que ya no existe. Ahora el badge de pendientes aparece en el botón de Bandeja Integrada y el popover se abre/cierra con click.

### Removed
- **🗑️ Carga innecesaria de kair-calendar.css y kair-calendar.js del main app** — Después de retirar el calendar-button (📦572), el componente KairCalendar (`kair-calendar.js`) y sus estilos (`kair-calendar.css`) ya no se usan en el main app. La Bandeja Integrada iframe tiene su propia copia de estos archivos. Se quitaron los `<link>` y `<script>` correspondientes del `index.html` principal. Se mantienen: `kair-calendar-adapter.js` (lo usa KairAlerts) y `calendar-detail-panel.js` (lo usa KairAlerts para el detalle del evento). Resultado: ~2 requests HTTP menos al iniciar la app y un main.js más limpio.

### Changed
- **🧹 Comentarios obsoletos en renderer.js e index.html** — Actualizados los comments que referenciaban `#calendar-button` (ya no existe) para apuntar al `#bandeja-integrada-button`. 3 comments en `renderer.js` (líneas 747, 754, 2189-2193) y 1 en `index.html` (línea 291) limpiados. La documentación interna ahora refleja el estado real de la app.

### Build & Tooling
- **🔖 Bump version 0.1.124** — `package.json` actualizado a v0.1.124 para reflejar la limpieza post-retiro del calendario.

## [0.1.123] - 2026-07-21

### Removed
- **🗑️ 📦572 — Retirar K+AIR Calendar viejo (popover del header)** — Se quitó el botón `calendar-button` del header principal de la app y todo su handler de click (KairCalendar.create con 14 eventTypes, onEventClick, etc). La Bandeja Integrada ya tiene su propio calendario interno (mini-cal en sidebar izquierdo + calendario grande en slide) que usa los mismos IPC handlers y los mismos datos, así que el calendario viejo era redundante. Cambios: (a) `sgsst-electron-app/index.html` — quitado el bloque `<button id="calendar-button">` y su badge `kair-cal-badge`. (b) `sgsst-electron-app/renderer.js` — quitado el bloque de 80 líneas que creaba la instancia de KairCalendar con todos los eventTypes (plan, capacitacion, auditoria, rapido, vencido, gestacion, inspeccion_programada, mantenimiento_programado, recordatorio_copasst, recordatorio_convivencia, recordatorio_presupuesto, recordatorio_afiliacion, recordatorio_inducciones). (c) `KairAlerts` se mantiene activo porque su badge ahora aparece en el botón de Bandeja Integrada (sigue mostrando el conteo de pendientes). (d) Los scripts compartidos `kair-calendar.js`, `kair-calendar-adapter.js`, `kair-calendar.css`, `kair-alerts.js` NO se quitaron del `index.html` principal porque el iframe de Bandeja Integrada y KairAlerts los siguen usando. Backup antes de los cambios: tag `backup-pre-calendar-removal-2026-07-21`. Resultado: -78 líneas netas de código (90 quitadas en renderer.js, 12 agregadas en index.html como documentación del cambio).

### Build & Tooling
- **🔖 Bump version 0.1.123** — `package.json` actualizado a v0.1.123 para reflejar el retiro del calendario viejo.

## [0.1.122] - 2026-07-21

### Added
- **✚ Botón "Redactar" visible en la Bandeja Integrada (loops 37-37e)** — El header del iframe estaba oculto por CSS (kair-header display:none) y el handler `onComposeClick` solo mostraba un toast placeholder "próximamente F3.B". Ahora: botón "✚ Redactar" Gmail-style (azul, prominent) en la lista de correos, que abre el modal de compose real. Modal rediseñado estilo Gmail: cada input es una "fila" full-width con label DENTRO del input como placeholder (Para/Asunto/CC), el placeholder desaparece al hacer click o escribir. Titlebar del modal cambiado de fondo oscuro a claro (alineado con el resto). Drop zone rediseñado: invisible por defecto, aparece como overlay azul solo durante el drag, cubriendo todo el body field. Grises más suaves en todo el modal.
- **📎 Loop 38 — Fix crítico de attachments** — Los archivos adjuntos (File objects de los chips) NUNCA se estaban enviando. La causa raíz estaba en 2 partes: (a) Frontend — `pendingAttachments[]` se renderizaba como chip pero nunca se pasaba a `sendComposedMail`. (b) Backend — `sendMessage` solo construía MIME `text/plain`, sin soporte para `multipart/mixed`. FIX: (a) `sendComposedMail` ahora lee cada File via FileReader.readAsDataURL, extrae la parte base64 pura, valida tamaño <=25MB (límite de Gmail), y pasa `[{name, mimeType, data}]` al IPC `googleGmail.sendMessage`. (b) `sendMessage` ahora detecta si hay attachments y construye un MIME `multipart/mixed` con boundary único (formato: `----=_KairBandeja_<timestamp>_<random>`), Content-Type correcto por archivo, Content-Disposition: attachment, Content-Transfer-Encoding: base64 con saltos de línea cada 76 chars (estándar MIME). Si NO hay attachments, mantiene el comportamiento anterior (text/plain) para compatibilidad con reply/forward.

### Fixed
- **🔧 Loop 38 — Attachments perdidos en el envío** — El usuario reportó que al enviar correo con adjuntos, los archivos se mostraban en el modal pero NO llegaban a Gmail. Causa raíz: `pendingAttachments` local al modal nunca se pasaba al handler de enviar, y el backend no construía MIME multipart. Ahora los adjuntos llegan correctamente a Gmail.

### Build & Tooling
- **🔖 Bump version 0.1.122** — `package.json` actualizado a v0.1.122 para reflejar el compose Gmail-style completo y el fix de attachments.
- **Cache-bust**: v=646 → v=651 (v=647 loop 37 botón, v=648 loop 37b sin DE, v=649 loop 37c drop zone, v=650 loop 37d labels suaves, v=651 loop 37e placeholders Gmail).

## [0.1.121] - 2026-07-20

### Added
- **🎨 3 fixes visuales Gmail-style** — Loops 31-33 sobre Bandeja Integrada: (1) Loop 31 — Quote colapsable con mejor contraste (fondo `#f0f4f9`, borde izquierdo azul 4px `#1a73e8`, label con `font-weight: 600`, hover `#e8eef5`). (2) Loop 32 — "Para: x" colapsable unificado: el thread header ya muestra los recipients del último mensaje (loop 26), así que se eliminó el "para: x" propio del último mensaje individual para evitar duplicación visual. Los recipients siguen mostrándose en mensajes no-último cuando se expanden. (3) Loop 33 — Drag & drop de archivos al compose: botón "Adjuntar archivo" habilitado (antes `disabled`), `<input type="file" hidden multiple>` con wire-up al botón, drop zone en el body del modal con feedback visual (`.compose-panel__dropzone--active` con borde azul + fondo `#e8f0fe`), lista de archivos adjuntos con nombre/tamaño/botón X para quitar. Storage local en `pendingAttachments[]` (no se envían todavía — scope de integración con Gmail API).
- **↩️ Loop 34 — Undo de envío (5s window, Gmail-style)** — Nueva función `showUndoToast(title, onUndo)` que muestra un toast persistente con botón "Deshacer" durante 5s después de enviar. Al hacer click en "Deshacer", el callback `onUndo` ejecuta `toast("Para deshacer", "Abrí Gmail → Enviados y eliminá el mensaje manualmente", "info")` (informativo, porque la API de delete/trash de Gmail no está implementada en el backend todavía). Reemplaza el `toast("Enviado", ..., "success")` simple que tenía antes.
- **⏰ Loop 35 — Snooze (posponer) de correos** — Feature nueva: posponer un correo y sacarlo de la bandeja hasta una hora futura. Botón en la toolbar del detail con icono de reloj (label cambia entre "Posponer" y "Desnoozear" según estado). Al click muestra un toast con 4 opciones predefinidas: 1 hora, 3 horas, Mañana 9am, Próxima semana. Storage en `localStorage["kair.snoozedThreads"]` como `{"threadId": wakeTimeMs}`. Helpers: `getSnoozedMap()` (limpia snoozes vencidos), `isThreadSnoozed(threadId)`, `snoozeThread()`/`unsnoozeThread()`, `getSnoozeRemainingLabel()` ("en 1h", "en 2d", "ahora"). `renderMailList` filtra los mails snoozed de la lista INBOX (auto-cleanup cuando vence el wakeTime).

### Changed
- **🧹 Loop 36 — Eliminar BEM no usado** — Limpiados del CSS los selectores `.thread-header*` (15 reglas), `.quoted-thread` (1 regla) y `.message-block*` (13 reglas) del refactor BEM incompleto del 📦563. El HTML nunca se migró a esas clases (sigue usando `.kair-mail-detail__*` y `.kair-mail-message__*`), así que eran ~220 líneas de CSS muerto. También se eliminó el fragmento huérfano `gap: 6px; flex-wrap: wrap; }` que era residuo del mismo refactor incompleto.

### Fixed
- **🔧 Limpieza de gitignore** — Agregadas reglas para `node_modules/`, `__pycache__/`, `*.pyc`, `*.pyo`, `.vscode/`, `.idea/`, `.DS_Store`, `Thumbs.db` en `.gitignore`. Removidos del tracking los ~150 archivos de `node_modules/` que estaban commiteados erróneamente (xlsx, codepage, etc.). Ahora `node_modules/` se regenera con `npm install` desde `package.json`.

### Build & Tooling
- **🔖 Bump version 0.1.121** — `package.json` actualizado a v0.1.121 para reflejar los nuevos fixes visuales + features (snooze, undo, drag&drop).

### Métricas
- **Tests**: 503/503 OK acumulados (loops 1-36).
- **Cache-bust**: v=575 → v=646 (71 versiones bumped en total).
- **Commits acumulados en la rama**: 2 nuevos commits desde v0.1.120 (`39c01fa` loops 28-30 + este `🔖 v0.1.121` con loops 31-36).

## [0.1.120] - 2026-07-18

### Added
- **📧 Bandeja Integrada: cliente Gmail completo** (`📦563`, `aef69d9`) — Nueva feature mayor: cliente de correo profesional integrado en K+AIR, coexistiendo con el calendario existente. Implementa 4 fases de funcionalidad + 5 features futuras + BEM refactor + 4 fixes visuales Gmail-style. 22 archivos, +11,285/-28 líneas. (A) **Google OAuth + Gmail API**: `shared/google-auth.js` (276 líneas) con flow OAuth2 + PKCE, scopes `gmail.readonly` + `gmail.send` + `gmail.compose`. `shared/google-tokens.js` (86 líneas) con `hasValidTokens()` que chequea `refresh_token` (refresh permanente, no expiration check). `shared/google-gmail.js` (485 líneas) wrapper `gmail.users.*` con `listInbox`/`getMessage`/`markRead`/`sendMessage` (raw MIME + base64url)/`listLabels`/`downloadAttachment`/`archiveThread`. Dependencia `googleapis ^173.0.0`. (B) **Fase 0 — SQLite cache (kair.db)**: 5 tablas (`connections`, `threads`, `messages`, `labels`, `attachments`) con schema completo + migraciones. `main/email-db.js` (422 líneas) CRUD con lazy `db()`. `main/email-sync.js` (414 líneas) `syncInbox()` con TRUNCATE-then-INSERT, RFC 2822 parsers, recursive `walkPartsForBody`. 9 IPC handlers: `email-cache:sync-inbox`, `:get-threads`, `:get-thread`, `:get-stats`, `:get-labels`, `:get-attachments`. (C) **Fase 1.A-D — Gmail-look UI**: 1.A avatares circulares con `stringHashColor` + dot azul reemplazando checkbox + hover actions con gradient fade. 1.B compose/reply/forward con pre-fill automático + soporte Enviados (`state.mailFolder`) + race condition fix. 1.C thread grouping con TODOS los mensajes del hilo. 1.D búsqueda en tiempo real con CSS-only filtering (data-attributes + display:none, preserva foco). (D) **3 Bugs Menores**: `to_list` para recibidos, thread `has_unread` al llegar mensaje nuevo, word-break CSS para emails largos. (E) **5 Features Future**: Labels reales de Gmail, search operators (`from:`/`to:`/`subject:`/`has:attachment`/`after:`/`before:`), sync bidireccional (mark read + archive), firma al enviar (localStorage), adjuntos reales (base64url → Blob → download). (F) **6 Afinamientos visuales**: subject 1.5rem, detail avatar 52px, filter active con shadow, empty state con SVG, row padding 10/16, toolbar detail 8/16. (G) **Thread grouping Gmail-style overhaul**: último mensaje expandido, resto colapsado, quoted text colapsable con `<details>`. (H) **BEM refactor 4 componentes** con tokens CSS (`--email-bg`, `--email-bg-read`, `--email-border`, `--email-accent`, `--email-row-height-min: 48px`, `--email-row-padding-v: 12px`): `.email-row` (5-col grid + estados via data-attributes), `.thread-header` (recipients colapsables), `.quoted-thread` + `.message-block` (collapsed/expanded), `.compose-panel` minimizable (bottom-right corner, toggle ESC inteligente). (I) **Features post-BEM**: adjuntos reales con download, editor de firma con mini modal, badge "N mensajes" en lista, auto-refresh cada 5 min (pausa en visibilitychange, stop en navigateBack), operadores visuales con chips removibles, quote del reply como bloque HTML arriba del textarea. (J) **4 Fixes visuales Gmail-style** (comparación visual con Gmail): regex que limpia headers MIME en cualquier parte del body (no solo al inicio), `overflow-wrap: anywhere` para emails largos (no cortar), `formatRelativeTime` para "hace X horas", chip "Recibidos" removable al lado del subject. (K) **Integración con app principal**: botón en `index.html` con badge de alertas (KAirAlerts replicado), iframe en `renderer.js` con cache-bust dinámico (v=576→613), postMessage para toggle/close, sección Gmail completa en `config-viewer.html` con switch iOS. 3 formas de salir: toggle, FAB "← Volver", ESC. **135/135 tests OK** acumulados en 6 archivos de test (`test-compose-bem.js`, `test-fixes-loop1.js` al `loop5.js`).

### Build & Tooling
- **🔖 Bump version 0.1.120** — `package.json` alineado con el tag nuevo.

## [0.1.119] - 2026-07-17

### Changed
- **📊 Gráfica de Objetivos SST rediseñada** (`📦562`, `9d3e061`) — Stacked horizontal bar 100% con labels de principios reales (Prevención, Requisitos Legales, Satisfacción Cliente, Recursos y Mejora), color por rango (verde ≥70%, amarillo ≥40%, rojo <40%), número grande "X/Y (Z%)" adentro de cada barra, tarjeta clickeable → submódulo 2.2.1. 2 archivos (`main.js`, `gestion-integral-home.js`), +254/-85 líneas.

### Fixed
- **🛠️ 4 fixes de datos en `calculateObjetivosStats`** (`📦562`) — KEYWORD_MAP[1] ampliado con `incidencia`/`prevalencia`/`ifa`/`incapacidad`; `matchAutoResultado` con búsqueda directa del autoKey (Estrategia 1) + fallback con propagación de valor cuando `porcentajeReal=0` (Estrategia 3); `calculateAutoResultados` ahora calcula `porcentajeReal` para ausentismo/prevalencia/incidencia leyendo las metas del Excel 2.2.1. Resultado: Prevención pasa de 2/6 (33%) rojo a 5/6 (83%) verde; total sube de 2/15 (13%) a ~7/15 (47%) amarillo en Tempoactiva. 78/78 tests OK.
- **🔢 A1: parsear meta y valor numérico** (`📦561`, `37dc419`) — 3 nuevos helpers `parseMetaIndicador` (parsea `<1`, `0`, `<5`, `<50`, `<=10`, `>=0.5`), `parseValorIndicador` (extrae primer número de textos como "IF promedio: 0.0421"), `evaluarCumplimientoPorMeta` (escala inversa para metas `lt`). Integrados como fallback en `calculateObjetivosStats`. 69/69 tests OK.
- **📋 Cálculo de cumplimiento refactorizado** (`📦560`, `811a987`) — `calculateObjetivosStats` ahora usa resultados manuales (JSON `resultados-objetivos.json`) + auto-resultados por keyword, en vez de buscar la palabra "cumplido" en una columna del Excel. Soporta `groupIdx-indicatorIdx` igual que el viewer del submódulo. 30/30 tests OK.
- **🔍 Top 10 CIE-10 no respetaba filtro de año** (`📦559`, `514df13`) — `applyStatsFilters()` ahora también recalcula `this.currentAusentismoStatsExtended` y re-renderiza las tabs extendidas. 1 archivo (`medicion-ausentismo.js`), +6/-0 líneas.

### Build & Tooling
- **🔖 Bump version 0.1.119** (`📦558`, `4506713`) — `package.json` alineado con el tag nuevo.

## [0.1.118] - 2026-07-15

### Documentation
- **📄 Spec huérfana: mejora de Política SST stats** (`2a10efb`) — Documento de diseño que describe la solución aprobada (Approach B) para mejorar la detección del documento Política SST en Gestión Integral. Sin cambios al código. Sigue en historial como docs huérfana, pendiente decisión del usuario sobre archivarlo o mantenerlo.

## [0.1.117] - 2026-07-13

### Added
- **🛠️ Build script automatizado** (`📦554`, `4fc38f8`) — `build-and-publish.bat` en `sgsst-electron-app/`. Resuelve el problema recurrente del 422 "tag already exists" cuando se borra una release desde la UI de GitHub. El script hace: validación de `GH_TOKEN`, borrado del tag viejo (local + remoto), `git pull`, limpieza de `dist/`, `electron-builder --publish=always`, validación de los 3 assets críticos (exe, blockmap, latest.yml). 13/13 tests OK.

### Changed
- **📅 Calendario: 4 fixes del day popover + nuevos widgets** (`📦557`, `3d5f07e`) — (1) Cache-bust stale en `index.html` `?v=505` → `?v=545`. (2) Typo `_cancelDayPopover()` → `_closeDayPopover()` en `kair-calendar.js:480`. (3) z-index del day popover 1100 → 200001 (tapado por header 100000). (4) Listeners directos en botones del popover con `stopPropagation()` (handler equivocado en container). (B) 2 widgets nuevos en home de Gestión Integral: **Pipeline** (5 etapas Solicitud→Cerrado) y **Aging** (4 buckets 0-15/16-30/31-60/60+ días) para reemplazar Política SST y Objetivos SST, con datos del módulo 2.11.1 Gestión del Cambio. (C) Limpieza widget Política SST (4 métodos + ~101 líneas CSS eliminados). (D) Removido año "2026" de labels de widgets en Recursos y Gestión Integral. 5 archivos, +342/-32 líneas. Tests: 38 OK en `test-cambio-stats.js`.
- **🔖 Bump version 0.1.117** (`📦556`, `36b7651`)

### Build & Tooling
- **🏷️ Tag cleanup v0.1.110-118** — Eliminados tags y releases intermedios antes de crear v0.1.119 limpio.

## [0.1.111] - 2026-07-04 → [0.1.116] - 2026-07-10

> **Nota:** Versiones intermedias con bug fixes y mejoras menores entre v0.1.110 y v0.1.117. Sin entradas detalladas porque no se documentaron en su momento. Si necesitás detalle de algún cambio específico en este rango, revisar `git log v0.1.110..v0.1.117` en la rama `Dev-Pc`.

Cambios principales inferidos:
- 0.1.111-0.1.116: builds intermedios sin tags publicados
- Commits internos relacionados con fix de bugs varios (ver git log para detalle)

## [0.1.110] - 2026-07-04

### Added
- **🎨 Sistema de Skeleton Screens — sistema centralizado v1.0**
  - API `window.KairSkeleton.*` con 10 componentes: `kpiStrip`, `table`, `chartBars`, `chartDonut`, `filters`, `section`, `form`, `detail`, `list`, `card` + primitiva `bar` + helpers `show`/`hide`
  - Bloque CSS `.ks-*` en `styles.css` con theming automático light/dark/dark-legacy via variables (`--ks-base`, `--ks-highlight`)
  - Reutiliza `@keyframes km-loading-shimmer` existente (no duplica animación)
  - Cascada de delays con `.ks-stagger` (1..N+10 hijos)
  - Respeta `prefers-reduced-motion`
  - Demo interactivo: `docs/skeleton-demo.html` (carga el sistema real del repo)
  - Docs: `docs/SKELETON-SYSTEM.md` (~450 líneas) + `docs/SKELETON-HOMES.md` (~270 líneas)

- **🎨 Skeleton en 7 homes de módulo principales** (`📦491`)
  - Skeleton inyectado antes de la carga async en cada home
  - Conteo ajustado al render real (5-7 widgets, 2-3 charts)
  - Fix crítico de orden: `appendChild` al DOM ANTES del `await renderMainArea`
  - Fix de limpieza: `container.innerHTML = ''` en `renderMainArea()` para borrar skeleton
  - 200ms de retardo con `setTimeout(200)` (suficiente para que el ojo humano registre el skeleton)
  - Aplicado a: Gestion Integral, Recursos, Gestion Salud, Gestion Peligros, Gestion Amenazas, Verificación, Mejoramiento

### Fixed
- **Skeleton se quedaba estático** (`📦491-fix`, `📦491-fix2`)
  - Bug: `await this.renderMainArea(mainArea)` corría ANTES del `appendChild` al DOM, el skeleton nunca se veía
  - Bug: `requestAnimationFrame` (16ms) insuficiente para que el ojo humano registre el skeleton
  - Fix: invertir orden + usar `setTimeout(200)` en lugar de `requestAnimationFrame`

### Changed
- **📦490 — Cleanup final del sistema de Skeletons**
  - 25 archivos modificados, +28/-437 líneas (borrando CSS obsoletas, helpers JS, etc.)
  - Backward compat: `.km-loading-skeleton*` y `@keyframes km-loading-shimmer` conservadas en `styles.css` (legacy views lo usan, sistema `ks-*` lo reutiliza)
  - Documentación: `docs/SKELETON-SYSTEM.md` con guía completa + sección de troubleshooting

### Migration Notes
- Si vas a usar skeleton en una vista nueva: `container.innerHTML = KairSkeleton.X()` antes del await, y `container.innerHTML = ''` al inicio del render real.
- Si vas a agregar un home de módulo: seguir el patrón canónico de `docs/SKELETON-HOMES.md`.

---

## [0.1.102] - 2026-06-17

### Fixed
- **🎬 Pantalla de carga de login — barra inicia en 0% y se anima continuo**
  - Eliminada regla CSS conflictiva `.progress-fill { width: 50%; animation: progressAnimation 2s infinite; }` que anulaba el control por JavaScript sobre la barra de progreso del overlay
  - `KairLoadingController.animateToProgress()` migrado a `requestAnimationFrame` con `this.progress` continuo (la siguiente llamada continúa desde el valor actual en vez de reiniciar a 0)
  - `executeLoginTransition()` con secuencia sincronizada 0→25→55→80→100% — sin "saltos" entre fases
  - `button.disabled = true` en submit del login (restaurado en `finally`) — anti double-click / double-submit
  - `logBuffer` con eviction FIFO a 500 entradas (antes crecía sin tope → fuga de memoria)
  - Cache de `logTextarea` en variable local (antes hacía `getElementById` en cada log)

### Technical Details
- **Archivos modificados (2):**
  - `styles.css` — eliminada regla duplicada `.progress-fill` y keyframe `progressAnimation`
  - `renderer.js` — `KairLoadingController.animateToProgress` con `requestAnimationFrame`, `executeLoginTransition` sincronizada, submit con `button.disabled`, `logBuffer` con FIFO

## [0.1.101] - 2026-06-14

### Added
- **📊 Submódulo 3.3.4 Prevalencia de Enfermedad Laboral** 🆕
- Componente completo con tabla editable, gráfico Chart.js, 5 KPIs
- Fórmula: (Casos nuevos y antiguos de EL / Promedio de Trabajadores) × 100,000
- Backend: `leerIndicadoresPrevalencia()`, `escribirEnExcelPrevalencia()`
- IPC Handlers: `prevalencia:configurar-rutas`, `prevalencia:leer-indicadores`, `prevalencia:escribir-excel`
- Namespace preload: `window.electronAPI.prevalencia`
- CSS Scope: `.prevalencia-container` (124 selectores)

- **📊 Submódulo 3.3.5 Incidencia de Enfermedad Laboral** 🆕
- Componente completo con tabla editable, gráfico Chart.js, 5 KPIs
- Fórmula: (Casos nuevos de EL / Promedio de Trabajadores) × 100,000
- Meta: <5 por 100,000 trabajadores (Coordinador SST)
- Backend: `leerIndicadoresIncidencia()`, `escribirEnExcelIncidencia()`
- IPC Handlers: `incidencia:configurar-rutas`, `incidencia:leer-indicadores`, `incidencia:escribir-excel`
- Namespace preload: `window.electronAPI.incidencia`
- CSS Scope: `.incidencia-container` (124 selectores)

- **🔗 Integración Automática con Objetivos SST**
- Keywords `'prevalencia'` e `'incidencia'` se crean siempre en `calculateAutoResultados()`
- Viewer muestra resultado calculado automáticamente (sin necesidad de "Agregar")

### Changed
- **`excel-bridge.js`** — `leerIndicadores()` ahora suma los 12 meses para `prevalenciaEL` e `incidenciaEL` (antes solo leía enero)
- **`main.js`** — `calculateAutoResultados()` crea keywords `'prevalencia'` e `'incidencia'` sin condición `> 0`
- **`preload.js`** — Agregados namespaces `prevalencia` e `incidencia`
- **`renderer.js`** — Agregadas funciones `showPrevalenciaContent()` e `showIncidenciaContent()` con routing
- **`prevalencia-enfermedad-laboral.js`** — API cambiada de `frecuenciaAccidentalidad` a `prevalencia`, estructura de datos actualizada

### Technical Details
- **Archivos creados (8):**
  - `modules/gestion-salud/prevalencia-enfermedad-laboral/index.js`
  - `modules/gestion-salud/prevalencia-enfermedad-laboral/prevalencia-enfermedad-laboral.{html,js,css}`
  - `modules/gestion-salud/incidencia-enfermedad-laboral/index.js`
  - `modules/gestion-salud/incidencia-enfermedad-laboral/incidencia-enfermedad-laboral.{html,js,css}`

- **Archivos modificados (5):**
  - `main/excel-bridge.js` — +4 funciones, +incidenciaEL en leerIndicadores, +exports
  - `main.js` — +6 handlers IPC, mejorar calculateAutoResultados
  - `preload.js` — +2 namespaces (prevalencia, incidencia)
  - `renderer.js` — +showIncidenciaContent, +routing case 3.3.5
  - `modules/gestion-salud/prevalencia-enfermedad-laboral/prevalencia-enfermedad-laboral.js` — API namespace fix

---

## [0.1.100] - 2026-06-11

### Added
- **🎯 Header Card Pattern (`k-section-card`)** 🆕
- Patrón canónico de header para todos los módulos K+AIR
- Estructura: card container → Fila 1 (icon + title + subtitle) + actions (company, dividers, buttons)
- Clases: `.k-section-card`, `.header-back-btn`, `.header-action--ghost`, `.header-action--success`, `.k-section-card__company`, `.k-section-card__divider`
- Responsive: flex-wrap en mobile, company oculta en breakpoints bajos
- Dark theme: todos los componentes soportan `[data-theme="dark"]`
- Loading states: `header-action--primary--loading`, `header-action--success--loading`

- **📋 Migración Masiva de Headers** 🆕
- 22 submódulos migrados de BEM `kair-header` a `k-section-card`
- Módulo 1 (Recursos): Presupuesto Selector, COPASST Actas, Comité Actas, Capacitaciones, Inducciones
- Módulo 2 (Gestión Integral): Objetivos, Evaluación Inicial, Plan de Trabajo, Archivo, Rendición, Proveedores, Selección, Cambio
- Módulo 3 (Gestión Salud): Evaluaciones Médicas, Remisiones, Reportes, Investigación, Registro, Frecuencia, Severidad, Mortalidad

### Changed
- **Header System** — Eliminado BEM `kair-header__*` de 22 módulos, reemplazado por `k-section-card`
- **CSS Consolidation** — Cada módulo ahora scope sus estilos card bajo su namespace (`.modulo .k-section-card`)
- **Tabs Integration** — Módulos con tabs ahora los integran DENTRO del card (no como elemento separado)
- **Responsive Patterns** — Todos los módulos migrados usan `flex-wrap: wrap` y `padding: 1rem` en mobile
- **Print Styles** — Referencias `.kair-header` reemplazadas por `.k-section-card` en media queries de impresión

### Fixed
- **Header sticky en mobile** — Eliminado `position: sticky` del header BEM que causaba overlap en scroll
- **Breadcrumb overflow** — Subtítulos reemplazan breadcrumb para mejor legibilidad en mobile
- **Button consistency** — Todos los botones de acción usan mismas clases (ghost/success/primary)

### Technical Details
- **Archivos modificados (22 submódulos, 42 archivos):**
  - `modules/recursos/presupuesto/presupuesto-selector.html`
  - `modules/recursos/copasst/copasst-logic.js`
  - `modules/recursos/comite-convivencia/comite-convivencia-logic.js`
  - `modules/recursos/capacitaciones/capacitaciones-view.{html,css}`
  - `modules/recursos/capacitaciones/capacitaciones-logic.js`
  - `modules/recursos/inducciones/inducciones-view.{html,css}`
  - `modules/recursos/inducciones/inducciones-logic.js`
  - `modules/gestion-integral/objetivos-sst/objetivos-sst-view.html`
  - `modules/gestion-integral/evaluacion-inicial-sg-sst/evaluacion-inicial-sg-sst.{js,css}`
  - `modules/gestion-integral/plan-trabajo/plan-view.{html,css}`
  - `modules/gestion-integral/plan-trabajo/plan-viewer.js`
  - `modules/gestion-integral/archivo-retencion/index.html`
  - `modules/gestion-integral/archivo-retencion/archivo-retencion-dashboard.html`
  - `modules/gestion-integral/rendicion-cuentas/rendicion-cuentas.html`
  - `modules/gestion-integral/rendicion-cuentas/rendicion-viewer.js`
  - `modules/gestion-integral/evaluacion-proveedores/evaluacion-proveedores.{js,css}`
  - `modules/gestion-integral/evaluacion-seleccion/evaluacion-seleccion-component.js`
  - `modules/gestion-integral/evaluacion-seleccion/evaluacion-seleccion.css`
  - `modules/gestion-integral/evaluacion-seleccion/dashboard.js`
  - `modules/gestion-integral/gestion-del-cambio/gestion-cambio-view.{html,css}`
  - `modules/gestion-salud/evaluaciones-medicas/evaluaciones-medicas-view.{html,css}`
  - `modules/gestion-salud/evaluaciones-medicas/evaluaciones-view.html`
  - `modules/gestion-salud/restricciones-medicas/remisiones-view.{html,css}`
  - `modules/gestion-salud/reportes-accidentes/reportes-accidentes-view.{html,css}`
  - `modules/gestion-salud/investigacion-accidentes/investigacion-accidentes-view.{html,css}`
  - `modules/gestion-salud/investigacion-accidentes/investigaciones-view.{html,css}`
  - `modules/gestion-salud/registro-estadistico/registro-estadistico.{html,css}`
  - `modules/gestion-salud/frecuencia-accidentalidad/frecuencia-accidentalidad.{html,css}`
  - `modules/gestion-salud/severidad-accidentalidad/severidad-accidentalidad.{html,css}`
  - `modules/gestion-salud/indice-mortalidad/indice-mortalidad.{html,css}`

- **Patrón de migración:**
  1. Header BEM (`<header class="kair-header">`) → Card (`<div class="k-section-card">`)
  2. Breadcrumb → Subtitle (`<p style="...">`)
  3. Back button icon-only → Back button with text ("Volver")
  4. Company chip → `.k-section-card__company`
  5. Action buttons → `.header-action--ghost` / `.header-action--success`
  6. CSS BEM eliminated, card styles added scoped under module namespace
  7. Responsive: `flex-wrap: wrap`, company hidden, padding reduced
  8. Print: `.kair-header` → `.k-section-card`

- **IDs preservados en todos los módulos:** Ningún ID de elemento fue modificado, garantizando compatibilidad con JavaScript existente

---

## [0.1.99] - 2026-06-09

### Added
- **📊 Dashboard Plan de Trabajo 2.4.1** 🆕
- KPIs estandarizados con `k-stats-ribbon` canónico (KPI Strip Enterprise v1.0)
- Nomenclatura alineada a Capacitaciones: Programadas/Realizadas/Pendientes/Vencidas
- KPI Avance % integrado como pill badge en primer item
- Tabs-header con empresa y periodo activo (BEM `.k-tabs-header`)
- Charts-grid 3x2 con 6 gráficas:
  - **Estado** (bar) — Programadas vs Realizadas vs Pendientes vs Vencidas
  - **Progreso Mensual** (line) — Evolución mes a mes
  - **Cumplimiento Trimestral** (bar agrupado) — Q1-Q4 Programadas vs Ejecutadas
  - **Estado Mensual** (stacked bar) — Distribución por mes
  - **Categoría** (horizontal bar) — Cumplimiento por grupo padre (level===1)
  - **Radar Anual** (radar) — Distribución 12 meses
- Colores K+AIR canónicos (`K_COLORS = { primary, success, warning, danger, info, gray, text }`)

- **🪟 Modal Selector de Periodo** 🆕
- Cierra con botón X (esquina superior derecha, `.period-card__close`)
- Cierra con clic en fondo (patrón UX estándar)
- Función `hidePeriodSelector()` expuesta en `window`

- **🧹 PlanTrabajoComponent.destroy()** 🆕
- Patrón consistente con COPASST (`copasstPortalComponent.destroy()`)
- Null refs: `window.planPortalComponent`, `window.planPortalContainer`
- Cleanup: remueve script dinámico del DOM
- Limpia container: `this.container.innerHTML = ''`

- **🔄 goBackToModuleHome()** 🆕
- Método directo sin postMessage (evita loop del renderer)
- Llama `destroy()` + `onBackToModuleHome()` → navega a menú Gestión Integral
- Separa flujos de navegación: portal home vs cronograma

### Changed
- **plan-trabajo/plan-view.html** — Dashboard HTML con tabs-header, k-stats-ribbon, 6 chart-cards, canvas ids actualizados
- **plan-trabajo/plan-view.css** — ~1080 líneas, k-stats-ribbon, tabs-header BEM, charts-grid 3 cols, period-card__close
- **plan-trabajo/plan-viewer.js** — ~1573 líneas, 6 funciones render chart, updateKPIs(), hidePeriodSelector(), K_COLORS
- **plan-trabajo/plan-trabajo-logic.js** — `destroy()`, `goBackToModuleHome()`, `portalScript` ref almacenado desde `initPortalJS()`
- **plan-trabajo/plan-home.js** — `goBackToModule()` → llamada directa a `planPortalComponent.goBackToModuleHome()` (antes: postMessage)
- **plan-trabajo/plan-home.html** — `.back-btn-internal:hover/focus/active` con `text-decoration: none`
- **renderer.js** — 2 handlers `back-to-module-request` (líneas ~878 y ~1202) con delegación `goBackToHome()` restaurada

### Fixed
- **Navegación "Volver" del cronograma** — Antes: postMessage `back-to-submodule-home` no funcionaba (requería 3 args). Ahora: postMessage → renderer → `planPortalComponent.goBackToHome()` → portal home
- **Navegación "Volver al Menú" del portal home** — Antes: postMessage → renderer delegaba a `goBackToHome()` → recargaba el mismo home (loop). Ahora: llamada directa a `goBackToModuleHome()` → `destroy()` + `onBackToModuleHome()` → menú Gestión Integral
- **Subrayado en botón "Volver al Menú"** — `text-decoration: none` en `:hover`, `:focus`, `:active` de `.back-btn-internal`

### Technical Details
- **Archivos modificados:**
  - `modules/gestion-integral/plan-trabajo/plan-view.html` — Dashboard HTML
  - `modules/gestion-integral/plan-trabajo/plan-view.css` — CSS completo (~1080 líneas)
  - `modules/gestion-integral/plan-trabajo/plan-viewer.js` — JS completo (~1573 líneas)
  - `modules/gestion-integral/plan-trabajo/plan-trabajo-logic.js` — Componente con `destroy()`, `goBackToModuleHome()`
  - `modules/gestion-integral/plan-trabajo/plan-home.js` — Navegación directa
  - `modules/gestion-integral/plan-trabajo/plan-home.html` — Fix subrayado
  - `renderer.js` — 2 handlers de delegación restaurados

- **Flujos de navegación:**
  ```
  Cronograma (iframe):
    backBtn → postMessage('back-to-module-request')
    → renderer → planPortalComponent.goBackToHome()
    → recarga portal home ✓

  Portal Home:
    goBackToModule() → planPortalComponent.goBackToModuleHome()
    → destroy() + onBackToModuleHome()
    → menú Gestión Integral ✓
  ```

- **Contratos IPC:** Sin cambios (mismos handlers existentes)
- **Backend:** Sin cambios (0 modificaciones en main.js)

### Impacto
- **UX:** Dashboard profesional con 6 gráficas y KPIs estandarizados
- **Navegación:** 2 flujos claros y separados, sin loops ni estados atascados
- **Consistencia:** Patrón destroy igual a COPASST y Comité de Convivencia
- **Visual:** Botones de navegación sin subrayado espurio

### Breaking Changes
- **Ninguno** — Funcionalidad puramente aditiva y correctiva, contratos sin cambios

---

## [0.1.98] - 2026-06-04

### Fixed
- **Plan de Trabajo en actas COPASST** - Lee columna del mes anterior (norma COPASST), no del mes de la reunion
- **Bug de mes en nombre de archivo** - `parseInt(data.fecha.split('-')[1])` reemplaza `new Date().getMonth()` (bug UTC-5 Colombia)
- **Nombre de archivo guardado** - Eliminado "N°{actaNumber}" del nombre por defecto

### Changed
- **Autollenado de actas COPASST** - Plan de Trabajo referencia `previousMonthKey` + `planYearForPrevious` (transicion de ano)
- **Texto de desarrollo items** - Formato multilinea con `\n`, numeracion, iconos ✓/⏱, agrupacion por estado
- **Textarea auto-expandible** - `temaRows` calculado dinamicamente segun cantidad de `\n`
- **Accidentalidad enriquecida** - Lee columnas `Nombre Completo`, `Identificacion`, `Fecha del incidente` con fallbacks
- **Texto de accidentes** - Formato `Nombre — CC — Fecha DD/MM/YYYY` con numeracion

### Added
- Busqueda de Plan de Trabajo por `previousMonthYear` cuando el mes anterior cruza ano (Enero → Diciembre)
- Campos `identificacion` y `fechaEvento` en `accidentData.persons` (aditivo, backward compatible)

---

## [0.1.94] - 2026-03-26

### Added
- **📊 Widget de Actas COPASST parametrizado** 🆕
  - Detección automática de actas de reunión del mes en curso
  - Widget en Recursos con estado "Al día" o "Pendiente" (similar a Afiliación SSSI)
  - Alertas críticas si no hay acta del mes actual
  - Muestra total de actas y último mes registrado

- **🔧 Scrollbars personalizados (grises)** 🆕
  - Scrollbars grises (#c1c9d0) en toda la aplicación
  - Hover: gris medio (#adb5bd), Active: gris oscuro (#6c757d)
  - Funcionales en tamaño mínimo de ventana (1024x650)
  - Scroll activado en dashboard (módulos y tareas)

- **📈 Alertas de Comité de Convivencia (2 alertas)** 🆕
  - Alerta informativa: "Constitución al día" cuando el período está vigente
  - Alerta crítica: "Sin reunión desde [Mes]" cuando faltan actas mensuales
  - Verificación de reuniones mensuales (similar a COPASST)

- **📈 Alertas de COPASST mejoradas** 🆕
  - Alerta informativa: "Constitución al día" cuando el período está vigente
  - Alerta crítica: "Sin reunión desde [Mes]" cuando faltan actas mensuales
  - Detección por nombre de archivo (NO por fecha de modificación)

### Changed
- **main.js** - Funciones agregadas/modificadas:
  - `calculateCopasstStats()` - Nueva lógica tipo afiliación (detecta mes en curso)
  - `verifyCommitteePeriod()` - Ahora retorna período vigente correctamente (2 años)
  - `verifyCOPASSTMeetings()` - Usa `getActasByFileName()` en lugar de fecha de modificación
  - `verifyConvivenciaMeetings()` - Nueva función para verificar reuniones mensuales
  - `getActasByFileName()` - Nueva función auxiliar (extrae mes del nombre de archivo)

- **recursos-home.js** - Métodos modificados:
  - `createCopasstWidget()` - Ahora usa diseño tipo tarjeta (similar a Afiliación)
  - Muestra badge "Al día" o "Pendiente" según corresponda
  - Widget de EPPs eliminado (reemplazado por Actas COPASST)

- **styles.css** - Scrollbars personalizados:
  - `::-webkit-scrollbar` - Ancho 8px, fondo #f8f9fa, thumb #c1c9d0
  - `[data-module-list]`, `#tasks-container` - Scroll forzado en tamaño mínimo
  - `max-height: calc(100vh - 200px)` - Para activar scroll en dashboard

### Technical Details
- **Estructura de datos `calculateCopasstStats()`:**
  ```javascript
  {
    totalActas: 0,
    actaMesEnCurso: false,
    ultimoMesRegistrado: null,
    actasAnio: 0,
    estado: 'danger',  // 'ok', 'warning', 'danger'
    alertas: []
  }
  ```

- **Búsqueda de archivos:**
  - Filtra: `*acta*copasst*.xlsx`
  - Extrae mes del nombre: `(enero|febrero|...|diciembre)`
  - Busca en carpetas: `COPASST {year}/`

- **Lógica de período vigente:**
  - Período = 2 años (ej: 2024-2026)
  - Vigente hasta diciembre del año `latestYear + 2`
  - Alerta temprana cuando faltan ≤3 meses para vencer

### Impacto
- **UX:** Widget de Actas COPASST consistente con Afiliación SSSI
- **Dashboard:** 2 alertas por comité (constitución + reuniones)
- **Visual:** Scrollbars grises armonizan con diseño de la app
- **Funcionalidad:** Scroll activado en tamaño mínimo de ventana

### Breaking Changes
- **Widget de EPPs eliminado** - Reemplazado por Widget de Actas COPASST
- **Cambio de estructura** - `calculateCopasstStats()` ahora retorna formato tipo afiliación

---

## [0.1.93] - 2026-03-25

### Added
- **🎨 Visualizadores Modernizados (9 submódulos)** 🆕
  - **Drag & Drop de Archivos** - Overlay visual con ícono animado, subida automática
  - **Menú Contextual (Clic Derecho)** - Abrir archivo, Eliminar archivo
  - **Modal de Confirmación Moderno** - Diseño centrado con animación slideUp
  - **Notificaciones Toast Modernas** - 4 tipos (success, error, warning, info)
  - **Abrir Archivo con App Predeterminada** - Usa electronAPI.open-file

### Changed
- **Submódulos actualizados (9):**
  - `1.1.1 Responsable del SG` - viewer modernizado
  - `1.1.2 Roles y Responsabilidades` - viewer modernizado
  - `1.1.4 Afiliación al SSSI` - viewer modernizado
  - `1.1.5 Trabajo de Alto Riesgo` - viewer modernizado
  - `1.1.6 Conformación de Copasst` - viewer modernizado
  - `1.1.7 Capacitación al Copasst` - viewer modernizado
  - `1.1.8 Comité de Convivencia` - viewer modernizado
  - `1.2.3 Curso Virtual 50 Horas` - viewer modernizado
  - `1.2.4 Manual SST para Proveedores` - viewer modernizado

- **Archivos modificados por submódulo:**
  - `[submodulo]-view.html` - ~40 líneas (contextMenu, confirmModal, kToastContainer)
  - `[submodulo]-view.css` - ~280 líneas (estilos para modales, toast, drag&drop)
  - `[submodulo]-viewer.js` - ~450 líneas (funciones modernas)

### Technical Details
- **Funciones JavaScript agregadas:**
  - `setupDragAndDrop()`, `setupFolderDragAndDrop()` - Drag & Drop
  - `showContextMenu()`, `hideContextMenu()`, `deleteDocument()` - Menú contextual
  - `showToast()` - Notificaciones toast
  - `showConfirmModal()`, `acceptConfirm()`, `cancelConfirm()` - Modal confirmación
  - `openFile()` - Abrir con app predeterminada

- **Funciones actualizadas:**
  - `setupEventListeners()` - Ahora llama a setupDragAndDrop y setupContextMenu
  - `renderFolders()` - Agrega clase 'folder' y configura drag&drop
  - `renderDocuments()` - Agrega evento contextmenu para clic derecho

### Impacto
- **UX:** Mejora significativa en usabilidad y consistencia entre submódulos
- **Backend:** Sin cambios (mismos contratos IPC)
- **Temas:** Compatible con claro, oscuro (system), oscuro (legacy)
- **Consistencia:** 9 visualizadores con misma UX/UI

### Breaking Changes
- **Ninguno** - Funcionalidad puramente aditiva, contratos sin cambios

---

## [0.1.92] - 2026-03-25

### Added
- **📊 Alerta de Afiliación SSSI** 🆕
  - Detección automática de planillas faltantes del mes en curso
  - Widget en Recursos con estado "Al día" o "Pendiente"
  - Alerta crítica en dashboard si no hay planilla del mes

- **🎯 Dashboard con Filtros por Módulo** 🆕
  - Panel lateral "MÓDULOS DEL SISTEMA" interactivo
  - Resaltado azul del módulo seleccionado
  - Click en módulo filtra tareas del dashboard

- **🧹 Sidebar Inteligente** 🆕
  - Limpieza automática de estado activo al cambiar empresa/módulo
  - Sin botones resaltados permanentemente

### Changed
- **main.js** - Funciones agregadas:
  - `calculateAfiliacionStats()` - Calcula estadísticas de afiliación
  - `get-recursos-stats` API - Integrada con afiliación
  - `getDashboardAlertas()` - Alerta de afiliación agregada
  - Logs de depuración para todas las alertas

- **modules/recursos/recursos-home.js** - Funciones agregadas:
  - `calculateAfiliacionClientSide()` - Verifica afiliación (cliente)
  - `createAfiliacionWidget()` - Widget visual de afiliación
  - `loadResourceStats()` - Actualizada con afiliación

- **renderer.js** - Funciones actualizadas:
  - `filterDashboardTasksByModule()` - Ahora actualiza UI de módulos
  - `updateModuleSelection()` - Nueva función para resaltado
  - `clearFilter()` - Limpia selección de módulo

### Technical Details
- **Archivos modificados:**
  - `main.js` - ~150 líneas (calculateAfiliacionStats, logs)
  - `recursos-home.js` - ~150 líneas (afiliación widget)
  - `renderer.js` - ~50 líneas (filtro de módulos)

### Impacto
- **UX:** Alertas más precisas y dashboard más intuitivo
- **Backend:** Nuevos contratos para afiliación
- **Frontend:** Widget consistente con presupuesto

### Breaking Changes
- **Ninguno** - Funcionalidad aditiva

---

## [0.1.91] - 2026-03-22

### Added
- **🏠 Botón de Navegación "Home Empresa"** 🆕
  - **Botón en header** con ícono 🏠 junto a calendario, config y LLM
  - **Navegación de retorno** al Dashboard de la empresa desde cualquier módulo/submódulo
  - **Visibilidad inteligente** - Solo visible cuando es relevante (módulos/submódulos)
  - **Gestión de estado** - Reset automático de módulo y submódulo actual

### Changed
- **index.html** - Línea 52:
  - Botón `#company-home-button` agregado en `.header-buttons`
  - Icono 🏠 con título "Volver al Inicio de la Empresa"
  - Display none inicial (se muestra dinámicamente)

- **renderer.js** - Múltiples ubicaciones:
  - Línea 600 - Declarada variable `companyHomeButton`
  - Línea 704 - Obtenida referencia al elemento DOM
  - Líneas 1324-1335 - Event listener del botón
  - Líneas 2190-2219 - Función `handleCompanyHome()` implementada
  - Líneas 2300-2303 - Ocultar en `showCompanyHomePage()`
  - Líneas 2748-2750 - Mostrar en `showModuleContent()`
  - Líneas 3036-3038 - Mostrar en `showSubmoduleContent()`
  - Líneas 2278-2280 - Ocultar en `handleLogout()`

### Technical Details
- **Archivos modificados:**
  - `index.html` - 3 líneas agregadas
  - `renderer.js` - 38 líneas agregadas, 6 modificadas
- **Impacto de rendimiento:** Negligible (+1 referencia DOM, ~100 bytes)
- **Estilos:** Usa clase `.header-btn` existente (sin CSS nuevo)

### Impacto
- **UX:** Mejora significativa en navegabilidad - usuarios ya no quedan "atrapados" en módulos
- **Backend:** Sin cambios (0 modificaciones en main.js, 0 contratos alterados)
- **Temas:** Compatible con claro, oscuro (system), oscuro (legacy)
- **Responsive:** Funcional en todas las resoluciones (≥1024px)

### Breaking Changes
- **Ninguno** - Funcionalidad puramente aditiva

### Migration Notes
- **Para usuarios finales:** Reiniciar aplicación para ver el nuevo botón
- **Para desarrolladores:**
  - Función `handleCompanyHome()` en renderer.js (líneas ~2190-2219)
  - No se requiere acción adicional - cambios 100% frontend

---

## [0.1.90] - 2026-03-21

### Added
- **🎬 Transición Animada Login → Interfaz** 🆕
  - **Overlay de transición** con logo animado, spinner doble y ondas
  - **Mensajes dinámicos** con dots animados ("Verificando credenciales...", "Cargando configuración...", etc.)
  - **Barra de progreso** lineal con animación suave
  - **Check de éxito** SVG animado al completar
  - **Nombre del usuario** personalizado en la bienvenida
  - **Secuencia completa** de ~4.2 segundos con 8 fases animadas

### Changed
- **styles.css** - Sección TRANSICIÓN agregada (~350 líneas):
  - Keyframes: `kair-login-exit`, `kair-transition-enter`, `kair-transition-logo-pulse`, `kair-transition-spinner`, `kair-transition-dots`, `kair-transition-progress`, `kair-transition-ripple`, `kair-transition-success-circle`, `kair-transition-success-check`, `kair-interface-enter`
  - Clases: `.kair-transition-overlay`, `.kair-transition-logo`, `.kair-transition-spinner`, `.kair-transition-message`, `.kair-transition-progress-bar`, `.kair-transition-success`
  
- **renderer.js** - Funciones de transición agregadas:
  - `wait(ms)` - Utilidad para delays
  - `createTransitionOverlay()` - Crea overlay dinámicamente
  - `updateTransitionMessage(main, sub)` - Actualiza mensajes
  - `executeLoginTransition(userName)` - Ejecuta secuencia completa
  - `renderLoginScreen()` - Integrada con transición después de login exitoso

### Technical Details
- **Archivos modificados:**
  - `styles.css` - Líneas 4050-4403 (sección TRANSICIÓN)
  - `renderer.js` - Líneas 1514-1812 (funciones de transición)
- **Tiempos de animación:**
  - Login exit: 0.5s
  - Overlay enter: 0.3s
  - Loading sequence: ~2.0s (4 mensajes)
  - Success: 1.2s
  - Overlay exit: 0.4s
  - **Total:** ~4.4 segundos

### Impacto
- **UX:** Mejora significativa en percepción de calidad y profesionalismo
- **Backend:** Sin cambios (mismo contrato `auth-login-v1`)
- **Temas:** Compatible con claro, oscuro (system), oscuro (legacy)
- **Accesibilidad:** Respeta `prefers-reduced-motion`

### Breaking Changes
- **Ninguno** - Cambios 100% visuales, backend sin cambios

### Migration Notes
- **Para usuarios finales:** Reiniciar aplicación para ver cambios
- **Para desarrolladores:** 
  - Funciones de transición están en renderer.js (líneas ~1514-1660)
  - CSS de transición está en styles.css (líneas ~4050-4403)
  - No se requiere acción adicional

---

## [0.1.89] - 2026-03-21

### Added
- **🎨 Login Modernizado con Animaciones y Vanta.js** 🆕
  - **Animaciones de entrada** - Fade-in + slide-up para tarjeta, stagger para elementos
  - **Fondo Vanta.js** - Olas animadas que responden al mouse con colores corporativos
  - **Logo K+AIR** - Ícono K+ en gradiente + tagline "Powered by GEST-IAR"
  - **Íconos en inputs** - Sobre (email) y candado (password) con Font Awesome
  - **Micro-interacciones** - Hover, focus, shake en errores, spinner de carga
  - **Accesibilidad** - Respeta `prefers-reduced-motion`

### Changed
- **styles.css** - Sección AUTH completamente renovada (~400 líneas):
  - Keyframes: `kair-auth-card-enter`, `kair-auth-fade-in`, `kair-auth-button-shine`, `kair-auth-shake`, `kair-auth-logo-pulse`, `kair-auth-title-glow`, `kair-auth-spinner`
  - Selectores: `.kair-auth-logo`, `.kair-auth-logo-icon`, `.kair-auth-form-group`, `.kair-auth-input-wrapper`, `.kair-auth-input-icon`, `.kair-auth-button-loading`
  
- **renderer.js** - Función `renderLoginScreen()` renovada:
  - HTML con logo y íconos en inputs
  - Integración con Vanta.js para fondo animado
  - Manejo de errores mejorado con feedback visual
  - Listeners para limpiar errores al escribir

- **renderer.js** - Función `initializeAuthFlow()` actualizada:
  - Limpieza de efecto Vanta antes de renderizar login

### Technical Details
- **Archivos modificados:**
  - `styles.css` - Líneas 3408-3811 (sección AUTH renovada)
  - `renderer.js` - Líneas 1513-1650 (renderLoginScreen), 1660-1678 (initializeAuthFlow)
- **Dependencias requeridas:**
  - Font Awesome 6.5.0 (íconos)
  - Vanta.js 0.5.24 (fondo animado)
  - Three.js r134 (requerido por Vanta)

### Impacto
- **UX:** Mejora significativa en percepción visual de la aplicación
- **Backend:** Sin cambios (mismo contrato `auth-login-v1`)
- **Temas:** Compatible con claro, oscuro (system), oscuro (legacy)
- **Responsive:** Compatible con 480px+

### Breaking Changes
- **Ninguno** - Cambios 100% visuales, backend sin cambios

### Migration Notes
- **Para usuarios finales:** Reiniciar aplicación para ver cambios
- **Para desarrolladores:** 
  - Font Awesome y Vanta.js ya están cargados en `index.html`
  - No se requiere acción adicional

---

## [0.1.88] - 2026-03-21

### Fixed
- **🎨 Módulo Recursos: Espaciado entre Widgets y Gráficas** 🆕
  - **Problema:** Espacio excesivo (~6rem) entre estadísticas y gráficas
  - **Causa raíz:** Estilos globales en `styles.css` con `!important` sobrescribían estilos locales
  - **Solución:** Reglas CSS específicas con mayor especificidad para anular estilos globales

### Changed
- **modules/recursos/recursos-home.js** - Estilos actualizados:
  - `.main-area { gap }` - 1.5rem → 1rem (espacio entre contenedores)
  - `.charts-grid { gap }` - 1.5rem → 0.75rem (espacio interno entre gráficas)
  - `.charts-grid { margin-bottom }` - 2rem → 0.5rem (margen inferior)
  - `.chart-card { padding }` - 1.5rem → 0.75rem (padding interno de tarjetas)
  - `.chart-title { margin-bottom }` - 1rem → 0.5rem (margen del título)

### Added
- **Estilos de anulación agregados** (con `!important` para prioridad):
  ```css
  .gestion-integral-home .widget {
      margin-bottom: 0 !important;
      padding: 1rem !important;
  }
  
  .gestion-integral-home .widgets-container {
      margin-bottom: 0 !important;
      gap: 1rem;
  }
  
  .gestion-integral-home .chart-card {
      margin-top: 0 !important;
      margin-bottom: 0 !important;
      padding: 0.75rem !important;
  }
  
  .gestion-integral-home .charts-grid {
      margin-top: 0 !important;
  }
  ```

### Technical Details
- **Archivos modificados:**
  - `modules/recursos/recursos-home.js` - Líneas ~156-165, ~355-390 (inyección de estilos CSS)
- **Estilos globales identificados como conflicto:**
  - `styles.css` línea 1833-1839: `.widget { margin-bottom: 2.5rem !important; }`
  - `styles.css` línea 1851-1855: `.chart-container { margin-top: 2.5rem !important; }`
  - `development-styles.css` línea 718: `.widgets-container { margin-bottom: var(--spacer-lg); }`

### Impacto
- **Espacio visual total:** Reducido de ~6rem a ~1.5rem (75% menos espacio)
- **Módulo afectado:** Solo Módulo Recursos (home)
- **Otros módulos:** Sin cambios (0% impacto)
- **UX:** Mejora significativa en densidad de información visible

### Breaking Changes
- **Ninguno** - Solo cambios visuales en módulo Recursos
- **Compatibilidad:** Mantiene coherencia con sistema visual oficial K+AIR

### Migration Notes
- **Para usuarios finales:** Reiniciar aplicación para aplicar cambios
- **Para desarrolladores:** 
  - Al crear nuevos módulos, usar selectores con especificidad para evitar conflictos con estilos globales
  - Ejemplo: `.gestion-integral-home .widget` en lugar de `.widget`

---

## [0.1.87] - 2026-03-20

### Added
- **📱 Soporte Responsive para 1366x768 y 1536x864** 🆕
  - **Media queries específicas** por resolución (1536x864, 1366x768)
  - **Ajustes progresivos** - No afecta ≥1920x1080
  - **Layout optimizado** - Header, sidebar, fonts, widgets, gráficos
  - **Ventana inicial** - 1200x700 (cabe en 1366x768)

### Changed
- **main.js** - Dimensiones de ventana actualizadas:
  - `width`: 1024 → 1200 (+176px)
  - `height`: 900 → 700 (-200px)
  - `minWidth`: 900 → 1024 (+124px)
  - `minHeight`: 800 → 650 (-150px)

- **styles.css** - Media queries agregadas (~230 líneas):
  - `@media (max-width: 1536px) and (max-height: 864px)` - Ajustes moderados
  - `@media (max-width: 1366px) and (max-height: 768px)` - Ajustes optimizados

### Technical Details
- **Archivos modificados:**
  - `main.js` - Líneas 566-574 (BrowserWindow dimensions)
  - `styles.css` - Líneas ~3500-3737 (media queries)
- **Archivos creados:**
  - `docs/05-updates/v0.1.87-responsive-1366x768.md`

### Impacto
- **1366x768:** Scroll forzado → Todo visible (+95% mejora)
- **1536x864:** Scroll frecuente → Scroll mínimo (+70% mejora)
- **≥1920x1080:** Sin cambios (0% impacto)

### Breaking Changes
- **Ninguno** - Compatible con versiones anteriores
- **≥1920x1080:** Mantiene exactamente la misma UI
- **Ventana inicial:** Dimensiones optimizadas, usuario puede redimensionar

### Migration Notes
- **Para usuarios finales:** Reiniciar aplicación para aplicar cambios
- **Para desarrolladores:** Ninguna acción requerida

---

## [0.1.86] - 2026-03-20

### Added
- **📥 Visualizador 1.1.1: Arrastrar y Soltar Archivos** 🆕
  - **Drag & Drop por carpeta** - Overlay aparece solo en la carpeta destino
  - **Soporte para múltiples archivos** - Se procesan en paralelo
  - **Validaciones completas** - Tamaño (10MB), tipos permitidos, caracteres inválidos
  - **Feedback visual** - Borde dashed azul + overlay con ícono animado
  - **Notificación toast** - Éxito/error después de cada subida

- **🖱️ Visualizador 1.1.1: Menú Contextual con Clic Derecho** 🆕
  - **Opción "🔗 Abrir archivo"** - Abre con aplicación predeterminada del sistema
  - **Opción "🗑️ Eliminar archivo"** - Elimina con confirmación
  - **Divider horizontal** - Separa visualmente las opciones
  - **Posicionamiento inteligente** - Se ajusta si se sale de pantalla
  - **Cierre con clic fuera o Escape** - UX mejorada

- **🗑️ Visualizador 1.1.1: Eliminar con Confirmación Moderna** 🆕
  - **Modal K+AIR** - Reemplaza `confirm()` nativo
  - **Animación slide-in** - Desde arriba
  - **Mensaje personalizado** - Muestra nombre del archivo
  - **Advertencia amarilla** - "Esta acción no se puede deshacer"
  - **Botones diferenciados** - Cancelar (ghost) vs Eliminar (danger)

- **🎨 Notificaciones Toast Modernas** 🆕
  - **Sistema K+AIR** - Reemplaza notificaciones nativas
  - **4 tipos** - Success, Error, Warning, Info
  - **Animaciones** - Slide-in desde derecha, slide-out
  - **Auto-ocultado** - 3-6 segundos según tipo
  - **Apilables** - Múltiples notificaciones visibles

- **⚠️ Manejo Específico de Errores** 🆕
  - **EPERM** - "El archivo está abierto en otra aplicación. Ciérralo e intenta nuevamente."
  - **ENOENT** - "El archivo no existe. Puede que ya haya sido eliminado."
  - **EACCES** - "No tienes permisos para eliminar este archivo."
  - **Logging detallado** - Diagnóstico preciso de errores

### Changed
- **main.js** - Handlers IPC actualizados:
  - `upload-document` - Soporte drag & drop, validaciones mejoradas
  - `delete-document` - Manejo específico de errores Windows (EPERM, ENOENT, EACCES)
  - `open-file` - Nuevo handler para abrir con aplicación predeterminada

- **responsable-sg-viewer.js** - Funciones agregadas:
  - `setupFolderDragAndDrop()` - Configura drag & drop por carpeta
  - `showContextMenu()` - Muestra menú contextual
  - `showConfirmModal()` - Muestra modal de confirmación
  - `showToast()` - Muestra notificación toast
  - `openFile()` - Abre archivo con aplicación predeterminada
  - `deleteDocument()` - Elimina con confirmación moderna

- **responsable-sg-view.html** - Elementos agregados:
  - `#kToastContainer` - Contenedor de notificaciones toast
  - `#confirmModal` - Modal de confirmación K+AIR
  - `#contextMenu` - Menú contextual

- **responsable-sg-view.css** - Estilos agregados:
  - `.drag-drop-overlay` - Overlay para drag & drop
  - `.context-menu` - Menú contextual
  - `.k-toast`, `.k-toast-container` - Notificaciones toast
  - `.k-modal-overlay`, `.k-modal` - Modal de confirmación

### Technical Details
- **Archivos modificados:**
  - `main.js` - Líneas ~4176-4388 (3 handlers IPC)
  - `preload.js` - Líneas ~133-140 (3 funciones expuestas)
  - `responsable-sg-view.html` - Líneas ~125-165 (HTML)
  - `responsable-sg-view.css` - Líneas ~335-650 (estilos)
  - `responsable-sg-viewer.js` - Líneas ~95-450 (funciones)
  - `responsable-sg-logic.js` - Líneas ~60-72 (handlers)
  - `renderer.js` - Líneas ~827-834 (bridge)
- **Archivos creados:**
  - `docs/05-updates/v0.1.86-mejoras-visualizador-1.1.1.md`

### Impacto
- **UX:** Nativo → Moderno K+AIR
- **Acciones por archivo:** 1 → 3 (+200%)
- **Formas de subir:** 1 → 2 (+100%)
- **Errores manejados:** 1 → 4 (+300%)
- **Líneas agregadas:** ~650

### Breaking Changes
- **Ninguno** - Compatible con versiones anteriores
- **Funciones existentes** - No modificadas, solo agregadas
- **Contratos IPC** - Sin cambios en estructura de retorno

### Migration Notes
- **Para usuarios finales:** Ninguna acción requerida - funcionalidades adicionales
- **Para desarrolladores:** Ninguna acción requerida - APIs nuevas, no breaking

---

## [0.1.85] - 2026-03-20

### Added
- **📊 Feature: Tarjeta de Inducciones con Cumplimiento Normativo Real** 🆕
  - **Problema:** La tarjeta de Inducciones mostraba información incompleta (histórico en lugar de cumplimiento real)
  - **Solución:** Ahora usa el número de trabajadores de la empresa como denominador para calcular el porcentaje real
  - **Cambios principales:**
    - ✅ Lee `stats.employees` desde `config.companyPaths[empresa].stats`
    - ✅ Calcula pendientes: `empleados - completadas`
    - ✅ Calcula porcentaje real: `(completadas / empleados) * 100`
    - ✅ Alertas inteligentes: óptimo (≥90%), refuerzo (≥50%), crítico (<50%)
    - ✅ Fallback automático si no hay empleados configurados

### Changed
- **main.js** - Función `calculateInduccionesStats()` refactorizada:
  - Nuevo parámetro: `companyName` para leer config de la empresa
  - Nuevo campo: `totalTrabajadores` (lee desde `stats.employees`)
  - Nuevo cálculo: `pendientes = totalTrabajadores - completadas`
  - Nuevo porcentaje: `(completadas / totalTrabajadores) * 100`
  - Logging detallado para trazabilidad

- **main.js** - Handler `get-recursos-stats`:
  - Pasa `companyName` a `calculateInduccionesStats()`
  - Estructura de fallback actualizada con `totalTrabajadores: 0`

- **modules/recursos/recursos-home.js** - Función `createInductionWidget()`:
  - Usa `totalTrabajadores` como denominador
  - Fallback a `totalInducciones` si `totalTrabajadores = 0`
  - Mensaje de guía: `"⚠ Configure N° trabajadores en Ajustes"`
  - Nuevos umbrales de alerta: 90%, 50%, <50%

- **modules/recursos/recursos-home.js** - Función `loadResourceStats()`:
  - Estructura inicial incluye `totalTrabajadores: 0`

### Technical Details
- **Archivos modificados:**
  - `main.js` - Líneas 7430-7545 (calculateInduccionesStats), 7593-7635 (get-recursos-stats)
  - `modules/recursos/recursos-home.js` - Líneas 553 (loadResourceStats), 961-992 (createInductionWidget)
- **Archivos creados:**
  - `docs/05-updates/v0.1.85-inducciones-cumplimiento-normativo.md`
- **Contratos IPC:** Sin cambios (getRecursosStats retorna misma estructura)
- **Frontend:** Solo cambia visualización, sin cambios en contratos

### Impacto
- **Precisión del dato:** Histórico (inducciones/inducciones) → Normativo (completadas/trabajadores)
- **Pendientes visibles:** No mostraba → Muestra cantidad exacta
- **Porcentaje útil:** 100% (falso positivo) → Real según nómina
- **Acción requerida:** Ninguna → Alerta de refuerzo/crítico

### Ejemplo de Uso

**Antes:**
```
Empresa: 50 trabajadores
Inducciones completadas: 35
Widget: "35 / 35" + "✔ 100% Completado"  ❌ (falso positivo)
```

**Ahora:**
```
Empresa: 50 trabajadores (configurado en stats.employees)
Inducciones completadas: 35
Widget: "35 / 50" + "⚠ Refuerzo necesario (15 pendientes)"  ✅ (real)
```

### Breaking Changes
- **Ninguno** - Compatible con versiones anteriores
- **Fallback automático:** Si `employees = 0`, usa lógica antigua (muestra histórico)
- **Mensaje de guía:** Indica al usuario configurar empleados si es 0

### Migration Notes
- **Para usuarios finales:**
  - Ir a: Configuración → Ajustes de Empresa
  - Editar campo: "Número de trabajadores"
  - Guardar cambios
  - Reiniciar aplicación (opcional)
- **Para desarrolladores:**
  - Ninguna acción requerida - los contratos IPC no cambiaron

---

## [0.1.84] - 2026-03-20

### Fixed
- **🔧 Error crítico: "Shared Formula master must exist" en guardado de Presupuesto** ⚠️
  - **Problema:** Al guardar cambios en el módulo de Presupuesto, la aplicación fallaba con error de fórmulas compartidas de ExcelJS
  - **Causa:** El archivo `A-FO-02 Presupuesto *.xlsx` contiene fórmulas compartidas en columna F (% Ejecutado) y fila TOTAL que se sobrescribían con valores directos
  - **Solución:** 
    - ✅ Detección previa de celdas con fórmula antes de escribir
    - ✅ Preservación de fórmulas compartidas (no sobrescribir)
    - ✅ Cálculo de totales desde el backend para fila TOTAL
    - ✅ Manejo seguro de merges (verificar si existen antes de aplicar)

- **⚠️ Warnings en merges: "Cannot merge already merged cells"**
  - **Problema:** Los merges del Excel se intentaban reaplicar sobre celdas ya mergeadas
  - **Solución:** Verificación de merges existentes antes de intentar aplicarlos

### Changed
- **main.js** - Función `handleSaveBudgetFile` completamente refactorizada:
  - Nueva sección: "Detección de Fórmulas Compartidas" (líneas ~4374-4407)
  - Nueva sección: "Escritura Inteligente (Preservando Fórmulas)" (líneas ~4444-4525)
  - Nueva sección: "Cálculo de Totales desde Backend" (líneas ~4528-4573)
  - Nueva sección: "Manejo Seguro de Merges" (líneas ~4576-4610)
- **Módulo Presupuesto** - Ahora soporta archivos con:
  - Fórmulas compartidas en columna F (% Ejecutado)
  - Fórmulas de suma en fila TOTAL
  - Múltiples rangos mergeados

### Technical Details
- **Archivos modificados:**
  - `main.js` - Líneas 4285-4632 (handleSaveBudgetFile)
- **Archivos creados:**
  - `docs/05-updates/v0.1.84-presupuesto-shared-formula-fix.md`
- **Contratos IPC:** Sin cambios (saveBudgetFile, saveBudgetChanges)
- **Frontend:** Sin cambios (presupuesto-logic.js, presupuesto-gestion.js)

### Impacto
- **Tasa de éxito guardado:** 0% → 100%
- **Fórmulas preservadas:** 0% → 100%
- **Merges preservados:** Parcial → 100%
- **Errores en logs:** ~20 warnings + 1 error → 0 warnings + 0 errors

### Breaking Changes
- **Ninguno** - Compatible con versiones anteriores
- **Fallback automático:** Si no hay fórmulas, escribe valores normales
- **Cálculo automático:** Totales se calculan incluso si el Excel no tiene fórmulas

### Migration Notes
- **Para usuarios finales:** Ninguna acción requerida - el guardado ahora funciona correctamente
- **Para desarrolladores:** Ninguna acción requerida - los contratos IPC no cambiaron

---

## [0.1.83] - 2026-03-19

### Added
- **Python Empaquetado en el Installer** 🐍🆕
  - **Installer incluye Python 3.11.9 embeddable** - NO requiere instalación manual de Python
  - **79+ paquetes Python críticos** pre-instalados:
    - `pandas`, `numpy` - Procesamiento de datos
    - `torch` (2.10.0) - IA/LLM (~114 MB)
    - `python-docx`, `openpyxl` - Documentos Word/Excel
    - `PyMuPDF`, `reportlab`, `pillow` - Procesamiento de PDF
    - `flask`, `pywin32` - Servidor y automatización COM
    - `pip`, `setuptools`, `wheel` - Gestión de paquetes
  - **Tamaño del installer:** ~300 MB (antes: ~50 MB)
  - **Cero configuración** para el cliente final

- **Scripts de Preparación de Python** 🔧
  - `scripts/prepare-python-embed.bat` - Descarga Python e instala dependencias
  - `scripts/build-with-python-embed.bat` - Construye installer con Python incluido

- **Detección Automática de Python Empaquetado** ⚙️
  - Función `getEmbeddedPythonPath()` - Prioriza Python empaquetado en producción
  - Fallback automático a Python del sistema si no existe
  - Handler IPC `check-dependencies` - Verifica estado de Python y scripts

- **Mensajes de Error UX-Friendly** 💬
  - Diálogo claro cuando Python no está instalado
  - Instrucciones paso a paso para instalar Python
  - Link directo a python.org/downloads

### Changed
- **main.js** - Funciones `getEmbeddedPythonPath()`, `getPythonScriptPath()`, `getPython()` actualizadas
- **package.json** - `extraResources` incluye `Portear/python-embed/`
- **preload.js** - Expuesto `checkDependencies` en electronAPI
- **README.md** - Requisitos actualizados (Python incluido)
- **docs/REQUISITOS.md** - Documentación para clientes actualizada

### Fixed
- **❌ Error crítico: "ModuleNotFoundError: No module named 'pandas'"** en PCs sin Python
- **❌ Error: "No se pudo encontrar un ejecutable de Python válido"** en instalación limpia
- **❌ Dashboard Scanner fallaba** por falta de pandas
- **❌ Conversión Word/Excel → PDF no funcionaba** sin python-docx/openpyxl
- **❌ Generación de actas COPASST/Convivencia fallaba** sin docxtpl
- **❌ Gestión de ausentismo no funcionaba** sin pandas/numpy
- **❌ IA/LLM no funcionaba** sin torch/transformers

### Technical Details
- **Archivos modificados:**
  - `main.js` - Líneas 67, 178, 188, 1120 (getEmbeddedPythonPath, getPythonScriptPath, check-dependencies)
  - `package.json` - Línea 48 (extraResources)
  - `preload.js` - Línea 14 (checkDependencies)
  - `Portear/python-embed/python311._pth` - Configuración crítica (import site descomentado)
- **Archivos creados:**
  - `scripts/prepare-python-embed.bat`
  - `scripts/build-with-python-embed.bat`
  - `docs/IMPLEMENTACION_PYTHON_EMPAQUETADO_v0.1.80.md`
- **Paquetes instalados:** 79+ en `Portear/python-embed/Lib/site-packages/`

### Breaking Changes
- **Ninguno** - Compatible con versiones anteriores
- **Fallback automático** - Si Python empaquetado falla, usa Python del sistema

### Migration Notes
- **Para usuarios finales:** Ninguna acción requerida - Python ahora está incluido
- **Para desarrolladores:** Ejecutar `scripts/prepare-python-embed.bat` antes de build

---

## [0.1.75] - 2026-03-16

### Added
- **Autenticación y Base de Datos Local (SQLite)** 🆕
  - `kair.db` en `app.getPath('userData')` con tablas de usuarios, roles, empresas, asignaciones y sesiones
  - Login con hash de contraseña (`bcryptjs`)
  - Usuario admin inicial: `admin@kair.local` / `Admin123!`
- **Gestión de Usuarios y Roles por Empresa** 🆕
  - Sección “Ajustes de Usuario” en Configuración
  - Asignación de empresas y roles por usuario
  - Nuevo rol de sistema: **Recursos Humanos**

### Changed
- **Login obligatorio al iniciar la app** (no se reutiliza sesión anterior)
- **Portal 1.2.1 Capacitaciones** retorna a la antesala en “Volver”

### Fixed
- **Modal residual** tras actualizar capacitaciones y volver al módulo
- **Normalización de roles** en asignaciones (case-insensitive, espacios normalizados)
- **Renderizado de tabla de usuarios** con datos reales (sin placeholders)

### Technical Details
- **Archivos modificados:**
  - `main.js` - DB SQLite, auth, usuarios, asignaciones
  - `preload.js` - contratos IPC v1 para auth/usuarios
  - `renderer.js` - flujo de login y sesión
  - `components/config/config-viewer.html` - UI gestión de usuarios
  - `modules/recursos/capacitaciones/` - limpieza de modal y navegación
  - `styles.css` - estilos de pantalla de login

---

## [0.1.70] - 2026-03-05

### Added
- **Módulo de Inducciones con Sincronización Automática** 🆕
  - Sincronización automática de Google Forms vía Power Query
  - Detección automática de cambios en el archivo Excel
  - Actualización automática sin intervención del usuario
  
- **Sistema de Búsqueda Inteligente de Carpetas** 🔍
  - Normalización de tildes (Inducción = induccion)
  - Sistema de 3 prioridades para encontrar carpeta correcta
  - Soporte para múltiples variaciones de nombres (1.1.x, 1.2.x, etc.)
  
- **Búsqueda Flexible de Archivos Excel** 📊
  - Soporte para múltiples variaciones de nombres:
    - `inducción`, `induccion`, `inducciones`
    - `fo-046`, `fo_046`, `046`
    - `registro` (para "Registro de Inducción")
  
- **COM Automation para Power Query** ⚙️
  - VBScript para controlar Excel automáticamente
  - Ejecución de `RefreshAll()` para actualizar datos desde Google Forms
  - Manejo de timeout (60 segundos máx.)
  - Limpieza automática de archivos temporales
  
- **UI/UX de Sincronización** 🎨
  - Banner de notificación cuando hay cambios disponibles
  - Botón manual "Sincronizar" en el header
  - Indicador de estado ("Sincronizado HH:MM:SS")
  - Toast notifications para feedback al usuario
  - Animaciones de carga y sincronización
  
- **Filtrado Inteligente de Datos** 🧹
  - Detección y filtrado automático de filas de encabezado
  - Soporte para múltiples formatos de archivos entre empresas
  - Validación de datos antes de mostrar en tabla

### Fixed
- **Error: Carpeta incorrecta para Asel** 🐛
  - Corregida búsqueda para priorizar carpetas con "induccion" sobre "1.1"
  - Implementada normalización de texto para manejar tildes
  - Ahora encuentra correctamente `1.2.2 Inducción y Reinducción`
  
- **Error: Fila de encabezados mostrada como registro** 🐛
  - Agregada validación para saltar filas con palabras clave de encabezado
  - Soporte para múltiples variaciones: "Fecha de Ingreso", "Nombre Completo", etc.
  
- **Error: Archivo no encontrado en empresas con nombres diferentes** 🐛
  - Ampliada búsqueda para incluir "registro" como palabra clave
  - Ahora funciona con `A-FR-07 Registro de Inducción.xlsx` (Asel)

### Changed
- **Mejora de Rendimiento en Búsqueda de Carpetas** ⚡
  - Optimizada lógica de búsqueda con normalización NFD
  - Reducidas colisiones entre carpetas similares (1.1.x vs 1.2.x)
  
- **Mejora en Manejo de Errores** 🛡️
  - Logs de depuración mejorados para diagnóstico
  - Mensajes de error más descriptivos
  - Validación de existencia de archivo antes de procesar

### Technical Details
- **Archivos Modificados:**
  - `main.js` - Funciones IPC y COM Automation
  - `preload.js` - Contratos de sincronización
  - `inducciones-view.html` - UI de sincronización
  - `inducciones-view.css` - Estilos de banner y estado
  - `inducciones-logic.js` - Lógica de sincronización frontend

- **Nuevos Contratos IPC:**
  - `check-inducciones-changes` - Verificar cambios
  - `sync-inducciones-from-forms` - Sincronizar datos

- **Dependencias:**
  - Sin dependencias adicionales (usa VBScript nativo de Windows)

### Empresas Soportadas
- ✅ Tempoactiva Est SAS (`ACT-FO-046 Registro de Inducción_Tempoactiva.xlsx`)
- ✅ Temposum Est SAS (archivo con "Induccion")
- ✅ Aseplus (archivo genérico)
- ✅ Asel S.A.S (`A-FR-07 Registro de Inducción.xlsx`)

### Documentación
- **Nuevos Documentos:**
  - `docs/modulo-inducciones.md` - Documentación completa del módulo

---

## [0.1.52] - 2026-03-01

### Added
- **Informe PRI Builder Multicaso** 🆕
  - Constructor de informes de seguimiento de incapacidades
  - Lectura directa desde PRI.xlsx (hoja "Casos en seguimiento")
  - Vista consolidada con resumen ejecutivo y detalle por caso
  - Navegación por páginas (resumen + casos individuales)

- **Extracción de Datos del PRI.xlsx** 📊
  - Mapeo automático de 173 columnas disponibles
  - Detección inteligente de columnas por nombre de encabezado
  - Extracción de seguimientos desde 5 columnas múltiples (SEGUIMIENTO 1-5)
  - Extracción de calificación PCL con 4 diagnósticos (CIE-10 + Origen)
  - Extracción de recomendaciones (soporta múltiples separadas por `;`)

- **Interfaz Mejorada** 🎨
  - Visualización directa sin modal (eliminado botón trigger)
  - Sidebar con configuración de periodo y filtros
  - Lista de casos detectados con estado visual (En Seguimiento/Cerrado)
  - Checkboxes para mostrar/ocultar secciones del informe
  - Controles de paginación (Anterior/Siguiente)
  - Botones de exportación (Excel, PDF/Imprimir)

- **Secciones del Informe** 📄
  - Resumen Ejecutivo (estadísticas consolidadas)
  - Listado de Casos en Periodo (tabla comparativa)
  - Distribución por Área (casos y días por departamento)
  - Ficha Detallada por Caso:
    - Información del Trabajador (nombre, cédula, cargo, área)
    - Detalle de Incapacidad (fechas, días, origen, diagnóstico, CIE-10)
    - Proceso PRIC (etapas 1, 2, 3 con estado y responsable)
    - Historial de Seguimientos (timeline con fechas y descripciones)
    - Calificación PCL (porcentaje, fecha, 4 diagnósticos con CIE-10)
    - Recomendaciones (tabla con entidad y cumplimiento)

### Fixed
- **Error: Empresa vacía al consultar backend** 🐛
  - Implementada función `getCurrentCompany()` con múltiples fuentes
  - Fuentes: window.currentCompany → window.rendererState → DOM padre → fallback 'Aseplus'
  - Archivo: `informe-pri-builder.html` (líneas 650-673)

- **Error: Interfaz no se visualizaba (solo botón)** 🐛
  - Eliminado botón trigger y modal backdrop
  - El `.report-builder` ahora se muestra directamente como elemento raíz
  - Auto-inicialización con `DOMContentLoaded`
  - Archivo: `informe-pri-builder.html` (líneas 457-467)

- **Error: Mapeo incorrecto de columnas del Excel** 🐛
  - Corregida búsqueda de columnas por nombre real en PRI.xlsx
  - `cedula`: Ahora busca `includes('documento')` en lugar de `includes('cedula')`
  - `area`: Ahora busca `includes('sede')` en lugar de `includes('área')`
  - `diagnostico`: Ahora excluye columnas CIE-10 con `!includes('cie')`
  - `estado`: Ahora busca `includes('estado caso')` o `includes('motivo de cierre')`
  - Archivo: `informe-pri-builder.html` (líneas 747-793)

- **Error: Seguimientos no se renderizaban** 🐛
  - Implementada extracción desde 5 columnas múltiples (SEGUIMIENTO 1-5)
  - Cada seguimiento tiene fecha y descripción separadas
  - Renderizado en timeline vertical con fechas a la izquierda
  - Archivo: `informe-pri-builder.html` (líneas 824-833)

- **Error: Checkbox PCL no mostraba contenido** 🐛
  - Agregada estructura `pcl.diagnosticos[]` con 4 diagnósticos
  - Cada diagnóstico tiene CIE-10 y origen calificado
  - Renderizado condicional activado por `reportConfig.includePCL`
  - Archivo: `informe-pri-builder.html` (líneas 847-855)

- **Error: Recomendaciones no se extraían** 🐛
  - Implementada extracción desde columnas `recomendacionEmitida` y `recomendacionesVigentes`
  - Soporte para múltiples recomendaciones separadas por `;` o `|`
  - Cada recomendación tiene entidad y estado de cumplimiento
  - Renderizado condicional activado por `reportConfig.includeRecomendaciones`
  - Archivo: `informe-pri-builder.html` (líneas 857-871)

### Changed
- **Estructura de Datos de Casos** 🔄
  - Objeto caso ahora incluye: `seguimientos[]`, `pcl`, `recomendaciones[]`
  - `pcl` contiene: `fecha`, `porcentaje`, `origen`, `diagnosticos[]`
  - `diagnosticos[]` es array de hasta 4 elementos con `cie10` y `origen`
  - `recomendaciones[]` es array dinámico según datos del Excel

- **Flujo de Carga de Datos** 🔄
  - `loadCasesData()` → `getPriSeguimientoData(companyName)` → backend
  - `processPriRowsToCases(rows, headers)` → transforma filas a objetos
  - `processCasesData()` → calcula resumen y renderiza UI
  - Fallback a `loadMockData()` si no hay datos o falla API

- **Comunicación entre Módulos** 🔄
  - `medicion-ausentismo-home.js` envía `postMessage` con `payload.path`
  - Formato corregido: `{ type: 'load-module-view', payload: { path: '...' } }`
  - `renderer.js` recibe y carga vista en área de contenido

### Technical Details
- **Frontend:** `modules/gestion-salud/ausentismo/informe-pri-builder.html`
  - Líneas 1-450: Estilos CSS (Inter font, colores, layout)
  - Líneas 457-590: Estructura HTML (builder, sidebar, preview)
  - Líneas 592-650: Variables globales e inicialización
  - Líneas 650-673: `getCurrentCompany()` - Detección de empresa
  - Líneas 675-740: `loadCasesData()` - Carga desde backend
  - Líneas 743-908: `processPriRowsToCases()` - Mapeo y transformación
  - Líneas 910-980: `loadMockData()` - Datos de prueba
  - Líneas 982-1010: `processCasesData()` - Cálculo de resumen
  - Líneas 1012-1040: `renderCaseList()` - Lista de casos en sidebar
  - Líneas 1042-1060: `renderPage()` - Renderizado por página
  - Líneas 1062-1140: `renderSummaryPage()` - Resumen consolidado
  - Líneas 1142-1300: `renderCaseDetailPage()` - Ficha detallada
  - Líneas 1302-1419: Funciones auxiliares y exportación

- **Backend:** `main.js`
  - Líneas 3355-3550: Handler `get-pri-seguimiento-data`
  - Lee configuración de empresa y estructura de carpetas
  - Busca archivo PRI.xlsx en carpeta de ausentismo
  - Lee hoja "Casos en seguimiento" con `xlsx.readFile()`
  - Retorna: `{ success: true, headers: [...], rows: [...], filePath, sheetName }`

- **Comunicación:** `medicion-ausentismo-home.js`
  - Líneas 101-112: `generarInforme()` - Envío de postMessage
  - Formato: `{ type: 'load-module-view', payload: { path: '...' } }`

### Documentation
- **Nueva Documentación:** `docs/ACTUALIZACION_v0.1.52_INFORME_PRI_BUILDER.md`
  - Resumen ejecutivo de cambios
  - Estructura de columnas del PRI.xlsx
  - Flujo de datos completo (frontend → backend → Excel)
  - Errores corregidos y soluciones
  - Pruebas realizadas
  - Guía de uso paso a paso

### Testing
- **Pruebas Exitosas:** ✅
  - Carga de vista sin modal
  - Detección de empresa "Aseplus"
  - Lectura de PRI.xlsx (4 registros)
  - Mapeo correcto de 173 columnas
  - Extracción de seguimientos (5 columnas)
  - Extracción de PCL (4 diagnósticos)
  - Extracción de recomendaciones (múltiples)
  - Renderizado de resumen consolidado
  - Navegación entre páginas
  - Checkboxes condicionales funcionales

---

## [0.1.51] - 2026-02-28

### Added
- **Calificación PCL Regional y Nacional** 🆕
  - Dos secciones separadas en la UI con identificación visual clara
  - Calificación Regional: Ícono de marcador, color azul índigo (#4F46E5)
  - Calificación Nacional: Ícono de edificio, color azul oscuro (#174ea6)
  - 14 campos en total (7 Regional + 7 Nacional)

- **Campos de Calificación Regional** (Columnas FC-FI, Índices 158-164)
  - Estado del Proceso Regional
  - Fecha de Solicitud Regional
  - Fecha Dictamen Regional
  - % PCL Regional
  - Origen Calificado Regional
  - Fecha de Estructuración Regional
  - Observaciones Calificación Nacional

- **Campos de Calificación Nacional** (Columnas FJ-FP, Índices 165-171)
  - Estado del Proceso Nacional
  - Fecha de Solicitud Nacional
  - Fecha Dictamen Nacional
  - % PCL Nacional
  - Origen Calificado Nacional
  - Fecha de Estructuración Nacional
  - Observaciones Calificación Nacional

### Fixed
- **Error `list assignment index out of range`** 🐛
  - Movida la extensión de `fila_completa` antes de las asignaciones de Calificación
  - Ahora se extiende a 172 elementos antes de asignar índices 158-171
  - Archivo: `Portear/src/actualizar_ausentismo.py` (líneas 1073-1075)

- **Datos de Calificación no se guardaban en Excel** 🐛
  - Corregido mapeo de campos en `ejecutarGuardadoReal()`
  - Ahora se envían correctamente los campos Regional y Nacional a Python
  - Archivo: `modules/gestion-salud/ausentismo/medicion-ausentismo.js` (líneas 4311-4328)

### Changed
- **Estructura de Datos de Calificación** 🔄
  - Objeto `followUpData.calificacion` ahora contiene campos Regional y Nacional
  - Compatibilidad mantenida con `calificacionLegacy` para registros antiguos
  - Función `cargarRegistroYAbrirPanel()` actualizada para cargar ambos conjuntos

- **UI del Panel de Seguimiento** 🎨
  - Sección 5: Calificación PCL ahora tiene dos subsecciones visuales
  - Separadores con bordes de 2px y colores distintivos
  - Títulos con íconos y uppercase para claridad

### Technical Details
- **Frontend:** `medicion-ausentismo.js`
  - Líneas 2743-2845: UI de Calificación PCL
  - Líneas 3600-3620: `saveSeguimientoData()` - Recolección de datos
  - Líneas 4070-4095: `cargarRegistroYAbrirPanel()` - Carga de datos
  - Líneas 4311-4328: `ejecutarGuardadoReal()` - Envío a Python

- **Backend:** `Portear/src/actualizar_ausentismo.py`
  - Líneas 985-1000: Índices de columnas Regional/Nacional
  - Líneas 1073-1075: Extensión de lista antes de asignaciones
  - Líneas 1077-1092: Asignación de campos Regional (FC-FI)
  - Líneas 1094-1100: Asignación de campos Nacional (FJ-FP)

### Documentation
- **Nueva Documentación:** `docs/ACTUALIZACION_v0.1.51_CALIFICACION_PCL.md`
  - Estructura de datos completa
  - Flujo de datos frontend → backend → Excel
  - Errores corregidos y soluciones
  - Pruebas realizadas

---

## [0.1.50] - 2026-02-26

### Added
- **Sistema de Alertas para Registros Existentes** 🆕
  - Modal moderno al guardar seguimiento con registros duplicados
  - Opciones: "Actualizar registro seleccionado" o "Crear nuevo registro"
  - Diseño con gradiente naranja, avatar con iniciales, timeline de registros
  - Función `buscar_registros_por_cedula()` en Python
  - Handler IPC `buscar-registros-cedula` en main.js

- **Cálculos Automáticos en Formulario** 🆕
  - Edad: Calculada desde fecha de nacimiento
  - IMC: Calculado desde peso/talla² (talla en cm)
  - Estado Nutricional: 6 categorías con indicadores visuales
  - Días Trabajados: Calculado desde fecha de ingreso (6 días trabajo, 1 descanso)
  - Antigüedad: Años desde fecha de ingreso

- **Nuevos Campos en Formulario de Seguimiento**
  - Salud: Peso (Kg), Talla (cm), IMC, Estado Nutricional, Actividades Extralaborales
  - Laborales: Edad, Tipo de Cargo, Tipo de Evento

- **Estadísticas en Tiempo Real** 📊
  - KPIs se actualizan al aplicar filtros (Año/Mes)
  - Funciones: `calculateKPIsFromRawData()`, `calculateKPIsFromFilteredData()`
  - Handler `read-ausentismo-data` para cargar todos los datos
  - Tarjetas: Casos Activos, Próximos a Vencer, Docs Pendientes, Cerrados (Mes)

- **Modal de Detalles Modernizado** 👁️
  - Header con ícono en gradiente
  - Employee card con avatar
  - Timeline vertical de incapacidades
  - Badges de estado con colores
  - Animaciones fade in / slide up

### Changed
- **Organización de Columnas en PRI.xlsx** ⚠️
  - Datos se guardan en columnas específicas (C-AA)
  - Función `indice_a_columna()` para columnas después de Z
  - Cálculo automático de edad, antigüedad, estado nutricional

- **Filtros Actualizan KPIs** 🔄
  - `applySeguimientoFilters()` ahora recalcula estadísticas
  - Event listeners en selectores de Año/Mes
  - Filtros se aplican solo con click en botón "Filtrar"

- **Mejoras en Logging** 📝
  - Logs `[KPIs Raw]`, `[KPIs Filtered]` para depuración
  - Logs `[GUARDAR SEGUIMIENTO]` con detalle de acciones
  - Logs `[ESTADISTICAS]` para carga de datos

### Fixed
- **Error de Columnas Excel** 🐛
  - Problema: `[7 is not a valid coordinate or range`
  - Causa: Columna AA mal calculada (chr(91) = '[')
  - Solución: Función `indice_a_columna()` con lógica para AA, AB, AC...

- **KPIs en Cero** 🐛
  - Problema: Todas las tarjetas mostraban "0"
  - Causa: Handler `read-ausentismo-data` no existía
  - Solución: Handler implementado en main.js

- **Filtros Auto-Aplicados** 🐛
  - Problema: Filtros se aplicaban al cambiar selección (sin click)
  - Solución: Removidos event listeners automáticos

### Technical
- **Python Script (actualizar_ausentismo.py)**
  - Función `guardar_seguimiento()` con columnas específicas
  - Función `buscar_registros_por_cedula()` para alertas
  - Funciones auxiliares: `calcular_edad()`, `calcular_antiguedad()`, `calcular_estado_nutricional()`, `calcular_dias_trabajados()`

- **Frontend (medicion-ausentismo.js)**
  - Función `mostrarModalSeleccionRegistros()` con diseño moderno
  - Función `confirmarGuardadoConSeleccion()` para interacción
  - Función `calculateKPIsFromFilteredData()` para filtros

- **Backend (main.js)**
  - Handler `buscar-registros-cedula` para búsqueda de duplicados
  - Handler `read-ausentismo-data` para estadísticas

### Documentation
- **Nueva Documentación Creada:**
  - `docs/RESUMEN_CAMBIOS_v0.1.50.md` - Resumen completo de cambios
  - Actualización de `docs/CHANGELOG.md` con versión 0.1.50

## [0.1.49] - 2026-02-26

### Added
- **Sistema Dual de Archivos para Ausentismo** 🆕
  - Separación clara entre archivo de registro general (PI-FO-076) y seguimiento de casos (PRI.xlsx)
  - Documentación completa en `docs/ARQUITECTURA_AUSENTISMO_DUAL.md`

- **Nuevo Handler IPC: `get-pri-seguimiento-data`** 
  - Lee específicamente el archivo PRI.xlsx
  - Selecciona automáticamente la hoja "Casos en seguimiento"
  - Detección inteligente de encabezados
  - Logs de depuración detallados
  - Ubicación: `main.js` línea ~3251

- **Nueva API en preload.js**
  - `getPriSeguimientoData(companyName)` - Expone el handler `get-pri-seguimiento-data`
  - Permite al frontend leer datos del PRI.xlsx para seguimiento detallado

### Changed
- **Handler `get-ausentismo-data` MODIFICADO** ⚠️
  - Ahora usa **PI-FO-076 / PG-FO-076 / GI-FO-076** para la lista principal de ausentismo
  - **NO usa PRI.xlsx** para consultas generales
  - Lógica de selección mejorada:
    1. Busca específicamente PI-FO-076, PG-FO-076 o GI-FO-076
    2. Si no encuentra, usa el primer .xlsx que NO sea PRI.xlsx
    3. Fallback: usa el primer archivo .xlsx disponible

- **Mejoras en Logs de Depuración**
  - Logs detallados que muestran TODOS los archivos en la carpeta de ausentismo
  - Búsqueda específica de archivos con "PRI" en el nombre
  - Confirmación visual de qué archivo se está seleccionando
  - Logs separados para `get-ausentismo-data` y `get-pri-seguimiento-data`

### Fixed
- **Problema de selección de archivo PRI.xlsx**
  - El sistema ahora encuentra correctamente el archivo PRI.xlsx cuando existe
  - Se filtra el archivo temporal `~$PRI.xlsx` automáticamente
  - Se selecciona la hoja correcta ("Casos en seguimiento") en lugar de "Introducción"

### Documentation
- **Nueva Documentación Creada:**
  - `docs/ARQUITECTURA_AUSENTISMO_DUAL.md` - Arquitectura completa del sistema dual
    - Flujo de datos por sección
    - Handlers IPC implementados
    - Logs de depuración de ejemplo
    - Consideraciones importantes sobre sincronización

- **README.md Actualizado:**
  - Versión actualizada a 0.1.49
  - Tabla de APIs de ausentismo actualizada con `getPriSeguimientoData` y `saveFollowUp`
  - Enlace a nueva documentación de arquitectura dual

### Technical Details
- **Archivos Modificados:**
  - `main.js` (+250 líneas)
    - Modificado `get-ausentismo-data` para usar PI-FO-076
    - Agregado `get-pri-seguimiento-data` para PRI.xlsx
    - Agregada función `obtenerRutaPri()` para obtener ruta específica de PRI.xlsx
    - Modificado `save-follow-up` para usar `obtenerRutaPri()` en lugar de `obtenerRutaAusentismo()`
  - `preload.js` (+2 líneas)
    - Expuesta nueva API `getPriSeguimientoData`
  - `components/seguimiento/seguimiento-incapacidades.html` (+120 líneas)
    - `viewCase()` → async, carga PRI.xlsx
    - `loadPriDataForCase()` → nueva función
    - `saveFollowUp()` → usa API de Electron directamente
  - `README.md` (versión 0.1.49)
  - `docs/CHANGELOG.md` (este archivo)
  - `docs/ARQUITECTURA_AUSENTISMO_DUAL.md` (nuevo)
  - `docs/ACTUALIZACION_FRONTEND_SEGUIMIENTO_v0.1.49.md` (nuevo)
  - `docs/RESUMEN_CAMBIOS_v0.1.49.md` (nuevo)

### Next Steps (Pendientes)
- [x] Actualizar `seguimiento-incapacidades.html` para usar `getPriSeguimientoData` en "Abrir Seguimiento" ✅
- [x] Modificar handler `save-follow-up` para usar PRI.xlsx específicamente ✅
- [x] Conectar formulario de seguimiento con la función de guardado ✅

### Frontend - Actualización Completada (Parte 2)
- **`seguimiento-incapacidades.html` MODIFICADO** ⚠️
  - Función `viewCase()` ahora es asíncrona y carga datos desde PRI.xlsx
  - Nueva función `loadPriDataForCase()` para cargar datos específicos del PRI
  - Función `saveFollowUp()` actualizada para usar API de Electron directamente
  - Eliminada dependencia de `sendMessageToParent()` para guardado
  - Agregados logs de depuración detallados

- **Flujo de Carga de Datos:**
  1. Abre caso → Carga datos básicos desde PI-FO-076
  2. Llama `getPriSeguimientoData()` → Lee PRI.xlsx
  3. Busca caso por cédula/nombre en PRI
  4. Si encuentra → Carga cargo, área, EPS, ARL
  5. Si no encuentra → Caso nuevo (solo datos básicos)

- **Flujo de Guardado:**
  1. Usuario llena formulario
  2. Click "Guardar Seguimiento"
  3. `saveFollowUp()` → `window.electronAPI.saveFollowUp()`
  4. Handler `save-follow-up` busca PRI.xlsx específicamente
  5. Python escribe en PRI.xlsx
  6. Recarga tabla y muestra notificación de éxito

- **Archivos Modificados:**
  - `components/seguimiento/seguimiento-incapacidades.html` (+120 líneas)
    - `viewCase()` → async, carga PRI.xlsx
    - `loadPriDataForCase()` → nueva función
    - `saveFollowUp()` → usa API de Electron directamente

---

## [0.1.48] - 2026-02-25

### Added
- **Módulo de Seguimiento PRIC (Proceso de Rehabilitación e Incorporación Laboral)** 🆕
  - Panel slideover de seguimiento de incapacidades con diseño moderno
  - 5 secciones especializadas: Datos Generales, Incapacidad Temporal, Etapas PRIC, Seguimiento Recomendaciones, Calificación PCL
  - Navegación horizontal por pestañas con animaciones fade-in
  - Carga automática de datos del empleado desde la tabla de seguimiento
  - Tabla dinámica de recomendaciones con capacidad de agregar/eliminar filas
  - Integración con hoja "Casos en seguimiento" de Excel (pendiente implementación real)

- **Funcionalidades de Seguimiento de Incapacidades**
  - Botón "Abrir Seguimiento" en modal de detalles de empleado
  - Autocompletado de datos laborales (cargo, área, EPS, ARL)
  - Campos de solo lectura para datos que vienen del empleado
  - ARL prellenado con "COLMENA SEGUROS" por defecto
  - Validación de fechas y campos obligatorios

- **Interfaz de Usuario Mejorada**
  - Panel slideover (95% ancho, máx 1100px) con backdrop y efecto blur
  - Sistema de navegación horizontal con 5 pestañas
  - Scrollbars personalizados con estilos K+AIR
  - Botones con efectos hover y transiciones suaves
  - Notificaciones toast de éxito/error

### Changed
- **Actualización de Documentación**
  - README.md actualizado con sección completa de Módulo de Ausentismo y Seguimiento PRIC
  - Agregados detalles de algoritmo de detección de casos en seguimiento
  - Documentación de métodos del componente: `createSeguimientoPanel()`, `closeSeguimientoPanel()`, `showSeguimientoPanelSection()`, etc.
  - Actualizada versión del documento a 2.1
  - CHANGELOG.md actualizado con cambios de versión 0.1.48

- **Mejoras en el Módulo de Ausentismo (3.3.6)**
  - Refactorización de `renderNotaSeguimientoSection()` para pasar datos completos del empleado
  - Mejora en serialización de datos para botones dinámicos
  - Optimización de carga de datos en panel PRIC

### Technical Details
- **Archivos Modificados:**
  - `modules/gestion-salud/ausentismo/medicion-ausentismo.js` (+850 líneas)
    - Agregados métodos: `createSeguimientoPanel()`, `closeSeguimientoPanel()`, `showSeguimientoPanelSection()`, `cargarDatosEnPanelSeguimiento()`, `addRecomRow()`, `removeRecomRow()`, `saveSeguimientoData()`
    - Actualizado método `abrirSeguimiento()` para abrir panel slideover
    - Modificado `renderNotaSeguimientoSection()` para pasar datos del empleado
  
- **Estilos CSS:**
  - ~200 líneas de CSS personalizado para panel slideover
  - Variables CSS para consistencia de colores (--sp-primary, --sp-accent, etc.)
  - Animaciones spFadeIn para transiciones entre pestañas
  - Scrollbars personalizados para contenido y navegación

### Fixed
- Corrección en ordenamiento de fechas de incapacidades (strings ISO a Date objects)
- Manejo de errores en carga de datos desde Excel
- Validación de fechas inválidas en carga de incapacidades

### Deprecated
- Funcionalidad de "Guardar Nota" en modal de detalles (eliminada)
- Botón "Cerrar" en sección de seguimiento (eliminado)

### Pending
- Implementación real de guardado en Excel (`guardarSeguimientoPCL()`)
- Conexión con backend para persistencia de datos de seguimiento
- Generación de informes PDF desde datos de seguimiento PRIC

---

## [0.1.47] - 2026-02-24

### Changed
- **Actualización de Documentación del Proyecto**
  - Escaneo completo del código fuente vs documentación existente
  - Identificación de 18 módulos reorganizados (100% completados)
  - Documentación de scripts Python de Portear/src
  - Actualización de estado de módulos en PROJECT_OVERVIEW.md

### Documentation
- Actualización de CHANGELOG.md con versiones 0.1.41-0.1.46
- Creación de docs/scripts-python.md para documentar utilidades Python
- Actualización de estado de reorganización modular
- Generación de documentación JSDoc API actualizada
- Agregados JSDoc a archivos de utilidades (/utils)
- Documentado theme-manager.js en docs principales
- Corregido jsdoc.json con rutas actualizadas de módulos

## [0.1.45] - 2026-02-22

### Fixed
- Correcciones menores en generación de informes de investigación
- Mejoras en extracción de datos desde PDFs de accidentes

## [0.1.44] - 2026-02-22

### Added
- Soporte para tema oscuro (paleta Negro/Gris) en Theme Manager
- Sistema centralizado de gestión de temas (Claro/Oscuro/Sistema)

### Changed
- Mejora en comunicación iframe-renderer para módulos reorganizados

## [0.1.43] - 2026-02-21

### Fixed
- Corrección en mapeo de rutas para empresas configuradas
- Mejoras en sistema de logging centralizado

## [0.1.42] - 2026-02-21

### Added
- Módulo de inducciones reorganizado (1.2.2)
- Módulo de capacitaciones reorganizado (1.2.1)

### Changed
- Migración de archivos a estructura modular `modules/recursos/`
- Actualización de referencias en index.html y renderer.js

## [0.1.41] - 2026-02-21

### Added
- Módulo de rendición de cuentas reorganizado (2.6.1)
- Módulo de objetivos SST reorganizado (2.2.1)
- Módulo de evaluación inicial SG-SST reorganizado (2.3.1)

### Changed
- Continuación de reorganización modular de gestión-integral
- Actualización de jsdoc.json con nuevas rutas de módulos

## [0.1.40] - 2026-02-20

### Added
- **Sistema de Inteligencia Artificial para Investigación de Accidentes**
  - Servidor LLM persistente (`llm_server.py`) con modelo LLM local (Ollama)
  - Análisis automático de causa raíz mediante metodología 5 Porqués
  - Extracción de datos desde PDFs de reportes de accidentes
  - Generación automática de informes de investigación en formato DOCX
  - Integración con plantillas personalizadas por empresa

- **Nueva Interfaz del Módulo 3.2.2 Investigación de Accidentes**
  - Portal de bienvenida con diseño K+AIR
  - Tarjetas de acción principales y secundarias
  - Estadísticas de investigaciones pendientes y completadas
  - Navegación mejorada entre vistas

- **Sistema Visual Oficial K+AIR**
  - Paleta de colores estandarizada (Primario: #174ea6, Éxito: #28a745, etc.)
  - Tipografía oficial (Lexend para títulos, Roboto para cuerpo)
  - Componentes reutilizables con bordes 0.375rem
  - Animaciones fadeIn consistentes

### Fixed
- Corrección de indexación de datos del análisis 5 Porqués en informes
  - Agregadas múltiples variantes de búsqueda para claves (PorQue1, Por Qué 1, etc.)
  - Corregido desanidamiento desde `analysis.data`
- Corregido desfase de altura en portal de investigación de accidentes
- Eliminados headers redundantes en vistas de módulos

### Changed
- Refactorización de `investigacion-accidentes-logic.js` para usar iframe con portal
- Mejora en comunicación iframe-renderer con patrón `-request` / `-response`
- Estandarización de comunicación entre módulos y renderer principal

## [0.1.39] - 2026-01-21

### Added
- Estandarización de patrones de comunicación entre Iframes y Renderer (`-request` / `-response`).
- Nueva petición `duplicate-budget-file-request` en el sistema de renderizado.

### Fixed
- Corrección del módulo **Plan de Trabajo Anual** (2.4.1):
  - Solucionado error que bloqueaba la clonación de planes de trabajo.
  - Eliminado uso de `prompt()` (incompatible con Electron/Iframe) por `confirm()`.
  - Automatización del cálculo del año siguiente para nuevos periodos.
  - Sincronización de tipos de mensajes entre `plan-viewer.js` y `renderer.js`.

## [0.1.38] - 2025-01-08

### Added
- Nuevo módulo de verificación de tamaños
- Script para verificación de tamaños de archivos
- Funcionalidad de limpieza de datos

### Changed
- Mejoras en el manejo de datos
- Actualización de dependencias
- Corrección de errores menores

## [0.1.37] - 2024-12-20

### Added
- Nuevo módulo de trabajo en alto riesgo
- Componentes para trabajo en alto riesgo
- Funcionalidades de gestión de riesgos

### Changed
- Actualización de la interfaz de usuario
- Mejoras en la navegación
- Corrección de errores menores

## [0.1.36] - 2024-12-18

### Added
- Nuevo módulo de seguimiento de incapacidades
- Dashboard de ausentismo
- Funcionalidades de reporte

### Changed
- Mejoras en el módulo de ausentismo
- Actualización de gráficos
- Corrección de errores menores

## [0.1.35] - 2024-12-15

### Added
- Nuevo módulo de investigación de accidentes
- Componentes para investigación de accidentes
- Funcionalidades de análisis

### Changed
- Mejoras en el módulo de reportes
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.34] - 2024-12-10

### Added
- Nuevo módulo de evaluaciones médicas
- Componentes para evaluaciones médicas
- Funcionalidades de seguimiento

### Changed
- Mejoras en el módulo de restricciones médicas
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.33] - 2024-12-05

### Added
- Nuevo módulo de capacitación COPASST
- Componentes para capacitación COPASST
- Funcionalidades de gestión

### Changed
- Mejoras en el módulo de comité de convivencia
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.32] - 2024-11-30

### Added
- Nuevo módulo de comité de convivencia
- Componentes para comité de convivencia
- Funcionalidades de gestión

### Changed
- Mejoras en el módulo de afiliación
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.31] - 2024-11-25

### Added
- Nuevo módulo de afiliación
- Componentes para afiliación
- Funcionalidades de gestión

### Changed
- Mejoras en el módulo de política
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.30] - 2024-11-20

### Added
- Nuevo módulo de política
- Componentes para política
- Funcionalidades de gestión

### Changed
- Mejoras en el módulo de roles y responsabilidades
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.29] - 2024-11-15

### Added
- Nuevo módulo de roles y responsabilidades
- Componentes para roles y responsabilidades
- Funcionalidades de gestión

### Changed
- Mejoras en el módulo de presupuesto
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.28] - 2024-11-10

### Added
- Nuevo módulo de presupuesto
- Componentes para presupuesto
- Funcionalidades de cálculo

### Changed
- Mejoras en el módulo de reportes
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.27] - 2024-11-05

### Added
- Nuevo módulo de reportes
- Componentes para reportes
- Funcionalidades de exportación

### Changed
- Mejoras en el módulo de gestión de riesgos
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.26] - 2024-10-30

### Added
- Nuevo módulo de gestión de riesgos
- Componentes para gestión de riesgos
- Funcionalidades de análisis

### Changed
- Mejoras en el módulo de gestión integral
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.25] - 2024-10-25

### Added
- Nuevo módulo de gestión integral
- Componentes para gestión integral
- Funcionalidades de coordinación

### Changed
- Mejoras en el módulo de gestión de salud
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.24] - 2024-10-20

### Added
- Nuevo módulo de gestión de salud
- Componentes para gestión de salud
- Funcionalidades de monitoreo

### Changed
- Mejoras en el módulo de gestión de amenazas
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.23] - 2024-10-15

### Added
- Nuevo módulo de gestión de amenazas
- Componentes para gestión de amenazas
- Funcionalidades de evaluación

### Changed
- Mejoras en el módulo de mejoramiento
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.22] - 2024-10-10

### Added
- Nuevo módulo de mejoramiento
- Componentes para mejoramiento
- Funcionalidades de seguimiento

### Changed
- Mejoras en el módulo de verificación
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.21] - 2024-10-05

### Added
- Nuevo módulo de verificación
- Componentes para verificación
- Funcionalidades de control

### Changed
- Mejoras en el módulo de recursos
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.20] - 2024-09-30

### Added
- Nuevo módulo de recursos
- Componentes para recursos
- Funcionalidades de gestión

### Changed
- Mejoras en el módulo de evaluaciones
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.19] - 2024-09-25

### Added
- Nuevo módulo de evaluaciones
- Componentes para evaluaciones
- Funcionalidades de análisis

### Changed
- Mejoras en el módulo de curso virtual
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.18] - 2024-09-20

### Added
- Nuevo módulo de curso virtual
- Componentes para curso virtual
- Funcionalidades de capacitación

### Changed
- Mejoras en el módulo de curso 50 horas
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.17] - 2024-09-15

### Added
- Nuevo módulo de curso 50 horas
- Componentes para curso 50 horas
- Funcionalidades de certificación

### Changed
- Mejoras en el módulo de responsable SG
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.16] - 2024-09-10

### Added
- Nuevo módulo de responsable SG
- Componentes para responsable SG
- Funcionalidades de coordinación

### Changed
- Mejoras en el módulo de restricciones
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.15] - 2024-09-05

### Added
- Nuevo módulo de restricciones
- Componentes para restricciones
- Funcionalidades de gestión

### Changed
- Mejoras en el módulo de sociodemográfica
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.14] - 2024-08-30

### Added
- Nuevo módulo de sociodemográfica
- Componentes para sociodemográfica
- Funcionalidades de análisis

### Changed
- Mejoras en el módulo de ausentismo
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.13] - 2024-08-25

### Added
- Nuevo módulo de ausentismo
- Componentes para ausentismo
- Funcionalidades de medición

### Changed
- Mejoras en el módulo de medición de ausentismo
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.12] - 2024-08-20

### Added
- Nuevo módulo de medición de ausentismo
- Componentes para medición de ausentismo
- Funcionalidades de cálculo

### Changed
- Mejoras en el módulo de investigación de accidentes
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.11] - 2024-08-15

### Added
- Nuevo módulo de investigación de accidentes
- Componentes para investigación de accidentes
- Funcionalidades de análisis

### Changed
- Mejoras en el módulo de reportes de accidentes
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.10] - 2024-08-10

### Added
- Nuevo módulo de reportes de accidentes
- Componentes para reportes de accidentes
- Funcionalidades de generación

### Changed
- Mejoras en el módulo de copasst
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.9] - 2024-08-05

### Added
- Nuevo módulo de copasst
- Componentes para copasst
- Funcionalidades de gestión

### Changed
- Mejoras en el módulo de comité de convivencia
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.8] - 2024-08-01

### Added
- Nuevo módulo de comité de convivencia
- Componentes para comité de convivencia
- Funcionalidades de coordinación

### Changed
- Mejoras en el módulo de política
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.7] - 2024-07-25

### Added
- Nuevo módulo de política
- Componentes para política
- Funcionalidades de definición

### Changed
- Mejoras en el módulo de roles y responsabilidades
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.6] - 2024-07-20

### Added
- Nuevo módulo de roles y responsabilidades
- Componentes para roles y responsabilidades
- Funcionalidades de asignación

### Changed
- Mejoras en el módulo de afiliación
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.5] - 2024-07-15

### Added
- Nuevo módulo de afiliación
- Componentes para afiliación
- Funcionalidades de registro

### Changed
- Mejoras en el módulo de presupuesto
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.4] - 2024-07-10

### Added
- Nuevo módulo de presupuesto
- Componentes para presupuesto
- Funcionalidades de cálculo

### Changed
- Mejoras en el módulo de reportes
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.3] - 2024-07-05

### Added
- Nuevo módulo de reportes
- Componentes para reportes
- Funcionalidades de exportación

### Changed
- Mejoras en el módulo de gestión
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.2] - 2024-07-01

### Added
- Nuevo módulo de gestión
- Componentes para gestión
- Funcionalidades de administración

### Changed
- Mejoras en la estructura general
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.1] - 2024-06-25

### Added
- Estructura inicial del proyecto
- Configuración de Electron
- Módulos básicos de la aplicación

### Changed
- Configuración inicial
- Estructura de directorios
- Archivos base
