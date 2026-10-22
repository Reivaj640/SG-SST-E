// =====================================================================
// 📦927 (2026-10-21) — Tests del merge puro para publicar la identidad
// de la empresa en firma-service.
//
// Ejecutar: node --test main/test-empresa-datos-firma-sync.js
//
// Este archivo NO toca red ni base de datos: valida que el body del PUT
// conserve lo que el formulario local no administra.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildEmpresaUpdate } = require('./empresa-datos-firma-sync');

const SERVER = {
  id_empresa: '900123456',
  razon_social: 'EMPRESA DE PRUEBA S.A.S.',
  nit: '900123456',
  domicilio: 'Calle 100 # 20-30',
  representante_legal: 'ANA PEREZ',
  representante_legal_identificacion: 'CC 111111111',
  responsable_tratamiento: 'ANA PEREZ',
  responsable_tratamiento_correo: 'ana@example.test',
  canal_pqrs: 'pqrs@example.test',
  canal_incidentes: 'seguridad@example.test',
  politica_datos_url: 'https://example.test/privacidad',
  plazo_retencion: '10 años',
  plazo_retencion_dias: 3650,
  canal_solicitud_copia: 'contacto@example.test',
  conservacion_por_deber_legal: true,
  norma_conservacion: 'Ley 1581 de 2012',
  dominios_corporativos: ['example.test']
};

const LOCAL = {
  nit: '900999999',
  domicilio: 'Calle 1 # 2-3',
  domicilioMunicipio: 'Soledad',
  domicilioDepartamento: 'Atlántico',
  responsableNombre: 'CARLOS RUIZ',
  responsableCargo: 'Jefe de Talento Humano',
  responsableCorreo: 'carlos@example.test',
  canalContacto: 'contacto@example.test',
  canalPqrs: 'pqrs@example.test',
  canalIncidentes: 'seguridad@example.test',
  politicaDatosUrl: 'https://example.test/privacidad'
};

const REP = {
  nombre: 'CARLOS RUIZ',
  tipoIdentificacion: 'CC',
  numeroIdentificacion: '987654321'
};

test('buildEmpresaUpdate: la razón social SIEMPRE se toma del servidor', function () {
  const body = buildEmpresaUpdate(SERVER, Object.assign({}, LOCAL, {
    razonSocial: 'Aseplus' // nombre corto local, NO es razón social
  }), REP);
  assert.equal(body.razon_social, 'EMPRESA DE PRUEBA S.A.S.');
});

test('buildEmpresaUpdate: usa local.razonSocial solo si el servidor no la tiene', function () {
  const body = buildEmpresaUpdate({ id_empresa: '900123456', razon_social: null }, {
    razonSocial: 'RAZON SOCIAL LOCAL'
  }, {});
  assert.equal(body.razon_social, 'RAZON SOCIAL LOCAL');
});

test('buildEmpresaUpdate: los campos locales pisan a los del servidor', function () {
  const body = buildEmpresaUpdate(SERVER, LOCAL, REP);
  assert.equal(body.nit, '900999999');
  assert.equal(body.domicilio, 'Calle 1 # 2-3, Soledad, Atlántico');
  assert.equal(body.responsable_tratamiento, 'CARLOS RUIZ');
  assert.equal(body.responsable_tratamiento_correo, 'carlos@example.test');
  assert.equal(body.canal_pqrs, 'pqrs@example.test');
  assert.equal(body.canal_incidentes, 'seguridad@example.test');
  assert.equal(body.politica_datos_url, 'https://example.test/privacidad');
  assert.equal(body.representante_legal, 'CARLOS RUIZ');
  assert.equal(body.representante_legal_identificacion, 'CC 987654321');
});

test('buildEmpresaUpdate: un campo local vacío NO borra el valor del servidor', function () {
  const body = buildEmpresaUpdate(SERVER, {
    nit: '',
    domicilio: '   ',
    domicilioMunicipio: null,
    domicilioDepartamento: undefined,
    responsableNombre: '',
    responsableCorreo: '',
    canalContacto: '',
    canalPqrs: '',
    canalIncidentes: '',
    politicaDatosUrl: ''
  }, { nombre: '', numeroIdentificacion: '' });
  assert.equal(body.nit, '900123456');
  assert.equal(body.domicilio, 'Calle 100 # 20-30');
  assert.equal(body.responsable_tratamiento, 'ANA PEREZ');
  assert.equal(body.responsable_tratamiento_correo, 'ana@example.test');
  assert.equal(body.canal_pqrs, 'pqrs@example.test');
  assert.equal(body.canal_incidentes, 'seguridad@example.test');
  assert.equal(body.politica_datos_url, 'https://example.test/privacidad');
  assert.equal(body.representante_legal, 'ANA PEREZ');
  assert.equal(body.representante_legal_identificacion, 'CC 111111111');
});

test('buildEmpresaUpdate: preserva plazo, canal de copia y deber legal', function () {
  const body = buildEmpresaUpdate(SERVER, LOCAL, REP);
  assert.equal(body.plazo_retencion, '10 años');
  assert.equal(body.plazo_retencion_dias, 3650);
  assert.equal(body.canal_solicitud_copia, 'contacto@example.test');
  assert.equal(body.conservacion_por_deber_legal, true);
  assert.equal(body.norma_conservacion, 'Ley 1581 de 2012');
});

