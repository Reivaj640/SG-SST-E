# Plan de cierre: T&C (Acuerdo de uso) y las cinco decisiones abiertas

**Fecha**: 2026-10-20
**Documentos relacionados**:
- [`revision-tc-capitulos-2-12-2026-10-20.md`](./revision-tc-capitulos-2-12-2026-10-20.md) — la revisión de los capítulos II a XII
- [`plan-cierre-acuerdo-2026-10-19.md`](./plan-cierre-acuerdo-2026-10-19.md) — el plan de cierre por fases (del que este documento NO sustituye: completa)
- [`SECURITY.md`](./SECURITY.md) · [`API.md`](./API.md)

> Este documento no es asesoría jurídica y no publica nada. Define **qué se
> archiva, en qué orden se cierra, y qué se decide** en cada punto que
> estaba esperando al owner. Lo que exige firma de abogado queda marcado
> como tal.

---

## 1. Archivar la v1.0 antes de la v1.1

### 1.1 Por qué

El Acuerdo v1.0 es el texto que el Trabajador aceptó. Su huella SHA-256
(`52a490a4…`) es lo que ata cada firma a un texto concreto. Si el archivo del
repositorio se editara **después** de publicado, pasarían a ser verdad dos
cosas distintas y nadie podría demostrar cuál era el texto aceptado:

- la huella que ve el firmante dejaría de coincidir con el archivo, y
- la v1.1 se compararía contra un texto que ya no es el que se publicó.

### 1.2 Qué se hizo (mecanismo, no texto)

**`firma-service/scripts/archivar-acuerdo.js`** (nuevo). No modifica el
Acuerdo: **sella su huella** y la compara con lo publicado.

```bash
node scripts/archivar-acuerdo.js --version=v1.0             # archivar
node scripts/archivar-acuerdo.js --version=v1.0 --verificar # comprobar
```

- Escribe/actualiza `firma-service/scripts/fixtures/acuerdo-ARCHIVO.json`
  con: versión, SHA-256 del texto, número de caracteres, ruta del archivo,
  fecha de archivado, fecha de la última verificación, y si estaba publicada
  en la base.
- **Guardas** (por eso aborta con código 3):
  1. Si la versión está publicada en la base y el archivo **no** coincide con
     el texto publicado → "el texto se editó después de publicarse": es un
     **incidente**, no un archivado.
  2. Si la base tiene una versión **de pruebas** (`ACUERDO DEV`) con el mismo
     número de versión → el legal no se puede publicar ahí (409
     `ACUERDO_VERSION_EXISTS`). Se dice con nombre y apellidos.
  3. Si el manifiesto ya tiene una huella distinta de la del archivo → un
     Acuerdo archivado es **inmutable**.
- Es **idempotente**: volver a archivar la misma versión no cambia nada.

**Estado**: ejecutado el 2026-10-20. Manifiesto con la v1.0 archivada
(`52a490a4f4ce922109d42fa01ac45632cd62d5242bb82bf6e1967ede55710c04`,
32.907 caracteres). Verificado contra una base donde el legal v1.0 está
publicado, y verificado el disparo de las dos guardas.

### 1.3 Reglas de version que quedan escritas

1. `acuerdo-v1.0.txt` **no se vuelve a tocar**. Para cambiar el texto se crea
   `acuerdo-v1.1.txt` (o `v1.2`), se publica con su propia huella y se archiva
   con el mismo script.
2. La base guarda el texto de **cada** versión publicada
   (`gh_firma_acuerdo_versiones.texto` + `texto_hash`), así que el texto
   histórico ya sobrevive a la publicación de la v1.1.
3. Los consentimientos **ya aceptados** no se tocan: guardan la versión y la
   huella que aceptaron (12.7). Es lo que dice el 9.5.
4. El **Acuerdo DEV** no se siembra en una base donde se publicará el legal
   (H-TC-06).

---

## 2. Publicar la v1.1 (lo que falta y en qué orden)

> La lista de la 11A **ya está cerrada y con los textos redactados** por el dictamen legal del
> 2026-10-20: ver
> [`propuestas-texto-11A-2026-10-20.md`](./propuestas-texto-11A-2026-10-20.md).

