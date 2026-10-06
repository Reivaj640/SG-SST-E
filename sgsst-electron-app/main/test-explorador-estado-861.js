'use strict';
// 📦861 · El explorador de archivos sabe: distinguir "carpeta vacía" de "no se pudo leer".
//
// Esto lo pidió la AUDITORÍA del 1.1.1. Tres cosas que el módulo hacía mal, y que
// están replicadas en los 15 exploradores (el 1.1.1 no es un caso: es el mismo
// archivo 15 veces, así que un bug se paga 15 veces):
//
//  1. Un error de carga dejaba la lista CONGELADA en skeleton para siempre. El
//     catch mostraba un toast de 5 s —que se iba— y nunca volvía a dibujar. Lo
//     que quedaba eran bloques grises mudos, sin error y sin reintentar.
//
//  2. `result.files || []` convertía CUALQUIER respuesta inesperada en "Carpeta
//     vacía". El usuario veía "No hay archivos en esta carpeta" y concluía que sus
//     archivos se habían perdido, cuando en realidad nunca se leyeron. **Un
//     sistema no puede dejar que "no pude leer" se vea igual que "no hay".**
//
//  3. El estado vacío decía "Arrastra archivos aquí", pero el único `drop` del
//     módulo estaba sobre las carpetas de la columna izquierda. El usuario
//     arrastraba donde le decían y no pasaba nada, en silencio.
//
// Este test corre contra los 15 archivos REALES, sin la app y sin Electron.
// Las dos funciones de decisión se EXTRAEN del archivo y se EJECUTAN, así que
// lo que se prueba es el comportamiento y no la redacción de un comentario.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const DIR = path.join(__dirname, '..');
const GIT = path.join(DIR, '..');
const RAIZ_MODULES = path.join(DIR, 'modules');

let n = 0;
const fallos = [];
const chk = (nombre, c, e) => { n++; if (!c) fallos.push(nombre + (e ? '  [' + e + ']' : '')); };

// ── Inventario de los exploradores (los que tienen _loadDocumentsForCurrent) ──
function Exploradores() {
  const out = [];
  const caminar = (dir, prof) => {
    if (prof > 4) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const f = path.join(dir, e.name);
      if (e.isDirectory()) caminar(f, prof + 1);
      else if (/-viewer\.js$/.test(e.name)) {
        const txt = fs.readFileSync(f, 'utf8');
        if (txt.indexOf('_loadDocumentsForCurrent') < 0) continue;
        const mod = e.name.replace('-viewer.js', '');
        const d = path.dirname(f);
        const cssP = path.join(d, mod + '-view.css');
        const htmlP = path.join(d, mod + '-view.html');
        const logicP = path.join(d, mod + '-logic.js');
        out.push({
          mod, js: txt, ruta: f, rutaCss: cssP,
          css: fs.existsSync(cssP) ? fs.readFileSync(cssP, 'utf8') : null,
          html: fs.existsSync(htmlP) ? fs.readFileSync(htmlP, 'utf8') : null,
          logic: fs.existsSync(logicP) ? fs.readFileSync(logicP, 'utf8') : null,
        });
      }
    }
  };
  caminar(RAIZ_MODULES, 0);
  return out.sort((a, b) => a.mod.localeCompare(b.mod));
}

