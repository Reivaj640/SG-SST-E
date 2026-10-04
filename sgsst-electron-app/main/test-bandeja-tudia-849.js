'use strict';
// 📦849 · Los 3 indicadores se movieron del strip de arriba al sidebar ("Tu día")
// y "Eventos críticos" se eliminó.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const APP = path.join(__dirname, '..');
const t = fs.readFileSync(path.join(APP, 'renderer', 'bandeja-integrada', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(APP, 'renderer', 'bandeja-integrada', 'premium.css'), 'utf8');
const htm = fs.readFileSync(path.join(APP, 'renderer', 'bandeja-integrada', 'index.html'), 'utf8');
const ok = [];
const chk = (n, c, e) => ok.push({ n, c: !!c, e });

function soloCodigo(x) {
  return x.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
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
const calc = soloCodigo(cuerpoDe('calcularIndicadores'));
const side = soloCodigo(cuerpoDe('renderSidebar'));
const appCod = soloCodigo(t);

// 📦853 · calcularIndicadores ahora depende de los helpers de novedad (línea
// base en localStorage) y, desde 📦854, de `_marcarNotifsCorreoLeidas` que su
// go() invoca. El sandbox de abajo corre la funcion tal cual, asi que hay que
// traer los helpers REALES desde app.js — no stubearlos: un stub que
// devolviera 0 siempre haria pasar el calculo de "nuevo" sin comprobar nada,
// que es justo el bug que estos checks tienen que cazar.
// 📦855 — `mailPasaFiltroActual` y `setMailFilter` tambien entran: el go() de
// kpi-correos ahora cambia el filtro por `setMailFilter`, no asignando a mano.
// Sin ellos el escenario muere con "setMailFilter is not defined" y no prueba
// nada del go() que este test quiere vigilar.
const HELPERS = ['_leerVistos', '_marcarVisto', '_sembrarVistos', '_marcarNotifsCorreoLeidas',
  'mailPasaFiltroActual', 'setMailFilter']
  .map((n) => soloCodigo(cuerpoDe(n))).join('\n');
const CLAVES = ['TUDIA_VISTOS']
  .map((n) => { const m = t.match(new RegExp('const ' + n + ' = [^;]+;')); return m ? soloCodigo(m[0]) : ''; })
  .join('\n');
const PRELUDEO = CLAVES + '\n' + HELPERS;
// localStorage mínimo: guarda en memoria. Si devolviera siempre null, la linea
// base nunca existiria y "nuevo" seria 0 siempre — otra forma de no comprobar.
function storageVacio() {
  const d = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(d, k) ? d[k] : null; },
    setItem: function (k, v) { d[k] = String(v); },
  };
}

// ══ 1) El strip de arriba desaparece ══
chk('ya NO existe renderKpiStrip (pintaba las tarjetas)',
  appCod.indexOf('renderKpiStrip') < 0);
chk('el HTML ya NO tiene la <section class="kpis">',
  htm.indexOf('<section class="kpis"') < 0 && htm.indexOf('id="kpi-strip"') < 0);
// 📦850 · Este regex exigía el div de apertura EXACTO, y al agregarle
// `data-sidebar="on"` (el estado inicial de la columna plegable) dejó de casar.
// El comportamiento que protege —el correo sube y gana el alto que dejaron las
// tarjetas— sigue igual, así que se toleran los atributos extra en vez de
// borrarse. Un check borrado es un hueco; uno tolerancia a los atributos sigue
// Protectiendo lo mismo.
chk('el layout principal sube solo (el correo gana el alto de las tarjetas)',
  /<div class="kair-layout" id="kair-layout"[^>]*>/.test(htm)
  && /\.kair-main\s*\{[^}]*display:\s*flex/.test(css)
  // 📦850 · El rango {0,300} se rompió solo: el comentario que documenta
  // --side-w/-pad empujó el `flex: 1` fuera de la ventana y el check se puso
  // rojo sin que el layout hubiera cambiado. Se acota a la MISMA llave del CSS
  // en vez de alargar el rango a ciegas: si `flex: 1` está en otra regla, el
  // check tiene que notarlo, porque de eso es de lo que trata.
  && /\.kair-layout\s*\{[^}]*flex:\s*1[^}]*\}/.test(css));

