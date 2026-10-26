#!/usr/bin/env node
/**
 * scripts/empalmar-acuerdo-v1.1.js
 *
 * ARMA el texto del Acuerdo v1.1 a partir de la v1.0 sellada y del texto
 * final que entregó el abogado (respuesta 11A).
 *
 * POR QUÉ EXISTE ESTE SCRIPT
 * --------------------------
 * El empalme de la v1.1 estaba escrito como un documento markdown (el mapa de
 * empalme): decía QUÉ numerales cambian, pero no había una máquina que los
 * empalmara. Armar el archivo a mano significa transcribir un texto legal
 * desde un documento que no es el texto: un cambio de una palabra es un bug
 * legal, no un typo.
 *
 * Este script hace el empalme de forma reproducible:
 *   1. Lee la v1.0 sellada (scripts/fixtures/acuerdo-v1.0.txt). NO la toca.
 *   2. Lee el JSON de cambios (scripts/fixtures/acuerdo-v1.1-cambios.json),
 *      que tiene el texto final de cada numeral, copiado íntegro del .txt
 *      del abogado.
 *   3. Reemplaza el texto de los numerales que cambian y deja intactos los
 *      que no cambian.
 *   4. Verifica el texto resultante con `analizarTextoLegal` (el MISMO módulo
 *      que usa la guarda de publicación: src/utils/textoLegal.js).
 *   5. Si el texto no tiene placeholders ni marcas de borrador, escribe
 *      scripts/fixtures/acuerdo-v1.1.txt (LF, sin BOM) e imprime su huella.
 *      Si tiene placeholders, NO escribe nada: imprime el reporte de lo que
 *      falta y sale con código 2.
 *
 * REGLAS
 * ------
 *   1. La v1.0 no se modifica: es la base, y está sellada.
 *   2. El texto del abogado se copia tal cual. El script no reescribe, no
 *      parafrasea y no reordena nada: solo cambia de sitio un bloque de texto
 *      que ya viene escrito.
 *   3. Idempotente: correrlo dos veces da el mismo resultado. La base siempre
 *      se relee del disco; la salida nunca es la entrada.
 *
 * Uso:
 *   node scripts/empalmar-acuerdo-v1.1.js
 *   node scripts/empalmar-acuerdo-v1.1.js --version=v1.1
 *   node scripts/empalmar-acuerdo-v1.1.js --salida=otra/ruta.txt
 *   node scripts/empalmar-acuerdo-v1.1.js --reporte=reporte-placeholders.txt
 *
 * Exit codes:
 *   0 = texto listo (sin placeholders), archivo escrito
 *   2 = hay placeholders: NO se escribió el archivo
 *   3 = error (archivos que faltan, JSON ilegible, numeral que no calza)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  analizarTextoLegal,
  listarPlaceholders,
  esVersionSujetaAGuarda,
  esPlaceholderDelSistema,
  buscarPlaceholders,
} = require('../src/utils/textoLegal');

const SERVICE_ROOT = path.resolve(__dirname, '..');
const FIXTURES = path.resolve(__dirname, 'fixtures');

const DEFAULT_VERSION = 'v1.1';
const DEFAULT_BASE = path.join(FIXTURES, 'acuerdo-v1.0.txt');
const DEFAULT_CAMBIOS = path.join(FIXTURES, 'acuerdo-v1.1-cambios.json');
const DEFAULT_DATOS = path.join(FIXTURES, 'acuerdo-v1.1-datos.json');
const DEFAULT_SALIDA = path.join(FIXTURES, 'acuerdo-v1.1.txt');
const MANIFIESTO = path.join(FIXTURES, 'acuerdo-ARCHIVO.json');
const MAPA_EMPALME = path.resolve(
  SERVICE_ROOT, '..', 'docs', 'gestion-humana', 'firma-electronica',
  'mapa-empalme-v1.1-2026-10-23.md'
);

// ---------------------------------------------------------------------------
// Estructura del texto del Acuerdo
// ---------------------------------------------------------------------------

// Numeral de primer nivel: "1.2. " al principio de una línea.
// OJO: los números de LEY (2.2.2.47.7) NO llevan espacio después del
// segundo punto, así que no se confunden con un numeral del Acuerdo.
const RE_NUMERAL = /^(\d+\.\d+)\. /;

// Literal subordinado: "    a) " o "a) " al principio de una línea.
const RE_LITERAL = /^(\s*)([a-z])\) /;

// Encabezado de capítulo y título de capítulo ("1. IDENTIFICACIÓN ...").
const RE_CAPITULO = /^CAPÍTULO [IVXLCDM]+\. /;
const RE_TITULO_CAPITULO = /^\d+\. [A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ0-9 ,.()\-]*$/;
const RE_MANIFESTACION = /^MANIFESTACIÓN DE VOLUNTAD$/;

// Los placeholders se buscan con `buscarPlaceholders` del módulo compartido:
// el MISMO criterio (y la MISMA excepción) que usa la guarda de publicación.
// Este script no lleva su propia copia del patrón: una copia se desincroniza
// y el reporte termina mintiendo sobre lo que bloquea.

const LITERAL_NIVEL = /^\d+\.\d+\(([a-z])\)$/;

// La versión del Acuerdo aparece en DOS lugares del texto: el encabezado
// ("Versión del Acuerdo: vX") y el bloque de Manifestación de Voluntad
// ("...K+AIR, versión vX, que se me ha presentado en pantalla"). Los dos tienen
// que decir lo mismo, y tienen que decir la versión que se está armando.
const RE_VERSION_ENCABEZADO = /^(Versión del Acuerdo:[ \t]*)v(\d+\.\d+)([ \t]*)$/gm;
const RE_VERSION_MANIFESTACION = /versión v(\d+\.\d+)/g;

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function sha256(texto) {
  return crypto.createHash('sha256').update(texto, 'utf8').digest('hex');
}

/**
 * Un error del empalme. El codigo 3 es el que main() traduce a "salir con 3":
 * el empalme no se puede hacer, y el archivo de salida no se escribe.
 *
 * @param {string} mensaje
 * @returns {Error}
 */
