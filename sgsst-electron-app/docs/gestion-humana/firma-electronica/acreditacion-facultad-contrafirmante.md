# La acreditación de la facultad de quien contrafirma por Gesstiar (10-nov-2026)

> Documento de operación. Es la nota que deja por escrito **qué condicionó el abogado en la
> respuesta a P7**, **qué estaba implementado y qué no**, y **cómo se opera** a partir de ahora.
>
> **Estado:** implementado y verificado en el servicio (migraciones `061` y `062`, servicio
> `poderesEncargado`, tres rutas administrativas, comprobación en las dos contrafirmas, el acta,
> la evidencia, el manifiesto y el gate). **El acto no se ha hecho**: lo hace el operador de
> K+AIR sobre las suscripciones reales (P8).
>
> **Decidido por el owner (10-nov-2026):** la acreditación se queda como **control interno**
> (opción A). El texto vigente **no cambia**: no hay v1.3, la huella de la v1.2 no se mueve y P8
> sigue siendo la suscripción de la v1.2 por ASEPLUS. Quien contrafirma es **Javier Robles
> Fontalvo**, representante legal de Gesstiar, así que no hay que registrar ningún poder. Ver §7.

---

## 1. Qué dijo el abogado (respuesta a P7, 10-nov-2026)

> "La contrafirma del Anexo de Nube v1.2 se ejecutará dentro del servicio de firma electrónica
> K+AIR mediante el mecanismo de firma electrónica implementado, conservando identificación del
> firmante, manifestación expresa de voluntad, autenticación mediante código de un solo uso,
> cotejo de representación, fecha y hora, motivo, dirección IP, trazabilidad append-only, acta y
> huella SHA-256.
>
> La ejecución por una persona distinta del representante legal de Gesstiar S.A.S. requerirá
> acreditar previamente la facultad de representación o poder suficiente, que deberá conservarse
> en el expediente.
>
> Una eventual contrafirma externa solo podrá ser incorporada como acto válido para el expediente
> si existe evidencia íntegra, verificable y vinculada inequívocamente al instrumento y se registra
> posteriormente en K+AIR. Una contrafirma externa sin registro interno contrastable no permitirá
> cerrar `contrafirma_nube` ni habilitar el instrumento."

De las tres condiciones, la segunda es la que el código **no cumplía**: es la que se implementó
en esta jornada.

---

## 2. El contraste con el código (qué faltaba de verdad)

El código ya demostraba la facultad **del lado de la Empresa**: `_cotejarFirmante()`
(`src/services/anexoNube.js`) contrasta quién firmó contra el representante legal de la ficha
de esa Empresa, y sin ese cotejo no hay contrafirma.

Del lado de **Gesstiar** no había nada:

| Lo que hace falta | Antes de esta jornada | Ahora |
|---|---|---|
| Saber quién contrafirma | El nombre que llegaba en la cabecera `X-Admin-Actor` | Idéntico, pero **obligatorio**: sin actor no hay contrafirma (409) |
| Con qué poder | **Nada.** No se registraba ni se comprobaba ninguna facultad | Registro de poderes (`061`), con referencia y huella del documento |
| Que la acreditación quede en el expediente | **Nada** | El acta (sección 5), la evidencia del acto y el manifiesto la declaran |
| Que el gate lo exija | **Nada** | `contrafirma_nube` y `estado_encargo` no pueden quedar `ok` sin la acreditación |

Es decir: el acta decía **quién** firmó por K+AIR, pero no **con qué poder**. Un acta a medias.

---

## 3. Cómo está construido

### 3.1 El registro de poderes (migración 061)

`gh_firma_encargado_poderes` guarda una fila por poder, delegación o representación:

- `nombre` — quién tiene la facultad. Es el dato que se coteja con el actor del acto.
- `tipo` — `PODER`, `DELEGACION` o `REPRESENTACION`. Lo declara el operador.
- `instrumento_ref` — **obligatoria**: contra qué documento se acredita (número y fecha).
- `instrumento_sha256` — **obligatoria**: la huella SHA-256 del documento acreditativo.
- `documento_archivo` — el nombre del archivo en el expediente.
- `vigente_desde` / `vigente_hasta` — la ventana de vigencia (sin término declarado = sin fin).
- `estado` — `VIGENTE` o `REVOCADO`, con `revocado_at` y `revocado_motivo`.
- `motivo`, `registrado_por`, `ip`, `user_agent` — el acto, con su rastro.