// ══ 2) calcularIndicadores es la fuente única ══
chk('existe calcularIndicadores()', calc.length > 400, calc.length + ' chars');
chk('la sidebar la usa para pintar las filas',
  /calcularIndicadores\(\)\.forEach/.test(side));
// 📦853 · Los 4 checks siguientes se INVIERTIERON, no se borraron. El contrato
// paso de 3 indicadores a 2 porque "Invitaciones pendientes" contaba un campo
// que ningun camino del correo real escribe. Borrar el check habria dejado de
// avisar si alguien vuelve a poner la fila con el mismo defecto.
chk('📦853 · calcula los 2 que quedan: correos y reuniones',
  /unread = state\.mails/.test(calc) && /todayEvents = state\.events/.test(calc));
chk('📦853 · ya NO calcula invitaciones (nadie escribe meetingSuggestion)',
  !/pending = state\.mails/.test(calc),
  'vuelve a contar un campo que solo existe en los datos de ejemplo');
chk('cada item trae value Y n (el n es el que decide si la fila se apaga)',
  (calc.match(/\bn: /g) || []).length === 2, (calc.match(/\bn: /g) || []).length + '');
chk('cada item trae su go() de navegación',
  (calc.match(/go: function \(\)/g) || []).length === 2,
  (calc.match(/go: function \(\)/g) || []).length + '');
// 📦853 · Este check se INVIERTIÓ, no se borró: ahora además de cambiar de
// vista, el clic de Correos tiene que APLICAR el filtro "unread".
// El rango se acota al OBJETO de kpi-correos, terminado donde empieza el
// siguiente. Prefijar `{0,600}` "para que no falle" haría que el regex pudiera
// matchear dentro de kpi-reuniones, que es justo lo que este check tiene que
// distinguir. Un rango enorme no arregla un check: le quita el diente.
const OBJ_CORREOS = (/id: "kpi-correos"[\s\S]*?(?=id: "kpi-reuniones")/).exec(calc);
const OBJ_REUNIONES = (/id: "kpi-reuniones"[\s\S]*?(?=id: "kpi-invitaciones"|\]\s*;)/).exec(calc);
const objCorreos = OBJ_CORREOS ? OBJ_CORREOS[0] : '';
const objReuniones = OBJ_REUNIONES ? OBJ_REUNIONES[0] : '';
// 📦855 — El go() ya no asigna el filtro: llama a setMailFilter, que además de
// aplicarlo suelta la selección que la lista nueva no muestra. Check invertido
// (no borrado): lo que se vigila es que el clic siga pasando por ese camino.
chk('📦853 · los ids son los de siempre y el de correo además filtra',
  /setMailFilter\("unread"\)/.test(objCorreos) && /setCalendarVisible\(false\)/.test(objCorreos)
  && /calView = "day"/.test(objReuniones)
  && !/id: "kpi-invitaciones"/.test(calc),
  'correo tiene que aplicar el filtro ademas de cambiar de vista; correos=' + JSON.stringify(objCorreos)
  + ' reuniones=' + JSON.stringify(objReuniones));
chk('📦855 · el go() de correo no asigna el filtro a mano',
  !/state\.mailFilter = /.test(objCorreos),
  'una asignacion directa se saltaria la validacion de la seleccion');

// ══ 3) Eventos críticos eliminado ══
chk('se fue el id kpi-criticos', appCod.indexOf('kpi-criticos') < 0);
chk('se fue la etiqueta "Eventos críticos"', appCod.indexOf('Eventos críticos') < 0);
chk('se fue su cálculo (criticalThisMonth / criticalSub / critical)',
  !/criticalThisMonth/.test(appCod) && !/criticalSub/.test(appCod)
  && !/critical = state\.events\.filter/.test(appCod));
chk('se fue el chip que solo existia para esa tarjeta', !/kair-kpi__chip/.test(appCod));

