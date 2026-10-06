/* Test del flujo A+B+C del auto-updater (📦546)
 * Valida que el código tiene los hooks correctos para:
 * A) Auto-descarga: main.js con autoDownload=true
 * B) Toast: renderer.js con notifyAvailable/updateProgress/notifyDownloaded/notifyError
 * C) Auto-install al cerrar: main.js con autoInstallOnAppQuit=true
 *
 * El test es estructural (lee archivos) — no requiere ejecutar la app.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const mainPath = path.join(ROOT, 'main.js');
const rendererPath = path.join(ROOT, 'renderer.js');
const preloadPath = path.join(ROOT, 'preload.js');
const notifPath = path.join(ROOT, 'assets', 'js', 'update-notifications.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  OK   ${name}`);
    passed++;
  } catch (err) {
    console.log(`  FAIL ${name}`);
    console.log(`       ${err.message}`);
    failed++;
  }
}

function readFile(p) {
  if (!fs.existsSync(p)) {
    throw new Error(`File not found: ${p}`);
  }
  return fs.readFileSync(p, 'utf8');
}

console.log('========================================');
console.log('Test: Flujo A+B+C del auto-updater (📦546)');
console.log('========================================');
console.log('');

const mainCode = readFile(mainPath);
const rendererCode = readFile(rendererPath);
const preloadCode = readFile(preloadPath);
const notifCode = readFile(notifPath);

console.log('A) Auto-descarga (main.js):');
console.log('');

test('main.js: autoDownload = true', () => {
  if (!/autoUpdater\.autoDownload\s*=\s*true/.test(mainCode)) {
    throw new Error('autoDownload debería ser true (descarga automática)');
  }
});

test('main.js: NO debe tener autoDownload = false', () => {
  if (/autoUpdater\.autoDownload\s*=\s*false/.test(mainCode)) {
    throw new Error('autoDownload todavía es false — el cambio A no se aplicó');
  }
});

test('main.js: comentario de autoDownload menciona auto-descarga', () => {
  // Buscar el contexto alrededor de autoDownload = true (200 chars antes y 100 después)
  const idx = mainCode.indexOf('autoUpdater.autoDownload');
  if (idx < 0) throw new Error('No se encontró autoUpdater.autoDownload en main.js');
  const context = mainCode.slice(Math.max(0, idx - 500), idx + 200);
  if (!/auto-descarga|autom[aá]tic/i.test(context)) {
    throw new Error('Comentario de autoDownload no menciona auto-descarga/automática');
  }
});

console.log('');
console.log('C) Auto-install al cerrar (main.js):');
console.log('');

test('main.js: autoInstallOnAppQuit = true', () => {
  if (!/autoUpdater\.autoInstallOnAppQuit\s*=\s*true/.test(mainCode)) {
    throw new Error('autoInstallOnAppQuit debería ser true');
  }
});

test('main.js: NO debe tener autoInstallOnAppQuit = false', () => {
  if (/autoUpdater\.autoInstallOnAppQuit\s*=\s*false/.test(mainCode)) {
    throw new Error('autoInstallOnAppQuit todavía es false — el cambio C no se aplicó');
  }
});

console.log('');
console.log('B) Toast de notificación (renderer.js):');
console.log('');

test('renderer.js: onUpdateAvailable llama a updateNotifier.notifyAvailable', () => {
  // Buscar el HANDLER real (no el console.log de "disponibilidad de electronAPI")
  // Patrón: window.electronAPI.onUpdateAvailable((info) => {
  const idx = rendererCode.indexOf("window.electronAPI.onUpdateAvailable");
  if (idx < 0) throw new Error('No se encontró el handler de onUpdateAvailable en renderer.js');
  const handler = rendererCode.slice(idx, idx + 2500);
  if (!/notifyAvailable\s*\(/.test(handler)) {
    throw new Error('onUpdateAvailable no llama a notifyAvailable()');
  }
});

test('renderer.js: onUpdateProgress llama a updateNotifier.updateProgress', () => {
  const idx = rendererCode.indexOf('onUpdateProgress');
  if (idx < 0) throw new Error('No se encontró onUpdateProgress en renderer.js');
  const startIdx = rendererCode.indexOf('(', idx);
  const handler = rendererCode.slice(startIdx, startIdx + 2000);
  if (!/updateProgress\s*\(/.test(handler)) {
    throw new Error('onUpdateProgress no llama a updateProgress()');
  }
});

test('renderer.js: onUpdateDownloaded llama a notifyDownloaded con callback restart', () => {
  const idx = rendererCode.indexOf('onUpdateDownloaded');
  if (idx < 0) throw new Error('No se encontró onUpdateDownloaded en renderer.js');
  const startIdx = rendererCode.indexOf('(', idx);
  const handler = rendererCode.slice(startIdx, startIdx + 3000);
  if (!/notifyDownloaded\s*\(/.test(handler)) {
    throw new Error('onUpdateDownloaded no llama a notifyDownloaded()');
  }
  if (!/restartApp/.test(handler)) {
    throw new Error('notifyDownloaded no recibe callback de restartApp()');
  }
});

test('renderer.js: onUpdateError llama a notifyError', () => {
  const idx = rendererCode.indexOf('onUpdateError');
  if (idx < 0) throw new Error('No se encontró onUpdateError en renderer.js');
  const startIdx = rendererCode.indexOf('(', idx);
  const handler = rendererCode.slice(startIdx, startIdx + 2000);
  if (!/notifyError\s*\(/.test(handler)) {
    throw new Error('onUpdateError no llama a notifyError()');
  }
});

console.log('');
console.log('Panel del header (UX):');
console.log('');

// ── 📦581 · INVERTIDOS 3 checks ──────────────────────────────────────────────
// Los 3 pedían el comportamiento del update ANTES de 📦581: toast "Descargando
// automáticamente", botón Descargar que se ocultaba, y notifyAvailable abriendo un
// toast con progress + autoClose 0. Todo eso se quitó A PROPÓSITO ("🗑️ CSS legacy
// del header update", "Toasts invasivos removidos (Loop 3)") y el update pasó al dot
// del footer. Se invierten en vez de borrarse (§7.3).
test('renderer.js: case "available" NO vuelve a decir "Descargando automáticamente"', () => {
  const caseIdx = rendererCode.indexOf("case 'available':");
  if (caseIdx < 0) throw new Error('No se encontró el case "available" del switch');
  const caseBody = rendererCode.slice(caseIdx, caseIdx + 3500);
  if (/Descargando autom[aá]ticamente/.test(caseBody)) {
    throw new Error('volvió el toast "Descargando automáticamente" — desde 📦581 el aviso va en el dot del footer');
  }
});

test('renderer.js: case "available" ya no toca el botón Descargar', () => {
  const caseIdx = rendererCode.indexOf("case 'available':");
  if (caseIdx < 0) throw new Error('No se encontró el case "available" del switch');
  const caseBody = rendererCode.slice(caseIdx, caseIdx + 3500);
  if (/downloadBtn\.style\.display\s*=\s*['"]none['"]/.test(caseBody)) {
    throw new Error('volvió downloadBtn.style.display = none — ese botón ya no existe desde 📦581');
  }
});

console.log('');
console.log('Sistema de toasts (assets/js/update-notifications.js):');
console.log('');

test('update-notifications.js: existe método notifyAvailable', () => {
  if (!/notifyAvailable\s*\(\s*version\s*\)/.test(notifCode)) {
    throw new Error('No existe notifyAvailable(version) en update-notifications.js');
  }
});

test('update-notifications.js: existe método updateProgress', () => {
  if (!/updateProgress\s*\(\s*percent/.test(notifCode)) {
    throw new Error('No existe updateProgress(percent, ...) en update-notifications.js');
  }
});

test('update-notifications.js: existe método notifyDownloaded con onRestart', () => {
  if (!/notifyDownloaded\s*\(\s*version\s*,\s*onRestart\s*\)/.test(notifCode)) {
    throw new Error('No existe notifyDownloaded(version, onRestart) en update-notifications.js');
  }
});

// 🔴 El original usaba /notifyAvailable\s*\(\s*version\s*\)\s*\{[\s\S]{0,1500}?\n\s{4}\}/ :
// una ventana de 1500 caracteres que alcanza el método SIGUIENTE y encuentra el
// progress/autoClose de otro (§5.15). Se extrae el cuerpo por llaves balanceadas, que es
// la comparación por bloque que corresponde.
function cuerpoPorLlaves(src, firma) {
  const i = src.indexOf(firma);
  if (i < 0) return '';
  const abre = src.indexOf('{', i);
  if (abre < 0) return '';
  let nivel = 0;
  for (let j = abre; j < src.length; j++) {
    if (src[j] === '{') nivel++;
    else if (src[j] === '}') { nivel--; if (nivel === 0) return src.slice(abre, j + 1); }
  }
  return '';
}

test('update-notifications.js: notifyAvailable es un no-op y no abre toast', () => {
  const cuerpo = cuerpoPorLlaves(notifCode, 'notifyAvailable(version)');
  if (!cuerpo) throw new Error('No se encontró el cuerpo de notifyAvailable');
  if (/progress:\s*\{\s*percent:\s*0\s*\}/.test(cuerpo)) {
    throw new Error('volvió el toast de notifyAvailable — desde 📦581 Loop 3 es no-op a propósito');
  }
  if (/autoClose:\s*0/.test(cuerpo)) {
    throw new Error('volvió autoClose: 0 en notifyAvailable — ya no abre toast');
  }
  // Y sí tiene que seguir siendo un no-op explícito, no un borrado silencioso.
  if (!/no-op desde Loop 3/.test(cuerpo)) {
    throw new Error('notifyAvailable dejó de documentar que es no-op — el aviso tiene que seguir yendo al footer');
  }
});

// 📦581 Loop 3, misma causa que el de arriba: notifyDownloaded dejó de abrir toast, así que
// ya no puede tener ni buttonText ni onClick. El reinicio se hace desde el dropdown.
// Se invierte, y se cambia la extracción por la de llaves balanceadas (mismo motivo).
test('update-notifications.js: notifyDownloaded es un no-op y no abre toast', () => {
  const cuerpo = cuerpoPorLlaves(notifCode, 'notifyDownloaded(version, onRestart)');
  if (!cuerpo) throw new Error('No se encontró el cuerpo de notifyDownloaded');
  if (/buttonText:\s*['"]Reiniciar e Instalar Ahora['"]/.test(cuerpo)) {
    throw new Error('volvió el botón "Reiniciar e Instalar Ahora" — desde 📦581 el reinicio va en el dropdown');
  }
  if (/onClick:\s*onRestart/.test(cuerpo)) {
    throw new Error('volvió onClick: onRestart — desde 📦581 el usuario decide cuándo reiniciar');
  }
  if (!/no-op desde Loop 3/.test(cuerpo)) {
    throw new Error('notifyDownloaded dejó de documentar que es no-op — el reinicio tiene que quedar en el dropdown');
  }
});

console.log('');
console.log('preload.js (comentarios actualizados):');
console.log('');

test('preload.js: downloadUpdate ya no dice "100% manuales"', () => {
  if (/100% manuales/.test(preloadCode)) {
    throw new Error('Comentario de preload.js todavía dice "100% manuales" — desactualizado');
  }
});

test('preload.js: downloadUpdate menciona "fallback" o "automática"', () => {
  // Buscar 800 chars de contexto alrededor de downloadUpdate: () =>
  const idx = preloadCode.indexOf('downloadUpdate:');
  if (idx < 0) throw new Error('No se encontró downloadUpdate en preload.js');
  const context = preloadCode.slice(Math.max(0, idx - 800), idx + 500);
  if (!/fallback|autom[aá]tic/i.test(context)) {
    throw new Error('downloadUpdate no menciona "fallback" ni "automática" en su contexto');
  }
});

console.log('');
console.log('========================================');
console.log(`Resultado: ${passed} OK / ${failed} FAIL`);
console.log('========================================');

process.exit(failed > 0 ? 1 : 0);
