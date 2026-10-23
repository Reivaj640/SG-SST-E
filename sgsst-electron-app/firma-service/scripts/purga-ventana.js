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

/**
 * La operación de purga.
 *
 * @param {string[]} [argv] - los argumentos de la línea de comandos (sin el
 *   node y sin el nombre del script). Si no se pasan, se usa `process.argv`.
 * @param {object} [deps] - las dependencias, para poder inyectarlas en un
 *   test. Por defecto son las de verdad.
 * @param {object} [deps.conservacion]
 * @param {object} [deps.supresion]
 * @param {function} [deps.write] - dónde va la salida (stdout por defecto).
 * @returns {number} el código de salida: 0 ok, 2 argumentos, 3 error.
 */
function main(argv, deps = {}) {
  const cons = deps.conservacion || conservacion;
  const sup = deps.supresion || supresion;
  const write = deps.write || ((t) => process.stdout.write(t));

  let opts;
  try {
    opts = parseArgs(argv || process.argv.slice(2));
  } catch (e) {
    process.stderr.write('[purga-ventana] ' + e.message + '\n');
    return 2;
  }

  const linea = '─'.repeat(72);
  let grupos;
  try {
    grupos = cons.vencimientos({ id_empresa: opts.empresa });
  } catch (e) {
    process.stderr.write('[purga-ventana] error de base de datos: ' + e.message + '\n');
    return 3;
  }

  write('\n' + linea + '\n');
  write('SUPPRESIÓN DE DATOS VENCIDOS (10.6 · el 8.6 es comunicar el plazo)\n');
  write(`Actor:  ${opts.actor}\n`);
  write(`Motivo: ${opts.motivo}\n`);
  write(linea + '\n\n');

  // El alcance, dicho antes de hacer nada. Un operador que no sepa esto
  // puede creer que ya cumplió el 10.6 cuando solo se borró la prueba.
  write('ALCANCE DE ESTA OPERACIÓN\n');
  write('  Se suprime en DOS capas:\n');
  write('    1. el REGISTRO DE AUDITORÍA (los eventos) de las firmas del lote;\n');
  write('    2. la CAPA DE DATOS: la fila completa de la firma y los archivos\n');
  write('       (PDF original, PDF firmado y constancia).\n');
  write('  Sobrevive: la PRUEBA DE LA ACEPTACIÓN (versión, huella del texto,\n');
  write('  fecha y hora e identificador de la solicitud), que es donde el 12.7\n');
  write('  deja la prueba de que el trabajador aceptó el Acuerdo.\n');
  write('  Se escribe una LÁPIDA por firma (gh_firma_purgadas), sin datos\n');
  write('  personales y sin la credencial del enlace, para que un enlace ya\n');
  write('  suprimido responda "no disponible por vencimiento del plazo".\n\n');

  write(`Vencidas y elegibles (se suprimen sus eventos): ${grupos.vencidosElegibles.length}\n`);
  grupos.vencidosElegibles.forEach((f) => write(
    `    ${f.id_solicitud}  vence=${f.fecha_conservacion}\n`
  ));
  write(`Vencidas en hold (NO se suprimen): ${grupos.vencidosEnHold.length}\n`);
  grupos.vencidosEnHold.forEach((f) => write(
    `    ${f.id_solicitud}  motivo=${f.motivo_hold || '(sin motivo)'}\n`
  ));
  write(`Sin plazo declarado (NO se suprimen): ${grupos.sinPlazo.length}\n`);
  // El 8.6(e)(iii): con una solicitud de copia pendiente NO se suprime. La
  // cuenta va en la salida, para que el operador vea por qué falta algo.
  write(`Vencidas con copia pendiente (NO se suprimen): ${grupos.vencidosConCopia.length}\n`);
  grupos.vencidosConCopia.forEach((f) => write(
    `    ${f.id_solicitud}  hay una solicitud de copia pendiente\n`
  ));

  // La simulación de la capa de datos: qué se borraría, sin borrar nada.
  //
  // Se simula sobre las MISMAS firmas que el lote va a contener (las
  // vencidas y elegibles), no sobre el lote: antes de abrir la ventana el
  // lote está vacío, y simular sobre él daba siempre "0 firmas, 0 archivos"
  // mientras la operación real suprimía una firma y tres archivos.
  const sim = sup.simularFirmas(grupos.vencidosElegibles);
  write(`\nSimulación de la capa de datos: ${sim.firmas} firmas, ${sim.archivos} archivos.\n`);
  sim.detalle.forEach((d) => write(
    `    ${d.id_solicitud}  archivos=${d.archivos}\n`
  ));

  if (!opts.ejecutar) {
    write('\nSIMULACIÓN: no se borró nada.\n');
    write('Agregue --ejecutar para suprimir de verdad.\n');
    write(linea + '\n');
    return 0;
  }

  if (!grupos.vencidosElegibles.length) {
    write('\nNo hay nada elegible: no se abrió ventana.\n');
    write(linea + '\n');
    return 0;
  }

  let resultado;
  let datos;
  let lote;
  try {
    cons.abrirVentana({
      actor: opts.actor,
      motivo: opts.motivo,
      minutos: opts.minutos,
    });
    lote = cons.armarLote({
      actor: opts.actor,
      motivo: opts.motivo,
      id_empresa: opts.empresa,
    });
    // Capa 1: el registro de auditoría.
    //
    // `cerrar: false` es OBLIGATORIO acá. La capa 1 cerraba la ventana y
    // vaciaba el lote al terminar, así que la capa 2 (que exige ventana
    // vigente y lote armado) ya no podía correr: fallaba con "No hay ventana
    // de purga abierta" y el documento, la constancia y los archivos de las
    // firmas vencidas NO se suprimían nunca. La ventana se cierra al final,
    // después de las dos capas.
    resultado = cons.purgar({ actor: opts.actor, cerrar: false });
    // Capa 2: la fila y los archivos. Se hace dentro de la misma ventana y
    // sobre el mismo lote, y vuelve a comprobar el hold de cada firma.
    datos = sup.suprimir({
      actor: opts.actor,
      motivo: opts.motivo,
      dryRun: false,
      id_empresa: opts.empresa,
    });
  } catch (e) {
    // Si algo falla, la ventana se cierra igual: no se deja una ventana
    // abierta con un lote a medias, que habilitaría una purga que el
    // operador no pidió.
    try { cons.cerrarVentana({ actor: opts.actor }); } catch (e2) { /* nada */ }
    process.stderr.write('[purga-ventana] error: ' + e.message + '\n');
    return 3;
  }
  // Las dos capas corrieron: la ventana se cierra y el lote queda vacío.
  cons.cerrarVentana({ actor: opts.actor });
  write('\nSUPPRESIÓN EJECUTADA\n');
  write(`  firmas en el lote:      ${lote.firmas}\n`);
  write(`  eventos suprimidos:     ${resultado.eventos_purgados}\n`);
  write(`  filas suprimidas:       ${datos.firmas}\n`);
  write(`  archivos eliminados:    ${datos.archivos}\n`);
  write(`  bloqueadas por hold:    ${resultado.hold_bloqueados}\n`);
  write('  la ventana quedó cerrada y el lote vacío\n');
  write('  recibo por firma en gh_firma_purga_registro (sin datos personales)\n');
  write('  lápida por firma en gh_firma_purgadas (append-only)\n');
  write('  el recibo de supresión se entrega a la Empresa por\n');
  write('  GET /internal/empresas/:id_empresa/recibos-supresion\n');
  write(linea + '\n');
  return 0;
}

module.exports = { main, parseArgs };

// El guion corre solo cuando se lo invoca directamente. Con este candado,
// un test puede exigirlo y ejercitar la orquestación real (la que decide si
// las dos capas corren o no) sin que el script se le execute debajo.
if (require.main === module) {
  process.exit(main(process.argv.slice(2)));
}
