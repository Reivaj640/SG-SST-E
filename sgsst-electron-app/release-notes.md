# K+AIR v0.1.152 (próximo release)

## 🎉 Novedades

### 🧮 Presupuesto: tabla más compacta (📦654)

Reducido el font-size de la tabla del Presupuesto de 14.4px a 12px. Las celdas de datos, headers, celdas editables, celdas calculadas e inputs heredan el nuevo tamaño. Resultado: caben más filas visibles sin scroll.

## 📦 Commits incluidos (1)

- Próximo commit con bump 0.1.151 → 0.1.152

---

# K+AIR v0.1.151

## 🎉 Novedades

### 🧮 Presupuesto: números sin ",00" + sistema moderno de notificaciones (📦653)

2 mejoras en el submódulo de Presupuesto:

- **Formato inteligente de números**: `0` se muestra como `0` (no `0,00`), `100` como `100`. Los números con decimales reales (`1.234,56`) se mantienen con sus decimales. Igual para los porcentajes: `0%` en vez de `0,00%`, `100%` en vez de `100,00%`. La columna % ya no se trunca por culpa de los `,00%` repetidos.
- **Sistema de notificación moderno**: removido el toast viejo del Presupuesto (CSS + HTML + función `showNotification` propios). Ahora usa `window.KAIRToast.show()` (mismo sistema unificado de toda la app). Mismo look, misma posición, mismos iconos que el resto de K+AIR.

## 📦 Commits incluidos (1)

- Próximo commit con bump 0.1.150 → 0.1.151

---

# K+AIR v0.1.150

## 🎉 Novedades

### ✉️ Modal Redactar: chips estilo Gmail (📦652)

Rediseño completo del campo Para/CC del modal compose:

- **Sistema de chips (pills) estilo Gmail**: cada destinatario seleccionado aparece como una pill con avatar + nombre + ×. El mismo estilo que el item de autocomplete seleccionado (fondo azul claro con borde).
- **Comportamiento intuitivo**:
  - Click en item del autocomplete → crea chip
  - Coma/Enter en el input → convierte el texto tipeado en chip
  - Backspace con input vacío → borra el último chip
  - Click en × → elimina el chip
  - Soporta formato `Nombre <email>` y `email` plano
- **Placeholder "Para" se oculta** cuando hay al menos 1 chip
- **Autocomplete con mejor visual**: borde + sombra más prominentes, items con border-radius, avatar más grande, hover azul claro.
- **Alineación perfecta** entre Para y Asunto (mismo font-size, color, padding, line-height).
- **X del chip sin look de botón**: solo cambio de color en hover (no círculo de fondo).
- **Quitada la línea azul** de focus del campo.

## 📦 Commits incluidos (1)

- Próximo commit con bump 0.1.149 → 0.1.150

---

# K+AIR v0.1.149

## 🎉 Novedades

### ✨ Polish visual (📦651) — UI más armónica y profesional

3 ajustes visuales pequeños pero que cambian la sensación de la app:

- **📦651-fix1 Iconos del home en gris** — Los iconos SVG de los módulos del panel "Módulos del Sistema" del home (Recursos, Gestión Integral, Gestión de la Salud, etc.) ahora son del mismo color gris claro (`#94a3b8`) que el subtítulo de cada módulo. Antes eran oscuros y desentonaban con la paleta clara.
- **📦651-fix2 Configuración armonizada** — En Configuración > Ajustes de Usuario, la tabla de usuarios ahora se ve más profesional:
  - Status "Activo" pasó de "● Activo" (bullet negro aislado) a una **pill verde** con dot y halo.
  - Botones "Asignar" y "Desactivar" ahora están en **horizontal** con jerarquía: Asignar = azul sólido, Desactivar = outline gris con hover rojo.
  - El tab activo ahora tiene un **tinte azul sutil** de fondo además del underline.
