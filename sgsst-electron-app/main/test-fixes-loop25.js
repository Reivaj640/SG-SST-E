// test-fixes-loop25.js — Tests para el refactor con flex-wrap (loop 25)
// =========================================================================
// Ejecutar: node main/test-fixes-loop25.js
//
// Valida:
//   T1. .kair-mail-message tiene display: flex + flex-wrap: wrap (más simple que loop 22)
//   T2. msgDetails tiene flex: 0 0 100% (fuerza a un nuevo row con flex-wrap)
//   T3. NO hay .kair-mail-message__row (revertido del loop 22)
//   T4. Head tiene flex: 1 1 calc(100% - 40px - 12px)
//   T5. Cache-bust actualizado a v=635
//   T6. Loop 24 fixes previos — siguen presentes
//
// Acumulado tras este test: 430+ checks OK (422 previos + ~5 nuevos)
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

// === T1. .kair-mail-message tiene display: flex + flex-wrap: wrap ===
section("T1. .kair-mail-message con flex-wrap (loop 25)");
check(
  "T1.1 .kair-mail-message tiene display: flex",
  /\.kair-mail-message\s*\{[^}]*display:\s*flex/s.test(stylesCss)
);
check(
  "T1.2 .kair-mail-message tiene flex-wrap: wrap",
  /\.kair-mail-message\s*\{[^}]*flex-wrap:\s*wrap/s.test(stylesCss)
);

// === T2. msgDetails tiene flex: 0 0 100% ===
section("T2. msgDetails con flex: 0 0 100% (loop 25)");
check(
  "T2.1 msgDetails tiene flex: '0 0 100%'",
  /flex:\s*"0 0 100%"/.test(appJs)
);

// === T3. NO hay .kair-mail-message__row ===
section("T3. .kair-mail-message__row ELIMINADO (loop 25)");
check(
  "T3.1 NO hay .kair-mail-message__row en CSS",
  !/\.kair-mail-message__row\s*\{/.test(stylesCss)
);
check(
  "T3.2 NO hay msgRow1.appendChild en app.js",
  !/msgRow1\.appendChild/.test(appJs)
);

// === T4. Head con flex: 1 1 calc ===
section("T4. Head con flex: 1 1 calc (loop 25)");
check(
  "T4.1 .kair-mail-message__head tiene flex: 1 1 calc",
  /\.kair-mail-message__head\s*\{[^}]*flex:\s*1\s+1\s+calc/s.test(stylesCss)
);

// === T5. Cache-bust ===
section("T5. Cache-bust v=635");
check(
  "T5.1 renderer.js apunta a v=635",
  /bandeja-integrada\/index\.html\?v=635/.test(rendererJs)
);

// === T6. Loop 24 fixes previos — siguen presentes ===
section("T6. Loop 24 fixes previos (no se rompi\u00f3 nada)");
check(
  "T6.1 .kair-mail-message__body tiene max-width",
  /\.kair-mail-message__body\s*\{[^}]*max-width:/s.test(stylesCss)
);
check(
  "T6.2 detail.appendChild(reply) presente",
  /detail\.appendChild\(reply\)/.test(appJs)
);
check(
  "T6.3 .kair-mail-detail__reply tiene position: sticky",
  /\.kair-mail-detail__reply\s*\{[^}]*position:\s*sticky/s.test(stylesCss)
);

// === Resumen ===
console.log("\n" + "=".repeat(50));
console.log("RESUMEN");
console.log("=".repeat(50));
console.log("Pasados: " + passed + "/" + total);
console.log("Fallados: " + failed);
console.log("");

if (failed === 0) {
  console.log("\u2713 TODOS LOS CHECKS OK \u2014 Loop 25 listo para commitear");
  process.exit(0);
} else {
  console.log("\u2717 HAY CHECKS FALLIDOS \u2014 revisar antes de commitear");
  process.exit(1);
}
