// inducciones-logic.js - Lógica para el submódulo de Inducciones y Reinducción (K+AIR Visual System)

class InduccionesComponent {
    constructor(container, currentCompany, moduleName, submoduleName, backToModuleCallback) {
        this.container = container;
        this.currentCompany = currentCompany;
        this.moduleName = moduleName;
        this.submoduleName = submoduleName;
        this.backToModuleCallback = backToModuleCallback;
        
        this.state = {
            currentView: 'dashboard',
            data: [
                { id: 1, date: '2024-01-10', name: 'Carlos Pérez', idCard: '80123456', position: 'Supernumerario', score: 22, status: 'approved', gender: 'Hombre' },
                { id: 2, date: '2024-02-15', name: 'Ana Gómez', idCard: '80234567', position: 'Mesera', score: 21, status: 'approved', gender: 'Mujer' },
                { id: 3, date: '2024-03-05', name: 'Jorge Torres', idCard: '80345678', position: 'Cocina', score: 14, status: 'failed', gender: 'Hombre' },
                { id: 4, date: '2024-04-20', name: 'Luisa Méndez', idCard: '80456789', position: 'Operaria Integral', score: 18, status: 'failed', gender: 'Mujer' },
                { id: 5, date: '2024-05-12', name: 'Pedro Castillo', idCard: '80567890', position: 'Portero', score: 20, status: 'approved', gender: 'Hombre' },
                { id: 6, date: '2024-06-02', name: 'Marta Ruíz', idCard: '80678901', position: 'Mesera', score: 22, status: 'approved', gender: 'Mujer' },
                { id: 7, date: '2024-07-15', name: 'Andrés López', idCard: '80789012', position: 'Administrativo', score: 19, status: 'approved', gender: 'Hombre' },
                { id: 8, date: '2024-08-01', name: 'Claudia Vega', idCard: '80890123', position: 'Técnico', score: 10, status: 'failed', gender: 'Mujer' },
                { id: 9, date: '2023-11-20', name: 'Roberto Díaz', idCard: '80901234', position: 'Cocina', score: 16, status: 'failed', gender: 'Hombre' }, 
                { id: 10, date: '2023-12-05', name: 'Elena Silva', idCard: '81012345', position: 'Supernumerario', score: 22, status: 'approved', gender: 'Mujer' }
            ],
            filteredData: [],
            charts: {}
        };
    }

    render() {
        this.container.innerHTML = '';
        this.container.classList.add('inducciones-container');
        window.currentInduccionesComponent = this;

        fetch('./modules/recursos/inducciones/inducciones-view.html')
            .then(response => response.text())
            .then(html => {
                this.container.innerHTML = html;
                setTimeout(() => {
                    this.updateHeaderContext();
                    this.initializeEventListeners();
                    this.init(); // Carga de datos inicial
                }, 100);
            })
            .catch(error => {
                console.error('Error cargando inducciones-view.html:', error);
                this.container.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
            });
    }

    updateHeaderContext() {
        const headerContext = document.getElementById('header-context-text');
        if (headerContext) {
            headerContext.textContent = `${this.currentCompany} / Recursos / Inducción y Reinducción`;
        }
    }

    destroy() {
        // Limpieza de gráficos para evitar fugas de memoria
        Object.values(this.state.charts).forEach(chart => {
            if (chart && typeof chart.destroy === 'function') chart.destroy();
        });
        window.currentInduccionesComponent = null;
    }

    init() {
        this.populateYearFilter();
        this.applyFilters();
        this.switchView('dashboard'); // Vista por defecto
    }

