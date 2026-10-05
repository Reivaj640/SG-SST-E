'use strict';
// 📦855 · La bandeja no abre un correo que el owner no eligio.
//
// Sintoma reportado: al abrir la bandeja de correo ya aparecia un mensaje
// abierto en el panel derecho sin haberlo seleccionado. Ocurria al entrar por
// "Correos no leidos" y tambien en Recibidos/Enviados.
//
// Habia DOS causas, y la segunda es la que se ve en la captura:
//
//  1. `init()` hacia `selectMail(state.mails[0].id)`. Eso auto-seleccionaba el
//     primer correo, y `selectMail` marca como leido (`mail.unread = false`),
//     asi que ABRIR LA APP metia un correo a "leidos" sin que nadie lo abriera.
//     Ademas el respaldo era `state.selectedMailId = "m1"`, un id de mock.
//
//  2. `renderMailDetail` buscaba el seleccionado en `state.mails` SIN mirar el
//     filtro, mientras `renderMailList` si lo miraba. Por eso el panel podia
//     mostrar un correo que la lista ya no mostraba: es exactamente lo de la
//     captura, "Prueba 5" abierta mientras la lista mostraba otros cuatro.
//
// Mismo diseno que 850/851/853: evaluar(htm, css, js) -> {f, n} para mutar en
// memoria, normalizacion a LF ANTES de mutar, y guard de mutante vacio.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const DIR = path.join(__dirname, '..', 'renderer', 'bandeja-integrada');
const RANGO_CJK = new RegExp('[\\u4e00-\\u9fff\\u3040-\\u30ff\\u0400-\\u04ff\\uac00-\\ud7af]', 'g');

function soloCodigo(x) {
  return x.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
}
function eolDe(s) {
  const c = (s.match(/\r\n/g) || []).length;
  const l = (s.match(/\n/g) || []).length;
  return c > 0 && c === l ? 'CRLF' : (c === 0 ? 'LF' : 'MIXTO');
}

