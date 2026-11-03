/**
 * contar-estados-checklist.js
 *
 * Verificador aritmetico del cuadro de respuesta al checklist de cierre.
 *
 * QUE HACE
 * --------
 * 1. Lee la respuesta al checklist (docs/gestion-humana/firma-electronica/
 *    respuesta-checklist-cierre-2026-10-30.md) desde una ruta relativa a este
 *    archivo (no hay rutas absolutas: cambiar de maquina no rompe nada).
 * 2. Parsea los encabezados de requisito (formato "**X.Y - texto - ESTADO.**",
 *    con "**6.5 a 6.9 - ...**" como un encabezado que cubre cinco IDs).
 * 3. Cuenta por seccion: cerrados, pendientes, no aplica y total.
 * 4. Verifica que existan EXACTAMENTE 96 requisitos y que sean los IDs
 *    1.1-1.9, 2.1-2.12, 3.1-3.13, 4.1-4.14, 5.1-5.11, 6.1-6.12, 7.1-7.15 y
 *    8.1-8.10. Si falta o sobra uno, sale con codigo distinto de 0.
 * 5. Regenera el bloque de la tabla resumen ("| Seccion | Cerrados | ... |" hasta
 *    la fila "**TOTAL**") y la frase de conciliacion de los pendientes. Los
 *    numeros NO se escriben a mano: salen del conteo real de las filas.
 *
 * INTERFAZ
 * --------
 *   node contar-estados-checklist.js             Verifica (solo lectura).
 *                                                 Codigo 0 si el documento
 *                                                 cuadra; distinto de 0 si no.
 *   node contar-estados-checklist.js --escribir  Regenera la tabla y la frase
 *                                                 de conciliacion en el
 *                                                 documento. Es idempotente:
 *                                                 la segunda corrida no cambia
 *                                                 el archivo.
 *   node contar-estados-checklist.js --ayuda     Esta ayuda.
 *
 * La tabla tiene cinco columnas: Cerrados, Pendientes, No aplica y Total. La
 * columna "No aplica" esta porque el propio documento define ese estado; si
 * hoy no hay ninguno, la columna muestra 0 y la fila sigue cuadrando.
 *
 * REGLA DE CLASIFICACION
 * ----------------------
 * El estado es la ultima palabra de la clave del encabezado (lo que va
 * despues del ultimo rayon largo):
 *   - "CERRADO..."            -> cerrado
 *   - "PENDIENTE..."          -> pendiente
 *   - "PARCIALMENTE..."       -> pendiente (no esta cerrado: algo falta)
 *   - "No aplica..."          -> no aplica
 * Todo lo demas es un error y el script sale con codigo distinto de 0.
 *
 * Este archivo es codigo: se escribe en ASCII puro (sin tildes ni enie),
 * como el resto del codigo del repositorio.
 */

'use strict';

const fs = require('fs');
const path = require('path');

/** La respuesta al checklist, relativa a este script. */
const RUTA_DOC = path.resolve(
  __dirname, '..', '..', 'docs', 'gestion-humana', 'firma-electronica',
  'respuesta-checklist-cierre-2026-10-30.md'
);

/** Rayon largo (el que separa el texto del estado). */
const RAYON = '\u2014';
/** La cabecera de la tabla resumen. */
const CABECERA = '| Secci\u00f3n | Cerrados | Pendientes | No aplica | Total |';
/** El separador de la tabla resumen. */
const SEPARADOR = '|---|---|---|---|---|';
/** La etiqueta de la fila de total. */
const ETIQUETA_TOTAL = '**TOTAL**';
/** El ancho al que se dobla la frase de conciliacion. */
const ANCHO = 88;

/**
 * Las ocho secciones y la cantidad de requisitos que cada una declara.
 * No es una suposicion: son los 96 requisitos del checklist, y el script
 * verifica que el documento tenga exactamente esos IDs.
 */
const SECCIONES = [
  { n: 1, requisitos: 9 },
  { n: 2, requisitos: 12 },
  { n: 3, requisitos: 13 },
  { n: 4, requisitos: 14 },
  { n: 5, requisitos: 11 },
  { n: 6, requisitos: 12 },
  { n: 7, requisitos: 15 },
  { n: 8, requisitos: 10 },
];

