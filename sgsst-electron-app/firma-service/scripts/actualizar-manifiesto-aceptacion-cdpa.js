#!/usr/bin/env node
/**
 * scripts/actualizar-manifiesto-aceptacion-cdpa.js
 *
 * REGISTRA EN EL MANIFIESTO LEGAL LA ACEPTACION DEL CDPA (P1), LEYENDOLA DE
 * UN ACTA.
 *
 * POR QUE ESTE SCRIPT EXISTE
 * --------------------------
 * El item `mail_provider_dpa` del gate exige que el manifiesto declare que la
 * cuenta del proveedor de correo tiene el Cloud Data Processing Addendum
 * incorporado al Acuerdo, o aceptado por el administrador en la consola. Ese
 * dato es un HECHO CONTRACUAL: si se escribe a mano, es una afirmacion sin
 * respaldo. Este script lo escribe leyendo un ACTA (un JSON) en el que se
 * declara QUIEN responde, QUE evidencia hay, en que MODO se acepta y con que
 * fecha.
 *
 * LA REGLA QUE NO SE PUEDE SALTAR
 * -------------------------------
 * El manifiesto NO dice `aceptada: true` si el acta no trae TODO lo que el
 * modo exige:
 *
 *   `incorporado_por_referencia`  los dos textos oficiales con su huella y su
 *                                 fecha de descarga (el Acuerdo y el CDPA), la
 *                                 cuenta a la que se aplican y la atestacion
 *                                 escrita del owner que las vincula. Y el CDPA
 *                                 citado tiene que SER el que el propio
 *                                 manifiesto declara: si la huella no
 *                                 coincide, la evidencia describiria otro
 *                                 texto y no se escribe nada.
 *
 *   `aceptado_por_administrador`  la captura del acto. Si el archivo esta en
 *                                 esta maquina, el script calcula su SHA-256 y
 *                                 lo registra con `verificado_localmente:
 *                                 true`. Si NO esta (el clic se hizo en la
 *                                 maquina del owner y el registro se hace en
 *                                 otra), el acta DECLARA la huella y los bytes:
 *                                 se registran con `verificado_localmente:
 *                                 false` (queda dicho que no se verifico aqui).
 *                                 Sin archivo y sin huella declarada no hay
 *                                 evidencia. Si el archivo esta y la huella
 *                                 declarada no coincide, no se escribe nada.
 *
 * Y un texto que es un MARCADOR ("PENDIENTE", "por definir", "[nombre del
 * owner]", ...) se rechaza en evidencia, responsable, cuenta y atestacion: un
 * acta por completar no es un acta, y registrar un "por llenar" seria el mismo
 * falso verde que este proyecto combate.
 *
 * Ademas, el manifiesto tiene que SOSTENER la aceptacion: si no declara
 * `dpa: true` o si el papel del proveedor no es `subencargado`, registrar la
 * aceptacion seria un verde falso. En ese caso el script no escribe.
 *
 * LO QUE NO TOCA
 * --------------
 *   Ningun otro bloque del manifiesto. El script compara el resultado con el
 *   original ANTES de escribir: si algo distinto del bloque de aceptacion
 *   cambio, no escribe.
 *
 * EL MANIFIESTO ES ASCII PURO
 * ---------------------------
 * El manifiesto se escribe con el escapado ASCII (`\uXXXX`) y el formato
 * `JSON.stringify(obj, null, 2)` mas un salto de linea final. Es el mismo
 * formato que producen `actualizar-manifiesto-1047.js` y
 * `actualizar-manifiesto-anexo-nube.js`, de modo que los tres scripts se
 * pueden correr en cualquier orden sin que el diff se desordene.
 *
 * USO
 * ---
 *   node scripts/actualizar-manifiesto-aceptacion-cdpa.js --check --acta=scripts/fixtures/aceptacion-cdpa-p1-2026-11-10.json
 *   node scripts/actualizar-manifiesto-aceptacion-cdpa.js --aplicar --acta=scripts/fixtures/aceptacion-cdpa-p1-2026-11-10.json
 *   node scripts/actualizar-manifiesto-aceptacion-cdpa.js --aplicar --acta=... --json
 *
 * `--manifiesto` existe para poder probar el script sobre una COPIA, sin
 * tocar el archivo de verdad. `--hoy` fija la fecha de referencia para la
 * regla "la fecha no puede estar en el futuro".
 *
 * Exit codes:
 *   0 = el manifiesto quedo escrito (o verificado, con --check y coincidiendo)
 *   2 = argumentos invalidos o acta incompleta
 *   3 = error de lectura, evidencia que no existe o no coincide con la huella
 *       que el acta declara, o estado del manifiesto que
 *       no sostiene la aceptacion
 *   4 = --check: el manifiesto NO coincide con lo que se escribiria
 *   5 = el CDPA del acta no es el que declara el manifiesto
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SERVICE_ROOT = path.resolve(__dirname, '..');
const MANIFIESTO = path.join(SERVICE_ROOT, 'legal-readiness.json');

const MODOS = ['aceptado_por_administrador', 'incorporado_por_referencia'];

// Los dominios de Google: la evidencia contractual tiene que ser de la fuente
// oficial. Un acuerdo guardado en otro sitio no es evidencia del CDPA.
const DOMINIOS_OFICIALES = ['.google.com'];

let SALIDA = console.log;
let SALIDA_ERROR = console.error;

function fijarSalida(fn, fnError) {
  SALIDA = fn || console.log;
  SALIDA_ERROR = fnError || console.error;
}

function error(mensaje, codigo) {
  const e = new Error(mensaje);
  e.codigo = codigo || 3;
  return e;
}

// ---------------------------------------------------------------------------
// ASCII
// ---------------------------------------------------------------------------

/**
 * Escapa lo que no es ASCII, para que el manifiesto sea JSON ASCII puro.
 *
 * @param {string} s
 * @returns {string}
 */
