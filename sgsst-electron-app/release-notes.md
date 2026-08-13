# K+AIR v0.1.175

## 🔐 Permisos de Bandeja Integrada por usuario (v0.1.175)

Hasta ahora el iframe de la **Bandeja Integrada** (correo + calendario) estaba disponible para todos los usuarios logueados. Esta versión permite al admin condicionar el acceso por usuario desde **Configuración > Gestión de Usuario**, con un toggle "Acceso a Bandeja Integrada" al lado del campo Rol.

### ¿Qué incluye?

**Backend** (`bandeja-integrada-permissions-bridge.js`, nuevo):
- 2 handlers IPC: `users-get-bandeja-integrada-flag` y `users-set-bandeja-integrada-flag`
- Migración idempotente sobre tabla `users`: nueva columna `bandeja_integrada_enabled INTEGER NOT NULL DEFAULT 0` (se aplica sola al abrir la app, no rompe si ya existe)
- **Admin global SIEMPRE forzado a `enabled: true`** — el backend garantiza que un admin NUNCA puede perder acceso (ni a sí mismo ni a otros admins)
- Bridge extendido: acepta `userId` opcional para que el admin pueda ver/modificar el flag de otros users
- Validaciones: no-admin no puede leer/modificar flags ajenos (`PERMISSION_DENIED`); admin no puede deshabilitar a otro admin (`CANNOT_MODIFY_ADMIN`)

**Frontend** (`renderer.js:1041-1081`):
- `toggleBandejaIntegrada()` ahora chequea permisos vía `checkBandejaIntegradaAccess()` antes de abrir el iframe
- Si no tiene acceso, muestra un `alert()` claro:
  ```
  🔒 No tienes acceso a la Bandeja Integrada.
  
  Si crees que deberías tenerlo, contacta al administrador del sistema 
  para que habilite tu permiso desde Configuración > Gestión de Usuario.
  ```
- **Fail-open defensivo**: si la API no está disponible o la llamada falla, abre por defecto (no rompe UX)

**UI** (`config-viewer.html:1997-2009`):
- Nuevo toggle switch estilo iOS en el modal de Gestión de Usuario
- Si el rol es **Administrador**: switch prendido + bloqueado + label "🔒 Siempre habilitado para administradores."
- Si no, se muestra el valor actual de la BD + hint con estado ("✅ Habilitado..." o "❌ Deshabilitado...")

**Save handler** (`config-viewer.html:3927-4017`):
- Después de guardar user + asignaciones, persiste el flag
- Si falla el guardado del flag, **no tira el guardado** — el user ya quedó guardado, solo log + toast warning

### Bug fix incluido (mismo paquete)

**fix(bridge): firma del bridge era `(getDb, validateSession)` pero `main.js` la llamaba como `(app, { getDb, validateSession })`**

La convención del proyecto es `registerXxxHandlers(app, deps)` (ver `eventos-cumplidos-bridge.js`, `gestacion-bridge.js`). Por la firma incorrecta, `_validateSession` quedaba como el objeto `{ getDb, validateSession }` (no función), el chequeo `typeof === 'function'` fallaba, y el handler retornaba `AUTH_REQUIRED: validateSession no configurado`. **Síntoma visible**: el alert "🔒 No tienes acceso" se mostraba incluso siendo admin. **Fix**: 1 línea efectiva — cambiar a `(app, deps)`. Verificado con 12 tests unitarios.

### Antes vs después

| Escenario | ANTES | AHORA |
|---|---|---|
| User no-admin hace click en Bandeja Integrada | Abría el iframe (cualquier logueado tenía acceso) | Muestra alert 🔒 + no abre |
| Admin abre el modal de Gestión de Usuario de un user no-admin | Sin control de acceso a Bandeja | Switch prendido/apagado según BD + editable |
| Admin abre el modal de un user Administrador | (no había control) | Switch prendido + disabled con label "🔒 Siempre habilitado" |
| Admin intenta deshabilitar a otro admin | (no había control) | Backend rechaza con `CANNOT_MODIFY_ADMIN` |
| User no-admin intenta ver el flag de otro user | (no había control) | Backend rechaza con `PERMISSION_DENIED` |
| Token de Gmail del user | No se ve afectado | Sigue intacto (los tokens viven en `email_connections` por empresa, no por user) |

### Cómo usar (admin)

1. Configuración > Gestión de Usuario
2. Click en el ícono de editar de un user (no admin)
3. Al lado del campo Rol aparece el toggle "Acceso a Bandeja Integrada"
4. Prender/apagar + Guardar Usuario
5. El user ahora puede/no puede abrir la Bandeja Integrada

---

# K+AIR v0.1.174

## 📄 File-viewer: integración completa + 6 fixes críticos (v0.1.174)

Resuelve los bugs que impedían previsualizar correctamente documentos (PDF, Word, Excel, PowerPoint, imágenes) en las 12 secciones del proyecto: 3.1.6 Remisiones Médicas, 1.1.1 Responsable SG, sociodemográfica, política, COPASST, comité convivencia, capacitación COPASST, afiliación, trabajo de alto riesgo, roles y responsabilidades, curso virtual, manual de proveedores.

### ¿Qué incluye?

**9 fixes iterativos al file-viewer** (`shared/file-viewer.js`):
- **fix18 (raíz)**: `window.FlyfishFileViewerWeb` no existe — el export real es `FlyfishFileViewerWebFull`. Defense in depth 2 capas con fallback + preload eager de renderers lazy
- **fix19**: `Ve(filename)` del bundle interpreta `#` como fragmento de URL. Pasar `type` attribute explícito soluciona "Carta Recomendación Médica #20.docx" (antes retornaba `state: "unsupported"`)
- **fix20**: CSS global inyectado para arreglar 12 visualizadores con 1 cambio (botón "Ver completo" 30x30 → auto)
- **fix21**: removido `return` temprano que saltaba el MutationObserver del toolbar
- **fix22 + 22b**: panel PADRE `.kair-preview` con `min-height: 0` + `overflow: hidden` — sin esto, flexbox no comprime el file-viewer y el documento se cortaba a la mitad

### Lección guardada (cross-project)

