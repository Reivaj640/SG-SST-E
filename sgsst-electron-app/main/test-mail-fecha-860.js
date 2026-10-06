'use strict';
// 📦860 · La fila de la bandeja muestra la fecha ARRIBA de la hora.
//
// Lo que reportó el owner: en la lista de correo solo se veía la hora
// ("18:02", "17:54"), y con la bandeja mezclando correos de varios días no había
// forma de saber de cuándo era cada uno. Pidió la fecha sobre la hora, y que
// aplique también a Enviados y el resto.
//
// Dos cosas que este test protege:
//
//  1. La fecha usa la zona HORARIA LOCAL. Si usara `toISOString()` (UTC), un
//     correo de las 21:00 en Colombia caería en el día SIGUIENTE y la fila
//     mostraría una fecha que no es. En tu BD hay correos justo en esa franja.
//  2. La fecha se oculta en el hover, igual que la hora. Los iconos de acción de
//     la fila son `position: absolute` en `right: 14px`: si la fecha queda
//     visible, los botones se ven medio tapados por el texto.
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

// ══════════ 1) La función pura se extrae del archivo real ══════════
function extraer(nombre) {
  const m = codLF.match(new RegExp('^  function ' + nombre + '\\([\\s\\S]*?\\n  \\}', 'm'));
  return m ? m[0] : null;
}
const fuenteFecha = extraer('fechaFila');
const fuenteMeses = codLF.match(/^  var MESES_CORTOS = \[[\s\S]*?\];/m);
chk('fechaFila se extrae del archivo real, a nivel de función',
  fuenteFecha !== null,
  'anidada dentro de otra, en la app real daria ReferenceError');
chk('MESES_CORTOS se extrae del archivo real', fuenteMeses !== null);

const F = new Function(fuenteMeses[0] + '\n' + fuenteFecha + '\nreturn fechaFila;')();
const HOY = new Date(2026, 9, 4);   // 4 de octubre de 2026

// ══════════ 2) El formato ══════════
chk('📦860 · un correo de HOY da solo dia y mes',
  F({ date: new Date(2026, 9, 4, 18, 2).getTime() }, HOY) === '4 oct',
  'dio=' + F({ date: new Date(2026, 9, 4, 18, 2).getTime() }, HOY));
// September se abrevia "sep" (3 letras), no "sept". No es capricho del test: es
// lo que ya usa `MESES_CORTOS`, la fuente compartida con `formatGmailDate`, y lo
// que ponen los otros cuatro archivos del repo que abrevian meses
// (`revisiones-list.js`, `revision-editor.js`, `actas-editor.js`,
// `revision-alta-direccion-component.js`). Cambiar la fuente por el test
// ensancharía el formato de fecha de toda la app.
chk('un correo de otro dia del mismo año da dia y mes',
  F({ date: new Date(2026, 8, 28, 9, 30).getTime() }, HOY) === '28 sep',
  'dio=' + F({ date: new Date(2026, 8, 28, 9, 30).getTime() }, HOY));
chk('un correo de OTRO año agrega el año',
  F({ date: new Date(2025, 8, 28, 9, 30).getTime() }, HOY) === '28 sep 2025',
  'dio=' + F({ date: new Date(2025, 8, 28, 9, 30).getTime() }, HOY));
chk('los 12 meses salen bien abrevidos',
  ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
    .every((m, i) => F({ date: new Date(2026, i, 15).getTime() }, HOY) === '15 ' + m),
  'uno de los doce sale mal');
chk('el dia no lleva cero a la izquierda (4, no 04)',
  F({ date: new Date(2026, 9, 4, 12, 0).getTime() }, HOY) === '4 oct',
  'dio=' + F({ date: new Date(2026, 9, 4, 12, 0).getTime() }, HOY));

// ══════════ 3) La zona horaria: el riesgo real ══════════
chk('📦860 · un correo a las 21:00 de Colombia NO se corre al día siguiente',
  // 4 de octubre 02:00 UTC = 3 de octubre 21:00 en Colombia (UTC-5).
  F({ date: Date.UTC(2026, 9, 4, 2, 0, 0) }, HOY) === '3 oct',
  'dio=' + F({ date: Date.UTC(2026, 9, 4, 2, 0, 0) }, HOY)
  + ' (si dice "4 oct", esta usando UTC en vez de hora local)');
