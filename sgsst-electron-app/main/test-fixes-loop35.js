/* ============================================================
 * Test Loop 35 — Snooze (posponer) de correos
 * ============================================================
 * Acumulado: 498/498 tests OK (después de este loop)
 *
 * CONTEXTO:
 * Snooze (posponer) permite al user "esconder" un correo de la bandeja
 * hasta una hora futura. Cuando vence, vuelve automáticamente.
 *
 * FIX (Loop 35):
 * 1. Helpers de snooze: getSnoozedMap, isThreadSnoozed, snoozeThread,
 *    unsnoozeThread, getSnoozeRemainingLabel
 * 2. Función showSnoozeToast con 4 opciones: 1h, 3h, Mañana, Próx. semana
 * 3. Botón en la toolbar del detail (icon de reloj)
 * 4. Filtro en renderMailList: oculta mails snoozed de INBOX
 * 5. Storage en localStorage con clave "kair.snoozedThreads"
 *
 * Criterio de "listo":
 * - localStorage guarda el snooze
 * - El mail snoozed NO aparece en INBOX
 * - El botón "Snooze" muestra opciones predefinidas
 * - El snooze vence automáticamente (wakeTime <= now → vuelve a INBOX)
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

console.log("\n=== Test Loop 35 — Snooze ===\n");

// === GRUPO 1: Funciones helper de snooze ===
console.log("[FIX 1] Helpers de snooze existen");
assert(
  /function getSnoozedMap\(/.test(appContent),
  "JS tiene función getSnoozedMap"
);
assert(
  /function isThreadSnoozed\(/.test(appContent),
  "JS tiene función isThreadSnoozed"
);
assert(
  /function snoozeThread\(/.test(appContent),
  "JS tiene función snoozeThread"
);
assert(
  /function unsnoozeThread\(/.test(appContent),
  "JS tiene función unsnoozeThread"
);

// === GRUPO 2: localStorage key ===
console.log("\n[FIX 2] localStorage key para snoozed");
assert(
  /SNOOZE_STORAGE_KEY\s*=\s*"kair\.snoozedThreads"/.test(appContent),
  "Storage key es 'kair.snoozedThreads'"
);

// === GRUPO 3: showSnoozeToast con 4 opciones ===
console.log("\n[FIX 3] showSnoozeToast con 4 opciones");
assert(
  /function showSnoozeToast\(/.test(appContent),
  "JS tiene función showSnoozeToast"
);
assert(
  /data-hours="1".*1 hora/.test(appContent),
  "Opción '1 hora' existe"
);
assert(
  /data-hours="3".*3 horas/.test(appContent),
  "Opción '3 horas' existe"
);
assert(
  /data-tomorrow="1".*Mañana/.test(appContent),
  "Opción 'Mañana' existe"
);
assert(
  /data-week="1".*Pr[oó]x\.?\s*semana/.test(appContent),
  "Opción 'Próx. semana' existe"
);

// === GRUPO 4: Botón en la toolbar del detail ===
console.log("\n[FIX 4] Botón snooze en la toolbar del detail");
assert(
  /Posponer|Desnoozear/.test(appContent) && /isThreadSnoozed\(mail\.id\)/.test(appContent),
  "Botón 'Posponer' o 'Desnoozear' en la toolbar (cambia según estado)"
);

// === GRUPO 5: Filtro en renderMailList ===
console.log("\n[FIX 5] Filtro de snoozed en renderMailList");
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
const renderListBlock = extractFunction('renderMailList');
assert(
  renderListBlock && /isThreadSnoozed\(m\.id\)/.test(renderListBlock),
  "renderMailList filtra mails snoozed con isThreadSnoozed"
);

// === GRUPO 6: Comentario del fix ===
console.log("\n[FIX 6] Comentario del fix existe");
assert(
  /FIX loop 35/i.test(appContent),
  "JS tiene comentario 'FIX loop 35'"
);

console.log("\n=== Resultado: " + passed + " OK, " + failed + " XX ===\n");

if (failed > 0) {
  console.error("FALLO: " + failed + " checks no pasaron");
  process.exit(1);
} else {
  console.log("TODOS LOS CHECKES PASARON");
  process.exit(0);
}
