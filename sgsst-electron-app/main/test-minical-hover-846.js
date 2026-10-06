'use strict';
// 📦846 · Verificacion del popup de categorias al pasar el mouse por un dia
// del mini-calendar.
//
// La parte estatica comprueba el cableado; la parte FUNCIONAL saca las
// funciones del popup tal cual estan escritas y las corre en una vm con un
// DOM minimo. Sin esa parte, un popup que agrupa mal, o que announce "Lun" un
// domingo, pasaria todos los guards de estructura.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const APP = path.join(__dirname, '..');
const APPJS = path.join(APP, 'renderer', 'bandeja-integrada', 'app.js');
const CSSJS = path.join(APP, 'renderer', 'bandeja-integrada', 'premium.css');
const IDXJS = path.join(APP, 'renderer', 'bandeja-integrada', 'index.html');
const t = fs.readFileSync(APPJS, 'utf8');
const css = fs.readFileSync(CSSJS, 'utf8');
const idx = fs.readFileSync(IDXJS, 'utf8');

const ok = [];
const chk = (n, c, e) => ok.push({ n, c: !!c, e });

function soloCodigo(x) {
  return x.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ').replace(/<!--[\s\S]*?-->/g, ' ');
}
function cuerpoDe(nombre) {
  const LL = t.split(/\r?\n/);
  const i = LL.findIndex(s => s.indexOf('function ' + nombre + '(') !== -1);
  if (i < 0) return '';
  let n = 0, ab = false, fin = LL.length - 1;
  for (let k = i; k < LL.length; k++) {
    for (const c of LL[k]) {
      if (c === '{') { n++; ab = true; }
      else if (c === '}') { n--; if (ab && n === 0) { fin = k; break; } }
    }
    if (ab && n === 0) break;
  }
  return LL.slice(i, fin + 1).join('\n');
}

const mini = soloCodigo(cuerpoDe('renderSidebar'));

// 📦847 · Los helpers de hora/fecha que usa el popup viven en app.js. Se
// extraen de AHI y se corre el texto real: una copia escrita a mano
// podria quedar vieja respecto de app.js y el test seguiria en verde.
const HELPERS_HORA = [
  cuerpoDe('_isPlaceholderTime'),
  cuerpoDe('isAllDayEvent'),
  cuerpoDe('getEventStartHour'),
  cuerpoDe('getEventDuration'),
].join('\n\n');

// _isPlaceholderTime usa DEFAULT_START_HOUR/DEFAULT_DURATION_HOURS en sus
// defaults; se declaran con los valores reales leidos del archivo.
const DEFAULTS_HORA = [
  /const DEFAULT_START_HOUR = (\d+);/.exec(t),
  /const DEFAULT_DURATION_HOURS = (\d+);/.exec(t),
].filter(Boolean).map((m) => 'const ' + m[0].split('=')[0].replace('const ', '').trim()
  + ' = ' + m[1] + ';').join('\n');
const pop = soloCodigo(cuerpoDe('mostrarPopupDia'));
const eti = soloCodigo(cuerpoDe('_etiquetaDia'));
const fran = soloCodigo(cuerpoDe('_franja'));
const hhmm = soloCodigo(cuerpoDe('_hhmm'));

// ══ 1) Estructura: las funciones existen ══
chk('existe mostrarPopupDia(iso, eventos, ancla)', pop.length > 500, pop.length + ' chars');
chk('existe _etiquetaDia(iso)', eti.length > 100);
chk('existe _franja(ev)', fran.length > 50);
chk('existe ocultarPopupDia()', /function ocultarPopupDia\(\)/.test(t));

// ══ 2) El cableado en la celda ══
// 📦858-INVERTIDO — la celda calcula los eventos SOLO en la pestaña Agenda.
// En Correo el popup no se engancha: el mini es un selector de día y un popup
// con el calendario a la vista respondería a otra pregunta. La cuenta de
// eventos se sigue haciendo igual, solo que detrás de la rama.
chk('📦858 · la celda calcula los eventos de ESE dia, solo en Agenda',
  /const eventosDelDia = modoCorreo \? \[\] : visibleEvents\.filter\(\(ev\) => ev && ev\.date === c\.iso\)/.test(mini));
