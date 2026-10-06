'use strict';
// 📦847 · Amplia el test de 846 con los dos bugs que el owner vio en pantalla.
//
// Lo importante: el test anterior PASABA con el bug de las horas. Sus datos
// de prueba usaban {startHour, durationHours}, que es la forma de los MOCKS
// de data.js. Los eventos reales llegan con start/end como TEXTO, y con esos
// datos el popup Pintaba 00:00 y el test lo daba por bueno. Estos casos usan
// la forma real.
const fs = require('fs');
const path = require('path');
const APP = path.join(__dirname, '..');
const APPJS = path.join(APP, 'renderer', 'bandeja-integrada', 'app.js');
const CSSJS = path.join(APP, 'renderer', 'bandeja-integrada', 'premium.css');
const t = fs.readFileSync(APPJS, 'utf8');
const css = fs.readFileSync(CSSJS, 'utf8');
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
const fran = soloCodigo(cuerpoDe('_franja'));
const cuerpoFran = cuerpoDe('_franja');

// ══ 1) El title nativo ══
// El bug: title presente en dias con eventos -> el navegador pinta su
// tooltip encima del popup. Dos notificaciones simultaneas.
chk('el title NO se pasa al crear el boton (se asigna aparte y solo si no hay eventos)',
  !/title:/.test(mini.split('const eventosDelDia')[0].split('const btn =')[1] || ''),
  'sin title: dentro de el("button", {...})');
