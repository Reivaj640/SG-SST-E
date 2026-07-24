// Test de smoke: valida fixes del loop 10 (auditoría code-reviewer + ui-ux-pro-max)
const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'renderer', 'bandeja-integrada', 'app.js');

const appSrc = fs.readFileSync(appPath, 'utf8');

const checks = [];

// === Fix UX #3: aria-label en "1 de N" ===
checks.push({ name: 'JS: nav tiene aria-label con currentPos y totalMails', ok: /aria-label="Correo \$\{currentPos\} de \$\{totalMails\}"/.test(appSrc) });

// === Fix Code-reviewer #1: race condition del starBtn ===
checks.push({ name: 'JS: starBtn usa render() (sin setAttribute data-active)', ok: /starBtn\.addEventListener[\s\S]{0,300}mail\.flagged = !mail\.flagged;[\s\S]{0,100}render\(\);/.test(appSrc) });
checks.push({ name: 'JS: NO hay setAttribute data-active en el handler de starBtn', ok: !/starBtn\.setAttribute\("data-active"/.test(appSrc) });

// === Fix Code-reviewer #2: archiveBtn usa api.googleGmail directo ===
checks.push({ name: 'JS: archiveBtn handler llama api.googleGmail.archiveThread', ok: /archiveBtn\.addEventListener[\s\S]{0,500}api\.googleGmail\.archiveThread/.test(appSrc) });
checks.push({ name: 'JS: NO hay referencia a archiveMail (función inexistente)', ok: !/typeof archiveMail === "function"/.test(appSrc) });

// === Fix Code-reviewer extra: deleteBtn con confirm() ===
checks.push({ name: 'JS: deleteBtn tiene confirm() antes de eliminar', ok: /deleteBtn\.addEventListener[\s\S]{0,500}confirm\(/.test(appSrc) });
checks.push({ name: 'JS: deleteBtn remueve de state.mails', ok: /deleteBtn\.addEventListener[\s\S]{0,800}state\.mails = state\.mails\.filter/.test(appSrc) });

// === Cache-bust ===
const rendPath = path.join(__dirname, '..', 'renderer.js');
const rendSrc = fs.readFileSync(rendPath, 'utf8');
const m = rendSrc.match(/bandeja-integrada\/index\.html\?v=(\d+)/);
checks.push({ name: 'Cache-bust >= 619', ok: m && parseInt(m[1], 10) >= 619, val: m ? m[1] : 'none' });

// Reporte
console.log('\n=== TEST FIXES LOOP 10 (code-reviewer + ui-ux-pro-max) ===');
var failed = 0;
checks.forEach(function (c) {
  const mark = c.ok ? 'OK  ' : 'FAIL';
  const val = c.val !== undefined ? ' (' + c.val + ')' : '';
  console.log('[' + mark + '] ' + c.name + val);
  if (!c.ok) failed++;
});
console.log('\n' + (failed === 0 ? 'TODOS LOS FIXES APLICADOS' : failed + ' FIXES FALLARON'));
process.exit(failed === 0 ? 0 : 1);
