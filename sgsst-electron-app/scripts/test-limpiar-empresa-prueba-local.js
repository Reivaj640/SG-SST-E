// scripts/test-limpiar-empresa-prueba-local.js
// Test del script de limpieza local (📦1090).
//
// Lo que este test tiene que probar, por encima de todo:
//   1. Se borra TODO lo de la empresa de prueba (los trabajadores de ensayo,
//      sus contrataciones, sus firmas, sus documentos, el expediente, la
//      identidad de la empresa, sus plantillas, sus carpetas y sus
//      notificaciones) y los ARCHIVOS que colgaban de esas filas.
//   2. NO se borra lo que es de verdad: los empleados reales que llevan el
//      sello `empresa_id = 'Aseplus'` (209 en la base del owner), las sedes
//      reales, las otras empresas, ni los archivos de las otras empresas.
//   3. El respaldo existe y tiene lo que habia antes.
//   4. La corrida dice en la pantalla si borra o simula.
//
// Y dos MUTACIONES que tienen que morir: si el script borra por `empresa_id`
// en vez de por cedula, o si el guard que avisa del exceso de borrado deja de
// avisar, este test tiene que detectarlo.

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const SCRIPT = path.join(__dirname, 'limpiar-empresa-prueba-local.js');
const SCRIPT_FUENTE = fs.readFileSync(SCRIPT, 'utf8');

const EMPRESA = 'Aseplus';
const CEDULAS_PRUEBA = ['9999999999', '1111111111', '6666666666'];
const CEDULAS_REALES = ['2222222222', '3333333333', '4444444444', '5555555555'];

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'kair-limp-local-'));
}

function esquema(db) {
  db.exec(`
    CREATE TABLE base_personal (
      id TEXT PRIMARY KEY, empresa_id TEXT, nombres TEXT, apellidos TEXT,
      cedula TEXT, cargo TEXT);
    CREATE TABLE contrataciones (
      id TEXT PRIMARY KEY, empresa_id TEXT, trabajador_id TEXT, cedula TEXT,
      nombres TEXT, apellidos TEXT);
    CREATE TABLE gh_documentos (
      id TEXT PRIMARY KEY, trabajador_id TEXT, empresa_id TEXT, tipo TEXT,
      estado TEXT, ruta_archivo TEXT,
      FOREIGN KEY (trabajador_id) REFERENCES base_personal(id) ON DELETE CASCADE);
    CREATE TABLE gh_carpetas_expedientes (
      id TEXT PRIMARY KEY, empresa_id TEXT, trabajador_id TEXT,
      FOREIGN KEY (trabajador_id) REFERENCES base_personal(id) ON DELETE CASCADE);
    CREATE TABLE gh_carpetas_documentos (
      id TEXT PRIMARY KEY, empresa_id TEXT, expediente_id TEXT,
      trabajador_id TEXT, ruta_archivo TEXT,
      FOREIGN KEY (expediente_id) REFERENCES gh_carpetas_expedientes(id) ON DELETE CASCADE);
    CREATE TABLE gh_contratacion_soportes (
      id TEXT PRIMARY KEY, empresa_id TEXT, contratacion_id TEXT,
      FOREIGN KEY (contratacion_id) REFERENCES contrataciones(id) ON DELETE CASCADE);
    CREATE TABLE gh_sedes (
      id TEXT PRIMARY KEY, empresa_id TEXT, nombre TEXT);
    CREATE TABLE empresa_datos_firma (
      id INTEGER PRIMARY KEY, empresa_id TEXT, nit TEXT);
    CREATE TABLE empresa_representante_legal (
      id INTEGER PRIMARY KEY, empresa_id TEXT, nombre TEXT);
    CREATE TABLE companies (
      id INTEGER PRIMARY KEY, company_key TEXT, display_name TEXT);
    CREATE TABLE gh_templates (
      id TEXT PRIMARY KEY, empresa_id TEXT, nombre TEXT, ruta_archivo TEXT);
    CREATE TABLE gh_carpetas_categorias (
      id TEXT PRIMARY KEY, empresa_id TEXT, nombre TEXT);
    CREATE TABLE notificaciones (
      id INTEGER PRIMARY KEY, company_key TEXT, titulo TEXT);
    CREATE TABLE gh_firmas_sin_fk (
      id TEXT PRIMARY KEY, trabajador_id TEXT, nota TEXT);
  `);
}

