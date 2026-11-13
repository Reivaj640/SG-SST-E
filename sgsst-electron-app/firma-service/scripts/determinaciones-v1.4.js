'use strict';
/**
 * determinaciones-v1.4.js
 *
 * QUE HACE
 * --------
 * Aplica, sobre los candidatos ya armados por C1 a C7, el texto literal de las
 * DETERMINACIONES LEGALES de la mesa L1 a L7:
 *
 *   - L1 (Google): `docs/gestion-humana/firma-electronica/dictamen-legal-l1-2026-11-12.md`
 *   - L4 y L5 (la v1.4 y Backblaze): `.../pedido-6-backblaze-v1-4-2026-11-12.md`
 *
 * LOS TEXTOS NO SE TRANSCRIBEN: se leen de los propios documentos de
 * determinacion, de los bloques ```html```. Lo que se transcribe son los
 * RANGOS DE LINEA del ancla (la linea del candidato que se sustituye) y las
 * IDENTIFICACIONES de version, que son mecanicas.
 *
 * POR QUE LOS RANGOS Y NO EL TEXTO COMPLETO
 * -----------------------------------------
 * Un ancla escrita a mano tiene dos fallos posibles: que no case (y el
 * programa no escribe nada, con lo que el error es visible) o que case por
 * casualidad en otro sitio (y el error es INVISIBLE). El rango de linea es
 * la segunda forma de fallo con la que hay que contar: por eso el programa
 * comprueba que el rango extraido aparezca EXACTAMENTE una vez en el texto,
 * y por eso el orden de aplicacion es de abajo hacia arriba (para que el
 * numero de linea de los rangos que faltan por aplicar siga siendo cierto).
 *
 * EL GUARD
 * --------
 * Cada ancla tiene que aparecer EXACTAMENTE una vez. Si no, no se escribe
 * nada y el programa sale con codigo 1.
 *
 * ASCII puro, LF, sin BOM. Es codigo.
 */

const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..', '..');
const DOCS = path.join(RAIZ, 'docs', 'gestion-humana', 'firma-electronica');
const DICTAMEN = path.join(DOCS, 'dictamen-legal-l1-2026-11-12.md');
const PEDIDO = path.join(DOCS, 'pedido-6-backblaze-v1-4-2026-11-12.md');

// ---------------------------------------------------------------------------
// LECTOR DE LOS DOCUMENTOS DE DETERMINACION
// ---------------------------------------------------------------------------

/**
 * Extrae los bloques ```html``` de un documento, indexados por seccion.
 *
 * La clave de cada seccion es la del encabezado que la introduce:
 *   - en el dictamen: `A.1`, `A.2.1`, `B.1`, `B.6.3`...
 *   - en el pedido: `i-a`, `i-b`, `i-c`, `ii-a`, `ii-b`, `iii-a`.
 *
 * @param {string} archivo
 * @returns {Object<string, string[]>} bloques por seccion, en orden
 */
