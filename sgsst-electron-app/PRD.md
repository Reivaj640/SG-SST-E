# PRD — K+AIR (Sistema de Gestión SG-SST)

> **Para:** sesiones de AI que continúen el proyecto + Javier Robles F. (owner) como referencia.
> **Versión del doc:** 0.1.212 (22 sept 2026) — sincronizada con `package.json` y commit `📦807`.
> **Estado:** Producto en desarrollo activo. **NO release oficial** desde v0.1.205 (los siguientes son commits de desarrollo).

---

## 1. Resumen ejecutivo

**K+AIR** es una aplicación de escritorio (Electron) para la gestión integral del Sistema de Gestión de Seguridad y Salud en el Trabajo (SG-SST) en empresas colombianas. Cumple con la **Resolución 0312 de 2019** del Ministerio del Trabajo y permite gestionar **múltiples empresas** desde una sola interfaz, con sincronización multi-PC opcional mediante Google Drive como hub.

El producto es **usado en producción** por al menos 1 cliente (despliegue operativo en 1 PC para "gestión humana" — ausentismo) y está en desarrollo activo para las demás empresas y módulos. El código es compartido con la red de consultores SG-SST que asesoran a empresas bajo la marca del owner.

**Owner:** Javier Robles F. (Prof. SG-SST - Esp. Gerencia de Proyectos)
**Última versión publicada:** v0.1.205 (instaladores de release)
**Última versión de desarrollo:** v0.1.212 (HEAD en `origin/Dev-Pc`)

---

## 2. Usuarios objetivo

### 2.1 Usuarios primarios

| Rol | Descripción | Uso principal |
|---|---|---|
| **Consultor SG-SST (Javier)** | Owner y desarrollador. Carga empresas, configura módulos, da soporte. | Setup inicial, configuración de permisos por empresa, debugging, validación visual de cada feature |
| **Gerente / Admin de empresa cliente** | Encargado del sistema en la empresa cliente. | Marca asistencia, gestiona personal, firma documentos, ve indicadores |
| **Trabajador (operador)** | Usuario final que carga su información básica. | Firmar documentos, ver sus indicadores |

### 2.2 Setup físico del owner (Javier)

Esto explica decisiones de diseño que parecen "raras" pero son adaptadas a esta realidad:

- **3 PCs propios**: 1 escritorio + 2 laptops
- **Conectividad**: LAN del apartamento siempre disponible; ocasionalmente red de la empresa cliente
- **Hub de archivos**: Google Drive File Stream sincronizado entre las 3 PCs
- **Cliente**: 1 PC adicional en la empresa cliente donde la app está desplegada
- **Implicación de diseño**: la sincronización multi-PC es eventual (no siempre online); el código se escribe pensando en local-first + sync opcional.

---

## 3. Stack técnico

| Capa | Tecnología | Versión | Notas |
|---|---|---|---|
| Runtime | Electron | 37.x | App de escritorio (Windows/macOS/Linux) |
| Lenguaje renderer | Vanilla JS (ES5) | — | `var`, IIFE, `window.X` — sin frameworks frontend |
| Lenguaje main | Node.js | 20 LTS | CommonJS, no ESM |
| Base de datos | SQLite (better-sqlite3) | — | `kair.db` en `userData/` |
| Lenguaje scripts | Python | 3.11.9 embedded | Sin instalación externa, paquete `Portear/python-embed/` |
| Python deps | pandas, openpyxl, PyMuPDF, etc. | — | 79+ paquetes embebidos |
| Build | electron-builder | — | Configurado en `package.json` |
| Email | googleapis (Gmail API) | — | OAuth2 con Gmail |
| Diseño | BEM con prefijo `kair-*` | — | Sistema de diseño propio "premium v2" |
| Tipografía | DM Sans (UI) + Manrope (títulos, 800) | — | Sin Tailwind ni librerías |

### 3.1 Convenciones del código

Reglas críticas que TODO archivo nuevo debe respetar:

1. **EOL LF** — archivos en LF, no CRLF (verificar con `git diff --numstat`). Existe un commit 📦804 que normalizó 211 archivos.
2. **Renderer usa `var`**, NO `let`/`const`. ES5 estricto. IIFE + `window.X` para namespace global.
3. **Escape HTML** con `KairUI.esc()` antes de inyectar cualquier texto del usuario al DOM (anti-XSS).
4. **Dark mode** siempre con selector `[data-theme^="dark"]` (cubre `dark` y `dark-legacy`); NUNCA `[data-theme="dark"]` solo.
5. **Cache-bust obligatorio**: bumpear `?v=YYYYMMDD-vN-desc` en `index.html` cada vez que se modifique `styles.css`, `renderer.js`, o un `<script>` de módulo. Electron cachea agresivamente — sin esto Ctrl+R no toma cambios.
6. **Tokens scoped bajo contenedor**: cada módulo define sus tokens CSS locales (`--kair-X-*` o `--X-*`) scoped bajo `.kair-app`, `.kair-config`, `.km-wrapper`, etc. NUNCA usar `:root`, `*`, `body` para colores que pueden ser locales.
7. **NO usar clases globales peligrosas**: `.k-section-card`, `.header-back-btn`, `.header-action--ghost` (pueden chocar). Siempre reescribir como `.kair-X-*` scoped.
8. **Naming commits**: formato `📦<n> # español` con emoji literal (no escapado). El número viene después de verificar último en `git log`.
9. **Sin commit sin autorización explícita del user**: palabras = `dale`, `OK`, `commit`, `perfecto`. `procede` = autoriza cambio sin commit. `revierte` → `git reset --hard` inmediato.
10. **Validación con tests**: si tocas código de un módulo, corre su test (`main/test-X.js` con `$env:ELECTRON_RUN_AS_NODE=1; npx electron main/test-X.js`). El test debe pasar real — NUNCA aceptar SKIP como green.

---

## 4. Arquitectura

### 4.1 Procesos

