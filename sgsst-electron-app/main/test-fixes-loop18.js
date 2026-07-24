// test-fixes-loop18.js — Tests para los 2 fixes Gmail-style (loop 18)
// =========================================================================
// Ejecutar: node main/test-fixes-loop18.js
//
// Valida:
//   T1. Chip 'Recibidos ×' restaurado en el subject
//   T2. Reply bar movido al scroll (inline con el último mensaje)
//   T3. detail.appendChild(reply) YA NO existe (reemplazado por scroll.appendChild)
//   T4. Cache-bust actualizado a v=628
//   T5. Loop 17 fixes previos — siguen presentes
//
// Acumulado tras este test: 340+ checks OK (333 previos + ~6 nuevos)
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

// === T1. Chip 'Recibidos ×' restaurado ===
section("T1. Chip 'Recibidos ×' restaurado");
check(
  "T1.1 folderChipHtml ya NO es string vac\u00edo",
  !/var folderChipHtml\s*=\s*['"];/.test(appJs) &&
  !/var folderChipHtml\s*=\s*''/.test(appJs)
);
check(
  "T1.2 folderChipHtml tiene HTML con span + button",
  /folderChipHtml\s*=\s*'<span class="kair-mail-detail__folder-label"/.test(appJs)
);
check(
  "T1.3 folderChipHtml tiene bot\u00f3n X con SVG",
  /kair-mail-detail__folder-remove/.test(appJs) && /x1="18" y1="6" x2="6" y2="18"/.test(appJs)
);
check(
  "T1.4 Comment FIX loop 18 sobre chip restaurado",
  /FIX 2026-07-19\s*\(loop 18\)\s*—\s*Restaurar el chip/.test(appJs)
);

// === T2. Reply bar movido al scroll ===
section("T2. Reply bar inline con el \u00faltimo mensaje");
check(
  "T2.1 scroll.appendChild(reply) presente (FIX loop 18)",
  /scroll\.appendChild\(reply\)/.test(appJs)
);
check(
  "T2.2 Comment FIX loop 18 sobre reply inline",
  /FIX loop 18:\s*reply inline con el \u00faltimo mensaje/.test(appJs)
);

// === T3. detail.appendChild(reply) YA NO existe ===
section("T3. Reply bar YA NO est\u00e1 fijo al fondo");
check(
  "T3.1 detail.appendChild(reply) NO existe",
  !/detail\.appendChild\(reply\)/.test(appJs)
);
check(
  "T3.2 reply se crea DESPU\u00c9S de detail.appendChild(scroll)",
  /detail\.appendChild\(scroll\);[\s\S]{0,200}const reply = el\("div"/.test(appJs)
);

// === T4. Cache-bust ===
section("T4. Cache-bust v=628");
check(
  "T4.1 renderer.js apunta a v=628",
  /bandeja-integrada\/index\.html\?v=628/.test(rendererJs)
);

// === T5. Loop 17 fixes previos — siguen presentes ===
section("T5. Loop 17 fixes previos (no se rompi\u00f3 nada)");
check(
  "T5.1 toolbar tiene iconBtn reply",
  /toolbar\.appendChild\(iconBtn\(D\.ICONS\.reply/.test(appJs)
);
check(
  "T5.2 toolbar tiene iconBtn forward",
  /toolbar\.appendChild\(iconBtn\(D\.ICONS\.forward/.test(appJs)
);
check(
  "T5.3 'Mover a carpeta' ya NO est\u00e1 en toolbar",
  !/iconBtn\(D\.ICONS\.folder, "Mover a carpeta"\)/.test(appJs)
);
check(
  "T5.4 '1 de 2' label ya NO se renderiza",
  !/Correo \$\{currentPos\} de \$\{totalMails\}/.test(appJs)
);
check(
  "T5.5 .kair-mail-quote summary::before tiene content '···'",
  /\.kair-mail-quote\s+summary::before\s*\{[^}]*content:\s*['"]\u00b7\u00b7\u00b7/.test(stylesCss)
);
check(
  "T5.6 Avatar 40x40",
  /\.kair-mail-message__avatar\s*\{[^}]*width:\s*40px/s.test(stylesCss)
);

// === Resumen ===
console.log("\n" + "=".repeat(50));
console.log("RESUMEN");
console.log("=".repeat(50));
console.log("Pasados: " + passed + "/" + total);
console.log("Fallados: " + failed);
console.log("");

if (failed === 0) {
  console.log("\u2713 TODOS LOS CHECKS OK \u2014 Loop 18 listo para commitear");
  process.exit(0);
} else {
  console.log("\u2717 HAY CHECKS FALLIDOS \u2014 revisar antes de commitear");
  process.exit(1);
}
