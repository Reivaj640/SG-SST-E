# Onboarding de empresas en el servicio de firma — estado 2026-10-19

> **Actualización 2026-10-19.** Este documento nació como plan y **la mayor parte ya se
> ejecutó**. Estado real al 19:
>
> - **Capítulo I del Acuerdo: cerrado** (numerales 1.1 a 1.5, el 1.5 agregado el 18).
> - **Capítulo II: cerrado** (citas verificadas en fuente oficial; redacción aplicada el 19).
> - **Migraciones 017 y 018 aplicadas en código**, con 61 tests nuevos en verde.
> - **Tabla `gh_firma_empresas`, service, rutas admin, bloque en pantalla y sección en la
>   Constancia: implementados** (📦904).
> - **Puente PC → servidor: NO implementado.** Los datos se cargan a mano por el endpoint
>   admin, que es lo que bloquea producción.
> - **Capítulo III: auditado el 2026-10-19.** Las tres citas legales del capítulo son
>   exactas y el texto **no se modifica**. La deuda Priority 0 (huellas con sal en la misma
>   fila, cédula en texto claro, registro de auditoría sin protección) **quedó implementada**
>   con las migraciones 019 y 020. Pendiente: la cláusula de custodia del Anexo de Encargo y
>   la aclaración del 3.8, que necesitan abogado.
>
> Lo que sigue en este documento describe el plan original. Las prioridades 1 a 5 ya no
> aplican tal como están escritas: se hicieron. Quedan **Prioridad 6 (igualar el fixture de
> desarrollo)** y el **puente de sincronización**.
>
> Contexto del trabajo: el Capítulo I del Acuerdo v1.0 no identificaba a la Empresa, y
> el Capítulo III describía un método criptográfico que el código no cumplía. Antes
> de que firme un trabajador de una empresa real, ambas cosas tienen que estar cerradas.

---

## 1. El operador: Gesstiar S.A.S.

> **Corrección del 2026-10-18.** Esta sección decía "Empresa piloto: Gestiar S.A.S." y
> asumía que Gestiar S.A.S. era una empresa **cliente** distinta del operador. No es así:
> el owner confirmó que **Gestiar S.A.S. y JRFSoluciones son la misma entidad**, que hoy se
> llama **Gesstiar S.A.S.** (con doble `s`), y que es la empresa que **opera y distribuye
> K+AIR**. El **cliente** que solicita firmas es **Aseplus** (tiene la API key en producción).
>
> Consecuencia: la tabla de abajo es la **identificación del Encargado**, no de un piloto, y
> por eso sus datos van en el Anexo de Encargo, en Términos y en Privacidad — que es
> exactamente donde quedaron. En el bloque que ve el trabajador va la empresa **cliente**.

Datos del operador confirmados por el owner el 2026-10-17 y 2026-10-18.

| # | Campo | Valor | Estado |
|---|---|---|---|
| 1 | Razón social | Gesstiar S.A.S. | Confirmado (doble `s`) |
| 2 | Domicilio | Calle 114 # 43B - 83, Barranquilla (Atlántico) | Calle confirmada el 18; **ciudad por confirmar** (ver 1.1) |
| 3 | NIT | — | **Falta** — único dato pendiente del Capítulo I |
| 4 | Representante legal | Javier Robles Fontalvo, CC 1044391066 | Confirmado |
| 5 | Responsable interno del tratamiento | Javier Robles Fontalvo, Representante Legal | Confirmado, falta correo |
| 6 | Canal de PQRS | adminkair@gmail.com | Puesto en el Anexo de Encargo |
| 7 | Canal de incidentes de seguridad | adminkair@gmail.com | Puesto en el Anexo de Encargo |
| 8 | URL de la política de tratamiento de datos | — | **Falta** |

### 1.1 Lo que hay que confirmar antes de cargar

