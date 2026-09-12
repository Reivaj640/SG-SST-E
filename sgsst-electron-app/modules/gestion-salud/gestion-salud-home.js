// gestion-salud-home.js - Componente para el home del módulo "Gestión de la Salud"

// === SHIM: KairSkeleton desde ventana padre si no esta definido localmente ===
// Los iframes no heredan los globales del padre automaticamente; este puente
// evita el error "KairSkeleton is not defined" en vistas cargadas dentro de iframes.
if (typeof window.KairSkeleton === 'undefined' && typeof parent !== 'undefined' && parent !== window && parent.window && parent.window.KairSkeleton) {
  window.KairSkeleton = parent.window.KairSkeleton;
}

// Caché global para persistencia entre navegaciones de la misma sesión
if (!window._saludHomeState) {
    window._saludHomeState = {
        cache: new Map(), // companyName -> data
        lastUpdate: new Map() // companyName -> timestamp
    };
}

class GestionSaludHome {
    constructor(container, moduleName, submodules, companyName) {
        this.container = container;
        this.moduleName = moduleName;
        this.submodules = submodules;
        // 📦748 · Aceptar currentCompany como parámetro del shell (más robusto que solo getCurrentCompany()).
        this.currentCompany = companyName || this.getCurrentCompany();
        this.widgets = {}; // Referencias a elementos de widgets para actualización reactiva
    }

    getCurrentCompany() {
        if (window.currentCompany && window.currentCompany !== 'default_company') return window.currentCompany;
        if (window.rendererState && window.rendererState.selectedCompany) return window.rendererState.selectedCompany;
        if (window.currentModule && window.currentModule.company) return window.currentModule.company;
        const domCompany = document.getElementById('company-name');
        if (domCompany && domCompany.textContent && domCompany.textContent !== 'Empresa') return domCompany.textContent.trim();
        return localStorage.getItem('currentCompanyName') || 'default_company';
    }

    async render() {
        this.container.innerHTML = '';
        this.currentCompany = this.getCurrentCompany();

        // 1. Inyectar Estilos K+AIR
        this.injectStyles();

        // 2. Layout
        const layout = document.createElement('div');
        layout.className = 'k-app-layout';
        layout.style.height = '100%';

        // Header
        const header = document.createElement('header');
        header.className = 'k-module-header';
        header.innerHTML = `
            <div class="k-module-title">
                <span class="k-module-title-icon" style="color: #212529;">${SIDEBAR_ICONS.heart_pulse}</span>
                <div>
                    <div style="color: #212529; font-weight: 600;">Módulo Gestión de la Salud</div>
                    <span style="font-size: 0.75rem; font-weight: 400; color: #6c757d;">
                        ${this.currentCompany} / Gestión de la Salud
                    </span>
                </div>
            </div>
        `;
        layout.appendChild(header);

        // Contenedor Principal
        const contentContainer = document.createElement('div');
        contentContainer.className = 'gestion-salud-home';
        contentContainer.id = 'app-container';

        // Área Principal
        const mainArea = document.createElement('div');
        mainArea.className = 'main-area';
        mainArea.style.flex = '1';

        // 📦491 — Skeleton mientras cargan las 6 estadísticas de Gestión Salud en paralelo (6 widgets + 2 bar/line charts)
        mainArea.innerHTML = KairSkeleton.kpiStrip(6) + KairSkeleton.chartBars(12) + KairSkeleton.chartBars(12);

        contentContainer.appendChild(mainArea);
        layout.appendChild(contentContainer);
        this.container.appendChild(layout);

        // 3. Cargar estadísticas ANTES de pintar widgets (main.js tiene caché de disco)
        await this.refreshStats();

        // 4. Renderizar contenido con datos reales
        this.renderMainArea(mainArea);
    }

