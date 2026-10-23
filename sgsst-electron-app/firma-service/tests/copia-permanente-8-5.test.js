/**
 * 8.5 · LA COPIA PERMANENTE, Y EL 8.6(e)(iii)/8.6(f) QUE FRENAN LA SUPRESIÓN
 * =========================================================================
 *
 * EL TEXTO QUE ESTOS TESTS FIJAN (respuesta 11A del 2026-10-23)
 * ---------------------------------------------------------------
 * 8.5: "El Trabajador puede solicitar en cualquier momento una copia
 * permanente del contrato firmado, sus anexos, modificaciones y la Constancia.
 * La Empresa la entrega por el medio autorizado, sin costo, dentro de los
 * cinco (5) días hábiles siguientes. La copia se conserva aunque el enlace haya
 * expirado; la descarga desde el enlace es una cortesía y no sustituye este
 * derecho."
 *
 * 8.6(e): "La supresión procede solo cuando concurren: (i) vencimiento del
 * plazo aplicable; (ii) ausencia de deber legal o contractual de conservación;
 * (iii) ausencia de solicitud de copia pendiente; y (iv) ausencia de hold
 * vigente."
 *
 * 8.6(f): "La solicitud se registra y se atiende antes de cualquier supresión."
 *
 * LO QUE SE COMPRUEBA
 * -------------------
 *  1. El tipo COPIA existe en la taxonomía y el canal público lo acepta.
 *  2. Al registrar una COPIA queda CONSTANTE el plazo de entrega (cinco días
 *     hábiles), y no se confunde con el plazo de TRASMISIÓN de K+AIR (dos).
 *  3. El plazo corre en días hábiles, no en días de calendario.
 *  4. El plazo es consultable: en la respuesta al Titular y en el endpoint de
 *     administración de solicitudes.
 *  5. Una COPIA no se cierra por "vínculo expirado": sin la declaración de
 *     que fue atendida, sigue PENDIENTE.
 *  6. Con una COPIA pendiente, la conservación NO la da por elegible y el
 *     lote no la recoge.
 *  7. Con una COPIA pendiente, la supresión NO borra nada (aunque el lote ya
 *     estuviera armado antes de que la copia llegara).
 *  8. Una COPIA ATENDIDA desbloquea la supresión.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const db = require('../src/db/connection');
const config = require('../src/config');
const solicitudes = require('../src/services/solicitudes');
const conservacion = require('../src/services/conservacion');
const supresion = require('../src/services/supresion');
const {
  resetDb, makeApp, createSignRequestWithIdentificacion, TEST_ADMIN_API_KEY,
} = require('./helpers');

const ADMIN = { 'X-Admin-API-Key': TEST_ADMIN_API_KEY };
const EMPRESA = '900123456';
const HORA = 3600 * 1000;

// ===========================================================================
// FIXTURES
// ===========================================================================

/**
 * Una firma ya vencida (plazo de conservación cumplido) y sin hold: es la que
 * la supresión trataría de borrar.
 */
async function setupVencida() {
  const { signRequest } = await createSignRequestWithIdentificacion({
    id_trabajador: '1234567890',
    id_empresa: EMPRESA,
    identificacion_numero: '1234567890',
  });

  const ahora = Date.now();
  db.prepare(`
    UPDATE gh_firmas_electronicas
       SET estado = 'SIGNED',
           fecha_firma = ?,
           fecha_conservacion = ?,
           fecha_expiracion = ?,
           hold_legal = 0,
           motivo_hold = NULL
     WHERE id = ?
  `).run(
    new Date(ahora).toISOString(),
    new Date(ahora - 24 * HORA).toISOString(), // vencida ayer
    new Date(ahora + 48 * HORA).toISOString(),
    signRequest.id
  );

  return signRequest;
}

