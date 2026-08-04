# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **🐛 Fixes críticos de Bandeja Integrada + Google Calendar (📦646 series, 13 fixes)** — Lote completo de correcciones para los problemas del calendario y la sincronización con Google Calendar.
  - **📦643 Flicker calendario**: `loadEventsFromGoogle` ya no filtra contra `state.events` (causaba que eventos aceptados alternaran visible/oculto cada polling). Deduplicación al final sobre datos recién obtenidos.
  - **📦644 Día de la semana incorrecto**: `WEEKDAY_LABELS` usaba `(getDay() + 6) % 7` pero el cálculo se hacía con índice de columna en vez del día real. Generaba desfase cuando el mes no empezaba en lunes.
  - **📦646 Iframe adapter fallback**: `getApi()` helper con fallback a `window.parent.electronAPI`. Antes `adapter` era `undefined` dentro del iframe de Bandeja Integrada.
  - **📦646-fix1 ID mismatch post-create**: `adapter.create()` asigna ID nuevo en DB. `saveEvent()` sincroniza `newEvent.id = res.data.id` para que el `adapter.update()` posterior funcione.
  - **📦646-fix2 Google Calendar iframe fallback**: `saveEvent()` usa `getGoogleCalendarApi()` (con fallback) en vez de `window.electronAPI.googleCalendar` directo.
  - **📦646-fix3 `fromGoogleEvent` usa kairId**: antes generaba `id: 'gcal-' + g.id`. Ahora `id: kairId || 'gcal-' + g.id` para que el dedup los una naturalmente.
  - **📦646-fix4 `confirmModal()` reusable**: reemplaza el `confirm()` nativo. Promise-based, variantes `danger`/`primary`, atajos Enter/Esc, z-index 600000.
  - **📦646-fix5 Delete handler dual-path**: detecta `rapido-*` vs `gcal-*`. `NOT_FOUND` fallback a Google. Cancelación automática a attendees con `sendUpdates:'all'`.
  - **📦646-fix6 Dedup con 2 keys**: usa `googleEventId` Y `id` (cualquiera de las dos). Antes solo `googleEventId || id`, generaba duplicados.
  - **📦646-fix7 Botones confirm modal prominentes**: nueva clase `.kair-event-modal__btn--danger-solid` (rojo sólido). Inline styles forzando especificidad. Sombra del modal más profunda.
  - **📦646-fix8 Schema: `google_event_id`**: nueva columna en `eventos_rapidos`. Migración `ALTER TABLE` con try/catch. Update inteligente.
  - **📦646-fix9 Calendario persistente post-save**: removido `state.calendarVisible = false` después de Guardar. Foco automático en "+ Crear" para batch event creation.
  - **📦646-fix10 Edit modal: Asistentes + Google sync**: campo Asistentes pre-cargado + UPDATE/CREATE en Google con `sendUpdates:'all'`. Toast diferenciado.
  - **📦646-fix11 Schema: `attendees`**: nueva columna JSON stringificado. Parse en `_rowToEvent` con fallback a texto plano legacy.
  - **📦646-fix12 Bridge no persistía attendees**: el SQL de `INSERT` y `UPDATE` NO incluía `attendees` ni `google_event_id`. Resultado: cualquier evento con attendees quedaba con `attendees: []` en DB aunque Google sí los tuviera. Ahora se persisten correctamente.
  - **📦646-fix13 Safety net en edit modal**: si el evento no tiene attendees locales pero tiene `googleEventId`, consulta a Google y los trae on-the-fly. Los persiste para futuras ediciones.
- **🆕 Time Zone Google Calendar (📦646-tz)** — `toGoogleEvent()` y `upsertFromIcs()` ahora incluyen `timeZone: 'America/Bogota'`. Google Calendar API v3 rechaza `dateTime` naive con 400 desde 2024.
- **🆕 Método `gcalApi.get()` (📦646-get)** — Nuevo handler IPC `google-calendar:get` para traer UN evento específico por ID.
- **🎨 Iconos SVG Lucide en sidebar y headers (📦642, publicado v0.1.142)** — Reemplazo completo de PNG/FontAwesome por SVGs inline Lucide. Un solo color (currentColor heredado), más liviano.
  - `renderer.js:3416` fix: el botón "Salir" usaba `iconImg.src = "assets/${salir.icon}"` (404 con el nuevo formato). Ahora `iconWrap.innerHTML = SIDEBAR_ICONS[salir.icon]`.
- **⬆️ Botón flotante scroll-to-top/bottom (📦640, publicado v0.1.141)** — Clase reusable `ScrollToTopBottomButton` en `modules/shared/scroll-fab.js`.
- **✏️ Editar/Eliminar filas en tabla de ausentismo (📦639, publicado v0.1.141)** — Botones outline, edit in-place, recálculo de días, auto-completar CIE-10.
- **🆕 Hora visible en calendario semanal/diario (📦638, publicado v0.1.141)** — Bloques de eventos muestran la hora de inicio.

### Fixed
- Bug crítico en `main/eventos-rapidos-bridge.js`: el SQL de `INSERT` y `UPDATE` no incluía `attendees` ni `google_event_id`, por lo que ningún attendee nuevo se persistía en K+AIR.
- Bug en dedup de `loadEventsFromIPC`: cuando K+AIR no tenía `googleEventId` persistido pero Google sí, los eventos se duplicaban. Ahora mergea attendees/htmlLink desde Google.
- `renderer.js:3416` log_out 404: SVG icon name usado como path PNG.
- Días de la semana del calendario se mostraban corridos cuando el mes no empezaba en lunes.

## [0.1.142] - 2026-08-03

### Added
- **🎨 Iconos SVG Lucide en sidebar y headers (📦642)** — Reemplazo completo de PNG/FontAwesome por SVGs inline Lucide.
- **🔧 Quitar BOM UTF-8 del package.json (📦641)** — El BOM rompía electron-rebuild. Fix reproducible con Python.

## [0.1.141] - 2026-07-30

### Added
- **⬆️ Botón flotante scroll-to-top/bottom (📦640)**
- **✏️ Editar/Eliminar filas en tabla de ausentismo (📦639)**
- **🆕 Hora visible en calendario semanal/diario (📦638)**

## [0.1.140] - 2026-07-30

### Added
- **🔄 Re-iteración del update UX** — Ajustes al flujo de auto-update publicado en v0.1.131.

## [0.1.131] - 2026-07-22

