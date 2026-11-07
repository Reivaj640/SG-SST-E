# Plan · Suscripción digital del Anexo de Encargo (vía de autoservicio)

**Fecha:** 6 de noviembre de 2026
**Estado:** decisiones 1, 2 y 4 tomadas por el owner el 6-nov-2026; la 3 quedó
resuelta por la restricción; falta la validación del abogado (decisión 5)
**Origen:** el owner pidió que el Anexo de Encargo se suscriba como el Anexo de
Nube —enlace de un solo uso, código de verificación y rastro—, en vez del
circuito físico (imprimir, firmar, escanear y registrar la fecha a mano).

---

## 1. La respuesta corta

**Sí se puede, y el espejo casi ya existe.** El Anexo de Nube v1.1 se suscribió
el 5-nov-2026 por ese camino, con el resultado real a la vista: suscripción id 1,
ASEPLUS CARIBE S.A.S., estado `FIRMADA`, `2026-11-05T22:51:34.349Z`, con cinco
eventos de rastro y la fila de auditoría de la ficha de la empresa.

Pero el Anexo de Encargo **no es el mismo instrumento** y por eso el plan no es
un calco: hay cuatro diferencias que hay que resolver antes de escribir código,
y dos decisiones que son del owner y del abogado, no del código.

Lo bueno: **el texto del Anexo de Encargo no exige firma autógrafa.** Se verificó
en el texto vigente (`legal/anexo-encargo.html`, sha256 `5cc7a346…`): no dice
"autógrafa", ni "manuscrita", ni "notarial", ni exige firma en papel para el
Anexo mismo. La única mención de un código de verificación es la del **OTP del
Trabajador** (el 7.2-7.3 y el D-02), que es otro cosa. Y el §12 del propio Anexo
redacta la firma en términos que una suscripción digital satisface en sustancia
("Al firmar, ambas partes manifiestan haber leído este anexo y aceptan sus
condiciones").

---

## 2. Lo que ya existe y hay que replicar

El espejo está completo y medido. Estos son los archivos, con su tamaño real:

| Pieza | Ruta | Bytes |
|---|---|---|
| El servicio | `sgsst-electron-app/firma-service/src/services/anexoNube.js` | 27 003 |
| Las rutas | `sgsst-electron-app/firma-service/src/routes/anexoNube.js` | 5 981 |
| La pantalla | `sgsst-electron-app/firma-service/web/anexo-nube/{index.html,app.js,styles.css}` | 4 142 / 5 769 / 4 028 |
| La migración | `src/db/schema/054_anexo_nube_suscripcion.sql` | — |
| El rastro inalterable | `src/db/schema/055_anexo_nube_eventos_append_only.sql` | — |
| El preflight | `scripts/preflight-anexo-nube.js` | 7 672 |
| Los tests | `tests/anexo-nube-suscripcion.test.js` (21 tests) + `tests/routes/anexo-nube-documento.test.js` + `tests/routes/anexo-nube-pagina.test.js` | 20 652 / 2 738 / 8 276 |

### Las siete propiedades de seguridad de ese flujo

Son la razón por la que la vía es "igual de segura" que el circuito físico. El
plan replica las siete, una por una:

1. **El enlace es la credencial y es de un solo uso.** En la base solo vive su
   HMAC (`token_hash`), nunca el enlace en claro. Caduca a las 72 horas
   (`TTL_ENLACE_HORAS`) y admite 5 envíos de código como máximo
   (`MAX_ENVIOS_CODIGO`).
2. **El enlace no habilita la firma.** Además del código de verificación al
   correo del firmante, hace falta la aceptación expresa.
3. **El código no se guarda en claro** (HMAC con el ámbito de la empresa,
   `src/crypto/otp.js`), expira con el TTL del config y tiene intentos
   limitados: se bloquea la suscripción.
4. **La aceptación expresa es obligatoria**: sin `acepta: true` no hay firma
   (`ACEPTACION_REQUERIDA`).
5. **Lo que la empresa lee es lo que firma.** El texto se sirve **desde el
   servidor**, no desde el sitio público, para que no existan dos copias: la
   que la empresa lee y la cuya huella registra el servicio son los mismos
   bytes. Es la razón de ser de la ruta `GET /anexo-nube/documento`.
6. **`TEXTO_MODIFICADO` (409).** Si el texto cambió entre abrir la suscripción
   y firmar, no se firma: hay que abrir una suscripción nueva con la versión
   vigente. Se comprueba al pedir el código y otra vez al firmar.
7. **El rastro es inalterable.** `gh_firma_anexo_nube_eventos` tiene triggers de
   no-borrar (migración 055, en su propia migración porque `resetDb()` no puede
   vaciar una tabla con trigger). Además, la firma escribe en el rastro de la
   ficha de la empresa (`gh_firma_empresas_auditoria`) con el valor anterior, el
   nuevo, quién lo registró, su IP, su navegador y el motivo.

### Los códigos de error que ya funcionan

`ENLACE_NO_VALIDO` (404), `ENLACE_ANULADO` (410), `ENLACE_EXPIRADO` (410),
`ENLACE_BLOQUEADO` (429), `YA_SUSCRITO` (409), `EMPRESA_NOT_FOUND` (404),
`EMPRESA_INACTIVA` (409), `ANEXO_NUBE_NO_DISPONIBLE` (503), `ENVIO_FALLIDO` (502),
`TEXTO_MODIFICADO` (409), `ACEPTACION_REQUERIDA` (400), `CODIGO_NO_SOLICITADO`
(400), `CODIGO_EXPIRADO` (400), `CODIGO_INVALIDO` (400), `CODIGO_BLOQUEADO`
(429), `LIMITE_ENVIOS` (429), `SUSCRIPCION_EXISTENTE` (409),
`MOTIVO_REQUERIDO` (400). El espejo los reutiliza con el nombre del instrumento
cambiado.

---

## 3. Las cuatro diferencias (esto es lo que hay que resolver)

### 3.1 Son dos partes: la Empresa y K+AIR

El §12 del Anexo de Encargo tiene **dos** bloques de firma: "Por el responsable
(empresa cliente)" y "Por el encargador (Gesstiar S.A.S.)". El flujo del Anexo de
Nube es de **una sola parte**: la Empresa suscribe y ya.

Eso obliga a decidir qué significa "firmado" en el manifiesto:

- **DECISIÓN 1 (owner, 6-nov-2026): DOS FASES.** El Anexo de Encargo se
  declara "firmado" cuando estén **los dos actos**: la suscripción de la
  Empresa (fase 1) y la contrafirma del Encargado (fase 2). Mientras no haya
  contrafirma registrada, el manifiesto **no** puede decir `estado: "firmado"`:
  sería una afirmación falsa sobre un contrato bilateral.
  - *Fase 1:* la Empresa se suscribe. Eso ya destraba lo técnico (el requisito
    de `verificarHabilitacionFirma` y los dos ítems del gate).
  - *Fase 2:* el Encargado contrafirma en el servicio, con el mismo cuidado del
    OTP, y el acta registra los dos actos.
  - Lo que se escribe en el manifiesto es la evidencia de **los dos**, con la
    fecha de cada uno.

### 3.2 El §11 lo diligencia la Empresa

El Anexo de Encargo tiene cinco huecos de identificación del Responsable en el
§11 ("Datos de contacto de las partes"): razón social, NIT/C.C., domicilio,
correo y representante. Un Anexo de Encargo firmado sin ellos es débil.

El **precedente ya establecido en el proyecto** está en el propio readiness: para
el Anexo de Nube, "los tres campos de la Empresa los llena cada Empresa en la
copia que firma: no se diligencian en el modelo". O sea: **el modelo se
suscribe con los huecos y cada Empresa los diligencia en SU copia.**

- **DECISIÓN 2 (owner, 6-nov-2026): la Empresa CONFIRMA O CORRIGE SUS DATOS en
  la pantalla, y el acta los lleva.** El texto canónico se suscribe **tal cual**,
  con sus cinco huecos del §11, con su huella. Los datos que la Empresa declara
  en la pantalla (prellenados con la ficha, editables) quedan en la fila de la
  suscripción, en el acta y en la evidencia. La copia con el §11 diligenciado la
  conserva la Empresa y K+AIR en el expediente.

  Encaja con el §12 del propio Anexo, que dice: "La versión y la huella SHA-256
  del texto de este Anexo que la Empresa firmará quedan escritas en el registro
  de la firma y en la Constancia que el servicio entrega: **son la huella del
  texto canónico que la Empresa aceptó, no la de una copia firmada.**" El
  servicio no renderiza el texto: no hay dos versiones en juego.

  Sigue pendiente de validación del abogado (DECISIÓN 5) que la sustitución de
  los cinco datos del §11 sea admisible en un contrato bilateral.

### 3.3 El manifiesto es global; la firma es por empresa

Hoy el gate lee dos cosas distintas del Anexo de Encargo:

- `anexo_encargo::estado_encargo` → el **manifiesto**
  (`legal-readiness.json` → `anexo_encargo.estado/fecha/evidencia`): una
  declaración global del instrumento.
- `anexo_encargo::empresas_base` → la **base**
  (`gh_firma_empresas.anexo_encargo_firmado_at`): la verdad por empresa.

El manifiesto hoy dice `estado: "no_firmado"`, `fecha: null`, `evidencia: null`,
`version: "2026-11-06"`, `hash: "5cc7a346…"`. Con el Anexo de Nube pasó algo que
hay que mirar de cerca: el manifiesto guarda la **evidencia de la suscripción de
una sola empresa** (ASEPLUS, la del 5-nov). Si el Anexo de Encargo se suscribe
por autoservicio, cada empresa nueva firmaría por su cuenta… y si eso exigiera
cambiar el manifiesto, sería **un deploy por empresa**, que es insostenible.

- **DECISIÓN 3 (resuelta por la restricción, no por el código).** ¿Dónde vive la
  verdad por empresa? **En la base**, y el manifiesto declara el instrumento.
  La razón es dura: si el manifiesto cambiara con cada empresa que firma,
  sería **un deploy por empresa**, y eso no es un flujo. Consecuencia: el gate
  **no cambia** — sigue leyendo el manifiesto para el instrumento
  (`estado_encargo`) y la base para cada empresa (`empresas_base`), como hoy.
  Es exactamente como funciona el Anexo de Nube, cuyo manifiesto guarda la
  evidencia de la suscripción de ASEPLUS del 5-nov.

### 3.4 El modelo del Anexo de Encargo se versiona por fecha y tiene generador

El Anexo de Nube tiene su versión fija en el código (`VERSION_MODELO = '1.1'`) y
su archivo con nombre versionado (`legal/anexo-nube-v1.1.html`). El Anexo de
Encargo es distinto:

- Su archivo es `legal/anexo-encargo.html` y su versión es una **fecha**
  (`2026-11-06`), no un número.
- Su etiqueta de versión **la pone un generador**
  (`scripts/generar-anexo-encargo.js`) desde la fuente
  `config/matriz-finalidades.json`, para que el documento y el manifiesto no
  puedan desalinearse. Ese generador se corre en cada cambio del bloque de
  instrucciones.

De ahí sale la **trampa central del plan** (ver §6.1): si el generador corre
después de abrir una suscripción, la huella del archivo cambia y la suscripción
viva muere con `TEXTO_MODIFICADO`.

**Consecuencia de diseño:** el servicio del Anexo de Encargo **no** puede tener
la versión en el código como el del Anexo de Nube. Tiene que leerla del
manifiesto (que es donde está la fuente: `anexo_encargo.version`) y comparar
**la huella del archivo en disco** con la del manifiesto, como hace el preflight.

---

## 4. Qué se construye

### 4.1 La base (migraciones 056 y 057)

`gh_firma_anexo_encargo_suscripciones`, espejo de la 054, con una fila por
intento:

```
id · id_empresa · token_hash (UNIQUE) · version · hash_texto
datos_empresa (JSON: los cinco del §11, tal como los declaró la Empresa)
correo_firmante · nombre_firmante · cargo_firmante
estado (PENDIENTE|CODIGO_ENVIADO|FIRMADA|EXPIRADA|BLOQUEADA|ANULADA)
otp_hash · otp_intentos · otp_envios · otp_enviado_at · enlace_abierto_at
expira_enlace_at · firmado_at · evidencia
ip_creacion · user_agent_creacion · ip_firma · user_agent_firma
contrafirmado_at · contrafirma_evidencia
creado_por · created_at · updated_at
```

`gh_firma_anexo_encargo_eventos`, con los triggers de inalterabilidad **en su
propia migración** (como la 055), porque el trigger impide que `resetDb()` vacíe
la tabla entre tests.

### 4.2 El servicio `src/services/anexoEncargo.js`

Espejo de `anexoNube.js` (27 KB) con cuatro diferencias:

1. La versión y la huella salen del **manifiesto**, y el texto sale del archivo
   `legal/anexo-encargo.html` del disco; la comparación de ambas contra la
   huella del manifiesto es la que hace el `TEXTO_MODIFICADO`.
2. Los **cinco datos del §11** se declaran en la pantalla y se registran.
3. Al suscribir, escribe en `gh_firma_empresas.anexo_encargo_suscrito_at` (con el
   rastro de la ficha) y en la fila de la suscripción, con la evidencia en JSON.
   **NO escribe `anexo_encargo_firmado_at`**: ese campo es la fecha de EJECUCIÓN
   del instrumento y lo escribe la contrafirma. Es el ajuste del abogado del
   7-nov-2026 (📦1028): la fase 1 deja constancia de un acto, no de un contrato
   ejecutado, y una Empresa que solo se suscribió no puede firmar documentos de sus
   trabajadores.
4. La fase 2: la contrafirma del Encargado (DECISIÓN 1), que sí escribe
   `anexo_encargo_firmado_at` y es la que habilita a la Empresa.

La escritura en la ficha reusa `empresaService.marcarAnexoSuscrito` (fase 1) y
`empresaService.marcarAnexoFirmado` (contrafirma), que ya existen y que **piden
motivo** para cambiar una fecha ya registrada (`MOTIVO_REQUERIDO`): la regla de
no pisar una firma sin rastro ya está puesta.

**Los siete ajustes del abogado (7-nov-2026, 📦1028).** El abogado revisó la
fase 1 y pidió siete cosas; las que cambian el código son: la fase 1 **no
habilita** a la Empresa; una **cláusula expresa del mecanismo** en el texto que
la Empresa acepta; la **verificación documental** de quien firmó por la
Empresa (documento cifrado en el expediente, `X-Admin-Motivo` obligatorio)
**antes** de contrafirmar; el código a un **segundo canal** declarado por K+AIR
y no por la Empresa; el acta como **constancia** y no como copia firmada; el §11
como parte integral del Anexo; y la frase informativa de tratamiento de datos
(10 años el documento original, 5 años el registro de operaciones).

### 4.3 Las rutas `src/routes/anexoEncargo.js`

Espejo de las del Anexo de Nube, con la misma regla de orden (la ruta del
documento **antes** que la del token, para que "documento" no se tome por un
token):

- `GET /anexo-encargo/documento` — el texto canónico, servido por el servicio,
  con las cabeceras `X-Anexo-Encargo-Version` y `X-Anexo-Encargo-Hash`.
- `GET /anexo-encargo/:token` — la pantalla (HTML) o el contexto (JSON).
- `GET /api/anexo-encargo/:token` — el contexto, siempre en JSON.
- `POST /api/anexo-encargo/:token/codigo` — pide el código.
- `POST /api/anexo-encargo/:token/suscribir` — acepta y suscribe.
- `GET /api/anexo-encargo/:token/acta` — el acta de suscripción (la huella de sus
  bytes, que la Empresa conserva).
- (Fase 2, en `src/routes/admin-empresas.js`, **no** en este archivo) las cinco
  rutas administrativas: `.../anexo-encargo/suscripcion` (abrir la suscripción y
  mandar el enlace a la Empresa), `.../anexo-encargo/suscripcion/:id_suscripcion/anular`,
  `.../anexo-encargo/suscripcion/:id_suscripcion/verificar-representante`,
  `.../anexo-encargo/contrafirmar/codigo` y `.../anexo-encargo/contrafirmar`.

### 4.4 La pantalla `web/anexo-encargo/`

Espejo de `web/anexo-nube/` (4 KB + 5,7 KB + 4 KB), con una diferencia: un
formulario con los **cinco datos del §11**, prellenados con la ficha de la
empresa y editables, con la advertencia de que lo que declare es lo que queda
en su copia.

### 4.5 El acta de suscripción

El Anexo de Nube no genera ningún documento: su "constancia" es el mensaje de
la pantalla ("Guarde esta pantalla: es la constancia de la suscripción"). Para
el Anexo de Encargo, que es un contrato bilateral, el plan propone ir un paso
más allá: el servicio genera el **acta de suscripción** con `pdf-lib` (que ya es
dependencia del servicio) con la versión, la huella canónica, la fecha y hora,
el firmante, su correo, el código verificado, la IP, el navegador y los datos
del §11 que declaró la empresa. El acta es el artefacto que la empresa
descarga y guarda (y que K+AIR guarda en el expediente), con su propia huella.

**El reparto de huellas, que no se puede confundir:**

| Huella | De qué es | Dónde vive |
|---|---|---|
| Canónica `5cc7a346…` | del texto del Anexo | manifiesto, `hash_texto` de la suscripción, el registro de la firma, la Constancia |
| De la copia firmada | del acta (y de la copia con el §11 diligenciado) | la evidencia del manifiesto y de la fila de la empresa |

**Hay DOS actas, y la segunda no reescribe la primera (📦1029).** La contrafirma
genera **su propio acta**, que cita la de la suscripción (su nombre y su huella)
y deja por escrito los dos actos. El acta de la suscripción **no se toca**: la
Empresa ya salió del servidor con su huella, y una huella que cambia después de
entregada no es una huella.

Las dos actas se arman con el **mismo lienzo** (las mismas herramientas de
dibujar): dos actas del mismo instrumento que se ven distintas hacen pensar que
son dos instrumentos. El refactor se verificó byte a byte (el acta de
suscripción que genera el código nuevo es idéntica a la del anterior: misma
huella SHA-256, mismos 5942 bytes).

**Lo que el acta dice de este mecanismo, sin adornos.** K+AIR no tiene hoy un
proveedor de firma ni un servicio de sellado de tiempo: **no hay certificado
digital ni sello de tiempo de terceros**. Lo que hay es una **firma electrónica
reforzada** (un código de un solo uso al buzón de K+AIR, la verificación
documental de quien firmó por la Empresa, y un rastro inalterable con fecha,
IP y navegador). El acta lo declara, y declara en mayúsculas que **es una
constancia, no la copia firmada**: la copia la conserva cada parte.

### 4.6 El preflight `scripts/preflight-anexo-encargo.js`

Espejo del del Anexo de Nube, con cinco comprobaciones (📦1030):

1. **El TEXTO**: que esté en el servidor y que su huella sea la que declara el
   manifiesto. Si no coinciden, el servicio firmaría un texto que nadie ha
   verificado.
2. **La CONTRAFIRMA**: que exista al menos una Empresa **activa** con los dos
   actos y con la fecha de ejecución en la ficha.
3. **LAS ACTAS**: que los dos archivos estén en disco y que sus bytes tengan la
   huella que quedó registrada.
4. **EL MANIFIESTO**: que diga `firmado`, con fecha y evidencia (con
   `--exigir-firmado`).
5. **EL RESPALDO**: que `deploy/backup-firma.sh` se lleve la carpeta **entera**
   de `storage/` y no una lista de subcarpetas.

El punto 5 es el que se mira de cerca: el acta de la suscripción ya salió del
servidor y **no se puede regenerar**. Si el respaldo no la copia, el expediente
pierde un documento. Por eso el preflight exige `tar -C "$BASE" … storage` y no
una lista fija: la carpeta de las actas es nueva, y una lista se quedaría atrás
sin avisar.

El preflight **aborta y no avisa**: un manifiesto que dice `firmado` sin que el
texto, los dos actos, las actas y el respaldo estén en su sitio no es un aviso
pendiente, es una afirmación falsa en el documento que lee la compuerta de
publicación. Códigos: 0 todo en orden · 2 argumentos · 3 base o lectura · 4 el
texto · 5 la contrafirma · 6 las actas · 7 el manifiesto · 8 el respaldo.

### 4.7 El manifiesto

- `anexo_encargo.estado`: `"firmado"` **solo cuando el instrumento esté
  ejecutado** (DECISIÓN 1), con `fecha` y `evidencia`.
- `anexo_encargo.version` y `anexo_encargo.hash`: **no cambian**. Son el texto
  canónico, y son lo que el servicio archiva en cada firma
  (`gh_consentimientos_firma.anexo_encargo_hash`, `gh_firmas_electronicas`) y lo
  que imprime la Constancia.
- `anexo_encargo.evidencia`: **ASCII puro** (sin tildes, sin «», sin eñes), como
  el resto del manifiesto.
- `nota`: **tampoco se toca**, y es una decisión. El plan original decía que se
  le añadía una línea con lo que pasó; pero `version`, `hash` y `nota` son la
  **identidad del texto**, no del acto: el manifiesto es la salida de los
  scripts que sellan el texto, y un script que cambia su huella por un cambio de
  estado sería una segunda verdad sobre el mismo documento. La evidencia (que sí
  describe el acto) va en `evidencia`.

**Quién lo escribe: `scripts/actualizar-manifiesto-anexo-encargo.js` (📦1030).**
Lee la base, y **se niega a escribir `firmado` si no hay contrafirma** (código
4): el Anexo es bilateral y el instrumento solo queda ejecutado cuando las dos
partes firman. Edita el archivo con **reemplazo literal** (nunca con
`JSON.stringify`, que dejaría el diff entero) y después valida que siga siendo
JSON válido y ASCII puro. Con `--check` no escribe nada: dice qué habría que
escribir y si coincide con lo que hay.

---

## 5. El plan de trabajo

Diez commits de implementación, en este orden. Cada uno con sus tests, y cada
test con la comprobación de que **sin el fix falla** (la regla del repo: un test
que no detecta el bug si vuelve no sirve).

El 📦1022 no es de este plan: es un rojo que salió al correr la suite, y que
estaba en el árbol desde el 📦1018. El manifiesto legal es **ASCII puro por
regla propia** (`scripts/actualizar-manifiesto-v1.4.js` aborta si deja de
serlo, y hay un test que lo exige), pero la evidencia de la 10.4 —que se copia
tal cual al manifiesto— traía cuatro `·` (U+00B7) del propio
`scripts/probar-10-4.js`. Se corrigieron los dos: el generador ya no emite
tipografía y el manifiesto se reparó a nivel de bytes, sin re-serializarlo.

El 📦1024 (la memoria de esta tanda) se coló entre la base y el servicio
porque el owner autorizó cerrar la documentación en este punto, no al final.

**La numeración corrió, y por qué.** El plan se escribió antes de que el abogado
respondiera. Cuando llegó su respuesta (7-nov-2026) y se implementaron los siete
ajustes, **hubo que meter un commit más**: el 📦1028. Y como la contrafirma, el
manifiesto y el preflight se hicieron después de ese ajuste, el 📦1029 y el
📦1030 del plan original quedaron **corridos una casilla**. La tabla de abajo es
la **numeración real** de la rama `Dev`, que es la que sirve.

| # | Qué | Qué incluye |
|---|---|---|
| 📦1021 | El plan | Este documento |
| 📦1022 | El fix del manifiesto | `legal-readiness.json` vuelve a ser ASCII puro y `scripts/probar-10-4.js` deja de emitir `·` en la evidencia |
| 📦1023 | La base | Migraciones 056 y 057 + los tests de los triggers (que muerden de verdad) |
| 📦1024 | La memoria de esta tanda | `Historial.md` y `CONTEXT.md` con el plan, el fix del manifiesto y la base |
| 📦1025 | El servicio | `src/services/anexoEncargo.js` + los 21 tests del espejo, adaptados |
| 📦1026 | Las rutas y la pantalla | `src/routes/anexoEncargo.js` + `web/anexo-encargo/` + los tests de rutas y de página |
| 📦1027 | El acta | La generación del acta con `pdf-lib` + su test (que la huella del acta sea la de sus bytes) |
| 📦1028 | **Los ajustes del abogado (7-nov-2026)** | Los siete cambios: la fase 1 no habilita, la cláusula del mecanismo, la verificación documental del representante, el segundo canal, el acta como constancia, el §11 integral y la frase de datos |
| 📦1029 | La contrafirma (fase 2) | La migración 059, el propósito de derivación del código, `solicitarCodigoContrafirma` y `contrafirmar`, el acta de contrafirma y sus dos rutas |
| 📦1030 | El manifiesto y el preflight | `scripts/actualizar-manifiesto-anexo-encargo.js` (que solo dice "firmado" con contrafirma) + `scripts/preflight-anexo-encargo.js` |
| 📦1031 | Los documentos | `Historial.md`, `PROMPT.md`, `CONTEXT.md`, `API.md` y este plan |

Y después, el deploy, con el mismo script que se usó el 6-nov (`deploy-1018.sh`
como molde), que ya sabe: respaldos, compuertas, gate y cron.

**El orden de las fases en el servidor** (el que fijó el abogado el 5-nov y que
no se puede alterar):

1. Se despliega el flujo (no cambia el estado de nadie).
2. ASEPLUS se suscribe por el enlace.
3. Se registra la evidencia (manifiesto) y se despliega.
4. **Recién entonces** se retira la excepción 5.

---

## 6. Los riesgos y las trampas

### 6.1 El generador del Anexo de Encargo puede matar suscripciones vivas

`scripts/generar-anexo-encargo.js` se corre en cada cambio del bloque de
instrucciones y **reescribe el archivo**: la huella cambia. Si eso pasa con una
suscripción abierta, la firma se rechaza con `TEXTO_MODIFICADO`.

Esto ya pasó una vez: el 6-nov se alineó la etiqueta de versión del Anexo de
Encargo y la nota del propio manifiesto lo dice — "el cambio de etiqueta
después de la firma invalidaría la copia suscrita" — por eso la alineación se
hizo **antes** de mandarle el documento a la empresa.

**Regla que propone el plan:** el generador no se puede correr con suscripciones
abiertas sin avisar. Lo más simple es que el generador **avise** (y no escriba)
si hay suscripciones abiertas sobre el texto vigente, y que el registro de la
suscripción lleve la huella del texto en el momento de abrirse, como ya lo hace
el del Anexo de Nube.

### 6.2 El canal de correo es un incidente abierto (riesgo aceptado por el owner)

El flujo manda el código de verificación **por correo**. El correo del servicio
sale por una cuenta de Gmail con **cinco app passwords sin rotar**, que es un
incidente abierto (arts. 17(d), 17(n), 18(b) y 18(k) de la Ley 1581 de 2012).

Poner en marcha un flujo cuya credencial es un código de un solo uso por correo,
con el canal comprometido, es poner más peso sobre el eslabón más débil. Eso se
le planteó al owner y **la decisión es suya (6-nov-2026): abrir el flujo ahora y
rotar los app passwords después.** Queda registrado como riesgo aceptado, con su
motivo, no como recomendación del plan.

**La mitigación que sale de esa decisión** (y que no la contradice): el primer
uso del flujo es el **piloto de ASEPLUS**, que ya está suscrita al Anexo de
Nube y con la que ya hay relación; **no se anuncia el flujo a ninguna otra
empresa hasta que los app passwords estén rotados**. Así el canal comprometido
no recibe códigos de terceros.

Los cinco app passwords quedan como pendiente abierto (es incidente, no tarea) y
siguen en la lista de lo que el gate no cubre.

### 6.3 El manifiesto no escala

Ver §3.3. Si cada empresa que firme obliga a cambiar el manifiesto, el flujo no
es un flujo. La verdad por empresa va en la base.

### 6.4 La excepción 5 es lo que hoy habilita a ASEPLUS

`verificarHabilitacionFirma` exige `anexo_encargo_firmado_at`; hoy eso lo cubre
la excepción 5 (VIGENTE, 2 de 2 firmas, plazo 2026-12-04T14:01:43Z). El flujo
**no levanta excepciones**: las abre el operador, con motivo. La excepción 5 se
retira cuando la suscripción exista, y eso es un acto del owner con su propio
rastro.

### 6.5 Dos huellas, y no se pueden confundir

Ver la tabla de §4.5. Si alguien_archiva la huella de la copia firmada donde va
la del texto canónico, la Constancia de cada firma miente. Es el mismo error
que el que la nota del manifiesto de la 9A ya warnía para el Anexo de Nube
("dos hashes con significados distintos").

### 6.6 El texto que se sirve y el que se firma

El Anexo de Nube sirve el archivo del servidor para que no existan dos copias.
El Anexo de Encargo tiene que servir **el mismo** archivo.

**Verificado el 6-nov-2026, no supuesto:**

- La ruta real en el servidor es `/opt/kair-firma/legal/anexo-encargo.html`
  (`REPO_ROOT` = tres niveles arriba de `src/services`, o sea `/opt/kair-firma`;
  el archivo vive en `legal/`, no en `app/legal/`).
- La huella del archivo desplegado es
  `5cc7a34603ea2e300e6c82ed695454eb705363345a3165ae2e75b5733960aa72`: **la misma
  que declara el manifiesto** (log del deploy del 6-nov, 17:10).
- La ruta pública del documento del Anexo de Nube
  (`https://firma.kair.fyi/anexo-nube/documento`) devuelve `e9517536…`, que
  también es la del manifiesto: el mecanismo de servir el archivo del servidor
  funciona y el servicio lee de ese `legal/`.

El directorio `legal/` del servidor es `750 kairfirma`: el texto no lo puede leer
el usuario de SSH, pero el servicio sí (corre como `kairfirma`). Eso no cambia
nada para el plan, pero el preflight tiene que correr como `kairfirma`, igual
que el gate.

### 6.7 El texto del §12 y la firma del Encargado — RESUELTO (7-nov-2026)

La DECISIÓN 1 no era de código, y el abogado la respondió el 7-nov-2026: **«la
empresa no debería empezar a usar el servicio hasta que K+AIR firme la otra
parte»**. O sea que el instrumento **no** está firmado con una sola parte, y la
habilitación se aplaza a la contrafirma.

Eso es exactamente lo que quedó implementado (📦1028 y 📦1029): la fase 1
escribe `anexo_encargo_suscrito_at` y **nunca** `anexo_encargo_firmado_at`; la
contrafirma escribe `anexo_encargo_firmado_at`, que es la fecha de EJECUCIÓN y
la que `verificarHabilitacionFirma` exige. El `estado: "firmado"` del manifiesto
se pone solo con los dos actos, y el script que lo escribe **se niega** si no
hay contrafirma.

Lo que el §12 **no** cambia: el texto del Anexo (`5cc7a346…`) sigue siendo el
mismo, y el texto firmado y su huella van juntos. El §12 no necesita un
añadido.

---

## 7. Lo que NO cambia

- **El texto del Anexo de Encargo no se toca.** Ni una línea. El hash canónico
  `5cc7a346…` sigue siendo el que declara el manifiesto. (Si el §12 necesitara
  un añadido, eso es otra conversación, con el abogado.)
- El Acuerdo, el 3.4(h), la Constancia y el 9.5 no cambian.
- La compuerta `FIRMA_EXIGIR_ANEXO_NUBE` no se toca: ya está encendida y ya
  hay una empresa suscrita.
- El modelo de datos de las firmas (`gh_firmas_electronicas`) no cambia: los
  anexos que rigen cada firma ya se archivan (`anexo_encargo_version`,
  `anexo_encargo_hash`).

---

## 8. Lo que el flujo no compra

Para que la decisión sea con los ojos abiertos: la vía digital **no** destraba
el otro pendiente del gate (`anexo_nube::google_dpa`, el vínculo con Google: el
papel escrito, las medidas, la Circular 2 de 2025 y la declaración en el RNBD).
Eso es trabajo de documentação y de abogado, no de código. Y tampoco destraba
lo que el gate no cubre: los app passwords, Node 20 en EOL, la copia off-site,
la T6, la T7, la sección E, la Constancia firmada, la T8 y el dictamen J1-J14.

Lo que sí compra: **el Anexo de Encargo deja de ser un trámite físico** y
cada empresa se suscribe sola, con la misma trazabilidad que la del Anexo de
Nube, sin que nadie tenga que transcribir una fecha a mano.

---

## 9. Las decisiones

| # | Decisión | Quién | Estado |
|---|---|---|---|
| 1 | ¿Hace falta la contrafirma del Encargado para que el Anexo esté "firmado"? | owner | **Tomada (6-nov-2026): dos fases.** **Validada por el abogado (7-nov-2026): la habilitación se aplaza a la contrafirma.** Implementada en 📦1028 y 📦1029 |
| 2 | ¿Cómo se diligencia el §11 en la vía digital? | owner | **Tomada (6-nov-2026): la Empresa los confirma o corrige en la pantalla, y el acta los lleva.** **Validada por el abogado (7-nov-2026): el §11 forma parte integral del Anexo y el acta lleva los cinco datos tal como se declararon** |
| 3 | ¿La verdad por empresa vive en la base o el manifiesto cambia por empresa? | — | **Resuelta por la restricción:** en la base. El manifiesto declara el instrumento; si cambiara por empresa, sería un deploy por empresa |
| 4 | ¿Se rotan los app passwords antes de abrir el flujo? | owner | **Tomada (6-nov-2026): abrir el flujo ahora y rotar después.** Riesgo aceptado, con su mitigación en §6.2 |
| 5 | ¿El abogado valida que una suscripción con OTP equivale a firma para este instrumento, y que la sustitución de los datos del §11 sea admisible? | abogado | **PARCIALMENTE RESPONDIDA (7-nov-2026):** el §12 sí está resuelto (la habilitación se aplaza a la contrafirma) y los siete ajustes de la fase 1 están validados. **ABIERTA:** el dictamen J1-J14 completo, la fecha de vigencia y el 3.4(h) |

Las tres decisiones del owner son las que el plan recomendaba (1 y 2) y la que no
(4): esa última queda como **riesgo aceptado por el owner**, con su mitigación
escrita, no como recomendación del plan.

---

## 10. El orden que se propone

1. ~~El owner decide 1, 2 y 3.~~ **Hecho (6-nov-2026).**
2. Se manda la DECISIÓN 5 al abogado, con este plan y el §12 a la vista. No
   bloquea el código: su respuesta pesa en la fase 2 (la contrafirma), no en el
   flujo.
3. 📦1025 a 📦1030, en ese orden, con la suite en verde en cada commit (y el
   📦1031 con los documentos del plan, al final). **Hecho.**
4. Deploy con el guion del 6-nov, que ya sabe medir el gate.
5. **Piloto:** ASEPLUS se suscribe por el enlace. Es el único uso del flujo
   hasta que los app passwords estén rotados (§6.2).
6. **Fase 1 cerrada:** la suscripción escribe `anexo_encargo_suscrito_at` en la
   ficha — **no** `anexo_encargo_firmado_at`: la Empresa **sigue sin poder
   firmar** documentos de sus trabajadores. El manifiesto **sigue diciendo
   `no_firmado`**. El ítem `empresas_base` del gate **no** pasa a `ok` (exige
   la fecha de ejecución, no la de suscripción).
7. **Fase 2:** el owner verifica al representante (la ruta de verificación
   documental), pide el código de contrafirma y contrafirma; después se corre
   `scripts/actualizar-manifiesto-anexo-encargo.js`, que escribe en el
   manifiesto la evidencia de los dos actos (`estado: "firmado"`, la fecha, la
   evidencia) y **se niega a hacerlo si no hay contrafirma**. Se despliega. El
   ítem `estado_encargo` pasa a `ok` y el gate queda con **1 pendiente**: el
   vínculo con Google.
8. Se retira la excepción 5, con su motivo en el rastro: con el Anexo
   ejecutado, ASEPLUS queda habilitada sin excepción.
9. Se rotan los app passwords y recién entonces se anuncia el flujo a otras
   empresas.
