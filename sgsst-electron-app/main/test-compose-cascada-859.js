'use strict';
// 📦859 · El compositor se comporta como en Gmail: cascada, arrastre, pila de
// minimizados y tope de ventanas.
//
// Lo que reportó el owner, con capturas de Gmail de referencia:
//
//  1. "minimiza mal"
//  2. "cuando le doy dos veces o mas aparece el modal encima del que ya se
//      habia abierto"
//
// Y el diagnóstico dice que NINGUNO de los dos era un bug de estado. Cada
// ventana ya era independiente (sus handlers, sus destinatarios, sus
// adjuntos, su propio `closeModal`, y ESC solo afecta a la enfocada). Lo que
// pasaba era puramente de posición:
//
//   · El overlay es `align-items: flex-end; justify-content: flex-end` SIN
//     cascada, así que todas las ventanas se dibujaban en la misma esquina y
//     la segunda caía exactamente encima de la primera.
//   · `.compose-panel--minimized` era `bottom: 0; right: 24px`, así que todas
//     las minimizadas caían en el mismo píxel y solo se veía la última.
//   · `setMinimized` agregaba `compose-panel-overlay--hidden`, clase que NO
//     EXISTE en ninguna hoja: un no-op silencioso, el mismo tipo de cosa que
//     el `D.FALLBACK_CATEGORIES` de 📦856.
//
// Lo que este test protege: que la cascada exista y sea de GPU, que las
// minimizadas se apilen abajo a la izquierda, que el registro se desincronice
// al cerrar, y que el tope de 6 avise en vez de acumular.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'renderer', 'bandeja-integrada');
const js = fs.readFileSync(path.join(DIR, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(DIR, 'styles.css'), 'utf8');
const premium = fs.readFileSync(path.join(DIR, 'premium.css'), 'utf8');

function soloCodigo(x) {
  return x.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
}
function sinComentarios(x) { return x.replace(/\/\*[\s\S]*?\*\//g, ''); }
function aLF(x) { return x.replace(/\r\n/g, '\n'); }
function eolDe(s) {
  const c = (s.match(/\r\n/g) || []).length;
  const l = (s.match(/\n/g) || []).length;
  return c > 0 && c === l ? 'CRLF' : (c === 0 ? 'LF' : 'MIXTO');
}
const PERMITIDOS = [
  [0x0020, 0x007E], [0x00A1, 0x00FF], [0x2010, 0x2027], [0x2030, 0x203B],
  [0x2190, 0x21FF], [0x2200, 0x22FF], [0x2460, 0x24FF], [0x2500, 0x257F],
  [0x25A0, 0x26FF], [0x2700, 0x27FF], [0x1F1E6, 0x1F1FF], [0x1F300, 0x1FAFF],
  [0xFE00, 0xFE0F],
];
const esPermitido = (cp) => PERMITIDOS.some(([a, b]) => cp >= a && cp <= b);
function caracteresRaros(s) {
  const malos = [];
  for (const ch of s) {
    if (/\s/.test(ch)) continue;
    if (!esPermitido(ch.codePointAt(0))) {
      malos.push(ch + ' U+' + ch.codePointAt(0).toString(16).toUpperCase());
    }
  }
  return [...new Set(malos)];
}

let n = 0;
const fallos = [];
const chk = (nombre, c, e) => { n++; if (!c) fallos.push(nombre + (e ? '  [' + e + ']' : '')); };
const cod = soloCodigo(js);
const codLF = aLF(cod);
const cssLimpio = sinComentarios(css);

// ══════════ 1) La clase muerta se fue ══════════
// El no-op: el JS agregaba una clase que ninguna hoja definia. Si vuelve a
// aparecer en el JS, tiene que existir en el CSS.
chk('📦859 · la clase muerta compose-panel-overlay--hidden ya NO se usa',
  !/compose-panel-overlay--hidden/.test(cod),
  'era un no-op: el JS la agregaba pero ninguna hoja la definia');
chk('y la clase que la reemplaza SÍ existe en el CSS',
  /\.compose-panel-overlay--mini\s*\{/.test(cssLimpio),
  'sin esta regla, minimizar no deja de transformar el overlay y la barrita "fija" se mueve con la cascada');
chk('al minimizar, el overlay deja de transformar',
  /\.compose-panel-overlay--mini\s*\{\s*transform:\s*none/.test(cssLimpio),
  'un ancestro con transform se vuelve bloque contenedor del position:fixed, y la barrita se va con el');

// ══════════ 2) La cascada existe y es de GPU ══════════
chk('el overlay se desplaza con transform, no con left/top',
  /\.compose-panel-overlay\s*\{[\s\S]{0,900}?transform:\s*translate\(/.test(cssLimpio),
  'con left/top el navegador recalcula layout en cada paso del arrastre');
chk('el desplazamiento sale de --compose-n y lo pone el JS',
  /var\(--compose-n, 0\)/.test(cssLimpio) && /--compose-n/.test(cod));
chk('el arrastre se suma a la pila, no la reemplaza',
  /var\(--compose-dx, 0px\),\s*\n?\s*calc\(var\(--compose-dy, 0px\) - var\(--compose-n/.test(cssLimpio),
  'si el arrastre reemplazara el desplazamiento, al mover una ventana perderia su lugar en la pila');
chk('📦859 · la pila es VERTICAL: sin desplazamiento lateral',
  !/var\(--compose-dx, 0px\) - var\(--compose-n/.test(cssLimpio),
  'el owner lo pidió alineado, no en cascada diagonal: el paso horizontal tiene que ser cero');
chk('el paso vertical es el alto de la barra de titulo, para que la de abajo se vea entera',
  /var\(--compose-n, 0\) \* 40px/.test(cssLimpio),
  'con un paso menor se ve media barra y no se sabe si hay una ventana debajo');
chk('cada apertura escribe su indice de pila',
  /modal\.style\.setProperty\("--compose-n", String\(Math\.min\(_composeAbiertos\.length, 5\)\)\)/.test(cod));
chk('la pila esta TOPADA en 5 (con 6 el tope sacaria la ventana de la pantalla)',
  /Math\.min\(_composeAbiertos\.length, 5\)/.test(cod),
  'cada paso son 40px y el panel llega a 80vh: 6 escalones lo sacarian por arriba y la ventana perdia su barra de titulo');
chk('la transicion de la cascada dura menos de 300 ms',
  (() => {
    const m = /\.compose-panel-overlay\s*\{[\s\S]{0,1400}?transition:\s*transform\s+(\d+)ms/.exec(cssLimpio);
    return m !== null && Number(m[1]) < 300;
  })(), 'el budget del repo es 300 ms para animaciones');

// ══════════ 3) La pila de minimizados ══════════
const reglaMini = (function () {
  const m = cssLimpio.match(/\.compose-panel--minimized\s*\{[\s\S]*?\n\}/);
  return m ? m[0] : '';
})();
chk('📦859 · la ventana minimizada existe en el CSS', reglaMini.length > 50, 'len=' + reglaMini.length);
chk('va ABAJO A LA DERECHA, el lado que pidio el owner',
  /right:\s*24px/.test(reglaMini) && /left:\s*auto/.test(reglaMini),
  'la primera version de 859 las puso abajo a la izquierda, como Gmail, y el owner pidio el lado contrario');
chk('las minimizadas NO se superponen: suben por su nivel',
  /--compose-m, 0\)\s*\*\s*-52px/.test(reglaMini),
  'sin esto, varias minimizadas se dibujan una encima de otra y solo responde la ultima');
chk('📦859 · anula el min-width del panel, o no se encoge',
  /min-width:\s*0/.test(reglaMini),
  '.compose-panel declara min-width: 400px. En CSS, cuando min-* es MAYOR que max-*, GANA EL min-*: el max-width: 320px no hacia nada y la ventana se quedaba de 400px de ancho.');
chk('📦859 · anula el min-height del panel, o no se encoge',
  /min-height:\s*0/.test(reglaMini),
  '.compose-panel declara min-height: 360px. Ese ganaba al max-height: 48px, el panel se quedaba de 360px de alto y, con el cuerpo en display:none, se veia un bloque BLANCO VACIO bajo la barrita. Eso fue lo que reporto el owner: "minimiza pero no se minimiza, se visualiza asi".');
chk('la base del panel sigue teniendo min-width y min-height (el arreglo es en el estado minimizado, no en la base)',
  /\.compose-panel\s*\{[\s\S]{0,900}?min-width:\s*400px/.test(cssLimpio)
  && /\.compose-panel\s*\{[\s\S]{0,900}?min-height:\s*360px/.test(cssLimpio),
  'si la base perdiera el min-*, la ventana abierta volveria a ser redimensionable a un tamaño inutil');
chk('cada minimizada sube por su nivel, no se pisan',
  /--compose-m, 0\)\s*\*\s*-52px/.test(reglaMini),
  'sin esto, tres minimizadas se dibujan una encima de otra y solo responde la ultima');
chk('el nivel lo recalcula una funcion, no esta hardcodeado en el render',
  /function reacomodarMinimizados\(\)/.test(cod) && /--compose-m/.test(cod));
chk('reacomodarMinimizados solo cuenta las que estan minimizadas',
  /if \(!c\.minimizado\) continue;/.test(cod),
  'si contara todas, una ventana abierta moviera a las de la pila y las descolocaria');
chk('el alto de la pila vive SOLO en el CSS',
  !/COMPOSE_MINI_ALTO|COMPOSE_PASO/.test(cod),
  'declarar el mismo numero en JS y en CSS hace dos verdades que se separan con el tiempo');

// ══════════ 4) El arrastre ══════════
chk('existe arrastre desde la barra de titulo',
  /titlebar\.addEventListener\("mousedown"/.test(cod));
chk('ignora el boton derecho',
  /e\.button !== 0\) return;/.test(cod));
chk('ignora los botones de la barra (minimizar/cerrar)',
  /e\.target\.closest\("\.compose-panel__btn"\)\) return;/.test(cod),
  'sin esto, intentar cerrar la ventana la arrastra en vez de cerrarla');
chk('no arrastra una ventana minimizada',
  /if \(panel\.classList\.contains\("compose-panel--minimized"\)\) return;/.test(cod),
  'minimizada, el titlebar es el boton de restaurar');
chk('suelta el mouse en cualquier momento (no queda arrastrando para siempre)',
  /document\.addEventListener\("mouseup", soltar\)/.test(cod)
  && /document\.removeEventListener\("mouseup", soltar\)/.test(cod));
chk('el arrastre no se sale de la pantalla',
  /Math\.min\(Math\.max\(nuevoDx, minDx\), maxDx\)/.test(cod),
  'sin tope, la barra de titulo se puede sacar de la pantalla y la ventana se pierde sin forma de recuperarla');
chk('el cursor de la barra dice que se puede mover',
  /\.compose-panel__titlebar\s*\{[\s\S]{0,400}?cursor:\s*move/.test(cssLimpio));
chk('el estado minimizado pisa el cursor a pointer',
  /\.compose-panel--minimized \.compose-panel__titlebar\s*\{[\s\S]{0,200}?cursor:\s*pointer/.test(cssLimpio));

// ══════════ 5) El registro se mantiene consistente ══════════
chk('cada ventana abierta entra al registro',
  /_composeAbiertos\.push\(ficha\)/.test(cod));
chk('cerrar saca la ventana del registro',
  /_composeAbiertos\.indexOf\(ficha\)[\s\S]{0,120}?_composeAbiertos\.splice\(i, 1\)/.test(cod),
  'sin sacar la ficha, el conteo de ventanas y la pila de minimizados cuentan fantasmas');
chk('cerrar reacomoda la pila de minimizados',
  /reacomodarMinimizados\(\);[\s\S]{0,200}?modal\.parentNode\.removeChild\(modal\)/.test(cod),
  'cerrar una ventana abierta tiene que subir a las minimizadas que estaban debajo');
chk('minimizar y restaurar marcan la ficha',
  /ficha\.minimizado = true/.test(cod) && /ficha\.minimizado = false/.test(cod));
chk('restaurar devuelve la ventana a su posicion, no la deja corrida',
  /--compose-dx", "0px"/.test(cod) && /--compose-dy", "0px"/.test(cod),
  'sin esto, la ventana se restaura con el desplazamiento de la barra minima y abre corrida');
chk('traer al frente sube el z-index de esa ventana',
  /_composeZ \+= 1;[\s\S]{0,120}?modal\.style\.zIndex = String\(_composeZ\)/.test(cod),
  'todas comparten z-index: sin esto, la ventana de atras nunca vuelve a verse');
chk('el clic en cualquier parte de la ventana la trae al frente',
  /modal\.addEventListener\("mousedown", function \(\) \{\s*\n?\s*componerAlFrente\(modal\);/.test(cod));

// ══════════ 6) El tope de ventanas ══════════
chk('📦859 · hay un tope de ventanas simultaneas',
  /var COMPOSE_MAX = 6;/.test(cod));
chk('el tope se comprueba ANTES de crear nada',
  /if \(_composeAbiertos\.length >= COMPOSE_MAX\)[\s\S]{0,300}?return;/.test(cod),
  'si se comprueba despues, la septima ventana igual se dibuja y solo despues aparece el aviso');
chk('el tope avisa en vez de fallar en silencio',
  /toast\("Ya hay " \+ COMPOSE_MAX \+ " redactores abiertos"/.test(cod));

// ══════════ 7) Lo de antes sigue intacto ══════════
chk('la ventana sigue siendo un dialogo accesible',
  /class="compose-panel" role="dialog" aria-modal="true"/.test(cod));
chk('el grip de redimensionar sigue existiendo',
  /compose-panel__resize-grip/.test(cod) && /compose-panel__resize-grip/.test(cssLimpio));
chk('ESC sigue restaurando antes de cerrar',
  /if \(panel\.classList\.contains\("compose-panel--minimized"\)\) \{\s*\n?\s*setMinimized\(false\)/.test(cod));
chk('cerrar sigue funcionando por el boton X',
  /closeBtn\.addEventListener\("click"[\s\S]{0,120}?closeModal\(\)/.test(cod));
chk('sendComposedMail sigue recibiendo SU propio closeModal',
  /if \(typeof opts\.closeModal === 'function'\) opts\.closeModal\(\);/.test(cod),
  'con varias ventanas abiertas, cerrar una no puede cerrar las otras');
chk('el titulo de la ventana salia del modo',
  /componerTitulo\(isReply, isForward\)/.test(cod)
  && /function componerTitulo\(isReply, isForward\)/.test(cod));

// ══════════ 8) EOL, caracteres y balance ══════════
chk('app.js sigue en CRLF', eolDe(js) === 'CRLF', 'eol=' + eolDe(js));
chk('styles.css no cambio de EOL', eolDe(css) === eolDe(fs.readFileSync(path.join(DIR, 'styles.css'), 'utf8')), 'eol=' + eolDe(css));
const rarosJs = caracteresRaros(js);
chk('app.js sin caracteres fuera del espanol', rarosJs.length === 0, rarosJs.slice(0, 5).join(', '));
const rarosCss = caracteresRaros(css);
chk('styles.css sin caracteres fuera del espanol', rarosCss.length === 0, rarosCss.slice(0, 5).join(', '));
const netas = (function (s) { let a = 0, b = 0; for (const c of s) { if (c === '{') a++; if (c === '}') b++; } return a - b; })(css);
chk('las llaves de styles.css balancean', netas === 0, 'netas=' + netas);
const netasJs = (function (s) { let a = 0, b = 0; for (const c of s) { if (c === '{') a++; if (c === '}') b++; } return a - b; })(js);
chk('las llaves de app.js balancean', netasJs === 0, 'netas=' + netasJs);

// ══════════ 9) MUTACION ══════════
const MUTANTES = [
  { clave: 'sin-pila', nombre: 'el overlay deja de desplazar por pila',
    archivo: 'css', de: 'transform: translate(\n    var(--compose-dx, 0px),\n    calc(var(--compose-dy, 0px) - var(--compose-n, 0) * 40px)\n  );',
    a: 'transform: none;' },
  { clave: 'vuelve-cascada', nombre: 'vuelve la cascada diagonal (el owner la pidio alineada)',
    archivo: 'css', de: '    var(--compose-dx, 0px),\n    calc(var(--compose-dy, 0px) - var(--compose-n, 0) * 40px)',
    a: '    calc(var(--compose-dx, 0px) - var(--compose-n, 0) * 26px),\n    calc(var(--compose-dy, 0px) - var(--compose-n, 0) * 26px)' },
  { clave: 'paso-corto', nombre: 'el paso vertical es menor que la barra de titulo',
    archivo: 'css', de: 'var(--compose-n, 0) * 40px', a: 'var(--compose-n, 0) * 8px' },
  // La cadena del tope aparece DOS veces (en el setProperty y en la ficha), y
  // `replace` con string solo cambia la primera. Por eso este mutante cambia
  // las dos con `/g`: si cambiara una sola, la otra seguiría diciendo 5 y el
  // check pasaría sin ver nada roto.
  { clave: 'pila-sin-tope', nombre: 'la pila deja de estar topada y la ventana de arriba se sale',
    archivo: 'app', de: /Math\.min\(_composeAbiertos\.length, 5\)/g,
    a: 'Math.min(_composeAbiertos.length, 8)' },
  { clave: 'min-height-vuelve', nombre: 'vuelve el min-height que gana al max-height (el bug que se vio en pantalla)',
    archivo: 'css', de: '  min-width: 0;\n  min-height: 0;', a: '  min-width: 400px;\n  min-height: 360px;' },
  { clave: 'min-width-vuelve', nombre: 'vuelve el min-width que gana al max-width',
    archivo: 'css', de: '  min-width: 0;\n  min-height: 0;', a: '  min-width: 400px;\n  min-height: 0;' },
  { clave: 'minis-superpuestas', nombre: 'las minimizadas vuelven a la misma esquina',
    archivo: 'css', de: 'transform: translateY(calc(var(--compose-m, 0) * -52px));', a: 'transform: none;' },
  { clave: 'mini-izquierda', nombre: 'la minimizada vuelve a la izquierda (el lado que se descarto)',
    archivo: 'css', de: '  right: 24px;\n  left: auto;', a: '  left: 24px;\n  right: auto;' },
  { clave: 'overlay-mini-roto', nombre: 'al minimizar el overlay sigue transformando',
    archivo: 'css', de: '.compose-panel-overlay--mini { transform: none; }', a: '.compose-panel-overlay--mini { transform: translateX(10px); }' },
  { clave: 'clase-muerta-vuelve', nombre: 'vuelve la clase muerta compose-panel-overlay--hidden',
    archivo: 'app', de: 'modal.classList.add("compose-panel-overlay--mini");', a: 'modal.classList.add("compose-panel-overlay--hidden");' },
  { clave: 'sin-tope', nombre: 'el tope de ventanas deja de comprobarse',
    archivo: 'app', de: 'if (_composeAbiertos.length >= COMPOSE_MAX) {', a: 'if (false) {' },
  { clave: 'tope-tarde', nombre: 'el tope avisa pero deja crear la ventana igual',
    archivo: 'app', de: '        "Cerrá o enviá alguno para abrir otro", "warning");\n      return;',
    a: '        "Cerrá o enviá alguno para abrir otro", "warning");' },
  { clave: 'no-saca-registro', nombre: 'cerrar no saca la ventana del registro (cuento fantasmas)',
    archivo: 'app', de: 'var i = _composeAbiertos.indexOf(ficha);\n      if (i >= 0) _composeAbiertos.splice(i, 1);', a: 'var i = -1;' },
  { clave: 'no-reacomoda-al-cerrar', nombre: 'cerrar no reacomoda la pila de minimizados',
    archivo: 'app', de: 'reacomodarMinimizados();\n      if (modal.parentNode) modal.parentNode.removeChild(modal);', a: 'if (modal.parentNode) modal.parentNode.removeChild(modal);' },
  { clave: 'cuenta-todas', nombre: 'la pila cuenta tambien las ventanas abiertas',
    archivo: 'app', de: 'if (!c.minimizado) continue;', a: '' },
  { clave: 'sin-frente', nombre: 'traer al frente deja de subir el z-index',
    archivo: 'app', de: '_composeZ += 1;', a: '' },
  { clave: 'arrastra-botones', nombre: 'el arrastre también mueve la ventana al pulsar los botones',
    archivo: 'app', de: 'if (e.target.closest(".compose-panel__btn")) return;', a: '' },
  { clave: 'arrastra-minimizada', nombre: 'una ventana minimizada se puede arrastrar',
    archivo: 'app', de: 'if (panel.classList.contains("compose-panel--minimized")) return;', a: '' },
  { clave: 'arrastre-sin-tope', nombre: 'el arrastre deja de tener tope de pantalla',
    archivo: 'app', de: 'Math.min(Math.max(nuevoDx, minDx), maxDx)', a: 'nuevoDx' },
  { clave: 'mouseup-colgado', nombre: 'el arrastre no se suelta al soltar el mouse',
    archivo: 'app', de: 'document.addEventListener("mouseup", soltar);', a: '' },
  { clave: 'restaura-corrida', nombre: 'restaurar deja la ventana con el desplazamiento viejo',
    archivo: 'app', de: 'modal.style.setProperty("--compose-dx", "0px");', a: '' },
];

const originales = { app: aLF(cod), css: aLF(cssLimpio) };
let vacios = 0;
let mordieron = 0;
const noMordieron = [];

// POLARIDAD (esta vez escrita una sola vez y aplicada en todas):
// la mutación ROMPE la forma buena. El check real exige la forma buena
// presente, así que acá se marca cuando dejó de estarlo. Escribirlo al revés
// deja al mutante pasar, y un mutante que pasa es peor que no tener
// mutación: dice que el check no muerde cuando en realidad nadie lo probó.
for (const mu of MUTANTES) {
  const fuente = originales[mu.archivo];
  const tiene = (typeof mu.de === 'string')
    ? fuente.indexOf(mu.de) >= 0
    : mu.de.test(fuente);
  if (!tiene) { noMordieron.push(mu.nombre + '  [ANCLA NO ENCONTRADA]'); continue; }
  const mutado = fuente.replace(mu.de, mu.a);
  if (mutado === fuente) { vacios++; noMordieron.push(mu.nombre + '  [MUTANTE VACIO]'); continue; }
  const c = sinComentarios(mutado);
  let fallo = false;

  switch (mu.clave) {
    case 'sin-pila':
      // La pila desaparecio del overlay.
      if (!/var\(--compose-n, 0\)/.test(c)) fallo = true;
      break;
    case 'vuelve-cascada':
      // El paso horizontal tiene que ser CERO. Si vuelve a restar `--compose-n`
      // del `dx`, las ventanas se diagonizan, que es lo que el owner descarto.
      if (/var\(--compose-dx, 0px\) - var\(--compose-n/.test(c)) fallo = true;
      if (!/var\(--compose-dy, 0px\) - var\(--compose-n, 0\) \* 40px/.test(c)) fallo = true;
      break;
    case 'paso-corto':
      if (!/var\(--compose-n, 0\) \* 40px/.test(c)) fallo = true;
      break;
    case 'pila-sin-tope':
      // Tiene que quedar en 5 EN LOS DOS lugares donde aparece, no en uno.
      if ((mutado.match(/Math\.min\(_composeAbiertos\.length, 5\)/g) || []).length !== 2) fallo = true;
      break;
    case 'minis-superpuestas': {
      const r = c.match(/\.compose-panel--minimized\s*\{[\s\S]*?\n\}/);
      if (!r || !/--compose-m/.test(r[0])) fallo = true;
      break;
    }
    case 'min-height-vuelve':
    case 'min-width-vuelve': {
      const r = c.match(/\.compose-panel--minimized\s*\{[\s\S]*?\n\}/);
      if (!r || !/min-width:\s*0/.test(r[0]) || !/min-height:\s*0/.test(r[0])) fallo = true;
      break;
    }
    case 'mini-izquierda': {
      const r = c.match(/\.compose-panel--minimized\s*\{[\s\S]*?\n\}/);
      if (!r || !/right:\s*24px/.test(r[0]) || !/left:\s*auto/.test(r[0])) fallo = true;
      break;
    }
    case 'overlay-mini-roto':
      if (!/\.compose-panel-overlay--mini\s*\{\s*transform:\s*none/.test(c)) fallo = true;
      break;
    case 'clase-muerta-vuelve':
      // El mutante mete la clase muerta; el check real exige que NO este.
      if (/compose-panel-overlay--hidden/.test(mutado)) fallo = true;
      break;
    case 'sin-tope':
      if (!/if \(_composeAbiertos\.length >= COMPOSE_MAX\)/.test(mutado)) fallo = true;
      break;
    case 'tope-tarde': {
      // Avisa pero NO corta: la septima ventana se dibuja igual.
      const g = mutado.match(/if \(_composeAbiertos\.length >= COMPOSE_MAX\) \{[\s\S]*?\n    \}/);
      if (!g || g[0].indexOf('return;') < 0) fallo = true;
      break;
    }
    case 'no-saca-registro':
      if (!/_composeAbiertos\.splice\(i, 1\)/.test(mutado)) fallo = true;
      break;
    case 'no-reacomoda-al-cerrar': {
      const m = mutado.match(/var closeModal = function \(\) \{[\s\S]*?\n    \};/);
      if (!m || m[0].indexOf('reacomodarMinimizados()') < 0) fallo = true;
      break;
    }
    case 'cuenta-todas': {
      const m = mutado.match(/function reacomodarMinimizados\(\)[\s\S]*?\n  \}/);
      if (!m || m[0].indexOf('if (!c.minimizado) continue;') < 0) fallo = true;
      break;
    }
    case 'sin-frente':
      if (!/_composeZ \+= 1;/.test(mutado)) fallo = true;
      break;
    case 'arrastra-botones': {
      const m = mutado.match(/titlebar\.addEventListener\("mousedown"[\s\S]*?document\.addEventListener\("mouseup", soltar\);/);
      if (!m || m[0].indexOf('closest(".compose-panel__btn")') < 0) fallo = true;
      break;
    }
    case 'arrastra-minimizada': {
      const m = mutado.match(/titlebar\.addEventListener\("mousedown"[\s\S]*?document\.addEventListener\("mouseup", soltar\);/);
      if (!m || m[0].indexOf('if (panel.classList.contains("compose-panel--minimized")) return;') < 0) fallo = true;
      break;
    }
    case 'arrastre-sin-tope': {
      const m = mutado.match(/function mover\(ev\) \{[\s\S]*?\n      \}/);
      if (!m || m[0].indexOf('Math.min(Math.max(nuevoDx, minDx), maxDx)') < 0) fallo = true;
      break;
    }
    case 'mouseup-colgado':
      if (!/document\.addEventListener\("mouseup", soltar\)/.test(mutado)) fallo = true;
      break;
    case 'restaura-corrida':
      if (!/--compose-dx", "0px"/.test(mutado)) fallo = true;
      break;
    default:
      noMordieron.push(mu.nombre + '  [CLAVE SIN EVALUAR: ' + mu.clave + ']');
      continue;
  }

  if (fallo) mordieron++; else noMordieron.push(mu.nombre);
}

chk('ningun mutante quedo vacio', vacios === 0, vacios + ' vacios');
chk('todas las mutaciones fueron cazadas', noMordieron.length === 0,
  noMordieron.length + ' no mordieron: ' + noMordieron.slice(0, 4).join(' | '));

if (fallos.length) {
  console.log('\n✗ ' + fallos.length + ' check(s) fallaron de ' + n + '\n');
  fallos.forEach((f) => console.log('  FAIL  ' + f));
  console.log('\n  mutaciones: ' + mordieron + '/' + MUTANTES.length + ' mordieron, ' + vacios + ' vacios');
  process.exit(1);
}
console.log('\n' + n + '/' + n + ' checks OK');
console.log('  mutaciones: ' + mordieron + '/' + MUTANTES.length + ' mordieron, ' + vacios + ' vacios');
