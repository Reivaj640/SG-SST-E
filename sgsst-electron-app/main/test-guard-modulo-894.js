'use strict';
// Aviso de consola "[showModuleContent] Cambio de modulo bloqueado".
//
// QUE PASABA, EN ORDEN.
//
//   1. El usuario esta en Recursos y abre el submódulo 1.2.1 Capacitaciones.
//      showSubmoduleContent deja currentModule='Recursos' y
//      currentSubmodule='1.2.1 ...'.
//   2. Abre Configuración. showSettingsPage() monta un iframe sobre contentArea
//      y SE QUEDA AHÍ: no toca ni currentModule ni currentSubmodule. La vista ya
//      no es Recursos, pero el estado sigue diciendo que sí.
//   3. Cambia el tema desde Configuración. El bloque de refresco (renderer.js
//      ~1768) hace `showModuleContent(currentModule)` para repintar el modulo
//      visible, y showModuleContent arranca con este candado:
//          if (currentSubmodule) { console.warn('...bloqueado...'); return; }
//      currentSubmodule sigue siendo '1.2.1 ...', asi que se descarta. De ahi el
//      aviso, con su "Showing content for module: Recursos" de una linea antes.
//
// LO QUE HABIA DEBAJO DEL AVISO.
//
// El aviso es un console.warn, pero lo que tapa es un fallo de navegacion real: el
// estado quedo viejo, asi que el siguiente clic del sidebar en "Recursos" tambien
// caia en el mismo candado y no hacia NADA. Sin error, sin aviso, un boton muerto.
//
// POR QUE NO BASTABA CON SILENCIAR.
//
// Bajar el warn a info deja el boton muerto igual, solo que mas callado. La causa
// es que Configuracion TOMA el control de la vista y no lo registra. showModuleContent
// no tiene modo de saber que lo que hay en pantalla ya no es el modulo que dice
// currentModule.
//
// EL ARREGLO.
//
// showSettingsPage() registra la salida antes de borrar contentArea:
//
//     _salirDeSubmodulo('configuracion');
//     currentModule = null;
//
// _salirDeSubmodulo es la teardown que YA usan el sidebar (~4202) y el boton Volver
// (~5806): destruye el componente activo y pone currentSubmodule en null. No se
// invento teardown nueva, se reuso la que el proyecto ya tiene probada.
//
// currentModule se anula aparte, y por una razon distinta: el bloque de refresco de
// tema lo usa para recargar "el modulo visible". Si se dejara el valor viejo,
// arreglar el candado de showModuleContent expulsaria al usuario de Configuracion
// hacia Recursos en cuanto tocara el selector de tema. Arreglar el aviso sin esto
// cambia un fallo por otro.
//
// LO QUE ESTE TEST PROTEGE:
//
// 1. QUE EL ESTADO SE REGISTRE ANTES DE BORRAR LA VISTA. Si las dos lineas quedan
//    despues de `contentArea.innerHTML = ''`, el iframe ya se monto y el orden ya
//    no es el que importa, pero el test sigue pasando y el arreglo es fragil.
// 2. QUE SE USE LA TEARDOWN DE LA CASA, no una improvisada. Un destroy() propio
//    duplicaria la logica de watchers y modales que 843 ya centralizo.
// 3. QUE currentModule TAMBIÉN se anule. Es la parte que no se ve en el aviso.
// 4. QUE EL CANDADO SIGA EXISTIENDO. Este arreglo habilita al usuario a cambiar de
//    modulo: el candado era lo que impedia perder el estado del submódulo en una
//    recarga espuria. No se quita.
// 5. QUE currentModule EN NINGUN LECTOR SE USE SIN PROTEGER. Anularlo es seguro
//    porque los cinco lectores que hay ya lo comprueban. Si alguien agrega un
//    sexto que no lo compruebe, esto lo detecta.
const fs = require('fs');
const path = require('path');

const APP = path.join(__dirname, '..');
const REND = path.join(APP, 'renderer.js');

function cargar() { return { rend: fs.readFileSync(REND, 'utf8') }; }

function eolDe(t) {
  const b = Buffer.from(t, 'utf8');
  let crlf = 0; let lf = 0;
  for (let i = 0; i < b.length; i++) if (b[i] === 10) { if (i > 0 && b[i - 1] === 13) crlf++; else lf++; }
  return { crlf, lf };
}

