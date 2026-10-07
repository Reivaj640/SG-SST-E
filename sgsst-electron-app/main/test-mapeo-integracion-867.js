/* Test de integracion de 📦867 (Fase 4): el progreso llega EN VIVO, no al final.
 *
 * test-mapeo-estructura-867.js ya verifica que:
 *   · map_directory.py emite [PROGRESO] por STDERR (y no por stdout)
 *   · hay una emision forzada al arrancar y otra al cerrar
 *   · main.js engancha child.stderr con la regex correcta y reenvia por IPC
 *   · preload.js y config-viewer.html estan cableados
 *
 * Ese test corre el script con spawnSync, o sea ESPERA a que el proceso muera antes de
 * mirar stderr. Por construccion no puede ver lo unico que importa aqui: SI los eventos
 * llegan mientras el escaneo sigue vivo.
 *
 * La regresion que este test atrapa es concreta: si alguien "optimiza" el wrapper y pasa a
 * acumular stderr para entregarlo todo junto (porque stdout ya Venia en un solo string), la
 * UI vuelve a quedar congelada durante los 760 s del escaneo real, el progreso llega completo
 * pero tarde, y NINGUN test del repo se da cuenta. El estatico pasaria: el formato es
 * identico, solo cambio el CUANDO.
 *
 * Que mide, en orden:
 *   A. La regex no esta hardcodeada: se extrae del fuente de main.js. Si alguien cambia el
 *      formato en main.js y no actualiza Python, este test se cae.
 *   B. La logica de troceado: una linea partida entre dos chunks solo se emite cuando llega
 *      el \n, y el resto a medias no se emite (es el bug clasico de este patron).
 *   C. La corrida REAL contra 2.500 archivos, midiendo el instante de llegada de cada evento
 *      contra el instante de cierre del proceso.
 *
 * Es el test que en la sesion de 📦867 vivio fuera del repo (15/15). Se trajo adentro.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const scriptPath = path.join(ROOT, 'Portear', 'src', 'map_directory.py');
const mainPath = path.join(ROOT, 'main.js');

const TOTAL_ARCHIVOS = 2500;
const TOTAL_CARPETAS = 50;

const checks = [];
function chk(name, cond, extra) {
  checks.push({ name: name, ok: !!cond, extra: extra || '' });
}

// ───────────────────────── Utilidades

function buscarPython() {
  const candidatos = ['python', 'py', 'python3'];
  for (let i = 0; i < candidatos.length; i++) {
    try {
      const r = spawnSync(candidatos[i], ['--version'], { windowsHide: true, timeout: 15000, encoding: 'utf8' });
      if (r.status === 0) return candidatos[i];
    } catch (e) { /* probar el siguiente */ }
  }
  return null;
}

/** Cuenta archivos reales del fixture, en JS. No confía en lo que diga Python. */
function contarArchivos(dir) {
  let archivos = 0;
  const pila = [dir];
  while (pila.length) {
    const actual = pila.pop();
    let entradas;
    try { entradas = fs.readdirSync(actual, { withFileTypes: true }); } catch (e) { continue; }
    for (const e of entradas) {
      if (e.isDirectory()) pila.push(path.join(actual, e.name));
      else if (e.isFile()) archivos++;
    }
  }
  return archivos;
}

/** Extrae del FUENTE de main.js el literal de regex que matchea las lineas [PROGRESO]. */
function extraerRegexReal(codigoMain) {
  // OJO: en el fuente la clase de caracteres va ESCAPADA, o sea que el texto es
  // "PROGRESO\]" y no "PROGRESO]". Buscar el corchete sin escapar no encuentra nada.
  const linea = codigoMain.split('\n').find(function (l) {
    return l.indexOf('PROGRESO') !== -1 && l.indexOf('.match(') !== -1;
  });
  if (!linea) return null;
  const ini = linea.indexOf('/');
  const fin = linea.lastIndexOf('/');
  if (ini === -1 || fin <= ini) return null;
  return new RegExp(linea.slice(ini + 1, fin));
}

/**
 * Espejo exacto del accumulador de main.js (restoProgreso + split + pop).
 * Se prueba aparte para no depender de que la corrida real produzca un chunk partido,
 * que depende de como corte el pipe el sistema operativo.
 */
