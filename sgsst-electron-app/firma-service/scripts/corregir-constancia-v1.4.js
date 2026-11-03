#!/usr/bin/env node
'use strict';

/**
 * scripts/corregir-constancia-v1.4.js
 *
 * Aplica al A4 (Constancia de aprobacion) las correcciones de la revision
 * juridica del 30-oct-2026, sobre las DOS copias del documento:
 *
 *   sgsst-electron-app/legal/constancia-aprobacion-acuerdo.html
 *   sitio/constancia-aprobacion-acuerdo.html
 *
 * Las dos copias tienen que quedar byte a byte identicas: se corrigen con la
 * misma lista de reemplazos literales y al final se compara el resultado.
 *
 * QUE CORRIGE (todo lo que la revision marca como A4)
 * ---------------------------------------------------
 *   C0  La copia de sitio/ todavia hablaba de la v1.3 del Acuerdo. Se
 *       normaliza a v1.4, que es el texto corregido que la revision somete a
 *       aprobacion; la copia de legal/ ya estaba en v1.4.
 *   C1  A4 §1, fila "Alcance": "Capitulos I a XIII" -> "Capitulos I a XII".
 *       El Acuerdo tiene doce capitulos (verificado por el asesor).
 *   C2  A4 §4, parrafo "Antecedente": se sustituye por el texto literal de la
 *       revision. El texto anterior afirmaba que la v1.1 "fue la version
 *       aprobada y publicada", y esa aprobacion no consta en el expediente
 *       revisado.
 *   C3  A4 §1, §5 y §6: los campos de la aprobacion juridica y de la
 *       autorizacion operativa quedan VACIOS y sin texto de reemplazo: se
 *       llenan el dia de cada decision, con su firma.
 *
 * QUE NO CORRIGE (no es del A4)
 * -----------------------------
 *   - El §4 (texto de la aprobacion): la revision no le da texto nuevo; su
 *     redaccion se conserva y lo que se deja vacio son los campos.
 *   - El Anexo de Nube sin firmar (C-1), el §3.6(h) del Acuerdo, la
 *     trazabilidad del manifiesto (J14-5) y el cuadro de 96 puntos: son de
 *     otros documentos y no se tocan.
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
 *   node scripts/corregir-constancia-v1.4.js
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
  return { crlf: cr, cr: cr, lf: (s.match(/\n/g) || []).length - crlf };
}

/* ------------------------------------------------------------------ */
/* Las correcciones                                                    */
/* ------------------------------------------------------------------ */

// C1 - A4 §1, fila "Alcance".
const C1 = {
  etiqueta: 'C1 §1 Alcance: capitulos I a XII',
  viejo: 'con sus Cap&iacute;tulos I a XIII',
  nuevo: 'con sus Cap&iacute;tulos I a XII'
};

// C2 - A4 §4, parrafo "Antecedente": texto literal de la revision.
const C2_NUEVO = lineas(
  '  <p><strong>Antecedente.</strong> La versi&oacute;n v1.1 del Acuerdo de uso (huella SHA-256',
  '  09d69065b60000bb215be8f28fd67d0fb6fad7d32cb5a8e9c3afb45d817123d2) fue la candidata sometida a',
  '  revisi&oacute;n el 27 de octubre de 2026; su aprobaci&oacute;n y su autorizaci&oacute;n operativa constan,',
  '  en su caso, en la constancia propia de esa versi&oacute;n, que el owner debe incorporar a este',
  '  expediente. Si no existe esa constancia, esta Constancia se abre sin antecedente y sin overwrite.</p>'
);

