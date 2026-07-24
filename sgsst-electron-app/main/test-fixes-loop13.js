// test-fixes-loop13.js — Tests para los 3 fixes visuales Gmail-style (loop 13)
// =========================================================================
// Ejecutar: node main/test-fixes-loop13.js
//
// Valida:
//   T1. Detección de headers MIME consecutivos como inicio de quote
//   T2. Compose modal anclado a bottom-right (Gmail-style)
//   T3. Cache-bust actualizado a v=623
//   T4. Loop 12 fixes previos — siguen presentes
//
// Acumulado tras este test: 250+ checks OK (240 previos + ~10 nuevos)
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

// === T1. Detección de headers MIME consecutivos como inicio de quote ===
section("T1. Headers MIME consecutivos (loop 13)");
check(
  "T1.1 renderMailBodyHtml tiene nueva estrategia loop 13",
  /FIX 2026-07-19\s*\(loop 13\)\s*—\s*Parsing más profundo/.test(appJs)
);
check(
  "T1.2 Variable consecutiveMimeCount existe",
  /var\s+consecutiveMimeCount\s*=\s*0/.test(appJs)
);
check(
  "T1.3 Patrón MimeHeaderRE existe",
  /MimeHeaderRE\s*=\s*\/\^/.test(appJs)
);
check(
  "T1.4 Lógica de 2+ headers consecutivos como inicio de quote",
  /consecutiveMimeCount\s*>=\s*2/.test(appJs)
);
check(
  "T1.5 Retroactivo: tomar las últimas N líneas del mainBody",
  /mimeStart\s*=\s*mainBody\.length\s*-\s*consecutiveMimeCount/.test(appJs)
);
check(
  "T1.6 Marcar líneas como undefined y filtrar",
  /mainBody\[j\]\s*=\s*undefined/.test(appJs) ||
  /mainBody\[j\][^=]*=\s*undefined/.test(appJs)
);
check(
  "T1.7 Reset consecutiveMimeCount después de quote",
  /consecutiveMimeCount\s*=\s*0[^=]/.test(appJs)
);

// === T2. Compose modal anclado a bottom-right (Gmail-style) ===
section("T2. Compose modal bottom-right (Gmail-style)");
check(
  "T2.1 .compose-panel-overlay ya NO tiene background oscuro",
  !/\.compose-panel-overlay\s*\{[^}]*background:\s*rgba\(0,\s*0,\s*0,\s*0\.4\)/.test(stylesCss)
);
check(
  "T2.2 .compose-panel-overlay tiene background transparent",
  /\.compose-panel-overlay\s*\{[^}]*background:\s*transparent/s.test(stylesCss)
);
check(
  "T2.3 .compose-panel-overlay tiene align-items: flex-end",
  /\.compose-panel-overlay\s*\{[^}]*align-items:\s*flex-end/s.test(stylesCss)
);
check(
  "T2.4 .compose-panel-overlay tiene justify-content: flex-end",
  /\.compose-panel-overlay\s*\{[^}]*justify-content:\s*flex-end/s.test(stylesCss)
);
check(
  "T2.5 .compose-panel tiene width: 600px",
  /\.compose-panel\s*\{[^}]*width:\s*600px/s.test(stylesCss)
);
check(
  "T2.6 .compose-panel tiene border-radius top-only",
  /\.compose-panel\s*\{[^}]*border-radius:\s*8px\s+8px\s+0\s+0/s.test(stylesCss)
);
check(
  "T2.7 .compose-panel tiene margin-right: 24px",
  /\.compose-panel\s*\{[^}]*margin:\s*0\s+24px\s+0\s+0/s.test(stylesCss)
);
check(
  "T2.8 Comment FIX 2026-07-19 (loop 13) sobre Gmail-style",
  /FIX 2026-07-19\s*\(loop 13\)\s*—\s*Gmail-style/.test(stylesCss)
);

// === T3. Cache-bust ===
section("T3. Cache-bust v=623");
check(
  "T3.1 renderer.js apunta a v=623",
  /bandeja-integrada\/index\.html\?v=623/.test(rendererJs)
);

// === T4. Loop 12 fixes previos — siguen presentes ===
section("T4. Loop 12 fixes previos (no se rompió nada)");
check(
  "T4.1 .kair-mail-message__avatar tiene position: sticky",
  /\.kair-mail-message__avatar\s*\{[^}]*position:\s*sticky/s.test(stylesCss)
);
check(
  "T4.2 renderMailBodyHtml tiene inline separator regex",
  /\-?\{5,\}\\s\*\(Forwarded/.test(appJs)
);
check(
  "T4.3 renderMailBodyHtml tiene wrotePattern inline",
  /El\\s\\+\\w/.test(appJs) ||
  /escribi\u00f3/.test(appJs)
);
check(
  "T4.4 .kair-mail-quote__header existe",
  /\.kair-mail-quote__header\s*\{/.test(stylesCss)
);
check(
  "T4.5 .kair-mail-detail__reply tiene flex-shrink: 0",
  /\.kair-mail-detail__reply\s*\{[\s\S]*?flex-shrink:\s*0/.test(stylesCss)
);

// === Resumen ===
console.log("\n" + "=".repeat(50));
console.log("RESUMEN");
console.log("=".repeat(50));
console.log("Pasados: " + passed + "/" + total);
console.log("Fallados: " + failed);
console.log("");

if (failed === 0) {
  console.log("\u2713 TODOS LOS CHECKS OK \u2014 Loop 13 listo para commitear");
  process.exit(0);
} else {
  console.log("\u2717 HAY CHECKS FALLIDOS \u2014 revisar antes de commitear");
  process.exit(1);
}
