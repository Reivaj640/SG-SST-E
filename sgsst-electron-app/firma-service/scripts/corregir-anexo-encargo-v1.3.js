#!/usr/bin/env node
/**
 * scripts/corregir-anexo-encargo-v1.3.js
 *
 * Aplica al Anexo de Encargo las correcciones de coherencia que la generacion
 * del 30-oct-2026 dejo pendientes, y despues regenera el documento desde las
 * fuentes para que siga siendo idempotente.
 *
 * QUE CORRIGE
 * ------------
 *  1. La fuente `config/tabla-conservacion.json` decía "responsabilidades y
 *     sabias" (debía decir "sabias" en el sentido de "saberes"). Es un error de
 *     redaccion mio, no del abogado: se corrige en la fuente, no en el
 *     documento, para que el Anexo no lo reproduzca.
 *  2. Un `</p>` de mas en el parrafo del 10.8(d) (preexistente en HEAD).
 *  3. El pie decía "actualizado el 27 de octubre de 2026" mientras el
 *     encabezado decia 30 de octubre.
 *  4. La seccion 13 no listaba cinco articulos del Decreto 1074 que el propio
 *     Anexo invoca, ni el articulo 14 de la Ley 1581 que invoca la matriz de
 *     finalidades. Se listan SIN caracterizarlos: §13 es un indice de lo que
 *     el documento cita, y calificar un articulo es materia del abogado.
 *
 * Las tres correcciones del HTML caen FUERA de los bloques generados
 * (MATRIZ-FINALIDADES y TABLA-CONSERVACION), asi que sobreviven a la
 * regeneracion. Al final se corre el generador en modo --check: si dice OK,
 * el documento sigue al dia con sus fuentes.
 *
 * Uso:
 *   node scripts/corregir-anexo-encargo-v1.3.js
 *
 * Exit codes:
 *   0 = corregido y verificado
 *   3 = error
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const SERVICE_ROOT = path.resolve(__dirname, '..');
const APP_ROOT = path.resolve(SERVICE_ROOT, '..');
const REPO_ROOT = path.resolve(APP_ROOT, '..');

const FUENTE_TABLA = path.join(SERVICE_ROOT, 'config', 'tabla-conservacion.json');
const HTML_LEGAL = path.join(APP_ROOT, 'legal', 'anexo-encargo.html');
const HTML_SITIO = path.join(REPO_ROOT, 'sitio', 'anexo-encargo.html');
const GENERADOR = path.join(__dirname, 'generar-anexo-encargo.js');

function error(msg) {
  const e = new Error(msg);
  e.codigo = 3;
  return e;
}

/**
 * Reemplazo literal que exige exactamente una coincidencia.
 */
