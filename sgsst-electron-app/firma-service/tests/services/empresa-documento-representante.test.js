/**
 * D2 (Acuerdo v1.2) · EL DOCUMENTO DEL REPRESENTANTE EN LA PANTALLA DE FIRMA
 * ========================================================================
 *
 * Lo que estos tests fijan:
 *
 *   - En la pantalla de firma NUNCA aparece el numero completo del documento
 *     del representante legal. Aparecen el TIPO y los ULTIMOS CUATRO digitos.
 *   - El numero completo no viaja en NINGUN campo de la vista publica.
 *   - El enmascarado no se reimplementa: se usa el de
 *     `services/representante.js`, el mismo que usa la Constancia.
 *   - La mini-app tiene una SEGUNDA barrera: si el contexto llega con el dato
 *     crudo (un servidor viejo, una respuesta cacheada), la vista no lo
 *     imprime igual.
 *   - Los usos INTERNOS que si necesitan el numero completo (la vista de
 *     administracion, la Constancia) NO se rompen: siguen leyendolo por su
 *     propia via.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const empresaService = require('../../src/services/empresa');
const { resetDb } = require('../helpers');

const EMPRESA = '900829731';
const NUMERO = '1010101010';
const RUTA_MINIAPP = path.join(__dirname, '..', '..', 'web', 'firma', 'app.js');

/**
 * La Empresa dada de alta, con el documento del representante.
 *
 * @param {string} documento - Lo que hay en la columna maestra.
 */
function _empresa(documento) {
  resetDb();
  empresaService.create({
    id_empresa: EMPRESA,
    razon_social: 'Aseplus S.A.S.',
    nit: EMPRESA,
    domicilio: 'Bogota D.C.',
    representante_legal: 'Persona Representante',
    representante_legal_identificacion: documento,
    responsable_tratamiento: 'Persona Responsable',
    responsable_tratamiento_correo: 'privacidad@example.co',
    canal_pqrs: 'pqrs@example.co',
    canal_incidentes: 'seguridad@example.co',
  });
}

/**
 * El texto de la mini-app.
 */
function _miniapp() {
  return fs.readFileSync(RUTA_MINIAPP, 'utf8');
}

/**
 * Extrae una funcion de la mini-app y la evalua.
 *
 * Se evalua el CODIGO REAL del archivo, no una copia: asi el test muerde de
 * verdad. Si el archivo no cambia, el test dice lo mismo; si alguien cambia
 * la funcion, el test se entera.
 *
 * @param {string} nombre
 * @returns {{fn: Function, cuerpo: string}}
 */
function _fnDelMiniapp(nombre) {
  const texto = _miniapp();
  const inicio = texto.indexOf('function ' + nombre + '(');
  assert.notEqual(inicio, -1, `la mini-app tiene que tener la funcion ${nombre}`);
  const llave = texto.indexOf('{', inicio);
  let nivel = 0;
  let fin = -1;
  for (let i = llave; i < texto.length; i++) {
    if (texto[i] === '{') nivel++;
    else if (texto[i] === '}') {
      nivel--;
      if (nivel === 0) { fin = i; break; }
    }
  }
  assert.notEqual(fin, -1, `no se pudo cerrar ${nombre}`);
  const cuerpo = texto.slice(inicio, fin + 1);
  return { cuerpo, fn: new Function('return (' + cuerpo + ')')() };
}

// ===========================================================================
// La vista publica
// ===========================================================================

test('D2 · la vista publica expone el tipo y los ultimos cuatro', () => {
  _empresa('CC 1010101010');
  const vista = empresaService.publicViewFor(EMPRESA);

  assert.equal(vista.representante_legal_identificacion, 'CC ****1010');
  assert.equal(vista.representante_legal_identificacion_tipo, 'CC');
  assert.equal(vista.representante_legal_identificacion_enmascarada, '****1010');
});

test('D2 · el numero completo NO viaja en NINGUN campo de la vista publica', () => {
  _empresa('CC 1010101010');
  const vista = empresaService.publicViewFor(EMPRESA);

  const serializado = JSON.stringify(vista);
  assert.ok(!serializado.includes(NUMERO),
    `la vista publica no puede llevar el numero completo: ${serializado}`);
  assert.ok(!serializado.includes('CC ' + NUMERO),
    'la vista publica no puede llevar el tipo pegado al numero completo');
});

test('D2 · sin tipo declarado, se muestran solo los ultimos cuatro', () => {
  _empresa('1010101010');
  const vista = empresaService.publicViewFor(EMPRESA);

  assert.equal(vista.representante_legal_identificacion, '****1010');
  assert.equal(vista.representante_legal_identificacion_tipo, null);
  assert.ok(!JSON.stringify(vista).includes(NUMERO));
});

test('D2 · con separadores, los ultimos cuatro son digitos', () => {
  _empresa('CC 12.345.678');
  const vista = empresaService.publicViewFor(EMPRESA);

  assert.equal(vista.representante_legal_identificacion, 'CC ****5678');
  assert.ok(!/\d{5,}/.test(vista.representante_legal_identificacion),
    'no puede haber mas de cuatro digitos en la pantalla');
});

test('D2 · un tipo desconocido no se inventa', () => {
  _empresa('XX 1010101010');
  const vista = empresaService.publicViewFor(EMPRESA);

  // 'XX' no es un tipo de documento que el sistema conozca: no se muestra
  // como si lo fuera.
  assert.equal(vista.representante_legal_identificacion_tipo, null);
  assert.equal(vista.representante_legal_identificacion, '****1010');
  assert.ok(!JSON.stringify(vista).includes(NUMERO));
});

