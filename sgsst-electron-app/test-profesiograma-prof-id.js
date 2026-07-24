// test-profesiograma-prof-id.js
//
// Test específico: el handler profesiograma:matriz debe incluir profesiograma_id
// en cada cargo, para que el viewer pueda guardar el state.profesiogramaId.

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

class MockDb {
  constructor() {
    this.cargos = [{
      id: 'cargo_1',
      nombre: 'AUXILIAR DE COCINA',
      descripcion: 'Para preparar alimentos',
      peligros_riesgos: null,
      profesiograma_id: 'prof_default_001',
      grupo_ocupacional_id: 'grupo_1',
      created_at: '2026-07-23',
      updated_at: '2026-07-23'
    }];
    this.grupos = [{ id: 'grupo_1', nombre: 'OPERATIVO' }];
    this.tipos = [];
  }
  prepare(sql) {
    const db = this;
    return {
      run: function () { return { changes: 0 }; },
      get: function () { return null; },
      all: function () {
        if (sql.match(/FROM kp_cargo c/)) return db.cargos.slice();
        if (sql.match(/FROM kp_grupo_ocupacional/)) return db.grupos.slice();
        if (sql.match(/FROM kp_tipo_examen/)) return db.tipos.slice();
        if (sql.match(/FROM kp_cargo_examen/)) return [];
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

async function main() {
  console.log('================================================================');
  console.log('TEST: Matriz incluye profesiograma_id en cada cargo');
  console.log('================================================================\n');

  let pass = 0, fail = 0;

  const res = await handlers['profesiograma:matriz']({}, {});
  if (!res.success) {
    console.log('❌ FAIL — handler error:', res.error);
    process.exit(1);
  }

  console.log('Cargos en la respuesta:');
  console.log(JSON.stringify(res.data.cargos, null, 2));

  if (res.data.cargos.length === 1) {
    console.log('\n✅ 1 cargo en la respuesta');
    pass++;
  } else {
    console.log('\n❌ FAIL — esperaba 1 cargo');
    fail++;
  }

  const cargo = res.data.cargos[0];
  if (cargo.profesiograma_id === 'prof_default_001') {
    console.log('✅ profesiograma_id presente y correcto:', cargo.profesiograma_id);
    pass++;
  } else {
    console.log('❌ FAIL — profesiograma_id no está o es incorrecto:', cargo.profesiograma_id);
    fail++;
  }

  if (cargo.grupo_ocupacional_id === 'grupo_1') {
    console.log('✅ grupo_ocupacional_id presente y correcto:', cargo.grupo_ocupacional_id);
    pass++;
  } else {
    console.log('❌ FAIL — grupo_ocupacional_id no está:', cargo.grupo_ocupacional_id);
    fail++;
  }

  if (cargo.grupoOcupacional && cargo.grupoOcupacional.nombre === 'OPERATIVO') {
    console.log('✅ grupoOcupacional (objeto compuesto) presente');
    pass++;
  } else {
    console.log('❌ FAIL — grupoOcupacional no presente:', cargo.grupoOcupacional);
    fail++;
  }

  console.log('\n================================================================');
  console.log('RESUMEN: ' + pass + ' OK, ' + fail + ' FAIL');
  console.log('================================================================');
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
