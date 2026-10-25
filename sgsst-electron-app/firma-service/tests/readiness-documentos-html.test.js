/**
 * Tests del ANALISIS DE DOCUMENTOS HTML del readiness legal.
 *
 * Que se fija:
 *   - Que las clausulas se lean en el TEXTO RENDERIZADO (el que ve el
 *     firmante), no en el HTML crudo con entidades. El 24-oct-2026 el
 *     Anexo de Nube reportaba como faltantes cuatro clausulas que el
 *     documento SI tiene, solo porque estan escritas con entidades HTML.
 *   - Que el aviso de "no firmar" sea la MISMA frase que exige la clausula
 *     `banner`, y que a la vez bloquee la firma: un documento que dice "no
 *     firmar" no se puede publicar.
 *   - Que la exijencia y el bloqueo no se desincronicen: si uno cambia, el
 *     otro tiene que cambiar con el.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const readiness = require('../src/services/readinessLegal');
const { MARCADORES_PROHIBIDOS, reDeMarcador } = require('../src/utils/textoLegal');

/**
 * Un Anexo de Nube escrito como el real: HTML con entidades. Las frases son
 * las que el checker reportaba como faltantes por el motivo de las entidades.
 */
const NUBE_CON_ENTIDADES = [
  '<p><strong>NO FIRMAR HASTA COMPLETAR LOS DATOS</strong></p>',
  '<p>Art&iacute;culo 2.2.4.6.13 del Decreto 1072 de 2015.</p>',
  '<p>Veinte (20) a&ntilde;os de custodia.</p>',
  '<p>Hold sin t&eacute;rmino del contrato electr&oacute;nico.</p>',
  '<p>Traslado del reclamo en dos (2) d&iacute;as h&aacute;biles.</p>',
  '<p>Cloudflare, Inc. y Google LLC.</p>',
  '<p>DPA / Acuerdo de Tratamiento de Datos.</p>',
  '<p>RTO 4 horas. RPO 1 hora.</p>',
  '<p>Devoluci&oacute;n y supresi&oacute;n de los datos.</p>',
  '<p>Auditor&iacute;a del Encargado.</p>',
  '<p>Derechos del Titular.</p>',
  '<p>Transferencia internacional.</p>',
].join('\n');

function idsFaltantes(resultado) {
  return resultado.faltan.map((f) => f.id);
}

test('las clausulas se leen en el texto renderizado: las entidades no esconden la clausula', function () {
  const r = readiness.analizarAnexoNube(NUBE_CON_ENTIDADES);
  assert.deepEqual(
    idsFaltantes(r),
    [],
    'con entidades HTML el Anexo tiene las 16 clausulas: '
      + `faltan ${JSON.stringify(idsFaltantes(r))}`,
  );
  assert.equal(r.clausulasOk, true);
});

test('el texto plano equivalente da el MISMO resultado que el HTML con entidades', function () {
  const plano = NUBE_CON_ENTIDADES
    .replace(/<[^>]*>/g, ' ')
    .replace(/&iacute;/g, 'í')
    .replace(/&eacute;/g, 'é')
    .replace(/&oacute;/g, 'ó')
    .replace(/&aacute;/g, 'á')
    .replace(/&ntilde;/g, 'ñ');
  const conHtml = readiness.analizarAnexoNube(NUBE_CON_ENTIDADES);
  const conTexto = readiness.analizarAnexoNube(plano);
  assert.deepEqual(idsFaltantes(conHtml), idsFaltantes(conTexto));
  assert.equal(conHtml.clausulasOk, conTexto.clausulasOk);
});

test('sin la clausula, la lista la nombra (el check muerde)', function () {
  const sinVeinte = NUBE_CON_ENTIDADES.replace('Veinte (20) a&ntilde;os de custodia.', '');
  const r = readiness.analizarAnexoNube(sinVeinte);
  assert.ok(
    idsFaltantes(r).includes('veinte_anios'),
    `sin la clausula de los veinte anios el check la tiene que reportar: ${JSON.stringify(idsFaltantes(r))}`,
  );
  assert.equal(r.clausulasOk, false);
});