/** La fila de la firma, tal como la ven los servicios de conservación. */
function firmaDe(id) {
  return db.prepare(
    'SELECT id, id_solicitud, id_empresa, estado, fecha_conservacion, hold_legal '
    + 'FROM gh_firmas_electronicas WHERE id = ?'
  ).get(id);
}

/**
 * Registra una solicitud de COPIA y la trasmite a la Empresa: así queda
 * PENDIENTE y atribuida a la empresa (que es como se puede cruzar).
 */
function registrarCopiaPendiente(id_empresa = EMPRESA) {
  const r = solicitudes.registrar({
    tipo: 'COPIA',
    correo: 'trabajador@example.com',
    documento: '1234567890',
    contenido: 'Pido una copia permanente de mi contrato firmado y la Constancia.',
  });
  solicitudes.trasmitir(r.id_solicitud, { actor: 'kair:operador', id_empresa });
  return r;
}

/** Abre la ventana y arma el lote: el gobierno que la supresión exige. */
function abrirYLotear(actor = 'test') {
  conservacion.abrirVentana({ actor, motivo: 'Vencimiento del plazo declarado', minutos: 15 });
  return conservacion.armarLote({ actor, motivo: 'Vencimiento del plazo declarado' });
}

// ===========================================================================
// 1. EL TIPO COPIA EXISTE
// ===========================================================================

test('8.5 · el tipo COPIA está en la taxonomía de solicitudes', () => {
  assert.ok(solicitudes.TIPOS.includes('COPIA'),
    'el derecho del 8.5 tiene que poder ejercerse por el canal: ' +
    JSON.stringify(solicitudes.TIPOS));
});

test('8.5 · el canal público acepta una solicitud de COPIA', async () => {
  resetDb();

  const res = await request(makeApp())
    .post('/api/solicitudes')
    .send({
      tipo: 'COPIA',
      correo: 'trabajador@example.com',
      documento: '1234567890',
      contenido: 'Pido una copia permanente de mi contrato firmado.',
    })
    .timeout({ response: 5000 });

  assert.equal(res.status, 201);
  assert.equal(res.body.estado, 'RECIBIDA');
  assert.ok(res.body.plazo_copia, 'la respuesta al Titular trae el plazo de entrega');
  assert.match(res.body.mensaje, /copia permanente/i,
    'el mensaje dice que es una copia permanente');
});

// ===========================================================================
// 2. EL PLAZO DE ENTREGA QUEDA CONSTANTE AL REGISTRAR
// ===========================================================================

test('8.5 · al registrar una COPIA queda Constante el plazo de entrega', () => {
  resetDb();

  const r = solicitudes.registrar({
    tipo: 'COPIA',
    correo: 'trabajador@example.com',
    documento: '1234567890',
  });

  const fila = db.prepare(
    'SELECT * FROM gh_solicitudes_titular WHERE id = ?'
  ).get(r.id_solicitud);

  assert.ok(fila.plazo_copia, 'la fila guarda el plazo de entrega');
  assert.equal(fila.plazo_copia, r.plazo_copia, 'y es el mismo que se le dijo al Titular');

  // El plazo es el de la política (5), calculado desde el registro.
  assert.equal(config.plazoCopiaDias, 5, 'el plazo vive en FIRMA_PLAZO_COPIA_DIAS');
  const esperado = solicitudes._sumarDiasHabiles(
    new Date(fila.fecha_registro), config.plazoCopiaDias
  ).toISOString();
  assert.equal(fila.plazo_copia, esperado, 'el plazo corre desde el registro');

  // El mensaje al Titular dice el MISMO día que el que se le guardó. El día
  // es el del calendario local: si el mensaje usara el día UTC, un registro
  // hecho de noche mostraría el día siguiente.
  const dicho = /hasta el (\d{4}-\d{2}-\d{2})/.exec(r.mensaje);
  assert.ok(dicho, 'el mensaje dice hasta qué fecha: ' + r.mensaje);
  const limite = new Date(fila.plazo_copia);
  const fechaDicha = new Date(dicho[1] + 'T00:00:00');
  assert.equal(fechaDicha.getFullYear(), limite.getFullYear());
  assert.equal(fechaDicha.getMonth(), limite.getMonth());
  assert.equal(fechaDicha.getDate(), limite.getDate(),
    'el día que se le dice al Titular es el día que se le guardó');
});

