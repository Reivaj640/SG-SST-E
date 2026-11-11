# La contrafirma del Anexo de Nube v1.2 — el segundo acto (9-nov-2026)

> Documento de operación. Es la nota que enlaza **el código que ya está construido** con **la
> respuesta que falta del abogado (P7)**, para que la próxima jornada no tenga que reconstruir ese
> razonamiento ni adivinar qué había que hacer primero.
>
> **Estado:** la contrafirma está **implementada en el servicio** (migración `060`, dos rutas
> administrativas, acta propia, manifiesto y gate leyendo los dos actos). **El ACTO no se ha
> hecho**: lo hace el operador de K+AIR, sobre la suscripción real de ASEPLUS (P8).
> **Pendiente de P7:** si el abogado responde que la contrafirma del Anexo de Nube se firma
> **fuera** del servicio, el apartado 5 dice qué queda por hacer en ese caso.
>
> **ACTUALIZADO 10-nov-2026: P7 ya respondió.** La contrafirma va **dentro** del servicio, con la
> arquitectura que este documento describe. La condición del abogado sobre la **facultad de quien
> contrafirma por Gesstiar** está implementada (§5 y
> `acreditacion-facultad-contrafirmante.md`). Queda una decisión de texto (si esa exigencia entra
> en el §10, lo que obligaría a una v1.3) y la vía para incorporar una contrafirma externa.

---

## 1. Por qué existe este segundo acto

El texto vigente del Anexo de Nube (la **v1.2**, §10) no es un contrato de una parte: lo
**suscribe** la Empresa y lo **contrafirma** K+AIR, y el propio texto dice que el instrumento
solo queda **ejecutado** cuando los dos actos se han producido.

Hasta el 9-nov-2026 el código solo registraba el primero. No había una contrafirma que
registrar, ni una columna que la guardara, ni una ruta que la pidiera. El resultado era un
**verde falso de manual**: el manifiesto decía `firmado: true` y el ítem `firmado_nube` del
gate daba `ok` describiendo **la mitad** del instrumento. Nadie había escrito una mentira: el
código y el gate decían exactamente lo que sabían. Lo que no sabían era la otra mitad.

El hermano de este instrumento —el **Anexo de Encargo**— ya separaba los dos actos desde la
migración 056/059 (`anexo_encargo_suscrito_*` para el primero, `anexo_encargo_firmado_at` para
el segundo), y la habilitación de la Empresa ya exigía la fecha del **segundo** acto. El
Anexo de Nube se había quedado con la regla anterior, que era correcta cuando el texto no
exigía contrafirma.

---

## 2. Lo que hay construido

| Pieza | Ruta | Qué hace |
|---|---|---|
| Migración | `firma-service/src/db/schema/060_anexo_nube_contrafirma.sql` | Las 15 columnas del segundo acto en `gh_firma_anexo_nube_suscripciones` y `anexo_nube_ejecutado_at` en `gh_firma_empresas`. Aditiva, con valor `NULL`: las filas que ya existieran siguen siendo válidas |
| Servicio | `firma-service/src/services/anexoNube.js` | `solicitarContrafirmaAnexoNube()` y `contrafirmarAnexoNube()` |
| Acta | `firma-service/src/services/actaAnexoNube.js` | El acta del segundo acto, con su nombre, su SHA-256 y su tamaño, en la misma forma que el acta del Anexo de Encargo |
| Rutas | `firma-service/src/routes/admin-empresas.js` | `POST .../anexo-nube/contrafirmar/codigo` y `POST .../anexo-nube/contrafirmar` |
| Manifiesto | `firma-service/scripts/actualizar-manifiesto-anexo-nube.js` | Declara los **dos** actos: `firmado` (el primero) y `contrafirmado` con su fecha, actor, motivo y evidencia (el segundo) |
| Gate | `firma-service/src/services/readinessLegal.js` | Mide los dos actos por separado: `firmado_nube` y `contrafirma_nube`, cada uno con su detalle y su acción |
| Habilitación | `firma-service/src/services/empresa.js` | La Empresa solo puede pedir firmas con el instrumento **ejecutado**, no solo suscrito |
| Lectura del operador | `firma-service/src/routes/admin-empresas.js` | `GET /internal/admin/empresas/:id_empresa/anexos` devuelve la suscripción del Anexo de Nube con los campos del **segundo acto leídos de la fila** |
| Listado del operador | `firma-service/src/services/empresa.js` | `tiene_anexo_nube_suscrito` y `tiene_anexo_nube_ejecutado`: los dos actos, por separado |
| Panel del operador | `modules/gestion-humana/firma-operador/index.js` | Muestra los tres estados del Anexo de Nube (no suscrito / suscrito sin contrafirma / ejecutado) y la fecha de la contrafirma |
| Pruebas | `firma-service/tests/anexo-nube-contrafirma.test.js` | 20 pruebas del segundo acto, incluidas las dos rutas por HTTP |