- **La ciudad del domicilio sigue sin confirmar.** *Calle 114 # 43B - 83* pone la calle de
  tres cifras primero, que es la convención de Bogotá; en Barranquilla se escribe con la
  carrera primero (*Cra 43 # 12-34*). El owner confirmó la dirección el 18 pero no la ciudad.
  El dato va mostrado al trabajador en cada firma, así que hay que confirmarlo contra la
  cámara de comercio. Está escrito como "Barranquilla (Atlántico)" en los seis documentos
  legales: si no es, hay que corregir los seis.
- **La cédula del representante legal queda en la evidencia de cada firma**, en
  `representante_legal_snapshot`. En la verificación pública debe salir **enmascarada**
  (`CC 1044…`), igual que la del trabajador. Hoy eso no está garantizado.
- **El NIT es el `id_empresa`** que usa el sistema y queda en la evidencia. No se puede
  inventar: sale de la cámara de comercio o del RUE.

### 1.2 Un solo correo cierra tres campos

Los campos 5, 6 y 7 (responsable interno, PQRS e incidentes de seguridad) pueden apuntar
al **mismo correo institucional**. No hace falta que sean tres direcciones distintas: que el
mismo buzón reciba PQRS e incidentes de seguridad es válido y es lo normal en una SAS de este
tamaño. Lo que sí importa es que exista y responda.

El campo 8 no se puede reutilizar: `legal/privacidad.html` y `sitio/privacidad.html` son la
política de **K+AIR/JRFSoluciones como Encargado**, no la de Gestiar como Responsable. Son
documentos distintos y el firmante necesita la de su empleador.

### 1.3 Orden de activación

```
datos completos  →  Anexo de Encargo firmado  →  empresa activada para firmar
```

Crear la empresa hoy sin el Anexo produce exactamente el defecto que se quiere cerrar: un
bloque que afirma que el firmante fue informado sobre una relación contractual que no
tiene respaldo.

---

## 2. Deuda técnica

Ordenada por lo que bloquea a lo demás. La Prioridad 0 **ya se implementó** (ver abajo);
las demás siguen vigentes.

### Prioridad 0 — El Capítulo III promete una comparación que el código no cumplía

> **Corrección del 2026-10-19 (auditoría del Capítulo III).** Este documento decía
> que "el texto afirma HMAC-SHA256 con clave secreta del servicio en 3.4(d), 3.4(e) y
> 3.6(e)". **Eso es falso, y la diferencia importa.** El texto nunca habló de HMAC ni de
> clave secreta: siempre dijo **«huella digital con sal»** (3.4(d), 3.4(e), 3.6(e) y
> 10.5(a)-(b)). `grep -r hmac firma-service` da cero en todo el service. La redacción del
> Capítulo III es correcta y **no se modifica**: lo que estaba mal era la implementación.

El problema real: **la sal estaba en la misma fila que la huella**. Un hash con sal solo
protege si la sal es secreta; guardada al lado, es equivalente a un hash plano. Peor: la
cédula **no se comparaba con una huella**, se guardaba en texto claro en la base de datos
del encargado, en contra de lo que el propio 10.5(a) exige ("se conserva únicamente esa
huella, no el número en texto claro").

Lo que había, y por qué la diferencia importaba:

| Dato | Entropía | Implementación anterior | ¿Se recupera con solo lectura de la BD? |
|---|---|---|---|
| Token de acceso | 192 bits | `sha256(token)` | No (2^192) |
| **Cédula del firmante** | ~10^10 | `SHA-256(sal‖número)`, **sal en la misma tabla** | **Sí, en minutos** |
| **OTP** | 10^6 | `SHA-256(sal‖otp)`, sal en la misma fila | **Sí, al instante** |

El token no era problema por su entropía. La cédula y el OTP sí, y son los que sostienen el
criterio de confiabilidad 3.7(a) y, con él, la presunción del artículo 2.2.2.47.7. Con solo
lectura de la base de datos alguien podía reconstruir la identidad de cualquier firmante y
pasar la verificación.

**Implementado el 2026-10-19** (migraciones 019 y 020, más la capa de servicios):

- Clave maestra derivada por HKDF de `TOKEN_ENCRYPTION_KEY` (que ya existe en el `.env` del
  servidor), con un propósito por dato: `identificacion`, `otp`, `token`, `trabajador`,
  `correo`. La llave vive **fuera** de la base de datos: quien lea la BD no puede recomputar
  candidatos.
- `id_trabajador` pasa a ser un **seudónimo** (HMAC del documento, con marcador `psn1_`).
  El cliente no cambia: sigue mandando la cédula por el canal interno autenticado; lo que
  cambia es lo que el servicio **guarda**. La fila heredada se reescribe sola con el HMAC la
  primera vez que se usa.
- Huella de identificación, OTP, token de acceso y correo del firmante: HMAC en vez de
  `sha256(sal‖x)`, y **dejar de persistir las sales**.
- `gh_firma_eventos` queda **append-only** con dos triggers de SQLite (migración 020), que
  hacen cumplir en la base de datos lo que el 3.6(g) promete.
- Efecto colateral que corrige una fuga: la mini-app exponía la cédula en claro en el
  contexto público (`GET /s/:token`); ahora expone el seudónimo.

**Completado el 2026-10-19, Fase 1 del carril de código** (migración **022**, `📦907`). Lo que
faltaba del punto anterior era que la derivación **no decía con qué llave se hizo cada huella**,
y eso hacía la rotación de llaves una operación que invalidaba toda la evidencia:

- **Ámbito por empresa.** La derivación pasa a ser `kair-firma/v2/<versión>/<ámbito>/<propósito>`,
  con el **ámbito = la empresa** para identificación, seudónimo, correo y OTP. Dos empresas
  que firmen al mismo documento producen dos seudónimos distintos: quien lea la base no puede
  enlazar al mismo trabajador entre empresas. El **token** de acceso queda **global**, porque es
  la credencial con la que se resuelve la solicitud.
- **Versión de llave por fila.** Cada fila registra con qué versión se calculó su huella, en las
  columnas `*_alg`, con el marcador `hmac-sha256.v2.k1` (formato + versión).
- **Anillo de llaves.** `FIRMA_HMAC_KEYRING='{"k1":"<hex>","k2":"<hex>"}'` +
  `FIRMA_HMAC_KEY_VERSION`. Sin esas variables el anillo es `{"k1": TOKEN_ENCRYPTION_KEY}` y el
  comportamiento no cambia. Al verificar se prueban **todas** las versiones del anillo, y se
  conservan los formatos anteriores (v1 y el pre-hash heredado) para que **ninguna fila quede sin
  poder verificar**.
- **La búsqueda tenía que probar el anillo, no solo la verificación.** Este fue el defecto que
  salió de la fase: `candidatosBusqueda()` calculaba el seudónimo solo con la versión vigente,
  así que **en el momento de rotar la llave las filas viejas se volvían invisibles** — el error
  no era de verificación, era de recuperación — y las firmas en curso quedaban varadas sin
  explicación. Ahora la búsqueda y `mismoTrabajador()` calculan el seudónimo con cada versión
  del anillo.

Lo que **no** se tocó: el texto del Capítulo III (sus tres citas legales son exactas) y el
Anexo de Encargo, que requiere abogado.

### Prioridad 1 — Publicar la v1.1 con el Capítulo I corregido

**No se puede corregir la v1.0.** El capítulo 9.4 del propio Acuerdo exige que toda
modificación del contenido se publique como versión nueva con su propia huella. Y
reescribir la fila existente dejaría a `SIGN-2026-269179` apuntando a un `agreement_hash`
que ya no corresponde a ningún texto almacenado: evidencia muerta.

El texto corregido del Capítulo I ya está escrito (opción "a": el bloque de identificación
se muestra junto al Acuerdo y se incorpora a la constancia con su propia huella, **sin**
alterar el texto ni la huella del Acuerdo). Falta publicarlo como versión nueva.

### Prioridad 2 — Los datos de la empresa no existen en el sistema

`gh_internal_clients` tiene `api_key_hash`, `id_empresa`, `allowed_operations`,
`description` y fechas. **No tiene razón social, NIT, domicilio, representante legal,
responsable interno ni canal de PQRS.** `gh_firmas_electronicas` solo guarda `id_empresa`,
que es un identificador, no los datos.

Sin esto no hay bloque que renderizar. Va en una tabla aparte, `gh_firma_empresas`, **no en
`gh_internal_clients`**: esa tabla es una fila por API key y una empresa puede tener varias,
de modo que los datos de la empresa se duplicarían y el bloque dependería de qué key creó la
solicitud.

### Prioridad 3 — Migración 017 (snapshot en el consentimiento)

`gh_consentimientos_firma` ya tiene `id_empresa`, `version_acuerdo` y `hash_texto_acuerdo`
por consentimiento, con `UNIQUE (id_trabajador, id_empresa, version_acuerdo)`. El modelo ya
está listo: alcanza con dos columnas, `empresa_snapshot` y `empresa_hash`, más las de
`gh_firma_empresas`. **No se versiona el Acuerdo por empresa** — el texto sigue siendo uno.

### Prioridad 4 — El candado del Anexo de Encargo

Campo `anexo_encargo_firmado_at` en `gh_firma_empresas` y validación en
`signRequest.create()`: sin Anexo firmado, no se crea la solicitud. Convierte una afirmación
no verificable en un hecho.

Hoy: el Anexo existe solo como plantilla (`legal/anexo-encargo.html`), con "Revisión
profesional pendiente" y los datos de JRFSoluciones "pendientes de legalización". No hay
constancia de que esté firmado con nadie.

**El defecto de remisión del Acuerdo ya está corregido en el texto**: la v1.0 remitía a un
"Anexo de Transmisión de Datos Personales" y el documento real se llama "Anexo de Encargo de
Tratamiento de Datos Personales".

### Prioridad 5 — Constancia de firma (cláusula 9.6)

La constancia debe identificar la versión del Acuerdo aceptada y la huella de su texto.
Hoy la fila guarda `agreement_version` y `agreement_hash`, pero **la constancia impresa no los
muestra**.

### Prioridad 6 — Divergencia entre el fixture de desarrollo y el de producción

`acuerdo-v1.0.txt` tiene el Capítulo I corregido. **`acuerdo-dev-v1.0.txt`, que es el que lee
`seed-dev-acuerdo.js`, no.** En desarrollo se prueba contra el texto viejo y en producción
contra el nuevo. Hay que igualarlos.

---

## 3. Otros pendientes (no bloquean el alta de la empresa piloto)

| Tema | Estado |
|---|---|
| Rótulo "vence en 24 horas" hardcodeado; el TTL real es 72 | Pendiente |
| Verificación pública por `id_constancia`, para terceros sin token | Pendiente |
| Enmascarar la cédula del representante legal en la verificación pública | Pendiente |
| Suite de 973 tests: `better-sqlite3` compilado para Node 22, el Node instalado es 26 | Bloqueado por entorno |
| `npm audit`: 45 vulnerabilidades (1 low, 16 moderate, 22 high, 6 critical) | Sin revisar |
| Limpieza de datos de prueba (`SIGN-2026-269179`, trabajador `9999999999`) | Pendiente |
| Backup automático, alertas del túnel | Pendiente |
| API key de Aseplus en texto plano en el escritorio | Pendiente de tu lado |
| JRFSoluciones sin legalizar | Bloquea el Anexo de Encargo |

---

## 4. Lo que NO se debe hacer

- **Corregir la fila v1.0.** Se publica una v1.1. Ver Prioridad 1.
- **Activar una empresa sin Anexo firmado**, aunque tenga todos los datos.
- **Cargar una empresa que no exista en el RUE.** El `id_empresa` queda en la evidencia de
  cada firma; una entidad ficticia convierte un problema de escritorio en falsedad documental.
- **Meter los datos de la empresa en `gh_internal_clients`.** Ver Prioridad 2.

---

## 5. El carril de código: qué se implementó

Este plan nació como una lista de pendientes. A partir del 2026-10-19 el trabajo
se organizó en un **carril de código** acordado con el owner y el advisor, en
un orden fijo: clave HMAC por empresa → representante → oráculo → últimos cuatro
dígitos → purga → 5.4 y orden (g)/(h).

| Fase | Qué resuelve | Paquete |
|---|---|---|
| 1 | La derivación no decía con qué llave se hizo cada huella | `📦907` |
| 1b | La búsqueda solo probaba la versión vigente: al rotar la llave las filas viejas se volvían invisibles | `📦907` |
| 2 | El representante quedaba en claro en la evidencia | `📦907` |
| 3 | El Capítulo III promete una comparación que el código no cumplía | `📦908` |
| — | Los 47 fallos de la línea base (dos causas raíz) | `📦909` |
| 4 | El firmante no podía confirmar de un vistazo que el documento era el suyo | `📦910` |
| 5 | El 8.6 y el 10.6 obligaban a suprimir el dato vencido, y no había vía | `📦911` |

### 5.1 Fase 5 — la ventana de purga (migraciones 020 y 023)

**Lo que es, y lo que no es.** Esto es la **purga del registro de auditoría**,
no la purga completa. El numeral **3.6(g)** promete que el registro de auditoría
"no puede ser alterado ni eliminado una vez registrado". Los numerales **8.6**
y **10.6** obligan a suprimir el dato una vez vencido su plazo y sin deber
legal de conservación. Las dos promesas son incompatibles si la inalterabilidad
es absoluta: o la base de datos miente sobre lo que promete, o el deber de
supresión nunca se cumple.

La salida no es aflojar la garantía. Es una **ventana de purga** gobernada, con
**cinco condiciones que la base de datos hace cumplir, no el código**:

1. Hay una **ventana abierta**, con actor, motivo y fecha de cierre. Se vence
   sola (tope de 4 horas): si el operador se cae a mitad del procedimiento, la
   ventana se cierra sin que nadie tenga que hacer nada.
2. La ventana **no está vencida**.
3. La firma está en el **lote** habilitado para esa ventana. El lote solo se
   puede ampliar con la ventana abierta (trigger propio).
4. La firma **venció su plazo** (`fecha_conservacion` en el pasado). Sin plazo
   declarado no hay nada que suprimir.
5. La firma **no tiene deber legal de conservación** (`hold_legal = 0`).

Cada condición aborta con su propio mensaje, para que el operador sepa cuál
falló. **El hold lo impone la base, no el código**: si la comprobación viviera
en el script, bastaría un `UPDATE` manual para esquivarla. El hold lo declara
la **Empresa** (es la Responsable del tratamiento) con **actor, motivo,
alcance y fecha**, y se libera con su propio actor y motivo; el historial queda
en `gh_firma_holds`.

**El recibo.** Cada firma purgada deja una fila en `gh_firma_purga_registro`:
qué firma, qué empresa, cuándo, quién, por qué, en qué ventana, qué categorías
se suprimieron y que se comprobó el hold. **Sin datos personales**: ni correo,
ni huellas, ni manifestación, ni IP. Es la prueba de cumplimiento. El log de
ventanas y purgas (`gh_firma_purga_log`) también es append-only, y registra el
conteo del chequeo de hold.

**El plazo lo declara la Empresa** (`plazo_retencion_dias`, en días), porque el
8.6 dice que el plazo "se determina por la tabla de retención documental de la
Empresa" y que "este Acuerdo no fija un plazo propio porque la ley no lo fija".
K+AIR es el Encargado, no el Responsable: no puede inventar plazos. **Sin
plazo declarado no hay fecha de conservación y nada se purga.** Pero la
retención indefinida **tampoco es cumplimiento**, así que:

- el reporte `scripts/reporte-vencimientos.js` marca el "sin plazo declarado"
  como **alerta de cumplimiento**, no como un no-op silencioso;
- cada firma creada por una Empresa sin plazo declarado deja un log
  `RETAIN_SIN_PLAZO` en el servidor;
- **el plazo debe declararse antes de la primera firma** de esa Empresa. La
  fecha se congela al crear la firma: el 8.6 habla del plazo "que le resulta
  aplicable" al firmante cuando se le pide la firma, y que la Empresa cambie
  su política después no mueve lo ya firmado.

**Lo que esta capa NO suprime** — y conviene decirlo con todas las letras: los
datos personales de la fila de la firma (correo, huellas, manifestación de
voluntad) ni los archivos (PDF original, PDF firmado, constancia). Eso es la
**capa 5B**, un paquete aparte. La operación completa, en orden, es:

```
1. chequeo de hold
2. datos personales   <- 5B, pendiente
3. eventos de auditoría   <- lo que hace esta capa
4. registro de purga      <- el recibo, una fila por firma
```

Ejecutar solo el paso 3 deja el estado **inverso** al deseable: se destruye la
prueba y se conservan los datos. **Hasta que exista la 5B, esta capa no puede
presentarse como cumplimiento del 8.6**, y el script de purga lo dice en voz
alta antes de hacer nada.

| Pieza | Qué hace |
|---|---|
| `src/db/schema/020_eventos_append_only.sql` | Triggers `BEFORE UPDATE`/`BEFORE DELETE` sobre `gh_firma_eventos` que abortan, con la excepción de las cinco condiciones. Tablas de control, lote, log y recibo. (Se puede enmendar: nunca se aplicó en ninguna base.) |
| `src/db/schema/023_conservacion.sql` | `fecha_conservacion`, `hold_legal`, `motivo_hold`, `hold_actor`, `hold_alcance`, `hold_fecha`, `hold_liberado_at` en la firma; `plazo_retencion_dias` en la empresa; tabla `gh_firma_holds`. |
| `src/services/conservacion.js` | Fecha, hold, reporte de vencimientos, apertura/cierre de ventana, armado del lote, purga y recibo. |
| `scripts/reporte-vencimientos.js` | Reporte de los cuatro grupos: próximos, vencidos elegibles, vencidos en hold, sin plazo declarado (este último como **alerta**). No borra nada. |
| `scripts/purga-ventana.js` | Ejecutor. Sin `--ejecutar` es simulación. Con `--ejecutar` exige `--actor` y `--motivo`. Avisa del alcance antes de hacer nada. |

**Cobertura.** El trigger no se prueba en la base de tests compartida (la
migración 020 lleva `-- @skip-when-env test`, porque otros archivos de test
borran eventos entre casos y abortarían). **Sí se prueba en CI**, contra el
**archivo real** de la migración, en una base de datos aislada
(`tests/conservacion-purga.test.js`), ejercitando las cinco condiciones. En
**staging** la migración se aplica de verdad y el trigger queda activo sobre la
base real.