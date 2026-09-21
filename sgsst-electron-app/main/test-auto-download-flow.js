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

test('renderer.js: case "available" dice "Descargando automáticamente"', () => {
  // Buscar case 'available': con dos puntos (sintaxis JS real)
  const caseIdx = rendererCode.indexOf("case 'available':");
  if (caseIdx < 0) throw new Error('No se encontró el case "available" del switch');
  const caseBody = rendererCode.slice(caseIdx, caseIdx + 3500);
  if (!/Descargando autom[aá]ticamente/.test(caseBody)) {
    throw new Error('case "available" no dice "Descargando automáticamente"');
  }
});

test('renderer.js: case "available" oculta el botón Descargar', () => {
  const caseIdx = rendererCode.indexOf("case 'available':");
  if (caseIdx < 0) throw new Error('No se encontró el case "available" del switch');
  const caseBody = rendererCode.slice(caseIdx, caseIdx + 3500);
  // Buscar que el downloadBtn.style.display = 'none' (no 'block')
  if (!/downloadBtn\.style\.display\s*=\s*['"]none['"]/.test(caseBody)) {
    throw new Error('case "available" no oculta el botón Descargar');
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

test('update-notifications.js: notifyAvailable muestra toast con progress y autoClose 0', () => {
  const methodMatch = notifCode.match(/notifyAvailable\s*\(\s*version\s*\)\s*\{[\s\S]{0,1500}?\n\s{4}\}/);
  if (!methodMatch) {
    throw new Error('No se encontró el cuerpo de notifyAvailable');
  }
  if (!/progress:\s*\{\s*percent:\s*0\s*\}/.test(methodMatch[0])) {
    throw new Error('notifyAvailable no muestra progress: { percent: 0 }');
  }
  if (!/autoClose:\s*0/.test(methodMatch[0])) {
    throw new Error('notifyAvailable no tiene autoClose: 0 (no debería cerrarse solo)');
  }
});

test('update-notifications.js: notifyDownloaded tiene botón "Reiniciar e Instalar Ahora"', () => {
  const methodMatch = notifCode.match(/notifyDownloaded\s*\(\s*version\s*,\s*onRestart\s*\)\s*\{[\s\S]{0,1500}?\n\s{4}\}/);
  if (!methodMatch) {
    throw new Error('No se encontró el cuerpo de notifyDownloaded');
  }
  if (!/buttonText:\s*['"]Reiniciar e Instalar Ahora['"]/.test(methodMatch[0])) {
    throw new Error('notifyDownloaded no tiene buttonText "Reiniciar e Instalar Ahora"');
  }
  if (!/onClick:\s*onRestart/.test(methodMatch[0])) {
    throw new Error('notifyDownloaded no conecta el onClick con onRestart');
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
