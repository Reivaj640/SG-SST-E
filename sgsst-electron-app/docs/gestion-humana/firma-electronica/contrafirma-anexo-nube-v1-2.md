# La contrafirma del Anexo de Nube v1.3 — el segundo acto (9-nov-2026)

> Documento de operación. Es la nota que enlaza **el código que ya está construido** con **la
> respuesta que falta del abogado (P7)**, para que la próxima jornada no tenga que reconstruir ese
> razonamiento ni adivinar qué había que hacer primero.
>
> **El nombre del archivo no cambia** (`contrafirma-anexo-nube-v1-2.md`): lo citan otros documentos
> del expediente y no se renombra. **El texto vigente del Anexo de Nube, desde el 11-nov-2026, es la
> v1.3** (`sgsst-electron-app/legal/anexo-nube-v1.3.html`, 85 143 B, SHA-256 `fdd10551…2b585d`, fecha
> 11-nov-2026). La v1.2 (84 062 B, `242037b3…1f7245`, 9-nov-2026) **nunca fue suscrita** y queda como
> referencia. La v1.1 es la que **está suscrita** por ASEPLUS y no se toca.
>
> **Estado:** la contrafirma está **implementada en el servicio** (migración `060`, dos rutas
> administrativas, acta propia, manifiesto y gate leyendo los dos actos). **El ACTO no se ha
> hecho**: lo hace el operador de K+AIR, sobre la suscripción real de ASEPLUS (P8).
>
> **P7 ya respondió (10-nov-2026):** la contrafirma va **dentro** del servicio, con la
> arquitectura que este documento describe. La condición del abogado sobre la **facultad de quien
> contrafirma por Gesstiar** está implementada (§5 y
> `acreditacion-facultad-contrafirmante.md`). **Lo que queda abierto:** la vía para incorporar una
> contrafirma externa (sin decidir) y el **despliegue habilitante** en el servidor (migraciones
> 060/061/062 y `FIRMA_ADMIN_ACTOR`, con los comandos en
> `sgsst-electron-app/docs/MIGRACION-SERVIDOR-FIRMA.md` §0).
>
> **La decisión de texto del 10-nov-2026 (opción A · control interno) queda registrada tal como se
> tomó:** la acreditación se quedaba en el expediente y **el texto vigente NO cambiaba**: no había
> v1.3, la huella `242037b3…1f7245` no se movía y P8 seguía siendo la suscripción de la v1.2 por
> ASEPLUS. Ver `acreditacion-facultad-contrafirmante.md` §7.
>
> ⚠️ **Esa decisión fue REVISADA el 11-nov-2026.** El fundamento está en
> `sgsst-electron-app/docs/gestion-humana/firma-electronica/dictamen-legal-textos-2026-11-11.md`:
> el texto **sí cambia**, por versión nueva y con huella propia —el Anexo de Nube pasa a la **v1.3**
> y el Acuerdo a la **v1.6**—, porque los textos vigentes afirmaban hechos que dejaron de ser
> ciertos el 10-nov-2026. El control interno de la acreditación **se mantiene**. **P8 es ahora la
> suscripción de la v1.3** por ASEPLUS.

---

## 1. Por qué existe este segundo acto

El texto vigente del Anexo de Nube (la **v1.3**, §10) no es un contrato de una parte: lo
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
| Re-suscripción | `firma-service/src/routes/admin-empresas.js` | `POST .../anexo-suscrito/quitar`: la vía administrativa para volver a suscribir el Anexo de Encargo cuando el texto vigente cambia. Ver §3.6 |

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

**Y el manifiesto solo declara el TEXTO VIGENTE.** Los dos scripts comparan por **huella**: el
estado del bloque solo se escribe si la suscripción (y su contrafirma) es del texto que el
servidor está sirviendo ahora. Una suscripción de otro texto —la 2026-11-06 de ASEPLUS, que ya
está suscrita y contrafirmada— **no dice nada** del 2026-11-11. Sin esa comparación, el
manifiesto declararía «firmado» sobre un texto que nadie ha suscrito, con la huella del texto
vigente al lado: el gate compararía esa huella con la del archivo, no encontraría diferencia, y
cerraría un instrumento que no está. Cuando no hay suscripción contrafirmada del texto vigente,
el script **se niega** (código 4) y lo dice: cuántas contrafirmas hay y de qué textos son.

### 3.5. Antes de pedir la firma: la errata del 11-nov-2026

**El texto que ASEPLUS va a firmar es el texto corregido, y hay que decírselo.** El 11-nov-2026, antes
de la suscripción, se corrigieron dos defectos de cita en los dos textos de P8:

- El **§12 del Anexo de Nube v1.3** decía «Esta versión **1.2** remite» al Anexo de Encargo,
  dentro de un documento que es la v1.3 y contradiciendo la frase siguiente del mismo párrafo.
- El **Anexo de Encargo 2026-11-11** remitía en cuatro puntos (menú, §1, §5 y §9) al Anexo de Nube
  **v1.2**, un texto superado que su propia §5 incorpora por remisión (art. 44 de la Ley 527 de
  1999): lo que el vínculo incorporaba era el texto equivocado.

