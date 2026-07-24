// Test de smoke: valida Feature 4 (Firma) + Feature 5 (Adjuntos reales)
const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'renderer', 'bandeja-integrada', 'app.js');
const cssPath = path.join(__dirname, '..', 'renderer', 'bandeja-integrada', 'styles.css');
const htmlPath = path.join(__dirname, '..', 'renderer', 'bandeja-integrada', 'index.html');
const preloadPath = path.join(__dirname, '..', 'preload.js');
const mainPath = path.join(__dirname, '..', 'main.js');

const appSrc = fs.readFileSync(appPath, 'utf8');
const cssSrc = fs.readFileSync(cssPath, 'utf8');
const htmlSrc = fs.readFileSync(htmlPath, 'utf8');
const preloadSrc = fs.readFileSync(preloadPath, 'utf8');
const mainSrc = fs.readFileSync(mainPath, 'utf8');

const checks = [];

// === Feature 5: Adjuntos reales ===
checks.push({ name: 'main.js: IPC email-cache:get-attachments', ok: /ipcMain\.handle\(['"]email-cache:get-attachments['"]/.test(mainSrc) });
checks.push({ name: 'preload.js: emailCache.getAttachments API', ok: /emailCache[\s\S]{0,2000}getAttachments/.test(preloadSrc) });
checks.push({ name: 'preload.js: googleGmail.downloadAttachment API', ok: /googleGmail[\s\S]{0,2000}downloadAttachment/.test(preloadSrc) });
checks.push({ name: 'JS: loadMailBodyFromCache carga attachments', ok: /loadMailBodyFromCache[\s\S]{0,1500}getAttachments/.test(appSrc) });
checks.push({ name: 'JS: formatAttachmentSize helper', ok: /function formatAttachmentSize/.test(appSrc) });
checks.push({ name: 'JS: attachmentIcon helper', ok: /function attachmentIcon/.test(appSrc) });
checks.push({ name: 'JS: downloadMailAttachment async function', ok: /async function downloadMailAttachment/.test(appSrc) });
checks.push({ name: 'JS: renderMailDetail usa allAttachments (no hardcoded)', ok: /allAttachments/.test(appSrc) && !/Acta_Comite_Q2\.pdf/.test(appSrc) });
checks.push({ name: 'JS: attachment-chip click llama downloadMailAttachment', ok: /downloadMailAttachment\(a\._messageId, a\.attachment_id/.test(appSrc) });

// === Feature 4: Firma editor ===
checks.push({ name: 'HTML: btn-signature existe', ok: /id="btn-signature"/.test(htmlSrc) });
checks.push({ name: 'JS: btn-signature listener registrado', ok: /\$\("#btn-signature"\)\.addEventListener/.test(appSrc) });
checks.push({ name: 'JS: openSignatureModal function', ok: /function openSignatureModal/.test(appSrc) });
checks.push({ name: 'JS: openSignatureModal lee localStorage', ok: /localStorage\.getItem\(['"]kair\.emailSignature['"]\)/.test(appSrc) });
checks.push({ name: 'JS: openSignatureModal guarda en localStorage', ok: /localStorage\.setItem\(['"]kair\.emailSignature['"]/.test(appSrc) });
checks.push({ name: 'JS: openSignatureModal tiene live preview', ok: /sig-preview/.test(appSrc) && /input.*sig-preview|input[\s\S]{0,300}sig-preview/s.test(appSrc) });
checks.push({ name: 'CSS: .kair-signature-modal existe', ok: /\.kair-signature-modal\s*\{/.test(cssSrc) });
checks.push({ name: 'CSS: .kair-signature-modal-overlay existe', ok: /\.kair-signature-modal-overlay\s*\{/.test(cssSrc) });
checks.push({ name: 'CSS: .kair-signature-modal__textarea existe', ok: /\.kair-signature-modal__textarea\s*\{/.test(cssSrc) });
checks.push({ name: 'CSS: .kair-signature-modal__preview existe', ok: /\.kair-signature-modal__preview\s*\{/.test(cssSrc) });

// === Cache-bust ===
const rendPath = path.join(__dirname, '..', 'renderer.js');
const rendSrc = fs.readFileSync(rendPath, 'utf8');
const m = rendSrc.match(/bandeja-integrada\/index\.html\?v=(\d+)/);
checks.push({ name: 'Cache-bust >= 610', ok: m && parseInt(m[1], 10) >= 610, val: m ? m[1] : 'none' });

// Reporte
console.log('\n=== TEST FIXES LOOP 2 (Adjuntos + Firma) ===');
var failed = 0;
checks.forEach(function (c) {
  const mark = c.ok ? 'OK  ' : 'FAIL';
  const val = c.val !== undefined ? ' (' + c.val + ')' : '';
  console.log('[' + mark + '] ' + c.name + val);
  if (!c.ok) failed++;
});
console.log('\n' + (failed === 0 ? 'TODOS LOS FIXES APLICADOS' : failed + ' FIXES FALLARON'));
process.exit(failed === 0 ? 0 : 1);
