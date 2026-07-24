/* ============================================================
 * Test Loop 32 — "Para: x" colapsable unificado
 * ============================================================
 * Acumulado: 483/483 tests OK (después de este loop)
 *
 * CONTEXTO:
 * El thread header (.kair-mail-detail__header) muestra los recipients
 * del último mensaje (Para: x, CC: y) — agregado en loop 26.
 *
 * Pero el último mensaje del thread (expandido por default) también
 * renderiza su propio "para: x ▾" colapsable. Esto causa DUPLICACIÓN
 * visual: el mismo destinatario aparece dos veces (en el thread header
 * y en el mensaje individual).
 *
 * FIX (Loop 32):
 * No renderizar el recipientsDetails del mensaje si es el último
 * (porque el thread header ya lo muestra).
 *
 * Criterio de "listo":
 * - Mensaje ÚLTIMO (expandido): NO muestra "para: x" propio
 * - Mensaje NO-ÚLTIMO colapsado: NO muestra nada (display: none)
 * - Mensaje NO-ÚLTIMO expandido (al hacer click): SÍ muestra "para: x"
 * - Thread header SIEMPRE muestra los recipients del último mensaje
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

console.log("\n=== Test Loop 32 — 'Para: x' colapsable unificado ===\n");

// === GRUPO 1: Condición del recipientsDetails incluye isLastMessage ===
console.log("[FIX 1] Render de recipients debe excluir isLastMessage");
const recipientsBlock = appContent.match(
  /var toListParsed = parseToListFromMsg\(msg\);[\s\S]*?if \(toListParsed\.length > 0[^}]*\) \{/
);
assert(
  recipientsBlock !== null,
  "Encontrado el bloque de render de recipients"
);

const usesLastMessageGuard = recipientsBlock &&
  /!isLastMessage/.test(recipientsBlock[0]);
assert(
  usesLastMessageGuard,
  "Condición incluye !isLastMessage (no renderiza recipients si es último)"
);

// === GRUPO 2: El bloque sigue creando recipientsDetails ===
console.log("\n[FIX 2] El bloque sigue creando recipientsDetails (para no-último)");
assert(
  /var recipientsDetails = el\("details",\s*\{\s*class:\s*"kair-mail-message__recipients"\s*\}\)/.test(appContent),
  "Código sigue creando recipientsDetails (para mensajes no-último expandidos)"
);

// === GRUPO 3: El thread header sigue mostrando recipients (loop 26) ===
console.log("\n[FIX 3] Thread header sigue mostrando recipients (loop 26 intacto)");
assert(
  /kair-mail-detail__recipient-row/.test(appContent) && /Para:<\/span>/.test(appContent),
  "Thread header sigue mostrando Para: (loop 26 intacto)"
);

// === GRUPO 4: Comentario del fix existe ===
console.log("\n[FIX 4] Comentario del fix debe existir");
assert(
  /FIX loop 32/i.test(appContent),
  "JS tiene comentario 'FIX loop 32'"
);

console.log("\n=== Resultado: " + passed + " OK, " + failed + " XX ===\n");

if (failed > 0) {
  console.error("FALLO: " + failed + " checks no pasaron");
  process.exit(1);
} else {
  console.log("TODOS LOS CHECKES PASARON");
  process.exit(0);
}
