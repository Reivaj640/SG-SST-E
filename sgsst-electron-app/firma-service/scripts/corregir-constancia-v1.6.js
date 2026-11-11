#!/usr/bin/env node
'use strict';

/**
 * scripts/corregir-constancia-v1.6.js
 *
 * Reemite la Constancia de version y autorizacion de publicacion (A4) contra
 * la version v1.6 del Acuerdo de uso, sobre las DOS copias del documento:
 *
 *   sgsst-electron-app/legal/constancia-aprobacion-acuerdo.html
 *   sitio/constancia-aprobacion-acuerdo.html
 *
 * Las dos copias tienen que quedar byte a byte identicas: se corrigen con la
 * misma lista de reemplazos literales y al final se compara el resultado.
 *
 * QUE CORRIGE
 * ------------
 *   C1  Todas las menciones de la version del Acuerdo "v1.4" pasan a "v1.6".
 *       Se revisan una por una: el titulo, el subtitulo, el alcance, el
 *       registro del owner y las filas de firma.
 *   C2  La fecha "3 de noviembre de 2026" pasa a "11 de noviembre de 2026" en
 *       las dos apariciones (cabecera y pie).
 *   C3  El <meta name="version"> pasa de "2026-11-03" a "2026-11-11", junto
 *       con la version visible de la misma linea de fecha.
 *   C4  La fila "Version identificada" del §1 se llena con "v1.6": es un
 *       registro de version, no una aprobacion (el parrafo de arriba del §1
 *       lo dice y el §5 sigue vacio).
 *   C5  La fila "Huella SHA-256 del texto identificado" del §1 se llena con
 *       la huella REAL de la v1.6, calculada sobre el texto construido.
 *
 * QUE NO CORRIGE
 * ---------------
 *   - Las referencias historicas: "la version v1.1" (con su huella) y el
 *     enlace del menu "anexo-nube-v1.0.html" no se tocan.
 *   - La fila "Version y huella autorizadas" del §5: la llena el owner cuando
 *     autorice, y hoy sigue vacia.
 *   - La tabla de firma del §6: sus celdas siguen vacias. Esta Constancia
 *     sigue SIN FIRMAR: no se inventa fecha de aprobacion ni firma.
 *
 * COMO ESTA HECHO
 * ---------------
 *   Reemplazo literal con ancla comprobada: si el texto viejo no existe o
 *   aparece mas de una vez, el script PARA con codigo 3 y no escribe nada.
 *   Cada correccion es idempotente: la segunda corrida no cambia nada.
 *   El EOL no puede cambiar (los dos archivos estan en LF) y el resultado se
 *   comprueba por estructura, no por "el script termino sin error".
 *
 * Uso:
 *   node scripts/corregir-constancia-v1.6.js
 *
 * Exit codes:
 *   0 = corregidas y sincronizadas (o ya corregidas)
 *   3 = error
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const APP_ROOT = path.resolve(__dirname, '..', '..');
const REPO_ROOT = path.resolve(APP_ROOT, '..');
const NOMBRE = 'constancia-aprobacion-acuerdo.html';
const COPIAS = [
  { etiqueta: 'sgsst-electron-app/legal/' + NOMBRE, ruta: path.join(APP_ROOT, 'legal', NOMBRE) },
  { etiqueta: 'sitio/' + NOMBRE, ruta: path.join(REPO_ROOT, 'sitio', NOMBRE) }
];

// Huella SHA-256 REAL del texto de la v1.6 del Acuerdo de uso
// (scripts/fixtures/acuerdo-v1.6.txt). No es una plantilla: es el valor
// medido sobre el archivo construido.
const HUELLA_V16 = '08e1eb8b09449fbc57eebdda89518482b0063285d2f0f56ed335d2977532f13e';

function error(msg) {
  const e = new Error(msg);
  e.codigo = 3;
  return e;
}

function lineas() {
  return Array.prototype.slice.call(arguments).join('\n');
}

function contar(s, sub) {
  if (!sub) return 0;
  let n = 0;
  let i = 0;
  while ((i = s.indexOf(sub, i)) !== -1) {
    n++;
    i += sub.length;
  }
  return n;
}

function finales(s) {
  const crlf = (s.match(/\r\n/g) || []).length;
  const cr = (s.match(/\r/g) || []).length - crlf;
  return { crlf: crlf, cr: cr, lf: (s.match(/\n/g) || []).length - crlf };
}

/* ------------------------------------------------------------------ */
/* Las correcciones                                                    */
/* ------------------------------------------------------------------ */

