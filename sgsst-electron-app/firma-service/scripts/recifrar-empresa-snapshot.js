#!/usr/bin/env node
/**
 * scripts/recifrar-empresa-snapshot.js
 *
 * Re-cifra el documento del representante legal en las copias históricas de
 * `gh_consentimientos_firma.empresa_snapshot` que todavía lo guardan en claro.
 *
 * POR QUÉ HAY UN SCRIPT Y NO UNA MIGRACIÓN
 * -----------------------------------------
 * Una migración corre sola, en el arranque, sin que un humano revise qué va a
 * tocar. Re-cifrar una fila archivada es una operación que roza lo
 * irreversible: si se cifra con la llave equivocada, el número no se puede
 * recuperar de otra parte. Además, la fila es prueba de lo que el firmante vio
 * y su `empresa_hash` tiene que seguir cuadrando.
 *
 * Por eso:
 *
 *   - NO escribe nada sin `--ejecutar`.
 *   - Exige `--actor` y `--motivo`.
 *   - Exige `--backup` antes de escribir (vía de restauración).
 *   - Verifica ANTES de escribir: la huella del snapshot en claro, que el
 *     sobre se abra, que el número vuelva igual y que la huella se recalcule.
 *   - Verifica la huella `empresa_hash` de la fila. Si no cuadra, NO toca la
 *     fila: una copia alterada no se "arregla" cifrándola.
 *   - Deja un recibo JSON con una fila por fila. No imprime ni guarda el
 *     número completo.
 *
 * NO usa `gh_firma_eventos`: esa tabla tiene `firma_id NOT NULL` y estas filas
 * de consentimiento no tienen una firma a la que colgar el evento. El recibo
 * JSON es la traza de esta operación.
 *
 * USO
 * ---
 *   node scripts/recifrar-empresa-snapshot.js --actor="Nombre" --motivo="Por qué"
 *   node scripts/recifrar-empresa-snapshot.js --actor="Nombre" --motivo="Por qué" \
 *        --ejecutar --backup=data/backup/firma-antes.sqlite \
 *        --recibo=data/recifrado-empresa-snapshot.json
 *   node scripts/recifrar-empresa-snapshot.js --actor="Nombre" --motivo="Por qué" \
 *        --empresa=900123456 --ejecutar --backup=... --recibo=...
 *
 * En producción, además, `--ejecutar` exige `--confirmo-produccion` y un
 * `--recibo` explícito. No es una formalidad: el script no puede saber si el
 * Gate 0 y el hold legal ya están en verde.
 *
 * Exit codes:
 *   0  operación exitosa (incluida la simulación sin filas con error)
 *   2  argumentos inválidos o backup ausente
 *   3  error de base de datos o fila que no se pudo verificar
 */
'use strict';

const fs = require('fs');
const path = require('path');

const db = require('../src/db/connection');
const empresaService = require('../src/services/empresa');
const representanteService = require('../src/services/representante');
const { sha256 } = require('../src/crypto/hash');
const { esCifrado } = require('../src/crypto/cifrado');

const SCRIPT = 'scripts/recifrar-empresa-snapshot.js';

// D-14: el evento que queda en la base por cada fila re-cifrada. Misma
// convención que los de consentimiento ('CONSENT_EXPIRED', 'CONSENT_OTP_SENT').
// Se escribe en la MISMA transacción que el UPDATE: si el evento falla, la
// fila no se toca.
const EVENTO_RECIFRADO = 'CONSENT_SNAPSHOT_RECIFRADO';

/**
 * La versión de llave con la que quedó cifrado el sobre (`enc:v2:<ver>:...`).
 * Va en el metadata del evento: sirve para saber con qué llave hay que
 * reabrir el sobre si algún día hay que verificarlo.
 *
 * @param {string} json - el snapshot ya cifrado, en JSON
 * @returns {string|null}
 */