function errorEmpalme(mensaje) {
  const error = new Error(mensaje);
  error.codigo = 3;
  return error;
}

function parseArgs(argv) {
  const args = {
    version: DEFAULT_VERSION,
    base: DEFAULT_BASE,
    cambios: DEFAULT_CAMBIOS,
    datos: DEFAULT_DATOS,
    salida: DEFAULT_SALIDA,
    reporte: null,
  };
  const lista = Array.isArray(argv) ? argv : process.argv;
  for (let i = 2; i < lista.length; i++) {
    const a = lista[i];
    if (a.startsWith('--version=')) args.version = a.slice('--version='.length).trim();
    else if (a.startsWith('--base=')) args.base = path.resolve(a.slice('--base='.length).trim());
    else if (a.startsWith('--cambios=')) args.cambios = path.resolve(a.slice('--cambios='.length).trim());
    else if (a.startsWith('--datos=')) args.datos = path.resolve(a.slice('--datos='.length).trim());
    else if (a.startsWith('--salida=')) args.salida = path.resolve(a.slice('--salida='.length).trim());
    else if (a.startsWith('--reporte=')) args.reporte = path.resolve(a.slice('--reporte='.length).trim());
    else if (a === '--help' || a === '-h') {
      printHelp();
      process.exit(0);
    } else {
      console.error('Argumento desconocido: ' + a);
      printHelp();
      process.exit(2);
    }
  }
  return args;
}

function printHelp() {
  console.log(`
Uso: node scripts/empalmar-acuerdo-v1.1.js [opciones]

Arma el texto del Acuerdo v1.1 a partir de la v1.0 sellada y del texto final
del abogado (JSON de cambios). NO modifica la v1.0.

Opciones:
  --version=v1.1     Versión que se arma (default v1.1)
  --base=<ruta>      Texto base (default scripts/fixtures/acuerdo-v1.0.txt)
  --cambios=<ruta>   JSON con el texto final de cada numeral
                     (default scripts/fixtures/acuerdo-v1.1-cambios.json)
  --datos=<ruta>     JSON con los datos del owner que llenan los placeholders
                     (default scripts/fixtures/acuerdo-v1.1-datos.json).
                     Si el archivo no existe, el texto queda con huecos y no
                     se escribe: es lo que hoy impide publicar la v1.1.
  --salida=<ruta>    Archivo a escribir cuando el texto no tenga placeholders
                     (default scripts/fixtures/acuerdo-v1.1.txt)
  --reporte=<ruta>   Escribir el reporte de placeholders en ese archivo
                     (default: el reporte se imprime en la salida)
  -h, --help         Esta ayuda

Exit codes:
  0  texto listo, archivo escrito
  2  hay placeholders: NO se escribió el archivo
  3  error
`);
}

/**
 * Detecta si una línea abre un bloque del Acuerdo.
 * @param {string} linea
 * @param {string|null} numeralActual numeral vigente (para los literales)
 * @returns {{tipo: string, clave: string|null, indent: number}|null}
 */
function detectarMarca(linea, numeralActual) {
  const mNum = RE_NUMERAL.exec(linea);
  if (mNum) return { tipo: 'numeral', clave: mNum[1], indent: 0 };
  const mLit = RE_LITERAL.exec(linea);
  if (mLit && numeralActual) {
    return { tipo: 'literal', clave: numeralActual + '(' + mLit[2] + ')', indent: mLit[1].length };
  }
  if (RE_MANIFESTACION.test(linea)) {
    return { tipo: 'manifestacion', clave: 'MANIFESTACIÓN DE VOLUNTAD', indent: 0 };
  }
  if (RE_CAPITULO.test(linea) || RE_TITULO_CAPITULO.test(linea)) {
    return { tipo: 'capitulo', clave: null, indent: 0 };
  }
  return null;
}

/**
 * Parte el texto del Acuerdo en bloques.
 *
 * Un bloque es una marca (numeral, literal, capítulo) más su párrafo corrido:
 * las líneas que siguen sin dejar una línea en blanco y sin abrir otra marca.
 * Los huecos (líneas en blanco y párrafos sueltos) quedan como bloques de
 * texto libre y no se tocan nunca.
 *
 * @param {string} texto
 * @returns {{bloques: Array, lineas: string[]}}
 */
function analizarEstructura(texto) {
  const lineas = texto.split('\n');
  const bloques = [];
  let numeralActual = null;
  let i = 0;

  while (i < lineas.length) {
    const marca = detectarMarca(lineas[i], numeralActual);
    if (!marca) {
      let j = i;
      while (j < lineas.length && !detectarMarca(lineas[j], numeralActual)) j++;
      bloques.push({ tipo: 'texto', clave: null, inicio: i, fin: j - 1, indent: 0 });
      i = j;
      continue;
    }
    if (marca.tipo === 'numeral') numeralActual = marca.clave;
    let j = i;
    while (
      j + 1 < lineas.length
      && lineas[j + 1].trim() !== ''
      && !detectarMarca(lineas[j + 1], numeralActual)
    ) {
      j++;
    }
    bloques.push({
      tipo: marca.tipo,
      clave: marca.clave,
      inicio: i,
      fin: j,
      indent: marca.indent,
    });
    i = j + 1;
  }

  return { bloques, lineas };
}

/**
 * Indenta un texto multilínea con el mismo margen que el bloque que reemplaza.
 * @param {string} texto
 * @param {number} margen
 * @returns {string[]}
 */