`gh_firma_encargado_poderes_eventos` es el rastro **append-only** (migración `062`, con los
triggers que impiden alterar o borrar). La revocación **no borra** la fila: la deja en `REVOCADO`
con su fecha y su motivo, y escribe el evento. El expediente puede así decir que hubo un poder
vigente y que dejó de estarlo, sin que nadie pueda reescribir esa historia.

### 3.2 La comprobación (`services/poderesEncargado.js`)

`verificarFacultadContrafirmante(actor)` es la función que las dos contrafirmas llaman **antes**
de cerrar el segundo acto:

1. **Sin actor** → 409 `FACULTAD_NO_ACREDITADA`. No se sabe quién hizo el acto.
2. **Es el representante legal de Gesstiar** (el que declara el manifiesto legal,
   `legal-readiness.json` → `encargado.representante_legal`) → `REPRESENTANTE_LEGAL_ENCARGADO`.
   Es el caso que el abogado excluyó de la exigencia.
3. **Es otra persona** → tiene que haber un poder **VIGENTE** a su nombre
   (`PODER_ACREDITADO`), con su referencia y su huella. Si no hay, 409
   `FACULTAD_NO_ACREDITADA` y **el acto no se cierra**.
4. Un poder **vencido**, **revocado** o que **todavía no empieza** no sirve.

El cotejo de nombres no depende de las tildes ni de las mayúsculas (se comparan por codepoint).

### 3.3 Dónde queda escrito

- **El acta de contrafirma** (las dos: `actaAnexoNube.js` y `actaEncargo.js`): una sección
  nueva con la facultad, el instrumento y su huella.
- **La evidencia del acto** (`contrafirma_evidencia`): el objeto `facultad`.
- **El manifiesto** (`legal-readiness.json`): `anexo_nube.contrafirma_facultad` y
  `anexo_encargo.contrafirma_facultad`, leídos de esa evidencia (no inventados).
- **El gate**: `contrafirma_nube` y `estado_encargo` **exigen** la acreditación. Sin ella, el
  detalle dice qué falta y por qué.
- **El preflight** (`scripts/preflight-anexo-nube.js`): dice quién es el representante legal, qué
  poderes hay vigentes y si el actor configurado tiene la facultad. Si no la tiene, el motivo del
  preflight lo dice: el problema no es "falta la contrafirma", es "falta la facultad".
- **El panel del operador** (`modules/gestion-humana/firma-operador/index.js`): las dos vistas
  (Anexo de Nube y Anexo de Encargo) tienen una línea **"Facultad acreditada"** que dice quién
  contrafirmó y si lo hizo como representante legal de Gesstiar o con un poder acreditado. Si la
  contrafirma se hizo con un despliegue anterior y no hay acreditación, la línea dice
  "NO DECLARADA" y recuerda qué ítem del gate no puede quedar `ok`.

  Para que esa línea pueda leer la acreditación, la lectura
  (`GET /internal/admin/empresas/:id/anexos`) tiene que traer `contrafirma_evidencia` **en las
  dos** formas. En la del Anexo de Nube ya venía; en la del Anexo de Encargo faltaba, y por eso
  el panel del Encargo mostraba "NO DECLARADA" incluso con la facultad acreditada. Es el mismo
  tipo de verde falso que se corrigió en el gate, pero del lado contrario: un falso **negativo**
  que hace creer que falta lo que ya está en el expediente.

### 3.4 Las tres rutas administrativas

```
GET  /internal/admin/encargado/poderes            el registro, con su rastro
POST /internal/admin/encargado/poderes            alta de un poder
POST /internal/admin/encargado/poderes/:id/revocar  revocación
```

Exigen `X-Admin-API-Key` y `X-Admin-Motivo`. El motivo va en cabecera, como en el resto de los
actos administrativos del servicio.

Además, una cuarta ruta para el caso de una contrafirma hecha con un despliegue anterior:

```
POST /internal/admin/empresas/:id_empresa/anexo-nube/contrafirma/facultad
```

Certifica la facultad de una contrafirma **ya registrada** (comprueba el poder de quien hizo el
acto y escribe la acreditación en la evidencia y en el rastro). **No** toca `contrafirmado_at`,
ni la huella del acta, ni `anexo_nube_ejecutado_at`: el segundo acto ya ocurrió y no se reescribe.
Quien certifica es un testigo: la facultad que se certifica es la de quien hizo el acto.

---

## 4. Cómo se opera (P8)

### 4.1 Decidir quién contrafirma

- **Si contrafirma el representante legal de Gesstiar** (hoy: el que declara el manifiesto
  legal): no hace falta registrar ningún poder, pero **el actor tiene que declararse con ese
  nombre**. El servicio no lo deduce de la API key.
- **Si contrafirma otra persona**: primero se registra su poder por la vía administrativa
  (`POST /internal/admin/encargado/poderes`) y después se hace la contrafirma.