// Los dos textos que el script acepta como "viejo" del antecedente:
// el que traia la copia publicada (v1.3) y el que dejo el script del padre
// en la copia de legal/ (mismo sentido, redaccion propia).
const C2_VIEJOS = [
  lineas(
    '  <p><strong>Antecedente.</strong> La versi&oacute;n v1.1 del Acuerdo de uso fue la versi&oacute;n aprobada y',
    '  publicada, con la huella SHA-256',
    '  09d69065b60000bb215be8f28fd67d0fb6fad7d32cb5a8e9c3afb45d817123d2. Esa aprobaci&oacute;n y su autorizaci&oacute;n',
    '  operativa quedan en su propia constancia y no se sobrescriben con esta: esta constancia es la de la v1.3, y',
    '  solo se llena con la aprobaci&oacute;n jur&iacute;dica y, por separado, con la autorizaci&oacute;n operativa de la',
    '  v1.3, cuando el owner las tome con la autorizaci&oacute;n real.</p>'
  ),
  lineas(
    '  <p><strong>Antecedente.</strong> La versi&oacute;n v1.1 del Acuerdo de uso (huella SHA-256 09d69065b60000bb215be8f28fd67d0fb6fad7d32cb5a8e9c3afb45d817123d2) fue la candidata sometida a revisi&oacute;n el 27 de octubre de 2026; su aprobaci&oacute;n y su autorizaci&oacute;n operativa constan, en su caso, en la constancia propia de esa versi&oacute;n, que el owner debe incorporar a este expediente. Si no existe esa constancia, esta Constancia se abre sin antecedente y sin sobrescribir una versi&oacute;n anterior.</p>'
  )
];

// C3 - A4 §1, §5 y §6: los campos de aprobacion y de autorizacion operativa
// quedan vacios. Sin texto de reemplazo: se llenan el dia de cada decision.
const C3 = [
  {
    etiqueta: 'C3 §1 Version aprobada: vacia',
    viejo: lineas(
      '        <td>Versi&oacute;n aprobada</td>',
      '        <td>v1.4 &mdash; pendiente de aprobaci&oacute;n jur&iacute;dica</td>'
    ),
    nuevo: lineas(
      '        <td>Versi&oacute;n aprobada</td>',
      '        <td></td>'
    )
  },
  {
    etiqueta: 'C3 §1 Huella SHA-256 del texto aprobado: vacia',
    viejo: lineas(
      '        <td>Huella SHA-256 del texto aprobado</td>',
      '        <td>[huella SHA-256 del texto de la v1.4: se registra cuando el texto quede aprobado y se le calcule la',
      '        huella]</td>'
    ),
    nuevo: lineas(
      '        <td>Huella SHA-256 del texto aprobado</td>',
      '        <td></td>'
    )
  },
  {
    etiqueta: 'C3 §1 Aprobador: vacio',
    viejo: lineas(
      '        <td>Aprobador</td>',
      '        <td>[nombre y cargo de quien aprueba el contenido jur&iacute;dico]</td>'
    ),
    nuevo: lineas(
      '        <td>Aprobador</td>',
      '        <td></td>'
    )
  },
  {
    etiqueta: 'C3 §1 Fecha de la aprobacion juridica: vacia',
    viejo: lineas(
      '        <td>Fecha de la aprobaci&oacute;n jur&iacute;dica</td>',
      '        <td>[fecha]</td>'
    ),
    nuevo: lineas(
      '        <td>Fecha de la aprobaci&oacute;n jur&iacute;dica</td>',
      '        <td></td>'
    )
  },
  {
    etiqueta: 'C3 §5 Version y huella autorizadas: vacia',
    viejo: lineas(
      '        <td>Versi&oacute;n y huella autorizadas</td>',
      '        <td>v1.4 &middot; [huella SHA-256 del texto autorizado: se registra con la autorizaci&oacute;n operativa,',
      '        cuando exista]</td>'
    ),
    nuevo: lineas(
      '        <td>Versi&oacute;n y huella autorizadas</td>',
      '        <td></td>'
    )
  },
  {
    etiqueta: 'C3 §5 Garantia tecnica verificada: vacia',
    viejo: lineas(
      '        <td>Garant&iacute;a t&eacute;cnica verificada</td>',
      '        <td>[las tres comprobaciones del numeral 3, con su resultado]</td>'
    ),
    nuevo: lineas(
      '        <td>Garant&iacute;a t&eacute;cnica verificada</td>',
      '        <td></td>'
    )
  },
  {
    etiqueta: 'C3 §5 Persona que autoriza el despliegue: vacia',
    viejo: lineas(
      '        <td>Persona que autoriza el despliegue</td>',
      '        <td>[nombre y cargo]</td>'
    ),
    nuevo: lineas(
      '        <td>Persona que autoriza el despliegue</td>',
      '        <td></td>'
    )
  },
  {
    etiqueta: 'C3 §5 Fecha de la decision: vacia',
    viejo: lineas(
      '        <td>Fecha de la decisi&oacute;n</td>',
      '        <td>[fecha]</td>'
    ),
    nuevo: lineas(
      '        <td>Fecha de la decisi&oacute;n</td>',
      '        <td></td>'
    )
  },
  {
    etiqueta: 'C3 §5 Observaciones: vacia',
    viejo: lineas(
      '        <td>Observaciones</td>',
      '        <td>[condiciones, plazos o salvedades]</td>'
    ),
    nuevo: lineas(
      '        <td>Observaciones</td>',
      '        <td></td>'
    )
  },
  {
    etiqueta: 'C3 §6 fila 1 (aprobacion juridica): vacia',
    viejo: lineas(
      '        <td>Aprobaci&oacute;n jur&iacute;dica del texto de la v1.4</td>',
      '        <td>[nombre y cargo]</td>',
      '        <td>[firma]</td>',
      '        <td>[fecha]</td>'
    ),
    nuevo: lineas(
      '        <td>Aprobaci&oacute;n jur&iacute;dica del texto de la v1.4</td>',
      '        <td></td>',
      '        <td></td>',
      '        <td></td>'
    )
  },
  {
    etiqueta: 'C3 §6 fila 2 (autorizacion operativa): vacia',
    viejo: lineas(
      '        <td>Autorizaci&oacute;n operativa de la publicaci&oacute;n de la v1.4</td>',
      '        <td>[nombre y cargo]</td>',
      '        <td>[firma]</td>',
      '        <td>[fecha]</td>'
    ),
    nuevo: lineas(
      '        <td>Autorizaci&oacute;n operativa de la publicaci&oacute;n de la v1.4</td>',
      '        <td></td>',
      '        <td></td>',
      '        <td></td>'
    )
  }
];

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

