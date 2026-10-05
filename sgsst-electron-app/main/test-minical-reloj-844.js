'use strict';
// 📦844 · ¿El mini-calendar sigue al reloj o se queda congelado en un mes?
//
// Esta es la pregunta del owner, y no se responde leyendo el codigo: se
// ejecuta data.js con un reloj SIMULADO y se comprueba que la grilla y el
// rotulo siguen a la fecha, no a una constante.
//
// El segundo escenario es el importante y es un bug REAL que se encontro
// gracias a esta prueba:
//
//   buildMonthGrid marcaba el dia de hoy comparando contra MONTH_VIEW.todayIso,
//   y MONTH_VIEW es un objeto plano que se construye UNA vez al cargar
//   data.js. Con la app abierta y pasando la medianoche, el mini ya mostra el
//   mes nuevo (este paquete), pero el dia marcado como "hoy" se quedaba en el
//   de ayer — y si habia cambiado de mes, no se marcaba ninguno.
//
//   El fix: la fecha de hoy se calcula DENTRO de buildMonthGrid, en cada
//   llamada. Este test lo carga una vez, adelanta el reloj y comprueba que el
//   "hoy" se mueve con el — sin recargar el modulo, que es justo el caso en el
//   que fallaba.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const APP = path.join(__dirname, '..');
const DATAJS = path.join(APP, 'renderer', 'bandeja-integrada', 'data.js');
const APPJS = path.join(APP, 'renderer', 'bandeja-integrada', 'app.js');
const data = fs.readFileSync(DATAJS, 'utf8');
const app = fs.readFileSync(APPJS, 'utf8');

const checks = [];
const ok = (n, c, e) => checks.push({ name: n, ok: !!c, extra: e });

// ── Reloj simulado y MUTABLE (para poder hacer avanzar el tiempo) ──
// NO se toca Real.prototype: F.prototype ES Real.prototype, asi que
// sobrescribir un metodo ahi rompe el Date de verdad y se cicla solo.
// F devuelve un Date REAL ya fijado, cuyos metodos funcionan de forma nativa.
function relojFalso(isoInicial) {
  const Real = Date;
  const F = function () {
    const args = Array.prototype.slice.call(arguments);
    if (args.length === 0) return new Real(Real.parse(F._iso));
    return new (Function.prototype.bind.apply(Real, [null].concat(args)))();
  };
  F.prototype = Real.prototype;
  F.now = () => Real.parse(F._iso);
  F.parse = Real.parse;
  F.UTC = Real.UTC;
  F._iso = isoInicial;
  // Adelanta el reloj sin recargar nada: es lo que hace la app al seguir
  // abierta y pasar la medianoche.
  F.avanzar = (nuevaIso) => { F._iso = nuevaIso; };
  return F;
}

function cargarDataCon(reloj) {
  const c = { console: { warn: () => { }, error: () => { }, log: () => { } }, Date: reloj };
  c.window = c;
  c.globalThis = c;
  vm.createContext(c);
  vm.runInContext(data.replace(/window\.KairData\s*=/, 'var __K ='), c);
  return c.__K;
}

// ══ 1) El mini sigue al reloj: 7 fechas, includeda bisiesta y enero ══
const FECHAS = [
  { iso: '2026-10-02T10:00:00', y: 2026, m: 9, mes: 'Octubre', dias: 31 },
  { iso: '2026-11-15T10:00:00', y: 2026, m: 10, mes: 'Noviembre', dias: 30 },
  { iso: '2027-01-05T10:00:00', y: 2027, m: 0, mes: 'Enero', dias: 31 },
  { iso: '2027-03-10T10:00:00', y: 2027, m: 2, mes: 'Marzo', dias: 31 },
  { iso: '2028-02-29T10:00:00', y: 2028, m: 1, mes: 'Febrero', dias: 29 },
  { iso: '2026-12-31T23:30:00', y: 2026, m: 11, mes: 'Diciembre', dias: 31 },
  { iso: '2027-07-04T08:00:00', y: 2027, m: 6, mes: 'Julio', dias: 31 }
];
ok('el reloj simulado cubre 7 meses distintos (incluye enero y un bisiesto)', FECHAS.length === 7);

for (const f of FECHAS) {
  let K;
  try { K = cargarDataCon(relojFalso(f.iso)); }
  catch (e) { ok('reloj ' + f.iso.slice(0, 10) + ': data.js se pudo ejecutar', false, e.message); continue; }
  const dia = f.iso.slice(0, 10);
  const label = K.buildMonthLabel(f.y, f.m);
  const enMes = K.buildMonthGrid(f.y, f.m).flat().filter(c => c.inMonth);
  const marcados = K.buildMonthGrid(f.y, f.m).flat().filter(c => c.isToday).map(c => c.iso);

  ok('mes ' + dia + ': el rotulo sigue al reloj (' + f.mes + ')',
    label === f.mes + ' ' + f.y, label);
  ok('mes ' + dia + ': la grilla tiene ' + f.dias + ' dias',
    enMes.length === f.dias, enMes.length + '');
  ok('mes ' + dia + ': marca el dia de hoy',
    marcados.length === 1 && marcados[0] === dia, JSON.stringify(marcados));
}

