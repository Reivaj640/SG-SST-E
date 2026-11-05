/**
 * LA SUSCRIPCIÓN DEL ANEXO DE NUBE POR LA EMPRESA
 * ============================================================================
 *
 * Lo que se verifica acá:
 *
 * - El texto que se suscribe es el del ARCHIVO, con su huella real: el
 *   operador no puede declarar una huella y suspender un texto que no es el
 *   publicado.
 * - El enlace es de un solo uso, con caducidad, y en la base solo vive su
 *   huella.
 * - El código de verificación sale por la cuenta de K+AIR (nunca por la de la
 *   Empresa) y se valida con el ámbito de la Empresa.
 * - Sin el código correcto, o sin la aceptación expresa, NO se firma.
 * - Al firmar queda: versión, huella, evidencia (fecha, correo, IP,
 *   navegador) y el rastro append-only de lo que pasó.
 * - El enlace no se puede reutilizar y el rastro no se puede alterar.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const db = require('../src/db/connection');
const anexoNube = require('../src/services/anexoNube');
const empresaService = require('../src/services/empresa');
const mailer = require('../src/services/mailer');
const { resetDb } = require('./helpers');

const ID_EMPRESA = '900555777';
const CORREO_FIRMANTE = 'representante@empresa-prueba.test';

// ===========================================================================
// HELPERS
// ===========================================================================

function sembrarEmpresa(id = ID_EMPRESA) {
  db.prepare(`
    INSERT INTO gh_firma_empresas
      (id_empresa, razon_social, nit, canal_pqrs, activo)
    VALUES (?, ?, ?, ?, 1)
  `).run(id, 'EMPRESA DE PRUEBA SAS', id, 'pqrs@empresa-prueba.test');
  return id;
}

/** El último correo de la bandeja de pruebas del tipo pedido. */
function ultimoCorreo(tipo) {
  const inbox = mailer.getDevInbox();
  for (let i = inbox.length - 1; i >= 0; i--) {
    if (inbox[i].tipo === tipo || (tipo === 'anexo_nube' && inbox[i].tipo === 'signature')) {
      return inbox[i];
    }
  }
  return null;
}

/** El código de verificación que salió en el último correo de código. */
function ultimoCodigo() {
  const c = ultimoCorreo('anexo_nube');
  assert.ok(c, 'tiene que haber salido un correo con el código de verificación');
  assert.match(c.otp, /^\d{6}$/);
  return c.otp;
}

// ===========================================================================
// EL TEXTO Y SU HUELLA
// ===========================================================================

test('el modelo vigente es la v1.1 y su huella es la de los bytes del archivo', () => {
  resetDb();
  const m = anexoNube.modeloVigente();
  assert.equal(m.version, '1.1');
  const bytes = fs.readFileSync(anexoNube.RUTA_MODELO);
  const esperado = crypto.createHash('sha256').update(bytes).digest('hex');
  assert.equal(m.hash, esperado,
    'la huella tiene que ser la del archivo, no una declarada a mano');
  assert.equal(m.bytes, bytes.length);
});

/**
 * El texto del Anexo sin las entidades HTML.
 *
 * El archivo legal usa entidades (&aacute;, &iacute;, ...): sin
 * convertirlas, una comprobación sobre una palabra acentuada NUNCA
 * encuentra nada y el test pasa por la razón equivocada.
 */
function sinEntidades(html) {
  return String(html)
    .replace(/&aacute;/g, 'á')
    .replace(/&eacute;/g, 'é')
    .replace(/&iacute;/g, 'í')
    .replace(/&oacute;/g, 'ó')
    .replace(/&uacute;/g, 'ú')
    .replace(/&ntilde;/g, 'ñ')
    .replace(/&Ntilde;/g, 'Ñ')
    .replace(/&mdash;/g, '—')
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/&sect;/g, '§');
}

