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
 * 7. Verifica el enlace con la TABLA DE SOLICITUDES: la solicitud que un
 *    bloque invoca tiene que existir en la tabla, y una solicitud de la tabla
 *    tiene que estar referenciada por un bloque. Un bloque "cerrado" que
 *    invoca una solicitud inexistente es un verde falso, y una solicitud
 *    huerfana es un pedido que nadie pidio.
 * 8. La frase de conciliacion nombra las solicitudes y su estado, para que un
 *    mapa con 30 bloques cerrados y 21 solicitudes sin responder no se lea
 *    como "listo para abrir".
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
 * QUE SIGNIFICA "CERRADO" (criterio del 13-nov-2026)
 * ---------------------------------------------------
 * Un bloque CERRADO significa: "el pedido esta emitido y medido". El acto de
 * un tercero (una firma, una credencial, una ventana, una respuesta) NO es
 * lo que cierra el bloque: lo que lo cierra es que el pedido salio, con su
 * destinatario, su fecha y su verificacion. Los actos de terceros se siguen
 * en la tabla de solicitudes, con su estado.
 *
 * La clave de un bloque cerrado por solicitud lo dice:
 *   "### M.5 - <titulo> - CERRADO. Solicitud S-01 emitida el 13-nov-2026"
 * y el script comprueba que esa S-01 exista en la tabla.
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
/**
 * La tabla de solicitudes, relativo a este script.
 *
 * Es la fuente de la verdad de los actos de terceros: cada pendiente que se
 * pidio por escrito tiene su fila (estado, destinatario, fecha y
 * verificacion). El mapa dice que bloques se cerraron "por solicitud"; este
 * archivo dice CUAL solicitud, y si ya la respondieron.
 */
const RUTA_SOLICITUDES = path.resolve(
  __dirname, '..', '..', 'docs', 'gestion-humana', 'firma-electronica',
  'tabla-de-solicitudes-2026-11-13.md'
);

/** Los estados que una solicitud puede tener. */
const ESTADOS_SOLICITUD = ['PREPARADA', 'EMITIDA', 'RESPONDIDA', 'CERRADA'];

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
      // Las solicitudes que este bloque invoca en su clave (por ejemplo
      // "CERRADO. Solicitud S-01 emitida el 13-nov-2026"). Un bloque puede
      // invocar mas de una: un acto puede tener su parte juridica y su parte
      // de ejecucion.
      solicitudes: (clave.match(/\bS-\d+\b/g) || []),
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
 * Parsea la tabla de solicitudes.
 *
 * Cada fila es "| S-XX | bloque | destinatario | que se pide | como se
 * verifica | estado | vence |". El estado se reconoce por su palabra, no por
 * su posicion: si la tabla cambia de columnas, el parser sigue leyendo la
 * misma celda.
 *
 * @param {string} texto
 * @returns {{solicitudes: Array, errores: string[]}}
 */
function _parsearSolicitudes(texto) {
  const solicitudes = [];
  const errores = [];
  const lineas = texto.split('\n');
  for (const linea of lineas) {
    const m = /^\|\s*(S-\d+)\s*\|/.exec(linea);
    if (!m) continue;
    const id = m[1];
    const celdas = linea.split('|').map((c) => c.trim()).filter((c) => c !== '');
    let estado = null;
    for (const c of celdas) {
      if (ESTADOS_SOLICITUD.indexOf(c.toUpperCase()) >= 0) {
        estado = c.toUpperCase();
        break;
      }
    }
    if (!estado) {
      errores.push(
        'La solicitud ' + id + ' no declara un estado que se reconozca ('
          + ESTADOS_SOLICITUD.join(', ') + ').'
      );
      continue;
    }
    const bloque = (celdas[1] || '').match(/M\.\d+/);
    solicitudes.push({
      id: id,
      estado: estado,
      bloque: bloque ? bloque[0] : '',
      celdas: celdas,
    });
  }
  return { solicitudes: solicitudes, errores: errores };
}

