// mejoramiento-home.js - Componente para el home del módulo "Mejoramiento"

// F21.49 (2026-06-21) — Mejoramiento ahora SOLO tiene 7.1.1.
// 7.1.2 / 7.1.3 / 7.1.4 ya no son submódulos activos — sus interfaces quedan reservadas
// en modules/ pero NO se les crea UI porque la normativa (ALL_SUBMODULES en renderer.js)
// solo incluye 7.1.1 en el módulo "Mejoramiento".


class MejoramientoHome {
    constructor(container, moduleName, submodules, companyName) {
        this.container = container;
        this.moduleName = moduleName;
        /* this.submodules viene de RESOURCES_SUBMODULES[moduleName] en renderer.js,
           que ya está filtrado por la normativa. Para Mejoramiento ahora solo trae
           7.1.1. Si por algún motivo el array viene vacío, fallback a 7.1.1. */
        this.submodules = (submodules && submodules.length > 0) ? submodules : [
          '7.1.1 Acciones Preventivas y Correctivas'
        ];
        // 📦748 · Aceptar currentCompany como parámetro del shell.
        this.currentCompany = companyName || this.getCurrentCompany() || null;
        this.widgets = {};
        this._unsubscribe = null;
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
                Inicio <span>›</span> Mejoramiento
            </div>
            <div class="kair-page-title-block">
                <h1>Mejoramiento Continuo</h1>
            </div>
        `;
        layout.appendChild(header);

        // 4. Skeleton mientras cargan stats
        const mainArea = document.createElement('div');
        mainArea.id = 'app-container';
        mainArea.className = 'mejoramiento-home';
        mainArea.style.cssText = 'flex: 1; min-height: 0; overflow-y: auto; padding: 0 1.5rem 1.5rem; box-sizing: border-box;';
        mainArea.innerHTML = KairSkeleton.kpiStrip(4);
        layout.appendChild(mainArea);

        // 5. Pintar contenido premium (lee MejoramientoStore si está disponible)
        await this.renderMainArea(mainArea);
    }


    injectStyles() {
        /* 📦737 · Usar design system compartido de shared/kair-components.css.
           Sin CSS legacy hardcoded en este módulo — todo proviene de los tokens. */
    }


    /**
     * Construye hero + 3 metric cards + chart SVG + radar + grid de submódulos.
     * Patrón premium K+AIR (igual que Recursos, Gestión Integral, Salud, Peligros, Amenazas, Verificación).
     * Lee stats desde MejoramientoStore (mismo objeto que consume el viewer 7.1.1).
     */
    async renderMainArea(container) {
        container.innerHTML = '';

        // Stats: objeto único con los 5 KPIs del viewer 7.1.1
        const stats = (window.MejoramientoStore && typeof window.MejoramientoStore.getStats === 'function')
            ? window.MejoramientoStore.getStats()
            : {};

        const total = stats.total || 0;
        const abiertas = stats.abiertas || 0;
        const enProceso = stats.enProceso || 0;
        const cerradas = stats.cerradas || 0;
        const vencidas = stats.vencidas || 0;
        const cumplimiento = stats.cumplimiento || (total > 0 ? Math.round((cerradas / total) * 100) : 0);

        // ── 1. Hero strip (hero card + 3 metric cards) ──────────────
        const health = document.createElement('div');
        health.className = 'kair-health';

        const heroMsg = cumplimiento >= 80
            ? 'El ciclo de mejora continua está cumpliendo las metas.'
            : cumplimiento >= 50
                ? 'Buen avance en el ciclo de mejora. Quedan ' + (total - cerradas) + ' acciones por cerrar.'
                : cumplimiento >= 25
                    ? 'Hay ' + (total - cerradas) + ' acciones abiertas. Prioriza las vencidas.'
                    : 'Sin acciones registradas o cumplimiento muy bajo.';

        const heroCard = document.createElement('div');
        heroCard.className = 'kair-hero-card';
        heroCard.innerHTML = `
            <div class="kair-hero-eyebrow">CICLO DE MEJORA CONTINUA</div>
            <h2>${cerradas}/${total} acciones cerradas</h2>
            <p class="kair-hero-msg">${heroMsg}</p>
            <div class="kair-hero-score">${cumplimiento}%<span>cumplimiento</span></div>
        `;
        health.appendChild(heroCard);

        health.appendChild(this.renderMetricCard({
            title: 'Total Acciones',
            value: total,
            desc: 'Acciones Preventivas y Correctivas',
            progress: total > 0 ? 100 : 0,
            state: ''
        }));
        health.appendChild(this.renderMetricCard({
            title: 'En Proceso',
            value: enProceso,
            desc: abiertas + ' abiertas · ' + cerradas + ' cerradas',
            progress: total > 0 ? Math.round((enProceso / total) * 100) : 0,
            state: enProceso > 0 ? 'warning' : ''
        }));
        health.appendChild(this.renderMetricCard({
            title: 'Vencidas',
            value: vencidas,
            desc: 'Requieren atención inmediata',
            progress: total > 0 ? Math.round((vencidas / total) * 100) : 0,
            state: vencidas > 0 ? 'danger' : ''
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
                    <h3>Distribución por estado — 7.1.1</h3>
                    <div class="kair-card-hint">Cantidad de acciones en cada estado del ciclo</div>
                </div>
            </div>
            <div class="kair-chart">${this.renderChartMejoramiento(abiertas, enProceso, cerradas, vencidas)}</div>
        `;
        content.appendChild(chartCard);

        const radarCard = document.createElement('div');
        radarCard.className = 'kair-card';
        radarCard.innerHTML = `
            <div class="kair-row-title">
                <div>
                    <h3>En tu radar</h3>
                    <div class="kair-card-hint">Alertas del ciclo de mejora</div>
                </div>
            </div>
            ${this.buildRadarTasks({ abiertas, enProceso, cerradas, vencidas, cumplimiento, total })}
        `;
        content.appendChild(radarCard);

        container.appendChild(content);

        // ── 3. Grid de submódulos ─────────────────────────────────────
        const modules = document.createElement('div');
        modules.className = 'kair-modules';
        modules.appendChild(this.renderSubmodulesGrid());
        container.appendChild(modules);
    }


