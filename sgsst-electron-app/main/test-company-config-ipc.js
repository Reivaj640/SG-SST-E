/**
 * main/test-company-config-ipc.js
 *
 * 📦103.A1.1 · Tests del IPC layer para company-nit:get / company-nit:set
 *
 * Valida el contrato:
 *   UI (config-viewer.html)
 *     ↓ window.electronAPI.companyNitGet(companyKey)
 *   preload.js
 *     ↓ ipcRenderer.invoke('company-nit:get', { companyKey })
 *   main.js (handlers)
 *     ↓ companyConfigWriter.readCompanyNit(configPath, companyKey)
 *   main/company-config-writer.js
 *     ↓ fs.readFile(configPath)
 *   config.json
 *
 * Estos tests NO arrancan Electron. MOCKean ipcMain.handle para registrar
 * los handlers en un dict local, luego los invocan directamente. Es la
 * misma técnica que test-firma-bridge.js.
 *
 * Ejecutar: node main/test-company-config-ipc.js
 */

'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');
const assert = require('assert');

const writer = require('./company-config-writer');

// =============================================================================
// Mock mínimo de ipcMain: captura los handlers en un dict
// =============================================================================

const _ipcHandlers = {};

const _ipcMain = {
  handle: (channel, handler) => {
    _ipcHandlers[channel] = handler;
  }
};

// =============================================================================
// Registrar los handlers (mismo código que en main.js)
// =============================================================================

// Necesitamos imitar el `configPath` que main.js calcula:
function _makeTmpDir(label) {
  const base = path.join(os.tmpdir(), 'kair-ipc-' + label + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8));
  fs.mkdirSync(base, { recursive: true });
  return base;
}

async function _writeFixtureConfig(dir, companyKey, extra) {
  const configPath = path.join(dir, 'config.json');
  const config = {
    companyPaths: {}
  };
  config.companyPaths[companyKey] = Object.assign({
    root: 'G:\\Proyectos\\Tempoactiva',
    structure: { docs: 'Documentos' },
    stats: { employees: 15 },
    sync: { enabled: true, hubPath: 'G:/Mi unidad/K+AIR', intervalMinutes: 5, autoSync: false }
  }, extra || {});
  await fsp.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
  return configPath;
}

// Copiamos el código EXACTO de los handlers de main.js
function _registerHandlers(configPath) {
  // company-nit:get
  _ipcHandlers['company-nit:get'] = async (event, args) => {
    try {
      if (!args || !args.companyKey) {
        return { success: false, error: { code: 'NO_COMPANY', message: 'companyKey requerido' } };
      }
      const nit = await writer.readCompanyNit(configPath, args.companyKey);
      return { success: true, data: { nit: nit } };
    } catch (error) {
      return { success: false, error: { code: 'READ_FAILED', message: error.message } };
    }
  };

  // company-nit:set
  _ipcHandlers['company-nit:set'] = async (event, args) => {
    try {
      if (!args || !args.companyKey) {
        return { success: false, error: { code: 'NO_COMPANY', message: 'companyKey requerido' } };
      }
      return await writer.writeCompanyNit(configPath, args.companyKey, args.nit);
    } catch (error) {
      return { success: false, error: { code: 'WRITE_FAILED', message: error.message } };
    }
  };
}

// =============================================================================
// Test runner
// =============================================================================

let _passed = 0;
let _failed = 0;
let _total = 0;

async function test(name, fn) {
  _total++;
  try {
    await fn();
    _passed++;
    console.log('  ✔ ' + name);
  } catch (e) {
    _failed++;
    console.log('  ✘ ' + name);
    console.log('    ' + (e && e.message ? e.message : e));
    if (e && e.stack) {
      const lines = e.stack.split('\n').slice(1, 4).join('\n');
      console.log('    ' + lines);
    }
  }
}

function section(name) {
  console.log('\n[' + name + ']');
}

