'use strict';
// 📦878 · Los eventos del calendario grande usan el popup del mini-calendar,
// en vez del `title` nativo del navegador.
//
// Que el tooltip se viera feo era lo de menos: el title de la vista Mes armaba la
// hora con `ev.startHour`, que no siempre es numero, y por eso se leia "NaN:NaN"
// en pantalla. La grilla de Semana y Dia usan `getEventStartHour`, que si
// valida. O sea: el mismo evento se veia bien en dos vistas y roto en la otra.
//
// Este test tiene dos partes. La ESTATICA comprueba que ninguna superficie del
// calendario grande quedo con title nativo y que todas cablean el popup. La
// FUNCIONAL saca `mostrarPopupDia` tal cual esta escrita y la corre en una vm
// con un DOM minimo, porque un popup que ignora el `hint` que le pasa el call
// site pasaria todos los guards de estructura y aun asi mentiria en pantalla.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const APP = path.join(__dirname, '..');
const APPJS = path.join(APP, 'renderer', 'bandeja-integrada', 'app.js');
const CSSJS = path.join(APP, 'renderer', 'bandeja-integrada', 'premium.css');
const IDXJS = path.join(APP, 'renderer', 'bandeja-integrada', 'index.html');
const T0 = fs.readFileSync(APPJS, 'utf8');
const CSS0 = fs.readFileSync(CSSJS, 'utf8');
const IDX0 = fs.readFileSync(IDXJS, 'utf8');

