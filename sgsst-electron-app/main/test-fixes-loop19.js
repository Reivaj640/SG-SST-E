// test-fixes-loop19.js — Tests para los 2 fixes visuales (loop 19)
// =========================================================================
// Ejecutar: node main/test-fixes-loop19.js
//
// Valida:
//   T1. Avatar YA NO tiene position: sticky (causaba desalineación)
//   T2. Avatar tiene margin-top: 0 (sin offset)
//   T3. Recipients con margin 8px 0 14px (más espacio)
//   T4. Detalles expandidos con marginTop: 12px
//   T5. Cache-bust actualizado a v=629
//   T6. Loop 18 fixes previos — siguen presentes
//
// Acumulado tras este test: 360+ checks OK (348 previos + ~8 nuevos)
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

// === T1. Avatar YA NO tiene position: sticky ===
section("T1. Avatar sin position: sticky (loop 19)");
check(
  "T1.1 .kair-mail-message__avatar NO tiene position: sticky",
  !/\.kair-mail-message__avatar\s*\{[^}]*position:\s*sticky/s.test(stylesCss)
);
check(
  "T1.2 .kair-mail-message__avatar NO tiene top: 8px",
  !/\.kair-mail-message__avatar\s*\{[^}]*top:\s*8px/s.test(stylesCss)
);
check(
  "T1.3 .kair-mail-message__avatar NO tiene z-index: 1",
  !/\.kair-mail-message__avatar\s*\{[^}]*z-index:\s*1/s.test(stylesCss)
);

// === T2. Avatar tiene margin-top: 0 ===
section("T2. Avatar margin-top: 0 (loop 19)");
check(
  "T2.1 .kair-mail-message__avatar tiene margin-top: 0",
  /\.kair-mail-message__avatar\s*\{[^}]*margin-top:\s*0/s.test(stylesCss)
);

// === T3. Recipients con margin 8px 0 14px ===
section("T3. Recipients margin 8px 0 14px (loop 19)");
check(
  "T3.1 .kair-mail-message__recipients tiene margin: 8px 0 14px",
  /\.kair-mail-message__recipients\s*\{[^}]*margin:\s*8px\s+0\s+14px/s.test(stylesCss)
);

// === T4. Detalles expandidos con marginTop: 12px ===
section("T4. Detalles expandidos marginTop 12px (loop 19)");
check(
  "T4.1 msgDetails tiene marginTop: 12px",
  /marginTop:\s*"12px"/.test(appJs)
);
check(
  "T4.2 msgDetails mantiene paddingLeft: 52px",
  /paddingLeft:\s*"52px"/.test(appJs)
);

// === T5. Cache-bust ===
section("T5. Cache-bust v=629");
check(
  "T5.1 renderer.js apunta a v=629",
  /bandeja-integrada\/index\.html\?v=629/.test(rendererJs)
);

// === T6. Loop 18 fixes previos — siguen presentes ===
section("T6. Loop 18 fixes previos (no se rompi\u00f3 nada)");
check(
  "T6.1 folderChipHtml tiene HTML del chip",
  /folderChipHtml\s*=\s*'<span class="kair-mail-detail__folder-label"/.test(appJs)
);
check(
  "T6.2 scroll.appendChild(reply) presente (loop 18)",
  /scroll\.appendChild\(reply\)/.test(appJs)
);
check(
  "T6.3 detail.appendChild(reply) NO existe (loop 18)",
  !/detail\.appendChild\(reply\)/.test(appJs)
);
check(
  "T6.4 .kair-mail-message__avatar tiene width: 40px (loop 16)",
  /\.kair-mail-message__avatar\s*\{[^}]*width:\s*40px/s.test(stylesCss)
);
check(
  "T6.5 toolbar tiene iconBtn reply (loop 17)",
  /toolbar\.appendChild\(iconBtn\(D\.ICONS\.reply/.test(appJs)
);
check(
  "T6.6 Compose modal usa separador 'Forwarded message' (loop 15)",
  /---------- Forwarded message ----------/.test(appJs)
);

// === Resumen ===
console.log("\n" + "=".repeat(50));
console.log("RESUMEN");
console.log("=".repeat(50));
console.log("Pasados: " + passed + "/" + total);
console.log("Fallados: " + failed);
console.log("");

if (failed === 0) {
  console.log("\u2713 TODOS LOS CHECKS OK \u2014 Loop 19 listo para commitear");
  process.exit(0);
} else {
  console.log("\u2717 HAY CHECKS FALLIDOS \u2014 revisar antes de commitear");
  process.exit(1);
}
