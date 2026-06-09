# Spec: Estandarización Inducciones — Ribbon KPI + Grid Unificado de Charts

**Fecha:** 2026-06-08  
**Módulo:** Inducciones y Reinducciones (1.2.2)  
**Alcance:** Frontend únicamente (HTML, CSS, JS del módulo)  
**Enfoque:** C — Ribbon 6 items + redistribución total de charts en grid unificado

---

## 1. Objetivo

Estandarizar la visualización de KPIs del módulo de Inducciones usando el patrón canónico `k-stats-ribbon` (ya implementado en Capacitaciones), e integrar toda la información de "Análisis y Equidad" directamente en el dashboard principal, eliminando el tab separado.

## 2. Estado Actual

### KPIs (Dashboard)
- 2 filas de `k-stat-card` con grid auto-fit (4 cards generales + 2 cards de género)
- Cards con borde lateral de color (`::before` pseudo-element)
- Sin iconos, sin dividers, layout tipo card-grid

### Charts (Dashboard)
- Grid `grid-2-1`: Ejecución Mensual (line) + Top Cargos (doughnut)

### Análisis y Equidad (Tab separado)
- Filtro de periodo + botón descarga informe
- Chart: Tasa Aprobación Mensual (bar)
- Chart: Preguntas con Mayor Tasa de Error (canvas sin implementar)
- Chart: Aprobación por Género (stacked bar)
- Chart: Distribución de Género (doughnut)

## 3. Estado Objetivo

### Ribbon KPI (6 items en 1 franja horizontal)

| # | Label | Icon | Clase color | Dato extra |
|---|-------|------|------------|-----------|
| 1 | Total Inducciones | `bi-clipboard-check` | primary | Pill: `% tasa éxito` |
| 2 | Aprobadas | `bi-check-circle` | success | — |
| 3 | Reprobadas | `bi-x-circle` | danger | — |
| 4 | Promedio Puntaje | `bi-star` | warning | — |
| 5 | Mujeres | `bi-gender-female` | pink | Sub-value: `% aprobación` |
| 6 | Hombres | `bi-gender-male` | mint | Sub-value: `% aprobación` |

### Grid de Charts (5 charts, 2x2 + 1 centrado)

```
┌──────────────────────────┬──────────────────────────────────┐
│ Ejecución Mensual        │ Tasa Aprobación Mensual          │
│ (Line: Realizadas vs     │ (Bar: % aprobación por mes)      │
│  Aprobadas)              │                                  │
├──────────────────────────┼──────────────────────────────────┤
│ Top Cargos Inducidos     │ Aprobación por Género            │
│ (Doughnut)               │ (Stacked Bar: Aprob/Reprob)      │
├──────────────────────────┴──────────────────────────────────┤
│ Distribución por Género (Doughnut centrado, max-width 50%) │
└─────────────────────────────────────────────────────────────┘
```

### Header
- Eliminar tab "Análisis y Equidad" (queda: Dashboard + Registro)
- Eliminar lógica de navegación a `view-reports`

## 4. Cambios por Archivo

### 4.1 `inducciones-view.html`

**Eliminar:**
- Tab "Análisis y Equidad" del header (líneas 71-74)
- Sección completa `#view-reports` (líneas 203-266)
- Filas de `k-grid-dashboard` + `k-stat-card` (líneas 86-125)
- Sección `grid-2-1` de charts (líneas 127-147)

**Agregar:**
- `k-stats-ribbon` con 6 items + dividers
- Grid `.k-charts-grid` con 5 charts en 2x2
- Fila centrada con chart de Distribución Género

### 4.2 `inducciones-view.css`

**Agregar:**
- Clases `k-stats-ribbon` BEM (adaptadas de capacitaciones, scope `.inducciones-container`)
- Variantes de icono: `.k-stats-ribbon__icon.danger`, `.pink`, `.mint`
- Dark theme overrides para ribbon
- Clase `.k-charts-grid` (grid 2x2, gap 1.5rem)
- Clase `.k-chart-row-center` (centrar chart, max-width 50%)
- Responsive: ribbon wrap 2x3 en tablet, stack en mobile

**Mantener:**
- Clases `k-stat-card` (no se eliminan por seguridad, otros módulos podrían referenciarlas vía estilos globales)

### 4.3 `inducciones-logic.js`

**Modificar:**
- `renderDashboardStats()`: mapear 6 IDs del ribbon + pill de porcentaje
- `updateDashboardCharts()`: merge con lógica de `renderReportsCharts()` (5 charts en un solo método)

**Eliminar:**
- Método `renderReportsCharts()`
- Rama `viewId === 'reports'` en `switchView()`
- Listener de `filter-year-report` (línea 127)
- Listener de `btn-download-report` (línea 146)
- Variable `reportYearEl` en `applyFilters()` (línea 196)
- Referencia a `filter-year-report` en `populateYearFilter()` (líneas 182, 184-185, 189-190)

**IDs de canvas preservados:**
- `mainChart`, `positionChart`, `approvalRateChart`, `genderStackChart`, `genderDistChart`
- `errorRateChart` se elimina (nunca tuvo chart real)

## 5. Contratos Backend

**CERO cambios.** Los 3 canales IPC permanecen intactos:
- `get-inducciones-data`
- `sync-inducciones-from-forms`
- `check-inducciones-changes`

La estructura de datos retornada no se modifica.

## 6. Nuevos IDs HTML (Ribbon)

| ID | Elemento | Dato |
|----|----------|------|
| `stat-total` | Valor total | `filteredData.length` |
| `stat-progress-text` | Pill porcentaje | `Math.round(approved/total*100) + '%'` |
| `stat-approved` | Valor aprobadas | count approved |
| `stat-failed` | Valor reprobadas | count failed |
| `stat-score` | Valor puntaje promedio | avg.toFixed(1) |
| `stat-gender-f` | Valor mujeres | count women |
| `stat-rate-f` | Sub-valor % aprob mujeres | `% Aprobación` |
| `stat-gender-m` | Valor hombres | count men |
| `stat-rate-m` | Sub-valor % aprob hombres | `% Aprobación` |

## 7. Variantes CSS de Color para Ribbon

```css
.k-stats-ribbon__icon.danger  { background: var(--k-danger-light); color: var(--k-danger); }
.k-stats-ribbon__icon.pink    { background: rgba(233,30,99,0.1); color: #e91e63; }
.k-stats-ribbon__icon.mint    { background: rgba(15,157,88,0.1); color: #0f9d58; }
```

Dark theme:
```css
.inducciones-container[data-theme="dark"] .k-stats-ribbon__icon.danger { background: rgba(217,83,79,0.15); color: var(--k-danger); }
.inducciones-container[data-theme="dark"] .k-stats-ribbon__icon.pink   { background: rgba(233,30,99,0.15); color: #e91e63; }
.inducciones-container[data-theme="dark"] .k-stats-ribbon__icon.mint   { background: rgba(15,157,88,0.15); color: #0f9d58; }
```

## 8. Validación Final

- ✅ No se rompe otro módulo (cambio 100% dentro de `inducciones-container`)
- ✅ No se alteran contratos IPC
- ✅ No hay efectos secundarios CSS (scope aislado)
- ✅ Coherencia visual con capacitaciones (mismo patrón `k-stats-ribbon`)
- ✅ Datos de equidad visibles sin cambiar de tab
- ✅ `errorRateChart` eliminado limpiamente (nunca tuvo implementación)
- ✅ `filter-year-report` eliminado (filtro del dashboard ya filtra todos los charts)