### Added
- **🎯 Submódulo 3.1.3 Perfiles de cargo y Profesiograma (📦589, completo)** — Implementación end-to-end del profesiograma.
  - **Fase 1 (backend)**: Bridge IPC (`main/profesiograma-bridge.js`, 52 KB) con schema SQLite de 10 tablas (kp_*) y 26 handlers (CRUD para Empresa, Profesiograma, GrupoOcupacional, Cargo, TipoExamen, CargoExamen con I/P/R, DescripcionPrueba, Recomendacion, AlturaRequisito, Vacuna, VacunacionCargo, más select-excel y KPIs). Schema idempotente (`CREATE TABLE IF NOT EXISTS`), foreign keys con CASCADE, índices en columnas consultadas.
  - **Fase 2 (UI)**: Viewer con 6 vistas (home + Matriz + Pruebas + Recomendaciones + Vacunación + Alturas) en iframe autocontenido. Header con breadcrumb, tabs de navegación, dialog genérico para CRUD, búsqueda en la matriz, KPIs con skeleton y badges. Botón "Importar Excel" en el header que abre file picker filtrado (.xlsx/.xls) y dispara la importación. Botón "Volver" usa `postMessage` para regresar al home del módulo. CSS custom (no Bootstrap) con design system K+AIR (--primary #174ea6, --success, --warning, etc.).
  - **Fase 3 (parser Excel)**: Fix de bugs detectados al ejecutar contra el archivo real `GI-FO-047 Profesiograma Tempoactiva.xlsx` (175 KB, 8 hojas). El parser ahora detecta la fila de headers buscando "GRUPO OCUPACIONAL" en col 0, lee las categorías desde fila 7 (EVALUACIÓN MÉDICA / PRUEBAS COMPLEMENTARIAS / LABORATORIO), e importa las vacunas desde la hoja "ESQUEMA INMUNIZACION" (no desde "VACUNACIÓN TRABAJADORES" cuya estructura es de cruce cargo×vacuna). Resultado: 5 grupos, 21 cargos, 20 tipos examen, 105 relaciones cargo-examen, 10 descripciones de prueba, 8 recomendaciones, 2 requisitos de altura, 4 vacunas.
  - **Fase 4 (tests)**: 2 scripts de test (`test-profesiograma-import.js` + `test-profesiograma-handlers.js`) con mock de DB que ejecuta el import real + valida los 9 handlers de list + CRUD básico. **20/20 tests OK**. Los 161 tests existentes (`main/test-fixes-loop48.js`) siguen pasando.
- **🚀 `scripts/release.ps1` — flujo automatizado de release** — Script PowerShell que ejecuta el流程 completo en 7 pasos: (1) verifica pre-requisitos (`GH_TOKEN` + branch `Dev-Pc` + working tree), (2) corre tests (`-SkipTests` para saltar), (3) `git push origin Dev-Pc`, (4) crea el tag `v<version>` local, (5) **`git push origin v<version>` — el paso crítico que evita el 422 de "Published releases must have a valid tag"**, (6) verifica que GitHub ve el tag, (7) corre `electron-builder --win --publish=always`. Si el build falla, llama automáticamente a `fix-release.ps1` como fallback. Mensajes claros en cada paso, detección de versión automática desde `package.json`, y rollback del tag si ya existe.
- **🛟 `scripts/fix-release.ps1` — fallback cuando electron-builder falla al subir** — Versión reutilizable del workaround manual que aplicamos para v0.1.131/132/133. En 6 pasos: (1) verifica que el `.exe` y `.blockmap` existen localmente, (2) calcula el SHA512 real y regenera `latest.yml`, (3) obtiene o crea el release via API de GitHub, (4) borra assets huérfanos con nombre viejo (`sgsst-electron-app-setup-*`), (5) sube `.exe` + `.blockmap` + `latest.yml` con `curl` directo a `uploads.github.com`, (6) PATCH el name + body del release. Tiene los 2 fixes de bugs descubiertos en intentos manuales: regex correcta `\{[^}]*\}` (no se come el `}`) y delimitación `${uploadBase}` (PowerShell no trata `?` como wildcard).

### Removed
- **🗑️ `Portear/python-embed.bak/` (20.8 MB)** — Backup legacy con ejecutables de torch/transformers/accelerate/huggingface-cli del modelo viejo (cuando se usaba transformers, antes de migrar a Ollama/GGUF). Confirmado por grep: **NADIE lo referencia** — ni `main.js`, ni `package.json`, ni los build scripts, ni los scripts Python. Solo `.gitignore` lo conocía. La app usa exclusivamente `Portear/python-embed/` (340 MB con pandas, pymupdf, flask, etc.) que sigue intacto. Borrado del repo local y del build output (`dist/win-unpacked/resources/app/Portear/python-embed.bak/`). Recuperable desde la papelera de Windows.
- **🗑️ ~60 archivos firmados con signtool innecesariamente** — El `.bak` se firmaba en cada build (accelerate.exe, transformers.exe, torchrun.exe, huggingface-cli.exe, etc.). Ahora se saltan, ahorrando 1-2 min de firma.

### Build & Tooling
- **📦585 — Commit de tooling** (este commit). Cero cambios funcionales, solo自动化 del流程 de release y limpieza de dead weight.

## [0.1.131] - 2026-07-22

### Added
- **🔄 Update UX completo (📦581, Loops 1-10)** — Sistema de actualizaciones rediseñado estilo Claude, no invasivo, anclado al footer. 7 loops de iteración visual con el user. (1) **Botón-dot opencode-style en el footer** (al lado de la versión): OCULTO al día, **AZUL con pulse** cuando hay update disponible, **VERDE con halo** cuando está descargado. Click en el dot abre el dropdown anclado arriba del footer. Sin texto redundante en el header (la versión ya está en el footer). (2) **Dropdown con Claude-style**: header azul claro (#e8f0fe), border-radius 12px, 2 botones de acción (Reiniciar / Más tarde) + link "Ver información de versión" que abre el modal. Z-index 500001 para escapar del `isolation: isolate` del header. (3) **Modal "Información de actualizaciones"** (user-invoked): badge de estado con dot animado, grid con versión instalada / última versión / última verificación / canal, botón "Buscar actualizaciones ahora" con feedback de "Buscando…", dark theme support. (4) **Panel "Actualizaciones" en Configuración** (pestaña "Acerca de la App"): grid con la misma info + 6 estados (idle / checking / not-available / available / downloaded / error) + botón de check manual + botón "Reiniciar e Instalar". (5) **Disclaimer "Se instalará al cerrar la app"** al lado del dot del footer (solo visible cuando hay update, cambia a "Lista para reiniciar" cuando está descargado). (6) **Release notes desde GitHub API** en el modal: IPC handler `get-release-notes` en `main.js` con cache de 1h, render en formato monospace con scroll interno.

### Changed
- **🔄 Toasts invasivos removidos (Loop 3)** — `notifyAvailable()`, `notifyDownloaded()` y `updateProgress()` ahora son no-ops (solo loguean). El UI muestra el dot del footer en su lugar. `notifyError()` se mantiene (errores merecen notificación, transitorio de 6s).
- **📦 refactor del update button del header al footer (Loop 4b)** — Eliminado el `<button id="header-update-btn">` del header y 200+ líneas de CSS legacy (`.header-update-btn*`, `.header-update-text*`, `.header-update-panel`, `.update-progress-*`, keyframes viejos). El nuevo `<button id="footer-update-btn">` está al lado de `#app-version` con un dot de 8px que cambia de color según el estado.
- **📐 Dropdown positioning con footer como referencia (Loop 5.5)** — El cálculo de posición del dropdown usa el `top` del `#app-footer` (no el del dot) y setea un `max-height` dinámico al espacio disponible. Si el contenido es más grande, hace scroll interno en el body. Fix del bug donde el dropdown invadía el footer.

### Fixed
- **🐛 Texto blanco invisible del header update button (Loop 4 fix)** — El color del texto era `rgba(255, 255, 255, 0.7)` (blanco), invisible sobre el header claro. Corregido a `var(--text-light-color, #6c757d)` (gris medio) que se ve bien en light + dark theme.
- **🐛 Style.display inline override (Loop 1.5)** — `updateHeaderStatus()` ya no usa `headerUpdateBtn.style.display = 'none'` (que override el CSS con `!important`). Ahora usa `headerUpdateBtn.hidden = true/false` (manejado por CSS).
- **🐛 aria-hidden warning con focus atrapado (Loop 5.5)** — `closeUpdateDropdown()` ahora hace `document.activeElement.blur()` antes de poner `aria-hidden="true"`. Sin esto, el browser loggeaba un warning de a11y cada vez que se cerraba el dropdown con focus en un botón.

### Removed
- **🗑️ CSS legacy del header update (200+ líneas)** — `.header-update-btn*`, `.header-update-text*`, `.header-update-btn__icon`, `.header-update-panel`, `.update-progress-*`, `.update-install-btn`, `.update-download-btn`, `@keyframes kair-update-btn-pulse`, `@keyframes kair-update-icon-bounce`. Todo reemplazado por el sistema del footer dot (más simple, menos invasivo).
- **🗑️ 11 backup tags de git** — `backup-before-cleanup-*`, `backup-pre-*-2026-07-20/21/22`. Borrados local y remoto.

### Build & Tooling
- **🔖 Bump version 0.1.131** — `package.json` actualizado a v0.1.131.
- **✅ 158 tests OK** en `main/test-fixes-loop48.js` cubriendo HTML/CSS/JS del footer dot, dropdown, modal, panel de config, disclaimer, release notes.

## [0.1.130] - 2026-07-21

### Added
- **🎨 Menú nativo de Electron oculto en dev y producción** — La barra de menú nativa de Windows (File / Edit / View / Window / Help) ya no se muestra de forma predeterminada. En **modo desarrollo** (`npm start`) el menú está oculto pero aparece temporalmente cuando se presiona la tecla **Alt** (comportamiento estándar de Windows para apps como Discord, Slack, VSCode). En **modo producción** (app instalada con `.exe`) el menú está oculto TOTALMENTE, ni siquiera aparece con Alt. Esto le da al dev acceso rápido a Reload/DevTools sin saturar la UI, y al cliente final una ventana limpia sin elementos del sistema operativo. Implementación: (a) nueva propiedad `autoHideMenuBar: true` en el `BrowserWindow` de `main.js` (opción nativa de Electron), (b) bloque condicional `if (app.isPackaged) { Menu.setApplicationMenu(null); }` en `app.whenReady()` que oculta el menú totalmente en producción.

### Build & Tooling
- **🔖 Bump version 0.1.130** — `package.json` actualizado a v0.1.130.

## [0.1.129] - 2026-07-21

### Fixed
- **🐛 Click en evento del calendario no abría el modal de detalle** — Cuando el user hacía click en un evento del calendario grande, se mostraba un toast con info básica (Título · Sin lugar · Fecha) en la parte de abajo, pero el modal completo de detalle NUNCA se abría. CAUSA RAÍZ: el F4-fix (Loop 572) eliminó el `KAirCalendar` viejo que tenía el `onEventClick` callback, pero el `renderBigCalendar` custom (Loop 1918) que quedó en su lugar seguía usando `selectEvent(ev)` que SOLO mostraba el toast. La función `openEventDetailModal(ev, adapter)` existía y estaba bien implementada, pero NUNCA se llamaba desde el `selectEvent`. FIX (loops 46, 46b): (a) **Loop 46 CSS**: `.kair-event-modal-overlay` con `z-index: 500000` (era 300000, mismo que otros elementos del calendario → quedaba detrás), `backdrop-filter: blur(2px)`, y nuevo selector `.kair-event-modal-overlay[style*="display: flex"]` con `display: flex !important` para forzar la visibilidad. (b) **Loop 46b JS**: `selectEvent(ev)` ahora llama a `openEventDetailModal(ev, getKairCalendarAdapter())` cuando el evento NO tiene `linkedMailId` (en lugar de solo mostrar el toast). Si el modal no está disponible, fallback al toast. Resultado: el modal de detalle se abre centrado con overlay oscuro, mostrando header con categoría (color), título del evento, fecha + hora, ubicación, descripción, y los botones Marcar cumplido / Editar / Eliminar.

### Build & Tooling
- **🔖 Bump version 0.1.129** — `package.json` actualizado a v0.1.129.
- **Cache-bust v=668 → v=669** — bump por el fix de `selectEvent` (CSS queda en v=668 porque solo cambió el JS del comportamiento).

## [0.1.128] - 2026-07-21

### Fixed
- **🐛 Modal de crear evento se veía todo pegado** — El modal de "Nuevo evento de calendario" (renderEventModal) usaba clases como `.kair-field`, `.kair-input`, `.kair-modal__header/title/body/footer`, `.kair-chip-select`, `.kair-duration-row` que NO existían en el CSS de la Bandeja Integrada. Sin estilos, todo se veía pegado (label pegado al input, botón X en la esquina equivocada, sin padding interno, sin focus state en los inputs). FIX (loop 44): se agregaron todos los estilos CSS al `bandeja-integrada/styles.css` (nuevo bloque "K+AIR Modal") — overlay con backdrop blur, header con título y X a la derecha, body con padding y scroll, footer con botones alineados, field con gap 6px entre label e input, inputs con border-radius y focus state azul, chip-select para categoría con dot de color, duration-row con active state visible. La Bandeja Integrada se ve como un modal profesional ahora (Gmail-style).
- **🐛 Overlay tapaba toda la Bandeja Integrada** — Después de agregar el CSS del modal, la Bandeja Integrada se veía con una opacidad oscura cubriendo todo y bloqueando clicks. CAUSA: el CSS ponía `display: flex` en `.kair-modal-overlay` que PISABA el atributo `hidden` del HTML (específico del navegador). Resultado: el modal aparecía desde el inicio, tapando todo. FIX (loop 44b): se cambió el selector a `.kair-modal-overlay:not([hidden])` para que el `display: flex` solo se aplique cuando NO está oculto. Ahora el modal se oculta por default y solo aparece al abrir.
- **🐛 Switch "Todas las empresas" no se veía** — El switch existía en el HTML (index.html línea 74 con `id="toggle-companies"`) y en el JS (app.js línea 1156-1908 con handlers, localStorage, etc), pero NO se veía porque estaba dentro del `<header class="kair-header">` que tiene `display: none !important` (línea 164 del CSS, desde que se ocultó el header interno del iframe para no duplicar con el de la app principal). FIX (loops 45, 45b, 45c): (a) Saqué el toggle del header oculto y lo puse en la **toolbar del calendario grande**, justo antes del grupo "Día / Semana / Mes / Programar", con un divider vertical al lado. (b) Usé la clase `.kair-toggle` (no una nueva) para que las reglas CSS de animación funcionen correctamente: `data-on="true"` → track verde `#16a34a` + thumb a la derecha con `transform: translateX(14px)`, `data-on="false"` → track gris `#cbd5e1` + thumb a la izquierda. Transición animada de 220ms (cubic-bezier). (c) Moví el handler del click de los bindings iniciales al **bloque de bindings de la toolbar** (después de `main.appendChild(toolbar)`), porque la toolbar se re-crea con `innerHTML` en cada `render()` y el listener del binding inicial se perdía. El handler hace todo: toggle del estado, actualizar `data-on` y label, persistir en localStorage, actualizar el footer, y **recargar los eventos del calendario con el nuevo scope** (la pieza clave para que el filtro funcione).

### Changed
- **🔧 Switch de empresas más pequeño en la toolbar** — Para que se vea proporcionado dentro de la toolbar del calendario (que tiene poco espacio), el switch es más pequeño: 30px de ancho (vs 36px original) y 12px de thumb (vs 16px). El label sigue siendo legible con `font-size: 0.75rem` y `white-space: nowrap`.

### Build & Tooling
- **🔖 Bump version 0.1.128** — `package.json` actualizado a v0.1.128.
- **Cache-bust v=660 → v=667** — 7 versiones incrementadas durante la iteración (v=660 loop 40 base, v=661 loop 41, v=662 loop 42, v=663 loop 44 modal CSS, v=664 loop 44b overlay fix, v=665 loop 45 switch FAB, v=666 loop 45b switch en toolbar, v=667 loop 45c handler del click).

## [0.1.127] - 2026-07-21

### Changed
- **🎨 Loop 41 — Mejor visualización de sender + preview en la lista de correos** — Antes: con 340px de ancho de lista y 90px de columna de fecha, el content tenía solo ~134px → el sender se truncaba en "adm..." y el preview en "P...". Ahora: (a) **Ancho de lista aumentado**: `340px → 420px` (+80px de espacio para content). En pantallas <1280px: `300px → 380px`. (b) **Columna de fecha reducida**: `90px → 64px` (-26px recuperados). "11:27" o "ayer" entran perfecto en 64px. (c) **Render del sender inteligente** (estilo Gmail): si `m.sender` es un nombre y `m.senderEmail` es distinto, ahora se muestran como 2 spans separados — nombre en bold + email en gris pequeño al lado con ellipsis si es muy largo. Si el `sender` ES el email (caso self-sent), se muestra solo el email completo sin duplicar. (d) **Tooltip con email completo** en el sender y el avatar (`title="Google <no-reply@accounts.google.com>"`). (e) **Preview siempre visible**: removida la clase `kair-hide-lg` del snippet del cuerpo para que SIEMPRE se vea (antes se ocultaba en pantallas chicas). (f) **CSS nuevo**: `.email-row__sender` ahora es `display: flex; align-items: baseline; gap: 6px` para layout de 2 spans. `.email-row__sender-name` (no se trunca) + `.email-row__sender-email` (gris claro, font-size 0.75rem, ellipsis). Ejemplo antes: `A adm... P... 11:27`. Ejemplo ahora: `A adminkair@gmail.com — Prueba de carg... — Prueba de car... 11:27`.
- **🎨 Loop 42 — Reply bar fijo al fondo del detail panel (patrón "3 zonas" Gmail-style)** — Antes: el reply bar (Responder / A todos / Reenviar / input / Enviar) quedaba pegado al final del CONTENIDO del correo, no al fondo del panel. Si el cuerpo era corto, quedaba mucho espacio vacío entre el cuerpo y el reply. Si el cuerpo era largo, había que scrollear toda la página para llegar al reply. Ahora: el detail panel usa el patrón clásico de "3 zonas" — (a) **`.kair-mail-detail`**: `display: flex; flex-direction: column; height: 100%; min-height: 0` toma toda la altura del container padre. (b) **Scroll interno** (`.kair-mail-detail .overflow-y-auto`): nueva regla CSS con `flex: 1 1 auto; min-height: 0` — toma todo el espacio restante entre el header y el reply, hace scroll INTERNO cuando el contenido es largo (no scroll de página). (c) **Reply bar** (`.kair-mail-detail__reply`): `flex-shrink: 0` (NUNCA se comprime) + `z-index: 2` (encima del scroll si hay overlap) — queda SIEMPRE al fondo del panel con su altura natural (~56px), independientemente del largo del cuerpo. Resultado: con cuerpo corto (ej: "Ojo al dato / Enviado desde mi iPhone") el reply queda al FONDO del panel, no pegado al último mensaje. Con cuerpo largo (ej: el correo de Google con logo + botón + links), el body tiene scroll INTERNO y el reply sigue FIJO al fondo sin moverse.

### Build & Tooling
- **🔖 Bump version 0.1.127** — `package.json` actualizado a v0.1.127 para reflejar las mejoras de UX de la lista y el reply fijo.
- **Cache-bust v=660 → v=662** — bump por las mejoras de sender/preview (v=661 loop 41) y reply fijo (v=662 loop 42).

## [0.1.126] - 2026-07-21

### Added
- **🎨 Render del body del correo como HTML Gmail-style (logo, botones, imágenes)** — El cuerpo del correo ahora se renderiza con su HTML original en lugar de texto plano. Se ven: el logo de Google, el botón "Ver actividad" como botón azul redondeado, las imágenes inline, la estructura visual del HTML preservada, y los links con el styling correcto. ANTES solo se mostraba el texto plano y los placeholders como `[image: Google]`.

### Fixed
- **🔧 Triple causa raíz del render de texto plano en correos HTML** — (1) `shared/google-gmail.js` `extractBody()` buscaba `text/plain` primero y nunca retornaba `text/html`. (2) Cuando solo había `text/html`, se lo "strippeaba" con `raw.replace(/<[^>]+>/g, ' ')` (le quitaba todos los tags). (3) `main/email-sync.js` línea 322 hardcodeaba `body_html: ''` al armar el `msgForDb` para `saveMessage`. Resultado: el cache NUNCA tenía HTML rico, la Bandeja Integrada renderizaba solo texto plano sin importar qué. FIX (loops 40-40b, 2 fases): (a) **Loop 40 frontend**: helper `sanitizeHtml(html)` con `DOMParser` que elimina tags peligrosos (`<script>`, `<iframe>`, `<object>`, `<embed>`, `<form>`, `<style>`, `<link>`, `<meta>`, etc), atributos `on*` (event handlers), URLs `javascript:` y `data:text/html`. Helper `isHtmlContent(str)` para detectar si el body es HTML o texto plano. `renderMailBodyHtml` ahora detecta HTML y lo envuelve en `<div class="kair-mail-message__html">` después de sanearlo. `loadMailBodyFromCache` ahora guarda `mail.body_html` además de `mail.body`. Las 2 llamadas a `renderMailBodyHtml` (thread grouping y single mail) ahora pasan `body_html || body_plain` con prioridad al HTML. (b) **Loop 40b backend**: refactor `extractBody` → `extractBodyParts(payload)` que retorna `{ plain, html }` por separado (HTML crudo, sin strippear). `normalizeMessage` ahora exporta `body_plain` Y `body_html` además de `body` (compatibilidad legacy). `email-sync.js` `msgForDb` ahora usa `normalizedMsg.body_plain || body` y `normalizedMsg.body_html || ''` en lugar de hardcodear vacío. (c) **CSS Gmail-style**: nuevo bloque `.kair-mail-message__html` con `max-width: 100%`, fuentes del sistema, `line-height: 1.6`, `word-wrap: break-word`. Estilos para `img` (responsive, max-width 100%, height auto), `table` (border-collapse), `h1-h6` (font-weight 600), `hr` (border-top), `blockquote` (border-left gris), `ul/ol/li`, `a` (color azul `#1a73e8` con underline en hover). (d) **IMPORTANTE — re-sincronización requerida**: los mensajes que ya estaban en el cache se sincronizaron ANTES de este fix, por lo que NO tienen HTML todavía. El user debe esperar al auto-refresh de 5 min o forzar un sync manual (botón Sincronizar / cerrar y abrir la app) para que el cache se llene con HTML.

### Security
- **🛡️ Sanitización XSS del HTML de emails** — `sanitizeHtml()` usa `DOMParser` para parsear el HTML en un Document temporal, eliminar tags peligrosos y atributos `on*` antes de inyectar via `innerHTML`. Previene XSS en correos maliciosos que intenten meter `<script>`, event handlers, `javascript:` URLs, o `data:text/html`. Validación por el user: el correo "Alerta de seguridad" de Google ahora se ve idéntico a Gmail (logo, botón "Ver actividad" como botón azul, link "https://myaccount.google.com/notifications" en azul, estructura visual completa, copyright de Google al final).

### Build & Tooling
- **🔖 Bump version 0.1.126** — `package.json` actualizado a v0.1.126 para reflejar el fix de render HTML.
- **Cache-bust v=659 → v=660** — bump por el fix de render HTML (v=660 loop 40).

## [0.1.125] - 2026-07-21

### Fixed
- **🔗 Click en links del cuerpo del correo abría múltiples ventanas de Electron** — El bug tenía 3 causas raíz que se sumaban: (1) `<a href>` en iframes de Electron SIEMPRE dispara `target="_blank"` automático, incluso con `preventDefault()` y `useCapture: true` (es un comportamiento específico de Electron, no respeta el preventDefault). (2) `attachMailLinkClickHandler()` se llamaba cada vez que se renderizaba un mensaje del thread, y CADA llamada agregaba un nuevo listener al `document` (que es global, nunca se pierde). Resultado: 1 click en un link con thread de 8 mensajes = 8 listeners ejecutándose = 8 llamadas a `api.openExternalUrl()` = 8 ventanas de Electron abiertas en simultáneo. (3) El iframe de Bandeja Integrada NO tiene `window.electronAPI` directamente (solo el main app lo tiene via preload), por lo que el fallback a `window.open()` abría una nueva `BrowserWindow` de Electron en lugar del browser del sistema. FIX (loops 39-39h): (a) Pre-procesador de Google obfuscation para URLs multi-línea: `body.replace(/<(https?:\/\/[^>]+)>/g, ...)` con `replace(/\s+/g, '')` para unir las líneas que Google parte con `\n`. (b) Helper `attachMailLinkClickHandler()` con event delegation en capture phase (`document`) + bubble phase (`container`). (c) iframe `electronAPI` fallback: `var api = window.electronAPI || (window.parent && window.parent.electronAPI) || null;` — accede al IPC del main app via `window.parent.electronAPI`. (d) Solución principal: cambiar `<a href>` por `<span role="link" tabindex="0" data-href="...">` porque `<span>` NO tiene el comportamiento default problemático de `<a>` en Electron (necesita onclick explícito, no tiene `target="_blank"` automático). (e) Loop 39h — flag `isMailLinkHandlerAttached` que previene la duplicación del listener global del `document` (se adjunta UNA sola vez en todo el ciclo de vida del módulo). Defensa adicional: early-return si `e.defaultPrevented` es true. (f) CSS: `.kair-mail-link` ampliado para aplicar tanto a `<a>` como a `<span>`, focus visible con background. Resultado: 1 click en un link = 1 sola ventana del browser del sistema (Chrome/Edge/Firefox según el default del usuario), NO múltiples ventanas de Electron.

### Changed
- **🧹 Limpieza de console.log ruidosos** — Removidos los `console.log` de debug que se agregaron en loops 39-39e para identificar el bug. Solo se mantiene el log final `[BandejaIntegrada] ✓ <span> interceptado, abriendo en browser del sistema: ...` que confirma al usuario que el link se manejó correctamente.

### Build & Tooling
- **🔖 Bump version 0.1.125** — `package.json` actualizado a v0.1.125 para reflejar el fix crítico de duplicación de listeners.
- **Cache-bust v=651 → v=659** — 8 versiones incrementadas durante la iteración del fix (v=652 loop 39, v=653 loop 39b, v=654 loop 39c, v=655 loop 39d, v=656 loop 39e, v=657 loop 39f, v=658 loop 39g, v=659 loop 39h listener dedup).

## [0.1.124] - 2026-07-21

### Fixed
- **🔧 📦573 — KairAlerts no mostraba el popover después de retirar el calendar-button** — Después del 📦572, KairAlerts seguía buscando el badge `#kair-cal-badge` (que ya no existe) y su `_wire()` hacía early return con un warning. Resultado: el popover de pendientes nunca se abría. FIX: las 5 referencias a `getElementById('kair-cal-badge')` en `shared/kair-alerts.js` se cambiaron a `getElementById('bandeja-integrada-badge')`. También se actualizó el mensaje de warning y el comentario sobre `#calendar-button` que ya no existe. Ahora el badge de pendientes aparece en el botón de Bandeja Integrada y el popover se abre/cierra con click.

### Removed
- **🗑️ Carga innecesaria de kair-calendar.css y kair-calendar.js del main app** — Después de retirar el calendar-button (📦572), el componente KairCalendar (`kair-calendar.js`) y sus estilos (`kair-calendar.css`) ya no se usan en el main app. La Bandeja Integrada iframe tiene su propia copia de estos archivos. Se quitaron los `<link>` y `<script>` correspondientes del `index.html` principal. Se mantienen: `kair-calendar-adapter.js` (lo usa KairAlerts) y `calendar-detail-panel.js` (lo usa KairAlerts para el detalle del evento). Resultado: ~2 requests HTTP menos al iniciar la app y un main.js más limpio.

### Changed
- **🧹 Comentarios obsoletos en renderer.js e index.html** — Actualizados los comments que referenciaban `#calendar-button` (ya no existe) para apuntar al `#bandeja-integrada-button`. 3 comments en `renderer.js` (líneas 747, 754, 2189-2193) y 1 en `index.html` (línea 291) limpiados. La documentación interna ahora refleja el estado real de la app.

### Build & Tooling
- **🔖 Bump version 0.1.124** — `package.json` actualizado a v0.1.124 para reflejar la limpieza post-retiro del calendario.

## [0.1.123] - 2026-07-21

### Removed
- **🗑️ 📦572 — Retirar K+AIR Calendar viejo (popover del header)** — Se quitó el botón `calendar-button` del header principal de la app y todo su handler de click (KairCalendar.create con 14 eventTypes, onEventClick, etc). La Bandeja Integrada ya tiene su propio calendario interno (mini-cal en sidebar izquierdo + calendario grande en slide) que usa los mismos IPC handlers y los mismos datos, así que el calendario viejo era redundante. Cambios: (a) `sgsst-electron-app/index.html` — quitado el bloque `<button id="calendar-button">` y su badge `kair-cal-badge`. (b) `sgsst-electron-app/renderer.js` — quitado el bloque de 80 líneas que creaba la instancia de KairCalendar con todos los eventTypes (plan, capacitacion, auditoria, rapido, vencido, gestacion, inspeccion_programada, mantenimiento_programado, recordatorio_copasst, recordatorio_convivencia, recordatorio_presupuesto, recordatorio_afiliacion, recordatorio_inducciones). (c) `KairAlerts` se mantiene activo porque su badge ahora aparece en el botón de Bandeja Integrada (sigue mostrando el conteo de pendientes). (d) Los scripts compartidos `kair-calendar.js`, `kair-calendar-adapter.js`, `kair-calendar.css`, `kair-alerts.js` NO se quitaron del `index.html` principal porque el iframe de Bandeja Integrada y KairAlerts los siguen usando. Backup antes de los cambios: tag `backup-pre-calendar-removal-2026-07-21`. Resultado: -78 líneas netas de código (90 quitadas en renderer.js, 12 agregadas en index.html como documentación del cambio).

### Build & Tooling
- **🔖 Bump version 0.1.123** — `package.json` actualizado a v0.1.123 para reflejar el retiro del calendario viejo.

## [0.1.122] - 2026-07-21

### Added
- **✚ Botón "Redactar" visible en la Bandeja Integrada (loops 37-37e)** — El header del iframe estaba oculto por CSS (kair-header display:none) y el handler `onComposeClick` solo mostraba un toast placeholder "próximamente F3.B". Ahora: botón "✚ Redactar" Gmail-style (azul, prominent) en la lista de correos, que abre el modal de compose real. Modal rediseñado estilo Gmail: cada input es una "fila" full-width con label DENTRO del input como placeholder (Para/Asunto/CC), el placeholder desaparece al hacer click o escribir. Titlebar del modal cambiado de fondo oscuro a claro (alineado con el resto). Drop zone rediseñado: invisible por defecto, aparece como overlay azul solo durante el drag, cubriendo todo el body field. Grises más suaves en todo el modal.
- **📎 Loop 38 — Fix crítico de attachments** — Los archivos adjuntos (File objects de los chips) NUNCA se estaban enviando. La causa raíz estaba en 2 partes: (a) Frontend — `pendingAttachments[]` se renderizaba como chip pero nunca se pasaba a `sendComposedMail`. (b) Backend — `sendMessage` solo construía MIME `text/plain`, sin soporte para `multipart/mixed`. FIX: (a) `sendComposedMail` ahora lee cada File via FileReader.readAsDataURL, extrae la parte base64 pura, valida tamaño <=25MB (límite de Gmail), y pasa `[{name, mimeType, data}]` al IPC `googleGmail.sendMessage`. (b) `sendMessage` ahora detecta si hay attachments y construye un MIME `multipart/mixed` con boundary único (formato: `----=_KairBandeja_<timestamp>_<random>`), Content-Type correcto por archivo, Content-Disposition: attachment, Content-Transfer-Encoding: base64 con saltos de línea cada 76 chars (estándar MIME). Si NO hay attachments, mantiene el comportamiento anterior (text/plain) para compatibilidad con reply/forward.

### Fixed
- **🔧 Loop 38 — Attachments perdidos en el envío** — El usuario reportó que al enviar correo con adjuntos, los archivos se mostraban en el modal pero NO llegaban a Gmail. Causa raíz: `pendingAttachments` local al modal nunca se pasaba al handler de enviar, y el backend no construía MIME multipart. Ahora los adjuntos llegan correctamente a Gmail.

### Build & Tooling
- **🔖 Bump version 0.1.122** — `package.json` actualizado a v0.1.122 para reflejar el compose Gmail-style completo y el fix de attachments.
- **Cache-bust**: v=646 → v=651 (v=647 loop 37 botón, v=648 loop 37b sin DE, v=649 loop 37c drop zone, v=650 loop 37d labels suaves, v=651 loop 37e placeholders Gmail).

## [0.1.121] - 2026-07-20

### Added
- **🎨 3 fixes visuales Gmail-style** — Loops 31-33 sobre Bandeja Integrada: (1) Loop 31 — Quote colapsable con mejor contraste (fondo `#f0f4f9`, borde izquierdo azul 4px `#1a73e8`, label con `font-weight: 600`, hover `#e8eef5`). (2) Loop 32 — "Para: x" colapsable unificado: el thread header ya muestra los recipients del último mensaje (loop 26), así que se eliminó el "para: x" propio del último mensaje individual para evitar duplicación visual. Los recipients siguen mostrándose en mensajes no-último cuando se expanden. (3) Loop 33 — Drag & drop de archivos al compose: botón "Adjuntar archivo" habilitado (antes `disabled`), `<input type="file" hidden multiple>` con wire-up al botón, drop zone en el body del modal con feedback visual (`.compose-panel__dropzone--active` con borde azul + fondo `#e8f0fe`), lista de archivos adjuntos con nombre/tamaño/botón X para quitar. Storage local en `pendingAttachments[]` (no se envían todavía — scope de integración con Gmail API).
- **↩️ Loop 34 — Undo de envío (5s window, Gmail-style)** — Nueva función `showUndoToast(title, onUndo)` que muestra un toast persistente con botón "Deshacer" durante 5s después de enviar. Al hacer click en "Deshacer", el callback `onUndo` ejecuta `toast("Para deshacer", "Abrí Gmail → Enviados y eliminá el mensaje manualmente", "info")` (informativo, porque la API de delete/trash de Gmail no está implementada en el backend todavía). Reemplaza el `toast("Enviado", ..., "success")` simple que tenía antes.
- **⏰ Loop 35 — Snooze (posponer) de correos** — Feature nueva: posponer un correo y sacarlo de la bandeja hasta una hora futura. Botón en la toolbar del detail con icono de reloj (label cambia entre "Posponer" y "Desnoozear" según estado). Al click muestra un toast con 4 opciones predefinidas: 1 hora, 3 horas, Mañana 9am, Próxima semana. Storage en `localStorage["kair.snoozedThreads"]` como `{"threadId": wakeTimeMs}`. Helpers: `getSnoozedMap()` (limpia snoozes vencidos), `isThreadSnoozed(threadId)`, `snoozeThread()`/`unsnoozeThread()`, `getSnoozeRemainingLabel()` ("en 1h", "en 2d", "ahora"). `renderMailList` filtra los mails snoozed de la lista INBOX (auto-cleanup cuando vence el wakeTime).

### Changed
- **🧹 Loop 36 — Eliminar BEM no usado** — Limpiados del CSS los selectores `.thread-header*` (15 reglas), `.quoted-thread` (1 regla) y `.message-block*` (13 reglas) del refactor BEM incompleto del 📦563. El HTML nunca se migró a esas clases (sigue usando `.kair-mail-detail__*` y `.kair-mail-message__*`), así que eran ~220 líneas de CSS muerto. También se eliminó el fragmento huérfano `gap: 6px; flex-wrap: wrap; }` que era residuo del mismo refactor incompleto.

### Fixed
- **🔧 Limpieza de gitignore** — Agregadas reglas para `node_modules/`, `__pycache__/`, `*.pyc`, `*.pyo`, `.vscode/`, `.idea/`, `.DS_Store`, `Thumbs.db` en `.gitignore`. Removidos del tracking los ~150 archivos de `node_modules/` que estaban commiteados erróneamente (xlsx, codepage, etc.). Ahora `node_modules/` se regenera con `npm install` desde `package.json`.

### Build & Tooling
- **🔖 Bump version 0.1.121** — `package.json` actualizado a v0.1.121 para reflejar los nuevos fixes visuales + features (snooze, undo, drag&drop).

### Métricas
- **Tests**: 503/503 OK acumulados (loops 1-36).
- **Cache-bust**: v=575 → v=646 (71 versiones bumped en total).
- **Commits acumulados en la rama**: 2 nuevos commits desde v0.1.120 (`39c01fa` loops 28-30 + este `🔖 v0.1.121` con loops 31-36).

## [0.1.120] - 2026-07-18

### Added
- **📧 Bandeja Integrada: cliente Gmail completo** (`📦563`, `aef69d9`) — Nueva feature mayor: cliente de correo profesional integrado en K+AIR, coexistiendo con el calendario existente. Implementa 4 fases de funcionalidad + 5 features futuras + BEM refactor + 4 fixes visuales Gmail-style. 22 archivos, +11,285/-28 líneas. (A) **Google OAuth + Gmail API**: `shared/google-auth.js` (276 líneas) con flow OAuth2 + PKCE, scopes `gmail.readonly` + `gmail.send` + `gmail.compose`. `shared/google-tokens.js` (86 líneas) con `hasValidTokens()` que chequea `refresh_token` (refresh permanente, no expiration check). `shared/google-gmail.js` (485 líneas) wrapper `gmail.users.*` con `listInbox`/`getMessage`/`markRead`/`sendMessage` (raw MIME + base64url)/`listLabels`/`downloadAttachment`/`archiveThread`. Dependencia `googleapis ^173.0.0`. (B) **Fase 0 — SQLite cache (kair.db)**: 5 tablas (`connections`, `threads`, `messages`, `labels`, `attachments`) con schema completo + migraciones. `main/email-db.js` (422 líneas) CRUD con lazy `db()`. `main/email-sync.js` (414 líneas) `syncInbox()` con TRUNCATE-then-INSERT, RFC 2822 parsers, recursive `walkPartsForBody`. 9 IPC handlers: `email-cache:sync-inbox`, `:get-threads`, `:get-thread`, `:get-stats`, `:get-labels`, `:get-attachments`. (C) **Fase 1.A-D — Gmail-look UI**: 1.A avatares circulares con `stringHashColor` + dot azul reemplazando checkbox + hover actions con gradient fade. 1.B compose/reply/forward con pre-fill automático + soporte Enviados (`state.mailFolder`) + race condition fix. 1.C thread grouping con TODOS los mensajes del hilo. 1.D búsqueda en tiempo real con CSS-only filtering (data-attributes + display:none, preserva foco). (D) **3 Bugs Menores**: `to_list` para recibidos, thread `has_unread` al llegar mensaje nuevo, word-break CSS para emails largos. (E) **5 Features Future**: Labels reales de Gmail, search operators (`from:`/`to:`/`subject:`/`has:attachment`/`after:`/`before:`), sync bidireccional (mark read + archive), firma al enviar (localStorage), adjuntos reales (base64url → Blob → download). (F) **6 Afinamientos visuales**: subject 1.5rem, detail avatar 52px, filter active con shadow, empty state con SVG, row padding 10/16, toolbar detail 8/16. (G) **Thread grouping Gmail-style overhaul**: último mensaje expandido, resto colapsado, quoted text colapsable con `<details>`. (H) **BEM refactor 4 componentes** con tokens CSS (`--email-bg`, `--email-bg-read`, `--email-border`, `--email-accent`, `--email-row-height-min: 48px`, `--email-row-padding-v: 12px`): `.email-row` (5-col grid + estados via data-attributes), `.thread-header` (recipients colapsables), `.quoted-thread` + `.message-block` (collapsed/expanded), `.compose-panel` minimizable (bottom-right corner, toggle ESC inteligente). (I) **Features post-BEM**: adjuntos reales con download, editor de firma con mini modal, badge "N mensajes" en lista, auto-refresh cada 5 min (pausa en visibilitychange, stop en navigateBack), operadores visuales con chips removibles, quote del reply como bloque HTML arriba del textarea. (J) **4 Fixes visuales Gmail-style** (comparación visual con Gmail): regex que limpia headers MIME en cualquier parte del body (no solo al inicio), `overflow-wrap: anywhere` para emails largos (no cortar), `formatRelativeTime` para "hace X horas", chip "Recibidos" removable al lado del subject. (K) **Integración con app principal**: botón en `index.html` con badge de alertas (KAirAlerts replicado), iframe en `renderer.js` con cache-bust dinámico (v=576→613), postMessage para toggle/close, sección Gmail completa en `config-viewer.html` con switch iOS. 3 formas de salir: toggle, FAB "← Volver", ESC. **135/135 tests OK** acumulados en 6 archivos de test (`test-compose-bem.js`, `test-fixes-loop1.js` al `loop5.js`).

### Build & Tooling
- **🔖 Bump version 0.1.120** — `package.json` alineado con el tag nuevo.

## [0.1.119] - 2026-07-17

### Changed
- **📊 Gráfica de Objetivos SST rediseñada** (`📦562`, `9d3e061`) — Stacked horizontal bar 100% con labels de principios reales (Prevención, Requisitos Legales, Satisfacción Cliente, Recursos y Mejora), color por rango (verde ≥70%, amarillo ≥40%, rojo <40%), número grande "X/Y (Z%)" adentro de cada barra, tarjeta clickeable → submódulo 2.2.1. 2 archivos (`main.js`, `gestion-integral-home.js`), +254/-85 líneas.

### Fixed
- **🛠️ 4 fixes de datos en `calculateObjetivosStats`** (`📦562`) — KEYWORD_MAP[1] ampliado con `incidencia`/`prevalencia`/`ifa`/`incapacidad`; `matchAutoResultado` con búsqueda directa del autoKey (Estrategia 1) + fallback con propagación de valor cuando `porcentajeReal=0` (Estrategia 3); `calculateAutoResultados` ahora calcula `porcentajeReal` para ausentismo/prevalencia/incidencia leyendo las metas del Excel 2.2.1. Resultado: Prevención pasa de 2/6 (33%) rojo a 5/6 (83%) verde; total sube de 2/15 (13%) a ~7/15 (47%) amarillo en Tempoactiva. 78/78 tests OK.
- **🔢 A1: parsear meta y valor numérico** (`📦561`, `37dc419`) — 3 nuevos helpers `parseMetaIndicador` (parsea `<1`, `0`, `<5`, `<50`, `<=10`, `>=0.5`), `parseValorIndicador` (extrae primer número de textos como "IF promedio: 0.0421"), `evaluarCumplimientoPorMeta` (escala inversa para metas `lt`). Integrados como fallback en `calculateObjetivosStats`. 69/69 tests OK.
- **📋 Cálculo de cumplimiento refactorizado** (`📦560`, `811a987`) — `calculateObjetivosStats` ahora usa resultados manuales (JSON `resultados-objetivos.json`) + auto-resultados por keyword, en vez de buscar la palabra "cumplido" en una columna del Excel. Soporta `groupIdx-indicatorIdx` igual que el viewer del submódulo. 30/30 tests OK.
- **🔍 Top 10 CIE-10 no respetaba filtro de año** (`📦559`, `514df13`) — `applyStatsFilters()` ahora también recalcula `this.currentAusentismoStatsExtended` y re-renderiza las tabs extendidas. 1 archivo (`medicion-ausentismo.js`), +6/-0 líneas.

### Build & Tooling
- **🔖 Bump version 0.1.119** (`📦558`, `4506713`) — `package.json` alineado con el tag nuevo.

## [0.1.118] - 2026-07-15

### Documentation
- **📄 Spec huérfana: mejora de Política SST stats** (`2a10efb`) — Documento de diseño que describe la solución aprobada (Approach B) para mejorar la detección del documento Política SST en Gestión Integral. Sin cambios al código. Sigue en historial como docs huérfana, pendiente decisión del usuario sobre archivarlo o mantenerlo.

## [0.1.117] - 2026-07-13

### Added
- **🛠️ Build script automatizado** (`📦554`, `4fc38f8`) — `build-and-publish.bat` en `sgsst-electron-app/`. Resuelve el problema recurrente del 422 "tag already exists" cuando se borra una release desde la UI de GitHub. El script hace: validación de `GH_TOKEN`, borrado del tag viejo (local + remoto), `git pull`, limpieza de `dist/`, `electron-builder --publish=always`, validación de los 3 assets críticos (exe, blockmap, latest.yml). 13/13 tests OK.

### Changed
- **📅 Calendario: 4 fixes del day popover + nuevos widgets** (`📦557`, `3d5f07e`) — (1) Cache-bust stale en `index.html` `?v=505` → `?v=545`. (2) Typo `_cancelDayPopover()` → `_closeDayPopover()` en `kair-calendar.js:480`. (3) z-index del day popover 1100 → 200001 (tapado por header 100000). (4) Listeners directos en botones del popover con `stopPropagation()` (handler equivocado en container). (B) 2 widgets nuevos en home de Gestión Integral: **Pipeline** (5 etapas Solicitud→Cerrado) y **Aging** (4 buckets 0-15/16-30/31-60/60+ días) para reemplazar Política SST y Objetivos SST, con datos del módulo 2.11.1 Gestión del Cambio. (C) Limpieza widget Política SST (4 métodos + ~101 líneas CSS eliminados). (D) Removido año "2026" de labels de widgets en Recursos y Gestión Integral. 5 archivos, +342/-32 líneas. Tests: 38 OK en `test-cambio-stats.js`.
- **🔖 Bump version 0.1.117** (`📦556`, `36b7651`)

### Build & Tooling
- **🏷️ Tag cleanup v0.1.110-118** — Eliminados tags y releases intermedios antes de crear v0.1.119 limpio.

## [0.1.111] - 2026-07-04 → [0.1.116] - 2026-07-10

> **Nota:** Versiones intermedias con bug fixes y mejoras menores entre v0.1.110 y v0.1.117. Sin entradas detalladas porque no se documentaron en su momento. Si necesitás detalle de algún cambio específico en este rango, revisar `git log v0.1.110..v0.1.117` en la rama `Dev-Pc`.

Cambios principales inferidos:
- 0.1.111-0.1.116: builds intermedios sin tags publicados
- Commits internos relacionados con fix de bugs varios (ver git log para detalle)

## [0.1.110] - 2026-07-04

### Added
- **🎨 Sistema de Skeleton Screens — sistema centralizado v1.0**
  - API `window.KairSkeleton.*` con 10 componentes: `kpiStrip`, `table`, `chartBars`, `chartDonut`, `filters`, `section`, `form`, `detail`, `list`, `card` + primitiva `bar` + helpers `show`/`hide`
  - Bloque CSS `.ks-*` en `styles.css` con theming automático light/dark/dark-legacy via variables (`--ks-base`, `--ks-highlight`)
  - Reutiliza `@keyframes km-loading-shimmer` existente (no duplica animación)
  - Cascada de delays con `.ks-stagger` (1..N+10 hijos)
  - Respeta `prefers-reduced-motion`
  - Demo interactivo: `docs/skeleton-demo.html` (carga el sistema real del repo)
  - Docs: `docs/SKELETON-SYSTEM.md` (~450 líneas) + `docs/SKELETON-HOMES.md` (~270 líneas)

- **🎨 Skeleton en 7 homes de módulo principales** (`📦491`)
  - Skeleton inyectado antes de la carga async en cada home
  - Conteo ajustado al render real (5-7 widgets, 2-3 charts)
  - Fix crítico de orden: `appendChild` al DOM ANTES del `await renderMainArea`
  - Fix de limpieza: `container.innerHTML = ''` en `renderMainArea()` para borrar skeleton
  - 200ms de retardo con `setTimeout(200)` (suficiente para que el ojo humano registre el skeleton)
  - Aplicado a: Gestion Integral, Recursos, Gestion Salud, Gestion Peligros, Gestion Amenazas, Verificación, Mejoramiento

### Fixed
- **Skeleton se quedaba estático** (`📦491-fix`, `📦491-fix2`)
  - Bug: `await this.renderMainArea(mainArea)` corría ANTES del `appendChild` al DOM, el skeleton nunca se veía
  - Bug: `requestAnimationFrame` (16ms) insuficiente para que el ojo humano registre el skeleton
  - Fix: invertir orden + usar `setTimeout(200)` en lugar de `requestAnimationFrame`

### Changed
- **📦490 — Cleanup final del sistema de Skeletons**
  - 25 archivos modificados, +28/-437 líneas (borrando CSS obsoletas, helpers JS, etc.)
  - Backward compat: `.km-loading-skeleton*` y `@keyframes km-loading-shimmer` conservadas en `styles.css` (legacy views lo usan, sistema `ks-*` lo reutiliza)
  - Documentación: `docs/SKELETON-SYSTEM.md` con guía completa + sección de troubleshooting

### Migration Notes
- Si vas a usar skeleton en una vista nueva: `container.innerHTML = KairSkeleton.X()` antes del await, y `container.innerHTML = ''` al inicio del render real.
- Si vas a agregar un home de módulo: seguir el patrón canónico de `docs/SKELETON-HOMES.md`.

---

## [0.1.102] - 2026-06-17

### Fixed
- **🎬 Pantalla de carga de login — barra inicia en 0% y se anima continuo**
  - Eliminada regla CSS conflictiva `.progress-fill { width: 50%; animation: progressAnimation 2s infinite; }` que anulaba el control por JavaScript sobre la barra de progreso del overlay
  - `KairLoadingController.animateToProgress()` migrado a `requestAnimationFrame` con `this.progress` continuo (la siguiente llamada continúa desde el valor actual en vez de reiniciar a 0)
  - `executeLoginTransition()` con secuencia sincronizada 0→25→55→80→100% — sin "saltos" entre fases
  - `button.disabled = true` en submit del login (restaurado en `finally`) — anti double-click / double-submit
  - `logBuffer` con eviction FIFO a 500 entradas (antes crecía sin tope → fuga de memoria)
  - Cache de `logTextarea` en variable local (antes hacía `getElementById` en cada log)

### Technical Details
- **Archivos modificados (2):**
  - `styles.css` — eliminada regla duplicada `.progress-fill` y keyframe `progressAnimation`
  - `renderer.js` — `KairLoadingController.animateToProgress` con `requestAnimationFrame`, `executeLoginTransition` sincronizada, submit con `button.disabled`, `logBuffer` con FIFO

## [0.1.101] - 2026-06-14

### Added
- **📊 Submódulo 3.3.4 Prevalencia de Enfermedad Laboral** 🆕
- Componente completo con tabla editable, gráfico Chart.js, 5 KPIs
- Fórmula: (Casos nuevos y antiguos de EL / Promedio de Trabajadores) × 100,000
- Backend: `leerIndicadoresPrevalencia()`, `escribirEnExcelPrevalencia()`
- IPC Handlers: `prevalencia:configurar-rutas`, `prevalencia:leer-indicadores`, `prevalencia:escribir-excel`
- Namespace preload: `window.electronAPI.prevalencia`
- CSS Scope: `.prevalencia-container` (124 selectores)

- **📊 Submódulo 3.3.5 Incidencia de Enfermedad Laboral** 🆕
- Componente completo con tabla editable, gráfico Chart.js, 5 KPIs
- Fórmula: (Casos nuevos de EL / Promedio de Trabajadores) × 100,000
- Meta: <5 por 100,000 trabajadores (Coordinador SST)
- Backend: `leerIndicadoresIncidencia()`, `escribirEnExcelIncidencia()`
- IPC Handlers: `incidencia:configurar-rutas`, `incidencia:leer-indicadores`, `incidencia:escribir-excel`
- Namespace preload: `window.electronAPI.incidencia`
- CSS Scope: `.incidencia-container` (124 selectores)

- **🔗 Integración Automática con Objetivos SST**
- Keywords `'prevalencia'` e `'incidencia'` se crean siempre en `calculateAutoResultados()`
- Viewer muestra resultado calculado automáticamente (sin necesidad de "Agregar")

### Changed
- **`excel-bridge.js`** — `leerIndicadores()` ahora suma los 12 meses para `prevalenciaEL` e `incidenciaEL` (antes solo leía enero)
- **`main.js`** — `calculateAutoResultados()` crea keywords `'prevalencia'` e `'incidencia'` sin condición `> 0`
- **`preload.js`** — Agregados namespaces `prevalencia` e `incidencia`
- **`renderer.js`** — Agregadas funciones `showPrevalenciaContent()` e `showIncidenciaContent()` con routing
- **`prevalencia-enfermedad-laboral.js`** — API cambiada de `frecuenciaAccidentalidad` a `prevalencia`, estructura de datos actualizada

### Technical Details
- **Archivos creados (8):**
  - `modules/gestion-salud/prevalencia-enfermedad-laboral/index.js`
  - `modules/gestion-salud/prevalencia-enfermedad-laboral/prevalencia-enfermedad-laboral.{html,js,css}`
  - `modules/gestion-salud/incidencia-enfermedad-laboral/index.js`
  - `modules/gestion-salud/incidencia-enfermedad-laboral/incidencia-enfermedad-laboral.{html,js,css}`

- **Archivos modificados (5):**
  - `main/excel-bridge.js` — +4 funciones, +incidenciaEL en leerIndicadores, +exports
  - `main.js` — +6 handlers IPC, mejorar calculateAutoResultados
  - `preload.js` — +2 namespaces (prevalencia, incidencia)
  - `renderer.js` — +showIncidenciaContent, +routing case 3.3.5
  - `modules/gestion-salud/prevalencia-enfermedad-laboral/prevalencia-enfermedad-laboral.js` — API namespace fix

---

## [0.1.100] - 2026-06-11

### Added
- **🎯 Header Card Pattern (`k-section-card`)** 🆕
- Patrón canónico de header para todos los módulos K+AIR
- Estructura: card container → Fila 1 (icon + title + subtitle) + actions (company, dividers, buttons)
- Clases: `.k-section-card`, `.header-back-btn`, `.header-action--ghost`, `.header-action--success`, `.k-section-card__company`, `.k-section-card__divider`
- Responsive: flex-wrap en mobile, company oculta en breakpoints bajos
- Dark theme: todos los componentes soportan `[data-theme="dark"]`
- Loading states: `header-action--primary--loading`, `header-action--success--loading`

- **📋 Migración Masiva de Headers** 🆕
- 22 submódulos migrados de BEM `kair-header` a `k-section-card`
- Módulo 1 (Recursos): Presupuesto Selector, COPASST Actas, Comité Actas, Capacitaciones, Inducciones
- Módulo 2 (Gestión Integral): Objetivos, Evaluación Inicial, Plan de Trabajo, Archivo, Rendición, Proveedores, Selección, Cambio
- Módulo 3 (Gestión Salud): Evaluaciones Médicas, Remisiones, Reportes, Investigación, Registro, Frecuencia, Severidad, Mortalidad

### Changed
- **Header System** — Eliminado BEM `kair-header__*` de 22 módulos, reemplazado por `k-section-card`
- **CSS Consolidation** — Cada módulo ahora scope sus estilos card bajo su namespace (`.modulo .k-section-card`)
- **Tabs Integration** — Módulos con tabs ahora los integran DENTRO del card (no como elemento separado)
- **Responsive Patterns** — Todos los módulos migrados usan `flex-wrap: wrap` y `padding: 1rem` en mobile
- **Print Styles** — Referencias `.kair-header` reemplazadas por `.k-section-card` en media queries de impresión

### Fixed
- **Header sticky en mobile** — Eliminado `position: sticky` del header BEM que causaba overlap en scroll
- **Breadcrumb overflow** — Subtítulos reemplazan breadcrumb para mejor legibilidad en mobile
- **Button consistency** — Todos los botones de acción usan mismas clases (ghost/success/primary)

### Technical Details
- **Archivos modificados (22 submódulos, 42 archivos):**
  - `modules/recursos/presupuesto/presupuesto-selector.html`
  - `modules/recursos/copasst/copasst-logic.js`
  - `modules/recursos/comite-convivencia/comite-convivencia-logic.js`
  - `modules/recursos/capacitaciones/capacitaciones-view.{html,css}`
  - `modules/recursos/capacitaciones/capacitaciones-logic.js`
  - `modules/recursos/inducciones/inducciones-view.{html,css}`
  - `modules/recursos/inducciones/inducciones-logic.js`
  - `modules/gestion-integral/objetivos-sst/objetivos-sst-view.html`
  - `modules/gestion-integral/evaluacion-inicial-sg-sst/evaluacion-inicial-sg-sst.{js,css}`
  - `modules/gestion-integral/plan-trabajo/plan-view.{html,css}`
  - `modules/gestion-integral/plan-trabajo/plan-viewer.js`
  - `modules/gestion-integral/archivo-retencion/index.html`
  - `modules/gestion-integral/archivo-retencion/archivo-retencion-dashboard.html`
  - `modules/gestion-integral/rendicion-cuentas/rendicion-cuentas.html`
  - `modules/gestion-integral/rendicion-cuentas/rendicion-viewer.js`
  - `modules/gestion-integral/evaluacion-proveedores/evaluacion-proveedores.{js,css}`
  - `modules/gestion-integral/evaluacion-seleccion/evaluacion-seleccion-component.js`
  - `modules/gestion-integral/evaluacion-seleccion/evaluacion-seleccion.css`
  - `modules/gestion-integral/evaluacion-seleccion/dashboard.js`
  - `modules/gestion-integral/gestion-del-cambio/gestion-cambio-view.{html,css}`
  - `modules/gestion-salud/evaluaciones-medicas/evaluaciones-medicas-view.{html,css}`
  - `modules/gestion-salud/evaluaciones-medicas/evaluaciones-view.html`
  - `modules/gestion-salud/restricciones-medicas/remisiones-view.{html,css}`
  - `modules/gestion-salud/reportes-accidentes/reportes-accidentes-view.{html,css}`
  - `modules/gestion-salud/investigacion-accidentes/investigacion-accidentes-view.{html,css}`
  - `modules/gestion-salud/investigacion-accidentes/investigaciones-view.{html,css}`
  - `modules/gestion-salud/registro-estadistico/registro-estadistico.{html,css}`
  - `modules/gestion-salud/frecuencia-accidentalidad/frecuencia-accidentalidad.{html,css}`
  - `modules/gestion-salud/severidad-accidentalidad/severidad-accidentalidad.{html,css}`
  - `modules/gestion-salud/indice-mortalidad/indice-mortalidad.{html,css}`

- **Patrón de migración:**
  1. Header BEM (`<header class="kair-header">`) → Card (`<div class="k-section-card">`)
  2. Breadcrumb → Subtitle (`<p style="...">`)
  3. Back button icon-only → Back button with text ("Volver")
  4. Company chip → `.k-section-card__company`
  5. Action buttons → `.header-action--ghost` / `.header-action--success`
  6. CSS BEM eliminated, card styles added scoped under module namespace
  7. Responsive: `flex-wrap: wrap`, company hidden, padding reduced
  8. Print: `.kair-header` → `.k-section-card`

- **IDs preservados en todos los módulos:** Ningún ID de elemento fue modificado, garantizando compatibilidad con JavaScript existente

---

## [0.1.99] - 2026-06-09

### Added
- **📊 Dashboard Plan de Trabajo 2.4.1** 🆕
- KPIs estandarizados con `k-stats-ribbon` canónico (KPI Strip Enterprise v1.0)
- Nomenclatura alineada a Capacitaciones: Programadas/Realizadas/Pendientes/Vencidas
- KPI Avance % integrado como pill badge en primer item
- Tabs-header con empresa y periodo activo (BEM `.k-tabs-header`)
- Charts-grid 3x2 con 6 gráficas:
  - **Estado** (bar) — Programadas vs Realizadas vs Pendientes vs Vencidas
  - **Progreso Mensual** (line) — Evolución mes a mes
  - **Cumplimiento Trimestral** (bar agrupado) — Q1-Q4 Programadas vs Ejecutadas
  - **Estado Mensual** (stacked bar) — Distribución por mes
  - **Categoría** (horizontal bar) — Cumplimiento por grupo padre (level===1)
  - **Radar Anual** (radar) — Distribución 12 meses
- Colores K+AIR canónicos (`K_COLORS = { primary, success, warning, danger, info, gray, text }`)

- **🪟 Modal Selector de Periodo** 🆕
- Cierra con botón X (esquina superior derecha, `.period-card__close`)
- Cierra con clic en fondo (patrón UX estándar)
- Función `hidePeriodSelector()` expuesta en `window`

- **🧹 PlanTrabajoComponent.destroy()** 🆕
- Patrón consistente con COPASST (`copasstPortalComponent.destroy()`)
- Null refs: `window.planPortalComponent`, `window.planPortalContainer`
- Cleanup: remueve script dinámico del DOM
- Limpia container: `this.container.innerHTML = ''`

- **🔄 goBackToModuleHome()** 🆕
- Método directo sin postMessage (evita loop del renderer)
- Llama `destroy()` + `onBackToModuleHome()` → navega a menú Gestión Integral
- Separa flujos de navegación: portal home vs cronograma

### Changed
- **plan-trabajo/plan-view.html** — Dashboard HTML con tabs-header, k-stats-ribbon, 6 chart-cards, canvas ids actualizados
- **plan-trabajo/plan-view.css** — ~1080 líneas, k-stats-ribbon, tabs-header BEM, charts-grid 3 cols, period-card__close
- **plan-trabajo/plan-viewer.js** — ~1573 líneas, 6 funciones render chart, updateKPIs(), hidePeriodSelector(), K_COLORS
- **plan-trabajo/plan-trabajo-logic.js** — `destroy()`, `goBackToModuleHome()`, `portalScript` ref almacenado desde `initPortalJS()`
- **plan-trabajo/plan-home.js** — `goBackToModule()` → llamada directa a `planPortalComponent.goBackToModuleHome()` (antes: postMessage)
- **plan-trabajo/plan-home.html** — `.back-btn-internal:hover/focus/active` con `text-decoration: none`
- **renderer.js** — 2 handlers `back-to-module-request` (líneas ~878 y ~1202) con delegación `goBackToHome()` restaurada

### Fixed
- **Navegación "Volver" del cronograma** — Antes: postMessage `back-to-submodule-home` no funcionaba (requería 3 args). Ahora: postMessage → renderer → `planPortalComponent.goBackToHome()` → portal home
- **Navegación "Volver al Menú" del portal home** — Antes: postMessage → renderer delegaba a `goBackToHome()` → recargaba el mismo home (loop). Ahora: llamada directa a `goBackToModuleHome()` → `destroy()` + `onBackToModuleHome()` → menú Gestión Integral
- **Subrayado en botón "Volver al Menú"** — `text-decoration: none` en `:hover`, `:focus`, `:active` de `.back-btn-internal`

### Technical Details
- **Archivos modificados:**
  - `modules/gestion-integral/plan-trabajo/plan-view.html` — Dashboard HTML
  - `modules/gestion-integral/plan-trabajo/plan-view.css` — CSS completo (~1080 líneas)
  - `modules/gestion-integral/plan-trabajo/plan-viewer.js` — JS completo (~1573 líneas)
  - `modules/gestion-integral/plan-trabajo/plan-trabajo-logic.js` — Componente con `destroy()`, `goBackToModuleHome()`
  - `modules/gestion-integral/plan-trabajo/plan-home.js` — Navegación directa
  - `modules/gestion-integral/plan-trabajo/plan-home.html` — Fix subrayado
  - `renderer.js` — 2 handlers de delegación restaurados

- **Flujos de navegación:**
  ```
  Cronograma (iframe):
    backBtn → postMessage('back-to-module-request')
    → renderer → planPortalComponent.goBackToHome()
    → recarga portal home ✓

  Portal Home:
    goBackToModule() → planPortalComponent.goBackToModuleHome()
    → destroy() + onBackToModuleHome()
    → menú Gestión Integral ✓
  ```

- **Contratos IPC:** Sin cambios (mismos handlers existentes)
- **Backend:** Sin cambios (0 modificaciones en main.js)

### Impacto
- **UX:** Dashboard profesional con 6 gráficas y KPIs estandarizados
- **Navegación:** 2 flujos claros y separados, sin loops ni estados atascados
- **Consistencia:** Patrón destroy igual a COPASST y Comité de Convivencia
- **Visual:** Botones de navegación sin subrayado espurio

### Breaking Changes
- **Ninguno** — Funcionalidad puramente aditiva y correctiva, contratos sin cambios

---

## [0.1.98] - 2026-06-04

### Fixed
- **Plan de Trabajo en actas COPASST** - Lee columna del mes anterior (norma COPASST), no del mes de la reunion
- **Bug de mes en nombre de archivo** - `parseInt(data.fecha.split('-')[1])` reemplaza `new Date().getMonth()` (bug UTC-5 Colombia)
- **Nombre de archivo guardado** - Eliminado "N°{actaNumber}" del nombre por defecto

### Changed
- **Autollenado de actas COPASST** - Plan de Trabajo referencia `previousMonthKey` + `planYearForPrevious` (transicion de ano)
- **Texto de desarrollo items** - Formato multilinea con `\n`, numeracion, iconos ✓/⏱, agrupacion por estado
- **Textarea auto-expandible** - `temaRows` calculado dinamicamente segun cantidad de `\n`
- **Accidentalidad enriquecida** - Lee columnas `Nombre Completo`, `Identificacion`, `Fecha del incidente` con fallbacks
- **Texto de accidentes** - Formato `Nombre — CC — Fecha DD/MM/YYYY` con numeracion

### Added
- Busqueda de Plan de Trabajo por `previousMonthYear` cuando el mes anterior cruza ano (Enero → Diciembre)
- Campos `identificacion` y `fechaEvento` en `accidentData.persons` (aditivo, backward compatible)

---

## [0.1.94] - 2026-03-26

### Added
- **📊 Widget de Actas COPASST parametrizado** 🆕
  - Detección automática de actas de reunión del mes en curso
  - Widget en Recursos con estado "Al día" o "Pendiente" (similar a Afiliación SSSI)
  - Alertas críticas si no hay acta del mes actual
  - Muestra total de actas y último mes registrado

- **🔧 Scrollbars personalizados (grises)** 🆕
  - Scrollbars grises (#c1c9d0) en toda la aplicación
  - Hover: gris medio (#adb5bd), Active: gris oscuro (#6c757d)
  - Funcionales en tamaño mínimo de ventana (1024x650)
  - Scroll activado en dashboard (módulos y tareas)

- **📈 Alertas de Comité de Convivencia (2 alertas)** 🆕
  - Alerta informativa: "Constitución al día" cuando el período está vigente
  - Alerta crítica: "Sin reunión desde [Mes]" cuando faltan actas mensuales
  - Verificación de reuniones mensuales (similar a COPASST)

- **📈 Alertas de COPASST mejoradas** 🆕
  - Alerta informativa: "Constitución al día" cuando el período está vigente
  - Alerta crítica: "Sin reunión desde [Mes]" cuando faltan actas mensuales
  - Detección por nombre de archivo (NO por fecha de modificación)

### Changed
- **main.js** - Funciones agregadas/modificadas:
  - `calculateCopasstStats()` - Nueva lógica tipo afiliación (detecta mes en curso)
  - `verifyCommitteePeriod()` - Ahora retorna período vigente correctamente (2 años)
  - `verifyCOPASSTMeetings()` - Usa `getActasByFileName()` en lugar de fecha de modificación
  - `verifyConvivenciaMeetings()` - Nueva función para verificar reuniones mensuales
  - `getActasByFileName()` - Nueva función auxiliar (extrae mes del nombre de archivo)

- **recursos-home.js** - Métodos modificados:
  - `createCopasstWidget()` - Ahora usa diseño tipo tarjeta (similar a Afiliación)
  - Muestra badge "Al día" o "Pendiente" según corresponda
  - Widget de EPPs eliminado (reemplazado por Actas COPASST)

- **styles.css** - Scrollbars personalizados:
  - `::-webkit-scrollbar` - Ancho 8px, fondo #f8f9fa, thumb #c1c9d0
  - `[data-module-list]`, `#tasks-container` - Scroll forzado en tamaño mínimo
  - `max-height: calc(100vh - 200px)` - Para activar scroll en dashboard

### Technical Details
- **Estructura de datos `calculateCopasstStats()`:**
  ```javascript
  {
    totalActas: 0,
    actaMesEnCurso: false,
    ultimoMesRegistrado: null,
    actasAnio: 0,
    estado: 'danger',  // 'ok', 'warning', 'danger'
    alertas: []
  }
  ```

- **Búsqueda de archivos:**
  - Filtra: `*acta*copasst*.xlsx`
  - Extrae mes del nombre: `(enero|febrero|...|diciembre)`
  - Busca en carpetas: `COPASST {year}/`

- **Lógica de período vigente:**
  - Período = 2 años (ej: 2024-2026)
  - Vigente hasta diciembre del año `latestYear + 2`
  - Alerta temprana cuando faltan ≤3 meses para vencer

### Impacto
- **UX:** Widget de Actas COPASST consistente con Afiliación SSSI
- **Dashboard:** 2 alertas por comité (constitución + reuniones)
- **Visual:** Scrollbars grises armonizan con diseño de la app
- **Funcionalidad:** Scroll activado en tamaño mínimo de ventana

### Breaking Changes
- **Widget de EPPs eliminado** - Reemplazado por Widget de Actas COPASST
- **Cambio de estructura** - `calculateCopasstStats()` ahora retorna formato tipo afiliación

---

## [0.1.93] - 2026-03-25

### Added
- **🎨 Visualizadores Modernizados (9 submódulos)** 🆕
  - **Drag & Drop de Archivos** - Overlay visual con ícono animado, subida automática
  - **Menú Contextual (Clic Derecho)** - Abrir archivo, Eliminar archivo
  - **Modal de Confirmación Moderno** - Diseño centrado con animación slideUp
  - **Notificaciones Toast Modernas** - 4 tipos (success, error, warning, info)
  - **Abrir Archivo con App Predeterminada** - Usa electronAPI.open-file

### Changed
- **Submódulos actualizados (9):**
  - `1.1.1 Responsable del SG` - viewer modernizado
  - `1.1.2 Roles y Responsabilidades` - viewer modernizado
  - `1.1.4 Afiliación al SSSI` - viewer modernizado
  - `1.1.5 Trabajo de Alto Riesgo` - viewer modernizado
  - `1.1.6 Conformación de Copasst` - viewer modernizado
  - `1.1.7 Capacitación al Copasst` - viewer modernizado
  - `1.1.8 Comité de Convivencia` - viewer modernizado
  - `1.2.3 Curso Virtual 50 Horas` - viewer modernizado
  - `1.2.4 Manual SST para Proveedores` - viewer modernizado

- **Archivos modificados por submódulo:**
  - `[submodulo]-view.html` - ~40 líneas (contextMenu, confirmModal, kToastContainer)
  - `[submodulo]-view.css` - ~280 líneas (estilos para modales, toast, drag&drop)
  - `[submodulo]-viewer.js` - ~450 líneas (funciones modernas)

### Technical Details
- **Funciones JavaScript agregadas:**
  - `setupDragAndDrop()`, `setupFolderDragAndDrop()` - Drag & Drop
  - `showContextMenu()`, `hideContextMenu()`, `deleteDocument()` - Menú contextual
  - `showToast()` - Notificaciones toast
  - `showConfirmModal()`, `acceptConfirm()`, `cancelConfirm()` - Modal confirmación
  - `openFile()` - Abrir con app predeterminada

- **Funciones actualizadas:**
  - `setupEventListeners()` - Ahora llama a setupDragAndDrop y setupContextMenu
  - `renderFolders()` - Agrega clase 'folder' y configura drag&drop
  - `renderDocuments()` - Agrega evento contextmenu para clic derecho

### Impacto
- **UX:** Mejora significativa en usabilidad y consistencia entre submódulos
- **Backend:** Sin cambios (mismos contratos IPC)
- **Temas:** Compatible con claro, oscuro (system), oscuro (legacy)
- **Consistencia:** 9 visualizadores con misma UX/UI

### Breaking Changes
- **Ninguno** - Funcionalidad puramente aditiva, contratos sin cambios

---

## [0.1.92] - 2026-03-25

### Added
- **📊 Alerta de Afiliación SSSI** 🆕
  - Detección automática de planillas faltantes del mes en curso
  - Widget en Recursos con estado "Al día" o "Pendiente"
  - Alerta crítica en dashboard si no hay planilla del mes

- **🎯 Dashboard con Filtros por Módulo** 🆕
  - Panel lateral "MÓDULOS DEL SISTEMA" interactivo
  - Resaltado azul del módulo seleccionado
  - Click en módulo filtra tareas del dashboard

- **🧹 Sidebar Inteligente** 🆕
  - Limpieza automática de estado activo al cambiar empresa/módulo
  - Sin botones resaltados permanentemente

### Changed
- **main.js** - Funciones agregadas:
  - `calculateAfiliacionStats()` - Calcula estadísticas de afiliación
  - `get-recursos-stats` API - Integrada con afiliación
  - `getDashboardAlertas()` - Alerta de afiliación agregada
  - Logs de depuración para todas las alertas

- **modules/recursos/recursos-home.js** - Funciones agregadas:
  - `calculateAfiliacionClientSide()` - Verifica afiliación (cliente)
  - `createAfiliacionWidget()` - Widget visual de afiliación
  - `loadResourceStats()` - Actualizada con afiliación

- **renderer.js** - Funciones actualizadas:
  - `filterDashboardTasksByModule()` - Ahora actualiza UI de módulos
  - `updateModuleSelection()` - Nueva función para resaltado
  - `clearFilter()` - Limpia selección de módulo

### Technical Details
- **Archivos modificados:**
  - `main.js` - ~150 líneas (calculateAfiliacionStats, logs)
  - `recursos-home.js` - ~150 líneas (afiliación widget)
  - `renderer.js` - ~50 líneas (filtro de módulos)

### Impacto
- **UX:** Alertas más precisas y dashboard más intuitivo
- **Backend:** Nuevos contratos para afiliación
- **Frontend:** Widget consistente con presupuesto

### Breaking Changes
- **Ninguno** - Funcionalidad aditiva

---

## [0.1.91] - 2026-03-22

### Added
- **🏠 Botón de Navegación "Home Empresa"** 🆕
  - **Botón en header** con ícono 🏠 junto a calendario, config y LLM
  - **Navegación de retorno** al Dashboard de la empresa desde cualquier módulo/submódulo
  - **Visibilidad inteligente** - Solo visible cuando es relevante (módulos/submódulos)
  - **Gestión de estado** - Reset automático de módulo y submódulo actual

### Changed
- **index.html** - Línea 52:
  - Botón `#company-home-button` agregado en `.header-buttons`
  - Icono 🏠 con título "Volver al Inicio de la Empresa"
  - Display none inicial (se muestra dinámicamente)

- **renderer.js** - Múltiples ubicaciones:
  - Línea 600 - Declarada variable `companyHomeButton`
  - Línea 704 - Obtenida referencia al elemento DOM
  - Líneas 1324-1335 - Event listener del botón
  - Líneas 2190-2219 - Función `handleCompanyHome()` implementada
  - Líneas 2300-2303 - Ocultar en `showCompanyHomePage()`
  - Líneas 2748-2750 - Mostrar en `showModuleContent()`
  - Líneas 3036-3038 - Mostrar en `showSubmoduleContent()`
  - Líneas 2278-2280 - Ocultar en `handleLogout()`

### Technical Details
- **Archivos modificados:**
  - `index.html` - 3 líneas agregadas
  - `renderer.js` - 38 líneas agregadas, 6 modificadas
- **Impacto de rendimiento:** Negligible (+1 referencia DOM, ~100 bytes)
- **Estilos:** Usa clase `.header-btn` existente (sin CSS nuevo)

### Impacto
- **UX:** Mejora significativa en navegabilidad - usuarios ya no quedan "atrapados" en módulos
- **Backend:** Sin cambios (0 modificaciones en main.js, 0 contratos alterados)
- **Temas:** Compatible con claro, oscuro (system), oscuro (legacy)
- **Responsive:** Funcional en todas las resoluciones (≥1024px)

### Breaking Changes
- **Ninguno** - Funcionalidad puramente aditiva

### Migration Notes
- **Para usuarios finales:** Reiniciar aplicación para ver el nuevo botón
- **Para desarrolladores:**
  - Función `handleCompanyHome()` en renderer.js (líneas ~2190-2219)
  - No se requiere acción adicional - cambios 100% frontend

---

## [0.1.90] - 2026-03-21

### Added
- **🎬 Transición Animada Login → Interfaz** 🆕
  - **Overlay de transición** con logo animado, spinner doble y ondas
  - **Mensajes dinámicos** con dots animados ("Verificando credenciales...", "Cargando configuración...", etc.)
  - **Barra de progreso** lineal con animación suave
  - **Check de éxito** SVG animado al completar
  - **Nombre del usuario** personalizado en la bienvenida
  - **Secuencia completa** de ~4.2 segundos con 8 fases animadas

### Changed
- **styles.css** - Sección TRANSICIÓN agregada (~350 líneas):
  - Keyframes: `kair-login-exit`, `kair-transition-enter`, `kair-transition-logo-pulse`, `kair-transition-spinner`, `kair-transition-dots`, `kair-transition-progress`, `kair-transition-ripple`, `kair-transition-success-circle`, `kair-transition-success-check`, `kair-interface-enter`
  - Clases: `.kair-transition-overlay`, `.kair-transition-logo`, `.kair-transition-spinner`, `.kair-transition-message`, `.kair-transition-progress-bar`, `.kair-transition-success`
  
- **renderer.js** - Funciones de transición agregadas:
  - `wait(ms)` - Utilidad para delays
  - `createTransitionOverlay()` - Crea overlay dinámicamente
  - `updateTransitionMessage(main, sub)` - Actualiza mensajes
  - `executeLoginTransition(userName)` - Ejecuta secuencia completa
  - `renderLoginScreen()` - Integrada con transición después de login exitoso

### Technical Details
- **Archivos modificados:**
  - `styles.css` - Líneas 4050-4403 (sección TRANSICIÓN)
  - `renderer.js` - Líneas 1514-1812 (funciones de transición)
- **Tiempos de animación:**
  - Login exit: 0.5s
  - Overlay enter: 0.3s
  - Loading sequence: ~2.0s (4 mensajes)
  - Success: 1.2s
  - Overlay exit: 0.4s
  - **Total:** ~4.4 segundos

### Impacto
- **UX:** Mejora significativa en percepción de calidad y profesionalismo
- **Backend:** Sin cambios (mismo contrato `auth-login-v1`)
- **Temas:** Compatible con claro, oscuro (system), oscuro (legacy)
- **Accesibilidad:** Respeta `prefers-reduced-motion`

### Breaking Changes
- **Ninguno** - Cambios 100% visuales, backend sin cambios

### Migration Notes
- **Para usuarios finales:** Reiniciar aplicación para ver cambios
- **Para desarrolladores:** 
  - Funciones de transición están en renderer.js (líneas ~1514-1660)
  - CSS de transición está en styles.css (líneas ~4050-4403)
  - No se requiere acción adicional

---

## [0.1.89] - 2026-03-21

### Added
- **🎨 Login Modernizado con Animaciones y Vanta.js** 🆕
  - **Animaciones de entrada** - Fade-in + slide-up para tarjeta, stagger para elementos
  - **Fondo Vanta.js** - Olas animadas que responden al mouse con colores corporativos
  - **Logo K+AIR** - Ícono K+ en gradiente + tagline "Powered by GEST-IAR"
  - **Íconos en inputs** - Sobre (email) y candado (password) con Font Awesome
  - **Micro-interacciones** - Hover, focus, shake en errores, spinner de carga
  - **Accesibilidad** - Respeta `prefers-reduced-motion`

### Changed
- **styles.css** - Sección AUTH completamente renovada (~400 líneas):
  - Keyframes: `kair-auth-card-enter`, `kair-auth-fade-in`, `kair-auth-button-shine`, `kair-auth-shake`, `kair-auth-logo-pulse`, `kair-auth-title-glow`, `kair-auth-spinner`
  - Selectores: `.kair-auth-logo`, `.kair-auth-logo-icon`, `.kair-auth-form-group`, `.kair-auth-input-wrapper`, `.kair-auth-input-icon`, `.kair-auth-button-loading`
  
- **renderer.js** - Función `renderLoginScreen()` renovada:
  - HTML con logo y íconos en inputs
  - Integración con Vanta.js para fondo animado
  - Manejo de errores mejorado con feedback visual
  - Listeners para limpiar errores al escribir

- **renderer.js** - Función `initializeAuthFlow()` actualizada:
  - Limpieza de efecto Vanta antes de renderizar login

### Technical Details
- **Archivos modificados:**
  - `styles.css` - Líneas 3408-3811 (sección AUTH renovada)
  - `renderer.js` - Líneas 1513-1650 (renderLoginScreen), 1660-1678 (initializeAuthFlow)
- **Dependencias requeridas:**
  - Font Awesome 6.5.0 (íconos)
  - Vanta.js 0.5.24 (fondo animado)
  - Three.js r134 (requerido por Vanta)

### Impacto
- **UX:** Mejora significativa en percepción visual de la aplicación
- **Backend:** Sin cambios (mismo contrato `auth-login-v1`)
- **Temas:** Compatible con claro, oscuro (system), oscuro (legacy)
- **Responsive:** Compatible con 480px+

### Breaking Changes
- **Ninguno** - Cambios 100% visuales, backend sin cambios

### Migration Notes
- **Para usuarios finales:** Reiniciar aplicación para ver cambios
- **Para desarrolladores:** 
  - Font Awesome y Vanta.js ya están cargados en `index.html`
  - No se requiere acción adicional

---

## [0.1.88] - 2026-03-21

### Fixed
- **🎨 Módulo Recursos: Espaciado entre Widgets y Gráficas** 🆕
  - **Problema:** Espacio excesivo (~6rem) entre estadísticas y gráficas
  - **Causa raíz:** Estilos globales en `styles.css` con `!important` sobrescribían estilos locales
  - **Solución:** Reglas CSS específicas con mayor especificidad para anular estilos globales

### Changed
- **modules/recursos/recursos-home.js** - Estilos actualizados:
  - `.main-area { gap }` - 1.5rem → 1rem (espacio entre contenedores)
  - `.charts-grid { gap }` - 1.5rem → 0.75rem (espacio interno entre gráficas)
  - `.charts-grid { margin-bottom }` - 2rem → 0.5rem (margen inferior)
  - `.chart-card { padding }` - 1.5rem → 0.75rem (padding interno de tarjetas)
  - `.chart-title { margin-bottom }` - 1rem → 0.5rem (margen del título)

### Added
- **Estilos de anulación agregados** (con `!important` para prioridad):
  ```css
  .gestion-integral-home .widget {
      margin-bottom: 0 !important;
      padding: 1rem !important;
  }
  
  .gestion-integral-home .widgets-container {
      margin-bottom: 0 !important;
      gap: 1rem;
  }
  
  .gestion-integral-home .chart-card {
      margin-top: 0 !important;
      margin-bottom: 0 !important;
      padding: 0.75rem !important;
  }
  
  .gestion-integral-home .charts-grid {
      margin-top: 0 !important;
  }
  ```

### Technical Details
- **Archivos modificados:**
  - `modules/recursos/recursos-home.js` - Líneas ~156-165, ~355-390 (inyección de estilos CSS)
- **Estilos globales identificados como conflicto:**
  - `styles.css` línea 1833-1839: `.widget { margin-bottom: 2.5rem !important; }`
  - `styles.css` línea 1851-1855: `.chart-container { margin-top: 2.5rem !important; }`
  - `development-styles.css` línea 718: `.widgets-container { margin-bottom: var(--spacer-lg); }`

### Impacto
- **Espacio visual total:** Reducido de ~6rem a ~1.5rem (75% menos espacio)
- **Módulo afectado:** Solo Módulo Recursos (home)
- **Otros módulos:** Sin cambios (0% impacto)
- **UX:** Mejora significativa en densidad de información visible

### Breaking Changes
- **Ninguno** - Solo cambios visuales en módulo Recursos
- **Compatibilidad:** Mantiene coherencia con sistema visual oficial K+AIR

### Migration Notes
- **Para usuarios finales:** Reiniciar aplicación para aplicar cambios
- **Para desarrolladores:** 
  - Al crear nuevos módulos, usar selectores con especificidad para evitar conflictos con estilos globales
  - Ejemplo: `.gestion-integral-home .widget` en lugar de `.widget`

---

## [0.1.87] - 2026-03-20

### Added
- **📱 Soporte Responsive para 1366x768 y 1536x864** 🆕
  - **Media queries específicas** por resolución (1536x864, 1366x768)
  - **Ajustes progresivos** - No afecta ≥1920x1080
  - **Layout optimizado** - Header, sidebar, fonts, widgets, gráficos
  - **Ventana inicial** - 1200x700 (cabe en 1366x768)

### Changed
- **main.js** - Dimensiones de ventana actualizadas:
  - `width`: 1024 → 1200 (+176px)
  - `height`: 900 → 700 (-200px)
  - `minWidth`: 900 → 1024 (+124px)
  - `minHeight`: 800 → 650 (-150px)

- **styles.css** - Media queries agregadas (~230 líneas):
  - `@media (max-width: 1536px) and (max-height: 864px)` - Ajustes moderados
  - `@media (max-width: 1366px) and (max-height: 768px)` - Ajustes optimizados

### Technical Details
- **Archivos modificados:**
  - `main.js` - Líneas 566-574 (BrowserWindow dimensions)
  - `styles.css` - Líneas ~3500-3737 (media queries)
- **Archivos creados:**
  - `docs/05-updates/v0.1.87-responsive-1366x768.md`

### Impacto
- **1366x768:** Scroll forzado → Todo visible (+95% mejora)
- **1536x864:** Scroll frecuente → Scroll mínimo (+70% mejora)
- **≥1920x1080:** Sin cambios (0% impacto)

### Breaking Changes
- **Ninguno** - Compatible con versiones anteriores
- **≥1920x1080:** Mantiene exactamente la misma UI
- **Ventana inicial:** Dimensiones optimizadas, usuario puede redimensionar

### Migration Notes
- **Para usuarios finales:** Reiniciar aplicación para aplicar cambios
- **Para desarrolladores:** Ninguna acción requerida

---

## [0.1.86] - 2026-03-20

### Added
- **📥 Visualizador 1.1.1: Arrastrar y Soltar Archivos** 🆕
  - **Drag & Drop por carpeta** - Overlay aparece solo en la carpeta destino
  - **Soporte para múltiples archivos** - Se procesan en paralelo
  - **Validaciones completas** - Tamaño (10MB), tipos permitidos, caracteres inválidos
  - **Feedback visual** - Borde dashed azul + overlay con ícono animado
  - **Notificación toast** - Éxito/error después de cada subida

- **🖱️ Visualizador 1.1.1: Menú Contextual con Clic Derecho** 🆕
  - **Opción "🔗 Abrir archivo"** - Abre con aplicación predeterminada del sistema
  - **Opción "🗑️ Eliminar archivo"** - Elimina con confirmación
  - **Divider horizontal** - Separa visualmente las opciones
  - **Posicionamiento inteligente** - Se ajusta si se sale de pantalla
  - **Cierre con clic fuera o Escape** - UX mejorada

- **🗑️ Visualizador 1.1.1: Eliminar con Confirmación Moderna** 🆕
  - **Modal K+AIR** - Reemplaza `confirm()` nativo
  - **Animación slide-in** - Desde arriba
  - **Mensaje personalizado** - Muestra nombre del archivo
  - **Advertencia amarilla** - "Esta acción no se puede deshacer"
  - **Botones diferenciados** - Cancelar (ghost) vs Eliminar (danger)

- **🎨 Notificaciones Toast Modernas** 🆕
  - **Sistema K+AIR** - Reemplaza notificaciones nativas
  - **4 tipos** - Success, Error, Warning, Info
  - **Animaciones** - Slide-in desde derecha, slide-out
  - **Auto-ocultado** - 3-6 segundos según tipo
  - **Apilables** - Múltiples notificaciones visibles

- **⚠️ Manejo Específico de Errores** 🆕
  - **EPERM** - "El archivo está abierto en otra aplicación. Ciérralo e intenta nuevamente."
  - **ENOENT** - "El archivo no existe. Puede que ya haya sido eliminado."
  - **EACCES** - "No tienes permisos para eliminar este archivo."
  - **Logging detallado** - Diagnóstico preciso de errores

### Changed
- **main.js** - Handlers IPC actualizados:
  - `upload-document` - Soporte drag & drop, validaciones mejoradas
  - `delete-document` - Manejo específico de errores Windows (EPERM, ENOENT, EACCES)
  - `open-file` - Nuevo handler para abrir con aplicación predeterminada

- **responsable-sg-viewer.js** - Funciones agregadas:
  - `setupFolderDragAndDrop()` - Configura drag & drop por carpeta
  - `showContextMenu()` - Muestra menú contextual
  - `showConfirmModal()` - Muestra modal de confirmación
  - `showToast()` - Muestra notificación toast
  - `openFile()` - Abre archivo con aplicación predeterminada
  - `deleteDocument()` - Elimina con confirmación moderna

- **responsable-sg-view.html** - Elementos agregados:
  - `#kToastContainer` - Contenedor de notificaciones toast
  - `#confirmModal` - Modal de confirmación K+AIR
  - `#contextMenu` - Menú contextual

- **responsable-sg-view.css** - Estilos agregados:
  - `.drag-drop-overlay` - Overlay para drag & drop
  - `.context-menu` - Menú contextual
  - `.k-toast`, `.k-toast-container` - Notificaciones toast
  - `.k-modal-overlay`, `.k-modal` - Modal de confirmación

### Technical Details
- **Archivos modificados:**
  - `main.js` - Líneas ~4176-4388 (3 handlers IPC)
  - `preload.js` - Líneas ~133-140 (3 funciones expuestas)
  - `responsable-sg-view.html` - Líneas ~125-165 (HTML)
  - `responsable-sg-view.css` - Líneas ~335-650 (estilos)
  - `responsable-sg-viewer.js` - Líneas ~95-450 (funciones)
  - `responsable-sg-logic.js` - Líneas ~60-72 (handlers)
  - `renderer.js` - Líneas ~827-834 (bridge)
- **Archivos creados:**
  - `docs/05-updates/v0.1.86-mejoras-visualizador-1.1.1.md`

### Impacto
- **UX:** Nativo → Moderno K+AIR
- **Acciones por archivo:** 1 → 3 (+200%)
- **Formas de subir:** 1 → 2 (+100%)
- **Errores manejados:** 1 → 4 (+300%)
- **Líneas agregadas:** ~650

### Breaking Changes
- **Ninguno** - Compatible con versiones anteriores
- **Funciones existentes** - No modificadas, solo agregadas
- **Contratos IPC** - Sin cambios en estructura de retorno

### Migration Notes
- **Para usuarios finales:** Ninguna acción requerida - funcionalidades adicionales
- **Para desarrolladores:** Ninguna acción requerida - APIs nuevas, no breaking

---

## [0.1.85] - 2026-03-20

### Added
- **📊 Feature: Tarjeta de Inducciones con Cumplimiento Normativo Real** 🆕
  - **Problema:** La tarjeta de Inducciones mostraba información incompleta (histórico en lugar de cumplimiento real)
  - **Solución:** Ahora usa el número de trabajadores de la empresa como denominador para calcular el porcentaje real
  - **Cambios principales:**
    - ✅ Lee `stats.employees` desde `config.companyPaths[empresa].stats`
    - ✅ Calcula pendientes: `empleados - completadas`
    - ✅ Calcula porcentaje real: `(completadas / empleados) * 100`
    - ✅ Alertas inteligentes: óptimo (≥90%), refuerzo (≥50%), crítico (<50%)
    - ✅ Fallback automático si no hay empleados configurados

### Changed
- **main.js** - Función `calculateInduccionesStats()` refactorizada:
  - Nuevo parámetro: `companyName` para leer config de la empresa
  - Nuevo campo: `totalTrabajadores` (lee desde `stats.employees`)
  - Nuevo cálculo: `pendientes = totalTrabajadores - completadas`
  - Nuevo porcentaje: `(completadas / totalTrabajadores) * 100`
  - Logging detallado para trazabilidad

- **main.js** - Handler `get-recursos-stats`:
  - Pasa `companyName` a `calculateInduccionesStats()`
  - Estructura de fallback actualizada con `totalTrabajadores: 0`

- **modules/recursos/recursos-home.js** - Función `createInductionWidget()`:
  - Usa `totalTrabajadores` como denominador
  - Fallback a `totalInducciones` si `totalTrabajadores = 0`
  - Mensaje de guía: `"⚠ Configure N° trabajadores en Ajustes"`
  - Nuevos umbrales de alerta: 90%, 50%, <50%

- **modules/recursos/recursos-home.js** - Función `loadResourceStats()`:
  - Estructura inicial incluye `totalTrabajadores: 0`

### Technical Details
- **Archivos modificados:**
  - `main.js` - Líneas 7430-7545 (calculateInduccionesStats), 7593-7635 (get-recursos-stats)
  - `modules/recursos/recursos-home.js` - Líneas 553 (loadResourceStats), 961-992 (createInductionWidget)
- **Archivos creados:**
  - `docs/05-updates/v0.1.85-inducciones-cumplimiento-normativo.md`
- **Contratos IPC:** Sin cambios (getRecursosStats retorna misma estructura)
- **Frontend:** Solo cambia visualización, sin cambios en contratos

### Impacto
- **Precisión del dato:** Histórico (inducciones/inducciones) → Normativo (completadas/trabajadores)
- **Pendientes visibles:** No mostraba → Muestra cantidad exacta
- **Porcentaje útil:** 100% (falso positivo) → Real según nómina
- **Acción requerida:** Ninguna → Alerta de refuerzo/crítico

### Ejemplo de Uso

**Antes:**
```
Empresa: 50 trabajadores
Inducciones completadas: 35
Widget: "35 / 35" + "✔ 100% Completado"  ❌ (falso positivo)
```

**Ahora:**
```
Empresa: 50 trabajadores (configurado en stats.employees)
Inducciones completadas: 35
Widget: "35 / 50" + "⚠ Refuerzo necesario (15 pendientes)"  ✅ (real)
```

### Breaking Changes
- **Ninguno** - Compatible con versiones anteriores
- **Fallback automático:** Si `employees = 0`, usa lógica antigua (muestra histórico)
- **Mensaje de guía:** Indica al usuario configurar empleados si es 0

### Migration Notes
- **Para usuarios finales:**
  - Ir a: Configuración → Ajustes de Empresa
  - Editar campo: "Número de trabajadores"
  - Guardar cambios
  - Reiniciar aplicación (opcional)
- **Para desarrolladores:**
  - Ninguna acción requerida - los contratos IPC no cambiaron

---

## [0.1.84] - 2026-03-20

### Fixed
- **🔧 Error crítico: "Shared Formula master must exist" en guardado de Presupuesto** ⚠️
  - **Problema:** Al guardar cambios en el módulo de Presupuesto, la aplicación fallaba con error de fórmulas compartidas de ExcelJS
  - **Causa:** El archivo `A-FO-02 Presupuesto *.xlsx` contiene fórmulas compartidas en columna F (% Ejecutado) y fila TOTAL que se sobrescribían con valores directos
  - **Solución:** 
    - ✅ Detección previa de celdas con fórmula antes de escribir
    - ✅ Preservación de fórmulas compartidas (no sobrescribir)
    - ✅ Cálculo de totales desde el backend para fila TOTAL
    - ✅ Manejo seguro de merges (verificar si existen antes de aplicar)

- **⚠️ Warnings en merges: "Cannot merge already merged cells"**
  - **Problema:** Los merges del Excel se intentaban reaplicar sobre celdas ya mergeadas
  - **Solución:** Verificación de merges existentes antes de intentar aplicarlos

### Changed
- **main.js** - Función `handleSaveBudgetFile` completamente refactorizada:
  - Nueva sección: "Detección de Fórmulas Compartidas" (líneas ~4374-4407)
  - Nueva sección: "Escritura Inteligente (Preservando Fórmulas)" (líneas ~4444-4525)
  - Nueva sección: "Cálculo de Totales desde Backend" (líneas ~4528-4573)
  - Nueva sección: "Manejo Seguro de Merges" (líneas ~4576-4610)
- **Módulo Presupuesto** - Ahora soporta archivos con:
  - Fórmulas compartidas en columna F (% Ejecutado)
  - Fórmulas de suma en fila TOTAL
  - Múltiples rangos mergeados

### Technical Details
- **Archivos modificados:**
  - `main.js` - Líneas 4285-4632 (handleSaveBudgetFile)
- **Archivos creados:**
  - `docs/05-updates/v0.1.84-presupuesto-shared-formula-fix.md`
- **Contratos IPC:** Sin cambios (saveBudgetFile, saveBudgetChanges)
- **Frontend:** Sin cambios (presupuesto-logic.js, presupuesto-gestion.js)

### Impacto
- **Tasa de éxito guardado:** 0% → 100%
- **Fórmulas preservadas:** 0% → 100%
- **Merges preservados:** Parcial → 100%
- **Errores en logs:** ~20 warnings + 1 error → 0 warnings + 0 errors

### Breaking Changes
- **Ninguno** - Compatible con versiones anteriores
- **Fallback automático:** Si no hay fórmulas, escribe valores normales
- **Cálculo automático:** Totales se calculan incluso si el Excel no tiene fórmulas

### Migration Notes
- **Para usuarios finales:** Ninguna acción requerida - el guardado ahora funciona correctamente
- **Para desarrolladores:** Ninguna acción requerida - los contratos IPC no cambiaron

---

## [0.1.83] - 2026-03-19

### Added
- **Python Empaquetado en el Installer** 🐍🆕
  - **Installer incluye Python 3.11.9 embeddable** - NO requiere instalación manual de Python
  - **79+ paquetes Python críticos** pre-instalados:
    - `pandas`, `numpy` - Procesamiento de datos
    - `torch` (2.10.0) - IA/LLM (~114 MB)
    - `python-docx`, `openpyxl` - Documentos Word/Excel
    - `PyMuPDF`, `reportlab`, `pillow` - Procesamiento de PDF
    - `flask`, `pywin32` - Servidor y automatización COM
    - `pip`, `setuptools`, `wheel` - Gestión de paquetes
  - **Tamaño del installer:** ~300 MB (antes: ~50 MB)
  - **Cero configuración** para el cliente final

- **Scripts de Preparación de Python** 🔧
  - `scripts/prepare-python-embed.bat` - Descarga Python e instala dependencias
  - `scripts/build-with-python-embed.bat` - Construye installer con Python incluido

- **Detección Automática de Python Empaquetado** ⚙️
  - Función `getEmbeddedPythonPath()` - Prioriza Python empaquetado en producción
  - Fallback automático a Python del sistema si no existe
  - Handler IPC `check-dependencies` - Verifica estado de Python y scripts

- **Mensajes de Error UX-Friendly** 💬
  - Diálogo claro cuando Python no está instalado
  - Instrucciones paso a paso para instalar Python
  - Link directo a python.org/downloads

### Changed
- **main.js** - Funciones `getEmbeddedPythonPath()`, `getPythonScriptPath()`, `getPython()` actualizadas
- **package.json** - `extraResources` incluye `Portear/python-embed/`
- **preload.js** - Expuesto `checkDependencies` en electronAPI
- **README.md** - Requisitos actualizados (Python incluido)
- **docs/REQUISITOS.md** - Documentación para clientes actualizada

### Fixed
- **❌ Error crítico: "ModuleNotFoundError: No module named 'pandas'"** en PCs sin Python
- **❌ Error: "No se pudo encontrar un ejecutable de Python válido"** en instalación limpia
- **❌ Dashboard Scanner fallaba** por falta de pandas
- **❌ Conversión Word/Excel → PDF no funcionaba** sin python-docx/openpyxl
- **❌ Generación de actas COPASST/Convivencia fallaba** sin docxtpl
- **❌ Gestión de ausentismo no funcionaba** sin pandas/numpy
- **❌ IA/LLM no funcionaba** sin torch/transformers

### Technical Details
- **Archivos modificados:**
  - `main.js` - Líneas 67, 178, 188, 1120 (getEmbeddedPythonPath, getPythonScriptPath, check-dependencies)
  - `package.json` - Línea 48 (extraResources)
  - `preload.js` - Línea 14 (checkDependencies)
  - `Portear/python-embed/python311._pth` - Configuración crítica (import site descomentado)
- **Archivos creados:**
  - `scripts/prepare-python-embed.bat`
  - `scripts/build-with-python-embed.bat`
  - `docs/IMPLEMENTACION_PYTHON_EMPAQUETADO_v0.1.80.md`
- **Paquetes instalados:** 79+ en `Portear/python-embed/Lib/site-packages/`

### Breaking Changes
- **Ninguno** - Compatible con versiones anteriores
- **Fallback automático** - Si Python empaquetado falla, usa Python del sistema

### Migration Notes
- **Para usuarios finales:** Ninguna acción requerida - Python ahora está incluido
- **Para desarrolladores:** Ejecutar `scripts/prepare-python-embed.bat` antes de build

---

## [0.1.75] - 2026-03-16

### Added
- **Autenticación y Base de Datos Local (SQLite)** 🆕
  - `kair.db` en `app.getPath('userData')` con tablas de usuarios, roles, empresas, asignaciones y sesiones
  - Login con hash de contraseña (`bcryptjs`)
  - Usuario admin inicial: `admin@kair.local` / `Admin123!`
- **Gestión de Usuarios y Roles por Empresa** 🆕
  - Sección “Ajustes de Usuario” en Configuración
  - Asignación de empresas y roles por usuario
  - Nuevo rol de sistema: **Recursos Humanos**

### Changed
- **Login obligatorio al iniciar la app** (no se reutiliza sesión anterior)
- **Portal 1.2.1 Capacitaciones** retorna a la antesala en “Volver”

### Fixed
- **Modal residual** tras actualizar capacitaciones y volver al módulo
- **Normalización de roles** en asignaciones (case-insensitive, espacios normalizados)
- **Renderizado de tabla de usuarios** con datos reales (sin placeholders)

### Technical Details
- **Archivos modificados:**
  - `main.js` - DB SQLite, auth, usuarios, asignaciones
  - `preload.js` - contratos IPC v1 para auth/usuarios
  - `renderer.js` - flujo de login y sesión
  - `components/config/config-viewer.html` - UI gestión de usuarios
  - `modules/recursos/capacitaciones/` - limpieza de modal y navegación
  - `styles.css` - estilos de pantalla de login

---

## [0.1.70] - 2026-03-05

### Added
- **Módulo de Inducciones con Sincronización Automática** 🆕
  - Sincronización automática de Google Forms vía Power Query
  - Detección automática de cambios en el archivo Excel
  - Actualización automática sin intervención del usuario
  
- **Sistema de Búsqueda Inteligente de Carpetas** 🔍
  - Normalización de tildes (Inducción = induccion)
  - Sistema de 3 prioridades para encontrar carpeta correcta
  - Soporte para múltiples variaciones de nombres (1.1.x, 1.2.x, etc.)
  
- **Búsqueda Flexible de Archivos Excel** 📊
  - Soporte para múltiples variaciones de nombres:
    - `inducción`, `induccion`, `inducciones`
    - `fo-046`, `fo_046`, `046`
    - `registro` (para "Registro de Inducción")
  
- **COM Automation para Power Query** ⚙️
  - VBScript para controlar Excel automáticamente
  - Ejecución de `RefreshAll()` para actualizar datos desde Google Forms
  - Manejo de timeout (60 segundos máx.)
  - Limpieza automática de archivos temporales
  
- **UI/UX de Sincronización** 🎨
  - Banner de notificación cuando hay cambios disponibles
  - Botón manual "Sincronizar" en el header
  - Indicador de estado ("Sincronizado HH:MM:SS")
  - Toast notifications para feedback al usuario
  - Animaciones de carga y sincronización
  
- **Filtrado Inteligente de Datos** 🧹
  - Detección y filtrado automático de filas de encabezado
  - Soporte para múltiples formatos de archivos entre empresas
  - Validación de datos antes de mostrar en tabla

### Fixed
- **Error: Carpeta incorrecta para Asel** 🐛
  - Corregida búsqueda para priorizar carpetas con "induccion" sobre "1.1"
  - Implementada normalización de texto para manejar tildes
  - Ahora encuentra correctamente `1.2.2 Inducción y Reinducción`
  
- **Error: Fila de encabezados mostrada como registro** 🐛
  - Agregada validación para saltar filas con palabras clave de encabezado
  - Soporte para múltiples variaciones: "Fecha de Ingreso", "Nombre Completo", etc.
  
- **Error: Archivo no encontrado en empresas con nombres diferentes** 🐛
  - Ampliada búsqueda para incluir "registro" como palabra clave
  - Ahora funciona con `A-FR-07 Registro de Inducción.xlsx` (Asel)

### Changed
- **Mejora de Rendimiento en Búsqueda de Carpetas** ⚡
  - Optimizada lógica de búsqueda con normalización NFD
  - Reducidas colisiones entre carpetas similares (1.1.x vs 1.2.x)
  
- **Mejora en Manejo de Errores** 🛡️
  - Logs de depuración mejorados para diagnóstico
  - Mensajes de error más descriptivos
  - Validación de existencia de archivo antes de procesar

### Technical Details
- **Archivos Modificados:**
  - `main.js` - Funciones IPC y COM Automation
  - `preload.js` - Contratos de sincronización
  - `inducciones-view.html` - UI de sincronización
  - `inducciones-view.css` - Estilos de banner y estado
  - `inducciones-logic.js` - Lógica de sincronización frontend

- **Nuevos Contratos IPC:**
  - `check-inducciones-changes` - Verificar cambios
  - `sync-inducciones-from-forms` - Sincronizar datos

- **Dependencias:**
  - Sin dependencias adicionales (usa VBScript nativo de Windows)

### Empresas Soportadas
- ✅ Tempoactiva Est SAS (`ACT-FO-046 Registro de Inducción_Tempoactiva.xlsx`)
- ✅ Temposum Est SAS (archivo con "Induccion")
- ✅ Aseplus (archivo genérico)
- ✅ Asel S.A.S (`A-FR-07 Registro de Inducción.xlsx`)

### Documentación
- **Nuevos Documentos:**
  - `docs/modulo-inducciones.md` - Documentación completa del módulo

---

## [0.1.52] - 2026-03-01

### Added
- **Informe PRI Builder Multicaso** 🆕
  - Constructor de informes de seguimiento de incapacidades
  - Lectura directa desde PRI.xlsx (hoja "Casos en seguimiento")
  - Vista consolidada con resumen ejecutivo y detalle por caso
  - Navegación por páginas (resumen + casos individuales)

- **Extracción de Datos del PRI.xlsx** 📊
  - Mapeo automático de 173 columnas disponibles
  - Detección inteligente de columnas por nombre de encabezado
  - Extracción de seguimientos desde 5 columnas múltiples (SEGUIMIENTO 1-5)
  - Extracción de calificación PCL con 4 diagnósticos (CIE-10 + Origen)
  - Extracción de recomendaciones (soporta múltiples separadas por `;`)

- **Interfaz Mejorada** 🎨
  - Visualización directa sin modal (eliminado botón trigger)
  - Sidebar con configuración de periodo y filtros
  - Lista de casos detectados con estado visual (En Seguimiento/Cerrado)
  - Checkboxes para mostrar/ocultar secciones del informe
  - Controles de paginación (Anterior/Siguiente)
  - Botones de exportación (Excel, PDF/Imprimir)

- **Secciones del Informe** 📄
  - Resumen Ejecutivo (estadísticas consolidadas)
  - Listado de Casos en Periodo (tabla comparativa)
  - Distribución por Área (casos y días por departamento)
  - Ficha Detallada por Caso:
    - Información del Trabajador (nombre, cédula, cargo, área)
    - Detalle de Incapacidad (fechas, días, origen, diagnóstico, CIE-10)
    - Proceso PRIC (etapas 1, 2, 3 con estado y responsable)
    - Historial de Seguimientos (timeline con fechas y descripciones)
    - Calificación PCL (porcentaje, fecha, 4 diagnósticos con CIE-10)
    - Recomendaciones (tabla con entidad y cumplimiento)

### Fixed
- **Error: Empresa vacía al consultar backend** 🐛
  - Implementada función `getCurrentCompany()` con múltiples fuentes
  - Fuentes: window.currentCompany → window.rendererState → DOM padre → fallback 'Aseplus'
  - Archivo: `informe-pri-builder.html` (líneas 650-673)

- **Error: Interfaz no se visualizaba (solo botón)** 🐛
  - Eliminado botón trigger y modal backdrop
  - El `.report-builder` ahora se muestra directamente como elemento raíz
  - Auto-inicialización con `DOMContentLoaded`
  - Archivo: `informe-pri-builder.html` (líneas 457-467)

- **Error: Mapeo incorrecto de columnas del Excel** 🐛
  - Corregida búsqueda de columnas por nombre real en PRI.xlsx
  - `cedula`: Ahora busca `includes('documento')` en lugar de `includes('cedula')`
  - `area`: Ahora busca `includes('sede')` en lugar de `includes('área')`
  - `diagnostico`: Ahora excluye columnas CIE-10 con `!includes('cie')`
  - `estado`: Ahora busca `includes('estado caso')` o `includes('motivo de cierre')`
  - Archivo: `informe-pri-builder.html` (líneas 747-793)

- **Error: Seguimientos no se renderizaban** 🐛
  - Implementada extracción desde 5 columnas múltiples (SEGUIMIENTO 1-5)
  - Cada seguimiento tiene fecha y descripción separadas
  - Renderizado en timeline vertical con fechas a la izquierda
  - Archivo: `informe-pri-builder.html` (líneas 824-833)

- **Error: Checkbox PCL no mostraba contenido** 🐛
  - Agregada estructura `pcl.diagnosticos[]` con 4 diagnósticos
  - Cada diagnóstico tiene CIE-10 y origen calificado
  - Renderizado condicional activado por `reportConfig.includePCL`
  - Archivo: `informe-pri-builder.html` (líneas 847-855)

- **Error: Recomendaciones no se extraían** 🐛
  - Implementada extracción desde columnas `recomendacionEmitida` y `recomendacionesVigentes`
  - Soporte para múltiples recomendaciones separadas por `;` o `|`
  - Cada recomendación tiene entidad y estado de cumplimiento
  - Renderizado condicional activado por `reportConfig.includeRecomendaciones`
  - Archivo: `informe-pri-builder.html` (líneas 857-871)

### Changed
- **Estructura de Datos de Casos** 🔄
  - Objeto caso ahora incluye: `seguimientos[]`, `pcl`, `recomendaciones[]`
  - `pcl` contiene: `fecha`, `porcentaje`, `origen`, `diagnosticos[]`
  - `diagnosticos[]` es array de hasta 4 elementos con `cie10` y `origen`
  - `recomendaciones[]` es array dinámico según datos del Excel

- **Flujo de Carga de Datos** 🔄
  - `loadCasesData()` → `getPriSeguimientoData(companyName)` → backend
  - `processPriRowsToCases(rows, headers)` → transforma filas a objetos
  - `processCasesData()` → calcula resumen y renderiza UI
  - Fallback a `loadMockData()` si no hay datos o falla API

- **Comunicación entre Módulos** 🔄
  - `medicion-ausentismo-home.js` envía `postMessage` con `payload.path`
  - Formato corregido: `{ type: 'load-module-view', payload: { path: '...' } }`
  - `renderer.js` recibe y carga vista en área de contenido

### Technical Details
- **Frontend:** `modules/gestion-salud/ausentismo/informe-pri-builder.html`
  - Líneas 1-450: Estilos CSS (Inter font, colores, layout)
  - Líneas 457-590: Estructura HTML (builder, sidebar, preview)
  - Líneas 592-650: Variables globales e inicialización
  - Líneas 650-673: `getCurrentCompany()` - Detección de empresa
  - Líneas 675-740: `loadCasesData()` - Carga desde backend
  - Líneas 743-908: `processPriRowsToCases()` - Mapeo y transformación
  - Líneas 910-980: `loadMockData()` - Datos de prueba
  - Líneas 982-1010: `processCasesData()` - Cálculo de resumen
  - Líneas 1012-1040: `renderCaseList()` - Lista de casos en sidebar
  - Líneas 1042-1060: `renderPage()` - Renderizado por página
  - Líneas 1062-1140: `renderSummaryPage()` - Resumen consolidado
  - Líneas 1142-1300: `renderCaseDetailPage()` - Ficha detallada
  - Líneas 1302-1419: Funciones auxiliares y exportación

- **Backend:** `main.js`
  - Líneas 3355-3550: Handler `get-pri-seguimiento-data`
  - Lee configuración de empresa y estructura de carpetas
  - Busca archivo PRI.xlsx en carpeta de ausentismo
  - Lee hoja "Casos en seguimiento" con `xlsx.readFile()`
  - Retorna: `{ success: true, headers: [...], rows: [...], filePath, sheetName }`

- **Comunicación:** `medicion-ausentismo-home.js`
  - Líneas 101-112: `generarInforme()` - Envío de postMessage
  - Formato: `{ type: 'load-module-view', payload: { path: '...' } }`

### Documentation
- **Nueva Documentación:** `docs/ACTUALIZACION_v0.1.52_INFORME_PRI_BUILDER.md`
  - Resumen ejecutivo de cambios
  - Estructura de columnas del PRI.xlsx
  - Flujo de datos completo (frontend → backend → Excel)
  - Errores corregidos y soluciones
  - Pruebas realizadas
  - Guía de uso paso a paso

### Testing
- **Pruebas Exitosas:** ✅
  - Carga de vista sin modal
  - Detección de empresa "Aseplus"
  - Lectura de PRI.xlsx (4 registros)
  - Mapeo correcto de 173 columnas
  - Extracción de seguimientos (5 columnas)
  - Extracción de PCL (4 diagnósticos)
  - Extracción de recomendaciones (múltiples)
  - Renderizado de resumen consolidado
  - Navegación entre páginas
  - Checkboxes condicionales funcionales

---

## [0.1.51] - 2026-02-28

### Added
- **Calificación PCL Regional y Nacional** 🆕
  - Dos secciones separadas en la UI con identificación visual clara
  - Calificación Regional: Ícono de marcador, color azul índigo (#4F46E5)
  - Calificación Nacional: Ícono de edificio, color azul oscuro (#174ea6)
  - 14 campos en total (7 Regional + 7 Nacional)

- **Campos de Calificación Regional** (Columnas FC-FI, Índices 158-164)
  - Estado del Proceso Regional
  - Fecha de Solicitud Regional
  - Fecha Dictamen Regional
  - % PCL Regional
  - Origen Calificado Regional
  - Fecha de Estructuración Regional
  - Observaciones Calificación Nacional

- **Campos de Calificación Nacional** (Columnas FJ-FP, Índices 165-171)
  - Estado del Proceso Nacional
  - Fecha de Solicitud Nacional
  - Fecha Dictamen Nacional
  - % PCL Nacional
  - Origen Calificado Nacional
  - Fecha de Estructuración Nacional
  - Observaciones Calificación Nacional

### Fixed
- **Error `list assignment index out of range`** 🐛
  - Movida la extensión de `fila_completa` antes de las asignaciones de Calificación
  - Ahora se extiende a 172 elementos antes de asignar índices 158-171
  - Archivo: `Portear/src/actualizar_ausentismo.py` (líneas 1073-1075)

- **Datos de Calificación no se guardaban en Excel** 🐛
  - Corregido mapeo de campos en `ejecutarGuardadoReal()`
  - Ahora se envían correctamente los campos Regional y Nacional a Python
  - Archivo: `modules/gestion-salud/ausentismo/medicion-ausentismo.js` (líneas 4311-4328)

### Changed
- **Estructura de Datos de Calificación** 🔄
  - Objeto `followUpData.calificacion` ahora contiene campos Regional y Nacional
  - Compatibilidad mantenida con `calificacionLegacy` para registros antiguos
  - Función `cargarRegistroYAbrirPanel()` actualizada para cargar ambos conjuntos

- **UI del Panel de Seguimiento** 🎨
  - Sección 5: Calificación PCL ahora tiene dos subsecciones visuales
  - Separadores con bordes de 2px y colores distintivos
  - Títulos con íconos y uppercase para claridad

### Technical Details
- **Frontend:** `medicion-ausentismo.js`
  - Líneas 2743-2845: UI de Calificación PCL
  - Líneas 3600-3620: `saveSeguimientoData()` - Recolección de datos
  - Líneas 4070-4095: `cargarRegistroYAbrirPanel()` - Carga de datos
  - Líneas 4311-4328: `ejecutarGuardadoReal()` - Envío a Python

- **Backend:** `Portear/src/actualizar_ausentismo.py`
  - Líneas 985-1000: Índices de columnas Regional/Nacional
  - Líneas 1073-1075: Extensión de lista antes de asignaciones
  - Líneas 1077-1092: Asignación de campos Regional (FC-FI)
  - Líneas 1094-1100: Asignación de campos Nacional (FJ-FP)

### Documentation
- **Nueva Documentación:** `docs/ACTUALIZACION_v0.1.51_CALIFICACION_PCL.md`
  - Estructura de datos completa
  - Flujo de datos frontend → backend → Excel
  - Errores corregidos y soluciones
  - Pruebas realizadas

---

## [0.1.50] - 2026-02-26

### Added
- **Sistema de Alertas para Registros Existentes** 🆕
  - Modal moderno al guardar seguimiento con registros duplicados
  - Opciones: "Actualizar registro seleccionado" o "Crear nuevo registro"
  - Diseño con gradiente naranja, avatar con iniciales, timeline de registros
  - Función `buscar_registros_por_cedula()` en Python
  - Handler IPC `buscar-registros-cedula` en main.js

- **Cálculos Automáticos en Formulario** 🆕
  - Edad: Calculada desde fecha de nacimiento
  - IMC: Calculado desde peso/talla² (talla en cm)
  - Estado Nutricional: 6 categorías con indicadores visuales
  - Días Trabajados: Calculado desde fecha de ingreso (6 días trabajo, 1 descanso)
  - Antigüedad: Años desde fecha de ingreso

- **Nuevos Campos en Formulario de Seguimiento**
  - Salud: Peso (Kg), Talla (cm), IMC, Estado Nutricional, Actividades Extralaborales
  - Laborales: Edad, Tipo de Cargo, Tipo de Evento

- **Estadísticas en Tiempo Real** 📊
  - KPIs se actualizan al aplicar filtros (Año/Mes)
  - Funciones: `calculateKPIsFromRawData()`, `calculateKPIsFromFilteredData()`
  - Handler `read-ausentismo-data` para cargar todos los datos
  - Tarjetas: Casos Activos, Próximos a Vencer, Docs Pendientes, Cerrados (Mes)

- **Modal de Detalles Modernizado** 👁️
  - Header con ícono en gradiente
  - Employee card con avatar
  - Timeline vertical de incapacidades
  - Badges de estado con colores
  - Animaciones fade in / slide up

### Changed
- **Organización de Columnas en PRI.xlsx** ⚠️
  - Datos se guardan en columnas específicas (C-AA)
  - Función `indice_a_columna()` para columnas después de Z
  - Cálculo automático de edad, antigüedad, estado nutricional

- **Filtros Actualizan KPIs** 🔄
  - `applySeguimientoFilters()` ahora recalcula estadísticas
  - Event listeners en selectores de Año/Mes
  - Filtros se aplican solo con click en botón "Filtrar"

- **Mejoras en Logging** 📝
  - Logs `[KPIs Raw]`, `[KPIs Filtered]` para depuración
  - Logs `[GUARDAR SEGUIMIENTO]` con detalle de acciones
  - Logs `[ESTADISTICAS]` para carga de datos

### Fixed
- **Error de Columnas Excel** 🐛
  - Problema: `[7 is not a valid coordinate or range`
  - Causa: Columna AA mal calculada (chr(91) = '[')
  - Solución: Función `indice_a_columna()` con lógica para AA, AB, AC...

- **KPIs en Cero** 🐛
  - Problema: Todas las tarjetas mostraban "0"
  - Causa: Handler `read-ausentismo-data` no existía
  - Solución: Handler implementado en main.js

- **Filtros Auto-Aplicados** 🐛
  - Problema: Filtros se aplicaban al cambiar selección (sin click)
  - Solución: Removidos event listeners automáticos

### Technical
- **Python Script (actualizar_ausentismo.py)**
  - Función `guardar_seguimiento()` con columnas específicas
  - Función `buscar_registros_por_cedula()` para alertas
  - Funciones auxiliares: `calcular_edad()`, `calcular_antiguedad()`, `calcular_estado_nutricional()`, `calcular_dias_trabajados()`

- **Frontend (medicion-ausentismo.js)**
  - Función `mostrarModalSeleccionRegistros()` con diseño moderno
  - Función `confirmarGuardadoConSeleccion()` para interacción
  - Función `calculateKPIsFromFilteredData()` para filtros

- **Backend (main.js)**
  - Handler `buscar-registros-cedula` para búsqueda de duplicados
  - Handler `read-ausentismo-data` para estadísticas

### Documentation
- **Nueva Documentación Creada:**
  - `docs/RESUMEN_CAMBIOS_v0.1.50.md` - Resumen completo de cambios
  - Actualización de `docs/CHANGELOG.md` con versión 0.1.50

## [0.1.49] - 2026-02-26

### Added
- **Sistema Dual de Archivos para Ausentismo** 🆕
  - Separación clara entre archivo de registro general (PI-FO-076) y seguimiento de casos (PRI.xlsx)
  - Documentación completa en `docs/ARQUITECTURA_AUSENTISMO_DUAL.md`

- **Nuevo Handler IPC: `get-pri-seguimiento-data`** 
  - Lee específicamente el archivo PRI.xlsx
  - Selecciona automáticamente la hoja "Casos en seguimiento"
  - Detección inteligente de encabezados
  - Logs de depuración detallados
  - Ubicación: `main.js` línea ~3251

- **Nueva API en preload.js**
  - `getPriSeguimientoData(companyName)` - Expone el handler `get-pri-seguimiento-data`
  - Permite al frontend leer datos del PRI.xlsx para seguimiento detallado

### Changed
- **Handler `get-ausentismo-data` MODIFICADO** ⚠️
  - Ahora usa **PI-FO-076 / PG-FO-076 / GI-FO-076** para la lista principal de ausentismo
  - **NO usa PRI.xlsx** para consultas generales
  - Lógica de selección mejorada:
    1. Busca específicamente PI-FO-076, PG-FO-076 o GI-FO-076
    2. Si no encuentra, usa el primer .xlsx que NO sea PRI.xlsx
    3. Fallback: usa el primer archivo .xlsx disponible

- **Mejoras en Logs de Depuración**
  - Logs detallados que muestran TODOS los archivos en la carpeta de ausentismo
  - Búsqueda específica de archivos con "PRI" en el nombre
  - Confirmación visual de qué archivo se está seleccionando
  - Logs separados para `get-ausentismo-data` y `get-pri-seguimiento-data`

### Fixed
- **Problema de selección de archivo PRI.xlsx**
  - El sistema ahora encuentra correctamente el archivo PRI.xlsx cuando existe
  - Se filtra el archivo temporal `~$PRI.xlsx` automáticamente
  - Se selecciona la hoja correcta ("Casos en seguimiento") en lugar de "Introducción"

### Documentation
- **Nueva Documentación Creada:**
  - `docs/ARQUITECTURA_AUSENTISMO_DUAL.md` - Arquitectura completa del sistema dual
    - Flujo de datos por sección
    - Handlers IPC implementados
    - Logs de depuración de ejemplo
    - Consideraciones importantes sobre sincronización

- **README.md Actualizado:**
  - Versión actualizada a 0.1.49
  - Tabla de APIs de ausentismo actualizada con `getPriSeguimientoData` y `saveFollowUp`
  - Enlace a nueva documentación de arquitectura dual

### Technical Details
- **Archivos Modificados:**
  - `main.js` (+250 líneas)
    - Modificado `get-ausentismo-data` para usar PI-FO-076
    - Agregado `get-pri-seguimiento-data` para PRI.xlsx
    - Agregada función `obtenerRutaPri()` para obtener ruta específica de PRI.xlsx
    - Modificado `save-follow-up` para usar `obtenerRutaPri()` en lugar de `obtenerRutaAusentismo()`
  - `preload.js` (+2 líneas)
    - Expuesta nueva API `getPriSeguimientoData`
  - `components/seguimiento/seguimiento-incapacidades.html` (+120 líneas)
    - `viewCase()` → async, carga PRI.xlsx
    - `loadPriDataForCase()` → nueva función
    - `saveFollowUp()` → usa API de Electron directamente
  - `README.md` (versión 0.1.49)
  - `docs/CHANGELOG.md` (este archivo)
  - `docs/ARQUITECTURA_AUSENTISMO_DUAL.md` (nuevo)
  - `docs/ACTUALIZACION_FRONTEND_SEGUIMIENTO_v0.1.49.md` (nuevo)
  - `docs/RESUMEN_CAMBIOS_v0.1.49.md` (nuevo)

### Next Steps (Pendientes)
- [x] Actualizar `seguimiento-incapacidades.html` para usar `getPriSeguimientoData` en "Abrir Seguimiento" ✅
- [x] Modificar handler `save-follow-up` para usar PRI.xlsx específicamente ✅
- [x] Conectar formulario de seguimiento con la función de guardado ✅

### Frontend - Actualización Completada (Parte 2)
- **`seguimiento-incapacidades.html` MODIFICADO** ⚠️
  - Función `viewCase()` ahora es asíncrona y carga datos desde PRI.xlsx
  - Nueva función `loadPriDataForCase()` para cargar datos específicos del PRI
  - Función `saveFollowUp()` actualizada para usar API de Electron directamente
  - Eliminada dependencia de `sendMessageToParent()` para guardado
  - Agregados logs de depuración detallados

- **Flujo de Carga de Datos:**
  1. Abre caso → Carga datos básicos desde PI-FO-076
  2. Llama `getPriSeguimientoData()` → Lee PRI.xlsx
  3. Busca caso por cédula/nombre en PRI
  4. Si encuentra → Carga cargo, área, EPS, ARL
  5. Si no encuentra → Caso nuevo (solo datos básicos)

- **Flujo de Guardado:**
  1. Usuario llena formulario
  2. Click "Guardar Seguimiento"
  3. `saveFollowUp()` → `window.electronAPI.saveFollowUp()`
  4. Handler `save-follow-up` busca PRI.xlsx específicamente
  5. Python escribe en PRI.xlsx
  6. Recarga tabla y muestra notificación de éxito

- **Archivos Modificados:**
  - `components/seguimiento/seguimiento-incapacidades.html` (+120 líneas)
    - `viewCase()` → async, carga PRI.xlsx
    - `loadPriDataForCase()` → nueva función
    - `saveFollowUp()` → usa API de Electron directamente

---

## [0.1.48] - 2026-02-25

### Added
- **Módulo de Seguimiento PRIC (Proceso de Rehabilitación e Incorporación Laboral)** 🆕
  - Panel slideover de seguimiento de incapacidades con diseño moderno
  - 5 secciones especializadas: Datos Generales, Incapacidad Temporal, Etapas PRIC, Seguimiento Recomendaciones, Calificación PCL
  - Navegación horizontal por pestañas con animaciones fade-in
  - Carga automática de datos del empleado desde la tabla de seguimiento
  - Tabla dinámica de recomendaciones con capacidad de agregar/eliminar filas
  - Integración con hoja "Casos en seguimiento" de Excel (pendiente implementación real)

- **Funcionalidades de Seguimiento de Incapacidades**
  - Botón "Abrir Seguimiento" en modal de detalles de empleado
  - Autocompletado de datos laborales (cargo, área, EPS, ARL)
  - Campos de solo lectura para datos que vienen del empleado
  - ARL prellenado con "COLMENA SEGUROS" por defecto
  - Validación de fechas y campos obligatorios

- **Interfaz de Usuario Mejorada**
  - Panel slideover (95% ancho, máx 1100px) con backdrop y efecto blur
  - Sistema de navegación horizontal con 5 pestañas
  - Scrollbars personalizados con estilos K+AIR
  - Botones con efectos hover y transiciones suaves
  - Notificaciones toast de éxito/error

### Changed
- **Actualización de Documentación**
  - README.md actualizado con sección completa de Módulo de Ausentismo y Seguimiento PRIC
  - Agregados detalles de algoritmo de detección de casos en seguimiento
  - Documentación de métodos del componente: `createSeguimientoPanel()`, `closeSeguimientoPanel()`, `showSeguimientoPanelSection()`, etc.
  - Actualizada versión del documento a 2.1
  - CHANGELOG.md actualizado con cambios de versión 0.1.48

- **Mejoras en el Módulo de Ausentismo (3.3.6)**
  - Refactorización de `renderNotaSeguimientoSection()` para pasar datos completos del empleado
  - Mejora en serialización de datos para botones dinámicos
  - Optimización de carga de datos en panel PRIC

### Technical Details
- **Archivos Modificados:**
  - `modules/gestion-salud/ausentismo/medicion-ausentismo.js` (+850 líneas)
    - Agregados métodos: `createSeguimientoPanel()`, `closeSeguimientoPanel()`, `showSeguimientoPanelSection()`, `cargarDatosEnPanelSeguimiento()`, `addRecomRow()`, `removeRecomRow()`, `saveSeguimientoData()`
    - Actualizado método `abrirSeguimiento()` para abrir panel slideover
    - Modificado `renderNotaSeguimientoSection()` para pasar datos del empleado
  
- **Estilos CSS:**
  - ~200 líneas de CSS personalizado para panel slideover
  - Variables CSS para consistencia de colores (--sp-primary, --sp-accent, etc.)
  - Animaciones spFadeIn para transiciones entre pestañas
  - Scrollbars personalizados para contenido y navegación

### Fixed
- Corrección en ordenamiento de fechas de incapacidades (strings ISO a Date objects)
- Manejo de errores en carga de datos desde Excel
- Validación de fechas inválidas en carga de incapacidades

### Deprecated
- Funcionalidad de "Guardar Nota" en modal de detalles (eliminada)
- Botón "Cerrar" en sección de seguimiento (eliminado)

### Pending
- Implementación real de guardado en Excel (`guardarSeguimientoPCL()`)
- Conexión con backend para persistencia de datos de seguimiento
- Generación de informes PDF desde datos de seguimiento PRIC

---

## [0.1.47] - 2026-02-24

### Changed
- **Actualización de Documentación del Proyecto**
  - Escaneo completo del código fuente vs documentación existente
  - Identificación de 18 módulos reorganizados (100% completados)
  - Documentación de scripts Python de Portear/src
  - Actualización de estado de módulos en PROJECT_OVERVIEW.md

### Documentation
- Actualización de CHANGELOG.md con versiones 0.1.41-0.1.46
- Creación de docs/scripts-python.md para documentar utilidades Python
- Actualización de estado de reorganización modular
- Generación de documentación JSDoc API actualizada
- Agregados JSDoc a archivos de utilidades (/utils)
- Documentado theme-manager.js en docs principales
- Corregido jsdoc.json con rutas actualizadas de módulos

## [0.1.45] - 2026-02-22

### Fixed
- Correcciones menores en generación de informes de investigación
- Mejoras en extracción de datos desde PDFs de accidentes

## [0.1.44] - 2026-02-22

### Added
- Soporte para tema oscuro (paleta Negro/Gris) en Theme Manager
- Sistema centralizado de gestión de temas (Claro/Oscuro/Sistema)

### Changed
- Mejora en comunicación iframe-renderer para módulos reorganizados

## [0.1.43] - 2026-02-21

### Fixed
- Corrección en mapeo de rutas para empresas configuradas
- Mejoras en sistema de logging centralizado

## [0.1.42] - 2026-02-21

### Added
- Módulo de inducciones reorganizado (1.2.2)
- Módulo de capacitaciones reorganizado (1.2.1)

### Changed
- Migración de archivos a estructura modular `modules/recursos/`
- Actualización de referencias en index.html y renderer.js

## [0.1.41] - 2026-02-21

### Added
- Módulo de rendición de cuentas reorganizado (2.6.1)
- Módulo de objetivos SST reorganizado (2.2.1)
- Módulo de evaluación inicial SG-SST reorganizado (2.3.1)

### Changed
- Continuación de reorganización modular de gestión-integral
- Actualización de jsdoc.json con nuevas rutas de módulos

## [0.1.40] - 2026-02-20

### Added
- **Sistema de Inteligencia Artificial para Investigación de Accidentes**
  - Servidor LLM persistente (`llm_server.py`) con modelo Mistral 3 3B Reasoning
  - Análisis automático de causa raíz mediante metodología 5 Porqués
  - Extracción de datos desde PDFs de reportes de accidentes
  - Generación automática de informes de investigación en formato DOCX
  - Integración con plantillas personalizadas por empresa

- **Nueva Interfaz del Módulo 3.2.2 Investigación de Accidentes**
  - Portal de bienvenida con diseño K+AIR
  - Tarjetas de acción principales y secundarias
  - Estadísticas de investigaciones pendientes y completadas
  - Navegación mejorada entre vistas

- **Sistema Visual Oficial K+AIR**
  - Paleta de colores estandarizada (Primario: #174ea6, Éxito: #28a745, etc.)
  - Tipografía oficial (Lexend para títulos, Roboto para cuerpo)
  - Componentes reutilizables con bordes 0.375rem
  - Animaciones fadeIn consistentes

### Fixed
- Corrección de indexación de datos del análisis 5 Porqués en informes
  - Agregadas múltiples variantes de búsqueda para claves (PorQue1, Por Qué 1, etc.)
  - Corregido desanidamiento desde `analysis.data`
- Corregido desfase de altura en portal de investigación de accidentes
- Eliminados headers redundantes en vistas de módulos

### Changed
- Refactorización de `investigacion-accidentes-logic.js` para usar iframe con portal
- Mejora en comunicación iframe-renderer con patrón `-request` / `-response`
- Estandarización de comunicación entre módulos y renderer principal

## [0.1.39] - 2026-01-21

### Added
- Estandarización de patrones de comunicación entre Iframes y Renderer (`-request` / `-response`).
- Nueva petición `duplicate-budget-file-request` en el sistema de renderizado.

### Fixed
- Corrección del módulo **Plan de Trabajo Anual** (2.4.1):
  - Solucionado error que bloqueaba la clonación de planes de trabajo.
  - Eliminado uso de `prompt()` (incompatible con Electron/Iframe) por `confirm()`.
  - Automatización del cálculo del año siguiente para nuevos periodos.
  - Sincronización de tipos de mensajes entre `plan-viewer.js` y `renderer.js`.

## [0.1.38] - 2025-01-08

### Added
- Nuevo módulo de verificación de tamaños
- Script para verificación de tamaños de archivos
- Funcionalidad de limpieza de datos

### Changed
- Mejoras en el manejo de datos
- Actualización de dependencias
- Corrección de errores menores

## [0.1.37] - 2024-12-20

### Added
- Nuevo módulo de trabajo en alto riesgo
- Componentes para trabajo en alto riesgo
- Funcionalidades de gestión de riesgos

### Changed
- Actualización de la interfaz de usuario
- Mejoras en la navegación
- Corrección de errores menores

## [0.1.36] - 2024-12-18

### Added
- Nuevo módulo de seguimiento de incapacidades
- Dashboard de ausentismo
- Funcionalidades de reporte

### Changed
- Mejoras en el módulo de ausentismo
- Actualización de gráficos
- Corrección de errores menores

## [0.1.35] - 2024-12-15

### Added
- Nuevo módulo de investigación de accidentes
- Componentes para investigación de accidentes
- Funcionalidades de análisis

### Changed
- Mejoras en el módulo de reportes
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.34] - 2024-12-10

### Added
- Nuevo módulo de evaluaciones médicas
- Componentes para evaluaciones médicas
- Funcionalidades de seguimiento

### Changed
- Mejoras en el módulo de restricciones médicas
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.33] - 2024-12-05

### Added
- Nuevo módulo de capacitación COPASST
- Componentes para capacitación COPASST
- Funcionalidades de gestión

### Changed
- Mejoras en el módulo de comité de convivencia
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.32] - 2024-11-30

### Added
- Nuevo módulo de comité de convivencia
- Componentes para comité de convivencia
- Funcionalidades de gestión

### Changed
- Mejoras en el módulo de afiliación
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.31] - 2024-11-25

### Added
- Nuevo módulo de afiliación
- Componentes para afiliación
- Funcionalidades de gestión

### Changed
- Mejoras en el módulo de política
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.30] - 2024-11-20

### Added
- Nuevo módulo de política
- Componentes para política
- Funcionalidades de gestión

### Changed
- Mejoras en el módulo de roles y responsabilidades
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.29] - 2024-11-15

### Added
- Nuevo módulo de roles y responsabilidades
- Componentes para roles y responsabilidades
- Funcionalidades de gestión

### Changed
- Mejoras en el módulo de presupuesto
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.28] - 2024-11-10