function indentar(texto, margen) {
  const prefijo = margen > 0 ? ' '.repeat(margen) : '';
  return texto.split('\n').map((l) => (l === '' ? '' : prefijo + l));
}

/**
 * Lee la lista de numerales que cambian del mapa de empalme.
 * El mapa es el CHECKLIST de cobertura: si un numeral del mapa no está en el
 * JSON de cambios, se avisa (para que no se pierda ninguno).
 * @param {string} ruta
 * @returns {string[]}
 */
function leerNumeralesDelMapa(ruta) {
  if (!fs.existsSync(ruta)) return [];
  const lineas = fs.readFileSync(ruta, 'utf8').split(/\r?\n/);
  const numeros = [];
  let dentro = false;
  for (const linea of lineas) {
    if (/^##\s/.test(linea)) {
      dentro = /^##\s*1\.\s/.test(linea);
      continue;
    }
    if (!dentro) continue;
    const celda = /^\|\s*([^|]+?)\s*\|/.exec(linea);
    if (!celda) continue;
    const valor = celda[1].trim();
    if (/^\d+(\.\d+)?(\([a-z]\))?$/.test(valor)) numeros.push(valor);
  }
  return numeros;
}

/**
 * Sella la versión en el texto.
 *
 * El Acuerdo nombra su versión en dos lugares: el encabezado ("Versión del
 * Acuerdo: vX") y el bloque de Manifestación de Voluntad ("...K+AIR, versión
 * vX, que se me ha presentado en pantalla"). Si lo que se publica es la v1.1 y
 * el texto sigue diciendo "v1.0", el trabajador acepta una versión distinta de
 * la que se le muestra: el documento miente, y el readiness lo rechaza
 * (`Versión del Acuerdo: v1.1`).
 *
 * El sello NO es texto del abogado: es una propiedad de la versión. Por eso no
 * va en el mapa de cambios (que es el texto del abogado, copiado íntegro) sino
 * aquí, con la versión que el propio JSON de cambios declara.
 *
 * Las reglas son estrictas a propósito: si no hay exactamente una mención de
 * cada lado, o si el encabezado y la Manifestación no coinciden, el script se
 * niega. Un sello a ciegas es peor que no sellar.
 *
 * @param {string} texto
 * @param {string} versionNueva con la 'v', por ejemplo 'v1.1'
 * @returns {{texto: string, sellado: boolean, versionBase: string, versionNueva: string}}
 */
function sellarVersion(texto, versionNueva) {
  const encabezado = [...texto.matchAll(RE_VERSION_ENCABEZADO)];
  const manifestacion = [...texto.matchAll(RE_VERSION_MANIFESTACION)];

  if (encabezado.length !== 1) {
    throw errorEmpalme(
      'El texto tiene ' + encabezado.length + ' líneas "Versión del Acuerdo: vX"; '
      + 'se necesita exactamente una para poder sellar la versión.',
    );
  }
  if (manifestacion.length !== 1) {
    throw errorEmpalme(
      'El texto tiene ' + manifestacion.length + ' menciones de "versión vX" '
      + 'en el bloque de Manifestación de Voluntad; se necesita exactamente una.',
    );
  }
  const versionBase = 'v' + encabezado[0][2];
  const versionDeLaManifiestacion = 'v' + manifestacion[0][1];
  if (versionBase !== versionDeLaManifiestacion) {
    throw errorEmpalme(
      'El encabezado dice "' + versionBase + '" y el bloque de Manifestación dice "'
      + versionDeLaManifiestacion + '": el texto no es coherente consigo mismo y no se puede sellar.',
    );
  }
  if (versionBase === versionNueva) {
    // El texto ya es de la versión que se está armando: no hay nada que sellar,
    // pero ya se verificó que las dos menciones coinciden.
    return { texto, sellado: false, versionBase, versionNueva };
  }

  const sellado = texto
    .replace(RE_VERSION_ENCABEZADO, (m, pre, _v, post) => pre + versionNueva + post)
    .replace(RE_VERSION_MANIFESTACION, () => 'versión ' + versionNueva);

  // Verificar DESPUÉS: el sello tiene que haber quedado, y solo una vez.
  const encabezadoFinal = [...sellado.matchAll(RE_VERSION_ENCABEZADO)];
  const manifestacionFinal = [...sellado.matchAll(RE_VERSION_MANIFESTACION)];
  if (encabezadoFinal.length !== 1
    || encabezadoFinal[0][2] !== versionNueva.replace(/^v/, '')) {
    throw errorEmpalme('El sello del encabezado no quedó bien aplicado.');
  }
  if (manifestacionFinal.length !== 1
    || manifestacionFinal[0][1] !== versionNueva.replace(/^v/, '')) {
    throw errorEmpalme('El sello del bloque de Manifestación no quedó bien aplicado.');
  }
  return { texto: sellado, sellado: true, versionBase, versionNueva };
}

/**
 * Sella la fecha de vigencia en el encabezado.
 *
 * La fecha es una propiedad de la versión, igual que el número: no va en el
 * mapa de cambios. Se escribe en una línea propia, inmediatamente después de
 * "Versión del Acuerdo: vX". Si el texto ya trae una línea "Fecha de vigencia:",
 * se reemplaza (para que el empalme sea idempotente); si hay más de una, se
 * niega. Si el JSON no declara `fecha_vigencia`, no se toca nada: los tests
 * sintéticos y las versiones anteriores siguen funcionando.
 *
 * @param {string} texto
 * @param {string|undefined} fecha
 * @returns {{texto: string, insertada: boolean, fecha: string|null}}
 */
