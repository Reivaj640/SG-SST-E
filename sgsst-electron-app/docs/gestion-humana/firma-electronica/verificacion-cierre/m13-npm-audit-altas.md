# M.13 - Las dos vulnerabilidades ALIAS de `npm audit` (nodemailer + zod)

**Estado: CERRADO.** Las dos altas del audit quedaron en **0**.
Criterio de aceptacion: la suite completa del servicio, verde.

- Servicio: `sgsst-electron-app/firma-service`
- Fecha: 12-nov-2026
- Rama: `Dev`
- Node de la medicion: **v22.23.4 (ABI 127)** - el `better-sqlite3` del repo
  esta compilado para ABI 127; con el Node del sistema (v26, ABI 147) el modulo
  no carga y produce un **rojo falso** que no es de este trabajo.

---

## 1. La superficie medida ANTES de tocar nada

### 1.1 El audit de partida

`npm audit --omit=dev` en `firma-service` (12-nov-2026, antes de los cambios):

```
# npm audit report

nodemailer  <=10.1.3
Severity: high
Nodemailer: Email to an unintended domain can occur due to Interpretation Conflict - https://github.com/advisories/GHSA-mm7p-fcc7-pg87
Nodemailer has SMTP command injection due to unsanitized `envelope.size` parameter - https://github.com/advisories/GHSA-c7w3-x93f-qmm8
Nodemailer Vulnerable to SMTP Command Injection via CRLF in Transport name Option (EHLO/HELO)  - https://github.com/advisories/GHSA-vvjj-xcjg-gr5g
Nodemailer: CRLF injection in Nodemailer List-* header comments allows arbitrary message header injection - https://github.com/advisories/GHSA-268h-hp4c-crq3
Nodemailer jsonTransport bypasses disableFileAccess and disableUrlAccess during message normalization - https://github.com/advisories/GHSA-wqvq-jvpq-h66f
Nodemailer's addressparser is vulnerable to DoS caused by recursive calls - https://github.com/advisories/GHSA-rcmh-qjqh-p98v
Nodemailer: Message-level raw option bypasses disableFileAccess/disableUrlAccess, enabling arbitrary file read and full-response SSRF in the delivered message - https://github.com/advisories/GHSA-p6gq-j5cr-w38f
Nodemailer: resolveContent() on a MailMessage bypasses disableFileAccess/disableUrlAccess when called with the legacy signature - https://github.com/advisories/GHSA-8m3c-c648-2xjj
Nodemailer: IDN/Punycode domain allow-list bypass leads to email delivery to an attacker-controlled domain - https://github.com/advisories/GHSA-wmmp-3585-3rmp
Nodemailer: Quadratic (O(n²)) time complexity in addressparser allows remote denial of service via a crafted address list - https://github.com/advisories/GHSA-2x7j-588g-ccc2
Nodemailer: Recipient-domain validation bypass via RFC 5322 comment mis-parsing leads to email delivery to an attacker-controlled domain - https://github.com/advisories/GHSA-cc9r-2j5m-2m83
Nodemailer: Process-global DNS cache reuses TLS `servername` across transports, enabling cross-tenant SMTP credential disclosure - https://github.com/advisories/GHSA-6vj9-mwq6-2f5v
Nodemailer: Nested structured recipient arrays bypass the parser depth limit and cause stack exhaustion DoS - https://github.com/advisories/GHSA-8vvx-rff5-p5rq
Nodemailer: Quadratic backtracking in the addressparser free-text fallback allows remote denial of service - https://github.com/advisories/GHSA-v53p-9fqp-m79j
Nodemailer: Improper TLS Certificate Validation in OAuth2 Token Fetch Enables Credential Interception - https://github.com/advisories/GHSA-r7g4-qg5f-qqm2
Nodemailer: Quadratic (O(n^2)) DKIM header unfolding lets a large folded header cause remote denial of service during signing - https://github.com/advisories/GHSA-39m8-27wv-hr27
Nodemailer: A nested comment ends early in addressparser, releasing the rest of the comment as a recipient - https://github.com/advisories/GHSA-8c8m-p3m8-cjg8
Nodemailer: A ";" inside a quoted string or comment ends an address group early in addressparser, turning display text into a recipient - https://github.com/advisories/GHSA-m943-m63m-w62w
Nodemailer: A ">" inside a quoted local part ends an angle-addr early in addressparser, delivering to a domain the header does not name - https://github.com/advisories/GHSA-85x2-q946-cp5h
Nodemailer: Quadratic backtracking in SMTP AUTH mechanism detection regexes allows pre-auth remote denial of service - https://github.com/advisories/GHSA-4ffr-jq9g-5ffx
Nodemailer: RFC 5322 comment inside an angle-bracket address is never stripped - https://github.com/advisories/GHSA-g73g-hqqh-jr95
Nodemailer: Quadratic (O(n^2)) SMTP client reply parsing lets a malicious server or MITM cause a pre-auth remote denial of service - https://github.com/advisories/GHSA-4g23-2xm8-66gc
fix available via `npm audit fix --force`
Will install nodemailer@10.5.0, which is a breaking change
node_modules/nodemailer

zod  <4.6.6
Severity: high
Zod can exhaust memory while validating oversized constrained collections - https://github.com/advisories/GHSA-mrhx-c7xc-m3w5
fix available via `npm audit fix --force`
Will install zod@4.6.7, which is a breaking change
node_modules/zod

2 high severity vulnerabilities

To address all issues (including breaking changes), run:
  npm audit fix --force
```

