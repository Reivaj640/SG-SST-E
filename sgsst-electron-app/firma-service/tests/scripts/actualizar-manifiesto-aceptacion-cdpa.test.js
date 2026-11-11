/**
 * EL REGISTRO DE LA ACEPTACIÓN DEL CDPA: EL MANIFIESTO SOLO DICE "ACEPTADA"
 * CON LA EVIDENCIA QUE EL ACTA DECLARA
 * ============================================================================
 *
 * El item `mail_provider_dpa` del gate exige que el manifiesto declare que la
 * cuenta del proveedor de correo tiene el CDPA incorporado al Acuerdo, o
 * aceptado por el administrador en la consola. Ese dato NO se escribe a mano:
 * lo escribe `scripts/actualizar-manifiesto-aceptacion-cdpa.js` leyendo un
 * ACTA (un JSON) y copiando de ahí lo que el acta declara.
 *
 * Por qué un acta y no una edición a mano: una aceptación escrita a mano es
 * una afirmación sin respaldo. El acta obliga a declarar QUIÉN responde, QUÉ
 * evidencia hay, y en qué MODO se acepta. Y el script falla cerrado: si al
 * acta le falta un campo, o la evidencia que cita no existe, o la huella del
 * CDPA no es la que el propio manifiesto declara, NO se escribe nada.
 *
 * Los dos modos:
 *
 *   `aceptado_por_administrador`  el superadministrador hizo clic en
 *                                 "I Accept" en la consola de Workspace. La
 *                                 evidencia es un archivo (captura): el
 *                                 script calcula su SHA-256 y lo registra.
 *
 *   `incorporado_por_referencia`  el Acuerdo de la cuenta ya incorpora el
 *                                 CDPA. La evidencia son los dos textos
 *                                 oficiales (el Acuerdo y el CDPA) con su
 *                                 huella y su fecha de descarga, más la
 *                                 atestación escrita del owner que vincula la
 *                                 cuenta con ese Acuerdo.
 *
 * Lo que se verifica acá:
 *
 *   - Que sin acta, sin modo, sin fecha, sin evidencia o sin responsable NO
 *     se escribe nada (código 2).
 *   - Que una fecha futura NO se acepta (código 2).
 *   - Que una captura que no existe NO se acepta (código 3).
 *   - Que un CDPA cuya huella NO es la que declara el manifiesto NO se
 *     acepta (código 5): la evidencia describiría otro texto.
 *   - Que una URL que no es de un dominio oficial de Google NO es evidencia.
 *   - Que no se puede registrar la aceptación si el manifiesto no dice que
 *     hay CDPA (`dpa`) o que el papel es de subencargado (`rol`).
 *   - Que el script NO toca ningún otro bloque del manifiesto.
 *   - Que `--check` no escribe nada.
 *   - Que aplicar dos veces el mismo acta deja el archivo idéntico.
 */
'use strict';

const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const script = require('../../scripts/actualizar-manifiesto-aceptacion-cdpa');

const SERVICE_ROOT = path.resolve(__dirname, '..', '..');
const MANIFIESTO_REAL = path.join(SERVICE_ROOT, 'legal-readiness.json');

const HOY = '2026-11-10';

let tmp;
let copia;
let rutaActa;

/** El manifiesto real, para partir de su estado y de sus huellas. */
function manifiestoReal() {
  return JSON.parse(fs.readFileSync(MANIFIESTO_REAL, 'utf8'));
}

/** Escribe el manifiesto en la misma forma canonica que usa el script. */
function escribirManifiesto(man) {
  fs.writeFileSync(copia, script.asciiEscape(JSON.stringify(man, null, 2)) + '\n', 'utf8');
}

function escribirActa(acta) {
  fs.writeFileSync(rutaActa, JSON.stringify(acta, null, 2), 'utf8');
  return rutaActa;
}

/** Un acta de incorporation por referencia, completa y valida. */
function actaIncorporado(extra = {}) {
  const mp = manifiestoReal().subencargados.mail_provider;
  return Object.assign({
    modo: 'incorporado_por_referencia',
    fecha: HOY,
    responsable: 'Javier Robles Fontalvo (representante legal, Gesstiar S.A.S.)',
    cuenta: 'gesstiar.com (Google Workspace)',
    evidencia: 'Evidencia de prueba: el CDPA esta incorporado al Acuerdo.',
    at_testacion: 'Atestacion escrita del owner (prueba).',
    acuerdo: {
      url: 'https://workspace.google.com/terms/premier_terms/?hl=en',
      hash: 'a'.repeat(64),
      bytes: 467263,
      descargado: HOY,
      idioma: 'en',
    },
    cdpa: {
      url: 'https://admin.google.com/terms/apps/8/1/en/dpa_terms.html',
      hash: mp.hash,
      bytes: mp.bytes,
      descargado: HOY,
    },
    fecha_efectividad_addendum: null,
    observaciones: 'Observacion de prueba.',
  }, extra);
}