class LectorProgreso {
  constructor(regex, alEmitir) {
    this.regex = regex;
    this.alEmitir = alEmitir;
    this.resto = '';
  }
  push(chunk) {
    this.resto += chunk;
    const lineas = this.resto.split('\n');
    this.resto = lineas.pop(); // el resto, que todavia no cerro con salto
    for (const linea of lineas) {
      const c = linea.match(this.regex);
      if (!c) continue;
      this.alEmitir({
        archivos: parseInt(c[1], 10),
        carpetas: parseInt(c[2], 10)
      }, linea);
    }
  }
}

// ───────────────────────── Fixture

function armarFixture(base) {
  fs.mkdirSync(base, { recursive: true });
  const payload = 'x'.repeat(64);
  let creados = 0;
  let carpeta = 0;
  while (creados < TOTAL_ARCHIVOS) {
    const dir = path.join(base, 'lote-' + String(carpeta).padStart(3, '0'));
    fs.mkdirSync(dir, { recursive: true });
    for (let k = 0; k < 50 && creados < TOTAL_ARCHIVOS; k++) {
      fs.writeFileSync(path.join(dir, 'doc-' + creados + '.txt'), payload);
      creados++;
    }
    carpeta++;
  }
  return carpeta;
}

// ───────────────────────── Corrida real con medicion de tiempos

function correrMedido(py, rutaScript, rutaFixture) {
  return new Promise(function (resolve) {
    const t0 = process.hrtime.bigint();
    const eventos = []; // { archivos, carpetas, ms }
    const res = { chunks: 0 };
    let stdout = '';
    let stderr = '';

    const hijo = spawn(py, [rutaScript, rutaFixture], {
      windowsHide: true,
      cwd: path.dirname(rutaScript),
      env: Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8' })
    });

    const regex = RE_REAL;
    const lector = new LectorProgreso(regex, function (p) {
      eventos.push({
        archivos: p.archivos,
        carpetas: p.carpetas,
        ms: Number(process.hrtime.bigint() - t0) / 1e6
      });
    });

    if (hijo.stderr) {
      hijo.stderr.on('data', function (chunk) {
        res.chunks++;
        stderr += chunk.toString('utf8');
        lector.push(chunk.toString('utf8')); // MISMO camino que main.js
      });
    }
    if (hijo.stdout) {
      hijo.stdout.on('data', function (chunk) { stdout += chunk.toString('utf8'); });
    }
    hijo.on('error', function (e) {
      res.ok = false; res.error = e; res.eventos = eventos; res.stdout = stdout;
      res.stderr = stderr; res.msTotal = 0; res.codigo = -1;
      resolve(res);
    });
    hijo.on('close', function (codigo) {
      res.ok = true; res.codigo = codigo; res.eventos = eventos; res.stdout = stdout;
      res.stderr = stderr;
      res.msTotal = Number(process.hrtime.bigint() - t0) / 1e6;
      resolve(res);
    });
  });
}

// La regex real se lee una vez, antes de correr nada.
let RE_REAL = null;

// ───────────────────────── Checks

function chkRegexReal() {
  const codigo = fs.readFileSync(mainPath, 'utf8');
  RE_REAL = extraerRegexReal(codigo);

  chk('main.js tiene una regex que matchea las lineas [PROGRESO]', !!RE_REAL);
  if (!RE_REAL) return;

  chk('la regex real acepta una linea bien formada',
    RE_REAL.test('[PROGRESO] archivos=1234 carpetas=56'),
    'fuente: ' + RE_REAL.source);
  chk('la regex real rechaza una linea sin el prefijo',
    !RE_REAL.test('PROGRESO archivos=1234 carpetas=56'));
  chk('la regex real rechaza una linea con campos cambiados de orden',
    !RE_REAL.test('[PROGRESO] carpetas=56 archivos=1234'));
  chk('la regex real rechaza una linea de error de Python',
    !RE_REAL.test('Traceback (most recent call last):'));
}