function asciiEscape(s) {
  let out = '';
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (c > 0x7f) {
      if (c > 0xffff) {
        const v = c - 0x10000;
        out += '\\u' + (0xd800 + (v >> 10)).toString(16).padStart(4, '0')
          + '\\u' + (0xdc00 + (v & 0x3ff)).toString(16).padStart(4, '0');
      } else {
        out += '\\u' + c.toString(16).padStart(4, '0');
      }
    } else {
      out += ch;
    }
  }
  return out;
}

/**
 * El manifiesto en su forma canonica: ASCII escapado, dos espacios de sangria
 * y un salto de linea final.
 *
 * @param {object} obj
 * @returns {string}
 */
function manifiestoCanonico(obj) {
  return asciiEscape(JSON.stringify(obj, null, 2)) + '\n';
}

// ---------------------------------------------------------------------------
// VALIDACIONES
// ---------------------------------------------------------------------------

/**
 * Un texto que de verdad dice algo.
 *
 * @param {*} valor
 * @returns {boolean}
 */
function hayTexto(valor) {
  return typeof valor === 'string' && valor.trim().length > 0;
}

// ---------------------------------------------------------------------------
// LOS MARCADORES: UN TEXTO DE "POR LLENAR" NO ES UN DATO
// ---------------------------------------------------------------------------
//
// El acta se prepara ANTES de que el owner haga el clic, y en ese estado trae
// marcas de "por completar". Si el script las aceptara, el manifiesto quedaria
// con una frase que nadie verifico: un falso verde. Estas marcas se rechazan
// campo por campo (evidencia, responsable, cuenta, atestacion).

const MARCADORES = [
  'pendiente',
  'por definir',
  'por completar',
  'por llenar',
  'por confirmar',
  'a confirmar',
  'sin definir',
  'sin confirmar',
  'completar despues',
  'sin fechar',
  'nombre del owner',
  'placeholder',
  'tbd',
  'xxx',
];

/**
 * Un texto que es una marca de "por llenar" en vez de un dato real.
 *
 * Tambien detecta corchetes tipo `[nombre del owner]`: un hueco visible en el
 * texto es una plantilla sin completar.
 *
 * @param {*} valor
 * @returns {boolean}
 */
function esMarcador(valor) {
  if (!hayTexto(valor)) return false;
  const t = valor.toLowerCase();
  if (/\[[^\]]+\]/.test(t)) return true;
  return MARCADORES.some((m) => t.indexOf(m) !== -1);
}

/**
 * Lanza el error estandar si el valor es un marcador.
 *
 * @param {*} valor
 * @param {string} campo nombre del campo para el mensaje.
 */
