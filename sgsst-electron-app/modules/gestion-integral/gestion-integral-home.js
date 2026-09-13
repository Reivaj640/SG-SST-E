// gestion-integral-home.js - Componente para el home del módulo "Gestión Integral"
// 📦754 · Rediseño premium visual (header minimal + hero + 3 metric cards + chart + radar + grid).

class GestionIntegralHome {
    constructor(container, moduleName, submodules, companyName) {
        this.container = container;
        this.moduleName = moduleName;
        this.submodules = submodules;
        // 📦748 · Aceptar currentCompany como parámetro del shell (misma forma que Recursos).
        this.currentCompany = companyName || this.getCurrentCompany() || null;
        this.gestionIntegralStats = null;
    }

    getCurrentCompany() {
        if (window.currentCompany && window.currentCompany !== 'default_company') return window.currentCompany;
        if (window.rendererState && window.rendererState.selectedCompany) return window.rendererState.selectedCompany;
        if (window.currentModule && window.currentModule.company) return window.currentModule.company;
        const domCompany = document.getElementById('company-name');
        if (domCompany && domCompany.textContent && domCompany.textContent !== 'Empresa') return domCompany.textContent.trim();
        return 'default_company';
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
                    <span>Integral</span>
                </div>
                <h1>Gestión Integral</h1>
            </div>
        `;
        layout.appendChild(header);

        // Contenedor Principal
        const contentContainer = document.createElement('div');
        contentContainer.className = 'gestion-integral-home';
        contentContainer.id = 'app-container';

        // Área Principal
        const mainArea = document.createElement('div');
        mainArea.className = 'main-area';
        mainArea.style.flex = '1';

        // 📦491 — Skeleton mientras cargan estadísticas de Gestión Integral (4 widgets + 1 chart)
        mainArea.innerHTML = KairSkeleton.kpiStrip(4) + KairSkeleton.chartBars(12);

        // 📦491-fix — Agregar al DOM ANTES del await para que el skeleton sea visible
        contentContainer.appendChild(mainArea);
        layout.appendChild(contentContainer);
        this.container.appendChild(layout);

        // 📦491-fix — Retardo de 200ms para que el browser pinte el skeleton y el ojo lo registre
        // antes de que JS continue con la carga. Sin esto, el skeleton se borra antes de verse.
        await new Promise(r => setTimeout(r, 200));

        // 0. Cargar estadísticas reales de Gestión Integral (skeleton visible durante la espera)
        await this.loadGestionIntegralStats();

        // 1. Renderizar contenido (limpia el skeleton y pinta widgets reales)
        await this.renderMainArea(mainArea);

        // 📦754 · El rediseño premium usa SVG (renderChartPlan) en vez de Chart.js.
        // initCharts ya no aplica — los canvases del layout legacy no existen en el nuevo home.
        // setTimeout(() => this.initCharts(), 100); // 📦754 — deshabilitado por rediseño premium
    }

    injectStyles() {
        const styleId = 'k-air-gestion-integral-styles-v2';
        const oldStyle = document.getElementById(styleId);
        if (oldStyle) oldStyle.remove();

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            /* =========================================
               1. SISTEMA VISUAL K+AIR (OFICIAL — GESTIÓN INTEGRAL)
               ========================================= */
            .gestion-integral-home {
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

                /* Scroll interno (mismo patrón que Recursos) */
                height: 100%;
                overflow: hidden auto;
                background: #f8f9fa;
                padding: clamp(15px, 1.8vw, 22px);
                box-sizing: border-box;
            }
            .gestion-integral-home .main-area {
                flex: 1 1 auto;
                min-height: 0;
                overflow-y: auto;
            }
        `;
        document.head.appendChild(style);
    }

