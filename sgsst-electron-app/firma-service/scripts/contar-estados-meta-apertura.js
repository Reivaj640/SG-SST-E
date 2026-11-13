/**
 * contar-estados-meta-apertura.js
 *
 * Verificador aritmetico del mapa de la meta para abrir el servicio de firma
 * a empresas reales.
 *
 * QUE HACE
 * --------
 * 1. Lee el mapa (docs/gestion-humana/firma-electronica/
 *    meta-para-abrir-a-empresas-reales-2026-11-12.md) desde una ruta relativa a
 *    este archivo (no hay rutas absolutas: cambiar de maquina no rompe nada).
 * 2. Parsea los encabezados de bloque (formato "**M.n - texto - ESTADO.**",
 *    con la palabra de estado despues del ultimo raya largo).
 * 3. Cuenta por seccion: cerrados, pendientes, no aplica y total.
 * 4. Verifica que existan EXACTAMENTE los IDs que este script declara. Si
 *    falta o sobra uno, sale con codigo distinto de 0.
 * 5. Verifica que CADA bloque declare su ORIGEN (la fila del cuadro canonico,
 *    del informe al abogado o de la decision de correo de la que sale). Un
 *    bloque sin origen no es trazable, y este mapa existe para ser trazado.
 * 6. Regenera el bloque de la tabla resumen y la frase de conciliacion. Los
 *    numeros NO se escriben a mano: salen del conteo real de las filas.
 *
 * INTERFAZ
 * --------
 *   node contar-estados-meta-apertura.js             Verifica (solo lectura).
 *                                                       Codigo 0 si el documento
 *                                                       cuadra; distinto de 0 si
 *                                                       no.
 *   node contar-estados-meta-apertura.js --escribir  Regenera la tabla y la
 *                                                       frase de conciliacion.
 *                                                       Es idempotente: la
 *                                                       segunda corrida no
 *                                                       cambia el archivo.
 *   node contar-estados-meta-apertura.js --doc=<ruta> Verifica otro mapa (lo
 *                                                       usa el test, sobre una
 *                                                       COPIA: nunca sobre el
 *                                                       documento real).
 *   node contar-estados-meta-apertura.js --ayuda     Esta ayuda.
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

/** El mapa, relativo a este script. */
const RUTA_DOC = path.resolve(
  __dirname, '..', '..', 'docs', 'gestion-humana', 'firma-electronica',
  'meta-para-abrir-a-empresas-reales-2026-11-12.md'
);

/** Rayon largo (el que separa el texto del estado). */
const RAYON = '\u2014';
/** La cabecera de la tabla resumen. */
const CABECERA = '| Bloque | Cerrados | Pendientes | No aplica | Total |';
/** El separador de la tabla resumen. */
const SEPARADOR = '|---|---|---|---|---|';
/** La etiqueta de la fila de total. */
const ETIQUETA_TOTAL = '**TOTAL**';
/** El ancho al que se dobla la frase de conciliacion. */
const ANCHO = 88;

/**
 * Las tres secciones del mapa y la cantidad de bloques que cada una declara.
 * NO es una suposicion: son los bloques del mapa, y el script verifica que el
 * documento tenga exactamente esos IDs.
 */
const SECCIONES = [
  { n: 1, etiqueta: '1. Bloqueos duros', requisitos: 10 },
  { n: 2, etiqueta: '2. Condiciones de apertura', requisitos: 8 },
  // La seccion 3 tiene 12 bloques: el M.28 (la transferencia internacional que
  // abrio la decision de M.7) y los dos que destapo la determinacion legal del
  // 12-nov-2026 (M.29, la poda del destino que no miraba el hold legal, y
  // M.30, la compuerta de conservacion que se abria con la bandera sola) se
  // sumaron ese dia.
  { n: 3, etiqueta: '3. Deuda y riesgo', requisitos: 12 },
];

/** El encabezado de cada bloque: "### M.n - texto - ESTADO." */
const RE_ENCABEZADO = /^###\s+M\.(\d+)\s+-\s+(.+)$/gm;
/** La linea de origen que cada bloque debe declarar. */
const RE_ORIGEN = /^\*\*Origen\.\*\*\s+\S/m;