Cuando un hijo tiene `flex: 1` o `flex: 1 1 0%`, TODOS los ancestros flex hasta el que tiene `height` definido necesitan `min-height: 0` + `overflow: hidden`. Sin esto, flexbox no comprime y el hijo queda con el alto natural del contenido.

---

# K+AIR v0.1.173

## 📧 Bandeja Integrada — Fix reply en Enviados (v0.1.173)

Resuelve el bug donde, al abrir un correo de **Enviados** y hacer click en "Responder" o "Responder a todos", el campo "Para" mostraba un chip con el email del propio usuario (visible como "m" o el primer carácter, porque el chip se truncaba a 180px con ellipsis).

### ¿Qué incluye?

**Fix de causa raíz** (`openComposeModal` usaba el campo incorrecto):
- ANTES: `toValue = mail.senderEmail || mail.sender` → en Enviados, `senderEmail` es el email del PROPIO user (vos), no el destinatario
- AHORA: `var replyContact = getMailDisplayContact(mail); toValue = replyContact.email || replyContact.name` → usa la función que ya manejaba este caso correctamente en la lista y el detalle

**`getMailDisplayContact(mail)`** (línea 301) retorna:
- **INBOX**: el `sender` (a quien respondés) — `to_list[0]`, `participants_list` (excluyéndote), o `sender` como fallback
- **SENT**: el primer item de `to_list` o `participants_list` (excluyéndote) — el destinatario original, a quien querés responderle

**Reply all también arreglado**:
- ANTES: el filtro de CC podía incluir tu propio email si eras participante
- AHORA: con `getMailDisplayContact` + el filtro existente (`e !== toValue && e !== state.gmailEmail`), el "Para" es el destinatario correcto y el "CC" son solo los demás

### Antes vs después

| Acción | ANTES | AHORA |
|--------|-------|-------|
| Abrir Enviados → click "Responder" en un correo | Chip con tu propio email (truncado a "m" o similar) | Chip con el destinatario original completo |
| Abrir Enviados → click "Responder a todos" | CC incluía tu propio email | CC solo los demás destinatarios |
| Abrir Recibidos → click "Responder" | Chip con el remitente (correcto) | Chip con el remitente (correcto, sin cambios) |

---

# K+AIR v0.1.172

## 🎨 Scroll INTERNO en los home de módulos — sin scroll externo (v0.1.172)

En modo ventana, el home de un módulo (widgets + charts + lista de submódulos) puede no caber en el viewport. Esta versión resuelve el problema con **scroll INTERNO** dentro del home: la scrollbar aparece DENTRO del home (no en el borde de la página), es fina (~8px) y semi-transparente.

### ¿Qué incluye?

**Fix de 2 capas con CSS puro** (sin tocar JS):
1. **Contenedor padre** (`.module-content-area` + `.main-canvas`): `overflow: hidden !important` — sin scrollbar en el borde de la página
2. **Contenedor del home** (`.gestion-integral-home`, etc.): `overflow-y: auto !important` + `scrollbar-width: thin` + `scrollbar-color` semi-transparente — scroll INTERNO de ~8px

**Cubre los 7 módulos principales** (4 clases de home):
- `gestion-integral-home` → Recursos, Gestión Integral, Verificación, Mejoramiento
- `gestion-salud-home` → Gestión de la Salud
- `gestion-peligros-home` → Gestión de Peligros
- `gestion-amenazas-home` → Gestión de Amenazas

**Por qué `:has()`** (no descendant selector): el contenedor del home es hijo del padre, no descendiente. Con `:has()` desde el padre común, la regla matchea sin importar dónde esté el home en el árbol DOM.

### Antes vs después

| Modo | ANTES | AHORA |
|------|-------|-------|
| Maximizado (1080p+) | Contenido cabe, sin scroll | Contenido cabe, sin scroll |
| Ventana (chico) | Sección de submódulos cortada al final, sin scroll para verla | Scrollbar INTERNA fina en el home, podés bajar para ver todo |

### Iteración del approach
- **Intento 1**: reducir tamaños de widgets/charts (`min-height: 80px`, `canvas: 140px`) → user rechazó porque afectaba legibilidad
- **Intento 2**: `overflow-y: auto` en el padre → traía de vuelta la scrollbar externa
- **Final**: `overflow: hidden` en padre + `overflow-y: auto` en home con scrollbar fina → ✅

---

# K+AIR v0.1.171

## 🎨 Footer minimalista: solo en pantalla de inicio, blanco sobre Vanta (v0.1.171)

El footer negro con copyright y versión se quitó de la app principal y de la Bandeja Integrada para ganar espacio vertical (~25px en cada vista). Ahora solo aparece en la pantalla de inicio (splash + login + selección de empresa) flotando sobre el Vanta con texto blanco.

### ¿Qué incluye?

**Main app** — el footer negro ya no aparece en ningún módulo/submódulo/dashboard/home. Solo se ve cuando estás en la pantalla de inicio (donde está el Vanta.js). **Implementación con CSS puro** usando `:has()` (selector moderno soportado en Electron 37 / Chromium 118+):
- `#app-footer { display: none !important; }` por defecto
- `#app:has(.vanta-fullscreen) #app-footer { display: flex; position: fixed; bottom: 0; ... }` cuando hay Vanta
- `position: fixed` + `bottom: 0` + fondo transparente + texto blanco con text-shadow
- `justify-content: space-between` (copyright izq, versión der) — mismo layout que tenía

**Bandeja Integrada** — el footer de la Bandeja (`K+AIR · Bandeja Integrada v0.1.120 · SG-SST · Resolución 0312 de 2019 · X eventos visibles · Empresa: Todas · Vista: Correo`) también se ocultó. El HTML y el JS quedan intactos — el DOM se sigue actualizando, solo se oculta visualmente con `display: none`. Si querés recuperarlo, comentás la línea y vuelve.

**Bonus** — el bug oculto que se arregló: el selector original `.vanta-fullscreen #app-footer { display: none; }` NUNCA funcionó porque `vanta-fullscreen` se aplica a `.main-container` (sibling del footer, no ancestro). Por eso el footer negro se veía siempre. La regla con `:has()` sí matchea porque `#app` es el ancestro común.

### Antes vs después

