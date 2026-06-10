# Submódulo 2.3.1 — Evaluación Inicial del SG-SST

**Versión:** 1.0
**Actualizado:** 9 de junio de 2026
**Módulo padre:** Gestión Integral (Módulo 2)
**Código SG-SST:** 2.3.1

---

## Descripción

Sistema de evaluación inicial del SG-SST que permite cargar y procesar documentos PDF de evaluación, extraer hallazgos automáticamente, calcular métricas de cumplimiento y gestionar planes de acción asociados a los hallazgos encontrados.

## Arquitectura

### Patrón: Componente Direct DOM + Loader

Clase `EvaluacionInicialSgSst` renderiza HTML directamente en el container. Un archivo loader (`evaluacion-inicial-sg-sst-logic.js`) registra el componente en el mapa global `window.registeredSubmodules`.

## Archivos

| Archivo | Líneas | Propósito |
|---|---|---|
| `modules/gestion-integral/evaluacion-inicial-sg-sst/evaluacion-inicial-sg-sst.js` | ~1600 | Componente principal `EvaluacionInicialSgSst` |
| `modules/gestion-integral/evaluacion-inicial-sg-sst/evaluacion-inicial-sg-sst-logic.js` | - | Loader: `loadEvaluacionInicialSgSst()`, registro en `window.registeredSubmodules` |
| `modules/gestion-integral/evaluacion-inicial-sg-sst/evaluacion-inicial-sg-sst.css` | - | CSS scoped (prefijo `.ev-inicial-sgsst`), dark theme `[data-theme="dark"]` |
| `modules/gestion-integral/evaluacion-inicial-sg-sst/index.js` | - | Barrel export (Node.js) |
| `utils/evaluacionPdfParser.js` | - | Parser PDF: `EvaluacionPdfParser.parsePdf()` |

## Contratos IPC

| Canal | Método Preload | Descripción |
|---|---|---|
| `process-evaluacion-pdf` | `processEvaluacionPdf(pdfPath, sourceType)` | Parsear PDF de evaluación, retorna hallazgos + métricas |

**Respuesta:**

```javascript
{
  success: boolean,
  findings: Array,       // Lista de hallazgos
  metrics: {
    cumplimiento: number,  // Porcentaje
    totalItems: number,
    cumplidos: number,
    noCumplidos: number,
    parcial: number
  }
}
```

## Flujo de Datos

1. Usuario sube PDF de evaluación inicial
2. Ruta del archivo enviada a main process vía `process-evaluacion-pdf`
3. `EvaluacionPdfParser` extrae hallazgos y calcula métricas de cumplimiento
4. Resultados renderizados en tab **Dashboard** con tarjetas de métricas
5. Hallazgos listados en tab **Findings**
6. Usuario puede crear/editar **Action Plans** (CRUD) vinculados a hallazgos

## Tabs del Componente

| Tab | Funcionalidad |
|---|---|
| Dashboard | Métricas de cumplimiento, KPI cards, resumen visual |
| Findings | Lista de hallazgos extraídos del PDF |
| Action Plans | CRUD de planes de acción vinculados a hallazgos |

## UI — KPI Stats Ribbon

El componente incluye un `.k-stats-ribbon` con:

| Elemento | ID | Descripción |
|---|---|---|
| Score | `#kpi-score` | Porcentaje de cumplimiento |
| Score badge | `#kpi-score-pct` | Badge de porcentaje |
| Gaps | `#kpi-gaps` | Hallazgos críticos |
| Pendientes | `#kpi-pending` | Planes de acción incompletos |

## Navegación

- **Módulo:** Gestión Integral
- **Sidebar:** "2.3.1 Evaluación inicial del SG-SST"
- **Ruta:** `gestion-integral.plan-trabajo` (posible routing mismatch)
- **Instanciación:** `new window.EvaluacionInicialSgSst(container, company, module, submodule, callback)`
- **Script:** `index.html` línea 126
- **Widget home:** `gestion-integral-home.js:1115` crea `#evaluacion-inicial-widget`

## Observaciones

1. Handler IPC inline en `main.js:13137-13168` (no separado como archivo-retencion)
2. Posible routing mismatch: mapea a `gestion-integral.plan-trabajo` en vez de ruta dedicada
3. Incluido en barrel export `modules/gestion-integral/index.js`
4. Almacenamiento en memoria + PDF parsing (sin persistencia JSON/Excel propia)
5. Soporte dark theme vía `[data-theme="dark"]`
6. Toast local inline (diferente al sistema global `KAIRToast`)

---

**Mantenido por:** Frontend Team
**Última actualización:** 9 de junio de 2026
**Versión doc:** 1.0 (v0.1.99)
