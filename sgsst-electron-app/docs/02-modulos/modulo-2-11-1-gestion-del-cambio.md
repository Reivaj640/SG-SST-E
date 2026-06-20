# Submódulo 2.11.1 — Gestión del Cambio

**Versión:** 1.0
**Actualizado:** 9 de junio de 2026
**Módulo padre:** Gestión Integral (Módulo 2)
**Código SG-SST:** 2.11.1

---

## Descripción

Sistema de gestión del cambio que permite solicitar, evaluar, aprobar, ejecutar y cerrar cambios organizacionales. Implementa un wizard de 4 pasos con máquina de estados y lista de chequeo GI-FO-058. Cumple Resolución 0312 de 2019.

## Arquitectura

### Patrón: Componente Direct DOM + Viewer Wrapper

Componente principal `GestionDelCambioComponent` renderiza HTML directamente en el container. Un viewer wrapper `GestionDelCambioViewer` carga el script lógico dinámicamente si no existe en `window`.

### Máquina de Estados

```
Solicitud → En Evaluación → Aprobado → En Ejecución → Cerrado
                           ↘ No Aprobado (terminal)
```

Validación por transición:

| Estado destino | Campos requeridos |
|---|---|
| Cualquier transición | fecha, areaEjecutora, responsable, descripcion |
| Aprobado / No Aprobado | 13 items checklist + nivelRiesgo |
| En Ejecución | Al menos 1 fecha aprobación (área o SST) |
| Cerrado | fechaEjecucion + fechaCierre |

## Archivos

| Archivo | Líneas | Propósito |
|---|---|---|
| `modules/gestion-integral/gestion-del-cambio/gestion-cambio-logic.js` | 945 | Lógica principal `GestionDelCambioComponent` |
| `modules/gestion-integral/gestion-del-cambio/gestion-cambio-viewer.js` | 72 | Wrapper `GestionDelCambioViewer` |
| `modules/gestion-integral/gestion-del-cambio/gestion-cambio-view.html` | 817 | HTML: Dashboard + Modal Wizard 4 pasos |
| `modules/gestion-integral/gestion-del-cambio/gestion-cambio-view.css` | 574 | CSS Dashboard (prefijo `kair-gc-`) |
| `modules/gestion-integral/gestion-del-cambio/gestion-cambio-modal.css` | 836 | CSS Modal Wizard |

## Contratos IPC

| Canal | Método Preload | Descripción |
|---|---|---|
| `gestion-cambio-load-data` | `loadGestionCambioData(company)` | Cargar cambios desde Excel |
| `gestion-cambio-save-data` | `saveGestionCambioData(company, data)` | Guardar cambio en Excel |
| `gestion-cambio-generate-id` | `generateGestionCambioId(company)` | Generar ID secuencial CHG-YYYY-XXX |
| `gestion-cambio-update-estado` | `updateGestionCambioEstado(company, id, estado, extra)` | Transición de estado |

## Estructura de Datos

### Almacenamiento: Excel `GI-FO-059_GestionDelCambio.xlsx`

- 20 columnas: 19 campos principales + columna `jsonFull` con objeto completo serializado
- Columnas: id, fecha, areaEjecutora, areaUsuaria, responsable, cargo, descripcion, justificacion, tipoCambio, nivelRiesgo, estado, riesgoAntes, riesgoDespues, introducePeligros, modificaRiesgos, fechaEjecucion, controlesImplementados, controlesEficaces, fechaCierre, jsonFull
- `jsonFull` = serialización completa del objeto (incluye checklist, controles, planAccion, aprobaciones)

### Objeto de datos completo

