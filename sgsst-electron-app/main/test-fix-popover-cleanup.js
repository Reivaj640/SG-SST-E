/**
 * test-fix-popover-cleanup.js
 *
 * Verifica el fix de 📦545: cuando se cierra el calendario (close()),
 * el day popover se cierra también. Sin esto, el popover queda
 * "huérfano" visible aunque el calendario ya no esté.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'shared', 'kair-calendar.js');
const content = fs.readFileSync(filePath, 'utf8');

console.log('=== TEST: Fix popover cleanup al cerrar calendario (📦545) ===');
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

// 1. La función close() llama a _cancelDayPopoverTimeout() y _closeDayPopover()
const closeFnMatch = content.match(/KairCalendar\.prototype\.close = function \(\) \{([\s\S]*?)\n  \};/);
if (closeFnMatch) {
  const fnBody = closeFnMatch[1];
  check('close() llama a _cancelDayPopoverTimeout()',
    fnBody.indexOf('_cancelDayPopoverTimeout()') >= 0);
  check('close() llama a _closeDayPopover()',
    fnBody.indexOf('_closeDayPopover()') >= 0);
} else {
  check('close() existe y tiene body', false);
}

// 2. El comentario explica el fix
check('Comentario explica el fix (FIX) — popover cleanup al cerrar',
  content.indexOf('FIX) — Limpiar el day popover al cerrar el calendario') >= 0);

// 3. El close() no tiene nada raro (no hace e.stopPropagation en close)
check('close() no rompe la logica existente (mantiene state.open = false)',
  closeFnMatch && closeFnMatch[1].indexOf('this.state.open = false') >= 0);

console.log('');
console.log('=== Resultado: ' + passed + ' OK, ' + failed + ' FAIL ===');
if (failed > 0) {
  process.exit(1);
}
