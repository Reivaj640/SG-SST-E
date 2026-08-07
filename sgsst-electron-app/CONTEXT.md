# K+AIR — Contexto del Proyecto

**Última actualización:** 6 de agosto de 2026
**Versión actual:** 0.1.158 (próximo release) — publicado v0.1.146
**Tipo:** Aplicación empresarial Electron para SG-SST (Colombia)
**Stack:** Electron 37 + vanilla JS + Python 3.11.9 (empaquetado) + SQLite (kair.db)

> **🆕 v0.1.159 (📦694 — Bandeja Integrada: fix marcar cumplido + visual + toggle):** 4 bugfixes críticos + 1 mejora visual en el calendario de la Bandeja Integrada. **Bug 1**: el botón "Marcar cumplido" no funcionaba — el renderer enviaba `evento_id` (snake_case, como columnas SQLite) pero el bridge esperaba `eventoId` (camelCase, como las funciones del bridge). El backend rechazaba con `VALIDATION: empresaId y eventoId son requeridos` y el user solo veía un toast genérico que desaparecía a 3s. Bug en 2 de 3 call sites (`app.js` de la Bandeja y `renderer.js` del header) — `calendar-detail-panel.js` ya usaba camelCase correctamente. Fix: cambio a camelCase en ambos + helper `_normalizeCumplidoPayload()` que acepta ambos formatos (defensa en profundidad). **Bug 2**: `empresaId` rechazado cuando el toggle está en "Todas las empresas" (porque `getActiveCompanyName()` retorna null en ese modo). Fix: `empresa_id` ahora nullable con migración defensiva. **Bug 3**: sync multipc fallaba con "no such column: updated_at" y "empresa_id" — sync-serializer asumía schema incorrecto. Fix: schema real usado en queries. **Bug 4**: el cumplimiento NO se reflejaba visualmente — la Bandeja Integrada tiene su PROPIO render (`renderBigCalendar` con clases custom `kair-month-event`, `kair-allday-chip`, `kair-week-allday-chip`) y el CSS `--cumplido` solo aplicaba a `kair-cal-event-chip` del componente KairCalendar que no se usa aquí. Fix: actualiza `state.events` del Bandeja Integrada directamente + clases CSS custom con `opacity: 0.55` + `line-through`. **Mejora**: toggle dinámico — el botón del modal cambia entre "Marcar cumplido" (neutral) y "Desmarcar cumplido" (borde verde) según el estado, con toast diferenciado (success vs info). El chip del calendario se actualiza instantáneamente al toggle.

> **🆕 v0.1.158 (📦692-693 — FURAT: navegación recursiva + crear/eliminar + metadata legacy):** 2 features grandes del submódulo FURAT 3.2.1. 📦692: navegación recursiva tipo explorador (click en 2019 → muestra Enero/Febrero/...; click en Enero → muestra los PDFs). `getLibraryData` ahora itera recursivamente con `scanFolderRecursive(MAX_DEPTH=5)`. Breadcrumb jerárquico con cada nivel clickeable ("Todos los Reportes > 2019 > Enero"). Crear subcarpeta dentro de carpeta actual (botón "Crear subcarpeta acá" en context menu). Eliminar carpeta con context menu (patrón de 1.1.1 responsable): recursive `fs.rm` + cleanup de metadata en DB. 📦693: editar metadata de PDFs legacy con click derecho sobre fila de tabla → modal pre-llenado → upsert con `INSERT OR REPLACE ON CONFLICT(file_path)`. Después de guardar, se refresca tabla y dashboard para que el PDF entre en los análisis (charts de tendencia, gravedad, top áreas). Ahora los PDFs viejos pueden categorizarse manualmente.

> **🆕 v0.1.157 (📦690-691 — Bandeja Integrada: scroll + warnings):** 2 bugfixes en Bandeja Integrada. 📦691: preservar scroll de la lista al seleccionar un mail (3 fixes encadenados — el container `#mail-list-container` tiene overflow:hidden, el scroll real está en sub-elemento `.kair-scroll`; `loadMailBodyFromCache` se llamaba en paralelo desde `selectMail`+`renderMailDetail` causando 2-3 renders en cadena que se "pisaban" entre sí; ahora solo se actualiza el detail, no la lista, y se bloquea con flag `_loadingBody`). 📦690: silenciar warnings de `cid:` URIs en imágenes embebidas de emails HTML (reemplazados por GIF transparente 1x1 data URI de 43 bytes — el layout se preserva, no se hace request al browser).