// Recorta el cuerpo de una funcion a partir de su declaracion.
// Se quitan las lineas que son SOLO comentario: si no, un mutante que comenta
// una sentencia sigue "cumpliendo" el check porque el texto sigue ahi.
function cuerpoDe(src, cabecera) {
  const i = src.indexOf(cabecera);
  if (i < 0) return null;
  let desde = src.indexOf('{', i);
  let nivel = 0;
  for (let k = desde; k < src.length; k++) {
    if (src[k] === '{') nivel++;
    else if (src[k] === '}') { nivel--; if (nivel === 0) return src.slice(desde, k + 1); }
  }
  return null;
}

function sinComentariosDeLinea(t) {
  return t.split(/\r?\n/).filter(l => !/^\s*\/\//.test(l)).join('\n');
}

const registro = [];
const fallidos = [];
let n = 0;
function chk(nombre, cond, detalle) {
  n++;
  const ok = !!cond;
  registro.push({ n: nombre, c: ok });
  if (!ok) fallidos.push(detalle ? nombre + ' -> ' + detalle : nombre);
  return ok;
}

function evaluar(F) {
  const R = F.rend;

  const fSettings = sinComentariosDeLinea(cuerpoDe(R, 'function showSettingsPage(section)') || '');
  const fModule = sinComentariosDeLinea(cuerpoDe(R, 'function showModuleContent(moduleName)') || '');
  const fSalir = sinComentariosDeLinea(cuerpoDe(R, 'function _salirDeSubmodulo(motivo)') || '');
  const fCalendar = sinComentariosDeLinea(cuerpoDe(R, 'function showCalendarInModule') || '');

  chk('se encontro showSettingsPage()', !!cuerpoDe(R, 'function showSettingsPage(section)'));
  chk('se encontro showModuleContent()', !!cuerpoDe(R, 'function showModuleContent(moduleName)'));
  chk('se encontro _salirDeSubmodulo()', !!cuerpoDe(R, 'function _salirDeSubmodulo(motivo)'));

  if (!fSettings || !fModule || !fSalir) return { n, f: fallidos.length };

  // ---- 1. showSettingsPage registra la salida -------------------------------
  chk('Configuracion · llama a la teardown del proyecto',
    /_salirDeSubmodulo\(/.test(fSettings),
    'showSettingsPage no destruye el componente activo del submódulo');
  chk('Configuracion · pasa un motivo legible al log',
    /_salirDeSubmodulo\('[^']+'\)/.test(fSettings));

  chk('Configuracion · anula currentModule',
    /currentModule\s*=\s*null\s*;/.test(fSettings),
    'sin esto, el refresco de tema expulsa de Configuración hacia el módulo viejo');

  // ---- 2. Y lo hace ANTES de borrar la vista --------------------------------
  const iSalir = fSettings.indexOf('_salirDeSubmodulo(');
  const iNull = fSettings.search(/currentModule\s*=\s*null\s*;/);
  const iWipe = fSettings.indexOf('contentArea.innerHTML = ' + "'" + '');
  chk('Configuracion · existe el punto donde se borra la vista', iWipe >= 0);
  if (iWipe >= 0) {
    chk('Configuracion · la teardown va ANTES de borrar contentArea',
      iSalir >= 0 && iSalir < iWipe,
      'la teardown quedo despues del borrado: orden invertido');
    chk('Configuracion · el estado se registra ANTES de borrar contentArea',
      iNull >= 0 && iNull < iWipe,
      'currentModule quedo despues del borrado: orden invertido');
  }
  chk('Configuracion · la teardown y el estado van juntos (sin codigo huérfano entre medias)',
    iSalir >= 0 && iNull >= 0 && Math.abs(iSalir - iNull) < 200,
    'separadas: ' + iSalir + ' vs ' + iNull);

  // ---- 3. Que use la teardown de la casa, no una improvisada ---------------
  chk('Configuracion · NO implementa su propio destroy del componente',
    !/currentActiveComponent\.destroy\(/.test(fSettings),
    'duplica la teardown que 843 ya centralizo');
  chk('_salirDeSubmodulo · destruye el componente activo',
    /currentActiveComponent\.destroy\(\)/.test(fSalir));
  chk('_salirDeSubmodulo · limpia currentSubmodule',
    /currentSubmodule\s*=\s*null\s*;/.test(fSalir),
    'sin esto el candado de showModuleContent seguiria bloqueando');
  chk('_salirDeSubmodulo · un destroy que revienta no tranca la navegacion',
    /catch\s*\([^)]*\)\s*\{[\s\S]{0,400}?finally/.test(fSalir),
    'sin try/finally, un destroy con error deja currentSubmodule sucio');
  chk('_salirDeSubmodulo · libera currentActiveComponent en el finally',
    /finally\s*\{[\s\S]{0,120}?currentActiveComponent\s*=\s*null/.test(fSalir));

  // ---- 4. Que el candado siga existiendo -----------------------------------
  chk('showModuleContent · el candado de submódulo sigue en su sitio',
    /if\s*\(currentSubmodule\)\s*\{[\s\S]{0,200}?return\s*;/.test(fModule),
    'este arreglo habilita al usuario a cambiar de modulo: el candado sigue protegiendo');
  chk('showModuleContent · avisa cuando bloquea',
    /\[showModuleContent\] Cambio de m[oó]dulo bloqueado/.test(fModule),
    'el warn documenta el caso; no debe desaparecer en silencio');

  // ---- 5. Que anular currentModule sea seguro ------------------------------
  // La invariante que importa no es "nadie lee currentModule": hay cinco lecturas
  // legitimas y varias viven en closures que solo se disparan desde su propio
  // submódulo. Lo que SI rompe es DESREFERENCIARLO con el valor nulo
  // (currentModule.toUpperCase()), porque eso es un TypeError, no un valor raro.
  const sinComentarios = R.split(/\r?\n/)
    .map(l => l.replace(/^\s*\/\/.*$/, ''))
    .filter(l => l.trim() !== '');
  const desrefs = [];
  for (let i = 0; i < sinComentarios.length; i++) {
    if (!/currentModule\s*[.[]/.test(sinComentarios[i])) continue;
    const ventana = sinComentarios.slice(Math.max(0, i - 4), i + 1).join(' ');
    const protege = /!\s*currentModule|currentModule\s*&&|typeof currentModule|currentModule\s*\?|currentModule\s*\|\|/.test(ventana);
    if (!protege) desrefs.push(sinComentarios[i].trim());
  }
  chk('lectores · nadie desreferencia currentModule sin comprobarlo',
    desrefs.length === 0,
    'desreferencias sin guarda -> ' + desrefs.join(' | '));

  // Y los tres lectores que SI pueden correr con currentModule nulo:
  chk('calendario · se niega a crearse si no hay modulo',
    /if\s*\(\s*!currentModule\s*\|\|/.test(fCalendar || ''),
    'showCalendarInModule leeria null y podria crear un calendario sobre el iframe');
  chk('tema · el refresco de postMessage y el de setTheme lo comprueban',
    (R.match(/if\s*\(typeof currentModule !== 'undefined' && currentModule\)\s*\{/g) || []).length >= 3,
    'se perdio alguna de las tres guardas del refresco de tema');

  // ---- 8. EOL y caracteres -------------------------------------------------
  chk('Configuracion · no recarga ningun modulo por su cuenta',
    !/showModuleContent\s*\(/.test(fSettings),
    'showSettingsPage no debe llamar a showModuleContent');
  const e = eolDe(R);
  chk('EOL · renderer.js sigue en CRLF puro', e.crlf > 0 && e.lf === 0, 'LF=' + e.lf);
  chk('caracteres · sin U+FFFD', R.indexOf('\uFFFD') < 0);
  const mal = /[\u4e00-\u9fff\u3040-\u30ff\u0400-\u04ff\uac00-\ud7af]/g;
  chk('caracteres · sin CJK, cirilico ni hangul', !mal.test(R));

  return { n, f: fallidos.length };
}

// ── Mutaciones ──────────────────────────────────────────────────────────────
const F0 = cargar();

// Sustituye DENTRO del cuerpo de una funcion. Sin esto, un replace global puede
// pegarle al `if (currentSubmodule)` de showCalendarInModule (que tambien lo tiene)
// y la mutacion estaria midiendo otra cosa.
function reemplazarEn(src, cabecera, buscar, reemplazar) {
  const cuerpo = cuerpoDe(src, cabecera);
  if (!cuerpo) throw new Error('no se encontro ' + cabecera);
  const hay = (buscar instanceof RegExp) ? buscar.test(cuerpo) : cuerpo.indexOf(buscar) >= 0;
  if (!hay) throw new Error('no se encontro el texto dentro de ' + cabecera);
  return src.replace(cuerpo, cuerpo.replace(buscar, reemplazar));
}

const MUT = [
  ['showSettingsPage deja de llamar a la teardown',
    f => { f.rend = f.rend.replace(/^[ \t]*_salirDeSubmodulo\('configuracion'\);\r?$/m, ''); }],
  ['showSettingsPage deja de anular currentModule',
    f => { f.rend = f.rend.replace(/^([ \t]*)currentModule = null;\r?$/m, '$1// currentModule = null;'); }],
  ['el estado se registra despues de borrar la vista',
    f => {
      // se quita la teardown de su sitio y se cuela despues del borrado
      const linea = "    _salirDeSubmodulo('configuracion');\r\n";
      if (f.rend.indexOf(linea) < 0) throw new Error('no se encuentra la linea de teardown');
      f.rend = f.rend.replace(linea, '');
      f.rend = f.rend.replace(
        'contentArea.innerHTML = ' + "'" + '' + '; // Limpiar contenido anterior',
        'contentArea.innerHTML = ' + "'" + '' + '; // Limpiar contenido anterior\r\n    _salirDeSubmodulo(' + "'configuracion'" + ');');
    }],
  ['_salirDeSubmodulo deja de limpiar currentSubmodule',
    f => {
      f.rend = reemplazarEn(f.rend, 'function _salirDeSubmodulo(motivo)',
        /currentSubmodule = null;/, '// currentSubmodule = null;');
    }],
  ['se elimina el candado de showModuleContent',
    f => {
      f.rend = reemplazarEn(f.rend, 'function showModuleContent(moduleName)',
        /if \(currentSubmodule\) \{[\s\S]{0,200}?return;\r?\n\s*\}/, '// candado retirado');
    }],
  ['se silencia el warn del candado',
    f => { f.rend = f.rend.replace('[showModuleContent] Cambio de m', '[NAV] m'); }],
  ['_salirDeSubmodulo se queda sin try/finally',
    f => { f.rend = f.rend.replace(/\}\s*catch \(e\) \{[\s\S]*?\n\s*\} finally \{/, '}\n  if (false) {').replace(/if \(false\) \{[\s\S]*?currentActiveComponent = null;\r?\n\s*\}/, ''); }],
  ['Configuracion implementa su propio destroy en vez de reusar la teardown',
    f => { f.rend = f.rend.replace("_salirDeSubmodulo('configuracion');", "_salirDeSubmodulo('configuracion'); if (currentActiveComponent) currentActiveComponent.destroy();"); }],
  ['un lector nuevo de currentModule usa el valor sin comprobarlo',
    f => { f.rend = f.rend + '\nfunction _unLectorInseguro() { return currentModule.toUpperCase(); }\n'; }],
  ['el refresco de tema deja de comprobar currentModule',
    f => { f.rend = f.rend.replace("if (typeof currentModule !== 'undefined' && currentModule) {", 'if (true) {'); }],
  ['showCalendarInModule deja de comprobar currentModule',
    f => { f.rend = f.rend.replace('if (!currentModule || !MODULES_WITH_CALENDAR.includes(currentModule)) {', 'if (!MODULES_WITH_CALENDAR.includes(currentModule)) {'); }],
  ['renderer.js pasa a LF',
    f => { f.rend = f.rend.split('\r\n').join('\n'); }],
  ['se cuela un caracter prohibido',
    // en escapes, no literal: el archivo de test tambien cumple la regla
    f => { f.rend = f.rend.replace('// 📦843 ·', '// 📦843 \u57f9\u8bad ·'); }]
];

let mutDetectadas = 0; let mutVacias = 0;
for (const par of MUT) {
  const nombre = par[0]; const aplicar = par[1];
  const F = { rend: F0.rend };
  try { aplicar(F); } catch (e) { mutVacias++; console.log('FAIL MUTANTE LANZO ' + nombre + ': ' + e.message); continue; }
  if (F.rend === F0.rend) { mutVacias++; console.log('FAIL MUTANTE VACIO ' + nombre); continue; }
  fallidos.length = 0; registro.length = 0; n = 0;
  const r = evaluar(F);
  if (r.f > 0) mutDetectadas++;
  else console.log('FAIL MUTANTE NO DETECTADO ' + nombre);
}

// ── Corrida base ────────────────────────────────────────────────────────────
fallidos.length = 0; registro.length = 0; n = 0;
const base = evaluar(F0);

const checks = registro.slice();
checks.push({ n: 'mutaciones: ' + mutDetectadas + '/' + MUT.length + ' detectadas', c: mutDetectadas === MUT.length });
checks.push({ n: 'mutaciones vacias: ' + mutVacias, c: mutVacias === 0 });
checks.push({ n: 'checks base: ' + (base.n - base.f) + '/' + base.n, c: base.f === 0 });

const bad = checks.filter(c => !c.c);
if (process.env.VERBOSO) {
  checks.forEach(c => console.log((c.c ? '  ok  ' : ' FALLA') + ' ' + c.n));
  if (fallidos.length) { console.log('\nDetalle:'); fallidos.forEach(f => console.log('  - ' + f)); }
}
console.log((checks.length - bad.length) + '/' + checks.length + ' OK');
process.exit(bad.length === 0 ? 0 : 1);