function leerBloques(archivo) {
  const lineas = fs.readFileSync(archivo, 'utf8').split('\n');
  const secciones = {};
  let clave = null;
  let enBloque = false;
  let esHtml = false;
  let buffer = [];

  const claveDe = (texto) => {
    const m = texto.match(/\((i|ii|iii)-([a-z])\)/);
    if (m) return m[1] + '-' + m[2];
    const n = texto.match(/\b(A\.\d(?:\.\d)?|B\.\d(?:\.\d)?)\b/);
    return n ? n[1] : null;
  };

  for (const ln of lineas) {
    if (enBloque) {
      if (/^```\s*$/.test(ln)) {
        enBloque = false;
        if (esHtml && clave) {
          if (!secciones[clave]) secciones[clave] = [];
          secciones[clave].push(buffer.join('\n'));
        }
        buffer = [];
        continue;
      }
      buffer.push(ln);
      continue;
    }
    const encabezado = ln.match(/^#{2,6}\s+(.*)$/);
    if (encabezado) {
      // Un encabezado SIN clave propia (por ejemplo "### Texto literal
      // PROPUESTO") no borra la seccion en la que estamos: sus bloques
      // pertenecen a la seccion que sigue abierta.
      const k = claveDe(encabezado[1]);
      if (k) clave = k;
      continue;
    }
    const sub = ln.match(/^\*\*((?:A|B)\.\d(?:\.\d)?)\b/);
    if (sub) {
      clave = sub[1];
      continue;
    }
    const abre = ln.match(/^```(\S*)/);
    if (abre) {
      enBloque = true;
      esHtml = abre[1] === 'html';
      buffer = [];
      continue;
    }
  }
  return secciones;
}

/**
 * Un texto de la determinacion.
 *
 * @param {Object<string, string[]>} secciones
 * @param {string} clave - la seccion
 * @param {number} [indice] - el bloque (0 por omision)
 * @returns {string}
 */
function bloque(secciones, clave, indice) {
  const lista = secciones[clave];
  if (!lista) throw new Error('La determinacion no tiene la seccion ' + clave);
  const i = indice || 0;
  if (!lista[i]) throw new Error('La seccion ' + clave + ' no tiene el bloque ' + i);
  return lista[i];
}

// ---------------------------------------------------------------------------
// LAS DETERMINACIONES
// ---------------------------------------------------------------------------

// Ranges: la linea del CANDIDATO (la salida de C1 a C7) que se sustituye.
// `dest` es la lista de piezas del texto nuevo, unidas con un salto de linea.
//
// `extension: true` marca las piezas que NO estan en el dictamen del abogado
// y que el agente general aplica por la MISMA regla de la que el dictamen
// usa (la version propia del documento) y las reporta aparte.
const NUBE_RANGOS = [
  {
    id: 'L1-B3-CDNA',
    donde: 'Anexo de Nube v1.4, seccion 11, la vineta del CDPA',
    desde: 903, hasta: 915,
    dest: [{ t: 'dict', k: 'B.3', i: 3 }],
  },
  {
    id: 'L1-B3-REF',
    donde: 'Anexo de Nube v1.4, seccion 11, las referencias normativas',
    desde: 885, hasta: 897,
    dest: [{ t: 'dict', k: 'B.3', i: 1 }],
  },
  {
    id: 'L1-A5',
    donde: 'Anexo de Nube v1.4, la linea de opinion del abogado, al final de la seccion 4',
    desde: 530, hasta: 530,
    dest: [
      { t: 'dict', k: 'A.5' },
      { t: 'txt', s: '' },
      { t: 'txt', s: '  <h2>5. Seguridad</h2>' },
    ],
    nota: 'El dictamen da la linea de opinion pero no dice donde va: se pone al '
      + 'final de la seccion 4, que es la seccion de la que habla ("en esta seccion").',
  },
  {
    id: 'L1-B2',
    donde: 'Anexo de Nube v1.4, seccion 4, el parrafo del contrato de transmision',
    desde: 488, hasta: 496,
    dest: [{ t: 'dict', k: 'B.2', i: 1 }],
  },
  {
    id: 'L1-A23',
    donde: 'Anexo de Nube v1.4, seccion 4, el parrafo del uso real del canal',
    desde: 350, hasta: 366,
    dest: [{ t: 'dict', k: 'A.2.3' }],
  },
  {
    id: 'L1-A22',
    donde: 'Anexo de Nube v1.4, seccion 4, el parrafo de cierre',
    desde: 336, hasta: 348,
    dest: [{ t: 'dict', k: 'A.2.2' }],
  },
  {
    id: 'L5-IB',
    donde: 'Anexo de Nube v1.4, seccion 4, el parrafo de respaldos, monitoreo y soporte',
    desde: 333, hasta: 335,
    dest: [{ t: 'ped', k: 'i-b' }],
  },
  {
    id: 'L1-A1',
    donde: 'Anexo de Nube v1.4, seccion 4, la fila de Google y la fila de Backblaze',
    desde: 287, hasta: 330,
    dest: [{ t: 'dict', k: 'A.1' }, { t: 'ped', k: 'i-a' }],
  },
  {
    id: 'L1-A21',
    donde: 'Anexo de Nube v1.4, seccion 4, el parrafo introductorio (y la linea huerfana)',
    desde: 242, hasta: 254,
    dest: [{ t: 'dict', k: 'A.2.1' }],
  },
  {
    id: 'L5-IC',
    donde: 'Anexo de Nube v1.4, seccion 3, el parrafo de Respaldos',
    desde: 204, hasta: 239,
    dest: [{ t: 'ped', k: 'i-c' }],
  },
  {
    id: 'L1-B1',
    donde: 'Anexo de Nube v1.4, seccion 3, la clasificacion del flujo',
    desde: 186, hasta: 196,
    dest: [{ t: 'dict', k: 'B.1', i: 1 }],
  },
  {
    id: 'L4-C2',
    donde: 'Anexo de Nube v1.4, seccion 1, el bullet del cifrado (el destino ya se decidio)',
    desde: 116, hasta: 117,
    dest: [{
      t: 'txt',
      s: '      <code>deploy/backup-offsite.sh</code> y <strong>queda pendiente</strong> hasta que se verifique la\n'
        + '      primera copia; la purga peri&oacute;dica de los respaldos s&iacute; se ejecuta con los scripts del',
    }],
    nota: 'El texto de C2 decia "hasta que el owner decida el destino y se '
      + 'verifique la primera copia": el destino YA se decidio (Backblaze B2, '
      + '12-nov-2026) y el seccion 3 nuevo lo dice. Dejarlo seria contradecirse.',
  },
  {
    id: 'L4-IIA-IIIA',
    donde: 'Anexo de Nube v1.4, seccion 1, los literales de los actos del 12-nov y del estado de firma',
    desde: 111, hasta: 111,
    dest: [
      { t: 'txt', s: '      redacci&oacute;n.</li>' },
      { t: 'ped', k: 'ii-a' },
      { t: 'ped', k: 'iii-a' },
    ],
  },
];

const ENCARGO_RANGOS = [
  {
    id: 'L1-B63',
    donde: 'Anexo de Encargo 2026-11-12, seccion 12, la constancia de la version',
    desde: 886, hasta: 893,
    dest: [{ t: 'dict', k: 'B.6.3', i: 1 }],
  },
  {
    id: 'L4-IIB',
    donde: 'Anexo de Encargo 2026-11-12, seccion 5, el parrafo de prevalencia y de actos ejecutados',
    desde: 566, hasta: 576,
    dest: [{ t: 'ped', k: 'ii-b' }],
  },
  {
    id: 'L1-A4',
    donde: 'Anexo de Encargo 2026-11-12, seccion 5, la determinacion del papel del proveedor',
    desde: 495, hasta: 523,
    dest: [{ t: 'dict', k: 'A.4' }],
  },
  {
    id: 'L1-B4',
    donde: 'Anexo de Encargo 2026-11-12, seccion 5, los tres parrafos de las comunicaciones',
    desde: 469, hasta: 494,
    dest: [
      { t: 'dict', k: 'B.4', i: 1 },
      { t: 'dict', k: 'B.4', i: 2 },
      { t: 'dict', k: 'B.4', i: 3 },
    ],
  },
  {
    id: 'L1-A3',
    donde: 'Anexo de Encargo 2026-11-12, seccion 5, la fila de Google',
    desde: 444, hasta: 458,
    dest: [{ t: 'dict', k: 'A.3' }],
  },
  {
    id: 'L1-B5',
    donde: 'Anexo de Encargo 2026-11-12, seccion 5, la remision a la auditoria del CDPA',
    desde: 420, hasta: 424,
    dest: [{ t: 'dict', k: 'B.5', i: 1 }],
  },
  {
    id: 'L1-B62',
    donde: 'Anexo de Encargo 2026-11-12, la cabecera',
    desde: 34, hasta: 34,
    dest: [{ t: 'dict', k: 'B.6.2', i: 1 }],
  },
  {
    id: 'L1-B61',
    donde: 'Anexo de Encargo 2026-11-12, la meta de version',
    desde: 8, hasta: 8,
    dest: [{ t: 'dict', k: 'B.6.1', i: 1 }],
  },
];

// Las identificaciones de version: fragmentos literales, porque son cortos y
// no dependen de la numeracion de lineas.
//
// `ext: true` marca los que el agente general anade a los del dictamen
// (B.6.4 y B.6.5), aplicando la misma regla: la version propia del
// documento. Se reportan aparte.
const NUBE_TEXTOS = [
  {
    id: 'B6.5-145', ext: false,
    antes: '  Personales version 2026-11-11 y prevalece sobre las cl&aacute;usulas de ese Anexo que contradigan el Servicio,',
    despues: '  Personales version 2026-11-12 y prevalece sobre las cl&aacute;usulas de ese Anexo que contradigan el Servicio,',
  },
  {
    id: 'B6.5-148', ext: false,
    antes: '  conforme a la cl&aacute;usula de prevalencia del Anexo de Encargo version 2026-11-11. El alcance son las',
    despues: '  conforme a la cl&aacute;usula de prevalencia del Anexo de Encargo version 2026-11-12. El alcance son las',
  },
  {
    id: 'B6.5-577', ext: false,
    antes: '  (&laquo;Proveedores externos y subencargados&raquo;) del Anexo de Encargo version 2026-11-11 y en la ficha de',
    despues: '  (&laquo;Proveedores externos y subencargados&raquo;) del Anexo de Encargo version 2026-11-12 y en la ficha de',
  },
  {
    id: 'B6.5-812', ext: false,
    antes: '  <strong>Remisi&oacute;n al Anexo de Encargo version 2026-11-11.</strong> Esta versi&oacute;n 1.3 <strong>remite</strong>',
    despues: '  <strong>Remisi&oacute;n al Anexo de Encargo version 2026-11-12.</strong> Esta versi&oacute;n 1.4 <strong>remite</strong>',
  },
  {
    id: 'B6.5-813', ext: false,
    antes: '  al Anexo de Encargo de Tratamiento de Datos Personales version 2026-11-11, que es el <strong>instrumento',
    despues: '  al Anexo de Encargo de Tratamiento de Datos Personales version 2026-11-12, que es el <strong>instrumento',
  },
  {
    id: 'B6.5-823', ext: false,
    antes: '  Anexo de Encargo version 2026-11-11. <strong>Toda modificaci&oacute;n de este Anexo se publica como versi&oacute;n',
    despues: '  Anexo de Encargo version 2026-11-12. <strong>Toda modificaci&oacute;n de este Anexo se publica como versi&oacute;n',
  },
  {
    id: 'B6.5-845', ext: false,
    antes: '  2026-11-11), y queda en la evidencia de suscripci&oacute;n que el servicio registra y en el rastro append-only de la',
    despues: '  2026-11-12), y queda en la evidencia de suscripci&oacute;n que el servicio registra y en el rastro append-only de la',
  },
  {
    id: 'B6.5-874', ext: false,
    antes: '    <strong>se incorpora</strong> al Anexo de Encargo de Tratamiento de Datos Personales version 2026-11-11 en lo',
    despues: '    <strong>se incorpora</strong> al Anexo de Encargo de Tratamiento de Datos Personales version 2026-11-12 en lo',
  },
  {
    id: 'B6.5-881', ext: false,
    antes: '    del papel del proveedor del canal de correo es la del &sect;5 del Anexo de Encargo version 2026-11-11, que este',
    despues: '    del papel del proveedor del canal de correo es la del &sect;5 del Anexo de Encargo version 2026-11-12, que este',
  },
  {
    id: 'B6.5-846', ext: false,
    antes: '  suscripci&oacute;n. <strong>Los dos actos de esta versi&oacute;n 1.3 est&aacute;n pendientes</strong>: la',
    despues: '  suscripci&oacute;n. <strong>Los dos actos de esta versi&oacute;n 1.4 est&aacute;n pendientes</strong>: la',
  },
  {
    id: 'B6.5-847', ext: true,
    antes: '  suscripci&oacute;n de la v1.3 por ASEPLUS CARIBE S.A.S. y su contrafirma son un acto del owner (P8), y hasta que',
    despues: '  suscripci&oacute;n de la v1.4 por ASEPLUS CARIBE S.A.S. y su contrafirma son un acto del owner (P8), y hasta que',
  },
  {
    id: 'EXT-titulo', ext: true,
    antes: '<title>Anexo de Nube &mdash; Servicio de firma electr&oacute;nica K+AIR (versi&oacute;n 1.3)</title>',
    despues: '<title>Anexo de Nube &mdash; Servicio de firma electr&oacute;nica K+AIR (versi&oacute;n 1.4)</title>',
  },
  {
    id: 'EXT-meta', ext: true,
    antes: 'Versi&oacute;n 1.3, del 11 de noviembre de 2026, versi&oacute;n susceptible de suscripci&oacute;n',
    despues: 'Versi&oacute;n 1.4, del 12 de noviembre de 2026, versi&oacute;n susceptible de suscripci&oacute;n',
  },
  {
    id: 'EXT-38', ext: true,
    antes: '  1.3 del Anexo de Nube: es la que la Empresa suscribe y la que el servicio registra con su huella SHA-256. La',
    despues: '  1.4 del Anexo de Nube: es la que la Empresa suscribe y la que el servicio registra con su huella SHA-256. La',
  },
  {
    id: 'EXT-40', ext: true,
    antes: '  ese d&iacute;a: queda como la versi&oacute;n ya suscrita, y esta versi&oacute;n 1.3 no altera esa suscripci&oacute;n ni sus',
    despues: '  ese d&iacute;a: queda como la versi&oacute;n ya suscrita, y esta versi&oacute;n 1.4 no altera esa suscripci&oacute;n ni sus',
  },
  {
    id: 'EXT-43', ext: true,
    antes: '  con esta versi&oacute;n 1.3, porque su bloque de pendientes declaraba como no cumplidos unos pasos que ya se',
    despues: '  con esta versi&oacute;n 1.4, porque su bloque de pendientes declaraba como no cumplidos unos pasos que ya se',
  },
  {
    id: 'EXT-570', ext: true,
    antes: '  decisi&oacute;n, el texto lo dice de forma expresa. <strong>Con el cambio de cuenta (esta versi&oacute;n 1.3), los',
    despues: '  decisi&oacute;n, el texto lo dice de forma expresa. <strong>Con el cambio de cuenta (esta versi&oacute;n 1.4), los',
  },
  {
    id: 'EXT-810', ext: true,
    antes: '  s&iacute; hasta completar su bloque de pendientes. <strong>Esta versi&oacute;n 1.3 se suscribe por ambas partes</strong>,',
    despues: '  s&iacute; hasta completar su bloque de pendientes. <strong>Esta versi&oacute;n 1.4 se suscribe por ambas partes</strong>,',
  },
  {
    id: 'EXT-819', ext: true,
    antes: '  en su &sect;12 (&laquo;Firmas&raquo;) los dos actos del instrumento. <strong>Esta versi&oacute;n 1.3 no sustituye ese',
    despues: '  en su &sect;12 (&laquo;Firmas&raquo;) los dos actos del instrumento. <strong>Esta versi&oacute;n 1.4 no sustituye ese',
  },
  {
    id: 'EXT-876', ext: true,
    antes: '    Empresa, este Anexo de Nube v1.3 se suscribe con ella y remite a sus &sect;3 (&laquo;Actividades del',
    despues: '    Empresa, este Anexo de Nube v1.4 se suscribe con ella y remite a sus &sect;3 (&laquo;Actividades del',
  },
  {
    id: 'EXT-927', ext: true,
    antes: '    <p>K+AIR &mdash; Gesstiar S.A.S. &middot; Colombia &middot; Anexo de Nube, versi&oacute;n 1.3 &middot;',
    despues: '    <p>K+AIR &mdash; Gesstiar S.A.S. &middot; Colombia &middot; Anexo de Nube, versi&oacute;n 1.4 &middot;',
  },
  {
    id: 'EXT-928', ext: true,
    antes: '    11 de noviembre de 2026</p>',
    despues: '    12 de noviembre de 2026</p>',
  },
];

const ENCARGO_TEXTOS = [
  {
    id: 'B6.4-297', ext: false,
    antes: 'contenida en este Anexo de Encargo de Tratamiento de Datos Personales del servicio de firma electr&oacute;nica K+AIR, versi&oacute;n 2026-11-11, fechada el 11 de noviembre de 2026, y en el Acuerdo de uso',
    despues: 'contenida en este Anexo de Encargo de Tratamiento de Datos Personales del servicio de firma electr&oacute;nica K+AIR, versi&oacute;n 2026-11-12, fechada el 12 de noviembre de 2026, y en el Acuerdo de uso',
  },
  {
    id: 'B6.4-535', ext: false,
    antes: '  Gesstiar S.A.S.; y (ix) la suscripci&oacute;n de esta versi&oacute;n 2026-11-11 del Anexo de Encargo por la Empresa y su',
    despues: '  Gesstiar S.A.S.; y (ix) la suscripci&oacute;n de esta versi&oacute;n 2026-11-12 del Anexo de Encargo por la Empresa y su',
  },
];

// ---------------------------------------------------------------------------
// EL MOTOR
// ---------------------------------------------------------------------------

function contar(texto, aguja) {
  let n = 0;
  let i = texto.indexOf(aguja);
  while (i >= 0) {
    n += 1;
    i = texto.indexOf(aguja, i + aguja.length);
  }
  return n;
}

function construir(piezas, dict, ped) {
  return piezas.map((p) => {
    if (p.t === 'txt') return p.s;
    if (p.t === 'dict') return bloque(dict, p.k, p.i);
    if (p.t === 'ped') return bloque(ped, p.k, p.i);
    throw new Error('Pieza desconocida: ' + JSON.stringify(p));
  }).join('\n');
}

/**
 * Aplica los rangos (de abajo hacia arriba) y despues los fragmentos.
 *
 * @param {string} texto
 * @param {Array} rangos
 * @param {Array} textos
 * @param {Object} dict
 * @param {Object} ped
 * @returns {{texto: string, problemas: string[], aplicadas: string[]}}
 */
function aplicar(texto, rangos, textos, dict, ped) {
  const problemas = [];
  const aplicadas = [];
  let lineas = texto.split('\n');

  const orden = rangos.slice().sort((a, b) => b.desde - a.desde);
  for (const r of orden) {
    if (r.desde < 1 || r.hasta > lineas.length || r.desde > r.hasta) {
      problemas.push(r.id + ': el rango ' + r.desde + '-' + r.hasta + ' no cabe en el texto');
      continue;
    }
    const antes = lineas.slice(r.desde - 1, r.hasta).join('\n');
    const n = contar(texto, antes);
    if (n !== 1) {
      problemas.push(r.id + ' (' + r.donde + '): el ancla casa ' + n + ' veces, se esperaba 1');
      continue;
    }
    let despues;
    try {
      despues = construir(r.dest, dict, ped);
    } catch (e) {
      problemas.push(r.id + ': ' + e.message);
      continue;
    }
    lineas = lineas.slice(0, r.desde - 1).concat(despues.split('\n'), lineas.slice(r.hasta));
    texto = lineas.join('\n');
    aplicadas.push(r.id);
  }

  for (const t of textos) {
    const n = contar(texto, t.antes);
    if (n !== 1) {
      problemas.push(t.id + ': el fragmento casa ' + n + ' veces, se esperaba 1');
      continue;
    }
    texto = texto.replace(t.antes, t.despues);
    aplicadas.push(t.id + (t.ext ? ' (extension del agente general)' : ''));
  }

  return { texto: texto, problemas: problemas, aplicadas: aplicadas };
}

/**
 * Aplica las determinaciones a los dos candidatos.
 *
 * @param {string} textoNube - el resultado de C1 a C7
 * @param {string} textoEncargo - el resultado de C1 a C7
 * @returns {{nube: object, encargo: object}}
 */
function determinaciones(textoNube, textoEncargo) {
  const dict = leerBloques(DICTAMEN);
  const ped = leerBloques(PEDIDO);
  return {
    nube: aplicar(textoNube, NUBE_RANGOS, NUBE_TEXTOS, dict, ped),
    encargo: aplicar(textoEncargo, ENCARGO_RANGOS, ENCARGO_TEXTOS, dict, ped),
  };
}

module.exports = {
  determinaciones: determinaciones,
  aplicar: aplicar,
  leerBloques: leerBloques,
  NUBE_RANGOS: NUBE_RANGOS,
  ENCARGO_RANGOS: ENCARGO_RANGOS,
  NUBE_TEXTOS: NUBE_TEXTOS,
  ENCARGO_TEXTOS: ENCARGO_TEXTOS,
  DICTAMEN: DICTAMEN,
  PEDIDO: PEDIDO,
};