// C1 - cada mencion de la version del Acuerdo, revisada una por una.
const C1 = [
  {
    etiqueta: 'C1 titulo: Acuerdo de uso v1.4 -> v1.6',
    viejo: '<title>Constancia de versi&oacute;n y autorizaci&oacute;n de publicaci&oacute;n &mdash; Acuerdo de uso v1.4 &middot; K+AIR</title>',
    nuevo: '<title>Constancia de versi&oacute;n y autorizaci&oacute;n de publicaci&oacute;n &mdash; Acuerdo de uso v1.6 &middot; K+AIR</title>'
  },
  {
    etiqueta: 'C1 subtitulo: version v1.4 -> v1.6',
    viejo: 'Acuerdo de uso, versi&oacute;n v1.4</p>',
    nuevo: 'Acuerdo de uso, versi&oacute;n v1.6</p>'
  },
  {
    etiqueta: 'C1 §2 alcance: publicar la version v1.4 -> v1.6',
    viejo: 'publicar la versi&oacute;n v1.4 en producci&oacute;n',
    nuevo: 'publicar la versi&oacute;n v1.6 en producci&oacute;n'
  },
  {
    etiqueta: 'C1 §3 garantia tecnica: publicar la version v1.4 -> v1.6',
    viejo: 'publicar la versi&oacute;n v1.4 se exige lo siguiente.',
    nuevo: 'publicar la versi&oacute;n v1.6 se exige lo siguiente.'
  },
  {
    etiqueta: 'C1 §4 registro del owner: version v1.4 -> v1.6',
    viejo: 'Registro del owner sobre la versi&oacute;n v1.4 y, solo cuando se cumplan sus condiciones, su',
    nuevo: 'Registro del owner sobre la versi&oacute;n v1.6 y, solo cuando se cumplan sus condiciones, su'
  },
  {
    etiqueta: 'C1 §4 publicacion: version v1.4 -> v1.6',
    viejo: 'La publicaci&oacute;n de la versi&oacute;n v1.4 queda condicionada',
    nuevo: 'La publicaci&oacute;n de la versi&oacute;n v1.6 queda condicionada'
  },
  {
    etiqueta: 'C1 §5 antes de la autorizacion: version v1.4 -> v1.6',
    viejo: 'verificada. Antes de eso, la versi&oacute;n v1.4 no se publica.',
    nuevo: 'verificada. Antes de eso, la versi&oacute;n v1.6 no se publica.'
  },
  {
    etiqueta: 'C1 §6 fila de firma: publicacion de la v1.4 -> v1.6',
    viejo: '<td>Autorizaci&oacute;n operativa de la publicaci&oacute;n de la v1.4</td>',
    nuevo: '<td>Autorizaci&oacute;n operativa de la publicaci&oacute;n de la v1.6</td>'
  }
];

// C2 - la fecha en las dos apariciones (cabecera y pie).
const C2 = [
  {
    etiqueta: 'C2 fecha de la cabecera: 3 -> 11 de noviembre de 2026',
    viejo: '  <p class="fecha">&Uacute;ltima actualizaci&oacute;n: 3 de noviembre de 2026 &middot; Versi&oacute;n 2026-11-03</p>',
    nuevo: '  <p class="fecha">&Uacute;ltima actualizaci&oacute;n: 11 de noviembre de 2026 &middot; Versi&oacute;n 2026-11-11</p>'
  },
  {
    etiqueta: 'C2 fecha del pie: 3 -> 11 de noviembre de 2026',
    viejo: 'Documento actualizado el 3 de noviembre de 2026</p>',
    nuevo: 'Documento actualizado el 11 de noviembre de 2026</p>'
  }
];

