# Plan · Los Anexos en la app de escritorio K+AIR (operador + estado del cliente)

**Fecha:** 7 de noviembre de 2026
**Estado:** las tres decisiones del owner están tomadas (7-nov-2026). El plan está
para su revisión; ningún código de este plan está escrito todavía.
**Origen:** el owner: *"las suscripciones a anexo de encargo de las empresas tenga UI
así como ya lo tiene anexo en la nube y que pueda ser gestionado por la app para que
todo quede conectado"*.
**Relacionado:** `plan-suscripcion-anexo-encargo-2026-11-06.md` (📦1021, el flujo del
servicio, ya implementado hasta el 📦1032).

---

## 1. La respuesta corta

**El Anexo de Encargo ya tiene la pantalla que ve la Empresa. Lo que no tiene es la
pantalla que ve K+AIR.** Son dos mitades distintas y la segunda no existe en ningún
sitio: hoy el operador abre la consola, pega un `curl` con la admin key, y lee la
respuesta.

El plan de abajo construye esa segunda mitad:

| Pieza | Qué hace | Dónde vive |
|---|---|---|
| **El panel de operador** | Abre la suscripción, manda el enlace, verifica al representante, pide el código de contrafirma y contrafirma | Vista **nueva** en la app de escritorio, lado operador (admin key) |
| **El panel de estado del cliente** | Le dice al cliente si su Anexo está suscrito, si K+AIR ya lo contrafirmó, y por qué no puede firmar todavía | Vista **existente** `firma-electronica`, solo lectura |
| **Dos endpoints de lectura** | Los que hoy no existen: el estado de la Empresa (para el cliente) y el detalle de las suscripciones (para el operador) | `firma-service` |

El flujo **no cambia**: la Empresa se suscribe (fase 1) y K+AIR contrafirma (fase 2),
igual que hoy. Lo que cambia es **quién pulsa qué**: el operador deja de teclear
comandos y el cliente deja de enterarse del estado de su contrato por un error 409.

---

## 2. La premisa que hay que corregir (medido en el código)

El owner daba por hecho que el Anexo de Nube ya tenía UI en la app. **No la tiene**:
lo que tiene es la pantalla web que sirve el propio servicio. Y el Anexo de Encargo
**ya tiene esa misma pantalla**, construida en el 📦1026.

| Capa | Anexo de Nube | Anexo de Encargo |
|---|---|---|
| El texto | `legal/anexo-nube-v1.0.html` | `legal/anexo-encargo.html` |
| La pantalla que ve la Empresa | `firma-service/web/anexo-nube/` (4 142 + 5 769 + 4 028 B) | `firma-service/web/anexo-encargo/` (7 983 + 12 255 + 5 283 B) |
| Las rutas públicas | `src/routes/anexoNube.js` | `src/routes/anexoEncargo.js` (`:185`, `:211`, `:214`, `:227`, `:278`) |
| El flujo por `curl` del operador | `POST /internal/admin/empresas/:id/anexo-nube/suscripcion` (`src/routes/admin-empresas.js:289`) y `.../anular` (`:300`) | Las **cinco** de `src/routes/admin-empresas.js:337`, `:352`, `:387`, `:422`, `:454` |
| **UI en la app de escritorio** | **NO EXISTE** | **NO EXISTE** |

Las dos únicas apariciones de `anexo-encargo` en toda la app de escritorio son el
**documento HTML estático** que se muestra en la pantalla de privacidad
(`renderer.js:3757`, `main.js:2953`). No es el flujo de suscripción.

Y en `main/firma-client.js` (el cliente HTTP de la app contra el servicio) **no hay
ninguna ruta de anexos**: hay `admin/clientes` (`:774`, `:803`, `:824`, `:925`) y
`admin/empresas` (`:847` GET por id, `:871` PUT, `:897` POST), pero no el listado de
empresas ni ninguna de las siete rutas de los anexos.

**El Anexo de Nube tampoco tiene UI de operador.** Por eso la segunda decisión del
owner (que el plan cierre los dos anexos) no es un extra: es la mitad que falta de los
dos.

---

## 3. Las tres decisiones del owner (7-nov-2026)

| # | Decisión | Qué implica en el plan |
|---|---|---|
| 1 | El acto de K+AIR vive **en la app, lado operador** | Handlers IPC que usan la **admin key** (`secrets.enc.adminApiKey`), nunca la key de la Empresa |
| 2 | El plan cierra **los dos anexos** | Un panel de operador con el flujo completo del Encargo (abrir, verificar, contrafirmar) y el del Nube (abrir, anular) |
| 3 | El cliente ve el **estado de su Anexo** (solo lectura) | Un endpoint nuevo del servicio autenticado con la **API key de la Empresa** |

---

## 4. Las tres capas y dónde se corta cada una

