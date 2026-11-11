#!/usr/bin/env node
/**
 * scripts/actualizar-manifiesto-anexo-nube.js
 *
 * PONE EL ESTADO REAL DE LA SUSCRIPCION DEL ANEXO DE NUBE EN EL MANIFIESTO
 * LEGAL, LEYENDOLO DE LA BASE.
 *
 * POR QUE ESTE SCRIPT EXISTE
 * --------------------------
 * El plan del punto 3 (9-nov-2026) exige que la firma del Anexo de Nube se
 * escriba en el manifiesto "con un script equivalente que lea
 * `gh_firma_anexo_nube_suscripciones`. Hoy no existe ese script". Sin el, la
 * firma se escribiria A MANO: y una firma escrita a mano es una afirmacion sin
 * respaldo, exactamente el "verde falso" que el plan prohibe.
 *
 * QUE ESCRIBE
 * -----------
 * Las claves de estado del bloque `anexo_nube`, que son DOS actos:
 *
 * PRIMER ACTO (la Empresa suscribio el texto vigente):
 *   firmado     true | false   (booleano, no la cadena "firmado")
 *   fecha       la fecha del acto, o null
 *   version     la version suscrita, o null
 *   hash        la huella SHA-256 del texto suscrito, o null
 *   evidencia   el resumen del acto, en texto plano ASCII
 *
 * SEGUNDO ACTO (K+AIR contrafirmo):
 *   contrafirmado        true | false
 *   contrafirma_fecha    la fecha del segundo acto, o null
 *   contrafirma_actor    quien contrafirmo, o null
 *   contrafirma_motivo   el motivo declarado (X-Admin-Motivo), o null
 *   contrafirma_evidencia    el resumen del segundo acto, o null
 *
 * POR QUE DOS ACTOS Y NO UNO
 * --------------------------
 * El texto vigente del Anexo de Nube (v1.2, seccion 10) es BILATERAL: el
 * instrumento queda EJECUTADO cuando la Empresa lo suscribe y K+AIR lo
 * contrafirma. El codigo solo registraba el primero, asi que el manifiesto
 * declaraba "firmado" describiendo la mitad del instrumento. La v1.2 del Anexo
 * de Encargo ya separa los dos actos (suscrito y firmado); el Anexo de Nube
 * ahora hace lo mismo.
 *
 * NO TOCA
 * -------
 *   `modelo`               la identidad del TEXTO vigente (version, hash, bytes)
 *   `versiones_firmadas`   las suscripciones anteriores: solo se AGREGAN, nunca
 *                          se borran. La bitacora es append-only.
 *   `anexo_encargo`        es otro instrumento, con otro script.
 *
 * LA REGLA QUE NO SE PUEDE SALTAR
 * -------------------------------
 * El manifiesto dice `firmado: true` SOLO si hay una suscripcion con
 * `estado = 'FIRMADA'` que ademas corresponda al TEXTO VIGENTE del servidor:
 * su `version` y su `hash_texto` tienen que ser los del archivo que el
 * servicio sirve (`legal/anexo-nube-v1.2.html`).
 *
 * Sin esa comparacion, la suscripcion de la v1.1 (que ASEPLUS hizo el
 * 5-nov-2026) haria que el manifiesto declarara firmado un texto que ya no es
 * el vigente: un estado que no habilita nada y que ademas miente. Por eso la
 * comparacion es contra el TEXTO, no contra la fecha.
 *
 * Si no hay suscripcion del texto vigente, el manifiesto dice `firmado: false`.
 * Eso NO es un error: es el estado real, y por eso el script sale con 0. Un
 * error es la INCONGRUENCIA: una suscripcion FIRMADA cuya ficha de Empresa no
 * coincide (codigo 4). Esa no se promedia: se reporta.
 *
 * Y hay una segunda regla, del mismo tipo: si hay suscripcion del texto
 * vigente pero la base NO tiene las columnas del segundo acto (migracion 060),
 * el script no declara la firma y sale con 3. Sin esas columnas no se puede
 * saber si el Anexo de Nube esta EJECUTADO, y un manifiesto que declara
 * firmado sin poder mirar la contrafirma es un verde falso.
 *
 * EL MANIFIESTO ES ASCII PURO
 * ---------------------------
 * El manifiesto se escribe con el escapado ASCII (`\uXXXX`) y el formato
 * `JSON.stringify(obj, null, 2)` mas un salto de linea final. Es el mismo
 * formato que produce `actualizar-manifiesto-1047.js`, de modo que los dos
 * scripts se pueden correr en cualquier orden sin que el diff se desordene.
 *
 * USO
 * ---
 *   node scripts/actualizar-manifiesto-anexo-nube.js
 *   node scripts/actualizar-manifiesto-anexo-nube.js --check
 *   node scripts/actualizar-manifiesto-anexo-nube.js --json
 *
 * `--manifiesto` y `--texto` existen para poder probar el script sobre una
 * COPIA, sin tocar los archivos de verdad.
 *
 * Exit codes:
 *   0 = el manifiesto quedo escrito (o verificado, con --check)
 *   2 = argumentos invalidos
 *   3 = error de base de datos, de lectura del manifiesto, el manifiesto
 *       dejo de ser JSON valido o ASCII puro, o la base no tiene las columnas
 *       del segundo acto (migracion 060) y hay una suscripcion del texto
 *       vigente que no se puede declarar sin ver la contrafirma
 *   4 = INCONGRUENCIA: hay una suscripcion FIRMADA del texto vigente pero la
 *       ficha de la Empresa no coincide con ella
 *   5 = el texto del servidor NO tiene la huella que declara el manifiesto:
 *       el manifiesto describe otro texto y no se escribe nada
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SERVICE_ROOT = path.resolve(__dirname, '..');
const MANIFIESTO = path.join(SERVICE_ROOT, 'legal-readiness.json');

// El texto vigente NO se escribe a mano: lo declara el modulo que suscribe.
const modelo = require('../src/services/anexoNubeModelo');

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
 * La convencion del repo: las razones sociales y los nombres que trae la base
 * se transcriben sin acentos ("Vasquez Munoz", no "Vasquez Munoz" con tilde).
 * Lo que no se puede transcribir se descarta: un signo raro en una evidencia no
 * es informacion.
 *
 * @param {*} valor
 * @returns {string}
 */
