'use strict';
// 📦882 · Los cuatro textos legales se leen DENTRO de la app, no solo por un link.
//
// El gate de 📦873 mostraba un RESUMEN y dos links a la web. Eso no cumple el
// art. 8 de la Ley 1581: la autorizacion tiene que ser informada, y para eso el
// titular tiene que poder LEER lo que acepta. Ademas la app se usa sin internet
// con frecuencia, y los links externos apuntan a gh-pages, donde 881 todavia no
// publico los dos documentos nuevos.
//
// Este test fija las CINCO cosas que sostienen eso, y sobre todo la primera, que
// es la unica que evita un problema legal serio:
//
//  1) `sgsst-electron-app/legal/*.html` es COPIA BYTE A BYTE de `sitio/*.html`.
//     Si alguien edita el texto legal en el sitio y no copia, la app mostraria
//     una version del contrato que no es la publicada. Este check compara el
//     CONTENIDO de los dos lados y se cae si difieren.
//
//  2) El HTML trae el contenedor de documentos y las casillas NACEN ocultas.
//
//  3) El CSS tiene `.kair-consent__checks[hidden] { display: none !important }`.
//     Sin esa regla el atributo `hidden` pierde contra el `display: flex` de las
//     casillas y las dos autorizaciones se ven desde el segundo cero: el
//     "leer antes de marcar" seria decorativo.
//
//  4) El preload expone el canal y el main lo resuelve con LISTA BLANCA, nunca
//     con una ruta que mande el renderer.
//
//  5) El texto se hashea DESPUES de montarlo, asi que `texto_hash` prueba lo que
//     el usuario pudo leer de verdad y no un resumen de veinte lineas.
//
// Y el fail-open, que es lo que impide que esto sea una puerta cerrada: si los
// documentos no se pueden cargar, las casillas aparecen igual. Un archivo que no
// se leyó no puede dejar al usuario sin poder trabajar, y tampoco sin poder
// rechazar.
const fs = require('fs');
const path = require('path');

const APP = path.join(__dirname, '..');
const RAIZ = path.join(APP, '..');
const LEGAL = path.join(APP, 'legal');

const ARCHIVOS = ['privacidad', 'terminos', 'anexo-encargo', 'autorizacion-trabajadores'];

function leer(p) { return fs.readFileSync(p, 'utf8'); }

