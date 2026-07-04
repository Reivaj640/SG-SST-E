/* ═══════════════════════════════════════════════════════════════════
   K+AIR · Reportes de Seguimiento de Gestación — Vista principal
   📦471 (2026-07-04) — Layout + filtros + selector de tipo
   - Datos desde window.electronAPI.gestacionCalcularReporte (📦469)
   - 3 tipos: ejecutivo · detallado · individual
   - Placeholders de render; el contenido concreto viene en 📦473/474/475
   ═══════════════════════════════════════════════════════════════════ */

(function () {
    'use strict';

    // ─── Estado privado ───
    var _state = {
        empresaId: null,
        tipoReporte: 'ejecutivo',     // 'ejecutivo' | 'detallado' | 'individual'
        filtros: {
            periodo: 'ultimoTrimestre',
            fechaDesde: '',
            fechaHasta: '',
            riesgos: ['bajo', 'alto', 'muy-alto'],   // array de riesgos activos
            gestanteId: ''
        },
        datosReporte: null,            // respuesta del IPC gestacionCalcularReporte
        loading: false,
        error: null,
        periodoLabel: 'Último trimestre',
        // Lista de gestantes disponibles (para Individual) — se carga al cambiar tipo
        gestantesDisponibles: []
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

    function _fmtLongDate(iso) {
        if (!iso) return '—';
        try {
            var d = new Date(iso + 'T00:00:00');
            return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
        } catch (e) { return iso; }
    }

    function _setSyncBadge(state) {
        var badge = document.getElementById('kair-gr-sync');
        if (!badge) return;
        badge.classList.remove('k-sync-synced', 'k-sync-saving', 'k-sync-error');
        if (state === 'saving') {
            badge.classList.add('k-sync-saving');
            badge.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Cargando…';
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

    function _riesgosActivos() {
        var chips = document.querySelectorAll('.gr-risk-chip.active');
        var result = [];
        for (var i = 0; i < chips.length; i++) {
            result.push(chips[i].getAttribute('data-riesgo'));
        }
        return result;
    }

    // ─── Render del contenedor del reporte (PLACEHOLDERS — 📦473/474/475 los reemplazan) ───
    function _renderPlaceholderEjecutivo() {
        return '<div class="gr-reporte__placeholder">' +
            '<i class="bi bi-clipboard-data"></i>' +
            '<h3>Reporte Resumen Ejecutivo</h3>' +
            '<p>Este reporte mostrará KPIs agregados, tendencias y alertas críticas para gerencia. ' +
            'El render con gráficos y visualizaciones se activa en <strong>📦474</strong>.</p>' +
            (_state.datosReporte
                ? '<p style="margin-top: 14px; font-size: 0.78rem; color: var(--v3-primary);">Datos cargados OK — KPIs: ' +
                    _state.datosReporte.kpis.gestantesActivas + ' activas · ' +
                    _state.datosReporte.kpis.seguimientosCompletados + ' seguimientos · ' +
                    _state.datosReporte.kpis.seguimientosVencidos + ' vencidos</p>'
                : ''
            ) +
        '</div>';
    }

    function _renderPlaceholderDetallado() {
        return '<div class="gr-reporte__placeholder">' +
            '<i class="bi bi-file-text"></i>' +
            '<h3>Reporte Detallado</h3>' +
            '<p>Este reporte mostrará el informe completo con tabla de todos los seguimientos, ' +
            'gráficos de distribución y firma regulatoria. El render con visualizaciones se activa en <strong>📦473</strong>.</p>' +
        '</div>';
    }

    function _renderPlaceholderIndividual() {
        if (!_state.filtros.gestanteId) {
            return '<div class="gr-reporte__placeholder">' +
                '<i class="bi bi-person-vcard"></i>' +
                '<h3>Reporte Individual</h3>' +
                '<p>Seleccione una gestante arriba para ver su historial completo de seguimientos.</p>' +
            '</div>';
        }
        return '<div class="gr-reporte__placeholder">' +
            '<i class="bi bi-person-vcard"></i>' +
            '<h3>Reporte Individual</h3>' +
            '<p>El historial completo de seguimientos para la gestante seleccionada se renderiza en <strong>📦475</strong>.</p>' +
        '</div>';
    }

    function _renderReporteLoading() {
        var c = document.getElementById('grReporteContainer');
        if (c) c.innerHTML = '<div class="gr-reporte__loading">' +
            '<i class="bi bi-arrow-clockwise"></i>' +
            '<div>Calculando métricas del reporte…</div>' +
        '</div>';
    }

    function _renderReporte() {
        var c = document.getElementById('grReporteContainer');
        if (!c) return;
        if (_state.loading) {
            _renderReporteLoading();
            return;
        }
        if (_state.error) {
            c.innerHTML = '<div class="gr-reporte__placeholder">' +
                '<i class="bi bi-exclamation-triangle" style="color: var(--v3-destructive);"></i>' +
                '<h3>Error al calcular el reporte</h3>' +
                '<p>' + _esc(_state.error) + '</p>' +
            '</div>';
            return;
        }
        if (_state.tipoReporte === 'ejecutivo') c.innerHTML = _renderPlaceholderEjecutivo();
        else if (_state.tipoReporte === 'detallado') c.innerHTML = _renderPlaceholderDetallado();
        else c.innerHTML = _renderPlaceholderIndividual();
    }

    // ─── Selector de tipo de reporte ───
    function seleccionarTipoReporte(tipo, btnEl) {
        if (!tipo) return;
        _state.tipoReporte = tipo;
        // Actualizar UI de las 3 cards
        var cards = document.querySelectorAll('.gr-tipo');
        for (var i = 0; i < cards.length; i++) cards[i].classList.remove('active');
        if (btnEl) btnEl.classList.add('active');
        // Mostrar/ocultar selector de gestante (solo Individual)
        var gestField = document.getElementById('grGestanteField');
        if (gestField) gestField.style.display = (tipo === 'individual') ? '' : 'none';
        // Resetear selección de gestante si cambió de Individual a otro
        if (tipo !== 'individual') {
            _state.filtros.gestanteId = '';
        } else {
            _cargarGestantesDisponibles();
        }
        // Activar/desactivar botones de exportar (solo si hay datos)
        _actualizarBotonesExportar();
        // Refrescar reporte
        if (tipo === 'individual' && !_state.filtros.gestanteId) {
            _renderReporte();
            return;
        }
        aplicarFiltrosReportes();
    }

    function toggleRiesgo(riesgo, btnEl) {
        if (!btnEl) return;
        btnEl.classList.toggle('active');
        _state.filtros.riesgos = _riesgosActivos();
    }

    // ─── Aplicar filtros + IPC ───
    async function aplicarFiltrosReportes() {
        if (!_state.empresaId) return;
        // Sincronizar filtros desde inputs
        _state.filtros.periodo = document.getElementById('grPeriodo').value || 'ultimoTrimestre';
        if (_state.filtros.periodo === 'custom') {
            _state.filtros.fechaDesde = document.getElementById('grFechaDesde').value || '';
            _state.filtros.fechaHasta = document.getElementById('grFechaHasta').value || '';
        } else {
            _state.filtros.fechaDesde = '';
            _state.filtros.fechaHasta = '';
        }
        _state.filtros.gestanteId = document.getElementById('grGestanteSelect').value || '';
        _state.filtros.riesgos = _riesgosActivos();

        // Para "Individual" sin gestante seleccionada, solo renderizar placeholder
        if (_state.tipoReporte === 'individual' && !_state.filtros.gestanteId) {
            _state.datosReporte = null;
            _renderReporte();
            _actualizarBotonesExportar();
            return;
        }

        _state.loading = true;
        _state.error = null;
        _setSyncBadge('saving');
        _renderReporte();

        try {
            // Para "Detallado" o "Ejecutivo" queremos el reporte completo (sin filtro de gestante)
            // Para "Individual" pasamos gestanteId
            var filtrosIPC = {
                periodo: _state.filtros.periodo,
                fechaDesde: _state.filtros.fechaDesde,
                fechaHasta: _state.filtros.fechaHasta,
                gestanteId: (_state.tipoReporte === 'individual') ? _state.filtros.gestanteId : null
            };
            // Si hay 1 solo riesgo activo, lo pasamos; si están todos, null
            if (_state.filtros.riesgos.length === 1) {
                filtrosIPC.riesgo = _state.filtros.riesgos[0];
            }

            var res = await window.electronAPI.gestacionCalcularReporte({
                empresaId: _state.empresaId,
                filtros: filtrosIPC
            });

            if (res && res.success) {
                _state.datosReporte = res.data;
                _state.periodoLabel = (res.data.periodo && res.data.periodo.etiqueta) || 'Período';
                _state.error = null;
            } else {
                _state.error = (res && res.error && res.error.message) || 'Error desconocido';
                _mostrarToast('error', 'Error al calcular reporte', _state.error);
            }
        } catch (e) {
            _state.error = e.message || String(e);
            _mostrarToast('error', 'Error de conexión', _state.error);
        } finally {
            _state.loading = false;
            _setSyncBadge(_state.error ? 'error' : 'synced');
            _renderReporte();
            _actualizarBotonesExportar();
        }
    }

    // ─── Cargar lista de gestantes (para Individual) ───
    async function _cargarGestantesDisponibles() {
        try {
            var res = await window.electronAPI.gestacionListarGestantes({ empresaId: _state.empresaId });
            if (res && res.success && Array.isArray(res.data)) {
                _state.gestantesDisponibles = res.data;
                var sel = document.getElementById('grGestanteSelect');
                if (sel) {
                    // Limpiar opciones excepto la primera
                    sel.innerHTML = '<option value="">— Elija una gestante —</option>';
                    for (var i = 0; i < res.data.length; i++) {
                        var g = res.data[i];
                        var opt = document.createElement('option');
                        opt.value = g.id;
                        opt.textContent = g.nombre + ' · CC ' + g.cedula + ' (' + g.estado + ')';
                        sel.appendChild(opt);
                    }
                    if (_state.filtros.gestanteId) sel.value = _state.filtros.gestanteId;
                }
            }
        } catch (e) {
            console.warn('[REPORTES] No se pudo cargar lista de gestantes:', e.message);
        }
    }

    // ─── Mostrar/ocultar campos de fechas según periodo ───
    function _toggleFechasCustom() {
        var periodo = document.getElementById('grPeriodo').value;
        var desdeField = document.getElementById('grFechaDesdeField');
        var hastaField = document.getElementById('grFechaHastaField');
        if (periodo === 'custom') {
            if (desdeField) desdeField.style.display = '';
            if (hastaField) hastaField.style.display = '';
        } else {
            if (desdeField) desdeField.style.display = 'none';
            if (hastaField) hastaField.style.display = 'none';
        }
    }

    // ─── Activar/desactivar botones de exportar ───
    function _actualizarBotonesExportar() {
        var btnExcel = document.getElementById('kair-gr-export-excel');
        var btnPrint = document.getElementById('kair-gr-print');
        var hayDatos = !!_state.datosReporte;
        // Para Individual, también necesitamos gestante seleccionada
        if (_state.tipoReporte === 'individual' && !_state.filtros.gestanteId) hayDatos = false;
        if (btnExcel) btnExcel.disabled = !hayDatos;
        if (btnPrint) btnPrint.disabled = !hayDatos;
    }

    // ─── Bind del header estándar ───
    function _bindHeader() {
        var btnBack = document.getElementById('kair-gr-back');
        if (btnBack) btnBack.addEventListener('click', volverAlHome);
        // Periodo change → mostrar/ocultar fechas custom
        var selPeriodo = document.getElementById('grPeriodo');
        if (selPeriodo) selPeriodo.addEventListener('change', _toggleFechasCustom);
    }

    // ─── Contexto de empresa + carga inicial ───
    function _applyCompanyContext() {
        window.addEventListener('message', function (event) {
            var data = event.data;
            if (data && data.type === 'SET_COMPANY_CONTEXT' && data.company) {
                _state.empresaId = data.company;
                var bcEl = document.getElementById('kair-gr-bc-company');
                if (bcEl) bcEl.textContent = data.company;
                _toggleFechasCustom();
                aplicarFiltrosReportes();
            }
        });
    }

    // ─── API pública expuesta al window ───
    window.seleccionarTipoReporte = seleccionarTipoReporte;
    window.toggleRiesgo = toggleRiesgo;
    window.aplicarFiltrosReportes = aplicarFiltrosReportes;
    window.volverAlHome = function () {
        if (window.parent && window.parent.postMessage) {
            window.parent.postMessage({ type: 'ausentismo-home-action', action: 'seguimiento-gestacion' }, '*');
        }
    };
    // 📦476 — Stubs de exportar (se implementan en ese commit)
    window.exportarExcelReportes = function () {
        if (!_state.datosReporte) return;
        _mostrarToast('info', 'Exportar Excel', 'Funcionalidad disponible en 📦476');
    };
    window.imprimirReportes = function () {
        if (!_state.datosReporte) return;
        _mostrarToast('info', 'Imprimir / PDF', 'Funcionalidad disponible en 📦476');
    };

    // ─── Init ───
    document.addEventListener('DOMContentLoaded', function () {
        console.log('[REPORTES-GESTACION] Inicializando vista de reportes (📦471 layout)...');
        _renderReporte();
        _actualizarBotonesExportar();
        _bindHeader();
        _applyCompanyContext();
    });

})();