function evaluar(htm, css, js) {
  const fallos = [];
  let n = 0;
  const chk = (nombre, c, e) => { n++; if (!c) fallos.push(nombre + (e ? '  [' + e + ']' : '')); };
  const cod = soloCodigo(js);

  // ══ 1) init() NO auto-selecciona ══
  // Estos checks miran el INVARIANTE, no la forma que tenía el bug. Un check
  // tipo `!/if (state.mails[0]) { selectMail/` solo reconoce la redacción
  // exacta del bug pasado: si alguien lo reescribe como
  // `selectedMailId = state.mails[0] ? ... : "m1"`, el check pasa y el bug
  // vuelve. Por eso la pregunta es "¿alguna vez la selección se deriva de la
  // lista?", que no depende de cómo esté escrito.
  chk('la seleccion nunca se deriva de state.mails (eso ES el auto-seleccion)',
    !/state\.selectedMailId = [^;]*state\.mails/.test(cod),
    'derivar la seleccion de la lista vuelve a abrir un correo sin pedirlo');
  chk('no queda el respaldo con el id de mock "m1"',
    !/selectedMailId = "m1"/.test(cod),
    '"m1" es un id de ejemplo: sin correos la app apuntaba a un mensaje inexistente');
  chk('init() arranca con la seleccion en null',
    /state\.selectedMailId = null;/.test(cod),
    'la bandeja debe abrir en blanco, no con un mensaje abierto');

  // ══ 2) El filtro tiene UN solo predicado, compartido ══
  chk('existe el predicado compartido mailPasaFiltroActual',
    /function mailPasaFiltroActual\(m\)/.test(cod),
    'sin el, el detalle no puede preguntar si el mensaje sigue visible');
  // 📦858 — El ancla se especifica en `const filtered = ...`, no en la expresión
  // suelta. 858 añadió un segundo uso legitimo del predicado compartido (el
  // contador de la fila del filtro por dia), y con el ancla suelta este check
  // seguia encontrandolo ahi: el mutante rompia la lista y el check pasaba.
  chk('la lista se construye con el predicado compartido',
    /const filtered = state\.mails\.filter\(mailPasaFiltroActual\)/.test(cod),
    'si la lista usa un filtro propio, el detalle ya no puede compararse con ella');
  // 📦858-INVERTIDO — el patrón perdió el `return` y el sentido no cambió.
  // La regla que este check protege es "el filtro de no leídos está escrito
  // en UN solo lugar": si aparece dos veces, las dos copias se pueden separar
  // con el tiempo y la lista y el detalle dejan de coincidir. Lo que cambió
  // es la FORMA, porque un `return` por chip se tragaba el filtro por día del
  // mini-calendario (ver 📦858): ahora el chip asigna y el día se suma encima.
  chk('el filtro "unread" no queda escrito dos veces',
    (cod.match(/mailFilter === "unread"\)/g) || []).length === 1,
    'dos copias del filtro = dos verdades que se pueden separar con el tiempo');
  chk('📦858 · y el chip NO usa return temprano (si no, se come el filtro por día)',
    !/mailFilter === "(unread|flagged|meeting)"\)\s*return/.test(cod),
    'un return por chip saca la funcion antes de comparar la fecha: "no leidos del 3 de octubre" saldria como "no leidos del mes"');
  // El snooze se queda en el predicado compartido. El escenario no lo puede
  // cubrir (su `isThreadSnoozed` devuelve siempre false), asi que sin este
  // check la mutacion que lo borra pasaria sin que nadie la note.
  chk('el predicado compartido conserva el filtro de snoozed',
    /if \(state\.mailFilter !== "sent" && isThreadSnoozed\(m\.id\)\) return false;/.test(cod),
    'sin snooze, un correo aplazado aparece en la lista antes de tiempo');

  // ══ 3) Cambiar de filtro suelta la seleccion que quedo fuera ══
  chk('existe setMailFilter', /function setMailFilter\(f\)/.test(cod));
  chk('setMailFilter suelta la seleccion que ya no pasa el filtro',
    /if \(sel && !mailPasaFiltroActual\(sel\)\) state\.selectedMailId = null;/.test(cod),
    'sin esto el panel muestra un correo que la lista no muestra');
  chk('los tres caminos de cambio de filtro pasan por setMailFilter',
    (cod.match(/state\.mailFilter = /g) || []).length === 1
      && /setMailFilter\("unread"\);/.test(cod)
      && /setMailFilter\(f\.id\);/.test(cod),
    'solo puede quedar la asignacion DENTRO de setMailFilter');

  // ══ 4) El clic explicito sigue funcionando ══
  chk('selectMail sigue seleccionando lo que el owner elige',
    /function selectMail\(id\) \{\s*state\.selectedMailId = id;/.test(cod),
    'el arreglo no puede dejar la bandeja sin poder abrir correos');
  chk('selectMail sigue marcando como leido al abrir un correo',
    /if \(mail\) mail\.unread = false;/.test(cod),
    'abrir un correo SI debe marcarlo leido; lo que no debe es hacerlo al arrancar');
  chk('la seleccion NO se valida dentro de renderMailDetail',
    !/renderMailDetail[\s\S]{0,400}mailPasaFiltroActual/.test(cod),
    'si se validara en el render, el correo abierto se borraria al marcarlo leido');

  // ══ 5) El estado vacio del detalle sigue existiendo ══
  chk('el detalle ofrece el estado vacio cuando no hay seleccion',
    /Seleccione un mensaje para leerlo/.test(cod),
    'es lo que el owner debe ver al abrir la bandeja');

  return { f: fallos.length, n, fallos };
}

