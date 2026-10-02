# 🔐 INFORME DE AUDITORÍA DE SEGURIDAD — K+AIR (SG-SST-E)

**Fecha:** 2026-09-29 · **Versión auditada:** 0.1.224 (rama `Dev-Pc`) · **Tipo:** Auditoría ofensiva-defensiva pre-deploy (caja blanca)
**Alcance:** Proceso principal (`main.js` ~28.000 líneas + ~60 bridges), `preload.js` (564 canales IPC), `renderer.js` + `index.html`, submódulos en `main/`, `renderer/`, `modules/`, servicios embebidos (firma-service Node, LLM Flask Python/Portear), empaquetado electron-builder, git y dependencias.

**Metodología:** análisis estático dirigido (patrones de traversal, SQLi, inyección de comandos, XSS, auth), 4 barridos especializados en paralelo, `npm audit`, extracción y verificación del instalador real (`dist/win-unpacked/resources/app.asar`), verificación de estado de git y del repo remoto. Todos los hallazgos fueron verificados con línea y extracto de código; los 3 más graves se re-verificaron manualmente.

---

## 1. VEREDICTO: 🛑 NO LISTO PARA DEPLOY

**5 vulnerabilidades críticas** deben resolverse antes de cualquier distribución. Una de ellas (contraseñas públicas en GitHub) requiere acción **hoy**, independiente del deploy.

| Severidad | Cantidad | Resumen |
|---|---|---|
| 🔴 Crítica | **5** | Credenciales públicas en GitHub, PII en repo público, RCE encadenable desde el renderer, PII empaquetada en el instalador, cadena de actualización sin firma |
| 🟠 Alta | **16** | Traversal de rutas masivo, sanitizador de correo con huecos, CSP débil, admin por defecto, firma-service en LAN, sync sin autenticidad, DB médica sin cifrar |
| 🟡 Media | **15** | save-config sin esquema, canales IPC genéricos, XSS reflejado en OAuth, webviewTag, DNS rebinding, retención de datos post-uninstall |
| ⚪ Baja | **10** | Oráculos de rutas, logs con nombres, artefactos de desarrollo en el asar |

---

## 2. HALLAZGOS CRÍTICOS (bloquean el deploy)

### 🔴 CRIT-1 — Contraseñas reales de Gmail de clientes, en un repo público
- **Dónde:** `utils/emailSender.js:148-154` — objeto `CREDENCIALES` con 5 contraseñas de aplicación de Google (4 buzones: Tempoactiva, Temposum, Aseplus, ASEL; COOTRACOM reutiliza el de Tempoactiva). El archivo **está rastreado por git** (`git ls-files`) y el remoto `github.com/Reivaj640/SG-SST-E` es **público** (verificado: `git ls-remote` funciona sin credenciales; `dev-app-update.yml` declara `private: false`).
- **Impacto:** cualquier persona que clone el repo tiene acceso SMTP/IMAP completo a los buzones de las empresas: leer remisiones médicas históricas (nombres + recomendaciones de salud = dato sensible Ley 1581/2012), exfiltrar correo, o **enviar phishing haciéndose pasar por la empresa**. Este módulo está vivo: `main.js:20503` lo usa para enviar remisiones médicas con adjuntos.
- **Acción inmediata:** (1) revocar/rotar las 5 contraseñas de aplicación en las cuentas de Google YA; (2) reescribir el historial de git (BFG/filter-repo) o al menos eliminar las credenciales del código; (3) mover credenciales a `safeStorage` (DPAPI) igual que ya lo hace `firma-bridge` con `secrets.enc` — el patrón correcto ya existe en el proyecto.

### 🔴 CRIT-2 — Datos personales reales publicados en el repo público
- **Dónde:** 23 documentos reales de clientes en `utils/` (ej. `ACT-FO-043 Presupuesto SG-SST 2025 Tempoactiva.xlsx`, `GI-FO-076 AUSENTISMOS POR ARL Y EPS 2024.xlsx`, informes de incapacidades, investigaciones de accidentes — rastreados por git, confirmado con `git check-ignore` que NO los excluye) y PDFs de personas nombradas en `Portear/Utils/` (ej. `Freddy Julio 29072025.pdf`).
- **Impacto:** exposición de datos de salud ocupacional y nómina de trabajadores reales en internet. Riesgo legal directo (Ley 1581/2012 habeas data) y reputacional.
- **Acción:** eliminar de git + purga de historial + `gitignore`; notificar/evaluar según política de privacidad de los clientes afectados.

