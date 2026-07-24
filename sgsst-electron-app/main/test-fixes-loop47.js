// test-fixes-loop47.js
// Loop 47 / 47b — Ocultar menú nativo de Electron
//
// OBJETIVO:
// - En modo dev (npm start) el menú "File Edit View Window Help" está OCULTO
//   por defecto. Aparece SOLO cuando se presiona Alt (comportamiento estándar
//   de Windows para apps como Discord, Slack, VSCode, etc.).
// - En modo producción (app empaquetada / .exe) el menú está OCULTO TOTAL,
//   ni siquiera aparece con Alt.
//
// CÓDIGO APLICADO:
// 1. const { app, BrowserWindow, ipcMain, dialog, shell, nativeTheme, Menu }
//      = require('electron');
// 2. BrowserWindow: { autoHideMenuBar: true, ... }
//    (oculta menú por defecto, aparece con Alt)
// 3. if (app.isPackaged) { Menu.setApplicationMenu(null); }
//    (en producción lo oculta totalmente)

const fs = require('fs');
const path = require('path');

let pass = 0;
let fail = 0;
const fails = [];

function check(name, ok, detail) {
  if (ok) {
    pass++;
    console.log('  ✓ ' + name);
  } else {
    fail++;
    fails.push(name + (detail ? ' — ' + detail : ''));
    console.log('  ✗ ' + name + (detail ? ' — ' + detail : ''));
  }
}

const mainPath = path.join(__dirname, '..', 'main.js');
const mainSrc = fs.readFileSync(mainPath, 'utf8');
const lines = mainSrc.split('\n');

console.log('=== Loop 47 — Ocultar menú nativo en producción ===\n');

// 1) Menu importado en el destructuring
const requireLine = lines.find(l => l.includes("require('electron')"));
check(
  'Menu importado en require("electron")',
  requireLine && /\bMenu\b/.test(requireLine),
  requireLine ? requireLine.trim() : 'línea no encontrada'
);

// 2) Llamada a setApplicationMenu(null)
const setMenuCall = mainSrc.match(/Menu\.setApplicationMenu\(\s*null\s*\)/);
check(
  'Llamada a Menu.setApplicationMenu(null) existe',
  !!setMenuCall,
  setMenuCall ? 'encontrada' : 'no encontrada'
);

// 3) Bloque condicional app.isPackaged
const packagedCheck = mainSrc.match(/if\s*\(\s*app\.isPackaged\s*\)/);
check(
  'Bloque condicional if (app.isPackaged) existe',
  !!packagedCheck,
  packagedCheck ? 'encontrado' : 'no encontrado'
);

// 4) Bloque está dentro de un app.whenReady().then(...)
// Buscamos la llamada a setApplicationMenu que sea CÓDIGO REAL (no en comentario),
// después el whenReadyr más cercano hacia arriba, y validamos que está antes.
const linesArr2 = mainSrc.split('\n');
// Filtrar líneas que son código (no comentario) y contienen la llamada
const setMenuCandidates = linesArr2
  .map((l, i) => ({ l, i }))
  .filter(x => x.l.includes('Menu.setApplicationMenu(null)') && !x.l.trim().startsWith('//'));
const setMenuLineNum = setMenuCandidates.length > 0 ? setMenuCandidates[0].i : -1;
let nearestWhenReadyAbove = -1;
if (setMenuLineNum > -1) {
  for (let i = setMenuLineNum; i >= 0; i--) {
    if (/app\.whenReady\(\)\.then/.test(linesArr2[i])) {
      nearestWhenReadyAbove = i;
      break;
    }
  }
}
check(
  'setApplicationMenu está DENTRO de app.whenReady() (no en comentario)',
  setMenuLineNum > -1 && nearestWhenReadyAbove > -1 && setMenuLineNum > nearestWhenReadyAbove,
  setMenuLineNum > -1
    ? `whenReady en línea ${nearestWhenReadyAbove + 1}, setMenu (código) en línea ${setMenuLineNum + 1}`
    : 'setApplicationMenu no se encontró como código'
);

// 5) Está DESPUÉS de createWindow() en el MISMO bloque whenReady
// Buscamos createWindow() entre el whenReady y setMenu
let nearestCreateWindowInBlock = -1;
if (nearestWhenReadyAbove > -1 && setMenuLineNum > -1) {
  for (let i = nearestWhenReadyAbove; i <= setMenuLineNum; i++) {
    if (/\bcreateWindow\(\)/.test(linesArr2[i]) && !linesArr2[i].trim().startsWith('//')) {
      nearestCreateWindowInBlock = i;
    }
  }
}
check(
  'setApplicationMenu está DESPUÉS de createWindow() (dentro del mismo whenReady)',
  nearestCreateWindowInBlock > -1 && nearestCreateWindowInBlock < setMenuLineNum,
  nearestCreateWindowInBlock > -1
    ? `createWindow en línea ${nearestCreateWindowInBlock + 1}, setMenu en línea ${setMenuLineNum + 1}`
    : 'createWindow no encontrada dentro del whenReady'
);

