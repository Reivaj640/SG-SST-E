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
3. Al suscribir, escribe en `gh_firma_empresas.anexo_encargo_firmado_at` (con el
   rastro de la ficha) y en la fila de la suscripción, con la evidencia en JSON
   —igual que el Anexo de Nube, que escribe `anexo_nube_firmado_at`,
   `anexo_nube_version`, `anexo_nube_hash` y `anexo_nube_evidencia`.
4. La fase 2: la contrafirma del Encargado (DECISIÓN 1).

La escritura en la ficha reusa `empresaService.marcarAnexoFirmado`, que ya
existe y que **pide motivo** para cambiar una fecha ya registrada
(`MOTIVO_REQUERIDO`): la regla de no pisar una firma sin rastro ya está puesta.

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
- (Fase 2) `POST /internal/admin/empresas/:id_empresa/anexo-encargo/contrafirmar`.

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

### 4.6 El preflight `scripts/preflight-anexo-encargo.js`

Espejo del del Anexo de Nube (7,7 KB), con una diferencia de fondo: el Anexo de
Encargo **no tiene compuerta**. Su requisito es duro (`anexo_encargo_firmado_at`
tiene que existir), y hoy lo cubre la **excepción 5** de ASEPLUS. El preflight
entonces no guarda un encendido: **guarda el retiro de la excepción**. Comprueba
que (1) el texto está en el servidor y su huella es la del manifiesto, y (2) hay
al menos una empresa activa con el Anexo de Encargo suscrito sobre el texto
vigente.

### 4.7 El manifiesto

- `anexo_encargo.estado`: `"firmado"` **solo cuando el instrumento esté
  ejecutado** (DECISIÓN 1), con `fecha` y `evidencia`.
- `anexo_encargo.version` y `anexo_encargo.hash`: **no cambian**. Son el texto
  canónico, y son lo que el servicio archiva en cada firma
  (`gh_consentimientos_firma.anexo_encargo_hash`, `gh_firmas_electronicas`) y lo
  que imprime la Constancia.
- `anexo_encargo.evidencia`: **ASCII puro** (sin tildes, sin «», sin eñes), como
  el resto del manifiesto.
- `nota`: se le añade una línea con lo que pasó (fecha, quién, con qué
  evidencia), en el mismo estilo de las que ya tiene.

---

## 5. El plan de trabajo

Ocho commits, en este orden. Cada uno con sus tests, y cada test con la
comprobación de que **sin el fix falla** (la regla del repo: un test que no
detecta el bug si vuelve no sirve).

| # | Qué | Qué incluye |
|---|---|---|
| 📦1021 | El plan | Este documento |
| 📦1022 | La base | Migraciones 056 y 057 + los tests de los triggers (que muerden de verdad) |
| 📦1023 | El servicio | `src/services/anexoEncargo.js` + los 21 tests del espejo, adaptados |
| 📦1024 | Las rutas y la pantalla | `src/routes/anexoEncargo.js` + `web/anexo-encargo/` + los tests de rutas y de página |
| 📦1025 | El acta | La generación del acta con `pdf-lib` + su test (que la huella del acta sea la de sus bytes) |
| 📦1026 | La contrafirma | La fase 2 del Encargado + su test (y la regla de que sin contrafirma el manifiesto no dice "firmado") |
| 📦1027 | El manifiesto y el preflight | `legal-readiness.json` con la evidencia de la primera suscripción + `scripts/preflight-anexo-encargo.js` |
| 📦1028 | Los documentos | `Historial.md`, `PROMPT.md`, `CONTEXT.md`, `API.md`, `FLOWS.md`, `DATA_MODEL.md`, `SECURITY.md` |

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

### 6.7 El texto del §12 y la firma del Encargado

La DECISIÓN 1 no es de código. Si el abogado dice que el instrumento no está
firmado con una sola parte, el `estado: "firmado"` del manifiesto no se puede
poner, y el gate se queda en 1 pendiente (el de Google). El plan no escribe esa
palabra hasta que la decisión esté tomada.

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
| 1 | ¿Hace falta la contrafirma del Encargado para que el Anexo esté "firmado"? | owner | **Tomada (6-nov-2026): dos fases.** Falta la validación del abogado |
| 2 | ¿Cómo se diligencia el §11 en la vía digital? | owner | **Tomada (6-nov-2026): la Empresa los confirma o corrige en la pantalla, y el acta los lleva.** Falta la validación del abogado |
| 3 | ¿La verdad por empresa vive en la base o el manifiesto cambia por empresa? | — | **Resuelta por la restricción:** en la base. El manifiesto declara el instrumento; si cambiara por empresa, sería un deploy por empresa |
| 4 | ¿Se rotan los app passwords antes de abrir el flujo? | owner | **Tomada (6-nov-2026): abrir el flujo ahora y rotar después.** Riesgo aceptado, con su mitigación en §6.2 |
| 5 | ¿El abogado valida que una suscripción con OTP equivale a firma para este instrumento, y que la sustitución de los datos del §11 sea admisible? | abogado | **ABIERTA.** Se manda con este plan y el §12 a la vista |

Las tres decisiones del owner son las que el plan recomendaba (1 y 2) y la que no
(4): esa última queda como **riesgo aceptado por el owner**, con su mitigación
escrita, no como recomendación del plan.

---

## 10. El orden que se propone

1. ~~El owner decide 1, 2 y 3.~~ **Hecho (6-nov-2026).**
2. Se manda la DECISIÓN 5 al abogado, con este plan y el §12 a la vista. No
   bloquea el código: su respuesta pesa en la fase 2 (la contrafirma), no en el
   flujo.
3. 📦1022 a 📦1026, en ese orden, con la suite en verde en cada commit.
4. Deploy con el guion del 6-nov, que ya sabe medir el gate.
5. **Piloto:** ASEPLUS se suscribe por el enlace. Es el único uso del flujo
   hasta que los app passwords estén rotados (§6.2).
6. **Fase 1 cerrada:** la suscripción escribe `anexo_encargo_firmado_at` en la
   ficha, y el ítem `empresas_base` del gate pasa a `ok`. El manifiesto **sigue
   diciendo `no_firmado`**: falta la contrafirma. El gate queda con **2
   pendientes**.
7. **Fase 2:** el owner contrafirma en el servicio; se registra en el manifiesto
   la evidencia de los dos actos (`estado: "firmado"`, la fecha, la evidencia)
   y se despliega. El ítem `estado_encargo` pasa a `ok` y el gate queda con **1
   pendiente**: el vínculo con Google.
8. Se retira la excepción 5, con su motivo en el rastro: con el Anexo
   suscrito, ASEPLUS queda habilitada sin excepción.
9. Se rotan los app passwords y recién entonces se anuncia el flujo a otras
   empresas.
