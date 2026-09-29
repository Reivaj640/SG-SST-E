# Plan de migración del submódulo Presupuesto a Base de Datos

**Submódulo afectado:** `1.1.3 Asignación de Recursos → Presupuesto SG-SST`
**Empresa de prueba:** Tempoactiva (carpeta `1. Recursos\1.1.3 Asignación de Recursos\`)
**Archivo Excel actual:** `ACT-FO-043 Presupuesto SG-SST 2026 Tempoactiva.xlsx`
**Estado del Excel:** 70,80% cumplimiento, 19 partidas, 12 meses

---

## 🎯 Objetivo

Que los datos del presupuesto se almacenen en **SQLite** (la BD que ya usa K+AIR para otros módulos como Gestación, FURAT, Eventos Cumplidos, Bandeja Integrada, etc.) en vez de vivir dentro de un Excel.

El usuario podrá seguir exportando a Excel cuando quiera (formato idéntico al actual) — pero el Excel deja de ser la fuente de verdad. La fuente de verdad pasa a ser la BD.

---

## 🧩 Lo que hay hoy (cómo funciona actualmente)

| Capa | Hoy | Después |
|---|---|---|
| **Fuente de datos** | Excel en `G:\Mi unidad\...` (Google Drive) | SQLite local (`main.js` → `dbPath`) |
| **Lectura** | `main.js:6052` lee el .xlsx con `xlsx` lib | Bridge IPC `presupuesto:get-by-empresa-anio` lee de la BD |
| **Edición** | `main.js:9188` reescribe el .xlsx con `exceljs` | Bridge IPC `presupuesto:bulk-save` actualiza la BD |
| **Exportación** | (no existe botón) | Nuevo: `presupuesto:export-excel` genera .xlsx on-demand |
| **Búsqueda de archivos** | `main.js:9089` busca .xlsx en la carpeta del submódulo | Solo el importador los necesita (migración inicial) |
| **Patrón de código** | Handlers mezclados en `main.js` (870KB) | Bridge dedicado `main/presupuesto-bridge.js` (consistente con los otros módulos) |

**Lo que NO se rompe:**
- Los handlers de Excel se mantienen como **fallback** mientras la BD no tenga datos para esa empresa/año
- El sync con Google Drive (subida de Excel) sigue funcionando — ahora exporta desde BD
- El formato del Excel que el usuario conoce queda 100% idéntico al exportar

---

## 📐 Modelo de datos (schema SQL)

```sql
-- ============================================================
-- TABLA: presupuestos
-- Un presupuesto por empresa por año. Si en 2027 se necesita
-- un nuevo año, se crea un row nuevo (no se sobreescribe).
-- ============================================================
CREATE TABLE IF NOT EXISTS presupuestos (
  id              TEXT PRIMARY KEY,                -- 'p-{timestamp36}-{rand}'
  empresa_id      TEXT NOT NULL,                   -- FK lógica a companies
  anio            INTEGER NOT NULL,                -- 2026
  nombre          TEXT NOT NULL,                   -- "Presupuesto SG-SST 2026" (editable)
  notas           TEXT,                            -- notas generales
  creado_en       TEXT NOT NULL,                   -- ISO 8601
  actualizado_en  TEXT NOT NULL,                   -- ISO 8601
  creado_por      INTEGER,                         -- user.id del que lo creó
  UNIQUE(empresa_id, anio)
);

CREATE INDEX idx_presupuestos_empresa ON presupuestos(empresa_id);
CREATE INDEX idx_presupuestos_anio    ON presupuestos(anio);

-- ============================================================
-- TABLA: presupuesto_partidas
-- Las "filas" del Excel (Honorarios profesionales, Compra EPPs,
-- Capacitaciones, etc.). 19 filas típicas.
-- ============================================================
CREATE TABLE IF NOT EXISTS presupuesto_partidas (
  id              TEXT PRIMARY KEY,                -- 'pp-{timestamp36}-{rand}'
  presupuesto_id  TEXT NOT NULL,
  numero          INTEGER NOT NULL,                -- 1, 2, 3... (id visual, igual al Excel col A)
  concepto        TEXT NOT NULL,                   -- "Honorarios por los servicios del Profesional de Seguridad y Salud en el Trabajo"
  descripcion     TEXT,                            -- opcional, texto libre
  activo          INTEGER NOT NULL DEFAULT 1,      -- soft-delete (0 = borrado)
  creado_en       TEXT NOT NULL,
  actualizado_en  TEXT NOT NULL,
  FOREIGN KEY (presupuesto_id) REFERENCES presupuestos(id) ON DELETE CASCADE,
  UNIQUE(presupuesto_id, numero)
);

CREATE INDEX idx_partidas_presupuesto ON presupuesto_partidas(presupuesto_id);
CREATE INDEX idx_partidas_activo       ON presupuesto_partidas(presupuesto_id, activo);

-- ============================================================
-- TABLA: presupuesto_valores_mensuales
-- 12 filas por partida por año (Ene-Dic). Total ~228 rows/presupuesto.
-- Esto es lo que se "ve" en las columnas mensuales del Excel.
-- ============================================================
CREATE TABLE IF NOT EXISTS presupuesto_valores_mensuales (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  partida_id      TEXT NOT NULL,
  anio            INTEGER NOT NULL,                -- 2026
  mes             INTEGER NOT NULL CHECK(mes BETWEEN 1 AND 12),
  asignado        REAL NOT NULL DEFAULT 0,         -- valor planeado/presupuestado
  ejecutado       REAL NOT NULL DEFAULT 0,         -- valor ejecutado (acumulado o mensual, ver nota)
  notas           TEXT,
  actualizado_en  TEXT NOT NULL,
  FOREIGN KEY (partida_id) REFERENCES presupuesto_partidas(id) ON DELETE CASCADE,
  UNIQUE(partida_id, anio, mes)
);

CREATE INDEX idx_pvm_partida ON presupuesto_valores_mensuales(partida_id);
CREATE INDEX idx_pvm_anio_mes ON presupuesto_valores_mensuales(anio, mes);
```

**Decisión importante sobre `ejecutado`:** El Excel actual tiene `ejecutado_acumulado` (suma hasta el mes). La BD va a guardar lo mismo (acumulado) para mantener paridad 1:1 con el Excel al exportar. Si más adelante se quiere cambiar a "ejecutado mensual", eso es otra conversación.

---

## 🔌 API del bridge (canales IPC)

Patrón: misma firma `(app, deps)` que `eventos-cumplidos-bridge.js`, `gestacion-bridge.js`, `bandeja-integrada-permissions-bridge.js`. Dependencias inyectadas: `{ getDb, validateSession }`.

### Lectura

| Canal IPC | Payload | Respuesta |
|---|---|---|
| `presupuesto:list-by-empresa` | `{token, companyName}` | `{success, presupuestos: [{id, anio, nombre, partidasCount, ...}]}` |
| `presupuesto:get` | `{token, presupuestoId}` | `{success, presupuesto: {id, anio, nombre, ...}, partidas: [{id, numero, concepto, ..., valores: [{mes, asignado, ejecutado}]}]}` |
| `presupuesto:get-by-empresa-anio` | `{token, companyName, anio}` | Mismo shape que `:get` (atajo) |
| `presupuesto:calcular-resumen` | `{token, presupuestoId}` | `{success, resumen: {totalAsignado, totalEjecutado, porcentaje, saldo, mensual: {asignado:[12], ejecutado:[12]}}}` — el ribbon de KPIs |

### Escritura

| Canal IPC | Payload | Respuesta |
|---|---|---|
| `presupuesto:create` | `{token, companyName, anio, nombre?}` | `{success, presupuesto}` — crea el shell vacío si no existe |
| `presupuesto:update-meta` | `{token, presupuestoId, nombre?, notas?}` | `{success}` |
| `presupuesto:add-partida` | `{token, presupuestoId, concepto, descripcion?}` | `{success, partida}` — auto-asigna `numero` |
| `presupuesto:update-partida` | `{token, partidaId, concepto?, descripcion?, activo?}` | `{success}` |
| `presupuesto:delete-partida` | `{token, partidaId}` | `{success}` — soft delete (activo=0) |
| `presupuesto:set-mes-values` | `{token, partidaId, anio, mes, asignado, ejecutado, notas?}` | `{success}` |
| `presupuesto:bulk-save` | `{token, presupuestoId, cambios}` | `{success, applied}` — batch para el botón "Guardar Cambios" |

### Importación / Exportación

| Canal IPC | Payload | Respuesta |
|---|---|---|
| `presupuesto:import-from-excel` | `{token, filePath, options}` | `{success, inserted, updated, skipped}` — lee el .xlsx y lo sube a la BD |
| `presupuesto:export-excel` | `{token, presupuestoId, outputPath?}` | `{success, path}` — genera .xlsx con el formato actual del ACT-FO-043 |
| `presupuesto:export-template` | `{token, companyName, anio}` | `{success, path}` — genera plantilla vacía |

### Schema y registro

```js
// main/presupuesto-bridge.js exporta:
module.exports = {
  registerPresupuestoHandlers,   // (app, deps) firma estándar
  SCHEMA_SQL,                     // CREATE TABLE IF NOT EXISTS (de arriba)
  MIGRATIONS_SQL                  // ALTER idempotentes (vacío en v1)
};
```

---

## 📋 Fases de implementación (orden estricto)

### ✅ Fase 0 — Schema + bridge vacío (sin tocar UI) — **30 min**

- [ ] Crear `main/presupuesto-bridge.js` con el SCHEMA_SQL de arriba
- [ ] Exportar `registerPresupuestoHandlers(app, deps)` con TODOS los canales pero la mayoría retornando `{success: false, error: {code: 'NOT_IMPLEMENTED'}}`
- [ ] Registrar en `main.js` siguiendo el patrón de los otros bridges:
  - `require('./main/presupuesto-bridge')` en la cabecera
  - `registerPresupuestoHandlers(app, { getDb, validateSession })` en la zona de registros
  - `db.exec(PRESUPUESTO_SCHEMA_SQL)` en `initDbOnce()`
- [ ] Test unitario: `node test-presupuesto-bridge-schema.js` — abre DB en `:memory:`, corre el schema, verifica que las 3 tablas existen con `PRAGMA table_info`
- [ ] **No tocar UI, no tocar handlers existentes de Excel**

**Criterio de éxito:** el schema se aplica sin errores al iniciar la app, y la app sigue funcionando idéntica a antes.

---

### ✅ Fase 1 — Handlers de lectura (BD como espejo) — **1.5 h**

- [ ] Implementar `presupuesto:list-by-empresa`, `:get`, `:get-by-empresa-anio`, `:calcular-resumen`
- [ ] Helpers internos: `_rowToPresupuesto()`, `_rowToPartida()`, `_getPartidasConValores(presupuestoId)`, `_calcularResumen(presupuestoId)`
- [ ] **La UI NO cambia todavía.** Solo agregamos un log en consola para ver que las queries funcionan
- [ ] Test unitario: insertar 3 partidas × 12 meses a mano en `:memory:`, llamar a `:get-by-empresa-anio`, verificar que el shape coincide con lo que espera la UI
- [ ] Test de regresión: la app sigue funcionando idéntica (los canales viejos de Excel siguen activos)

**Criterio de éxito:** los canales IPC nuevos responden correctamente, pero nadie los llama todavía.

---

### ✅ Fase 2 — UI empieza a usar la BD (modo "BD primaria, Excel fallback") — **2 h**

- [ ] En `presupuesto-logic.js` (`handleIframeMessage` → `case 'requestBudgetData'`): primero intentar leer de BD. Si la BD no tiene datos para esa empresa/año, fallback al Excel viejo
- [ ] Nuevo handler `case 'requestBudgetFromDB'` en el mismo `handleIframeMessage`
- [ ] Nuevo botón en `presupuesto-home.html`: **"Crear presupuesto en BD para 2026"** (solo visible si no existe en BD)
- [ ] Cuando el user hace clic, llama a `presupuesto:create` + `presupuesto:import-from-excel` automático
- [ ] Después de importar, recarga y muestra los datos desde BD
- [ ] **El usuario todavía NO edita sobre BD.** Solo lectura. Para editar sigue usando el botón "Guardar Cambios" viejo que escribe al Excel
- [ ] Logs claros: `[PRESUPUESTO][FUENTE=BD]` vs `[PRESUPUESTO][FUENTE=EXCEL]`

**Criterio de éxito:** la app carga el presupuesto de Tempoactiva 2026 desde BD. La pantalla se ve igual. El Excel en disco no cambia. Si el user exporta el Excel, sigue siendo el mismo.

---

### ✅ Fase 3 — Edición sobre BD (botón "Guardar Cambios" escribe a BD) — **2 h**

- [ ] Implementar `presupuesto:bulk-save` (atomicidad: todo o nada en una transacción SQL)
- [ ] Cambiar el `case 'saveBudgetChanges'` en `presupuesto-logic.js`: en vez de llamar a `saveBudgetFile`, llamar a `presupuesto:bulk-save`
- [ ] **Solo se activa este path si el presupuesto está cargado desde BD** (sigue leyendo el flag del `case 'requestBudgetFromDB'`)
- [ ] Para empresas que AÚN no tengan presupuesto en BD, sigue funcionando el Excel viejo
- [ ] Test de regresión: abrir la app, ir a Recursos → 1.1.3, elegir empresa sin BD, editar y guardar — debe seguir guardando en Excel como antes
- [ ] Test del nuevo path: empresa con presupuesto en BD, editar y guardar — debe persistir en BD

**Criterio de éxito:** para Tempoactiva 2026 los cambios se guardan en BD. Para otras empresas siguen guardando en Excel.

---

### ✅ Fase 4 — Importador desde Excel (one-time, por empresa/año) — **1.5 h**

- [ ] Implementar `presupuesto:import-from-excel`
- [ ] Detecta el formato del Excel actual: header en fila 9 (índice 8), datos desde fila 10, stop en "TOTAL AÑO"
- [ ] Usa el mismo parser que ya tiene `readPresupuestoData` (extraer la lógica a una función compartida `parsePresupuestoXLSX()`)
- [ ] Crea el row de `presupuestos` + rows de `presupuesto_partidas` + 12×N rows de `presupuesto_valores_mensuales`
- [ ] Si ya existe el presupuesto para esa empresa/año, modo `options.overwrite = true` lo reemplaza, sino retorna error
- [ ] Test con el Excel real de Tempoactiva: debe crear 19 partidas + 228 valores mensuales

**Criterio de éxito:** `presupuesto:import-from-excel` con el archivo real de Tempoactiva crea un presupuesto en BD con la misma información.

---

### ✅ Fase 5 — Exportador a Excel (formato idéntico al actual) — **1.5 h**

- [ ] Implementar `presupuesto:export-excel`
- [ ] Genera un .xlsx con la misma estructura que el ACT-FO-043:
  - Filas 1-8: header / títulos / info de la empresa (espejo del template actual)
  - Fila 9: headers (`ID | Concepto/Detalle | Asignado | Ejecutado | % | Ene | Feb | ... | Nov`)
  - Filas 10+: una fila por partida, con valores mensuales y fórmula de % ejecutado
  - Última fila: TOTAL AÑO
- [ ] Usa `exceljs` (que ya está en el proyecto) — la misma lib que usa `handleSaveBudgetFile`
- [ ] Abre el Excel con un clic y se ve **idéntico** al actual
- [ ] Agregar botón **"Exportar a Excel"** en `presupuesto-home.html`
- [ ] Opcional: ubicación por defecto `G:\Mi unidad\...\1.1.3 Asignación de Recursos\ACT-FO-043 Presupuesto SG-SST {anio} {empresa}.xlsx`

**Criterio de éxito:** al exportar, abro el .xlsx con Excel/Google Sheets y se ve exactamente igual al que ya tengo.

---

### ✅ Fase 6 — Modo "BD = source of truth" (default) — **1 h**

- [ ] Invertir la prioridad: BD primero, Excel solo si no existe en BD
- [ ] Si la BD está vacía para esa empresa/año, **en el primer load** ofrecer un wizard: "No hay presupuesto en BD para 2026. ¿Importar desde Excel o crear uno nuevo?"
- [ ] Si el user eligió Excel, llamar al importador y luego recargar desde BD
- [ ] Si el user eligió Nuevo, llamar a `presupuesto:create` con la estructura vacía (solo headers)
- [ ] Agregar en el ribbon de KPIs el timestamp: **"Última edición: 14/08/2026 17:35 por Reinaldo"** (toma `actualizado_en` + `creado_por` de la BD)

**Criterio de éxito:** para nuevas empresas que aún no tienen presupuesto, el flujo es guiado (no falla en silencio). Para las que ya tienen, todo carga desde BD sin tocar Excel.

---

### ✅ Fase 7 — Hardening + cleanup — **1.5 h**

- [ ] Tests de regresión completos: importar → editar → guardar → cerrar app → abrir app → ver datos correctos
- [ ] Tests de multi-año: crear presupuesto 2027 sin tocar 2026
- [ ] Tests de soft delete: borrar partida y verificar que `activo=0` no aparece en la lista pero sí en BD
- [ ] Tests de concurrencia: dos sesiones a la vez, la segunda debería detectar `actualizado_en` cambiado y pedir refresh
- [ ] Limpiar los handlers legacy de Excel en `main.js` (los 3: `readPresupuestoData`, `saveBudgetFile`, `getPresupuestoFiles`) — **SOLO si todos los tests pasan** y todos los presupuestos están en BD
- [ ] Documentar en el código con comentarios tipo `// 📦7XX — MIGRADO A BD v1`
- [ ] Validar con la app real: la pantalla del screenshot sigue funcionando idéntica

**Criterio de éxito:** los handlers legacy de Excel están removidos. La app funciona idéntica. El sync con Google Drive sigue exportando Excel. La BD es la única fuente de verdad local.

---

## ⏱️ Tiempo total estimado

| Fase | Tiempo |
|---|---|
| 0 — Schema + bridge vacío | 30 min |
| 1 — Handlers de lectura | 1.5 h |
| 2 — UI lee de BD (solo lectura) | 2 h |
| 3 — Edición sobre BD | 2 h |
| 4 — Importador | 1.5 h |
| 5 — Exportador | 1.5 h |
| 6 — BD como source of truth | 1 h |
| 7 — Hardening + cleanup | 1.5 h |
| **TOTAL** | **~11 horas** (divididas en varias sesiones) |

---

## 🛡️ Estrategia anti-rotura (lo que NO se rompe)

1. **Handlers de Excel se mantienen activos durante TODAS las fases** hasta la Fase 7. Si algo falla en BD, el fallback a Excel funciona.
2. **No se borra código legacy hasta que los tests E2E pasen.** Cada fase es reversible: si algo se rompe, se revierte el commit y se vuelve al estado anterior.
3. **El Excel exportado tiene el mismo formato 1:1.** Si el usuario abre el Excel exportado con Google Sheets, ve lo mismo que siempre.
4. **Sync con Google Drive sigue funcionando** — exporta el .xlsx desde la BD antes de subirlo.
5. **Por empresa/año:** si una empresa NO tiene presupuesto en BD todavía, sigue trabajando con Excel. La migración es gradual, no big-bang.
6. **Usuarios con Excel local sin subir a Drive:** siguen viendo y editando su Excel. La migración a BD es opcional por empresa.
7. **Backups de la BD:** como el resto de las tablas, la BD de K+AIR se respalda con la lógica existente (sync service en `main/sync-bridge.js`).

---

## 🧪 Plan de testing (qué se prueba y cómo)

| Test | Cómo | Cuándo |
|---|---|---|
| Schema válido | `node test-presupuesto-bridge-schema.js` (sqlite3 en memoria) | Fase 0 |
| Lectura devuelve shape correcto | Insertar datos hardcoded, llamar al handler, comparar con snapshot | Fase 1 |
| UI carga desde BD sin romper | Arrancar app, ir a Recursos → 1.1.3, Tempoactiva 2026 | Fase 2 |
| Editar en BD persiste | Editar celda → guardar → cerrar app → reabrir → ver cambio | Fase 3 |
| Importar Excel real | Correr importador con el ACT-FO-043 de Tempoactiva, comparar totales | Fase 4 |
| Exportar a Excel = mismo formato | Exportar, abrir, comparar visualmente con el original | Fase 5 |
| Multi-año | Crear presupuesto 2027, verificar 2026 intacto | Fase 6 |
| Concurrencia | Dos sesiones, la 2da detecta conflicto y pide refresh | Fase 7 |
| Regresión completa | Recorrer las 8 fases y todas las empresas | Fase 7 |

---

## ❓ Decisiones que necesito que tomes antes de arrancar

1. **¿Por dónde arrancamos?** Mi recomendación: **Fase 0** ahora (30 min, no toca UI, es pura base). Después validás que el schema se aplica y seguimos.

2. **¿El importador corre automático o manual?** Mi recomendación: **manual con un botón** en el primer load. El user decide por empresa/año cuándo importar. Más seguro.

3. **¿Soft delete o hard delete para partidas?** Mi recomendación: **soft delete** (`activo=0`). Permite deshacer y mantener histórico.

4. **¿Multi-año en la misma tabla o tabla por año?** Mi recomendación: **misma tabla con `anio` como columna**. Más simple, más consultas SQL estándar.

5. **¿El Excel generado se guarda en la misma ruta que el actual (Google Drive) o en otro lado?** Mi recomendación: **misma ruta, mismo nombre** — el sync con Drive sigue funcionando sin cambios.

6. **¿Limpiar el Excel de Drive después de migrar a BD?** Mi recomendación: **NO** durante el rollout. Solo cuando el usuario lo decida y tras validar. El Excel es un respaldo natural.

7. **¿Los campos `creado_por` se llenan desde el usuario logueado?** Mi recomendación: **sí** — `validateSession` ya está disponible, lo usamos.

---

## 📂 Archivos que se crean/modifican

**Nuevos:**
- `sgsst-electron-app/main/presupuesto-bridge.js` (~600 líneas)
- `sgsst-electron-app/main/presupuesto-schema-sql.js` (50 líneas, mismo patrón que `email-schema-sql.js`)
- `sgsst-electron-app/main/test-presupuesto-bridge-schema.js` (test unitario)
- `sgsst-electron-app/main/test-presupuesto-bridge-read.js` (test de lectura)
- `sgsst-electron-app/main/test-presupuesto-import-excel.js` (test de import con archivo real)

**Modificados:**
- `sgsst-electron-app/main.js` — registrar bridge + ejecutar schema (3 líneas de cambio)
- `sgsst-electron-app/preload.js` — exponer 9 canales IPC (20 líneas)
- `sgsst-electron-app/modules/recursos/presupuesto/presupuesto-logic.js` — nuevo `case 'requestBudgetFromDB'` + modificar `case 'saveBudgetChanges'` (50 líneas)
- `sgsst-electron-app/modules/recursos/presupuesto/presupuesto-home.html` — botón "Crear presupuesto en BD" (15 líneas)
- `sgsst-electron-app/modules/recursos/presupuesto/presupuesto-gestion.html` — botón "Exportar a Excel" (15 líneas)

**Sin tocar:**
- Todos los demás módulos de K+AIR
- La lógica del cliente (capacitaciones, COPASST, etc.) — solo el submódulo Presupuesto
- El sync con Google Drive (se adapta solo, ya exporta el Excel que se regenera)

---

## 🚀 Siguiente paso inmediato

**Fase 0**: te muestro el `presupuesto-bridge.js` creado, lo registramos, corres la app, confirmás en consola que el schema se aplicó. Después validás y seguimos a Fase 1.

¿Procedo con la Fase 0?