| Vista | ANTES (v0.1.170) | AHORA (v0.1.171) |
|-------|------------------|------------------|
| Splash + Login | Footer negro al fondo (visible pero desalineado con el diseño) | Texto blanco flotando sobre el Vanta (como el "Haz clic en el logo") |
| Selección de empresa | Footer negro al fondo | Texto blanco sobre el Vanta |
| Dashboard / Módulos | Footer negro al fondo (roba ~25px verticales) | Sin footer, todo el espacio para el contenido |
| Bandeja Integrada | Footer con info + estado | Sin footer, más espacio para el correo |

### Trade-off
- **El dot de updates del footer desaparece** (estaba ahí en v0.1.131). Si hay update disponible, no se ve en la app principal. Sigue accesible desde **Configuración > Acerca de la App**. Si querés que aparezca en otro lado (header, botón flotante), avisame para moverlo.

---

# K+AIR v0.1.170

## 🔧 Seguimiento de Incapacidades — Fix cédula display vs BD (v0.1.170)

Resuelve la regresión donde, al reabrir un caso existente de seguimiento de incapacidades, la cédula con formato de display (`1,044,392,755`) no matcheaba con la cédula sin formato guardada en la BD (`1044392755`), y el panel se abría como caso nuevo (vacío).

### ¿Qué incluye?

**📦701-fix8 — Normalización de cédula en 2 capas (defense in depth)**:
- ANTES: log mostraba `[SEGUIMIENTO] Cédula: 1,044,392,755` (display) → query `WHERE cedula = '1,044,392,755'` → 0 filas → fallback Excel → tampoco → "abrir caso nuevo"
- AHORA: la cédula se normaliza con `.replace(/,/g, '').replace(/\./g, '').trim()` en:
  1. **Renderer** (`medicion-ausentismo.js`) antes de `buscarPorCedula` y `buscarRegistrosCedula`
  2. **Bridge** (`seguimiento-incapacidad-bridge.js`) dentro de `_handlerBuscarPorCedula` (protege a otros callers)

**Lección guardada en memoria**: cualquier query de BD que reciba cédulas/documentos desde un input de usuario SIEMPRE normalizar a la entrada.

---

# K+AIR v0.1.169

## 🔧 Informe PRI — Casos de BD incluidos (v0.1.169)

Resuelve el bug donde los casos de seguimiento guardados en SQLite (como LORAINNE) NO aparecían en el Informe de Gestión PRI, o aparecían sin la sección "Historial de Seguimientos" poblada. Ahora el informe muestra TODOS los casos (Excel + BD) con la misma coherencia visual que un caso nativo de Excel.

### ¿Qué incluye?

**📦701-fix6 — El informe ahora incluye los casos de la BD**:
- ANTES: `get-pri-seguimiento-data` solo leía `PRI.xlsx` → los casos nuevos guardados en SQLite (vía el flujo de seguimiento de incapacidades) NO aparecían en el informe
- AHORA: el handler consulta `seguimiento_incapacidad_caso WHERE empresa_id = ?` y agrega los casos al final de la lista, evitando duplicados por cédula

**📦701-fix6 — Estado del caso refleja los seguimientos de la BD**:
- ANTES: LORAINNE aparecía como "Sin Iniciar" aunque tenía 2 seguimientos en la BD
- AHORA: `determinarEstadoCaso` considera el caso de BD → LORAINNE ahora muestra "En Seguimiento"

**📦701-fix7 — Sección 4 (Historial de Seguimientos) muestra los seguimientos de la BD**:
- ANTES: la sección se construía desde columnas Excel vacías para casos de BD → no se renderizaba
- AHORA: query a `seguimiento_incapacidad_registro WHERE caso_id = ?`, fecha en colIdx[seguimiento N], descripción en colIdx + 1 (columna adyacente sin header)

**📦701-fix6 — Timezone fix en `formatDate`**:
- ANTES: `new Date("2026-04-01")` se interpretaba como UTC midnight → en Colombia mostraba `31/03/2026`
- AHORA: regex detecta YYYY-MM-DD puro y agrega `T00:00:00` para medianoche local

**📦701-fix7 — Fechas en formato nativo YYYY-MM-DD**:
- ANTES: el handler convertía a DD/MM/YYYY antes de mandar → `formatDate()` del renderer no las parseaba → "Invalid Date"
- AHORA: envía YYYY-MM-DD y deja que `formatDate()` haga la conversión → "13/04/2026" correctamente

### Antes vs después

| Caso | ANTES (v0.1.168) | AHORA (v0.1.169) |
|------|------------------|-------------------|
| LORAINNE en lista | ❌ NO aparecía | ✅ Aparece con "En Seguimiento" |
| LORAINNE sección 4 | ❌ No se renderizaba | ✅ Muestra 2 seguimientos con fecha + descripción |
| Fecha 01/04/2026 | ❌ Mostraba 31/03/2026 (UTC) | ✅ Muestra 01/04/2026 (local) |
| Estado LORAINNE | ❌ "Sin Iniciar" | ✅ "En Seguimiento" |

### Pendiente para próximos releases
- Sección 5 (Calificación PCL) y 6 (Recomendaciones) siguen N/A para casos de BD hasta que se llene esa info en la BD (los campos ya existen en la tabla `seguimiento_incapacidad_caso`)

---

# K+AIR v0.1.168

## 🔧 Seguimiento de Incapacidades — Bug fixes críticos (v0.1.166/v0.1.167)

Resuelve varios bugs críticos en el flujo de seguimiento de incapacidades en SQLite introducidos en v0.1.166/v0.1.167. **El bug principal** impedía guardar cualquier caso porque el schema de la BD tenía columnas duplicadas y las tablas NUNCA se creaban.

### ¿Qué incluye?

**📦701-fix3 — Schema BD arreglado (bug crítico)**:
- El schema de `seguimiento_incapacidad_caso` tenía 2 columnas duplicadas (`origen_dx2` y `origen_dx3`) en las secciones Incapacidad y Calificación
- SQLite rechazaba el `CREATE TABLE` con `duplicate column name: origen_dx2`, las tablas NUNCA se creaban, y cada intento de guardar salía con `no such table: seguimiento_incapacidad_caso`
- **Fix**: renombrar las columnas de la sección Calificación a `origen_dx_calificada{1..4}` (más semántico) + actualizar array de columnas INSERT, `_aplanarCaso()` y `_expandirCaso()`

