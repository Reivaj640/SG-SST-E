/* 📦1085 — Los scripts de Windows del repo, y el runtime de Python que tiene
 * que SERVIR.
 *
 * QUE SE VERIFICA, y por que cada cosa importa:
 *
 *  1. Todos los `.bat` versionados estan en CRLF, sin BOM y sin CR sueltos.
 *     `cmd.exe` necesita CRLF: con LF solo, cada comando pierde sus primeros
 *     caracteres y el script se desarma ("ipt" en vez de "script"). Medido el
 *     17-nov-2026: los seis `.bat` del repo estaban con LF solo.
 *
 *  2. `prepare-python-embed.bat` NO calcula el nombre del `.pth` (el calculo
 *     `%PYTHON_VERSION:~2,1%` daba "31" y no "311", y el paso fallaba en
 *     silencio), lo BUSCA por patron.
 *
 *  3. Ese script verifica pip ANTES de instalar, importa pandas y openpyxl
 *     AL FINAL, y sale con codigo 1 si el runtime no sirve. Antes imprimia
 *     "OK" sin que nada hubiera pasado.
 *
 *  4. El guard `main/_verificar-runtime-python.js` esta enganchado en
 *     `build.scripts.beforePack` de `package.json`, y NO solo en `prebuild`:
 *     `prebuild` es un hook de npm y el flujo de release es
 *     `npx electron-builder --win --publish=always`, que no pasa por npm.
 *
 *  5. COMPORTAMIENTO: el guard se EJECUTA de verdad en cuatro escenarios y
 *     tiene que cortar en los tres malos y pasar en el bueno. Un guard que
 *     "deberia" cortar no es un guard.
 *
 * Las mutaciones matan los checks estaticos; las de comportamiento matan los
 * checks de ejecucion. Cada mutacion se verifica que cambia el archivo antes
 * de culpar a un check (PROMPT.md §7.2).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const APP = path.resolve(__dirname, '..');
const REPO = path.resolve(APP, '..');
const GUARD = path.join(APP, 'main', '_verificar-runtime-python.js');
const PREPARE_REL = 'sgsst-electron-app/scripts/prepare-python-embed.bat';
const GUARD_REL = 'sgsst-electron-app/main/_verificar-runtime-python.js';
const IGNORE_REL = 'sgsst-electron-app/.gitignore';
const PKG_REL = 'sgsst-electron-app/package.json';
const RUNTIME_REAL = path.join(APP, 'Portear', 'python-embed');

const checks = [];
const ok = (n, c, e) => checks.push({ name: n, ok: !!c, extra: e });

// ── Lectura ────────────────────────────────────────────────────────────────
function batsVersionados() {
  const salida = execFileSync('git', ['ls-files', '*.bat'], { cwd: REPO, encoding: 'utf8' });
  return salida.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
}

function leerMapa() {
  const mapa = {};
  batsVersionados().forEach(function (rel) {
    mapa[rel] = fs.readFileSync(path.join(REPO, rel), 'utf8');
  });
  mapa[PKG_REL] = fs.readFileSync(path.join(APP, 'package.json'), 'utf8');
  mapa[GUARD_REL] = fs.readFileSync(GUARD, 'utf8');
  mapa[IGNORE_REL] = fs.readFileSync(path.join(APP, '.gitignore'), 'utf8');
  return mapa;
}

function medir(texto) {
  let crlf = 0, lf = 0, cr = 0;
  for (let i = 0; i < texto.length; i++) {
    if (texto.charCodeAt(i) === 13) {
      if (texto.charCodeAt(i + 1) === 10) { crlf++; i++; } else cr++;
    } else if (texto.charCodeAt(i) === 10) {
      lf++;
    }
  }
  return { crlf: crlf, lf: lf, cr: cr, bom: texto.charCodeAt(0) === 0xfeff };
}

function norm(t) { return t.replace(/^﻿/, '').replace(/\r\n/g, '\n'); }

/* Las lineas REM y :: de un .bat son COMENTARIOS: no se analizan.
 * Sin esto, un check que prohibe una cadena se satisface con el comentario
 * que explica por que se prohibe (PROMPT.md §7.1: leer solo codigo). */
function soloCodigoBat(texto) {
  return norm(texto).split('\n').filter(function (l) {
    const t = l.trim();
    if (t === '') return false;
    const may = t.toUpperCase();
    if (may === 'REM' || may.indexOf('REM ') === 0) return false;
    if (t.indexOf('::') === 0) return false;
    return true;
  }).join('\n');
}