// C3 - el meta de version.
const C3 = {
  etiqueta: 'C3 meta version: 2026-11-03 -> 2026-11-11',
  viejo: '<meta name="version" content="2026-11-03">',
  nuevo: '<meta name="version" content="2026-11-11">'
};

// C4 - §1, fila "Version identificada": la v1.6. Es un registro de version,
// no una aprobacion: por eso el §5 (version autorizada) sigue vacio.
const C4 = {
  etiqueta: 'C4 §1 Version identificada: v1.6',
  viejo: lineas(
    '        <td>Versi&oacute;n identificada</td>',
    '        <td></td>'
  ),
  nuevo: lineas(
    '        <td>Versi&oacute;n identificada</td>',
    '        <td>v1.6</td>'
  )
};

// C5 - §1, fila "Huella SHA-256 del texto identificado": la huella real.
const C5 = {
  etiqueta: 'C5 §1 Huella SHA-256 del texto identificado: huella real de la v1.6',
  viejo: lineas(
    '        <td>Huella SHA-256 del texto identificado</td>',
    '        <td></td>'
  ),
  nuevo: lineas(
    '        <td>Huella SHA-256 del texto identificado</td>',
    '        <td>' + HUELLA_V16 + '</td>'
  )
};

/* ------------------------------------------------------------------ */
/* Aplicacion                                                           */
/* ------------------------------------------------------------------ */

function aplicarUna(s, correccion, informe) {
  const viejo = correccion.viejo;
  const nuevo = correccion.nuevo;
  const n = contar(s, viejo);
  if (n === 1) {
    const at = s.indexOf(viejo);
    informe.push('    aplicado  ' + correccion.etiqueta);
    return s.slice(0, at) + nuevo + s.slice(at + viejo.length);
  }
  if (n === 0) {
    if (contar(s, nuevo) === 1) {
      informe.push('    ya estaba ' + correccion.etiqueta);
      return s;
    }
    throw error(correccion.etiqueta + ': el texto viejo no existe y el texto nuevo tampoco.');
  }
  throw error(correccion.etiqueta + ': el texto viejo aparece ' + n + ' veces (se esperaba 1).');
}

function aplicarTodas(s, informe) {
  let r = s;
  for (const correccion of C1) r = aplicarUna(r, correccion, informe);
  for (const correccion of C2) r = aplicarUna(r, correccion, informe);
  r = aplicarUna(r, C3, informe);
  r = aplicarUna(r, C4, informe);
  r = aplicarUna(r, C5, informe);
  return r;
}

/* ------------------------------------------------------------------ */
/* Verificacion por estructura                                          */
/* ------------------------------------------------------------------ */