/** Un acta de aceptacion en la consola, con su captura. */
function actaAceptado(extra = {}) {
  return Object.assign({
    modo: 'aceptado_por_administrador',
    fecha: HOY,
    responsable: 'Javier Robles Fontalvo (representante legal, Gesstiar S.A.S.)',
    evidencia: 'Evidencia de prueba: el administrador acepto el CDPA en la consola.',
    captura: {
      archivo: 'captura-consola.png',
      descripcion: 'Captura de la pantalla de aceptacion del CDPA.',
    },
    observaciones: 'Observacion de prueba.',
  }, extra);
}

/** Ejecuta el script esperando un error con codigo. */
function esperaError(fn, codigo, mensaje = '') {
  try {
    fn();
  } catch (err) {
    assert.equal(err.codigo, codigo,
      `codigo esperado ${codigo}, recibido ${err.codigo}: ${err.message}`);
    if (mensaje) {
      assert.match(err.message, new RegExp(mensaje, 'i'),
        `el mensaje no dice "${mensaje}": ${err.message}`);
    }
    return err;
  }
  assert.fail('el script deberia haber fallado');
  return null;
}

function aplicar(extraArgs = []) {
  return script.main([
    '--aplicar',
    '--acta=' + rutaActa,
    '--manifiesto=' + copia,
    '--hoy=' + HOY,
  ].concat(extraArgs));
}

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kair-cdpa-'));
  copia = path.join(tmp, 'legal-readiness.json');
  rutaActa = path.join(tmp, 'acta.json');
  escribirManifiesto(manifiestoReal());
});

afterEach(() => {
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch (e) { /* la carpeta temporal no se limpia: no es un fallo del test */ }
});

// =============================================================================
// EL USO
// =============================================================================

test('cdpa · aplicar sin acta no escribe nada', () => {
  const antes = fs.readFileSync(copia);
  esperaError(() => script.main(['--aplicar', '--manifiesto=' + copia]), 2, 'acta');
  assert.deepEqual(fs.readFileSync(copia), antes);
});

test('cdpa · sin --aplicar ni --check no escribe nada', () => {
  escribirActa(actaIncorporado());
  const antes = fs.readFileSync(copia);
  esperaError(() => script.main([
    '--acta=' + rutaActa, '--manifiesto=' + copia, '--hoy=' + HOY,
  ]), 2);
  assert.deepEqual(fs.readFileSync(copia), antes);
});

test('cdpa · un manifiesto que no es JSON falla con 3', () => {
  escribirActa(actaIncorporado());
  fs.writeFileSync(copia, '{esto no es json', 'utf8');
  esperaError(() => script.main([
    '--aplicar', '--acta=' + rutaActa, '--manifiesto=' + copia, '--hoy=' + HOY,
  ]), 3, 'JSON');
});

// =============================================================================
// EL ACTA: LO QUE NO PUEDE FALTAR
// =============================================================================

test('cdpa · un modo desconocido se rechaza', () => {
  escribirActa(actaIncorporado({ modo: 'por_la_fuerza' }));
  esperaError(() => aplicar(), 2, 'modo');
});

test('cdpa · sin fecha se rechaza', () => {
  escribirActa(actaIncorporado({ fecha: null }));
  esperaError(() => aplicar(), 2, 'fecha');
});

test('cdpa · una fecha que no es ISO se rechaza', () => {
  escribirActa(actaIncorporado({ fecha: '10/11/2026' }));
  esperaError(() => aplicar(), 2, 'fecha');
});

test('cdpa · una fecha futura se rechaza', () => {
  escribirActa(actaIncorporado({ fecha: '2026-12-01' }));
  esperaError(() => aplicar(), 2, 'futuro');
});

test('cdpa · sin evidencia se rechaza', () => {
  escribirActa(actaIncorporado({ evidencia: '   ' }));
  esperaError(() => aplicar(), 2, 'evidencia');
});

test('cdpa · sin responsable se rechaza', () => {
  escribirActa(actaIncorporado({ responsable: null }));
  esperaError(() => aplicar(), 2, 'responde');
});

