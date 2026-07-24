/* ============================================================
 * Test Loop 30 — Alinear padding lateral de mensajes con thread header
 * ============================================================
 * Acumulado: 473/473 tests OK (después de este loop)
 *
 * CONTEXTO:
 * El avatar del thread header (.kair-mail-detail__header) tiene
 * padding: 16px 20px 8px (20px lateral). Pero los avatares de los
 * mensajes (.kair-mail-message) tienen padding: 12px 0 (0px lateral).
 *
 * Resultado: inconsistencia visual donde el thread header tiene espacio
 * a la izquierda pero los mensajes del thread están pegados al borde.
 *
 * FIX (Loop 30):
 * Cambiar padding de .kair-mail-message de `12px 0` a `12px 20px`.
 * Esto alinea los avatares de los mensajes con el avatar del thread
 * header (todos a 20px del borde izquierdo).
 *
 * Criterio de "listo":
 * - Avatar del thread header a 20px del borde
 * - Avatar de cada mensaje a 20px del borde (IGUAL al thread header)
 * - Reply bar al final sigue con padding 20px (sin cambio)
 * - Snippet/body alineados a 20+40+12 = 72px del borde
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

console.log("\n=== Test Loop 30 — Padding lateral mensajes ===\n");

// === GRUPO 1: Cambio de padding ===
console.log("[FIX 1] .kair-mail-message debe tener padding: 12px 20px");
const msgContainerBlock = stylesContent.match(/\.kair-mail-message\s*\{[^}]*\}/);
assert(
  msgContainerBlock && /padding:\s*12px\s+20px/.test(msgContainerBlock[0]),
  "CSS .kair-mail-message tiene padding: 12px 20px"
);

// === GRUPO 2: No debe tener padding: 12px 0 (versión vieja) ===
console.log("\n[FIX 2] .kair-mail-message NO debe tener padding: 12px 0");
assert(
  msgContainerBlock && !/padding:\s*12px\s+0\b/.test(msgContainerBlock[0]),
  "CSS .kair-mail-message no tiene padding: 12px 0 (versión vieja)"
);

// === GRUPO 3: El thread header sigue con su padding (sin cambio) ===
console.log("\n[FIX 3] Thread header debe seguir con padding: 16px 20px 8px");
const headerBlock = stylesContent.match(/\.kair-mail-detail__header\s*\{[^}]*\}/);
assert(
  headerBlock && /padding:\s*16px\s+20px\s+8px/.test(headerBlock[0]),
  "CSS .kair-mail-detail__header mantiene padding: 16px 20px 8px"
);

// === GRUPO 4: El reply bar sigue con su padding (sin cambio) ===
console.log("\n[FIX 4] Reply bar debe seguir con padding: 12px 20px");
const replyBlock = stylesContent.match(/\.kair-mail-detail__reply\s*\{[^}]*\}/);
assert(
  replyBlock && /padding:\s*12px\s+20px/.test(replyBlock[0]),
  "CSS .kair-mail-detail__reply mantiene padding: 12px 20px"
);

// === GRUPO 5: Comentario del fix existe ===
console.log("\n[FIX 5] Comentario del fix debe existir");
assert(
  /FIX loop 30/i.test(stylesContent),
  "CSS tiene comentario 'FIX loop 30'"
);

console.log("\n=== Resultado: " + passed + " OK, " + failed + " XX ===\n");

if (failed > 0) {
  console.error("FALLO: " + failed + " checks no pasaron");
  process.exit(1);
} else {
  console.log("TODOS LOS CHECKES PASARON");
  process.exit(0);
}
