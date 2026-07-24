// test-profesiograma-handlers.js
//
// Test completo del bridge profesiograma:
// 1) Ejecuta el import del Excel real
// 2) Verifica que el mock DB almacenó los datos
// 3) Ejecuta los handlers de LIST (kpis, matriz, pruebas, etc.) contra los datos importados
// 4) Verifica que los datos importados son recuperables via los handlers de lectura
//
// Ejecución:  node test-profesiograma-handlers.js

'use strict';

const path = require('path');
const fs = require('fs');

const EXCEL = 'C:\\Users\\jrf20\\AppData\\Local\\Temp\\kair-preview-extract\\upload\\GI-FO-047 Profesiograma Tempoactiva.xlsx';

if (!fs.existsSync(EXCEL)) {
  console.error('ERROR: No se encontró el archivo Excel:', EXCEL);
  process.exit(1);
}

// ============================================================================
// MOCK DE BETTER-SQLITE3 — almacena los datos en memoria
// ============================================================================
class MockTable {
  constructor() { this.rows = []; }
  insert(row) { this.rows.push(row); return { changes: 1 }; }
  update(id, cambios) {
    const idx = this.rows.findIndex(r => r.id === id);
    if (idx < 0) return { changes: 0 };
    Object.assign(this.rows[idx], cambios);
    return { changes: 1 };
  }
  delete(id) {
    const i = this.rows.findIndex(r => r.id === id);
    if (i < 0) return { changes: 0 };
    this.rows.splice(i, 1);
    return { changes: 1 };
  }
  all(where) { return where ? this.rows.filter(where) : this.rows.slice(); }
  get(id) { return this.rows.find(r => r.id === id); }
  count() { return this.rows.length; }
}

class MockDb {
  constructor() {
    this.tables = {
      kp_profesiograma: new MockTable(),
      kp_grupo_ocupacional: new MockTable(),
      kp_cargo: new MockTable(),
      kp_tipo_examen: new MockTable(),
      kp_cargo_examen: new MockTable(),
      kp_descripcion_prueba: new MockTable(),
      kp_recomendacion: new MockTable(),
      kp_altura_requisito: new MockTable(),
      kp_vacuna: new MockTable(),
      kp_vacunacion_cargo: new MockTable(),
    };
    this.execHistory = [];
  }
  prepare(sql) {
    const self = this;
    return {
      run: function (...args) {
        const op = sql.trim().split(/\s+/)[0].toUpperCase();
        if (op === 'INSERT' || op === 'INSERT OR IGNORE') {
          // Parsear nombre tabla y valores
          const m = sql.match(/INSERT\s+(?:OR\s+IGNORE\s+)?INTO\s+(\w+)\s*\(([^)]+)\)/i);
          if (m) {
            const table = m[1];
            const cols = m[2].split(',').map(c => c.trim());
            const row = {};
            cols.forEach((c, i) => row[c] = args[i]);
            return self.tables[table].insert(row);
          }
        } else if (op === 'UPDATE') {
          const m = sql.match(/UPDATE\s+(\w+)\s+SET\s+(.+?)\s+WHERE\s+id\s*=\s*\?/i);
          if (m) {
            const table = m[1];
            const setClause = m[2];
            const id = args[args.length - 1];
            const cambios = {};
            const sets = setClause.split(',').map(s => s.trim());
            sets.forEach((s, i) => {
              const [col] = s.split('=');
              cambios[col.trim()] = args[i];
            });
            return self.tables[table].update(id, cambios);
          }
        } else if (op === 'DELETE') {
          const m = sql.match(/DELETE\s+FROM\s+(\w+)\s+WHERE\s+id\s*=\s*\?/i);
          if (m) {
            const id = args[0];
            return self.tables[m[1]].delete(id);
          }
        }
        return { changes: 1 };
      },
      get: function (...args) {
        // Para COUNT(*) y SELECT
        const sel = sql.match(/SELECT\s+(?:COUNT\(\*\)\s+as\s+(\w+)|.+?)\s+FROM\s+(\w+)/i);
        if (sel) {
          const table = sel[2];
          if (sel[1] === 'c') {
            return { c: self.tables[table].count() };
          }
          return self.tables[table].rows[0];
        }
        const m = sql.match(/FROM\s+(\w+).*?WHERE\s+(\w+)\.id\s*=\s*\?/i);
        if (m) {
          const id = args[0];
          return self.tables[m[1]].get(id);
        }
        return self.tables[sel ? sel[2] : null]?.rows[0] || null;
      },
      all: function (...args) {
        const sel = sql.match(/FROM\s+(\w+)/i);
        if (sel) {
          const table = sel[1];
          return self.tables[table].rows.slice();
        }
        return [];
      }
    };
  }
  exec(sql) {
    this.execHistory.push(sql);
  }
}

// ============================================================================
// MOCK DE ELECTRON
// ============================================================================
const Module = require('module');
const orig = Module.prototype.require;
const handlers = {};
Module.prototype.require = function(name) {
  if (name === 'electron') {
    return {
      ipcMain: { handle: (ch, fn) => { handlers[ch] = fn; } },
      dialog: { showOpenDialog: async () => ({ canceled: true, filePaths: [] }) }
    };
  }
  return orig.apply(this, arguments);
};

const bridge = require('./main/profesiograma-bridge.js');
const db = new MockDb();
bridge.registerProfesiogramaHandlers(null, {
  getDb: () => db,
  getCompanyRoot: () => null
});