test('el aviso de no firmar tiene UNA sola fuente: el modulo legal', function () {
  const re = reDeMarcador('NO_FIRMAR');
  assert.ok(re, 'el modulo legal tiene que conocer la frase de "no firmar"');
  const marcador = MARCADORES_PROHIBIDOS.find((m) => m.codigo === 'NO_FIRMAR');
  assert.ok(marcador, 'NO_FIRMAR esta en la lista de marcadores prohibidos');
  assert.equal(marcador.re, re, 'el marcador y el accessor devuelven la MISMA expresion');

  // El aviso NO es una clausula del documento final: es el aviso del modelo.
  // Si fuera una clausula requerida, un documento final no podria estar ok
  // (no se firma un documento que dice "no firmar") y el item
  // `documento_nube` bloquearia la primera firma para siempre.
  const sinAviso = NUBE_CON_ENTIDADES.replace(
    '<p><strong>NO FIRMAR HASTA COMPLETAR LOS DATOS</strong></p>',
    '<p>Este Anexo esta completo.</p>',
  );
  const r = readiness.analizarAnexoNube(sinAviso);
  assert.ok(
    !idsFaltantes(r).includes('banner'),
    'el aviso no es una clausula: no puede faltar por no estar',
  );
  assert.equal(r.ok, true, `faltan: ${JSON.stringify(idsFaltantes(r))}`);
});

test('la regla del aviso es coherente en los dos sentidos', function () {
  // 1. Con huecos y SIN aviso: el documento tiene que advertir que no se
  //    firme, y el check lo reporta.
  const conHuecoSinAviso = NUBE_CON_ENTIDADES
    .replace(
      '<p><strong>NO FIRMAR HASTA COMPLETAR LOS DATOS</strong></p>',
      '<p>Este Anexo esta completo.</p>',
    )
    .replace('<p>Cloudflare, Inc. y Google LLC.</p>', '<p>NIT [ ]</p>');
  const r1 = readiness.analizarAnexoNube(conHuecoSinAviso);
  assert.ok(
    idsFaltantes(r1).includes('aviso_sin_datos'),
    `faltan: ${JSON.stringify(idsFaltantes(r1))}`,
  );

  // 2. Con huecos Y aviso: el aviso cumple su papel, y lo que bloquea son los
  //    huecos.
  const conHuecoConAviso = NUBE_CON_ENTIDADES.replace(
    '<p>Cloudflare, Inc. y Google LLC.</p>',
    '<p>NIT [ ]</p>',
  );
  const r2 = readiness.analizarAnexoNube(conHuecoConAviso);
  assert.ok(!idsFaltantes(r2).includes('aviso_sin_datos'), 'con el aviso, no falta el aviso');
  assert.equal(r2.ok, false, 'los huecos siguen bloqueando');
});

test('un Anexo que dice "no firmar" NO se puede publicar, aunque no tenga huecos', function () {
  const r = readiness.analizarAnexoNube(NUBE_CON_ENTIDADES);
  assert.equal(r.placeholders.huecos.total, 0, 'el texto de la prueba no tiene corchetes');
  assert.equal(
    r.ok,
    false,
    'un documento con el aviso de no firmar no puede estar listo para firmarse',
  );
  const codigos = r.marcadores.map((m) => m.codigo);
  assert.ok(codigos.includes('NO_FIRMAR'), `marcadores: ${JSON.stringify(codigos)}`);
});

test('sin el aviso de no firmar y sin huecos, el Anexo si puede quedar ok', function () {
  const sinAviso = NUBE_CON_ENTIDADES.replace(
    '<p><strong>NO FIRMAR HASTA COMPLETAR LOS DATOS</strong></p>',
    '<p>Este Anexo esta completo.</p>',
  );
  const r = readiness.analizarAnexoNube(sinAviso);
  assert.equal(r.placeholders.huecos.total, 0);
  assert.equal(r.marcadores.length, 0, `marcadores: ${JSON.stringify(r.marcadores)}`);
  assert.equal(r.ok, true, `faltan: ${JSON.stringify(idsFaltantes(r))}`);
});

test('el hash sigue siendo el del ARCHIVO, no el del texto renderizado', function () {
  const r = readiness.analizarAnexoNube(NUBE_CON_ENTIDADES);
  const crypto = require('node:crypto');
  const esperado = crypto.createHash('sha256').update(NUBE_CON_ENTIDADES, 'utf8').digest('hex');
  assert.equal(r.hash, esperado, 'la huella identifica el archivo, byte a byte');
});

test('el Anexo de Encargo tambien se lee en el texto renderizado', function () {
  const encargo = [
    '<p>Se incorpora el Anexo de Nube.</p>',
    '<p>Cl&aacute;usula de otros&iacute;.</p>',
    '<p>Art&iacute;culo 2.2.4.6.13 del Decreto 1072 de 2015.</p>',
    '<p>Veinte (20) a&ntilde;os de custodia.</p>',
    '<p>El servicio en nube: firma-service.</p>',
  ].join('\n');
  const r = readiness.analizarAnexoEncargo(encargo);
  assert.deepEqual(idsFaltantes(r), [], `faltan: ${JSON.stringify(idsFaltantes(r))}`);
  assert.equal(r.clausulasOk, true);
});

