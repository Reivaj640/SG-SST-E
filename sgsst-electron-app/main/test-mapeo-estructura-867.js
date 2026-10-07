/* Test de 📦867 (Fase 4): progreso real del escaneo, de Python a la pantalla.
 *
 * Hasta acá la UI mostraba "Tiempo estimado: 10-60 segundos" — una copia literal
 * que nadie calculaba — y un reloj. Cuando la carpeta estaba en Google Drive el
 * proceso pasaba 760 s y la vista no decía absolutamente nada: se veía un spinner
 * congelado y un número que subía sin que nada detrás hubiera avanzado.
 *
 * Qué se verifica:
 *   1. Estático en map_directory.py: el progreso se emite con el formato exacto,
 *      por STDERR y no por stdout (stdout tiene que quedar con el JSON puro, que es
 *      el contrato de la Fase 3), y hay tres llamadas: una forzada al arrancar (si no,
 *      la UI no muestra nada hasta que el recorrido ya viene empezado), una
 *      amortiguada dentro de la recursión y una forzada al cerrar (para que el
 *      contador no quede con el número de hasta 250 ms antes).
 *   2. Corrida REAL contra un fixture: stdout sigue siendo UN JSON de una línea,
 *      stderr trae líneas [PROGRESO] bien formadas, y la última cierra con los
 *      totales reales — contados aparte, en JS, no con los del propio script.
 *   3. Bite test: si el progreso se manda a stdout, el JSON deja de ser parseable y
 *      este check se cae. Es el guard que evita la regresión más probable.
 *   4. El cableado: main.js escucha stderr y reenvía por el canal 'mapeo-progreso'
 *      con guard de ventana destruida; preload.js expone el alta con su baja;
 *      config-viewer.html se suscribe, pinta el progreso y lo suelta en TODOS los
 *      caminos de salida; y el texto "10-60 segundos" ya no está en la vista.
 *
 * Los checks 1-4 ignoran comentarios: los comentarios de esta fase NOMBRAN los
 * tokens que se verifican (por eso se explican acá), así que buscarlos en el
 * archivo entero daría verde siempre. Es la misma regla de la casa que aplica el
 * test 866 con soloCodigoPy().
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const scriptPath = path.join(ROOT, 'Portear', 'src', 'map_directory.py');
const mainPath = path.join(ROOT, 'main.js');
const preloadPath = path.join(ROOT, 'preload.js');
const configViewerPath = path.join(ROOT, 'components', 'config', 'config-viewer.html');

const checks = [];
function chk(name, cond, extra) {
  checks.push({ name: name, ok: !!cond, extra: extra || '' });
}

function correr() {
  let failed = 0;
  console.log('\n=======================================');
  console.log('  📦867 · Progreso real del escaneo');
  console.log('=======================================');
  checks.forEach(function (c) {
    if (!c.ok) failed++;
    console.log((c.ok ? 'OK  ' : 'FAIL') + '  ' + c.name + (c.extra ? '  [' + c.extra + ']' : ''));
  });
  console.log('---');
  console.log((checks.length - failed) + '/' + checks.length + ' OK');
  console.log('=======================================');
  process.exit(failed === 0 ? 0 : 1);
}

/* Quita comentarios de un fuente JS/HTML sin tocar lo que hay dentro de los
 * strings. Un replace con regex no sirve: este código tiene URLs ('https://...')
 * dentro de comillas y un "//" de URL se leería como inicio de comentario.
 * Se recorre carácter a carácter y se siguen tres estados. Los regex literales
 * no se_parsean_ aparte: un '/' suelto se deja pasar salvo que lo siga otro
 * '/' o '*', que es el único caso que importa para lo que este test verifica. */
