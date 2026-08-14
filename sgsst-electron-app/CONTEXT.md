# K+AIR — Contexto del Proyecto

**Última actualización:** 14 de agosto de 2026
**Versión actual:** 0.1.178 (próximo release) — publicado v0.1.166
**Tipo:** Aplicación empresarial Electron para SG-SST (Colombia)
**Stack:** Electron 37 + vanilla JS + Python 3.11.9 (empaquetado) + SQLite (kair.db)

> **🆕 v0.1.178 (📦705 — feat(roles-resp): nueva vista 1.1.2 Roles y Responsabilidades con formato Excel G-OD-006 de la empresa + 9 fixes):** Reemplazo completo del file viewer del submódulo 1.1.2 por una vista de gestión que cumple con el estándar 1.1.2 de la Resolución 0312 de 2019 y el Decreto 1072 de 2015 art. 2.2.4.6.8. **Causa**: el file viewer anterior NO satisfacía los requisitos; el informe de auditoría de Tempoactiva 2024 marcó el 1.1.2 como "No cumple". El user pidió que la matriz se parezca al formato de su empresa (Excel G-OD-006 "Matriz de Asignación y Documentación Responsabilidades y Rendición de Cuentas", REV.02 Enero 2018), 4 columnas: NIVEL / RESPONSABILIDADES / AUTORIDAD / RENDICION DE CUENTAS. **8 archivos, ~2900 líneas nuevas, 9 fixes iterativos**: (1) `main/roles-responsabilidades-bridge.js` (NUEVO, ~660 líneas) — 14 handlers IPC + schema SQLite con 3 tablas + seed de **8 roles del Excel G-OD-006** (no los 9 del Decreto 1072 originales) + 3 file dialogs nativos (origen/destino/descarga) + handler de copia con sufijo `(1)`, `(2)` si el destino ya existe + `BrowserWindow.fromWebContents()` como parent del dialog (foco correcto) + migración de schema idempotente con `PRAGMA table_info` + `ALTER TABLE ADD COLUMN` (auto-corre en próximos deploys). (2) `preload.js` (+14) — 14 APIs en `window.electronAPI.rolesResp`. (3) `main.js` (+7) — require + register. (4) `roles-responsabilidades-view.html` (NUEVO, ~250 líneas) — iframe con 2 tabs (Gestión de Roles + Documentos de soporte), banner de cumplimiento, matriz de roles con los 8 roles del Excel + estados (vigente/pendiente/N/A), **modal Matriz con 4 columnas** (Responsabilidades / Autoridad / Rendición / Base legal), matriz de divulgación con captura uno-a-uno, fecha editable, **modal "Subir soporte PDF" completo** con drag&drop zone + 2 botones Examinar (origen y destino) + chips visuales con nombre corto + tooltip con ruta completa + botón "Copiar y marcar aceptado", **tab Documentos de soporte** con badge de conteo + tabla de PDFs subidos con Ver/Descargar, exportar reporte PDF. (5) `roles-responsabilidades-viewer.js` (NUEVO, ~620 líneas). (6) `roles-responsabilidades-view.css` (NUEVO, ~470 líneas) — chips, dropzone, badges. (7) `roles-responsabilidades-logic.js` (+90) — proxy postMessage para bypassear contextIsolation. (8) `renderer.js` (+5) — filtro de ruido en consola para `kair-rr-*`. (9) `main/sync-serializer.js` (+140) — sync multipc. **8 roles predefinidos del Excel G-OD-006** (reemplazan los 9 del Decreto 1072, que se desactivan automáticamente): REPRESENTANTES DE LA ALTA DIRECCION, JEFES DE AREA, TRABAJADORES, RESPONSABLE DEL SG SST, VIGIA DE SEGURIDAD Y SALUD EN EL TRABAJO COPASST, COMITÉ DE CONVIVENCIA LABORAL, BRIGADA DE EMERGENCIAS, CONTRATISTAS. **9 fixes aplicados**: (1) migración idempotente de schema; (2) BD migrada con 8 roles Excel + 9 viejos desactivados; (3) bridge IPC via postMessage (bypassea contextIsolation); (4) listener de mensajes en `window` (no `window.parent`); (5) funciones abrirModalMatriz/cerrarMatriz que faltaban; (6) `process.env.USERNAME` no existe en iframe; (7) prompt() reemplazado por mini-modal con chips; (8) drag&drop + examinar en modal Subir soporte; (9) BrowserWindow parent para file dialogs; (10) tab Documentos de soporte con Ver/Descargar. **Patrones guardados en memoria** (cross-project): iframe + electronAPI requiere inyección manual + polling porque el `contextBridge` proxy no se transfiere entre contextos; file dialogs de Electron NECESITAN `BrowserWindow.fromWebContents()` como parent o se pierden detrás del modal HTML. **Causa**: el file viewer anterior (carpeta con PDFs sueltos) NO satisfacía los requisitos; el propio informe de auditoría de Tempoactiva 2024 marcó el 1.1.2 como "No cumple". **Cambios (8 archivos, ~2400 líneas nuevas)**: (1) `main/roles-responsabilidades-bridge.js` (NUEVO) — 10 handlers IPC + schema SQLite con 3 tablas (catalogo + asignacion + divulgacion) + seed de 9 roles predefinidos. Patrón `registerXxxHandlers(app, deps)`. Estado de divulgación **calculado automáticamente** según `documento_soporte_path IS NOT NULL` (aceptado si hay PDF, pendiente si no). Reporte PDF con `pdf-lib` (3 páginas: portada + matriz + divulgación). (2) `preload.js` (+12) — expone `window.electronAPI.rolesResp` con 10 APIs. (3) `main.js` (+7) — require + register del bridge. (4) `modules/recursos/roles-responsabilidades/roles-responsabilidades-view.html` (NUEVO) — iframe con 2 tabs (Gestión de Roles + Documentos de soporte), banner de cumplimiento con barra de progreso, matriz de roles con 9 roles + estados (vigente/pendiente/N/A), matriz de divulgación con captura manual uno-a-uno, fecha editable, modal de asignar/reasignar, modal de añadir trabajador, upload de PDF de soporte, exportar reporte PDF con diálogo de guardado. (5) `roles-responsabilidades-viewer.js` (NUEVO, ~370 líneas) — toda la lógica de la vista. (6) `roles-responsabilidades-view.css` (NUEVO) — namespace `kair-rr-*`. (7) `main/sync-serializer.js` (+140) — serialize/deserialize de las 2 tablas por empresa (el catálogo NO se sincroniza — es el mismo para todas las empresas). (8) `package.json` — bump 0.1.177 → 0.1.178. **Catálogo de 9 roles predefinidos** (basado en Decreto 1072 art. 2.2.4.6.8): Representante Legal, Responsable del SG-SST, COPASST (si >10), Comité de Convivencia (si >10), Brigadas de Emergencia, Auditor Interno, Trabajadores en General, Encargado SG-SST ante la ARL, Supervisor de Seguridad y Salud. Los roles predefinidos NO se pueden eliminar (solo desactivar), pero sí editar. CRUD completo para roles personalizados.

