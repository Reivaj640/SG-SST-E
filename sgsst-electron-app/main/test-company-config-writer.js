/**
 * main/test-company-config-writer.js
 *
 * 📦103.A1.0 · Tests del helper company-config-writer.js
 *
 * Verifica:
 * - Guardar NIT válido.
 * - Normalizar NIT con separadores (guiones, espacios, puntos).
 * - Rechazar NITs inválidos (vacío, no numérico, muy corto, muy largo).
 * - NO modificar otros campos de la empresa (root, stats, sync).
 * - Empresa sin NIT guardado sigue funcionando.
 * - Limpiar NIT (clearCompanyNit).
 *
 * Ejecutar: node main/test-company-config-writer.js
 */

'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');
const assert = require('assert');

const writer = require('./company-config-writer');

let _passed = 0;
let _failed = 0;
let _total = 0;

function test(name, fn) {
  _total++;
  return Promise.resolve()
    .then(() => fn())
    .then(() => {
      _passed++;
      console.log('  ✔ ' + name);
    })
    .catch((e) => {
      _failed++;
      console.log('  ✘ ' + name);
      console.log('    ' + (e && e.message ? e.message : e));
      if (e && e.stack) {
        const lines = e.stack.split('\n').slice(1, 4).join('\n');
        console.log('    ' + lines);
      }
    });
}

function section(name) {
  console.log('\n[' + name + ']');
}

/**
 * Crea un directorio temporal único para el test. Retorna el path.
 */
async function _makeTmpDir(label) {
  const base = path.join(os.tmpdir(), 'kair-ccw-' + label + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8));
  await fsp.mkdir(base, { recursive: true });
  return base;
}

/**
 * Escribe un config.json de prueba con la forma básica de una empresa.
 */
async function _writeFixtureConfig(dir, companyKey, extra) {
  const configPath = path.join(dir, 'config.json');
  const config = {
    companyPaths: {}
  };
  config.companyPaths[companyKey] = Object.assign({
    root: 'G:\\Proyectos\\Tempoactiva',
    structure: { docs: 'Documentos', templates: 'Templates' },
    stats: { employees: 15, risk: 'III' },
    sync: { enabled: true, hubPath: 'G:/Mi unidad/K+AIR', intervalMinutes: 5, autoSync: false }
  }, extra || {});
  await fsp.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
  return configPath;
}

async function _readConfig(configPath) {
  const raw = await fsp.readFile(configPath, 'utf8');
  return JSON.parse(raw);
}