function archivo(dir, nombre, contenido) {
  const p = path.join(dir, nombre);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, contenido || 'x');
  return p;
}

// Siembra una base parecida a la del owner: la empresa de prueba, sus
// trabajadores de ensayo, SUS firmas, y ADEMAS los empleados y las sedes
// REALES que llevan el sello de la empresa activa.
function sembrar(db, userData) {
  esquema(db);
  const ins = (sql, ...p) => db.prepare(sql).run(...p);

  // Trabajadores de prueba (3).
  CEDULAS_PRUEBA.forEach((ced, i) => {
    ins("INSERT INTO base_personal VALUES (?,?,?,?,?,?)",
      'bp-prueba-' + i, EMPRESA, 'PRUEBA ' + i, 'FIRMA', ced, 'PRUEBA');
  });
  // Empleados REALES con el sello de la empresa activa (209 en el owner).
  CEDULAS_REALES.forEach((ced, i) => {
    ins("INSERT INTO base_personal VALUES (?,?,?,?,?,?)",
      'bp-real-' + i, EMPRESA, 'CARLOS', 'REAL ' + i, ced, 'Operador');
  });
  // Empleados de otra empresa.
  ins("INSERT INTO base_personal VALUES (?,?,?,?,?,?)",
    'bp-otra', 'Tempoactiva', 'JAVIER', 'OTRO', '999888777', 'Gerente');

  // Contrataciones: 3 de prueba + 1 real.
  CEDULAS_PRUEBA.forEach((ced, i) => {
    ins("INSERT INTO contrataciones VALUES (?,?,?,?,?,?)",
      'ct-prueba-' + i, EMPRESA, 'bp-prueba-' + i, ced, 'PRUEBA ' + i, 'FIRMA');
  });
  ins("INSERT INTO contrataciones VALUES (?,?,?,?,?,?)",
    'ct-real', EMPRESA, 'bp-real-0', CEDULAS_REALES[0], 'CARLOS', 'REAL');

  // 5 documentos firmados de los trabajadores de prueba + 1 de un real.
  const docs = [];
  for (let i = 0; i < 5; i++) {
    const t = 'bp-prueba-' + (i % 3);
    const f = archivo(userData, 'gh-docs/' + EMPRESA + '/do-prueba-' + i + '.pdf');
    docs.push(f);
    ins("INSERT INTO gh_documentos VALUES (?,?,?,?,?,?)",
      'do-prueba-' + i, t, EMPRESA, 'autorizacion_datos', 'firmado', f);
  }
  const fReal = archivo(userData, 'gh-docs/' + EMPRESA + '/do-real.pdf');
  docs.push(fReal);
  ins("INSERT INTO gh_documentos VALUES (?,?,?,?,?,?)",
    'do-real', 'bp-real-0', EMPRESA, 'autorizacion_datos', 'firmado', fReal);

  // Los hijos SIN FK declarada: se llegan por convencion del nombre.
  for (let i = 0; i < 5; i++) {
    ins("INSERT INTO gh_firmas_sin_fk VALUES (?,?,?)",
      'fs-prueba-' + i, 'bp-prueba-' + (i % 3), 'firma de prueba');
  }
  ins("INSERT INTO gh_firmas_sin_fk VALUES (?,?,?)", 'fs-real', 'bp-real-0', 'firma real');

  // Expediente y su documento.
  ins("INSERT INTO gh_carpetas_expedientes VALUES (?,?,?)", 'ce-prueba', EMPRESA, 'bp-prueba-1');
  ins("INSERT INTO gh_carpetas_expedientes VALUES (?,?,?)", 'ce-real', EMPRESA, 'bp-real-0');
  const jpeg = archivo(userData, 'gh-carpetas/' + EMPRESA + '/bp-prueba-1/identificacion/foto.jpeg');
  ins("INSERT INTO gh_carpetas_documentos VALUES (?,?,?,?,?)",
    'cd-prueba', EMPRESA, 'ce-prueba', 'bp-prueba-1', jpeg);
  const jpegReal = archivo(userData, 'gh-carpetas/' + EMPRESA + '/bp-real-0/identificacion/foto.jpeg');
  ins("INSERT INTO gh_carpetas_documentos VALUES (?,?,?,?,?)",
    'cd-real', EMPRESA, 'ce-real', 'bp-real-0', jpegReal);

  // Soportes de contratacion.
  ins("INSERT INTO gh_contratacion_soportes VALUES (?,?,?)", 'cs-prueba-1', EMPRESA, 'ct-prueba-1');
  ins("INSERT INTO gh_contratacion_soportes VALUES (?,?,?)", 'cs-prueba-2', EMPRESA, 'ct-prueba-2');
  ins("INSERT INTO gh_contratacion_soportes VALUES (?,?,?)", 'cs-real', EMPRESA, 'ct-real');

  // Sedes: 2 de la empresa de prueba (que NO son suyas) + 1 de otra.
  ins("INSERT INTO gh_sedes VALUES (?,?,?)", 'se-a1', EMPRESA, 'ADMINISTRATIVA');
  ins("INSERT INTO gh_sedes VALUES (?,?,?)", 'se-a2', EMPRESA, 'ALMACEN');
  ins("INSERT INTO gh_sedes VALUES (?,?,?)", 'se-o1', 'Tempoactiva', 'PLANTA');

  // Identidad de la empresa de prueba + la de otra.
  ins("INSERT INTO empresa_datos_firma VALUES (?,?,?)", 1, EMPRESA, '900829731');
  ins("INSERT INTO empresa_representante_legal VALUES (?,?,?)", 1, EMPRESA, 'LILIA');
  ins("INSERT INTO empresa_representante_legal VALUES (?,?,?)", 2, 'Tempoactiva', 'JAVIER');
  ins("INSERT INTO companies VALUES (?,?,?)", 1, EMPRESA, EMPRESA);
  ins("INSERT INTO companies VALUES (?,?,?)", 2, 'Tempoactiva', 'Tempoactiva');

  // Plantillas: 2 de la prueba (con archivo) + 1 de otra empresa (con archivo).
  const t1 = archivo(userData, 'gh-templates/' + EMPRESA + '/tp-1.pdf');
  const t2 = archivo(userData, 'gh-templates/' + EMPRESA + '/tp-2.pdf');
  const t3 = archivo(userData, 'gh-templates/Tempoactiva/tp-3.pdf');
  ins("INSERT INTO gh_templates VALUES (?,?,?,?)", 'tp-1', EMPRESA, 'Autorizacion', t1);
  ins("INSERT INTO gh_templates VALUES (?,?,?,?)", 'tp-2', EMPRESA, 'Induccion', t2);
  ins("INSERT INTO gh_templates VALUES (?,?,?,?)", 'tp-3', 'Tempoactiva', 'Otra', t3);

  // Carpetas (categorias) de la empresa de prueba.
  ins("INSERT INTO gh_carpetas_categorias VALUES (?,?,?)", 'cc-1', EMPRESA, 'Contrato');
  ins("INSERT INTO gh_carpetas_categorias VALUES (?,?,?)", 'cc-2', EMPRESA, 'Identificacion');

  // Notificaciones.
  ins("INSERT INTO notificaciones VALUES (?,?,?)", 1, EMPRESA, 'Mantenimiento');
  ins("INSERT INTO notificaciones VALUES (?,?,?)", 2, EMPRESA, 'Presupuesto');
  ins("INSERT INTO notificaciones VALUES (?,?,?)", 3, 'Tempoactiva', 'Otra');

  return { archivos: docs.concat([jpeg, jpegReal, t1, t2, t3]) };
}

