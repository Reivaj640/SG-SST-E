// gestion-peligros-home.js - Componente para el home del módulo "Gestión de Peligros y Riesgos"
// Patrón K+AIR: reactive widgets + Chart.js + cache de sesión (replica gestion-salud-home.js)

if (!window._peligrosHomeState) {
	window._peligrosHomeState = {
		cache: new Map(),
		lastUpdate: new Map()
	};
}

class GestionPeligrosHome {
	constructor(container, moduleName, submodules, companyName) {
		this.container = container;
		this.moduleName = moduleName;
		this.submodules = submodules;
		// 📦748 · Aceptar currentCompany como parámetro del shell.
		this.currentCompany = companyName || this.getCurrentCompany() || null;
		this.widgets = {};
	}

	getCurrentCompany() {
		if (window.currentCompany && window.currentCompany !== 'default_company') return window.currentCompany;
		if (window.rendererState && window.rendererState.selectedCompany) return window.rendererState.selectedCompany;
		if (window.currentModule && window.currentModule.company) return window.currentModule.company;
		var domCompany = document.getElementById('company-name');
		if (domCompany && domCompany.textContent && domCompany.textContent !== 'Empresa') return domCompany.textContent.trim();
		return localStorage.getItem('currentCompanyName') || 'default_company';
	}

	async render() {
		this.container.innerHTML = '';
		this.currentCompany = this.getCurrentCompany();

		this.injectStyles();

		var layout = document.createElement('div');
		layout.className = 'k-app-layout';
		layout.style.height = '100%';

		var header = document.createElement('header');
		header.className = 'k-module-header';
		header.innerHTML = '\
			<div class="k-module-title">\
				<span class="k-module-title-icon" style="color: #212529;">' + SIDEBAR_ICONS.alert_triangle + '</span>\
				<div>\
					<div style="color: #212529; font-weight: 600;">Módulo Gestión de Peligros y Riesgos</div>\
					<span style="font-size: 0.75rem; font-weight: 400; color: #6c757d;">\
						' + this.currentCompany + ' / Gestión de Peligros\
					</span>\
				</div>\
			</div>\
		';
		layout.appendChild(header);

		var contentContainer = document.createElement('div');
		contentContainer.className = 'gestion-peligros-home';
		contentContainer.id = 'app-container';

		var mainArea = document.createElement('div');
		mainArea.className = 'main-area';
		mainArea.style.flex = '1';

		// 📦491 — Skeleton mientras cargan stats de Gestión Peligros (5 widgets + 2 charts)
		mainArea.innerHTML = KairSkeleton.kpiStrip(5) + KairSkeleton.chartBars(12) + KairSkeleton.chartDonut();

		contentContainer.appendChild(mainArea);
		layout.appendChild(contentContainer);
		this.container.appendChild(layout);

		// Cargar stats ANTES de pintar widgets para que el skeleton se vea mientras esperan los datos
		await this.refreshStats();

		// Renderizar contenido con datos reales
		this.renderMainArea(mainArea);
	}

	async refreshStats() {
		var company = this.currentCompany;
		console.log('[PELIGROS] Refrescando estadísticas para ' + company + '...');

  try {
    var promises = [
      window.electronAPI.inspecciones.getStats(company),
      window.electronAPI.mantenimiento.getStats(company)
    ];
    if (window.electronAPI.matrizPeligros && window.electronAPI.matrizPeligros.stats) {
      promises.push(window.electronAPI.matrizPeligros.stats(company));
    }

    var results = await Promise.all(promises);

    var inspResult = results[0];
    var mntoResult = results[1];
    var mpResult = results[2] || null;

    var newData = {
      inspecciones: inspResult.success ? inspResult.data : null,
      mantenimiento: mntoResult.success ? mntoResult.data : null,
      peligros: (mpResult && mpResult.success) ? mpResult.data : null
    };

    window._peligrosHomeState.cache.set(company, newData);
    window._peligrosHomeState.lastUpdate.set(company, Date.now());

    this.updateWidgetsUI(newData);

		} catch (error) {
			console.error('[PELIGROS] Error refrescando estadísticas:', error);
		}
	}

