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

// ── 📦581 · INVERTIDOS los 2 checks de .header-update-panel ─────────────────
// Pedían que `.header-update-panel` tuviera z-index. Ese panel se eliminó A
// PROPÓSITO en 📦581 ("🗑️ CSS legacy del header update (200+ líneas)", CHANGELOG) y
// el update pasó al dot del footer. Los checks se invierten en vez de borrarse
// (§7.3): ahora exigen que el panel legacy NO vuelva.
//
// 🔴 Antes de verificar hay que quitar los comentarios (§5.15). En styles.css:891 el
// nombre sobrevive DENTRO de un comentario —"ancla para .header-update-panel"— y un
// check que leyera el CSS crudo lo encontraría ahí, daría verde, y el panel podría
// haber vuelto sin que nadie lo notara.
const cssSinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, '');

test('.header-update-panel NO vuelve al CSS (📦581 lo eliminó a propósito)', () => {
  if (/\.header-update-panel\b/.test(cssSinComentarios)) {
    throw new Error('volvió .header-update-panel al CSS — el update va en el dot del footer, no en un panel del header');
  }
});

test('el update vive en el footer, no en el header (📦581)', () => {
  // La clase se estila en styles.css y el id vive en index.html: son las dos mitades.
  // (La primera version de este check buscó `#footer-update-btn` en el CSS y daba rojo:
  // el error era del check, no del código — el CSS usa la CLASE.)
  if (!/\.footer-update-btn\b/.test(cssSinComentarios)) {
    throw new Error('no está la clase .footer-update-btn en el CSS — el update de 📦581 vive en el footer');
  }
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  if (html.indexOf('id="footer-update-btn"') === -1) {
    throw new Error('index.html no declara #footer-update-btn — sin ese botón el update no se muestra');
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