**📦701-fix4 — Reabrir caso existente carga todos los datos desde la BD**:
- ANTES: al reabrir un caso guardado, el panel se abría VACÍO (buscaba en el Excel legacy, no en la BD nueva)
- AHORA: nuevo handler `buscarPorCedula` en el bridge + el renderer busca primero en SQLite. Si encuentra un caso, carga el ID, la sección 1 con TODOS los datos del trabajador, la sección 2 con los datos de la incapacidad (fechas, CIE-10, descripción, seguimientos múltiples), marca la sección 1 como "ya capturada" (bypass de validación) y abre directamente en sección 2 para continuar el seguimiento
- Solución a 3 bugs propios en la primera implementación: argumentos invertidos de `_expandirCaso`, llamada a método inexistente `renderSeguimientos`, mapeo de IDs incorrecto

**📦701-fix4 — Botón "Siguiente" y banner BD corregidos**:
- Banner superior: muestra `✅ Guardado en BD` al reabrir (antes decía "Sin guardar" aunque el caso existiera)
- Botón "Siguiente": se deshabilita correctamente cuando estás en la última sección visible (en seguimiento simple, las secciones 3/4/5 están bloqueadas y el botón se ve gris)
- Click directo en nav de sección atenuada: ahora SÍ bloquea con toast `ℹ️` (antes podías entrar a sección 3 aunque estuviera bloqueada)
- Sección 1 marcada como "ya capturada" al reabrir caso existente (no requiere re-llenar ni re-validar)

**📦701-fix4 — Clasificación de caso por default**:
- Si guardas sin hacer click en "Solo seguimiento" o "Marcar como PRI formal", el campo se llena con `'NO'` (seguimiento simple) por default
- Al cargar un caso guardado, si la BD tiene el campo vacío, también se asume `'NO'`
- Banner amarillo correcto al reabrir: `⚠️ Seguimiento (no es caso PRI formal)`

**📦706-fix2 — Error display robusto**:
- ANTES: el error del bridge salía como `[object Object]` porque concatenaban objeto a string
- AHORA: extracción defensiva con 4 paths (null, string, object con .message, primitive) + try/catch para referencias circulares
- El `.catch` del IPC también tiene logging detallado (`type`, `constructor.name`, `stack`)

**📦701-fix5 — Avance de tabla usa datos de la BD**:
- ANTES: el cálculo del avance usaba solo datos del Excel legacy, así que LORAINNE mostraba `0% Sin iniciar` aunque tuviera 1 seguimiento guardado en la BD
- AHORA: `loadSeguimientoData()` consulta la BD y construye un mapa `cedula → casoBD`. `calcularPorcentajeAvance(incapacidad, registroPRI, casoBD)` toma el MÁX entre el conteo del Excel y el de la BD. La tabla muestra el avance correcto después de guardar

**📦701-fix — Alias de export en el bridge**:
- `registerSeguimientoIncapacidadHandlers` era `undefined` porque el bridge solo exportaba `registerHandlers` (corto). Los 6 handlers IPC nunca se registraban
- **Fix**: exportar AMBOS nombres como alias

### Archivos modificados (3 archivos, +577/-76 líneas)

- `shared/kair-alerts.js`: `_pinHeader` con timer 30s (+32/-2)
- `modules/gestion-salud/ausentismo/medicion-ausentismo.js`: banner BD + 8 métodos + estilos (+332/-1)

### Próximas mejoras (no incluidas)

- ❌ Re-abrir caso en el formulario desde la lista (botón "Cargar") — solo está Exportar y Eliminar
- ❌ Indicador visual de última fecha de modificación del caso
- ❌ Filtros en la lista de casos (por estado, por fecha, por exportado sí/no)

---

# K+AIR v0.1.166

## 🔧 Seguimiento de Incapacidades — respaldo en SQLite (FASE 1/3)

El submódulo 2.2 **Seguimiento de Incapacidades** (dentro de Medición del Ausentismo) cambió su flujo de persistencia. **ANTES** los datos se guardaban directo en `PRI.xlsx` (vía Python). **AHORA** se guardan en SQLite como fuente de verdad primaria.

### ¿Por qué?

Si el Excel se corrompe o se daña la hoja "Casos en seguimiento", se perdían TODOS los seguimientos. Con SQLite, los datos están seguros.

### ¿Qué cambió?

1. **Schema nuevo en SQLite** (kair.db, vía `main/seguimiento-incapacidad-bridge.js`):
   - `seguimiento_incapacidad_caso`: 1 fila por caso, con ~80 columnas (todos los campos del JSON normalizados)
   - `seguimiento_incapacidad_registro`: FK al caso, para los seguimientos múltiples
   - Índices por empresa, estado, cédula

2. **Bridge IPC nuevo** con 6 handlers:
   - `guardar`, `listar`, `obtener`, `eliminar`, `exportarExcel`, `exportarTodos`

3. **Frontend actualizado**: al guardar un seguimiento, ahora se guarda en SQLite con un mensaje que dice "Click 'Exportar a Excel' para sincronizar" (botón que viene en la próxima release).

### Lo que NO cambió (todavía)

- Los seguimientos **anteriores** siguen en `PRI.xlsx` (no se migraron)
- **No hay UI** para ver los casos guardados en SQLite todavía
- **No hay botón** "Exportar a Excel" todavía

### Próxima release (📦702) — completar el flujo

- Botón "Exportar a Excel" en la UI
- Vista "Lista de casos en BD" con opciones de re-abrir, eliminar, exportar individualmente
- Indicador visual de qué casos están pendientes de exportar

### Archivos modificados (4 archivos, +443/-8 líneas)

- `main/seguimiento-incapacidad-bridge.js`: NUEVO (39 KB)
- `main.js`: registrar bridge + schema
- `preload.js`: exponer IPC
- `modules/gestion-salud/ausentismo/medicion-ausentismo.js`: usar bridge nuevo

---

# K+AIR v0.1.165

## 🔧 Auto-updater — fix del bug "Cannot find module" después de updates

Si tu app estaba en **v0.1.146** (o cualquier versión vieja) y mostraba el dot verde "Lista para reiniciar" + error `Cannot find module 'exceljs'` al abrir, este release lo soluciona.

