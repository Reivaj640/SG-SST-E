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
| **Fecha de cierre** | 2026-10-03 |
| **Rama** | `Dev-Pc` (el remoto por defecto es `Dev`) |
| **Último commit** | `47779352` — 📦850-851 · **sin pushear** |
| **Commits sin pushear** | 1 |
| **Versión** | `0.1.233` (desarrollo) · último publicado `v0.1.205` |
| **Suite** | 111 tests · 93 verdes · 18 preexistentes · **0 regresiones** |
| **Árbol de trabajo** | Con cambios sin commitear: `PROMPT.md` (nuevo), `PRODUCT.md`, `sgsst-electron-app/AGENTS.md` |

### ▶️ Retomar desde acá — siguiente paso concreto

1. **Push pendiente.** Hay 1 commit sin subir (`47779352`) y este trabajo sin commitear.
   Push solo con autorización del owner y con `git push --force-with-lease`.
2. **Owner tiene que validar visualmente** el botón del borde de la columna lateral (📦850) y
   el encabezado sin la etiqueta de fecha (📦851). Los dos están implementados y probados, pero
   **nunca se miraron en la app**.
3. **Decidir sobre el bug de `styles.css`** (ver más abajo, bloqueantes).

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
| 8 | 2 validaciones visuales que CONTEXT.md dejó abiertas | `CONTEXT.md` v0.1.214 (confetti del splash) y v0.1.215 (home de Capacitaciones) | **No verificables desde el código.** Hay que preguntárselo al owner |

### 📋 Cola de trabajo acordada

| Orden | Tema | Estado |
|---|---|---|
| 1 | 📦828 · Matriz de requisitos legales 2.7.1 | Pendiente |
| 2 | 📦841 fase 2 · Tabs del dashboard | Pendiente |
| 3 | 🔴 Cerrar el bypass de `gh:update-personal` (bloqueante #2) | Pendiente, abierto desde v0.1.212 |
| 4 | Arreglar los tokens faltantes de `styles.css` (bloqueante #1) | Pendiente, sin autorizar |
| 5 | Migración de `actualizado_en` para BDs previas (bloqueante #3) | Pendiente |
| 6 | Preguntar al owner por las 2 validaciones visuales abiertas (bloqueante #8) | **Pregunta pendiente** |
| 7 | Limpiar código muerto de la Bandeja | Pendiente, esperando decisión |

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
| `47779352` | 📦850-851 | **No** |

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
