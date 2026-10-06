/* Test de 📦866 (Fase 3): tamaño del JSON del mapeo de estructura.
 *
 * Fase 3 del plan de 5 fases. El JSON que produce map_directory.py pesaba
 * ~2,98 MB: buena parte era el detalle de cada archivo (`files[]` con tamaño,
 * fechas y extensión, más `file_count`/`dir_count` por carpeta) y el resto el
 * indentado `indent=2` del json.dumps. Nada de eso lo lee nadie (grep: 0
 * consumidores) y era el peso el que obligó a subir el maxBuffer a 64 MB en la
 * Fase 1. Además los errores viajaban DENTRO del JSON en campos `errors`.
 *
 * Qué se verifica (invariantes escritos para SOBREVIVIR a la Fase 4):
 *   1. Estático (solo código, comentarios y docstrings ignorados): sin campo
 *      `files`, sin `file_count`/`dir_count`, sin campo `errors` (los problemas
 *      salen por stderr, no dentro del JSON) y sin `indent=` en el json.dumps.
 *      Se conservan el contrato de la Fase 0
 *      (`structure: _map_directory_recursive(root_path)`), el
 *      `print(json.dumps(structure` de la salida y el reporte de errores por
 *      `file=sys.stderr` (guard que ya chequea el test de la Fase 2).
 *   2. Corrida REAL contra un fixture temporal (si no hay Python, se omite con un
 *      check aclarado): la salida NO trae `files` / `file_count` / `dir_count` /
 *      `errors` en NINGÚN nodo (búsqueda profunda), viene en UNA sola línea (sin
 *      indentado) y los totales `total_files` / `total_folders` siguen cuadrando
 *      contra lo que hay en el disco — contados con una referencia independiente
 *      hecha en JS, no con el propio script.
 *   3. El contrato de la Fase 0 se vuelve a comprobar en su forma mínima:
 *      `root` absoluto, `structure.name` y `subdirectories` como dict.
 *
 * A propósito NO se chequea nada que la Fase 4 vaya a tocar: el progreso del
 * escaneo va por STDERR, así que el stdout sigue siendo un JSON puro — pero NO
 * se afirma que stderr esté vacío, porque ahí va a viajar el avance.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const scriptPath = path.join(ROOT, 'Portear', 'src', 'map_directory.py');
const mainPath = path.join(ROOT, 'main.js');

const checks = [];
function chk(name, cond, extra) {
  checks.push({ name: name, ok: !!cond, extra: extra || '' });
}

function correr() {
  let failed = 0;
  console.log('\n=======================================');
  console.log('  📦866 · Tamaño del JSON del mapeo');
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

/* Solo CÓDIGO, sin comentarios ni docstrings.
 * Regla de la casa (AGENTS.md): un guard de "esto ya no está" tiene que mirar el
 * código, no el archivo entero — el comentario que explica por qué se quitó algo
 * menciona el nombre y haría fallar el check sin que el código lo reintrodujera. */
function soloCodigoPy(x) {
  return x
    .replace(/"""[\s\S]*?"""/g, ' ')
    .replace(/'''[\s\S]*?'''/g, ' ')
    .replace(/^\s*#.*$/gm, ' ');
}

function buscarClave(obj, clave) {
  if (obj === null || typeof obj !== 'object') return false;
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      if (buscarClave(obj[i], clave)) return true;
    }
    return false;
  }
  const ks = Object.keys(obj);
  for (let i = 0; i < ks.length; i++) {
    if (ks[i] === clave) return true;
    if (buscarClave(obj[ks[i]], clave)) return true;
  }
  return false;
}

/* Referencia INDEPENDIENTE: cuenta archivos y carpetas leyendo el disco con JS.
 * Es lo que tiene que dar el script — si el contador del Python se desincroniza
 * (o alguien inventa un número), este comparison lo atrapa. Los atajos (symlink)
 * cuentan como el script los trata: la carpeta de atajo SÍ cuenta, pero NO se
 * baja a sus hijos; un atajo roto no cuenta. */
function contarDesdeDisco(dir) {
  let archivos = 0;
  let carpetas = 0;
  const entradas = fs.readdirSync(dir, { withFileTypes: true });
  for (let i = 0; i < entradas.length; i++) {
    const e = entradas[i];
    const completo = path.join(dir, e.name);
    if (e.isSymbolicLink()) {
      let st = null;
      try { st = fs.statSync(completo); } catch (err) { st = null; } // atajo roto
      if (st && st.isDirectory()) carpetas++;
      else if (st && st.isFile()) archivos++;
    } else if (e.isDirectory()) {
      carpetas++;
      const hijo = contarDesdeDisco(completo);
      archivos += hijo.archivos;
      carpetas += hijo.carpetas;
    } else if (e.isFile()) {
      archivos++;
    }
  }
  return { archivos: archivos, carpetas: carpetas };
}

// ───────────────────────── archivos base
if (!fs.existsSync(scriptPath) || !fs.existsSync(mainPath)) {
  console.error('FAIL: faltan map_directory.py o main.js');
  process.exit(1);
}