### ¿Qué pasaba?

El instalador NSIS con `asar: false` solo reemplazaba archivos modificados, no agregaba nuevos. Si una nueva versión agregaba un módulo a `package.json` que la versión vieja no tenía, el `node_modules/` no se actualizaba y la nueva versión crasheaba al iniciar.

### ¿Qué se arregló?

1. **`asar: false` → `asar: true`**: ahora el código y los `node_modules/` van empaquetados en un solo `app.asar` (con `asarUnpack` para native modules y archivos de plantilla). El instalador reemplaza el .asar atómicamente, **todos los archivos se actualizan siempre**.

2. **`asarUnpack` configurado** para:
   - `better-sqlite3`, `@napi-rs/canvas*`, `bcryptjs` (native modules con binarios .node)
   - `utils/` (plantillas .xls/.xlsx que se leen directamente)
   - `components/config/` (config files .json)

3. **`findPython()` corregido** para usar `process.resourcesPath` cuando la app está empaquetada, en lugar de `__dirname` (que apunta al .asar donde los .exe no se pueden ejecutar).

### Si tienes el update roto (v0.1.164 descargado pero no aplicado)

1. **Cerrar la app** (Ctrl+Q)
2. **Descargar manualmente** el instalador v0.1.165 desde este release
3. **Ejecutarlo** — el NSIS oneClick detectará la versión instalada y hará un upgrade limpio

### Archivos modificados (2 archivos, +13/-4 líneas)

- `package.json`: `asar: true` + `asarUnpack` con 5 patrones
- `main.js`: `findPython()` usa `process.resourcesPath` cuando `app.isPackaged` es true

---

# K+AIR v0.1.164

## 🎨 Dashboard principal — reorganización del home de empresa

El home de empresa cambió de un layout con sidebar vertical a un layout horizontal con **módulos arriba** y **tareas full-width abajo**. Más espacio, mejor balance visual, responsive en ventana y maximizado.

### Antes vs Después

| Modo | Antes (v0.1.163) | Después (v0.1.164) |
|---|---|---|
| **Maximizado** | Sidebar 280px con módulos + lista 1 col | Módulos en 1 fila + tasks en 2 cols (4×2 = 8 visibles) |
| **Ventana** | Sidebar angosto + tasks en 1 col | Módulos en 2 filas compactas + tasks en 2 cols |
| **Críticas** | Border rojo estándar | Highlight rojo completo (bg + border + área de acción) |

### ¿Qué cambió?

1. **Layout reorganizado**:
   - Módulos del Sistema: fila horizontal de 7 cards compactas (en vez de sidebar vertical)
   - Pendientes y Tareas: panel full-width debajo de los módulos
   - Grid reorganizado: `mainGrid` pasa de 2 columnas (sidebar + tasks) a 2 filas (módulos + tasks)

2. **Highlight rojo de tareas críticas** (4 cards: Afiliación SSSI, COPASST Mayo 2026, Comité Sin Acta, Comité Sin reunión Noviembre):
   - Background `#fef2f2` + border `#fecaca` + border-left `#ef4444` (4px)
   - Área de acción con `#fee2e2` para distinguir visualmente el botón de flecha
   - Una sola barra roja en el lateral (no doble)

3. **Responsive window vs maximizado**:
   - **Ventana (< 1200px)**: módulos en 2 filas compactas (4+3) sin descripción, tasks en 2 cols con cards compactas (font 11-12px, line-clamp 1)
   - **Maximizado (≥ 1200px)**: módulos en 1 fila, tasks en 2 cols (4×2 = 8 cards visibles)
   - CSS inyectado dinámicamente, no toca archivos CSS globales

4. **Fix bug del colapso en ventana**:
   - Bug: las cards se renderizaban como líneas finas rojas (~3-4px) en modo ventana
   - Causa: `align-content: start` sin `grid-auto-rows` mínimo dejaba los row tracks colapsados
   - Fix: `grid-auto-rows: minmax(60px, auto)` fuerza altura mínima de 60px por row

### Antes vs Después (visualmente)

**Modo maximizado** (8 cards visibles en 2 filas × 4 cols):
- Módulos en 1 fila: Recursos, Gestión Integral, Gestión de la Salud, Gestión de Peligros y Riesgos, Gestión de Amenazas, Verificación, Mejoramiento
- Tasks en 2×4: 1 warning (Presupuesto) + 2 info (Inducciones, COPASST) + 4 critical (Capacitaciones Vencidas, Afiliación SSSI, COPASST Mayo 2026, Comité Sin Acta, Comité Sin reunión Noviembre) — total 8 cards

**Modo ventana** (~8 cards visibles en 4 filas × 2 cols):
- Módulos en 2 filas: fila 1 (4 cards) + fila 2 (3 cards)
- Tasks en 2 cols compactas con scroll si no caben todas

### Archivos modificados (1 archivo, +147/-44 líneas)

- `renderer.js`: `createDashboardHome()` reorganiza `mainGrid` + CSS inyectado con media queries

---

# K+AIR v0.1.163

## 🔧 Plan de Trabajo Anual — math del dashboard corregido + vencidas reales

El Dashboard de Avance del Plan de Trabajo (2.4.1) ahora muestra números **matemáticamente coherentes** y finalmente calcula las **actividades vencidas** (siempre mostraba 0).

### Antes vs Después (Tempoactiva 2026)

| Métrica | Antes (v0.1.162) | Después (v0.1.163) |
|---|---|---|
| Programadas | 106 (actividades) | **254** (celdas con C o P) |
| Realizadas | 115 (44%) | **119** (47%) |
| Pendientes | 139 | **135** |
| Vencidas | **0** ❌ (bug) | **24** ✓ |

### ¿Qué era el bug?

La cinta del dashboard mezclaba dos unidades de medida sin que se notara:

- **"Programadas"** contaba **actividades** (filas del plan = 106)
- **"Realizadas" / "Pendientes"** contaban **celdas** (marcas por mes = 115/139)

Como una actividad puede tener varias celdas marcadas (ej: 'C' en enero **y** 'C' en abril = 2 celdas-C), el conteo de celdas siempre puede ser mayor que el de actividades. Eso generaba la apariencia de un "115 > 106 imposible" cuando en realidad era correcto.

