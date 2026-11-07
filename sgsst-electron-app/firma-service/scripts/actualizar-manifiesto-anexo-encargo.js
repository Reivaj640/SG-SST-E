#!/usr/bin/env node
/**
 * scripts/actualizar-manifiesto-anexo-encargo.js
 *
 * PONE EL ESTADO DEL ANEXO DE ENCARGO EN EL MANIFIESTO LEGAL, Y SOLO SI HAY
 * CONTRAFIRMA.
 *
 * QUE HACE
 * --------
 * Lee la base y escribe TRES claves del bloque `anexo_encargo` del manifiesto
 * `legal-readiness.json`:
 *
 *   estado     "firmado" | "no_firmado"
 *   fecha      la fecha de EJECUCION del instrumento (la de la contrafirma)
 *   evidencia  el resumen de los dos actos, en texto plano
 *
 * NO TOCA `version`, `hash` ni `nota`: son la identidad del TEXTO, no del
 * acto. El manifiesto es la salida de los scripts que sellan el texto, y un
 * script que cambia la huella de un documento por un cambio de estado seria
 * una segunda verdad sobre el mismo texto.
 *
 * LA REGLA QUE NO SE PUEDE SALTAR
 * -------------------------------
 * El manifiesto dice "firmado" SOLO si hay contrafirma. El Anexo de Encargo
 * es bilateral: la suscripcion de la Empresa (fase 1) deja constancia de un
 * acto, y el instrumento queda EJECUTADO cuando las dos partes firman (fase
 * 2). Un manifiesto que dijera "firmado" con una sola de las dos partes
 * seria una falsificacion, y el manifiesto es lo que lee la compuerta de
 * publicacion.
 *
 * Por eso el script se NIEGA a escribir "firmado" si:
 *
 *   - No hay ninguna suscripcion con contrafirma registrada.
 *   - Hay una suscripcion contrafirmada cuya ficha de Empresa NO tiene la
 *     fecha de ejecucion (las dos escrituras van en una sola transaccion:
 *     si una fallo, la otra tampoco se hizo; que no coincidan es una
 *     incongruencia que hay que reportar, no un estado que se pueda
 *     promediar).
 *
 * EL MANIFIESTO ES ASCII PURO
 * ---------------------------
 * Las notas del manifiesto van sin tildes. Por eso este script edita el
 * archivo con REEMPLAZO LITERAL sobre el texto crudo (nunca con
 * JSON.stringify, que convertiria cada escape en el caracter real y dejaria
 * el diff entero), y despues valida que siga siendo JSON valido y ASCII
 * puro. La evidencia tambien sale en ASCII: las razones sociales y los
 * nombres que trae la base se transcriben sin acentos.
 *
 * USO
 * ---
 *   node scripts/actualizar-manifiesto-anexo-encargo.js
 *   node scripts/actualizar-manifiesto-anexo-encargo.js --check
 *   node scripts/actualizar-manifiesto-anexo-encargo.js --json
 *
 * En el servidor se usa sin argumentos: el manifiesto y el texto son los del
 * repo. `--manifiesto` y `--texto` existen para poder probar el script sobre
 * una COPIA sin tocar los archivos de verdad.
 *
 * Exit codes:
 *   0 = el manifiesto quedo escrito (o verificado, con --check)
 *   2 = argumentos invalidos
 *   3 = error de base de datos o de lectura del manifiesto
 *   4 = NO hay contrafirma: el manifiesto no puede decir "firmado"
 *   5 = la ficha y la suscripcion no coinciden
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SERVICE_ROOT = path.resolve(__dirname, '..');
const APP_ROOT = path.resolve(SERVICE_ROOT, '..');
const MANIFIESTO = path.join(SERVICE_ROOT, 'legal-readiness.json');
const TEXTO_ENCARGO = path.join(APP_ROOT, 'legal', 'anexo-encargo.html');

// ---------------------------------------------------------------------------
// SALIDA INJECTABLE (para los tests)
// ---------------------------------------------------------------------------

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
 * Un texto en ASCII PURO.
 *
 * El manifiesto es ASCII: una razon social con tilde o una ñ se transcriben
 * sin acento (la convencion que ya usa la evidencia del Anexo de Nube:
 * "Vasquez Munoz", no "Vásquez Muñoz"). Lo que no se puede transcribir se
 * descarta: un signo raro en una evidencia no es informacion.
 *
 * @param {*} valor
 * @returns {string}
 */
