#!/usr/bin/env node
/**
 * scripts/limpiar-rastro-prueba.js
 *
 * Quita el rastro de una PUBLICACIÓN DE PRUEBA: las filas de firma, sus
 * eventos, sus archivos, el consentimiento y la versión del Acuerdo que se
 * publicaron en un ambiente de pruebas, para que el texto legal pueda
 * publicarse como la versión vigente.
 *
 * POR QUÉ HAY UN SCRIPT Y POR QUÉ ES DISTINTO DE LA 5B
 * -----------------------------------------------------
 * La supresión de datos (el 8.6/10.6) tiene su propia máquina: la ventana de
 * purga, el lote, el plazo vencido y el hold legal. Esa máquina responde a
 * "esta firma venció y hay que suprimirla". Este script responde a otra
 * pregunta: "esto nunca fue una firma de verdad, era una prueba y hay que
 * quitarla de en medio".
 *
 * La diferencia no es de estilo, es de GOBIERNO:
 *
 *   - La 5B solo se abre con un plazo de conservación vencido. Aquí no hay
 *     plazo: no hay nada que haya vencido.
 *   - La 5B deja la PRUEBA DE LA ACEPTACIÓN (el 12.7). Aquí el consentimiento
 *     también es de prueba, y además apunta a una versión del Acuerdo que va
 *     a dejar de existir: dejarlo sería dejar una referencia rota.
 *   - La 5B responde "no disponible por VENCIMIENTO" (410). Aquí la respuesta
 *     honesta es "no disponible" (404): esos enlaces nunca fueron de nadie.
 *     Por eso este script NO escribe lápida.
 *
 * LO QUE HACE, EN ORDEN
 * ---------------------
 *   1. Verifica que lo que va a tocar es realmente de prueba (fechas y
 *      huellas). Si algo no cuadra, no toca nada.
 *   2. Simula (dry-run) y dice exactamente qué filas y archivos tocaría.
 *   3. Con `--ejecutar`: borra los eventos de auditoría de esas firmas
 *      (sacando y reponiendo el trigger append-only de la migración 020, que
 *      es la vía que esa misma migración documenta), borra las firmas, sus
 *      sesiones, sus archivos, los consentimientos y la versión de Acuerdo
 *      de prueba.
 *   4. Deja el RECIBO en las tablas append-only: una fila en el log de
 *      purgas por cada operación y una fila por firma en el registro.
 *   5. Repone el trigger y verifica que la base quedó íntegra.
 *
 * LO QUE NUNCA HACE
 * -----------------
 *   - No borra nada sin `--actor` y `--motivo`.
 *   - No borra nada sin `--ejecutar`.
 *   - No borra el texto legal: si la versión que le pidas coincide con la
 *     huella sellada en `scripts/fixtures/acuerdo-ARCHIVO.json`, se niega.
 *   - No toca filas que sean más nuevas que `--hasta`.
 *   - No borra la versión del Acuerdo si hay alguna firma más nueva que la
 *     que se va a borrar: esa firma necesita esa versión.
 *
 * USO
 * ---
 *   node scripts/limpiar-rastro-prueba.js --actor="Nombre" --motivo="Por Qué" \
 *        --hasta=2026-10-18
 *   node scripts/limpiar-rastro-prueba.js --actor="Nombre" --motivo="Por Qué" \
 *        --hasta=2026-10-18 --version=v1.0 --ejecutar
 *
 *   node scripts/limpiar-rastro-prueba.js --actor="Nombre" --motivo="Por Qué" \
 *        --hasta=2026-10-21 --solo-firmas --ejecutar
 *
 * EL MODO `--solo-firmas` (21-oct-2026)
 * --------------------------------------
 * El modo normal borra una PUBLICACIÓN DE PRUEBA COMPLETA: sus firmas y la
 * versión del Acuerdo de prueba, para que el texto legal pueda publicarse
 * después como la versión vigente. Ese modo ya no sirve para limpiar filas de
 * prueba DESPUÉS de que el texto legal está publicado y sellado: la versión
 * vigente ES el legal, y el candado (que está para que este script nunca
 * borre el texto legal) se niega a borrarla.
 *
 * `--solo-firmas` es la respuesta: borra SOLO las filas de prueba (firmas,
 * eventos, sesiones, lotes, tokens y archivos) y NO toca NINGUNA versión del
 * Acuerdo. El candado del texto legal queda intacto porque en este modo no
 * se borra ninguna versión, y la verificación final comprueba que la versión
 * vigente SIGUE ahí.
 *
 * En este modo los consentimientos NO se borran: no cuelgan de una firma
 * (son la prueba de aceptación del 12.7, con su propia vida) y borrarlos
 * solo por estar en la ventana de tiempo sería borrarlos a ciegas. Si hay
 * consentimientos en el rango, el plan los lista y los deja.
 *
 * Exit codes:
 *   0  operación exitosa (incluida la simulación)
 *   2  argumentos inválidos
 *   3  error de base de datos
 *   4  se negaron las verificaciones (no se tocó nada)
 */