> **🆕 v0.1.177 (📦704 — feat(ui): abreviaciones de títulos de módulos en el tablero principal):** El user pidió que los títulos de los 7 módulos del tablero principal se vieran abreviados para que entren todos en una sola fila. Los títulos largos (`Gestión Integral`, `Gestión de la Salud`, `Gestión de Peligros y Riesgos`, `Gestión de Amenazas`) se cortaban con ellipsis o bajaban a la fila 2 según el ancho de la ventana. **Cambios (1 archivo, `renderer.js`)**:
> - **Abreviaciones (campo `shortName` agregado al array `modulesData`)** — el `name` largo se mantiene intacto porque se usa como key lógica en `moduleMap`, `moduleTaskMap`, `filterDashboardTasksByModule`, `data-module-name` / `data-module` en handlers, y match con el sidebar. Cambiar el `name` directo habría roto toda la lógica de filtrado, badges y match. Mapeo: `Recursos` → `Recursos`, `Gestión Integral` → `Gest. Integral`, `Gestión de la Salud` → `Gest Salud`, `Gestión de Peligros y Riesgos` → `Gest. Pel. y Riesgos`, `Gestión de Amenazas` → `Gest. Amenazas`, `Verificación` → `Verificación`, `Mejoramiento` → `Mejoramiento`. El render del `<h4>` ahora muestra `${mod.shortName || mod.name}` con `title="${mod.name}"` para que al hacer hover se vea el nombre completo como tooltip.
> - **Modo ventana** (`@media (max-width: 1199px)`): `min-width: 220px → 135px`, `flex-basis: 220px → 135px`, `padding: 6px 10px → 6px 8px`, `h4 font-size: 12px → 11px`, `icon: 24px → 22px`. Cálculo: 7 cards × 135 + 6 gaps × 6 = ~981px → entra en ventanas de 1000+px. ANTES 4 módulos en fila 1 + 3 en fila 2 → DESPUÉS 7 módulos en 1 sola fila (validado visualmente por el user).
> - **Modo maximizado** (`@media (min-width: 1200px)`): `min-width: 165px → 140px`, `flex-basis: 165px → 140px`. Cálculo: 7 cards × 140 + 6 gaps × 12 = ~1052px → entra en maximizado (1200+px). ANTES los 7 en 1 fila pero con títulos largos cortados con ellipsis → DESPUÉS los 7 en 1 fila con títulos abreviados completos.
> - **Lo que NO cambió**: el `name` largo sigue siendo el key lógico de filtrado, badges y match con el sidebar. El subtitle sigue oculto en ventana y visible en maximizado. La lógica de filtrado (`filterDashboardTasksByModule`) sigue funcionando igual.
> - **Nota visual menor**: en ventana, el título `Gest. Pel. y Riesgos` puede verse ligeramente truncado con ellipsis si la ventana está cerca del límite. Aceptable — el nombre completo se ve en el tooltip al hacer hover. Si se quiere siempre completo, próxima iteración puede acortar a `Gest. Peligros` o ajustar más el min-width.

