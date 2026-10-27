/**
 * K+AIR · Mini-app de Firma Electrónica — Lógica del lado del trabajador.
 *
 * Reglas:
 *  - Sin dependencias externas (vanilla JS, fetch nativo).
 *  - CSP estricta: no usamos onclick / onsubmit inline en el HTML.
 *    Todo se ata con addEventListener desde aquí.
 *  - El token ES la credencial. Viaja en el path (/s/TOKEN) y se reenvía
 *    en cada llamada al backend.
 *  - El JS siempre pide JSON con Accept: application/json para distinguirse
 *    del navegador (que pide text/html en la carga inicial).
 *  - No agregamos canvas, SMS, WhatsApp, PWA ni firma manuscrita.
 *    Solo lo que está en los documentos congelados (ARCHITECTURE/DATA_MODEL/API).
 *
 * Flujo:
 *   1. Carga contexto:  GET    /s/:token                        → contexto JSON
 *   2. Identificación:  POST   /api/sign/:token/identify       → OTP enviado
 *   3. Verificación:    POST   /api/sign/:token/verify-otp     → OTP_VERIFIED
 *   4. Visualización:   POST   /api/sign/:token/view-document  → DOCUMENT_VIEWED
 *   5. Descarga PDF:    GET    /api/sign/:token/document.pdf   → application/pdf
 *   6. Firma:           POST   /api/sign/:token/commit         → SIGNED
 *   7. Rechazo:         POST   /api/sign/:token/reject         → REJECTED
 *
 * Ver docs/gestion-humana/firma-electronica/API.md §5.
 */
