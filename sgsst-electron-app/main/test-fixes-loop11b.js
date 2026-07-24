// test-fixes-loop11b.js — Tests para los 5 fixes visuales Gmail-style (loop 11b)
// =========================================================================
// Ejecutar: node main/test-fixes-loop11b.js
//
// Valida:
//   T1. Email cortado — overflow-wrap: anywhere en sender y subject
//   T2. Subject "Re:" / "Fwd:" — regex limpia los prefijos
//   T3. "···" indicator — más HTML estructurado, no texto plano
//   T4. Chevron "▾" — reemplazado por SVG inline
//   T5. Espaciado del cuerpo expandido — margins consistentes
//   T6. Cache-bust actualizado a v=621
//   T7. Loop 11 fixes previos (1-line + headers MIME 2ª pasada) — siguen presentes
//
// Acumulado tras este test: 200+ checks OK (195 previos + ~10 nuevos)
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

// === T1. Email cortado — overflow-wrap en sender y subject ===
section("T1. Email cortado — overflow-wrap: anywhere");
check(
  "T1.1 .kair-mail-message__sender tiene overflow-wrap: anywhere",
  /\.kair-mail-message__sender\s*\{[^}]*overflow-wrap:\s*anywhere/s.test(stylesCss)
);
check(
  "T1.2 .kair-mail-message__subject tiene overflow-wrap: anywhere",
  /\.kair-mail-message__subject\s*\{[^}]*overflow-wrap:\s*anywhere/s.test(stylesCss)
);
check(
  "T1.3 Comment FIX 2026-07-19 sobre email cortado presente",
  /FIX 2026-07-19:\s*email largo no se corta/s.test(stylesCss)
);

// === T2. Subject "Re:" / "Fwd:" — regex limpia los prefijos ===
section("T2. Subject Re/Fwd — limpieza de prefijos");
check(
  "T2.1 Regex de limpieza Re/Fwd presente en app.js",
  /\^\(\\s\*\(Re\|Fwd\|RE\|FW\)\\s\*:\\s\*\)\+/.test(appJs)
);
check(
  "T2.2 Variable msgSubject usa el subject limpio",
  /var\s+msgSubject\s*=\s*\(rawSubject\s*\|\|\s*""\)\.replace\(/i.test(appJs)
);
check(
  "T2.3 Comment FIX 2026-07-19 sobre Re/Fwd presente",
  /FIX 2026-07-19\s*—\s*Limpiar prefijos/i.test(appJs)
);

// === T3. "···" indicator — HTML estructurado ===
section("T3. ··· indicator estilizado");
check(
  "T3.1 moreIndicator usa innerHTML con span (no texto plano)",
  /moreIndicator\.innerHTML\s*=\s*['"]<span\s+class="kair-mail-message__more-dots">/.test(appJs)
);
check(
  "T3.2 Clase .kair-mail-message__more-dots definida en CSS",
  /\.kair-mail-message__more-dots\s*\{/.test(stylesCss)
);
check(
  "T3.3 .kair-mail-message__more tiene display: block y text-align: center",
  /\.kair-mail-message__more\s*\{[^}]*display:\s*block[^}]*text-align:\s*center/s.test(stylesCss)
);
check(
  "T3.4 .kair-mail-message__more-dots tiene letter-spacing amplio",
  /\.kair-mail-message__more-dots\s*\{[^}]*letter-spacing:\s*0\.3em/s.test(stylesCss)
);
check(
  "T3.5 Color gris claro (#bdc1c6) para los puntos",
  /\.kair-mail-message__more-dots\s*\{[^}]*color:\s*#bdc1c6/s.test(stylesCss)
);

// === T4. Chevron "▾" — SVG inline ===
section("T4. Chevron SVG inline (reemplazo de ▾ Unicode)");
check(
  "T4.1 Recipients usa SVG polyline en lugar de ▾",
  /<svg\s+class="kair-mail-message__recipients-arrow"[^>]*>\s*<polyline points="6 9 12 15 18 9">/.test(appJs)
);
check(
  "T4.2 Ya no hay carácter ▾ (U+25BE) en recipientsSummary.innerHTML",
  !/recipientsSummary\.innerHTML[^;]*▾/.test(appJs)
);
check(
  "T4.3 .kair-mail-message__recipients-arrow sigue con transition (rotación)",
  /\.kair-mail-message__recipients-arrow\s*\{[^}]*transition:\s*transform/s.test(stylesCss)
);

// === T5. Espaciado del cuerpo expandido ===
section("T5. Espaciado consistente");
check(
  "T5.1 .kair-mail-message__recipients tiene margin-bottom >= 12px",
  /\.kair-mail-message__recipients\s*\{[^}]*margin:\s*4px\s+0\s+12px/s.test(stylesCss)
);
check(
  "T5.2 .kair-mail-message__recipients-arrow tiene margin-left 2px",
  /\.kair-mail-message__recipients-arrow\s*\{[^}]*margin-left:\s*2px/s.test(stylesCss)
);
check(
  "T5.3 .kair-mail-message__body tiene margin-top 12px",
  /\.kair-mail-message__body\s*\{[^}]*margin-top:\s*12px/s.test(stylesCss)
);

// === T6. Cache-bust actualizado ===
section("T6. Cache-bust v=621");
check(
  "T6.1 renderer.js apunta a v=621",
  /bandeja-integrada\/index\.html\?v=621/.test(rendererJs)
);

// === T7. Loop 11 fixes previos — siguen presentes ===
section("T7. Loop 11 fixes previos (no se rompió nada)");
check(
  "T7.1 .kair-mail-message__line tiene display: flex !important",
  /\.kair-mail-message__line\s*\{[^}]*display:\s*flex\s*!important/s.test(stylesCss)
);
check(
  "T7.2 .kair-mail-message__line tiene flex-wrap: nowrap !important",
  /\.kair-mail-message__line\s*\{[^}]*flex-wrap:\s*nowrap\s*!important/s.test(stylesCss)
);
check(
  "T7.3 Sender mantiene flex-shrink: 0 y max-width: 180px",
  /\.kair-mail-message__sender\s*\{[^}]*flex-shrink:\s*0[^}]*max-width:\s*180px/s.test(stylesCss)
);
check(
  "T7.4 renderMailBodyHtml tiene segunda pasada (mimeHeaderPatternAny)",
  /mimeHeaderPatternAny/.test(appJs)
);
check(
  "T7.5 Segunda pasada elimina bloques de 2+ headers consecutivos",
  /blockSize\s*>=\s*2/.test(appJs)
);

// === Resumen ===
console.log("\n" + "=".repeat(50));
console.log("RESUMEN");
console.log("=".repeat(50));
console.log("Pasados: " + passed + "/" + total);
console.log("Fallados: " + failed);
console.log("");

if (failed === 0) {
  console.log("\u2713 TODOS LOS CHECKS OK \u2014 Loop 11b listo para commitear");
  process.exit(0);
} else {
  console.log("\u2717 HAY CHECKS FALLIDOS \u2014 revisar antes de commitear");
  process.exit(1);
}