function _versionLlave(json) {
  try {
    const snap = JSON.parse(json);
    const sobre = snap && snap.representante_legal_identificacion;
    if (typeof sobre !== 'string') return null;
    const partes = sobre.split(':');
    // enc:v2:<version>:<iv>:<tag>:<cifrado>
    return partes.length >= 3 && partes[0] === 'enc' ? partes[2] : null;
  } catch (_) {
    return null;
  }
}

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  const opts = {
    actor: null,
    motivo: null,
    empresa: null,
    ejecutar: false,
    backup: null,
    recibo: null,
    confirmoProduccion: false,
  };

  for (const arg of argv) {
    if (arg === '--ejecutar') {
      opts.ejecutar = true;
    } else if (arg === '--confirmo-produccion') {
      opts.confirmoProduccion = true;
    } else if (arg.startsWith('--actor=')) {
      opts.actor = arg.slice('--actor='.length).trim();
    } else if (arg.startsWith('--motivo=')) {
      opts.motivo = arg.slice('--motivo='.length).trim();
    } else if (arg.startsWith('--empresa=')) {
      opts.empresa = arg.slice('--empresa='.length).trim();
    } else if (arg.startsWith('--backup=')) {
      opts.backup = arg.slice('--backup='.length).trim();
    } else if (arg.startsWith('--recibo=')) {
      opts.recibo = arg.slice('--recibo='.length).trim();
    } else {
      throw new Error(`Argumento desconocido: ${arg}`);
    }
  }

  if (!opts.actor) throw new Error('Falta --actor (quién hace el cambio)');
  if (!opts.motivo) throw new Error('Falta --motivo (por qué se hace el cambio)');

  if (opts.ejecutar && !opts.backup) {
    throw new Error('Falta --backup (vía de restauración antes de escribir)');
  }
  if (opts.ejecutar && process.env.NODE_ENV === 'production') {
    if (!opts.confirmoProduccion) {
      throw new Error('En producción, --ejecutar exige --confirmo-produccion');
    }
    if (!opts.recibo) {
      throw new Error('En producción, --ejecutar exige --recibo explícito');
    }
  }

  return opts;
}

/**
 * Verifica que el backup exista y no esté vacío. No intenta abrirlo: puede ser
 * un archivo SQLite, un dump comprimido o una copia del volumen; lo que importa
 * es que haya una vía de restauración declarada y comprobable.
 *
 * @param {string} ruta
 * @returns {string} ruta absoluta
 */
function verificarBackup(ruta) {
  const abs = path.resolve(ruta);
  let st;
  try {
    st = fs.statSync(abs);
  } catch (_) {
    throw new Error(`El backup no existe: ${abs}`);
  }
  if (!st.isFile() || st.size === 0) {
    throw new Error(`El backup no es un archivo con contenido: ${abs}`);
  }
  return abs;
}

/**
 * Filas candidatas. Devuelve también las que no se pueden tocar, para que el
 * recibo diga exactamente qué quedó pendiente.
 *
 * @param {string|null} id_empresa
 * @returns {Array<{fila: object, snap?: object, estado: string, problema?: string}>}
 */