function aAscii(valor) {
  const original = String(valor === null || valor === undefined ? '' : valor);
  // Las formas con acento grave, circunflejo o diacritico se transcriben con
  // la misma letra base: el mapa se arma por el caracter acentuado, que es lo
  // unico que distingue "a" de "a" con acento.
  const CON_ESPERA_UNICODE = {
    '\u00e0': 'a', '\u00e1': 'a', '\u00e2': 'a', '\u00e3': 'a', '\u00e4': 'a', '\u00e5': 'a',
    '\u00e8': 'e', '\u00e9': 'e', '\u00ea': 'e', '\u00eb': 'e',
    '\u00ec': 'i', '\u00ed': 'i', '\u00ee': 'i', '\u00ef': 'i',
    '\u00f2': 'o', '\u00f3': 'o', '\u00f4': 'o', '\u00f5': 'o', '\u00f6': 'o',
    '\u00f9': 'u', '\u00fa': 'u', '\u00fb': 'u', '\u00fc': 'u',
    '\u00f1': 'n', '\u00e7': 'c', '\u00fd': 'y', '\u00ff': 'y',
  };
  let transcripcion = '';
  for (const letra of original) {
    const baja = letra.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(CON_ESPERA_UNICODE, baja)) {
      const destino = CON_ESPERA_UNICODE[baja];
      transcripcion += letra === baja ? destino : destino.toUpperCase();
    } else {
      transcripcion += letra;
    }
  }
  return transcripcion.replace(/[^\x20-\x7E]/g, '').trim();
}

/**
 * Escapa lo que no es ASCII, para que el manifiesto sea JSON ASCII puro.
 *
 * La funcion vive en `scripts/lib/manifiesto.js`: la forma del manifiesto la
 * escriben DOS scripts y tiene que ser UNA sola, o los dos `--check` se
 * contradicen (ver el archivo de la lib).
 *
 * @param {string} s
 * @returns {string}
 */
const { asciiEscape, formaCanonica, mismoEstado } = require('./lib/manifiesto');

// ---------------------------------------------------------------------------
// LA BASE
// ---------------------------------------------------------------------------

/**
 * Las columnas de contrafirma existen en la base.
 *
 * El Anexo de Nube es BILATERAL: la suscripcion de la Empresa es el primer
 * acto y la contrafirma de K+AIR el segundo (el texto vigente, seccion 10). Las
 * columnas del segundo acto llegan con la migracion 060. Si no estan, el
 * script NO puede saber si el instrumento esta ejecutado, y por eso SE NIEGA
 * a escribir: un manifiesto que dice "firmado" sin poder mirar el segundo
 * acto es exactamente el verde falso que este script existe para evitar.
 *
 * @returns {boolean}
 */
