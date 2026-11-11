#!/usr/bin/env node
'use strict';

/**
 * scripts/completar-constancia-v1.6.js
 *
 * Completa los DOS campos que el owner autorizo en la Constancia de version y
 * autorizacion de publicacion (A4) del Acuerdo v1.6, sobre las DOS copias del
 * documento:
 *
 *   sgsst-electron-app/legal/constancia-aprobacion-acuerdo.html
 *   sitio/constancia-aprobacion-acuerdo.html
 *
 * QUE COMPLETA
 * -------------
 *   D1  Fila "Representante legal responsable del registro" del §1:
 *       "Javier Robles Fontalvo, Representante Legal de Gesstiar S.A.S."
 *       Es la MISMA formula que usa la aprobacion operativa de la v1.0 en la
 *       base (gh_firma_aprobaciones_publicacion). La confirmo el owner el
 *       11-nov-2026.
 *   D2  Fila "Fecha del registro" del §1: "2026-11-11".
 *   D3  La frase del §1 que decia que los campos "permanecen vacios": si los
 *       campos se llenan, esa frase deja de ser cierta y el documento se
 *       contradiria a si mismo. Se cambia por la que SI describe el estado
 *       real. No se toca ninguna otra frase del documento.
 *
 * QUE NO COMPLETA (y por que)
 * ---------------------------
 *   - El §5 (constancia de la autorizacion operativa) y el §6 (firma del
 *     representante legal) SIGUEN VACIOS. No es un olvido: es el precedente del
 *     repo. La Constancia de la v1.4 -que tiene su autorizacion operativa
 *     registrada en la base- tambien se emitio con el §5 y el §6 vacios
 *     (commit 97c6e2c9: "sgsst-electron-app/legal/constancia-
 *     aprobacion-acuerdo.html", seccion 5 y 6 sin una sola fila con dato).
 *     La autorizacion operativa no vive en este documento: vive en el registro
 *     append-only del servicio (gh_firma_aprobaciones_publicacion, tipo
 *     OPERATIVA). Este script no inventa una firma.
 *   - El estado del manifiesto sigue siendo "no_firmada" por la misma razon.
 *
 * COMO ESTA HECHO
 * ---------------
 *   Reemplazo literal con ancla comprobada: si el texto viejo no existe o
 *   aparece mas de una vez, el script PARA con codigo 3 y no escribe nada.
 *   Cada correccion es idempotente: la segunda corrida no cambia nada.
 *   El EOL no puede cambiar (los dos archivos estan en LF) y el resultado se
 *   comprueba por estructura, no por "el script termino sin error".
 *   Al final se compara el resultado de las dos copias: si difieren, no se
 *   escribe nada.
 *
 * Uso:
 *   node scripts/completar-constancia-v1.6.js
 *
 * Exit codes:
 *   0 = completadas y sincronizadas (o ya completadas)
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
  { etiqueta: 'sitio/' + NOMBRE, ruta: path.join(REPO_ROOT, 'sitio', NOMBRE) },
];

// Los dos datos que completo el owner (confirmados el 11-nov-2026).
const REPRESENTANTE = 'Javier Robles Fontalvo, Representante Legal de Gesstiar S.A.S.';
const FECHA_REGISTRO = '2026-11-11';

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

const D1 = {
  etiqueta: 'D1 §1 Representante legal responsable del registro',
  viejo: lineas(
    '        <td>Representante legal responsable del registro</td>',
    '        <td></td>'
  ),
  nuevo: lineas(
    '        <td>Representante legal responsable del registro</td>',
    '        <td>' + REPRESENTANTE + '</td>'
  ),
};

const D2 = {
  etiqueta: 'D2 §1 Fecha del registro',
  viejo: lineas(
    '        <td>Fecha del registro</td>',
    '        <td></td>'
  ),
  nuevo: lineas(
    '        <td>Fecha del registro</td>',
    '        <td>' + FECHA_REGISTRO + '</td>'
  ),
};

const D3 = {
  etiqueta: 'D3 §1 la frase que decia que los campos quedan vacios',
  viejo: lineas(
    '  y las recomendaciones recibidas se conservan en sus documentos de origen. Los campos permanecen vac&iacute;os',
    '  hasta que el owner los complete con datos comprobados.</p>'
  ),
  nuevo: lineas(
    '  y las recomendaciones recibidas se conservan en sus documentos de origen. Los campos de esta tabla los',
    '  complet&oacute; el owner el 11 de noviembre de 2026 con datos comprobados.</p>'
  ),
};

const CORRECCIONES = [D1, D2, D3];

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
  for (const correccion of CORRECCIONES) r = aplicarUna(r, correccion, informe);
  return r;
}

/* ------------------------------------------------------------------ */
/* Verificacion por estructura                                          */
/* ------------------------------------------------------------------ */

function verificar(s, archivo) {
  const problemas = [];

  // Los dos campos del §1 con el dato del owner.
  if (contar(s, lineas(
    '        <td>Representante legal responsable del registro</td>',
    '        <td>' + REPRESENTANTE + '</td>'
  )) !== 1) {
    problemas.push('el §1 no declara el representante legal responsable del registro');
  }
  if (contar(s, lineas(
    '        <td>Fecha del registro</td>',
    '        <td>' + FECHA_REGISTRO + '</td>'
  )) !== 1) {
    problemas.push('el §1 no declara la fecha del registro');
  }

  // La frase corregida: no puede quedar la de "permanecen vacios".
  if (contar(s, 'Los campos permanecen vac&iacute;os') !== 0) {
    problemas.push('queda la frase que dice que los campos permanecen vacios');
  }
  if (contar(s, 'complet&oacute; el owner el 11 de noviembre de 2026') !== 1) {
    problemas.push('no queda la frase que dice que el owner completo los campos');
  }

  // Lo que NO se toca: el §5 y el §6 siguen vacios (precedente del repo).
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
  const destino = path.join(os.tmpdir(), 'constancia-registro-' + sello + '-' + path.basename(archivo) + '.bak');
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

  console.log('Constancia A4 completada con los datos del registro (11-nov-2026).');
  for (const r of resultados) {
    console.log('  ' + r.copia.etiqueta);
    for (const linea of r.informe) console.log(linea);
    console.log('    ' + (r.cambio ? 'MODIFICADO' : 'sin cambios (ya estaba completo)'));
  }
  console.log('  Las dos copias quedaron byte a byte identicas.');
  console.log('  El §5 y el §6 siguen vacios: la autorizacion operativa consta en el');
  console.log('  registro del servicio (gh_firma_aprobaciones_publicacion, tipo OPERATIVA).');
  console.log('  bytes: ' + Buffer.byteLength(final, 'utf8'));
  console.log('  SHA-256: ' + huella);
}

try {
  main();
} catch (err) {
  console.error('ERROR: ' + err.message);
  process.exit(err.codigo || 3);
}