function rechazarSiMarcador(valor, campo) {
  if (esMarcador(valor)) {
    throw error('El acta declara un MARCADOR en ' + campo + ' ("' + String(valor).trim()
      + '"): un texto de "por llenar" no es un dato verificado. Complete el acta con lo '
      + 'que realmente ocurrio antes de registrar la aceptacion.', 2);
  }
}

/**
 * Una fecha ISO de calendario (YYYY-MM-DD) que existe.
 *
 * @param {*} valor
 * @returns {boolean}
 */
function esFechaISO(valor) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const t = Date.parse(valor + 'T00:00:00Z');
  if (Number.isNaN(t)) return false;
  return new Date(t).toISOString().slice(0, 10) === valor;
}

/**
 * Una fecha que no esta en el futuro.
 *
 * @param {string} fecha
 * @param {string} hoy
 * @returns {boolean}
 */
function noEsFutura(fecha, hoy) {
  return fecha <= hoy;
}

/**
 * Una huella SHA-256 en hexadecimal.
 *
 * @param {*} valor
 * @returns {boolean}
 */
function esHashSha256(valor) {
  return typeof valor === 'string' && /^[0-9a-fA-F]{64}$/.test(valor);
}

/**
 * La URL es de un dominio oficial de Google.
 *
 * @param {*} valor
 * @returns {boolean}
 */