/**
 * Clasifica el estado de un encabezado a partir de su clave.
 * @param {string} clave
 * @returns {string|null} el estado, o null si la clave no es reconocible.
 */
function _estadoDeClave(clave) {
  // Lo que va despues del ultimo rayon largo viene con espacios: se recorta
  // y se mira solo la primera palabra, para que "PENDIENTE." o "PENDIENTE,"
  // (como en el cuadro canonico) se reconozcan igual.
  const n = clave.trim().toUpperCase();
  if (n.indexOf('CERRADO') === 0) return 'cerrado';
  if (n.indexOf('PENDIENTE') === 0) return 'pendiente';
  if (n.indexOf('PARCIALMENTE') === 0) return 'pendiente';
  if (n.indexOf('NO APLICA') === 0) return 'no aplica';
  return null;
}

/**
 * Parsea los bloques del mapa.
 * @param {string} texto
 * @returns {{bloques: Array, errores: string[]}}
 */
function _parsear(texto) {
  const bloques = [];
  const errores = [];
  const re = new RegExp(RE_ENCABEZADO.source, 'gm');
  let m;
  while ((m = re.exec(texto)) !== null) {
    const numero = parseInt(m[1], 10);
    const cuerpo = m[2];

    const corte = cuerpo.lastIndexOf(RAYON);
    if (corte < 0) {
      errores.push('El bloque M.' + numero + ' no tiene el separador del estado (raya).');
      continue;
    }
    const clave = cuerpo.slice(corte + 1);
    const estado = _estadoDeClave(clave);
    if (!estado) {
      errores.push(
        'El bloque M.' + numero + ' tiene un estado que no se reconoce: "' + clave.trim() + '".'
      );
      continue;
    }
    // La seccion de un bloque es el grupo del ID que le corresponde.
    const seccion = _seccionDe(numero);
    if (!seccion) {
      errores.push('El bloque M.' + numero + ' no pertenece a ninguna seccion declarada.');
      continue;
    }
    // Cada bloque declara su origen (una fila de otro documento).
    const desde = texto.indexOf(m[0]);
    const hasta = texto.indexOf('\n### ', desde + 1);
    const seccionTexto = hasta < 0 ? texto.slice(desde) : texto.slice(desde, hasta);
    if (!RE_ORIGEN.test(seccionTexto)) {
      errores.push('El bloque M.' + numero + ' no declara su linea de "**Origen.**".');
    }
    bloques.push({
      id: 'M.' + numero,
      numero: numero,
      seccion: seccion,
      estado: estado,
      clave: clave.trim(),
    });
  }
  return { bloques: bloques, errores: errores };
}

/**
 * La seccion a la que pertenece un bloque, segun la cantidad declarada.
 * @param {number} numero
 * @returns {number|null}
 */
function _seccionDe(numero) {
  let acumulado = 0;
  for (const s of SECCIONES) {
    acumulado += s.requisitos;
    if (numero <= acumulado) return s.n;
  }
  return null;
}

/**
 * La lista de IDs que el mapa exige: M.1, M.2, ...
 * @returns {string[]}
 */
function _idsEsperados() {
  const ids = [];
  let acumulado = 0;
  for (const s of SECCIONES) {
    for (let i = 0; i < s.requisitos; i++) {
      acumulado += 1;
      ids.push('M.' + acumulado);
    }
  }
  return ids;
}

/**
 * Compara los IDs encontrados con los esperados.
 * @param {Array} bloques
 * @returns {string[]} los problemas encontrados (vacio si todo cuadra).
 */
function _verificarIds(bloques) {
  const problemas = [];
  const esperados = _idsEsperados();
  const vistos = {};
  for (const b of bloques) {
    if (vistos[b.id]) problemas.push('El bloque ' + b.id + ' aparece mas de una vez.');
    vistos[b.id] = true;
  }
  const faltantes = esperados.filter((id) => !vistos[id]);
  const sobrantes = bloques.map((b) => b.id).filter((id) => esperados.indexOf(id) < 0);
  for (const id of faltantes) problemas.push('Falta el bloque ' + id + '.');
  for (const id of sobrantes) problemas.push('El bloque ' + id + ' no existe en el mapa.');
  if (bloques.length !== esperados.length) {
    problemas.push(
      'Se encontraron ' + bloques.length + ' bloques y el mapa declara ' + esperados.length + '.'
    );
  }
  return problemas;
}