```
   K+AIR (operador)                    Empresa (cliente)                Trabajador
        │                                    │                             │
        │  app de escritorio                 │                             │
        │  ┌──────────────────────┐         │                             │
        │  │ PANEL DE OPERADOR    │         │  ┌────────────────────┐     │
        │  │ (admin key)          │         │  │ PANEL DE ESTADO    │     │
        │  │ nuevo · solo lectura │         │  │ (key de la Empresa)│    │
        │  └──────────┬───────────┘         │  └─────────┬──────────┘     │
        │             │ admin key          │            │ key propia      │
        ▼             ▼                    │            ▼                 │
   ┌──────────────────────────────────┐    │   ┌──────────────────┐        │
   │  firma-service                   │    │   │  /internal/...   │        │
   │  rutas ADMIN  (7 rutas)  ◀───────┼────┼───┤                  │        │
   │  rutas CLIENT (1 nueva) ◀────────┼────┼───┤                  │        │
   │  rutas PUBLICAS (5) ─────────────┼────┼───┼──▶ pantalla web ─┼──▶ mini-app
   └──────────────────────────────────┘    │   └──────────────────┘        │
                                           │                             │
```

**El corte de seguridad está en la fila del medio.** El panel de operador usa la
**admin key** (`X-Admin-API-Key`), que es de K+AIR. El panel del cliente usa la **API
key de la Empresa** (`X-Internal-API-Key`), que solo puede leer su propia ficha. La
**contrafirma** solo existe en el lado del operador: es el acto de K+AIR y su código
sale al buzón de K+AIR (`config.canalProteccionDatos`), nunca al de la Empresa.

---

## 5. Lo que se construye

### 5.1 El servicio · el estado del cliente (endpoint nuevo)

**No existe.** Hoy no hay **ninguna** ruta autenticada con la API key de la Empresa que
devuelva datos de esa Empresa: lo más cerca es `GET /internal/acuerdo-activo`
(`src/routes/agreement.js:16`), que devuelve el Acuerdo, no la ficha. El middleware
`requireEmpresaScope` (`src/middleware/authz.js:200-207`) sí resuelve la identidad:
lee `X-Internal-API-Key` (`:108`), busca el cliente activo en `gh_internal_clients`
(`src/db/schema/009_internal_clients.sql:61-68`) y deja **`req.id_empresa`** (`:136-140`),
que es la única fuente autoritativa de la Empresa (la regla está escrita en
`src/middleware/authz.js:41-43`).

La ruta propuesta:

```
GET /internal/empresa/anexos
```

- **Auth**: `requireEmpresaScopeAndLimit()` (mismo patrón que el resto de `/internal`).
  **La Empresa sale de `req.id_empresa`, nunca de un parámetro del path**: si se acepta
  `:id_empresa` en la URL, `checkIdEmpresa` (`:171-181`) se encarga de que no se puedan
  leer los datos de otra empresa.
- **Cuerpo de la respuesta**: lo que devuelve el estado de la Empresa, reusando lo que
  ya existe sin cambiar su contrato:

  | Campo | De dónde sale |
  |---|---|
  | `anexo_encargo.estado` | derivado de `anexo_encargo_suscrito_at` + `anexo_encargo_firmado_at` |
  | `anexo_encargo.suscrito_at` / `.version` / `.hash` / `.evidencia` | `empresaService.getById()` — ya los trae (`src/services/empresa.js:96-109`) |
  | `anexo_encargo.firmado_at` | `gh_firma_empresas.anexo_encargo_firmado_at` (la fecha de **ejecución**) |
  | `anexo_nube.firmado` / `.fecha` / `.version` / `.hash` | `manifiestoLegal.datosAnexos({ id_empresa })` (`src/services/manifiestoLegal.js:133-213`), que ya cruza manifiesto y ficha |
  | `habilitacion.ok` / `.pendientes[]` / `.mensaje` | `empresaService.verificarHabilitacionFirma(id_empresa)` (`src/services/empresa.js:1279-1355`) |

  Ese último es el que da el mensaje que hoy solo aparece en el 409: *"suscribió el
  Anexo de Encargo, pero K+AIR todavía no lo ha contrafirmado: el instrumento no está
  ejecutado y la Empresa no puede firmar documentos de sus trabajadores"*
  (`src/services/empresa.js:1345-1349`). **La UI no reescribe ese texto: lo muestra.**

- **Lo que NO se devuelve**: el `id_suscripcion`, el token, el OTP, el `canal_codigo`
  completo ni el `representante_verificacion` crudo. Es un endpoint de estado, no un
  volcado de la tabla.

### 5.2 El servicio · la lectura de suscripciones para el operador (endpoint nuevo)

**Tampoco existe**, y sin esto el panel de operador no puede hacer su trabajo: las
tres acciones de la contrafirma (`verificar-representante`, `contrafirmar/codigo` y
`contrafirmar`) y el `anular` exigen el **`id_suscripcion`** en el path, y ese id
**no está** en la ficha de la Empresa ni en ninguna respuesta de lectura actual.