'use strict';

const fs = require('fs');
const path = require('path');

const db = require('../src/db/connection');

const MANIFIESTO = path.resolve(__dirname, 'fixtures', 'acuerdo-ARCHIVO.json');
const MIGRACION_020 = path.resolve(__dirname, '..', 'src', 'db', 'schema', '020_eventos_append_only.sql');
const TRIGGERS = ['trg_firma_eventos_no_update', 'trg_firma_eventos_no_delete'];

const CATEGORIAS = ['PRUEBA_OPERATIVA'];

// ----------------------------------------------------------------------
// Argumentos
// ----------------------------------------------------------------------
function parseArgs(argv) {
  const opts = {
    actor: null, motivo: null, hasta: null, version: 'v1.0', ejecutar: false,
    soloFirmas: false,
  };
  for (const arg of argv) {
    if (arg === '--ejecutar') {
      opts.ejecutar = true;
    } else if (arg === '--solo-firmas') {
      opts.soloFirmas = true;
    } else if (arg.startsWith('--actor=')) {
      opts.actor = arg.slice('--actor='.length).trim();
    } else if (arg.startsWith('--motivo=')) {
      opts.motivo = arg.slice('--motivo='.length).trim();
    } else if (arg.startsWith('--hasta=')) {
      opts.hasta = arg.slice('--hasta='.length).trim();
    } else if (arg.startsWith('--version=')) {
      opts.version = arg.slice('--version='.length).trim();
    } else {
      throw new Error(`Argumento desconocido: ${arg}`);
    }
  }
  if (!opts.actor) throw new Error('Falta --actor (quién hace el cambio)');
  if (!opts.motivo) throw new Error('Falta --motivo (por qué se hace el cambio)');
  if (!opts.hasta) throw new Error('Falta --hasta (fecha YYYY-MM-DD: nada más nuevo se toca)');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(opts.hasta)) {
    throw new Error('--hasta tiene que ser una fecha YYYY-MM-DD');
  }
  return opts;
}

// ----------------------------------------------------------------------
// Verificaciones
// ----------------------------------------------------------------------
function tablaExiste(nombre) {
  const row = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
  ).get(nombre);
  return !!row;
}

/**
 * La huella sellada del texto legal, si está en el manifiesto.
 * @returns {string|null}
 */
function huellaSellada(version) {
  try {
    const manifiesto = JSON.parse(fs.readFileSync(MANIFIESTO, 'utf8'));
    const entrada = manifiesto && manifiesto.versiones && manifiesto.versiones[version];
    return entrada ? entrada.sha256 : null;
  } catch (_) {
    return null;
  }
}

/**
 * Las statements de los triggers del 020, tal cual están en el archivo.
 * Se leen del archivo de migración para que no puedan desviarse de la fuente.
 * @returns {string[]}
 */
function statementsDeTriggers() {
  const sql = fs.readFileSync(MIGRACION_020, 'utf8');
  const out = [];
  for (const nombre of TRIGGERS) {
    const re = new RegExp('CREATE TRIGGER IF NOT EXISTS ' + nombre + '[\\s\\S]*?END;');
    const m = sql.match(re);
    if (!m) throw new Error(`No se encontró el trigger ${nombre} en ${MIGRACION_020}`);
    out.push(m[0]);
  }
  return out;
}