Además, la métrica **Vencidas siempre mostraba 0** porque la variable `overdueCount` existía pero el bloque que debía sumar 1 por cada celda con 'P' en un mes pasado nunca se implementó. Bug real, no cosmético.

### ¿Qué se arregló?

1. **Conteo por CELDAS en todas las métricas** del dashboard (cada marca por mes cuenta 1):
   - **Programadas** = total de celdas con marca (C o P)
   - **Realizadas** = celdas con C
   - **Pendientes** = celdas con P
   - **Vencidas** = celdas con P en un mes **anterior** al mes vigente (no incluye el mes actual, porque todavía hay tiempo)

2. **Lógica de Vencidas implementada correctamente**: para cada celda-mes de cada actividad, si `month === 'P'` y el índice del mes (`0-11`) es **menor** que el mes actual (`new Date().getMonth()`), y el plan corresponde al año vigente, se suma 1. Para Tempoactiva en agosto 2026, cuenta los meses enero–julio.

3. **% de Avance = `celdasEjecutadas / celdasProgramadas`**. Para Tempoactiva: 119/254 = **47%** (no 36% ni 44%, que eran los valores anteriores por mezclar unidades).

4. **Math interna coherente**: `Realizadas + Pendientes = Programadas` (119 + 135 = 254 ✓) y `Vencidas ≤ Pendientes` (24 ≤ 135 ✓). Ya no hay sorpresas tipo "115 > 106".

5. **Dona del home de Gestión Integral ("Avance del Plan Anual SST") ahora consistente con el dashboard** — antes mostraba 36% (conteo de actividades) mientras el dashboard mostraba 44% (conteo de celdas). Ahora el backend `calculatePlanTrabajoStats` también calcula `celdasProgramadas/Ejecutadas/Pendientes/Vencidas/porcentajeAvanceCeldas`, y la dona + la card "Plan de Trabajo" del home consumen esos campos. **Se eliminó el valor hardcoded `actividadesProgramadas: 197`**.

6. **Bug colateral resuelto**: `loadSpecificYearFile` ahora es **resiliente a fallos del `repair-plan-trabajo-excel`**. Antes, si el template .xls no tenía la hoja esperada (ej: para empresas con un template distinto), el `repair` devolvía `success: false`, la promesa se rechazaba, y la carga del Excel se abortaba → dashboard quedaba en blanco (0/0/0/0 + charts vacíos) aunque el Excel se podía leer normal. Ahora el repair es **best-effort**: si falla, se loguea un warning y se continúa con la lectura normal.

### Archivos modificados

- `modules/gestion-integral/plan-trabajo/plan-viewer.js` (5 funciones: `updateKPIs`, `renderChartStatus`, `renderChartQuarterly`, `renderChartByCategory`, `loadSpecificYearFile`)
- `main.js` (`calculatePlanTrabajoStats` ahora también devuelve los conteos por celdas)
- `modules/gestion-integral/gestion-integral-home.js` (`createPlanTrabajoWidget` y `createAnnualPlanChart` consumen los nuevos campos)

### Nota técnica

El home muestra `120/259` con `46%` mientras el dashboard muestra `119/254` con `47%`. La diferencia de 1 unidad es por un edge case en el parser: el home usa `xlsx.readFile` directo y el dashboard aplica primero la reparación de merges B:C (`repair-plan-trabajo-excel` → `process-excel-data`), así que una fila con merge corrupto se cuenta en uno pero no en el otro. Es un follow-up futuro, no afecta la coherencia interna de cada vista.

---


# K+AIR v0.1.159

## 🐛 Fix: Botón "Marcar cumplido" del calendario

Bug crítico: el botón del modal de evento no funcionaba. El user hacía click y el cumplimiento **no se guardaba** en la base de datos.

**Causa raíz:** el renderer enviaba `evento_id` (snake_case, como las columnas de SQLite) pero el bridge IPC esperaba `eventoId` (camelCase, como las funciones del bridge). El backend rechazaba silenciosamente con `VALIDATION: empresaId y eventoId son requeridos` y el user solo veía un toast genérico que desaparecía a los 3 segundos. El bug afectaba a **2 de 3 call sites** (`app.js` de la Bandeja Integrada y `renderer.js` del header) — el 3ro (`calendar-detail-panel.js`) ya usaba camelCase correctamente, lo que confirmó la convención.

**Fix:** cambio a `eventoId` (camelCase) en ambos archivos + helper defensivo `_normalizeCumplidoPayload()` en el bridge que acepta ambos formatos.

## 🐛 Fix: empresaId rechazado en modo "Todas las empresas"

Cuando el toggle del calendario está en "Todas las empresas", `getActiveCompanyName()` retorna `null` (porque el view no está en una empresa específica). El bridge rechazaba con `VALIDATION`.

**Fix:** `empresa_id` ahora es nullable en la tabla. Migración defensiva recrea la tabla preservando datos para DBs existentes.

## 🐛 Fix: Sincronización multipc fallaba con "no such column: updated_at"

El `sync-serializer.js` asumía un schema incorrecto para `eventos_cumplidos` y `eventos_rapidos`. Cada vez que se hacía un push multipc, salían 2 errores de columnas inexistentes.

**Fix:** schema real usado en queries. `eventos_rapidos` sync implementado completo (antes era un stub).

## 🆕 Cumplimiento se ve visualmente en el calendario

Cuando un evento está marcado como cumplido, su chip en el calendario se atenúa al 55% de opacidad y el título se tacha con una línea por el medio. Aplica a las 3 vistas:

- **Vista Mes**: chip principal de cada día
- **All-day Mes**: chips del banner superior
- **All-day Semana**: chips del header de cada columna

## 🆕 Toggle marcar/desmarcar cumplido

El mismo botón del modal ahora funciona como toggle:

- Si el evento **no** está cumplido → botón dice **"Marcar cumplido"** (estilo neutral) y al hacer click lo marca
- Si el evento **ya** está cumplido → botón dice **"Desmarcar cumplido"** (borde verde claro) y al hacer click lo desmarca

El chip del calendario se actualiza instantáneamente sin necesidad de recargar la Bandeja Integrada.

---

# K+AIR v0.1.158

