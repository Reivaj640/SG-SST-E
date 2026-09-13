/* Test del z-index del header y panel del update (📦547)
 * Valida que ambos elementos tienen z-index suficientemente alto
 * para escapar el stacking context que crea Vanta.js.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
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
console.log('Test: z-index del header y panel update (📦547)');
console.log('========================================');
console.log('');

if (!fs.existsSync(stylesPath)) {
  console.error('FAIL: styles.css no existe');
  process.exit(1);
}

const css = fs.readFileSync(stylesPath, 'utf8');

test('#app-header tiene z-index >= 100000 (escapa Vanta)', () => {
  // Buscar el bloque #app-header { ... }
  const idx = css.indexOf('#app-header {');
  if (idx < 0) throw new Error('No se encontró el bloque #app-header');
  const block = css.slice(idx, idx + 800);
  const match = block.match(/z-index:\s*(\d+)/);
  if (!match) throw new Error('z-index no encontrado en #app-header');
  const value = parseInt(match[1], 10);
  if (value < 100000) {
    throw new Error(`z-index del #app-header es ${value}, debería ser >= 100000 para escapar el stacking context de Vanta`);
  }
});

test('#app-header tiene isolation: isolate (escapa stacking context)', () => {
  const idx = css.indexOf('#app-header {');
  if (idx < 0) throw new Error('No se encontró el bloque #app-header');
  const block = css.slice(idx, idx + 800);
  if (!/isolation:\s*isolate/.test(block)) {
    throw new Error('#app-header no tiene "isolation: isolate" — sin esto, el header puede quedar atrapado en un stacking context externo');
  }
});

test('.header-update-panel tiene z-index > z-index del #app-header', () => {
  const headerMatch = css.match(/#app-header\s*\{[^}]*z-index:\s*(\d+)/);
  const panelMatch = css.match(/\.header-update-panel\s*\{[^}]*z-index:\s*(\d+)/);
  if (!headerMatch) throw new Error('No se encontró z-index del #app-header');
  if (!panelMatch) throw new Error('No se encontró z-index del .header-update-panel');
  const headerZ = parseInt(headerMatch[1], 10);
  const panelZ = parseInt(panelMatch[1], 10);
  if (panelZ <= headerZ) {
    throw new Error(`Panel z-index (${panelZ}) debería ser MAYOR que header z-index (${headerZ}) — el panel debe renderizarse ENCIMA del header`);
  }
});

test('.header-update-panel tiene z-index >= 100001', () => {
  const panelMatch = css.match(/\.header-update-panel\s*\{[^}]*z-index:\s*(\d+)/);
  if (!panelMatch) throw new Error('No se encontró z-index del .header-update-panel');
  const value = parseInt(panelMatch[1], 10);
  if (value < 100001) {
    throw new Error(`z-index del .header-update-panel es ${value}, debería ser >= 100001`);
  }
});

test('#notification-hub (toast) tiene z-index MUY alto', () => {
  const idx = css.indexOf('#notification-hub {');
  if (idx < 0) throw new Error('No se encontró #notification-hub');
  const block = css.slice(idx, idx + 600);
  const match = block.match(/z-index:\s*(\d+)/);
  if (!match) throw new Error('z-index no encontrado en #notification-hub');
  const value = parseInt(match[1], 10);
  if (value < 100000) {
    throw new Error(`z-index de #notification-hub es ${value}, debería ser >= 100000 para garantizar que el toast se vea siempre`);
  }
});

console.log('');
console.log('========================================');
console.log(`Resultado: ${passed} OK / ${failed} FAIL`);
console.log('========================================');

process.exit(failed > 0 ? 1 : 0);
