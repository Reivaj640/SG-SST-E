# Plan: Migrar Header 2.5.1 Archivo y Retención

## Objetivo
Migrar header BEM a card pattern, eliminar "Listado Maestro" text, reemplazar stats cards por k-stats-ribbon, y migrar dashboard.

## Archivos a modificar
1. `modules/gestion-integral/archivo-retencion/index.html` — CRUD Viewer
2. `modules/gestion-integral/archivo-retencion/archivo-retencion-dashboard.html` — Dashboard

## Cambios en `index.html`

### 1. CSS: Reemplazar BEM header (líneas 45-259) por card + ribbon

Eliminar todo el bloque `.kair-ar-header.kair-header` + `.kair-header__*` + dark theme + responsive (líneas 45-259).

Agregar:
- `.k-section-card` (card container)
- `.k-section-card__title`, `.k-section-card__subtitle`, `.k-section-card__divider`, `.k-section-card__company`, `.k-section-card__actions`
- `.header-back-btn`, `.header-action--ghost`
- Dark theme para todos
- Responsive para todos

### 2. CSS: Reemplazar stats cards (líneas 419-492) por k-stats-ribbon

Eliminar: `.kair-ar-stats`, `.kair-ar-stat-card`, `.kair-ar-stat-icon*`, `.kair-ar-stat-value`, `.kair-ar-stat-label`

Agregar: `.k-stats-ribbon` + `.k-stats-ribbon__*` (copiar de capacitaciones-view.css líneas 416-509, adaptar variables a `--kair-*`)

### 3. HTML: Reemplazar header (líneas 1284-1326)

De:
```html
<header class="kair-ar-header kair-header">
  <div class="kair-header__bar">
    <div class="kair-header__left">
      <button class="kair-header__back" id="btnVolver">...</button>
    </div>
    <div class="kair-header__divider"></div>
    <div class="kair-header__center">
      <h1 class="kair-header__title">🛡 Archivo y Retención Documental</h1>
      <ol class="kair-header__breadcrumb">...</ol>
    </div>
    <div class="kair-header__right">
      <span class="kair-header__company"><span id="ar-header-company"></span></span>
      <div class="kair-header__divider"></div>
      <button class="kair-header__action--ghost" id="btnGuardar">Guardar</button>
      <button class="kair-header__action--ghost" id="btnExportar">Exportar</button>
      <button class="kair-header__action--ghost" id="btnActualizar">Actualizar</button>
    </div>
  </div>
</header>
```

A:
```html
<div class="k-section-card" style="background:var(--kair-card);border:1px solid var(--kair-border);border-radius:var(--kair-radius);padding:1rem 1.5rem;margin-bottom:1rem;box-shadow:var(--kair-shadow);display:flex;align-items:center;gap:1rem;flex-wrap:wrap;">
  <h1 class="k-section-card__title" style="display:flex;align-items:center;gap:0.5rem;font-size:1.125rem;font-weight:600;color:#1a1a2e;margin:0;white-space:nowrap;">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#174ea6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
    Archivo y Retención Documental
  </h1>
  <p class="k-section-card__subtitle" style="font-size:0.8125rem;color:#5a6378;font-weight:400;margin:0;">Gestión documental y retención de registros SG-SST.</p>
  <div class="k-section-card__divider" style="width:1px;height:24px;background:var(--kair-border);flex-shrink:0;"></div>
  <span class="k-section-card__company" style="display:flex;align-items:center;gap:0.375rem;font-size:0.8125rem;font-weight:400;color:#5a6378;white-space:nowrap;">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22V2h6v20"/></svg>
    <span id="ar-header-company"></span>
  </span>
  <div class="k-section-card__actions" style="display:flex;align-items:center;gap:0.5rem;margin-left:auto;">
    <button class="header-back-btn" id="btnVolver" title="Volver al módulo principal">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      Volver
    </button>
    <button class="header-action--ghost" id="btnGuardar" style="display:none" title="Guardar cambios en el Excel">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
      Guardar
    </button>
    <button class="header-action--ghost" id="btnExportar" title="Exportar CSV">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      Exportar
    </button>
    <button class="header-action--ghost" id="btnActualizar" title="Actualizar datos">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
      Actualizar
    </button>
  </div>
</div>
```

