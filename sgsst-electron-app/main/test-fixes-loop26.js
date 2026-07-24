// test-fixes-loop26.js — Tests para los 3 fixes del detail (loop 26)
// =========================================================================
// Ejecutar: node main/test-fixes-loop26.js
//
// Valida:
//   T1. Thread header Gmail-style (recipients Para/CC + "Mostrar detalles")
//   T2. Acciones del mensaje en el HEAD (no al final del body)
//   T3. Body con max-width 720px (Gmail-style reading)
//   T4. Cache-bust actualizado a v=636
//   T5. Loop 25 fixes previos — siguen presentes
//
// Acumulado tras este test: 445+ checks OK (432 previos + ~10 nuevos)
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

// === T1. Thread header Gmail-style (recipients) ===
section("T1. Thread header Gmail-style (loop 26)");
check(
  "T1.1 header tiene kair-mail-detail__recipients",
  /kair-mail-detail__recipients/.test(appJs)
);
check(
  "T1.2 header tiene kair-mail-detail__recipient-row",
  /kair-mail-detail__recipient-row/.test(appJs)
);
check(
  "T1.3 header tiene kair-mail-detail__show-details",
  /kair-mail-detail__show-details/.test(appJs)
);
check(
  "T1.4 recipientsHtml parsea mail.to_list",
  /mail\.to_list/.test(appJs) && /mail\.cc_list/.test(appJs)
);

// === T2. Acciones del mensaje en el HEAD ===
section("T2. Acciones del mensaje en el HEAD (loop 26)");
check(
  "T2.1 msgActions se añade a msgHeader (no msgDetails)",
  /msgHeader\.appendChild\(msgActions\)/.test(appJs)
);
check(
  "T2.2 msgActions NO se añade a msgDetails (movido al head)",
  !/msgDetails\.appendChild\(msgActions\)/.test(appJs)
);

// === T3. Body con max-width 720px ===
section("T3. Body con max-width 720px (loop 26)");
check(
  "T3.1 .kair-mail-message__body tiene max-width: 720px",
  /\.kair-mail-message__body\s*\{[^}]*max-width:\s*720px/s.test(stylesCss)
);
check(
  "T3.2 .kair-mail-message__body NO tiene max-width: calc(100% - 52px)",
  !/\.kair-mail-message__body\s*\{[^}]*max-width:\s*calc\(100%\s*-\s*52px\)/.test(stylesCss)
);

// === T4. Cache-bust ===
section("T4. Cache-bust v=636");
check(
  "T4.1 renderer.js apunta a v=636",
  /bandeja-integrada\/index\.html\?v=636/.test(rendererJs)
);

// === T5. Loop 25 fixes previos — siguen presentes ===
section("T5. Loop 25 fixes previos (no se rompi\u00f3 nada)");
check(
  "T5.1 .kair-mail-message tiene display: flex",
  /\.kair-mail-message\s*\{[^}]*display:\s*flex/s.test(stylesCss)
);
check(
  "T5.2 .kair-mail-message tiene flex-wrap: wrap",
  /\.kair-mail-message\s*\{[^}]*flex-wrap:\s*wrap/s.test(stylesCss)
);
check(
  "T5.3 NO hay .kair-mail-message__row en CSS",
  !/\.kair-mail-message__row\s*\{/.test(stylesCss)
);
check(
  "T5.4 detail.appendChild(reply) presente",
  /detail\.appendChild\(reply\)/.test(appJs)
);

// === Resumen ===
console.log("\n" + "=".repeat(50));
console.log("RESUMEN");
console.log("=".repeat(50));
console.log("Pasados: " + passed + "/" + total);
console.log("Fallados: " + failed);
console.log("");

if (failed === 0) {
  console.log("\u2713 TODOS LOS CHECKS OK \u2014 Loop 26 listo para commitear");
  process.exit(0);
} else {
  console.log("\u2717 HAY CHECKS FALLIDOS \u2014 revisar antes de commitear");
  process.exit(1);
}