// ═══════════ funcional: el escenario que se reporto ═══════════
// Corre sobre el archivo REAL con un sandbox, arrancando con la seleccion en
// el estado en que la dejaba el bug: un mensaje abierto que el filtro actual
// no muestra.
function escenario(js) {
  const fallos = [];
  let n = 0;
  const chk = (nombre, c, e) => { n++; if (!c) fallos.push(nombre + (e ? '  [' + e + ']' : '')); };

  // El predicado depende de `state` y de `isThreadSnoozed`; el resto son
  // puros. Se arma un sandbox minimo con esas dos cosas.
  //
  // Las dos funciones TIENEN que estar al mismo nivel (2 espacios). Si una
  // quedara anidada dentro de otra, el sandbox la traeria igual y el test
  // pasaria con un archivo que en la app real revienta con ReferenceError.
  // Por eso se exige el nivel explicitamente en vez de recortar sin mirar.
  const partes = ['mailPasaFiltroActual', 'setMailFilter'];
  let codigo = '';
  for (const nombre of partes) {
    // Debe arrancar en columna 2: si esta anidada, daria ReferenceError.
    const re = new RegExp('^  function ' + nombre + '\\([\\s\\S]*?\\n  \\}', 'm');
    const m = js.match(re);
    if (!m) {
      chk('"' + nombre + '()" existe y esta a nivel de funcion (2 espacios)', false,
        'anidada dentro de otra, en la app real daria ReferenceError');
      return { f: fallos.length, n, fallos };
    }
    codigo += m[0] + '\n';
  }
  chk('las dos funciones existen al mismo nivel (no anidadas)', true);

  const nuevo = (filtro, selected, mails) => {
    const sb = {
      state: { mailFilter: filtro, selectedMailId: selected, mails: mails },
      isThreadSnoozed: () => false,
      Number: Number, Boolean: Boolean, Array: Array, Object: Object,
    };
    sb.globalThis = sb;
    vm.createContext(sb);
    vm.runInContext(codigo, sb);
    sb.paso = (e) => vm.runInContext('res = ' + e + ';', sb);
    return sb;
  };
  const ver = (sb) => sb.res;

  const leido = { id: 'a', unread: false, subject: 'Prueba 5' };
  const noLeido = { id: 'b', unread: true, subject: 'Prueba 4' };

  try {
    // El caso EXACTO de la captura: hay un correo abierto, pero el filtro
    // activo es "unread" y ese correo no es no leido. La lista no lo muestra.
    let sb = nuevo('unread', 'a', [leido, noLeido]);
    chk('el correo abierto NO esta en la lista del filtro actual',
      !mailPasaTexto(sb, leido),
      'si pasara el filtro, la captura no se explicaria');
    sb.paso('state.selectedMailId');
    chk('antes del cambio de filtro la seleccion sigue puesta', ver(sb) === 'a',
      'el sandbox arranca con la seleccion en ' + JSON.stringify(ver(sb)));

    // Cambiar de filtro (o volver a aplicar el mismo) debe soltarla.
    sb.paso('(function(){ setMailFilter("unread"); return state.selectedMailId; })()');
    chk('📦855 · al aplicar el filtro la seleccion se suelta',
      ver(sb) === null, 'quedo en ' + JSON.stringify(ver(sb)) + ' (eso es el bug reportado)');

    // Y al revés: si el mensaje ABIERTO si pasa el filtro, se conserva.
    sb = nuevo('unread', 'b', [leido, noLeido]);
    sb.paso('(function(){ setMailFilter("unread"); return state.selectedMailId; })()');
    chk('una seleccion que SI pasa el filtro se conserva',
      ver(sb) === 'b', 'quedo en ' + JSON.stringify(ver(sb)));

    // Y una seleccion valida no se toca al cambiar a un filtro que tambien la
    // contiene (el caso normal de "Todos").
    sb = nuevo('all', 'a', [leido, noLeido]);
    sb.paso('(function(){ setMailFilter("all"); return state.selectedMailId; })()');
    chk('en "Todos" la seleccion se conserva', ver(sb) === 'a');

    // Sin seleccion no se rompe nada.
    sb = nuevo('all', null, [leido, noLeido]);
    sb.paso('(function(){ setMailFilter("unread"); return state.selectedMailId; })()');
    chk('sin seleccion previa, cambiar de filtro no inventa ninguna',
      ver(sb) === null);
  } catch (e) {
    chk('el escenario corre sin romperse', false, e.message);
  }

  return { f: fallos.length, n, fallos };
}
function mailPasaTexto(sb, m) {
  sb.paso('(function(){ return mailPasaFiltroActual(state.mails[0]); })()');
  return sb.res;
}

const crudo = {
  htm: fs.readFileSync(path.join(DIR, 'index.html'), 'utf8').replace(/\r\n/g, '\n'),
  css: fs.readFileSync(path.join(DIR, 'premium.css'), 'utf8').replace(/\r\n/g, '\n'),
  js: fs.readFileSync(path.join(DIR, 'app.js'), 'utf8').replace(/\r\n/g, '\n'),
};

const real = evaluar(crudo.htm, crudo.css, crudo.js);
const esc = escenario(crudo.js);
real.n += esc.n;
real.f += esc.f;
real.fallos = real.fallos.concat(esc.fallos);

[['app.js sigue en CRLF', eolDe(fs.readFileSync(path.join(DIR, 'app.js'), 'utf8')), 'CRLF'],
 ['premium.css sigue en LF', eolDe(fs.readFileSync(path.join(DIR, 'premium.css'), 'utf8')), 'LF'],
 ['sin CJK en app.js', (fs.readFileSync(path.join(DIR, 'app.js'), 'utf8').match(RANGO_CJK) || []).length, 0],
 ['sin CJK en este test', (fs.readFileSync(__filename, 'utf8').match(RANGO_CJK) || []).length, 0],
].forEach((e) => {
  real.n++;
  if (e[1] !== e[2]) { real.f++; real.fallos.push(e[0] + '  [' + e[1] + ', esperado ' + e[2] + ']'); }
});

