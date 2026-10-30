#!/usr/bin/env node
/**
 * scripts/actualizar-manifiesto-v1.3.js
 *
 * Apunta el manifiesto legal-readiness.json a los documentos de la v1.3.
 *
 * POR QUÉ ESTE SCRIPT Y NO UN JSON.stringify
 * -------------------------------------------
 * El manifiesto es ASCII PURO: las notas van sin tildes y los caracteres que
 * no son ASCII están escapados (\u00e1). Re-serializarlo con JSON.stringify lo
 * rompería: convertiría cada escape en el carácter real, el archivo dejaría de
 * ser ASCII y el diff sería enorme. Por eso el manifiesto se edita con
 * REEMPLAZO LITERAL sobre el texto crudo, y después se valida que siga siendo
 * JSON válido y ASCII puro.
 *
 * LAS HUELLAS NO SE INVENTAN
 * --------------------------
 * Las tres se recalculan desde los archivos reales: la del Acuerdo v1.3, la
 * del Anexo de Encargo y la del Anexo de Nube. Si un archivo no existe, el
 * script se niega a escribir.
 *
 * USO
 * ---
 *   node scripts/actualizar-manifiesto-v1.3.js
 *
 * Exit codes:
 *   0 = manifiesto actualizado
 *   3 = error (falta un documento, el manifiesto no es JSON, o un literal no
 *       aparece exactamente una vez)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SERVICE_ROOT = path.resolve(__dirname, '..');
const APP_ROOT = path.resolve(SERVICE_ROOT, '..');
const REPO_ROOT = path.resolve(APP_ROOT, '..');
const MANIFIESTO = path.join(SERVICE_ROOT, 'legal-readiness.json');

// ---------------------------------------------------------------------------
// Las notas del manifiesto. ASCII PURO: sin tildes, sin acentos crudos.
// ---------------------------------------------------------------------------

const NOTA_ACUERDO = [
  'Candidata v1.3, NO aprobada y NO publicada. Las claves conservan el nombre v1_1_* '
  + 'porque asi las lee el codigo (readinessLegal.js); su valor apunta a la v1.3, y el '
  + 'campo version declara la version que el texto debe llevar. La v1.1 y la v1.2 nunca '
  + 'se publicaron y quedan sin uso. El texto se arma desde la v1.0 sellada con '
  + 'scripts/empalmar-acuerdo-v1.1.js --version=v1.3 '
  + '--cambios=scripts/fixtures/acuerdo-v1.3-cambios.json; ese JSON se construye con '
  + 'scripts/construir-acuerdo-v1.3.js a partir del de la v1.2, de modo que la '
  + 'diferencia entre las dos versiones queda escrita y no transcrita. La fecha de '
  + 'vigencia la declara el owner antes de publicar y no se inventa. La v1.3 aplica la '
  + 'especificacion del abogado del 30-oct-2026: T1 (el 5.1 separa los tres deberes '
  + 'legales del articulo 2.2.2.47.6 del Decreto 1074 de 2015 de los deberes operativos '
  + 'adicionales de K+AIR), T2 (el literal f) del 5.1 y el 5.6 nuevo: las politicas de '
  + 'seguridad solo obligan si fueron informadas y se pusieron a disposicion antes de su '
  + 'aplicacion) y D1 (fin de la retencion indefinida: la tabla supletoria de '
  + 'conservacion que administra K+AIR, con precedencia de la tabla de la Empresa y sin '
  + 'recalcular historicos). El 12.7 se ajusto tambien a esa precedencia.',
].join('');

const NOTA_ENCARGO = [
  'Modelo sin firmar: el 30-oct-2026 se regeneraron las secciones 2 y 8 desde las fuentes '
  + 'unicas. La seccion 2 es la matriz de finalidades E1: ocho finalidades del 10.3, Grupo A '
  + 'siete y Grupo B una (10.3(h), no habilitada, pendiente de entrega de informacion por la '
  + 'Empresa), con nueve campos por finalidad. La seccion 8 es la tabla de conservacion E2, '
  + 'generada desde config/tabla-conservacion.json, que es la fuente unica de la que tambien '
  + 'sale el plazo por defecto del codigo. El contenido es coherente con el Acuerdo v1.3 '
  + 'candidato, que elimina la retencion indefinida: la tabla supletoria que administra K+AIR '
  + 'da un plazo por defecto por categoria y la tabla de retencion documental de la Empresa '
  + 'tiene precedencia. Los plazos de diez (10) y cinco (5) anos no se activan en produccion '
  + 'hasta que el abogado los valide; el mecanismo queda construido y la activacion es otra '
  + 'decision. La seccion 13 se completo con los articulos que el propio Anexo cita. La firma '
  + 'y la fecha las declara el owner.',
].join('');

const NOTA_NUBE = [
  'Modelo sin firmar: ninguna Empresa ha diligenciado ni firmado esta version. Su contenido se '
  + 'ajusto el 30-oct-2026 con la especificacion del abogado: el papel de Google LLC se '
  + 'documenta como proveedor de un Gmail de consumo, sin afirmar DPA empresarial ni '
  + 'subencargo contractual ni contrato de transmision; quedan escritas las reglas '
  + 'expresas del canal (por OTP no se envia ningun documento laboral completo y el correo no '
  + 'incluye documentos de identidad ni datos sensibles, con la excepcion documentada de la '
  + 'copia en papel con su registro de firma autografica); se documenta la Circular Externa '
  + '002 de 2025 de la SIC sin declarar comunicacion previa, con la conclusion juridica '
  + 'pendiente de revision profesional; se deja el checklist del RNBD sin declarar inscrita '
  + 'ni exenta; no se crea contrato de transmision ficticio ni se declara NCV; y se incorporan '
  + 'las tres respuestas a las preguntas del abogado. El 5 trae la ficha tecnica del canal '
  + 'OTP, con los datos verificables citados por archivo y linea y el resto marcado como '
  + 'pendiente de evidencia del owner. Los pendientes documentales que faltan quedan '
  + 'declarados en el propio Anexo, sin declararse cumplidos. La copia firmada, cuando exista, '
  + 'sera la que se registre en version y hash.',
].join('');

// ---------------------------------------------------------------------------

function error(msg) {
  const e = new Error(msg);
  e.codigo = 3;
  return e;
}

/**
 * Reemplazo literal: exige que el texto viejo aparezca EXACTAMENTE una vez.
 */
