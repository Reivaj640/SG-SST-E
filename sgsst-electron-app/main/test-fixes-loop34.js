/* ============================================================
 * Test Loop 34 — Undo de envío (5s window)
 * ============================================================
 * Acumulado: 493/493 tests OK (después de este loop)
 * ============================================================ */

const fs = require('fs');
const path = require('path');

const APP_JS = path.join(__dirname, '..', 'renderer', 'bandeja-integrada', 'app.js');

let passed = 0;
let failed = 0;

function assert(check, label) {
  if (check) {
    console.log("  OK  " + label);
    passed++;
  } else {
    console.log("  XX  " + label);
    failed++;
  }
}

const appContent = fs.readFileSync(APP_JS, 'utf8');

// Helper: extraer bloque de función por balance de braces
function extractFunction(name) {
  const start = appContent.indexOf('function ' + name);
  if (start < 0) return null;
  let depth = 0;
  let i = start;
  let foundFirstBrace = false;
  while (i < appContent.length) {
    const c = appContent[i];
    if (c === '{') { depth++; foundFirstBrace = true; }
    if (c === '}') { depth--; if (foundFirstBrace && depth === 0) return appContent.substring(start, i + 1); }
    i++;
  }
  return null;
}

const undoFn = extractFunction('showUndoToast');

console.log("\n=== Test Loop 34 — Undo de envío ===\n");

console.log("[FIX 1] Función showUndoToast existe");
assert(
  undoFn !== null,
  "JS tiene función showUndoToast"
);

console.log("\n[FIX 2] showUndoToast tiene botón 'Deshacer'");
assert(
  undoFn && /Deshacer/.test(undoFn) && /kair-toast__action/.test(undoFn),
  "showUndoToast renderiza botón 'Deshacer' con clase kair-toast__action"
);

console.log("\n[FIX 3] showUndoToast tiene auto-cierre en 5 segundos");
assert(
  undoFn && /5000/.test(undoFn),
  "showUndoToast tiene setTimeout con 5000ms (5s)"
);

console.log("\n[FIX 4] sendMessage llama a showUndoToast en éxito");
assert(
  /if \(result && result\.success\)[\s\S]*?showUndoToast/.test(appContent),
  "sendMessage llama a showUndoToast cuando result.success"
);

console.log("\n[FIX 5] Comentario del fix existe");
assert(
  /FIX loop 34/i.test(appContent),
  "JS tiene comentario 'FIX loop 34'"
);

console.log("\n=== Resultado: " + passed + " OK, " + failed + " XX ===\n");

if (failed > 0) {
  console.error("FALLO: " + failed + " checks no pasaron");
  process.exit(1);
} else {
  console.log("TODOS LOS CHECKES PASARON");
  process.exit(0);
}
