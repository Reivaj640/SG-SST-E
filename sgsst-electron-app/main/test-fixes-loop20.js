// test-fixes-loop20.js — Tests para los 2 fixes visuales (loop 20)
// =========================================================================
// Ejecutar: node main/test-fixes-loop20.js
//
// Valida:
//   T1. Reply bar tiene position: sticky bottom: 0 (pegado al fondo del scroll)
//   T2. Head del mensaje tiene min-height 24px (siempre visible)
//   T3. Head del mensaje tiene flex: 0 1 auto (no flex: 1)
//   T4. Head del mensaje tiene justify-content: center
//   T5. Cache-bust actualizado a v=630
//   T6. Loop 19 fixes previos — siguen presentes
//
// Acumulado tras este test: 375+ checks OK (362 previos + ~8 nuevos)
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

var stylesCss = fs.readFileSync(
  path.join(__dirname, "..", "renderer", "bandeja-integrada", "styles.css"),
  "utf8"
);
var rendererJs = fs.readFileSync(
  path.join(__dirname, "..", "renderer.js"),
  "utf8"
);

// === T1. Reply bar tiene position: sticky bottom: 0 ===
section("T1. Reply bar sticky (loop 20)");
check(
  "T1.1 .kair-mail-detail__reply tiene position: sticky",
  /\.kair-mail-detail__reply\s*\{[^}]*position:\s*sticky/s.test(stylesCss)
);
check(
  "T1.2 .kair-mail-detail__reply tiene bottom: 0",
  /\.kair-mail-detail__reply\s*\{[^}]*bottom:\s*0/s.test(stylesCss)
);
check(
  "T1.3 .kair-mail-detail__reply tiene box-shadow (separador visual)",
  /\.kair-mail-detail__reply\s*\{[^}]*box-shadow:\s*0\s*-2px/s.test(stylesCss)
);

// === T2-T4. Head del mensaje con min-height + flex: 0 1 auto ===
section("T2. Head del mensaje visible (loop 20)");
check(
  "T2.1 .kair-mail-message__head tiene min-height: 24px",
  /\.kair-mail-message__head\s*\{[^}]*min-height:\s*24px/s.test(stylesCss)
);
check(
  "T2.2 .kair-mail-message__head tiene flex: 0 1 auto",
  /\.kair-mail-message__head\s*\{[^}]*flex:\s*0\s+1\s+auto/s.test(stylesCss)
);
check(
  "T2.3 .kair-mail-message__head tiene justify-content: center",
  /\.kair-mail-message__head\s*\{[^}]*justify-content:\s*center/s.test(stylesCss)
);

// === T5. Cache-bust ===
section("T3. Cache-bust v=630");
check(
  "T3.1 renderer.js apunta a v=630",
  /bandeja-integrada\/index\.html\?v=630/.test(rendererJs)
);

// === T6. Loop 19 fixes previos — siguen presentes ===
section("T4. Loop 19 fixes previos (no se rompi\u00f3 nada)");
check(
  "T4.1 .kair-mail-message__avatar NO tiene position: sticky",
  !/\.kair-mail-message__avatar\s*\{[^}]*position:\s*sticky/s.test(stylesCss)
);
check(
  "T4.2 .kair-mail-message__recipients tiene margin 8px 0 14px",
  /\.kair-mail-message__recipients\s*\{[^}]*margin:\s*8px\s+0\s+14px/s.test(stylesCss)
);
check(
  "T4.3 .kair-mail-message__avatar tiene margin-top: 0",
  /\.kair-mail-message__avatar\s*\{[^}]*margin-top:\s*0/s.test(stylesCss)
);

// === Resumen ===
console.log("\n" + "=".repeat(50));
console.log("RESUMEN");
console.log("=".repeat(50));
console.log("Pasados: " + passed + "/" + total);
console.log("Fallados: " + failed);
console.log("");

if (failed === 0) {
  console.log("\u2713 TODOS LOS CHECKS OK \u2014 Loop 20 listo para commitear");
  process.exit(0);
} else {
  console.log("\u2717 HAY CHECKS FALLIDOS \u2014 revisar antes de commitear");
  process.exit(1);
}
