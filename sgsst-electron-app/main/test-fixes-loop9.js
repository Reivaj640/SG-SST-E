// Test de smoke: valida fixes del loop 9 (ajustes visuales bandeja de correos)
const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'renderer', 'bandeja-integrada', 'app.js');
const cssPath = path.join(__dirname, '..', 'renderer', 'bandeja-integrada', 'styles.css');

const appSrc = fs.readFileSync(appPath, 'utf8');
const cssSrc = fs.readFileSync(cssPath, 'utf8');

const checks = [];

// === Mejora 1: formatGmailLongDate ===
checks.push({ name: 'JS: formatGmailLongDate function existe', ok: /function formatGmailLongDate/.test(appSrc) });
checks.push({ name: 'JS: formatGmailLongDate tiene weekdays array', ok: /var weekdays = \["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"\]/.test(appSrc) });
checks.push({ name: 'JS: formatGmailLongDate tiene months array', ok: appSrc.indexOf('var months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio"') > -1 });
checks.push({ name: 'JS: thread header usa formatGmailLongDate', ok: /formatGmailLongDate\(mail\.date\)/.test(appSrc) });

// === Mejora 2: "1 de N" dinámico ===
checks.push({ name: 'JS: currentIndex del correo seleccionado', ok: /currentIndex = state\.mails\.findIndex/.test(appSrc) });
checks.push({ name: 'JS: currentPos dinámico', ok: /currentPos\s*=\s*currentIndex >= 0 \? \(currentIndex \+ 1\)/.test(appSrc) });
checks.push({ name: 'JS: nav muestra currentPos de totalMails', ok: /\$\{currentPos\} de \$\{totalMails\}/.test(appSrc) });
checks.push({ name: 'JS: NO hardcodea "1 de 1"', ok: !/nav\.innerHTML = `<span[^>]*>1 de 1<\/span>`/.test(appSrc) });

// === Mejora 3: Banner de invitación mejorado ===
checks.push({ name: 'CSS: .kair-mail-detail__meeting-banner tiene box-shadow', ok: /\.kair-mail-detail__meeting-banner\s*\{[^}]*box-shadow:/.test(cssSrc) });
checks.push({ name: 'CSS: .kair-mail-detail__meeting-icon width 40px', ok: /\.kair-mail-detail__meeting-icon\s*\{[^}]*width:\s*40px/.test(cssSrc) });
checks.push({ name: 'CSS: .kair-mail-detail__reply tiene gap 10px', ok: /\.kair-mail-detail__reply\s*\{[^}]*gap:\s*10px/.test(cssSrc) });

// === Mejora 4: Avatar del sender más grande y mejor ===
checks.push({ name: 'CSS: .kair-mail-detail__avatar width 48px', ok: /\.kair-mail-detail__avatar\s*\{[^}]*width:\s*48px/.test(cssSrc) });
checks.push({ name: 'CSS: .kair-mail-detail__sender-row align-items center', ok: /\.kair-mail-detail__sender-row\s*\{[^}]*align-items:\s*center/.test(cssSrc) });
checks.push({ name: 'CSS: .kair-mail-detail__sender-row gap 14px', ok: /\.kair-mail-detail__sender-row\s*\{[^}]*gap:\s*14px/.test(cssSrc) });

// === Cache-bust ===
const rendPath = path.join(__dirname, '..', 'renderer.js');
const rendSrc = fs.readFileSync(rendPath, 'utf8');
const m = rendSrc.match(/bandeja-integrada\/index\.html\?v=(\d+)/);
checks.push({ name: 'Cache-bust >= 618', ok: m && parseInt(m[1], 10) >= 618, val: m ? m[1] : 'none' });

// Reporte
console.log('\n=== TEST FIXES LOOP 9 (Bandeja de correos) ===');
var failed = 0;
checks.forEach(function (c) {
  const mark = c.ok ? 'OK  ' : 'FAIL';
  const val = c.val !== undefined ? ' (' + c.val + ')' : '';
  console.log('[' + mark + '] ' + c.name + val);
  if (!c.ok) failed++;
});
console.log('\n' + (failed === 0 ? 'TODOS LOS FIXES APLICADOS' : failed + ' FIXES FALLARON'));
process.exit(failed === 0 ? 0 : 1);
