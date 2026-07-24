// test-profesiograma-strict.js
//
// Test estricto del bridge con mock que valida que los placeholders de cada
// INSERT coincidan con el número de argumentos del .run().

'use strict';

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

class StrictDb {
  constructor() {
    this.tables = new Map();
    this.errors = [];
  }
  _tableCols(name) {
    const m = name.match(/\(([^)]+)\)/);
    if (!m) return null;
    return m[1].split(',').map(c => c.trim().split(/\s+/)[0]);
  }
  prepare(sql) {
    const db = this;
    // Detectar INSERT
    const insertMatch = sql.match(/INSERT\s+(?:OR\s+IGNORE\s+)?INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
    if (insertMatch) {
      const table = insertMatch[1];
      const cols = insertMatch[2].split(',').map(c => c.trim());
      const vals = insertMatch[3];
      // Contar placeholders y literales
      const parts = vals.split(',').map(p => p.trim());
      const ph = parts.filter(p => p === '?').length;
      const lit = parts.length - ph;
      return {
        run: function (...args) {
          // Validar que el número de placeholders coincida con el número de args
          if (args.length !== ph) {
            db.errors.push(`❌ ${table}: ${ph} placeholders pero ${args.length} args. SQL: ${sql.trim().substring(0, 80)}`);
            return { changes: 0, lastInsertRowid: 0 };
          }
          // Almacenar
          if (!db.tables.has(table)) db.tables.set(table, []);
          const row = {};
          cols.forEach((c, i) => row[c] = args[i]);
          db.tables.get(table).push(row);
          return { changes: 1, lastInsertRowid: db.tables.get(table).length };
        },
        get: function (...args) {
          // COUNT(*) o SELECT
          const selCount = sql.match(/SELECT\s+COUNT\(\*\)\s+as\s+(\w+)\s+FROM\s+(\w+)/i);
          if (selCount) {
            const tbl = selCount[2];
            return { c: (db.tables.get(tbl) || []).length };
          }
          // SELECT id FROM kp_X WHERE codigo = 'DEFAULT' LIMIT 1
          const whereCode = sql.match(/FROM\s+(\w+)\s+WHERE\s+(\w+)\s*=\s*\?/i);
          if (whereCode) {
            const tbl = whereCode[1];
            const col = whereCode[2];
            return (db.tables.get(tbl) || []).find(r => r[col] === args[0]);
          }
          return null;
        },
        all: function () { return []; }
      };
    }
    // Otros: SELECT, UPDATE, DELETE — passthrough
    return {
      run: function () { return { changes: 0 }; },
      get: function () { return null; },
      all: function () { return []; }
    };
  }
  exec() {}
}

const bridge = require('./main/profesiograma-bridge.js');
const db = new StrictDb();
bridge.registerProfesiogramaHandlers(null, {
  getDb: () => db,
  getCompanyRoot: () => null
});

const EXCEL = 'C:\\Users\\jrf20\\AppData\\Local\\Temp\\kair-preview-extract\\upload\\GI-FO-047 Profesiograma Tempoactiva.xlsx';
const fs = require('fs');
if (!fs.existsSync(EXCEL)) {
  console.error('ERROR: Excel no encontrado');
  process.exit(1);
}

async function main() {
  console.log('================================================================');
  console.log('TEST ESTRICTO: import con validación de placeholders');
  console.log('================================================================\n');

  const res = await handlers['profesiograma:import-excel']({}, { filePath: EXCEL });

  console.log('Resultado del import:', res.success ? '✅' : '❌');
  if (res.success) {
    console.log('Stats:', JSON.stringify(res.data.stats));
    console.log('Tablas con datos:');
    db.tables.forEach((rows, name) => console.log('  ' + name + ': ' + rows.length + ' filas'));
  }

  if (db.errors.length > 0) {
    console.log('\n❌ ERRORES DE PARÁMETROS DETECTADOS:');
    db.errors.forEach(e => console.log('  ' + e));
    process.exit(1);
  } else {
    console.log('\n✅ Todos los INSERT tienen número correcto de placeholders y args');
  }
  process.exit(0);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
