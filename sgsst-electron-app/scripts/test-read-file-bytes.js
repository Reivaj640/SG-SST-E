// scripts/test-read-file-bytes.js
// Test del IPC read-file-bytes (simulado en Node, sin Electron).
// Verifica: whitelist de extensiones, lectura de bytes, validación de tamaño.

const path = require('path');
const fs = require('fs');
const fsp = require('fs').promises;

const PROJECT_ROOT = path.join(__dirname, '..');
const TEST_FILES = [
  // [path, expectedSuccess, description]
  [path.join(PROJECT_ROOT, 'assets', 'samples', 'sample-sgsst.pptx'),  true,  'PPTX válido (175 KB) — debe leer bytes'],
  [path.join(PROJECT_ROOT, 'release-notes.md'),                          true,  'Markdown válido — debe leer bytes (file-viewer soporta MD)'],
  [path.join(PROJECT_ROOT, 'package.json'),                              true,  'JSON válido — debe leer bytes (file-viewer soporta JSON)'],
  [path.join(PROJECT_ROOT, 'NONEXISTENT.pptx'),                           false, 'Archivo inexistente — debe fallar'],
  ['C:\\foo.exe',                                                          false, '.exe NO en whitelist — debe fallar']
];

// Whitelist copiada de main.js (📦608)
const ALLOWED = new Set([
  'pdf','docx','docm','dotx','dotm','doc','dot','rtf','odt',
  'xlsx','xltx','xlsm','xlsb','xls','xlt','xltm','csv','tsv','ods','fods','numbers',
  'pptx','pptm','potx','potm','ppsx','ppsm','ppt','odp',
  'ofd','typ','typst',
  'gif','jpg','jpeg','bmp','tiff','tif','png','svg','webp','avif','ico','heic','heif','jxl',
  'mp4','webm','m3u8','mp3','wav','ogg','opus','m4a','aac','flac',
  'txt','md','markdown','json','xml','yaml','yml','html','htm','css','js','ts','py','java','c','cpp','cs','go','rs','php','rb','swift','kt','sql','sh','bash','log','diff','patch','toml','ini','http','ipynb',
  'eml','msg','mbox',
  'xmind','drawio','dio','excalidraw','mermaid','mmd','plantuml','puml',
  'zip','7z','rar','tar','gz','tgz','bz2','xz','cab','iso','apk','cbz','cbr',
  'epub','ttf','otf','woff','woff2','sqlite','parquet','dxf','dwg','dwf','gltf','glb','obj','stl','ply','step','stp','iges','igs','ifc','3dm','geojson','kml','gpx'
]);
const MAX_BYTES = 100 * 1024 * 1024;

function fmtMB(n) { return (n / 1024 / 1024).toFixed(2) + ' MB'; }

async function readFileBytes(filePath) {
  // Replica la lógica de main.js (📦608)
  const baseName = path.basename(filePath);
  const ext = (path.extname(baseName).slice(1) || '').toLowerCase();
  if (!ext) return { success: false, error: `Sin extensión: ${baseName}` };
  if (!ALLOWED.has(ext)) return { success: false, error: `Extensión no soportada: .${ext}` };

  try { await fsp.access(filePath, fs.constants.R_OK); }
  catch (e) { return { success: false, error: `No accesible: ${e.message}` }; }

  const stat = await fsp.stat(filePath);
  if (stat.size > MAX_BYTES) {
    return { success: false, error: `Excede ${fmtMB(MAX_BYTES)} (pesa ${fmtMB(stat.size)})` };
  }

  const buffer = await fsp.readFile(filePath);
  const bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  return {
    success: true,
    data: { bytes, name: baseName, ext, size: buffer.length }
  };
}

(async () => {
  console.log('============================================================');
  console.log('  test-read-file-bytes — IPC simulado sin Electron');
  console.log('============================================================\n');

  let passed = 0, failed = 0;
  for (const [fp, expectedSuccess, desc] of TEST_FILES) {
    const displayPath = fp.replace(PROJECT_ROOT, '.');
    process.stdout.write(`  ${displayPath.padEnd(40)} `);
    const res = await readFileBytes(fp);
    let ok;
    if (res.success) {
      ok = expectedSuccess === true;
      console.log(`→ ${ok ? '✅' : '❌'} success: ${fmtMB(res.data.size)}, .${res.data.ext} (${desc})`);
    } else {
      ok = expectedSuccess === false;
      console.log(`→ ${ok ? '✅' : '❌'} error: ${res.error.slice(0, 70)} (${desc})`);
    }
    if (ok) passed++; else failed++;
  }

  console.log(`\nResultado: ${passed} OK, ${failed} FAIL`);
  process.exit(failed > 0 ? 1 : 0);
})();
