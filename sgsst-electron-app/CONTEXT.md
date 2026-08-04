# K+AIR — Contexto del Proyecto

**Última actualización:** 3 de agosto de 2026
**Versión actual:** 0.1.142 (publicado) — trabajando en 0.1.143
**Tipo:** Aplicación empresarial Electron para SG-SST (Colombia)
**Stack:** Electron 37 + vanilla JS + Python 3.11.9 (empaquetado) + SQLite (kair.db)

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