test('cdpa · un acta que declara "no aceptada" se rechaza', () => {
  escribirActa(actaIncorporado({ aceptada: false }));
  esperaError(() => aplicar(), 2);
});

test('cdpa · sin cuenta se rechaza en el modo de incorporacion', () => {
  escribirActa(actaIncorporado({ cuenta: null }));
  esperaError(() => aplicar(), 2, 'cuenta');
});

test('cdpa · sin atestado del owner se rechaza en el modo de incorporacion', () => {
  escribirActa(actaIncorporado({ at_testacion: null }));
  esperaError(() => aplicar(), 2, 'atestacion');
});

test('cdpa · sin el Acuerdo se rechaza en el modo de incorporacion', () => {
  escribirActa(actaIncorporado({ acuerdo: null }));
  esperaError(() => aplicar(), 2, 'acuerdo');
});

test('cdpa · un Acuerdo de un dominio que no es de Google no es evidencia', () => {
  escribirActa(actaIncorporado({
    acuerdo: {
      url: 'https://ejemplo-no-oficial.com/terms',
      hash: 'a'.repeat(64),
      bytes: 1234,
      descargado: HOY,
    },
  }));
  esperaError(() => aplicar(), 2, 'oficial');
});

test('cdpa · una huella que no es un SHA-256 se rechaza', () => {
  escribirActa(actaIncorporado({
    acuerdo: {
      url: 'https://workspace.google.com/terms/premier_terms/?hl=en',
      hash: 'no-es-una-huella',
      bytes: 1234,
      descargado: HOY,
    },
  }));
  esperaError(() => aplicar(), 2, 'SHA-256');
});

// =============================================================================
// LA EVIDENCIA CONTRA EL TEXTO QUE EL PROPIO MANIFIESTO DECLARA
// =============================================================================

test('cdpa · un CDPA con otra huella no se acepta: la evidencia describe otro texto', () => {
  escribirActa(actaIncorporado({
    cdpa: {
      url: 'https://admin.google.com/terms/apps/8/1/en/dpa_terms.html',
      hash: 'b'.repeat(64),
      bytes: 97831,
      descargado: HOY,
    },
  }));
  esperaError(() => aplicar(), 5, 'huella');
});

test('cdpa · un CDPA con otro numero de bytes no se acepta', () => {
  escribirActa(actaIncorporado({
    cdpa: {
      url: 'https://admin.google.com/terms/apps/8/1/en/dpa_terms.html',
      hash: manifiestoReal().subencargados.mail_provider.hash,
      bytes: 12345,
      descargado: HOY,
    },
  }));
  esperaError(() => aplicar(), 5, 'bytes');
});

// =============================================================================
// EL MODO DE LA CONSOLA: LA CAPTURA TIENE QUE EXISTIR
// =============================================================================

test('cdpa · el modo de la consola sin captura se rechaza', () => {
  escribirActa(actaAceptado({ captura: null }));
  esperaError(() => aplicar(), 2, 'captura');
});

test('cdpa · una captura que no existe no se acepta', () => {
  escribirActa(actaAceptado({
    captura: { archivo: 'no-existe.png', descripcion: 'prueba' },
  }));
  esperaError(() => aplicar(), 3, 'captura');
});

test('cdpa · una captura que existe se registra con su huella y sus bytes', () => {
  const archivoCaptura = path.join(tmp, 'captura.png');
  fs.writeFileSync(archivoCaptura, 'PNG DE PRUEBA');
  escribirActa(actaAceptado({
    captura: { archivo: 'captura.png', descripcion: 'Pantalla de aceptacion.' },
  }));
  aplicar();
  const man = JSON.parse(fs.readFileSync(copia, 'utf8'));
  const cap = man.subencargados.mail_provider.aceptacion.captura;
  assert.ok(cap, 'la captura no quedo registrada');
  assert.equal(cap.bytes, 'PNG DE PRUEBA'.length);
  assert.match(cap.hash, /^[0-9a-f]{64}$/);
  assert.equal(cap.descripcion, 'Pantalla de aceptacion.');
});

// =============================================================================
// EL ESTADO DEL MANIFIESTO TIENE QUE SOPORTAR LA ACEPTACION
// =============================================================================

test('cdpa · no se registra la aceptacion si el manifiesto no declara CDPA', () => {
  const man = manifiestoReal();
  man.subencargados.mail_provider.dpa = false;
  escribirManifiesto(man);
  escribirActa(actaIncorporado());
  const antes = fs.readFileSync(copia);
  esperaError(() => aplicar(), 3);
  assert.deepEqual(fs.readFileSync(copia), antes);
});