La ruta propuesta:

```
GET /internal/admin/empresas/:id_empresa/anexos
```

Devuelve, para los dos anexos, la suscripción viva (la última no anulada) con su
estado, su verificación del representante, su contrafirma, y **el rastro de eventos**
de `gh_firma_anexo_encargo_eventos` / `gh_firma_anexo_nube_eventos`.

**Requiere dos funciones nuevas en el servicio**, porque hoy no existen:

| Función | Dónde | Qué hace |
|---|---|---|
| `suscripcionesDeEmpresa(id_empresa)` | `src/services/anexoEncargo.js` (y el gemelo en `anexoNube.js`) | Lee las suscripciones de esa Empresa. Hay un patrón casi listo: `_firmaPrevia(id_empresa)` (`:529-533`) ya busca la última `FIRMADA`, pero es **privada** (prefijo `_`) y no se exporta |
| `eventosDeSuscripcion(id_suscripcion)` | los mismos dos servicios | Lee la tabla de eventos. **Hoy no existe ninguna función pública que lea los eventos**: `_evento()` (`:338-345`) solo inserta |

**El token en claro no se puede recuperar.** La base solo guarda `token_hash`
(`src/db/schema/056_anexo_encargo_suscripcion.sql:76`), y la ruta de `anular` devuelve
`{ anulada: true, id }` (`src/services/anexoEncargo.js:699`), no el enlace. Por eso el
panel tiene que **capturar el enlace en el momento en que abre la suscripción** (la
ruta de alta sí lo devuelve en claro: `src/services/anexoEncargo.js:656-664` y
`src/services/anexoNube.js:336-343`) y ofrecerlo para copiar. Ver la trampa 7.2.

### 5.3 El servicio · lo que ya existe y solo falta en la app

`GET /internal/admin/empresas` (`src/routes/admin-empresas.js:160`) ya devuelve el
listado con `empresaService.listConPendientes()` (`src/services/empresa.js:1226-1253`),
que trae `tiene_anexo`, `tiene_anexo_suscrito` y `faltan_requeridos`. **No hay que
tocarlo**: hay que exponerlo en `main/firma-client.js`, que hoy no lo tiene.

### 5.4 La app · los handlers IPC

`main/firma-bridge.js` registra hoy 29 canales `firma:*` (`:2291` a `:2504`), y
`preload.js:568-665` los expone al renderer como `window.electronAPI.firmaXxx`. La
respuesta IPC es `{ success: true, data }` o `{ success: false, error: { code, message,
extra } }` (`main/firma-bridge.js:58-65`).

**Operador** (usan la admin key; sin ella devuelven `ADMIN_TOKEN_REQUIRED`, con el
`remediationHint` que ya usa `_requireAdminToken()` en `:1489-1497`):

| Handler nuevo | Ruta del servicio |
|---|---|
| `firma:anexo:empresas` | `GET /internal/admin/empresas` |
| `firma:anexo:estado` | `GET /internal/admin/empresas/:id_empresa/anexos` (5.2, nuevo) |
| `firma:anexo:suscripcion` | `POST /internal/admin/empresas/:id_empresa/anexo-encargo/suscripcion` |
| `firma:anexo:nube-suscripcion` | `POST /internal/admin/empresas/:id_empresa/anexo-nube/suscripcion` |
| `firma:anexo:verificar-representante` | `POST .../anexo-encargo/suscripcion/:id_suscripcion/verificar-representante` |
| `firma:anexo:contrafirma-codigo` | `POST .../anexo-encargo/contrafirmar/codigo` |
| `firma:anexo:contrafirmar` | `POST .../anexo-encargo/contrafirmar` |
| `firma:anexo:anular` | `POST .../anexo-encargo/suscripcion/:id_suscripcion/anular` |
| `firma:anexo:nube-anular` | `POST .../anexo-nube/suscripcion/:id_suscripcion/anular` |

**Cliente** (usa la API key de la Empresa, resuelta por `companyName` como en
`firma:sign-request:get`):

| Handler nuevo | Ruta del servicio |
|---|---|
| `firma:empresa:anexos` | `GET /internal/empresa/anexos` (5.1, nuevo) |

**Diagnóstico** (para que la vista sepa qué mostrar, **sin exponer el secreto**):

| Handler nuevo | Qué hace |
|---|---|
| `firma:config:admin-diag` | Dice si hay admin key configurada y de dónde viene (`secrets` o `env`), **nunca** el valor. El patrón del prefijo no reversible ya existe en `firma:config:set-admin-key` (`main/firma-bridge.js:2254-2270`) |

**Los tres headers que el panel tiene que mandar bien**, porque el servicio los exige:

| Header | En qué rutas | Consecuencia si falta |
|---|---|---|
| `X-Admin-API-Key` | las 9 de operador | `401 INVALID_API_KEY` |
| `X-Admin-Motivo` | `anular`, `verificar-representante`, `contrafirmar` | `400 MOTIVO_REQUERIDO` (`src/services/anexoEncargo.js:689-693`, `:757-761`, `:1549-1553`) |
| `X-Internal-API-Key` | la de cliente | `401 INVALID_API_KEY` |

`X-Admin-Motivo` **no** se pide en `suscripcion` ni en `contrafirmar/codigo`: el plan
no lo inventa donde el servicio no lo exige.

### 5.5 La app · el panel de operador (vista nueva)

**Vista nueva**, no unsection nueva de la existente: el módulo `firma-electronica`
es **por empresa** (trabaja con `self.companyName`), y el panel de operador es
**entre empresas**. Meterlo ahí mezclaría las dos cosas.

| Pieza | Ruta |
|---|---|
| La vista | `sgsst-electron-app/modules/gestion-humana/firma-operador/index.js` + `index.css` |
| El registro en el nav | 📦1042 · **saco**: ya no hay entrada en el nav de Gestión Humana |
| La carga en la app | 📦1042 · `sgsst-electron-app/components/config/config-viewer.html` (la hoja y el script, **con su `?v=`**) |

> 📦1042 · **La ubicación cambió.** El plan original lo puso en el nav de
> Gestión Humana como "Anexos". El owner lo corrigió: *eso no le compete a
> Gestión Humana*. Los anexos son una gestión de **K+AIR** (credencial
> administrativa, por empresa) y ahora viven **en Configuración → Gestión de
> Empresas → la ficha de la empresa → "Configurar Firma Electrónica" → al
> final del modal**. El componente es el mismo, en **modo embebido**: sin
> tabla general, sin header y sin modal propio.

El patrón de la vista es el del módulo existente: IIFE con prototipo
(`FirmaElectronicaComponent.prototype.render / _getShellHtml / _cacheRefs /
_setupListeners / _load`, `modules/gestion-humana/firma-electronica/index.js:215-503`),
prefijo de clases nuevo (`fo-`), tokens del design system
(`sgsst-electron-app/design_system.md` §3 y §11) y el modal en `<body>` con tokens
scoped (§5.3 del design system).

**Qué muestra**, en una fila por empresa:

- Razón social, NIT, y el estado del Anexo de Encargo con sus cuatro estados posibles:
  **no suscrito · suscrito (esperando contrafirma) · ejecutado · con la excepción
  vigente**.
- El estado del Anexo de Nube: no suscrito · suscrito · firmado.
- El botón **Abrir suscripción** (Encargo o Nube), que abre un modal con los campos que
  el servicio exige: `correo_firmante`, `canal_codigo`, `canal_codigo_confirmacion`,
  `nombre_firmante`, `cargo_firmante` y `datos_empresa`
  (`src/schemas/admin-empresas.js:124-151`; para el Nube, solo `correo_firmante`,
  `nombre_firmante` y `cargo_firmante`, `:85-94`).
- El enlace que devuelve el alta, con botón de copiar, y el aviso de que **el
  servicio ya mandó el correo de invitación** (`src/services/anexoEncargo.js:628` →
  `mailer.sendAnexoEncargoInvitacion`; el Nube en `src/services/anexoNube.js:308`).
- Las acciones de la contrafirma, en el orden que el servicio impone: **verificar el
  representante** (con `tipo_documento` y `referencia`), **pedir el código** (que sale al
  buzón de K+AIR), **contrafirmar** (los seis dígitos y `acepta: true`).
- **Anular**, con el motivo.

**El paso que la UI no puede saltarse**: `contrafirmar/codigo` exige que la suscripción
esté `FIRMADA` **y** que tenga `representante_verificacion`
(`src/services/anexoEncargo.js:1437-1458`; si falta, `409
REPRESENTANTE_NO_VERIFICADO`). La UI refleja ese orden: el botón de contrafirma no
aparece hasta que hay verificación.

**Si no hay admin key**, la vista muestra una tarjeta que explica que es una vista de
operador y que la key se configura en Configuración → Firma Electrónica. **No se
esconde la pestaña**: el nav es un arreglo estático (`gestion-humana-home.js:14-25`) y
ocultarla exigiría una comprobación asíncrona antes de pintar. Una pestaña que se
explica es más descubrible que una que no está.

### 5.6 La app · el panel de estado del cliente

Va **dentro** de la vista que el cliente ya usa, arriba de todo
(`modules/gestion-humana/firma-electronica/index.js`), como una tarjeta con:

- El estado del Anexo de Encargo de la empresa activa, en el mismo lenguaje del
  servicio: *ejecutado* (con la fecha) · *suscrito, pendiente de contrafirma de K+AIR*
  · *no suscrito*.
