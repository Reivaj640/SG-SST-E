/* ============================================================
 * Test Loop 36 — Eliminar BEM no usado
 * ============================================================
 * Acumulado: 503/503 tests OK (después de este loop)
 *
 * CONTEXTO:
 * El refactor BEM del 📦563 creó clases nuevas (.thread-header,
 * .quoted-thread, .message-block) pero el HTML nunca se migró.
 * El HTML sigue usando .kair-mail-detail__* y .kair-mail-message__*.
 * Resultado: ~220 líneas de CSS muerto.
 *
 * FIX (Loop 36):
 * Eliminar las reglas CSS de .thread-header*, .quoted-thread, .message-block*
 * (todas las sub-clases también). El HTML no se ve afectado porque no las usa.
 *
 * Criterio de "listo":
 * - NO hay reglas .thread-header*
 * - NO hay reglas .quoted-thread
 * - NO hay reglas .message-block*
 * - El fragmento huérfano (gap: 6px; flex-wrap: wrap;) está eliminado
 * - El HTML sigue funcionando (no se cambió)
 * ============================================================ */

const fs = require('fs');
const path = require('path');

const STYLES_CSS = path.join(__dirname, '..', 'renderer', 'bandeja-integrada', 'styles.css');

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

const stylesContent = fs.readFileSync(STYLES_CSS, 'utf8');

console.log("\n=== Test Loop 36 — BEM no usado eliminado ===\n");

// === GRUPO 1: NO hay .thread-header* ===
console.log("[FIX 1] NO debe haber reglas .thread-header*");
const threadHeaderMatches = stylesContent.match(/^\.thread-header[^,{]*[\s,{]/gm) || [];
assert(
  threadHeaderMatches.length === 0,
  "Cero reglas .thread-header* (era 1 + 14 sub-clases = 15)"
);

// === GRUPO 2: NO hay .quoted-thread ===
console.log("\n[FIX 2] NO debe haber reglas .quoted-thread");
const quotedThreadMatches = stylesContent.match(/^\.quoted-thread[^,{]*[\s,{]/gm) || [];
assert(
  quotedThreadMatches.length === 0,
  "Cero reglas .quoted-thread (era 1)"
);

// === GRUPO 3: NO hay .message-block* ===
console.log("\n[FIX 3] NO debe haber reglas .message-block*");
const messageBlockMatches = stylesContent.match(/^\.message-block[^,{]*[\s,{]/gm) || [];
assert(
  messageBlockMatches.length === 0,
  "Cero reglas .message-block* (era 1 + 12 sub-clases = 13)"
);

// === GRUPO 4: Fragmento huérfano eliminado ===
console.log("\n[FIX 4] Fragmento huérfano (gap: 6px; flex-wrap: wrap; suelto) eliminado");
// Buscar línea que empieza con "gap: 6px;" SIN indentación (huérfana).
// Líneas con indentación (dentro de reglas) son válidas.
const orphanPattern = /^gap:\s*6px;\s*$/m;
assert(
  !orphanPattern.test(stylesContent),
  "No hay línea huérfana 'gap: 6px;' sin indentación (era residuo de BEM refactor)"
);

// === GRUPO 5: Comentario del fix existe ===
console.log("\n[FIX 5] Comentario del fix existe");
assert(
  /FIX loop 36/i.test(stylesContent),
  "CSS tiene comentario 'FIX loop 36'"
);

// === GRUPO 6: El CSS activo sigue funcionando ===
console.log("\n[FIX 6] CSS activo sigue intacto (reglas usadas por HTML)");
assert(
  /\.kair-mail-detail__header\s*\{/.test(stylesContent),
  "CSS .kair-mail-detail__header sigue existiendo (usado por HTML)"
);
assert(
  /\.kair-mail-message\s*\{/.test(stylesContent),
  "CSS .kair-mail-message sigue existiendo (usado por HTML)"
);
assert(
  /\.kair-mail-message__body\s*\{/.test(stylesContent),
  "CSS .kair-mail-message__body sigue existiendo (usado por HTML)"
);

console.log("\n=== Resultado: " + passed + " OK, " + failed + " XX ===\n");

if (failed > 0) {
  console.error("FALLO: " + failed + " checks no pasaron");
  process.exit(1);
} else {
  console.log("TODOS LOS CHECKES PASARON");
  process.exit(0);
}