### 1.2 La superficie de zod en `src/`

Medida con un recorrido de todos los `.js` de `src/`:

| Metrica | Cantidad |
|---|---|
| Archivos de `src/` que usan zod | **33** |
| Archivos que usan zod **directamente** (`require('zod')`) | **14** |
| `z.string()` | 108 |
| `z.object()` | 54 |
| `z.boolean()` | 17 |
| `z.enum()` | 14 |
| `z.literal()` | 10 |
| `z.union()` | 7 |
| `z.coerce` | 6 |
| `z.array()` | 5 |
| `z.record()` | 2 |
| `.max()` | 145 |
| `.min()` | 92 |
| `.optional()` | 76 |
| `.parse()` | 43 |
| `.strict()` | 33 |
| `.transform()` | 28 |
| `.regex()` | 17 |
| `.email()` | 15 |
| `.refine()` | 11 |
| `.default()` | 10 |
| `.safeParse()` | 9 |
| `.catch()` | 5 |
| `.datetime()` | 4 |
| `.nullish()` | 21 |
| `.nullable()` | 3 |
| `.int()` | 4 |
| `.url()` | 0 en `src/` (el conteo de 3 del barrido era de `politica_datos_url`, no del metodo de zod) |

Archivos con mas uso: `src/schemas/index.js` (222 usos aprox.),
`src/schemas/admin-empresas.js` (127), `src/routes/public.js` (62),
`src/schemas/admin-clientes.js` (52), `src/routes/anexoEncargo.js` (35).

### 1.3 La superficie de nodemailer

Cuatro archivos lo tocan:

| Archivo | Uso |
|---|---|
| `src/services/mailer.js` | El principal: `createTransport` (SMTP en produccion, `jsonTransport` en dev) y 9 llamadas a `transporter.sendMail({from,to,subject,text,attachments})`. Incluye `sendOTP` (el envio del OTP), `sendInvite`, `sendCopiaAviso`, `sendCopiaFirmadoPapel`, el aviso de incidentes y el aviso de firma. |
| `src/services/cuentaEnvio.js` | `createTransport` con la cuenta de la Empresa (host/puerto/secure/auth desde la BD cifrada). |
| `src/routes/signRequest.js` | Comentario y el endpoint `notify-remote` que dispara el envio. |
| `src/utils/logger.js` | Solo un comentario (sanitiza `error.message` de librerias externas). |

La API de nodemailer que el repo usa es **chica y estable**:
`createTransport`, `sendMail`, `info.messageId`, `info.envelope`, `info.message`,
`jsonTransport`, `requireTLS`, `auth`, `attachments[]` con `filename` + `path`.

### 1.4 Las incompatibilidades reales (medidas, no supuestas)

Se midio el comportamiento de zod 3.25.76 contra zod 4.6.7 con la misma
libreria instalada en un directorio aparte (`%TEMP%\kair-m13-probe`), sin tocar
el repo. Lo que **SI** cambia:

| API | Que dice zod 3 | Que dice zod 4 | Impacto en el repo |
|---|---|---|---|
| `invalid_type_error` | se respeta | **se ignora en silencio** | Perdia el mensaje (2 sitios) |
| `required_error` | se respeta | **se ignora en silencio** | Perdia el mensaje (5 sitios) |
| `errorMap` por esquema | se respeta | **se ignora en silencio** | Perdia el mensaje (3 sitios) |
| `z.record()` con 1 argumento | valor | **clave, valor** (2 argumentos) | **NO aplica**: el repo ya usaba 2 argumentos || `error.errors` (alias) | existe | **ya no existe** | **NO aplica**: el repo usa `error.issues` |
| `.min(n,'msg')` / `.max(n,'msg')` / `.int('msg')` | 2do arg string | **sigue siendo string** | **NO aplica**: los ~237 usos siguen bien |
| `.email()` | metodo | **sigue existiendo** (deprecado, sin aviso en runtime) | **NO aplica** |
| `.datetime()` | metodo | **sigue existiendo** (deprecado, sin aviso en runtime) | **NO aplica** |
| `.strict()` | metodo | **sigue existiendo** (deprecado, sin aviso en runtime) | **NO aplica** |
| `.regex(re,'msg')` | 2do arg string | **sigue siendo string** | **NO aplica** |
| `.refine(fn,{message})` | objeto | **sigue siendo objeto** | **NO aplica** |
| `.coerce.number()` | idem | idem (mismo `NaN`, mismo `0` en `""`) | **NO aplica** |
| `.default()`, `.optional()`, `.nullish()`, `.catch()`, `.trim()` | idem | idem | **NO aplica** |
| `z.email()` (top-level) | no existe | **existe** | `z.string().email()` sigue siendo valido |
| `z.strictObject()` | no existe | **existe** | `.strict()` sigue siendo valido |
| `z.iso.datetime()` | no existe | **existe** | `.datetime()` sigue siendo valido |

Ademas cambian (sin impacto en el repo, ver seccion 5):

- Los **mensajes por defecto** de zod 4 son distintos ("Required" ->
  "Invalid input: expected string, received undefined"; "Invalid email" ->
  "Invalid email address"; "Unrecognized key(s) in object: 'x'" ->
  "Unrecognized key: \"x\"").
- Los **`code`** del issue cambian: `invalid_string` -> `invalid_format`,
  `invalid_enum_value` -> `invalid_value`, `invalid_literal` -> `invalid_value`,
  `too_small`/`too_big`/`invalid_type`/`unrecognized_keys` siguen.

El codigo del repo **no** depende de esos `code`: se greppeo `src/` y `tests/`
y no hay ninguna comparacion contra un `code` de zod (solo se copian al
detalle de la respuesta). Los `code` que si se comparan en los tests
(`invalid_type`, `unrecognized_keys`) estan en `tests/middleware/validate.test.js`,
que usa **esquemas de mentira** y no depende de la version de zod.

### 1.5 La superficie de los mensajes de error (lo que hay que preservar)

8 sitios de `src/` usaban parametros de mensaje que **zod 4 ignora en
silencio**. Estos mensajes son los que ve el operador y el integrador, y
varios estan escritos en espanol a proposito:

| # | Archivo | Sitio | Parametro zod 3 | Mensaje que se pierde |
|---|---|---|---|---|
| 1 | `src/schemas/admin-excepciones.js` | `alcance_firmas_max` | `invalid_type_error` | `alcance_firmas_max tiene que ser un numero` |
| 2 | `src/schemas/admin-excepciones.js` | `ruta_papel_operativa` | `invalid_type_error` | `ruta_papel_operativa tiene que ser true o false` |
| 3 | `src/schemas/admin-empresas.js` | `verificarRepresentanteBody.tipo_documento` | `errorMap` | `tipo_documento tiene que ser CERTIFICADO_CAMARA, RUT o PODER` |
| 4 | `src/schemas/admin-empresas.js` | `contrafirmaBody.acepta` | `required_error` | `acepta es requerido` |
| 5 | `src/schemas/admin-empresas.js` | `setActivoBody.activo` | `required_error` | `activo es requerido` |
| 6 | `src/schemas/admin-clientes.js` | `allowedOperationsField` | `errorMap` | `Cada item de allowed_operations debe ser uno de: ...` |
| 7 | `src/schemas/admin-encargado.js` | `registrarPoderBody.tipo` | `errorMap` | `tipo tiene que ser PODER, DELEGACION o REPRESENTACION` |
| 8 | `src/routes/anexoNube.js` | `suscribirBody.acepta` | `required_error` | `acepta es requerido` |
| 9 | `src/routes/anexoEncargo.js` | `suscribirBody.acepta` | `required_error` | `acepta es requerido` |
| 10 | `src/routes/anexoEncargo.js` | `suscribirBody.acepta_tratamiento` | `required_error` | `acepta_tratamiento es requerido` |

