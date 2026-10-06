// scripts/test-orchestrator-switch.js
// Test del switch del orquestador en renderer.js (simulado en Node).
// Verifica que la detección de extensión funciona correctamente:
//   - .pdf → IPC viejo (no file-viewer)
//   - .pptx/.ppt/.pptm/.potx/.ppsx/.odp → file-viewer
//   - .xlsx/.xls/.xlsm/.xlsb/.csv/.ods → file-viewer
//   - .docx/.doc/.docm/.dotx/.rtf/.odt → file-viewer
//   - imágenes, markdown, código → file-viewer

// Replica la lógica del switch (renderer.js, actualizada en 📦608-fix)
const OFFICE_EXTS = new Set([
  'pptx','ppt','pptm','potx','ppsx','odp',
  'xlsx','xls','xlsm','xlsb','csv','ods','fods','numbers',
  'docx','doc','docm','dotx','rtf','odt',
  'eml','msg','md','markdown','txt',
  'png','jpg','jpeg','gif','webp','svg','bmp','tif','tiff',
  'json','xml','yaml','yml','css','html','htm',
  'js','ts','jsx','tsx','mjs','cjs','java','py','c','cpp','cc','h','hpp',
  'cs','go','rs','php','rb','swift','kt','sql','sh','bash','log',
  'diff','patch','toml','ini','http','ipynb',
  'zip','7z','rar','tar','gz','tgz','bz2','xz','cab','iso','apk','cbz','cbr',
  'svgz','epub','xmind','drawio','dio','mermaid','mmd','plantuml','puml',
  'sqlite','parquet','ttf','otf','woff','woff2','gltf','glb'
]);

function shouldUseFileViewer(filePath) {
  const ext = (String(filePath).split('.').pop() || '').toLowerCase();
  return ext && ext !== 'pdf' && OFFICE_EXTS.has(ext);
}

const CASES = [
  // [path, expected, description]
  ['C:\\docs\\manual.pdf',      false, 'PDF — flujo viejo (mantener)'],
  ['C:\\docs\\presentacion.pptx', true, 'PPTX — file-viewer'],
  ['C:\\docs\\viejo.ppt',         true, 'PPT legacy — file-viewer (con wasm)'],
  ['C:\\docs\\demo.pptm',         true, 'PPTM — file-viewer'],
  ['C:\\docs\\slides.odp',        true, 'ODP — file-viewer'],
  ['C:\\docs\\reporte.xlsx',      true, 'XLSX — file-viewer (tabla virtual)'],
  ['C:\\docs\\reporte.xls',       true, 'XLS legacy — file-viewer'],
  ['C:\\docs\\datos.csv',         true, 'CSV — file-viewer'],
  ['C:\\docs\\manual.docx',       true, 'DOCX — file-viewer (fidelidad alta)'],
  ['C:\\docs\\manual.doc',        true, 'DOC legacy — file-viewer'],
  ['C:\\docs\\notas.rtf',         true, 'RTF — file-viewer'],
  ['C:\\docs\\correo.eml',        true, 'EML — file-viewer'],
  ['C:\\docs\\foto.jpg',          true, 'JPG — file-viewer (imagen)'],
  ['C:\\docs\\logo.png',          true, 'PNG — file-viewer'],
  ['C:\\docs\\README.md',         true, 'Markdown — file-viewer'],
  ['C:\\docs\\script.js',         true, 'JS code — file-viewer (con whitelist extendida)'],
  ['C:\\docs\\datos.json',         true, 'JSON — file-viewer'],
  ['C:\\docs\\codigo.py',          true, 'Python — file-viewer'],
  ['C:\\docs\\backup.zip',         true, 'ZIP — file-viewer (libarchive)'],
  // Caso borde: filePath sin extensión
  ['C:\\docs\\README',             false, 'Sin extensión — no se decide (queda PDF/IPC)'],
  // Caso borde: solo el nombre
  ['archivo.pdf',                  false, 'PDF lowercase'],
  ['archivo.PDF',                  false, 'PDF uppercase (case-insensitive)'],
];

let passed = 0, failed = 0;
console.log('============================================================');
console.log('  test-orchestrator-switch — detección Office vs PDF');
console.log('============================================================\n');

for (const [path, expected, desc] of CASES) {
  const got = shouldUseFileViewer(path);
  const ok = got === expected;
  const tag = ok ? '✅' : '❌';
  console.log(`  ${tag} ${path.padEnd(35)} → file-viewer: ${got} (esperado: ${expected}) — ${desc}`);
  if (ok) passed++; else failed++;
}

console.log(`\nResultado: ${passed} OK, ${failed} FAIL`);
process.exit(failed > 0 ? 1 : 0);