```javascript
{
  // Step 1: Identificación
  id: "CHG-2026-001",
  fecha: "2026-06-09",
  areaEjecutora: "Producción",
  areaUsuaria: "Operaciones",
  responsable: "Juan Pérez",
  cargo: "Supervisor",
  descripcion: "...",
  justificacion: "...",
  tipoCambio: ["Operativo", "Tecnológico"],

  // Step 2: Lista de Chequeo (13 items GI-FO-058)
  checklist: {
    rh1: "SI", rh1Esp: "...", rh1Resp: "...",
    rh2: "NO", rh2Esp: "",    rh2Resp: "",
    rh3: "NA", rh3Esp: "",    rh3Resp: "",
    rh4: "NO", rh4Esp: "",    rh4Resp: "",
    rl1: "SI", rl1Esp: "...", rl1Resp: "...",
    rl2: "NO", rl2Esp: "",    rl2Resp: "",
    rl3: "NO", rl3Esp: "",    rl3Resp: "",
    sst1: "SI", sst1Esp: "...", sst1Resp: "...",
    sst2: "NO", sst2Esp: "",    sst2Resp: "",
    sst3: "NA", sst3Esp: "",    sst3Resp: "",
    sst4: "NO", sst4Esp: "",    sst4Resp: "",
    sst5: "NO", sst5Esp: "",    sst5Resp: "",
    sst6: "SI", sst6Esp: "...", sst6Resp: "...",
  },
  decision: "aprobado" | "aprobado_con_acciones" | "no_aprobado",
  accionesRequeridas: "...",

  // Step 3: Evaluación y Controles
  introducePeligros: true,
  modificaRiesgos: false,
  controles: {
    eliminacion:     { descripcion, responsable, fecha },
    sustitucion:     { descripcion, responsable, fecha },
    ingenieria:       { descripcion, responsable, fecha },
    administrativos: { descripcion, responsable, fecha },
    epp:             { descripcion, responsable, fecha },
  },
  nivelRiesgo: "BAJO" | "MEDIO" | "ALTO",

  // Step 4: Plan y Cierre
  planAccion: [
    { actividad, responsable, fechaInicio, fechaFin, estado: "Pendiente"|"En Proceso"|"Completado" }
  ],
  aprobaciones: {
    areaFecha,    areaFirma,
    sstFecha,     sstFirma,     // Requerido
    gerenciaFecha, gerenciaFirma,
  },
  fechaEjecucion: "2026-07-15",
  controlesImplementados: "SI" | "NO",
  fechaVerificacion: "2026-07-20",
  controlesEficaces: "SI" | "NO",
  fechaCierre: "2026-07-25",
  conclusion: "...",

  // Metadata
  estado: "Solicitud" | "En Evaluación" | "Aprobado" | "No Aprobado" | "En Ejecución" | "Cerrado",
}
```

## UI — Dashboard

- **4 KPI cards:** Aprobaciones Pendientes, Cambios Alto Riesgo, Cambios Activos, Cambios este Mes
- **Pipeline 5 etapas:** Solicitud → En Evaluación → Aprobado → En Ejecución → Cerrado
- **Tabla:** ID, Fecha, Area, Tipo, Responsable, Riesgo, Estado, Acciones
- **Filtros:** estado, nivel riesgo

## UI — Modal Wizard 4 Pasos

| Paso | Nombre | Contenido |
|---|---|---|
| 1 | Identificación | Form: ID (auto), fecha, áreas, responsable, descripción, justificación, 8 checkboxes tipo |
| 2 | Lista de Chequeo | 13 items (4 RH + 3 RL + 6 SST), cada uno SI/NO/NA + especificar + responsable. Decisión |
| 3 | Evaluación y Controles | Tabla impacto, riesgo antes/después, 5 controles jerárquicos, nivel riesgo |
| 4 | Plan y Cierre | Plan acción (filas dinámicas), 3 aprobaciones, ejecución, verificación, cierre |

## Navegación

- **Módulo:** Gestión Integral
- **Sidebar:** "2.11.1 Gestión del Cambio"
- **Ruta:** `gestion-integral.plan-trabajo`
- **Instanciación:** `new window.GestionDelCambioComponent(container, company, module, submodule, callback)`
- **Script:** `index.html` línea 127

## Observaciones

1. Almacenamiento dual: 19 columnas Excel + columna `jsonFull` para datos completos
2. Máquina de estados validada tanto en frontend como en backend
3. Protección XSS: método `#esc()` para escapar HTML
4. CSS aislado con prefijo `kair-gc-` y custom properties
5. Patrón Viewer/Logic: `GestionDelCambioViewer` carga lógica dinámicamente

---

**Mantenido por:** Frontend Team
**Última actualización:** 9 de junio de 2026
**Versión doc:** 1.0 (v0.1.99)