- **📦651-fix3 Modal de Usuario con scroll interno** — El modal "Gestión de Usuario" antes se cortaba cuando la ventana era chica. Ahora tiene 3 zonas (header fijo / body scrollable / footer fijo con botones siempre visibles). El modal nunca excede la altura de la ventana.

## 📦 Commits incluidos (1)

- Próximo commit con bump 0.1.148 → 0.1.149

---

# K+AIR v0.1.148

## 🎉 Novedades

### 📐 Polish visual del modal Redactar (📦650-ux)

Tres ajustes finos sobre lo publicado en v0.1.147, basados en feedback visual del user:

- **Grip del resize sutil** (estilo Windows) — 14×14 con 2 rayitas diagonales a opacidad 0.32, sin caja blanca, hover sube a opacidad 1. El cursor `nwse-resize` ya da la pista de que es interactivo. Antes: 18×18 amarillo/rojo debug que se veía invasivo.
- **Autocomplete compacto Gmail-style** — `width: max-content` con `min 240px` y `max 380px`, anclado al input con `left: 16px`. Antes: estirado a todo el ancho del modal (700px). Si el email es muy largo, se trunca con ellipsis.
- **Autocomplete SOLO en Para/CC, NO en Asunto** — el user prefiere escribir el asunto libremente. Removidos listeners, HTML del dropdown y la rama `type === 'subject'` de `renderAutocomplete`.

## 📦 Commits incluidos (1)

- `be0bd65e` 📦650-ux · fix(bandeja): grip del resize sutil + autocomplete compacto solo Para/CC

---

# K+AIR v0.1.147

## 🎉 Novedades

### ✉️ Modal Redactar potenciado (📦650)

3 mejoras grandes al compose modal estilo Gmail:

#### 📦650-fix1 — Resize custom del modal (drag desde esquina superior-izquierda)

- Resize custom con `mousedown`/`mousemove`/`mouseup` (reemplaza al `resize: both` nativo que ponía el handle en bottom-right).
- Calcula el espacio disponible del `#mail-detail-container` con `getBoundingClientRect()`. `maxW/maxH = rect - 24px` — el modal NUNCA supera el área del correo seleccionado.
- `min 400×360` y fallback al viewport si la Bandeja Integrada está oculta.
- Grip visual en la esquina **superior-izquierda** (per user request, no estándar OS).
- **Fix bug crítico**: `position: relative` agregado a `.compose-panel` (sin esto, el grip con `position: absolute; top: 0; left: 0` se posicionaba relativo al overlay `position: fixed; inset: 0`, apareciendo en la esquina superior-izquierda del viewport fuera del modal).

#### 📦650-fix2 — Autocomplete Gmail-style en destinatarios

- Índice de contactos y subjects construido desde `state.mails` (instantáneo, sin IPC).
- Frecuencia basada en apariciones en `sender + to_list + cc_list`.
- Dropdown con avatar (1ra letra), nombre, email, count.
- 2+ chars mínimo, click autocompleta, keyboard navigation (Tab/Enter).

#### 📦650-fix3 — Preservar espacios entre párrafos al enviar correos

- **Root cause**: `sendMessage` enviaba solo `text/plain` → Gmail colapsa espacios múltiples (RFC 5322).
- **Fix**: `multipart/alternative` con `text/plain` + `text/html` (`<div style="white-space: pre-wrap;">`).
- Soporte attachments con `multipart/mixed > multipart/alternative` anidado.
- Gmail/Outlook web ahora preservan TODO (espacios, tabs, `\n`).

## 📦 Commits incluidos (1)

- `5041e641` 📦650 · fix(bandeja): resize custom del modal compose + autocomplete + preservar espacios

---

# K+AIR v0.1.146

## 🎉 Novedades

### 🛡️ Panel "Mostrar detalles" con seguridad SPF/DKIM/DMARC/TLS (📦647)

Implementación estilo Gmail del panel expandible de detalles de correo, con análisis automático de la autenticación del mensaje:

- **Paso 1 (UI básica)**: botón "Mostrar detalles" toggle, panel gris claro con campos `de`, `para`, `cc`, `fecha`, `asunto`, `id del mensaje`. CSS grid 2 columnas + animación fade-in 180ms.
- **Paso 2 (headers + seguridad)**:
  - `parseMailSecurity()` extrae `sentBy` (Return-Path), `signedBy` (DKIM-Signature `d=`), `encryptedWith` (TLS del último Received), y `spf`/`dkim`/`dmarc`/`arc` desde `Authentication-Results`.
  - 2 columnas nuevas en `email_messages`: `raw_headers TEXT` y `mail_security TEXT`. Migraciones idempotentes.
  - Pills de seguridad estilo Gmail (🟢 pass / 🟡 fail / ⚪ unknown).
  - **Safety net on-the-fly**: al abrir el panel, si no hay headers locales, llama a `gmailApi.getMessage(id)` y re-renderiza con datos reales.

### 🐛 Fix: correos leídos vuelven a aparecer como no leídos (📦649)

Bug crítico del UPSERT en `email_threads`:
- **Causa**: `saveThread` hacía `has_unread = excluded.has_unread` siempre, sobrescribiendo cualquier cambio local cuando llegaba un sync de Gmail.
- **Síntoma**: el user abría un mail, al siguiente sync (1 min) el flag volvía a `true` porque Gmail aún tenía el label UNREAD.
- **Fix**: `CASE WHEN` en el UPSERT para proteger flags "positivos" del user. Si el local tiene `has_unread=0` y Gmail dice `1`, MANTENEMOS `0`. Aplica también a `is_starred` y `is_important`.

### 🐛 Fix: icono del escritorio + race condition electron-updater (📦648)

- **📦648-fix1 Icono del escritorio desaparecido**: NSIS oneClick NO recrea accesos directos en updates. `installer.nsh` `customInstall` macro ahora hace `Delete` + `CreateShortcut` del icono en `C:\Users\Public\Desktop` (perMachine) y `$DESKTOP` del usuario actual.
- **📦648-fix2 Race condition electron-updater**: el instalador NSIS a veces abre la nueva versión antes de que `node_modules\electron-updater` termine de copiarse. Try/catch al require + STUB fallback no-op. La app arranca sin auto-update hasta el próximo reinicio.

### 🐛 Fixes críticos de Bandeja Integrada + Google Calendar (📦646 series, 13 fixes)

Lote completo de correcciones para los problemas del calendario y la sincronización con Google Calendar:

- 📦643 Flicker calendario — `loadEventsFromGoogle` ya no filtra contra `state.events`. Deduplicación al final sobre datos recién obtenidos.
- 📦644 Día de la semana incorrecto — `WEEKDAY_LABELS` cálculo corregido.
- 📦646 Iframe adapter fallback — `getApi()` helper con fallback a `window.parent.electronAPI`.
- 📦646-fix1 a fix13 — ID mismatch, google calendar iframe fallback, fromGoogleEvent con kairId, confirmModal reusable, delete handler dual-path, dedup con 2 keys, botones confirm prominentes, schema `google_event_id`, calendario persistente, edit modal con attendees, schema `attendees`, bridge que persiste attendees, safety net en edit modal.
- 📦646-tz — Time zone `America/Bogota` en `toGoogleEvent()` y `upsertFromIcs()`.
- 📦646-get — Nuevos handlers IPC `google-calendar:get` y `google-gmail:get`.

## 📦 Commits incluidos (3)

- `aeb7a944` 📦647 · feat(bandeja): panel 'Mostrar detalles' con seguridad SPF/DKIM/DMARC/TLS
- `964ee6ce` 📦648 · fix(installer): icono del escritorio + race condition electron-updater
- `8e5384ef` 📦649 · fix(bandeja): correos leídos vuelven a aparecer como no leídos

---

# K+AIR v0.1.143 (working tree, próximo release)

