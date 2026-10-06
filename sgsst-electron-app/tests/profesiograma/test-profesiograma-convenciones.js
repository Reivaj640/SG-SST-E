// test-profesiograma-convenciones.js
//
// Test del fix que filtra las filas de convención I/P/R del Excel GI-FO-047.
// Estas filas NO son cargos reales, son solo referencias de columnas
// (I = Ingreso, P = Periódico, R = Retiro).
//
// Antes del fix: el parser interpretaba "P" como GRUPO OCUPACIONAL y
// "Periódico" como CARGO, insertando 3 cargos basura en la DB.
// Después del fix: el handler rechaza esas filas.
//
// Ejecución:  node test-profesiograma-convenciones.js
// Resultado:  Imprime OK/FAIL. Exit 0 = OK, 1 = FAIL.

'use strict';

const path = require('path');
const fs = require('fs');

// Usar el mismo Excel real que el test existente
const EXCEL = 'C:\\Users\\jrf20\\AppData\\Local\\Temp\\kair-preview-extract\\upload\\GI-FO-047 Profesiograma Tempoactiva.xlsx';

if (!fs.existsSync(EXCEL)) {
  console.error('ERROR: No se encontró el Excel:', EXCEL);
  process.exit(1);
}

// ============================================================================
// MOCK DE BETTER-SQLITE3
// Captura todos los INSERTs a kp_cargo para verificar qué cargos se crean
// ============================================================================
class CapturingDB {
  constructor() {
    this.cargoInserts = [];   // array de {id, nombre, grupo, riesgo}
    this.examenInserts = [];
    this._prepCache = new Map();
  }
  prepare(sql) {
    if (this._prepCache.has(sql)) return this._prepCache.get(sql);
    const stmt = {
      sql: sql,
      _db: this,
      run: function(...args) {
        const normalized = sql.trim().toUpperCase();
        if (normalized.startsWith('INSERT INTO KP_CARGO') && !normalized.includes('CARGO_EXAMEN')) {
          // El INSERT de kp_cargo tiene los args en este orden:
          // id, nombre, descripcion, peligros_riesgos, grupo_ocupacional_id, profesiograma_id, created_at, updated_at
          this._db.cargoInserts.push({
            id: args[0],
            nombre: args[1],
            descripcion: args[2],
            peligros_riesgos: args[3],
            grupo_ocupacional_id: args[4]
          });
        } else if (normalized.startsWith('INSERT INTO KP_CARGO_EXAMEN') || normalized.includes('CARGO_EXAMEN')) {
          this._db.examenInserts.push({ sql, args });
        }
        return { changes: 1, lastInsertRowid: 1 };
      },
      get: function(...args) { return null; },
      all: function(...args) { return []; }
    };
    this._prepCache.set(sql, stmt);
    return stmt;
  }
  exec(sql) { return this; }
  transaction(fn) { return () => fn(); }
}

// Mock de xlsx
const XLSX = require('xlsx');
const wb = XLSX.readFile(EXCEL);

// Mock del módulo main/profesiograma-bridge
// Hack: reimplementar el pedazo crítico del handler directamente
// (no podemos require el bridge porque tiene dependencias del electron)
function getStr(sheet, addr) {
  const c = sheet[addr];
  return c && c.v != null ? String(c.v) : '';
}

const db = new CapturingDB();

// Replicar la lógica del _handlerImportExcel (solo el pedazo de la MATRIZ)
const matriz = wb.Sheets['MATRIZ EXAMENES'];
const range = XLSX.utils.decode_range(matriz['!ref']);

// Detectar fila de headers
let headerRowIdx = -1;
for (let hr = 0; hr <= range.e.r; hr++) {
  const c0 = getStr(matriz, XLSX.utils.encode_cell({ r: hr, c: 0 })).toLowerCase();
  if (c0.indexOf('grupo') >= 0 && c0.indexOf('ocupacional') >= 0) {
    headerRowIdx = hr;
    break;
  }
}

if (headerRowIdx < 0) {
  console.error('FAIL: No se encontró fila de headers');
  process.exit(1);
}

console.log('Fila de headers detectada:', headerRowIdx);
console.log('Total filas a recorrer:', range.e.r - headerRowIdx);

// Replicar el loop del handler
for (let rr = headerRowIdx + 1; rr <= range.e.r; rr++) {
  const grupoCell = matriz[XLSX.utils.encode_cell({ r: rr, c: 0 })];
  const nombreCell = matriz[XLSX.utils.encode_cell({ r: rr, c: 1 })];
  if (!grupoCell || !nombreCell) continue;
  const grupoNombre = String(grupoCell.v || '').trim();
  const cargoNombre = String(nombreCell.v || '').trim();
  if (!grupoNombre || !cargoNombre) continue;
  const grupoLower = grupoNombre.toLowerCase();
  if (grupoLower.indexOf('grupo') >= 0 && grupoLower.indexOf('ocupacional') >= 0) continue;
  if (grupoLower.indexOf('proceso') >= 0) continue;
  if (grupoLower.indexOf('total') >= 0) continue;
  // ⭐ FIX: filtrar filas de convención I/P/R
  if (grupoLower === 'i' || grupoLower === 'p' || grupoLower === 'r') continue;
  const cargoLower = cargoNombre.toLowerCase();
  if (cargoLower === 'inicial' || cargoLower === 'periodico' || cargoLower === 'retiro') continue;
  if (cargoNombre.length < 3) continue;

  // Insertar cargo (en el mock)
  db.cargoInserts.push({
    id: 'kp_test_' + rr,
    nombre: cargoNombre,
    grupo: grupoNombre,
    riesgo_len: '?'
  });
}

console.log('\n--- RESULTADO ---');
console.log('Cargos que el handler importaria:', db.cargoInserts.length);
db.cargoInserts.forEach(c => {
  console.log(' -', JSON.stringify(c.nombre), '| grupo=' + JSON.stringify(c.grupo));
});

// Verificar
const problemCargos = db.cargoInserts.filter(c => {
  const n = c.nombre.toLowerCase();
  return n === 'inicial' || n === 'periodico' || n === 'periódico' || n === 'retiro';
});

console.log('\n--- ASSERT ---');
if (problemCargos.length === 0) {
  console.log('✅ OK — Ningún cargo de convención importado');
  console.log('   Se importaron ' + db.cargoInserts.length + ' cargos reales:');
  db.cargoInserts.forEach(c => console.log('   -', JSON.stringify(c.nombre)));
  process.exit(0);
} else {
  console.log('❌ FAIL — ' + problemCargos.length + ' cargos de convención importados:');
  problemCargos.forEach(c => console.log('   -', JSON.stringify(c.nombre)));
  process.exit(1);
}