/**
 * Ata los bloques del mapa con la tabla de solicitudes.
 *
 * El control que muerde: un bloque que dice "CERRADO. Solicitud S-01" tiene
 * que existir en la tabla, y una solicitud que esta en la tabla tiene que
 * estar referenciada por algun bloque. Si uno de los dos lados se desincroniza,
 * el verificador falla: un bloque "cerrado" que no tiene solicitud es un
 * verde falso, y una solicitud huerfana es un pedido que nadie pedio.
 *
 * @param {Array} bloques
 * @param {Array} solicitudes
 * @returns {string[]} los problemas encontrados (vacio si todo cuadra).
 */
function _verificarSolicitudes(bloques, solicitudes) {
  const problemas = [];
  const porId = {};
  for (const s of solicitudes) porId[s.id] = s;
  const referenciadas = {};
  for (const b of bloques) {
    for (const id of b.solicitudes) {
      referenciadas[id] = true;
      if (!porId[id]) {
        problemas.push(
          'El bloque ' + b.id + ' invoca la solicitud ' + id + ', que no esta en la tabla de solicitudes.'
        );
      }
    }
    if (b.estado === 'cerrado' && b.solicitudes.length === 0) {
      // No es un error: hay bloques cerrados que no dependen de ninguna
      // solicitud. Se cuenta aparte para poder informarlo.
      b.sinSolicitud = true;
    }
  }
  for (const s of solicitudes) {
    if (!referenciadas[s.id]) {
      problemas.push(
        'La solicitud ' + s.id + ' esta en la tabla pero ningun bloque la invoca.'
      );
    }
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
 *
 * La frase dice las DOS cosas: cuantos pendientes quedan, y cuantos bloques
 * "cerrados" lo estan porque su pedido salio. Sin la segunda parte, un mapa
 * con 30 cerrados y 21 solicitudes sin responder es un verde falso.
 *
 * @param {Array} conteo
 * @param {Array} solicitudes
 * @returns {string}
 */
function _armarFrase(conteo, solicitudes) {
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
  if (solicitudes && solicitudes.length) {
    const porEstado = {};
    for (const s of solicitudes) porEstado[s.estado] = (porEstado[s.estado] || 0) + 1;
    const detalle = ESTADOS_SOLICITUD
      .filter((e) => porEstado[e])
      .map((e) => porEstado[e] + ' ' + e);
    frase += ' Las ' + solicitudes.length + ' solicitudes de la tabla'
      + ' (`tabla-de-solicitudes-2026-11-13.md`): ' + detalle.join(', ') + '.'
      + ' Cerrado en este mapa significa que el pedido esta emitido y medido,'
      + ' no que el acto este cumplido: cada acto de un tercero se sigue en esa tabla,'
      + ' con su estado, su destinatario y su fecha.';
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
 * Ubica la frase de conciliacion dentro de un bloque de lineas.
 *
 * La frase se dobla a un ancho fijo, asi que puede ocupar VARIAS lineas: se
 * toma la primera linea que no esta en blanco (si empieza con "Los ") y se
 * sigue mientras las lineas sigan sin estar en blanco.
 *
 * @param {string[]} lineas
 * @returns {{inicio: number, fin: number}}
 */
function _ubicarFrase(lineas) {
  let inicio = -1;
  for (let i = 0; i < lineas.length; i++) {
    if (lineas[i].trim() === '') continue;
    if (lineas[i].indexOf('Los ') === 0) inicio = i;
    break;
  }
  if (inicio < 0) return { inicio: -1, fin: -1 };
  let fin = inicio;
  for (let i = inicio; i < lineas.length; i++) {
    // El bloque de la frase termina en la primera linea en blanco, en un
    // encabezado o en un separador: lo que sigue no es parte de la frase.
    if (lineas[i].trim() === '') break;
    if (lineas[i].startsWith('#')) break;
    if (lineas[i].trim() === '---') break;
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
 * @param {string} [rutaSolicitudes] la tabla de solicitudes (por defecto, la del
 *   repositorio). Se puede apuntar a otra para probar el verificador sobre una
 *   COPIA, sin tocar el archivo real.
 * @returns {number} el codigo de salida.
 */
function correr(rutaDoc, escribir, rutaSolicitudes) {
  if (!fs.existsSync(rutaDoc)) {
    console.error('No existe el mapa: ' + rutaDoc);
    return 2;
  }
  const rutaSol = rutaSolicitudes || RUTA_SOLICITUDES;
  const texto = fs.readFileSync(rutaDoc, 'utf8');
  const parseo = _parsear(texto);
  const problemas = parseo.errores.concat(_verificarIds(parseo.bloques));

  // Las solicitudes: la tabla de actos de terceros. Cada bloque que dice
  // "CERRADO. Solicitud S-XX" tiene que tener su fila, y cada fila tiene que
  // estar referenciada por un bloque.
  let solicitudes = [];
  if (fs.existsSync(rutaSol)) {
    const ps = _parsearSolicitudes(fs.readFileSync(rutaSol, 'utf8'));
    solicitudes = ps.solicitudes;
    problemas.push(...ps.errores);
    problemas.push(..._verificarSolicitudes(parseo.bloques, solicitudes));
  } else {
    problemas.push('No existe la tabla de solicitudes: ' + rutaSol);
  }

  const conteo = _contar(parseo.bloques);
  const tabla = _armarTabla(conteo);
  const frase = _armarFrase(conteo, solicitudes);

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

  // La frase de conciliacion, si esta, tambien se compara. Se compara
  // COMPLETA: ahora puede ocupar varias lineas porque nombra las solicitudes.
  if (inicio >= 0) {
    const despuesDeTabla = lineas.slice(fin + 1);
    const u = _ubicarFrase(despuesDeTabla);
    if (u.inicio >= 0) {
      const esperada = _doblar(frase, ANCHO).join('\n');
      const actual = despuesDeTabla.slice(u.inicio, u.fin + 1).join('\n');
      if (actual !== esperada) {
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
  if (solicitudes.length) {
    const porEstado = {};
    for (const s of solicitudes) porEstado[s.estado] = (porEstado[s.estado] || 0) + 1;
    const detalle = ESTADOS_SOLICITUD.filter((e) => porEstado[e])
      .map((e) => porEstado[e] + ' ' + e).join(', ');
    console.log('  solicitudes: ' + solicitudes.length + ' (' + detalle + ')');
  }
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
  let despues = lineas.slice(u.fin + 1);
  // Se descarta la frase vieja (si la hay) COMPLETA: puede ocupar varias
  // lineas, porque se dobla a un ancho fijo.
  const p = _ubicarFrase(despues);
  if (p.inicio >= 0) {
    despues = despues.slice(0, p.inicio).concat(despues.slice(p.fin + 1));
  }
  let i = 0;
  while (i < despues.length && despues[i].trim() === '') i++;
  const fraseDoblada = _doblar(frase, ANCHO);
  // La tabla, un blanco, la frase y un blanco: la frase nunca se come el
  // separador que viene despues.
  return antes.concat(tabla, [''], fraseDoblada, [''], despues.slice(i)).join('\n');
}

module.exports = {
  correr: correr,
  _parsear: _parsear,
  _parsearSolicitudes: _parsearSolicitudes,
  _verificarSolicitudes: _verificarSolicitudes,
  _contar: _contar,
  _armarTabla: _armarTabla,
  _armarFrase: _armarFrase,
  _estadoDeClave: _estadoDeClave,
  SECCIONES: SECCIONES,
  ESTADOS_SOLICITUD: ESTADOS_SOLICITUD,
  RUTA_SOLICITUDES: RUTA_SOLICITUDES,
};

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.indexOf('--ayuda') >= 0) {
    console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace('/**', ''));
    process.exit(0);
  }
  const escribir = args.indexOf('--escribir') >= 0;
  const deDoc = (args.find((a) => a.indexOf('--doc=') === 0) || '').split('=')[1];
  const deSol = (args.find((a) => a.indexOf('--solicitudes=') === 0) || '').split('=')[1];
  const rutaDoc = deDoc ? path.resolve(deDoc) : RUTA_DOC;
  const rutaSol = deSol ? path.resolve(deSol) : RUTA_SOLICITUDES;
  process.exit(correr(rutaDoc, escribir, rutaSol));
}
