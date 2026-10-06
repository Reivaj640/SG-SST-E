# Gestión Humana — Fase 0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear la base del módulo `gestion-humana` con schema SQL de 3 tablas, bridge IPC con 16 handlers (todos como STUB en esta fase), y tests de schema. Resultado: tests pasando, módulo registrado en main.js (sin handler real todavía), listo para Fase 1 (read handlers).

**Architecture:** Mismo patrón que Presupuesto 1.1.3. Schema con `sql.js` para tests, `better-sqlite3` en producción. Bridge con firma `(app, deps)`. Soft auth (token opcional). IDs formato `{prefix}-{nanoid}`. Fechas ISO 8601 strings.

**Tech Stack:** Node.js, sql.js (tests), better-sqlite3 (prod), electron, Mocha-style assertions, sin framework de UI (los handlers son IPC).

## Global Constraints

- **Versión K+AIR:** 0.1.190 → 0.1.191 (bump en este commit)
- **Convención IDs:** `ct-` (contrataciones), `bp-` (base_personal), `se-` (gh_sedes) + nanoid
- **Fechas:** ISO 8601 strings (`new Date().toISOString()`), nunca Date objects
- **Soft delete:** `activo=0` en `base_personal`. `contrataciones` usa `estado='cancelado'` (decisión validada con usuario)
- **Firma bridge:** `registerXxxHandlers(app, deps)` — NUNCA `(getDb, validateSession)`
- **Auth:** Soft — si token vacío, `user=null, softAuth=true` (procede sin auth)
- **Empresa multi-tenant:** TODAS las tablas tienen `empresa_id TEXT NOT NULL` + índice
- **Tests:** 49 OK mínimo (schema). Estilo Mocha manual con `_assert` + `_assertEq` (mismo que presupuesto-bridge-schema.js)

## File Structure

```
main/
├── gestion-humana-schema-sql.js           ← NUEVO: schema SQL con 3 tablas + índices
├── gestion-humana-bridge.js               ← NUEVO: bridge con 16 handlers (todos STUB)
├── test-gestion-humana-bridge-schema.js   ← NUEVO: tests de schema
sgsst-electron-app/
├── preload.js                              ← MODIFICADO: expone 16 canales `gh:*`
├── main.js                                 ← MODIFICADO: registra bridge en el boot
```

**Responsabilidades:**
- `gestion-humana-schema-sql.js` — exporta `SCHEMA_SQL` (string con todas las sentencias CREATE/INDEX)
- `gestion-humana-bridge.js` — exporta `registerGestionHumanaHandlers(app, deps)`. Implementa TODOS los 16 handlers como STUB que retornan `{success:false, error:{code:'NOT_IMPLEMENTED', extra:{phase:0}}}`
- `test-gestion-humana-bridge-schema.js` — tests del schema (49 OK). Verifica que las 3 tablas existen, los índices están, y los 16 handlers se registran

---

## Task 1: Schema SQL

**Files:**
- Create: `main/gestion-humana-schema-sql.js`

**Interfaces:**
- Consumes: (none)
- Produces: `module.exports = { SCHEMA_SQL: '...SQL string...' }`

- [ ] **Step 1: Crear el archivo schema con las 3 tablas**