/**
 * Cuenta por seccion.
 * @param {Array} bloques
 * @returns {Array} [{n, etiqueta, cerrados, pendientes, noAplica, total}]
 */
function _contar(bloques) {
  return SECCIONES.map((s) => {
    const c = {
      n: s.n, etiqueta: s.etiqueta, cerrados: 0, pendientes: 0, noAplica: 0, total: 0,
    };
    for (const b of bloques) {
      if (b.seccion !== s.n) continue;
      c.total += 1;
      if (b.estado === 'cerrado') c.cerrados += 1;
      else if (b.estado === 'pendiente') c.pendientes += 1;
      else c.noAplica += 1;
    }
    return c;
  });
}

/**
 * Arma la tabla resumen a partir del conteo.
 * @param {Array} conteo
 * @returns {string[]} las lineas de la tabla.
 */
function _armarTabla(conteo) {
  const lineas = [CABECERA, SEPARADOR];
  let tc = 0, tp = 0, tn = 0, tt = 0;
  for (const c of conteo) {
    lineas.push(
      '| ' + c.etiqueta + ' | ' + c.cerrados + ' | ' + c.pendientes + ' | '
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
    partes.push(c.pendientes + ' del bloque ' + c.n);
    total += c.pendientes;
  }
  let frase = 'Los ' + total + ' pendientes concilian: '
    + (partes.length ? partes.join(' + ') : 'ninguno') + ' = ' + total + '.';
  const noAplica = conteo.reduce((a, c) => a + c.noAplica, 0);
  if (noAplica > 0) {
    const partesNa = [];
    for (const c of conteo) {
      if (c.noAplica === 0) continue;
      partesNa.push(c.noAplica + ' del bloque ' + c.n);
    }
    frase += ' Los ' + noAplica + ' que no aplican: ' + partesNa.join(' + ') + '.';
  }
  return frase;
}

/**
 * Ubica el bloque de la tabla resumen.
 * @param {string[]} lineas
 * @returns {{inicio: number, fin: number}}
 */
function _ubicarTabla(lineas) {
  let inicio = -1;
  for (let i = 0; i < lineas.length; i++) {
    if (/^\|\s*Bloque/.test(lineas[i])) { inicio = i; break; }
  }
  if (inicio < 0) throw new Error('No se encontro la cabecera de la tabla resumen.');
  // El bloque de la tabla va de la cabecera hasta la ultima fila que empieza
  // por "|". Asi una tabla con solo cabecera y separador (la primera vez)
  // tambien es un bloque valido y se puede regenerar.
  let fin = inicio;
  for (let i = inicio + 1; i < lineas.length; i++) {
    if (!/^\s*\|/.test(lineas[i])) break;
    fin = i;
  }
  return { inicio: inicio, fin: fin };
}

/**
 * Parte un texto en lineas sin perder el EOL original.
 * @param {string} texto
 * @returns {string[]}
 */
function _lineas(texto) {
  return texto.split('\n');
}

/**
 * Dobla un texto a un ancho dado, sin partir palabras.
 * @param {string} texto
 * @param {number} ancho
 * @returns {string[]}
 */
function _doblar(texto, ancho) {
  const palabras = texto.split(' ');
  const out = [];
  let actual = '';
  for (const p of palabras) {
    if (actual === '') {
      actual = p;
    } else if ((actual + ' ' + p).length <= ancho) {
      actual += ' ' + p;
    } else {
      out.push(actual);
      actual = p;
    }
  }
  if (actual !== '') out.push(actual);
  return out;
}

/**
 * Ejecuta la verificacion (y, si se pide, escribe la tabla y la frase).
 * @param {string} rutaDoc
 * @param {boolean} escribir
 * @returns {number} el codigo de salida.
 */
function correr(rutaDoc, escribir) {
  if (!fs.existsSync(rutaDoc)) {
    console.error('No existe el mapa: ' + rutaDoc);
    return 2;
  }
  const texto = fs.readFileSync(rutaDoc, 'utf8');
  const parseo = _parsear(texto);
  const problemas = parseo.errores.concat(_verificarIds(parseo.bloques));

  const conteo = _contar(parseo.bloques);
  const tabla = _armarTabla(conteo);
  const frase = _armarFrase(conteo);

  // La tabla del documento tiene que ser EXACTAMENTE la que sale del conteo.
  const lineas = _lineas(texto);
  let inicio = -1, fin = -1;
  try {
    const u = _ubicarTabla(lineas);
    inicio = u.inicio; fin = u.fin;
    const actual = lineas.slice(inicio, fin + 1).join('\n');
    const esperada = tabla.join('\n');
    if (actual !== esperada) {
      problemas.push(
        'La tabla resumen NO cuadra con el conteo real. '
          + (escribir ? 'Se regenero.' : 'Corre con --escribir.')
      );
    }
  } catch (e) {
    problemas.push(e.message);
  }

  // La frase de conciliacion, si esta, tambien se compara.
  if (inicio >= 0) {
    let i = fin + 1;
    while (i < lineas.length && lineas[i].trim() === '') i++;
    if (i < lineas.length && lineas[i].indexOf('Los ') === 0) {
      const esperada = _doblar(frase, ANCHO).join('\n');
      if (lineas[i] !== esperada.split('\n')[0]) {
        problemas.push(
          'La frase de conciliacion NO cuadra con el conteo real. '
            + (escribir ? 'Se regenero.' : 'Corre con --escribir.')
        );
      }
    }
  }

  if (escribir && problemas.length) {
    // Se escribe igual: la tabla y la frase salen del conteo, que es la
    // verdad; los problemas que quedan son de IDs, no de numeros.
    const nuevo = _reescribir(texto, tabla, frase);
    fs.writeFileSync(rutaDoc, nuevo, 'utf8');
    console.log('Tabla y frase regeneradas desde el conteo real.');
  }

  if (problemas.length) {
    console.error('\nEl mapa NO cuadra:');
    problemas.forEach((p) => console.error('  - ' + p));
    console.error('');
    console.error('Bloques encontrados: ' + parseo.bloques.length
      + ' | declarados: ' + _idsEsperados().length);
    return 1;
  }

  console.log('El mapa cuadra: ' + parseo.bloques.length + ' bloques.');
  const tot = conteo.reduce(
    (a, c) => ({
      cerrados: a.cerrados + c.cerrados,
      pendientes: a.pendientes + c.pendientes,
      noAplica: a.noAplica + c.noAplica,
    }),
    { cerrados: 0, pendientes: 0, noAplica: 0 }
  );
  console.log('  cerrados: ' + tot.cerrados + ' | pendientes: ' + tot.pendientes
    + ' | no aplica: ' + tot.noAplica);
  return 0;
}

/**
 * Reemplaza la tabla y la frase de conciliacion del documento.
 * @param {string} texto
 * @param {string[]} tabla
 * @param {string} frase
 * @returns {string}
 */
function _reescribir(texto, tabla, frase) {
  const lineas = _lineas(texto);
  const u = _ubicarTabla(lineas);
  const antes = lineas.slice(0, u.inicio);
  const despues = lineas.slice(u.fin + 1);
  // Se descarta la frase vieja (si la hay) y se pone la nueva.
  let i = 0;
  while (i < despues.length && despues[i].trim() === '') i++;
  if (i < despues.length && despues[i].indexOf('Los ') === 0) despues.splice(i, 1);
  const fraseDoblada = _doblar(frase, ANCHO);
  return antes.concat(tabla, [''], fraseDoblada, despues.slice(i)).join('\n');
}

module.exports = {
  correr: correr,
  _parsear: _parsear,
  _contar: _contar,
  _armarTabla: _armarTabla,
  _armarFrase: _armarFrase,
  _estadoDeClave: _estadoDeClave,
  SECCIONES: SECCIONES,
};

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.indexOf('--ayuda') >= 0) {
    console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace('/**', ''));
    process.exit(0);
  }
  const escribir = args.indexOf('--escribir') >= 0;
  const deDoc = (args.find((a) => a.indexOf('--doc=') === 0) || '').split('=')[1];
  const rutaDoc = deDoc ? path.resolve(deDoc) : RUTA_DOC;
  process.exit(correr(rutaDoc, escribir));
}