function aplicarAntecedente(s, informe) {
  if (contar(s, C2_NUEVO) === 1) {
    informe.push('    ya estaba C2 §4 Antecedente (texto literal de la revision)');
    return s;
  }
  let viejo = null;
  for (const cand of C2_VIEJOS) {
    const n = contar(s, cand);
    if (n === 1) { viejo = cand; break; }
    if (n > 1) throw error('C2 §4 Antecedente: un texto viejo aparece ' + n + ' veces (se esperaba 1).');
  }
  if (!viejo) throw error('C2 §4 Antecedente: no se encontro ningun texto viejo conocido.');
  const at = s.indexOf(viejo);
  informe.push('    aplicado  C2 §4 Antecedente: texto literal de la revision');
  return s.slice(0, at) + C2_NUEVO + s.slice(at + viejo.length);
}

function aplicarVersion(s, informe) {
  const n = contar(s, 'v1.3');
  if (n === 0) {
    if (contar(s, 'v1.4') === 0) throw error('C0: el documento no menciona ni v1.3 ni v1.4 del Acuerdo.');
    informe.push('    ya estaba C0 version del Acuerdo en v1.4');
    return s;
  }
  informe.push('    aplicado  C0 version del Acuerdo: v1.3 -> v1.4 (' + n + ' apariciones)');
  return s.split('v1.3').join('v1.4');
}

/* ------------------------------------------------------------------ */
/* Verificacion por estructura                                          */
/* ------------------------------------------------------------------ */

function verificar(s, archivo) {
  const problemas = [];
  if (contar(s, 'Cap&iacute;tulos I a XIII') !== 0) problemas.push('sigue el texto "Capitulos I a XIII"');
  if (contar(s, C2_NUEVO) !== 1) problemas.push('el parrafo de antecedente no es el texto literal de la revision');
  if (contar(s, 'v1.3') !== 0) problemas.push('queda alguna mencion de la v1.3');
  const vacias = contar(s, '<td></td>');
  if (vacias !== 15) problemas.push('se esperaban 15 celdas vacias y hay ' + vacias);
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
    let s = antes;

    // El orden importa: el parrafo de antecedente viejo menciona la v1.3, y
    // se cambia antes de normalizar la version.
    s = aplicarAntecedente(s, informe);
    s = aplicarVersion(s, informe);
    s = aplicarUna(s, C1, informe);
    for (const correccion of C3) s = aplicarUna(s, correccion, informe);

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

  console.log('Constancia A4 corregida (revision juridica 30-oct-2026).');
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
