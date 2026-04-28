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
            data: [], // Se llenará con datos reales del Excel
            filteredData: [],
            charts: {}
        };
    }

    async render() {
        this.container.innerHTML = '';
        this.container.classList.add('inducciones-container');
        window.currentInduccionesComponent = this;

        try {
            const response = await fetch('./modules/recursos/inducciones/inducciones-view.html');
            const html = await response.text();
            this.container.innerHTML = html;
            
            setTimeout(async () => {
                this.updateHeaderContext();
                this.initializeEventListeners();
                await this.loadData(); // Carga de datos real
            }, 100);
        } catch (error) {
            console.error('Error cargando inducciones-view.html:', error);
            this.container.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
        }
    }

    async loadData() {
        try {
            console.log('🔄 [Inducciones] Cargando datos reales para:', this.currentCompany);
            this.showToast('Cargando datos desde Excel...', 'info');

            if (!window.electronAPI || !window.electronAPI.getInduccionesData) {
                throw new Error('API de inducciones no disponible');
            }

            const result = await window.electronAPI.getInduccionesData(this.currentCompany);

            if (result.success) {
                console.log('✅ [Inducciones] Datos cargados:', result.data.length, 'registros');
                this.state.data = result.data;
                this.state.currentHash = result.currentHash || null;
                this.state.lastSyncTime = new Date();
                
                this.populateYearFilter();
                this.applyFilters();
                this.switchView('dashboard');
                this.showToast(`Se cargaron ${result.data.length} registros exitosamente`, 'success');
                
                // Verificar si hay cambios disponibles después de cargar
                setTimeout(() => this.checkForChanges(), 1000);
            } else {
                console.warn('⚠️ [Inducciones] No se pudieron cargar datos reales:', result.error);
                this.showToast('No se encontró el archivo Excel. Usando datos de ejemplo.', 'warning');
                this.loadSampleData();
            }
        } catch (error) {
            console.error('❌ [Inducciones] Error en loadData:', error);
            this.showToast('Error al acceder al archivo Excel', 'danger');
            this.loadSampleData();
        }
    }

    loadSampleData() {
        this.state.data = [
            { id: 1, date: '2024-01-10', name: 'Carlos Pérez (Simulado)', idCard: '80123456', position: 'Supernumerario', score: 22, status: 'approved', gender: 'Hombre' },
            { id: 2, date: '2024-02-15', name: 'Ana Gómez (Simulado)', idCard: '80234567', position: 'Mesera', score: 21, status: 'approved', gender: 'Mujer' }
        ];
        this.populateYearFilter();
        this.applyFilters();
    }

  updateHeaderContext() {
    const companyText = document.getElementById('header-company-text');
    if (companyText) {
      companyText.textContent = this.currentCompany || '—';
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
        // El init ahora se llama desde render() después de cargar el HTML
    }

    initializeEventListeners() {
        // Navegación (Tabs)
        document.querySelectorAll('.kair-header__tab').forEach(item => {
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

        // Sincronización con Google Forms
        document.getElementById('btn-sync-manual')?.addEventListener('click', () => {
            this.syncFromForms();
        });
    }

    switchView(viewId) {
        document.querySelectorAll('.kair-header__tab').forEach(i => i.classList.remove('active'));
        const activeTab = document.querySelector(`.kair-header__tab[data-view="${viewId}"]`);
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
        const years = [...new Set(this.state.data.map(d => {
            const date = new Date(d.date);
            return isNaN(date.getFullYear()) ? null : date.getFullYear();
        }))].filter(y => y !== null).sort((a,b) => b-a);
        
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
            const matchSearch = item.name.toLowerCase().includes(search) || item.idCard.toString().includes(search);
            return matchYear && matchSearch;
        });

    this.renderDashboardStats();
    this.renderTable();

    // Actualizar badge de registros
    const badge = document.getElementById('badge-list');
    if (badge) {
      const count = this.state.filteredData.length;
      badge.textContent = count;
      badge.style.display = count > 0 ? 'inline-flex' : 'none';
    }

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
        
        const scoreSum = data.reduce((acc, i) => acc + parseFloat(i.score || 0), 0);
        const avgScore = total > 0 ? (scoreSum / total).toFixed(1) : '0.0';

        this.setSafeText('stat-total', total);
        this.setSafeText('stat-approved', approved);
        this.setSafeText('stat-failed', failed);
        this.setSafeText('stat-score', avgScore);
        this.setSafeText('stat-rate', `${total > 0 ? Math.round((approved/total)*100) : 0}% Tasa de éxito`);

        // Género
        const women = data.filter(i => i.gender && i.gender.toLowerCase().includes('muj'));
        const men = data.filter(i => i.gender && i.gender.toLowerCase().includes('hom'));
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
            const date = new Date(i.date);
            if (!isNaN(date.getMonth())) {
                const m = date.getMonth();
                monthlyTotal[m]++;
                if(i.status === 'approved') monthlyApproved[m]++;
            }
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
                scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
                plugins: { legend: { position: 'bottom' } }
            }
        });

        // --- Gráfico 2: Top Cargos ---
        const positions = {};
        data.forEach(i => {
            if (i.position) positions[i.position] = (positions[i.position] || 0) + 1;
        });
        
        const posLabels = Object.keys(positions).slice(0, 5);
        const posData = posLabels.map(l => positions[l]);

        this.initOrUpdateChart('positionChart', {
            type: 'doughnut',
            data: { 
                labels: posLabels, 
                datasets: [{ 
                    data: posData, 
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
            let dateFormatted = 'N/A';
            if (item.date) {
                const dateParts = item.date.split('-');
                dateFormatted = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : item.date;
            }

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${dateFormatted}</td>
                <td><strong>${item.name}</strong></td>
                <td>${item.idCard}</td>
                <td>${item.position}</td>
                <td>${item.gender || 'N/A'}</td>
                <td><span style="font-weight:bold">${item.score}</span></td>
                <td><span class="k-badge ${badgeClass}">${statusText}</span></td>
                <td style="text-align:right;">
                    <button class="k-btn k-btn-outline edit-btn" style="padding:0.25rem 0.5rem;" data-id="${item.id}"><i class="bi bi-pencil"></i></button>
                </td>
            `;
            tbody.appendChild(row);
        });

        tbody.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
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
            const date = new Date(i.date);
            if (!isNaN(date.getMonth())) {
                const m = date.getMonth();
                monthlyStats[m].total++;
                if(i.status === 'approved') monthlyStats[m].approved++;
            }
        });
        const approvalRates = monthlyStats.map(m => m.total > 0 ? ((m.approved / m.total) * 100).toFixed(1) : 0);

        this.initOrUpdateChart('approvalRateChart', {
            type: 'bar',
            data: { labels: months, datasets: [{ label: '% Aprobación', data: approvalRates, backgroundColor: '#28a745', borderRadius: 4 }] },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100 } } }
        });

        // 2. Error Rate (Basado en datos reales)
        // Agrupar por género o por temas si tuviéramos esa info. Usaremos género como ejemplo.
        const genderStats = { 'Hombre': {approved:0, failed:0, total:0}, 'Mujer': {approved:0, failed:0, total:0} };
        data.forEach(i => {
            const g = (i.gender && i.gender.toLowerCase().includes('muj')) ? 'Mujer' : 'Hombre';
            genderStats[g].total++;
            if(i.status === 'approved') genderStats[g].approved++;
            else genderStats[g].failed++;
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
                scales: { x: { stacked: true }, y: { stacked: true, ticks: { precision: 0 } } }, 
                plugins: { legend: { position: 'bottom' } } 
            }
        });

        // 4. Gender Dist
        this.initOrUpdateChart('genderDistChart', {
            type: 'doughnut',
            data: { 
                labels: ['Hombres', 'Mujeres'], 
                datasets: [{ 
                    data: [ genderStats['Hombre'].total, genderStats['Mujer'].total ], 
                    backgroundColor: ['#174ea6', '#e91e63'], 
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
        this.showToast('Esta funcionalidad requiere permisos de escritura en Excel (Próximamente)', 'info');
        this.closeModal();
    }

    editInduction(id) {
        this.openModal('edit', id);
    }

    // ============================================
    // SINCRONIZACIÓN CON GOOGLE FORMS
    // ============================================
    
    /**
     * Verifica si hay cambios en el archivo Excel desde la última sincronización
     */
    async checkForChanges() {
        try {
            if (!window.electronAPI || !window.electronAPI.checkInduccionesChanges) {
                return; // Función no disponible
            }

            const result = await window.electronAPI.checkInduccionesChanges(
                this.currentCompany, 
                this.state.currentHash
            );

            if (result.success && result.hasChanges) {
                // Hay cambios disponibles, mostrar banner
                this.showSyncBanner(result.totalRecords || 0);
            }
        } catch (error) {
            console.error('❌ [Inducciones] Error al verificar cambios:', error);
        }
    }

    /**
     * Muestra el banner de sincronización cuando hay cambios disponibles
     */
    showSyncBanner(newRecordsCount) {
        const banner = document.getElementById('sync-banner');
        const message = document.getElementById('sync-banner-message');
        
        if (banner && message) {
            message.textContent = `Hay ${newRecordsCount} registros disponibles en Google Forms. ¿Desea sincronizar ahora?`;
            banner.style.display = 'flex';
            
            // Configurar listeners del banner
            document.getElementById('btn-sync-dismiss')?.addEventListener('click', () => {
                banner.style.display = 'none';
            });
            
            document.getElementById('btn-sync-now')?.addEventListener('click', () => {
                banner.style.display = 'none';
                this.syncFromForms();
            });
        }
    }

    /**
     * Sincroniza datos desde Google Forms (actualiza Excel y recarga datos)
     */
    async syncFromForms() {
        try {
            this.setSyncStatus('syncing', 'Sincronizando...');
            this.showToast('Actualizando datos desde Google Forms...', 'info');

            if (!window.electronAPI || !window.electronAPI.syncInduccionesFromForms) {
                throw new Error('API de sincronización no disponible');
            }

            const result = await window.electronAPI.syncInduccionesFromForms(this.currentCompany);

            if (result.success) {
                console.log('✅ [Inducciones] Sincronización completada:', result.data.length, 'registros');
                this.state.data = result.data;
                this.state.currentHash = result.currentHash;
                this.state.lastSyncTime = new Date();
                
                this.populateYearFilter();
                this.applyFilters();
                this.setSyncStatus('synced', `Sincronizado ${new Date().toLocaleTimeString()}`);
                this.showToast(`✓ ${result.message}`, 'success');
            } else {
                throw new Error(result.error || 'Error en sincronización');
            }
        } catch (error) {
            console.error('❌ [Inducciones] Error en sincronización:', error);
            this.setSyncStatus('error', 'Error en sincronización');
            this.showToast(`Error: ${error.message}`, 'danger');
        }
    }

    /**
     * Actualiza el indicador de estado de sincronización
     */
  setSyncStatus(status, text) {
    const statusEl = document.getElementById('sync-status');
    const textEl = document.getElementById('sync-status-text');

    if (statusEl) {
      statusEl.className = 'k-sync-status';

      switch (status) {
        case 'syncing':
          statusEl.classList.add('syncing');
          statusEl.innerHTML = '<i class="bi bi-arrow-clockwise"></i>';
          break;
        case 'synced':
          statusEl.innerHTML = '<i class="bi bi-check-circle-fill" style="color: var(--k-success);"></i>';
          break;
        case 'error':
          statusEl.classList.add('error');
          statusEl.innerHTML = '<i class="bi bi-exclamation-circle-fill"></i>';
          break;
        default:
          statusEl.innerHTML = '<i class="bi bi-check-circle-fill" style="color: var(--k-success);"></i>';
      }

      if (textEl && text) {
        textEl.textContent = text;
      }
    }
  }

    showToast(msg, type='info') {
        const container = document.getElementById('toastContainer');
        if(!container) return;
        
        const toast = document.createElement('div');
        toast.className = 'k-toast';
        let color = 'var(--k-primary)';
        if(type === 'success') color = 'var(--k-success)';
        if(type === 'danger') color = 'var(--k-danger)';
        if(type === 'warning') color = 'var(--k-warning)';
        
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