function aAscii(valor) {
  const original = String(valor === null || valor === undefined ? '' : valor);
  // La MAYUSCULA se conserva: una razon social que llega en mayusculas
  // ("VASQUEZ MUNOZ S.A.S.") no puede salir en minusculas en la evidencia.
  const CON_ESPERA = {
    á: 'a', à: 'a', ä: 'a', â: 'a', ã: 'a', å: 'a',
    é: 'e', è: 'e', ë: 'e', ê: 'e',
    í: 'i', ì: 'i', ï: 'i', î: 'i',
    ó: 'o', ò: 'o', ö: 'o', ô: 'o', õ: 'o',
    ú: 'u', ù: 'u', ü: 'u', û: 'u',
    ñ: 'n', ç: 'c', ý: 'y', ÿ: 'y',
  };
  let transcripcion = '';
  for (const letra of original) {
    const baja = letra.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(CON_ESPERA, baja)) {
      const destino = CON_ESPERA[baja];
      transcripcion += letra === baja ? destino : destino.toUpperCase();
    } else {
      transcripcion += letra;
    }
  }
  // Lo que no se puede transcribir se descarta: un signo raro en una evidencia
  // no es informacion.
  return transcripcion.replace(/[^\x20-\x7E]/g, '').trim();
}

// ---------------------------------------------------------------------------
// EL MANIFIESTO
// ---------------------------------------------------------------------------

/**
 * Pone un valor de cadena en una clave de un bloque del manifiesto.
 *
 * Es el mismo metodo que usa `actualizar-manifiesto-v1.4.js`: el patron
 * reconoce un string JSON COMPLETO, para que un valor con comillas
 * escapadas no corte el string en el camino.
 *
 * @param {string} texto
 * @param {string} bloque
 * @param {string} clave
 * @param {string} valor
 * @returns {string}
 */