### 🔴 CRIT-3 — Ejecución arbitraria encadenable desde el renderer (`open-path` + escritura libre)
- **Dónde:** `main.js:4214-4225` — handler IPC `open-path` llama `shell.openPath(pathToOpen)` con la ruta que envíe el renderer, **sin ninguna restricción** (ni tipo, ni confinamiento a carpetas de la app). `shell.openPath` sobre un `.exe/.bat/.lnk` lo **ejecuta**. Primitiva complementaria de escritura: `upload-document` (`main.js:9118-9205`) escribe cualquier archivo en cualquier directorio existente elegido por el renderer.
- **Impacto:** si se logra XSS en cualquier página que tenga el puente `window.electronAPI` (564 funciones), el atacante pasa de script → escritura de un `.bat` en cualquier carpeta → ejecución vía `open-path`. RCE completo como el usuario. Y el XSS es plausible: ver ALT-2 y ALT-3.
- **Acción:** confinar `open-path` (whitelist de carpetas de datos + solo extensiones de documento), y aplicar el helper `safeResolve()` (sección 7) a toda la familia de handlers de archivos.

### 🔴 CRIT-4 — Datos personales reales se empaquetarán en el próximo instalador
- **Dónde:** `backups/` (raíz de la app) contiene 3 copias de la BD de producción `kair-pre-empresa-id-fix-*.db` (1,5 MB c/u + 2 MB de WAL) con **datos reales**: `base_personal` (cédulas, salarios, cuentas bancarias), `gestaciones` (3), `seguimiento_incapacidad_caso`, `email_connections`, `users` (3 correos reales), 1.569 sesiones. El `files: "**/*"` del build **no excluye** `backups/`; la última build (0.1.196) es anterior a la creación de la carpeta, por lo que **la próxima compilación los incrusta en el instalador público**.
- **Además, ya están en el asar actual (0.1.196, verificado extrayéndolo):** (a) `.env` con el client secret real de Google OAuth (`GOCSPX-…`) — no está en git, pero **viaja en cada instalador**; (b) `firma-service/data/` con 13 variantes de `firma.sqlite` (320 MB); (c) los 23 documentos de clientes de `utils/` **descomprimidos en texto plano** (`asarUnpack: "**/utils/**"`); (d) 48 archivos de test, `__debug.js`, copias `.bak-*` (el patrón `!**/*.bak` no cubre `main.js.bak-pre-presup-bd-20260929` por el sufijo), `Temp/`, `previews/`, `.git-archive-cleanup-2026-09-07/`.
- **Acción:** convertir `build.files` en una **allowlist** (listar solo lo que la app ejecuta), excluir `backups/`, `firma-service/data/`, `utils/` (documentos), `.env`, `Temp/`, `previews/`, tests; corregir el patrón a `!**/*.bak*`. Retirar los documentos de `utils/` del árbol del proyecto.

### 🔴 CRIT-5 — Cadena de actualización y binario sin endurecer (sin firma, sin fuses)
- **Dónde:** no hay certificado de firma de código ni `publisherName` en el build; **no se aplican Electron fuses** (verificado byte a byte contra el `.exe` distribuido: `RunAsNode=enabled`, `NODE_OPTIONS=enabled`, `--inspect=enabled`, **integridad de ASAR desactivada**); el auto-updater (`main.js:214-216`: `autoDownload=true`, `autoInstallOnAppQuit=true`) apunta a releases del repo público de GitHub.
- **Impacto:** (a) el transporte es HTTPS y `allowDowngrade` está en su valor seguro, PERO toda la integridad descansa en el sha512 de `latest.yml` alojado en el mismo repo: si comprometen la cuenta de GitHub, **todos los clientes se actualizan silenciosamente a un RCE**; (b) con `RunAsNode` e `NODE_OPTIONS` habilitados, un atacante con escritura en disco puede ejecutar el binario firmado como lanzador de scripts arbitrarios (`ELECTRON_RUN_AS_NODE`), eludiendo las protecciones de Electron; (c) `--inspect` permite adjuntar un debugger en producción; (d) sin integridad de ASAR, se puede reemplazar el `app.asar` junto al ejecutable.
- **Acción:** aplicar `@electron/fuses` (RunAsNode off, NODE_OPTIONS off, inspect off, **EnableEmbeddedAsarIntegrityValidation on**, OnlyLoadAppFromAsar on), firmar el instalador y configurar `verifyUpdateCodeSignature` + `publisherName`; activar 2FA/llave de protección en el repo y tokens con scope mínimo.

---

## 3. VULNERABILIDADES POR SUBMÓDULO

### 3.1 Núcleo Electron (main.js · preload.js · index.html)