function reemplazar(texto, viejo, nuevo, etiqueta) {
  const n = texto.split(viejo).length - 1;
  if (n !== 1) {
    throw error('El literal de ' + etiqueta + ' aparece ' + n + ' veces; tiene que '
      + 'aparecer exactamente una.');
  }
  return texto.replace(viejo, nuevo);
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function main() {
  // ---------------------------------------------------------------- 1. fuente
  if (!fs.existsSync(FUENTE_TABLA)) throw error('No existe ' + FUENTE_TABLA);
  let fuente = fs.readFileSync(FUENTE_TABLA, 'utf8');
  fuente = reemplazar(
    fuente,
    'responsabilidades y sabias.',
    'responsabilidades y conocimientos.',
    'fundamento de REGISTRO_OPERACIONES',
  );
  JSON.parse(fuente);
  fs.writeFileSync(FUENTE_TABLA, fuente, 'utf8');
  console.log('1. fuente corregida: "sabias" -> "conocimientos"');

  // ------------------------------------------------------- 2. regenerar
  const salidaGen = execFileSync(process.execPath, [GENERADOR], {
    cwd: SERVICE_ROOT,
    encoding: 'utf8',
  });
  console.log(salidaGen.trim().split('\n').map(l => '   ' + l).join('\n'));

  // ------------------------------------------------------- 3. HTML a mano
  if (!fs.existsSync(HTML_LEGAL)) throw error('No existe ' + HTML_LEGAL);
  let html = fs.readFileSync(HTML_LEGAL, 'utf8');
  const eolAntes = (html.match(/\r\n/g) || []).length;

  html = reemplazar(
    html,
    'son los que fijen la ley aplicable.</p></p>',
    'son los que fijen la ley aplicable.</p>',
    'el </p> de mas del 10.8(d)',
  );
  console.log('2. corregido el </p> de mas del parrafo del 10.8(d)');

  html = reemplazar(
    html,
    'Documento actualizado el 27 de octubre de 2026',
    'Documento actualizado el 30 de octubre de 2026',
    'la fecha del pie',
  );
  console.log('3. corregida la fecha del pie (27 -> 30 de octubre de 2026)');

  html = reemplazar(
    html,
    'art&iacute;culos 5, 6, 7, 15, 16 y 19;',
    'art&iacute;culos 5, 6, 7, 14, 15, 16 y 19;',
    'la lista de articulos de la Ley 1581',
  );
  html = reemplazar(
    html,
    '    <li>Decreto 1074 de 2015, art&iacute;culos 2.2.2.25.5.1 y 2.2.2.25.5.2 (transmisi&oacute;n internacional y\n'
    + '    contrato de transmisi&oacute;n).</li>',
    '    <li>Decreto 1074 de 2015, art&iacute;culos 2.2.2.25.5.1 y 2.2.2.25.5.2 (transmisi&oacute;n internacional y\n'
    + '    contrato de transmisi&oacute;n); art&iacute;culos 2.2.2.25.2.3, 2.2.2.25.2.5, 2.2.2.25.2.6 y\n'
    + '    2.2.2.25.4.4; y art&iacute;culos 2.2.2.47.4 y 2.2.2.47.6.</li>',
    'la lista de articulos del Decreto 1074',
  );
  console.log('4. completada la seccion 13 con los articulos que el Anexo cita');

  // ------------------------------------------------------- 4. EOL y CJK
  const eolDespues = (html.match(/\r\n/g) || []).length;
  if (eolDespues !== eolAntes) {
    throw error('El EOL cambio: CRLF antes ' + eolAntes + ', despues ' + eolDespues + '.');
  }
  const prohibidos = new Set();
  for (const c of html) {
    const q = c.codePointAt(0);
    if ((q >= 0x4e00 && q <= 0x9fff) || (q >= 0x0400 && q <= 0x04ff) || (q >= 0xac00 && q <= 0xd7af)) {
      prohibidos.add('U+' + q.toString(16));
    }
  }
  if (prohibidos.size) throw error('Caracteres prohibidos: ' + [...prohibidos].join(','));

  fs.writeFileSync(HTML_LEGAL, html, 'utf8');
  fs.writeFileSync(HTML_SITIO, html, 'utf8');
  console.log('5. legal/ y sitio/ sincronizados byte a byte');

  // ------------------------------------------------------- 5. idempotencia
  const check = execFileSync(process.execPath, [GENERADOR, '--check'], {
    cwd: SERVICE_ROOT,
    encoding: 'utf8',
  });
  console.log('\n=== VERIFICACION DEL GENERADOR ===');
  console.log(check.trim().split('\n').map(l => '   ' + l).join('\n'));
  if (!/VERIFICACION OK/.test(check)) {
    throw error('El generador dice que el Anexo no esta al dia con sus fuentes.');
  }

  const buf = fs.readFileSync(HTML_LEGAL);
  console.log('\n  bytes : ' + buf.length);
  console.log('  sha256: ' + sha256(buf));
  console.log('  EOL   : CRLF=' + eolDespues + ' (LF puro)');
}

try {
  main();
} catch (err) {
  console.error('ERROR: ' + err.message);
  process.exit(err.codigo || 3);
}