test('la v1.1 ya no se prohíbe a sí misma: no dice que no se firma hasta completar pendientes', () => {
  const plano = sinEntidades(fs.readFileSync(anexoNube.RUTA_MODELO, 'utf8'));
  assert.ok(!/no se firma hasta/i.test(plano),
    'la v1.1 no puede decir que no se firma hasta completar los pendientes');
  assert.ok(!/LO QUE TODAVÍA FALTA ANTES DE FIRMAR/i.test(plano),
    'la v1.1 no puede conservar el bloque que impedía firmar');
  assert.ok(/ESTADO DECLARADO DEL SERVICIO Y LIMITACIONES CONOCIDAS/i.test(plano),
    'la v1.1 declara el estado del servicio');
  assert.ok(/todavía no están implementados/i.test(plano),
    'la v1.1 declara los controles que no están implementados');
  assert.ok(/Cifrado en reposo del disco: verificado el 31-oct-2026 y NO implementado/i.test(plano),
    'la v1.1 no puede suavizar el cifrado en reposo, que no está implementado');
});

// ===========================================================================
// ABRIR LA SUSCRIPCIÓN
// ===========================================================================

test('crearSuscripcion abre la suscripción, manda el enlace y devuelve la huella', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const r = await anexoNube.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
    nombre_firmante: 'PERSONA DE PRUEBA',
    cargo_firmante: 'Representante legal',
  }, { actor: 'admin', ip: '10.0.0.1', user_agent: 'test' });

  assert.match(r.url, /\/anexo-nube\/[A-Za-z0-9_-]+$/,
    'el enlace tiene que llevar el token');
  assert.equal(r.version, '1.1');
  assert.equal(r.hash, anexoNube.modeloVigente().hash);

  // El correo de invitación SALE, y lo manda K+AIR.
  const correo = ultimoCorreo('anexo_nube_invitacion');
  assert.ok(correo, 'tiene que haber salido la invitación');
  assert.equal(correo.to, CORREO_FIRMANTE);
  assert.ok(correo.body.includes(r.token),
    'el correo tiene que llevar el enlace con el token');
  assert.ok(correo.body.includes(r.hash),
    'el correo tiene que declarar la huella del texto que se suscribe');
  assert.ok(!correo.body.includes(r.hash.toUpperCase()) || correo.body.includes(r.hash),
    'la huella se declara tal cual');
});

test('la base NO guarda el enlace en claro: solo su huella', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const r = await anexoNube.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
  }, { actor: 'admin' });

  const fila = db.prepare('SELECT * FROM gh_firma_anexo_nube_suscripciones').get();
  assert.ok(fila);
  assert.notEqual(fila.token_hash, r.token,
    'el token en claro no puede estar en la base');
  assert.match(fila.token_hash, /^[0-9a-f]{64}$/i,
    'lo que se guarda es una huella');
  assert.ok(!JSON.stringify(fila).includes(r.token),
    'el token no puede aparecer en ninguna columna de la fila');
});

test('un enlace que no existe se rechaza con ENLACE_NO_VALIDO', () => {
  resetDb();
  assert.throws(
    () => anexoNube.contextoPublico('este-token-no-existe', '1.1.1.1', 'test'),
    (e) => e.statusCode === 404 && e.code === 'ENLACE_NO_VALIDO',
  );
});

test('el contexto público enmascara el correo y no expone el enlace', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const r = await anexoNube.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
  }, { actor: 'admin' });

  const ctx = anexoNube.contextoPublico(r.token, '1.1.1.1', 'navegador');
  assert.equal(ctx.empresa, 'EMPRESA DE PRUEBA SAS');
  assert.equal(ctx.version, '1.1');
  assert.ok(ctx.correo_firmante.includes('***'),
    'el correo va enmascarado');
  assert.ok(!ctx.correo_firmante.includes('representante'),
    'el correo no puede salir entero');
  assert.equal(ctx.token, undefined);
  assert.equal(ctx.token_hash, undefined);
  assert.equal(ctx.otp_hash, undefined);
  assert.equal(ctx.vigente, true,
    'el texto de la fila es el que está en el servidor: la suscripción sirve');
});

// ===========================================================================
// EL CÓDIGO DE VERIFICACIÓN
// ===========================================================================

test('el código se manda al correo del firmante y sale por K+AIR', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const r = await anexoNube.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
  }, { actor: 'admin' });

  const res = await anexoNube.solicitarCodigo(r.token, { ip: '1.1.1.1', user_agent: 'navegador' });
  assert.ok(res.expira_en_segundos > 0);

  const correo = ultimoCorreo('anexo_nube');
  assert.ok(correo, 'tiene que haber salido el correo con el código');
  assert.equal(correo.to, CORREO_FIRMANTE);
  assert.match(correo.subject, /Anexo de Nube/);
  // El remitente es la cuenta de K+AIR, NO la de la Empresa.
  assert.equal(correo.remitente.origen, 'kair',
    'el correo del código lo manda K+AIR');
  assert.ok(correo.remitente.from_email.includes('@'),
    'el remitente tiene que ser una dirección de correo');
});