function contar(db, tabla, donde, params) {
  const sql = 'SELECT COUNT(*) AS n FROM "' + tabla + '"' + (donde ? ' WHERE ' + donde : '');
  const r = db.prepare(sql).get(...(params || []));
  return r ? r.n : 0;
}

function argsDe(userData, dbPath, extra) {
  return [
    '--empresa=' + EMPRESA,
    '--cedulas=' + CEDULAS_PRUEBA.join(','),
    '--actor=Javier Robles Fontalvo',
    '--motivo=Empresa de prueba: se retira del PC',
    '--db=' + dbPath,
    '--user-data=' + userData
  ].concat(extra || []);
}

function abrir(ruta) {
  return new DatabaseSync(ruta);
}

function capturar(fn) {
  const original = process.stdout.write;
  let texto = '';
  process.stdout.write = function (chunk) { texto += chunk; return true; };
  try { fn(); } finally { process.stdout.write = original; }
  return texto;
}

// ---------------------------------------------------------------------------
test('la simulacion no borra nada', () => {
  const root = tmp();
  const userData = path.join(root, 'userData');
  fs.mkdirSync(userData, { recursive: true });
  const dbPath = path.join(userData, 'kair.db');
  const db = abrir(dbPath);
  sembrar(db, userData);
  const antes = contar(db, 'base_personal');
  db.close();

  const script = require(SCRIPT);
  const codigo = script.main(argsDe(userData, dbPath, ['--quiet']));
  assert.equal(codigo, 0);

  const db2 = abrir(dbPath);
  assert.equal(contar(db2, 'base_personal'), antes, 'la simulacion no puede borrar filas');
  assert.equal(contar(db2, 'gh_documentos'), 6, 'la simulacion no puede borrar firmas');
  db2.close();
});

