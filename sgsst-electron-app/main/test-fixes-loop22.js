// test-fixes-loop22.js — Tests para el refactor estructural (loop 22)
// =========================================================================
// Ejecutar: node main/test-fixes-loop22.js
//
// Valida:
//   T1. msgContainer es display: block (no flex)
//   T2. msgRow1 existe y es display: flex
//   T3. msgAvatar está dentro de msgRow1 (no directo en msgContainer)
//   T4. msgHeader está dentro de msgRow1 (no directo en msgContainer)
//   T5. msgDetails tiene padding-left: 52px (sin flex)
//   T6. Cache-bust actualizado a v=632
//   T7. Loop 21 fixes previos — siguen presentes
//
// Acumulado tras este test: 390+ checks OK (382 previos + ~7 nuevos)
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

// === T1. msgContainer es display: block ===
section("T1. msgContainer display: block (loop 22)");
check(
  "T1.1 .kair-mail-message tiene display: block",
  /\.kair-mail-message\s*\{[^}]*display:\s*block/s.test(stylesCss)
);
check(
  "T1.2 .kair-mail-message NO tiene display: flex",
  !/\.kair-mail-message\s*\{[^}]*display:\s*flex/s.test(stylesCss)
);

// === T2. msgRow1 existe y es display: flex ===
section("T2. msgRow1 display: flex (loop 22)");
check(
  "T2.1 .kair-mail-message__row existe",
  /\.kair-mail-message__row\s*\{/.test(stylesCss)
);
check(
  "T2.2 .kair-mail-message__row tiene display: flex",
  /\.kair-mail-message__row\s*\{[^}]*display:\s*flex/s.test(stylesCss)
);
check(
  "T2.3 .kair-mail-message__row tiene align-items: flex-start",
  /\.kair-mail-message__row\s*\{[^}]*align-items:\s*flex-start/s.test(stylesCss)
);

// === T3-T4. avatar y header en msgRow1 ===
section("T3-T4. avatar/header en msgRow1 (loop 22)");
check(
  "T3.1 msgRow1.appendChild(msgAvatar) presente",
  /msgRow1\.appendChild\(msgAvatar\)/.test(appJs)
);
check(
  "T3.2 msgRow1.appendChild(msgHeader) presente",
  /msgRow1\.appendChild\(msgHeader\)/.test(appJs)
);
check(
  "T3.3 msgContainer.appendChild(msgRow1) presente",
  /msgContainer\.appendChild\(msgRow1\)/.test(appJs)
);
check(
  "T3.4 NO hay msgContainer.appendChild(msgAvatar) directo",
  !/msgContainer\.appendChild\(msgAvatar\)/.test(appJs)
);
check(
  "T3.5 NO hay msgContainer.appendChild(msgHeader) directo",
  !/msgContainer\.appendChild\(msgHeader\)/.test(appJs)
);

// === T5. msgDetails tiene padding-left: 52px ===
section("T5. msgDetails simple (loop 22)");
check(
  "T5.1 msgDetails tiene paddingLeft: 52px",
  /paddingLeft:\s*"52px"/.test(appJs)
);
check(
  "T5.2 msgDetails NO tiene flex: '0 0 100%' (era el bug)",
  !/flex:\s*"0 0 100%"/.test(appJs)
);

// === T6. Cache-bust ===
section("T6. Cache-bust v=632");
check(
  "T6.1 renderer.js apunta a v=632",
  /bandeja-integrada\/index\.html\?v=632/.test(rendererJs)
);

// === T7. Loop 21 fixes previos — siguen presentes ===
section("T7. Loop 21 fixes previos (no se rompi\u00f3 nada)");
check(
  "T7.1 .kair-mail-detail__reply tiene position: sticky",
  /\.kair-mail-detail__reply\s*\{[^}]*position:\s*sticky/s.test(stylesCss)
);
check(
  "T7.2 .kair-mail-message__head tiene flex: 1 1 0",
  /\.kair-mail-message__head\s*\{[^}]*flex:\s*1\s+1\s+0/s.test(stylesCss)
);
check(
  "T7.3 .kair-mail-message__head tiene min-height: 24px",
  /\.kair-mail-message__head\s*\{[^}]*min-height:\s*24px/s.test(stylesCss)
);
check(
  "T7.4 scroll NO tiene flex: 1",
  !/const scroll = el\("div"[^}]*flex:\s*"1"/.test(appJs)
);

// === Resumen ===
console.log("\n" + "=".repeat(50));
console.log("RESUMEN");
console.log("=".repeat(50));
console.log("Pasados: " + passed + "/" + total);
console.log("Fallados: " + failed);
console.log("");

if (failed === 0) {
  console.log("\u2713 TODOS LOS CHECKS OK \u2014 Loop 22 listo para commitear");
  process.exit(0);
} else {
  console.log("\u2717 HAY CHECKS FALLIDOS \u2014 revisar antes de commitear");
  process.exit(1);
}
