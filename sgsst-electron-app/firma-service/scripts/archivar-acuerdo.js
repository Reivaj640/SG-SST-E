#!/usr/bin/env node
/**
 * scripts/archivar-acuerdo.js
 *
 * ARQUIVA una versión del Acuerdo de uso y deja constancia de que su texto
 * no se puede cambiar.
 *
 * POR QUÉ EXISTE ESTE SCRIPT
 * --------------------------
 * El Acuerdo de uso es el texto que el Trabajador acepta, y su huella
 * (SHA-256) es lo que ata la firma a un texto concreto. En cuanto una versión
 * se publica, ESA versión queda cerrada: si el archivo del repositorio se
 * editara después, dos cosas se romperían a la vez:
 *
 *   1. La huella de la versión publicada dejaría de coincidir con el archivo,
 *      y nadie podría probar que el texto aceptado es el que está en el repo.
 *   2. La siguiente versión se compararía contra un texto que ya no es el
 *      que se publicó.
 *
 * Este script no archiva el archivo: lo REGISTRA. El archivo se queda donde
 * está (para que el diff del repo muestre cualquier cambio) y lo que se sella
 * es su huella, en un manifiesto, junto con la fecha y con la verificación
 * contra lo que hay publicado en la base.
 *
 * REGLAS
 * ------
 *   1. Nunca modifica el texto del Acuerdo (ni el archivo ni la base).
 *   2. La huella se calcula sobre el TEXTO (utf8), igual que la que calcula
 *      `agreementService.createVersion` (sha256 del texto). Es la misma
 *      huella que ve el firmante.
 *   3. Si la versión está publicada en la base y la huella NO coincide con el
 *      archivo, el script ABORTA: eso significa que el archivo se editó
 *      después de publicar, y eso es un incidente, no un archivado.
 *   4. Es idempotente: volver a archivar la misma versión no cambia nada.
 *
 * Uso:
 *   node scripts/archivar-acuerdo.js --version=v1.0            # archiva
 *   node scripts/archivar-acuerdo.js --version=v1.0 --verificar # solo comprueba
 *
 * Exit codes:
 *   0 = OK (archivado, o verificado sin cambios)
 *   1 = Error (archivo ausente, manifiesto ilegible, etc.)
 *   2 = Argumentos inválidos
 *   3 = El archivo NO coincide con lo publicado (NO se archiva)
 */
'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_VERSION = 'v1.0';
const MANIFIEST_PATH = path.resolve(__dirname, 'fixtures', 'acuerdo-ARCHIVO.json');

function parseArgs(argv) {
  const args = { version: null, verificar: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--verificar') args.verificar = true;
    else if (a.startsWith('--version=')) args.version = a.split('=')[1];
    else if (a === '--help' || a === '-h') {
      printHelp();
      process.exit(0);
    } else {
      console.error(`Argumento desconocido: ${a}`);
      printHelp();
      process.exit(2);
    }
  }
  return args;
}

function printHelp() {
  console.log(`
Uso: node scripts/archivar-acuerdo.js [--version=v1.0] [--verificar]

Archiva (o verifica) una versión del Acuerdo de uso: sella su huella en
scripts/fixtures/acuerdo-ARCHIVO.json y la compara con lo publicado en la
base de datos. NO modifica el texto.

  --version=v1.0   Versión a archivar (default v1.0)
  --verificar      Solo comprueba que el archivo y el manifiesto siguen
                   cuadrando; no escribe nada.
`);
}

function sha256(texto) {
  // Misma función que usa el servicio (src/crypto/hash.js) para el
  // `texto_hash` de la versión: es la huella que ve el firmante.
  return require('crypto').createHash('sha256').update(texto, 'utf8').digest('hex');
}

function leerManifiesto() {
  if (!fs.existsSync(MANIFIEST_PATH)) return { versiones: {} };
  try {
    const raw = JSON.parse(fs.readFileSync(MANIFIEST_PATH, 'utf8'));
    if (!raw || typeof raw !== 'object' || typeof raw.versiones !== 'object') {
      throw new Error('el manifiesto no tiene la forma esperada');
    }
    return raw;
  } catch (e) {
    console.error(`No se pudo leer el manifiesto (${MANIFIEST_PATH}): ${e.message}`);
    process.exit(1);
  }
}

