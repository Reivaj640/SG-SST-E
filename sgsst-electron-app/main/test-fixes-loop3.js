// Test de smoke: valida Feature 6 (Badge N mensajes) + Feature 7 (Auto-refresh)
const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'renderer', 'bandeja-integrada', 'app.js');
const cssPath = path.join(__dirname, '..', 'renderer', 'bandeja-integrada', 'styles.css');

const appSrc = fs.readFileSync(appPath, 'utf8');
const cssSrc = fs.readFileSync(cssPath, 'utf8');

const checks = [];

// === Feature 6: Badge N mensajes en la lista ===
checks.push({ name: 'JS: threadToMail devuelve messageCount', ok: /messageCount:\s*thread\.message_count/.test(appSrc) });
checks.push({ name: 'JS: renderMailList agrega badge si > 1 mensajes', ok: /m\.messageCount\s*&&\s*m\.messageCount\s*>\s*1/.test(appSrc) });
checks.push({ name: 'JS: badge tiene clase kair-mail-row__count', ok: /kair-mail-row__count/.test(appSrc) });
checks.push({ name: 'CSS: .kair-mail-row__count existe', ok: /\.kair-mail-row__count\s*\{/.test(cssSrc) });

// === Feature 7: Auto-refresh cada 5 minutos ===
checks.push({ name: 'JS: startAutoRefresh function', ok: /function startAutoRefresh/.test(appSrc) });
checks.push({ name: 'JS: stopAutoRefresh function', ok: /function stopAutoRefresh/.test(appSrc) });
checks.push({ name: 'JS: setInterval con 5 minutos (5 * 60 * 1000)', ok: /5\s*\*\s*60\s*\*\s*1000/.test(appSrc) });
checks.push({ name: 'JS: visibilitychange listener', ok: /document\.addEventListener\(['"]visibilitychange['"]/.test(appSrc) });
checks.push({ name: 'JS: startAutoRefresh llamado después del init', ok: /\}, 2000\);[\s\S]{0,200}startAutoRefresh\(\)/.test(appSrc) });
checks.push({ name: 'JS: stopAutoRefresh llamado en navigateBack', ok: /navigateBack[\s\S]{0,300}stopAutoRefresh/.test(appSrc) });

// === Cache-bust ===
const rendPath = path.join(__dirname, '..', 'renderer.js');
const rendSrc = fs.readFileSync(rendPath, 'utf8');
const m = rendSrc.match(/bandeja-integrada\/index\.html\?v=(\d+)/);
checks.push({ name: 'Cache-bust >= 611', ok: m && parseInt(m[1], 10) >= 611, val: m ? m[1] : 'none' });

// Reporte
console.log('\n=== TEST FIXES LOOP 3 (Badge N + Auto-refresh) ===');
var failed = 0;
checks.forEach(function (c) {
  const mark = c.ok ? 'OK  ' : 'FAIL';
  const val = c.val !== undefined ? ' (' + c.val + ')' : '';
  console.log('[' + mark + '] ' + c.name + val);
  if (!c.ok) failed++;
});
console.log('\n' + (failed === 0 ? 'TODOS LOS FIXES APLICADOS' : failed + ' FIXES FALLARON'));
process.exit(failed === 0 ? 0 : 1);