> **🆕 v0.1.176 (🐛 fix(bandeja): cumplido se desmarca solo ~60s después de marcar):** Bug visible del user en la Bandeja Integrada: al marcar un evento de Google Calendar (gcal-*) como cumplido, el ✓ aparecía al instante pero desaparecía ~1 minuto después sin que tocara nada. La BD SÍ tenía el registro (verificado con sqlite3 directo), el problema era de UI/render. **Causa raíz** (descubierta con test E2E con mock del adapter): el adapter del calendario SÍ construye un `cumMap` interno con los IDs `gcal-*` desde la BD y enriquece los eventos de SU lista base, **PERO el adapter NO incluye los eventos de Google Calendar en su lista base** — esos llegan al frontend DESPUÉS via `loadEventsFromGoogle()` y se concatenan al array sin enriquecer. Resultado: los `gcal-*` quedan con `cumplido: undefined` en `state.events` → `renderBigCalendar()` no muestra el ✓. El `autoRefreshInterval` cada 60s reemplaza `state.events = events` y re-triggeriza el bug. El ✓ solo se mantenía entre marcar y el primer refresh (60s) porque las líneas 2228-2231 seteaban `ev.cumplido = true` directamente en el `state.events` local. **Fix (3 archivos, +16/-0)**: (1) `shared/kair-calendar-adapter.js:290` — el adapter ahora expone el `cumMap` en la respuesta (`return { success: true, data: merged, cumMap: cumplidosMap }`). Backward-compatible: KairCalendar embebido y KairAlerts solo leen `res.data`. Version bump 1.2.0 → 1.3.0. (2) `renderer/bandeja-integrada/app.js:1158` (loadEventsFromIPC) — captura `var cumMapFromAdapter = (result && result.cumMap) || {}` después de `adapter.list()`. (3) `renderer/bandeja-integrada/app.js:1185-1198` (loadEventsFromIPC) — después de obtener `gcalEvents` via `loadEventsFromGoogle()`, los enriquece con `cumplido: true` si su `id` está en el `cumMapFromAdapter`. **Fix complementario** del UPSERT que también era parte del problema raíz: `eventos-cumplidos-bridge.js:180-186` — el UPSERT ahora incluye `empresa_id = excluded.empresa_id` (antes solo actualizaba `cumplido_en` y `nota`, así que si el frontend pasaba `empresaId=null` después de un valor real, el registro quedaba con `empresa_id=NULL` y la query `WHERE empresa_id = 'X'` nunca matcheaba). `eventos-cumplidos-bridge.js:99-122` — migración one-shot en `_ensureSchemaMigrated` que infiere la empresa del prefijo del `evento_id` para los NULLs (`SUBSTR + INSTR`, idempotente). **`_refreshCumplidosEnCalendario()` huérfano** del 📦694-fix4 ahora se llama desde el handler de marcar cumplido (`app.js:2278-2286`) como defensa en profundidad. **Test E2E con mock del adapter** (con los IDs reales de la BD del user): `gcal-5bvf8h8gnv2uikietqj29r8goc → cumplido=true` ✓ y `gcal-65nf5uvbcsmidkb8099j9qi62u → cumplido=true` ✓. **Lección guardada en agent memory (cross-project)**: cuando un adapter/componente calcula un enrichment (cumMap, colorMap, etc.) para su lista interna, EXPONER ese enrichment en la respuesta si hay OTROS consumidores (Google, sync, etc.) que también quieren enriquecer. Patrón: `return { success, data, derivedMaps }` en vez de `return { success, data }`.

