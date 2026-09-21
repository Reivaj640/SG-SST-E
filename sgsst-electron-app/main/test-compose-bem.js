// Test de smoke: valida que el HTML generado por openComposeModal tiene
// estructura BEM correcta y los handlers de minimizar/maximizar están cableados.
const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'renderer', 'bandeja-integrada', 'app.js');
const cssPath = path.join(__dirname, '..', 'renderer', 'bandeja-integrada', 'styles.css');

const appSrc = fs.readFileSync(appPath, 'utf8');
const cssSrc = fs.readFileSync(cssPath, 'utf8');

const results = [];

// 1) Clases BEM en el HTML generado del compose
const bemClasses = [
  'compose-panel-overlay',
  'compose-panel',
  'compose-panel__titlebar',
  'compose-panel__title',
  'compose-panel__actions',
  'compose-panel__btn--minimize',
  'compose-panel__btn--maximize',
  'compose-panel__btn--close',
  'compose-panel__body',
  'compose-panel__field',
  'compose-panel__field--body',
  'compose-panel__input',
  'compose-panel__textarea',
  'compose-panel__toolbar',
  'compose-panel__toolbar__btn',
  'compose-panel__toolbar__sep',
  'compose-panel__footer',
  'compose-panel__send',
  'compose-panel__hint',
];
bemClasses.forEach(function (cls) {
  const present = appSrc.indexOf(cls) !== -1;
  results.push({ check: 'JS contains class "' + cls + '"', ok: present });
});

// 2) Estado minimizable
results.push({ check: 'JS has compose-panel--minimized class', ok: appSrc.indexOf('compose-panel--minimized') !== -1 });
results.push({ check: 'JS has setMinimized function', ok: appSrc.indexOf('function setMinimized') !== -1 || appSrc.indexOf('var setMinimized = function') !== -1 });

// 3) CSS contiene los selectores BEM
const cssBEM = [
  '.compose-panel-overlay',
  '.compose-panel',
  '.compose-panel__titlebar',
  '.compose-panel__title',
  '.compose-panel__actions',
  '.compose-panel__btn',
  '.compose-panel__body',
  '.compose-panel__field',
  '.compose-panel__field--body',
  '.compose-panel__input',
  '.compose-panel__textarea',
  '.compose-panel__toolbar',
  '.compose-panel__toolbar__btn',
  '.compose-panel__footer',
  '.compose-panel__send',
  '.compose-panel__hint',
  '.compose-panel--minimized',
  '.compose-panel__btn--maximize',
];
cssBEM.forEach(function (sel) {
  const present = cssSrc.indexOf(sel) !== -1;
  results.push({ check: 'CSS contains selector "' + sel + '"', ok: present });
});

// 4) Clases VIEJAS no deben quedar
const oldClasses = ['kair-compose-overlay', 'kair-compose-modal', 'kair-compose-header', 'kair-compose-body', 'kair-compose-field', 'kair-compose-textarea', 'kair-compose-send'];
oldClasses.forEach(function (cls) {
  const present = appSrc.indexOf(cls) !== -1;
  results.push({ check: 'JS does NOT contain legacy "' + cls + '"', ok: !present });
});
oldClasses.forEach(function (cls) {
  const present = cssSrc.indexOf(cls) !== -1;
  results.push({ check: 'CSS does NOT contain legacy "' + cls + '"', ok: !present });
});

// 5) Componentes 1-3 BEM también presentes (regression check)
const c123 = ['.email-row', '.thread-header', '.quoted-thread', '.message-block', '.message-block--expanded'];
c123.forEach(function (sel) {
  results.push({ check: 'CSS contains regression "' + sel + '"', ok: cssSrc.indexOf(sel) !== -1 });
});

// 6) Cache-bust actualizado
const rendPath = path.join(__dirname, '..', 'renderer.js');
const rendSrc = fs.readFileSync(rendPath, 'utf8');
const match = rendSrc.match(/bandeja-integrada\/index\.html\?v=(\d+)/);
results.push({ check: 'Cache-bust updated (>= 607)', ok: match && parseInt(match[1], 10) >= 607, val: match ? match[1] : 'none' });

// Reporte
console.log('\n=== TEST RESULTS ===');
var failed = 0;
results.forEach(function (r) {
  const mark = r.ok ? 'OK' : 'FAIL';
  const val = r.val !== undefined ? ' (' + r.val + ')' : '';
  console.log('[' + mark + '] ' + r.check + val);
  if (!r.ok) failed++;
});
console.log('\n' + (failed === 0 ? 'ALL CHECKS PASSED' : failed + ' CHECKS FAILED'));
process.exit(failed === 0 ? 0 : 1);
