/* ============================================================
 * Test Loop 33 — Drag & drop de archivos al compose
 * ============================================================
 * Acumulado: 488/488 tests OK (después de este loop)
 *
 * CONTEXTO:
 * El compose modal tiene un botón "Adjuntar archivo" pero está
 * deshabilitado (no funcional). El user quiere poder arrastrar
 * archivos al compose y verlos listos para enviar.
 *
 * FIX (Loop 33):
 * 1. Habilitar el botón "Adjuntar archivo" (quitar disabled)
 * 2. Agregar <input type="file" hidden multiple>
 * 3. Wire up botón → input click → input change → add to attachments
 * 4. Drop zone visual en el body del modal (dragover/dragleave/drop)
 * 5. Display de archivos adjuntos (nombre, tamaño, X para quitar)
 * 6. CSS para drop zone + attachments
 *
 * NOTA: El envío real de adjuntos vía Gmail API queda como scope
 * separado. Este loop implementa la UI (drag&drop + display) que
 * está lista para integrarse con el backend.
 *
 * Criterio de "listo":
 * - Botón "Adjuntar archivo" enabled (sin disabled)
 * - Input file existe en el modal (hidden, multiple)
 * - Handlers de drag&drop existen
 * - CSS de drop zone + attachments existe
 * ============================================================ */

const fs = require('fs');
const path = require('path');

const APP_JS = path.join(__dirname, '..', 'renderer', 'bandeja-integrada', 'app.js');
const STYLES_CSS = path.join(__dirname, '..', 'renderer', 'bandeja-integrada', 'styles.css');

let passed = 0;
let failed = 0;

function assert(check, label) {
  if (check) {
    console.log("  OK  " + label);
    passed++;
  } else {
    console.log("  XX  " + label);
    failed++;
  }
}

const appContent = fs.readFileSync(APP_JS, 'utf8');
const stylesContent = fs.readFileSync(STYLES_CSS, 'utf8');

console.log("\n=== Test Loop 33 — Drag & drop al compose ===\n");

// === GRUPO 1: Botón "Adjuntar archivo" habilitado (sin disabled) ===
console.log("[FIX 1] Botón 'Adjuntar archivo' NO debe tener disabled");
const attachBtnMatch = appContent.match(/<button class="compose-panel__toolbar__btn"[^>]*title="Adjuntar archivo"[^>]*>/);
assert(
  attachBtnMatch && !/disabled/.test(attachBtnMatch[0]),
  "Botón 'Adjuntar archivo' está habilitado (sin disabled)"
);

// === GRUPO 2: Input file existe en el modal ===
console.log("\n[FIX 2] Input type=file existe en el modal (hidden, multiple)");
assert(
  /<input type="file"[^>]*id="compose-attachments-input"[^>]*>/.test(appContent),
  "Input type=file con id compose-attachments-input existe"
);
assert(
  /multiple/.test(appContent.match(/<input type="file"[^>]*id="compose-attachments-input"[^>]*>/)[0]),
  "Input file tiene atributo 'multiple' (varios archivos)"
);
assert(
  /hidden/.test(appContent.match(/<input type="file"[^>]*id="compose-attachments-input"[^>]*>/)[0]),
  "Input file tiene atributo 'hidden' (oculto, activado por botón)"
);

// === GRUPO 3: Drop zone handlers existen ===
console.log("\n[FIX 3] Handlers de drag&drop existen");
assert(
  /dragover/.test(appContent) && /dragleave/.test(appContent) && /\bdrop\b/.test(appContent),
  "JS tiene handlers para dragover, dragleave y drop"
);
assert(
  /addEventListener\("dragover"/.test(appContent),
  "JS tiene addEventListener('dragover', ...)"
);
assert(
  /addEventListener\("drop"/.test(appContent),
  "JS tiene addEventListener('drop', ...)"
);

// === GRUPO 4: CSS de drop zone existe ===
console.log("\n[FIX 4] CSS de drop zone y attachments existe");
assert(
  /\.compose-panel__dropzone\s*\{/.test(stylesContent),
  "CSS .compose-panel__dropzone existe"
);
assert(
  /\.compose-panel__attachments\s*\{/.test(stylesContent),
  "CSS .compose-panel__attachments existe"
);
assert(
  /\.compose-panel__attachment\s*\{/.test(stylesContent),
  "CSS .compose-panel__attachment existe"
);

// === GRUPO 5: Comentario del fix existe ===
console.log("\n[FIX 5] Comentario del fix debe existir");
assert(
  /FIX loop 33/i.test(appContent) || /FIX loop 33/i.test(stylesContent),
  "Hay comentario 'FIX loop 33' en JS o CSS"
);

console.log("\n=== Resultado: " + passed + " OK, " + failed + " XX ===\n");

if (failed > 0) {
  console.error("FALLO: " + failed + " checks no pasaron");
  process.exit(1);
} else {
  console.log("TODOS LOS CHECKES PASARON");
  process.exit(0);
}