> **🆕 v0.1.175 (📦702 — Permisos de Bandeja Integrada por usuario):** Hasta ahora el iframe de la Bandeja Integrada estaba disponible para todos los usuarios logueados. Ahora el admin puede condicionar el acceso desde **Configuración > Gestión de Usuario** con un toggle "Acceso a Bandeja Integrada" al lado del campo Rol. **Backend** (`bandeja-integrada-permissions-bridge.js`, nuevo): 2 handlers IPC + migración idempotente (`ALTER TABLE users ADD COLUMN bandeja_integrada_enabled INTEGER NOT NULL DEFAULT 0`) + admin global SIEMPRE forzado a `enabled: true` + extensión con `userId` opcional para que admin pueda ver/modificar el flag de otros users. Validaciones: no-admin no puede consultar flags ajenos (`PERMISSION_DENIED`); admin no puede deshabilitar a otro admin (`CANNOT_MODIFY_ADMIN`). **Frontend**: `toggleBandejaIntegrada()` chequea permisos antes de abrir el iframe; si no tiene acceso, muestra alert 🔒 con instrucciones. Fail-open defensivo (si la API no está disponible, abre por defecto). **UI**: nuevo toggle switch estilo iOS en el modal de Gestión de Usuario; si rol=Admin, switch prendido+disabled con label "🔒 Siempre habilitado para administradores". **Step 5 (visibilidad del botón)**: después del primer commit del feature, el botón del sobre en el header seguía visible para users sin acceso. Causa raíz doble: (1) la función corría ANTES del login con `authToken=null`; (2) fail-open original dejaba el botón visible. Fix: fail-**CLOSED** (oculta cuando no se puede determinar) + re-evaluar después del login/logout. Admin global: backend fuerza `enabled: true` → siempre visible. No-admin con flag=0: oculto. **Bug fix crítico del bridge**: la firma era `(getDb, validateSession)` pero `main.js` la llamaba como `(app, { getDb, validateSession })` — la convención del proyecto es `(app, deps)`. Por la firma incorrecta, `_validateSession` quedaba como objeto (no función), el chequeo `typeof === 'function'` fallaba y el handler retornaba `AUTH_REQUIRED`. Síntoma visible: el alert "🔒 No tienes acceso" se mostraba incluso siendo admin. Fix de 1 línea efectiva + lección guardada en memoria cross-project.