// ----------------------------------------------------------------------
// Plan
// ----------------------------------------------------------------------
function armarPlan(opts) {
  const corte = opts.hasta + 'T23:59:59.999Z';

  const firmas = db.prepare(`
    SELECT id, id_solicitud, id_empresa, estado, fecha_creacion,
           agreement_version, agreement_hash, hold_legal,
           pdf_original_path, pdf_firmado_path, constancia_path
      FROM gh_firmas_electronicas
     ORDER BY id
  `).all();

  const enRango = firmas.filter(f => String(f.fecha_creacion) <= corte);
  const fueraDeRango = firmas.filter(f => String(f.fecha_creacion) > corte);

  const consentimientos = db.prepare(`
    SELECT id, id_trabajador, id_empresa, version_acuerdo,
           fecha_aceptacion, hash_texto_acuerdo
      FROM gh_consentimientos_firma
     ORDER BY id
  `).all();

  const consentimientosEnRango = consentimientos
    .filter(c => String(c.fecha_aceptacion) <= corte);
  const consentimientosFuera = consentimientos
    .filter(c => String(c.fecha_aceptacion) > corte);

  const version = db.prepare(`
    SELECT id, version, texto_hash, activa, fecha_creacion, length(texto) AS chars
      FROM gh_firma_acuerdo_versiones WHERE version = ?
  `).get(opts.version);

  // En el modo --solo-firmas NO se toca ninguna versión del Acuerdo: el
  // texto legal ya está publicado y sellado, y este script no borra texto
  // legal. Por eso `version` queda en null aunque la fila exista.
  const versionABorrar = opts.soloFirmas ? null : version;

  // Los consentimientos tampoco se borran en ese modo: no cuelgan de una
  // firma, y se listan para que el operador vea que se quedan.
  const consentimientosABorrar = opts.soloFirmas ? [] : consentimientosEnRango;

  // Archivos que acompañarían a las filas a borrar.
  const archivos = [];
  for (const f of enRango) {
    for (const col of ['pdf_original_path', 'pdf_firmado_path', 'constancia_path']) {
      if (f[col]) archivos.push({ firma_id: f.id, campo: col, ruta: f[col] });
    }
  }

  return {
    corte,
    firmas: enRango,
    firmasFueraDeRango: fueraDeRango,
    consentimientos: consentimientosABorrar,
    consentimientosSeQuedan: opts.soloFirmas ? consentimientosEnRango : [],
    consentimientosFuera,
    version: versionABorrar,
    versionSeQueda: opts.soloFirmas ? version : null,
    archivos,
  };
}

/**
 * Las razones por las que NO se puede seguir. Cada una dice qué la causó.
 * @returns {string[]}
 */
