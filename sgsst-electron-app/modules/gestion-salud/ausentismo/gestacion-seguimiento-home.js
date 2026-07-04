/* ═══════════════════════════════════════════════════════════════════
   K+AIR · Seguimiento de Gestación — Vista principal
   v02 · 📦466 (2026-07-03) — Persistencia real vía IPC
   - Datos desde window.electronAPI.gestacion* (SQLite central)
   - Modal propio para "Registrar nueva gestante"
   - Loading / error states manejados
   ═══════════════════════════════════════════════════════════════════ */

(function () {
    'use strict';

    // ─── Estado privado ───
    var _state = {
        empresaId: null,
        gestantes: [],
        stats: { total: 0, activas: 0, enLicencia: 0, altoRiesgo: 0, proxLicencia: 0, cerradas: 0 },
        loading: false,
        error: null,
        filtros: { estado: 'todas', riesgo: null, busqueda: '' }
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

    function _fmtDate(iso) {
        if (!iso) return '—';
        try {
            var d = new Date(iso + 'T00:00:00');
            return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
        } catch (e) { return iso; }
    }

    function _initials(nombre) {
        if (!nombre) return '?';
        var parts = nombre.split(' ');
        return ((parts[0] ? parts[0][0] : '') + (parts[1] ? parts[1][0] : '')).toUpperCase();
    }

    function _badgeEstado(estado) {
        var map = {
            'activo':   '<span class="gs-badge activo"><i class="fas fa-circle" style="font-size:0.55rem;"></i> Activa</span>',
            'licencia': '<span class="gs-badge licencia"><i class="fas fa-umbrella-beach"></i> Licencia</span>',
            'cerrado':  '<span class="gs-badge cerrado"><i class="fas fa-check-circle"></i> Cerrado</span>'
        };
        return map[estado] || '<span class="gs-badge">' + _esc(estado) + '</span>';
    }

    function _badgeRiesgo(c) {
        var map = {
            'bajo':     '<span class="gs-badge bajo"><i class="fas fa-leaf"></i> Bajo riesgo</span>',
            'alto':     '<span class="gs-badge alto"><i class="fas fa-exclamation-triangle"></i> Alto riesgo</span>',
            'muy-alto': '<span class="gs-badge muy-alto"><i class="fas fa-radiation"></i> Muy alto riesgo</span>'
        };
        return map[c] || '<span class="gs-badge">' + _esc(c) + '</span>';
    }

    /**
     * 📦468 (2026-07-04) — Res. 0312/2019 art. 14 · Periodicidad por clasificación.
     * Replica el mismo patrón de gestacion-antesala.js:_frecuenciaPorRiesgo().
     * Devuelve la fecha (YYYY-MM-DD) en que se debe hacer el próximo seguimiento,
     * partiendo del último seguimiento si existe (o fechaNotificacion si no).
     * Retorna null si la gestante no requiere próximo seguimiento (cerrada o en licencia).
     * Marcamos `vencido: true` si la fecha calculada es anterior a hoy.
     */
    function _calcularProximoSeguimiento(g) {
        if (!g || g.estado === 'cerrado' || g.estado === 'licencia') return null;

        // Periodicidad (en días) según clasificación
        var diasPaso = 30;
        if (g.clasificacion === 'alto') diasPaso = 15;       // quincenal
        if (g.clasificacion === 'muy-alto') diasPaso = 7;    // semanal

        var baseIso = g.ultimoSeguimiento || g.fechaNotificacion;
        if (!baseIso) return null;

        var base = new Date(baseIso + 'T00:00:00');
        if (isNaN(base.getTime())) return null;
        var proximo = new Date(base.getTime() + diasPaso * 24 * 60 * 60 * 1000);

        var hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        return {
            fecha: proximo.toISOString().slice(0, 10),
            vencido: proximo < hoy
        };
    }

    function _setSyncBadge(state) {
        var badge = document.querySelector('.k-sync-badge');
        if (!badge) return;
        badge.classList.remove('k-sync-synced', 'k-sync-saving', 'k-sync-error');
        if (state === 'saving') {
            badge.classList.add('k-sync-saving');
            badge.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Guardando…';
        } else if (state === 'error') {
            badge.classList.add('k-sync-error');
            badge.innerHTML = '<i class="bi bi-exclamation-triangle"></i> Error';
        } else {
            badge.classList.add('k-sync-synced');
            badge.innerHTML = '<i class="bi bi-check-circle-fill"></i> Sincronizado';
        }
    }

    function _mostrarToast(tipo, titulo, mensaje) {
        var notifier = (window.parent && window.parent.updateNotifier) || window.updateNotifier;
        if (notifier && typeof notifier.show === 'function') {
            notifier.show({ type: tipo, title: titulo, subtitle: mensaje, autoClose: 4000 });
        }
    }

    /**
     * 📦467 (2026-07-04) — Helper local de confirmación.
     * Antes usábamos `window.KAIRUtils.showConfirm(...)`, pero KAIRUtils solo
     * está cargado en el submódulo de Evaluación y Selección (otro módulo).
     * Este helper replica el patrón modal genérico (overlay + 2 botones) y
     * mantiene la vista autocontenida (no depende de otros submódulos).
     * @param {string} message Texto a mostrar al usuario.
     * @returns {Promise<boolean>} true si confirma, false si cancela.
     */
    function _showConfirm(message) {
        return new Promise(function (resolve) {
            var overlay = document.createElement('div');
            overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10000;';
            overlay.innerHTML =
                '<div style="background:#fff;padding:24px;border-radius:8px;max-width:440px;width:90%;text-align:center;box-shadow:0 8px 24px rgba(0,0,0,0.2);">' +
                    '<div style="margin-bottom:20px;font-size:15px;color:#212529;line-height:1.5;white-space:pre-wrap;">' +
                        message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') +
                    '</div>' +
                    '<div style="display:flex;gap:10px;justify-content:center;">' +
                        '<button class="gs-confirm-cancel" style="padding:8px 20px;border:1px solid #dee2e6;background:#f8f9fa;border-radius:4px;cursor:pointer;font:inherit;">Cancelar</button>' +
                        '<button class="gs-confirm-ok" style="padding:8px 20px;border:none;background:#dc3545;color:#fff;border-radius:4px;cursor:pointer;font:inherit;">Confirmar</button>' +
                    '</div>' +
                '</div>';

            overlay.querySelector('.gs-confirm-cancel').addEventListener('click', function () { overlay.remove(); resolve(false); });
            overlay.querySelector('.gs-confirm-ok').addEventListener('click', function () { overlay.remove(); resolve(true); });
            overlay.addEventListener('click', function (e) {
                if (e.target === overlay) { overlay.remove(); resolve(false); }
            });

            document.body.appendChild(overlay);
        });
    }

    // ─── Carga de datos desde SQLite ───
    async function _cargarDatos() {
        _state.loading = true;
        _setSyncBadge('saving');
        _renderKpisLoading();
        _renderTablaLoading();

        try {
            var res = await window.electronAPI.gestacionCargarTodo({ empresaId: _state.empresaId });
            if (res && res.success) {
                _state.gestantes = (res.data && res.data.gestantes) || [];
                _state.stats = (res.data && res.data.stats) || _state.stats;
                _state.error = null;
            } else {
                _state.error = (res && res.error && res.error.message) || 'Error desconocido';
                _mostrarToast('error', 'Error al cargar datos', _state.error);
            }
        } catch (e) {
            _state.error = e.message;
            _mostrarToast('error', 'Error de conexión', e.message);
        } finally {
            _state.loading = false;
            _setSyncBadge(_state.error ? 'error' : 'synced');
            _renderKpis(_state.stats);
            _renderFiltrosContadores();
            _aplicarFiltros();
        }
    }

    // ─── Render KPIs ───
    function _renderKpisLoading() {
        document.getElementById('kpisContainer').innerHTML =
            '<div class="kair-v3-kpi-strip">' +
                '<div class="kair-v3-kpi kair-v3-kpi--primary" style="grid-column: 1 / -1; justify-content: center; padding: 2rem;">' +
                    '<div class="kair-v3-kpi__content" style="text-align:center;">' +
                        '<i class="bi bi-arrow-clockwise" style="font-size:1.5rem;animation:spin 1s linear infinite;"></i>' +
                        '<div style="margin-top:8px;color:var(--v3-muted-foreground);">Cargando datos desde SQLite…</div>' +
                    '</div>' +
                '</div>' +
            '</div>';
    }

    function _renderKpis(stats) {
        var s = stats || _state.stats;
        var svgCheck = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
        var svgWarn = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
        var svgCal = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
        var svgUmbrella = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 0-18 0"/><line x1="12" y1="2" x2="12" y2="12"/><path d="M12 12l4 4"/></svg>';

        var kpis = [
            { value: String(s.activas || 0), label: 'Gestantes activas', icon: 'bi-person-hearts', color: 'primary',
              sub: s.activas > 0 ? svgCheck + ' Embarazadas en seguimiento' : 'Sin gestantes activas',
              subClass: s.activas > 0 ? 'kair-v3-kpi__sub--success' : '' },
            { value: String(s.altoRiesgo || 0), label: 'Alto / Muy alto riesgo', icon: 'bi-exclamation-triangle', color: 'warning',
              sub: s.altoRiesgo > 0 ? svgWarn + ' Requieren seguimiento reforzado' : svgCheck + ' Sin casos críticos',
              subClass: s.altoRiesgo > 0 ? 'kair-v3-kpi__sub--warning' : 'kair-v3-kpi__sub--success' },
            { value: String(s.proxLicencia || 0), label: 'Próximas a licencia', icon: 'bi-calendar-check', color: 'info',
              sub: svgCal + ' FPP dentro de 60 días', subClass: '' },
            { value: String(s.enLicencia || 0), label: 'En licencia de maternidad', icon: 'bi-umbrella', color: 'success',
              sub: svgUmbrella + ' Art. 236 CST · Ley 1822/2017', subClass: 'kair-v3-kpi__sub--success' },
            { value: String(s.cerradas || 0), label: 'Casos cerrados', icon: 'bi-check2-circle', color: 'success',
              sub: s.cerradas > 0 ? svgCheck + ' Reintegro efectivo' : 'Sin cierres aún',
              subClass: s.cerradas > 0 ? 'kair-v3-kpi__sub--success' : '' }
        ];

        var html = kpis.map(function (kpi) {
            return '<div class="kair-v3-kpi kair-v3-kpi--' + kpi.color + '">' +
                '<div class="kair-v3-kpi__icon kair-v3-kpi__icon--' + kpi.color + '">' +
                    '<i class="bi ' + kpi.icon + '" style="font-size:1.125rem"></i>' +
                '</div>' +
                '<div class="kair-v3-kpi__content">' +
                    '<div class="kair-v3-kpi__value">' + _esc(kpi.value) + '</div>' +
                    '<div class="kair-v3-kpi__label">' + _esc(kpi.label) + '</div>' +
                    '<div class="kair-v3-kpi__sub ' + (kpi.subClass || '') + '">' + kpi.sub + '</div>' +
                '</div>' +
            '</div>';
        }).join('');

        document.getElementById('kpisContainer').innerHTML = html;
    }

    function _renderFiltrosContadores() {
        var g = _state.gestantes;
        document.getElementById('cntTodas').textContent = g.length;
        document.getElementById('cntActivas').textContent = g.filter(function (x) { return x.estado === 'activo'; }).length;
        document.getElementById('cntLicencia').textContent = g.filter(function (x) { return x.estado === 'licencia'; }).length;
        document.getElementById('cntCerradas').textContent = g.filter(function (x) { return x.estado === 'cerrado'; }).length;
        document.getElementById('cntAltoRiesgo').textContent = g.filter(function (x) {
            return (x.clasificacion === 'alto' || x.clasificacion === 'muy-alto') &&
                   (x.estado === 'activo' || x.estado === 'licencia');
        }).length;
    }

    // ─── Render tabla ───
    function _renderTablaLoading() {
        document.getElementById('tablaGestantes').innerHTML =
            '<tr><td colspan="10">' +
                '<div class="gs-empty"><div class="gs-empty__icon"><i class="bi bi-arrow-clockwise"></i></div>' +
                '<div class="gs-empty__title">Cargando gestantes…</div></div>' +
            '</td></tr>';
        document.getElementById('resultadosCount').textContent = '…';
    }

    function _renderTabla(gestantes) {
        if (!gestantes || gestantes.length === 0) {
            document.getElementById('tablaGestantes').innerHTML =
                '<tr><td colspan="10">' +
                    '<div class="gs-empty">' +
                        '<div class="gs-empty__icon"><i class="bi bi-person-plus"></i></div>' +
                        '<div class="gs-empty__title">No hay gestantes registradas</div>' +
                        '<div class="gs-empty__desc">Click en <strong>"Registrar Gestante"</strong> para crear el primer caso.</div>' +
                    '</div>' +
                '</td></tr>';
            document.getElementById('resultadosCount').textContent = '0';
            return;
        }

        var html = '';
        for (var i = 0; i < gestantes.length; i++) {
            var g = gestantes[i];
            var semanas = g.semanasGestacion || 0;
            var pct = Math.min(100, Math.round((semanas / 40) * 100));

            // 📦468 — Próximo seguimiento (Res. 0312/2019 art. 14)
            var prox = _calcularProximoSeguimiento(g);
            var proxCell;
            if (!prox) {
                var labelNoProx = g.estado === 'cerrado' ? 'Caso cerrado'
                                : g.estado === 'licencia' ? 'En licencia'
                                : '—';
                proxCell = '<span style="color: var(--text-muted);">' + _esc(labelNoProx) + '</span>';
            } else {
                var proxClass = prox.vencido ? 'gs-prox--vencido' : 'gs-prox--ok';
                var proxIcon = prox.vencido ? 'bi-exclamation-circle-fill' : 'bi-calendar-plus';
                var proxLabel = prox.vencido ? 'Vencido · ' : '';
                proxCell = '<span class="' + proxClass + '" style="font-size:0.8rem;">' +
                    '<i class="bi ' + proxIcon + '"></i> ' + proxLabel + _fmtDate(prox.fecha) +
                '</span>';
            }

            html += '<tr onclick="abrirSeguimientoMensual(\'' + _esc(g.id) + '\')" style="cursor: pointer;">' +
                '<td>' +
                    '<div class="gs-empleado">' +
                        '<div class="gs-empleado__avatar">' + _esc(_initials(g.nombre)) + '</div>' +
                        '<div class="gs-empleado__info">' +
                            '<div class="gs-empleado__name">' + _esc(g.nombre) + '</div>' +
                            '<div class="gs-empleado__cedula"><i class="bi bi-credit-card-2-front"></i> ' + _esc(g.cedula) + '</div>' +
                        '</div>' +
                    '</div>' +
                '</td>' +
                '<td>' + _esc(g.empresa || '') + '</td>' +
                '<td>' + (g.cargo ? _esc(g.cargo) : '<span style="color:var(--text-muted);">—</span>') + '</td>' +
                '<td>' +
                    '<div class="gs-semanas">' + semanas + '<span class="gs-semanas__label"> sem</span></div>' +
                    '<div class="gs-progress-bar"><div class="gs-progress-bar__fill" style="width: ' + pct + '%;"></div></div>' +
                '</td>' +
                '<td>' + _fmtDate(g.fpp) + '</td>' +
                '<td>' + _badgeRiesgo(g.clasificacion) + '</td>' +
                '<td>' + _badgeEstado(g.estado) + '</td>' +
                '<td style="font-size: 0.8rem; color: var(--text-muted);">' +
                    '<div><i class="bi bi-calendar-event"></i> ' + _fmtDate(g.ultimoSeguimiento) + '</div>' +
                '</td>' +
                '<td>' + proxCell + '</td>' +
                '<td>' +
                    '<div class="gs-row-actions">' +
                        '<button class="gs-row-btn primary" title="Ver seguimiento mensual" onclick="event.stopPropagation(); abrirSeguimientoMensual(\'' + _esc(g.id) + '\');"><i class="fas fa-notes-medical"></i></button>' +
                        (g.estado === 'cerrado'
                            ? '<button class="gs-row-btn warning" title="Reabrir caso" onclick="event.stopPropagation(); toggleEstadoGestante(\'' + _esc(g.id) + '\', \'cerrado\', \'' + _esc(g.nombre) + '\');"><i class="fas fa-lock-open"></i></button>'
                            : '<button class="gs-row-btn warning" title="Cerrar caso" onclick="event.stopPropagation(); toggleEstadoGestante(\'' + _esc(g.id) + '\', \'' + _esc(g.estado || 'activo') + '\', \'' + _esc(g.nombre) + '\');"><i class="fas fa-lock"></i></button>'
                        ) +
                        '<button class="gs-row-btn danger" title="Eliminar gestante" onclick="event.stopPropagation(); confirmarEliminarGestante(\'' + _esc(g.id) + '\', \'' + _esc(g.nombre) + '\', \'' + _esc(g.cedula) + '\');"><i class="fas fa-trash"></i></button>' +
                    '</div>' +
                '</td>' +
            '</tr>';
        }

        document.getElementById('tablaGestantes').innerHTML = html;
        document.getElementById('resultadosCount').textContent = String(gestantes.length);
    }

    // ─── Lógica de filtrado ───
    function _aplicarFiltros() {
        var filtros = _state.filtros;
        var resultado = _state.gestantes.slice();

        if (filtros.estado && filtros.estado !== 'todas') {
            resultado = resultado.filter(function (g) { return g.estado === filtros.estado; });
        }
        if (filtros.riesgo === 'alto') {
            resultado = resultado.filter(function (g) {
                return g.clasificacion === 'alto' || g.clasificacion === 'muy-alto';
            });
        }
        if (filtros.busqueda && filtros.busqueda.trim()) {
            var q = filtros.busqueda.toLowerCase().trim();
            resultado = resultado.filter(function (g) {
                return (g.nombre || '').toLowerCase().indexOf(q) !== -1 ||
                       (g.cedula || '').toLowerCase().indexOf(q) !== -1;
            });
        }
        _renderTabla(resultado);
    }

    function _actualizarBotonesFiltro() {
        var btns = document.querySelectorAll('.gs-filter');
        for (var i = 0; i < btns.length; i++) btns[i].classList.remove('active');
        var filtros = _state.filtros;
        var targetValue = filtros.riesgo ? filtros.riesgo : filtros.estado;
        var targetTipo = filtros.riesgo ? 'riesgo' : 'estado';
        for (var j = 0; j < btns.length; j++) {
            if (btns[j].getAttribute('data-filter') === targetTipo &&
                btns[j].getAttribute('data-value') === targetValue) {
                btns[j].classList.add('active');
            }
        }
    }

    // ─── Modal: Registrar Gestante ───
    function _abrirModalNuevaGestante() {
        var modal = document.getElementById('modalNuevaGestante');
        if (!modal) {
            _crearModalNuevaGestante();
            modal = document.getElementById('modalNuevaGestante');
        }
        modal.style.display = 'flex';
        // Defaults: hoy como fecha de notificación
        var hoy = new Date().toISOString().slice(0, 10);
        var fNotif = document.getElementById('ngFechaNotificacion');
        if (fNotif && !fNotif.value) fNotif.value = hoy;
        // Foco en el primer campo
        setTimeout(function() {
            var f = document.getElementById('ngCedula');
            if (f) f.focus();
        }, 50);
    }

    function _cerrarModalNuevaGestante() {
        var modal = document.getElementById('modalNuevaGestante');
        if (modal) modal.style.display = 'none';
        var form = document.getElementById('formNuevaGestante');
        if (form) form.reset();
    }

    function _crearModalNuevaGestante() {
        var html = '' +
        '<div id="modalNuevaGestante" class="ng-modal" style="display:none;">' +
            '<div class="ng-modal__overlay" onclick="cerrarModalNuevaGestante()"></div>' +
            '<div class="ng-modal__dialog">' +
                '<div class="ng-modal__header">' +
                    '<i class="bi bi-person-plus-fill" style="color: var(--rosa);"></i>' +
                    '<div class="ng-modal__title">Registrar Nueva Gestante</div>' +
                    '<button type="button" class="ng-modal__close" onclick="cerrarModalNuevaGestante()" title="Cerrar">&times;</button>' +
                '</div>' +
                '<form id="formNuevaGestante" class="ng-modal__body" onsubmit="event.preventDefault(); guardarNuevaGestante();">' +
                    '<div class="ng-section">' +
                        '<div class="ng-section__title"><i class="bi bi-person-vcard"></i> Datos de la trabajadora</div>' +
                        '<div class="ng-grid">' +
                            '<div class="ng-field">' +
                                '<label class="ng-field__label">Cédula <span class="ng-req">*</span></label>' +
                                '<input type="text" class="ng-field__input" id="ngCedula" required maxlength="20" placeholder="Ej: 1044392755" />' +
                            '</div>' +
                            '<div class="ng-field">' +
                                '<label class="ng-field__label">Nombre completo <span class="ng-req">*</span></label>' +
                                '<input type="text" class="ng-field__input" id="ngNombre" required maxlength="120" placeholder="Nombres y apellidos" />' +
                            '</div>' +
                            '<div class="ng-field">' +
                                '<label class="ng-field__label">Cargo</label>' +
                                '<input type="text" class="ng-field__input" id="ngCargo" maxlength="100" placeholder="Ej: Auxiliar administrativa" />' +
                            '</div>' +
                            '<div class="ng-field">' +
                                '<label class="ng-field__label">EPS</label>' +
                                '<input type="text" class="ng-field__input" id="ngEps" maxlength="60" placeholder="Ej: Sura" />' +
                            '</div>' +
                            '<div class="ng-field">' +
                                '<label class="ng-field__label">ARL</label>' +
                                '<input type="text" class="ng-field__input" id="ngArl" maxlength="60" placeholder="Ej: Sura ARL" />' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="ng-section">' +
                        '<div class="ng-section__title"><i class="bi bi-calendar-heart"></i> Datos del embarazo</div>' +
                        '<div class="ng-grid">' +
                            '<div class="ng-field">' +
                                '<label class="ng-field__label">Fecha de notificación <span class="ng-req">*</span></label>' +
                                '<input type="date" class="ng-field__input" id="ngFechaNotificacion" required />' +
                                '<div class="ng-field__hint">Fecha en que la trabajadora notificó a la empresa</div>' +
                            '</div>' +
                            '<div class="ng-field">' +
                                '<label class="ng-field__label">FPP (Fecha probable de parto) <span class="ng-req">*</span></label>' +
                                '<input type="date" class="ng-field__input" id="ngFpp" required />' +
                            '</div>' +
                            '<div class="ng-field">' +
                                '<label class="ng-field__label">Semanas de gestación al notificar</label>' +
                                '<input type="number" class="ng-field__input" id="ngSemanas" min="0" max="42" value="0" />' +
                            '</div>' +
                            '<div class="ng-field">' +
                                '<label class="ng-field__label">Clasificación inicial</label>' +
                                '<div class="ng-options">' +
                                    '<label class="ng-option"><input type="radio" name="ngClasificacion" value="bajo" checked /> Bajo riesgo</label>' +
                                    '<label class="ng-option"><input type="radio" name="ngClasificacion" value="alto" /> Alto riesgo</label>' +
                                    '<label class="ng-option"><input type="radio" name="ngClasificacion" value="muy-alto" /> Muy alto riesgo</label>' +
                                '</div>' +
                            '</div>' +
                            '<div class="ng-field ng-field--full">' +
                                '<label class="ng-field__label">Observaciones</label>' +
                                '<textarea class="ng-field__textarea" id="ngObservaciones" maxlength="500" placeholder="Notas relevantes (sin incluir diagnósticos)"></textarea>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="ng-modal__footer">' +
                        '<button type="button" class="k-btn k-btn-ghost" onclick="cerrarModalNuevaGestante()">Cancelar</button>' +
                        '<button type="submit" class="k-btn k-btn-primary"><i class="bi bi-save"></i> Registrar Gestante</button>' +
                    '</div>' +
                '</form>' +
            '</div>' +
        '</div>';
        var container = document.createElement('div');
        container.innerHTML = html;
        document.body.appendChild(container.firstChild);

        // 📦467 (2026-07-03) — Autollenado de datos del personal al tabular desde Cédula.
        // Mismo patrón que el wizard de seguimiento (medicion-ausentismo.js → cedula-input blur).
        // Llama `buscarEmpleadoPorCedula` (mismo IPC del wizard) y popula nombre/cargo/eps/arl.
        var cedulaInput = document.getElementById('ngCedula');
        if (cedulaInput) {
            cedulaInput.addEventListener('blur', _autollenarDatosPersonal);
        }
    }

    async function _autollenarDatosPersonal() {
        var cedulaInput = document.getElementById('ngCedula');
        var cedula = (cedulaInput && cedulaInput.value || '').trim();
        if (!cedula) return;
        if (!_state.empresaId) {
            _mostrarToast('warning', 'Sin empresa', 'No se detecta empresa activa para autollenado.');
            return;
        }

        var nombreEl = document.getElementById('ngNombre');
        var cargoEl = document.getElementById('ngCargo');
        var epsEl = document.getElementById('ngEps');
        var arlEl = document.getElementById('ngArl');

        // Hint visual mientras se busca
        if (nombreEl) nombreEl.placeholder = 'Buscando en BD de personal...';

        try {
            var res = await window.electronAPI.buscarEmpleadoPorCedula(cedula, _state.empresaId);
            if (res && res.success && res.datos) {
                var d = res.datos;
                if (nombreEl) nombreEl.value = d.nombre || '';
                if (cargoEl) cargoEl.value = d.cargo || '';
                if (epsEl) epsEl.value = d.entidad || '';
                if (arlEl) arlEl.value = d.arl || '';
                _mostrarToast('success', 'Datos autollenados',
                    (d.nombre ? d.nombre : 'Trabajadora') + ' · ' + (d.cargo || 'cargo N/D'));
            } else {
                // No encontrada: limpiar campos (mantener cédula) — mismo patrón del wizard.
                if (nombreEl) nombreEl.value = '';
                if (cargoEl) cargoEl.value = '';
                if (epsEl) epsEl.value = '';
                if (arlEl) arlEl.value = '';
                _mostrarToast('warning', 'No encontrada',
                    'Cédula ' + cedula + ' no existe en BD de personal. Diligencia manualmente.');
            }
        } catch (e) {
            _mostrarToast('error', 'Error de búsqueda', e.message || String(e));
        } finally {
            if (nombreEl) nombreEl.placeholder = 'Nombres y apellidos';
        }
    }

    async function _guardarNuevaGestante() {
        var form = document.getElementById('formNuevaGestante');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }
        var cedula = document.getElementById('ngCedula').value.trim();
        var nombre = document.getElementById('ngNombre').value.trim();
        if (!cedula || !nombre) {
            _mostrarToast('warning', 'Datos incompletos', 'Cédula y nombre son obligatorios.');
            return;
        }
        var clasificacion = 'bajo';
        var radios = document.querySelectorAll('input[name="ngClasificacion"]');
        for (var i = 0; i < radios.length; i++) {
            if (radios[i].checked) { clasificacion = radios[i].value; break; }
        }

        var data = {
            cedula: cedula,
            nombre: nombre,
            cargo: document.getElementById('ngCargo').value.trim(),
            fechaNotificacion: document.getElementById('ngFechaNotificacion').value,
            fpp: document.getElementById('ngFpp').value,
            semanasGestacion: parseInt(document.getElementById('ngSemanas').value || '0', 10),
            clasificacion: clasificacion,
            eps: document.getElementById('ngEps').value.trim(),
            arl: document.getElementById('ngArl').value.trim(),
            observaciones: document.getElementById('ngObservaciones').value.trim()
        };

        _setSyncBadge('saving');
        try {
            var res = await window.electronAPI.gestacionRegistrarGestante({
                empresaId: _state.empresaId,
                data: data
            });
            if (res && res.success) {
                _cerrarModalNuevaGestante();
                _mostrarToast('success', 'Gestante registrada', nombre + ' fue agregada al seguimiento.');
                await _cargarDatos();
            } else {
                _setSyncBadge('error');
                var msg = (res && res.error && res.error.message) || 'Error desconocido';
                if (res && res.error && res.error.code === 'DUPLICATE') {
                    _mostrarToast('warning', 'Cédula duplicada', 'Ya existe una gestante con esa cédula.');
                } else {
                    _mostrarToast('error', 'Error al registrar', msg);
                }
            }
        } catch (e) {
            _setSyncBadge('error');
            _mostrarToast('error', 'Error de conexión', e.message);
        }
    }

    // ─── Toggle Cerrar/Reabrir caso ───
    // 📦468 (2026-07-03) — Botón "lock" en acciones de fila para alternar estado activo/cerrado.
    // Mismo IPC `gestacionActualizarGestante` que el resto del módulo, sin agregar handler nuevo.
    async function _toggleEstadoGestante(gestanteId, estadoActual, nombre) {
        var nuevoEstado = estadoActual === 'cerrado' ? 'activo' : 'cerrado';
        var verbo = nuevoEstado === 'cerrado' ? 'Cerrar' : 'Reabrir';
        var explicacion = nuevoEstado === 'cerrado'
            ? 'El caso se marcará como cerrado y no contará en los KPIs de gestantes activas.'
            : 'El caso volverá a estado activo y volverá a contar en los KPIs.';
        var confirmed = await _showConfirm(
            '¿' + verbo + ' el caso de "' + nombre + '"?\n\n' + explicacion
        );
        if (!confirmed) return;

        _setSyncBadge('saving');
        try {
            var res = await window.electronAPI.gestacionActualizarGestante({
                empresaId: _state.empresaId,
                gestanteId: gestanteId,
                data: { estado: nuevoEstado }
            });
            if (res && res.success) {
                _mostrarToast('success', 'Estado actualizado',
                    'Caso de ' + nombre + ' ahora está ' + (nuevoEstado === 'cerrado' ? 'cerrado' : 'activo') + '.');
                await _cargarDatos();
            } else {
                _setSyncBadge('error');
                var msg = (res && res.error && res.error.message) || 'Error desconocido';
                _mostrarToast('error', 'Error al ' + verbo.toLowerCase(), msg);
            }
        } catch (e) {
            _setSyncBadge('error');
            _mostrarToast('error', 'Error de conexión', e.message);
        }
    }

    // ─── Confirmar + Eliminar gestante ───
    // 📦468 — Botón "trash" en acciones de fila.
    // Backend: `gestacionEliminarGestante` ya borra seguimientos por FK CASCADE.
    async function _confirmarEliminarGestante(gestanteId, nombre, cedula) {
        var confirmed = await _showConfirm(
            '¿Eliminar a "' + nombre + '" (CC ' + cedula + ')?\n\n' +
            '⚠️ Se eliminarán también todos sus seguimientos mensuales.\n\n' +
            'Esta acción NO se puede deshacer.'
        );
        if (!confirmed) return;

        _setSyncBadge('saving');
        try {
            var res = await window.electronAPI.gestacionEliminarGestante({
                empresaId: _state.empresaId,
                gestanteId: gestanteId
            });
            if (res && res.success) {
                _mostrarToast('success', 'Gestante eliminada',
                    nombre + ' y sus seguimientos fueron eliminados.');
                await _cargarDatos();
            } else {
                _setSyncBadge('error');
                var msg = (res && res.error && res.error.message) || 'Error desconocido';
                _mostrarToast('error', 'Error al eliminar', msg);
            }
        } catch (e) {
            _setSyncBadge('error');
            _mostrarToast('error', 'Error de conexión', e.message);
        }
    }

    // ─── Exportar CSV ───
    function _exportarCSV() {
        var datos = _state.gestantes;
        if (datos.length === 0) {
            _mostrarToast('warning', 'Sin datos', 'No hay gestantes para exportar.');
            return;
        }
        // 📦468 — Cabeceras/filas amplían con Próx. seguimiento
        var headers = ['Cedula', 'Nombre', 'Empresa', 'Cargo', 'Semanas', 'FPP', 'Clasificacion', 'Estado', 'Ultimo Seguimiento', 'Proximo Seguimiento', 'Proximo Vencido'];
        var rows = [headers.join(',')];
        for (var i = 0; i < datos.length; i++) {
            var g = datos[i];
            var prox = _calcularProximoSeguimiento(g);
            rows.push([
                g.cedula,
                '"' + (g.nombre || '').replace(/"/g, '""') + '"',
                g.empresa,
                '"' + (g.cargo || '').replace(/"/g, '""') + '"',
                g.semanasGestacion,
                g.fpp,
                g.clasificacion,
                g.estado,
                g.ultimoSeguimiento || '',
                prox ? prox.fecha : '',
                prox ? (prox.vencido ? 'SI' : 'NO') : ''
            ].join(','));
        }
        var csv = rows.join('\n');
        var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'gestantes_' + new Date().toISOString().slice(0, 10) + '.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        _mostrarToast('success', 'Exportación completa', 'Se descargaron ' + datos.length + ' registros.');
    }

    // ─── API pública expuesta al window ───
    window.aplicarFiltro = function (tipo, valor, btnEl) {
        if (tipo === 'estado') {
            _state.filtros.estado = valor;
            _state.filtros.riesgo = null;
            var btns = document.querySelectorAll('.gs-filter');
            for (var i = 0; i < btns.length; i++) btns[i].classList.remove('active');
            if (btnEl) btnEl.classList.add('active');
        } else if (tipo === 'riesgo') {
            if (_state.filtros.riesgo === valor) {
                _state.filtros.riesgo = null;
                _state.filtros.estado = 'todas';
                _actualizarBotonesFiltro();
                if (btnEl) btnEl.classList.remove('active');
            } else {
                _state.filtros.riesgo = valor;
                _state.filtros.estado = 'todas';
                _actualizarBotonesFiltro();
                if (btnEl) btnEl.classList.add('active');
            }
        }
        _aplicarFiltros();
    };

    window.aplicarFiltros = function () {
        _state.filtros.busqueda = document.getElementById('searchInput').value || '';
        _aplicarFiltros();
    };

    window.abrirSeguimientoMensual = function (gestanteId) {
        // 📦464 (2026-07-03) — Cambio de flujo: ahora vamos a la ANTESALA primero
        // (vista resumen de la gestante). Desde la antesala, el botón "Iniciar ahora"
        // o "Nuevo Seguimiento" navega al wizard mensual propiamente.
        if (window.parent && window.parent.postMessage) {
            window.parent.postMessage({
                type: 'ausentismo-home-action',
                action: 'seguimiento-gestacion-antesala',
                payload: { gestanteId: gestanteId, empresaId: _state.empresaId }
            }, '*');
        }
    };

    window.registrarNuevaGestante = _abrirModalNuevaGestante;
    window.cerrarModalNuevaGestante = _cerrarModalNuevaGestante;
    window.guardarNuevaGestante = _guardarNuevaGestante;
    window.exportarExcel = _exportarCSV;
    // 📦468 — Acciones de fila
    window.toggleEstadoGestante = _toggleEstadoGestante;
    window.confirmarEliminarGestante = _confirmarEliminarGestante;

    window.volverAlHome = function () {
        if (window.parent && window.parent.postMessage) {
            window.parent.postMessage({ type: 'ausentismo-home-action', action: 'main' }, '*');
        }
    };

    // ─── Bind del header estándar ───
    function _bindHeader() {
        var btnBack = document.getElementById('kair-gs-back');
        if (btnBack) btnBack.addEventListener('click', window.volverAlHome);
        var btnExport = document.getElementById('kair-gs-cta-export');
        if (btnExport) btnExport.addEventListener('click', _exportarCSV);
        var btnNew = document.getElementById('kair-gs-cta-new');
        if (btnNew) btnNew.addEventListener('click', _abrirModalNuevaGestante);
    }

    // ─── Contexto de empresa + carga inicial ───
    function _applyCompanyContext() {
        window.addEventListener('message', function (event) {
            var data = event.data;
            if (data && data.type === 'SET_COMPANY_CONTEXT' && data.company) {
                _state.empresaId = data.company;
                var bcEl = document.getElementById('kair-gs-bc-company');
                if (bcEl) bcEl.textContent = data.company;
                _cargarDatos();
            }
        });
    }

    // ─── Init ───
    document.addEventListener('DOMContentLoaded', function () {
        console.log('[GESTACION] Inicializando vista principal (IPC)...');
        _renderKpisLoading();
        _renderTablaLoading();
        _bindHeader();
        _applyCompanyContext();
    });

})();