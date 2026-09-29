#!/usr/bin/env node
/**
 * Seed DEV del Acuerdo de uso (firma-service/scripts/seed-dev-acuerdo.js).
 *
 * Siembra una versión DEV del Acuerdo de uso en la BD de desarrollo
 * (data/firma.sqlite). El texto se carga de un fixture versionado
 * (scripts/fixtures/acuerdo-dev-v1.0.txt) que contiene la marca visible
 * "ACUERDO DEV — NO LEGAL — SOLO PRUEBAS".
 *
 * Reglas duras (defensa en profundidad):
 *  1. Hard-block NODE_ENV=production (no se puede sembrar Acuerdo DEV en prod).
 *  2. El fixture DEBE contener las marcas "ACUERDO DEV" y "NO LEGAL".
 *     Si no, aborta (defensa contra uso accidental de Acuerdo real).
 *  3. Modo dry-run por defecto; --yes requerido para escribir.
 *  4. Idempotente: si la versión ya existe, no la duplica; sale OK sin tocar.
 *  5. La versión se crea con activa=true; el endpoint admin (Bloque B) ya
 *     garantiza la transición atómica (auto-desactiva anteriores).
 *  6. Usa agreementService.createVersion() que calcula texto_hash server-side.
 *
 * Uso:
 *   node scripts/seed-dev-acuerdo.js                # dry-run (no escribe)
 *   node scripts/seed-dev-acuerdo.js --yes          # escribe en BD dev
 *   node scripts/seed-dev-acuerdo.js --version=v2.0 --yes
 *   node scripts/seed-dev-acuerdo.js --file=otro.txt --yes
 *
 * Variables de entorno:
 *   SEED_VERSION    Default v1.0
 *   SEED_FIXTURE    Default scripts/fixtures/acuerdo-dev-v1.0.txt
 *
 * Exit codes:
 *   0 = OK (creado o ya existía)
 *   1 = Error (producción, fixture no existe, etc.)
 *   2 = Argumentos inválidos
 */
'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_VERSION = 'v1.0';
const DEFAULT_FIXTURE = path.resolve(__dirname, 'fixtures', 'acuerdo-dev-v1.0.txt');

const MARCA_DEV = 'ACUERDO DEV';
const MARCA_NO_LEGAL = 'NO LEGAL';

/**
 * Parsea argv. Retorna objeto con yes, dryRun, version, file.
 */