test('sin código no se puede suscribir', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const r = await anexoNube.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
  }, { actor: 'admin' });

  assert.throws(
    () => anexoNube.suscribir(r.token, { otp: '123456', acepta: true }, {}),
    (e) => e.statusCode === 400 && e.code === 'CODIGO_NO_SOLICITADO',
  );
  assert.equal(empresaService.getById(ID_EMPRESA).anexo_nube_firmado_at, null);
});

test('un código incorrecto no firma y deja intento registrado', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const r = await anexoNube.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
  }, { actor: 'admin' });
  await anexoNube.solicitarCodigo(r.token, {});

  const codigo = ultimoCodigo();
  const malo = codigo === '000000' ? '111111' : '000000';

  assert.throws(
    () => anexoNube.suscribir(r.token, { otp: malo, acepta: true }, {}),
    (e) => e.statusCode === 400 && e.code === 'CODIGO_INVALIDO',
  );
  assert.equal(empresaService.getById(ID_EMPRESA).anexo_nube_firmado_at, null,
    'un código incorrecto no puede dejar la suscripción a medias');

  const fila = db.prepare('SELECT * FROM gh_firma_anexo_nube_suscripciones').get();
  assert.equal(fila.otp_intentos, 1);
  assert.notEqual(fila.estado, 'FIRMADA');
});

test('sin la aceptación expresa tampoco se firma', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const r = await anexoNube.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
  }, { actor: 'admin' });
  await anexoNube.solicitarCodigo(r.token, {});

  assert.throws(
    () => anexoNube.suscribir(r.token, { otp: ultimoCodigo(), acepta: false }, {}),
    (e) => e.statusCode === 400 && e.code === 'ACEPTACION_REQUERIDA',
  );
  assert.equal(empresaService.getById(ID_EMPRESA).anexo_nube_firmado_at, null);
});

// ===========================================================================
// LA FIRMA
// ===========================================================================

test('con el código correcto la Empresa suscribe y queda registrado con versión, huella y evidencia', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const r = await anexoNube.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
    nombre_firmante: 'PERSONA DE PRUEBA',
  }, { actor: 'admin' });
  await anexoNube.solicitarCodigo(r.token, {});

  const res = anexoNube.suscribir(
    r.token,
    { otp: ultimoCodigo(), acepta: true },
    { ip: '203.0.113.9', user_agent: 'Navegador/1.0' },
  );

  assert.equal(res.firmado, true);
  assert.equal(res.version, '1.1');
  assert.equal(res.hash, anexoNube.modeloVigente().hash);

  const empresa = empresaService.getById(ID_EMPRESA);
  assert.ok(empresa.anexo_nube_firmado_at, 'la fecha de suscripción tiene que quedar');
  assert.equal(empresa.anexo_nube_version, '1.1');
  assert.equal(empresa.anexo_nube_hash, anexoNube.modeloVigente().hash);

  const evidencia = JSON.parse(empresa.anexo_nube_evidencia);
  assert.equal(evidencia.fuente, 'enlace_suscripcion');
  assert.equal(evidencia.version, '1.1');
  assert.equal(evidencia.hash, anexoNube.modeloVigente().hash);
  assert.equal(evidencia.correo_firmante, CORREO_FIRMANTE);
  assert.equal(evidencia.ip, '203.0.113.9');
  assert.equal(evidencia.user_agent, 'Navegador/1.0');
  assert.ok(evidencia.codigo_enviado_at);
  assert.ok(evidencia.codigo_verificado_at);
});

test('el enlace es de un solo uso: firmado, no se pide otro código', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const r = await anexoNube.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
  }, { actor: 'admin' });
  await anexoNube.solicitarCodigo(r.token, {});
  anexoNube.suscribir(r.token, { otp: ultimoCodigo(), acepta: true }, {});

  await assert.rejects(
    () => anexoNube.solicitarCodigo(r.token, {}),
    (e) => e.code === 'YA_SUSCRITO',
  );

  // Reintento de quien ya firmó: no vuelve a registrar nada.
  const otra = anexoNube.suscribir(r.token, { otp: '000000', acepta: true }, {});
  assert.equal(otra.ya_firmada, true);
});

