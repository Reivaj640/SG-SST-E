'use strict';
// 📦845 · Verificacion del doble clic del mini-calendar.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const APP = path.join(__dirname, '..');
const APPJS = path.join(APP, 'renderer', 'bandeja-integrada', 'app.js');
const t = fs.readFileSync(APPJS, 'utf8');
const L = t.split(/\r?\n/);

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
const sel = soloCodigo(cuerpoDe('seleccionarDiaDelMini'));

// ── 1) Estructura ──
chk('existe seleccionarDiaDelMini(iso, irAVistaDia)', sel.length > 100, sel.length + ' chars');
chk('fija selectedDate', /state\.selectedDate = iso/.test(sel));
chk('lleva el calendario grande a ese dia (año y mes)',
  /state\.viewYear = y/.test(sel) && /state\.viewMonth = m/.test(sel)
  && /state\.viewMonthLabel = D\.buildMonthLabel\(y, m\)/.test(sel));
chk('y con irAVistaDia pasa a la vista Dia', /if \(irAVistaDia\) state\.calView = "day"/.test(sel));
chk('el re-asignado de mes es condicional (no-op si ya estaba ahi)',
  /if \(state\.viewYear !== y \|\| state\.viewMonth !== m\)/.test(sel));

// ── 2) La deteccion del doble clic ──
chk('el clic compara contra el dia anterior para detectar el doble',
  /const esDoble = _miniDiaIso === c\.iso && \(ahora - _miniDiaT\) < MINI_DOBLE_MS/.test(mini));
chk('y guarda el dia y la hora para la proxima pulsacion',
  /_miniDiaIso = c\.iso/.test(mini) && /_miniDiaT = ahora/.test(mini));
// OJO: esto va con el numero LEIDO y comparado, no con un /\d{3,4}/. Un
// regex sin ancla hace match con los primeros 4 digitos de "999999", asi que
// una ventana infinita pasaba el guard sin que nadie lo notara. Y la prueba
// funcional usa un 350 literal a proposito (testea el ALGORITMO, no la
// constante), asi que el valor real lo tiene que guardar este check.
const msVentana = Number((/MINI_DOBLE_MS\s*=\s*(\d+)/.exec(t) || [])[1]);
chk('la ventana del doble clic esta acotada (ni instantanea ni infinita)',
  msVentana >= 200 && msVentana <= 600, msVentana + 'ms');
chk('el clic simple NO espera (no hay setTimeout que lo difiera)',
  !/setTimeout[\s\S]{0,200}seleccionarDiaDelMini/.test(mini));

