// gestion-salud-home.js - Componente para el home del módulo "Gestión de la Salud"
// 📦754 · Rediseño premium visual (header minimal + hero + 3 metric cards + chart + radar + grid).

class GestionSaludHome {
    constructor(container, moduleName, submodules, companyName) {
        this.container = container;
        this.moduleName = moduleName;
        this.submodules = submodules;
        // 📦748 · Aceptar currentCompany como parámetro del shell (misma forma que Recursos).
        this.currentCompany = companyName || this.getCurrentCompany() || null;
        this.saludStats = null;
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
        layout.style.cssText = 'height: 100%; display: flex; flex-direction: column; min-height: 0;';

        // Header (📦754 — minimal: solo breadcrumb + H1, escala fluido)
        const header = document.createElement('header');
        header.className = 'kair-page-header';
        header.innerHTML = `
            <div class="kair-page-title-block">
                <div class="kair-breadcrumb">
                    <span>Inicio</span><span>/</span>
                    <span>Gestión</span><span>/</span>
                    <span>Salud</span>
                </div>
                <h1>Gestión de la Salud</h1>
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

        // 📦491 — Skeleton mientras cargan las estadísticas de Gestión Salud
        mainArea.innerHTML = KairSkeleton.kpiStrip(4) + KairSkeleton.chartBars(12);

        contentContainer.appendChild(mainArea);
        layout.appendChild(contentContainer);
        this.container.appendChild(layout);

        // 200ms para que el browser pinte el skeleton
        await new Promise(r => setTimeout(r, 200));

        // 3. Cargar estadísticas reales
        await this.refreshStats();

        // 4. Renderizar contenido premium (limpia el skeleton)
        await this.renderMainArea(mainArea);

        // 📦754 · El rediseño premium usa SVG (renderChartSalud) en vez de Chart.js.
        // renderAccidentesChart ya no aplica al home — los canvases Chart.js no existen en el nuevo layout.
        // El método queda vivo por si se necesita en otros submódulos.
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
        const styleId = 'k-air-gestion-salud-styles-v2';
        const oldStyle = document.getElementById(styleId);
        if (oldStyle) oldStyle.remove();

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            /* =========================================
               1. SISTEMA VISUAL K+AIR (OFICIAL — GESTIÓN SALUD)
               ========================================= */
            .gestion-salud-home {
                /* Scope vars legacy (compatibilidad con widgets individuales) */
                --k-primary: #174ea6;
                --k-primary-hover: #185abd;
                --k-primary-light: rgba(23, 78, 166, 0.1);
                --k-success: #28a745;
                --k-success-light: rgba(40, 167, 69, 0.1);
                --k-warning: #ffc107;
                --k-warning-light: rgba(255, 193, 7, 0.1);
                --k-danger: #dc3545;
                --k-danger-light: rgba(220, 53, 69, 0.1);
                --k-bg-card: #ffffff;
                --k-border: #e9ecef;
                --k-text-main: #212529;
                --k-text-muted: #6c757d;
                --k-shadow-sm: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);

                /* Scroll interno (mismo patrón que Recursos/Gestión Integral) */
                height: 100%;
                overflow: hidden auto;
                background: #f8f9fa;
                padding: clamp(15px, 1.8vw, 22px);
                box-sizing: border-box;
            }
            .gestion-salud-home .main-area {
                flex: 1 1 auto;
                min-height: 0;
                overflow-y: auto;
            }
        `;
        document.head.appendChild(style);
    }

    renderMetricCard(opts) {
        var label = opts.label;
        var valueHTML = opts.valueHTML;
        var desc = opts.desc;
        var progressPct = opts.progressPct;
        var variant = opts.variant;
        var card = document.createElement('article');
        card.className = 'kair-metric-card' + (variant && variant !== 'ok' ? ' kair-metric-card--' + variant : '');
        card.innerHTML = ''
            + '<span class="kair-metric-head">' + label + '</span>'
            + '<div class="kair-metric-value">' + valueHTML + '</div>'
            + '<p class="kair-metric-desc">' + desc + '</p>'
            + '<div class="kair-progress"><i style="width:' + Math.min(100, progressPct) + '%"></i></div>';
        return card;
    }