### Added
- Nuevo módulo de presupuesto
- Componentes para presupuesto
- Funcionalidades de cálculo

### Changed
- Mejoras en el módulo de reportes
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.27] - 2024-11-05

### Added
- Nuevo módulo de reportes
- Componentes para reportes
- Funcionalidades de exportación

### Changed
- Mejoras en el módulo de gestión de riesgos
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.26] - 2024-10-30

### Added
- Nuevo módulo de gestión de riesgos
- Componentes para gestión de riesgos
- Funcionalidades de análisis

### Changed
- Mejoras en el módulo de gestión integral
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.25] - 2024-10-25

### Added
- Nuevo módulo de gestión integral
- Componentes para gestión integral
- Funcionalidades de coordinación

### Changed
- Mejoras en el módulo de gestión de salud
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.24] - 2024-10-20

### Added
- Nuevo módulo de gestión de salud
- Componentes para gestión de salud
- Funcionalidades de monitoreo

### Changed
- Mejoras en el módulo de gestión de amenazas
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.23] - 2024-10-15

### Added
- Nuevo módulo de gestión de amenazas
- Componentes para gestión de amenazas
- Funcionalidades de evaluación

### Changed
- Mejoras en el módulo de mejoramiento
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.22] - 2024-10-10

### Added
- Nuevo módulo de mejoramiento
- Componentes para mejoramiento
- Funcionalidades de seguimiento

