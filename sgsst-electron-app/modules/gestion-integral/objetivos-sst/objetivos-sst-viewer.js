// objetivos-sst-viewer.js
// Versión 2: Sistema Híbrido de Principios + Auto-guardado + Modal de Edición

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTES DEL MÓDULO
// ═══════════════════════════════════════════════════════════════════════════

const PRINCIPLES_META = [
    {
        id: 1, principle: 'Prevención', cssClass: 'k-p1', icon: 'shield-check',
        title: 'Prevenir lesiones, enfermedades laborales, contaminación y daños',
        text: 'A partir de la identificación de peligros, control de actos y condiciones inseguras.'
    },
    {
        id: 2, principle: 'Requisitos Legales', cssClass: 'k-p2', icon: 'clipboard-check',
        title: 'Promover satisfacción de necesidades y requisitos legales',
        text: 'Cumplir requisitos en calidad, seguridad, salud en el trabajo, medio ambiente.'
    },
    {
        id: 3, principle: 'Satisfacción Cliente', cssClass: 'k-p3', icon: 'people',
        title: 'Proyectar calidad total y satisfacción del cliente',
        text: 'Mantener relación mutuamente beneficiosa, satisfacer y exceder expectativas.'
    },
    {
        id: 4, principle: 'Recursos y Mejora', cssClass: 'k-p4', icon: 'gear',
        title: 'Proporcionar recursos y personal competente',
        text: 'Recursos financieros y personal calificado para lograr metas de mejora continua.'
    }
];

const KEYWORD_MAP = {
    1: ['accidente', 'lesion', 'lesión', 'incidente', 'enfermedad laboral',
        'accidentalidad', 'mortalidad', 'ausentismo', 'peligro', 'riesgo',
        'severidad', 'mortal', 'eventos con les', 'frecuencia de ac'],
    2: ['legal', 'ley ', 'normativa', 'requisito legal', 'cumplimiento legal',
        'matriz legal', 'reglamento', 'decreto', 'resolución', 'otros requisitos',
        'cumplir con los requisitos'],
    3: ['cliente', 'satisfacc', 'queja', 'reclamo', 'encuesta', 'calidad total',
        'expectativa', 'lograr la satisf', 'servicio al'],
    4: ['presupuesto', 'recurso', 'capacitac', 'competen', 'mejora continua',
        'acciones correctiva', 'acciones preventiva', 'cronograma',
        'ambientes de trabajo', 'ambiente sano', 'correctiva', 'preventiva', 'sano y seguro']
};

// ═══════════════════════════════════════════════════════════════════════════
// CLASE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

class ObjetivosSSTViewer {
    constructor() {
        this.companyName           = null;
        this.moduleName            = null;
        this.submoduleName         = null;
        this.excelFilePath         = null;
        this.policyText            = '';
        this.groups                = [];   // [{objective, principleId, principleSource, confidence, matchedWords, autoDetectedId, indicators}]
        this.isDataLoaded          = false;
        this.activePrinciple       = null;
        this.activePopoverGroupIdx = null;
        this.editModalState        = { groupIdx: null, indicatorIdx: null };

        this.extractParamsFromURL();
        this.init();
    }

    extractParamsFromURL() {
        const urlParams    = new URLSearchParams(window.location.search);
        this.companyName   = urlParams.get('company');
        this.moduleName    = urlParams.get('module');
        this.submoduleName = urlParams.get('submodule');

        console.log('[objetivos-sst-viewer.js] Parámetros recibidos:', {
            company: this.companyName, module: this.moduleName, submodule: this.submoduleName
        });
    }