function soloCodigo(x) {
  return x
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
}
// Cuerpo de una funcion por nombre, contando llaves (no hay llaves en strings
// de estos bloques, asi que el conteo simple alcanza).
function cuerpoDe(src, nombre) {
  const LL = src.split(/\r?\n/);
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

// ══════════════════════════════════════════════════════════════════════
// Checks parametrizados: reciben las fuentes, asi el bloque de mutaciones
// puede volver a correrlos contra un archivo degradado.
// ══════════════════════════════════════════════════════════════════════
function correrChecks(t, css, idx) {
  const ok = [];
  const chk = (n, c, e) => ok.push({ n, c: !!c, e });

  const mes = soloCodigo(cuerpoDe(t, 'renderBigCalendar'));
  const dia = soloCodigo(cuerpoDe(t, 'renderDayView'));
  const sem = soloCodigo(cuerpoDe(t, 'renderWeekView'));
  const prog = soloCodigo(cuerpoDe(t, 'renderScheduleView'));
  const pop = soloCodigo(cuerpoDe(t, 'mostrarPopupDia'));
  const tSin = soloCodigo(t);

  // ══ 1) El title nativo desaparecio de las cinco superficies ══
  chk('la vista Mes ya no pone title en el chip',
    !/class:\s*"kair-month-event[^"]*"[\s\S]{0,220}?title:/.test(mes));
  chk('la vista Dia ya no pone title en el bloque',
    !/kair-day-event[\s\S]{0,600}?block\.title\s*=/.test(dia));
  chk('la vista Semana ya no pone title en el bloque',
    !/kair-week-event[\s\S]{0,600}?block\.title\s*=/.test(sem));
  chk('los chips de todo el dia ya no ponen title (Dia)',
    !/chip\.title\s*=/.test(dia));
  chk('los chips de todo el dia ya no ponen title (Semana)',
    !/chip\.title\s*=/.test(sem));
  chk('y en TODO app.js no queda ningun title sobre un evento',
    !/\b(?:block|chip|eventBtn)\.title\s*=/.test(tSin));

  // ══ 2) Las cinco superficies cablean el popup ══
  const superficies = ['renderBigCalendar', 'renderDayView', 'renderWeekView'];
  let cableadas = 0;
  for (const v of superficies) {
    const c = cuerpoDe(t, v);
    if (/addEventListener\("mouseenter"[\s\S]{0,200}?mostrarPopupDia\(/.test(c)
      && /addEventListener\("mouseleave",\s*ocultarPopupDia\)/.test(c)) cableadas++;
  }
  chk('las TRES vistas cablean mouseenter -> popup y mouseleave -> ocultar',
    cableadas === 3, cableadas + '/3');
  chk('el popup se abre por el dia del propio evento, no por el de la celda',
    (t.match(/mostrarPopupDia\(ev\.date/g) || []).length >= 5,
    (t.match(/mostrarPopupDia\(ev\.date/g) || []).length + ' superficies');
  const _i0 = css.indexOf('.mini-pop {');
  // El bloque va de `.mini-pop {` hasta SU llave de cierre. Con indexOf('}') a
  // secas se agarra la primera llave de todo el archivo, que esta miles de
  // lineas antes, y el corte queda al reves: el check pasaba/fallaba por nada.
  const _bloquePop = _i0 >= 0 ? css.slice(_i0, css.indexOf('}', _i0)) : '';
  chk('el popup es el MISMO elemento del mini (pointer-events: none, o el clic se come)',
    _i0 >= 0 && /pointer-events:\s*none/.test(_bloquePop), _bloquePop ? 'bloque de ' + _bloquePop.length + ' chars' : 'no se encontro .mini-pop');

  // ══ 3) La causa del NaN:NaN ══
  chk('la vista Mes ya no arma la hora con ev.startHour',
    !/title:[^\n]*ev\.startHour/.test(mes) && !/ev\.startHour\s*\)\s*\}/.test(mes));
  chk('la lista de Agenda no puede imprimir NaN:NaN',
    /typeof ev\.startHour === "number"/.test(prog) && !/fmtHour\(ev\.startHour\)\s*\|\|/.test(prog));
  chk('el texto del popup sale de _franja, que usa los helpers que validan',
    /_franja\(lista\[j\]\)/.test(pop));

  // ══ 4) El hint: el calendario grande NO puede anunciar doble clic ══
  chk('mostrarPopupDia acepta opciones',
    /function mostrarPopupDia\(iso, eventos, ancla, opciones\)/.test(tSin));
  chk('y el hint sale de opciones, con el del mini por defecto',
    /opciones\.hint\s*\|\|/.test(pop));
  chk('el default del mini sigue anunciando el doble clic (845 depende de el)',
    /opciones\.hint \|\| "Doble clic para ver el día"/.test(tSin));
  const sinHintPropio = (t.match(/mostrarPopupDia\(ev\.date[^\n]*$/gm) || [])
    .filter(l => !/hint:/.test(l)).length;
  chk('las cinco superficies del calendario grande pasan su propia pista',
    sinHintPropio === 0, sinHintPropio + ' sin hint');
  chk('y ninguna dice "Doble clic", que ahi no aplica',
    !/mostrarPopupDia\(ev\.date[^\n]*Doble clic/.test(tSin));

  // ══ 5) Cache-bust: los tres tokens van juntos (846 lo exige) ══
  const tok = s => (/app\.js\?v=([^"']+)/.exec(s) || [])[1]
    || (/styles\.css\?v=([^"']+)/.exec(s) || [])[1];
  const tApp = (/app\.js\?v=([^"']+)/.exec(idx) || [])[1];
  const tSty = (/styles\.css\?v=([^"']+)/.exec(idx) || [])[1];
  const tPre = (/premium\.css\?v=([^"']+)/.exec(idx) || [])[1];
  chk('app.js, styles.css y premium.css comparten token',
    !!tApp && tApp === tSty && tSty === tPre, [tApp, tSty, tPre].join(' vs '));

  // ══ 6) EOL: app.js es CRLF y no se mezclo ══
  const raw = fs.readFileSync(APPJS);
  let crlf = 0, lf = 0;
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === 10) { if (i > 0 && raw[i - 1] === 13) crlf++; else lf++; }
  }
  chk('app.js queda todo CRLF (el archivo es CRLF de origen)',
    lf === 0 && crlf > 9000, crlf + '/' + lf);
  chk('sin CJK, cirilico ni hangul', !/[\u3000-\u9FFF\uAC00-\uD7AF\u0400-\u04FF]/.test(t));
  return ok;
}

// ══════════════════════════════════════════════════════════════════════
// FUNCIONAL: correr mostrarPopupDia de verdad, con un DOM minimo.
// ══════════════════════════════════════════════════════════════════════
function correrPopup(t, opciones) {
  opciones = opciones || {};
  const trozos = ['_hhmm', '_franja', '_etiquetaDia', 'mostrarPopupDia', 'ocultarPopupDia']
    .map(n => cuerpoDe(t, n)).join('\n');
  let capturado = null;
  const nodo = {
    _h: '', className: '',
    set className(v) { this._c = v; }, get className() { return this._c; },
    set innerHTML(v) { capturado = v; }, get innerHTML() { return capturado; },
    setAttribute() {}, getBoundingClientRect() { return { top: 10, left: 10, right: 30, bottom: 20, width: 20, height: 10 }; },
    classList: { add() {}, remove() {}, toggle() {} },
    style: {}, isConnected: true, addEventListener() {}, removeEventListener() {}
  };
  const ctx = {
    console,
    MINI_POP_MAX: 8,
    _miniPop: null,
    document: { body: { appendChild() {} }, createElement: () => nodo },
    window: { innerWidth: 1200, innerHeight: 800, addEventListener() {} },
    escapeHtml: s => String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    _miniPopEl() { return nodo; },
    D: {
      WEEKDAY_LABELS: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
      MONTH_LABELS_ES: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
      MONTH_VIEW: { firstDayOfWeek: 1 },
      EVENT_CATEGORIES: {
        inspeccion_programada: { label: 'inspeccion_programada', color: '#174ea6' },
        recordatorio_inducciones: { label: 'recordatorio_inducciones', color: '#6c757d' }
      }
    },
    isAllDayEvent: ev => !ev.start && !ev.end && typeof ev.startHour !== 'number',
    getEventStartHour: ev => (typeof ev.startHour === 'number' ? ev.startHour : 9),
    getEventDuration: ev => (typeof ev.durationHours === 'number' ? ev.durationHours : 2)
  };
  vm.createContext(ctx);
  vm.runInContext(trozos, ctx);
  const evs = [
    { date: '2026-10-02', title: '2. Inspecciones de instalaciones', category: 'inspeccion_programada', startHour: 9, durationHours: 2 },
    { date: '2026-10-02', title: 'Actualización de Inducciones', category: 'recordatorio_inducciones', startHour: 9, durationHours: 2 }
  ];
  ctx.mostrarPopupDia('2026-10-02', evs, nodo, opciones.pasarOpciones ? opciones.pasarOpciones : undefined);
  return capturado;
}

const ok = correrChecks(T0, CSS0, IDX0);

// ══ Parte funcional ══
(function funcional() {
  const h = correrPopup(T0, {});
  ok.push({ n: 'el popup agrupa por categoria con su punto de color', c: !!(h && /mini-pop__cat/.test(h) && /mini-pop__dot/.test(h)), e: (h || '').slice(0, 40) });
  ok.push({ n: 'y nombra la franja con la hora, no con NaN', c: !!(h && /09:00/.test(h) && !/NaN/.test(h)) });
  ok.push({ n: 'sin opciones, el hint es el del mini (doble clic)', c: !!(h && /Doble clic para ver el día/.test(h)) });
  const h2 = correrPopup(T0, { pasarOpciones: { hint: 'Clic para ver el evento' } });
  ok.push({ n: 'con opciones, el hint es el que pasa el call site', c: !!(h2 && /Clic para ver el evento/.test(h2)) });
  ok.push({ n: 'y NO dice doble clic cuando se le pasa otro hint', c: !!(h2 && !/Doble clic/.test(h2)) });
  ok.push({ n: 'el encabezado trae el dia (vie 2 de octubre)', c: !!(h2 && /mini-pop__day/.test(h2) && /2 de octubre/.test(h2)) });
})();

// ══════════════════════════════════════════════════════════════════════
// MUTACIONES: cada una degrada una parte y tiene que poner el test en rojo.
// Derivar el esperado no exime de probar que el check muerde.
// ══════════════════════════════════════════════════════════════════════
const MUT = [
  ['vuelve el title nativo al chip del mes',
    t => t.replace('class: "kair-month-event" + cumplidoClass,',
      'class: "kair-month-event" + cumplidoClass, title: "x",')],
  ['desconecta el mouseenter del mes',
    t => t.replace(/eventBtn\.addEventListener\("mouseenter"[\s\S]{0,200}?\);\n/, '')],
  ['quita el default "Doble clic" que 845 necesita',
    t => t.replace('opciones.hint || "Doble clic para ver el día"', 'opciones.hint || ""')],
  ['hace que el calendario grande anuncie el doble clic',
    t => t.replace('{ hint: "Clic para ver el evento" }', '')],
  ['revierte la hora a ev.startHour en el mes',
    t => t.replace('<div class="kair-agenda-item__time">${(typeof ev.startHour === "number"',
      '<div class="kair-agenda-item__time">${(false')],
  ['desalinea el token de premium.css',
    (t, css, idx) => idx.replace(/(premium\.css\?v=)([^"']+)/, '$1OTRO')],
  ['deja el title en el bloque del dia',
    t => t.replace(/(kair-day-event[\s\S]{0,400}?block\.style\.color = cat\.color \|\| "#333";)/,
      '$1\n        block.title = "x";')],
  ['quita el pointer-events: none del popup',
    (t, css) => css.replace(/(\.mini-pop \{[\s\S]{0,300}?)pointer-events:\s*none;/, '$1')]
];
let mDetectadas = 0;
const detalleMut = [];
for (const [nombre, mut] of MUT) {
  const r = correrChecks(mut(T0, CSS0, IDX0), mut(T0, CSS0, IDX0), mut(T0, CSS0, IDX0));
  const rojos = r.filter(x => !x.c).length;
  if (rojos > 0) mDetectadas++; else detalleMut.push(nombre);
}

let fail = 0;
console.log('\n=======================================');
console.log('  📦878 · Hover del calendario grande con el popup del mini');
console.log('=======================================');
ok.forEach(x => { if (!x.c) fail++; console.log((x.c ? 'OK  ' : 'FAIL') + '  ' + x.n + (x.e ? '  [' + x.e + ']' : '')); });
console.log('---');
console.log('  checks: ' + (ok.length - fail) + '/' + ok.length);
console.log('  mutaciones: ' + mDetectadas + '/' + MUT.length + ' mordieron'
  + (detalleMut.length ? '  NODetectadas: ' + detalleMut.join(' | ') : ''));
if (fail || mDetectadas < MUT.length) process.exit(1);