| # | Severidad | Hallazgo | Evidencia |
|---|---|---|---|
| N-1 | 🟠 Alta | **CSP con `'unsafe-inline'` + 2 CDNs remotos sin SRI.** Un solo hueco de HTML-injection = ejecución de script con acceso al puente completo. Scripts remotos activos: three.js r134, vanta, chart.js **sin versionar**, bootstrap (cdnjs/jsdelivr) | `index.html:6, 30-31, 295-297`; 0 atributos `integrity=` en todo el HTML |
| N-2 | 🟠 Alta | **Sin `will-navigate`, `setWindowOpenHandler` ni `web-contents-created`.** Una navegación a URL remota (o `window.open`) recarga el preload → contenido remoto con `window.electronAPI` | grep de ambos handlers en `main.js`: 0 resultados; primitiva en `modules/gestion-salud/evaluaciones-medicas/evaluaciones-medicas-v2.js:951-962` |
| N-3 | 🟠 Alta | **Familia de traversal/FS sin confinar (~15 handlers IPC)** — detalle por submódulo abajo. No existe un helper `safeResolve()` en todo el código | ver §3.2-3.9 |
| N-4 | 🟡 Media | **`preload.js` expone `send`/`onIpcMessage` genéricos a cualquier canal** (el resto de los ~700 métodos son wrappers de canal fijo — bien hecho) | `preload.js:1091-1097` |
| N-5 | 🟡 Media | **`webviewTag: true`** en la ventana principal sin uso actual (superficie latente) | `main.js:1227-1232` |
| N-6 | 🟡 Media | **Delegación postMessage con validación débil**: solo exige `origin === 'file://'`; cualquier iframe local (bandeja, config-viewer o un archivo local navegado) puede invocar el dispatch completo | `renderer.js:1389-1392`; el iframe de config recibe además `electronAPI` directamente (`renderer.js:6742-6754`) |
| N-7 | ⚪ Baja | DevTools no bloqueados en producción (solo `openDevTools` comentado) + fuse `--inspect` activo | `main.js:1277` |

### 3.2 Documentos y adjuntos (upload/download/preview — transversal a casi todos los módulos)

| # | Severidad | Hallazgo | Evidencia |
|---|---|---|---|
| D-1 | 🟠 Alta | **`upload-document`**: escribe archivos en cualquier directorio existente elegido por el renderer (sobrescribe sin confirmar); solo valida extensión/tamaño del nombre, no el destino | `main.js:9118-9205` |
| D-2 | 🟠 Alta | **`delete-document`**: borra (papelera + `unlink` con 15 reintentos) cualquier archivo; puede destruir las BD legales (`kair.db`, `firma.sqlite`, `email.db`) | `main.js:9211-9290` |
| D-3 | 🟠 Alta | **Lectura arbitraria de archivos (4 handlers)**: `read-file-bytes` (≤100 MB, whitelist de extensiones que incluye `sqlite/json/log/html/eml/svg`), `download-document`, `get-pdf-preview` (sin filtro), `read-excel-file`; `read-directory` enumera cualquier carpeta y con `'DRIVES'` ejecuta `wmic` para listar discos → oráculo completo de FS para exfiltrar `kair.db` en una llamada IPC | `main.js:7080-7160, 9093-9116, 7021-7043, 4245-4270, 4122-4180`; expuesto genéricamente en `preload.js:253` |
| D-4 | 🟡 Media | `generate-copasst-acta` / `generate-convivencia-acta`: `savePath` del renderer pasa directo al generador Python → sobrescribir cualquier archivo con un XLSX | `main.js:12724+` |
| D-5 | 🟡 Media | Handlers Excel legacy con rutas del renderer: `readPresupuestoData`, `saveBudgetFile`, `save-proveedores-excel-data` (crea/sobrescribe cualquier ruta), `save-objetivos-excel-data`, `update-plan-trabajo-excel`, `init-excel`, `duplicate-budget-file` | `main.js:6508, 9644, 8203, 7359, 4619, 6434, 14269` |

### 3.3 Gestión Humana (gh:* — personal, contrataciones, comunicaciones)

| # | Severidad | Hallazgo | Evidencia |
|---|---|---|---|
| GH-1 | 🟠 Alta | **Auth "soft" que nunca falla**: `_checkAuth()` devuelve `{ok:true}` incluso con token **inválido** ("continuando con soft auth"). Los 80+ canales `gh:*` —incluidos lectura de PII y `gh:delete-personal` / `gh:delete-contratacion`— son invocables sin credencial válida | `main/gestion-humana-bridge.js:47-57`; mismo patrón en `rep-legal:*` y firma (`preload.js:557-563`) |
| GH-2 | 🟠 Alta | **Traversal en `gh:subir-adjunto-comunicacion`**: `referenciaId` se interpola crudo en `path.join(userData/gh-comunicacion-adjuntos, empresaId, referenciaId, ...)` → `..\..\..` escapa la carpeta; `nombre` permite `.exe`/`.bat`; contenido base64 hasta 25 MB; y no requiere token (GH-1) | `main/gestion-humana-bridge.js:3297-3355` |
| GH-3 | 🟡 Media | Sin cifrado en reposo para nómina (salarios, bancos, EPS) — ver §4 | `main/gestion-humana-schema-sql.js:78-125` |