> **Decidido (owner, 10-nov-2026): contrafirma el representante legal**, Javier Robles
> Fontalvo. No hace falta registrar ningún poder para ese nombre. El valor quedó declarado en
> `firma-service/.env.example` y en `firma-service/deploy/.env.production.example` como
> `FIRMA_ADMIN_ACTOR=Javier Robles Fontalvo`.

### 4.2 El actor se declara, siempre

El actor llega en la cabecera `X-Admin-Actor` (o en `FIRMA_ADMIN_ACTOR` del lado de la app). Sin
actor, la contrafirma se rechaza con 409 `FACULTAD_NO_ACREDITADA`.

> **Ojo operativo:** el valor por defecto de la app es `K+AIR usuario@EQUIPO`, que **no** es el
> nombre de una persona y, por tanto, **no** tiene facultad acreditada. Con ese valor la
> contrafirma se rechaza. Hay que definir `FIRMA_ADMIN_ACTOR` con el nombre de quien va a
> contrafirmar (y acreditarlo si no es el representante legal).

> **Dónde se define, y por qué NO en el `.env` de la app de escritorio.** La app lee
> `FIRMA_ADMIN_ACTOR` del **entorno del proceso** (`process.env`), no de su `.env`: el cargador de
> `shared/env-loader.js` resuelve variables sueltas (las del correo) y no puebla `process.env`. Y
> el `.env` de la app **viaja DENTRO del instalador** (electron-builder no lo excluye), así que
> poner ahí un nombre de persona atribuiría los actos administrativos de **toda** copia instalada
> a esa persona. Por eso la variable se declara en el entorno del service (`.env` del
> `firma-service`, o variable de sistema en la máquina del operador), no en el de la app.

### 4.3 El orden

1. Registrar el poder (si quien contrafirma no es el representante legal).
2. `POST .../anexo-nube/contrafirmar/codigo` (sale al buzón de protección de datos de K+AIR).
3. `POST .../anexo-nube/contrafirmar` con el código, `acepta: true`, `X-Admin-Actor` y
   `X-Admin-Motivo`.
4. `node scripts/actualizar-manifiesto-anexo-nube.js` (y el del Encargo) para que el manifiesto
   declare el segundo acto **con** su faculty.
5. El gate deja de dar `contrafirma_nube` pendiente.

---

## 5. La contrafirma externa (la tercera condición)

El abogado admite una contrafirma externa **si** existe evidencia íntegra, verificable y
vinculada inequívocamente al instrumento, y **se registra después en K+AIR**.

Lo que hace el código hoy:

- La contrafirma **externa** no toca nada. `contrafirmado_at` y `anexo_nube_ejecutado_at` los
  escribe **solo** el servicio, en su ruta de contrafirma. Un acta firmada por fuera y dejada en
  un correo no cambia una sola fila.