**Ninguno de estos 10 mensajes esta asertado por la suite.** Por eso el
"todo verde" NO alcanza como prueba de que la migracion no perdio nada: sin
este trabajo, la suite habria dado verde con los 10 mensajes cambiados por
el texto generico en ingles de zod 4. Por eso se midio aparte (seccion 4).

---

## 2. Que se cambio y por que

### 2.1 `package.json` y `package-lock.json`

```diff
-    "nodemailer": "^6.9.15",
+    "nodemailer": "^10.5.0",
-    "zod": "^3.23.8"
+    "zod": "^4.6.7"
```

El lock cambio **solo** en las entradas de esos dos paquetes (18 lineas: la
version, el `resolved`, el `integrity`, el `license` y el `engines` de
nodemailer, que pasa de `>=6.0.0` a `>=20.0.0`). Los otros 138 paquetes del
lock no se movieron, `better-sqlite3` sigue en 11.10.0 con su
`hasInstallScript: true`, y el total de paquetes en el lock sigue siendo 140.

El `engines` de nodemailer 10 (`node >= 20.0.0`) es compatible con el
`engines` del propio servicio (`>=20.0.0`) y con el Node 22 del servidor
(M.14).

**Como se instalo:** `npm install nodemailer@10.5.0 zod@4.6.7 --save
--ignore-scripts`. El `--ignore-scripts` es a proposito: sin el, npm
recompila `better-sqlite3` con el Node del sistema (ABI 147) y rompe el
binario ABI 127 que el repo y el servidor usan. Con `--ignore-scripts`, npm
solo cambio los dos paquetes de JavaScript puro y `better-sqlite3` no se
toco.

### 2.2 Los 10 sitios de mensaje de error en `src/`

Todos pasan a la API de zod 4 (`error`), conservando el mensaje y su
**condicion** exacta:

| Archivo | Que se toco | Que decia zod 3 | Que dice ahora |
|---|---|---|---|
| `src/schemas/admin-excepciones.js` | `alcance_firmas_max`: `invalid_type_error` -> `error` (funcion) | `invalid_type_error: 'alcance_firmas_max tiene que ser un numero'` | `error: (issue) => (issue.input === undefined ? undefined : 'alcance_firmas_max tiene que ser un numero')` |
| `src/schemas/admin-excepciones.js` | `ruta_papel_operativa`: `invalid_type_error` -> `error` (funcion) | `invalid_type_error: 'ruta_papel_operativa tiene que ser true o false'` | `error: (issue) => (issue.input === undefined ? undefined : 'ruta_papel_operativa tiene que ser true o false')` |
| `src/schemas/admin-empresas.js` | `verificarRepresentanteBody.tipo_documento`: `errorMap` -> `error` | `errorMap: () => ({ message: 'tipo_documento tiene que ser CERTIFICADO_CAMARA, RUT o PODER' })` | `error: 'tipo_documento tiene que ser CERTIFICADO_CAMARA, RUT o PODER'` |
| `src/schemas/admin-empresas.js` | `contrafirmaBody.acepta`: `required_error` -> `error` (funcion) | `required_error: 'acepta es requerido'` | `error: (issue) => (issue.input === undefined ? 'acepta es requerido' : undefined)` |
| `src/schemas/admin-empresas.js` | `setActivoBody.activo`: `required_error` -> `error` (funcion) | `required_error: 'activo es requerido'` | `error: (issue) => (issue.input === undefined ? 'activo es requerido' : undefined)` |
| `src/schemas/admin-clientes.js` | `allowedOperationsField`: `errorMap` -> `error` | `errorMap: () => ({ message: 'Cada item de allowed_operations debe ser uno de: ' + ALLOWED_OPS.join(', ') })` | `error: 'Cada item de allowed_operations debe ser uno de: ' + ALLOWED_OPS.join(', ')` |
| `src/schemas/admin-encargado.js` | `registrarPoderBody.tipo`: `errorMap` -> `error` | `errorMap: () => ({ message: 'tipo tiene que ser PODER, DELEGACION o REPRESENTACION' })` | `error: 'tipo tiene que ser PODER, DELEGACION o REPRESENTACION'` |
| `src/routes/anexoNube.js` | `suscribirBody.acepta`: `required_error` -> `error` (funcion) | `required_error: 'acepta es requerido'` | `error: (issue) => (issue.input === undefined ? 'acepta es requerido' : undefined)` |
| `src/routes/anexoEncargo.js` | `suscribirBody.acepta`: `required_error` -> `error` (funcion) | `required_error: 'acepta es requerido'` | `error: (issue) => (issue.input === undefined ? 'acepta es requerido' : undefined)` |
| `src/routes/anexoEncargo.js` | `suscribirBody.acepta_tratamiento`: `required_error` -> `error` (funcion) | `required_error: 'acepta_tratamiento es requerido'` | `error: (issue) => (issue.input === undefined ? 'acepta_tratamiento es requerido' : undefined)` |

