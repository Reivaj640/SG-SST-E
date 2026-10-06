# K+AIR — Historial de trabajo

> **Para qué existe este archivo:** que cualquier modelo o persona que retome el desarrollo
> sepa **exactamente dónde quedó todo**, sin tener que leer 4 800 líneas de bitácora.
>
> No reemplaza a ningún otro documento, se suma:
>
> | Archivo | Responde a… |
> |---|---|
> | `PROMPT.md` | ¿Cómo se trabaja aquí? |
> | `CHANGELOG.md` | ¿Qué cambió en cada versión publicada? |
> | `AGENTS.md` | ¿Por qué el código es como es? (bitácora de bugs) |
> | `CONTEXT.md` | ¿De qué va el proyecto? |
> | **`Historial.md`** | **¿Dónde quedó el trabajo y qué falta?** ← este |

---

## 🚦 ESTADO AL CIERRE

> **Este bloque se actualiza en CADA cierre de trabajo, sin excepción.**
> Es lo primero que debe leer quien retome. Si está desactualizado, el archivo perdió su razón de ser.

| Campo | Valor |
|---|---|
| **Fecha de cierre** | 2026-10-05 |
| **Rama** | `Dev-Pc` (el remoto por defecto es `Dev`) |
| **Último commit** | 📦861 · el explorador de archivos deja de mentir cuando algo falla |
| **Commits sin pushear** | 0 — el owner autorizó commit y push el 2026-10-05 |
| **Versión** | `0.1.240` (desarrollo) · último publicado `v0.1.205` |
| **Suite** | 119 tests · 101 verdes · 18 preexistentes · **0 regresiones** |
| **Validaciones visuales abiertas** | 📦860 y 📦861 **aprobados por el owner con captura** (el botón verde y el PDF con el visor del navegador los reportó él). 📦858 no. 📦857, 📦856, 📦855, 📦853/854 y 📦850/851 **nunca se miraron** |
| **Jornada** | Cerrada el 2026-10-05. Paquetes: 📦861 y 📦860 |

### ▶️ Retomar desde acá — siguiente paso concreto

1. **Owner tiene que validar visualmente 📦858**: en la pestaña Correo, el mini debe dejar ir a
   septiembre con las flechas, y al elegir el **14 de septiembre tiene que mostrar los 12 correos**
   (no "sin correos ese día": de los 131 de la carpeta, solo 25 están en memoria, y ese día no está
   cargado). También: que funcione con Enviados y con No leídos, que al pasar a Agenda se limpie el
   filtro, y que la fila con la X se vea bien con el sidebar plegado. **Es la validación más
   valiosa que queda abierta**, porque 📦858 nunca se ha mirado en la app.
2. **Owner tiene que confirmar 📦861 en pantalla**: en el 1.1.1, que el botón **Subir** ya
   sale azul como la barra superior, que el **PDF** se abre con el visor de K+AIR (barra
   clara, no la oscura del navegador) y que **"Ver completo"** aparece en el PDF. Y que
   arrastrar un archivo al **centro** de la pantalla lo suba a la carpeta que está viendo.
   Ojo: estos módulos **no llevan token de caché**, así que si no cambia hay que cerrar y
   abrir la app.
3. **Owner tiene que validar el estado de error de 📦861**: borrar o renombrar la carpeta
   base desde el Explorador de Windows con la app abierta y hacer clic en otra carpeta.
   Antes quedaban bloques grises para siempre; ahora debe salir "No se pudo leer esta
   carpeta" con botón **Reintentar**, y "Carpeta vacía" solo cuando la carpeta está
   realmente vacía.
3. ~~**Decisión pendiente del owner**: el mini congelado en el mes real~~ — **CERRADO 2026-10-04 por
   📦858**. En Agenda sigue congelado (📦844 intacto); en Correo navegó con estado propio, y al
   cambiar de pestaña vuelve al mes presente. Las dos behaviors quedan aisladas, que es lo que se
   pidió.
4. **Owner tiene que validar visualmente 📦856/857**: en vista Mes, "Tipos de evento" debe contar
   **octubre** (no el año) y **sin las seis filas en 0**. Al hacer clic en un día del mini, la
   sección debe pasar a ese día y salir el botón "Ver el mes completo". Y **"Tu día" debe seguir
   visible** abajo con la lista larga. Todo probado con tests, **nunca mirado en la app**.
5. **Owner tiene que validar visualmente 📦855**: que la bandeja abra **en blanco** (sin correo
   abierto), que al hacer clic abra y marque leído, y que al cambiar de filtro con un correo
   abierto que no está en la lista nueva, el panel se limpie.
6. **Owner tiene que validar visualmente 📦853/854**: el pillón rojo de novedad en la esquina de la
   fila "Correos no leídos", el tinte rojo de la fila, el filtro "No leídos" en la barra y el clic
   que baja el 99+. Ojo: hay que **cerrar y reabrir** la app primero, para que se siembre la línea
   base con el estado actual. En la captura de 📦855 el aviso rojo **no aparecía**, y era lo
   correcto: la línea base se había sembrado con lo que ya había y no había llegado nada nuevo.