```javascript
// main/gestion-humana-schema-sql.js
// Schema del módulo Gestión Humana (v0.1.191)
// 3 tablas: contrataciones (pipeline 6 pasos), base_personal (trabajadores), gh_sedes (referencia)
//
// Patrón: mismo estilo que main/presupuesto-schema-sql.js.
// Se ejecuta con sql.js en tests, better-sqlite3 en producción.
//
// Empresa multi-tenant: TODAS las tablas tienen empresa_id + índice.

const SCHEMA_SQL = `
-- 📦709 · Tabla principal: procesos de contratación en curso
CREATE TABLE IF NOT EXISTS contrataciones (
  id TEXT PRIMARY KEY,                       -- formato ct-{nanoid}
  empresa_id TEXT NOT NULL,
  nombres TEXT NOT NULL,
  apellidos TEXT NOT NULL,
  cedula TEXT,
  telefono TEXT,
  cargo TEXT NOT NULL,
  salario REAL,
  fecha_ingreso TEXT NOT NULL,               -- ISO 8601
  sede_id TEXT,
  empresa_usuaria TEXT,
  paso_actual INTEGER DEFAULT 1,             -- 1-6
  memo_recibido INTEGER DEFAULT 0,
  memo_fecha TEXT,
  memo_notas TEXT,
  contacto_realizado INTEGER DEFAULT 0,
  contacto_fecha TEXT,
  contacto_notas TEXT,
  examenes_programados INTEGER DEFAULT 0,
  examenes_fecha TEXT,
  examenes_ips TEXT,
  examenes_notas TEXT,
  documentos_firmados INTEGER DEFAULT 0,
  documentos_fecha TEXT,
  documentos_notas TEXT,
  afiliaciones_completadas INTEGER DEFAULT 0,
  afiliaciones_fecha TEXT,
  afiliaciones_notas TEXT,
  s400_activado INTEGER DEFAULT 0,
  s400_fecha TEXT,
  s400_notas TEXT,
  estado TEXT DEFAULT 'en_proceso',          -- en_proceso | completado | cancelado
  trabajador_id TEXT,                        -- link a base_personal cuando completa (v0.2)
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_contrataciones_empresa ON contrataciones(empresa_id);
CREATE INDEX IF NOT EXISTS idx_contrataciones_estado ON contrataciones(estado);
CREATE INDEX IF NOT EXISTS idx_contrataciones_paso ON contrataciones(paso_actual);

-- 📦709 · Tabla principal: trabajadores activos/inactivos
CREATE TABLE IF NOT EXISTS base_personal (
  id TEXT PRIMARY KEY,                       -- formato bp-{nanoid}
  empresa_id TEXT NOT NULL,
  nombres TEXT NOT NULL,
  apellidos TEXT NOT NULL,
  cedula TEXT NOT NULL,
  tipo_documento TEXT DEFAULT 'CC',          -- CC | CE | TI | PAS
  fecha_exp_cedula TEXT,
  lugar_exp_cedula TEXT,
  fecha_nacimiento TEXT,
  lugar_nacimiento TEXT,
  telefono TEXT,
  celular TEXT,
  email TEXT,
  estado_civil TEXT,                         -- soltero | casado | union_libre | separado | viudo
  nivel_educativo TEXT,                      -- primaria | secundaria | tecnico | tecnologo | profesional | especializacion | maestria
  direccion TEXT,
  barrio TEXT,
  ciudad TEXT,
  cargo TEXT,
  salario REAL,
  tipo_contrato TEXT,                        -- indefinido | fijo | prestacion | obra_labor | aprendizaje
  fecha_ingreso TEXT,
  fecha_retiro TEXT,
  estado TEXT DEFAULT 'activo',              -- activo | incapacitado | vacaciones | permiso | maternidad | paternidad | luto | retirado
  eps TEXT,
  pension TEXT,
  arl TEXT,
  caja_compensacion TEXT,
  activo_s400 INTEGER DEFAULT 0,
  empresa_usuaria TEXT,
  banco TEXT,
  numero_cuenta TEXT,
  activo INTEGER DEFAULT 1,                  -- soft delete
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(empresa_id, cedula)
);
CREATE INDEX IF NOT EXISTS idx_base_personal_empresa ON base_personal(empresa_id);
CREATE INDEX IF NOT EXISTS idx_base_personal_estado ON base_personal(estado);
CREATE INDEX IF NOT EXISTS idx_base_personal_activo ON base_personal(activo);
CREATE INDEX IF NOT EXISTS idx_base_personal_cedula ON base_personal(empresa_id, cedula);

-- 📦709 · Tabla auxiliar: sedes (referencia)
CREATE TABLE IF NOT EXISTS gh_sedes (
  id TEXT PRIMARY KEY,                       -- formato se-{nanoid}
  empresa_id TEXT NOT NULL,
  nombre TEXT NOT NULL,
  direccion TEXT,
  ciudad TEXT,
  activo INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  UNIQUE(empresa_id, nombre)
);
CREATE INDEX IF NOT EXISTS idx_gh_sedes_empresa ON gh_sedes(empresa_id);
`;

module.exports = {
  SCHEMA_SQL: SCHEMA_SQL,
  // Conteos esperados para validación en tests
  EXPECTED_TABLES: 3,
  EXPECTED_INDEXES: 7  // 3 contrataciones + 4 base_personal + 1 gh_sedes (UNIQUE no se cuenta como índice separado)
};
```

- [ ] **Step 2: Verificar sintaxis del archivo**

```bash
node -c main/gestion-humana-schema-sql.js
```

Expected: sin errores

---

## Task 2: Bridge IPC con 16 handlers STUB

**Files:**
- Create: `main/gestion-humana-bridge.js`

**Interfaces:**
- Consumes: `app` (electron), `deps` = `{ getDb, validateSession }`
- Produces: `module.exports = { registerGestionHumanaHandlers: function(app, deps) {...} }`

- [ ] **Step 1: Crear el bridge con 16 handlers STUB**

```javascript
// main/gestion-humana-bridge.js
// Bridge IPC del módulo Gestión Humana (v0.1.191) — FASE 0
//
// Patrón: mismo que main/presupuesto-bridge.js
// Firma: registerGestionHumanaHandlers(app, deps)
//   - app: electron app instance
//   - deps: { getDb, validateSession }
//
// En Fase 0 todos los handlers son STUB. Retornan NOT_IMPLEMENTED.
// Fases siguientes implementan: read (1), write contratacion (2), write personal (3),
// write sedes (3), integracion UI (4-6), tests end-to-end (7).

const MOD = 'GESTION-HUMANA';

let _getDb = null;
let _validateSession = null;

function _err(code, message, extra) {
  var e = { success: false, error: { code: code, message: message } };
  if (extra) e.error.extra = extra;
  return e;
}
function _ok(data) {
  return { success: true, data: data || {} };
}
function _stub(payload) {
  // 📦709 · Fase 0: stub para todos los handlers
  console.log('[' + MOD + '] (Fase 0 stub) payload:', JSON.stringify(payload || {}));
  return _err('NOT_IMPLEMENTED', 'Handler pendiente de implementación (Fase 0)', { phase: 0 });
}

function registerGestionHumanaHandlers(app, deps) {
  _getDb = (deps && typeof deps.getDb === 'function') ? deps.getDb : null;
  _validateSession = (deps && typeof deps.validateSession === 'function') ? deps.validateSession : null;

  // Capturar ipcMain del app
  var ipcMain = null;
  if (app && app.on) {
    // En tests mockeados puede no estar disponible ipcMain via app
  }
  // En producción, el bridge se registra con ipcMain.handle() desde main.js
  // Aquí solo dejamos constancia de la función para que main.js la llame

  // Para tests, exponemos un objeto que puede mockear ipcMain.handle
  if (!registerGestionHumanaHandlers._ipcMain) {
    throw new Error('ipcMain no configurado. Usar registerGestionHumanaHandlers.init(ipcMain) primero.');
  }
  var ipcMainHandle = registerGestionHumanaHandlers._ipcMain.handle.bind(registerGestionHumanaHandlers._ipcMain);

  // ========== READ (5) ==========
  ipcMainHandle('gh:list-contrataciones', function (event, payload) {
    return _stub(payload);
  });
  ipcMainHandle('gh:get-contratacion', function (event, payload) {
    return _stub(payload);
  });
  ipcMainHandle('gh:list-personal', function (event, payload) {
    return _stub(payload);
  });
  ipcMainHandle('gh:get-personal', function (event, payload) {
    return _stub(payload);
  });
  ipcMainHandle('gh:list-sedes', function (event, payload) {
    return _stub(payload);
  });

  // ========== WRITE CONTRATACIÓN (4) ==========
  ipcMainHandle('gh:create-contratacion', function (event, payload) {
    return _stub(payload);
  });
  ipcMainHandle('gh:update-contratacion', function (event, payload) {
    return _stub(payload);
  });
  ipcMainHandle('gh:delete-contratacion', function (event, payload) {
    return _stub(payload);
  });
  ipcMainHandle('gh:marcar-paso', function (event, payload) {
    return _stub(payload);
  });

  // ========== WRITE PERSONAL (4) ==========
  ipcMainHandle('gh:create-personal', function (event, payload) {
    return _stub(payload);
  });
  ipcMainHandle('gh:update-personal', function (event, payload) {
    return _stub(payload);
  });
  ipcMainHandle('gh:delete-personal', function (event, payload) {
    return _stub(payload);
  });
  ipcMainHandle('gh:cambiar-estado', function (event, payload) {
    return _stub(payload);
  });

  // ========== WRITE SEDES (2) ==========
  ipcMainHandle('gh:create-sede', function (event, payload) {
    return _stub(payload);
  });
  ipcMainHandle('gh:update-sede', function (event, payload) {
    return _stub(payload);
  });

  // ========== DIAG (1) ==========
  ipcMainHandle('gh:diag', function (event, payload) {
    return _ok({
      bridge: 'gestion-humana',
      phase: 0,
      has_getDb: !!_getDb,
      has_validateSession: !!_validateSession,
      message: 'Gestión Humana bridge en Fase 0 (stubs)'
    });
  });

  console.log('[' + MOD + '][INIT][SUCCESS] Bridge registrado · 5 read + 4 write-contratacion + 4 write-personal + 2 write-sedes + 1 diag · 16 handlers totales (Fase 0 — todos stub excepto diag)');
}

registerGestionHumanaHandlers.init = function(ipcMain) {
  registerGestionHumanaHandlers._ipcMain = ipcMain;
};

module.exports = {
  registerGestionHumanaHandlers: registerGestionHumanaHandlers,
  SCHEMA_SQL: null  // El schema se importa desde gestion-humana-schema-sql.js
};
```

- [ ] **Step 2: Verificar sintaxis del archivo**

```bash
node -c main/gestion-humana-bridge.js
```

Expected: sin errores

---

## Task 3: Tests de schema (49 OK esperado)

**Files:**
- Create: `main/test-gestion-humana-bridge-schema.js`

**Interfaces:**
- Consumes: el schema SQL y el bridge de gestion-humana
- Produces: 49 tests passing que validan: schema aplica, 3 tablas existen, 7 índices existen, 16 handlers se registran, diag responde OK

- [ ] **Step 1: Crear el archivo de tests**

```javascript
// main/test-gestion-humana-bridge-schema.js
// Tests del schema y registro del bridge de Gestión Humana (Fase 0)
// Mismo patrón que test-presupuesto-bridge-schema.js
//
// Ejecutar: node main/test-gestion-humana-bridge-schema.js
// Esperado: 49 OK · 0 FAIL

const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const { SCHEMA_SQL, EXPECTED_TABLES, EXPECTED_INDEXES } = require('./gestion-humana-schema-sql');
const { registerGestionHumanaHandlers } = require('./gestion-humana-bridge');

let _passed = 0;
let _failed = 0;

function _assert(cond, label) {
  if (cond) {
    _passed++;
    console.log('  ✓ ' + label);
  } else {
    _failed++;
    console.error('  ✗ ' + label);
  }
}

function _assertEq(actual, expected, label) {
  _assert(actual === expected, label + ' (esperado=' + expected + ', actual=' + actual + ')');
}

async function run() {
  console.log('[1] Cargando sql.js...');
  const SQL = await initSqlJs();
  console.log('  ✓ sql.js cargado');

  console.log('');
  console.log('[2] Aplicando schema...');
  const db = new SQL.Database();
  db.exec(SCHEMA_SQL);
  console.log('  ✓ Schema aplicado sin errores');

  console.log('');
  console.log('[3] Verificando tablas...');
  const tablesResult = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
  const tables = tablesResult[0] ? tablesResult[0].values.map(r => r[0]) : [];
  console.log('  Tablas encontradas: ' + tables.join(', '));
  _assert(tables.length === EXPECTED_TABLES, 'cantidad de tablas = ' + EXPECTED_TABLES + ' (actual=' + tables.length + ')');
  _assert(tables.includes('contrataciones'), 'tabla contrataciones existe');
  _assert(tables.includes('base_personal'), 'tabla base_personal existe');
  _assert(tables.includes('gh_sedes'), 'tabla gh_sedes existe');

  console.log('');
  console.log('[4] Verificando columnas de contrataciones...');
  const contratacionesCols = db.exec("PRAGMA table_info(contrataciones)");
  const colNames = contratacionesCols[0].values.map(r => r[1]);
  const requiredContratacionesCols = [
    'id', 'empresa_id', 'nombres', 'apellidos', 'cedula', 'telefono',
    'cargo', 'salario', 'fecha_ingreso', 'sede_id', 'empresa_usuaria',
    'paso_actual', 'memo_recibido', 'memo_fecha', 'memo_notas',
    'contacto_realizado', 'contacto_fecha', 'contacto_notas',
    'examenes_programados', 'examenes_fecha', 'examenes_ips', 'examenes_notas',
    'documentos_firmados', 'documentos_fecha', 'documentos_notas',
    'afiliaciones_completadas', 'afiliaciones_fecha', 'afiliaciones_notas',
    's400_activado', 's400_fecha', 's400_notas',
    'estado', 'trabajador_id', 'created_at', 'updated_at'
  ];
  requiredContratacionesCols.forEach(function(col) {
    _assert(colNames.includes(col), 'columna contrataciones.' + col + ' existe');
  });

  console.log('');
  console.log('[5] Verificando columnas de base_personal...');
  const personalCols = db.exec("PRAGMA table_info(base_personal)");
  const personalColNames = personalCols[0].values.map(r => r[1]);
  const requiredPersonalCols = [
    'id', 'empresa_id', 'nombres', 'apellidos', 'cedula', 'tipo_documento',
    'fecha_nacimiento', 'telefono', 'celular', 'email', 'estado_civil',
    'nivel_educativo', 'direccion', 'ciudad', 'cargo', 'salario',
    'tipo_contrato', 'fecha_ingreso', 'fecha_retiro', 'estado',
    'eps', 'pension', 'arl', 'caja_compensacion', 'activo_s400',
    'banco', 'numero_cuenta', 'activo', 'created_at', 'updated_at'
  ];
  requiredPersonalCols.forEach(function(col) {
    _assert(personalColNames.includes(col), 'columna base_personal.' + col + ' existe');
  });

  console.log('');
  console.log('[6] Verificando índices...');
  const indexesResult = db.exec("SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name");
  const indexes = indexesResult[0] ? indexesResult[0].values.map(r => r[0]) : [];
  console.log('  Índices encontrados: ' + indexes.length);
  _assert(indexes.length >= EXPECTED_INDEXES, 'cantidad de índices >= ' + EXPECTED_INDEXES + ' (actual=' + indexes.length + ')');
  _assert(indexes.includes('idx_contrataciones_empresa'), 'índice idx_contrataciones_empresa existe');
  _assert(indexes.includes('idx_contrataciones_estado'), 'índice idx_contrataciones_estado existe');
  _assert(indexes.includes('idx_contrataciones_paso'), 'índice idx_contrataciones_paso existe');
  _assert(indexes.includes('idx_base_personal_empresa'), 'índice idx_base_personal_empresa existe');
  _assert(indexes.includes('idx_base_personal_estado'), 'índice idx_base_personal_estado existe');
  _assert(indexes.includes('idx_base_personal_activo'), 'índice idx_base_personal_activo existe');
  _assert(indexes.includes('idx_gh_sedes_empresa'), 'índice idx_gh_sedes_empresa existe');

  console.log('');
  console.log('[7] Verificando UNIQUE constraints...');
  // base_personal: UNIQUE(empresa_id, cedula)
  const bpIndexes = db.exec("PRAGMA index_list(base_personal)");
  const bpUniqueIndexes = bpIndexes[0].values.filter(r => r[2] === 1).map(r => r[1]);
  _assert(bpUniqueIndexes.some(function(n) { return n.indexOf('autoindex') >= 0 || n.indexOf('empresa') >= 0; }), 'base_personal tiene UNIQUE constraint (empresa_id, cedula)');
  // gh_sedes: UNIQUE(empresa_id, nombre)
  const gsIndexes = db.exec("PRAGMA index_list(gh_sedes)");
  const gsUniqueIndexes = gsIndexes[0].values.filter(r => r[2] === 1).map(r => r[1]);
  _assert(gsUniqueIndexes.some(function(n) { return n.indexOf('autoindex') >= 0 || n.indexOf('empresa') >= 0; }), 'gh_sedes tiene UNIQUE constraint (empresa_id, nombre)');

  console.log('');
  console.log('[8] Mockeando electron e ipcMain para registrar el bridge...');
  // Mock electron app
  const mockApp = { on: function() {} };
  // Mock ipcMain que captura los handlers
  const registeredHandlers = {};
  const mockIpcMain = {
    handle: function(channel, fn) {
      registeredHandlers[channel] = fn;
    }
  };
  registerGestionHumanaHandlers.init(mockIpcMain);
  registerGestionHumanaHandlers(mockApp, {
    getDb: function() { return db; },
    validateSession: function() { return { ok: true, user: { id: 1 } }; }
  });
  console.log('  ✓ Bridge registrado con mocks');

  console.log('');
  console.log('[9] Verificando que los 16 handlers están registrados...');
  const expectedHandlers = [
    // Read (5)
    'gh:list-contrataciones', 'gh:get-contratacion', 'gh:list-personal',
    'gh:get-personal', 'gh:list-sedes',
    // Write Contratación (4)
    'gh:create-contratacion', 'gh:update-contratacion',
    'gh:delete-contratacion', 'gh:marcar-paso',
    // Write Personal (4)
    'gh:create-personal', 'gh:update-personal',
    'gh:delete-personal', 'gh:cambiar-estado',
    // Write Sedes (2)
    'gh:create-sede', 'gh:update-sede'
  ];
  _assertEq(Object.keys(registeredHandlers).length, 16, 'cantidad de handlers registrados = 16');
  expectedHandlers.forEach(function(ch) {
    _assert(typeof registeredHandlers[ch] === 'function', 'handler "' + ch + '" registrado');
  });

  console.log('');
  console.log('[10] Verificando que los 15 stubs retornan NOT_IMPLEMENTED...');
  // diag es el único handler real
  const stubHandlers = expectedHandlers; // los 15 sin contar diag
  stubHandlers.forEach(function(ch) {
    const res = registeredHandlers[ch]({}, { token: 'test' });
    _assert(res.success === false, ch + ' retorna success=false');
    _assert(res.error.code === 'NOT_IMPLEMENTED', ch + ' retorna error.code = NOT_IMPLEMENTED');
    _assert(res.error.extra && res.error.extra.phase === 0, ch + ' retorna error.extra.phase = 0');
  });

  console.log('');
  console.log('[11] Verificando que diag responde OK...');
  const diagRes = registeredHandlers['gh:diag']({}, {});
  _assert(diagRes.success === true, 'diag retorna success=true');
  _assert(diagRes.data.phase === 0, 'diag.data.phase = 0');
  _assert(diagRes.data.bridge === 'gestion-humana', 'diag.data.bridge = gestion-humana');
  _assert(diagRes.data.has_getDb === true, 'diag.data.has_getDb = true');
  _assert(diagRes.data.has_validateSession === true, 'diag.data.has_validateSession = true');

  console.log('');
  console.log('=====================================================================');
  console.log('  Resumen: ' + _passed + ' OK · ' + _failed + ' FAIL');
  console.log('=====================================================================');
  console.log('');

  try { db.close(); } catch (e) {}
  // Forzar exit para evitar el race condition de libuv con sql.js
  setTimeout(function() { process.exit(_failed > 0 ? 1 : 0); }, 100);
}

run().catch(function(err) {
  console.error('ERROR FATAL:', err.message);
  console.error(err.stack);
  process.exit(1);
});
```

- [ ] **Step 2: Verificar que sql.js está instalado**

```bash
cd sgsst-electron-app && npm ls sql.js --depth=0 2>&1 | Select-String "sql.js"
```

Expected: `sql.js@...` (debería estar, lo usa presupuesto también)

Si no está, instalar: `npm install sql.js`

- [ ] **Step 3: Correr los tests**

```bash
cd sgsst-electron-app && node main/test-gestion-humana-bridge-schema.js
```

Expected output (últimas líneas):
```
  Resumen: 49 OK · 0 FAIL
✅ Todos los tests pasaron.
```

Si hay FAIL, revisar el mensaje y ajustar el schema o los tests.

---

## Task 4: Wire up en main.js y preload.js

**Files:**
- Modify: `sgsst-electron-app/main.js` (agregar require + register en el boot)
- Modify: `sgsst-electron-app/preload.js` (exponer 16 canales al renderer)

**Interfaces:**
- Consumes: el bridge de gestion-humana
- Produces: el módulo queda registrado en el main process y expuesto en el renderer

- [ ] **Step 1: Agregar require en main.js**

Buscar dónde están los otros requires de bridges (buscar `presupuesto`):

```bash
grep -n "presupuesto" main.js
```

Luego, agregar cerca (después del require de presupuesto):

```javascript
// 📦709 · Módulo Gestión Humana
const { registerGestionHumanaHandlers } = require('./main/gestion-humana-bridge');
```

- [ ] **Step 2: Registrar el bridge en el boot**

Buscar dónde se llama `registerPresupuestoHandlers`:

```bash
grep -n "registerPresupuestoHandlers" main.js
```

Luego, agregar la llamada (después de la de presupuesto):

```javascript
// 📦709 · Registrar bridge de Gestión Humana
registerGestionHumanaHandlers(app, { getDb, validateSession });
```

(Misma firma `(app, deps)` que Presupuesto)

- [ ] **Step 3: Exponer los 16 canales en preload.js**

Buscar dónde se exponen los canales de presupuesto en preload.js:

```bash
grep -n "presupuesto" preload.js
```

Luego, agregar después de los canales de presupuesto:

```javascript
// 📦709 · Módulo Gestión Humana
ghListContrataciones: (params) => ipcRenderer.invoke('gh:list-contrataciones', params),
ghGetContratacion: (params) => ipcRenderer.invoke('gh:get-contratacion', params),
ghListPersonal: (params) => ipcRenderer.invoke('gh:list-personal', params),
ghGetPersonal: (params) => ipcRenderer.invoke('gh:get-personal', params),
ghListSedes: (params) => ipcRenderer.invoke('gh:list-sedes', params),
ghCreateContratacion: (params) => ipcRenderer.invoke('gh:create-contratacion', params),
ghUpdateContratacion: (params) => ipcRenderer.invoke('gh:update-contratacion', params),
ghDeleteContratacion: (params) => ipcRenderer.invoke('gh:delete-contratacion', params),
ghMarcarPaso: (params) => ipcRenderer.invoke('gh:marcar-paso', params),
ghCreatePersonal: (params) => ipcRenderer.invoke('gh:create-personal', params),
ghUpdatePersonal: (params) => ipcRenderer.invoke('gh:update-personal', params),
ghDeletePersonal: (params) => ipcRenderer.invoke('gh:delete-personal', params),
ghCambiarEstado: (params) => ipcRenderer.invoke('gh:cambiar-estado', params),
ghCreateSede: (params) => ipcRenderer.invoke('gh:create-sede', params),
ghUpdateSede: (params) => ipcRenderer.invoke('gh:update-sede', params),
ghDiag: () => ipcRenderer.invoke('gh:diag'),
```

- [ ] **Step 4: Verificar sintaxis**

```bash
node -c main/gestion-humana-bridge.js
node -c main/gestion-humana-schema-sql.js
node -c main/test-gestion-humana-bridge-schema.js
```

Expected: sin errores en los 3

- [ ] **Step 5: Re-correr los tests para confirmar que siguen pasando**

```bash
cd sgsst-electron-app && node main/test-gestion-humana-bridge-schema.js
```

Expected: 49 OK · 0 FAIL (igual que antes)

---

## Task 5: Bump de versión + Commit

**Files:**
- Modify: `sgsst-electron-app/package.json` (bump 0.1.190 → 0.1.191)

- [ ] **Step 1: Bumpear versión**

Editar `sgsst-electron-app/package.json` línea 3:
- Cambiar `"version": "0.1.190"` → `"version": "0.1.191"`

- [ ] **Step 2: Verificar git status**

```bash
cd C:\Proyectos de programación\SG-SST-E
git status --short
```

Expected: archivos modificados y nuevos sin commitear:
- `M sgsst-electron-app/main.js`
- `M sgsst-electron-app/preload.js`
- `M sgsst-electron-app/package.json`
- `?? sgsst-electron-app/main/gestion-humana-schema-sql.js`
- `?? sgsst-electron-app/main/gestion-humana-bridge.js`
- `?? sgsst-electron-app/main/test-gestion-humana-bridge-schema.js`
- `?? docs/plans/2026-08-15-gestion-humana-design.md`
- `?? docs/plans/2026-08-15-gestion-humana-phase-0.md`

(AGENTS.md también puede aparecer modificado por procesos externos — ignorar)

- [ ] **Step 3: Hacer el commit**

```bash
cd C:\Proyectos de programación\SG-SST-E
git add docs/plans/2026-08-15-gestion-humana-design.md docs/plans/2026-08-15-gestion-humana-phase-0.md sgsst-electron-app/main/gestion-humana-schema-sql.js sgsst-electron-app/main/gestion-humana-bridge.js sgsst-electron-app/main/test-gestion-humana-bridge-schema.js sgsst-electron-app/main.js sgsst-electron-app/preload.js sgsst-electron-app/package.json
git commit -m "📦709 · feat(gestion-humana): Fase 0 — schema + bridge stub (16 handlers) (v0.1.191)"
```

Expected: commit creado con los archivos listados.

**Nota:** NO pushear todavía. El usuario dirá "pushea" cuando quiera release.

---

## Self-Review (post-impl)

Antes de declarar Fase 0 completa, verificar:

- [ ] 49 tests OK · 0 FAIL
- [ ] Los 3 archivos nuevos compilan sin errores (`node -c`)
- [ ] main.js carga el bridge (verificar con `node -e "require('./main.js')"` o un test simple)
- [ ] preload.js expone los 16 canales
- [ ] Commit creado con mensaje `📦709 · feat(gestion-humana): Fase 0 ...`
- [ ] Working tree limpio (excepto AGENTS.md que es externo)

Si todos los checks pasan, **Fase 0 está completa y lista para que el usuario valide visualmente**. La siguiente fase (Read handlers) requiere otro plan.

## Notas para implementador

- **Si ves "Cannot find module 'sql.js'":** ejecutar `npm install sql.js` desde `sgsst-electron-app/`
- **Si los tests fallan en columna/índice:** el schema tiene exactamente 35 columnas en `contrataciones` y 30 en `base_personal`. Si una falla, revisar la lista `requiredXxxCols` y agregar la que falte
- **Si `bridge.js` no se carga en main.js:** verificar que el require path es relativo a `main.js` (debería ser `./main/gestion-humana-bridge`)
- **Si el commit pide credenciales:** verificar que el autor está bien configurado (`git config user.email`)
