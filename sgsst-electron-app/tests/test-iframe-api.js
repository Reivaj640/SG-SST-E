// test-iframe-api.js
//
// Simula el entorno del iframe para verificar que parent.electronAPI funciona.
// El test crea un mock con parent.window.electronAPI y verifica que el viewer
// puede acceder a los handlers.

'use strict';

const Module = require('module');
const orig = Module.prototype.require;
const handlers = {};
let apiCalls = [];

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
const db = {
  prepare: () => ({ run: () => ({}), get: () => ({ c: 0 }), all: () => [] }),
  exec: () => {}
};
bridge.registerProfesiogramaHandlers(null, {
  getDb: () => db,
  getCompanyRoot: () => null
});

// Simular el contexto del iframe
const mockIframe = {
  window: {
    electronAPI: null  // simulamos que el iframe NO tiene electronAPI directamente
  },
  parent: {
    window: {
      electronAPI: {
        profesiograma: {
          kpis: () => handlers['profesiograma:kpis']({}, {}).then(r => {
            apiCalls.push('kpis called');
            return r;
          }),
          matriz: () => handlers['profesiograma:matriz']({}, {}).then(r => r),
          selectExcel: () => handlers['profesiograma:select-excel']({}, {}).then(r => r),
          importExcel: (data) => handlers['profesiograma:import-excel']({}, data).then(r => r),
        }
      }
    }
  }
};

// Reproducir la función API del viewer
function API() {
  if (mockIframe.window.electronAPI && mockIframe.window.electronAPI.profesiograma) return mockIframe.window.electronAPI.profesiograma;
  if (mockIframe.parent && mockIframe.parent.window.electronAPI && mockIframe.parent.window.electronAPI.profesiograma) return mockIframe.parent.window.electronAPI.profesiograma;
  if (mockIframe.parent && mockIframe.parent.parent && mockIframe.parent.parent.window.electronAPI && mockIframe.parent.parent.window.electronAPI.profesiograma) return mockIframe.parent.parent.window.electronAPI.profesiograma;
  return null;
}

async function main() {
  console.log('================================================================');
  console.log('TEST: API access desde iframe context');
  console.log('================================================================\n');

  const api = API();
  if (!api) {
    console.log('❌ FAIL: API no encontrada');
    process.exit(1);
  }
  console.log('✅ API encontrada via parent.window.electronAPI.profesiograma');

  // Test kpis
  console.log('\n▶ Test kpis:');
  const kpisRes = await api.kpis();
  if (kpisRes.success) {
    console.log('  ✅ kpis OK, valores:', JSON.stringify(kpisRes.data));
  } else {
    console.log('  ❌ kpis error:', kpisRes.error);
    process.exit(1);
  }

  // Test matriz
  console.log('\n▶ Test matriz:');
  const matrizRes = await api.matriz();
  if (matrizRes.success) {
    console.log('  ✅ matriz OK, cargos:', matrizRes.data.cargos.length);
  }

  console.log('\n================================================================');
  console.log('✅ PASS — parent.electronAPI funciona desde el iframe');
  console.log('================================================================');
  process.exit(0);
}

main().catch(err => {
  console.error('ERROR FATAL:', err);
  process.exit(1);
});