test('cdpa · no se registra la aceptacion si el papel no es de subencargado', () => {
  const man = manifiestoReal();
  man.subencargados.mail_provider.rol = 'responsable';
  escribirManifiesto(man);
  escribirActa(actaIncorporado());
  esperaError(() => aplicar(), 3, 'subencargado');
});

// =============================================================================
// LA ESCRITURA
// =============================================================================

test('cdpa · aplicar escribe la aceptacion con modo, fecha, evidencia y responsable', () => {
  escribirActa(actaIncorporado());
  const salida = aplicar();
  assert.equal(salida.ok, true);
  assert.equal(salida.modo, 'incorporado_por_referencia');

  const acc = JSON.parse(fs.readFileSync(copia, 'utf8'))
    .subencargados.mail_provider.aceptacion;
  assert.equal(acc.aceptada, true);
  assert.equal(acc.modo, 'incorporado_por_referencia');
  assert.equal(acc.fecha, HOY);
  assert.equal(acc.responsable, 'Javier Robles Fontalvo (representante legal, Gesstiar S.A.S.)');
  assert.ok(acc.evidencia.length > 0);
  assert.equal(acc.cuenta, 'gesstiar.com (Google Workspace)');
  assert.ok(acc.at_testacion.length > 0);
  assert.equal(acc.acuerdo.hash, 'a'.repeat(64));
  assert.equal(acc.cdpa.hash, manifiestoReal().subencargados.mail_provider.hash);
});

test('cdpa · la fecha de efectividad del Addendum ausente queda en null: no se inventa', () => {
  escribirActa(actaIncorporado());
  aplicar();
  const acc = JSON.parse(fs.readFileSync(copia, 'utf8'))
    .subencargados.mail_provider.aceptacion;
  assert.equal(acc.fecha_efectividad_addendum, null);
});

test('cdpa · el script NO toca ningun otro bloque del manifiesto', () => {
  const antes = manifiestoReal();
  escribirActa(actaIncorporado());
  aplicar();
  const despues = JSON.parse(fs.readFileSync(copia, 'utf8'));

  const copiaAntes = JSON.parse(JSON.stringify(antes));
  const copiaDespues = JSON.parse(JSON.stringify(despues));
  delete copiaAntes.subencargados.mail_provider.aceptacion;
  delete copiaDespues.subencargados.mail_provider.aceptacion;
  assert.deepEqual(copiaDespues, copiaAntes);
});

test('cdpa · el manifiesto escrito sigue siendo JSON valido y ASCII puro', () => {
  escribirActa(actaIncorporado());
  aplicar();
  const crudo = fs.readFileSync(copia, 'utf8');
  assert.doesNotThrow(() => JSON.parse(crudo));
  assert.equal((crudo.match(/[^\x00-\x7F]/g) || []).length, 0);
});

test('cdpa · aplicar dos veces el mismo acta deja el archivo identico', () => {
  escribirActa(actaIncorporado());
  aplicar();
  const primera = fs.readFileSync(copia);
  aplicar();
  assert.deepEqual(fs.readFileSync(copia), primera);
});

// =============================================================================
// EL --check
// =============================================================================

test('cdpa · --check antes de aplicar no escribe nada y avisa que no coincide', () => {
  escribirActa(actaIncorporado());
  const antes = fs.readFileSync(copia);
  const salida = script.main([
    '--check', '--acta=' + rutaActa, '--manifiesto=' + copia, '--hoy=' + HOY,
  ]);
  assert.equal(salida.coincide, false);
  assert.deepEqual(fs.readFileSync(copia), antes);
});

test('cdpa · --check despues de aplicar dice que coincide', () => {
  escribirActa(actaIncorporado());
  aplicar();
  const salida = script.main([
    '--check', '--acta=' + rutaActa, '--manifiesto=' + copia, '--hoy=' + HOY,
  ]);
  assert.equal(salida.coincide, true);
});

// =============================================================================
// LA CAPTURA QUE NO ESTA EN ESTA MAQUINA: EL ACTA DECLARA SU HUELLA
// =============================================================================
//
// El owner hace el clic "I Accept" en SU maquina y guarda la captura alla. En
// la VM (o en el ambiente donde se regenera el manifiesto) el archivo puede no
// estar. Para que el registro no dependa de donde se corra, el acta puede
// declarar la huella y los bytes de la captura. El script los verifica contra
// el archivo SI el archivo esta; si no esta, los registra y deja constancia
// de que no se verificaron en esta maquina.