---

## 3. Cómo se ejecuta (la vía del servicio)

### 3.1. Lo que exige

| Exigencia | Por qué |
|---|---|
| Que la Empresa haya **suscrito** | No se contrafirma lo que no se firmó |
| Que se sepa **quién firmó por la Empresa** | El §10 del texto vigente lo pide antes de contrafirmar. El cotejo es contra el `representante_legal` de la ficha; si no coincide, la contrafirma **no se produce** (`409 FIRMANTE_NO_COINCIDE`) |
| Que **quien contrafirma por Gesstiar tenga la faculty acreditada** | Condición del abogado a P7 (10-nov-2026). Si es el representante legal que declara el manifiesto legal, vale; si es otra persona, tiene que haber un poder **vigente** a su nombre. Sin eso: `409 FACULTAD_NO_ACREDITADA` y la contrafirma **no se produce**. Ver `acreditacion-facultad-contrafirmante.md` |
| El **código** | Sale al buzón de protección de datos de K+AIR (`FIRMA_CANAL_PROTECCION_DATOS`), nunca a un buzón que la Empresa pueda leer, y con un **propósito de derivación propio** (`otp-contrafirma`): los mismos seis dígitos de la suscripción **no** contrafirman |
| La **aceptación expresa** (`acepta: true`) | La contrafirma no es un valor por omisión |
| El **motivo** (`X-Admin-Motivo`) | Es un acto que ejecuta el instrumento y habilita a la Empresa |

### 3.2. Los dos pasos

```powershell
# 0. (Solo si quien contrafirma NO es el representante legal de Gesstiar)
#    Registrar su poder: sin esto, el paso 2 se rechaza con 409.
curl -X POST "https://firma.kair.fyi/internal/admin/encargado/poderes" `
  -H "X-Admin-API-Key: <ADMIN_KEY>" `
  -H "X-Admin-Motivo: <POR QUE>" `
  -H "Content-Type: application/json" `
  -d '{ "nombre": "<QUIEN CONTRAFIRMA>", "tipo": "PODER", "instrumento_ref": "<EL PODER>", "instrumento_sha256": "<HUELLA>" }'

# 1. Pedir el código. No contrafirma nada: es una ruta aparte del acto.
curl -X POST "https://firma.kair.fyi/internal/admin/empresas/<ID>/anexo-nube/contrafirmar/codigo" `
  -H "X-Admin-API-Key: <ADMIN_KEY>" `
  -H "Content-Type: application/json" `
  -d '{ "id_suscripcion": <ID_SUSCRIPCION> }'

# 2. Contrafirmar: el código, la aceptación expresa, el actor y el motivo.
#    El actor tiene que ser el NOMBRE de quien contrafirma: es el que se
#    coteja contra la faculty acreditada.
curl -X POST "https://firma.kair.fyi/internal/admin/empresas/<ID>/anexo-nube/contrafirmar" `
  -H "X-Admin-API-Key: <ADMIN_KEY>" `
  -H "X-Admin-Actor: <QUIEN CONTRAFIRMA>" `
  -H "X-Admin-Motivo: <POR QUE>" `
  -H "Content-Type: application/json" `
  -d '{ "id_suscripcion": <ID_SUSCRIPCION>, "otp": "<CODIGO>", "acepta": true }'
```

### 3.3. Qué escribe

- En `gh_firma_anexo_nube_suscripciones`: `contrafirmado_at`,
  `contrafirma_actor`, `contrafirma_motivo`, `contrafirma_evidencia`,
  `contrafirma_acta_hash`, `contrafirma_acta_bytes` y `contrafirma_acta_archivo`.
  **No toca** el `estado` de la suscripción (es el de la fase 1) ni
  `anexo_nube_firmado_at`.