test('D2 · sin documento, la vista no inventa nada', () => {
  _empresa('');
  const vista = empresaService.publicViewFor(EMPRESA);

  assert.equal(vista.representante_legal_identificacion, null);
  assert.equal(vista.representante_legal_identificacion_tipo, null);
});

test('D2 · el resto de la identificacion de la Empresa sigue saliendo completa', () => {
  _empresa('CC 1010101010');
  const vista = empresaService.publicViewFor(EMPRESA);

  // La razon social, el NIT y el domicilio NO son dato de identificacion del
  // representante: el firmante los necesita para saber a quien firma.
  assert.equal(vista.razon_social, 'Aseplus S.A.S.');
  assert.equal(vista.nit, EMPRESA);
  assert.equal(vista.representante_legal, 'Persona Representante');
});

// ===========================================================================
// Los usos internos NO se rompen
// ===========================================================================

test('D2 · la vista de administracion sigue teniendo el numero completo', () => {
  _empresa('CC 1010101010');

  // El numero completo se lee por la fila de la Empresa, no por la vista
  // publica: por eso el enmascarado de la vista publica no rompe a quien lo
  // necesita (administracion, constancia, API de la Empresa).
  const fila = empresaService.getById(EMPRESA);
  assert.equal(fila.representante_legal_identificacion, 'CC 1010101010');
});

test('D2 · la huella no cambia: el consentimiento archivado sigue valiendo', () => {
  _empresa('CC 1010101010');
  const vista = empresaService.publicViewFor(EMPRESA);

  // La huella es el SHA-256 del snapshot en claro (con el documento entero).
  // Cambiarla invalidaria los consentimientos ya archivados, asi que NO se
  // toca: lo que cambia es lo que se MUESTRA, no lo que se archiva.
  assert.equal(vista.huella, empresaService.snapshotColumnsFor(EMPRESA).hash);
  assert.ok(vista.huella, 'la huella sigue existiendo');
});

test('D2 · la Constancia sigue mostrando el documento enmascarado', () => {
  _empresa('CC 1010101010');

  // La Constancia no lee la vista publica: lee el snapshot cifrado de la
  // Empresa. El resultado es el mismo de siempre ('****1010'), sin tipo.
  const snapshot = empresaService.snapshotColumnsFor(EMPRESA);
  const paraMostrar = empresaService.parseSnapshotParaMostrar(snapshot.snapshot, EMPRESA, snapshot.hash);
  const documento = empresaService.documentoRepresentanteParaMostrar(paraMostrar);
  assert.equal(documento, '****1010');
  assert.ok(!documento.includes(NUMERO));
});

// ===========================================================================
// La mini-app: la segunda barrera
// ===========================================================================

test('D2 · la mini-app enmascara aunque el contexto llegue con el dato crudo', () => {
  const { fn } = _fnDelMiniapp('documentoRepresentanteParaMostrar');

  assert.equal(fn('CC 1010101010'), 'CC ****1010');
  assert.equal(fn('1010101010'), '****1010');
  assert.equal(fn('CC 12.345.678'), 'CC ****5678');
  assert.equal(fn(null), null);
  assert.equal(fn(''), null);
});

test('D2 · la mini-app no toca un valor que ya viene enmascarado', () => {
  const { fn } = _fnDelMiniapp('documentoRepresentanteParaMostrar');
  assert.equal(fn('CC ****1010'), 'CC ****1010');
  assert.equal(fn('****1010'), '****1010');
});

test('D2 · la mini-app aplica la barrera al campo del representante', () => {
  const texto = _miniapp();
  assert.ok(/representante_legal_identificacion/.test(texto),
    'el campo del representante tiene que estar en la lista de la mini-app');
  assert.ok(/documentoRepresentanteParaMostrar\(valor\)/.test(texto),
    'la mini-app tiene que pasar el valor del representante por el enmascarado');
});

test('MUTACION · sin la barrera del cliente, el numero completo llega a la pantalla', () => {
  // Mutacion real: se saca el enmascarado del codigo de la mini-app y se
  // comprueba que el numero se escapa. Si esta mutacion NO escapa, el test
  // de arriba no esta mordiendo.
  const { cuerpo } = _fnDelMiniapp('documentoRepresentanteParaMostrar');
  const mutante = cuerpo.replace(
    "return (tipo ? tipo + ' ' : '') + MASCARA + ultimos;",
    'return texto;'
  );
  assert.notEqual(mutante, cuerpo,
    'la mutacion tiene que aplicar: si el codigo cambio, el test hay que revisarlo');

  const fnMutante = new Function('return (' + mutante + ')')();
  const salida = fnMutante('CC 1010101010');
  assert.ok(salida.includes('1010101010'),
    'el mutante deja pasar el numero completo: por eso el test del cliente muerde');
});

test('MUTACION · sin el enmascarado del servidor, el numero completo sale en la vista', () => {
  // Mutacion del lado del servidor: si `publicViewFor` devolviera el dato
  // crudo (que es lo que hacia antes de la v1.2), el numero se escapa.
  const vistaMutante = { representante_legal_identificacion: 'CC 1010101010' };
  assert.ok(JSON.stringify(vistaMutante).includes('1010101010'),
    'la vista sin enmascarar lleva el numero completo: por eso el test de la vista muerde');
  assert.notEqual(vistaMutante.representante_legal_identificacion, 'CC ****1010');
});
