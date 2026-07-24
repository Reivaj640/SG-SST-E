// test-profesiograma-export.js
//
// Test del flujo de export: genera un XLSX con todas las hojas
// y verifica que el archivo se pueda leer de vuelta con xlsx.

'use strict';

const Module = require('module');
const orig = Module.prototype.require;
const handlers = {};
Module.prototype.require = function(name) {
  if (name === 'electron') {
    return {
      ipcMain: { handle: (ch, fn) => { handlers[ch] = fn; } },
      dialog: {
        showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
        showSaveDialog: async (opts) => {
          // Devolver una ruta temporal
          return { canceled: false, filePath: opts && opts.defaultPath ? require('path').join(require('os').tmpdir(), 'test-' + Date.now() + '-' + opts.defaultPath) : require('path').join(require('os').tmpdir(), 'test.xlsx') };
        }
      }
    };
  }
  return orig.apply(this, arguments);
};

// Mock de DB con data completa
class MockDb {
  constructor() {
    this.grupos = [
      { id: 'g1', nombre: 'ADMINISTRATIVO', descripcion: null },
      { id: 'g2', nombre: 'OPERATIVO', descripcion: 'Cargos operativos' }
    ];
    this.tipos = [
      { id: 't1', nombre: 'AUDIOMETRIA', categoria: 'EVALUACION_MEDICA', descripcion: null, orden: 1, activo: 1 },
      { id: 't2', nombre: 'OPTOMETRIA', categoria: 'EVALUACION_MEDICA', descripcion: null, orden: 2, activo: 1 },
      { id: 't3', nombre: 'ESPIROMETRIA', categoria: 'PRUEBAS_COMPLEMENTARIAS', descripcion: 'Capacidad pulmonar', orden: 5, activo: 1 }
    ];
    this.cargos = [
      { id: 'c1', nombre: 'ADMINISTRATIVO', descripcion: 'Atender al público', peligros_riesgos: 'Pantalla', grupo_ocupacional_id: 'g1', profesiograma_id: 'p1' },
      { id: 'c2', nombre: 'AUXILIAR DE COCINA', descripcion: 'Preparar alimentos', peligros_riesgos: 'Calor', grupo_ocupacional_id: 'g2', profesiograma_id: 'p1' }
    ];
    this.cargoExamen = [
      { id: 'ce1', cargo_id: 'c1', tipo_examen_id: 't1', ingreso: 1, periodico: 0, retiro: 0 },
      { id: 'ce2', cargo_id: 'c1', tipo_examen_id: 't2', ingreso: 1, periodico: 1, retiro: 0 },
      { id: 'ce3', cargo_id: 'c2', tipo_examen_id: 't1', ingreso: 0, periodico: 0, retiro: 1 },
      { id: 'ce4', cargo_id: 'c2', tipo_examen_id: 't3', ingreso: 1, periodico: 1, retiro: 1 }
    ];
    this.descripcionPruebas = [
      { id: 'dp1', tipo_examen: 'AUDIOMETRIA', personal_objetivo: 'Mayores 18', ingreso: 'Audiometría tonal', periodico: 'Audiometría anual', retiro: 'Audiometría', referencia: 'GATI', orden: 1 },
      { id: 'dp2', tipo_examen: 'OPTOMETRIA', personal_objetivo: 'Conductores', ingreso: 'Agudeza visual', periodico: 'Anual', retiro: 'Agudeza visual', referencia: '', orden: 2 }
    ];
    this.recomendaciones = [
      { id: 'r1', factor_riesgo: 'Ruido', definicion: 'Exposición >85dB', examenes: 'Audiometría', pruebas_especificas: 'Timpanometría', restricciones: 'Uso de protección auditiva', orden: 1 }
    ];
    this.alturas = [
      { id: 'a1', actividad_riesgo: 'Trabajo en postes', hallazgos_limitantes: 'Vértigo', paraclinicos: 'Examen neurológico', observaciones: 'Certificación anual', orden: 1 }
    ];
    this.vacunas = [
      { id: 'v1', nombre: 'INFLUENZA', recomendacion: 'Anual', esquema: '1 dosis anual', orden: 1, activa: 1 },
      { id: 'v2', nombre: 'HEPATITIS B', recomendacion: 'Personal salud', esquema: '3 dosis', orden: 2, activa: 1 }
    ];
  }
  prepare(sql) {
    const db = this;
    return {
      run: function () { return { changes: 0 }; },
      get: function () { return null; },
      all: function () {
        if (sql.match(/FROM kp_grupo_ocupacional/)) return db.grupos.slice();
        if (sql.match(/FROM kp_tipo_examen/)) return db.tipos.slice();
        if (sql.match(/FROM kp_cargo c/)) return db.cargos.slice();
        if (sql.match(/FROM kp_cargo_examen/)) return db.cargoExamen.slice();
        if (sql.match(/FROM kp_descripcion_prueba/)) return db.descripcionPruebas.slice();
        if (sql.match(/FROM kp_recomendacion/)) return db.recomendaciones.slice();
        if (sql.match(/FROM kp_altura_requisito/)) return db.alturas.slice();
        if (sql.match(/FROM kp_vacuna/)) return db.vacunas.slice();
        return [];
      }
    };
  }
  exec() {}
}

