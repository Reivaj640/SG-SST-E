/* Test del gate de consentimiento (📦873).
 *
 * El gate decide si alguien puede entrar a una aplicación que guarda historias clínicas.
 * Por eso su propiedad más importante NO es "muestra el overlay": es que **un fallo de
 * infraestructura nunca se confunda con un "no"**, y que un "no" del usuario nunca se
 * confunda con un fallo. Si se mezclan, pasa una de estas dos:
 *
 *   · el usuario ve "No acepto", la app le pide cerrar, y al reiniciar el overlay
 *     tampoco aparece — no puede trabajar;
 *   · o peor al revés: un error de base de datos hace que el gate se salte solo y el
 *     usuario registre tratamiento de datos sensibles sin haber autorizado nada.
 *
 * Eso no se prueba leyendo el código. Se prueba ejecutando la función de verdad,
 * sacada del renderer.js, contra un DOM y una API falsos.
 *
 * Que se verifica:
 *   A. El cableado existe y es coherente entre capas: preload expone los 3 métodos,
 *      main.js tiene los 3 canales, index.html tiene el overlay con los 2 checkboxes
 *      SIN premarcar, y renderer.js define la función.
 *   B. La política fail-open, caso por caso: API ausente, excepción, null del backend,
 *      overlay ausente → todos devuelven true.
 *   C. Que cuando SÍ hay que preguntar, pregunte: muestra el overlay y devuelve una
 *      promesa que no resuelve sola.
 *   D. Aceptar con los 3 flags → true. Aceptar sin marcar → NO resuelve y muestra error.
 *   E. Rechazar → false.
 *
 * El escape de la función se saca del renderer.js REAL, no de una copia: si alguien
 * cambia la política ahí, este test la evalúa tal cual quedó.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const rendererPath = path.join(ROOT, 'renderer.js');
const preloadPath = path.join(ROOT, 'preload.js');
const mainPath = path.join(ROOT, 'main.js');
const indexPath = path.join(ROOT, 'index.html');

const checks = [];
function chk(name, cond, extra) {
  checks.push({ name: name, ok: !!cond, extra: extra || '' });
}

// ───────────────────────── A. El cableado

function chkCableado() {
  const preload = fs.readFileSync(preloadPath, 'utf8');
  const main = fs.readFileSync(mainPath, 'utf8');
  const html = fs.readFileSync(indexPath, 'utf8');

  chk('preload expone consentEstado', /consentEstado:\s*\(\)\s*=>\s*ipcRenderer\.invoke\(\s*['"]consent:estado['"]/.test(preload));
  chk('preload expone consentRegistrar', /consentRegistrar:\s*\(\s*\w+\s*\)\s*=>\s*ipcRenderer\.invoke\(\s*['"]consent:registrar['"]/.test(preload));
  chk('preload expone consentRechazar', /consentRechazar:\s*\(\)\s*=>\s*ipcRenderer\.invoke\(\s*['"]consent:rechazar['"]/.test(preload));

  chk('main.js tiene el canal consent:estado', main.indexOf("ipcMain.handle('consent:estado'") !== -1);
  chk('main.js tiene el canal consent:registrar', main.indexOf("ipcMain.handle('consent:registrar'") !== -1);
  chk('main.js tiene el canal consent:rechazar', main.indexOf("ipcMain.handle('consent:rechazar'") !== -1);

  // El backend tiene que EXIGIR los tres flags. Si los aceptara opcionales, mandar solo dos
  // registraría una aceptación sin autorización de datos sensibles y el check de arriba
  // pasaría igual — por eso se comprueba la guarda, no solo el envío.
  chk('el backend exige los TRES flags (no acepta aceptación parcial)',
    /if\s*\(\s*!p\.aceptaTerminos\s*\|\|\s*!p\.aceptaDatos\s*\|\|\s*!p\.aceptaDatosSensibles\s*\)/.test(main));
  // validateSession devuelve { ok, session, user }: el email vive en .user.email, NO en
  // la raíz. Leerlo en la raíz daba undefined siempre, y como { ok:false } es truthy la
  // guarda !sesion nunca disparaba: el gate contestaba SESION_INVALIDA con una sesión
  // perfectamente válida y el consentimiento era IMPOSIBLE de registrar.
  //
  // El check anterior solo miraba que existiera una guarda con SESION_INVALIDA, así que
  // daba verde sobre el código roto. Este mira la FORMA que se consume.
  const iReg = main.indexOf("ipcMain.handle('consent:registrar'");
  const fReg = main.indexOf('ipcMain.handle(', iReg + 10);
  const bloqueRegistrar = main.slice(iReg, fReg === -1 ? main.length : fReg);
  // Se quitan los comentarios antes de mirar: el comentario que EXPLICA el bug menciona
  // `sesion.email`, y un check que lee prosa encuentra el texto que documenta el fallo en
  // vez de al código que lo tenía.
  const codigoRegistrar = bloqueRegistrar.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');
  chk('el backend valida la sesion por su forma real ({ ok, user })',
    iReg !== -1 && /sessionCheck\.ok/.test(codigoRegistrar) && /sessionCheck\.user\.email/.test(codigoRegistrar));
  chk('y NO lee el email en la raiz (esa era la forma que rompia)',
    /\bsesion\.email\b/.test(codigoRegistrar) === false,
    'queda un sesion.email en el codigo de consent:registrar');
  chk('inserta el nombre real del usuario (full_name, no un campo inexistente)',
    /usuario\.full_name/.test(codigoRegistrar) && /\bsesion\.nombres\b/.test(codigoRegistrar) === false);
  chk('el backend devuelve null ante error, para no bloquear el acceso',
    /consent:estado[\s\S]{0,900}catch[\s\S]{0,400}return null/.test(main));

  // El call site que otro wrote tiene que seguir ahí y seguir siendo fail-open en su guarda.
  chk('renderer.js llama al gate después del login', /await\s+ensureConsentGate\(\)/.test(fs.readFileSync(rendererPath, 'utf8')));
  chk('el call site sale de la app si el gate devuelve false',
    /if\s*\(consentOk\s*===\s*false\)\s*return;/.test(fs.readFileSync(rendererPath, 'utf8')));

  chk('index.html tiene el overlay del consentimiento',
    /id="kair-consent-overlay"[^>]*\bhidden\b/.test(html),
    'con hidden para arrancar oculto');
  chk('index.html tiene los 2 checkboxes', (html.match(/id="kair-consent-check-/g) || []).length === 2);
  chk('NINGUN checkbox viene premarcado',
    !/<input type="checkbox"[^>]*\bchecked\b/.test(html),
    'el consentimiento tiene que ser expreso, no preseleccionado');
  chk('el overlay tiene los dos botones (aceptar y rechazar)',
    html.indexOf('data-consent-action="accept"') !== -1 && html.indexOf('data-consent-action="reject"') !== -1);

  // El enlace a la política tiene que llevar el path del repo. Sin "/SG-SST-E/" la URL
  // devuelve el 404 de GitHub Pages ("There isn't a GitHub Pages site here") y el usuario
  // creye que la aplicacion esta caida. Verificado: con el path responde 200.
  const hrefPrivacidad = /class="kair-consent__link"[^>]*href="([^"]+)"/.exec(html);
  chk('el enlace a la política incluye el path del repo (si no, da 404)',
    !!hrefPrivacidad && hrefPrivacidad[1].indexOf('reivaj640.github.io/SG-SST-E/') !== -1,
    hrefPrivacidad ? hrefPrivacidad[1] : 'no se encontro el enlace');

  // Sin setWindowOpenHandler, un target="_blank" abre un BrowserWindow de Electron: el
  // 404 se ve dentro de una ventana con menu propio y parece un fallo de la app.
  chk('main.js manda los enlaces http/https al navegador del sistema',
    /setWindowOpenHandler\(\(\{\s*url\s*\}\)\s*=>\s*\{[\s\S]{0,400}shell\.openExternal/.test(main));
  chk('y solo intercepta http/https, para no romper la impression de los modulos',
    /setWindowOpenHandler[\s\S]{0,400}action:\s*'deny'[\s\S]{0,120}action:\s*'allow'/.test(main)
    && /\/\^https\?:\\\/\\\/\/i\.test\(url/.test(main));
  chk('el CSS tiene el [hidden] que anula el display:flex',
    /\.kair-consent-overlay\[hidden\]\s*\{\s*display:\s*none\s*!important/.test(fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8')));
  chk('el CSS del overlay está por encima del modal de actualizaciones',
    (function () {
      const m = /\.kair-consent-overlay\s*\{[\s\S]*?z-index:\s*(\d+)/.exec(fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8'));
      return m && Number(m[1]) > 500010;
    })());
}

// ───────────────────────── El DOM falso

/**
 * El DOM falso arranca en el MISMO estado en que lo deja el index.html real: el overlay
 * con `hidden`, el error con `hidden`, las casillas sin marcar. Si arrancaran visibles, los
 * checks "muestra el overlay" y "muestra el error" pasarían aunque la función no hiciera
 * nada — un test que no puede fallar no prueba nada (PROMPT.md §7.1).
 */
