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
 *   node scripts/limpiar-rastro-prueba.js --actor="Nombre" --motivo="Por Qué" \
 *        --hasta=2026-10-24 --solo-firmas --forzar-hold --ejecutar
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
 * EL MODO `--forzar-hold` (26-oct-2026)
 * -------------------------------------
 * En produccion, la fila que dejo el e2e (id=12, SIGN-2026-427494) quedo con
 * hold: la ficha de la Empresa tiene `conservacion_por_deber_legal = 1`, y esa
 * bandera le levanta el hold AUTOMATICO a toda firma de esa Empresa. El
 * script se negaba a borrar la fila y el rastro de prueba se quedaba en
 * produccion para siempre.
 *
 * `--forzar-hold` es la válvula para ese caso, y SOLO para ese caso. Un hold
 * es un deber legal de conservación: ordinarily no se toca. Se puede forzar
 * únicamente si la fila cumple las DOS condiciones:
 *
 *   1. QUE NUNCA HUBO UN ACTO DE FIRMA. La fila no puede estar firmada
 *      (SIGNED / DUAL_FIRMADO), ni rechazada, revocada o cancelada, ni tener
 *      documento firmado, hash de evidencia, constancia o PDF firmado. Es decir:
 *      no hay ni un solo rastro de que alguien firmó. Una firma que SÍ
 *      ocurrió conserva su hold siempre: eso no se fuerza nunca.
 *   2. QUE EL HOLD ES EL AUTOMATICO. El motivo tiene que ser el del sistema
 *      (`deber_legal_*`), el actor tiene que ser `sistema`, y no puede haber
 *      un hold vigente en `gh_firma_holds` declarado por una persona. Un hold
 *      que alguien declaró a mano es un acto de gobierno: no se toca.
 *
 * Si una sola fila del rango no cumple las dos, el script NO borra nada y
 * sale con codigo 4: o se limpia entero, o no se limpia. No hay limpieza a
 * medias.
 *
 * El forzamiento queda escrito en el recibo append-only (`gh_firma_purga_log`
 * y `gh_firma_purga_registro`), con quien lo hizo y por que. El hold no se
 * "libera" antes de borrar: la fila desaparece dentro de la misma transaccion
 * que la borra, asi que no queda en ningun momento una firma real sin su
 * proteccion.
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

// Los estados en los que YA PASÓ UN ACTO de una persona: firmó, rechazó,
// revocó o canceló. Una fila en uno de estos estados conservó un hecho que
// ocurrió: su hold no se puede forzar nunca.
const ESTADOS_CON_ACTO = ['SIGNED', 'DUAL_FIRMADO', 'REJECTED', 'REVOKED', 'CANCELLED'];