### 3.4 Salud ocupacional — Evaluaciones médicas, Gestación, Incapacidades

| # | Severidad | Hallazgo | Evidencia |
|---|---|---|---|
| S-1 | 🟠 Alta | **Inyección HTML por nombre de archivo en previews**: `previewCol.innerHTML = \`<iframe src="${filePath}" ...>\`` — un PDF nombrado `x"><img src=x onerror=…>` depositado en la carpeta de la empresa (¡que suele estar sincronizada en LAN/Drive!) ejecuta con el puente. Mismo patrón en `plan-viewer.js:555` | `modules/gestion-salud/evaluaciones-medicas/evaluaciones-medicas-logic.js:490-502` |
| S-2 | 🟠 Alta | Datos médicos especiales sin cifrar: `gestaciones`, `seguimiento_gestacion_mensual`, `seguimiento_incapacidad_caso/_registro` en SQLite plano | `main/gestacion-bridge.js:42-90`, `main/seguimiento-incapacidad-bridge.js:50,187` |
| S-3 | ⚪ Baja | `console.log` con nombre de gestante | `main/gestacion-bridge.js:489` |

### 3.5 Accidentes / FURAT (3.2.1)

| # | Severidad | Hallazgo | Evidencia |
|---|---|---|---|
| F-1 | 🟠 Alta | **`furat:delete-folder`**: el único guardia es que la ruta del renderer **contenga** el substring `"3.2.1"` → `C:\Users\x\Documents\3.2.1` pasa y se borra recursivamente, junto con `DELETE FROM furat_metadata` por prefijo. Sin token ni confirmación | `main/furat-bridge.js:527-533` |
| F-2 | 🟡 Media | `furat:upload-file`: el directorio destino lo manda el renderer (solo se verifica que exista); el nombre sí está bien saneado | `main/furat-bridge.js:103-247` |

### 3.6 Inspecciones (4.1)

| # | Severidad | Hallazgo | Evidencia |
|---|---|---|---|
| I-1 | 🟠 Alta | `inspeccion:abrirRuta` — `shell.openPath(targetPath)` con el string crudo del renderer (ejecuta cualquier binario) | `main/inspecciones-bridge.js:1599-1607` |
| — | ✅ | `inspeccion:archivar` resuelve rutas server-side y sanea componentes — correcto | `main/inspecciones-bridge.js:780-831` |

### 3.7 Roles y responsabilidades (2.1) / Matriz de peligros (2.2)

| # | Severidad | Hallazgo | Evidencia |
|---|---|---|---|
| R-1 | 🟠 Alta | `roles-resp:archivo-copiar`: `fs.copyFileSync(origen, destino)` con **ambas** rutas del renderer, sin restricciones (lectura+copia arbitraria) | `main/roles-responsabilidades-bridge.js:1190-1228, 1426` |
| R-2 | 🟡 Media | `matriz-peligros:reset` destructivo de una llamada sin token | `preload.js:1087` |

### 3.8 Presupuesto

| # | Severidad | Hallazgo | Evidencia |
|---|---|---|---|
| P-1 | 🟡 Media | Handlers Excel legacy de la sección 3.2 (D-5) afectan a presupuesto/proveedores/objetivos/plan de trabajo: crear/sobrescribir/leer cualquier ruta | ver D-5 |
| — | ✅ | SQL de presupuesto usa tablas de un arreglo hardcodeado — sin SQLi | `main/presupuesto-bridge.js:2220` |

### 3.9 Firma electrónica (firma-bridge + firma-service)