function parseArgs(argv) {
  const args = { yes: false, dryRun: true, version: null, file: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--yes') args.yes = true;
    else if (a === '--no-dry-run') args.dryRun = false;
    else if (a.startsWith('--version=')) args.version = a.split('=').slice(1).join('=');
    else if (a.startsWith('--file=')) args.file = a.split('=').slice(1).join('=');
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
Uso: node scripts/seed-dev-acuerdo.js [opciones]

Siembra una versión DEV del Acuerdo de uso en data/firma.sqlite.
IDEMPOTENTE: si la versión ya existe, no la duplica.

Opciones:
  --version=v1.0      Versión a sembrar (default: v1.0, override con SEED_VERSION)
  --file=<path>       Path al fixture con el texto del Acuerdo
                      (default: scripts/fixtures/acuerdo-dev-v1.0.txt)
  --yes               Confirma la escritura (sin esto, modo dry-run)
  --no-dry-run        Equivalente a --yes
  -h, --help          Muestra esta ayuda

Variables de entorno:
  NODE_ENV=production BLOQUEA el seed (no se puede sembrar Acuerdo DEV en prod)
  SEED_VERSION       Default v1.0
  SEED_FIXTURE       Default scripts/fixtures/acuerdo-dev-v1.0.txt

El Acuerdo DEV tiene marca visible "ACUERDO DEV — NO LEGAL — SOLO PRUEBAS".
NO usar en producción. Use el endpoint /internal/admin/acuerdo-versiones
con un Acuerdo LEGAL en su lugar.
`);
}

/**
 * Carga config de forma lazy (diferida al main) para permitir que
 * tests/setupeen env vars ANTES de cargar config.js.
 */
function loadConfig() {
  return require('../src/config');
}

function loadAgreementService() {
  return require('../src/services/agreement');
}

function loadHashModule() {
  return require('../src/crypto/hash');
}

/**
 * Función principal exportable para tests.
 * @returns {number} exit code (0 ok, 1 error, 2 args inválidos)
 */
function main(argv) {
  // 1. Hard-block producción
  const config = loadConfig();
  if (config.env === 'production') {
    console.error('ERROR: NODE_ENV=production detectado.');
    console.error('El seed DEV del Acuerdo está BLOQUEADO en producción.');
    console.error('Use el endpoint /internal/admin/acuerdo-versiones con un Acuerdo LEGAL.');
    return 1;
  }

  const args = parseArgs(argv || process.argv);
  // --yes implica "voy a escribir": bajar el flag de dry-run automáticamente.
  // Si el usuario pasa solo --yes, escribirá. Si pasa --yes --no-dry-run, igual.
  // Si pasa --no-dry-run sin --yes, retorna error 2 más adelante.
  if (args.yes) args.dryRun = false;
  const version = args.version || process.env.SEED_VERSION || DEFAULT_VERSION;
  const fixturePath = args.file || process.env.SEED_FIXTURE || DEFAULT_FIXTURE;

  // 2. Validar fixture existe
  if (!fs.existsSync(fixturePath)) {
    console.error(`ERROR: fixture no encontrado: ${fixturePath}`);
    return 1;
  }
  const texto = fs.readFileSync(fixturePath, 'utf8');

  // 3. Verificar marcas DEV (defensa contra uso accidental de Acuerdo real)
  if (!texto.includes(MARCA_DEV) || !texto.includes(MARCA_NO_LEGAL)) {
    console.error(`ERROR: el fixture NO contiene las marcas DEV.`);
    console.error(`Se requiere que el texto contenga "${MARCA_DEV}" y "${MARCA_NO_LEGAL}".`);
    console.error(`Fixture: ${fixturePath}`);
    return 1;
  }

  // 4. Calcular preview del hash (para dry-run)
  const { sha256 } = loadHashModule();
  const hashPreview = sha256(texto);

  console.log('=== Seed DEV Acuerdo ===');
  console.log(`versión:    ${version}`);
  console.log(`fixture:    ${fixturePath}`);
  console.log(`chars:      ${texto.length}`);
  console.log(`hash SHA-256: ${hashPreview}`);
  console.log(`dry-run:    ${args.dryRun ? 'SÍ (no se escribirá nada)' : 'NO'}`);
  console.log(`env:        ${config.env}`);
  console.log('');

  // 5. Idempotencia: si la versión ya existe, no duplicar
  const agreementService = loadAgreementService();
  const existente = agreementService.getByVersion(version);
  if (existente) {
    console.log(`La versión ${version} ya existe:`);
    console.log(`  texto_hash: ${existente.texto_hash}`);
    console.log(`  activa:     ${existente.activa === 1 ? 'sí' : 'no'}`);
    console.log(`  fecha_vigencia_inicio: ${existente.fecha_vigencia_inicio}`);
    console.log('');
    console.log('No se hace nada (idempotente).');
    return 0;
  }

  // 6. Dry-run: solo mostrar qué se haría
  if (args.dryRun) {
    console.log('DRY-RUN: no se escribió nada. Use --yes para confirmar.');
    console.log('Si se ejecutara, se crearía la versión con:');
    console.log(`  version: ${version}`);
    console.log(`  texto_hash: ${hashPreview}`);
    console.log(`  activa: true (auto-desactivaría anteriores)`);
    return 0;
  }

  // 7. Verificar --yes
  if (!args.yes) {
    console.error('ERROR: se requiere --yes para escribir en la BD.');
    return 2;
  }

  // 8. Crear la versión
  console.log('Creando versión en la BD...');
  const pkg = require('../package.json');
  const creada = agreementService.createVersion({
    version,
    texto,
    activa: true,
    creado_por: 'rh:seed-dev-acuerdo',
    kair_version: pkg.version || 'dev',
    metadata: {
      source: 'scripts/seed-dev-acuerdo.js',
      fixture: path.basename(fixturePath),
    },
  });

  console.log('Versión creada:');
  console.log(`  version:      ${creada.version}`);
  console.log(`  texto_hash:   ${creada.texto_hash}`);
  console.log(`  activa:       ${creada.activa === 1 ? 'sí' : 'no'}`);
  console.log(`  desactivadas: ${JSON.stringify(creada.desactivadas)}`);
  console.log(`  creado_por:   ${creada.creado_por}`);
  console.log('');
  console.log('Ahora GET /internal/acuerdo-activo retornará esta versión.');

  return 0;
}

module.exports = {
  main,
  parseArgs,
  // Constantes exportadas para tests
  DEFAULT_VERSION,
  DEFAULT_FIXTURE,
  MARCA_DEV,
  MARCA_NO_LEGAL,
};

if (require.main === module) {
  const code = main(process.argv);
  process.exit(code);
}
