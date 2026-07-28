# K+AIR v0.1.138 (working tree, próximo release)

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
- 8 skills de [emilkowalski/skills](https://github.com/emilkowalski/skills) instaladas para opencode/Claude Code:
  - `emil-design-eng` — skill principal de UI + animación
  - `review-animations` — review estricto de animaciones
  - `improve-animations` — audit + planes priorizados
  - `find-animation-opportunities` — búsqueda de motion
  - `animation-vocabulary` — glosario correcto
  - `apple-design` — principios Apple
  - `pick-ui-library` — picker de UI lib
  - `prototype` — múltiples versiones de UI

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