// Comentarios fuera: un guard que matchea su propio comentario no guarda nada.
// El `//` solo se corta cuando NO va precedido de `:`, para no romper `https://`.
//
// 🔴 AVISO, y ya mordió una vez. Este helper borra bloques `/* ... */`. Si un
// comentario de línea del código contiene la SECUENCIA `/*` —un glob tipo
// `**\/*`, por ejemplo— el borrador cree que ahí empieza un bloque y se come
// todo el código hasta el siguiente `*/`, y los guards empiezan a fallar por
// un motivo que no es el que están mirando. Por eso los comentarios del código
// de este paquete no llevan globs con esa secuencia.
function soloCodigo(t) {
  return t
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

// Rangos de escritura CJK, cirilica y hangul, por ESCAPE: el archivo de test no
// puede contener ni una letra prohibida, ni siquiera para buscarlas. Los
// sustitutos altos quedan fuera a proposito, para que los emoji (📦 en los
// comentarios del repo) no salten como falso positivo.
const EXOTICO = new RegExp('[\\u2E80-\\u9FFF\\uAC00-\\uD7AF\\uF900-\\uFAFF\\uFF00-\\uFFEF\\u0400-\\u04FF\\u1100-\\u11FF\\u3130-\\u318F\\uA960-\\uA97F\\uD7B0-\\uD7FF]');

function fuentes() {
  const legal = {}, sitio = {};
  for (const n of ARCHIVOS) {
    legal[n] = leer(path.join(LEGAL, n + '.html'));
    sitio[n] = leer(path.join(RAIZ, 'sitio', n + '.html'));
  }
  return {
    htm: leer(path.join(APP, 'index.html')),
    css: leer(path.join(APP, 'styles.css')),
    js: leer(path.join(APP, 'renderer.js')),
    pre: leer(path.join(APP, 'preload.js')),
    mn: leer(path.join(APP, 'main.js')),
    legal,
    sitio
  };
}

const fallidos = [];
const registro = [];

// ── evaluar ─────────────────────────────────────────────────────────────────
// Devuelve {n, f} sobre una foto de los SIETE insumos. Todo pasa por aca, para
// que las mutaciones actuen sobre la MISMA funcion y no sobre una copia pegada.
function evaluar(F) {
  const c = { n: 0, f: 0 };
  const chk = (cond, nombre, detalle) => {
    c.n++;
    // Cada invariante se REGISTRA, las que pasan y las que fallan. Registrar
    // solo las que fallan haria que un runner contara 5 checks donde hay 35, que
    // es el mismo defecto de conteo que PROMPT.md §7.4 ya marco una vez.
    registro.push({ n: nombre, c: !!cond });
    if (!cond) { c.f++; fallidos.push(nombre + (detalle ? ' :: ' + detalle : '')); }
  };

  const htm = soloCodigo(F.htm), css = soloCodigo(F.css);
  const js = soloCodigo(F.js), pre = soloCodigo(F.pre), mn = soloCodigo(F.mn);

  // 1 · La copia verificada: lo que evita dos textos legales distintos.
  for (const n of ARCHIVOS) {
    const a = F.legal[n], b = F.sitio[n];
    chk(!!a && a === b, 'legal/' + n + '.html es identico a sitio/' + n + '.html',
      'legal=' + (a ? a.length : 'FALTA') + 'b, sitio=' + (b ? b.length : 'FALTA'));
  }

  // 2 · Markup del gate
  chk(/data-consent-documentos/.test(htm), 'el gate tiene contenedor para los documentos');
  chk(/class="kair-consent__checks"[^>]*\bhidden\b/.test(htm),
    'las casillas nacen ocultas en el HTML');
  chk(/data-consent-progress/.test(htm), 'el gate trae la barra de avance de lectura');

  // Los links externos NO se quitan: son el acceso al documento en el sitio, con
  // su propia URL, y siguen siendo validos si la app se instala sin la carpeta.
  chk(/reivaj640\.github\.io\/SG-SST-E\/privacidad\.html/.test(F.htm), 'se conserva el link a privacidad');
  chk(/reivaj640\.github\.io\/SG-SST-E\/terminos\.html/.test(F.htm), 'se conserva el link a terminos');

  // 3 · El hidden tiene que ganarle al display:flex
  chk(/\.kair-consent__checks\[hidden\]\s*\{[^}]*display\s*:\s*none\s*!important/.test(css),
    'el CSS fuerza display:none en las casillas ocultas');
  chk(/\.kair-consent__reader-title/.test(css) && /\.kair-consent__progress-fill/.test(css),
    'el lector tiene estilos propios');

  // 4 · El canal
  chk(/consentDocumento:\s*\(nombre\)\s*=>\s*ipcRenderer\.invoke\('consent:documento',\s*nombre\)/.test(pre),
    'el preload expone consentDocumento');
  chk(/ipcMain\.handle\('consent:documento'/.test(mn), 'el main responde consent:documento');
  chk(/path\.relative\(dirLegal,\s*ruta\)/.test(mn), 'el main verifica que la ruta no salga de legal/');
  chk(/LEGAL_DOCUMENTOS_PERMITIDOS\[String\(nombre/.test(mn),
    'el main resuelve por lista blanca, no por la ruta que mande el renderer');
  // El renderer no debe construir rutas: si lo hiciera, la lista blanca se
  // esquivaria por el otro lado.
  chk(!/legal\//.test(js), 'el renderer NO arma rutas de archivo, pide documentos por nombre');

  // La lista del backend y la de la UI tienen que ser LAS MISMAS: si la UI pide
  // uno que el backend no tiene, el usuario ve un hueco y no se entera.
  const wl = /LEGAL_DOCUMENTOS_PERMITIDOS\s*=\s*Object\.freeze\(\{([\s\S]*?)\}\)/.exec(mn);
  const ui = /const CONSENT_DOCUMENTOS = \[([\s\S]*?)\n\];/.exec(js);
  const nomWl = wl ? (wl[1].match(/'([^']+)'\s*:/g) || []).map(s => s.replace(/[':\s]/g, '')).sort() : [];
  const nomUi = ui ? (ui[1].match(/nombre:\s*'([^']+)'/g) || []).map(s => s.replace(/.*'([^']+)'.*/, '$1')).sort() : [];
  chk(nomWl.length === 4 && nomUi.length === 4, 'backend y UI listan 4 documentos',
    'wl=' + nomWl.length + ' ui=' + nomUi.length);
  chk(nomWl.join(',') === nomUi.join(','), 'backend y UI listan los MISMOS documentos',
    nomWl.join(',') + ' vs ' + nomUi.join(','));

  // 5 · El montaje
  chk(/_consentConstruirSeccion/.test(js), 'existe el recorte del documento');
  chk(/await _consentCargarDocumentosLegales/.test(js), 'el gate espera a que se carguen');
  chk(/querySelectorAll\('\.enlaces'\)/.test(js), 'se quita la navegacion del sitio por CLASE, no por etiqueta');
  chk(/'#doc-'/.test(js), 'los links entre documentos se vuelven saltos internos');
  chk(/adoptNode/.test(js), 'el contenido parseado se mueve al documento real');

  // 5b · El ORDEN importa: si se hashea antes de montar, `texto_hash` queda
  // siendo la prueba de un resumen y no de lo que el usuario leyo.
  const iCarga = js.indexOf('await _consentCargarDocumentosLegales');
  const iHash = js.indexOf('const textoLegal');
  chk(iCarga > 0 && iHash > iCarga, 'el texto se hashea DESPUES de montar los documentos',
    'carga=' + iCarga + ' hash=' + iHash);

  // El avance de lectura
  chk(/addEventListener\('scroll',\s*alDesplazar/.test(js), 'el scroll del modal mueve el avance');
  chk(/marcarLecturaCompleta/.test(js), 'existe el hito de "lectura completa"');

  // 6 · FAIL-OPEN: sin documentos, las casillas salen igual.
  chk(/cargaDocs\.cargados\s*===\s*0/.test(js), 'si no carga nada, se revela igual (fail-open)');
  chk(/checksBox\.hidden\s*=\s*false/.test(js), 'revelar las casillas es parte del flujo');

  // El boton de RECHAZAR nunca se bloquea por la lectura: rechazar tiene que
  // estar disponible siempre, o esto seria una pantalla sin salida.
  const iBoton = js.indexOf('function actualizarBotonAceptar');
  const cuerpoBoton = iBoton >= 0 ? js.slice(iBoton, iBoton + 220) : '';
  chk(iBoton >= 0 && !/btnRechazar/.test(cuerpoBoton),
    'la lectura NO deshabilita el boton de rechazar');

  // 7 · Cache-bust: los dos tokens tienen que haber subido del 20261007 que dejo
  // 881. Un token viejo significa que el cliente sigue viendo el CSS viejo.
  chk(/styles\.css\?v=2026\d{4}-[a-z0-9-]+/.test(F.htm), 'styles.css lleva token de cache-bust');
  chk(!/styles\.css\?v=20261007-/.test(F.htm), 'el token de styles.css NO es el de 879');
  chk(!/renderer\.js\?v=20261007-/.test(F.htm), 'el token de renderer.js NO es el de 879');

  // 8 · Ni una letra fuera del alfabeto latino. Se cuela por las rutas.
  chk(!EXOTICO.test(F.js), 'renderer.js sin CJK, cirilico ni hangul');
  chk(!EXOTICO.test(F.css), 'styles.css sin CJK, cirilico ni hangul');
  chk(!EXOTICO.test(F.legal.privacidad), 'legal/privacidad.html sin CJK');

  return c;
}

// ── Checks ──────────────────────────────────────────────────────────────────
const checks = [];

// El EOL va FUERA de evaluar(): es una propiedad de los bytes del archivo, no una
// invariante del codigo. Adentro se normaliza a LF para mutar, y ahi un check de
// EOL detectaria mutaciones por el motivo equivocado.
const rj = leer(path.join(APP, 'renderer.js'));
checks.push({ n: 'renderer.js conserva su EOL CRLF', c: /\r\n/.test(rj) && !/[^\r]\n/.test(rj), e: '' });
const cssBytes = leer(path.join(APP, 'styles.css'));
checks.push({ n: 'styles.css conserva su EOL LF', c: !/\r\n/.test(cssBytes), e: '' });

const F0 = fuentes();
const base = evaluar(F0);
// Los 35 checks del codigo, no solo los que fallaron.
for (const r of registro) checks.push({ n: r.n, c: r.c, e: '' });

// ── Mutaciones ──────────────────────────────────────────────────────────────
// Cada una tiene que voltear AL MENOS un check. Un mutante que no cambia el
// archivo se cuenta aparte y falla: es una mutacion mal escrita, no un check flojo.
function clonar(o) { return JSON.parse(JSON.stringify(o)); }

const MUT = [
  ['las casillas se ven desde el principio (se quita el hidden del HTML)',
    f => { f.htm = f.htm.replace('data-consent-checks hidden', 'data-consent-checks'); }],
  ['el CSS deja que el hidden pierda contra el display:flex',
    f => { f.css = f.css.replace('.kair-consent__checks[hidden]', '.kair-consent__checks'); }],
  ['la copia de un documento se desincroniza del sitio',
    f => { f.legal['privacidad'] = f.legal['privacidad'].replace('Ley 1581', 'Ley 9999'); }],
  ['se borra el documento de autorizacion de trabajadores de la copia',
    f => { f.legal['autorizacion-trabajadores'] = ''; }],
  ['el main acepta cualquier ruta en vez de la lista blanca',
    f => { f.mn = f.mn.replace(/LEGAL_DOCUMENTOS_PERMITIDOS\[String\(nombre[\s\S]*?trim\(\)\]/, 'String(nombre)'); }],
  ['el main deja de verificar que la ruta no salga de legal/',
    f => { f.mn = f.mn.replace(/path\.relative\(dirLegal,\s*ruta\)/, 'true'); }],
  ['el preload deja de exponer el canal',
    f => { f.pre = f.pre.replace(/consentDocumento:\s*\(nombre\)\s*=>\s*ipcRenderer\.invoke\('consent:documento',\s*nombre\)/, 'consentDocumentoVacio: () => null'); }],
  ['el renderer se arma su propia ruta en vez de pedir el documento',
    f => { f.js = f.js + '\nconst rutaLegalManual = "legal/privacidad.html";\n'; }],
  ['la UI pide un documento que el backend no tiene',
    f => { f.js = f.js.replace("nombre: 'autorizacion-trabajadores'", "nombre: 'autorizaciones'"); }],
  ['deja de quitarse la barra de navegacion del sitio',
    f => { f.js = f.js.replace("querySelectorAll('.enlaces')", "querySelectorAll('ul.enlaces')"); }],
  ['los links entre documentos se dejan como enlaces al sitio',
    f => { f.js = f.js.replace("'#doc-'", 'hrefOriginal'); }],
  ['el texto se hashea ANTES de montar los documentos',
    f => {
      const decl = "  const textoLegal = cuerpo ? (cuerpo.innerText || '').trim() : '';";
      f.js = f.js.replace(decl, '').replace('  overlay.hidden = false;', '  overlay.hidden = false;\n' + decl);
    }],
  ['sin documentos cargados el gate deja al usuario sin poder marcar',
    f => { f.js = f.js.replace('cargaDocs.cargados === 0', 'cargaDocs.cargados === -1'); }],
  ['el scroll deja de mover el avance de lectura',
    f => { f.js = f.js.replace("addEventListener('scroll', alDesplazar", "addEventListener('wheel', alDesplazar"); }],
  ['el leer-desde-el-fin bloquea tambien el boton de rechazar',
    f => { f.js = f.js.replace('if (btnAceptar) btnAceptar.disabled = !lecturaCompleta || enviando;', 'if (btnAceptar) btnAceptar.disabled = !lecturaCompleta || enviando; if (btnRechazar) btnRechazar.disabled = !lecturaCompleta;'); }],
  ['styles.css vuelve al token de cache-bust de 879',
    f => { f.htm = f.htm.replace(/styles\.css\?v=[^"]+/, 'styles.css?v=20261007-header879'); }],
  ['renderer.js vuelve al token de cache-bust de 879',
    f => { f.htm = f.htm.replace(/renderer\.js\?v=[^"]+/, 'renderer.js?v=20261007-iframe879'); }],
  ['se cuela una letra CJK en el codigo (no en un comentario)',
    f => { f.js = f.js.replace('let enviando = false;', 'let ' + String.fromCharCode(0x53D8) + ' = false;'); }]
];

let mutDetectados = 0, mutVacios = 0;
MUT.forEach(m => {
  const nombre = m[0];
  const f = clonar(F0);
  try { m[1](f); } catch (e) { console.log('FAIL MUTANTE LANZO ' + nombre + ': ' + e.message); mutVacios++; return; }

  const antes = JSON.stringify([f.htm, f.css, f.js, f.pre, f.mn, f.legal]);
  const ref = JSON.stringify([F0.htm, F0.css, F0.js, F0.pre, F0.mn, F0.legal]);
  if (antes === ref) { mutVacios++; console.log('FAIL MUTANTE VACIO ' + nombre); return; }

  fallidos.length = 0;
  const r = evaluar(f);
  if (r.f > 0) mutDetectados++;
  else console.log('FAIL MUTANTE NO DETECTADO ' + nombre);
});

// ── Fase funcional (jsdom): se EJECUTA el recorte de verdad ─────────────────
// Los guards de arriba leen el codigo. Esta fase lo corre contra los cuatro
// documentos reales, que es donde se puede ver lo que un regex no ve: que
// `autorizacion-trabajadores.html` trae su navegacion como `<nav class="enlaces">`
// y no como `<ul>`, asi que un selector `ul.enlaces` la dejaba viva dentro del
// gate, con su link a `index.html`. Ese fallo existio y lo cayo esto, no un check.
let JSDOM = null;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { JSDOM = null; }
checks.push({ n: 'jsdom disponible para la fase funcional', c: !!JSDOM, e: '' });

if (JSDOM) {
  const vm = require('vm');
  const cuerpoF = function construirSrc(js) {
    // renderer.js es CRLF y el cierre de la función se busca como `\n}\n`:
    // sin normalizar a LF el corte nunca aparece y la fase funcional se queda
    // sin nada que ejecutar. (PROMPT.md §5.4: el EOL lo fija el archivo.)
    const lf = js.replace(/\r\n/g, '\n');
    const ini = lf.indexOf('function _consentConstruirSeccion');
    if (ini < 0) return '';
    const fin = lf.indexOf('\n}\n', ini);
    return fin < 0 ? '' : lf.slice(ini, fin + 3);
  };

  function ejecutar(F, js) {
    const src = cuerpoF(js);
    if (!src) return null;
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    const ctx = {
      document: dom.window.document,
      DOMParser: dom.window.DOMParser,
      console,
      CONSENT_BASE_SITIO: 'https://reivaj640.github.io/SG-SST-E/',
      CONSENT_DOCUMENTOS: [
        { nombre: 'terminos', archivo: 'terminos.html' },
        { nombre: 'privacidad', archivo: 'privacidad.html' },
        { nombre: 'anexo-encargo', archivo: 'anexo-encargo.html' },
        { nombre: 'autorizacion-trabajadores', archivo: 'autorizacion-trabajadores.html' }
      ]
    };
    vm.createContext(ctx);
    vm.runInContext(src, ctx);
    return ctx;
  }

  // Base: los cuatro documentos se montan limpios.
  const ctxOK = ejecutar(F0, F0.js);
  checks.push({
    n: 'FUNCIONAL: _consentConstruirSeccion se puede ejecutar',
    c: !!ctxOK && typeof ctxOK._consentConstruirSeccion === 'function',
    e: ''
  });

  if (ctxOK) {
    for (const nombre of ARCHIVOS) {
      const doc = { nombre, titulo: 'T', archivo: nombre + '.html' };
      let sec = null, err = '';
      try { sec = ctxOK._consentConstruirSeccion(doc, F0.legal[nombre]); }
      catch (e) { err = e.message; }
      checks.push({ n: 'FUNCIONAL: ' + nombre + ' se monta sin error', c: !!sec, e: err });
      if (!sec) continue;

      const html = sec.innerHTML;
      checks.push({
        n: 'FUNCIONAL: ' + nombre + ' no deja la navegacion del sitio (ni ul ni nav)',
        c: !/class="enlaces"/.test(html),
        e: 'quedo la barra del sitio'
      });
      checks.push({
        // Cero links RELATIVOS a .html: dentro de la app esos archivos no existen.
        // Los legales son #doc-* (salto interno) y los demas van al sitio con https.
        n: 'FUNCIONAL: ' + nombre + ' no deja ningun link relativo a un archivo',
        c: !/href="(?!https?:|mailto:|#)[^"]*\.html"/.test(html),
        e: (html.match(/href="[^"]*\.html"/g) || []).join(' ')
      });
      checks.push({
        n: 'FUNCIONAL: ' + nombre + ' manda Soporte al sitio y no a un archivo local',
        c: !/href="soporte\.html"/.test(html),
        e: ''
      });
      checks.push({
        n: 'FUNCIONAL: ' + nombre + ' trae contenido real, no un esqueleto vacio',
        c: sec.textContent.replace(/\s+/g, ' ').trim().length > 1200,
        e: 'largo=' + sec.textContent.trim().length
      });
      checks.push({
        n: 'FUNCIONAL: ' + nombre + ' conserva el encabezado de seccion',
        c: !!sec.querySelector('.kair-legal-doc__head h3') && sec.id === 'doc-' + nombre,
        e: 'id=' + sec.id
      });
      checks.push({
        n: 'FUNCIONAL: ' + nombre + ' no arrastra <script> ni manejadores',
        c: !/<script/i.test(html) && !/\son[a-z]+=/i.test(html),
        e: ''
      });
    }

    // Mutacion sobre la FUNCION: si el recorte vuelve a `ul.enlaces`, el documento
    // de autorizacion de trabajadores tiene que dejar de estar limpio.
    const jsMuto = F0.js.replace("querySelectorAll('.enlaces')", "querySelectorAll('ul.enlaces')");
    const ctxMuto = ejecutar(F0, jsMuto);
    if (ctxMuto) {
      const sec = ctxMuto._consentConstruirSeccion(
        { nombre: 'autorizacion-trabajadores', titulo: 'T', archivo: 'autorizacion-trabajadores.html' },
        F0.legal['autorizacion-trabajadores']
      );
      const sucio = !!sec && /class="enlaces"/.test(sec.innerHTML);
      checks.push({
        n: 'FUNCIONAL: el recorte mutado a ul.enlaces DEJA pasar la barra (prueba de que el check muerde)',
        c: sucio,
        e: ''
      });
    } else {
      checks.push({ n: 'FUNCIONAL: el recorte mutado a ul.enlaces DEJA pasar la barra (prueba de que el check muerde)', c: false, e: 'no se pudo ejecutar la version mutada' });
    }
  }
}
checks.push({ n: 'mutaciones: ' + mutDetectados + '/' + MUT.length + ' detectadas', c: mutDetectados === MUT.length, e: '' });
checks.push({ n: 'mutaciones vacias: ' + mutVacios, c: mutVacios === 0, e: '' });
checks.push({ n: 'checks base: ' + (base.n - base.f) + '/' + base.n, c: base.f === 0, e: '' });

const bad = checks.filter(c => !c.c);
checks.forEach(c => { if (!c.c) console.log('FAIL ' + c.n); });
console.log((checks.length - bad.length) + '/' + checks.length + ' OK');
process.exit(bad.length === 0 ? 0 : 1);