test('la ejecucion borra TODO lo de la empresa de prueba', () => {
  const root = tmp();
  const userData = path.join(root, 'userData');
  fs.mkdirSync(userData, { recursive: true });
  const dbPath = path.join(userData, 'kair.db');
  const db = abrir(dbPath);
  sembrar(db, userData);
  db.close();

  const script = require(SCRIPT);
  const codigo = script.main(argsDe(userData, dbPath, ['--quiet', '--ejecutar']));
  assert.equal(codigo, 0, 'la ejecucion tiene que salir bien');

  const db2 = abrir(dbPath);
  // Los trabajadores de prueba: fuera.
  assert.equal(contar(db2, 'base_personal', 'CAST(cedula AS TEXT) IN ('
    + CEDULAS_PRUEBA.map(() => '?').join(',') + ')', CEDULAS_PRUEBA), 0);
  // Sus firmas y sus documentos: fuera.
  assert.equal(contar(db2, 'gh_documentos', "id LIKE 'do-prueba-%'"), 0);
  // Los hijos SIN FK (por convencion): fuera.
  assert.equal(contar(db2, 'gh_firmas_sin_fk', "id LIKE 'fs-prueba-%'"), 0);
  // Sus contrataciones y sus soportes: fuera.
  assert.equal(contar(db2, 'contrataciones', "id LIKE 'ct-prueba-%'"), 0);
  assert.equal(contar(db2, 'gh_contratacion_soportes', "id LIKE 'cs-prueba-%'"), 0);
  // El expediente y su documento: fuera.
  assert.equal(contar(db2, 'gh_carpetas_expedientes', "id = 'ce-prueba'"), 0);
  assert.equal(contar(db2, 'gh_carpetas_documentos', "id = 'cd-prueba'"), 0);
  // La identidad de la empresa: fuera.
  assert.equal(contar(db2, 'empresa_datos_firma', 'empresa_id = ?', [EMPRESA]), 0);
  assert.equal(contar(db2, 'empresa_representante_legal', 'empresa_id = ?', [EMPRESA]), 0);
  assert.equal(contar(db2, 'companies', 'company_key = ?', [EMPRESA]), 0);
  assert.equal(contar(db2, 'gh_templates', 'empresa_id = ?', [EMPRESA]), 0);
  assert.equal(contar(db2, 'gh_carpetas_categorias', 'empresa_id = ?', [EMPRESA]), 0);
  assert.equal(contar(db2, 'notificaciones', 'company_key = ?', [EMPRESA]), 0);
  db2.close();

  // Los archivos: los de la prueba fuera, el de la otra empresa dentro.
  assert.ok(!fs.existsSync(path.join(userData, 'gh-docs', EMPRESA, 'do-prueba-0.pdf')),
    'el PDF de la firma de prueba tiene que estar borrado');
  assert.ok(!fs.existsSync(path.join(userData, 'gh-carpetas', EMPRESA, 'bp-prueba-1', 'identificacion', 'foto.jpeg')),
    'el JPEG del expediente de prueba tiene que estar borrado');
  assert.ok(!fs.existsSync(path.join(userData, 'gh-templates', EMPRESA, 'tp-1.pdf')),
    'la plantilla de la prueba tiene que estar borrada');
  assert.ok(fs.existsSync(path.join(userData, 'gh-templates', 'Tempoactiva', 'tp-3.pdf')),
    'la plantilla de la OTRA empresa no se toca');
});