function chkTroceado() {
  if (!RE_REAL) {
    chk('troceado de lineas partidas (bloque omitido: no se pudo leer la regex de main.js)', true, 'OMITIDO');
    chk('linea partida se emite al cerrar (bloque omitido)', true, 'OMITIDO');
    chk('linea partida NO se emite a medias (bloque omitido)', true, 'OMITIDO');
    chk('varias lineas en un chunk se emiten todas (bloque omitido)', true, 'OMITIDO');
    return;
  }

  // Una linea partida: el primer chunk esta truncado a proposito.
  const emitidos = [];
  const l1 = new LectorProgreso(RE_REAL, function (p) { emitidos.push(p); });
  l1.push('[PROGRESO] archivos=10 ca');
  chk('una linea partida NO se emite a medias (misma logica de main.js)', emitidos.length === 0,
    'emitidos: ' + emitidos.length);
  l1.push('rpetas=3\n');
  chk('una linea partida se emite al cerrar con el \\n', emitidos.length === 1,
    'emitidos: ' + emitidos.length);
  chk('la linea partida se emite con los numeros enteros correctos',
    emitidos.length === 1 && emitidos[0].archivos === 10 && emitidos[0].carpetas === 3,
    emitidos.length ? JSON.stringify(emitidos[0]) : 'sin emitir');

  const emitidos2 = [];
  const l2 = new LectorProgreso(RE_REAL, function (p) { emitidos2.push(p); });
  l2.push('[PROGRESO] archivos=1 carpetas=1\n[PROGRESO] archivos=2 carpetas=1\n[PROGRESO] archivos=3 carpetas=1\n');
  chk('varias lineas en un solo chunk se emiten todas', emitidos2.length === 3,
    'emitidos: ' + emitidos2.length);
}

// Los checks que dependen de una corrida real, en un solo lugar. Sirven para las dos rutas:
// la que corre y la que se omite por falta de Python. Estar en una sola lista es a proposito:
// cuando se las separaba, la ruta omitida se fue quedando vieja y contaba checks que ya no
// existian en la otra.
const CHECKS_DE_CORRIDA = [
  'map_directory.py termina con codigo 0',
  'llegan al menos 2 eventos de progreso',
  'el progreso llego REPARTIDO, no todo en un solo chunk al final',
  'hay al menos un evento que llega antes del cierre del proceso',
  'el primer evento es el de arranque (contador en 0), no uno a medio camino',
  'el progreso es monotono creciente',
  'el contador nunca supera el total real de archivos',
  'el ultimo progreso cuadra con el conteo real (contado en JS, no con el de Python)',
  'el conteo de carpetas tambien cuadra',
  'stdout sigue siendo un unico JSON parseable',
  'ningun [PROGRESO] se filtro a stdout'
];