(function () {
  'use strict';

  // ============================================================
  // Utilidades DOM
  // ============================================================

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  /**
   * Helpers DOM agregados para I-VERIFICACION-PUBLICA.
   * setButtonBusy/clearButtonYa existen arriba (sección de firma normal).
   */

  // Escapa HTML para evitar XSS al inyectar strings en innerHTML.
  function escHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Set text content del selector (selector, valor). Si no existe, no hace nada.
  function setText(sel, val) {
    var el = $(sel);
    if (el) el.textContent = (val == null) ? '—' : String(val);
  }

  // Oculta un elemento (helper semántico para el flujo de verificación).
  // Usa el atributo `hidden` del HTML. La regla CSS universal
  // `[hidden] { display: none !important; }` en styles.css garantiza que
  // se oculte aunque haya reglas con `display: block/flex` que en otro
  // momento sobrescribían el hidden (bug del spinner, 2026-09-10).
  // NOTA: NO seteamos `style.display = 'none'` inline porque rompe otros
  // lugares que hacen `el.hidden = false` esperando que el elemento
  // vuelva a su display por defecto. El CSS universal es suficiente.
  function hideEl(el) {
    if (el && 'hidden' in el) el.hidden = true;
  }

  // Muestra un elemento (helper simétrico a hideEl). Restaura el display
  // por defecto del CSS (block para div, etc.).
  function showEl(el) {
    if (el && 'hidden' in el) el.hidden = false;
  }

  // Formatea una fecha ISO a un string legible en zona horaria local.
  // Ej: "2026-09-09T19:49:02.908Z" → "9/9/2026, 7:49:02 p. m."
  function formatDateTime(iso) {
    if (!iso) return '—';
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleString('es-CO', {
        year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: '2-digit', second: '2-digit',
      });
    } catch (e) {
      return iso;
    }
  }

  /**
   * Extrae el token del path. La URL es /s/TOKEN.
   * Retorna null si el path no tiene la forma esperada.
   */
  function getTokenFromPath() {
    const match = window.location.pathname.match(/^\/s\/([A-Za-z0-9_-]+)\/?$/);
    return match ? match[1] : null;
  }

  /**
   * Muestra una pantalla y oculta las demás.
   * Las pantallas tienen id="screen-NOMBRE" y se hacen visibles con .active.
   */
  function showScreen(name) {
    $$('.screen').forEach((s) => s.classList.remove('active'));
    const target = $('#screen-' + name);
    if (target) target.classList.add('active');
    // Llevar el foco al primer input si existe
    const firstInput = target && target.querySelector('input, select, button');
    if (firstInput) {
      // setTimeout para que el browser termine de mostrar la pantalla
      setTimeout(() => firstInput.focus(), 50);
    }
    // Scroll al inicio
    window.scrollTo(0, 0);
  }

  /**
   * Muestra la pantalla de error.
   *
   * I-LINK-REABIERTO: por omisión se ofrece la salida hacia la verificación
   * de autenticidad, porque casi todos los estados de error aquí llegan con un
   * token válido que ya está firmado o vencido — y /verify no caduca. El
   * llamador que sepa que NO hay nada que verificar (token inexistente, o ni
   * siquiera un token en la URL) debe pasar allowVerify: false; ofrecer un
   * botón que va a fallar es peor que no ofrecerlo.
   *
   * @param {string} message
   * @param {{allowVerify?: boolean}} [opts]
   */
  function showError(message, opts) {
    const box = $('#error-message');
    if (box) box.textContent = message;

    const canVerify = !(opts && opts.allowVerify === false);
    const hint = $('#error-verify-hint');
    const btn = $('#btn-error-go-verify');
    if (hint) hint.hidden = !canVerify;
    if (btn) btn.hidden = !canVerify;

    showScreen('error');
  }

  function showFormError(formId, message) {
    const box = $('#' + formId);
    if (!box) return;
    box.textContent = message;
    // Si la caja quedó en modo aviso (info) de un mensaje anterior, se
    // devuelve a error: un error tiene que verse como error.
    box.classList.remove('alert-info');
    box.classList.add('alert-error');
    box.hidden = false;
  }

  function hideFormError(formId) {
    const box = $('#' + formId);
    if (!box) return;
    box.hidden = true;
    box.textContent = '';
  }

  /**
   * Muestra un aviso que NO es un error (por ejemplo: "te enviamos un código
   * nuevo"). Reusa la misma caja, pero le cambia la clase para que no salga
   * en rojo un mensaje que es una buena noticia.
   *
   * @param {string} formId
   * @param {string} message
   */
  function showFormNotice(formId, message) {
    const box = $('#' + formId);
    if (!box) return;
    box.textContent = message;
    box.classList.remove('alert-error');
    box.classList.add('alert-info');
    box.hidden = false;
  }

  function setButtonBusy(button, busyText, originalText) {
    button.disabled = true;
    button.textContent = busyText;
    button.dataset.originalText = originalText || button.textContent;
  }

  function clearButtonBusy(button) {
    button.disabled = false;
    button.textContent = button.dataset.originalText || button.textContent;
  }

  // ============================================================
  // API: wrapper de fetch con manejo de errores estándar
  // ============================================================

  /**
   * Wrapper de fetch. Siempre envía Accept: application/json.
   * Lanza un Error enriquecido con .status, .code, .details si la respuesta
   * no es 2xx. Ver src/middleware/errors.js para el formato de error.
   */
  async function apiFetch(path, options) {
    options = options || {};
    const init = {
      method: options.method || 'GET',
      headers: Object.assign(
        { Accept: 'application/json' },
        options.headers || {}
      ),
    };
    if (options.body && !(options.body instanceof FormData)) {
      init.headers['Content-Type'] = 'application/json';
      init.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    } else if (options.body instanceof FormData) {
      init.body = options.body;
    }

    const res = await fetch(path, init);

    let data = null;
    const ct = res.headers.get('content-type') || '';
    if (ct.indexOf('application/json') !== -1) {
      try { data = await res.json(); } catch (e) { data = null; }
    } else {
      try { data = await res.text(); } catch (e) { data = null; }
    }

    if (!res.ok) {
      const errCode = data && data.error && data.error.code;
      const errMsg = (data && data.error && data.error.message) || res.statusText || 'Error en la solicitud';
      const errDetails = data && data.error && data.error.details;
      const err = new Error(errMsg);
      err.status = res.status;
      err.code = errCode;
      err.details = errDetails;
      err.data = data;
      throw err;
    }
    return data;
  }

  // ============================================================
  // Estado de la mini-app
  // ============================================================

  const state = {
    token: null,
    contexto: null,            // respuesta de GET /s/:token (JSON)
    correoEnmascarado: null,   // respuesta de identify
    pdfViewed: false,          // true después de llamar view-document con éxito
    viewDocumentAttempted: false, // para evitar reintentos
    consentAccepted: false,    // true después de POST /consent/accept exitoso (Bloque E6.5)
    consentAcceptInProgress: false, // evita doble POST al marcar/desmarcar rápido
    // 8B · el dato sensible (10.8). `sensibleRequired` es true cuando el
    // documento tiene información de salud y la base legal es la
    // autorización expresa del Titular: hace falta su casilla separada.
    sensitiveRequired: false,
    sensitiveAccepted: false,
    sensitiveAcceptInProgress: false, // evita doble POST al marcar/desmarcar rápido
    // Decisión 1.a · el medio personal que registró la Empresa y la versión
    // del texto de la declaración que hay que confirmar.
    medioRegistrado: null,
    declaracionVersion: null,
  };

  // ============================================================
  // 1. Inicialización: extraer token y cargar contexto
  // ============================================================

  async function init() {
    const token = getTokenFromPath();
    if (!token) {
      return showError('El enlace que usaste no es válido.', { allowVerify: false });
    }
    state.token = token;

    // I-LINK-REABIERTO · deep-link de verificación.
    // /s/<token>?verificar=1 salta la máquina de estados y abre directo la
    // pantalla de verificación. Es el destino al que apunta la pantalla de
    // error y el botón de las páginas HTML del servidor, de modo que ese
    // enlace se puede compartir y reabrir aunque el enlace de
    // firma ya haya caducado o se haya usado. /verify usa
    // `permitirHistorico`, así que la ventana para firmar no le impide
    // consultar lo ya firmado (8A.1).
    if (isVerifyDeepLink()) {
      return showVerifyScreen();
    }

    showScreen('loading');

    try {
      const contexto = await apiFetch('/s/' + token);
      state.contexto = contexto;

      // Decisión 1.a · el medio personal que registró la Empresa (si hubo).
      // Se pinta antes de mostrar cualquier pantalla: la pantalla de
      // identificación es la que lo muestra.
      renderMedioPersonal(contexto);

      // I-103.A1.6 · FIX: respetar el estado real del sign request.
      // Sin este fix, si el firmante cierra el navegador y re-abre el
      // enlace, la mini-app lo mandaba a identify incluso si ya estaba
      // en OTP_SENT. Ahora dispatchamos a la pantalla correcta.
      //
      // Máquina de estados (alineada con publicFlow.js + CHECK de
      // gh_firmas_electronicas.estado):
      //
      //   PENDING / OPENED / IDENTIFICATION_STARTED / IDENTIFICATION_FAILED
      //     → screen-identify
      //   IDENTIFIED / OTP_SENT
      //     → screen-otp
      //   OTP_VERIFIED / DOCUMENT_OPENED / DOCUMENT_VIEWED
      //     → screen-document
      //   SIGNED
      //     → screen-signed
      //   DUAL_FIRMADO (I-FIRMA-DUAL v0.1.180)
      //     → screen-signed con variante "firmado por ambas partes".
      //     Hasta v0.1.180 DUAL_FIRMADO caía al branch de estados iniciales
      //     y mostraba screen-identify, lo que llevaba al usuario a intentar
      //     re-firmar — el backend rechazaba con "No se puede identificar
      //     en estado 'DUAL_FIRMADO'". Ahora se trata igual que SIGNED
      //     porque la firma dual YA está completa; lo único que tiene sentido
      //     desde el link público es VERIFICAR la autenticidad (que es
      //     exactamente lo que ofrece el botón "Verificar autenticidad" en
      //     screen-signed).
      //   REJECTED
      //     → screen-rejected
      //   EXPIRED / REVOKED / CANCELLED / OTP_LOCKED
      //     → showError con mensaje específico
      const estado = contexto && contexto.estado;

      if (estado === 'SIGNED') {
        setSignedMessageVariant('single');
        showScreen('signed');
        wireSignedDownloads();
        return;
      }
      if (estado === 'DUAL_FIRMADO') {
        // I-FIRMA-DUAL · diferenciar visualmente el caso de firma dual
        // (trabajador + representante legal) del caso de firma simple.
        setSignedMessageVariant('dual');
        showScreen('signed');
        wireSignedDownloads();
        return;
      }
      if (estado === 'REJECTED') return showScreen('rejected');

      if (estado === 'IDENTIFIED' || estado === 'OTP_SENT') {
        if (contexto.correo_enmascarado) {
          $('#correo-enmascarado').textContent = contexto.correo_enmascarado;
        }
        return showScreen('otp');
      }

      if (estado === 'OTP_VERIFIED' ||
          estado === 'DOCUMENT_OPENED' ||
          estado === 'DOCUMENT_VIEWED') {
        // I-103.A1.6 fix · al recargar la página con la mini-app ya en estado
        // post-OTP, init() dispatchaba a 'document' sin llamar a setupDocumentScreen().
        // Eso dejaba el iframe sin src, sin listeners en checkboxes y sin view-document.
        // Solución: llamar a setupDocumentScreen() aquí también.
        showScreen('document');
        setupDocumentScreen();
        return;
      }

      if (estado === 'EXPIRED') {
        return showError('Este enlace ha expirado. Solicita uno nuevo a tu empleador.');
      }
      if (estado === 'REVOKED') {
        return showError('Esta solicitud fue revocada. Contacta al área de RRHH.');
      }
      if (estado === 'CANCELLED') {
        return showError('Esta solicitud fue cancelada. Contacta al área de RRHH.');
      }
      if (estado === 'OTP_LOCKED') {
        return showError('El código de verificación fue bloqueado por demasiados intentos. Solicita uno nuevo a tu empleador.');
      }

      // Estados iniciales (PENDING, OPENED, IDENTIFICATION_STARTED,
      // IDENTIFICATION_FAILED) → pantalla de identificación.
      showScreen('identify');
    } catch (err) {
      // I-LINK-REABIERTO · copy por código en vez de por status genérico.
      // Un 410 sin código discernible y un 404 no son el mismo problema para
      // el firmante, y solo uno de los dos tiene verificación disponible.
      if (err.code === 'TOKEN_NOT_FOUND' || err.status === 404) {
        return showError(
          'Este enlace no está disponible. No se puede confirmar si corresponde a alguna solicitud de firma: puede haberse copiado incompleto al reenviarlo.',
          { allowVerify: false });
      }
      // 8A.1 · Vencimiento del plazo de conservación (numeral 10.6).
      // No es lo mismo que un enlace vencido: acá lo que venció es el plazo
      // de conservación que declaró la empresa, así que la evidencia de la
      // firma ya no está disponible. NO se ofrece verificación porque la
      // verificación responde lo mismo: ofrecerla sería una promesa falsa.
      if (err.code === 'CONSERVACION_VENCIDA') {
        return showError(
          'No está disponible por vencimiento del plazo: la empresa fijó un plazo de conservación para este documento y ya venció, así que la evidencia de la firma ya no está disponible.',
          { allowVerify: false });
      }
      if (err.status === 410 || err.code === 'TOKEN_EXPIRED' || err.code === 'TOKEN_ALREADY_USED') {
        const msg = err.code === 'TOKEN_EXPIRED'
          ? 'Este enlace venció, pero eso no afecta lo que habías firmado: tu documento sigue aquí y puedes verificar su autenticidad.'
          : 'Este enlace ya se usó, porque la firma ya se completó. Tu documento sigue aquí y puedes verificar su autenticidad.';
        return showError(msg);
      }
      return showError(err.message || 'No se pudo cargar la solicitud.');
    }
  }

  /**
   * I-LINK-REABIERTO · ¿la URL pide la pantalla de verificación?
   * /s/<token>?verificar=1
   */
  function isVerifyDeepLink() {
    try {
      return new URLSearchParams(window.location.search).get('verificar') === '1';
    } catch (_) {
      return false;
    }
  }

  // ============================================================
  // 2. Pantalla: Identificación
  // ============================================================

  /**
   * Decisión 1.a · EL MEDIO PERSONAL DEL CÓDIGO, CONFIRMADO POR EL TRABAJADOR.
   *
   * La Empresa que contrata obtuvo del candidato su correo personal de forma
   * verbal y lo registró en la solicitud. Acá se lo mostramos al Trabajador
   * para que lo CONFIRME: el buzón del código de verificación tiene que ser de
   * su uso exclusivo y la Empresa no puede leerlo (si lo lee, lee el código).
   *
   * Si no hay ninguna dirección registrada, el bloque no se muestra y el campo
   * de arriba sigue editable y opcional, como antes.
   *
   * @param {object} contexto - Contexto publico de GET /s/:token.
   */
  function renderMedioPersonal(contexto) {
    const bloque = $('#medio-personal-bloque');
    const registro = $('#medio-personal-registro');
    const check = $('#medio_otp_confirmado');
    const texto = $('#medio_otp_confirmado_texto');
    if (!bloque || !registro || !check) return;

    const medio = contexto && contexto.medio_personal_registrado;
    if (!medio || !medio.correo) {
      bloque.hidden = true;
      state.medioRegistrado = null;
      state.declaracionVersion = null;
      check.checked = false;
      check.required = false;
      check.disabled = false;
      return;
    }

    // El texto de la declaración lo manda el servidor: es el mismo texto que
    // queda archivado con la confirmación (y con su versión).
    if (texto && medio.declaracion_texto) {
      texto.textContent = medio.declaracion_texto;
    }

    registro.textContent =
      'Tu empresa registró esta dirección para enviarte el código de verificación: '
      + medio.correo;
    bloque.hidden = false;
    state.medioRegistrado = medio.correo;
    state.declaracionVersion = medio.declaracion_version || null;
    actualizarConfirmacionMedio();
  }

  /**
   * ¿Aplica la casilla de confirmación?
   *
   * Aplica cuando la dirección que va a recibir el código es la que registró
   * la Empresa: el campo está vacío o tiene exactamente esa dirección. Si el
   * Trabajador escribe otra dirección, el código va a SU buzón y no hay nada
   * que confirmar del de la Empresa.
   *
   * El servidor aplica la misma regla: la casilla es una condición para que
   * el código salga a ese buzón, no una promesa del cliente.
   */
  function actualizarConfirmacionMedio() {
    const check = $('#medio_otp_confirmado');
    if (!check) return;
    const registrado = state.medioRegistrado;
    if (!registrado) {
      check.required = false;
      check.disabled = false;
      return;
    }
    const escrito = (($('#correo_otp') && $('#correo_otp').value) || '').trim().toLowerCase();
    const aplica = !escrito || escrito === registrado;
    check.required = aplica;
    check.disabled = !aplica;
    if (!aplica) check.checked = false;
  }

  function setupIdentifyForm() {
    const form = $('#form-identify');
    const btn = $('#btn-identify');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideFormError('identify-error');

      const tipo_identificacion = $('#tipo_identificacion').value;
      const numero_documento = $('#numero_documento').value.trim();

      if (!numero_documento) {
        return showFormError('identify-error', 'Ingresa tu número de documento.');
      }

      setButtonBusy(btn, 'VERIFICANDO...', 'CONTINUAR');
      try {
        // D-2: el código de verificación (dato de creación de la firma)
        // puede ir a un medio PERSONAL que declare el firmante. Si no declara
        // nada, el servicio usa el contacto registrado por la empresa.
        const correoOtp = ($('#correo_otp') && $('#correo_otp').value || '').trim();
        const body = { tipo_identificacion: tipo_identificacion, numero_documento: numero_documento };
        if (correoOtp) body.correo_otp = correoOtp;

        // Decisión 1.a · la CONFIRMACIÓN del medio que registró la Empresa.
        // Viaja solo si la casilla está marcada (y aplica: si el Trabajador
        // escribió otro buzón, la casilla se deshabilita y no se manda).
        const check = $('#medio_otp_confirmado');
        const confirmado = !!(check && check.checked && !check.disabled);
        if (check && check.required && !confirmado) {
          return showFormError(
            'identify-error',
            'Marcá la casilla para confirmar que esa dirección es de tu uso exclusivo '
            + 'y que tu empresa no administra ese buzón.'
          );
        }
        if (confirmado) {
          body.medio_otp_confirmado = true;
          body.medio_otp_version = state.declaracionVersion;
        }

        const result = await apiFetch('/api/sign/' + state.token + '/identify', {
          method: 'POST',
          body: body,
        });
        state.correoEnmascarado = result.correo_destino_enmascarado;
        $('#correo-enmascarado').textContent = result.correo_destino_enmascarado;
        showScreen('otp');
      } catch (err) {
        if (err.status === 422 && err.code === 'IDENTIFICATION_FAILED') {
          showFormError('identify-error', 'La identificación no coincide con nuestros registros. Verifica e intenta de nuevo.');
        } else if (err.status === 422 && err.code === 'MISSING_IDENTIFICATION_DATA') {
          showFormError('identify-error', 'No tenemos registrada tu identificación para esta solicitud. Contacta a tu empleador.');
        } else if (err.status === 422 && err.code === 'MEDIO_OTP_CONFIRMACION_REQUERIDA') {
          // El servidor exige la confirmación: la casilla se muestra y hay que
          // marcarla para que el código vaya a ese buzón.
          showFormError(
            'identify-error',
            'Tenés que confirmar que la dirección que registró tu empresa es de tu uso '
            + 'exclusivo y que tu empresa no administra ese buzón.'
          );
          const check = $('#medio_otp_confirmado');
          if (check) {
            check.disabled = false;
            check.required = true;
          }
        } else if (err.status === 409 && err.code === 'MEDIO_OTP_DECLARACION_DESACTUALIZADA') {
          showFormError(
            'identify-error',
            'Cambió el texto de la declaración. Recargá la página y volvé a confirmar.'
          );
        } else if (err.status === 410) {
          return showError('Este enlace ha expirado o ya fue utilizado.');
        } else {
          showFormError('identify-error', err.message || 'No se pudo verificar la identificación.');
        }
      } finally {
        clearButtonBusy(btn);
      }
    });

    // Permitir solo dígitos en el input
    const numInput = $('#numero_documento');
    numInput.addEventListener('input', () => {
      numInput.value = numInput.value.replace(/\D/g, '');
    });

    // Decisión 1.a · si el Trabajador escribe otra dirección, la casilla de
    // confirmación del medio de la Empresa deja de aplicar (el código va a SU
    // buzón).
    const correoInput = $('#correo_otp');
    if (correoInput) {
      correoInput.addEventListener('input', actualizarConfirmacionMedio);
    }
  }

  // ============================================================
  // 3. Pantalla: Verificación (OTP)
  // ============================================================

  function setupOtpForm() {
    const form = $('#form-otp');
    const btn = $('#btn-otp');
    const otpInput = $('#otp');
    const backBtn = $('#btn-back-identify');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideFormError('otp-error');

      const otp = otpInput.value.trim();
      if (!otp || otp.length !== 6) {
        return showFormError('otp-error', 'Ingresa el código de 6 dígitos que enviamos a tu correo.');
      }

      setButtonBusy(btn, 'VERIFICANDO...', 'VERIFICAR');
      try {
        await apiFetch('/api/sign/' + state.token + '/verify-otp', {
          method: 'POST',
          body: { otp: otp },
        });
        showScreen('document');
        setupDocumentScreen();
      } catch (err) {
        if (err.status === 422 && err.code === 'OTP_LOCKED') {
          showFormError('otp-error', 'Demasiados intentos. El código fue bloqueado. Solicita uno nuevo a tu empleador.');
          // Tras 4s, volver a la pantalla de identificación
          setTimeout(() => {
            hideFormError('otp-error');
            otpInput.value = '';
            showScreen('identify');
          }, 4000);
        } else if (err.status === 422 && err.code === 'OTP_INVALID') {
          const remaining = err.details && err.details.max_attempts
            ? (err.details.max_attempts - (err.details.attempts || 0))
            : null;
          showFormError(
            'otp-error',
            remaining && remaining > 0
              ? 'El código no es correcto. Te quedan ' + remaining + ' intento(s).'
              : 'El código no es correcto.'
          );
          otpInput.value = '';
          otpInput.focus();
        } else if (err.status === 410 && err.code === 'OTP_EXPIRADO') {
          // El 3.4(e) del Acuerdo de uso dice que el código "expira a los
          // seiscientos (600) segundos contados desde su envío". Acá el
          // backend ya lo cumple (antes no: un código de hace horas seguía
          // valiendo).
          //
          // Un 410 genérico ("Este enlace ha expirado") sería MENTIROSO: el
          // enlace sigue vivo, lo que venció es el código. Por eso este
          // caso va antes del 410 genérico, y la salida es pedir un código
          // nuevo (POST /api/sign/:token/resend-otp), no un callejón sin
          // salida.
          showFormError(
            'otp-error',
            'Tu código expiró (es válido por 10 minutos). Solicita uno nuevo a tu empleador.'
          );
          otpInput.value = '';
          const reenviarBtn = $('#btn-reenviar-otp');
          if (reenviarBtn) reenviarBtn.hidden = false;
          otpInput.focus();
        } else if (err.status === 410) {
          return showError('Este enlace ha expirado o ya fue utilizado.');
        } else {
          showFormError('otp-error', err.message || 'No se pudo verificar el código.');
        }
      } finally {
        clearButtonBusy(btn);
      }
    });

    // Auto-pasar al siguiente intento cuando se completen 6 dígitos
    otpInput.addEventListener('input', () => {
      otpInput.value = otpInput.value.replace(/\D/g, '').slice(0, 6);
      if (otpInput.value.length === 6) {
        form.dispatchEvent(new Event('submit', { cancelable: true }));
      }
    });

    backBtn.addEventListener('click', () => {
      otpInput.value = '';
      hideFormError('otp-error');
      showScreen('identify');
    });

    // 3.4(e) · Pedir un código nuevo cuando el anterior expiró.
    //
    // El endpoint solo deja reenviar si el OTP anterior YA expiró (por eso
    // devuelve OTP_NOT_EXPIRED si todavía sirve) o si el estado está
    // bloqueado. Es la salida del Trabajador cuando su código caduca, y la
    // razón por la que el 410 OTP_EXPIRADO no lo deja trapped.
    const reenviarBtn = $('#btn-reenviar-otp');
    if (reenviarBtn) {
      reenviarBtn.addEventListener('click', async () => {
        hideFormError('otp-error');
        setButtonBusy(reenviarBtn, 'ENVIANDO...', 'Solicitar un código nuevo');
        try {
          await apiFetch('/api/sign/' + state.token + '/resend-otp', {
            method: 'POST',
            body: {},
          });
          showFormNotice(
            'otp-error',
            'Te enviamos un código nuevo a tu correo. Revisa también la carpeta de spam.'
          );
          reenviarBtn.hidden = true;
          otpInput.value = '';
          otpInput.focus();
        } catch (err) {
          if (err.status === 400 && err.code === 'OTP_NOT_EXPIRED') {
            showFormError('otp-error', 'Tu código actual todavía sirve. Usalo antes de que expire.');
            reenviarBtn.hidden = true;
          } else if (err.status === 429) {
            showFormError('otp-error', 'Se enviaron demasiados códigos seguidos. Espera unos minutos e intenta de nuevo.');
          } else if (err.status === 410) {
            return showError('Este enlace ha expirado o ya fue utilizado.');
          } else {
            showFormError('otp-error', err.message || 'No se pudo enviar un código nuevo.');
          }
        } finally {
          clearButtonBusy(reenviarBtn);
        }
      });
    }
  }

  // ============================================================
  // 4. Pantalla: Documento (PDF + manifestación)
  // ============================================================

  /**
   * Pinta el Acuerdo de uso y controla la 3a casilla de aceptacion.
   *
   * Reglas:
   *  - Sin acuerdo en el contexto -> error visible y casilla deshabilitada
   *    de forma permanente. No hay forma de saltarse la lectura.
   *  - Con acuerdo -> se pinta con textContent (NUNCA innerHTML: es contenido
   *    que el firmante tiene que leer y poder copiar literal) y la casilla se
   *    habilita solo cuando el texto quedo completo a la vista.
   *  - Si el texto no desborda el recuadro ya esta completo a la vista: se
   *    habilita de inmediato, sin exigir un scroll que no existe.
   *
   * El hash del texto se deja en data-hash a proposito: es publico y permite
   * que el firmante o un tercero verifiquen que lo que leyo es exactamente lo
   * que el backend archivo.
   */
  function renderAcuerdo(contexto) {
    const panel = $('#acuerdo-panel');
    const box = $('#acuerdo-texto');
    const versionEl = $('#acuerdo-version');
    const versionInline = $('#acuerdo-version-inline');
    const nota = $('#acuerdo-nota');
    const errorBox = $('#acuerdo-error');
    const check = $('#consentimiento_aceptado');
    if (!panel || !box || panel.dataset.rendered === '1') return;

    const acuerdo = contexto && contexto.acuerdo;

    if (!acuerdo || !acuerdo.texto) {
      panel.dataset.rendered = '1';
      if (errorBox) {
        errorBox.textContent =
          'No pudimos cargar el Acuerdo de uso que debes aceptar. ' +
          'Contacta a tu empleador antes de firmar.';
        errorBox.hidden = false;
      }
      panel.hidden = true;
      if (check) {
        check.disabled = true;
        check.checked = false;
      }
      return;
    }

    panel.hidden = false;
    box.textContent = acuerdo.texto;
    box.dataset.hash = acuerdo.texto_hash || '';
    if (versionEl) versionEl.textContent = acuerdo.version || '';
    if (versionInline) {
      versionInline.textContent = acuerdo.version
        ? 'Acuerdo de uso ' + acuerdo.version
        : 'Acuerdo de uso';
    }

    if (check) check.disabled = true;
    const desborda = box.scrollHeight > box.clientHeight + 4;
    if (!desborda) {
      panel.dataset.rendered = '1';
      if (check) check.disabled = false;
      if (nota) nota.hidden = true;
      return;
    }

    if (nota) nota.hidden = false;
    const alLeerElFinal = function () {
      if (box.scrollTop + box.clientHeight < box.scrollHeight - 8) return;
      box.removeEventListener('scroll', alLeerElFinal);
      panel.dataset.rendered = '1';
      if (check) check.disabled = false;
      if (nota) nota.hidden = true;
    };
    box.addEventListener('scroll', alLeerElFinal);
    box.focus();
  }

  /**
   * Pinta el bloque de identificacion de la Empresa que solicita la firma.
   *
   * Que se pinte o no depende de `contexto.empresa`, que el backend resuelve
   * por id_empresa (la API key autenticada del cliente). Si viene null, la
   * empresa no esta dada de alta y el bloque se oculta COMPLETO: es mejor
   * no mostrar nada que mostrar medio bloque.
   *
   * Todo se pinta con textContent y nodos creados a mano, nunca con
   * innerHTML: los datos de la empresa vienen de la base y no son codigo
   * confiable. Una razon social con "<" no debe poder inyectar etiquetas.
   *
   * Los campos sin valor NO se omiten: salen como "Pendiente". Si la empresa
   * registro la razon social pero no el NIT, el bloque tiene que decir que el
   * NIT esta pendiente, porque un bloque que solo lista lo que alcanzo a
   * diligenciar aparenta ser una identificacion completa y no lo es.
   *
   * @param {object} contexto - Contexto publico de GET /s/:token.
   */
  /**
   * 8B · EL AVISO DE DATO SENSIBLE (numeral 10.8).
   *
   * El Titular tiene que ser informado de manera expresa y previa de que el
   * dato es sensible, de cuáles son los datos y de la finalidad, y otorgar su
   * consentimiento expreso en una casilla SEPARADA de la del Acuerdo.
   *
   * Dos estados del flujo:
   *
   *   - `requiere_autorizacion` es true: la base legal es la autorización
   *     expresa del Titular (el 10.8(c)), así que hace falta su casilla.
   *   - es false: la base legal la declaró la Empresa (el 10.8(c) también lo
   *     permite). El aviso se muestra igual —el Titular tiene que estar
   *     informado—, pero no hay nada que autorizar.
   *
   * El texto se pinta con textContent, nunca con innerHTML: es contenido que
   * el firmante debe leer y que queda archivado con su huella.
   */
  function renderDatoSensible(contexto) {
    const panel = $('#sensible-panel');
    const box = $('#sensible-texto');
    const versionEl = $('#sensible-version');
    const errorBox = $('#sensible-error');
    const check = $('#consentimiento_sensible');
    const label = $('#sensible-check-label');

    const d = contexto && contexto.dato_sensible;

    // Sin dato sensible: no hay nada que pedir. Queda registrado igual, para
    // que el boton de firmar no dependa de este bloque.
    if (!d) {
      state.sensibleRequired = false;
      state.sensitiveAccepted = true;
      if (panel) panel.hidden = true;
      if (label) label.hidden = true;
      return;
    }

    state.sensibleRequired = d.requiere_autorizacion === true && d.autorizado !== true;

    if (panel) panel.hidden = false;
    if (versionEl) versionEl.textContent = d.version || '';
    if (box) box.textContent = d.texto || '';
    if (errorBox) errorBox.hidden = true;

    if (!d.requiere_autorizacion) {
      // La base legal es la que declaró la Empresa: se informa, no se autoriza.
      state.sensitiveAccepted = true;
      if (label) label.hidden = true;
      if (check) { check.checked = true; check.disabled = true; }
      return;
    }

    if (label) label.hidden = false;

    if (d.autorizado === true) {
      // Ya se autorizó en una visita anterior: no se vuelve a pedir.
      state.sensitiveAccepted = true;
      if (check) { check.checked = true; check.disabled = true; }
      return;
    }

    state.sensitiveAccepted = false;
    if (check) { check.checked = false; check.disabled = false; }
  }

  function renderEmpresa(contexto) {
    const panel = $('#empresa-panel');
    const lista = $('#empresa-datos');
    if (!panel || !lista || panel.dataset.rendered === '1') return;

    const empresa = contexto && contexto.empresa;
    if (!empresa || !empresa.razon_social) {
      panel.hidden = true;
      panel.dataset.rendered = '1';
      return;
    }

    const CAMPOS = [
      ['Razon social', 'razon_social'],
      ['NIT', 'nit'],
      ['Domicilio', 'domicilio'],
      ['Representante legal', 'representante_legal'],
      ['Documento del representante', 'representante_legal_identificacion'],
      ['Responsable interno de datos personales', 'responsable_tratamiento'],
      ['Correo de contacto', 'responsable_tratamiento_correo'],
      ['Canal de PQRS', 'canal_pqrs'],
      ['Canal de incidentes de seguridad', 'canal_incidentes'],
      // Numeral 8.6 del Acuerdo: la Empresa debe comunicarle al Trabajador
      // el plazo de conservacion que le aplica al documento y donde puede
      // pedir una copia, antes de solicitarle la firma.
      ['Plazo de conservacion de tus datos', 'plazo_retencion'],
      ['Donde pedir una copia de tu documento', 'canal_solicitud_copia'],
    ];

    // La politica de datos se pinta aparte, como enlace, porque es lo unico
    // del bloque que el trabajador puede consultar por su cuenta.
    lista.textContent = '';
    CAMPOS.forEach(function (par) {
      const valor = empresa[par[1]];
      const fila = document.createElement('div');
      fila.className = 'empresa__campo';

      const dt = document.createElement('dt');
      dt.textContent = par[0];
      fila.appendChild(dt);

      const dd = document.createElement('dd');
      if (typeof valor === 'string' && valor.trim() !== '') {
        dd.textContent = valor;
      } else {
        dd.textContent = 'Pendiente';
        dd.className = 'empresa__pendiente';
      }
      fila.appendChild(dd);
      lista.appendChild(fila);
    });

    // El deber legal de conservacion SIN TERMINO (migracion 029). Si esta
    // activo, el documento del Trabajador no se borra automaticamente. Es
    // informacion que el 8.6 obliga a comunicar: el plazo y sus
    // consecuencias. Se pinta solo cuando la Empresa lo declaro.
    if (empresa.conservacion_por_deber_legal === true) {
      const fila = document.createElement('div');
      fila.className = 'empresa__campo';
      const dt = document.createElement('dt');
      dt.textContent = 'Supresion de este documento';
      fila.appendChild(dt);
      const dd = document.createElement('dd');
      dd.textContent = 'No se borra automaticamente: la Empresa tiene un deber legal '
        + 'de conservacion sin termino'
        + (empresa.norma_conservacion ? ' (' + empresa.norma_conservacion + ')' : '')
        + '.';
      fila.appendChild(dd);
      lista.appendChild(fila);
    }

    // Politica de datos: enlace a la politica de la EMPRESA, que es la
    // responsable de los datos del trabajador. K+AIR es la encargada y su
    // politica esta en el sitio web, no aqui.
    if (typeof empresa.politica_datos_url === 'string' && empresa.politica_datos_url !== '') {
      const fila = document.createElement('div');
      fila.className = 'empresa__campo';
      const dt = document.createElement('dt');
      dt.textContent = 'Politica de datos';
      fila.appendChild(dt);
      const dd = document.createElement('dd');
      // El href se valida contra http(s) porque la URL la digita la empresa
      // y este valor termina siendo un atributo href en el navegador del
      // firmante. Sin esta validacion, un "javascript:alert(...)" guardado en
      // la configuracion se ejecutaria al hacer clic.
      let url = empresa.politica_datos_url;
      let seguro = false;
      try {
        const parsed = new URL(url);
        seguro = parsed.protocol === 'http:' || parsed.protocol === 'https:';
        url = parsed.href;
      } catch (_) {
        seguro = false;
      }
      if (seguro) {
        const a = document.createElement('a');
        a.href = url;
        a.textContent = 'Ver la politica de datos';
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        dd.appendChild(a);
      } else {
        dd.textContent = 'No disponible';
        dd.className = 'empresa__pendiente';
      }
      fila.appendChild(dd);
      lista.appendChild(fila);
    }

    // La huella de la identificacion mostrada. El backend archiva exactamente
    // el mismo valor en el consentimiento: con el, un tercero puede verificar
    // que los datos que el firmante vio son los que quedaron registrados.
    if (typeof empresa.huella === 'string' && empresa.huella !== '') {
      const huella = document.createElement('p');
      huella.className = 'empresa__huella';
      huella.textContent = 'Huella de esta identificacion: ' + empresa.huella;
      panel.appendChild(huella);
    }

    // Cuando no hay politica de datos publicada NO se deja en blanco ni se
    // inventa una: el Acuerdo que esta justo debajo ya explica el
    // tratamiento y los derechos del titular. Es mejor eso que un
    // "Pendiente" que parece un dato que se le olvido a la empresa.
    if (!empresa.politica_datos_url) {
      const nota = document.createElement('p');
      nota.className = 'empresa__nota';
      nota.textContent =
        'Esta empresa no tiene una politica de datos publicada. ' +
        ' Sus derechos y el tratamiento de tus datos estan explicados en el ' +
        ' Capitulo X del Acuerdo de uso, mas abajo en esta pantalla.';
      panel.appendChild(nota);
    }

    panel.hidden = false;
    panel.dataset.rendered = '1';
  }

  /**
   * CAPÍTULO V · 5.3: muestra QUE documento se está firmando.
   *
   * El 5.3 obliga al Firmante a "firmar únicamente documentos cuyo contenido
   * sea exacto, completo y corresponda a lo que la Empresa le ha informado".
   * Para poder cumplir eso tiene que saber qué documento tiene delante: la
   * categoría (CONTRATO, ACTA, CERTIFICADO...) y su referencia.
   *
   * Los dos datos ya venían en el contexto público (`tipo_identificacion` e
   * `id_documento`), pero no se pintaban en ninguna parte: el comentario del
   * backend decía que la mini-app los mostraba y no era cierto.
   *
   * @param {object} contexto - Contexto publico de GET /s/:token.
   */
  function renderDocumentoIdentidad(contexto) {
    const bloque = $('#documento-identidad');
    if (!bloque) return;

    const tipo = contexto && contexto.tipo_identificacion;
    const referencia = contexto && contexto.id_documento;
    if (!tipo && !referencia) return;

    setText('#documento-categoria', 'Estás firmando ' + etiquetaDocumento(tipo) + '.');
    if (referencia) {
      setText('#documento-referencia', ' Referencia: ' + referencia + '.');
    }
    bloque.hidden = false;
  }

  /**
   * Etiqueta legible de la categoría del documento que se firma.
   *
   * Los valores son los de TIPOS_IDENTIFICACION (src/services/signRequest.js):
   * CONTRATO, OTROSI, ACTA, CONSENTIMIENTO, AUTORIZACION, REGLAMENTO,
   * POLITICA, CERTIFICADO, FORMATO, OTRO. Los que empiezan por vocal llevan
   * "una" y los demas "un"; los que no dicen nada, dicen "un documento", que
   * es lo unico que se puede afirmar sin inventar.
   *
   * @param {string} tipo
   * @returns {string}
   */
  function etiquetaDocumento(tipo) {
    switch (tipo) {
      case 'CONTRATO': return 'un contrato';
      case 'ACTA': return 'un acta';
      case 'CONSENTIMIENTO': return 'un consentimiento';
      case 'AUTORIZACION': return 'una autorización';
      case 'REGLAMENTO': return 'un reglamento';
      case 'POLITICA': return 'una política';
      case 'CERTIFICADO': return 'un certificado';
      case 'FORMATO': return 'un formato';
      default: return 'un documento';
    }
  }

  /**
   * CAPÍTULO V · 5.1(c): el canal de incidentes de seguridad de K+AIR.
   *
   * El 5.1(c) obliga al Firmante a "avisar de inmediato a la Empresa y a
   * K+AIR" si cree que sus datos de creación de la firma (el OTP y el
   * enlace de firma) quedaron en entredicho. El bloque de la Empresa da los
   * canales DEL CLIENTE; este da el de K+AIR.
   *
   * El HTML trae el valor por defecto (esta pantalla se ve también cuando no
   * hay contexto, que es justo el caso de la pantalla de error). Si el
   * servidor lo configuró distinto, el contexto lo actualiza.
   *
   * @param {object} contexto - Contexto publico de GET /s/:token.
   */
  function renderPieKair(contexto) {
    const span = $('#pie-kair-canal');
    if (!span) return;

    const canal = contexto && contexto.canal_incidentes_kair;
    if (typeof canal !== 'string' || canal.trim() === '') return;
    const valor = canal.trim();

    // El valor viene del servidor (la configuracion), pero se valida igual:
    // se convierte en un href y un href con otro esquema podria ejecutar
    // codigo en el navegador del firmante. Solo se acepta un correo; lo demas
    // se muestra como texto plano.
    if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(valor)) {
      span.textContent = valor;
      return;
    }

    const a = document.createElement('a');
    a.textContent = valor;
    a.setAttribute('href', 'mailto:' + valor);
    a.setAttribute('rel', 'noopener noreferrer');
    span.textContent = '';
    span.appendChild(a);
  }

  /**
   * El canal de PROTECCION DE DATOS de K+AIR (el 10.7(b)).
   *
   * Es DISTINTO del canal de incidentes: uno es para avisar que se
   * comprometieron los datos de creacion de la firma (5.1(c)); el otro es
   * para ejercer los derechos del Titular. Un solo canal con dos nombres es
   * un punto ciego con otro nombre.
   */
  function renderPieKairDatos(contexto) {
    const span = $('#pie-kair-canal-datos');
    if (!span) return;

    const canal = contexto && contexto.canal_proteccion_datos_kair;
    if (typeof canal !== 'string' || canal.trim() === '') return;
    const valor = canal.trim();

    if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(valor)) {
      span.textContent = valor;
      return;
    }

    const a = document.createElement('a');
    a.textContent = valor;
    a.setAttribute('href', 'mailto:' + valor);
    a.setAttribute('rel', 'noopener noreferrer');
    span.textContent = '';
    span.appendChild(a);
  }

  function setupDocumentScreen() {

    const pdfViewer = $('#pdf-viewer');
    const pdfDownloadLink = $('#pdf-download-link');
    const pdfUrl = '/api/sign/' + state.token + '/document.pdf';
    const avisoPendiente = $('#documento-pendiente-acuerdo');


    // I-103.A1.6 fix · CRÍTICO: declarar triggerChosen y callViewDocument
    // ANTES de registrar el listener 'load' y ANTES de asignar el src del
    // iframe. El setAttribute('src', ...) puede disparar el evento 'load'
    // inmediatamente (PDF en caché, localhost, o navegador rápido), y si
    // callViewDocument aún no está inicializado, JavaScript lanza
    // "Cannot access 'callViewDocument' before initialization" (TDZ).
    let triggerChosen = false;
    const callViewDocument = function (source) {
      if (state.viewDocumentAttempted) return;
      state.viewDocumentAttempted = true;
      triggerChosen = true;
      apiFetch('/api/sign/' + state.token + '/view-document', {
        method: 'POST',
        body: { segundos_en_pagina: 5, scroll_al_final: true },
      })
        .then(() => {
          state.pdfViewed = true;
        })
        .catch((err) => {
          // Si el error es el cambio de versión del Acuerdo (10.4), NO se
          // recarga: recargaría en bucle (el documento no se puede ver
          // hasta que el firmante acepte la versión vigente, y la versión
          // vigente cambia con la recarga). Lo que se hace es avisarle arriba,
          // junto al Acuerdo, para que lo lea y lo acepte; al aceptar, la
          // solicitud migra sola y el documento carga.
          if (err && (err.code === 'AGREEMENT_VERSION_NO_LONGER_ACTIVE'
            || err.code === 'AGREEMENT_VERSION_REACCEPT_REQUIRED')) {
            avisarCambioDeVersion();
            return;
          }
          // Si falla, permitimos un reintento en el próximo commit
          state.viewDocumentAttempted = false;
          // eslint-disable-next-line no-console
        });
    };

    // I-103.A1.6 fix · listener 'load' registrado DESPUÉS de inicializar
    // callViewDocument, pero ANTES de asignar el src del iframe. Esto
    // garantiza que cuando el iframe dispare 'load' (inmediatamente o
    // después), el callback ya tiene la función disponible.
    pdfViewer.addEventListener('load', () => callViewDocument('object-load'), { once: true });

    // FASE 6 · orden (g)/(h) del 3.4.
    //
    // (g) El Trabajador lee en pantalla el presente Acuerdo y lo acepta.
    //     "El Trabajador no puede avanzar en el flujo sin leer y aceptar el
    //     Acuerdo."
    // (h) El Trabajador visualiza y descarga el documento objeto de la firma.
    //
    // El documento va DESPUÉS de la aceptación. El backend tampoco lo sirve
    // antes (409 CONSENT_NOT_ACCEPTED), así que cargarlo aquí antes de
    // tiempo solo dejaría un error en el visor.
    let documentoCargado = false;
    const cargarDocumento = function () {
      if (documentoCargado) return;
      // 8B · La puerta del 10.8: con dato sensible, el aviso y la
      // autorización van ANTES del documento. El 10.8(a) exige que la
      // información sea PREVIA; si el PDF apareciera antes, no lo sería.
      // El backend tampoco lo sirve antes (409 SENSIBLE_CONSENT_NOT_ACCEPTED),
      // así que cargarlo aqui solo dejaria un error en el visor.
      if (!state.consentAccepted) return;
      if (state.sensibleRequired && !state.sensitiveAccepted) return;
      documentoCargado = true;
      if (avisoPendiente) avisoPendiente.hidden = true;
      // Cargar PDF en el visor (el listener ya está listo y la función
      // callViewDocument ya está inicializada).
      pdfViewer.setAttribute('src', pdfUrl);
      // I-103.A1.6 fix · pdfDownloadLink es null porque el <a id="pdf-download-link">
      // está DENTRO del iframe (línea 88 de index.html). Cuando el iframe carga
      // el PDF, el navegador reemplaza su contenido y el <a> desaparece del DOM
      // accesible desde el documento principal. Por eso necesitamos el null-check.
      if (pdfDownloadLink) {
        pdfDownloadLink.setAttribute('href', pdfUrl);
      }
      // Fallback si el evento load no dispara (navegadores sin visor PDF nativo,
      // o si el usuario llegó a esta pantalla muy rápido)
      setTimeout(() => {
        if (!triggerChosen) callViewDocument('fallback-timeout');
      }, 4000);
    };

    // Habilitar botón FIRMAR solo cuando ambos checkboxes estén marcados
    const check1 = $('#manifestacion_leido');
    const check2 = $('#manifestacion_voluntad');
    const check3 = $('#consentimiento_aceptado');   // Bloque E6.5: 3ª casilla

    // El Acuerdo se pinta y la 3a casilla se habilita solo tras leerlo.
    renderAcuerdo(state.contexto);

    // 8B · El aviso de dato sensible (10.8). Se pinta junto al Acuerdo, pero
    // el bloque esta ARRIBA del visor: la informacion tiene que ser previa.
    renderDatoSensible(state.contexto);

    // El bloque de la Empresa va antes del PDF en el DOM; se pinta junto al
    // Acuerdo. No habilita ni bloquea ninguna casilla: es informacion, no una
    // manifestacion de voluntad. El unico efecto de que falte es que no se
    // muestra.
    renderEmpresa(state.contexto);

    // CAPÍTULO V: qué documento se está firmando (5.3) y el canal de
    // incidentes de K+AIR (5.1(c)). Los dos son información, no casillas: no
    // habilitan ni bloquean nada.
    renderDocumentoIdentidad(state.contexto);
    renderPieKair(state.contexto);
    renderPieKairDatos(state.contexto);

    const btnCommit = $('#btn-commit');
    const btnReject = $('#btn-reject');


    const updateCommitButton = function () {
      const c1 = check1 && check1.checked;
      const c2 = check2 && check2.checked;
      // check3 es solo el trigger visual: el botón depende del estado
      // de aceptación en backend (state.consentAccepted), no del .checked.
      // Esto evita que un click rápido sin esperar el POST habilite el botón.
      const c3Accepted = state.consentAccepted === true;
      // 8B: si el documento tiene informacion de salud, su autorizacion
      // expresa es tan necesaria como la del Acuerdo para poder firmar.
      const sensibleOk = state.sensitiveRequired
        ? state.sensitiveAccepted === true
        : true;
      // PDF debe haber sido visto (view-document exitoso).
      const pdfOk = state.pdfViewed === true;
      const newDisabled = !(c1 && c2 && c3Accepted && sensibleOk && pdfOk);
      btnCommit.disabled = newDisabled;
    };
    check1.addEventListener('change', () => {
      updateCommitButton();
    });
    check2.addEventListener('change', () => {
      updateCommitButton();
    });

    // Bloque E6.5: handler del 3er checkbox (Acepto el Acuerdo v1.0).
    //
    // Reglas:
    //   - Al MARCAR: POST /api/sign/:token/consent/accept
    //     · 200 (idempotente=false o true) → state.consentAccepted = true
    //     · 4xx → check3.checked = false, state.consentAccepted = false,
    //              mostrar error, permitir reintentar
    //   - Al DESMARCAR: NO hacer "desaceptar" en BD (el consentimiento ya
    //     aceptado permanece aceptado). Solo resetear el estado local
    //     para deshabilitar el botón. El usuario puede volver a marcar
    //     y el endpoint se llamará de nuevo (será idempotente).
    if (check3) {
      check3.addEventListener('change', async () => {
        if (check3.checked) {
          // Evitar doble POST si el usuario marca/desmarca rápido
          if (state.consentAcceptInProgress) {
            check3.checked = false;
            return;
          }
          state.consentAcceptInProgress = true;
          hideFormError('commit-error');
          try {
            const result = await apiFetch(
              '/api/sign/' + state.token + '/consent/accept',
              { method: 'POST', body: {} }
            );
            state.consentAccepted = true;
            // FASE 6 · orden (g)/(h): con el Acuerdo aceptado ya se puede
            // mostrar el documento. Antes de esto el visor se queda vacío a
            // propósito.
            cargarDocumento();
          } catch (err) {
            // Revertir el checkbox a false (el consentimiento NO fue aceptado)
            check3.checked = false;
            state.consentAccepted = false;
            // Mensajes específicos por código de error
            let msg;
            if (err.status === 410) {
              // Token expirado o ya usado → ir a pantalla de error fatal
              return showError('Este enlace ha expirado o ya fue utilizado.');
            } else if (err.status === 404) {
              return showError('El enlace que usaste no es válido o ya no existe.');
            } else if (err.code === 'CONSENT_ACCEPT_TOO_EARLY') {
              msg = 'No se puede aceptar el Acuerdo en este momento. Intenta recargar la página.';
            } else if (err.code === 'CONSENT_REQUIRED') {
              // El mensaje decia "esta solicitud NO requiere aceptacion de
              // Acuerdo", que es al reves de lo que significa el codigo: el
              // servidor lanza CONSENT_REQUIRED cuando la fila NO TIENE
              // consentimiento vinculado (`consent_id` nulo), y en ese caso la
              // mini-app no puede aceptar el Acuerdo y la firma no se puede
              // completar. Decirle al firmante que la solicitud "no requiere"
              // aceptacion lo dejaba sin salida, cuando la salida es una sola:
              // que la Empresa le emita un enlace nuevo.
              msg = 'A esta solicitud le falta el consentimiento del Acuerdo. '
                + 'Contacta a tu empleador para que te envíe un enlace nuevo.';
            } else if (err.code === 'CONSENT_LOCKED') {
              msg = 'El Acuerdo está bloqueado por intentos previos. Contacta al área de RRHH.';
            } else if (err.code === 'CONSENT_INCONSISTENT_STATE') {
              msg = 'El Acuerdo tiene un estado inconsistente. Contacta al área de RRHH.';
            } else if (err.code === 'CONSENT_NOT_FOUND') {
              msg = 'No se encontró el consentimiento. Contacta al área de RRHH.';
            } else if (err.code === 'CONSENT_VERSION_MISMATCH' ||
                       err.code === 'CONSENT_WORKER_MISMATCH' ||
                       err.code === 'CONSENT_COMPANY_MISMATCH') {
              msg = 'El Acuerdo no corresponde a esta solicitud. Contacta al área de RRHH.';
            } else {
              msg = err.message || 'No se pudo registrar la aceptación del Acuerdo.';
            }
            showFormError('commit-error', msg);
          } finally {
            state.consentAcceptInProgress = false;
            updateCommitButton();
          }
        } else {
          // Desmarcar: solo resetear estado local, NO tocar backend
          state.consentAccepted = false;
          updateCommitButton();
        }
      });
    }

    // 8B · La casilla del dato sensible (10.8).
    //
    // Es SEPARADA de la del Acuerdo a proposito: una es "acepto las reglas
    // del servicio" y la otra es "autorizo el tratamiento de mi informacion
    // de salud". Al marcar, se registra la autorizacion; al desmarcar, no se
    // toca el backend (la autorizacion ya dada es un hecho) y solo se
    // resetea el estado local.
    const check4 = $('#consentimiento_sensible');
    if (check4) {
      check4.addEventListener('change', async () => {
        if (!check4.checked) {
          state.sensitiveAccepted = false;
          updateCommitButton();
          return;
        }
        if (state.sensitiveAcceptInProgress) {
          check4.checked = false;
          return;
        }
        state.sensitiveAcceptInProgress = true;
        hideFormError('commit-error');
        try {
          await apiFetch(
            '/api/sign/' + state.token + '/consent/sensible',
            { method: 'POST', body: { autoriza: true } }
          );
          state.sensitiveAccepted = true;
          // Con la autorizacion registrada, el documento ya puede mostrarse.
          cargarDocumento();
        } catch (err) {
          check4.checked = false;
          state.sensitiveAccepted = false;
          let msg;
          if (err.code === 'SENSIBLE_CONSENT_NOT_ACCEPTED') {
            msg = 'No se pudo registrar la autorizacion de los datos sensibles. '
              + 'Contacta a tu empleador.';
          } else if (err.code === 'CONSENT_NOT_REQUIRED') {
            msg = 'Este documento se trata con una base legal declarada por la empresa. '
              + 'Recarga la pagina para continuar.';
          } else if (err.status === 410) {
            return showError('Este enlace ha expirado o ya fue utilizado.');
          } else if (err.status === 404) {
            return showError('El enlace que usaste no es valido o ya no existe.');
          } else {
            msg = err.message || 'No se pudo registrar la autorizacion.';
          }
          showFormError('commit-error', msg);
        } finally {
          state.sensitiveAcceptInProgress = false;
          updateCommitButton();
        }
      });
    }

    check1.addEventListener('input', () => {
    });
    check2.addEventListener('input', () => {    });
    if (check3) {
      check3.addEventListener('input', () => {
      });
    }
    check1.addEventListener('click', () => {
    });
    check2.addEventListener('click', () => {
    });
    if (check3) {
      check3.addEventListener('click', () => {
      });
    }

    // FASE 6 · orden (g)/(h): ¿el Firmante ya había aceptado el Acuerdo en
    // una visita anterior? (recarga de la página, otro dispositivo). El
    // backend lo dice en `acuerdo_aceptado`. Entonces el documento se
    // muestra de una, sin volver a pedir la aceptación: el Acuerdo ya está
    // aceptado en la base, y volver a marcarlo sería un POST idempotente.
    if (state.contexto && state.contexto.acuerdo_aceptado === true) {
      state.consentAccepted = true;
      if (check3) {
        check3.checked = true;
        check3.disabled = true;
      }
      cargarDocumento();
    }

    // 8B: el aviso de "falta algo" se muestra si falta CUALQUIERA de los dos.
    // Con dato sensible, el documento tampoco se puede ver sin su
    // autorizacion (el 10.8(a) exige que la informacion sea previa), asi que
    // el mensaje tiene que decirlo.
    if (avisoPendiente) {
      const faltaAcuerdo = !state.consentAccepted;
      const faltaSensible = state.sensibleRequired && !state.sensitiveAccepted;
      avisoPendiente.hidden = !(faltaAcuerdo || faltaSensible);
      if (faltaSensible) {
        avisoPendiente.textContent =
          'Para ver el documento, primero autoriza el tratamiento de la informacion de salud '
          + '(aviso de datos sensibles) y acepta el Acuerdo de uso.';
      } else {
        avisoPendiente.textContent =
          'Para ver el documento, primero lee y acepta el Acuerdo de uso que aparece mas arriba.';
      }
    }

    updateCommitButton();

    // Confirmación explícita antes de rechazar
    btnReject.addEventListener('click', async () => {
      const ok = window.confirm('¿Confirmas que NO deseas firmar este documento?\n\nEsta decisión quedará registrada y no podrás cambiarla después.');
      if (!ok) return;

      setButtonBusy(btnReject, 'REGISTRANDO...', 'NO DESEO FIRMAR');
      btnCommit.disabled = true;
      try {
        await apiFetch('/api/sign/' + state.token + '/reject', {
          method: 'POST',
          body: {},
        });
        showScreen('rejected');
      } catch (err) {
        if (err.status === 409) {
          showFormError('commit-error', 'Esta solicitud ya no se puede rechazar (probablemente ya fue firmada o rechazada).');
        } else if (err.status === 410) {
          return showError('Este enlace ha expirado.');
        } else {
          showFormError('commit-error', err.message || 'No se pudo registrar el rechazo.');
        }
      } finally {
        clearButtonBusy(btnReject);
        btnCommit.disabled = !(check1.checked && check2.checked);
      }
    });

    // Commit: firma del documento
    $('#form-commit').addEventListener('submit', async (e) => {
      e.preventDefault();
      hideFormError('commit-error');

      if (!check1.checked || !check2.checked) {
        return showFormError('commit-error', 'Debes confirmar ambas casillas antes de firmar.');
      }

      setButtonBusy(btnCommit, 'FIRMANDO...', 'FIRMAR ELECTRÓNICAMENTE');
      btnReject.disabled = true;

      try {
        // Si view-document no se llamó todavía (por ejemplo, load no disparó
        // y aún no llegó al fallback), lo llamamos ahora. Si ya se llamó, el
        // backend lo aceptará y simplemente dejará el estado en DOCUMENT_VIEWED.
        if (!state.pdfViewed) {
          await apiFetch('/api/sign/' + state.token + '/view-document', {
            method: 'POST',
            body: { segundos_en_pagina: 5, scroll_al_final: true },
          });
          state.pdfViewed = true;
        }

        const result = await apiFetch('/api/sign/' + state.token + '/commit', {
          method: 'POST',
          body: { manifestacion_aceptada: true },
        });

        showSignedScreen(result);
      } catch (err) {
        if (err.status === 409 && err.code === 'INVALID_STATE_TRANSITION') {
          showFormError('commit-error', 'Esta solicitud ya no se puede firmar. Probablemente ha expirado o ya fue procesada.');
        } else if (err.code === 'AGREEMENT_VERSION_NO_LONGER_ACTIVE'
          || err.code === 'AGREEMENT_VERSION_REACCEPT_REQUIRED') {
          // 10.4 · El Acuerdo cambió. No es un callejón sin salida: se
          // recarga la pantalla para que el firmante lea y acepte la
          // versión vigente, y la solicitud migra sola al aceptar.
          return recargarPorCambioDeVersion(err);
        } else if (err.status === 410) {
          return showError('Este enlace ha expirado.');
        } else if (err.status === 422) {
          showFormError('commit-error', 'Debes leer el documento antes de firmarlo.');
        } else {
          showFormError('commit-error', err.message || 'No se pudo completar la firma.');
        }
        btnCommit.disabled = false;
        btnCommit.textContent = 'FIRMAR ELECTRÓNICAMENTE';
      } finally {
        btnReject.disabled = false;
      }
    });
  }

  /**
   * 10.4 · El Acuerdo de uso cambió mientras el firmante estaba en la
   * pantalla.
   *
   * La solución NO es un error seco: se recarga la página, el contexto
   * vuelve a traer la versión VIGENTE del Acuerdo, el firmante la lee y
   * marca la casilla de aceptación, y en ese momento la solicitud migra a
   * esa versión (el backend lo hace solo).
   */
  function recargarPorCambioDeVersion(err) {
    const mensaje = 'El Acuerdo de uso cambió. Te vamos a mostrar la versión '
      + 'vigente para que la leas y la aceptes antes de firmar.';
    if (typeof showFormError === 'function') {
      showFormError('commit-error', mensaje);
    }
    setTimeout(function () {
      window.location.reload();
    }, 1500);
    return null;
  }

  /**
   * 10.4 · El documento no se puede ver todavía porque el Acuerdo vigente
   * todavía no se ha aceptado.
   *
   * NO se recarga: la recarga volvería a pedir el documento y a fallar
   * (bucle). Se avisa arriba, junto al Acuerdo, y el firmante lo acepta;
   * al aceptar, la solicitud migra y el documento carga.
   */
  function avisarCambioDeVersion() {
    const aviso = document.getElementById('documento-pendiente-acuerdo');
    if (aviso) {
      aviso.hidden = false;
      aviso.textContent = 'El Acuerdo de uso cambió: lee la versión vigente que '
        + 'ves arriba y acepta la casilla para poder ver el documento.';
    }
    showFormError('commit-error', 'El Acuerdo de uso cambió. Lee la versión '
      + 'vigente y acepta la casilla para continuar.');
  }

  // ============================================================
  // 5. Pantalla: Firmado
  // ============================================================

  function showSignedScreen(result) {
    showScreen('signed');
    wireSignedDownloads();
  }

  /**
   * FASE 6 · 5.4: habilita las descargas desde el propio enlace de firma.
   *
   * "El Firmante puede imprimir o descargar copia de este Acuerdo y del
   * documento firmado desde el propio enlace de firma, sin costo alguno."
   *
   * Son descargas de solo lectura sobre lo que ya está firmado. El enlace no
   * reabre el flujo: desde acá no se puede identificar, pedir OTP ni firmar.
   */
  function wireSignedDownloads() {
    const signedLink = $('#signed-document-link');
    if (signedLink && state.token) {
      signedLink.setAttribute('href', '/api/sign/' + state.token + '/signed-document.pdf');
    }
    const acuerdoLink = $('#acuerdo-copy-link');
    if (acuerdoLink && state.token) {
      acuerdoLink.setAttribute('href', '/api/sign/' + state.token + '/acuerdo.txt');
    }
    wireConstanciaDownload();
    const descargas = $('#signed-downloads');
    if (descargas) descargas.hidden = false;
  }

  /**
   * La Constancia se baja del propio enlace de firma (5.4 del Acuerdo de uso).
   *
   * Antes el botón "VER CONSTANCIA" estaba oculto: la única ruta de la
   * Constancia era la interna (/internal/sign-requests/:id/constancia.pdf,
   * que exige API key) y el Trabajador la recibía por correo. Ahora hay una
   * ruta pública con el token, así que la Constancia se descarga desde acá
   * y no depende del correo.
   *
   * El botón se pide con fetch y no con un <a target="_blank">: así un
   * error de K+AIR (enlace vencido, Constancia no disponible) se muestra
   * como alerta en esta misma pantalla, y no como un JSON crudo en una
   * pestaña nueva.
   */
  function wireConstanciaDownload() {
    const link = $('#constancia-link');
    const errorEl = $('#constancia-error');
    if (!link || !state.token) return;

    link.setAttribute('href', '/api/sign/' + state.token + '/constancia.pdf');
    showEl(link);

    // El listener se pone una sola vez: esta función corre desde el commit
    // y también al reabrir el enlace ya firmado.
    if (link.dataset.listener) return;
    link.dataset.listener = '1';

    link.addEventListener('click', function (ev) {
      ev.preventDefault();
      hideEl(errorEl);
      fetch('/api/sign/' + state.token + '/constancia.pdf')
        .then(function (res) {
          if (!res.ok) {
            var msg = 'No se pudo descargar la Constancia.';
            return res.json().then(function (data) {
              if (data && data.error && data.error.message) msg = data.error.message;
              throw new Error(msg);
            }, function () {
              throw new Error(msg);
            });
          }
          var cd = res.headers.get('content-disposition') || '';
          var m = /filename="?([^";]+)"?/.exec(cd);
          return res.blob().then(function (blob) {
            return { blob: blob, nombre: m ? m[1] : 'constancia.pdf' };
          });
        })
        .then(function (out) {
          var url = URL.createObjectURL(out.blob);
          var a = document.createElement('a');
          a.href = url;
          a.download = out.nombre;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        })
        .catch(function (err) {
          if (errorEl) {
            errorEl.textContent = err.message || 'No se pudo descargar la Constancia.';
            errorEl.hidden = false;
          }
        });
    });
  }

  // ============================================================
  // 6. Pantalla: Verificación pública (I-VERIFICACION-PUBLICA)
  // ============================================================
  // Vista de solo lectura accesible SOLO desde el botón "Verificar
  // autenticidad" en screen-signed. NO permite identificar, pedir OTP ni
  // firmar — solo muestra metadata verificable y permite subir el PDF
  // para comparar SHA-256 contra el original firmado.

  function showVerifyScreen() {
    showScreen('verify');
    // Reset UI
    var loading = $('#verify-loading');
    var content = $('#verify-content');
    showEl(loading);
    hideEl(content);
    hideEl($('#verify-status'));
    hideEl($('#verify-error'));
    hideEl($('#verify-pdf-result'));
    hideEl($('#verify-pdf-error'));

    // Cargar metadata via GET /api/sign/:token/verify
    apiFetch('/api/sign/' + state.token + '/verify')
      .then(function (ctx) {
        state.verifyContext = ctx;
        renderVerifyContext(ctx);
        hideEl(loading);
        showEl(content);
      })
      .catch(function (err) {
        hideEl(loading);
        showEl(content);
        // 8A.1 · Vencimiento del plazo de conservación (numeral 10.6).
        // Antes, vencido el plazo, la verificación seguía respondiendo "firma
        // registrada y documento íntegro". Ahora dice lo que corresponde: no
        // está disponible porque venció el plazo que declaró la empresa.
        if (err.code === 'CONSERVACION_VENCIDA') {
          showVerifyError('No disponible por vencimiento del plazo. La empresa fijó un plazo de conservación para este documento y ya venció, así que la evidencia de la firma ya no está disponible. Si necesitas una copia de lo que firmaste, pídela al área de Recursos Humanos de la empresa.');
          return;
        }
        showVerifyError('No se pudo cargar la información de verificación: ' + (err.message || 'Error desconocido'));
      });
  }

  function renderVerifyContext(ctx) {
    // Status badge
    //
    // Este banner antes dependía SOLO de ctx.estado y decía "Firma verificada —
    // documento íntegro" sin que nadie hubiera comprobado nada: el servidor solo
    // devolvía el hash guardado. Ahora el servidor recalcula el SHA-256 del PDF
    // firmado y devuelve integridad_documento. La UI distingue tres hechos que
    // antes iban fundidos en uno solo:
    //   1) la firma quedó registrada;
    //   2) el servidor comprobó que su archivo sigue íntegro;
    //   3) el usuario subió su copia y coincidió (eso lo muestra verify-pdf).
    var statusEl = $('#verify-status');
    if (statusEl) {
      var isSigned = (ctx.estado === 'SIGNED' || ctx.estado === 'DUAL_FIRMADO');
      var integ = ctx.integridad_documento || null;
      var clase = 'alert ';
      var html;
      if (isSigned && integ && integ.verificado && integ.coincide) {
        clase += 'alert-success';
        html = '<h3>Firma registrada y documento íntegro</h3>' +
          '<p>El servidor recalculó la huella del archivo que almacena y coincide ' +
          'con la que quedó registrada en el momento de la firma. Abajo puedes ' +
          'comprobar que <em>tu</em> copia es la misma.</p>';
      } else if (isSigned && integ && integ.verificado && !integ.coincide) {
        clase += 'alert-error';
        html = '<h3>El archivo almacenado no coincide con la firma</h3>' +
          '<p>' + escHtml(integ.motivo || 'El archivo fue alterado después de la firma.') +
          ' <strong>No confíes en este documento y contacta a tu empleador.</strong></p>';
      } else if (isSigned) {
        clase += 'alert-info';
        html = '<h3>Firma registrada, integridad no comprobada</h3>' +
          '<p>' + escHtml(integ && integ.motivo
            ? integ.motivo
            : 'El servidor no pudo comprobar la integridad del archivo.') + '</p>';
      } else {
        clase += 'alert-info';
        html = '<h3>Documento aún no firmado</h3><p>Estado actual: ' + escHtml(ctx.estado) + '</p>';
      }
      statusEl.className = clase;
      statusEl.innerHTML = html;
      statusEl.hidden = false;
    }

    // Metadata
    setText('#verify-id-solicitud', ctx.id_solicitud);
    setText('#verify-estado', ctx.estado);
    setText('#verify-fecha-firma', ctx.fecha_firma ? formatDateTime(ctx.fecha_firma) : '—');

    // Hashes
    setText('#verify-hash-original', ctx.document_hash_original || '—');
    setText('#verify-hash-firmado', ctx.document_hash_firmado || '—');
    setText('#verify-hash-evidencia', ctx.evidence_hash || '—');

    // Firmantes
    var firmantesEl = $('#verify-firmantes');
    if (firmantesEl) {
      firmantesEl.innerHTML = renderFirmanteList(ctx);
    }
  }

  function renderFirmanteList(ctx) {
    var parts = [];
    // Si es DUAL, mostrar ambos firmantes (trabajador + rep)
    if (ctx.firmante_trabajador) {
      parts.push(renderFirmanteCard('Trabajador', ctx.firmante_trabajador));
    }
    if (ctx.firmante) {
      parts.push(renderFirmanteCard(ctx.firmante.tipo || 'Firmante', ctx.firmante));
    }
    if (parts.length === 0) {
      return '<p class="instructions">Sin información de firmante disponible.</p>';
    }
    return parts.join('');
  }

  function renderFirmanteCard(tipo, f) {
    var lines = [
      '<dt>Tipo</dt><dd>' + escHtml(tipo) + '</dd>'
    ];
    if (f.nombre) lines.push('<dt>Nombre</dt><dd>' + escHtml(f.nombre) + '</dd>');
    if (f.cargo) lines.push('<dt>Cargo</dt><dd>' + escHtml(f.cargo) + '</dd>');
    if (f.identificacion_enmascarada) lines.push('<dt>Identificación</dt><dd>' + escHtml(f.identificacion_enmascarada) + '</dd>');
    if (f.correo_enmascarado) lines.push('<dt>Correo verificado</dt><dd>' + escHtml(f.correo_enmascarado) + '</dd>');
    if (f.fecha_firma) lines.push('<dt>Fecha firma</dt><dd>' + escHtml(formatDateTime(f.fecha_firma)) + '</dd>');
    return '<dl class="verify-info verify-firmante"><dt>Rol</dt><dd><strong>' + escHtml(tipo) + '</strong></dd>' + lines.slice(1).join('') + '</dl>';
  }

  function showVerifyError(message) {
    var errEl = $('#verify-error');
    if (errEl) {
      errEl.textContent = message;
      errEl.hidden = false;
    }
  }

  /**
   * I-FIRMA-DUAL · Adapta el contenido de screen-signed según el estado.
   * - 'single' (SIGNED): firma simple del trabajador.
   * - 'dual'   (DUAL_FIRMADO): firma dual (trabajador + representante legal).
   *
   * La pantalla y el botón "Verificar autenticidad" son los mismos; solo
   * cambia el copy para que el usuario entienda qué tipo de firma se completó.
   */
  function setSignedMessageVariant(variant) {
    var singleTitle = $('#signed-title-single');
    var dualTitle = $('#signed-title-dual');
    var singleMsg = $('#signed-msg-single');
    var dualMsg = $('#signed-msg-dual');
    if (variant === 'dual') {
      if (singleTitle) singleTitle.hidden = true;
      if (dualTitle) dualTitle.hidden = false;
      if (singleMsg) singleMsg.hidden = true;
      if (dualMsg) dualMsg.hidden = false;
    } else {
      if (singleTitle) singleTitle.hidden = false;
      if (dualTitle) dualTitle.hidden = true;
      if (singleMsg) singleMsg.hidden = false;
      if (dualMsg) dualMsg.hidden = true;
    }
  }

  function setupVerifyScreen() {
    // Botón "Verificar autenticidad" en screen-signed → abre screen-verify
    var btnGo = $('#btn-go-verify');
    if (btnGo) {
      btnGo.addEventListener('click', function () { showVerifyScreen(); });
    }

    // I-LINK-REABIERTO · misma salida desde la pantalla de error.
    var btnErr = $('#btn-error-go-verify');
    if (btnErr) {
      btnErr.addEventListener('click', function () { showVerifyScreen(); });
    }

    // Botón "Volver" → re-despacha el estado REAL del enlace.
    //
    // Antes regresaba a screen-signed a ciegas, lo que mentía cuando se
    // llegaba desde la pantalla de error o por el deep-link ?verificar=1:
    // podía mostrar "✓ Documento firmado" sobre una solicitud nunca firmada.
    // Reejecutar init() vuelve a consultar /s/<token> y deja que la máquina
    // de estados ubique al usuario donde realmente está.
    var btnBack = $('#btn-back-to-signed');
    if (btnBack) {
      btnBack.addEventListener('click', function () {
        state.contexto = null;
        init();
      });
    }

    // Form de upload de PDF
    var formPdf = $('#form-verify-pdf');
    if (formPdf) {
      formPdf.addEventListener('submit', function (ev) {
        ev.preventDefault();
        submitVerifyPdf();
      });
    }

    // Validación cliente del tamaño (50MB del backend, validamos a 45MB
    // para tener margen contra base64 que infla ~33%)
    var fileInput = $('#verify-pdf-input');
    if (fileInput) {
      fileInput.addEventListener('change', function () {
        var f = fileInput.files && fileInput.files[0];
        var info = $('#verify-pdf-info');
        if (!f) {
          if (info) info.textContent = 'Máx. 45 MB. Solo archivos PDF.';
          return;
        }
        var sizeMB = (f.size / (1024 * 1024)).toFixed(1);
        if (f.size > 45 * 1024 * 1024) {
          if (info) info.textContent = '❌ Archivo demasiado grande (' + sizeMB + ' MB). Máximo 45 MB.';
          fileInput.value = '';
        } else {
          if (info) info.textContent = '✅ ' + f.name + ' (' + sizeMB + ' MB)';
        }
      });
    }
  }

  function submitVerifyPdf() {
    var fileInput = $('#verify-pdf-input');
    var btn = $('#btn-verify-pdf');
    var errEl = $('#verify-pdf-error');
    var resultEl = $('#verify-pdf-result');
    hideEl(errEl);
    hideEl(resultEl);

    var file = fileInput && fileInput.files && fileInput.files[0];
    if (!file) {
      if (errEl) { errEl.textContent = 'Selecciona un archivo PDF primero.'; errEl.hidden = false; }
      return;
    }

    // Validar tipo MIME (defensa adicional al accept="application/pdf")
    if (file.type && file.type !== 'application/pdf') {
      if (errEl) { errEl.textContent = 'El archivo debe ser un PDF.'; errEl.hidden = false; }
      return;
    }

    setButtonBusy(btn, 'VERIFICANDO...', 'VERIFICAR PDF');

    // Leer como ArrayBuffer y convertir a base64
    var reader = new FileReader();
    reader.onload = function () {
      var bytes = new Uint8Array(reader.result);
      // base64 encoding (unicode-safe)
      var binary = '';
      for (var i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      var base64 = btoa(binary);

      apiFetch('/api/sign/' + state.token + '/verify-pdf', {
        method: 'POST',
        body: JSON.stringify({ pdf_base64: base64 }),
      })
        .then(function (result) {
          clearButtonBusy(btn);
          renderVerifyPdfResult(result);
        })
        .catch(function (err) {
          clearButtonBusy(btn);
          if (errEl) { errEl.textContent = 'Error: ' + (err.message || 'desconocido'); errEl.hidden = false; }
        });
    };
    reader.onerror = function () {
      clearButtonBusy(btn);
      if (errEl) { errEl.textContent = 'No se pudo leer el archivo.'; errEl.hidden = false; }
    };
    reader.readAsArrayBuffer(file);
  }

  function renderVerifyPdfResult(result) {
    var resultEl = $('#verify-pdf-result');
    if (!resultEl) return;
    resultEl.className = 'alert ' + (result.matches ? 'alert-success' : 'alert-error');
    if (result.matches) {
      resultEl.innerHTML =
        '<h3>✅ El archivo coincide con el original firmado</h3>' +
        '<p>El SHA-256 del PDF que subiste es idéntico al hash registrado al momento de la firma.</p>' +
        '<p><small>Hash calculado: <code>' + escHtml(result.computed_hash) + '</code></small></p>';
    } else {
      resultEl.innerHTML =
        '<h3>❌ El archivo NO coincide con el original firmado</h3>' +
        '<p>El PDF que tienes puede haber sido alterado, o no es el mismo archivo que se firmó.</p>' +
        '<p><small>Hash del servidor: <code>' + escHtml(result.server_hash || '—') + '</code></small></p>' +
        '<p><small>Hash calculado: <code>' + escHtml(result.computed_hash) + '</code></small></p>';
    }
    resultEl.hidden = false;
  }

  // ============================================================
  // 9A · LOS MEDIOS AUTORIZADOS (el 8.2)
  // ============================================================

  /**
   * Los medios autorizados del Trabajador (el 8.2).
   *
   * El 8.2 le da el derecho a modificarlos "en cualquier momento y sin costo
   * alguno". Esta pantalla es esa vía.
   */
  function setupMediosScreen() {
    const btn = $('#btn-mis-medios');
    if (btn) {
      btn.addEventListener('click', async () => {
        await cargarMedios();
        showScreen('medios');
      });
    }

    const form = $('#form-medios');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideFormError('medios-error');
        const correo = ($('#medio_correo') && $('#medio_correo').value || '').trim();
        if (!correo) {
          return showFormError('medios-error', 'Escribe el correo que querés agregar.');
        }
        const btnAdd = $('#btn-medio-agregar');
        setButtonBusy(btnAdd, 'AGREGANDO...', 'AGREGAR');
        try {
          const result = await apiFetch('/api/sign/' + state.token + '/medios', {
            method: 'POST',
            body: { accion: 'ALTA', tipo: 'CORREO_OTP', correo: correo },
          });
          $('#medio-aviso').textContent = result.aviso || '';
          $('#medio_correo').value = '';
          await cargarMedios();
        } catch (err) {
          showFormError('medios-error', err.message || 'No se pudo agregar el medio.');
        } finally {
          clearButtonBusy(btnAdd);
        }
      });
    }

    const btnVolver = $('#btn-medios-volver');
    if (btnVolver) {
      btnVolver.addEventListener('click', () => showScreen('otp'));
    }
  }

  // Los tipos de medio, en palabras del Trabajador (no los nombres internos).
  var _MEDIO_LABEL = {
    EMAIL_HOJA_VIDA: 'El correo de tu hoja de vida',
    CORREO_OTP: 'Tu correo personal para el c\u00f3digo',
    LINK_KAIR: 'El enlace de firma de K+AIR',
  };

  async function cargarMedios() {
    const cont = $('#medios-lista');
    if (!cont) return;
    try {
      const result = await apiFetch('/api/sign/' + state.token + '/medios');
      const aviso = $('#medio-aviso');
      if (aviso && !aviso.textContent) aviso.textContent = result.aviso || '';
      if (!result.medios || result.medios.length === 0) {
        cont.innerHTML = '<p class="form-hint">Todav\u00eda no ten\u00e9s ning\u00fan medio autorizado.</p>';
        return;
      }
      let html = '<ul class="medios-list">';
      for (const m of result.medios) {
        const estado = m.estado === 'ACTIVO'
          ? 'activo'
          : (m.estado === 'PENDIENTE' ? 'pendiente' : 'retirado');
        html += '<li class="medios-list__item medios-list__item--' + estado + '">'
          + '<span class="medios-list__valor">'
          + escHtml(m.valor || (_MEDIO_LABEL[m.tipo] || m.tipo)) + '</span>'
          + '<span class="medios-list__tipo">'
          + escHtml(_MEDIO_LABEL[m.tipo] || m.tipo) + '</span>'
          + '<span class="medios-list__estado">' + escHtml(estado) + '</span>';
        if (m.estado !== 'BAJA' && m.tipo === 'CORREO_OTP') {
          html += '<button type="button" class="btn-link medios-list__quitar" '
            + 'data-retirar="' + escHtml(m.valor) + '">Retirar</button>';
        }
        html += '</li>';
      }
      html += '</ul>';
      cont.innerHTML = html;

      const botones = cont.querySelectorAll('[data-retirar]');
      for (const b of botones) {
        b.addEventListener('click', async () => {
          const correo = b.getAttribute('data-retirar');
          try {
            await apiFetch('/api/sign/' + state.token + '/medios', {
              method: 'POST',
              body: { accion: 'BAJA', tipo: 'CORREO_OTP', correo: correo },
            });
            await cargarMedios();
          } catch (err) {
            showFormError('medios-error', err.message || 'No se pudo retirar el medio.');
          }
        });
      }
    } catch (err) {
      cont.innerHTML = '<p class="form-hint">No se pudieron cargar tus medios.</p>';
    }
  }

  // ============================================================
  // Inicialización (DOMContentLoaded)
  // ============================================================

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
  } else {
    startApp();
  }

  function startApp() {
    setupIdentifyForm();
    setupOtpForm();
    setupMediosScreen();    // 9A: los medios autorizados (el 8.2)
    setupVerifyScreen();  // I-VERIFICACION-PUBLICA
    init();
  }
})();