test('el rastro de la suscripción queda escrito y en orden', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const r = await anexoNube.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
  }, { actor: 'admin' });
  await anexoNube.solicitarCodigo(r.token, {});
  anexoNube.suscribir(r.token, { otp: ultimoCodigo(), acepta: true },
    { ip: '203.0.113.9', user_agent: 'Navegador/1.0' });

  const eventos = db.prepare(
    'SELECT evento FROM gh_firma_anexo_nube_eventos WHERE id_empresa = ? ORDER BY id',
  ).all(ID_EMPRESA).map((r2) => r2.evento);

  assert.ok(eventos.includes('SUSCRIPCION_CREADA'));
  assert.ok(eventos.includes('CODIGO_ENVIADO'));
  assert.ok(eventos.includes('SUSCRIPCION_FIRMADA'));
  assert.ok(eventos.indexOf('SUSCRIPCION_CREADA') < eventos.indexOf('CODIGO_ENVIADO'));
  assert.ok(eventos.indexOf('CODIGO_ENVIADO') < eventos.indexOf('SUSCRIPCION_FIRMADA'));
});

test('el rastro de la suscripción es append-only: el trigger muerde de verdad', () => {
  resetDb();
  const ruta = path.join(__dirname, '..', 'src', 'db', 'schema', '055_anexo_nube_eventos_append_only.sql');
  const sql = fs.readFileSync(ruta, 'utf8');
  const D = require('better-sqlite3');
  const memoria = new D(':memory:');
  memoria.exec(`CREATE TABLE gh_firma_anexo_nube_eventos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_suscripcion INTEGER, id_empresa TEXT, evento TEXT, detalle TEXT,
    ip TEXT, user_agent TEXT, fecha_hora TEXT DEFAULT (datetime('now')));`);
  memoria.exec(sql);
  memoria.prepare(`INSERT INTO gh_firma_anexo_nube_eventos
    (id_suscripcion, id_empresa, evento) VALUES (1, 'X', 'PRUEBA')`).run();

  assert.throws(() => memoria.prepare(
    'UPDATE gh_firma_anexo_nube_eventos SET evento = ? WHERE id = 1').run('OTRA'),
  /append-only/);
  assert.throws(() => memoria.prepare(
    'DELETE FROM gh_firma_anexo_nube_eventos WHERE id = 1').run(),
  /append-only/);
  memoria.close();
});

test('no se puede suspender un texto distinto del que está en el archivo', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const r = await anexoNube.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
  }, { actor: 'admin' });
  await anexoNube.solicitarCodigo(r.token, {});

  // Se falsea la huella en la fila: la suscripción tiene que fallar.
  // OJO: no se usa `WHERE id = 1` porque el contador de la tabla no se
  // reinicia entre tests; se toma la fila de esa Empresa.
  db.prepare(`UPDATE gh_firma_anexo_nube_suscripciones
    SET hash_texto = ?
    WHERE id_empresa = ? AND estado != 'FIRMADA'`)
    .run('a'.repeat(64), ID_EMPRESA);

  assert.throws(
    () => anexoNube.suscribir(r.token, { otp: ultimoCodigo(), acepta: true }, {}),
    (e) => e.statusCode === 409 && e.code === 'TEXTO_MODIFICADO',
    'no se puede suspender un texto que no es el del archivo',
  );
  assert.equal(empresaService.getById(ID_EMPRESA).anexo_nube_firmado_at, null);
});

