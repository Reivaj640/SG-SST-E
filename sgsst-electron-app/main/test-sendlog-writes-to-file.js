/* Test: sendLog debe escribir al archivo de log (📦547)
 * Valida que la función sendLog también escribe a electron-log (archivo)
 * y no solo a console.log.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const mainPath = path.join(ROOT, 'main.js');

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
console.log('Test: sendLog escribe al archivo (📦547)');
console.log('========================================');
console.log('');

if (!fs.existsSync(mainPath)) {
  console.error('FAIL: main.js no existe');
  process.exit(1);
}

const mainCode = fs.readFileSync(mainPath, 'utf8');

test('sendLog existe en main.js', () => {
  if (!/function sendLog\s*\(/.test(mainCode)) {
    throw new Error('No se encontró la función sendLog en main.js');
  }
});

test('sendLog hace console.log (compatibilidad)', () => {
  const sendLogMatch = mainCode.match(/function sendLog\s*\([^)]*\)\s*\{[\s\S]{0,800}?\n\}/);
  if (!sendLogMatch) throw new Error('No se encontró el cuerpo de sendLog');
  if (!/console\.log\(/.test(sendLogMatch[0])) {
    throw new Error('sendLog no hace console.log');
  }
});

test('sendLog hace log.info() o log[level]() — escribe al archivo', () => {
  const sendLogMatch = mainCode.match(/function sendLog\s*\([^)]*\)\s*\{[\s\S]{0,1500}?\n\}/);
  if (!sendLogMatch) throw new Error('No se encontró el cuerpo de sendLog');
  if (!/log\.(?:info|warn|error|debug)\s*\(/.test(sendLogMatch[0]) && !/log\[level\.toLowerCase\(\)\]/.test(sendLogMatch[0])) {
    throw new Error('sendLog no escribe a electron-log (sin esto, los mensajes no aparecen en el archivo main.log)');
  }
});

test('sendLog sigue mandando al renderer vía IPC', () => {
  const sendLogMatch = mainCode.match(/function sendLog\s*\([^)]*\)\s*\{[\s\S]{0,1500}?\n\}/);
  if (!sendLogMatch) throw new Error('No se encontró el cuerpo de sendLog');
  if (!/mainWindow\.webContents\.send\(['"]log-message['"]/.test(sendLogMatch[0])) {
    throw new Error('sendLog no envía al renderer (puede romper el sistema de logs del frontend)');
  }
});

test('log.transports.file.level = info (cualquier nivel se loguea al archivo)', () => {
  if (!/log\.transports\.file\.level\s*=\s*['"]info['"]/.test(mainCode)) {
    throw new Error('log.transports.file.level no está en info — los niveles WARN/ERROR pueden no guardarse');
  }
});

console.log('');
console.log('========================================');
console.log(`Resultado: ${passed} OK / ${failed} FAIL`);
console.log('========================================');

process.exit(failed > 0 ? 1 : 0);
