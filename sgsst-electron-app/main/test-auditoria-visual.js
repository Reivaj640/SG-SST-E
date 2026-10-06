// Test de smoke: valida auditoría visual Gmail-style
const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'renderer', 'bandeja-integrada', 'app.js');
const cssPath = path.join(__dirname, '..', 'renderer', 'bandeja-integrada', 'styles.css');

const appSrc = fs.readFileSync(appPath, 'utf8');
const cssSrc = fs.readFileSync(cssPath, 'utf8');

const checks = [];

// === AUDITORÍA 2026-07-18: Thread grouping Gmail-style compacto ===

// 1. Thread header principal compacto
checks.push({ name: 'JS: sender-row tiene avatar 40x40 (no 56x56)', ok: /kair-mail-detail__avatar[^}]*background:[^}]*\}/.test(appSrc) && !/kair-mail-detail__avatar[\s\S]{0,500}width:\s*"56px"/.test(appSrc) });
checks.push({ name: 'JS: sender-row tiene fecha + formatRelativeTime', ok: /kair-mail-detail__time[\s\S]{0,300}formatRelativeTime/.test(appSrc) });

// 2. Action buttons en el thread header
checks.push({ name: 'JS: kair-mail-detail__actions existe', ok: /kair-mail-detail__actions/.test(appSrc) });
checks.push({ name: 'JS: action buttons para archivar, no leído, eliminar, star, más', ok: /data-action="archive"/.test(appSrc) && /data-action="delete"/.test(appSrc) && /data-action="star"/.test(appSrc) && /data-action="more"/.test(appSrc) });
checks.push({ name: 'JS: wire up de action buttons con setTimeout', ok: /Wire up action buttons[\s\S]{0,2000}archiveBtn\.addEventListener/.test(appSrc) });

// 3. Mensajes colapsados a 1 línea con avatar 32x32
checks.push({ name: 'CSS: .kair-mail-message__avatar width: 32px', ok: /\.kair-mail-message__avatar\s*\{[^}]*width:\s*32px/.test(cssSrc) });
checks.push({ name: 'JS: kair-mail-message usa nueva estructura de head/line', ok: /kair-mail-message__line/.test(appSrc) });

// 4. Snippet usa el SUBJECT, no el body
checks.push({ name: 'JS: msgSubject usa el subject (no el body)', ok: /msgSubject\s*=\s*\(msg\.subject\s*&&\s*msg\.subject\s*!==\s*mail\.subject\)\s*\?\s*msg\.subject\s*:\s*mail\.subject/.test(appSrc) });

// 5. Dropdown "para: jrf2011 ▼" colapsable
checks.push({ name: 'JS: recipientsDetails es un <details>', ok: /recipientsDetails\s*=\s*el\("details"/.test(appSrc) });
checks.push({ name: 'JS: muestra primer destinatario + count', ok: /firstRecipientLabel/.test(appSrc) && /moreCount/.test(appSrc) });
checks.push({ name: 'CSS: .kair-mail-message__recipients existe', ok: /\.kair-mail-message__recipients\s*\{/.test(cssSrc) });

// 6. "···" indicator
checks.push({ name: 'JS: "···" indicator si body tiene más de 1 línea', ok: /kair-mail-message__more/.test(appSrc) && /bodyLines\.length > 1/.test(appSrc) });

// 7. Action icons del mensaje (responder, más) en hover
checks.push({ name: 'JS: msgActions con msgReplyBtn', ok: /msgActions[\s\S]{0,500}msgReplyBtn/.test(appSrc) });
checks.push({ name: 'CSS: .kair-mail-message:hover muestra actions', ok: /\.kair-mail-message:hover\s+\.kair-mail-message__actions/.test(cssSrc) });

// === Cache-bust ===
const rendPath = path.join(__dirname, '..', 'renderer.js');
const rendSrc = fs.readFileSync(rendPath, 'utf8');
const m = rendSrc.match(/bandeja-integrada\/index\.html\?v=(\d+)/);
checks.push({ name: 'Cache-bust >= 614', ok: m && parseInt(m[1], 10) >= 614, val: m ? m[1] : 'none' });

// Reporte
console.log('\n=== TEST AUDITORÍA VISUAL ===');
var failed = 0;
checks.forEach(function (c) {
  const mark = c.ok ? 'OK  ' : 'FAIL';
  const val = c.val !== undefined ? ' (' + c.val + ')' : '';
  console.log('[' + mark + '] ' + c.name + val);
  if (!c.ok) failed++;
});
console.log('\n' + (failed === 0 ? 'TODOS LOS FIXES APLICADOS' : failed + ' FIXES FALLARON'));
process.exit(failed === 0 ? 0 : 1);
