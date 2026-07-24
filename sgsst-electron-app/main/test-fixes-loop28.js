/* ============================================================
 * Test Loop 28 — Limpieza de código muerto + fix desalineamiento head/body
 * ============================================================
 * Acumulado: 460/460 tests OK (después de este loop)
 *
 * CONTEXTO:
 * El bug visual "head y body desalineados" en el detalle del correo se debe a:
 *   - .kair-mail-message__body tiene padding-left: 52px + margin-left: 52px (104px total)
 *   - .msgDetails inline tiene paddingLeft: 52px (52px adicionales)
 *   - Total: 156px desde msgContainer
 *   - Pero el head (kair-mail-message__head) está a solo 52px
 *   - DIFERENCIA: 104px (lo que se ve en el screenshot del user)
 *
 * CÓDIGO MUERTO IDENTIFICADO:
 *   - setTimeout zombie con data-action="archive|mark-unread|delete|star" (selectores no existen)
 *   - position sticky en .kair-mail-detail__reply (loop 20 revirtió en loop 23)
 *   - padding: 0; opacity: 1; defaults en .kair-mail-message__actions
 *   - CSS duplicado de .kair-mail-detail__* (1927-2005 vs 3179-3360)
 *   - Inline styles redundantes en wrapper y nav (la clase Tailwind ya hace eso)
 *
 * FIX:
 *   - .kair-mail-message__body: quitar padding-left: 52px + margin-left: 52px
 *     (queda solo max-width: 720px + margin-right: auto, alineado por el details padding)
 *   - .kair-mail-message__details (CSS nuevo): padding-left: 52px; flex: 0 0 100%
 *     (mueve lo que estaba inline en JS a CSS)
 * ============================================================ */

const fs = require('fs');
const path = require('path');

const APP_JS = path.join(__dirname, '..', 'renderer', 'bandeja-integrada', 'app.js');
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

const appContent = fs.readFileSync(APP_JS, 'utf8');
const stylesContent = fs.readFileSync(STYLES_CSS, 'utf8');

console.log("\n=== Test Loop 28 — Limpieza + Fix desalineamiento ===\n");

// === GRUPO 1: FIX VISUAL (doble padding en body) ===
console.log("[FIX 1] .kair-mail-message__body NO debe tener padding-left: 52px");
assert(
  !/\.kair-mail-message__body\s*\{[^}]*padding-left:\s*52px/.test(stylesContent),
  "CSS no tiene padding-left: 52px en .kair-mail-message__body"
);

console.log("[FIX 2] .kair-mail-message__body NO debe tener margin-left: 52px");
assert(
  !/\.kair-mail-message__body\s*\{[^}]*margin-left:\s*52px/.test(stylesContent),
  "CSS no tiene margin-left: 52px en .kair-mail-message__body"
);

console.log("[FIX 3] .kair-mail-message__body debe mantener max-width: 720px");
assert(
  /\.kair-mail-message__body\s*\{[^}]*max-width:\s*720px/.test(stylesContent),
  "CSS mantiene max-width: 720px en .kair-mail-message__body"
);

console.log("[FIX 4] .kair-mail-message__details (CSS) debe tener padding-left: 52px + flex: 0 0 100%");
assert(
  /\.kair-mail-message__details\s*\{[^}]*padding-left:\s*52px/.test(stylesContent),
  "CSS .kair-mail-message__details tiene padding-left: 52px"
);
assert(
  /\.kair-mail-message__details\s*\{[^}]*flex:\s*0 0 100%/.test(stylesContent),
  "CSS .kair-mail-message__details tiene flex: 0 0 100%"
);

// === GRUPO 2: LIMPIEZA DE CÓDIGO MUERTO ===
console.log("\n[LIMPIEZA 1] JS NO debe tener setTimeout zombie buscando data-action archive|mark-unread|delete|star");
const zombiePattern = /setTimeout\(function\s*\(\)\s*\{[\s\S]*?header\.querySelector\('\[data-action="archive"\]'\)[\s\S]*?data-action="mark-unread"[\s\S]*?data-action="delete"[\s\S]*?data-action="star"[\s\S]*?\}\s*,\s*0\)/;
assert(
  !zombiePattern.test(appContent),
  "JS no tiene el setTimeout zombie de data-action"
);

console.log("[LIMPIEZA 2] CSS .kair-mail-detail__reply NO debe tener position: sticky");
const replyBlock = stylesContent.match(/\.kair-mail-detail__reply\s*\{[^}]*\}/);
assert(
  replyBlock && !/position:\s*sticky/.test(replyBlock[0]),
  "CSS .kair-mail-detail__reply no tiene position: sticky"
);

console.log("[LIMPIEZA 3] CSS .kair-mail-message__actions NO debe tener padding: 0; opacity: 1 (defaults)");
const actionsBlock = stylesContent.match(/\.kair-mail-message__actions\s*\{[^}]*\}/);
assert(
  actionsBlock && !/padding:\s*0/.test(actionsBlock[0]),
  "CSS .kair-mail-message__actions no tiene padding: 0"
);
assert(
  actionsBlock && !/opacity:\s*1/.test(actionsBlock[0]),
  "CSS .kair-mail-message__actions no tiene opacity: 1"
);

console.log("[LIMPIEZA 4] JS inline del msgDetails NO debe tener paddingLeft: 52px (movido a CSS)");
assert(
  !/msgDetails[\s\S]*?paddingLeft:\s*"52px"/.test(appContent),
  "JS msgDetails inline no tiene paddingLeft: 52px"
);

console.log("[LIMPIEZA 5] CSS bloque duplicado (1927-2005) NO debe estar presente");
const duplicatedBlock = stylesContent.match(/\.kair-mail-detail__subject\s*\{[^}]*letter-spacing:\s*-0\.018em[^}]*\}/g);
assert(
  duplicatedBlock && duplicatedBlock.length === 1,
  "CSS .kair-mail-detail__subject aparece solo 1 vez (no duplicado)"
);

console.log("\n=== Resultado: " + passed + " OK, " + failed + " XX ===\n");

if (failed > 0) {
  console.error("FALLO: " + failed + " checks no pasaron");
  process.exit(1);
} else {
  console.log("TODOS LOS CHECKES PASARON");
  process.exit(0);
}