**Por que la forma de FUNCION en 5 de los 10 sitios.** `invalid_type_error` y
`required_error` no son intercambiables: cada uno aplica a UNA mitad del
problema.

- `invalid_type_error` aplican cuando el valor **esta y es del tipo
  equivocado**. Si el campo falta, el mensaje debe ser el de "falta", no el
  de "tipo equivocado".
- `required_error` aplican cuando el campo **falta**. Si el campo viene con
  otro tipo, el mensaje debe ser el de "tipo equivocado", no el de "falta".

El `error` de zod 4 es **un solo parametro** que aplica a los dos casos a la
vez. Por eso se usa la forma de funcion, que devuelve `undefined` cuando el
caso NO es el suyo: al devolver `undefined`, zod 4 cae al mensaje por defecto
de ese caso. Medido:

```
[3.25.76] boolean required_error / undefined  => msg="acepta es requerido"
[3.25.76] boolean required_error / wrong type => msg="Expected boolean, received string"

[4.6.7] boolean {error fn} / undefined  => msg="acepta es requerido"
[4.6.7] boolean {error fn} / wrong type => msg="Invalid input: expected boolean, received string"
```

Es decir: **la condicion del mensaje queda igual**; lo que cambia es el texto
del mensaje por defecto de zod 4 para el caso que no es el del mensaje propio
(es la unica diferencia, y es inevitable: son los textos internos de la
libreria).

En los 3 sitios de `errorMap` alcanza con la forma de cadena, porque
`errorMap` aplicaba a **todos** los errores de ese esquema.

### 2.3 Lo que NO se toco (y por que)

- **`z.record()`**: el aviso del punto M.13 decia que `z.record` exige dos
  esquemas en zod 4 y que eso "rompe en runtime". **Medido: no aplica.** Los
  dos usos del repo ya eran de dos argumentos (`z.record(z.string().max(256),
  z.unknown())` en `src/schemas/index.js:282` y `z.record(z.string(),
  z.unknown())` en `src/routes/admin.js:53`). La forma de un argumento
  significa algo distinto en cada version, pero el repo no la usa.
- **Los ~237 `.min(n,'msg')` / `.max(n,'msg')` / `.int('msg')`**: el segundo
  argumento como cadena **sigue siendo valido** en zod 4. No hizo falta
  reescribir ni uno.
- **Los 15 `.email()`, los 4 `.datetime()` y los 33 `.strict()`**: en zod 4
  existen como metodos deprecados, **funcionan igual y no emiten ningun aviso
  en runtime** (verificado: `warnings emitted by deprecated methods => NONE`).
  Reemplazarlos por `z.email()`, `z.iso.datetime()` y `z.strictObject()`
  habria sido una reescritura de ~50 lineas sin ganancia de comportamiento.
  Queda anotado como deuda en la seccion 6.
- **`src/middleware/validate.js`**: ya era defendivo (`error.issues`, `i.path`
  que puede no ser lista, `i.message` que puede faltar). No hacia falta
  tocarlo y no se toco.
- **La app de escritorio (`sgsst-electron-app/package.json`)**: tiene su
  propio `nodemailer@^8.0.5` (`utils/emailSender.js`). Es **otro paquete npm**
  con su propio lock: **no entra** en el `npm audit --omit=dev` del servicio
  que es el alcance de M.13. Se anota en la seccion 6 como pendiente
  separado, con su propio criterio de aceptacion.

---

## 3. La suite: antes y despues

### 3.1 ANTES (zod 3.25.76, nodemailer 6.10.1)

```
archivos de prueba: 176
--- resumen ---
# tests 2624
# pass 2622
# fail 0
# cancelled 0
# skipped 2
# todo 0
# duration_ms 296006.8696
bloques not ok: 0
exit code: 0
```

