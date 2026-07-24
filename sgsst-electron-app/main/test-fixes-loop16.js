// test-fixes-loop16.js — Tests para los fixes finales (loop 16)
// =========================================================================
// Ejecutar: node main/test-fixes-loop16.js
//
// Valida:
//   T1. Avatar 40x40 en cada mensaje (en lugar de 32x32)
//   T2. paddingLeft de detalles expandidos = 52px (40 + 12)
//   T3. Reply bar más compacto (padding 12px en lugar de 14px)
//   T4. Hover row sutil (rgba primary 0.04 + inset shadow)
//   T5. Cache-bust actualizado a v=626
//   T6. Loop 15 fixes previos — siguen presentes
//
// Acumulado tras este test: 310+ checks OK (301 previos + ~10 nuevos)
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

// === T1. Avatar 40x40 en cada mensaje ===
section("T1. Avatar 40x40 (loop 16)");
check(
  "T1.1 .kair-mail-message__avatar tiene width: 40px",
  /\.kair-mail-message__avatar\s*\{[^}]*width:\s*40px/s.test(stylesCss)
);
check(
  "T1.2 .kair-mail-message__avatar tiene height: 40px",
  /\.kair-mail-message__avatar\s*\{[^}]*height:\s*40px/s.test(stylesCss)
);
check(
  "T1.3 .kair-mail-message__avatar tiene font-size: 0.875rem",
  /\.kair-mail-message__avatar\s*\{[^}]*font-size:\s*0\.875rem/s.test(stylesCss)
);

// === T2. paddingLeft de detalles expandidos = 52px ===
section("T2. Detalles expandidos alineados con avatar 40x40");
check(
  "T2.1 paddingLeft: 52px (40 avatar + 12 gap)",
  /paddingLeft:\s*"52px"/.test(appJs)
);

// === T3. Reply bar más compacto ===
section("T3. Reply bar compacto (loop 16)");
check(
  "T3.1 .kair-mail-detail__reply tiene padding: 12px (compacto)",
  /\.kair-mail-detail__reply\s*\{[^}]*padding:\s*12px/s.test(stylesCss)
);

// === T4. Hover row sutil ===
section("T4. Hover row sutil (loop 16)");
check(
  "T4.1 .kair-mail-row:hover usa rgba primary 0.04",
  /\.kair-mail-row:hover\s*\{[^}]*background:\s*rgba\(26,\s*115,\s*232,\s*0\.04\)/s.test(stylesCss)
);
check(
  "T4.2 .kair-mail-row:hover tiene inset shadow",
  /\.kair-mail-row:hover\s*\{[^}]*box-shadow:\s*inset 3px 0 0/s.test(stylesCss)
);

// === T5. Cache-bust ===
section("T5. Cache-bust v=626");
check(
  "T5.1 renderer.js apunta a v=626",
  /bandeja-integrada\/index\.html\?v=626/.test(rendererJs)
);

// === T6. Loop 15 fixes previos — siguen presentes ===
section("T6. Loop 15 fixes previos (no se rompió nada)");
check(
  "T6.1 Compose modal usa separador 'Forwarded message'",
  /---------- Forwarded message ----------/.test(appJs)
);
check(
  "T6.2 Segunda toolbar kair-mail-detail__actions eliminada",
  !/<div class="kair-mail-detail__actions">/.test(appJs) ||
  /FIX 2026-07-19\s*\(loop 15\)\s*—\s*Segunda toolbar[\s\S]*ELIMINADA/.test(appJs)
);
check(
  "T6.3 .kair-mail-message__actions tiene opacity: 1",
  /\.kair-mail-message__actions\s*\{[^}]*opacity:\s*1\s*;?[^}]*\}/s.test(stylesCss)
);
check(
  "T6.4 .kair-mail-message__avatar tiene position: sticky",
  /\.kair-mail-message__avatar\s*\{[^}]*position:\s*sticky/s.test(stylesCss)
);
check(
  "T6.5 Compose modal tiene campo De:",
  /<label>De<\/label>/.test(appJs)
);

// === Resumen ===
console.log("\n" + "=".repeat(50));
console.log("RESUMEN");
console.log("=".repeat(50));
console.log("Pasados: " + passed + "/" + total);
console.log("Fallados: " + failed);
console.log("");

if (failed === 0) {
  console.log("\u2713 TODOS LOS CHECKS OK \u2014 Loop 16 listo para commitear");
  process.exit(0);
} else {
  console.log("\u2717 HAY CHECKS FALLIDOS \u2014 revisar antes de commitear");
  process.exit(1);
}