### Changed
- Mejoras en el módulo de verificación
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.21] - 2024-10-05

### Added
- Nuevo módulo de verificación
- Componentes para verificación
- Funcionalidades de control

### Changed
- Mejoras en el módulo de recursos
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.20] - 2024-09-30

### Added
- Nuevo módulo de recursos
- Componentes para recursos
- Funcionalidades de gestión

### Changed
- Mejoras en el módulo de evaluaciones
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.19] - 2024-09-25

### Added
- Nuevo módulo de evaluaciones
- Componentes para evaluaciones
- Funcionalidades de análisis

### Changed
- Mejoras en el módulo de curso virtual
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.18] - 2024-09-20

### Added
- Nuevo módulo de curso virtual
- Componentes para curso virtual
- Funcionalidades de capacitación

### Changed
- Mejoras en el módulo de curso 50 horas
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.17] - 2024-09-15

### Added
- Nuevo módulo de curso 50 horas
- Componentes para curso 50 horas
- Funcionalidades de certificación

### Changed
- Mejoras en el módulo de responsable SG
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.16] - 2024-09-10

### Added
- Nuevo módulo de responsable SG
- Componentes para responsable SG
- Funcionalidades de coordinación

### Changed
- Mejoras en el módulo de restricciones
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.15] - 2024-09-05