- En `gh_firma_empresas`: `anexo_nube_ejecutado_at` — la fecha de **ejecución** del
  instrumento, con su rastro en `gh_firma_empresas_auditoria`.
- En el rastro append-only: `CONTRAFIRMA_CODIGO_ENVIADO`, `CONTRAFIRMA_FIRMADA` y
  `CONTRAFIRMA_ACTA_GENERADA`.
- Un archivo: `acta-{id_suscripcion}-contrafirma-anexo-nube.pdf`, con su SHA-256.

Las dos escrituras (suscripción y ficha) van en **una sola transacción**: si una falla, las dos
se deshacen y el acta se borra. No puede quedar un registro sin archivo ni un archivo sin
registro.

### 3.4. Después del acto

```powershell
node firma-service/scripts/actualizar-manifiesto-anexo-nube.js   # lee la base y escribe el manifiesto
```

El manifiesto queda con `anexo_nube.firmado = true` **y** `anexo_nube.contrafirmado = true`, y
el gate con `firmado_nube` y `contrafirma_nube` en `ok`. **Ninguna firma se escribe a mano**:
si el script no puede leer la contrafirma, no escribe y sale con el código 3 diciendo qué
migración falta.

---

## 4. Lo que este documento NO cierra

- **No firma nada.** La contrafirma de ASEPLUS la hace el operador, sobre la suscripción real,
  dentro de P8.
- **No sustituye la verificación documental.** El Anexo de Encargo tiene un paso propio
  (`verificar-representante`: certificado de cámara, RUT o poder). El Anexo de Nube **no tiene
  esa columna ni esa ruta**, y por eso el cotejo es contra el representante legal de la ficha.
  Si P7 dice que la verificación documental también es exigible en el Anexo de Nube, hay que
  abrirle columna y ruta: es un cambio acotado, pero es una decisión jurídica, no de código.
- **No abre producción.** `FIRMA_EXIGIR_ANEXO_NUBE` sigue apagada.
- **No pone el segundo acto en la app de escritorio.** Las dos rutas existen en el servicio, pero
  **la app no las expone**: no hay canal IPC ni botón. Por eso §3.2 usa `curl` contra el
  servicio. La app sí **muestra** el estado de los dos actos (columna del listado y detalle de la
  suscripción), pero no permite ejecutarlo.

---

## 4.1 Lo que se corrigió al cerrar el día (9-nov-2026, tarde)

Cerrar el segundo acto no era solo el gate y el manifiesto. Quedaron **tres** cosas que seguían
midiendo el instrumento con un solo acto, y que se encontraron al verificar:

1. **La lectura del operador devolvía `null` en los campos de la contrafirma.**
   `GET /internal/admin/empresas/:id_empresa/anexos` tenía la fase 2 clavada en `null` — y el
   comentario de la función afirmaba "el Anexo de Nube NO es bilateral". Eso no era una
   descripción: era una fuente de verdad en falso. Ahora los campos se **leen de la fila**
   (`contrafirmado_at`, `contrafirma_actor`, `contrafirma_motivo`, `contrafirma_canal`,
   `contrafirma_estado`, `contrafirma_evidencia`, `contrafirma_acta_*`), con lectura tolerante:
   sin la migración 060 aplicada vienen en `null` y no se inventa nada.
2. **El panel pintaba un badge verde "Firmado" con solo la suscripción.** La columna del listado
   usaba `anexo_nube_firmado_at` — que es la **fase 1** — para decir "firmado". Ahora son los
   mismos tres estados que el Anexo de Encargo: no suscrito / suscrito sin contrafirma /
   ejecutado, con `tiene_anexo_nube_suscrito` y `tiene_anexo_nube_ejecutado`.
3. **`API.md` listaba dos canales IPC que no existen.** `firma:anexo:nube-contrafirma-codigo` y
   `firma:anexo:nube-contrafirmar` nunca se escribieron en `main/firma-bridge.js`. La tabla
   decía trece canales y el título del apartado decía once: el título era el que cuadraba. El
   documento afirmaba una capacidad que el código no tenía.

El detalle que resume los tres: **cerrar un instrumento no es cerrar el código**. El gate, el
manifiesto y la habilitación se corrigieron primero, pero lo que *muestra* el estado —la lectura
del operador y la vista que la pinta— seguía con la regla anterior. Un instrumento que todos los
actos miden bien pero que se muestra mal sigue siendo un verde falso: esta vez, hacia el
operador.