### 3.2 DESPUES (zod 4.6.7, nodemailer 10.5.0)

Corrida final sobre el arbol tal como queda entregado:

```
archivos de prueba: 179
--- resumen ---
# tests 2665
# pass 2663
# fail 0
# cancelled 0
# skipped 2
# todo 0
# duration_ms 310625.6681
bloques not ok: 0
exit code: 0
```

**Como leer estos dos numeros.** Los tests pasaron de 2 624 a 2 665 **no por
este trabajo**: durante la sesion, otro worker del arbol anadio tres
archivos de prueba (`tests/scripts/comparar-despliegue.test.js` con 6 tests,
`tests/scripts/probar-reversion.test.js` con 9,
`tests/routes/health.test.js` con 26; 6 + 9 + 26 = 41 = 2 665 - 2 624). El
**codigo de este trabajo no agrega ni quita ningun test**.

Lo que importa para M.13 es que **los 2 624 tests del punto de partida estan
todos dentro de los 2 665 y todos pasan**: `fail 0`, `not ok 0`, los mismos
2 `skipped`. La suite se corrio con el runner oficial (escribe UTF-8, a
diferencia de `npm test`), con Node 22.23.4:

```
node "$env:TEMP\kair-p8\runner-suite.js" "$env:TEMP\kair-p8\suite-worker-audit.txt" "C:\Proyectos Programación\SG-SST-E\sgsst-electron-app\firma-service"
```

**Ningun test se modifico, se relajo ni se borro.** La correccion fue del
CODIGO, no del criterio.

### 3.3 El audit DESPUES

```
$ npm audit --omit=dev
found 0 vulnerabilities

exit code: 0
```

Y el audit completo (incluyendo `devDependencies`):

```
$ npm audit
found 0 vulnerabilities
```

De las **2 high severity vulnerabilities** del punto de partida a **0**.

---

## 4. La prueba de que no se perdio ningun mensaje

La suite no cubre los 10 mensajes de la seccion 1.5 (verificado: ninguno esta
asertado). Para no entregar un "verde" que no pruebe nada, se escribio un
arnes que corre los **esquemas reales del repo** y compara, mensaje por
mensaje, la salida de zod 3 contra la de zod 4.

El arnes se ejecuto tres veces:

1. Con zod 3.25.76 instalado en el repo (`npm install --no-save
   --no-package-lock zod@3.25.76`): golden de partida.
2. Con zod 4.6.7 **antes** de tocar `src/`: se ve la perdida.
3. Con zod 4.6.7 **despues** de la adaptacion: se ve la recuperacion.

Los 10 mensajes propios del repo quedaron **byte a byte iguales** a los de
zod 3. Ejemplos del golden final (zod 4.6.7, codigo ya adaptado):

```
EX alcance string          | msg="alcance_firmas_max tiene que ser un numero"
EX ruta_papel_operativa str | msg="ruta_papel_operativa tiene que ser true o false"
VR tipo_documento malo     | msg="tipo_documento tiene que ser CERTIFICADO_CAMARA, RUT o PODER"
CF acepta undefined        | msg="acepta es requerido"
SA activo undefined        | msg="activo es requerido"
```

Y el caso de `allowedOperationsField`, que es el unico donde el mensaje
depende de si el error es del array o de un item:

```
# zod 3 con errorMap (la forma original):
NO es un array  | code=invalid_type msg="Cada item de allowed_operations debe ser uno de: sign_request:create, audit:read"

# zod 4 con errorMap (sin adaptar): el mensaje se PIERDE
NO es un array  | code=invalid_type msg="Invalid input: expected array, received string"

# zod 4 con error (adaptado): el mensaje se CONSERVA
NO es un array  | code=invalid_type msg="Cada item de allowed_operations debe ser uno de: sign_request:create, audit:read"
```

Ese caso es la muestra mas clara de por que la adaptacion no era opcional:
**sin ella, la suite daba verde con el mensaje perdido**.

---

## 5. Lo que quedo abierto (y por que)

### 5.1 Los mensajes por defecto de zod 4 (cambio visible, no controlable)

Para todo error que **no** lleva mensaje propio del repo, el texto cambio.
Estos son los textos internos de la libreria:

