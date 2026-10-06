/**
 * test-fix-click-close-calendar.js
 *
 * Verifica el fix de 📦545 para el bug "click en evento del popover
 * cierra el calendario". El fix usa e.stopPropagation() para evitar
 * que el click se propague al document y dispare el handler de
 * "click fuera → cerrar calendario" de kair-calendar.js.
 *
 * Antes del fix: el handler del document evaluaba
 * `e.target.closest('.kair-cal-modal-overlay')` cuando el detail panel
 * aún no existía (se abre después del click), entonces caía al this.close()
 * y cerraba el calendario entero.
 *
 * Después del fix: e.stopPropagation() evita la propagación al document.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'shared', 'kair-calendar.js');
const content = fs.readFileSync(filePath, 'utf8');

console.log('=== TEST: Fix click-close-calendar (📦545) ===');
console.log('');

let passed = 0;
let failed = 0;

function check(name, condition) {
  if (condition) {
    console.log('  ✓', name);
    passed++;
  } else {
    console.log('  ✗', name);
    failed++;
  }
}

// 1. El listener del evento en el popover tiene e.stopPropagation()
check('Click handler del popover usa e.stopPropagation()',
  content.indexOf('e.stopPropagation();') >= 0 &&
  content.indexOf('FIX) — stopPropagation') >= 0);

// 2. También usa e.preventDefault() por seguridad
check('Click handler del popover usa e.preventDefault()',
  content.indexOf('e.preventDefault();') >= 0);

// 3. Llama directamente a calendarDetailPanel.open() en lugar de simular click
check('Llama directamente a window.calendarDetailPanel.open(ev)',
  content.indexOf('window.calendarDetailPanel.open(ev)') >= 0);

// 4. El comentario explica el fix
check('Comentario explica el fix (FIX) — stopPropagation',
  content.indexOf('(FIX) — stopPropagation') >= 0);

// 5. El código del handler sigue abriendo el detail panel
check('El handler abre el detail panel (calendarDetailPanel o chip fallback)',
  content.indexOf('calendarDetailPanel.open(ev)') >= 0 &&
  content.indexOf('chip.click()') >= 0);

console.log('');
console.log('=== Resultado: ' + passed + ' OK, ' + failed + ' FAIL ===');
if (failed > 0) {
  process.exit(1);
}