function verificar(plan, opts) {
  const problemas = [];

  if (!opts.soloFirmas && !plan.version) {
    problemas.push(`No existe la versión ${opts.version} en la base.`);
  }

  // 0. En el modo --solo-firmas no se borra NINGUNA versión. Si el plan
  //    trae una, es un error de este script: se para todo.
  if (opts.soloFirmas && plan.version) {
    problemas.push(
      'El modo --solo-firmas no puede borrar una versión del Acuerdo. '
      + 'Algo está mal en el plan: no se toca nada.');
  }

  // 1. La versión que se va a borrar NO puede ser el texto legal sellado.
  const sellada = huellaSellada(opts.version);
  if (!opts.soloFirmas && sellada && plan.version && plan.version.texto_hash === sellada) {
    problemas.push(
      `La versión ${opts.version} de la base tiene la huella del texto legal sellado `
      + `(${sellada.slice(0, 12)}). Este script NUNCA borra el texto legal. `
      + 'Si lo que se quiere es limpiar solo las filas de prueba, use --solo-firmas.');
  }

  // 2. Nada más nuevo que el corte se toca.
  if (plan.firmasFueraDeRango.length) {
    problemas.push(
      `Hay ${plan.firmasFueraDeRango.length} firma(s) más nueva(s) que ${opts.hasta}. `
      + 'No se tocan, pero la limpieza no es de un ambiente de pruebas completo.');
  }
  if (plan.consentimientosFuera.length) {
    problemas.push(
      `Hay ${plan.consentimientosFuera.length} consentimiento(s) más nuevo(s) que ${opts.hasta}. `
      + 'No se tocan.');
  }

  // 3. Ninguna firma que quede viva puede depender de la versión que se borra.
  //    (En --solo-firmas no se borra ninguna versión, así que no aplica.)
  const idsABorrar = new Set(plan.firmas.map(f => f.id));
  const vivas = plan.firmasFueraDeRango.filter(f => f.agreement_version === opts.version);
  if (!opts.soloFirmas && vivas.length) {
    problemas.push(
      `Hay ${vivas.length} firma(s) que se quedan y que apuntan a la versión `
      + `${opts.version}. Borrarla las dejaría rotas.`);
  }

  // 4. Hold legal: si una de las filas tiene hold, no se toca.
  const conHold = plan.firmas.filter(f => Number(f.hold_legal) === 1);
  if (conHold.length) {
    problemas.push(
      `${conHold.length} firma(s) tienen deber legal de conservación (hold). `
      + 'Un hold impide destruir la prueba de una firma en discusión.');
  }

  // 5. Coherencia: los consentimientos que se borran deben apuntar a la
  //    versión que se borra, o no tocarlos.
  //    (En --solo-firmas no se borra ningún consentimiento.)
  const consentimientosDeOtraVersion = plan.consentimientos
    .filter(c => c.version_acuerdo !== opts.version);
  if (consentimientosDeOtraVersion.length) {
    problemas.push(
      `${consentimientosDeOtraVersion.length} consentimiento(s) del rango apuntan a `
      + `otra versión del Acuerdo. Se dejan como están.`);
  }

  void idsABorrar;
  return problemas;
}

// ----------------------------------------------------------------------
// Impresión del plan
// ----------------------------------------------------------------------
function imprimirPlan(plan, opts) {
  console.log('\n=== LIMPIEZA DEL RASTRO DE PRUEBA ===');
  console.log(`actor:  ${opts.actor}`);
  console.log(`motivo: ${opts.motivo}`);
  console.log(`corte:  ${opts.hasta} (nada más nuevo se toca)`);
  console.log(`modo:   ${opts.ejecutar ? 'EJECUCIÓN' : 'SIMULACIÓN (nada se escribe)'}`);
  console.log(`alcance: ${opts.soloFirmas
    ? 'SOLO LAS FILAS DE PRUEBA (no se toca ninguna versión del Acuerdo)'
    : 'filas de prueba + versión del Acuerdo ' + opts.version}`);

  console.log('\n--- Firmas a eliminar ---');
  if (!plan.firmas.length) {
    console.log('  (ninguna)');
  }
  for (const f of plan.firmas) {
    console.log(`  id=${f.id} ${f.id_solicitud} estado=${f.estado} `
      + `empresa=${f.id_empresa} creada=${f.fecha_creacion} `
      + `acuerdo=${f.agreement_version} hash=${String(f.agreement_hash).slice(0, 12)}`);
  }

  console.log('\n--- Consentimientos a eliminar ---');
  if (!plan.consentimientos.length) {
    console.log('  (ninguno)');
  }
  for (const c of plan.consentimientos) {
    console.log(`  id=${c.id} empresa=${c.id_empresa} `
      + `acuerdo=${c.version_acuerdo} aceptado=${c.fecha_aceptacion}`);
  }
  if (plan.consentimientosSeQuedan && plan.consentimientosSeQuedan.length) {
    console.log('  (se quedan, este modo no borra consentimientos):');
    for (const c of plan.consentimientosSeQuedan) {
      console.log(`    id=${c.id} empresa=${c.id_empresa} `
        + `acuerdo=${c.version_acuerdo} aceptado=${c.fecha_aceptacion}`);
    }
  }

  console.log('\n--- Versión del Acuerdo a eliminar ---');
  if (opts.soloFirmas) {
    if (plan.versionSeQueda) {
      console.log(`  NO SE TOCA (modo --solo-firmas): ${plan.versionSeQueda.version} `
        + `hash=${String(plan.versionSeQueda.texto_hash).slice(0, 12)} `
        + `activa=${plan.versionSeQueda.activa}`);
    } else {
      console.log('  NO SE TOCA (modo --solo-firmas)');
    }
  } else if (plan.version) {
    console.log(`  ${plan.version.version} hash=${String(plan.version.texto_hash).slice(0, 12)} `
      + `activa=${plan.version.activa} chars=${plan.version.chars} `
      + `creada=${plan.version.fecha_creacion}`);
  } else {
    console.log('  (no existe)');
  }

  console.log('\n--- Archivos a eliminar ---');
  if (!plan.archivos.length) {
    console.log('  (ninguno)');
  }
  for (const a of plan.archivos) {
    console.log(`  firma=${a.firma_id} ${a.campo}: ${a.ruta}`);
  }
}