| # | Severidad | Hallazgo | Evidencia |
|---|---|---|---|
| FI-1 | 🟠 Alta | **firma-service escucha en `0.0.0.0:3001`** (`app.listen(config.port)` sin host): mientras la app corre, toda la LAN alcanza la mini-app pública de firma (`/s/:token`), los endpoints OTP y —con la clave— `/internal/*`; todo en HTTP claro (OTP y tokens sin cifrar en tránsito). El Caddyfile de deploy asume loopback, pero nada lo fuerza en modo escritorio | `firma-service/src/server.js:184`, `config.js:44` |
| FI-2 | 🟡 Media | **Bypass por clave legacy** en `/internal/*`: si la clave coincide con `INTERNAL_API_KEY` legacy, se autoriza sin scope de empresa ni lista de operaciones | `firma-service/src/middleware/authz.js` (documentado en el propio header) |
| FI-3 | 🟡 Media | `firma:sign-request:document`: `args.id` del renderer se interpola en la ruta de caché (`id + '-firmado.pdf'`) → escritura fuera de `firma-cache` + oráculo de existencia | `main/firma-bridge.js:1051-1066` |
| FI-4 | 🟡 Media | `firma:config:set-url` permite re-apuntar el backend de firma a cualquier URL (y las API keys se le enviarían); si se configura `http://<LAN-IP>:3001`, claves y PDFs viajan en claro | handler en `main/firma-bridge.js:~2205`; cliente `main/firma-client.js:14-22` |
| FI-5 | 🟡 Media | 320 MB de datos del servicio (13 BD sqlite) dentro del asar distribuido — ver CRIT-4 | verificado en `dist/win-unpacked` |
| — | ✅ | API keys de firma cifradas con `safeStorage`/DPAPI (`secrets.enc`), comparación constant-time de claves admin, helmet+CSP+rate limits (global 60/min, OTP 10/h, commit 3/min), PDF servido desde buffer (sin traversal), BD abierta `readonly` | `main/firma-bridge.js:18,77-100,2158,2290`; `firma-service/src/server.js:55-149`; `middleware/auth.js:39-53`; `routes/public.js:34,92,263-278`; `main/gestion-humana-bridge.js:2249-2256` |

### 3.10 Bandeja integrada (correo) — **el vector de ataque más realista**

| # | Severidad | Hallazgo | Evidencia |
|---|---|---|---|
| B-1 | 🟠 Alta | **Sanitizador HTML propio (blocklist) con huecos** para el cuerpo de correos: `javascript:` solo se filtra en `href`/`src` y sin decodificar (`jav&#x09;ascript:` lo evita); sin revisar `srcset/background/poster/action/formaction/xlink:href`; `style` permitido. DOMPurify 3.4.12 está instalado pero **no se usa**. El iframe de la bandeja es same-origin `file://` y accede al puente → un correo malicioso puede ejecutar script al hacer clic en un enlace | `renderer/bandeja-integrada/app.js:440-509, 638-639, 5606, 5636, 866-871` |
| B-2 | 🟠 Alta | **Módulos con escapes rotos (código muerto pero latente)**: `helpers.js`, `event-modal.js`, `compose-modal.js`, `render-mail-detail.js` tienen `H.esc()` corrompido (entidades HTML decodificadas; no compilan). Si se re-conectan, todo el listado de correo pierde escaping → XSS directo de remitente/asunto | `renderer/bandeja-integrada/helpers.js:96-100`, `event-modal.js:14`, `compose-modal.js:22,39,93,98`, `render-mail-detail.js:59` (verificado con `node --check`) |
| B-3 | 🟡 Media | Enlaces con esquemas no-`http(s)` (`file://`, `ms-msdt:`, handlers custom) **no se interceptan** y navegan el iframe de la bandeja (sin CSP propia) | `app.js:843-893`; iframe sin CSP: `renderer/bandeja-integrada/index.html` |
| B-4 | 🟡 Media | Permisos *fail-open*: si la API de permisos falla, la bandeja se abre igual | `renderer.js:1195-1209` |
| — | ✅ | Listado y notificaciones correctamente escapados (`H.esc`, `_esc`, `esc()` en toasts); texto plano escapado y linkificado con intercepción de clics | `render-mail-list.js:170-184`; `shared/kair-alerts.js:88-95,285-306`; `assets/js/update-notifications.js:48-121` |

### 3.11 Envío de remisiones / notificaciones por email

| # | Severidad | Hallazgo | Evidencia |
|---|---|---|---|
| E-1 | 🔴 Crítica | Contraseñas Gmail en el repo público — ver **CRIT-1** | `utils/emailSender.js:148-154` |
| E-2 | 🟡 Media | OAuth tokens de Google en texto plano dentro de `userData/config.json` (clave `googleOAuth`, incluye `refresh_token` de larga vida con scopes de Calendar + Gmail completos); además el token completo se devuelve por IPC al renderer al conectar | `shared/google-tokens.js:27-54`; `main.js:2443-2457`; `shared/google-auth.js:184` |
| E-3 | 🟡 Media | XSS reflejado en la página de callback OAuth: `${error}` interpolado sin escapar (explotable durante los 5 min de la ventana OAuth vía `127.0.0.1:42813/oauth2callback?error=<img onerror>`) | `shared/google-auth.js:304-306` |
| E-4 | ⚪ Baja | Validación de `state` CSRF saltable si el callback no trae `state` (PKCE mitiga) | `shared/google-auth.js:171-174` |
| — | ✅ | PKCE S256 + state aleatorio, callback solo en 127.0.0.1, timeout 5 min; tokens NO se guardan en SQLite (`email-sync.js:266-268` guarda nulls); sin tokens en logs | `shared/google-auth.js:103-147,341` |

### 3.12 Sincronización multi-equipo (sync hub)