function sellarFechaVigencia(texto, fecha) {
  if (fecha === undefined || fecha === null || fecha === '') {
    return { texto, insertada: false, fecha: null };
  }
  if (typeof fecha !== 'string') {
    throw errorEmpalme('La fecha de vigencia tiene que ser un texto.');
  }
  const limpia = fecha.trim().replace(/\.$/, '');
  if (!/^\d{1,2} de [a-záéíóúñ]+ de \d{4}$/i.test(limpia)) {
    throw errorEmpalme(
      'La fecha de vigencia "' + fecha + '" no tiene el formato "D de mes de AAAA".',
    );
  }
  const linea = 'Fecha de vigencia: ' + limpia + '.';
  const lineas = texto.split('\n');
  const versiones = lineas.filter((l) => l.startsWith('Versión del Acuerdo:'));
  if (versiones.length !== 1) {
    throw errorEmpalme(
      'El texto tiene ' + versiones.length + ' líneas "Versión del Acuerdo:"; '
      + 'se necesita exactamente una para insertar la fecha de vigencia.',
    );
  }
  const fechas = lineas
    .map((l, i) => ({ linea: l, indice: i }))
    .filter((x) => x.linea.startsWith('Fecha de vigencia:'));
  if (fechas.length > 1) {
    throw errorEmpalme(
      'El texto tiene ' + fechas.length + ' líneas "Fecha de vigencia:"; '
      + 'se necesita como máximo una.',
    );
  }
  if (fechas.length === 1) {
    lineas[fechas[0].indice] = linea;
    return { texto: lineas.join('\n'), insertada: false, fecha: limpia };
  }
  const indiceVersion = lineas.findIndex((l) => l.startsWith('Versión del Acuerdo:'));
  lineas.splice(indiceVersion + 1, 0, linea);
  return { texto: lineas.join('\n'), insertada: true, fecha: limpia };
}

/**
 * Sustituye los placeholders del texto con los datos del owner.
 *
 * Los datos van en un archivo aparte del mapa de cambios: el mapa es el texto
 * del abogado copiado íntegro, y estos valores son del owner. La sustitución es
 * mecánica, pero no a ciegas:
 *
 *  - cada placeholder tiene que aparecer EXACTAMENTE una vez;
 *  - el valor no puede traer corchetes (sería otro placeholder);
 *  - al terminar no puede quedar ningún hueco: si queda, el texto no se publica.
 *
 * @param {string} texto
 * @param {object|null} datos { version, datos: { id: {placeholder, valor} } }
 * @returns {{texto: string, aplicados: string[], huecosRestantes: number}}
 */
function sustituirDatos(texto, datos) {
  const entradas = datos && datos.datos ? datos.datos : null;
  if (!entradas || Object.keys(entradas).length === 0) {
    return { texto, aplicados: [], huecosRestantes: listarPlaceholders(texto).huecos.total };
  }
  let salida = texto;
  const aplicados = [];
  for (const [id, entrada] of Object.entries(entradas)) {
    const placeholder = entrada && entrada.placeholder;
    const valor = entrada && entrada.valor;
    if (typeof placeholder !== 'string' || placeholder.length === 0) {
      throw errorEmpalme('El dato "' + id + '" no dice qué placeholder reemplaza.');
    }
    if (typeof valor !== 'string' || valor.length === 0) {
      throw errorEmpalme('El dato "' + id + '" no tiene valor.');
    }
    if (/[\[\]]/.test(valor)) {
      throw errorEmpalme(
        'El valor del dato "' + id + '" trae corchetes: seria otro placeholder.',
      );
    }
    const ocurrencias = salida.split(placeholder).length - 1;
    if (ocurrencias !== 1) {
      throw errorEmpalme(
        'El placeholder ' + placeholder + ' (dato "' + id + '") aparece ' + ocurrencias
        + ' veces en el texto; tiene que aparecer exactamente una.',
      );
    }
    salida = salida.split(placeholder).join(valor);
    aplicados.push(id);
  }
  const huecosRestantes = listarPlaceholders(salida).huecos.total;
  if (huecosRestantes > 0) {
    throw errorEmpalme(
      'Despues de sustituir los datos quedan ' + huecosRestantes + ' hueco(s) sin llenar: '
      + listarPlaceholders(salida).huecos.unicos.join(' '),
    );
  }
  return { texto: salida, aplicados, huecosRestantes };
}

/**
 * Arma el texto: aplica los cambios sobre la estructura de la base.
 *
 * @param {string} textoBase
 * @param {object} cambios  { version, cambios, inserciones, absorbe }
 * @param {object} [datos]  { version, datos: { id: {placeholder, valor} } }
 * @returns {{texto: string, resumen: object}}
 */