// ----------------------------------------------------------------------
// Escritura
// ----------------------------------------------------------------------
function eliminarArchivos(archivos) {
  let borrados = 0;
  for (const a of archivos) {
    try {
      if (fs.existsSync(a.ruta)) {
        fs.unlinkSync(a.ruta);
        borrados++;
      }
    } catch (e) {
      console.warn(`  No se pudo borrar ${a.ruta}: ${e.message}`);
    }
  }
  return borrados;
}

function aplicar(plan, opts) {
  const ahora = new Date().toISOString();

  // 1. El trigger append-only de los eventos. La migración 020 dice que la
  //    depuración de la base exige `DROP TRIGGER` explícito: es intencional.
  const triggers = statementsDeTriggers();
  console.log('\n--- Sacando el trigger append-only de los eventos ---');
  for (const nombre of TRIGGERS) {
    db.prepare(`DROP TRIGGER IF EXISTS ${nombre}`).run();
    console.log(`  drop ${nombre}`);
  }

  let eventosBorrados = 0;
  let firmasBorradas = 0;
  let sesionesBorradas = 0;
  let lotesBorrados = 0;
  let consentimientosBorrados = 0;
  let archivosBorrados = 0;
  let tokensBorrados = 0;
  const hayTokens = tablaExiste('gh_firma_tokens');

  try {
    const tx = db.transaction(() => {
      for (const f of plan.firmas) {
        // Los tokens (migración 026) son credenciales: se borran con su
        // firma. La FK los cascada, pero se borran explícitos para que el
        // recibo diga cuantos credenciales se fueron.
        if (hayTokens) {
          const to = db.prepare('DELETE FROM gh_firma_tokens WHERE firma_id = ?').run(f.id);
          tokensBorrados += to.changes;
        }
        const ev = db.prepare('DELETE FROM gh_firma_eventos WHERE firma_id = ?').run(f.id);
        eventosBorrados += ev.changes;
        const se = db.prepare('DELETE FROM gh_firma_sesiones WHERE firma_id = ?').run(f.id);
        sesionesBorradas += se.changes;
        const lo = db.prepare('DELETE FROM gh_firma_purga_lote WHERE firma_id = ?').run(f.id);
        lotesBorrados += lo.changes;
        const fi = db.prepare('DELETE FROM gh_firmas_electronicas WHERE id = ?').run(f.id);
        firmasBorradas += fi.changes;
      }
      for (const c of plan.consentimientos) {
        const rc = db.prepare('DELETE FROM gh_consentimientos_firma WHERE id = ?').run(c.id);
        consentimientosBorrados += rc.changes;
      }
      if (plan.version) {
        db.prepare('DELETE FROM gh_firma_acuerdo_versiones WHERE version = ?').run(opts.version);
      }
    });
    tx();
  } finally {
    // 2. El trigger vuelve, tal cual lo define la migración 020.
    console.log('--- Reponiendo el trigger append-only de los eventos ---');
    for (const sql of triggers) {
      db.exec(sql);
      console.log('  ok ' + sql.match(/CREATE TRIGGER IF NOT EXISTS (\S+)/)[1]);
    }
  }

  // 3. Los archivos quedan fuera de la transacción (son archivos, no filas).
  archivosBorrados = eliminarArchivos(plan.archivos);

  // 4. El recibo: las tablas append-only que registran qué se tocó y por qué.
  db.prepare(`
    INSERT INTO gh_firma_purga_log
      (fecha_hora, evento, actor, motivo, firmas_en_lote, eventos_purgados,
       hold_revisados, hold_bloqueados)
    VALUES (?, 'LIMPIEZA_RASTRO_PRUEBA', ?, ?, ?, ?, ?, 0)
  `).run(ahora, opts.actor, opts.motivo, firmasBorradas, eventosBorrados,
    plan.firmas.length);

  for (const f of plan.firmas) {
    db.prepare(`
      INSERT INTO gh_firma_purga_registro
        (firma_id, id_empresa, purgado_at, actor, motivo, categorias,
         hold_verificado, eventos_purgados)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `).run(f.id, f.id_empresa || 'DESCONOCIDA', ahora, opts.actor, opts.motivo,
      JSON.stringify(CATEGORIAS), eventosBorrados);
  }

  if (opts.soloFirmas) {
    // En este modo NO se retiró ninguna versión: el texto legal vigente
    // (publicado y sellado) queda intacto, y el recibo lo deja dicho.
    db.prepare(`
      INSERT INTO gh_firma_purga_log
        (fecha_hora, evento, actor, motivo, firmas_en_lote, eventos_purgados,
         hold_revisados, hold_bloqueados)
      VALUES (?, 'LIMPIEZA_RASTRO_PRUEBA_SOLO_FIRMAS', ?, ?, ?, ?, ?, 0)
    `).run(ahora, opts.actor,
      `Se retiraron solo las filas de prueba (firmas, eventos, sesiones, lotes, `
      + `tokens y archivos). NO se toco ninguna version del Acuerdo: el texto legal `
      + `vigente sigue publicado. Motivo: ${opts.motivo}`,
      firmasBorradas, eventosBorrados, plan.firmas.length);
  } else {
    db.prepare(`
      INSERT INTO gh_firma_purga_log
        (fecha_hora, evento, actor, motivo, firmas_en_lote, eventos_purgados,
         hold_revisados, hold_bloqueados)
      VALUES (?, 'LIMPIEZA_RASTRO_PRUEBA_ACUERDO', ?, ?, 0, 0, 0, 0)
    `).run(ahora, opts.actor,
      `Se retiro la version ${opts.version} de prueba para publicar el texto legal `
      + `como ${opts.version}. Motivo: ${opts.motivo}`);
  }

  console.log('\n=== RESULTADO ===');
  console.log(`  firmas eliminadas:        ${firmasBorradas}`);
  console.log(`  eventos eliminados:       ${eventosBorrados}`);
  console.log(`  sesiones eliminadas:      ${sesionesBorradas}`);
  console.log(`  filas de lote eliminadas: ${lotesBorrados}`);
  console.log(`  tokens eliminados:        ${tokensBorrados}`);
  console.log(`  consentimientos:          ${consentimientosBorrados}`);
  console.log(`  archivos eliminados:      ${archivosBorrados}`);
  console.log(`  version del Acuerdo:     ${opts.soloFirmas
    ? 'NO SE TOCO (modo --solo-firmas)' : 'eliminada (' + opts.version + ')'}`);
  console.log(`  recibo: ${firmasBorradas} fila(s) en gh_firma_purga_registro `
    + `y 2 en gh_firma_purga_log`);

  return {
    firmasBorradas, eventosBorrados, consentimientosBorrados, archivosBorrados,
    tokensBorrados,
  };
}