function hayColumnasDeContrafirma() {
  const db = require('../src/db/connection');
  try {
    const cols = db.prepare('PRAGMA table_info(gh_firma_anexo_nube_suscripciones)').all();
    const nombres = cols.map((c) => c.name);
    if (nombres.indexOf('contrafirmado_at') === -1
      || nombres.indexOf('contrafirma_actor') === -1) {
      return false;
    }
    const colsEmp = db.prepare('PRAGMA table_info(gh_firma_empresas)').all();
    const nombresEmp = colsEmp.map((c) => c.name);
    return nombresEmp.indexOf('anexo_nube_ejecutado_at') !== -1;
  } catch (e) {
    return false;
  }
}

/**
 * Las suscripciones FIRMADAS del Anexo de Nube, con la ficha de la Empresa.
 *
 * Las columnas del SEGUNDO acto (la contrafirma de K+AIR) se piden solo si
 * existen: si la migracion 060 todavia no se aplico, la consulta no revienta
 * y el script decide con lo que si puede ver (que es: no hay contrafirma que
 * pueda declarar, y por eso se niega a declarar una firma).
 *
 * @returns {Array<object>}
 */
function leerSuscripciones() {
  const db = require('../src/db/connection');
  const conContrafirma = hayColumnasDeContrafirma();
  const columnasContrafirma = conContrafirma
    ? ', s.contrafirmado_at, s.contrafirma_actor, s.contrafirma_motivo, '
      + 's.contrafirma_evidencia, s.contrafirma_acta_archivo, s.contrafirma_acta_hash, '
      + 'e.anexo_nube_ejecutado_at'
    : '';
  let filas;
  try {
    filas = db.prepare(`
      SELECT s.id, s.id_empresa, s.version, s.hash_texto, s.estado,
             s.firmado_at, s.evidencia, s.correo_firmante, s.nombre_firmante,
             s.cargo_firmante, s.ip_firma, s.user_agent_firma, s.creado_por
             ${columnasContrafirma},
             e.razon_social, e.nit, e.representante_legal,
             e.anexo_nube_firmado_at, e.anexo_nube_version, e.anexo_nube_hash
      FROM gh_firma_anexo_nube_suscripciones s
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
 * El rastro de una suscripcion, en orden.
 *
 * @param {number} idSuscripcion
 * @returns {Array<object>}
 */
function leerEventos(idSuscripcion) {
  const db = require('../src/db/connection');
  try {
    return db.prepare(
      'SELECT evento, detalle, fecha_hora FROM gh_firma_anexo_nube_eventos '
      + 'WHERE id_suscripcion = ? ORDER BY id',
    ).all(idSuscripcion);
  } catch (e) {
    return [];
  }
}

/**
 * Se puede declarar la firma del texto vigente?
 *
 * - Sin suscripcion del texto vigente no hay nada que declarar: el manifiesto
 *   dice "firmado: false" y eso no depende del segundo acto.
 * - Con suscripcion del texto vigente, el segundo acto tiene que ser VISIBLE.
 *   Si la base no tiene las columnas de la contrafirma (migracion 060), el
 *   script NO declara la firma: sin poder mirar el segundo acto no se puede
 *   saber si el Anexo de Nube esta EJECUTADO.
 *
 * @param {boolean} hayColumnas si la base tiene las columnas del segundo acto.
 * @param {boolean} haySuscripcionDelTextoVigente si hay algo que declarar.
 * @returns {boolean}
 */
function puedeDeclararFirma(hayColumnas, haySuscripcionDelTextoVigente) {
  if (!haySuscripcionDelTextoVigente) return true;
  return hayColumnas === true;
}

// ---------------------------------------------------------------------------
// LA EVIDENCIA
// ---------------------------------------------------------------------------

/**
 * La evidencia de una suscripcion: el resumen del acto, en ASCII.
 *
 * Los datos salen de la FILA, nunca se inventan. El Anexo de Nube no genera
 * acta (a diferencia del Anexo de Encargo), asi que la evidencia son las
 * columnas de la suscripcion y su rastro, con la huella del texto suscrito.
 *
 * @param {object} fila
 * @param {string} hashVigente
 * @returns {string}
 */
function construirEvidencia(fila, hashVigente) {
  const partes = [];

  partes.push(
    aAscii(fila.razon_social || fila.id_empresa)
    + (fila.nit ? ' (NIT ' + aAscii(fila.nit) + ')' : '')
    + '. Anexo de Nube version ' + aAscii(fila.version)
    + ', huella SHA-256 ' + aAscii(fila.hash_texto) + '.',
  );

  let evidencia = {};
  try {
    evidencia = fila.evidencia ? JSON.parse(fila.evidencia) : {};
  } catch (e) {
    evidencia = {};
  }

  partes.push(
    'ACTO (la Empresa): suscripcion id ' + fila.id + '; el codigo de '
    + 'verificacion salio al correo del firmante (' + aAscii(fila.correo_firmante)
    + '), nunca a un buzon que la Empresa pueda leer; la Empresa acepto las '
    + 'condiciones del texto vigente y la suscripcion quedo FIRMADA el '
    + aAscii(fila.firmado_at) + '.',
  );

  if (fila.nombre_firmante) {
    partes.push(
      'Firmante: ' + aAscii(fila.nombre_firmante)
      + (fila.cargo_firmante ? ', ' + aAscii(fila.cargo_firmante) : '')
      + (fila.representante_legal ? '. Representante legal declarado: ' + aAscii(fila.representante_legal) : '')
      + '.',
    );
  }

  if (fila.ip_firma) {
    partes.push(
      'IP de la firma: ' + aAscii(fila.ip_firma)
      + (fila.user_agent_firma ? '. Navegador: ' + aAscii(fila.user_agent_firma) : '') + '.',
    );
  }

  partes.push(
    'La suscripcion quedo registrada en la ficha de la Empresa '
    + '(gh_firma_empresas.anexo_nube_firmado_at = ' + aAscii(fila.anexo_nube_firmado_at)
    + ', con la version ' + aAscii(fila.anexo_nube_version)
    + ' y la huella ' + aAscii(fila.anexo_nube_hash) + '). Con esa fecha, y solo con '
    + 'ella, la Empresa queda habilitada para firmar documentos de sus '
    + 'trabajadores.',
  );

  partes.push(
    'La huella del texto suscrito es la del archivo que el servicio sirve '
    + '(' + aAscii(hashVigente) + '): si ese archivo cambia, la firma deja de '
    + 'describir el texto vigente y el item firmado_nube vuelve a quedar '
    + 'pendiente.',
  );

  const eventos = leerEventos(fila.id);
  if (eventos.length) {
    partes.push(
      'Rastro append-only en gh_firma_anexo_nube_eventos: '
      + eventos.map((e) => e.evento + ' (' + aAscii(e.fecha_hora) + ')').join(', ') + '.',
    );
  }

  // El Anexo de Nube es BILATERAL (v1.2, seccion 10). Este es el PRIMER acto. El
  // segundo se declara aparte, en `contrafirmado` y `contrafirma_evidencia`.
  // Decir aqui cual de los dos falta es lo que impide que un lector del
  // manifiesto tome "firmado" por "instrumento ejecutado".
  if (fila.contrafirmado_at) {
    partes.push(
      'Este es el PRIMER acto (la Empresa). El SEGUNDO acto (la contrafirma de '
      + 'K+AIR) quedo registrado el ' + aAscii(fila.contrafirmado_at)
      + ' y se declara en `contrafirmado` y `contrafirma_evidencia`: con los dos, '
      + 'el Anexo de Nube queda EJECUTADO.',
    );
  } else {
    partes.push(
      'Este es el PRIMER acto (la Empresa). El Anexo de Nube es bilateral (v1.2, '
      + 'seccion 10): falta el SEGUNDO acto, la contrafirma de K+AIR, y mientras no '
      + 'exista el instrumento NO esta EJECUTADO. El detalle de lo que falta esta '
      + 'en `contrafirma_evidencia` y en el item contrafirma_nube del gate.',
    );
  }

  partes.push(
    'El Anexo de Nube no genera acta de suscripcion: la evidencia de este acto '
    + 'son las columnas de la suscripcion y su rastro, con la huella del texto '
    + 'suscrito. La del segundo acto, si existe, lleva su propia acta y su '
    + 'propia huella.',
  );

  return partes.join(' ');
}

/**
 * La evidencia del SEGUNDO acto: la contrafirma de K+AIR.
 *
 * El texto vigente del Anexo de Nube (v1.2, seccion 10) es bilateral: el
 * instrumento queda EJECUTADO cuando los dos actos se han producido, y la
 * contrafirma se documenta con la fecha, el actor, el motivo y la huella
 * SHA-256 del acta. Si la suscripcion no esta contrafirmada, el texto dice
 * POR QUE: un manifiesto que dice "firmado" sin decir que falta el segundo
 * acto es un estado incompleto.
 *
 * @param {object} fila
 * @returns {string} texto plano, ASCII.
 */
function construirEvidenciaContrafirma(fila) {
  if (!fila.contrafirmado_at) {
    return 'SIN CONTRAFIRMA. El Anexo de Nube es bilateral (v1.2, seccion 10): la '
      + 'suscripcion de la Empresa es el primer acto y la contrafirma de '
      + 'K+AIR el segundo, y el instrumento solo queda EJECUTADO cuando los dos '
      + 'se han producido. La suscripcion id ' + fila.id + ' esta firmada por la '
      + 'Empresa el ' + aAscii(fila.firmado_at) + ', y no tiene contrafirma: '
      + 'falta el segundo acto.';
  }

  const partes = [];
  partes.push(
    'SEGUNDO ACTO (la contrafirma de K+AIR): el codigo de contrafirma salio al '
    + 'buzon de proteccion de datos de K+AIR, que es fijo en la configuracion '
    + 'del servicio y nunca a un buzon que la Empresa pueda leer; K+AIR '
    + 'verifico documentalmente quien firmo por la Empresa y la contrafirma '
    + 'quedo registrada el ' + aAscii(fila.contrafirmado_at) + ' por '
    + aAscii(fila.contrafirma_actor || 'kair')
    + (fila.contrafirma_motivo ? ' (motivo: ' + aAscii(fila.contrafirma_motivo) + ')' : '')
    + '.',
  );

  if (fila.contrafirma_acta_archivo) {
    partes.push(
      'Acta de la contrafirma: ' + aAscii(fila.contrafirma_acta_archivo)
      + ' (SHA-256 ' + aAscii(fila.contrafirma_acta_hash) + ').',
    );
  }

  // LA FACULTAD DE QUIEN CONTRAFIRMA POR GESSTIAR. La condicion del abogado
  // (P7, 10-nov-2026) exige que la ejecucion por una persona distinta del
  // representante legal de Gesstiar tenga la facultad acreditada y conservada
  // en el expediente. El manifiesto dice SI la tiene o NO: un segundo acto
  // sin ese dato no describe el instrumento entero.
  const facultad = leerFacultad(fila);
  if (facultad) {
    partes.push(
      'La facultad de quien contrafirma por K+AIR quedo acreditada antes del acto: '
      + aAscii(facultad.nombre)
      + (facultad.cargo ? ', ' + aAscii(facultad.cargo) : '')
      + '. Con que facultad: '
      + (facultad.resultado === 'REPRESENTANTE_LEGAL_ENCARGADO'
        ? 'representante legal de Gesstiar S.A.S.'
        : 'poder acreditado (' + aAscii(facultad.tipo) + ')')
      + '. Instrumento: ' + aAscii(facultad.instrumento_ref)
      + (facultad.instrumento_sha256
        ? ' (SHA-256 ' + aAscii(facultad.instrumento_sha256) + ')' : '')
      + '. Verificada el ' + aAscii(facultad.verificado_at) + '.',
    );
  } else {
    partes.push(
      'La contrafirma NO tiene acreditada la facultad de quien la hizo: se '
      + 'registro con un despliegue anterior a la exigencia del abogado. El item '
      + 'contrafirma_nube del gate NO puede quedar ok hasta que la facultad se '
      + 'certifique por la via administrativa.',
    );
  }

  partes.push(
    'Con esta fecha, y solo con ella, el Anexo de Nube queda EJECUTADO para '
    + 'esa Empresa.',
  );

  if (fila.anexo_nube_ejecutado_at) {
    partes.push(
      'La fecha de ejecucion del instrumento quedo en la ficha de la Empresa '
      + '(gh_firma_empresas.anexo_nube_ejecutado_at = '
      + aAscii(fila.anexo_nube_ejecutado_at) + ').',
    );
  }

  const eventos = leerEventos(fila.id).filter((e) => String(e.evento || '').indexOf('CONTRAFIRMA') === 0);
  if (eventos.length) {
    partes.push(
      'Rastro append-only de la contrafirma en gh_firma_anexo_nube_eventos: '
      + eventos.map((e) => e.evento + ' (' + aAscii(e.fecha_hora) + ')').join(', ') + '.',
    );
  }

  return partes.join(' ');
}

/**
 * La FACULTAD acreditada de quien contrafirma, leida de la EVIDENCIA del
 * segundo acto.
 *
 * La fuente es la evidencia que escribio el servicio al cerrar la contrafirma,
 * no el manifiesto ni una declaracion del operador: el manifiesto dice lo que
 * el servicio registro. Si la contrafirma se hizo con un despliegue anterior
 * (que no exigia la acreditacion), aqui sale `null`, y el GATE deja el item
 * `contrafirma_nube` pendiente: el manifiesto se puede seguir escribiendo,
 * pero el instrumento no se da por ejecutado.
 *
 * @param {object} fila
 * @returns {object|null}
 */
function leerFacultad(fila) {
  if (!fila.contrafirmado_at) return null;
  let evidencia = {};
  try {
    evidencia = fila.contrafirma_evidencia ? JSON.parse(fila.contrafirma_evidencia) : {};
  } catch (e) {
    evidencia = {};
  }
  const fac = evidencia.facultad;
  if (!fac || typeof fac !== 'object') return null;
  const resultado = aAscii(fac.resultado);
  if (!resultado) return null;
  return {
    resultado,
    nombre: aAscii(fac.nombre) || null,
    cargo: aAscii(fac.cargo) || null,
    tipo: aAscii(fac.tipo) || null,
    instrumento_ref: aAscii(fac.instrumento_ref) || null,
    instrumento_sha256: aAscii(fac.instrumento_sha256) || null,
    id_poder: (fac.id_poder === null || fac.id_poder === undefined)
      ? null : fac.id_poder,
    verificado_at: aAscii(fac.verificado_at) || null,
  };
}

// ---------------------------------------------------------------------------
// EL MAIN
// ---------------------------------------------------------------------------

function main(args) {
  let soloCheck = false;
  let comoJson = false;
  let rutaManifiesto = MANIFIESTO;
  let rutaTexto = modelo.RUTA_MODELO;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--check') soloCheck = true;
    else if (a === '--json') comoJson = true;
    else if (a === '--texto') {
      i += 1;
      if (!args[i]) throw error('--texto necesita una ruta.', 2);
      rutaTexto = path.resolve(args[i]);
    } else if (a === '--manifiesto') {
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
  const bloque = manifiesto.anexo_nube || {};
  const modeloBloque = bloque.modelo || {};

  // EL TEXTO VIGENTE: la huella del archivo real, no la del manifiesto.
  let hashTexto = null;
  if (fs.existsSync(rutaTexto)) {
    hashTexto = crypto.createHash('sha256')
      .update(fs.readFileSync(rutaTexto)).digest('hex');
    if (modeloBloque.hash && hashTexto !== String(modeloBloque.hash).toLowerCase()) {
      throw error('El texto del Anexo de Nube del servidor no tiene la huella que '
        + 'declara el manifiesto. No se escribe el estado: la evidencia '
        + 'describiria un texto que no es el que se firma.', 5);
    }
  }

  const suscripciones = leerSuscripciones();

  // La suscripcion del TEXTO VIGENTE: la que describe el archivo que el
  // servicio sirve hoy. Las de otras versiones no habilitan nada.
  const vigente = hashTexto
    ? suscripciones.filter((s) => String(s.hash_texto || '').trim().toLowerCase() === hashTexto
      && String(s.version || '').trim() === String(modelo.VERSION_MODELO).trim())
    : [];

  // Las suscripciones de OTRAS versiones: se conservan, no se reescriben.
  const anteriores = suscripciones.filter((s) => !vigente.includes(s));

  let estado = {
    firmado: false,
    fecha: null,
    version: null,
    hash: null,
    evidencia: null,
    contrafirmado: false,
    contrafirma_fecha: null,
    contrafirma_actor: null,
    contrafirma_motivo: null,
    contrafirma_evidencia: null,
    contrafirma_facultad: null,
  };

  if (vigente.length > 0) {
    const principal = vigente[vigente.length - 1];

    // INCONGRUENCIA: la fila dice FIRMADA pero la ficha de la Empresa no
    // coincide. Las dos escrituras van juntas; que no coincidan se reporta,
    // no se promedia.
    if (!principal.anexo_nube_firmado_at) {
      throw error('La suscripcion ' + principal.id + ' esta FIRMADA pero la ficha de la '
        + 'Empresa ' + principal.id_empresa + ' no tiene la fecha de suscripcion. Las dos '
        + 'escrituras van juntas: que no coincidan hay que reportarlo, no promediarlo.', 4);
    }
    if (String(principal.anexo_nube_hash || '').trim().toLowerCase() !== hashTexto) {
      throw error('La suscripcion ' + principal.id + ' esta FIRMADA sobre el texto vigente '
        + 'pero la ficha de la Empresa ' + principal.id_empresa + ' declara otra huella. '
        + 'Hay que reportarlo, no promediarlo.', 4);
    }

    // El SEGUNDO acto tiene que ser VISIBLE. El Anexo de Nube es bilateral y
    // sin la contrafirma no se puede saber si el instrumento esta EJECUTADO.
    // Si la base todavia no tiene las columnas del segundo acto (migracion
    // 060), el script NO declara la firma: un manifiesto que dice "firmado"
    // sin poder mirar la contrafirma es el verde falso que este script existe
    // para evitar. Declarar "no suscrito" si no hay suscripcion del texto
    // vigente si se puede, porque eso no depende del segundo acto.
    if (!puedeDeclararFirma(hayColumnasDeContrafirma(), true)) {
      throw error('La base no tiene las columnas del segundo acto del Anexo de Nube '
        + '(contrafirmado_at, contrafirma_actor). Falta aplicar la migracion 060. '
        + 'No se escribe nada: la suscripcion ' + principal.id + ' esta sobre el texto '
        + 'vigente, pero sin poder leer la contrafirma no se puede declarar si el '
        + 'instrumento esta EJECUTADO.', 3);
    }

    estado = {
      firmado: true,
      fecha: principal.firmado_at,
      version: principal.version,
      hash: String(principal.hash_texto || '').trim().toLowerCase(),
      evidencia: construirEvidencia(principal, hashTexto),
      contrafirmado: !!principal.contrafirmado_at,
      contrafirma_fecha: principal.contrafirmado_at || null,
      contrafirma_actor: principal.contrafirma_actor || null,
      contrafirma_motivo: principal.contrafirma_motivo || null,
      contrafirma_evidencia: principal.contrafirmado_at
        ? construirEvidenciaContrafirma(principal)
        : null,
      // La facultad acreditada de quien contrafirma por Gesstiar. Es `null`
      // si la contrafirma se hizo con un despliegue anterior a la exigencia
      // del abogado (P7, 10-nov-2026): en ese caso el manifiesto se sigue
      // escribiendo, pero el item `contrafirma_nube` del gate NO puede quedar
      // ok, porque el segundo acto no demuestra con que poder se firmo.
      contrafirma_facultad: leerFacultad(principal),
    };
  }

  // El objeto del manifiesto: se edita sobre el OBJETO y se devuelve con el
  // mismo formato, de modo que el diff sale minimo y legible.
  const m = JSON.parse(crudo);

  m.anexo_nube = Object.assign({}, m.anexo_nube, {
    firmado: estado.firmado,
    fecha: estado.fecha,
    version: estado.version,
    hash: estado.hash,
    evidencia: estado.evidencia,
    contrafirmado: estado.contrafirmado,
    contrafirma_fecha: estado.contrafirma_fecha,
    contrafirma_actor: estado.contrafirma_actor,
    contrafirma_motivo: estado.contrafirma_motivo,
    contrafirma_evidencia: estado.contrafirma_evidencia,
    contrafirma_facultad: estado.contrafirma_facultad,
  });

  // Las versiones anteriores: se AGREGAN, nunca se borran.
  const previas = Array.isArray(m.anexo_nube.versiones_firmadas)
    ? m.anexo_nube.versiones_firmadas.slice()
    : [];
  for (const s of anteriores) {
    const existente = previas.find((p) => p && p.version === s.version
      && String(p.hash || '').toLowerCase() === String(s.hash_texto || '').toLowerCase());
    if (existente) {
      // La entrada YA existe y NO se reescribe: la bitacora es append-only.
      // Lo unico que se COMPLETA es el dato del segundo acto, que las
      // entradas anteriores no tenian porque la contrafirma todavia no
      // existia. La base es la fuente de ese dato: si el acto ocurrio, se
      // declara. Un `true` nunca se degrada a `false`: un acto registrado
      // no se borra porque la base no lo mencione.
      if (s.contrafirmado_at) {
        existente.contrafirmado = true;
      } else if (existente.contrafirmado === undefined) {
        existente.contrafirmado = false;
      }
      continue;
    }
    previas.push({
      version: s.version,
      hash: String(s.hash_texto || '').trim().toLowerCase(),
      fecha: s.firmado_at,
      contrafirmado: !!s.contrafirmado_at,
      evidencia: construirEvidencia(s, hashTexto),
    });
  }
  m.anexo_nube.versiones_firmadas = previas;

  // --- validaciones ------------------------------------------------------
  // La forma canonica del manifiesto: una sola para los dos scripts que lo
  // escriben (ver `scripts/lib/manifiesto.js`).
  const salidaCruda = formaCanonica(m);
  let datos;
  try {
    datos = JSON.parse(salidaCruda);
  } catch (err) {
    throw error('El manifiesto dejo de ser JSON valido: ' + err.message, 3);
  }
  const noAscii = (salidaCruda.match(/[^\x00-\x7F]/g) || []).length;
  if (noAscii > 0) {
    throw error('El manifiesto dejo de ser ASCII puro (' + noAscii + ' caracteres).', 3);
  }
  // Lo que NO se puede tocar.
  const modeloAntes = manifiesto.anexo_nube && manifiesto.anexo_nube.modelo;
  if (JSON.stringify(datos.anexo_nube.modelo) !== JSON.stringify(modeloAntes)) {
    throw error('Este script no escribe el modelo: la identidad del TEXTO vigente es de '
      + 'otro script.', 3);
  }
  if (datos.anexo_nube.firmado === true) {
    if (!datos.anexo_nube.fecha || !datos.anexo_nube.evidencia
      || !datos.anexo_nube.version || !datos.anexo_nube.hash) {
      throw error('El estado "firmado" sin fecha, sin version, sin huella o sin evidencia '
        + 'es un estado incompleto: no se escribe.', 3);
    }
  }
  // El SEGUNDO acto, cuando existe, tiene que estar completo: una
  // contrafirma sin fecha, sin actor o sin evidencia no describe un acto.
  if (datos.anexo_nube.contrafirmado === true) {
    if (!datos.anexo_nube.contrafirma_fecha
      || !datos.anexo_nube.contrafirma_evidencia
      || !datos.anexo_nube.contrafirma_actor) {
      throw error('El estado "contrafirmado" sin fecha, sin actor o sin evidencia es un '
        + 'estado incompleto: no se escribe.', 3);
    }
  }

  const salida = {
    ok: true,
    solo_check: soloCheck,
    firmado: estado.firmado,
    fecha: estado.fecha,
    version: estado.version,
    hash: estado.hash,
    evidencia: estado.evidencia,
    contrafirmado: estado.contrafirmado,
    contrafirma_fecha: estado.contrafirma_fecha,
    contrafirma_actor: estado.contrafirma_actor,
    contrafirma_motivo: estado.contrafirma_motivo,
    contrafirma_evidencia: estado.contrafirma_evidencia,
    contrafirma_facultad: estado.contrafirma_facultad,
    suscripciones_firmadas: suscripciones.length,
    suscripciones_del_texto_vigente: vigente.length,
    hash_texto: hashTexto,
  };

  if (soloCheck) {
    // El check compara el ESTADO, no los BYTES. El archivo lo escriben dos
    // scripts y cada uno puede dejarlo con distinta forma: eso no es una
    // diferencia de estado. Comparar bytes hacia que el check del Nube
    // contradijera al del Encargo sobre el mismo manifiesto (11-nov-2026).
    const coincide = mismoEstado(datos, manifiesto);
    salida.coincide = coincide;
    if (!coincide) {
      // --check informa del estado que HAY, no del que habria.
      salida.firmado = bloque.firmado === true;
      salida.fecha = bloque.fecha || null;
      salida.version = bloque.version || null;
      salida.hash = bloque.hash || null;
      salida.evidencia = bloque.evidencia || null;
      salida.contrafirmado = bloque.contrafirmado === true;
      salida.contrafirma_fecha = bloque.contrafirma_fecha || null;
      salida.contrafirma_actor = bloque.contrafirma_actor || null;
      salida.contrafirma_motivo = bloque.contrafirma_motivo || null;
      salida.contrafirma_evidencia = bloque.contrafirma_evidencia || null;
    }
  } else {
    fs.writeFileSync(rutaManifiesto, salidaCruda, 'utf8');
  }

  if (comoJson) {
    SALIDA(JSON.stringify(salida, null, 2));
    return salida;
  }

  SALIDA('[manifiesto-anexo-nube] ' + (soloCheck ? 'verificado' : 'escrito'));
  SALIDA('  firmado:   ' + salida.firmado);
  SALIDA('  fecha:     ' + salida.fecha);
  SALIDA('  version:   ' + salida.version);
  SALIDA('  hash:      ' + salida.hash);
  SALIDA('  texto:     ' + (hashTexto || '(no esta en el servidor)'));
  SALIDA('  firmadas:  ' + suscripciones.length + ' (del texto vigente: ' + vigente.length + ')');
  SALIDA('  1er acto:  ' + (salida.firmado ? 'la Empresa suscribio el texto vigente' : 'sin suscripcion del texto vigente'));
  SALIDA('  2do acto:  ' + (salida.contrafirmado
    ? 'K+AIR contrafirmo el ' + salida.contrafirma_fecha + ' (' + salida.contrafirma_actor + ')'
    : 'FALTA la contrafirma de K+AIR: el Anexo de Nube no esta ejecutado'));
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
  asciiEscape,
  construirEvidencia,
  construirEvidenciaContrafirma,
  hayColumnasDeContrafirma,
  puedeDeclararFirma,
  main,
  fijarSalida,
  MANIFIESTO,
};
