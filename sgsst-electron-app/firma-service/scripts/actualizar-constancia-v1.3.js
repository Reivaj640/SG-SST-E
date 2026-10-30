#!/usr/bin/env node
/**
 * scripts/actualizar-constancia-v1.3.js
 *
 * Pasa la Constancia de aprobacion de la v1.2 a la v1.3.
 *
 * POR QUE ES UN SCRIPT Y NO UNA EDICION A MANO
 * ---------------------------------------------
 * La Constancia nombra la version del Acuerdo en diecisiete lugares (titulo,
 * encabezado, tablas, parrafos). Editarlos a mano deja alguno en v1.2 y el
 * documento dice una cosa y su tabla otra. Ademas hay DOS copias (legal/ y
 * sitio/) que tienen que quedar byte a byte identicas.
 *
 * QUE TOCA
 * --------
 *   - "v1.2" -> "v1.3"  (solo las apariciones del Acuerdo; la antecedente v1.1
 *     y el enlace al Anexo de Nube v1.0 no se tocan porque no son de este texto)
 *   - la fecha del documento: 27 -> 30 de octubre de 2026
 *
 * QUE NO TOCA
 * -----------
 * La huella del texto NO se llena: la Constancia se llena cuando el abogado
 * aprueba y el owner autoriza la publicacion, y ese campo se diligencia en ese
 * momento. La huella que se aprueba se da en la nota al abogado.
 *
 * Uso:
 *   node scripts/actualizar-constancia-v1.3.js
 *
 * Exit codes:
 *   0 = actualizada y sincronizada
 *   3 = error
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SERVICE_ROOT = path.resolve(__dirname, '..');
const APP_ROOT = path.resolve(SERVICE_ROOT, '..');
const REPO_ROOT = path.resolve(APP_ROOT, '..');
const ORIGINAL = path.join(APP_ROOT, 'legal', 'constancia-aprobacion-acuerdo.html');
const COPIA = path.join(REPO_ROOT, 'sitio', 'constancia-aprobacion-acuerdo.html');

function error(msg) {
  const e = new Error(msg);
  e.codigo = 3;
  return e;
}

/**
 * Cuenta los finales de linea para poder comprobarlos despues.
 * @param {string} s
 * @returns {{crlf: number, lf: number}}
 */
function finales(s) {
  return { crlf: (s.match(/\r\n/g) || []).length, lf: (s.match(/\n/g) || []).length };
}

function main() {
  if (!fs.existsSync(ORIGINAL)) throw error('No existe ' + ORIGINAL);
  const original = fs.readFileSync(ORIGINAL, 'utf8');
  const eolAntes = finales(original);

  let s = original;

  // 1. La version del Acuerdo.
  const apariciones = (s.match(/v1\.2/g) || []).length;
  if (apariciones === 0) throw error('El documento no menciona v1.2: quizas ya esta actualizado.');
  s = s.split('v1.2').join('v1.3');

  // 2. La fecha del documento.
  s = s.split('2026-10-27').join('2026-10-30');
  s = s.split('27 de octubre de 2026').join('30 de octubre de 2026');

  // 3. El EOL no puede cambiar: se comprueba antes de escribir.
  const eolDespues = finales(s);
  if (eolDespues.crlf !== eolAntes.crlf || eolDespues.lf !== eolAntes.lf) {
    throw error('El EOL cambio: antes CRLF=' + eolAntes.crlf + ' LF=' + eolAntes.lf
      + ', despues CRLF=' + eolDespues.crlf + ' LF=' + eolDespues.lf + '.');
  }

  // 4. Sin caracteres CJK, cirilicos ni hangul.
  const prohibidos = new Set();
  for (const c of s) {
    const q = c.codePointAt(0);
    if ((q >= 0x4e00 && q <= 0x9fff) || (q >= 0x0400 && q <= 0x04ff) || (q >= 0xac00 && q <= 0xd7af)) {
      prohibidos.add('U+' + q.toString(16));
    }
  }
  if (prohibidos.size) throw error('El documento quedo con caracteres prohibidos: ' + [...prohibidos].join(', '));

  fs.writeFileSync(ORIGINAL, s, 'utf8');
  fs.writeFileSync(COPIA, s, 'utf8');

  const huella = crypto.createHash('sha256').update(s, 'utf8').digest('hex');
  console.log('Constancia actualizada a la v1.3.');
  console.log('  apariciones de v1.2 reemplazadas: ' + apariciones);
  console.log('  EOL conservado: CRLF=' + eolDespues.crlf + ' LF=' + eolDespues.lf);
  console.log('  bytes: ' + Buffer.byteLength(s, 'utf8'));
  console.log('  SHA-256: ' + huella);
  console.log('  copia en sitio/ sincronizada byte a byte.');
}

try {
  main();
} catch (err) {
  console.error('ERROR: ' + err.message);
  process.exit(err.codigo || 3);
}
