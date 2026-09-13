/**
 * test-day-popover-navigate.js
 *
 * Verifica que el day popover (📦545) tiene la separación correcta:
 * - _cancelDayPopoverTimeout: solo cancela el timer (no cierra el popover)
 * - _closeDayPopover: cierra el popover visible
 * - _showDayPopover acepta expanded (true/false)
 * - El preview (expanded=false) se cierra al mouseleave de la celda
 * - El expandido (expanded=true) NO se cierra al mouseleave de la celda
 */
'use strict';

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'shared', 'kair-calendar.js');
const content = fs.readFileSync(filePath, 'utf8');

console.log('=== TEST: Day popover navigation (📦545) ===');
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

// 1. La función _cancelDayPopoverTimeout existe
check('_cancelDayPopoverTimeout existe',
  content.indexOf('KairCalendar.prototype._cancelDayPopoverTimeout = function ()') >= 0);

// 2. La función NO debe llamar a _closeDayPopover (solo cancela el timer)
const cancelTimeoutFnMatch = content.match(/KairCalendar\.prototype\._cancelDayPopoverTimeout = function \(\) \{([^}]+)\}/);
if (cancelTimeoutFnMatch) {
  const fnBody = cancelTimeoutFnMatch[1];
  check('_cancelDayPopoverTimeout SOLO cancela el timer (no llama a _closeDayPopover)',
    fnBody.indexOf('clearTimeout') >= 0 && fnBody.indexOf('_closeDayPopover') < 0);
} else {
  check('_cancelDayPopoverTimeout tiene body correcto', false);
}

// 3. La función _closeDayPopover existe y elimina el popover
check('_closeDayPopover existe y elimina el popover',
  content.indexOf('KairCalendar.prototype._closeDayPopover = function ()') >= 0 &&
  content.indexOf('parentNode.removeChild') >= 0);

// 4. _showDayPopover acepta el parámetro expanded
check('_showDayPopover acepta parámetro expanded',
  content.indexOf('_showDayPopover = function (dateStr, anchorEl, dayEvents, expanded)') >= 0);

// 5. El mouseleave de la celda llama a _cancelDayPopoverTimeout (no _cancelDayPopover)
check('mouseleave de celda → _cancelDayPopoverTimeout (no close)',
  content.indexOf("self._cancelDayPopoverTimeout();") >= 0);

// 6. El popover expanded (click) tiene listeners de mouseenter/mouseleave
check('Popover expanded tiene listener de mouseleave con delay',
  content.indexOf('closeOnLeaveTimer = setTimeout') >= 0 &&
  content.indexOf("pop.addEventListener('mouseleave'") >= 0);

// 7. El delay es 250ms
check('Delay de mouseleave del popover = 250ms',
  content.indexOf("}, 250);") >= 0);

// 8. El popover expanded tiene mouseenter que cancela el close
check('Popover expanded tiene mouseenter que cancela el close timer',
  content.indexOf("pop.addEventListener('mouseenter'") >= 0 &&
  content.indexOf("clearTimeout(closeOnLeaveTimer)") >= 0);

// 9. El delay del preview es 1000ms (1 segundo)
check('Delay del preview = 1000ms (1s)',
  content.indexOf("}, 1000);") >= 0);

// 10. El popover acepta expanded en el case
check('Click en celda pasa expanded=true al _showDayPopover',
  content.indexOf("/* expanded */ true") >= 0);

console.log('');
console.log('=== Resultado: ' + passed + ' OK, ' + failed + ' FAIL ===');
if (failed > 0) {
  process.exit(1);
}