function ponerEnBloque(texto, bloque, clave, valor) {
  const i = texto.indexOf('"' + bloque + '": {');
  if (i < 0) throw error('El manifiesto no tiene el bloque "' + bloque + '".');
  const fin = texto.indexOf('\n  },', i);
  if (fin < 0) throw error('No se pudo cerrar el bloque "' + bloque + '".');
  const antes = texto.slice(0, i);
  const cuerpo = texto.slice(i, fin);
  const despues = texto.slice(fin);
  // El valor puede ser un string O `null`: en el manifiesto las claves `fecha`
  // y `evidencia` arrancan en null (todavia no hay un acto que las llene) y
  // este patron solo aceptaba strings, asi que el script fallaba al intentar
  // escribir el estado sobre el manifiesto de verdad.
  const m = new RegExp('("' + clave + '"\\s*:\\s*)("(?:[^"\\\\]|\\\\.)*"|null\\b)').exec(cuerpo);
  if (!m) throw error('El bloque "' + bloque + '" no tiene la clave "' + clave + '".');
  const nuevoCuerpo = cuerpo.replace(
    m[0],
    m[1] + '"' + String(valor).replace(/"/g, '\\"') + '"',
  );
  return antes + nuevoCuerpo + despues;
}

// ---------------------------------------------------------------------------
// LA BASE
// ---------------------------------------------------------------------------

/**
 * Las suscripciones del Anexo de Encargo con los DOS actos.
 *
 * `estado = 'FIRMADA'` es la suscripcion de la Empresa (fase 1) y
 * `contrafirmado_at IS NOT NULL` es la contrafirma de K+AIR (fase 2).
 *
 * @returns {Array<object>}
 */
function leerSuscripciones() {
  const db = require('../src/db/connection');
  let filas;
  try {
    filas = db.prepare(`
      SELECT s.id, s.id_empresa, s.version, s.hash_texto, s.estado,
             s.firmado_at, s.contrafirmado_at, s.contrafirma_evidencia,
             s.contrafirma_actor, s.contrafirma_motivo,
             s.contrafirma_acta_hash, s.contrafirma_acta_archivo,
             s.contrafirma_acta_bytes, s.evidencia,
             e.razon_social, e.nit, e.anexo_encargo_firmado_at,
             e.anexo_encargo_suscrito_at, e.anexo_encargo_suscrito_hash,
             e.representante_legal
      FROM gh_firma_anexo_encargo_suscripciones s
      LEFT JOIN gh_firma_empresas e ON e.id_empresa = s.id_empresa
      WHERE s.estado = 'FIRMADA'
      ORDER BY s.id
    `).all();
  } catch (e) {
    throw error('No se pudo leer la tabla de suscripciones: ' + e.message, 3);
  }
  return filas;
}

/**
 * Los eventos del rastro de una suscripción, en orden.
 *
 * @param {number} idSuscripcion
 * @returns {Array<object>}
 */
function leerEventos(idSuscripcion) {
  const db = require('../src/db/connection');
  try {
    return db.prepare(
      'SELECT evento, detalle, fecha_hora FROM gh_firma_anexo_encargo_eventos '
      + 'WHERE id_suscripcion = ? ORDER BY id',
    ).all(idSuscripcion);
  } catch (e) {
    return [];
  }
}

// ---------------------------------------------------------------------------
// LA EVIDENCIA
// ---------------------------------------------------------------------------

/**
 * La evidencia de una suscripción: el resumen de los dos actos.
 *
 * @param {object} fila
 * @returns {string} texto plano, ASCII.
 */
function construirEvidencia(fila) {
  const partes = [];

  partes.push(
    aAscii(fila.razon_social || fila.id_empresa)
    + (fila.nit ? ' (NIT ' + aAscii(fila.nit) + ')' : '')
    + '. Anexo de Encargo version ' + aAscii(fila.version)
    + ', huella SHA-256 ' + aAscii(fila.hash_texto) + '.',
  );

  // EL PRIMER ACTO: la suscripcion de la Empresa.
  let evidencia = {};
  try {
    evidencia = fila.evidencia ? JSON.parse(fila.evidencia) : {};
  } catch (e) {
    evidencia = {};
  }
  partes.push(
    'PRIMER ACTO (la Empresa): suscripcion id ' + fila.id + '; el codigo de '
    + 'verificacion salio al segundo canal declarado por K+AIR; la Empresa '
    + 'acepto las condiciones del texto vigente y declaro los cinco datos del '
    + 'parrafo 11; la suscripcion quedo FIRMADA el ' + aAscii(fila.firmado_at) + '.',
  );
  if (evidencia.acta_archivo) {
    partes.push(
      'Acta de la suscripcion: ' + aAscii(evidencia.acta_archivo)
      + ' (SHA-256 ' + aAscii(evidencia.acta_hash) + ').',
    );
  }

  // EL SEGUNDO ACTO: la contrafirma de K+AIR.
  partes.push(
    'SEGUNDO ACTO (la contrafirma de K+AIR): el codigo de contrafirma salio al '
    + 'buzon de proteccion de datos de K+AIR, que es fijo en la configuracion '
    + 'del servicio; K+AIR verifico documentalmente a quien firmo por la '
    + 'Empresa y la contrafirma quedo registrada el '
    + aAscii(fila.contrafirmado_at) + ' por ' + aAscii(fila.contrafirma_actor || 'kair')
    + (fila.contrafirma_motivo ? ' (motivo: ' + aAscii(fila.contrafirma_motivo) + ')' : '')
    + '.',
  );
  if (fila.contrafirma_acta_archivo) {
    partes.push(
      'Acta de la contrafirma: ' + aAscii(fila.contrafirma_acta_archivo)
      + ' (SHA-256 ' + aAscii(fila.contrafirma_acta_hash) + ').',
    );
  }

  partes.push(
    'La fecha de ejecucion del instrumento quedo en la ficha de la Empresa '
    + '(gh_firma_empresas.anexo_encargo_firmado_at = '
    + aAscii(fila.anexo_encargo_firmado_at) + '). Con esa fecha, y solo con '
    + 'ella, la Empresa queda habilitada para firmar documentos de sus '
    + 'trabajadores.',
  );

  const eventos = leerEventos(fila.id);
  if (eventos.length) {
    partes.push(
      'Rastro append-only en gh_firma_anexo_encargo_eventos: '
      + eventos.map((e) => e.evento + ' (' + aAscii(e.fecha_hora) + ')').join(', ') + '.',
    );
  }

  partes.push(
    'La copia firmada del Anexo la conserva cada parte (parrafo 12): el '
    + 'servicio no la almacena. Lo que queda en el expediente son las dos '
    + 'actas, con la huella de sus bytes.',
  );

  return partes.join(' ');
}

// ---------------------------------------------------------------------------
// EL MAIN
// ---------------------------------------------------------------------------

function main(args) {
  let soloCheck = false;
  let comoJson = false;
  let rutaManifiesto = MANIFIESTO;
  let rutaTexto = TEXTO_ENCARGO;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--check') soloCheck = true;
    else if (a === '--json') comoJson = true;
    else if (a === '--texto') {
      // Para los tests: el texto contra el que se compara la huella del
      // manifiesto. En el servidor es el archivo real.
      i += 1;
      if (!args[i]) throw error('--texto necesita una ruta.', 2);
      rutaTexto = path.resolve(args[i]);
    } else if (a === '--manifiesto') {
      // Para los tests: el script escribe sobre una COPIA, nunca sobre el
      // manifiesto del repo. Sin esta opcion no habria forma de probarlo sin
      // tocar el archivo de verdad.
      i += 1;
      if (!args[i]) throw error('--manifiesto necesita una ruta.', 2);
      rutaManifiesto = path.resolve(args[i]);
    } else throw error('Argumento desconocido: ' + a, 2);
  }

  const crudo = fs.readFileSync(rutaManifiesto, 'utf8');
  let manifiesto;
  try {
    manifiesto = JSON.parse(crudo);
  } catch (e) {
    throw error('El manifiesto no es JSON valido: ' + e.message, 3);
  }
  const bloque = manifiesto.anexo_encargo || {};

  // El TEXTO: la huella que declara el manifiesto tiene que ser la del
  // archivo. Si no, la evidencia describiría un texto que no es el del
  // servidor.
  let hashTexto = null;
  if (fs.existsSync(rutaTexto)) {
    hashTexto = crypto.createHash('sha256')
      .update(fs.readFileSync(rutaTexto)).digest('hex');
    if (hashTexto !== String(bloque.hash || '').toLowerCase()) {
      throw error('El texto del Anexo de Encargo del servidor no tiene la huella que '
        + 'declara el manifiesto. No se escribe el estado: la evidencia describiría '
        + 'un texto que no es el que se firma.', 3);
    }
  }

  const suscripciones = leerSuscripciones();
  const contrafirmadas = suscripciones.filter((s) => Boolean(s.contrafirmado_at));

  if (contrafirmadas.length === 0) {
    throw error(
      'No hay ninguna suscripcion del Anexo de Encargo con contrafirma: el '
      + 'manifiesto NO puede decir "firmado". El Anexo de Encargo es bilateral y '
      + 'el instrumento solo queda ejecutado cuando las dos partes firman. '
      + 'Suscripciones cerradas en total: ' + suscripciones.length + '.',
      4,
    );
  }

  // La ficha y la suscripcion tienen que COINCIDIR: las dos escrituras van en
  // una sola transaccion, asi que una sin la otra es una incongruencia.
  for (const s of contrafirmadas) {
    if (!s.anexo_encargo_firmado_at) {
      throw error('La suscripcion ' + s.id + ' esta contrafirmada pero la ficha de la '
        + 'Empresa ' + s.id_empresa + ' no tiene la fecha de ejecucion. Las dos '
        + 'escrituras van en una sola transaccion: que no coincidan hay que '
        + 'reportarlo, no promediarlo.', 5);
    }
  }

  const principal = contrafirmadas[contrafirmadas.length - 1];
  const evidencia = construirEvidencia(principal);
  const fecha = principal.contrafirmado_at;

  let m = crudo;
  m = ponerEnBloque(m, 'anexo_encargo', 'estado', 'firmado');
  m = ponerEnBloque(m, 'anexo_encargo', 'fecha', aAscii(fecha));
  m = ponerEnBloque(m, 'anexo_encargo', 'evidencia', evidencia);

  // --- validaciones ------------------------------------------------------
  let datos;
  try {
    datos = JSON.parse(m);
  } catch (err) {
    throw error('El manifiesto dejo de ser JSON valido: ' + err.message, 3);
  }
  const noAscii = (m.match(/[^\x00-\x7F]/g) || []).length;
  if (noAscii > 0) {
    throw error('El manifiesto dejo de ser ASCII puro (' + noAscii + ' caracteres).', 3);
  }
  if (datos.anexo_encargo.estado !== 'firmado') {
    throw error('No se pudo escribir el estado del Anexo de Encargo.', 3);
  }
  if (!datos.anexo_encargo.fecha || !datos.anexo_encargo.evidencia) {
    throw error('El estado "firmado" sin fecha y sin evidencia es un estado '
      + 'incompleto: no se escribe.', 3);
  }
  // Lo que NO se puede tocar.
  if (datos.anexo_encargo.version !== manifiesto.anexo_encargo.version
    || datos.anexo_encargo.hash !== manifiesto.anexo_encargo.hash
    || datos.anexo_encargo.nota !== manifiesto.anexo_encargo.nota) {
    throw error('Este script solo escribe estado, fecha y evidencia: la version, la '
      + 'huella y la nota son la identidad del TEXTO y no se tocan.', 3);
  }

  const salida = {
    ok: true,
    solo_check: soloCheck,
    estado: datos.anexo_encargo.estado,
    fecha: datos.anexo_encargo.fecha,
    evidencia: datos.anexo_encargo.evidencia,
    suscripciones_contrafirmadas: contrafirmadas.length,
    hash_texto: hashTexto,
  };

  if (soloCheck) {
    // Con --check no se escribe: se compara lo que HABRIA con lo que hay.
    const coincide = m === crudo;
    salida.coincide = coincide;
    if (!coincide) {
      // --check informa del estado que HAY, no del que habria.
      salida.estado = manifiesto.anexo_encargo.estado;
      salida.fecha = manifiesto.anexo_encargo.fecha;
      salida.evidencia = manifiesto.anexo_encargo.evidencia;
    }
  } else {
    fs.writeFileSync(rutaManifiesto, m, 'utf8');
  }

  if (comoJson) {
    SALIDA(JSON.stringify(salida, null, 2));
    return salida;
  }

  SALIDA('[manifiesto-anexo-encargo] ' + (soloCheck ? 'verificado' : 'escrito'));
  SALIDA('  estado:    ' + salida.estado);
  SALIDA('  fecha:     ' + salida.fecha);
  SALIDA('  evidencia: ' + String(salida.evidencia).slice(0, 120) + '...');
  SALIDA('  contrafirmadas: ' + contrafirmadas.length);
  SALIDA('  texto:     ' + (hashTexto || '(no esta en el servidor)'));
  if (soloCheck && salida.coincide === false) {
    SALIDA('  (el manifiesto tiene un estado distinto del que se escribiria)');
  }
  return salida;
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (err) {
    SALIDA_ERROR('ERROR: ' + err.message);
    process.exit(err.codigo || 3);
  }
}

module.exports = {
  aAscii,
  ponerEnBloque,
  construirEvidencia,
  main,
  fijarSalida,
  MANIFIESTO,
  TEXTO_ENCARGO,
};
