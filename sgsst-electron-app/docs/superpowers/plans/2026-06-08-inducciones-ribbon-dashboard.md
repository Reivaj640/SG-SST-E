# Inducciones Ribbon + Grid Unificado — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Estandarizar KPIs de inducciones con patrón `k-stats-ribbon` (6 items) e integrar charts de "Análisis y Equidad" en un grid unificado dentro del dashboard, eliminando el tab separado.

**Architecture:** Reemplazar las 2 filas de `k-stat-card` por un `k-stats-ribbon` BEM idéntico al de capacitaciones. Mover los 4 charts de equidad al dashboard en grid 2x2 + 1 centrado. Eliminar tab y sección `#view-reports`. Cero cambios en backend/IPC.

**Tech Stack:** Electron + vanilla JS + Chart.js + CSS BEM scoped

---

### Task 1: CSS — Agregar clases k-stats-ribbon y variantes de color

**Files:**
- Modify: `modules/recursos/inducciones/inducciones-view.css` (después de línea 416, antes de charts)

- [ ] **Step 1: Agregar bloque k-stats-ribbon completo + variantes danger/pink/mint + dark theme + responsive**

Insertar después del bloque `.k-stat-meta` (línea 416) y antes de `.k-chart-container` (línea 419):

```css
/* =========================================
   3.1 DASHBOARD — STATS RIBBON (compacto)
   ========================================= */
.inducciones-container .k-stats-ribbon {
  display: flex;
  align-items: center;
  gap: 0;
  background: var(--k-bg-card);
  border: 1px solid var(--k-border);
  border-radius: var(--k-radius-lg);
  padding: 0;
  margin-bottom: 1.5rem;
  box-shadow: var(--k-shadow-sm);
  overflow: hidden;
}

.inducciones-container .k-stats-ribbon__item {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem 1.25rem;
  flex: 1;
  min-width: 0;
}

.inducciones-container .k-stats-ribbon__icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  flex-shrink: 0;
}

.inducciones-container .k-stats-ribbon__icon.primary {
  background: var(--k-primary-light);
  color: var(--k-primary);
}

.inducciones-container .k-stats-ribbon__icon.success {
  background: var(--k-success-light);
  color: var(--k-success);
}

.inducciones-container .k-stats-ribbon__icon.danger {
  background: var(--k-danger-light);
  color: var(--k-danger);
}

.inducciones-container .k-stats-ribbon__icon.warning {
  background: var(--k-warning-light);
  color: #856404;
}

.inducciones-container .k-stats-ribbon__icon.muted {
  background: #f0f2f5;
  color: var(--k-text-muted);
}

.inducciones-container .k-stats-ribbon__icon.pink {
  background: rgba(233, 30, 99, 0.1);
  color: #e91e63;
}

.inducciones-container .k-stats-ribbon__icon.mint {
  background: rgba(15, 157, 88, 0.1);
  color: #0f9d58;
}

.inducciones-container .k-stats-ribbon__data {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.inducciones-container .k-stats-ribbon__value {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--k-text-main);
  line-height: 1.2;
}

.inducciones-container .k-stats-ribbon__value--sm {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--k-text-muted);
}

.inducciones-container .k-stats-ribbon__label {
  font-size: 0.6875rem;
  color: var(--k-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  white-space: nowrap;
}

.inducciones-container .k-stats-ribbon__pct {
  margin-left: auto;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--k-primary);
  background: var(--k-primary-light);
  padding: 0.125rem 0.5rem;
  border-radius: 10px;
  white-space: nowrap;
  flex-shrink: 0;
}

.inducciones-container .k-stats-ribbon__divider {
  width: 1px;
  height: 32px;
  background: var(--k-border);
  flex-shrink: 0;
}

/* Dark theme — Ribbon */
.inducciones-container[data-theme="dark"] .k-stats-ribbon {
  background: #1e1e2e;
  border-color: #3a3a4a;
}

.inducciones-container[data-theme="dark"] .k-stats-ribbon__icon.primary {
  background: rgba(77, 166, 255, 0.15);
  color: var(--k-primary);
}

.inducciones-container[data-theme="dark"] .k-stats-ribbon__icon.success {
  background: rgba(92, 184, 92, 0.15);
  color: var(--k-success);
}

.inducciones-container[data-theme="dark"] .k-stats-ribbon__icon.danger {
  background: rgba(217, 83, 79, 0.15);
  color: var(--k-danger);
}

.inducciones-container[data-theme="dark"] .k-stats-ribbon__icon.warning {
  background: rgba(255, 193, 7, 0.15);
  color: #f0ad4e;
}

.inducciones-container[data-theme="dark"] .k-stats-ribbon__icon.muted {
  background: rgba(255, 255, 255, 0.05);
  color: #6c757d;
}

.inducciones-container[data-theme="dark"] .k-stats-ribbon__icon.pink {
  background: rgba(233, 30, 99, 0.15);
  color: #e91e63;
}

.inducciones-container[data-theme="dark"] .k-stats-ribbon__icon.mint {
  background: rgba(15, 157, 88, 0.15);
  color: #0f9d58;
}

.inducciones-container[data-theme="dark"] .k-stats-ribbon__value {
  color: #e0e0e0;
}

.inducciones-container[data-theme="dark"] .k-stats-ribbon__value--sm {
  color: #8a8a9a;
}

.inducciones-container[data-theme="dark"] .k-stats-ribbon__label {
  color: #8a8a9a;
}

.inducciones-container[data-theme="dark"] .k-stats-ribbon__divider {
  background: #3a3a4a;
}

.inducciones-container[data-theme="dark"] .k-stats-ribbon__pct {
  color: var(--k-primary);
  background: rgba(77, 166, 255, 0.15);
}

/* Responsive — Ribbon */
@media (max-width: 768px) {
  .inducciones-container .k-stats-ribbon {
    flex-wrap: wrap;
  }
  .inducciones-container .k-stats-ribbon__item {
    flex: 1 1 45%;
  }
  .inducciones-container .k-stats-ribbon__divider {
    display: none;
  }
}
```