## 🎉 Novedades principales

### 🐛 Fixes críticos de Bandeja Integrada + Google Calendar (📦646 series)

Lote de 12 fixes que resuelven problemas de flickering, días de la semana incorrectos, attendees no editables, y dedup con Google Calendar.

- **📦643 · Flicker calendario** — `loadEventsFromGoogle` ya no filtra contra `state.events` (causaba que los eventos aceptados alternaran visible/oculto cada polling). Deduplicación se hace al final sobre los datos recién obtenidos.
- **📦644 · Día de la semana incorrecto** — `WEEKDAY_LABELS` usaba `(getDay() + 6) % 7` (lunes=0). El bug era que el cálculo se hacía con el índice de columna (`i % 7`) en vez de con el día real del mes, generando desfase cuando el mes no empezaba en lunes.
- **📦646 · Iframe adapter fallback** — `getApi()` helper en `kair-calendar-adapter.js` con fallback a `window.parent.electronAPI`. Antes el `adapter` daba `undefined` dentro del iframe de Bandeja Integrada, rompiendo la creación de eventos.
- **📦646-fix1 · ID mismatch post-create** — `adapter.create()` asigna un ID nuevo en la DB (puede no coincidir con el `temp` del iframe). `saveEvent()` ahora sincroniza `newEvent.id = res.data.id` para que el `adapter.update()` posterior funcione.
- **📦646-fix2 · Google Calendar iframe fallback** — `saveEvent()` ahora usa `getGoogleCalendarApi()` (que ya tiene el fallback) en vez de `window.electronAPI.googleCalendar` directo.
- **📦646-fix3 · `fromGoogleEvent` usa kairId** — Antes generaba `id: 'gcal-' + g.id` (distinto del K+AIR). Ahora `id: kairId || 'gcal-' + g.id` para que el dedup los una naturalmente.
- **📦646-fix4 · `confirmModal()` reusable** — Reemplaza el `confirm()` nativo del browser. Promise-based, variantes `danger` (rojo sólido) o `primary`, atajos Enter/Esc, z-index 600000 encima del modal de detalle.
- **📦646-fix5 · Delete handler dual-path** — Detecta formato del ID (`rapido-*` vs `gcal-*`) y elige el handler correcto. `NOT_FOUND` fallback a Google si K+AIR no tiene el evento pero Google sí. Cancelación automática a attendees con `sendUpdates:'all'`.
- **📦646-fix6 · Dedup con 2 keys** — Usa `googleEventId` Y `id` (cualquiera de las dos). Antes solo `googleEventId || id`, lo que generaba duplicados cuando K+AIR no tenía el `googleEventId` persistido.
- **📦646-fix7 · Botones del confirm modal prominentes** — Nueva clase `.kair-event-modal__btn--danger-solid` (rojo sólido, no outline). Inline styles con `background: #dc2626` forzando especificidad. Sombra del modal más profunda.
- **📦646-fix8 · Schema: `google_event_id` en `eventos_rapidos`** — Nueva columna para persistir el ID del evento en Google Calendar. Migración `ALTER TABLE` con try/catch (idempotente). Update inteligente: solo pisa la columna si la key está presente en el payload.
- **📦646-fix9 · Calendario persistente post-save** — `state.calendarVisible = false` removido después de Guardar. El user puede seguir creando eventos sin reabrir el panel. Foco automático en "+ Crear" para batch event creation.
- **📦646-fix10 · Edit modal: Asistentes + Google sync** — El modal de edición ahora muestra el campo Asistentes pre-cargado y los sincroniza con Google (UPDATE si ya está, CREATE si es nuevo). Toast diferenciado según haya asistentes nuevos.
- **📦646-fix11 · Schema: `attendees` en `eventos_rapidos`** — Nueva columna JSON stringificado para persistir los asistentes locales. El bridge parsea el JSON en `_rowToEvent` (con fallback a texto plano legacy).
- **📦646-fix12 · Bug crítico: bridge no persistía attendees** — El `INSERT` y `UPDATE` del bridge NO incluían `attendees` ni `google_event_id` en el SQL. Solo los LEÍA. Resultado: cualquier evento creado con attendees quedaba con `attendees: []` en la DB aunque Google sí los tuviera. Ahora se persisten correctamente.
- **📦646-fix13 · Safety net en edit modal** — Si el evento no tiene attendees locales pero tiene `googleEventId`, consulta a Google con el nuevo método `gcalApi.get()` y los trae on-the-fly. Además los persiste en K+AIR para futuras ediciones.