/**
 * La verificación de que la base quedó como se esperaba.
 */
function verificarDespues(opts) {
  const problemas = [];

  const integridad = db.pragma('integrity_check', { simple: true });
  if (integridad !== 'ok') problemas.push(`integrity_check: ${integridad}`);

  const firmas = db.prepare('SELECT COUNT(*) n FROM gh_firmas_electronicas').get().n;
  const eventos = db.prepare('SELECT COUNT(*) n FROM gh_firma_eventos').get().n;
  const cons = db.prepare('SELECT COUNT(*) n FROM gh_consentimientos_firma').get().n;
  const version = db.prepare(
    'SELECT COUNT(*) n FROM gh_firma_acuerdo_versiones WHERE version = ?'
  ).get(opts.version).n;

  console.log('\n=== VERIFICACIÓN ===');
  console.log(`  integridad:       ${integridad}`);
  console.log(`  firmas:           ${firmas}`);
  console.log(`  eventos:          ${eventos}`);
  console.log(`  consentimientos:  ${cons}`);
  console.log(`  version ${opts.version}: ${version}`);

  // En el modo --solo-firmas el texto legal tiene que SEGUIR ahí. Si la
  // versión vigente desaparecio, esta limpieza rompio el servicio.
  if (opts.soloFirmas) {
    const activa = db.prepare(
      'SELECT COUNT(*) n FROM gh_firma_acuerdo_versiones WHERE activa = 1'
    ).get().n;
    if (version !== 1) {
      problemas.push(
        `La version ${opts.version} ya no esta en la base: en el modo --solo-firmas `
        + 'no se debia borrar ninguna version.');
    }
    if (activa !== 1) {
      problemas.push(
        `Hay ${activa} version(es) activa(s) del Acuerdo: deberia haber exactamente 1.`);
    }
    console.log(`  version activa:   ${activa}`);
  }

  for (const nombre of TRIGGERS) {
    const t = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='trigger' AND name=?"
    ).get(nombre);
    if (!t) problemas.push(`El trigger ${nombre} no quedo repuesto.`);
  }

  if (problemas.length) {
    console.log('\n  PROBLEMAS:');
    for (const p of problemas) console.log('   - ' + p);
    return false;
  }
  console.log('  OK: la base quedo integra y con los triggers repuestos.');
  return true;
}