- [ ] **Step 2: Agregar clases k-charts-grid y k-chart-row-center**

Insertar después de `.k-chart-body canvas` (línea 444) y antes de `.k-table-container` (línea 447):

```css
/* Charts Grid Unificado */
.inducciones-container .k-charts-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  margin-bottom: 1.5rem;
}

.inducciones-container .k-chart-row-center {
  display: flex;
  justify-content: center;
  margin-bottom: 1.5rem;
}

.inducciones-container .k-chart-row-center .k-chart-container {
  max-width: 50%;
  min-width: 320px;
}

/* Dark theme — Charts Grid */
.inducciones-container[data-theme="dark"] .k-charts-grid .k-chart-container,
.inducciones-container[data-theme="dark"] .k-chart-row-center .k-chart-container {
  background: #1e1e2e;
  border-color: #3a3a4a;
}

.inducciones-container[data-theme="dark"] .k-chart-title {
  color: #e0e0e0;
}

/* Responsive — Charts Grid */
@media (max-width: 992px) {
  .inducciones-container .k-charts-grid {
    grid-template-columns: 1fr;
  }
  .inducciones-container .k-chart-row-center .k-chart-container {
    max-width: 100%;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add modules/recursos/inducciones/inducciones-view.css
git commit -m "feat(inducciones): add k-stats-ribbon + k-charts-grid CSS classes"
```

---

### Task 2: HTML — Reemplazar KPIs por ribbon + grid unificado de charts + eliminar tab y sección reports

**Files:**
- Modify: `modules/recursos/inducciones/inducciones-view.html`

- [ ] **Step 1: Eliminar tab "Análisis y Equidad" del header**

Reemplazar líneas 71-74:

```html
      <button class="kair-header__tab" data-view="reports">
        <i class="bi bi-graph-up"></i>
        Análisis y Equidad
      </button>
```

Con: (eliminar — dejar vacío, solo quedan Dashboard y Registro tabs)

- [ ] **Step 2: Reemplazar sección completa del dashboard (líneas 84-148)**

Reemplazar todo el contenido de `<section id="view-dashboard">` con:

```html
<section id="view-dashboard" class="k-view-section active">

  <!-- Franja de estadísticas compacta -->
  <div class="k-stats-ribbon">
    <div class="k-stats-ribbon__item">
      <span class="k-stats-ribbon__icon primary"><i class="bi bi-clipboard-check"></i></span>
      <div class="k-stats-ribbon__data">
        <span class="k-stats-ribbon__value" id="stat-total">0</span>
        <span class="k-stats-ribbon__label">Total Inducciones</span>
      </div>
      <span class="k-stats-ribbon__pct" id="stat-progress-text">0%</span>
    </div>
    <div class="k-stats-ribbon__divider"></div>
    <div class="k-stats-ribbon__item">
      <span class="k-stats-ribbon__icon success"><i class="bi bi-check-circle"></i></span>
      <div class="k-stats-ribbon__data">
        <span class="k-stats-ribbon__value" id="stat-approved">0</span>
        <span class="k-stats-ribbon__label">Aprobadas</span>
      </div>
    </div>
    <div class="k-stats-ribbon__divider"></div>
    <div class="k-stats-ribbon__item">
      <span class="k-stats-ribbon__icon danger"><i class="bi bi-x-circle"></i></span>
      <div class="k-stats-ribbon__data">
        <span class="k-stats-ribbon__value" id="stat-failed">0</span>
        <span class="k-stats-ribbon__label">Reprobadas</span>
      </div>
    </div>
    <div class="k-stats-ribbon__divider"></div>
    <div class="k-stats-ribbon__item">
      <span class="k-stats-ribbon__icon warning"><i class="bi bi-star"></i></span>
      <div class="k-stats-ribbon__data">
        <span class="k-stats-ribbon__value" id="stat-score">0.0</span>
        <span class="k-stats-ribbon__label">Promedio Puntaje</span>
      </div>
    </div>
    <div class="k-stats-ribbon__divider"></div>
    <div class="k-stats-ribbon__item">
      <span class="k-stats-ribbon__icon pink"><i class="bi bi-gender-female"></i></span>
      <div class="k-stats-ribbon__data">
        <span class="k-stats-ribbon__value" id="stat-gender-f">0</span>
        <span class="k-stats-ribbon__value k-stats-ribbon__value--sm" id="stat-rate-f">0% Aprobación</span>
      </div>
    </div>
    <div class="k-stats-ribbon__divider"></div>
    <div class="k-stats-ribbon__item">
      <span class="k-stats-ribbon__icon mint"><i class="bi bi-gender-male"></i></span>
      <div class="k-stats-ribbon__data">
        <span class="k-stats-ribbon__value" id="stat-gender-m">0</span>
        <span class="k-stats-ribbon__value k-stats-ribbon__value--sm" id="stat-rate-m">0% Aprobación</span>
      </div>
    </div>
  </div>

  <!-- Gráficos Grid Unificado 2x2 -->
  <div class="k-charts-grid">
    <div class="k-chart-container">
      <div class="k-chart-header">
        <div class="k-chart-title">Ejecución Mensual (Realizadas vs Aprobadas)</div>
      </div>
      <div class="k-chart-body">
        <canvas id="mainChart"></canvas>
      </div>
    </div>
    <div class="k-chart-container">
      <div class="k-chart-header">
        <div class="k-chart-title">Tasa de Aprobación por Mes (%)</div>
      </div>
      <div class="k-chart-body">
        <canvas id="approvalRateChart"></canvas>
      </div>
    </div>
    <div class="k-chart-container">
      <div class="k-chart-header">
        <div class="k-chart-title">Top Cargos Inducidos</div>
      </div>
      <div class="k-chart-body">
        <canvas id="positionChart"></canvas>
      </div>
    </div>
    <div class="k-chart-container">
      <div class="k-chart-header">
        <div class="k-chart-title">Aprobación por Género (Aprobados vs Reprobados)</div>
      </div>
      <div class="k-chart-body">
        <canvas id="genderStackChart"></canvas>
      </div>
    </div>
  </div>

  <!-- Distribución de Género (centrado) -->
  <div class="k-chart-row-center">
    <div class="k-chart-container">
      <div class="k-chart-header">
        <div class="k-chart-title">Distribución General de Participantes por Género</div>
      </div>
      <div class="k-chart-body">
        <canvas id="genderDistChart"></canvas>
      </div>
    </div>
  </div>
</section>
```

- [ ] **Step 3: Eliminar sección completa `#view-reports` (líneas 200-266)**

Eliminar todo el bloque:

```html
<!-- =========================
VISTA 3: ANÁLISIS Y EQUIDAD
========================= -->
<section id="view-reports" class="k-view-section">
  ... (todo hasta el </section> de línea 266)
</section>
```

- [ ] **Step 4: Commit**

```bash
git add modules/recursos/inducciones/inducciones-view.html
git commit -m "feat(inducciones): replace stat-cards with ribbon + unified chart grid, remove reports tab"
```

---

### Task 3: JS — Actualizar renderDashboardStats() para ribbon

