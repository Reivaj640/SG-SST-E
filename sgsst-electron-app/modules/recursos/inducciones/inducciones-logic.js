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
    data: [],
    filteredData: [],
    dashboardFilteredData: [],
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
        await this.loadData();
      }, 100);
    } catch (error) {
      console.error('Error cargando inducciones-view.html:', error);
      this.container.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
    }
  }

  async loadData() {
    const notifier = window.updateNotifier;
    try {
      console.log('🔄 [Inducciones] Cargando datos reales para:', this.currentCompany);

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
      this.applyDashboardFilters();
      this.switchView('dashboard');

        if (notifier) {
          notifier.show({ type: 'success', title: 'Datos Cargados', subtitle: `${result.data.length} registros cargados desde Excel`, autoClose: 3000 });
        }

        setTimeout(() => this.checkForChanges(), 1000);
      } else {
        console.warn('⚠️ [Inducciones] No se pudieron cargar datos reales:', result.error);
        if (notifier) {
          notifier.show({ type: 'warning', title: 'Archivo no encontrado', subtitle: 'Usando datos de ejemplo', autoClose: 4000 });
        }
        this.loadSampleData();
      }
    } catch (error) {
      console.error('❌ [Inducciones] Error en loadData:', error);
      if (notifier) {
        notifier.show({ type: 'error', title: 'Error', subtitle: 'Error al acceder al archivo Excel', autoClose: 5000 });
      }
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
    Object.values(this.state.charts).forEach(chart => {
      if (chart && typeof chart.destroy === 'function') chart.destroy();
    });
    window.currentInduccionesComponent = null;
  }

  init() {}

  initializeEventListeners() {
    document.querySelectorAll('.inducciones-tab').forEach(item => {
      item.addEventListener('click', () => {
        const view = item.getAttribute('data-view');
        this.switchView(view);
      });
    });

    const backBtn = document.getElementById('btn-back-module');
    if (backBtn && this.backToModuleCallback) {
      backBtn.addEventListener('click', this.backToModuleCallback);
    }

    document.getElementById('filter-year-list')?.addEventListener('change', () => this.applyFilters());
    document.getElementById('search-input')?.addEventListener('keyup', (e) => {
      if(e.key === 'Enter') this.applyFilters();
    });
    document.getElementById('btn-search')?.addEventListener('click', () => this.applyFilters());

    document.getElementById('btn-open-add')?.addEventListener('click', () => this.openModal('add'));
    document.querySelectorAll('.btn-close-modal').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.closeModal();
      });
    });

    document.getElementById('btn-save-induction')?.addEventListener('click', () => this.saveInduction());

    document.getElementById('btn-export-excel')?.addEventListener('click', () => this.showToast('Exportando datos...', 'info'));

  document.getElementById('btn-sync-manual')?.addEventListener('click', () => {
    this.syncFromForms();
  });

  document.getElementById('filter-year-dashboard')?.addEventListener('change', () => this.applyDashboardFilters());
  document.getElementById('filter-gender-dashboard')?.addEventListener('change', () => this.applyDashboardFilters());
  }

  switchView(viewId) {
    document.querySelectorAll('.inducciones-tab').forEach(i => i.classList.remove('active'));
    const activeTab = document.querySelector(`.inducciones-tab[data-view="${viewId}"]`);
    if(activeTab) activeTab.classList.add('active');

    document.querySelectorAll('.k-view-section').forEach(s => s.classList.remove('active'));
    const activeSection = document.getElementById(`view-${viewId}`);
    if(activeSection) activeSection.classList.add('active');

    this.state.currentView = viewId;

    if (viewId === 'dashboard') {
      this.applyDashboardFilters();
      setTimeout(() => this.updateDashboardCharts(this.state.dashboardFilteredData), 50);
    }
  }

  populateYearFilter() {
    const years = [...new Set(this.state.data.map(d => {
      const date = new Date(d.date);
      return isNaN(date.getFullYear()) ? null : date.getFullYear();
    }))].filter(y => y !== null).sort((a,b) => b-a);

    const options = `<option value="">Todos los años</option>` + years.map(y => `<option value="${y}">${y}</option>`).join('');

    const filterList = document.getElementById('filter-year-list');
    if(filterList) filterList.innerHTML = options;

    const filterDashboard = document.getElementById('filter-year-dashboard');
    if(filterDashboard) filterDashboard.innerHTML = options;

    const currentYear = new Date().getFullYear();
    if(years.includes(currentYear)) {
      if(filterList) filterList.value = currentYear;
      if(filterDashboard) filterDashboard.value = currentYear;
    }
  }

  applyFilters() {
    const listYearEl = document.getElementById('filter-year-list');
    const searchInput = document.getElementById('search-input');

    const year = listYearEl ? listYearEl.value : '';
    const search = searchInput ? searchInput.value.toLowerCase() : '';

    this.state.filteredData = this.state.data.filter(item => {
      const itemYear = new Date(item.date).getFullYear();
      const matchYear = year ? itemYear == year : true;
      const matchSearch = item.name.toLowerCase().includes(search) || item.idCard.toString().includes(search);
      return matchYear && matchSearch;
    });

    this.renderDashboardStats();
    this.renderTable();

    const badge = document.getElementById('badge-list');
    if (badge) {
      const count = this.state.filteredData.length;
      badge.textContent = count;
      badge.style.display = count > 0 ? 'inline-flex' : 'none';
    }

    if(this.state.currentView === 'dashboard') this.updateDashboardCharts(this.state.filteredData);
  }

  applyDashboardFilters() {
    const yearEl = document.getElementById('filter-year-dashboard');
    const genderEl = document.getElementById('filter-gender-dashboard');

    const year = yearEl ? yearEl.value : '';
    const gender = genderEl ? genderEl.value : '';

    this.state.dashboardFilteredData = this.state.data.filter(item => {
      const itemYear = new Date(item.date).getFullYear();
      const matchYear = year ? itemYear == year : true;
      const matchGender = gender ? (item.gender && item.gender.toLowerCase().includes(gender.toLowerCase() === 'mujer' ? 'muj' : 'hom')) : true;
      return matchYear && matchGender;
    });

    const countEl = document.getElementById('dashboard-filter-count');
    if (countEl) countEl.textContent = `${this.state.dashboardFilteredData.length} registros`;

    this.renderDashboardStats(this.state.dashboardFilteredData);
    this.updateDashboardCharts(this.state.dashboardFilteredData);
  }

  // ============================================
  // DASHBOARD
  // ============================================
  renderDashboardStats(data) {
    data = data || this.state.filteredData;
    const total = data.length;
    const approved = data.filter(i => i.status === 'approved').length;
    const failed = data.filter(i => i.status === 'failed').length;

    const scoreSum = data.reduce((acc, i) => acc + parseFloat(i.score || 0), 0);
    const avgScore = total > 0 ? (scoreSum / total).toFixed(1) : '0.0';
    const successRate = total > 0 ? Math.round((approved / total) * 100) : 0;

    this.setSafeText('stat-total', total);
    this.setSafeText('stat-approved', approved);
    this.setSafeText('stat-failed', failed);
    this.setSafeText('stat-score', avgScore);
    this.setSafeText('stat-progress-text', `${successRate}%`);

    const women = data.filter(i => i.gender && i.gender.toLowerCase().includes('muj'));
    const men = data.filter(i => i.gender && i.gender.toLowerCase().includes('hom'));
    const womenApproved = women.filter(i => i.status === 'approved').length;
    const menApproved = men.filter(i => i.status === 'approved').length;

    this.setSafeText('stat-gender-f', women.length);
    this.setSafeText('stat-rate-f', women.length ? `${Math.round((womenApproved / women.length) * 100)}% Aprobación` : 'N/D Aprobación');
    this.setSafeText('stat-gender-m', men.length);
    this.setSafeText('stat-rate-m', men.length ? `${Math.round((menApproved / men.length) * 100)}% Aprobación` : 'N/D Aprobación');
  }

  setSafeText(id, text) {
    const el = document.getElementById(id);
    if(el) el.textContent = text;
  }

  updateDashboardCharts(data) {
    if (typeof Chart === 'undefined') return;

    const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const monthlyTotal = Array(12).fill(0);
    const monthlyApproved = Array(12).fill(0);
    const monthlyStats = Array(12).fill(0).map(() => ({ total: 0, approved: 0 }));

    data.forEach(i => {
      const date = new Date(i.date);
      if (!isNaN(date.getMonth())) {
        const m = date.getMonth();
        monthlyTotal[m]++;
        if (i.status === 'approved') monthlyApproved[m]++;
        monthlyStats[m].total++;
        if (i.status === 'approved') monthlyStats[m].approved++;
      }
    });

    // Chart 1: Ejecución Mensual (Line)
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

    // Chart 2: Tasa de Aprobación Mensual (Bar)
    const approvalRates = monthlyStats.map(m => m.total > 0 ? ((m.approved / m.total) * 100).toFixed(1) : 0);

    this.initOrUpdateChart('approvalRateChart', {
      type: 'bar',
      data: {
        labels: months,
        datasets: [{ label: '% Aprobación', data: approvalRates, backgroundColor: '#28a745', borderRadius: 4 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true, max: 100 } },
        plugins: { legend: { position: 'bottom' } }
      }
    });

    // Chart 3: Top Cargos (Doughnut)
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
        datasets: [{ data: posData, backgroundColor: ['#174ea6', '#28a745', '#ffc107', '#17a2b8', '#e91e63'], borderWidth: 0 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'right' } }
      }
    });

    // Chart 4: Aprobación por Género (Stacked Bar)
    const genderStats = { 'Hombre': { approved: 0, failed: 0, total: 0 }, 'Mujer': { approved: 0, failed: 0, total: 0 } };
    data.forEach(i => {
      const g = (i.gender && i.gender.toLowerCase().includes('muj')) ? 'Mujer' : 'Hombre';
      genderStats[g].total++;
      if (i.status === 'approved') genderStats[g].approved++;
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
        responsive: true,
        maintainAspectRatio: false,
        scales: { x: { stacked: true }, y: { stacked: true, ticks: { precision: 0 } } },
        plugins: { legend: { position: 'bottom' } }
      }
    });

  // Chart 5: Distribución de Género (Doughnut)
  this.initOrUpdateChart('genderDistChart', {
    type: 'doughnut',
    data: {
      labels: ['Hombres', 'Mujeres'],
      datasets: [{ data: [genderStats['Hombre'].total, genderStats['Mujer'].total], backgroundColor: ['#174ea6', '#e91e63'], borderWidth: 0 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } }
    }
  });

  // Chart 6: Distribución de Puntajes por Rango (Bar)
  const scoreRanges = { '0-10 Reprobado': 0, '11-15 Bajo': 0, '16-19 Aceptable': 0, '20-22 Excelente': 0 };
  data.forEach(i => {
    const s = parseFloat(i.score || 0);
    if (s <= 10) scoreRanges['0-10 Reprobado']++;
    else if (s <= 15) scoreRanges['11-15 Bajo']++;
    else if (s <= 19) scoreRanges['16-19 Aceptable']++;
    else scoreRanges['20-22 Excelente']++;
  });

  this.initOrUpdateChart('scoreDistChart', {
    type: 'bar',
    data: {
      labels: Object.keys(scoreRanges),
      datasets: [{
        label: 'Trabajadores',
        data: Object.values(scoreRanges),
        backgroundColor: ['#dc3545', '#ffc107', '#174ea6', '#28a745'],
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      plugins: { legend: { display: false } }
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

  async checkForChanges() {
    try {
      if (!window.electronAPI || !window.electronAPI.checkInduccionesChanges) {
        return;
      }

      const result = await window.electronAPI.checkInduccionesChanges(
        this.currentCompany,
        this.state.currentHash
      );

      if (result.success && result.hasChanges) {
        this.showSyncBanner(result.totalRecords || 0);
      }
    } catch (error) {
      console.error('❌ [Inducciones] Error al verificar cambios:', error);
    }
  }

  showSyncBanner(newRecordsCount) {
    const banner = document.getElementById('sync-banner');
    const message = document.getElementById('sync-banner-message');

    if (banner && message) {
      message.textContent = `Hay ${newRecordsCount} registros disponibles en Google Forms. ¿Desea sincronizar ahora?`;
      banner.style.display = 'flex';

      document.getElementById('btn-sync-dismiss')?.addEventListener('click', () => {
        banner.style.display = 'none';
      });

      document.getElementById('btn-sync-now')?.addEventListener('click', () => {
        banner.style.display = 'none';
        this.syncFromForms();
      });
    }
  }

  async syncFromForms() {
    const btn = document.getElementById('btn-sync-manual');
    const icon = document.getElementById('sync-icon');
    const notifier = window.updateNotifier;

    try {
      if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }
      if (icon) { icon.classList.add('bi-spin'); icon.style.animation = 'spin 1s linear infinite'; }
      this.setSyncStatus('syncing', 'Sincronizando...');

      if (notifier) {
        notifier.show({ type: 'info', title: 'Sincronizando', subtitle: 'Actualizando datos desde Google Forms...', progress: { percent: 0 }, autoClose: 0 });
      }

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

        if (notifier) {
          notifier.show({ type: 'success', title: 'Sincronización Completa', subtitle: result.message || `${result.data.length} registros actualizados`, autoClose: 5000 });
        }
      } else {
        throw new Error(result.error || 'Error en sincronización');
      }
    } catch (error) {
      console.error('❌ [Inducciones] Error en sincronización:', error);
      this.setSyncStatus('error', 'Error en sincronización');

      if (notifier) {
        notifier.show({ type: 'error', title: 'Error de Sincronización', subtitle: error.message, autoClose: 6000 });
      }
    } finally {
      if (btn) { btn.disabled = false; btn.style.opacity = ''; }
      if (icon) { icon.classList.remove('bi-spin'); icon.style.animation = ''; }
    }
  }

  setSyncStatus(status, text) {
    const statusEl = document.getElementById('sync-status');
    if (!statusEl) return;
    statusEl.style.display = 'inline-flex';
    statusEl.className = 'k-sync-status';
    statusEl.innerHTML = '';
    switch (status) {
      case 'syncing':
        statusEl.classList.add('syncing');
        statusEl.innerHTML = '<i class="bi bi-arrow-clockwise" style="animation:spin 1s linear infinite;"></i> ' +
          (text || 'Sincronizando...');
        break;
      case 'synced':
        statusEl.innerHTML = '<i class="bi bi-check-circle-fill" style="color: var(--k-success);"></i> ' +
          (text || 'Sincronizado');
        break;
      case 'error':
        statusEl.classList.add('error');
        statusEl.innerHTML = '<i class="bi bi-exclamation-circle-fill"></i> ' + (text || 'Error');
        break;
      default:
        statusEl.innerHTML = '<i class="bi bi-check-circle-fill" style="color: var(--k-success);"></i> ' +
          (text || '');
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
