// Test de smoke: valida fixes del loop 8 (auditoría imagen objetivo)
const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'renderer', 'bandeja-integrada', 'app.js');

const appSrc = fs.readFileSync(appPath, 'utf8');

const checks = [];

// === Fix 1: "para:" como texto plano ===
checks.push({ name: 'JS: recipients usa texto plano (toListParsed.length <= 3)', ok: /toListParsed\.length <= 3/.test(appSrc) && /msgToLine = el\("div"/.test(appSrc) });
checks.push({ name: 'JS: recipients usa DROPDOWN solo si >3 destinatarios', ok: /toListParsed\.length <= 3/.test(appSrc) && /recipientsDetails = el\("details"/.test(appSrc) });

// === Fix 2: "1 de N" dinámico ===
checks.push({ name: 'JS: currentIndex del correo seleccionado', ok: /currentIndex = state\.mails\.findIndex/.test(appSrc) });
checks.push({ name: 'JS: currentPosition dinámico', ok: /currentPosition\s*=\s*currentIndex >= 0/.test(appSrc) });
checks.push({ name: 'JS: prevBtn habilitado solo si no es el primero', ok: /if \(currentIndex <= 0\) \{[^}]*prevBtn\.disabled = true/s.test(appSrc) });
checks.push({ name: 'JS: nextBtn habilitado solo si no es el último', ok: /if \(currentIndex >= totalMails - 1\) \{[^}]*nextBtn\.disabled = true/s.test(appSrc) });

// === Fix 3: formatGmailWeekday ===
checks.push({ name: 'JS: formatGmailWeekday function', ok: /function formatGmailWeekday/.test(appSrc) });
checks.push({ name: 'JS: formatGmailWeekday usa weekdays array', ok: /var weekdays = \["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"\]/.test(appSrc) });
checks.push({ name: 'JS: thread header usa formatGmailWeekday', ok: /formatGmailWeekday\(mail\.date\)/.test(appSrc) });

// === Cache-bust ===
const rendPath = path.join(__dirname, '..', 'renderer.js');
const rendSrc = fs.readFileSync(rendPath, 'utf8');
const m = rendSrc.match(/bandeja-integrada\/index\.html\?v=(\d+)/);
checks.push({ name: 'Cache-bust >= 617', ok: m && parseInt(m[1], 10) >= 617, val: m ? m[1] : 'none' });

// Reporte
console.log('\n=== TEST FIXES LOOP 8 (Auditoría imagen objetivo) ===');
var failed = 0;
checks.forEach(function (c) {
  const mark = c.ok ? 'OK  ' : 'FAIL';
  const val = c.val !== undefined ? ' (' + c.val + ')' : '';
  console.log('[' + mark + '] ' + c.name + val);
  if (!c.ok) failed++;
});
console.log('\n' + (failed === 0 ? 'TODOS LOS FIXES APLICADOS' : failed + ' FIXES FALLARON'));
process.exit(failed === 0 ? 0 : 1);
