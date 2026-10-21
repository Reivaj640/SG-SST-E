#!/usr/bin/env node
/**
 * scripts/purga-ventana.js
 *
 * Ejecutor de la supresión de datos vencidos (numeral 10.6; el 8.6 es el deber
 * de COMUNICAR el plazo y dónde pedir copia).
 *
 * QUÉ HACE
 * --------
 * Abre la ventana de purga, arma el lote de firmas elegibles y suprime, en dos
 * capas:
 *
 *   1. La CAPA DE AUDITORÍA: el registro de auditoría (los eventos) de esas
 *      firmas.
 *   2. La CAPA DE DATOS (la "5B"): la fila completa de la firma y los archivos
 *      que la acompañaban (PDF original, PDF firmado y constancia).
 *
 * Después cierra la ventana. Deja rastro de todo en `gh_firma_purga_log`, que es
 * append-only, y una lápida por firma suprimida en `gh_firma_purgadas`.
 *
 * POR QUÉ NO ES UN `DELETE` SUELTO
 * --------------------------------
 * El numeral 3.6(g) promete que el registro de auditoría "no puede ser
 * alterado ni eliminado una vez registrado", y la migración 020 lo hace
 * cumplir con triggers de la base de datos. La supresión del dato vencido
 * (10.6) necesita una vía legítima; abrirla no es aflojar el trigger, es abrir
 * una ventana con actor, motivo, plazo de expiración y lote explícito. Fuera de
 * la ventana, y fuera del lote, el trigger aborta.
 *
 * LAS DOS CONDICIONES DEL 10.6
 * ----------------------------
 *   1. El plazo venció. Y el plazo lo declara la Empresa: si no lo declaró,
 *      la firma no tiene fecha de conservación y no se suprime.
 *   2. No hay deber legal o contractual de conservación. Las firmas con
 *      `hold_legal = 1` NUNCA entran al lote, aunque su plazo haya vencido.
 *
 * USO
 * ---
 *   node scripts/purga-ventana.js --actor="Nombre" --motivo="Por qué"        # simulación
 *   node scripts/purga-ventana.js --actor="Nombre" --motivo="Por qué" --ejecutar
 *   node scripts/purga-ventana.js --actor="Nombre" --motivo="Por qué" \
 *        --empresa=900123456 --minutos=15 --ejecutar
 *
 * Sin `--ejecutar` el script NO borra nada: muestra qué se suprimiría, en las
 * dos capas. `--actor` y `--motivo` son obligatorios en los dos casos: una
 * supresión sin responsable ni razón no es auditable.
 *
 * Exit codes:
 *   0  operación exitosa (incluida la simulación)
 *   2  argumentos inválidos
 *   3  error de base de datos
 */
'use strict';