function empalmar(textoBase, cambios, datos) {
  const { bloques, lineas } = analizarEstructura(textoBase);

  const porClave = new Map();
  for (const b of bloques) {
    if (b.clave && !porClave.has(b.clave)) porClave.set(b.clave, b);
  }

  const mapaCambios = cambios.cambios || {};
  const inserciones = cambios.inserciones || {};
  const absorbe = cambios.absorbe || {};

  const ops = [];
  const aplicados = [];
  const insertados = [];
  const absorbidos = [];

  // 1. Reemplazos (numerales y literales que ya existen en la base).
  for (const clave of Object.keys(mapaCambios)) {
    const bloque = porClave.get(clave);
    if (!bloque) {
      if (inserciones[clave]) continue; // es un numeral nuevo: se inserta abajo
      const error = new Error(
        'El numeral "' + clave + '" está en el JSON de cambios pero no existe en la base. '
        + 'Revisar el empalme.'
      );
      error.codigo = 3;
      throw error;
    }
    ops.push({
      tipo: 'reemplazar',
      inicio: bloque.inicio,
      fin: bloque.fin,
      lineas: indentar(mapaCambios[clave], bloque.indent),
      clave,
    });
    aplicados.push(clave);
  }

  // 2. Literales absorbidos: el texto nuevo del numeral padre ya trae el
  //    literal dentro, así que el literal viejo se borra (con su línea en
  //    blanco de separación).
  for (const clave of Object.keys(mapaCambios)) {
    const lista = absorbe[clave];
    if (!lista) continue;
    const padre = porClave.get(clave);
    if (!padre) continue;
    for (const letra of lista) {
      const literal = porClave.get(clave + '(' + letra + ')');
      if (!literal) continue;
      let inicio = literal.inicio;
      if (inicio > 0 && lineas[inicio - 1].trim() === '') inicio -= 1;
      ops.push({ tipo: 'borrar', inicio, fin: literal.fin, lineas: [], clave: clave + '(' + letra + ')' });
      absorbidos.push(clave + '(' + letra + ')');
    }
  }

  // 3. Inserciones: numerales que el abogado creó y que no existían en la v1.0.
  for (const clave of Object.keys(inserciones)) {
    const textoNuevo = mapaCambios[clave];
    if (typeof textoNuevo !== 'string') {
      const error = new Error(
        'El numeral "' + clave + '" está en "inserciones" pero no tiene texto en "cambios".'
      );
      error.codigo = 3;
      throw error;
    }
    const ancla = porClave.get(inserciones[clave]);
    if (!ancla) {
      const error = new Error(
        'El numeral "' + clave + '" se debe insertar después de "' + inserciones[clave]
        + '", y ese ancla no existe en la base.'
      );
      error.codigo = 3;
      throw error;
    }
    if (porClave.has(clave)) {
      const error = new Error(
        'El numeral "' + clave + '" está marcado como inserción, pero ya existe en la base.'
      );
      error.codigo = 3;
      throw error;
    }
    ops.push({
      tipo: 'insertar',
      inicio: ancla.fin + 1,
      fin: ancla.fin,
      lineas: [''].concat(indentar(textoNuevo, ancla.indent)),
      clave,
    });
    insertados.push(clave);
  }

  // 4. Aplicar las operaciones sobre las líneas de la base.
  ops.sort((a, b) => (a.inicio - b.inicio) || (a.fin - b.fin));
  const salida = [];
  let cursor = 0;
  for (const op of ops) {
    if (op.inicio < cursor) {
      const error = new Error('Operaciones que se pisan sobre "' + op.clave + '".');
      error.codigo = 3;
      throw error;
    }
    for (const l of lineas.slice(cursor, op.inicio)) salida.push(l);
    for (const l of op.lineas) salida.push(l);
    cursor = op.fin + 1;
  }
  for (const l of lineas.slice(cursor)) salida.push(l);

  let texto = salida.join('\n');

  // 4b. Sello de versión. El texto nombra la versión en el encabezado y en el
  //     bloque de Manifestación de Voluntad; si se está armando una versión
  //     nueva, los dos tienen que pasar a esa versión. Se hace acá y no en el
  //     mapa de cambios porque el mapa es el texto del abogado, copiado
  //     íntegro, y el sello no es suyo: es una propiedad de la versión.
  if (!cambios.version) {
    throw errorEmpalme(
      'El JSON de cambios no declara la versión ("version"). Sin eso no se sabe '
      + 'qué versión hay que sellar en el texto.',
    );
  }
  const sello = sellarVersion(texto, cambios.version);
  texto = sello.texto;

  // 4b-bis. Fecha de vigencia: otra propiedad de la versión, no del texto del
  //         abogado. Va en una línea propia después del número de versión.
  const fecha = sellarFechaVigencia(texto, cambios.fecha_vigencia);
  texto = fecha.texto;

  // 4b-ter. Reemplazos de texto libre que no caen dentro de un numeral o
  //         literal (por ejemplo, el párrafo de cierre del 10.3). Se exige
  //         coincidencia exacta y única: si el texto base cambió, el empalme
  //         se niega en vez de aplicar un reemplazo a medias.
  const reemplazosTexto = cambios.reemplazos_texto || [];
  const reemplazosAplicados = [];
  for (const r of reemplazosTexto) {
    if (!r || typeof r.antiguo !== 'string' || typeof r.nuevo !== 'string') {
      throw errorEmpalme('Cada reemplazo de texto libre necesita "antiguo" y "nuevo".');
    }
    const ocurrencias = texto.split(r.antiguo).length - 1;
    if (ocurrencias !== 1) {
      throw errorEmpalme(
        'El reemplazo de texto libre "' + (r.motivo || 'sin motivo') + '" aparece '
        + ocurrencias + ' veces; tiene que aparecer exactamente una.',
      );
    }
    texto = texto.replace(r.antiguo, r.nuevo);
    reemplazosAplicados.push(r.motivo || 'sin motivo');
  }

  // 4c. Datos del owner: los placeholders que dejó el texto del abogado. Van
  //     en un archivo aparte; acá solo se sustituyen y se verifica que no
  //     quede ningún hueco.
  const sustitucion = sustituirDatos(texto, datos);
  texto = sustitucion.texto;

  // 5. Conteos para el resumen.
  const numerales = bloques.filter((b) => b.tipo === 'numeral');
  const literales = bloques.filter((b) => b.tipo === 'literal');
  const nivel1 = new Set(numerales.map((b) => b.clave));
  const nivel2 = new Set(literales.map((b) => b.clave));

  const cambiados1 = [...nivel1].filter((c) => aplicados.includes(c));
  const cambiados2 = [...nivel2].filter((c) => aplicados.includes(c));
  const absorbidas = [...nivel2].filter((c) => absorbidos.includes(c));
  const intactos1 = [...nivel1].filter((c) => !aplicados.includes(c));
  const intactos2 = [...nivel2].filter((c) => !aplicados.includes(c) && !absorbidos.includes(c));

  return {
    texto,
    resumen: {
      numeralesTotal: nivel1.size,
      numeralesCambiados: cambiados1.length,
      numeralesIntactos: intactos1.length,
      literalesTotal: nivel2.size,
      literalesCambiados: cambiados2.length,
      literalesAbsorbidos: absorbidas.length,
      literalesIntactos: intactos2.length,
      insertados,
      absorbidos,
      aplicados,
      sello: {
        sellado: sello.sellado,
        versionBase: sello.versionBase,
        versionNueva: sello.versionNueva,
      },
      fecha: {
        insertada: fecha.insertada,
        valor: fecha.fecha,
      },
      reemplazosTexto: reemplazosAplicados,
      datos: {
        aplicados: sustitucion.aplicados,
        huecosRestantes: sustitucion.huecosRestantes,
      },
    },
  };
}

