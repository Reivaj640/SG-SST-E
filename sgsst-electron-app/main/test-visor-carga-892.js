/**
 * 📦892 · Test del contrato de carga de documentos en el visualizador de 1.1.1.
 *
 * ── EL BUG ───────────────────────────────────────────────────────────────────
 * El padre rutea el preview del PDF por un canal virtual, `__fileViewerBytes`,
 * que NO es una función de `window.electronAPI`: existe solo como bandera para
 * llegar al bloque que lee bytes crudos con `readFileBytes`.
 *
 * Pero `handleStandardRequest` validaba, PRIMERO, que `apiFunctionName` fuera una
 * función real del preload:
 *
 *     if (!window.electronAPI || typeof window.electronAPI[apiFunctionName] !== 'function')
 *         throw new Error(`API function ${apiFunctionName} not found`);
 *
 * El canal virtual no la es, así que la guarda lo mataba antes de que el ruteo
 * llegara a ejecutarse. Consecuencias, las dos:
 *   1) el preview de PDF fallaba siempre con "API function __fileViewerBytes not
 *      found", que es literalmente el error reportado;
 *   2) unas 40 líneas de ruteo quedaron como código muerto.
 *
 * Peor: el bloque de abajo que responde "Ruteo del visor de archivos roto" ERA
 * la red de seguridad para cuando faltara `readFileBytes`, pero tampoco se
 * podía alcanzar. Los dos mecanismos se contradecían, y el test 861 comprobaba
 * el de abajo sin notar el de arriba.
 *
 * ── EL SEGUNDO BUG ───────────────────────────────────────────────────────────
 * Al seleccionar un documento, `_showLoading()` solo encendía el overlay: no
 * limpiaba `#viewerContainer`. El error de una carga anterior quedaba pintado
 * debajo. Se seleccionaba un DOCX y el panel seguía mostrando el fallo del PDF
 * abierto antes, que es indistinguible de un fallo real del DOCX.
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const LOGIC = 'modules/recursos/responsable-sg/responsable-sg-logic.js';
const VIEWER = 'modules/recursos/responsable-sg/responsable-sg-viewer.js';
const PRELOAD = 'preload.js';

let checks = 0;
const fallas = [];
function ok(nombre, cond, detalle) {
  checks++;
  if (!cond) fallas.push(nombre + (detalle ? ' :: ' + detalle : ''));
}

function cargar(ruta, sobre) {
  return (sobre && sobre.hasOwnProperty(ruta)) ? sobre[ruta] : fs.readFileSync(path.join(RAIZ, ruta), 'utf8');
}
function sinComentarios(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
}
function cuerpoFuncion(src, nombre) {
  // Aísla el cuerpo de una función para poder afirmar sobre SU interior sin que
  // un assert de otra función satisfaga el check por accidente.
  //
  // Admite las dos formas: `function f()` suelta y `f()` metodo de clase, que
  // es como esta `handleStandardRequest`. Con solo la primera el extractor
  // devolvia cadena vacia y los checks preguntaban sobre nada.
  const re = new RegExp('(?:function\\s+)?' + nombre + '\\s*\\([^)]*\\)\\s*\\{');
  const m = re.exec(src);
  if (!m) return '';
  const i = m.index;
  const ini = src.indexOf('{', i);
  let depth = 0, fin = -1;
  for (let k = ini; k < src.length; k++) {
    if (src[k] === '{') depth++;
    else if (src[k] === '}') { depth--; if (depth === 0) { fin = k; break; } }
  }
  return ini < 0 || fin < 0 ? '' : src.slice(ini, fin);
}

function correr(sobre) {
  const logic = cargar(LOGIC, sobre);
  const viewer = cargar(VIEWER, sobre);
  const preload = cargar(PRELOAD, sobre);
  const logicCodigo = sinComentarios(logic);
  const viewerCodigo = sinComentarios(viewer);

  // ═══ A · El canal virtual llega vivo al ruteo ══════════════════════════════
  const handler = cuerpoFuncion(logicCodigo, 'handleStandardRequest');

  ok('A1 la guarda de existencia sigue existiendo',
    /window\.electronAPI\[apiFunctionName\]/.test(handler),
    'sin guarda, un nombre desconocido reventaria con TypeError en vez de avisar');
  ok('A2 la guarda EXCLUYE los canales virtuales',
    /CANALES_VIRTUALES[\s\S]{0,220}?__fileViewerBytes/.test(logicCodigo),
    'el canal tiene que estar listado o la guarda lo vuelve a matar');
  ok('A3 la guarda consulta esa excepcion, no lo ignora',
    /if \(!esCanalVirtual &&[\s\S]{0,160}?window\.electronAPI\[apiFunctionName\]/.test(handler),
    'existe la constante pero la guarda no la usa: el bug vuelve');
  ok('A4 el canal virtual se sigue rutendo a readFileBytes',
    /isOfficeRequest[\s\S]{0,300}?__fileViewerBytes[\s\S]{0,300}?readFileBytes/.test(handler));
  ok('A5 sigue habiendo red de seguridad si falta readFileBytes',
    /Ruteo del visor de archivos roto/.test(handler),
    'sin esto, un preload viejo deja el preview sin vista y sin aviso');

  // La red de seguridad tiene que ser alcanzable: si el throw ocurre antes, no
  // sirve de nada. Este es el check que faltaba en el 861.
  const posGuarda = handler.indexOf('if (!esCanalVirtual');
  const posRuteo = handler.indexOf('if (isOfficeRequest');
  const posRed = handler.indexOf('Ruteo del visor de archivos roto');
  ok('A6 la red de seguridad es alcanzable (esta despues de la guarda)',
    posGuarda >= 0 && posRuteo > posGuarda && posRed > posRuteo,
    'guarda en ' + posGuarda + ', ruteo en ' + posRuteo + ', red en ' + posRed);

  // ═══ B · El canal no existe en el preload (si existiera, todo el arriba sobra)
  ok('B1 el preload NO expone __fileViewerBytes como funcion',
    !/__fileViewerBytes\s*:/.test(preload),
    'si el preload lo expusiera, la guarda original no habria roto');
  ok('B2 el preload SI expone readFileBytes', /readFileBytes\s*:/.test(preload));
  ok('B3 el padre declara el caso que manda al canal virtual',
    /case 'get-pdf-for-viewer':[\s\S]{0,200}?__fileViewerBytes/.test(logicCodigo));

  // ═══ C · El panel no conserva el error del documento anterior ══════════════
  const select = cuerpoFuncion(viewerCodigo, '_selectDocument');
  ok('C1 _selectDocument limpia el panel antes de pedir',
    /_clearPreviewPanel\(\)/.test(select),
    'sin esto el error de una carga anterior queda pintado debajo del overlay');
  ok('C2 _clearPreviewPanel existe', /function _clearPreviewPanel\(/.test(viewerCodigo));

  const limpiar = cuerpoFuncion(viewerCodigo, '_clearPreviewPanel');
  ok('C3 limpia el contenedor del visor', /viewerContainer\.innerHTML\s*=\s*''/.test(limpiar));
  ok('C4 desmonta el viewer anterior',
    /currentFileViewerMount[\s\S]{0,200}?unmount/.test(limpiar),
    'si no se desmonta, dos instancias del visor se quedan montadas a la vez');
  ok('C5 borra el iframe PDF viejo', /getElementById\('docFrame'\)/.test(limpiar));
  ok('C6 rescata el empty state antes de vaciar',
    /emptyState[\s\S]{0,300}?appendChild\(emptyState\)/.test(limpiar),
    'el empty state vive dentro del contenedor: al vaciarlo se pierde para siempre');
  ok('C7 pone currentFileBytes en null',
    /currentFileBytes\s*=\s*null/.test(limpiar),
    'si no, "Ver completo" puede abrir los bytes del documento anterior');

  // ═══ D · El error dice QUE fallo ═══════════════════════════════════════════
  ok('D1 existe el mensaje que nombra el documento', /function _errorDeCarga\(/.test(viewerCodigo));
  const err = cuerpoFuncion(viewerCodigo, '_errorDeCarga');
  ok('D2 usa el nombre del documento actual', /currentDocument[\s\S]{0,200}?\.name/.test(err));
  ok('D3 incluye la extension', /\.extension/.test(err));
  ok('D4 escapa lo que imprime', (err.match(/_esc\(/g) || []).length >= 3,
    'un nombre de archivo con < o & rompe el HTML del error');

  // Los tres catchOldos deben usar el mensaje nuevo: uno que no lo use sigue
  // diciendo "Error al cargar PDF" sin decir de que archivo.
  const sinsuelo = viewerCodigo.match(/_showErrorInViewer\('Error al cargar (PDF|Excel|Word)[^']*'\s*\+/g) || [];
  ok('D5 ningun catch dice "Error al cargar X" a secas', sinsuelo.length === 0, sinsuelo.join(' | '));
  // Con punto y coma al final, asi la DEFINICION `function _errorDeCarga(error)`
  // no cuenta como uso. Sin eso salia 4 en vez de 3.
  const usos = (viewerCodigo.match(/_errorDeCarga\(error\);/g) || []).length;
  ok('D6 los tres tipos de documento usan el mensaje nuevo', usos === 3, usos + ' de 3');

  // ═══ E · EOL y alfabetos ═══════════════════════════════════════════════════
  const BAD = /[\u0400-\u04FF\u4E00-\u9FFF\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/;
  for (const [clave, ruta] of [['logic', LOGIC], ['viewer', VIEWER]]) {
    const buf = (sobre && sobre.hasOwnProperty(ruta)) ? Buffer.from(sobre[ruta], 'utf8') : fs.readFileSync(path.join(RAIZ, ruta));
    const s = buf.toString('utf8');
    const crlf = (s.match(/\r\n/g) || []).length;
    const lf = (s.match(/(?<!\r)\n/g) || []).length;
    ok('E ' + clave + ' es CRLF puro', crlf > 0 && lf === 0, crlf + ' CRLF / ' + lf + ' LF');
    const m = s.match(BAD);
    ok('E ' + clave + ' sin cirílico/CJK/hangul', !m, m ? 'encontrado: ' + m[0] : '');
  }
}

function mutaciones() {
  const base = {};
  for (const r of [LOGIC, VIEWER, PRELOAD]) base[r] = fs.readFileSync(path.join(RAIZ, r), 'utf8');

  const M = [
    ['A2 saca el canal virtual de la lista',
      LOGIC, s => s.replace("const CANALES_VIRTUALES = ['__fileViewerBytes'];", "const CANALES_VIRTUALES = [];")],
    ['A3 deja la constante sin usarla',
      LOGIC, s => s.replace('if (!esCanalVirtual && (!window.electronAPI', 'if ((!window.electronAPI')],
    ['A4 saca el canal virtual del ruteo',
      LOGIC, s => s.replace("|| apiFunctionName === '__fileViewerBytes')", ")")],
    ['A5 borra la red de seguridad',
      LOGIC, s => s.replace("error: 'Ruteo del visor de archivos roto'", "error: 'x'")],
    ['A6 mueve la red antes de la guarda',
      LOGIC, s => s.replace('const esCanalVirtual = CANALES_VIRTUALES.indexOf(apiFunctionName) !== -1;',
        "const esCanalVirtual = true; const _red = 'Ruteo del visor de archivos roto';")],
    ['B1 el preload empieza a exponer el canal',
      PRELOAD, s => s.replace('readFileBytes: (filePath)', '__fileViewerBytes: (filePath) => 1, readFileBytes: (filePath)')],
    ['C1 _selectDocument deja de limpiar el panel',
      VIEWER, s => s.replace('        _clearPreviewPanel();\r\n', '')],
    ['C3 deja de vaciar el contenedor',
      VIEWER, s => s.replace("if (viewerContainer) viewerContainer.innerHTML = '';", '')],
    ['C4 deja de desmontar el viewer anterior',
      VIEWER, s => s.replace(/if \(_state\.currentFileViewerMount[\s\S]{0,260}?catch \(_\) \{\}/, 'if (false) { }')],
    ['C6 no rescata el empty state',
      VIEWER, s => s.replace('viewerContainer.appendChild(emptyState);', '')],
    ['C7 deja los bytes viejos',
      VIEWER, s => s.replace('_state.currentFileBytes = null;', '')],
    ['D2 el error deja de nombrar el documento',
      VIEWER, s => s.replace("var nombre = doc.name || '(desconocido)';", "var nombre = 'x';")],
    ['D4 el error deja de escapar el texto',
      VIEWER, s => s.replace('_esc(nombre)', 'nombre')],
    ['D5 vuelve el mensaje viejo',
      VIEWER, s => s.replace('_errorDeCarga(error);', "_showErrorInViewer('Error al cargar PDF: ' + error.message);")],
    ['E normaliza el logic a LF',
      LOGIC, s => s.replace(/\r\n/g, '\n')],
    ['E mete un CJK en el viewer',
      VIEWER, s => s.replace('function _errorDeCarga(', '/* 责 */\n    function _errorDeCarga(')]
  ];

  console.log('\n── MUTACIONES ───────────────────────────────────────────────');
  let muertas = 0; const vacias = [];
  for (const [nombre, clave, fn] of M) {
    const antes = fallas.length;
    const copia = Object.assign({}, base);
    const out = fn(copia[clave]);
    if (out === copia[clave]) { vacias.push(nombre + ' (no cambio el archivo)'); continue; }
    copia[clave] = out;
    try { correr(copia); } catch (e) { vacias.push(nombre + ' (lanzo: ' + e.message + ')'); continue; }
    const nuevas = fallas.slice(antes);
    if (nuevas.length === 0) vacias.push(nombre + ' (mutante vacio)');
    else { muertas++; console.log('  ok  ' + nombre.padEnd(44) + ' -> ' + nuevas.length + ' check(s)'); }
  }
  return { total: M.length, muertas, vacias };
}

correr(null);
const checksBase = checks;
const fallasBase = fallas.slice();
console.log('── CHECKS BASE ──────────────────────────────────────────────');
if (fallasBase.length === 0) console.log('  ' + checksBase + ' checks OK, 0 fallas');
else {
  console.log('  ' + (checksBase - fallasBase.length) + ' OK, ' + fallasBase.length + ' FALLAS:');
  for (const f of fallasBase) console.log('    FALLA  ' + f);
}

const m = mutaciones();
console.log('\n── RESUMEN ───────────────────────────────────────────────────');
console.log('  ' + m.total + ' mutaciones, ' + m.muertas + ' muerden');
if (m.vacias.length) { console.log('  MUTANTES VACIOS:'); for (const v of m.vacias) console.log('    ' + v); }
const okTotal = fallasBase.length === 0 && m.vacias.length === 0;
console.log(okTotal ? '\n  TODO OK' : '\n  HAY FALLAS');
process.exit(okTotal ? 0 : 1);