/**
 * 📦889 · kair-iframe-theme.js
 * Sincroniza el tema del shell con el <html> de una vista que se carga en un
 * IFRAME.
 *
 * ── POR QUÉ EXISTE ─────────────────────────────────────────────────────────
 * Un iframe es otro documento. El atributo `data-theme` lo aplica el shell a SU
 * propio <html>; dentro del iframe no se ve ni por herencia ni por cascada,
 * porque son dos árboles distintos. Por eso los bloques `[data-theme="dark"]`
 * de una vista embebida no casan nunca y la vista se queda en claro aunque el
 * shell esté en oscuro. Es un fallo silencioso: el CSS está correcto, lo que
 * falta es el atributo que lo dispara.
 *
 * ── LAS TRES FORMAS DE MENSAJE QUE MANDA LA APP REAL ───────────────────────
 * OJO: NO es la de `scripts/theme-manager.js`, porque ese archivo NO está
 * cargado en el shell. Las que llegan de verdad son:
 *
 *   1) `get-theme-response` -> { theme: <RESUELTO> }                    renderer.js:2006
 *      Sin preferencia ni modo: `theme` YA viene resuelto.
 *   2) `theme-changed` -> { theme: <PREFERENCIA>, effectiveTheme: <RESUELTO> }
 *      renderer.js:1756 y renderer.js:7445.
 *   3) Escritura directa en `iframe.contentDocument.documentElement`, sin
 *      mensaje: renderer.js:1746 y renderer.js:7418.
 *
 * La 1 es la trampa: el oscuro MANUAL llega como `theme: 'dark-legacy'`, que NO
 * es un alias de `dark`. Un código que solo acepte 'dark' lo da por claro y le
 * QUITA el atributo, y entonces el modo manual no pinta mientras el de sistema
 * sí — el fallo más difícil de ver, porque una de las dos formas funciona.
 *
 * ── USO ────────────────────────────────────────────────────────────────────
 * Añadir en el <head> de la vista, antes de cualquier <style> propio:
 *   <script src="../../../shared/kair-iframe-theme.js?v=<sello>"></script>
 * La versión en el `?v=` es obligatoria: el Electron sirve el script desde caché
 * y sin ella el fix no llega nunca a la vista.
 */
(function () {
  'use strict';

  var YA_PUSHEO = false;

  /**
   * Aplica el tema recibido al <html> del iframe.
   * @param {Object} d Mensaje del shell. Se aceptan las formas 1 y 2.
   */
  function kairIframeApplyTheme(d) {
    d = d || {};
    var html = document.documentElement;
    var pref = d.theme;          // 'system' | 'dark' | 'light', o ya el valor resuelto
    var eff = d.effectiveTheme;  // solo viene en theme-changed
    var valor = null;

    if (eff) {
      // Forma 2: theme es la PREFERENCIA y effectiveTheme el resultado.
      if (eff === 'dark') valor = (pref === 'dark') ? 'dark-legacy' : 'dark';
    } else if (pref === 'dark' || pref === 'dark-legacy') {
      // Forma 1: theme ya viene RESUELTO, se respeta tal cual.
      valor = pref;
    }

    if (valor) html.setAttribute('data-theme', valor);
    else html.removeAttribute('data-theme');
  }

  function pedirTemaAlPadre() {
    try {
      if (window.parent && window.parent !== window && window.parent.postMessage) {
        window.parent.postMessage({ type: 'get-theme-request' }, '*');
      }
    } catch (e) { /* sin acceso al padre */ }
  }

  /**
   * Respaldo: el padre puede propagar por `contentDocument` en vez de por
   * mensaje (renderer.js:1746). Se lee su atributo, que ya viene resuelto.
   * Si el acceso está bloqueado, el handshake es el que resuelve.
   */
  function leerTemaDelPadre() {
    try {
      if (window.parent && window.parent !== window && window.parent.document) {
        var padre = window.parent.document.documentElement.getAttribute('data-theme');
        if (padre) { document.documentElement.setAttribute('data-theme', padre); }
      }
    } catch (e) { /* cross-origin */ }
  }

  function init() {
    if (YA_PUSHEO) return;
    YA_PUSHEO = true;

    window.addEventListener('message', function (event) {
      var d = event.data || {};
      if (d.type === 'theme-changed' || d.type === 'get-theme-response') {
        kairIframeApplyTheme(d);
      }
    });

    // El orden importa: primero lo que el padre YA tiene, después la pregunta.
    // Así, si la respuesta tarda, la vista no queda en claro ni un instante.
    leerTemaDelPadre();
    pedirTemaAlPadre();
  }

  // Se expone la función pura para poder probarla sin montar la vista entera:
  // los harneses la invocan con las tres formas reales de renderer.js.
  window.kairIframeApplyTheme = kairIframeApplyTheme;

  init();
})();