test('8.5 · el plazo de entrega NO es el plazo de trasmisión', () => {
  resetDb();

  const r = solicitudes.registrar({
    tipo: 'COPIA',
    correo: 'trabajador@example.com',
  });

  const fila = db.prepare(
    'SELECT * FROM gh_solicitudes_titular WHERE id = ?'
  ).get(r.id_solicitud);

  // Son dos relojes: el de K+AIR (trasmitir, 2 días hábiles) y el de la
  // Empresa (entregar la copia, 5 días hábiles).
  assert.equal(config.plazoTramiteDias, 2);
  assert.equal(config.plazoCopiaDias, 5);
  assert.notEqual(fila.plazo_copia, fila.plazo_tramite,
    'el plazo de entrega de la copia no es el de trasmisión');
});

test('8.5 · una solicitud que NO es de copia no tiene plazo de copia', () => {
  resetDb();

  const r = solicitudes.registrar({
    tipo: 'RECLAMO',
    correo: 'trabajador@example.com',
  });

  const fila = db.prepare(
    'SELECT * FROM gh_solicitudes_titular WHERE id = ?'
  ).get(r.id_solicitud);

  assert.equal(fila.plazo_copia, null,
    'el plazo del 8.5 no aplica a un reclamo');
  assert.equal(r.plazo_copia, null);
});

// ===========================================================================
// 3. EL PLAZO CORRE EN DÍAS HÁBILES
// ===========================================================================

test('8.5 · el plazo corre en DÍAS HÁBILES, no en días de calendario', () => {
  // Viernes 2026-10-16 + 5 hábiles = viernes 2026-10-23 (pasa el fin de
  // semana: lunes 19, martes 20, miércoles 21, jueves 22, viernes 23).
  // En días de calendario serían 5 días después: miércoles 2026-10-21.
  const viernes = new Date('2026-10-16T12:00:00.000Z');
  const limite = solicitudes._sumarDiasHabiles(viernes, config.plazoCopiaDias);

  assert.equal(limite.toISOString().slice(0, 10), '2026-10-23',
    'el plazo cae el viernes siguiente');
  assert.equal(limite.getUTCDay(), 5, 'y es viernes');

  const deCalendario = new Date(viernes.getTime() + 5 * 24 * 3600 * 1000);
  assert.equal(deCalendario.toISOString().slice(0, 10), '2026-10-21',
    'en calendario sería el miércoles');
  assert.notEqual(limite.toISOString(), deCalendario.toISOString(),
    'el plazo NO es de calendario');
});

// ===========================================================================
// 4. EL PLAZO ES CONSULTABLE
// ===========================================================================

test('8.5 · el endpoint de admin devuelve el plazo de la copia', async () => {
  resetDb();
  const r = registrarCopiaPendiente();

  const listado = await request(makeApp())
    .get('/internal/admin/solicitudes')
    .set(ADMIN)
    .timeout({ response: 5000 });

  assert.equal(listado.status, 200);
  const item = listado.body.items.find((i) => i.id === r.id_solicitud);
  assert.ok(item, 'la solicitud está en el listado');
  assert.equal(item.plazo_copia, r.plazo_copia, 'el listado trae el plazo');
  assert.equal(item.copia.plazo_dias_habiles, 5, 'y dice de cuántos días hábiles es');
  assert.equal(item.copia.pendiente, true, 'y que sigue pendiente');

  const detalle = await request(makeApp())
    .get(`/internal/admin/solicitudes/${r.id_solicitud}`)
    .set(ADMIN)
    .timeout({ response: 5000 });

  assert.equal(detalle.status, 200);
  assert.equal(detalle.body.copia.plazo_copia, r.plazo_copia,
    'el detalle trae el plazo');
  assert.equal(detalle.body.copia.pendiente, true);
});