// Extraer una función por llaves balanceadas. La indentación NO se usa: lo que
// decide el nivel es dónde cierra la llave.
function bloque(txt, nombre) {
  const i = txt.indexOf('function ' + nombre);
  if (i < 0) return null;
  let nivel = 0;
  for (let j = txt.indexOf('{', i); j < txt.length; j++) {
    if (txt[j] === '{') nivel++;
    else if (txt[j] === '}') { nivel--; if (nivel === 0) return txt.slice(i, j + 1); }
  }
  return null;
}
function soloCodigo(x) { return x.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' '); }
// Las anclas de varias líneas se escriben con \n, así que hay que normalizar
// ANTES de comparar o mutar: 13 de los 15 viewers están en CRLF y el ancla daría
// 0 apariciones —que es como se ve un ancla mal escrita, no un mutante que no
// muerde.
const aLF = (s) => s.replace(/\r\n/g, '\n');
function eolDe(s) {
  const c = (s.match(/\r\n/g) || []).length;
  const l = (s.match(/\n/g) || []).length;
  return c > 0 && c === l ? 'CRLF' : (c === 0 ? 'LF' : 'MIXTO');
}
const PERMITIDOS = [
  [0x0020, 0x007E], [0x00A1, 0x00FF], [0x2010, 0x2027], [0x2030, 0x203B],
  [0x2100, 0x214F], [0x2190, 0x21FF], [0x2200, 0x22FF], [0x23A0, 0x23FF],
  [0x2460, 0x24FF], [0x2500, 0x257F], [0x25A0, 0x26FF], [0x2700, 0x27FF],
  [0x2B00, 0x2BFF], [0x1F190, 0x1F2FF], [0x1F1E6, 0x1F1FF], [0x1F300, 0x1FAFF],
  [0x200B, 0x200F], [0xFE00, 0xFE0F],
];
function caracteresRaros(s) {
  const malos = [];
  for (const ch of s) {
    if (/\s/.test(ch)) continue;
    const cp = ch.codePointAt(0);
    if (!PERMITIDOS.some(([a, b]) => cp >= a && cp <= b)) malos.push(ch + ' U+' + cp.toString(16).toUpperCase());
  }
  return [...new Set(malos)];
}
function netas(s) { let a = 0, b = 0; for (const c of s) { if (c === '{') a++; if (c === '}') b++; } return a - b; }
// El EOL que tiene el archivo EN GIT, para no "corregir" uno que nunca fue CRLF.
function gitEol(ruta) {
  const rel = path.relative(GIT, ruta).replace(/\\/g, '/');
  try {
    const raw = execFileSync('git', ['show', 'HEAD:' + rel], { cwd: GIT, maxBuffer: 1 << 26 });
    return eolDe(raw.toString('utf8'));
  } catch (e) { return 'DESCONOCIDO'; }
}

const EXPS = Exploradores();
chk('se encontraron los exploradores a corregir', EXPS.length >= 15, 'solo ' + EXPS.length);
const MODULOS = EXPS.map((e) => e.mod);
chk('el 1.1.1 está entre ellos', MODULOS.indexOf('responsable-sg') >= 0, MODULOS.join(','));

// ══════════ 1) FIX 2 · la función pura que decide vacío contra error ══════════
// Se EXTRAE del archivo y se EJECUTA. No se reimplementa: una copia sería una
// segunda verdad, y las mutaciones de abajo no la tocarían.
const CASOS = [
  { nombre: 'una lista vacía de verdad', entrada: { files: [] }, ok: true, largo: 0 },
  { nombre: 'una lista con archivos', entrada: { files: [{ path: 'a.pdf' }] }, ok: true, largo: 1 },
  { nombre: 'la respuesta no trae files', entrada: {}, ok: false, largo: 0 },
  { nombre: 'la respuesta es null', entrada: null, ok: false, largo: 0 },
  { nombre: 'la respuesta es undefined', entrada: undefined, ok: false, largo: 0 },
  { nombre: 'files es texto, no una lista', entrada: { files: 'a.pdf' }, ok: false, largo: 0 },
  { nombre: 'files es un objeto suelto', entrada: { files: { 0: 'a' } }, ok: false, largo: 0 },
  { nombre: 'llegó un array directo en vez de la respuesta', entrada: [{ path: 'a.pdf' }], ok: false, largo: 0 },
];

