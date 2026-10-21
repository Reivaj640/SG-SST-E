#!/usr/bin/env node
/**
 * scripts/recifrar-representante.js
 *
 * Re-cifra el número del representante legal en las filas que lo guardan en
 * claro (H23 · 8B).
 *
 * POR QUÉ HAY UN SCRIPT
 * ---------------------
 * A partir de la 8B, `create()` y `createForCompany()` cifran el número del
 * representante antes de archivarlo. Las filas CREADAS ANTES de ese cambio lo
 * guardan en claro, y eso no se arregla solo: hay que volver a escribirlas.
 *
 * Por qué no se hizo con una migración: una migración corre sola, en el
 * arranque, sin que nadie pueda revisar qué va a tocar. Y tocar una fila ya
 * archivada es una operación que roza lo irreversible: si el número se
 * cifrara con una llave equivocada, la fila quedaría ilegible para siempre
 * (el número no se puede recuperar de otra parte).
 *
 * Por eso el script:
 *
 *   - NO hace nada sin `--ejecutar`.
 *   - Exige `--actor` y `--motivo`: un cambio sobre datos archivados sin
 *     responsable ni razón no es auditable.
 *   - Verifica ANTES de escribir: cifra, descifra y compara con el original.
 *     Si no cuadra, esa fila no se toca.
 *   - Deja un evento por fila re-cifrada (`REPRESENTANTE_RECIFRADO`), con el
 *     actor y el motivo.
 *
 * USO
 * ---
 *   node scripts/recifrar-representante.js --actor="Nombre" --motivo="Por qué"
 *   node scripts/recifrar-representante.js --actor="Nombre" --motivo="Por qué" \
 *        --ejecutar
 *   node scripts/recifrar-representante.js --actor="Nombre" --motivo="Por qué" \
 *        --empresa=900123456 --ejecutar
 *
 * Exit codes:
 *   0  operación exitosa (incluida la simulación)
 *   2  argumentos inválidos
 *   3  error de base de datos
 */
'use strict';

const db = require('../src/db/connection');
const representanteService = require('../src/services/representante');
const signRequestService = require('../src/services/signRequest');

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  const opts = {
    actor: null, motivo: null, empresa: null, ejecutar: false,
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
    } else {
      throw new Error(`Argumento desconocido: ${arg}`);
    }
  }
  if (!opts.actor) throw new Error('Falta --actor (quién hace el cambio)');
  if (!opts.motivo) throw new Error('Falta --motivo (por qué se hace el cambio)');
  return opts;
}

/**
 * Las filas que guardan el número del representante EN CLARO.
 *
 * "En claro" = el snapshot existe, tiene número, y ese número NO es un sobre
 * cifrado. Las que ya están cifradas se saltan (no hay nada que hacer).
 *
 * @param {string|null} id_empresa
 * @returns {Array<object>} filas candidatas
 */
function filasEnClaro(id_empresa) {
  const sql = `
    SELECT id, id_solicitud, id_empresa, representante_legal_snapshot
    FROM gh_firmas_electronicas
    WHERE representante_legal_snapshot IS NOT NULL
      AND representante_legal_snapshot <> ''
      ${id_empresa ? 'AND id_empresa = ?' : ''}
    ORDER BY id ASC`;
  const stmt = id_empresa ? db.prepare(sql).all(id_empresa) : db.prepare(sql).all();

  const candidatos = [];
  for (const fila of stmt) {
    const snap = representanteService.leerSnapshot(fila.representante_legal_snapshot);
    if (!snap) {
      candidatos.push({ fila, problema: 'snapshot ilegible (JSON invalido)' });
      continue;
    }
    const valor = snap.numero_identificacion;
    if (typeof valor !== 'string' || valor.length === 0) continue;
    if (representanteService.esCifrado(valor)) continue;
    candidatos.push({ fila, snap, problema: null });
  }
  return candidatos;
}

/**
 * Prepara el snapshot cifrado de una fila y lo VERIFICA.
 *
 * @returns {{ok: true, json: string}|{ok: false, error: string}}
 */