    /**
     * Refresca las estadísticas en segundo plano y actualiza los widgets existentes.
     */
    async refreshStats() {
        const company = this.currentCompany;
        console.log(`[SALUD] Refrescando estadísticas para ${company}...`);

        try {
            // Ejecutar peticiones en paralelo (main.js responderá rápido gracias a su caché de archivos)
      const [recursosResult, ausResult, accResult, examResult, segResult, remResult, indicadoresResult] = await Promise.all([
        window.electronAPI.getRecursosStats(company),
        window.electronAPI.getAusentismoStats(company, 'year'),
        window.electronAPI.getAccidentesStats(company),
        window.electronAPI.getExamenesStats(company),
        window.electronAPI.getSaludSeguimientosStats(company),
        window.electronAPI.getRemisionesStats(company),
        window.electronAPI.getIndicadoresSaludStats(company)
      ]);

      const newData = {
        inducciones: recursosResult.success ? recursosResult.stats.inducciones : null,
        ausentismo: ausResult.success ? ausResult.data : null,
        accidentes: accResult.success ? accResult.data : null,
        examenes: examResult.success ? examResult.data : null,
        seguimientos: segResult.success ? segResult.data : null,
        remisiones: remResult.success ? remResult.data : null,
        indicadores: indicadoresResult.success ? indicadoresResult.data : null
      };

            // Guardar en caché de sesión
            window._saludHomeState.cache.set(company, newData);
            window._saludHomeState.lastUpdate.set(company, Date.now());

            // Actualizar widgets si el componente sigue montado
            this.updateWidgetsUI(newData);

        } catch (error) {
            console.error('[SALUD] Error refrescando estadísticas:', error);
        }
    }

    updateWidgetsUI(data) {
        if (!data) return;

        // Actualizar Inducciones
        if (data.inducciones && this.widgets.inducciones) {
            this.widgets.inducciones.update(data.inducciones);
        }
        // Actualizar Ausentismo
        if (data.ausentismo && this.widgets.ausentismo) {
            this.widgets.ausentismo.update(data.ausentismo);
        }
        // Actualizar Accidentes
        if (data.accidentes && this.widgets.accidentes) {
            this.widgets.accidentes.update(data.accidentes);
        }
        // Actualizar Exámenes
        if (data.examenes && this.widgets.examenes) {
            this.widgets.examenes.update(data.examenes);
        }
        // Actualizar Seguimientos
        if (data.seguimientos && this.widgets.seguimientos) {
            this.widgets.seguimientos.update(data.seguimientos);
        }
        // Actualizar Remisiones
        if (data.remisiones && this.widgets.remisiones) {
            this.widgets.remisiones.update(data.remisiones);
        }
        // Actualizar gráfica de accidentes
if (data.accidentes) {
this.renderAccidentesChart(data.accidentes);
}
if (data.indicadores) {
this.renderIndicesChart(data.indicadores);
}
    }

    renderAccidentesChart(data) {
        if (typeof Chart === 'undefined') return;
        const canvas = document.getElementById('saludAccidentesChart');
        if (!canvas) return;

        const monthlyData = data && data.mensual ? data.mensual : Array(12).fill(0);
        const labels = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        
        // Detectar mes actual para resaltar
        const currentMonth = new Date().getMonth();
        const barColors = monthlyData.map((count, i) => {
            if (count === 0) return 'rgba(40, 167, 69, 0.5)';
            return i === currentMonth ? 'rgba(23, 78, 166, 0.8)' : 'rgba(220, 53, 69, 0.7)';
        });
        const borderColors = monthlyData.map((count, i) => {
            if (count === 0) return '#28a745';
            return i === currentMonth ? '#174ea6' : '#dc3545';
        });

        const existingChart = Chart.getChart(canvas);
        if (existingChart) existingChart.destroy();

        new Chart(canvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Accidentes',
                    data: monthlyData,
                    borderColor: '#174ea6',
                    backgroundColor: 'rgba(23, 78, 166, 0.08)',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: true,
                    pointBackgroundColor: barColors,
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 1,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => ` ${ctx.raw} accidente${ctx.raw !== 1 ? 's' : ''}`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        suggestedMax: 5,
                        ticks: { stepSize: 1, precision: 0, maxTicksLimit: 6 },
                        title: { display: true, text: 'Cantidad', font: { size: 10 } },
                        grid: { display: false }
                    },
                    x: {
                        grid: { display: false }
                    }
                }
            }
});
}