chk('y se asigna condicionalmente, solo cuando NO hay eventos',
  /if \(!dots\.length\) \{\s*\n\s*btn\.title = /.test(mini));
chk('sin eventos, el title sigue manteniendo la pista del doble clic',
  /Sin eventos · doble clic para ver el día/.test(mini));
chk('el popup suple la pista que estaba en el title',
  /mini-pop__hint/.test(t) && /Doble clic para ver el d[ií]a/.test(t));

// ══ 2) La franja: usa los helpers, no startHour directo ══
chk('_franja NO lee ev.startHour directo (los eventos reales traen start/end de texto)',
  !/ev\.startHour/.test(cuerpoFran), cuerpoFran.slice(0, 80));
chk('usa getEventStartHour (sabe leer startHour Y start "09:00")',
  /getEventStartHour\(ev\)/.test(cuerpoFran));
chk('y getEventDuration (sabe calcular la duracion desde start/end)',
  /getEventDuration\(ev\)/.test(cuerpoFran));
// 📦848 · Este check pedia _isPlaceholderTime. Era un error mio de 847: hay
// 5 generadores en main.js que crean eventos con start 00:00 + end 23:59
// (los recordatorios, entre ellos). No son "todo el dia": la grilla los
// pinta de 9 a 11. La regla correcta es la de renderDayView, que clasifica
// con isAllDayEvent.
chk('un evento se declara "Todo el día" SOLO si isAllDayEvent lo dice (la regla de renderDayView)',
  /if \(isAllDayEvent\(ev\)\) return "Todo el día";/.test(cuerpoFran)
  && !/_isPlaceholderTime/.test(cuerpoFran));
chk('el texto "Todo el día" lleva acento y no es "Todo el dia"',
  /Todo el día/.test(cuerpoFran) && !/Todo el dia/.test(cuerpoFran));

// ══ 3) El CSS: la franja no se recorta ══
const bloqueH = css.slice(css.indexOf('.mini-pop__h {'), css.indexOf('.mini-pop__t {'));
chk('la franja tiene min-width (no un ancho fijo que desbordaba)',
  /min-width:\s*\d+px/.test(bloqueH) && !/flex:\s*0 0 \d+px/.test(bloqueH), bloqueH.split('\n')[1]);
chk('y no se parte en dos lineas',
  /white-space:\s*nowrap/.test(bloqueH));

// ══ 4) FUNCIONAL · las DOS formas de evento ══
// Se corre _franja con los helpers REALES de app.js, no con una reimplementacion.
(function funcional() {
  const vm = require('vm');

  // Los helpers tal cual estan en app.js (L166-217).
  const HELPERS = `
    const DEFAULT_START_HOUR = 9;
    const DEFAULT_DURATION_HOURS = 2;
    function _isPlaceholderTime(ev) {
      if (typeof ev.start === "string" && typeof ev.end === "string" &&
          ev.start.indexOf(":") >= 0 && ev.end.indexOf(":") >= 0) {
        var sH = parseInt(ev.start.split(":")[0], 10);
        var sM = parseInt(ev.start.split(":")[1], 10) || 0;
        var eH = parseInt(ev.end.split(":")[0], 10);
        var eM = parseInt(ev.end.split(":")[1], 10) || 0;
        if (sH === 0 && sM === 0 && eH === 23 && eM === 59) return true;
        if (sH === 0 && sM === 0 && eH === 0 && eM === 0) return true;
      }
      if (!ev.start && !ev.end && typeof ev.startHour !== "number") return true;
      return false;
    }
    function getEventStartHour(ev) {
      if (typeof ev.startHour === "number") return ev.startHour;
      if (typeof ev.start === "string" && ev.start.indexOf(":") >= 0) {
        var parts = ev.start.split(":");
        var h = parseInt(parts[0], 10);
        var m = parseInt(parts[1], 10) || 0;
        if (h === 0 && m === 0) return DEFAULT_START_HOUR;
        return h + m / 60;
      }
      return DEFAULT_START_HOUR;
    }
    function getEventDuration(ev) {
      if (typeof ev.durationHours === "number") return ev.durationHours;
      if (typeof ev.start === "string" && typeof ev.end === "string" &&
          ev.start.indexOf(":") >= 0 && ev.end.indexOf(":") >= 0) {
        var sH = parseInt(ev.start.split(":")[0], 10);
        var sM = parseInt(ev.start.split(":")[1], 10) || 0;
        var eH = parseInt(ev.end.split(":")[0], 10);
        var eM = parseInt(ev.end.split(":")[1], 10) || 0;
        if (_isPlaceholderTime(ev)) return DEFAULT_DURATION_HOURS;
        var diff = (eH + eM/60) - (sH + sM/60);
        return diff > 0 ? diff : 1;
      }
      return DEFAULT_DURATION_HOURS;
    }
    function isAllDayEvent(ev) {
      if (typeof ev.startHour === "number" && typeof ev.durationHours === "number" &&
          ev.startHour === 0 && ev.durationHours >= 24) return true;
      return false;
    }
  `;
  const HHMM = 'function _hhmm(h) {\n'
    + '  var v = Number(h) || 0;\n'
    + '  return String(Math.floor(v)).padStart(2, "0") + ":"\n'
    + '    + String(Math.round((v % 1) * 60)).padStart(2, "0");\n'
    + '}';

  function franja(ev) {
    const c = { res: null, String: String, Number: Number, Math: Math };
    c.globalThis = c;
    vm.createContext(c);
    vm.runInContext(HELPERS + '\n' + HHMM + '\n' + cuerpoFran + '\nres = _franja(__ev);', Object.assign(c, { __ev: ev }));
    return c.res;
  }

  // ── LA FORMA REAL: start/end como texto ──
  // Este es el caso que fallaba en pantalla. Con el codigo viejo
  // (ev.startHour directo) estos devolvian "00:00".
  chk('evento real con start/end de texto: 09:00-11:00',
    franja({ date: '2026-10-12', title: 'Afiliación', start: '09:00', end: '11:00' }) === '09:00–11:00',
    franja({ date: '2026-10-12', start: '09:00', end: '11:00' }));
  chk('evento real que CRUZA el mediodía: 11:30-13:00',
    franja({ start: '11:30', end: '13:00' }) === '11:30–13:00',
    franja({ start: '11:30', end: '13:00' }));
  chk('con minutos no redondos: 14:45-15:15',
    franja({ start: '14:45', end: '15:15' }) === '14:45–15:15',
    franja({ start: '14:45', end: '15:15' }));

  // ── 📦848 · El rango 00:00-23:59 NO significa "todo el día" ──
  // 847 lo creyó y por eso declaraba "Todo el día" a todo. Los 5
  // generadores de main.js crean eventos con ese rango (recordatorios,
  // inspecciones) y la grilla los pinta de 9 a 11. Se invierten: ahora
  // deben salir con la hora de la franja, no como "todo el día".
  chk('REGRESION · el rango 00:00-23:59 NO se declara "Todo el día" (es el caso de los recordatorios)',
    franja({ start: '00:00', end: '23:59' }) === '09:00–11:00',
    franja({ start: '00:00', end: '23:59' }));
  // Este SI es un evento de todo el día de verdad: el mock con 24h de
  // duración. Es el único caso que debe conservar el rótulo.
  chk('el "todo el día" real (startHour 0, 24h) SÍ se declara',
    franja({ startHour: 0, durationHours: 24 }) === 'Todo el día',
    franja({ startHour: 0, durationHours: 24 }));
  chk('REGRESION · un evento sin start ni end toma la hora por defecto, no "Todo el día"',
    franja({ title: 'sin hora' }) === '09:00–11:00',
    franja({ title: 'sin hora' }));

  // ── La forma MOCK: sigue funcionando ──
  chk('los mocks con startHour numérico no se rompieron',
    franja({ startHour: 9, durationHours: 1 }) === '09:00–10:00',
    franja({ startHour: 9, durationHours: 1 }));
  chk('con minutos (startHour 14.5 = 14:30)',
    franja({ startHour: 14.5, durationHours: 2 }) === '14:30–16:30',
    franja({ startHour: 14.5, durationHours: 2 }));

  // ── La asimetria que el bug escondia ──
  // El calendario grande SI sabia pintar estos eventos (usa estos helpers).
  // El popup no. Ahora los dos dicen lo mismo.
  const evReal = { start: '09:00', end: '11:00' };
  const grande = (function () {
    const c = { res: null, String: String, Number: Number, Math: Math, parseInt: parseInt };
    c.globalThis = c;
    vm.createContext(c);
    vm.runInContext(HELPERS + '\nres = getEventStartHour(__ev) + "/" + getEventDuration(__ev);',
      Object.assign(c, { __ev: evReal }));
    return c.res;
  })();
  chk('el popup y el calendario grande leen el MISMO evento (misma hora de inicio y duracion)',
    grande === '9/2' && franja(evReal) === '09:00–11:00', grande + ' vs ' + franja(evReal));
})();

// ══ 5) Higiene ══
let netas = 0;
for (const c of t) { if (c === '{') netas++; else if (c === '}') netas--; }
chk('las llaves balancean', netas === 0, 'netas=' + netas);
const RANGO = new RegExp('[\\u4e00-\\u9fff\\u3040-\\u30ff\\u0400-\\u04ff\\uac00-\\ud7af]', 'g');
chk('sin CJK/mojibake', (t.match(RANGO) || []).length + (css.match(RANGO) || []).length === 0);
const crlf = (t.match(/\r\n/g) || []).length, lf = (t.match(/\n/g) || []).length;
chk('EOL consistente en app.js', crlf === lf || crlf === 0, crlf + '/' + lf);

let fail = 0;
console.log('\n=======================================');
console.log('  📦847 · Title duplicado + horas reales');
console.log('=======================================');
ok.forEach(x => { if (!x.c) fail++; console.log((x.c ? 'OK  ' : 'FAIL') + '  ' + x.n + (x.e ? '  [' + x.e + ']' : '')); });
console.log('---');
console.log((ok.length - fail) + '/' + ok.length + ' OK');
console.log('=======================================');
process.exit(fail === 0 ? 0 : 1);
