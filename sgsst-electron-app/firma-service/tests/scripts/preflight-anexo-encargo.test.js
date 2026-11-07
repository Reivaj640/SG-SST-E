/**
 * EL PREFLIGHT DEL ANEXO DE ENCARGO
 * ============================================================================
 *
 * El preflight es la pregunta que se hace ANTES de que el manifiesto diga
 * "firmado": ¿esta todo en su sitio? Un manifiesto que dice "firmado" sin que
 * el texto, los dos actos, las actas y el respaldo esten en su sitio no es un
 * aviso pendiente: es una afirmacion falsa en el documento que lee la
 * compuerta de publicacion.
 *
 * Lo que se verifica aca:
 *
 * - Que con todo en su sitio el preflight pasa (codigo 0).
 * - Que sin el TEXTO (o con otra huella) aborta: el servicio firmaria un texto
 *   que nadie ha verificado (codigo 4).
 * - Que sin la CONTRAFIRMA aborta: el Anexo es bilateral (codigo 5).
 * - Que una suscripcion contrafirmada sin fecha de ejecucion en la ficha
 *   aborta (codigo 5).
 * - Que las dos ACTAS tienen que estar en disco y con la huella que quedo
 *   registrada (codigo 6).
 * - Que el RESPALDO tiene que llevarse la carpeta entera de `storage/` (codigo
 *   8): el acta de la suscripcion ya salio del servidor y no se puede
 *   regenerar.
 * - Que con `--exigir-firmado` el manifiesto TIENE que decir "firmado"
 *   (codigo 7).
 */
'use strict';

const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const db = require('../../src/db/connection');
const anexoEncargo = require('../../src/services/anexoEncargo');
const mailer = require('../../src/services/mailer');
const storage = require('../../src/services/storage');
const { resetDb } = require('../helpers');
const preflight = require('../../scripts/preflight-anexo-encargo');
const manifiesto = require('../../scripts/actualizar-manifiesto-anexo-encargo');

const SERVICE_ROOT = path.resolve(__dirname, '..', '..');
const MANIFIESTO_REAL = path.join(SERVICE_ROOT, 'legal-readiness.json');
const BACKUP_REAL = path.join(SERVICE_ROOT, 'deploy', 'backup-firma.sh');

const ID_EMPRESA = '900555777';
const CORREO_FIRMANTE = 'representante@empresa-prueba.test';
const CANAL_CODIGO = 'segundo-canal@empresa-prueba.test';

const DATOS_S11 = {
  razon_social: 'EMPRESA DE PRUEBA SAS',
  nit: '900555777-1',
  domicilio: 'Calle 47 # 43-57 Piso 2, Barranquilla',
  correo: 'datos@empresa-prueba.test',
  representante: 'PERSONA DE PRUEBA',
};

let tmp;
let copia;
let lineasSalida;

// ===========================================================================
// HELPERS
// ===========================================================================

function sembrarEmpresa() {
  db.prepare(`
    INSERT INTO gh_firma_empresas
      (id_empresa, razon_social, nit, domicilio, canal_pqrs,
       responsable_tratamiento_correo, representante_legal, activo)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `).run(ID_EMPRESA, DATOS_S11.razon_social, DATOS_S11.nit, DATOS_S11.domicilio,
    'pqrs@empresa-prueba.test', DATOS_S11.correo, DATOS_S11.representante);
}

function ultimoCorreo(tipo) {
  const inbox = mailer.getDevInbox();
  for (let i = inbox.length - 1; i >= 0; i--) {
    if (inbox[i].tipo === tipo) return inbox[i];
  }
  return null;
}

/**
 * El flujo real: la Empresa se suscribe y K+AIR contrafirma.
 *
 * @param {object} opciones
 * @param {boolean} opciones.contrafirmar si se llega al segundo acto.
 * @returns {Promise<object>}
 */
