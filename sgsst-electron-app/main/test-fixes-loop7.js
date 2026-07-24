// Test de smoke: valida fixes del loop 7 (auditoría visual del preview)
const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'renderer', 'bandeja-integrada', 'app.js');
const cssPath = path.join(__dirname, '..', 'renderer', 'bandeja-integrada', 'styles.css');
const htmlPath = path.join(__dirname, '..', 'renderer', 'bandeja-integrada', 'index.html');

const appSrc = fs.readFileSync(appPath, 'utf8');
const cssSrc = fs.readFileSync(cssPath, 'utf8');
const htmlSrc = fs.readFileSync(htmlPath, 'utf8');

const checks = [];

// === Mejora 1: Avatares 32x32 ===
checks.push({ name: 'CSS: .email-row__avatar 32x32 (no 40x40)', ok: /\.email-row__avatar\s*\{[^}]*width:\s*32px/.test(cssSrc) });

// === Mejora 2: Sort toggle ===
checks.push({ name: 'JS: kair-mail-list-header__sort existe', ok: /kair-mail-list-header__sort/.test(appSrc) });
checks.push({ name: 'JS: state.mailSortBy existe', ok: /state\.mailSortBy/.test(appSrc) });
checks.push({ name: 'JS: sort con 3 modos (recent/oldest/unread)', ok: appSrc.indexOf('mailSortBy === "recent"') > -1 && appSrc.indexOf('mailSortBy === "oldest"') > -1 && (appSrc.indexOf('mailSortBy === "unread"') > -1 || appSrc.indexOf('mailSortBy = "unread"') > -1) });
checks.push({ name: 'JS: filtered.sort aplicado', ok: /filtered\.sort\(function/.test(appSrc) });
checks.push({ name: 'CSS: .kair-mail-list-header__sort existe', ok: /\.kair-mail-list-header__sort\s*\{/.test(cssSrc) });

// === Mejora 3: Versión 0.1.120 en el footer ===
checks.push({ name: 'HTML: footer dice v0.1.120 (no v0.1.119)', ok: /Bandeja Integrada v0\.1\.120/.test(htmlSrc) && !/Bandeja Integrada v0\.1\.119/.test(htmlSrc) });

// === Cache-bust ===
const rendPath = path.join(__dirname, '..', 'renderer.js');
const rendSrc = fs.readFileSync(rendPath, 'utf8');
const m = rendSrc.match(/bandeja-integrada\/index\.html\?v=(\d+)/);
checks.push({ name: 'Cache-bust >= 616', ok: m && parseInt(m[1], 10) >= 616, val: m ? m[1] : 'none' });

// Reporte
console.log('\n=== TEST FIXES LOOP 7 (Auditoría visual preview) ===');
var failed = 0;
checks.forEach(function (c) {
  const mark = c.ok ? 'OK  ' : 'FAIL';
  const val = c.val !== undefined ? ' (' + c.val + ')' : '';
  console.log('[' + mark + '] ' + c.name + val);
  if (!c.ok) failed++;
});
console.log('\n' + (failed === 0 ? 'TODOS LOS FIXES APLICADOS' : failed + ' FIXES FALLARON'));
process.exit(failed === 0 ? 0 : 1);
