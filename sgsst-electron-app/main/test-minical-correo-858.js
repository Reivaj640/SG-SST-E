'use strict';
// 📦858 · El mini-calendario tiene DOS comportamientos, según la pestaña activa.
//
// Lo que pidió el owner: en Agenda el mini sigue mostrando eventos por tipo
// (o sea, se queda como estaba); en Correo el mini es un selector de día y al
// elegir un día la bandeja muestra los correos de ese día. Y tiene que poder
// ir hacia atrás de mes, porque la mayor parte del correo es viejo.
//
// Tres cosas que este test existe para que no se rompan:
//
//  1. `mail.date` NO es una fecha ISO. La BD guarda epoch en MILISEGUNDOS
//     (1791068562000, 13 dígitos). Un `SUBSTR(1,10)` agruparía por los
//     primeros 10 dígitos del número, no por el día.
//  2. El filtro por día tiene que COMPOINERSE con el chip activo. La primera
//     versión usaba `return` temprano por chip y eso se tragaba el día:
//     "no leídos del 3 de octubre" devolvía los no leídos de todo el mes.
//  3. Los correos del día no siempre están en memoria: la app carga 25 de los
//     131 que hay en INBOX, y hay días con 12 que no están cargados. Sin el
//     rango de fechas en la consulta, elegir ese día respondería "sin correos"
//     teniendo 12.
//
// El builder del WHERE se EXTRAE del archivo real y se ejecuta contra un
// SQLite en memoria: probar una copia de la lógica sería probar la copia.
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DIR = path.join(__dirname, '..', 'renderer', 'bandeja-integrada');
const MAIN = path.join(__dirname, '..', 'main');
const APP = path.join(DIR, 'app.js');
const CSS = path.join(DIR, 'premium.css');
const DBJS = path.join(MAIN, 'email-db.js');

const js = fs.readFileSync(APP, 'utf8');
const css = fs.readFileSync(CSS, 'utf8');
const dbjs = fs.readFileSync(DBJS, 'utf8');