    renderSubmoduleItem(name) {
        const submoduleItem = document.createElement('div');
        submoduleItem.className = 'submodule-item';
        submoduleItem.innerHTML = `
            <div class="submodule-info">
                <div class="submodule-name">${name}</div>
                <div class="submodule-meta">Ciclo de Mejora Continua</div>
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
    buildRadarTasks(stats) {
        const tasks = [];
        const { abiertas, enProceso, cerradas, vencidas, cumplimiento, total } = stats;

        // 1. Acciones vencidas (las más críticas)
        if (vencidas > 0) {
            tasks.push({
                icon: '⚠️',
                color: 'danger',
                title: 'Acciones vencidas',
                desc: vencidas + ' acción(es) requieren atención inmediata'
            });
        }

        // 2. Cumplimiento bajo
        if (cumplimiento < 80 && total > 0) {
            tasks.push({
                icon: '📉',
                color: 'warn',
                title: 'Cumplimiento bajo',
                desc: 'Ciclo al ' + cumplimiento + '% — meta mínima 80%'
            });
        }

        // 3. Acciones sin iniciar (abiertas)
        if (abiertas >= 2) {
            tasks.push({
                icon: '📋',
                color: 'warn',
                title: 'Acciones sin iniciar',
                desc: abiertas + ' acción(es) aún no han comenzado'
            });
        }

        if (tasks.length === 0) {
            return '<div style="padding: 16px 0; color: var(--kair-muted); font-size: 13px;">✓ Sin alertas. El ciclo de mejora continua está al día.</div>';
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
     * Renderiza un chart SVG nativo con barras horizontales por estado.
     */
    renderChartMejoramiento(abiertas, enProceso, cerradas, vencidas) {
        const estados = [
            { label: 'Abiertas',    value: abiertas,   color: '#2057b8' },
            { label: 'En proceso',  value: enProceso,  color: '#e7a224' },
            { label: 'Cerradas',    value: cerradas,   color: '#1bb888' },
            { label: 'Vencidas',    value: vencidas,   color: '#da5563' }
        ];

        const total = estados.reduce((sum, e) => sum + e.value, 0);
        const maxVal = Math.max(...estados.map(e => e.value), 1);

        const W = 400, H = 200;
        const barH = 22;
        const gap = 14;
        const labelW = 100;
        const valueW = 80;
        const barAreaW = W - labelW - valueW - 20;
        const startY = 16;

        let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;

        estados.forEach((e, i) => {
            const y = startY + i * (barH + gap);
            const barW = e.value > 0 ? Math.max(8, (e.value / maxVal) * barAreaW) : 0;
            const fillColor = e.value === 0 ? '#e8ebee' : e.color;

            // Label
            svg += `<text x="${labelW - 8}" y="${y + barH / 2 + 4}" text-anchor="end" fill="#14213d" font-size="12" font-weight="600">${e.label}</text>`;
            // Bar background
            svg += `<rect x="${labelW}" y="${y}" width="${barAreaW}" height="${barH}" fill="#f3f6f6" rx="6"/>`;
            // Bar fill
            if (barW > 0) {
                svg += `<rect x="${labelW}" y="${y}" width="${barW}" height="${barH}" fill="${fillColor}" rx="6"/>`;
            }
            // Value label
            const pct = total > 0 ? Math.round((e.value / total) * 100) : 0;
            svg += `<text x="${labelW + barAreaW + 8}" y="${y + barH / 2 + 4}" fill="#748096" font-size="11">${e.value} (${pct}%)</text>`;
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
                <small>Ciclo de Mejora Continua</small>
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


window.MejoramientoHome = MejoramientoHome;