async function sembrarFlujo(opciones = {}) {
  resetDb();
  sembrarEmpresa();
  mailer.clearDevInbox();

  const abierto = await anexoEncargo.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
    canal_codigo: CANAL_CODIGO,
    canal_codigo_confirmacion: 'Confirmado por llamada de prueba',
  }, { actor: 'admin', ip: '10.0.0.1', user_agent: 'test' });

  await anexoEncargo.solicitarCodigo(abierto.token, {});
  await anexoEncargo.suscribir(abierto.token, {
    otp: ultimoCorreo('anexo_encargo').otp,
    acepta: true,
    acepta_tratamiento: true,
    datos_empresa: DATOS_S11,
    representante: { documento: '900123456', calidad: 'REPRESENTANTE_LEGAL' },
  }, { ip: '203.0.113.9', user_agent: 'Navegador/1.0' });

  const idSuscripcion = db.prepare(
    'SELECT id FROM gh_firma_anexo_encargo_suscripciones ORDER BY id DESC LIMIT 1',
  ).get().id;

  if (!opciones.contrafirmar) return { idSuscripcion };

  anexoEncargo.verificarRepresentante(ID_EMPRESA, idSuscripcion, {
    tipo_documento: 'CERTIFICADO_CAMARA',
    referencia: 'Radicado 2026-11-07-14',
  }, { actor: 'admin', motivo: 'Verificado contra el certificado de la camara' });

  await anexoEncargo.solicitarCodigoContrafirma(ID_EMPRESA, idSuscripcion, {
    ip: '10.0.0.9', user_agent: 'Operador/1.0',
  });
  await anexoEncargo.contrafirmar(ID_EMPRESA, idSuscripcion, {
    otp: ultimoCorreo('anexo_encargo_contrafirma').otp,
    acepta: true,
  }, { actor: 'admin', motivo: 'prueba del preflight' });

  return { idSuscripcion };
}

/** Los nombres de las dos actas, como quedaron registradas. */
function actasDe(idSuscripcion) {
  const fila = db.prepare(
    'SELECT evidencia, contrafirma_acta_archivo FROM gh_firma_anexo_encargo_suscripciones WHERE id = ?',
  ).get(idSuscripcion);
  const ev = JSON.parse(fila.evidencia);
  return {
    suscripcion: ev.acta_archivo,
    contrafirma: fila.contrafirma_acta_archivo,
  };
}

/** Los argumentos de siempre: el manifiesto de la COPIA. */
function args(extra = []) {
  return ['--manifiesto', copia, ...extra];
}

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-encargo-'));
  copia = path.join(tmp, 'legal-readiness.json');
  fs.copyFileSync(MANIFIESTO_REAL, copia);
  lineasSalida = [];
  preflight.fijarSalida((t) => lineasSalida.push(t), (t) => lineasSalida.push(t));
  manifiesto.fijarSalida((t) => lineasSalida.push(t), (t) => lineasSalida.push(t));
});

afterEach(() => {
  try { db.prepare('DELETE FROM gh_firma_empresas').run(); } catch (e) { /* tabla ausente */ }
  try {
    for (const f of fs.readdirSync(storage.PATHS.actas)) {
      if (f.startsWith('acta-') && f.includes('anexo-encargo')) {
        fs.unlinkSync(path.join(storage.PATHS.actas, f));
      }
    }
  } catch (e) { /* la carpeta puede no existir */ }
  fs.rmSync(tmp, { recursive: true, force: true });
});

// ===========================================================================
// 1. TODO EN SU SITIO
// ===========================================================================

test('con el texto, los dos actos, las actas y el respaldo: pasa', async () => {
  await sembrarFlujo({ contrafirmar: true });

  const rc = preflight.main(args());
  assert.equal(rc, 0, 'el preflight paso: ' + lineasSalida.join(' | '));
});

test('el JSON dice que ok y trae el detalle de los dos actos', async () => {
  await sembrarFlujo({ contrafirmar: true });

  const rc = preflight.main(args(['--json']));
  assert.equal(rc, 0);

  const salida = JSON.parse(lineasSalida[lineasSalida.length - 1]);
  assert.equal(salida.ok, true);
  assert.equal(salida.texto.coincide, true);
  assert.equal(salida.empresas.contrafirmadas, 1);
  assert.equal(salida.empresas.detalle.length, 1);
  assert.equal(salida.empresas.detalle[0].ejecutada, true);
  assert.equal(salida.actas.detalle.length, 2, 'las dos actas: suscripcion y contrafirma');
  assert.equal(salida.respaldo.lleva_storage_entero, true);
});

// ===========================================================================
// 2. EL TEXTO
// ===========================================================================

test('sin el texto del Anexo de Encargo aborta con codigo 4', async () => {
  await sembrarFlujo({ contrafirmar: true });
  const rc = preflight.main(args(['--texto', path.join(tmp, 'no-existe.html')]));
  assert.equal(rc, 4);
});