/**
 * Los estados posibles de un requisito.
 * @type {string[]}
 */
const ESTADOS = ['cerrado', 'pendiente', 'no aplica'];

/**
 * Dobla un texto en lineas de un ancho dado, sin romper palabras.
 * @param {string} texto
 * @param {number} ancho
 * @returns {string[]}
 */
function _doblar(texto, ancho) {
  const palabras = String(texto).split(/\s+/);
  const lineas = [];
  let actual = '';
  for (const p of palabras) {
    if (actual === '') {
      actual = p;
    } else if ((actual + ' ' + p).length <= ancho) {
      actual += ' ' + p;
    } else {
      lineas.push(actual);
      actual = p;
    }
  }
  if (actual !== '') lineas.push(actual);
  return lineas;
}

/**
 * Compara dos textos ignorando como estan los espacios y los saltos de linea.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function _mismoTexto(a, b) {
  const n = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  return n(a) === n(b);
}

/**
 * El texto que va despues del ultimo rayon largo, en mayusculas, sin
 * acentos, para comparar sin depender de como se haya escrito.
 * @param {string} s
 * @returns {string}
 */
function _normalizar(s) {
  return String(s || '')
    .replace(/[\u00c0-\u00ff]/g, (c) => {
      // Sin diacriticos: la vocal acentuada se vuelve su vocal simple.
      const mapa = {
        '\u00e1': 'a', '\u00e9': 'e', '\u00ed': 'i', '\u00f3': 'o', '\u00fa': 'u',
        '\u00e0': 'a', '\u00e8': 'e', '\u00ec': 'i', '\u00f2': 'o', '\u00f9': 'u',
        '\u00c1': 'A', '\u00c9': 'E', '\u00cd': 'I', '\u00d3': 'O', '\u00da': 'U',
      };
      return mapa[c] || c;
    })
    .toUpperCase()
    .trim();
}

/**
 * Clasifica el estado de un encabezado a partir de su clave.
 * @param {string} clave
 * @returns {string|null} el estado, o null si la clave no es reconocible.
 */
function _estadoDeClave(clave) {
  const n = _normalizar(clave);
  if (n.indexOf('CERRADO') === 0) return 'cerrado';
  if (n.indexOf('PENDIENTE') === 0) return 'pendiente';
  if (n.indexOf('PARCIALMENTE') === 0) return 'pendiente';
  if (n.indexOf('NO APLICA') === 0) return 'no aplica';
  return null;
}

/**
 * Parsea los encabezados de requisito del documento.
 * @param {string} texto
 * @returns {{requisitos: Array, errores: string[]}}
 */
function _parsear(texto) {
  const re = /\*\*(\d+)\.(\d+)(?:\s+a\s+(\d+)\.(\d+))?\s+\u00b7([\s\S]*?)\*\*/g;
  const requisitos = [];
  const errores = [];
  let m;
  while ((m = re.exec(texto)) !== null) {
    const seccion = parseInt(m[1], 10);
    const desde = parseInt(m[2], 10);
    const hasta = m[3] ? parseInt(m[4], 10) : desde;
    const cuerpo = m[5];

    const corte = cuerpo.lastIndexOf(RAYON);
    if (corte < 0) {
      errores.push(
        'El encabezado ' + seccion + '.' + desde + ' no tiene el separador del estado (raya).'
      );
      continue;
    }
    const clave = cuerpo.slice(corte + 1);
    const estado = _estadoDeClave(clave);
    if (!estado) {
      errores.push(
        'El encabezado ' + seccion + '.' + desde + ' tiene un estado que no se reconoce: "'
          + clave.trim() + '".'
      );
      continue;
    }
    for (let i = desde; i <= hasta; i++) {
      requisitos.push({
        id: seccion + '.' + i,
        seccion: seccion,
        estado: estado,
        clave: clave.trim(),
      });
    }
  }
  return { requisitos: requisitos, errores: errores };
}

/**
 * La lista de IDs que el checklist exige: 1.1-1.9, 2.1-2.12, ...
 * @returns {string[]}
 */
function _idsEsperados() {
  const ids = [];
  for (const s of SECCIONES) {
    for (let i = 1; i <= s.requisitos; i++) ids.push(s.n + '.' + i);
  }
  return ids;
}