function crearDomFalso() {
  const listeners = {};
  const docListeners = {};
  function elemento(id, hiddenInicial) {
    return {
      id: id,
      hidden: !!hiddenInicial,
      disabled: false,
      checked: false,
      textContent: '',
      innerText: 'texto legal falso',
      scrollTop: 0,
      focus: function () {},
      addEventListener: function (ev, fn) { (listeners[id + ':' + ev] = listeners[id + ':' + ev] || []).push(fn); },
      removeEventListener: function (ev, fn) {
        const a = listeners[id + ':' + ev] || [];
        const i = a.indexOf(fn);
        if (i !== -1) a.splice(i, 1);
      },
      _disparar: function (ev, evento) { (listeners[id + ':' + ev] || []).slice().forEach(function (f) { f(evento || { preventDefault: function () {} }); }); },
      _tiene: function (ev) { return (listeners[id + ':' + ev] || []).length; },
      querySelector: function () { return null; }
    };
  }

  const els = {
    'kair-consent-overlay': elemento('kair-consent-overlay', true),
    'kair-consent-check-terminos': elemento('kair-consent-check-terminos'),
    'kair-consent-check-datos': elemento('kair-consent-check-datos'),
    'err': elemento('err', true),
    'aceptar': elemento('aceptar'),
    'rechazar': elemento('rechazar'),
    'cuerpo': elemento('cuerpo')
  };

  const porAttr = {
    '[data-consent-error]': els.err,
    '[data-consent-action="accept"]': els.aceptar,
    '[data-consent-action="reject"]': els.rechazar,
    '.kair-consent__body': els.cuerpo
  };

  return {
    _els: els,
    getElementById: function (id) { return els[id] || null; },
    querySelector: function (sel) { return porAttr[sel] || null; },
    addEventListener: function (ev, fn) { (docListeners[ev] = docListeners[ev] || []).push(fn); },
    removeEventListener: function (ev, fn) {
      const a = docListeners[ev] || [];
      const i = a.indexOf(fn);
      if (i !== -1) a.splice(i, 1);
    },
    _tecla: function (ev, evento) { (docListeners[ev] || []).slice().forEach(function (f) { f(evento); }); },
    _tieneDoc: function (ev) { return (docListeners[ev] || []).length; }
  };
}