chk('y uno a la medianoche local sí se queda en su día',
  F({ date: new Date(2026, 9, 4, 0, 0, 0).getTime() }, HOY) === '4 oct');
chk('el cruce de medianoche de un día de fin de mes',
  F({ date: new Date(2026, 8, 30, 23, 50).getTime() }, HOY) === '30 sep',
  'dio=' + F({ date: new Date(2026, 8, 30, 23, 50).getTime() }, HOY));

// ══════════ 4) Entradas degeneradas ══════════
chk('un correo sin fecha devuelve "", no un texto roto',
  F({}, HOY) === '' && F(null, HOY) === '' && F({ date: NaN }, HOY) === ''
  && F({ date: Infinity }, HOY) === '' && F({ date: 'ayer' }, HOY) === '',
  'la columna tiene que quedar con la hora sola, no con "NaN" o "Invalid Date"');
chk('si no le pasan hoy, usa el reloj real sin romperse',
  typeof F({ date: Date.now() }) === 'string' && F({ date: Date.now() }).length > 0);
// La guarda de tipo no tiene mutante propio (la de `isNaN` la solapa en todas las
// entradas degeneradas), pero sin ella un `date` en ISO —"2026-10-04"— pasaria el
// filtro y la fila pintaria una fecha que nadie marco.
chk('📦860 · la guarda de tipo sigue ahi (no solo la de fecha invalida)',
  /if \(typeof ms !== "number" \|\| !isFinite\(ms\)\) return "";/.test(codLF),
  'sin ella, un date en ISO entraria como si fuera una fecha util');

// ══════════ 5) La fila pinta la fecha encima de la hora ══════════
const cuerpoFila = (function () {
  const m = aLF(js).match(/Columna 4 — Meta[\s\S]*?\n\s*row\.appendChild\(meta\);/);
  return m ? m[0] : '';
})();
chk('📦860 · la columna meta se sigue construyendo',
  cuerpoFila.length > 100, 'no se encontro el bloque de la columna meta');
chk('la fecha se pinta ANTES que la hora (el owner la pidio encima)',
  cuerpoFila.indexOf('kair-mail-row__fecha') >= 0
  && cuerpoFila.indexOf('kair-mail-row__fecha') < cuerpoFila.indexOf('kair-mail-row__time'),
  'el orden esta al reves: la hora queda arriba y la fecha abajo');
chk('la fecha se calcula con la funcion pura, no con un formato suelto',
  /const filaFecha = fechaFila\(m\)/.test(codLF));