function reemplazar(texto, viejo, nuevo, etiqueta) {
  const n = texto.split(viejo).length - 1;
  if (n !== 1) {
    throw error('El literal de ' + etiqueta + ' aparece ' + n + ' veces; tiene que '
      + 'aparecer exactamente una.');
  }
  return texto.replace(viejo, nuevo);
}

/**
 * Sustituye el valor de una clave dentro de un bloque del JSON, sin tocar las
 * claves homonimas de otros bloques.
 *
 * @param {string} texto texto crudo del manifiesto
 * @param {string} bloque nombre del bloque, por ejemplo 'anexo_encargo'
 * @param {string} clave nombre de la clave dentro del bloque
 * @param {string} valor valor nuevo (texto JSON)
 * @returns {string}
 */
function valorEnBloque(texto, bloque, clave) {
  const i = texto.indexOf('"' + bloque + '": {');
  if (i < 0) throw error('El manifiesto no tiene el bloque "' + bloque + '".');
  const fin = texto.indexOf('\n  },', i);
  if (fin < 0) throw error('No se pudo cerrar el bloque "' + bloque + '".');
  const cuerpo = texto.slice(i, fin);
  const m = new RegExp('"' + clave + '"\\s*:\\s*"([^"]*)"').exec(cuerpo);
  if (!m) throw error('El bloque "' + bloque + '" no tiene la clave "' + clave + '".');
  return m[1];
}

/**
 * El cuerpo de un bloque del manifiesto, para poder buscar dentro de él sin
 * tocar las claves homónimas de otros bloques.
 *
 * @param {string} texto
 * @param {string} bloque
 * @returns {string}
 */
function cuerpoDeBloque(texto, bloque) {
  const i = texto.indexOf('"' + bloque + '": {');
  if (i < 0) throw error('El manifiesto no tiene el bloque "' + bloque + '".');
  const fin = texto.indexOf('\n  },', i);
  if (fin < 0) throw error('No se pudo cerrar el bloque "' + bloque + '".');
  return texto.slice(i, fin);
}