Son correcciones de cita: no cambian las partes, el objeto, las obligaciones ni la distribución del
riesgo. **Las etiquetas de versión no cambian** (v1.3 y 2026-11-11) y las versiones ya suscritas
(v1.1 y 2026-11-06) no se tocaron. Lo que cambia es la huella, y la anterior queda declarada en la
nota del manifiesto y en el Historial.

**La línea que hay que incluirle a ASEPLUS** (por correo, antes de pedirle la firma):

> Antes de la suscripción les informamos que el Anexo de Nube v1.3 y el Anexo de Encargo
> 2026-11-11 que van a firmar se corrigieron el 11 de noviembre de 2026, antes de ser susceptibles de
> suscripción: se corrigieron dos referencias de versión (en el §12 del Anexo de Nube y en cuatro
> puntos del Anexo de Encargo) que apuntaban a una versión anterior del Anexo de Nube. La corrección
> no cambia ninguna cláusula, obligación ni condición: son correcciones de cita. El texto vigente es
> el que adjuntamos, con su huella SHA-256, y es el que se firma.

Por qué la línea importa: el principio de buena fe del art. 3 de la Ley 527 de 1999 y el hecho de
que el firmante tiene que poder **aprobar inequívocamente** el contenido que firma (art. 7, literal
a). Un texto que se contradice a sí mismo no permite esa aprobación; y una errata disclosed no es
una sorpresa.

Detalle completo: `dictamen-legal-errata-textos-2026-11-11.md`.

### 3.6. La re-suscripción del Anexo de Encargo: la ruta que faltaba (11-nov-2026)

**P8 no es solo contrafirmar: el Anexo de Encargo de ASEPLUS está suscrito y contrafirmado sobre
el texto 2026-11-06, y hay que suscribir el 2026-11-11.** El servicio lo bloquea con `409
SUSCRIPCION_EXISTENTE`, y ese 409 solo se levanta si las **dos** fechas de la ficha
(`anexo_encargo_suscrito_at` y `anexo_encargo_firmado_at`) están en NULL: en un instrumento ya
firmado, las dos tienen fecha.

El manifiesto y la documentación ya prometían que «la re-suscripción va por el canal administrativo,
con su motivo». **La promesa no se cumplía**: el servicio tenía `desmarcarAnexoSuscrito()` —con
motivo obligatorio, rastro campo por campo y pruebas— y **ninguna ruta HTTP la llamaba**. La única
ruta de baja era `anexo-firmado/quitar`, que deshace el SEGUNDO acto y deja la fase 1 intacta. Sin
la ruta nueva, el instrumento no se podía volver a suscribir: era una capacidad prometida y no
existente.

```powershell
# 1. PRIMERO el segundo acto: la contrafirma (fase 2).
curl -X POST "https://firma.kair.fyi/internal/admin/empresas/<ID>/anexo-firmado/quitar" `
  -H "X-Admin-API-Key: <ADMIN_KEY>" `
  -H "X-Admin-Motivo: <POR QUE>" `
  -H "X-Admin-Actor: <QUIEN>"

# 2. DESPUES el primer acto: la suscripcion (fase 1).
curl -X POST "https://firma.kair.fyi/internal/admin/empresas/<ID>/anexo-suscrito/quitar" `
  -H "X-Admin-API-Key: <ADMIN_KEY>" `
  -H "X-Admin-Motivo: <POR QUE>" `
  -H "X-Admin-Actor: <QUIEN>"

# 3. Y ahora la suscripcion nueva, por el canal publico (el de la Empresa).
curl -X POST "https://firma.kair.fyi/internal/admin/empresas/<ID>/anexo-encargo/suscripcion" `
  -H "X-Admin-API-Key: <ADMIN_KEY>" `
  -H "Content-Type: application/json" `
  -d '{ "id_canal": "<SEGUNDO CANAL>" }'