test('con un texto cuya huella NO es la del manifiesto aborta con codigo 4', async () => {
  await sembrarFlujo({ contrafirmar: true });
  const otro = path.join(tmp, 'otro.html');
  fs.writeFileSync(otro, '<html>un texto que nadie verifico</html>', 'utf8');

  const rc = preflight.main(args(['--texto', otro]));
  assert.equal(rc, 4, 'el servicio firmaria un texto que nadie ha verificado');
});

// ===========================================================================
// 3. LA CONTRAFIRMA
// ===========================================================================

test('sin contrafirma aborta con codigo 5', async () => {
  await sembrarFlujo({ contrafirmar: false });
  const rc = preflight.main(args());
  assert.equal(rc, 5, 'el Anexo es bilateral: sin contrafirma no hay ejecucion');
});

test('una Empresa INACTIVA no cuenta como empresa con el Anexo ejecutado', async () => {
  await sembrarFlujo({ contrafirmar: true });
  db.prepare('UPDATE gh_firma_empresas SET activo = 0 WHERE id_empresa = ?').run(ID_EMPRESA);

  const rc = preflight.main(args());
  assert.equal(rc, 5, 'una empresa dada de baja no puede sostener el manifiesto');
});

test('contrafirmada pero sin fecha de ejecucion en la ficha aborta con codigo 5', async () => {
  await sembrarFlujo({ contrafirmar: true });
  db.prepare('UPDATE gh_firma_empresas SET anexo_encargo_firmado_at = NULL').run();

  const rc = preflight.main(args());
  assert.equal(rc, 5, 'las dos escrituras van en una sola transaccion');
});

// ===========================================================================
// 4. LAS ACTAS
// ===========================================================================

test('un acta que no esta en el servidor aborta con codigo 6', async () => {
  const { idSuscripcion } = await sembrarFlujo({ contrafirmar: true });
  const actas = actasDe(idSuscripcion);
  const ruta = path.join(storage.PATHS.actas, actas.contrafirma);
  const bytes = fs.readFileSync(ruta);
  try {
    fs.unlinkSync(ruta);
    const rc = preflight.main(args());
    assert.equal(rc, 6, 'un acta que no esta no es un acta');
  } finally {
    fs.writeFileSync(ruta, bytes);
  }
});

test('un acta cuya huella NO coincide aborta con codigo 6', async () => {
  const { idSuscripcion } = await sembrarFlujo({ contrafirmar: true });
  const actas = actasDe(idSuscripcion);
  const ruta = path.join(storage.PATHS.actas, actas.suscripcion);
  const bytes = fs.readFileSync(ruta);
  try {
    fs.writeFileSync(ruta, Buffer.from('otro contenido, otra acta'));
    const rc = preflight.main(args());
    assert.equal(rc, 6, 'un acta cuya huella no cuadra no es un acta');
  } finally {
    fs.writeFileSync(ruta, bytes);
  }
});

// ===========================================================================
// 5. EL RESPALDO
// ===========================================================================

test('el respaldo real se lleva la carpeta ENTERA de storage', async () => {
  await sembrarFlujo({ contrafirmar: true });
  const rc = preflight.main(args(['--json']));
  assert.equal(rc, 0);
  const salida = JSON.parse(lineasSalida[lineasSalida.length - 1]);
  assert.equal(salida.respaldo.lleva_storage_entero, true);
});

test('el preflight mira el script de respaldo que CORRE, y dice cuál', async () => {
  await sembrarFlujo({ contrafirmar: true });
  const rc = preflight.main(args(['--json']));
  assert.equal(rc, 0);
  const salida = JSON.parse(lineasSalida[lineasSalida.length - 1]);

  // En el repo el script vive en firma-service/deploy/. En el SERVIDOR el que
  // corre el cron es /opt/kair-firma/backup-firma.sh, un nivel ARRIBA del
  // service. El preflight tiene que encontrar el que exista y decir cual es:
  // si mirara una ruta que no esta en el servidor, abortaria con codigo 8
  // (ABORTA) por un archivo que si esta.
  assert.ok(salida.respaldo.script, 'dice que script miro');
  assert.ok(fs.existsSync(salida.respaldo.script), 'ese script existe de verdad');
  assert.ok(salida.respaldo.buscados.length >= 2, 'probo mas de una ruta');
  assert.equal(salida.respaldo.existe, true);
});

