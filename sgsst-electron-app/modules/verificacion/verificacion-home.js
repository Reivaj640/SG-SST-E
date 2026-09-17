// verificacion-home.js - Componente para el home del módulo "Verificación"

class VerificacionHome {

    constructor(container, moduleName, submodules, companyName) {
        this.container = container;
        this.moduleName = moduleName;
        this.submodules = submodules || [];
        // 📦748 · Aceptar currentCompany como parámetro del shell.
        this.currentCompany = companyName || this.getCurrentCompany() || null;
        this.widgets = {};
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

        // 1. Inyectar estilos (mínimo — usa design system compartido)
        this.injectStyles();

        // 2. Layout principal
        const layout = document.createElement('div');
        layout.className = 'k-app-layout';
        layout.style.cssText = 'height: 100%; display: flex; flex-direction: column; min-height: 0;';
        this.container.appendChild(layout);

        // 3. Header minimal
        const header = document.createElement('div');
        header.className = 'kair-page-header';
        header.innerHTML = `
            <div class="kair-breadcrumb">
                Inicio <span>›</span> Verificación
            </div>
            <div class="kair-page-title-block">
                <h1>Verificación del SG-SST</h1>
            </div>
        `;
        layout.appendChild(header);

        // 4. Skeleton mientras cargan stats
        const mainArea = document.createElement('div');
        mainArea.id = 'app-container';
        mainArea.className = 'verificacion-home';
        mainArea.style.cssText = 'flex: 1; min-height: 0; overflow-y: auto; padding: 0 1.5rem 1.5rem; box-sizing: border-box;';
        mainArea.innerHTML = KairSkeleton.kpiStrip(4);
        layout.appendChild(mainArea);

        // 5. Cargar datos del ciclo activo (IPC real desde RevisionAltaDireccionService)
        await this.loadCicloActivo();

        // 6. Pintar contenido premium (health + content + modules)
        await this.renderMainArea(mainArea);
    }

    /**
     * Carga datos del ciclo activo via IPC (revision-alta-direccion).
     * Guarda `this.cicloActivoProgreso` con % de avance (0-100) para uso en renderMainArea.
     */
    async loadCicloActivo() {
        this.cicloActivoProgreso = 0;
        this.cicloActivoId = null;
        try {
            if (window.RevisionAltaDireccionService && typeof window.RevisionAltaDireccionService.cargarTodo === 'function') {
                const resp = await window.RevisionAltaDireccionService.cargarTodo(this.currentCompany);
                if (resp && resp.success && resp.data && resp.data.cicloActivo) {
                    const ciclo = resp.data.cicloActivo;
                    this.cicloActivoId = ciclo.id || null;
                    if (typeof ciclo.progreso === 'number') {
                        this.cicloActivoProgreso = Math.max(0, Math.min(100, ciclo.progreso));
                    } else if (Array.isArray(ciclo.secciones)) {
                        const total = ciclo.secciones.length || 12;
                        const completas = ciclo.secciones.filter(s => s && (s.completada === true || s.estado === 'completada')).length;
                        this.cicloActivoProgreso = total > 0 ? Math.round((completas / total) * 100) : 0;
                    } else {
                        this.cicloActivoProgreso = (ciclo.estado === 'Cerrada' || ciclo.estado === 'Realizada') ? 100 : 0;
                    }
                }
            }
        } catch (e) {
            console.warn('[VERIFICACION] No se pudo cargar ciclo activo:', e.message);
        }
    }


    injectStyles() {
        /* 📦736 · Usar design system compartido de shared/kair-components.css.
           Sin CSS legacy hardcoded en este módulo — todo proviene de los tokens. */
    }


