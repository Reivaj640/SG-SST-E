# Verificación de scopes OAuth de Google - K+AIR

**Versión del documento**: 1.0
**Fecha**: 2026-10-07
**Estado**: Completo. La decisión sobre `gmail.compose` ya está tomada: **se sacó del código**. K+AIR pide **4** scopes.
**Autor**: K+AIR (Mavis)
**Audiencia**: quien administre el proyecto de Google Cloud de K+AIR (owner del producto)

> **Este documento es interno.** No es para usuarios finales ni va en `sitio/`.
> Es la copia canónica de los textos que se envían a Google. Existe porque esa
> información solo puede vivir en una consola web, donde nadie la vuelve a
> encontrar, y porque la verificación hay que **renovar cada 12 meses** con un
> formulario que pide reenviarlo todo.

---

## Tabla de contenidos

1. [Para qué existe este documento](#1-para-qué-existe-este-documento)
2. [Los cuatro scopes](#2-los-cuatro-scopes)
3. [Las justificaciones, listas para pegar](#3-las-justificaciones-listas-para-pegar)
4. [Dónde se envían](#4-dónde-se-envían)
5. [Qué pide Google además de las justificaciones](#5-qué-pide-google-además-de-las-justificaciones)
6. [Límites que no controlamos](#6-límites-que-no-controlamos)
7. [`gmail.compose`: por qué no se pide](#7-gmailcompose-por-qué-no-se-pide)
8. [Evidencia en el código](#8-evidencia-en-el-código)

---

## 1. Para qué existe este documento

K+AIR pide cuatro scopes OAuth a Google. Antes de que Google permita quitar la
pantalla de "app no verificada", hay que declarar esos mismos scopes en la
consola y justificar **cada uno por separado**, incluyendo por qué un permiso más
acotado no sirve.

Ese formulario se llena en la consola, pero la redacción vive acá. Cuando se
envíe la verificación hay que:

1. Copiar cada texto de la sección 3 al campo correspondiente de la consola.
2. Copiar este archivo completo (o la sección 3) al ticket interno de seguimiento.
3. Anotar abajo la fecha del envío y el número de radicado que devuelve Google.

---

## 2. Los cuatro scopes

Declarados en `shared/google-auth.js:109-122`. La clasificación es la oficial de
Google y **no es negociable**: determina el proceso de revisión.

| Scope | Categoría oficial | Qué habilita en K+AIR |
|---|---|---|
| `gmail.readonly` | **Restringido** | Ver correos y adjuntos en la Bandeja Integrada |
| `gmail.modify` | **Restringido** | Marcar leído/no leído y archivar |
| `gmail.send` | Sensible | Responder, reenviar y redactar |
| `calendar` | Sensible | Leer **y escribir** la agenda |

Dos son restringidos, así que la revisión de las sensitive (~10 días hábiles) no
alcanza: aplica la **revisión restringida**, que tarda del orden de **6 semanas** y
exige además un video de demostración.

Un quinto scope, `gmail.compose`, se pedía antes y **se quitó**: el código nunca lo
usó. Ver la sección 7.

### La buena noticia: no hay que pagar evaluación de seguridad

Google exige evaluación de seguridad de un tercero (~USD 500/año, repetible cada
12 meses) a las apps que piden datos restringidos **y que pueden acceder a esos
datos desde o a través de un servidor de terceros**.

K+AIR hoy no califica para eso: habla con Google desde el proceso principal de
Electron y guarda todo en un SQLite local (`kair.db`, en el perfil del usuario).
No hay backend de correo.

**Esto es una condición, no una propiedad permanente.** Si el `firma-service`
empieza a recibir correos, o se mueve la lógica a un servidor, hay que reevaluar
y la exención se cae.

---

## 3. Las justificaciones, listas para pegar

Cada bloque es el texto exacto para su campo. Están en español porque es el
idioma de trabajo del proyecto; si el revisor los rechaza por idioma, se traducen.

### 3.1 `gmail.readonly` (restringido)

```
Necesario para que la Bandeja Integrada de K+AIR muestre al usuario sus correos
dentro de la aplicación. La aplicación lista los mensajes de cada carpeta
(Recibidos, Enviados, Borradores, Papelera, Spam) con users.messages.list,
descarga el contenido y los encabezados de cada mensaje con
users.messages.get, y baja los archivos adjuntos con
users.messages.attachments.get. Sin este permiso la aplicación no puede mostrar
ningún correo.

No existe un permiso más acotado que sirva: K+AIR necesita el cuerpo del mensaje
para mostrarlo y el adjunto para abrirlo. El permiso gmail.metadata no es
suficiente porque el usuario tiene que leer el correo dentro de K+AIR, no solo
ver remitente y asunto.

Los correos se almacenan únicamente en una base de datos SQLite local, en el
equipo del propio usuario. No se transmiten a servidores de terceros.
```

### 3.2 `gmail.modify` (restringido)

```
Necesario para que el estado de lectura que el usuario ve en K+AIR se mantenga
sincronizado con Gmail. La aplicación llama users.messages.modify para poner o
quitar la etiqueta UNREAD, y para archivar conversaciones (quitar la etiqueta
INBOX).

Es indispensable porque la sincronización en segundo plano vuelve a leer el
estado desde Gmail: si la aplicación no pudiera escribir las etiquetas, cada
sincronización revertiria en pantalla lo que el usuario acaba de marcar, y el
correo volveria a aparecer como no leido aunque el usuario ya lo hubiera leido.

El permiso gmail.readonly no sirve porque solo permite leer: no habria forma de
propagar la accion del usuario. El permiso https://mail.google.com/ seria
innecesariamente amplio, porque K+AIR nunca borra correos de forma permanente;
usa la papelera de Gmail.
```

### 3.3 `gmail.send` (sensible)

```
Necesario para responder, reenviar y redactar mensajes desde K+AIR sin salir a
la web de Gmail. La aplicacion construye el mensaje en formato MIME crudo y lo
entrega con users.messages.send.

Los permisos gmail.modify y gmail.compose tambien permitirian enviar, pero son
permisos restringidos y K+AIR no los necesita para enviar, asi que no se piden:
ningun flujo de la aplicacion crea, edita ni elimina borradores en la cuenta del
usuario. Por eso se solicita el permiso mas estrecho que permite enviar.
```

### 3.4 `calendar` (sensible)

```
Necesario para integrar la agenda del usuario con el modulo de reuniones y
capacitaciones de K+AIR.

La aplicacion sincroniza los eventos con events.list, recupera un evento puntual
con events.get, y escribe sobre la agenda: crea con events.insert, actualiza con
events.update y elimina con events.delete. Tambien responde invitaciones con
events.patch e importa invitaciones recibidas por correo en formato .ics.

El permiso es de lectura y escritura, no solo de lectura: cuando el usuario
crea una capacitacion en K+AIR, el evento debe quedar creado en su Google
Calendar, y cuando la elimina en K+AIR, debe desaparecer tambien del calendario.

El permiso calendar.readonly no sirve por esa razon. No se usa calendar.events
porque la aplicacion no gestiona calendarios secundarios ni listas de invitados.
```

No hay una justificación 3.5: `gmail.compose` se quitó del código. Ver la sección 7.

---

## 4. Dónde se envían

El formulario oficial está en **Google Cloud Console**:

```
APIs & Services -> Google Auth Platform
  (antes se llamaba "OAuth consent screen")
```

- Pestaña **Data access** -> botón **Add or remove scopes**. Al marcar cada scope
  aparece el campo de justificación. Eso es lo que revisan.
- Pestaña **Audience** -> hay que tener el proyecto en estado **In production**.
- Pestaña **Verification Center** -> muestra el estado del radicado.

Antes de eso hay que pasar por **Branding -> Verify Branding**, que es un
requisito previo.

---

## 5. Qué pide Google además de las justificaciones

Para el tramo restringido, el formulario además de los textos pide:

- **Video de demostración** donde se vea la función real usando la app, no una
  maqueta ni una explicación verbal. Tiene que mostrar el uso concreto del permiso.
- **Hasta 3 enlaces a documentación** de las funciones relacionadas.
- Que los scopes **declarados en la consola coincidan exactamente** con los que
  pide el código. Si el código pide uno que no declaraste, los usuarios ven la
  pantalla de "app no verificada" y eso consume cupo del tope.

Los tres enlaces que conviene ofrecer:

1. La página de privacidad publicada (`sitio/privacidad.html`, ya en `gh-pages`).
2. Este documento, una vez publicado en un lugar accesible.
3. La documentación del módulo correspondiente (Bandeja Integrada / Agenda).

---

## 6. Límites que no controlamos

- **El tope de 100 usuarios es de por vida y no se resetea.** Cada persona que
  autorizó mientras la app estuvo sin verificar ya consumió cupo. Se consulta en
  *OAuth consent screen -> OAuth user cap*. No hay forma de recuperarlo.
- **Los usuarios de prueba en modo Testing pierden la autorización a los 7
  días** y hay que volver a autorizar. Molesto al probar, no aplica a producción.
- **Verificar la propiedad del sitio en Search Console** es obligatorio antes de
  que aprueben la verificación, y se hace con una cuenta que sea Owner o Editor
  del proyecto de Google Cloud.
- **El dominio importa.** `reivaj640.github.io` se puede verificar por meta tag,
  así que no bloquea nada, pero si más adelante cambia el dominio hay que repetir
  la verificación de propiedad y avisar a Google.

---

## 7. `gmail.compose`: por qué no se pide

**Decisión tomada: se quitó del código** (`shared/google-auth.js`, 2026-10-07).
K+AIR declara 4 scopes, no 5.

**Hecho verificado: el código no usaba ese scope.** No existe ninguna llamada
`drafts.*` en todo el repositorio. Lo que sí existía:

- La carpeta "Borradores" de la interfaz, que es una **vista de lectura**: usa
  `users.messages.list` con la query `in:drafts`, y eso lo cubre `gmail.readonly`.
- El campo `is_draft` en la base local, que lo escribe `email-sync.js:177`
  copiando lo que ya venía de Gmail. No lo crea la aplicación.
- El comentario del propio código, que decía *"Para crear/editar/eliminar
  borradores (**futuro**: drafts)"*.
- El redactor, que tenía **solo enviar**: la barra de la ventana trae
  minimizar/maximizar/cerrar y el pie un botón Enviar. No había ningún
  "Guardar borrador".

Pedirle a Google un permiso que no se ejercita es justo lo que dispara el
rechazo por minimum scope, y además hace que la pantalla de consentimiento le
prometa al usuario algo que la app nunca hace.

**Quitarlo no bajó la categoría de la revisión**: `gmail.readonly` y
`gmail.modify` siguen siendo restringidos, así que la revisión restringida se
paga igual. Fue una decisión de higiene y de honestidad del consentimiento, no de
ahorro.

### Qué pasa con quien ya había autorizado

Nada, y no hay que reconectar a nadie:

- Nadie compara los scopes guardados contra la lista de `SCOPES`.
  `google-tokens.js:49` solo guarda `scope` como dato, y `main.js:2629` decide
  si hay que re-autorizar por la **vigencia** del token, no por los scopes.
- Quien ya había autorizado conserva su token y sigue funcionando.
- Los tokens ahora van cifrados en `google-tokens.enc` (ver sección 8), pero eso
  es otro cambio y no tiene relación con este.

### Si algún día se implementa guardar borrador

El scope vuelve, **pero con la función hecha, no antes**. Y hay que declararlo
también en la consola de Google: si el código pide un scope que la consola no
declara, a los usuarios les sale la pantalla de "app no verificada" y eso consume
cupo del tope de 100.

---

## 8. Evidencia en el código

Referencias para que quien redacte no tenga que volver a buscar:

**Scopes declarados** — `shared/google-auth.js:109-122`

**Llamadas reales a Gmail** — `shared/google-gmail.js`

| Línea | Llamada | Para qué |
|---|---|---|
| 203 | `users.messages.list` | Listar cada carpeta (query `in:sent` L179, `in:drafts` L181, `in:trash` L183) |
| 255 | `users.messages.get` | Descargar el mensaje |
| 585 | `users.messages.attachments.get` | Bajar adjuntos |
| 972 | `users.messages.send` | Enviar |

Todas pasan por `GmailRateLimiter`, que respeta el cupo real de Gmail de 250
unidades por usuario por segundo (L45).

**Llamadas que modifican** — `main.js`

| Línea | Llamada | Para qué |
|---|---|---|
| 2130 | `google-gmail:archive-thread` | Quitar la etiqueta INBOX |
| 2317 | `users.messages.modify` | Poner/quitar UNREAD |

**Llamadas reales a Calendar** — `shared/google-calendar.js`. Se usan los seis
verbos, por eso el permiso es de lectura **y** escritura:

| Línea | Llamada |
|---|---|
| 135 | `events.list` |
| 167, 329, 423 | `events.get` |
| 200, 408 | `events.insert` |
| 239 | `events.update` |
| 261 | `events.delete` |
| 353, 436 | `events.patch` |

Los handlers IPC que las exponen están en `main.js:2359-2450`.

**Ausencia de borradores**: cero coincidencias de `drafts.` en todo el repositorio.
Por eso `gmail.compose` ya no se pide (sección 7).

**Tokens**: van cifrados con `safeStorage` en
`%APPDATA%\sgsst-electron-app\google-tokens.enc` (`shared/google-tokens.js`), no en
texto plano. `config.json` está en `%APPDATA%\sgsst-electron-app\config.json`
(`main.js:2486-2489`) y **no está en el repositorio**. Las credenciales de la app que
sí se versionan van en `shared/google-oauth-config.js`.

Esto importa para la verificación: cuando Google pida justificar el manejo de
datos, la respuesta es que los tokens no descansan en texto plano en el disco, y
que la app no tiene servidor.

---

## Registro de envíos

| Fecha | Scopes enviados | Radicado | Resultado |
|---|---|---|---|
| (pendiente) | | | |