/**
 * Localiza cada placeholder del texto y dice en qué numeral está.
 *
 * La ubicación se lleva por bloques: un numeral, un literal o un capítulo
 * fijan dónde estamos; los párrafos sueltos (el cierre de un numeral, la
 * Manifestación de Voluntad) heredan la ubicación del bloque anterior.
 *
 * @param {string} texto
 * @returns {Array<{placeholder: string, ubicacion: string, linea: number, tipo: string}>}
 */
function localizarPlaceholders(texto) {
  const { bloques, lineas } = analizarEstructura(texto);
  const encontrados = [];
  let ubicacion = 'preámbulo';
  for (const bloque of bloques) {
    if (bloque.tipo === 'numeral' || bloque.tipo === 'literal') ubicacion = bloque.clave;
    else if (bloque.tipo === 'manifestacion') ubicacion = bloque.clave;
    else if (bloque.tipo === 'capitulo') ubicacion = lineas[bloque.inicio].trim();
    for (let i = bloque.inicio; i <= bloque.fin && i < lineas.length; i++) {
      const linea = lineas[i];
      for (const m of buscarPlaceholders(linea)) {
        encontrados.push({
          placeholder: m.trim(),
          ubicacion,
          linea: i + 1,
          // 'hueco' es lo que alguien tiene que llenar; 'sistema' es un campo
          // que registra el propio sistema y no bloquea la publicación.
          tipo: esPlaceholderDelSistema(m) ? 'sistema' : 'hueco',
        });
      }
    }
  }
  return encontrados;
}

/**
 * Arma el texto de reporte de los placeholders.
 *
 * Distingue los huecos que el dueño tiene que llenar (los que trae el texto
 * nuevo del abogado) de los campos que registra el sistema. Los del bloque de
 * Manifestación de Voluntad los llena el sistema al firmar, no son un dato que
 * falte y NO bloquean la escritura del archivo: la guarda de publicación
 * cuenta los huecos, no los campos del sistema.
 *
 * @param {string} texto texto resultante
 * @param {string} [textoBase] texto base, para saber qué placeholders ya existían
 * @returns {{texto: string, total: number, distintos: number, nuevos: number,
 *            heredados: number,
 *            huecos: {total: number, nuevos: number, heredados: number, unicos: string[]},
 *            sistema: {total: number, unicos: string[]}}}
 */
function armarReportePlaceholders(texto, textoBase) {
  const encontrados = localizarPlaceholders(texto);
  const heredados = new Set();
  if (typeof textoBase === 'string') {
    for (const b of buscarPlaceholders(textoBase)) heredados.add(b.trim());
  }
  const huecos = encontrados.filter((e) => e.tipo === 'hueco');
  const delSistema = encontrados.filter((e) => e.tipo === 'sistema');
  const huecosNuevos = huecos.filter((e) => !heredados.has(e.placeholder));
  const huecosDeLaBase = huecos.filter((e) => heredados.has(e.placeholder));
  if (encontrados.length === 0) {
    return {
      texto: 'SIN PLACEHOLDERS: el texto resultante no tiene huecos por llenar.\n',
      total: 0,
      distintos: 0,
      nuevos: 0,
      heredados: 0,
      huecos: { total: 0, nuevos: 0, heredados: 0, unicos: [] },
      sistema: { total: 0, unicos: [] },
    };
  }
  const lineas = [];
  const nuevos = encontrados.filter((e) => !heredados.has(e.placeholder));
  const deLaBase = encontrados.filter((e) => heredados.has(e.placeholder));
  lineas.push('PLACEHOLDERS DEL TEXTO RESULTANTE (' + encontrados.length + ' ocurrencias: '
    + huecos.length + ' huecos por llenar y ' + delSistema.length + ' campos del sistema)');
  lineas.push('');
  if (huecosNuevos.length > 0) {
    lineas.push('Huecos que hay que llenar (traen el texto final de la v1.1):');
    for (const e of huecosNuevos) {
      lineas.push('  - ' + e.placeholder + '  ->  numeral ' + e.ubicacion + ' (linea ' + e.linea + ')');
    }
    lineas.push('');
  }
  if (huecosDeLaBase.length > 0) {
    lineas.push('Huecos que ya venían en la v1.0 (estos sí bloquean):');
    for (const e of huecosDeLaBase) {
      lineas.push('  - ' + e.placeholder + '  ->  ' + e.ubicacion + ' (linea ' + e.linea + ')');
    }
    lineas.push('');
  }
  if (delSistema.length > 0) {
    lineas.push('Campos que registra el sistema (ya venían en la v1.0; no son huecos y NO bloquean):');
    for (const e of delSistema) {
      lineas.push('  - ' + e.placeholder + '  ->  ' + e.ubicacion + ' (linea ' + e.linea + ')');
    }
    lineas.push('');
  }
  if (huecos.length === 0) {
    lineas.push('No quedan huecos por llenar: el archivo de salida se puede escribir.');
    lineas.push('');
  } else {
    lineas.push('Cada hueco nuevo se llena con el dato que le corresponde y despues se vuelve a correr');
    lineas.push('este script. El archivo de salida NO se escribe mientras queden huecos.');
    lineas.push('');
  }
  return {
    texto: lineas.join('\n'),
    total: encontrados.length,
    distintos: new Set(encontrados.map((e) => e.placeholder)).size,
    nuevos: nuevos.length,
    heredados: deLaBase.length,
    huecos: {
      total: huecos.length,
      nuevos: huecosNuevos.length,
      heredados: huecosDeLaBase.length,
      unicos: [...new Set(huecos.map((e) => e.placeholder))],
    },
    sistema: {
      total: delSistema.length,
      unicos: [...new Set(delSistema.map((e) => e.placeholder))],
    },
  };
}

