/* ═══════════════════════════════════════════════════════════════════════════
   K+AIR · SUSCRIPCIÓN DEL ANEXO DE NUBE
   v1.0 · 2026-11-05 · la pantalla donde la Empresa suscribe el Anexo de Nube
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var API = '/api/anexo-nube/';

  function el(id) { return document.getElementById(id); }

  /** El token es el último segmento de la URL: /anexo-nube/<token> */
  function token() {
    var partes = window.location.pathname.split('/').filter(Boolean);
    return partes.length ? partes[partes.length - 1] : '';
  }

  function mostrar(id, visible) {
    var n = el(id);
    if (!n) return;
    n.classList.toggle('oculto', !visible);
  }

  function texto(id, valor) {
    var n = el(id);
    if (n) n.textContent = valor == null ? '—' : String(valor);
  }

  function mensaje(txt, tipo) {
    var n = el('mensaje');
    if (!n) return;
    n.textContent = txt;
    n.className = 'mensaje ' + (tipo || 'info');
  }

  function errorFatal(txt) {
    texto('error-texto', txt);
    mostrar('cargando', false);
    mostrar('principal', false);
    mostrar('error', true);
  }

  function api(metodo, ruta, cuerpo) {
    return fetch(ruta, {
      method: metodo,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      cache: 'no-store',
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (!r.ok) {
          var err = new Error(data.message || data.error || ('Error ' + r.status));
          err.codigo = data.code || data.error || '';
          throw err;
        }
        return data;
      });
    });
  }

  var ctx = null;

  function pintarContexto(c) {
    ctx = c;
    // El texto cambió después de abrirse la suscripción: esta ya no vale.
    // Se dice antes de pedir nada, para que la Empresa no firme sobre una
    // huella que ya no corresponde a lo publicado.
    if (c.vigente === false) {
      errorFatal('El texto del Anexo de Nube cambió después de que se abrió esta '
        + 'suscripción, así que esta suscripción ya no es válida. Escríbanos a '
        + 'adminkair@gmail.com para abrir una suscripción nueva con la versión vigente.');
      return;
    }
    texto('d-empresa', c.empresa);
    texto('d-version', c.version);
    texto('d-hash', c.hash);
    texto('d-version2', c.version);
    texto('d-hash2', c.hash);
    texto('d-firmante', (c.nombre_firmante || '—') + (c.cargo_firmante ? ' — ' + c.cargo_firmante : ''));
    texto('d-correo', c.correo_firmante);
    texto('d-expira', c.expira_en ? new Date(c.expira_en).toLocaleString('es-CO') : '—');
    var doc = el('d-documento');
    if (doc && c.documento_url) doc.setAttribute('href', c.documento_url);
    mostrar('cargando', false);
    mostrar('principal', true);
  }

  function iniciar() {
    var t = token();
    if (!t) {
      errorFatal('El enlace no trae un código de suscripción válido.');
      return;
    }
    api('GET', API + encodeURIComponent(t)).then(pintarContexto).catch(function (e) {
      errorFatal(e.message);
    });
  }

  function pedirCodigo() {
    var t = token();
    var btn = el('btn-codigo');
    btn.disabled = true;
    btn.textContent = 'Enviando…';
    api('POST', API + encodeURIComponent(t) + '/codigo', {}).then(function (r) {
      btn.textContent = 'Código enviado';
      mensaje('Si el correo está bien escrito, el código ya debe estar en su buzón. '
        + 'Vence en ' + Math.round((r.expira_en_segundos || 600) / 60) + ' minutos.', 'ok');
      el('otp').focus();
    }).catch(function (e) {
      btn.disabled = false;
      btn.textContent = 'Enviarme el código';
      mensaje(e.message, 'error');
    });
  }

  function suscribir(evento) {
    evento.preventDefault();
    var t = token();
    var btn = el('btn-firmar');
    btn.disabled = true;
    btn.textContent = 'Registrando…';
    api('POST', API + encodeURIComponent(t) + '/suscribir', {
      otp: el('otp').value.trim(),
      acepta: el('acepta').checked === true,
    }).then(function (r) {
      el('form-firma').classList.add('oculto');
      el('btn-codigo').classList.add('oculto');
      mensaje('Anexo de Nube suscrito. Versión ' + r.version + ', huella ' + r.hash
        + ', registrado el ' + new Date(r.firmado_at).toLocaleString('es-CO')
        + '. Guarde esta pantalla: es la constancia de la suscripción.', 'ok');
    }).catch(function (e) {
      btn.disabled = false;
      btn.textContent = 'Suscribir el Anexo de Nube';
      mensaje(e.message, 'error');
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    el('btn-codigo').addEventListener('click', pedirCodigo);
    el('form-firma').addEventListener('submit', suscribir);
    iniciar();
  });
}());
