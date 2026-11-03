#!/usr/bin/env node
/**
 * scripts/guardar-revision-juridica.js
 *
 * Guarda la revision del abogado como documento del repositorio, sin los
 * caracteres no latinos que el abogado envio por error.
 *
 * POR QUE HAY QUE LIMPIARLO
 * --------------------------
 * En K+AIR esta prohibido que entren caracteres CJK, cirilicos o hangul en el
 * codigo y en la documentacion: se cuelan por las rutas y nadie los lee en el
 * borrador. La revision del 30-oct-2026 trae SIETE, en tres lineas: la 128
 * (dos), la 136 (tres) y la 248 (dos). Verificado contra el original, que
 * esta en los adjuntos del mensaje del 30-oct-2026, 18:39.
 *
 * NO SE CAMBIA NADA MAS
 * ---------------------
 * El texto del abogado es literal: se copia tal cual, byte a byte, y solo se
 * retiran los caracteres no latinos. El script REPORTA exactamente lo que
 * retiro (posicion, linea y code point), para que la limpieza sea auditable
 * y no una edicion silenciosa.
 *
 * USO
 * ---
 *   node scripts/guardar-revision-juridica.js --origen=ruta.txt --salida=ruta.txt
 *
 * Exit codes:
 *   0 = copia guardada
 *   3 = error (falta el origen, o el destino quedaria con caracteres no latinos)
 */
'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SALIDA_DEFAULT = path.join(
  REPO_ROOT, 'docs', 'gestion-humana', 'firma-electronica',
  'revision-juridica-abogado-2026-10-30.txt'
);

// Los tres rangos que el barrido del repo prohibe.
const RANGOS = [
  [0x4e00, 0x9fff],   // CJK Unified Ideographs
  [0x3400, 0x4dbf],   // CJK Extension A
  [0xac00, 0xd7af],   // Hangul Syllables
  [0x0400, 0x04ff],   // Cirlico
  [0x1100, 0x11ff],   // Hangul Jamo
  [0x3130, 0x318f],   // Hangul Compatibility Jamo
];

function esProhibido(cp) {
  return RANGOS.some((r) => cp >= r[0] && cp <= r[1]);
}

function main() {
  const args = process.argv.slice(2);
  let origen = null;
  let salida = SALIDA_DEFAULT;
  for (const a of args) {
    if (a.startsWith('--origen=')) origen = a.slice('--origen='.length).trim();
    else if (a.startsWith('--salida=')) salida = path.resolve(a.slice('--salida='.length).trim());
    else {
      console.error('Argumento desconocido: ' + a);
      process.exit(2);
    }
  }
  if (!origen) {
    console.error('Falta --origen= con la ruta del archivo recibido.');
    process.exit(2);
  }
  if (!fs.existsSync(origen)) {
    console.error('No existe el origen: ' + origen);
    process.exit(3);
  }

  const crudo = fs.readFileSync(origen, 'utf8');
  const lineas = crudo.split('\n');

  // 1. Reportar y retirar.
  const retirados = [];
  let limpio = '';
  let linea = 1;
  for (const ch of crudo) {
    const cp = ch.codePointAt(0);
    if (ch === '\n') linea++;
    if (esProhibido(cp)) {
      retirados.push({ linea: linea, cp: 'U+' + cp.toString(16).toUpperCase(), char: ch });
      continue;
    }
    limpio += ch;
  }

  // 2. El resultado no puede quedar con caracteres no latinos.
  const noAscii = (limpio.match(/[^\x00-\x7F]/g) || []).length;
  const quedanProhibidos = [...limpio].filter((c) => esProhibido(c.codePointAt(0)));
  if (quedanProhibidos.length) {
    console.error('El destino todavia tiene ' + quedanProhibidos.length + ' caracteres prohibidos.');
    process.exit(3);
  }

  // 3. Escribir. Se conserva el fin de linea del original: el texto se cambia
  //    de contenido, nunca de formato.
  fs.writeFileSync(salida, limpio, 'utf8');

  console.log('Revision guardada: ' + salida);
  console.log('  bytes: ' + Buffer.byteLength(limpio, 'utf8') + ' | lineas: ' + lineas.length);
  console.log('  caracteres no latinos (cirilico, hangul, CJK): ' + noAscii);
  console.log('  retirement: ' + retirados.length);
  retirados.forEach((r) => {
    console.log('    linea ' + r.linea + ': ' + r.cp);
  });
  if (retirados.length) {
    console.log('  (lo unico que se retiro del texto del abogado: esos caracteres. '
      + 'El resto es literal.)');
  }
}

try {
  main();
} catch (err) {
  console.error('ERROR: ' + err.message);
  process.exit(err.codigo || 3);
}
