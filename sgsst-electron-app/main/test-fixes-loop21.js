// test-fixes-loop21.js — Tests para los 2 fixes visuales (loop 21)
// =========================================================================
// Ejecutar: node main/test-fixes-loop21.js
//
// Valida:
//   T1. msgDetails tiene flex: 0 0 100% (fuerza a un nuevo row)
//   T2. Head del mensaje tiene flex: 1 1 0 (ocupa el espacio restante)
//   T3. Scroll NO tiene flex: 1 (permite que el reply quede inline)
//   T4. Scroll tiene max-height: calc(100vh - 200px)
//   T5. Cache-bust actualizado a v=631
//   T6. Loop 20 fixes previos — siguen presentes
//
// Acumulado tras este test: 380+ checks OK (372 previos + ~6 nuevos)
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

// === T1. msgDetails tiene flex: 0 0 100% ===
section("T1. msgDetails flex: 0 0 100% (loop 21)");
check(
  "T1.1 msgDetails tiene flex: '0 0 100%'",
  /flex:\s*"0 0 100%"/.test(appJs)
);

// === T2. Head del mensaje tiene flex: 1 1 0 ===
section("T2. Head flex: 1 1 0 (loop 21)");
check(
  "T2.1 .kair-mail-message__head tiene flex: 1 1 0",
  /\.kair-mail-message__head\s*\{[^}]*flex:\s*1\s+1\s+0/s.test(stylesCss)
);

// === T3. Scroll NO tiene flex: 1 ===
section("T3. Scroll sin flex: 1 (loop 21)");
check(
  "T3.1 scroll style NO tiene flex: \"1\"",
  !/const scroll = el\("div"[^}]*flex:\s*"1"/.test(appJs)
);
check(
  "T3.2 scroll tiene overflowY: auto",
  /scroll[\s\S]{0,300}overflowY:\s*"auto"/.test(appJs)
);

// === T4. Scroll tiene max-height ===
section("T4. Scroll max-height (loop 21)");
check(
  "T4.1 scroll tiene maxHeight: calc(100vh - 200px)",
  /maxHeight:\s*"calc\(100vh - 200px\)"/.test(appJs)
);

// === T5. Cache-bust ===
section("T5. Cache-bust v=631");
check(
  "T5.1 renderer.js apunta a v=631",
  /bandeja-integrada\/index\.html\?v=631/.test(rendererJs)
);

// === T6. Loop 20 fixes previos — siguen presentes ===
section("T6. Loop 20 fixes previos (no se rompi\u00f3 nada)");
check(
  "T6.1 .kair-mail-detail__reply tiene position: sticky",
  /\.kair-mail-detail__reply\s*\{[^}]*position:\s*sticky/s.test(stylesCss)
);
check(
  "T6.2 .kair-mail-message__head tiene min-height: 24px",
  /\.kair-mail-message__head\s*\{[^}]*min-height:\s*24px/s.test(stylesCss)
);
check(
  "T6.3 .kair-mail-message__avatar NO tiene position: sticky",
  !/\.kair-mail-message__avatar\s*\{[^}]*position:\s*sticky/s.test(stylesCss)
);
check(
  "T6.4 scroll.appendChild(reply) presente",
  /scroll\.appendChild\(reply\)/.test(appJs)
);

// === Resumen ===
console.log("\n" + "=".repeat(50));
console.log("RESUMEN");
console.log("=".repeat(50));
console.log("Pasados: " + passed + "/" + total);
console.log("Fallados: " + failed);
console.log("");

if (failed === 0) {
  console.log("\u2713 TODOS LOS CHECKS OK \u2014 Loop 21 listo para commitear");
  process.exit(0);
} else {
  console.log("\u2717 HAY CHECKS FALLIDOS \u2014 revisar antes de commitear");
  process.exit(1);
}
