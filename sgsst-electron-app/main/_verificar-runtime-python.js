/* 📦1085 — Guard de build: el runtime de Python tiene que SERVIR, no estar.
 *
 * Lo que pasó el 17-nov-2026 (y por que este archivo existe).
 *
 * `Portear/python-embed/` esta en `.gitignore` (`.gitignore:46`): el runtime
 * NUNCA viaja en el repo, se prepara por maquina con
 * `scripts\prepare-python-embed.bat`. El `extraResources` de `package.json`
 * lo copia a `resources/python-embed/` del instalador, y si la carpeta no
 * existe electron-builder NO avisa: copia lo que hay y sigue.
 *
 * El resultado fue un instalador de 360 MB al lado del de 488 MB que estaba
 * publicado, con las mismas funciones dead: el registro de incapacidades, las
 * actas COPASST y de comite de convivencia, los indicadores y la conversion
 * Word/Excel -> PDF dependian de un runtime que novelist.
 *
 * Peor: el script que prepara el runtime TERMINABA CON "OK" aunque no hubiera
 * pasado nada. Sus "OK" miraban que el archivo existiera, no que sirviera.
 * El sintoma real era "No module named pip": sin `import site` en el
 * `python311._pth`, el interprete embebido NO ve `Lib\site-packages`, asi que
 * no ve ni el pip ni pandas.
 *
 * QUE COMPRUEBA ESTE GUARD, en orden:
 *   1. que exista `python.exe` en el runtime;
 *   2. que el `.pth` tenga `import site` ACTIVO (no comentado);
 *   3. que el interprete pueda IMPORTAR las dependencias que la app usa.
 *
 * COMO SE ENGANCHA. `package.json` -> `build.beforePack`:
 *
 *     "beforePack": "./main/_verificar-runtime-python.js"
 *
 * electron-builder resuelve ese string como un MODULO (`require.resolve`) y
 * llama a su export `beforePack`. NO es un hook de npm: `prebuild` corre
 * solo con `npm run build`, y el flujo de release es
 * `npx electron-builder --win --publish=always`, que no pasa por npm y se
 * saltaria el guard entero. `beforePack` lo ejecuta electron-builder siempre.
 *
 * Este archivo tambien se puede correr solo (`node main\_verificar-runtime-python.js`),
 * que es como lo prueba `main/test-scripts-batch-1085.js`.
 *
 * Variables de entorno (solo para las pruebas):
 *   KAIR_PYTHON_EMBED_DIR  Carpeta del runtime. Por defecto `Portear/python-embed`.
 *   KAIR_PYTHON_DEPS       Dependencias a importar. Por defecto `pandas, openpyxl`.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const APP = path.resolve(__dirname, '..');
const EMBED = process.env.KAIR_PYTHON_EMBED_DIR
  ? path.resolve(process.env.KAIR_PYTHON_EMBED_DIR)
  : path.join(APP, 'Portear', 'python-embed');

const DEPS = (process.env.KAIR_PYTHON_DEPS || 'pandas, openpyxl')
  .split(',')
  .map(function (s) { return s.trim(); })
  .filter(Boolean);

// ── La verificacion ────────────────────────────────────────────────────────
// Devuelve { ok, motivo, titulo, lineas }. El `motivo` es un CODIGO, no una
// frase: es lo que permite distinguir un fallo de otro sin depender del
// texto libre.
function verificar() {
  // 1. El interprete.
  const python = path.join(EMBED, 'python.exe');
  if (!fs.existsSync(python)) {
    return {
      ok: false,
      motivo: 'SIN_RUNTIME',
      titulo: 'el runtime de Python no esta preparado',
      lineas: [
        'No existe: ' + python,
        '',
        'El runtime va DENTRO del instalador (resources/python-embed). Sin el, la',
        'app instalada pierde el registro de incapacidades, las actas y los',
        'indicadores, y no hay aviso: el build sale igual, pero mas liviano.',
        '',
        'Preparelo en la maquina que compila:',
        '    scripts\\prepare-python-embed.bat',
        '',
        'El README de Portear dice lo mismo desde la v0.1.80.'
      ]
    };
  }

  // 2. El .pth: 'import site' tiene que estar ACTIVO.
  // Sin esto, el interprete embebido no agrega `Lib\site-packages` al
  // `sys.path`: no ve ni el pip ni ninguna dependencia. El sintoma es
  // "No module named pip".
  const pths = fs.readdirSync(EMBED).filter(function (n) { return /^python3.*\._pth$/.test(n); });
  if (!pths.length) {
    return {
      ok: false,
      motivo: 'SIN_PTH',
      titulo: 'el runtime de Python esta incompleto: falta el archivo .pth',
      lineas: [
        'En ' + EMBED + ' no hay ningun python3XX._pth.',
        'Sin ese archivo, el interprete no sabe donde buscar sus paquetes.',
        '',
        'Vuelva a correr: scripts\\prepare-python-embed.bat'
      ]
    };
  }
  const pth = path.join(EMBED, pths[0]);
  const lineasPth = fs.readFileSync(pth, 'utf8').split(/\r?\n/);
  const siteActivo = lineasPth.some(function (l) { return /^\s*import\s+site\s*$/.test(l); });
  if (!siteActivo) {
    return {
      ok: false,
      motivo: 'PTH_SIN_IMPORT_SITE',
      titulo: "el runtime de Python tiene 'import site' comentado",
      lineas: [
        'Archivo: ' + pth,
        '',
        "La linea 'import site' tiene que estar SIN comentario (#). Sin ella, el",
        'interprete no ve Lib\\site-packages: no ve el pip, ni pandas, ni openpyxl.',
        'Ese fue el defecto del 17-nov: el script de preparacion calculaba mal el',
        'nombre del .pth (python31._pth en vez de python311._pth), el paso fallaba',
        'en silencio, y las dependencias nunca se instalaban.',
        '',
        'Corrija el .pth dejando esto:',
        '    import site',
        '',
        'Y vuelva a correr: scripts\\prepare-python-embed.bat'
      ]
    };
  }

  // 3. Las dependencias se importan de verdad.
  // Estas son las que exige la app (main/python-deps.js: PYTHON_DEPS_REQUERIDAS).
  const r = spawnSync(python, ['-c', 'import ' + DEPS.join(', ')], { encoding: 'utf8', timeout: 120000 });
  if (r.status !== 0) {
    const detalle = String(r.stderr || r.stdout || ('codigo ' + r.status)).split(/\r?\n/)[0].slice(0, 200);
    return {
      ok: false,
      motivo: 'SIN_DEPENDENCIAS',
      titulo: 'el runtime de Python no sirve: no se pueden importar ' + DEPS.join(', '),
      lineas: [
        'Interprete: ' + python,
        'Error: ' + detalle,
        '',
        'El interprete arranca pero no ve los paquetes. Casi siempre es',
        "'import site' sin activar, o Lib\\site-packages vacio.",
        '',
        'Corrija el .pth y reinstale las dependencias:',
        '    scripts\\prepare-python-embed.bat'
      ]
    };
  }

  return { ok: true, motivo: 'OK', titulo: '', lineas: [] };
}

function imprimirFalla(r) {
  console.error('');
  console.error('========================================================================');
  console.error('  BUILD DETENIDO: ' + r.titulo);
  console.error('========================================================================');
  console.error('');
  console.error('MOTIVO: ' + r.motivo);
  console.error('');
  r.lineas.forEach(function (l) { console.error('  ' + l); });
  console.error('');
}

// ── El hook que electron-builder llama ─────────────────────────────────────
// Si algo falla, se tira la excepcion: electron-builder corta el build.
async function beforePack(context) {
  const r = verificar();
  if (!r.ok) {
    imprimirFalla(r);
    throw new Error('Build detenido: ' + r.titulo + ' (MOTIVO: ' + r.motivo + ')');
  }
  console.log('[build-guard] Runtime de Python OK (' + DEPS.join(', ') + '). Se puede empaquetar.');
}

module.exports = { beforePack: beforePack, verificar: verificar };

// ── Corrida sola ───────────────────────────────────────────────────────────
// `require.main === module` es falso cuando electron-builder importa el
// archivo: ahi no se corre nada, solo se usa el export.
if (require.main === module) {
  const r = verificar();
  if (!r.ok) {
    imprimirFalla(r);
    process.exit(1);
  }
  console.log('[build-guard] Runtime de Python OK (' + DEPS.join(', ') + '). Se puede empaquetar.');
}