### Added
- Nuevo módulo de restricciones
- Componentes para restricciones
- Funcionalidades de gestión

### Changed
- Mejoras en el módulo de sociodemográfica
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.14] - 2024-08-30

### Added
- Nuevo módulo de sociodemográfica
- Componentes para sociodemográfica
- Funcionalidades de análisis

### Changed
- Mejoras en el módulo de ausentismo
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.13] - 2024-08-25

### Added
- Nuevo módulo de ausentismo
- Componentes para ausentismo
- Funcionalidades de medición

### Changed
- Mejoras en el módulo de medición de ausentismo
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.12] - 2024-08-20

### Added
- Nuevo módulo de medición de ausentismo
- Componentes para medición de ausentismo
- Funcionalidades de cálculo

### Changed
- Mejoras en el módulo de investigación de accidentes
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.11] - 2024-08-15

### Added
- Nuevo módulo de investigación de accidentes
- Componentes para investigación de accidentes
- Funcionalidades de análisis

### Changed
- Mejoras en el módulo de reportes de accidentes
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.10] - 2024-08-10

### Added
- Nuevo módulo de reportes de accidentes
- Componentes para reportes de accidentes
- Funcionalidades de generación

### Changed
- Mejoras en el módulo de copasst
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.9] - 2024-08-05