/**
 * Compara los IDs encontrados con los esperados.
 * @param {Array} requisitos
 * @returns {string[]} los problemas encontrados (vacio si todo cuadra).
 */
function _verificarIds(requisitos) {
  const problemas = [];
  const esperados = _idsEsperados();
  const vistos = {};
  for (const r of requisitos) {
    if (vistos[r.id]) {
      problemas.push('El requisito ' + r.id + ' aparece mas de una vez.');
    }
    vistos[r.id] = true;
  }
  const faltantes = esperados.filter((id) => !vistos[id]);
  const sobrantes = requisitos.map((r) => r.id).filter((id) => esperados.indexOf(id) < 0);
  for (const id of faltantes) problemas.push('Falta el requisito ' + id + '.');
  for (const id of sobrantes) problemas.push('El requisito ' + id + ' no existe en el checklist.');
  if (requisitos.length !== esperados.length) {
    problemas.push(
      'Se encontraron ' + requisitos.length + ' requisitos y el checklist declara '
        + esperados.length + '.'
    );
  }
  return problemas;
}

/**
 * Cuenta por seccion.
 * @param {Array} requisitos
 * @returns {Array} [{n, cerrados, pendientes, noAplica, total}]
 */
function _contar(requisitos) {
  return SECCIONES.map((s) => {
    const c = { n: s.n, cerrados: 0, pendientes: 0, noAplica: 0, total: 0 };
    for (const r of requisitos) {
      if (r.seccion !== s.n) continue;
      c.total += 1;
      if (r.estado === 'cerrado') c.cerrados += 1;
      else if (r.estado === 'pendiente') c.pendientes += 1;
      else c.noAplica += 1;
    }
    return c;
  });
}

/**
 * Arma la tabla resumen a partir del conteo.
 * @param {Array} conteo
 * @param {Array} etiquetas las etiquetas de seccion que ya tiene el documento.
 * @returns {string[]} las lineas de la tabla.
 */
function _armarTabla(conteo, etiquetas) {
  const lineas = [CABECERA, SEPARADOR];
  let tc = 0, tp = 0, tn = 0, tt = 0;
  for (const c of conteo) {
    const etiqueta = etiquetas[c.n];
    if (!etiqueta) {
      throw new Error('El documento no tiene la fila de la seccion ' + c.n + ' en la tabla resumen.');
    }
    lineas.push(
      '| ' + etiqueta + ' | ' + c.cerrados + ' | ' + c.pendientes + ' | '
        + c.noAplica + ' | ' + c.total + ' |'
    );
    tc += c.cerrados; tp += c.pendientes; tn += c.noAplica; tt += c.total;
  }
  lineas.push(
    '| ' + ETIQUETA_TOTAL + ' | **' + tc + '** | **' + tp + '** | **' + tn + '** | **' + tt + '** |'
  );
  return lineas;
}

/**
 * Arma la frase que concilia los pendientes.
 * @param {Array} conteo
 * @returns {string}
 */
function _armarFrase(conteo) {
  const partes = [];
  let total = 0;
  for (const c of conteo) {
    if (c.pendientes === 0) continue;
    partes.push(c.pendientes + ' de la secci\u00f3n ' + c.n);
    total += c.pendientes;
  }
  let frase = 'Los ' + total + ' pendientes concilian: '
    + (partes.length ? partes.join(' + ') : 'ninguno') + ' = ' + total + '.';
  const noAplica = conteo.reduce((a, c) => a + c.noAplica, 0);
  if (noAplica > 0) {
    const partesNa = [];
    for (const c of conteo) {
      if (c.noAplica === 0) continue;
      partesNa.push(c.noAplica + ' de la secci\u00f3n ' + c.n);
    }
    frase += ' Los ' + noAplica + ' que no aplican: ' + partesNa.join(' + ') + '.';
  }
  return frase;
}

/**
 * Ubica el bloque de la tabla resumen y las etiquetas de cada seccion.
 * @param {string[]} lineas
 * @returns {{inicio: number, fin: number, etiquetas: object}}
 */
