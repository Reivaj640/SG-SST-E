// Test de smoke: valida que los fixes del loop 1 están aplicados correctamente.
const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'renderer', 'bandeja-integrada', 'app.js');
const cssPath = path.join(__dirname, '..', 'renderer', 'bandeja-integrada', 'styles.css');

const appSrc = fs.readFileSync(appPath, 'utf8');
const cssSrc = fs.readFileSync(cssPath, 'utf8');

const checks = [];

// Fix 1 — Hover: la fecha debe ocultarse en hover
checks.push({ name: 'CSS: kair-mail-row:hover oculta kair-mail-row__time', ok: /\.kair-mail-row:hover\s+\.kair-mail-row__time\s*\{[^}]*opacity:\s*0/.test(cssSrc) });

// Fix 2 — msgContainer flex para que avatar+header estén en línea
checks.push({ name: 'JS: msgContainer tiene display: flex', ok: /msgContainer[\s\S]{0,500}display:\s*"flex"/.test(appSrc) });
checks.push({ name: 'JS: msgContainer tiene alignItems: flex-start', ok: /msgContainer[\s\S]{0,500}alignItems:\s*"flex-start"/.test(appSrc) });
checks.push({ name: 'JS: msgContainer tiene gap: 12px', ok: /msgContainer[\s\S]{0,500}gap:\s*"12px"/.test(appSrc) });

// Fix 3 — word-break del email del remitente
checks.push({ name: 'JS: msgSenderName tiene textOverflow: ellipsis', ok: /msgSenderName[\s\S]{0,400}textOverflow:\s*"ellipsis"/.test(appSrc) });
checks.push({ name: 'JS: msgSenderEmail tiene textOverflow: ellipsis', ok: /msgSenderEmail[\s\S]{0,400}textOverflow:\s*"ellipsis"/.test(appSrc) });
checks.push({ name: 'JS: msgSenderName tiene whiteSpace: nowrap', ok: /msgSenderName[\s\S]{0,400}whiteSpace:\s*"nowrap"/.test(appSrc) });

// Fix 4 — Quote del reply: bloque HTML visual, NO texto plano
checks.push({ name: 'JS: quoteHtml variable existe', ok: /var quoteHtml\s*=/.test(appSrc) });
checks.push({ name: 'JS: quoteHtml tiene compose-panel__quote', ok: /compose-panel__quote/.test(appSrc) });
checks.push({ name: 'JS: textarea vacío (sin quotedBody prellenado)', ok: /<textarea[^>]*id="compose-body"[^>]*><\/textarea>/.test(appSrc) });
checks.push({ name: 'JS: sendComposedMail concatena quote con "> "', ok: /split\('\\n'\)\.map\(function\s*\(line\)\s*\{\s*return\s*'> '\s*\+\s*line/.test(appSrc) });
checks.push({ name: 'JS: sendComposedMail usa bodyWithQuoteAndSignature', ok: /bodyWithQuoteAndSignature/.test(appSrc) });

// CSS del quote
checks.push({ name: 'CSS: .compose-panel__quote existe', ok: /\.compose-panel__quote\s*\{/.test(cssSrc) });
checks.push({ name: 'CSS: .compose-panel__quote-avatar existe', ok: /\.compose-panel__quote-avatar\s*\{/.test(cssSrc) });
checks.push({ name: 'CSS: .compose-panel__quote-body existe', ok: /\.compose-panel__quote-body\s*\{/.test(cssSrc) });

// Fix 5 — "para: —" no se muestra si no hay recipient
checks.push({ name: 'JS: mail.recipient conditional en header (no muestra "—")', ok: /mail\.recipient \? '<p class="kair-mail-detail__recipient">para: ' \+ mail\.recipient/.test(appSrc) });
checks.push({ name: 'JS: msgToLine condicional (solo si hay recipients)', ok: /if \(toListParsed\.length > 0\)/.test(appSrc) });

// Cache-bust
const rendPath = path.join(__dirname, '..', 'renderer.js');
const rendSrc = fs.readFileSync(rendPath, 'utf8');
const m = rendSrc.match(/bandeja-integrada\/index\.html\?v=(\d+)/);
checks.push({ name: 'Cache-bust >= 608', ok: m && parseInt(m[1], 10) >= 608, val: m ? m[1] : 'none' });

// Reporte
console.log('\n=== TEST FIXES LOOP 1 ===');
var failed = 0;
checks.forEach(function (c) {
  const mark = c.ok ? 'OK  ' : 'FAIL';
  const val = c.val !== undefined ? ' (' + c.val + ')' : '';
  console.log('[' + mark + '] ' + c.name + val);
  if (!c.ok) failed++;
});
console.log('\n' + (failed === 0 ? 'TODOS LOS FIXES APLICADOS' : failed + ' FIXES FALLARON'));
process.exit(failed === 0 ? 0 : 1);