function esperar(ms) {
  return new Promise(function (r) { setTimeout(r, ms === undefined ? 20 : ms); });
}

/**
 * Saca el bloque del gate del renderer.js real y lo evalúa con un DOM/API falsos.
 * Si la política se cambia en el renderer, este test evalúa el texto nuevo.
 */
function cargarGateCon(api, dom) {
  const src = fs.readFileSync(rendererPath, 'utf8');
  const ini = src.indexOf('const CONSENT_VERSION_TERMINOS');
  const fin = src.indexOf('async function initializeAuthFlow()');
  if (ini === -1 || fin === -1 || fin < ini) throw new Error('No se encontró el bloque del gate en renderer.js');
  const bloque = src.slice(ini, fin);

  const sandbox = {
    window: { electronAPI: api },
    document: dom,
    console: console,
    crypto: { subtle: { digest: function () { return Promise.resolve(new Uint8Array(32)); } } },
    TextEncoder: TextEncoder,
    authToken: 'tok-de-prueba',
    Promise: Promise,
    Object: Object, Array: Array, Math: Math, Number: Number, String: String,
    parseInt: parseInt, JSON: JSON, Error: Error, Boolean: Boolean
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(bloque, sandbox, { timeout: 5000 });
  return sandbox.ensureConsentGate;
}

// ───────────────────────── B/C/D/E. La política

async function chkPolitica() {
  const noFalla = async function (nombre, api, extra) {
    const dom = crearDomFalso();
    const gate = cargarGateCon(api, dom);
    const r = await gate();
    chk(nombre, r === true, (r === true ? '' : 'devolvió ' + JSON.stringify(r)) + (extra || ''));
  };

  await noFalla('sin electronAPI devuelve true (fail-open)', undefined);
  await noFalla('preload sin consentEstado devuelve true (fail-open)', {});

  await noFalla('consentEstado que lanza devuelve true (fail-open)', {
    consentEstado: function () { return Promise.reject(new Error('BD caida')); }
  });

  await noFalla('consentEstado que devuelve null devuelve true (fail-open, el backend asi señala)', {
    consentEstado: function () { return Promise.resolve(null); }
  });

  await noFalla('si no requiere consent, no pregunta y devuelve true', {
    consentEstado: function () { return Promise.resolve({ appVersion: '1', documentVersion: 'v1', requiere: false }); }
  });

  // Requiere consent pero el overlay no está en el DOM (index.html roto, p. ej.).
  {
    const gate = cargarGateCon(
      { consentEstado: function () { return Promise.resolve({ requiere: true }); } },
      { getElementById: function () { return null; }, querySelector: function () { return null; }, addEventListener: function () {} }
    );
    const r = await gate();
    chk('overlay ausente en el DOM devuelve true (fail-open, no bloquea el login)', r === true);
  }

  // ── Requiere consent y el overlay existe: ahí SÍ debe preguntar ──
  let dom, gate, registro, rechazarLlamado;
  const api = {
    consentEstado: function () { return Promise.resolve({ appVersion: '1.0', documentVersion: 'v1', requiere: true }); },
    consentRegistrar: function (p) { registro = p; return Promise.resolve({ success: true }); },
    consentRechazar: function () { rechazarLlamado = true; return Promise.resolve({ success: true }); }
  };

  function montar() {
    dom = crearDomFalso();
    registro = null;
    rechazarLlamado = false;
    gate = cargarGateCon(api, dom);
  }

  // Mostró el overlay y NO resolvió por su cuenta.
  //
  // OJO con el orden: `gate()` es async y primero consulta consentEstado. Recién en el
  // microtask siguiente registra los listeners de los botones. Si se dispara un click
  // sin esperar, el click se pierde, la promesa queda colgada para siempre y Node se sale
  // sin imprimir nada — que es exactamente lo que pasó la primera vez que se corrió esto.
  montar();
  let pendiente = gate();
  let resuelto = false;
  pendiente.then(function () { resuelto = true; });
  await esperar();
  chk('cuando requiere consent, muestra el overlay', dom._els['kair-consent-overlay'].hidden === false);
  chk('y la promesa sigue abierta: la app queda esperando al usuario', resuelto === false);

  // El consentimiento no es descartable con Escape.
  dom._tecla('keydown', { key: 'Escape', preventDefault: function () {} });
  await esperar();
  chk('Escape NO cierra el gate (el consentimiento no es descartable)',
    resuelto === false && dom._els['kair-consent-overlay'].hidden === false);

  // Aceptar SIN marcar nada → no debe pasar, y debe avisar.
  dom._els.aceptar._disparar('click');
  await esperar();
  chk('aceptar sin marcar ninguna casilla NO deja pasar', resuelto === false);
  chk('y muestra el error pidiendo las autorizaciones', dom._els.err.hidden === false, 'err.hidden=' + dom._els.err.hidden);
  chk('ni siquiera llama a consentRegistrar sin las dos marcadas', registro === null);

  // Marcar solo la primera → tampoco.
  dom._els['kair-consent-check-terminos'].checked = true;
  dom._els.aceptar._disparar('click');
  await esperar();
  chk('marcar solo Términos tampoco deja pasar', resuelto === false && registro === null);

  // Las dos → registra y deja pasar.
  dom._els['kair-consent-check-datos'].checked = true;
  dom._els.aceptar._disparar('click');
  const rFinal = await pendiente;
  chk('con las dos marcadas devuelve true y cierra el overlay', rFinal === true && dom._els['kair-consent-overlay'].hidden === true);
  chk('llamó consentRegistrar una vez', registro !== null);
  chk('envía los TRES flags que exige el backend',
    registro && registro.aceptaTerminos === true && registro.aceptaDatos === true && registro.aceptaDatosSensibles === true,
    registro ? JSON.stringify({ t: registro.aceptaTerminos, d: registro.aceptaDatos, s: registro.aceptaDatosSensibles }) : 'no llamo');
  chk('el checkbox de datos marca los DOS flags de datos', registro && registro.aceptaDatos === registro.aceptaDatosSensibles);
  chk('manda el token de sesión (el backend lo exige)', registro && registro.token === 'tok-de-prueba');
  chk('manda las versiones de los dos documentos',
    registro && !!registro.versionTerminos && !!registro.versionPrivacidad);
  chk('manda el hash del texto legal (prueba de QUÉ texto se leyó)',
    registro && typeof registro.textoHash === 'string' && registro.textoHash.length > 0,
    registro ? 'textoHash=' + JSON.stringify(registro.textoHash) : 'no llamo');

  // Rechazar → false, y avisa al backend.
  montar();
  const pRechazo = gate();
  await esperar();
  dom._els.rechazar._disparar('click');
  const rRechazo = await pRechazo;
  chk('rechazar devuelve false (la app no carga)', rRechazo === false);
  chk('rechazar avisa al backend para que cierre', rechazarLlamado === true);
  chk('rechazar cierra el overlay', dom._els['kair-consent-overlay'].hidden === true);
  chk('rechazar NO registra ninguna aceptación', registro === null);

  // Si el backend rechaza el registro, NO se deja pasar en silencio.
  montar();
  const apiFalla = {
    consentEstado: api.consentEstado,
    consentRegistrar: function () { return Promise.resolve({ success: false, error: 'FALTA_AUTORIZACION' }); },
    consentRechazar: api.consentRechazar
  };
  const dom2 = crearDomFalso();
  const gate2 = cargarGateCon(apiFalla, dom2);
  const p2 = gate2();
  await esperar();
  dom2._els['kair-consent-check-terminos'].checked = true;
  dom2._els['kair-consent-check-datos'].checked = true;
  dom2._els.aceptar._disparar('click');
  let r2 = 'sin-contestar';
  await Promise.race([p2.then(function (v) { r2 = v; }), esperar(60)]);
  chk('si el backend no confirma el registro, NO deja pasar (queda mostrando el error)',
    r2 === 'sin-contestar' && dom2._els.err.hidden === false,
    'r2=' + JSON.stringify(r2) + ' err.hidden=' + dom2._els.err.hidden);
  chk('y reactiva el botón para que el usuario pueda reintentar', dom2._els.aceptar.disabled === false);
}

// ───────────────────────── Correr

(async function main() {
  console.log('\n=======================================');
  console.log('  📦873 · Gate de consentimiento');
  console.log('=======================================');
  chkCableado();
  await chkPolitica();

  let failed = 0;
  checks.forEach(function (c) {
    if (!c.ok) failed++;
    console.log((c.ok ? 'OK  ' : 'FAIL') + '  ' + c.name + (c.extra ? '  [' + c.extra + ']' : ''));
  });
  console.log('---');
  console.log((checks.length - failed) + '/' + checks.length + ' OK');
  if (failed > 0) {
    console.log('FALLO \u2014 Hay tests que no pasaron.');
    process.exitCode = 1;
  }
})().catch(function (e) {
  console.error('[test-consent-gate] error inesperado:', e && e.stack ? e.stack : e);
  console.log('0/' + checks.length + ' OK');
  console.log('FALLO \u2014 Hay tests que no pasaron.');
  process.exitCode = 1;
});