function _ubicarTabla(lineas) {
  let inicio = -1;
  for (let i = 0; i < lineas.length; i++) {
    if (/^\|\s*Secci/.test(lineas[i])) { inicio = i; break; }
  }
  if (inicio < 0) throw new Error('No se encontro la cabecera de la tabla resumen.');
  let fin = -1;
  for (let i = inicio; i < lineas.length; i++) {
    if (lineas[i].indexOf(ETIQUETA_TOTAL) >= 0) { fin = i; break; }
  }
  if (fin < 0) throw new Error('No se encontro la fila ' + ETIQUETA_TOTAL + ' de la tabla resumen.');

  const etiquetas = {};
  for (let i = inicio + 1; i < fin; i++) {
    const celdas = lineas[i].split('|');
    if (celdas.length < 3) continue;
    const etiqueta = celdas[1].trim();
    const m = /^(\d+)\./.exec(etiqueta);
    if (!m) continue;
    etiquetas[parseInt(m[1], 10)] = etiqueta;
  }
  return { inicio: inicio, fin: fin, etiquetas: etiquetas };
}

/**
 * Ubica el parrafo de conciliacion que va despues de la tabla.
 * @param {string[]} lineas
 * @param {number} desde
 * @returns {{inicio: number, fin: number}}
 */
function _ubicarFrase(lineas, desde) {
  let i = desde;
  while (i < lineas.length && lineas[i].trim() === '') i++;
  if (i >= lineas.length) return { inicio: -1, fin: -1 };
  if (lineas[i].indexOf('pendientes concilian') < 0) return { inicio: -1, fin: -1 };
  let j = i;
  while (j < lineas.length && lines_j_separa(lineas, j)) j++;
  return { inicio: i, fin: j - 1 };
}

/**
 * Una linea es parte del parrafo de conciliacion mientras siga siendo prosa.
 * @param {string[]} lineas
 * @param {number} j
 * @returns {boolean}
 */