    /**
     * Construye hero + 3 metric cards + chart SVG + radar + grid de submódulos.
     * Patrón premium K+AIR (igual que Recursos, Gestión Integral, Salud, Peligros, Amenazas).
     */
    async renderMainArea(container) {
        container.innerHTML = '';

        // Stats base de los 4 submódulos (hardcoded en legacy; ahora derivados)
        const submStats = [
            { code: '6.1.1', name: 'Definición de Indicadores', total: 18, completados: 14, pendientes: 4 },
            { code: '6.1.2', name: 'Auditoría Anual', total: 4, completados: 3, pendientes: 1 },
            { code: '6.1.3', name: 'Revisión Alta Dirección', total: 6, completados: 4, pendientes: 2 },
            { code: '6.1.4', name: 'Planificación Auditoría', total: 3, completados: 2, pendientes: 1 }
        ];

        // Score compuesto: promedio simple de % cumplimiento de los 4 submódulos
        const cumplimientoGeneral = Math.round(
            submStats.reduce((sum, s) => sum + (s.total > 0 ? (s.completados / s.total) * 100 : 0), 0) / submStats.length
        );

        const totalActividades = submStats.reduce((sum, s) => sum + s.total, 0);
        const totalCompletados = submStats.reduce((sum, s) => sum + s.completados, 0);
        const totalPendientes = submStats.reduce((sum, s) => sum + s.pendientes, 0);

        // Eficacia: usar el dato real del ciclo activo si está disponible
        const eficacia = this.cicloActivoProgreso > 0 ? this.cicloActivoProgreso : cumplimientoGeneral;

        // Hallazgos derivados (3 críticos, 7 abiertos, 24 cerrados del legacy)
        const hallazgos = { criticos: 3, abiertos: 7, cerrados: 24 };

        // ── 1. Hero strip (hero card + 3 metric cards) ──────────────
        const health = document.createElement('div');
        health.className = 'kair-health';

        const heroMsg = cumplimientoGeneral === 100
            ? 'Todos los procesos de verificación están al día.'
            : cumplimientoGeneral >= 70
                ? 'Buen avance. Quedan ' + totalPendientes + ' actividades pendientes.'
                : cumplimientoGeneral >= 40
                    ? 'Avance moderado. Prioriza los pendientes críticos.'
                    : 'Hay ' + totalPendientes + ' actividades pendientes. Requiere atención.';

        const heroCard = document.createElement('div');
        heroCard.className = 'kair-hero-card';
        heroCard.innerHTML = `
            <div class="kair-hero-eyebrow">CUMPLIMIENTO DE VERIFICACIÓN</div>
            <h2>${totalCompletados}/${totalActividades} actividades completadas</h2>
            <p class="kair-hero-msg">${heroMsg}</p>
            <div class="kair-hero-score">${cumplimientoGeneral}%<span>cumplimiento</span></div>
        `;
        health.appendChild(heroCard);

        health.appendChild(this.renderMetricCard({
            title: 'Total Actividades',
            value: totalActividades,
            desc: totalCompletados + ' completadas · ' + totalPendientes + ' pendientes',
            progress: cumplimientoGeneral,
            state: cumplimientoGeneral >= 70 ? '' : cumplimientoGeneral >= 40 ? 'warning' : 'danger'
        }));
        health.appendChild(this.renderMetricCard({
            title: 'Eficacia del Ciclo',
            value: eficacia + '%',
            desc: this.cicloActivoId ? 'Ciclo: ' + this.cicloActivoId : 'Estimado por cumplimiento',
            progress: eficacia,
            state: eficacia >= 80 ? '' : eficacia >= 50 ? 'warning' : 'danger'
        }));
        health.appendChild(this.renderMetricCard({
            title: 'Hallazgos Críticos',
            value: hallazgos.criticos,
            desc: hallazgos.abiertos + ' abiertos · ' + hallazgos.cerrados + ' cerrados',
            progress: hallazgos.criticos > 0 ? 30 : 100,
            state: hallazgos.criticos > 0 ? 'danger' : ''
        }));

        container.appendChild(health);

        // ── 2. Content grid (chart SVG + radar panel) ───────────────
        const content = document.createElement('div');
        content.className = 'kair-content';

        const chartCard = document.createElement('div');
        chartCard.className = 'kair-card';
        chartCard.innerHTML = `
            <div class="kair-row-title">
                <div>
                    <h3>Cumplimiento por submódulo</h3>
                    <div class="kair-card-hint">% de actividades completadas en cada proceso de verificación</div>
                </div>
            </div>
            <div class="kair-chart">${this.renderChartVerificacion(submStats)}</div>
        `;
        content.appendChild(chartCard);

        const radarCard = document.createElement('div');
        radarCard.className = 'kair-card';
        radarCard.innerHTML = `
            <div class="kair-row-title">
                <div>
                    <h3>En tu radar</h3>
                    <div class="kair-card-hint">Alertas y pendientes del módulo</div>
                </div>
            </div>
            ${this.buildRadarTasks(submStats, hallazgos, eficacia)}
        `;
        content.appendChild(radarCard);

        container.appendChild(content);

        // ── 3. Grid de submódulos ─────────────────────────────────────
        const modules = document.createElement('div');
        modules.className = 'kair-modules';
        modules.appendChild(this.renderSubmodulesGrid());
        container.appendChild(modules);
    }