---

## 5. La respuesta de P7 (10-nov-2026): la contrafirma va DENTRO, con una condición

**P7 ya respondió.** El abogado: la contrafirma del Anexo de Nube v1.2 **se ejecuta dentro del
servicio** de firma electrónica K+AIR, con el mecanismo ya implementado, conservando identificación
del firmante, manifestación expresa de voluntad, autenticación mediante código de un solo uso,
cotejo de representación, fecha y hora, motivo, dirección IP, trazabilidad append-only, acta y
huella SHA-256. Su recomendación: **mantener exactamente la arquitectura que ya construiste** y no
sacar la contrafirma del sistema. El código de este documento es, por tanto, el camino definitivo
y no andamiaje.

**La condición que sí abría trabajo** (y que no se cumplía): «La ejecución por una persona distinta
del representante legal de Gesstiar S.A.S. requerirá acreditar previamente la facultad de
representación o poder suficiente, que deberá conservarse en el expediente». Está implementada:
registro de poderes, comprobación en el acto, dato en el acta, en la evidencia y en el manifiesto,
y el gate la exige. Detalle en `acreditacion-facultad-contrafirmante.md`.

**La tercera condición** (la contrafirma externa) se cumple por diseño: `contrafirmado_at` y
`anexo_nube_ejecutado_at` los escribe **solo** el servicio, así que un acta firmada por fuera no
cierra `contrafirma_nube` ni habilita el instrumento.

**Lo que NO se implementó** (y sigue abierto, por decisión del owner): una vía administrativa para
*incorporar* una contrafirma externa con su evidencia íntegra. La condición exige una noción de
«evidencia íntegra, verificable y vinculada inequívocamente al instrumento» que hay que definir
con detalle; mientras tanto, una contrafirma externa **no habilita nada**.

**La otra decisión que queda**: si esa exigencia debe **decirse** en el §10 del texto vigente
(implicaría una v1.3, con huella nueva y republicación, antes de que ASEPLUS firme) o si se queda
como control interno, cuyo expediente es el registro de poderes, el acta y la evidencia.

---

## 6. Las referencias

- **Decisión A** (9-nov-2026): `decision-regularizacion-correo-2026-11-09.md` — el marco del
  canal de correo y del CDPA.
- **Tabla única de instrumentos**: `tabla-instrumentos-vigentes-2026-11-09.md` — documento,
  versión, hash, fecha, suscripción y evidencia.
- **El texto vigente**: `sgsst-electron-app/legal/anexo-nube-v1.2.html` (84 062 B, SHA-256
  `242037b3…1f7245`), con su copia byte a byte igual en `sitio/`.
- **La API**: `API.md` §6.21.5 (las dos rutas administrativas del Anexo de Nube), §6.13 (los
  cuatro indicadores del estado de los Anexos en el listado) y §6.22.2 (la forma de la
  suscripción del Anexo de Nube, con el segundo acto leído de la fila). La §6.22.1 lleva el
  bloque `anexo_nube` de la vista de la Empresa, con sus tres estados. La §6.22.3 deja escrito
  que la contrafirma del Anexo de Nube **no tiene canal IPC**: se hace por HTTP contra el
  servicio.
- **El flujo**: `FLOWS.md` §13 (fase 1 y fase 2 del flujo 12).
- **La lección**: `sgsst-electron-app/BITACORA.md` — «El día que un instrumento de dos partes se
  midió con un solo acto».
- **Las reglas**: `PROMPT.md`, trampas **145** (un instrumento bilateral exige dos actos y cada
  uno se mide en su propio ítem), **146** (fallar cerrado se decide *por partes*), **147**
  (cuando un instrumento se vuelve bilateral, se revisa todo lo que dependía de él: la
  habilitación, el gate, el preflight, el manifiesto y la vista de la Empresa), **148** (una
  negativa escrita en un comentario es una afirmación que caduca sola: al cambiar la naturaleza de
  un instrumento hay que buscar y corregir el texto que afirma lo contrario) y **149** (un
  documento que promete una capacidad que el código no tiene es un verde falso por la vía del
  papel: toda fila de API se contrasta contra el código antes de escribirla).