async function main() {
  // =============================================================================
  // 1. Tests de normalización y validación (sin tocar disco)
  // =============================================================================

  section('Normalización y validación (helpers puros)');

  await test('_normalizeNit: limpia guiones', () => {
    assert.strictEqual(writer._normalizeNit('900123456-7'), '9001234567');
  });

  await test('_normalizeNit: limpia espacios', () => {
    assert.strictEqual(writer._normalizeNit('900 123 456 7'), '9001234567');
  });

  await test('_normalizeNit: limpia puntos', () => {
    assert.strictEqual(writer._normalizeNit('900.123.456-7'), '9001234567');
  });

  await test('_normalizeNit: combina separadores', () => {
    assert.strictEqual(writer._normalizeNit('  900-123-456-7  '), '9001234567');
  });

  await test('_normalizeNit: ya limpio pasa igual', () => {
    assert.strictEqual(writer._normalizeNit('9001234567'), '9001234567');
  });

  await test('_normalizeNit: null/undefined/no-string retorna null', () => {
    assert.strictEqual(writer._normalizeNit(null), null);
    assert.strictEqual(writer._normalizeNit(undefined), null);
    assert.strictEqual(writer._normalizeNit(123), null);
    assert.strictEqual(writer._normalizeNit({}), null);
  });

  await test('_validateNit: 9-15 dígitos válidos', () => {
    assert.strictEqual(writer._validateNit('9001234567').ok, true);
    assert.strictEqual(writer._validateNit('1234567890').ok, true);
    assert.strictEqual(writer._validateNit('123456789012345').ok, true);
  });

  await test('_validateNit: 8 dígitos rechazado', () => {
    const v = writer._validateNit('12345678');
    assert.strictEqual(v.ok, false);
    assert.match(v.reason, /9-15/);
  });

  await test('_validateNit: 16 dígitos rechazado', () => {
    const v = writer._validateNit('1234567890123456');
    assert.strictEqual(v.ok, false);
    assert.match(v.reason, /9-15/);
  });

  await test('_validateNit: no numérico rechazado', () => {
    const v = writer._validateNit('ABC123XYZ');
    assert.strictEqual(v.ok, false);
  });

  await test('_validateNit: vacío rechazado', () => {
    assert.strictEqual(writer._validateNit('').ok, false);
    assert.strictEqual(writer._validateNit(null).ok, false);
    assert.strictEqual(writer._validateNit(undefined).ok, false);
  });

  // =============================================================================
  // 2. Tests de writeCompanyNit (con disco temporal)
  // =============================================================================

  section('writeCompanyNit: persistencia en disco');

  let _tmpDir1;
  try {
    _tmpDir1 = await _makeTmpDir('write');

    await test('writeCompanyNit: guardar NIT válido normaliza y persiste', async () => {
      const cfgPath = await _writeFixtureConfig(_tmpDir1, 'TEMPOACTIVA EST S.A.S.');
      const r = await writer.writeCompanyNit(cfgPath, 'TEMPOACTIVA EST S.A.S.', '900123456-7');
      assert.strictEqual(r.success, true, 'debe ser success');
      assert.strictEqual(r.data.nit, '9001234567', 'debe normalizar a 9001234567');
      assert.strictEqual(r.data.companyKey, 'TEMPOACTIVA EST S.A.S.');
      const cfg = await _readConfig(cfgPath);
      assert.strictEqual(cfg.companyPaths['TEMPOACTIVA EST S.A.S.'].nit, '9001234567');
    });

    await test('writeCompanyNit: otros atributos de la empresa NO se tocan', async () => {
      const cfgPath = await _writeFixtureConfig(_tmpDir1, 'OTRA EMPRESA S.A.S.');
      const before = await _readConfig(cfgPath);
      const r = await writer.writeCompanyNit(cfgPath, 'OTRA EMPRESA S.A.S.', '900111111');
      assert.strictEqual(r.success, true);
      const after = await _readConfig(cfgPath);
      const emp = after.companyPaths['OTRA EMPRESA S.A.S.'];
      assert.deepStrictEqual(emp.root, before.companyPaths['OTRA EMPRESA S.A.S.'].root);
      assert.deepStrictEqual(emp.structure, before.companyPaths['OTRA EMPRESA S.A.S.'].structure);
      assert.deepStrictEqual(emp.stats, before.companyPaths['OTRA EMPRESA S.A.S.'].stats);
      assert.deepStrictEqual(emp.sync, before.companyPaths['OTRA EMPRESA S.A.S.'].sync);
      assert.strictEqual(emp.nit, '900111111');
    });

    await test('writeCompanyNit: empresa inexistente retorna COMPANY_NOT_FOUND', async () => {
      const cfgPath = await _writeFixtureConfig(_tmpDir1, 'EXISTE');
      const r = await writer.writeCompanyNit(cfgPath, 'NO EXISTE', '9001234567');
      assert.strictEqual(r.success, false);
      assert.strictEqual(r.error.code, 'COMPANY_NOT_FOUND');
      const cfg = await _readConfig(cfgPath);
      assert.strictEqual(cfg.companyPaths['NO EXISTE'], undefined);
    });

    await test('writeCompanyNit: NIT inválido no modifica disco', async () => {
      const cfgPath = await _writeFixtureConfig(_tmpDir1, 'RECHAZO');
      const r = await writer.writeCompanyNit(cfgPath, 'RECHAZO', 'ABC123');
      assert.strictEqual(r.success, false);
      assert.strictEqual(r.error.code, 'INVALID_NIT');
      const cfg = await _readConfig(cfgPath);
      assert.strictEqual(cfg.companyPaths['RECHAZO'].nit, undefined);
    });

    await test('writeCompanyNit: NIT muy corto rechazado', async () => {
      const cfgPath = await _writeFixtureConfig(_tmpDir1, 'CORTO');
      const r = await writer.writeCompanyNit(cfgPath, 'CORTO', '12345');
      assert.strictEqual(r.success, false);
      assert.strictEqual(r.error.code, 'INVALID_NIT');
    });

    await test('writeCompanyNit: NIT muy largo rechazado', async () => {
      const cfgPath = await _writeFixtureConfig(_tmpDir1, 'LARGO');
      const r = await writer.writeCompanyNit(cfgPath, 'LARGO', '12345678901234567890');
      assert.strictEqual(r.success, false);
      assert.strictEqual(r.error.code, 'INVALID_NIT');
    });

    await test('writeCompanyNit: NIT vacío rechazado', async () => {
      const cfgPath = await _writeFixtureConfig(_tmpDir1, 'VACIO');
      const r = await writer.writeCompanyNit(cfgPath, 'VACIO', '');
      assert.strictEqual(r.success, false);
      assert.strictEqual(r.error.code, 'INVALID_NIT');
    });

    await test('writeCompanyNit: input no-string rechazado', async () => {
      const cfgPath = await _writeFixtureConfig(_tmpDir1, 'TIPOWRONG');
      const r = await writer.writeCompanyNit(cfgPath, 'TIPOWRONG', 12345);
      assert.strictEqual(r.success, false);
      assert.strictEqual(r.error.code, 'INVALID_NIT');
    });

    await test('writeCompanyNit: sin configPath retorna NO_CONFIG_PATH', async () => {
      const r = await writer.writeCompanyNit(null, 'X', '9001234567');
      assert.strictEqual(r.success, false);
      assert.strictEqual(r.error.code, 'NO_CONFIG_PATH');
    });

    await test('writeCompanyNit: sin companyKey retorna NO_COMPANY', async () => {
      const r = await writer.writeCompanyNit('/tmp/x.json', null, '9001234567');
      assert.strictEqual(r.success, false);
      assert.strictEqual(r.error.code, 'NO_COMPANY');
    });

    await test('writeCompanyNit: crea backup .bak', async () => {
      const cfgPath = await _writeFixtureConfig(_tmpDir1, 'BACKUP');
      const r = await writer.writeCompanyNit(cfgPath, 'BACKUP', '9001234567');
      assert.strictEqual(r.success, true);
      const bakPath = cfgPath + '.bak';
      const bakExists = fs.existsSync(bakPath);
      assert.strictEqual(bakExists, true, 'debe existir el backup .bak');
      const bak = await _readConfig(bakPath);
      assert.strictEqual(bak.companyPaths['BACKUP'].nit, undefined);
    });

    await test('writeCompanyNit: empresa con NIT previo se sobreescribe', async () => {
      const cfgPath = await _writeFixtureConfig(_tmpDir1, 'OVERWRITE', { nit: '111111111' });
      const r = await writer.writeCompanyNit(cfgPath, 'OVERWRITE', '9001234567');
      assert.strictEqual(r.success, true);
      const cfg = await _readConfig(cfgPath);
      assert.strictEqual(cfg.companyPaths['OVERWRITE'].nit, '9001234567');
    });

  } finally {
    if (_tmpDir1 && fs.existsSync(_tmpDir1)) {
      try {
        await fsp.rm(_tmpDir1, { recursive: true, force: true });
      } catch (e) { /* ignore */ }
    }
  }

  // =============================================================================
  // 3. Tests de readCompanyNit
  // =============================================================================

  section('readCompanyNit: lectura');

  let _tmpDir2;
  try {
    _tmpDir2 = await _makeTmpDir('read');

    await test('readCompanyNit: empresa con NIT guardado', async () => {
      const cfgPath = await _writeFixtureConfig(_tmpDir2, 'CON NIT', { nit: '9001234567' });
      const n = await writer.readCompanyNit(cfgPath, 'CON NIT');
      assert.strictEqual(n, '9001234567');
    });

    await test('readCompanyNit: empresa sin NIT (nit: undefined) retorna null', async () => {
      const cfgPath = await _writeFixtureConfig(_tmpDir2, 'SIN NIT');
      const n = await writer.readCompanyNit(cfgPath, 'SIN NIT');
      assert.strictEqual(n, null);
    });

    await test('readCompanyNit: empresa inexistente retorna null', async () => {
      const cfgPath = await _writeFixtureConfig(_tmpDir2, 'EXISTE');
      const n = await writer.readCompanyNit(cfgPath, 'NO EXISTE');
      assert.strictEqual(n, null);
    });

    await test('readCompanyNit: configPath inexistente retorna null', async () => {
      const n = await writer.readCompanyNit('/tmp/this-file-does-not-exist-12345.json', 'X');
      assert.strictEqual(n, null);
    });

  } finally {
    if (_tmpDir2 && fs.existsSync(_tmpDir2)) {
      try { await fsp.rm(_tmpDir2, { recursive: true, force: true }); } catch (e) { /* ignore */ }
    }
  }

  // =============================================================================
  // 4. Tests de clearCompanyNit
  // =============================================================================

  section('clearCompanyNit: limpieza');

  let _tmpDir3;
  try {
    _tmpDir3 = await _makeTmpDir('clear');

    await test('clearCompanyNit: elimina NIT y mantiene otros campos', async () => {
      const cfgPath = await _writeFixtureConfig(_tmpDir3, 'CLEAR', { nit: '9001234567' });
      const r = await writer.clearCompanyNit(cfgPath, 'CLEAR');
      assert.strictEqual(r.success, true);
      const cfg = await _readConfig(cfgPath);
      assert.strictEqual(cfg.companyPaths['CLEAR'].nit, undefined);
      assert.strictEqual(cfg.companyPaths['CLEAR'].root, 'G:\\Proyectos\\Tempoactiva');
    });

    await test('clearCompanyNit: empresa sin NIT es no-op', async () => {
      const cfgPath = await _writeFixtureConfig(_tmpDir3, 'NO NIT');
      const r = await writer.clearCompanyNit(cfgPath, 'NO NIT');
      assert.strictEqual(r.success, true);
      assert.strictEqual(r.data, null);
    });

    await test('clearCompanyNit: empresa inexistente retorna COMPANY_NOT_FOUND', async () => {
      const cfgPath = await _writeFixtureConfig(_tmpDir3, 'EXISTE');
      const r = await writer.clearCompanyNit(cfgPath, 'NO EXISTE');
      assert.strictEqual(r.success, false);
      assert.strictEqual(r.error.code, 'COMPANY_NOT_FOUND');
    });

    await test('clearCompanyNit: round-trip guardar → limpiar → guardar', async () => {
      const cfgPath = await _writeFixtureConfig(_tmpDir3, 'ROUNDTRIP');
      // 1. Guardar NIT
      let r = await writer.writeCompanyNit(cfgPath, 'ROUNDTRIP', '900111111');
      assert.strictEqual(r.success, true);
      assert.strictEqual(r.data.nit, '900111111');
      // 2. Limpiar NIT
      r = await writer.clearCompanyNit(cfgPath, 'ROUNDTRIP');
      assert.strictEqual(r.success, true);
      // 3. Verificar null
      let n = await writer.readCompanyNit(cfgPath, 'ROUNDTRIP');
      assert.strictEqual(n, null);
      // 4. Guardar nuevo NIT
      r = await writer.writeCompanyNit(cfgPath, 'ROUNDTRIP', '900222222');
      assert.strictEqual(r.success, true);
      n = await writer.readCompanyNit(cfgPath, 'ROUNDTRIP');
      assert.strictEqual(n, '900222222');
    });

  } finally {
    if (_tmpDir3 && fs.existsSync(_tmpDir3)) {
      try { await fsp.rm(_tmpDir3, { recursive: true, force: true }); } catch (e) { /* ignore */ }
    }
  }

  // =============================================================================
  // 5. Resumen
  // =============================================================================

  console.log('\n' + '='.repeat(60));
  console.log('Tests: ' + _total + ' | Pasados: ' + _passed + ' | Fallados: ' + _failed);
  console.log('='.repeat(60));

  if (_failed > 0) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('FATAL en test-company-config-writer:', e && e.message || e);
  process.exit(2);
});

