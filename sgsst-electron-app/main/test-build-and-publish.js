/* Test: build-and-publish.bat (📦554)
 * Valida que el script tiene toda la lógica necesaria para evitar
 * el gotcha del 422 al publicar releases con electron-builder.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const scriptPath = path.join(ROOT, 'build-and-publish.bat');

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
console.log('Test: build-and-publish.bat (📦554)');
console.log('========================================');
console.log('');

if (!fs.existsSync(scriptPath)) {
  console.error('FAIL: build-and-publish.bat no existe');
  process.exit(1);
}

const script = fs.readFileSync(scriptPath, 'utf8');

test('script existe en sgsst-electron-app/build-and-publish.bat', () => {
  if (!fs.existsSync(scriptPath)) {
    throw new Error('build-and-publish.bat no existe');
  }
});

test('script es ejecutable en Windows (extension .bat)', () => {
  if (!scriptPath.endsWith('.bat')) {
    throw new Error('El script debe tener extension .bat para Windows');
  }
});

test('script lee la version de package.json', () => {
  if (!/findstr\s+\/i\s+"version"\s+package\.json/i.test(script) && !/for\s+\/f.*package\.json/i.test(script)) {
    throw new Error('El script no lee la version de package.json automaticamente');
  }
});

test('script usa la variable PKG_VERSION para construir el tag', () => {
  if (!/TAG_NAME=v%PKG_VERSION%/.test(script)) {
    throw new Error('El script no construye el tag a partir de la version');
  }
});

test('script valida GH_TOKEN antes de empezar', () => {
  if (!/GH_TOKEN.*==.*""/.test(script) && !/if\s+"%GH_TOKEN%"==""/.test(script)) {
    throw new Error('El script no valida que GH_TOKEN este definido');
  }
});

test('script BORRA el tag viejo (local) — clave para evitar 422', () => {
  if (!/git\s+tag\s+-d\s+%TAG_NAME%/.test(script)) {
    throw new Error('El script no borra el tag viejo local (causa del 422)');
  }
});

test('script BORRA el tag viejo (remoto) — clave para evitar 422', () => {
  if (!/git\s+push\s+origin\s+:refs\/tags\/%TAG_NAME%/.test(script)) {
    throw new Error('El script no borra el tag viejo remoto (causa del 422)');
  }
});

test('script hace git pull de origin/Dev-Pc', () => {
  if (!/git\s+pull\s+origin\s+Dev-Pc/.test(script)) {
    throw new Error('El script no hace git pull de los ultimos cambios');
  }
});

test('script limpia dist/ antes del build', () => {
  if (!/rmdir\s+\/s\s+\/q\s+dist/.test(script) && !/rm\s+-rf\s+dist/.test(script)) {
    throw new Error('El script no limpia dist/ antes del build');
  }
});

test('script corre electron-builder con --publish=always', () => {
  if (!/npx\s+electron-builder\s+--win\s+--publish=always/.test(script)) {
    throw new Error('El script no corre electron-builder con --publish=always');
  }
});

test('script valida que se generaron los 3 assets criticos', () => {
  if (!/dist\\K\+AIR-Setup-%PKG_VERSION%\.exe/.test(script)) {
    throw new Error('No valida dist\\K+AIR-Setup-X.Y.Z.exe');
  }
  if (!/dist\\K\+AIR-Setup-%PKG_VERSION%\.exe\.blockmap/.test(script)) {
    throw new Error('No valida dist\\K+AIR-Setup-X.Y.Z.exe.blockmap');
  }
  if (!/dist\\latest\.yml/.test(script)) {
    throw new Error('No valida dist\\latest.yml');
  }
});

test('script aborta con exit /b 1 si electron-builder falla', () => {
  if (!/exit\s+\/b\s+1/.test(script)) {
    throw new Error('El script no aborta con codigo de error');
  }
});

test('script muestra URL del release al final', () => {
  if (!/releases\/tag\//.test(script)) {
    throw new Error('El script no muestra la URL del release al final');
  }
});

console.log('');
console.log('========================================');
console.log(`Resultado: ${passed} OK / ${failed} FAIL`);
console.log('========================================');

process.exit(failed > 0 ? 1 : 0);