| Orden | Qué | Quién | Estado |
|---|---|---|---|
| 1 | **10.4** — el camino positivo del 9.5 (el trabajador lee y acepta la versión vigente en el momento de la firma) | código | **hecho** (verificado en vivo) |
| 2 | **D-02** — el OTP (dato de creación) a un medio personal; rechazo del buzón corporativo (el 3.7(a) y el 47.4 num. 1) | código | **hecho**. Quién declara el medio: **la Empresa** (decisión del owner, 2026-10-20); el mini-app lo deja igual como respaldo. El rechazo se enciende **con la v1.1** (opción (ii)), no antes |
| 3 | **`conservacion_por_deber_legal`** + `norma_conservacion` — la declaración por la que el 2.2.1.1.12 deja de ser letra muerta | código | **hecho** (decisión 1.1) |
| 4 | **9A** — papel, medios autorizados, copia permanente, canal de datos de K+AIR y registro de solicitudes, suministro a autoridades | código | **hecho** (el papel, los medios y el 8.4). El papel **no** aparece en la mini-app (decisión del owner, 2026-10-20): la vía la ofrece el correo de la Empresa y la registra K+AIR |
| 5 | **Migración 028** — el registro de solicitudes del titular (10.7(b)) y su historial append-only | código | **hecho** (decisión 1.3) |
| 6 | **11A** — el texto, **con el abogado**: los 12 grupos de numerales de la lista cerrada (T1, §4 vs §8, T5, Cap. IV, Cap. V, 3.8, huellas, tokens, copia/conservación, auditoría/purga, datos personales, ley aplicable) | abogado | pendiente |
| 7 | **Anexo de Nube** (9 bloques) + **Compuerta 0.6** (hosting y proveedor de correo) | abogado + owner | pendiente |
| 8 | **11B** — el resto (v1.2) | abogado | pendiente |
| 9 | Publicar (v1.1 o v1.2) | owner | bloqueado por 1–8 |

### 2.1 La secuencia de PUBLICACIÓN (corregida por el owner el 2026-10-20)

El orden de la tabla de arriba es el orden de **código**. El orden en que se
**publica** es otro, y lo fijó el owner el 2026-10-20 al rearmar el D-02:

```
1. El código del D-02 (ya está hecho)
2. La 9A (la firma en papel)                  <- es la que hace posible el punto 4
3. La 11A con el abogado (el texto del 3.7(a) y del 3.1)
4. ACTIVAR el rechazo (FIRMA_EXIGIR_MEDIO_PERSONAL_OTP=true)
```

**El desacople (decisión del owner, 2026-10-20)**: el **inventario decide la
bandera, no el texto**. El 3.7(a) dice cuál es el método («el OTP va a un medio
personal que la Empresa no administre»): eso es cierto con el código de hoy, con
independencia de cuántas solicitudes caigan en el respaldo. Publicar el texto no
depende del número; lo que el número decide es si el sistema lo **exige**
(bandera encendida) o solo lo **recomienda** (bandera apagada + el inventario).

**La bandera se enciende con la v1.1 (opción (ii))**, no antes. Antes solo con
evidencia de las DOS cosas: que la T1 diga que ya se firmó con trabajadores reales
y que haya evidencia de que una Empresa leyó un OTP. Encenderla sin las dos es
preventivo sin motivo. Y la opción (i) («nunca encenderla») queda descartada: si la
11A publica el 3.7(a) duro y el sistema no lo exige, el texto promete más que el
código.

**Condición nueva para encender el rechazo (decisión del owner, 2026-10-20)**:
la vía en papel **no** está en la mini-app (el producto no puede prometer en
nombre de la Empresa lo que la Empresa hará). La puerta es el **canal de
atención de la Empresa**. Por eso, para encender el D-2, la Empresa tiene que
tener **declarado su canal** (la columna `canal_pqrs` de la ficha), que es el que
viaja en el `details.canal_empresa` del 400. Sin canal declarado, el 400 le
estaría diciendo al Trabajador que le pida el papel a una Empresa que no tiene
puerta por donde pedirlo.

**Por qué este orden y no el de la tabla**: sin la 9A, exigir un medio personal
para el OTP es una **barrera de acceso al empleo** (el 2.2.1.1.11 dice que la
imposibilidad de firmar electrónicamente no puede serlo). Y el texto no puede
publicarse antes que el papel: si el 3.7(a) dice «el código va a un medio
personal» y no hay una vía en papel, el documento miente. Por eso el
rechazo está en el código pero **apagado** (`FIRMA_EXIGIR_MEDIO_PERSONAL_OTP`,
default false).

**Regla dura**: sin 10.4 y sin la firma del abogado, **no se publica**. Y si
el servicio ya está operando, la **T1** es *stop-the-line* (ver §4.2).