// ══ 2) EL CASO REAL: la app abierta y pasa la medianoche ══
// Se carga data.js UNA vez con el reloj en T1, se adelanta el reloj a T2
// SIN recargar el modulo, y se comprueba que "hoy" se movio con el reloj.
(function medianoche() {
  const reloj = relojFalso('2026-10-02T23:59:00');
  const K = cargarDataCon(reloj);
  if (!K) { ok('medianoche: data.js se pudo cargar', false); return; }

  const antes = K.buildMonthGrid(2026, 9).flat().filter(c => c.isToday).map(c => c.iso);
  ok('medianoche: antes de pasar las 00:00 marca el 2 de octubre',
    antes.length === 1 && antes[0] === '2026-10-02', JSON.stringify(antes));

  // El mismo modulo, el mismo reloj simulado, ahora un dia despues.
  reloj.avanzar('2026-10-03T00:01:00');
  const despues = K.buildMonthGrid(2026, 9).flat().filter(c => c.isToday).map(c => c.iso);
  ok('medianoche: DESPUES de pasar las 00:00 marca el 3, no el 2',
    despues.length === 1 && despues[0] === '2026-10-03', JSON.stringify(despues));

  // Y cruzando el cambio de mes.
  reloj.avanzar('2026-11-01T00:05:00');
  const nuevoMes = K.buildMonthGrid(2026, 10).flat().filter(c => c.isToday).map(c => c.iso);
  ok('medianoche: cruzando de mes, el 1 de noviembre SI se marca',
    nuevoMes.length === 1 && nuevoMes[0] === '2026-11-01', JSON.stringify(nuevoMes));
})();

// ══ 3) El mini se arma con el reloj VIVO ══
const L = app.split(/\r?\n/);
// 📦858 — el `class` del mini ahora lleva un sufijo condicional, asi que el
// localizador tiene que seguir aceptando esa forma. Con el patron viejo
// `findIndex` devuelva -1, `i - 12` daba un corte negativo y `bloque` quedaba
// con una sola linea: el check fallaba por la ventana, no por el codigo.
const i = L.findIndex(s => /const mini = el\("div", \{ class: "kair-card mini"/.test(s));
const bloque = L.slice(Math.max(0, i - 14), i + 2).join('\n');
// 📦858-INVERTIDO — la regla sigue siendo la misma: el mini NO lee
// MONTH_VIEW, se dibuja con la fecha de HOY. Lo que cambió es por dónde
// llega: hoy la decisión vive en la función pura `mesDelMini()`, que recibe
// `new Date()` y devuelve el mes. El check apunta a las dos capas: que se
// siga calculando HOY en cada render, y que ese HOY llegue a la decisión.
ok('el mini usa new Date() en cada render, no MONTH_VIEW',
  /const\s+hoy\s*=\s*new Date\(\)/.test(bloque)
  && /mesDelMini\(\s*state\.calendarVisible\s*,\s*state\.miniMes\s*,\s*hoy\s*\)/.test(bloque)
  && /miniYear\s*=\s*miniVisible\.y/.test(bloque)
  && /miniMonth\s*=\s*miniVisible\.m/.test(bloque));
ok('y el codigo no vuelve a leer MONTH_VIEW.year/month para el rotulo',
  !/buildMonthLabel\(\s*state\./.test(bloque) && !/buildMonthGrid\(\s*state\./.test(bloque));

// ══ 4) El fix esta en data.js y no se puede revertir sin que se note ══
ok('buildMonthGrid calcula la fecha de hoy DENTRO de la funcion',
  /function buildMonthGrid[\s\S]{0,1200}var _ahora = new Date\(\)/.test(data));
ok('isToday usa esa fecha viva, no MONTH_VIEW.todayIso',
  /isToday:\s*iso\s*===\s*_hoyIso/.test(data) && !/isToday:\s*iso\s*===\s*MONTH_VIEW\.todayIso/.test(data));

let failed = 0;
console.log('\n=======================================');
console.log('  📦844 · ¿El mini sigue al reloj o se congela?');
console.log('=======================================');
checks.forEach(ch => {
  if (!ch.ok) failed++;
  console.log((ch.ok ? 'OK  ' : 'FALLA') + '  ' + ch.name + (ch.extra ? '  [' + ch.extra + ']' : ''));
});
console.log('---');
console.log((checks.length - failed) + '/' + checks.length + ' OK');
console.log('=======================================');
process.exit(failed === 0 ? 0 : 1);