> **🆕 v0.1.156 (📦658-687 — Rediseño completo FURAT 3.2.1):** Header System v2.0 (patrón 3.1.4) + KPI Strip oficial + 40+ inline styles eliminados. Drag-and-drop estilo macOS Finder (drop zone sobre card destino). Upload con metadata + tabla SQL `furat_metadata` (índices por company/date/type/severity/area). Dashboard analítico con 4 charts: Tendencia 12 meses (LÍNEA con PUNTOS, no barras), Por tipo, Por gravedad (colores semánticos), Top áreas. Biblioteca V2: 8+ iteraciones (cards amarillas, breadcrumb unificado, drop zone on card, header card, header 3.1.4, botón "Agregar período" verde, modal crear carpeta). Sub-headers simétricos + divider + fondo gris sutil. Contenedor unificado (Carpetas + Reportes en 1 card). Migración a KAIRToast moderno + kair-fv-modal unificado (mismo visor que Bandeja Integrada, con toolbar search/zoom/pages/rotación). 3 bugfixes críticos: 📦674 handlers IPC sin `ipcMain` importado (No handler registered), 📦673 TypeError setupEventListeners:193, 📦681 CSS con clase vieja. 📦684 fix 18 warnings "Unknown message type". 📦682-683 fix scroll bloqueado en modo ventana. 📦687 análisis con mejor UX para poco data (tendencia con línea, accident_date en Últimos Reportes, ribbon "análisis preliminar"). 📦685 contenedor unificado de Biblioteca. Helper `buildChartPreliminarRibbon()` + CSS `.furat-chart-preliminar + .furat-chart-preliminar { display: none; }` previene duplicación por bug conocido.

> **🆕 v0.1.155 (📦657):** Bandeja Integrada — Enviados muestra destinatario en lugar de remitente. Bug de UX clásico: en la carpeta "Enviados", la lista y el detalle mostraban el remitente (siempre "yo") en vez del destinatario. Fix backend: `getThreadsFromCache` y `getThreadFromCache` ahora hacen LEFT JOIN correlated con `email_messages` para traer `to_list`/`cc_list` del último message. Fix frontend: nuevo helper `getMailDisplayContact(mail)` que retorna el contacto correcto según carpeta; avatar/sender name/búsqueda del lista y header/panel del detalle usan el contacto correcto. En SENT, el header muestra el destinatario + "de: yo" en gris, y el panel "Mostrar detalles" tiene orden Gmail-style Para → CC → De.

> **🆕 v0.1.154 (📦656):** Gráfica "Capacitaciones Mensuales" del home de Recursos ahora coincide con el submódulo. Root cause: el algoritmo del home (`getCapacitacionesChartDataForGraph`) hardcodeaba las columnas del Excel (leía `row[3]` cuando la fecha real está en `row[5]`). Fix: reescritura completa del algoritmo con auto-detección de columnas leyendo el header, parser de fecha robusto (DMY/ISO/serial date/fallback), fallback offset ±2 columnas, y filtros estrictos de fila. La gráfica del home ahora muestra exactamente lo mismo que "Ejecución Mensual" del submódulo.