### Added
- Nuevo módulo de copasst
- Componentes para copasst
- Funcionalidades de gestión

### Changed
- Mejoras en el módulo de comité de convivencia
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.8] - 2024-08-01

### Added
- Nuevo módulo de comité de convivencia
- Componentes para comité de convivencia
- Funcionalidades de coordinación

### Changed
- Mejoras en el módulo de política
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.7] - 2024-07-25

### Added
- Nuevo módulo de política
- Componentes para política
- Funcionalidades de definición

### Changed
- Mejoras en el módulo de roles y responsabilidades
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.6] - 2024-07-20

### Added
- Nuevo módulo de roles y responsabilidades
- Componentes para roles y responsabilidades
- Funcionalidades de asignación

### Changed
- Mejoras en el módulo de afiliación
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.5] - 2024-07-15

### Added
- Nuevo módulo de afiliación
- Componentes para afiliación
- Funcionalidades de registro

### Changed
- Mejoras en el módulo de presupuesto
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.4] - 2024-07-10

### Added
- Nuevo módulo de presupuesto
- Componentes para presupuesto
- Funcionalidades de cálculo

### Changed
- Mejoras en el módulo de reportes
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.3] - 2024-07-05

### Added
- Nuevo módulo de reportes
- Componentes para reportes
- Funcionalidades de exportación

### Changed
- Mejoras en el módulo de gestión
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.2] - 2024-07-01

### Added
- Nuevo módulo de gestión
- Componentes para gestión
- Funcionalidades de administración

### Changed
- Mejoras en la estructura general
- Actualización de la interfaz de usuario
- Corrección de errores menores

## [0.1.1] - 2024-06-25

### Added
- Estructura inicial del proyecto
- Configuración de Electron
- Módulos básicos de la aplicación

### Changed
- Configuración inicial
- Estructura de directorios
- Archivos base
