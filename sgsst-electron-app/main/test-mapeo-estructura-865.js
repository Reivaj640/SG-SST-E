/* Test de 📦865 (Fase 2): velocidad del mapeo de estructura.
 *
 * Fase 2 del plan de 5 fases. Antes de este paquete, `map_directory.py` tardaba
 * 760+ segundos y ~99,6 % de ese tiempo era el SHA-256 de cada archivo
 * (_calculate_checksum): leía los 1,73 GB byte a byte para poner un campo
 * `checksum` que NADIE lee (grep: 0 consumidores). Además recorría cada carpeta
 * con 3 consultas por entrada y dejaba `scan_date` en null.
 *
 * Qué se verifica (invariantes escritos para SOBREVIVIR a las fases 3 y 4):
 *   1. Estático (solo código, comentarios y docstrings ignorados): sin
 *      hashlib / _calculate_checksum / campo checksum; recorrido con
 *      os.scandir en un solo pase; sin os.walk ni rglob; scan_date real;
 *      y los errores de lectura siguen reportándose (no se tragan en silencio).
 *   2. Pipeline: main.js sigue limitando la salida a 64 MB y el tiempo a 30 min
 *      (guard de la Fase 1 que quedó sin test — se agrega acá, no se edita nada).
 *   3. Corrida REAL contra un fixture temporal (si no hay Python, se omite con un
 *      check aclarado): fecha ISO reciente y CERO campos `checksum` en TODO el
 *      árbol (búsqueda profunda, aguanta que la Fase 3 saque files[]).
 *   4. Semántica de atajos (symlink): una carpeta de atajo se lista VACÍA sin
 *      bajar a ella — igual que os.walk(followlinks=False). Si Windows no da
 *      permiso para crear el atajo, el bloque se omite con un check aclarado.
 *
 * A propósito NO se chequea nada que las fases siguientes van a sacar:
 * `files[]`, `file_count`, `dir_count`, `errors` ni el indentado (Fase 3),
 * ni el formato de la salida (Fase 4 agrega progreso por stderr).
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
  console.log('  📦865 · Velocidad del mapeo de estructura');
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
 * código, no el archivo entero — un comentario que explica por qué se quitó algo
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

// ───────────────────────── archivos base
if (!fs.existsSync(scriptPath) || !fs.existsSync(mainPath)) {
  console.error('FAIL: faltan map_directory.py o main.js');
  process.exit(1);
}

const pySrc = fs.readFileSync(scriptPath, 'utf8');
const pyCode = soloCodigoPy(pySrc);
const mainSrc = fs.readFileSync(mainPath, 'utf8');

// ───────────────────────── 1. el script ya no tiene el cuello de botella
chk('map_directory.py existe', true);
chk('NO importa hashlib (en el código)', !/hashlib/.test(pyCode));
chk('NO existe _calculate_checksum (en el código)', !/_calculate_checksum/.test(pyCode));
chk("NO declara el campo 'checksum' (en el código)", !/['"]checksum['"]\s*:/.test(pyCode));
chk('recorre con os.scandir (un solo pase)', /os\.scandir\(/.test(pyCode));
chk('NO usa os.walk ni Path.rglob (recorrido propio, sin atajos ajenos)',
  !/os\.walk/.test(pyCode) && !/\.rglob\(/.test(pyCode));
chk('scan_date sale con fecha y hora reales (datetime.now().isoformat)',
  /['"]scan_date['"]:\s*datetime\.now\(\)\.isoformat\(/.test(pyCode) &&
    !/['"]scan_date['"]:\s*None/.test(pyCode));
chk('los errores de lectura se reportan (no se tragan en silencio)',
  /errors\.append/.test(pyCode) || /file=sys\.stderr/.test(pyCode));

// ───────────────────────── 2. pipeline de main.js (guard de la Fase 1, 📦864)
chk('main.js limita la salida a 64 MB (maxBuffer)', /maxBuffer:\s*64\s*\*\s*1024\s*\*\s*1024/.test(mainSrc));
chk('main.js limita el tiempo a 30 min (timeout)', /timeout:\s*30\s*\*\s*60\s*\*\s*1000/.test(mainSrc));

// ───────────────────────── 3. corrida REAL contra un fixture temporal
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
  chk('corrida real de map_directory.py (Fase 2)', true, 'SIN PYTHON en la máquina: bloque omitido');
} else {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'mapeo-865-'));
  try {
    fs.mkdirSync(path.join(fixture, 'sub'));
    fs.mkdirSync(path.join(fixture, 'sub', 'interior'));
    fs.writeFileSync(path.join(fixture, 'documento.txt'), 'hola');
    fs.writeFileSync(path.join(fixture, 'Informe Año 2026.txt'), 'contenido');
    fs.writeFileSync(path.join(fixture, 'sub', 'interior', 'nota.md'), 'nota');

    // Atajo (symlink) a una carpeta que contiene una subcarpeta: si el script
    // bajara por el atajo, "no-bajar" aparecería como nieto del atajo.
    let conAtajo = false;
    try {
      fs.mkdirSync(path.join(fixture, 'destino-atajo'));
      fs.mkdirSync(path.join(fixture, 'destino-atajo', 'no-bajar'));
      fs.symlinkSync(path.join(fixture, 'destino-atajo'), path.join(fixture, 'atajo'), 'dir');
      conAtajo = true;
    } catch (e) { /* Windows sin permiso de symlink: el bloque se omite */ }

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
      // scan_date real: forma ISO local y reciente (no un null ni un placeholder).
      const sd = data.scan_date;
      const conFormato = typeof sd === 'string' &&
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(sd);
      const t = conFormato ? Date.parse(sd.slice(0, 19)) : NaN;
      const esReciente = !isNaN(t) && Math.abs(Date.now() - t) < 2 * 24 * 60 * 60 * 1000;
      chk('scan_date es una fecha y hora ISO reales (no null)', conFormato && esReciente,
        'scan_date: ' + String(sd));

      // Ningún campo checksum en TODO el árbol (búsqueda profunda): aguanta que la
      // Fase 3 saque files[] del contrato — si vuelve el checksum, esto falla.
      chk('ninguna parte de la salida trae el campo checksum', !buscarClave(data, 'checksum'));

      if (!conAtajo) {
        chk('semántica de atajos (symlink)', true,
          'SIN permiso de symlink en Windows: bloque omitido');
      } else {
        const atajo = data.structure && data.structure.subdirectories
          ? data.structure.subdirectories['atajo'] : null;
        chk('el atajo a carpeta aparece como carpeta en el dict', !!atajo,
          'claves: ' + JSON.stringify(Object.keys((data.structure && data.structure.subdirectories) || {})));
        chk('el atajo NO se recorre (subcarpeta vacía, como os.walk sin seguir atajos)',
          !!atajo && typeof atajo.subdirectories === 'object' && atajo.subdirectories !== null &&
          Object.keys(atajo.subdirectories).length === 0,
          'subdelatajo: ' + JSON.stringify(Object.keys((atajo && atajo.subdirectories) || {})));
      }
    }
  } finally {
    try { fs.rmSync(fixture, { recursive: true, force: true }); } catch (e) { /* mejor esfuerzo */ }
  }
}

correr();
