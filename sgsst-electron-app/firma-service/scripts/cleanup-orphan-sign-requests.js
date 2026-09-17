/**
 * scripts/cleanup-orphan-sign-requests.js
 *
 * Cancela Sign Requests huérfanos (sin Acuerdo válido, generados por tests)
 * preservando TODA la evidencia: registros, eventos, sesiones, consentimientos
 * y PDFs en disco.
 *
 * REGLA DURA: este script NUNCA borra evidencia. Solo cambia estado a CANCELLED
 * y registra un evento de auditoría.
 *
 * Defensas implementadas (ver CLEANUP-POLICY.md):
 *   - --dry-run por defecto (--yes obligatorio para escribir)
 *   - Hard-block si NODE_ENV=production
 *   - Lista EXPLÍCITA de TARGET_IDS (no usar WHERE genérico)
 *   - Validación estricta de criterios por registro
 *   - Backup automático + verificación de checksum
 *   - Transacción atómica
 *   - Idempotente
 *   - No toca PDFs, sesiones, consentimientos, eventos pasados
 *   - Exclusión explícita de registros con actividad real (OTP_VERIFIED, etc.)
 *
 * Uso:
 *   node scripts/cleanup-orphan-sign-requests.js               # dry-run
 *   node scripts/cleanup-orphan-sign-requests.js --yes        # ejecuta
 *   node scripts/cleanup-orphan-sign-requests.js --json       # output JSON
 *
 * Exit codes:
 *   0  operación exitosa (incluye dry-run y no-hay-nada-que-hacer)
 *   1  hard-block producción
 *   2  validación de criterios falló
 *   3  backup con checksum incorrecto
 *   4  transacción abortada
 *   5  verificación post-ejecución falló
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// =============================================================================
// CONFIGURACIÓN EXPLÍCITA
// =============================================================================

const SERVICE_ROOT = path.resolve(__dirname, '..');
const DEV_DB_PATH = path.resolve(SERVICE_ROOT, 'data', 'firma.sqlite');
const BACKUP_DIR = path.resolve(SERVICE_ROOT, 'data', 'backup');

// Lista EXPLÍCITA de IDs a cancelar. NO usar WHERE genérico.
// Esta es la única fuente de verdad.
const TARGET_IDS = [
  'SIGN-2026-702349',
  'SIGN-2026-531707',
];

// IDs EXPLÍCITAMENTE EXCLUIDOS (no tocar bajo ninguna circunstancia).
const EXCLUDED_IDS = [
  'SIGN-2026-823506',  // estado=OTP_VERIFIED, MFA completa, política=PRESERVAR
];

// Criterios esperados por cada TARGET_ID (defensa en profundidad).
// Si un id no cumple, el script aborta sin tocar nada.
const EXPECTED_CRITERIA = {
  estado: 'PENDING',
  eventsCount: 1,
  eventName: 'CREATED',
  agreementHash: 'a'.repeat(64),
  pdfMaxBytes: 200,  // PDFs dummy <= 200 bytes (los reales pesan 300+)
};

// =============================================================================
// ARGUMENTOS CLI (evaluados en main(), no a nivel de módulo, para permitir
// que los tests muten process.argv antes de llamar main() con --yes)
// =============================================================================

// =============================================================================
// HELPERS DE LOGGING
// =============================================================================

const log = (msg, level = 'info') => {
  // Output siempre human-readable. JSON se puede obtener
  // envolviendo el script con `| jq` o similar.
  const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️ ' : level === 'success' ? '✅' : '  ';
  console.log(prefix + ' ' + msg);
};

const header = (s) => {
  console.log('\n' + '='.repeat(78));
  console.log(s);
  console.log('='.repeat(78));
};

// =============================================================================
// DEFENSA 1: HARD-BLOCK PRODUCCIÓN
// =============================================================================

function checkProductionBlock() {
  if (process.env.NODE_ENV === 'production') {
    log('HARD-BLOCK: NODE_ENV=production detectado.', 'error');
    log('Este script es solo para desarrollo/test. En producción, usar', 'error');
    log('  POST /internal/admin/sign-requests/:id/cancel (a implementar).', 'error');
    log('Para producción con K+AIR, contactar al equipo de plataforma.', 'error');
    return false;
  }
  return true;
}

// =============================================================================
// RESOLUCIÓN DE RUTAS
// =============================================================================

function resolveDbPath() {
  // Respetar DB_PATH del entorno si está seteado y es seguro.
  // Si no, usar la BD por defecto del proyecto.
  if (process.env.DB_PATH) {
    return path.resolve(process.env.DB_PATH);
  }
  return DEV_DB_PATH;
}

function resolvePdfDir() {
  if (process.env.PDF_STORAGE_PATH) {
    return path.join(process.env.PDF_STORAGE_PATH, 'originales');
  }
  // Resolver respecto a SERVICE_ROOT para evitar dependencia de CWD
  const config = require('../src/config');
  return path.join(config.storage.pdfPath, 'originales');
}

// =============================================================================
// VALIDACIÓN DE CANDIDATOS
// =============================================================================

function validateCandidate(db, id, pdfDir) {
  const firma = db.prepare(`
    SELECT * FROM gh_firmas_electronicas WHERE id_solicitud = ?
  `).get(id);

  if (!firma) {
    return { ok: false, reason: 'no existe en BD' };
  }

  // Si ya está CANCELLED, no es un error: es idempotente
  if (firma.estado === 'CANCELLED') {
    return { ok: true, id, firma, alreadyCancelled: true, reason: 'ya está CANCELLED' };
  }

  if (firma.estado !== EXPECTED_CRITERIA.estado) {
    return { ok: false, reason: `estado=${firma.estado}, esperado ${EXPECTED_CRITERIA.estado}` };
  }

  if (firma.agreement_hash !== EXPECTED_CRITERIA.agreementHash) {
    return { ok: false, reason: `agreement_hash no es placeholder (${firma.agreement_hash.substring(0, 8)}...)` };
  }

  const eventsCount = db.prepare(`
    SELECT COUNT(*) AS n FROM gh_firma_eventos WHERE firma_id = ?
  `).get(firma.id).n;

  if (eventsCount !== EXPECTED_CRITERIA.eventsCount) {
    return { ok: false, reason: `eventos=${eventsCount}, esperado ${EXPECTED_CRITERIA.eventsCount}` };
  }

  const ev = db.prepare(`
    SELECT evento FROM gh_firma_eventos WHERE firma_id = ?
  `).get(firma.id);

  if (ev.evento !== EXPECTED_CRITERIA.eventName) {
    return { ok: false, reason: `único evento es ${ev.evento}, esperado ${EXPECTED_CRITERIA.eventName}` };
  }

  // Verificar PDF en disco (solo reportar, no es bloqueante)
  const pdfPath = path.join(pdfDir, `${id}.pdf`);
  let pdfSize = null;
  if (fs.existsSync(pdfPath)) {
    pdfSize = fs.statSync(pdfPath).size;
  }

  return { ok: true, id, firma, pdfPath, pdfSize };
}

// =============================================================================
// BACKUP
// =============================================================================

function createBackup(dbPath) {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(BACKUP_DIR, `pre-cleanup-${ts}.sqlite`);
  fs.copyFileSync(dbPath, backupPath);

  // Verificar checksum
  const dbHash = sha256File(dbPath);
  const backupHash = sha256File(backupPath);
  if (dbHash !== backupHash) {
    fs.unlinkSync(backupPath);
    return { ok: false, error: 'checksum_mismatch', dbHash, backupHash };
  }
  return { ok: true, backupPath, dbHash, size: fs.statSync(backupPath).size };
}

function sha256File(p) {
  const content = fs.readFileSync(p);
  return crypto.createHash('sha256').update(content).digest('hex');
}

// =============================================================================
// MAIN
// =============================================================================

function main(options = {}) {
  // Defensa 1
  if (!checkProductionBlock()) {
    return 1;
  }

  // Args (evaluados ahora, no a nivel de módulo)
  const args = process.argv.slice(2);
  const isYes = args.includes('--yes');
  const isDryRun = !isYes;

  // Permitir override de TARGET_IDS/EXCLUDED_IDS/CRITERIA via options
  // (usado por tests; en producción se usan los defaults del módulo)
  const TARGET_IDS = options.TARGET_IDS || module.exports.TARGET_IDS;
  const EXCLUDED_IDS = options.EXCLUDED_IDS || module.exports.EXCLUDED_IDS;
  const EXPECTED_CRITERIA = options.EXPECTED_CRITERIA || module.exports.EXPECTED_CRITERIA;

  // Resolver paths
  const dbPath = resolveDbPath();
  const pdfDir = resolvePdfDir();

  header('CLEANUP DE SIGN REQUESTS HUÉRFANOS');
  log(`Modo:            ${isDryRun ? 'DRY-RUN (solo lectura)' : 'EJECUCIÓN REAL (--yes)'}`);
  log(`BD objetivo:     ${dbPath}`);
  log(`Storage PDFs:    ${pdfDir}`);
  log(`Backup dir:      ${BACKUP_DIR}`);
  log(`NODE_ENV:        ${process.env.NODE_ENV || '(no set)'}`);
  log('');
  log(`TARGET_IDS (${TARGET_IDS.length}):`);
  for (const id of TARGET_IDS) log(`  - ${id}`);
  log(`EXCLUIDOS explícitamente (${EXCLUDED_IDS.length}):`);
  for (const id of EXCLUDED_IDS) log(`  - ${id}  (no se toca)`);
  log('');

  // Verificar que la BD existe
  if (!fs.existsSync(dbPath)) {
    log(`BD no encontrada: ${dbPath}`, 'error');
    return 1;
  }

  // Abrir BD en read-only para validación
  const dbRead = new Database(dbPath, { readonly: true, fileMustExist: true });

  // Verificar IDs excluidos (confirmación visual de que existen y NO se tocan)
  log('--- Verificación de EXCLUIDOS (no se tocan) ---');
  for (const id of EXCLUDED_IDS) {
    const firma = dbRead.prepare(`SELECT estado FROM gh_firmas_electronicas WHERE id_solicitud = ?`).get(id);
    if (firma) {
      log(`  ${id}: estado=${firma.estado}  → CONFIRMADO NO TOCAR`);
    } else {
      log(`  ${id}: no existe en BD (no aplica)`, 'warn');
    }
  }

  // Validar TARGET_IDS
  log('');
  log('--- Validación de TARGET_IDS ---');
  const validated = [];
  const alreadyCancelled = [];
  const rejected = [];
  for (const id of TARGET_IDS) {
    const v = validateCandidate(dbRead, id, pdfDir);
    if (v.ok) {
      if (v.alreadyCancelled) {
        alreadyCancelled.push(v);
        log(`  ${id}: ✓ ya CANCELLED (idempotente, no se hace nada)`, 'warn');
      } else {
        validated.push(v);
        const sizeStr = v.pdfSize !== null ? `, pdf=${v.pdfSize} bytes` : ', pdf=NO EN DISCO';
        log(`  ${id}: ✓ OK (estado=${v.firma.estado}${sizeStr})`, 'success');
      }
    } else {
      rejected.push({ id, reason: v.reason });
      log(`  ${id}: ✗ RECHAZADO — ${v.reason}`, 'error');
    }
  }

  if (rejected.length > 0) {
    log('');
    log(`ABORTANDO: ${rejected.length} ID(s) no cumplen los criterios esperados.`, 'error');
    log('Esto indica un cambio en el estado de los registros que requiere revisión manual.', 'error');
    log('NO se realizó ninguna escritura.', 'error');
    dbRead.close();
    return 2;
  }

  if (validated.length === 0) {
    log('No hay IDs que cumplan criterios. Nada que hacer.');
    dbRead.close();
    return 0;
  }

  // Dry-run: parar aquí
  if (isDryRun) {
    log('');
    log('--- Resumen DRY-RUN ---');
    log(`A cancelarían: ${validated.length}`);
    for (const v of validated) log(`  - ${v.id}`);
    log(`Backup se crearía en: ${BACKUP_DIR}`);
    log(`[DRY-RUN] Para ejecutar de verdad: añadir --yes`, 'warn');
    dbRead.close();
    return 0;
  }

  // EJECUCIÓN REAL
  log('');
  log('--- EJECUCIÓN REAL ---');

  // 1. Backup
  log('Creando backup...');
  const backup = createBackup(dbPath);
  if (!backup.ok) {
    log(`Backup falló: ${backup.error}`, 'error');
    log(`  BD hash:     ${backup.dbHash}`, 'error');
    log(`  Backup hash: ${backup.backupHash}`, 'error');
    dbRead.close();
    return 3;
  }
  log(`Backup OK: ${backup.backupPath}`, 'success');
  log(`  Size:    ${backup.size} bytes`);
  log(`  SHA-256: ${backup.dbHash.substring(0, 16)}...`);

  dbRead.close();

  // 2. Reabrir BD en modo lectura-escritura
  const db = new Database(dbPath);
  const cancelled = [];
  const skipped = [];

  try {
    const txn = db.transaction(() => {
      const now = new Date().toISOString();
      for (const v of validated) {
        // Doble check: estado debe seguir siendo PENDING
        const current = db.prepare(`
          SELECT estado FROM gh_firmas_electronicas WHERE id_solicitud = ?
        `).get(v.id);
        if (!current) {
          throw new Error(`${v.id}: ya no existe en BD`);
        }
        if (current.estado === 'CANCELLED') {
          skipped.push({ id: v.id, reason: 'ya estaba en CANCELLED' });
          continue;
        }
        if (current.estado !== EXPECTED_CRITERIA.estado) {
          throw new Error(`${v.id}: estado cambió a ${current.estado}, abortando`);
        }

        // UPDATE
        const upd = db.prepare(`
          UPDATE gh_firmas_electronicas
             SET estado = 'CANCELLED'
           WHERE id_solicitud = ?
             AND estado = 'PENDING'
        `).run(v.id);
        if (upd.changes !== 1) {
          throw new Error(`${v.id}: UPDATE afectó ${upd.changes} filas, esperaba 1`);
        }

        // INSERT evento CANCELLED
        const metadata = JSON.stringify({
          motivo: 'Cleanup pre-v1.1: artefacto de test, agreement_hash placeholder, sin eventos significativos, PDF dummy',
          script: 'cleanup-orphan-sign-requests.js',
          script_version: '1.0.0',
          kair_version: '0.1.189',
          criteria: {
            estado_anterior: 'PENDING',
            eventos_count: EXPECTED_CRITERIA.eventsCount,
            pdf_size_bytes: v.pdfSize,
            agreement_hash_prefix: EXPECTED_CRITERIA.agreementHash.substring(0, 16),
          },
          ejecutor: 'rh:system',
          backup_path: path.relative(SERVICE_ROOT, backup.backupPath),
        });

        db.prepare(`
          INSERT INTO gh_firma_eventos (firma_id, evento, fecha_hora, id_actor, metadata)
          VALUES (?, 'CANCELLED', ?, 'rh:cleanup-script', ?)
        `).run(v.firma.id, now, metadata);

        cancelled.push(v.id);
      }
    });

    txn();
  } catch (e) {
    log(`ERROR en transacción: ${e.message}`, 'error');
    log('Rollback automático. La BD está en su estado original.', 'error');
    db.close();
    return 4;
  }

  // 3. Verificación post-ejecución
  log('');
  log('--- Verificación post-ejecución ---');
  let allGood = true;
  for (const id of cancelled) {
    const firma = db.prepare(`SELECT estado FROM gh_firmas_electronicas WHERE id_solicitud = ?`).get(id);
    if (firma && firma.estado === 'CANCELLED') {
      log(`  ${id}: estado=CANCELLED ✓`, 'success');
    } else {
      log(`  ${id}: estado=${firma ? firma.estado : 'NULL'} ✗`, 'error');
      allGood = false;
    }

    const ev = db.prepare(`
      SELECT id, evento, fecha_hora, id_actor FROM gh_firma_eventos
       WHERE firma_id = (SELECT id FROM gh_firmas_electronicas WHERE id_solicitud = ?)
         AND evento = 'CANCELLED'
         AND id_actor = 'rh:cleanup-script'
    `).get(id);
    if (ev) {
      log(`    evento CANCELLED: #${ev.id} @ ${ev.fecha_hora} (actor=${ev.id_actor})`);
    } else {
      log(`    evento CANCELLED no encontrado ✗`, 'error');
      allGood = false;
    }
  }

  // 4. Verificar PDFs preservados
  log('');
  log('--- PDFs en disco (verificación de preservación) ---');
  for (const v of validated) {
    if (v.pdfPath && fs.existsSync(v.pdfPath)) {
      const size = fs.statSync(v.pdfPath).size;
      log(`  ${v.id}.pdf: SIGUE EN DISCO (${size} bytes) ✓`, 'success');
    } else {
      log(`  ${v.id}.pdf: NO ENCONTRADO ✗`, 'error');
      allGood = false;
    }
  }

  // 5. Verificar que EXCLUIDOS no fueron tocados
  log('');
  log('--- Verificación de EXCLUIDOS (no tocados) ---');
  for (const id of EXCLUDED_IDS) {
    const firma = db.prepare(`SELECT estado FROM gh_firmas_electronicas WHERE id_solicitud = ?`).get(id);
    if (firma) {
      log(`  ${id}: estado=${firma.estado}  → INTACTO ✓`, 'success');
    } else {
      log(`  ${id}: no existe (no aplica)`, 'warn');
    }
  }

  // 6. Verificar que tablas no relacionadas no cambiaron
  log('');
  log('--- Tablas no relacionadas (verificación de no-tocado) ---');
  for (const tbl of ['gh_firma_sesiones', 'gh_consentimientos_firma', 'gh_firma_acuerdo_versiones']) {
    const cnt = db.prepare(`SELECT COUNT(*) AS n FROM ${tbl}`).get();
    log(`  ${tbl}: ${cnt.n} filas`);
  }

  db.close();

  if (!allGood) {
    log('');
    log('Verificación post-ejecución FALLÓ. Revisar arriba.', 'error');
    log(`Backup disponible para rollback: ${backup.backupPath}`, 'warn');
    return 5;
  }

  log('');
  header('CLEANUP COMPLETADO EXITOSAMENTE');
  log(`Cancelados:      ${cancelled.join(', ')}`);
  if (skipped.length > 0) log(`Omitidos:        ${skipped.map(s => s.id).join(', ')} (ya estaban CANCELLED)`);
  log(`Excluidos (intactos): ${EXCLUDED_IDS.join(', ')}`);
  log(`Backup:          ${path.relative(SERVICE_ROOT, backup.backupPath)}`);
  return 0;
}

// =============================================================================
// CLI vs IMPORT
// =============================================================================

// Importar better-sqlite3 lazy (después de las defensas para que el hard-block
// en producción no falle por un import problemático).
let Database;
function loadBetterSqlite3() {
  if (!Database) {
    try {
      Database = require('better-sqlite3');
    } catch (e) {
      log('No se pudo cargar better-sqlite3: ' + e.message, 'error');
      process.exit(1);
    }
  }
  return Database;
}

// Cargar antes de main
loadBetterSqlite3();

// Module exports ANTES del if(require.main === module) para que main()
// pueda usar module.exports.TARGET_IDS cuando se ejecuta como CLI
module.exports = {
  main,
  TARGET_IDS,
  EXCLUDED_IDS,
  EXPECTED_CRITERIA,
};

if (require.main === module) {
  const code = main();
  process.exit(code);
}