function filas(id_empresa) {
  const sql = `
    SELECT id, id_empresa, empresa_snapshot, empresa_hash
    FROM gh_consentimientos_firma
    WHERE empresa_snapshot IS NOT NULL
      AND empresa_snapshot <> ''
      ${id_empresa ? 'AND id_empresa = ?' : ''}
    ORDER BY id ASC`;
  const rows = id_empresa
    ? db.prepare(sql).all(id_empresa)
    : db.prepare(sql).all();

  const resultado = [];
  for (const fila of rows) {
    const snap = empresaService.parseSnapshot(fila.empresa_snapshot);
    if (!snap) {
      resultado.push({
        fila,
        estado: 'error',
        problema: 'snapshot ilegible (JSON inválido)',
      });
      continue;
    }

    if (typeof fila.id_empresa !== 'string' || fila.id_empresa.trim() === '') {
      resultado.push({
        fila,
        snap,
        estado: 'error',
        problema: 'id_empresa vacío: no hay ámbito para abrir o cifrar el sobre',
      });
      continue;
    }

    const valor = snap.representante_legal_identificacion;
    if (typeof valor !== 'string' || valor.length === 0) {
      resultado.push({
        fila,
        snap,
        estado: 'omitida',
        problema: 'snapshot sin documento del representante',
      });
      continue;
    }

    // Un sobre existente no se salta a ciegas: se abre con el ámbito y el
    // campo de ESTA fila. Un v2 de otra Empresa, o un sobre alterado, no es
    // una fila "ya lista".
    if (esCifrado(valor)) {
      if (typeof fila.empresa_hash !== 'string' || fila.empresa_hash.length === 0) {
        resultado.push({
          fila,
          snap,
          estado: 'error',
          problema: 'ya está cifrado, pero empresa_hash NULL: no se puede verificar',
        });
        continue;
      }
      let abierto;
      try {
        abierto = empresaService.descifrarSnapshotEmpresa(snap, fila.id_empresa);
      } catch (e) {
        resultado.push({
          fila,
          snap,
          estado: 'error',
          problema: 'el sobre no se abre con esta Empresa/campo: ' + e.message,
        });
        continue;
      }
      if (!abierto
        || empresaService.hashSnapshotEmpresa(abierto) !== fila.empresa_hash) {
        resultado.push({
          fila,
          snap,
          estado: 'error',
          problema: 'el sobre se abre, pero la huella no coincide con el claro',
        });
        continue;
      }
      resultado.push({
        fila,
        snap,
        estado: 'omitida',
        problema: 'ya está cifrado y verifica',
      });
      continue;
    }

    if (typeof fila.empresa_hash !== 'string' || fila.empresa_hash.length === 0) {
      resultado.push({
        fila,
        snap,
        estado: 'error',
        problema: 'empresa_hash NULL: no se puede verificar la copia; no se toca',
      });
      continue;
    }

    // La huella se calculó sobre el texto JSON EXACTO que se archivó. Si el
    // texto cambió (aunque el contenido canónico dé igual), no es la copia
    // que el firmante vio: se reporta y no se toca.
    if (sha256(fila.empresa_snapshot) !== fila.empresa_hash) {
      resultado.push({
        fila,
        snap,
        estado: 'error',
        problema: 'la huella sha256 del texto archivado no coincide con empresa_hash',
      });
      continue;
    }

    const huella = empresaService.hashSnapshotEmpresa(snap);
    if (huella !== fila.empresa_hash) {
      resultado.push({
        fila,
        snap,
        estado: 'error',
        problema: 'la huella empresa_hash no coincide con el snapshot en claro',
      });
      continue;
    }

    resultado.push({ fila, snap, estado: 'candidata' });
  }
  return resultado;
}

/**
 * Prepara y VERIFICA el snapshot cifrado de una fila. No escribe.
 *
 * @param {{fila: object, snap: object}} candidato
 * @returns {{ok: true, json: string, masked: string}|{ok: false, error: string}}
 */
function preparar(candidato) {
  const { fila, snap } = candidato;
  const valor = snap.representante_legal_identificacion;
  const masked = representanteService.MASCARA
    + representanteService.ultimosDeTexto(valor);

  let preparado;
  try {
    preparado = empresaService.cifrarSnapshotEmpresa(snap, fila.id_empresa);
  } catch (e) {
    return { ok: false, error: 'no se pudo cifrar: ' + e.message };
  }
  if (!preparado) {
    return { ok: false, error: 'no se pudo construir el snapshot cifrado' };
  }

  const json = JSON.stringify(preparado);
  if (json.includes(valor)) {
    return { ok: false, error: 'el número completo quedó en el JSON cifrado' };
  }

  let abierto;
  try {
    abierto = empresaService.descifrarSnapshotEmpresa(preparado, fila.id_empresa);
  } catch (e) {
    return { ok: false, error: 'no se pudo verificar el cifrado: ' + e.message };
  }
  if (!abierto || abierto.representante_legal_identificacion !== valor) {
    return { ok: false, error: 'la verificación no cuadra (el número no vuelve igual)' };
  }

  // El resto de la copia tiene que quedar igual: el backfill solo transforma
  // el documento del representante, no "normaliza" lo que el firmante vio.
  for (const clave of Object.keys(snap)) {
    if (clave === 'representante_legal_identificacion'
      || clave === 'representante_legal_identificacion_ultimos4') {
      continue;
    }
    if (abierto[clave] !== snap[clave]) {
      return { ok: false, error: `la verificación cambió el campo ${clave}` };
    }
  }

  const huella = empresaService.hashSnapshotEmpresa(abierto);
  if (huella !== fila.empresa_hash) {
    return { ok: false, error: 'la huella cambió después de cifrar; no se toca' };
  }

  return { ok: true, json, masked };
}

