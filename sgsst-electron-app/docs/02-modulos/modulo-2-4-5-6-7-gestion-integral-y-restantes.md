# 📋 Módulos Restantes K+AIR

**Versión:** 1.1
**Actualizado:** 9 de junio de 2026
**Estado:** ✅ Documentado v0.1.99

> **Nota:** Los módulos 4-7 ahora tienen documentación dedicada:
> - [modulo-4-gestion-peligros.md](modulo-4-gestion-peligros.md)
> - [modulo-5-gestion-amenazas.md](modulo-5-gestion-amenazas.md)
> - [modulo-6-verificacion.md](modulo-6-verificacion.md)
> - [modulo-7-mejoramiento.md](modulo-7-mejoramiento.md)

---

## 📋 Tabla de Contenidos

1. [Módulo 2: Gestión Integral](#2-gestión-integral)
2. [Módulo 4: Gestión de Peligros y Riesgos](#4-gestión-de-peligros-y-riesgos)
3. [Módulo 5: Gestión de Amenazas](#5-gestión-de-amenazas)
4. [Módulo 6: Verificación](#6-verificación)
5. [Módulo 7: Mejoramiento](#7-mejoramiento)

---

## 2. Gestión Integral

### Visión General

El módulo de **Gestión Integral** agrupa los componentes fundamentales para la dirección y planificación del SG-SST.

### Submódulos

| Código | Submódulo | Archivos Principales | Estado |
|--------|-----------|---------------------|--------|
| 2.1.1 | Política del SG-SST | `politica-logic.js` | ✅ |
| 2.2.1 | Objetivos SST | `objetivos-sst-logic.js` | ✅ |
| 2.3.1 | Evaluación Inicial SG-SST | `evaluacion-inicial-sg-sst-logic.js` | ✅ [📄](modulo-2-3-1-evaluacion-inicial-sg-sst.md) |
| 2.4.1 | Plan de Trabajo Anual | `plan-trabajo-logic.js`, `plan-home.js`, `plan-viewer.js` | ✅ |
| 2.6.1 | Rendición de Cuentas | `rendicion-logic.js` | ✅ |
| 2.9.1 | Evaluación de Proveedores | `evaluacion-proveedores-logic.js` | ✅ |
| 2.5.1 | Archivo y Retención Documental | `archivo-retencion.js` + `archivo-retencion-main.js` | ✅ [📄](modulo-2-5-1-archivo-retencion.md) |
| 2.10.1 | Evaluación y Selección | `evaluacion-seleccion-logic.js` | ✅ [📄](modulo-2-10-1-evaluacion-seleccion.md) |
| 2.11.1 | Gestión del Cambio | `gestion-del-cambio-logic.js` | ✅ [📄](modulo-2-11-1-gestion-del-cambio.md) |

### Archivos del Módulo

```
modules/gestion-integral/
├── index.js
├── gestion-integral-home.js
├── gestion-integral-home.html
├── gestion-integral.css
├── evaluacion-inicial-sg-sst/
├── objetivos-sst/
├── plan-trabajo/
│   ├── plan-trabajo-logic.js    # PlanTrabajoComponent (render, destroy, navegación)
│   ├── plan-home.js             # Portal home (goBackToModule, enterCronograma)
│   ├── plan-home.html           # Portal de bienvenida con tabs-header
│   ├── plan-viewer.js           # Dashboard: 6 gráficas, KPIs, modal periodo
│   ├── plan-view.html           # Dashboard HTML (k-stats-ribbon, charts-grid)
│   └── plan-view.css            # CSS BEM (~1080 líneas)
├── politica/
├── rendicion-cuentas/
├── evaluacion-proveedores/
├── evaluacion-seleccion/
└── gestion-del-cambio/
```

---

### 2.1.1 Política del SG-SST

**Descripción:** Formula, aprueba y difunde la política de seguridad y salud en el trabajo.

**Funcionalidades:**
- ✅ Redacción de política conforme a normativa
- ✅ Aprobación por alta dirección
- ✅ Difusión a todos los niveles
- ✅ Revisión anual
- ✅ Integración con OnlyOffice 📝

**Archivos:**
- `modules/gestion-integral/politica/politica-logic.js`
- `modules/gestion-integral/politica/politica-viewer.js`
- `modules/gestion-integral/politica/politica-view.html`
- `modules/gestion-integral/politica/onlyoffice-bridge.js`

**Contratos IPC:**
```javascript
// Abrir editor OnlyOffice
await window.electronAPI.openOnlyOfficeEditor(payload);

// Generar configuración OnlyOffice
const config = await window.electronAPI.generateOnlyOfficeConfig(payload);
```

---

### 2.2.1 Objetivos SST

**Descripción:** Establece, hace seguimiento y evalúa los objetivos del SG-SST.

**Funcionalidades:**
- ✅ Formulación de objetivos SMART
- ✅ Indicadores de seguimiento
- ✅ Metas cuantificables
- ✅ Responsable de cada objetivo
- ✅ Seguimiento periódico
- ✅ Lectura/escritura desde Excel 📊

**Archivos:**
- `modules/gestion-integral/objetivos-sst/objetivos-sst-logic.js`
- `modules/gestion-integral/objetivos-sst/objetivos-sst-viewer.js`
- `modules/gestion-integral/objetivos-sst/objetivos-sst-view.html`

**Contratos IPC:**
```javascript
// Obtener ruta de Excel de objetivos
const path = await window.electronAPI.getObjetivosExcelPath(company);

// Cargar datos de Excel
const data = await window.electronAPI.loadObjetivosExcelData(path);

// Guardar datos en Excel
await window.electronAPI.saveObjetivosExcelData(path, data);
```

---

### 2.3.1 Evaluación Inicial SG-SST

**Descripción:** Realiza el diagnóstico inicial del estado del SG-SST.

**Funcionalidades:**
- ✅ Lista de verificación normativa
- ✅ Evaluación por capítulos
- ✅ Porcentaje de cumplimiento
- ✅ Plan de mejora
- ✅ Test de evaluación 📝

**Archivos:**
- `modules/gestion-integral/evaluacion-inicial-sg-sst/evaluacion-inicial-sg-sst-logic.js`
- `modules/gestion-integral/evaluacion-inicial-sg-sst/evaluacion-inicial-sg-sst.js`
- `modules/gestion-integral/evaluacion-inicial-sg-sst/evaluacion-inicial-sg-sst.css`
- `modules/gestion-integral/evaluacion-inicial-sg-sst/evaluacion-inicial-sg-sst-test.html`

---

### 2.4.1 Plan de Trabajo Anual

**Descripción:** Elabora y hace seguimiento al plan de trabajo anual del SG-SST.

**Funcionalidades:**
- ✅ Actividades programadas
- ✅ Cronograma anual
- ✅ Responsables
- ✅ Recursos asignados
- ✅ Seguimiento de avance
- ✅ Portal K+AIR 🌐
- ✅ Dashboard con 6 gráficas (Estado, Progreso Mensual, Cumplimiento Trimestral, Estado Mensual, Categoría, Radar Anual) 📊
- ✅ KPIs estandarizados (`k-stats-ribbon` canónico) 📊
- ✅ Modal selector de periodo con cierre X y clic en fondo 🪟
- ✅ Navegación corregida: 2 flujos separados (cronograma→home, portal→módulo) 🔄

**Archivos:**
- `modules/gestion-integral/plan-trabajo/plan-trabajo-logic.js` — `PlanTrabajoComponent`: `render()`, `loadPortalHome()`, `enterCronograma()`, `goBackToHome()`, `goBackToModuleHome()`, `destroy()`
- `modules/gestion-integral/plan-trabajo/plan-home.js` — Portal home: `goBackToModule()`, `enterCronograma()`
- `modules/gestion-integral/plan-trabajo/plan-home.html` — Portal de bienvenida con `.back-btn-internal`
- `modules/gestion-integral/plan-trabajo/plan-viewer.js` — Dashboard: 6 `renderChart*()`, `updateKPIs()`, `hidePeriodSelector()`, `K_COLORS`
- `modules/gestion-integral/plan-trabajo/plan-view.html` — Dashboard HTML: `k-stats-ribbon`, `k-tabs-header`, `charts-grid` 3x2, canvas ids
- `modules/gestion-integral/plan-trabajo/plan-view.css` — CSS BEM (~1080 líneas): `.k-stats-ribbon`, `.k-tabs-header`, `.chart-card`, `.period-card__close`

**Navegación:**
```
Cronograma (iframe):
  backBtn → postMessage('back-to-module-request')
  → renderer → planPortalComponent.goBackToHome()
  → recarga portal home ✓

Portal Home:
  goBackToModule() → planPortalComponent.goBackToModuleHome()
  → destroy() + onBackToModuleHome()
  → menú Gestión Integral ✓
```

**Contratos IPC:**
```javascript
// Sin cambios — usa contratos existentes de renderer.js
// postMessage desde iframe para navegación cronograma→home
```

---

### 2.6.1 Rendición de Cuentas

**Descripción:** Gestiona el proceso de rendición de cuentas del SG-SST a la alta dirección.

**Funcionalidades:**
- ✅ Informe de gestión
- ✅ Indicadores de desempeño
- ✅ Logros y dificultades
- ✅ Recomendaciones
- ✅ Presentación a alta dirección

**Archivos:**
- `modules/gestion-integral/rendicion-cuentas/rendicion-logic.js`
- `modules/gestion-integral/rendicion-cuentas/rendicion-viewer.js`

---

### 2.9.1 Evaluación de Proveedores

**Descripción:** Evalúa y califica a los proveedores y contratistas en materia de SST.

**Funcionalidades:**
- ✅ Evaluación de desempeño SST de proveedores
- ✅ Calificación y clasificación de contratistas
- ✅ Seguimiento a compromisos SST
- ✅ Integración con contratos backend

**Archivos:**
- `modules/gestion-integral/evaluacion-proveedores/evaluacion-proveedores-logic.js`
- `modules/gestion-integral/evaluacion-proveedores/evaluacion-proveedores-viewer.js`

---

### 2.10.1 Evaluación y Selección

**Descripción:** Gestiona los procesos de evaluación y selección de personal con enfoque SST.

**Funcionalidades:**
- ✅ Criterios de selección con componentes SST
- ✅ Evaluaciones de aptitud laboral
- ✅ Seguimiento post-ingreso
- ✅ Registro de evaluaciones

**Archivos:**
- `modules/gestion-integral/evaluacion-seleccion/evaluacion-seleccion-logic.js`
- `modules/gestion-integral/evaluacion-seleccion/evaluacion-seleccion-viewer.js`

---

### 2.11.1 Gestión del Cambio

**Descripción:** Gestiona los cambios que pueden afectar el SG-SST (instalaciones, procesos, personal).

**Funcionalidades:**
- ✅ Identificación de cambios significativos
- ✅ Evaluación de impacto en SST
- ✅ Plan de acción para cambios
- ✅ Seguimiento a medidas de control
- ✅ Aprobación por responsable designado

**Archivos:**
- `modules/gestion-integral/gestion-del-cambio/gestion-del-cambio-logic.js`
- `modules/gestion-integral/gestion-del-cambio/gestion-del-cambio-viewer.js`

---

## 4. Gestión de Peligros y Riesgos

### Visión General

El módulo de **Gestión de Peligros y Riesgos** identifica, evalúa y controla los peligros y riesgos laborales.

### Submódulos (Home Module)

| Código | Submódulo | Archivo | Estado |
|--------|-----------|---------|--------|
| 4 | Home Module | `gestion-peligros-home.js` | ✅ |

### Funcionalidades Generales

- ✅ Identificación de peligros
- ✅ Evaluación de riesgos
- ✅ Matriz IPEVR
- ✅ Controles jerárquicos
- ✅ Inspecciones sistemáticas

### Archivos del Módulo

```
modules/gestion-peligros/
├── index.js
├── gestion-peligros-home.js
├── gestion-peligros-home.html
└── gestion-peligros.css
```

### Submódulos Implementados en Renderer

Los siguientes submódulos están implementados directamente en `renderer.js`:

- **4.1.1 Metodología IPEVR**
- **4.1.2 Identificación de Peligros**
- **4.1.3 Sustancias Químicas**
- **4.1.4 Mediciones Ambientales**
- **4.2.1 Medidas de Prevención y Control**
- **4.2.2 Aplicación de Controles**
- **4.2.3 Evaluación de Procedimientos**
- **4.2.4 Inspecciones Sistemáticas**
- **4.2.5 Mantenimiento Periódico**
- **4.2.6 Entrega de EPP**

---

## 5. Gestión de Amenazas

### Visión General

El módulo de **Gestión de Amenazas** prepara a la organización para responder ante emergencias.

### Submódulos (Home Module)

| Código | Submódulo | Archivo | Estado |
|--------|-----------|---------|--------|
| 5 | Home Module | `gestion-amenazas-home.js` | ✅ |

### Funcionalidades Generales

- ✅ Plan de prevención de emergencias
- ✅ Brigadas de emergencia
- ✅ Simulacros
- ✅ Exámenes médicos a brigadistas
- ✅ Recursos para emergencias

### Archivos del Módulo

```
modules/gestion-amenazas/
├── index.js
├── gestion-amenazas-home.js
├── gestion-amenazas-home.html
└── gestion-amenazas.css
```

### Submódulos Implementados

- **5.1.1 Plan de Prevención de Emergencias**
- **5.1.2 Exámenes Médicos Brigadista**

---

## 6. Verificación

### Visión General

El módulo de **Verificación** evalúa el desempeño y cumplimiento del SG-SST.

### Submódulos (Home Module)

| Código | Submódulo | Archivo | Estado |
|--------|-----------|---------|--------|
| 6 | Home Module | `verificacion-home.js` | ✅ |

### Funcionalidades Generales

- ✅ Indicadores de desempeño
- ✅ Auditorías internas
- ✅ Revisión por la alta dirección
- ✅ Medición de cumplimiento
- ✅ Acciones de mejora

### Archivos del Módulo

```
modules/verificacion/
├── index.js
├── verificacion-home.js
├── verificacion-home.html
└── verificacion.css
```

### Submódulos Implementados

- **6.1.1 Definición de Indicadores**
- **6.1.2 Auditoría Anual**
- **6.1.3 Revisión de la Alta Dirección**
- **6.1.4 Planificación de Auditoría**

---

## 7. Mejoramiento

### Visión General

El módulo de **Mejoramiento** gestiona las acciones correctivas, preventivas y de mejora continua.

### Submódulos (Home Module)

| Código | Submódulo | Archivo | Estado |
|--------|-----------|---------|--------|
| 7 | Home Module | `mejoramiento-home.js` | ✅ |

### Funcionalidades Generales

- ✅ Acciones preventivas
- ✅ Acciones correctivas
- ✅ Acciones de mejora
- ✅ Seguimiento a planes de mejoramiento
- ✅ Verificación de efectividad

### Archivos del Módulo

```
modules/mejoramiento/
├── index.js
├── mejoramiento-home.js
├── mejoramiento-home.html
└── mejoramiento.css
```

### Submódulos Implementados

- **7.1.1 Acciones Preventivas y Correctivas**
- **7.1.2 Acciones de Mejora (revisión de alta gerencia)**
- **7.1.3 Acciones de Mejora (investigaciones de AT y EL)**
- **7.1.4 Planes de Mejoramiento (autoridades y ARL)**

---

## Componentes Globales de Módulos

Todos los módulos exponen componentes globales para acceso desde el renderer:

```javascript
// Módulo 1: Recursos
window.ResponsableSgComponent
window.RolesResponsabilidadesComponent
window.AfiliacionComponent
window.CopasstComponent
window.CapacitacionCopasstComponent
window.ComiteConvivenciaComponent
window.CursoVirtualComponent
window.CapacitacionesComponent
window.InduccionesComponent
window.PresupuestoGestionComponent
window.TrabajoAltoRiesgoComponent
window.RecursosHome

// Módulo 2: Gestión Integral
window.PoliticaComponent
window.ObjetivosSSTComponent
window.PlanTrabajoComponent
window.RendicionCuentasComponent
window.EvaluacionProveedoresComponent
window.EvaluacionSeleccionComponent
window.GestionDelCambioComponent
window.GestionIntegralHome

// Módulo 3: Gestión de la Salud
window.SociodemograficaComponent
window.EvaluacionesMedicasComponent
window.RestriccionesMedicasComponent
window.ReportesAccidentesComponent
window.InvestigacionAccidentesComponent
window.MedicionAusentismoComponent
window.RegistrarAusentismoComponent
window.VerAusentismoComponent
window.GestionSaludHome

// Homes de Módulos 4-7
window.GestionPeligrosHome
window.GestionAmenazasHome
window.VerificacionHome
window.MejoramientoHome
```

---

## Cambios Recientes

### Versión 0.1.99 (9 junio 2026)

- ✅ Dashboard Plan de Trabajo: 6 gráficas, KPIs k-stats-ribbon, tabs-header empresa+periodo
- ✅ Modal selector de periodo con cierre X y clic en fondo
- ✅ Navegación corregida: 2 flujos separados (cronograma→home, portal→módulo)
- ✅ PlanTrabajoComponent.destroy() consistente con patrón COPASST
- ✅ goBackToModuleHome() — navegación directa sin postMessage
- ✅ Fix visual: subrayado en .back-btn-internal eliminado

### Versión 0.1.70 (6 marzo 2026)

- ✅ Documentación consolidada de todos los módulos
- ✅ Estructura unificada de documentación

### Versión 0.1.52 (1 marzo 2026)

- ✅ Integración con OnlyOffice para Política
- ✅ Portal K+AIR para Plan de Trabajo

---

**Mantenido por:** Product Architect & Full-Stack Team  
**Última actualización:** 9 de junio de 2026
**Versión:** 0.1.99