	updateWidgetsUI(data) {
		if (!data) return;

		if (data.inspecciones && this.widgets.inspecciones) {
			this.widgets.inspecciones.update(data.inspecciones);
		}
  if (data.mantenimiento && this.widgets.mantenimiento) {
    this.widgets.mantenimiento.update(data.mantenimiento);
  }
  if (data.peligros && this.widgets.peligros) {
    this.widgets.peligros.update(data.peligros);
  }

		if (data.inspecciones) {
			this.renderInspeccionesChart(data.inspecciones);
		}
		if (data.inspecciones || data.mantenimiento) {
			this.renderCumplimientoChart(data.inspecciones, data.mantenimiento);
		}
	}

	renderMainArea(container) {
		// 📦491-fix — Limpiar skeleton antes de pintar widgets reales
		container.innerHTML = '';

		var widgetsContainer = document.createElement('div');
		widgetsContainer.className = 'widgets-container';

		var cachedData = window._peligrosHomeState.cache.get(this.currentCompany) || {};

  var inspeccionesWidget = this.createInspeccionesWidget(cachedData.inspecciones);
  var mantenimientoWidget = this.createMantenimientoWidget(cachedData.mantenimiento);
  var peligrosWidget = this.createPeligrosWidget(cachedData.peligros);
  var medicionesWidget = this.createMedicionesWidget(null);
  var eppWidget = this.createEPPWidget(null);

  widgetsContainer.appendChild(inspeccionesWidget);
  widgetsContainer.appendChild(mantenimientoWidget);
  widgetsContainer.appendChild(peligrosWidget);
  widgetsContainer.appendChild(medicionesWidget);
  widgetsContainer.appendChild(eppWidget);

		container.appendChild(widgetsContainer);

		var chartsGrid = document.createElement('div');
		chartsGrid.className = 'charts-grid-peligros';

		var chartContainer = document.createElement('div');
		chartContainer.className = 'chart-container';
		chartContainer.innerHTML = '\
			<h3>Inspecciones — Cumplimiento Mensual ' + new Date().getFullYear() + '</h3>\
			<div class="chart-placeholder" style="padding: 0.5rem 0;">\
				<canvas id="peligrosInspeccionesChart"></canvas>\
			</div>\
		';
		chartsGrid.appendChild(chartContainer);

		var cumplimientoChartContainer = document.createElement('div');
		cumplimientoChartContainer.className = 'chart-container';
		cumplimientoChartContainer.innerHTML = '\
			<h3>Cumplimiento Global</h3>\
			<div class="chart-placeholder" style="padding: 0.5rem 0;">\
				<canvas id="peligrosCumplimientoChart"></canvas>\
			</div>\
		';
		chartsGrid.appendChild(cumplimientoChartContainer);

		container.appendChild(chartsGrid);

		setTimeout(function() {
			this.renderInspeccionesChart(cachedData.inspecciones || null);
			this.renderCumplimientoChart(cachedData.inspecciones || null, cachedData.mantenimiento || null);
		}.bind(this), 50);

		var submodulesContainer = document.createElement('div');
		submodulesContainer.className = 'submodules-container';
		submodulesContainer.innerHTML = '<h3>Submódulos</h3>';

		var submodulesList = document.createElement('div');
		submodulesList.className = 'submodules-list';

		this.submodules.forEach(function(submodule) {
			submodulesList.appendChild(this.renderSubmoduleItem(submodule));
		}.bind(this));

		submodulesContainer.appendChild(submodulesList);
		container.appendChild(submodulesContainer);
	}