// ----------------------------------------------------------------------
function main(argv) {
  const opts = parseArgs(argv);

  for (const t of ['gh_firmas_electronicas', 'gh_firma_eventos', 'gh_firma_sesiones',
    'gh_consentimientos_firma', 'gh_firma_acuerdo_versiones', 'gh_firma_purga_log',
    'gh_firma_purga_registro']) {
    if (!tablaExiste(t)) {
      console.error(`Falta la tabla ${t}. Este script necesita el esquema con las `
        + 'migraciones aplicadas.');
      return 3;
    }
  }

  const plan = armarPlan(opts);
  imprimirPlan(plan, opts);

  const problemas = verificar(plan, opts);
  if (problemas.length) {
    console.log('\n=== NO SE TOCA NADA ===');
    for (const p of problemas) console.log('  - ' + p);
    return 4;
  }

  if (!opts.ejecutar) {
    console.log('\nSimulacion. Con --ejecutar se aplica.');
    return 0;
  }

  const r = aplicar(plan, opts);
  const ok = verificarDespues(opts);
  if (!ok) return 3;

  if (opts.soloFirmas) {
    console.log('\nListo. Solo se retiraron las filas de prueba.');
    console.log(`  (firmas: ${r.firmasBorradas}, eventos: ${r.eventosBorrados}, `
      + `tokens: ${r.tokensBorrados}, archivos: ${r.archivosBorrados})`);
    console.log(`  La version ${opts.version} del Acuerdo sigue publicada y sellada.`);
    return 0;
  }
  console.log(`\nListo. Ahora se puede publicar el texto legal como ${opts.version}.`);
  console.log(`  (firmas: ${r.firmasBorradas}, eventos: ${r.eventosBorrados}, `
    + `consentimientos: ${r.consentimientosBorrados}, archivos: ${r.archivosBorrados})`);
  return 0;
}

if (require.main === module) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (e) {
    if (e && /Falta --|Argumento desconocido|--hasta/.test(String(e.message))) {
      console.error(e.message);
      console.error('');
      console.error('Uso: node scripts/limpiar-rastro-prueba.js --actor="Nombre" '
        + '--motivo="Por qué" --hasta=YYYY-MM-DD [--version=v1.0] [--solo-firmas] '
        + '[--ejecutar]');
      process.exit(2);
    }
    console.error('Error: ' + (e && e.stack ? e.stack : e));
    process.exit(3);
  }
}

module.exports = { main, parseArgs, armarPlan, verificar, statementsDeTriggers };
