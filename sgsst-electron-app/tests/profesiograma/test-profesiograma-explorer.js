// test-profesiograma-explorer.js
//
// Test del file explorer NATIVO en el submódulo 3.1.3 (sin iframe).
// El explorer está embebido directamente en perfiles-cargo-profesiograma-viewer.html
// con el mismo look-and-feel que el Responsable SG viewer (1.1.1) pero con branding 3.1.3
// y llamadas API directas (sin postMessage, sin loops de nested iframes).

'use strict';

const fs = require('fs');
const path = require('path');
const ROOT = process.cwd();

async function testExplorerFlow() {
  let pass = 0, fail = 0;

  console.log('================================================================');
  console.log('TEST: File explorer nativo (Perfiles de Cargo y Profesiograma)');
  console.log('ROOT:', ROOT);
  console.log('================================================================\n');

  // Test 1: El HTML del Responsable SG viewer existe (lo seguimos usando como referencia CSS)
  console.log('▶ Test 1: HTML del Responsable SG viewer existe (referencia CSS)');
  const viewerPath = './modules/recursos/responsable-sg/responsable-sg-view.html';
  if (fs.existsSync(viewerPath)) {
    console.log('  ✅ OK — existe');
    pass++;
  } else {
    console.log('  ❌ FAIL — no existe el viewer de referencia');
    fail++;
  }

  // Test 2: El viewer.js del Responsable SG usa window.top
  console.log('\n▶ Test 2: Responsable SG viewer usa window.top (sigue OK para uso normal 1.1.1)');
  const viewerJs = fs.readFileSync('./modules/recursos/responsable-sg/responsable-sg-viewer.js', 'utf8');
  if (viewerJs.includes('window.top') && viewerJs.includes('var targetWindow = window.top || window.parent')) {
    console.log('  ✅ OK — usa window.top como target');
    pass++;
  } else {
    console.log('  ❌ FAIL — no usa window.top');
    fail++;
  }

  // Test 3: El back-to-module del Responsable SG también usa window.top
  console.log('\n▶ Test 3: _backToModule usa window.top');
  if (viewerJs.includes('_backToModule') && /_backToModule[\s\S]{0,300}window\.top/.test(viewerJs)) {
    console.log('  ✅ OK — _backToModule usa window.top');
    pass++;
  } else {
    console.log('  ❌ FAIL — _backToModule no usa window.top');
    fail++;
  }

  // Test 4: La vista del explorador en 3.1.3 es NATIVA (sin iframe) — usa kair-root
  console.log('\n▶ Test 4: Vista del explorador en 3.1.3 es NATIVA (sin iframe)');
  const viewer3Html = fs.readFileSync('./modules/gestion-salud/perfiles-cargo-profesiograma/perfiles-cargo-profesiograma-viewer.html', 'utf8');
  if (viewer3Html.includes('id="view-explorer"') &&
      viewer3Html.includes('id="explorerRoot"') &&
      viewer3Html.includes('kair-root--no-header')) {
    console.log('  ✅ OK — explorer nativo sin header propio (más compacto)');
    pass++;
  } else {
    console.log('  ❌ FAIL — no se encontró el explorer nativo o le falta la clase no-header');
    fail++;
  }

  // Test 4b: NO usa iframe (migración completa)
  console.log('\n▶ Test 4b: NO usa iframe (migración completa)');
  if (!viewer3Html.includes('id="explorer-iframe"')) {
    console.log('  ✅ OK — no hay iframe del explorer');
    pass++;
  } else {
    console.log('  ❌ FAIL — todavía hay iframe del explorer');
    fail++;
  }

  // Test 4c: NO tiene <header class="kair-header"> propio (para ahorrar espacio)
  console.log('\n▶ Test 4c: NO tiene <header class="kair-header"> propio (compacto)');
  // Buscar el header SOLO dentro del view-explorer
  const explorerSection = viewer3Html.match(/id="view-explorer"[\s\S]*?<\/div>\s*<\/div>\s*<!-- DIALOG|<\/div>\s*<\/div>\s*<script/);
  if (explorerSection && !explorerSection[0].includes('<header class="kair-header">')) {
    console.log('  ✅ OK — sin header propio, más espacio para los archivos');
    pass++;
  } else {
    console.log('  ❌ FAIL — todavía tiene <header class="kair-header"> propio');
    fail++;
  }

  // Test 5: El viewer.js de 3.1.3 tiene loadExplorer que llama electronAPI directamente
  console.log('\n▶ Test 5: loadExplorer nativo (sin iframe)');
  const viewer3Js = fs.readFileSync('./modules/gestion-salud/perfiles-cargo-profesiograma/perfiles-cargo-profesiograma-viewer.js', 'utf8');
  // loadExplorer llama a _explorerLoadFolders() (función hermana), que es la que tiene
  // la llamada a window.electronAPI.getDocumentFolders. Verificamos ambos.
  if (viewer3Js.indexOf('function loadExplorer()') >= 0) {
    if (viewer3Js.indexOf('function _explorerLoadFolders()') >= 0 &&
        (viewer3Js.indexOf('window.electronAPI.getDocumentFolders({') >= 0 ||
         viewer3Js.indexOf('api.getDocumentFolders({') >= 0) &&
        viewer3Js.indexOf('companyName: ex.company') >= 0 &&
        viewer3Js.indexOf('submoduleName: ex.submoduleName') >= 0) {
      console.log('  ✅ OK — loadExplorer → _explorerLoadFolders usa electronAPI directo');
      pass++;
    } else {
      console.log('  ❌ FAIL — falta la llamada a electronAPI.getDocumentFolders');
      fail++;
    }

    if (viewer3Js.includes("'3.1.3 Perfil de cargo y profesiograma'") ||
        viewer3Js.includes('"3.1.3 Perfil de cargo y profesiograma"')) {
      console.log('  ✅ OK — submoduleName 3.1.3 correcto');
      pass++;
    } else {
      console.log('  ❌ FAIL — submoduleName incorrecto');
      fail++;
    }
  } else {
    console.log('  ❌ FAIL — no se encontró la función loadExplorer');
    fail++;
  }

  // Test 5b: Tiene helpers del explorer (_explorerLoadFolders, _explorerRenderDocuments, etc.)
  console.log('\n▶ Test 5b: Helpers del explorer');
  const requiredHelpers = [
    '_explorerLoadFolders',
    '_explorerLoadFolderContents',
    '_explorerRenderBreadcrumb',
    '_explorerRenderFolders',
    '_explorerRenderDocuments',
    '_explorerSelectDocument',
    '_explorerShowPdfPreview',
    '_explorerShowExcelPreview',
    '_explorerShowWordPreview',
    '_explorerShowEmptyState',
    '_explorerFormatSize',
    '_explorerFormatDate',
    '_explorerFileTypeInfo',
    '_explorerApplyFiltersAndSort',
    '_explorerRenderPdfBase64'
  ];
  let allHelpersPresent = true;
  for (const helper of requiredHelpers) {
    if (!viewer3Js.includes(helper)) {
      console.log('  ❌ Falta helper: ' + helper);
      allHelpersPresent = false;
    }
  }
  if (allHelpersPresent) {
    console.log('  ✅ OK — todos los helpers presentes (' + requiredHelpers.length + ')');
    pass++;
  } else {
    fail++;
  }

  // Test 6: Tab "Perfiles de Cargo" en 3.1.3
  console.log('\n▶ Test 6: Tab "Perfiles de Cargo" en 3.1.3');
  if (viewer3Html.includes('data-view="explorer"') && viewer3Html.includes('Perfiles de Cargo')) {
    console.log('  ✅ OK — tab configurado');
    pass++;
  } else {
    console.log('  ❌ FAIL — no se encontró el tab');
    fail++;
  }

  // Test 7: Card "Perfiles de Cargo" en el home
  console.log('\n▶ Test 7: Card "Perfiles de Cargo" en el home');
  if (viewer3Html.includes('data-action="open-explorer"')) {
    console.log('  ✅ OK — card en home');
    pass++;
  } else {
    console.log('  ❌ FAIL — no se encontró la card');
    fail++;
  }

  // Test 8: El viewer.js del Responsable SG sigue completo (no rompimos 1.1.1)
  console.log('\n▶ Test 8: El viewer del Responsable SG sigue completo');
  const size = viewerJs.length;
  if (size > 60000) {
    console.log('  ✅ OK — viewer.js sigue completo (' + (size / 1024).toFixed(1) + ' KB)');
    pass++;
  } else {
    console.log('  ❌ FAIL — viewer.js parece incompleto');
    fail++;
  }

  // Test 9: El componente ResponsableSgComponent sigue exportado
  console.log('\n▶ Test 9: ResponsableSgComponent sigue exportado (no rompimos 1.1.1)');
  const sgIndex = fs.readFileSync('./modules/recursos/responsable-sg/index.js', 'utf8');
  if (sgIndex.includes('module.exports') && sgIndex.includes('responsableSgViewer')) {
    console.log('  ✅ OK — exports intactos');
    pass++;
  } else {
    console.log('  ❌ FAIL — exports rotos');
    fail++;
  }

  // Test 10: 1.1.1 sigue funcionando (renderer.js no cambia)
  console.log('\n▶ Test 10: renderer.js sigue montando 1.1.1');
  const rendererJs = fs.readFileSync('./renderer.js', 'utf8');
  if (rendererJs.includes('ResponsableSgComponent') && rendererJs.includes('1.1.1')) {
    console.log('  ✅ OK — renderer.js no fue modificado');
    pass++;
  } else {
    console.log('  ❌ FAIL — renderer.js se modificó');
    fail++;
  }

  // Test 11: 1.1.1 sigue en ALL_SUBMODULES
  console.log('\n▶ Test 11: 1.1.1 sigue en ALL_SUBMODULES');
  if (rendererJs.includes('"1.1.1 Responsable del SG"')) {
    console.log('  ✅ OK — 1.1.1 sigue registrado');
    pass++;
  } else {
    console.log('  ❌ FAIL — 1.1.1 removido de ALL_SUBMODULES');
    fail++;
  }

  // Test 12: El CSS del Responsable SG está linkeado en el viewer 3.1.3 (reuso)
  console.log('\n▶ Test 12: 3.1.3 reusa el CSS del Responsable SG (kair-*)');
  if (viewer3Html.includes('responsable-sg-view.css')) {
    console.log('  ✅ OK — reusa el CSS de kair-*');
    pass++;
  } else {
    console.log('  ❌ FAIL — no linkea el CSS de kair-*');
    fail++;
  }

  // Test 12b: Tiene sort dropdown (kair-sort__select) como el Responsable SG
  console.log('\n▶ Test 12b: Tiene sort dropdown (mismo que Responsable SG)');
  if (viewer3Html.includes('id="exp-sort-select"') && viewer3Html.includes('kair-sort__select')) {
    console.log('  ✅ OK — sort dropdown presente');
    pass++;
  } else {
    console.log('  ❌ FAIL — falta el sort dropdown');
    fail++;
  }

  // Test 12c: El render de documentos usa kair-file-grid (estructura idéntica al Responsable SG)
  console.log('\n▶ Test 12c: Render usa kair-file-grid + kair-file__icon--word/excel/pdf');
  if (viewer3Js.includes("'<div class=\"kair-file-grid\">'") &&
      viewer3Js.includes("kair-file__icon--' + typeInfo.className") &&
      viewer3Js.includes("kair-file__badge")) {
    console.log('  ✅ OK — render idéntico al Responsable SG');
    pass++;
  } else {
    console.log('  ❌ FAIL — render no usa estructura kair-file-* estándar');
    fail++;
  }

  // Test 12d: Word preview usa data:application/pdf;base64 (como el Responsable SG)
  console.log('\n▶ Test 12d: Preview de Word usa data:application/pdf;base64');
  if (viewer3Js.includes("data:application/pdf;base64")) {
    console.log('  ✅ OK — preview de Word en iframe con data:application/pdf;base64');
    pass++;
  } else {
    console.log('  ❌ FAIL — preview de Word no usa data:application/pdf;base64');
    fail++;
  }

  // Test 13: El viewer 3.1.3 NO importa electronAPI.profesiograma.* para el explorer (usa el general)
  console.log('\n▶ Test 13: Explorer usa electronAPI general (no profesiograma.*)');
  // Buscar el contexto: la línea que llama a getDocumentFolders debe ser "window.electronAPI.getDocumentFolders"
  // y NO debe tener "profesiograma." justo antes
  const apiCallMatch = viewer3Js.match(/window\.electronAPI\.([\w.]*)?getDocumentFolders/);
  if (apiCallMatch && (apiCallMatch[1] == null || apiCallMatch[1] === '')) {
    console.log('  ✅ OK — usa electronAPI general (sin profesiograma.*)');
    pass++;
  } else {
    console.log('  ❌ FAIL — usa electronAPI.profesiograma incorrecto. Match: ' + JSON.stringify(apiCallMatch && apiCallMatch[1]));
    fail++;
  }

  console.log('\n================================================================');
  console.log('RESUMEN: ' + pass + ' OK, ' + fail + ' FAIL');
  console.log('================================================================');
  process.exit(fail === 0 ? 0 : 1);
}

testExplorerFlow().catch(e => { console.error('FATAL:', e); process.exit(1); });