```

**El orden importa**: al revés, la segunda llamada no encuentra la fase 2.

**Qué escribe y qué NO.** La ruta pone en NULL los **cuatro** campos de la fase 1 en la ficha
(`anexo_encargo_suscrito_at`, `_suscrito_version`, `_suscrito_hash` y `_suscrito_evidencia`), con el
valor anterior en el rastro append-only, el actor y el motivo. **No toca**
`anexo_encargo_firmado_at` (esa es la fecha del segundo acto: es otra ruta y otro motivo) y **no
toca ninguna fila** de `gh_firma_anexo_encargo_suscripciones`: la suscripción anterior queda
**FIRMADA**, con su evidencia, su acta y su contrafirma. Lo que se deshace es el puntero de la
ficha, no el hecho.

**Los errores que puede devolver**: `404 EMPRESA_NOT_FOUND`, `409 ANEXO_NO_REGISTRADO` (esa empresa
no tiene una suscripción registrada) y `400 MOTIVO_REQUERIDO` (sin `X-Admin-Motivo` la ruta no
quita nada). Sin llave, `401`.

**La vía del Anexo de Nube es otra y no usa esta ruta.** El Nube se desbloquea con la **premarca**
(`POST .../anexo-nube-firmado`, que registra en la ficha la versión y la huella del texto vigente
antes de que la Empresa suscriba) y después con una suscripción pública nueva. La premarca no toca
la suscripción anterior, que queda en la historia como texto ya suscrito.

**Verificado.** La ruta se desplegó el 11-nov-2026 y se comprobó por SSH: hash en disco
`ae0fff23…7aa2f0` (el del repo), servicio `active` con `NRestarts=0`, salud `ok`, y la ruta
respondiendo **401** sin llave mientras una ruta inexistente responde **404** (o sea: existe). Las
pruebas están en `tests/anexo-encargo-resuscripcion.test.js` (8 casos) y el detalle de la API, con
sus errores, en `API.md` §6.13.2 («Los nueve endpoints»).

**No tiene canal IPC**: como la contrafirma del Anexo de Nube, se ejecuta por HTTP contra el
servicio. La app de escritorio **muestra** el estado; no ejecuta el acto.

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
- **La v1.6 del Acuerdo ya está publicada; la Constancia ya tiene los datos del registro.** La
  publicación y el registro de la Constancia son actos del owner, distintos de la contrafirma, y ya
  se hicieron el 11-nov-2026: la v1.6 quedó **publicada** (`publicado: true` en el manifiesto) con su
  autorización operativa registrada (id 4) y es la versión activa en la base de producción; la
  Constancia de versión y autorización (`sgsst-electron-app/legal/constancia-aprobacion-acuerdo.html`,
  SHA-256 `aaf68b4e…d0b413`, 9 794 B) se **completó** con los datos del registro (el responsable del
  registro y la fecha del registro); sus secciones 5 y 6 siguen vacías porque la autorización vive en
  el registro de aprobaciones del servicio. Los actos que **quedan** de P8 son, en orden: **suscribir
  la v1.3** del Anexo de Nube y el **Anexo de Encargo 2026-11-11** por ASEPLUS, y contrafirmar.

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

> La respuesta se dio sobre el texto de entonces (la v1.2) y **sigue valiendo** para el texto
> vigente: la v1.3 conserva el §10 y la misma arquitectura de dos actos, así que **la contrafirma
> se sigue haciendo dentro del servicio**, por las mismas dos rutas. Lo único que cambió el
> 11-nov-2026 es la **versión del texto** (§5, al final), no el camino.

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

**La decisión de texto del 10-nov-2026 ya NO está abierta:** se queda como **control interno**
(opción A). Tal como se decidió aquel día, el texto vigente **no cambiaba**: no había v1.3, ni
huella nueva, ni republicación. La condición queda documentada en el expediente (registro de
poderes, acta, evidencia y manifiesto) y exigida por el gate. Ver
`acreditacion-facultad-contrafirmante.md` §7 y la tabla de instrumentos.

⚠️ **Esa decisión fue REVISADA el 11-nov-2026.** El fundamento está en
`sgsst-electron-app/docs/gestion-humana/firma-electronica/dictamen-legal-textos-2026-11-11.md`:
el texto **sí cambia**, por versión nueva y con huella propia. El Anexo de Nube pasa a la **v1.3**
(`fdd10551…2b585d`, 85 143 B, 11-nov-2026) y el Acuerdo a la **v1.6** (`08e1eb8b…52f13e`,
75 961 B, 11-nov-2026). Los motivos son otros: los textos vigentes afirmaban hechos que dejaron
de ser ciertos el 10-nov-2026 (el canal de correo y el papel de Google). El **control interno de
la acreditación se mantiene** y, además, la v1.3 tampoco recoge la exigencia de la faculty en
su §10: la acreditación sigue siendo lo que acredita la facultad, no lo que la dice el texto.
**P8 es ahora la suscripción de la v1.3** por ASEPLUS.

---

## 6. Las referencias

- **Decisión A** (9-nov-2026): `decision-regularizacion-correo-2026-11-09.md` — el marco del
  canal de correo y del CDPA.
- **Tabla única de instrumentos**: `tabla-instrumentos-vigentes-2026-11-09.md` — documento,
  versión, hash, fecha, suscripción y evidencia.
- **El texto vigente**: `sgsst-electron-app/legal/anexo-nube-v1.3.html` (85 143 B, SHA-256
  `fdd10551…2b585d`, fecha de vigencia 11-nov-2026), con su copia byte a byte igual en `sitio/`.
- **La v1.2, como referencia** (nunca fue suscrita): `sgsst-electron-app/legal/anexo-nube-v1.2.html`
  (84 062 B, SHA-256 `242037b3…1f7245`, 9-nov-2026). Su huella no se mueve: no se reescribe.
- **La v1.1, la que está suscrita** por ASEPLUS el 5-nov-2026 (62 198 B, SHA-256 `e9517536…591482`):
  no se toca.
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