    buildRadarTasks() {
        var stats = this.saludStats || {};
        var tareas = [];
        var examenes = stats.examenes || {};
        if ((examenes.pendientes || 0) > 0) {
            tareas.push({
                icon: '◷', bg: '#fff5e6', color: '#c28316',
                title: 'Evaluaciones médicas',
                sub: examenes.pendientes + ' exámenes pendientes',
                status: 'Pendiente', statusClass: 'kair-status-pill--warn'
            });
        }
        var seguimientos = stats.seguimientos || {};
        if ((seguimientos.pendientes || 0) > 0) {
            tareas.push({
                icon: '◷', bg: '#f0eaff', color: '#6b3fb8',
                title: 'Seguimientos de salud',
                sub: seguimientos.pendientes + ' seguimientos sin cerrar',
                status: 'Pendiente', statusClass: 'kair-status-pill--warn'
            });
        }
        var accidentes = stats.accidentes || {};
        if ((accidentes.pendientes || 0) > 0) {
            tareas.push({
                icon: '◷', bg: '#ffe9e9', color: '#a83a48',
                title: 'Investigación de accidentes',
                sub: accidentes.pendientes + ' accidentes sin investigar',
                status: 'Pendiente', statusClass: 'kair-status-pill--warn'
            });
        }
        if (tareas.length === 0) {
            tareas.push({
                icon: '✓', bg: '#e9f3ff', color: '#2057b8',
                title: 'Sistema estable',
                sub: 'Sin alertas pendientes este mes',
                status: 'Al día', statusClass: 'kair-status-pill--ok'
            });
        }
        var html = '';
        for (var i = 0; i < tareas.length && i < 3; i++) {
            var t = tareas[i];
            html += ''
                + '<div class="kair-task">'
                + '  <div class="kair-task-icon" style="background:' + t.bg + ';color:' + t.color + '">' + t.icon + '</div>'
                + '  <div>'
                + '    <strong>' + t.title + '</strong>'
                + '    <small>' + t.sub + '</small>'
                + '  </div>'
                + '  <span class="kair-status-pill ' + t.statusClass + '">' + t.status + '</span>'
                + '</div>';
        }
        return html;
    }

    renderChartSalud(indicadores) {
        var el = document.getElementById('kair-chart-salud');
        if (!el) return;
        var frecuencia = indicadores.frecuencia || 0;
        var severidad = indicadores.severidad || 0;
        var prevalencia = indicadores.prevalencia || 0;
        var incidencia = indicadores.incidencia || 0;

        var items = [
            { label: 'Frecuencia', value: frecuencia, color: '#174ea6' },
            { label: 'Severidad', value: severidad, color: '#178666' },
            { label: 'Prevalencia', value: prevalencia, color: '#c28316' },
            { label: 'Incidencia', value: incidencia, color: '#a83a48' }
        ];

        var rowH = 28;
        var gapY = 6;
        var PAD_L = 110, PAD_R = 20, PAD_T = 14, PAD_B = 14;
        var H = PAD_T + PAD_B + items.length * (rowH + gapY);
        var W = 690;
        var maxVal = Math.max.apply(null, items.map(function (i) { return i.value; }).concat([1]));
        var barX = PAD_L;
        var barW = W - PAD_L - PAD_R;

        var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" style="width:100%;height:auto;display:block;">';
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            var y = PAD_T + i * (rowH + gapY);
            var barY = y;
            var filledW = Math.max(2, (barW * item.value) / maxVal);
            svg += '<text x="' + (PAD_L - 10) + '" y="' + (barY + rowH / 2 + 4) + '" text-anchor="end" font-family="Manrope, sans-serif" font-size="11" fill="#637189">' + item.label + '</text>';
            svg += '<rect x="' + barX + '" y="' + barY + '" width="' + barW + '" height="' + rowH + '" rx="6" ry="6" fill="#eef0f1"/>';
            svg += '<rect x="' + barX + '" y="' + barY + '" width="' + filledW + '" height="' + rowH + '" rx="6" ry="6" fill="' + item.color + '"/>';
            svg += '<text x="' + (W - PAD_R) + '" y="' + (barY + rowH / 2 + 4) + '" text-anchor="end" font-family="Manrope, sans-serif" font-size="12" font-weight="700" fill="#212529">' + item.value.toFixed(2) + '</text>';
        }
        svg += '</svg>';

