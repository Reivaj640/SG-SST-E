'use strict';
// 📦848 · El popup decia "Todo el dia" para todos los eventos.
//
// Estos casos usan los eventos REALES que genera main.js: 5 generadores crean
// eventos con start:'00:00' + end:'23:59' + allDay:true (recordatorios de
// presupuesto, inspecciones programadas, etc). El test de 847 daba por bueno
// "Todo el día" para ese caso; el owner reporto que es falso.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const APP = path.join(__dirname, '..');
const t = fs.readFileSync(path.join(APP, 'renderer', 'bandeja-integrada', 'app.js'), 'utf8');
const ok = [];
const chk = (n, c, e) => ok.push({ n, c: !!c, e });

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
const fran = cuerpoDe('_franja');

// ══ 1) Estructura ══
chk('_franja NO usa _isPlaceholderTime (era lo que declaraba "Todo el día" a todo)',
  !/_isPlaceholderTime/.test(fran), fran.slice(0, 60));
chk('usa isAllDayEvent, la misma regla que renderDayView',
  /if \(isAllDayEvent\(ev\)\) return "Todo el d[ií]a";/.test(fran));

// La coherencia con la grilla es el invariante de fondo: NO basta con que el
// popup no se equivoque, tiene que coincidir con lo que hace renderDayView.
const dia = cuerpoDe('renderDayView');
chk('renderDayView clasifica con isAllDayEvent (la misma funcion)',
  /_allDay: isAllDayEvent\(e\)/.test(dia));
chk('y separa los dos grupos con ese flag',
  /allEvents\.filter\(\(e\) => e\._allDay\)/.test(dia)
  && /allEvents\.filter\(\(e\) => !e\._allDay\)/.test(dia));
chk('los que NO son all-day se pintan con getEventStartHour',
  /_sh: getEventStartHour\(e\)/.test(dia));

// ══ 2) FUNCIONAL · con los helpers reales y los eventos reales de main.js ══
(function funcional() {
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
    const c = { res: null, String: String, Number: Number, Math: Math, parseInt: parseInt, __ev: ev };
    c.globalThis = c;
    vm.createContext(c);
    vm.runInContext(HELPERS + '\n' + HHMM + '\n' + fran + '\nres = _franja(__ev);', c);
    return c.res;
  }
  // Y la misma pregunta a la grilla: ¿lo pone en la franja o en el banner?
  function vaAlBanner(ev) {
    const c = { res: null, parseInt: parseInt, Number: Number, String: String, __ev: ev };
    c.globalThis = c;
    vm.createContext(c);
    vm.runInContext(HELPERS + '\nres = isAllDayEvent(__ev);', c);
    return c.res === true;
  }

  // ── EL CASO DE LA FOTO: recordatorio_presupuesto de main.js:5613-5633 ──
  const recordatorio = {
    id: 'recordatorio-presupuesto-5primerosdias-2026-10-05',
    type: 'recordatorio_presupuesto',
    title: 'Actualización de Presupuesto (5 primeros días)',
    date: '2026-10-05',
    start: '00:00', end: '23:59',
    allDay: true, color: '#10b981',
  };
  const fr = franja(recordatorio);
  chk('el recordatorio de presupuesto NO es "Todo el día" (es el caso de tu foto)',
    fr !== 'Todo el día', fr);
  chk('dice la hora con la que lo dibuja la grilla: 09:00-11:00',
    fr === '09:00–11:00', fr);

  // ── El invariante de fondo: popup y grilla, la misma respuesta ──
  // Esta es la prueba que importa. Si un dia divergen, el popup esta mintiendo.
  const casos = [
    ['recordatorio_presupuesto (main.js:5613)', recordatorio],
    ['inspeccion_programada (misma forma)', { date: '2026-10-05', title: '2. Inspecciones equipos de emergencias.', start: '00:00', end: '23:59', allDay: true }],
    ['evento con hora real 09:00-11:00', { date: '2026-10-05', start: '09:00', end: '11:00' }],
    ['evento con hora real 14:00-15:00', { date: '2026-10-05', start: '14:00', end: '15:00' }],
    ['evento con horas 11:30-13:00', { date: '2026-10-05', start: '11:30', end: '13:00' }],
    ['mock con startHour 9 duracion 1', { date: '2026-10-05', startHour: 9, durationHours: 1 }],
    ['mock con startHour 14.5 duracion 2', { date: '2026-10-05', startHour: 14.5, durationHours: 2 }],
    ['todo el dia de verdad (startHour 0, 24h)', { date: '2026-10-05', startHour: 0, durationHours: 24 }],
  ];
  let coinciden = 0;
  casos.forEach(([n, ev]) => {
    const banner = vaAlBanner(ev);
    const dice = franja(ev);
    // Si va al banner, el popup debe decir "Todo el dia"; si va a la franja,
    // el popup debe dar una hora (nunca "Todo el dia").
    const okk = banner ? dice === 'Todo el día' : (dice !== 'Todo el día' && /\d\d:\d\d/.test(dice));
    chk('popup y grilla coinciden · ' + n, okk, dice + (banner ? ' [banner]' : ' [franja]'));
    if (okk) coinciden++;
  });
  chk('los 8 casos coinciden con la grilla', coinciden === casos.length, coinciden + '/' + casos.length);

  // ── Regresion: lo que 847 ROMPIO ──
  chk('regresion · un evento con hora real nunca se declara "Todo el día"',
    franja({ start: '09:00', end: '11:00' }) !== 'Todo el día');
  chk('regresion · el evento con hora 00:00-23:59 tampoco se declara "Todo el día"',
    franja({ start: '00:00', end: '23:59' }) !== 'Todo el día',
    franja({ start: '00:00', end: '23:59' }));
  // El unico caso legitimo de "Todo el dia" sigue funcionando.
  chk('el "todo el día" real (24h) sigue declarandose',
    franja({ startHour: 0, durationHours: 24 }) === 'Todo el día');
})();

// ══ 3) Higiene ══
let netas = 0;
for (const c of t) { if (c === '{') netas++; else if (c === '}') netas--; }
chk('las llaves balancean', netas === 0, 'netas=' + netas);
const RANGO = new RegExp('[\\u4e00-\\u9fff\\u3040-\\u30ff\\u0400-\\u04ff\\uac00-\\ud7af]', 'g');
chk('sin CJK/mojibake', (t.match(RANGO) || []).length === 0);
const crlf = (t.match(/\r\n/g) || []).length, lf = (t.match(/\n/g) || []).length;
chk('EOL consistente en app.js', crlf === lf || crlf === 0, crlf + '/' + lf);

let fail = 0;
console.log('\n=======================================');
console.log('  📦848 · El popup ya no dice "Todo el día" para todo');
console.log('=======================================');
ok.forEach(x => { if (!x.c) fail++; console.log((x.c ? 'OK  ' : 'FAIL') + '  ' + x.n + (x.e ? '  [' + x.e + ']' : '')); });
console.log('---');
console.log((ok.length - fail) + '/' + ok.length + ' OK');
console.log('=======================================');
process.exit(fail === 0 ? 0 : 1);