test('NO se borra lo que es de verdad', () => {
  const root = tmp();
  const userData = path.join(root, 'userData');
  fs.mkdirSync(userData, { recursive: true });
  const dbPath = path.join(userData, 'kair.db');
  const db = abrir(dbPath);
  sembrar(db, userData);
  db.close();

  const script = require(SCRIPT);
  assert.equal(script.main(argsDe(userData, dbPath, ['--quiet', '--ejecutar'])), 0);

  const db2 = abrir(dbPath);
  // Los empleados REALES con el sello de la empresa: siguen ahi.
  assert.equal(contar(db2, 'base_personal', 'CAST(cedula AS TEXT) IN ('
    + CEDULAS_REALES.map(() => '?').join(',') + ')', CEDULAS_REALES), 4,
    'los empleados reales NO se borran: llevan el sello de la empresa activa');
  // Los empleados de otra empresa: siguen ahi.
  assert.equal(contar(db2, 'base_personal', 'empresa_id = ?', ['Tempoactiva']), 1);
  // Las sedes reales con el sello de la empresa: siguen ahi.
  assert.equal(contar(db2, 'gh_sedes', 'empresa_id = ?', [EMPRESA]), 2,
    'las sedes NO se borran: el sello empresa_id no es propiedad de la fila');
  // El documento y el expediente del empleado real: siguen ahi.
  assert.equal(contar(db2, 'gh_documentos', "id = 'do-real'"), 1);
  assert.equal(contar(db2, 'gh_carpetas_expedientes', "id = 'ce-real'"), 1);
  assert.equal(contar(db2, 'gh_carpetas_documentos', "id = 'cd-real'"), 1);
  assert.equal(contar(db2, 'gh_firmas_sin_fk', "id = 'fs-real'"), 1);
  // La contratacion del empleado real: sigue ahi.
  assert.equal(contar(db2, 'contrataciones', "id = 'ct-real'"), 1);
  // Lo de las otras empresas: sigue ahi.
  assert.equal(contar(db2, 'empresa_representante_legal', 'empresa_id = ?', ['Tempoactiva']), 1);
  assert.equal(contar(db2, 'companies', 'company_key = ?', ['Tempoactiva']), 1);
  assert.equal(contar(db2, 'gh_templates', 'empresa_id = ?', ['Tempoactiva']), 1);
  assert.equal(contar(db2, 'notificaciones', 'company_key = ?', ['Tempoactiva']), 1);
  db2.close();

  // El archivo del empleado real tampoco se toca.
  assert.ok(fs.existsSync(path.join(userData, 'gh-docs', EMPRESA, 'do-real.pdf')),
    'el PDF del empleado real no se toca');
});