test('si el texto cambia después de abrir la suscripción, no se firma', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const r = await anexoNube.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
  }, { actor: 'admin' });
  await anexoNube.solicitarCodigo(r.token, {});

  // El texto del servidor cambia. Se usa una COPIA temporal con un byte
  // distinto, para no tocar el archivo legal del repo.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'anexo-nube-'));
  const copia = path.join(dir, 'anexo-nube-v1.1.html');
  fs.writeFileSync(copia,
    fs.readFileSync(anexoNube.RUTA_MODELO).toString('utf8') + '\n<!-- cambio -->');

  try {
    assert.throws(
      () => anexoNube.suscribir(r.token, { otp: ultimoCodigo(), acepta: true }, {},
        { rutaModelo: copia }),
      (e) => e.statusCode === 409 && e.code === 'TEXTO_MODIFICADO',
      'la Empresa no puede firmar un texto que ya no es el que se le mostró',
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }

  assert.equal(empresaService.getById(ID_EMPRESA).anexo_nube_firmado_at, null,
    'un texto que cambió no puede dejar la suscripción a medias');

  const eventos = db.prepare(
    'SELECT evento FROM gh_firma_anexo_nube_eventos WHERE id_empresa = ? ORDER BY id',
  ).all(ID_EMPRESA).map((x) => x.evento);
  assert.ok(eventos.includes('TEXTO_MODIFICADO'),
    'el cambio de texto queda en el rastro');
});

test('si el texto ya cambió, no se manda un código: no hay nada que firmar', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const r = await anexoNube.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
  }, { actor: 'admin' });

  // Se falsea la huella: el texto del servidor ya no es el de la suscripción.
  db.prepare(`UPDATE gh_firma_anexo_nube_suscripciones
    SET hash_texto = ? WHERE id_empresa = ? AND estado != 'FIRMADA'`)
    .run('a'.repeat(64), ID_EMPRESA);

  await assert.rejects(
    () => anexoNube.solicitarCodigo(r.token, {}),
    (e) => e.statusCode === 409 && e.code === 'TEXTO_MODIFICADO',
    'no se pide un código para una suscripción cuyo texto ya no existe',
  );
  assert.equal(ultimoCorreo('anexo_nube'), null,
    'no se mandó ningún código');
});

test('si el correo del código no sale, se dice con claridad y queda en el rastro', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const r = await anexoNube.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
  }, { actor: 'admin' });

  // Se simula que el SMTP no responde.
  const original = mailer.sendOTP;
  mailer.sendOTP = async () => { throw new Error('SMTP no responde'); };
  try {
    await assert.rejects(
      () => anexoNube.solicitarCodigo(r.token, {}),
      (e) => e.statusCode === 502 && e.code === 'ENVIO_FALLIDO',
      'un fallo de correo tiene que ser un error entendible, no un 500',
    );
  } finally {
    mailer.sendOTP = original;
  }

  const eventos = db.prepare(
    'SELECT evento FROM gh_firma_anexo_nube_eventos WHERE id_empresa = ? ORDER BY id',
  ).all(ID_EMPRESA).map((x) => x.evento);
  assert.ok(eventos.includes('ENVIO_FALLIDO'),
    'el fallo de envío queda en el rastro');
});

test('anular una suscripción exige el motivo, deja el rastro y mata el enlace', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const r = await anexoNube.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
  }, { actor: 'admin' });
  const fila = db.prepare(
    'SELECT id FROM gh_firma_anexo_nube_suscripciones WHERE id_empresa = ?',
  ).get(ID_EMPRESA);

  // Sin motivo, no se anula: una baja tiene que decir por qué.
  assert.throws(
    () => anexoNube.anularSuscripcion(ID_EMPRESA, fila.id, { actor: 'admin' }),
    (e) => e.statusCode === 400 && e.code === 'MOTIVO_REQUERIDO',
  );

  const res = anexoNube.anularSuscripcion(ID_EMPRESA, fila.id, {
    actor: 'admin', motivo: 'Se mandó al correo equivocado',
  });
  assert.equal(res.anulada, true);

  // Y el enlace queda muerto.
  assert.throws(
    () => anexoNube.contextoPublico(r.token, '1.1.1.1', 'test'),
    (e) => e.statusCode === 410 && e.code === 'ENLACE_ANULADO',
  );

  const eventos = db.prepare(
    'SELECT evento, detalle FROM gh_firma_anexo_nube_eventos WHERE id_empresa = ? ORDER BY id',
  ).all(ID_EMPRESA);
  const anul = eventos.find((e) => e.evento === 'SUSCRIPCION_ANULADA');
  assert.ok(anul, 'la anulación queda en el rastro');
  assert.ok(anul.detalle.includes('correo equivocado'),
    'el rastro dice por qué se anuló');
});