// ── Checks estaticos (mutables) ────────────────────────────────────────────
function evaluarEstatico(mapa) {
  const c = [];
  const registrar = function (nombre, ok_, extra) {
    c.push({ nombre: nombre, ok: !!ok_, extra: extra || '' });
  };

  const bats = Object.keys(mapa).filter(function (k) { return /\.bat$/i.test(k); });
  registrar('hay .bat versionados que revisar', bats.length >= 6, 'encontrados: ' + bats.length);

  const malosEol = bats.filter(function (k) {
    const m = medir(mapa[k]);
    return m.lf > 0 || m.cr > 0 || m.bom;
  });
  registrar('todos los .bat versionados estan en CRLF, sin BOM y sin CR sueltos',
    malosEol.length === 0, malosEol.join(', '));

  const prep = soloCodigoBat(mapa[PREPARE_REL] || '');

  registrar('el .bat ya no calcula el nombre del .pth (el bug de %PYTHON_VERSION:~2,1%)',
    !/~2,\s*1%/.test(prep) && !/~2,1%/.test(prep),
    'se sigue calculando el .pth');
  registrar('el .bat busca el .pth por patron',
    /python3\*\._pth/.test(prep), 'no busca python3*._pth');
  registrar('el .bat escribe la linea de import site de verdad',
    /echo\s+import\s+site/i.test(prep), 'no escribe "import site"');
  registrar('el .bat no usa Set-Content (PowerShell 5.1 escribe BOM y rompe el .pth)',
    !/Set-Content/i.test(prep), 'usa Set-Content');
  registrar('el .bat comprueba que el interprete VE pip antes de instalar',
    /-m\s+pip\s+--version/.test(prep), 'no comprueba pip');
  registrar('el .bat importa pandas y openpyxl para verificar el runtime',
    /import\s+pandas,\s*openpyxl/.test(prep), 'no verifica los imports');
  registrar('el .bat falla con codigo 1 cuando el runtime no sirve',
    (prep.match(/exit\s+\/b\s+1/g) || []).length >= 3,
    'salidas con fallo: ' + (prep.match(/exit\s+\/b\s+1/g) || []).length);

  let pkg = null;
  try { pkg = JSON.parse(mapa[PKG_REL]); } catch (e) { pkg = null; }
  registrar('el package.json sigue siendo JSON valido', !!pkg);
  const beforePack = pkg && pkg.build ? pkg.build.beforePack : null;
  registrar('el guard esta enganchado en build.beforePack (corre sin npm)',
    !!(beforePack && /_verificar-runtime-python\.js/.test(beforePack)),
    'beforePack: ' + beforePack);
  registrar('el guard se engancha como MODULO, no como comando de shell',
    !!(beforePack && /\.js$/.test(String(beforePack).trim())),
    'beforePack: ' + beforePack);

  const guard = norm(mapa[GUARD_REL] || '');
  registrar('el guard exporta la funcion beforePack (electron-builder la busca por ese nombre)',
    /module\.exports\s*=\s*\{[^}]*beforePack/.test(guard),
    'no exporta beforePack');

  // El `.gitignore` del repo ignora `_*.js` (scripts one-off). El guard es
  // codigo de producto y necesita una excepcion explicita: sin ella el
  // archivo NO viaja en el commit y el guard no existe en ningun clon.
  const ignore = norm(mapa[IGNORE_REL] || '');
  registrar('el .gitignore deja viajar el guard (excepcion explicita)',
    /!main\/_verificar-runtime-python\.js/.test(ignore),
    'falta la excepcion !main/_verificar-runtime-python.js');

  return c;
}

// ── Checks de comportamiento: el guard se ejecuta de verdad ────────────────
function correrGuard(rutaGuard, embedDir) {
  const env = Object.assign({}, process.env, { KAIR_PYTHON_EMBED_DIR: embedDir });
  delete env.KAIR_PYTHON_DEPS;
  const r = spawnSync(process.execPath, [rutaGuard], { env: env, encoding: 'utf8', timeout: 120000 });
  return { codigo: r.status, salida: String(r.stdout || '') + String(r.stderr || '') };
}

function armarRuntimeFalso(base, conImportSite) {
  fs.mkdirSync(base, { recursive: true });
  // Un python.exe que NO es un interprete: el guard tiene que cortarlo antes.
  fs.writeFileSync(path.join(base, 'python.exe'), 'esto no es un interprete');
  const pth = conImportSite
    ? 'python311.zip\n.\n\nimport site\n'
    : 'python311.zip\n.\n\n#import site\n';
  fs.writeFileSync(path.join(base, 'python311._pth'), pth);
  return base;
}