const bridge = require('./main/profesiograma-bridge.js');
const db = new MockDb();
bridge.registerProfesiogramaHandlers(null, {
  getDb: () => db,
  getCompanyRoot: () => null
});

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function main() {
  console.log('================================================================');
  console.log('TEST: Export del profesiograma a Excel');
  console.log('================================================================\n');

  let pass = 0, fail = 0;

  // Test 1: Select save path
  console.log('▶ Test 1: Select save path');
  let r = await handlers['profesiograma:select-save-path']({}, { defaultName: 'test-export.xlsx' });
  if (r.success && r.data && r.data.filePath) {
    console.log('  ✅ OK — ruta:', r.data.filePath);
    pass++;
  } else {
    console.log('  ❌ FAIL:', JSON.stringify(r));
    fail++;
    process.exit(1);
  }
  const filePath = r.data.filePath;

  // Test 2: Export a Excel
  console.log('\n▶ Test 2: Export Excel');
  r = await handlers['profesiograma:export-excel']({}, { filePath: filePath });
  if (r.success && r.data.exported) {
    console.log('  ✅ OK — exportado');
    pass++;
    const stats = r.data.stats;
    if (stats.cargos === 2 && stats.tipos === 3 && stats.grupos === 2) {
      console.log('  ✅ Stats correctas:', JSON.stringify(stats));
      pass++;
    } else {
      console.log('  ❌ Stats incorrectas:', JSON.stringify(stats));
      fail++;
    }
  } else {
    console.log('  ❌ FAIL:', JSON.stringify(r));
    fail++;
  }

  // Test 3: El archivo existe y es válido
  console.log('\n▶ Test 3: Archivo existe y es válido');
  if (fs.existsSync(filePath)) {
    const size = fs.statSync(filePath).size;
    console.log('  ✅ Archivo existe, tamaño:', (size / 1024).toFixed(1), 'KB');
    pass++;
    if (size > 1000) {
      console.log('  ✅ Tamaño razonable (no está vacío)');
      pass++;
    } else {
      console.log('  ❌ FAIL — archivo demasiado pequeño');
      fail++;
    }
  } else {
    console.log('  ❌ FAIL — archivo no existe');
    fail++;
  }

  // Test 4: El archivo se puede leer de vuelta con xlsx
  console.log('\n▶ Test 4: Leer el archivo generado');
  try {
    const wb = XLSX.readFile(filePath);
    const expectedSheets = ['Matriz Examenes', 'Tipos Examen', 'Pruebas', 'Recomendaciones', 'Alturas', 'Vacunas', 'Grupos'];
    let allSheetsPresent = true;
    for (const s of expectedSheets) {
      if (wb.Sheets[s]) {
        console.log('  ✅ Hoja "' + s + '" presente');
        pass++;
      } else {
        console.log('  ❌ FAIL — falta hoja "' + s + '"');
        fail++;
        allSheetsPresent = false;
      }
    }
    if (allSheetsPresent) {
      // Verificar contenido de la matriz
      const matriz = XLSX.utils.sheet_to_json(wb.Sheets['Matriz Examenes'], { header: 1 });
      console.log('  Matriz tiene', matriz.length, 'filas');
      if (matriz.length === 4) {
        // 2 headers + 2 cargos
        console.log('  ✅ Cantidad de filas correcta (2 headers + 2 cargos)');
        pass++;
      } else {
        console.log('  ❌ FAIL — esperaba 4 filas, hay', matriz.length);
        fail++;
      }
      // Verificar que los I/P/R están como X
      const primeraFilaCargo = matriz[2]; // primera fila de datos
      if (primeraFilaCargo && primeraFilaCargo[0] === 'ADMINISTRATIVO') {
        console.log('  ✅ Primera fila de datos correcta (ADMINISTRATIVO)');
        pass++;
      } else {
        console.log('  ❌ FAIL — primera fila:', JSON.stringify(primeraFilaCargo));
        fail++;
      }
      // Verificar que hay X en la matriz
      const conX = matriz.some(function(row) { return row.some(function(c) { return c === 'X'; }); });
      if (conX) {
        console.log('  ✅ Hay celdas con X (I/P/R marcados)');
        pass++;
      } else {
        console.log('  ❌ FAIL — no hay celdas con X');
        fail++;
      }
    }
  } catch (e) {
    console.log('  ❌ FAIL — error leyendo XLSX:', e.message);
    fail++;
  }

  // Test 5: Export sin filePath debe fallar
  console.log('\n▶ Test 5: Export sin filePath (debe fallar)');
  r = await handlers['profesiograma:export-excel']({}, {});
  if (!r.success && r.error.code === 'VALIDATION') {
    console.log('  ✅ OK — rechazado como esperado');
    pass++;
  } else {
    console.log('  ❌ FAIL — debería haber fallado:', JSON.stringify(r));
    fail++;
  }

  // Cleanup
  try { fs.unlinkSync(filePath); } catch (e) {}

  console.log('\n================================================================');
  console.log('RESUMEN: ' + pass + ' OK, ' + fail + ' FAIL');
  console.log('================================================================');
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