- El botón **Ver el documento** (la ruta pública `GET /anexo-encargo/documento`, que ya
  responde 200 en producción) y el enlace a la **política de privacidad**.
- Cuando el Anexo no está ejecutado, el motivo del bloqueo, con el texto del servicio.

**Hoy no hay nada de esto**: el módulo no consulta el estado de habilitación (cero
coincidencias de `habilitac` o `EMPRESA_NO_HABILITADA` en sus 3 037 líneas). El
cliente se entera del problema **cuando intenta firmar** y recibe el 409. El panel no
cambia el bloqueo: **lo hace visible antes**.

### 5.7 Lo que la UI **no** hace

- **No pide ni guarda el código de contrafirma.** Sale al buzón de K+AIR y el operador
  lo transcribe. La UI no lo persiste en ninguna parte.
- **No manda el correo de la invitación.** El servicio lo manda (`src/services/anexoEncargo.js:628`).
  La UI solo muestra el enlace que la alta devuelve.
- **No actualiza el manifiesto ni el gate.** Eso es `scripts/actualizar-manifiesto-anexo-encargo.js`
  y `scripts/preflight-anexo-encargo.js`, en el servidor, y no se tocan. Ver la trampa 5.3.

---

## 6. El plan de trabajo

El **📦1033 ya está reservado** para el fix del preflight (el EACCES de
`backup-firma.sh` y el `coincide` que miente), que está pendiente de autorización del
owner. Esta tanda arranca en el 📦1034.

> **Cómo quedó esa tabla.** La columna de estado se agregó el 7-nov-2026, cuando la
> tanda se terminó. El párrafo de arriba se conserva como se escribió: al momento de
> redactar el plan, el 📦1033 efectivamente estaba pendiente de autorización. Lo que
> pasó después está en la §12.

| # | Qué | Qué incluye | Estado (7-nov-2026) |
|---|---|---|---|
| 📦1033 | **El fix del preflight** | El `EACCES` del script de respaldo y el `coincide` que miente | **Hecho** (en el working tree, sin commitear) |
| 📦1034 | **El plan** | Este documento | **Hecho** (commiteado: `2bceca13`) |
| 📦1035 | **El servicio · la lectura para el operador** | `suscripcionesDeEmpresa()` y `eventosDeSuscripcion()` en los dos services + `GET /internal/admin/empresas/:id/anexos` + los tests | **Hecho** |
| 📦1036 | **El servicio · el estado del cliente** | `GET /internal/empresa/anexos` + el test que **prueba que no cruza empresas** + el test que prueba que la respuesta no trae `token`, `otp` ni el canal completo | **Hecho** |
| 📦1037 | **La app · la capa HTTP y los handlers** | Los 10 métodos nuevos en `main/firma-client.js` + los 11 handlers en `main/firma-bridge.js` + el mapeo de `preload.js` + los tests del bridge | **Hecho** |
| 📦1038 | **La app · el panel de operador** | `modules/gestion-humana/firma-operador/` + el registro en el nav + el `?v=` de `index.html` + los guards de la vista | **Hecho** |
| 📦1039 | **La app · el panel de estado del cliente** | La tarjeta nueva en `firma-electronica/index.js` + sus guards | **Hecho** |
| 📦1040 | **Los documentos** | `API.md` (§6.22, la API de la app y los endpoints nuevos), `FLOWS.md` (hoy **no menciona** el Anexo de Encargo), `Historial.md`, `PROMPT.md`, `CONTEXT.md` y este plan | **Hecho** |

> **Lo que no se midió en esta tanda.** La suite completa del `firma-service` la mide el
> owner: los dos archivos de prueba de los endpoints nuevos (`tests/routes/empresa-anexos.test.js`
> y `tests/routes/admin-empresas-anexos.test.js`) se escribieron en paralelo a esta tanda.
> Del lado de la app, los tres archivos nuevos (`main/test-anexos-1037.js`,
> `main/test-anexos-1038.js`, `main/test-anexos-1039.js`) dan **36 en verde** (22 + 11 + 3).

Cada commit de código lleva sus tests, y cada test tiene que **morder**: si vuelve el
defecto, tiene que fallar (PROMPT.md §7.1-§7.2). Los documentos van en el último, como
siempre.

---

## 7. Los riesgos y las trampas

### 7.1 La admin key en el PC del cliente

La app **puede** guardar la admin key en `secrets.enc` (`firma:config:set-admin-key`,
`main/firma-bridge.js:2235-2271`). Si esa key llega a la máquina de un cliente, ese
cliente puede contrafirmar su propio Anexo de Encargo — que es el acto que le
corresponde a K+AIR — y además crear y revocar clientes de otras empresas.

Hoy no está expuesto: la key real vive en `/opt/kair-firma/admin-key.txt` (600 root) y
en la app solo entra si alguien la pega. **La regla que este plan propone: la admin key
es del operador, se pega en la instalación del operador y no se comparte ni se
documenta.** Si algún día se reparte a un cliente, el panel de operador deja de ser un
control y pasa a ser un botón.