test('el respaldo existe y tiene lo que habia antes', () => {
  const root = tmp();
  const userData = path.join(root, 'userData');
  fs.mkdirSync(userData, { recursive: true });
  const dbPath = path.join(userData, 'kair.db');
  const db = abrir(dbPath);
  sembrar(db, userData);
  const antes = contar(db, 'base_personal');
  db.close();

  const script = require(SCRIPT);
  assert.equal(script.main(argsDe(userData, dbPath, ['--quiet', '--ejecutar'])), 0);

  const dirBackups = path.join(userData, 'backups');
  const respaldos = fs.readdirSync(dirBackups).filter(f => f.startsWith('kair-antes-limpieza-'));
  assert.equal(respaldos.length, 1, 'tiene que haber un respaldo');
  const dbBak = abrir(path.join(dirBackups, respaldos[0]));
  assert.equal(contar(dbBak, 'base_personal'), antes,
    'el respaldo tiene que tener las filas de ANTES');
  assert.equal(contar(dbBak, 'gh_documentos'), 6, 'el respaldo tiene las firmas de antes');
  dbBak.close();
});

test('la corrida dice en la pantalla si borra o simula', () => {
  const root = tmp();
  const userData = path.join(root, 'userData');
  fs.mkdirSync(userData, { recursive: true });
  const dbPath = path.join(userData, 'kair.db');
  const db = abrir(dbPath);
  sembrar(db, userData);
  db.close();

  const script = require(SCRIPT);
  const sim = capturar(() => script.main(argsDe(userData, dbPath)));
  assert.ok(sim.includes('(SIMULACION)'), 'la simulacion se anuncia como simulacion');
  assert.ok(sim.includes('no se toca nada'), 'la simulacion avisa que no toca nada');

  const eje = capturar(() => script.main(argsDe(userData, dbPath, ['--ejecutar'])));
  assert.ok(eje.includes('(EJECUCION)'), 'la ejecucion se anuncia como ejecucion');
  assert.ok(!eje.includes('no se toca nada'),
    'la ejecucion NO puede decir que no se toca nada: esta borrando');
});

test('es idempotente: correrlo otra vez no rompe', () => {
  const root = tmp();
  const userData = path.join(root, 'userData');
  fs.mkdirSync(userData, { recursive: true });
  const dbPath = path.join(userData, 'kair.db');
  const db = abrir(dbPath);
  sembrar(db, userData);
  db.close();

  const script = require(SCRIPT);
  assert.equal(script.main(argsDe(userData, dbPath, ['--quiet', '--ejecutar'])), 0);
  const db2 = abrir(dbPath);
  const reales = contar(db2, 'base_personal', 'CAST(cedula AS TEXT) IN ('
    + CEDULAS_REALES.map(() => '?').join(',') + ')', CEDULAS_REALES);
  db2.close();

  assert.equal(script.main(argsDe(userData, dbPath, ['--quiet', '--ejecutar'])), 0);
  const db3 = abrir(dbPath);
  assert.equal(contar(db3, 'base_personal', 'CAST(cedula AS TEXT) IN ('
    + CEDULAS_REALES.map(() => '?').join(',') + ')', CEDULAS_REALES), reales,
    'la segunda corrida no puede tocar los empleados reales');
  assert.equal(contar(db3, 'gh_documentos'), 1, 'solo queda el documento del empleado real');
  db3.close();
});

