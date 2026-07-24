// Test de smoke: valida fixes del loop 6 (errores runtime)
const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'renderer', 'bandeja-integrada', 'app.js');
const cssPath = path.join(__dirname, '..', 'renderer', 'bandeja-integrada', 'styles.css');

const appSrc = fs.readFileSync(appPath, 'utf8');
const cssSrc = fs.readFileSync(cssPath, 'utf8');

const checks = [];

// === Fix 1: m is not defined en renderMailDetail ===
checks.push({ name: 'JS: star icon del header usa mail.flagged (NO m.flagged)', ok: /D\.ICONS\.star\.replace[\s\S]{0,200}mail\.flagged \? 'fill="currentColor"'/.test(appSrc) });
// (Los otros m.flagged en app.js están dentro de forEach((m) => ...) o filter((m) => ...), son legítimos)

// === Fix 2: ERR_FILE_NOT_FOUND de tailwindcss ===
checks.push({ name: 'CSS: NO hay @import "tailwindcss"', ok: !/@import\s+["']tailwindcss["']/.test(cssSrc) });
checks.push({ name: 'CSS: NO hay @import "tw-animate-css"', ok: !/@import\s+["']tw-animate-css["']/.test(cssSrc) });

// === Cache-bust ===
const rendPath = path.join(__dirname, '..', 'renderer.js');
const rendSrc = fs.readFileSync(rendPath, 'utf8');
const m = rendSrc.match(/bandeja-integrada\/index\.html\?v=(\d+)/);
checks.push({ name: 'Cache-bust >= 615', ok: m && parseInt(m[1], 10) >= 615, val: m ? m[1] : 'none' });

// Reporte
console.log('\n=== TEST FIXES LOOP 6 (Errores runtime) ===');
var failed = 0;
checks.forEach(function (c) {
  const mark = c.ok ? 'OK  ' : 'FAIL';
  const val = c.val !== undefined ? ' (' + c.val + ')' : '';
  console.log('[' + mark + '] ' + c.name + val);
  if (!c.ok) failed++;
});
console.log('\n' + (failed === 0 ? 'TODOS LOS FIXES APLICADOS' : failed + ' FIXES FALLARON'));
process.exit(failed === 0 ? 0 : 1);