> **🆕 v0.1.175 (📅 feat(cal-cap): solo mostrar capacitaciones con hora en el calendario):** Hasta ahora el calendario de la Bandeja Integrada mostraba TODAS las capacitaciones con fecha, asignándoles 09:00 por default a las que no tenían hora en el sidecar de localStorage — llenaba el calendario de "eventos fantasma" sin horario real. Causa: el filtro del backend (`_leerCapacitacionesDeEmpresa` en `main.js`) solo descartaba caps sin fecha, no las sin hora. **Fix (3 archivos, +44/-5)**: (1) **Backend** `main.js:5377-5380`: nuevo contador `skippedNoHora` + filtro `if (!start || !end) { continue; }` antes del `events.push()`. Log mejorado con el nuevo contador. (2) **UI del modal** `capacitaciones-view.html:266-284`: input `#trainingHora` removidos `required` y `value="09:00"`. Label: "Hora *" → "Hora (opcional)". Help text nuevo. Botón nuevo `#clearTrainingHora` con SVG inline de papelera para limpiar la hora con un click. (3) **Lógica** `capacitaciones-logic.js:413, 252-265`: prefill del modal cambió a `cap.hora || ''` (string vacío si no tiene hora). Handler del botón nuevo. **Flujo end-to-end** (verificado por el user): cap con hora → aparece en calendario; editar → click 🗑️ → input vacío → Actualizar → cap desaparece del calendario (Listado sigue mostrándola con "—"). **Antes vs después**: ANTES 41 eventos capacitación visibles (todos a 09:00) → DESPUÉS solo los que tienen hora en el sidecar (2 inicialmente). **Lo que NO cambió**: el Excel no tiene columna HORA — la hora se persiste en localStorage (`kair-cap-horas`) desde el modal. Listado del módulo Capacitaciones sigue mostrando todas. Adapter del calendario no necesitó cambios. **Bug latente detectado** (no fix acá): `colDuracion` referenciada pero no definida → `durH` siempre queda en 2h.

> **🆕 v0.1.174 (📦608 — File-viewer: integración completa + 6 fixes críticos):** 9 fixes iterativos al file-viewer.js y a los visualizadores de las 12 secciones (3.1.6, 1.1.1, sociodemografica, politica, copasst, comite-convivencia, capacitacion-copasst, afiliacion, trabajo-alto-riesgo, roles-responsabilidades, curso-virtual, manual-proveedores). Causa raíz triple: (1) `Ve(filename)` del bundle interpreta `#` como fragmento de URL — pasar `type` attribute explícito lo soluciona; (2) CSS del panel padre sin `min-height: 0` cortaba el documento — `:has(flyfish-file-viewer)` aplica el fix solo cuando hay file-viewer; (3) `!important` del bundle ganaba a nuestro `!important` — `setProperty(..., 'important')` lo sobrescribe. Regla cross-project guardada en memoria: cuando un hijo tiene `flex: 1`, TODOS los ancestros flex hasta el que tiene `height` definido necesitan `min-height: 0` + `overflow: hidden`.

> **🆕 v0.1.173 (📦701-fix12 — Bandeja Integrada: fix reply en Enviados):** Al abrir un correo de Enviados y click en "Responder" o "Responder a todos", el campo "Para" mostraba un chip con el email del propio usuario (visible como "m" o el primer carácter porque el chip tiene `max-width: 180px` con ellipsis). **Causa raíz**: `openComposeModal()` usaba `mail.senderEmail || mail.sender` para el "To", pero en Enviados `senderEmail` es el email del PROPIO user, no el destinatario original. **Fix**: usar `getMailDisplayContact(mail)` que ya manejaba este caso correctamente (línea 301) — en SENT retorna el destinatario original, en INBOX retorna el remitente. Reply all también arreglado (antes podía incluir tu propio email en CC).