### 4. HTML: Eliminar title section (líneas 1328-1336)

Eliminar completamente:
```html
<section class="kair-ar-title-section">
  <h1 class="kair-ar-title">Listado Maestro de Control de Documentos y Registros</h1>
  <p class="kair-ar-subtitle">GI-FO-010 | Rev. 02 — Marzo 26 del 2025</p>
</section>
```

### 5. HTML: Reemplazar stats cards (líneas 1338-1391) por k-stats-ribbon

De: 4x `.kair-ar-stat-card` en grid
A: `.k-stats-ribbon` horizontal con dividers

```html
<div class="k-stats-ribbon">
  <div class="k-stats-ribbon__item">
    <span class="k-stats-ribbon__icon primary">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>
    </span>
    <div class="k-stats-ribbon__data">
      <span class="k-stats-ribbon__value" id="statTotal">0</span>
      <span class="k-stats-ribbon__label">Total</span>
    </div>
  </div>
  <div class="k-stats-ribbon__divider"></div>
  <div class="k-stats-ribbon__item">
    <span class="k-stats-ribbon__icon primary">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>
    </span>
    <div class="k-stats-ribbon__data">
      <span class="k-stats-ribbon__value" id="statDocumentos">0</span>
      <span class="k-stats-ribbon__label">Documentos</span>
    </div>
  </div>
  <div class="k-stats-ribbon__divider"></div>
  <div class="k-stats-ribbon__item">
    <span class="k-stats-ribbon__icon success">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <line x1="9" y1="3" x2="9" y2="21"/>
        <line x1="3" y1="9" x2="21" y2="9"/>
      </svg>
    </span>
    <div class="k-stats-ribbon__data">
      <span class="k-stats-ribbon__value" id="statRegistros">0</span>
      <span class="k-stats-ribbon__label">Registros</span>
    </div>
  </div>
  <div class="k-stats-ribbon__divider"></div>
  <div class="k-stats-ribbon__item">
    <span class="k-stats-ribbon__icon muted">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
      </svg>
    </span>
    <div class="k-stats-ribbon__data">
      <span class="k-stats-ribbon__value" id="statMuerto">0</span>
      <span class="k-stats-ribbon__label">Archivo Muerto</span>
    </div>
  </div>
</div>
```

### 6. CSS: Eliminar title section + stats CSS

Eliminar: `.kair-ar-title-section`, `.kair-ar-title`, `.kair-ar-subtitle` (líneas 401-417)
Eliminar: `.kair-ar-stats`, `.kair-ar-stat-card`, `.kair-ar-stat-icon*`, `.kair-ar-stat-value`, `.kair-ar-stat-label` (líneas 419-492)

### 7. CSS: Eliminar title-section responsive

Eliminar: `.kair-ar-title-section` responsive si existe

## Cambios en `archivo-retencion-dashboard.html`

### 8. HTML: Migrar page header (líneas 165-170) a card

De:
```html
<div class="page-header">
  <div>
    <h1>📊 Dashboard — Gestión Documental</h1>
    <p>Submódulo 2.5.1 · Archivo y Retención Documental del SG-SST</p>
  </div>
</div>
```

A:
```html
<div class="k-section-card">
  <h1 class="k-section-card__title">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#174ea6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
    Dashboard — Gestión Documental
  </h1>
  <p class="k-section-card__subtitle">Submódulo 2.5.1 · Archivo y Retención Documental del SG-SST</p>
</div>
```

### 9. HTML: Reemplazar KPI cards (líneas 179-200) por k-stats-ribbon