// ═══════════════ mutation testing ═══════════════
const MUT = [
  ['init() vuelve a auto-seleccionar el primer correo (vuelve el bug reportado)',
    j => j.replace('state.selectedMailId = null;', 'state.selectedMailId = state.mails[0] ? state.mails[0].id : "m1";')],
  ['vuelve el id de mock "m1" como respaldo',
    j => j.replace('state.selectedMailId = null;', 'state.selectedMailId = state.mails.length ? null : "m1";')],
  // 📦858 — Estas tres anclas perdieron singularidad: 858 añadió código con la
  // MISMA línea y `String.replace` con string cambia SOLO la primera
  // ocurrencia. El mutante rompía la copia nueva de 📦858 y dejaba intacta la
  // de 855, así que el mutante pasaba sin que nadie lo notara. El ancla va con
  // el CONTEXTO que la distingue (el `const` de 4 espacios de `setMailFilter`,
  // el `const filtered =` de `renderMailList`), no con la línea sola.
  ['setMailFilter deja de soltar la seleccion que quedo fuera (vuelve el bug)',
    j => j.replace('    const sel = state.mails.find(function (m) { return m.id === state.selectedMailId; });\n'
      + '    if (sel && !mailPasaFiltroActual(sel)) state.selectedMailId = null;', '')],
  ['setMailFilter suelta la seleccion SIEMPRE, aunque siga visible (rompe abrir correos)',
    j => j.replace('    if (sel && !mailPasaFiltroActual(sel)) state.selectedMailId = null;\n  }',
      '    state.selectedMailId = null;\n  }')],
  ['setMailFilter no cambia el filtro, solo suelta la seleccion',
    j => j.replace('  function setMailFilter(f) {\n    state.mailFilter = f;', '  function setMailFilter(f) {')],
  ['la lista deja de usar el predicado compartido (vuelven dos verdades)',
    j => j.replace('const filtered = state.mails.filter(mailPasaFiltroActual).filter((m) => {',
      'const filtered = state.mails.filter(function (m) { return state.mailFilter === "unread" ? m.unread : true; }).filter((m) => {')],
  // 📦858 — el ancla sigue a la forma nueva. Con la forma vieja este
  // mutante salía VACÍO (el `replace` no encontraba nada), y un mutante vacío
  // se reporta como "el check no muerde": parece que el check es flojo cuando
  // en realidad nadie lo probó.
  ['el filtro "unread" del predicado compartido se invierte',
    j => j.replace('if (state.mailFilter === "unread") pasa = !!m.unread;',
      'if (state.mailFilter === "unread") pasa = !m.unread;')],
  ['un filtro deja de aplicar el snooze',
    j => j.replace('if (state.mailFilter !== "sent" && isThreadSnoozed(m.id)) return false;', '')],
  ['selectMail deja de marcar como leido (el clic deja de contar como abrir)',
    j => j.replace('if (mail) mail.unread = false;', '')],
  ['selectMail deja de seleccionar (la bandeja no abre correos)',
    j => j.replace('function selectMail(id) {\n    state.selectedMailId = id;',
      'function selectMail(id) {')],
];

// Las mutaciones se cuentan APARTE de los checks. Sumarlas a `real.f` invertido
// (sumar cuando la mutacion SI se detecta) hace que el numero de checks verde
// mienta. Se reportan por separado, como en 850/851/853.
let mFallos = 0;
let vacios = 0;
MUT.forEach((m) => {
  const mut = m[1](crudo.js);
  if (mut === crudo.js) {
    vacios++;
    mFallos++;
    console.log('FAIL MUTANTE VACIO  ' + m[0] + '   [la mutacion no cambio nada]');
    return;
  }
  const d = evaluar(crudo.htm, crudo.css, mut).f + escenario(mut).f;
  if (d === 0) mFallos++;
  console.log((d > 0 ? 'OK  detecta      ' : 'FAIL NO muerde   ') + m[0]);
});

console.log('---');
console.log('checks: ' + (real.n - real.f) + '/' + real.n
  + '  ·  mutaciones detectadas: ' + (MUT.length - mFallos) + '/' + MUT.length
  + (vacios ? '  ·  mutantes vacios: ' + vacios : ''));
if (real.f || mFallos) {
  if (real.f) {
    console.log('FALLOS:');
    real.fallos.forEach((f) => console.log('  - ' + f));
  }
  process.exit(1);
}
console.log('OK');
