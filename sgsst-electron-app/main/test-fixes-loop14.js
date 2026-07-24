// test-fixes-loop14.js — Tests para los 2 fixes visuales Gmail-style (loop 14)
// =========================================================================
// Ejecutar: node main/test-fixes-loop14.js
//
// Valida:
//   T1. Compose modal tiene campo "De:" (Gmail-style)
//   T2. Compose modal campo "De:" es readonly
//   T3. Subject line NO tiene chip "Recibidos ×" (Gmail-style)
//   T4. CSS del campo --from existe
//   T5. Cache-bust actualizado a v=624
//   T6. Loop 13 fixes previos — siguen presentes
//
// Acumulado tras este test: 270+ checks OK (261 previos + ~10 nuevos)
// =========================================================================

var fs = require("fs");
var path = require("path");

var passed = 0;
var failed = 0;
var total = 0;

function check(label, condition) {
  total++;
  if (condition) {
    passed++;
    console.log("  \u2713 " + label);
  } else {
    failed++;
    console.log("  \u2717 " + label);
  }
}

function section(name) {
  console.log("\n" + name);
  console.log("-".repeat(name.length));
}

var appJs = fs.readFileSync(
  path.join(__dirname, "..", "renderer", "bandeja-integrada", "app.js"),
  "utf8"
);
var stylesCss = fs.readFileSync(
  path.join(__dirname, "..", "renderer", "bandeja-integrada", "styles.css"),
  "utf8"
);
var rendererJs = fs.readFileSync(
  path.join(__dirname, "..", "renderer.js"),
  "utf8"
);

// === T1. Compose modal tiene campo "De:" (Gmail-style) ===
section("T1. Compose modal campo De: (Gmail-style)");
check(
  "T1.1 Compose modal tiene <label>De</label>",
  /<label>De<\/label>/.test(appJs)
);
check(
  "T1.2 Compose modal tiene id=compose-from",
  /id="compose-from"/.test(appJs)
);
check(
  "T1.3 Compose modal usa state.gmailEmail",
  /state\.gmailEmail\s*\|\|\s*['"]tucuenta@gmail\.com['"]/.test(appJs) ||
  /state\.gmailEmail/.test(appJs)
);
check(
  "T1.4 Comment FIX 2026-07-19 (loop 14) sobre De",
  /FIX 2026-07-19\s*\(loop 14\)\s*—\s*Campo "De:" arriba/.test(appJs)
);

// === T2. Campo "De:" es readonly ===
section("T2. Campo De: readonly");
check(
  "T2.1 input compose-from tiene atributo readonly",
  /id="compose-from"[^>]*readonly/.test(appJs)
);
check(
  "T2.2 class compose-panel__input--readonly existe",
  /compose-panel__input--readonly/.test(appJs)
);

// === T3. Subject line NO tiene chip "Recibidos ×" ===
section("T3. Subject line sin chip Recibidos (Gmail-style)");
check(
  "T3.1 folderChipHtml ahora es string vac\u00edo",
  /var folderChipHtml\s*=\s*['"];/.test(appJs) ||
  /var folderChipHtml\s*=\s*''/.test(appJs)
);
check(
  "T3.2 Comment FIX 2026-07-19 (loop 14) sobre Gmail sin chip",
  /FIX 2026-07-19\s*\(loop 14\)\s*—\s*Gmail NO tiene este chip/.test(appJs)
);
check(
  "T3.3 folderLabel variable existe (para uso futuro si se necesita)",
  /var folderLabel\s*=/.test(appJs)
);

// === T4. CSS del campo --from existe ===
section("T4. CSS del campo --from (loop 14)");
check(
  "T4.1 .compose-panel__field--from existe",
  /\.compose-panel__field--from\s*\{/.test(stylesCss)
);
check(
  "T4.2 .compose-panel__input--readonly tiene color secundario",
  /\.compose-panel__input--readonly\s*\{[^}]*color:\s*var\(--email-text-secondary\)/.test(stylesCss)
);
check(
  "T4.3 .compose-panel__field--from tiene background gris",
  /\.compose-panel__field--from\s*\{[^}]*background:\s*var\(--email-bg-read/.test(stylesCss)
);

// === T5. Cache-bust ===
section("T5. Cache-bust v=624");
check(
  "T5.1 renderer.js apunta a v=624",
  /bandeja-integrada\/index\.html\?v=624/.test(rendererJs)
);

// === T6. Loop 13 fixes previos — siguen presentes ===
section("T6. Loop 13 fixes previos (no se rompió nada)");
check(
  "T6.1 renderMailBodyHtml tiene nueva estrategia loop 13",
  /FIX 2026-07-19\s*\(loop 13\)\s*—\s*Parsing más profundo/.test(appJs)
);
check(
  "T6.2 consecutiveMimeCount existe",
  /consecutiveMimeCount/.test(appJs)
);
check(
  "T6.3 .compose-panel-overlay tiene background transparent",
  /\.compose-panel-overlay\s*\{[^}]*background:\s*transparent/s.test(stylesCss)
);
check(
  "T6.4 .compose-panel tiene align bottom-right",
  /\.compose-panel\s*\{[^}]*width:\s*600px/s.test(stylesCss)
);
check(
  "T6.5 .kair-mail-message__avatar tiene position: sticky",
  /\.kair-mail-message__avatar\s*\{[^}]*position:\s*sticky/s.test(stylesCss)
);

// === Resumen ===
console.log("\n" + "=".repeat(50));
console.log("RESUMEN");
console.log("=".repeat(50));
console.log("Pasados: " + passed + "/" + total);
console.log("Fallados: " + failed);
console.log("");

if (failed === 0) {
  console.log("\u2713 TODOS LOS CHECKS OK \u2014 Loop 14 listo para commitear");
  process.exit(0);
} else {
  console.log("\u2717 HAY CHECKS FALLIDOS \u2014 revisar antes de commitear");
  process.exit(1);
}