### 7.2 El token en claro no es recuperable

La base solo guarda `token_hash` (`src/db/schema/056_anexo_encargo_suscripcion.sql:76`).
El enlace existe **una sola vez**, en la respuesta del alta. Si el operador cierra la
modal sin copiarlo, la suscripción queda viva pero el enlace se pierde, y **no hay
"reenviar la invitación"**: lo que hay es anular (con motivo) y abrir otra. El correo
de invitación es el canal real; el enlace de la UI es la red de seguridad. La UI tiene
que decirlo, no esconderlo.

### 7.3 `FIRMADA` no es "ejecutado"

En el servicio, `FIRMADA` significa **que la Empresa suscribió** (fase 1)
(`src/services/anexoEncargo.js:71-77`, `:151-158`). El instrumento está ejecutado solo
con `contrafirmado_at` **y** con `gh_firma_empresas.anexo_encargo_firmado_at`. Si la
UI muestra "FIRMADA" como si fuera "listo", el operador cree que el Anexo está listo y
la Empresa sigue bloqueada con el 409. **La UI tiene que decir "suscrito" y
"ejecutado", no "firmado".**

### 7.4 El gate no se mueve solo

El gate `primera_firma` mira `anexo_encargo_firmado_at` —la fecha de **ejecución**— y
no `anexo_encargo_suscrito_at`
(`src/services/readinessLegal.js:324-347`, y los ítems `anexo_encargo::estado_encargo`
`:1770-1789` y `anexo_encargo::empresas_base` `:1810-1827`). Y el manifiesto
(`legal-readiness.json → anexo_encargo.estado`) lo escribe
`scripts/actualizar-manifiesto-anexo-encargo.js`, no la app. **Contrafirmar desde la UI
no cierra el gate**: después hay que correr el preflight y el manifiesto en el servidor,
como en el piloto.

### 7.5 El código de contrafirma va al buzón de K+AIR

Sale a `config.canalProteccionDatos` (`privacidad.kair@gmail.com`), fijo en la
configuración (`src/config.js`), con propósito de derivación propio. El operador lo
recibe en su correo y lo transcribe. **La UI no lo pide en el campo de "código" de
alguien que no sea el operador**, y no lo guarda.

### 7.6 El código de la Empresa sale a otro canal

El código de la **fase 1** sale a `canal_codigo`, que el servicio exige que sea
**distinto** de `correo_firmante` (`src/schemas/admin-empresas.js:124-151`), y el
correo de invitación dice exactamente eso: *"El código y el enlace NO vienen en el
mismo mensaje ni al mismo canal"*. El modal de alta tiene que **explicar** por qué pide
dos correos distintos, o el operador va a poner el mismo y la alta va a fallar.

### 7.7 La versión y la huella salen de fuentes distintas

El Anexo de **Encargo** toma la versión y la huella del **manifiesto**
(`src/services/anexoEncargo.js:275-319`) y da `503 ANEXO_ENCARGO_NO_DISPONIBLE` si el
archivo del servidor no coincide. El Anexo de **Nube** las toma del **archivo**
(`src/services/anexoNube.js:122`). La UI muestra de dónde sale cada una, porque el
mismo botón se comporta distinto en cada anexo.

### 7.8 La Invitación puede fallar

Si el correo no sale, el alta responde `502 ENVIO_FALLIDO` y la fila queda `ANULADA`
(`src/services/anexoEncargo.js:639-649`). La UI tiene que mostrar ese error y **no**
dejar think que hay una suscripción viva.

### 7.9 Los guards de UI no prueban que se vea bien

PROMPT.md §7.1-§7.2: un check estático no es "el texto existe", y para UI casi todo lo
que se rompe es un texto que dejó de estar. La tarjeta nueva del panel de operador y
la del panel de cliente necesitan guards **con cota y motivo**, y mutation testing:
el guard tiene que **morder** si el botón, el texto o el estado se borran.

### 7.10 El `?v=` y el EOL

`sgsst-electron-app/index.html` carga la hoja y el script de cada módulo con un `?v=`
(`:58` y `:482`): tocar un archivo propio **obliga** a bumpear su versión
(`design_system.md` §8). Y el EOL de cada archivo está fijado por su test: se cambia
solo con el script del repo.

### 7.11 Los 5 app passwords de Gmail sin rotar

El correo de invitación sale por SMTP con el canal de K+AIR. Si esa cuenta está
comprometida, el enlace de suscripción sale de un buzón comprometido. El riesgo ya
está aceptado por el owner (piloto ASEPLUS); este plan **lo hereda** y no lo empeora,
pero conviene que la lista de pendientes lo tenga en cuenta.

---

## 8. Lo que NO cambia