```
┌─ MAIN PROCESS (Node.js) ─────────────────────────────────────┐
│  main.js (~21,643 líneas, 160+ handlers IPC)                  │
│  ├── shared/ (google-gmail, google-auth, db-instance)         │
│  ├── main/ (puentes IPC: 30+ archivos)                        │
│  └── components/ (config, seguimiento)                        │
├─ PRELOAD (puente IPC seguro) ────────────────────────────────┤
│  └── preload.js (~1138 líneas, ~250 contratos IPC)           │
│    window.electronAPI = {                                       │
│      auth, users, companies, sessions,                        │
│      bandejaIntegrada, firmaElectronica,                      │
│      gestionHumana, verificacionIndicadores,                   │
│      notificaciones, ...                                       │
├─ RENDERER (UI) ──────────────────────────────────────────┐
│  index.html (508 líneas, entry point con cache-busts)       │
│  ├── renderer.js (~7,270 líneas, lógica UI + navegación)    │
│  ├── styles.css (legacy + premium v2)                        │
│  ├── modules/ (9 módulos, 51 submódulos con UI)              │
│  ├── shared/ (kair-alerts, kair-skeleton, kair-design-…)     │
│  ├── assets/js/ (update-notifications, kair-…)              │
│  ├── renderer/bandeja-integrada/ (iframe Gmail-look)         │
│  └── components/                                             │
└─────────────────────────────────────────────────────────────┘

┌─ DATABASE (SQLite en userData/) ───────────────────────────┐
│  kair.db                                                     │
│  Tablas: users, roles, sessions, companies, companies_flags, │
│          + tablas por módulo (inducciones, evaluaciones,     │
│          identificacion_peligros, eventos_rapidos, gestacion,│
│          inspecciones, mantenimiento,                       │
│          email_threads, email_connections,                   │
│          notificaciones, ...)                                │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Multi-tenancy

- Toda fila lleva `company_key`; jamás "global" excepto donde explícitamente documentado (ej. `email_connections` que es 1 OAuth global compartido).
- **Badge**: suma de no leídas de **todas** las empresas del usuario (count no filtra datos sensibles).
- **Panel/Toast**: chip con nombre de empresa si ≠ activa; abrir Bandeja/detalle solo si `companyKey` de la fila == empresa activa; si no: "Cambiar de empresa para abrir".
- SQL siempre: `WHERE company_key IN (empresas_del_usuario)`.

### 4.3 Sincronización multi-PC (opcional)

- **Patrón**: `main/sync-service.js` lee/escribe `.kairsync` desde el hub de Google Drive.
- **Pull**: lee JSON del hub, maneja conflictos con last-write-wins.
- **Push**: serializa DB local a JSON, hace backup del archivo previo, escribe al hub.
- **Auto-sync**: timer por empresa con `sync.enabled=1`, debounced push (2s).
- **NO es obligatorio**: la app funciona local-first; sync solo si el usuario lo configura.

---

## 5. Módulos y submódulos

**Total declarado en sidebar oficial: 67 entradas** (51 con UI real + 16 placeholder en roadmap normativo).

### 5.1 Módulos top-level (9)

| # | Módulo | Submódulos | Estado | Notas |
|---|---|---|---|---|
| 1 | **Recursos** | 12 | ✅ Completo | Recursos, Responsable, Asignación, Afiliación, Trabajo Alto Riesgo, COPASST, Convivencia, Capacitación, Inducción, Curso 50h, Manual Proveedores |
| 2 | **Gestión Integral** | 13 (9 + 4) | 9 ✅ / 4 🚧 | Política, Objetivos, Evaluación Inicial, Plan Trabajo, Archivo, Rendición, + 4 placeholder (matriz legal, comunicaciones, equipos, EPP) |
| 3 | **Gestión de la Salud** | 18 (13 + 5) | 13 ✅ / 5 🚧 | Sociodemográfica, EMO, Restricciones, FURAT, Investigación, Registro Estadístico, + 4 indicadores (Frecuencia, Severidad, Mortalidad, Prevalencia, Incidencia) + Ausentismo |
| 4 | **Gestión de Peligros y Riesgos** | 11 (4 + 7) | 4 ✅ / 7 🚧 | Metodología IPEVR, Identificación de Peligros, Inspecciones, Mantenimiento + 7 placeholder |
| 5 | **Gestión de Amenazas** | 2 | ✅ Completo | Plan de Prevención, Exámenes Brigadista |
| 6 | **Verificación** | 4 (3 + 1) | 3 ✅ / 1 🚧 | Definición de Indicadores, Auditoría Anual, Revisión Alta Dirección + Planificación |
| 7 | **Mejoramiento** | 4 vistas | ✅ Completo | Acciones Preventivas/Correctivas + 3 variantes (AT-EL, Gerencia, Planes) |
| 8 | **Gestión Humana** 🆕 | 12 | ✅ Completo | Módulo top-level nuevo v0.1.191. Resumen, Dashboard, Contratación, Carpetas (expedientes), Firma Electrónica, Afiliaciones, Base Personal, Vacaciones, Permisos, Comunicación, Documentos, Trabajador Detalle |
| 9 | (helpers/shared) | — | — | `helpers/viewLoader.js`, `shared/kair-*` |

### 5.2 Sistema de Notificaciones Persistentes (feature nuevo, v0.1.212)

**Estado:** operativo en main process, UI completa con tabs y **tamaño estable** (`_pinPopoverHeight`), **167/167 tests OK** (📦807-808 + fix duplicación/tabs/tamaño 📦809).

**Archivos nuevos:**
- `main/notifications-bridge.js` (209+ líneas) — tabla `notificaciones` + 4 handlers IPC con `validateSession` + `GLOBAL_COMPANY='*'` + migración one-shot (consolida correos existentes)
- `main/notifications-service.js` (266 líneas) — timers + detección + dedupe + emisión
- `main/notifications-email.js` (99+ líneas) — detector de correos sin llamar Gmail directo; **UNA fila global `company_key='*'` por thread** (sin fan-out por empresa)
- `main/notifications-gate.js` (50 líneas) — gate real `bandeja_integrada_enabled` con fail-closed
**Tests (167/167 OK):**

- bridge 28/28, email 7/7, service 10/10, wiring 11/11, fuentes 52/52, ui 36/36, seguridad 23/23

**Funcionalidad:**
- Detección cada 60s desde proceso main (Bandeja cerrada no afecta)
- 12 fuentes de calendario: plan-trabajo (stub), capacitaciones, auditoría, eventos rápidos, gestaciones, inspecciones, mantenimiento + 5 recordatorios (copasst, convivencia, presupuesto, afiliación, inducciones)
- Ventana configurable: 15min / 1h / 6h / 24h (default 24h) persistida en `localStorage`
- Dedupe por `dedupe_key` UNIQUE (multi-ventana: keys distintas para cada ventana permiten re-notificar)
- UI: badge en header + toast persistente (autoClose:0) + **tabs Pendientes/Notificaciones** + marcar leída individual/todas + selector de ventana

**Lecciones transferibles (de esta feature):**
- Servicios main con timers: `setInterval + unref + stopAll en before-quit`
- Dedupe multi-ventana: incluir `ventanaMs` en `dedupe_key` (mismo evento, distintas ventanas → distintas keys)
- Fail-closed por defecto: gate `bandeja` sin sesión activa → false
- Guard de reentrada: `try { ... } finally { _inFlight = false }` para evitar que un detector async (120s) se solape con el siguiente tick
- `.apply(stmt, params)` no `.apply(db, params)` en better-sqlite3 (pertenece al statement, no a la db)
- `CREATE UNIQUE INDEX ... COALESCE(...)` — SQLite no soporta UNIQUE con expresiones a nivel de tabla

---

## 6. Features principales

### 6.1 Bandeja Integrada (cliente Gmail profesional)

- **Origen**: v0.1.120 (📦563), mejorado con premium v2 (📦739-790)
- **Implementación**: iframe en `renderer/bandeja-integrada/` con look-and-feel Gmail
- **OAuth2** con Google, refresh token, SQLite cache local (`email_threads`, `email_messages`)
- **Operaciones**: leer, enviar, responder, organizar
- **Permisos**: por usuario (`bandeja_integrada_permissions_bridge.js`, 📦702)
- **Sincronización**: desde el iframe cada 30s cuando está visible

### 6.2 Firma Electrónica

- **Servicio independiente**: `firma-service/` (Node.js 20 + Express + SQLite + pdf-lib + nodemailer)
- **Comunicación**: K+AIR Electron ↔ Servicio Firma por API REST (no comparten BD)
- **Schema**: contratos, sign_requests, paso→categoría mapping
- **Marco legal**: Ley 527/1999, Decreto 2364/2012, Decreto 1072/2015, Decreto 526/2021, Ley 1581/2012
- **Estado**: v0.1 — esqueleto del servicio + schema SQLite. Documentación de deployment en `firma-service/deploy/`.
- **Flujo dual** (📦756-758): trabajador firma + empresa firma, ambas en mismo flujo

### 6.3 Sistema de Diseño "Premium v2"

- **Homes de módulo** (📦730-738, v0.1.197-205): 8 homes rediseñados
- **Submódulos** (📦739-802, v0.1.206-211): 50+ submódulos migrados al dialecto premium v2
- **Sidebar** (📦738): nav-cards premium con hover/activo en mismo color
- **Design system compartido**: `shared/kair-design-tokens.css` (9 tokens), `shared/kair-components.css` (14 componentes reutilizables con prefijo `kair-*`), `shared/kair-premium.css` (📦749, dialecto extraído)
- **Header System v2**: breadcrumb + icon chip + título Manrope + subtítulo + acciones (transparente sobre canvas)
- **Tabs con subrayado**: la activa lleva una línea azul de 2px montada sobre la línea gris
- **Modo oscuro**: cubre los DOS atributos (`data-theme="dark"` y `dark-legacy`) con `[data-theme^="dark"]`

### 6.4 Gestión Humana (módulo top-level nuevo)

- **Origen**: v0.1.191 (📦707-720)
- **Backend completo**: 16 handlers IPC en `gestion-humana-bridge.js`
- **3 tablas SQLite**: `categorias` (de carpetas), `expedientes`, `documentos`
- **Ciclo laboral 1.0 cerrado** (v0.1.191): barrera backend para bp retirado, tabla `gh_eventos_personal`, soft delete puro, E2E tests
- **Pipeline de contratación**: 6 pasos
- **Carpetas**: archivo digital por trabajador con paginación + filtros + CRUD de categorías
- **Firma electrónica**: integrada con el servicio independiente
- **Afiliaciones**: EPS, Pensión, ARL, Caja
- **Permisos**: incapacidades, maternidad, luto, permisos diversos
- **Estado**: desplegado en 1 PC de cliente (gestión humana solo ausentismo por ahora)

### 6.5 Multi-empresa y multi-rol

- Tabla `companies` + `users` con relación N:M via `user_companies`
- Sesiones con `expires_at` ISO
- `validateSession(token)` retorna `{ ok, session, user: { id, email, companies, roles, isAdmin } }`
- Permisos por módulo/empresa flags

### 6.6 Investigación de Accidentes (con LLM)

- **Origen**: 📦700+ en `modules/gestion-salud/investigacion-accidentes/`
- **LLM**: Qwen local vía Ollama/IPC, sin envío de datos personales fuera del repo
- **3 vistas**: Editor + Lista + Detalle

### 6.7 Reportes y Estadísticas (3.2.3, 3.3.1-5)

- Registro y Análisis Estadístico con 9 gráficos Chart.js con colores de tema
- Frecuencia / Severidad / Mortalidad / Prevalencia / Incidencia con tokens scoped (`--freq-*`, `--sev-*`, `--mort-*`, `--prev-*`, `--inc-*`)
- Patrón "tabla blindada": `min-width:0 !important` + `table-layout:fixed` con anchos que suman 100% — evita scroll horizontal y deformaciones
- Gráficos con resize handler + cleanup

---

## 7. Estructura física del repo

```
sgsst-electron-app/
├── AGENTS.md                 # Convenciones + secciones por feature
├── CHANGELOG.md               # Historial de versiones (Keep a Changelog format)
├── CONTEXT.md                # Contexto del proyecto para AI/devs
├── PRD.md                    # ESTE ARCHIVO
├── README.md                 # Descripción pública del producto
├── release-notes.md          # Notas de release
├── package.json              # v0.1.212, deps + electron-builder config
├── package-lock.json
├── main.js                   # 21,643 líneas, 160+ handlers IPC
├── preload.js                # 1,138 líneas, ~250 contratos IPC
├── index.html                # 508 líneas, entry point con cache-busts
├── renderer.js               # 7,270 líneas, lógica de UI
├── styles.css                # Sistema visual legacy + premium v2
├── assets/                   # Iconos, imágenes, scripts JS auxiliares
│   ├── K+AIR-multires.ico    # Ícono de ventana
│   ├── KIAR256.ico           # Ícono splash/header
│   └── js/
│       └── update-notifications.js  # Adaptado para toasts persistentes
├── modules/                  # 9 módulos, 51 submódulos con UI + 16 placeholder
│   ├── recursos/             # Módulo 1
│   ├── gestion-integral/     # Módulo 2
│   ├── gestion-salud/        # Módulo 3
│   ├── gestion-peligros/     # Módulo 4
│   ├── gestion-amenazas/     # Módulo 5
│   ├── verificacion/         # Módulo 6
│   ├── mejoramiento/         # Módulo 7
│   ├── gestion-humana/       # Módulo 8 🆕
│   ├── helpers/              # viewLoader.js
│   └── shared/               # kair-* compartido
├── renderer/
│   └── bandeja-integrada/    # iframe Gmail-look
├── shared/                   # Lógica compartida (Gmail API, KairAlerts, etc.)
│   ├── google-gmail.js
│   ├── google-auth.js
│   ├── email-normalizer.js
│   ├── kair-alerts.js        # Popover + nueva sección Notificaciones
│   ├── kair-design-tokens.css
│   ├── kair-components.css
│   ├── kair-premium.css
│   └── kair-skeleton.js
├── main/                     # Puentes IPC (30+ archivos)
│   ├── notifications-bridge.js     # 🆕 notificaciones
│   ├── notifications-service.js    # 🆕 timers
│   ├── notifications-email.js      # 🆕 detector correo
│   ├── notifications-gate.js       # 🆕 gate real
│   ├── eventos-rapidos-bridge.js   # Exporta _listEventosRapidosImpl (fuente notif)
│   ├── inspecciones-bridge.js      # Exporta getEventsCalendario (fuente notif)
│   ├── mantenimiento-bridge.js     # Exporta getCalendarEventsAll (fuente notif)
│   ├── gestacion-bridge.js         # Exporta _handlerEventosCalendario (fuente notif)
│   ├── auditoria-anual-bridge.js   # Exporta _getFasesImpl (fuente notif)
│   ├── gestion-humana-bridge.js
│   ├── email-sync.js
│   ├── email-db.js
│   ├── email-schema-sql.js
│   └── test-*.js                   # 60+ tests funcionales
├── components/              # Componentes UI legacy
├── docs/                    # Documentación
│   ├── superpowers/
│   │   ├── specs/            # Diseños aprobados (gitignored)
│   │   └── plans/            # Planes de implementación (gitignored)
│   ├── gestion-humana/firma-electronica/  # Auditorías + diseño firma
│   ├── kair-firma-integration/            # Diseño integración firma-service
│   ├── i-010/                              # Diseño auth/roles
│   ├── especificaciones-tecnicas-sg-sst-v1.md
│   ├── GUIA-FIRMA-DUAL-USUARIO.md
│   └── MIGRACION-SERVIDOR-FIRMA.md
├── Portear/                 # Python 3.11.9 embeddable + scripts
│   ├── python-embed/
│   └── *.py
├── firma-service/           # Servicio independiente de firma electrónica
│   ├── README.md
│   ├── deploy/
│   └── ...
├── backup_archivos_originales/  # Respaldo histórico pre-rewrite
├── vendor/                  # Deps empaquetadas
├── tools/                   # Utilidades standalone
└── (configuración Electron, scripts auxiliares, etc.)
```

---

## 8. Workflow del usuario (Javier)

### 8.1 Setup inicial de una empresa nueva
1. Crear empresa en YYYY.MM (Plan anual)
2. Crear usuarios (admin, gerencia, trabajador)
3. Asignar empresas a usuarios
4. Cargar documentos iniciales (política, reglamento, etc.)
5. Configurar módulos habilitados

### 8.2 Operación mensual típica
1. Cargar incapacidades → Bandeja Integrada recibe email del worker → app notifica → marcar como procesada
2. Reportar accidente → Investigación con LLM assistance
3. Ejecutar inspecciones programadas → Excel real
4. Generar indicadores mensuales → Definición de Indicadores (6.1.1)
5. Revisar con gerencia → Despliegue Estratégico (6.1.3)

### 8.3 Validación visual (pre-commit)
- Cada feature nueva se valida visualmente con screenshots antes de commitear
- Palabras para commit: `dale`, `OK`, `commit`, `perfecto`
- Sin commit si user dice "sin commit hasta..."

---

## 9. Métricas de salud del proyecto

| Métrica | Valor actual |
|---|---|
| Versión de desarrollo | 0.1.212 (HEAD: `c56ed18e 📦807`) |
| Versión publicada | v0.1.205 |
| Total archivos JS | 962 |
| Total archivos CSS | 90 |
| Total archivos HTML | 118 |
| Líneas de main.js | 21,643 |
| Líneas de preload.js | 1,138 |
| Líneas de renderer.js | 7,270 |
| Módulos top-level | 9 |
| Submódulos con UI | 51 |
| Submódulos placeholder en sidebar | 16 |
| Total declarado en sidebar | 67 |
| Tests del feature Notificaciones | 167/167 OK |
| Documentos en `docs/superpowers/` | 8 (4 specs + 4 plans) |

---

## 10. Roadmap / pendientes

### 10.1 Inmediato (este mes)

- [ ] Arreglar `plan-trabajo` source cuando exista el bridge de calendario
- [ ] Validación visual de Notificaciones Persistentes con Bandeja cerrada (criterio §9 del spec)
- [ ] Bumpear cache-bust si la UI de notificaciones se toca
- [ ] Push del commit 📦808 (corrección "11→12 fuentes" en README) cuando Javier lo autorice

### 10.2 Próximo mes

- [ ] **Panel dashboard horizontal** — sucesor del home premium (📦738) con widgets configurables
- [ ] **Submenu Bandeja Integrada** — mejorar el look en maximizada
- [ ] **Notificaciones del SO** (`Notification` API) — v2, fuera de alcance de v1.1
- [ ] **Encriptación de tokens** en `config.json` — fuera de alcance v1 (hardening v2)
- [ ] **Rate-limit por usuario** en handlers IPC — hardening v2

### 10.3 Largo plazo

- [ ] Notificaciones de vencimientos de tablas no-calendario (EMO, roles, etc.)
- [ ] Retención/purge de notificaciones leídas >30 días
- [ ] Sync-service improvements (mejor resolución de conflictos, mejor UI de sync state)
- [ ] Firma-service en producción (actualmente v0.1 esqueleto)
- [ ] Release oficial v0.2.0 (consolidación de todas las features de v0.1.205 → v0.1.212)

### 10.4 Backlog normativo (placeholders en sidebar)

Los 16 submódulos marcados como 🚧 Roadmap son:
- 2.7.1 Matriz de requisitos legales
- 2.8.1 Mecanismos de comunicaciones
- 2.12.1 Equipos y Herramientas
- 2.13.1 Elementos de Protección Personal
- 3.1.2 Actividades de medicina preventiva
- 3.1.5 Custodia médica ocupacional
- 3.1.7 Estilos de Vida Saludables
- 3.1.8 Servicios de Higiene
- 3.1.9 Manejo de Residuos
- 4.1.3 Sustancias Químicas
- 4.1.4 Mediciones Ambientales
- 4.2.1, 4.2.2, 4.2.3 (medidas de prevención)
- 4.2.6 Entrega de EPP
- 6.1.4 Planificación de la Auditoría

---

## 11. Riesgos conocidos

| Riesgo | Mitigación |
|---|---|
| Multi-PC sync con LAN/GDrive no garantiza uptime | Diseño local-first + sync opcional |
| Tokens OAuth Gmail en config.json plano (sin encriptar) | Hardening v2 — fuera de alcance v1 |
| Algunos submódulos placeholder confunden al usuario | Marcados explícitamente 🚧 Roadmap + columna Estado en docs |
| EOL mixto LF/CRLF causa diffs espurios | 📦804 normalizó, regla LF obligatoria, `git diff --numstat` antes de commit |
| Sesiones expiradas podrían causar loops con tokens viejos | Service pausa ticks si no hay sesión activa (fail-closed) |

---

## 12. Documentación relacionada

| Doc | Propósito | Cuándo consultar |
|---|---|---|
| `AGENTS.md` (4121 líneas) | Convenciones detalladas + secciones por feature con paquete 📦 | Implementar features, conocer patrones |
| `README.md` (1671 líneas) | Descripción pública + Características + Módulos | Contexto general, features público |
| `CHANGELOG.md` (~4500 líneas) | Historial por versión con detalles técnicos | Ver qué cambió en cada paquete 📦 |
| `CONTEXT.md` | Contexto resumido del proyecto para AI/devs | Onboarding rápido |
| `release-notes.md` | Notas de release (formato corto) | Comunicar releases |
| `docs/superpowers/specs/*` | Diseños aprobados (gitignored) | Entender decisiones antes de planificar |
| `docs/superpowers/plans/*` | Planes de implementación TDD (gitignored) | Ejecutar planes task-by-task |

---

## 13. Glosario rápido

- **SG-SST**: Sistema de Gestión de Seguridad y Salud en el Trabajo (Colombia, Decreto 1072/2015 + Resolución 0312/2019)
- **FURAT**: Formato Único de Reporte de Accidente de Trabajo
- **EMO**: Evaluación Médica Ocupacional
- **COPASST**: Comité Paritario de Seguridad y Salud en el Trabajo
- **ARL**: Administradora de Riesgos Laborales
- **EPS**: Entidad Promotora de Salud
- **IPEVR**: Identificación de Peligrosos y Evaluación de Riesgos
- **IPC**: Inter-Process Communication (en Electron, `ipcMain.handle` + `ipcRenderer.invoke`)
- **TTVC**: Tablero de Tareas, Vacaciones y Comunicaciones (submódulo legacy)
- **Bridge**: Archivo JS en `main/` que registra handlers IPC con `registerXxxHandlers(app, deps)`
- **Source**: Función inyectable al servicio de notificaciones que devuelve eventos en un rango
- **Service**: Módulo en `main/` que mantiene estado + timers (ej. sync-service, notifications-service)

---

**Última revisión:** 22 sept 2026
**Próxima revisión sugerida:** cuando se commiten features mayores (v0.2.0 o nuevos módulos top-level)