// Test de smoke: valida fixes del loop 11 (frontend-design alinear con Gmail)
const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'renderer', 'bandeja-integrada', 'app.js');
const cssPath = path.join(__dirname, '..', 'renderer', 'bandeja-integrada', 'styles.css');

const appSrc = fs.readFileSync(appPath, 'utf8');
const cssSrc = fs.readFileSync(cssPath, 'utf8');

const checks = [];

// === Fix 1: 1 línea horizontal en mensajes colapsados ===
checks.push({ name: 'CSS: .kair-mail-message__line display flex !important', ok: /\.kair-mail-message__line\s*\{[^}]*display:\s*flex !important/.test(cssSrc) });
checks.push({ name: 'CSS: .kair-mail-message__line flex-direction row !important', ok: /\.kair-mail-message__line\s*\{[^}]*flex-direction:\s*row !important/.test(cssSrc) });
checks.push({ name: 'CSS: .kair-mail-message__line flex-wrap nowrap !important', ok: /\.kair-mail-message__line\s*\{[^}]*flex-wrap:\s*nowrap !important/.test(cssSrc) });
checks.push({ name: 'CSS: .kair-mail-message__sender max-width 180px', ok: /\.kair-mail-message__sender\s*\{[^}]*max-width:\s*180px/.test(cssSrc) });
checks.push({ name: 'CSS: .kair-mail-message__sender flex-shrink 0', ok: /\.kair-mail-message__sender\s*\{[^}]*flex-shrink:\s*0/.test(cssSrc) });
checks.push({ name: 'CSS: .kair-mail-message__subject flex 1 1 0', ok: /\.kair-mail-message__subject\s*\{[^}]*flex:\s*1 1 0/.test(cssSrc) });

// === Fix 2: Headers MIME en cualquier parte del body ===
checks.push({ name: 'JS: bloque de headers MIME se filtra con blockSize >= 2', ok: /var blockSize = i2 - blockStart;[\s\S]{0,200}if \(blockSize >= 2\)/.test(appSrc) });
checks.push({ name: 'JS: bloque de 1 header suelto se preserva', ok: /blockSize >= 2[\s\S]{0,300}out2\.push\(l\);/.test(appSrc) });
checks.push({ name: 'JS: salta línea vacía después de bloque', ok: /blockSize >= 2[\s\S]{0,400}lines2\[i2\]\.trim\(\) === ""/.test(appSrc) });

// === Cache-bust ===
const rendPath = path.join(__dirname, '..', 'renderer.js');
const rendSrc = fs.readFileSync(rendPath, 'utf8');
const m = rendSrc.match(/bandeja-integrada\/index\.html\?v=(\d+)/);
checks.push({ name: 'Cache-bust >= 620', ok: m && parseInt(m[1], 10) >= 620, val: m ? m[1] : 'none' });

// Reporte
console.log('\n=== TEST FIXES LOOP 11 (frontend-design Gmail) ===');
var failed = 0;
checks.forEach(function (c) {
  const mark = c.ok ? 'OK  ' : 'FAIL';
  const val = c.val !== undefined ? ' (' + c.val + ')' : '';
  console.log('[' + mark + '] ' + c.name + val);
  if (!c.ok) failed++;
});
console.log('\n' + (failed === 0 ? 'TODOS LOS FIXES APLICADOS' : failed + ' FIXES FALLARON'));
process.exit(failed === 0 ? 0 : 1);