async function main() {
  // =============================================================================
  // 1. company-nit:get
  // =============================================================================

  section('company-nit:get');

  await test('get: empresa con NIT guardado retorna el NIT', async () => {
    const dir = _makeTmpDir('get-with');
    try {
      const cfgPath = await _writeFixtureConfig(dir, 'TEMPOACTIVA EST S.A.S.', { nit: '9001234567' });
      _registerHandlers(cfgPath);
      const h = _ipcHandlers['company-nit:get'];
      const r = await h({}, { companyKey: 'TEMPOACTIVA EST S.A.S.' });
      assert.strictEqual(r.success, true);
      assert.strictEqual(r.data.nit, '9001234567');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  await test('get: empresa sin NIT retorna null (no rompe)', async () => {
    const dir = _makeTmpDir('get-without');
    try {
      const cfgPath = await _writeFixtureConfig(dir, 'SIN NIT');
      _registerHandlers(cfgPath);
      const h = _ipcHandlers['company-nit:get'];
      const r = await h({}, { companyKey: 'SIN NIT' });
      assert.strictEqual(r.success, true);
      assert.strictEqual(r.data.nit, null);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  await test('get: empresa inexistente retorna nit: null', async () => {
    const dir = _makeTmpDir('get-missing');
    try {
      const cfgPath = await _writeFixtureConfig(dir, 'EXISTE');
      _registerHandlers(cfgPath);
      const h = _ipcHandlers['company-nit:get'];
      const r = await h({}, { companyKey: 'NO EXISTE' });
      assert.strictEqual(r.success, true);
      assert.strictEqual(r.data.nit, null);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  await test('get: sin companyKey retorna NO_COMPANY', async () => {
    const dir = _makeTmpDir('get-nocompany');
    try {
      const cfgPath = await _writeFixtureConfig(dir, 'X');
      _registerHandlers(cfgPath);
      const h = _ipcHandlers['company-nit:get'];
      const r = await h({}, null);
      assert.strictEqual(r.success, false);
      assert.strictEqual(r.error.code, 'NO_COMPANY');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  // =============================================================================
  // 2. company-nit:set
  // =============================================================================

  section('company-nit:set');

  await test('set: guardar NIT válido normaliza y persiste', async () => {
    const dir = _makeTmpDir('set-valid');
    try {
      const cfgPath = await _writeFixtureConfig(dir, 'TEMPOACTIVA EST S.A.S.');
      _registerHandlers(cfgPath);
      const h = _ipcHandlers['company-nit:set'];
      const r = await h({}, { companyKey: 'TEMPOACTIVA EST S.A.S.', nit: '900123456-7' });
      assert.strictEqual(r.success, true);
      assert.strictEqual(r.data.nit, '9001234567');
      // Verificar en disco
      const cfg = JSON.parse(await fsp.readFile(cfgPath, 'utf8'));
      assert.strictEqual(cfg.companyPaths['TEMPOACTIVA EST S.A.S.'].nit, '9001234567');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  await test('set: NO modifica otros campos de la empresa (root, stats, sync)', async () => {
    const dir = _makeTmpDir('set-preserve');
    try {
      const cfgPath = await _writeFixtureConfig(dir, 'OTRA EMPRESA S.A.S.');
      const before = JSON.parse(await fsp.readFile(cfgPath, 'utf8'));
      _registerHandlers(cfgPath);
      const h = _ipcHandlers['company-nit:set'];
      const r = await h({}, { companyKey: 'OTRA EMPRESA S.A.S.', nit: '900111111' });
      assert.strictEqual(r.success, true);
      const after = JSON.parse(await fsp.readFile(cfgPath, 'utf8'));
      const emp = after.companyPaths['OTRA EMPRESA S.A.S.'];
      const empBefore = before.companyPaths['OTRA EMPRESA S.A.S.'];
      assert.deepStrictEqual(emp.root, empBefore.root);
      assert.deepStrictEqual(emp.structure, empBefore.structure);
      assert.deepStrictEqual(emp.stats, empBefore.stats);
      assert.deepStrictEqual(emp.sync, empBefore.sync);
      assert.strictEqual(emp.nit, '900111111');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  await test('set: NIT inválido retorna INVALID_NIT (no modifica disco)', async () => {
    const dir = _makeTmpDir('set-invalid');
    try {
      const cfgPath = await _writeFixtureConfig(dir, 'RECHAZO');
      _registerHandlers(cfgPath);
      const h = _ipcHandlers['company-nit:set'];
      const r = await h({}, { companyKey: 'RECHAZO', nit: 'ABC123' });
      assert.strictEqual(r.success, false);
      assert.strictEqual(r.error.code, 'INVALID_NIT');
      // Verificar que NO se modificó
      const cfg = JSON.parse(await fsp.readFile(cfgPath, 'utf8'));
      assert.strictEqual(cfg.companyPaths['RECHAZO'].nit, undefined);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  await test('set: empresa inexistente retorna COMPANY_NOT_FOUND', async () => {
    const dir = _makeTmpDir('set-missing');
    try {
      const cfgPath = await _writeFixtureConfig(dir, 'EXISTE');
      _registerHandlers(cfgPath);
      const h = _ipcHandlers['company-nit:set'];
      const r = await h({}, { companyKey: 'NO EXISTE', nit: '9001234567' });
      assert.strictEqual(r.success, false);
      assert.strictEqual(r.error.code, 'COMPANY_NOT_FOUND');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  await test('set: sin companyKey retorna NO_COMPANY', async () => {
    const dir = _makeTmpDir('set-nocompany');
    try {
      const cfgPath = await _writeFixtureConfig(dir, 'X');
      _registerHandlers(cfgPath);
      const h = _ipcHandlers['company-nit:set'];
      const r = await h({}, { nit: '9001234567' });
      assert.strictEqual(r.success, false);
      assert.strictEqual(r.error.code, 'NO_COMPANY');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  // =============================================================================
  // 3. Round-trip: get → set → get
  // =============================================================================

  section('Round-trip: get → set → get');

  await test('round-trip: persistencia después de cerrar y reabrir config.json', async () => {
    const dir = _makeTmpDir('roundtrip');
    try {
      const cfgPath = await _writeFixtureConfig(dir, 'ROUNDTRIP');
      _registerHandlers(cfgPath);
      // 1. Estado inicial: sin NIT
      let r = await _ipcHandlers['company-nit:get']({}, { companyKey: 'ROUNDTRIP' });
      assert.strictEqual(r.data.nit, null);
      // 2. Guardar NIT
      r = await _ipcHandlers['company-nit:set']({}, { companyKey: 'ROUNDTRIP', nit: '900555555' });
      assert.strictEqual(r.success, true);
      // 3. Releer (mismo proceso)
      r = await _ipcHandlers['company-nit:get']({}, { companyKey: 'ROUNDTRIP' });
      assert.strictEqual(r.data.nit, '900555555');
      // 4. Simular cierre y reapertura: releer config.json desde disco
      const cfg = JSON.parse(await fsp.readFile(cfgPath, 'utf8'));
      assert.strictEqual(cfg.companyPaths['ROUNDTRIP'].nit, '900555555');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  // =============================================================================
  // 4. Resumen
  // =============================================================================

  console.log('\n' + '='.repeat(60));
  console.log('Tests: ' + _total + ' | Pasados: ' + _passed + ' | Fallados: ' + _failed);
  console.log('='.repeat(60));

  if (_failed > 0) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('FATAL en test-company-config-ipc:', e && e.message || e);
  process.exit(2);
});
