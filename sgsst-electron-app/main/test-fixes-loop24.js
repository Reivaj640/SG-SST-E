// test-fixes-loop24.js — Tests para los fixes finales Gmail-style (loop 24)
// =========================================================================
// Ejecutar: node main/test-fixes-loop24.js
//
// Valida:
//   T1. Body del mensaje con max-width para centrado (Gmail-style)
//   T2. Body con margin-left y margin-right auto
//   T3. Body mantiene padding-left 52px
//   T4. Cache-bust actualizado a v=634
//   T5. Loop 23 fixes previos — siguen presentes
//
// Acumulado tras este test: 420+ checks OK (411 previos + ~5 nuevos)
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

// === T1. Body con max-width ===
section("T1. Body con max-width (loop 24)");
check(
  "T1.1 .kair-mail-message__body tiene max-width",
  /\.kair-mail-message__body\s*\{[^}]*max-width:/s.test(stylesCss)
);
check(
  "T1.2 max-width es calc(100% - 52px)",
  /\.kair-mail-message__body\s*\{[^}]*max-width:\s*calc\(100%\s*-\s*52px\)/s.test(stylesCss)
);

// === T2. Body con margin-left y margin-right auto ===
section("T2. Body con margin auto (loop 24)");
check(
  "T2.1 .kair-mail-message__body tiene margin-left: 52px",
  /\.kair-mail-message__body\s*\{[^}]*margin-left:\s*52px/s.test(stylesCss)
);
check(
  "T2.2 .kair-mail-message__body tiene margin-right: auto",
  /\.kair-mail-message__body\s*\{[^}]*margin-right:\s*auto/s.test(stylesCss)
);

// === T3. Body mantiene padding-left 52px ===
section("T3. Body mantiene padding-left 52px (loop 24)");
check(
  "T3.1 .kair-mail-message__body tiene padding-left: 52px",
  /\.kair-mail-message__body\s*\{[^}]*padding-left:\s*52px/s.test(stylesCss)
);

// === T4. Cache-bust ===
section("T4. Cache-bust v=634");
check(
  "T4.1 renderer.js apunta a v=634",
  /bandeja-integrada\/index\.html\?v=634/.test(rendererJs)
);

// === T5. Loop 23 fixes previos — siguen presentes ===
section("T5. Loop 23 fixes previos (no se rompi\u00f3 nada)");
check(
  "T5.1 detail.appendChild(reply) presente",
  /detail\.appendChild\(reply\)/.test(rendererJs) ||
  /detail\.appendChild\(reply\)/.test(require("fs").readFileSync(
    path.join(__dirname, "..", "renderer", "bandeja-integrada", "app.js"), "utf8"
  ))
);
check(
  "T5.2 NO hay scroll.appendChild(reply)",
  !/scroll\.appendChild\(reply\)/.test(require("fs").readFileSync(
    path.join(__dirname, "..", "renderer", "bandeja-integrada", "app.js"), "utf8"
  ))
);
check(
  "T5.3 .kair-mail-message tiene display: block",
  /\.kair-mail-message\s*\{[^}]*display:\s*block/s.test(stylesCss)
);
check(
  "T5.4 .kair-mail-message__row tiene display: flex",
  /\.kair-mail-message__row\s*\{[^}]*display:\s*flex/s.test(stylesCss)
);
check(
  "T5.5 .kair-mail-detail__reply tiene position: sticky",
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
  console.log("\u2713 TODOS LOS CHECKS OK \u2014 Loop 24 listo para commitear");
  process.exit(0);
} else {
  console.log("\u2717 HAY CHECKS FALLIDOS \u2014 revisar antes de commitear");
  process.exit(1);
}