**Lo que el dictamen legal sugiere cambiar en el alcance (aún NO implementado):**
el bloqueo del D-03 debería cubrir **también** el *commit* de la firma y la
**creación del consentimiento** (no solo la creación de la solicitud), con un
solo helper. Es la decisión 0.3 del plan.

---

## 3. Las cinco decisiones abiertas

### 3.1 (a) El backfill de la copia de empresa: ¿evento en la base o solo recibo?

**Situación**: hoy el backfill (`scripts/recifrar-empresa-snapshot.js`) deja un
**recibo JSON** con el detalle por fila, pero **no** escribe en la base. La
tabla `gh_consentimientos_eventos` existe (migración 010) y es la que usan los
eventos de consentimiento; `gh_firma_eventos` no sirve porque exige `firma_id`
y el consentimiento no tiene firma a la cual colgarlo.

**Decisión (D-14)**: **sí hay evento en la base**, uno por fila re-cifrada, con
el nombre `CONSENT_SNAPSHOT_RECIFRADO` (misma convención que
`CONSENT_EXPIRED` / `CONSENT_OTP_SENT`). **Implementado hoy.**

- Por qué: el recibo es un archivo en el disco del operador: se pierde, se
  copia, se borra. La base es donde vive el resto de la prueba. Un re-cifrado
  que cambia lo que el firmante vio **tiene** que quedar registrado donde el
  resto de la evidencia vive.
- Qué lleva: `consent_id`, `evento`, `fecha_hora`, `id_actor` (el `--actor` que
  ya se exige), y en `metadata`: el motivo, la huella del JSON en claro (que
  **no** cambia: lo que cambia es el sobre), la versión de llave con la que
  quedó el sobre y el nombre del script.
- Qué **no** lleva: el número del representante (ni en claro ni de forma
  derivable). El test lo comprueba.
- Se escribe **dentro de la misma transacción** que el `UPDATE` de la fila: si
  el evento no se puede escribir, la fila no se toca.
- Es **renombrable**: si el abogado o el owner prefiere otra etiqueta, se
  cambia en un solo lugar y se vuelve a archivar. Lo que no se negocia es que
  el evento exista.
- **Pendiente (migración 028, Compuerta 0)**: la tabla de eventos de
  consentimiento **no es append-only** (ver §3.6). Hoy el evento se puede
  borrar con un UPDATE o un DELETE. Eso es una tarea aparte, con el patrón
  `@skip-when-env test` de las migraciones 020 y 025.

### 3.2 (b) `empresa_hash`: SHA-256 sin sal del JSON canónico en claro

**Situación**: la huella de la identificación de la empresa que se muestra en
la mini-app y se imprime en la constancia es el **SHA-256 del JSON canónico en
claro** (`hashSnapshotEmpresa`). Sobre ese JSON hay un campo con el **número
completo** del representante legal.

- Es un **oráculo offline de baja entropía**: quien tenga la huella (que sale
  en el PDF que recibe el firmante y que puede fotografiar) puede confirmar
  candidatos ("¿este NIT con este representante da esta huella?").
- Pero la **constancia decía** (texto literal, `services/pdfGen.js`): *"la
  huella se calcula sobre la identificación en claro y solo puede recalcularse
  con la llave del servicio"*. Con SHA-256 eso **es falso**: se recalcula sin
  llave, con una calculadora.
- Y el **1.2 del Acuerdo** dice que la identificación de la empresa "se
  incorpora a la constancia de firma con su propia huella digital", sin
  especificar el algoritmo (el 9.3 sí dice SHA-256, pero para el **texto del
  Acuerdo**, que es otra cosa).

**Decisión (D-15)**: **se conserva el SHA-256** y se corrige el texto que
miente. **El texto de la constancia ya quedó corregido hoy.**