**Files:**
- Modify: `modules/recursos/inducciones/inducciones-logic.js:231-256`

- [ ] **Step 1: Reescribir renderDashboardStats()**

Reemplazar el método `renderDashboardStats()` completo (líneas 231-256) con:

```javascript
renderDashboardStats() {
  const data = this.state.filteredData;
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
```

- [ ] **Step 2: Commit**

```bash
git add modules/recursos/inducciones/inducciones-logic.js
git commit -m "feat(inducciones): update renderDashboardStats for ribbon layout"
```

---

### Task 4: JS — Mover charts de reports a dashboard + eliminar renderReportsCharts

**Files:**
- Modify: `modules/recursos/inducciones/inducciones-logic.js:263-437`

- [ ] **Step 1: Reescribir updateDashboardCharts() para incluir los 5 charts**

Reemplazar el método `updateDashboardCharts()` completo (líneas 263-321) con:

```javascript
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
}
```

- [ ] **Step 2: Eliminar método renderReportsCharts() completo (líneas 374-437)**

Eliminar todo el bloque:

```javascript
// ============================================
// REPORTES
// ============================================
renderReportsCharts() {
  ... (todo hasta la línea 437)
}
```

- [ ] **Step 3: Commit**

```bash
git add modules/recursos/inducciones/inducciones-logic.js
git commit -m "feat(inducciones): merge reports charts into dashboard, remove renderReportsCharts"
```

---

### Task 5: JS — Limpiar referencias a view-reports y filter-year-report

**Files:**
- Modify: `modules/recursos/inducciones/inducciones-logic.js`

- [ ] **Step 1: Eliminar listener de filter-year-report (línea 127)**

Eliminar:
```javascript
document.getElementById('filter-year-report')?.addEventListener('change', () => this.applyFilters());
```

- [ ] **Step 2: Eliminar listener de btn-download-report (línea 146)**

Eliminar:
```javascript
document.getElementById('btn-download-report')?.addEventListener('click', () => this.showToast('Generando informe...', 'success'));
```

- [ ] **Step 3: Actualizar switchView() — eliminar rama reports (líneas 168-170)**

Eliminar:
```javascript
} else if (viewId === 'reports') {
  setTimeout(() => this.renderReportsCharts(), 50);
}
```

- [ ] **Step 4: Actualizar populateYearFilter() — eliminar referencias a filter-year-report (líneas 182, 184-185, 189-190)**

Eliminar las 3 líneas que referencian `filterReport`:
```javascript
const filterReport = document.getElementById('filter-year-report');
if(filterReport) filterReport.innerHTML = options;
if(filterReport) filterReport.value = currentYear;
```

- [ ] **Step 5: Actualizar applyFilters() — eliminar reportYearEl (líneas 196, 200, 203)**

Eliminar:
```javascript
const reportYearEl = document.getElementById('filter-year-report');
const reportYear = reportYearEl ? reportYearEl.value : '';
const year = this.state.currentView === 'reports' ? reportYear : listYear;
```

Reemplazar con:
```javascript
const year = listYear;
```

Y eliminar la línea:
```javascript
if(this.state.currentView === 'reports') this.renderReportsCharts();
```

- [ ] **Step 6: Commit**

```bash
git add modules/recursos/inducciones/inducciones-logic.js
git commit -m "refactor(inducciones): remove all reports tab references from logic"
```

---

### Task 6: Verificación final

- [ ] **Step 1: Verificar que no quedan referencias rotas**

Buscar en `inducciones-logic.js` y `inducciones-view.html`:
- `view-reports` — no debe existir
- `filter-year-report` — no debe existir
- `btn-download-report` — no debe existir
- `errorRateChart` — no debe existir
- `renderReportsCharts` — no debe existir
- `k-stat-card` — no debe existir en el HTML del dashboard

- [ ] **Step 2: Verificar que los IDs del ribbon existen en HTML y JS**

IDs requeridos en ambos archivos:
- `stat-total`, `stat-progress-text`, `stat-approved`, `stat-failed`, `stat-score`
- `stat-gender-f`, `stat-rate-f`, `stat-gender-m`, `stat-rate-m`
- `mainChart`, `approvalRateChart`, `positionChart`, `genderStackChart`, `genderDistChart`

- [ ] **Step 3: Verificar que los contratos IPC están intactos**

Los 3 canales no deben haber cambiado:
- `get-inducciones-data`
- `sync-inducciones-from-forms`
- `check-inducciones-changes`
