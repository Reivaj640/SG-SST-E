// gestion-amenazas-home.js - Componente para el home del módulo "Gestión de Amenazas"
// F21.52 (2026-06-21) — Conectado a datos reales via electronAPI.getDocumentFolders.
// Antes mostraba 4 widgets MOCK con números hardcoded ("Amenazas: 15", "Simulacros: 3"…);
// ahora son 2 widgets reales (uno por submódulo) que cuentan carpetas/archivos de la
// estructura de la empresa. Patrón reactivo + cache de sesión (igual a gestion-peligros-home.js).

if (!window._amenazasHomeState) {
    window._amenazasHomeState = {
        cache: new Map(),
        lastUpdate: new Map()
    };
}


class GestionAmenazasHome {
    constructor(container, moduleName, submodules, companyName) {
        this.container = container;
        this.moduleName = moduleName;
        /* this.submodules viene de RESOURCES_SUBMODULES en renderer.js.
           Para Gestión de Amenazas son: 5.1.1 y 5.1.2.
           Si el array viene vacío (normativa restrictiva), fallback a ambos. */
        this.submodules = (submodules && submodules.length > 0) ? submodules : [
            '5.1.1 Plan de Prevención de Emergencias',
            '5.1.2 Examenes Medicos Brigadista'
        ];
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
                Inicio <span>›</span> Gestión <span>›</span> Amenazas
            </div>
            <div class="kair-page-title-block">
                <h1>Gestión de Amenazas</h1>
            </div>
        `;
        layout.appendChild(header);

        // 4. Skeleton mientras cargan stats
        const mainArea = document.createElement('div');
        mainArea.id = 'app-container';
        mainArea.className = 'gestion-amenazas-home';
        mainArea.style.cssText = 'flex: 1; min-height: 0; overflow-y: auto; padding: 0 1.5rem 1.5rem; box-sizing: border-box;';
        mainArea.innerHTML = KairSkeleton.kpiStrip(4);
        layout.appendChild(mainArea);

        // 5. Cargar stats reales desde electronAPI
        await this.refreshStats();

        // 6. Pintar contenido premium (health + content + modules)
        await this.renderMainArea(mainArea);
    }


    injectStyles() {
        /* 📦734 · Usar design system compartido de shared/kair-components.css.
           Sin CSS legacy hardcoded en este módulo — todo proviene de los tokens. */
    }


    /**
     * Construye hero + 3 metric cards + chart SVG + radar + grid de submódulos.
     * Patrón premium K+AIR (mismo que Recursos, Gestión Integral, Salud, Peligros).
     */
    async renderMainArea(container) {
        container.innerHTML = "";

        const cached = this._getCachedStats() || {};

        /* Score compuesto: cobertura documental (% submódulos con archivos) */
        const submodulesConArchivos = this.submodules.filter(sub => {
            const codeMatch = sub.match(/^(\d+\.\d+\.\d+)/);
            if (!codeMatch) return false;
            const code = codeMatch[1];
            const d = cached[code];
            return d && !d.error && (d.archivos || 0) > 0;
        }).length;
        const cobertura = this.submodules.length > 0
            ? Math.round((submodulesConArchivos / this.submodules.length) * 100)
            : 0;

        const totalArchivos = Object.values(cached).reduce(
            (sum, d) => sum + (d && !d.error ? (d.archivos || 0) : 0), 0);
        const totalCarpetas = Object.values(cached).reduce(
            (sum, d) => sum + (d && !d.error ? (d.carpetas || 0) : 0), 0);
        const tiposUnicos = new Set();
        Object.values(cached).forEach(d => {
            if (d && !d.error && d.porExtension) {
                Object.keys(d.porExtension).forEach(ext => tiposUnicos.add(ext));
            }
        });

        /* ── 1. Hero strip (hero card + 3 metric cards) ────────────── */
        const health = document.createElement("div");
        health.className = "kair-health";

        const heroMsg = cobertura === 100
            ? "Toda la documentación de emergencias y brigadistas está cargada."
            : cobertura >= 50
                ? "Cobertura parcial. Carga los documentos pendientes."
                : "Carga los documentos para mejorar la cobertura del módulo.";

        const heroCard = document.createElement("div");
        heroCard.className = "kair-hero-card";
        heroCard.innerHTML = `
            <div class="kair-hero-eyebrow">COBERTURA DOCUMENTAL</div>
            <h2>${submodulesConArchivos}/${this.submodules.length} submódulos con archivos</h2>
            <p class="kair-hero-msg">${heroMsg}</p>
            <div class="kair-hero-score">${cobertura}%<span>cobertura</span></div>
        `;
        health.appendChild(heroCard);

        health.appendChild(this.renderMetricCard({
            title: "Total Archivos",
            value: totalArchivos,
            desc: "Documentos cargados",
            progress: totalArchivos > 0 ? 100 : 0,
            state: ""
        }));
        health.appendChild(this.renderMetricCard({
            title: "Total Carpetas",
            value: totalCarpetas,
            desc: "Carpetas en estructura",
            progress: totalCarpetas > 0 ? 100 : 0,
            state: ""
        }));
        health.appendChild(this.renderMetricCard({
            title: "Tipos Únicos",
            value: tiposUnicos.size,
            desc: "Extensiones diferentes",
            progress: tiposUnicos.size > 0 ? 100 : 0,
            state: ""
        }));

        container.appendChild(health);

        /* ── 2. Content grid (chart SVG + radar panel) ─────────────── */
        const content = document.createElement("div");
        content.className = "kair-content";

        const chartCard = document.createElement("div");
        chartCard.className = "kair-card";
        chartCard.innerHTML = `
            <div class="kair-row-title">
                <div>
                    <h3>Archivos por submódulo</h3>
                    <div class="kair-card-hint">Distribución de documentos cargados</div>
                </div>
            </div>
            <div class="kair-chart">${this.renderChartAmenazas(cached)}</div>
        `;
        content.appendChild(chartCard);

        const radarCard = document.createElement("div");
        radarCard.className = "kair-card";
        radarCard.innerHTML = `
            <div class="kair-row-title">
                <div>
                    <h3>En tu radar</h3>
                    <div class="kair-card-hint">Alertas documentales</div>
                </div>
            </div>
            ${this.buildRadarTasks(cached)}
        `;
        content.appendChild(radarCard);

        container.appendChild(content);

        /* ── 3. Grid de submódulos ───────────────────────────────────── */
        const modules = document.createElement("div");
        modules.className = "kair-modules";
        modules.appendChild(this.renderSubmodulesGrid());
        container.appendChild(modules);
    }

    _getCachedStats() {
        return window._amenazasHomeState.cache.get(this.currentCompany) || null;
    }

    async refreshStats() {
        const company = this.currentCompany;
        if (!company || !window.electronAPI || !window.electronAPI.getDocumentFolders) {
            console.warn('[AMENAZAS] No se puede refrescar — falta electronAPI o empresa.');
            return;
        }

        console.log('[AMENAZAS] Refrescando estadísticas para ' + company + '...');

        const cached = this._getCachedStats() || {};
        const next = Object.assign({}, cached);

        /* Disparar todas las peticiones en paralelo (patrón gestion-peligros-home.js) */
        const tasks = this.submodules.map(async (sub) => {
            const codeMatch = sub.match(/^(\d+\.\d+\.\d+)/);
            if (!codeMatch) return;
            const code = codeMatch[1];
            try {
                const result = await window.electronAPI.getDocumentFolders({
                    companyName: company,
                    moduleName: this.moduleName,
                    submoduleName: sub
                });

                if (!result || !result.success) {
                    next[code] = { error: (result && result.error) || 'Sin acceso a la carpeta' };
                    return;
                }

                const folders = Array.isArray(result.folders) ? result.folders : [];
                const files = Array.isArray(result.files) ? result.files : [];

                const ultimaMod = files.reduce((max, f) => {
                    const t = f.modified ? new Date(f.modified).getTime() : 0;
                    return t > max ? t : max;
                }, 0);

                const porExtension = {};
                files.forEach(f => {
                    const ext = (f.extension || 'otro').toLowerCase() || 'otro';
                    porExtension[ext] = (porExtension[ext] || 0) + 1;
                });

                next[code] = {
                    carpetas: folders.length,
                    archivos: files.length,
                    ultimaModificacion: ultimaMod ? new Date(ultimaMod).toISOString() : null,
                    porExtension
                };
            } catch (err) {
                console.error('[AMENAZAS] Error en submódulo', sub, err);
            }
        });

        await Promise.all(tasks);

        window._amenazasHomeState.cache.set(company, next);
        window._amenazasHomeState.lastUpdate.set(company, Date.now());
        this.updateWidgetsUI(next);
    }

    updateWidgetsUI(data) {
        if (!data) return;
        Object.keys(this.widgets).forEach(code => {
            if (data[code]) {
                this.widgets[code].update(data[code]);
            }
        });
        // 📦734 · renderArchivosChart/renderTiposChart fueron reemplazados por
        // renderChartAmenazas (SVG nativo) en el rediseño premium. El chart SVG
        // se renderiza una sola vez en renderMainArea() y consume el cache
        // directamente, no necesita refresh reactivo como los charts Chart.js legacy.
    }

    renderSubmoduleItem(name) {
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
        submoduleMeta.textContent = 'Visualizador de documentos';
        submoduleInfo.appendChild(submoduleMeta);

        const button = document.createElement('button');
        button.className = 'btn-ingresar';
        button.textContent = 'Ingresar';
        button.addEventListener('click', () => {
            showSubmoduleContent(document.querySelector('.main-canvas'), this.moduleName, name);
        });

        submoduleItem.appendChild(submoduleInfo);
        submoduleItem.appendChild(button);
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
     * Detecta: submódulos sin archivos, última carga >90 días, total archivos = 0.
     */
    buildRadarTasks(cached) {
        const tasks = [];

        // 1. Submódulos sin archivos cargados
        this.submodules.forEach(sub => {
            const codeMatch = sub.match(/^(\d+\.\d+\.\d+)/);
            if (!codeMatch) return;
            const code = codeMatch[1];
            const d = cached[code];
            if (!d || d.error || (d.archivos || 0) === 0) {
                tasks.push({
                    icon: '⚠️',
                    color: 'warn',
                    title: sub,
                    desc: 'Sin archivos cargados'
                });
            }
        });

        // 2. Última carga muy antigua (>90 días)
        Object.keys(cached).forEach(code => {
            const d = cached[code];
            if (!d || d.error || !d.ultimaModificacion) return;
            const days = Math.floor((Date.now() - new Date(d.ultimaModificacion).getTime()) / 86400000);
            if (days > 90) {
                tasks.push({
                    icon: '🕐',
                    color: 'warn',
                    title: code,
                    desc: `Última carga hace ${days} días`
                });
            }
        });

        // 3. Sin archivos en ningún submódulo
        const totalArchivos = Object.values(cached).reduce((sum, d) => sum + (d && !d.error ? (d.archivos || 0) : 0), 0);
        if (totalArchivos === 0 && this.submodules.length > 0) {
            tasks.push({
                icon: '📁',
                color: 'danger',
                title: 'Módulo sin documentación',
                desc: 'Carga los documentos en cada submódulo para mejorar la cobertura'
            });
        }

        if (tasks.length === 0) {
            return '<div style="padding: 16px 0; color: var(--kair-muted); font-size: 13px;">✓ Sin alertas. Toda la documentación está al día.</div>';
        }

        return tasks.slice(0, 3).map(t => {
            const colorVar = t.color === 'ok' ? 'var(--kair-mint)' :
                              t.color === 'warn' ? 'var(--kair-amber)' :
                              'var(--kair-red)';
            const bgColor = 'var(--kair-soft)';
            return `
                <div class="kair-task">
                    <div class="kair-task-icon" style="background: ${bgColor}; color: ${colorVar};">${t.icon}</div>
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
    renderChartAmenazas(cached) {
        if (this.submodules.length === 0) {
            return '<svg viewBox="0 0 400 160" xmlns="http://www.w3.org/2000/svg"><text x="200" y="80" text-anchor="middle" fill="#748096" font-size="13">Sin submódulos</text></svg>';
        }

        const labels = this.submodules.map(sub => {
            const codeMatch = sub.match(/^(\d+\.\d+\.\d+)/);
            return codeMatch ? codeMatch[1] : sub;
        });
        const counts = this.submodules.map(sub => {
            const codeMatch = sub.match(/^(\d+\.\d+\.\d+)/);
            if (!codeMatch) return 0;
            const d = cached[codeMatch[1]];
            return d && !d.error ? (d.archivos || 0) : 0;
        });
        const maxCount = Math.max(...counts, 1);

        const W = 400, H = 160;
        const barH = 24;
        const gap = 12;
        const labelW = 90;
        const valueW = 90;
        const barAreaW = W - labelW - valueW - 20;
        const startY = 16;

        let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;

        labels.forEach((label, i) => {
            const y = startY + i * (barH + gap);
            const barW = counts[i] > 0 ? Math.max(8, (counts[i] / maxCount) * barAreaW) : 0;
            const fillPct = (counts[i] / maxCount) * 100;
            const color = counts[i] === 0 ? '#e8ebee' : fillPct > 70 ? '#1bb888' : fillPct > 30 ? '#2057b8' : '#e7a224';

            // Label
            svg += `<text x="${labelW - 8}" y="${y + barH / 2 + 4}" text-anchor="end" fill="#14213d" font-size="12" font-weight="600">${label}</text>`;
            // Bar background
            svg += `<rect x="${labelW}" y="${y}" width="${barAreaW}" height="${barH}" fill="#f3f6f6" rx="6"/>`;
            // Bar fill
            if (barW > 0) {
                svg += `<rect x="${labelW}" y="${y}" width="${barW}" height="${barH}" fill="${color}" rx="6"/>`;
            }
            // Value label
            svg += `<text x="${labelW + barAreaW + 8}" y="${y + barH / 2 + 4}" fill="#748096" font-size="11">${counts[i]} archivo${counts[i] !== 1 ? 's' : ''}</text>`;
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
                <small>Visualizador de documentos</small>
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


    async renderSidebarPanel(container) {
    }

}


// Hacer la clase disponible globalmente
window.GestionAmenazasHome = GestionAmenazasHome;