// ============================================================================
// TEST
// ============================================================================
async function main() {
  console.log('================================================================');
  console.log('TEST: Bridge profesiograma — import + list handlers');
  console.log('================================================================\n');

  // Paso 1: Import del Excel
  console.log('▶ Paso 1: Ejecutando import del Excel...');
  const importRes = await handlers['profesiograma:import-excel']({}, { filePath: EXCEL });
  if (!importRes.success) {
    console.error('FAIL import:', importRes.error);
    process.exit(1);
  }
  console.log('  ✅ Import OK:', importRes.data.stats);

  // Paso 2: Verificar que las tablas tienen datos
  console.log('\n▶ Paso 2: Verificando datos en mock DB...');
  const expected = {
    kp_grupo_ocupacional: 5,
    kp_cargo: 21,
    kp_tipo_examen: 20,
    kp_cargo_examen: 105,
    kp_descripcion_prueba: 10,
    kp_recomendacion: 8,
    kp_altura_requisito: 2,
    kp_vacuna: 4,
  };
  let pass2 = 0, fail2 = 0;
  Object.keys(expected).forEach(t => {
    const actual = db.tables[t].count();
    if (actual === expected[t]) { console.log('  ✅', t, '=', actual); pass2++; }
    else { console.log('  ❌', t, '=', actual, '(esperado ' + expected[t] + ')'); fail2++; }
  });

  // Paso 3: Llamar handlers de list y verificar que retornan los datos
  console.log('\n▶ Paso 3: Listando datos via handlers IPC...');
  const listTests = [
    { name: 'kpis', handler: 'profesiograma:kpis', validate: r => r.totalCargos === 21 && r.totalGrupos === 5 && r.totalTiposExamen === 20 && r.totalVacunas === 4 },
    { name: 'matriz', handler: 'profesiograma:matriz', validate: r => r.cargos && r.cargos.length === 21 && r.tiposExamen && r.tiposExamen.length === 20 },
    { name: 'cargos:list', handler: 'profesiograma:cargos:list', validate: r => Array.isArray(r) && r.length === 21 },
    { name: 'tipo-examen:list', handler: 'profesiograma:tipo-examen:list', validate: r => Array.isArray(r) && r.length === 20 },
    { name: 'pruebas:list', handler: 'profesiograma:pruebas:list', validate: r => Array.isArray(r) && r.length === 10 },
    { name: 'recomendaciones:list', handler: 'profesiograma:recomendaciones:list', validate: r => Array.isArray(r) && r.length === 8 },
    { name: 'alturas:list', handler: 'profesiograma:alturas:list', validate: r => Array.isArray(r) && r.length === 2 },
    { name: 'vacunacion:list', handler: 'profesiograma:vacunacion:list', validate: r => r.vacunas && r.vacunas.length === 4 },
    { name: 'grupo-ocupacional:list', handler: 'profesiograma:grupo-ocupacional:list', validate: r => Array.isArray(r) && r.length === 5 },
  ];
  let pass3 = 0, fail3 = 0;
  for (const t of listTests) {
    try {
      const r = await handlers[t.handler]({}, {});
      if (r.success && t.validate(r.data)) {
        console.log('  ✅', t.name, 'OK');
        pass3++;
      } else {
        console.log('  ❌', t.name, '— respuesta:', JSON.stringify(r).substring(0, 150));
        fail3++;
      }
    } catch (e) {
      console.log('  ❌', t.name, '— excepción:', e.message);
      fail3++;
    }
  }

  // Paso 4: Probar CRUD básico (crear un cargo nuevo, leerlo, eliminarlo)
  console.log('\n▶ Paso 4: CRUD básico...');
  const newCargo = {
    nombre: 'TEST_CARGO_E2E',
    descripcion: 'Cargo de prueba',
    peligrosRiesgos: 'Ninguno',
    profesiogramaId: importRes.data.profesiogramaId
  };
  const saveRes = await handlers['profesiograma:cargos:save']({}, newCargo);
  let pass4 = 0, fail4 = 0;
  if (saveRes.success && saveRes.data.created) {
    console.log('  ✅ cargos:save (create) OK, id =', saveRes.data.id);
    pass4++;
    // Verificar que aparece en la lista
    const listAfter = await handlers['profesiograma:cargos:list']({}, {});
    if (listAfter.success && listAfter.data.length === 22) {
      console.log('  ✅ cargos:list refleja el nuevo (22 cargos)');
      pass4++;
    } else {
      console.log('  ❌ cargos:list no refleja el nuevo');
      fail4++;
    }
    // Eliminar
    const delRes = await handlers['profesiograma:cargos:delete']({}, { id: saveRes.data.id });
    if (delRes.success && delRes.data.deleted) {
      console.log('  ✅ cargos:delete OK');
      pass4++;
    } else {
      console.log('  ❌ cargos:delete fail:', JSON.stringify(delRes));
      fail4++;
    }
  } else {
    console.log('  ❌ cargos:save fail:', JSON.stringify(saveRes));
    fail4++;
  }

  // Resumen
  const total = pass2 + pass3 + pass4;
  const failed = fail2 + fail3 + fail4;
  console.log('\n================================================================');
  console.log('RESUMEN: ' + total + ' OK, ' + failed + ' FAIL');
  console.log('  - DB storage:  ' + pass2 + ' OK, ' + fail2 + ' FAIL');
  console.log('  - List handlers: ' + pass3 + ' OK, ' + fail3 + ' FAIL');
  console.log('  - CRUD básico:  ' + pass4 + ' OK, ' + fail4 + ' FAIL');
  console.log('================================================================');

  process.exit(failed === 0 ? 0 : 1);
}

main().catch(err => {
  console.error('ERROR FATAL:', err);
  process.exit(1);
});