test('buildEmpresaUpdate: conservacion_por_deber_legal acepta 1 y ausente = false', function () {
  const conUno = buildEmpresaUpdate(Object.assign({}, SERVER, {
    conservacion_por_deber_legal: 1
  }), LOCAL, REP);
  assert.equal(conUno.conservacion_por_deber_legal, true);

  const sinDato = buildEmpresaUpdate({ id_empresa: '900123456', razon_social: 'X' }, LOCAL, REP);
  assert.equal(sinDato.conservacion_por_deber_legal, false);
  assert.equal(sinDato.norma_conservacion, null);
});

test('buildEmpresaUpdate: plazos ausentes viajan como null (el service los escribe siempre)', function () {
  const body = buildEmpresaUpdate({ id_empresa: '900123456', razon_social: 'X' }, LOCAL, REP);
  assert.equal(body.plazo_retencion, null);
  assert.equal(body.plazo_retencion_dias, null);
  assert.equal(body.canal_solicitud_copia, null);
});

test('buildEmpresaUpdate: NO incluye dominios_corporativos', function () {
  const body = buildEmpresaUpdate(SERVER, LOCAL, REP);
  assert.equal(Object.prototype.hasOwnProperty.call(body, 'dominios_corporativos'), false);
});

test('buildEmpresaUpdate: conserva el documento cifrado del representante', function () {
  const body = buildEmpresaUpdate(Object.assign({}, SERVER, {
    representante_legal_identificacion: 'enc:AAAA_CIFRADO'
  }), LOCAL, REP);
  assert.equal(body.representante_legal_identificacion, 'enc:AAAA_CIFRADO');
});

test('buildEmpresaUpdate: usa CC por defecto si el tipo de identificación falta', function () {
  const body = buildEmpresaUpdate(SERVER, LOCAL, {
    nombre: 'CARLOS RUIZ',
    numeroIdentificacion: '987654321'
  });
  assert.equal(body.representante_legal_identificacion, 'CC 987654321');
});

test('buildEmpresaUpdate: si el domicilio local está incompleto, usa solo lo disponible', function () {
  const body = buildEmpresaUpdate(SERVER, {
    domicilio: 'Calle 1 # 2-3',
    domicilioMunicipio: '',
    domicilioDepartamento: 'Atlántico'
  }, REP);
  assert.equal(body.domicilio, 'Calle 1 # 2-3, Atlántico');
});

test('buildEmpresaUpdate: rechaza existing nulo, array o no objeto', function () {
  [null, [], 'texto', 42].forEach(function (bad) {
    assert.throws(function () { buildEmpresaUpdate(bad, LOCAL, REP); }, /existing es requerido/);
  });
});

test('buildEmpresaUpdate: rechaza domicilio de más de 300 caracteres', function () {
  assert.throws(function () {
    buildEmpresaUpdate(SERVER, {
      domicilio: 'X'.repeat(301)
    }, REP);
  }, /domicilio completo excede 300/);
});

test('buildEmpresaUpdate: rechaza campos que exceden el límite del zod', function () {
  assert.throws(function () {
    buildEmpresaUpdate(SERVER, { nit: 'X'.repeat(65) }, REP);
  }, /nit excede 64/);
  assert.throws(function () {
    buildEmpresaUpdate(SERVER, { responsableNombre: 'X'.repeat(201) }, REP);
  }, /responsable_tratamiento excede 200/);
  assert.throws(function () {
    buildEmpresaUpdate(SERVER, LOCAL, { nombre: 'X'.repeat(201) });
  }, /representante_legal excede 200/);
  assert.throws(function () {
    buildEmpresaUpdate(SERVER, { politicaDatosUrl: 'https://x.test/' + 'a'.repeat(500) }, REP);
  }, /politica_datos_url excede 500/);
  assert.throws(function () {
    buildEmpresaUpdate(Object.assign({}, SERVER, {
      canal_solicitud_copia: 'X'.repeat(301)
    }), LOCAL, REP);
  }, /canal_solicitud_copia excede 300/);
});

test('buildEmpresaUpdate: local y representante ausentes no rompen', function () {
  const body = buildEmpresaUpdate(SERVER);
  assert.equal(body.razon_social, SERVER.razon_social);
  assert.equal(body.representante_legal, SERVER.representante_legal);
  assert.equal(body.representante_legal_identificacion, SERVER.representante_legal_identificacion);
});

test('buildEmpresaUpdate: devuelve exactamente los 12 campos editables + plazo/deber legal', function () {
  const body = buildEmpresaUpdate(SERVER, LOCAL, REP);
  const claves = Object.keys(body).sort();
  assert.deepEqual(claves, [
    'canal_incidentes',
    'canal_pqrs',
    'canal_solicitud_copia',
    'conservacion_por_deber_legal',
    'domicilio',
    'nit',
    'norma_conservacion',
    'plazo_retencion',
    'plazo_retencion_dias',
    'politica_datos_url',
    'razon_social',
    'representante_legal',
    'representante_legal_identificacion',
    'responsable_tratamiento',
    'responsable_tratamiento_correo'
  ].sort());
});