	createInspeccionesWidget(initialData) {
		var widget = document.createElement('div');
		widget.className = 'widget k-budget-card';

		var currentMode = 'year';
		var data = initialData;

		var render = function() {
			var displayData = data || { totalInspecciones: 0, completadas: 0, pendientesMes: 0, tasaCumplimiento: 0,
			                            programaTotal: 0, programaCompletadas: 0, programaPendientes: 0 };
			/* Modo Año: muestra el TOTAL del PROGRAMA ANUAL (cronograma), no
			   los registros, porque es lo que da la foto de "cuánto falta".
			   El sub-bloque muestra AMBAS fuentes (registros vs programa)
			   para que se vea la diferencia. */
			var progTotal = displayData.programaTotal || 0;
			var progComp  = displayData.programaCompletadas || 0;
			var progPend  = displayData.programaPendientes || 0;
			var totalInsps = displayData.totalInspecciones || 0;
			var regComp    = displayData.completadas || 0;
			var regPend    = Math.max(0, totalInsps - regComp);
			var pendientesMes = displayData.pendientesMes || 0;

			var value, sublabel, footerLeftLabel, footerLeftVal, footerRightLabel, footerRightVal, progressPct;
			if (currentMode === 'year') {
				value = progTotal;
				sublabel = 'Actividades programadas';
				footerLeftLabel = 'Cumplidas';
				footerLeftVal = progComp;
				footerRightLabel = 'Pendientes';
				footerRightVal = progPend;
				progressPct = progTotal === 0 ? 0 : Math.round((progComp / progTotal) * 1000) / 10;
			} else {
				value = pendientesMes;
				sublabel = 'Pendientes del mes';
				footerLeftLabel = 'Cumplidas';
				footerLeftVal = progComp;
				footerRightLabel = 'Pendientes';
				footerRightVal = pendientesMes;
				progressPct = displayData.tasaCumplimiento || 0;
			}
			var badge = currentMode === 'year'
				? (displayData.year || new Date().getFullYear())
				: ((displayData.mes || '—').substring(0, 3));

			widget.innerHTML = '\
				<div class="kb-header">\
					<span class="kb-title">Inspecciones</span>\
					<span class="kb-badge bg-success">' + badge + '</span>\
				</div>\
				<div class="ausentismo-toggles">\
					<button class="ausentismo-toggle ' + (currentMode === 'year' ? 'active' : '') + '" data-mode="year">Año</button>\
					<button class="ausentismo-toggle ' + (currentMode === 'month' ? 'active' : '') + '" data-mode="month">Mes</button>\
				</div>\
				<div class="kb-amount" style="text-align:center;">\
					<span>' + value + '</span>\
				</div>\
				<div style="font-size:0.72rem;color:var(--k-text-muted);text-align:center;margin-bottom:4px;">\
					' + sublabel + '\
				</div>\
				<div class="kb-progress-track" style="margin-bottom: 0.5rem;">\
					<div class="kb-progress-bar" style="width: ' + progressPct + '%">\
    <div class="kb-shimmer"></div>\
</div>\
				</div>\
				<div class="kb-footer">\
					<div>\
						<div class="kb-label">' + footerLeftLabel + '</div>\
						<div class="kb-value kb-exec">' + footerLeftVal + '</div>\
					</div>\
					<div style="text-align:right;">\
						<div class="kb-label">' + footerRightLabel + '</div>\
						<div class="kb-value kb-rem">' + footerRightVal + '</div>\
					</div>\
				</div>\
				<div class="kb-subnote" style="font-size:0.62rem;color:var(--k-text-muted);text-align:center;margin-top:6px;padding-top:6px;border-top:1px dashed #e9ecef;line-height:1.35;">\
					Reg: ' + totalInsps + ' · Cump: ' + regComp + ' · Pend: ' + regPend + '\
				</div>\
			';

			widget.querySelectorAll('.ausentismo-toggle').forEach(function(btn) {
				btn.onclick = function() {
					currentMode = btn.dataset.mode;
					render();
				};
			});
		};

		this.widgets.inspecciones = {
			update: function(newData) { data = newData; render(); }
		};

		render();
		return widget;
	}