function lines_j_separa(lineas, j) {
  const t = lineas[j].trim();
  if (t === '') return false;
  if (/^\|/.test(t)) return false;
  if (/^#{1,6}\s/.test(t)) return false;
  if (/^---/.test(t)) return false;
  return true;
}

/**
 * Divide el texto en lineas, respetando el fin de linea del archivo.
 * @param {string} texto
 * @returns {{lineas: string[], eol: string}}
 */
function _partir(texto) {
  const eol = texto.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
  const normalizado = texto.replace(/\r\n/g, '\n');
  return { lineas: normalizado.split('\n'), eol: eol };
}

/**
 * El punto de entrada.
 * @param {string[]} argv
 * @returns {number} el codigo de salida.
 */
function main(argv) {
  const escribir = argv.indexOf('--escribir') >= 0;
  const ayuda = argv.indexOf('--ayuda') >= 0 || argv.indexOf('--help') >= 0;

  if (ayuda) {
    process.stdout.write([
      'Uso: node contar-estados-checklist.js [--escribir]',
      '',
      '  (sin opciones)  Verifica que el documento cuadre y solo informa.',
      '  --escribir      Regenera la tabla resumen y la frase de conciliacion.',
      '  --ayuda         Esta ayuda.',
      '',
      'Sale con codigo 0 cuando el documento cuadra y distinto de 0 cuando no.',
      '',
    ].join('\n'));
    return 0;
  }

  // El codigo de este repositorio es ASCII puro.
  const propio = fs.readFileSync(__filename, 'latin1');
  for (let i = 0; i < propio.length; i++) {
    if (propio.charCodeAt(i) > 127) {
      const hasta = propio.slice(0, i).split('\n').length;
      process.stderr.write(
        'ERROR: este script tiene un caracter no ASCII (0x' + propio.charCodeAt(i).toString(16)
          + ') en la linea ' + hasta + '.\n'
      );
      return 2;
    }
  }

  if (!fs.existsSync(RUTA_DOC)) {
    process.stderr.write('ERROR: no existe el documento ' + RUTA_DOC + '\n');
    return 2;
  }

  const texto = fs.readFileSync(RUTA_DOC, 'utf8');
  const partes = _partir(texto);
  const lineas = partes.lineas;
  const eol = partes.eol;

  const parseo = _parsear(texto);
  const problemas = parseo.errores.concat(_verificarIds(parseo.requisitos));

  if (problemas.length > 0) {
    process.stderr.write('ERROR: el documento no se puede contar.\n');
    for (const p of problemas) process.stderr.write('  - ' + p + '\n');
    return 1;
  }

  const conteo = _contar(parseo.requisitos);
  const totales = { cerrados: 0, pendientes: 0, noAplica: 0, total: 0 };
  for (const c of conteo) {
    totales.cerrados += c.cerrados;
    totales.pendientes += c.pendientes;
    totales.noAplica += c.noAplica;
    totales.total += c.total;
  }

  let tabla;
  let frase;
  try {
    const pos = _ubicarTabla(lineas);
    tabla = _armarTabla(conteo, pos.etiquetas);
    frase = _armarFrase(conteo);
  } catch (e) {
    process.stderr.write('ERROR: ' + e.message + '\n');
    return 1;
  }

  // El bloque de la tabla tal como esta hoy en el documento.
  const posTabla = _ubicarTabla(lineas);
  const bloqueActual = lineas.slice(posTabla.inicio, posTabla.fin + 1);
  const bloqueNuevo = tabla.slice();
  const tablaCuadra = bloqueActual.join('\n') === bloqueNuevo.join('\n');

  // El parrafo de conciliacion tal como esta hoy.
  const posFrase = _ubicarFrase(lineas, posTabla.fin + 1);
  const fraseActual = posFrase.inicio >= 0 ? lineas.slice(posFrase.inicio, posFrase.fin + 1).join(' ') : '';
  const fraseCuadra = posFrase.inicio >= 0 && _mismoTexto(fraseActual, frase);

  const lineasNuevas = lineas.slice();
  lineasNuevas.splice.apply(lineasNuevas, [posTabla.inicio, posTabla.fin - posTabla.inicio + 1].concat(bloqueNuevo));
  const posFrase2 = _ubicarFrase(lineasNuevas, posTabla.inicio + bloqueNuevo.length);
  if (posFrase2.inicio >= 0) {
    lineasNuevas.splice.apply(
      lineasNuevas,
      [posFrase2.inicio, posFrase2.fin - posFrase2.inicio + 1].concat(_doblar(frase, ANCHO))
    );
  }
  const textoNuevo = lineasNuevas.join(eol);

  // El reporte.
  const salida = [];
  salida.push('Conteo por seccion (del conteo real de los requisitos del documento):');
  for (const c of conteo) {
    salida.push(
      '  Seccion ' + c.n + ': cerrados ' + c.cerrados
        + ', pendientes ' + c.pendientes
        + ', no aplica ' + c.noAplica
        + ', total ' + c.total
    );
  }
  salida.push(
    '  TOTAL: cerrados ' + totales.cerrados
      + ', pendientes ' + totales.pendientes
      + ', no aplica ' + totales.noAplica
      + ', total ' + totales.total
  );
  salida.push('');

  if (escribir) {
    if (textoNuevo === texto) {
      salida.push('El documento ya cuadra: no se escribio nada (corrida idempotente).');
      process.stdout.write(salida.join('\n') + '\n');
      return 0;
    }
    fs.writeFileSync(RUTA_DOC, textoNuevo, 'utf8');
    salida.push('Tabla resumen y frase de conciliacion regeneradas desde el conteo real.');
    process.stdout.write(salida.join('\n') + '\n');
    return 0;
  }

  if (!tablaCuadra) {
    salida.push('La tabla resumen NO cuadra con el conteo real.');
    salida.push('  Lo que dice el documento:');
    for (const l of bloqueActual) salida.push('    ' + l);
    salida.push('  Lo que sale del conteo:');
    for (const l of bloqueNuevo) salida.push('    ' + l);
    process.stdout.write(salida.join('\n') + '\n');
    return 1;
  }
  if (posFrase.inicio < 0) {
    salida.push('No se encontro el parrafo de conciliacion de los pendientes.');
    process.stdout.write(salida.join('\n') + '\n');
    return 1;
  }
  if (!fraseCuadra) {
    salida.push('La frase de conciliacion NO cuadra con el conteo real.');
    salida.push('  El documento dice: ' + fraseActual.trim());
    salida.push('  El conteo dice:   ' + frase);
    process.stdout.write(salida.join('\n') + '\n');
    return 1;
  }

  salida.push('El documento cuadra: la tabla y la frase de conciliacion salen del conteo real.');
  process.stdout.write(salida.join('\n') + '\n');
  return 0;
}

process.exitCode = main(process.argv.slice(2));
