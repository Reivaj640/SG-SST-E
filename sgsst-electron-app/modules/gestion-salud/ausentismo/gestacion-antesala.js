/* ═══════════════════════════════════════════════════════════════════
   K+AIR · Antesala de Seguimiento de Gestación — Vista resumen
   v01 · 📦464 (2026-07-03) — Vista previa antes del wizard mensual
   - Carga gestante + seguimientos vía IPC (gestacion:obtenerGestante)
   - Calcula KPIs derivados (meses, días FPP, frecuencia por riesgo)
   - Genera próximos periodos programados según frecuencia
   - Botones: Imprimir · Exportar · Nuevo Seguimiento · Volver
   - Resolución 0312/2019 art. 14: freq. por clasificación
     · Bajo → Mensual   · Alto → Quincenal   · Muy Alto → Semanal
   ═══════════════════════════════════════════════════════════════════ */

(function () {
    'use strict';

    // ─── Estado privado ───
    var _state = {
        empresaId: null,
        gestanteId: null,
        gestante: null,
        seguimientos: [],
        loading: false,
        error: null,
        frecuencia: 'mensual'    // 'mensual' | 'quincenal' | 'semanal'
    };

    // ─── Helpers de escape / formato ───
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
        var parts = nombre.trim().split(/\s+/);
        return ((parts[0] ? parts[0][0] : '') + (parts[1] ? parts[1][0] : '')).toUpperCase();
    }

    function _badgeRiesgo(c) {
        var map = {
            'bajo':     '<span class="gsa-badge gsa-badge--primary"><i class="bi bi-shield-check"></i> Bajo Riesgo</span>',
            'alto':     '<span class="gsa-badge gsa-badge--warning"><i class="bi bi-exclamation-triangle"></i> Alto Riesgo</span>',
            'muy-alto': '<span class="gsa-badge gsa-badge--danger"><i class="bi bi-radiation"></i> Muy Alto Riesgo</span>'
        };
        return map[c] || '<span class="gsa-badge gsa-badge--neutral">' + _esc(c) + '</span>';
    }

    function _badgeEstado(e) {
        var map = {
            'activo':   '<span class="gsa-badge gsa-badge--success"><i class="bi bi-circle-fill" style="font-size:0.5rem;"></i> Activa</span>',
            'licencia': '<span class="gsa-badge gsa-badge--info"><i class="bi bi-umbrella"></i> Licencia</span>',
            'cerrado':  '<span class="gsa-badge gsa-badge--neutral"><i class="bi bi-check-circle"></i> Cerrado</span>'
        };
        return map[e] || '<span class="gsa-badge gsa-badge--neutral">' + _esc(e) + '</span>';
    }

    function _mostrarToast(tipo, titulo, mensaje) {
        var notifier = (window.parent && window.parent.updateNotifier) || window.updateNotifier;
        if (notifier && typeof notifier.show === 'function') {
            notifier.show({ type: tipo, title: titulo, subtitle: mensaje, autoClose: 4000 });
        }
    }

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
        } else {
            badge.classList.add('k-sync-synced');
            badge.innerHTML = '<i class="bi bi-check-circle-fill"></i> Borrador';
        }
    }

    // ─── Resolución 0312/2019 art. 14 · Frecuencia por clasificación ───
    function _frecuenciaPorRiesgo(c) {
        if (c === 'alto') return 'quincenal';
        if (c === 'muy-alto') return 'semanal';
        return 'mensual';
    }

    function _frecuenciaLabel(f) {
        return ({
            'mensual':   'Mensual',
            'quincenal': 'Quincenal',
            'semanal':   'Semanal'
        })[f] || 'Mensual';
    }

    // ─── Cálculos derivados ───
    function _diasHastaFPP(fpp) {
        if (!fpp) return null;
        var hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        var d = new Date(fpp + 'T00:00:00');
        var diff = Math.ceil((d - hoy) / (1000 * 60 * 60 * 24));
        return diff;
    }

    function _mesesGestacion(sem) {
        if (!sem || sem < 0) return 0;
        return Math.floor(sem / 4.345);
    }

    function _periodoOffset(periodoBase, meses) {
        // periodoBase = 'YYYY-MM'. Devuelve 'YYYY-MM' desplazado N meses.
        var p = periodoBase.split('-');
        var y = parseInt(p[0], 10);
        var m = parseInt(p[1], 10) - 1 + meses;
        while (m < 0) { m += 12; y -= 1; }
        while (m > 11) { m -= 12; y += 1; }
        return y + '-' + String(m + 1).padStart(2, '0');
    }

    function _periodoActual() {
        var d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    }

    function _periodoMenor(a, b) {
        return a < b ? a : b;
    }

    function _periodoMayor(a, b) {
        return a > b ? a : b;
    }

    /**
     * Genera los próximos N periodos programados que faltan por diligenciar.
     * Reglas:
     *  - Punto de partida = (periodo actual del sistema) o (último seguimiento + 1 freq)
     *  - Frecuencia define step (1 mes / 15 días aprox / 7 días)
     *  - Solo se listan periodos <= 4 meses hacia adelante (no abrumar)
     *  - Marca "vencido" si el periodo ya pasó (mes < actual)
     */
    function _calcularProximosPeriodos(seguimientos, frecuencia) {
        var hoy = _periodoActual();
        var periodosSet = {};
        for (var i = 0; i < seguimientos.length; i++) {
            if (seguimientos[i].periodo) periodosSet[seguimientos[i].periodo] = true;
        }

        // Determinar paso en meses según frecuencia
        var pasoMeses = 1;
        if (frecuencia === 'quincenal') pasoMeses = 0; // pseudo-mensual para mostrar YYYY-MM (la quincena se opera internamente en el wizard)
        if (frecuencia === 'semanal') pasoMeses = 0;

        // Punto de partida: primer periodo pendiente >= hoy
        // Si el último seguimiento fue "2026-05" y hoy es "2026-07", el próximo es 2026-07
        // Si no hay seguimientos, arrancar en el periodo actual
        var ultimoSeg = null;
        for (var j = 0; j < seguimientos.length; j++) {
            var p = seguimientos[j].periodo;
            if (p && (!ultimoSeg || p > ultimoSeg)) ultimoSeg = p;
        }
        var inicio;
        if (ultimoSeg) {
            // avanzar al menos 1 paso desde el último seguimiento
            var nextMeses = pasoMeses > 0 ? 1 : 0;
            inicio = _periodoOffset(ultimoSeg, nextMeses);
            // pero si ese inicio ya pasó hace mucho (más de 1 mes), retomar desde el actual
            if (inicio < _periodoOffset(hoy, -2)) {
                inicio = _periodoOffset(hoy, 0);
            }
        } else {
            inicio = hoy;
        }
        // Asegurar que inicio >= hoy - 1 mes (no perder periodos recién vencidos)
        if (inicio < _periodoOffset(hoy, -1)) inicio = _periodoOffset(hoy, -1);

        // Generar hasta 4 periodos hacia adelante
        var out = [];
        for (var k = 0; k < 4; k++) {
            var p = _periodoOffset(inicio, k * Math.max(1, pasoMeses));
            if (periodosSet[p]) continue; // ya diligenciado, saltar
            var vencido = p < hoy;
            out.push({ periodo: p, vencido: vencido });
        }
        return out;
    }

    /**
     * Resumen del periodo más próximo (el primero vencido o el actual) — usado en KPI.
     */
    function _proximoPeriodoResumen(proximos) {
        if (!proximos || proximos.length === 0) return '—';
        var hoy = _periodoActual();
        // Priorizar: primero vencido, sino el primero
        for (var i = 0; i < proximos.length; i++) {
            if (proximos[i].vencido) return _fmtPeriodo(proximos[i].periodo);
        }
        return _fmtPeriodo(proximos[0].periodo);
    }

    function _fmtPeriodo(p) {
        // 'YYYY-MM' → 'mes YYYY' (es-CO)
        if (!p) return '—';
        var parts = p.split('-');
        if (parts.length !== 2) return p;
        try {
            var d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
            return d.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
        } catch (e) { return p; }
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
            _renderError('Sin contexto de empresa. Vuelva al listado principal.');
            return;
        }
        if (!_state.gestanteId) {
            _renderError('No se ha seleccionado una gestante.');
            return;
        }

        _state.loading = true;
        _setSyncBadge('loading');
        _renderLoading();

        try {
            var res = await window.electronAPI.gestacionObtenerGestante({
                empresaId: _state.empresaId,
                gestanteId: _state.gestanteId
            });
            if (!res || !res.success) {
                _state.error = (res && res.error && res.error.message) || 'Gestante no encontrada';
                _setSyncBadge('error');
                _renderError(_state.error);
                _mostrarToast('error', 'No se pudo cargar la gestante', _state.error);
                return;
            }
            _state.gestante = res.data;
            _state.seguimientos = (res.data && res.data.seguimientos) || [];
            _state.error = null;
            _state.frecuencia = _frecuenciaPorRiesgo(_state.gestante.clasificacion);

            // 📦464 (2026-07-03) — Enriquecer con datos de la BD de personal
            // (teléfono, correo). El bridge gestaciones NO devuelve estos campos,
            // pero vienen en `buscarEmpleadoPorCedula` que ya usa el modal de
            // nueva gestante y el wizard mensual.
            try {
                var resEmp = await window.electronAPI.buscarEmpleadoPorCedula(
                    _state.gestante.cedula, _state.empresaId
                );
                if (resEmp && resEmp.success && resEmp.datos) {
                    var d = resEmp.datos;
                    if (d.telefono) _state.gestante.telefono = d.telefono;
                    if (d.celular) _state.gestante.telefono = _state.gestante.telefono || d.celular;
                    if (d.correo) _state.gestante.correo = d.correo;
                    if (d.email) _state.gestante.correo = _state.gestante.correo || d.email;
                    if (d.mail) _state.gestante.correo = _state.gestante.correo || d.mail;
                }
            } catch (eEmp) {
                // No bloqueante: si falla el enriquecimiento, mostramos "—"
                console.warn('[GESTACION-ANTESALA] No se pudo enriquecer con datos de personal:', eEmp.message);
            }

            _setSyncBadge('borrador');
            _renderTodo();
        } catch (e) {
            _state.error = e.message;
            _setSyncBadge('error');
            _renderError(_state.error);
            _mostrarToast('error', 'Error de conexión', e.message);
        } finally {
            _state.loading = false;
        }
    }

    // ─── Render: estados intermedios ───
    function _renderLoading() {
        document.getElementById('gsaMain').innerHTML =
            '<div class="gsa-loading">' +
                '<i class="bi bi-arrow-clockwise" style="animation:spin 1s linear infinite;"></i>' +
                '<div>Cargando información de la gestante…</div>' +
            '</div>';
    }

    function _renderError(msg) {
        document.getElementById('gsaMain').innerHTML =
            '<div class="gsa-loading">' +
                '<i class="bi bi-exclamation-triangle" style="color: var(--v3-destructive);"></i>' +
                '<div style="font-weight:600;color:var(--v3-foreground);">No se pudo cargar la gestante</div>' +
                '<div style="font-size:0.85rem;margin-top:6px;">' + _esc(msg) + '</div>' +
                '<button class="k-btn k-btn-secondary" style="margin-top:18px;" onclick="volverAlListado()">' +
                    '<i class="bi bi-arrow-left"></i> Volver al listado</button>' +
            '</div>';
    }

    // ─── Render principal ───
    function _renderTodo() {
        var g = _state.gestante;
        var segs = _state.seguimientos;
        var freq = _state.frecuencia;

        // Breadcrumb con nombre
        var bcEl = document.getElementById('kair-gsa-bc-gestante');
        if (bcEl) bcEl.textContent = g.nombre || '—';
        var titleEl = document.getElementById('kair-gsa-title');
        if (titleEl) titleEl.textContent = g.nombre || 'Antesala de Seguimiento';

        // Calcular KPIs
        var meses = _mesesGestacion(g.semanasGestacion);
        var diasFPP = _diasHastaFPP(g.fpp);
        var totalSegs = segs.length;
        var proximos = _calcularProximosPeriodos(segs, freq);
        var ultimoSeg = null;
        for (var i = 0; i < segs.length; i++) {
            if (!ultimoSeg || segs[i].periodo > ultimoSeg.periodo) ultimoSeg = segs[i];
        }

        var html = '' +
            // ── KPI STRIP ──
            '<div class="kair-v3-kpi-strip">' +
                _kpi('Meses de gestación', String(meses), 'Inicio sem ' + (g.semanasGestacion || 0), 'bi-calendar-month', 'primary') +
                _kpi('Seguimientos realizados', String(totalSegs), totalSegs === 0 ? 'Sin seguimientos' : 'Último: ' + _fmtDate(ultimoSeg ? ultimoSeg.fecha : null), 'bi-clipboard-check', 'success') +
                _kpi('Días para FPP', diasFPP == null ? '—' : String(diasFPP), diasFPP != null && diasFPP >= 0 ? 'FPP: ' + _fmtDate(g.fpp) : (diasFPP != null ? 'FPP ya pasó' : '—'), 'bi-calendar-heart', diasFPP != null && diasFPP < 14 ? 'warning' : 'info') +
                _kpi('Frecuencia requerida', _frecuenciaLabel(freq), freq === 'semanal' ? 'Res. 0312 art. 14' : (freq === 'quincenal' ? 'Alto riesgo' : 'Bajo riesgo · EMO trim.'), 'bi-arrow-repeat', 'warning') +
            '</div>' +

            // ── CARD PRINCIPAL DE LA GESTANTE ──
            '<div class="gsa-gestante">' +
                '<div class="gsa-gestante__top">' +
                    '<div class="gsa-gestante__avatar">' + _esc(_initials(g.nombre)) + '</div>' +
                    '<div class="gsa-gestante__info">' +
                        '<div class="gsa-gestante__name">' +
                            _esc(g.nombre) +
                            _badgeRiesgo(g.clasificacion) +
                            _badgeEstado(g.estado) +
                        '</div>' +
                        '<div class="gsa-gestante__meta">' +
                            '<i class="bi bi-credit-card-2-front"></i> CC ' + _esc(g.cedula) +
                            ' · ID interno: ' + _esc(g.id.replace(/^g-/, '').substring(0, 8).toUpperCase()) +
                        '</div>' +
                    '</div>' +
                '</div>' +

                '<div class="gsa-grid">' +
                    _fieldGrid('Cargo', g.cargo, 'bi-briefcase') +
                    _fieldGrid('Área / Empresa', g.empresa, 'bi-building') +
                    _fieldGrid('F. Notificación', _fmtDate(g.fechaNotificacion), 'bi-bell') +
                    _fieldGrid('FPP', _fmtDate(g.fpp), 'bi-calendar-heart') +
                    _fieldGrid('Semanas Inicio', (g.semanasGestacion || 0) + ' sem', 'bi-calendar-week') +
                    _fieldGrid('Teléfono', g.telefono || '—', 'bi-telephone') +
                    _fieldGrid('Correo', g.correo || '—', 'bi-envelope') +
                    _fieldGrid('EPS', g.eps || '—', 'bi-shield-plus') +
                    _fieldGrid('ARL', g.arl || '—', 'bi-shield-check') +
                '</div>' +
            '</div>' +

            // ── LAYOUT 2 COLUMNAS ──
            '<div class="gsa-cols">' +
                '<div class="gsa-col-left">' +
                    // Prónimos Seguimientos Programados
                    _renderProximos(proximos) +
                    // Historial
                    _renderHistorial(segs) +
                '</div>' +
                '<div class="gsa-col-right">' +
                    // Información Clave
                    _renderInfoClave(g, segs, freq, totalSegs, ultimoSeg, proximos) +
                    // Confidencialidad
                    _renderConfidencialidad() +
                '</div>' +
            '</div>';

        document.getElementById('gsaMain').innerHTML = html;

        // Bind de botones "Iniciar ahora" (cada item próximo puede tener su CTA)
        var ctas = document.querySelectorAll('[data-action="iniciar-seguimiento"]');
        for (var k = 0; k < ctas.length; k++) {
            ctas[k].addEventListener('click', function (e) {
                e.preventDefault();
                _irASeguimientoMensual();
            });
        }
    }

    function _kpi(label, value, sub, icon, color) {
        return '<div class="kair-v3-kpi kair-v3-kpi--' + color + '">' +
            '<div class="kair-v3-kpi__icon"><i class="bi ' + icon + '"></i></div>' +
            '<div class="kair-v3-kpi__content">' +
                '<div class="kair-v3-kpi__value">' + _esc(value) + '</div>' +
                '<div class="kair-v3-kpi__label">' + _esc(label) + '</div>' +
                '<div class="kair-v3-kpi__sub">' + sub + '</div>' +
            '</div>' +
        '</div>';
    }

    function _fieldGrid(label, value, icon) {
        return '<div class="gsa-field">' +
            '<div class="gsa-field__label"><i class="bi ' + icon + '"></i> ' + _esc(label) + '</div>' +
            '<div class="gsa-field__value">' + _esc(value || '—') + '</div>' +
        '</div>';
    }

    function _renderProximos(proximos) {
        var body;
        if (!proximos || proximos.length === 0) {
            body = '<div class="gsa-prox-empty">' +
                '<i class="bi bi-check-circle" style="font-size:1.6rem;display:block;margin-bottom:6px;color:var(--v3-success);"></i>' +
                'Todos los periodos programados están al día.' +
            '</div>';
        } else {
            var items = '';
            for (var i = 0; i < proximos.length; i++) {
                var p = proximos[i];
                var labelMes = _fmtPeriodo(p.periodo);
                var badge = p.vencido
                    ? '<span class="gsa-prox-item__badge vencido">Vencido</span>'
                    : '<span class="gsa-prox-item__badge">Programado</span>';
                var desc = p.vencido
                    ? 'Diligenciar este periodo lo antes posible.'
                    : 'Programado según frecuencia del riesgo (' + _frecuenciaLabel(_state.frecuencia).toLowerCase() + ').';
                var cta = i === 0
                    ? '<button class="gsa-prox-item__cta" data-action="iniciar-seguimiento">' +
                        '<i class="bi bi-play-fill"></i> Iniciar ahora</button>'
                    : '';
                items += '<div class="gsa-prox-item">' +
                    '<div class="gsa-prox-item__icon"><i class="bi bi-calendar-event"></i></div>' +
                    '<div class="gsa-prox-item__body">' +
                        '<div class="gsa-prox-item__title">Seguimiento · Periodo ' + _esc(p.periodo) + '</div>' +
                        '<div class="gsa-prox-item__desc">' + _esc(desc) + '</div>' +
                    '</div>' +
                    badge +
                    cta +
                '</div>';
            }
            body = '<div class="gsa-prox-list">' + items + '</div>';
        }

        return '<div class="gsa-section">' +
            '<div class="gsa-section__head">' +
                '<div>' +
                    '<div class="gsa-section__title"><i class="bi bi-calendar-check"></i> Próximos Seguimientos Programados</div>' +
                    '<div class="gsa-section__sub">Periodos pendientes por diligenciar</div>' +
                '</div>' +
                '<button class="k-btn k-btn-primary k-btn-sm" data-action="iniciar-seguimiento">' +
                    '<i class="bi bi-play-fill"></i> Iniciar ahora</button>' +
            '</div>' +
            '<div class="gsa-section__body">' + body + '</div>' +
        '</div>';
    }

    function _renderHistorial(segs) {
        var body;
        if (!segs || segs.length === 0) {
            body = '<div class="gsa-hist-empty">' +
                '<i class="bi bi-inbox"></i>' +
                'Aún no hay seguimientos registrados para esta gestante.' +
                '<div style="margin-top:14px;">' +
                    '<button class="k-btn k-btn-primary k-btn-sm" data-action="iniciar-seguimiento">' +
                        '<i class="bi bi-plus-lg"></i> Registrar primer seguimiento</button>' +
                '</div>' +
            '</div>';
        } else {
            var items = '';
            for (var i = 0; i < segs.length; i++) {
                var s = segs[i];
                var semLabel = s.semanas ? ' · Semana ' + s.semanas : '';
                var respLabel = s.reportadoPor ? ' · Responsable: ' + _esc(s.reportadoPor) : '';
                items += '<div class="gsa-hist-item">' +
                    '<div class="gsa-hist-item__icon"><i class="bi bi-file-earmark-medical"></i></div>' +
                    '<div class="gsa-hist-item__body">' +
                        '<div class="gsa-hist-item__title">Seguimiento ' + _esc(_fmtPeriodo(s.periodo)) + semLabel + '</div>' +
                        '<div class="gsa-hist-item__meta">' +
                            '<i class="bi bi-calendar-event"></i> ' + _esc(_fmtDate(s.fecha)) +
                            respLabel +
                        '</div>' +
                    '</div>' +
                    _badgeRiesgo(s.clasificacion) +
                    '<span class="gsa-badge gsa-badge--success"><i class="bi bi-check"></i> Completado</span>' +
                '</div>';
            }
            body = '<div class="gsa-hist">' + items + '</div>';
        }

        return '<div class="gsa-section">' +
            '<div class="gsa-section__head">' +
                '<div>' +
                    '<div class="gsa-section__title"><i class="bi bi-clock-history"></i> Historial de Seguimientos</div>' +
                    '<div class="gsa-section__sub">' + (segs.length || 0) + ' registro(s) diligenciado(s) · F-PT-014-04 v01</div>' +
                '</div>' +
            '</div>' +
            '<div class="gsa-section__body">' + body + '</div>' +
        '</div>';
    }

    function _renderInfoClave(g, segs, freq, totalSegs, ultimoSeg, proximos) {
        var diasFPP = _diasHastaFPP(g.fpp);
        var proxResumen = _proximoPeriodoResumen(proximos);

        return '<div class="gsa-section">' +
            '<div class="gsa-section__head">' +
                '<div>' +
                    '<div class="gsa-section__title"><i class="bi bi-info-circle"></i> Información Clave</div>' +
                    '<div class="gsa-section__sub">Resumen operativo</div>' +
                '</div>' +
            '</div>' +
            '<div class="gsa-section__body">' +
                '<div class="gsa-kv">' +
                    '<div class="gsa-kv__k">Clasificación actual</div>' +
                    '<div class="gsa-kv__v">' + ({'bajo':'Bajo Riesgo','alto':'Alto Riesgo','muy-alto':'Muy Alto Riesgo'})[g.clasificacion] + '</div>' +
                    '<div class="gsa-kv__k">Frecuencia requerida</div>' +
                    '<div class="gsa-kv__v">' + _esc(_frecuenciaLabel(freq)) + ' · EMO trimestral</div>' +
                    '<div class="gsa-kv__k">Total Seguimientos</div>' +
                    '<div class="gsa-kv__v">' + totalSegs + ' registro(s)</div>' +
                    '<div class="gsa-kv__k">Último Seguimiento</div>' +
                    '<div class="gsa-kv__v">' + _esc(ultimoSeg ? _fmtDate(ultimoSeg.fecha) : '—') + '</div>' +
                    '<div class="gsa-kv__k">Próximo Seguimiento</div>' +
                    '<div class="gsa-kv__v">' + _esc(proxResumen) + '</div>' +
                    '<div class="gsa-kv__k">Días para FPP</div>' +
                    '<div class="gsa-kv__v">' + (diasFPP != null ? diasFPP + ' días' : '—') + '</div>' +
                '</div>' +
            '</div>' +
        '</div>';
    }

    function _renderConfidencialidad() {
        return '<div class="gsa-section gsa-section--conf">' +
            '<div class="gsa-section__head">' +
                '<div>' +
                    '<div class="gsa-section__title"><i class="bi bi-shield-lock"></i> Confidencialidad</div>' +
                '</div>' +
            '</div>' +
            '<div class="gsa-section__body">' +
                'Documento reservado. Acceso restringido al <strong>Responsable del SG-SST</strong> y a la trabajadora. ' +
                'Conservación mínima: <strong>20 años</strong> (Art. 16 Res. 1843/2025).' +
            '</div>' +
        '</div>';
    }

    // ─── Acciones ───

    /**
     * 📦464 — Ir al wizard mensual de seguimiento.
     * postMessage al parent para que el router cargue
     * gestacion-seguimiento-mensual.html en lugar de esta antesala.
     */
    function _irASeguimientoMensual() {
        if (!window.parent || !window.parent.postMessage) return;
        window.parent.postMessage({
            type: 'ausentismo-home-action',
            action: 'seguimiento-gestacion-mensual',
            payload: { gestanteId: _state.gestanteId, empresaId: _state.empresaId }
        }, '*');
    }

    function _imprimir() {
        window.print();
    }

    /**
     * Exporta a CSV la ficha completa de la gestante + sus seguimientos.
     * Genera un CSV en UTF-8 con BOM para que Excel lo abra bien.
     */
    function _exportarCSV() {
        var g = _state.gestante;
        var segs = _state.seguimientos;
        if (!g) {
            _mostrarToast('warning', 'Sin datos', 'No hay gestante cargada.');
            return;
        }

        var lines = [];
        // Cabecera + datos básicos
        lines.push('# FICHA DE SEGUIMIENTO DE GESTACIÓN');
        lines.push('Nombre,' + _csvField(g.nombre));
        lines.push('Cedula,' + _csvField(g.cedula));
        lines.push('Cargo,' + _csvField(g.cargo));
        lines.push('Empresa,' + _csvField(g.empresa));
        lines.push('Fecha notificación,' + _csvField(g.fechaNotificacion));
        lines.push('FPP,' + _csvField(g.fpp));
        lines.push('Semanas gestación,' + (g.semanasGestacion || 0));
        lines.push('Clasificación,' + _csvField(g.clasificacion));
        lines.push('Estado,' + _csvField(g.estado));
        lines.push('EPS,' + _csvField(g.eps));
        lines.push('ARL,' + _csvField(g.arl));
        lines.push('');
        // Historial
        lines.push('# HISTORIAL DE SEGUIMIENTOS');
        lines.push([
            'Periodo', 'Fecha', 'Semanas', 'Clasificación',
            'Ctrl Asistio', 'Permisos', 'Próxima Cita',
            'Molestia', 'Incapacitada', 'Días Incapacidad', 'Restricciones',
            'Emocional', 'Compatible', 'Ajustes', 'Observaciones', 'Reportado Por'
        ].join(','));
        for (var i = 0; i < segs.length; i++) {
            var s = segs[i];
            lines.push([
                s.periodo || '',
                s.fecha || '',
                s.semanas || 0,
                s.clasificacion || '',
                s.ctrlAsistio || '',
                s.permisos || 0,
                s.proximaCita || '',
                s.molestia || '',
                s.incapacitada || '',
                s.diasIncapacidad || 0,
                s.restricciones || '',
                s.emocional || '',
                s.compatible || '',
                s.ajustes || '',
                _csvField(s.observaciones || ''),
                _csvField(s.reportadoPor || '')
            ].join(','));
        }

        var csv = lines.join('\n');
        var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'ficha_gestacion_' + (g.cedula || 'gestante') + '_' +
            new Date().toISOString().slice(0, 10) + '.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        _mostrarToast('success', 'Exportación completa',
            'Ficha de ' + (g.nombre || 'gestante') + ' descargada.');
    }

    function _csvField(v) {
        var s = String(v == null ? '' : v);
        if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1) {
            return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
    }

    // ─── API expuesta al window ───
    window.irASeguimientoMensual = _irASeguimientoMensual;

    window.volverAlListado = function () {
        if (window.parent && window.parent.postMessage) {
            window.parent.postMessage({
                type: 'ausentismo-home-action',
                action: 'seguimiento-gestacion'
            }, '*');
        }
    };

    window.volverAlHome = function () {
        if (window.parent && window.parent.postMessage) {
            window.parent.postMessage({ type: 'ausentismo-home-action', action: 'main' }, '*');
        }
    };

    // ─── Bind del header estándar ───
    function _bindHeader() {
        var btnBack = document.getElementById('kair-gsa-back');
        if (btnBack) btnBack.addEventListener('click', window.volverAlListado);

        var btnPrint = document.getElementById('kair-gsa-cta-print');
        if (btnPrint) btnPrint.addEventListener('click', _imprimir);

        var btnExport = document.getElementById('kair-gsa-cta-export');
        if (btnExport) btnExport.addEventListener('click', _exportarCSV);

        var btnNew = document.getElementById('kair-gsa-cta-new');
        if (btnNew) btnNew.addEventListener('click', _irASeguimientoMensual);
    }

    /**
     * 📦464 — Aplica el contexto de empresa + gestanteId recibido vía postMessage
     * desde el orquestador (medicion-ausentismo.js → renderGestacionAntesalaView).
     */
    function _applyCompanyContext() {
        window.addEventListener('message', function (event) {
            var data = event.data;
            if (!data || data.type !== 'SET_COMPANY_CONTEXT') return;

            if (data.company) {
                _state.empresaId = data.company;
            }
            if (data.gestanteId) {
                _state.gestanteId = data.gestanteId;
            }

            if (_state.empresaId && _state.gestanteId) {
                _cargarDatos();
            }
        });
    }

    // ─── Init ───
    document.addEventListener('DOMContentLoaded', function () {
        console.log('[GESTACION-ANTESALA] Inicializando antesala de seguimiento (IPC)...');
        _obtenerGestanteIdInicial();
        _bindHeader();
        _applyCompanyContext();

        // Loading inicial (se sobreescribe cuando llegue SET_COMPANY_CONTEXT)
        if (!_state.empresaId || !_state.gestanteId) {
            _renderLoading();
        }
    });

})();