| Situacion | zod 3 | zod 4 |
|---|---|---|
| Campo faltante | `Required` | `Invalid input: expected string, received undefined` |
| Tipo equivocado | `Expected number, received string` | `Invalid input: expected number, received string` |
| Email invalido | `Invalid email` | `Invalid email address` |
| Correo largo | `String must contain at most 254 character(s)` | `Too big: expected string to have <=254 characters` |
| Clave desconocida | `Unrecognized key(s) in object: 'x'` | `Unrecognized key: "x"` |
| Enum invalido | `Invalid enum value. Expected 'A' \| 'B', received 'C'` | `Invalid option: expected one of "A"\|"B"` |

**Por que no se neutraliza:** neutralizarlo exige un `errorMap` global de
zod, es decir reescribir la presentacion de TODOS los errores de TODOS los
esquemas del servicio, paraelo con un solo parametro de la libreria. El
criterio de este punto es "subir las dos altas sin romper nada", y estos
textos no los afirma ningun test ni ningun cliente del repo (verificado:
`src/` y `tests/` no comparan contra el texto del mensaje de zod, salvo los
esquemas de mentira de `tests/middleware/validate.test.js`, que no dependen
de la version). Se deja documentado para que el integrador sepa que el
detalle de un 400 ahora dice "Invalid input: expected ..." en vez de
"Required".

Los **`code`** de los issues tambien cambian de nombre (`invalid_string` ->
`invalid_format`, `invalid_enum_value` -> `invalid_value`, `invalid_literal`
-> `invalid_value`). El repo no los compara en ningun lado, pero un
integrador externo que los mirara tendria que actualizarlos.

### 5.2 Lo que la suite NO cubre (riesgo residual)

1. **El envio real de correo (SMTP).** La suite corre en `jsonTransport`
   (dev). `nodemailer` 10.5.0 no cambio la API que el repo usa, y se
   verifico en un arnes aparte que `createTransport` + `sendMail` +
   `info.messageId` + `info.envelope` + `info.message` +
   `attachments[{filename,path}]` se comportan igual. **Lo que no se probo es
   un `sendMail` contra un servidor SMTP real**: la negociacion TLS, el
   `requireTLS` y el `auth` contra el servidor de produccion. El cambio de
   `requireTLS` 6 -> 10 es **la parte de este trabajo que mas conviene
   probar en el servidor antes de abrir a empresas reales**.

2. **Los avisos de seguridad de nodemailer 9 y 10.** El mas relevante para
   este repo es el de nodemailer 9.0.0: **las peticiones HTTPS que hacian
   falta para contenido remoto ahora validan el certificado TLS por
   defecto**. El repo **no** usa contenido remoto (los adjuntos son
   `path` local, nunca `href`/`url`), asi que no aplica hoy. Si alguna vez
   se pone un adjunto por URL, hay que saber que ahora falla con un
   certificado autofirmado.

3. **La proteccion de la direccion de destino.** Los avisos de interpretacion
   de dominio y de bypass del allow-list de IDN/Punycode arreglan
   precisamente el escenario del correo de la Empresa. El repo tiene dos
   remitentes (K+AIR y la Empresa, con `from` distinto al `to`). **La suite
   no prueba esa combinacion contra un SMTP real**, solo que el `from` y el
   `transporter` sean coherentes entre si.

4. **`z.record` con clave restringida.** En zod 4, `z.record(z.string().max(256), ...)`
   con una clave de 300 caracteres devuelve `code=invalid_key` y el mensaje
   "Invalid key in record", en vez del `too_big` de zod 3. **El rechazo
   sigue ocurriendo** (la proteccion no se perdio, que es lo que importa), pero
   el `code` cambio. El cap de 20 keys y el de 256 caracteres por clave
   siguen valiendo.

5. **La combinacion de `z.coerce.number()` con `.optional()` y `.default()`.**
   Medida y sin cambio de comportamiento, pero es un punto que la suite
   cubre solo con los valores que hoy se mandan.

6. **`z.email()` / `z.iso.datetime()` / `z.strictObject()` (la API nueva).**
   El repo sigue con los metodos deprecados (`z.string().email()`, etc.),
   que funcionan y no avisan. Cuando zod 5 llegue, esos metodos seran
   removidos: habra que hacer ese paso (mas una corrida de la suite) antes
   de subir a zod 5.