> **🆕 v0.1.153 (📦655):** Gmail — fix encoding tildes/eñes en subject. El raw MIME escribía el subject como UTF-8 raw, que Gmail/clients interpretaban como Latin-1 → `ejecución` → `ejecucÃ³n`. Fix: nueva `encodeMimeHeader()` que aplica RFC 2047 encoded-word (`=?UTF-8?B?<base64>?=`) a From/To/Cc/Bcc/Subject. Subjects con tildes, eñes y acentos ahora se ven correctos.
> **🆕 v0.1.152 (📦654):** Presupuesto — tabla más compacta (font-size 0.9rem → 0.75rem, 14.4px → 12px). Celdas, headers, editables, calculadas e inputs heredan. Caben más filas sin scroll.
> **🆕 v0.1.151 (📦653):** Presupuesto — formato inteligente de números sin ",00" cuando son enteros (0 → 0, 100 → 100, mantiene 1.234,56). Nueva `formatPct` para %. Removido sistema de notificación viejo del Presupuesto (`.k-toast` CSS, HTML `#notification`, función `showNotification`). Ahora usa `window.KAIRToast.show()` (sistema moderno unificado de toda la app, cargado también en el iframe del presupuesto).
> **🆕 v0.1.150 (📦652):** Modal Redactar potenciado — chips estilo Gmail para destinatarios (avatar + nombre + ×) en Para/CC, mismo estilo que el item de autocomplete seleccionado (fondo azul claro con borde). Comportamiento: click en autocomplete → chip, coma/Enter/blur → chip, Backspace → borrar último, click × → eliminar. Placeholder "Para" se oculta con chip. Autocomplete con mejor visual (borde + sombra más prominentes, items con border-radius, avatar 32×32). Alineación perfecta Para↔Asunto. Quitada la línea azul de focus. X del chip sin look de botón.
> **🆕 v0.1.149 (📦651):** Polish visual — iconos del home en gris claro (mismo color que subtítulos) + Configuración armonizada (status pill verde con dot, acciones horizontales con jerarquía, active tab con tinte sutil) + modal "Gestión de Usuario" con scroll interno (header fijo / body scrollable / footer fijo, max-height calc(100vh-40px)).
> **🆕 v0.1.148 (📦650-ux):** Polish visual del modal Redactar — grip del resize sutil estilo Windows (14×14, 2 rayitas opacidad 0.32, sin caja blanca) + autocomplete Gmail-style compacto (`width: max-content` min 240px max 380px, anclado al input) + autocomplete SOLO en Para/CC, NO en Asunto.
> **🆕 v0.1.147 (📦650):** Modal Redactar potenciado — resize custom desde grip top-left con `position: relative` fix (el modal NUNCA supera el área del correo) + autocomplete Gmail-style con índice de contactos desde `state.mails` + preservar espacios entre párrafos al enviar correos (multipart/alternative con text/html `white-space: pre-wrap`).
> **🆕 v0.1.146 (📦647+648+649):** Panel "Mostrar detalles" con seguridad SPF/DKIM/DMARC/TLS (pills estilo Gmail) + fix correos leídos vuelven a aparecer como no leídos (UPSERT CASE WHEN) + fix icono del escritorio + race condition electron-updater (installer.nsh customInstall + try/catch stub).
> **🆕 v0.1.144 (📦646 series, 13 fixes):** Fixes críticos Bandeja Integrada + Google Calendar — flicker calendario, día de la semana incorrecto, iframe adapter fallback, ID mismatch post-create, dedup con 2 keys, schema `google_event_id` + `attendees`, time zone `America/Bogota`, edit modal con attendees, safety nets.
> **🆕 v0.1.142 (📦642):** Iconos SVG Lucide en sidebar y headers — un solo color (currentColor), más liviano y consistente.
> **🆕 v0.1.141 (📦640):** Botón flotante scroll-to-top/bottom reutilizable + edición/eliminación de filas en tabla de ausentismo + hora visible en calendario semanal/diario.
> **🆕 v0.1.138 (📦608):** @file-viewer — preview nativo de Office / PDF / imágenes sin Python+LibreOffice.
> **🆕 v0.1.131 (📦581):** Update UX completo (Loops 1-10) — Claude-style, no invasivo, footer-anchored.
> **🆕 v0.1.130 (📦579):** menú nativo de Electron oculto (loop 47b).
> **🆕 v0.1.120 (📦563):** Bandeja Integrada (cliente Gmail con OAuth + SQLite cache + Gmail-look UI).
>
> Ver `AGENTS.md` (secciones "🆕 Menú nativo" y "🆕 Bandeja Integrada") para los detalles completos.

---

## 🎯 Propósito

**K+AIR** es un sistema de gestión de Seguridad y Salud en el Trabajo (SG-SST) para empresas colombianas. Cumple con la Resolución 0312 de 2019 y permite gestionar múltiples empresas desde una sola interfaz.

**Usuarios objetivo:** Departamentos de SST, administración, auditoría, gerencia.

**Owner:** Javier Robles F. (Prof. SG-SST - Esp. Gerencia de Proyectos)

