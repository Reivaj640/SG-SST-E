// tests/notificaciones-toast-e2e.js
// 📦823 — E2E del flujo "llega un correo → sale el toast → clic en Ver".
//
// Qué prueba (contra los ARCHIVOS REALES, no contra stubs):
//   1. Se monta el DOM del shell mínimo (header con el badge + hub de toasts).
//   2. Se carga shared/kair-alerts.js y assets/js/update-notifications.js tal cual.
//   3. Se dispara el MISMO toast que produce renderer.js con datos de correo
//      reales (los mismos campos que arma notifications-email.js).
//   4. Se hace clic REAL en el botón .btn-toast-action y se comprueba qué pasa.
//
// Los 3 comportamientos que se verifican (los que se보고 antes fallaban):
//   A) el panel abre en la pestaña "notifs" (donde está el correo), no en
//      "pendientes" (que es la de eventos y el default),
//   B) si el panel ya estaba abierto, NO se cierra (no es un toggle),
//   C) el toast desaparece del DOM tras el clic.
//
// Uso:  node tests/notificaciones-toast-e2e.js
// Salida: checks pass/fail + resumen.

'use strict';

const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');
const ALERTS_JS = path.join(ROOT, 'shared', 'kair-alerts.js');
const NOTIFIER_JS = path.join(ROOT, 'assets', 'js', 'update-notifications.js');
const EMAIL_JS = path.join(ROOT, 'main', 'notifications-email.js');

const checks = [];
const ok = (name, cond, extra) => checks.push({ name, ok: !!cond, extra });