> **🆕 v0.1.172 (📦701-fix10 — Scroll INTERNO en los home de módulos principales):** En modo ventana, el home de un módulo (widgets + charts + lista de submódulos) puede no caber en el viewport. **Fix de 2 capas con CSS puro** (sin tocar JS): (1) contenedor padre (`.module-content-area` + `.main-canvas`) tiene `overflow: hidden` — sin scrollbar externa; (2) contenedor del home (`.gestion-integral-home`, etc.) tiene `overflow-y: auto` con `scrollbar-width: thin` y `scrollbar-color` semi-transparente — scrollbar INTERNA de ~8px dentro del home. Cubre los 7 módulos principales (4 clases de home). Iteración: primero probé reducir tamaños (rechazado), después scroll en padre (traía scrollbar externa de vuelta), final fue `hidden` en padre + `auto` fino en home.

> **🆕 v0.1.171 (📦701-fix9 — Footer minimalista: solo en pantalla de inicio, blanco sobre Vanta):** El footer negro con copyright y versión se quitó de la app principal y de la Bandeja Integrada para ganar espacio vertical (~25px en cada vista). Ahora solo aparece en la pantalla de inicio (splash + login + selección de empresa) flotando sobre el Vanta con texto blanco. **Implementación con CSS puro** usando `:has()` (selector moderno soportado en Electron 37 / Chromium 118+): `#app-footer { display: none !important; }` por defecto, `#app:has(.vanta-fullscreen) #app-footer { display: flex; position: fixed; bottom: 0; ... }` cuando hay Vanta con fondo transparente y texto blanco. El mismo patrón se aplicó al footer de la Bandeja Integrada (`.kair-footer { display: none !important; }`). **Bonus** — el bug oculto que se arregló: el selector original `.vanta-fullscreen #app-footer { display: none; }` NUNCA funcionó porque `vanta-fullscreen` se aplica a `.main-container` (sibling del footer, no ancestro). La regla con `:has()` sí matchea porque `#app` es el ancestro común. **Trade-off**: el dot de updates del footer desaparece; sigue accesible desde Configuración > Acerca de la App.

> **🆕 v0.1.170 (📦701-fix8 — Seguimiento Incapacidades: fix cédula display vs BD):** Fix regresión crítica. Al reabrir un caso existente de seguimiento de incapacidades, la cédula llegaba al bridge con formato de display (`1,044,392,755`) pero en la BD está sin formato (`1044392755`). La query `WHERE cedula = '1,044,392,755'` retornaba 0 filas, el código pensaba que no había caso y abría panel para caso nuevo (vacío). **Fix defense in depth en 2 capas**: (1) renderer normaliza antes de enviar al bridge con `.replace(/,/g, '').replace(/\./g, '').trim()`; (2) bridge también normaliza dentro del handler para proteger a cualquier otro caller. **Lección guardada en memoria**: cualquier query de BD que reciba cédulas/documentos desde un input de usuario o campo display SIEMPRE debe normalizar a la entrada.

> **🆕 v0.1.169 (📦701+fix6+fix7 — Informe PRI: casos de BD incluidos + timezone fix):** El handler `get-pri-seguimiento-data` solo leía casos del Excel legacy (PRI.xlsx) → los casos guardados en SQLite (vía el flujo nuevo de seguimiento de incapacidades) NO aparecían en el informe. **Fix**: el handler ahora consulta `seguimiento_incapacidad_caso WHERE empresa_id = ?` y `seguimiento_incapacidad_registro WHERE caso_id = ?` para incluir tanto el caso como sus seguimientos, mapea a las 173 columnas del Excel (convención fecha en `colIdx[seguimiento N]`, descripción en `colIdx + 1` columna adyacente sin header propio) y los inserta al final de `result.rows` evitando duplicados por cédula normalizada. **Bonus**: fix de timezone en `formatDate` del informe (`new Date("2026-04-01")` se interpretaba como UTC midnight → mostraba día anterior en Colombia UTC-5, ahora detecta YYYY-MM-DD puro y agrega `T00:00:00` para medianoche local). **Bonus 2**: `determinarEstadoCaso` ahora considera el caso de BD (LORAINNE pasa de "Sin Iniciar" a "En Seguimiento").