test('cdpa · una captura ausente con la huella declarada en el acta se registra', () => {
  escribirActa(actaAceptado({
    captura: {
      archivo: 'captura-consola-cdpa-2026-11-10.png',
      descripcion: 'Pantalla de aceptacion del CDPA en la consola.',
      hash: 'c'.repeat(64),
      bytes: 4096,
    },
  }));
  aplicar();
  const cap = JSON.parse(fs.readFileSync(copia, 'utf8'))
    .subencargados.mail_provider.aceptacion.captura;
  assert.equal(cap.archivo, 'captura-consola-cdpa-2026-11-10.png');
  assert.equal(cap.hash, 'c'.repeat(64));
  assert.equal(cap.bytes, 4096);
  assert.equal(cap.verificado_localmente, false,
    'el archivo no esta en esta maquina: hay que dejarlo dicho, no como verificado');
});

test('cdpa · una captura presente con la huella declarada se verifica en esta maquina', () => {
  const archivoCaptura = path.join(tmp, 'captura.png');
  fs.writeFileSync(archivoCaptura, 'PNG DE PRUEBA');
  const bytes = fs.readFileSync(archivoCaptura);
  const hash = crypto.createHash('sha256').update(bytes).digest('hex');
  escribirActa(actaAceptado({
    captura: {
      archivo: 'captura.png',
      descripcion: 'Pantalla de aceptacion.',
      hash,
      bytes: bytes.length,
    },
  }));
  aplicar();
  const cap = JSON.parse(fs.readFileSync(copia, 'utf8'))
    .subencargados.mail_provider.aceptacion.captura;
  assert.equal(cap.verificado_localmente, true);
  assert.equal(cap.hash, hash);
  assert.equal(cap.bytes, bytes.length);
});

test('cdpa · una captura presente cuya huella declarada NO coincide se rechaza', () => {
  const archivoCaptura = path.join(tmp, 'captura.png');
  fs.writeFileSync(archivoCaptura, 'PNG DE PRUEBA');
  escribirActa(actaAceptado({
    captura: {
      archivo: 'captura.png',
      descripcion: 'Pantalla.',
      hash: 'd'.repeat(64),
      bytes: 12,
    },
  }));
  esperaError(() => aplicar(), 3, 'huella');
});

test('cdpa · una captura ausente con huella que no es SHA-256 se rechaza', () => {
  escribirActa(actaAceptado({
    captura: {
      archivo: 'captura.png',
      descripcion: 'Pantalla.',
      hash: 'no-es-una-huella',
      bytes: 4096,
    },
  }));
  esperaError(() => aplicar(), 2, 'SHA-256');
});

test('cdpa · una captura ausente sin huella declarada se rechaza: no hay evidencia', () => {
  escribirActa(actaAceptado({
    captura: { archivo: 'captura.png', descripcion: 'Pantalla.' },
  }));
  esperaError(() => aplicar(), 3, 'captura');
});

// =============================================================================
// LOS MARCADORES: UN ACTA CON "PENDIENTE" NO ES UN ACTA
// =============================================================================
//
// El acta se prepara antes de que el owner haga el clic. En ese estado trae
// marcas de "por llenar". Si el script las aceptara, seria un registro hecho
// con una frase que nadie verifico: el mismo falso verde que este proyecto
// combate desde el primer dia. Los marcadores se rechazan, campo por campo.

test('cdpa · una evidencia que es un marcador se rechaza', () => {
  escribirActa(actaIncorporado({ evidencia: 'PENDIENTE' }));
  esperaError(() => aplicar(), 2, 'marcador');
});

test('cdpa · una attestacion que es un marcador se rechaza', () => {
  escribirActa(actaIncorporado({ at_testacion: 'pendiente de confirmar por el owner' }));
  esperaError(() => aplicar(), 2, 'marcador');
});

test('cdpa · un responsable que es un marcador se rechaza', () => {
  escribirActa(actaIncorporado({ responsable: '[nombre del owner]' }));
  esperaError(() => aplicar(), 2, 'marcador');
});

test('cdpa · una cuenta que es un marcador se rechaza', () => {
  escribirActa(actaIncorporado({ cuenta: 'por definir' }));
  esperaError(() => aplicar(), 2, 'marcador');
});

test('cdpa · una fecha de efectividad que es un marcador no se convierte en una fecha', () => {
  escribirActa(actaIncorporado({ fecha_efectividad_addendum: 'PENDIENTE' }));
  const salida = aplicar();
  assert.equal(salida.fecha_efectividad_addendum, null,
    'una fecha que es un marcador no es una fecha: queda en null');
});