| # | Severidad | Hallazgo | Evidencia |
|---|---|---|---|
| SY-1 | 🟠 Alta | **Sync sin autenticidad**: el transporte es una carpeta compartida (Drive/red); no hay firma ni HMAC en `empresa.kairsync`. Quien escriba en el hub inyecta/altera registros y con *last-write-wins* + `updatedAt` futuro se propagan a todos los pares en ≤5 min: **falsificación de datos médicos y de SST en toda la red de equipos** | `main/sync-service.js:8-10, 118-207, 240-269, 335-360` |
| SY-2 | 🟡 Media | **SQL con claves JSON no confiables**: `INSERT/UPDATE` construidos con `Object.keys(g)` del JSON del hub → una clave con coma inyecta asignaciones de columnas adicionales en la misma tabla (corrupción dirigida) | `main/sync-serializer.js:465-466, 476-477, 517-518, 537-538` |
| SY-3 | 🟡 Media | PII médica en JSON plano en el hub (+5 copias `.bak`) — legible por quien tenga acceso a la carpeta | `main/sync-service.js:240-269, 562-585` |
| SY-4 | 🟡 Media | `sync:configure` acepta cualquier ruta absoluta como hub → un renderer comprometido apunta el sync a cualquier carpeta/share y exporta la BD como JSON | `main/sync-bridge.js:118-131`, `sync-config-writer.js:52-58` |

### 3.13 Autenticación y usuarios (núcleo)

| # | Severidad | Hallazgo | Evidencia |
|---|---|---|---|
| A-1 | 🟠 Alta | **Admin por defecto `admin@kair.local` / `Admin123!`** sembrado automáticamente, sin cambio forzado | `main.js:822-832` |
| A-2 | 🟠 Alta | **Sin rate limiting ni lockout** en `auth-login-v1` → fuerza bruta a velocidad local ilimitada | `main.js:1472-1537` |
| A-3 | 🟠 Alta | **Escalada por heurística**: cualquier usuario sin roles cuyo email **contenga** "admin" recibe permisos globales de administración (crear/resetear usuarios, incluido el admin real) | `main.js:~926-941` (`isAdminByDefault = email.includes('admin')`) |
| A-4 | 🟡 Media | Sin auto-registro ni auto-recuperación de contraseña (solo admin resetea); sin barrido periódico de sesiones expiradas (1.569 filas en la BD de prod) | `main.js:883, 1540-1553` |
| A-5 | 🟡 Media | Token de sesión (8h) en `localStorage` — robable por cualquier XSS del renderer (refuerza B-1/N-1) | `renderer.js:505, 3551, 3615, 4133` |
| — | ✅ | Tokens de 256 bits con expiración 8h, bcrypt cost 10, queries parametrizadas en login/sesiones | `main.js:1472-1537, 872-905` |

### 3.14 Servicios locales — LLM (Python/Flask, puerto 5555)

| # | Severidad | Hallazgo | Evidencia |
|---|---|---|---|
| L-1 | 🟡 Media | **Todos los endpoints sin autenticación** (`/load`, `/analyze`, `/llm-config`, `/hf/download`, `/models/select`…): un proceso local puede reconfigurar la IA; y sin validación de Host, un sitio web con **DNS rebinding** puede descargar modelos arbitrarios de HuggingFace y alimentar `ollama create` (cadena de suministro de modelos) | `Portear/src/llm_server.py:91-92, 2241, 166-186, 1911-2046` |
| — | ✅ | Flask bound a `127.0.0.1` (no accesible por LAN); HF token solo por header y jamás persistido; subprocess en forma de lista con binario resuelto (sin shell injection); los demás scripts de Portear (ausentismo, accidentes) no abren red ni subprocess | `llm_server.py:92,1893,2046` |

### 3.15 Datos en reposo y privacidad (Ley 1581/2012)

| # | Severidad | Hallazgo | Evidencia |
|---|---|---|---|
| DR-1 | 🟠 Alta | **`kair.db` sin cifrar** (SQLite plano, WAL) en `%APPDATA%` con cédulas, salarios, **números de cuenta bancaria**, gestaciones, incapacidades, FURAT, buzones completos. Cualquier malware/backup en la nube lo lee | `main.js:485-488`; sin SQLCipher en todo el proyecto |
| DR-2 | 🔴 Crítica | Backups con PII listos para empaquetarse — ver **CRIT-4** | `backups/*.db` |
| DR-3 | 🟠 Alta | PII de clientes rastreada en git público — ver **CRIT-2** | `utils/*.xlsx`, `Portear/Utils/*.pdf` |
| DR-4 | 🟡 Media | `deleteAppDataOnUninstall: false`: la BD médica, `secrets.enc` y `config.json` sobreviven al desinstalar sin ruta de disposición final (retención indefinida contraria a principios de Ley 1581) | `package.json` → `build.nsis` |
| DR-5 | ⚪ Baja | `config.json` + credenciales se duplican en `config.json.bak` por los writers (ACL por defecto, sin `mode` restrictivo) | `main/sync-config-writer.js:109,147`; `company-config-writer.js:141,223` |
| — | ✅ | `backups/` y `firma-service/data/` **sí** están en `.gitignore` (verificado con `check-ignore -v`); logs de electron-log sin PII ni credenciales; `logs/dev_log.txt` y suite logs sin datos personales; `components/config` benigno | `.gitignore:55`; `firma-service/.gitignore:7` |

