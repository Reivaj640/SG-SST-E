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
      //   REJECTED
      //     → screen-rejected
      //   EXPIRED / REVOKED / CANCELLED / OTP_LOCKED
      //     → showError con mensaje específico
      const estado = contexto && contexto.estado;

      if (estado === 'SIGNED') return showScreen('signed');
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
    init();
  }
})();