/**
 * Función principal, exportable para los tests.
 * @param {string[]} argv
 * @returns {number} exit code (0 listo, 2 placeholders, 3 error)
 */
function main(argv) {
  const args = parseArgs(argv);

  console.log('=== EMPALME DEL ACUERDO ' + args.version + ' ===');
  console.log('  base:      ' + args.base);
  console.log('  cambios:   ' + args.cambios);
  console.log('  salida:    ' + args.salida);

  // 1. Leer la base.
  if (!fs.existsSync(args.base)) {
    console.error('');
    console.error('  ERROR: no existe el texto base: ' + args.base);
    return 3;
  }
  const textoBase = fs.readFileSync(args.base, 'utf8');

  // 2. La base tiene que ser la que está sellada (aviso, no bloqueo: el
  //    manifiesto se archiva aparte y puede no tener la versión).
  try {
    if (fs.existsSync(MANIFIESTO)) {
      const manifiesto = JSON.parse(fs.readFileSync(MANIFIESTO, 'utf8'));
      const sellada = manifiesto.versiones && manifiesto.versiones['v1.0'];
      if (sellada && sellada.sha256 && sellada.sha256 !== sha256(textoBase)) {
        console.error('');
        console.error('  AVISO: la base NO coincide con la huella archivada de la v1.0.');
        console.error('    archivada: ' + sellada.sha256);
        console.error('    base de hoy: ' + sha256(textoBase));
      }
    }
  } catch (e) {
    console.error('  AVISO: no se pudo leer el manifiesto: ' + e.message);
  }

  // 3. Leer el JSON de cambios.
  if (!fs.existsSync(args.cambios)) {
    console.error('');
    console.error('  ERROR: no existe el JSON de cambios: ' + args.cambios);
    return 3;
  }
  let cambios;
  try {
    cambios = JSON.parse(fs.readFileSync(args.cambios, 'utf8'));
  } catch (e) {
    console.error('');
    console.error('  ERROR: el JSON de cambios no se pudo leer: ' + e.message);
    return 3;
  }
  const claves = Object.keys(cambios.cambios || {});
  if (claves.length === 0) {
    console.error('');
    console.error('  ERROR: el JSON de cambios no trae numerales.');
    return 3;
  }
  // El JSON dice de qué versión es. Si se está armando otra, el sello de
  // versión pondría una versión que no es la que el abogado apruebe.
  if (cambios.version && cambios.version !== args.version) {
    console.error('');
    console.error('  ERROR: se está armando ' + args.version + ' pero el JSON de cambios es de '
      + cambios.version + '.');
    console.error('  Revisar el "version" del JSON o la opción --version.');
    return 3;
  }

  // 4. Leer los datos del owner (si existen) y empalmar.
  let datos = null;
  if (fs.existsSync(args.datos)) {
    try {
      datos = JSON.parse(fs.readFileSync(args.datos, 'utf8'));
    } catch (e) {
      console.error('');
      console.error('  ERROR: el JSON de datos no se pudo leer: ' + e.message);
      return 3;
    }
    if (datos.version && datos.version !== args.version) {
      console.error('');
      console.error('  ERROR: el JSON de datos es de ' + datos.version + ' y se está armando '
        + args.version + '.');
      console.error('  Revisar el "version" del JSON de datos o la opción --version.');
      return 3;
    }
    console.log('  datos:    ' + args.datos);
  } else {
    console.log('  datos:    (no existe ' + args.datos + ': el texto queda con huecos)');
  }

  let resultado;
  try {
    resultado = empalmar(textoBase, cambios, datos);
  } catch (e) {
    console.error('');
    console.error('  ERROR: el empalme falló: ' + e.message);
    return 3;
  }
  const texto = resultado.texto;
  const resumen = resultado.resumen;

  // 5. Cobertura contra el mapa de empalme (checklist).
  const delMapa = leerNumeralesDelMapa(MAPA_EMPALME);
  const faltantes = delMapa.filter((n) => !claves.includes(n));
  const sobrantes = claves.filter((n) => !delMapa.includes(n));

  console.log('');
  console.log('  numerales de primer nivel: ' + resumen.numeralesTotal
    + ' (cambiados ' + resumen.numeralesCambiados
    + ', intactos ' + resumen.numeralesIntactos + ')');
  console.log('  literales:                 ' + resumen.literalesTotal
    + ' (cambiados ' + resumen.literalesCambiados
    + ', absorbidos ' + resumen.literalesAbsorbidos
    + ', intactos ' + resumen.literalesIntactos + ')');
  console.log('  insertados: ' + (resumen.insertados.length
    ? resumen.insertados.join(', ') : 'ninguno'));
  console.log('  caracteres: ' + texto.length);
  console.log('  version sujeta a la guarda de publicacion: '
    + (esVersionSujetaAGuarda(args.version) ? 'SI' : 'no'));

  if (delMapa.length === 0) {
    console.log('  cobertura del mapa: NO SE PUDO LEER el mapa de empalme');
  } else {
    console.log('  cobertura del mapa: ' + (delMapa.length - faltantes.length)
      + '/' + delMapa.length + ' numerales del mapa estan en el JSON de cambios');
  }
  if (faltantes.length > 0) {
    console.error('');
    console.error('  AVISO: hay numerales del mapa de empalme que NO estan en el JSON de cambios:');
    for (const n of faltantes) console.error('    - ' + n);
    console.error('  Revisar antes de publicar: un numeral que se pierda deja la v1.0 en ese punto.');
  }
  if (sobrantes.length > 0) {
    console.error('');
    console.error('  AVISO: hay numerales en el JSON de cambios que NO estan en el mapa de empalme:');
    for (const n of sobrantes) console.error('    - ' + n);
  }

  // 6. La guarda: el MISMO análisis que usa la publicación.
  const revision = analizarTextoLegal(texto);
  const reporte = armarReportePlaceholders(texto, textoBase);

  // 6a. Control de consistency: el localizador de placeholders tiene que
  //     contar lo mismo que cuenta el modulo compartido. Si no, el reporte
  //     estaria mintiendo. Se comparan las dos cuentas: la de TODAS las
  //     ocurrencias y la de los huecos (los que de verdad bloquean).
  const contadosPorElModulo = listarPlaceholders(texto);
  if (contadosPorElModulo.total !== reporte.total) {
    console.error('');
    console.error('  AVISO: el localizador encontró ' + reporte.total
      + ' placeholders y el modulo compartido cuenta ' + contadosPorElModulo.total + '.');
    console.error('  El reporte puede estar incompleto: revisar antes de llenar los huecos.');
  }
  if (contadosPorElModulo.huecos.total !== reporte.huecos.total) {
    console.error('');
    console.error('  AVISO: el localizador encontró ' + reporte.huecos.total
      + ' huecos y el modulo compartido cuenta ' + contadosPorElModulo.huecos.total + '.');
    console.error('  El reporte puede estar incompleto: revisar antes de llenar los huecos.');
  }

  // 6b. El sello de versión. El encabezado y el bloque de Manifestación de
  //     Voluntad nombran la versión; el empalme los pasa a la que se está
  //     armando, y se niega si no puede hacerlo con certeza (versionBase
  //     distinto de versionManifiestacion, o menciones que no son una).
  if (resumen.sello && resumen.sello.sellado) {
    console.log('  sello de version: ' + resumen.sello.versionBase + ' -> '
      + resumen.sello.versionNueva + ' (encabezado y Manifestacion de Voluntad)');
  }
  if (resumen.fecha && resumen.fecha.valor) {
    console.log('  fecha de vigencia: ' + resumen.fecha.valor
      + (resumen.fecha.insertada ? ' (insertada)' : ' (ya estaba)'));
  }
  if (resumen.reemplazosTexto && resumen.reemplazosTexto.length > 0) {
    console.log('  reemplazos de texto libre: ' + resumen.reemplazosTexto.length + ' ('
      + resumen.reemplazosTexto.join('; ') + ')');
  }
  if (resumen.datos && resumen.datos.aplicados.length > 0) {
    console.log('  datos aplicados: ' + resumen.datos.aplicados.length + ' ('
      + resumen.datos.aplicados.join(', ') + ')');
  }

  if (!revision.ok) {
    console.error('');
    console.error('  EL TEXTO TIENE PLACEHOLDERS O MARCAS DE BORRADOR. No se escribe el archivo.');
    for (const m of revision.marcadores) {
      console.error('  Marca prohibida: ' + m.etiqueta);
    }
    console.error('');
    if (args.reporte) {
      fs.writeFileSync(args.reporte, reporte.texto, 'utf8');
      console.error('  Reporte de placeholders escrito en: ' + args.reporte);
    } else {
      console.error(reporte.texto);
    }
    console.error('');
    console.error('  NO se escribió: ' + args.salida);
    return 2;
  }

  // 7. Listo: escribir el archivo (LF, sin BOM).
  fs.writeFileSync(args.salida, texto, 'utf8');
  console.log('');
  console.log('  SIN HUECOS POR LLENAR: el texto está listo para archivar.');
  if (reporte.sistema.total > 0) {
    console.log('  (trae ' + reporte.sistema.total
      + ' campos que registra el sistema; no son huecos y no bloquean)');
  }
  console.log('  archivo:   ' + args.salida);
  console.log('  caracteres: ' + texto.length);
  console.log('  SHA-256:   ' + sha256(texto));
  console.log('');
  console.log('  Para archivarlo:');
  console.log('    node scripts/archivar-acuerdo.js --version=' + args.version);
  if (args.reporte) {
    fs.writeFileSync(args.reporte, reporte.texto, 'utf8');
    console.log('  Reporte de placeholders escrito en: ' + args.reporte);
  }
  return 0;
}

module.exports = {
  main,
  parseArgs,
  empalmar,
  analizarEstructura,
  localizarPlaceholders,
  armarReportePlaceholders,
  leerNumeralesDelMapa,
  sha256,
  DEFAULT_VERSION,
  DEFAULT_BASE,
  DEFAULT_CAMBIOS,
  DEFAULT_DATOS,
  DEFAULT_SALIDA,
  MAPA_EMPALME,
  // Reexportados para que los tests usen la MISMA regla y no una copia.
  listarPlaceholders,
  esVersionSujetaAGuarda,
  esPlaceholderDelSistema,
  sellarVersion,
  sellarFechaVigencia,
  sustituirDatos,
};

if (require.main === module) {
  process.exit(main(process.argv));
}