chk('si no hay fecha, la linea no se agrega (no queda un hueco vacio)',
  /if \(filaFecha\) \{[\s\S]{0,200}?appendChild/.test(codLF));
chk('la hora se sigue pintando',
  /kair-mail-row__time[\s\S]{0,120}?m\.time \|\| "—"/.test(codLF));

// ══════════ 6) La columna ya era de dos lineas ══════════
chk('la columna meta esta en columna, no en fila',
  /\.kair-mail-row__meta\s*\{[\s\S]{0,200}?flex-direction:\s*column/.test(sinComentarios(premium)),
  'sin esto la fecha se pondria al lado de la hora y la fila se veria rara');

// ══════════ 7) El hover oculta LAS DOS lineas ══════════
// La REGLA de estilo de la fecha, no cualquier MENCIÓN de la palabra.
//
// El selector del hover también termina en `.kair-mail-row__fecha {`. Un check
// que solo busque esa cadena encuentra la del hover aunque la regla de estilo
// ya no exista, y el mutante que renombra el selector pasa con la fila sin
// estilo. Por eso se exige que el selector ARRANQUE en su línea, pelado y sin
// `:hover` — el del hover nunca cumple eso, porque antes de la palabra hay un
// espacio precedido de `:hover`.
function reglaFechaDe(s) {
  const re = /(?:^|[\n,])[ \t]*\.kair-mail-row__fecha[ \t]*\{([^}]*)\}/g;
  const m = re.exec(s);
  return m ? m[1] : '';
}
const declFecha = reglaFechaDe(cssLimpio);

const hover = /\.kair-mail-row:hover \.kair-mail-row__time[\s\S]{0,200}?\{/.exec(cssLimpio);
chk('el hover oculta la hora (como antes)', hover !== null);
chk('📦860 · y el hover oculta TAMBIÉN la fecha',
  hover !== null && /kair-mail-row:hover \.kair-mail-row__fecha/.test(cssLimpio),
  'los iconos de accion son position:absolute en right:14px: con la fecha visible se meten DEBAJO de los botones y los tapa a medias');
chk('📦860 · la fecha tiene su PROPIA regla de estilo, no solo la del hover',
  /font-size:\s*0\.65rem/.test(declFecha),
  'la regla buscada no existe o no declara el tamano; se encontro: "' + declFecha.slice(0, 60) + '"');
chk('las dos lineas comparten la misma transicion de opacidad',
  /transition:\s*opacity 120ms ease/.test(declFecha)
  && /transition:\s*opacity 120ms ease/.test(/\.kair-mail-row__time\s*\{([^}]*)\}/.exec(cssLimpio)[1]));

// ══════════ 8) Los meses tienen UNA sola fuente ══════════
const copiasMeses = (codLF.match(/"ene",\s*"feb"/g) || []).length;
chk('el array de meses cortos existe UNA sola vez',
  copiasMeses === 1,
  'hay ' + copiasMeses + ' copias: se separan con el tiempo y la que nadie recuerda al corregir la otra es la que gana');
chk('formatGmailDate usa la fuente compartida, no su propia copia',
  /var mon = MESES_CORTOS\[d\.getMonth\(\)\]/.test(codLF)
  && !/var months = \["ene"/.test(codLF));
chk('fechaFila usa la misma fuente',
  /MESES_CORTOS\[d\.getMonth\(\)\]/.test(codLF));

// ══════════ 9) EOL, caracteres y balance ══════════
chk('app.js sigue en CRLF', eolDe(js) === 'CRLF', 'eol=' + eolDe(js));
chk('styles.css no cambio de EOL', eolDe(css) === 'LF', 'eol=' + eolDe(css));
const rarosJs = caracteresRaros(js);
chk('app.js sin caracteres fuera del espanol', rarosJs.length === 0, rarosJs.slice(0, 5).join(', '));
const rarosCss = caracteresRaros(css);
chk('styles.css sin caracteres fuera del espanol', rarosCss.length === 0, rarosCss.slice(0, 5).join(', '));
const netasCss = (function (s) { let a = 0, b = 0; for (const c of s) { if (c === '{') a++; if (c === '}') b++; } return a - b; })(css);
chk('las llaves de styles.css balancean', netasCss === 0, 'netas=' + netasCss);
const netasJs = (function (s) { let a = 0, b = 0; for (const c of s) { if (c === '{') a++; if (c === '}') b++; } return a - b; })(js);
chk('las llaves de app.js balancean', netasJs === 0, 'netas=' + netasJs);

// ══════════ 10) MUTACION ══════════
// POLARIDAD: la mutacion ROMPE la forma buena y el check la EXIGE presente,
// asi que se marca cuando la buena dejo de estar.
const MUTANTES = [
  { clave: 'utc', nombre: 'la fecha usa UTC y se corre un dia',
    archivo: 'app', de: 'var txt = d.getDate() + " " + MESES_CORTOS[d.getMonth()];',
    a: 'var txt = d.toISOString().slice(0, 10);' },
  { clave: 'sin-anio', nombre: 'la fecha deja de mostrar el anio cuando es distinto',
    archivo: 'app', de: 'return d.getFullYear() === base.getFullYear() ? txt : txt + " " + d.getFullYear();',
    a: 'return txt;' },
  { clave: 'anio-siempre', nombre: 'la fecha siempre muestra el anio (columna mas ancha)',
    archivo: 'app', de: 'return d.getFullYear() === base.getFullYear() ? txt : txt + " " + d.getFullYear();',
    a: 'return txt + " " + d.getFullYear();' },
  // 📦860 — Quita LAS DOS guardas, y no una.
  //
  // El blanco natural era la primera (`typeof ms !== "number" || !isFinite(ms)`),
  // y no muerde: la segunda la solapa en TODAS las entradas degeneradas. Y al
  // revés tampoco: `new Date(n)` nunca da fecha invalida para un numero finito,
  // asi que la segunda es redundante con la primera. Las dos se necesitan juntas
  // para que el mutante cambie el comportamiento, y por eso van en un solo
  // mutante. Leccion: un mutante que no muerde no siempre es un check flojo — a
  // veces esta delatando que la linea vigilada no hacia falta, o que hacia falta
  // la de al lado. Las guardas quedan cubiertas aqui en conjunto y con un check
  // estatico por separado.
  { clave: 'nan', nombre: 'una fecha invalida devuelve "NaN undefined NaN" en vez de cadena vacia',
    archivo: 'app',
    de: '    if (typeof ms !== "number" || !isFinite(ms)) return "";\n    var d = new Date(ms);\n    if (isNaN(d.getTime())) return "";\n',
    a: '    var d = new Date(ms);\n' },
  { clave: 'meses-copia', nombre: 'formatGmailDate vuelve a su propia copia del array de meses',
    archivo: 'app', de: 'var mon = MESES_CORTOS[d.getMonth()];', a: 'var mon = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"][d.getMonth()];' },
  { clave: 'orden-invertido', nombre: 'la hora queda arriba y la fecha abajo',
    archivo: 'app', de: '        if (filaFecha) {\n          meta.appendChild(el("div", {\n            class: "email-row__fecha kair-mail-row__fecha",\n          }, filaFecha));\n        }\n        meta.appendChild(el("div", {\n          class: "email-row__date kair-mail-row__time",\n        }, m.time || "—"));',
    a: '        meta.appendChild(el("div", {\n          class: "email-row__date kair-mail-row__time",\n        }, m.time || "—"));\n        if (filaFecha) {\n          meta.appendChild(el("div", {\n            class: "email-row__fecha kair-mail-row__fecha",\n          }, filaFecha));\n        }' },
  { clave: 'hueco-vacio', nombre: 'la linea de fecha se agrega aunque no haya fecha',
    archivo: 'app', de: 'if (filaFecha) {', a: 'if (true) {' },
  { clave: 'hover-solo-hora', nombre: 'el hover vuelve a ocultar solo la hora y la fecha tapa los botones',
    archivo: 'css', de: '.kair-mail-row:hover .kair-mail-row__time,\n.kair-mail-row:hover .kair-mail-row__fecha {',
    a: '.kair-mail-row:hover .kair-mail-row__time {' },
  { clave: 'sin-estilo', nombre: 'la linea de fecha se queda sin estilo',
    // El ancla incluye la primera declaración. Pelada, `.kair-mail-row__fecha {`
    // aparece DOS veces en styles.css: en su regla y en la del hover, así que
    // `replace` habría tocado la primera por casualidad y el mutante habría
    // "mordido" por el motivo equivocado.
    archivo: 'css', de: '.kair-mail-row__fecha {\n  font-size: 0.65rem;', a: '.kair-mail-row__fecha-x {\n  font-size: 0.65rem;' },
  { clave: 'fecha-a-izquierda', nombre: 'la fecha deja de alinearse a la derecha',
    archivo: 'css', de: 'white-space: nowrap;\n  opacity: 0.85;', a: 'white-space: nowrap;\n  opacity: 0;' },
];

const originales = { app: aLF(cod), css: aLF(cssLimpio) };
let vacios = 0;
let mordieron = 0;
const noMordieron = [];

for (const mu of MUTANTES) {
  const fuente = originales[mu.archivo];
  // 📦860 — El ancla tiene que ser ÚNICA. `String.replace` con texto cambia solo
  // la PRIMERA coincidencia: si el ancla aparece dos veces, el mutante rompe la
  // copia que no importa y deja intacta la que el test vigila, y entonces
  // "muerde" por casualidad (o no muerde sin que nadie sepa por qué). Contar
  // las ocurrencias convierte eso en un error ruidoso en vez de un verde falso.
  const veces = fuente.split(mu.de).length - 1;
  if (veces !== 1) {
    noMordieron.push(mu.nombre + '  [ANCLA APARECE ' + veces + ' VECES]');
    continue;
  }
  const mutado = fuente.replace(mu.de, mu.a);
  if (mutado === fuente) { vacios++; noMordieron.push(mu.nombre + '  [MUTANTE VACIO]'); continue; }
  const c = sinComentarios(mutado);
  let fallo = false;

  switch (mu.clave) {
    case 'utc':
    case 'sin-anio':
    case 'anio-siempre':
    case 'nan': {
      const m = codLF.match(/^  var MESES_CORTOS = \[[\s\S]*?\];/m);
      const f = mutado.match(/^  function fechaFila\([\s\S]*?\n  \}/m);
      if (!m || !f) { fallo = true; break; }
      try {
        const G = new Function(m[0] + '\n' + f[0] + '\nreturn fechaFila;')();
        const H = new Date(2026, 9, 4);
        // El invariante que no puede romperse: un correo de las 21:00 de
        // Colombia (02:00 UTC del dia siguiente) es del dia ANTERIOR.
        if (G({ date: Date.UTC(2026, 9, 4, 2, 0, 0) }, H) !== '3 oct') fallo = true;
        else if (G({ date: new Date(2026, 9, 4, 18, 2).getTime() }, H) !== '4 oct') fallo = true;
        else if (G({ date: new Date(2025, 8, 28, 9, 30).getTime() }, H) !== '28 sep 2025') fallo = true;
        // Todas las entradas degeneradas, no solo NaN. Sin las guardas cada una
        // sale "NaN undefined NaN" y la fila pinta eso debajo de la hora.
        else if ([NaN, Infinity, 'ayer', null, undefined, {}]
          .some((v) => G({ date: v }, H) !== '')) fallo = true;
      } catch (e) { fallo = true; }
      break;
    }
    case 'meses-copia':
      if ((mutado.match(/"ene",\s*"feb"/g) || []).length !== 1) fallo = true;
      break;
    case 'orden-invertido': {
      const b = mutado.match(/Columna 4 — Meta[\s\S]*?\n\s*row\.appendChild\(meta\);/);
      if (!b) fallo = true;
      else if (b[0].indexOf('kair-mail-row__fecha') > b[0].indexOf('kair-mail-row__time')) fallo = true;
      break;
    }
    case 'hueco-vacio':
      if (!/if \(filaFecha\) \{/.test(mutado)) fallo = true;
      break;
    case 'hover-solo-hora':
      if (!/kair-mail-row:hover \.kair-mail-row__fecha/.test(c)) fallo = true;
      break;
    case 'sin-estilo':
      // POLARIDAD: la mutacion BORRA la regla, asi que el fallo se marca cuando
      // la buena DEJO de estar. Escribir `!== ''` aca invierte el signo y deja
      // pasar justamente el mutante que rompe el estilo.
      if (reglaFechaDe(c) === '') fallo = true;
      break;
    case 'fecha-a-izquierda':
      if (!/opacity:\s*0\.85/.test(reglaFechaDe(c))) fallo = true;
      break;
    default:
      noMordieron.push(mu.nombre + '  [CLAVE SIN EVALUAR: ' + mu.clave + ']');
      continue;
  }

  if (fallo) mordieron++; else noMordieron.push(mu.nombre);
}

chk('ningun mutante quedo vacio', vacios === 0, vacios + ' vacios');
chk('todas las mutaciones fueron cazadas', noMordieron.length === 0,
  noMordieron.length + ' no mordieron: ' + noMordieron.slice(0, 3).join(' | '));

if (fallos.length) {
  console.log('\n✗ ' + fallos.length + ' check(s) fallaron de ' + n + '\n');
  fallos.forEach((f) => console.log('  FAIL  ' + f));
  console.log('\n  mutaciones: ' + mordieron + '/' + MUTANTES.length + ' mordieron, ' + vacios + ' vacios');
  process.exit(1);
}
console.log('\n' + n + '/' + n + ' checks OK');
console.log('  mutaciones: ' + mordieron + '/' + MUTANTES.length + ' mordieron, ' + vacios + ' vacios');