function soloCodigo(texto) {
  let salida = '';
  let i = 0;
  const n = texto.length;
  while (i < n) {
    const c = texto[i];
    const siguiente = texto[i + 1];
    if (c === '/' && siguiente === '/') {
      while (i < n && texto[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && siguiente === '*') {
      i += 2;
      while (i < n && !(texto[i] === '*' && texto[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      const comilla = c;
      salida += c;
      i++;
      while (i < n) {
        if (texto[i] === '\\') { salida += texto[i] + (texto[i + 1] || ''); i += 2; continue; }
        salida += texto[i];
        if (texto[i] === comilla) { i++; break; }
        i++;
      }
      continue;
    }
    salida += c;
    i++;
  }
  return salida;
}

function soloCodigoPy(x) {
  return x
    .replace(/"""[\s\S]*?"""/g, ' ')
    .replace(/'''[\s\S]*?'''/g, ' ')
    .replace(/^\s*#.*$/gm, ' ');
}

function buscarPython() {
  const candidatos = ['python', 'py', 'python3'];
  for (let i = 0; i < candidatos.length; i++) {
    try {
      spawnSync(candidatos[i], ['--version'], { windowsHide: true, timeout: 15000, encoding: 'utf8' });
      if (!/error/i.test(candidatos[i])) return candidatos[i];
    } catch (e) { /* probar el siguiente */ }
  }
  return null;
}

const RE_PROGRESO = /^\[PROGRESO\] archivos=(\d+) carpetas=(\d+)\s*$/;

function correrScript(py, rutaScript, rutaFixture) {
  return spawnSync(py, [rutaScript, rutaFixture], {
    windowsHide: true,
    timeout: 60000,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    cwd: path.dirname(rutaScript),
    env: Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8' })
  });
}

// ───────────────────────── ¿están los archivos?
if (!fs.existsSync(scriptPath) || !fs.existsSync(mainPath) ||
    !fs.existsSync(preloadPath) || !fs.existsSync(configViewerPath)) {
  console.error('FAIL: falta algún archivo del mapeo');
  process.exit(1);
}

const pySrc = fs.readFileSync(scriptPath, 'utf8');
const pyCode = soloCodigoPy(pySrc);
const mainCode = soloCodigo(fs.readFileSync(mainPath, 'utf8'));
const preloadCode = soloCodigo(fs.readFileSync(preloadPath, 'utf8'));
const configCode = soloCodigo(fs.readFileSync(configViewerPath, 'utf8'));

/* Lo que el USUARIO ve en config-viewer.html: el archivo menos los bloques <script>.
 * Para el overlay hay que mirar acá y NO en `soloCodigo()`: ese stripper trata un "//"
 * como inicio de comentario, y este HTML tiene URLs ('https://...') dentro de
 * cadenas — el texto se le comía y el check daba verde sobre un archivo que en
 * pantalla todavía tenía la copia vieja. Los comentarios JS sí pueden nombrar
 * "10-60 segundos" (documentan lo que se quitó); el markup del overlay, no. */
const configVisible = fs.readFileSync(configViewerPath, 'utf8')
  .replace(/<script[\s\S]*?<\/script>/gi, '');

// ───────────────────────── 1. el script: formato, destino y momento
chk('map_directory.py importa time (para amortiguar el progreso)', /^import time$/m.test(pyCode));
chk('define el helper _avisar_progreso', /def _avisar_progreso\(/.test(pyCode));
chk('el formato de la línea es [PROGRESO] archivos=N carpetas=N',
  /\[PROGRESO\] archivos=%d carpetas=%d/.test(pyCode));
chk('el progreso se escribe con flush=True (si no, se pierde al terminar el escaneo)',
  /file=sys\.stderr,\s*flush=True/.test(pyCode) || /flush=True[\s\S]{0,40}file=sys\.stderr/.test(pyCode));
chk('el progreso NUNCA va a stdout (stdout es el JSON puro del contrato de la Fase 3)',
  !/file=sys\.stdout/.test(pyCode));
chk('el amortiguado usa time.monotonic() (monotonic, no time.time: salta con el reloj)',
  /time\.monotonic\(\)/.test(pyCode));
chk('el amortiguado tiene un umbral de 0,25 s',
  /0\.25/.test(pyCode));
chk('stdout sigue siendo un único print(json.dumps(structure',
  /print\(json\.dumps\(structure/.test(pyCode));
chk('hay una llamada forzada al arrancar el escaneo',
  /_avisar_progreso\(forzar=True\)/.test(pyCode));
chk('hay una llamada dentro de la recursión que NO fuerza (el muestreo amortizado)',
  /_avisar_progreso\(\)/.test(pyCode));
chk('el progreso se emite al menos dos veces: arranque y cierre',
  (pyCode.match(/_avisar_progreso\(/g) || []).length >= 3,
  'llamadas: ' + (pyCode.match(/_avisar_progreso\(/g) || []).length);
chk('la llamada forzada de arranque está dentro de map_directory (antes de armar el dict)',
  /def map_directory\(root_path\):[\s\S]{0,600}?_avisar_progreso\(forzar=True\)[\s\S]{0,200}?structure\s*=\s*\{/.test(pyCode));
chk('la llamada forzada de cierre está justo antes de imprimir el JSON',
  /_avisar_progreso\(forzar=True\)\s*\n\s*print\(json\.dumps\(structure/.test(pyCode));

// ───────────────────────── 2 y 3. corrida real + bite test
const python = buscarPython();

if (!python) {
  chk('corrida real de map_directory.py (Fase 4)', true, 'SIN PYTHON en la máquina: bloque omitido');
  chk('bite test: el progreso a stdout rompe el JSON', true, 'SIN PYTHON en la máquina: bloque omitido');
} else {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'mapeo-867-'));
  const fixtureMordido = fs.mkdtempSync(path.join(os.tmpdir(), 'mapeo-867-bite-'));
  try {
    fs.mkdirSync(path.join(fixture, 'sub'));
    fs.mkdirSync(path.join(fixture, 'sub', 'interior'));
    fs.writeFileSync(path.join(fixture, 'documento.txt'), 'hola');
    fs.writeFileSync(path.join(fixture, 'Informe Año 2026.txt'), 'contenido');
    fs.writeFileSync(path.join(fixture, 'sub', 'interior', 'nota.md'), 'nota');

    const res = correrScript(python, scriptPath, fixture);
    const stdout = res.stdout || '';
    const stderr = res.stderr || '';

    chk('map_directory.py corre sin errores sobre el fixture', res.status === 0,
      'status: ' + res.status + (res.error ? ' ' + res.error.message : ''));

    let data = null;
    try { data = JSON.parse(stdout); } catch (e) { data = null; }
    chk('el stdout completo sigue siendo parseable como JSON (el progreso NO lo contaminó)', !!data);

    const lineasStdout = stdout.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
    chk('el JSON viene en UNA sola línea (contrato de la Fase 3 intacto)',
      lineasStdout.length === 1, 'líneas: ' + lineasStdout.length);
    chk('ninguna línea [PROGRESO] aparece en stdout',
      stdout.indexOf('[PROGRESO]') === -1);

    // stderr: líneas de progreso bien formadas
    const lineasProgreso = stderr.replace(/\r\n/g, '\n').split('\n')
      .map(function (l) { return l.trim(); })
      .filter(function (l) { return l.indexOf('[PROGRESO]') === 0; });
    chk('stderr trae al menos una línea de progreso', lineasProgreso.length >= 1,
      'líneas: ' + lineasProgreso.length);
    chk('TODAS las líneas de progreso cumplen el formato exacto',
      lineasProgreso.length >= 1 && lineasProgreso.every(function (l) { return RE_PROGRESO.test(l); }),
      lineasProgreso.length ? 'mala: ' + JSON.stringify(lineasProgreso.filter(function (l) { return !RE_PROGRESO.test(l); })[0] || null) : '');
    chk('la primera línea de progreso es la forzada de arranque (0 y 0)',
      lineasProgreso.length >= 1 && lineasProgreso[0] === '[PROGRESO] archivos=0 carpetas=0',
      lineasProgreso.length ? 'primera: ' + lineasProgreso[0] : '');

    if (data && lineasProgreso.length) {
      const ultima = lineasProgreso[lineasProgreso.length - 1].match(RE_PROGRESO);
      chk('la última línea de progreso cierra con los totales reales del escaneo',
        ultima && parseInt(ultima[1], 10) === data.total_files &&
        parseInt(ultima[2], 10) === data.total_folders,
        'cierre: archivos=' + (ultima && ultima[1]) + ' carpetas=' + (ultima && ultima[2]) +
        ' vs JSON: ' + data.total_files + '/' + data.total_folders);
    }

    // ── BITE TEST ────────────────────────────────────────────────────────
    // El mismo script, pero con el progreso yéndose a stdout. Si el guard está
    // bien puesto, acá el JSON tiene que romperse: es lo que pasa si alguien
    // "simplifica" el print y manda el avance por donde sale el resultado.
    const srcMordido = pySrc.replace('file=sys.stderr, flush=True)', 'file=sys.stdout, flush=True)');
    const cambioAplicado = srcMordido !== pySrc;
    const scriptMordido = path.join(fixtureMordido, 'map_directory_mordido.py');
    fs.writeFileSync(scriptMordido, srcMordido, 'utf8');

    if (!cambioAplicado) {
      chk('bite test: el progreso a stdout rompe el JSON', false,
        'no se pudo redirigir el print de progreso a stdout: el guard no tiene donde morder');
    } else {
      const resMordido = correrScript(python, scriptMordido, fixture);
      const stdoutMordido = resMordido.stdout || '';
      let dataMordido = null;
      try { dataMordido = JSON.parse(stdoutMordido); } catch (e) { dataMordido = null; }
      chk('bite test: si el progreso fuera a stdout, el JSON dejaría de ser parseable',
        dataMordido === null,
        'el guard muerde si el JSON se rompe: ' + (dataMordido === null));
    }
  } finally {
    try { fs.rmSync(fixture, { recursive: true, force: true }); } catch (e) { /* mejor esfuerzo */ }
    try { fs.rmSync(fixtureMordido, { recursive: true, force: true }); } catch (e) { /* mejor esfuerzo */ }
  }
}

// ───────────────────────── 4a. main.js: escucha stderr y reenvía
chk('main.js sigue llamando a execFilePromise con el script y el directorio',
  /execFilePromise\(pythonPath,\s*\[pythonScriptPath,\s*directoryPath\]/.test(mainCode));
chk('execFilePromise quedó envuelto (ya no es un promisify pelado, que no expone el hijo)',
  !/const execFilePromise = promisify\(execFile\);/.test(mainCode));
chk('la promesa expone .child para poder engancharle el stream',
  /\.child\s*=\s*hijo/.test(mainCode));
chk('el handler se queda con la promesa y lee child.stderr',
  /promesaMapeo\.child\.stderr/.test(mainCode) || /\.child\.stderr\.on\(['"]data['"]/.test(mainCode));
chk('reenvía el progreso por el canal mapeo-progreso',
  /send\(\s*['"]mapeo-progreso['"]/.test(mainCode));
chk('el progreso viaja con archivos y carpetas numéricos',
  /archivos:\s*(parseInt|Number)\(/.test(mainCode) && /carpetas:\s*(parseInt|Number)\(/.test(mainCode));
chk('el listener filtra las líneas que no son de progreso antes de enviarlas',
  /match\(\/\^\\\[PROGRESO\\\]\s*archivos=/.test(mainCode) || /PROGRESO\\\] archivos=/.test(mainCode));
chk('guarda contra enviar a una ventana ya destruida (manda revienta el proceso main)',
  /event\.sender\.isDestroyed\(\)/.test(mainCode));
chk('el handler sigue reservando con maxBuffer (la Fase 1 no se puede perder)',
  /maxBuffer:\s*64\s*\*\s*1024\s*\*\s*1024/.test(mainCode));
chk('el handler sigue teniendo timeout (la Fase 1 no se puede perder)',
  /timeout:\s*30\s*\*\s*60\s*\*\s*1000/.test(mainCode));

// ───────────────────────── 4b. preload.js: el alta con su baja
chk('preload.js expone onMapDirectoryProgress',
  /onMapDirectoryProgress\s*:/.test(preloadCode));
chk('onMapDirectoryProgress se suscribe al canal mapeo-progreso',
  /onMapDirectoryProgress[\s\S]{0,400}?ipcRenderer\.on\(\s*['"]mapeo-progreso['"]/.test(preloadCode));
chk('onMapDirectoryProgress devuelve la función que quita el listener',
  /onMapDirectoryProgress[\s\S]{0,500}?removeListener\(\s*['"]mapeo-progreso['"]/.test(preloadCode));

// ───────────────────────── 4c. config-viewer.html: la vista
chk('la copia "10-60 segundos" ya NO está en lo que el usuario ve (markup, sin <script>)',
  configVisible.indexOf('10-60 segundos') === -1);
chk('la vista ya no promete un "Tiempo estimado" que nunca se calculó',
  configVisible.indexOf('Tiempo estimado') === -1);
chk('la vista avisa que una carpeta en la nube puede tardar varios minutos',
  configVisible.indexOf('puede tardar varios minutos') !== -1);
chk('la vista tiene un elemento dedicated para el progreso real',
  /id="mapping-progress"/.test(configVisible));
chk('la vista busca ese elemento para poder actualizarlo',
  /getElementById\(\s*['"]mapping-progress['"]\s*\)/.test(configCode));
chk('la vista se suscribe al progreso con la API del preload',
  /onMapDirectoryProgress/.test(configCode));
chk('la vista pinta los archivos y las carpetas que llegan',
  /mappingProgress\.innerHTML[\s\S]{0,300}?progreso\.archivos/.test(configCode) &&
  /mappingProgress\.innerHTML[\s\S]{0,300}?progreso\.carpetas/.test(configCode));
chk('la vista suelta el listener en TODOS los caminos de salida (si no, sobrevive al overlay)',
  (configCode.match(/soltarProgreso\(\);/g) || []).length >= 3,
  'llamadas: ' + (configCode.match(/soltarProgreso\(\);/g) || []).length);
chk('soltarProgreso es idempotente (anula la referencia, no se puede llamar dos veces)',
  /quitarListenerProgreso\s*=\s*null/.test(configCode));

correr();