> **🆕 v0.1.168 (📦701+705+706+fix5 — Seguimiento Incapacidades: bug fixes críticos):** Resuelve múltiples bugs introducidos en v0.1.166/v0.1.167 en el flujo de seguimiento en SQLite. **El más grave (📦701-fix3)**: schema de `seguimiento_incapacidad_caso` tenía 2 columnas duplicadas (`origen_dx2` y `origen_dx3`) en las secciones Incapacidad y Calificación — SQLite rechazaba `CREATE TABLE` con `duplicate column name: origen_dx2` y el try/catch silenciaba el error → las tablas NUNCA se creaban → cada guardar salía con `no such table`. Fix: renombrar columnas de Calificación a `origen_dx_calificada{1..4}` (más semántico). **📦701-fix4**: al reabrir caso existente se abría panel vacío (buscaba en Excel legacy, no en BD). Fix: nuevo handler `buscarPorCedula` + búsqueda en SQLite primero. **📦706-fix2**: error "[object Object]" al guardar (objeto error concatenado a string). Fix: extracción defensiva con 4 paths + try/catch para circular refs. **📦701-fix5**: tabla de seguimiento no se actualizaba con seguimientos nuevos. Fix: `calcularPorcentajeAvance` toma el MÁX entre Excel y BD. **Otros fixes**: bloqueo de click en nav atenuado, banner BD con "guardado" no "saved", default "NO" en clasificación, mapeo de IDs reales del HTML, `_expandirCaso(row, regs)` no `(empresaId, row)`, `agregarSeguimiento` no `renderSeguimientos`, alias de export en el bridge.

> **🆕 v0.1.167 (📦702+703+704 — Seguimiento Incapacidades: banner BD + lista de casos + auto-hide header):** FASE 2 y 3 del flujo de seguimiento de incapacidades en SQLite. **📦702 — Banner BD**: 4 estados visuales en el panel de seguimiento (is-unsaved gris, is-saved verde, is-exported azul, is-error rojo) con texto contextual ("Guarda el caso primero. Luego puedes exportarlo a Excel con un click" cuando no hay guardado). **📦703 — Lista de casos en BD**: vista nueva que muestra todos los casos guardados en SQLite con badges de estado (Pendiente/En Seguimiento/Cerrado), columna de última modificación, botón "Cargar caso" para re-abrir. **📦704 — Auto-hide header**: el header del panel de seguimiento se oculta automáticamente después de 30s de inactividad (optimización de espacio). Solo se resetea si el count de casos sube (no en polling del mismo count).

> **🆕 v0.1.166 (📦701 — Seguimiento Incapacidades: respaldo en SQLite FASE 1):** FASE 1 del nuevo flujo de seguimiento de incapacidades que respalda los datos en SQLite (kair.db) en paralelo al Excel legacy. Schema nuevo: `seguimiento_incapacidad_caso` (1 fila por caso, ~80 columnas normalizadas con UNIQUE por empresa+cedula+fechas) + `seguimiento_incapacidad_registro` (N filas por caso, FK con CASCADE, 1 fila por seguimiento con fecha/tipo/descripcion/profesional/recomendaciones/proxima_cita). Bridge IPC con 6 handlers: `guardar`, `listar`, `obtener`, `eliminar`, `exportarExcel`, `exportarTodos`. Flujo de sincronización bidireccional SQLite ↔ Excel: SQLite es la fuente de verdad, Excel se actualiza con un botón "Exportar a Excel" desde la UI. Tabla normalizada con columnas separadas (como pidió el user). No se migran datos existentes — se empieza desde hoy. Patrón de bridge: tabla principal + tabla de detalles, UNIQUE constraint por combinación natural, índices por empresa/estado/cédula, helpers `_aplanarCaso` (DB row → frontend JSON) y `_expandirCaso` (frontend JSON → DB row).

> **🆕 v0.1.165 (📦700 — fix updater: asar: true):** Fix crítico del sistema de updates. Con `asar: false`, electron-updater dejaba archivos viejos sin reemplazar. Con `asar: true` + `asarUnpack` para los 5 patrones (better-sqlite3, ffmpeg, .node nativos, scripts Python, dlls), ahora el instalador reemplaza TODOS los archivos correctamente. `findPython()` usa `process.resourcesPath` cuando `app.isPackaged` para encontrar el script Python dentro del asar.