        el.innerHTML = svg;
    }

    renderSubmodulesGrid() {
        var grid = document.getElementById('kair-submodules-grid');
        if (!grid) return;
        var items = this.submodules || [];
        var html = '';
        for (var i = 0; i < items.length; i++) {
            var name = items[i];
            var m = name.match(/^(\d+\.\d+\.\d+)/);
            var codeStr = m ? m[1] : String(i + 1);
            var cleanName = name.replace(/^\d+\.\d+\.\d+\s*/, '');
            html += ''
                + '<div class="kair-module" data-submodule="' + name + '">'
                + '  <span class="kair-module-n">' + codeStr + '</span>'
                + '  <strong>' + cleanName + '</strong>'
                + '  <small>Gestión y control</small>'
                + '  <span class="kair-module-arrow">→</span>'
                + '</div>';
        }
        grid.innerHTML = html;
        var els = grid.querySelectorAll('.kair-module');
        var self = this;
        for (var j = 0; j < els.length; j++) {
            (function (el) {
                el.onclick = function () { self.handleSubmoduleClick(el.dataset.submodule); };
            })(els[j]);
        }
    }

    handleSubmoduleClick(submoduleName) {
        console.log('Navegando a submódulo:', submoduleName);
        const mainCanvas = document.querySelector('.main-canvas');
        if (mainCanvas && typeof window.showSubmoduleContent === 'function') {
            window.showSubmoduleContent(mainCanvas, this.moduleName, submoduleName);
        } else {
            alert('Navegando a ' + submoduleName);
        }
    }

    async renderMainArea(container) {
        // 📦754 · Renderizar contenido premium del módulo Gestión de la Salud.
        container.innerHTML = '';

        const stats = this.saludStats || {};
        const inducciones = stats.inducciones || { totalTrabajadores: 0, totalInducciones: 0, completadas: 0, pendientes: 0, porcentajeCompletado: 0 };
        const ausentismo = stats.ausentismo || { diasPerdidos: 0, totalTrabajadores: 0, tasaAusentismo: 0 };
        const examenes = stats.examenes || { totalExamenes: 0, realizados: 0, pendientes: 0 };
        const seguimientos = stats.seguimientos || { total: 0, completados: 0, pendientes: 0 };
        const accidentes = stats.accidentes || { total: 0, investigados: 0, pendientes: 0 };
        const indicadores = stats.indicadores || { frecuencia: 0, severidad: 0, prevalencia: 0, incidencia: 0 };

        // 📦754 · cumplimientoGeneral: score compuesto del módulo.
        const cumplimientoInducciones = inducciones.totalTrabajadores > 0 ? inducciones.porcentajeCompletado : null;
        const cumplimientoExamenes = examenes.totalExamenes > 0 ? Math.round(((examenes.realizados || 0) / examenes.totalExamenes) * 100) : null;
        const cumplimientoSeguimientos = seguimientos.total > 0 ? Math.round(((seguimientos.completados || 0) / seguimientos.total) * 100) : null;
        const accidentesOk = accidentes.total === 0 ? 100 : (accidentes.investigados >= accidentes.total ? 100 : 0);
        const tasaAusentismoBaja = ausentismo.totalTrabajadores > 0 ? Math.max(0, 100 - Math.round(ausentismo.tasaAusentismo || 0)) : null;
        const compGeneralArr = [cumplimientoInducciones, cumplimientoExamenes, cumplimientoSeguimientos, accidentesOk, tasaAusentismoBaja].filter(function (v) { return v !== null; });
        const cumplimientoGeneral = compGeneralArr.length > 0
            ? Math.round(compGeneralArr.reduce(function (a, b) { return a + b; }, 0) / compGeneralArr.length)
            : 0;

        // 1) HERO STRIP
        const health = document.createElement('section');
        health.className = 'kair-health';

        const hero = document.createElement('article');
        hero.className = 'kair-hero-card';
        const heroMsg = cumplimientoGeneral >= 80
            ? 'Tu sistema va por buen camino.'
            : cumplimientoGeneral >= 50
                ? 'Hay áreas que necesitan atención este mes.'
                : 'Atención: hay actividades críticas pendientes.';
        const tareasPendientes = (inducciones.pendientes || 0) +
            (examenes.pendientes || 0) +
            (seguimientos.pendientes || 0) +
            (accidentes.pendientes || 0);
        hero.innerHTML = ''
            + '<div class="kair-hero-eyebrow">Estado general</div>'
            + '<h2>' + heroMsg + '</h2>'
            + '<p class="kair-hero-msg">Hay ' + tareasPendientes + ' actividades que necesitan atención este mes.</p>'
            + '<div class="kair-hero-score">' + cumplimientoGeneral + '%<span>cumplimiento</span></div>';
        health.appendChild(hero);

        const induccionesPct = cumplimientoInducciones || 0;
        const examenesPct = cumplimientoExamenes || 0;
        const seguimientosPct = cumplimientoSeguimientos || 0;
        health.appendChild(this.renderMetricCard({
            label: 'Inducciones',
            valueHTML: (inducciones.completadas || 0) + ' <small style="font:500 15px DM Sans;color:#8791a1">/ ' + (inducciones.totalTrabajadores || 0) + '</small>',
            desc: 'Personal con inducción al día',
            progressPct: induccionesPct,
            variant: induccionesPct >= 70 ? 'ok' : induccionesPct >= 40 ? 'warning' : 'danger'
        }));
        health.appendChild(this.renderMetricCard({
            label: 'Evaluaciones médicas',
            valueHTML: (examenes.realizados || 0) + ' <small style="font:500 15px DM Sans;color:#8791a1">/ ' + (examenes.totalExamenes || 0) + '</small>',
            desc: 'Exámenes realizados',
            progressPct: examenesPct,
            variant: examenesPct >= 70 ? 'ok' : examenesPct >= 40 ? 'warning' : 'danger'
        }));
        health.appendChild(this.renderMetricCard({
            label: 'Seguimientos',
            valueHTML: (seguimientos.completados || 0) + ' <small style="font:500 15px DM Sans;color:#8791a1">/ ' + (seguimientos.total || 0) + '</small>',
            desc: 'Seguimientos completados',
            progressPct: seguimientosPct,
            variant: seguimientosPct >= 70 ? 'ok' : seguimientosPct >= 40 ? 'warning' : 'danger'
        }));
        container.appendChild(health);

        // 2) CONTENT GRID: chart + radar
        const content = document.createElement('section');
        content.className = 'kair-content';

        const chartCard = document.createElement('article');
        chartCard.className = 'kair-card';
        chartCard.innerHTML = ''
            + '<div class="kair-row-title">'
            + '  <div>'
            + '    <h3>Indicadores de Salud</h3>'
            + '    <div class="kair-card-hint">Frecuencia · Severidad · Prevalencia · Incidencia</div>'
            + '  </div>'
            + '</div>'
            + '<div class="kair-chart" id="kair-chart-salud"></div>';
        content.appendChild(chartCard);

        const radarCard = document.createElement('article');
        radarCard.className = 'kair-card';
        radarCard.innerHTML = ''
            + '<div class="kair-row-title">'
            + '  <div>'
            + '    <h3>En tu radar</h3>'
            + '    <div class="kair-card-hint">Requieren gestión este mes</div>'
            + '  </div>'
            + '</div>'
            + this.buildRadarTasks();
        content.appendChild(radarCard);

        container.appendChild(content);

        // 3) GRID: módulos
        const modules = document.createElement('section');
        modules.className = 'kair-modules';
        const modulesCard = document.createElement('article');
        modulesCard.className = 'kair-card';
        modulesCard.innerHTML = ''
            + '<div class="kair-row-title">'
            + '  <div>'
            + '    <h3>Explorar submódulos</h3>'
            + '    <div class="kair-card-hint">Gestiona la documentación y evidencias de tu sistema.</div>'
            + '  </div>'
            + '  <button class="kair-btn kair-btn-ghost">Ver todos</button>'
            + '</div>'
            + '<div class="kair-module-grid" id="kair-submodules-grid"></div>';
        modules.appendChild(modulesCard);
        container.appendChild(modules);

        this.renderChartSalud(indicadores);
        this.renderSubmodulesGrid();
    }


}

// Hacer la clase disponible globalmente
window.GestionSaludHome = GestionSaludHome;