// Los comentarios se quitan antes de matchear. En este repo los comentarios
// del CSS y del JS describen el arreglo y MENCIONAN la cosa que el check
// busca: sin esto un check se satisface con su propio comentario y pasa
// aunque la declaración se haya roto.
function soloCodigo(x) {
  return x.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
}
function sinComentarios(x) {
  return x.replace(/\/\*[\s\S]*?\*\//g, '');
}
// Para MUTAR hay que normalizar a LF: si no, un replace sobre un archivo
// CRLF no encuentra el ancla y el mutante sale vacío (que se reporta como
// "el check no muerde" y es un falso positivo). El EOL se verifica aparte,
// contra el crudo.
function aLF(x) { return x.replace(/\r\n/g, '\n'); }
function eolDe(s) {
  const c = (s.match(/\r\n/g) || []).length;
  const l = (s.match(/\n/g) || []).length;
  return c > 0 && c === l ? 'CRLF' : (c === 0 ? 'LF' : 'MIXTO');
}

// Caracteres que SI son válidos en este repo, por RANGO. La lista de
// "prohibidos" historically era incompleta: los tamiles y el devanagari NO
// estan en los rangos CJK/cirilico/hangul y se colaron en un mensaje de
// commit. Acá se listan los PERMITIDOS y salta todo lo demas.
//
// Los rangos de abajo no son una lista de "malos conocidos": son la
// puntuación y los emoji que el repo ya usa en todos lados (raya, punto medio,
// flecha, guion de caja, y los iconos 📦 🔒 ⚪). Sin ellos el check marcaba
// como raros archivos que llevan años limpios, y un verificador que grita
// siempre termina ignorandose.
const PERMITIDOS = [
  [0x0020, 0x007E],  // ASCII imprimible
  [0x00A1, 0x00FF],  // ¡ ¿ á é í ó ú ü ñ « » × ÷ ° § ·
  [0x2010, 0x2027],  // – — ' ' " " … •
  [0x2030, 0x203B],  // ‰ ‹ ›
  [0x2190, 0x21FF],  // ← ↑ → ↓ ↔
  [0x2200, 0x22FF],  // ≤ ≥ ⋮ (operadores matemáticos)
  [0x2460, 0x24FF],  // ① ⓘ
  [0x2500, 0x257F],  // ─ │ ┌ ┐ └ ┘ ═
  [0x25A0, 0x26FF],  // ● ○ ⚪ ✓
  [0x2700, 0x27FF],  // ✅ ⚠ ✏ ⟳
  [0x1F1E6, 0x1F1FF], // 🇨 🇴 (indicadores regionales: banderas)
  [0x1F300, 0x1FAFF], // 📦 🔒 y el resto de emoji
  [0xFE00, 0xFE0F],  // selector de variacion (el que hace el emoji de colores)
];
function esPermitido(cp) {
  for (const [a, b] of PERMITIDOS) if (cp >= a && cp <= b) return true;
  return false;
}
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

// ══════════ 1) Las funciones puras existen y se extraen del archivo real ══════════
// El extractor exige NIVEL DE FUNCIÓN (2 espacios exactos). Si alguien anida
// una de estas dentro de otra, el extractor no la encuentra y el test falla a
// propósito: es el detector barato del error de alcance de §5.13, que
// `node --check` no caza porque es JavaScript válido.
function extraer(nombre, fuente) {
  const m = fuente.match(new RegExp('^  function ' + nombre + '\\([\\s\\S]*?\\n  \\}', 'm'));
  return m ? m[0] : null;
}
const puras = ['mailDiaDe', 'rangoDiaMs', 'mesDelMini', 'mesDesplazado', 'isoDe'];
const codigoPuro = puras.map((nm) => extraer(nm, aLF(cod))).join('\n');
chk('las 5 funciones puras se extraen del archivo real, a nivel de función',
  puras.every((nm) => extraer(nm, aLF(cod)) !== null),
  'faltan: ' + puras.filter((nm) => !extraer(nm, aLF(cod))).join(', '));

const fnPuras = new Function(codigoPuro + '\nreturn { mailDiaDe: mailDiaDe, rangoDiaMs: rangoDiaMs, mesDelMini: mesDelMini, mesDesplazado: mesDesplazado, isoDe: isoDe };');
const P = fnPuras();

// ══════════ 2) mailDiaDe: epoch en ms, no ISO ══════════
const MS_3_OCT_2302 = Date.UTC(2026, 9, 3, 23, 2, 42);   // 18:02 en Colombia
const MS_4_OCT_0200 = Date.UTC(2026, 9, 4, 2, 0, 0);     // 21:00 del 3 en Colombia
chk('📦858 · un epoch en ms se convierte al día local correcto',
  P.mailDiaDe({ date: MS_3_OCT_2302 }) === '2026-10-03',
  'dio=' + P.mailDiaDe({ date: MS_3_OCT_2302 }));
chk('un correo a las 02:00 UTC es del DÍA ANTERIOR en Colombia (UTC-5)',
  P.mailDiaDe({ date: MS_4_OCT_0200 }) === '2026-10-03',
  'dio=' + P.mailDiaDe({ date: MS_4_OCT_0200 }) + ' (si dice 10-04, no se esta aplicando la zona)');
chk('una fecha ISO en string NO se acepta: la BD no guarda ISO',
  P.mailDiaDe({ date: '2026-10-03' }) === null,
  'dio=' + P.mailDiaDe({ date: '2026-10-03' }));
chk('un correo sin fecha devuelve null, no un ISO inventado',
  P.mailDiaDe({}) === null && P.mailDiaDe(null) === null);
chk('un numero no finito no revienta',
  P.mailDiaDe({ date: NaN }) === null && P.mailDiaDe({ date: Infinity }) === null);

// ══════════ 3) rangoDiaMs: los limites del dia ══════════
const r3 = P.rangoDiaMs('2026-10-03');
const r4 = P.rangoDiaMs('2026-10-04');
chk('el rango de un dia son 24 horas exactas',
  r3 && (r3.to - r3.from) === 86400000, 'delta=' + (r3 && (r3.to - r3.from)));
chk('dos dias contiguos NO se pisan en la medianoche',
  r3 && r4 && r3.to === r4.from, 'fin del 3=' + (r3 && new Date(r3.to).toString()));
chk('el rango arranca en la medianoche LOCAL de ese dia',
  new Date(r3.from).getHours() === 0 && new Date(r3.from).getDate() === 3,
  'arranca=' + new Date(r3.from).toString());
chk('un ISO invalido devuelve null en vez de NaN',
  P.rangoDiaMs('no-es-fecha') === null);

// ══════════ 4) mesDelMini: Agenda congelado, Correo navegable ══════════
const HOY = new Date(2026, 9, 4);   // 4 de octubre de 2026
chk('📦858 · en AGENDA el mini se dibuja con el mes real, ignorando miniMes',
  P.mesDelMini(true, { y: 2026, m: 8 }, HOY).m === 9 && P.mesDelMini(true, { y: 2026, m: 8 }, HOY).y === 2026,
  'dio=' + JSON.stringify(P.mesDelMini(true, { y: 2026, m: 8 }, HOY)) + ' (844 exige el mes real)');
chk('en CORREO el mini muestra el mes navegable',
  P.mesDelMini(false, { y: 2026, m: 8 }, HOY).m === 8,
  'dio=' + JSON.stringify(P.mesDelMini(false, { y: 2026, m: 8 }, HOY)));
chk('en CORREO sin navegar, arranca en el mes presente',
  P.mesDelMini(false, null, HOY).m === 9,
  'dio=' + JSON.stringify(P.mesDelMini(false, null, HOY)));
chk('el minical no se rompe si no le pasan fecha de hoy',
  P.mesDelMini(false, null, 'basura').m === new Date().getMonth());

// ══════════ 5) mesDesplazado: cruzar el año ══════════
chk('ir hacia atras de octubre lleva a septiembre',
  P.mesDesplazado({ y: 2026, m: 9 }, -1).m === 8);
chk('ir hacia adelante de diciembre lleva a enero del año siguiente',
  JSON.stringify(P.mesDesplazado({ y: 2026, m: 11 }, 1)) === JSON.stringify({ y: 2027, m: 0 }),
  'dio=' + JSON.stringify(P.mesDesplazado({ y: 2026, m: 11 }, 1)));
chk('ir hacia atras de enero lleva a diciembre del año anterior',
  JSON.stringify(P.mesDesplazado({ y: 2026, m: 0 }, -1)) === JSON.stringify({ y: 2025, m: 11 }),
  'dio=' + JSON.stringify(P.mesDesplazado({ y: 2026, m: 0 }, -1)));
chk('ir 14 meses hacia atras desde octubre 2026 sigue en un mes valido',
  (() => { const r = P.mesDesplazado({ y: 2026, m: 9 }, -14); return r.m >= 0 && r.m <= 11 && Number.isInteger(r.y); })(),
  'dio=' + JSON.stringify(P.mesDesplazado({ y: 2026, m: 9 }, -14)));

// ══════════ 6) El dia se COMPONE con el chip (el bug del return temprano) ══════════
// Este es el check que más importa. La primera implementación hacía
// `if (mailFilter === "unread") return !!m.unread;` y esa salida temprana se
// comia el filtro por dia: con "No leídos" activo, la funcion nunca llegaba a
// comparar la fecha.
const cuerpoFiltro = (function () {
  const m = aLF(cod).match(/^  function mailPasaFiltroActual\([\s\S]*?\n  \}/m);
  return m ? m[0] : '';
})();
chk('mailPasaFiltroActual se encontro', cuerpoFiltro.length > 50, 'len=' + cuerpoFiltro.length);
chk('📦858 · el dia NO es un return temprano: se compone con el chip',
  !/mailFilter === "unread"\)\s*return/.test(cuerpoFiltro)
  && !/mailFilter === "flagged"\)\s*return/.test(cuerpoFiltro),
  'un return por chip se traga el eje del dia: "no leidos del 3 de octubre" saldria como "no leidos del mes"');
