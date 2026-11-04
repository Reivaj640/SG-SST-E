/**
 * Las menciones de un marcador no son huecos por llenar (ronda del 3-nov-2026).
 *
 * EL CASO
 * -------
 * El Anexo de Nube termina con el aviso «Este Anexo no se firma con marcadores
 * [PENDIENTE] pendientes: se firma después de completarlos». Ese `[PENDIENTE]`
 * es el NOMBRE del marcador, citado en una regla: no es un dato sin llenar.
 *
 * Pero el contador de huecos lo contaba como hueco bloqueante, y el readiness
 * le decía al owner «Faltan 1 datos del owner: [PENDIENTE]» — que es FALSO:
 * los catorce apartados del owner están diligenciados. Y el ítem del gate
 * «Anexo de Nube: el modelo con todas las cláusulas y sin datos pendientes»
 * quedaba bloqueado por una mención.
 *
 * LA REGLA
 * --------
 * Solo cuenta como mención un `[PENDIENTE]` que va INMEDIATAMENTE precedido de
 * la palabra «marcador» o «marcadores». Un hueco de verdad («los marcadores
 * del formulario: [PENDIENTE]») NO coincide, porque entre la palabra y el
 * corchete hay algo más. Es la diferencia entre nombrar el marcador y dejar
 * el marcador.
 *
 * Lo que se fija acá:
 *   - La mención no bloquea, pero se LISTA (nada queda escondido).
 *   - Un hueco de verdad sigue bloqueando, aunque la palabra «marcador»
 *     aparezca en otra oración.
 *   - Los archivos REALES del repo: el Anexo de Nube no debe tener huecos
 *     bloqueantes y el Anexo de Encargo no debe conservar marcas de borrador.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const readiness = require('../src/services/readinessLegal');
const { listarMenciones, analizarTextoLegal } = require('../src/utils/textoLegal');

const LEGAL = path.resolve(__dirname, '..', '..', 'legal');
const NUBE_REAL = fs.readFileSync(path.join(LEGAL, 'anexo-nube-v1.0.html'), 'utf8');
const ENCARGO_REAL = fs.readFileSync(path.join(LEGAL, 'anexo-encargo.html'), 'utf8');

test('mención · un [PENDIENTE] precedido de "marcadores" es una mención', () => {
  const texto = 'Este Anexo no se firma con marcadores [PENDIENTE] pendientes: se firma despues de completarlos.';
  const menciones = listarMenciones(texto);
  assert.equal(menciones.length, 1);
  assert.equal(menciones[0].valor, '[PENDIENTE]');
});

test('mención · la mención no bloquea pero se lista', () => {
  const texto = 'Este Anexo no se firma con marcadores [PENDIENTE] pendientes.';
  const r = readiness.analizarAnexoNube(texto);
  assert.equal(r.huecosBloqueantes, 0, 'una mención no es un hueco');
  assert.equal(r.menciones.total, 1);
  assert.deepEqual(r.menciones.unicos, ['[PENDIENTE]']);
});

test('mención · un [PENDIENTE] de verdad sigue bloqueando', () => {
  const texto = 'Los marcadores del formulario: [PENDIENTE]';
  assert.equal(listarMenciones(texto).length, 0, 'no es una mención: hay algo entre la palabra y el corchete');
  const r = readiness.analizarAnexoNube(texto);
  assert.equal(r.huecosBloqueantes, 1, 'un hueco de verdad bloquea');
});

test('mención · la palabra "marcador" en otra oración no salva el hueco', () => {
  const texto = 'Se diligencian los marcadores del canal. El dato que falta: [PENDIENTE]';
  assert.equal(listarMenciones(texto).length, 0);
  const r = readiness.analizarAnexoNube(texto);
  assert.equal(r.huecosBloqueantes, 1);
});

test('mención · el Anexo de Nube real no tiene huecos bloqueantes', () => {
  const r = readiness.analizarAnexoNube(NUBE_REAL);
  assert.equal(
    r.huecosBloqueantes,
    0,
    'huecos bloqueantes: ' + JSON.stringify(r.huecos_bloqueantes.unicos),
  );
  assert.equal(r.menciones.total, 1, 'la mención se lista');
  assert.equal(r.ok, true, 'el Anexo de Nube real sirve tal cual: modeloOk=' + r.modeloOk);
  assert.equal(r.modeloOk, true);
});

test('mención · el Anexo de Encargo real no conserva marcas de borrador', () => {
  const legales = analizarTextoLegal(ENCARGO_REAL);
  assert.deepEqual(
    legales.marcadores.map((m) => m.codigo),
    [],
    'marcas prohibidas: ' + JSON.stringify(legales.marcadores),
  );
  const r = readiness.analizarAnexoEncargo(ENCARGO_REAL);
  assert.equal(r.clausulasOk, true, 'faltan: ' + JSON.stringify(r.faltan));
});