	createMantenimientoWidget(initialData) {
		var widget = document.createElement('div');
		widget.className = 'widget k-budget-card';

		var currentMode = 'year';
		var data = initialData;

		var render = function() {
			var displayData = data || { totalActividades: 0, completadasMes: 0, pendientesMes: 0, tasaCumplimiento: 0, categoriasCount: 0 };
			var value = currentMode === 'year' ? displayData.totalActividades : displayData.completadasMes;
			var badge = currentMode === 'year' ? (displayData.year || new Date().getFullYear()) : (displayData.mes || '—').substring(0, 3);

			widget.innerHTML = '\
				<div class="kb-header">\
					<span class="kb-title">Mantenimiento</span>\
					<span class="kb-badge" style="background-color: var(--k-primary) !important;">' + badge + '</span>\
				</div>\
				<div class="ausentismo-toggles">\
					<button class="ausentismo-toggle ' + (currentMode === 'year' ? 'active' : '') + '" data-mode="year">Año</button>\
					<button class="ausentismo-toggle ' + (currentMode === 'month' ? 'active' : '') + '" data-mode="month">Mes</button>\
				</div>\
				<div class="kb-amount" style="text-align:center;">\
					<span>' + value + '</span>\
				</div>\
				<div style="font-size:0.72rem;color:var(--k-text-muted);text-align:center;margin-bottom:4px;">\
					Actividades programadas\
				</div>\
				<div class="kb-progress-track" style="margin-bottom: 0.5rem;">\
					<div class="kb-progress-bar" style="width: ' + (displayData.tasaCumplimiento || 0) + '%">\
    <div class="kb-shimmer"></div>\
</div>\
				</div>\
				<div class="kb-footer">\
					<div>\
						<div class="kb-label">Completadas</div>\
						<div class="kb-value kb-exec">' + displayData.completadasMes + '</div>\
					</div>\
					<div style="text-align:right;">\
						<div class="kb-label">Pendientes</div>\
						<div class="kb-value kb-rem">' + displayData.pendientesMes + '</div>\
					</div>\
				</div>\
			';

			widget.querySelectorAll('.ausentismo-toggle').forEach(function(btn) {
				btn.onclick = function() {
					currentMode = btn.dataset.mode;
					render();
				};
			});
		};

		this.widgets.mantenimiento = {
			update: function(newData) { data = newData; render(); }
		};

		render();
		return widget;
	}

  createPeligrosWidget(initialData) {
    var widget = document.createElement('div');
    widget.className = 'widget k-budget-card';

    var data = initialData;

    var render = function() {
      var hasData = data && data.total !== undefined;
      var total = hasData ? data.total : '—';
      var inaceptables = hasData ? (data.inaceptables || 0) : '—';
      var tasa = hasData ? (data.tasaInaceptable || 0) : 0;
      var porAcept = hasData ? (data.porAcept || {}) : {};

      var nrMax = hasData ? (data.maxNR || 0) : '—';

      widget.innerHTML = '\
<div class="kb-header">\
  <span class="kb-title">Peligros GTC-45</span>\
  <span class="kb-badge" style="background:#a855f7 !important;">4.1.2</span>\
</div>\
<div class="kb-amount" style="text-align:center;">\
  <span>' + total + '</span>\
</div>\
<div style="font-size:0.72rem;color:var(--k-text-muted);text-align:center;margin-bottom:4px;">\
  Peligros identificados\
</div>\
<div class="kb-progress-track" style="margin-bottom: 0.5rem;">\
  <div class="kb-progress-bar" style="width: ' + (tasa > 0 ? Math.min(tasa, 100) : 0) + '%;background-color:' + (tasa >= 30 ? 'var(--k-danger)' : 'var(--k-success)') + ';">\
    <div class="kb-shimmer"></div>\
</div>\
</div>\
<div class="kb-footer">\
  <div>\
    <div class="kb-label">Inaceptables</div>\
    <div class="kb-value kb-rem" style="color:' + (inaceptables > 0 ? 'var(--k-danger)' : 'var(--k-success)') + ';">' + inaceptables + '</div>\
  </div>\
  <div style="text-align:right;">\
    <div class="kb-label">NR Máx</div>\
    <div class="kb-value">' + nrMax + '</div>\
  </div>\
</div>\
';
    };

    this.widgets.peligros = {
      update: function(newData) { data = newData; render(); }
    };

    render();
    return widget;
  }