test('un servidor donde el script no esta en ninguna de las rutas aborta con 8', async () => {
  await sembrarFlujo({ contrafirmar: true });
  const rc = preflight.main(args([
    '--json',
    '--backup', path.join(tmp, 'no-existe.sh'),
  ]));
  assert.equal(rc, 8);
});

test('un respaldo que se lleva solo una subcarpeta aborta con codigo 8', async () => {
  await sembrarFlujo({ contrafirmar: true });
  const backup = path.join(tmp, 'backup-firma.sh');
  fs.writeFileSync(backup, 'tar -C "$BASE" -czf "$PDFS_PLAIN" storage/originales\n', 'utf8');

  const rc = preflight.main(args(['--backup', backup]));
  assert.equal(rc, 8, 'la carpeta de las actas se quedaria fuera del respaldo');
});

test('un respaldo que no existe aborta con codigo 8', async () => {
  await sembrarFlujo({ contrafirmar: true });
  const rc = preflight.main(args(['--backup', path.join(tmp, 'no-existe.sh')]));
  assert.equal(rc, 8);
});

// ===========================================================================
// 5.b EL RESPALDO QUE EXISTE PERO NO SE PUEDE LEER
// ===========================================================================
//
// En el servidor, /opt/kair-firma/backup-firma.sh es root:root 750. Si el
// preflight se corre como kairfirma, el archivo EXISTE pero no se puede leer:
// antes eso reventaba el script entero con un EACCES crudo de Node.
//
// Para reproducirlo sin depender de los permisos de Windows se usa un
// DIRECTORIO: existe (o sea que el preflight lo elige), y readFileSync sobre
// un directorio falla igual que un EACCES: la ruta esta ahi y no se puede
// leer como archivo.

test('un script de respaldo que existe pero no se puede leer NO revienta el preflight', async () => {
  await sembrarFlujo({ contrafirmar: true });
  const ilegible = path.join(tmp, 'backup-ilegible');
  fs.mkdirSync(ilegible);

  const rc = preflight.main(args(['--json', '--backup', ilegible]));
  assert.equal(rc, 3, 'no se pudo leer: es un error de lectura, no un respaldo roto');

  const salida = JSON.parse(lineasSalida[lineasSalida.length - 1]);
  assert.ok(salida.motivo && salida.motivo.includes('no se pudo leer'),
    'el motivo lo dice el preflight y no un error crudo de Node: ' + salida.motivo);
  assert.equal(salida.respaldo.leible, false, 'y marca el respaldo como no leible');
});

test('el respaldo ilegible NO se reporta como un respaldo que no lleva storage entero', async () => {
  await sembrarFlujo({ contrafirmar: true });
  const ilegible = path.join(tmp, 'backup-ilegible');
  fs.mkdirSync(ilegible);

  const rc = preflight.main(args(['--json', '--backup', ilegible]));
  assert.equal(rc, 3);
  assert.notEqual(rc, 8, 'el 8 dice "el respaldo esta roto", y no se puede saber eso');

  const salida = JSON.parse(lineasSalida[lineasSalida.length - 1]);
  assert.equal(salida.respaldo.existe, true, 'el script existe');
  assert.equal(salida.respaldo.leible, false, 'pero no se pudo leer');
  assert.ok(salida.respaldo.error_lectura, 'dice por que');
  assert.match(salida.respaldo.error_lectura, /root/, 'dice como se arregla: correr como root');
  assert.equal(salida.respaldo.problema, null, 'NO dice que el respaldo este roto');
});

test('el reporte NO miente sobre las huellas cuando el respaldo no se puede leer', async () => {
  await sembrarFlujo({ contrafirmar: true });
  const ilegible = path.join(tmp, 'backup-ilegible');
  fs.mkdirSync(ilegible);

  const rc = preflight.main(args(['--json', '--backup', ilegible]));
  assert.equal(rc, 3);

  const salida = JSON.parse(lineasSalida[lineasSalida.length - 1]);
  // Las dos huellas SI coinciden: el texto del servidor es el del manifiesto.
  // El reporte tiene que decirlo aunque el preflight aborte por otra cosa:
  // antes se calculaba la coincidencia DESPUES del bloque try/catch, asi que
  // un abort imprimia "coinciden: false" con las huellas iguales.
  assert.ok(salida.texto.hash, 'hay huella del archivo');
  assert.equal(salida.texto.hash_manifiesto, salida.texto.hash, 'y es la del manifiesto');
  assert.equal(salida.texto.coincide, true, 'el reporte no dice que no coinciden');
});

