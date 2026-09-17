#!/usr/bin/env node
/**
 * scripts/cleanup-orphan-pdfs.js
 *
 * Mueve PDFs huérfanos (firmados/constancias sin SR en BD) a un directorio
 * de archivo, preservando evidencia para auditoría pero recuperando espacio
 * en el árbol principal de PDFs.
 *
 * REGLA DURA: este script NUNCA borra evidencia. Solo MUEVE los PDFs a
 * `storage/pdf-archive/YYYY-MM-DD/`. La estructura del archivo es la misma
 * que el original (firmados/, constancias/, originales/).
 *
 * Diferencias con cleanup-orphan-sign-requests.js:
 *   - No modifica BD (los PDFs huérfanos no tienen contraparte en BD)
 *   - Solo trabaja con archivos en disco
 *   - Genera manifest (.json) con metadatos del movimiento
 *   - Mismo patrón de defensa: --dry-run, hard-block producción, idempotente
 *
 * Uso:
 *   node scripts/cleanup-orphan-pdfs.js                  # dry-run (DEFAULT)
 *   node scripts/cleanup-orphan-pdfs.js --yes           # ejecuta
 *   node scripts/cleanup-orphan-pdfs.js --json          # output JSON
 *   node scripts/cleanup-orphan-pdfs.js --ids=003786,132601   # IDs específicos
 *
 * Exit codes:
 *   0  operación exitosa (incluye dry-run y no-hay-nada-que-hacer)
 *   1  hard-block producción
 *   2  validación falló
 *   3  filesystem error
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');

// =============================================================================
// CONFIGURACIÓN EXPLÍCITA
// =============================================================================

const SERVICE_ROOT = path.resolve(__dirname, '..');
const DEV_DB_PATH = path.resolve(SERVICE_ROOT, 'data', 'firma.sqlite');
const STORAGE_ROOT = path.resolve(SERVICE_ROOT, 'storage', 'pdfs');
const ARCHIVE_ROOT = path.resolve(SERVICE_ROOT, 'storage', 'pdf-archive');

// IDs EXPLÍCITOS a procesar. Si está vacío Y no se pasa --ids, se procesan
// TODOS los huérfanos encontrados (modo "scan completo").
// Esta es la única fuente de verdad.
let TARGET_IDS = [
  'SIGN-2026-003786',
  'SIGN-2026-132601',
  'SIGN-2026-447025',
  'SIGN-2026-939071',
];

// IDs EXPLÍCITAMENTE EXCLUIDOS (no tocar bajo ninguna circunstancia).
const EXCLUDED_IDS = [
  // Agregar aquí IDs que SÍ están en BD pero no se detectan por algún
  // motivo (e.g., IDs en formato legacy que no siguen SIGN-YYYY-NNNNNN).
];

const PDF_DIRS = {
  originales: path.join(STORAGE_ROOT, 'originales'),
  firmados: path.join(STORAGE_ROOT, 'firmados'),
  constancias: path.join(STORAGE_ROOT, 'constancias'),
};

// =============================================================================
// ARGUMENTOS CLI
// =============================================================================

const args = process.argv.slice(2);
const ASSUME_YES = args.includes('--yes');
const JSON_OUTPUT = args.includes('--json');
const idsArg = args.find(a => a.startsWith('--ids='));
if (idsArg) {
  TARGET_IDS = idsArg.substring(6).split(',').map(s => s.trim()).filter(Boolean);
}

// =============================================================================
// HELPERS
// =============================================================================

function log(msg, level = 'info') {
  if (JSON_OUTPUT && level !== 'error') return; // JSON mode: solo errores
  const prefix = { info: '✓', warn: '⚠', error: '✗' }[level] || '✓';
  console.log(`${prefix} ${msg}`);
}

function logJson(obj) {
  if (JSON_OUTPUT) console.log(JSON.stringify(obj, null, 2));
}

function extractIdFromFilename(filename) {
  // Formatos posibles: SIGN-2026-112173.pdf, SIGN-2026-112173-constancia.pdf
  const m = filename.match(/^(SIGN-\d{4}-\d+)(?:-constancia)?\.pdf$/);
  return m ? m[1] : null;
}

function getSrIdsInBd(db) {
  const rows = db.prepare('SELECT id_solicitud FROM gh_firmas_electronicas').all();
  return new Set(rows.map(r => r.id_solicitud));
}

function findOrphanPdfs(targetIds) {
  const result = [];
  for (const [dirName, dirPath] of Object.entries(PDF_DIRS)) {
    if (!fs.existsSync(dirPath)) continue;
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.pdf'));
    for (const file of files) {
      const id = extractIdFromFilename(file);
      if (!id) continue;
      if (targetIds && !targetIds.includes(id)) continue;
      if (EXCLUDED_IDS.includes(id)) continue;
      result.push({
        id,
        type: dirName,
        filename: file,
        fullPath: path.join(dirPath, file),
      });
    }
  }
  return result;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function computeChecksum(filepath) {
  const content = fs.readFileSync(filepath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

function moveWithManifest(orphan, archiveDir, dryRun) {
  const destDir = path.join(archiveDir, orphan.type);
  ensureDir(destDir);
  const destPath = path.join(destDir, orphan.filename);
  const checksum = computeChecksum(orphan.fullPath);

  const manifest = {
    id: orphan.id,
    type: orphan.type,
    filename: orphan.filename,
    original_path: orphan.fullPath,
    archive_path: destPath,
    sha256: checksum,
    moved_at: new Date().toISOString(),
    reason: 'orphan: PDF sin contraparte en BD (gh_firmas_electronicas.id_solicitud)',
  };

  if (dryRun) {
    return { action: 'would-move', ...manifest };
  }

  try {
    fs.renameSync(orphan.fullPath, destPath);
    return { action: 'moved', ...manifest };
  } catch (e) {
    return { action: 'error', ...manifest, error: e.message };
  }
}

// =============================================================================
// MAIN
// =============================================================================

function main() {
  // Hard-block producción
  if (process.env.NODE_ENV === 'production' && !ASSUME_YES) {
    log('HARD-BLOCK: NODE_ENV=production. Use --yes con conciencia.', 'error');
    process.exit(1);
  }

  // Verificar DB
  if (!fs.existsSync(DEV_DB_PATH)) {
    log(`BD no encontrada: ${DEV_DB_PATH}`, 'error');
    process.exit(2);
  }

  // Verificar storage
  if (!fs.existsSync(STORAGE_ROOT)) {
    log(`Storage no encontrado: ${STORAGE_ROOT}`, 'error');
    process.exit(2);
  }

  log(`Modo: ${ASSUME_YES ? 'EJECUTAR (--yes)' : 'DRY-RUN (usar --yes para mover)'}`);
  log(`TARGET_IDS: ${TARGET_IDS.length === 0 ? 'SCAN COMPLETO' : TARGET_IDS.join(', ')}`);

  // Abrir BD y cruzar
  const db = new Database(DEV_DB_PATH, { readonly: true });
  let orphans;
  try {
    const srIdsInBd = getSrIdsInBd(db);
    const candidates = findOrphanPdfs(TARGET_IDS.length === 0 ? null : TARGET_IDS);
    orphans = candidates.filter(o => !srIdsInBd.has(o.id));
    log(`Encontrados: ${candidates.length} candidatos, ${orphans.length} huérfanos confirmados`);
  } finally {
    db.close();
  }

  if (orphans.length === 0) {
    log('Nada que mover. Limpio.');
    logJson({ orphans: [], moved: 0, errors: 0 });
    process.exit(0);
  }

  // Preparar directorio de archivo
  const today = new Date().toISOString().slice(0, 10);
  const archiveDir = path.join(ARCHIVE_ROOT, today);
  if (ASSUME_YES) {
    ensureDir(archiveDir);
  } else {
    log(`Destino (dry-run, NO se creará): ${archiveDir}`);
  }

  // Mover (o simular)
  const results = orphans.map(o => moveWithManifest(o, archiveDir, !ASSUME_YES));

  // Generar manifest
  const manifestPath = path.join(archiveDir, ASSUME_YES ? 'manifest.json' : 'manifest.dry-run.json');
  if (ASSUME_YES) {
    fs.writeFileSync(manifestPath, JSON.stringify({
      generated_at: new Date().toISOString(),
      total_orphans: results.length,
      moved: results.filter(r => r.action === 'moved').length,
      errors: results.filter(r => r.action === 'error').length,
      items: results,
    }, null, 2));
  }

  // Resumen
  const moved = results.filter(r => r.action === 'moved').length;
  const errors = results.filter(r => r.action === 'error').length;
  log(`${ASSUME_YES ? 'Movidos' : 'A mover'}: ${moved} archivos`);
  if (errors > 0) log(`Errores: ${errors}`, 'error');
  if (ASSUME_YES) log(`Manifest: ${manifestPath}`);

  logJson({ orphans: results, moved, errors });

  process.exit(errors > 0 ? 3 : 0);
}

main();