    async init() {
        try {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.loadData());
            } else {
                await this.loadData();
            }
        } catch (error) {
            console.error('[objetivos-sst-viewer.js] Error inicializando:', error);
            this.showError('Error inicializando el componente de Objetivos SST');
        }
    }

    async loadData() {
        try {
            console.log('[objetivos-sst-viewer.js] Iniciando carga de datos...');

            const excelPathResponse = await this.requestExcelPath();
            if (!excelPathResponse.success) {
                throw new Error(excelPathResponse.error || 'No se pudo obtener la ruta del archivo Excel');
            }

            this.excelFilePath = excelPathResponse.filePath;
            console.log('[objetivos-sst-viewer.js] Ruta Excel:', this.excelFilePath);

            const data       = await this.loadExcelData();
            this.policyText  = data.policyText || '';
            this.groups      = this.buildGroups(data.objectivesData || []);

            this.updateUIWithData();
            this.isDataLoaded = true;
            console.log('[objetivos-sst-viewer.js] Datos cargados. Grupos:', this.groups.length);
        } catch (error) {
            console.error('[objetivos-sst-viewer.js] Error cargando datos:', error);
            this.showError(`Error cargando datos: ${error.message}`);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // AUTO-DETECCIÓN DE PRINCIPIO POR PALABRAS CLAVE
    // ═══════════════════════════════════════════════════════════════════════════

    autoDetectPrinciple(text) {
        const lower   = text.toLowerCase();
        const scores  = { 1: 0, 2: 0, 3: 0, 4: 0 };
        const matches = { 1: [], 2: [], 3: [], 4: [] };

        for (const [pid, words] of Object.entries(KEYWORD_MAP)) {
            for (const word of words) {
                if (lower.includes(word.toLowerCase())) {
                    scores[pid]++;
                    matches[pid].push(word);
                }
            }
        }

        let maxScore = 0;
        let bestPid  = 4; // default: Recursos y Mejora
        for (const [pid, score] of Object.entries(scores)) {
            if (score > maxScore) { maxScore = score; bestPid = parseInt(pid); }
        }

        return {
            principleId:  bestPid,
            confidence:   maxScore >= 2 ? 'high' : maxScore === 1 ? 'medium' : 'low',
            matchedWords: matches[bestPid]
        };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTRUCCIÓN DE GRUPOS
    // Agrupa filas planas por texto de objetivo. Usa principleId de col H si existe,
    // de lo contrario auto-detecta.
    // ═══════════════════════════════════════════════════════════════════════════

    buildGroups(objectivesData) {
        const map = new Map();

        objectivesData.forEach(row => {
            const key = (row.objective || '').trim();
            if (!key) return;

            if (!map.has(key)) {
                const savedPid  = row.principleId ? parseInt(row.principleId) : null;
                const validPid  = [1, 2, 3, 4].includes(savedPid) ? savedPid : null;
                const detection = this.autoDetectPrinciple(key);

                map.set(key, {
                    objective:       key,
                    principleId:     validPid || detection.principleId,
                    principleSource: validPid ? 'manual' : 'auto',
                    confidence:      detection.confidence,
                    matchedWords:    detection.matchedWords,
                    autoDetectedId:  detection.principleId,
                    indicators:      []
                });
            }

            map.get(key).indicators.push({
                indicator:   row.indicator   || '',
                formula:     row.formula     || '',
                goal:        row.goal        || '',
                frequency:   row.frequency   || 'Mensual',
                responsible: row.responsible || ''
            });
        });

        return Array.from(map.values());
    }

    /**
     * Devuelve la vista de datos agrupados por principio (compatible con renderPolicy).
     */
    getPolicyData() {
        return PRINCIPLES_META.map(p => ({
            ...p,
            objectives: this.groups.filter(g => g.principleId === p.id)
        }));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // AUTO-GUARDADO INMEDIATO
    // Llamado automáticamente tras cada cambio (modal, principio, nuevo objetivo).
    // Muestra "Guardando..." y luego "Sincronizado" en el badge del header.
    // ═══════════════════════════════════════════════════════════════════════════

    async autoSave() {
        if (!this.isDataLoaded || !this.excelFilePath) return;

        const badge = document.getElementById('syncStatus');
        if (badge) {
            badge.className = 'k-sync-badge k-sync-saving';
            badge.innerHTML = '<i class="bi bi-arrow-repeat k-spin"></i> Guardando...';
        }

        try {
            const flatData = [];
            this.groups.forEach(g => {
                g.indicators.forEach(ind => {
                    flatData.push({
                        objective:   g.objective,
                        indicator:   ind.indicator,
                        formula:     ind.formula,
                        goal:        ind.goal,
                        frequency:   ind.frequency,
                        responsible: ind.responsible,
                        principleId: g.principleId   // col H
                    });
                });
            });

            const saveResponse = await this.saveExcelData({
                policyText:     this.policyText,
                objectivesData: flatData
            });

            if (saveResponse.success) {
                if (badge) {
                    badge.className = 'k-sync-badge k-sync-synced';
                    badge.innerHTML = '<i class="bi bi-check-circle-fill"></i> Sincronizado';
                }
            } else {
                throw new Error(saveResponse.error || 'Error desconocido al guardar');
            }
        } catch (error) {
            console.error('[objetivos-sst-viewer.js] Auto-guardado fallido:', error);
            if (badge) {
                badge.className = 'k-sync-badge k-sync-error';
                badge.innerHTML = '<i class="bi bi-exclamation-circle-fill"></i> Error al guardar';
            }
            this.showError(`Auto-guardado fallido: ${error.message}`);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ACTUALIZACIÓN DE UI
    // ═══════════════════════════════════════════════════════════════════════════

    updateUIWithData() {
        this.updateStats();
        this.renderPolicy();
        this.renderTable();
    }

    updateStats() {
        const totalObjectives = this.groups.length;
        const totalIndicators = this.groups.reduce((s, g) => s + g.indicators.length, 0);
        const el = (id) => document.getElementById(id);
        if (el('stat-objectives')) el('stat-objectives').textContent = totalObjectives;
        if (el('stat-indicators')) el('stat-indicators').textContent = totalIndicators;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // RENDERIZADO: PANEL IZQUIERDO DE POLÍTICA
    // ═══════════════════════════════════════════════════════════════════════════

    renderPolicy() {
        const container = document.getElementById('policyBody');
        if (!container) return;
        container.innerHTML = '';

        this.getPolicyData().forEach(p => {
            const totalIndicators = p.objectives.reduce((s, o) => s + o.indicators.length, 0);
            const manualCount     = p.objectives.filter(o => o.principleSource === 'manual').length;

            const block = document.createElement('div');
            block.className   = `k-principle-block ${p.cssClass}`;
            block.dataset.pid = p.id;
            block.onclick     = () => this.highlightPrinciple(p.id);

            block.innerHTML = `
                <div class="k-principle-header">
                    <span class="k-principle-badge">
                        <i class="bi bi-${p.icon}"></i>
                        ${p.principle}
                    </span>
                    <div class="k-principle-stats">
                        ${manualCount > 0 ? `
                        <span class="k-manual-count visible" title="${manualCount} objetivo(s) con principio asignado manualmente">
                            <i class="bi bi-pencil-fill"></i>${manualCount} manual
                        </span>` : ''}
                        <span class="k-principle-count">
                            <i class="bi bi-list-check"></i>${totalIndicators} indic.
                        </span>
                    </div>
                </div>
                <div class="k-principle-title">${p.title}</div>
                <div class="k-principle-text">${p.text}</div>
                <div class="k-principle-objectives">
                    ${p.objectives.length === 0
                        ? '<span style="font-size:0.6rem;color:var(--k-text-muted);font-style:italic;">Sin objetivos asignados</span>'
                        : p.objectives.map(o => `
                            <span class="k-objective-tag" title="${o.objective}">
                                <i class="bi bi-arrow-return-right"></i>${o.indicators.length} indic.
                            </span>
                        `).join('')
                    }
                </div>
            `;
            container.appendChild(block);
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // RENDERIZADO: TABLA DE OBJETIVOS E INDICADORES
    // ═══════════════════════════════════════════════════════════════════════════

    renderTable() {
        const tbody = document.getElementById('objectivesBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        this.groups.forEach((group, groupIdx) => {
            const p         = PRINCIPLES_META.find(x => x.id === group.principleId);
            const isAuto    = group.principleSource === 'auto';
            const confClass = `k-conf-${group.confidence}`;
            const confLabel = { high: 'Alta', medium: 'Media', low: 'Baja' }[group.confidence];

            group.indicators.forEach((ind, idx) => {
                const tr = document.createElement('tr');
                tr.className        = `k-objective-row k-row-p${p.id}`;
                if (idx > 0) tr.classList.add('k-indicator-row');
                tr.dataset.pid      = p.id;
                tr.dataset.groupIdx = groupIdx;

                if (idx === 0) {
                    const badgeSrcClass = isAuto ? 'k-psb-auto' : 'k-psb-manual';
                    const badgePClass   = `k-psb-p${p.id}`;
                    const badgeIcon     = isAuto
                        ? `<span class="k-confidence-dot ${confClass}" title="Confianza: ${confLabel}"></span>`
                        : `<i class="bi bi-pencil-fill" style="font-size:0.55rem;"></i>`;
                    const badgeTitle    = isAuto
                        ? `Auto-detectado (confianza ${confLabel}). Clic para cambiar.`
                        : `Asignado manualmente. Clic para cambiar.`;

                    tr.innerHTML = `
                        <td>
                            <div class="k-cell-objective">
                                <button
                                    class="k-principle-selector-btn ${badgeSrcClass} ${badgePClass}"
                                    data-group-idx="${groupIdx}"
                                    title="${badgeTitle}"
                                    onclick="openPopover(this, ${groupIdx})"
                                >${badgeIcon} ${p.principle} <i class="bi bi-chevron-down" style="font-size:0.5rem;opacity:0.7;"></i></button>
                                ${group.objective}
                                ${group.indicators.length > 1
                                    ? `<span style="font-size:0.6rem;color:var(--k-text-muted)">(${group.indicators.length} indicadores)</span>`
                                    : ''}
                            </div>
                        </td>
                        <td><span class="k-cell-indicator">${ind.indicator}</span></td>
                        <td><span class="k-cell-formula" title="${ind.formula}">${ind.formula}</span></td>
                        <td><span class="k-cell-goal">${ind.goal}</span></td>
                        <td><span class="k-cell-frequency">${ind.frequency}</span></td>
                        <td><span class="k-cell-responsible">${ind.responsible}</span></td>
                        <td class="k-col-actions">
                            <button class="k-btn-icon" title="Editar indicador"
                                onclick="openEditModal(${groupIdx}, ${idx})">
                                <i class="bi bi-pencil"></i>
                            </button>
                        </td>
                    `;
                } else {
                    tr.innerHTML = `
                        <td>
                            <div class="k-indent-marker">
                                <i class="bi bi-arrow-return-right"></i>
                                ${idx + 1} de ${group.indicators.length}
                            </div>
                        </td>
                        <td><span class="k-cell-indicator">${ind.indicator}</span></td>
                        <td><span class="k-cell-formula" title="${ind.formula}">${ind.formula}</span></td>
                        <td><span class="k-cell-goal">${ind.goal}</span></td>
                        <td><span class="k-cell-frequency">${ind.frequency}</span></td>
                        <td><span class="k-cell-responsible">${ind.responsible}</span></td>
                        <td class="k-col-actions">
                            <button class="k-btn-icon" title="Editar indicador"
                                onclick="openEditModal(${groupIdx}, ${idx})">
                                <i class="bi bi-pencil"></i>
                            </button>
                        </td>
                    `;
                }

                tbody.appendChild(tr);
            });
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ASIGNACIÓN MANUAL DE PRINCIPIO
    // ═══════════════════════════════════════════════════════════════════════════

    changePrinciple(groupIdx, newPid) {
        // Validar parámetros
        if (groupIdx === null || groupIdx === undefined || !this.groups[groupIdx]) {
            console.warn('[objetivos-sst-viewer.js] Índice de grupo inválido');
            return;
        }
        
        if (![1, 2, 3, 4].includes(newPid)) {
            console.warn('[objetivos-sst-viewer.js] ID de principio inválido:', newPid);
            return;
        }

        const group = this.groups[groupIdx];
        if (!group || group.principleId === newPid) { 
            this.closePopover(); 
            return; 
        }

        group.principleId     = newPid;
        group.principleSource = 'manual';

        this.closePopover();
        this.renderTable();
        this.renderPolicy();
        this.updateStats();
        this.autoSave();

        const pName = PRINCIPLES_META.find(p => p.id === newPid)?.principle || 'Desconocido';
        this.showToast(`Principio actualizado: ${pName}`);
    }

    resetToAuto(groupIdx) {
        // Usar el índice activo si no se proporciona uno
        const idx = groupIdx !== undefined && groupIdx !== null ? groupIdx : this.activePopoverGroupIdx;
        
        if (idx === null || idx === undefined) {
            console.warn('[objetivos-sst-viewer.js] Índice de grupo no especificado');
            return;
        }
        
        const group = this.groups[idx];
        if (!group) {
            console.warn('[objetivos-sst-viewer.js] Grupo no encontrado para índice:', idx);
            return;
        }

        group.principleId     = group.autoDetectedId;
        group.principleSource = 'auto';

        this.closePopover();
        this.renderTable();
        this.renderPolicy();
        this.updateStats();
        this.autoSave();

        this.showToast('Auto-detección restaurada');
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // POPOVER DE SELECCIÓN DE PRINCIPIO
    // ═══════════════════════════════════════════════════════════════════════════

    openPopover(btn, groupIdx) {
        // Prevenir que se cierre inmediatamente
        event.stopPropagation();
        
        // Verificar que el grupo existe
        if (groupIdx === null || groupIdx === undefined || !this.groups[groupIdx]) {
            console.warn('[objetivos-sst-viewer.js] Grupo inválido para popover');
            return;
        }
        
        this.activePopoverGroupIdx = groupIdx;
        const group   = this.groups[groupIdx];
        const popover = document.getElementById('principlePopover');
        if (!popover) {
            console.error('[objetivos-sst-viewer.js] Elemento popover no encontrado');
            return;
        }

        // Chips de principios
        const chipsContainer = document.getElementById('popoverChips');
        if (chipsContainer) {
            chipsContainer.innerHTML = PRINCIPLES_META.map(p => `
                <div class="k-p-chip chip-p${p.id} ${group.principleId === p.id ? 'active' : ''}"
                    onclick="selectPrinciple(${groupIdx}, ${p.id})" title="${p.title}">
                    <div class="k-p-chip-icon"><i class="bi bi-${p.icon}"></i></div>
                    <div class="k-p-chip-label">${p.principle}</div>
                    <i class="bi bi-check2 k-check"></i>
                </div>
            `).join('');
        }

        // Info de auto-detección
        const isAuto   = group.principleSource === 'auto';
        const confText = { high: 'Alta', medium: 'Media', low: 'Baja' }[group.confidence] || 'Baja';
        const autoP    = PRINCIPLES_META.find(p => p.id === group.autoDetectedId);

        const el = (id) => document.getElementById(id);
        if (el('popoverAutoLabel')) el('popoverAutoLabel').textContent = isAuto ? '⚡ Auto-detectado' : '✏ Asignado manualmente';
        if (el('popoverAutoDesc'))  el('popoverAutoDesc').textContent  = isAuto
            ? `Principio sugerido: "${autoP?.principle || 'Ninguno'}". Palabras clave: ${group.matchedWords?.slice(0, 2).join(', ') || 'ninguna'}.`
            : `Auto-detección sugería: "${autoP?.principle || 'Ninguno'}" (confianza ${confText}).`;

        const confFill  = el('popoverConfFill');
        const confLabel = el('popoverConfLabel');
        if (confFill)  confFill.className  = `k-confidence-bar-fill k-conf-fill-${group.confidence || 'low'}`;
        if (confLabel) { 
            confLabel.className = `k-confidence-label k-conf-label-${group.confidence || 'low'}`; 
            confLabel.textContent = confText; 
        }

        const resetBtn = el('popoverResetBtn');
        if (resetBtn) resetBtn.classList.toggle('hidden', isAuto);

        // Posicionamiento relativo al badge
        const rect       = btn.getBoundingClientRect();
        const popH       = 270;
        const spaceBelow = window.innerHeight - rect.bottom;
        const top        = spaceBelow > popH ? rect.bottom + 6 : rect.top - popH - 6;
        let left         = rect.left;
        if (left + 300 > window.innerWidth - 12) left = window.innerWidth - 312;

        popover.style.display = 'block';
        popover.style.top     = `${top}px`;
        popover.style.left    = `${Math.max(12, left)}px`;
    }

    closePopover() {
        const popover = document.getElementById('principlePopover');
        if (popover) {
            popover.style.display = 'none';
        } else {
            console.warn('[objetivos-sst-viewer.js] Elemento popover no encontrado al cerrar');
        }
        this.activePopoverGroupIdx = null;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // MODAL DE EDICIÓN DE INDICADOR
    // ═══════════════════════════════════════════════════════════════════════════

    openEditModal(groupIdx, indicatorIdx) {
        const group = this.groups[groupIdx];
        const ind   = group.indicators[indicatorIdx];
        const p     = PRINCIPLES_META.find(x => x.id === group.principleId);

        this.editModalState = { groupIdx, indicatorIdx };

        const el = (id) => document.getElementById(id);

        // Header con acento de color del principio
        const header = el('editModalHeader');
        if (header) header.className = `k-modal-header accent-p${p.id}`;

        const icon = el('editModalIcon');
        if (icon) icon.className = `k-modal-icon icon-p${p.id}`;

        const subtitle = el('editModalSubtitle');
        if (subtitle) subtitle.textContent = `Indicador ${indicatorIdx + 1} de ${group.indicators.length}`;

        const pill = el('editModalPill');
        if (pill) {
            pill.className = `k-modal-principle-pill pill-p${p.id}`;
            pill.innerHTML = `<i class="bi bi-${p.icon}"></i> ${p.principle}`;
        }

        // Rellenar campos
        if (el('editObjective'))   el('editObjective').value   = group.objective;
        if (el('editIndicator'))   el('editIndicator').value   = ind.indicator;
        if (el('editFormula'))     el('editFormula').value     = ind.formula;
        if (el('editGoal'))        el('editGoal').value        = ind.goal;
        if (el('editResponsible')) el('editResponsible').value = ind.responsible;

        const freqSelect = el('editFrequency');
        if (freqSelect) {
            freqSelect.value = ind.frequency;
            if (freqSelect.value !== ind.frequency) {
                const opt = document.createElement('option');
                opt.value = opt.textContent = ind.frequency;
                freqSelect.appendChild(opt);
                freqSelect.value = ind.frequency;
            }
        }

        // Hint del objetivo
        const hintSpan = document.querySelector('#editObjectiveHint span');
        if (hintSpan) {
            hintSpan.textContent = group.indicators.length > 1
                ? `Este texto es compartido por los ${group.indicators.length} indicadores de este objetivo.`
                : 'Descripción que identifica este objetivo estratégico.';
        }

        // Meta del footer
        const meta = el('editModalMeta');
        if (meta) {
            meta.textContent = group.principleSource === 'manual'
                ? `Principio asignado manualmente · ${p.principle}`
                : `Principio auto-detectado · ${p.principle}`;
        }

        // Mostrar modal
        const backdrop = el('editModalBackdrop');
        if (backdrop) backdrop.classList.remove('hidden');
        setTimeout(() => el('editObjective')?.focus(), 80);
    }

    closeEditModal() {
        const backdrop = document.getElementById('editModalBackdrop');
        if (backdrop) backdrop.classList.add('hidden');
        this.editModalState = { groupIdx: null, indicatorIdx: null };
    }

    saveEditModal() {
        const { groupIdx, indicatorIdx } = this.editModalState;
        if (groupIdx === null) return;

        const group = this.groups[groupIdx];
        const ind   = group.indicators[indicatorIdx];
        const el    = (id) => document.getElementById(id);

        const newObjective   = el('editObjective')?.value.trim()   || '';
        const newIndicator   = el('editIndicator')?.value.trim()   || '';
        const newFormula     = el('editFormula')?.value.trim()     || '';
        const newGoal        = el('editGoal')?.value.trim()        || '';
        const newFrequency   = el('editFrequency')?.value          || 'Mensual';
        const newResponsible = el('editResponsible')?.value.trim() || '';

        if (!newObjective || !newIndicator || !newGoal) {
            this.showError('Objetivo, indicador y meta son obligatorios.');
            return;
        }

        // Si cambió el objetivo y el principio es auto, re-detectar
        const objectiveChanged = newObjective !== group.objective;
        if (objectiveChanged) {
            group.objective = newObjective;
            if (group.principleSource === 'auto') {
                const detection      = this.autoDetectPrinciple(newObjective);
                group.principleId    = detection.principleId;
                group.confidence     = detection.confidence;
                group.matchedWords   = detection.matchedWords;
                group.autoDetectedId = detection.principleId;
            }
        }

        // Actualizar indicador
        ind.indicator   = newIndicator;
        ind.formula     = newFormula;
        ind.goal        = newGoal;
        ind.frequency   = newFrequency;
        ind.responsible = newResponsible;

        this.closeEditModal();
        this.renderTable();
        this.renderPolicy();
        this.updateStats();
        this.autoSave();  // ← auto-guardar inmediatamente

        this.showToast(objectiveChanged
            ? 'Objetivo e indicador actualizados.'
            : `Indicador "${newIndicator}" actualizado.`
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // HIGHLIGHT DE PRINCIPIO
    // ═══════════════════════════════════════════════════════════════════════════

    highlightPrinciple(pid) {
        if (this.activePrinciple === pid) {
            this.activePrinciple = null;
            document.querySelectorAll('.k-principle-block').forEach(el => {
                el.style.opacity = '1';
                el.classList.remove('k-active');
            });
            document.querySelectorAll('.k-objective-row').forEach(el => el.style.opacity = '1');
            return;
        }

        this.activePrinciple = pid;

        document.querySelectorAll('.k-principle-block').forEach(el => {
            const isPid = parseInt(el.dataset.pid) === pid;
            el.style.opacity = isPid ? '1' : '0.35';
            el.classList.toggle('k-active', isPid);
        });

        document.querySelectorAll('.k-objective-row').forEach(el => {
            el.style.opacity = parseInt(el.dataset.pid) === pid ? '1' : '0.2';
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SINCRONIZACIÓN MANUAL (botón "Actualizar Excel")
    // Con auto-save, este botón es redundante pero se mantiene por UX explícita.
    // ═══════════════════════════════════════════════════════════════════════════

    async syncToExcel() {
        if (!this.isDataLoaded) {
            this.showError('Aún no se han cargado los datos.');
            return;
        }
        await this.autoSave();
        this.showToast('Excel actualizado correctamente.');
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // AGREGAR NUEVO OBJETIVO
    // ═══════════════════════════════════════════════════════════════════════════

    addNewObjective() {
        this.groups.push({
            objective:       'Nuevo Objetivo',
            principleId:     4,
            principleSource: 'auto',
            confidence:      'low',
            matchedWords:    [],
            autoDetectedId:  4,
            indicators: [{
                indicator:   'Nuevo Indicador',
                formula:     '',
                goal:        '0',
                frequency:   'Mensual',
                responsible: 'Coordinador SST'
            }]
        });

        this.renderTable();
        this.renderPolicy();
        this.updateStats();
        this.autoSave();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // COMUNICACIÓN CON EL PROCESO PRINCIPAL (contratos sin cambios)
    // ═══════════════════════════════════════════════════════════════════════════

    async requestExcelPath() {
        return new Promise((resolve) => {
            const requestId = `get-excel-path-${Date.now()}`;
            const handleMessage = (event) => {
                if (event.data?.action === 'get-excel-path-response' && event.data.requestId === requestId) {
                    window.removeEventListener('message', handleMessage);
                    resolve(event.data);
                }
            };
            window.addEventListener('message', handleMessage);
            window.parent.postMessage({
                action: 'get-excel-path-request', requestId,
                payload: { company: this.companyName, module: this.moduleName, submodule: this.submoduleName }
            }, '*');
        });
    }

    async loadExcelData() {
        return new Promise((resolve, reject) => {
            const requestId = `load-excel-data-${Date.now()}`;
            const handleMessage = (event) => {
                if (event.data?.action === 'load-excel-data-response' && event.data.requestId === requestId) {
                    window.removeEventListener('message', handleMessage);
                    if (event.data.success) resolve(event.data.data);
                    else reject(new Error(event.data.error || 'Error al cargar datos'));
                }
            };
            window.addEventListener('message', handleMessage);
            window.parent.postMessage({
                action: 'load-excel-data-request', requestId,
                payload: { filePath: this.excelFilePath }
            }, '*');
        });
    }

    async saveExcelData(data) {
        return new Promise((resolve) => {
            const requestId = `save-excel-data-${Date.now()}`;
            const handleMessage = (event) => {
                if (event.data?.action === 'save-excel-data-response' && event.data.requestId === requestId) {
                    window.removeEventListener('message', handleMessage);
                    resolve(event.data);
                }
            };
            window.addEventListener('message', handleMessage);
            window.parent.postMessage({
                action: 'save-excel-data-request', requestId,
                payload: { filePath: this.excelFilePath, data }
            }, '*');
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // UTILIDADES UI
    // ═══════════════════════════════════════════════════════════════════════════

    showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `k-toast k-toast-${type}`;
        const icon = type === 'success' ? 'check-circle-fill' : 'exclamation-circle-fill';
        toast.innerHTML = `<i class="bi bi-${icon}"></i><span>${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 2500);
    }

    showError(message) {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = 'k-toast';
        toast.innerHTML = `<i class="bi bi-exclamation-circle-fill"></i><span>${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 5000);
        console.error('[objetivos-sst-viewer.js]', message);
    }

    // Mantenido por compatibilidad — con auto-save ya no es necesario
    markPending() { /* deprecado: auto-save reemplaza este método */ }
}

// ═══════════════════════════════════════════════════════════════════════════
// INSTANCIA GLOBAL Y FUNCIONES PUENTE
// Los onclick de innerHTML generado dinámicamente requieren funciones globales.
// ═══════════════════════════════════════════════════════════════════════════

let objetivosSSTViewer;

document.addEventListener('DOMContentLoaded', () => {
    objetivosSSTViewer = new ObjetivosSSTViewer();
});

function syncToExcel()                  { if (objetivosSSTViewer) objetivosSSTViewer.syncToExcel(); }
function addNewObjective()              { if (objetivosSSTViewer) objetivosSSTViewer.addNewObjective(); }
function highlightPrinciple(pid)        { if (objetivosSSTViewer) objetivosSSTViewer.highlightPrinciple(pid); }
function openPopover(btn, groupIdx)     { if (objetivosSSTViewer) objetivosSSTViewer.openPopover(btn, groupIdx); }
function closePopover()                 { if (objetivosSSTViewer) objetivosSSTViewer.closePopover(); }
function selectPrinciple(groupIdx, pid) { if (objetivosSSTViewer) objetivosSSTViewer.changePrinciple(groupIdx, pid); }
function resetToAuto()                  { if (objetivosSSTViewer) objetivosSSTViewer.resetToAuto(objetivosSSTViewer.activePopoverGroupIdx); }
function openEditModal(gIdx, iIdx)      { if (objetivosSSTViewer) objetivosSSTViewer.openEditModal(gIdx, iIdx); }
function closeEditModal()               { if (objetivosSSTViewer) objetivosSSTViewer.closeEditModal(); }
function saveEditModal()                { if (objetivosSSTViewer) objetivosSSTViewer.saveEditModal(); }
function backToModule()                 { window.parent.postMessage({ action: 'backToModule' }, '*'); }
function resetToAutoFromUI()            { if (objetivosSSTViewer) objetivosSSTViewer.resetToAuto(objetivosSSTViewer.activePopoverGroupIdx); }

// Función auxiliar para manejar errores de forma más robusta
function handleGlobalError(error, context) {
    console.error(`[objetivos-sst-viewer.js] Error en ${context}:`, error);
    if (objetivosSSTViewer) {
        objetivosSSTViewer.showError(`Error en ${context}: ${error.message}`);
    }
}

// ESC cierra modal o popover
document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !objetivosSSTViewer) return;
    const backdrop = document.getElementById('editModalBackdrop');
    if (backdrop && !backdrop.classList.contains('hidden')) {
        objetivosSSTViewer.closeEditModal();
    } else {
        objetivosSSTViewer.closePopover();
    }
});

// Clic fuera del popover lo cierra
document.addEventListener('click', (e) => {
    if (!objetivosSSTViewer) return;
    const popover = document.getElementById('principlePopover');
    if (popover && popover.style.display !== 'none' &&
        !popover.contains(e.target) &&
        !e.target.closest('.k-principle-selector-btn')) {
        objetivosSSTViewer.closePopover();
    }
});
