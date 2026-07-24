// Test de smoke: valida fixes del loop 5 (visual Gmail-style)
const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'renderer', 'bandeja-integrada', 'app.js');
const cssPath = path.join(__dirname, '..', 'renderer', 'bandeja-integrada', 'styles.css');

const appSrc = fs.readFileSync(appPath, 'utf8');
const cssSrc = fs.readFileSync(cssPath, 'utf8');

const checks = [];

// === Fix #7: Body sin "De:/Enviado:/Para:/Asunto:" como texto plano ===
checks.push({ name: 'JS: renderMailBodyHtml limpia headers MIME línea por línea', ok: /renderMailBodyHtml[\s\S]{0,2000}mimeHeaderPattern/.test(appSrc) });
checks.push({ name: 'JS: regex detecta De, From, Enviado, Sent, Para, To, Asunto, Subject', ok: /mimeHeaderPattern\s*=\s*\/\^\\s\*\(De\|From\|Enviado\|Sent\|Para\|To\|Asunto\|Subject\|CC\|Cc\|CCO\|Bcc\|Cco\|Fecha\|Date/.test(appSrc) });
checks.push({ name: 'JS: filtra headers en filteredLines', ok: /filteredLines\.push/.test(appSrc) });
checks.push({ name: 'JS: limpia separador "Forwarded message"', ok: /Forwarded message/.test(appSrc) });

// === Fix #4: Word-break del email (no cortar) ===
checks.push({ name: 'JS: msgSenderEmail usa overflow-wrap: anywhere', ok: /msgSenderEmail[\s\S]{0,500}overflowWrap:\s*"anywhere"/.test(appSrc) });
checks.push({ name: 'JS: msgSenderEmail NO tiene textOverflow: ellipsis (no cortar)', ok: !/msgSenderEmail[\s\S]{0,500}textOverflow:\s*"ellipsis"/.test(appSrc) });

// === Fix #8: Formato "hace X horas" ===
checks.push({ name: 'JS: formatRelativeTime function', ok: /function formatRelativeTime/.test(appSrc) });
checks.push({ name: 'JS: formatRelativeTime retorna "hace X horas"', ok: /"hace "/.test(appSrc) });
checks.push({ name: 'JS: thread header usa formatRelativeTime', ok: /formatRelativeTime\(mail\.date\)/.test(appSrc) });

// === Fix #1: Label "Recibidos" como chip ===
checks.push({ name: 'JS: header tiene folderChipHtml', ok: /folderChipHtml/.test(appSrc) });
checks.push({ name: 'JS: folderLabel es "Recibidos"/"Enviados"/"Borradores"', ok: /folderLabel\s*=\s*\(state\.mailFolder === 'SENT'\) \? 'Enviados'/.test(appSrc) });
checks.push({ name: 'CSS: .kair-mail-detail__folder-label existe', ok: /\.kair-mail-detail__folder-label\s*\{/.test(cssSrc) });
checks.push({ name: 'CSS: .kair-mail-detail__folder-remove existe', ok: /\.kair-mail-detail__folder-remove\s*\{/.test(cssSrc) });

// === Cache-bust ===
const rendPath = path.join(__dirname, '..', 'renderer.js');
const rendSrc = fs.readFileSync(rendPath, 'utf8');
const m = rendSrc.match(/bandeja-integrada\/index\.html\?v=(\d+)/);
checks.push({ name: 'Cache-bust >= 613', ok: m && parseInt(m[1], 10) >= 613, val: m ? m[1] : 'none' });

// Reporte
console.log('\n=== TEST FIXES LOOP 5 (Visual Gmail-style) ===');
var failed = 0;
checks.forEach(function (c) {
  const mark = c.ok ? 'OK  ' : 'FAIL';
  const val = c.val !== undefined ? ' (' + c.val + ')' : '';
  console.log('[' + mark + '] ' + c.name + val);
  if (!c.ok) failed++;
});
console.log('\n' + (failed === 0 ? 'TODOS LOS FIXES APLICADOS' : failed + ' FIXES FALLARON'));
process.exit(failed === 0 ? 0 : 1);