async function checksComportamiento() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kair-1085-'));
  const salida = [];

  const r1 = correrGuard(GUARD, path.join(tmp, 'no-existe'));
  salida.push({
    nombre: 'el guard corta cuando el runtime no esta preparado',
    ok: r1.codigo !== 0 && /MOTIVO: SIN_RUNTIME/.test(r1.salida),
    extra: 'codigo ' + r1.codigo + ' :: ' + r1.salida.slice(0, 120).replace(/\s+/g, ' ')
  });

  const b2 = armarRuntimeFalso(path.join(tmp, 'sin-site'), false);
  const r2 = correrGuard(GUARD, b2);
  salida.push({
    nombre: "el guard corta cuando 'import site' esta comentado",
    ok: r2.codigo !== 0 && /MOTIVO: PTH_SIN_IMPORT_SITE/.test(r2.salida),
    extra: 'codigo ' + r2.codigo + ' :: ' + r2.salida.slice(0, 120).replace(/\s+/g, ' ')
  });

  const b3 = armarRuntimeFalso(path.join(tmp, 'sin-deps'), true);
  const r3 = correrGuard(GUARD, b3);
  salida.push({
    nombre: 'el guard corta cuando las dependencias no se pueden importar',
    ok: r3.codigo !== 0 && /MOTIVO: SIN_DEPENDENCIAS/.test(r3.salida),
    extra: 'codigo ' + r3.codigo + ' :: ' + r3.salida.slice(0, 120).replace(/\s+/g, ' ')
  });

  if (fs.existsSync(path.join(RUNTIME_REAL, 'python.exe'))) {
    const r4 = correrGuard(GUARD, RUNTIME_REAL);
    salida.push({
      nombre: 'el guard PASA con el runtime real de esta maquina',
      ok: r4.codigo === 0,
      extra: 'codigo ' + r4.codigo + ' :: ' + r4.salida.slice(0, 200)
    });
  } else {
    salida.push({
      nombre: 'el guard PASA con el runtime real de esta maquina',
      ok: true,
      extra: 'esta maquina no tiene el runtime: caso omitido (no es un fallo)'
    });
  }

  // B5: el hook que electron-builder llama TIENE que tirar la excepcion. Un
  // guard que devuelve un codigo de error sin lanzar deja el build adelante.
  const b5 = armarRuntimeFalso(path.join(tmp, 'hook-roto'), true);
  const envAnterior = process.env.KAIR_PYTHON_EMBED_DIR;
  process.env.KAIR_PYTHON_EMBED_DIR = b5;
  delete require.cache[require.resolve(GUARD)];
  let lanzo = false;
  let mensaje = '';
  try {
    const mod = require(GUARD);
    await mod.beforePack({});
  } catch (e) {
    lanzo = true;
    mensaje = String((e && e.message) || e);
  } finally {
    if (envAnterior === undefined) delete process.env.KAIR_PYTHON_EMBED_DIR;
    else process.env.KAIR_PYTHON_EMBED_DIR = envAnterior;
    delete require.cache[require.resolve(GUARD)];
  }
  salida.push({
    nombre: 'el hook beforePack TIRA la excepcion cuando el runtime no sirve',
    ok: lanzo && /MOTIVO: SIN_DEPENDENCIAS/.test(mensaje),
    extra: 'lanzo: ' + lanzo + ' :: ' + mensaje.slice(0, 120)
  });

  return salida;
}

// ── Corrida ────────────────────────────────────────────────────────────────
const mapaReal = leerMapa();
evaluarEstatico(mapaReal).forEach(function (c) { ok(c.nombre, c.ok, c.extra); });