    initializeEventListeners() {
        // Navegación (Tabs)
        document.querySelectorAll('.k-nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const view = item.getAttribute('data-view');
                this.switchView(view);
            });
        });

        // Botón Volver
        const backBtn = document.getElementById('btn-back-module');
        if (backBtn && this.backToModuleCallback) {
            backBtn.addEventListener('click', this.backToModuleCallback);
        }

        // Filtros
        document.getElementById('filter-year-list')?.addEventListener('change', () => this.applyFilters());
        document.getElementById('filter-year-report')?.addEventListener('change', () => this.applyFilters());
        document.getElementById('search-input')?.addEventListener('keyup', (e) => {
            if(e.key === 'Enter') this.applyFilters();
        });
        document.getElementById('btn-search')?.addEventListener('click', () => this.applyFilters());

        // Modales
        document.getElementById('btn-open-add')?.addEventListener('click', () => this.openModal('add'));
        document.querySelectorAll('.btn-close-modal').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.closeModal();
            });
        });
        
        document.getElementById('btn-save-induction')?.addEventListener('click', () => this.saveInduction());
        
        // Exportar
        document.getElementById('btn-export-excel')?.addEventListener('click', () => this.showToast('Exportando datos...', 'info'));
        document.getElementById('btn-download-report')?.addEventListener('click', () => this.showToast('Generando informe...', 'success'));
    }

    switchView(viewId) {
        document.querySelectorAll('.k-nav-item').forEach(i => i.classList.remove('active'));
        const activeTab = document.querySelector(`.k-nav-item[data-view="${viewId}"]`);
        if(activeTab) activeTab.classList.add('active');

        document.querySelectorAll('.k-view-section').forEach(s => s.classList.remove('active'));
        const activeSection = document.getElementById(`view-${viewId}`);
        if(activeSection) activeSection.classList.add('active');
        
        this.state.currentView = viewId;

        // Renderizar gráficos si es necesario al cambiar de pestaña
        if (viewId === 'dashboard') {
            setTimeout(() => this.updateDashboardCharts(this.state.filteredData), 50);
        } else if (viewId === 'reports') {
            setTimeout(() => this.renderReportsCharts(), 50);
        }
    }

    populateYearFilter() {
        const years = [...new Set(this.state.data.map(d => new Date(d.date).getFullYear()))].sort((a,b) => b-a);
        const options = `<option value="">Todos los años</option>` + years.map(y => `<option value="${y}">${y}</option>`).join('');
        
        const filterList = document.getElementById('filter-year-list');
        const filterReport = document.getElementById('filter-year-report');
        
        if(filterList) filterList.innerHTML = options;
        if(filterReport) filterReport.innerHTML = options;
        
        const currentYear = new Date().getFullYear();
        if(years.includes(currentYear)) {
            if(filterList) filterList.value = currentYear;
            if(filterReport) filterReport.value = currentYear;
        }
    }

    applyFilters() {
        const listYearEl = document.getElementById('filter-year-list');
        const reportYearEl = document.getElementById('filter-year-report');
        const searchInput = document.getElementById('search-input');

        const listYear = listYearEl ? listYearEl.value : '';
        const reportYear = reportYearEl ? reportYearEl.value : '';
        const search = searchInput ? searchInput.value.toLowerCase() : '';
        
        const year = this.state.currentView === 'reports' ? reportYear : listYear;

        this.state.filteredData = this.state.data.filter(item => {
            const itemYear = new Date(item.date).getFullYear();
            const matchYear = year ? itemYear == year : true;
            const matchSearch = item.name.toLowerCase().includes(search) || item.idCard.includes(search);
            return matchYear && matchSearch;
        });

        this.renderDashboardStats();
        this.renderTable();
        
        // Actualizar gráficos si están visibles
        if(this.state.currentView === 'dashboard') this.updateDashboardCharts(this.state.filteredData);
        if(this.state.currentView === 'reports') this.renderReportsCharts();
    }

    // ============================================
    // DASHBOARD
    // ============================================
    renderDashboardStats() {
        const data = this.state.filteredData;
        const total = data.length;
        const approved = data.filter(i => i.status === 'approved').length;
        const failed = data.filter(i => i.status === 'failed').length;
        
        const scoreSum = data.reduce((acc, i) => acc + parseFloat(i.score), 0);
        const avgScore = total > 0 ? (scoreSum / total).toFixed(1) : '0.0';

        this.setSafeText('stat-total', total);
        this.setSafeText('stat-approved', approved);
        this.setSafeText('stat-failed', failed);
        this.setSafeText('stat-score', avgScore);
        this.setSafeText('stat-rate', `${Math.round((approved/total)*100) || 0}% Tasa de éxito`);

        // Género
        const women = data.filter(i => i.gender === 'Mujer');
        const men = data.filter(i => i.gender === 'Hombre');
        const womenApproved = women.filter(i => i.status === 'approved').length;
        const menApproved = men.filter(i => i.status === 'approved').length;

        this.setSafeText('stat-gender-f', women.length);
        this.setSafeText('stat-rate-f', women.length ? `${Math.round((womenApproved/women.length)*100)}% Aprobación` : 'N/A');
        this.setSafeText('stat-gender-m', men.length);
        this.setSafeText('stat-rate-m', men.length ? `${Math.round((menApproved/men.length)*100)}% Aprobación` : 'N/A');
    }

    setSafeText(id, text) {
        const el = document.getElementById(id);
        if(el) el.textContent = text;
    }

    updateDashboardCharts(data) {
        if (typeof Chart === 'undefined') return;

        // --- Gráfico 1: Ejecución Mensual ---
        const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        const monthlyTotal = Array(12).fill(0);
        const monthlyApproved = Array(12).fill(0);

        data.forEach(i => {
            const m = new Date(i.date).getMonth();
            monthlyTotal[m]++;
            if(i.status === 'approved') monthlyApproved[m]++;
        });

        this.initOrUpdateChart('mainChart', {
            type: 'line',
            data: {
                labels: months,
                datasets: [
                    { label: 'Realizadas', data: monthlyTotal, borderColor: '#174ea6', backgroundColor: 'rgba(23,78,166,0.1)', tension: 0.4, fill: true },
                    { label: 'Aprobadas', data: monthlyApproved, borderColor: '#28a745', backgroundColor: 'rgba(40,167,69,0.1)', tension: 0.4, fill: true }
                ]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                scales: { y: { beginAtZero: true } },
                plugins: { legend: { position: 'bottom' } }
            }
        });

        // --- Gráfico 2: Top Cargos ---
        const positions = {};
        data.forEach(i => positions[i.position] = (positions[i.position] || 0) + 1);
        
        this.initOrUpdateChart('positionChart', {
            type: 'doughnut',
            data: { 
                labels: Object.keys(positions), 
                datasets: [{ 
                    data: Object.values(positions), 
                    backgroundColor: ['#174ea6', '#28a745', '#ffc107', '#17a2b8', '#e91e63'], 
                    borderWidth: 0 
                }] 
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                plugins: { legend: { position: 'right' } } 
            }
        });
    }

    // ============================================
    // LISTADO
    // ============================================
    renderTable() {
        const tbody = document.getElementById('full-table-body');
        if(!tbody) return;
        tbody.innerHTML = '';
        
        if(this.state.filteredData.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:2rem; color:var(--k-text-muted)">No hay registros con los filtros actuales</td></tr>`;
            return;
        }

        this.state.filteredData.forEach(item => {
            const badgeClass = item.status === 'approved' ? 'k-badge-success' : 'k-badge-danger';
            const statusText = item.status === 'approved' ? 'Aprobado' : 'Reprobado';
            // Manejo seguro de fechas
            const dateParts = item.date.split('-');
            const dateFormatted = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : item.date;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${dateFormatted}</td>
                <td><strong>${item.name}</strong></td>
                <td>${item.idCard}</td>
                <td>${item.position}</td>
                <td>${item.gender}</td>
                <td><span style="font-weight:bold">${item.score}</span> / 22</td>
                <td><span class="k-badge ${badgeClass}">${statusText}</span></td>
                <td style="text-align:right;">
                    <button class="k-btn k-btn-outline edit-btn" style="padding:0.25rem 0.5rem;" data-id="${item.id}"><i class="bi bi-pencil"></i></button>
                </td>
            `;
            tbody.appendChild(row);
        });

        tbody.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // stopPropagation si es necesario, pero data-id está en el botón o en el icono
                const id = btn.dataset.id || btn.closest('button').dataset.id;
                this.editInduction(parseInt(id));
            });
        });
    }

    // ============================================
    // REPORTES
    // ============================================
    renderReportsCharts() {
        if (typeof Chart === 'undefined') return;
        const data = this.state.filteredData;

        // 1. Tasa de Aprobación
        const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        const monthlyStats = Array(12).fill(0).map(() => ({ total: 0, approved: 0 }));
        
        data.forEach(i => {
            const m = new Date(i.date).getMonth();
            monthlyStats[m].total++;
            if(i.status === 'approved') monthlyStats[m].approved++;
        });
        const approvalRates = monthlyStats.map(m => m.total > 0 ? ((m.approved / m.total) * 100).toFixed(1) : 0);

        this.initOrUpdateChart('approvalRateChart', {
            type: 'bar',
            data: { labels: months, datasets: [{ label: '% Aprobación', data: approvalRates, backgroundColor: '#28a745', borderRadius: 4 }] },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100 } } }
        });

        // 2. Error Rate (Simulado)
        const avgScore = data.length > 0 ? data.reduce((a,b)=>a+b.score,0)/data.length : 22;
        const errorFactor = (22 - avgScore) / 22; 
        const errorData = [
            Math.round(35 * errorFactor), Math.round(28 * errorFactor), Math.round(22 * errorFactor),
            Math.round(15 * errorFactor), Math.round(10 * errorFactor)
        ];

        this.initOrUpdateChart('errorRateChart', {
            type: 'bar',
            data: { labels: ['P7', 'P8', 'P9', 'P10', 'P11'], datasets: [{ label: '% Error', data: errorData, backgroundColor: '#dc3545', borderRadius: 4 }] },
            options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, scales: { x: { beginAtZero: true, max: 100 } } }
        });

        // 3. Gender Stack
        const genderStats = { 'Hombre': {approved:0, failed:0}, 'Mujer': {approved:0, failed:0} };
        data.forEach(i => {
            if(genderStats[i.gender]) {
                if(i.status === 'approved') genderStats[i.gender].approved++;
                else genderStats[i.gender].failed++;
            }
        });

        this.initOrUpdateChart('genderStackChart', {
            type: 'bar',
            data: { 
                labels: ['Hombres', 'Mujeres'], 
                datasets: [
                    { label: 'Aprobados', data: [genderStats['Hombre'].approved, genderStats['Mujer'].approved], backgroundColor: '#0f9d58' }, 
                    { label: 'Reprobados', data: [genderStats['Hombre'].failed, genderStats['Mujer'].failed], backgroundColor: '#ea4335' }
                ] 
            },
            options: { 
                responsive: true, maintainAspectRatio: false, 
                scales: { x: { stacked: true }, y: { stacked: true } }, 
                plugins: { legend: { position: 'bottom' } } 
            }
        });

        // 4. Gender Dist
        this.initOrUpdateChart('genderDistChart', {
            type: 'doughnut',
            data: { 
                labels: ['Hombres', 'Mujeres'], 
                datasets: [{ 
                    data: [
                        genderStats['Hombre'].approved + genderStats['Hombre'].failed,
                        genderStats['Mujer'].approved + genderStats['Mujer'].failed
                    ], 
                    backgroundColor: ['#0f9d58', '#e91e63'], 
                    borderWidth: 0 
                }] 
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
        });
    }

    initOrUpdateChart(canvasId, config) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        if (this.state.charts[canvasId]) {
            this.state.charts[canvasId].destroy();
        }

        this.state.charts[canvasId] = new Chart(canvas, config);
    }

    // ============================================
    // MODAL Y CRUD
    // ============================================
    openModal(mode, id = null) {
        const modal = document.getElementById('inductionModal');
        const title = document.getElementById('modalTitle');
        if(!modal) return;
        modal.classList.add('open');
        
        const form = document.getElementById('inductionForm');
        if(form) form.reset();

        if(mode === 'edit' && id) {
            const item = this.state.data.find(i => i.id === id);
            if(item) {
                if(title) title.textContent = 'Editar Inducción';
                document.getElementById('edit-id').value = item.id;
                document.getElementById('input-date').value = item.date;
                document.getElementById('input-name').value = item.name;
                document.getElementById('input-idcard').value = item.idCard;
                document.getElementById('input-gender').value = item.gender;
                document.getElementById('input-position').value = item.position;
                document.getElementById('input-score').value = item.score;
                document.getElementById('input-status').value = item.status;
            }
        } else {
            if(title) title.textContent = 'Nueva Inducción';
            const editId = document.getElementById('edit-id');
            if(editId) editId.value = '';
            const dateInput = document.getElementById('input-date');
            if(dateInput) dateInput.valueAsDate = new Date();
        }
    }

    closeModal() {
        const modal = document.getElementById('inductionModal');
        if(modal) modal.classList.remove('open');
    }

    saveInduction() {
        const id = document.getElementById('edit-id').value;
        const date = document.getElementById('input-date').value;
        const name = document.getElementById('input-name').value;
        const score = parseFloat(document.getElementById('input-score').value);

        if(!name || isNaN(score)) { 
            this.showToast('Nombre y puntaje son obligatorios', 'danger'); 
            return; 
        }

        const newData = {
            date, name, 
            idCard: document.getElementById('input-idcard').value,
            gender: document.getElementById('input-gender').value,
            position: document.getElementById('input-position').value, 
            score,
            status: document.getElementById('input-status').value
        };

        if(id) {
            const idx = this.state.data.findIndex(i => i.id == id);
            if(idx !== -1) {
                this.state.data[idx] = { ...this.state.data[idx], ...newData };
                this.showToast('Inducción actualizada', 'success');
            }
        } else {
            const newId = this.state.data.length > 0 ? Math.max(...this.state.data.map(i => i.id)) + 1 : 1;
            this.state.data.push({ id: newId, ...newData });
            this.showToast('Inducción registrada', 'success');
        }

        this.closeModal();
        this.applyFilters(); 
    }

    editInduction(id) {
        this.openModal('edit', id);
    }

    showToast(msg, type='info') {
        const container = document.getElementById('toastContainer');
        if(!container) return;
        
        const toast = document.createElement('div');
        toast.className = 'k-toast';
        let color = 'var(--k-primary)';
        if(type === 'success') color = 'var(--k-success)';
        if(type === 'danger') color = 'var(--k-danger)';
        
        toast.style.borderLeftColor = color;
        toast.innerHTML = `<i class="bi ${type==='success'?'bi-check-circle-fill':type==='danger'?'bi-exclamation-circle-fill':'bi-info-circle-fill'}" style="color:${color}; font-size:1.2rem; margin-right:10px;"></i><span>${msg}</span>`;
        container.appendChild(toast);
        
        setTimeout(() => { 
            toast.style.opacity = 0; 
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300); 
        }, 4000);
    }
}

window.InduccionesComponent = InduccionesComponent;