## 🆕 Navegación recursiva de carpetas en FURAT (tipo explorador)

Bug crítico: cuando el user hacía click en una carpeta de año (ej: 2019) que contiene subcarpetas (ej: 2019/Enero, 2019/Febrero), la UI mostraba "No hay reportes en esta carpeta" porque el código solo leía 1 nivel del filesystem.

**Fix:**
- `getLibraryData` ahora itera recursivamente con `scanFolderRecursive(MAX_DEPTH=5)`
- Cada folder tiene `parentPath` para renderizar el árbol por niveles
- Cada archivo tiene `folderPath` apuntando a su carpeta inmediata
- Conteo de archivos en cada folder suma los descendientes (propagación hacia arriba)

**Resultado:**
- Click en 2019 → muestra cards de Enero/Febrero/Marzo…
- Click en Enero → muestra los PDFs de Enero
- Breadcrumb jerárquico: `Todos los Reportes > 2019 > Enero` (cada nivel clickeable)

## 🆕 Crear subcarpeta dentro de carpeta actual

El botón "Agregar período" ahora funciona también cuando estás dentro de un año. El modal detecta `activeFolder` y muestra el contexto:

> "Se creará dentro de: 2019"

Al confirmar, la nueva carpeta se crea en el path correcto.

## 🆕 Eliminar carpetas (años y meses)

Click derecho sobre folder card → context menu con 3 opciones:
- **Crear subcarpeta acá** → abre el modal con el contexto
- **Abrir carpeta** → abre el explorador de Windows
- **Eliminar carpeta** (rojo) → confirm modal con la cantidad de archivos que se eliminarán

Backend: `deleteFuratFolder` con recursive `fs.rm` + cleanup de metadata en DB (`DELETE FROM furat_metadata WHERE file_path LIKE folderPath%`). Validación: el path debe contener "3.2.1" (submódulo).

## 🆕 Editar metadata de PDFs legacy

Los PDFs viejos que ya están en las carpetas pueden categorizarse manualmente:
- Click derecho sobre fila de la tabla → context menu → "Editar metadata"
- Modal pre-llenado con metadata existente (si hay)
- Campos: fecha accidente, tipo, gravedad, área, reportado por, descripción
- Backend: `upsertFuratMetadata` con `INSERT OR REPLACE ON CONFLICT(file_path)`

Después de guardar, se refresca la tabla y el dashboard para que el PDF entre en los análisis (charts de tendencia, gravedad, top áreas).

---

# K+AIR v0.1.157

## 🐛 Bugfixes Bandeja Integrada

### 📦691 — Scroll de la lista al seleccionar un mail
El scroll de la lista de correos subía al top cada vez que el user seleccionaba un correo. Scrolleabas hasta abajo, hacías click, y la lista se iba a arriba — UX muy molesta.

**Causa raíz (3 problemas encadenados):**
1. El `renderMailList` apuntaba al `container.scrollTop` (`#mail-list-container`) que tiene `overflow: hidden` en CSS, por lo que su `scrollTop` siempre era 0. El scroll real estaba en un sub-elemento con clase `.kair-scroll`.
2. `loadMailBodyFromCache` se llamaba en paralelo desde `selectMail` y `renderMailDetail`, generando 2-3 renders en cadena que se "pisaban" entre sí.
3. El rAF de scroll restoration quedaba apuntando a un list con altura 0 (recién creado, vacío).

**Fix:**
- `renderMailList` ahora busca el `.kair-scroll` viejo antes del `innerHTML = ""` y guarda SU `scrollTop`. El rAF aplica al NUEVO `list.scrollTop` (no al container).
- `loadMailBodyFromCache` solo actualiza el detail (`renderMailDetail`), no la lista completa (`render()`). Así no se pisa el scroll restoration.
- Flag `_loadingBody` en `mail` evita cargas paralelas desde `selectMail` y `renderMailDetail`.
- Filter / sort / search: `state._resetMailListScroll = true` antes del render para ir a top (el contenido sí cambia en esos casos).

### 📦690 — Warnings de `cid:` URIs en imágenes embebidas
Los emails HTML con `<img src="cid:icon.png">` generaban `net::ERR_UNKNOWN_URL_SCHEME` en consola, saturando DevTools con warnings rojos.

**Causa:** los emails multipart/related referencian imágenes con `cid:` URIs (Content-ID). El navegador no sabe resolverlos.

**Fix:** en `sanitizeHtml()`, cuando un atributo (`src`, `srcset`, `background`) empieza con `cid:`, se reemplaza por un GIF transparente 1x1 (data URI de 43 bytes). El layout del email no cambia (espacio preservado), no hay request al browser, no hay warning. Si en el futuro se quiere mapear los `cid:` a blob URLs de los attachments reales, este es el lugar para hacerlo.

---

# K+AIR v0.1.156

## 🎉 Novedades

### 🩹 Rediseño completo del submódulo FURAT (3.2.1 Reportes de Accidentes)

Rediseño total del submódulo FURAT dividido en 4 fases + 3 bugfixes críticos.

#### Fase 1 — Refactor visual
- **Header System v2.0**: migrado al patrón 3.1.4 (`k-section-card` + `header-back-btn` + `em-tabs`), mismo que Evaluaciones Médicas, Gestión del Cambio, Planes. 116 líneas de CSS viejo eliminadas.
- **KPI Strip oficial** (Sistema Visual v1.0): 4 métricas (Total FURAT, Este Año, Este Mes, Carpetas) con iconos contextuales.
- **Hero de bienvenida removido**: CTAs movidos a la drop zone de la Biblioteca.
- **40+ inline styles eliminados** del HTML.

#### Fase 2 — Drag-and-drop + Upload + Tabla SQL
- **Drag & drop visual** estilo macOS Finder: la drop zone aparece sobre la card destino específica al arrastrar un archivo (no overlay global).
- **Upload con metadata**: nuevo modal de upload con fecha, tipo, gravedad, área, descripción, reportado por.
- **Tabla SQL `furat_metadata`**: schema con índices por company/date/type/severity/area.

#### Fase 3 — Dashboard analítico
- **4 charts basados en metadata**:
  - **Tendencia últimos 12 meses**: LÍNEA SVG con PUNTOS prominentes (no más barras).
  - **Por tipo de accidente**: barras horizontales con label + count.
  - **Por gravedad**: stacked bar con colores semánticos (verde/amarillo/rojo/marrón) + legend.
  - **Top áreas**: top 5 con más accidentes.
