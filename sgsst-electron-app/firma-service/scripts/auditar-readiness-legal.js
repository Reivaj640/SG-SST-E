/**
 * Auditoría de readiness legal — CLI de operador.
 *
 * Uso:
 *   node scripts/auditar-readiness-legal.js
 *   node scripts/auditar-readiness-legal.js --gate=publicacion
 *   node scripts/auditar-readiness-legal.js --gate=primera_firma --json
 *   node scripts/auditar-readiness-legal.js --estricto
 *
 * Códigos de salida:
 *   0  reporte generado (aunque falten cosas, salvo --estricto)
 *   1  --estricto y el gate NO está listo
 *   2  error de uso o de configuración
 *
 * NO publica, NO firma y NO enciende D-02. Es una fotografía.
 */
'use strict';

const readinessLegal = require('../src/services/readinessLegal');

function uso() {
  return [
    'Uso: node scripts/auditar-readiness-legal.js [opciones]',
    '',
    'Opciones:',
    '  --gate=publicacion|primera_firma   Gate a auditar (default: primera_firma)',
    '  --json                             Salida JSON completa',
    '  --estricto                         Sale con 1 si el gate no está listo',
    '  --help, -h                         Muestra esta ayuda',
    '',
    'Ejemplos:',
    '  node scripts/auditar-readiness-legal.js --gate=publicacion',
    '  node scripts/auditar-readiness-legal.js --json > readiness.json',
  ].join('\n');
}

function parseArgs(argv) {
  const opts = {
    gate: 'primera_firma',
    json: false,
    estricto: false,
    ayuda: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--estricto') {
      opts.estricto = true;
    } else if (arg === '--help' || arg === '-h') {
      opts.ayuda = true;
    } else if (arg.startsWith('--gate=')) {
      opts.gate = arg.slice('--gate='.length);
    } else if (arg === '--gate') {
      i += 1;
      if (i >= argv.length) throw new Error('--gate necesita un valor');
      opts.gate = argv[i];
    } else {
      throw new Error(`Argumento no reconocido: ${arg}`);
    }
  }
  if (!readinessLegal.GATES.includes(opts.gate)) {
    throw new Error(
      `Gate inválido: ${opts.gate}. Usa: ${readinessLegal.GATES.join(' | ')}`,
    );
  }
  return opts;
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`[readiness] ${err.message}\n\n${uso()}\n`);
    process.exitCode = 2;
    return;
  }

  if (opts.ayuda) {
    process.stdout.write(uso() + '\n');
    return;
  }

  let reporte;
  try {
    reporte = readinessLegal.evaluar({ gate: opts.gate });
  } catch (err) {
    process.stderr.write(
      '[readiness] No se pudo generar el reporte: ' + err.message + '\n'
      + 'Revisa que el servicio esté configurado (.env) y que la base exista.\n',
    );
    process.exitCode = 2;
    return;
  }

  if (opts.json) {
    process.stdout.write(JSON.stringify(reporte, null, 2) + '\n');
  } else {
    process.stdout.write(readinessLegal.generarReporteTexto(reporte) + '\n');
  }

  if (opts.estricto && !reporte.listo) {
    process.exitCode = 1;
  }
}

main();
