# Plan: Migrar Header 2.6.1 Rendición de Cuentas

## Objetivo
Migrar header a card pattern con título/subtítulo vertical, tabs integradas, y portal incluido.

## Archivos a modificar
1. `modules/gestion-integral/rendicion-cuentas/rendicion-cuentas.html` — CRUD Viewer
2. `modules/gestion-integral/rendicion-cuentas/rendicion-home.html` — Portal

## Cambios en `rendicion-cuentas.html`

### 1. CSS: Eliminar header BEM, agregar card + tabs

Eliminar (~100 líneas):
- `.header-container`, `.header-top`, `.header-left-side`, `.title-container`
- `.back-btn-internal`, `.main-title`, `.breadcrumb-context`
- `.header-nav`, `.nav-item`, `.nav-item:hover`, `.nav-item.active`

Agregar:
- `.k-section-card` (card container, padding:0)
- `.rendicion-tab` (tabs integrados, mismos estilos que `.nav-item`)
- Dark theme + responsive

### 2. HTML: Reemplazar header (líneas 388-421)

De:
```html
<header class="global-header">
  <div class="header-top">
    <div class="header-left-side">
      <button id="backToModuleBtn" class="back-btn-internal">← Volver al Módulo</button>
      <div class="title-container">
        <div class="main-title">🛡 Rendición de Cuentas SG-SST</div>
        <div class="breadcrumb-context">Gestión Integral / 2.6.1 • (2024)</div>
      </div>
    </div>
  </div>
  <div class="header-nav">
    <div class="nav-item active" onclick="switchSection('general', this)">1. General</div>
    ...6 tabs...
  </div>
</header>
```

A:
```html
<div class="k-section-card" style="padding:0; margin-bottom:0; flex-shrink:0;">
  <!-- Fila 1: contenido principal -->
  <div style="display:flex; align-items:center; justify-content:space-between; gap:1rem; padding:1.25rem 1.5rem;">
    <div style="display:flex; align-items:center; gap:0.75rem;">
      <i class="bi bi-file-earmark-check" style="color:#174ea6; font-size:1.25rem;"></i>
      <div>
        <h3 style="font-size:1.125rem; font-weight:600; margin:0; color:#1E293B;">Rendición de Cuentas SG-SST</h3>
        <p style="font-size:0.8125rem; color:#64748B; margin:0.25rem 0 0 0;">Gestión del informe anual de rendición de cuentas del SG-SST.</p>
      </div>
    </div>
    <div style="display:flex; align-items:center; gap:0.75rem;">
      <button class="header-back-btn" id="backToModuleBtn" title="Volver">
        <i class="fas fa-arrow-left"></i> Volver
      </button>
    </div>
  </div>
  <!-- Fila 2: tabs integrados -->
  <div class="rendicion-tabs">
    <div class="rendicion-tab active" onclick="switchSection('general', this)">1. General</div>
    <div class="rendicion-tab" onclick="switchSection('resultados', this)">2. Resultados SG-SST</div>
    <div class="rendicion-tab" onclick="switchSection('normativo', this)">3. Normativo & Riesgos</div>
    <div class="rendicion-tab" onclick="switchSection('incidentes', this)">4. Incidentes & AT</div>
    <div class="rendicion-tab" onclick="switchSection('plan', this)">5. Plan de Acción</div>
    <div class="rendicion-tab" onclick="switchSection('cierre', this)">6. Cierre & Firmas</div>
  </div>
</div>
```

### 3. JS: Actualizar selectors

En línea 757 (`switchSection`):
- De: `document.querySelectorAll('.nav-item')`
- A: `document.querySelectorAll('.rendicion-tab')`

En `rendicion-viewer.js` línea 524:
- De: `document.querySelectorAll('.nav-item')`
- A: `document.querySelectorAll('.rendicion-tab')`

### 4. IDs preservados
| ID | Función |
|---|---|
| `backToModuleBtn` | Botón volver |
| `breadcrumb-period` | Period label (en JS) |
| `general`, `resultados`, `normativo`, `incidentes`, `plan`, `cierre` | Secciones |

## Cambios en `rendicion-home.html`

### 5. HTML: Reemplazar portal header (líneas 277-287)

De:
```html
<div class="portal-header">
  <button class="back-btn-internal" onclick="goBackToModule()">← Volver al Módulo</button>
  <div class="portal-logo">🛡 K+AIR RENDICIÓN</div>
</div>
```

A:
```html
<div class="k-section-card">
  <div style="display:flex; align-items:center; gap:0.75rem;">
    <i class="bi bi-file-earmark-check" style="color:#174ea6; font-size:1.25rem;"></i>
    <div>
      <h3 style="font-size:1.125rem; font-weight:600; margin:0; color:#1E293B;">Rendición de Cuentas SG-SST</h3>
      <p style="font-size:0.8125rem; color:#64748B; margin:0.25rem 0 0 0;">Gestión del informe anual de rendición de cuentas del SG-SST.</p>
    </div>
  </div>
  <div style="margin-left:auto;">
    <button class="header-back-btn" onclick="goBackToModule()" title="Volver">
      <i class="fas fa-arrow-left"></i> Volver
    </button>
  </div>
</div>
```

### 6. CSS: Agregar card styles al portal

Agregar `.k-section-card`, `.header-back-btn` al `<style>` del portal.
Eliminar `.portal-header`, `.portal-logo`, `.back-btn-internal`.

## Orden de ejecución
1. CSS rendicion-cuentas.html: eliminar header BEM, agregar card + tabs
2. HTML rendicion-cuentas.html: reemplazar header
3. JS rendicion-cuentas.html: actualizar switchSection selector
4. JS rendicion-viewer.js: actualizar .nav-item selector
5. CSS rendicion-home.html: agregar card, eliminar portal-header
6. HTML rendicion-home.html: reemplazar portal header