// ── Harness ────────────────────────────────────────────────────────────────
// Reproduce el shell: header con el badge que abre el popover + el hub donde
// el UpdateNotificationManager cuelga los toasts.
function montarShell() {
  const dom = new JSDOM(
    `<!DOCTYPE html><html><body>
      <header>
        <button id="bandeja-integrada-button">
          Bandeja
          <span id="bandeja-integrada-badge" hidden>0</span>
        </button>
      </header>
      <div id="notification-hub"></div>
      <div id="content-area"></div>
    </body></html>`,
    { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://kair.local/index.html' }
  );
  const win = dom.window;
  // El módulo se registra como `(typeof window !== 'undefined' ? window : this)`.
  win.eval(fs.readFileSync(ALERTS_JS, 'utf8'));
  win.eval(fs.readFileSync(NOTIFIER_JS, 'utf8'));
  return dom;
}

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

// Replica el payload que arma notifications-email.js para un correo real.
function payloadCorreo() {
  const { formatRemitente } = require(EMAIL_JS);
  return {
    tipo: 'correo',
    ref_id: 'thread-abc',
    companyKey: '*',
    titulo: 'RV: Lista de asistencia de actividades Pausas activas',
    resumen: 'Buenos días, adjunto el consolidado...',
    remitente: formatRemitente('Pausas Activas', 'pausas@acme.com'),
    remitente_nombre: 'Pausas Activas',
    remitente_email: 'pausas@acme.com'
  };
}

// Replica el toast que dispara renderer.js (onChanged → updateNotifier.show).
function lanzarToast(win, nueva) {
  const n = 1;
  const titulo = nueva.tipo === 'correo' ? '1 correo nuevo' : '1 evento próximo';
  const sub = nueva.tipo === 'correo'
    ? (nueva.remitente ? 'De: ' + nueva.remitente : '')
    : (nueva.companyKey && nueva.companyKey !== '*' ? nueva.companyKey : '');
  win.updateNotifier.show({
    type: 'info',
    title: titulo,
    subtitle: sub,
    message: String(nueva.titulo || '').slice(0, 80),
    autoClose: 0,
    buttonText: 'Ver',
    onClick: function () {
      if (win.KairAlerts && typeof win.KairAlerts.openFromToast === 'function') {
        win.KairAlerts.openFromToast(nueva.tipo);
      } else {
        const badge = win.document.getElementById('bandeja-integrada-badge');
        if (badge) badge.click();
      }
    }
  });
  return win.document.querySelector('.toast-card');
}

const tabActiva = (win) => {
  const el = win.document.querySelector('.kair-alerts-popover__tab.is-active');
  if (!el) return null;
  return el.getAttribute('data-tab');
};

async function main() {
  console.log('[toast-e2e] Cargando archivos reales del repo…');
  for (const f of [ALERTS_JS, NOTIFIER_JS, EMAIL_JS]) {
    if (!fs.existsSync(f)) { console.error('❌ Falta ' + f); process.exit(1); }
  }

  // ══ Escenario 1: llega un correo, el panel está CERRADO ═══════════════
  {
    const dom = montarShell();
    const win = dom.window;
    win.KairAlerts.init();
    await tick(60);

    ok('E2E-1 · el panel arranca cerrado', win.KairAlerts.isOpen() === false);
    ok('E2E-1 · la tab por defecto es "pendientes"',
      win.KairAlerts.getActiveTab() === 'pendientes',
      'default=' + win.KairAlerts.getActiveTab());

    const toast = lanzarToast(win, payloadCorreo());
    ok('E2E-1 · el toast se monta en el hub', !!toast);
    ok('E2E-1 · el toast muestra el remitente como subtítulo',
      toast.querySelector('.toast-subtitle').textContent === 'De: Pausas Activas (pausas@acme.com)',
      toast.querySelector('.toast-subtitle').textContent);
    ok('E2E-1 · el cuerpo del toast es el asunto',
      toast.querySelector('.toast-body').textContent === 'RV: Lista de asistencia de actividades Pausas activas');

    const botonVer = toast.querySelector('.btn-toast-action');
    ok('E2E-1 · existe el botón "Ver"', !!botonVer && botonVer.textContent.trim() === 'Ver');

    botonVer.click();          // ← el clic real que dispara el flujo
    await tick(30);

    ok('E2E-1 · A) abre en la pestaña "notifs" (donde está el correo)',
      tabActiva(win) === 'notifs', 'tab=' + tabActiva(win));
    ok('E2E-1 · el panel queda ABIERTO', win.KairAlerts.isOpen() === true);
    // Sin electronAPI en jsdom no hay notificaciones cargadas, así que el cuerpo
    // muestra el empty state: se verifica que la tab "notifs" es la seleccionada
    // semánticamente (aria-selected), que es lo que decide qué cuerpo se pinta.
    const tabNotifs = win.document.querySelector('.kair-alerts-popover__tab[data-tab="notifs"]');
    ok('E2E-1 · la tab "notifs" queda marcada como seleccionada',
      !!tabNotifs && tabNotifs.getAttribute('aria-selected') === 'true');
    ok('E2E-1 · el panel existe en el DOM',
      !!win.document.querySelector('.kair-alerts-panel'));
    ok('E2E-1 · la tab activa queda persistida en localStorage',
      win.localStorage.getItem('kair-alerts-tab') === 'notifs',
      'ls=' + win.localStorage.getItem('kair-alerts-tab'));

    // El toast se borra del DOM tras 400ms (remove() anima antes de quitar).
    await tick(500);
    ok('E2E-1 · C) el toast desaparece del DOM tras el clic',
      win.document.querySelector('.toast-card') === null);
    ok('E2E-1 · updateNotifier.currentToast queda limpio',
      win.updateNotifier.currentToast === null);

    dom.window.close();
  }

  // ══ Escenario 2: el panel YA está abierto (el caso que fallaba) ═══════
  {
    const dom = montarShell();
    const win = dom.window;
    win.KairAlerts.init();
    await tick(60);

    // El usuario ya tenía el panel abierto en la pestaña de eventos.
    win.KairAlerts.openTab('pendientes');
    await tick(30);
    ok('E2E-2 · precondición: panel abierto en "pendientes"',
      win.KairAlerts.isOpen() === true && tabActiva(win) === 'pendientes');

    const toast = lanzarToast(win, payloadCorreo());
    toast.querySelector('.btn-toast-action').click();
    await tick(30);

    ok('E2E-2 · B) NO se cierra (no es un toggle)', win.KairAlerts.isOpen() === true);
    ok('E2E-2 · cambia a "notifs" igualmente', tabActiva(win) === 'notifs', 'tab=' + tabActiva(win));

    dom.window.close();
  }

  // ══ Escenario 3: doble clic en "Ver" no rompe nada ═══════════════════
  {
    const dom = montarShell();
    const win = dom.window;
    win.KairAlerts.init();
    await tick(60);

    const toast = lanzarToast(win, payloadCorreo());
    const boton = toast.querySelector('.btn-toast-action');
    boton.click();
    boton.click();
    boton.click();
    await tick(60);

    ok('E2E-3 · 3 clics seguidos dejan el panel abierto', win.KairAlerts.isOpen() === true);
    ok('E2E-3 · y en la pestaña correcta', tabActiva(win) === 'notifs');
    await tick(500);
    ok('E2E-3 · el toast se borra igual', win.document.querySelector('.toast-card') === null);

    dom.window.close();
  }

  // ══ Escenario 4: notificación de EVENTO abre "pendientes" ════════════
  {
    const dom = montarShell();
    const win = dom.window;
    win.KairAlerts.init();
    await tick(60);

    // Evento de una empresa concreta: el subtítulo SÍ lleva la empresa (eso
    // es información útil), pero nunca el '*' global.
    const toast = lanzarToast(win, {
      tipo: 'evento', companyKey: 'Tempoactiva',
      titulo: 'Reunión SG-SST', resumen: 'reunion'
    });
    const subEvento = toast.querySelector('.toast-subtitle');
    ok('E2E-4 · el evento sí muestra su empresa en el subtítulo',
      !!subEvento && subEvento.textContent === 'Tempoactiva',
      subEvento ? subEvento.textContent : '(sin subtítulo)');
    ok('E2E-4 · y NUNCA el asterisco global', !subEvento || subEvento.textContent !== '*');

    toast.querySelector('.btn-toast-action').click();
    await tick(30);
    ok('E2E-4 · un evento abre la pestaña "pendientes"', tabActiva(win) === 'pendientes', 'tab=' + tabActiva(win));
    ok('E2E-4 · y el panel queda abierto', win.KairAlerts.isOpen() === true);

    dom.window.close();
  }

  // ══ Escenario 4b: evento con companyKey global '*' → sin subtítulo ════
  {
    const dom = montarShell();
    const win = dom.window;
    win.KairAlerts.init();
    await tick(60);

    const toast = lanzarToast(win, { tipo: 'evento', companyKey: '*', titulo: 'Evento global', resumen: 'x' });
    ok('E2E-4b · un evento con companyKey "*" NO muestra subtítulo',
      !toast.querySelector('.toast-subtitle'),
      toast.querySelector('.toast-subtitle') ? toast.querySelector('.toast-subtitle').textContent : '(sin subtítulo)');

    dom.window.close();
  }

  // ══ Escenario 5: fallback si KairAlerts no está cargado ═══════════════
  {
    const dom = new JSDOM(
      `<!DOCTYPE html><html><body>
        <span id="bandeja-integrada-badge" hidden>0</span>
        <div id="notification-hub"></div>
      </body></html>`,
      { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://kair.local/index.html' }
    );
    const win = dom.window;
    win.eval(fs.readFileSync(NOTIFIER_JS, 'utf8'));
    // Badge sin listener (KairAlerts ausente) → el fallback no debe lanzar.
    let okFallback = true;
    try {
      lanzarToast(win, payloadCorreo()).querySelector('.btn-toast-action').click();
    } catch (e) { okFallback = false; }
    ok('E2E-5 · sin KairAlerts el clic no rompe (fallback silencioso)', okFallback);
    dom.window.close();
  }

  // ── Reporte ─────────────────────────────────────────────────────────────
  let failed = 0;
  console.log('');
  checks.forEach((c) => {
    if (!c.ok) failed++;
    const extra = c.extra !== undefined ? '  [' + c.extra + ']' : '';
    console.log((c.ok ? 'OK  ' : 'FAIL') + '  ' + c.name + extra);
  });
  console.log('---');
  console.log((checks.length - failed) + '/' + checks.length + ' OK');
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('[toast-e2e] Excepción:', e && e.message);
  console.error('[toast-e2e] Stack:', e && e.stack);
  process.exit(1);
});
