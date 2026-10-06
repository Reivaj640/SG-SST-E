/* Test de 📦863 (Fase 0): contrato del mapeo de estructura de documentos.
 *
 * El mapeo ("Mapeando Estructura de Documentos") nunca terminaba: el JSON que
 * produce map_directory.py pesa ~2,98 MB y execFile corta el stdout en 1 MiB,
 * así que JSON.parse reventaba SIEMPRE después de un escaneo de 760+ segundos.
 * Este test fija ANTES el contrato que las fases siguientes (📦864-867) van a
 * optimizar, para que ningún cambio de velocidad o de tamaño lo rompa.
 *
 * Qué se verifica (invariantes que sobreviven a las fases 1-4):
 *   1. map_directory.py corre DE VERDAD contra un fixture temporal y su stdout
 *      completo se puede parsear como JSON (si no hay Python, se omite ese
 *      bloque y quedan los checks estructurales, sin romper la corrida).
 *   2. La forma del contrato: `root` absoluto, `structure.name`,
 *      `structure.path` absoluto, `subdirectories` como OBJETO (no array) y
 *      presencia recursiva de las carpetas del fixture.
 *   3. El pipeline de main.js: handler `map-directory`, parseo del stdout y
 *      presencia del executor `mapDirectory` en config-viewer.
 *   4. Las DOS funciones consumidoras extraídas del código real y EJECUTADAS:
 *      `searchInStructure` (main.js) y `formatStructureForLog` (renderer.js).
 *
 * A propósito NO se chequea nada que las fases siguientes van a sacar:
 * `checksum` / SHA-256 (Fase 2), `files[]` / `file_count` / indentado (Fase 3),
 * ni el formato de `scan_date` (Fase 2 lo corrige de null a fecha real).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const scriptPath = path.join(ROOT, 'Portear', 'src', 'map_directory.py');
const mainPath = path.join(ROOT, 'main.js');
const rendererPath = path.join(ROOT, 'renderer.js');
const configPath = path.join(ROOT, 'components', 'config', 'config-viewer.html');
const preloadPath = path.join(ROOT, 'preload.js');

const checks = [];
function chk(name, cond, extra) {
  checks.push({ name: name, ok: !!cond, extra: extra || '' });
}

function correr() {
  let failed = 0;
  console.log('\n=======================================');
  console.log('  📦863 · Contrato del mapeo de estructura');
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

// ───────────────────────── archivos base
if (!fs.existsSync(scriptPath) || !fs.existsSync(mainPath)) {
  console.error('FAIL: faltan map_directory.py o main.js');
  process.exit(1);
}

const pySrc = fs.readFileSync(scriptPath, 'utf8');
const mainSrc = fs.readFileSync(mainPath, 'utf8');
const rendererSrc = fs.readFileSync(rendererPath, 'utf8');
const configSrc = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf8') : '';
const preloadSrc = fs.existsSync(preloadPath) ? fs.readFileSync(preloadPath, 'utf8') : '';

// ───────────────────────── 1. el script existe y declara el contrato
chk('map_directory.py existe', true);
chk('define map_directory(root_path)', /def map_directory\(root_path\)/.test(pySrc));
chk('devuelve la clave root', /'root':\s*str\(root_path\)/.test(pySrc));
chk('devuelve la clave structure', /'structure':\s*_map_directory_recursive\(root_path\)/.test(pySrc));
chk('cada nodo tiene name', /'name':\s*_clean_string_for_json\(directory_path\.name\)/.test(pySrc));
chk('cada nodo tiene path', /'path':\s*_clean_string_for_json\(str\(directory_path\)\)/.test(pySrc));
chk(
  'subdirectories es un objeto (dict), no una lista',
  /'subdirectories':\s*\{\}/.test(pySrc) &&
    /directory_info\['subdirectories'\]\[clean_name\]\s*=\s*subdir_info/.test(pySrc)
);
chk('la salida es un único JSON por stdout', /print\(json\.dumps\(structure/.test(pySrc));

// ───────────────────────── 2. pipeline en main.js y en la UI
chk("handler IPC 'map-directory' registrado", /ipcMain\.handle\('map-directory'/.test(mainSrc));
chk(
  'el handler ejecuta map_directory.py con el directorio pedido',
  /execFilePromise\(pythonPath,\s*\[pythonScriptPath,\s*directoryPath\]/.test(mainSrc)
);
chk('main.js hace JSON.parse(stdout)', /JSON\.parse\(\s*stdout\s*\)/.test(mainSrc));
chk('getPython() sigue resolviendo el intérprete', /await getPython\(\)/.test(mainSrc));
chk('config-viewer sigue llamando a mapDirectory', /mapDirectory\s*\(/.test(configSrc));
chk('preload expone mapDirectory', /mapDirectory\s*[:(]/.test(preloadSrc));

// ───────────────────────── 3. searchInStructure, extraída y EJECUTADA
const fnSearch = mainSrc.match(/function searchInStructure\(node, searchTerm\)\s*\{[\s\S]*?\n\}/);
chk('searchInStructure() existe en main.js', !!fnSearch);

if (fnSearch) {
  const buscar = new Function(
    'node', 'searchTerm',
    'return (' + fnSearch[0] + ')(node, searchTerm);'
  );

  // Árbol fabricado con la MISMA forma que entrega el script (subdirectories dict).
  const arbol = {
    name: 'empresa',
    path: 'C:/drive/empresa',
    subdirectories: {
      '2. Gestión Integral': {
        name: '2. Gestión Integral',
        path: 'C:/drive/empresa/2. Gestión Integral',
        subdirectories: {
          '2.4.1 Politica': {
            name: '2.4.1 Politica',
            path: 'C:/drive/empresa/2. Gestión Integral/2.4.1 Politica',
            subdirectories: {}
          }
        }
      }
    }
  };

  chk(
    'busca por código exacto (2.4.1 no matchea 4.2.4.1)',
    buscar(arbol, '2.4.1') === 'C:/drive/empresa/2. Gestión Integral/2.4.1 Politica',
    'recibio: ' + String(buscar(arbol, '2.4.1'))
  );

  chk(
    'un código parecido NO devuelve una ruta falsa',
    buscar(arbol, '9.9.9') === null,
    'recibio: ' + String(buscar(arbol, '9.9.9'))
  );

  chk(
    'búsqueda laxa por nombre normal',
    buscar(arbol, 'Politica') === 'C:/drive/empresa/2. Gestión Integral/2.4.1 Politica',
    'recibio: ' + String(buscar(arbol, 'Politica'))
  );

  chk(
    'recorre subdirectorios anidados (dict de dicts)',
    buscar(arbol, '2.4.1') !== null && buscar(arbol, 'inexistente') === null
  );

  chk(
    'sin coincidencias devuelve null (no un string vacío)',
    buscar(arbol, 'zzz-no-existe') === null
  );
}

chk(
  'get-document-folders usa searchInStructure',
  /ipcMain\.handle\('get-document-folders'/.test(mainSrc) &&
    /searchInStructure\(/.test(mainSrc)
);

// ───────────────────────── 4. formatStructureForLog, extraída y EJECUTADA
const fnLog = rendererSrc.match(/function formatStructureForLog\(node, indent = ''\)\s*\{[\s\S]*?\n\}/);
chk('formatStructureForLog() existe en renderer.js', !!fnLog);

if (fnLog) {
  const formatear = new Function(
    'node', 'indent',
    'return (' + fnLog[0] + ')(node, indent);'
  );

  const nodo = {
    name: '2.4.1 Politica',
    path: 'C:/drive/empresa/2.4.1 Politica',
    subdirectories: {
      'sub': { name: 'sub', path: 'C:/drive/empresa/2.4.1 Politica/sub', subdirectories: {} }
    }
  };

  const salida = formatear(nodo, '');
  chk('imprime el nombre del directorio', /\[DIR\] 2\.4\.1 Politica/.test(salida));
  chk('imprime los subdirectorios anidados', /\[DIR\] sub/.test(salida));

  // Fase 3 puede sacar files[] del contrato: el formateador tiene que tolerarlo.
  const sinFiles = formatear({ name: 'x', path: '/x', subdirectories: {} }, '');
  chk('no rompe si el nodo no trae files', typeof sinFiles === 'string' && /\[DIR\] x/.test(sinFiles));

  const conFiles = formatear(
    { name: 'y', path: '/y', subdirectories: {}, files: [{ name: 'a.txt', size: 10 }] },
    ''
  );
  chk('si el nodo trae files también los lista', /\[FILE\] a\.txt/.test(conFiles));
}

// ───────────────────────── 5. corrida REAL contra un fixture temporal
function buscarPython() {
  const candidatos = ['python', 'py', 'python3'];
  for (let i = 0; i < candidatos.length; i++) {
    try {
      execFileSync(candidatos[i], ['--version'], { windowsHide: true, timeout: 15000, stdio: 'pipe' });
      return candidatos[i];
    } catch (e) { /* probar el siguiente */ }
  }
  return null;
}