for (const ex of EXPS) {
  const cod = soloCodigo(ex.js);
  const fn = bloque(cod, '_normalizarLista');
  chk('📦861 · ' + ex.mod + ' tiene la función pura que decide', fn !== null,
    'no existe _normalizarLista: sin ella no se puede distinguir vacío de error');
  if (!fn) continue;

  const F = new Function(fn + '\nreturn _normalizarLista;')();
  for (const c of CASOS) {
    let r = null, fallo = '';
    try { r = F(c.entrada); } catch (e) { fallo = 'lanzó ' + e.message; }
    const ok = !fallo && r && typeof r === 'object'
      && r.ok === c.ok && Array.isArray(r.files) && r.files.length === c.largo
      && typeof r.mensaje === 'string' && (c.ok ? r.mensaje === '' : r.mensaje.length > 0);
    chk(ex.mod + ' · ' + c.nombre, ok,
      fallo || 'ok=' + JSON.stringify(r && r.ok) + ' largo=' + (r && r.files ? r.files.length : '?')
        + ' mensaje=' + JSON.stringify(r && r.mensaje));
  }

  const rFail = F({});
  chk(ex.mod + ' · el error dice QUÉ se intentó leer',
    rFail.ok === false && /leer|carpeta/i.test(rFail.mensaje),
    'mensaje=' + JSON.stringify(rFail.mensaje));

  chk(ex.mod + ' · un fallo nunca se convierte en "carpeta vacía"',
    F({}).ok === false && F(null).ok === false && F({ files: 'x' }).ok === false,
    'si un fallo devuelve ok:true, la pantalla vuelve a mentir');
}