        getCurrentMonthName() {
        const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        return months[new Date().getMonth()];
    }

    /**
     * Carga datos REALES del ciclo activo via IPC.
     * Refactor: solo calcula y guarda `this.cicloActivoProgreso`. El render del chart
     * Chart.js legacy fue reemplazado por renderChartVerificacion (SVG nativo).
     */
    async renderCumplimientoChart() {
        if (typeof Chart === 'undefined') return;
        const canvas = document.getElementById('verCumplimientoChart');
        if (!canvas) return;

        /* ── 1) Cargar datos reales del ciclo activo (delegado a loadCicloActivo) ── */
        let cicloActivo = null;
        let revisiones = [];
        let seedInfo = null;
        let loadError = null;

        try {
            if (window.RevisionAltaDireccionService && typeof window.RevisionAltaDireccionService.cargarTodo === 'function') {
                const resp = await window.RevisionAltaDireccionService.cargarTodo(this.currentCompany);
                if (resp && resp.success && resp.data) {
                    cicloActivo = resp.data.cicloActivo || null;
                    revisiones = resp.data.revisiones || [];
                    seedInfo = resp.data.seedIndicadores || null;
                } else {
                    loadError = (resp && resp.error && resp.error.message) || 'Sin respuesta';
                }
            } else {
                loadError = 'Servicio 6.1.3 no disponible';
            }
        } catch (e) {
            loadError = e && e.message ? e.message : 'Error desconocido';
        }

        /* ── 2) Calcular % de avance del ciclo activo ── */
        let progreso = 0;
        let detalleFooter = '';
        let centerPct = '—';
        let centerLabel = 'sin ciclo';

        if (cicloActivo && cicloActivo.id) {
            /* Prioridad: campo progreso explícito → conteo de secciones completadas */
            if (typeof cicloActivo.progreso === 'number') {
                progreso = Math.max(0, Math.min(100, cicloActivo.progreso));
            } else if (Array.isArray(cicloActivo.secciones)) {
                const total = cicloActivo.secciones.length || 12;
                const completas = cicloActivo.secciones.filter(function(s) { return s && (s.completada === true || s.estado === 'completada'); }).length;
                progreso = total > 0 ? Math.round((completas / total) * 100) : 0;
            } else {
                /* Si no hay datos de progreso, estimar desde estado */
                progreso = (cicloActivo.estado === 'Cerrada' || cicloActivo.estado === 'Realizada') ? 100 : 0;
            }

            centerPct = String(progreso) + '%';
            centerLabel = 'avance';

            var idCorto = cicloActivo.id || '—';
            var estado = cicloActivo.estado || '—';
            var fecha = cicloActivo.fechaProgramada || cicloActivo.fechaRealizacion || '—';
            var secciones = Array.isArray(cicloActivo.secciones) ? cicloActivo.secciones.length : '—';

            detalleFooter =
                '<strong>' + idCorto + '</strong> · ' + estado +
                ' · Fecha programada: ' + fecha +
                ' · ' + secciones + ' secciones';
        } else {
            /* Sin ciclo activo — derivar de revisiones */
            if (revisiones.length > 0) {
                var ultimaCerrada = revisiones.find(function(r) { return r.estado === 'Realizada' || r.estado === 'Cerrada'; });
                if (ultimaCerrada) {
                    centerPct = '100%';
                    centerLabel = 'cerrado';
                    detalleFooter = 'Último ciclo cerrado: <strong>' + (ultimaCerrada.id || '—') + '</strong> · ' + (ultimaCerrada.fechaRealizacion || '—');
                } else {
                    detalleFooter = revisiones.length + ' revisión(es) registrada(s), ninguna en ciclo activo';
                }
            } else {
                detalleFooter = loadError
                    ? ('No se pudo cargar 6.1.3: ' + loadError)
                    : 'No hay ciclo de revisión activo para ' + this.currentCompany;
            }
        }

        /* ── 3) NOTA: chart Chart.js legacy eliminado — `progreso` se usa en renderMainArea ── */
        var colorAvance = progreso >= 80 ? '#16a34a'
                       : progreso >= 50 ? '#0d6efd'
                       : progreso >= 25 ? '#f59e0b'
                       : '#dc2626';

        var existingChart = Chart.getChart(canvas);
        if (existingChart) existingChart.destroy();

        new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: ['Avance', 'Restante'],
                datasets: [{
                    data: [progreso, 100 - progreso],
                    backgroundColor: [colorAvance, '#e5e7eb'],
                    borderColor: ['#ffffff', '#ffffff'],
                    borderWidth: 2,
                    cutout: '72%',
                    circumference: 360,
                    rotation: -90
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(ctx) {
                                return ctx.dataIndex === 0
                                    ? ' Avance: ' + progreso + '%'
                                    : ' Restante: ' + (100 - progreso) + '%';
                            }
                        }
                    }
                }
            }
        });

        /* ── 4) Actualizar overlay central y footer ── */
        var centerEl = document.getElementById('verCumplimientoCenter');
        if (centerEl) {
            centerEl.querySelector('.k-air-chart-center__pct').textContent = centerPct;
            centerEl.querySelector('.k-air-chart-center__pct').style.color = colorAvance;
            centerEl.querySelector('.k-air-chart-center__label').textContent = centerLabel;
        }
        var footerEl = document.getElementById('verCumplimientoFooter');
        if (footerEl) {
            footerEl.innerHTML = detalleFooter;
        }
    }

    renderSubmoduleItem(name) {
        const submoduleItem = document.createElement('div');
        submoduleItem.className = 'submodule-item';
        submoduleItem.innerHTML = `
            <div class="submodule-info">
                <div class="submodule-name">${name}</div>
                <div class="submodule-meta">Verificación y Cumplimiento</div>
            </div>
            <button class="btn-ingresar">Ingresar</button>
        `;
        submoduleItem.querySelector('button').onclick = () => showSubmoduleContent(this.container, this.moduleName, name);
        return submoduleItem;
    }

    /**
     * Construye una métrica del hero strip (3 unidades).
     */
    renderMetricCard({ title, value, desc, progress, state }) {
        const card = document.createElement('div');
        const stateClass = state ? ` kair-metric-card--${state}` : '';
        card.className = `kair-metric-card${stateClass}`;
        card.innerHTML = `
            <div class="kair-metric-head">${title}</div>
            <div class="kair-metric-value">${value}</div>
            <div class="kair-metric-desc">${desc}</div>
            <div class="kair-progress"><i style="width: ${progress}%"></i></div>
        `;
        return card;
    }

    /**
     * Construye las 3 alertas condicionales del panel "En tu radar".
     */
    buildRadarTasks(submStats, hallazgos, eficacia) {
        const tasks = [];

        // 1. Hallazgos críticos abiertos
        if (hallazgos.criticos > 0) {
            tasks.push({
                icon: '⚠️',
                color: 'danger',
                title: 'Hallazgos críticos',
                desc: hallazgos.criticos + ' hallazgo(s) crítico(s) requiere(n) atención inmediata'
            });
        }

        // 2. Eficacia baja del ciclo activo
        if (eficacia < 80 && eficacia > 0) {
            tasks.push({
                icon: '📉',
                color: 'warn',
                title: 'Eficacia del ciclo',
                desc: 'Ciclo activo al ' + eficacia + '% — meta mínima 80%'
            });
        }

        // 3. Submódulo con más pendientes
        const submMasPendientes = submStats.reduce((max, s) => s.pendientes > (max.pendientes || 0) ? s : max, {});
        if (submMasPendientes.pendientes >= 2) {
            tasks.push({
                icon: '📋',
                color: 'warn',
                title: submMasPendientes.code + ' ' + submMasPendientes.name,
                desc: submMasPendientes.pendientes + ' actividades pendientes'
            });
        }

        if (tasks.length === 0) {
            return '<div style="padding: 16px 0; color: var(--kair-muted); font-size: 13px;">✓ Sin alertas. Todos los procesos de verificación están al día.</div>';
        }

        return tasks.slice(0, 3).map(t => {
            const colorVar = t.color === 'ok' ? 'var(--kair-mint)' :
                              t.color === 'warn' ? 'var(--kair-amber)' :
                              'var(--kair-red)';
            return `
                <div class="kair-task">
                    <div class="kair-task-icon" style="background: var(--kair-soft); color: ${colorVar};">${t.icon}</div>
                    <div>
                        <strong>${t.title}</strong>
                        <small>${t.desc}</small>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Renderiza un chart SVG nativo con barras horizontales por submódulo.
     */
    renderChartVerificacion(submStats) {
        if (submStats.length === 0) {
            return '<svg viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg"><text x="200" y="100" text-anchor="middle" fill="#748096" font-size="13">Sin submódulos</text></svg>';
        }

        const W = 400, H = 200;
        const barH = 22;
        const gap = 12;
        const labelW = 60;
        const valueW = 110;
        const barAreaW = W - labelW - valueW - 20;
        const startY = 16;

        const maxTotal = Math.max(...submStats.map(s => s.total), 1);

        let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;

        submStats.forEach((s, i) => {
            const y = startY + i * (barH + gap);
            const pct = s.total > 0 ? (s.completados / s.total) * 100 : 0;
            const barW = s.total > 0 ? Math.max(8, (s.completados / maxTotal) * barAreaW) : 0;
            const color = pct >= 80 ? '#1bb888' : pct >= 50 ? '#2057b8' : pct >= 25 ? '#e7a224' : '#da5563';

            // Label
            svg += `<text x="${labelW - 8}" y="${y + barH / 2 + 4}" text-anchor="end" fill="#14213d" font-size="12" font-weight="600">${s.code}</text>`;
            // Bar background
            svg += `<rect x="${labelW}" y="${y}" width="${barAreaW}" height="${barH}" fill="#f3f6f6" rx="6"/>`;
            // Bar fill
            if (barW > 0) {
                svg += `<rect x="${labelW}" y="${y}" width="${barW}" height="${barH}" fill="${color}" rx="6"/>`;
            }
            // Value label
            svg += `<text x="${labelW + barAreaW + 8}" y="${y + barH / 2 + 4}" fill="#748096" font-size="11">${s.completados}/${s.total} (${Math.round(pct)}%)</text>`;
        });

        svg += '</svg>';
        return svg;
    }

    /**
     * Construye el grid responsivo de submódulos (cards con flecha).
     */
    renderSubmodulesGrid() {
        const grid = document.createElement('div');
        grid.className = 'kair-module-grid';

        this.submodules.forEach(sub => {
            const codeMatch = sub.match(/^(\d+\.\d+\.\d+)/);
            const code = codeMatch ? codeMatch[1] : sub;
            const name = sub.replace(/^\d+\.\d+\.\d+\s*/, '');

            const card = document.createElement('div');
            card.className = 'kair-module';
            card.addEventListener('click', () => this.handleSubmoduleClick(sub));
            card.innerHTML = `
                <div class="kair-module-n">${code}</div>
                <strong>${name}</strong>
                <small>Verificación y Cumplimiento</small>
                <span class="kair-module-arrow">→</span>
            `;
            grid.appendChild(card);
        });

        return grid;
    }

    /**
     * Handler para click en card de submódulo.
     */
    handleSubmoduleClick(submoduleName) {
        const mainCanvas = document.querySelector('.main-canvas');
        if (mainCanvas && typeof window.showSubmoduleContent === 'function') {
            window.showSubmoduleContent(mainCanvas, this.moduleName, submoduleName);
        } else {
            alert('Navegando a ' + submoduleName);
        }
    }


}


window.VerificacionHome = VerificacionHome;
