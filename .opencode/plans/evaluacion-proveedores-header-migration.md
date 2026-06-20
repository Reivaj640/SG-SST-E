# Plan: Migrar Header + Indicadores 2.9.1 Evaluación de Proveedores

## Objetivo
Migrar header BEM a card pattern, reemplazar metric cards por k-stats-ribbon.

## Archivos a modificar
1. `modules/gestion-integral/evaluacion-proveedores/evaluacion-proveedores.css`
2. `modules/gestion-integral/evaluacion-proveedores/evaluacion-proveedores.js` (renderUI)

## Cambios en `evaluacion-proveedores.css`

### 1. Eliminar header BEM (líneas 166-377)
Eliminar ~210 líneas: `.evaluacion-proveedores .kair-header*`

### 2. Eliminar metrics CSS (líneas 387-421)
Eliminar: `.ep-metrics-row`, `.ep-metric-card`, `.ep-metric-value`, `.ep-metric-label`

### 3. Agregar card + ribbon + back button CSS
- `.k-section-card` (card container, padding:0)
- `.header-back-btn` (back button)
- `.k-stats-ribbon` + `.k-stats-ribbon__*` (ribbon pattern)
- Dark theme + responsive

## Cambios en `evaluacion-proveedores.js`

### 4. Reemplazar header HTML (líneas 367-402)

De:
```html
<header class="kair-header">
  <div class="kair-header__bar">
    <div class="kair-header__left">
      <button class="kair-header__back" id="ep-btn-back-module">←</button>
    </div>
    <div class="kair-header__divider"></div>
    <div class="kair-header__center">
      <h1 class="kair-header__title">📦 Identificación y Evaluación...</h1>
      <ol class="kair-header__breadcrumb">...</ol>
    </div>
    <div class="kair-header__right">
      <span class="kair-header__company">🏢 <span id="ep-header-company"></span></span>
      <button class="kair-header__action--ghost" id="ep-btn-export-header">Exportar</button>
      <button class="kair-header__action--ghost" id="ep-btn-new-provider-header">Nuevo</button>
    </div>
  </div>
</header>
```

A:
```html
<div class="k-section-card" style="padding:0; margin-bottom:0;">
  <!-- Fila 1: contenido principal -->
  <div style="display:flex; align-items:center; justify-content:space-between; gap:1rem; padding:1.25rem 1.5rem;">
    <div style="display:flex; align-items:center; gap:0.75rem;">
      <i class="bi bi-box-seam" style="color:#174ea6; font-size:1.25rem;"></i>
      <div>
        <h3 style="font-size:1.125rem; font-weight:600; margin:0; color:#1E293B;">Identificación y Evaluación de Bienes y Servicios</h3>
        <p style="font-size:0.8125rem; color:#64748B; margin:0.25rem 0 0 0;">Gestión de proveedores y evaluación de bienes y servicios SG-SST.</p>
      </div>
    </div>
    <div style="display:flex; align-items:center; gap:0.75rem;">
      <span class="k-section-card__company">
        <i class="bi bi-building"></i>
        <span id="ep-header-company"></span>
      </span>
      <div class="k-section-card__divider"></div>
      <button class="header-back-btn" id="ep-btn-back-module" title="Volver">
        <i class="fas fa-arrow-left"></i> Volver
      </button>
      <button class="header-action--ghost" id="ep-btn-export-header">
        <i class="bi bi-file-earmark-excel"></i> Exportar
      </button>
      <button class="header-action--ghost" id="ep-btn-new-provider-header">
        <i class="bi bi-plus-lg"></i> Nuevo
      </button>
    </div>
  </div>
</div>
```

### 5. Reemplazar metrics HTML (líneas 404-423)

De: 4x `ep-metric-card` en grid
A: `k-stats-ribbon` horizontal

```html
<div class="k-stats-ribbon">
  <div class="k-stats-ribbon__item">
    <span class="k-stats-ribbon__icon primary"><i class="bi bi-box-seam"></i></span>
    <div class="k-stats-ribbon__data">
      <span class="k-stats-ribbon__value" id="ep-total-suppliers">0</span>
      <span class="k-stats-ribbon__label">Total Evaluados</span>
    </div>
  </div>
  <div class="k-stats-ribbon__divider"></div>
  <div class="k-stats-ribbon__item">
    <span class="k-stats-ribbon__icon success"><i class="bi bi-check-circle"></i></span>
    <div class="k-stats-ribbon__data">
      <span class="k-stats-ribbon__value" id="ep-approved-suppliers">0</span>
      <span class="k-stats-ribbon__label">Aprobados</span>
    </div>
  </div>
  <div class="k-stats-ribbon__divider"></div>
  <div class="k-stats-ribbon__item">
    <span class="k-stats-ribbon__icon warning"><i class="bi bi-clock-history"></i></span>
    <div class="k-stats-ribbon__data">
      <span class="k-stats-ribbon__value" id="ep-pending-suppliers">0</span>
      <span class="k-stats-ribbon__label">Pendientes</span>
    </div>
  </div>
  <div class="k-stats-ribbon__divider"></div>
  <div class="k-stats-ribbon__item">
    <span class="k-stats-ribbon__icon muted"><i class="bi bi-x-circle"></i></span>
    <div class="k-stats-ribbon__data">
      <span class="k-stats-ribbon__value" id="ep-rejected-suppliers">0</span>
      <span class="k-stats-ribbon__label">Rechazados</span>
    </div>
  </div>
</div>
```

## IDs preservados
| ID | Función |
|---|---|
| `ep-btn-back-module` | Botón volver |
| `ep-header-company` | Company name |
| `ep-breadcrumb-active` | Breadcrumb (JS ref, puede fallar con guard) |
| `ep-btn-export-header` | Exportar |
| `ep-btn-new-provider-header` | Nuevo Proveedor |
| `ep-total-suppliers` | Total evaluados |
| `ep-approved-suppliers` | Aprobados |
| `ep-pending-suppliers` | Pendientes |
| `ep-rejected-suppliers` | Rechazados |

## Orden de ejecución
1. CSS: Eliminar header BEM + metrics, agregar card + ribbon
2. JS: Reemplazar header HTML en renderUI
3. JS: Reemplazar metrics HTML en renderUI
4. Verificar IDs preservados
