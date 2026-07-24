// Test de smoke: valida Feature 2 (Operadores de búsqueda con chips visuales)
const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'renderer', 'bandeja-integrada', 'app.js');
const cssPath = path.join(__dirname, '..', 'renderer', 'bandeja-integrada', 'styles.css');

const appSrc = fs.readFileSync(appPath, 'utf8');
const cssSrc = fs.readFileSync(cssPath, 'utf8');

const checks = [];

// === Feature 2: Operadores de búsqueda con chips visuales ===
checks.push({ name: 'JS: getActiveOperators function', ok: /function getActiveOperators/.test(appSrc) });
checks.push({ name: 'JS: getActiveOperators devuelve chips con key/value/label', ok: /getActiveOperators[\s\S]{0,1500}chips\.push\(\{ key: key, value: value, label: label, originalText: originalText \}\)/.test(appSrc) });
checks.push({ name: 'JS: removeOperatorFromQuery function', ok: /function removeOperatorFromQuery/.test(appSrc) });
checks.push({ name: 'JS: updateOperatorChips function', ok: /function updateOperatorChips/.test(appSrc) });
checks.push({ name: 'JS: updateOperatorChips llamado desde input handler', ok: /searchInput\.addEventListener\(['"]input['"][\s\S]{0,500}updateOperatorChips/.test(appSrc) });
checks.push({ name: 'JS: updateOperatorChips llamado en init', ok: /updateOperatorChips\(searchContainer, searchInput, applySearchFilter\)/.test(appSrc) });
checks.push({ name: 'JS: chip remove handler limpia el query', ok: /state\.searchQuery = removeOperatorFromQuery/.test(appSrc) });
checks.push({ name: 'JS: getActiveOperators maneja from/to/subject/has/after/before', ok: /getActiveOperators[\s\S]{0,800}key === 'from'[\s\S]{0,800}key === 'after'/.test(appSrc) });
checks.push({ name: 'JS: clearBtn limpia los chips', ok: /clearBtn\.addEventListener[\s\S]{0,500}searchContainer\.querySelector\(\"\.kair-mail-search__chips\"\)/.test(appSrc) });
checks.push({ name: 'JS: ESC handler limpia los chips', ok: /Escape[\s\S]{0,400}searchContainer\.querySelector\(\"\.kair-mail-search__chips\"\)/.test(appSrc) });
checks.push({ name: 'CSS: .kair-mail-search__chips existe', ok: /\.kair-mail-search__chips\s*\{/.test(cssSrc) });
checks.push({ name: 'CSS: .kair-mail-search__chip existe', ok: /\.kair-mail-search__chip\s*\{/.test(cssSrc) });
checks.push({ name: 'CSS: .kair-mail-search__chip-remove existe', ok: /\.kair-mail-search__chip-remove\s*\{/.test(cssSrc) });

// === Cache-bust ===
const rendPath = path.join(__dirname, '..', 'renderer.js');
const rendSrc = fs.readFileSync(rendPath, 'utf8');
const m = rendSrc.match(/bandeja-integrada\/index\.html\?v=(\d+)/);
checks.push({ name: 'Cache-bust >= 612', ok: m && parseInt(m[1], 10) >= 612, val: m ? m[1] : 'none' });

// Reporte
console.log('\n=== TEST FIXES LOOP 4 (Operadores con chips) ===');
var failed = 0;
checks.forEach(function (c) {
  const mark = c.ok ? 'OK  ' : 'FAIL';
  const val = c.val !== undefined ? ' (' + c.val + ')' : '';
  console.log('[' + mark + '] ' + c.name + val);
  if (!c.ok) failed++;
});
console.log('\n' + (failed === 0 ? 'TODOS LOS FIXES APLICADOS' : failed + ' FIXES FALLARON'));
process.exit(failed === 0 ? 0 : 1);
