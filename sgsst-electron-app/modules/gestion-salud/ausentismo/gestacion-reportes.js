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
                    '<div class="gr-rep__firma-nombre">Esp. Gerencia de Proyectos Javier Robles Fontalvo</div>' +
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
                    '<div class="gr-rep__firma-nombre">Esp. Gerencia de Proyectos Javier Robles Fontalvo</div>' +
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
                    '<div class="gr-rep__firma-nombre">Esp. Gerencia de Proyectos Javier Robles Fontalvo</div>' +
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
        // 📦481 — Bind de botones de exportación (estaban sin listener)
        var btnExportExcel = document.getElementById('kair-gr-export-excel');
        if (btnExportExcel) btnExportExcel.addEventListener('click', window.exportarExcelReportes);
        var btnPrint = document.getElementById('kair-gr-print');
        if (btnPrint) btnPrint.addEventListener('click', window.imprimirReportes);
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
        if (!_state.datosReporte) {
            _mostrarToast('warning', 'Sin datos', 'No hay datos para exportar.');
            return;
        }
        exportarExcelReportes();
    };
    window.imprimirReportes = function () {
        if (!_state.datosReporte) {
            _mostrarToast('warning', 'Sin datos', 'No hay datos para imprimir.');
            return;
        }
        imprimirReportesPDF();
    };

    // ═══════════════════════════════════════════════════════════════════
    // 📦476 — EXPORTACIÓN (Excel + PDF)
    // Excel: renderer-puro (sin IPC), genera CSV con BOM UTF-8 (consistente con
    //   gestacion-seguimiento-home.js:_exportarCSV y otros 5+ módulos del proyecto).
    // PDF: usa window.electronAPI.printInformeToPdf (handler existente en
    //   main.js:4734) con el truco de canvas→img para capturar los charts
    //   de Chart.js antes de la impresión.
    // ═══════════════════════════════════════════════════════════════════

    function exportarExcelReportes() {
        var d = _state.datosReporte;
        var tipo = _state.tipoReporte;
        var headers, rows;

        if (tipo === 'individual') {
            // 1 hoja con datos personales + tabla de seguimientos
            headers = ['Trabajadora', 'Cédula', 'Cargo', 'Área', 'Empresa', 'Cliente',
                'Estado', 'Clasificación', 'FPP', 'Notificación',
                'Periodo', 'Fecha', 'Semanas', 'Estado Seg.', 'Permisos', 'Emocional', 'Acciones'];
            rows = [headers.join(',')];
            var segs = (d.detalleSeguimientos || []).filter(function (s) {
                return s.gestanteId === _state.filtros.gestanteId;
            });
            var g = (d.gestantes && d.gestantes[0]) || {};
            for (var i = 0; i < segs.length; i++) {
                var s = segs[i];
                rows.push([
                    _csvField(g.nombre || s.gestante),
                    g.cedula || s.cedula || '',
                    _csvField(g.cargo || s.cargo),
                    _csvField(g.area || s.area),
                    _csvField(g.empresaNombre || g.empresa || ''),
                    _csvField(g.empresaCliente || s.empresaCliente),
                    g.estado || '',
                    g.clasificacion || s.riesgo,
                    g.fpp || '',
                    g.fechaNotificacion || '',
                    s.periodo || '',
                    s.fecha || '',
                    s.semanas || 0,
                    s.estado || '',
                    s.permisos || 0,
                    s.emocional || '',
                    s.acciones || 0
                ].join(','));
            }
        } else {
            // Ejecutivo o Detallado: 1 hoja con KPIs + tabla detalle
            // Cabecera con metadatos del reporte
            rows = [
                'Reporte,' + (tipo === 'ejecutivo' ? 'Resumen Ejecutivo' : 'Detallado'),
                'Empresa,' + _csvField((d.empresa && (d.empresa.nombre || d.empresa.id)) || ''),
                'Periodo,' + _csvField(d.periodo.etiqueta || '') + ' (' + d.periodo.desde + ' a ' + d.periodo.hasta + ')',
                'Generado,' + _csvField(new Date(d.fechaGeneracion).toLocaleString('es-CO')),
                '',
                'KPIS',
                'Gestantes activas,' + d.kpis.gestantesActivas,
                'Seguimientos completados,' + d.kpis.seguimientosCompletados,
                'Seguimientos programados,' + d.kpis.seguimientosProgramados,
                'Seguimientos vencidos,' + d.kpis.seguimientosVencidos,
                'Cumplimiento frecuencia (%),' + d.kpis.cumplimientoFrecuencia,
                'Tasa finalización (%),' + d.kpis.tasaFinalizacion,
                'Alertas críticas,' + d.kpis.alertasCriticas,
                'Promedio bienestar emocional,' + d.kpis.promedioBienestarEmocional.formato,
                '',
                'DISTRIBUCIÓN POR RIESGO',
                'Bajo Riesgo,' + d.distribucionRiesgo.bajo,
                'Alto Riesgo,' + d.distribucionRiesgo.alto,
                'Muy Alto Riesgo,' + d.distribucionRiesgo.muyAlto,
                '',
                'DISTRIBUCIÓN POR ÁREA'
            ];
            for (var k = 0; k < d.distribucionArea.length; k++) {
                rows.push(d.distribucionArea[k].area + ',' + d.distribucionArea[k].count);
            }
            rows.push('');
            rows.push('DETALLE DE SEGUIMIENTOS');
            rows.push(['Trabajadora', 'Cédula', 'Cargo', 'Área', 'Cliente',
                'Periodo', 'Fecha', 'Riesgo', 'Semanas', 'Estado', 'Permisos', 'Emocional', 'Acciones'].join(','));
            for (var j = 0; j < d.detalleSeguimientos.length; j++) {
                var x = d.detalleSeguimientos[j];
                rows.push([
                    _csvField(x.gestante),
                    x.cedula || '',
                    _csvField(x.cargo),
                    _csvField(x.area),
                    _csvField(x.empresaCliente),
                    x.periodo || '',
                    x.fecha || '',
                    x.riesgo || '',
                    x.semanas || 0,
                    x.estado || '',
                    x.permisos || 0,
                    x.emocional || '',
                    x.acciones || 0
                ].join(','));
            }
        }

        var csv = rows.join('\n');
        // BOM para que Excel respete UTF-8
        var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        var tipoLabel = tipo === 'ejecutivo' ? 'ejecutivo' : (tipo === 'individual' ? 'individual' : 'detallado');
        var fechaHoy = new Date().toISOString().slice(0, 10);
        a.download = 'reporte-gestacion-' + tipoLabel + '-' + fechaHoy + '.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        _mostrarToast('success', 'Exportación completa',
            'Se descargaron ' + (d.detalleSeguimientos.length || 0) + ' registros.');
    }

    function _csvField(s) {
        if (s == null) return '';
        return '"' + String(s).replace(/"/g, '""') + '"';
    }

    /**
     * Imprimir/guardar como PDF usando el handler `print-informe-to-pdf` (main.js:4734).
     * Estrategia:
     *   1. Obtener carpeta Downloads del usuario (vía IPC `getDownloadsPath`)
     *   2. Capturar charts como <img> PNG (canvas→img) antes de imprimir
     *   3. Construir HTML autocontenido con CSS embebido + header K+AIR
     *   4. Llamar window.electronAPI.printInformeToPdf con carpeta + filename válidos
     *   5. Restaurar canvas originales (re-renderizar charts) después
     */
    function imprimirReportesPDF() {
        var d = _state.datosReporte;
        var tipo = _state.tipoReporte;
        var container = document.getElementById('grReporteContainer');
        if (!container) return;

        _setSyncBadge('saving');

        // Paso 1: obtener carpeta destino (Downloads del usuario) vía IPC
        window.electronAPI.getDownloadsPath().then(function (pathResult) {
            if (!pathResult || !pathResult.success) {
                _setSyncBadge('error');
                _mostrarToast('error', 'Error al obtener carpeta destino',
                    (pathResult && pathResult.error) || 'No se pudo resolver la carpeta de descargas.');
                return;
            }
            var targetFolder = pathResult.path;

            // Paso 2: capturar charts como imágenes
            var n = _captureChartsAsImages('grReporteContainer');

            // Paso 3: construir HTML autocontenido
            var tipoLabel = tipo === 'ejecutivo' ? 'Resumen Ejecutivo' : (tipo === 'individual' ? 'Reporte Individual' : 'Reporte Detallado');
            var filename = 'reporte-gestacion-' + tipo + '-' + new Date().toISOString().slice(0, 10) + '.pdf';
            var htmlContent = _buildHtmlForPdf(container.innerHTML, tipoLabel, d);

            // Paso 4: enviar al backend con carpeta + filename válidos
            return window.electronAPI.printInformeToPdf({
                html: htmlContent,
                filename: filename,
                targetFolder: targetFolder
            }).then(function (result) {
                _setSyncBadge(result && result.success ? 'synced' : 'error');
                if (result && result.success) {
                    _mostrarToast('success', 'PDF generado', 'Guardado en: ' + (result.path || filename));
                } else {
                    _mostrarToast('warning', 'Imprimir cancelado o error',
                        (result && result.error) || 'El usuario canceló o hubo un error.');
                }
                return n;
            });
        }).catch(function (err) {
            _setSyncBadge('error');
            _mostrarToast('error', 'Error al generar PDF', err.message || String(err));
        }).then(function (n) {
            // Paso 5: restaurar canvas originales (si los hubo)
            if (n && n > 0) {
                _restoreChartsFromImages('grReporteContainer');
                _renderDemosChartsSegunTipo();
            }
        });
    }

    /**
     * Construye HTML autocontenido para el PDF: replica el contenido pero con
     * estilos CSS completos embebidos (printToPDF no carga el CSS del HTML original).
     */
    function _buildHtmlForPdf(contenidoReporte, tipoLabel, d) {
        var fechaGen = new Date(d.fechaGeneracion).toLocaleString('es-CO');
        return '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">' +
            '<title>K+AIR — ' + tipoLabel + '</title>' +
            '<style>' + _pdfCss() + '</style>' +
            '</head><body>' +
            '<div class="pdf-header">' +
                '<div class="pdf-header__logo">K+AIR · SG-SST</div>' +
                '<div class="pdf-header__title">' + _esc(tipoLabel) + '</div>' +
                '<div class="pdf-header__date">' + _esc(fechaGen) + '</div>' +
            '</div>' +
            contenidoReporte +
            '</body></html>';
    }

    function _pdfCss() {
        // CSS mínimo necesario para que el PDF se vea similar a la vista
        return '' +
            '@page { size: A4 portrait; margin: 12mm; }' +
            '* { box-sizing: border-box; }' +
            'body { font-family: "Segoe UI", Roboto, sans-serif; color: #212529; font-size: 10pt; margin: 0; }' +
            '.pdf-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 2px solid #174ea6; margin-bottom: 14px; }' +
            '.pdf-header__logo { font-weight: 700; color: #174ea6; font-size: 11pt; }' +
            '.pdf-header__title { font-weight: 600; font-size: 13pt; color: #174ea6; }' +
            '.pdf-header__date { color: #6c757d; font-size: 9pt; }' +
            '.gr-rep__doc-header { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 2px solid #174ea6; margin-bottom: 12px; }' +
            '.gr-rep__doc-icon { width: 40px; height: 40px; background: #174ea6; color: #fff; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; }' +
            '.gr-rep__doc-title { font-size: 14pt; font-weight: 700; color: #174ea6; }' +
            '.gr-rep__doc-subtitle { font-size: 9pt; color: #6c757d; margin-top: 2px; }' +
            '.gr-rep__doc-fecha { margin-left: auto; text-align: right; }' +
            '.gr-rep__doc-fecha-label { font-size: 8pt; color: #6c757d; text-transform: uppercase; letter-spacing: 0.05em; }' +
            '.gr-rep__doc-fecha-value { font-size: 10pt; font-weight: 600; margin-top: 2px; }' +
            '.gr-rep__meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; padding: 10px 12px; background: #f8f9fa; border-radius: 6px; margin-bottom: 14px; font-size: 9pt; }' +
            '.gr-rep__meta-item { display: flex; align-items: flex-start; gap: 6px; }' +
            '.gr-rep__meta-label { font-size: 7pt; color: #6c757d; text-transform: uppercase; }' +
            '.gr-rep__meta-value { font-weight: 500; margin-top: 2px; }' +
            '.gr-rep__confidential { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 10px 14px; margin-bottom: 14px; display: flex; gap: 10px; font-size: 9pt; color: #78350f; line-height: 1.5; }' +
            '.gr-rep__confidential i { color: #f59e0b; font-size: 1.1rem; }' +
            '.gr-rep__confidential strong { font-weight: 700; }' +
            '.gr-rep__kpis { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 18px; }' +
            '.gr-rep__kpi { background: #fff; border: 1px solid #dee2e6; border-radius: 6px; padding: 10px 12px; text-align: center; }' +
            '.gr-rep__kpi-value { font-size: 18pt; font-weight: 700; line-height: 1.1; }' +
            '.gr-rep__kpi-value.success { color: #28a745; }' +
            '.gr-rep__kpi-value.warning { color: #b45309; }' +
            '.gr-rep__kpi-value.danger { color: #dc3545; }' +
            '.gr-rep__kpi-label { font-size: 8pt; color: #6c757d; margin-top: 4px; text-transform: uppercase; }' +
            '.gr-rep__kpi-sub { font-size: 7pt; color: #6c757d; margin-top: 2px; }' +
            '.gr-rep__section { margin-bottom: 14px; page-break-inside: avoid; }' +
            '.gr-rep__section-title { font-size: 10pt; font-weight: 700; color: #174ea6; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid #e8f0fe; }' +
            '.gr-rep__narrative { background: #fff; border: 1px solid #dee2e6; border-radius: 6px; padding: 12px 14px; line-height: 1.5; font-size: 10pt; }' +
            '.gr-rep__narrative strong { color: #174ea6; }' +
            '.gr-rep__narrative .crit { color: #dc3545; font-weight: 600; }' +
            '.gr-chart-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 12px; }' +
            '.gr-chart-grid--single { grid-template-columns: 1fr; }' +
            '.gr-chart-card { background: #fff; border: 1px solid #dee2e6; border-radius: 6px; padding: 12px 14px; page-break-inside: avoid; }' +
            '.gr-chart-card__title { font-size: 9pt; font-weight: 700; color: #174ea6; text-transform: uppercase; margin-bottom: 8px; }' +
            '.gr-chart-canvas-wrap, .gr-chart-canvas-wrap--tall { position: relative; width: 100%; height: 200px; }' +
            '.gr-chart-canvas-wrap--tall { height: 240px; }' +
            '.gr-chart-canvas-wrap img { width: 100%; height: 100%; object-fit: contain; }' +
            '.gr-chart-center { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; pointer-events: none; }' +
            '.gr-chart-center__value { font-size: 18pt; font-weight: 700; line-height: 1.1; }' +
            '.gr-chart-center__label { font-size: 7pt; color: #6c757d; text-transform: uppercase; }' +
            '.gr-rep__table-wrap { overflow: visible; background: #fff; border: 1px solid #dee2e6; border-radius: 6px; }' +
            '.gr-rep__table { width: 100%; border-collapse: collapse; font-size: 8pt; }' +
            '.gr-rep__table th { background: #f8f9fa; color: #6c757d; font-size: 7pt; font-weight: 700; text-transform: uppercase; padding: 8px 10px; text-align: left; border-bottom: 1px solid #dee2e6; }' +
            '.gr-rep__table td { padding: 7px 10px; border-bottom: 1px solid #f1f3f5; vertical-align: middle; }' +
            '.gr-rep__table tr:last-child td { border-bottom: none; }' +
            '.gr-rep__badge { display: inline-block; padding: 2px 7px; border-radius: 999px; font-size: 7pt; font-weight: 600; white-space: nowrap; }' +
            '.gr-rep__badge.bajo { background: rgba(40,167,69,0.1); color: #155724; }' +
            '.gr-rep__badge.alto { background: rgba(255,193,7,0.1); color: #856404; }' +
            '.gr-rep__badge.muy-alto { background: rgba(220,53,69,0.1); color: #721c24; }' +
            '.gr-rep__badge.completado { background: rgba(40,167,69,0.1); color: #155724; }' +
            '.gr-rep__badge.vencido { background: rgba(220,53,69,0.1); color: #721c24; }' +
            '.gr-rep__alerta { background: rgba(220,53,69,0.08); border-left: 3px solid #dc3545; padding: 8px 12px; margin-bottom: 6px; border-radius: 4px; font-size: 9pt; }' +
            '.gr-rep__alerta strong { color: #dc3545; }' +
            '.gr-rep__totales-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 10px; }' +
            '.gr-rep__total-card { background: #fff; border: 1px solid #dee2e6; border-radius: 6px; padding: 8px 10px; display: flex; align-items: center; gap: 8px; }' +
            '.gr-rep__total-card-value { font-size: 12pt; font-weight: 700; }' +
            '.gr-rep__total-card-label { font-size: 7pt; color: #6c757d; text-transform: uppercase; }' +
            '.gr-rep__firma { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 14px 0; border-top: 2px solid #dee2e6; margin-top: 18px; }' +
            '.gr-rep__firma-block { padding: 12px 14px; background: #f8f9fa; border-radius: 6px; }' +
            '.gr-rep__firma-label { font-size: 8pt; color: #6c757d; text-transform: uppercase; margin-bottom: 4px; }' +
            '.gr-rep__firma-nombre { font-size: 11pt; font-weight: 700; margin-top: 20px; }' +
            '.gr-rep__firma-cargo { font-size: 8pt; color: #6c757d; margin-top: 2px; }';
    }

    // ─── Init ───
    document.addEventListener('DOMContentLoaded', function () {
        console.log('[REPORTES-GESTACION] Inicializando vista de reportes (📦479 scroll fixed)...');
        _setupChartDefaults();
        _renderReporte();
        _actualizarBotonesExportar();
        _bindHeader();
        _applyCompanyContext();
        _setupScrollIndicators();  /* 📦479 */
        // 📦478-fix — Log de diagnóstico: confirmar altura computada
        setTimeout(function () {
            var main = document.querySelector('.gr-main');
            if (main) {
                var rect = main.getBoundingClientRect();
                console.log('[REPORTES-GESTACION] .gr-main dims:', {
                    width: rect.width,
                    height: rect.height,
                    scrollHeight: main.scrollHeight,
                    clientHeight: main.clientHeight,
                    overflowY: getComputedStyle(main).overflowY,
                    hasMore: main.scrollHeight > main.clientHeight
                });
            }
        }, 500);
    });

    /**
     * 📦480 — Indicadores visuales de scroll (estrategia nueva: BODY scrollea).
     * - El botón flotante "ir arriba" hace scrollTo sobre document.documentElement.
     * - Indicador "has-more" se aplica al body para el gradient fade.
     * - ResizeObserver observa al body para recalcular cuando cambian los charts.
     */
    function _setupScrollIndicators() {
        // Botón flotante "ir arriba"
        var btn = document.createElement('button');
        btn.id = 'grScrollTopBtn';
        btn.innerHTML = '<i class="bi bi-arrow-up"></i>';
        btn.title = 'Ir al inicio';
        btn.style.cssText = [
            'position: fixed',
            'bottom: 24px',
            'right: 36px',
            'width: 44px',
            'height: 44px',
            'border-radius: 50%',
            'background: #174ea6',
            'color: #fff',
            'border: none',
            'box-shadow: 0 4px 12px rgba(0,0,0,0.25)',
            'cursor: pointer',
            'font-size: 1.1rem',
            'z-index: 99999',
            'display: none',
            'align-items: center',
            'justify-content: center',
            'transition: opacity 0.2s, transform 0.2s'
        ].join(';');
        btn.addEventListener('click', function () {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        btn.addEventListener('mouseenter', function () { btn.style.transform = 'translateY(-2px)'; });
        btn.addEventListener('mouseleave', function () { btn.style.transform = 'translateY(0)'; });
        document.body.appendChild(btn);

        function _getScrollState() {
            var doc = document.documentElement;
            var scrollTop = window.scrollY || doc.scrollTop;
            var scrollHeight = Math.max(
                document.body.scrollHeight, doc.scrollHeight,
                document.body.offsetHeight, doc.offsetHeight,
                document.body.clientHeight, doc.clientHeight
            );
            var clientHeight = window.innerHeight || doc.clientHeight;
            return {
                scrollTop: scrollTop,
                scrollHeight: scrollHeight,
                clientHeight: clientHeight,
                hasMore: scrollHeight - scrollTop - clientHeight > 4
            };
        }

        function _update() {
            var s = _getScrollState();
            var isAtTop = s.scrollTop < 200;
            if (s.hasMore) {
                document.body.classList.add('gr-main--has-more');
            } else {
                document.body.classList.remove('gr-main--has-more');
            }
            btn.style.display = isAtTop ? 'none' : 'flex';
        }

        window.addEventListener('scroll', _update);
        // ResizeObserver en el body (los charts cambian altura async)
        if (typeof ResizeObserver !== 'undefined') {
            new ResizeObserver(_update).observe(document.body);
        }
        // Chequeos iniciales
        setTimeout(_update, 500);
        setTimeout(_update, 1500);
        setTimeout(_update, 3000);
    }

})();