renderIndicesChart(indicadores) {
if (typeof Chart === 'undefined') return;
const canvas = document.getElementById('saludIndicesChart');
if (!canvas) return;

const labels = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

const freqData = indicadores && indicadores.frecuenciaMensual
  ? indicadores.frecuenciaMensual.map(m => m.indiceFrecuencia)
  : Array(12).fill(0);
const sevData = indicadores && indicadores.severidadMensual
  ? indicadores.severidadMensual.map(m => m.indiceSeveridad)
  : Array(12).fill(0);
const mortData = indicadores && indicadores.eventosMortalesMensual
  ? indicadores.eventosMortalesMensual.map(m => m.eventosMortales)
  : Array(12).fill(0);

const metaFrecuencia = indicadores && indicadores.config ? (indicadores.config.metaFrecuencia || 0) : 0;
const metaSeveridad = indicadores && indicadores.config ? (indicadores.config.metaSeveridad || 0) : 0;

const existingChart = Chart.getChart(canvas);
if (existingChart) existingChart.destroy();

const metaPlugin = {
  id: 'metaLines',
  afterDraw(chart) {
    const ctx = chart.ctx;
    const yAxis = chart.scales.y;
    const xAxis = chart.scales.x;

    if (metaFrecuencia > 0 && yAxis) {
      const yPixel = yAxis.getPixelForValue(metaFrecuencia);
      if (yPixel >= yAxis.top && yPixel <= yAxis.bottom) {
        ctx.save();
        ctx.beginPath();
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = '#174ea6';
        ctx.lineWidth = 1.5;
        ctx.moveTo(xAxis.left, yPixel);
        ctx.lineTo(xAxis.right, yPixel);
        ctx.stroke();
        ctx.fillStyle = '#174ea6';
        ctx.font = '10px Segoe UI, Roboto, sans-serif';
        ctx.fillText('Meta IF', xAxis.right - 40, yPixel - 4);
        ctx.restore();
      }
    }

    if (metaSeveridad > 0 && yAxis) {
      const yPixel = yAxis.getPixelForValue(metaSeveridad);
      if (yPixel >= yAxis.top && yPixel <= yAxis.bottom) {
        ctx.save();
        ctx.beginPath();
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = '#b8860b';
        ctx.lineWidth = 1.5;
        ctx.moveTo(xAxis.left, yPixel);
        ctx.lineTo(xAxis.right, yPixel);
        ctx.stroke();
        ctx.fillStyle = '#b8860b';
        ctx.font = '10px Segoe UI, Roboto, sans-serif';
        ctx.fillText('Meta IS', xAxis.right - 40, yPixel - 4);
        ctx.restore();
      }
    }
  }
};

new Chart(canvas, {
  type: 'bar',
  data: {
    labels: labels,
    datasets: [
      {
        label: 'Índice Frecuencia (3.3.1)',
        data: freqData,
        backgroundColor: 'rgba(23, 78, 166, 0.7)',
        borderColor: '#174ea6',
        borderWidth: 1,
        yAxisID: 'y',
        order: 2
      },
      {
        label: 'Índice Severidad (3.3.2)',
        data: sevData,
        backgroundColor: 'rgba(255, 193, 7, 0.7)',
        borderColor: '#ffc107',
        borderWidth: 1,
        yAxisID: 'y',
        order: 2
      },
      {
        label: 'Mortalidad (3.3.3)',
        data: mortData,
        type: 'line',
        borderColor: '#dc3545',
        backgroundColor: 'rgba(220, 53, 69, 0.1)',
        borderWidth: 2,
        pointBackgroundColor: '#dc3545',
        pointRadius: 4,
        pointHoverRadius: 6,
        fill: true,
        tension: 0.3,
        yAxisID: 'y1',
        order: 1
      }
    ]
  },
  plugins: [metaPlugin],
  options: {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false
    },
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: {
          font: { size: 10 },
          boxWidth: 12,
          padding: 8
        }
      },
      tooltip: {
        callbacks: {
          label: function(ctx) {
            const label = ctx.dataset.label || '';
            const value = ctx.raw;
            if (ctx.dataset.yAxisID === 'y1') {
              return ` ${label}: ${value} evento${value !== 1 ? 's' : ''}`;
            }
            return ` ${label}: ${value}`;
          }
        }
      }
    },
    scales: {
      y: {
        type: 'linear',
        position: 'left',
        beginAtZero: true,
        title: {
          display: true,
          text: 'Índice (IF / IS)',
          font: { size: 10 }
        },
        ticks: { font: { size: 9 } },
        grid: { display: false }
      },
      y1: {
        type: 'linear',
        position: 'right',
        beginAtZero: true,
        title: {
          display: true,
          text: 'Eventos Mortales',
          font: { size: 10 }
        },
        ticks: {
          stepSize: 1,
          precision: 0,
          font: { size: 9 }
        },
        grid: { display: false }
      },
      x: {
        grid: { display: false }
      }
    }
  }
});
}

