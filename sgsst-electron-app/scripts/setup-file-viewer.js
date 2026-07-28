// scripts/setup-file-viewer.js
// Reinstala + limpia los assets de @file-viewer para que el .exe no se hinche.
//
// 1) Copia los assets oficiales via @file-viewer/web-full/scripts/copy-assets.mjs
//    (incluye bundle IIFE, renderers dinámicos, vendor/{pdf,docx,libarchive,ppt,pptx,xlsx}, wasm/, fonts)
// 2) Borra las carpetas/renderers que no usamos con preset-office:
//    - vendor/drawio/    (59 MB)  → no usamos Mermaid/PlantUML/draw.io/XMind
//    - wasm/typst/       (36 MB)  → no usamos .typ/.typst
//    - wasm/model/       (7.4 MB) → no usamos STEP/IGES/3D (occt-import-js)
//    - wasm/cad/         (6.3 MB) → no usamos DWG/DXF (libredwg)
//    - wasm/data/        (0.6 MB) → no usamos SQLite/Parquet/Avro
//    - renderers/{archive,cad,data,drawing,ebook,eda,email,geo,image,media,mindmap,model,ofd,typst}.iife.js
//                       (~16 MB)  → no usamos estos formatos en K+AIR
// 3) Reporta el tamaño final
//
// Quedan ~30 MB: vendor/{docx,libarchive,pdf,ppt,pptx,xlsx} + renderers/{pdf,word,spreadsheet,presentation,text}.iife.js
// + el bundle IIFE (~200 KB) + manifests (~27 KB) + fonts + wasm mínimo.
//
// Uso:  node scripts/setup-file-viewer.js

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.join(__dirname, '..');
const ASSETS_DIR = path.join(PROJECT_ROOT, 'renderer', 'file-viewer-assets');

// 📦608-fix3 — Usar el script de copy-assets del web-full (incluye los renderers
// dinámicos, no solo el shell del web sin -full).
const COPY_ASSETS_SCRIPT = path.join(PROJECT_ROOT, 'node_modules', '@file-viewer', 'web-full', 'scripts', 'copy-assets.mjs');
const BUNDLE_SRC = path.join(PROJECT_ROOT, 'node_modules', '@file-viewer', 'web-full', 'dist', 'flyfish-file-viewer-web-full.iife.js');
const BUNDLE_DST = path.join(ASSETS_DIR, 'flyfish-file-viewer-web-full.iife.js');

// Carpetas que NO necesitamos con preset-office
const UNUSED_DIRS = [
  'vendor/drawio',     // 59 MB
  'wasm/typst',        // 36 MB
  'wasm/model',        // 7.4 MB
  'wasm/cad',          // 6.3 MB
  'wasm/data',         // 0.6 MB
];

// Renderers dinámicos que no necesitamos (están en renderers/*.iife.js)
const UNUSED_RENDERERS = [
  'archive',  // ZIP, RAR, 7Z — no usados en K+AIR
  'cad',      // DWG, DXF, DWF
  'data',     // SQLite, Parquet, Avro
  'drawing',  // draw.io, Mermaid, PlantUML, Excalidraw
  'ebook',    // EPUB, UMD
  'eda',      // EDA files
  'email',    // EML, MSG, MBOX (no en K+AIR)
  'geo',      // geojson, kml, gpx
  'image',    // imágenes — las muestra el browser nativo
  'media',    // audio, video — el browser los reproduce nativo
  'mindmap',  // XMind
  'model',    // 3D STEP/IGES/3DM
  'ofd',      // OFD (China)
  'typst'     // Typst
];

function fmtMB(bytes) {
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

function dirSize(p) {
  if (!fs.existsSync(p)) return 0;
  let total = 0;
  for (const f of fs.readdirSync(p, { withFileTypes: true })) {
    const fp = path.join(p, f.name);
    if (f.isDirectory()) total += dirSize(fp);
    else if (f.isFile()) total += fs.statSync(fp).size;
  }
  return total;
}

console.log('============================================================');
console.log('  setup-file-viewer.js — assets de @file-viewer para K+AIR');
console.log('============================================================');
console.log('');
console.log('1) Reinstala assets oficiales (incluye bundle IIFE, renderers, vendor/, wasm/)...');
try {
  execSync(
    `node "${COPY_ASSETS_SCRIPT}" "${ASSETS_DIR}"`,
    { stdio: 'inherit' }
  );
} catch (e) {
  console.error('  ERROR ejecutando file-viewer-copy-assets:', e.message);
  process.exit(1);
}

console.log('');
console.log('2) Limpia carpetas y renderers que no usamos con preset-office...');
let totalRemoved = 0;
for (const relDir of UNUSED_DIRS) {
  const absDir = path.join(ASSETS_DIR, relDir);
  if (!fs.existsSync(absDir)) {
    console.log(`   - ${relDir.padEnd(20)} (no existe, skip)`);
    continue;
  }
  const size = dirSize(absDir);
  fs.rmSync(absDir, { recursive: true, force: true });
  totalRemoved += size;
  console.log(`   - ${relDir.padEnd(20)} ${fmtMB(size)} borrado`);
}

const renderersDir = path.join(ASSETS_DIR, 'renderers');
if (fs.existsSync(renderersDir)) {
  for (const r of UNUSED_RENDERERS) {
    const f = path.join(renderersDir, r + '.iife.js');
    if (!fs.existsSync(f)) continue;
    const size = fs.statSync(f).size;
    fs.rmSync(f);
    totalRemoved += size;
    console.log(`   - renderers/${r}.iife.js`.padEnd(35) + ' ' + fmtMB(size) + ' borrado');
  }
}

console.log('');
console.log('3) Tamaño final de renderer/file-viewer-assets/:');
console.log(`   ${fmtMB(dirSize(ASSETS_DIR))}  (se removieron ${fmtMB(totalRemoved)})`);
console.log('');
console.log('Listo. Estos assets van a quedar en el repo y se empaquetan en el .exe.');
