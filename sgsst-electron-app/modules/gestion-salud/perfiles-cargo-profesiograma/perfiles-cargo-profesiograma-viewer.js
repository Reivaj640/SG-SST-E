// perfiles-cargo-profesiograma-viewer.js
// Lógica del submódulo 3.1.3 Perfiles de Cargo y Profesiograma
//
// Ejecuta dentro del iframe. Usa window.electronAPI.profesiograma.* para hablar
// con el bridge main/profesiograma-bridge.js vía IPC.
//
// Vistas:
//   - home: KPIs + 5 module cards
//   - matriz: lista de cargos + sus exámenes (Ingreso/Periódico/Retiro)
//   - pruebas: descripción de cada tipo de prueba
//   - recomendaciones: por factor de riesgo
//   - vacunacion: esquema de vacunas
//   - alturas: requisitos para trabajo en alturas

(function () {
    'use strict';

    // ━━━ ESTADO ━━━
    const state = {
        view: 'home',
        kpis: null,
        matriz: { cargos: [], tiposExamen: [] },
        tiposExamen: [],
        pruebas: [],
        recomendaciones: [],
        vacunas: [],
        alturas: [],
        search: '',
        profesiogramaId: null,
        pendingExamChanges: new Map(),
        // Explorador de archivos
        explorerLoaded: false,
        explorerCurrentPath: null,
        explorerBasePath: null,
        explorerPathHistory: [],
    };

    const API = () => {
        // El preload inyecta electronAPI solo en el contexto del renderer principal.
        // Dentro del iframe, tenemos que acceder al parent.
        if (window.electronAPI && window.electronAPI.profesiograma) return window.electronAPI.profesiograma;
        if (window.parent && window.parent.electronAPI && window.parent.electronAPI.profesiograma) return window.parent.electronAPI.profesiograma;
        if (window.top && window.top.electronAPI && window.top.electronAPI.profesiograma) return window.top.electronAPI.profesiograma;
        return null;
    };

    // ━━━ HELPERS ━━━
    function $(id) { return document.getElementById(id); }
    function $$(sel) { return Array.from(document.querySelectorAll(sel)); }

    function escapeHTML(s) {
        if (s == null) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function toast(msg, type) {
        const t = $('toast');
        t.textContent = msg;
        t.className = 'toast show ' + (type || '');
        setTimeout(() => t.className = 'toast ' + (type || ''), 2500);
    }

    function fmtNumber(n) {
        if (n == null) return '0';
        return Number(n).toLocaleString('es-CO');
    }

    // ━━━ TABS / VIEW SWITCHING ━━━
    function switchView(name) {
        state.view = name;
        $$('.view').forEach(v => v.classList.remove('active'));
        $$('.tab').forEach(t => t.classList.remove('active'));
        const viewEl = $('view-' + name);
        const tabEl = document.querySelector('.tab[data-view="' + name + '"]');
        if (viewEl) viewEl.classList.add('active');
        if (tabEl) tabEl.classList.add('active');

        const labels = {
            home: 'Inicio', matriz: 'Matriz de Exámenes', pruebas: 'Descripción de Pruebas',
            recomendaciones: 'Recomendaciones', vacunacion: 'Vacunación', alturas: 'Trabajo en Alturas',
            explorer: 'Perfiles de Cargo'
        };
        $('bc-current').textContent = labels[name] || name;

        // Cargar datos lazily
        if (name === 'matriz' && state.matriz.cargos.length === 0) loadMatriz();
        else if (name === 'pruebas' && state.pruebas.length === 0 && state.tiposExamen.length === 0) loadPruebas();
        else if (name === 'recomendaciones' && state.recomendaciones.length === 0) loadRecomendaciones();
        else if (name === 'vacunacion' && state.vacunas.length === 0) loadVacunacion();
        else if (name === 'alturas' && state.alturas.length === 0) loadAlturas();
        else if (name === 'explorer' && !state.explorerLoaded) loadExplorer();
    }

    // ━━━ KPIs (HOME) ━━━
    async function loadKpis() {
        const api = API();
        if (!api) {
            console.warn('[PROFESIOGRAMA-3.1.3] API no disponible (electronAPI.profesiograma no encontrado en window/parent/top)');
            // Renderizar KPIs en 0 para que al menos se vea algo
            state.kpis = { totalCargos: 0, totalGrupos: 0, totalTiposExamen: 0, totalVacunas: 0, examenesIngreso: 0, vacunacionesRequeridas: 0 };
            renderKpis();
            return;
        }
        try {
            const res = await api.kpis();
            if (res && res.success) {
                state.kpis = res.data;
                renderKpis();
                $('badge-cargos').textContent = fmtNumber(res.data.totalCargos);
                $('badge-pruebas').textContent = fmtNumber(res.data.totalTiposExamen);
                $('badge-vacunas').textContent = fmtNumber(res.data.totalVacunas);
            } else {
                console.warn('[PROFESIOGRAMA-3.1.3] KPI response sin success:', res);
                state.kpis = { totalCargos: 0, totalGrupos: 0, totalTiposExamen: 0, totalVacunas: 0, examenesIngreso: 0, vacunacionesRequeridas: 0 };
                renderKpis();
            }
        } catch (e) {
            console.error('[PROFESIOGRAMA-3.1.3] Error cargando KPIs:', e);
        }
    }

    function renderKpis() {
        if (!state.kpis) return;
        const k = state.kpis;
        const items = [
            { icon: 'users', color: 'var(--primary)', label: 'Cargos', value: k.totalCargos },
            { icon: 'building', color: 'var(--success)', label: 'Grupos Ocupacionales', value: k.totalGrupos },
            { icon: 'clipboard-list', color: 'var(--text-muted)', label: 'Tipos de Examen', value: k.totalTiposExamen },
            { icon: 'syringe', color: 'var(--warning)', label: 'Vacunas', value: k.totalVacunas },
            { icon: 'stethoscope', color: 'var(--success)', label: 'Exámenes Ingreso', value: k.examenesIngreso, sub: 'activos' },
            { icon: 'shield-alt', color: 'var(--primary)', label: 'Vacunaciones', value: k.vacunacionesRequeridas, sub: 'requeridas' },
        ];
        $('kpi-strip').innerHTML = items.map(i => `
            <div class="kpi">
                <div class="kpi-head"><i class="fas fa-${i.icon}" style="color:${i.color}"></i> ${i.label}</div>
                <div class="kpi-value">${fmtNumber(i.value)}</div>
                ${i.sub ? `<div class="kpi-sub">${i.sub}</div>` : ''}
            </div>
        `).join('');
    }

    // ━━━ MATRIZ ━━━
    async function loadMatriz() {
        if (!API()) return;
        $('matriz-body').innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Cargando matriz…</div>';
        try {
            const res = await API().matriz();
            if (res && res.success) {
                state.matriz = res.data;
                // Capturar el profesiogramaId del primer cargo (todos pertenecen al mismo)
                if (state.matriz.cargos && state.matriz.cargos.length > 0 && state.matriz.cargos[0].profesiograma_id) {
                    state.profesiogramaId = state.matriz.cargos[0].profesiograma_id;
                }
                renderMatriz();
            } else {
                $('matriz-body').innerHTML = '<div class="data-table empty">Sin datos. Importe el archivo GI-FO-047 desde Excel.</div>';
            }
        } catch (e) {
            console.error('Error cargando matriz:', e);
            $('matriz-body').innerHTML = '<div class="data-table empty">Error al cargar la matriz.</div>';
        }
    }

    function renderMatriz() {
        const { cargos, tiposExamen } = state.matriz;
        if (!cargos || cargos.length === 0) {
            $('matriz-body').innerHTML = '<div class="data-table empty">No hay cargos registrados. Use el botón "Importar Excel" o cree uno nuevo.</div>';
            updatePendingBar();
            return;
        }
        const s = state.search.toLowerCase();
        const filtered = cargos.filter(c =>
            !s || (c.nombre && c.nombre.toLowerCase().includes(s)) ||
            (c.grupoOcupacional && c.grupoOcupacional.nombre && c.grupoOcupacional.nombre.toLowerCase().includes(s))
        );
        // Construir header: GRUPO | CARGO | DESCRIPCIÓN | TIPO_EXAMEN_1 (I/P/R) | TIPO_EXAMEN_2 | …
        const cols = (tiposExamen || []).slice(0, 12); // limitar columnas visibles para no romper

        // Helper: resuelve el estado de un I/P/R cell (con cambios pendientes aplicados)
        function resolveIpr(cargoId, tipoId, originalIpr, field) {
            const key = cargoId + '|' + tipoId;
            const pending = state.pendingExamChanges.get(key);
            if (pending) {
                // Si hay cambios pendientes, el valor es el del pending
                if (field === 'I') return pending.ingreso;
                if (field === 'P') return pending.periodico;
                if (field === 'R') return pending.retiro;
                return false;
            }
            // Sin cambios pendientes, mostrar original
            if (field === 'I') return !!originalIpr.ingreso;
            if (field === 'P') return !!originalIpr.periodico;
            if (field === 'R') return !!originalIpr.retiro;
            return false;
        }

        // Detectar cargos con cambios pendientes
        const dirtyCargos = new Set();
        state.pendingExamChanges.forEach((_, key) => {
            const cargoId = key.split('|')[0];
            dirtyCargos.add(cargoId);
        });

        let html = '<div style="overflow-x:auto"><table class="data-table"><thead><tr>';
        html += '<th>Grupo</th><th>Cargo</th><th>Descripción</th>';
        cols.forEach(t => { html += `<th colspan="3" style="text-align:center">${escapeHTML(t.nombre)}</th>`; });
        html += '<th>Acciones</th></tr><tr>';
        html += '<th></th><th></th><th></th>';
        cols.forEach(() => { html += '<th style="text-align:center; font-size:0.65rem">I</th><th style="text-align:center; font-size:0.65rem">P</th><th style="text-align:center; font-size:0.65rem">R</th>'; });
        html += '<th></th></tr></thead><tbody>';

        filtered.forEach(c => {
            const examenes = c.examenes || [];
            // Convertir examenes array a map por tipoId
            const examByTipo = {};
            examenes.forEach(e => { examByTipo[e.tipoExamenId] = e; });

            const isDirty = dirtyCargos.has(c.id);
            html += `<tr${isDirty ? ' class="dirty-row"' : ''}>
                <td>${escapeHTML((c.grupoOcupacional && c.grupoOcupacional.nombre) || '—')}</td>
                <td><strong>${escapeHTML(c.nombre)}</strong></td>
                <td style="max-width:240px; color:var(--text-muted); font-size:0.8rem">${escapeHTML(c.descripcion || '')}</td>`;
            cols.forEach(t => {
                const e = examByTipo[t.id] || {};
                const key = c.id + '|' + t.id;
                const isPending = state.pendingExamChanges.has(key);
                const Iclass = 'ipr-cell ' + (resolveIpr(c.id, t.id, e, 'I') ? 'on ' : '') + (isPending ? 'dirty' : '');
                const Pclass = 'ipr-cell ' + (resolveIpr(c.id, t.id, e, 'P') ? 'on ' : '') + (isPending ? 'dirty' : '');
                const Rclass = 'ipr-cell ' + (resolveIpr(c.id, t.id, e, 'R') ? 'on ' : '') + (isPending ? 'dirty' : '');
                html += `<td><span class="${Iclass.trim()}" data-ipr="I" data-cargo="${escapeHTML(c.id)}" data-tipo="${escapeHTML(t.id)}" title="Ingreso">I</span></td>
                         <td><span class="${Pclass.trim()}" data-ipr="P" data-cargo="${escapeHTML(c.id)}" data-tipo="${escapeHTML(t.id)}" title="Periódico">P</span></td>
                         <td><span class="${Rclass.trim()}" data-ipr="R" data-cargo="${escapeHTML(c.id)}" data-tipo="${escapeHTML(t.id)}" title="Retiro">R</span></td>`;
            });
            html += `<td>
                <button class="btn sm" data-action="edit-cargo" data-id="${escapeHTML(c.id)}" title="Editar cargo"><i class="fas fa-edit"></i></button>
                <button class="btn sm danger" data-action="del-cargo" data-id="${escapeHTML(c.id)}" title="Eliminar cargo"><i class="fas fa-trash"></i></button>
            </td></tr>`;
        });
        html += '</tbody></table></div>';
        $('matriz-body').innerHTML = html;
        updatePendingBar();
    }

    // ━━━ IPR TOGGLE ━━━
    function toggleIpr(cargoId, tipoId, field) {
        // Buscar el valor actual (con cambios pendientes ya aplicados)
        const cargo = state.matriz.cargos.find(c => c.id === cargoId);
        if (!cargo) return;
        const examenes = cargo.examenes || [];
        const original = examenes.find(e => e.tipoExamenId === tipoId) || { ingreso: false, periodico: false, retiro: false };

        const key = cargoId + '|' + tipoId;
        let pending = state.pendingExamChanges.get(key);
        if (!pending) {
            // Inicializar con el valor original
            pending = {
                ingreso: !!original.ingreso,
                periodico: !!original.periodico,
                retiro: !!original.retiro
            };
        }
        // Toggle
        if (field === 'I') pending.ingreso = !pending.ingreso;
        else if (field === 'P') pending.periodico = !pending.periodico;
        else if (field === 'R') pending.retiro = !pending.retiro;

        // Si el pending es igual al original, eliminarlo (revertir cambio)
        if (pending.ingreso === !!original.ingreso &&
            pending.periodico === !!original.periodico &&
            pending.retiro === !!original.retiro) {
            state.pendingExamChanges.delete(key);
        } else {
            state.pendingExamChanges.set(key, pending);
        }
        renderMatriz();
    }

    function updatePendingBar() {
        // Buscar o crear la barra
        let bar = $('pending-bar');
        const count = state.pendingExamChanges.size;
        if (count === 0) {
            if (bar) bar.remove();
            return;
        }
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'pending-bar';
            bar.style.cssText = 'position:sticky; top:0; z-index:10; background:#fff8e6; border:1px solid #ffc107; border-radius:6px; padding:10px 14px; margin-bottom:12px; display:flex; align-items:center; gap:12px; box-shadow:0 2px 6px rgba(0,0,0,0.05);';
            $('matriz-body').insertBefore(bar, $('matriz-body').firstChild);
        }
        bar.innerHTML = `
            <i class="fas fa-exclamation-circle" style="color:var(--warning); font-size:1.1rem;"></i>
            <span style="flex:1"><strong>${count}</strong> examen${count > 1 ? 'es' : ''} pendiente${count > 1 ? 's' : ''} de guardar</span>
            <button class="btn sm" id="btn-revert-changes"><i class="fas fa-undo"></i> Descartar cambios</button>
            <button class="btn primary sm" id="btn-save-exams"><i class="fas fa-save"></i> Guardar cambios de exámenes</button>
        `;
        $('btn-revert-changes').onclick = () => {
            if (confirm('¿Descartar todos los cambios pendientes?')) {
                state.pendingExamChanges.clear();
                renderMatriz();
            }
        };
        $('btn-save-exams').onclick = saveExams;
    }

    async function saveExams() {
        if (state.pendingExamChanges.size === 0) return;
        if (!API()) { toast('API no disponible', 'error'); return; }
        // Agrupar cambios por cargo
        const byCargo = new Map();
        state.pendingExamChanges.forEach((pending, key) => {
            const [cargoId, tipoId] = key.split('|');
            if (!byCargo.has(cargoId)) byCargo.set(cargoId, []);
            byCargo.get(cargoId).push({
                tipoExamenId: tipoId,
                ingreso: pending.ingreso ? 1 : 0,
                periodico: pending.periodico ? 1 : 0,
                retiro: pending.retiro ? 1 : 0
            });
        });

        toast('Guardando ' + byCargo.size + ' cargo(s)...', 'success');
        let ok = 0, fail = 0;
        for (const [cargoId, examenes] of byCargo.entries()) {
            try {
                // IMPORTANTE: el bridge espera el formato {tipoExamenId, ingreso, periodico, retiro}
                // donde cada uno es 1 o 0
                const res = await API().cargosSave({ id: cargoId, examenes: examenes });
                if (res && res.success) {
                    ok++;
                } else {
                    fail++;
                    console.error('Error guardando cargo ' + cargoId + ':', res && res.error);
                }
            } catch (e) {
                fail++;
                console.error('Excepción guardando cargo ' + cargoId + ':', e);
            }
        }
        if (fail === 0) {
            state.pendingExamChanges.clear();
            toast(`Cambios guardados (${ok} cargo${ok > 1 ? 's' : ''})`, 'success');
            // Recargar la matriz para ver los cambios persistidos
            state.matriz = { cargos: [], tiposExamen: [] };
            loadMatriz();
        } else {
            toast(`${ok} OK, ${fail} con error. Revisá la consola.`, 'error');
        }
    }

    // ━━━ PRUEBAS ━━━
    async function loadPruebas() {
        if (!API()) return;
        // Cargar tanto las pruebas (descripcion) como los tipos de examen
        await Promise.all([loadTiposExamen(), loadDescripcionPruebas()]);
    }

    async function loadTiposExamen() {
        try {
            const res = await API().tipoExamenList();
            if (res && res.success) {
                state.tiposExamen = res.data;
                renderTiposExamen();
            } else {
                $('tipos-examen-body').innerHTML = '<div class="data-table empty">Sin tipos de examen registrados.</div>';
            }
        } catch (e) {
            console.error(e);
            $('tipos-examen-body').innerHTML = '<div class="data-table empty">Error al cargar.</div>';
        }
    }

    async function loadDescripcionPruebas() {
        try {
            const res = await API().pruebasList();
            if (res && res.success) {
                state.pruebas = res.data;
                renderPruebas();
            } else {
                $('pruebas-body').innerHTML = '<div class="data-table empty">Sin pruebas registradas.</div>';
            }
        } catch (e) {
            console.error(e);
            $('pruebas-body').innerHTML = '<div class="data-table empty">Error al cargar.</div>';
        }
    }

    function renderTiposExamen() {
        const data = state.tiposExamen || [];
        if (data.length === 0) {
            $('tipos-examen-body').innerHTML = '<div class="data-table empty">No hay tipos de examen. Use el botón "Nuevo Tipo de Examen" para agregar el primero.</div>';
            return;
        }
        // Mapeo de categoria a label legible
        const catLabels = {
            'EVALUACION_MEDICA': 'Evaluación Médica',
            'PRUEBAS_COMPLEMENTARIAS': 'Pruebas Complementarias',
            'LABORATORIO': 'Laboratorio'
        };
        let html = '<table class="data-table"><thead><tr><th style="width:60px">Orden</th><th>Nombre</th><th>Categoría</th><th>Descripción</th><th style="width:140px">Acciones</th></tr></thead><tbody>';
        data.forEach(t => {
            const cat = t.categoria || '';
            const catLabel = catLabels[cat] || cat;
            const tagClass = cat === 'EVALUACION_MEDICA' ? 'info' : (cat === 'PRUEBAS_COMPLEMENTARIAS' ? 'success' : 'warning');
            html += `<tr>
                <td>${t.orden || '-'}</td>
                <td><strong>${escapeHTML(t.nombre)}</strong></td>
                <td><span class="tag ${tagClass}">${escapeHTML(catLabel)}</span></td>
                <td style="max-width:340px; font-size:0.8rem; color:var(--text-muted)">${escapeHTML(t.descripcion || '')}</td>
                <td>
                    <button class="btn sm" data-action="edit-tipo-examen" data-id="${escapeHTML(t.id)}" title="Editar"><i class="fas fa-edit"></i></button>
                    <button class="btn sm danger" data-action="del-tipo-examen" data-id="${escapeHTML(t.id)}" data-nombre="${escapeHTML(t.nombre)}" title="Eliminar"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
        });
        html += '</tbody></table>';
        $('tipos-examen-body').innerHTML = html;
    }

    function renderPruebas() {
        const data = state.pruebas;
        if (data.length === 0) {
            $('pruebas-body').innerHTML = '<div class="data-table empty">No hay pruebas registradas.</div>';
            return;
        }
        let html = '<table class="data-table"><thead><tr><th>Tipo de Examen</th><th>Personal Objetivo</th><th>Ingreso</th><th>Periódico</th><th>Retiro</th><th>Referencia</th><th>Acciones</th></tr></thead><tbody>';
        data.forEach(p => {
            html += `<tr>
                <td><strong>${escapeHTML(p.tipo_examen || '')}</strong></td>
                <td style="max-width:280px">${escapeHTML(p.personal_objetivo || '')}</td>
                <td style="font-size:0.78rem">${escapeHTML(p.ingreso || '')}</td>
                <td style="font-size:0.78rem">${escapeHTML(p.periodico || '')}</td>
                <td style="font-size:0.78rem">${escapeHTML(p.retiro || '')}</td>
                <td style="font-size:0.78rem; color:var(--text-muted)">${escapeHTML(p.referencia || '')}</td>
                <td>
                    <button class="btn sm" data-action="edit-prueba" data-id="${escapeHTML(p.id)}"><i class="fas fa-edit"></i></button>
                    <button class="btn sm danger" data-action="del-prueba" data-id="${escapeHTML(p.id)}"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
        });
        html += '</tbody></table>';
        $('pruebas-body').innerHTML = html;
    }

    // ━━━ RECOMENDACIONES ━━━
    async function loadRecomendaciones() {
        if (!API()) return;
        try {
            const res = await API().recomendacionesList();
            if (res && res.success) {
                state.recomendaciones = res.data;
                renderRecomendaciones();
            } else {
                $('recomendaciones-body').innerHTML = '<div class="data-table empty">Sin recomendaciones registradas.</div>';
            }
        } catch (e) {
            console.error(e);
            $('recomendaciones-body').innerHTML = '<div class="data-table empty">Error al cargar.</div>';
        }
    }

    function renderRecomendaciones() {
        const data = state.recomendaciones;
        if (data.length === 0) {
            $('recomendaciones-body').innerHTML = '<div class="data-table empty">No hay recomendaciones registradas.</div>';
            return;
        }
        let html = '<table class="data-table"><thead><tr><th>Factor de Riesgo</th><th>Definición</th><th>Exámenes</th><th>Pruebas Específicas</th><th>Restricciones</th><th>Acciones</th></tr></thead><tbody>';
        data.forEach(r => {
            html += `<tr>
                <td><strong>${escapeHTML(r.factor_riesgo || '')}</strong></td>
                <td style="max-width:240px">${escapeHTML(r.definicion || '')}</td>
                <td style="max-width:200px; font-size:0.8rem">${escapeHTML(r.examenes || '')}</td>
                <td style="max-width:200px; font-size:0.8rem">${escapeHTML(r.pruebas_especificas || '')}</td>
                <td style="max-width:200px; font-size:0.8rem">${escapeHTML(r.restricciones || '')}</td>
                <td>
                    <button class="btn sm" data-action="edit-recomendacion" data-id="${escapeHTML(r.id)}"><i class="fas fa-edit"></i></button>
                    <button class="btn sm danger" data-action="del-recomendacion" data-id="${escapeHTML(r.id)}"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
        });
        html += '</tbody></table>';
        $('recomendaciones-body').innerHTML = html;
    }

    // ━━━ VACUNACION ━━━
    async function loadVacunacion() {
        const api = API();
        if (!api) return;
        try {
            const res = await api.vacunacionList();
            if (res && res.success) {
                // El handler retorna {vacunas: [], asignaciones: []} — solo nos importa vacunas
                state.vacunas = (res.data && res.data.vacunas) || [];
                renderVacunacion();
            } else {
                $('vacunacion-body').innerHTML = '<div class="data-table empty">Sin vacunas registradas.</div>';
            }
        } catch (e) {
            console.error(e);
            $('vacunacion-body').innerHTML = '<div class="data-table empty">Error al cargar.</div>';
        }
    }

    function renderVacunacion() {
        const data = state.vacunas;
        if (data.length === 0) {
            $('vacunacion-body').innerHTML = '<div class="data-table empty">No hay vacunas registradas.</div>';
            return;
        }
        let html = '<table class="data-table"><thead><tr><th>Vacuna</th><th>Recomendación</th><th>Esquema</th><th>Acciones</th></tr></thead><tbody>';
        data.forEach(v => {
            html += `<tr>
                <td><strong>${escapeHTML(v.nombre || '')}</strong></td>
                <td style="max-width:300px">${escapeHTML(v.recomendacion || '')}</td>
                <td style="max-width:240px; font-size:0.8rem">${escapeHTML(v.esquema || '')}</td>
                <td>
                    <button class="btn sm" data-action="edit-vacuna" data-id="${escapeHTML(v.id)}"><i class="fas fa-edit"></i></button>
                    <button class="btn sm danger" data-action="del-vacuna" data-id="${escapeHTML(v.id)}"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
        });
        html += '</tbody></table>';
        $('vacunacion-body').innerHTML = html;
    }

    // ━━━ ALTURAS ━━━
    async function loadAlturas() {
        if (!API()) return;
        try {
            const res = await API().alturasList();
            if (res && res.success) {
                state.alturas = res.data;
                renderAlturas();
            } else {
                $('alturas-body').innerHTML = '<div class="data-table empty">Sin requisitos registrados.</div>';
            }
        } catch (e) {
            console.error(e);
            $('alturas-body').innerHTML = '<div class="data-table empty">Error al cargar.</div>';
        }
    }

    function renderAlturas() {
        const data = state.alturas;
        if (data.length === 0) {
            $('alturas-body').innerHTML = '<div class="data-table empty">No hay requisitos registrados.</div>';
            return;
        }
        let html = '<table class="data-table"><thead><tr><th>Actividad / Riesgo</th><th>Hallazgos Limitantes</th><th>Paraclínicos</th><th>Observaciones</th><th>Acciones</th></tr></thead><tbody>';
        data.forEach(a => {
            html += `<tr>
                <td><strong>${escapeHTML(a.actividad_riesgo || '')}</strong></td>
                <td style="max-width:280px; font-size:0.8rem">${escapeHTML(a.hallazgos_limitantes || '')}</td>
                <td style="max-width:200px; font-size:0.8rem">${escapeHTML(a.paraclinicos || '')}</td>
                <td style="max-width:200px; font-size:0.8rem">${escapeHTML(a.observaciones || '')}</td>
                <td>
                    <button class="btn sm" data-action="edit-altura" data-id="${escapeHTML(a.id)}"><i class="fas fa-edit"></i></button>
                    <button class="btn sm danger" data-action="del-altura" data-id="${escapeHTML(a.id)}"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
        });
        html += '</tbody></table>';
        $('alturas-body').innerHTML = html;
    }

    // ━━━ DIALOG GENÉRICO ━━━
    function showDialog(title, fields, onSubmit) {
        const host = $('dialog-host');
        let body = '<form id="dlg-form">';
        fields.forEach(f => {
            const isTextarea = f.type === 'textarea';
            const inputHtml = isTextarea
                ? `<textarea name="${f.name}" ${f.required ? 'required' : ''} ${f.disabled ? 'disabled' : ''}>${escapeHTML(f.value || '')}</textarea>`
                : `<input type="${f.type || 'text'}" name="${f.name}" value="${escapeHTML(f.value || '')}" ${f.required ? 'required' : ''} ${f.disabled ? 'disabled' : ''}>`;
            body += `<div class="form-group">
                <label>${escapeHTML(f.label)}${f.required ? ' <span class="required">*</span>' : ''}</label>
                ${inputHtml}
            </div>`;
        });
        body += '</form>';
        host.innerHTML = `<div class="dialog-overlay" id="dlg-overlay">
            <div class="dialog">
                <div class="dialog-header">
                    <div class="dialog-title">${escapeHTML(title)}</div>
                    <button type="button" class="dialog-close" data-dlg-close>&times;</button>
                </div>
                <div class="dialog-body">${body}</div>
                <div class="dialog-footer">
                    <button type="button" class="btn" data-dlg-close>Cancelar</button>
                    <button type="button" class="btn primary" id="dlg-ok">Guardar</button>
                </div>
            </div>
        </div>`;

        const close = () => { host.innerHTML = ''; };
        host.querySelectorAll('[data-dlg-close]').forEach(b => b.onclick = close);
        $('dlg-overlay').onclick = (e) => { if (e.target.id === 'dlg-overlay') close(); };
        $('dlg-ok').onclick = async () => {
            const form = $('dlg-form');
            const data = {};
            let valid = true;
            fields.forEach(f => {
                const el = form.elements[f.name];
                const val = el ? (el.value || '').trim() : '';
                if (f.required && !val) { valid = false; if (el) el.style.borderColor = 'var(--danger)'; }
                else { if (el) el.style.borderColor = ''; data[f.name] = val; }
            });
            if (!valid) { toast('Complete los campos requeridos', 'error'); return; }
            try {
                await onSubmit(data);
                close();
            } catch (e) {
                toast('Error: ' + (e.message || e), 'error');
            }
        };
    }

    // ━━━ TIPO DE EXAMEN (columna nueva en la matriz) ━━━
    function tipoExamenToFields(t) {
        return [
            { name: 'nombre', label: 'Nombre del examen', required: true, value: t && t.nombre },
            { name: 'categoria', label: 'Categoría', required: true, type: 'select',
              options: [
                { value: 'EVALUACION_MEDICA', label: 'Evaluación Médica' },
                { value: 'PRUEBAS_COMPLEMENTARIAS', label: 'Pruebas Complementarias' },
                { value: 'LABORATORIO', label: 'Laboratorio' }
              ],
              value: (t && t.categoria) || 'EVALUACION_MEDICA' },
            { name: 'descripcion', label: 'Descripción', type: 'textarea', value: t && t.descripcion },
            { name: 'orden', label: 'Orden (número)', value: t && t.orden },
        ];
    }

    async function handleTipoExamenSubmit(data, existingId) {
        if (existingId) data.id = existingId;
        if (data.orden) data.orden = parseInt(data.orden, 10) || 0;
        const res = await API().tipoExamenSave(data);
        if (res && res.success) {
            toast(existingId ? 'Tipo de examen actualizado' : 'Tipo de examen creado', 'success');
            // Forzar recarga de la matriz y de la lista de tipos
            state.matriz = { cargos: [], tiposExamen: [] };
            state.tiposExamen = [];
            // Recargar matriz para que aparezca la nueva columna
            loadMatriz();
            // Si estamos en la vista de Pruebas, también recargar la lista de tipos
            if (state.view === 'pruebas') {
                await loadTiposExamen();
            }
            // Si estamos en la vista Matriz, forzar re-render
            if (state.view === 'matriz') {
                renderMatriz();
            }
        } else {
            throw new Error((res && res.error && res.error.message) || 'No se pudo guardar');
        }
    }

    // Reemplazo el dialog genérico para soportar 'select' (categoria)
    function showDialogWithSelect(title, fields, onSubmit) {
        const host = $('dialog-host');
        let body = '<form id="dlg-form">';
        fields.forEach(f => {
            let inputHtml;
            if (f.type === 'select') {
                inputHtml = '<select name="' + f.name + '" ' + (f.required ? 'required' : '') + '>';
                f.options.forEach(opt => {
                    const sel = (opt.value === f.value) ? ' selected' : '';
                    inputHtml += '<option value="' + opt.value + '"' + sel + '>' + opt.label + '</option>';
                });
                inputHtml += '</select>';
            } else if (f.type === 'textarea') {
                inputHtml = '<textarea name="' + f.name + '" ' + (f.required ? 'required' : '') + '>' + escapeHTML(f.value || '') + '</textarea>';
            } else {
                inputHtml = '<input type="' + (f.type || 'text') + '" name="' + f.name + '" value="' + escapeHTML(f.value || '') + '" ' + (f.required ? 'required' : '') + '>';
            }
            body += '<div class="form-group">';
            body += '<label>' + escapeHTML(f.label) + (f.required ? ' <span class="required">*</span>' : '') + '</label>';
            body += inputHtml;
            body += '</div>';
        });
        body += '</form>';
        host.innerHTML = '<div class="dialog-overlay" id="dlg-overlay"><div class="dialog">' +
            '<div class="dialog-header"><div class="dialog-title">' + escapeHTML(title) + '</div>' +
            '<button type="button" class="dialog-close" data-dlg-close>&times;</button></div>' +
            '<div class="dialog-body">' + body + '</div>' +
            '<div class="dialog-footer"><button type="button" class="btn" data-dlg-close>Cancelar</button>' +
            '<button type="button" class="btn primary" id="dlg-ok">Guardar</button></div></div></div>';

        const close = () => { host.innerHTML = ''; };
        host.querySelectorAll('[data-dlg-close]').forEach(b => b.onclick = close);
        $('dlg-overlay').onclick = (e) => { if (e.target.id === 'dlg-overlay') close(); };
        $('dlg-ok').onclick = async () => {
            const form = $('dlg-form');
            const out = {};
            let valid = true;
            fields.forEach(f => {
                const el = form.elements[f.name];
                const val = el ? (el.value || '').trim() : '';
                if (f.required && !val) { valid = false; if (el) el.style.borderColor = 'var(--danger)'; }
                else { if (el) el.style.borderColor = ''; out[f.name] = val; }
            });
            if (!valid) { toast('Complete los campos requeridos', 'error'); return; }
            try {
                await onSubmit(out);
                close();
            } catch (e) {
                toast('Error: ' + (e.message || e), 'error');
            }
        };
    }

    function showNewTipoExamenDialog() {
        showDialogWithSelect('Nuevo Tipo de Examen', tipoExamenToFields(null), d => handleTipoExamenSubmit(d, null));
    }


    // NOTA: Los nombres de campos son camelCase porque así los espera el bridge
    function cargoToFields(c) {
        return [
            { name: 'nombre', label: 'Nombre del cargo', required: true, value: c && c.nombre },
            { name: 'descripcion', label: 'Descripción', type: 'textarea', value: c && c.descripcion },
            { name: 'peligrosRiesgos', label: 'Peligros / Riesgos', type: 'textarea', value: c && c.peligros_riesgos },
            { name: 'grupoOcupacionalId', label: 'ID Grupo Ocupacional', value: c && c.grupo_ocupacional_id },
        ];
    }

    function pruebaToFields(p) {
        return [
            { name: 'tipoExamen', label: 'Tipo de examen', required: true, value: p && p.tipo_examen },
            { name: 'personalObjetivo', label: 'Personal objetivo', type: 'textarea', value: p && p.personal_objetivo },
            { name: 'ingreso', label: 'Ingreso', type: 'textarea', value: p && p.ingreso },
            { name: 'periodico', label: 'Periódico', type: 'textarea', value: p && p.periodico },
            { name: 'retiro', label: 'Retiro', type: 'textarea', value: p && p.retiro },
            { name: 'referencia', label: 'Referencia', value: p && p.referencia },
        ];
    }

    function recomendacionToFields(r) {
        return [
            { name: 'factorRiesgo', label: 'Factor de riesgo', required: true, value: r && r.factor_riesgo },
            { name: 'definicion', label: 'Definición', type: 'textarea', value: r && r.definicion },
            { name: 'examenes', label: 'Exámenes', type: 'textarea', value: r && r.examenes },
            { name: 'pruebasEspecificas', label: 'Pruebas específicas', type: 'textarea', value: r && r.pruebas_especificas },
            { name: 'restricciones', label: 'Restricciones', type: 'textarea', value: r && r.restricciones },
        ];
    }

    function vacunaToFields(v) {
        return [
            { name: 'nombre', label: 'Nombre de la vacuna', required: true, value: v && v.nombre },
            { name: 'recomendacion', label: 'Recomendación', type: 'textarea', value: v && v.recomendacion },
            { name: 'esquema', label: 'Esquema', type: 'textarea', value: v && v.esquema },
        ];
    }

    function alturaToFields(a) {
        return [
            { name: 'actividadRiesgo', label: 'Actividad / Riesgo', required: true, value: a && a.actividad_riesgo },
            { name: 'hallazgosLimitantes', label: 'Hallazgos limitantes', type: 'textarea', value: a && a.hallazgos_limitantes },
            { name: 'paraclinicos', label: 'Paraclínicos', type: 'textarea', value: a && a.paraclinicos },
            { name: 'observaciones', label: 'Observaciones', type: 'textarea', value: a && a.observaciones },
        ];
    }

    async function handleCargoSubmit(data, existingId) {
        if (existingId) {
            data.id = existingId;
        } else {
            // Cargo nuevo: necesita profesiogramaId (la BD lo requiere)
            if (!data.profesiogramaId && state.profesiogramaId) {
                data.profesiogramaId = state.profesiogramaId;
            }
            if (!data.profesiogramaId) {
                throw new Error('No hay profesiograma activo. Importe primero un archivo Excel.');
            }
        }
        const res = await API().cargosSave(data);
        if (res && res.success) {
            toast('Cargo guardado', 'success');
            state.matriz = { cargos: [], tiposExamen: [] }; // forzar reload
            loadMatriz();
        } else {
            throw new Error(res && res.error ? res.error.message : 'No se pudo guardar');
        }
    }

    async function handlePruebaSubmit(data, existingId) {
        if (existingId) data.id = existingId;
        const res = await API().pruebasSave(data);
        if (res && res.success) {
            toast('Prueba guardada', 'success');
            state.pruebas = []; loadPruebas();
        } else { throw new Error((res && res.error && res.error.message) || 'No se pudo guardar'); }
    }

    async function handleRecomendacionSubmit(data, existingId) {
        if (existingId) data.id = existingId;
        const res = await API().recomendacionesSave(data);
        if (res && res.success) {
            toast('Recomendación guardada', 'success');
            state.recomendaciones = []; loadRecomendaciones();
        } else { throw new Error((res && res.error && res.error.message) || 'No se pudo guardar'); }
    }

    async function handleVacunaSubmit(data, existingId) {
        if (existingId) data.id = existingId;
        const res = await API().vacunacionSave(data);
        if (res && res.success) {
            toast('Vacuna guardada', 'success');
            state.vacunas = []; loadVacunacion();
        } else { throw new Error((res && res.error && res.error.message) || 'No se pudo guardar'); }
    }

    async function handleAlturaSubmit(data, existingId) {
        if (existingId) data.id = existingId;
        const res = await API().alturasSave(data);
        if (res && res.success) {
            toast('Requisito guardado', 'success');
            state.alturas = []; loadAlturas();
        } else { throw new Error((res && res.error && res.error.message) || 'No se pudo guardar'); }
    }

    async function handleDelete(kind, id) {
        if (!confirm('¿Eliminar este registro?')) return;
        const map = {
            'cargo': () => API().cargosDelete(id),
            'prueba': () => API().pruebasDelete(id),
            'recomendacion': () => API().recomendacionesDelete(id),
            'vacuna': () => API().vacunacionDelete(id),
            'altura': () => API().alturasDelete(id),
        };
        const res = await map[kind]();
        if (res && res.success) {
            toast('Eliminado', 'success');
            if (kind === 'cargo') { state.matriz = { cargos: [], tiposExamen: [] }; loadMatriz(); }
            else if (kind === 'prueba') { state.pruebas = []; loadPruebas(); }
            else if (kind === 'recomendacion') { state.recomendaciones = []; loadRecomendaciones(); }
            else if (kind === 'vacuna') { state.vacunas = []; loadVacunacion(); }
            else if (kind === 'altura') { state.alturas = []; loadAlturas(); }
        } else {
            toast('No se pudo eliminar', 'error');
        }
    }

    // ━━━ EXPLORER DE ARCHIVOS (Perfiles de Cargo) ━━━
    // File explorer NATIVO (sin iframe) con el mismo look-and-feel que el Responsable SG viewer (1.1.1).
    // Diferencias vs la versión anterior con iframe:
    //   - Sin iframe anidado (no hay loops de postMessage, no hay problemas de "source iframe not found")
    //   - Branding 3.1.3 hardcoded (no muestra "Responsable del SG-SST")
    //   - Llamadas API directas vía window.electronAPI.getDocumentFolders (sin postMessage)
    //   - Mismas clases kair-* que el Responsable SG (mismo look-and-feel)
    //   - Mismo contrato IPC: get-document-folders, read-directory, get-pdf-preview, etc.
    // Estructura del estado del explorer:
    //   state.explorer = {
    //     company, moduleName, submoduleName,
    //     basePath, currentFolderPath, pathHistory,
    //     folders, documents, search
    //   }
    function loadExplorer() {
        if (state.explorerLoaded) {
            console.log('[PROFESIOGRAMA-3.1.3] Explorer ya inicializado, saltando');
            return;
        }

        const params = new URLSearchParams(window.location.search);
        state.explorer = {
            company: params.get('company') || '',
            moduleName: params.get('module') || '3. Gestión de la Salud',
            submoduleName: params.get('submodule') || '3.1.3 Perfil de cargo y profesiograma',
            basePath: null,
            currentFolderPath: null,
            pathHistory: [],
            folders: [],
            documents: [],
            search: '',
            sort: 'name-asc'
        };

        console.log('[PROFESIOGRAMA-3.1.3] Inicializando file explorer nativo para:', state.explorer.submoduleName);

        // Wire de search y sort (sin header propio — el "Volver" está en el header del módulo 3.1.3)
        const searchInput = $('exp-search-input');
        if (searchInput) {
            searchInput.oninput = (e) => {
                state.explorer.search = e.target.value;
                _explorerRenderDocuments();
            };
        }
        const searchClear = $('exp-search-clear');
        if (searchClear) {
            searchClear.onclick = () => {
                state.explorer.search = '';
                if (searchInput) searchInput.value = '';
                _explorerRenderDocuments();
            };
        }
        const sortSelect = $('exp-sort-select');
        if (sortSelect) {
            sortSelect.value = state.explorer.sort;
            sortSelect.onchange = (e) => {
                state.explorer.sort = e.target.value;
                _explorerRenderDocuments();
            };
        }

        // Cargar carpetas iniciales
        _explorerLoadFolders();
        state.explorerLoaded = true;
    }

    // ─── Loading helpers ───
    function _explorerShowLoading(text) {
        const overlay = $('exp-loading-overlay');
        const textEl = $('exp-loading-text');
        if (overlay) overlay.classList.add('is-active');
        if (textEl) textEl.textContent = text || 'Cargando...';
    }
    function _explorerHideLoading() {
        const overlay = $('exp-loading-overlay');
        if (overlay) overlay.classList.remove('is-active');
    }
    function _explorerToast(message, type) {
        const container = $('exp-toast-container');
        if (!container) return;
        type = type || 'info';
        const toast = document.createElement('div');
        toast.className = 'kair-toast kair-toast--' + type;
        toast.textContent = message;
        container.appendChild(toast);
        // Animar entrada
        requestAnimationFrame(() => toast.classList.add('is-active'));
        // Auto-remove
        setTimeout(() => {
            toast.classList.remove('is-active');
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    // ─── API calls ───
    // IMPORTANTE: el viewer 3.1.3 está embebido como iframe, entonces window.electronAPI
    // apunta al del propio iframe (que solo expone electronAPI.profesiograma.*).
    // Para getDocumentFolders / getFolderContents / getPDFPreview (APIs del preload del renderer),
    // hay que subir a window.parent o window.top, igual que hace el helper API() de profesiograma.
    function _explorerGetAPI() {
        // Buscar recursivamente el electronAPI que tenga getDocumentFolders (o cualquier API del preload principal)
        var candidates = [window, window.parent, window.top];
        for (var i = 0; i < candidates.length; i++) {
            try {
                var w = candidates[i];
                if (w && w.electronAPI && typeof w.electronAPI.getDocumentFolders === 'function') {
                    return w.electronAPI;
                }
            } catch (e) { /* cross-origin, ignora */ }
        }
        // Fallback: el electronAPI del propio iframe (no tiene las APIs del preload, pero algo es algo)
        return (window.electronAPI || (window.parent && window.parent.electronAPI) || (window.top && window.top.electronAPI) || null);
    }

    async function _explorerLoadFolders() {
        const ex = state.explorer;
        if (!ex.company) {
            _explorerShowEmptyState('Falta el nombre de empresa. Volvé al inicio y seleccioná una empresa.');
            return;
        }
        _explorerShowLoading('Cargando carpetas...');
        try {
            const api = _explorerGetAPI();
            if (!api || typeof api.getDocumentFolders !== 'function') {
                throw new Error('electronAPI.getDocumentFolders no disponible');
            }
            const result = await api.getDocumentFolders({
                companyName: ex.company,
                moduleName: ex.moduleName,
                submoduleName: ex.submoduleName
            });
            console.log('[PROFESIOGRAMA-3.1.3] getDocumentFolders result:', result);

            if (!result || !result.success) {
                const errMsg = (result && result.error) || 'No se encontró la carpeta para 3.1.3';
                _explorerShowEmptyState('No hay documentos aún para 3.1.3 Perfil de cargo y profesiograma.\n\n' +
                    'La carpeta del submódulo no existe en la estructura de la empresa. ' +
                    'Para usar este visualizador, agregá una carpeta "3.1.3 Perfil de cargo y profesiograma" en la estructura de archivos de la empresa.\n\n' +
                    'Detalle: ' + errMsg);
                return;
            }

            ex.basePath = result.basePath;
            ex.currentFolderPath = result.basePath;
            ex.pathHistory = [];
            ex.folders = result.folders || [];
            ex.documents = result.files || [];

            if (ex.folders.length === 0 && ex.documents.length === 0) {
                _explorerShowEmptyState('La carpeta está vacía. No hay documentos ni subcarpetas.');
            } else {
                _explorerHideEmptyState();
            }

            _explorerRenderBreadcrumb();
            _explorerRenderFolders();
            _explorerRenderDocuments();
        } catch (e) {
            console.error('[PROFESIOGRAMA-3.1.3] Error cargando carpetas:', e);
            _explorerShowEmptyState('Error al cargar: ' + (e.message || e));
            _explorerToast('Error: ' + (e.message || e), 'error');
        } finally {
            _explorerHideLoading();
        }
    }

    async function _explorerLoadFolderContents(folderPath) {
        const ex = state.explorer;
        _explorerShowLoading('Cargando contenido...');
        try {
            const api = _explorerGetAPI();
            if (!api || typeof api.getFolderContents !== 'function') {
                throw new Error('electronAPI.getFolderContents no disponible');
            }
            const result = await api.getFolderContents(folderPath);
            console.log('[PROFESIOGRAMA-3.1.3] getFolderContents result:', result);

            if (!result || !result.success) {
                _explorerToast('Error al abrir carpeta: ' + ((result && result.error) || 'desconocido'), 'error');
                return;
            }
            ex.pathHistory.push(ex.currentFolderPath);
            ex.currentFolderPath = folderPath;
            ex.documents = result.files || [];
            ex.folders = []; // El listado plano no incluye subcarpetas; las cargamos en el siguiente nivel

            _explorerRenderBreadcrumb();
            _explorerRenderFolders();
            _explorerRenderDocuments();
        } catch (e) {
            console.error('[PROFESIOGRAMA-3.1.3] Error cargando contenido:', e);
            _explorerToast('Error: ' + (e.message || e), 'error');
        } finally {
            _explorerHideLoading();
        }
    }

    // ─── Render ───
    // Tabla de tipos de archivo (mismo mapeo que el Responsable SG viewer para mantener
    // paridad visual: clase CSS kair-file__icon--word, label "DOCX", etc.)
    const _EXPLORER_FILE_TYPES = {
        'pdf':        { className: 'pdf',        icon: 'bi-file-earmark-pdf',       label: 'PDF' },
        'xls':        { className: 'excel',      icon: 'bi-file-earmark-excel',     label: 'XLS' },
        'xlsx':       { className: 'excel',      icon: 'bi-file-earmark-excel',     label: 'XLSX' },
        'doc':        { className: 'word',       icon: 'bi-file-earmark-word',      label: 'DOC' },
        'docx':       { className: 'word',       icon: 'bi-file-earmark-word',      label: 'DOCX' },
        'ppt':        { className: 'powerpoint', icon: 'bi-file-earmark-slides',    label: 'PPT' },
        'pptx':       { className: 'powerpoint', icon: 'bi-file-earmark-slides',    label: 'PPTX' },
        'jpg':        { className: 'image',      icon: 'bi-file-earmark-image',     label: 'JPG' },
        'jpeg':       { className: 'image',      icon: 'bi-file-earmark-image',     label: 'JPEG' },
        'png':        { className: 'image',      icon: 'bi-file-earmark-image',     label: 'PNG' },
        'gif':        { className: 'image',      icon: 'bi-file-earmark-image',     label: 'GIF' },
        'txt':        { className: 'text',       icon: 'bi-file-earmark-text',      label: 'TXT' },
        'zip':        { className: 'default',    icon: 'bi-file-earmark-zip',       label: 'ZIP' },
        'rar':        { className: 'default',    icon: 'bi-file-earmark-zip',       label: 'RAR' }
    };
    function _explorerFileTypeInfo(extension) {
        var ext = (extension || '').toLowerCase().replace('.', '');
        return _EXPLORER_FILE_TYPES[ext] || { className: 'default', icon: 'bi-file-earmark', label: (ext.toUpperCase() || 'FILE') };
    }

    function _explorerRenderBreadcrumb() {
        const ex = state.explorer;
        const container = $('exp-breadcrumb');
        if (!container) return;
        if (!ex.currentFolderPath) {
            container.innerHTML = '';
            return;
        }
        // Botón home
        let html = '<button class="kair-crumb" data-action="go-root">' +
                   '<i class="bi bi-hdd kair-crumb__icon"></i>' +
                   '<span class="kair-crumb__label">3.1.3</span>' +
                   '</button>';
        // Si estamos en una subcarpeta, mostrar el path
        if (ex.currentFolderPath !== ex.basePath) {
            const segments = _explorerGetRelativeSegments(ex.basePath, ex.currentFolderPath);
            for (const seg of segments) {
                html += '<span class="kair-crumb__sep">›</span>' +
                        '<span class="kair-crumb__label">' + _explorerEscapeHtml(seg) + '</span>';
            }
        }
        container.innerHTML = html;
        // Wire del botón go-root (volver a la raíz del explorer)
        const rootBtn = container.querySelector('[data-action="go-root"]');
        if (rootBtn) {
            rootBtn.onclick = () => _explorerLoadFolders();
        }
    }

    function _explorerRenderFolders() {
        const ex = state.explorer;
        const container = $('exp-folder-list');
        if (!container) return;
        if (!ex.folders || ex.folders.length === 0) {
            container.innerHTML = '<div class="kair-empty kair-empty--compact">' +
                '<p class="kair-empty__desc">No hay subcarpetas</p></div>';
            return;
        }
        let html = '';
        for (const folder of ex.folders) {
            html += '<button class="kair-folder-item" data-path="' + _explorerEscapeAttr(folder.path) + '">' +
                    '<i class="bi bi-folder-fill kair-folder-item__icon"></i>' +
                    '<span class="kair-folder-item__name">' + _explorerEscapeHtml(folder.name) + '</span>' +
                    '</button>';
        }
        container.innerHTML = html;
        // Wire clicks
        container.querySelectorAll('.kair-folder-item').forEach(btn => {
            btn.onclick = () => _explorerLoadFolderContents(btn.dataset.path);
        });
    }

    function _explorerApplyFiltersAndSort(docs) {
        const ex = state.explorer;
        // Filtrar por búsqueda
        let filtered = docs || [];
        if (ex.search) {
            const q = ex.search.toLowerCase();
            filtered = filtered.filter(d => (d.name || '').toLowerCase().includes(q));
        }
        // Ordenar
        const cmp = ex.sort || 'name-asc';
        filtered = filtered.slice().sort((a, b) => {
            switch (cmp) {
                case 'name-asc':  return (a.name || '').localeCompare(b.name || '');
                case 'name-desc': return (b.name || '').localeCompare(a.name || '');
                case 'size-asc':  return (a.size || 0) - (b.size || 0);
                case 'size-desc': return (b.size || 0) - (a.size || 0);
                case 'date-asc':  return new Date(a.lastModified || 0) - new Date(b.lastModified || 0);
                case 'date-desc': return new Date(b.lastModified || 0) - new Date(a.lastModified || 0);
                default: return 0;
            }
        });
        return filtered;
    }

    function _explorerRenderDocuments() {
        const ex = state.explorer;
        const container = $('exp-file-list');
        if (!container) return;

        // Aplicar filtros y sort
        const filtered = _explorerApplyFiltersAndSort(ex.documents || []);

        // Stats (sobre total sin filtrar)
        const totalCount = (ex.documents || []).length;
        const totalSize = (ex.documents || []).reduce((s, d) => s + (d.size || 0), 0);
        const docCountEl = $('exp-doc-count');
        if (docCountEl) docCountEl.textContent = totalCount;
        const footerCountEl = $('exp-footer-count');
        if (footerCountEl) footerCountEl.textContent = totalCount + (totalCount === 1 ? ' archivo' : ' archivos');
        const footerSizeEl = $('exp-footer-size');
        if (footerSizeEl) footerSizeEl.textContent = _explorerFormatSize(totalSize);

        if (filtered.length === 0) {
            const msg = ex.search
                ? 'No hay archivos que coincidan con "' + _explorerEscapeHtml(ex.search) + '".'
                : 'No hay archivos en esta carpeta.';
            container.innerHTML = '<div class="kair-empty">' +
                '<div class="kair-empty__icon"><i class="bi bi-folder-x"></i></div>' +
                '<h3 class="kair-empty__title">' + (ex.search ? 'Sin resultados' : 'Carpeta vacía') + '</h3>' +
                '<p class="kair-empty__desc">' + msg + '</p>' +
                '</div>';
            return;
        }

        // Misma estructura HTML que el Responsable SG viewer (mismo look-and-feel)
        let html = '<div class="kair-file-grid">';
        for (const doc of filtered) {
            const ext = (doc.extension || _explorerGetExt(doc.name)).toLowerCase();
            const typeInfo = _explorerFileTypeInfo(ext);
            const sizeText = doc.size ? _explorerFormatSize(doc.size) : '';
            const dateText = doc.lastModified ? _explorerFormatDate(doc.lastModified) : '';

            html +=
                '<div class="kair-file" data-path="' + _explorerEscapeAttr(doc.path) + '">' +
                '<div class="kair-file__icon kair-file__icon--' + typeInfo.className + '">' +
                '<i class="bi ' + typeInfo.icon + '"></i>' +
                '</div>' +
                '<div class="kair-file__info">' +
                '<div class="kair-file__name" title="' + _explorerEscapeAttr(doc.name) + '">' + _explorerEscapeHtml(doc.name) + '</div>' +
                '<div class="kair-file__meta">' +
                '<span class="kair-file__badge">' + _explorerEscapeHtml(typeInfo.label) + '</span>' +
                (sizeText ? '<span class="kair-file__size">' + sizeText + '</span>' : '') +
                (dateText ? '<span class="kair-file__date">· ' + dateText + '</span>' : '') +
                '</div>' +
                '</div>' +
                '</div>';
        }
        html += '</div>';
        container.innerHTML = html;
        // Wire clicks (mismo patrón que el Responsable SG)
        container.querySelectorAll('.kair-file').forEach(el => {
            el.onclick = () => _explorerSelectDocument(el.dataset.path);
            el.ondblclick = () => _explorerOpenFile(el.dataset.path);
        });
    }

    async function _explorerSelectDocument(filePath) {
        // Resaltar selección
        document.querySelectorAll('#exp-file-list .kair-file').forEach(li => li.classList.remove('is-active'));
        const li = document.querySelector('#exp-file-list .kair-file[data-path="' + _explorerEscapeAttr(filePath) + '"]');
        if (li) li.classList.add('is-active');

        // Actualizar nombre en preview
        const docName = $('exp-doc-name');
        const fileName = filePath.split(/[\\/]/).pop();
        if (docName) {
            docName.textContent = fileName;
            docName.setAttribute('title', fileName);
        }

        // Cargar preview según extensión (mismo flujo que el Responsable SG: PDF/Excel/Word → iframe con data:application/pdf;base64)
        const ext = _explorerGetExt(fileName).toLowerCase();
        const container = $('exp-preview-container');
        if (!container) return;
        if (ext === 'pdf') {
            await _explorerShowPdfPreview(filePath, container);
        } else if (['xls', 'xlsx'].includes(ext)) {
            _explorerShowExcelPreview(filePath, container);
        } else if (['doc', 'docx'].includes(ext)) {
            _explorerShowWordPreview(filePath, container);
        } else {
            container.innerHTML = '<div class="kair-empty">' +
                '<div class="kair-empty__icon"><i class="bi bi-file-earmark"></i></div>' +
                '<h3 class="kair-empty__title">Vista previa no disponible</h3>' +
                '<p class="kair-empty__desc">Tipo de archivo no soportado para preview. Hacé doble-click para abrirlo con la app predeterminada.</p>' +
                '</div>';
        }
    }

    // Helper: renderiza el PDF en base64 que devuelve la API (mismo patrón que el Responsable SG)
    function _explorerRenderPdfBase64(container, pdfBase64, errorMsg) {
        if (pdfBase64 && typeof pdfBase64 === 'string' && pdfBase64.length > 100) {
            container.innerHTML = '<iframe class="kair-pdf-frame" src="data:application/pdf;base64,' + pdfBase64 +
                '" style="width:100%; height:100%; border:none;"></iframe>';
        } else {
            container.innerHTML = '<div class="kair-empty">' +
                '<div class="kair-empty__icon"><i class="bi bi-exclamation-triangle"></i></div>' +
                '<h3 class="kair-empty__title">Error de carga</h3>' +
                '<p class="kair-empty__desc">' + _explorerEscapeHtml(errorMsg || 'No se pudo generar el preview.') + '</p>' +
                '</div>';
        }
    }

    async function _explorerShowPdfPreview(filePath, container) {
        const api = _explorerGetAPI();
        if (!api || typeof api.getPDFPreview !== 'function') {
            container.innerHTML = '<div class="kair-empty"><p>API de PDF no disponible</p></div>';
            return;
        }
        _explorerShowLoading('Cargando PDF...');
        try {
            const result = await api.getPDFPreview(filePath);
            if (!result || !result.success) {
                _explorerRenderPdfBase64(container, null, 'Error: ' + ((result && result.error) || 'desconocido'));
                return;
            }
            // La API puede devolver el PDF como string base64 directo o envuelto en .data
            const pdfData = (typeof result === 'string') ? result : (result.data || result.pdf || result);
            _explorerRenderPdfBase64(container, pdfData, 'PDF vacío o no generado');
        } catch (e) {
            _explorerRenderPdfBase64(container, null, 'Error: ' + (e.message || e));
        } finally {
            _explorerHideLoading();
        }
    }

    function _explorerShowExcelPreview(filePath, container) {
        const api = _explorerGetAPI();
        if (!api || typeof api.getExcelPreview !== 'function') {
            container.innerHTML = '<div class="kair-empty"><p>API de Excel no disponible</p></div>';
            return;
        }
        _explorerShowLoading('Convirtiendo Excel a PDF...');
        api.getExcelPreview(filePath).then(result => {
            if (!result || !result.success) {
                _explorerRenderPdfBase64(container, null, 'Error: ' + ((result && result.error) || 'desconocido'));
                return;
            }
            const pdfData = (typeof result === 'string') ? result : (result.data || result.pdf || result);
            _explorerRenderPdfBase64(container, pdfData, 'Excel vacío o no generado');
        }).catch(e => {
            _explorerRenderPdfBase64(container, null, 'Error: ' + (e.message || e));
        }).finally(() => _explorerHideLoading());
    }

    function _explorerShowWordPreview(filePath, container) {
        const api = _explorerGetAPI();
        if (!api || typeof api.getWordPreview !== 'function') {
            container.innerHTML = '<div class="kair-empty"><p>API de Word no disponible</p></div>';
            return;
        }
        _explorerShowLoading('Convirtiendo Word a PDF...');
        api.getWordPreview(filePath).then(result => {
            if (!result || !result.success) {
                _explorerRenderPdfBase64(container, null, 'Error: ' + ((result && result.error) || 'desconocido'));
                return;
            }
            const pdfData = (typeof result === 'string') ? result : (result.data || result.pdf || result);
            _explorerRenderPdfBase64(container, pdfData, 'Word vacío o no generado');
        }).catch(e => {
            _explorerRenderPdfBase64(container, null, 'Error: ' + (e.message || e));
        }).finally(() => _explorerHideLoading());
    }

    async function _explorerOpenFile(filePath) {
        const api = _explorerGetAPI();
        if (!api || typeof api.openFile !== 'function') {
            // Fallback: downloadDocument
            if (api && typeof api.downloadDocument === 'function') {
                try { await api.downloadDocument(filePath); } catch (e2) { _explorerToast('Error: ' + (e2.message || e2), 'error'); }
                return;
            }
            _explorerToast('API openFile no disponible', 'error');
            return;
        }
        try {
            await api.openFile(filePath);
        } catch (e) {
            _explorerToast('Error abriendo archivo: ' + (e.message || e), 'error');
        }
    }

    // ─── Empty state ───
    function _explorerShowEmptyState(message) {
        const container = $('exp-file-list');
        if (!container) return;
        container.innerHTML = '<div class="kair-empty" style="padding: 2rem; text-align: center;">' +
            '<div class="kair-empty__icon"><i class="bi bi-folder-x"></i></div>' +
            '<h3 class="kair-empty__title">Sin documentos</h3>' +
            '<p class="kair-empty__desc" style="white-space: pre-line;">' + _explorerEscapeHtml(message) + '</p>' +
            '</div>';
        // Limpiar stats
        const docCountEl = $('exp-doc-count');
        if (docCountEl) docCountEl.textContent = '0';
        const footerCountEl = $('exp-footer-count');
        if (footerCountEl) footerCountEl.textContent = '0 archivos';
        const footerSizeEl = $('exp-footer-size');
        if (footerSizeEl) footerSizeEl.textContent = '0 B';
        // Limpiar sidebar
        const folderList = $('exp-folder-list');
        if (folderList) folderList.innerHTML = '<div class="kair-empty kair-empty--compact"><p class="kair-empty__desc">No hay subcarpetas</p></div>';
        // Limpiar breadcrumb
        const breadcrumb = $('exp-breadcrumb');
        if (breadcrumb) breadcrumb.innerHTML = '';
        _explorerHideLoading();
    }

    function _explorerHideEmptyState() {
        // Se limpia cuando se llama a _explorerRenderDocuments
    }

    // ─── Helpers ───
    function _explorerGetExt(name) {
        if (!name) return '';
        const m = String(name).match(/\.([^.]+)$/);
        return m ? m[1] : '';
    }

    function _explorerFileIcon(ext) {
        const map = {
            pdf: 'bi-file-earmark-pdf',
            doc: 'bi-file-earmark-word',
            docx: 'bi-file-earmark-word',
            xls: 'bi-file-earmark-excel',
            xlsx: 'bi-file-earmark-excel',
            ppt: 'bi-file-earmark-ppt',
            pptx: 'bi-file-earmark-ppt',
            png: 'bi-file-earmark-image',
            jpg: 'bi-file-earmark-image',
            jpeg: 'bi-file-earmark-image',
            gif: 'bi-file-earmark-image',
            txt: 'bi-file-earmark-text',
            zip: 'bi-file-earmark-zip',
            rar: 'bi-file-earmark-zip'
        };
        return map[ext] || 'bi-file-earmark';
    }

    function _explorerFormatSize(bytes) {
        if (!bytes || isNaN(bytes)) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB'];
        let i = 0;
        let n = bytes;
        while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
        return (i === 0 ? n : n.toFixed(1)) + ' ' + units[i];
    }

    function _explorerFormatDate(iso) {
        if (!iso) return '';
        try {
            var d = new Date(iso);
            if (isNaN(d.getTime())) return '';
            return d.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: '2-digit' });
        } catch (e) { return ''; }
    }

    function _explorerGetRelativeSegments(base, current) {
        if (!base || !current) return [];
        const norm = (p) => p.replace(/\\/g, '/');
        const b = norm(base);
        const c = norm(current);
        if (!c.startsWith(b)) return [];
        const rest = c.substring(b.length).replace(/^\/+/, '');
        if (!rest) return [];
        return rest.split('/');
    }

    function _explorerEscapeHtml(s) {
        if (s == null) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function _explorerEscapeAttr(s) {
        return _explorerEscapeHtml(s);
    }

    // ━━━ EXPORT EXCEL ━━━
    async function handleExportExcel() {
        if (!API()) { toast('API no disponible', 'error'); return; }
        // Paso 1: pedir ruta de guardado
        let pickRes;
        try {
            pickRes = await API().selectSavePath({ defaultName: 'profesiograma-' + new Date().toISOString().slice(0, 10) + '.xlsx' });
        } catch (e) {
            toast('Error abriendo selector: ' + (e.message || e), 'error');
            return;
        }
        if (!pickRes || !pickRes.success || pickRes.data.canceled) {
            toast('Exportación cancelada', '');
            return;
        }
        const filePath = pickRes.data.filePath;
        toast('Generando Excel...', 'success');
        try {
            const res = await API().exportExcel({ filePath: filePath });
            if (res && res.success) {
                const stats = res.data.stats || {};
                toast('Exportado OK: ' + (stats.cargos || 0) + ' cargos, ' + (stats.tipos || 0) + ' tipos, ' + (stats.cargoExamen || 0) + ' relaciones', 'success');
                console.log('[PROFESIOGRAMA-3.1.3] Exportado a:', filePath);
            } else {
                toast('Error al exportar: ' + ((res && res.error && res.error.message) || 'desconocido'), 'error');
            }
        } catch (e) {
            toast('Error: ' + (e.message || e), 'error');
        }
    }

    // ━━━ IMPORT EXCEL ━━━
    async function handleImportExcel() {
        if (!API()) { toast('API no disponible', 'error'); return; }
        // Paso 1: seleccionar archivo
        let pickRes;
        try {
            pickRes = await API().selectExcel();
        } catch (e) {
            toast('Error abriendo selector: ' + (e.message || e), 'error');
            return;
        }
        if (!pickRes || !pickRes.success || pickRes.data.canceled) {
            toast('Importación cancelada', '');
            return;
        }
        const filePath = pickRes.data.filePath;
        if (!confirm('¿Importar el archivo seleccionado?\n\n' + filePath + '\n\nEsto agregará los datos del profesiograma a la base de datos.')) return;
        toast('Importación iniciada...', 'success');
        try {
            const res = await API().importExcel({ filePath: filePath });
            if (res && res.success) {
                const stats = res.data.stats || {};
                toast('Importación OK: ' + (stats.cargos || 0) + ' cargos, ' + (stats.grupos || 0) + ' grupos, ' + (stats.tiposExamen || 0) + ' tipos examen', 'success');
                state.matriz = { cargos: [], tiposExamen: [] };
                state.pruebas = []; state.recomendaciones = []; state.vacunas = []; state.alturas = [];
                loadKpis();
                if (state.view !== 'home') switchView('home');
            } else {
                toast('Error al importar: ' + ((res && res.error && res.error.message) || 'desconocido'), 'error');
            }
        } catch (e) {
            toast('Error: ' + (e.message || e), 'error');
        }
    }

    // ━━━ WIRING (event delegation) ━━━
    function wireEvents() {
        // Tabs
        $$('.tab').forEach(t => t.onclick = () => switchView(t.dataset.view));
        // Module cards (home)
        $$('.module-card').forEach(c => {
            c.onclick = () => {
                if (c.dataset.action === 'open-explorer') {
                    switchView('explorer');
                } else if (c.dataset.viewLink) {
                    switchView(c.dataset.viewLink);
                }
            };
        });
        $('hero-cta-matriz').onclick = () => switchView('matriz');
        // Back button
        $('btn-back').onclick = () => {
            if (parent && parent !== window) {
                parent.postMessage({ action: 'backToModule' }, '*');
            }
        };
        // Import
        $('btn-import').onclick = handleImportExcel;
        // Export
        $('btn-export').onclick = handleExportExcel;
        // Search
        const search = $('search-matriz');
        if (search) {
            search.oninput = (e) => { state.search = e.target.value; renderMatriz(); };
        }
        // New buttons
        $('btn-new-cargo').onclick = () => showDialog('Nuevo Cargo', cargoToFields(null), d => handleCargoSubmit(d, null));
        const btnNewTipo = $('btn-new-tipo-examen');
        if (btnNewTipo) btnNewTipo.onclick = () => showNewTipoExamenDialog();
        const btnNewTipoMatriz = $('btn-new-tipo-examen-matriz');
        if (btnNewTipoMatriz) btnNewTipoMatriz.onclick = () => showNewTipoExamenDialog();
        $('btn-new-prueba').onclick = () => showDialog('Nueva Prueba', pruebaToFields(null), d => handlePruebaSubmit(d, null));
        $('btn-new-recomendacion').onclick = () => showDialog('Nueva Recomendación', recomendacionToFields(null), d => handleRecomendacionSubmit(d, null));
        $('btn-new-vacuna').onclick = () => showDialog('Nueva Vacuna', vacunaToFields(null), d => handleVacunaSubmit(d, null));
        $('btn-new-altura').onclick = () => showDialog('Nuevo Requisito', alturaToFields(null), d => handleAlturaSubmit(d, null));

        // Action buttons (delegated)
        document.body.addEventListener('click', async (e) => {
            // I/P/R cell click (toggle examen)
            const iprCell = e.target.closest('[data-ipr]');
            if (iprCell) {
                const cargoId = iprCell.dataset.cargo;
                const tipoId = iprCell.dataset.tipo;
                const field = iprCell.dataset.ipr;
                toggleIpr(cargoId, tipoId, field);
                return;
            }

            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const action = btn.dataset.action;
            const id = btn.dataset.id;
            if (action === 'edit-cargo') {
                const r = await API().cargosGet(id);
                if (r && r.success) showDialog('Editar Cargo', cargoToFields(r.data), d => handleCargoSubmit(d, id));
            } else if (action === 'del-cargo') {
                handleDelete('cargo', id);
            } else if (action === 'edit-prueba') {
                const item = state.pruebas.find(p => p.id === id);
                if (item) showDialog('Editar Prueba', pruebaToFields(item), d => handlePruebaSubmit(d, id));
            } else if (action === 'del-prueba') {
                handleDelete('prueba', id);
            } else if (action === 'edit-recomendacion') {
                const item = state.recomendaciones.find(p => p.id === id);
                if (item) showDialog('Editar Recomendación', recomendacionToFields(item), d => handleRecomendacionSubmit(d, id));
            } else if (action === 'del-recomendacion') {
                handleDelete('recomendacion', id);
            } else if (action === 'edit-vacuna') {
                const item = state.vacunas.find(p => p.id === id);
                if (item) showDialog('Editar Vacuna', vacunaToFields(item), d => handleVacunaSubmit(d, id));
            } else if (action === 'del-vacuna') {
                handleDelete('vacuna', id);
            } else if (action === 'edit-altura') {
                const item = state.alturas.find(p => p.id === id);
                if (item) showDialog('Editar Requisito', alturaToFields(item), d => handleAlturaSubmit(d, id));
            } else if (action === 'del-altura') {
                handleDelete('altura', id);
            } else if (action === 'edit-tipo-examen') {
                const item = state.tiposExamen.find(t => t.id === id);
                if (item) showDialogWithSelect('Editar Tipo de Examen', tipoExamenToFields(item), d => handleTipoExamenSubmit(d, id));
            } else if (action === 'del-tipo-examen') {
                const nombre = btn.dataset.nombre || 'este examen';
                handleDeleteTipoExamen(id, nombre);
            }
        });
    }

    async function handleDeleteTipoExamen(id, nombre) {
        if (!API()) { toast('API no disponible', 'error'); return; }
        if (!confirm('¿Eliminar el tipo de examen "' + nombre + '"?\n\n⚠️ Esto también eliminará TODAS las relaciones cargo-examen asociadas (marcadas como I/P/R en la matriz).')) return;
        try {
            const res = await API().tipoExamenDelete(id);
            if (res && res.success) {
                toast('Tipo de examen eliminado', 'success');
                // Forzar recarga de tiposExamen, pruebas (si la hay) y matriz
                state.tiposExamen = [];
                state.matriz = { cargos: [], tiposExamen: [] };
                state.pendingExamChanges.clear();
                await loadTiposExamen();
                // Si estamos en la vista de Pruebas, refrescar la lista
                if (state.view === 'pruebas') {
                    renderTiposExamen();
                }
                // Si estamos en la vista Matriz, refrescar para que la columna desaparezca
                if (state.view === 'matriz') {
                    await loadMatriz();
                }
            } else {
                toast('No se pudo eliminar: ' + ((res && res.error && res.error.message) || 'desconocido'), 'error');
            }
        } catch (e) {
            toast('Error: ' + (e.message || e), 'error');
        }
    }

    // ━━━ INIT ━━━
    function init() {
        wireEvents();
        // Diagnóstico: dónde está electronAPI.profesiograma?
        const hasOwn = !!(window.electronAPI && window.electronAPI.profesiograma);
        const hasParent = !!(window.parent && window.parent.electronAPI && window.parent.electronAPI.profesiograma);
        const hasTop = !!(window.top && window.top.electronAPI && window.top.electronAPI.profesiograma);
        console.log('[PROFESIOGRAMA-3.1.3] electronAPI.profesiograma: own=' + hasOwn + ' parent=' + hasParent + ' top=' + hasTop);
        loadKpis();
        console.log('[PROFESIOGRAMA-3.1.3] Viewer inicializado');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