- **El texto de los anexos**, su versión, su huella y el manifiesto.
- **La fase 1 y la fase 2.** La Empresa se suscribe y K+AIR contrafirma, igual que hoy.
  Cambia **quién pulsa**, no qué se firma ni en qué orden.
- **El gate y la excepción 5.** La excepción 5 de ASEPLUS sigue vigente hasta que el
  Anexo esté ejecutado, y se cierra después, por su cuenta.
- **La app no pasa a ser cliente del servicio.** La API key de la Empresa sigue siendo
  la que firma los documentos de sus trabajadores.
- **La contrafirma no se mueve a la app del cliente**, por el §7.1.
- **El preflight y el script del manifiesto** no se tocan: siguen siendo de consola en
  el servidor, y son la puerta que verifica el resultado de lo que la UI hizo.

---

## 9. Las decisiones que tomé (y las que quedan abiertas)

**Tomadas en este plan** (las que no necesitaban al owner):

1. **El panel de operador es una vista nueva** (`firma-operador`), no una sección del
   módulo `firma-electronica`: uno es entre empresas y el otro es de una.
2. **El estado del cliente va dentro de la vista que el cliente ya usa**, arriba de
   todo: es el lugar donde el cliente ya está mirando.
3. **El endpoint del cliente se llama `/internal/empresa/anexos`** y toma la Empresa de
   `req.id_empresa`, nunca de un parámetro. Sin `:id_empresa` en el path no hay
   `checkIdEmpresa` que proteger.
4. **La pestaña de operador siempre se ve.** Si no hay admin key, explica por qué.
5. **La UI no reescribe los mensajes del servicio.** El texto del "suscribió pero K+AIR
   no contrafirmó" lo produce `verificarHabilitacionFirma` y la UI lo muestra.

> 📦1042 · **La decisión 1 cambió de lugar, no de sustancia.** El panel sigue
> siendo un componente propio (no una sección de `firma-electronica`), pero
> **no está en el nav de Gestión Humana**: el owner lo movió a
> **Configuración → Gestión de Empresas → "Configurar Firma Electrónica"**,
> al final del modal. Su razón: *los anexos no le competen a Gestión
> Humana*. La decisión 4 (siempre visible, explica por qué) sigue valiendo:
> sin admin key, la sección explica dónde configurarla.

**Abiertas** (para el owner, cuando toque):

6. ¿El panel de operador también debe abrir y cerrar **excepciones de habilitación**
   (`src/routes/admin-excepciones.js`)? Hoy quedan fuera de este plan: son otro acto,
   con otro ciclo de vida, y el piloto ya tiene la suya.
7. ¿La app del operador debe poder **descargar las actas** (suscripción y contrafirma)
   a un disco local, o basta con verlas y copiarlas? Las actas viven en
   `storage/pdfs/actas` y hay una ruta pública (`GET /api/anexo-encargo/:token/acta`).

---

## 10. La verificación

| Qué | Cómo |
|---|---|
| El servicio no se rompe | La suite del `firma-service` (hoy **2401 · 2399 pass · 0 fail · 2 skipped**) con el Node de Electron (PROMPT.md §7.8) |
| El endpoint del cliente no cruza empresas | Un test que pide el estado con la key de la empresa A y verifica que **nunca** puede ver los datos de la B (patrón: `tests/integration/per-company-isolation.test.js`) |
| La respuesta del cliente no filtra secretos | Un test que falla si la respuesta trae `token`, `otp`, `otp_hash` o el `canal_codigo` sin enmascarar |
| Los handlers de la app | `main/test-firma-bridge.js` (el patrón de mock de `ipcMain` ya está) + los tests nuevos de los 11 handlers |
| La UI | Guards con cota y motivo (§7.9), no "el texto existe" |
| El recorrido completo | Manual, en la instalación del operador: abrir suscripción → el correo llega → la Empresa suscribió → verificar representante → pedir código → contrafirmar → el estado del cliente cambia a *ejecutado* → y **el gate sigue pendiente hasta que corran el preflight y el manifiesto en el servidor** |

---

## 11. Lo que este plan NO arregla

Están abiertos y son de otro dueño:

- Los **5 app passwords de Gmail sin rotar** (y la revisión de accesos).
- El **nodo en EOL** (Node 20.20.2 en el servidor) y la **copia off-site** de los
  respaldos.
- El **vínculo con Google**, que es el único pendiente del gate `primera_firma` que no
  depende del código.
- El **dictamen J1-J14** del abogado y la fecha de vigencia.

---

## 12. Cómo quedó

> Esta sección la escribió el worker de documentación al cerrar la tanda. El
> resto del plan queda como está: es el documento aprobado.

### 12.1 Qué se construyó

Las **cinco piezas** del §1 están, y ninguna quedó a medias:

| Pieza | Dónde quedó | Cómo se sabe que está |
|---|---|---|
| **Los dos endpoints de lectura** | `GET /internal/empresa/anexos` (`src/routes/empresaAnexos.js`) y `GET /internal/admin/empresas/:id_empresa/anexos` (`src/routes/admin-empresas.js`) | Sus pruebas: `tests/routes/empresa-anexos.test.js` y `tests/routes/admin-empresas-anexos.test.js` |
| **La capa HTTP y los handlers** | 10 métodos en `main/firma-client.js`, 11 handlers en `main/firma-bridge.js`, el mapeo en `preload.js` | `main/test-anexos-1037.js` (22 en verde) |
| **El panel del operador** | `modules/gestion-humana/firma-operador/` (`index.js` + `index.css`), en el nav de Gestión Humana como **"Anexos"**, con su `?v=` en `index.html` | `main/test-anexos-1038.js` (11 en verde) |
| **El panel de estado del cliente** | La tarjeta nueva arriba de todo en `modules/gestion-humana/firma-electronica/index.js` | `main/test-anexos-1039.js` (3 en verde) |
| **Los documentos** | `API.md` §6.22 (los dos endpoints y los once canales), `FLOWS.md` (los flujos 11 y 12, que antes no mencionaban el Anexo de Encargo), `Historial.md`, `PROMPT.md` y `CONTEXT.md` | La revisión del diff |

Las **dos funciones nuevas de lectura** que el §5.2 pedía existen en los dos
services (`suscripcionesDeEmpresa()` y `eventosDeSuscripcion()`), y la
suscripción que se muestra es **la más reciente** (`id DESC`, se toma la
primera), con el rastro de **esa** suscripción.

### 12.2 Qué se decidió

1. **Las tres decisiones del owner** (§3) quedaron implementadas tal cual: el
   acto de K+AIR vive en la app lado operador con la **admin key**, el plan
   cierra **los dos anexos**, y el cliente ve **el estado de su Anexo** en
   solo lectura.
2. **Las cinco decisiones que tomó este plan** (§9) siguen válidas, y ahora
   están escritas en el código: el panel del operador es una vista nueva, el
   estado del cliente va dentro de la vista que el cliente ya usa, el endpoint
   del cliente se llama `/internal/empresa/anexos` y toma la Empresa de
   `req.id_empresa`, la pestaña de operador siempre se ve (se explica si no hay
   admin key), y **la UI no reescribe los mensajes del servicio**.
3. **Las tres reglas que no se cruzan** quedan como criterio escrito, y cada
   una tiene su código detrás: la admin key **es del operador** y nunca se
   comparte con un cliente; la **contrafirma no tiene versión de cliente** (su
   código sale al buzón de K+AIR); y el **estado del cliente va con la API key
   de la Empresa**, en una ruta **sin `:id_empresa`**.
4. **Las dos decisiones abiertas** (§9, numerales 6 y 7) siguen abiertas: el
   panel **no** gestiona las excepciones de habilitación, y **no** descarga las
   actas a un disco local: las muestra y las copia.

### 12.3 Qué NO cambió

- **El texto de los anexos**, su versión, su huella y el manifiesto.
- **La fase 1 y la fase 2**: la Empresa se suscribe y K+AIR contrafirma, igual
  que antes. Cambia **quién pulsa**, no qué se firma ni en qué orden.
- **El gate y la excepción 5**: la excepción 5 de ASEPLUS sigue vigente hasta
  que el Anexo esté ejecutado, y se cierra después, por su cuenta.
- **El preflight y el script del manifiesto**: siguen siendo de consola en el
  servidor. Contrafirmar desde la app **no** cierra el gate: después hay que
  correrlos, como en el piloto.
- **La app no pasó a ser cliente del servicio**: la API key de la Empresa
  sigue siendo la que firma los documentos de sus trabajadores.
- **La producción no se toca.** El texto de los anexos, los hashes y los
  estados del servidor no cambian por esta tanda.

### 12.4 El piloto ASEPLUS sigue pendiente

**El piloto con ASEPLUS NO se ha hecho.** La app deja al operador frente a la
consola **más cómoda**, no lo reemplaza: hasta que una Empresa se suscriba por
el enlace y K+AIR contrafirme desde la app, el flujo nuevo está probado pero
**no ejercido en el ambiente real**. Sigue en pie, y en este orden:

1. El **deploy** del flujo (el mismo guion del 6-nov), que ahora incluye los
   dos endpoints nuevos y los once canales.
2. El **piloto**: se suscribe por el enlace y K+AIR contrafirma.
3. El **preflight** y el **manifiesto** en el servidor, y recién entonces se
   re-mide el gate.
4. **Rotar los 5 app passwords de Gmail** antes de que el flujo se anuncie a
   otra Empresa: el correo de invitación sale por SMTP con el canal de K+AIR.

Y siguen abiertas, sin cambio, las dos decisiones del §9 (numerales 6 y 7) y
los pendientes del §11.
