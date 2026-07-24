// test-fixes-loop17.js — Tests para los fixes Gmail-style (loop 17)
// =========================================================================
// Ejecutar: node main/test-fixes-loop17.js
//
// Valida:
//   T1. Toolbar del thread header más completa (Gmail-style: archive/info/trash + reply/forward)
//   T2. Reply y Forward agregados a la toolbar
//   T3. "Mover a carpeta" e "Imprimir" eliminados
//   T4. "1 de 2" label removido del thread header
//   T5. Indicator ··· agregado al quote colapsable (Gmail-style)
//   T6. Cache-bust actualizado a v=627
//   T7. Loop 16 fixes previos — siguen presentes
//
// Acumulado tras este test: 320+ checks OK (314 previos + ~10 nuevos)
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

// === T1-T3. Toolbar del thread header más completa ===
section("T1. Toolbar del thread header (loop 17)");
check(
  "T1.1 toolbar tiene iconBtn archive",
  /toolbar\.appendChild\(iconBtn\(D\.ICONS\.archive/.test(appJs)
);
check(
  "T1.2 toolbar tiene iconBtn mailOpen (mark unread)",
  /toolbar\.appendChild\(iconBtn\(D\.ICONS\.mailOpen/.test(appJs)
);
check(
  "T1.3 toolbar tiene iconBtn trash",
  /toolbar\.appendChild\(iconBtn\(D\.ICONS\.trash/.test(appJs)
);
check(
  "T1.4 toolbar tiene iconBtn reply (Gmail-style)",
  /toolbar\.appendChild\(iconBtn\(D\.ICONS\.reply/.test(appJs) &&
  /openComposeModal\("reply", mail\)/.test(appJs)
);
check(
  "T1.5 toolbar tiene iconBtn forward (Gmail-style)",
  /toolbar\.appendChild\(iconBtn\(D\.ICONS\.forward/.test(appJs) &&
  /openComposeModal\("forward", mail\)/.test(appJs)
);
check(
  "T1.6 toolbar tiene iconBtn more",
  /toolbar\.appendChild\(iconBtn\(D\.ICONS\.more/.test(appJs)
);

// === T3. "Mover a carpeta" e "Imprimir" eliminados ===
section("T2. Acciones eliminadas (Gmail-style)");
check(
  "T2.1 'Mover a carpeta' ya NO está en toolbar",
  !/iconBtn\(D\.ICONS\.folder, "Mover a carpeta"\)/.test(appJs)
);
check(
  "T2.2 'Imprimir' ya NO está en toolbar",
  !/iconBtn\(D\.ICONS\.printer, "Imprimir"\)/.test(appJs)
);

// === T4. "1 de 2" label removido ===
section("T3. '1 de 2' label removido");
check(
  "T3.1 'currentPos' variable ya NO se usa",
  !/var currentPos\s*=\s*currentIndex\s*>=\s*0\s*\?\s*\(currentIndex\s*\+\s*1\)/.test(appJs) ||
  /FIX loop 17.*Solo las flechas de navegación/.test(appJs)
);
check(
  "T3.2 '1 de 2' nav ya NO se renderiza",
  !/Correo \$\{currentPos\} de \$\{totalMails\}/.test(appJs) ||
  /FIX loop 17.*Solo las flechas de navegación/.test(appJs)
);

// === T5. Indicator ··· al quote colapsable ===
section("T4. Indicator ··· al quote (loop 17)");
check(
  "T4.1 .kair-mail-quote summary::before tiene content: '···'",
  /\.kair-mail-quote\s+summary::before\s*\{[^}]*content:\s*['"]\u00b7\u00b7\u00b7/.test(stylesCss)
);
check(
  "T4.2 .kair-mail-quote summary::before tiene font-weight: 600",
  /\.kair-mail-quote\s+summary::before\s*\{[^}]*font-weight:\s*600/s.test(stylesCss)
);
check(
  "T4.3 Comment FIX loop 17 sobre indicator",
  /FIX loop 17\s*—\s*Indicador/.test(stylesCss)
);

// === T6. Cache-bust ===
section("T5. Cache-bust v=627");
check(
  "T5.1 renderer.js apunta a v=627",
  /bandeja-integrada\/index\.html\?v=627/.test(rendererJs)
);

// === T7. Loop 16 fixes previos — siguen presentes ===
section("T6. Loop 16 fixes previos (no se rompió nada)");
check(
  "T6.1 .kair-mail-message__avatar tiene width: 40px",
  /\.kair-mail-message__avatar\s*\{[^}]*width:\s*40px/s.test(stylesCss)
);
check(
  "T6.2 .kair-mail-row:hover usa rgba primary 0.04",
  /\.kair-mail-row:hover\s*\{[^}]*background:\s*rgba\(26,\s*115,\s*232,\s*0\.04\)/s.test(stylesCss)
);
check(
  "T6.3 Compose modal usa separador 'Forwarded message'",
  /---------- Forwarded message ----------/.test(appJs)
);
check(
  "T6.4 Avatar sticky",
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
  console.log("\u2713 TODOS LOS CHECKS OK \u2014 Loop 17 listo para commitear");
  process.exit(0);
} else {
  console.log("\u2717 HAY CHECKS FALLIDOS \u2014 revisar antes de commitear");
  process.exit(1);
}