---

## 🏗️ Arquitectura (resumen)

```
┌─────────────────────────────────────────────────────────┐
│                    K+AIR Electron App                    │
├─────────────────────────────────────────────────────────┤
│  RENDERER (Frontend)                                    │
│  ├── index.html, renderer.js, styles.css                 │
│  ├── modules/ (8 módulos, 48 submódulos)                │
│  └── renderer/bandeja-integrada/ (iframe Gmail-look)    │
├─────────────────────────────────────────────────────────┤
│  PRELOAD (Puente Seguro)                                │
│  └── preload.js (~736 líneas, ~200 contratos IPC)       │
├─────────────────────────────────────────────────────────┤
│  MAIN (Backend Electron)                                │
│  ├── main.js (~20,173 líneas, 143+ handlers IPC)         │
│  ├── shared/ (google-gmail.js, google-auth.js, etc.)    │
│  ├── main/ (email-sync.js, db-instance.js, etc.)        │
│  └── components/ (config, seguimiento)                  │
├─────────────────────────────────────────────────────────┤
│  DATABASE                                                │
│  └── SQLite (kair.db) en app.getPath('userData')         │
│      Tablas: users, roles, sessions, companies, +5        │
│      tablas de email (Bandeja Integrada)                 │
├─────────────────────────────────────────────────────────┤
│  PYTHON (Portear/python-embed/)                         │
│  ├── Python 3.11.9 embeddable (sin instalación)         │
│  ├── 79+ paquetes (pandas, openpyxl, PyMuPDF, etc.)     │
│  └── Scripts: map_directory, actualizar_ausentismo, etc. │
└─────────────────────────────────────────────────────────┘
```

**Tecnologías clave:** Electron 37.x · Node.js · Python 3.11.9 · SQLite (better-sqlite3) · vanilla JS sin framework · BEM con prefijo `kair-`.

---

## 📁 Archivos clave (raíz del proyecto Electron)

| Archivo | Líneas | Propósito |
|---|---|---|
| `main.js` | 20,173 | Backend Electron, handlers IPC |
| `renderer.js` | 6,695 | Lógica de UI principal, navegación |
| `preload.js` | 736 | Contratos IPC (electronAPI) |
| `package.json` | 142 | Configuración npm + electron-builder |
| `index.html` | 143 | Punto de entrada HTML |
| `jsdoc.json` | 19 | Config JSDoc (genera doc auto con `npm run docs:generate`) |

---

## 📂 Estructura de carpetas (resumen)

```
sgsst-electron-app/
├── AGENTS.md                  ← este archivo + convenciones para IAs
├── README.md                  ← visión general del producto
├── CONTEXT.md                 ← este archivo
├── CHANGELOG.md               ← historial de versiones
├── package.json
├── main.js                    ← backend
├── renderer.js                ← UI principal
├── preload.js                 ← IPC
├── index.html
├── styles.css                 ← sistema visual K+AIR
├── modules/                   ← 8 módulos, 48 submódulos
├── renderer/bandeja-integrada/ ← cliente Gmail (iframe)
├── shared/                    ← lógica compartida (Gmail API, etc.)
├── main/                      ← scripts backend (email-sync, db, etc.)
├── components/                ← componentes UI
├── assets/                    ← iconos, imágenes
├── Portear/                   ← Python 3.11.9 embeddable + scripts
├── backup_archivos_originales/ ← respaldo histórico
└── (configuración Electron, scripts auxiliares, etc.)
```

---

## 🆕 Bandeja Integrada (v0.1.120, 📦563)

Cliente Gmail profesional integrado en K+AIR, basado en Gmail API con cache local SQLite. Permite leer, enviar, responder y organizar correos sin abrir Gmail en el navegador.

**Punto de entrada:** botón "Bandeja Integrada" en el header de la app.

**Archivos clave:**
- `renderer/bandeja-integrada/` — index.html + app.js (~3,400 líneas) + styles.css (~3,300 líneas) + data.js (Lucide icons)
- `shared/google-gmail.js` — wrapper Gmail API
- `shared/google-auth.js` — OAuth flow
- `main/email-sync.js` — sync bidireccional
- `main/email-schema-sql.js` — schema SQLite (5 tablas)