// ===========================================================================
// 5. UNA COPIA NO SE CIERRA POR "VÍNCULO EXPIRADO" (el 8.5)
// ===========================================================================

test('8.5 · una COPIA no se cierra por "vínculo expirado": sin atender sigue pendiente', async () => {
  resetDb();
  const r = registrarCopiaPendiente();

  const res = await request(makeApp())
    .post(`/internal/admin/solicitudes/${r.id_solicitud}/responder`)
    .set(ADMIN)
    .send({
      actor: 'empresa:rrhh',
      respuesta: 'El enlace de la firma ya expiró, no podemos entregar la copia.',
    })
    .timeout({ response: 5000 });

  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'COPIA_NO_ATENDIDA');

  const fila = db.prepare(
    'SELECT estado FROM gh_solicitudes_titular WHERE id = ?'
  ).get(r.id_solicitud);
  assert.equal(fila.estado, 'TRASMITIDA', 'la solicitud sigue pendiente');
  assert.equal(solicitudes.tieneCopiaPendiente(EMPRESA), true,
    'y pendiente significa que la supresión no procede');
});

// ===========================================================================
// 6. LA CONSERVACIÓN: LA COPIA PENDIENTE BLOQUEA (el 8.6(e)(iii))
// ===========================================================================

test('8.6(e)(iii) · con una COPIA pendiente la firma vencida NO es elegible', async () => {
  resetDb();
  const signRequest = await setupVencida();

  // Sin copia pendiente, la firma vencida es elegible.
  assert.equal(conservacion.esElegible(firmaDe(signRequest.id)), true);

  registrarCopiaPendiente();

  // Con copia pendiente, deja de serlo: la cuarta condición del 8.6(e).
  assert.equal(conservacion.esElegible(firmaDe(signRequest.id)), false);
});

test('8.6(e)(iii) · el reporte de vencimientos separa las frenadas por copia', async () => {
  resetDb();
  await setupVencida();
  registrarCopiaPendiente();

  const grupos = conservacion.vencimientos({ id_empresa: EMPRESA });

  assert.equal(grupos.vencidosElegibles.length, 0,
    'una firma con copia pendiente no es elegible');
  assert.equal(grupos.vencidosConCopia.length, 1,
    'pero queda a la vista: no se suprime en silencio');
});

test('8.6(e)(iii) · el lote de purga no recoge una firma con copia pendiente', async () => {
  resetDb();
  await setupVencida();
  registrarCopiaPendiente();

  const lote = abrirYLotear();

  assert.equal(lote.firmas, 0, 'la firma no entra al lote');
  assert.equal(lote.omitidas_copia, 1, 'y se cuenta por qué');

  const filas = db.prepare('SELECT firma_id FROM gh_firma_purga_lote').all();
  assert.equal(filas.length, 0, 'el lote está vacío');
});

// ===========================================================================
// 7. LA SUPRESIÓN: LA MISMA CONDICIÓN (el 8.6(f))
// ===========================================================================