7. **Cerrar el bypass de `gh:update-personal`** (bloqueante #2). Es el único de severidad crítica
   que sigue abierto, y lleva desde v0.1.212.
8. **Decidir sobre los borrados que necesitan autorización**: los 4 `.bak-*` (bloqueante #5) y los
   12 JS huérfanos de la Bandeja (bloqueante #4). Editar código que no se carga es trabajo perdido.
9. **Arreglar los tokens faltantes de `styles.css`** (bloqueante #1), o decidir que el panel de
   pendientes se queda así y no se le toca.

### 🔴 Bloqueantes y deudas conocidas

| # | Qué | Dónde | Impacto |
|---|---|---|---|
| 1 | **`styles.css` usa 6 tokens premium que nadie define** en el shell; 4 sin respaldo quedan sin estilo | `styles.css:6159-6470` (`.kair-pendientes-popover*`) | El panel de pendientes del dashboard se ve con bordes y colores inválidos |
| 2 | **El bridge acepta campos que el módulo declara protegidos.** `PROTECTED_FIELDS` en el renderer marca `estado`, `fechaIngreso` y `fechaRetiro` como no editables, pero el `fieldMap` de `_handlerUpdatePersonal` **sí los acepta**. Llamar el handler con `{estado:"retirado"}` los escribe. | `main/gestion-humana-bridge.js` (`_handlerUpdatePersonal`) vs `modules/gestion-humana/base-personal/index.js` | La protección es solo de UI. Cualquiera que llegue al handler la salta. Marcado como pendiente desde v0.1.212 y sigue abierto |
| 3 | `no such column: actualizado_en` en el sync | `sync-serializer.js:138,302,391,734` | BDs instaladas **antes** de la migración no sincronizan esos dominios. El schema sí declara la columna: falta una migración, no es un typo |
| 4 | **12 archivos JS huérfanos** en la Bandeja | `renderer/bandeja-integrada/` | No se cargan. Editarlos es trabajo perdido. `compose-modal.js` además tiene lógica duplicada viva en `app.js` |
| 5 | 4 archivos `.bak-*` en la raíz del app | `main.js.bak-*`, `renderer.js.bak-*`, `preload.js.bak-*`, `index.html.bak-*` | Ruido. Candidatos a borrar, **pero no sin autorización** |
| 6 | 30 tests en `tests/` que el runner no ejecuta | `sgsst-electron-app/tests/` (en subdirectorios por módulo) | Cobertura que parece existir y no corre. El runner solo mira `main/` |
| 7 | `CHANGELOG.md` afirma 22/22 mutaciones en `test-swapview-841.js`, pero ese archivo no tiene array `MUT` | `CHANGELOG.md` | O el mutation se perdió en un refactor, o el CHANGELOG describe un estado intermedio |
| 8 | ~~2 validaciones visuales abiertas~~ — **CERRADO 2026-10-03** | `CONTEXT.md` v0.1.214 (confetti del splash) y v0.1.215 (home de Capacitaciones) | El owner las revisó en la app y no registró observaciones. Ya no bloquean. Las dos referencias en `CONTEXT.md` quedaron actualizadas |
| 9 | 📦850 y 📦851 implementados y probados, pero nunca vistos en la app — **CERRADO 2026-10-03** | Botón del borde y encabezado sin etiqueta de fecha | El owner los revisó |
| 10 | 🔴 **La bandeja solo tiene 25 correos en memoria de los 131 de INBOX** (`PAGE_SIZE = 25`), y se agrandan con scroll infinito. Cualquier filtro que mire `state.mails` da "vacío" en **25 días que sí tienen correo** (el 14 de septiembre tiene 12 y ninguno está cargado) | `app.js` `PAGE_SIZE`, `loadMailsFromCache` | 📦858 lo resolvió con un rango de fechas en la caché local. **El mismo riesgo queda para cualquier filtro nuevo que se escriba sin eso** |
| 11 | 🔴 **Ningún test del repo abre la base de datos.** 📦860 tenía 34 checks en verde y el feature podía no dibujar nada en pantalla, según qué tipo devolviera la BD para `last_message_date` | `main/test-*.js` | Verificado a mano contra la BD real (`Temp/verif-fecha-bd-860.js`: 150 filas, 0 sin fecha, `INTEGER` y llega como `number`). **La brecha sigue abierta**: todo feature de datos necesita ese paso a mano hasta que la suite tenga un juego de datos de prueba |
| 12 | 🔴 **Los 15 exploradores de archivos NO comparten la arquitectura del preview.** Hay **4 variantes** de `_loadPDF` y **3 formas** de enrutar el PDF en el archivo de conexión; 3 módulos no tienen archivo de conexión | `modules/**/*-viewer.js`, `*-logic.js` | 📦861 arregló el PDF **solo en el 1.1.1**. Replicar sin abrir la app sería cambiar 15 módulos a ciegas, y el PDF es lo que más se nota si se rompe. **Pendiente: Owner valida el 1.1.1 y se replican los otros 14** |

### 📋 Cola de trabajo acordada

| Orden | Tema | Estado |
|---|---|---|
| 1 | 📦828 · Matriz de requisitos legales 2.7.1 | Pendiente |
| 2 | 📦841 fase 2 · Tabs del dashboard | Pendiente |
| 3 | 🔴 Cerrar el bypass de `gh:update-personal` (bloqueante #2) | Pendiente, abierto desde v0.1.212 |
| 4 | Arreglar los tokens faltantes de `styles.css` (bloqueante #1) | Pendiente, sin autorizar |
| 5 | Migración de `actualizado_en` para BDs previas (bloqueante #3) | Pendiente |
| 6 | Limpiar código muerto de la Bandeja (bloqueantes #4 y #5) | Pendiente, esperando autorización de borrado |

### 🧠 Lo que la regla de cero presunciones evitó hoy

Se agregó al `PROMPT.md` (§5.9) después de encontrar **reglas "OBLIGATORIAS" que no existen**:

- `KairUI.esc()` y `KairHelpers.formatDate()` — **0 archivos** en todo el repo. Un modelo que las
  hubiera seguido habría escrito una llamada inexistente y la vista se habría caído.
- `kair-canonical.css` — referenciado en `AGENTS.md` como fuente de las clases BEM. **No existe.**
- "el último paquete es `📦579`" — van 850+.
- "`var`, no `let`/`const`" — `main.js` tiene 2 608 `const`.

Y la misma regla, aplicada al propio trabajo: al medir este documento, **2 de mis propias cifras
en `PROMPT.md` estaban mal** (27 bridges en vez de 30, y un conteo de `tests/` mal hecho por no
bajar a los subdirectorios). Las dos quedaron corregidas con el número medido.

### 🧠 Reglas que se aprendieron en esta sesión

Se guardan como comentarios `📦n` en el código, como lecciones al final de `AGENTS.md`, y acá
solo va el resumen de las que **cambian cómo se trabaja mañana**:

- Un **check que matchea su propio comentario** no guarda nada. Leer solo código con `soloCodigo()`.
- Una **mutación que no cambia nada siempre "pasa"**. Normalizar a LF antes de mutar y contar los
  mutantes vacíos por separado, o se pierde la señal.
- Un **regex con rango fijo** (`{0,300}`) se rompe al agregar un comentario. Acotar a la misma llave.
- Un check de "este texto tiene que estar" **solo vale si además dice dónde**.
- Cuando se borra algo, **invertir los checks que lo afirman**, y si son varios, todos.
- Un botón que **pliega la columna que lo contiene** no puede vivir dentro de ella.
- Un **ancla de reemplazo** tiene que llevar el contexto que la rodea, no solo la primera línea. Al
  insertar "antes de X", el texto nuevo debe **reponer X completo**. Si X es un encabezado de
  sección, perderlo no es perder una línea: deja huérfano todo lo que venía después.
- **"El script dijo OK" no es verificación.** Un script que hace `replace` y reporta éxito puede
  haber matcheado 0 veces y dejado el archivo intacto. El guard que salva es exigir exactamente
  1 coincidencia, y después comprobar por estructura dónde cayó cada cosa.
- Un script que **escribe archivo por archivo no es atómico**: si el CHANGELOG sale bien y el README
  falla, quedan estados mezclados. **Respaldar antes de correr.**
- Un verificador de "inglés colado" con listas largas produce falsos positivos tan molestos como los
  typos que busca. Listar solo lo que es **inequívocamente** error en ese documento.
- Los documentos nuevos viven en la **raíz del repo**, junto a `PRODUCT.md`; los de la app, en
  `sgsst-electron-app/`. Un script que los agrupe mal marca "FALTA" sobre archivos que sí existen.

---

## 📅 Bitácora por jornada

### 2026-10-03 · Bandeja Integrada (📦844-851) + Prompt operacional v2.0

**Qué se hizo**

| Paquete | Qué |
|---|---|
| 📦844 | El mini-calendar queda fijo en el mes actual y cruza la medianoche sin congelar "hoy" |
| 📦845 | Doble clic lleva al calendario grande a la vista Día del día elegido |
| 📦846 | Popup de categorías al pasar el mouse, agrupado, tope de 8 |
| 📦847 | Se quita el tooltip nativo duplicado y se corrigen las horas que salían `00:00` |
| 📦848 | Se corrige "Todo el día": ahora usa la misma regla que la grilla |
| 📦849 | Los 3 indicadores bajan al sidebar en **"Tu día"**; fuera "Eventos críticos"; el correo gana el alto |
| 📦850 | **Botón en el borde para plegar la columna lateral**, con estado persistente |
| 📦851 | Se va la etiqueta con el mes del encabezado (repetía lo que ya dice el calendario) |
| — | `PROMPT.md` v2.0: auditoría completa del prompt viejo contra el código real |
| — | `PRODUCT.md` corregido (paleta, tipografía, dark mode, "no hay README") |
| — | 3 trampas internas de `AGENTS.md` corregidas (ver abajo) |

**Por qué**

El sidebar de la Bandeja se comía un quinto de la pantalla, y los indicadores vivían arriba
robándole espacio al correo. El owner pidió plegar la columna y bajar los indicadores.

**Tests**

| Archivo | Checks | Mutation |
|---|---|---|
| `test-minical-844.js` | 27/27 | — |
| `test-minical-dblclick-845.js` | 24/24 | — |
| `test-minical-reloj-844.js` | 29/29 | — |
| `test-minical-hover-846.js` | 49/49 | 12/12 |
| `test-minical-hora-847.js` | 23/23 | 2 bugs + 8 guards |
| `test-minical-allday-848.js` | 22/22 | 3/3 + 5 guards |
| `test-bandeja-tudia-849.js` | 47/47 | 3/3 + 10 guards |
| `test-bandeja-sidebar-850.js` | 48/48 | **20/20** |
| `test-bandeja-chip-851.js` | 16/16 | **9/9** + 1 equivalente declarada |

Suite completa: 111 tests, 93 verdes, 18 preexistentes, 0 regresiones.

**Decisiones que el owner confirmó** (no volver a preguntar)

- El botón del borde va **fuera** del `<aside>`, en el borde de la columna.
- El sidebar **empieza abierto** y la app **se acuerda** de cómo se dejó.
- Se **elimina por completo** "Eventos críticos", no se oculta.
- Se borran el texto y el botón de "Integración correo"; los indicadores ocupan ese lugar.
- `PROMPT.md` **referencia** los documentos del repo en vez de duplicar sus valores.
- Va en la **raíz del repo**, versionado junto a `PRODUCT.md`.

**Los 4 bugs que aparecieron durante el trabajo** (importante: ninguno estaba en el código,
todos los encontró el test o la validación)

1. 📦848 — el fix de 📦847 inventó el criterio "si el rango es 00:00–23:59 es todo el día", pero
   **5 generadores en `main.js` crean eventos exactamente así**. La verdad ya existía y la usaba
   la vista Día. El test de 📦847 afirmaba el bug como correcto: se invirtió, no se borró.
2. 📦850 — un handler que borra y reinserta preservaba un campo leyendo la tabla **después** del
   borrado. Resultado real en la BD del owner: el 2026 de Tempoactiva quedó con `0/14` categorías.
3. 📦850 — el popup decía "Todo el día" para todo, y las horas salían `00:00`, porque leía los
   eventos con nombres de campo que no son los reales.
4. Documentación — `PROMPT.md` viejo, `PRODUCT.md` y 3 secciones de `AGENTS.md` describían un
   sistema visual que no existe. Origen probable: `AGENTS.md:235` referenciaba un archivo
   (`kair-canonical.css`) que **nunca estuvo en el repo**.

**Archivos tocados en la jornada**

```
PRODUCT.md                                        (corregido)
PROMPT.md                                         (nuevo)
Historial.md                                      (nuevo)
CLAUDE.md                                         (nuevo)
sgsst-electron-app/AGENTS.md                      (3 trampas corregidas)
sgsst-electron-app/README.md                      (0.1.233)
sgsst-electron-app/CHANGELOG.md                   (0.1.233)
sgsst-electron-app/CONTEXT.md                     (0.1.233)
sgsst-electron-app/release-notes.md               (0.1.233)
sgsst-electron-app/package.json                   (0.1.233)
sgsst-electron-app/renderer/bandeja-integrada/    (index.html, app.js, data.js, premium.css)
sgsst-electron-app/main/test-bandeja-*.js         (nuevos y actualizados)
sgsst-electron-app/main/test-minical-*.js         (nuevos)
```

**Commits de la jornada**

| Hash | Paquete | Push |
|---|---|---|
| `42cce42e` | 📦844-849 | Sí |
| `47779352` | 📦850-851 | Sí |
| `2926b8ea` | 📦852 documentación | Sí |
| (36dcc1eb) | 📦853-854 aviso de correo en "Tu día" | Sí |
| (c953462b) | 📦855 la bandeja abre en blanco | Sí |
| (este commit) | 📦856-857 "Tipos de evento" cuenta lo que se ve | Sí |

---

### 2026-10-03 · "Tipos de evento" cuenta lo que se está mirando (📦856-857)

**El bug reportado (📦856)**

Las seis categorías marcaban 0, siempre. **No faltaban datos**: el panel iteraba sobre
`D.EVENT_CATEGORIES` y comparaba `e.category === cat.id`, pero las dos únicas fuentes de eventos
devuelven `rapido`:

| Fuente | Devuelve | Archivo |
|---|---|---|
| Eventos rápidos | `type: row.tipo \|\| 'rapido'` | `main/eventos-rapidos-bridge.js:101` |
| Google Calendar | `category: kairCategory \|\| 'rapido'` | `shared/google-calendar.js:107` |

**Verificado contra las 75 tablas de la BD real: ninguna guarda las 6 categorías oficiales.** La
única tabla de eventos tiene `tipo='rapido'` y 5 filas de julio-agosto.

Pista extra en la captura: **todos los puntitos del mini eran del mismo azul**, que es
`categoryColor[ev.category] || "#2057B8"` — el color de respaldo de "no reconocí esta categoría".

**No-op silencioso encontrado de paso**

El mini hacía `if (D.FALLBACK_CATEGORIES)`, pero **`D.FALLBACK_CATEGORIES` no existe**: es una `const`
local de `app.js`. El `if` protegía un crash y dejaba el bloque vacío, así que las categorías no
oficiales nunca entraban al mapa de colores.

**Lo que pidió el owner después (📦857)**

Mostrar solo los tipos con eventos, contar el mes en vista Mes, el día al elegirlo en el mini, y que
**las tres secciones existan siempre**.

**El footer del calendario también mentía**: decía "224 evento(s) en el rango visible" y eran 224
del **año entero**. La suma de los contadores daba exactamente 224: panel y footer coincidían, y los
dos estaban mal.

**El alcance ahora sigue a la vista** (`alcanceFechas`, pura): Mes usa las celdas de la grilla
**incluidos los días en gris del mes vecino** (porque están en pantalla); Día y Programar usan el día
seleccionado; Semana usa los 7 días desde el lunes; y un clic en el mini fija ese día aunque la vista
siga en Mes.

**Por qué `alcanceTipos` es un estado aparte de `selectedDate`**

`selectedDate` **siempre** tiene valor (init lo pone en hoy): no distingue "hoy por defecto" de "el
owner eligió este día". Y un clic simple en el mini **no** cambia `calView`, así que sin la bandera
no había forma de saber que señaló un día. Se fija en `seleccionarDiaDelMini` y en el "+N más"; se
suelta al navegar de mes, con "Hoy", al cambiar de vista, o con el botón emergente **"Ver el mes
completo"**.

**"Tu día" desaparecía por dos motivos de layout**

1. `.kair-sidebar` con `overflow: hidden` → la tercera tarjeta se salía **recortada, sin scroll**.
2. Sin `min-height: 0`, un hijo flexible no baja de su altura mínima y el padre se desborda.

Reparto final: `.mini` y `.tuday` con `flex: none` (altura fija), `.tipos` con `flex: 1 1 auto` +
`min-height: 0` y su lista scrolleando por dentro. El `overflow-x: hidden` del sidebar **se conserva**
(📦850: evita el derrame de tarjetas durante los 240ms del plegado); el `overflow-y` pasó a `auto`.

**Bug propio que casi revirtió 📦844**

Metí `buildMonthGrid(state.viewYear, ...)` **dentro** de `renderSidebar`, que es exactamente el
acoplamiento que 844 eliminó (el mini está congelado en el mes real). Lo detectó
`test-minical-844` (26/27) y está en su razón de ser. El cálculo se movió a `celdasDelMesVisible()`,
**fuera** de `renderSidebar`.

**Código muerto que se borró**: `calcularTiposEvento` quedó huérfana al reemplazarla 857. El repo
arrastra 12 JS huérfanos; no se suma otro.

**La lección del paquete: un check que se satisface a sí mismo**

El comentario que explica el arreglo en el CSS dice literalmente `` `overflow-y: auto` ``, y el check
buscaba ese texto sobre el CSS crudo: **se encontraba a sí mismo en la nota al lado** y pasaba
aunque la declaración real estuviera rota. Lo delató una mutación que decía "no muerde". Documentado
en `PROMPT.md` §5.15.

**Tests**

| Archivo | Checks | Mutation |
|---|---|---|
| `test-tipos-evento-857.js` | 37/37 | **14/14** (4 de CSS: el layout es media parte del bug) |
| `test-tipos-evento-856.js` | 32/32 | **10/10** |
| `test-bandeja-sidebar-850.js` | 49/49 | **21/21** (check de overflow invertido) |
| `test-minical-844.js` | 27/27 | — sin cambios |
| Los otros 6 de bandeja | todos verdes | — |

Suite completa: 115 tests, 97 verdes, 18 preexistentes, **0 regresiones**.

---

---

### 2026-10-03 · La bandeja abre en blanco (📦855)

**Qué se hizo**

| Qué | Detalle |
|---|---|
| `init()` | Ya no hace `selectMail(state.mails[0].id)`. Arranca con `selectedMailId = null` |
| Respaldo `"m1"` | Fuera. Era un id de mock: sin correos la app apuntaba a un mensaje inexistente |
| Filtro | El predicado vive en `mailPasaFiltroActual(m)`, en un solo lugar y al nivel correcto |
| Cambio de filtro | `setMailFilter(f)` centraliza los 3 caminos; suelta la selección que quedó fuera |

**Los dos bugs que lo causaban**

1. `init()` elegía el primer correo y `selectMail` lo marcaba como leído: **abrir la app metía un
   correo a leídos sin que nadie lo abriera**, y no era el más reciente sino `mails[0]`.
2. `renderMailDetail` buscaba el seleccionado en `state.mails` **sin mirar el filtro**, mientras la
   lista sí lo miraba. De ahí que el panel mostrara un correo que la lista ya no enseñaba — literal,
   la captura: "Prueba 5" abierta con otros cuatro en la lista.

**La lección — un error de alcance no lo caza `node --check`**

El predicado se declaró primero **dentro** de `renderMailList`, y `setMailFilter` vive en otro
nivel. Sintácticamente válido, se ve bien al leerlo… y al tocar un chip de filtro saltaba un
`ReferenceError` que congelaba la bandeja. Lo detectó el test, al no poder armar su sandbox. Quedó
un check que falla si alguien vuelve a anidarlo.

**La lección — un check que reconoce la redacción de un bug no verifica el comportamiento**

Dos checks de 📦853 buscaban el texto exacto `state.mailFilter = "unread";`. Si alguien
reintrodujera el auto-selección con otra redacción, el check pasaba igual. Se reemplazaron por uno
que pregunta *"¿la selección se deriva alguna vez de `state.mails`?"*, que no depende de cómo esté
escrito.

**Ojo con esto al retomar**: la validación de la selección vive en `setMailFilter`, **no** en
`renderMailDetail`, a propósito. Si se mueve al render, al hacer clic en un no leído —que al
abrirse marca leído— el correo se borra de la pantalla en el mismo clic en que se lo está leyendo.
Hay un check que lo impide.

**Tests**

| Archivo | Checks | Mutation |
|---|---|---|
| `test-bandeja-seleccion-855.js` | 25/25 | **10/10** |
| `test-bandeja-tudia-853.js` | 76/76 | **35/35** |
| `test-bandeja-tudia-849.js` | 50/50 | — (check invertido) |
| `test-bandeja-premium-v2.js` | 48/48 | — |
| `test-bandeja-toolbar-compacta.js` | 51/51 | — |
| `test-bandeja-chip-851.js` | 16/16 | 9/9 |

Suite completa: 113 tests, 95 verdes, 18 preexistentes, **0 regresiones**.

---

### 2026-10-03 · Alertas de "Tu día" (📦853)

**Qué se hizo**

| Qué | Detalle |
|---|---|
| Clic de "Correos no leídos" | Antes solo cambiaba de vista; ahora aplica `setMailFilter("unread")` y marca lo visto |
| Filtro "No leídos" | Subió del menú "Más" a la barra visible: `PRIMARY_FILTERS = ["all","unread","sent"]` |
| Aviso de novedad | **Réplica exacta del 99+** del shell, colgada de la esquina de la fila |
| Al hacer clic | Marca las notificaciones de **correo** como leídas → **baja el pillón y el 99+** |
| "Invitaciones pendientes" | **Retirada** |

**Por qué** — El owner pidió que "Tu día" avisara lo que llega "como se ve arriba en el icono de la
Bandeja Integrada", y al hacer clic en los no leídos se mostrara esa lista y no la bandeja completa.

**📦854 · Lo que cambió cuando el owner mandó a investigar de verdad**

Las dos primeras versiones del aviso se hicieron "a ojo", copiando lo que se veía en la captura. El
owner las rechazó y dijo: *"investigá cómo está construido ese sistema y replicálo"*. Al investigar:

- **El 99+ no es un badge, es un servicio.** `main/notifications-service.js` corre cada 60s;
  `main/notifications-email.js` busca `email_threads WHERE has_unread = 1` e inserta filas en la
  tabla `notificaciones` con `dedupe_key` única; emite `notificaciones:changed`; el `renderer.js`
  pinta el badge y el toast. El número viene de esa tabla, no de Gmail.
- **Lo que yo había hecho era un contador paralelo.** Usaba `localStorage` sobre `state.mails`: no
  tocaba la tabla, no hablaba con el 99+, y mostraba un número distinto al de arriba. Con lo cual
  el aviso de "Tu día" y el del botón **no podían bajar juntos**, porque eran dos cosas sin relación.

**La réplica quedó en tres piezas:**

| Pieza | Qué hace |
|---|---|
| El pillón | Cuelga de la **esquina de la fila** (como el 99+ del botón) con los **9 valores** copiados de `.kair-cal-badge` |
| El clic | `_marcarNotifsCorreoLeidas()` lista con `soloNoLeidas` + `limit: 50` (el mismo payload de `kair-alerts.js:206-212`), filtra `tipo === "correo"` y marca por `notificaciones:marcarLeida` |
| El refresco | `KA.refresh()` después de marcar, para que el 99+ baje ya y no al próximo tick de 60s |

**A propósito NO se usa `marcarTodas`**: taparía también los eventos, y mirar el correo no es lo
mismo que decir "ya vi los eventos". El número grande sigue viniendo de **Gmail**, independiente del
servicio de notificaciones (decisión del owner).

**El bug de fondo que destapó la investigación** — la tabla `notificaciones` tenía:

| | |
|---|---|
| Filas | 78 |
| Sin leer | **77** — de las cuales **61 correos** |
| Marcadas como leídas | **1 en toda la historia** |

**El 99+ no podía bajar nunca**, porque nada marcaba esas filas. Ahora "Tu día" es donde se marcan.

**Corrección de rumbo** — La primera implementación metió un **switch** para encender/apagar las
alertas. El owner lo rechazó: *"no quiero un switch, quiero este tipo de alerta visual"* (con la
captura del pillón 99+). Se quitó el switch completo —botón, `role="switch"`, `aria-checked`, clave
`TUDIA_ALERTAS`, helpers `_alertasTuDiaOn`/`_setAlertasTuDia` y sus reglas CSS— y se puso el pillón.
La **línea base de lo visto** (`kair-bandeja.tuDiaVistos`) sí se conservó: es lo que hace que el
número sea "cuántos son nuevos" y no "cuántos hay en total".

**El pillón se ve igual que el 99+ del shell a propósito.** Copió de `.kair-cal-badge`
(`styles.css:6121`): mismo rojo `#dc3545`, misma proporción de radio, misma sombra
`0 1px 3px rgba(0,0,0,.25)`, mismo número blanco bold, y tope 99+. El owner ya reconoce ese rojo
como "llegó algo"; uno nuevo habría tenido que aprenderlo. Va dentro de un envoltorio con
`position: relative` porque si se anclara a la fila quedaría en la esquina de las 250px del sidebar
en vez de encima del ícono, que es donde el ojo ya está mirando.

**Diagnóstico hecho ANTES de codear** (esto es lo que sostuvo el trabajo)

1. `render-mail-list.js` **ya tenía** un filtro "No leídos" escrito — y **no está cargado** en
   `index.html`. Es uno de los 12 JS huérfanos (bloqueante #4). La lógica buena existía en dos
   lugares: la muerta y la viva.
2. `PRIMARY_FILTERS = ["all", "sent"]` era lo que escondía el filtro. El filtro estaba en
   `filterDefs` y la lista lo respetaba; lo que faltaba era un camino desde la pantalla.
3. **"Invitaciones pendientes" nunca pudo tener dato.** `meetingSuggestion` se lee en 4 lugares y
   **no se escribe en ninguno**: solo existe en los correos de ejemplo de `data.js`.
4. **La BD real no tiene eventos de hoy.** Se consultaron las **76 tablas** de `kair.db`: 0 filas
   con la fecha de hoy. `eventos_rapidos` tiene 5 filas, la última del 12 de agosto. Los eventos
   del calendario vienen de **Google Calendar**.
5. **Bomba armada en `app.js:1286`:** si el adaptador local devuelve 0 eventos, hace
   `return D.EVENTS.slice()` — los **datos de ejemplo de julio** — y nunca llega a consultar
   Google. No se dispara hoy, pero si la BD queda vacía el calendario muestra mails de ejemplo.

**Bugs que salieron de los tests, no de mirar la pantalla**

1. La animación del badge quedó en **420ms**, violando la regla del repo de "<300ms". El check lo
   detectó y se bajó a 240ms.
2. **3 regresiones** al cambiar el contrato: `test-bandeja-tudia-849.js`,
   `test-bandeja-premium-v2.js` y `test-bandeja-toolbar-compacta.js` afirmaban "los 3 indicadores"
   y "solo Recibidos y Enviados". Los 3 se **invirtieron**, no se borraron.
3. `test-bandeja-tudia-849.js` crasheó: corre `calcularIndicadores` en un sandbox y la función pasó
   a depender de 4 helpers nuevos. Se traen los **helpers reales** desde `app.js` en vez de
   stubearlos: un stub que devolviera 0 siempre haría pasar el cálculo de "nuevo" sin comprobarlo.
4. Un check de "detiene la propagación" **no miraba `stopPropagation`**: miraba que
   `_setAlertasTuDia` siguiera a `renderSidebar`. Existía y nunca comprobó lo que decía comprobar.
   Lo detectó la mutación que saca el `stopPropagation`.
5. Un check **constante-falso**: se escribió `\bspill\b` cuando la variable se llama `pill`. Como
   nunca matcheaba, fallaba siempre — y las mutaciones se reportaban como "detectadas" aunque el
   check no comprobaba nada. Se vio porque el test quedó rojo sobre el código **correcto**.

**El bug que solo apareció probando la app** (y que los tests NO cazaron)

El owner lo probó y el pillón **no apareció** al llegar un correo. La causa era de diseño:

- La línea base de "lo visto" **solo se escribía al hacer clic** en el indicador.
- Un owner que nunca hace clic se queda **sin línea base para siempre**.
- Sin línea base, `nuevo` da 0 siempre → el aviso era indistinguible de "no hay nada".
- Los tests estaban en verde porque **todos sembraban el `localStorage` antes de mirar el
  resultado**: probaban el caso fácil y dejaban el difícil sin ver.

**La solución tiene dos partes, y la segunda es la que faltaba:**

1. `init()` siembra la línea base con el número actual, **después** de cargar correos y eventos
   (sembrarla antes leería un `state.mails` vacío y guardaría 0, con lo cual todo lo que el owner
   ya tenía se le contaría como nuevo al abrir).
2. Un **escenario funcional** que arranca de un `localStorage` **vacío**, siembra, simula la
   llegada de un correo y exige que marque 1. Más un check que ata la siembra a `init()`, porque el
   bloque funcional llama a `_sembrarVistos()` a mano y por sí solo no comprueba que nadie la
   invoque en el arranque.

**El segundo bug que solo apareció probando la app** (este NO era lógica, era visual)

El owner volvió a probar y dijo: *"se actualiza correctamente mostrando los nuevos correos, pero no
se refleja lo deseado... muestre el contador 2, 3, 4 y el efecto rojo"*. O sea: el número llega
bien, **pero no se ve**.

- La primera versión tenía **una sola capa de aviso**: el número, a 9.5px, sobre un ícono de fondo
  azul clarito, sin sombra que lo despegara.
- Con una sola capa hace falta que el ojo **ya esté en esa fila**. Y "Tu día" se mira de reojo.
- El badge del shell que el owner señaló como referencia es 18px de alto, con sombra fuerte y
  tipografía pesada. Lo que hace que se note no es el número, es el **peso visual** del bloque.

**Ahora hay tres capas**, y con que se vea una sola ya se nota:

| Capa | Qué hace |
|---|---|
| 1 | La **fila completa** se tiñe de `--kair-red-soft` con una barra roja de 3px a la izquierda |
| 2 | El **ícono** se tiñe más fuerte (`#f8d3d8` con glifo `#a3212f`) |
| 3 | El **pillón**: 22×19px, `font-size: 11px`, `font-weight: 800`, **anillo blanco de 2px** |

El **anillo blanco** fue la pieza que faltaba: un rojo sobre un azul clarito se pierde, y el blanco
es lo que lo despega del fondo. La barra roja va inset (`top/bottom: 4px`) con radio de un solo
lado, porque pegada a los bordes asomaba por las esquinas redondeadas de la fila. Y la fila con
novedad conserva su feedback de hover, que el fondo rojo tapaba.

**La lección**: "el número está bien" y "se ve" son dos cosas distintas, y ningún test de lógica
distingue entre ellas. Un aviso que solo cambia un texto de 9.5px puede ser **correcto y
perceptualmente invisible**. La prueba de un aviso visual es que el owner lo vea, y la primera
prueba manual es la que lo destapó.

**La lección**: un test que siembra el estado antes de arrancar prueba el camino feliz por
construcción. El escenario que hay que probar es el que empieza **sin nada**.

**La segunda corrección del mismo bug: la línea base solo subía**

La primera corrección (sembrarla en `init()`) era necesaria pero no alcanzaba. Quedaba esta: el aviso
marcaba bien mientras el número **subiera**, y se apagaba en cuanto bajaba. La causa era que la
línea base guardada nunca se ajustaba hacia abajo.

| Momento | Sin leídos | Línea base | `nuevo` | Lo que veía el owner |
|---|---|---|---|---|
| Hizo clic | 4 | 4 | 0 | normal |
| Leyó en el celular | 0 | **4** (congelada) | 0 | normal |
| Llegó un correo nuevo | 1 | **4** | `max(0, 1-4)` = **0** | **no avisaba** |

Tenía que juntar **5 sin leídos** para que el aviso volviera a prender. Y despachar el correo
fuera de la app es exactamente como el owner lo hace: no era un caso raro, era el camino de todos
los días. El arreglo son dos líneas: cuando `actual < visto`, la base se reancla a `actual`, porque
si el número actual cayó por debajo de lo visto, ya no hay nada pendiente de su lado.

**Cómo se destapó, que es la parte importante**: el test ya tenía la comprobación *"si baja de la
línea base el aviso es 0, nunca negativo"*, y pasaba. El bug estaba **después** de ese `0`: la
comprobación miraba el valor instantáneo y se detenía ahí, sin preguntar qué pasaba en el paso
siguiente. Un test que afirma una propiedad en un instante no dice nada sobre la transición.

**La lección general**: cuando un contador o un aviso dependa de un valor previo, comprobar `f(x)`
no basta — hay que comprobar `f(x)` **y** `f(lo que viene después de x)`. El valor en sí puede ser
correcto y la transición estar rota. Es el mismo patrón del "mutante vacío": el test verde sobre
un caso que nunca se ejerce.

**Decisiones del owner** (no volver a preguntar)

- El toggle es un **switch que enciende/apaga las alertas**, no un filtro.
  → **CORREGIDO en la revisión siguiente**: el owner rechazó el switch y pidió el pillón.
- **"Invitaciones pendientes" se oculta** hasta que tenga fuente real (parseo del `.ics`).
- El aviso es el **PILLÓN rojo, no un switch**. La primera versión con switch fue rechazada.
- El **número grande sigue viniendo de Gmail**, independiente del servicio de notificaciones
  (*"este es independiente de las notificaciones, es para el correo"*).
- Al hacer clic se **marcan como leídas, y el 99+ también baja**.
- Cuando un aviso **parezca** a otro, hay que **investigar cómo está construido el otro**, no copiar
  lo que se ve. Tres versiones seguidas salieron de "copiar la captura" y las tres quedaron mal; la
  cuarta salió de leer el servicio.
- Se preguntó antes de codear y se procedió a ejecutar después del OK.
- **El aviso es el PILLÓN rojo, no un switch.** La primera versión con switch fue rechazada.

**Tests**

| Archivo | Checks | Mutation |
|---|---|---|
| `test-bandeja-tudia-853.js` | 75/75 | **35/35** |
| `test-bandeja-tudia-849.js` | 49/49 | — (checks invertidos + sandbox con el helper de 📦854) |
| `test-bandeja-premium-v2.js` | 48/48 | — (check invertido) |
| `test-bandeja-toolbar-compacta.js` | 51/51 | — (check invertido) |

Suite completa: 112 tests, 94 verdes, 18 preexistentes, **0 regresiones**.

---

### 2026-10-03 · Documentación (📦852)

**Qué se hizo** — tanda de mantenimiento documental puro. **Cero cambios en la app.**

| Qué | Detalle |
|---|---|
| Auditoría completa | Toda la documentación contrastada contra el código real |
| Reglas falsas eliminadas | `KairUI.esc()`, `KairHelpers.formatDate()`, "var no let/const", "último 📦579" |
| `PROMPT.md` v2.0 | Índice que referencia en vez de duplicar; documenta las 3 islas de paleta |
| `Historial.md` y `CLAUDE.md` | Nuevos, en la raíz del repo |
| `CONTEXT.md` | 68 líneas gigantes → 1 318 legibles, **md5 idéntico**, 0 caracteres perdidos |
| 3 trampas de `AGENTS.md` | Corregidas, incluida la del CSS que nunca existió |
| `PRODUCT.md` | Paleta, tipografía, dark mode y 2 afirmaciones falsas |
| Bump | `0.1.233` → `0.1.234` |

**Por qué** — la documentación era la fuente de verdad y mentía. Un modelo que siguiera sus reglas
al pie de la letra escribía llamadas a funciones inexistentes y la vista se caía.

**Bugs encontrados** — ninguno estaba en el código, todos los encontró la verificación:

1. **Un script de documentación iba a destruir el CHANGELOG.** Reemplazaba el encabezado
   `## [0.1.233]` sin reponerlo: las entradas 📦850 y 📦851 quedaban sin encabezado, absorbidas
   dentro de 0.1.234, y el script reportaba `OK`. Un encabezado no es una línea más — perderlo
   deja huérfano todo lo que viene después.
2. **La afirmación "ese CSS nunca estuvo en el repo" se verificó contra los 1 244 commits** de
   todas las ramas, no solo contra el árbol actual. Sin eso habría sido una presunción.
3. **Mi propio verificador mintió**: marcó "FALTA" a 3 documentos que sí existían, porque los
   buscó en `sgsst-electron-app/` y están en la raíz del repo.
4. **Dos palabras pegadas y dos términos en inglés** que casi van al CHANGELOG público.

**Decisiones del owner** (no volver a preguntar)

- Las **validaciones visuales** de v0.1.214, v0.1.215, 📦850 y 📦851 **ya fueron revisadas** y no
  tienen observaciones registradas. **No queda ninguna abierta.**
- Documentos nuevos en la **raíz del repo**, versionados junto a `PRODUCT.md`.
- "Nada es una regla hasta comprobarlo en el código" — regla de primer orden, no opcional.

**Tests** — ninguno nuevo. Suite sin cambios: 111 tests, 93 verdes, 18 preexistentes.

---

## 📝 Plantilla para una entrada nueva

```markdown
### AAAA-MM-DD · <tema> (📦<n>)

**Qué se hizo** — tabla: paquete → qué
**Por qué** — el pedido o el síntoma, en una frase
**Tests** — archivos, checks y mutaciones
**Decisiones del owner** — lo que confirmó, para no volver a preguntar
**Bugs encontrados** — los que no estaban en el código, y cómo los cazó el test
**Archivos tocados**
**Commits** — hash, paquete, y si se pusheó
```

---

## 🔻 Regla de cierre (obligatoria)

**Antes de terminar cualquier trabajo o sección, el modelo DEBE preguntar al owner:**

> "¿Querés que actualice los documentos (`Historial.md`, `PROMPT.md`, `CONTEXT.md`) para la próxima jornada?"

**No cerrar la sesión sin haberlo preguntado.** Sin esa pregunta, el próximo modelo arranca sin
saber qué se hizo, qué quedó a medias ni qué está bloqueado — y ese es exactamente el problema
que este archivo existe para evitar.

Al owner le corresponde responder. Si dice que sí, se actualizan:

| Documento | Qué se escribe |
|---|---|
| `Historial.md` | Bloque de estado + entrada de la jornada |
| `PROMPT.md` | Si apareció una regla nueva de proceso o una trampa nueva |
| `CONTEXT.md` | Si cambió el estado del proyecto o el foco |
| `AGENTS.md` | La lección del bug, con su "por qué se rompió" |
| `CHANGELOG.md` + `README.md` + `release-notes.md` | Al commitear, no al cerrar |