  createMedicionesWidget(initialData) {
		var widget = document.createElement('div');
		widget.className = 'widget k-budget-card';

		var data = initialData;

		var render = function() {
			var hasData = data && data.total !== undefined;
			var total = hasData ? data.total : '—';
			var pendientes = hasData ? data.pendientes : '—';

			widget.innerHTML = '\
				<div class="kb-header">\
					<span class="kb-title">Mediciones Ambientales</span>\
					<span class="kb-badge" style="background:#ffc107 !important;color:#212529;">4.1.4</span>\
				</div>\
				<div class="kb-amount" style="text-align:center;">\
					<span>' + total + '</span>\
				</div>\
				<div style="font-size:0.72rem;color:var(--k-text-muted);text-align:center;margin-bottom:4px;">\
					' + (hasData ? 'Mediciones registradas' : 'Sin datos disponibles') + '\
				</div>\
				<div class="kb-footer">\
					<div>\
						<div class="kb-label">Registradas</div>\
						<div class="kb-value">' + total + '</div>\
					</div>\
					<div style="text-align:right;">\
						<div class="kb-label">Pendientes</div>\
						<div class="kb-value kb-rem">' + pendientes + '</div>\
					</div>\
				</div>\
			';
		};

		this.widgets.mediciones = {
			update: function(newData) { data = newData; render(); }
		};

		render();
		return widget;
	}

	createEPPWidget(initialData) {
		var widget = document.createElement('div');
		widget.className = 'widget k-budget-card';

		var data = initialData;

		var render = function() {
			var hasData = data && data.total !== undefined;
			var total = hasData ? data.total : '—';
			var entregados = hasData ? data.entregados : '—';

			widget.innerHTML = '\
				<div class="kb-header">\
					<span class="kb-title">Entrega de EPP</span>\
					<span class="kb-badge bg-danger">4.2.6</span>\
				</div>\
				<div class="kb-amount" style="text-align:center;">\
					<span>' + total + '</span>\
				</div>\
				<div style="font-size:0.72rem;color:var(--k-text-muted);text-align:center;margin-bottom:4px;">\
					' + (hasData ? 'Elementos entregados' : 'Sin datos disponibles') + '\
				</div>\
				<div class="kb-footer">\
					<div>\
						<div class="kb-label">Entregados</div>\
						<div class="kb-value kb-exec">' + entregados + '</div>\
					</div>\
					<div style="text-align:right;">\
						<div class="kb-label">Pendientes</div>\
						<div class="kb-value kb-rem">' + (hasData ? (data.pendientes || 0) : '—') + '</div>\
					</div>\
				</div>\
			';
		};

		this.widgets.epp = {
			update: function(newData) { data = newData; render(); }
		};

		render();
		return widget;
	}