chk('y solo engancha el hover si ese dia tiene eventos',
  /if \(eventosDelDia\.length\) \{[\s\S]{0,200}mouseenter/.test(mini));
chk('mouseenter muestra el popup de ese dia y esa celda',
  /btn\.addEventListener\("mouseenter", \(\) => mostrarPopupDia\(c\.iso, eventosDelDia, btn\)\)/.test(mini));
chk('mouseleave lo oculta', /btn\.addEventListener\("mouseleave", ocultarPopupDia\)/.test(mini));

// ══ 3) El popup no puede quedarse pegado ══
// ESTE es el invariante que mas seiten forgetting: el popup vive en
// document.body, FUERA del sidebar. El sidebar se reconstruye entero en cada
// render(), asi que si el dia hoverado desaparece su mouseleave nunca se
// dispara y el popup quedaria flotando sobre otra pantalla.
chk('se oculta al empezar cada render del sidebar',
  /container\.innerHTML = "";[\s\S]{0,400}ocultarPopupDia\(\);/.test(mini));
chk('se oculta tambien al hacer scroll (sino se despega de su celda)',
  /addEventListener\("scroll", ocultarPopupDia, \{ passive: true, capture: true \}\)/.test(t));
chk('y al redimensionar la ventana', /addEventListener\("resize", ocultarPopupDia/.test(t));

// ══ 4) pointer-events: none — la razon de fondo ══
// Si el popup aceptara el mouse, al entrar dispararia el mouseleave del dia
// (parpadeo) y se COMERIA el segundo clic del doble clic de 845.
const bloquePop = css.slice(css.indexOf('.mini-pop {'));
chk('el popup tiene pointer-events: none',
  /pointer-events:\s*none/.test(bloquePop.split('}')[0]));
chk('y es un unico elemento reutilizado, no uno por dia',
  /if \(_miniPop && _miniPop\.isConnected\) return _miniPop;/.test(t));

// ══ 5) La agrupacion ══
chk('agrupa por categoria', /var porCat = new Map\(\)/.test(pop));
chk('en el orden de EVENT_CATEGORIES, no en el de aparicion',
  /Object\.keys\(D\.EVENT_CATEGORIES\)\.filter/.test(pop));
chk('el titulo del dia ya no es solo el numero',
  /mini-pop__day/.test(pop));

// ══ 6) El dia de la semana ══
// El bug que casi se cuela: WEEKDAY_LABELS arranca en LUNES y getDay() en
// DOMINGO. Indexar el array con getDay() directo anuncia "Lun" los domingos.
chk('el dia de la semana se rota antes de buscarlo en WEEKDAY_LABELS',
  /var dow = \(d\.getDay\(\) - D\.MONTH_VIEW\.firstDayOfWeek \+ 7\) % 7;/.test(eti));
chk('y usa el array, no lo escribe a mano',
  /D\.WEEKDAY_LABELS\[dow\]/.test(eti));

// ══ 7) El tope de eventos ══
const max = Number((/MINI_POP_MAX\s*=\s*(\d+)/.exec(t) || [])[1]);
chk('hay un tope de eventos listados', max > 0 && max <= 20, max + '');
chk('y lo que sobra se resume en "+N mas"', /mini-pop__more/.test(pop));

// ══ 8) CSS ══
chk('el popup tiene su bloque de estilos', css.indexOf('.mini-pop {') >= 0);
chk('y su estado visible', css.indexOf('.mini-pop.is-on') >= 0);
chk('el prefers-reduced-motion global sigue ahi (lo apaga si hace falta)',
  css.indexOf('prefers-reduced-motion') >= 0);
const varsUsadas = [...new Set([...bloquePop.matchAll(/var\((--kair-[a-z0-9-]+)\)/g)].map(m => m[1]))];
chk('todas las variables CSS que usa existen de verdad',
  varsUsadas.every(v => css.indexOf(v + ':') >= 0),
  varsUsadas.filter(v => css.indexOf(v + ':') < 0).join(',') || 'todas');

// ══ 9) Cache-bust de los DOS archivos que cambiaron ══
// 📦847-fix · Este check tenía el token FIJO escrito ("2026\d+-mini-popup").
// Cada bump lo rompía: el test obligaba a editarlo para pasar. Se valida la
// FORMA del token, que es lo que evita que el navegador sirva un archivo
// viejo. Mismo criterio que en test-bandeja-paginacion y -toolbar-compacta.
const cbPremium = (idx.match(/premium\.css\?v=([\w.-]+)/) || [])[1] || '';
const cbApp = (idx.match(/app\.js\?v=([\w.-]+)/) || [])[1] || '';
chk('premium.css tiene token de cache-bust con fecha', /^\d{8}-/.test(cbPremium), cbPremium);
chk('app.js tambien (cambio entero, no solo el CSS)', /^\d{8}-/.test(cbApp), cbApp);
chk('y los dos comparten token: si difieren se sirven desparejos',
  cbPremium !== '' && cbPremium === cbApp, cbPremium + ' vs ' + cbApp);

// ══ 10) El CSS nuevo no dejo variables inexistentes ══
chk('no se colaron variables que el tema no define (--kair-text-1, etc.)',
  !/--kair-text-1\b/.test(css));

// ══════════════════════════════════════════════════════════════
//  11) FUNCIONAL · el popup de verdad, con un DOM minimo
// ══════════════════════════════════════════════════════════════
// Se extraen las funciones del archivo y se corren tal cual. Si el agrupamiento
// o el nombre del dia estuvieran mal, aqui se veria, no en un regex.
(function funcional() {
  const CATS = {
    plan: { id: 'plan', label: 'Plan de Trabajo', color: '#174ea6' },
    capacitacion: { id: 'capacitacion', label: 'Capacitación', color: '#28a745' },
    auditoria: { id: 'auditoria', label: 'Auditoría', color: '#b8860b' },
  };
  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  // 2026-10-04 es un DOMINGO, 2026-10-05 un LUNES. Si la rotacion del dia esta
  // mal, estos dos casos intercambian los nombres y el test lo ve.
  const DOMINGO = '2026-10-04';
  const LUNES = '2026-10-05';

  function correr(eventos) {
    const c = {
      __res: {},
      document: { body: { appendChild() { } } },
      window: { innerWidth: 1400, innerHeight: 900, addEventListener() { } },
      Math: Math, Number: Number, String: String, Array: Array, Object: Object,
      parseInt: parseInt, parseFloat: parseFloat,
      isNaN: isNaN,
      el: () => ({}),
      D: {
        EVENT_CATEGORIES: CATS,
        MONTH_LABELS_ES: MESES,
        WEEKDAY_LABELS: DIAS,
        MONTH_VIEW: { firstDayOfWeek: 1 },
      },
      escapeHtml: (s) => String(s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    };
    c.globalThis = c;
    vm.createContext(c);
    // El cuerpo real, sin tocar, mas un stub del nodo del popup.
    const fuente = [
      'var _miniPop = null;',
      'var _miniPopListo = false;',
      'const MINI_POP_MAX = 8;',
      // 📦847 · _franja ahora llama a los helpers del calendario. Sin
      // declararlos aqui la vm los daria por no definidos.
      DEFAULTS_HORA,
      HELPERS_HORA,
      hhmm, fran, eti,
      'function _miniPopEl() { return __nodo(); }',
      'function ocultarPopupDia() { if (_miniPop) _miniPop.classList.remove("is-on"); }',
      pop,
    ].join('\n\n');
    vm.runInContext(fuente, c);
    c.__nodo = () => {
      const n = {
        innerHTML: '', style: {},
        classList: {
          _s: new Set(),
          add(x) { this._s.add(x); }, remove(x) { this._s.delete(x); },
          has(x) { return this._s.has(x); },
        },
        rect: { top: 100, left: 200, right: 230, bottom: 130, width: 260, height: 150 },
        getBoundingClientRect() { return this.rect; },
      };
      c._miniPop = n;
      return n;
    };
    vm.runInContext('mostrarPopupDia(' + JSON.stringify(eventos.__iso) + ', '
      + JSON.stringify(eventos.evs) + ', { getBoundingClientRect: function(){'
      + ' return {top:100,left:200,right:230}; } });', c);
    return c._miniPop.innerHTML;
  }

  const ev = (date, title, category, startHour, durationHours) =>
    ({ date, title, category, startHour, durationHours });

  // 11.1 · Un dia con dos categorias
  const h1 = correr({
    __iso: DOMINGO,
    evs: [
      ev(DOMINGO, 'Comité', 'plan', 9, 1),
      ev(DOMINGO, 'Capacitación SST', 'capacitacion', 14.5, 2),
    ],
  });
  chk('el popup lista el nombre del dia', h1.indexOf('Dom 4 de octubre') >= 0,
    h1.slice(0, 90));
  chk('un DOMINGO se anuncia "Dom", no "Lun" (rotacion del dia de semana)',
    h1.indexOf('Dom 4 de octubre') >= 0 && h1.indexOf('Lun 4 de') < 0);
  chk('agrupa por el orden de EVENT_CATEGORIES, no por el de los eventos',
    h1.indexOf('Plan de Trabajo') < h1.indexOf('Capacitación'),
    'plan antes que capacitacion');
  chk('cada categoria lleva su contador', h1.indexOf('>1</span>') >= 0);
  chk('muestra la hora de los eventos', h1.indexOf('09:00') >= 0);
  chk('y calcula bien una hora con minutos (14.5 = 14:30)',
    h1.indexOf('14:30') >= 0, h1);
  chk('la duracion se ve como una franja', h1.indexOf('14:30–16:30') >= 0, h1);

  // 11.2 · Un LUNES
  const h2 = correr({
    __iso: LUNES,
    evs: [ev(LUNES, 'Reunion', 'auditoria', 8, 1)],
  });
  chk('un LUNES se anuncia "Lun"', h2.indexOf('Lun 5 de octubre') >= 0, h2.slice(0, 80));

  // 11.3 · Hora de inicio sin duracion
  const h3 = correr({
    __iso: LUNES,
    evs: [ev(LUNES, 'Todo el dia', 'plan', 10.25, 0)],
  });
  chk('sin duracion muestra solo la hora de inicio, no "10:15-10:15"',
    h3.indexOf('10:15') >= 0 && h3.indexOf('10:15–') < 0, h3);

  // 📦848 · La FORMA REAL de los eventos. Los mocks de data.js usan
  // startHour numerico, y con esos datos el test de 846 no veía que 847
  // declaraba "Todo el día" a los eventos que llegan con start/end de texto
  // (que son los de la BD y los que genera main.js).
  const hReal = correr({
    __iso: LUNES,
    evs: [
      { date: LUNES, title: "Actualización de Presupuesto", category: "plan", start: "09:00", end: "11:00" },
    ],
  });
  chk('un evento con start/end de TEXTO muestra su hora, no "Todo el día"',
    hReal.indexOf("09:00–11:00") >= 0 && hReal.indexOf("Todo el día") < 0, hReal);

  // 📦848 · EL CASO QUE DETECTA EL BUG. El de arriba (09:00-11:00) no lo
  // detecta: _isPlaceholderTime da false para ese rango, asi que la rama
  // "Todo el día" ni se ejecuta. El rango 00:00-23:59 SI la dispara, y es
  // justo la forma que usan los 5 generadores de main.js (recordatorios,
  // inspecciones). Con el bug de 847 estos salían como "Todo el día"
  // mientras la grilla los pintaba de 9 a 11.
  const hPlaceholder = correr({
    __iso: LUNES,
    evs: [
      { date: LUNES, title: "Actualización de Presupuesto (5 primeros días)", category: "plan", start: "00:00", end: "23:59", allDay: true },
    ],
  });
  chk('un evento con rango 00:00-23:59 (los recordatorios) NO se declara "Todo el día"',
    hPlaceholder.indexOf("09:00–11:00") >= 0 && hPlaceholder.indexOf("Todo el día") < 0, hPlaceholder);

  // Y el que SI es todo el dia de verdad (24h), para que el rótulo no se
  // pierda por el caso anterior.
  const hAll = correr({
    __iso: LUNES,
    evs: [
      { date: LUNES, title: "Capacitacion todo el dia", category: "capacitacion", startHour: 0, durationHours: 24 },
    ],
  });
  chk('un evento de 24h SÍ se declara "Todo el día"',
    hAll.indexOf("Todo el día") >= 0, hAll);
  // 11.4 · El tope: 12 eventos -> 8 filas y "+4 mas"
  const muchos = [];
  for (let i = 0; i < 12; i++) {
    muchos.push(ev(LUNES, 'Evento ' + i, i % 2 ? 'plan' : 'capacitacion', 8 + (i % 8), 1));
  }
  const h4 = correr({ __iso: LUNES, evs: muchos });
  const filas = (h4.match(/mini-pop__row/g) || []).length;
  chk('con 12 eventos se listan 8 filas, no 12', filas === 8, 'filas=' + filas);
  chk('y avisa "+4 mas"', h4.indexOf('+4 mas') >= 0, h4.slice(-60));

  // 11.5 · Una categoria que no cabe no deja cabecera colgando
  // Con el tope lleno, la 3a categoria no puede mostrar ni una fila. Si su
  // cabecera se imprimiera igual, el usuario veria "Auditoria 3" sin nada
  // debajo y lo leeria como un error de la app.
  const repartidos = [
    ev(LUNES, 'A1', 'plan', 8, 1), ev(LUNES, 'A2', 'plan', 9, 1),
    ev(LUNES, 'A3', 'plan', 10, 1), ev(LUNES, 'A4', 'plan', 11, 1),
    ev(LUNES, 'A5', 'plan', 12, 1), ev(LUNES, 'A6', 'plan', 13, 1),
    ev(LUNES, 'B1', 'capacitacion', 14, 1), ev(LUNES, 'B2', 'capacitacion', 15, 1),
    ev(LUNES, 'C1', 'auditoria', 16, 1), ev(LUNES, 'C2', 'auditoria', 17, 1),
  ];
  const h5 = correr({ __iso: LUNES, evs: repartidos });
  const cats = (h5.match(/mini-pop__cat"/g) || []).length;
  chk('la categoria que no cabe no imprime su cabecera', cats === 2, 'bloques=' + cats);
  chk('y sus eventos van al "+N mas"', h5.indexOf('+2 mas') >= 0, h5.slice(-60));

  // 11.6 · Sin eventos no hay popup
  chk('sin eventos no se construye nada', /if \(!evs\.length\)/.test(pop));

  // 11.7 · XSS: el titulo de un evento se escapa
  const h6 = correr({
    __iso: LUNES,
    evs: [ev(LUNES, '<img src=x onerror=alert(1)>', 'plan', 9, 1)],
  });
  chk('un titulo con HTML queda escapado, no interpretado',
    h6.indexOf('<img') < 0 && h6.indexOf('&lt;img') >= 0, h6);
})();

// ══ 12) Higiene ══
let netas = 0;
for (const c of t) { if (c === '{') netas++; else if (c === '}') netas--; }
chk('las llaves balancean', netas === 0, 'netas=' + netas);
// El rango va con escapes \u y NO con los caracteres literales: el repo
// prohibe CJK en disco, y un range escrito con los caracteres literales
// DENTRO es CJK, aunque este sea justamente el test de higiene.
// de la suite.
const RANGO_CJK = /[\u4e00-\u9fff\u3040-\u30ff\u0400-\u04ff\uac00-\ud7af]/g;
const cjk = (t.match(RANGO_CJK) || []).length + (css.match(RANGO_CJK) || []).length;
chk('sin CJK/mojibake', cjk === 0, 'CJK=' + cjk);
const crlf = (t.match(/\r\n/g) || []).length, lf = (t.match(/\n/g) || []).length;
chk('EOL consistente en app.js', crlf === lf || crlf === 0, crlf + '/' + lf);

let fail = 0;
console.log('\n=======================================');
console.log('  📦846 · Popup de categorías al hover');
console.log('=======================================');
ok.forEach(x => { if (!x.c) fail++; console.log((x.c ? 'OK  ' : 'FAIL') + '  ' + x.n + (x.e ? '  [' + x.e + ']' : '')); });
console.log('---');
console.log((ok.length - fail) + '/' + ok.length + ' OK');
console.log('=======================================');
process.exit(fail === 0 ? 0 : 1);
