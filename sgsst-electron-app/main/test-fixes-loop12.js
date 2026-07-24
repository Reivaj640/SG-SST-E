// test-fixes-loop12.js — Tests para los 3 fixes visuales Gmail-style (loop 12)
// =========================================================================
// Ejecutar: node main/test-fixes-loop12.js
//
// Valida:
//   T1. Avatar alineado — position: sticky para mantener alineado con el contenido
//   T2. Formato Gmail del body — quote colapsable con border-left + header
//   T3. Reply bar pegado al fondo del detail (no flotante)
//   T4. Cache-bust actualizado a v=622
//   T5. Loop 11b fixes previos — siguen presentes
//
// Acumulado tras este test: 230+ checks OK (218 previos + ~12 nuevos)
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

// === T1. Avatar alineado — position: sticky ===
section("T1. Avatar sticky (alineado con contenido)");
check(
  "T1.1 .kair-mail-message__avatar tiene position: sticky",
  /\.kair-mail-message__avatar\s*\{[^}]*position:\s*sticky/s.test(stylesCss)
);
check(
  "T1.2 Avatar tiene top: 8px",
  /\.kair-mail-message__avatar\s*\{[^}]*top:\s*8px/s.test(stylesCss)
);
check(
  "T1.3 Avatar tiene z-index: 1",
  /\.kair-mail-message__avatar\s*\{[^}]*z-index:\s*1/s.test(stylesCss)
);
check(
  "T1.4 Comment FIX 2026-07-19 sobre position sticky",
  /FIX 2026-07-19\s*—\s*position: sticky/.test(stylesCss)
);

// === T2. Formato Gmail del body — quote colapsable con border-left + header ===
section("T2. Formato Gmail del body (quote colapsable)");
check(
  "T2.1 renderMailBodyHtml tiene nueva estrategia loop 12",
  /FIX 2026-07-19\s*\(loop 12\)\s*—\s*Parsing más robusto/.test(appJs)
);
check(
  "T2.2 Detecta separador 'Forwarded message'",
  /Forwarded message\|Forwarded\|Message forwarded/.test(appJs)
);
check(
  "T2.3 Detecta separador de guiones (5+)",
  /separatorPattern\s*=\s*\/\^-?\{5,\}/.test(appJs) ||
  /separatorPattern\s*=\s*\/\^-?5,/.test(appJs)
);
check(
  "T2.4 Detecta separador de underscores (20+)",
  /underscorePattern\s*=\s*\/\^_\{20,\}\$/.test(appJs)
);
check(
  "T2.5 Detecta 'El X escribió:' (wrotePattern)",
  /wrotePattern\s*=\s*\/\^.*escribi/.test(appJs)
);
check(
  "T2.6 Detecta 'On X wrote:' (wrotePattern3)",
  /wrotePattern3\s*=\s*\/\^\(On/.test(appJs)
);
check(
  "T2.7 Renderiza quote colapsable con class kair-mail-quote",
  /<details class="kair-mail-quote">/.test(appJs)
);
check(
  "T2.8 Quote header se muestra si existe",
  /kair-mail-quote__header/.test(appJs)
);
check(
  "T2.9 .kair-mail-quote__header tiene border-top",
  /\.kair-mail-quote__header\s*\{[^}]*border-top:\s*1px solid/s.test(stylesCss)
);
check(
  "T2.10 .kair-mail-quote__header tiene font-style italic",
  /\.kair-mail-quote__header\s*\{[^}]*font-style:\s*italic/s.test(stylesCss)
);

// === T3. Reply bar pegado al fondo ===
section("T3. Reply bar estable (no flotante)");
check(
  "T3.1 .kair-mail-detail__reply tiene flex-shrink: 0",
  /\.kair-mail-detail__reply\s*\{[\s\S]*?flex-shrink:\s*0/.test(stylesCss)
);
check(
  "T3.2 .kair-mail-detail__reply tiene background blanco",
  /\.kair-mail-detail__reply\s*\{[^}]*background:\s*#fff/s.test(stylesCss)
);

// === T4. Cache-bust ===
section("T4. Cache-bust v=622");
check(
  "T4.1 renderer.js apunta a v=622",
  /bandeja-integrada\/index\.html\?v=622/.test(rendererJs)
);

// === T5. Loop 11b fixes previos — siguen presentes ===
section("T5. Loop 11b fixes previos (no se rompió nada)");
check(
  "T5.1 .kair-mail-message__sender tiene overflow-wrap: anywhere",
  /\.kair-mail-message__sender\s*\{[^}]*overflow-wrap:\s*anywhere/s.test(stylesCss)
);
check(
  "T5.2 .kair-mail-message__subject tiene overflow-wrap: anywhere",
  /\.kair-mail-message__subject\s*\{[^}]*overflow-wrap:\s*anywhere/s.test(stylesCss)
);
check(
  "T5.3 Recipients usa SVG polyline (no ▾ Unicode)",
  /<svg\s+class="kair-mail-message__recipients-arrow"[^>]*>\s*<polyline points="6 9 12 15 18 9">/.test(appJs)
);
check(
  "T5.4 .kair-mail-message__more-dots existe",
  /\.kair-mail-message__more-dots\s*\{/.test(stylesCss)
);
check(
  "T5.5 Subject limpia Re:/Fwd:",
  /\^\(\\s\*\(Re\|Fwd\|RE\|FW\)\\s\*:\\s\*\)\+/.test(appJs)
);

// === Resumen ===
console.log("\n" + "=".repeat(50));
console.log("RESUMEN");
console.log("=".repeat(50));
console.log("Pasados: " + passed + "/" + total);
console.log("Fallados: " + failed);
console.log("");

if (failed === 0) {
  console.log("\u2713 TODOS LOS CHECKS OK \u2014 Loop 12 listo para commitear");
  process.exit(0);
} else {
  console.log("\u2717 HAY CHECKS FALLIDOS \u2014 revisar antes de commitear");
  process.exit(1);
}
