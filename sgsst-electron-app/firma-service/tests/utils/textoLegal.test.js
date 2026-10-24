/**
 * Tests del módulo compartido src/utils/textoLegal.js.
 *
 * Qué se prueba:
 *  - Un hueco (un corchete que alguien tiene que llenar) bloquea la publicación.
 *  - Un campo que registra el sistema NO es un hueco: la v1.0 del Acuerdo ya
 *    está publicada y sellada con cuatro de esos en su bloque de Manifestación
 *    de Voluntad, y el sistema los llena al firmar.
 *  - La excepción es de CONTENIDO EXACTO: cualquier variación sigue contando
 *    como hueco y bloquea.
 *  - El conteo no depende del `lastIndex` de un regex global: dos llamadas
 *    seguidas devuelven lo mismo.
 *
 * Este archivo NO abre la base de datos: el módulo es de texto puro.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  analizarTextoLegal,
  listarPlaceholders,
  esPlaceholderDelSistema,
  buscarPlaceholders,
  PLACEHOLDERS_DEL_SISTEMA,
} = require('../../src/utils/textoLegal');

const RAIZ_SERVICIO = path.resolve(__dirname, '..', '..');
const V1_0 = path.join(RAIZ_SERVICIO, 'scripts', 'fixtures', 'acuerdo-v1.0.txt');

// ---------------------------------------------------------------------------
// La excepción
// ---------------------------------------------------------------------------

test('textoLegal · el campo del sistema no es un hueco', () => {
  const analisis = analizarTextoLegal(
    'Fecha y hora de aceptación: [registrada por el sistema]',
  );
  assert.equal(analisis.ok, true, 'un campo del sistema no bloquea la publicación');
  assert.equal(analisis.placeholders.total, 1, 'pero sí se cuenta como corchete');
  assert.equal(analisis.placeholders.huecos.total, 0, 'no es un hueco');
  assert.equal(analisis.placeholders.sistema.total, 1, 'es un campo del sistema');
});

test('textoLegal · un hueco junto a un campo del sistema sigue bloqueando', () => {
  const analisis = analizarTextoLegal(
    'La politica esta en [URL].\nFirma del Trabajador: [registrada por el sistema]',
  );
  assert.equal(analisis.ok, false);
  assert.equal(analisis.placeholders.huecos.total, 1);
  assert.deepEqual(analisis.placeholders.huecos.unicos, ['[URL]']);
  assert.equal(analisis.placeholders.sistema.total, 1);
});

test('textoLegal · la excepción es de contenido EXACTO', () => {
  const variantes = [
    '[registrada por la empresa]',
    '[registrada por el sistema mas adelante]',
    '[registrada por el sistema y la empresa]',
    '[registrada por el sistem]',
    '[el sistema la registra]',
  ];
  for (const v of variantes) {
    const analisis = analizarTextoLegal('Campo: ' + v);
    assert.equal(analisis.ok, false, 'debe bloquear: ' + v);
    assert.equal(analisis.placeholders.huecos.total, 1, 'debe ser un hueco: ' + v);
    assert.equal(analisis.placeholders.sistema.total, 0, 'no es campo del sistema: ' + v);
  }
});

test('textoLegal · la excepción no depende de las mayusculas ni de los espacios', () => {
  for (const v of [
    '[REGISTRADA POR EL SISTEMA]',
    '[Registrada Por El Sistema]',
    '[  registrada   por   el   sistema  ]',
  ]) {
    const analisis = analizarTextoLegal('Campo: ' + v);
    assert.equal(analisis.ok, true, 'debe dejar pasar: ' + v);
    assert.equal(analisis.placeholders.sistema.total, 1, 'debe ser campo del sistema: ' + v);
  }
});

test('textoLegal · esPlaceholderDelistema solo acepta la frase exacta', () => {
  assert.equal(esPlaceholderDelSistema('[registrada por el sistema]'), true);
  assert.equal(esPlaceholderDelSistema(' [REGISTRADA POR EL SISTEMA] '), true);
  assert.equal(esPlaceholderDelSistema('[registrada por la empresa]'), false);
  assert.equal(esPlaceholderDelSistema('[registrada por el sistema mas]'), false);
  assert.equal(esPlaceholderDelSistema('registrada por el sistema'), false, 'sin corchetes no es placeholder');
  assert.equal(esPlaceholderDelSistema(''), false);
  assert.equal(esPlaceholderDelSistema(null), false);
});

test('textoLegal · la lista de campos del sistema es corta y esta documentada', () => {
  assert.equal(PLACEHOLDERS_DEL_SISTEMA.length, 1);
  assert.ok(PLACEHOLDERS_DEL_SISTEMA[0].etiqueta, 'cada campo lleva su etiqueta');
});

// ---------------------------------------------------------------------------
// El conteo
// ---------------------------------------------------------------------------

test('textoLegal · listarPlaceholders separa huecos y campos del sistema', () => {
  const p = listarPlaceholders(
    '[URL] [URL] [registrada por el sistema] [registrada por el sistema]',
  );
  assert.equal(p.total, 4, 'cuenta todas las ocurrencias');
  assert.equal(p.huecos.total, 2, 'los dos [URL] son huecos');
  assert.deepEqual(p.huecos.unicos, ['[URL]']);
  assert.equal(p.sistema.total, 2, 'los otros dos los registra el sistema');
  assert.deepEqual(p.sistema.unicos, ['[registrada por el sistema]']);
});

test('textoLegal · un texto sin corchetes no tiene ni huecos ni campos', () => {
  const p = listarPlaceholders('Texto completo, sin corchetes.');
  assert.equal(p.total, 0);
  assert.equal(p.huecos.total, 0);
  assert.equal(p.sistema.total, 0);
  assert.deepEqual(p.huecos.unicos, []);
});

test('textoLegal · un texto vacio o que no es texto no rompe', () => {
  for (const v of ['', null, undefined, 42, {}]) {
    const p = listarPlaceholders(v);
    assert.equal(p.total, 0);
    assert.equal(p.huecos.total, 0);
    assert.equal(p.sistema.total, 0);
  }
});

test('textoLegal · buscarPlaceholders no depende del lastIndex', () => {
  const texto = 'uno [A] dos [B] tres';
  const a = buscarPlaceholders(texto);
  const b = buscarPlaceholders(texto);
  assert.deepEqual(a, ['[A]', '[B]']);
  assert.deepEqual(b, ['[A]', '[B]'], 'la segunda llamada tiene que dar lo mismo');
});

// ---------------------------------------------------------------------------
// El caso real: la v1.0 que ya está publicada
// ---------------------------------------------------------------------------

test('textoLegal · la v1.0 publicada solo tiene campos del sistema, no huecos', () => {
  const texto = fs.readFileSync(V1_0, 'utf8');
  const analisis = analizarTextoLegal(texto);
  assert.equal(analisis.placeholders.total, 4, 'son los cuatro del bloque de Manifestación');
  assert.equal(analisis.placeholders.huecos.total, 0, 'ninguno es un hueco');
  assert.equal(analisis.placeholders.sistema.total, 4, 'los cuatro los registra el sistema');
  assert.deepEqual(
    analisis.placeholders.sistema.unicos,
    ['[registrada por el sistema]'],
  );
  assert.equal(analisis.ok, true, 'el texto que ya está en producción no tiene huecos');
  assert.deepEqual(analisis.marcadores, [], 'ni marcas de borrador');
});
