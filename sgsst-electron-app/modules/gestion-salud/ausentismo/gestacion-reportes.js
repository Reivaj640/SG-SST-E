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

    // ═══════════════════════════════════════════════════════════════════
    // 📦472 — HELPERS DE CHARTS (Chart.js v4)
    // Cada helper destruye el chart previo del mismo canvasId antes de
    // crear uno nuevo, para evitar memory leaks al cambiar filtros.
    // ═══════════════════════════════════════════════════════════════════

    var _chartInstances = {};  // canvasId → instancia Chart

    function _destroyChart(canvasId) {
        if (_chartInstances[canvasId]) {
            try { _chartInstances[canvasId].destroy(); } catch (e) {}
            delete _chartInstances[canvasId];
        }
    }

    function _destroyAllCharts() {
        for (var id in _chartInstances) {
            if (_chartInstances.hasOwnProperty(id)) {
                try { _chartInstances[id].destroy(); } catch (e) {}
            }
        }
        _chartInstances = {};
    }

    /** Configurar defaults globales de Chart.js al cargar */
    function _setupChartDefaults() {
        if (typeof Chart === 'undefined') return;
        Chart.defaults.font.family = '"Segoe UI", Roboto, sans-serif';
        Chart.defaults.font.size = 12;
        Chart.defaults.color = '#495057';
        Chart.defaults.plugins.legend.labels.usePointStyle = true;
        Chart.defaults.plugins.legend.labels.padding = 12;
    }

    /**
     * Donut/Doughnut chart con texto central opcional.
     * @param {string} canvasId - ID del <canvas>
     * @param {string[]} labels
     * @param {number[]} values
     * @param {string[]} colors - backgroundColor por segmento
     * @param {object} [opts] - { centerValue, centerLabel, legendPosition }
     */
    function _renderDonut(canvasId, labels, values, colors, opts) {
        opts = opts || {};
        _destroyChart(canvasId);
        var canvas = document.getElementById(canvasId);
        if (!canvas || typeof Chart === 'undefined') return null;

        // Plugin local para texto en el centro
        var centerPlugin = null;
        if (opts.centerValue != null) {
            centerPlugin = {
                id: 'centerText_' + canvasId,
                beforeDraw: function (chart) {
                    var ctx2 = chart.ctx;
                    var area = chart.chartArea;
                    if (!area) return;
                    var cx = (area.left + area.right) / 2;
                    var cy = (area.top + area.bottom) / 2;
                    ctx2.save();
                    ctx2.textAlign = 'center';
                    ctx2.textBaseline = 'middle';
                    ctx2.font = '700 1.8rem "Segoe UI", Roboto, sans-serif';
                    ctx2.fillStyle = '#212529';
                    ctx2.fillText(String(opts.centerValue), cx, cy - 8);
                    if (opts.centerLabel) {
                        ctx2.font = '400 0.7rem "Segoe UI", Roboto, sans-serif';
                        ctx2.fillStyle = '#6c757d';
                        ctx2.fillText(String(opts.centerLabel).toUpperCase(), cx, cy + 14);
                    }
                    ctx2.restore();
                }
            };
        }

        var chart = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: colors,
                    borderColor: '#fff',
                    borderWidth: 2,
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: opts.cutout || '65%',
                plugins: {
                    legend: {
                        position: opts.legendPosition || 'right',
                        labels: {
                            boxWidth: 10,
                            boxHeight: 10,
                            padding: 10
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                var total = context.dataset.data.reduce(function (a, b) { return a + b; }, 0);
                                var pct = total > 0 ? Math.round((context.parsed / total) * 100) : 0;
                                return context.label + ': ' + context.parsed + ' (' + pct + '%)';
                            }
                        }
                    }
                }
            },
            plugins: centerPlugin ? [centerPlugin] : []
        });
        _chartInstances[canvasId] = chart;
        return chart;
    }

    /**
     * Barras horizontales (acorde al preview: Distribución por Área, Acciones).
     * @param {string} canvasId
     * @param {string[]} labels
     * @param {number[]} values
     * @param {string|string[]} color - color único o array por barra
     */
    function _renderHorizontalBars(canvasId, labels, values, color) {
        _destroyChart(canvasId);
        var canvas = document.getElementById(canvasId);
        if (!canvas || typeof Chart === 'undefined') return null;
        var backgroundColor = Array.isArray(color) ? color : (color || '#174ea6');
        var chart = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: backgroundColor,
                    borderRadius: 4,
                    borderSkipped: false,
                    barThickness: 'flex',
                    maxBarThickness: 22
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        grid: { color: '#f1f3f5' },
                        ticks: { precision: 0 }
                    },
                    y: {
                        grid: { display: false },
                        ticks: { font: { size: 11 } }
                    }
                }
            }
        });
        _chartInstances[canvasId] = chart;
        return chart;
    }

    /**
     * Barras verticales STACKED (acorde al preview: Tendencia Mensual).
     * @param {string} canvasId
     * @param {string[]} labels - periodos 'YYYY-MM'
     * @param {Array<{label,data,color}>} datasets
     */
    function _renderStackedBars(canvasId, labels, datasets) {
        _destroyChart(canvasId);
        var canvas = document.getElementById(canvasId);
        if (!canvas || typeof Chart === 'undefined') return null;
        var ds = datasets.map(function (d) {
            return {
                label: d.label,
                data: d.data,
                backgroundColor: d.color,
                borderColor: '#fff',
                borderWidth: 1,
                borderRadius: 3,
                borderSkipped: false
            };
        });
        var chart = new Chart(canvas, {
            type: 'bar',
            data: { labels: labels, datasets: ds },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { boxWidth: 8, boxHeight: 8, padding: 10 } },
                    tooltip: { mode: 'index', intersect: false }
                },
                scales: {
                    x: { stacked: true, grid: { display: false } },
                    y: { stacked: true, beginAtZero: true, grid: { color: '#f1f3f5' }, ticks: { precision: 0 } }
                }
            }
        });
        _chartInstances[canvasId] = chart;
        return chart;
    }

    /**
     * Reemplaza todos los <canvas> de un contenedor por <img> PNG embebido.
     * Útil antes de llamar printToPDF (📦476) porque Chart.js renderiza en canvas
     * y Electron no captura canvas en PDF estático.
     */
    function _captureChartsAsImages(containerId) {
        var container = document.getElementById(containerId);
        if (!container) return 0;
        var canvases = container.querySelectorAll('canvas');
        var n = 0;
        for (var i = 0; i < canvases.length; i++) {
            var canvas = canvases[i];
            try {
                var dataUrl = canvas.toDataURL('image/png');
                var img = document.createElement('img');
                img.src = dataUrl;
                img.style.cssText = 'width:100%;height:100%;display:block;';
                img.setAttribute('data-gr-chart-img', '1');
                img.setAttribute('data-original-canvas-id', canvas.id);
                canvas.parentNode.replaceChild(img, canvas);
                n++;
            } catch (e) {
                console.warn('[REPORTES] No se pudo capturar canvas ' + canvas.id + ':', e.message);
            }
        }
        return n;
    }

    /** Restaura los <img> PNG a <canvas> originales (post-print). */
    function _restoreChartsFromImages(containerId) {
        var container = document.getElementById(containerId);
        if (!container) return 0;
        var imgs = container.querySelectorAll('img[data-gr-chart-img]');
        for (var i = 0; i < imgs.length; i++) {
            var img = imgs[i];
            var canvas = document.createElement('canvas');
            canvas.id = img.getAttribute('data-original-canvas-id');
            canvas.style.cssText = 'max-width:100%;max-height:100%;';
            img.parentNode.replaceChild(canvas, img);
        }
        return imgs.length;
    }

    // ─── Render del contenedor del reporte ───
    function _renderPlaceholderEjecutivo() {
        if (!_state.datosReporte) {
            return '<div class="gr-reporte__placeholder">' +
                '<i class="bi bi-clipboard-data"></i>' +
                '<h3>Reporte Resumen Ejecutivo</h3>' +
                '<p>Este reporte mostrará KPIs agregados, tendencias y alertas críticas para gerencia.</p>' +
            '</div>';
        }
        // 📦474 — Resumen Ejecutivo: versión condensada
        return _renderReporteEjecutivoCompleto(_state.datosReporte);
    }

    function _renderPlaceholderDetallado() {
        if (!_state.datosReporte) {
            return '<div class="gr-reporte__placeholder">' +
                '<i class="bi bi-file-text"></i>' +
                '<h3>Reporte Detallado</h3>' +
                '<p>Este reporte mostrará el informe completo con tabla de seguimientos, gráficos y firma regulatoria.</p>' +
            '</div>';
        }
        // 📦473 — Reporte Detallado: render completo
        return _renderReporteDetalladoCompleto(_state.datosReporte);
    }

    function _renderPlaceholderIndividual() {
        if (!_state.filtros.gestanteId) {
            return '<div class="gr-reporte__placeholder">' +
                '<i class="bi bi-person-vcard"></i>' +
                '<h3>Reporte Individual</h3>' +
                '<p>Seleccione una gestante arriba para ver su historial completo de seguimientos.</p>' +
            '</div>';
        }
        if (!_state.datosReporte) {
            return '<div class="gr-reporte__placeholder">' +
                '<i class="bi bi-arrow-clockwise"></i>' +
                '<h3>Reporte Individual</h3>' +
                '<p>Cargando datos de la gestante…</p>' +
            '</div>';
        }
        // 📦475 — Reporte Individual: ficha + tabla cronológica
        return _renderReporteIndividualCompleto(_state.datosReporte, _state.filtros.gestanteId);
    }

    function _renderReporteLoading() {
        _destroyAllCharts();
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
        _destroyAllCharts();
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

        // 📦472 — Después de inyectar el HTML, renderizar los charts
        _renderDemosChartsSegunTipo();
    }

    /**
     * Renderiza los charts de demo después de inyectar el HTML.
     * Los IDs de canvas son fijos por tipo de reporte.
     */
    function _renderDemosChartsSegunTipo() {
        if (!_state.datosReporte || typeof Chart === 'undefined') return;
        var d = _state.datosReporte;
        // Ejecutivo
        var riesgoEl = document.getElementById('chartDemoRiesgo');
        if (riesgoEl) {
            _renderDonut('chartDemoRiesgo',
                ['Bajo Riesgo', 'Alto Riesgo', 'Muy Alto Riesgo'],
                [d.distribucionRiesgo.bajo, d.distribucionRiesgo.alto, d.distribucionRiesgo.muyAlto],
                ['#28a745', '#f59e0b', '#dc3545'],
                {
                    centerValue: d.distribucionRiesgo.total,
                    centerLabel: 'Total',
                    legendPosition: 'right'
                }
            );
        }
        var areaEl = document.getElementById('chartDemoArea');
        if (areaEl && d.distribucionArea && d.distribucionArea.length > 0) {
            _renderHorizontalBars('chartDemoArea',
                d.distribucionArea.map(function (a) { return a.area; }),
                d.distribucionArea.map(function (a) { return a.count; }),
                '#174ea6'
            );
        }
        // Detallado
        var riesgoDetEl = document.getElementById('chartRiesgoDetallado');
        if (riesgoDetEl) {
            _renderDonut('chartRiesgoDetallado',
                ['Bajo Riesgo', 'Alto Riesgo', 'Muy Alto Riesgo'],
                [d.distribucionRiesgo.bajo, d.distribucionRiesgo.alto, d.distribucionRiesgo.muyAlto],
                ['#28a745', '#f59e0b', '#dc3545'],
                {
                    centerValue: d.distribucionRiesgo.total,
                    centerLabel: 'Total',
                    legendPosition: 'right'
                }
            );
        }
        var estadoDetEl = document.getElementById('chartEstadoDetallado');
        if (estadoDetEl) {
            _renderDonut('chartEstadoDetallado',
                ['Completados', 'Vencidos'],
                [d.distribucionEstado.completados, d.distribucionEstado.vencidos],
                ['#28a745', '#dc3545'],
                { legendPosition: 'right' }
            );
        }
        var tendEl = document.getElementById('chartTendenciaDetallado');
        if (tendEl && d.tendenciaMensual && d.tendenciaMensual.length > 0) {
            var labels = d.tendenciaMensual.map(function (t) { return t.periodo; });
            _renderStackedBars('chartTendenciaDetallado', labels, [
                { label: 'Completados', data: d.tendenciaMensual.map(function (t) { return t.completados; }), color: '#28a745' },
                { label: 'Programados', data: d.tendenciaMensual.map(function (t) { return t.programados; }), color: '#174ea6' },
                { label: 'Vencidos',    data: d.tendenciaMensual.map(function (t) { return t.vencidos; }),    color: '#dc3545' }
            ]);
        }
        var areaDetEl = document.getElementById('chartAreaDetallado');
        if (areaDetEl && d.distribucionArea && d.distribucionArea.length > 0) {
            _renderHorizontalBars('chartAreaDetallado',
                d.distribucionArea.map(function (a) { return a.area; }),
                d.distribucionArea.map(function (a) { return a.count; }),
                '#174ea6'
            );
        }
        var accionesDetEl = document.getElementById('chartAccionesDetallado');
        if (accionesDetEl && d.accionesFrecuentes && d.accionesFrecuentes.length > 0) {
            _renderHorizontalBars('chartAccionesDetallado',
                d.accionesFrecuentes.map(function (a) { return a.accion; }),
                d.accionesFrecuentes.map(function (a) { return a.count; }),
                '#174ea6'
            );
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 📦473 — RENDER COMPLETO DEL REPORTE DETALLADO
    // Replica el preview del usuario: header + banner + KPIs + charts + tabla + alertas + firma
    // ═══════════════════════════════════════════════════════════════════

    /**
     * 📦474 — Reporte Resumen Ejecutivo
     * Versión condensada del Detallado: header + banner + 5 KPIs + resumen narrativo +
     * distribución por riesgo + top alertas + footer. Sin tabla de seguimientos.
     */
    function _renderReporteEjecutivoCompleto(d) {
        var fechaGen = new Date(d.fechaGeneracion);
        var fechaGenStr = fechaGen.toLocaleDateString('es-CO', {
            day: 'numeric', month: 'long', year: 'numeric'
        }) + ' — ' + fechaGen.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
        var topAlertas = (d.alertasCriticas || []).slice(0, 5);
        return '<div class="gr-rep">' +
            // ── Header del documento ──
            '<div class="gr-rep__doc-header">' +
                '<div class="gr-rep__doc-icon"><i class="bi bi-clipboard-data"></i></div>' +
                '<div>' +
                    '<div class="gr-rep__doc-title">K+AIR — Resumen Ejecutivo</div>' +
                    '<div class="gr-rep__doc-subtitle">Visión consolidada para gerencia · F-PT-014-04 v01</div>' +
                '</div>' +
                '<div class="gr-rep__doc-fecha">' +
                    '<div class="gr-rep__doc-fecha-label">Fecha de Generación</div>' +
                    '<div class="gr-rep__doc-fecha-value">' + _esc(fechaGenStr) + '</div>' +
                '</div>' +
            '</div>' +
            // ── Banner confidencialidad ──
            '<div class="gr-rep__confidential">' +
                '<i class="bi bi-lock-fill"></i>' +
                '<div><strong>Documento confidencial</strong> — Conforme a la Ley 1581/2012 y Res. 1843/2025. ' +
                'Distribución restringida al Responsable SG-SST y destinatario autorizado.</div>' +
            '</div>' +
            // ── KPIs principales ──
            '<div class="gr-rep__kpis">' +
                _kpiCard(d.kpis.gestantesActivas, 'Gestantes en seguimiento',
                    d.kpis.gestantesActivas + ' activas', '') +
                _kpiCard(d.kpis.seguimientosCompletados, 'Seguimientos completados',
                    d.kpis.seguimientosProgramados + ' programados', 'success') +
                _kpiCard(d.kpis.seguimientosVencidos, 'Seguimientos vencidos',
                    'requieren atención', d.kpis.seguimientosVencidos > 0 ? 'danger' : '') +
                _kpiCard(d.kpis.cumplimientoFrecuencia + '%', 'Cumplimiento frecuencia',
                    'Tasa finaliz. ' + d.kpis.tasaFinalizacion + '%',
                    d.kpis.cumplimientoFrecuencia >= 80 ? 'success' : (d.kpis.cumplimientoFrecuencia >= 50 ? 'warning' : 'danger')) +
                _kpiCard(d.kpis.alertasCriticas, 'Alertas críticas',
                    'Vencidos + muy alto', d.kpis.alertasCriticas > 0 ? 'danger' : 'success') +
            '</div>' +
            // ── Resumen narrativo ──
            '<div class="gr-rep__section">' +
                '<div class="gr-rep__section-title">Resumen Ejecutivo</div>' +
                '<div class="gr-rep__narrative">' + _renderNarrativeEjecutivo(d) + '</div>' +
            '</div>' +
            // ── Distribución por Riesgo (donut grande) ──
            '<div class="gr-rep__section">' +
                '<div class="gr-rep__section-title">Distribución por Riesgo Obstétrico</div>' +
                '<div class="gr-chart-card">' +
                    '<div class="gr-chart-canvas-wrap" style="height: 300px;">' +
                        '<canvas id="chartDemoRiesgo"></canvas>' +
                        '<div class="gr-chart-center">' +
                            '<div class="gr-chart-center__value">' + d.distribucionRiesgo.total + '</div>' +
                            '<div class="gr-chart-center__label">Total</div>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            // ── Top 5 alertas críticas ──
            '<div class="gr-rep__section">' +
                '<div class="gr-rep__section-title">Top Alertas Críticas (' + topAlertas.length + ')</div>' +
                _renderAlertas(topAlertas) +
                (d.alertasCriticas.length > topAlertas.length
                    ? '<div style="font-size:0.78rem;color:var(--text-muted);text-align:center;margin-top:8px;">' +
                      'Mostrando ' + topAlertas.length + ' de ' + d.alertasCriticas.length + ' alertas. ' +
                      'Ver Reporte Detallado para ver todas.</div>'
                    : '') +
            '</div>' +
            // ── Footer regulatorio ──
            '<div class="gr-rep__firma">' +
                '<div class="gr-rep__firma-block">' +
                    '<div class="gr-rep__firma-label">Responsable del SG-SST</div>' +
                    '<div class="gr-rep__firma-nombre">Mg. Carlos Andrés Perdomo</div>' +
                    '<div class="gr-rep__firma-cargo">Responsable SG-SST — ' + _esc((d.empresa && d.empresa.id) || 'ASEL S.A.S.') + '</div>' +
                '</div>' +
                '<div class="gr-rep__firma-block">' +
                    '<div class="gr-rep__firma-label">Periodo del Reporte</div>' +
                    '<div class="gr-rep__firma-nombre">' + _esc(_fmtLongDate(d.periodo.desde)) + '</div>' +
                    '<div class="gr-rep__firma-cargo">al ' + _esc(_fmtLongDate(d.periodo.hasta)) + '</div>' +
                '</div>' +
            '</div>' +
        '</div>';
    }

    /**
     * 📦475 — Reporte Individual
     * Ficha completa de 1 gestante con todos sus seguimientos cronológicos.
     */
    function _renderReporteIndividualCompleto(d, gestanteId) {
        var fechaGen = new Date(d.fechaGeneracion);
        var fechaGenStr = fechaGen.toLocaleDateString('es-CO', {
            day: 'numeric', month: 'long', year: 'numeric'
        });
        var g = (d.gestantes && d.gestantes.length > 0) ? d.gestantes[0] : null;
        var segs = (d.detalleSeguimientos || []).filter(function (s) { return s.gestanteId === gestanteId; });

        var fichaHtml = '<div style="background:white;border:1px solid var(--v3-border);border-radius:8px;padding:16px;margin-bottom:20px;">';
        if (g) {
            fichaHtml += '<div style="display:grid;grid-template-columns:auto 1fr;gap:16px;align-items:flex-start;">' +
                '<div style="width:64px;height:64px;border-radius:50%;background:var(--v3-primary-soft);color:var(--v3-primary);display:flex;align-items:center;justify-content:center;font-size:1.4rem;font-weight:700;">' +
                    _esc((g.nombre || '?').split(' ').map(function (p) { return p[0] || ''; }).slice(0, 2).join('').toUpperCase()) +
                '</div>' +
                '<div>' +
                    '<div style="font-size:1.1rem;font-weight:700;color:var(--text-dark);">' + _esc(g.nombre) + '</div>' +
                    '<div style="font-size:0.82rem;color:var(--text-muted);margin-top:2px;">CC ' + _esc(g.cedula) + '</div>' +
                    '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px 24px;margin-top:12px;font-size:0.82rem;">' +
                        '<div><strong>Cargo:</strong> ' + _esc(g.cargo || '—') + '</div>' +
                        '<div><strong>Área:</strong> ' + _esc(g.area || '—') + '</div>' +
                        '<div><strong>Empresa:</strong> ' + _esc(g.empresaNombre || g.empresa || '—') + '</div>' +
                        '<div><strong>Cliente:</strong> ' + _esc(g.empresaCliente || '—') + '</div>' +
                        '<div><strong>FPP:</strong> ' + _esc(_fmtDate(g.fpp)) + '</div>' +
                        '<div><strong>Estado:</strong> ' + _esc(g.estado) + '</div>' +
                        '<div><strong>Clasificación:</strong> ' + _esc(g.clasificacion) + '</div>' +
                        '<div><strong>EPS:</strong> ' + _esc(g.eps || '—') + '</div>' +
                    '</div>' +
                '</div>' +
            '</div>';
            // Bloque fechas ciclo de vida
            var fechasVida = '';
            if (g.fechaNotificacion) fechasVida += '<div><strong>Notificación:</strong> ' + _esc(_fmtDate(g.fechaNotificacion)) + '</div>';
            if (g.fechaInicioLicencia) fechasVida += '<div><strong>Inicio licencia:</strong> ' + _esc(_fmtDate(g.fechaInicioLicencia)) + '</div>';
            if (g.fechaFinLicencia) fechasVida += '<div><strong>Fin licencia:</strong> ' + _esc(_fmtDate(g.fechaFinLicencia)) + '</div>';
            if (g.fechaInicioReintegro) fechasVida += '<div><strong>Inicio reintegro:</strong> ' + _esc(_fmtDate(g.fechaInicioReintegro)) + '</div>';
            if (g.fechaFinReintegro) fechasVida += '<div><strong>Fin reintegro:</strong> ' + _esc(_fmtDate(g.fechaFinReintegro)) + '</div>';
            if (g.fechaSuspension) fechasVida += '<div><strong>Suspensión:</strong> ' + _esc(_fmtDate(g.fechaSuspension)) + '</div>';
            if (fechasVida) {
                fichaHtml += '<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--v3-border);display:grid;grid-template-columns:repeat(3,1fr);gap:6px 24px;font-size:0.82rem;">' +
                    fechasVida +
                '</div>';
            }
        } else {
            fichaHtml += '<div style="color:var(--text-muted);">No se encontraron datos de la gestante.</div>';
        }
        fichaHtml += '</div>';

        return '<div class="gr-rep">' +
            // ── Header del documento ──
            '<div class="gr-rep__doc-header">' +
                '<div class="gr-rep__doc-icon"><i class="bi bi-person-vcard"></i></div>' +
                '<div>' +
                    '<div class="gr-rep__doc-title">K+AIR — Reporte Individual</div>' +
                    '<div class="gr-rep__doc-subtitle">Historial completo de trabajadora en seguimiento · F-PT-014-04 v01</div>' +
                '</div>' +
                '<div class="gr-rep__doc-fecha">' +
                    '<div class="gr-rep__doc-fecha-label">Fecha de Generación</div>' +
                    '<div class="gr-rep__doc-fecha-value">' + _esc(fechaGenStr) + '</div>' +
                '</div>' +
            '</div>' +
            // ── Banner confidencialidad ──
            '<div class="gr-rep__confidential">' +
                '<i class="bi bi-lock-fill"></i>' +
                '<div><strong>Documento confidencial</strong> — Ley 1581/2012 + Res. 1843/2025. ' +
                'Información reservada del SG-SST. Distribución restringida.</div>' +
            '</div>' +
            // ── Ficha de la gestante ──
            '<div class="gr-rep__section">' +
                '<div class="gr-rep__section-title">Datos de la Gestante</div>' +
                fichaHtml +
            '</div>' +
            // ── Resumen cronológico ──
            '<div class="gr-rep__section">' +
                '<div class="gr-rep__section-title">Historial de Seguimientos (' + segs.length + ')</div>' +
                '<div class="gr-rep__table-wrap">' + _renderTablaDetalle(segs) + '</div>' +
            '</div>' +
            // ── Footer regulatorio ──
            '<div class="gr-rep__firma">' +
                '<div class="gr-rep__firma-block">' +
                    '<div class="gr-rep__firma-label">Responsable del SG-SST</div>' +
                    '<div class="gr-rep__firma-nombre">Mg. Carlos Andrés Perdomo</div>' +
                    '<div class="gr-rep__firma-cargo">Responsable SG-SST — ' + _esc((d.empresa && d.empresa.id) || 'ASEL S.A.S.') + '</div>' +
                '</div>' +
                '<div class="gr-rep__firma-block">' +
                    '<div class="gr-rep__firma-label">Periodo del Reporte</div>' +
                    '<div class="gr-rep__firma-nombre">' + _esc(_fmtLongDate(d.periodo.desde)) + '</div>' +
                    '<div class="gr-rep__firma-cargo">al ' + _esc(_fmtLongDate(d.periodo.hasta)) + '</div>' +
                '</div>' +
            '</div>' +
        '</div>';
    }

    function _badgeRiesgo(c) {
        if (c === 'alto') return '<span class="gr-rep__badge alto">Alto Riesgo</span>';
        if (c === 'muy-alto') return '<span class="gr-rep__badge muy-alto">Muy Alto Riesgo</span>';
        return '<span class="gr-rep__badge bajo">Bajo Riesgo</span>';
    }

    function _badgeEstadoSeg(s) {
        if (s === 'VENCIDO') return '<span class="gr-rep__badge vencido">VENCIDO</span>';
        return '<span class="gr-rep__badge completado">COMPLETADO</span>';
    }

    function _renderReporteDetalladoCompleto(d) {
        var fechaGen = new Date(d.fechaGeneracion);
        var fechaGenStr = fechaGen.toLocaleDateString('es-CO', {
            day: 'numeric', month: 'long', year: 'numeric'
        }) + ' a las ' + fechaGen.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

        var html = '<div class="gr-rep">' +
            // ── Header del documento ──
            '<div class="gr-rep__doc-header">' +
                '<div class="gr-rep__doc-icon"><i class="bi bi-heart-pulse"></i></div>' +
                '<div>' +
                    '<div class="gr-rep__doc-title">K+AIR — Reporte Detallado</div>' +
                    '<div class="gr-rep__doc-subtitle">Seguimiento de Trabajadoras en Estado de Gestación · F-PT-014-04 v01</div>' +
                '</div>' +
                '<div class="gr-rep__doc-fecha">' +
                    '<div class="gr-rep__doc-fecha-label">Fecha de Generación</div>' +
                    '<div class="gr-rep__doc-fecha-value">' + _esc(fechaGenStr) + '</div>' +
                '</div>' +
            '</div>' +
            // ── Metadata ──
            '<div class="gr-rep__meta">' +
                '<div class="gr-rep__meta-item"><i class="bi bi-calendar-event"></i>' +
                    '<div><div class="gr-rep__meta-label">Periodo</div>' +
                    '<div class="gr-rep__meta-value">' + _esc(_fmtLongDate(d.periodo.desde)) + ' — ' + _esc(_fmtLongDate(d.periodo.hasta)) + '</div></div>' +
                '</div>' +
                '<div class="gr-rep__meta-item"><i class="bi bi-building"></i>' +
                    '<div><div class="gr-rep__meta-label">Empresa</div>' +
                    '<div class="gr-rep__meta-value">' + _esc(d.empresa && d.empresa.nombre ? d.empresa.nombre : (d.empresa && d.empresa.id) || '—') + '</div></div>' +
                '</div>' +
                '<div class="gr-rep__meta-item"><i class="bi bi-shield-exclamation"></i>' +
                    '<div><div class="gr-rep__meta-label">Riesgos</div>' +
                    '<div class="gr-rep__meta-value">' + _esc(d.filtros && d.filtros.riesgo ? d.filtros.riesgo : 'Todos') + '</div></div>' +
                '</div>' +
            '</div>' +
            // ── Banner confidencialidad ──
            '<div class="gr-rep__confidential">' +
                '<i class="bi bi-lock-fill"></i>' +
                '<div><strong>Reporte confidencial</strong> — Conforme a la Ley 1581/2012 y Res. 1843/2025. ' +
                'Este documento contiene información reservada del SG-SST. NO incluye datos clínicos sensibles. ' +
                'Distribución restringida al Responsable SG-SST y al destinatario autorizado.</div>' +
            '</div>' +
            // ── KPIs principales ──
            '<div class="gr-rep__kpis">' +
                _kpiCard(d.kpis.gestantesActivas, 'Gestantes en seguimiento',
                    (d.kpis.gestantesEnSeguimiento || 0) + ' activas', '') +
                _kpiCard(d.kpis.seguimientosCompletados, 'Seguimientos en periodo',
                    d.kpis.seguimientosProgramados + ' programados', 'success') +
                _kpiCard(d.kpis.seguimientosVencidos, 'Seguimientos vencidos',
                    d.kpis.alertasCriticas + ' alertas', d.kpis.seguimientosVencidos > 0 ? 'danger' : '') +
                _kpiCard(d.kpis.cumplimientoFrecuencia + '%', 'Cumplimiento frecuencia',
                    'Tasa finaliz. ' + d.kpis.tasaFinalizacion + '%',
                    d.kpis.cumplimientoFrecuencia >= 80 ? 'success' : (d.kpis.cumplimientoFrecuencia >= 50 ? 'warning' : 'danger')) +
                _kpiCard(d.kpis.alertasCriticas, 'Alertas críticas',
                    'Vencidos + muy alto', d.kpis.alertasCriticas > 0 ? 'danger' : 'success') +
            '</div>' +
            // ── 1. Resumen ejecutivo ──
            '<div class="gr-rep__section">' +
                '<div class="gr-rep__section-title">1. Resumen Ejecutivo</div>' +
                '<div class="gr-rep__narrative">' +
                    _renderNarrativeEjecutivo(d) +
                '</div>' +
            '</div>' +
            // ── 2. Distribución por Riesgo + Estado de Seguimientos ──
            '<div class="gr-rep__section">' +
                '<div class="gr-rep__section-title">2. Distribución por Riesgo y Estado</div>' +
                '<div class="gr-chart-grid">' +
                    '<div class="gr-chart-card">' +
                        '<div class="gr-chart-card__title"><i class="bi bi-pie-chart"></i> Distribución por Riesgo Obstétrico</div>' +
                        '<div class="gr-chart-canvas-wrap">' +
                            '<canvas id="chartRiesgoDetallado"></canvas>' +
                            '<div class="gr-chart-center">' +
                                '<div class="gr-chart-center__value">' + d.distribucionRiesgo.total + '</div>' +
                                '<div class="gr-chart-center__label">Total</div>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="gr-chart-card">' +
                        '<div class="gr-chart-card__title"><i class="bi bi-pie-chart-fill"></i> Estado de Seguimientos</div>' +
                        '<div class="gr-chart-canvas-wrap">' +
                            '<canvas id="chartEstadoDetallado"></canvas>' +
                            '<div class="gr-chart-center">' +
                                '<div class="gr-chart-center__value">' + d.kpis.seguimientosCompletados + '</div>' +
                                '<div class="gr-chart-center__label">Total</div>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
                '<div style="font-size:0.78rem;color:var(--text-muted);margin-top:6px;">' +
                    'La distribución del riesgo determina la frecuencia requerida: bajo (mensual), alto (quincenal), ' +
                    'muy alto (semanal con notificación ARL si origen laboral).' +
                '</div>' +
            '</div>' +
            // ── 3. Tendencia Mensual ──
            '<div class="gr-rep__section">' +
                '<div class="gr-rep__section-title">3. Tendencia Mensual de Seguimientos</div>' +
                '<div class="gr-chart-card">' +
                    '<div class="gr-chart-canvas-wrap gr-chart-canvas-wrap--tall">' +
                        '<canvas id="chartTendenciaDetallado"></canvas>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            // ── 4. Distribución por Área ──
            '<div class="gr-rep__section">' +
                '<div class="gr-rep__section-title">4. Distribución por Área</div>' +
                '<div class="gr-chart-card">' +
                    '<div class="gr-chart-canvas-wrap gr-chart-canvas-wrap--tall">' +
                        '<canvas id="chartAreaDetallado"></canvas>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            // ── 5. Acciones más frecuentes ──
            '<div class="gr-rep__section">' +
                '<div class="gr-rep__section-title">5. Acciones Más Frecuentes</div>' +
                '<div class="gr-chart-card">' +
                    '<div class="gr-chart-canvas-wrap gr-chart-canvas-wrap--tall">' +
                        '<canvas id="chartAccionesDetallado"></canvas>' +
                    '</div>' +
                    '<div class="gr-rep__totales-grid">' +
                        _totalCard('bi-calendar2-check', d.totalesAcciones.permisos, 'Permisos otorgados') +
                        _totalCard('bi-clipboard2-pulse', d.totalesAcciones.diasIncapacidad, 'Días incapacidad') +
                        _totalCard('bi-sliders', d.totalesAcciones.ajustes, 'Ajustes de puesto') +
                        _totalCard('bi-arrow-left-right', d.totalesAcciones.reubicaciones, 'Reubicaciones') +
                    '</div>' +
                '</div>' +
            '</div>' +
            // ── 6. Alertas Críticas ──
            '<div class="gr-rep__section">' +
                '<div class="gr-rep__section-title">6. Alertas Críticas (' + d.alertasCriticas.length + ')</div>' +
                _renderAlertas(d.alertasCriticas) +
            '</div>' +
            // ── 7. Detalle de Seguimientos ──
            '<div class="gr-rep__section">' +
                '<div class="gr-rep__section-title">7. Detalle de Seguimientos</div>' +
                '<div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:8px;">' +
                    d.detalleSeguimientos.length + ' registro(s) en el periodo evaluado</div>' +
                '<div class="gr-rep__table-wrap">' +
                    _renderTablaDetalle(d.detalleSeguimientos) +
                '</div>' +
            '</div>' +
            // ── 8. Firma y validación ──
            '<div class="gr-rep__firma">' +
                '<div class="gr-rep__firma-block">' +
                    '<div class="gr-rep__firma-label">Responsable del SG-SST</div>' +
                    '<div class="gr-rep__firma-nombre">Mg. Carlos Andrés Perdomo</div>' +
                    '<div class="gr-rep__firma-cargo">Responsable SG-SST — ' + _esc((d.empresa && d.empresa.id) || 'ASEL S.A.S.') + '</div>' +
                '</div>' +
                '<div class="gr-rep__firma-block">' +
                    '<div class="gr-rep__firma-label">Fecha de Generación</div>' +
                    '<div class="gr-rep__firma-nombre">' + _esc(fechaGen.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })) + '</div>' +
                    '<div class="gr-rep__firma-cargo">Documento confidencial — Conservar 20 años</div>' +
                '</div>' +
            '</div>' +
            '<div style="font-size:0.78rem;color:var(--text-muted);margin-top:8px;padding-top:8px;border-top:1px solid var(--v3-border);">' +
                'Este reporte es generado automáticamente por el sistema K+AIR SG-SST y constituye un documento auditor conforme a la Resolución 1843/2025.' +
            '</div>' +
        '</div>';
        return html;
    }

    function _kpiCard(value, label, sub, valueClass) {
        return '<div class="gr-rep__kpi">' +
            '<div class="gr-rep__kpi-value ' + (valueClass || '') + '">' + _esc(value) + '</div>' +
            '<div class="gr-rep__kpi-label">' + _esc(label) + '</div>' +
            (sub ? '<div class="gr-rep__kpi-sub">' + _esc(sub) + '</div>' : '') +
        '</div>';
    }

    function _totalCard(icon, value, label) {
        return '<div class="gr-rep__total-card">' +
            '<i class="bi ' + icon + '"></i>' +
            '<div><div class="gr-rep__total-card-value">' + _esc(value) + '</div>' +
            '<div class="gr-rep__total-card-label">' + _esc(label) + '</div></div>' +
        '</div>';
    }

    function _renderNarrativeEjecutivo(d) {
        var narr = 'Durante el periodo evaluado se realizaron <strong>' + d.kpis.seguimientosCompletados +
            ' seguimientos</strong> a <strong>' + d.kpis.gestantesActivas +
            ' trabajadoras en estado de gestación</strong>';
        if (d.gestantes && d.gestantes.length > 0) {
            var enReintegro = d.gestantes.filter(function (g) { return g.estado === 'reintegro'; }).length;
            if (enReintegro > 0) {
                narr += ', de las cuales <strong>' + d.kpis.gestantesActivas + ' se encuentran activas</strong> y <strong>' +
                    enReintegro + ' en proceso de reintegro</strong>';
            }
        }
        narr += '. El nivel de cumplimiento de la frecuencia esperada de seguimiento (según clasificación de riesgo obstétrico) alcanzó un <strong>' +
            d.kpis.cumplimientoFrecuencia + '%</strong>';
        if (d.kpis.seguimientosVencidos > 0) {
            narr += '. Se identificaron <span class="crit">' + d.kpis.seguimientosVencidos +
                ' seguimiento(s) vencido(s)</span> que requieren atención inmediata';
        }
        if (d.kpis.alertasCriticas > 0) {
            narr += '. Adicionalmente, se registran <span class="crit">' + d.kpis.alertasCriticas +
                ' alertas críticas</span> que se detallan en la sección correspondiente';
        }
        narr += '.';
        return narr;
    }

    function _renderAlertas(alertas) {
        if (!alertas || alertas.length === 0) {
            return '<div style="padding:14px;color:var(--text-muted);font-size:0.88rem;">' +
                'No se registran alertas críticas en el periodo evaluado.' +
            '</div>';
        }
        var html = '';
        for (var i = 0; i < alertas.length; i++) {
            var a = alertas[i];
            html += '<div class="gr-rep__alerta">' +
                '<strong>' + _esc(a.gestante) + '</strong><br>' +
                '<strong>' + _esc(a.tipo) + '</strong> — ' + _esc(a.mensaje) +
                (a.fecha ? '<br><small>Fecha: ' + _esc(_fmtLongDate(a.fecha)) + '</small>' : '') +
            '</div>';
        }
        return html;
    }

    function _renderTablaDetalle(detalle) {
        if (!detalle || detalle.length === 0) {
            return '<div style="padding:20px;text-align:center;color:var(--text-muted);">' +
                'No hay seguimientos registrados en el periodo.' +
            '</div>';
        }
        var html = '<table class="gr-rep__table">' +
            '<thead><tr>' +
            '<th>Trabajadora</th><th>Cargo / Área</th><th>Periodo</th><th>Fecha</th>' +
            '<th>Riesgo</th><th>Sem.</th><th>Estado</th><th>Controles</th>' +
            '<th>Permisos</th><th>Emocional</th><th>Acciones</th>' +
            '</tr></thead><tbody>';
        for (var i = 0; i < detalle.length; i++) {
            var d = detalle[i];
            var cargoArea = (d.cargo ? _esc(d.cargo) : '—') +
                (d.area ? '<br><small style="color:var(--text-muted);">' + _esc(d.area) + '</small>' : '');
            html += '<tr>' +
                '<td><strong>' + _esc(d.gestante) + '</strong><br><small style="color:var(--text-muted);">' + _esc(d.cedula || '') + '</small></td>' +
                '<td>' + cargoArea + '</td>' +
                '<td>' + _esc(d.periodo) + '</td>' +
                '<td>' + _esc(_fmtDate(d.fecha)) + '</td>' +
                '<td>' + _badgeRiesgo(d.riesgo) + '</td>' +
                '<td>' + _esc(d.semanas || 0) + '</td>' +
                '<td>' + _badgeEstadoSeg(d.estado) + '</td>' +
                '<td>' + _esc(d.controles || '—') + '</td>' +
                '<td style="text-align:center;">' + _esc(d.permisos || 0) + '</td>' +
                '<td>' + _esc(d.emocional || '—') + '</td>' +
                '<td style="text-align:center;">' + _esc(d.acciones || 0) + ' acción(es)</td>' +
            '</tr>';
        }
        html += '</tbody></table>';
        return html;
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
        console.log('[REPORTES-GESTACION] Inicializando vista de reportes (📦472 charts)...');
        _setupChartDefaults();
        _renderReporte();
        _actualizarBotonesExportar();
        _bindHeader();
        _applyCompanyContext();
    });

})();