- **Ribbon "Análisis preliminar"** cuando hay < 3 reportes con metadata.

#### Biblioteca V2 rediseñada
- **8+ iteraciones visuales**: cards amarillas tipo Finder, breadcrumb unificado, drop zone on card, header card unificado, header estandarizado 3.1.4, botón "Agregar período" verde, modal "Crear carpeta".
- **Sub-headers simétricos** con icono + título + hint + acciones.
- **Header unificado en UNA línea horizontal** (breadcrumb + búsqueda + filtros + info).

#### Visor unificado
- **📦686**: migrado al `kair-fv-modal` (mismo que Bandeja Integrada). PDFs, Office, imágenes con toolbar completa (search, zoom, pages, rotación, download, print).

#### Sistema de notificaciones
- **📦676**: migrado a `KAIRToast` moderno unificado (mismo sistema que el resto de la app).

#### Bugfixes críticos
- **📦674**: handlers IPC sin `ipcMain` importado → "No handler registered". Fix: usar el `ipcMain` importado en vez del parámetro `app` (patrón de los otros bridges).
- **📦673**: TypeError en `setupEventListeners:193` (listener de viewerBackBtn inexistente). Fix: eliminar listeners del viewer.
- **📦681**: CSS seguía usando clase vieja `.furat-folders-section-v2` → dropzone caía a `top: 0; left: 0`. Fix: actualizar selectores a `.furat-card`.
- **📦684**: 18 warnings de "Unknown message type". Fix: agregar los 6 tipos del FURAT al switch del `renderer.js`.

#### Mejoras de UX con poco data (📦687)
- **Tendencia 12 meses**: cambiada a LÍNEA con PUNTOS (más visual con 1 solo punto).
- **Últimos Reportes**: ahora muestra `accident_date` (consistencia con el chart de tendencia) en lugar de `modified` del filesystem.
- **Header hint**: "Análisis preliminar · basado en N reporte(s) con metadata" cuando N < 3.

#### Contenedor unificado de Biblioteca (📦685)
"Carpetas por año" + "Reportes" dentro de UN SOLO card. Sub-headers compartidos, divider sutil con indicador azul, fondo gris sutil. Simetría con el resto de la app.

#### Scroll bloqueado en modo ventana (📦682-683)
Cadena de `overflow: hidden` bloqueaba scroll. Fix: `min-height: 100vh` en body y furat-app, `min-height: 0` en kair-container y furat-library, `overflow-y: auto` donde corresponde.

---

# K+AIR v0.1.155

## 🎉 Novedades

### ✉️ Fix: Enviados muestra destinatario en lugar de remitente (📦657)

Bug de UX clásico: en la carpeta Enviados, la lista y el detalle mostraban el remitente (siempre "yo") en vez del destinatario, igual que en Recibidos. Ahora muestra el destinatario como contacto principal, igual que Gmail/Outlook.

- **Fix backend** (`email-db.js`): `getThreadsFromCache` y `getThreadFromCache` ahora hacen un LEFT JOIN correlated con `email_messages` para traer `to_list`/`cc_list` del último message de cada thread.
- **Fix frontend** (`app.js`):
  - Nuevo helper `getMailDisplayContact(mail)` que retorna el contacto correcto según carpeta. En SENT busca el destinatario en `to_list[0]`, después en `participants_list` (excluyendo al user), y como último recurso usa `sender`.
  - Header del detalle: avatar y name usan el contacto correcto. En SENT, agrega una línea "de: yo" en gris pequeño.
  - Panel "Mostrar detalles": en SENT el orden es Para → CC → De (estilo Gmail). En otras carpetas mantiene el orden clásico.
  - Búsqueda de la lista también busca en destinatarios (importante para Enviados).
- **Beneficio**: en la lista de Enviados el avatar y nombre muestran el destinatario desde el primer render. El detalle lo muestra como contacto principal con "de: yo" en gris.

## 📦 Commits incluidos (1)

- Próximo commit con bump 0.1.154 → 0.1.155

---

# K+AIR v0.1.154

## 🎉 Novedades

### 📊 Fix: gráfica "Capacitaciones Mensuales" del home de Recursos (📦656)

La gráfica del home de Recursos mostraba datos distintos (y falsos) a la del submódulo "Programa de Capacitación Anual". El algoritmo del home hardcodeaba las columnas del Excel (leía la columna 3 cuando la fecha real estaba en la columna 5), y tenía 38 keywords ambiguas que matcheaban palabras como "Próxima", "Excelente", "Vencida" como realizadas.

- **Fix**: reescritura completa del algoritmo del home para usar la misma lógica que el submódulo:
  - Auto-detección de columnas leyendo el header del Excel
  - Parser de fecha robusto (DMY, ISO, serial date, fallback)
  - Fallback offset ±2 columnas
  - Filtros estrictos de fila
  - Lista estricta de keywords de "realizada" (9, no 38)
- **Beneficio**: la gráfica del home ahora muestra exactamente lo mismo que "Ejecución Mensual" del submódulo.

## 📦 Commits incluidos (1)

- Próximo commit con bump 0.1.153 → 0.1.154

---

# K+AIR v0.1.153

## 🎉 Novedades

### ✉️ Fix: tildes y eñes en subject de correos enviados (📦655)

Bug clásico de encoding al construir el raw MIME. El subject (y demás headers) se escribían como UTF-8 raw, pero Gmail/clients lo interpretaban como Latin-1 → `ejecución` se mostraba como `ejecucÃ³n`.

- **Fix**: nueva función `encodeMimeHeader(str)` que aplica RFC 2047 encoded-word (`=?UTF-8?B?<base64>?=`) cuando hay caracteres no-ASCII. Si es ASCII puro, lo devuelve tal cual.
- Aplicada a `From`, `To`, `Cc`, `Bcc`, `Subject`.
- Ahora subjects con tildes, eñes y acentos se ven correctos en cualquier cliente.

## 📦 Commits incluidos (1)

- Próximo commit con bump 0.1.152 → 0.1.153

---

# K+AIR v0.1.152

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