- Por qué no cambiar el algoritmo ahora:
  1. **La columna `empresa_hash` no tiene marcador de algoritmo.** A diferencia
     de las demás huellas persistentes (`id_trabajador_alg`, `correo_alg`,
     `otp_alg`, `identificacion_numero_alg`), no hay `empresa_hash_alg`: las
     filas viejas (SHA-256) y las nuevas (HMAC) serían **indistinguibles**
     (ambas son hex de 64 caracteres).
  2. Cambiarlo rompería **la verificación de la presentación**: el HMAC de una
     fila vieja no cuadraría nunca y el documento del representante
     desaparecería de todas las constancias históricas ("No disponible").
  3. Rompería **el backfill**: su premisa es que la huella sigue cuadrando, y
     re-hashear una fila ya archivada es **reescribir evidencia de lo que el
     firmante vio**: una operación irreversible sobre prueba.
  4. El riesgo real es **menor** de lo que parece: el firmante **ya ve** el
     número completo del representante en el bloque del 1.2 (es deliberado: el
     1.2 existe para que el Trabajador pueda contrastar contra el registro
     mercantil), de modo que la huella no revela nada que la propia pantalla
     no enseñe. Lo que sí es intolerable es que la constancia afirme una
     propiedad criptográfica que no tiene.
- **Qué se hizo hoy** (código, sin riesgo):
  1. **El texto de la constancia corregido** para que sea cierto: ahora dice
     que la huella (SHA-256) se calcula sobre la identificación de la Empresa
     en claro, **incluido el documento completo del representante legal, que no
     se imprime en esa constancia**, y que solo quien conozca esa
     identificación completa puede recalcular la huella y compararla.
  2. El **comentario del código** que explicaba la frase vieja quedó
     reemplazado por la explicación de por qué la frase anterior era falsa.
- **Qué queda abierto** (para el 11A con el abogado):
  1. Si se quiere pasar a HMAC (con ámbito de empresa), hace falta **una
     migración 028** que añada `empresa_hash_alg` y **verificación dual** en
     `parseSnapshotParaMostrar`, más la política de qué se hace con las filas
     viejas. Es un paquete propio, con su Gate 0.
  2. **Asimetría que hay que escribir**: la mini-app muestra la huella de la
     fila **viva** de la empresa (`publicViewFor`) y la constancia imprime la
     de la copia **archivada**. Si la Empresa cambia sus datos entre la
     creación del consentimiento y la firma, **son dos huellas distintas** y
     el firmante ve "la de hoy". El 1.2 habla de "la misma" identificación
     en los dos sitios: eso hay que decirlo en el texto o arreglarlo en el
     código.

### 3.3 (c) `publicViewFor()` muestra el número completo del representante

**Situación**: el bloque "Empresa que solicita tu firma" de la mini-app
muestra el **número completo** del representante legal. Eso viene del
**registro mercantil vivo** (`gh_firma_empresas`), **no** de la copia
archivada del consentimiento (que es la que va cifrada desde la 8B-C). Es
deliberado y está documentado en la API 1.2: el Trabajador debe poder
contrastar la identidad de la Empresa con el registro mercantil.

**Decisión (D-16)**: **se mantiene**, y se deja explícita la distinción.