chk('el dia se aplica sobre un AND, no replacing el chip',
  /var pasa = true/.test(cuerpoFiltro) && /if \(pasa && state\.mailDia/.test(cuerpoFiltro));
chk('el dia se desactiva solo en Agenda',
  /!state\.calendarVisible/.test(cuerpoFiltro),
  'sin esta barrera, un filtro colgado acortaria la lista en la pestaña de eventos');
chk('la regla de snoozed sigue siendo la primera (no se movio)',
  /isThreadSnoozed\(m\.id\)\) return false/.test(cuerpoFiltro));

// ══════════ 7) Los correos del dia se PIDEN a la cache ══════════
chk('existe asegurarCorreosDelDia() con su propia proteccion de carpeta',
  /^  function asegurarCorreosDelDia\(\)/m.test(aLF(cod)));
chk('la clave del cache incluye CARPETA y DIA',
  /var clave = carpeta \+ "\|" \+ iso/.test(codLF),
  'sin la carpeta, cambiar a Enviados con un dia puesto mostraria los del dia en la carpeta anterior');
chk('le pasa dateFrom y dateTo a la consulta',
  /dateFrom: rango\.from/.test(cod) && /dateTo: rango\.to/.test(cod));
chk('los correos del dia se AGREGAN a la lista, no la reemplazan',
  /state\.mails\.push\(mail\)/.test(cod));
chk('no duplica: mira los ids que ya estan',
  /vistos\.has\(mail\.id\)/.test(cod));
