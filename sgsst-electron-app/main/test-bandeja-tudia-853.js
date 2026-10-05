'use strict';
// 📦853 · Aviso de novedad en "Tu dia" (pillon rojo, como el 99+ del icono de
// la Bandeja) + el arreglo del clic de "Correos no leidos" y el de "No leidos"
// escondido en el menu "Mas".
//
// El owner pidio explicitamente el PILLON, no un interruptor. Hay checks que
// verifican que no vuelva a aparecer un switch en esa seccion.
//
// Mismo diseno que 850/851: evaluar(htm, css, js) -> {f, n} para poder mutar en
// memoria. Y normalizacion a LF ANTES de mutar, con guard de mutante vacio: una
// mutacion que no cambia nada siempre "pasa" y se reporta como si el check no
// mordiera, cuando en realidad nunca se probo.
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

  // ══ 1) El aviso es un PILLON, no un switch ══
  // El owner dijo "no quiero un switch, quiero este tipo de alerta visual".
  // Estos checks existen para que nadie vuelva a meter un toggle aqui.
  chk('NO hay ningun switch de alertas en la seccion',
    !/tuday-switch/.test(cod) && !/tuday__sw/.test(css) && !/role="switch"/.test(cod),
    'el owner pidio el pillon, no un interruptor');
  chk('no queda el estado del switch ni su clave de localStorage',
    cod.indexOf('TUDIA_ALERTAS') < 0 && cod.indexOf('_alertasTuDiaOn') < 0
    && cod.indexOf('_setAlertasTuDia') < 0,
    'sin switch no hay por que guardar su estado');
  chk('no quedan reglas .tuday__sw / .tuday__sw-dot huerfanas en el CSS',
    !/tuday__sw/.test(css));
  chk('la cabecera de "Tu dia" volvio a ser un bloque simple (sin fila por el switch)',
    /\.tuday__t \{[^}]*margin-bottom: 6px/.test(css) && !/\.tuday__h \{/.test(css),
    'la fila .tuday__h solo existia para acomodar el switch');
  chk('la linea base de lo visto si se sigue guardando',
    /TUDIA_VISTOS = "kair-bandeja\.tuDiaVistos"/.test(cod));
  chk('_leerVistos y _marcarVisto existen',
    /function _leerVistos\(\)/.test(cod) && /function _marcarVisto\(key, n\)/.test(cod));

  // EL CHECK QUE HABRIA CAZADO EL BUG. El bloque funcional de mas abajo
  // calcula bien el numero, pero llama a _sembrarVistos() A MANO: si nadie la
  // invoca en el arranque, la funcion existe, los tests pasan, y en la app el
  // aviso no aparece nunca porque la linea base nunca se siembra. Este check
  // ata la siembra al lugar correcto.
  chk('init() siembra la linea base al arrancar',
    /state\.events = await loadEventsFromIPC\(\);[\s\S]{0,300}_sembrarVistos\(\);/.test(cod),
    'si init() no siembra, el aviso nunca aparece: nadie hizo clic todavia');
  chk('_sembrarVistos existe y solo rellena claves faltantes',
    /function _sembrarVistos\(\)/.test(cod)
    && /Object\.prototype\.hasOwnProperty\.call\(v, k\)/.test(cod),
    'si sobrescribiera siempre, el aviso se apagaria solo en cada arranque');
  chk('la siembra se hace DESPUES de cargar los datos, no antes',
    /state\.mails = await loadMailsFromCache\(\);/.test(cod)
    && /state\.events = await loadEventsFromIPC\(\);[\s\S]{0,300}_sembrarVistos\(\);/.test(cod),
    'sembrar antes de cargar guardaria 0 como linea base y todo seria "nuevo"');

  // ══ 2) "Nuevo" es la DIFERENCIA contra lo visto, no el numero actual ══
  // Si el pillon fuera el total, marcaria desde el primer render y no diria
  // nada. Y sin linea base guardada no hay "nuevo": la primera vez que se abre
  // la app no se pinta nada, porque todavia no vio nada.
  chk('"nuevo" se calcula restando lo visto',
    /return actual - visto;/.test(cod),
    'sin la resta el pillon seria siempre el total');
  chk('la linea base baja cuando el numero actual cae por debajo',
    /if \(actual < visto\) \{ _marcarVisto\(key, actual\); return 0; \}/.test(cod),
    'sin reanclar, el aviso queda muerto en cuanto el owner lee fuera de la app');
  chk('sin linea base guardada no se marca nada como nuevo',
    /if \(!isFinite\(visto\) \|\| visto < 0\) return 0;/.test(cod),
    'NaN - actual daria NaN y el pillon se pintaria roto');
  chk('los dos indicadores calculan su propio "nuevo"',
    /nuevoDe\("correos", unread\)/.test(cod) && /nuevoDe\("reuniones", todayEvents\)/.test(cod));
  chk('hacer clic marca lo visto (el pillon baja a 0 en el acto)',
    /_marcarVisto\("correos", unread\)/.test(cod) && /_marcarVisto\("reuniones", todayEvents\)/.test(cod),
    'sin marcar lo visto el pillon volveria a marcar lo mismo en cada render');

  // ══ 3) El pillon: encima del icono, con tope 99+ ══
  // Va DENTRO de un envoltorio con position:relative. Si se posicionara contra
  // la fila, quedaria en la esquina de las 250px del sidebar en vez de encima
  // del icono, que es donde el ojo ya esta mirando.
  chk('el pillon se pinta solo cuando hay novedad',
    /const hayNuevo = it\.nuevo > 0;/.test(cod),
    'si se pinta siempre, cada fila con algo queda en rojo para siempre');
  chk('el pillon usa la clase .tuday__badge',
    /class="tuday__badge"/.test(cod));
  // 📦854 · El envoltorio del icono ya no existe: el ancla es la fila. El
  // check anterior que exigia el orden "dentro del envoltorio" quedo obsoleto
  // y se borro, no se dejogreen: describia un anclaje que el owner corrigio.
  chk('el envoltorio del icono ya no existe: el ancla es la fila',
    !/tuday__ico-wrap/.test(css) && !/tuday__ico-wrap/.test(cod),
    'vuelve el anclaje al icono, que es lo que el owner corrigio');
  chk('el pillon va de ultimo hijo de la fila (pegado a la esquina)',
    /"<\/span>" \+\s*\n\s*pill;/.test(cod),
    'tiene que ir despues del cierre del cuerpo; si queda antes, cuelga de otro lado');
  chk('el pillon tiene tope 99+ como el del icono Bandeja',
    /it\.nuevo > 99 \? "99\+" : it\.nuevo/.test(cod),
    'sin tope, un numero de 4 digitos desborda el icono de 28px');
  chk('la fila con novedad lleva la clase is-new',
    /is-new/.test(cod) && /\.tuday__i\.is-new/.test(css));

  // ══ 4) El pillon se ve IGUAL que el 99+ del icono de la Bandeja ══
  // Copiar el look vale mas que inventar uno: el owner ya reconoce ese rojo
  // como "llego algo". La referencia es .kair-cal-badge en styles.css.
  // ══ 4) El aviso es una RÉPLICA del 99+ del shell ══
  // La razon de que sea una replica y no "parecido": el owner reconocio el
  // bloque rojo del boton de arriba. Si el de "Tu dia" se ve distinto, se lee
  // como otro aviso. Los valores se comparan contra `.kair-cal-badge`
  // (styles.css:6121-6157) para que no se separen con el tiempo.
  const REF = fs.readFileSync(path.join(DIR, '..', '..', 'styles.css'), 'utf8')
    .replace(/\r\n/g, '\n');
  const refBadge = (/\.kair-cal-badge \{([\s\S]*?)\n\}/.exec(REF) || ['', ''])[1];
  chk('se encontro la regla de referencia .kair-cal-badge en styles.css',
    refBadge.length > 20, 'chars=' + refBadge.length);

  // Compara el VALOR, no el nombre de la propiedad. Una version anterior
  //.regexp'\\\n\\s*' + prop + ':' y comparaba solo eso: mientras la propiedad
  // existiera en los dos lados daba verde, y tres mutaciones que cambiaban
  // min-width, background y box-shadow pasaban sin quejarse.
  const tudayBadgeBody = (css.split('.tuday__badge {')[1] || '').split('}')[0] + '}';
  function valorDe(bloque, prop) {
    const m = new RegExp('(?:^|\\n)\\s*' + prop + ':\\s*([^;]+);').exec(bloque);
    return m ? m[1].trim() : null;
  }
  // Normaliza espacios y ceros a la izquierda: el shell escribe `0.25` y aca
  // se puede escribir `.25`. Es el MISMO valor; comparar crudo daria un fallo
  // por notacion y empujaria a "arreglar" algo que no esta roto.
  const norm = (v) => (v || '').replace(/\s+/g, ' ').replace(/\b0\./g, '.').trim();
  function coincide(prop) {
    return valorDe(refBadge, prop) !== null && norm(valorDe(refBadge, prop)) === norm(valorDe(tudayBadgeBody, prop));
  }
  ['min-width', 'height', 'padding', 'border-radius', 'background', 'color', 'font-size',
    'font-weight', 'box-shadow'].forEach(function (prop) {
    chk('📦854 · el pillón copia "' + prop + '" del badge del shell',
      coincide(prop), 'shell=' + valorDe(refBadge, prop) + '  tuday=' + valorDe(tudayBadgeBody, prop));
  });
  chk('el pillon cuelga de la esquina de la fila, igual que el 99+ cuelga del boton',
    /\.tuday__badge \{[\s\S]{0,120}top: 2px;/.test(css)
    && /\.tuday__badge \{[\s\S]{0,160}right: 2px;/.test(css),
    'el 99+ va en top/right 2px; este tambien tiene que ir ahi');
  chk('el ancla del pillon es la FILA, no el icono',
    /\.tuday__i\.is-new \{ position: relative/.test(css) && !/tuday__ico-wrap/.test(css),
    'si vuelve el envoltorio del icono, el pillon se despega de la esquina');
  chk('el pillon no tiene anillo blanco (el del shell no lo tiene)',
    !/box-shadow: 0 0 0 2px #fff/.test(css),
    'un anillo es invento propio y hace que se vea distinto al de arriba');

  chk('capa 1 · la fila con novedad se tiñe de rojo',
    /\.tuday__i\.is-new \{[^}]*background: var\(--kair-red-soft\)/.test(css),
    'sin fondo rojo en la fila el aviso no se ve de reojo');
  chk('la barra roja no se sale por las esquinas redondeadas de la fila',
    /\.tuday__i\.is-new::before \{[^}]*border-radius: 0 3px 3px 0/.test(css),
    'pegada a top:0/bottom:0 asoma por el redondeo de la fila');
  chk('hover sigue dando feedback en una fila con novedad',
    /\.tuday__i\.is-new:hover \{/.test(css),
    'sin esto el hover queda tapado por el fondo rojo y no se siente el clic');
  chk('el pillon no se puede clicar por accidento',
    /\.tuday__badge \{[^}]*pointer-events: none/.test(css),
    'sin esto el pillon intercepta el clic que deberia marcar lo visto');

  // ══ 4b) Al hacer clic se baja el 99+ del shell ══
  // El pillon y el 99+ tienen que hablar de las MISMAS filas de la tabla
  // `notificaciones`. Un contador paralelo local no los baja nunca.
  chk('existe el helper que marca las notificaciones de correo como leidas',
    /function _marcarNotifsCorreoLeidas\(\)/.test(cod),
    'sin el, el 99+ se queda en 99+ para siempre');
  chk('el clic de Correos lo invoca (baja el pillon Y el 99+)',
    /_marcarVisto\("correos", unread\);[\s\S]{0,160}_marcarNotifsCorreoLeidas\(\)/.test(cod),
    'el aviso local baja pero el del shell no: quedan dos numeros distintos');
  chk('filtra SOLO las de tipo correo, no marcarTodas',
    /n\.tipo === "correo"/.test(cod) && !/notifications\.marcarTodas/.test(cod),
    'marcarTodas taparia tambien los eventos, y mirar el correo no es ver eventos');
  chk('usa el mismo payload que kair-alerts (token + soloNoLeidas + limit 50)',
    /soloNoLeidas: true, limit: 50/.test(cod) && /kair-auth-token/.test(cod),
    'otro payload podria devolver otra cosa o fallar por sesion');
  // Acotado al CUERPO del helper. Con una ventana de 2000 chars sobre todo el
  // archivo, el `KA.refresh()` de `refreshKairAlerts()` (que esta en otra parte
  // del monolith) hacia que el check pasara aunque este helper no refrescara.
  const cuerpoNotifs = cuerpoDe(js, '_marcarNotifsCorreoLeidas');
  chk('despues de marcar, refresca KairAlerts para que el 99+ baje ya',
    /KA\.refresh\(\)/.test(cuerpoNotifs),
    'sin esto el 99+ se queda con el numero viejo hasta el proximo tick de 60s');
  // OJO: no se puede buscar "no critic" porque `soloCodigo` borra los
  // comentarios, y el texto quedaria vacio — el check pasaria siempre.
  chk('el fallo al marcar no rompe la navegacion',
    /_marcarNotifsCorreoLeidas[\s\S]{0,2000}\.catch\(/.test(cod),
    'una excepcion ahi dejaria la fila sin navegar');

  // ══ 5) El clic de "Correos no leidos" ahora APLICA el filtro ══
  // Este era el bug reportado: el indicador solo hacia setCalendarVisible(false),
  // o sea llegaba a la bandeja completa. El filtro "unread" ya existia en la
  // logica de la lista; lo que faltaba era que alguien lo activara.
  // El rango se acota al OBJETO de kpi-correos: prefijar un rango enorme
  // "para que no falle" dejaria que el regex matcheara dentro de kpi-reuniones.
  const objCorreos = (/id: "kpi-correos"[\s\S]*?(?=id: "kpi-reuniones")/).exec(js);
  const oc = objCorreos ? objCorreos[0] : '';
  // 📦855 — El clic ya no ASIGNA el filtro: llama a setMailFilter, que ademas
  // suelta una seleccion que la lista nueva ya no muestra. El check se invierte
  // (no se borra): lo que se vigila ya no es la asignacion en linea, es que el
  // clic siga pasando por el unico camino que cambia el filtro.
  chk('el clic de Correos aplica el filtro por setMailFilter',
    /setMailFilter\("unread"\)/.test(oc),
    'sin esto el clic llega a la bandeja completa, que es lo que se reporto');
  chk('el clic de Correos NO asigna el filtro a mano',
    !/state\.mailFilter = /.test(oc),
    'una asignacion directa se saltaria la validacion de la seleccion');
  chk('el clic de Correos pide ir al top de la lista',
    /state\._resetMailListScroll = true/.test(oc));
  chk('el clic de Correos cambia a la vista de correo',
    /setCalendarVisible\(false\)/.test(oc));

  // ══ 6) "No leidos" sale del menu "Mas" a la barra visible ══
  chk('la barra visible incluye el filtro "unread"',
    /const PRIMARY_FILTERS = \["all", "unread", "sent"\];/.test(cod),
    'sin esto el filtro sigue escondido en "Mas" y la UI no lo alcanza');
  chk('el filtro "unread" sigue existiendo en la definicion',
    /\{ id: "unread", label: "No le/.test(cod));
  chk('la logica de la lista sigue respetando mailFilter === "unread"',
    // 📦858-INVERTIDO — la forma cambió, la regla no.
  // Antes el chip hacía `return !!m.unread`, y esa salida temprana se comía el
  // filtro por día del mini-calendario: con "No leídos" activo, la función
  // salía antes de comparar la fecha. Ahora el chip DECIDE y el día se le
  // suma encima. Lo que este check protege sigue igual: la lista respeta el
  // filtro de no leídos. Solo cambió cómo se escribe.
  /if \(state\.mailFilter === "unread"\) pasa = !!m\.unread;/.test(cod),
    'sino el boton se pinta pero no filtra nada');

  // ══ 7) "Invitaciones pendientes" se retiro ══
  // Contaba m.meetingSuggestion, y ese campo solo existe en los correos de
  // ejemplo de data.js: ningun camino del correo real lo escribe. La fila
  // mostraba "—" para siempre, que se lee como un dato y no lo es.
  chk('calcularIndicadores ya NO devuelve invitaciones',
    cod.indexOf('kpi-invitaciones') < 0,
    'vuelve a contar un campo que nadie escribe');
  chk('el calculo ya no usa meetingSuggestion',
    /const pending = state\.mails\.filter\(\(m\) => m\.meetingSuggestion/.test(cod) === false);
  chk('el calculo ya no acumula "pending"',
    /\bnpending\b/.test(cod) === false,
    'una variable muerta es codigo que el proximo lee como si significara algo');
  chk('quedan 2 indicadores, no 3',
    (cod.match(/id: "kpi-/g) || []).length === 2,
    'indicadores=' + (cod.match(/id: "kpi-/g) || []).length);

  // ══ 8) CSS: la animacion del pillon ══
  chk('existe la regla del pillon',
    /\.tuday__badge \{/.test(css));
  chk('la animacion del pillon tiene keyframes propios',
    /@keyframes tuday-pulse/.test(css));
  // Aviso, no alarma: tres pulsos y quieto. Un loop infinito en una tarjeta que
  // vive siempre a la vista se vuelve ruido y deja de leerse.
  chk('la animacion del pillon NO es infinita',
    /animation: tuday-pulse [^;]*\b3;/.test(css) && !/animation: tuday-pulse[^;]*infinite/.test(css),
    'un infinite en una tarjeta permanente molesta y uno aprende a ignorarlo');
  chk('la animacion del pillon dura menos de 300ms por ciclo',
    (function () {
      const m = /animation: tuday-pulse (\d+)ms/.exec(css);
      return m ? Number(m[1]) < 300 : false;
    })(), 'el repo exige animaciones de menos de 300ms');
  // Los bloques internos se extraen y se revisan aparte. Con `[^}]*` no se
  // llegaba al 50% (se detiene en el primer "}"), y con `[\s\S]*?` sin limite
  // se salia del keyframes y revisaba el resto del CSS, encontrando "top" o
  // "left" en reglas lejanas. Las dos formas mienten.
  const KF = /@keyframes tuday-pulse \{\s*0%, 100% \{([^}]*)\}\s*50% \{([^}]*)\}\s*\}/.exec(css);
  chk('la animacion solo toca transform (GPU, sin layout)',
    !!KF && /transform/.test(KF[1]) && /transform/.test(KF[2])
    && !/width|height|top|left|opacity/.test(KF[1] + KF[2]),
    KF ? 'encontrado: ' + KF[1] + ' | ' + KF[2] : 'no se pudo aislar el bloque tuday-pulse');
  chk('prefers-reduced-motion anula la animacion del pillon',
    /@media \(prefers-reduced-motion: reduce\)[\s\S]{0,200}\.tuday__badge \{ animation: none;/.test(css));

  // ══ 9) Sin CJK en lo que se toco ══
  chk('sin CJK / cirilico / hangul en el JS',
    (js.match(RANGO_CJK) || []).length === 0);
  chk('sin CJK / cirilico / hangul en el CSS',
    (css.match(RANGO_CJK) || []).length === 0);

  return { f: fallos.length, n, fallos };
}

// ═══════════════ funcional: el escenario que FALLA en la app ═══════════════
// La version anterior de este test comprobaba `nuevo` con el localStorage ya
// sembrado, o sea el caso FACIL. El caso que rompio en la app es el otro:
// nunca hubo linea base porque el owner no habia hecho clic, y con eso el
// aviso no aparecia nunca. Este bloque parte de un localStorage VACIO.
function cuerpoDe(js, nombre) {
  const LL = js.split('\n');
  const i = LL.findIndex((l) => new RegExp('function ' + nombre + '\\s*\\(').test(l));
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

function funcionalEscenario(realJs) {
  const fallos = [];
  let n = 0;
  const chk = (nombre, c, e) => { n++; if (!c) fallos.push(nombre + (e ? '  [' + e + ']' : '')); };

  const clave = (realJs.match(/const TUDIA_VISTOS = [^;]+;/) || [''])[0];
  // `_marcarNotifsCorreoLeidas` va included porque `calcularIndicadores` la
  // llama desde su go(): sin ella en el sandbox el escenario revienta con
  // ReferenceError y no prueba nada.
  // 📦855 — `setMailFilter` y `mailPasaFiltroActual` tambien van: el go() de
  // kpi-correos ahora cambia el filtro por `setMailFilter`, que llama al
  // predicado compartido. Sin los dos, el escenario revienta con
  // "setMailFilter is not defined" y no prueba nada.
  const partes = ['_leerVistos', '_marcarVisto', '_sembrarVistos',
    '_marcarNotifsCorreoLeidas', 'calcularIndicadores',
    'mailPasaFiltroActual', 'setMailFilter']
    .map((nm) => cuerpoDe(realJs, nm));

  chk('las funciones de novedad se extraen del codigo real',
    partes.every((p) => p.length > 10) && clave.length > 0,
    'longitudes=' + partes.map((p) => p.length).join(','));
  chk('_sembrarVistos existe: sin ella la linea base nunca se siembra',
    partes[2].length > 10);
  chk('_marcarNotifsCorreoLeidas existe: sin ella el 99+ nunca baja',
    partes[3].length > 10);

  const codigo = clave + '\n' + partes.join('\n');
  const nuevosDe = 'calcularIndicadores().map(function (x) { return x.nuevo; })';
  const HOY = '2026-10-03';

  // Cada escenario arranca con un sandbox NUEVO y un localStorage VACIO. No se
  // puede reutilizar uno entre correos y reuniones: la siembra solo rellena las
  // claves que faltan, asi que si "reuniones" ya quedo en 0 sembrado cuando no
  // habia eventos, el escenario de reuniones arrancaria con linea base 0 y
  // contaria como nuevo lo que el owner ya tenia. Eso daria un fallo por un
  // motivo equivocado, que es peor que no tener el test.
  function nuevo() {
    const sb = {
      res: null,
      state: { mails: [], events: [] },
      D: { MONTH_VIEW: { todayIso: HOY }, ICONS: { mail: '<i/>', calendarPlus: '<i/>' } },
      setCalendarVisible() {},
      // El helper de notificaciones sale por `getElectronAPI() === null`: sin
      // bridge no hay nada que marcar y no debe romper la navegacion.
      getElectronAPI() { return null; },
      window: null,
      String: String, Number: Number,
    };
    const d = {};
    sb.localStorage = {
      getItem: (k) => (Object.prototype.hasOwnProperty.call(d, k) ? d[k] : null),
      setItem: (k, v) => { d[k] = String(v); },
    };
    sb.globalThis = sb;
    vm.createContext(sb);
    // Las declaraciones se evaluan UNA sola vez: volver a correrlas en el mismo
    // contexto tira "Identifier 'TUDIA_VISTOS' has already been declared".
    vm.runInContext(codigo, sb);
    sb.paso = (expr) => vm.runInContext('res = ' + expr + ';', sb);
    return sb;
  }
  const ver = (sb) => sb.res;

  try {
    // ── Correos ──
    let sb = nuevo();
    sb.state.mails = [{ unread: true }, { unread: true }, { unread: false }];
    sb.paso('(function(){ _sembrarVistos(); return ' + nuevosDe + '; })()');
    chk('al arrancar no hay nada marcado como nuevo (los 2 ya eran conocidos)',
      ver(sb)[0] === 0, 'nuevos=' + JSON.stringify(ver(sb)));

    // ESTE es el caso que el owner reporto: llega un correo y el aviso no aparece.
    sb.state.mails = [{ unread: true }, { unread: true }, { unread: false }, { unread: true }];
    sb.paso(nuevosDe);
    chk('📦853 · al llegar un correo el pillon marca 1 (el bug que reporto el owner)',
      ver(sb)[0] === 1, 'nuevos=' + JSON.stringify(ver(sb)) + '  (0 = el pillon nunca aparece)');

    // El owner hace clic: "mirar" es ver, asi que el aviso se apaga.
    sb.paso('(function(){ calcularIndicadores()[0].go(); return ' + nuevosDe + '; })()');
    chk('tras hacer clic en el indicador el aviso baja a 0',
      ver(sb)[0] === 0, 'nuevos=' + JSON.stringify(ver(sb)));

    // Llega otro mas: vuelve a marcar 1, no se queda en 0 para siempre.
    sb.state.mails.push({ unread: true });
    sb.paso(nuevosDe);
    chk('llega otro correo y vuelve a marcar 1',
      ver(sb)[0] === 1, 'nuevos=' + JSON.stringify(ver(sb)));

    // Si el owner lee todo en el celular, el numero baja por debajo de la linea
    // base: eso NO es "-1", es 0.
    sb.state.mails = [{ unread: false }];
    sb.paso(nuevosDe);
    chk('si baja de la linea base el aviso es 0, nunca negativo',
      ver(sb)[0] === 0, 'nuevos=' + JSON.stringify(ver(sb)));

    // Y aqui esta el agujero. El caso anterior se detiene en el 0 del instante
    // y nunca pregunta que pasa DESPUES, que es justo cuando el owner espera la
    // senal. La linea base guardada seguia en 4 (la del clic), asi que el
    // proximo correo nuevo daba max(0, 1 - 4) = 0: el aviso quedaba muerto y
    // no volvia a prender hasta accumulates 5 sin leer. Y leer en Gmail es
    // precisamente como el owner despacha el correo, o sea que este no es un
    // caso raro: es el camino normal de cada dia.
    sb.state.mails = [{ unread: true }];
    sb.paso(nuevosDe);
    chk('📦853-fix · un correo que LLEGA despues de leer en Gmail vuelve a marcar 1',
      ver(sb)[0] === 1, 'nuevos=' + JSON.stringify(ver(sb)) + '  (0 = el aviso queda apagado para siempre)');

    // ── Reuniones, desde un sandbox limpio ──
    sb = nuevo();
    sb.state.events = [{ date: HOY, start: '09:00' }, { date: HOY, start: '10:00' }];
    sb.paso('(function(){ _sembrarVistos(); return ' + nuevosDe + '; })()');
    chk('reuniones quedan en 0 al arrancar con 2 en el dia',
      ver(sb)[1] === 0, 'nuevos=' + JSON.stringify(ver(sb)));
    sb.state.events.push({ date: HOY, start: '11:00' });
    sb.paso(nuevosDe);
    chk('una reunion mas marca 1 en reuniones',
      ver(sb)[1] === 1, 'nuevos=' + JSON.stringify(ver(sb)));
  } catch (e) {
    chk('el escenario corre sin romperse', false, e.message);
  }

  return { f: fallos.length, n, fallos };
}
const crudo = {
  htm: fs.readFileSync(path.join(DIR, 'index.html'), 'utf8'),
  css: fs.readFileSync(path.join(DIR, 'premium.css'), 'utf8'),
  js: fs.readFileSync(path.join(DIR, 'app.js'), 'utf8'),
};
const htm = crudo.htm.replace(/\r\n/g, '\n');
const css = crudo.css.replace(/\r\n/g, '\n');
const js = crudo.js.replace(/\r\n/g, '\n');
const real = evaluar(htm, css, js);
// El escenario funcional corre sobre el archivo REAL, una sola vez: no se
// puede mutar (muta el sandbox, no el código) y no cuenta para las mutaciones.
const func = funcionalEscenario(js);
real.n += func.n;
real.f += func.f;
func.fallos.forEach((f) => real.fallos.push(f));

[['app.js sigue en CRLF', eolDe(crudo.js), 'CRLF'],
 ['index.html sigue en CRLF', eolDe(crudo.htm), 'CRLF'],
 ['premium.css sigue en LF', eolDe(crudo.css), 'LF']].forEach(e => {
  real.n++;
  if (e[1] !== e[2]) { real.f++; real.fallos.push(e[0] + '  [' + e[1] + ', esperado ' + e[2] + ']'); }
});

// ═══════════════ mutation testing ═══════════════
const MUT = [
  ['init() deja de sembrar la linea base (el aviso nunca aparece: el bug reportado)',
    j => j.replace('    _sembrarVistos();\n', '')],
  ['la siembra se ejecuta ANTES de cargar los datos (linea base 0, todo seria nuevo)',
    j => j.replace('    _sembrarVistos();\n    console.log("[BandejaIntegrada][INIT]', '    console.log("[BandejaIntegrada][INIT]')
      .replace('  function _sembrarVistos() {', '  function _sembrarVistos() { void 0;')],
  ['la siembra sobrescribe siempre (el aviso se apaga solo en cada arranque)',
    j => j.replace('if (!Object.prototype.hasOwnProperty.call(v, k)) { v[k] = actuales[k]; cambio = true; }',
      'v[k] = actuales[k]; cambio = true;')],
  // 📦855 — Estas dos apuntaban a `state.mailFilter = "unread";`, que ya no
  // existe (ahora es setMailFilter). Un replace que no encuentra nada devuelve
  // el archivo IDENTICO, la mutacion queda vacia y el check "pasa" siempre: se
  // reportaba como mutante vacio, que es la senal de que el check no morderia.
  ['el clic de Correos deja de aplicar el filtro (vuelve el bug reportado)',
    j => j.replace(/setMailFilter\("unread"\);\s*state\._resetMailListScroll = true;/,
      'setMailFilter("all");\n          state._resetMailListScroll = true;')],
  ['el clic de Correos no cambia a la vista de correo',
    j => j.replace('setMailFilter("unread");\n          state._resetMailListScroll = true;\n          setCalendarVisible(false);',
      'setMailFilter("unread");\n          state._resetMailListScroll = true;')],
  ['"No leidos" vuelve al menu "Mas"',
    j => j.replace('const PRIMARY_FILTERS = ["all", "unread", "sent"];',
      'const PRIMARY_FILTERS = ["all", "sent"];')],
  ['alguien vuelve a meter un switch de alertas (el owner pidio pillon)',
    j => j.replace('    tuDia.innerHTML =', '    tuDia.innerHTML = \'<button id="tuday-switch" role="switch" class="tuday__sw" aria-checked="true"></button>\';')],
  ['alguien deja la clave del switch guardada otra vez',
    j => j.replace('  const TUDIA_VISTOS =', '  const TUDIA_ALERTAS = "kair-bandeja.tuDiaAlertas";\n  const TUDIA_VISTOS =')],
  ['"nuevo" pasa a ser el numero actual (marca todo desde el primer render)',
    j => j.replace('      return actual - visto;', '      return actual;')],
  ['la linea base no baja con el numero (el aviso queda muerto tras leer en Gmail)',
    j => j.replace('if (actual < visto) { _marcarVisto(key, actual); return 0; }', '')],
  ['la linea base baja pero se olvida de guardarla (vuelve a desaparecer al recargar)',
    j => j.replace('if (actual < visto) { _marcarVisto(key, actual); return 0; }',
      'if (actual < visto) { return 0; }')],
  ['sin linea base, NaN llega al pillon',
    j => j.replace('if (!isFinite(visto) || visto < 0) return 0;', '')],
  ['hacer clic deja de marcar lo visto (el pillon no baja nunca)',
    j => j.replace('_marcarVisto("correos", unread);', '/* sin marcar */')],
  ['el pillon se pinta siempre, con o sin novedad',
    j => j.replace('const hayNuevo = it.nuevo > 0;', 'const hayNuevo = true;')],
  ['el pillon pierde el tope 99+',
    j => j.replace('(it.nuevo > 99 ? "99+" : it.nuevo)', 'String(it.nuevo)')],
  // 📦854 · Estas tres mutaciones eran del anclaje al ICONO, que ya no existe:
  // el owner corrigio que el pillon cuelgue de la esquina de la FILA. Se
  // reemplazaron por una que reintroduce el envoltorio viejo, que es la
  // regresion que si importa.
  ['el envoltorio del icono reaparece (el pillon se despega de la esquina)',
    c => c.replace('.tuday__i.is-new { position: relative;',
      '.tuday__ico-wrap { position: relative; display: flex; flex: 0 0 28px; }\n.tuday__i.is-new { position: static;')],
  ['la fila deja de tintarse de rojo (el aviso ya no se ve de reojo)',
    c => c.replace('.tuday__i.is-new { position: relative; background: var(--kair-red-soft); }',
      '.tuday__i.is-new { position: relative; }')],
  ['el pillon vuelve a pegarse al icono (se lee como etiqueta suelta)',
    c => c.replace('  top: 2px;\n  right: 2px;', '  top: -7px;\n  right: -9px;')],
  ['el pillon le pone un anillo blanco que el del shell no tiene',
    c => c.replace('  box-shadow: 0 1px 3px rgba(0, 0, 0, .25);', '  box-shadow: 0 0 0 2px #fff, 0 2px 6px rgba(0, 0, 0, .3);')],
  ['el pillon cambia de tamano y deja de coincidir con el 99+',
    c => c.replace('  min-width: 18px;\n  height: 18px;', '  min-width: 26px;\n  height: 26px;')],
  ['el clic ya no marca las notificaciones (el 99+ nunca baja)',
    j => j.replace('          _marcarNotifsCorreoLeidas();', '          /* sin marcar */')],
  ['marca TODAS las notificaciones en vez de solo las de correo',
    j => j.replace('.filter(function (n) { return n && n.tipo === "correo" && n.id > 0; })', '')],
  ['no refresca KairAlerts, el 99+ se queda con el numero viejo',
    j => j.replace('          if (KA && typeof KA.refresh === "function") KA.refresh();', '          /* sin refresh */')],
  ['la barra roja se sale por las esquinas redondeadas',
    c => c.replace('  border-radius: 0 3px 3px 0;', '  border-radius: 0;')],
  // Las dos siguientes necesitan ancla: sin ella el `replace` pega en la
  // PRIMERA coincidencia del archivo, que no es la que se quiere mutar.
  // "KA.refresh();" tambien esta en `refreshKairAlerts` (4 espacios, mas
  // arriba), y "#dc3545" tambien esta en `.tuday__i.is-new::before`.
  ['el pillon cambia de rojo (ya no parece el mismo aviso)',
    c => c.replace('.tuday__badge {\n  position: absolute;\n  top: 2px;\n  right: 2px;\n  min-width: 18px;\n  height: 18px;\n  padding: 0 5px;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  border-radius: 9px;\n  background: #dc3545;',
      '.tuday__badge {\n  position: absolute;\n  top: 2px;\n  right: 2px;\n  min-width: 18px;\n  height: 18px;\n  padding: 0 5px;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  border-radius: 9px;\n  background: var(--kair-blue);')],
  ['el pillon se puede clicar por accidente',
    c => c.replace('  pointer-events: none;\n  user-select: none;\n}', '  user-select: none;\n}')],
  ['la animacion del pillon se vuelve infinita',
    c => c.replace('animation: tuday-pulse 240ms ease-in-out 3;',
      'animation: tuday-pulse 240ms ease-in-out infinite;')],
  ['la animacion del pillon se alarga (pasa de 300ms)',
    c => c.replace('animation: tuday-pulse 240ms ease-in-out 3;',
      'animation: tuday-pulse 600ms ease-in-out 3;')],
  ['la animacion pasa a animar opacity (deja de ser GPU-only en transform)',
    c => c.replace('  50% { transform: scale(1.22); }', '  50% { opacity: .6; transform: scale(1.22); }')],
  ['prefers-reduced-motion deja de anular la animacion',
    c => c.replace('  .tuday__badge { animation: none; }\n', '')],
  ['la cabecera vuelve a ser una fila con el switch que ya no existe',
    c => c.replace('.tuday__t {\n  font-size: 11px;', '.tuday__h { display: flex; }\n.tuday__t {\n  font-size: 11px;')],
  ['el titulo pierde el margen inferior y la lista se pega al titulo',
    c => c.replace('  color: var(--kair-text-3);\n  margin-bottom: 6px;\n}', '  color: var(--kair-text-3);\n}')],
  ['alguien reinserta el indicador de invitaciones',
    j => j.replace('      // 📦853', '      { id: "kpi-invitaciones", icon: D.ICONS.link, tone: "is-amber",\n        value: kpiValue(0), n: 0, nuevo: 0, label: "Invitaciones pendientes", sub: "Requieren confirmar", go: function () {} },\n      // 📦853')],
  ['alguien vuelve a calcular pending con meetingSuggestion',
    j => j.replace('    const todayEvents = state.events.filter((e) => e.date === D.MONTH_VIEW.todayIso).length;',
      '    const todayEvents = state.events.filter((e) => e.date === D.MONTH_VIEW.todayIso).length;\n    const pending = state.mails.filter((m) => m.meetingSuggestion && m.unread).length;')],
  ['se cuela un caracter CJK en el JS',
    j => j.replace('const TUDIA_VISTOS =', 'const TUDIA_VISTOS = "\\u4e2d\\u6587"; const _x =')],
];

console.log('\n=======================================');
console.log('  📦853 · Aviso de novedad en "Tu dia" (pillon rojo)');
console.log('=======================================');
if (real.f) {
  console.log('--- CHECKS FALLIDOS ---');
  real.fallos.forEach(f => console.log('FAIL  ' + f));
} else {
  console.log('OK  ' + real.n + '/' + real.n + ' checks en verde');
}
console.log('--- mutation testing (' + MUT.length + ' mutantes) ---');
let mFallos = 0, vacios = 0, equiv = 0;
MUT.forEach(m => {
  const equivalente = m.length > 2 && m[2] === true;
  const mh = m[1](htm), mc = m[1](css), mj = m[1](js);
  if (mh === htm && mc === css && mj === js) {
    vacios++;
    console.log('FAIL MUTANTE VACIO ' + m[0] + '  [la mutacion no cambio nada]');
    return;
  }
  const d = evaluar(mh, mc, mj).f > 0;
  if (equivalente) {
    equiv++;
    console.log('OK  equivalente   ' + m[0] + '  [detectada=' + d + ', no exige deteccion]');
    return;
  }
  if (!d) mFallos++;
  console.log((d ? 'OK  detecta      ' : 'FAIL NO muerde   ') + m[0]);
});
console.log('---');
const exigidas = MUT.length - equiv;
console.log('checks: ' + (real.n - real.f) + '/' + real.n
  + '  ·  mutaciones detectadas: ' + (exigidas - mFallos - vacios) + '/' + exigidas
  + (vacios ? '  ·  mutantes vacios: ' + vacios : '')
  + (equiv ? '  ·  equivalentes declaradas: ' + equiv : ''));
console.log('=======================================');
process.exit(real.f === 0 && mFallos === 0 && vacios === 0 ? 0 : 1);
