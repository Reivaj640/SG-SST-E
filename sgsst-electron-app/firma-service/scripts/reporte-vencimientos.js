#!/usr/bin/env node
/**
 * scripts/reporte-vencimientos.js
 *
 * Reporte de conservación (numerales 8.6 y 10.6 del Acuerdo de uso).
 *
 * Responde, en los cuatro grupos que le importan a quien decide:
 *
 *   próximos           - vence en los próximos N días, todavía no
 *   vencidos elegibles - el plazo venció y NO hay deber legal de conservación
 *   vencidos en hold   - el plazo venció pero hay deber legal: NO se suprime
 *   sin plazo          - la Empresa no declaró plazo: no hay fecha, no hay purga
 *
 * ESTE SCRIPT NO BORRA NADA. Es de lectura. La supresión la ejecuta
 * `scripts/purga-ventana.js`, que abre la ventana de purga y deja rastro.
 *
 * Uso:
 *   node scripts/reporte-vencimientos.js                 # reporte completo
 *   node scripts/reporte-vencimientos.js --empresa=900123456
 *   node scripts/reporte-vencimientos.js --dias=60
 *   node scripts/reporte-vencimientos.js --json
 *
 * Exit codes:
 *   0  reporte generado (incluido "no hay nada vencido")
 *   2  argumentos inválidos
 *   3  error de base de datos
 */
'use strict';

const conservacion = require('../src/services/conservacion');

/**
 * Lee los argumentos de la línea de comandos.
 * @param {string[]} argv
 */
function parseArgs(argv) {
  const opts = { empresa: null, dias: null, json: false };
  for (const arg of argv) {
    if (arg === '--json') {
      opts.json = true;
    } else if (arg.startsWith('--empresa=')) {
      opts.empresa = arg.slice('--empresa='.length).trim();
    } else if (arg.startsWith('--dias=')) {
      const n = Number(arg.slice('--dias='.length));
      if (!Number.isInteger(n) || n < 0) {
        throw new Error('--dias debe ser un entero mayor o igual que cero');
      }
      opts.dias = n;
    } else {
      throw new Error(`Argumento desconocido: ${arg}`);
    }
  }
  return opts;
}

function lineaFirma(f) {
  const fecha = f.fecha_conservacion || '(sin plazo)';
  const hold = Number(f.hold_legal) === 1 ? ' [HOLD: ' + (f.motivo_hold || 'sin motivo') + ']' : '';
  return `    ${f.id_solicitud}  vence=${fecha}  empresa=${f.id_empresa}  estado=${f.estado}${hold}`;
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (e) {
    process.stderr.write('[reporte-vencimientos] ' + e.message + '\n');
    process.exit(2);
  }

  let grupos;
  try {
    grupos = conservacion.vencimientos({
      id_empresa: opts.empresa,
      dias_proximos: opts.dias === null ? undefined : opts.dias,
    });
  } catch (e) {
    process.stderr.write('[reporte-vencimientos] error de base de datos: ' + e.message + '\n');
    process.exit(3);
  }

  if (opts.json) {
    process.stdout.write(JSON.stringify({
      generado_en: new Date().toISOString(),
      empresa: opts.empresa,
      resumen: {
        proximos: grupos.proximos.length,
        vencidosElegibles: grupos.vencidosElegibles.length,
        vencidosEnHold: grupos.vencidosEnHold.length,
        sinPlazo: grupos.sinPlazo.length,
      },
      grupos,
    }, null, 2) + '\n');
    return;
  }

  const linea = '─'.repeat(72);
  process.stdout.write('\n' + linea + '\n');
  process.stdout.write('REPORTE DE VENCIMIENTOS DE CONSERVACIÓN (8.6 / 10.6)\n');
  process.stdout.write(`Generado: ${new Date().toISOString()}\n`);
  if (opts.empresa) process.stdout.write(`Empresa: ${opts.empresa}\n`);
  process.stdout.write(linea + '\n\n');

  // La alerta va PRIMERO: si hay firmas sin plazo declarado, el resto del
  // reporte es secundario. Retener sin plazo declarado no es una operación
  // neutra: es retención indefinida, que tampoco es cumplimiento.
  if (grupos.sinPlazo.length) {
    process.stdout.write('!! ALERTA DE CUMPLIMIENTO !!\n');
    process.stdout.write(
      `   ${grupos.sinPlazo.length} firma(s) SIN plazo de conservación declarado.\n`
    );
    process.stdout.write('   La Empresa no declaró plazo_retencion_dias: el sistema no inventa\n');
    process.stdout.write('   plazos (el 8.6 dice que el Acuerdo no los fija porque la ley no los\n');
    process.stdout.write('   fija), así que esas firmas NUNCA podrán suprimirse. Retener de\n');
    process.stdout.write('   forma indefinida tampoco es cumplimiento: la Empresa debe declarar\n');
    process.stdout.write('   el plazo (o el sistema debe bloquear la firma) ANTES de la primera\n');
    process.stdout.write('   firma. Ver la sección "ALERTA" del plan de onboarding.\n\n');
  }

  process.stdout.write(`PRÓXIMOS A VENCER (${grupos.proximos.length})\n`);
  grupos.proximos.forEach((f) => process.stdout.write(lineaFirma(f) + '\n'));
  if (!grupos.proximos.length) process.stdout.write('    (ninguno)\n');

  process.stdout.write(`\nVENCIDOS Y ELEGIBLES PARA SUPRESIÓN (${grupos.vencidosElegibles.length})\n`);
  grupos.vencidosElegibles.forEach((f) => process.stdout.write(lineaFirma(f) + '\n'));
  if (!grupos.vencidosElegibles.length) process.stdout.write('    (ninguno)\n');

  process.stdout.write(`\nVENCIDOS EN HOLD — NO SE SUPRIMEN (${grupos.vencidosEnHold.length})\n`);
  grupos.vencidosEnHold.forEach((f) => process.stdout.write(lineaFirma(f) + '\n'));
  if (!grupos.vencidosEnHold.length) process.stdout.write('    (ninguno)\n');

  process.stdout.write(`\nSIN PLAZO DECLARADO — NO HAY PURGA (${grupos.sinPlazo.length})\n`);
  process.stdout.write('    La Empresa no declaró plazo_retencion_dias: el sistema no inventa\n');
  process.stdout.write('    plazos. Para purgar estas firmas hay que declarar el plazo.\n');
  grupos.sinPlazo.forEach((f) => process.stdout.write(lineaFirma(f) + '\n'));
  if (!grupos.sinPlazo.length) process.stdout.write('    (ninguno)\n');

  process.stdout.write('\n' + linea + '\n');
  process.stdout.write('Este reporte NO borra nada. Para suprimir, use:\n');
  process.stdout.write('  node scripts/purga-ventana.js --actor="..." --motivo="..." --ejecutar\n');
  process.stdout.write(linea + '\n');
  process.stdout.write('Alcance: lo que se purga con ese comando es el REGISTRO DE AUDITORÍA.\n');
  process.stdout.write('Los datos personales de la firma (correo, huellas, manifestación de\n');
  process.stdout.write('voluntad) y los archivos (PDF, constancia) NO se suprimen: eso es la\n');
  process.stdout.write('capa 5B, que es un paquete aparte.\n');
  process.stdout.write(linea + '\n');
}

main();