### 3.16 Configuración central

| # | Severidad | Hallazgo | Evidencia |
|---|---|---|---|
| C-1 | 🟠 Alta | **`save-config`** reescribe el `config.json` completo con lo que envíe el renderer (sin esquema ni merge): puede redefinir `companyPaths[*].root` — la raíz de confianza de decenas de handlers — y corromper config. El propio código lo llama "el peligroso save-config" | `main.js:1377-1407, 1442` |
| C-2 | ⚪ Baja | `company-nit:set`: `companyKey = "__proto__"` pasa el check de existencia → prototype pollution (valor validado como dígitos, impacto menor) | `main/company-config-writer.js:137` |
| — | ✅ | Los writers nuevos (`company-config-writer`, `sync-config-writer`) son correctos: escritura atómica tmp+rename, backup, whitelists de campos, NIT con regex; `configPath` jamás viene del renderer | `main/company-config-writer.js:40-68`; `sync-config-writer.js:60-110` |

---

## 4. DEPENDENCIAS (`npm audit`: 28 vulnerabilidades — 4 críticas, 17 altas, 7 moderadas)

Las que **afectan en runtime** a esta app (las demás son transitivas de build):

| Paquete | Severidad | Problema | ¿Se usa? |
|---|---|---|---|
| `xlsx` 0.18.5 | 🟠 Alta | CVE-2023-30533 (prototype pollution) + CVE-2024-22363 (ReDoS). Se ejecuta **en el renderer** parseando Excel externo (`evaluacion-proveedores.js:142`) | Sí — crítica |
| `@file-viewer/*` 2.2.4 (`doc`, `preset-office`, `web-full`) | 🔴 Crítica/Alta | DOM XSS en renderers DOC/word/geo. El bundle `flyfish-file-viewer-web-full.iife.js` renderiza documentos no confiables (Office/SVG/HTML/EML) **en la ventana privilegiada** con el puente | Sí — crítica |
| `nodemailer` 8.x | 🟠 Alta | Opción `raw` a nivel de mensaje puede eludir `disableFileAccess` → lectura arbitraria de archivos si se pasa input no confiable a esa opción | Revisar uso |
| `electron` 37.3.0 | 🟠 Alta | AppleScript injection (macOS) + service worker spoof de `executeJavaScript` | Sí |
| `extract-zip` / `tar` | 🟠 Alta | Symlink path traversal / DoS — transitivas de electron-builder (riesgo en build, no runtime) | Build |
| `dompurify` (embebido en flyfish) | 🟡 Mod. | Hook IN_PLACE deja subárbol ejecutable | Embebido |
| `mermaid`, `markdown-it`, `postcss`, `image-size`, `qs`, `js-yaml`, `@xmldom/xmldom`, `exceljs`, `uuid`, `brace-expansion`, `fast-uri`, `undici`, `sanitize-html` (dev) | 🟡/🟠 | DoS/ReDoS/prototype pollution varios | La mayoría solo dentro del bundle flyfish o build |

**Acción:** `npm audit fix` + actualizar `xlsx` a ≥0.19.3 (o migrar a `exceljs`, que ya está en el proyecto, para parsing no confiable), vigilar releases de `@file-viewer`, y re-renderizar documentos no confiables fuera de la ventana privilegiada (sandbox).

---

## 5. LO QUE ESTÁ BIEN HECHO (verificado)

- **Sin inyección SQL**: ~350 `prepare()` revisados — 100% parametrizados; los dos SQL dinámicos usan whitelists de campos hardcodeados.
- **Sin inyección de comandos**: cero `shell:true`; todos los `spawn/execFile` usan arrays de argv; los PIDs de `taskkill` son internos; WhatsApp sender sanea a dígitos + `encodeURIComponent`.
- **Base de Electron correcta**: `nodeIntegration:false`, `contextIsolation:true`, sandbox por defecto (Electron 37), ventana de impresión con `sandbox:true` y sin preload.
- `open-external-url` valida esquema http/https; `mantenimiento` neutraliza traversal con `path.basename()` por segmento; `furat` sanea nombres de archivo correctamente.
- firma-service: helmet con CSP estricta, rate limiters por capas, zod, sin CORS (bloquea lectura cross-origin de navegadores), comparación constant-time de claves.
- Google OAuth: PKCE + callback loopback-only; refresh token jamás escrito en SQLite ni en logs; HF token nunca persistido.
- Config writers nuevos con escritura atómica + backup + whitelist.
- `backups/` y `firma-service/data/` correctamente gitignored; sin secretos en logs.