test('los corchetes dentro del texto siguen siendo huecos (no se pierde ninguno)', function () {
  const conHueco = NUBE_CON_ENTIDADES.replace(
    '<p>Cloudflare, Inc. y Google LLC.</p>',
    '<p>Cloudflare, Inc. y Google LLC.</p><p>Entre [EMPRESA], NIT [ ], representada por [ ].</p>',
  );
  const r = readiness.analizarAnexoNube(conHueco);
  assert.equal(r.placeholders.huecos.total, 3, `huecos: ${JSON.stringify(r.placeholders.huecos)}`);
  assert.equal(r.ok, false);
});

test('los tres campos que diligencia la Empresa al firmar no bloquean, pero se listan', function () {
  // El Anexo de Nube del repo es el MODELO: lo firma cada Empresa con sus
  // datos. Los tres campos de la parte responsable cambian en cada copia, asi
  // que no se pueden diligenciar en el modelo: se listan, pero no bloquean.
  const conCampos = NUBE_CON_ENTIDADES.replace(
    '<p>Derechos del Titular.</p>',
    '<p>Derechos del Titular.</p>'
      + '<p>Entre [nombre de la Empresa], NIT [NIT de la Empresa], representada por'
      + ' [representante legal de la Empresa].</p>',
  );
  const r = readiness.analizarAnexoNube(conCampos);
  assert.equal(r.de_la_empresa.total, 3, `de la Empresa: ${JSON.stringify(r.de_la_empresa)}`);
  assert.equal(r.huecosBloqueantes, 0);
  assert.equal(r.ok, false, 'el aviso de no firmar sigue bloqueando como documento final');
  assert.equal(r.modeloOk, true, 'pero como MODELO esta completo');
});

test('un hueco que depende del owner SI bloquea el modelo', function () {
  const conHueco = NUBE_CON_ENTIDADES.replace(
    '<p>Derechos del Titular.</p>',
    '<p>Derechos del Titular.</p><p>RTO [RTO en horas] horas.</p>',
  );
  const r = readiness.analizarAnexoNube(conHueco);
  assert.equal(r.huecosBloqueantes, 1);
  assert.equal(r.de_la_empresa.total, 0);
  assert.equal(r.modeloOk, false, 'un dato del owner pendiente bloquea el modelo');
});

test('la excepcion de la Empresa es de CONTENIDO EXACTO', function () {
  // "NIT de la Empresa cliente" NO es el campo: sigue contando como hueco y
  // bloquea. Una excepcion laxa es un agujero.
  const casi = NUBE_CON_ENTIDADES.replace(
    '<p>Derechos del Titular.</p>',
    '<p>Derechos del Titular.</p><p>NIT [NIT de la Empresa cliente]</p>',
  );
  const r = readiness.analizarAnexoNube(casi);
  assert.equal(r.de_la_empresa.total, 0);
  assert.equal(r.huecosBloqueantes, 1);
  assert.equal(r.modeloOk, false);
});

test('el Anexo de Nube del repo es el MODELO y le faltan solo datos del owner', function () {
  const fs = require('node:fs');
  const path = require('node:path');
  const html = fs.readFileSync(
    path.join(__dirname, '..', '..', 'legal', 'anexo-nube-v1.0.html'),
    'utf8',
  );
  const r = readiness.analizarAnexoNube(html);
  assert.equal(r.clausulasOk, true, `faltan: ${JSON.stringify(r.faltan)}`);
  assert.equal(
    r.de_la_empresa.total,
    3,
    `los tres campos de la Empresa: ${JSON.stringify(r.de_la_empresa)}`,
  );
  assert.ok(
    r.huecosBloqueantes > 0,
    'el modelo todavia tiene datos del owner por diligenciar',
  );
  assert.equal(r.modeloOk, false, 'por eso el modelo no esta listo para firmar');
});

test('los dos arboles del Anexo de Nube estan identicos (legal/ y sitio/)', function () {
  const fs = require('node:fs');
  const path = require('node:path');
  const legal = fs.readFileSync(
    path.join(__dirname, '..', '..', 'legal', 'anexo-nube-v1.0.html'),
    'utf8',
  );
  const sitio = fs.readFileSync(
    path.join(__dirname, '..', '..', '..', 'sitio', 'anexo-nube-v1.0.html'),
    'utf8',
  );
  assert.equal(
    sitio,
    legal,
    'el Anexo de Nube publicado y el del repo tienen que ser el mismo archivo',
  );
});