chk('un fallo de la cache NO deja la pantalla en blanco',
  /\.catch\(function \(e\)/.test(cod) && /state\.mailDiaCargado = null/.test(cod));

// ══════════ 8) Aislamiento: el clic de Correo no toca el calendario ══════════
// `\s*\{` porque el archivo real escribe `renderSidebar(container) {` con
// espacio, y se normaliza a LF porque en CRLF el cierre de bloque queda
// `}\r\n` y un patron que exige `}\n` no encuentra nada.
const cuerpoMini = (function () {
  const m = aLF(js).match(/function renderSidebar\(container\)\s*\{[\s\S]*?\n  \}\n/);
  return m ? m[0] : '';
})();
chk('renderSidebar se encontro para inspección', cuerpoMini.length > 2000, 'len=' + cuerpoMini.length);
chk('📦858 · el clic en modo Correo filtra la bandeja',
  /if \(modoCorreo\) \{ filtrarBandejaPorDia\(c\.iso\); return; \}/.test(cuerpoMini));
chk('y ese return esta ANTES de tocar el calendario grande',
  cuerpoMini.indexOf('filtrarBandejaPorDia(c.iso); return;') < cuerpoMini.indexOf('seleccionarDiaDelMini(c.iso, esDoble)'),
  'si el clic de correo llegara a seleccionarDiaDelMini, moveria el calendario grande y fijaria el alcance de 857');
chk('en Correo NO se pintan puntitos de eventos',
  /const dots = modoCorreo \? \[\] :/.test(cuerpoMini),
  'los puntitos son de eventos; en la pestaña de correo no son senal de nada');
chk('en Correo NO hay popup de eventos',
  /const eventosDelDia = modoCorreo \? \[\] :/.test(cuerpoMini));
chk('el mini lleva una clase distinta en Correo',
  /class: "kair-card mini" \+ \(modoCorreo \? " mini--correo" : ""\)/.test(codLF));

// ══════════ 9) La fila del filtro es emergente, no permanente ══════════
chk('la fila del filtro SOLO existe cuando hay dia elegido',
  /if \(modoCorreo && state\.mailDia\) \{/.test(cuerpoMini),
  'una seccion permanente ocuparia espacio con la bandeja sin filtro encima');
chk('la fila trae un boton para quitar el filtro',
  /id="mini-filtro-x"/.test(cuerpoMini));
chk('con cero correos la fila lo dice, en vez de mostrar un 0 solo',
  /delDia === 0 \? " · sin correos" : ""/.test(cuerpoMini));
chk('el CSS de la fila existe',
  /\.mini-filtro\s*\{/.test(sinComentarios(css)));
chk('el CSS usa un radio que EXISTE en la hoja',
  /--kair-r-md/.test(sinComentarios(css)) && !/var\(--kair-radius\)/.test(sinComentarios(css)),
  '--kair-radius no existe en premium.css; se verifico');
chk('el boton de quitar filtro usa D.ICONS.x, que si existe',
  /D\.ICONS\.x/.test(cuerpoMini) && !/D\.ICONS\.close/.test(cod),
  'D.ICONS.close NO existe en data.js; se verifico');

// ══════════ 10) Cambiar de pestaña limpia el filtro ══════════
const cuerpoSetVis = (function () {
  const m = aLF(cod).match(/^  function setCalendarVisible\(visible\) \{[\s\S]*?\n  \}/m);
  return m ? m[0] : '';
})();
chk('setCalendarVisible limpia el filtro por dia',
  /limpiarFiltroDia\(\)/.test(cuerpoSetVis),
  'el owner decidio que al salir a Agenda el filtro se limpia');
chk('y devuelve el mini al mes presente',
  /state\.miniMes = null/.test(cuerpoSetVis));
chk('toggleCalendar pasa por setCalendarVisible (un solo camino que limpia)',
  /function toggleCalendar\(\) \{\s*\n?\s*setCalendarVisible\(!state\.calendarVisible\);/.test(aLF(cod)),
  'si voltea el flag directo, se saltea la limpieza');
const asignacionesDirectas = (aLF(cod).match(/^\s*state\.calendarVisible = (?!visible)/gm) || []).length;
chk('no queda NINGUN camino que voltee la pestaña sin limpiar',
  asignacionesDirectas === 0,
  'quedan ' + asignacionesDirectas + ' asignaciones directas a state.calendarVisible');

// ══════════ 11) El WHERE de rango, EJECUTADO contra SQLite ══════════
// Se extrae el builder REAL de email-db.js. Probar una copia sería probar la
// copia (el error de §5.14): si el WHERE real se rompe, esto no se entera.
function extraerModulo(nombre) {
  const m = dbjs.match(new RegExp('^function ' + nombre + '\\([\\s\\S]*?\\n\\}', 'm'));
  return m ? m[0] : null;
}
const fWhere = extraerModulo('buildThreadsWhere');
const fParse = extraerModulo('parseSearchQuery');
chk('se extrajo buildThreadsWhere del archivo real', fWhere !== null);
chk('se extrajo parseSearchQuery del archivo real', fParse !== null);
if (fWhere && fParse) {
  // 📦874 — buildThreadsWhere ahora acota por cuenta y llama a getActiveConnectionId().
  // Este sandbox no tiene base de datos, así que se le inyecta esa dependencia con una
  // cuenta fija. Si no, la función real revienta con ReferenceError al evaluarse.
  const stubConn = '\nfunction getActiveConnectionId(){ return "kair.co"; }\n';
  const fnW = new Function(fParse + '\n' + stubConn + fWhere + '\nreturn buildThreadsWhere;');
  const buildThreadsWhere = fnW();

  const mem = new DatabaseSync(':memory:');
  mem.exec('CREATE TABLE email_threads (id TEXT, folder TEXT, connection_id TEXT, last_message_date INTEGER, has_unread INTEGER, subject TEXT, snippet TEXT, last_sender_email TEXT, last_sender_name TEXT, is_starred INTEGER, is_important INTEGER, has_attachment INTEGER);');

  // El rango se calcula ANTES de sembrar, porque los dos correos de BORDE
  // tienen que caer exactamente en `from` y en `to`. Sin ellos, cambiar `>=`
  // por `>` o `<` por `<=` no cambia ningún resultado y el mutante pasa: el
  // test parecería verde con la frontera rota. Eso es lo que hace un check
  // de rango: no importa si el caso raro aparece en la vida real, importa si
  // el test lo distingue.
  const rango = P.rangoDiaMs('2026-10-03');
  const D0 = Date.UTC(2026, 8, 14, 12, 0, 0);   // 14 sept, bien antes
  const D1 = Date.UTC(2026, 9, 3, 23, 2, 42);    // 3 oct, 18:02 Colombia
  const D2 = Date.UTC(2026, 9, 4, 2, 0, 0);      // 4 oct UTC = 21:00 DEL 3 en Colombia
  const ins = mem.prepare('INSERT INTO email_threads VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
  ins.run('a', 'INBOX', 'kair.co', D0, 0, 'catorce', '', 'x@y.co', 'X', 0, 0, 0);
  ins.run('b', 'INBOX', 'kair.co', D1, 0, 'tres', '', 'x@y.co', 'X', 0, 0, 0);
  ins.run('c', 'INBOX', 'kair.co', D2, 0, 'medianoche', '', 'x@y.co', 'X', 0, 0, 0);
  ins.run('d', 'SENT', 'kair.co', D1, 0, 'enviado', '', 'x@y.co', 'X', 0, 0, 0);
  ins.run('borde-ini', 'INBOX', 'kair.co', rango.from, 0, 'justo al inicio', '', 'x@y.co', 'X', 0, 0, 0);
  ins.run('borde-fin', 'INBOX', 'kair.co', rango.to, 0, 'justo al final', '', 'x@y.co', 'X', 0, 0, 0);
  // 📦874 — Un hilo de OTRA cuenta: el rango de dia no puede dejarlo entrar.
  ins.run('ajeno', 'INBOX', 'otro@kair.co', D1, 0, 'otra cuenta', '', 'x@y.co', 'X', 0, 0, 0);

  const w = buildThreadsWhere({ folder: 'INBOX', dateFrom: rango.from, dateTo: rango.to });
  const filas = mem.prepare('SELECT id FROM email_threads t WHERE ' + w.where + ' ORDER BY t.last_message_date DESC').all(w.params);
  const ids = filas.map((f) => f.id);
  chk('📦858 · el rango trae los correos del 3 de octubre',
    ids.indexOf('b') >= 0, 'ids=' + JSON.stringify(ids));
  chk('📦858 · y el de las 21:00 DEL 3, que en UTC ya es 4 de octubre',
    ids.indexOf('c') >= 0,
    'ids=' + JSON.stringify(ids) + ' (si falta "c", el rango corta por el dia UTC y no por el dia de Colombia)');
  chk('el rango INCLUYE el correo que cae exacto en la medianoche inicial',
    ids.indexOf('borde-ini') >= 0,
    'ids=' + JSON.stringify(ids) + ' (>= y no >: la medianoche pertenece al dia que empieza)');
  chk('el rango EXCLUYE el correo que cae exacto en la medianoche siguiente',
    ids.indexOf('borde-fin') < 0,
    'ids=' + JSON.stringify(ids) + ' (< y no <=: la medianoche es del dia que SIGUE)');
  chk('el rango EXCLUYE el 14 de septiembre',
    ids.indexOf('a') < 0, 'ids=' + JSON.stringify(ids));
  chk('el rango respeta la carpeta',
    ids.indexOf('d') < 0, 'ids=' + JSON.stringify(ids) + ' (d esta en SENT)');
  chk('el rango es contiguo: el 4 de octubre NO trae lo del 3',
    (() => {
      const r4 = P.rangoDiaMs('2026-10-04');
      const w4 = buildThreadsWhere({ folder: 'INBOX', dateFrom: r4.from, dateTo: r4.to });
      const g = mem.prepare('SELECT id FROM email_threads t WHERE ' + w4.where).all(w4.params).map((f) => f.id);
      return g.indexOf('borde-fin') >= 0 && g.indexOf('b') < 0;
    })(),
    'la medianoche del 4 tiene que ser el PRIMER correo del 4, no el ultimo del 3');
  chk('sin rango, la consulta sigue trayendo todo (no se rompió lo de antes)',
    (() => {
      const ws = buildThreadsWhere({ folder: 'INBOX' });
      return mem.prepare('SELECT id FROM email_threads t WHERE ' + ws.where).all(ws.params).length === 5;
    })(), 'una consulta sin dateFrom tiene que seguir funcionando igual que antes de 858 (5 hilos en INBOX)');
  // 📦874 — En la tabla hay 6 filas INBOX (una es de otra cuenta). Este check vale por
  // dos: el rango no se rompió Y el filtro por cuenta aguanta. Si alguien saca el
  // `AND connection_id`, el 5 pasa a 6 y se pone rojo.
  chk('el hilo de otra cuenta NO entra, ni con rango ni sin él',
    (() => {
      const w2 = buildThreadsWhere({ folder: 'INBOX' });
      const ids2 = mem.prepare('SELECT id FROM email_threads t WHERE ' + w.where + ' ORDER BY t.last_message_date DESC').all(w.params).map((f) => f.id);
      const sinRango = mem.prepare('SELECT id FROM email_threads t WHERE ' + w2.where).all(w2.params).map((f) => f.id);
      return ids2.indexOf('ajeno') < 0 && sinRango.indexOf('ajeno') < 0;
    })(),
    'si "ajeno" aparece, el filtro por cuenta desaparecio');
  chk('control: el hilo ajeno SI esta en la tabla (lo que se filtra es la lectura)',
    mem.prepare('SELECT id FROM email_threads WHERE id = ?').get('ajeno') !== undefined);
  chk('un rango con una fecha que no es numero se queja, no devuelve basura',
    (() => { try { buildThreadsWhere({ folder: 'INBOX', dateFrom: 'ayer' }); return false; } catch (e) { return true; } })());
  mem.close();
}

// ══════════ 12) EOL, caracteres y balance ══════════
chk('app.js sigue en CRLF', eolDe(js) === 'CRLF', 'eol=' + eolDe(js));
chk('premium.css sigue en LF', eolDe(css) === 'LF', 'eol=' + eolDe(css));
chk('email-db.js no cambio de EOL', eolDe(dbjs) === eolDe(fs.readFileSync(DBJS, 'utf8')), 'eol=' + eolDe(dbjs));
const rarosApp = caracteresRaros(js);
chk('app.js sin caracteres fuera del español', rarosApp.length === 0, rarosApp.slice(0, 6).join(', '));
const rarosCss = caracteresRaros(css);
chk('premium.css sin caracteres fuera del español', rarosCss.length === 0, rarosCss.slice(0, 6).join(', '));
const rarosDb = caracteresRaros(dbjs);
chk('email-db.js sin caracteres fuera del español', rarosDb.length === 0, rarosDb.slice(0, 6).join(', '));
const netas = (function (s) { let a = 0, b = 0; for (const c of s) { if (c === '{') a++; if (c === '}') b++; } return a - b; })(js);
chk('las llaves de app.js balancean', netas === 0, 'netas=' + netas);

// ══════════ 13) MUTACION ══════════
// Cada mutante ROMPE algo que un check de arriba vigila. Un mutante que no
// cambia el archivo (mutante vacio) se cuenta aparte: se reporta como "el
// check no muerde", que es un falso positivo disfrazado de buena noticia.
const MUTANTES = [
  { clave: 'borde-desde', nombre: 'dateFrom con > en vez de >= (se pierde el correo de la medianoche)',
    archivo: 'db', de: 'last_message_date >= @dateFrom', a: 'last_message_date > @dateFrom' },
  { clave: 'borde-hasta', nombre: 'dateTo con <= en vez de < (el dia siguiente se cuela)',
    archivo: 'db', de: 'last_message_date < @dateTo', a: 'last_message_date <= @dateTo' },
  { clave: 'rango-corto', nombre: 'el rango dura una hora en vez de un dia',
    archivo: 'app', de: 'return { from: desde, to: desde + 86400000 };', a: 'return { from: desde, to: desde + 3600000 };' },
  { clave: 'dia-utc', nombre: 'mailDiaDe usa el dia UTC en vez del local',
    archivo: 'app', de: 'return isoDe(d);\n  }', a: 'return d.toISOString().slice(0, 10);\n  }' },
  { clave: 'eje-fuera', nombre: 'el eje del dia desaparece del filtro',
    archivo: 'app', de: 'if (pasa && state.mailDia && !state.calendarVisible) {', a: 'if (false && state.mailDia && !state.calendarVisible) {' },
  { clave: 'dia-al-reves', nombre: 'el dia se compara al reves',
    archivo: 'app', de: 'pasa = mailDiaDe(m) === state.mailDia;', a: 'pasa = mailDiaDe(m) !== state.mailDia;' },
  { clave: 'barrera-invertida', nombre: 'la barrera de Agenda queda invertida',
    archivo: 'app', de: 'if (pasa && state.mailDia && !state.calendarVisible) {', a: 'if (pasa && state.mailDia && state.calendarVisible) {' },
  { clave: 'return-temprano', nombre: 'los chips vuelven a hacer return temprano (el bug original)',
    archivo: 'app', de: 'if (state.mailFilter === "unread") pasa = !!m.unread;', a: 'if (state.mailFilter === "unread") return !!m.unread;' },
  { clave: 'no-limpia', nombre: 'salir a Agenda ya no limpia el filtro',
    archivo: 'app', de: 'limpiarFiltroDia();', a: '/* limpio */;' },
  { clave: 'puntitos', nombre: 'el mini de Correo vuelve a pintar puntitos de eventos',
    archivo: 'app', de: 'const dots = modoCorreo ? [] : (dayDots[c.iso] || []);', a: 'const dots = (dayDots[c.iso] || []);' },
  { clave: 'sin-aislar', nombre: 'el clic de correo deja de aislarse y mueve el calendario',
    archivo: 'app', de: 'if (modoCorreo) { filtrarBandejaPorDia(c.iso); return; }', a: '/* sin aislamiento */' },
  { clave: 'mes-siempre', nombre: 'mesDelMini ignora la pestaña y siempre usa el mes navegable',
    archivo: 'app', de: 'if (calendarVisible || !miniMes) return { y: base.getFullYear(), m: base.getMonth() };', a: 'if (!miniMes) return { y: base.getFullYear(), m: base.getMonth() };' },
  { clave: 'toggle-directo', nombre: 'toggleCalendar vuelve a voltear el flag directo',
    archivo: 'app', de: 'setCalendarVisible(!state.calendarVisible);', a: 'state.calendarVisible = !state.calendarVisible; render();' },
  { clave: 'fila-permanente', nombre: 'la fila del filtro pasa a ser permanente',
    archivo: 'app', de: 'if (modoCorreo && state.mailDia) {', a: 'if (modoCorreo) {' },
  { clave: 'clave-sin-carpeta', nombre: 'la clave del cache ya no incluye la carpeta',
    archivo: 'app', de: 'var clave = carpeta + "|" + iso;', a: 'var clave = iso;' },
];

const originales = { app: aLF(cod), db: aLF(dbjs), css: aLF(css) };
let mutadosVacios = 0;
let mordieron = 0;
const noMordieron = [];

for (const mu of MUTANTES) {
  const fuente = originales[mu.archivo];
  if (fuente.indexOf(mu.de) < 0) { noMordieron.push(mu.nombre + '  [ANCLA NO ENCONTRADA]'); continue; }
  const mutado = fuente.replace(mu.de, mu.a);
  if (mutado === fuente) { mutadosVacios++; noMordieron.push(mu.nombre + '  [MUTANTE VACIO]'); continue; }
  // Se re-evalúa TODO el archivo mutado, no solo el fragmento: asi se ve si
  // algun check lo caza de verdad y no solo si el texto cambio.
  let fallo = false;
  if (mu.archivo === 'db') {
    const fmm = mutado.match(new RegExp('^function parseSearchQuery\\([\\s\\S]*?\\n\\}', 'm'));
    const fwm = mutado.match(new RegExp('^function buildThreadsWhere\\([\\s\\S]*?\\n\\}', 'm'));
    if (!fmm || !fwm) { fallo = true; }
    else {
      try {
        const b = new Function(fmm[0] + '\n' + fwm[0] + '\nreturn buildThreadsWhere;')();
        const m2 = new DatabaseSync(':memory:');
        m2.exec('CREATE TABLE email_threads (id TEXT, folder TEXT, last_message_date INTEGER);');
        const p2 = m2.prepare('INSERT INTO email_threads VALUES (?,?,?)');
        const r = P.rangoDiaMs('2026-10-03');
        p2.run('b', 'INBOX', Date.UTC(2026, 9, 3, 23, 2, 42));
        p2.run('borde-ini', 'INBOX', r.from);
        p2.run('borde-fin', 'INBOX', r.to);
        const w2 = b({ folder: 'INBOX', dateFrom: r.from, dateTo: r.to });
        const got = m2.prepare('SELECT id FROM email_threads t WHERE ' + w2.where).all(w2.params).map((f) => f.id);
        // El rango correcto agarra 'b' y 'borde-ini', y NUNCA 'borde-fin'.
        // Con `>` se cae borde-ini; con `<=` entra borde-fin. Los dos
        // mutantes tienen que verse acá, y con datos sin frontera no se verian.
        if (!(got.indexOf('b') >= 0 && got.indexOf('borde-ini') >= 0 && got.indexOf('borde-fin') < 0)) fallo = true;
        m2.close();
      } catch (e) { fallo = true; }
    }
  } else {
    // Para app.js: se re-extraen las funciones puras del mutante y se repite
    // la bateria funcional. Si el mutante rompe una pura, los checks la cazan.
    const pc = soloCodigo(mutado);
    try {
      const mm = puras.map((nm) => {
        const x = pc.match(new RegExp('^  function ' + nm + '\\([\\s\\S]*?\\n  \\}', 'm'));
        return x ? x[0] : '';
      }).join('\n');
      const Q = new Function(mm + '\nreturn { mailDiaDe: mailDiaDe, rangoDiaMs: rangoDiaMs, mesDelMini: mesDelMini, mesDesplazado: mesDesplazado };')();
      const rr = Q.rangoDiaMs('2026-10-03');
      const d3 = Q.mailDiaDe({ date: Date.UTC(2026, 9, 3, 23, 2, 42) });
      const d4 = Q.mailDiaDe({ date: Date.UTC(2026, 9, 4, 2, 0, 0) });
      const mesA = Q.mesDelMini(true, { y: 2026, m: 8 }, new Date(2026, 9, 4));
      const mesC = Q.mesDelMini(false, { y: 2026, m: 8 }, new Date(2026, 9, 4));
      const dic = Q.mesDesplazado({ y: 2026, m: 11 }, 1);
      if (!(rr && (rr.to - rr.from) === 86400000)) fallo = true;
      else if (!(d3 === '2026-10-03' && d4 === '2026-10-03')) fallo = true;
      else if (!(mesA.m === 9 && mesC.m === 8)) fallo = true;
      else if (!(dic.y === 2027 && dic.m === 0)) fallo = true;
    } catch (e) { fallo = true; }
    // Y ademas los checks estructurales sobre el texto mutado. Cada uno
    // busca la AUSENCIA de lo correcto: si el mutante dejo la forma rota,
    // la forma buena desaparecio y hay que marcarlo.
    const mcuerpo = pc.match(/^  function mailPasaFiltroActual\([\s\S]*?\n  \}/m);
    const mmini = mutado.match(/function renderSidebar\(container\)\s*\{[\s\S]*?\n  \}\n/);
    if (mu.clave === 'return-temprano') {
      if (!mcuerpo || /mailFilter === "unread"\) return/.test(mcuerpo[0])) fallo = true;
    }
    if (mu.clave === 'puntitos') {
      if (!mmini || /const dots = \(dayDots\[c\.iso\]/.test(mmini[0])) fallo = true;
    }
    if (mu.clave === 'sin-aislar') {
      if (!mmini || mmini[0].indexOf('filtrarBandejaPorDia(c.iso); return;') < 0) fallo = true;
    }
    if (mu.clave === 'no-limpia') {
      // El mutante borro la llamada de setCalendarVisible. La del boton X
      // sigue viva, asi que buscar la cadena global no sirve: hay que
      // mirar DENTRO de setCalendarVisible.
      const sv = mutado.match(/^  function setCalendarVisible\(visible\) \{[\s\S]*?\n  \}/m);
      if (!sv || sv[0].indexOf('limpiarFiltroDia()') < 0) fallo = true;
    }
    // POLARIDAD: la mutación borra la forma BUENA. El check real exige la
    // forma buena presente, asi que aca se marca cuando deja de estarlo.
    // Escribirlo al revés ("si aparece la mala, fallo") deja al mutante
    // pasar, y un mutante que pasa es peor que no tener mutacion: dice que
    // el check no muerde cuando en realidad nadie lo probó.
    if (mu.clave === 'fila-permanente') {
      if (mutado.indexOf('if (modoCorreo && state.mailDia)') < 0) fallo = true;
    }
    if (mu.clave === 'toggle-directo') {
      // El check real exige CERO asignaciones directas; el mutante mete una.
      const asg = (mutado.match(/^\s*state\.calendarVisible = (?!visible)/gm) || []).length;
      if (asg > 0) fallo = true;
    }
    if (mu.clave === 'clave-sin-carpeta') {
      if (!/var clave = carpeta \+ "\|" \+ iso/.test(mutado)) fallo = true;
    }
    if (mu.clave === 'barrera-invertida') {
      if (/pasa && state\.mailDia && state\.calendarVisible/.test(mutado)) fallo = true;
    }
    if (mu.clave === 'dia-al-reves') {
      if (/pasa = mailDiaDe\(m\) !== state\.mailDia/.test(mutado)) fallo = true;
    }
    if (mu.clave === 'eje-fuera') {
      if (/if \(false && state\.mailDia/.test(mutado)) fallo = true;
    }
    if (mu.clave === 'mes-siempre') {
      if (!/if \(calendarVisible \|\| !miniMes\)/.test(mutado)) fallo = true;
    }
  }
  if (fallo) mordieron++; else noMordieron.push(mu.nombre);
}

chk('ningún mutante quedó vacío (todos cambiaron el archivo de verdad)',
  mutadosVacios === 0, mutadosVacios + ' mutantes vacios');
chk('todas las mutaciones fueron cazadas por algún check',
  noMordieron.length === 0,
  noMordieron.length + ' no mordieron: ' + noMordieron.slice(0, 4).join(' | '));

// ══════════ Resultado ══════════
if (fallos.length) {
  console.log('\n✗ ' + fallos.length + ' check(s) fallaron de ' + n + '\n');
  fallos.forEach((f) => console.log('  FAIL  ' + f));
  console.log('\n  mutaciones: ' + mordieron + '/' + MUTANTES.length + ' mordieron, '
    + mutadosVacios + ' vacios');
  process.exit(1);
}
console.log('\n' + n + '/' + n + ' checks OK');
console.log('  mutaciones: ' + mordieron + '/' + MUTANTES.length + ' mordieron, '
  + mutadosVacios + ' vacios');