function ponerEnBloque(texto, bloque, clave, valor, etiqueta) {
  const i = texto.indexOf('"' + bloque + '": {');
  if (i < 0) throw error('El manifiesto no tiene el bloque "' + bloque + '".');
  const fin = texto.indexOf('\n  },', i);
  if (fin < 0) throw error('No se pudo cerrar el bloque "' + bloque + '".');
  const antes = texto.slice(0, i);
  const cuerpo = texto.slice(i, fin);
  const despues = texto.slice(fin);
  // El valor puede contener comillas ESCAPADAS (\"), asi que el patron tiene
  // que reconocer un string JSON completo y no solo los caracteres que no son
  // comilla: con `[^"]*` el valor se cortaria en la primera comilla escapada.
  const m = new RegExp('("' + clave + '"\\s*:\\s*)"((?:[^"\\\\]|\\\\.)*)"').exec(cuerpo);
  if (!m) throw error('El bloque "' + bloque + '" no tiene la clave "' + clave + '".');
  const nuevoCuerpo = cuerpo.replace(
    m[0],
    m[1] + '"' + valor.replace(/"/g, '\\"') + '"',
  );
  return antes + nuevoCuerpo + despues;
}

function sha256De(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

function main() {
  const args = process.argv.slice(2);
  let version = 'v1.3';
  for (const a of args) {
    if (a.startsWith('--version=')) version = a.slice('--version='.length).trim();
    else {
      console.error('Argumento desconocido: ' + a);
      process.exit(2);
    }
  }

  const relativoAcuerdo = 'scripts/fixtures/acuerdo-' + version + '.txt';
  const archivoAcuerdo = path.join(SERVICE_ROOT, relativoAcuerdo);
  const archivoEncargo = path.join(APP_ROOT, 'legal', 'anexo-encargo.html');
  const archivoNube = path.join(APP_ROOT, 'legal', 'anexo-nube-v1.0.html');
  for (const p of [archivoAcuerdo, archivoEncargo, archivoNube]) {
    if (!fs.existsSync(p)) throw error('No existe ' + p);
  }

  const hashAcuerdo = sha256De(archivoAcuerdo);
  const hashEncargo = sha256De(archivoEncargo);
  const hashNube = sha256De(archivoNube);

  if (!fs.existsSync(MANIFIESTO)) throw error('No existe ' + MANIFIESTO);
  let m = fs.readFileSync(MANIFIESTO, 'utf8');

  // --- Acuerdo -----------------------------------------------------------
  const viejoArchivo = /"v1_1_archivo":\s*"[^"]*"/;
  if (!viejoArchivo.test(m)) throw error('El manifiesto no tiene la clave "v1_1_archivo".');
  m = m.replace(viejoArchivo, '"v1_1_archivo": "' + relativoAcuerdo + '"');

  // La versión que el texto debe llevar, dentro del bloque "acuerdo".
  //
  // Se declara UNA sola vez. Este script es IDEMPOTENTE: correrlo dos veces
  // tiene que dejar el manifiesto igual, y si la clave se insertara siempre,
  // la segunda corrida dejaría "version" repetida. Un JSON con la misma clave
  // dos veces no dice lo que parece decir: el último valor gana y el primero
  // desaparece sin dejar rastro.
  if (/"version"\s*:\s*"[^"]*"/.test(cuerpoDeBloque(m, 'acuerdo'))) {
    m = ponerEnBloque(m, 'acuerdo', 'version', version, 'acuerdo.version');
  } else {
    const viejoVersion = /"v1_1_fecha":\s*"[^"]*"/;
    if (!viejoVersion.test(m)) throw error('El manifiesto no tiene la clave "v1_1_fecha".');
    m = m.replace(viejoVersion, '"version": "' + version + '",\n    "v1_1_fecha": "' + hoy() + '"');
  }

  // La fecha de la evidencia, siempre la de hoy.
  const viejoFechaAcuerdo = /"v1_1_fecha":\s*"[^"]*"/;
  if (!viejoFechaAcuerdo.test(m)) throw error('El manifiesto no tiene la clave "v1_1_fecha".');
  m = m.replace(viejoFechaAcuerdo, '"v1_1_fecha": "' + hoy() + '"');

  m = reemplazar(
    m,
    /"v1_1_hash":\s*"[^"]*"/.exec(m)[0],
    '"v1_1_hash": "' + hashAcuerdo + '"',
    'v1_1_hash',
  );

  m = ponerEnBloque(m, 'acuerdo', 'nota', NOTA_ACUERDO, 'la nota del Acuerdo');

  // --- Anexo de Encargo --------------------------------------------------
  m = ponerEnBloque(m, 'anexo_encargo', 'hash', hashEncargo, 'anexo_encargo.hash');
  m = ponerEnBloque(m, 'anexo_encargo', 'nota', NOTA_ENCARGO, 'la nota del Anexo de Encargo');

  // --- Anexo de Nube -----------------------------------------------------
  m = ponerEnBloque(m, 'anexo_nube', 'hash', hashNube, 'anexo_nube.hash');
  m = ponerEnBloque(m, 'modelo', 'hash', hashNube, 'anexo_nube.modelo.hash');
  m = ponerEnBloque(m, 'modelo', 'actualizado', '2026-10-30', 'anexo_nube.modelo.actualizado');
  m = ponerEnBloque(m, 'modelo', 'nota', NOTA_NUBE, 'la nota del Anexo de Nube');

  // --- validaciones ------------------------------------------------------
  try {
    JSON.parse(m);
  } catch (err) {
    throw error('El manifiesto dejo de ser JSON valido: ' + err.message);
  }
  const noAscii = (m.match(/[^\x00-\x7F]/g) || []).length;
  if (noAscii > 0) {
    throw error('El manifesto dejo de ser ASCII puro (' + noAscii + ' caracteres).');
  }

  fs.writeFileSync(MANIFIESTO, m, 'utf8');
  console.log('Manifiesto actualizado.');
  console.log('  acuerdo.v1_1_hash      : ' + hashAcuerdo);
  console.log('  anexo_encargo.hash     : ' + hashEncargo);
  console.log('  anexo_nube.modelo.hash : ' + hashNube);
  console.log('  bytes: ' + Buffer.byteLength(m, 'utf8'));
}

function hoy() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate());
}

try {
  main();
} catch (err) {
  console.error('ERROR: ' + err.message);
  process.exit(err.codigo || 3);
}