> **🆕 v0.1.164 (📦699 — Dashboard: reorganización del home de empresa):** Rediseño del home de empresa con cards reagrupadas, KPIs más prominentes, jerarquía visual clara. Quick actions para los módulos más usados (Gestión de la Salud, Ausentismo, Bandeja Integrada, FURAT).

> **🆕 v0.1.163 (📦698 — fix Plan de Trabajo: math del dashboard + 0 vencidas + dona del home):** Fix crítico de 3 problemas en el submódulo 2.4.1 Plan de Trabajo Anual y su reflejo en el home de Gestión Integral. **Problema 1**: la cinta del dashboard mezclaba unidades — "Programadas" contaba ACTIVIDADES (filas del plan = 106) pero "Realizadas"/"Pendientes"/"Vencidas" contaban CELDAS (marcas por mes = 115/139/0), dando la impresión de que 115 > 106 era "imposible" cuando en realidad 1 actividad con C en 2 meses = 2 celdas-C. **Problema 2**: `overdueCount` NUNCA se incrementaba (la variable existía pero el bloque para sumar 1 por celda con 'P' en mes pasado no estaba). **Problema 3**: la dona "Avance del Plan Anual SST" del home usaba `stats.actividadesEjecutadas` (38, conteo de actividades) + `actividadesProgramadas: 197` (hardcoded), mostrando 36% inconsistente con el dashboard 44%. **Fix**: 4 funciones del dashboard cuentan ahora CELDAS en lugar de actividades (Programadas/Realizadas/Pendientes/Vencidas), `overdueCount` se calcula correctamente (`P` en mes anterior al vigente, ej ago 2026 → cuenta ene-jul), el `loadSpecificYearFile` envuelve `repair-plan-trabajo-excel` en try/catch (best-effort, no aborta la carga si el template no tiene la hoja esperada), el backend `calculatePlanTrabajoStats` ahora también devuelve `celdasProgramadas/Ejecutadas/Pendientes/Vencidas/porcentajeAvanceCeldas`, y el home (`createPlanTrabajoWidget` + `createAnnualPlanChart`) consume esos nuevos campos. **Resultado Tempoactiva 2026**: dashboard `254 · 47% · 119 · 135 · 24` (suma coherente: 119+135=254 ✓, 24≤135 ✓), home `120/259 · 46%` (diferencia de 1 unidad por edge case del parser — el home usa `xlsx.readFile` directo sin aplicar la reparación de merges B:C que sí aplica el dashboard vía `process-excel-data`, documentada como follow-up futuro). **Beneficio colateral**: el fix del try/catch en `loadSpecificYearFile` también resuelve el bug donde el dashboard quedaba en blanco (0/0/0/0 + charts vacíos) cuando el template .xls no tenía la hoja esperada — antes el `callParentAPI` rechazaba la promesa y abortaba la carga completa.

> **🆕 v0.1.160 (📦695 — Festivos colombianos en el calendario):** Las celdas de los 17 festivos colombianos (cobertura 2020-2030) se muestran con background sutil rosa/rojo + indicador 🇨🇴 + día en negrita roja. Click en el festivo abre mini-modal con info completa (nombre oficial, fecha larga, tipo, observación sobre el traslado si aplica). Módulo nuevo `shared/colombia-festivos.js` con algoritmo de Pascua (Meeus/Jones/Butcher) + 12 festivos fijos (8 trasladables por Ley Emiliani 51/1983 + 4 no trasladables) + 5 religiosos movibles (Jueves Santo, Viernes Santo, Ascensión, Corpus Christi, Sagrado Corazón) calculados dinámicamente desde Pascua. Cache en memoria por año. Validado 2025-2028: Pascua 2026 = 5 abril ✓, Año Nuevo 2026 jueves → 5 lunes ✓, 20 julio 2026 lunes → sin traslado ✓.

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