	renderInspeccionesChart(data) {
		if (typeof Chart === 'undefined') return;
		var canvas = document.getElementById('peligrosInspeccionesChart');
		if (!canvas) return;

		var labels = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
		var currentMonth = new Date().getMonth();

		var completadas = data && data.mensualCompletadas ? data.mensualCompletadas : Array(12).fill(0);
		var pendientes = data && data.mensualPendientes ? data.mensualPendientes : Array(12).fill(0);

		if (!data) {
			completadas = Array(12).fill(0);
			completadas[currentMonth] = 0;
			pendientes = Array(12).fill(0);
		}

		var existingChart = Chart.getChart(canvas);
		if (existingChart) existingChart.destroy();

		new Chart(canvas, {
			type: 'line',
			data: {
				labels: labels,
				datasets: [
					{
						label: 'Completadas',
						data: completadas,
						borderColor: '#28a745',
						backgroundColor: 'rgba(40, 167, 69, 0.1)',
						borderWidth: 2,
						tension: 0.3,
						pointRadius: 4,
						pointBackgroundColor: '#28a745',
						pointBorderColor: '#fff',
						pointBorderWidth: 1,
						fill: false
					},
					{
						label: 'Pendientes',
						data: pendientes,
						borderColor: '#dc3545',
						backgroundColor: 'rgba(220, 53, 69, 0.1)',
						borderWidth: 2,
						tension: 0.3,
						pointRadius: 4,
						pointBackgroundColor: '#dc3545',
						pointBorderColor: '#fff',
						pointBorderWidth: 1,
						fill: false
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: {
						display: true,
						position: 'bottom',
						labels: { font: { size: 10 }, boxWidth: 12, padding: 8 }
					},
					tooltip: {
						callbacks: {
							label: function(ctx) {
								return ' ' + ctx.dataset.label + ': ' + ctx.raw;
							}
						}
					}
				},
				scales: {
					x: {
						grid: { display: false }
					},
					y: {
						beginAtZero: true,
						suggestedMax: 3,
						ticks: { stepSize: 1, precision: 0 },
						grid: { display: false },
						title: { display: true, text: 'Cantidad', font: { size: 10 } }
					}
				}
			}
		});
	}

	renderCumplimientoChart(inspData, mntoData) {
		if (typeof Chart === 'undefined') return;
		var canvas = document.getElementById('peligrosCumplimientoChart');
		if (!canvas) return;

		/* Tasa de cumplimiento de cada módulo = % de ejecutadas sobre el total
		   registrado en ese módulo. Si no hay datos, 0% (y el segmento del
		   donut se renderiza con un placeholder mínimo). */
		var inspRate = inspData && typeof inspData.tasaCumplimiento === "number" ? inspData.tasaCumplimiento : 0;
		var mntoRate = mntoData && typeof mntoData.tasaCumplimiento === "number" ? mntoData.tasaCumplimiento : 0;

		/* Si ambos son 0, mostramos un donut 50/50 gris para no romper la
		   lectura; el header indica el % real. */
		var hasData = (inspRate + mntoRate) > 0;
		var inspSeg = hasData ? Math.max(inspRate, 0.01) : 1;
		var mntoSeg = hasData ? Math.max(mntoRate, 0.01) : 1;

		var inspLabel = hasData
			? 'Inspecciones (' + inspRate + '%)'
			: 'Inspecciones (sin datos)';
		var mntoLabel = hasData
			? 'Mantenimiento (' + mntoRate + '%)'
			: 'Mantenimiento (sin datos)';

		var inspColor = hasData ? 'rgba(40, 167, 69, 0.8)' : 'rgba(108, 117, 125, 0.4)';
		var mntoColor = hasData ? 'rgba(23, 78, 166, 0.8)' : 'rgba(108, 117, 125, 0.4)';

		var existingChart = Chart.getChart(canvas);
		if (existingChart) existingChart.destroy();

		new Chart(canvas, {
			type: 'doughnut',
			data: {
				labels: [inspLabel, mntoLabel],
				datasets: [{
					data: [inspSeg, mntoSeg],
					backgroundColor: [inspColor, mntoColor],
					borderColor: ['#28a745', '#174ea6'],
					borderWidth: 2,
					hoverOffset: 8
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				cutout: '55%',
				plugins: {
					legend: {
						display: true,
						position: 'bottom',
						labels: { font: { size: 10 }, boxWidth: 12, padding: 8 }
					},
					tooltip: {
						callbacks: {
							label: function(ctx) {
								return ' ' + ctx.label;
							}
						}
					}
				}
			}
		});
	}

	renderSubmoduleItem(name) {
		var submoduleItem = document.createElement('div');
		submoduleItem.className = 'submodule-item';
		submoduleItem.innerHTML = '\
			<div class="submodule-info">\
				<div class="submodule-name">' + name + '</div>\
				<div class="submodule-meta">Gestión y registros asociados</div>\
			</div>\
			<button class="btn-ingresar">Ingresar</button>\
		';
		submoduleItem.querySelector('button').onclick = function() {
			showSubmoduleContent(this.container, this.moduleName, name);
		}.bind(this);
		return submoduleItem;
	}

	injectStyles() {
		var styleId = 'k-air-gestion-peligros-styles-v2';
		var oldStyle = document.getElementById(styleId);
		if (oldStyle) oldStyle.remove();

		var style = document.createElement('style');
		style.id = styleId;
		style.textContent = '\
/* =========================================\
1. SISTEMA VISUAL K+AIR (OFICIAL) - GESTION DE PELIGROS\
========================================= */\
.gestion-peligros-home {\
	--k-primary: #174ea6;\
	--k-primary-light: #e8f0fe;\
	--k-primary-hover: #1450a1;\
	--k-success: #28a745;\
	--k-danger: #dc3545;\
	--k-bg-card: #ffffff;\
	--k-bg-app: #f8f9fa;\
	--k-border: #dee2e6;\
	--k-text-main: #212529;\
	--k-text-muted: #6c757d;\
	--k-radius-md: 0.375rem;\
	--k-radius-lg: 0.5rem;\
	--k-shadow-sm: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.05);\
	--k-shadow-md: 0 0.5rem 1rem rgba(0, 0, 0, 0.08);\
	--k-header-height: 60px;\
	--k-font-family: inherit;\
	padding: 1.5rem;\
	background: var(--k-bg-app);\
	height: 100%;\
	overflow-y: auto;\
}\
.widgets-container { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 0 !important; }\
.widget { background: var(--k-bg-card); border: 1px solid var(--k-border); border-radius: var(--k-radius-lg); padding: 1rem; box-shadow: var(--k-shadow-sm); display: flex; flex-direction: column; min-height: 175px; transition: transform 0.2s ease; }\
.widget:hover { transform: translateY(-3px); box-shadow: var(--k-shadow-md); }\
.widget h4 { margin: 0 0 0.5rem 0; font-size: 0.65rem; color: var(--k-text-muted); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }\
.widget-value { font-size: 1.4rem; font-weight: 700; color: var(--k-text-main); margin-bottom: 0.5rem; }\
.widget-description { font-size: 0.65rem; color: var(--k-text-muted); }\
.k-budget-card .kb-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }\
.k-budget-card .kb-title { font-size: 0.65rem; font-weight: 600; color: var(--k-text-muted); text-transform: uppercase; }\
.k-budget-card .kb-badge { font-size: 0.7rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 1rem; color: white; background-color: var(--k-success); }\
.k-budget-card .bg-success { background: var(--k-success) !important; }\
.k-budget-card .bg-danger { background: var(--k-danger) !important; }\
.k-budget-card .kb-amount { font-size: 1.4rem; font-weight: 700; color: var(--k-text-main); margin-bottom: 0.5rem; }\
.k-budget-card .kb-footer { display: flex; justify-content: space-between; margin-top: auto; padding-top: 0.5rem; border-top: 1px solid #eee; }\
.k-budget-card .kb-label { font-size: 0.6rem; color: var(--k-text-muted); text-transform: uppercase; }\
.k-budget-card .kb-value { font-size: 0.6rem; font-weight: 600; }\
.kb-exec { color: var(--k-success); }\
.kb-rem { color: var(--k-primary); }\
.kb-progress-track { width: 100%; height: 10px; background: #e9ecef; border-radius: 5px; overflow: hidden; margin-bottom: 0.5rem; position: relative; }\
.kb-subnote { margin-top: auto; flex-shrink: 0; }\
.kb-progress-bar { height: 100%; width: 0%; border-radius: 5px; background-color: var(--k-success); transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.3s; }\
.ausentismo-toggles { display: flex; gap: 4px; margin: 4px 0; background: #f1f3f4; padding: 3px; border-radius: 6px; }\
.ausentismo-toggle { flex: 1; border: none; background: transparent; font-size: 0.7rem; padding: 2px 6px; border-radius: var(--k-radius-md); cursor: pointer; color: var(--k-text-muted); transition: all 0.2s; }\
.ausentismo-toggle.active { background: white; color: var(--k-primary); box-shadow: var(--k-shadow-sm); font-weight: 600; }\
.submodules-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem; }\
.submodule-item { display: flex; align-items: center; justify-content: space-between; padding: 1rem; background-color: #fcfcfc; border: 1px solid var(--k-border); border-radius: var(--k-radius-md); transition: all 0.2s ease; }\
.submodule-item:hover { background-color: var(--k-primary-light); border-color: var(--k-primary); transform: translateX(5px); }\
.btn-ingresar { background-color: var(--k-primary); color: white; border: none; padding: 0.5rem 1.25rem; border-radius: var(--k-radius-md); font-weight: 500; cursor: pointer; transition: background 0.2s; white-space: nowrap; }\
.btn-ingresar:hover { background-color: var(--k-primary-hover); }\
.main-area { display: flex; flex-direction: column; gap: 1rem; }\
.submodules-container { background: var(--k-bg-card); border: 1px solid var(--k-border); border-radius: var(--k-radius-lg); padding: 1.5rem; box-shadow: var(--k-shadow-sm); margin-top: 0 !important; }\
.submodules-container h3 { margin-top: 0; margin-bottom: 1rem; font-size: 1.1rem; font-weight: 600; color: var(--k-text-main); padding-bottom: 1rem; border-bottom: 1px solid var(--k-border); text-transform: uppercase; letter-spacing: 0.05em; }\
.chart-container { background: var(--k-bg-card); border: 1px solid var(--k-border); border-radius: var(--k-radius-lg); padding: 1.5rem; box-shadow: var(--k-shadow-sm); min-height: 350px; max-height: 350px; display: flex; flex-direction: column; }\
.chart-container h3 { margin-top: 0; margin-bottom: 1rem; font-size: 1.1rem; font-weight: 600; color: var(--k-text-main); text-transform: uppercase; letter-spacing: 0.05em; }\
.chart-placeholder { flex: 1; min-height: 0; display: flex; flex-direction: column; }\
.chart-placeholder canvas { flex: 1; min-height: 0; width: 100% !important; height: 100% !important; }\
.charts-grid-peligros { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }\
@media (max-width: 992px) { .charts-grid-peligros { grid-template-columns: 1fr; } }\
/* ANULAR ESTILOS GLOBALES (styles.css) */\
.gestion-peligros-home .widget { margin-bottom: 0 !important; padding: 1rem !important; }\
.gestion-peligros-home .chart-container { margin-top: 0 !important; margin-bottom: 0 !important; }\
.gestion-peligros-home .charts-grid-peligros { margin-top: 0 !important; }\
/* =========================================\
TEMA OSCURO (MODO SYSTEM/DARK)\
========================================= */\
[data-theme="dark"] .gestion-peligros-home {\
	--k-primary: #4da6ff;\
	--k-primary-light: rgba(77, 166, 255, 0.15);\
	--k-primary-hover: #66b3ff;\
	--k-success: #5cb85c;\
	--k-danger: #d9534f;\
	--k-bg-card: #2d3748;\
	--k-bg-app: #1a202c;\
	--k-border: #4a5568;\
	--k-text-main: #e9ecef;\
	--k-text-muted: #adb5bd;\
	--k-shadow-sm: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.3);\
	--k-shadow-md: 0 0.5rem 1rem rgba(0, 0, 0, 0.4);\
}\
[data-theme="dark"] .ausentismo-toggles { background: #374151; }\
[data-theme="dark"] .ausentismo-toggle.active { background: #4a5568; }\
[data-theme="dark"] .kb-progress-track { background: #4a5568; }\
[data-theme="dark"] .k-budget-card .kb-footer { border-top-color: #4a5568; }\
[data-theme="dark"] .submodule-item { background-color: #374151; }\
/* =========================================\
TEMA OSCURO (DARK-LEGACY)\
========================================= */\
[data-theme="dark-legacy"] .gestion-peligros-home {\
	--k-primary: #9e9e9e;\
	--k-primary-light: rgba(158, 158, 158, 0.15);\
	--k-primary-hover: #bdbdbd;\
	--k-success: #4caf50;\
	--k-danger: #f44336;\
	--k-bg-card: #1e1e1e;\
	--k-bg-app: #121212;\
	--k-border: #404040;\
	--k-text-main: #e0e0e0;\
	--k-text-muted: #a0a0a0;\
	--k-shadow-sm: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.6);\
	--k-shadow-md: 0 0.5rem 1rem rgba(0, 0, 0, 0.8);\
}\
[data-theme="dark-legacy"] .ausentismo-toggles { background: #2d2d2d; }\
[data-theme="dark-legacy"] .ausentismo-toggle.active { background: #3a3a3a; }\
[data-theme="dark-legacy"] .kb-progress-track { background: #3a3a3a; }\
[data-theme="dark-legacy"] .k-budget-card .kb-footer { border-top-color: #3a3a3a; }\
[data-theme="dark-legacy"] .submodule-item { background-color: #2d2d2d; }\
';
		document.head.appendChild(style);
	}
}

window.GestionPeligrosHome = GestionPeligrosHome;