function verificar(s, archivo) {
  const problemas = [];

  // No debe quedar ninguna mencion de la v1.4 del Acuerdo.
  if (contar(s, 'v1.4') !== 0) problemas.push('queda alguna mencion de la v1.4');

  // Las referencias historicas se conservan tal cual.
  if (contar(s, 'v1.1') < 1) problemas.push('no queda la referencia historica a la v1.1');
  if (contar(s, 'anexo-nube-v1.0.html') !== 1) problemas.push('el enlace al Anexo de nube no esta intacto');

  // La fecha y la version.
  if (contar(s, '2026-11-03') !== 0) problemas.push('queda la version 2026-11-03');
  if (contar(s, '3 de noviembre de 2026') !== 0) problemas.push('queda la fecha 3 de noviembre de 2026');
  if (contar(s, '<meta name="version" content="2026-11-11">') !== 1) problemas.push('el meta version no es 2026-11-11');
  if (contar(s, '11 de noviembre de 2026') !== 2) problemas.push('la fecha 11 de noviembre de 2026 no esta en las dos apariciones');

  // El §1 registra la v1.6 y su huella real.
  if (contar(s, lineas('        <td>Versi&oacute;n identificada</td>', '        <td>v1.6</td>')) !== 1) {
    problemas.push('el §1 no registra la v1.6');
  }
  if (contar(s, lineas('        <td>Huella SHA-256 del texto identificado</td>', '        <td>' + HUELLA_V16 + '</td>')) !== 1) {
    problemas.push('el §1 no registra la huella real de la v1.6');
  }

  // Lo que NO se toca: el §5 y el §6 siguen vacios (Constancia sin firmar).
  if (contar(s, lineas('        <td>Versi&oacute;n y huella autorizadas</td>', '        <td></td>')) !== 1) {
    problemas.push('la fila "Version y huella autorizadas" del §5 no esta vacia');
  }
  if (contar(s, lineas(
    '        <td>Autorizaci&oacute;n operativa de la publicaci&oacute;n de la v1.6</td>',
    '        <td></td>',
    '        <td></td>',
    '        <td></td>'
  )) !== 1) {
    problemas.push('la tabla de firma del §6 no esta vacia');
  }

  // Ni marcadores de plantilla ni caracteres no ASCII.
  const marcadores = [
    '[huella SHA-256',
    '[nombre y cargo',
    '[firma]',
    '[fecha]',
    '[las tres comprobaciones',
    '[condiciones, plazos',
    'pendiente de aprobaci&oacute;n jur&iacute;dica'
  ];
  for (const m of marcadores) {
    if (contar(s, m) !== 0) problemas.push('queda el marcador ' + m);
  }
  for (let i = 0; i < s.length; i++) {
    const q = s.codePointAt(i);
    if (q > 127) {
      problemas.push('caracter no ASCII U+' + q.toString(16).toUpperCase() + ' en la posicion ' + i);
      break;
    }
  }

  const eol = finales(s);
  if (eol.crlf !== 0 || eol.cr !== 0) problemas.push('el EOL cambio: hay CRLF o CR');

  if (problemas.length) {
    throw error('Verificacion fallo en ' + archivo + ': ' + problemas.join(' | '));
  }
}

function respaldar(archivo, contenido) {
  const sello = new Date().toISOString().replace(/[:.]/g, '-');
  const destino = path.join(os.tmpdir(), 'constancia-' + sello + '-' + path.basename(archivo) + '.bak');
  fs.writeFileSync(destino, contenido, 'utf8');
  return destino;
}

/* ------------------------------------------------------------------ */

function main() {
  const resultados = [];
  for (const copia of COPIAS) {
    if (!fs.existsSync(copia.ruta)) throw error('No existe ' + copia.ruta);
    const antes = fs.readFileSync(copia.ruta, 'utf8');
    const eolAntes = finales(antes);
    if (eolAntes.crlf !== 0 || eolAntes.cr !== 0) {
      throw error(copia.etiqueta + ': el archivo no esta en LF puro; no se toca.');
    }
    const informe = [];
    const s = aplicarTodas(antes, informe);

    verificar(s, copia.etiqueta);

    const cambio = s !== antes;
    if (cambio) {
      const respaldo = respaldar(copia.ruta, antes);
      fs.writeFileSync(copia.ruta, s, 'utf8');
      informe.push('    respaldo: ' + respaldo);
    }
    resultados.push({ copia: copia, antes: antes, despues: s, cambio: cambio, informe: informe });
  }

  if (resultados[0].despues !== resultados[1].despues) {
    throw error('Las dos copias no quedaron byte a byte identicas.');
  }

  const final = resultados[0].despues;
  const huella = crypto.createHash('sha256').update(final, 'utf8').digest('hex');

  console.log('Constancia A4 reemitida contra la v1.6 del Acuerdo.');
  for (const r of resultados) {
    console.log('  ' + r.copia.etiqueta);
    for (const linea of r.informe) console.log(linea);
    console.log('    ' + (r.cambio ? 'MODIFICADO' : 'sin cambios (ya estaba corregido)'));
  }
  console.log('  Las dos copias quedaron byte a byte identicas.');
  console.log('  bytes: ' + Buffer.byteLength(final, 'utf8'));
  console.log('  SHA-256: ' + huella);
}

try {
  main();
} catch (err) {
  console.error('ERROR: ' + err.message);
  process.exit(err.codigo || 3);
}