const pySrc = fs.readFileSync(scriptPath, 'utf8');
const pyCode = soloCodigoPy(pySrc);

// ───────────────────────── 1. el script ya no fabrica un JSON gordo
chk('map_directory.py existe', true);
chk("NO declara el campo 'files' (en el código)", !/['"]files['"]/.test(pyCode));
chk('NO declara file_count ni dir_count (en el código)',
  !/file_count/.test(pyCode) && !/dir_count/.test(pyCode));
chk("NO declara el campo 'errors' ni acumula errors.append (en el código)",
  !/['"]errors['"]/.test(pyCode) && !/errors\.append/.test(pyCode));
chk('el json.dumps NO lleva indent= (salida compacta)', !/indent\s*=/.test(pyCode));
chk('la salida sigue siendo un único print(json.dumps(structure',
  /print\(json\.dumps\(structure/.test(pyCode));
chk('los errores siguen saliendo por stderr (no se tragan en silencio)',
  /file=sys\.stderr/.test(pyCode));
chk('el contrato de la Fase 0 sigue intacto (structure: _map_directory_recursive(root_path))',
  /['"]structure['"]:\s*_map_directory_recursive\(root_path\)/.test(pyCode));
chk('los totales siguen existiendo (total_files / total_folders en la salida)',
  /['"]total_files['"]/.test(pyCode) && /['"]total_folders['"]/.test(pyCode));

// ───────────────────────── 2. corrida REAL contra un fixture temporal
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
  chk('corrida real de map_directory.py (Fase 3)', true, 'SIN PYTHON en la máquina: bloque omitido');
} else {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'mapeo-866-'));
  try {
    fs.mkdirSync(path.join(fixture, 'sub'));
    fs.mkdirSync(path.join(fixture, 'sub', 'interior'));
    fs.writeFileSync(path.join(fixture, 'documento.txt'), 'hola');
    fs.writeFileSync(path.join(fixture, 'Informe Año 2026.txt'), 'contenido');
    fs.writeFileSync(path.join(fixture, 'sub', 'interior', 'nota.md'), 'nota');

    // Atajo (symlink) opcional: si Windows no da permiso, el fixture queda sin él
    // y la referencia del disco cuenta lo que realmente haya.
    try {
      fs.mkdirSync(path.join(fixture, 'destino-atajo'));
      fs.mkdirSync(path.join(fixture, 'destino-atajo', 'no-bajar'));
      fs.symlinkSync(path.join(fixture, 'destino-atajo'), path.join(fixture, 'atajo'), 'dir');
    } catch (e) { /* Windows sin permiso de symlink */ }

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

    let data = null;
    if (corridaOk) {
      try { data = JSON.parse(stdout); } catch (e) { data = null; }
    }
    chk('el stdout completo es parseable como JSON', !!data);

    if (data) {
      // Búsqueda profunda: NINGÚN nodo del árbol puede traer estos campos.
      chk('ningún nodo trae el campo files', !buscarClave(data, 'files'));
      chk('ningún nodo trae file_count ni dir_count',
        !buscarClave(data, 'file_count') && !buscarClave(data, 'dir_count'));
      chk('ningún nodo trae el campo errors', !buscarClave(data, 'errors'));

      // Sin indent= el JSON sale en una sola línea (con indent=2 son cientos).
      const lineas = stdout.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
      chk('el JSON viene en UNA sola línea (sin indentado)',
        lineas.length === 1, 'líneas: ' + lineas.length);

      // Contrato de la Fase 0, en su forma mínima: el achicado no lo rompió.
      chk('root es absoluto y apunta al fixture',
        typeof data.root === 'string' && path.resolve(data.root) === path.resolve(fixture),
        'root: ' + String(data.root));
      chk('structure.name es el nombre de la carpeta raíz',
        !!data.structure && data.structure.name === path.basename(fixture),
        'name: ' + String(data.structure && data.structure.name));
      chk('structure.subdirectories sigue siendo un dict no nulo y NO un array',
        !!data.structure &&
        typeof data.structure.subdirectories === 'object' &&
        data.structure.subdirectories !== null &&
        !Array.isArray(data.structure.subdirectories));

      // Totales: el JSON ya no guarda los archivos adentro, pero el recuento tiene
      // que seguir cuadrando con lo que hay en el disco.
      const ref = contarDesdeDisco(fixture);
      chk('total_files coincide con los archivos reales del disco',
        data.total_files === ref.archivos,
        'total_files: ' + String(data.total_files) + ' vs disco: ' + ref.archivos);
      chk('total_folders coincide con las carpetas reales del disco',
        data.total_folders === ref.carpetas,
        'total_folders: ' + String(data.total_folders) + ' vs disco: ' + ref.carpetas);
    }
  } finally {
    try { fs.rmSync(fixture, { recursive: true, force: true }); } catch (e) { /* mejor esfuerzo */ }
  }
}

correr();