renderMainArea(container) {
        // 📦491-fix — Limpiar skeleton antes de pintar widgets reales
        container.innerHTML = '';

        const widgetsContainer = document.createElement('div');
        widgetsContainer.className = 'widgets-container';

        // Obtener datos iniciales del caché de sesión si existen
        const cachedData = window._saludHomeState.cache.get(this.currentCompany) || {};

        // Crear widgets pasando datos cacheados para renderizado instantáneo
        const examenesWidget = this.createExamenesWidget(cachedData.examenes);
        const accidentesWidget = this.createAccidentesWidget(cachedData.accidentes);
        const remisionesWidget = this.createRemisionesWidget(cachedData.remisiones);
        const seguimientosWidget = this.createSeguimientosWidget(cachedData.seguimientos);
        const ausentismoWidget = this.createAusentismoWidget(cachedData.ausentismo);
        const induccionesWidget = this.createInduccionesWidget(cachedData.inducciones);

        widgetsContainer.appendChild(examenesWidget);
        widgetsContainer.appendChild(accidentesWidget);
        widgetsContainer.appendChild(remisionesWidget);
        widgetsContainer.appendChild(seguimientosWidget);
        widgetsContainer.appendChild(ausentismoWidget);
        widgetsContainer.appendChild(induccionesWidget);

container.appendChild(widgetsContainer);

const chartsGrid = document.createElement('div');
chartsGrid.className = 'charts-grid-salud';

const chartContainer = document.createElement('div');
chartContainer.className = 'chart-container';
chartContainer.innerHTML = `
<h3>Accidentes por Mes — ${new Date().getFullYear()}</h3>
<div class="chart-placeholder" style="padding: 0.5rem 0;">
<canvas id="saludAccidentesChart"></canvas>
</div>
`;
chartsGrid.appendChild(chartContainer);

const indicesChartContainer = document.createElement('div');
indicesChartContainer.className = 'chart-container';
indicesChartContainer.innerHTML = `
<h3>Índices de Accidentalidad — ${new Date().getFullYear()}</h3>
<div class="chart-placeholder" style="padding: 0.5rem 0;">
<canvas id="saludIndicesChart"></canvas>
</div>
`;
chartsGrid.appendChild(indicesChartContainer);

container.appendChild(chartsGrid);

setTimeout(() => {
this.renderAccidentesChart(cachedData.accidentes || { mensual: Array(12).fill(0) });
this.renderIndicesChart(cachedData.indicadores || null);
}, 50);
        
        // Listado de submódulos
        const submodulesContainer = document.createElement('div');
        submodulesContainer.className = 'submodules-container';
        submodulesContainer.innerHTML = `<h3>Submódulos</h3>`;
        
        const submodulesList = document.createElement('div');
        submodulesList.className = 'submodules-list';
        
        this.submodules.forEach(submodule => {
            submodulesList.appendChild(this.renderSubmoduleItem(submodule));
        });
        
        submodulesContainer.appendChild(submodulesList);
        container.appendChild(submodulesContainer);
    }

    /**
     * Widget de Seguimientos Médicos con Toggle Año/Mes
     */
    createSeguimientosWidget(initialData) {
        const widget = document.createElement('div');
        widget.className = 'widget k-budget-card';
        
        let currentMode = 'year';
        let data = initialData;

        const render = () => {
            const displayData = data || { totalAnio: 0, realizadosAnio: 0, totalMes: 0, realizadosMes: 0, year: '—', mes: '—' };
            const pendientes = currentMode === 'year' ? displayData.totalAnio : displayData.totalMes;
            const realizados = currentMode === 'year' ? displayData.realizadosAnio : displayData.realizadosMes;
            const badge = currentMode === 'year' ? displayData.year : (displayData.mes || '').substring(0,3);

            widget.innerHTML = `
                <div class="kb-header">
                    <span class="kb-title">Seguimientos Médicos</span>
                    <span class="kb-badge bg-primary" style="background-color: var(--k-primary) !important;">${badge}</span>
                </div>
                <div class="ausentismo-toggles">
                    <button class="ausentismo-toggle ${currentMode==='year'?'active':''}" data-mode="year">Año</button>
                    <button class="ausentismo-toggle ${currentMode==='month'?'active':''}" data-mode="month">Mes</button>
                </div>
                <div class="kb-amount" style="text-align:center;">
                    <span>${pendientes}</span>
                </div>
<div style="font-size:0.72rem;color:var(--k-text-muted);text-align:center;margin-bottom:4px;">
Casos pendientes (incapacidad > 15 días)
                </div>
                <div class="kb-footer">
                    <div>
                        <div class="kb-label">Pendientes</div>
                        <div class="kb-value kb-rem">${pendientes}</div>
                    </div>
                    <div style="text-align:right;">
                        <div class="kb-label">Realizados</div>
                        <div class="kb-value kb-exec">${realizados}</div>
                    </div>
                </div>
            `;

            // Re-asignar eventos de toggle
            widget.querySelectorAll('.ausentismo-toggle').forEach(btn => {
                btn.onclick = () => {
                    currentMode = btn.dataset.mode;
                    render();
                };
            });
        };

        this.widgets.seguimientos = {
            update: (newData) => { data = newData; render(); }
        };

        render();
        return widget;
    }

    /**
     * Widget de Ausentismo con Toggle Año/Mes
     */
    createAusentismoWidget(initialData) {
        const widget = document.createElement('div');
        widget.className = 'widget k-budget-card';
        
        let currentMode = 'year';
        let data = initialData;

        const render = () => {
            const displayData = data || { total: 0, mesActual: 0, year: '—', mes: '—' };
            const value = currentMode === 'year' ? displayData.total : displayData.mesActual;
            const badge = currentMode === 'year' ? displayData.year : (displayData.mes || '').substring(0,3);

            widget.innerHTML = `
                <div class="kb-header">
                    <span class="kb-title">Ausentismo Médico</span>
                    <span class="kb-badge bg-success">${badge}</span>
                </div>
                <div class="ausentismo-toggles">
                    <button class="ausentismo-toggle ${currentMode==='year'?'active':''}" data-mode="year">Año</button>
                    <button class="ausentismo-toggle ${currentMode==='month'?'active':''}" data-mode="month">Mes</button>
                </div>
                <div class="kb-amount" style="text-align:center;">
                    <span>${value}</span>
                </div>
<div style="font-size:0.72rem;color:var(--k-text-muted);text-align:center;margin-bottom:4px;">
Incapacidades registradas
                </div>
                <div class="kb-footer">
                    <div>
                        <div class="kb-label">Total Año</div>
                        <div class="kb-value kb-exec">${displayData.total}</div>
                    </div>
                    <div style="text-align:right;">
                        <div class="kb-label">Mes Actual</div>
                        <div class="kb-value kb-rem">${displayData.mesActual}</div>
                    </div>
                </div>
            `;

            widget.querySelectorAll('.ausentismo-toggle').forEach(btn => {
                btn.onclick = () => {
                    currentMode = btn.dataset.mode;
                    render();
                };
            });
        };

        this.widgets.ausentismo = {
            update: (newData) => { data = newData; render(); }
        };

        render();
        return widget;
    }

    /**
     * Widget de Exámenes Médicos con Toggle Año/Mes
     */
    createExamenesWidget(initialData) {
        const widget = document.createElement('div');
        widget.className = 'widget k-budget-card';
        
        let currentMode = 'year';
        let data = initialData;

        const render = () => {
            const displayData = data || { totalYear: 0, mesActual: 0, year: '—', mes: '—' };
            const value = currentMode === 'year' ? displayData.totalYear : displayData.mesActual;
            const badge = currentMode === 'year' ? displayData.year : (displayData.mes || '').substring(0,3);

            widget.innerHTML = `
                <div class="kb-header">
                    <span class="kb-title">Exámenes Médicos</span>
                    <span class="kb-badge bg-success">${badge}</span>
                </div>
                <div class="ausentismo-toggles">
                    <button class="ausentismo-toggle ${currentMode==='year'?'active':''}" data-mode="year">Año</button>
                    <button class="ausentismo-toggle ${currentMode==='month'?'active':''}" data-mode="month">Mes</button>
                </div>
                <div class="kb-amount" style="text-align:center;">
                    <span>${value}</span>
                </div>
<div style="font-size:0.72rem;color:var(--k-text-muted);text-align:center;margin-bottom:4px;">
Evaluaciones médicas
                </div>
                <div class="kb-footer">
                    <div>
                        <div class="kb-label">Total Año</div>
                        <div class="kb-value kb-exec">${displayData.totalYear}</div>
                    </div>
                    <div style="text-align:right;">
                        <div class="kb-label">Mes Actual</div>
                        <div class="kb-value kb-rem">${displayData.mesActual}</div>
                    </div>
                </div>
            `;

            widget.querySelectorAll('.ausentismo-toggle').forEach(btn => {
                btn.onclick = () => {
                    currentMode = btn.dataset.mode;
                    render();
                };
            });
        };

        this.widgets.examenes = {
            update: (newData) => { data = newData; render(); }
        };

        render();
        return widget;
    }

    /**
     * Widget de Accidentes Reportados con Toggle Año/Mes
     */
    createAccidentesWidget(initialData) {
        const widget = document.createElement('div');
        widget.className = 'widget k-budget-card';
        
        let currentMode = 'year';
        let data = initialData;

        const render = () => {
            const displayData = data || { totalYear: 0, mesActual: 0, year: '—', mes: '—' };
            const value = currentMode === 'year' ? displayData.totalYear : displayData.mesActual;
            const badge = currentMode === 'year' ? displayData.year : (displayData.mes || '').substring(0,3);

            widget.innerHTML = `
                <div class="kb-header">
                    <span class="kb-title">Accidentes Reportados</span>
                    <span class="kb-badge bg-danger">${badge}</span>
                </div>
                <div class="ausentismo-toggles">
                    <button class="ausentismo-toggle ${currentMode==='year'?'active':''}" data-mode="year">Año</button>
                    <button class="ausentismo-toggle ${currentMode==='month'?'active':''}" data-mode="month">Mes</button>
                </div>
                <div class="kb-amount" style="text-align:center;">
                    <span>${value}</span>
                </div>
      <div style="font-size:0.72rem;color:var(--k-text-muted);text-align:center;margin-bottom:4px;">
        Accidentes de Trabajo (A.T)
      </div>
                <div class="kb-footer">
                    <div>
                        <div class="kb-label">Total Año</div>
                        <div class="kb-value kb-exec">${displayData.totalYear}</div>
                    </div>
                    <div style="text-align:right;">
                        <div class="kb-label">Mes Actual</div>
                        <div class="kb-value kb-rem">${displayData.mesActual}</div>
                    </div>
                </div>
            `;

            widget.querySelectorAll('.ausentismo-toggle').forEach(btn => {
                btn.onclick = () => {
                    currentMode = btn.dataset.mode;
                    render();
                };
            });
        };

        this.widgets.accidentes = {
            update: (newData) => { data = newData; render(); }
        };

        render();
        return widget;
    }

    /**
     * Widget de Remisiones Médicas dinámico
     */
    createRemisionesWidget(initialData) {
        const widget = document.createElement('div');
        widget.className = 'widget k-budget-card';
        
        let data = initialData;

        const render = () => {
            const displayData = data || { total: 0, mesActual: 0, month: '—' };
            
            widget.innerHTML = `
                <div class="kb-header">
                    <span class="kb-title">Remisiones a EPS</span>
                    <span class="kb-badge" style="background:#17a2b8;">TOTAL</span>
                </div>
<div class="kb-amount" style="text-align:center;">
<span>${displayData.total}</span>
                </div>
<div style="font-size:0.72rem;color:var(--k-text-muted);text-align:center;margin-bottom:4px;">
Control de remisiones y recomendaciones
                </div>
                <div class="kb-footer">
                    <div>
                        <div class="kb-label">Mes Actual</div>
                        <div class="kb-value">${displayData.mesActual}</div>
                    </div>
                    <div style="text-align:right;">
                        <div class="kb-label">Estado</div>
                        <div class="kb-value kb-exec">Al día</div>
                    </div>
                </div>
            `;
        };

        this.widgets.remisiones = {
            update: (newData) => { data = newData; render(); }
        };

        render();
        return widget;
    }

    /**
     * Widget de Inducciones (Integrado desde RecursosStats)
     */
    createInduccionesWidget(initialData) {
        const widget = document.createElement('div');
        widget.className = 'widget k-budget-card';
        
        let data = initialData;

        const render = () => {
            const displayData = data || { completadas: 0, pendientes: 0, porcentajeCompletado: 0 };
            
            widget.innerHTML = `
                <div class="kb-header">
                    <span class="kb-title">Inducciones SST</span>
                    <span class="kb-badge bg-success">${displayData.porcentajeCompletado}%</span>
                </div>
                <div class="kb-amount" style="text-align:center;">
                    <span>${displayData.completadas}</span>
                </div>
<div style="font-size:0.72rem;color:var(--k-text-muted);text-align:center;margin-bottom:4px;">
Trabajadores con inducción al día
                </div>
                <div class="kb-progress-track" style="margin-bottom: 0.5rem;">
                    <div class="kb-progress-bar" style="width: ${displayData.porcentajeCompletado}%">
    <div class="kb-shimmer"></div>
</div>
                </div>
                <div class="kb-footer">
                    <div>
                        <div class="kb-label">Completas</div>
                        <div class="kb-value kb-exec">${displayData.completadas}</div>
                    </div>
                    <div style="text-align:right;">
                        <div class="kb-label">Pendientes</div>
                        <div class="kb-value kb-rem">${displayData.pendientes}</div>
                    </div>
                </div>
            `;
        };

        this.widgets.inducciones = {
            update: (newData) => { data = newData; render(); }
        };

        render();
        return widget;
    }

    createWidget(title, value, description) {
        const widget = document.createElement('div');
        widget.className = 'widget';
        widget.innerHTML = `
            <h4>${title}</h4>
            <div class="widget-value">${value}</div>
            <div class="widget-description">${description}</div>
        `;
        return widget;
    }

    renderSubmoduleItem(name) {
        const submoduleItem = document.createElement('div');
        submoduleItem.className = 'submodule-item';
        submoduleItem.innerHTML = `
            <div class="submodule-info">
                <div class="submodule-name">${name}</div>
                <div class="submodule-meta">Gestión y registros asociados</div>
            </div>
            <button class="btn-ingresar">Ingresar</button>
        `;
        submoduleItem.querySelector('button').onclick = () => showSubmoduleContent(this.container, this.moduleName, name);
        return submoduleItem;
    }

    injectStyles() {
        const styleId = 'k-salud-home-optimized-styles';
        const oldStyle = document.getElementById(styleId);
        if (oldStyle) oldStyle.remove();

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
.gestion-salud-home {
--k-primary: #174ea6;
--k-primary-light: #e8f0fe;
--k-primary-hover: #1450a1;
--k-success: #28a745;
--k-danger: #dc3545;
--k-bg-card: #ffffff;
--k-bg-app: #f8f9fa;
--k-border: #dee2e6;
--k-text-main: #212529;
--k-text-muted: #6c757d;
--k-radius-md: 0.375rem;
--k-radius-lg: 0.5rem;
--k-shadow-sm: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.05);
--k-shadow-md: 0 0.5rem 1rem rgba(0, 0, 0, 0.08);
--k-header-height: 60px;
--k-font-family: inherit;
padding: 1.5rem;
background: var(--k-bg-app);
height: 100%;
overflow-y: auto;
}
            .widgets-container { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 0 !important; }
            .widget { background: var(--k-bg-card); border: 1px solid var(--k-border); border-radius: var(--k-radius-lg); padding: 1rem; box-shadow: var(--k-shadow-sm); display: flex; flex-direction: column; min-height: 120px; transition: transform 0.2s ease; } .widget:hover { transform: translateY(-3px); box-shadow: var(--k-shadow-md); } .widget h4 { margin: 0 0 0.5rem 0; font-size: 0.65rem; color: var(--k-text-muted); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; } .widget-value { font-size: 1.4rem; font-weight: 700; color: var(--k-text-main); margin-bottom: 0.5rem; } .widget-description { font-size: 0.65rem; color: var(--k-text-muted); }
            .k-budget-card .kb-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
            .k-budget-card .kb-title { font-size: 0.65rem; font-weight: 600; color: var(--k-text-muted); text-transform: uppercase; }
            .k-budget-card .kb-badge { font-size: 0.7rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 1rem; color: white; background-color: var(--k-success); }
            .k-budget-card .bg-success { background: var(--k-success) !important; }
            .k-budget-card .bg-danger { background: var(--k-danger) !important; }
            .k-budget-card .kb-amount { font-size: 1.4rem; font-weight: 700; color: var(--k-text-main); margin-bottom: 0.5rem; }
            .k-budget-card .kb-footer { display: flex; justify-content: space-between; margin-top: auto; padding-top: 0.5rem; border-top: 1px solid #eee; }
            .k-budget-card .kb-label { font-size: 0.6rem; color: var(--k-text-muted); text-transform: uppercase; }
            .k-budget-card .kb-value { font-size: 0.6rem; font-weight: 600; }
            .kb-exec { color: var(--k-success); }
            .kb-rem { color: var(--k-primary); }
            
.kb-progress-track { width: 100%; height: 10px; background: #e9ecef; border-radius: 5px; overflow: hidden; margin-bottom: 0.5rem; position: relative; }
.kb-progress-bar { height: 100%; width: 0%; border-radius: 5px; background-color: var(--k-success); transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.3s; }

            .ausentismo-toggles { display: flex; gap: 4px; margin: 4px 0; background: #f1f3f4; padding: 3px; border-radius: 6px; }
.ausentismo-toggle { flex: 1; border: none; background: transparent; font-size: 0.7rem; padding: 2px 6px; border-radius: var(--k-radius-md); cursor: pointer; color: var(--k-text-muted); transition: all 0.2s; }
.ausentismo-toggle.active { background: white; color: var(--k-primary); box-shadow: var(--k-shadow-sm); font-weight: 600; }

            .submodules-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem; }
.submodule-item { display: flex; align-items: center; justify-content: space-between; padding: 1rem; background-color: #fcfcfc; border: 1px solid var(--k-border); border-radius: var(--k-radius-md); transition: all 0.2s ease; }
.submodule-item:hover { background-color: var(--k-primary-light); border-color: var(--k-primary); transform: translateX(5px); }
.btn-ingresar { background-color: var(--k-primary); color: white; border: none; padding: 0.5rem 1.25rem; border-radius: var(--k-radius-md); font-weight: 500; cursor: pointer; transition: background 0.2s; white-space: nowrap; }
.btn-ingresar:hover { background-color: var(--k-primary-hover); }
            
            .main-area { display: flex; flex-direction: column; gap: 1rem; }
.submodules-container { background: var(--k-bg-card); border: 1px solid var(--k-border); border-radius: var(--k-radius-lg); padding: 1.5rem; box-shadow: var(--k-shadow-sm); margin-top: 0 !important; }
.submodules-container h3 { margin-top: 0; margin-bottom: 1rem; font-size: 1.1rem; font-weight: 600; color: var(--k-text-main); padding-bottom: 1rem; border-bottom: 1px solid var(--k-border); text-transform: uppercase; letter-spacing: 0.05em; }
            .chart-container { background: var(--k-bg-card); border: 1px solid var(--k-border); border-radius: var(--k-radius-lg); padding: 1.5rem; box-shadow: var(--k-shadow-sm); min-height: 350px; max-height: 350px; display: flex; flex-direction: column; }
.chart-container h3 { margin-top: 0; margin-bottom: 1rem; font-size: 1.1rem; font-weight: 600; color: var(--k-text-main); text-transform: uppercase; letter-spacing: 0.05em; }
.chart-placeholder { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.chart-placeholder canvas { flex: 1; min-height: 0; width: 100% !important; height: 100% !important; }
.charts-grid-salud { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
@media (max-width: 992px) { .charts-grid-salud { grid-template-columns: 1fr; } }

/* ANULAR ESTILOS GLOBALES (styles.css) */
.gestion-salud-home .widget { margin-bottom: 0 !important; padding: 1rem !important; }
.gestion-salud-home .chart-container { margin-top: 0 !important; margin-bottom: 0 !important; }
.gestion-salud-home .charts-grid-salud { margin-top: 0 !important; }
`;
        document.head.appendChild(style);
    }
}

// Hacer la clase disponible globalmente
window.GestionSaludHome = GestionSaludHome;