7. **El `npm ci` en el servidor.** Se instalo con `--ignore-scripts` en
   local para no recompilar `better-sqlite3`. En el servidor, el runbook
   tiene que seguir instalando las dependencias **con** los scripts (para
   que `better-sqlite3` baje el prebuild del Node 22, M.14). Si el paso de
   despliegue se hace con `--ignore-scripts`, `better-sqlite3` queda sin
   binario y el servicio no arranca.

---

## 6. Lo que queda pendiente (fuera del alcance de este punto)

1. **`nodemailer@8.0.11` en la app de escritorio**
   (`sgsst-electron-app/package.json`, `utils/emailSender.js`). Es otro
   paquete npm con su propio lock y **no entra** en el audit del servicio.
   El audit que da 0 es el de `firma-service`. Conviene una pasada aparte,
   con su propio criterio de aceptacion (los tests de la app).
2. **zod 5**: cuando salga, migrar los ~52 metodos deprecados
   (`z.string().email()` -> `z.email()`, `.datetime()` -> `z.iso.datetime()`,
   `.strict()` -> `z.strictObject()`).
3. **Probar en el servidor** un envio SMTP real con nodemailer 10.5.0
   (ver seccion 5.2, punto 1). Es la parte de este trabajo que no la puede
   probar la suite.

---

## 7. Los archivos que se tocaron

**8 archivos.** Nada mas.

| Archivo | SHA256 (estado final) |
|---|---|
| `firma-service/package.json` | `4aa4cc3f81cb5127ed2896288507c62a6e80d684d7fe32bf1bf371cdf7f18a5e` |
| `firma-service/package-lock.json` | `bac1da03ed575f7b685247a60c1cc0082851046f851264bfe2376a5d65067f9d` |
| `firma-service/src/schemas/admin-excepciones.js` | `4a0368bd9effe081e9b5aec7a772b15043c77eca6b9e8db7a922dc9399c52f8d` |
| `firma-service/src/schemas/admin-empresas.js` | `28b063a6a66255a608383ec9bdd4fd2ceed4074c49571518ea9ad3192b805def` |
| `firma-service/src/schemas/admin-clientes.js` | `f4f74d4ceea8907f2901f0f6946ec7a6dab959b17e5fe8d076162a246987d44e` |
| `firma-service/src/schemas/admin-encargado.js` | `00511ccb819cd4a4fa055d898708dd3ca86573d2873c38bc100df48383f42ae0` |
| `firma-service/src/routes/anexoNube.js` | `e4f1f61545ba2fd41eb35d31fe26c8dee5416670e5df3d7f23502f7da9b2ecb4` |
| `firma-service/src/routes/anexoEncargo.js` | `8c0c9fea8a17b67f15fcd6e05b3808ee00d4ac01b0fe7c528f723950521cbced` |

**NO se toco** (verificado con `git diff --stat` vacio y hash):

- `firma-service/legal-readiness.json` -> `191c08b837b41069de4e2d25d7158fd90a7c3ce5f93b22696d2d7050f8a4013f`
  (el mismo de antes, byte a byte).
- `deploy/`, `docs/`, `Historial.md`, `CONTEXT.md`, `BITACORA.md`, el cuadro
  canonico, el mapa de la meta y el paquete del abogado.

Todos los archivos tocados quedaron en **LF, sin BOM**, y las lineas
agregadas son **ASCII puro** (sin tildes, sin enie, sin CJK/cirilico/hangul).
El EOL de cada archivo se conserva: el diff es de 4 a 17 lineas por archivo,
sin ruido de fin de linea.

No se hizo `git add` ni commit.

---

## 8. Resumen

- Las **2 altas** del `npm audit` del servicio quedaron en **0**.
- La suite completa esta **verde**: 2 665 tests, 2 663 pass, **0 fail**, 2
  skipped (de los cuales los 2 624 del punto de partida siguen todos ahi y
  todos pasan).
- Se **subieron** `nodemailer 6.10.1 -> 10.5.0` y `zod 3.25.76 -> 4.6.7`.
- Se adaptaron **10 sitios** de mensaje de error en `src/` (6 archivos), porque
  zod 4 **ignora en silencio** `invalid_type_error`, `required_error` y
  `errorMap`. Sin esa adaptacion la suite daba verde **con los 10 mensajes
  cambiados**: el "verde" no era prueba.
- **Ningun test se toco.**
- El riesgo residual principal: **el envio SMTP real contra el servidor** no
  lo prueba la suite, y la app de escritorio tiene su propio `nodemailer@8`
  que esta fuera de este audit.
