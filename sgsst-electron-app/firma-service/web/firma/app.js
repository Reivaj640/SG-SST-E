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

  function showError(message) {
    const box = $('#error-message');
    if (box) box.textContent = message;
    showScreen('error');
  }

  function showFormError(formId, message) {
    const box = $('#' + formId);
    if (!box) return;
    box.textContent = message;
    box.hidden = false;
  }

  function hideFormError(formId) {
    const box = $('#' + formId);
    if (!box) return;
    box.hidden = true;
    box.textContent = '';
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
  };

  // ============================================================
  // 1. Inicialización: extraer token y cargar contexto
  // ============================================================

  async function init() {
    const token = getTokenFromPath();
    if (!token) {
      return showError('El enlace que usaste no es válido.');
    }
    state.token = token;
    showScreen('loading');

    try {
      const contexto = await apiFetch('/s/' + token);
      state.contexto = contexto;

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
        return showScreen('signed');
      }
      if (estado === 'DUAL_FIRMADO') {
        // I-FIRMA-DUAL · diferenciar visualmente el caso de firma dual
        // (trabajador + representante legal) del caso de firma simple.
        setSignedMessageVariant('dual');
        return showScreen('signed');
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
      if (err.status === 404) {
        return showError('El enlace que usaste no es válido o ya no existe.');
      }
      if (err.status === 410) {
        const msg = err.code === 'TOKEN_EXPIRED'
          ? 'Este enlace ha expirado. Solicita uno nuevo a tu empleador.'
          : 'Este enlace ya fue utilizado.';
        return showError(msg);
      }
      return showError(err.message || 'No se pudo cargar la solicitud.');
    }
  }

  // ============================================================
  // 2. Pantalla: Identificación
  // ============================================================

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
        const result = await apiFetch('/api/sign/' + state.token + '/identify', {
          method: 'POST',
          body: { tipo_identificacion: tipo_identificacion, numero_documento: numero_documento },
        });
        state.correoEnmascarado = result.correo_destino_enmascarado;
        $('#correo-enmascarado').textContent = result.correo_destino_enmascarado;
        showScreen('otp');
      } catch (err) {
        if (err.status === 422 && err.code === 'IDENTIFICATION_FAILED') {
          showFormError('identify-error', 'La identificación no coincide con nuestros registros. Verifica e intenta de nuevo.');
        } else if (err.status === 422 && err.code === 'MISSING_IDENTIFICATION_DATA') {
          showFormError('identify-error', 'No tenemos registrada tu identificación para esta solicitud. Contacta a tu empleador.');
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
  }

  // ============================================================
  // 4. Pantalla: Documento (PDF + manifestación)
  // ============================================================

  function setupDocumentScreen() {

    const pdfViewer = $('#pdf-viewer');
    const pdfDownloadLink = $('#pdf-download-link');
    const pdfUrl = '/api/sign/' + state.token + '/document.pdf';


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

    // Cargar PDF en el visor (ahora el listener ya está listo y la función
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

    // Habilitar botón FIRMAR solo cuando ambos checkboxes estén marcados
    const check1 = $('#manifestacion_leido');
    const check2 = $('#manifestacion_voluntad');
    const check3 = $('#consentimiento_aceptado');   // Bloque E6.5: 3ª casilla
    const btnCommit = $('#btn-commit');
    const btnReject = $('#btn-reject');


    const updateCommitButton = function () {
      const c1 = check1 && check1.checked;
      const c2 = check2 && check2.checked;
      // check3 es solo el trigger visual: el botón depende del estado
      // de aceptación en backend (state.consentAccepted), no del .checked.
      // Esto evita que un click rápido sin esperar el POST habilite el botón.
      const c3Accepted = state.consentAccepted === true;
      // PDF debe haber sido visto (view-document exitoso).
      const pdfOk = state.pdfViewed === true;
      const newDisabled = !(c1 && c2 && c3Accepted && pdfOk);
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
              msg = 'Esta solicitud no requiere aceptación de Acuerdo. Contacta a tu empleador.';
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

    check1.addEventListener('input', () => {
    });
    check2.addEventListener('input', () => {
    });
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

  // ============================================================
  // 5. Pantalla: Firmado
  // ============================================================

  function showSignedScreen(result) {
    showScreen('signed');
    // El endpoint /internal/sign-requests/:id/constancia requiere API key.
    // El trabajador recibe la Constancia por correo, así que en la mini-app
    // ocultamos el botón "VER CONSTANCIA" y mostramos el mensaje informativo.
    const link = $('#constancia-link');
    if (link) link.style.display = 'none';
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
        showVerifyError('No se pudo cargar la información de verificación: ' + (err.message || 'Error desconocido'));
      });
  }

  function renderVerifyContext(ctx) {
    // Status badge
    var statusEl = $('#verify-status');
    if (statusEl) {
      var isSigned = (ctx.estado === 'SIGNED' || ctx.estado === 'DUAL_FIRMADO');
      statusEl.className = 'alert ' + (isSigned ? 'alert-success' : 'alert-info');
      statusEl.innerHTML = isSigned
        ? '<h3>✅ Firma verificada — documento íntegro</h3>'
        : '<h3>⏳ Documento aún no firmado</h3><p>Estado actual: ' + escHtml(ctx.estado) + '</p>';
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

    // Botón "Volver" → regresa a screen-signed
    var btnBack = $('#btn-back-to-signed');
    if (btnBack) {
      btnBack.addEventListener('click', function () { showScreen('signed'); });
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
    setupVerifyScreen();  // I-VERIFICACION-PUBLICA
    init();
  }
})();