function esUrlOficial(valor) {
  if (typeof valor !== 'string' || !/^https:\/\//i.test(valor)) return false;
  let host;
  try {
    host = new URL(valor).hostname.toLowerCase();
  } catch (e) {
    return false;
  }
  if (host === 'google.com') return true;
  return DOMINIOS_OFICIALES.some((d) => host.endsWith(d));
}

/**
 * Un bloque de texto oficial: url + huella + bytes + fecha de descarga.
 *
 * @param {object} bloque
 * @param {string} nombreParaErrores
 * @returns {object} el bloque normalizado.
 */
function validarTextoOficial(bloque, nombreParaErrores) {
  if (!bloque || typeof bloque !== 'object') {
    throw error('El acta no declara el ' + nombreParaErrores + ': falta el bloque.', 2);
  }
  if (!esUrlOficial(bloque.url)) {
    throw error('La URL del ' + nombreParaErrores + ' no es de un dominio oficial de '
      + 'Google (' + String(bloque.url) + '): la evidencia tiene que salir de la fuente '
      + 'oficial.', 2);
  }
  if (!esHashSha256(bloque.hash)) {
    throw error('El ' + nombreParaErrores + ' no declara una huella SHA-256 valida.', 2);
  }
  if (!Number.isInteger(bloque.bytes) || bloque.bytes <= 0) {
    throw error('El ' + nombreParaErrores + ' no declara un numero de bytes valido.', 2);
  }
  if (!esFechaISO(bloque.descargado)) {
    throw error('El ' + nombreParaErrores + ' no declara la fecha de descarga (YYYY-MM-DD).', 2);
  }
  return {
    url: bloque.url,
    hash: String(bloque.hash).toLowerCase(),
    bytes: bloque.bytes,
    descargado: bloque.descargado,
    idioma: hayTexto(bloque.idioma) ? bloque.idioma : null,
    titulo: hayTexto(bloque.titulo) ? bloque.titulo : null,
  };
}

// ---------------------------------------------------------------------------
// EL ACTA
// ---------------------------------------------------------------------------

/**
 * Lee y valida el acta.
 *
 * @param {string} rutaActa
 * @param {string} hoy
 * @returns {object} el acta validada.
 */
function leerActa(rutaActa, hoy) {
  let crudo;
  try {
    crudo = fs.readFileSync(rutaActa, 'utf8');
  } catch (e) {
    throw error('No se pudo leer el acta (' + rutaActa + '): ' + e.message, 3);
  }
  let acta;
  try {
    acta = JSON.parse(crudo);
  } catch (e) {
    throw error('El acta no es JSON valido: ' + e.message, 3);
  }
  if (!acta || typeof acta !== 'object' || Array.isArray(acta)) {
    throw error('El acta tiene que ser un objeto JSON.', 2);
  }

  if (acta.aceptada === false) {
    throw error('Este script registra la aceptacion; no registra la no aceptacion. El '
      + 'estado inicial (aceptada: false) es el que ya esta en el manifiesto.', 2);
  }

  if (MODOS.indexOf(acta.modo) === -1) {
    throw error('El modo del acta no es valido. Los modos son: ' + MODOS.join(' | ') + '.', 2);
  }

  if (!esFechaISO(acta.fecha)) {
    if (esMarcador(acta.fecha)) {
      throw error('La fecha del acta es un MARCADOR ("' + String(acta.fecha).trim() + '"): '
        + 'el acto todavia no ocurrio. Este acta es una plantilla: declare la fecha real '
        + '(YYYY-MM-DD) despues de hacer el clic en la consola.', 2);
    }
    throw error('El acta no declara una fecha valida (YYYY-MM-DD): la fecha del acto es '
      + 'obligatoria.', 2);
  }
  if (!noEsFutura(acta.fecha, hoy)) {
    throw error('La fecha del acta (' + acta.fecha + ') esta en el futuro: un acto que '
      + 'todavia no ocurrio no se puede registrar.', 2);
  }

  if (!hayTexto(acta.evidencia)) {
    throw error('El acta no declara la evidencia: sin evidencia no hay aceptacion que '
      + 'registrar.', 2);
  }
  rechazarSiMarcador(acta.evidencia, 'evidencia');

  if (!hayTexto(acta.responsable)) {
    throw error('El acta no declara quien responde por el registro.', 2);
  }
  rechazarSiMarcador(acta.responsable, 'responsable');
  rechazarSiMarcador(acta.cuenta, 'cuenta');
  rechazarSiMarcador(acta.at_testacion, 'atestacion');

  const base = {
    modo: acta.modo,
    fecha: acta.fecha,
    evidencia: acta.evidencia.trim(),
    responsable: acta.responsable.trim(),
    cuenta: hayTexto(acta.cuenta) ? acta.cuenta.trim() : null,
    at_testacion: hayTexto(acta.at_testacion) ? acta.at_testacion.trim() : null,
    fecha_efectividad_addendum: esFechaISO(acta.fecha_efectividad_addendum)
      ? acta.fecha_efectividad_addendum
      : null,
    observaciones: hayTexto(acta.observaciones) ? acta.observaciones.trim() : null,
    acuerdo: null,
    cdpa: null,
    captura: null,
  };

  if (acta.modo === 'incorporado_por_referencia') {
    if (!hayTexto(base.cuenta)) {
      throw error('El modo incorporado_por_referencia exige declarar la CUENTA a la que '
        + 'se aplica el Acuerdo.', 2);
    }
    if (!hayTexto(base.at_testacion)) {
      throw error('El modo incorporado_por_referencia exige la ATESTACION escrita del '
        + 'owner: es la que vincula la cuenta con el Acuerdo que incorpora el CDPA.', 2);
    }
    base.acuerdo = validarTextoOficial(acta.acuerdo, 'Acuerdo');
    base.cdpa = validarTextoOficial(acta.cdpa, 'CDPA');
    if (!noEsFutura(base.acuerdo.descargado, hoy) || !noEsFutura(base.cdpa.descargado, hoy)) {
      throw error('La fecha de descarga de un texto oficial no puede estar en el futuro.', 2);
    }
    return base;
  }

  // Modo aceptado_por_administrador: la evidencia es un archivo.
  if (!acta.captura || typeof acta.captura !== 'object') {
    throw error('El modo aceptado_por_administrador exige la CAPTURA del acto.', 2);
  }
  if (!hayTexto(acta.captura.archivo)) {
    throw error('La captura del acto no declara que archivo es.', 2);
  }

  // El acta PUEDE declarar la huella y los bytes de la captura. Sirve cuando el
  // clic se hizo en la maquina del owner y el registro se hace en otra (la VM,
  // el build): el script verifica la huella SI el archivo esta en esta maquina,
  // y si no esta lo registra dejando CONSTANCIA de que no se verifico aqui.
  const declaraHuella = (acta.captura.hash !== undefined && acta.captura.hash !== null)
    || (acta.captura.bytes !== undefined && acta.captura.bytes !== null);
  if (declaraHuella) {
    if (!esHashSha256(acta.captura.hash)) {
      throw error('La captura del acta no declara una huella SHA-256 valida.', 2);
    }
    if (!Number.isInteger(acta.captura.bytes) || acta.captura.bytes <= 0) {
      throw error('La captura del acta no declara un numero de bytes valido.', 2);
    }
  }

  const descripcionCaptura = hayTexto(acta.captura.descripcion)
    ? acta.captura.descripcion.trim()
    : null;
  const rutaCaptura = path.resolve(path.dirname(path.resolve(rutaActa)), acta.captura.archivo);
  let bytesCaptura = null;
  try {
    bytesCaptura = fs.readFileSync(rutaCaptura);
  } catch (e) {
    bytesCaptura = null;
  }

  if (bytesCaptura) {
    const hashReal = crypto.createHash('sha256').update(bytesCaptura).digest('hex');
    if (declaraHuella) {
      const hashDeclarado = String(acta.captura.hash).toLowerCase();
      if (hashReal !== hashDeclarado || bytesCaptura.length !== acta.captura.bytes) {
        throw error('La captura ' + acta.captura.archivo + ' NO coincide con la huella que '
          + 'el acta declara (el acta dice ' + hashDeclarado + ' / ' + acta.captura.bytes
          + ' bytes y el archivo real da ' + hashReal + ' / ' + bytesCaptura.length
          + ' bytes): la evidencia declarada describiria otro archivo. No se escribe '
          + 'nada.', 3);
      }
    }
    base.captura = {
      archivo: acta.captura.archivo,
      hash: hashReal,
      bytes: bytesCaptura.length,
      descripcion: descripcionCaptura,
      verificado_localmente: true,
    };
    return base;
  }

  if (!declaraHuella) {
    throw error('La evidencia del acto no existe: no se pudo leer ' + rutaCaptura + ' ('
      + 'sin huella declarada en el acta). Una captura que no esta no es evidencia: si el '
      + 'archivo vive en otra maquina, declare en el acta su huella SHA-256 y sus bytes.',
    3);
  }
  base.captura = {
    archivo: acta.captura.archivo,
    hash: String(acta.captura.hash).toLowerCase(),
    bytes: acta.captura.bytes,
    descripcion: descripcionCaptura,
    verificado_localmente: false,
  };
  return base;
}

// ---------------------------------------------------------------------------
// LA NOTA: LO QUE EL MANIFIESTO DICE DE SI MISMO
// ---------------------------------------------------------------------------

/**
 * La nota que explica el registro, escrita con lo que el acta declara.
 *
 * La nota NO afirma lo que el acta no dice: describe el modo, los textos con
 * su huella y su fecha de descarga, y declara explicitamente lo que quedo en
 * null (la fecha de efectividad del Addendum). Las salvedades del owner van
 * en `observaciones`, que el acta escribe a mano y el script copia.
 *
 * @param {object} acta
 * @returns {string}
 */
function construirNota(acta) {
  if (acta.modo === 'aceptado_por_administrador') {
    const estadoCaptura = acta.captura.verificado_localmente
      ? 'verificada en esta maquina'
      : 'huella declarada en el acta; el archivo no esta en esta maquina y no se verifico '
        + 'aqui';
    return 'Modo aceptado_por_administrador: el administrador acepto el CDPA en la consola '
      + 'de Workspace el ' + acta.fecha + '. La evidencia es la captura '
      + acta.captura.archivo + ' (SHA-256 ' + acta.captura.hash + ', ' + acta.captura.bytes
      + ' bytes, ' + estadoCaptura + ').';
  }
  return 'Modo incorporado_por_referencia: la cuenta ' + acta.cuenta + ' se rige por el '
    + 'Acuerdo ' + acta.acuerdo.url + ' (SHA-256 ' + acta.acuerdo.hash + ', '
    + acta.acuerdo.bytes + ' bytes, descargado el ' + acta.acuerdo.descargado + '), que '
    + 'incorpora por referencia el CDPA; el texto del CDPA aplicable es '
    + acta.cdpa.url + ' (SHA-256 ' + acta.cdpa.hash + ', ' + acta.cdpa.bytes
    + ' bytes, descargado el ' + acta.cdpa.descargado + '). El vinculo entre la cuenta y '
    + 'ese Acuerdo consta en la atestacion escrita del responsable. La fecha de '
    + 'efectividad del Addendum queda en null porque no consta: no se inventa.';
}

// ---------------------------------------------------------------------------
// EL MAIN
// ---------------------------------------------------------------------------

function main(args) {
  let soloCheck = false;
  let aplicar = false;
  let comoJson = false;
  let rutaManifiesto = MANIFIESTO;
  let rutaActa = null;
  let hoy = new Date().toISOString().slice(0, 10);

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--check') soloCheck = true;
    else if (a === '--aplicar') aplicar = true;
    else if (a === '--json') comoJson = true;
    else if (a === '--acta') {
      i += 1;
      if (!args[i]) throw error('--acta necesita una ruta.', 2);
      rutaActa = path.resolve(args[i]);
    } else if (a.startsWith('--acta=')) {
      rutaActa = path.resolve(a.slice('--acta='.length));
    } else if (a === '--manifiesto') {
      i += 1;
      if (!args[i]) throw error('--manifiesto necesita una ruta.', 2);
      rutaManifiesto = path.resolve(args[i]);
    } else if (a.startsWith('--manifiesto=')) {
      rutaManifiesto = path.resolve(a.slice('--manifiesto='.length));
    } else if (a === '--hoy') {
      i += 1;
      if (!args[i]) throw error('--hoy necesita una fecha (YYYY-MM-DD).', 2);
      hoy = args[i];
    } else if (a.startsWith('--hoy=')) {
      hoy = a.slice('--hoy='.length);
    } else throw error('Argumento desconocido: ' + a, 2);
  }

  if (soloCheck && aplicar) {
    throw error('--check y --aplicar son excluyentes: uno mira y el otro escribe.', 2);
  }
  if (!soloCheck && !aplicar) {
    throw error('Hay que decir que hacer: --check (verifica) o --aplicar (escribe). '
      + 'Sin una de las dos no se toca el manifiesto.', 2);
  }
  if (!rutaActa) {
    throw error('Falta el acta: --acta=<ruta>. El dato legal se escribe desde el acta, '
      + 'no de memoria.', 2);
  }
  if (!esFechaISO(hoy)) {
    throw error('--hoy tiene que ser una fecha (YYYY-MM-DD).', 2);
  }

  const acta = leerActa(rutaActa, hoy);

  const crudo = fs.readFileSync(rutaManifiesto, 'utf8');
  let manifiesto;
  try {
    manifiesto = JSON.parse(crudo);
  } catch (e) {
    throw error('El manifiesto no es JSON valido: ' + e.message, 3);
  }
  const mp = (manifiesto.subencargados || {}).mail_provider || {};

  // El manifiesto tiene que SOSTENER la aceptacion.
  if (mp.dpa !== true) {
    throw error('El manifiesto no declara `dpa: true` en el proveedor de correo: no se '
      + 'puede registrar la aceptacion de un CDPA que el propio manifiesto no declara.', 3);
  }
  if (mp.rol !== 'subencargado') {
    throw error('El manifiesto declara el papel del proveedor de correo como "'
      + String(mp.rol) + '" y no como "subencargado": la aceptacion del CDPA solo '
      + 'tiene sentido con Google como subencargado.', 3);
  }

  // El CDPA del acta tiene que SER el que el manifiesto declara.
  if (acta.cdpa) {
    const hashDeclarado = String(mp.hash || '').toLowerCase();
    if (!hashDeclarado) {
      throw error('El manifiesto no declara la huella del CDPA del proveedor de correo: '
        + 'no se puede contrastar la evidencia.', 5);
    }
    if (acta.cdpa.hash !== hashDeclarado) {
      throw error('El CDPA del acta no es el que declara el manifiesto. El acta cita la '
        + 'huella ' + acta.cdpa.hash + ' y el manifiesto declara ' + hashDeclarado
        + ': la evidencia describiria otro texto y no se escribe nada.', 5);
    }
    if (Number.isInteger(mp.bytes) && acta.cdpa.bytes !== mp.bytes) {
      throw error('El CDPA del acta declara ' + acta.cdpa.bytes + ' bytes y el manifiesto '
        + 'declara ' + mp.bytes + ': la evidencia describiria otro texto y no se escribe '
        + 'nada.', 5);
    }
  }

  const aceptacion = {
    aceptada: true,
    modo: acta.modo,
    fecha: acta.fecha,
    fecha_efectividad_addendum: acta.fecha_efectividad_addendum,
    evidencia: acta.evidencia,
    responsable: acta.responsable,
    cuenta: acta.cuenta,
    at_testacion: acta.at_testacion,
    acuerdo: acta.acuerdo,
    cdpa: acta.cdpa,
    captura: acta.captura,
    observaciones: acta.observaciones,
    registrado_por: 'scripts/actualizar-manifiesto-aceptacion-cdpa.js',
    nota: construirNota(acta),
  };

  const nuevo = JSON.parse(crudo);
  nuevo.subencargados = nuevo.subencargados || {};
  nuevo.subencargados.mail_provider = Object.assign({}, nuevo.subencargados.mail_provider, {
    aceptacion,
  });

  // LO QUE NO SE PUEDE TOCAR: se compara el resultado con el original.
  const antes = JSON.parse(crudo);
  const despues = JSON.parse(JSON.stringify(nuevo));
  delete antes.subencargados.mail_provider.aceptacion;
  delete despues.subencargados.mail_provider.aceptacion;
  if (JSON.stringify(antes) !== JSON.stringify(despues)) {
    throw error('El resultado cambia algo que no es el bloque de aceptacion. No se '
      + 'escribe nada.', 3);
  }

  const salidaCruda = manifiestoCanonico(nuevo);
  try {
    JSON.parse(salidaCruda);
  } catch (err) {
    throw error('El manifiesto dejo de ser JSON valido: ' + err.message, 3);
  }
  const noAscii = (salidaCruda.match(/[^\x00-\x7F]/g) || []).length;
  if (noAscii > 0) {
    throw error('El manifiesto dejo de ser ASCII puro (' + noAscii + ' caracteres).', 3);
  }

  const salida = {
    ok: true,
    solo_check: soloCheck,
    modo: acta.modo,
    fecha: acta.fecha,
    aceptada: true,
    responsable: acta.responsable,
    cuenta: acta.cuenta,
    fecha_efectividad_addendum: acta.fecha_efectividad_addendum,
    cdpa_hash: acta.cdpa ? acta.cdpa.hash : null,
    acuerdo_hash: acta.acuerdo ? acta.acuerdo.hash : null,
    captura_hash: acta.captura ? acta.captura.hash : null,
    captura_verificada_localmente: acta.captura ? acta.captura.verificado_localmente : null,
  };

  if (soloCheck) {
    salida.coincide = salidaCruda === crudo;
    if (!salida.coincide) {
      const bloque = (manifiesto.subencargados.mail_provider || {}).aceptacion || {};
      salida.aceptada = bloque.aceptada === true;
      salida.modo = bloque.modo || null;
      salida.fecha = bloque.fecha || null;
    }
  } else {
    fs.writeFileSync(rutaManifiesto, salidaCruda, 'utf8');
  }

  if (comoJson) {
    SALIDA(JSON.stringify(salida, null, 2));
    return salida;
  }

  SALIDA('[manifiesto-aceptacion-cdpa] ' + (soloCheck ? 'verificado' : 'escrito'));
  SALIDA('  modo:      ' + salida.modo);
  SALIDA('  fecha:     ' + salida.fecha);
  SALIDA('  aceptada:  ' + salida.aceptada);
  SALIDA('  cuenta:    ' + (salida.cuenta || '(no declarada)'));
  SALIDA('  cdpa:      ' + (salida.cdpa_hash || '(no aplica)'));
  SALIDA('  acuerdo:   ' + (salida.acuerdo_hash || '(no aplica)'));
  SALIDA('  captura:   ' + (salida.captura_hash || '(no aplica)')
    + (salida.captura_verificada_localmente === true ? ' (verificada en esta maquina)'
      : salida.captura_verificada_localmente === false ? ' (huella declarada en el acta)'
        : ''));
  if (soloCheck && salida.coincide === false) {
    SALIDA('  (el manifiesto tiene un estado distinto del que se escribiria)');
  }
  return salida;
}

if (require.main === module) {
  try {
    const salida = main(process.argv.slice(2));
    if (salida && salida.solo_check && salida.coincide === false) {
      process.exit(4);
    }
  } catch (err) {
    SALIDA_ERROR('ERROR: ' + err.message);
    process.exit(err.codigo || 3);
  }
}

module.exports = {
  asciiEscape,
  construirNota,
  esFechaISO,
  esHashSha256,
  esMarcador,
  esUrlOficial,
  leerActa,
  main,
  manifiestoCanonico,
  fijarSalida,
  MARCADORES,
  MODOS,
  MANIFIESTO,
};
