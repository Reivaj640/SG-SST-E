/**
 * archivo-retencion-dashboard.js
 * Dashboard de métricas para el submódulo 2.5.1 — Gestión Documental
 *
 * Se comunica con el componente padre (iframe → parent) mediante postMessage
 * para obtener las estadísticas calculadas por el backend.
 */

(function () {
    'use strict';

    // ── Helpers ──
    function $(sel) { return document.querySelector(sel); }

    // Chart instances
    let chartTipo = null;
    let chartOrigen = null;
    let chartDisposicion = null;
    let chartAnual = null;

    // ── Comunicación con el padre (postMessage bridge) ──
    function callParentAPI(type, payload) {
        return new Promise((resolve, reject) => {
            const requestId = `ar-dash-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const timeout = setTimeout(() => {
                window.removeEventListener('message', handler);
                reject(new Error('Timeout esperando respuesta del padre'));
            }, 10000);

            function handler(event) {
                const response = event.data;
                if (response && response.requestId === requestId && response.type === `${type}-response`) {
                    clearTimeout(timeout);
                    window.removeEventListener('message', handler);
                    resolve(response.payload);
                }
            }

            window.addEventListener('message', handler);
            window.parent.postMessage({ type: `${type}-request`, payload, requestId }, '*');
        });
    }

    // ── Cargar datos ──
    async function loadDashboard() {
        try {
            const stats = await callParentAPI('get-archivo-retencion-stats', {});

            if (!stats || !stats.success || !stats.data) {
                showError(stats?.error?.message || 'No se pudieron cargar las estadísticas.');
                return;
            }

            renderDashboard(stats.data);
        } catch (err) {
            console.error('[AR Dashboard] Error cargando datos:', err);
            showError(err.message);
        }
    }

    function showError(message) {
        $('#loading-state').style.display = 'none';
        const content = $('#dashboard-content');
        content.style.display = 'block';
        content.innerHTML = `
            <div style="text-align:center;padding:3rem;color:var(--danger);">
                <i class="bi bi-exclamation-triangle" style="font-size:2.5rem;"></i>
                <p style="margin-top:1rem;font-size:1.1rem;">${message}</p>
            </div>
        `;
    }

    // ── Renderizar KPIs ──
    function renderKPIs(data) {
        $('#kpi-total').textContent = data.total;
        $('#kpi-vigencia').textContent = `${data.porcentajeVigencia}%`;
        $('#kpi-vigentes-sub').textContent = `${data.vigentes} documentos activos`;
        $('#kpi-externos').textContent = data.tipoExterno;
        $('#kpi-obsoletos').textContent = data.obsoletos;
        $('#kpi-sin-actualizar').textContent =
            `${data.sinActualizar2Anios} sin actualizar en +2 años`;
    }

    // ── Renderizar gráficos ──
    function renderCharts(data) {
        const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#174ea6';
        const successColor = getComputedStyle(document.documentElement).getPropertyValue('--success').trim() || '#28a745';
        const warningColor = getComputedStyle(document.documentElement).getPropertyValue('--warning').trim() || '#ffc107';
        const dangerColor = getComputedStyle(document.documentElement).getPropertyValue('--danger').trim() || '#dc3545';
        const infoColor = getComputedStyle(document.documentElement).getPropertyValue('--info').trim() || '#17a2b8';
        const mutedColor = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#6c757d';

        // Chart 1: Documentos vs Registros (Donut)
        if (chartTipo) chartTipo.destroy();
        chartTipo = new Chart($('#chartTipo'), {
            type: 'doughnut',
            data: {
                labels: ['Documentos', 'Registros'],
                datasets: [{
                    data: [data.tipoDoc, data.tipoReg],
                    backgroundColor: [primaryColor, successColor],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                cutout: '65%',
                plugins: {
                    legend: { position: 'bottom', labels: { padding: 16 } }
                }
            }
        });

        // Chart 2: Interno vs Externo (Donut)
        if (chartOrigen) chartOrigen.destroy();
        chartOrigen = new Chart($('#chartOrigen'), {
            type: 'doughnut',
            data: {
                labels: ['Interno', 'Externo'],
                datasets: [{
                    data: [data.tipoInterno, data.tipoExterno],
                    backgroundColor: [warningColor, infoColor],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                cutout: '65%',
                plugins: {
                    legend: { position: 'bottom', labels: { padding: 16 } }
                }
            }
        });

        // Chart 3: Disposición Final (Bar)
        const dispLabels = [];
        const dispValues = [];
        const dispColors = [];
        if (data.vigentes > 0) { dispLabels.push('Vigente'); dispValues.push(data.vigentes); dispColors.push(successColor); }
        if (data.obsoletos > 0) { dispLabels.push('Obsoleto'); dispValues.push(data.obsoletos); dispColors.push(dangerColor); }
        if (data.muertos > 0) { dispLabels.push('Muerto'); dispValues.push(data.muertos); dispColors.push(mutedColor); }

        if (chartDisposicion) chartDisposicion.destroy();
        chartDisposicion = new Chart($('#chartDisposicion'), {
            type: 'bar',
            data: {
                labels: dispLabels,
                datasets: [{
                    label: 'Cantidad',
                    data: dispValues,
                    backgroundColor: dispColors,
                    borderRadius: 6,
                    maxBarThickness: 80
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
                    x: { grid: { display: false } }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });

        // Chart 4: Actualizaciones por Año (Line)
        const aniosOrdenados = Object.keys(data.actualizacionesPorAnio).sort();
        const aniosLabels = aniosOrdenados;
        const aniosValues = aniosOrdenados.map(a => data.actualizacionesPorAnio[a]);

        if (chartAnual) chartAnual.destroy();
        chartAnual = new Chart($('#chartAnual'), {
            type: 'line',
            data: {
                labels: aniosLabels,
                datasets: [{
                    label: 'Actualizaciones',
                    data: aniosValues,
                    borderColor: primaryColor,
                    backgroundColor: primaryColor + '22',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    pointBackgroundColor: primaryColor,
                    borderWidth: 2.5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { stepSize: 1 } },
                    x: { grid: { display: false } }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }

    // ── Render completo ──
    function renderDashboard(data) {
        $('#loading-state').style.display = 'none';
        $('#dashboard-content').style.display = 'block';

        renderKPIs(data);
        // Esperar a que Chart.js esté listo
        setTimeout(() => renderCharts(data), 150);
    }

    // ── Init ──
    document.addEventListener('DOMContentLoaded', loadDashboard);
})();
