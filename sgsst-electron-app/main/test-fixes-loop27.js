// test-fixes-loop27.js — Test del fix del head se oculta (loop 27)
// =========================================================================
// Ejecutar: node main/test-fixes-loop27.js
//
// Valida:
//   T1. .kair-mail-message__head tiene flex: 0 0 (NO flex: 1 1)
//   T2. El flex-basis es calc(100% - 40px - 12px)
//   T3. Cache-bust actualizado a v=637
//   T4. Loop 25 fixes previos — siguen presentes
//
// Criterio de "listo" (Fase 3):
// - El head se ve SIEMPRE (colapsado y expandido)
// - El avatar está al lado del head
// - El details está debajo con padding-left: 52px
//
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

// === T1. Head tiene flex: 0 0 (NO flex: 1 1) ===
section("T1. Head con flex: 0 0 (loop 27)");
check(
  "T1.1 .kair-mail-message__head tiene flex: 0 0",
  /\.kair-mail-message__head\s*\{[^}]*flex:\s*0\s+0\s+calc/s.test(stylesCss)
);
check(
  "T1.2 .kair-mail-message__head NO tiene flex: 1 1 activo (sin contar comentarios)",
  !/\.kair-mail-message__head\s*\{[^\/\*]*flex:\s*1\s+1\s+calc/.test(stylesCss)
);

// === T2. El flex-basis es calc(100% - 40px - 12px) ===
section("T2. flex-basis correcto (loop 27)");
check(
  "T2.1 flex: 0 0 calc(100% - 40px - 12px)",
  /\.kair-mail-message__head\s*\{[^}]*flex:\s*0\s+0\s+calc\(100%\s*-\s*40px\s*-\s*12px\)/.test(stylesCss)
);

// === T3. Cache-bust ===
section("T3. Cache-bust v=637");
check(
  "T3.1 renderer.js apunta a v=637",
  /bandeja-integrada\/index\.html\?v=637/.test(rendererJs)
);

// === T4. Loop 25 fixes previos — siguen presentes ===
section("T4. Loop 25 fixes previos (no se rompi\u00f3 nada)");
check(
  "T4.1 .kair-mail-message tiene display: flex",
  /\.kair-mail-message\s*\{[^}]*display:\s*flex/s.test(stylesCss)
);
check(
  "T4.2 .kair-mail-message tiene flex-wrap: wrap",
  /\.kair-mail-message\s*\{[^}]*flex-wrap:\s*wrap/s.test(stylesCss)
);
check(
  "T4.3 msgDetails tiene flex: 0 0 100%",
  /flex:\s*"0 0 100%"/.test(require("fs").readFileSync(
    path.join(__dirname, "..", "renderer", "bandeja-integrada", "app.js"), "utf8"
  ))
);

// === Resumen ===
console.log("\n" + "=".repeat(50));
console.log("RESUMEN");
console.log("=".repeat(50));
console.log("Pasados: " + passed + "/" + total);
console.log("Fallados: " + failed);
console.log("");

if (failed === 0) {
  console.log("\u2713 TODOS LOS CHECKS OK \u2014 Loop 27 listo para commitear");
  process.exit(0);
} else {
  console.log("\u2717 HAY CHECKS FALLIDOS \u2014 revisar antes de commitear");
  process.exit(1);
}