// ── 3) NO debe usar dblclick nativo (no funcionaria con este DOM) ──
chk('NO usa addEventListener("dblclick") — con este render() no se dispararia',
  !/addEventListener\(\s*["']dblclick["']/.test(mini));

// ── 4) El title lo anuncia ──
chk('el title del dia dice que hay doble clic',
  /doble clic para ver el d[ií]a/.test(mini));

// ══ 5) FUNCIONAL · la maquina de estados del doble clic ══
// Se saca la logica tal cual esta en el codigo y se corre en una vm con un
// reloj controlado: dos clics seguidos -> vista Dia; dos clics con pausa ->
// vista Mes.
(function funcional() {
  const logica = `
    var _miniDiaIso = null;
    var _miniDiaT = 0;
    var MINI_DOBLE_MS = 350;
    var Date = __Date;
    function click(iso) {
      var ahora = Date.now();
      var esDoble = _miniDiaIso === iso && (ahora - _miniDiaT) < MINI_DOBLE_MS;
      _miniDiaIso = iso;
      _miniDiaT = ahora;
      return esDoble;
    }
  `;
  function correr(ahoraIso, pasos) {
    const Real = Date;
    const c = { __Date: { now: () => Real.parse(ahoraIso) }, res: [] };
    c.globalThis = c;
    vm.createContext(c);
    vm.runInContext(logica + '\n' + pasos, c);
    return c.res;
  }
  const caso = (p) => [
    'res.push(click("2026-10-15"));',
    p,
    'res.push(click("2026-10-15"));'
  ].join('\n');

  // Dos clics con 80ms: doble clic -> vista Dia
  const r1 = correr('2026-10-02T10:00:00', caso(''));
  chk('un clic solo NO va a vista Dia', r1[0] === false, JSON.stringify(r1));
  chk('dos clics seguidos (sin mover el reloj) SÍ van a vista Dia', r1[1] === true, JSON.stringify(r1));

  // Dos clics separados por 2 segundos: no es doble -> sigue en vista Mes
  // (el reloj se cambia entre medio con otro caso)
  const logica2 = `
    var _miniDiaIso = null;
    var _miniDiaT = 0;
    var MINI_DOBLE_MS = 350;
    var T = 0;
    var Date = { now: function(){ return T; } };
    function click(iso) {
      var ahora = Date.now();
      var esDoble = _miniDiaIso === iso && (ahora - _miniDiaT) < MINI_DOBLE_MS;
      _miniDiaIso = iso;
      _miniDiaT = ahora;
      return esDoble;
    }
  `;
  function correr2(pasos) {
    const c = { res: [] };
    c.globalThis = c;
    vm.createContext(c);
    vm.runInContext(logica2 + '\n' + pasos, c);
    return c.res;
  }
  const r2 = correr2([
    'T = 1000; res.push(click("2026-10-15"));',
    'T = 3000; res.push(click("2026-10-15"));'
  ].join('\n'));
  chk('dos clics separados por 2s NO cuentan como doble (queda en vista Mes)',
    r2[0] === false && r2[1] === false, JSON.stringify(r2));

  // Dias distintos: 15 y despues 16 -> no es doble
  const r3 = correr2([
    'T = 1000; res.push(click("2026-10-15"));',
    'T = 1100; res.push(click("2026-10-16"));'
  ].join('\n'));
  chk('clic en dias distintos NO cuenta como doble', r3[1] === false, JSON.stringify(r3));

  // 15 -> 16 -> 15 son TRES clics, no un doble. El segundo pisa el dia
  // remembered, asi que el tercero vuelve a ser un clic simple. Lo que se
  // busca es que no salte a vista Dia por una secuencia que el usuario no
  // quiso decir.
  const r4 = correr2([
    'T = 1000; res.push(click("2026-10-15"));',
    'T = 1100; res.push(click("2026-10-16"));',
    'T = 1200; res.push(click("2026-10-15"));'
  ].join('\n'));
  chk('15 -> 16 -> 15 NO es doble clic (son tres clics distintos)',
    r4[0] === false && r4[1] === false && r4[2] === false, JSON.stringify(r4));

  // Y el caso que SI debe contar: dos clics sobre el mismo dia separados por
  // justo menos de la ventana.
  const r5 = correr2([
    'T = 1000; res.push(click("2026-10-20"));',
    'T = 1000 + MINI_DOBLE_MS - 1; res.push(click("2026-10-20"));'
  ].join('\n'));
  chk('dos clics sobre el mismo dia, dentro de la ventana, SÍ son doble',
    r5[0] === false && r5[1] === true, JSON.stringify(r5));

  // Justo en el borde: a los 350ms exactos ya NO es doble (la ventana es
  // estricta, "<" y no "<="). Fijarlo evita que el comportamiento cambie
  // segun como se redondee el reloj del sistema.
  const r6 = correr2([
    'T = 1000; res.push(click("2026-10-21"));',
    'T = 1000 + MINI_DOBLE_MS; res.push(click("2026-10-21"));'
  ].join('\n'));
  chk('justo en el borde de la ventana ya NO es doble (es estricta)',
    r6[1] === false, JSON.stringify(r6));
})();

// ══ 6) La vista Dia existe y se llega a ella ══
chk('existe renderDayView() en el calendario grande',
  /function renderDayView\(/.test(t));
chk('la vista Dia dibuja la franja horaria (eventos por hora)',
  /renderDayView[\s\S]{0,3000}getHours\(\)|renderDayView[\s\S]{0,3000}hour/.test(t));
chk('y el toolbar ofrece la vista Dia',
  /data-view="day"/.test(t) || /"day" \? "D/.test(t));

// ══ 7) Higiene ══
let netas = 0;
for (const c of t) { if (c === '{') netas++; else if (c === '}') netas--; }
chk('las llaves balancean', netas === 0, 'netas=' + netas);
const cjk = (t.match(/[\u4e00-\u9fff\u3040-\u30ff\u0400-\u04ff\uac00-\ud7af]/g) || []).length;
chk('sin CJK/mojibake', cjk === 0, 'CJK=' + cjk);
const crlf = (t.match(/\r\n/g) || []).length, lf = (t.match(/\n/g) || []).length;
chk('EOL consistente', crlf === lf || crlf === 0, crlf + '/' + lf);

let fail = 0;
console.log('\n=======================================');
console.log('  📦845 · Doble clic en el mini → vista Dia');
console.log('=======================================');
ok.forEach(x => { if (!x.c) fail++; console.log((x.c ? 'OK  ' : 'FAIL') + '  ' + x.n + (x.e ? '  [' + x.e + ']' : '')); });
console.log('---');
console.log((ok.length - fail) + '/' + ok.length + ' OK');
console.log('=======================================');
process.exit(fail === 0 ? 0 : 1);