// 6) Comentario explicativo (señal de intención)
const hasComment = /Loop 47/.test(mainSrc) && /(Ocultar menú nativo|Menú nativo oculto)/i.test(mainSrc);
check(
  'Comentario "Loop 47" presente',
  hasComment,
  hasComment ? 'OK' : 'no se encontró el comentario marcador'
);

// 7) ELSE branch existe (modo dev: menú oculto por defecto, aparece con Alt)
const hasElse = /else\s*{[\s\S]*?Menú nativo[\s\S]*?}/.test(mainSrc);
check(
  'Rama else (modo dev: oculto por defecto, aparece con Alt) existe',
  hasElse,
  hasElse ? 'OK' : 'la rama else no se encontró'
);

// 8) console.log para diagnóstico
const hasLog = /\[MAIN\] Menú nativo (ocultado|oculto|visible)/.test(mainSrc);
check(
  'console.log diagnóstico presente',
  hasLog,
  hasLog ? 'OK' : 'no se encontró el console.log'
);

// 10) autoHideMenuBar: true en el BrowserWindow (clave del comportamiento)
const autoHide = /autoHideMenuBar:\s*true/.test(mainSrc);
check(
  'autoHideMenuBar: true en BrowserWindow (oculta menú hasta presionar Alt)',
  autoHide,
  autoHide ? 'OK' : 'no se encontró autoHideMenuBar: true'
);

// 11) Comentario menciona Alt (atajo de teclado para mostrar el menú)
const mentionsAlt = /Alt/.test(mainSrc) && /presionar Alt|con Alt|Alt para mostrar/i.test(mainSrc);
check(
  'Comentario menciona el atajo Alt para mostrar el menú',
  mentionsAlt,
  mentionsAlt ? 'OK' : 'no se encontró referencia al atajo Alt'
);

// 9) Solo se aplica a production (NO en dev) — sanity check
// Verifica que la llamada a setApplicationMenu(null) esté dentro del bloque
// if (app.isPackaged) { ... } (no suelta en el aire, no en una rama else, etc.)
const linesArr = mainSrc.split('\n');
let inPackagedBlock = false;
let inElseBlock = false;
let setMenuInsideIf = false;
let setMenuInsideElse = false;
let setMenuInBlockDepth = 0;
let currentBlockIsPackaged = false;
let currentBlockIsElse = false;
let braceDepth = 0;

for (let i = 0; i < linesArr.length; i++) {
  const line = linesArr[i];
  if (/if\s*\(\s*app\.isPackaged\s*\)/.test(line)) {
    currentBlockIsPackaged = true;
    currentBlockIsElse = false;
    braceDepth = 0;
  } else if (/\}\s*else\s*\{/.test(line) || /\belse\s*\{/.test(line)) {
    // Detectar "} else {" (entra a la rama else)
    if (currentBlockIsPackaged) currentBlockIsElse = true;
  } else if (/^\s*else\s*\{/.test(line) && !currentBlockIsPackaged) {
    // else suelto sin if previo
  }
  if (line.includes('Menu.setApplicationMenu(null)')) {
    if (currentBlockIsPackaged && !currentBlockIsElse) {
      setMenuInsideIf = true;
    } else if (currentBlockIsElse) {
      setMenuInsideElse = true;
    }
  }
  if (/^\s*\}\s*$/.test(line) || /\}\s*$/.test(line.trim())) {
    // Cierre de bloque
    if (currentBlockIsPackaged || currentBlockIsElse) {
      currentBlockIsPackaged = false;
      currentBlockIsElse = false;
    }
  }
}
check(
  'setApplicationMenu(null) está DENTRO del if (app.isPackaged), no en rama else',
  setMenuInsideIf && !setMenuInsideElse,
  setMenuInsideIf ? 'OK (dentro del if)' : 'NO está dentro del if — bug crítico'
);

console.log('\n=== Resultado ===');
console.log('OK: ' + pass);
console.log('FAIL: ' + fail);
if (fail > 0) {
  console.log('\nFallos:');
  fails.forEach(f => console.log('  - ' + f));
  process.exit(1);
} else {
  console.log('\n🎉 Loop 47 OK — el menú nativo se ocultará en producción.');
  process.exit(0);
}