### 🆕 Time Zone Google Calendar (📦646-tz)
- `toGoogleEvent()` y `upsertFromIcs()` ahora incluyen `timeZone: 'America/Bogota'` en los objetos `start` y `end`. Google Calendar API v3 es estricto con timezones desde 2024: rechaza `dateTime` naive (sin Z ni offset) con error 400 "Missing time zone definition for start time".

### 🆕 Método `gcalApi.get()` (📦646-get)
- Nuevo handler IPC `google-calendar:get` para traer UN evento específico por su ID. Útil para el safety net del edit modal y para futuros "ver detalle sincrónico".

### 🎨 Iconos SVG Lucide en sidebar y headers (📦642)
- Reemplazo completo de los iconos PNG del sidebar y los iconos FontAwesome de los headers de módulos por SVGs inline de [Lucide](https://lucide.dev/). Un solo color de iconos (currentColor heredado), más liviano y consistente.
- `renderer.js:3416` fix: el botón "Salir" usaba `iconImg.src = "assets/${salir.icon}"` (asumía PNG path, daba 404 con el nuevo formato). Ahora `iconWrap.innerHTML = SIDEBAR_ICONS[salir.icon]` (mismo patrón que el resto).

### ⬆️ Botón flotante scroll-to-top/bottom (📦640)
- Clase reusable `ScrollToTopBottomButton` en `modules/shared/scroll-fab.js`. Aparece automáticamente cuando el contenedor tiene scroll, con animación fade + slight slide. Usado en la tabla de ausentismo.

### ✏️ Editar/Eliminar filas en tabla de ausentismo (📦639)
- Botones de acción con estilo outline (consistente con el resto de la app). Edit in-place + recálculo de días + auto-completar CIE-10 desde BD local.

### 🆕 Hora visible en calendario semanal/diario (📦638)
- Los bloques de eventos ahora muestran la hora de inicio junto al título. Antes solo mostraban el título (se perdía la hora al ver el día completo).

---

# K+AIR v0.1.142 (publicado)

## 🎉 Novedades principales

### 🎨 Iconos SVG Lucide en sidebar y headers (📦642)
Reemplazo completo de los iconos PNG del sidebar y los iconos FontAwesome de los headers de módulos por SVGs inline de Lucide.

- **Un solo color de iconos**: `currentColor` heredado del CSS, se adapta al theme (light/dark).
- **Más liviano**: 8 SVGs inline ≈ 4 KB vs 8 PNGs ≈ 30 KB.
- **Consistencia visual**: el sidebar y los headers de módulos usan los mismos iconos (calendar, mail, file-text, etc).

**Componentes nuevos**:
- `shared/sidebar-icons.js` — constante `SIDEBAR_ICONS` con 8 SVGs Lucide.
- `renderer.js` actualizado para renderizar SVG inline en sidebar + dashboard.
- 7 home modules actualizados: recursos, gestion-integral, gestion-salud, gestion-peligros, gestion-amenazas, verificacion, mejoramiento.

---

# K+AIR v0.1.141 (publicado)

### ⬆️ Botón flotante scroll-to-top/bottom (📦640)
- Clase reusable `ScrollToTopBottomButton` (`modules/shared/scroll-fab.js`).
- Aparece con animación fade + slight slide cuando hay scroll.
- Usado en la tabla de ausentismo.

### ✏️ Editar/Eliminar filas en tabla de ausentismo (📦639)
- Botones con estilo outline.
- Edit in-place + recálculo de días.
- Auto-completar CIE-10 desde BD local.

### 🆕 Hora visible en calendario semanal/diario (📦638)
- Los bloques de eventos muestran la hora de inicio.

---

# K+AIR v0.1.140 (publicado)

### ⬆️ Auto-actualización UX (re-iteración)
- Mejoras en el flujo de auto-update ya publicado en v0.1.131.

---

# K+AIR v0.1.138 (publicado)

## 🎉 Novedades principales

### @file-viewer — preview nativo de Office / PDF / imágenes (📦608)
Reemplaza los previews de PDF/Word/Excel que dependían de Python + LibreOffice por un viewer nativo en el browser, sin conversión, instantáneo y con búsqueda + zoom + selección de texto.

- **PPTX / PPT / PPTM / POTX / PPSX / ODP** → renderiza slides nativas con scroll y zoom (antes: sin preview, "abrir con app externa")
- **XLSX / XLS / XLSM / XLSB / CSV / ODS** → tabla virtual real con scroll fluido y headers fijos (antes: PDF paginado horrible para hojas grandes)
- **DOCX / DOC / DOCM / DOTX / RTF / ODT** → render nativo con búsqueda, copy/paste, zoom (antes: PDF convertido por LibreOffice, layouts rotos, 3-5s de espera)
- **PDF** → sigue con el flujo viejo (decisión de migración pendiente)
- **Imágenes, Markdown, JSON, código fuente, ZIP, EML, Mermaid, draw.io, XMind, EPUB, fonts** → preview instantáneo
- Total: **208 formatos** soportados (cubrimos los 4 que el user usa en el día a día con `preset-office`)

**Arquitectura de migración gradual (Opción B)**: los 3 IPCs viejos (`get-pdf-preview`, `get-word-preview`, `get-excel-preview`) siguen vivos — no se rompe nada. El nuevo IPC `read-file-bytes` agrega el camino para Office.

**Componentes nuevos**:
- IPC `read-file-bytes` con whitelist de extensiones + validación 100 MB
- Helper compartido `shared/file-viewer.js` (`window.kairFV.openWithFileViewerFromPath`)
- Bundle IIFE + assets en `renderer/file-viewer-assets/` (29 MB después de limpieza)
- Botón "Probar FV" en Bandeja Integrada (input file con 200+ formatos)
- Switch en `renderer.js` que detecta extensión y enruta a file-viewer para Office
- CSP del `index.html` raíz ajustada para `blob:` en `frame-src`/`child-src`

**Scripts nuevos** (reproducibles):
- `scripts/setup-file-viewer.js` — reinstala assets y borra los 110 MB no usados
- `scripts/generate-sample-pptx.js` — genera un sample SG-SST de 8 slides
- `scripts/test-read-file-bytes.js` — test del IPC (5/5 OK)
- `scripts/test-orchestrator-switch.js` — test del switch (22/22 OK)

**Pendiente para iteración futura** (no bloqueante):
- Integración limpia en los 46 submódulos (que detecten `handled: 'file-viewer'` y no muestren el PDF dummy en su iframe)
- Decisión sobre migración de PDF a file-viewer

---

# K+AIR v0.1.137 (publicado)

## 🎉 Novedades principales

### Bandeja Integrada — Layout sin scroll vertical (📦605)
- **Sidebar con scroll interno**: mini-cal, leyenda y "Integración correo" caben en el viewport sin perder ninguno de vista
- **Lista de correos con scroll interno**: header, buscador y filtros se mantienen fijos arriba; la lista scrollea internamente
- Resuelve el problema de tener que scrollear la página completa para ver los correos

### Skills de diseño y animación (📦604)
- 8 skills de [emilkowalski/skills](https://github.com/emilkowalski/skills) instaladas para opencode/Claude Code.

### Bug crítico del sync corregido (📦603 + 📦603-fix)
- **Causa 1 (backend)**: `deleteThreadsByFolder` borraba todos los threads antes del re-insert. Ahora solo se eliminan los huérfanos.
- **Causa 2 (frontend)**: `syncInboxInBackground` reemplazaba `state.mails` con objetos nuevos sin `messages`/`body`. Ahora se preservan los campos lazy-loaded al refrescar.
- Resultado: el correo seleccionado ya no pierde su contenido cada 1 minuto

### Email viewer estilo Gmail (📦602 + 📦602-fix)
- Banner de invitación ICS entre header y cuerpo del correo
- Icono Calendar 4-colores en la esquina superior derecha del banner
- Botones Sí / No / Tal vez / Proponer otro horario / ⋮
- Divider "Según este correo electrónico" con feedback 👍/👎
- Banner de traducción (detección simple EN/ES)
- Header de adjuntos "X archivo adjunto · Analizado por Gmail"
- Footer Responder / Reenviar con iconos SVG
- Padding 20px en divider/footer/botones para alinear con el cuerpo

### F3.C Google Calendar sync bidireccional (📦601)
- 7 funciones nuevas en `shared/google-calendar.js`
- 6 IPCs nuevos en main.js
- `sendUpdates: 'all'` — envía invitación a todos los attendees
- RSVP buttons (Asistiré / Tal vez / No) en modal de evento
- Parser RFC 5545 mínimo (parseIcs) en renderer
- Banner de invitación Calendar en emails
- Auto-refresh cada 1 minuto

## 📦 Commits incluidos (12 desde v0.1.136)

- `f0b0bbb6` 🔧 Excluir skills de opencode del paquete (fix junctions Windows)
- `a87e001d` 🔖 Bump version 0.1.136 → 0.1.137
- `9643ea93` 📦605 Scroll interno sidebar + lista correos
- `a578c09b` 📦604 Instalar emilkowalski/skills + snapshot 2026-07-24
- `7eb39dc7` 📦603-fix Preservar messages al refrescar state.mails
- `56219896` 📦603 Fix email-sync + alinear divider/footer/botones
- `b332f34d` 📦602-fix Alinear banner ICS con header
- `a2a71e1` 📦602 Email viewer estilo Gmail
- `a687a04` 📦601 RSVP modal + banner ICS en emails + auto-refresh 1 min
- `ee3a256` 📦595 Persistir eventos en DB + notificación in-app
- `7a08bcf` 📦594 Grilla horaria día/semana + sync de fechas
- `7f8a933` 📦593 Fix typo K+AIR-Setup- → K-AIR-Setup-

## 🐛 Fixes

- El correo seleccionado ya no se queda sin contenido al refrescar (sync de 1 min)
- Banner ICS alineado con el header (padding 0 20px)
- No se eliminan threads activos en el sync (solo huérfanos)
- Divider y footer alineados con el cuerpo del correo
- Botón Responder ya no es azul sólido (igual a Reenviar)

## 📊 Estadísticas

- **Archivos modificados**: ~25
- **Líneas agregadas**: ~10,000 (incluye las 8 skills)
- **Líneas removidas**: ~15
- **Tests**: 189/189 OK acumulado

## 🔗 Links

- 📥 Descargar: [K-AIR-Setup-0.1.137.exe](https://github.com/Reivaj640/SG-SST-E/releases/download/v0.1.137/K-AIR-Setup-0.1.137.exe) (243 MB)
- 🐛 Reportar bug: https://github.com/Reivaj640/SG-SST-E/issues
- 📖 Documentación: ver `AGENTS.md` y `changelogs/` en el repo

## ⚠️ Notas importantes

- **GitHub Token**: el token usado para este release se rotará (estuvo expuesto en logs). Si la app falla en auto-update, descargar manualmente desde el link de arriba.
- El .exe no incluye las skills de opencode (son dev tools, ~10 MB más liviano).