---

## 6. PLAN DE REMEDIACIÓN PRIORIZADO (pre-deploy)

### Hoy (antes de tocar cualquier otra cosa)
1. **Rotar las 5 contraseñas de aplicación de Gmail** y extraer las credenciales de `utils/emailSender.js` a `safeStorage` (patrón `secrets.enc` ya existente). Purgar historial de git (BFG) y rotar también el client secret de Google si se considera expuesto.
2. **Retirar del repo los documentos de clientes y PDFs personales** (`utils/*.xlsx|docx|pdf`, `Portear/Utils/*.pdf`) + purga de historial.

### Esta semana (bloqueos de deploy)
3. Confinar el sistema de archivos: crear helper único `safeResolve(baseDir, untrusted)` (resolve + verificación de `realpath` con prefijo) y aplicarlo a: `open-path`, `upload-document`, `delete-document`, `read-file-bytes`, `download-document`, `get-pdf-preview`, `read-directory`, `roles-resp:archivo-copiar`, `inspeccion:abrirRuta`, `furat:delete-folder/upload-file`, `gh:subir-adjunto-comunicacion` (`referenciaId`!), firma-cache (`args.id`), handlers Excel legacy, `generate-*-acta`.
4. Build como allowlist: excluir `backups/`, `firma-service/data/`, `.env`, `utils/` (documentos), `Temp/`, `previews/`, tests, `!**/*.bak*`. Aplicar **Electron fuses** + firma de código + `publisherName` + `verifyUpdateCodeSignature`.
5. Endurecer correo: reemplazar el sanitizador propio por **DOMPurify** (ya está en node_modules) con allowlist estricta, o renderizar el HTML del correo en iframe **sandbox sin puente**; interceptar TODOS los esquemas de enlace; eliminar/borrar los 4 módulos con escapes rotos.
6. Navegación: `will-navigate` (deny salvo file:// propio) + `setWindowOpenHandler` (deny/`openExternal`) + `sandbox:true` explícito.
7. Auth: eliminar el seed `Admin123!` (o forzar cambio en primer login), rate limiting con lockout en `auth-login-v1`, y eliminar la heurística `email.includes('admin')`.
8. Activar auth real (no soft) en `gh:*` y en todos los canales destructivos; reemplazar `save-config` por writers por-campo (patrón `company-nit`).

### Próximas 2-4 semanas
9. Cifrado en reposo (SQLCipher o cifrado a nivel de archivo para `kair.db`), tokens OAuth al keychain/safeStorage, reconsiderar `deleteAppDataOnUninstall`.
10. Firma/HMAC de los archivos `.kairsync` + whitelist de columnas en `sync-serializer.js`.
11. firma-service: `app.listen(port, '127.0.0.1')` en modo escritorio, retirar el bypass de clave legacy, exigir https en configuración de URL.
12. CSP sin `'unsafe-inline'` ni CDNs (self-host de three/vanta/chart/bootstrap + SRI) + CSP en bandeja/config/seguimiento.
13. Actualizar `xlsx` ≥0.19.3, `@file-viewer` cuando haya fix, `npm audit fix` del resto; permitirlist de canales en `preload.js` (`send`/`onIpcMessage`); autenticación básica en el LLM server (token en header) + validación de Host.

---

## 7. NOTA METODOLÓGICA Y LIMITACIONES

- Auditoría estática de caja blanca sobre el árbol de trabajo de la rama `Dev-Pc` al 2026-09-29, más inspección del artefacto `dist/win-unpacked` (v0.1.196) para confirmar qué viaja en el instalador. No se ejecutaron exploits activos contra sistemas de terceros; las cadenas de explotación descritas son escenarios de riesgo, no pruebas de concepto ejecutadas.
- Se revisaron los 205 handlers IPC de `main.js`, ~190 adicionales en bridges, 564 funciones del preload y los sinks principales del renderer; la cobertura de `renderer.js` (324 KB) y de los ~9 submódulos HTML en `modules/` es por muestreo dirigido de sinks (`innerHTML`, `iframe src`, `postMessage`), no exhaustiva línea a línea.
- El instalador analizado (0.1.196) es anterior a los cambios en curso; los riesgos de empaquetado se validaron simulando los globs de electron-builder sobre el árbol actual.

*Informe generado como parte del ciclo de desarrollo de K+AIR — uso interno del propietario del proyecto.*