// ══════════ 2) FIX 1 · el catch dibuja el error, no lo entierra ══════════
for (const ex of EXPS) {
  const cod = soloCodigo(ex.js);
  const carga = bloque(cod, '_loadDocumentsForCurrent');
  chk(ex.mod + ' · se encuentra _loadDocumentsForCurrent', carga !== null);
  if (!carga) continue;

  const iCatch = carga.indexOf('.catch(function (error)');
  chk(ex.mod + ' · el catch existe', iCatch >= 0);
  if (iCatch < 0) continue;
  const cuerpoCatch = carga.slice(iCatch);

  chk('📦861 · ' + ex.mod + ' · el catch vuelve a dibujar la lista',
    /_renderDocuments\(\)/.test(cuerpoCatch) || /_htmlErrorLista\(\)/.test(cuerpoCatch),
    'el catch no dibuja nada: el skeleton queda congelado para siempre');
  chk(ex.mod + ' · el catch marca el estado como error',
    /listStatus\s*=\s*'error'/.test(cuerpoCatch),
    'sin marcar el estado, _renderDocuments no sabe qué dibujar');

  const cuerpoOk = carga.slice(0, iCatch);
  chk(ex.mod + ' · el camino feliz limpia el estado de error',
    /listStatus\s*=\s*'ready'/.test(cuerpoOk),
    'tras un reintento exitoso el mensaje de error puede quedar pegado');

  // Con la lista en error, el contador decía el número de la carga anterior:
  // "12 archivos" encima de "no se pudo leer". Es la incoherencia que se ve
  // en los primeros dos segundos, así que se vigila.
  const render = bloque(cod, '_renderDocuments');
  chk('📦861 · ' + ex.mod + ' · en error el contador no miente',
    render !== null && /listStatus === 'error'[\s\S]{0,220}?docCount\.textContent = '0'/.test(render),
    'el contador conserva el número anterior mientras la lista dice que no se pudo leer');
  chk(ex.mod + ' · el botón de reintentar queda enlazado de verdad',
    render !== null && /getElementById\('retryLoadBtn'\)[\s\S]{0,200}?addEventListener\('click'[\s\S]{0,120}?_loadDocumentsForCurrent/.test(render),
    'el botón existe en el HTML pero nadie lo escucha: sería decorativo');
}

// ══════════ 3) el HTML del error tiene que ofrecer salida ══════════
const _escPrueba = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
for (const ex of EXPS) {
  const cod = soloCodigo(ex.js);
  const fn = bloque(cod, '_htmlErrorLista');
  chk('📦861 · ' + ex.mod + ' · hay un render del error', fn !== null,
    'falta _htmlErrorLista: el estado de error no tendría qué mostrar');
  if (!fn) continue;

  const F = new Function('_esc', '_state', fn + '\nreturn _htmlErrorLista();')(
    _escPrueba, { listErrorDetail: '<img src=x>' });
  const html = typeof F === 'string' ? F : '';
  chk(ex.mod + ' · el error tiene un título que dice que no se pudo leer',
    /No se pudo leer/i.test(html), 'html=' + html.slice(0, 110));
  chk('📦861 · ' + ex.mod + ' · el error ofrece REINTENTAR',
    /Reintentar/.test(html) && /id="retryLoadBtn"/.test(html),
    'sin reintentar, el único camino es recargar la app a mano');
  chk(ex.mod + ' · el detalle técnico va escapado',
    !/<img src=x>/.test(html) && /&lt;img/.test(html),
    'un detalle crudo es una inyección de HTML esperando');
  chk(ex.mod + ' · el error NO dice "carpeta vacía"',
    !/Carpeta vac[ií]a/i.test(html),
    'si el error dice "vacía", el usuario sigue creyendo que perdió los archivos');
}

// ══════════ 4) FIX 3 · el arrastre funciona donde el texto lo promete ══════════
for (const ex of EXPS) {
  const cod = soloCodigo(ex.js);
  chk('📦861 · ' + ex.mod + ' · el panel central acepta archivos',
    /_setupMainDropTarget/.test(cod),
    'el único drop está sobre las carpetas de la izquierda, pero el texto pide arrastrar "aquí"');
  chk(ex.mod + ' · el arrastre central sube a la carpeta que se está viendo',
    /function _setupMainDropTarget[\s\S]*?currentFolderPath/.test(cod),
    'si sube a una ruta fija, deja los archivos en la carpeta equivocada');
  chk(ex.mod + ' · se enlaza desde el arranque, no desde un render',
    /_setupMainDropTarget\(\);/.test(cod),
    'si se enlaza al renderizar la lista, se pierde en cada cambio de carpeta');
  chk(ex.mod + ' · el texto del estado vacío sigue siendo cierto',
    /Arrastra archivos a[quí]/.test(cod),
    'el texto promete una interacción: si el fix cae, hay que cambiar el texto');
  chk(ex.mod + ' · el CSS da señal visual al arrastre central',
    ex.css !== null && /\.kair-main\.is-drag-over/.test(ex.css),
    'sin esto el arrastre central funciona pero es invisible');
  chk(ex.mod + ' · el botón de reintentar tiene estilo',
    ex.css !== null && /\.kair-empty__retry/.test(ex.css),
    'el botón existe en el HTML pero se ve como texto plano');
}

// ══════════ 5) 📦861-fix · EL BOTÓN "SUBIR" NO ES VERDE ══════════
// Lo pidió el owner mirando la app: "ese botón de color verde no va a lugar,
// desentona completamente". Y es la regla del sistema: en K+AIR el verde
// significa "cumplido / éxito" (los avisos de éxito), no "acción principal".
// Un botón verde de la acción principal compite con los avisos de éxito, que es
// donde el verde sí tiene que estar — y le da a la pantalla dos focos donde
// tiene que haber uno.
for (const ex of EXPS) {
  chk(ex.mod + ' · el botón Subir usa el azul de la acción principal',
    ex.html !== null && /class="kair-header__action kair-header__action--primary" id="uploadBtn"/.test(ex.html),
    'volvió a --success: el verde vuelve a competir con los avisos de éxito');
  chk(ex.mod + ' · el azul de la acción principal está definido en el CSS',
    ex.css !== null && /\.kair-header__action--primary \{/.test(ex.css),
    'el HTML pide --primary pero el CSS no lo define: el botón queda sin fondo');
  chk(ex.mod + ' · no queda el estilo verde muerto',
    ex.css === null || ex.css.indexOf('kair-header__action--success') < 0,
    'el CSS conserva la variante verde: es una trampa para el que la use después');
  chk(ex.mod + ' · la media query angosta sigue funcionando',
    ex.css === null || /\.kair-header__action--primary span \{/.test(ex.css),
    'la regla de 1280px seguía nombrando la variante verde: el botón angosto '
    + 'conserva el padding viejo y se ve descuadrado');
}

// ══════════ 5b) 📦861-fix2 · EL AZUL ES EL DE LA BARRA SUPERIOR ══════════
// El owner lo pidió mirando la app: el botón tiene que ser del mismo azul que el
// título del módulo en la cabecera (`--kair-blue: #2057b8` del shell), no del
// azul viejo del explorador (`#174ea6`). Y los `rgba()` del primario estaban
// escritos a mano con su descomposición RGB: si se cambia el token y no ellos,
// el focus ring y dos sombras se quedan del azul viejo y se nota al pasar el
// mouse por encima.
for (const ex of EXPS) {
  chk('📦861 · ' + ex.mod + ' usa el azul del shell',
    ex.css !== null && /--kair-primary:\s*#2057b8;/.test(ex.css),
    'el primario sigue en el azul viejo del explorador: el botón no conecta con la cabecera');
  chk(ex.mod + ' · no queda el rgba del azul viejo horneado',
    ex.css === null || !/rgba\(23,\s*78,\s*166/.test(ex.css),
    'el focus ring y las sombras se quedaron en el azul viejo aunque el token haya cambiado');
  chk(ex.mod + ' · los colores de estado NO se tocaron (la paleta completa sigue pendiente)',
    ex.css === null || gitValorCss(ex, /--kair-success:\s*(#[0-9a-fA-F]{3,8})/) === (ex.css.match(/--kair-success:\s*(#[0-9a-fA-F]{3,8})/) || [])[1],
    'la migración completa de paleta sigue en pausa: acá solo va el primario');
}

// El valor de un token tal como estaba EN GIT, para comparar contra el actual.
// Comparar contra un valor fijo daba falso: `remisiones` ya venía con la paleta
// del shell, así que su `--kair-success` nunca fue el de los demás.
function gitValorCss(ex, re) {
  try {
    const raw = require('child_process').execFileSync('git',
      ['show', 'HEAD:' + path.relative(GIT, ex.rutaCss).replace(/\\/g, '/')],
      { cwd: GIT, maxBuffer: 1 << 26 }).toString('utf8');
    const m = raw.match(re);
    return m ? m[1] : null;
  } catch (e) { return 'SIN-GIT'; }
}

// ══════════ 6) 📦861 · EL PDF USA EL MISMO VISOR QUE WORD Y EXCEL ══════════
// El owner lo vio en la app: el PDF se abría con el visor NATIVO del navegador
// (la barra oscura con "1/2" y "96%") mientras Word y Excel usaban el visor de
// K+AIR. Dos herramientas para la misma tarea, y la pantalla se ve distinta
// según el formato.
//
// La causa estaba escrita en el código: `logic.js` excluía el PDF a propósito
// con `fileExt !== 'pdf'`.
//
// ALCANCE REAL: el inventario mostrou que los 15 NO comparten la arquitectura
// del preview — `_loadPDF` tiene 4 variantes y los `logic.js` enrutan el PDF de
// 3 formas distintas (switch, mapa de acciones, if), y 3 módulos ni siquiera
// tienen logic.js. Por eso esto se verifica SOLO en el 1.1.1, que es el módulo
// de referencia y el que el owner está mirando. Los otros 14 quedan fuera hasta
// que él confirme que funciona acá.
const REF1 = EXPS.find((e) => e.mod === 'responsable-sg');
chk('📦861 · el 1.1.1 está en el inventario para verificar el PDF', REF1 !== undefined);
if (REF1) {
  const cod1 = soloCodigo(aLF(REF1.js));
  const logic1 = REF1.logic ? soloCodigo(aLF(REF1.logic)) : '';

  const carga = bloque(cod1, '_loadPDF');
  chk('el PDF se carga por el canal del visor unificado',
    carga !== null && /get-pdf-for-viewer/.test(carga),
    'volvió a pedir get-pdf-preview: el PDF se abre otra vez con el visor nativo');
  chk('el PDF pasa por el MISMO manejador que Excel y Word',
    carga !== null && /_handlePreviewResult\(result, 'PDF'\)/.test(carga),
    'cada formato por su cuenta: el PDF no usa el visor de K+AIR');
  chk('si el PDF llega como base64, el respaldo sigue funcionando',
    cod1.indexOf("return { ok: true, files:") >= 0 || /_displayPDF\(result\.data\)/.test(cod1),
    'sin respaldo, un padre viejo deja el PDF sin vista');

  chk('el logic enruta el PDF hacia el visor de K+AIR',
    /__fileViewerBytes/.test(logic1) && /fileExt\s*&&\s*fileExt\s*!==\s*'pdf'/.test(logic1) === false,
    'el PDF sigue excluido de la ruta del visor: es la causa original');
  chk('el canal bandera no se puede llamar por error',
    /apiFunctionName === '__fileViewerBytes'[\s\S]{0,300}?return;/.test(logic1),
    'sin la guarda, el canal inexistente revienta con un TypeError en vez de avisar');
  chk('el canal del visor está declarado en el switch',
    /case 'get-pdf-for-viewer':/.test(logic1),
    'el viewer pide un canal que el switch no conoce: no llega respuesta');
  chk('get-pdf-preview sigue existiendo (lo usa la impresión)',
    /case 'get-pdf-preview':/.test(logic1),
    'si se quita, la impresión se queda sin pedir nada');

  // Imprimir: antes metía un OBJETO dentro de un data URI de PDF, abría un
  // diálogo EN BLANCO y registraba "PRINT_DOC SUCCESS".
  const impr = bloque(cod1, '_printConvertedDocument');
  chk('imprimir no intenta imprimir un objeto como si fuera un PDF',
    impr !== null && /typeof result\.data !== 'string'/.test(impr),
    'vuelve a concatenar el objeto en el data URI: imprime en blanco sin avisar');
  chk('imprimir dice la verdad cuando el formato no se puede imprimir',
    impr !== null && /apiType !== 'get-pdf-preview'/.test(impr),
    'el navegador no sabe imprimir un .docx: tiene que decirlo, no imprimir en blanco');
}

// ══════════ 7) EOL, caracteres y balance de los archivos tocados ══════════
for (const ex of EXPS) {
  const jsEol = eolDe(ex.js);
  const enGit = gitEol(ex.ruta);
  chk(ex.mod + '-viewer.js conserva el EOL que tiene en git', jsEol === enGit,
    'ahora ' + jsEol + ', en git ' + enGit + (jsEol === 'MIXTO' ? '  <-- MIXTO: una edición metió LF en un CRLF' : ''));
  chk(ex.mod + '-viewer.js sin caracteres fuera del español', caracteresRaros(ex.js).length === 0,
    caracteresRaros(ex.js).slice(0, 4).join(', '));
  if (ex.css) {
    chk(ex.mod + '-view.css balancea llaves', netas(ex.css) === 0, 'netas=' + netas(ex.css));
    chk(ex.mod + '-view.css sin caracteres fuera del español', caracteresRaros(ex.css).length === 0,
      caracteresRaros(ex.css).slice(0, 4).join(', '));
  }
}

// ══════════ 6) MUTACION ══════════
// POLARIDAD: la mutación ROMPE la forma buena y el check la EXIGE presente, así
// que se marca cuando la buena DEJÓ de estar.
const REF = EXPS.find((e) => e.mod === 'responsable-sg') || EXPS[0];
const codRef = soloCodigo(aLF(REF.js));
const MUTANTES = [
  {
    nombre: 'la normalización vuelve a convertir cualquier fallo en lista vacía',
    de: 'if (!result || !Array.isArray(result.files)) {',
    a: 'if (false) {',
    detectar: (m) => !/if \(!result \|\| !Array\.isArray\(result\.files\)\)/.test(m),
  },
  {
    nombre: 'el error se dibuja como si la carpeta estuviera vacía',
    de: 'kair-empty--error',
    a: 'kair-empty--vacia',
    detectar: (m) => !/kair-empty--error/.test(m),
  },
  {
    nombre: 'el botón de reintentar desaparece',
    de: 'id="retryLoadBtn"',
    a: 'id="retryLoadBtnX"',
    detectar: (m) => !/id="retryLoadBtn"/.test(m),
  },
  {
    // El ancla lleva la línea siguiente: `_state.listStatus = 'error';` sola
    // aparece DOS veces (en la rama de payload raro y en el catch), y `replace`
    // cambiaría solo la primera, dejando el catch sin vigilar.
    nombre: 'el catch deja de marcar el estado de error',
    de: "            _state.listStatus = 'error';\n"
      + "            _state.listErrorDetail = (error && error.message) ? error.message : '';\n",
    a: "            _state.listStatus = 'ready';\n"
      + "            _state.listErrorDetail = (error && error.message) ? error.message : '';\n",
    detectar: (m) => !/_state\.listStatus = 'error';\s*\n\s*_state\.listErrorDetail = \(error/.test(m),
  },
  {
    nombre: 'el camino feliz no limpia el error (queda pegado tras un reintento)',
    de: "_state.listStatus = 'ready';",
    a: '',
    detectar: (m) => !/_state\.listStatus = 'ready';/.test(m),
  },
  {
    nombre: 'el panel central deja de aceptar el arrastre',
    de: 'function _setupMainDropTarget() {',
    a: 'function _setupMainDesactivado() {',
    detectar: (m) => !/function _setupMainDropTarget\(/.test(m),
  },
  {
    nombre: 'el arrastre central sube a una ruta fija en vez de la carpeta actual',
    de: "folder: _state.currentFolderPath, zona: 'panel-central'",
    a: "folder: _state.basePath, zona: 'panel-central'",
    detectar: (m) => !/folder: _state\.currentFolderPath, zona: 'panel-central'/.test(m),
  },
  {
    // `_htmlErrorLista` a secas sale 2 veces (la definición y el uso). El ancla
    // apunta al USO: si ese se rompe, el estado de error se queda sin pintar.
    nombre: 'el estado de error deja de pintarse en la lista',
    de: 'fileList.innerHTML = _htmlErrorLista();',
    a: 'fileList.innerHTML = "";',
    detectar: (m) => !/fileList\.innerHTML = _htmlErrorLista\(\);/.test(m),
  },
  {
    // El botón "Subir" vuelve a verde: es lo que el owner vio en la app con una
    // captura. El verde en la acción principal compite con los avisos de éxito,
    // que es donde el verde sí tiene que estar.
    nombre: 'el botón Subir vuelve a ser verde',
    fuente: 'html',
    de: 'kair-header__action--primary',
    a: 'kair-header__action--success',
    detectar: (m) => !/kair-header__action--primary/.test(m),
  },
];
let vacios = 0, mordieron = 0;
const noMordieron = [];
for (const mu of MUTANTES) {
  // La mutación puede ir contra el JS o contra el HTML. Antes esto estaba fijo
  // al JS, y una mutación de HTML habría mutateado el archivo equivocado: el
  // "botón verde" ni siquiera estaría en el texto que se revisa.
  const base = mu.fuente === 'html' ? aLF(REF.html || '') : codRef;
  if (!mu.fuente && REF.html === undefined) { /* el JS siempre está */ }
  if (mu.fuente === 'html' && !REF.html) {
    noMordieron.push(mu.nombre + '  [NO HAY HTML PARA MUTAR]');
    continue;
  }
  const veces = base.split(mu.de).length - 1;
  if (veces !== 1) { noMordieron.push(mu.nombre + '  [ANCLA APARECE ' + veces + ' VECES]'); continue; }
  const mutado = base.replace(mu.de, mu.a);
  if (mutado === base) { vacios++; noMordieron.push(mu.nombre + '  [MUTANTE VACÍO]'); continue; }
  if (mu.detectar(mutado)) mordieron++; else noMordieron.push(mu.nombre);
}
chk('ningún mutante quedó vacío', vacios === 0, vacios + ' vacíos');
chk('📦861 · todas las mutaciones fueron cazadas', noMordieron.length === 0,
  noMordieron.length + ' no mordieron: ' + noMordieron.slice(0, 3).join(' | '));

if (fallos.length) {
  console.log('\n✗ ' + fallos.length + ' check(s) fallaron de ' + n + '\n');
  fallos.slice(0, 40).forEach((f) => console.log('  FAIL  ' + f));
  if (fallos.length > 40) console.log('  … y ' + (fallos.length - 40) + ' más');
  console.log('\n  exploradores: ' + EXPS.length + '   mutaciones: ' + mordieron + '/' + MUTANTES.length + ' mordieron, ' + vacios + ' vacías');
  process.exit(1);
}
console.log('\n' + n + '/' + n + ' checks OK  ·  ' + EXPS.length + ' exploradores');
console.log('  mutaciones: ' + mordieron + '/' + MUTANTES.length + ' mordieron, ' + vacios + ' vacías');