// ══ 4) La tarjeta de Integración correo se reemplaza ══
chk('se fue el boton "Abrir bandeja"', side.indexOf('btn-abrir-bandeja') < 0);
chk('se fue la tarjeta .sidecard', side.indexOf('sidecard') < 0);
chk('la nueva seccion se llama "Tu día"', /tuday__t">Tu día/.test(side));
chk('y usa la clase de card del sidebar (kair-card)', /class: "kair-card tuday"/.test(side));

// ══ 5) La fila: esqueleto de "Tipos de evento" pero premium ══
chk('cada fila lleva icono + nombre + contador + subtexto',
  /tuday__ico/.test(side) && /tuday__n/.test(side) && /tuday__c/.test(side) && /tuday__s/.test(side));
chk('el subtexto va DEBAJO del nombre, no al lado (a 250px el al lado aplastaba el numero)',
  /tuday__top[\s\S]{0,400}tuday__s/.test(side));
chk('un valor 0 apaga la fila entera',
  /const vacio = !it\.n/.test(side) && /tuday__i" \+ \(vacio \? " is-vacio" : ""\)/.test(side));
chk('y el 0 muestra guion, no cero (como antes)',
  /return v > 0 \? v : "—"/.test(calc));
chk('la fila completa es clicable y navega',
  /item\.addEventListener\("click", it\.go\)/.test(side));
chk('el id de cada fila se conserva (kpi-correos, etc.)',
  /id: it\.id/.test(side));

// ══ 6) El CSS ══
chk('.tuday tiene sus estilos', /\.tuday \{/.test(css) && /\.tuday__i \{/.test(css));
chk('los 3 tiles tienen color propio',
  /\.tuday__ico--blue/.test(css) && /\.tuday__ico--green/.test(css) && /\.tuday__ico--amber/.test(css));
chk('la fila vacía se atenúa', /\.tuday__i\.is-vacio \{ opacity: \.45; \}/.test(css));
chk('las filas se separan con una línea (se leen como lista, no como bloque)',
  /\.tuday__i \+ \.tuday__i \{[^}]*border-top: 1px solid/.test(css));
// OJO: se mira DENTRO de la MISMA regla .tuday__n, no con un [\s\S]{0,400} que
// se escapa a la regla siguiente. Con el rango laxo, borrar el clip de una
// regla lo dejaba "pintado" por la de al lado y el guard no mordia.
const reglaN = (css.match(/\.tuday__n \{[^}]*\}/) || [''])[0];
chk('el nombre se recorta con elipsis, no desborda la columna de 250px',
  /text-overflow:\s*ellipsis/.test(reglaN)
  && /overflow:\s*hidden/.test(reglaN)
  && /white-space:\s*nowrap/.test(reglaN)
  && /min-width:\s*0/.test(reglaN),
  reglaN.replace(/\s+/g, ' ').slice(0, 60));
chk('NO quedan los estilos muertos (.kair-kpi* y .sidecard*)',
  !/^\s*\.kair-kpi/m.test(css) && !/^\s*\.sidecard/m.test(css));
chk('el prefers-reduced-motion global sigue intacto', css.indexOf('prefers-reduced-motion') >= 0);
const vars = [...new Set([...css.slice(css.indexOf('.tuday {')).matchAll(/var\((--kair-[a-z0-9-]+)\)/g)].map(m => m[1]))];
chk('todas las variables que usa existen de verdad',
  vars.every(v => css.indexOf(v + ':') >= 0), vars.filter(v => css.indexOf(v + ':') < 0).join(',') || 'todas');

// ══ 7) FUNCIONAL · el cálculo, con datos reales ══
(function funcional() {
  function correr(mails, events, hoy) {
    const c = {
      res: null,
      state: { mails: mails, events: events },
      D: { MONTH_VIEW: { todayIso: hoy }, ICONS: { mail: '<i/>', calendarPlus: '<i/>', link: '<i/>' } },
      setCalendarVisible() { },
      // 📦854 — El go() de Correos invoca este helper. Sin bridge de
      // notificaciones sale por `getElectronAPI() === null` y no rompe nada:
      // lo que se prueba acá es la navegación, no el marcado.
      getElectronAPI() { return null; },
      window: null,
      localStorage: storageVacio(),
      String: String, Number: Number, parseInt: parseInt, parseFloat: parseFloat,
    };
    c.globalThis = c;
    vm.createContext(c);
    vm.runInContext(PRELUDEO + '\n' + calc + '\nres = calcularIndicadores().map(function (x) {'
      + ' return { id: x.id, n: x.n, value: String(x.value), label: x.label, sub: x.sub, tone: x.tone }; });', c);
    return c.res;
  }
  const HOY = '2026-10-05';
  const mail = (unread, sug) => ({ unread: unread, meetingSuggestion: sug });
  const ev = (date, start) => ({ date: date, start: start });

  // Con datos: 2 no leidos, 3 eventos hoy, 1 invitacion.
  let r = correr(
    [mail(true), mail(true), mail(false), mail(true, true)],
    [ev(HOY, '09:00'), ev(HOY, '14:00'), ev(HOY, '10:00'), ev('2026-10-09', '08:00')],
    HOY);
  chk('correos: cuenta los no leídos (3 de 4)', r[0].n === 3, r[0].n + '');
  chk('reuniones: cuenta los eventos de HOY (3, no los de otros días)', r[1].n === 3, r[1].n + '');
  // 📦853 · El indicador de "Invitaciones pendientes" se RETIRO. El check no
  // se borro: se INVERTIO. Antes afirmaba que las invitaciones contaban bien;
  // ahora afirma que la fila no existe, que es el contrato nuevo. Un check
  // borrado no avisaria si alguien la vuelve a poner con un campo que otra vez
  // nadie escribe.
  chk('📦853 · quedan 2 indicadores: invitaciones ya no está',
    r.length === 2 && !r.some((x) => x.id === 'kpi-invitaciones'),
    'n=' + r.length + ' ids=' + r.map((x) => x.id).join(','));
  chk('cada uno trae su etiqueta y su subtexto',
    r[0].label === 'Correos no leídos' && r[0].sub === '4 totales'
    && r[1].label === 'Reuniones hoy',
    JSON.stringify(r.map(x => x.sub)));
  chk('"Próxima reunión" toma la más cercana de hoy', /Próxima: 09:00/.test(r[1].sub), r[1].sub);

  // Todo en cero: guion, no 0. Y la fila se apaga (n === 0 -> !n).
  r = correr([], [], HOY);
  chk('sin nada: los 2 muestran guion, no cero',
    r.every(x => x.value === '—'), r.map(x => x.value).join(','));
  chk('sin nada: los 2 tienen n = 0 (la fila se apaga sola)',
    r.every(x => x.n === 0), r.map(x => x.n).join(','));
  chk('y el subtexto lo dice sin inventar hora', r[1].sub === 'Sin eventos próximos', r[1].sub);

  // La navegación de cada uno (esto es lo que se rompería en silencio).
  // OJO: setCalendarVisible tiene que ESCRIBIR en state. Un stub que solo
  // guarda el valor en otro lado hace invisible justo el efecto que se quiere
  // comprobar, y el check pasa/falla por el motivo equivocado.
  const navs = {};
  ['kpi-correos', 'kpi-reuniones'].forEach((id) => {
    const c = { res: null, __nav: {},
      D: { MONTH_VIEW: { todayIso: HOY }, ICONS: { mail: '<i/>', calendarPlus: '<i/>', link: '<i/>' } },
      setCalendarVisible: function (v) { c.state.calendarVisible = v; },
      getElectronAPI() { return null; },
      isThreadSnoozed() { return false; },
      window: null,
      localStorage: storageVacio(),
      String: String, Number: Number, parseInt: parseInt, parseFloat: parseFloat };
    c.state = { mails: [], events: [], calendarVisible: true, selectedDate: null, calView: 'month', mailFilter: 'all' };
    c.globalThis = c;
    vm.createContext(c);
    vm.runInContext(PRELUDEO + '\n' + calc + '\ncalcularIndicadores().forEach(function (x) {'
      + ' x.go();'
      + ' __nav[x.id] = { visible: state.calendarVisible, calView: state.calView, mailFilter: state.mailFilter };'
      + ' state.calendarVisible = true; state.calView = "month"; state.mailFilter = "all"; });'
      + '\nres = __nav;', c);
    Object.assign(navs, c.res);
  });
  chk('correos lleva a la BANDEJA (oculta el calendario)',
    navs['kpi-correos'].visible === false, JSON.stringify(navs['kpi-correos']));
  // 📦853 · Este check se INVERTIÓ, no se borró. Antes afirmaba solo que el
  // clic llegaba a la vista de correo — y eso pasaba aunque no filtrara nada,
  // que era el bug reportado. Ahora además exige el filtro "unread", que es
  // lo que el owner dijo que quería.
  chk('📦853 · correos además APLICA el filtro de no leídos (invertido)',
    navs['kpi-correos'].mailFilter === 'unread', JSON.stringify(navs['kpi-correos']));
  chk('reuniones abre el CALENDARIO en vista Día',
    navs['kpi-reuniones'].visible === true && navs['kpi-reuniones'].calView === 'day',
    JSON.stringify(navs['kpi-reuniones']));
  chk('📦853 · invitaciones ya no navega a ninguna parte',
    !Object.prototype.hasOwnProperty.call(navs, 'kpi-invitaciones'),
    'volvió una fila que cuenta un campo que nadie escribe');
  // Las dos que quedan tienen que ser DISTINTAS. Es el invariante de fondo: si
  // las dos apuntaran a lo mismo, el sidebar mostraria dos filas que hacen lo
  // mismo. Y ahora además una filtra por lectura y la otra cambia de vista.
  chk('las 2 van a sitios distintos (correo+unread oculta, día abre)',
    navs['kpi-correos'].visible === false
    && navs['kpi-correos'].mailFilter === 'unread'
    && navs['kpi-reuniones'].calView === 'day'
    && navs['kpi-reuniones'].mailFilter === 'all');
})();

// ══ 8) Higiene ══
let netas = 0;
for (const c of t) { if (c === '{') netas++; else if (c === '}') netas--; }
chk('las llaves balancean', netas === 0, 'netas=' + netas);
const RANGO = new RegExp('[\\u4e00-\\u9fff\\u3040-\\u30ff\\u0400-\\u04ff\\uac00-\\ud7af]', 'g');
chk('sin CJK/mojibake', (t.match(RANGO) || []).length + (css.match(RANGO) || []).length
  + (htm.match(RANGO) || []).length === 0);
const crlf = (t.match(/\r\n/g) || []).length, lf = (t.match(/\n/g) || []).length;
chk('EOL consistente en app.js', crlf === lf || crlf === 0, crlf + '/' + lf);
// 📦850 · Este check se desató del nombre del paquete. Antes pedía literally
// "-tu-dia", o sea que CADA bump tenía que editar este test o quedaba rojo
// por un motivo que no era un bug. Ahora valida lo que de verdad importa: que
// el token tenga forma de token y que los dos archivos lleven el MISMO.
const tokCss = (htm.match(/premium\.css\?v=([\w-]+)/) || [])[1] || '';
const tokJs = (htm.match(/app\.js\?v=([\w-]+)/) || [])[1] || '';
chk('cache-bust de app.js y premium.css actualizado',
  /^\d{8}-[\w-]+$/.test(tokCss) && tokCss === tokJs,
  'premium=' + tokCss + ' app=' + tokJs);

let fail = 0;
console.log('\n=======================================');
console.log('  📦849 · Indicadores al sidebar ("Tu día")');
console.log('=======================================');
ok.forEach(x => { if (!x.c) fail++; console.log((x.c ? 'OK  ' : 'FAIL') + '  ' + x.n + (x.e ? '  [' + x.e + ']' : '')); });
console.log('---');
console.log((ok.length - fail) + '/' + ok.length + ' OK');
console.log('=======================================');
process.exit(fail === 0 ? 0 : 1);