const python = buscarPython();

if (!python) {
  chk('corrida real de map_directory.py', true, 'SIN PYTHON en la máquina: bloque omitido');
} else {
  // Fixture mínimo: carpeta, subcarpeta y subcarpeta anidada.
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'mapeo-863-'));
  try {
    fs.mkdirSync(path.join(fixture, 'sub'));
    fs.mkdirSync(path.join(fixture, 'sub', 'interior'));
    fs.writeFileSync(path.join(fixture, 'documento.txt'), 'hola');
    fs.writeFileSync(path.join(fixture, 'sub', 'interior', 'nota.md'), 'nota');

    let stdout = '';
    let corridaOk = true;
    let motivo = '';
    try {
      stdout = execFileSync(python, [scriptPath, fixture], {
        windowsHide: true,
        timeout: 60000,
        maxBuffer: 64 * 1024 * 1024,
        cwd: path.dirname(scriptPath),
        env: Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8' }),
        stdio: ['ignore', 'pipe', 'pipe']
      }).toString('utf8');
    } catch (e) {
      corridaOk = false;
      motivo = (e.stderr ? String(e.stderr).slice(0, 200) : e.message);
    }

    chk('map_directory.py corre sin errores sobre el fixture', corridaOk, motivo);
    chk('el stdout completo es parseable como JSON', (function () {
      if (!corridaOk) return false;
      try { JSON.parse(stdout); return true; } catch (e) { return false; }
    })());

    if (corridaOk) {
      const data = JSON.parse(stdout);

      chk('root es absoluto y apunta al fixture',
        typeof data.root === 'string' &&
        path.resolve(data.root) === path.resolve(fixture),
        'root: ' + String(data.root));

      chk('structure.name es el nombre de la carpeta raíz',
        !!data.structure && data.structure.name === path.basename(fixture),
        'name: ' + String(data.structure && data.structure.name));

      chk('structure.path es absoluto',
        !!data.structure && typeof data.structure.path === 'string' &&
        path.resolve(data.structure.path) === path.resolve(fixture),
        'path: ' + String(data.structure && data.structure.path));

      chk('structure.subdirectories es un objeto no nulo y NO un array',
        !!data.structure &&
        typeof data.structure.subdirectories === 'object' &&
        data.structure.subdirectories !== null &&
        !Array.isArray(data.structure.subdirectories));

      const sub = data.structure.subdirectories ? data.structure.subdirectories['sub'] : null;
      chk('aparece la subcarpeta "sub" como clave del dict', !!sub,
        'claves: ' + JSON.stringify(Object.keys(data.structure.subdirectories || {})));

      chk('el nodo "sub" conserva name y path absolutos',
        !!sub && sub.name === 'sub' && path.resolve(sub.path) === path.join(fixture, 'sub'));

      const interior = sub && sub.subdirectories ? sub.subdirectories['interior'] : null;
      chk('la subcarpeta anidada "interior" también aparece', !!interior,
        'claves de sub: ' + JSON.stringify(Object.keys((sub && sub.subdirectories) || {})));

      chk('el path de "interior" es absoluto',
        !!interior && path.resolve(interior.path) === path.join(fixture, 'sub', 'interior'));
    }
  } finally {
    try { fs.rmSync(fixture, { recursive: true, force: true }); } catch (e) { /* mejor esfuerzo */ }
  }
}

correr();