    async renderMainArea(container) {
        // 📦491-fix — Limpiar skeleton antes de pintar widgets reales
        container.innerHTML = '';

        // Stats reales del módulo (con fallbacks seguros)
        const stats = this.gestionIntegralStats || {};
        const politica = stats.politica || { estado: 'No disponible', actualizada: null };
        const objetivos = stats.objetivos || { total: 0, cumplidos: 0, porcentaje: 0 };
        const plan_trabajo = stats.plan_trabajo || {
            totalActividades: 0,
            actividadesEjecutadas: 0,
            actividadesPendientes: 0,
            actividadesProgramadas: 0,
            porcentajeAvance: 0,
            ultimoMesRegistrado: null,
            estado: 'warning'
        };
        const rendicion = stats.rendicion_cuentas || { actas_realizadas: 0 };
        const cambios = stats.cambios || {
            pipeline: { solicitud: 0, evaluacion: 0, aprobado: 0, ejecucion: 0, cerrado: 0 },
            total: 0,
            pending: 0,
            disponible: false
        };
        const evaluacion = stats.evaluacion_inicial || {
            disponible: false,
            combinado: { cumplimiento: 0 }
        };

        // 📦754 · cumplimientoGeneral: score compuesto del módulo.
        // Promedio simple de los componentes disponibles, excluyendo los sin datos.
        const cumplimientoPlan = plan_trabajo.totalActividades > 0 ? plan_trabajo.porcentajeAvance : null;
        const cumplimientoObjetivos = objetivos.total > 0 ? objetivos.porcentaje : null;
        const cumplimientoEvaluacion = evaluacion.disponible ? (evaluacion.combinado.cumplimiento || 0) : null;
        const politicaOk = politica.actualizada === true ? 100 : (politica.actualizada === false ? 0 : null);
        const rendicionOk = rendicion.actas_realizadas > 0 ? 100 : 0;
        const cambiosOk = cambios.total > 0 ? (cambios.pending === 0 ? 100 : 0) : null;
        const compGeneralArr = [cumplimientoPlan, cumplimientoObjetivos, cumplimientoEvaluacion, politicaOk, rendicionOk, cambiosOk].filter(function (v) { return v !== null; });
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
        // 📦754 · Tareas pendientes: incluye TODOS los pendientes del módulo
        const tareasPendientes = (plan_trabajo.actividadesPendientes || 0) +
            (cambios.pending || 0) +
            (rendicion.actas_realizadas > 0 ? 0 : 1) +
            (politica.actualizada === false ? 1 : 0);
        hero.innerHTML = ''
            + '<div class="kair-hero-eyebrow">Estado general</div>'
            + '<h2>' + heroMsg + '</h2>'
            + '<p class="kair-hero-msg">Hay ' + tareasPendientes + ' actividades que necesitan atención este mes.</p>'
            + '<div class="kair-hero-score">' + cumplimientoGeneral + '%<span>cumplimiento</span></div>';
        health.appendChild(hero);

        const planPct = cumplimientoPlan || 0;
        const objetivosPct = cumplimientoObjetivos || 0;
        const evaluacionPct = cumplimientoEvaluacion || 0;
        health.appendChild(this.renderMetricCard({
            label: 'Plan de trabajo anual',
            valueHTML: (plan_trabajo.actividadesEjecutadas || 0) + ' <small style="font:500 15px DM Sans;color:#8791a1">/ ' + (plan_trabajo.totalActividades || 0) + '</small>',
            desc: 'Actividades ejecutadas',
            progressPct: planPct,
            variant: planPct >= 70 ? 'ok' : planPct >= 40 ? 'warning' : 'danger'
        }));
        health.appendChild(this.renderMetricCard({
            label: 'Objetivos SST',
            valueHTML: (objetivos.cumplidos || 0) + ' <small style="font:500 15px DM Sans;color:#8791a1">/ ' + (objetivos.total || 0) + '</small>',
            desc: 'Indicadores cumplidos',
            progressPct: objetivosPct,
            variant: objetivosPct >= 70 ? 'ok' : objetivosPct >= 40 ? 'warning' : 'danger'
        }));
        health.appendChild(this.renderMetricCard({
            label: 'Evaluación inicial',
            valueHTML: evaluacionPct.toFixed(1) + '<span style="font:600 16px DM Sans">%</span>',
            desc: 'Cumplimiento combinado',
            progressPct: evaluacionPct,
            variant: evaluacionPct >= 70 ? 'ok' : evaluacionPct >= 40 ? 'warning' : 'danger'
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
            + '    <h3>Ejecución del Plan Anual</h3>'
            + '    <div class="kair-card-hint">Avance anual · actividades programadas vs ejecutadas</div>'
            + '  </div>'
            + '</div>'
            + '<div class="kair-chart" id="kair-chart-plan"></div>';
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

        // Renderizar chart SVG y submódulos (data-driven, después del DOM)
        this.renderChartPlan(plan_trabajo);
        this.renderSubmodulesGrid();
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
        var stats = this.gestionIntegralStats || {};
        var tareas = [];
        var politica = stats.politica || {};
        if (politica.actualizada === false) {
            tareas.push({
                icon: '◷', bg: '#fff5e6', color: '#c28316',
                title: 'Política del SG-SST',
                sub: 'Pendiente de actualización',
                status: 'Pendiente', statusClass: 'kair-status-pill--warn'
            });
        }
        var rendicion = stats.rendicion_cuentas || {};
        if ((rendicion.actas_realizadas || 0) === 0) {
            tareas.push({
                icon: '◷', bg: '#eff7f5', color: '#178666',
                title: 'Rendición de cuentas',
                sub: 'Aún no hay actas registradas',
                status: 'Pendiente', statusClass: 'kair-status-pill--warn'
            });
        }
        var cambios = stats.cambios || {};
        if ((cambios.pending || 0) > 0) {
            tareas.push({
                icon: '◷', bg: '#f0eaff', color: '#6b3fb8',
                title: 'Gestión del Cambio',
                sub: cambios.pending + ' solicitudes en pipeline',
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

    renderChartPlan(data) {
        var el = document.getElementById('kair-chart-plan');
        if (!el) return;
        var porcentaje = data.porcentajeAvance || 0;
        var total = data.totalActividades || 0;
        var ejecutadas = data.actividadesEjecutadas || 0;
        var pendientes = data.actividadesPendientes || 0;
        var W = 690, H = 170;
        var PAD_L = 30, PAD_R = 10, PAD_T = 14, PAD_B = 24;
        // 📦754 · Línea simple de % acumulado + barra horizontal con progreso.
        // Si en el futuro hay datos mensuales, se reemplaza por curva SVG.
        var pctVal = Math.min(100, porcentaje);
        var barX = PAD_L;
        var barW = (W - PAD_L - PAD_R);
        var barH = 22;
        var barY = (H - PAD_B) / 2 - barH / 2;
        var filledW = (barW * pctVal) / 100;

        // Construir SVG con barra horizontal + leyenda + sub-texto
        var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" style="width:100%;height:auto;display:block;">'
            + '<line x1="' + PAD_L + '" y1="' + (H - PAD_B) + '" x2="' + (W - PAD_R) + '" y2="' + (H - PAD_B) + '" stroke="#e9ecef" stroke-width="1"/>'
            + '<text x="' + PAD_L + '" y="' + (PAD_T + 14) + '" font-family="Manrope, sans-serif" font-size="12" fill="#637189">Progreso anual del Plan de Trabajo SST</text>'
            + '<text x="' + (W - PAD_R) + '" y="' + (PAD_T + 14) + '" text-anchor="end" font-family="Manrope, sans-serif" font-size="20" font-weight="800" fill="#174ea6">' + porcentaje + '%</text>'
            + '<rect x="' + barX + '" y="' + barY + '" width="' + barW + '" height="' + barH + '" rx="11" ry="11" fill="#eef0f1"/>'
            + '<rect x="' + barX + '" y="' + barY + '" width="' + filledW + '" height="' + barH + '" rx="11" ry="11" fill="#174ea6"/>'
            + '</svg>';

        el.innerHTML = ''
            + svg
            + '<div style="display:flex;justify-content:space-between;margin-top:10px;font:500 12px Manrope;color:#637189;">'
            + '  <span><strong style="color:#212529;">' + ejecutadas + '</strong> ejecutadas</span>'
            + '  <span><strong style="color:#212529;">' + pendientes + '</strong> pendientes</span>'
            + '  <span><strong style="color:#212529;">' + total + '</strong> totales</span>'
            + '</div>';
    }

    renderSubmodulesGrid() {
        var grid = document.getElementById('kair-submodules-grid');
        if (!grid) return;
        // 📦754 · Mostrar TODOS los submódulos del módulo (no solo los primeros N).
        // El grid CSS responsivo (auto-fill + minmax) se ajusta solo.
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

    createWidgetGestionCambioPipeline(data) {
        const widget = document.createElement('div');
        widget.className = 'widget k-budget-card';
        widget.style.cursor = 'pointer';
        widget.title = 'Ver Gestión del Cambio';

        const p = data.pipeline || { solicitud: 0, evaluacion: 0, aprobado: 0, ejecucion: 0, cerrado: 0 };
        const total = data.total || 0;
        const cerrados = p.cerrado || 0;
        const activos = total - cerrados;
        const pctCerrado = total > 0 ? Math.round((cerrados / total) * 100) : 0;

        // Color del bar y badge: success si hay muchos cerrados, warning si pocos
        const colorVar = pctCerrado >= 80 ? 'var(--k-success)'
                      : pctCerrado >= 50 ? 'var(--k-warning)'
                      : 'var(--k-danger)';
        const badgeCls = total === 0 ? 'bg-secondary'
                       : activos === 0 ? 'bg-success'
                       : 'bg-warning';

        const descripcion = total === 0
            ? 'Sin cambios registrados'
            : `${activos} activo${activos === 1 ? '' : 's'} en pipeline`;

        widget.innerHTML = `
            <div class="kb-header">
                <span class="kb-title">Gestión del Cambio</span>
                <span class="kb-badge ${badgeCls}">${total}</span>
            </div>
            <div class="kb-amount" style="font-size: 1.4rem;">${activos} / ${total}</div>
            <div class="kb-description">${descripcion}</div>
            <div class="kb-progress-track">
                <div class="kb-progress-bar" style="width: 0%; background-color: ${colorVar};">
                    <div class="kb-shimmer"></div>
                </div>
            </div>
            <div class="kb-footer">
                <div>
                    <div class="kb-label">Activos</div>
                    <div class="kb-value kb-exec" style="color: var(--k-success);">${activos}</div>
                </div>
                <div style="text-align: right;">
                    <div class="kb-label">Cerrados</div>
                    <div class="kb-value kb-rem" style="color: var(--k-text-muted);">${cerrados}</div>
                </div>
            </div>
        `;

        // Animar la barra después de mount
        setTimeout(() => {
            const bar = widget.querySelector('.kb-progress-bar');
            if (bar) bar.style.width = `${pctCerrado}%`;
        }, 100);

        widget.addEventListener('click', () => {
            if (typeof showSubmoduleContent === 'function') {
                showSubmoduleContent(this.container, this.moduleName, '2.11.1 Gestión del Cambio');
            }
        });

        return widget;
    }

    /**
     * 📦XXX — Widget de Cambios Pendientes por Antigüedad (2.11.1).
     * Esquema: misma estructura que los otros widgets del home (k-budget-card):
     *   header (title + badge) → amount (big number) → description → progress bar
     *   → 2 stats al fondo (Recientes | Críticos).
     * Click → ir al módulo 2.11.1.
     *
     * @param {Object} data - { aging: {'0_15', '16_30', '31_60', '60_plus'}, pending, disponible }
     */
    createWidgetGestionCambioAging(data) {
        const widget = document.createElement('div');
        widget.className = 'widget k-budget-card';
        widget.style.cursor = 'pointer';
        widget.title = 'Ver Gestión del Cambio';

        const a = data.aging || { '0_15': 0, '16_30': 0, '31_60': 0, '60_plus': 0 };
        const pending = data.pending || 0;
        const recientes = a['0_15'] || 0;
        const criticos = a['60_plus'] || 0;
        const pctCriticos = pending > 0 ? Math.round((criticos / pending) * 100) : 0;

        // Color del bar: rojo si hay críticos, amarillo si hayViejos, verde si solo recientes
        const hayViejos = (a['16_30'] || 0) + (a['31_60'] || 0) > 0;
        const colorVar = criticos > 0 ? 'var(--k-danger)'
                      : hayViejos  ? 'var(--k-warning)'
                      : 'var(--k-success)';
        const badgeCls = pending === 0 ? 'bg-secondary'
                       : criticos > 0 ? 'bg-danger'
                       : 'bg-warning';

        const descripcion = pending === 0
            ? 'Sin cambios pendientes'
            : criticos > 0
                ? `${criticos} con más de 60 días`
                : hayViejos
                    ? 'Hay cambios con más de 15 días'
                    : 'Todos dentro de los primeros 15 días';

        widget.innerHTML = `
            <div class="kb-header">
                <span class="kb-title">Cambios Pendientes</span>
                <span class="kb-badge ${badgeCls}">${pending}</span>
            </div>
            <div class="kb-amount" style="font-size: 1.4rem;">${recientes} / ${pending}</div>
            <div class="kb-description">${descripcion}</div>
            <div class="kb-progress-track">
                <div class="kb-progress-bar" style="width: 0%; background-color: ${colorVar};">
                    <div class="kb-shimmer"></div>
                </div>
            </div>
            <div class="kb-footer">
                <div>
                    <div class="kb-label">Recientes</div>
                    <div class="kb-value kb-exec" style="color: var(--k-success);">${recientes}</div>
                </div>
                <div style="text-align: right;">
                    <div class="kb-label">Críticos</div>
                    <div class="kb-value" style="color: var(--k-danger);">${criticos}</div>
                </div>
            </div>
        `;

        // Animar la barra después de mount
        setTimeout(() => {
            const bar = widget.querySelector('.kb-progress-bar');
            if (bar) bar.style.width = `${pctCriticos}%`;
        }, 100);

        widget.addEventListener('click', () => {
            if (typeof showSubmoduleContent === 'function') {
                showSubmoduleContent(this.container, this.moduleName, '2.11.1 Gestión del Cambio');
            }
        });

        return widget;
    }

    createWidget(title, value, description) {
        const widget = document.createElement('div');
        widget.className = 'widget k-budget-card';
        widget.innerHTML = `
            <div class="kb-header">
                <span class="kb-title">${title}</span>
            </div>
            <div class="kb-amount">${value}</div>
            <div class="kb-description">${description}</div>
        `;
        return widget;
    }

    // Nuevo método para crear widget de Plan de Trabajo (estilo K+AIR Budget Card)
    createPlanTrabajoWidget(stats) {
        const currentYear = new Date().getFullYear();

        // 📦698 · FIX: usar conteos por CELDAS (consistente con el dashboard)
        //   Programadas = celdas con C o P
        //   Realizadas = celdas con C
        //   Pendientes = celdas con P
        const percentage = stats.porcentajeAvanceCeldas || 0;
        const executed = stats.celdasEjecutadas || 0;
        const pending = stats.celdasPendientes || 0;
        const total = stats.celdasProgramadas || 0;

        // Determinar color (semáforo)
        let colorVar = 'var(--k-success)';
        let colorClass = 'bg-success';
        if (percentage < 50) {
            colorVar = 'var(--k-danger)';
            colorClass = 'bg-danger';
        } else if (percentage < 80) {
            colorVar = 'var(--k-warning)';
            colorClass = 'bg-warning';
        }

        const w = document.createElement('div');
        w.className = 'widget k-budget-card';

        w.innerHTML = `
            <div class="kb-header">
                <span class="kb-title">Plan de Trabajo</span>
                <span class="kb-badge ${colorClass}">${percentage}%</span>
            </div>

            <div class="kb-amount" style="font-size: 1.4rem;">
                ${executed} / ${total}
            </div>
            <div class="kb-description">Celdas del plan anual ejecutadas</div>

            <div class="kb-progress-track">
                <div class="kb-progress-bar" style="width: 0%; background-color: ${colorVar};">
                    <div class="kb-shimmer"></div>
                </div>
            </div>

            <div class="kb-footer">
                <div>
                    <div class="kb-label">Ejecutadas</div>
                    <div class="kb-value kb-exec" style="color: var(--k-success);">${executed}</div>
                </div>
                <div style="text-align: right;">
                    <div class="kb-label">Pendientes</div>
                    <div class="kb-value kb-rem" style="color: var(--k-text-muted);">${pending}</div>
                </div>
            </div>
        `;

        // Animación de barra (después de insertar en DOM)
        setTimeout(() => {
            const bar = w.querySelector('.kb-progress-bar');
            if (bar) {
                bar.style.width = `${percentage}%`;
            }
        }, 100);

        return w;
    }

    // Widget de Archivo y Retención Documental (estilo K+AIR Budget Card)
    createArchivoRetencionWidget(stats) {
        // Determinar color (semáforo por vigencia)
        let colorVar = 'var(--k-success)';
        let colorClass = 'bg-success';
        if (stats.porcentajeVigencia < 50) {
            colorVar = 'var(--k-danger)';
            colorClass = 'bg-danger';
        } else if (stats.porcentajeVigencia < 80) {
            colorVar = 'var(--k-warning)';
            colorClass = 'bg-warning';
        }

        const w = document.createElement('div');
        w.className = 'widget k-budget-card';

        w.innerHTML = `
            <div class="kb-header">
                <span class="kb-title">Gestión Documental</span>
                <span class="kb-badge ${colorClass}">${stats.porcentajeVigencia}%</span>
            </div>

            <div class="kb-amount" style="font-size: 1.4rem;">
                ${stats.vigentes} / ${stats.total}
            </div>
            <div class="kb-description">Documentos con vigencia verificada</div>

            <div class="kb-progress-track">
                <div class="kb-progress-bar" style="width: 0%; background-color: ${colorVar};">
                    <div class="kb-shimmer"></div>
                </div>
            </div>

            <div class="kb-footer">
                <div>
                    <div class="kb-label">Vigentes</div>
                    <div class="kb-value" style="color: var(--k-success);">${stats.vigentes}</div>
                </div>
                <div style="text-align: right;">
                    <div class="kb-label">Obsoletos</div>
                    <div class="kb-value" style="color: var(--k-text-muted);">${stats.obsoletos}</div>
                </div>
            </div>
        `;

        // Animación de barra
        setTimeout(() => {
            const bar = w.querySelector('.kb-progress-bar');
            if (bar) {
                bar.style.width = `${stats.porcentajeVigencia}%`;
            }
        }, 100);

        return w;
    }

    /**
     * Abre el dashboard de Archivo y Retención Documental
     */
    async openArchivoRetencionDashboard() {
        // Buscar el contenedor principal del módulo en el DOM
        const mainContent = document.querySelector('.module-content, .submodule-content, #module-home-page');
        if (!mainContent) {
            console.error('[AR] No se encontró contenedor para el dashboard');
            return;
        }

        // Limpiar y cargar directamente el componente de archivo retención
        // que luego abrirá el dashboard
        if (window.ArchivoRetencionComponent && window.archivoRetencionInstance) {
            window.archivoRetencionInstance.openDashboard();
        } else {
            // Si no hay instancia, crear una nueva
            const tempContainer = document.createElement('div');
            tempContainer.style.cssText = 'width:100%;height:100%;';

            // Reemplazar el contenido actual del panel
            const parent = mainContent.closest('.content-area, .main-content') || mainContent;
            parent.innerHTML = '';
            parent.appendChild(tempContainer);

            const comp = new window.ArchivoRetencionComponent(
                tempContainer,
                this.currentCompany,
                'Gestión Integral',
                '2.5.1 Archivo y retención documental del SG-SST',
                () => this.container.dispatchEvent(new CustomEvent('back-to-module'))
            );
            window.archivoRetencionInstance = comp;
            comp.render();

            // Abrir dashboard después de que el iframe esté listo
            setTimeout(() => comp.openDashboard(), 300);
        }
    }

    /**
     * Crea widget de Evaluación Inicial del SG-SST (estilo K+AIR Metric Card)
     * @param {Object} stats - Estadísticas completas: { combinado, ministerio, arl }
     */
    createEvaluacionInicialWidget(stats) {
        console.log('[EvaluacionWidget] Datos recibidos:', stats);
        
        // Estado del filtro (por defecto 'combinado')
        if (!this.evaluacionFilter) {
            this.evaluacionFilter = 'combinado';
        }

        // Obtener datos según el filtro activo
        const data = stats[this.evaluacionFilter] || stats.combinado || {
            disponible: false,
            cumplimiento: 0,
            hallazgosCriticos: 0,
            totalHallazgos: 0
        };

        console.log('[EvaluacionWidget] Filtro:', this.evaluacionFilter, 'Datos a mostrar:', data);

        const cumplimiento = data.cumplimiento || 0;
        const hallazgosCriticos = data.hallazgosCriticos || 0;
        const totalHallazgos = data.totalHallazgos || 0;

        // Determinar color según cumplimiento
        let colorVar = 'var(--k-danger)';
        let colorClass = 'bg-danger';

        if (cumplimiento >= 80) {
            colorVar = 'var(--k-success)';
            colorClass = 'bg-success';
        } else if (cumplimiento >= 50) {
            colorVar = 'var(--k-warning)';
            colorClass = 'bg-warning';
        }

        const w = document.createElement('div');
        w.className = 'widget k-budget-card';
        w.id = 'evaluacion-inicial-widget';

        w.innerHTML = `
            <div class="kb-header">
                <span class="kb-title">Evaluación Inicial</span>
                <span class="kb-badge ${colorClass}">${cumplimiento}%</span>
            </div>

            <div class="ausentismo-toggles">
                <button class="ausentismo-toggle ${this.evaluacionFilter === 'combinado' ? 'active' : ''}" 
                        onclick="window.currentGestionIntegralHome.updateEvaluacionFilter('combinado')">
                    Todo
                </button>
                <button class="ausentismo-toggle ${this.evaluacionFilter === 'ministerio' ? 'active' : ''}" 
                        onclick="window.currentGestionIntegralHome.updateEvaluacionFilter('ministerio')">
                    🏛️ Min
                </button>
                <button class="ausentismo-toggle ${this.evaluacionFilter === 'arl' ? 'active' : ''}" 
                        onclick="window.currentGestionIntegralHome.updateEvaluacionFilter('arl')">
                    🛡️ ARL
                </button>
            </div>

            <div class="kb-amount" style="font-size: 1.4rem; margin-top: 12px;">
            </div>
            <div class="kb-description">Cumplimiento de estándares del SG-SST</div>

            <div class="kb-progress-track">
                <div class="kb-progress-bar" style="width: 0%; background-color: ${colorVar};">
                    <div class="kb-shimmer"></div>
                </div>
            </div>

            <div class="kb-footer">
                <div>
                    <div class="kb-label">No Cumple</div>
                    <div class="kb-value" style="color: var(--k-danger);">${hallazgosCriticos}</div>
                </div>
                <div style="text-align: right;">
                    <div class="kb-label">Total Estándares</div>
                    <div class="kb-value">${totalHallazgos}</div>
                </div>
            </div>
        `;

        // Animación de barra
        setTimeout(() => {
            const bar = w.querySelector('.kb-progress-bar');
            if (bar) {
                bar.style.width = `${cumplimiento}%`;
            }
        }, 100);

        return w;
    }

    /**
     * Actualiza el filtro de Evaluación Inicial y re-renderiza el widget
     */
    updateEvaluacionFilter(newFilter) {
        console.log('[GestionIntegralHome] Actualizando filtro Evaluación Inicial:', newFilter);
        this.evaluacionFilter = newFilter;
        
        // Re-renderizar el área principal con los nuevos datos
        const container = document.querySelector('.gestion-integral-home .widgets-container');
        if (container && this.gestionIntegralStats) {
            // Eliminar widget actual
            const oldWidget = document.getElementById('evaluacion-inicial-widget');
            if (oldWidget) {
                oldWidget.remove();
            }
            
            // Crear nuevo widget con el filtro actualizado
            const evaluacionStats = this.gestionIntegralStats.evaluacion_inicial || {};
            const newWidget = this.createEvaluacionInicialWidget(evaluacionStats);
            
            // Insertar después del widget de Evaluación Inicial original (o al final)
            const evalWidget = document.getElementById('evaluacion-inicial-widget');
            if (evalWidget && evalWidget.parentElement === container) {
                // Re-insertar en la misma posición que el widget original
                container.insertBefore(newWidget, evalWidget.nextSibling);
            } else {
                // Fallback: insertar después del 3er widget (Plan de Trabajo)
                const planTrabajoWidget = container.children[2];
                if (planTrabajoWidget) {
                    container.insertBefore(newWidget, planTrabajoWidget.nextSibling);
                } else {
                    container.appendChild(newWidget);
                }
            }
        }
    }

    /**
     * Crea la gráfica de dona para el Avance del Plan Anual
     */
    createAnnualPlanChart(stats) {
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;

        // 📦698 · FIX: usar conteos por CELDAS (consistente con el dashboard).
        //   Programadas = celdas con C o P
        //   Realizadas = celdas con C
        //   Pendientes = celdas con P
        //   Vencidas = celdas con P en mes anterior al vigente
        const percentage = stats.porcentajeAvanceCeldas || 0;
        const executed = stats.celdasEjecutadas || 0;
        const pending = stats.celdasPendientes || 0;
        const total = stats.celdasProgramadas || 0;
        const overdue = stats.celdasVencidas || 0;

        // Determinar estado y colores
        let statusClass = 'chart-badge-success';
        let statusText = 'En buen camino';
        let progressColor = 'var(--k-success)';

        const expectedProgress = Math.round((currentMonth / 12) * 100);

        if (percentage < 50) {
            statusClass = 'chart-badge-danger';
            statusText = 'Requiere atención urgente';
            progressColor = 'var(--k-danger)';
        } else if (percentage < expectedProgress) {
            statusClass = 'chart-badge-warning';
            statusText = 'Progreso moderado';
            progressColor = 'var(--k-warning)';
        }

        // Store metadata for fullscreen/windowed text switching
        this._chartMeta = {
            currentYear,
            lastUpdatedText: this.getLastUpdatedText(stats.ultimoMesRegistrado),
            statusText,
            statusClass,
            percentage,
            expectedProgress
        };
        
        // SVG Parameters
        const size = 160;
        const strokeWidth = 18;
        const radius = (size - strokeWidth) / 2;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (percentage / 100) * circumference;
        
        const container = document.createElement('div');
        container.className = 'chart-container';
        
        container.innerHTML = `
            <div class="chart-header">
                <div>
                    <h3 class="chart-title" id="chart-title">Avance del Plan Anual SST</h3>
                    <p class="chart-subtitle" id="chart-subtitle">Plan de Trabajo • Actualizado ${this.getLastUpdatedText(stats.ultimoMesRegistrado)}</p>
                </div>
                <div class="chart-badge ${statusClass}" id="chart-badge">
                    <i class="bi bi-${percentage >= expectedProgress ? 'check-circle-fill' : 'exclamation-triangle-fill'}"></i>
                    ${statusText}
                </div>
            </div>
            
            <div class="chart-content" id="plan-chart-content">
                <div class="donut-chart-wrapper">
                    <svg class="donut-chart-svg" viewBox="0 0 ${size} ${size}">
                        <circle 
                            class="donut-segment donut-segment-bg"
                            cx="${size/2}" 
                            cy="${size/2}" 
                            r="${radius}"
                            stroke-width="${strokeWidth}"
                        />
                        <circle 
                            class="donut-segment donut-segment-progress"
                            id="donut-progress"
                            cx="${size/2}" 
                            cy="${size/2}" 
                            r="${radius}"
                            stroke-width="${strokeWidth}"
                            stroke="${progressColor}"
                            stroke-dasharray="${circumference}"
                            stroke-dashoffset="${circumference}"
                        />
                    </svg>
                    <div class="donut-center-text">
                        <div class="donut-percentage" id="donut-percentage">0%</div>
                        <div class="donut-label">Avance</div>
                    </div>
                </div>
                
                <div class="chart-legend">
                    <div class="legend-item">
                        <div class="legend-dot" style="background: var(--k-success);"></div>
                        <div class="legend-info">
                            <div class="legend-title" id="legend-title-1">Cel. Ejecutadas</div>
                            <div class="legend-description">Marcadas con C (cumplidas)</div>
                        </div>
                        <div class="legend-value" style="color: var(--k-success);">${executed}</div>
                    </div>

                    <div class="legend-item">
                        <div class="legend-dot" style="background: var(--k-warning);"></div>
                        <div class="legend-info">
                            <div class="legend-title" id="legend-title-2">Cel. Pendientes</div>
                            <div class="legend-description">Marcadas con P (en proceso)</div>
                        </div>
                        <div class="legend-value" style="color: var(--k-warning);">${pending}</div>
                    </div>

                    <div class="legend-item">
                        <div class="legend-dot" style="background: var(--k-danger);"></div>
                        <div class="legend-info">
                            <div class="legend-title" id="legend-title-3">Cel. Vencidas</div>
                            <div class="legend-description">P en mes anterior al vigente</div>
                        </div>
                        <div class="legend-value" style="color: var(--k-danger);">${overdue}</div>
                    </div>

                    <div class="legend-item">
                        <div class="legend-dot" style="background: var(--k-info);"></div>
                        <div class="legend-info">
                            <div class="legend-title" id="legend-title-4">Total Programadas</div>
                            <div class="legend-description">Celdas con C o P</div>
                        </div>
                        <div class="legend-value">${total}</div>
                    </div>
                </div>
            </div>
        `;

        // Animar después de insertar en DOM
        setTimeout(() => {
            this.animateDonutChart(percentage, offset);
        }, 100);

        return container;
    }

    /**
     * Anima la gráfica de dona
     */
    animateDonutChart(percentage, offset) {
        const progressCircle = document.getElementById('donut-progress');
        const percentageText = document.getElementById('donut-percentage');
        
        if (!progressCircle || !percentageText) return;
        
        setTimeout(() => {
            progressCircle.style.strokeDashoffset = offset;
        }, 100);
        
        this.animateCounter(percentageText, 0, percentage, 1500, '%');
    }

    /**
     * 📦562 — Crea la gráfica de Objetivos SST por principio.
     * Stacked horizontal bar 100% con:
     *   - Labels con nombres reales de los principios (Prevención, etc.)
     *   - Color por rango (verde >=70%, amarillo >=40%, rojo <40%)
     *   - Número grande adentro de cada barra
     *   - Tooltip con X/Y cumplidos + principio
     *   - Tarjeta clickeable → abre el submódulo "2.2.1 Objetivos SST"
     */
    createObjetivosChart(objetivos) {
        const porPrincipio = objetivos.porPrincipio || {
            1: { nombre: 'Prevención', total: 0, cumplidos: 0, porcentaje: 0 },
            2: { nombre: 'Requisitos Legales', total: 0, cumplidos: 0, porcentaje: 0 },
            3: { nombre: 'Satisfacción Cliente', total: 0, cumplidos: 0, porcentaje: 0 },
            4: { nombre: 'Recursos y Mejora', total: 0, cumplidos: 0, porcentaje: 0 }
        };

        const container = document.createElement('div');
        container.className = 'chart-container objetivos-chart-clickable';
        container.style.cursor = 'pointer';
        container.title = 'Click para ver el submódulo de Objetivos SST';

        const statusClass = objetivos.porcentaje >= 70 ? 'chart-badge-success'
            : objetivos.porcentaje >= 40 ? 'chart-badge-warning'
            : 'chart-badge-danger';

        container.innerHTML = `
            <div class="chart-header">
                <div>
                    <h3 class="chart-title" id="obj-chart-title">Objetivos SST</h3>
                    <p class="chart-subtitle" id="obj-chart-subtitle">${objetivos.cumplidos}/${objetivos.total} indicadores cumplen (${objetivos.porcentaje}%)</p>
                </div>
                <div class="chart-badge ${statusClass}" id="obj-chart-badge">
                    <i class="bi bi-${objetivos.porcentaje >= 70 ? 'check-circle-fill' : 'exclamation-triangle-fill'}"></i>
                    ${objetivos.porcentaje}% cumplimiento
                </div>
            </div>
            <div class="objetivos-chart-wrapper">
                <canvas id="objetivosChart"></canvas>
            </div>
        `;

        // 📦562 — Click → abrir el submódulo de Objetivos SST
        container.addEventListener('click', () => {
            if (typeof showSubmoduleContent === 'function') {
                showSubmoduleContent(this.container, this.moduleName, '2.2.1 Objetivos SST');
            }
        });

        // Guardar textos para switching fullscreen
        this._objChartMeta = {
            total: objetivos.total,
            cumplidos: objetivos.cumplidos,
            porcentaje: objetivos.porcentaje
        };

        // Renderizar Chart.js después de insertar en DOM
        setTimeout(() => {
            this._renderObjetivosBarChart(porPrincipio, objetivos);
        }, 100);

        return container;
    }

    /**
     * 📦562 — Renderiza stacked horizontal bar 100% con colores por rango.
     * Sin leyenda (solo 2 series: Cumplidos/Pendientes, autoexplicativo).
     * Plugin custom dibuja el número grande ("5/6 (83%)") adentro de cada barra.
     */
    _renderObjetivosBarChart(porPrincipio, objetivos) {
        if (typeof Chart === 'undefined') return;
        const canvas = document.getElementById('objetivosChart');
        if (!canvas) return;

        const existingChart = Chart.getChart(canvas);
        if (existingChart) existingChart.destroy();

        // Labels: nombre real del principio (Prevención, Requisitos Legales, etc.)
        const labels = [1, 2, 3, 4].map(pid => {
            const p = porPrincipio[pid];
            return (p && p.nombre) ? p.nombre : `Principio ${pid}`;
        });

        // % de cumplimiento por principio (0-100)
        const cumplidosPct = [1, 2, 3, 4].map(pid => {
            const p = porPrincipio[pid];
            if (!p || p.total === 0) return 0;
            return Math.round((p.cumplidos / p.total) * 100);
        });

        // % pendiente = 100 - % cumplido
        const pendientesPct = cumplidosPct.map(pct => 100 - pct);

        // Color por rango: verde >=70, amarillo >=40, rojo <40
        const colorPorRango = (pct) => {
            if (pct >= 70) return 'rgba(40, 167, 69, 0.85)';  // Verde
            if (pct >= 40) return 'rgba(255, 193, 7, 0.85)';   // Amarillo
            return 'rgba(220, 53, 69, 0.85)';                  // Rojo
        };
        const colorsCumplidos = cumplidosPct.map(colorPorRango);

        const datasets = [
            {
                label: 'Cumplidos',
                data: cumplidosPct,
                backgroundColor: colorsCumplidos,
                borderColor: colorsCumplidos.map(c => c.replace('0.85', '1')),
                borderWidth: 1,
                borderRadius: 4,
                barPercentage: 0.7,
                categoryPercentage: 0.8
            },
            {
                label: 'Pendientes',
                data: pendientesPct,
                backgroundColor: 'rgba(200, 200, 200, 0.35)',
                borderColor: 'rgba(200, 200, 200, 0.6)',
                borderWidth: 1,
                borderRadius: 4,
                barPercentage: 0.7,
                categoryPercentage: 0.8
            }
        ];

        // Plugin custom: dibuja el texto "5/6 (83%)" en el centro de la parte verde
        const numberLabelPlugin = {
            id: 'kairNumberLabel',
            afterDatasetsDraw(chart) {
                try {
                    const ctx2 = chart.ctx;
                    const xScale = chart.scales.x;
                    const yScale = chart.scales.y;
                    ctx2.save();
                    ctx2.font = '600 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                    ctx2.textAlign = 'center';
                    ctx2.textBaseline = 'middle';

                    const meta0 = chart.getDatasetMeta(0); // Cumplidos
                    for (let i = 0; i < meta0.data.length; i++) {
                        const p = porPrincipio[i + 1];
                        if (!p) continue;
                        const pct = cumplidosPct[i];
                        if (pct === 0) continue;
                        const bar = meta0.data[i];
                        // bar.x es el borde derecho de la barra verde
                        const centerX = (bar.x - (xScale.getPixelForValue(0))) / 2 + xScale.getPixelForValue(0);
                        const yPos = bar.y;
                        const text = `${p.cumplidos}/${p.total} (${p.porcentaje}%)`;
                        // Si la barra es muy chica (< 20%), poner texto afuera a la derecha
                        if (pct < 20) {
                            ctx2.fillStyle = '#333';
                            ctx2.textAlign = 'left';
                            ctx2.fillText(text, bar.x + 8, yPos);
                        } else {
                            ctx2.fillStyle = '#fff';
                            ctx2.fillText(text, centerX, yPos);
                        }
                    }
                    ctx2.restore();
                } catch (e) {
                    // No hacer nada si el plugin falla (no es crítico)
                }
            }
        };

        new Chart(canvas, {
            type: 'bar',
            data: { labels, datasets },
            plugins: [numberLabelPlugin],
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        stacked: true,
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            stepSize: 25,
                            font: { size: 11 },
                            callback: (v) => v + '%'
                        },
                        grid: { color: 'rgba(0,0,0,0.05)' },
                        title: { display: true, text: '% Cumplimiento', font: { size: 10 } }
                    },
                    y: {
                        stacked: true,
                        ticks: { font: { size: 12, weight: '500' } },
                        grid: { display: false }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.85)',
                        padding: 12,
                        cornerRadius: 6,
                        titleFont: { size: 13, weight: '600' },
                        bodyFont: { size: 12 },
                        callbacks: {
                            title: (items) => {
                                const pid = items[0].dataIndex + 1;
                                const p = porPrincipio[pid];
                                return p.nombre || `Principio ${pid}`;
                            },
                            label: (ctx) => {
                                const pid = ctx.dataIndex + 1;
                                const p = porPrincipio[pid];
                                if (ctx.dataset.label === 'Cumplidos') {
                                    return ` ${p.cumplidos} de ${p.total} indicadores cumplen (${p.porcentaje}%)`;
                                }
                                return ` ${p.total - p.cumplidos} pendientes (${100 - p.porcentaje}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    /**
     * Actualiza textos del chart según modo ventana/pantalla completa
     */
    updateChartTexts(isFullscreen) {
        const meta = this._chartMeta;
        if (!meta) return;

        // Toggle layout fullscreen en el chart de plan de trabajo
        const chartContent = document.getElementById('plan-chart-content');
        if (chartContent) {
            chartContent.classList.toggle('chart-fullscreen', isFullscreen);
        }

        const title = document.getElementById('chart-title');
        const subtitle = document.getElementById('chart-subtitle');
        const badge = document.getElementById('chart-badge');
        const legend1 = document.getElementById('legend-title-1');
        const legend2 = document.getElementById('legend-title-2');
        const legend3 = document.getElementById('legend-title-3');

        if (title) {
            title.textContent = isFullscreen
                ? 'Avance del Plan Anual SST'
                : 'Plan Anual SST';
        }

        if (subtitle) {
            subtitle.textContent = isFullscreen
                ? `Plan de Trabajo • Actualizado ${meta.lastUpdatedText}`
                : `Plan • ${meta.lastUpdatedText}`;
        }

        if (badge) {
            const statusMap = {
                'Requiere atención urgente': { full: 'Requiere atención urgente', short: 'Atención urgente' },
                'Progreso moderado': { full: 'Progreso moderado', short: 'Moderado' },
                'En buen camino': { full: 'En buen camino', short: 'En buen camino' }
            };
            const mapped = statusMap[meta.statusText];
            if (mapped) {
                const icon = meta.percentage >= meta.expectedProgress
                    ? 'check-circle-fill'
                    : 'exclamation-triangle-fill';
                badge.innerHTML = `<i class="bi bi-${icon}"></i> ${isFullscreen ? mapped.full : mapped.short}`;
            }
        }

        if (legend1) legend1.textContent = isFullscreen ? 'Actividades Ejecutadas' : 'Act. Ejec.';
        if (legend2) legend2.textContent = isFullscreen ? 'Actividades Pendientes' : 'Act. Pend.';
        if (legend3) legend3.textContent = isFullscreen ? 'Total Programadas' : 'Total Prog.';

        this._logChartDiagnostics(`updateChartTexts(isFullscreen=${isFullscreen})`);
    }

    /**
     * Diagnóstico visual: mide dimensiones, posición y proporciones del donut vs tarjetas
     */
    _logChartDiagnostics(context) {
        const chartContent = document.getElementById('plan-chart-content');
        if (!chartContent) { console.log(`[CHART-DIAG] ${context} — chart-content NOT FOUND`); return; }

        const cc = chartContent.getBoundingClientRect();
        const donut = chartContent.querySelector('.donut-chart-wrapper');
        const legend = chartContent.querySelector('.chart-legend');
        const svg = chartContent.querySelector('.donut-chart-svg');
        const container = chartContent.closest('.chart-container');

        const d = donut?.getBoundingClientRect();
        const l = legend?.getBoundingClientRect();
        const c = container?.getBoundingClientRect();

        console.log(`[CHART-DIAG] ═══ ${context} ═══`);
        console.log(`[CHART-DIAG] State: classList = "${chartContent.className}"`);
        console.log(`[CHART-DIAG] Window: ${Math.round(window.innerWidth)}×${Math.round(window.innerHeight)}`);
        console.log(`[CHART-DIAG] Container (.chart-container): ${c ? Math.round(c.width)+'×'+Math.round(c.height) : 'N/A'}`);
        console.log(`[CHART-DIAG] Flex row (.chart-content): ${Math.round(cc.width)}×${Math.round(cc.height)}`);
        console.log(`[CHART-DIAG] Donut: ${d ? Math.round(d.width)+'×'+Math.round(d.height) : 'N/A'} → ${d ? Math.round(d.width/cc.width*100)+'%' : 'N/A'} del flex`);
        console.log(`[CHART-DIAG] Legend: ${l ? Math.round(l.width)+'×'+Math.round(l.height) : 'N/A'} → ${l ? Math.round(l.width/cc.width*100)+'%' : 'N/A'} del flex`);
        console.log(`[CHART-DIAG] SVG size: ${svg ? getComputedStyle(svg).width : 'N/A'}`);
        console.log(`[CHART-DIAG] Gap: ${getComputedStyle(chartContent).gap}`);

        const items = chartContent.querySelectorAll('.legend-item');
        items.forEach((item, i) => {
            const r = item.getBoundingClientRect();
            console.log(`[CHART-DIAG]   Card ${i+1}: ${Math.round(r.width)}×${Math.round(r.height)}`);
        });
        console.log(`[CHART-DIAG] ══════════════════════`);
    }

    /**
     * Anima un contador numérico
     */
    animateCounter(element, start, end, duration, suffix = '') {
        const startTime = performance.now();
        const diff = end - start;
        
        const step = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(start + diff * easeOut);
            
            element.textContent = current + suffix;
            
            if (progress < 1) {
                requestAnimationFrame(step);
            }
        };
        
        requestAnimationFrame(step);
    }

    /**
     * Obtiene texto legible para el último mes registrado
     */
    getLastUpdatedText(lastMonth) {
        if (!lastMonth) {
            return 'recientemente';
        }
        
        const months = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];
        
        return `en ${months[lastMonth - 1] || 'el último mes'}`;
    }

    /**
     * Obtiene meses restantes del año
     */
    getMonthsRemaining() {
        const currentMonth = new Date().getMonth() + 1;
        return Math.max(0, 12 - currentMonth);
    }

    renderSubmoduleItem(name) {
        // Generar datos simulados para el submódulo
        const lastAccess = this.getRandomLastAccess();
        const timeSpent = this.getRandomTimeSpent();

        const submoduleItem = document.createElement('div');
        submoduleItem.className = 'submodule-item';

        const submoduleInfo = document.createElement('div');
        submoduleInfo.className = 'submodule-info';

        const submoduleName = document.createElement('div');
        submoduleName.className = 'submodule-name';
        submoduleName.textContent = name;
        submoduleInfo.appendChild(submoduleName);

        const submoduleMeta = document.createElement('div');
        submoduleMeta.className = 'submodule-meta';
        submoduleMeta.textContent = `Último acceso: ${lastAccess} | Tiempo: ${timeSpent}`;
        submoduleInfo.appendChild(submoduleMeta);

        const button = document.createElement('button');
        button.className = 'btn btn-primary btn-ingresar';
        button.textContent = 'Ingresar';
        button.addEventListener('click', () => {
            showSubmoduleContent(document.querySelector('.main-canvas'), this.moduleName, name);
        });

        submoduleItem.appendChild(submoduleInfo);
        submoduleItem.appendChild(button);
        
        return submoduleItem;
    }
    
    getRandomLastAccess() {
        const days = ['Hace 1 día', 'Hace 2 días', 'Hace 3 días', 'Hace 1 semana', 'Hace 2 semanas'];
        return days[Math.floor(Math.random() * days.length)];
    }
    
    getRandomTimeSpent() {
        const times = ['5 min', '15 min', '30 min', '1 hora', '2 horas'];
        return times[Math.floor(Math.random() * times.length)];
    }
    
    async renderSidebarPanel(container) {
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
}

// Hacer la clase disponible globalmente
window.GestionIntegralHome = GestionIntegralHome;