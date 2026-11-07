/* ═══════════════════════════════════════════════════════════════════════════
   K+AIR · SUSCRIPCIÓN DEL ANEXO DE ENCARGO
   v1.0 · 2026-11-06 · la pantalla donde la Empresa suscribe el Anexo de Encargo
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var API = '/api/anexo-encargo/';

  /**
   * Los CINCO datos del §11 ("Datos de contacto de las partes").
   *
   * El mismo arreglo decide qué se envía, qué se revisa antes de enviar y qué
   * se muestra. Si el servidor exigiera un dato que acá no está, la Empresa
   * lo escribiría y el servicio lo rechazaría con un mensaje que no explica
   * qué pasa; si acá pidiera uno que el servidor no exige, se mandaría vacío.
   * Por eso la lista vive en UN solo lado de la pantalla.
   */
  var DATOS_S11 = [
    { id: 's11-razon_social', clave: 'razon_social', etiqueta: 'la razón social' },
    { id: 's11-nit', clave: 'nit', etiqueta: 'el NIT' },
    { id: 's11-domicilio', clave: 'domicilio', etiqueta: 'el domicilio' },
    { id: 's11-correo', clave: 'correo', etiqueta: 'el correo' },
    { id: 's11-representante', clave: 'representante', etiqueta: 'el representante legal' },
  ];

  function el(id) { return document.getElementById(id); }

  /** El token es el último segmento de la URL: /anexo-encargo/<token> */
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
          // El servicio responde con { error: { code, message, request_id } }.
          // Sin abrir esa envoltura, `data.error` es un OBJETO y el mensaje
          // sale como "[object Object]": la Empresa no sabe qué pasó ni qué
          // puede escribirle a soporte.
          var env = (data && typeof data.error === 'object' && data.error !== null)
            ? data.error : null;
          var msg = (env && env.message)
            || (typeof data.error === 'string' ? data.error : '')
            || data.message
            || ('Error ' + r.status);
          var err = new Error(msg);
          err.codigo = (env && env.code) || data.code || '';
          throw err;
        }
        return data;
      });
    });
  }

  var ctx = null;

  /** Los cinco datos del §11, tal como los declara la Empresa ahora mismo. */
  function leerDatosS11() {
    var salida = {};
    for (var i = 0; i < DATOS_S11.length; i++) {
      var d = DATOS_S11[i];
      var n = el(d.id);
      salida[d.clave] = n ? String(n.value || '').trim() : '';
    }
    return salida;
  }

  /** Los que faltan, para decírselos a la Empresa por su nombre. */
  function faltanS11(datos) {
    var faltan = [];
    for (var i = 0; i < DATOS_S11.length; i++) {
      var d = DATOS_S11[i];
      if (!datos[d.clave]) faltan.push(d.etiqueta);
    }
    return faltan;
  }

  function pintarContexto(c) {
    ctx = c;
    // El texto cambió después de abrirse la suscripción: esta ya no vale.
    // Se dice antes de pedir nada, para que la Empresa no firme sobre una
    // huella que ya no corresponde a lo publicado.
    if (c.vigente === false) {
      errorFatal('El texto del Anexo de Encargo cambió después de que se abrió esta '
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
    // El segundo canal: el código NO llega a este buzón. Se muestra para que
    // la Empresa sepa dónde esperarlo.
    texto('d-canal', c.canal_codigo);
    texto('d-expira', c.expira_en ? new Date(c.expira_en).toLocaleString('es-CO') : '—');
    var doc = el('d-documento');
    if (doc && c.documento_url) doc.setAttribute('href', c.documento_url);

    // LOS TEXTOS LEGALES DE LA ACEPTACIÓN. Vienen del SERVICIO y no están
    // escritos en esta página a mano: el acta imprime exactamente los mismos,
    // y si cada uno tuviera su propia copia, un día dejarían de coincidir y
    // la Empresa aceptaría una cosa mientras el acta archivaría otra.
    var t = c.textos || {};
    texto('texto-mecanismo', t.mecanismo || '');
    texto('texto-tratamiento', t.tratamiento || '');
    actualizarDeclaracion();

    // El PRELLENADO de los cinco datos del §11: lo que hay en la ficha. La
    // Empresa puede confirmarlo o corregirlo. Solo se rellena lo que está
    // vacío, para no pisar lo que ya se escribió a mano.
    var prellenado = c.datos_empresa || {};
    for (var i = 0; i < DATOS_S11.length; i++) {
      var d = DATOS_S11[i];
      var n = el(d.id);
      if (!n) continue;
      var v = prellenado[d.clave];
      if (v && !String(n.value || '').trim()) n.value = String(v);
    }

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

  /**
   * La DECLARACIÓN DE REPRESENTACIÓN cambia con la calidad elegida.
   *
   * Un delegado no es el representante legal: mostrarle la declaración de
   * representante legal sería mostrarle una frase que no está firmando.
   */
  function actualizarDeclaracion() {
    var t = (ctx && ctx.textos) || {};
    var cal = el('rep-calidad');
    // El menú vacío no puede pasar: la calidad por omisión es la del
    // representante legal, que es la primera opción del formulario.
    var calidad = (cal && cal.value) || 'REPRESENTANTE_LEGAL';
    var textoDeclaracion = (calidad === 'DELEGADO')
      ? (t.declaracion_delegado || t.declaracion || '')
      : (t.declaracion_representante_legal || t.declaracion || '');
    texto('texto-declaracion', textoDeclaracion);
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

    // Los cinco datos del §11 se revisan ANTES de pedir el código: si falta
    // uno, la Empresa lo ve de inmediato y no tiene que esperar a que salga
    // el correo para enterarse. El servidor los vuelve a exigir: esta
    // revisión es por comodidad, no la que manda.
    var datos = leerDatosS11();
    var faltan = faltanS11(datos);
    if (faltan.length) {
      mensaje('Faltan datos del §11 del Anexo de Encargo: ' + faltan.join(', ')
        + '. El texto se suscribe con sus huecos, pero la Empresa debe declarar sus datos.', 'error');
      var primero = el(DATOS_S11[0].id);
      if (primero) primero.focus();
      return;
    }

    // QUIEN FIRMA. El número de documento es lo que permite contrastar la
    // representación contra el certificado, el RUT o el poder. Sin él, el
    // método solo probaría control de un buzón.
    var documento = el('rep-documento') ? el('rep-documento').value.trim() : '';
    if (!documento) {
      mensaje('Falta el número de documento de quien suscribe: declare el documento '
        + 'del representante legal o del delegado con poder.', 'error');
      if (el('rep-documento')) el('rep-documento').focus();
      return;
    }

    // La aceptación de la información sobre el tratamiento de los datos es
    // una casilla APARTE: responde a una obligación distinta (informar, art.
    // 12 de la Ley 1581) de la de acordar el mecanismo (art. 7 del Decreto
    // 2364).
    if (!el('acepta-tratamiento') || el('acepta-tratamiento').checked !== true) {
      mensaje('Marque también que leyó la información sobre el tratamiento de sus '
        + 'datos personales para la ejecución de este Anexo.', 'error');
      if (el('acepta-tratamiento')) el('acepta-tratamiento').focus();
      return;
    }

    var btn = el('btn-firmar');
    btn.disabled = true;
    btn.textContent = 'Registrando…';
    api('POST', API + encodeURIComponent(t) + '/suscribir', {
      otp: el('otp').value.trim(),
      acepta: el('acepta').checked === true,
      acepta_tratamiento: el('acepta-tratamiento').checked === true,
      datos_empresa: datos,
      // QUIEN FIRMA: el documento y la calidad. Sin esto el método probaría
      // control de un buzón y nada más.
      representante: {
        documento: (el('rep-documento') ? el('rep-documento').value : '').trim(),
        calidad: (el('rep-calidad') && el('rep-calidad').value) || 'REPRESENTANTE_LEGAL',
      },
    }).then(function (r) {
      el('form-firma').classList.add('oculto');
      el('form-datos').classList.add('oculto');
      el('form-representante').classList.add('oculto');
      el('btn-codigo').classList.add('oculto');
      mensaje('Anexo de Encargo suscrito por su Empresa. Versión ' + r.version + ', huella '
        + r.hash + ', registrado el ' + new Date(r.firmado_at).toLocaleString('es-CO')
        + '. Este documento es bilateral: a la firma de su Empresa le sigue la '
        + 'contrafirma de K+AIR, y el contrato queda ejecutado cuando las dos partes '
        + 'han firmado. Hasta entonces su Empresa no puede usar el servicio para '
        + 'firmar documentos de sus trabajadores.', 'ok');
      // El acta: el documento que la Empresa descarga y K+AIR archiva. Su
      // huella es la de SUS bytes, no la del texto que se firmó.
      if (r.acta && r.acta.url) {
        var enlace = el('d-acta');
        if (enlace) enlace.setAttribute('href', r.acta.url);
        texto('d-acta-hash', r.acta.hash);
        mostrar('acta', true);
      }
    }).catch(function (e) {
      btn.disabled = false;
      btn.textContent = 'Suscribir el Anexo de Encargo';
      mensaje(e.message, 'error');
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    el('btn-codigo').addEventListener('click', pedirCodigo);
    el('form-firma').addEventListener('submit', suscribir);
    // La declaración que se muestra depende de la calidad con la que firma.
    var cal = el('rep-calidad');
    if (cal) cal.addEventListener('change', actualizarDeclaracion);
    iniciar();
  });
}());