function main() {
  const args = parseArgs(process.argv);
  const version = args.version || DEFAULT_VERSION;
  const fixturePath = path.resolve(__dirname, 'fixtures', `acuerdo-${version}.txt`);

  if (!fs.existsSync(fixturePath)) {
    console.error(`No existe el archivo del Acuerdo: ${fixturePath}`);
    process.exit(1);
  }

  const texto = fs.readFileSync(fixturePath, 'utf8');
  const huella = sha256(texto);

  // 1. Qué dice la base de datos (si la versión está publicada).
  let publicada = null;
  try {
    // eslint-disable-next-line global-require
    const db = require('../src/db/connection');
    const fila = db.prepare(
      'SELECT version, texto, texto_hash, activa, fecha_creacion FROM gh_firma_acuerdo_versiones WHERE version = ?'
    ).get(version);
    if (fila) {
      publicada = {
        texto: fila.texto,
        texto_hash: fila.texto_hash,
        activa: Boolean(fila.activa),
        fecha_creacion: fila.fecha_creacion,
      };
    }
  } catch (e) {
    console.error(`No se pudo consultar la base de datos: ${e.message}`);
    process.exit(1);
  }

  const esDev = (t) => typeof t === 'string'
    && t.includes('ACUERDO DEV') && t.includes('NO LEGAL');
  const archivoEsDev = esDev(texto);

  console.log('=== Archivo de Acuerdo ===');
  console.log('  versión :', version);
  console.log('  archivo :', fixturePath);
  console.log('  chars   :', texto.length);
  console.log('  huella  :', huella);
  console.log('  tipo    :', archivoEsDev ? 'PRUEBAS (ACUERDO DEV)' : 'LEGAL');
  console.log('  en base :', publicada
    ? `SÍ (hash=${publicada.texto_hash}, activa=${publicada.activa}, tipo=${esDev(publicada.texto) ? 'PRUEBAS' : 'LEGAL'})`
    : 'NO (esta versión no está publicada en esta base)');

  // 2. Si está publicada, el archivo tiene que coincidir con lo publicado.
  if (publicada && publicada.texto_hash !== huella) {
    console.error('');
    // 2a. Colisión de número de versión entre el texto de pruebas y el legal.
    if (esDev(publicada.texto) && !archivoEsDev) {
      console.error('  NO SE ARCHIVA: en esta base hay una versión DE PRUEBAS con el mismo');
      console.error('  número de versión, y su texto es distinto del archivo legal.');
      console.error('    publicada (base, tipo PRUEBAS) :', publicada.texto_hash);
      console.error('    archivo (LEGAL)               :', huella);
      console.error('  La v1.0 legal y la v1.0 de pruebas NO pueden convivir: el número de');
      console.error('  versión es único y el texto publicado es el que el firmante aceptó.');
      console.error('  Solución: NO sembrar el Acuerdo DEV en una base donde se publicará');
      console.error('  el legal (staging), o renombrar la versión de pruebas.');
      process.exit(3);
    }
    console.error('  NO SE ARCHIVA: el archivo NO coincide con el texto publicado.');
    console.error('  Publicado en la base :', publicada.texto_hash);
    console.error('  Archivo de hoy      :', huella);
    console.error('  Esto significa que el texto se editó DESPUÉS de publicarse.');
    console.error('  Es un incidente, no un archivado. Investiguélo antes de seguir.');
    process.exit(3);
  }

  const manifiesto = leerManifiesto();
  const previo = manifiesto.versiones[version] || null;

  if (previo && previo.sha256 !== huella) {
    console.error('');
    console.error('  NO SE ARCHIVA: la huella archivada no coincide con el archivo.');
    console.error('  Archivada antes :', previo.sha256);
    console.error('  Archivo de hoy  :', huella);
    console.error('  Un Acuerdo archivado es INMUTABLE. Si el texto cambió, es una');
    console.error('  versión nueva (v1.1, v1.2...) y la v1.0 tiene que seguir como estaba.');
    process.exit(3);
  }

  if (args.verificar) {
    if (!previo) {
      console.error('  Esta versión no está archivada todavía.');
      process.exit(1);
    }
    console.log('');
    console.log('  VERIFICADO: el archivo sigue cuadrando con el manifiesto.');
    console.log(' archivado el :', previo.fecha_archivado);
    return;
  }

  manifiesto.versiones[version] = {
    sha256: huella,
    chars: texto.length,
    archivo: path.relative(path.resolve(__dirname, '..'), fixturePath).replace(/\\/g, '/'),
    fecha_archivado: previo ? previo.fecha_archivado : new Date().toISOString(),
    verificado_el: new Date().toISOString(),
    publicada_en_base: publicada ? publicada.fecha_creacion : null,
    nota: 'Version inmutable. Cambiar el texto exige publicar una version nueva '
      + 'con su propia huella; los consentimientos ya aceptados no se tocan.',
  };
  manifiesto.actualizado_el = new Date().toISOString();

  fs.writeFileSync(MANIFIEST_PATH, JSON.stringify(manifiesto, null, 2) + '\n', 'utf8');

  console.log('');
  console.log('  ARCHIVADO:', version, '->', MANIFIEST_PATH);
  console.log('  Este texto ya no se modifica. Para cambiarlo, se publica una v1.1.');
}

main();