De: 4x `.kpi-card` en grid
A: `.k-stats-ribbon` horizontal

```html
<div class="k-stats-ribbon">
  <div class="k-stats-ribbon__item">
    <span class="k-stats-ribbon__icon primary">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>
    </span>
    <div class="k-stats-ribbon__data">
      <span class="k-stats-ribbon__value" id="kpi-total">—</span>
      <span class="k-stats-ribbon__label">Total Documentos</span>
    </div>
  </div>
  <div class="k-stats-ribbon__divider"></div>
  <div class="k-stats-ribbon__item">
    <span class="k-stats-ribbon__icon success">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
    </span>
    <div class="k-stats-ribbon__data">
      <span class="k-stats-ribbon__value" id="kpi-vigencia">—</span>
      <span class="k-stats-ribbon__label">% Vigentes</span>
    </div>
  </div>
  <div class="k-stats-ribbon__divider"></div>
  <div class="k-stats-ribbon__item">
    <span class="k-stats-ribbon__icon warning">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
        <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/>
      </svg>
    </span>
    <div class="k-stats-ribbon__data">
      <span class="k-stats-ribbon__value" id="kpi-externos">—</span>
      <span class="k-stats-ribbon__label">Externos</span>
    </div>
  </div>
  <div class="k-stats-ribbon__divider"></div>
  <div class="k-stats-ribbon__item">
    <span class="k-stats-ribbon__icon muted">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
      </svg>
    </span>
    <div class="k-stats-ribbon__data">
      <span class="k-stats-ribbon__value" id="kpi-obsoletos">—</span>
      <span class="k-stats-ribbon__label">Obsoletos</span>
    </div>
  </div>
</div>
```

### 10. CSS: Agregar card + ribbon styles al dashboard

Agregar al `<style>` del dashboard:
- `.k-section-card` (card container)
- `.k-section-card__title`, `.k-section-card__subtitle`
- `.k-stats-ribbon` + `.k-stats-ribbon__*` (adaptar variables a `--primary`, `--bg-card`, `--border`, `--text-dark`, `--text-muted`)
- Eliminar `.page-header` y `.kpi-grid`, `.kpi-card`, `.kpi-label`, `.kpi-value`, `.kpi-sub`, `.kpi-success`, `.kpi-warning`, `.kpi-danger`

## IDs preservados

| ID | Archivo | Función JS |
|---|---|---|
| `btnVolver` | index.html | Navegación |
| `btnGuardar` | index.html | Guardar Excel |
| `btnExportar` | index.html | Exportar CSV |
| `btnActualizar` | index.html | Actualizar datos |
| `ar-header-company` | index.html | Company name |
| `statTotal` | index.html | Total docs |
| `statDocumentos` | index.html | Docs count |
| `statRegistros` | index.html | Records count |
| `statMuerto` | index.html | Dead archive |
| `statsContainer` | index.html | Stats section |
| `kpi-total` | dashboard | Total docs |
| `kpi-vigencia` | dashboard | % Vigentes |
| `kpi-externos` | dashboard | Externos |
| `kpi-obsoletos` | dashboard | Obsoletos |

## Riesgos
- Stats IDs must match JS (statTotal, etc.) — se preservan
- k-stats-ribbon CSS variables must be adapted to --kair-* prefix
- Dashboard JS references kpi-* IDs — se preservan
- SVG icons maintained (no Bootstrap Icons dependency)

## Orden de ejecución
1. CSS index.html: reemplazar BEM header → card
2. CSS index.html: reemplazar stats cards → ribbon
3. HTML index.html: reemplazar header
4. HTML index.html: eliminar title section
5. HTML index.html: reemplazar stats
6. CSS dashboard: agregar card + ribbon, eliminar page-header + kpi
7. HTML dashboard: reemplazar page header
8. HTML dashboard: reemplazar KPI cards
9. Verificar JS references