const conservacion = require('../src/services/conservacion');
const supresion = require('../src/services/supresion');

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  const opts = {
    actor: null, motivo: null, minutos: 30, empresa: null, ejecutar: false,
  };
  for (const arg of argv) {
    if (arg === '--ejecutar') {
      opts.ejecutar = true;
    } else if (arg.startsWith('--actor=')) {
      opts.actor = arg.slice('--actor='.length).trim();
    } else if (arg.startsWith('--motivo=')) {
      opts.motivo = arg.slice('--motivo='.length).trim();
    } else if (arg.startsWith('--empresa=')) {
      opts.empresa = arg.slice('--empresa='.length).trim();
    } else if (arg.startsWith('--minutos=')) {
      const n = Number(arg.slice('--minutos='.length));
      if (!Number.isInteger(n) || n <= 0) {
        throw new Error('--minutos debe ser un entero mayor que cero');
      }
      opts.minutos = n;
    } else {
      throw new Error(`Argumento desconocido: ${arg}`);
    }
  }
  if (!opts.actor) throw new Error('Falta --actor (quién hace la purga)');
  if (!opts.motivo) throw new Error('Falta --motivo (por qué se hace la purga)');
  return opts;
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (e) {
    process.stderr.write('[purga-ventana] ' + e.message + '\n');
    process.exit(2);
  }

  const linea = '─'.repeat(72);
  let grupos;
  try {
    grupos = conservacion.vencimientos({ id_empresa: opts.empresa });
  } catch (e) {
    process.stderr.write('[purga-ventana] error de base de datos: ' + e.message + '\n');
    process.exit(3);
  }

  process.stdout.write('\n' + linea + '\n');
  process.stdout.write('SUPPRESIÓN DE DATOS VENCIDOS (10.6 · el 8.6 es comunicar el plazo)\n');
  process.stdout.write(`Actor:  ${opts.actor}\n`);
  process.stdout.write(`Motivo: ${opts.motivo}\n`);
  process.stdout.write(linea + '\n\n');

  // El alcance, dicho antes de hacer nada. Un operador que no sepa esto
  // puede creer que ya cumplió el 10.6 cuando solo se borró la prueba.
  process.stdout.write('ALCANCE DE ESTA OPERACIÓN\n');
  process.stdout.write('  Se suprime en DOS capas:\n');
  process.stdout.write('    1. el REGISTRO DE AUDITORÍA (los eventos) de las firmas del lote;\n');
  process.stdout.write('    2. la CAPA DE DATOS: la fila completa de la firma y los archivos\n');
  process.stdout.write('       (PDF original, PDF firmado y constancia).\n');
  process.stdout.write('  Sobrevive: la PRUEBA DE LA ACEPTACIÓN (versión, huella del texto,\n');
  process.stdout.write('  fecha y hora e identificador de la solicitud), que es donde el 12.7\n');
  process.stdout.write('  deja la prueba de que el trabajador aceptó el Acuerdo.\n');
  process.stdout.write('  Se escribe una LÁPIDA por firma (gh_firma_purgadas), sin datos\n');
  process.stdout.write('  personales y sin la credencial del enlace, para que un enlace ya\n');
  process.stdout.write('  suprimido responda "no disponible por vencimiento del plazo".\n\n');

  process.stdout.write(`Vencidas y elegibles (se suprimen sus eventos): ${grupos.vencidosElegibles.length}\n`);
  grupos.vencidosElegibles.forEach((f) => process.stdout.write(
    `    ${f.id_solicitud}  vence=${f.fecha_conservacion}\n`
  ));
  process.stdout.write(`Vencidas en hold (NO se suprimen): ${grupos.vencidosEnHold.length}\n`);
  grupos.vencidosEnHold.forEach((f) => process.stdout.write(
    `    ${f.id_solicitud}  motivo=${f.motivo_hold || '(sin motivo)'}\n`
  ));
  process.stdout.write(`Sin plazo declarado (NO se suprimen): ${grupos.sinPlazo.length}\n`);

  // La simulación de la capa de datos: qué se borraría, sin borrar nada.
  const sim = supresion.simular({ id_empresa: opts.empresa });
  process.stdout.write(`\nSimulación de la capa de datos: ${sim.firmas} firmas, ${sim.archivos} archivos.\n`);
  sim.detalle.forEach((d) => process.stdout.write(
    `    ${d.id_solicitud}  archivos=${d.archivos}\n`
  ));

  if (!opts.ejecutar) {
    process.stdout.write('\nSIMULACIÓN: no se borró nada.\n');
    process.stdout.write('Agregue --ejecutar para suprimir de verdad.\n');
    process.stdout.write(linea + '\n');
    return;
  }

  if (!grupos.vencidosElegibles.length) {
    process.stdout.write('\nNo hay nada elegible: no se abrió ventana.\n');
    process.stdout.write(linea + '\n');
    return;
  }

  let resultado;
  try {
    conservacion.abrirVentana({
      actor: opts.actor,
      motivo: opts.motivo,
      minutos: opts.minutos,
    });
    const lote = conservacion.armarLote({
      actor: opts.actor,
      motivo: opts.motivo,
      id_empresa: opts.empresa,
    });
    // Capa 1: el registro de auditoría.
    resultado = conservacion.purgar({ actor: opts.actor });
    // Capa 2: la fila y los archivos. Se hace dentro de la misma ventana y
    // sobre el mismo lote, y vuelve a comprobar el hold de cada firma.
    const datos = supresion.suprimir({
      actor: opts.actor,
      motivo: opts.motivo,
      dryRun: false,
      id_empresa: opts.empresa,
    });
    process.stdout.write('\nSUPPRESIÓN EJECUTADA\n');
    process.stdout.write(`  firmas en el lote:      ${lote.firmas}\n`);
    process.stdout.write(`  eventos suprimidos:     ${resultado.eventos_purgados}\n`);
    process.stdout.write(`  filas suprimidas:       ${datos.firmas}\n`);
    process.stdout.write(`  archivos eliminados:    ${datos.archivos}\n`);
    process.stdout.write(`  bloqueadas por hold:    ${resultado.hold_bloqueados}\n`);
    process.stdout.write('  la ventana quedó cerrada y el lote vacío\n');
    process.stdout.write('  recibo por firma en gh_firma_purga_registro (sin datos personales)\n');
    process.stdout.write('  lápida por firma en gh_firma_purgadas (append-only)\n');
  } catch (e) {
    process.stderr.write('[purga-ventana] error: ' + e.message + '\n');
    process.exit(3);
  }
  process.stdout.write(linea + '\n');
}

main();
