/* ============================================================
 * Test Loop 31 — Quote colapsable con mejor contraste visual
 * ============================================================
 * Acumulado: 478/478 tests OK (después de este loop)
 *
 * CONTEXTO:
 * El quote colapsable (··· N líneas citadas) se ve poco contrastado:
 * - Fondo gris muy claro (#f8f9fa) sobre fondo blanco
 * - Borde izquierdo gris (#dee2e6) sin color distintivo
 * - Label con font-weight 500 (no muy prominente)
 *
 * FIX (Loop 31):
 * - Fondo ligeramente más oscuro (#f0f4f9) con tinte azul
 * - Borde izquierdo azul (4px solid #1a73e8) en lugar de gris
 * - Label con font-weight 600 (más bold)
 * - Hover state con fondo más oscuro (#e8eef5)
 *
 * Criterio de "listo":
 * - Quote con fondo visible y borde azul distintivo
 * - Label "··· N líneas citadas" prominente (font-weight 600)
 * - Hover state con cambio visible
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

console.log("\n=== Test Loop 31 — Quote colapsable mejor contraste ===\n");

// === GRUPO 1: Fondo del quote mejorado ===
console.log("[FIX 1] .kair-mail-quote tiene fondo mejorado (azul-gris)");
const quoteBlock = stylesContent.match(/\.kair-mail-quote\s*\{[^}]*\}/);
assert(
  quoteBlock && /background:\s*var\(--kair-bg-quote|#f0f4f9|#eef3f7/i.test(quoteBlock[0]),
  "CSS .kair-mail-quote tiene fondo con tinte azul"
);

// === GRUPO 2: Borde izquierdo azul (color accent) ===
console.log("\n[FIX 2] .kair-mail-quote tiene borde izquierdo azul");
assert(
  quoteBlock && /border-left:\s*\d+px\s+solid\s+(#1a73e8|var\(--kair-primary|var\(--email-accent)/i.test(quoteBlock[0]),
  "CSS .kair-mail-quote tiene border-left azul (4px solid #1a73e8 o similar)"
);

// === GRUPO 3: Label con font-weight 600 ===
console.log("\n[FIX 3] .kair-mail-quote summary tiene font-weight 600");
const summaryBlock = stylesContent.match(/\.kair-mail-quote\s+summary\s*\{[^}]*\}/);
assert(
  summaryBlock && /font-weight:\s*600/.test(summaryBlock[0]),
  "CSS .kair-mail-quote summary tiene font-weight: 600"
);

// === GRUPO 4: Hover state mejorado ===
console.log("\n[FIX 4] .kair-mail-quote summary:hover tiene fondo mejorado");
const hoverBlock = stylesContent.match(/\.kair-mail-quote\s+summary:hover\s*\{[^}]*\}/);
assert(
  hoverBlock && /background:/.test(hoverBlock[0]),
  "CSS .kair-mail-quote summary:hover tiene background"
);

// === GRUPO 5: Comentario del fix existe ===
console.log("\n[FIX 5] Comentario del fix debe existir");
assert(
  /FIX loop 31/i.test(stylesContent),
  "CSS tiene comentario 'FIX loop 31'"
);

console.log("\n=== Resultado: " + passed + " OK, " + failed + " XX ===\n");

if (failed > 0) {
  console.error("FALLO: " + failed + " checks no pasaron");
  process.exit(1);
} else {
  console.log("TODOS LOS CHECKES PASARON");
  process.exit(0);
}