// ----------------------------------------------------------------------
// Argumentos
// ----------------------------------------------------------------------
function parseArgs(argv) {
  const opts = {
    actor: null, motivo: null, hasta: null, version: 'v1.0', ejecutar: false,
    soloFirmas: false,
    forzarHold: false,
  };
  for (const arg of argv) {
    if (arg === '--ejecutar') {
      opts.ejecutar = true;
    } else if (arg === '--solo-firmas') {
      opts.soloFirmas = true;
    } else if (arg === '--forzar-hold') {
      opts.forzarHold = true;
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
// El hold: la fila que se puede forzar y la que no
// ----------------------------------------------------------------------
/**
 * Decide si el hold de una fila se puede forzar con `--forzar-hold`.
 *
 * Un hold es un deber legal de conservacion: por defecto NO se toca. La
 * unica excepcion que justifica el forzamiento es una fila de PRUEBA que
 * nunca tuvo un acto de firma, con el hold automatico de la ficha de la
 * Empresa. Cualquier otra cosa se niega, y se dice por que.
 *
 * @param {object} f - la fila de gh_firmas_electronicas
 * @param {boolean} hayTablaHolds - si existe gh_firma_holds en la base
 * @returns {{hold: boolean, forzable: boolean, razon: string|null}}
 */
function evaluarHold(f, hayTablaHolds) {
  if (Number(f.hold_legal) !== 1) {
    return { hold: false, forzable: false, razon: null };
  }

  // 1. Que nunca haya habido un acto de una persona.
  if (ESTADOS_CON_ACTO.includes(String(f.estado))) {
    return {
      hold: true,
      forzable: false,
      razon: `la fila esta en estado ${f.estado}: ya hubo un acto (firma, rechazo, `
        + 'revocacion o cancelacion). Un hold sobre una firma que ocurrio NO se fuerza.',
    };
  }
  if (f.document_hash_firmado) {
    return { hold: true, forzable: false, razon: 'la fila tiene documento firmado.' };
  }
  if (f.evidence_hash) {
    return { hold: true, forzable: false, razon: 'la fila tiene hash de evidencia.' };
  }
  if (f.constancia_path) {
    return { hold: true, forzable: false, razon: 'la fila tiene constancia emitida.' };
  }
  if (f.pdf_firmado_path) {
    return { hold: true, forzable: false, razon: 'la fila tiene PDF firmado.' };
  }

  // 2. Que el hold sea el AUTOMATICO (el que levanta la bandera de la ficha
  //    de la Empresa o la regla del sistema), no uno declarado a mano.
  const motivo = f.motivo_hold ? String(f.motivo_hold) : '';
  if (!/^deber_legal_/.test(motivo)) {
    return {
      hold: true,
      forzable: false,
      razon: `el hold no es el automatico (motivo: ${motivo || 'sin motivo'}). `
        + 'Un hold con otro motivo es un acto de gobierno y no se fuerza.',
    };
  }
  if (f.hold_actor && String(f.hold_actor) !== 'sistema') {
    return {
      hold: true,
      forzable: false,
      razon: `el hold lo declaro ${f.hold_actor}, no el sistema. No se fuerza.`,
    };
  }
  if (hayTablaHolds) {
    const humano = db.prepare(
      "SELECT actor FROM gh_firma_holds WHERE firma_id = ? AND activo = 1 "
      + "AND COALESCE(actor, '') <> 'sistema' ORDER BY id DESC LIMIT 1"
    ).get(f.id);
    if (humano) {
      return {
        hold: true,
        forzable: false,
        razon: `hay un hold vigente declarado por ${humano.actor} sobre esta firma. `
          + 'No se fuerza.',
      };
    }
  }

  return {
    hold: true,
    forzable: true,
    razon: 'nunca se firmo y el hold es el automatico de la ficha de la Empresa',
  };
}

// ----------------------------------------------------------------------
// Plan
// ----------------------------------------------------------------------
function armarPlan(opts) {
  const corte = opts.hasta + 'T23:59:59.999Z';

  const firmas = db.prepare(`
    SELECT id, id_solicitud, id_empresa, estado, fecha_creacion,
           agreement_version, agreement_hash, hold_legal,
           motivo_hold, hold_actor,
           document_hash_firmado, evidence_hash,
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

  // El hold de cada fila del rango. Sin `--forzar-hold` NINGUN hold se
  // fuerza: la fila queda marcada y `verificar` se niega. Con `--forzar-hold`,
  // solo se fuerzan las que cumplen las dos reglas de `evaluarHold`.
  const hayTablaHolds = tablaExiste('gh_firma_holds');
  for (const f of enRango) {
    const ev = evaluarHold(f, hayTablaHolds);
    f.hold_evaluado = ev.hold;
    f.hold_forzado = ev.hold && opts.forzarHold === true && ev.forzable;
    f.hold_razon = ev.razon;
  }

  const holdsForzados = enRango.filter(f => f.hold_forzado);
  const holdsBloqueados = enRango.filter(f => f.hold_evaluado && !f.hold_forzado);

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
    holdsForzados,
    holdsBloqueados,
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

  // 4. Hold legal: si una de las filas tiene hold, no se toca. La unica
  //    excepcion es `--forzar-hold`, y solo para filas que `evaluarHold`
  //    declaro forzables (nunca firmadas + hold automatico).
  const conHold = plan.firmas.filter(f => Number(f.hold_legal) === 1);
  const forzados = conHold.filter(f => f.hold_forzado === true);
  const bloqueados = conHold.filter(f => f.hold_forzado !== true);
  if (bloqueados.length) {
    const razones = bloqueados
      .map(f => `id=${f.id} (${f.hold_razon || 'hold sin evaluacion'})`)
      .join('; ');
    problemas.push(
      `${bloqueados.length} firma(s) tienen deber legal de conservación (hold) `
      + `que NO se puede forzar: ${razones}. `
      + 'Un hold impide destruir la prueba de una firma en discusión.');
    if (!opts.forzarHold) {
      problemas.push(
        'Si la fila nunca se firmo, el operador puede repetir el comando con '
        + '--forzar-hold: el forzamiento queda escrito en el recibo con quien '
        + 'lo hizo y por que.');
    }
  }
  void forzados;

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
  if (opts.forzarHold) {
    console.log('hold:   se evalua el forzado (solo filas que nunca se firmaron '
      + 'con el hold automatico)');
  }

  console.log('\n--- Firmas a eliminar ---');
  if (!plan.firmas.length) {
    console.log('  (ninguna)');
  }
  for (const f of plan.firmas) {
    const marca = f.hold_forzado ? ' [HOLD FORZADO]' : '';
    console.log(`  id=${f.id} ${f.id_solicitud} estado=${f.estado} `
      + `empresa=${f.id_empresa} creada=${f.fecha_creacion} `
      + `acuerdo=${f.agreement_version} hash=${String(f.agreement_hash).slice(0, 12)}${marca}`);
  }

  console.log('\n--- Hold legal (deber de conservacion) ---');
  const conHold = plan.firmas.filter(f => f.hold_evaluado || Number(f.hold_legal) === 1);
  if (!conHold.length) {
    console.log('  (ninguna fila del rango tiene hold)');
  }
  for (const f of conHold) {
    if (f.hold_forzado) {
      console.log(`  id=${f.id} ${f.id_solicitud}: HOLD FORZADO — ${f.hold_razon}`);
    } else {
      console.log(`  id=${f.id} ${f.id_solicitud}: hold vigente — `
        + `${f.hold_razon || 'no se puede forzar'}`);
    }
  }
  if (opts.forzarHold && !(plan.holdsForzados || []).length && conHold.length) {
    console.log('  (--forzar-hold no alcanza: ninguna fila cumple las dos reglas)');
  }
  if (opts.forzarHold && !conHold.length) {
    console.log('  (--forzar-hold sin efecto: no hay hold que forzar)');
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
  let holdsBorrados = 0;
  let papelBorrados = 0;
  const hayTokens = tablaExiste('gh_firma_tokens');
  const hayHolds = tablaExiste('gh_firma_holds');
  const hayPapel = tablaExiste('gh_firma_firmas_papel');

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
        // El historial de holds (migración 023) CUELGA de la firma: si se
        // borra la firma y el hold se queda, queda un rastro huérfano de una
        // fila que ya no existe. También es parte del rastro de la prueba.
        if (hayHolds) {
          const ho = db.prepare('DELETE FROM gh_firma_holds WHERE firma_id = ?').run(f.id);
          holdsBorrados += ho.changes;
        }
        // Las firmas en papel (migración 032, el 9A) cuelgan de la firma.
        if (hayPapel) {
          const pa = db.prepare('DELETE FROM gh_firma_firmas_papel WHERE firma_id = ?').run(f.id);
          papelBorrados += pa.changes;
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
  //
  //    El conteo del hold va con numeros reales: cuantas filas del lote se
  //    revisaron con hold y cuantas quedaron afuera. Con `--forzar-hold` el
  //    forzamiento queda escrito en el motivo, con quien lo hizo y por que:
  //    es la prueba de que el hold se comprobo y se decidio, no que se paso
  //    por alto.
  const conHold = plan.firmas.filter(f => f.hold_evaluado || Number(f.hold_legal) === 1);
  const forzados = conHold.filter(f => f.hold_forzado === true);
  const bloqueados = conHold.filter(f => f.hold_forzado !== true);
  const motivoLimpieza = forzados.length
    ? `${opts.motivo} | HOLD FORZADO en ${forzados.length} fila(s) `
      + `(${forzados.map(f => 'id=' + f.id).join(', ')}): `
      + `${forzados.map(f => f.hold_razon).join('; ')}`
    : opts.motivo;

  db.prepare(`
    INSERT INTO gh_firma_purga_log
      (fecha_hora, evento, actor, motivo, firmas_en_lote, eventos_purgados,
       hold_revisados, hold_bloqueados)
    VALUES (?, 'LIMPIEZA_RASTRO_PRUEBA', ?, ?, ?, ?, ?, ?)
  `).run(ahora, opts.actor, motivoLimpieza, firmasBorradas, eventosBorrados,
    conHold.length, bloqueados.length);

  for (const f of plan.firmas) {
    const motivoFila = f.hold_forzado
      ? `${motivoLimpieza} | Esta fila tenia hold y se forzo: ${f.hold_razon}`
      : opts.motivo;
    db.prepare(`
      INSERT INTO gh_firma_purga_registro
        (firma_id, id_empresa, purgado_at, actor, motivo, categorias,
         hold_verificado, eventos_purgados)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `).run(f.id, f.id_empresa || 'DESCONOCIDA', ahora, opts.actor, motivoFila,
      JSON.stringify(CATEGORIAS), eventosBorrados);
  }

  if (opts.soloFirmas) {
    // En este modo NO se retiró ninguna versión: el texto legal vigente
    // (publicado y sellado) queda intacto, y el recibo lo deja dicho.
    db.prepare(`
      INSERT INTO gh_firma_purga_log
        (fecha_hora, evento, actor, motivo, firmas_en_lote, eventos_purgados,
         hold_revisados, hold_bloqueados)
      VALUES (?, 'LIMPIEZA_RASTRO_PRUEBA_SOLO_FIRMAS', ?, ?, ?, ?, ?, ?)
    `).run(ahora, opts.actor,
      `Se retiraron solo las filas de prueba (firmas, eventos, sesiones, lotes, `
      + `tokens, holds y archivos). NO se toco ninguna version del Acuerdo: el `
      + `texto legal vigente sigue publicado. Motivo: ${motivoLimpieza}`,
      firmasBorradas, eventosBorrados, conHold.length, bloqueados.length);
  } else {
    db.prepare(`
      INSERT INTO gh_firma_purga_log
        (fecha_hora, evento, actor, motivo, firmas_en_lote, eventos_purgados,
         hold_revisados, hold_bloqueados)
      VALUES (?, 'LIMPIEZA_RASTRO_PRUEBA_ACUERDO', ?, ?, 0, 0, ?, ?)
    `).run(ahora, opts.actor,
      `Se retiro la version ${opts.version} de prueba para publicar el texto legal `
      + `como ${opts.version}. Motivo: ${motivoLimpieza}`,
      conHold.length, bloqueados.length);
  }

  console.log('\n=== RESULTADO ===');
  console.log(`  firmas eliminadas:        ${firmasBorradas}`);
  console.log(`  eventos eliminados:       ${eventosBorrados}`);
  console.log(`  sesiones eliminadas:      ${sesionesBorradas}`);
  console.log(`  filas de lote eliminadas: ${lotesBorrados}`);
  console.log(`  tokens eliminados:        ${tokensBorrados}`);
  console.log(`  holds eliminados:         ${holdsBorrados}`);
  console.log(`  firmas en papel borradas: ${papelBorrados}`);
  console.log(`  consentimientos:          ${consentimientosBorrados}`);
  console.log(`  archivos eliminados:      ${archivosBorrados}`);
  console.log(`  hold revisados:           ${conHold.length}`);
  console.log(`  hold forzados:            ${forzados.length}`
    + (forzados.length ? ` (${forzados.map(f => 'id=' + f.id).join(', ')})` : ''));
  console.log(`  version del Acuerdo:     ${opts.soloFirmas
    ? 'NO SE TOCO (modo --solo-firmas)' : 'eliminada (' + opts.version + ')'}`);
  console.log(`  recibo: ${firmasBorradas} fila(s) en gh_firma_purga_registro `
    + `y 2 en gh_firma_purga_log`);

  return {
    firmasBorradas, eventosBorrados, consentimientosBorrados, archivosBorrados,
    tokensBorrados, holdsBorrados, papelBorrados,
    holdsForzados: forzados.length, holdBloqueados: bloqueados.length,
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
    if (r.holdsForzados) {
      console.log(`  Se forzaron ${r.holdsForzados} hold(s): la fila nunca se habia `
        + 'firmado y el hold era el automatico. Queda escrito en el recibo.');
    }
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
        + '[--forzar-hold] [--ejecutar]');
      process.exit(2);
    }
    console.error('Error: ' + (e && e.stack ? e.stack : e));
    process.exit(3);
  }
}

module.exports = {
  main, parseArgs, armarPlan, verificar, statementsDeTriggers, evaluarHold,
};