**Detalle completo:** ver `AGENTS.md` (sección "🆕 Bandeja Integrada").

---

## 🆕 Menú nativo oculto (v0.1.130, 📦579)

A partir de v0.1.130, la barra de menú nativa de Windows (File / Edit / View / Window / Help) ya no se muestra por defecto.

- **Dev (`npm start`):** oculto por defecto, aparece con tecla **Alt** (estándar Windows)
- **Producción (`.exe`):** oculto TOTAL, ni siquiera con Alt

**Implementación:** `main.js` con `autoHideMenuBar: true` en `BrowserWindow` + `Menu.setApplicationMenu(null)` si `app.isPackaged`.

**Detalle completo:** ver `AGENTS.md` (sección "🆕 Menú nativo de Electron oculto").

---

## 🐍 Python empaquetado (v0.1.80+)

- **Versión:** Python 3.11.9 embeddable
- **Ubicación:** `Portear/python-embed/`
- **Paquetes:** 79+ pre-instalados (pandas, openpyxl, PyMuPDF, etc.)
- **Scripts principales:** `map_directory.py`, `actualizar_ausentismo.py`, `convert_docx_to_pdf.py`, `convert_xlsx_to_pdf.py`, `dashboard_scanner.py`, generadores de actas COPASST/Convivencia.
- **Limitación:** torch excluido (build de ~800 MB → ~450 MB). Si necesitás LLM local, re-habilitarlo manualmente.

---

## 📋 Convenciones críticas

### Convención de commits (OBLIGATORIO)

Formato: `📦<n> # <descripción en español, tono casual>`

- `<n>` es **secuencial e incremental**. Verificar el último con `git log` antes de cada commit.
- **NO** usar conventional commits (`feat:`, `fix:`, etc.)
- Última verificación: `📦579` → siguiente es `📦580`

### Reglas de código

- `var` (no `let`/`const`) — compat con código legacy
- BEM con prefijo `kair-` para CSS
- Vanilla JS sin frameworks
- Sin Tailwind
- Exports a `window.X = X` al final de cada archivo
- SIEMPRE escapar HTML con `KairUI.esc()` antes de inyectar texto del usuario
- SIEMPRE formatear fechas con `KairHelpers.formatDate()`
- NO commitear sin OK explícito del usuario ("dale" / "OK" / "commit")

**Detalle completo de convenciones:** ver `AGENTS.md`.

---

## 🚀 Comandos principales

```bash
# Desarrollo
npm start

# Build (producción)
export GH_TOKEN=<tu_token>     # ⚠️ NUNCA commitear el token
npx.cmd electron-builder --win --publish=always

# Documentación API (JSDoc)
npm run docs:generate          # genera en ./docs-api/

# Debug
npm run debug
```

⚠️ **PowerShell:** usar `npx.cmd` (no `npx`) para evitar bloqueos de execution policy.

**Tiempos de build (v0.1.83+):** 8-12 min, ~450 MB.

---

## 🔐 Seguridad — credenciales

**NUNCA** commitear credenciales. Todas en `.env` (local, no en repo):

- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GH_TOKEN` (para publish)

Si por error commiteás un secret, rotar inmediatamente y usar `git reset + cherry-pick` con sed-replace (hay memoria de esto en commits anteriores).

---

## 📞 Recursos

- **Repo:** https://github.com/Reivaj640/SG-SST-E
- **Releases:** https://github.com/Reivaj640/SG-SST-E/releases
- **Branch activo:** `Dev-Pc` (production-ready), `Dev` (legacy)
- **Owner:** Javier Robles F. (Prof. SG-SST - Esp. Gerencia de Proyectos)

---

## 🗺️ Roadmap (resumen)

- **Corto plazo:** Bandeja Integrada v2 (Calendar write, templates, snooze real)
- **Mediano plazo:** tests automatizados, CI/CD, backups de kair.db
- **Largo plazo:** SaaS-ificación (Bandeja web con Next.js + PostgreSQL)

Detalle completo en `CHANGELOG.md` y commits del repo.

---

**Mantenimiento:** actualizar con cada cambio arquitectónico mayor. Si un dev/IA toca algo grande, agregar entrada en `CHANGELOG.md` + commit `📦<n>` con descripción clara.
