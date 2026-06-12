# Plan: Migrar Header + Indicadores 2.10.1 Evaluación y Selección

## Objetivo
Migrar header BEM a card pattern, tabs integradas, dashboard cards a k-stats-ribbon.

## Archivos a modificar
1. `modules/gestion-integral/evaluacion-seleccion/evaluacion-seleccion.css`
2. `modules/gestion-integral/evaluacion-seleccion/evaluacion-seleccion-component.js` (renderUI)
3. `modules/gestion-integral/evaluacion-seleccion/dashboard.js` (renderDashboardCards)

## Cambios en `evaluacion-seleccion.css`

### 1. Eliminar header BEM (líneas 98-359)
Eliminar ~260 líneas: `.kair-es-wrapper .kair-header*` + dark theme + responsive

### 2. Eliminar dashboard cards CSS (líneas 511-522)
Eliminar: `.kair-dashboard__cards`, `.kair-dashboard__card*`

### 3. Agregar card + ribbon + tabs CSS
- `.k-section-card` (card container, padding:0)
- `.header-back-btn`, `.header-action--ghost`
- `.es-tab`, `.es-tab__badge` (tabs integrados)
- `.k-stats-ribbon*` (ribbon pattern)
- Dark theme + responsive

## Cambios en `evaluacion-seleccion-component.js`

### 4. Reemplazar header HTML (líneas 89-126)

De:
```html
<header class="kair-header">
  <div class="kair-header__bar">
    ...BEM header...
  </div>
  <div class="kair-header__tabs">
    ...tabsHtml...
  </div>
</header>
```

A:
```html
<div class="k-section-card" style="padding:0; margin-bottom:0;">
  <!-- Fila 1: contenido principal -->
  <div style="display:flex; align-items:center; justify-content:space-between; gap:1rem; padding:1.25rem 1.5rem;">
    <div style="display:flex; align-items:center; gap:0.75rem;">
      <i class="bi bi-people" style="color:#174ea6; font-size:1.25rem;"></i>
      <div>
        <h3 style="font-size:1.125rem; font-weight:600; margin:0; color:#1E293B;">Evaluación y Selección de Proveedores y Contratistas</h3>
        <p style="font-size:0.8125rem; color:#64748B; margin:0.25rem 0 0 0;">Gestión de asociados y evaluación de proveedores y contratistas SG-SST.</p>
      </div>
    </div>
    <div style="display:flex; align-items:center; gap:0.75rem;">
      <span class="k-section-card__company">
        <i class="bi bi-building"></i>
        <span id="kair-es-header-company">...</span>
      </span>
      <div class="k-section-card__divider"></div>
      <button class="header-back-btn" id="btn-back-es" title="Volver">
        <i class="fas fa-arrow-left"></i> Volver
      </button>
      <button class="header-action--ghost" id="kair-es-action-registro" style="display:none;">
        <i class="bi bi-plus-lg"></i> Nuevo
      </button>
      <button class="header-action--ghost" id="kair-es-action-nc" style="display:none;">
        <i class="bi bi-exclamation-triangle"></i> Reportar NC
      </button>
    </div>
  </div>
  <!-- Fila 2: tabs integrados -->
  <div class="es-tabs">
    ...tabsHtml (con .es-tab en lugar de .kair-header__tab)...
  </div>
</div>
```

### 5. Actualizar tabs HTML (líneas 71-81)

De:
```html
<button class="kair-header__tab active" data-view="...">
  <i class="bi ..."></i><span>Label</span>
  <span class="kair-header__tab-badge">N</span>
</button>
```

A:
```html
<button class="es-tab active" data-view="...">
  <i class="bi ..."></i><span>Label</span>
  <span class="es-tab__badge">N</span>
</button>
```

### 6. Actualizar selectors JS
- Línea 286: `.kair-header__tab` → `.es-tab`
- Línea 332: `.kair-header__tab` → `.es-tab`

## Cambios en `dashboard.js`

### 7. Reemplazar dashboard cards (líneas 22-56)

De: 4x `kair-dashboard__card` en grid
A: `k-stats-ribbon` horizontal

```html
<div class="k-stats-ribbon">
  <div class="k-stats-ribbon__item">
    <span class="k-stats-ribbon__icon primary"><i class="bi bi-people"></i></span>
    <div class="k-stats-ribbon__data">
      <span class="k-stats-ribbon__value">{stats.totalAsociados}</span>
      <span class="k-stats-ribbon__label">Asociados Registrados</span>
    </div>
  </div>
  <div class="k-stats-ribbon__divider"></div>
  <div class="k-stats-ribbon__item">
    <span class="k-stats-ribbon__icon warning"><i class="bi bi-clock-history"></i></span>
    <div class="k-stats-ribbon__data">
      <span class="k-stats-ribbon__value">{stats.evaluacionesPendientes}</span>
      <span class="k-stats-ribbon__label">Evaluaciones Pendientes</span>
    </div>
  </div>
  <div class="k-stats-ribbon__divider"></div>
  <div class="k-stats-ribbon__item">
    <span class="k-stats-ribbon__icon primary"><i class="bi bi-arrow-repeat"></i></span>
    <div class="k-stats-ribbon__data">
      <span class="k-stats-ribbon__value">{stats.reevaluacionesMes}</span>
      <span class="k-stats-ribbon__label">Reevaluaciones del Mes</span>
    </div>
  </div>
  <div class="k-stats-ribbon__divider"></div>
  <div class="k-stats-ribbon__item">
    <span class="k-stats-ribbon__icon muted"><i class="bi bi-exclamation-triangle"></i></span>
    <div class="k-stats-ribbon__data">
      <span class="k-stats-ribbon__value">{stats.ncActivas}</span>
      <span class="k-stats-ribbon__label">No Conformidades Activas</span>
    </div>
  </div>
</div>
```

## IDs preservados
| ID | Función |
|---|---|
| `btn-back-es` | Botón volver |
| `kair-es-header-company` | Company name |
| `kair-es-breadcrumb-active` | Breadcrumb (con guard) |
| `kair-es-action-registro` | Nuevo Asociado |
| `kair-es-action-nc` | Reportar NC |

## Orden de ejecución
1. CSS: Eliminar header BEM + dashboard cards, agregar card + ribbon + tabs
2. JS component: Reemplazar header HTML + actualizar tabs selectors
3. JS dashboard: Reemplazar dashboard cards por ribbon
4. Verificar IDs preservados
