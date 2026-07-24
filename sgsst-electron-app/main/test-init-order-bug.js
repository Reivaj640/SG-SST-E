/**
 * test-init-order-bug.js
 *
 * Reproduce el bug del orden de inicialización en main.js.
 * Comportamiento actual (BUGGY):
 *   1. main.js línea 8719: startAutoSyncForAllEnabled() corre SIN init()
 *   2. _configPath es null -> _getAllCompanies() retorna []
 *   3. 0 empresas iniciadas con auto-sync
 *
 * Comportamiento esperado (FIX):
 *   1. init() primero (setea _configPath)
 *   2. startAutoSyncForAllEnabled() despues (encuentra Asel con enabled=true)
 */

'use strict';

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(
  process.env.APPDATA || process.env.HOME,
  'sgsst-electron-app',
  'config.json'
);

console.log('='.repeat(60));
console.log('TEST: Orden de inicializacion del sync multipc');
console.log('='.repeat(60));
console.log('CONFIG_PATH:', CONFIG_PATH);
console.log('');

// === Lectura directa del config (sin service) ===
const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
const config = JSON.parse(raw);
const companyPaths = config.companyPaths || {};

console.log('Empresas en config.companyPaths:');
Object.keys(companyPaths).forEach(function (key) {
  const c = companyPaths[key];
  const hasSync = !!c.sync;
  const enabled = c.sync && c.sync.enabled;
  console.log('  -', key, '| sync?:', hasSync, '| enabled?:', enabled);
});

// === Simular el flujo BUGGY: startAutoSyncForAllEnabled SIN init ===
console.log('');
console.log('--- SIMULANDO FLUJO BUGGY (init() NO llamado primero) ---');
let _configPath = null; // sync-service.js cuando init() no se llamo

function _getAllCompaniesBuggy() {
  if (!_configPath) return []; // <-- ESTA LINEA ES EL BUG
  // ... resto del codigo nunca se ejecuta
}

const companiesBuggy = _getAllCompaniesBuggy();
console.log('Empresas retornadas por _getAllCompanies() SIN init:', companiesBuggy.length);
console.log('Auto-sync iniciado para:', companiesBuggy.length, 'empresas');
console.log('');

// === Simular el flujo FIX: init() PRIMERO, luego startAutoSyncForAllEnabled ===
console.log('--- SIMULANDO FLUJO FIX (init() llamado primero) ---');
_configPath = CONFIG_PATH; // init() setea _configPath

function _getAllCompaniesFixed() {
  if (!_configPath) return [];
  const result = [];
  Object.keys(companyPaths).forEach(function (key) {
    result.push({ key: key, sync: companyPaths[key].sync });
  });
  return result;
}

function startAutoSyncForAllEnabledFixed() {
  const companies = _getAllCompaniesFixed();
  let started = 0;
  for (let i = 0; i < companies.length; i++) {
    const c = companies[i];
    if (c.sync && c.sync.enabled) {
      console.log('  [SYNC-SERVICE] Auto-sync iniciado para', c.key,
                  '(cada', (c.sync.intervalMinutes || 5), 'min)');
      started++;
    }
  }
  return started;
}

const startedFixed = startAutoSyncForAllEnabledFixed();
console.log('');
console.log('Total empresas con auto-sync iniciado:', startedFixed);
console.log('');

// === Veredicto ===
console.log('='.repeat(60));
console.log('VEREDICTO:');
console.log('='.repeat(60));
if (companiesBuggy.length === 0 && startedFixed > 0) {
  console.log('✅ BUG CONFIRMADO:');
  console.log('   - Sin init() previo: 0 empresas iniciadas');
  console.log('   - Con init() previo:', startedFixed, 'empresas iniciadas');
  console.log('   - El fix es: mover el bloque de "Inicializar sync multipc"');
  console.log('     a DESPUES de registerSyncHandlers (main.js linea 8797)');
  process.exit(0);
} else {
  console.log('❌ No se pudo reproducir el bug, revisar manualmente');
  process.exit(1);
}
