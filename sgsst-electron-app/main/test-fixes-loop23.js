// test-fixes-loop23.js — Tests para el fix del reply bar (loop 23)
// =========================================================================
// Ejecutar: node main/test-fixes-loop23.js
//
// Valida:
//   T1. Reply bar al final del detail (detail.appendChild, NO scroll.appendChild)
//   T2. Scroll NO tiene maxHeight
//   T3. Detail NO tiene height: 100% (permite altura natural)
//   T4. Cache-bust actualizado a v=633
//   T5. Loop 22 fixes previos — siguen presentes
//
// Acumulado tras este test: 405+ checks OK (399 previos + ~5 nuevos)
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

// === T1. Reply bar al final del detail ===
section("T1. Reply bar al final del detail (loop 23)");
check(
  "T1.1 detail.appendChild(reply) presente",
  /detail\.appendChild\(reply\)/.test(appJs)
);
check(
  "T1.2 NO hay scroll.appendChild(reply)",
  !/scroll\.appendChild\(reply\)/.test(appJs)
);

// === T2. Scroll NO tiene maxHeight ===
section("T2. Scroll sin maxHeight (loop 23)");
check(
  "T2.1 scroll NO tiene maxHeight",
  !/maxHeight:\s*"calc\(100vh - 200px\)"/.test(appJs)
);
check(
  "T2.2 scroll tiene overflowY: auto",
  /overflowY:\s*"auto"/.test(appJs)
);

// === T3. Detail NO tiene height: 100% ===
section("T3. Detail sin height: 100% (loop 23)");
check(
  "T3.1 .kair-mail-detail NO tiene height: 100% (sin contar comentarios)",
  !/\.kair-mail-detail\s*\{[^\/\*]*height:\s*100%/.test(stylesCss)
);
check(
  "T3.2 .kair-mail-detail tiene display: flex",
  /\.kair-mail-detail\s*\{[^}]*display:\s*flex/s.test(stylesCss)
);
check(
  "T3.3 .kair-mail-detail tiene flex-direction: column",
  /\.kair-mail-detail\s*\{[^}]*flex-direction:\s*column/s.test(stylesCss)
);

// === T4. Cache-bust ===
section("T4. Cache-bust v=633");
check(
  "T4.1 renderer.js apunta a v=633",
  /bandeja-integrada\/index\.html\?v=633/.test(rendererJs)
);

// === T5. Loop 22 fixes previos — siguen presentes ===
section("T5. Loop 22 fixes previos (no se rompi\u00f3 nada)");
check(
  "T5.1 .kair-mail-message tiene display: block",
  /\.kair-mail-message\s*\{[^}]*display:\s*block/s.test(stylesCss)
);
check(
  "T5.2 .kair-mail-message__row tiene display: flex",
  /\.kair-mail-message__row\s*\{[^}]*display:\s*flex/s.test(stylesCss)
);
check(
  "T5.3 msgRow1.appendChild(msgAvatar) presente",
  /msgRow1\.appendChild\(msgAvatar\)/.test(appJs)
);
check(
  "T5.4 .kair-mail-detail__reply tiene position: sticky",
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
  console.log("\u2713 TODOS LOS CHECKS OK \u2014 Loop 23 listo para commitear");
  process.exit(0);
} else {
  console.log("\u2717 HAY CHECKS FALLIDOS \u2014 revisar antes de commitear");
  process.exit(1);
}