function preparar(fila, snap) {
  const id_empresa = fila.id_empresa;
  let cifrado;
  try {
    cifrado = representanteService.cifrarSnapshot(snap, id_empresa);
  } catch (e) {
    return { ok: false, error: 'no se pudo cifrar: ' + e.message };
  }
  // Verificación antes de escribir: lo que se guarde tiene que devolver el
  // mismo número cuando se abra. Si no cuadra, esa fila NO se toca.
  let abierto = null;
  try {
    abierto = representanteService.numeroEnClaro(cifrado, id_empresa);
  } catch (e) {
    return { ok: false, error: 'no se pudo verificar el cifrado: ' + e.message };
  }
  if (abierto !== snap.numero_identificacion) {
    return { ok: false, error: 'la verificacion no cuadra (el numero no vuelve igual)' };
  }
  return { ok: true, json: JSON.stringify(cifrado) };
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (e) {
    process.stderr.write('[recifrar-representante] ' + e.message + '\n');
    return 2;
  }

  const linea = '-'.repeat(72);
  let candidatos;
  try {
    candidatos = filasEnClaro(opts.empresa);
  } catch (e) {
    process.stderr.write('[recifrar-representante] error de base de datos: ' + e.message + '\n');
    return 3;
  }

  const conProblema = candidatos.filter((c) => c.problema);
  const aRecifrar = candidatos.filter((c) => !c.problema);

  process.stdout.write('\n' + linea + '\n');
  process.stdout.write('RE-CIFRADO DEL NUMERO DEL REPRESENTANTE LEGAL (8B / H23)\n');
  process.stdout.write(`Actor:  ${opts.actor}\n`);
  process.stdout.write(`Motivo: ${opts.motivo}\n`);
  process.stdout.write(linea + '\n\n');

  if (conProblema.length > 0) {
    process.stdout.write('FILAS QUE NO SE PUEDEN LEER (no se tocan)\n');
    for (const c of conProblema) {
      process.stdout.write(`  ${c.fila.id_solicitud} (id=${c.fila.id}): ${c.problema}\n`);
    }
    process.stdout.write('\n');
  }

  if (aRecifrar.length === 0) {
    process.stdout.write('No hay filas con el numero en claro. Nada que hacer.\n');
    return 0;
  }

  process.stdout.write(`Filas a re-cifrar: ${aRecifrar.length}\n`);
  process.stdout.write('(solo se muestra el final del numero; el numero no se imprime)\n\n');

  let hechas = 0;
  let fallidas = 0;

  for (const c of aRecifrar) {
    const prep = preparar(c.fila, c.snap);
    // D-18: "no se pudo leer" y "no había nada" no son lo mismo. Antes, un
    // fallo de descifrado salía como `****` y se confundía con un número
    // vacío en la traza: un incidente de llave quedaba registrado como si
    // fuera un dato que no existe.
    const est = representanteService.estadoEnmascarado(c.snap, c.fila.id_empresa);
    const masked = est.estado === 'dato'
      ? est.valor
      : (est.estado === 'error' ? '(no se pudo leer)' : '(sin dato)');
    if (!prep.ok) {
      fallidas++;
      process.stdout.write(`  ${c.fila.id_solicitud}: OMITIDA - ${prep.error}\n`);
      continue;
    }
    if (!opts.ejecutar) {
      process.stdout.write(`  ${c.fila.id_solicitud} (${masked}): se re-cifraria\n`);
      continue;
    }
    try {
      // Fila + evento en una transacción: o queda las dos cosas, o no queda
      // ninguna. Un re-cifrado sin su traza sería un cambio invisible.
      const aplicar = db.transaction(() => {
        db.prepare(
          'UPDATE gh_firmas_electronicas SET representante_legal_snapshot = ? WHERE id = ?'
        ).run(prep.json, c.fila.id);
        // Traza: qué se toco, quien lo toco y por que.
        signRequestService.registerEvent(
          c.fila.id,
          'REPRESENTANTE_RECIFRADO',
          { actor: opts.actor, motivo: opts.motivo },
          opts.actor,
          null,
          'scripts/recifrar-representante.js'
        );
      });
      aplicar();
      hechas++;
      process.stdout.write(`  ${c.fila.id_solicitud} (${masked}): re-cifrada\n`);
    } catch (e) {
      fallidas++;
      process.stdout.write(`  ${c.fila.id_solicitud}: ERROR - ${e.message}\n`);
    }
  }

  process.stdout.write('\n' + linea + '\n');
  if (!opts.ejecutar) {
    process.stdout.write('SIMULACION: no se escribio nada. Con --ejecutar se aplica.\n');
  } else {
    process.stdout.write(`Re-cifradas: ${hechas} · omitidas con error: ${fallidas}\n`);
  }
  process.stdout.write(linea + '\n');

  return fallidas > 0 ? 3 : 0;
}

if (require.main === module) {
  process.exit(main());
}

module.exports = {
  main,
  parseArgs,
  filasEnClaro,
  preparar,
};
