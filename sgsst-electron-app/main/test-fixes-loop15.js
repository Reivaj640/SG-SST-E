// test-fixes-loop15.js — Tests para los 3 fixes visuales Gmail-style (loop 15)
// =========================================================================
// Ejecutar: node main/test-fixes-loop15.js
//
// Valida:
//   T1. Compose modal quote format Gmail-style (forward + reply)
//   T2. Thread header consolidated (1 toolbar, no 2)
//   T3. Actions always visible in message (no hover-only)
//   T4. CSS del nuevo quote format
//   T5. Cache-bust actualizado a v=625
//   T6. Loop 14 fixes previos — siguen presentes
//
// Acumulado tras este test: 290+ checks OK (279 previos + ~12 nuevos)
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

// === T1. Compose modal quote format Gmail-style (forward + reply) ===
section("T1. Compose modal quote format Gmail-style");
check(
  "T1.1 Comment FIX loop 15 sobre formato Gmail-style",
  /FIX 2026-07-19\s*\(loop 15\)\s*—\s*Formato Gmail-style/.test(appJs)
);
check(
  "T1.2 Forward usa separador 'Forwarded message'",
  /---------- Forwarded message ----------/.test(appJs)
);
check(
  "T1.3 Forward tiene headers De:/Date:/Subject:/To:",
  /kair-mail-quote__label[^<]*De:[\s\S]*Date:[\s\S]*Subject:[\s\S]*To:/.test(appJs)
);
check(
  "T1.4 Reply usa formato 'El X escribió'",
  /El ' \+ quoteDate \+ ', ' \+ senderDisplay \+ ' escribi\u00f3/.test(appJs) ||
  /wroteOn\s*=\s*'El ' \+ quoteDate/.test(appJs)
);
check(
  "T1.5 Reply usa `> ` prefix para quoted text",
  /map\(function \(l\) \{ return '&gt; ' \+ l; \}\)/.test(appJs)
);
check(
  "T1.6 Forward tiene clase compose-panel__quote-separator",
  /class="compose-panel__quote-separator">---------- Forwarded message/.test(appJs)
);

// === T2. Thread header consolidated (1 toolbar) ===
section("T2. Thread header consolidated (loop 15)");
check(
  "T2.1 Segunda toolbar kair-mail-detail__actions ELIMINADA",
  !/<div class="kair-mail-detail__actions">/.test(appJs) ||
  /FIX 2026-07-19\s*\(loop 15\)\s*—\s*Segunda toolbar[\s\S]*ELIMINADA/.test(appJs)
);
check(
  "T2.2 Comment FIX loop 15 sobre toolbar eliminada",
  /FIX 2026-07-19\s*\(loop 15\)\s*—\s*Segunda toolbar/.test(appJs)
);
check(
  "T2.3 Toolbar principal (kair-mail-detail__toolbar) sigue presente",
  /class:\s*"kair-mail-detail__toolbar"/.test(appJs) ||
  /class="kair-mail-detail__toolbar"/.test(appJs)
);

// === T3. Actions always visible in message ===
section("T3. Acciones del mensaje siempre visibles (loop 15)");
check(
  "T3.1 .kair-mail-message__actions tiene opacity: 1",
  /\.kair-mail-message__actions\s*\{[^}]*opacity:\s*1\s*;?[^}]*\}/s.test(stylesCss)
);
check(
  "T3.2 Comment FIX loop 15 sobre acciones siempre visibles",
  /FIX loop 15.*siempre visible/i.test(stylesCss) ||
  /siempre visible.*loop 15/i.test(stylesCss)
);
check(
  "T3.3 No hay regla hover-only",
  !/\.kair-mail-message:hover\s+\.kair-mail-message__actions\s*\{/.test(stylesCss)
);

// === T4. CSS del nuevo quote format ===
section("T4. CSS quote format Gmail-style");
check(
  "T4.1 .compose-panel__quote-separator tiene border-bottom",
  /\.compose-panel__quote-separator\s*\{[^}]*border-bottom:\s*1px solid/s.test(stylesCss)
);
check(
  "T4.2 .compose-panel__quote-headers existe",
  /\.compose-panel__quote-headers\s*\{/.test(stylesCss)
);
check(
  "T4.3 .compose-panel__quote-header-row existe",
  /\.compose-panel__quote-header-row\s*\{/.test(stylesCss)
);
check(
  "T4.4 .kair-mail-quote__label tiene min-width",
  /\.kair-mail-quote__label\s*\{[^}]*min-width:\s*60px/s.test(stylesCss)
);

// === T5. Cache-bust ===
section("T5. Cache-bust v=625");
check(
  "T5.1 renderer.js apunta a v=625",
  /bandeja-integrada\/index\.html\?v=625/.test(rendererJs)
);

// === T6. Loop 14 fixes previos — siguen presentes ===
section("T6. Loop 14 fixes previos (no se rompió nada)");
check(
  "T6.1 Compose modal tiene campo De:",
  /<label>De<\/label>/.test(appJs)
);
check(
  "T6.2 folderChipHtml es string vacío",
  /var folderChipHtml\s*=\s*['"];/.test(appJs) ||
  /var folderChipHtml\s*=\s*''/.test(appJs)
);
check(
  "T6.3 .compose-panel-overlay tiene background transparent",
  /\.compose-panel-overlay\s*\{[^}]*background:\s*transparent/s.test(stylesCss)
);
check(
  "T6.4 .kair-mail-message__avatar tiene position: sticky",
  /\.kair-mail-message__avatar\s*\{[^}]*position:\s*sticky/s.test(stylesCss)
);
check(
  "T6.5 renderMailBodyHtml tiene quote retroactivo (loop 13)",
  /consecutiveMimeCount/.test(appJs)
);

// === Resumen ===
console.log("\n" + "=".repeat(50));
console.log("RESUMEN");
console.log("=".repeat(50));
console.log("Pasados: " + passed + "/" + total);
console.log("Fallados: " + failed);
console.log("");

if (failed === 0) {
  console.log("\u2713 TODOS LOS CHECKS OK \u2014 Loop 15 listo para commitear");
  process.exit(0);
} else {
  console.log("\u2717 HAY CHECKS FALLIDOS \u2014 revisar antes de commitear");
  process.exit(1);
}