test('8.6(f) · con una COPIA pendiente la supresión no borra nada', async () => {
  resetDb();
  const signRequest = await setupVencida();

  // El lote se arma ANTES de que llegue la copia: es el caso difícil, porque
  // la copia llegó después de que se decidiera qué se suprime.
  abrirYLotear();
  const enLote = db.prepare('SELECT firma_id FROM gh_firma_purga_lote').all();
  assert.equal(enLote.length, 1, 'la firma entró al lote');

  registrarCopiaPendiente();

  const sim = supresion.simular();
  assert.equal(sim.firmas, 0, 'la simulación no ve nada que suprimir');
  assert.equal(sim.copia_bloqueadas, 1,
    'y el informe dice POR QUÉ: una firma frenada por la copia pendiente');

  const r = supresion.suprimir({
    actor: 'test', motivo: 'Vencimiento del plazo declarado', dryRun: false,
  });
  assert.equal(r.firmas, 0, 'la supresión real no suprime nada');
  assert.equal(r.copia_bloqueadas, 1, 'y dice que fue por la copia pendiente');

  const fila = db.prepare('SELECT id FROM gh_firmas_electronicas WHERE id = ?')
    .get(signRequest.id);
  assert.ok(fila, 'la fila de la firma sigue viva: primero se entrega la copia');
});

test('8.6(f) · la supresión de OTRA empresa no se frena por esta copia', async () => {
  resetDb();
  const signRequest = await setupVencida();
  registrarCopiaPendiente('900999999'); // la copia es de otra empresa

  assert.equal(solicitudes.tieneCopiaPendiente('900999999'), true);
  assert.equal(solicitudes.tieneCopiaPendiente(EMPRESA), false);

  abrirYLotear();
  const sim = supresion.simular();
  assert.equal(sim.firmas, 1, 'la copia de otra empresa no frena a esta');
});

// ===========================================================================
// 8. LA COPIA ATENDIDA DESBLOQUEA LA SUPRESIÓN
// ===========================================================================

test('8.6(e)(iii) · la copia ATENDIDA desbloquea la supresión', async () => {
  resetDb();
  const signRequest = await setupVencida();
  const r = registrarCopiaPendiente();

  assert.equal(solicitudes.tieneCopiaPendiente(EMPRESA), true);
  assert.equal(conservacion.esElegible(firmaDe(signRequest.id)), false);

  // La Empresa declara que atendió la solicitud (el 8.6(f): "se atiende
  // antes de cualquier supresión").
  const res = await request(makeApp())
    .post(`/internal/admin/solicitudes/${r.id_solicitud}/responder`)
    .set(ADMIN)
    .send({
      actor: 'empresa:rrhh',
      respuesta: 'Adjuntamos la copia permanente del contrato firmado y la Constancia.',
      copia_atendida: true,
    })
    .timeout({ response: 5000 });

  assert.equal(res.status, 200);
  assert.equal(res.body.estado, 'RESPONDIDA');
  assert.equal(res.body.copia.pendiente, false);

  assert.equal(solicitudes.tieneCopiaPendiente(EMPRESA), false,
    'ya no hay solicitud de copia pendiente');
  assert.equal(conservacion.esElegible(firmaDe(signRequest.id)), true,
    'la cuarta condición del 8.6(e) se cumple otra vez');

  abrirYLotear();
  const sim = supresion.simular();
  assert.equal(sim.firmas, 1, 'la supresión vuelve a poder operar');
  assert.equal(sim.copia_bloqueadas, 0, 'y ya no hay nada frenado por copia');
});

// ===========================================================================
// 9. LA DECLARACIÓN QUEDA EN EL HISTORIAL
// ===========================================================================

test('8.5 · la declaración de atención queda en el historial (append-only)', async () => {
  resetDb();
  const r = registrarCopiaPendiente();

  await request(makeApp())
    .post(`/internal/admin/solicitudes/${r.id_solicitud}/responder`)
    .set(ADMIN)
    .send({
      actor: 'empresa:rrhh',
      respuesta: 'Copia entregada por correo.',
      copia_atendida: true,
    })
    .timeout({ response: 5000 });

  const eventos = solicitudes.eventos(r.id_solicitud);
  const respondida = eventos.find((e) => e.evento === 'SOLICITUD_RESPONDIDA');
  assert.ok(respondida, 'el historial tiene el evento de respuesta');
  assert.equal(respondida.metadata.copia_atendida, true,
    'y deja constancia de que la copia fue atendida');
});
