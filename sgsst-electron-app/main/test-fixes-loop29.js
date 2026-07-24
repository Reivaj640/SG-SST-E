/* ============================================================
 * Test Loop 29 — Ocultar snippet cuando el mensaje está expandido
 * ============================================================
 * Acumulado: 468/468 tests OK (después de este loop)
 *
 * CONTEXTO:
 * El snippet del head y el body del details muestran el mismo texto
 * (el snippet es la primera línea del body). Cuando el mensaje está
 * expandido, el snippet es REDUNDANTE y causa duplicación visual.
 *
 * FIX (Loop 29):
 * Agregar CSS que oculta el snippet cuando el mensaje está expandido:
 *   .kair-mail-message--expanded .kair-mail-message__snippet {
 *     display: none;
 *   }
 *
 * Criterio de "listo":
 * - En mensajes expandidos (último del thread), NO se ve el snippet
 * - En mensajes colapsados, SÍ se ve el snippet
 * - El body sigue visible (no se oculta)
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

console.log("\n=== Test Loop 29 — Ocultar snippet en expandido ===\n");

// === GRUPO 1: Regla CSS existe ===
console.log("[FIX 1] CSS debe tener la regla para ocultar snippet en expandido");
assert(
  /\.kair-mail-message--expanded\s+\.kair-mail-message__snippet\s*\{[^}]*display:\s*none/.test(stylesContent),
  "CSS tiene .kair-mail-message--expanded .kair-mail-message__snippet { display: none; }"
);

// === GRUPO 2: No debe romper el body ===
console.log("\n[FIX 2] Body NO debe tener display: none (solo el snippet se oculta)");
const bodyBlock = stylesContent.match(/\.kair-mail-message__body\s*\{[^}]*\}/);
assert(
  bodyBlock && !/display:\s*none/.test(bodyBlock[0]),
  "CSS .kair-mail-message__body no tiene display: none"
);

// === GRUPO 3: El snippet colapsado sigue visible ===
console.log("\n[FIX 3] Snippet (sin modificador --expanded) debe seguir visible");
const snippetBlock = stylesContent.match(/\.kair-mail-message__snippet\s*\{[^}]*\}/);
assert(
  snippetBlock && !/display:\s*none/.test(snippetBlock[0]),
  "CSS .kair-mail-message__snippet no tiene display: none (sigue visible en colapsado)"
);

// === GRUPO 4: El comentario del fix existe ===
console.log("\n[FIX 4] Comentario del fix debe existir");
assert(
  /FIX loop 29/i.test(stylesContent),
  "CSS tiene comentario 'FIX loop 29'"
);

// === GRUPO 5: La regla está DESPUÉS de .kair-mail-message__snippet (cascada) ===
console.log("\n[FIX 5] La regla debe estar DESPUÉS de .kair-mail-message__snippet (cascada)");
const snippetIdx = stylesContent.indexOf('.kair-mail-message__snippet {');
const expandedSnippetIdx = stylesContent.indexOf('.kair-mail-message--expanded .kair-mail-message__snippet');
assert(
  snippetIdx > 0 && expandedSnippetIdx > 0 && expandedSnippetIdx > snippetIdx,
  "Regla --expanded está DESPUÉS de la regla base (cascada CSS)"
);

console.log("\n=== Resultado: " + passed + " OK, " + failed + " XX ===\n");

if (failed > 0) {
  console.error("FALLO: " + failed + " checks no pasaron");
  process.exit(1);
} else {
  console.log("TODOS LOS CHECKES PASARON");
  process.exit(0);
}
