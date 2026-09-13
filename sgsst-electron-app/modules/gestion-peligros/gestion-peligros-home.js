// gestion-peligros-home.js - Componente para el home del módulo "Gestión de Peligros y Riesgos"
// 📦754 · Rediseño premium visual (header minimal + hero + 3 metric cards + chart + radar + grid).

class GestionPeligrosHome {
	constructor(container, moduleName, submodules, companyName) {
		this.container = container;
		this.moduleName = moduleName;
		this.submodules = submodules;
		// 📦748 · Aceptar currentCompany como parámetro del shell (misma forma que Recursos).
		this.currentCompany = companyName || this.getCurrentCompany() || null;
		this.peligrosStats = null;
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
					<span>Peligros</span>
				</div>
				<h1>Gestión de Peligros y Riesgos</h1>
			</div>
		`;
		layout.appendChild(header);

		// Contenedor Principal
		const contentContainer = document.createElement('div');
		contentContainer.className = 'gestion-peligros-home';
		contentContainer.id = 'app-container';

		// Área Principal
		const mainArea = document.createElement('div');
		mainArea.className = 'main-area';
		mainArea.style.flex = '1';

		// 📦491 — Skeleton mientras cargan las estadísticas de Gestión Peligros
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

		// 📦754 · El rediseño premium usa SVG (renderChartPeligros) en vez de Chart.js.
		// renderInspeccionesChart/renderCumplimientoChart ya no aplican al home.
		// Los métodos quedan vivos por si se necesitan en otros submódulos.
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
		const styleId = 'k-air-gestion-peligros-styles-v2';
		const oldStyle = document.getElementById(styleId);
		if (oldStyle) oldStyle.remove();

		const style = document.createElement('style');
		style.id = styleId;
		style.textContent = `
			/* =========================================
			   1. SISTEMA VISUAL K+AIR (OFICIAL — GESTIÓN PELIGROS)
			   ========================================= */
			.gestion-peligros-home {
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

				/* Scroll interno (mismo patrón que Recursos/Gestión Integral/Salud) */
				height: 100%;
				overflow: hidden auto;
				background: #f8f9fa;
				padding: clamp(15px, 1.8vw, 22px);
				box-sizing: border-box;
			}
			.gestion-peligros-home .main-area {
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
		var stats = this.peligrosStats || {};
		var tareas = [];
		var inspecciones = stats.inspecciones || {};
		if ((inspecciones.vencidas || 0) > 0) {
			tareas.push({
				icon: '◷', bg: '#ffe9e9', color: '#a83a48',
				title: 'Inspecciones vencidas',
				sub: inspecciones.vencidas + ' inspecciones pendientes',
				status: 'Pendiente', statusClass: 'kair-status-pill--warn'
			});
		}
		var mantenimiento = stats.mantenimiento || {};
		if ((mantenimiento.atrasado || 0) > 0) {
			tareas.push({
				icon: '◷', bg: '#fff5e6', color: '#c28316',
				title: 'Mantenimiento atrasado',
				sub: mantenimiento.atrasado + ' equipos sin mantenimiento',
				status: 'Pendiente', statusClass: 'kair-status-pill--warn'
			});
		}
		var epp = stats.epp || {};
		if ((epp.pendientes || 0) > 0) {
			tareas.push({
				icon: '◷', bg: '#f0eaff', color: '#6b3fb8',
				title: 'EPP sin entregar',
				sub: epp.pendientes + ' entregas pendientes',
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

	renderChartPeligros(stats) {
		var el = document.getElementById('kair-chart-peligros');
		if (!el) return;
		var inspecciones = (stats.inspecciones && stats.inspecciones.total) || 0;
		var inspeccionesCumplidas = (stats.inspecciones && stats.inspecciones.realizadas) || 0;
		var mantenimiento = (stats.mantenimiento && stats.mantenimiento.total) || 0;
		var mantenimientoHecho = (stats.mantenimiento && stats.mantenimiento.completados) || 0;
		var peligros = (stats.peligros && stats.peligros.total) || 0;
		var peligrosEvaluados = (stats.peligros && stats.peligros.evaluados) || 0;
		var mediciones = (stats.mediciones && stats.mediciones.total) || 0;
		var medicionesHechas = (stats.mediciones && stats.mediciones.realizadas) || 0;

		var items = [
			{ label: 'Inspecciones', total: inspecciones, value: inspeccionesCumplidas, color: '#174ea6' },
			{ label: 'Mantenimiento', total: mantenimiento, value: mantenimientoHecho, color: '#178666' },
			{ label: 'Peligros', total: peligros, value: peligrosEvaluados, color: '#c28316' },
			{ label: 'Mediciones', total: mediciones, value: medicionesHechas, color: '#a83a48' }
		];

		var rowH = 32;
		var gapY = 8;
		var PAD_L = 120, PAD_R = 80, PAD_T = 14, PAD_B = 14;
		var H = PAD_T + PAD_B + items.length * (rowH + gapY);
		var W = 690;
		var barX = PAD_L;
		var barW = W - PAD_L - PAD_R;

		var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" style="width:100%;height:auto;display:block;">';
		for (var i = 0; i < items.length; i++) {
			var item = items[i];
			var y = PAD_T + i * (rowH + gapY);
			var barY = y;
			var pct = item.total > 0 ? Math.round((item.value / item.total) * 100) : 0;
			var filledW = Math.max(2, (barW * pct) / 100);
			// Label a la izquierda
			svg += '<text x="' + (PAD_L - 10) + '" y="' + (barY + rowH / 2 + 4) + '" text-anchor="end" font-family="Manrope, sans-serif" font-size="11" fill="#637189">' + item.label + '</text>';
			// Track
			svg += '<rect x="' + barX + '" y="' + barY + '" width="' + barW + '" height="' + rowH + '" rx="6" ry="6" fill="#eef0f1"/>';
			// Fill
			svg += '<rect x="' + barX + '" y="' + barY + '" width="' + filledW + '" height="' + rowH + '" rx="6" ry="6" fill="' + item.color + '"/>';
			// Value a la derecha: "X / Y (Z%)"
			var label = item.value + ' / ' + item.total + '  (' + pct + '%)';
			svg += '<text x="' + (W - PAD_R) + '" y="' + (barY + rowH / 2 + 4) + '" text-anchor="end" font-family="Manrope, sans-serif" font-size="11" font-weight="600" fill="#212529">' + label + '</text>';
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
		// 📦754 · Renderizar contenido premium del módulo Gestión de Peligros y Riesgos.
		container.innerHTML = '';

		const stats = this.peligrosStats || {};
		const inspecciones = stats.inspecciones || { total: 0, realizadas: 0, pendientes: 0, vencidas: 0 };
		const mantenimiento = stats.mantenimiento || { total: 0, completados: 0, atrasado: 0 };
		const peligros = stats.peligros || { total: 0, evaluados: 0 };
		const mediciones = stats.mediciones || { total: 0, realizadas: 0 };
		const epp = stats.epp || { total: 0, entregados: 0, pendientes: 0 };

		// 📦754 · cumplimientoGeneral: score compuesto del módulo.
		const cumplimientoInspecciones = inspecciones.total > 0 ? Math.round((inspecciones.realizadas / inspecciones.total) * 100) : null;
		const cumplimientoMantenimiento = mantenimiento.total > 0 ? Math.round((mantenimiento.completados / mantenimiento.total) * 100) : null;
		const cumplimientoPeligros = peligros.total > 0 ? Math.round((peligros.evaluados / peligros.total) * 100) : null;
		const cumplimientoMediciones = mediciones.total > 0 ? Math.round((mediciones.realizadas / mediciones.total) * 100) : null;
		const cumplimientoEPP = epp.total > 0 ? Math.round((epp.entregados / epp.total) * 100) : null;
		const compGeneralArr = [cumplimientoInspecciones, cumplimientoMantenimiento, cumplimientoPeligros, cumplimientoMediciones, cumplimientoEPP].filter(function (v) { return v !== null; });
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
		const tareasPendientes = (inspecciones.vencidas || 0) +
			(mantenimiento.atrasado || 0) +
			(epp.pendientes || 0);
		hero.innerHTML = ''
			+ '<div class="kair-hero-eyebrow">Estado general</div>'
			+ '<h2>' + heroMsg + '</h2>'
			+ '<p class="kair-hero-msg">Hay ' + tareasPendientes + ' actividades que necesitan atención este mes.</p>'
			+ '<div class="kair-hero-score">' + cumplimientoGeneral + '%<span>cumplimiento</span></div>';
		health.appendChild(hero);

		const inspeccionesPct = cumplimientoInspecciones || 0;
		const mantenimientoPct = cumplimientoMantenimiento || 0;
		const peligrosPct = cumplimientoPeligros || 0;
		health.appendChild(this.renderMetricCard({
			label: 'Inspecciones',
			valueHTML: (inspecciones.realizadas || 0) + ' <small style="font:500 15px DM Sans;color:#8791a1">/ ' + (inspecciones.total || 0) + '</small>',
			desc: 'Inspecciones realizadas',
			progressPct: inspeccionesPct,
			variant: inspeccionesPct >= 70 ? 'ok' : inspeccionesPct >= 40 ? 'warning' : 'danger'
		}));
		health.appendChild(this.renderMetricCard({
			label: 'Mantenimiento',
			valueHTML: (mantenimiento.completados || 0) + ' <small style="font:500 15px DM Sans;color:#8791a1">/ ' + (mantenimiento.total || 0) + '</small>',
			desc: 'Mantenimientos completados',
			progressPct: mantenimientoPct,
			variant: mantenimientoPct >= 70 ? 'ok' : mantenimientoPct >= 40 ? 'warning' : 'danger'
		}));
		health.appendChild(this.renderMetricCard({
			label: 'Peligros identificados',
			valueHTML: (peligros.evaluados || 0) + ' <small style="font:500 15px DM Sans;color:#8791a1">/ ' + (peligros.total || 0) + '</small>',
			desc: 'Peligros evaluados',
			progressPct: peligrosPct,
			variant: peligrosPct >= 70 ? 'ok' : peligrosPct >= 40 ? 'warning' : 'danger'
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
			+ '    <h3>Cumplimiento por área</h3>'
			+ '    <div class="kair-card-hint">Inspecciones · Mantenimiento · Peligros · Mediciones</div>'
			+ '  </div>'
			+ '</div>'
			+ '<div class="kair-chart" id="kair-chart-peligros"></div>';
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

		this.renderChartPeligros(stats);
		this.renderSubmodulesGrid();
	}


}

window.GestionPeligrosHome = GestionPeligrosHome;
