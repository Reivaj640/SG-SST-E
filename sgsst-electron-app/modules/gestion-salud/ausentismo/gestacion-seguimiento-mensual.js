/* ═══════════════════════════════════════════════════════════════════
   K+AIR · Seguimiento Mensual de Gestación — Vista de formulario
   v02 · 📦466 (2026-07-03) — Persistencia real vía IPC
   - Carga gestante + historial desde SQLite (window.electronAPI.gestacion*)
   - Renderiza campos readonly desde datos reales
   - Guarda seguimiento con validación mínima vía IPC (upsert por periodo)
   - Refresh automático del historial tras guardar
   - Sync-badge y toasts manejados igual que la vista principal
   ═══════════════════════════════════════════════════════════════════ */

(function () {
    'use strict';

    // ─── Estado privado ───
    var _state = {
        empresaId: null,
        gestanteId: null,
        gestante: null,
        seguimientosAnteriores: [],
        periodoActual: _periodoActual(),
        loading: false,
        saving: false,
        error: null
    };

    // ─── Helpers ───
    function _esc(s) {
        if (s == null) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function _initials(nombre) {
        if (!nombre) return '?';
        var parts = nombre.split(' ');
        return ((parts[0] ? parts[0][0] : '') + (parts[1] ? parts[1][0] : '')).toUpperCase();
    }

    function _fmtDate(iso) {
        if (!iso) return '—';
        try {
            var d = new Date(iso + 'T00:00:00');
            return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
        } catch (e) { return iso; }
    }

    function _periodoActual() {
        var d = new Date();
        var y = d.getFullYear();
        var m = String(d.getMonth() + 1).padStart(2, '0');
        return y + '-' + m;
    }

    function _badgeRiesgo(c) {
        var map = {
            'bajo':     '<span class="gsm-chip bajo"><i class="fas fa-leaf"></i> Bajo riesgo</span>',
            'alto':     '<span class="gsm-chip alto"><i class="fas fa-exclamation-triangle"></i> Alto riesgo</span>',
            'muy-alto': '<span class="gsm-chip muy-alto"><i class="fas fa-radiation"></i> Muy alto</span>'
        };
        return map[c] || '<span class="gsm-chip">' + _esc(c) + '</span>';
    }

    function _mostrarToast(tipo, titulo, mensaje) {
        var notifier = (window.parent && window.parent.updateNotifier) || window.updateNotifier;
        if (notifier && typeof notifier.show === 'function') {
            notifier.show({ type: tipo, title: titulo, subtitle: mensaje, autoClose: 4000 });
        }
    }

    /**
     * 📦466 — Sincronizado visualmente con el patrón del home (6.1.3).
     * states: 'loading' | 'borrador' | 'saving' | 'synced' | 'error'
     */
    function _setSyncBadge(state) {
        var badge = document.querySelector('.k-sync-badge');
        if (!badge) return;
        badge.classList.remove('k-sync-synced', 'k-sync-saving', 'k-sync-error');
        if (state === 'saving' || state === 'loading') {
            badge.classList.add('k-sync-saving');
            badge.innerHTML = '<i class="bi bi-arrow-clockwise"></i> ' +
                (state === 'loading' ? 'Cargando…' : 'Guardando…');
        } else if (state === 'error') {
            badge.classList.add('k-sync-error');
            badge.innerHTML = '<i class="bi bi-exclamation-triangle"></i> Error';
        } else if (state === 'synced') {
            badge.classList.add('k-sync-synced');
            badge.innerHTML = '<i class="bi bi-check-circle-fill"></i> Sincronizado';
        } else {
            // 'borrador' (default inicial)
            badge.classList.add('k-sync-synced');
            badge.innerHTML = '<i class="bi bi-check-circle-fill"></i> Borrador';
        }
    }

    /**
     * 📦466 — Habilita/deshabilita los inputs del formulario y los botones
     * de acción. Previene guardar antes de tener la gestante cargada.
     */
    function _setFormEnabled(enabled) {
        var form = document.getElementById('formSeguimiento');
        if (form) {
            var inputs = form.querySelectorAll('input, select, textarea, button');
            for (var i = 0; i < inputs.length; i++) {
                // No deshabilitar los readonly (vienen de la gestante)
                if (inputs[i].readOnly) continue;
                inputs[i].disabled = !enabled;
            }
        }
        var btnSave = document.getElementById('kair-gsm-cta-save');
        if (btnSave) btnSave.disabled = !enabled;
    }

    // ─── Lectura del gestanteId (URL → postMessage) ───
    function _obtenerGestanteIdInicial() {
        var id = null;
        try {
            var params = new URLSearchParams(window.location.search);
            id = params.get('id');
        } catch (e) {}
        if (!id && window._GESTANTE_ID_) {
            id = window._GESTANTE_ID_;
        }
        _state.gestanteId = id;
    }

    // ─── Carga de datos desde SQLite ───
    async function _cargarDatos() {
        if (!_state.empresaId) {
            _renderInfoGestanteError('Sin contexto de empresa. Vuelva al listado principal.');
            return;
        }
        if (!_state.gestanteId) {
            _renderInfoGestanteError('No se ha seleccionado una gestante.');
            return;
        }

        _state.loading = true;
        _setSyncBadge('loading');
        _renderInfoGestanteLoading();
        _renderHistorialLoading();
        _setFormEnabled(false);

        try {
            var resG = await window.electronAPI.gestacionObtenerGestante({
                empresaId: _state.empresaId,
                gestanteId: _state.gestanteId
            });
            if (!resG || !resG.success) {
                _state.error = (resG && resG.error && resG.error.message) || 'Gestante no encontrada';
                _setSyncBadge('error');
                _renderInfoGestanteError(_state.error);
                _renderHistorialVacio();
                _setFormEnabled(false);
                _mostrarToast('error', 'No se pudo cargar la gestante', _state.error);
                return;
            }
            _state.gestante = resG.data;
            _state.error = null;

            var resS = await window.electronAPI.gestacionObtenerSeguimientos({
                empresaId: _state.empresaId,
                gestanteId: _state.gestanteId
            });
            if (resS && resS.success) {
                _state.seguimientosAnteriores = resS.data || [];
            } else {
                // No bloqueante: la gestante sí cargó
                _state.seguimientosAnteriores = [];
                console.warn('[GESTACION-MENSUAL] No se pudo cargar historial:', resS && resS.error);
            }

            _setSyncBadge('borrador');
            _renderInfoGestante();
            _renderHistorial();
            _setFormEnabled(true);
        } catch (e) {
            _state.error = e.message;
            _setSyncBadge('error');
            _renderInfoGestanteError(_state.error);
            _renderHistorialVacio();
            _setFormEnabled(false);
            _mostrarToast('error', 'Error de conexión', _state.error);
        } finally {
            _state.loading = false;
        }
    }

    // ─── Render Info Gestante ───
    function _renderInfoGestanteLoading() {
        document.getElementById('infoGestante').innerHTML =
            '<div style="display:flex;align-items:center;gap:14px;width:100%;">' +
                '<div class="gsm-info-card__avatar" style="opacity:0.4;">…</div>' +
                '<div style="flex:1;">' +
                    '<div style="font-weight:600;color:var(--text-muted);">Cargando gestante desde SQLite…</div>' +
                    '<div style="font-size:0.78rem;color:var(--text-muted);margin-top:4px;">' +
                        '<i class="bi bi-arrow-clockwise" style="animation:spin 1s linear infinite;"></i> ' +
                        'Por favor espere' +
                    '</div>' +
                '</div>' +
            '</div>';
    }

    function _renderInfoGestanteError(msg) {
        document.getElementById('infoGestante').innerHTML =
            '<div class="gsm-info-card" style="border-left-color: var(--v3-destructive);">' +
                '<div class="gsm-info-card__avatar" style="background: var(--v3-destructive-soft); color: var(--v3-destructive);">!</div>' +
                '<div>' +
                    '<div class="gsm-info-card__name">No se pudo cargar la gestante</div>' +
                    '<div class="gsm-info-card__meta">' + _esc(msg) + '</div>' +
                '</div>' +
            '</div>';
    }

    function _renderInfoGestante() {
        var g = _state.gestante;
        if (!g) {
            _renderInfoGestanteError('Gestante sin datos');
            return;
        }

        var html =
            '<div class="gsm-info-card__avatar">' + _esc(_initials(g.nombre)) + '</div>' +
            '<div>' +
                '<div class="gsm-info-card__name">' + _esc(g.nombre) + '</div>' +
                '<div class="gsm-info-card__meta">' +
                    '<i class="bi bi-credit-card-2-front"></i> ' + _esc(g.cedula) + ' · ' + _esc(g.cargo || '') + ' · ' + _esc(g.empresa || '') +
                    ' · <b style="color:var(--rosa);">' + (g.semanasGestacion || 0) + ' semanas</b>' +
                    ' · FPP: ' + _fmtDate(g.fpp) +
                '</div>' +
            '</div>' +
            '<div class="gsm-info-card__chips">' +
                _badgeRiesgo(g.clasificacion) +
                '<span class="gsm-chip rosa"><i class="fas fa-calendar"></i> ' + _esc(_state.periodoActual) + '</span>' +
            '</div>';

        document.getElementById('infoGestante').innerHTML = html;

        // Llenar campos readonly
        document.getElementById('fCargo').value = g.cargo || '';
        document.getElementById('fEmpresa').value = g.empresa || '';
        document.getElementById('fSemanas').value = g.semanasGestacion || '';
        document.getElementById('fFPP').value = g.fpp || '';

        // Pre-marcar la clasificación actual
        var radioClasif = document.querySelector('input[name="clasificacion"][value="' + g.clasificacion + '"]');
        if (radioClasif) radioClasif.checked = true;
    }

    // ─── Render Historial ───
    function _renderHistorialLoading() {
        document.getElementById('historialList').innerHTML =
            '<div class="gsm-history-item">' +
                '<div class="gsm-history-item__body" style="text-align:center;color:var(--text-muted);padding:20px 0;">' +
                    '<i class="bi bi-arrow-clockwise" style="font-size:1.5rem;display:block;margin-bottom:8px;animation:spin 1s linear infinite;"></i>' +
                    'Cargando historial…' +
                '</div>' +
            '</div>';
    }

    function _renderHistorialVacio() {
        document.getElementById('historialList').innerHTML =
            '<div class="gsm-history-item">' +
                '<div class="gsm-history-item__body" style="text-align:center;color:var(--text-muted);padding:20px 0;">' +
                    '<i class="fas fa-inbox" style="font-size:2rem;display:block;margin-bottom:8px;color:#d1d5db;"></i>' +
                    'Sin seguimientos anteriores registrados.' +
                '</div>' +
            '</div>';
    }

    function _renderHistorial() {
        var list = document.getElementById('historialList');
        var items = _state.seguimientosAnteriores;

        if (!items || items.length === 0) {
            _renderHistorialVacio();
            return;
        }

        var html = '';
        for (var i = 0; i < items.length; i++) {
            var s = items[i];
            html +=
                '<div class="gsm-history-item">' +
                    '<div>' +
                        '<div class="gsm-history-item__date">' + _fmtDate(s.fecha) + '</div>' +
                        '<div class="gsm-history-item__meta">' + _esc(s.periodo) + ' · ' + (s.semanas || 0) + ' sem</div>' +
                    '</div>' +
                    '<div class="gsm-history-item__body">' +
                        '<div class="gsm-history-item__text">' + _esc(s.observaciones || '—') + '</div>' +
                    '</div>' +
                    '<div>' + _badgeRiesgo(s.clasificacion) + '</div>' +
                '</div>';
        }

        list.innerHTML = html;
    }

    // ─── Comportamiento condicional del formulario ───
    function _bindFormBehavior() {
        // Mostrar/ocultar descripción de molestia según selección
        var radiosMolestia = document.querySelectorAll('input[name="molestia"]');
        for (var i = 0; i < radiosMolestia.length; i++) {
            radiosMolestia[i].addEventListener('change', function () {
                var field = document.getElementById('descMolestiaField');
                field.style.display = (this.value === 'si' && this.checked) ? 'flex' : 'none';
            });
        }
    }

    // ─── API pública: Guardar seguimiento vía IPC ───
    window.guardarSeguimiento = async function () {
        var g = _state.gestante;
        if (!g) {
            _mostrarToast('error', 'Error', 'No se ha cargado la gestante.');
            return;
        }
        if (_state.saving || _state.loading) {
            _mostrarToast('warning', 'Espere', 'Hay otra operación en curso.');
            return;
        }

        // Recolectar datos del formulario (mínimos, sin diagnósticos)
        var datos = {
            gestacionId: g.id,
            periodo: _state.periodoActual,
            fecha: new Date().toISOString().slice(0, 10),
            semanas: g.semanasGestacion || 0,
            clasificacion: _getRadio('clasificacion'),
            ctrlAsistio: _getRadio('ctrlAsistio'),
            permisos: parseInt(document.getElementById('fPermisos').value || '0', 10),
            proximaCita: document.getElementById('fProximaCita').value || null,
            molestia: _getRadio('molestia'),
            descMolestia: document.getElementById('fDescMolestia').value.trim() || null,
            incapacitada: _getRadio('incapacitada'),
            diasIncapacidad: parseInt(document.getElementById('fDiasIncapacidad').value || '0', 10),
            origenIncapacidad: _getRadio('origenIncapacidad'),
            restricciones: _getRadio('restricciones'),
            descRestricciones: document.getElementById('fDescRestricciones').value.trim() || null,
            emocional: _getRadio('emocional'),
            compatible: _getRadio('compatible'),
            ajustes: _getRadio('ajustes'),
            observaciones: document.getElementById('fObservaciones').value.trim() || null,
            acciones: _getCheckboxes('accion'),
            reportadoPor: '' // Se podría poblar con el usuario actual si se desea
        };

        // Validación mínima
        if (!datos.clasificacion) {
            _mostrarToast('warning', 'Datos incompletos', 'Selecciona la clasificación del riesgo.');
            return;
        }
        if (!datos.ctrlAsistio) {
            _mostrarToast('warning', 'Datos incompletos', 'Indica si asistió a los controles prenatales.');
            return;
        }

        _state.saving = true;
        _setSyncBadge('saving');
        try {
            var res = await window.electronAPI.gestacionGuardarSeguimiento({
                empresaId: _state.empresaId,
                data: datos
            });
            if (res && res.success) {
                _setSyncBadge('synced');
                _mostrarToast('success', 'Seguimiento guardado',
                    'F-PT-014-04 del periodo ' + _state.periodoActual + ' registrado correctamente.');

                // Refrescar historial para incluir el nuevo registro (sin recargar la página)
                try {
                    var resS = await window.electronAPI.gestacionObtenerSeguimientos({
                        empresaId: _state.empresaId,
                        gestanteId: _state.gestanteId
                    });
                    if (resS && resS.success) {
                        _state.seguimientosAnteriores = resS.data || [];
                        _renderHistorial();
                    }
                } catch (e) {
                    console.warn('[GESTACION-MENSUAL] No se pudo refrescar historial:', e.message);
                }
            } else {
                _setSyncBadge('error');
                var msg = (res && res.error && res.error.message) || 'Error desconocido';
                if (res && res.error && res.error.code === 'NOT_FOUND') {
                    _mostrarToast('error', 'Gestante no encontrada', 'Recargue la vista e intente de nuevo.');
                } else {
                    _mostrarToast('error', 'Error al guardar', msg);
                }
            }
        } catch (e) {
            _setSyncBadge('error');
            _mostrarToast('error', 'Error de conexión', e.message);
        } finally {
            _state.saving = false;
        }
    };

    window.volverAlListado = function () {
        if (window.parent && window.parent.postMessage) {
            window.parent.postMessage({
                type: 'ausentismo-home-action',
                action: 'seguimiento-gestacion'
            }, '*');
        }
    };

    // ─── Helpers de formulario ───
    function _getRadio(name) {
        var els = document.querySelectorAll('input[name="' + name + '"]:checked');
        return els.length > 0 ? els[0].value : null;
    }

    function _getCheckboxes(name) {
        var els = document.querySelectorAll('input[name="' + name + '"]:checked');
        var values = [];
        for (var i = 0; i < els.length; i++) values.push(els[i].value);
        return values;
    }

    /**
     * 📦463 — Bindea los handlers de los botones del header estándar
     * (volver al listado, guardar seguimiento).
     */
    function _bindHeader() {
        var btnBack = document.getElementById('kair-gsm-back');
        if (btnBack) btnBack.addEventListener('click', window.volverAlListado);

        var btnSave = document.getElementById('kair-gsm-cta-save');
        if (btnSave) btnSave.addEventListener('click', window.guardarSeguimiento);
    }

    /**
     * 📦466 — Aplica el contexto de empresa recibido vía postMessage.
     * El orquestador envía { company, gestanteId } cuando crea el iframe
     * (ver renderSeguimientoMensualView en medicion-ausentismo.js).
     */
    function _applyCompanyContext() {
        window.addEventListener('message', function (event) {
            var data = event.data;
            if (!data || data.type !== 'SET_COMPANY_CONTEXT') return;

            if (data.company) {
                _state.empresaId = data.company;
                var bcEl = document.getElementById('kair-gsm-bc-company');
                if (bcEl) bcEl.textContent = data.company;
            }
            // El orquestador también envía el gestanteId por postMessage
            // (redundante con la URL ?id=, pero útil si la URL no llegó)
            if (data.gestanteId) {
                _state.gestanteId = data.gestanteId;
            }

            // Solo cargar cuando tengamos empresa Y gestante
            if (_state.empresaId && _state.gestanteId) {
                _cargarDatos();
            }
        });
    }

    // ─── Init ───
    document.addEventListener('DOMContentLoaded', function () {
        console.log('[GESTACION-MENSUAL] Inicializando formulario de seguimiento (IPC)...');
        _obtenerGestanteIdInicial();
        _bindHeader();
        _bindFormBehavior();
        _applyCompanyContext();

        // Loading inicial (se sobreescribe cuando llegue SET_COMPANY_CONTEXT)
        if (!_state.empresaId || !_state.gestanteId) {
            _renderInfoGestanteLoading();
            _renderHistorialLoading();
            _setFormEnabled(false);
        }
    });

})();