- Por qué: el 1.2 es una_cláusula de **transparencia en favor del
  Trabajador**, y el 10.5(a) ("el número de identidad **del Trabajador** se
  compara mediante huella con sal y se conserva únicamente esa huella") se
  refiere al **Trabajador**, no al representante de la Empresa. El número del
  representante es, además, **dato público** (registro mercantil).
- **Verificado en el código** (no es una impresión):
  - `publicViewFor()` → `buildSnapshot()` → `getActiva()` → `getById()` →
    `SELECT ... FROM gh_firma_empresas`. La fila **viva** del directorio, en
    claro. **Nunca** lee la copia archivada del consentimiento.
  - El número completo sale por **exactamente dos superficies**: el contexto
    público de la mini-app (`GET /s/{token}`) y la API de administración
    (`GET /internal/admin/empresas[/:id]`, con `X-Admin-API-Key`).
  - **Ningún PDF imprime el número completo**: la constancia simple, la
    consolidada, el PDF de firma y la verificación pública lo enmascaran
    (`****3456`) o no lo muestran. La constancia consolidada solo imprime el
    **nombre** del representante.
- Lo que hay que hacer: que la distinción quede escrita, porque hoy está
  implícita en el código y en un documento técnico (API 1.2), no en el
  documento que el firmante lee. Y que **no** se confunda con la copia del
  consentimiento, que sí va cifrada y de la que solo se muestran los últimos
  4.
- **Lo que el owner tiene que decidir** (no se decide en el código): la
  **asimetría** entre los dos sitios. El 1.2 dice que la identificación "se
  muestra al Firmante [...] y se incorpora a la constancia", como si fuera el
  mismo dato. Hoy la mini-app muestra el número **completo** y la constancia
  los **últimos 4**. Es una diferencia deliberada (la constancia es un
  documento que se archiva y se puede compartir), pero el texto debería
  decirlo.
- Riesgo residual: si la Empresa cargara en el registro un documento que no
  es el del registro mercantil, el Trabajador vería un número que no puede
  contrastar. El 1.2 ya dice que "puede solicitar a la Empresa los datos que
  allí no figuren".

### 3.4 (d) D-03 — bloquear la firma sin Anexo firmado o sin plazo declarado

**Situación**: hoy se puede solicitar y obtainer una firma de una empresa que
**no** tiene Anexo de Encargo firmado (`anexo_encargo_firmado_at`) ni plazo
de conservación declarado (`plazo_retencion_dias`). El 1.4 del Acuerdo dice
que la relación entre la Empresa y K+AIR se rige por el Anexo de Encargo, y
el 8.6 obliga a la Empresa a comunicar el plazo **antes** de pedir la firma:
sin plazo declarado, el 8.6 no se puede cumplir, y el 10.6 deja la
conservación sin plazo y la supresión sin fecha.

**Decisión (D-17)**: **bloquear con 409 explicable**, con transición
documentada y sin default silencioso. **Implementado hoy.**

- El bloqueo va en la **creación de la solicitud de firma** (no en el
  commit): si la Empresa no está habilitada, la solicitud ni se crea. El
  mensaje dice **qué falta** y **dónde se resuelve** (el endpoint admin
  `/internal/admin/empresas/:id/anexo-firmado` y el plazo en
  `PUT /internal/admin/empresas/:id`).
- Se comprueban **dos** cosas: el **Anexo de Encargo** firmado (1.4) y el
  **plazo de conservación declarado** (8.6). Sin plazo no hay fecha de
  conservación y la firma se conservaría de forma indefinida.
- Una empresa **no registrada no se bloquea**: eso es otro problema
  (identificación incompleta) y se atiende por el alta.
- **La transición** (esto es lo que la hace defendible):
  1. Un **inventario** de qué empresas están en ese estado, antes de activar
     el bloqueo (`scripts/inventario-empresas-no-habilitadas.js`, solo
     lectura: cuántas están y cuántas firmas tiene cada una).
  2. El bloqueo se activa con una **bandera** explícita
     (`FIRMA_EXIGIR_HABILITACION_EMPRESA`; default: **bloquea**), y con ella
     apagada el sistema **avisa en el log** cada vez que deja pasar una firma
     sin habilitación, con código: no es un default silencioso, es un default
     ruidoso.
     > **Obsoleto desde el 23-oct-2026 (📦933).** La bandera se retiró: el bloqueo
     > es incondicional y la única salida es la **excepción auditable**
     > (`POST /internal/admin/excepciones-habilitacion`), que exige autorización
     > escrita, alcance de firmas, ruta en papel operativa y un plazo cierto.
  3. Aviso a las Empresas afectadas antes de activarlo.
- **No** se hace en producción sin: el inventario, el aviso, y el "dale" del
  owner. El estado real de los clientes de producción **no está confirmado**:
  hay que confirmarlo antes.
- **Lo que el owner tiene que decidir** (no se decide en el código): el
  alcance. Hoy el bloqueo está **solo en la creación de la solicitud**:
  - el **commit** de la firma no re-valida la habilitación (la Empresa pudo
    dar de baja su Anexo entre la creación y la firma);
  - la **creación del consentimiento** tampoco lo valida (una empresa no
    habilitada puede tener consentimiento y no firma: es inocuo);
  - el **hijo de la firma dual** (`createForCompany()`) no lo valida (pero su
    padre sí pasa por el bloqueo, así que queda cubierto indirectamente).

  La decisión es: ¿bloquear en la creación (lo de hoy), o también en el
  commit?

### 3.5 (e) `numeroEnmascarado()` no distingue "no hay dato" de "falló el descifrado"

**Situación**: el helper devuelve `null` en los dos casos, y el PDF imprime
"No disponible" en los dos. Un `null` por "la empresa no declaró documento" y
un `null` por "la llave de la llave maestra salió del anillo" son
**incidentes distintos**, y el segundo es una pérdida de datos en curso.

**Decisión (D-18)**: el helper **devuelve el motivo** y el log distingue.
**Implementado hoy.**

- Nuevo `estadoEnmascarado(snapshot, id_empresa)` → `{ estado: 'dato' |
  'sin_dato' | 'error', valor, error }`.
- `numeroEnmascarado()` se mantiene (no se rompe ningún llamador) pero
  delegates en el nuevo: cuando el estado es `error` deja de ser un `null`
  silencioso y queda un `logger.error` con código
  `REPRESENTANTE_NO_DESCIFRABLE`.
- El **texto del PDF no cambia** ("No disponible"): cambiarlo es un cambio de
  contenido de la constancia, y eso lo revisa el abogado. Lo que cambia es que
  el operador **se entera**.
- Extensión: el script `recifrar-representante.js` ya no imprime `****` cuando
  el descifrado falla (eso confundía un incidente con un dato vacío): ahora
  dice `(no se pudo leer)` o `(sin dato)`.
- **Lo que queda pendiente** (para el 11A o para un paquete aparte): la
  constancia consolidada sigue diciendo "No disponible" en los dos casos
  (`pdfGenConsolidado.identificacionFirmanteEmpresa()`). Se puede distinguir
  con `estadoEnmascarado`, pero **cambiar el texto de una constancia es del
  abogado**.

### 3.6 Lo que salió de la investigación y NO se decidió hoy

| Hallazgo | Qué es | Por qué no se hizo |
|---|---|---|
| `gh_consentimientos_eventos` **no es append-only** | Los triggers de la 020/025 protegen `gh_firma_eventos`, `gh_firma_purga_log`, `gh_firma_purga_registro` y `gh_firma_purgadas`. La tabla de eventos de **consentimiento** no tiene ninguno: un UPDATE o DELETE sobre un evento de consentimiento no lo detiene la base de datos | Es una **migración nueva (028)** con el patrón `@skip-when-env test` + una prueba aparte (como la 020 y la 025). Y toca la Compuerta 0 |
| `empresa_hash` sin columna `*_alg` | Las filas viejas (SHA-256) y las nuevas (HMAC) serían indistinguibles | Ver §3.2: exigiría migración 028 + verificación dual |
| La **asimetría** mini-app ↔ constancia (completo vs últimos 4) y la **huella viva vs archivada** | Dos diferencias bajo el mismo numeral 1.2 | Es una decisión de texto (11A) |
| El **alcance** del D-03 (¿solo creación, o también commit?) | Ver §3.4 | Decisión del owner |

---

## 4. Lo que sigue bloqueado

### 4.1 Compuerta 0 y backfill en producción

El backfill está **probado en local** (prueba manual I-107 del 2026-10-20, con
la copia cifrada, la huella cuadrando, el sobre que no abre con otra empresa y
la presentación que falla cerrada con el sobre alterado). **No se ejecuta en
producción** sin: Compuerta 0 en verde sobre copia restaurada, hold legal,
backup validado, recibo y el "dale" del owner.

### 4.2 T1 — el servicio en la nube y los documentos publicados

El Acuerdo describe un mecanismo **local**; el servicio corre **en la nube**
(Gesstiar). Si el servicio **ya está operando**, esto es *stop-the-line*:
seguir obteniendo firmas con un texto que dice otra cosa es el riesgo que más
daño hace y el que menos cuesta cerrar. Si **no** está operando, no se
publica ni se lanza hasta cerrar la 11A con el abogado.

**Esto no se puede decidir desde el código**: depende de si hay firmas
reales. Hay que confirmarlo.

### 4.3 Lo que sigue esperando al abogado

- La 11A (y la 11B) con firma.
- El 10.8: la 8B ya tiene la mecánica completa, pero el texto tiene que
  decir exactamente eso.
- La frase de la constancia sobre la huella (§3.2, punto 1): es contenido de
  una constancia.

---

## 5. Secuencia

```
HECHO  1. (e) numeroEnmascarado con estado            <- código, sin riesgo
HECHO  2. (a) evento CONSENT_SNAPSHOT_RECIFRADO        <- código, sin riesgo
HECHO  3. (d) D-03: inventario + 409 explicable        <- código; activar en prod = Compuerta 0
HECHO  4. (b) corregir la frase de la constancia       <- la frase era falsa; ya está corregida
HECHO  5. 10.4 (camino positivo del 9.5)        <- hecho; la solicitud migra a la versión vigente
HECHO  6. D-02: el OTP a un medio personal        <- código hecho; el rechazo sigue APAGADO
HECHO  7. 1.1 deber legal de conservación       <- por empresa + hold legal automático
HECHO  8. 1.3 segundo canal + registro de solicitudes  <- 10.7(b) con historial append-only
HECHO  9. 1.2 la firma visual se rechaza con 400     <- el rechazo es explícito, no silencioso
PENDIENTE
        10. (c) escribir la distinción 1.2 / 10.5(a)    <- va en la 11A
HECHO 10. 9A: el papel (7.1-7.3), los medios (8.2) y el 8.4
PENDIENTE
        11. (lo que falta de la 9A) la UI de escritorio de la firma en papel
        12. 11A con el abogado (H-TC-01..19 incluidas)   <- abogado
        13. Publicar v1.1/v1.2                           <- owner
        14. Activar el rechazo del D-02                 <- solo cuando la 9A exista
```

### Las consultas del 2026-10-20 que ordenaron el trabajo

- [`consulta-legal-firma-en-papel-interfaz-2026-10-20.md`](./consulta-legal-firma-en-papel-interfaz-2026-10-20.md):
  **ninguna norma exige que el Acuerdo mencione el botón de «firmarlo en papel»**,
  ni que exista un botón. El botón es la **evidencia** de que el derecho del 7.2-7.3 es
  ejercitable, y lo que el 2.2.1.1.11 prohibe es el **condicionamiento** (la
  imposibilidad de firmar electrónicamente no puede ser barrera de acceso al empleo).
  De ahí el `PAPER_OPTION_AVAILABLE`: el evento de la petición no prueba la
  disponibilidad de la opción, y esa es justo la pregunta que hace un Inspector.
- [`comparacion-mercado-firma-2026-10-20.md`](./comparacion-mercado-firma-2026-10-20.md):
  **Buk (el competidor local) no tiene vía en papel**: su modal solo ofrece
  Cancelar / Rechazar / Firmar, y su propio artículo admite que sin el rechazo el
  documento se quedaba pendiente para siempre. El mercado global (DocuSign, Adobe)
  resuelve el D-02 **cambiando el dato de entrada** (la Empresa escribe el correo
  personal del trabajador), no separando los canales. K+AIR va por delante en los dos
  puntos que la ley exige en la práctica.

### Lo que se hizo el 2026-10-20 (resumen verificable)

| Qué | Dónde | Prueba |
|---|---|---|
| La v1.0 archivada (huella sellada, guardas contra el texto editado y contra la colisión con el Acuerdo DEV) | `scripts/archivar-acuerdo.js` + `scripts/fixtures/acuerdo-ARCHIVO.json` | Ejecutado; las dos guardas disparan |
| (e) `estadoEnmascarado` + log de error con código | `src/services/representante.js` | `tests/fase8b-representante-cifrado.test.js` (3 casos) |
| (a) Evento `CONSENT_SNAPSHOT_RECIFRADO` por fila, en la misma transacción | `scripts/recifrar-empresa-snapshot.js` | `tests/scripts/recifrar-empresa-snapshot.test.js` |
| (d) 409 `EMPRESA_NO_HABILITADA` + inventario + bandera de transición | `src/services/empresa.js`, `src/services/signRequest.js`, `src/config.js`, `scripts/inventario-empresas-no-habilitadas.js` | `tests/d03-habilitacion-empresa.test.js` (6 casos) |
| (b) La constancia ya no afirma una propiedad criptográfica falsa | `src/services/pdfGen.js` | Prueba manual I-107 |
| El re-cifrado del representante no confunde un fallo con un dato vacío | `scripts/recifrar-representante.js` | `tests/scripts/recifrar-representante.test.js` |
| Aislamiento: `resetDb()` limpia también el directorio de empresas | `tests/helpers.js` | Suite completa |
| **1.2** La firma visual **se rechaza con un 400 que la nombra** (`FIRMA_VISUAL_NO_ADMITIDA`), y el body del commit es estricto | `src/routes/public.js` | `tests/` (suite) |
| **1.1** `conservacion_por_deber_legal` **por empresa** + hold legal automático + efecto en la 5B + el Trabajador se entera (mini-app y correo) | migración `030`, `src/services/empresa.js`, `src/services/conservacion.js`, `src/services/mailer.js`, `web/firma/app.js` | `tests/conservacion-deber-legal.test.js` (10 casos) |
| **1.3** Segundo canal (protección de datos), registro de solicitudes, trasmisión, evidencia y plazo por config | migración `028` + `029`, `src/services/solicitudes.js`, `src/routes/admin-solicitudes.js`, `src/config.js` | `tests/solicitudes-titular.test.js` (13 casos) |
| **10.4** El **camino positivo del 9.5**: el firmante ve la versión vigente y, al aceptar, la solicitud **migra** a ella (con evento `AGREEMENT_VERSION_MIGRATED`). Sin esto, publicar la v1.1 dejaba enlaces colgados en un 409 sin salida | `src/services/publicFlow.js`, `src/routes/public.js`, `web/firma/app.js` | `tests/fase10-4-version-vigente.test.js` (5 casos) + verificado en vivo |
| **9A** La **firma en papel** (el 7.1-7.3): el Trabajador la pide desde la mini-app en cualquier momento, queda asentada, y la Empresa registra el documento ya firmado (con su huella y su **Registro de firma autográfica**), que es la evidencia del acto. El **registro de medios autorizados** (el 8.2) y el **suministro a autoridades** (el 8.4) | migración `032`, `src/services/{medios,papel,pdfGenPapel}.js`, `src/services/publicFlow.js`, `src/routes/{public,signRequest}.js`, `web/firma/` | `tests/n9a-medios-y-papel.test.js` (11 casos) + verificado en vivo en la mini-app |
| **D-02** El **OTP (dato de creación) va a un medio personal** declarado por el propio Trabajador; la invitación y la copia firmada siguen yendo al contacto registrado por la Empresa. El rechazo (400 `MEDIO_OTP_CORPORATIVO`, con el texto del 3.7(a) y el 47.4 al lado) queda **APAGADO** hasta que exista la 9A | migración `031`, `src/services/publicFlow.js` (`resolveCorreoOtp`, `declararMedioOtp`), `src/services/empresa.js` (`dominiosCorporativos`), `src/routes/public.js` (`POST /api/sign/:token/medio`), `src/config.js`, `web/firma/`, `modules/gestion-humana/firma-electronica/index.js` (el rótulo), `scripts/inventario-buzon-corporativo.js` | `tests/d02-medio-otp.test.js` (8 casos) |
| **D-02 (quién declara)** Quién declara el medio personal del código: **la Empresa** (decisión del owner, 2026-10-20). Lo declara en K+AIR al crear la solicitud (campo `correo_otp`), y queda en la fila congelado. El mini-app lo deja igual como respaldo (si la Empresa no lo tiene, lo declara el Trabajador al identificarse). Con eso, la bandera `FIRMA_EXIGIR_MEDIO_PERSONAL_OTP` puede encenderse con la v1.1 sin romper el flujo | `src/services/signRequest.js`, `src/routes/signRequest.js`, `src/services/medios.js`, `modules/gestion-humana/firma-electronica/index.js` (el campo del modal) | `tests/d02-medio-otp.test.js` (9 casos) |
| **`canal_pqrs` es un requisito de habilitación** (decisión del owner, 2026-10-20): sin canal de atención, el 400 del D-2 le dice al Trabajador «pedile a tu Empresa la firma en papel» y no hay puerta por dónde pedirla (el mismo error que el 409 sin salida que la 10.4 vino a matar). El override es el del D-03 (la bandera + el WARN con código + el inventario) | `src/services/empresa.js` (`verificarHabilitacionFirma`) | `tests/d03-habilitacion-empresa.test.js` (9 casos) |
| **La OFERTA de la vía en papel, asentada**: el evento `PAPER_OPTION_AVAILABLE` (con la huella SHA-256 de la mini-app servida) deja constancia de que el Trabajador **vio** la opción, no solo de que la pidió. Ninguna norma lo exige: es lo que sostiene la posición de la Empresa frente a un Inspector (2.2.1.1.15). Sin IP ni user-agent (minimización: no es una manifestación) | `src/services/publicFlow.js` (`registrarOpcionPapelDisponible`, `hashUiMiniApp`), `src/routes/public.js`, `src/services/signRequest.js`, `src/services/mailer.js` | `tests/n9a-medios-y-papel.test.js` (13 casos) |
| **El correo de invitación ofrece la vía en papel**: es el primer contacto con el Trabajador; si la opción solo existiera en la mini-app, un Inspector miraría primero el correo | `src/services/mailer.js` | `tests/n9a-medios-y-papel.test.js` |
| **El papel atado al documento original**: la pareja de huellas (el original y el firmado a mano) + el id del documento en el Registro de firma autográfica. El papel firmado NO puede tener la misma huella que el original, así que el vínculo tiene que ser expréso | `src/services/pdfGenPapel.js`, `src/services/publicFlow.js` | `tests/n9a-medios-y-papel.test.js` |