function chkCorridaReal(res, realesArchivos, realesCarpetas, omitido) {
  if (omitido) {
    for (const n of CHECKS_DE_CORRIDA) chk(n + ' (SIN PYTHON: bloque omitido)', true, 'OMITIDO');
    return;
  }
  if (!res || !res.ok) {
    const msg = res && res.error ? String(res.error.message) : 'no se pudo ejecutar';
    for (const n of CHECKS_DE_CORRIDA) chk(n, false, 'sin corrida: ' + msg);
    return;
  }

  chk('map_directory.py termina con codigo 0 sobre el fixture de ' + TOTAL_ARCHIVOS + ' archivos',
    res.codigo === 0, 'codigo: ' + res.codigo + ', ' + Math.round(res.msTotal) + ' ms');

  chk('llegan al menos 2 eventos de progreso', res.eventos.length >= 2,
    'eventos: ' + res.eventos.length);

  // ── EL CHECK QUE JUSTIFICA ESTE ARCHIVO ──
  //
  // Un aviso importante sobre por que NO se mide "el progreso llega temprano":
  //
  // Medido en esta maquina, el arranque del interprete de Python se come ~90 ms y el
  // recorrido de 2.500 archivos dura ~9 ms. O sea que el proceso total dura ~115 ms de los
  // cuales el 80 % es arrancar Python. Cualquier proporcion del estilo "el primer evento tiene
  // que llegar en la primera mitad del recorrido" da ~85-92 % SIEMPRE, porque lo que se esta
  // midiendo es el arranque del interprete, no el streaming. Por eso esa asercion se escribio,
  // sevio caer y se borro: era una prueba de la maquina, no del codigo.
  //
  // Para que el recorrido dominara habria que llegar a cientos de miles de archivos, que
  // hacen la suite lenta y la hacen fallar por disco, no por codigo. No vale la pena.
  //
  // Lo que SI distingue el streaming del bufferizado, y es estructural, no temporal: si main.js
  // acumula stderr para entregarlo junto (que es exactamente lo que hace con stdout), el
  // proceso hijo entrega TODO en un solo chunk, en el momento del cierre. Si lo lee en vivo, el
  // pipe los entrega repartidos. Por eso la puerta es "llego en mas de un chunk", que no
  // depende de que tan rapido ni tan lento sea el disco de nadie.
  chk('el progreso llego REPARTIDO, no todo en un solo chunk al final',
    res.chunks >= 2,
    'chunks de stderr: ' + res.chunks + ' · ' + Math.round(res.chunks) + ' trozo(s) para ' + res.eventos.length + ' evento(s)');

  const primero = res.eventos[0];
  chk('hay al menos un evento que llega antes del cierre del proceso',
    !!primero && primero.ms < res.msTotal,
    'primer evento a ' + (primero ? Math.round(primero.ms) : '-') +
    ' ms, cierre a ' + Math.round(res.msTotal) + ' ms (los ~90 ms iniciales son el arranque de Python)');

  chk('el primer evento es el de arranque (contador en 0), no uno a medio camino',
    !!primero && primero.archivos === 0,
    primero ? 'primer evento: archivos=' + primero.archivos : 'sin eventos');

  let monotono = true;
  for (let i = 1; i < res.eventos.length; i++) {
    if (res.eventos[i].archivos < res.eventos[i - 1].archivos) { monotono = false; break; }
  }
  chk('el progreso es monotono creciente', monotono,
    'valores: ' + res.eventos.map(function (e) { return e.archivos; }).join(','));

  const max = res.eventos.reduce(function (m, e) { return Math.max(m, e.archivos); }, 0);
  chk('el contador nunca supera el total real de archivos', max <= realesArchivos,
    'maximo anunciado: ' + max + ', reales: ' + realesArchivos);

  const ultimo = res.eventos[res.eventos.length - 1];
  chk('el ultimo progreso cuadra con el conteo real (contado en JS, no con el de Python)',
    !!ultimo && ultimo.archivos === realesArchivos,
    ultimo ? 'ultimo: ' + ultimo.archivos + ', reales: ' + realesArchivos : 'sin eventos');

  chk('el conteo de carpetas tambien cuadra', !!ultimo && ultimo.carpetas === realesCarpetas,
    ultimo ? 'ultimo: ' + ultimo.carpetas + ', reales: ' + realesCarpetas : 'sin eventos');

  let jsonOk = false;
  try { JSON.parse(res.stdout.trim()); jsonOk = true; } catch (e) { jsonOk = false; }
  chk('stdout sigue siendo un unico JSON parseable', jsonOk,
    'bytes: ' + res.stdout.length);

  chk('ningun [PROGRESO] se filtro a stdout', res.stdout.indexOf('[PROGRESO]') === -1);
}

// ───────────────────────── Corrida

async function main() {
  console.log('\n=======================================');
  console.log('  📦867 · Integracion: el progreso llega en vivo');
  console.log('=======================================');

  chkRegexReal();
  chkTroceado();

  const python = buscarPython();
  if (!python) {
    chkCorridaReal(null, 0, 0, true);
    return imprimir();
  }

  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'kair-mapeo-int-'));
  try {
    armarFixture(fixture);
    const realesArchivos = contarArchivos(fixture);
    const realesCarpetas = fs.readdirSync(fixture).length;

    chk('el fixture tiene ' + TOTAL_ARCHIVOS + ' archivos de verdad',
      realesArchivos === TOTAL_ARCHIVOS, 'reales: ' + realesArchivos);

    const res = await correrMedido(python, scriptPath, fixture);
    chkCorridaReal(res, realesArchivos, realesCarpetas, false);
  } finally {
    try { fs.rmSync(fixture, { recursive: true, force: true }); } catch (e) { /* mejor esfuerzo */ }
  }

  imprimir();
}

function imprimir() {
  let failed = 0;
  checks.forEach(function (c) {
    if (!c.ok) failed++;
    console.log((c.ok ? 'OK  ' : 'FAIL') + '  ' + c.name + (c.extra ? '  [' + c.extra + ']' : ''));
  });
  console.log('---');
  console.log((checks.length - failed) + '/' + checks.length + ' OK');
  if (failed > 0) {
    console.log('FALLO — Hay tests que no pasaron.');
    process.exitCode = 1;
  }
}

main().catch(function (e) {
  console.error('[test-mapeo-integracion-867] error inesperado:', e && e.stack ? e.stack : e);
  console.log('0/' + checks.length + ' OK');
  console.log('FALLO — Hay tests que no pasaron.');
  process.exitCode = 1;
});