test('la salida de texto dice que no se pudo leer el respaldo', async () => {
  await sembrarFlujo({ contrafirmar: true });
  const ilegible = path.join(tmp, 'backup-ilegible');
  fs.mkdirSync(ilegible);

  const rc = preflight.main(args(['--backup', ilegible]));
  assert.equal(rc, 3);

  const texto = lineasSalida.join('\n');
  assert.match(texto, /NO SE PUDO LEER/, 'el reporte lo dice');
  assert.match(texto, /coinciden:\s+true/, 'y las huellas SI coinciden');
});

// ===========================================================================
// 5.c EL REPORTE NO MIENTE CUANDO ABORTA POR OTRA COSA
// ===========================================================================
//
// Este es el otro bug, y es independiente del anterior: la coincidencia de las
// huellas se calculaba DESPUES del bloque try/catch. Si cualquier comprobacion
// de adentro del try reventaba, el catch imprimia el reporte con
// "coinciden: false" con las DOS huellas iguales: el preflight decia que el
// texto del servidor no era el del manifiesto cuando si lo era.
//
// Aqui el error sale DENTRO del try, DESPUES de que el manifiesto ya se leyo:
// por eso la coincidencia tiene que estar calculada para ese momento.

test('el reporte NO miente sobre las huellas cuando una comprobacion revienta', async () => {
  const { idSuscripcion } = await sembrarFlujo({ contrafirmar: true });
  const actas = actasDe(idSuscripcion);
  const ruta = path.join(storage.PATHS.actas, actas.suscripcion);
  const bytes = fs.readFileSync(ruta);

  try {
    // Un acta que existe pero no se puede LEER (aqui, un directorio con el
    // nombre del acta): el error sale dentro del bloque try.
    fs.unlinkSync(ruta);
    fs.mkdirSync(ruta);

    const rc = preflight.main(args(['--json']));
    assert.notEqual(rc, 0, 'aborta: un acta que no se puede leer no es un acta');

    const salida = JSON.parse(lineasSalida[lineasSalida.length - 1]);
    assert.ok(salida.texto.hash, 'hay huella del archivo');
    assert.equal(salida.texto.hash_manifiesto, salida.texto.hash, 'y es la del manifiesto');
    assert.equal(salida.texto.coincide, true,
      'abortar por otra cosa no significa que el texto del servidor sea otro');
  } finally {
    fs.rmSync(ruta, { recursive: true, force: true });
    fs.writeFileSync(ruta, bytes);
  }
});

// ===========================================================================
// 6. EL MANIFIESTO
// ===========================================================================

test('--exigir-firmado con el manifiesto en "no_firmado" aborta con codigo 7', async () => {
  await sembrarFlujo({ contrafirmar: true });
  const rc = preflight.main(args(['--exigir-firmado']));
  assert.equal(rc, 7);
});

test('los dos scripts encadenan: el manifiesto escrito pasa el preflight', async () => {
  await sembrarFlujo({ contrafirmar: true });

  // Primero el manifiesto: "firmado" con fecha y evidencia.
  const escrito = manifiesto.main(args());
  assert.equal(escrito.estado, 'firmado');
  assert.equal(JSON.parse(fs.readFileSync(copia, 'utf8')).anexo_encargo.estado, 'firmado');

  // Despues el preflight, que ahora tiene que pasar.
  const rc = preflight.main(args(['--exigir-firmado']));
  assert.equal(rc, 0, 'el preflight paso: ' + lineasSalida.join(' | '));
});

// ===========================================================================
// 7. LOS ARGUMENTOS
// ===========================================================================

test('un argumento desconocido se rechaza con codigo 2', () => {
  assert.equal(preflight.main(['--inventado']), 2);
});

test('una opcion de ruta sin valor se rechaza con codigo 2', () => {
  assert.equal(preflight.main(['--manifiesto']), 2);
  assert.equal(preflight.main(['--texto']), 2);
  assert.equal(preflight.main(['--backup']), 2);
});

test('el respaldo real del repo es el que el preflight mira', () => {
  assert.ok(fs.existsSync(BACKUP_REAL), 'deploy/backup-firma.sh existe');
  const texto = fs.readFileSync(BACKUP_REAL, 'utf8');
  assert.match(texto, /tar -C "\$BASE" -czf "\$PDFS_PLAIN" storage/,
    'el respaldo empaqueta storage entero: la carpeta de las actas entra');
});