- Por lo tanto, `contrafirma_nube` **no puede quedar `ok`** y el instrumento **no se habilita**:
  es exactamente lo que el abogado exige ("una contrafirma externa sin registro interno
  contrastable no permitirá cerrar `contrafirma_nube` ni habilitar el instrumento").
- La evidencia del acto que sí registra el servicio es contrastable: fecha, actor, motivo, IP,
  rastro append-only, acta con su huella SHA-256 y ahora también la faculty.

**Lo que NO se implementó** (y hay que decidir): una vía administrativa para *incorporar* una
contrafirma externa con su evidencia. No se hizo porque la condición del abogado exige, de
entrada, una noción de "evidencia íntegra y vinculada inequívocamente al instrumento" que hay
que definir con detalle (qué documento, quéChecks, quién lo certifica), y porque el owner
recomendó mantener exactamente la arquitectura ya construida. Si más adelante se quiere esa vía,
el sitio natural es una ruta admin análoga a `.../contrafirma/facultad`, con su actor, su motivo
y su rastro.

---

## 6. Los límites, dichos con claridad

- **Esto acredita la FACULTAD, no la IDENTIDAD.** Que la persona pueda firmar por Gesstiar es una
  cosa; que quien estaba escribiendo sea esa persona es otra. La identidad descansa en la API
  key administrativa y en el nombre que declara el operador. El acta lo dice por escrito.
- **El nombre es un dato declarado, no un dato probado.** El cotejo es entre el nombre del actor
  y el nombre del poder o del representante legal. Por eso el poder exige la huella del
  documento: es lo que permite después revisar el expediente.
- **El acta no se regenera.** En el caso raro de una contrafirma certificada después, el dato
  queda en la evidencia y en el rastro, no en el acta ya sellada (su huella no se puede
  cambiar).
- **La migración 061 tiene que estar aplicada en el servidor.** Si no está, el registro de
  poderes no existe y la comprobación falla **cerrada**: solo se acepta al representante legal
  declarado en el manifiesto.

---

## 7. La decisión del texto: TOMADA (10-nov-2026)

El §10 del texto vigente del Anexo de Nube v1.2 **no menciona** esta exigencia: describe el
segundo acto (fecha, actor, motivo y huella del acta) y el cotejo de quién firmó por la
Empresa, pero no la faculty de quien contrafirma por Gesstiar.

> **Decisión del owner (10-nov-2026): opción A · CONTROL INTERNO.** La acreditación queda en el
> expediente (registro de poderes + acta + evidencia + manifiesto + gate). **El texto no cambia:**
> no hay versión nueva, la huella de la v1.2 no se mueve, no hay nada que republicar en `legal/`
> ni en `sitio/`, y **P8 sigue siendo la suscripción de la v1.2 por ASEPLUS**, sin delaying.

Lo que se resolvió en el momento de la decisión:

| Pregunta | Respuesta | Consecuencia |
|---|---|---|
| ¿El §10 declara la exigencia? | **No.** Se queda como control interno | La v1.2 se suscribe tal cual está |
| ¿Hay v1.3? | **No** | La huella `242037b3…1f7245` no se mueve |
| ¿Otrosí del Anexo de Encargo? | **No** (tampoco hacía falta: el texto tampoco la menciona) | El Encargo 2026-11-09 se suscribe tal cual |
| ¿Quién contrafirma? | **Javier Robles Fontalvo**, representante legal de Gesstiar | No hay que registrar ningún poder |
| ¿Dónde se declara el actor? | `FIRMA_ADMIN_ACTOR` en el entorno del service | El preflight lo comprueba antes de pedir el código |

> **Lo que esta decisión NO cierra.** El control interno acredita que quien contrafirmó **podía**
> firmar por Gesstiar; no lo dice el texto que la Empresa suscribió. Si más adelante el abogado
> quiere que la condición quede **también** en el texto (por ejemplo, para un tercero que lea solo el
> Anexo), eso es una v1.3 y hay que hacerla **antes** de que ASEPLUS firme, con huella nueva y
> republicación. Queda anotado en la tabla de instrumentos y en el checklist, para que la decisión
> no se pierda.

---

## 8. Los archivos

| Archivo | Qué es |
|---|---|
| `firma-service/src/db/schema/061_encargado_poderes.sql` | El registro de poderes y su rastro |
| `firma-service/src/db/schema/062_encargado_poderes_append_only.sql` | Los triggers append-only (se saltan en test) |
| `firma-service/src/services/poderesEncargado.js` | El registro, la revocación y la comprobación |
| `firma-service/src/routes/admin-encargado.js` | Las tres rutas del registro |
| `firma-service/src/schemas/admin-encargado.js` | La validación de esos cuerpos |
| `firma-service/src/services/anexoNube.js` | La comprobación en la contrafirma del Nube + la certificación posterior |
| `firma-service/src/services/anexoEncargo.js` | La comprobación en la contrafirma del Encargo |
| `firma-service/src/services/actaAnexoNube.js` | La sección 5 del acta del Nube |
| `firma-service/src/services/actaEncargo.js` | La sección 5 del acta del Encargo |
| `firma-service/src/routes/admin-empresas.js` | La lectura de los anexos: trae `contrafirma_evidencia` en las **dos** formas |
| `firma-service/src/services/readinessLegal.js` | El gate: `contrafirma_nube` y `estado_encargo` exigen la acreditación |
| `firma-service/scripts/actualizar-manifiesto-anexo-nube.js` | El manifiesto declara `contrafirma_facultad` |
| `firma-service/scripts/actualizar-manifiesto-anexo-encargo.js` | Idem para el Encargo |
| `firma-service/scripts/actualizar-manifiesto-1047.js` | Conserva (no borra) la acreditación al publicar |
| `firma-service/scripts/preflight-anexo-nube.js` | Dice si el actor tiene la facultad antes de pedir el código |
| `firma-service/tests/poderes-encargado.test.js` | Las 20 pruebas del registro y de la comprobación |
| `firma-service/tests/routes/admin-empresas-anexos.test.js` | La lectura trae la acreditación en las dos formas |
| `modules/gestion-humana/firma-operador/index.js` | La línea "Facultad acreditada" del panel, en las dos vistas |
| `components/config/config-viewer.html` | El `?v=` del panel (`GH-20261110-facultad-contrafirmante`) |