test('sin --actor o sin --motivo no se hace nada', () => {
  const root = tmp();
  const userData = path.join(root, 'userData');
  fs.mkdirSync(userData, { recursive: true });
  const dbPath = path.join(userData, 'kair.db');
  const db = abrir(dbPath);
  sembrar(db, userData);
  db.close();

  const script = require(SCRIPT);
  const sinActor = [
    '--empresa=' + EMPRESA, '--cedulas=' + CEDULAS_PRUEBA.join(','),
    '--motivo=prueba', '--db=' + dbPath, '--user-data=' + userData, '--ejecutar', '--quiet'
  ];
  assert.equal(script.main(sinActor), 2);

  const db2 = abrir(dbPath);
  assert.equal(contar(db2, 'gh_documentos'), 6, 'sin --actor no se borra nada');
  db2.close();
});

// ---------------------------------------------------------------------------
// Las mutaciones: cada una tiene que MORIR
// ---------------------------------------------------------------------------
function correrMutado(mutacion, etiqueta) {
  const root = tmp();
  const userData = path.join(root, 'userData');
  fs.mkdirSync(userData, { recursive: true });
  const dbPath = path.join(userData, 'kair.db');
  const db = abrir(dbPath);
  sembrar(db, userData);
  db.close();

  const fuenteMutada = mutacion(SCRIPT_FUENTE);
  assert.notEqual(fuenteMutada, SCRIPT_FUENTE, 'la mutacion tiene que cambiar el script: ' + etiqueta);
  const rutaMutada = path.join(root, 'mutado.js');
  fs.writeFileSync(rutaMutada, fuenteMutada, 'utf8');
  delete require.cache[require.resolve(rutaMutada)];
  const mutado = require(rutaMutada);

  let codigo = 0;
  try {
    codigo = mutado.main(argsDe(userData, dbPath, ['--quiet', '--ejecutar']));
  } catch (e) {
    codigo = -1;
  }

  const db2 = abrir(dbPath);
  const reales = contar(db2, 'base_personal', 'CAST(cedula AS TEXT) IN ('
    + CEDULAS_REALES.map(() => '?').join(',') + ')', CEDULAS_REALES);
  db2.close();
  return { codigo: codigo, realesVivos: reales };
}

test('MUTACION: si el script borra por empresa_id en vez de por cedula, se detecta', () => {
  // Se cambia la seleccion de los trabajadores: en vez de las cedulas, todas
  // las personas de la empresa (incluidos los 4 empleados reales).
  const res = correrMutado((fuente) => fuente
    .replace(
      `" WHERE CAST(cedula AS TEXT) IN ('`,
      `" WHERE CAST(empresa_id AS TEXT) = ? OR CAST(cedula AS TEXT) IN ('`)
    .replace('.all(...marcCedulas);', '.all(opts.empresa, ...marcCedulas);'),
  'borra por empresa_id');

  assert.ok(res.realesVivos < 4 || res.codigo !== 0,
    'la mutacion tiene que hacer dano o el guard tiene que frenar: si las dos cosas pasan, '
    + 'el test NO detecta el defecto (reales vivos: ' + res.realesVivos + ', codigo: ' + res.codigo + ')');
});

test('MUTACION: si el guard que avisa del exceso de borrado deja de avisar, se detecta', () => {
  // Se desactiva el invariante que compara cuantos empleados reales quedan.
  const res = correrMutado((fuente) => fuente
    .replace('if (quedanReal !== antes.guard.personalDeLaEmpresaQueQueda) {',
      'if (false) {')
    .replace(
      `" WHERE CAST(cedula AS TEXT) IN ('`,
      `" WHERE CAST(empresa_id AS TEXT) = ? OR CAST(cedula AS TEXT) IN ('`)
    .replace('.all(...marcCedulas);', '.all(opts.empresa, ...marcCedulas);'),
  'guard apagado');

  assert.ok(res.realesVivos < 4,
    'sin el guard, los empleados reales se borran: el test tiene que verlo (vivos: '
    + res.realesVivos + ')');
});
