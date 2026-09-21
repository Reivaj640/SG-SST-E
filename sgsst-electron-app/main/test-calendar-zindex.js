/* Test: z-index del calendario debe estar por encima del header (📦548)
 * Valida que el modal del calendario y el popover tienen z-index suficiente
 * para no quedar tapados por el #app-header (100000) y el panel del update (100001).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const calCssPath = path.join(ROOT, 'shared', 'kair-calendar.css');
const stylesPath = path.join(ROOT, 'styles.css');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  OK   ${name}`);
    passed++;
  } catch (err) {
    console.log(`  FAIL ${name}`);
    console.log(`       ${err.message}`);
    failed++;
  }
}

console.log('========================================');
console.log('Test: z-index del calendario (📦548)');
console.log('========================================');
console.log('');

if (!fs.existsSync(calCssPath)) {
  console.error('FAIL: shared/kair-calendar.css no existe');
  process.exit(1);
}

const calCss = fs.readFileSync(calCssPath, 'utf8');

// Header z-index (ya arreglado en 📦547)
let headerZ = 1000;
try {
  const stylesCode = fs.readFileSync(stylesPath, 'utf8');
  const headerMatch = stylesCode.match(/#app-header\s*\{[^}]*z-index:\s*(\d+)/);
  if (headerMatch) headerZ = parseInt(headerMatch[1], 10);
} catch (e) {}

console.log(`Header z-index: ${headerZ}`);
console.log('');

test('.kair-cal-modal-overlay tiene z-index > header', () => {
  const idx = calCss.indexOf('.kair-cal-modal-overlay {');
  if (idx < 0) throw new Error('No se encontró .kair-cal-modal-overlay');
  const block = calCss.slice(idx, idx + 600);
  const match = block.match(/z-index:\s*(\d+)/);
  if (!match) throw new Error('z-index no encontrado en .kair-cal-modal-overlay');
  const value = parseInt(match[1], 10);
  if (value <= headerZ) {
    throw new Error(`.kair-cal-modal-overlay z-index es ${value}, debe ser > ${headerZ} para estar encima del header`);
  }
});

test('.kair-cal-modal-overlay tiene z-index >= 200000', () => {
  const idx = calCss.indexOf('.kair-cal-modal-overlay {');
  if (idx < 0) throw new Error('No se encontró .kair-cal-modal-overlay');
  const block = calCss.slice(idx, idx + 600);
  const match = block.match(/z-index:\s*(\d+)/);
  if (!match) throw new Error('z-index no encontrado en .kair-cal-modal-overlay');
  const value = parseInt(match[1], 10);
  if (value < 200000) {
    throw new Error(`.kair-cal-modal-overlay z-index es ${value}, debería ser >= 200000 para garantizar que esté siempre encima del header (100000) y panel (100001)`);
  }
});

test('El popover antiguo tiene z-index > header (defensa)', () => {
  // Buscar el z-index: 1050 (el original) y verificar que ahora es > header
  const idx = calCss.indexOf('z-index:');
  if (idx < 0) throw new Error('No se encontró ningún z-index en el archivo');
  // Buscar todos los z-index y verificar que el primero (línea ~171) sea > header
  const matches = [...calCss.matchAll(/z-index:\s*(\d+)/g)];
  if (matches.length === 0) throw new Error('No se encontraron z-index');
  // El primero debería ser el del popover
  const firstZ = parseInt(matches[0][1], 10);
  if (firstZ <= headerZ) {
    throw new Error(`El primer z-index encontrado es ${firstZ}, debe ser > ${headerZ}`);
  }
});

test('El switch "Todas las empresas" (toggle) existe en el HTML', () => {
  const calJsPath = path.join(ROOT, 'shared', 'kair-calendar.js');
  if (!fs.existsSync(calJsPath)) throw new Error('kair-calendar.js no existe');
  const calJs = fs.readFileSync(calJsPath, 'utf8');
  if (!/data-kair-cal-action="toggle-scope-all"/.test(calJs)) {
    throw new Error('El toggle "Todas las empresas" no está en kair-calendar.js');
  }
  if (!/Todas las empresas/.test(calJs)) {
    throw new Error('El label "Todas las empresas" no está en kair-calendar.js');
  }
});

test('El toggle tiene CSS definido (.kair-cal-toggle)', () => {
  const idx = calCss.indexOf('.kair-cal-toggle {');
  if (idx < 0) throw new Error('No se encontró el CSS .kair-cal-toggle');
  const block = calCss.slice(idx, idx + 500);
  if (!/display:\s*inline-flex/.test(block) && !/display:\s*flex/.test(block)) {
    throw new Error('.kair-cal-toggle no tiene display: flex/inline-flex');
  }
});

console.log('');
console.log('========================================');
console.log(`Resultado: ${passed} OK / ${failed} FAIL`);
console.log('========================================');

process.exit(failed > 0 ? 1 : 0);