function _sha256Texto(texto) {
  return sha256(String(texto));
}

function _rutaRecibo(opts) {
  if (opts.recibo) return path.resolve(opts.recibo);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const sufijo = opts.ejecutar ? '' : '-dry-run';
  return path.resolve(
    __dirname,
    '..',
    'data',
    `recifrado-empresa-snapshot-${stamp}${sufijo}.json`
  );
}

function _escribirRecibo(ruta, recibo) {
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  const tmp = ruta + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(recibo, null, 2) + '\n', { encoding: 'utf8' });
  fs.renameSync(tmp, ruta);
}

/**
 * @param {string[]} [argv]
 * @returns {number} exit code
 */
function main(argv = process.argv.slice(2)) {
  let opts;
  try {
    opts = parseArgs(argv);
    if (opts.ejecutar) opts.backup = verificarBackup(opts.backup);
  } catch (e) {
    process.stderr.write(`[recifrar-empresa-snapshot] ${e.message}\n`);
    return 2;
  }

  let candidatos;
  try {
    candidatos = filas(opts.empresa);
  } catch (e) {
    process.stderr.write(
      `[recifrar-empresa-snapshot] error de base de datos: ${e.message}\n`
    );
    return 3;
  }

  const recibo = {
    script: SCRIPT,
    fecha: new Date().toISOString(),
    actor: opts.actor,
    motivo: opts.motivo,
    ejecutar: opts.ejecutar,
    empresa: opts.empresa || null,
    backup: opts.backup || null,
    total: candidatos.length,
    recifradas: 0,
    simuladas: 0,
    omitidas: 0,
    errores: 0,
    filas: [],
  };

  const linea = '-'.repeat(72);
  process.stdout.write('\n' + linea + '\n');
  process.stdout.write('RE-CIFRADO DEL DOCUMENTO DEL REPRESENTANTE EN EMPRESA_SNAPSHOT (8B-C)\n');
  process.stdout.write(`Actor:  ${opts.actor}\n`);
  process.stdout.write(`Motivo: ${opts.motivo}\n`);
  process.stdout.write(`Modo:   ${opts.ejecutar ? 'EJECUTAR' : 'SIMULACIÓN'}\n`);
  process.stdout.write(linea + '\n\n');

  for (const c of candidatos) {
    const filaRecibo = {
      id: c.fila.id,
      id_empresa: c.fila.id_empresa,
      estado: c.estado,
      problema: c.problema || null,
      snapshot_antes_sha256: _sha256Texto(c.fila.empresa_snapshot),
      snapshot_despues_sha256: null,
      empresa_hash: c.fila.empresa_hash,
    };

    if (c.estado !== 'candidata') {
      if (c.estado === 'error') recibo.errores++;
      else recibo.omitidas++;
      recibo.filas.push(filaRecibo);
      process.stdout.write(`  id=${c.fila.id} (${c.fila.id_empresa}): ${c.estado.toUpperCase()} - ${c.problema}\n`);
      continue;
    }

    const prep = preparar(c);
    if (!prep.ok) {
      recibo.errores++;
      filaRecibo.estado = 'error';
      filaRecibo.problema = prep.error;
      recibo.filas.push(filaRecibo);
      process.stdout.write(`  id=${c.fila.id} (${c.fila.id_empresa}): ERROR - ${prep.error}\n`);
      continue;
    }

    filaRecibo.snapshot_despues_sha256 = _sha256Texto(prep.json);
    filaRecibo.documento_mostrado = prep.masked;

    if (!opts.ejecutar) {
      recibo.simuladas++;
      filaRecibo.estado = 'simulada';
      recibo.filas.push(filaRecibo);
      process.stdout.write(`  id=${c.fila.id} (${c.fila.id_empresa}, ${prep.masked}): se re-cifraría\n`);
      continue;
    }

    try {
      const aplicar = db.transaction(() => {
        const res = db.prepare(`
          UPDATE gh_consentimientos_firma
          SET empresa_snapshot = ?
          WHERE id = ? AND empresa_snapshot = ?
        `).run(prep.json, c.fila.id, c.fila.empresa_snapshot);
        if (res.changes !== 1) {
          throw new Error('la fila cambió durante la operación; no se sobrescribe');
        }

        // D-14: el re-cifrado queda en la base, no solo en el recibo.
        //
        // El recibo JSON es un archivo en el disco del operador: se copia, se
        // borra, se pierde. La base es donde vive el resto de la prueba. Un
        // re-cifrado cambia lo que el firmante vio, así que tiene que quedar
        // registrado donde se consulta.
        //
        // Va en la MISMA transacción que el UPDATE: si el evento no se puede
        // escribir, la fila tampoco se toca. Y no lleva el número del
        // representante: ni en claro ni en forma derivable.
        db.prepare(`
          INSERT INTO gh_consentimientos_eventos
            (consent_id, evento, fecha_hora, id_actor, ip, user_agent, metadata)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          c.fila.id,
          EVENTO_RECIFRADO,
          new Date().toISOString(),
          opts.actor,
          null,
          'script:' + path.basename(__filename),
          JSON.stringify({
            motivo: opts.motivo,
            // La huella del JSON en claro NO cambia (por eso el trabajo
            // conserva `empresa_hash`): lo que cambia es el sobre.
            empresa_hash: c.fila.empresa_hash,
            version_llave: _versionLlave(prep.json),
            script: 'recifrar-empresa-snapshot',
          })
        );
      });
      aplicar();
      recibo.recifradas++;
      filaRecibo.estado = 'recifrada';
      recibo.filas.push(filaRecibo);
      process.stdout.write(`  id=${c.fila.id} (${c.fila.id_empresa}, ${prep.masked}): re-cifrada\n`);
    } catch (e) {
      recibo.errores++;
      filaRecibo.estado = 'error';
      filaRecibo.problema = e.message;
      recibo.filas.push(filaRecibo);
      process.stdout.write(`  id=${c.fila.id} (${c.fila.id_empresa}): ERROR - ${e.message}\n`);
    }
  }

  const rutaRecibo = _rutaRecibo(opts);
  try {
    _escribirRecibo(rutaRecibo, recibo);
  } catch (e) {
    process.stderr.write(
      `[recifrar-empresa-snapshot] no se pudo escribir el recibo: ${e.message}\n`
    );
    return 3;
  }

  process.stdout.write('\n' + linea + '\n');
  if (!opts.ejecutar) {
    process.stdout.write(`SIMULACIÓN: no se escribió en la base. Recibo: ${rutaRecibo}\n`);
  } else {
    process.stdout.write(
      `Re-cifradas: ${recibo.recifradas} · omitidas: ${recibo.omitidas} · errores: ${recibo.errores}\n`
    );
    process.stdout.write(`Recibo: ${rutaRecibo}\n`);
  }
  process.stdout.write(linea + '\n');

  return recibo.errores > 0 ? 3 : 0;
}

if (require.main === module) {
  process.exit(main());
}

module.exports = {
  main,
  parseArgs,
  verificarBackup,
  filas,
  preparar,
};