(async function correr() {
const comp = await checksComportamiento();
comp.forEach(function (c) { ok(c.nombre, c.ok, c.extra); });

// ── Mutaciones ─────────────────────────────────────────────────────────────
const MUTACIONES = [
  ['el .bat vuelve a LF solo', function (m) {
    m[PREPARE_REL] = m[PREPARE_REL].replace(/\r\n/g, '\n');
    return m;
  }],
  ['el .bat vuelve a calcular el nombre del .pth', function (m) {
    m[PREPARE_REL] = m[PREPARE_REL].replace(
      'for %%f in ("%PYTHON_EMBED_DIR%\\python3*._pth") do set "PTH_FILE=%%f"',
      'set "PTH_FILE=%PYTHON_EMBED_DIR%\\python%PYTHON_VERSION:~0,1%%PYTHON_VERSION:~2,1%._pth"'
    );
    return m;
  }],
  ['el .bat deja de escribir la linea de import site', function (m) {
    m[PREPARE_REL] = m[PREPARE_REL].replace(/echo import site>> "%PTH_FILE%\.tmp"/, 'rem quitado');
    return m;
  }],
  ['el .bat deja de comprobar que el interprete ve pip', function (m) {
    m[PREPARE_REL] = m[PREPARE_REL].replace(/-m pip --version >nul 2>&1/, 'rem quitado');
    return m;
  }],
  ['el .bat vuelve a usar Set-Content (BOM)', function (m) {
    m[PREPARE_REL] = m[PREPARE_REL].replace(
      'findstr /V /B /C:"#import site" "%PTH_FILE%" > "%PTH_FILE%.tmp"',
      'powershell -Command "Set-Content -LiteralPath \'%PTH_FILE%\'"'
    );
    return m;
  }],
  ['el package.json deja de enganchar el guard en beforePack', function (m) {
    m[PKG_REL] = m[PKG_REL].replace(
      /"beforePack": "\.\/main\/_verificar-runtime-python\.js"/,
      '"beforePack": "node -e 0"'
    );
    return m;
  }],
  ['el guard se queda solo en el hook de npm', function (m) {
    const pkg = JSON.parse(m[PKG_REL]);
    delete pkg.build.beforePack;
    pkg.scripts.prebuild = 'node main/_verificar-runtime-python.js';
    m[PKG_REL] = JSON.stringify(pkg, null, 2);
    return m;
  }],
  ['el .gitignore vuelve a tragarse el guard', function (m) {
    m[IGNORE_REL] = m[IGNORE_REL].replace(/!main\/_verificar-runtime-python\.js\r?\n/, '');
    return m;
  }]
];

let mutantesVacios = 0;
let detectados = 0;
MUTACIONES.forEach(function (mut) {
  const copia = JSON.parse(JSON.stringify(mapaReal));
  const antes = JSON.stringify(copia);
  const despues = mut[1](copia);
  if (JSON.stringify(despues) === antes) {
    mutantesVacios++;
    console.log('FAIL MUTANTE VACIO: ' + mut[0]);
    return;
  }
  const r = evaluarEstatico(despues);
  const rojos = r.filter(function (c) { return !c.ok; });
  if (rojos.length) {
    detectados++;
    console.log('MUTANTE DETECTADO: ' + mut[0] + '  (' + rojos.length + ' check(s) en rojo: ' +
      rojos.map(function (c) { return c.nombre; }).join(' | ') + ')');
  } else {
    console.log('FAIL MUTANTE NO DETECTADO: ' + mut[0]);
  }
});

// ── Mutaciones de COMPORTAMIENTO (sobre el guard) ──────────────────────────
function mutarGuard(nombre, mutacion, comprobar) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kair-1085-mut-'));
  const destino = path.join(tmp, 'guard-mutado.js');
  const original = fs.readFileSync(GUARD, 'utf8');
  const mutado = mutacion(original);
  if (mutado === original) {
    console.log('FAIL MUTANTE VACIO (guard): ' + nombre);
    mutantesVacios++;
    return;
  }
  fs.writeFileSync(destino, mutado);
  const b2 = armarRuntimeFalso(path.join(tmp, 'sin-site'), false);
  const b3 = armarRuntimeFalso(path.join(tmp, 'sin-deps'), true);
  const r2 = correrGuard(destino, b2);
  const r3 = correrGuard(destino, b3);
  const sobrevive = comprobar(r2, r3);
  if (!sobrevive) {
    detectados++;
    console.log('MUTANTE DETECTADO (guard): ' + nombre);
  } else {
    console.log('FAIL MUTANTE NO DETECTADO (guard): ' + nombre);
  }
}

// El guard deja de comprobar el .pth: con el .pth comentado tiene que seguir
// diciendo PTH_SIN_IMPORT_SITE. Si el guard se lo salta, el motivo pasa a ser
// SIN_DEPENDENCIAS y el check de comportamiento se cae.
//
// `comprobar` devuelve si el MUTANTE sigueIGUAL al bueno (o sea, si el check
// no lo distingue). Si devuelve false, el mutante se MURIO: esta detectado.
mutarGuard('deja de comprobar el .pth',
  function (t) { return t.replace('const siteActivo = lineasPth.some(', 'const siteActivo = true || lineasPth.some('); },
  function (r2) { return r2.codigo !== 0 && /MOTIVO: PTH_SIN_IMPORT_SITE/.test(r2.salida); });

// El guard deja de comprobar las dependencias: con el runtime sin pandas
// tiene que salir con SIN_DEPENDENCIAS. Si el check desaparece, sale con 0.
mutarGuard('deja de comprobar las dependencias',
  function (t) { return t.replace('if (r.status !== 0) {', 'if (false) {'); },
  function (r2, r3) { return r3.codigo !== 0 && /MOTIVO: SIN_DEPENDENCIAS/.test(r3.salida); });

// ── Resumen ────────────────────────────────────────────────────────────────
const fallidos = checks.filter(function (c) { return !c.ok; }).length;
checks.forEach(function (c) {
  if (!c.ok) console.log('  FAIL  ' + c.name + (c.extra ? '  :: ' + c.extra : ''));
});
console.log('mutaciones: ' + detectados + '/' + (MUTACIONES.length + 2) + ' detectadas' +
  (mutantesVacios ? ' | mutantes vacios: ' + mutantesVacios : ''));
console.log((checks.length - fallidos) + '/' + checks.length + ' OK');
process.exit(fallidos === 0 && mutantesVacios === 0 ? 0 : 1);
})();
